# Feature: Codeburn-Style Analyzer Pack

## Traceability

| Feature ID | Original PRD ID | Description |
|-----------|----------------|-------------|
| ANALYZE-FR-01 | FR-44 | Ship a codeburn-style analyzer pack over our JSONL (cost, model mix, tool frequency, top files) across every provider we ingest, with redaction already applied |

**Product Vision:** [docs/product-vision.md](../product-vision.md)
**Original PRD:** [docs/PRD.md](../PRD.md)

---

## 1. Feature Overview

**Feature Name:** Codeburn-Style Analyzer Pack
**ID Prefix:** ANALYZE
**Summary:** A first-party set of analyzers that re-create codeburn's most
useful insights (cost, model mix, tool frequency, top files) running over
our enriched JSONL datastore — making those insights available across
**every** provider we ingest (Copilot, Claude Code, Cursor, Codex, …) and
on data that has **already been redacted** to the org policy. This is the
Phase 6 codeburn-alignment commitment from PRD §14.8.
**Dependencies:** ENRICH, STORE
**Priority:** Should

---

## 2. User Stories

(Inherits stories from Researcher / Data Analyst / End-User personas; the
analyzer pack is the on-platform implementation of those use cases.)

---

## 3. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| ANALYZE-FR-01 | Ship a codeburn-style analyzer pack over our JSONL: cost, model mix, tool frequency, top files — across every provider we ingest, with redaction already applied (codeburn alignment, Phase 6) | Should |
| ANALYZE-FR-02 | Each analyzer MUST be pure and operate on the enriched envelope (no provider-specific code paths) | Should |
| ANALYZE-FR-03 | Analyzers MUST produce machine-readable output (JSON) suitable for downstream tooling and the governance Web UI | Should |
| ANALYZE-FR-04 | Documentation MUST cite the codeburn equivalent for each analyzer and note divergences | Should |

---

## 4. UI / Interaction Design

```
copilot-trace-importer analyze <name> --datastore <path> [--since ...] [--until ...] [--format json|markdown]

Built-in analyzers:
  cost            Estimated cost by model / day / repo
  model-mix       Distribution of model invocations
  tool-frequency  Tool invocation frequency by category
  top-files       Most-edited files by token volume
```

Analyzers are also exposed as a programmatic API (`runAnalyzer(name, opts)`)
for embedding in the Web UI and external tools.

---

## 5. Implementation Tasks

### Phase 6: v0.9
- [ ] Define `Analyzer` interface in `src/analyzers/types.ts`
- [ ] Implement `cost` analyzer (uses ENRICH cost-ready facets)
- [ ] Implement `model-mix` analyzer
- [ ] Implement `tool-frequency` analyzer
- [ ] Implement `top-files` analyzer
- [ ] CLI: `analyze <name>` subcommand
- [ ] Programmatic API
- [ ] Documentation cross-referencing the codeburn equivalent for each (ANALYZE-FR-04)

---

## 6. Testing Strategy

| Level | Scope | Approach |
|-------|-------|----------|
| Unit Tests | Each analyzer against fixture enriched envelopes | Vitest |
| Cross-provider | Same analyzer over Copilot + Claude + Cursor fixtures produces consistent shape | Vitest |
| Snapshot | Analyzer output stability | Vitest snapshot |

Key test scenarios:
1. `cost` analyzer matches a known-cost fixture within tolerance
2. `model-mix` distribution sums to 100% (or matches event total)
3. Analyzer runs over any provider's data without provider-specific branches
4. Redaction is preserved in analyzer output (no leaks)

---

## 7. Acceptance Criteria

1. All four named analyzers ship with tests and documentation
2. Each analyzer's docs cite the codeburn equivalent and note divergences
3. Analyzer output works in both CLI (`analyze`) and Web UI (governance dashboards)
4. PRD §14.8 row for Phase 6 (FR-44) is marked Done

---

## 8. Open Questions

| # | Question | Default Assumption |
|---|----------|--------------------|
| 1 | Do we ship a pricing table for `cost`, or require config? | Ship a minimal default; allow override; document where codeburn's LiteLLM-derived prices can slot in |
| 2 | Where do analyzers live — CLI, library, or web UI? | All three: implemented once in `src/analyzers/`, exposed everywhere |
