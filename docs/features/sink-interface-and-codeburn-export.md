# Feature: Sink Interface & Codeburn Export

## Traceability

| Feature ID | Original PRD ID | Description |
|-----------|----------------|-------------|
| SINK-FR-01 | FR-41 | Sink Interface (ADR-005) — one contract for all destinations |
| SINK-FR-02 | FR-42 | First-party `codeburn-export` sink |

**Product Vision:** [docs/product-vision.md](../product-vision.md)
**Original PRD:** [docs/PRD.md](../PRD.md)
**Related ADRs:** ADR-005 (Sink Interface)

---

## 1. Feature Overview

**Feature Name:** Sink Interface & Codeburn Export
**ID Prefix:** SINK
**Summary:** Generalizes "write to JSONL" into a `Sink` contract that also
covers OTLP, Parquet, warehouse, cloud, and — critically — `codeburn-export`.
This is the canonical "feed codeburn" deliverable (FR-42): one CLI
invocation, redaction already applied, no codeburn-side changes required.
**Dependencies:** ENRICH
**Priority:** Must

---

## 2. User Stories

(Inherits the dashboard/warehouse stories owned by CLOUD and the codeburn
positioning owned at the product vision level.)

---

## 3. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SINK-FR-01 | Implement the Sink Interface (ADR-005) — one contract that JSONL, OTLP, Parquet, warehouse, codeburn-export, and any future sink implement (codeburn alignment, Phase 4) | Must |
| SINK-FR-02 | Ship a first-party `codeburn-export` sink that emits our normalized, enriched, redacted JSONL in a shape codeburn (or a codeburn-compatible consumer) can ingest directly (codeburn alignment, Phase 4) | Should |
| SINK-FR-03 | Sinks MUST be configurable via CLI flags and/or config file; multiple sinks may run in one import pass | Should |
| SINK-FR-04 | Sinks MUST surface per-sink success/failure counts in `DatastoreImportResult` | Should |
| SINK-FR-05 | The `codeburn-export` sink MUST honor the active redaction policy (REDACT) — codeburn never sees raw credentials | Must |

---

## 4. UI / Interaction Design

```
copilot-trace-importer import \
  --sink jsonl:./datastore/events.jsonl \
  --sink codeburn-export:./codeburn-feed/ \
  [--sink otlp:http://collector:4318] \
  [--sink parquet:./out/events.parquet]
```

Per-sink output options live behind a `<scheme>:<target>[?opt=val]` URI so
adding sinks does not require new top-level flags.

---

## 5. Implementation Tasks

### Phase 4: v0.7 (Design accepted; implementation pending)
- [ ] Define `Sink` interface in `src/sinks/types.ts`
- [ ] Refactor existing JSONL writer to implement `Sink`
- [ ] Implement `codeburn-export` sink (FR-42)
- [ ] Wire `--sink <uri>` CLI flag with multi-sink support
- [ ] Per-sink result counters in `DatastoreImportResult`
- [ ] Document the codeburn-export shape and how to point codeburn at it

### Phase 4+: Additional sinks (CLOUD feature)
- [ ] OTLP sink, Parquet sink, warehouse sinks — owned by CLOUD

---

## 6. Testing Strategy

| Level | Scope | Approach |
|-------|-------|----------|
| Unit Tests | Each sink implementation | Vitest with fixture envelopes |
| Integration Tests | Multi-sink fan-out from one import pass | Vitest |
| Contract Tests | Every sink satisfies the `Sink` interface contract | Vitest shared suite |

Key test scenarios:
1. `--sink jsonl:...` produces identical output to the legacy writer (backward compat)
2. Multi-sink: same import writes to JSONL + codeburn-export in one pass
3. `codeburn-export` sink never writes a raw credential when redaction is active
4. Failure in one sink does not stop other sinks; failures are reported in result counters

---

## 7. Acceptance Criteria

1. The legacy JSONL writer is reimplemented as a `Sink` with no behavior change
2. `codeburn-export` sink is documented with a "point codeburn at this" how-to
3. A user can ship to JSONL + codeburn-export in a single import invocation
4. ADR-005 is marked **Implemented**
5. PRD §14.8 row for Phase 4 (FR-41, FR-42) is marked Done

---

## 8. Open Questions

| # | Question | Default Assumption |
|---|----------|--------------------|
| 1 | What exact shape does codeburn expect on disk? | Mirror codeburn's per-provider on-disk format with our enriched fields; document the mapping in the sink's README |
| 2 | Should `codeburn-export` be a separate npm package? | Keep in-tree initially; split out only if it grows codeburn-specific dependencies |
