import { appendFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { hostname, userInfo } from "node:os";
import { parseEvent } from "./schema/index.js";
import {
  copilotEventsJsonlProvider,
  readCopilotSessionRows,
  vscodeChatDebugProvider,
  type CopilotSessionRow,
  type ProviderImportContext
} from "./providers/index.js";

export interface CopilotSessionStoreImportOptions {
  dbPath: string;
  datastorePath: string;
  sessionIds?: string[];
  machineId?: string;
  userId?: string;
  includeRawPayload?: boolean;
  redact?: boolean;
  includeSessionStore?: boolean;
  includeDefaultVscodeChatDebug?: boolean;
  vscodeChatDebugPaths?: string[];
  now?: () => string;
}

export interface DatastoreImportResult {
  datastorePath: string;
  importedEvents: number;
  skippedLines: number;
  sessions: string[];
  /** Count of events suppressed by per-provider dedup (e.g. Copilot messageId collisions). */
  deduplicatedEvents?: number;
  vscodeDebugImport?: {
    enabled: boolean;
    discoveredFiles: number;
    roots: Array<{
      path: string;
      discoveredFiles: number;
      importedEvents: number;
      skippedLines: number;
    }>;
  };
}

export interface DatastoreSummary {
  datastorePath: string;
  eventCount: number;
  sessionCount: number;
  machineCount: number;
  sourceCount: number;
  sessions: string[];
  machines: string[];
  sources: string[];
  sourceEventCounts: Record<string, number>;
  earliestTimestamp?: string;
  latestTimestamp?: string;
  vscodePathBreakdown?: {
    totalVscodeEvents: number;
    buckets: {
      logs: number;
      workspaceStorage: number;
      other: number;
      missingSourcePath: number;
    };
    topSourcePaths: Array<{
      path: string;
      events: number;
    }>;
  };
}

export interface DatastoreSummaryOptions {
  verbose?: boolean;
  topSourcePathsLimit?: number;
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function defaultMachineId(): string {
  return hostname() || "unknown";
}

function defaultUserId(): string {
  try {
    return userInfo().username || "unknown";
  } catch {
    return "unknown";
  }
}

function classifyVscodeSourcePath(sourcePath: string): "logs" | "workspaceStorage" | "other" {
  const normalizedPath = sourcePath.replaceAll("\\", "/").toLowerCase();
  if (normalizedPath.includes("/user/workspacestorage/") && normalizedPath.includes("/github.copilot-chat/")) {
    return "workspaceStorage";
  }
  if (normalizedPath.includes("/logs/")) {
    return "logs";
  }
  return "other";
}

/**
 * Back-compat re-export: external callers depend on this name. Internally
 * the equivalent function now lives in `providers/copilot-session-store.ts`.
 */
export function getCopilotSessionRows(dbPath: string, sessionIds?: string[]): CopilotSessionRow[] {
  return readCopilotSessionRows({ dbPath, sessionIds });
}

/**
 * Orchestrate a multi-provider import into the append-only JSONL datastore.
 *
 * This function is intentionally thin: it builds the {@link ProviderImportContext},
 * delegates to the {@link BUILTIN_PROVIDERS}, and persists the returned
 * envelopes. All source-specific logic lives in `src/providers/`.
 */
export async function importCopilotSessionStore(options: CopilotSessionStoreImportOptions): Promise<DatastoreImportResult> {
  const ctx: ProviderImportContext = {
    machineId: options.machineId ?? defaultMachineId(),
    userId: options.userId ?? defaultUserId(),
    includeRawPayload: options.includeRawPayload ?? false,
    redact: options.redact ?? true,
    now: options.now ?? (() => new Date().toISOString())
  };

  const includeSessionStore = options.includeSessionStore ?? true;
  const sessions = includeSessionStore ? readCopilotSessionRows({ dbPath: options.dbPath, sessionIds: options.sessionIds }) : [];

  await mkdir(dirname(options.datastorePath), { recursive: true });

  let importedEvents = 0;
  let skippedLines = 0;
  let deduplicatedEvents = 0;
  const importedSessions = new Set<string>(sessions.map((session) => session.id));

  // 1. Copilot CLI per-session events.jsonl
  const copilotResult = await copilotEventsJsonlProvider.import(
    { dbPath: options.dbPath, sessions },
    ctx
  );
  for (const event of copilotResult.events) {
    await appendFile(options.datastorePath, `${JSON.stringify(event)}\n`, "utf8");
  }
  importedEvents += copilotResult.stats.importedEvents;
  skippedLines += copilotResult.stats.skippedLines;
  deduplicatedEvents += copilotResult.stats.deduplicatedEvents;
  for (const sessionId of copilotResult.stats.sessions) {
    importedSessions.add(sessionId);
  }

  // 2. VS Code Copilot Chat debug logs
  const explicitVscodePaths = options.vscodeChatDebugPaths ?? [];
  const includeDefaults = options.includeDefaultVscodeChatDebug ?? false;
  const vscodeResult = await vscodeChatDebugProvider.importWithRootStats(
    { paths: explicitVscodePaths, includeDefaults },
    ctx
  );
  for (const event of vscodeResult.events) {
    await appendFile(options.datastorePath, `${JSON.stringify(event)}\n`, "utf8");
  }
  importedEvents += vscodeResult.stats.importedEvents;
  skippedLines += vscodeResult.stats.skippedLines;
  for (const sessionId of vscodeResult.stats.sessions) {
    importedSessions.add(sessionId);
  }

  return {
    datastorePath: options.datastorePath,
    importedEvents,
    skippedLines,
    sessions: [...importedSessions].sort(),
    deduplicatedEvents: deduplicatedEvents > 0 ? deduplicatedEvents : undefined,
    vscodeDebugImport: vscodeResult.enabled
      ? {
        enabled: vscodeResult.enabled,
        discoveredFiles: vscodeResult.discoveredFiles,
        roots: vscodeResult.rootStats.map(({ path, discoveredFiles, importedEvents, skippedLines }) => ({
          path,
          discoveredFiles,
          importedEvents,
          skippedLines
        }))
      }
      : undefined
  };
}

export async function summarizeDatastore(datastorePath: string, options: DatastoreSummaryOptions = {}): Promise<DatastoreSummary> {
  const verbose = options.verbose ?? false;
  const topSourcePathsLimit = options.topSourcePathsLimit ?? 20;
  const sessions = new Set<string>();
  const machines = new Set<string>();
  const sources = new Set<string>();
  const sourceEventCounts = new Map<string, number>();
  const vscodeBuckets = {
    logs: 0,
    workspaceStorage: 0,
    other: 0,
    missingSourcePath: 0
  };
  const vscodeSourcePathCounts = new Map<string, number>();
  let eventCount = 0;
  let earliestTimestamp: string | undefined;
  let latestTimestamp: string | undefined;

  if (!existsSync(datastorePath)) {
    return {
      datastorePath,
      eventCount: 0,
      sessionCount: 0,
      machineCount: 0,
      sourceCount: 0,
      sessions: [],
      machines: [],
      sources: [],
      sourceEventCounts: {}
    };
  }

  const lines = (await readFile(datastorePath, "utf8"))
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  for (const line of lines) {
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      continue;
    }
    const parsed = parseEvent(raw);
    if (!parsed.ok) {
      continue;
    }
    eventCount += 1;
    sessions.add(parsed.value.sessionId);
    machines.add(parsed.value.machineId);
    sources.add(parsed.value.source);
    sourceEventCounts.set(
      parsed.value.source,
      (sourceEventCounts.get(parsed.value.source) ?? 0) + 1
    );
    if (verbose && parsed.value.source === "vscode") {
      const sourcePath = safeString(asRecord(parsed.value.payload).sourcePath, "");
      if (sourcePath.length === 0) {
        vscodeBuckets.missingSourcePath += 1;
      } else {
        const bucket = classifyVscodeSourcePath(sourcePath);
        vscodeBuckets[bucket] += 1;
        vscodeSourcePathCounts.set(sourcePath, (vscodeSourcePathCounts.get(sourcePath) ?? 0) + 1);
      }
    }
    if (!earliestTimestamp || parsed.value.timestamp < earliestTimestamp) {
      earliestTimestamp = parsed.value.timestamp;
    }
    if (!latestTimestamp || parsed.value.timestamp > latestTimestamp) {
      latestTimestamp = parsed.value.timestamp;
    }
  }

  return {
    datastorePath,
    eventCount,
    sessionCount: sessions.size,
    machineCount: machines.size,
    sourceCount: sources.size,
    sessions: [...sessions].sort(),
    machines: [...machines].sort(),
    sources: [...sources].sort(),
    sourceEventCounts: Object.fromEntries([...sourceEventCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
    vscodePathBreakdown: verbose
      ? {
        totalVscodeEvents: sourceEventCounts.get("vscode") ?? 0,
        buckets: vscodeBuckets,
        topSourcePaths: [...vscodeSourcePathCounts.entries()]
          .map(([path, events]) => ({ path, events }))
          .sort((a, b) => b.events - a.events || a.path.localeCompare(b.path))
          .slice(0, topSourcePathsLimit)
      }
      : undefined,
    earliestTimestamp,
    latestTimestamp
  };
}
