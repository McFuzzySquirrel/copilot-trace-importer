# ADR-003: Copilot Model Inference, Token Fallback, and Deduplication

**Status:** Accepted

**Date:** 2026-05-17

**Deciders:** McFuzzySquirrel

**Affected Components:** `src/providers/copilot-events-jsonl.ts`,
`src/providers/copilot-shared.ts`,
`docs/providers/copilot-events-jsonl.md`

---

## Context

GitHub Copilot's on-disk event format is incomplete in three specific
ways that every downstream consumer eventually hits:

1. **Model is not always tagged** on each event. Long sessions can have
   `assistant.message` events with no `model` field at all.
2. **`outputTokens` is often missing** from VS Code Chat transcripts;
   the source records only the message body.
3. **The same message can appear twice** — once via the legacy CLI
   session store and once via the VS Code workspaceStorage transcripts
   — when a user upgrades Copilot or has both surfaces enabled.

The maintainers of [codeburn](https://github.com/getagentseal/codeburn)
hit all three and shipped pragmatic fixes that have been load-tested
across a large user base. Their `docs/providers/copilot.md` and
`src/providers/copilot.ts` are the prior art. Rather than relearn
those lessons by ourselves at our users' expense, we adopt them — with
the discipline that every inference is marked `confidence: "heuristic"`
so downstream tooling can discount or filter it.

## Decision

We apply three Copilot-specific enrichments inside
`src/providers/copilot-events-jsonl.ts`, after schema validation and
before redaction:

### 1. Model family inference from tool-call ID prefix

If an event has no explicit `model` but carries one or more tool-call
IDs (top-level `toolCallId` or any `data.toolRequests[].toolCallId`),
we look up the ID prefix in a small table:

| Prefix | Family |
|---|---|
| `toolu_bdrk_` | `anthropic` |
| `toolu_vrtx_` | `anthropic` |
| `tooluse_` | `anthropic` |
| `toolu_` | `anthropic` |
| `call_` | `openai` |

We **never overwrite** an explicit model label. The inferred value is
written to `facets.modelUsage[*].model` with
`confidence: "heuristic"`.

### 2. Char-based output-token fallback

If `outputTokens` is missing for a modelUsage/tokenUsage facet but the
source payload contains a `message`, `content`, or `responseText`
string, we estimate

```
outputTokens ≈ max(1, ceil(text.length / 4))
```

(`CHARS_PER_TOKEN = 4`, the value codeburn uses.) Both `outputTokens`
and `totalTokens` are filled in; both inherit
`confidence: "heuristic"`. We never overwrite an explicit token count.

### 3. Per-import-pass deduplication

Within a single call to `copilotEventsJsonlProvider.import`, we
deduplicate events by:

1. Source `messageId` when present (preferred).
2. Otherwise SHA-256 of `interactionId + firstToolCallId + sourceEventType`.

Events whose dedup key was already emitted are counted toward
`stats.deduplicatedEvents` and dropped. Dedup state is **not**
persisted across runs — the append-only datastore is the system of
record, and cross-run dedup is a separate concern (see Future Work).

## Rationale

### Why "family" not "exact model" for inference?

Tool-call ID prefixes only identify the API surface (Anthropic vs.
OpenAI), not the model name. Pretending we know "this was claude-3.5-sonnet"
when we only know it was Anthropic-routed would be worse than admitting
ignorance. Phase 3 cost enrichment will combine our family hint with
session-level metadata to land on a priced model.

### Why never overwrite explicit values?

Explicit fields are the source of truth. The whole point of marking
inferred values `heuristic` is that downstream tooling can choose to
trust or distrust them; that choice is meaningless if we have already
overwritten the exact data.

### Why per-pass dedup, not global?

- Global dedup needs a persistent dedup index, which is a new
  concurrency surface (one importer writing the datastore at a time,
  one importer per machine, etc.). That is Phase 5 work.
- Per-pass dedup catches the most common case (the same chat appears
  in both legacy and transcript paths during a single import) without
  any of that complexity.
- The append-only datastore preserves history; downstream analyzers
  that need cross-run dedup can dedup at read time using the same
  `messageId`.

### Why mark everything heuristic?

Regulated buyers will reject any inference that masquerades as
ground truth. The `confidence` field already exists in our schema
(`exact | inferred | heuristic | unknown`); using it consistently is
the only way to deliver a compliance-friendly product.

## Consequences

### Positive

- ✅ We avoid the "no model on half the events" problem on day one.
- ✅ VS Code transcripts gain usable token counts for sessions that
  would otherwise look like cost-free zero-token chats.
- ✅ Same-chat duplicates from concurrent Copilot surfaces collapse to
  one envelope per import pass.
- ✅ Every inference is auditable via `confidence` and traceable to
  this ADR + the per-provider quirks doc.

### Negative

- ❌ The char-based fallback is a crude estimate. Models with very
  different tokenizers can deviate by ±50% on edge cases.
- ❌ Adding a new tool-call prefix in the wild requires a code change
  plus a new release. (Mitigation: make the table easy to extend; add
  a regression test per prefix.)
- ❌ Per-pass dedup means an event that appears in two separate runs
  is recorded twice. Cross-run dedup is a deliberate Phase 5+ concern.

### Mitigation

- The table of prefixes lives in `copilot-shared.ts` and is covered
  by a dedicated test in `test/providers/copilot-events-jsonl.test.ts`.
- Every heuristic enrichment is wrapped so that a future
  configuration flag (`--no-copilot-heuristics`) can disable it
  without code surgery if a regulated environment forbids inference.

## Future Work

- Cross-run dedup using the persisted datastore (Phase 5 alongside
  `prune` and retention enforcement).
- Pluggable inference rules per provider (when Claude Code / Cursor /
  Codex providers land in Phase 2, similar small tables will live in
  their own provider files — not in a shared "inference engine").
- A `--no-copilot-heuristics` flag for environments that forbid any
  derived field.

## References

- codeburn `src/providers/copilot.ts` lines 118 (legacy dedup), 245
  (transcript dedup), 176–213 (model inference), 252–254 (char-based
  token fallback)
- codeburn `docs/providers/copilot.md`
- ADR-002 (Provider isolation pattern)
- `src/providers/copilot-shared.ts`
- `docs/providers/copilot-events-jsonl.md`
