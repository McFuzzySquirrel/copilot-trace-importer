# Feature: Enrichment Pipeline

## Traceability

| Feature ID | Original PRD ID | Description |
|-----------|----------------|-------------|
| ENRICH-FR-01 | FR-40 | Implement Enrichment Pipeline (ADR-004) producing codeburn-compatible normalized fields |

**Product Vision:** [docs/product-vision.md](../product-vision.md)
**Original PRD:** [docs/PRD.md](../PRD.md)
**Related ADRs:** ADR-004 (Enrichment Pipeline)

---

## 1. Feature Overview

**Feature Name:** Enrichment Pipeline
**ID Prefix:** ENRICH
**Summary:** A staged pipeline that runs *between* provider parsing and sink
fan-out. Derives normalized fields once (model family, normalized token
counts with `fallback` provenance, cost-ready facets, tool category) so
every sink and analyzer reads from the same shape. Carries the Phase 3
codeburn-alignment commitment: the enriched envelope is what a
codeburn-style consumer expects, so downstream analyzers do not have to
re-derive it.
**Dependencies:** PROV
**Priority:** Should

---

## 2. User Stories

(Internal architecture feature — no end-user stories of its own; consumers
are SINK, ANALYZE, STREAM, and WEBUI.)

---

## 3. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| ENRICH-FR-01 | Implement the Enrichment Pipeline (ADR-004) so derived fields (model family, normalized token counts, fallback flags, tool category, cost-ready facets) are computed exactly once per envelope and reused by every sink (codeburn alignment, Phase 3) | Should |
| ENRICH-FR-02 | Each enricher MUST be pure (no I/O), composable, and unit-testable in isolation | Should |
| ENRICH-FR-03 | Enrichers MUST attach provenance (which enricher produced which field, with confidence level) | Should |
| ENRICH-FR-04 | Enriched fields MUST be stable across versions (additive); removals require a schema-version bump | Should |

---

## 4. UI / Interaction Design

No direct UI. The enriched envelope shape extends `EventFacets` with a
`derived` sub-object whose keys document which enricher produced them.

---

## 5. Implementation Tasks

### Phase 3: v0.5 (Design accepted; implementation pending)
- [ ] Define `Enricher` interface in `src/enrichment/types.ts`
- [ ] Port the model-inference / token-fallback / tool-category logic out of providers and into named enrichers
- [ ] Wire the pipeline into the orchestrator between provider output and sink input
- [ ] Document the enriched envelope shape and the codeburn-compatibility mapping
- [ ] Performance: enrichment per envelope must stay under the per-event NFR budget

---

## 6. Testing Strategy

| Level | Scope | Approach |
|-------|-------|----------|
| Unit Tests | Each enricher in isolation | Vitest with fixture envelopes |
| Integration Tests | Provider → enrichment → sink | Vitest |
| Regression Tests | Enriched output shape vs. golden file | Vitest snapshot |

Key test scenarios:
1. Model-inference enricher produces `modelFamily=anthropic` for `toolu_*` tool calls
2. Token-fallback enricher attaches `fallback: true` when `outputTokens` was estimated
3. Two enrichers writing to different fields compose cleanly
4. Enrichment is idempotent: running twice produces identical output

---

## 7. Acceptance Criteria

1. The orchestrator's provider → sink path runs every envelope through enrichment
2. Each enricher is independently unit-tested and pure
3. Enriched envelope shape is documented and matches what a codeburn-style consumer expects (FR-40)
4. ADR-004 is marked **Implemented** (was: Design)

---

## 8. Open Questions

| # | Question | Default Assumption |
|---|----------|--------------------|
| 1 | Should enrichment be configurable per-sink (some sinks get richer envelopes)? | No initially — one canonical enriched envelope; sinks can drop fields they don't need |
| 2 | Cost enrichment requires a pricing table — do we ship one or rely on LiteLLM-style data? | Ship a minimal static table; allow override via config; document where codeburn's LiteLLM dataset can be slotted in |
