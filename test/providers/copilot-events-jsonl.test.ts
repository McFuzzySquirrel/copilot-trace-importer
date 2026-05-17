import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { copilotEventsJsonlProvider } from "../../src/providers/index.js";
import type { CopilotSessionRow } from "../../src/providers/index.js";

function makeSession(id: string, root: string): CopilotSessionRow {
  return {
    id,
    cwd: root,
    repository: "owner/repo",
    host_type: "github",
    branch: "main",
    created_at: "2026-04-20T10:00:00.000Z",
    updated_at: "2026-04-20T10:05:00.000Z"
  };
}

function writeSessionEvents(rootDir: string, sessionId: string, lines: string[]): string {
  const sessionDir = join(rootDir, "session-state", sessionId);
  mkdirSync(sessionDir, { recursive: true });
  const eventsPath = join(sessionDir, "events.jsonl");
  writeFileSync(eventsPath, lines.join("\n"), "utf8");
  return eventsPath;
}

describe("copilot-events-jsonl provider", () => {
  let tempRoot = "";
  let dbPath = "";

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), "copilot-events-jsonl-test-"));
    // dbPath need not exist; the provider only uses dirname(dbPath) to locate session-state/
    dbPath = join(tempRoot, "session-store.db");
  });

  afterEach(() => {
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("infers Anthropic model family from toolu_ tool-call ID prefix when no model is set", async () => {
    const session = makeSession("sess-anthropic", "/tmp/repo");
    writeSessionEvents(tempRoot, session.id, [
      JSON.stringify({
        type: "assistant.message",
        timestamp: "2026-04-20T10:01:00.000Z",
        data: {
          interactionId: "turn-1",
          // no model field
          toolRequests: [
            { name: "edit_file", toolCallId: "toolu_bdrk_xyz", arguments: { path: "src/a.ts" } }
          ]
        }
      })
    ]);

    const result = await copilotEventsJsonlProvider.import(
      { dbPath, sessions: [session] },
      {
        machineId: "machine-1",
        userId: "user-1",
        includeRawPayload: false,
        redact: true,
        now: () => "2026-04-20T10:00:00.000Z"
      }
    );

    expect(result.stats.importedEvents).toBe(1);
    const [event] = result.events;
    expect(event.facets.modelUsage[0]).toMatchObject({
      model: "anthropic",
      confidence: "heuristic"
    });
  });

  it("infers OpenAI model family from call_ tool-call ID prefix", async () => {
    const session = makeSession("sess-openai", "/tmp/repo");
    writeSessionEvents(tempRoot, session.id, [
      JSON.stringify({
        type: "assistant.message",
        timestamp: "2026-04-20T10:01:00.000Z",
        data: {
          interactionId: "turn-1",
          toolRequests: [
            { name: "bash", toolCallId: "call_abc123", arguments: { command: "ls" } }
          ]
        }
      })
    ]);

    const result = await copilotEventsJsonlProvider.import(
      { dbPath, sessions: [session] },
      {
        machineId: "machine-1",
        userId: "user-1",
        includeRawPayload: false,
        redact: true,
        now: () => "2026-04-20T10:00:00.000Z"
      }
    );

    expect(result.stats.importedEvents).toBe(1);
    expect(result.events[0].facets.modelUsage[0]).toMatchObject({
      model: "openai",
      confidence: "heuristic"
    });
  });

  it("never overwrites an explicit model with the inferred family", async () => {
    const session = makeSession("sess-explicit", "/tmp/repo");
    writeSessionEvents(tempRoot, session.id, [
      JSON.stringify({
        type: "assistant.message",
        timestamp: "2026-04-20T10:01:00.000Z",
        data: {
          interactionId: "turn-1",
          model: "gpt-5.3-codex",
          inputTokens: 10,
          outputTokens: 20,
          toolRequests: [
            { name: "edit_file", toolCallId: "toolu_xyz", arguments: { path: "src/a.ts" } }
          ]
        }
      })
    ]);

    const result = await copilotEventsJsonlProvider.import(
      { dbPath, sessions: [session] },
      {
        machineId: "machine-1",
        userId: "user-1",
        includeRawPayload: false,
        redact: true,
        now: () => "2026-04-20T10:00:00.000Z"
      }
    );

    expect(result.events[0].facets.modelUsage[0]).toMatchObject({
      model: "gpt-5.3-codex"
    });
    // The original confidence should be preserved (the inference fallback should not run).
    expect(result.events[0].facets.modelUsage[0].confidence).not.toBe("heuristic");
  });

  it("estimates outputTokens via char-based fallback when missing but a message body is present", async () => {
    const session = makeSession("sess-token-fallback", "/tmp/repo");
    const message = "a".repeat(40); // 40 / 4 = 10 tokens
    writeSessionEvents(tempRoot, session.id, [
      JSON.stringify({
        type: "assistant.message",
        timestamp: "2026-04-20T10:01:00.000Z",
        data: {
          interactionId: "turn-1",
          model: "gpt-5.3-codex",
          inputTokens: 7,
          // no outputTokens — has a message body
          message
        }
      })
    ]);

    const result = await copilotEventsJsonlProvider.import(
      { dbPath, sessions: [session] },
      {
        machineId: "machine-1",
        userId: "user-1",
        includeRawPayload: false,
        redact: true,
        now: () => "2026-04-20T10:00:00.000Z"
      }
    );

    expect(result.stats.importedEvents).toBe(1);
    const usage = result.events[0].facets.modelUsage[0];
    expect(usage.outputTokens).toBe(10);
    expect(usage.totalTokens).toBe(17);
    expect(usage.confidence).toBe("heuristic");
  });

  it("deduplicates events sharing the same messageId within a single import pass", async () => {
    const session = makeSession("sess-dedup", "/tmp/repo");
    const line = JSON.stringify({
      type: "assistant.message",
      timestamp: "2026-04-20T10:01:00.000Z",
      data: {
        interactionId: "turn-1",
        messageId: "msg-42",
        model: "gpt-5.3-codex",
        inputTokens: 1,
        outputTokens: 2
      }
    });
    // Same messageId emitted twice; second copy must be dropped.
    // Different `data.message` so the line text differs but messageId is the
    // dedup signal we expect to win.
    const dup = JSON.stringify({
      type: "assistant.message",
      timestamp: "2026-04-20T10:02:00.000Z",
      data: {
        interactionId: "turn-1",
        messageId: "msg-42",
        model: "gpt-5.3-codex",
        inputTokens: 1,
        outputTokens: 2,
        message: "duplicate-payload-but-same-message-id"
      }
    });
    writeSessionEvents(tempRoot, session.id, [line, dup]);

    const result = await copilotEventsJsonlProvider.import(
      { dbPath, sessions: [session] },
      {
        machineId: "machine-1",
        userId: "user-1",
        includeRawPayload: false,
        redact: true,
        now: () => "2026-04-20T10:00:00.000Z"
      }
    );

    expect(result.stats.importedEvents).toBe(1);
    expect(result.stats.deduplicatedEvents).toBe(1);
  });

  it("falls back to interactionId + first toolCallId + sourceEventType for dedup when messageId is missing", async () => {
    const session = makeSession("sess-dedup-fallback", "/tmp/repo");
    const payload = {
      type: "tool.execution_complete",
      timestamp: "2026-04-20T10:01:00.000Z",
      data: {
        interactionId: "turn-1",
        toolCallId: "tc-1",
        toolName: "subagent",
        success: true
      }
    };
    writeSessionEvents(tempRoot, session.id, [
      JSON.stringify(payload),
      JSON.stringify(payload)
    ]);

    const result = await copilotEventsJsonlProvider.import(
      { dbPath, sessions: [session] },
      {
        machineId: "machine-1",
        userId: "user-1",
        includeRawPayload: false,
        redact: true,
        now: () => "2026-04-20T10:00:00.000Z"
      }
    );

    expect(result.stats.importedEvents).toBe(1);
    expect(result.stats.deduplicatedEvents).toBe(1);
  });
});
