import { createHash } from "node:crypto";

/**
 * Approximate token-count fallback for providers that omit explicit
 * `outputTokens` (e.g. VS Code Copilot Chat transcripts). Mirrors the
 * value used by codeburn — see ADR-003 for rationale and citation.
 *
 * This is intentionally crude; events that use this fallback MUST be marked
 * with `confidence: "heuristic"` so downstream tooling can discount them.
 */
export const CHARS_PER_TOKEN = 4;

/**
 * Map a tool-call ID prefix to a model family. Copilot does not always tag
 * the model on each message; we infer from the prefix that the upstream
 * provider attaches when calling its tool API. See ADR-003.
 *
 * Sources: codeburn `src/providers/copilot.ts:176-213` and Anthropic /
 * OpenAI tool-use documentation.
 */
const TOOL_CALL_PREFIX_TO_MODEL_FAMILY: ReadonlyArray<{ prefix: string; family: string }> = [
  { prefix: "toolu_bdrk_", family: "anthropic" },
  { prefix: "toolu_vrtx_", family: "anthropic" },
  { prefix: "tooluse_", family: "anthropic" },
  { prefix: "toolu_", family: "anthropic" },
  { prefix: "call_", family: "openai" }
];

/**
 * Infer the model family from a tool-call ID. Returns `undefined` when the
 * prefix is unrecognized so callers can fall back to other signals.
 */
export function inferModelFamilyFromToolCallId(toolCallId: string | undefined): string | undefined {
  if (!toolCallId) {
    return undefined;
  }
  for (const { prefix, family } of TOOL_CALL_PREFIX_TO_MODEL_FAMILY) {
    if (toolCallId.startsWith(prefix)) {
      return family;
    }
  }
  return undefined;
}

/**
 * Estimate output-token count from a string body when the source did not
 * record explicit token counts. See {@link CHARS_PER_TOKEN}.
 *
 * Returns `undefined` for empty strings so the caller can leave the field
 * unset rather than emitting a meaningless `0`.
 */
export function estimateTokensFromText(text: string | undefined): number | undefined {
  if (typeof text !== "string" || text.length === 0) {
    return undefined;
  }
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

/**
 * Compute a stable dedup key for a Copilot message. We prefer the source's
 * own `messageId` (or `interactionId` + `toolCallId`) and fall back to a
 * content hash so identical replays still collapse. See ADR-003.
 */
export function dedupKey(parts: Array<string | undefined>): string {
  const joined = parts.filter((part): part is string => typeof part === "string" && part.length > 0).join("\u0001");
  if (joined.length === 0) {
    return createHash("sha256").update("").digest("hex");
  }
  return createHash("sha256").update(joined).digest("hex");
}
