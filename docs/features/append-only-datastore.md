# Feature: Append-only Datastore

## Traceability

| Feature ID | Original PRD ID | Description |
|-----------|----------------|-------------|
| STORE-FR-01 | FR-06 | Detect and skip duplicate events (idempotent import) |
| STORE-FR-02 | FR-20 | Append-only JSONL format; one event per line |
| STORE-FR-03 | FR-21 | Include envelope, facets, and metadata in each record |
| STORE-FR-04 | FR-22 | Support multiple datastore files (per date/session/machine); configurable |
| STORE-FR-05 | FR-23 | Datastore queryable without external tools (grep, jq, standard SQL) |

**Product Vision:** [docs/product-vision.md](../product-vision.md)
**Original PRD:** [docs/PRD.md](../PRD.md)
**Related ADRs:** ADR-001 (Append-only JSONL)

---

## 1. Feature Overview

**Feature Name:** Append-only Datastore
**ID Prefix:** STORE
**Summary:** Owns the canonical on-disk format: one envelope per JSONL line,
append-only, immutable history. Provides idempotent import semantics and
file rollover policies. Every consumer (SUMM, STREAM, SINK, ANALYZE) reads
from this format.
**Dependencies:** PROV, REDACT
**Priority:** Must

---

## 2. User Stories

(Inherits implicit stories from PROV and REDACT — no dedicated persona stories.)

---

## 3. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| STORE-FR-01 | Detect and skip duplicate events at write time (idempotent re-import) | Should |
| STORE-FR-02 | Append-only JSONL format; exactly one event per line | Must |
| STORE-FR-03 | Each record includes `envelope`, `facets`, and `metadata` (source, sessionId, machineId, timestamp, schemaVersion) | Must |
| STORE-FR-04 | Support multiple datastore files (one per date / session / machine); configurable via flag and/or config file | Should |
| STORE-FR-05 | Datastore queryable with standard tools (`grep`, `jq`, DuckDB `read_json_auto`) without ancillary software | Should |

---

## 4. UI / Interaction Design

CLI flags:
```
--datastore <path>       Append-only JSONL path (default: ./datastore/events.jsonl)
--rotate <strategy>      none | daily | per-session | per-machine   (Phase 2+)
```

JSONL line shape:
```json
{
  "envelope": { "timestamp": "...", "source": "...", "sessionId": "...", "machineId": "..." },
  "facets":   { "modelUsage": {...}, "toolCalls": [...], "tokens": {...}, "filesTouched": [...] },
  "metadata": { "schemaVersion": "1.0.0", "provider": "copilot-events-jsonl" }
}
```

---

## 5. Implementation Tasks

### Phase 1: Current (Done)
- [x] Append-only writer with newline-delimited JSON
- [x] Atomic line writes; UTF-8; LF line endings
- [x] Idempotent import driven by PROV dedup + on-disk checks

### Phase 2+: Rotation & Multi-file
- [ ] `--rotate` strategies: `daily`, `per-session`, `per-machine`
- [ ] Manifest file listing rotated parts
- [ ] Migration helper for v0.x → v1.x schema bumps (NF-09)

---

## 6. Testing Strategy

| Level | Scope | Approach |
|-------|-------|----------|
| Unit Tests | Writer; rotation strategy selection | Vitest with temp files |
| Integration Tests | End-to-end import + re-import is idempotent | Vitest |

Key test scenarios:
1. Append never rewrites earlier lines
2. Re-import of identical input produces no duplicate lines
3. Each line is valid JSON; `jq -c .` round-trips losslessly
4. Rotation produces files honoring the chosen strategy
5. DuckDB `read_json_auto` can query the datastore directly

---

## 7. Acceptance Criteria

1. Datastore is append-only and human-inspectable
2. Re-running `import` with the same inputs produces no duplicate events
3. Each line round-trips through `jq -c .` losslessly
4. Rotation strategy (when configured) produces predictable file names

---

## 8. Open Questions

| # | Question | Default Assumption |
|---|----------|--------------------|
| 1 | Should rotated parts be auto-compressed (`.jsonl.gz`)? | Off by default; opt-in via `--compress` |
| 2 | Do we need a manifest file, or is glob discovery sufficient? | Start with glob; add manifest only if rotation gets complex |
