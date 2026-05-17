import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { homedir, platform } from "node:os";
import { SCHEMA_VERSION, buildEventFacets, parseEvent, type EventEnvelope } from "../schema/index.js";
import { applyRedaction } from "../redaction/index.js";
import type { Provider, ProviderImportContext, ProviderImportResult } from "./types.js";

export interface VscodeChatDebugOptions {
  /** Explicit log files or directories to scan; merged with default roots when `includeDefaults` is true. */
  paths: string[];
  /** When true, also scan the platform default VS Code logs/workspaceStorage locations. */
  includeDefaults: boolean;
}

export interface VscodeChatDebugRootStats {
  path: string;
  discoveredFiles: number;
  importedEvents: number;
  skippedLines: number;
}

export interface VscodeChatDebugImportResult extends ProviderImportResult {
  rootStats: VscodeChatDebugRootStats[];
  enabled: boolean;
  discoveredFiles: number;
}

function stableUuid(input: string): string {
  const hex = createHash("sha256").update(input).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  const variant = Number.parseInt(hex[16], 16);
  hex[16] = ((variant & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function vscodeSessionId(logPath: string, machineId: string): string {
  return `vscode-copilot-chat-${stableUuid(`${machineId}:${logPath}`).slice(0, 8)}`;
}

function isVscodeCopilotChatLogPath(logPath: string): boolean {
  const normalizedPath = logPath.replaceAll("\\", "/").toLowerCase();
  const lowerBase = basename(logPath).toLowerCase();
  if (!lowerBase.endsWith(".log") && !lowerBase.endsWith(".jsonl")) {
    return false;
  }

  return lowerBase.includes("github copilot chat")
    || lowerBase.includes("copilot chat")
    || lowerBase.includes("github.copilot-chat")
    || normalizedPath.includes("/github.copilot-chat/");
}

export function normalizeRootPath(rootPath: string): string {
  return resolve(rootPath).replaceAll("\\", "/").replace(/\/+$/, "");
}

function rootForFile(filePath: string, roots: string[]): string {
  const normalizedFile = normalizeRootPath(filePath);
  let bestMatch: string | undefined;
  for (const root of roots) {
    const normalizedRoot = normalizeRootPath(root);
    if (normalizedFile === normalizedRoot || normalizedFile.startsWith(`${normalizedRoot}/`)) {
      if (!bestMatch || normalizedRoot.length > bestMatch.length) {
        bestMatch = normalizedRoot;
      }
    }
  }
  return bestMatch ?? "(unmatched)";
}

export function defaultVscodeChatDebugRoots(): string[] {
  const override = process.env.VISUALIZER_VSCODE_DEBUG_ROOTS;
  if (typeof override === "string" && override.trim().length > 0) {
    return override
      .split(process.platform === "win32" ? ";" : ":")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((entry) => resolve(entry));
  }

  const home = homedir();
  const candidates = platform() === "win32"
    ? [
      process.env.APPDATA ? join(process.env.APPDATA, "Code", "logs") : undefined,
      process.env.APPDATA ? join(process.env.APPDATA, "Code - Insiders", "logs") : undefined,
      process.env.APPDATA ? join(process.env.APPDATA, "Code", "User", "workspaceStorage") : undefined,
      process.env.APPDATA ? join(process.env.APPDATA, "Code - Insiders", "User", "workspaceStorage") : undefined
    ]
    : platform() === "darwin"
      ? [
        join(home, "Library", "Application Support", "Code", "logs"),
        join(home, "Library", "Application Support", "Code - Insiders", "logs"),
        join(home, "Library", "Application Support", "Code", "User", "workspaceStorage"),
        join(home, "Library", "Application Support", "Code - Insiders", "User", "workspaceStorage")
      ]
      : [
        join(home, ".config", "Code", "logs"),
        join(home, ".config", "Code - Insiders", "logs"),
        join(home, ".vscode-server", "data", "logs"),
        join(home, ".vscode-server-insiders", "data", "logs"),
        join(home, ".config", "Code", "User", "workspaceStorage"),
        join(home, ".config", "Code - Insiders", "User", "workspaceStorage")
      ];

  return candidates.filter((candidate): candidate is string => Boolean(candidate));
}

async function discoverVscodeChatDebugFiles(paths: string[], depth = 0): Promise<string[]> {
  const files: string[] = [];
  if (depth > 6) {
    return files;
  }

  for (const candidate of paths) {
    if (!existsSync(candidate)) {
      continue;
    }

    const info = await stat(candidate);
    if (info.isFile()) {
      files.push(candidate);
      continue;
    }
    if (!info.isDirectory()) {
      continue;
    }

    const childPaths = (await readdir(candidate, { withFileTypes: true }))
      .map((entry) => join(candidate, entry.name));
    for (const childPath of childPaths) {
      const childInfo = await stat(childPath);
      if (childInfo.isFile() && isVscodeCopilotChatLogPath(childPath)) {
        files.push(childPath);
      } else if (childInfo.isDirectory()) {
        files.push(...await discoverVscodeChatDebugFiles([childPath], depth + 1));
      }
    }
  }

  return [...new Set(files)].sort();
}

export function parseVscodeChatDebugLine(line: string): { timestamp?: string; level?: string; message: string } {
  let remainder = line.trim();
  let timestamp: string | undefined;
  const timestampMatch = remainder.match(/^\[?(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z?)\]?\s*/);
  if (timestampMatch?.[1]) {
    const normalized = timestampMatch[1].includes("T")
      ? timestampMatch[1]
      : timestampMatch[1].replace(" ", "T");
    const withZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
    const parsed = new Date(withZone);
    if (!Number.isNaN(parsed.getTime())) {
      timestamp = parsed.toISOString();
    }
    remainder = remainder.slice(timestampMatch[0].length).trim();
  }

  const levelMatch = remainder.match(/\[(trace|debug|info|warn|warning|error)\]/i)
    ?? remainder.match(/^(trace|debug|info|warn|warning|error)\b/i);
  const level = levelMatch?.[1]?.toLowerCase().replace("warning", "warn");

  return {
    timestamp,
    level,
    message: remainder
  };
}

interface LineContext {
  logPath: string;
  lineNumber: number;
  line: string;
  machineId: string;
  userId: string;
  includeRawPayload: boolean;
  redact: boolean;
  now: () => string;
}

function normalizeLine(context: LineContext): EventEnvelope | null {
  const parsed = parseVscodeChatDebugLine(context.line);
  const level = parsed.level ?? "debug";
  const sourceEventType = `vscode.copilot-chat.${level}`;
  const payload = {
    sourceEventType,
    data: {
      level,
      message: parsed.message
    },
    sourceLine: context.lineNumber,
    sourcePath: context.logPath
  };
  const timestamp = parsed.timestamp ?? context.now();
  const sessionId = vscodeSessionId(context.logPath, context.machineId);
  const event = {
    schemaVersion: SCHEMA_VERSION,
    eventId: stableUuid(`${context.machineId}:${context.logPath}:${context.lineNumber}:${context.line}`),
    eventType: "sourceEvent",
    timestamp,
    sessionId,
    userId: context.userId,
    machineId: context.machineId,
    source: "vscode",
    sourceVersion: "copilot-chat-debug-log-v1",
    repoPath: "vscode-copilot-chat",
    workspaceId: "vscode-copilot-chat",
    privacy: {
      classification: "internal",
      locallyRedacted: false,
      rawPayloadOptIn: context.includeRawPayload,
      retention: "standard"
    },
    confidence: "inferred",
    facets: buildEventFacets("sourceEvent", payload),
    rawPayload: context.includeRawPayload
      ? {
        redacted: false,
        retainedFor: "debug",
        payload: {
          sourceEventType,
          sourceLine: context.lineNumber,
          sourcePath: context.logPath,
          rawLine: context.line
        }
      }
      : undefined,
    payload
  };

  const validation = parseEvent(event);
  if (!validation.ok) {
    return null;
  }
  return context.redact ? applyRedaction(validation.value) : validation.value;
}

export const vscodeChatDebugProvider: Provider<VscodeChatDebugOptions> & {
  importWithRootStats(options: VscodeChatDebugOptions, ctx: ProviderImportContext): Promise<VscodeChatDebugImportResult>;
} = {
  name: "vscode-chat-debug",
  description: "Imports VS Code GitHub Copilot Chat debug logs from `logs/` and `User/workspaceStorage/*/GitHub.copilot-chat/`.",
  async import(options, ctx): Promise<ProviderImportResult> {
    const result = await this.importWithRootStats(options, ctx);
    return { stats: result.stats, events: result.events };
  },
  async importWithRootStats(options, ctx): Promise<VscodeChatDebugImportResult> {
    const events: EventEnvelope[] = [];
    const sessions = new Set<string>();
    let importedEvents = 0;
    let skippedLines = 0;

    const allPaths = [
      ...options.paths,
      ...(options.includeDefaults ? defaultVscodeChatDebugRoots() : [])
    ];
    const normalizedRoots = [...new Set(allPaths.map((rootPath) => normalizeRootPath(rootPath)))];
    const enabled = normalizedRoots.length > 0 || options.includeDefaults;

    const rootStats = new Map<string, VscodeChatDebugRootStats>();
    for (const rootPath of normalizedRoots) {
      rootStats.set(rootPath, { path: rootPath, discoveredFiles: 0, importedEvents: 0, skippedLines: 0 });
    }

    const discoveredFiles = await discoverVscodeChatDebugFiles(allPaths);
    for (const logPath of discoveredFiles) {
      const matchedRoot = rootForFile(logPath, normalizedRoots);
      if (!rootStats.has(matchedRoot)) {
        rootStats.set(matchedRoot, { path: matchedRoot, discoveredFiles: 0, importedEvents: 0, skippedLines: 0 });
      }
      const stats = rootStats.get(matchedRoot)!;
      stats.discoveredFiles += 1;

      const sessionId = vscodeSessionId(logPath, ctx.machineId);
      sessions.add(sessionId);
      const lines = (await readFile(logPath, "utf8"))
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);
      for (let index = 0; index < lines.length; index += 1) {
        const event = normalizeLine({
          logPath,
          lineNumber: index + 1,
          line: lines[index],
          machineId: ctx.machineId,
          userId: ctx.userId,
          includeRawPayload: ctx.includeRawPayload,
          redact: ctx.redact,
          now: ctx.now
        });
        if (!event) {
          skippedLines += 1;
          stats.skippedLines += 1;
          continue;
        }
        events.push(event);
        importedEvents += 1;
        stats.importedEvents += 1;
      }
    }

    return {
      stats: {
        name: vscodeChatDebugProvider.name,
        sessions: [...sessions].sort(),
        importedEvents,
        skippedLines,
        deduplicatedEvents: 0
      },
      events,
      enabled,
      discoveredFiles: discoveredFiles.length,
      rootStats: [...rootStats.values()].sort((a, b) => a.path.localeCompare(b.path))
    };
  }
};
