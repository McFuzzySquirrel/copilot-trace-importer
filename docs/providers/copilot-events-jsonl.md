# Provider: copilot-events-jsonl

GitHub Copilot CLI per-session event streams written to disk as JSONL.

- **Source file:** `src/providers/copilot-events-jsonl.ts`
- **Shared helpers:** `src/providers/copilot-shared.ts`
- **Loading:** read-only file I/O
- **Test:** `test/local-datastore.test.ts`, `test/providers/copilot-events-jsonl.test.ts`

## Where it reads from

`<dirname(dbPath)>/session-state/<session-id>/events.jsonl`

For the default DB path that resolves to
`~/.copilot/session-state/<session-id>/events.jsonl`.

The set of `<session-id>` values is provided by the
[`copilot-session-store`](./copilot-session-store.md) provider; this
provider does not enumerate the directory on its own.

## Storage format

Newline-delimited JSON. Each line is an event object of the shape

```json
{ "type": "...", "timestamp": "...", "data": { ... } }
```

We treat the entire line as an opaque `sourceEvent` payload and let
`buildEventFacets` extract facets. Lines that are not valid JSON are
counted toward `skippedLines` and dropped.

## Model inference (codeburn lesson)

Copilot does not always tag the model on every event. When no explicit
`model` is present, we infer the **model family** from the prefix of
any tool-call ID in the payload (top-level `toolCallId` or any
`toolRequests[].toolCallId`):

| Prefix | Inferred family |
|---|---|
| `toolu_bdrk_`, `toolu_vrtx_`, `tooluse_`, `toolu_` | `anthropic` |
| `call_` | `openai` |

The inferred value is written into `facets.modelUsage[*].model` with
`confidence: "heuristic"`. We **never** overwrite an explicit model
label. Source: codeburn `src/providers/copilot.ts:176-213`.

## Char-based token fallback (codeburn lesson)

When `outputTokens` is missing but the payload contains a `message`,
`content`, or `responseText` string, we estimate

```
outputTokens ≈ ceil(text.length / CHARS_PER_TOKEN)
```

with `CHARS_PER_TOKEN = 4`. The estimated value is written to
`outputTokens` and `totalTokens = (inputTokens ?? 0) + outputTokens`,
both with `confidence: "heuristic"`. Source: codeburn
`src/providers/copilot.ts:252-254`.

## Deduplication (codeburn lesson)

Within a single import pass, we deduplicate by:

1. Source-provided `messageId` if present.
2. Otherwise SHA-256 of `interactionId + firstToolCallId + sourceEventType`.

Events whose dedup key was already emitted are counted toward
`deduplicatedEvents` and dropped. This collapses the same chat being
mirrored across both legacy (`session-state/`) and VS Code transcript
paths after a Copilot upgrade. Source: codeburn
`src/providers/copilot.ts:118,245`.

Dedup state is **per import call**. We do not persist dedup state
across runs; the append-only datastore is the system of record.

## Quirks

- `toolRequests` may be missing or non-array on older sessions; the
  parser guards against that and treats it as "no tool requests".
- A single chat may exist in both legacy and transcript paths if the
  user upgraded Copilot CLI; the `messageId` dedup handles this.

## When fixing a bug here

1. Determine which `type` (`assistant.message`, `tool.execution_complete`,
   etc.) reproduces the bug. Most fixes should land in `buildEventFacets`
   or in the small enrichment in `applyCopilotInferenceLessons`.
2. If a new tool-call ID prefix appears in the wild, add it to
   `TOOL_CALL_PREFIX_TO_MODEL_FAMILY` in `copilot-shared.ts` and add
   a regression test in `test/providers/copilot-events-jsonl.test.ts`.
3. Do not unify this parser with the VS Code Chat debug parser — the
   schemas share little on purpose. See ADR-002.
