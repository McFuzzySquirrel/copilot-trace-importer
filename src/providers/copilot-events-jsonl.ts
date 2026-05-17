import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { SCHEMA_VERSION, buildEventFacets, parseEvent, type EventEnvelope } from "../schema/index.js";
import { applyRedaction } from "../redaction/index.js";
import type { CopilotSessionRow } from "./copilot-session-store.js";
import type { Provider, ProviderImportContext, ProviderImportResult } from "./types.js";
import { dedupKey, estimateTokensFromText, inferModelFamilyFromToolCallId } from "./copilot-shared.js";

export interface CopilotEventsJsonlOptions {
  /** Path to the session-store DB; used to locate the sibling `session-state/<id>/events.jsonl`. */
  dbPath: string;
  /** Session rows whose event streams should be imported. */
  sessions: CopilotSessionRow[];
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function sourceEventsPath(dbPath: string, sessionId: string): string {
  return resolve(dirname(dbPath), "session-state", sessionId, "events.jsonl");
}

function stableUuid(input: string): string {
  const hex = createHash("sha256").update(input).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  const variant = Number.parseInt(hex[16], 16);
  hex[16] = ((variant & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function eventTimestamp(source: Record<string, unknown>, session: CopilotSessionRow, now: () => string): string {
  const raw = source.timestamp ?? asRecord(source.data).timestamp ?? session.updated_at ?? session.created_at;
  return typeof raw === "string" && raw.trim().length > 0 ? raw : now();
}

/**
 * Collect every tool-call ID that appears in a Copilot event payload, both
 * on top-level `data` (single-tool events) and within nested `toolRequests`
 * (assistant messages that batch multiple tool requests).
 */
function collectToolCallIds(data: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const top = data.toolCallId;
  if (typeof top === "string" && top.length > 0) {
    ids.push(top);
  }
  const requests = data.toolRequests;
  if (Array.isArray(requests)) {
    for (const request of requests) {
      if (request && typeof request === "object" && !Array.isArray(request)) {
        const id = (request as Record<string, unknown>).toolCallId;
        if (typeof id === "string" && id.length > 0) {
          ids.push(id);
        }
      }
    }
  }
  return ids;
}

/**
 * Apply codeburn-inspired Copilot lessons (see ADR-003) to an envelope's
 * facets in-place: infer model family from tool-call ID prefix when no
 * explicit model was provided, and fall back to char-based token estimation
 * when `outputTokens` is missing but message text is present.
 *
 * Both enrichments are marked `confidence: "heuristic"` so downstream
 * tooling can discount them.
 */
function applyCopilotInferenceLessons(event: EventEnvelope, sourceRecord: Record<string, unknown>): EventEnvelope {
  const data = asRecord(sourceRecord.data);
  const toolCallIds = collectToolCallIds(data);
  const inferredFamily = toolCallIds
    .map((id) => inferModelFamilyFromToolCallId(id))
    .find((family): family is string => Boolean(family));

  const messageText = safeString(data.message, "")
    || safeString(data.content, "")
    || safeString(data.responseText, "");
  const estimatedOutputTokens = estimateTokensFromText(messageText || undefined);

  const modelUsage = (event.facets.modelUsage ?? []).map((entry) => ({ ...entry }));
  const tokenUsage = (event.facets.tokenUsage ?? []).map((entry) => ({ ...entry }));

  // 1. Model family inference: only fills the gap; never overwrites an exact label.
  if (inferredFamily) {
    if (modelUsage.length === 0) {
      modelUsage.push({ model: inferredFamily, confidence: "heuristic" });
    } else {
      for (const entry of modelUsage) {
        if (!entry.model || entry.model.length === 0) {
          entry.model = inferredFamily;
          entry.confidence = "heuristic";
        }
      }
    }
  }

  // 2. Char-based output-token fallback: only fills `outputTokens` when missing.
  if (estimatedOutputTokens !== undefined) {
    if (modelUsage.length === 0 && tokenUsage.length === 0) {
      modelUsage.push({ outputTokens: estimatedOutputTokens, totalTokens: estimatedOutputTokens, confidence: "heuristic" });
      tokenUsage.push({ outputTokens: estimatedOutputTokens, totalTokens: estimatedOutputTokens, confidence: "heuristic" });
    } else {
      for (const entry of modelUsage) {
        if (entry.outputTokens === undefined) {
          entry.outputTokens = estimatedOutputTokens;
          entry.totalTokens = (entry.inputTokens ?? 0) + estimatedOutputTokens;
          entry.confidence = "heuristic";
        }
      }
      for (const entry of tokenUsage) {
        if (entry.outputTokens === undefined) {
          entry.outputTokens = estimatedOutputTokens;
          entry.totalTokens = (entry.inputTokens ?? 0) + estimatedOutputTokens;
          entry.confidence = "heuristic";
        }
      }
    }
  }

  if (modelUsage.length === (event.facets.modelUsage?.length ?? 0)
      && tokenUsage.length === (event.facets.tokenUsage?.length ?? 0)
      && !inferredFamily
      && estimatedOutputTokens === undefined) {
    return event;
  }

  return {
    ...event,
    facets: {
      ...event.facets,
      modelUsage,
      tokenUsage
    }
  };
}

/**
 * Build a stable dedup key for a single Copilot event line. We prefer the
 * source's `messageId` when present (codeburn's approach), otherwise we
 * fall back to interactionId + the first tool-call ID + sourceEventType so
 * upgrade/replay scenarios still collapse. See ADR-003.
 */
function buildDedupKey(sourceRecord: Record<string, unknown>): string {
  const data = asRecord(sourceRecord.data);
  const messageId = safeString(data.messageId, "") || safeString(sourceRecord.messageId, "");
  if (messageId) {
    return messageId;
  }
  const interactionId = safeString(data.interactionId, "");
  const firstToolCallId = collectToolCallIds(data)[0] ?? "";
  const sourceEventType = safeString(sourceRecord.type, "");
  return dedupKey([interactionId, firstToolCallId, sourceEventType]);
}

interface LineContext {
  dbPath: string;
  session: CopilotSessionRow;
  eventsPath: string;
  lineNumber: number;
  line: string;
  machineId: string;
  userId: string;
  includeRawPayload: boolean;
  redact: boolean;
  now: () => string;
}

function normalizeLine(context: LineContext): { event: EventEnvelope; sourceRecord: Record<string, unknown> } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(context.line);
  } catch {
    return null;
  }

  const sourceRecord = asRecord(parsed);
  const sourceEventType = safeString(sourceRecord.type, "unknown");
  const sourceData = asRecord(sourceRecord.data);
  const payload = {
    sourceEventType,
    data: sourceData,
    sourceLine: context.lineNumber,
    sourcePath: context.eventsPath
  };
  const repoPath = safeString(context.session.cwd, safeString(context.session.repository, "unknown-repo"));
  const workspaceId = safeString(context.session.repository, repoPath);
  const timestamp = eventTimestamp(sourceRecord, context.session, context.now);
  const event = {
    schemaVersion: SCHEMA_VERSION,
    eventId: stableUuid(`${context.machineId}:${context.dbPath}:${context.session.id}:${context.eventsPath}:${context.lineNumber}:${context.line}`),
    eventType: "sourceEvent",
    timestamp,
    sessionId: context.session.id,
    userId: context.userId,
    machineId: context.machineId,
    source: "copilot-session-store",
    sourceVersion: "session-store-v1",
    repoPath,
    workspaceId,
    workspacePath: repoPath,
    privacy: {
      classification: "internal",
      locallyRedacted: false,
      rawPayloadOptIn: context.includeRawPayload,
      retention: "standard"
    },
    confidence: "exact",
    facets: buildEventFacets("sourceEvent", payload),
    rawPayload: context.includeRawPayload
      ? {
        redacted: false,
        retainedFor: "debug",
        payload: {
          sourceEventType,
          sourceLine: context.lineNumber,
          sourcePath: context.eventsPath,
          rawEvent: sourceRecord
        }
      }
      : undefined,
    payload
  };

  const validation = parseEvent(event);
  if (!validation.ok) {
    return null;
  }
  const enriched = applyCopilotInferenceLessons(validation.value, sourceRecord);
  const finalEvent = context.redact ? applyRedaction(enriched) : enriched;
  return { event: finalEvent, sourceRecord };
}

export const copilotEventsJsonlProvider: Provider<CopilotEventsJsonlOptions> = {
  name: "copilot-events-jsonl",
  description: "Imports per-session events.jsonl streams emitted by the Copilot CLI session store.",
  async import(options, ctx): Promise<ProviderImportResult> {
    const events: EventEnvelope[] = [];
    const sessions = new Set<string>();
    const seenDedupKeys = new Set<string>();
    let importedEvents = 0;
    let skippedLines = 0;
    let deduplicatedEvents = 0;

    for (const session of options.sessions) {
      const eventsPath = sourceEventsPath(options.dbPath, session.id);
      if (!existsSync(eventsPath)) {
        continue;
      }
      sessions.add(session.id);

      const lines = (await readFile(eventsPath, "utf8"))
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);

      for (let index = 0; index < lines.length; index += 1) {
        const result = normalizeLine({
          dbPath: options.dbPath,
          session,
          eventsPath,
          lineNumber: index + 1,
          line: lines[index],
          machineId: ctx.machineId,
          userId: ctx.userId,
          includeRawPayload: ctx.includeRawPayload,
          redact: ctx.redact,
          now: ctx.now
        });
        if (!result) {
          skippedLines += 1;
          continue;
        }
        const key = buildDedupKey(result.sourceRecord);
        if (seenDedupKeys.has(key)) {
          deduplicatedEvents += 1;
          continue;
        }
        seenDedupKeys.add(key);
        events.push(result.event);
        importedEvents += 1;
      }
    }

    return {
      stats: {
        name: copilotEventsJsonlProvider.name,
        sessions: [...sessions].sort(),
        importedEvents,
        skippedLines,
        deduplicatedEvents
      },
      events
    };
  }
};

// Test-only exports.
export const __test = {
  buildDedupKey,
  applyCopilotInferenceLessons,
  collectToolCallIds
};
