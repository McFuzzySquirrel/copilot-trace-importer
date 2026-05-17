# Feature: CLI Summary & Reporting

## Traceability

| Feature ID | Original PRD ID | Description |
|-----------|----------------|-------------|
| SUMM-US-01 | US-06 | End-user sees own token usage and model invocation summary |
| SUMM-FR-01 | FR-24 | Aggregate datastore (event/session/machine counts) |
| SUMM-FR-02 | FR-25 | Report date range |
| SUMM-FR-03 | FR-26 | List unique sessions, machines, sources |
| SUMM-FR-04 | FR-27 | Count events by type and source |
| SUMM-FR-05 | FR-28 | `--verbose`: VS Code path-pattern breakdown |
| SUMM-FR-06 | FR-29 | `--verbose`: top source paths by event volume |

**Product Vision:** [docs/product-vision.md](../product-vision.md)
**Original PRD:** [docs/PRD.md](../PRD.md)

---

## 1. Feature Overview

**Feature Name:** CLI Summary & Reporting
**ID Prefix:** SUMM
**Summary:** The `summary` CLI command. Aggregates the JSONL datastore into
counts, ranges, and verbose breakdowns. Optional `report` Markdown command
(Phase 7) is the *only* reporting surface we ship — anything richer is the
job of codeburn or the codeburn-style analyzer pack (ANALYZE).
**Dependencies:** STORE
**Priority:** Must

---

## 2. User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|-------------|-----------|----------|
| SUMM-US-01 | End-User/Developer | see my own token usage and model invocation summary | I can optimize my Copilot usage | Could |

---

## 3. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SUMM-FR-01 | Aggregate datastore: event count, session count, machine count | Must |
| SUMM-FR-02 | Report date range (earliest and latest timestamp) | Must |
| SUMM-FR-03 | List unique sessions, machines, and event sources | Must |
| SUMM-FR-04 | Count events by type and source | Must |
| SUMM-FR-05 | `--verbose`: VS Code path-pattern breakdown (`logs/` vs `workspaceStorage/`) | Should |
| SUMM-FR-06 | `--verbose`: top source paths by event volume | Should |

---

## 4. UI / Interaction Design

```
copilot-trace-importer summary --datastore <path> [--verbose]
```

Default output: JSON aggregate with counts, date range, top breakdowns.
`--verbose` adds path-pattern breakdown and top-source-paths table.

---

## 5. Implementation Tasks

### Phase 1: Current (Done)
- [x] `summary` command with counts, date range, sessions, machines
- [x] `--verbose` path breakdown + top paths

### Phase 7: Markdown report
- [ ] `report` Markdown command (single-page snapshot)

---

## 6. Testing Strategy

| Level | Scope | Approach |
|-------|-------|----------|
| Unit Tests | Aggregator | Vitest with fixture JSONL |
| Integration Tests | End-to-end import → summary | Vitest |

Key test scenarios:
1. Summary returns 0 for empty datastore
2. Verbose breakdown matches known fixture distribution
3. Date range reflects earliest/latest timestamps across all sources

---

## 7. Acceptance Criteria

1. `summary` returns correct counts on a fixture with known distribution
2. `--verbose` adds the documented breakdowns
3. Summary on 1M events completes in ≤5 s on reference hardware (NF-03)

---

## 8. Open Questions

| # | Question | Default Assumption |
|---|----------|--------------------|
| 1 | Should `summary` learn `--format markdown`? | Yes, alongside the Phase 7 `report` command |
