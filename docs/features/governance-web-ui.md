# Feature: Governance Web UI

## Traceability

| Feature ID | Original PRD ID | Description |
|-----------|----------------|-------------|
| WEBUI-§12.2 | PRD §12.2 | Web UI (Roadmap) — repositioned as governance-focused |

**Product Vision:** [docs/product-vision.md](../product-vision.md)
**Original PRD:** [docs/PRD.md](../PRD.md)

---

## 1. Feature Overview

**Feature Name:** Governance Web UI
**ID Prefix:** WEBUI
**Summary:** A web UI focused on **governance** views — redaction status,
provenance, retention, audit, redaction-policy editing — *not* a developer
cost/usage dashboard. The product vision explicitly defers the
developer-cost-UX surface to [codeburn](https://github.com/getagentseal/codeburn).
The UI surfaces what codeburn cannot: the regulated-org governance layer.
**Dependencies:** STREAM (backend API)
**Priority:** Should

---

## 2. User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|-------------|-----------|----------|
| WEBUI-US-01 | Ops/Data Analyst | view redaction status and audit history for a session | I can prove to auditors that no credentials were persisted | Should |
| WEBUI-US-02 | Data Analyst | drill into a session's provenance (source, machine, user, retention class) | I can answer a GDPR access/deletion request | Should |
| WEBUI-US-03 | Ops Engineer | edit and preview redaction policies before deploying them | I can iterate on policy without risking data exposure | Could |

---

## 3. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| WEBUI-FR-01 | Dashboard with governance KPIs (events ingested, redactions applied, retention-class distribution, audit-log entries) | Should |
| WEBUI-FR-02 | Sessions table with filters (date, machine, session, source, retention class) | Should |
| WEBUI-FR-03 | Drill-down: session → events for that session with redaction provenance visible | Should |
| WEBUI-FR-04 | Redaction-policy editor with diff preview against fixture envelopes | Could |
| WEBUI-FR-05 | Audit-log view (who imported what, when, with which policy hash) | Should |
| WEBUI-FR-06 | Real-time updates via WebSocket subscription | Should |
| WEBUI-FR-07 | Export filtered data as CSV / JSON | Should |
| WEBUI-FR-08 | WCAG 2.1 AA, keyboard navigation, screen-reader support, data tables as chart fallback (see Product Vision §9) | Should |
| WEBUI-FR-09 | UI explicitly directs users to [codeburn](https://github.com/getagentseal/codeburn) for developer-cost/usage dashboards (codeburn alignment, Phase 5 — non-compete) | Must |

---

## 4. UI / Interaction Design

Main pages:
1. **Governance Dashboard** — KPI cards (events, redactions, retention mix, audit entries)
2. **Sessions** — filterable governance table
3. **Session Detail** — event-level provenance + redaction provenance
4. **Redaction Policies** — editor + diff preview
5. **Audit Log** — import history with policy hashes
6. **Settings** — backend URL, auth, codeburn pointer

Interactions: global date-range picker, machine/session dropdowns,
drill-downs, export, WebSocket-driven live refresh.

---

## 5. Implementation Tasks

### Phase 5: v0.8
- [ ] React + TypeScript scaffolding
- [ ] Governance dashboard, sessions, session-detail views
- [ ] Filters and export
- [ ] Audit-log view
- [ ] Redaction-policy editor with preview
- [ ] WebSocket real-time refresh
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] "For dev cost dashboards, use codeburn" footer link (WEBUI-FR-09)

---

## 6. Testing Strategy

| Level | Scope | Approach |
|-------|-------|----------|
| Unit Tests | Components, hooks | Vitest + Testing Library |
| E2E | Critical governance flows | Playwright |
| Accessibility | WCAG 2.1 AA | axe + manual screen-reader pass |

Key test scenarios:
1. Audit-log entries are immutable from the UI
2. Redaction-policy preview shows correct diff
3. WebSocket reconnect after network drop
4. Keyboard-only navigation reaches every interactive element

---

## 7. Acceptance Criteria

1. Governance dashboard renders KPIs from live backend data
2. WebSocket-driven refresh shows new events within 5 s
3. WCAG 2.1 AA pass (axe automated + manual)
4. UI explicitly links to codeburn for the developer-cost-dashboard use case (FR-09)

---

## 8. Open Questions

| # | Question | Default Assumption |
|---|----------|--------------------|
| 1 | Multi-tenancy in v0.8 or v0.9? | Single-user v0.8; multi-tenancy v0.9 |
| 2 | SaaS or self-hosted? | Architecture supports both; ship self-hosted first |
