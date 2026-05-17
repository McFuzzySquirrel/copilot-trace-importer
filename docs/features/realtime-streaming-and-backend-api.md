# Feature: Real-time Streaming & Backend API

## Traceability

| Feature ID | Original PRD ID | Description |
|-----------|----------------|-------------|
| STREAM-US-01 | US-03 | Stream datastore updates to Azure Fabric in real-time |
| STREAM-US-02 | US-04 | Query the datastore via a REST API |
| STREAM-FR-01 | FR-30 | Backend API: REST endpoints for filtered queries |
| STREAM-FR-02 | FR-31 | Watch datastore file for new events; detect within 5–10 s |
| STREAM-FR-03 | FR-32 | Stream new events to backend API (HTTP POST or WebSocket) |
| STREAM-FR-04 | FR-33 | Backend batches streamed events before persistence |
| STREAM-FR-05 | FR-34 | Backfill: re-import historical events in bulk if connection drops |

**Product Vision:** [docs/product-vision.md](../product-vision.md)
**Original PRD:** [docs/PRD.md](../PRD.md)

---

## 1. Feature Overview

**Feature Name:** Real-time Streaming & Backend API
**ID Prefix:** STREAM
**Summary:** A file-system watcher tails the JSONL datastore and streams new
envelopes to a backend REST/WebSocket API. The backend exposes filtered
query endpoints (sessions, events, summary, tokens, tools) that WEBUI and
ALERT consume. Backfill handles dropped connections so the stream is
eventually consistent.
**Dependencies:** STORE
**Priority:** Should

---

## 2. User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|-------------|-----------|----------|
| STREAM-US-01 | Ops Engineer | stream datastore updates to Azure Fabric in real-time | my dashboards stay fresh and I can alert on anomalies | Should |
| STREAM-US-02 | Data Analyst | query the datastore via a REST API | I can build custom dashboards and reports | Should |

---

## 3. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| STREAM-FR-01 | Backend API: REST endpoints for filtered queries (date range, machine, session, facet) | Should |
| STREAM-FR-02 | Watch the datastore file for new events; detect changes within 5–10 seconds | Should |
| STREAM-FR-03 | Stream new events to the backend API (HTTP POST or WebSocket) | Should |
| STREAM-FR-04 | Backend batches streamed events before persistence to reduce database writes | Should |
| STREAM-FR-05 | Support backfill: re-import historical events in bulk if the connection drops | Should |

---

## 4. UI / Interaction Design

CLI:
```
copilot-trace-importer watch --datastore <path> --endpoint <url>
```

REST endpoints (see PRD §7.3):
- `GET /api/v1/sessions`
- `GET /api/v1/sessions/:id/events`
- `GET /api/v1/summary`
- `GET /api/v1/tokens/usage`
- `GET /api/v1/tools/frequency`
- `WebSocket /api/v1/alerts/subscribe`

---

## 5. Implementation Tasks

### Phase 3: v0.5
- [ ] File-watcher with debounced batching
- [ ] Backend scaffolding (Express or Fastify)
- [ ] REST endpoints listed above
- [ ] WebSocket subscription
- [ ] Backfill on reconnect
- [ ] Local Docker Compose for dev environment

---

## 6. Testing Strategy

| Level | Scope | Approach |
|-------|-------|----------|
| Unit Tests | Watcher debouncing; backfill state machine | Vitest |
| Integration Tests | Importer → watcher → backend → query | Vitest + ephemeral backend |
| E2E | import → watch → stream → REST query reflects new events | Scripted test |
| Performance | End-to-end latency ≤10 s (new event → dashboard) | Benchmark |

Key test scenarios:
1. Watcher detects appended lines within 10 s
2. Network drop + reconnect triggers backfill of missed events
3. REST endpoints return correct filtered results
4. WebSocket subscribers receive new events in order

---

## 7. Acceptance Criteria

1. File watcher detects datastore changes within 10 seconds (PRD v0.5 criterion)
2. Backend REST API operational on `localhost:3000`
3. Events stream to backend and persist
4. E2E test passes (import → watch → stream → query)

---

## 8. Open Questions

| # | Question | Default Assumption |
|---|----------|--------------------|
| 1 | Is real-time (≤10 s) a hard requirement or nice-to-have? | Nice-to-have initially; relax to 30–60 s if architecture gets complex |
| 2 | REST first, GraphQL later? | Yes — REST in v0.5, GraphQL targeted for v0.8 |
