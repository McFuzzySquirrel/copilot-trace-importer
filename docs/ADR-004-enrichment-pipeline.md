# ADR-004: Enrichment Pipeline (Design Only — Implementation Deferred)

**Status:** Proposed (design accepted; implementation deferred to Phase 3)

**Date:** 2026-05-17

**Deciders:** McFuzzySquirrel

**Affected Components:** future `src/enrichers/`, integration point in
the provider → orchestrator → sink flow.

---

## Context

Today every provider does its own minimal enrichment inline (e.g.
Copilot model-family inference in `copilot-events-jsonl.ts`). That is
correct for *source-specific* heuristics, but two enrichments are
inherently cross-provider:

1. **Cost** — given `model + inputTokens + outputTokens`, look up a
   price per 1K tokens and emit a `cost` facet. This logic is the
   same for every provider; the inputs differ.
2. **Task classification** — given an event's tools, file paths, and
   user prompt, classify it into one of N task categories
   (`coding`, `debugging`, `feature_dev`, `refactor`, `test`, …).
   The classifier itself is identical across providers.

Codeburn ships both as first-class features, deterministic and
LLM-free. We want the same capability available across our wider
provider surface and as opt-in, auditable steps in our pipeline.

## Decision (design)

Introduce an **enricher pipeline** that runs *after* provider
normalization and *before* redaction is finalized:

```
provider.import() → EventEnvelope[]
        │
        ▼
   enricher pipeline (ordered, opt-in)
        │
        ▼
   redaction (always last before persist)
        │
        ▼
   sink(s)
```

Each enricher implements a small interface:

```typescript
interface Enricher {
  readonly name: string;
  readonly description: string;
  enrich(event: EventEnvelope, ctx: EnrichmentContext): Promise<EventEnvelope>;
}
```

with these properties:

- **Opt-in.** Disabled by default; enabled via config or CLI flags
  (`--enrich cost,classifier`).
- **Pure-ish.** Returns a new envelope; does not mutate the input.
- **Confidence-aware.** Any field an enricher adds carries
  `confidence: "heuristic"` unless it can prove `"exact"`.
- **Cacheable.** Enrichers that hit external data (e.g. LiteLLM
  pricing) MUST cache results locally (24h default, configurable).
- **Failure-tolerant.** An enricher that throws is logged and skipped
  for that event; persistence of the un-enriched envelope still happens.

Two starter enrichers (Phase 3):

- `cost` — LiteLLM-based pricing with 24h disk cache and hardcoded
  fallbacks for major Claude and GPT models.
- `classifier` — deterministic task classifier inspired by codeburn's
  13-category model, derived from tools used + keyword heuristics.

## Rationale

- Redaction must remain the **last** transform before persistence; an
  enricher that adds a derived string (e.g. a categorized prompt
  excerpt) must still pass through the redaction layer.
- Per-provider inline enrichment is correct for source-specific
  heuristics (Copilot tool-call prefix → model family). Cross-provider
  enrichment is correct here.
- Keeping enrichers opt-in keeps the base import deterministic and
  side-effect free, which matters for compliance.

## Consequences

### Positive

- Cost reporting becomes possible across every provider we ingest,
  not just one tool.
- Codeburn-style task categorization runs over our schema, opening
  the door to the analyzer SDK in Phase 6.
- A clear extension point for third parties (e.g. an internal
  business-unit tagger) without touching providers.

### Negative

- One more layer to test and document.
- Cost enrichment requires network access (LiteLLM) the first time;
  must degrade gracefully on offline boxes.

## Status & Scope

This ADR captures the **design** so the provider refactor can
anticipate it. Implementation is **deferred to Phase 3**. Anything
that lands before then should keep enrichment a no-op pass-through to
avoid prematurely tying the orchestrator to a half-baked enricher
contract.

## References

- codeburn task classifier (deterministic, 13 categories)
- codeburn LiteLLM-based pricing with 24h cache and hardcoded fallbacks
- ADR-002 (Provider isolation)
- ADR-003 (Copilot inference; source-specific enrichment, kept inline)
