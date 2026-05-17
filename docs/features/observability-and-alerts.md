# Feature: Observability & Alerts

## Traceability

| Feature ID | Original PRD ID | Description |
|-----------|----------------|-------------|
| ALERT-US-01 | US-08 | Threshold-based alerts to Teams |
| ALERT-Phase6 | PRD §14 Phase 6 | Configurable thresholds, Teams/Slack, audit logs |

**Product Vision:** [docs/product-vision.md](../product-vision.md)
**Original PRD:** [docs/PRD.md](../PRD.md)

---

## 1. Feature Overview

**Feature Name:** Observability & Alerts
**ID Prefix:** ALERT
**Summary:** Threshold rules over the streaming event flow, with delivery
to Teams / Slack, alert history, and configuration UI. Audit logs for team
deployments live here too.
**Dependencies:** STREAM
**Priority:** Should

---

## 2. User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|-------------|-----------|----------|
| ALERT-US-01 | Data Analyst | set threshold-based alerts and send to Teams | I can get notified when anomalies occur (e.g., token spike on critical repo) | Could |
| ALERT-US-02 | Ops Engineer | review the audit log of imports for a team deployment | I can respond to compliance questions quickly | Should |

---

## 3. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| ALERT-FR-01 | Configurable threshold rules (e.g., token spike > 50% of rolling average, error rate > X%) | Should |
| ALERT-FR-02 | Teams / Slack notification integration with templated messages | Should |
| ALERT-FR-03 | Alert history with rule, threshold, trigger event, notification status | Should |
| ALERT-FR-04 | Alert configuration UI (lives inside WEBUI) | Should |
| ALERT-FR-05 | Audit log for team deployments (what was imported, when, by whom, with which policy) | Should |

---

## 4. UI / Interaction Design

Rule shape (config / UI):
```yaml
- name: "Token spike on critical repo"
  metric: tokens.total
  scope: { repo: "org/critical" }
  window: 1h
  threshold: { type: relative, value: 1.5, of: rolling_avg }
  notify: [teams://channel-id, slack://#alerts]
```

---

## 5. Implementation Tasks

### Phase 6: v0.9
- [ ] Rule engine (windowed aggregations + threshold evaluation)
- [ ] Teams webhook integration
- [ ] Slack webhook integration
- [ ] Alert history persistence
- [ ] Configuration UI in WEBUI
- [ ] Audit-log writer (importer side) + viewer (WEBUI side)

---

## 6. Testing Strategy

| Level | Scope | Approach |
|-------|-------|----------|
| Unit Tests | Rule evaluator; window math | Vitest |
| Integration Tests | Rule fires → notification delivered (mocked webhook) | Vitest |
| E2E | End-to-end: import → spike → alert in test Teams/Slack channel | Manual / scripted |

Key test scenarios:
1. Threshold breach fires exactly one notification per rule per window
2. Notification template renders correct trigger context
3. Webhook 5xx triggers documented retry with backoff
4. Audit log is append-only and includes the active redaction-policy hash

---

## 7. Acceptance Criteria

1. Threshold rules can be defined in YAML or via UI
2. Teams and Slack deliveries succeed in integration tests
3. Alert history reflects every trigger
4. Audit log entries are immutable and policy-hash-tagged

---

## 8. Open Questions

| # | Question | Default Assumption |
|---|----------|--------------------|
| 1 | Do we support PagerDuty / OpsGenie? | Could-have; Teams + Slack first |
| 2 | Are rules scoped to a single deployment, or shareable? | Per-deployment initially; sharing via PLUGIN marketplace later |
