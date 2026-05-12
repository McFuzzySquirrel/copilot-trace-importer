# copilot-trace-importer — Product Requirements Document

## 1. Overview

**Product Name:** copilot-trace-importer

**Summary:** A cross-platform tool for importing, normalizing, and analyzing GitHub Copilot session event data from local and IDE sources. It collects telemetry from `~/.copilot/session-store.db`, session event JSONL files, and VS Code debug logs, normalizes events into a redacted append-only datastore, and enables multi-session and multi-machine analytics for token usage optimization, model analysis, and pattern identification.

**Target Platform:** 
- CLI: macOS, Linux, Windows (Node.js 22+)
- Future: Backend API (TBD platform), Web UI (TBD), Cloud deployment (Azure, AWS)

**Key Constraints:**
- Redaction-by-default for sensitive data (configurable by policy)
- Append-only JSONL datastore (immutable history)
- Cross-platform path handling (especially Windows case-insensitivity)
- 70%+ code coverage requirement
- Financial institution compliance needs (GDPR, SOC2, etc.)

---

## 2. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-13 | — | Comprehensive PRD based on v0.1.0, adding vision for real-time streaming, enterprise integration, and web UI |

---

## 3. Goals and Non-Goals

### 3.1 Goals

**Current (v0.1.0):**
- ✅ Import session metadata and events from SQLite, JSONL, and VS Code debug logs
- ✅ Normalize events into a consistent schema with facets (tokens, tools, models, agents, errors)
- ✅ Redact sensitive data (credentials, API keys, tokens) by default
- ✅ Provide CLI commands for import and summary with filtering support
- ✅ Track multi-session and multi-machine provenance
- ✅ Enable append-only, queryable JSONL datastore for downstream analytics

**Roadmap (Future Phases):**
- Real-time or near real-time updating of the datastore (streaming)
- Stream relevant selectable data to enterprise data stores (Azure Fabric, Snowflake, BigQuery, etc.)
- Real-time reporting and analytics dashboards
- Web UI for exploring sessions, models, token usage, and patterns
- Cloud sync support for organization-owned datastores
- Configurable redaction policies (strict, moderate, permissive)
- Research plugins for custom analysis workflows
- Teams/Slack notifications for threshold-based alerts (repo-specific)

### 3.2 Non-Goals

- ✗ Real-time hook into live Copilot sessions (import from stored data only)
- ✗ Modifying or deleting Copilot session data
- ✗ Replacing Copilot's own telemetry system
- ✗ On-premises Copilot deployment support (CLI focuses on local/cloud use)
- ✗ Machine learning or predictive modeling (analytics-focused, not ML training)
- ✗ End-user telemetry or privacy intrusion beyond redacted event analysis
- ✗ Support for Copilot versions < current LTS

---

## 4. User Stories / Personas

### 4.1 Personas

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| **Alex (Copilot Dev/PM)** | Works on Copilot platform; needs to understand usage patterns and model performance across user base | Visibility into token usage, model selection patterns, tool invocation frequency; ability to drill down by session, date range, repository |
| **Jamie (Ops/Data Analyst)** | Manages telemetry pipeline for organization; owns the analytics infrastructure | Bulk import capability, schema stability, configurable redaction, integration with Azure/data warehouse, real-time streaming support |
| **Pat (Researcher)** | Studies AI effectiveness and code generation quality; publishes findings | Anonymized, redacted event data; access to patterns and facets; ability to export/share anonymized datasets; plugin extensibility |
| **Sam (End-User/Developer)** | Individual developer on team; curious about own productivity and token usage | Local CLI to see own session stats; privacy-first approach; opt-in data sharing with team |

### 4.2 User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|-------------|-----------|----------|
| US-01 | Copilot Developer | import session events from my local store and VS Code logs | I can analyze Copilot behavior without external dependencies | Must |
| US-02 | Data Analyst | configure redaction policies before import | I can balance privacy with utility depending on data governance rules | Should |
| US-03 | Ops Engineer | stream datastore updates to Azure Fabric in real-time | my dashboards stay fresh and I can alert on anomalies | Should |
| US-04 | Data Analyst | query the datastore via a REST API | I can build custom dashboards and reports | Should |
| US-05 | Researcher | export anonymized session data with configurable facets | I can publish findings without exposing user details | Could |
| US-06 | End-User | see my own token usage and model invocation summary | I can optimize my Copilot usage | Could |
| US-07 | Ops Engineer | install plugins for custom event analysis | I can extend the system for domain-specific needs | Could |
| US-08 | Data Analyst | set threshold-based alerts and send to Teams | I can get notified when anomalies occur (e.g., token spike on critical repo) | Could |

---

## 5. Research Findings

### Technology Stack Decisions

**Current Stack (v0.1.0):**
- **Runtime**: Node.js 22+ (LTS, actively maintained)
- **Language**: TypeScript 5.9.2 (stable, modern features)
- **Schema Validation**: Zod 4.1.5 (runtime type checking, compose well)
- **Testing**: Vitest 4.1.6 (fast, TypeScript-native)
- **Coverage**: @vitest/coverage-v8 (built-in, no external service)

**Why These:**
- Node.js is standard for CLI tooling; v22 ensures long-term support
- TypeScript catches bugs early; 70%+ coverage target aligns with strict typing
- Zod provides compile-time and runtime schema validation without codegen
- Vitest is faster than Jest, test-framework-agnostic, and integrates seamlessly with TypeScript

**Future Stack Considerations:**
- **Backend API**: Node.js/Express or Fastify (REST API), tRPC or GraphQL (data queries)
- **Database**: Azure SQL, Cosmos DB, or Postgres + time-series extensions (depends on scale and real-time needs)
- **Streaming**: Node.js streams API (built-in), Apache Kafka or Azure Event Hubs (if high-throughput multi-tenant)
- **Frontend**: React + TypeScript (web UI), with D3/Plotly for analytics visualizations
- **Infrastructure**: Docker + Kubernetes (orchestration), Azure Container Instances or ECS (serverless)

### Competitive / Reference Analysis

| Reference | Relevance | Key Insight |
|-----------|-----------|-------------|
| Datadog Agent (CLI→SaaS) | CLI exports metrics to cloud | Model for local collection + cloud sync |
| OpenTelemetry | Schema design, facets, baggage | Inspired facet design; compatible export format (OTLP) |
| Jupyter + Pandas | Data analysis UI/API | Reference for notebook-style analytics |
| GitHub Actions Artifacts API | Event querying | REST API patterns for telemetry access |

### Design Principles

1. **Privacy-first**: Redaction by default; opt-in for raw payloads; configurable per policy
2. **Append-only**: Historical immutability; traceable lineage (source, session, machine)
3. **Composable facets**: Events carry rich metadata (tokens, tools, models, agents) for multi-dimensional analysis
4. **Offline-capable**: CLI works without network; optional sync to cloud
5. **Standards-aligned**: Schema compatible with OpenTelemetry concepts (events, attributes, span semantics)

---

## 6. Concept

### 6.1 Core Loop / Workflow

```
┌─────────────────────────────────────────────────────────┐
│ User runs: npm run datastore:import                     │
│  or: copilot-trace-importer import --db-path ~/.copilot │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
    SQLite DB    JSONL Files    VS Code Debug Logs
 (~/.copilot/)  (session-state) (/logs, /workspaceStorage)
        │              │              │
        └──────────────┼──────────────┘
                       │
        ┌──────────────▼──────────────┐
        │ Schema Validation (Zod)     │
        │ - Parse event type          │
        │ - Extract facets            │
        │ - Normalize timestamps      │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼──────────────┐
        │ Redaction (by policy)       │
        │ - Strip credentials         │
        │ - Anonymize PII (optional)  │
        │ - Keep facets               │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼──────────────────────────┐
        │ Append to JSONL Datastore               │
        │ ./datastore/events.jsonl                │
        │ {                                       │
        │   "envelope": {...},                    │
        │   "facets": {                           │
        │     "modelUsage": {...},                │
        │     "toolCalls": [...],                 │
        │     "tokens": {...},                    │
        │     "filesTouched": [...]               │
        │   },                                    │
        │   "metadata": {                         │
        │     "source": "vscode|copilot-cli",    │
        │     "sessionId": "...",                 │
        │     "machineId": "...",                 │
        │     "timestamp": "..."                  │
        │   }                                     │
        │ }                                       │
        └──────────────┬──────────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │ User runs: npm run summary  │
        │ or: copilot-trace-importer  │
        │     summary --datastore ... │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼──────────────────────┐
        │ Aggregate & Report                  │
        │ - Session count, date range         │
        │ - Token totals, model distribution  │
        │ - Tool usage frequency              │
        │ - Top source paths (optional)       │
        │ - Machines & sources involved       │
        └─────────────────────────────────────┘
```

**Future Real-Time Flow (Roadmap):**
```
┌──────────────────────────────────────────┐
│ Datastore Watcher (near real-time)       │
│ - File system event listener             │
│ - Detects new .jsonl lines               │
└──────────────────┬───────────────────────┘
                   │
      ┌────────────▼────────────┐
      │ Stream to Backend API    │
      │ (buffered, batched)      │
      └────────────┬────────────┘
                   │
      ┌────────────▼──────────────────┐
      │ Backend persists to DB        │
      │ (Cosmos, SQL, Fabric)         │
      │ - Indexes for queries         │
      │ - Aggregations/rollups        │
      └────────────┬──────────────────┘
                   │
      ┌────────────▼──────────────────┐
      │ WebSocket/REST API serves UI  │
      │ - Charts, tables, filters     │
      │ - Threshold alerts → Teams    │
      └───────────────────────────────┘
```

### 6.2 Success / Completion Criteria

**v0.1.0 (Current):**
- ✅ All sources (SQLite, JSONL, VS Code logs) imported without manual intervention
- ✅ Events normalized to consistent schema; all facets populated where available
- ✅ Sensitive data redacted; user can inspect redacted vs. raw payload
- ✅ CLI commands (`import`, `summary`) work cross-platform (macOS, Linux, Windows)
- ✅ 70%+ code coverage; no critical errors
- ✅ Append-only JSONL output usable by downstream analytics

**v0.5.0 (Roadmap: Real-Time Streaming)**
- Datastore changes detected and streamed to backend API within 5–10 seconds
- Backend API operational (REST + optional GraphQL)
- Azure integration configured (Cosmos, SQL, or Fabric)
- Web UI showing live dashboard (basic charts, table view)

**v1.0.0 (Stable):**
- All sources tested at scale (TB+ datastores)
- Redaction policies fully configurable per organization
- Research plugin system operational
- Teams/Slack alerts working
- Full GDPR/SOC2 compliance documentation
- Performance SLAs documented (import speed, query latency)

---

## 7. Technical Architecture

### 7.1 Technology Stack

| Component | Technology | Version | Notes |
|-----------|-----------|---------|-------|
| **Runtime** | Node.js | 22+ | LTS, stable |
| **Language** | TypeScript | 5.9.2 | Strict mode |
| **CLI / Core** | tsx + TypeScript | 5.9.2 | ESM-first, type-safe |
| **Schema Validation** | Zod | 4.1.5 | Runtime + compile-time checks |
| **Testing** | Vitest | 4.1.6 | Fast, TypeScript-native |
| **Coverage** | @vitest/coverage-v8 | 4.1.4 | Integrated, no external service |
| **Linting/Format** | TypeScript compiler | 5.9.2 | `tsc --noEmit` |
| *(Future)* **Backend API** | Express / Fastify | TBD | REST + real-time endpoints |
| *(Future)* **Database** | Azure SQL / Cosmos | TBD | Depends on scale and latency needs |
| *(Future)* **Frontend** | React + TypeScript | TBD | D3/Plotly for charts |
| *(Future)* **Streaming** | Node.js Streams / Kafka | TBD | Real-time ingestion |

### 7.2 Project Structure

**Current (v0.1.0):**
```
copilot-trace-importer/
├── bin/
│   └── ingest.ts              # CLI entry point; arg parsing
├── src/
│   ├── index.ts               # Core import/summary logic
│   ├── redaction/
│   │   ├── index.ts           # Redaction engine
│   │   ├── patterns.ts        # Regex patterns for sensitive data
│   │   ├── retention.ts       # Data retention policies
│   │   └── export-config.ts   # Policy configuration export
│   └── schema/
│       ├── index.ts           # Schema validation + facet building
│       └── schema.ts          # Zod type definitions (EVENT_TYPES, facets, etc.)
├── test/
│   └── local-datastore.test.ts # Integration tests (SQLite import, summary)
├── coverage/                   # v8 coverage reports
├── .github/
│   ├── workflows/
│   │   └── ci.yml            # GitHub Actions CI (multiplatform test)
│   └── skills/               # Future: agent customization
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── PRD.md                     # This document

**Future (v0.5+):**
```
copilot-trace-importer/
├── packages/
│   ├── cli/                   # npm package: CLI tool
│   ├── core/                  # npm package: Core library (import, redaction, schema)
│   ├── backend/               # REST API server
│   │   ├── routes/
│   │   ├── db/
│   │   └── services/
│   └── web/                   # React web UI
│       ├── pages/
│       ├── components/
│       └── hooks/
├── docker-compose.yml         # Local dev: backend + DB
└── ...
```

### 7.3 Key APIs / Interfaces

**CLI Interface (Current):**

| Command | Signature | Purpose |
|---------|-----------|---------|
| `import` | `copilot-trace-importer import --db-path ... --datastore ... [--ids ...]` | Import events from sources; append to JSONL |
| `summary` | `copilot-trace-importer summary --datastore ... [--verbose]` | Aggregate and report on datastore contents |

**Programmatic API (Current, exported from `src/index.ts`):**

| Function | Signature | Purpose |
|----------|-----------|---------|
| `importCopilotSessionStore(options)` | `(opts: CopilotSessionStoreImportOptions) ⇒ Promise<DatastoreImportResult>` | Core import logic; returns counts, sessions, machines |
| `summarizeDatastore(path, options)` | `(path: string, opts?: DatastoreSummaryOptions) ⇒ Promise<DatastoreSummary>` | Aggregate datastore; return counts, facets, date range |

**Data Structures (Current):**

```typescript
// Event envelope (metadata)
interface EventEnvelope {
  timestamp: string;       // ISO 8601
  source: EventSource;     // "copilot-cli", "vscode", etc.
  sessionId: string;
  machineId: string;
  userId?: string;
  interactionId?: string;  // Ties related events (turn in chat)
}

// Event facets (rich metadata)
interface EventFacets {
  modelUsage?: { model: string; inputTokens?: number; outputTokens?: number; ... };
  toolCalls?: Array<{ toolName: string; category: "shell_command" | "editor_action" | ...; status: "success" | "failure" | ... }>;
  tokens?: { inputTokens: number; outputTokens: number; totalTokens: number; ... };
  filesTouched?: Array<{ path: string; action: "read" | "write" | ...; ... }>;
  agentActivity?: { agentName: string; action: "started" | "stopped" | ...; ... };
  debugEvent?: { kind: string; message?: string; ... };
  // ...
}

// Redaction policy
interface RedactionPolicy {
  credentialPatterns: string[];  // Regex patterns to redact
  anonymizeUserInfo: boolean;
  anonymizePaths: boolean;
  retentionDays: number;
}
```

**Backend API (Roadmap, REST):**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/sessions` | GET | List sessions; filter by date, machine, user |
| `/api/v1/sessions/:id/events` | GET | Stream events for a session |
| `/api/v1/summary` | GET | Aggregate stats; optional facet filters |
| `/api/v1/tokens/usage` | GET | Token usage by model, session, date range |
| `/api/v1/tools/frequency` | GET | Tool invocation frequency |
| `/api/v1/alerts/subscribe` | WebSocket | Real-time alerts (threshold breaches) |

---

## 8. Functional Requirements

### 8.1 Data Import

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Import session metadata and events from `~/.copilot/session-store.db` (SQLite) | Must |
| FR-02 | Import session events from JSONL files in `~/.copilot/session-state/<session-id>/events.jsonl` | Must |
| FR-03 | Import VS Code GitHub Copilot Chat debug logs from `logs/` and `User/workspaceStorage/**/GitHub.copilot-chat/**/` | Must |
| FR-04 | Filter imported sessions by ID (comma-separated list via `--ids` flag) | Must |
| FR-05 | Support multi-machine ingestion; tag events with `--machine-id` and optional `--user-id` | Must |
| FR-06 | Detect and skip duplicate events (idempotent import) | Should |
| FR-07 | Batch import for bulk datastores (100K+ events) with progress reporting | Should |
| FR-08 | Support streaming import to backend API (real-time push) | Should |

### 8.2 Schema & Normalization

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-09 | Normalize all source events to consistent `EventEnvelope` + `EventFacets` schema | Must |
| FR-10 | Validate events using Zod; skip invalid events with logging | Must |
| FR-11 | Extract facets from event data: models, tokens, tools, files, agents, debug signals | Must |
| FR-12 | Preserve source event type and version for traceability | Must |
| FR-13 | Support schema versioning (current: 1.0.0); allow forward/backward compatibility checks | Should |

### 8.3 Redaction & Privacy

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-14 | Redact sensitive patterns (GitHub tokens, API keys, AWS keys, passwords, URLs with credentials) | Must |
| FR-15 | Redaction is applied before persistence; user cannot opt-out at import time | Must |
| FR-16 | Support `--include-raw-payload` flag to store *redacted* raw payloads (opt-in) | Must |
| FR-17 | Configuration for redaction policy (strict/moderate/permissive); apply at import time | Should |
| FR-18 | Support field-level anonymization (paths, email, hostnames) per policy | Should |
| FR-19 | Data retention policy enforcement (ephemeral, session, standard, extended) | Should |

### 8.4 Datastore Output

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-20 | Append-only JSONL format; one event per line | Must |
| FR-21 | Include envelope, facets, and metadata in each record | Must |
| FR-22 | Support multiple datastore files (one per date, session, or machine); configurable | Should |
| FR-23 | Datastore is queryable without external tools (grep, jq, standard SQL) | Should |

### 8.5 Summary & Querying (Current CLI)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-24 | Aggregate datastore: event count, session count, machine count | Must |
| FR-25 | Report date range (earliest and latest timestamp) | Must |
| FR-26 | List unique sessions, machines, and event sources | Must |
| FR-27 | Count events by type and source | Must |
| FR-28 | `--verbose` flag: VS Code path-pattern breakdown (logs/ vs workspaceStorage/) | Should |
| FR-29 | `--verbose` flag: Top source paths by event volume | Should |
| FR-30 | Backend API: REST endpoints for filtered queries (date range, machine, session, facet) | Should |

### 8.6 Real-Time Streaming (Roadmap)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-31 | Watch datastore file for new events; detect changes within 5–10 seconds | Should |
| FR-32 | Stream new events to backend API (HTTP POST or WebSocket) | Should |
| FR-33 | Backend batches streamed events before persistence to reduce database writes | Should |
| FR-34 | Support backfill: re-import historical events in bulk if connection drops | Should |

### 8.7 Cloud Integration (Roadmap)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-35 | Azure Cosmos DB: store events with session/machine/date indexes | Should |
| FR-36 | Azure SQL: configurable table schema for event storage and aggregations | Should |
| FR-37 | Azure Fabric: export aggregated metrics for BI dashboards | Could |
| FR-38 | Support for other cloud providers (AWS S3+Athena, GCP BigQuery) | Could |

---

## 9. Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NF-01 | Import performance: ≤30 seconds for 10K events on modern hardware | Should |
| NF-02 | Memory usage: ≤500MB peak during import of 100K events | Should |
| NF-03 | Datastore query latency: ≤5 seconds for summary on 1M events | Should |
| NF-04 | Code coverage: ≥70% across all modules | Must |
| NF-05 | TypeScript strict mode enabled; no implicit `any` | Must |
| NF-06 | Cross-platform support: macOS (Intel + Apple Silicon), Linux (glibc 2.28+), Windows (11+) | Must |
| NF-07 | Node.js version: 22+ (LTS); no older versions supported | Must |
| NF-08 | CLI binary installable globally via npm; works without npm in PATH | Should |
| NF-09 | Backward compatibility: v0.x → v1.x datastore format migration supported | Should |
| NF-10 | Backward compatibility: Library APIs versioned; breaking changes only in major versions | Should |

---

## 10. Security and Privacy

| ID | Requirement | Priority |
|----|-------------|----------|
| SP-01 | No credentials, API keys, or tokens persisted; redaction by default | Must |
| SP-02 | Redaction patterns reviewed and tested quarterly | Should |
| SP-03 | Sensitive patterns (regex) versioned and documented in export-config | Should |
| SP-04 | All file operations respect OS-level file permissions (e.g., `~/.copilot/` read-only) | Must |
| SP-05 | No network calls without explicit user opt-in (e.g., `--include-vscode-chat-debug` requires approval) | Must |
| SP-06 | Datastore file encryption at rest (optional, user-supplied keys) | Could |
| SP-07 | GDPR compliance: right to access, right to delete, data portability | Should |
| SP-08 | SOC2 Type II compliance for cloud deployment | Should |
| SP-09 | Audit log for imports: what was imported, when, by whom (if deployed in team context) | Should |
| SP-10 | Configuration for data retention periods per regulatory requirements | Should |
| SP-11 | Support for data anonymization (hashing, tokenization) at organization policy level | Should |

---

## 11. Accessibility

| ID | Requirement | Priority |
|----|-------------|----------|
| ACC-01 | CLI output machine-readable (JSON, JSONL); optional human-readable tables | Must |
| ACC-02 | CLI help text clear and comprehensive; supports `--help` and `-h` | Must |
| ACC-03 | Error messages actionable; suggest fixes (e.g., "SQLite not found; install with `apt install sqlite3`") | Should |
| ACC-04 | Web UI (roadmap) meets WCAG 2.1 AA standards | Should |
| ACC-05 | Web UI supports keyboard navigation and screen readers | Should |
| ACC-06 | Charts and visualizations include data tables as fallback | Should |

---

## 12. User Interface / Interaction Design

### 12.1 CLI (Current)

**Command Structure:**
```
copilot-trace-importer <command> [options]

Commands:
  import    Import session events from sources
  summary   Summarize datastore contents
```

**Options:**
```
--db-path <path>              Path to ~/.copilot/session-store.db
--datastore <path>            Append-only JSONL datastore path (default: ./datastore/events.jsonl)
--ids <csv>                   Comma-separated session IDs to import
--machine-id <id>             Machine identifier for multi-machine tracking
--user-id <id>                User identifier (optional)
--include-raw-payload         Store redacted raw payloads (opt-in)
--no-redact                   Disable redaction (NOT recommended; for testing only)
--include-vscode-chat-debug   Import VS Code Copilot Chat debug logs
--vscode-chat-debug-path <path>  Specific VS Code debug log path
--no-session-store            Skip ~/.copilot/session-store.db (CLI-only import)
--verbose                     Summary: include path breakdown and top paths
--help                        Show this help text
```

**Output Format:**
- Import: JSON with counts, sessions, machines, duration
- Summary: JSON with aggregates; optional markdown table for human readability
- Errors: Structured JSON errors with error code, message, context

### 12.2 Web UI (Roadmap)

**Main Pages:**
1. **Dashboard**: Overview cards (total events, sessions, avg tokens, top models)
2. **Sessions**: Filterable table (date, machine, duration, token count, status)
3. **Tokens**: Line chart (tokens over time); bar chart (by model)
4. **Tools**: Frequency table; pie chart of tool categories
5. **Alerts**: Configuration and log of threshold breaches

**Interactions:**
- Date range picker (global filter)
- Machine / session dropdown filters
- Drill-down: click session → view events for that session
- Export: button to download filtered data as CSV or JSON
- Real-time updates: WebSocket subscription to new events

---

## 13. System States / Lifecycle

**Event Lifecycle in Datastore:**

```
┌──────────────┐
│ New Event    │
│ (Unvalidated)│
└──────┬───────┘
       │
       ▼
┌─────────────────────────┐
│ Schema Validation (Zod) │
│ ✓ Valid → continue      │
│ ✗ Invalid → skip + log  │
└──────┬────────────────┬─┘
       │                │
   (Valid)         (Invalid, skipped)
       │                │
       ▼                ▼
┌──────────────┐   ┌──────────────┐
│ Redaction    │   │ Metrics only │
│ Apply policy │   │ Count += 1   │
└──────┬───────┘   └──────────────┘
       │
       ▼
┌─────────────────────────┐
│ Append to Datastore     │
│ (JSONL, immutable)      │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Persisted               │
│ (Queryable, archived)   │
└─────────────────────────┘

Real-time Workflow (Roadmap):
Persisted → Watch FS → Stream to Backend → Index/Aggregate → Alert if threshold
```

**Datastore States:**
- **Empty**: No events yet; summary returns 0 events
- **Growing**: New events appended regularly; summary reflects latest state
- **Migrated**: Format upgraded (e.g., v1.0 → v2.0); backward compat layer active
- **Archived**: Retention policy expired; events may be purged or moved to cold storage

---

## 14. Implementation Phases

### Phase 1: Stabilize v0.1.0 (Current)
- [x] Fix Windows path comparison (case-insensitive)
- [x] Ensure SQLite tests run on all platforms
- [ ] Expand unit tests for redaction patterns
- [ ] Document schema stability guarantees
- [ ] Publish npm package

### Phase 2: Core Library & Programmatic API (v0.3)
- [ ] Extract core logic into separate npm package (`@copilot-trace/core`)
- [ ] Finalize library API (import, summary, redaction)
- [ ] Add plugin hook system (custom facet extractors)
- [ ] Write library documentation and examples

### Phase 3: Real-Time Streaming (v0.5)
- [ ] Implement file watcher for datastore changes
- [ ] Build backend API (Node.js/Express REST endpoints)
- [ ] Datastore → Backend streaming (buffered, batched)
- [ ] Basic HTTP API for session and summary queries
- [ ] Deploy to development environment (local Docker)

### Phase 4: Cloud Integration (v0.7)
- [ ] Azure Cosmos DB schema and indexes
- [ ] Azure SQL option with aggregation tables
- [ ] Backend persists events to cloud database
- [ ] Performance testing at scale (1M+ events)

### Phase 5: Web UI (v0.8)
- [ ] React scaffolding + TypeScript setup
- [ ] Dashboard, sessions, tokens views (basic charts)
- [ ] Filters (date, machine, session, facet)
- [ ] Export functionality (CSV, JSON)

### Phase 6: Observability & Alerts (v0.9)
- [ ] Configurable threshold rules (e.g., token spike > 50% avg)
- [ ] Teams/Slack notification integration
- [ ] Alert history and configuration UI
- [ ] Audit logs for team deployments

### Phase 7: Stability & Scale (v1.0)
- [ ] Performance testing at scale (TB datastores)
- [ ] Full GDPR/SOC2 documentation
- [ ] Production deployment guide (Kubernetes, Azure AKS)
- [ ] Redaction policy marketplace (share community policies)
- [ ] Research plugin system operational

---

## 15. Testing Strategy

| Level | Scope | Tools / Approach | Coverage Target |
|-------|-------|-----------------|-----------------|
| **Unit Tests** | Redaction patterns, schema validation, facet extraction | Vitest + Zod runtime checks | ≥80% per module |
| **Integration Tests** | End-to-end import (SQLite → JSONL), summary aggregation | Vitest + temp DB + file fixtures | ≥70% coverage |
| **Cross-Platform** | Windows, macOS, Linux path handling; SQLite availability | GitHub Actions matrix (3 OS) | Must pass all |
| **Performance** | Import 10K events; summary on 1M events | Benchmarks with `performance.now()` | <30s import, <5s summary |
| **Manual QA** | CLI UX, error messages, output formatting | Local testing with diverse input scenarios | Ad hoc, pre-release |
| **Data Validation** | Redaction effectiveness; no leaks of credentials | Regex pattern testing + manual inspection | 100% of patterns tested |

**Test Scenarios (Checklist):**

- [ ] Import from SQLite with valid session data
- [ ] Import from JSONL with mixed valid/invalid events
- [ ] Import from VS Code debug logs (Linux, macOS, Windows paths)
- [ ] Filter by session ID (single and multiple)
- [ ] Multi-machine import with `--machine-id` tags
- [ ] Redaction of GitHub tokens, API keys, passwords
- [ ] Summary aggregation (count, date range, facets)
- [ ] Verbose summary (path breakdown, top paths)
- [ ] Idempotent import (re-import same events; no duplicates)
- [ ] Empty datastore (no events; summary returns 0)
- [ ] Large datastore (100K+ events; performance acceptable)
- [ ] Cross-platform paths (Windows backslash, macOS/Linux forward slash)
- [ ] Permission errors (graceful exit with clear message)
- [ ] SQLite CLI missing (skip tests gracefully)
- [ ] Error recovery (malformed JSON line; continue with next line)

---

## 16. Analytics / Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|------------------|
| **Adoption**: npm package downloads/month | 1K+ (by v1.0) | npm registry stats |
| **Data Quality**: % Events successfully imported | ≥95% (of valid source events) | Import report: `importedEvents / totalLines` |
| **Privacy**: % Credentials redacted | 100% (no leaks) | Regex pattern testing + manual inspection |
| **Performance**: Import speed (10K events) | <30 seconds | Benchmark on reference hardware |
| **Reliability**: Test coverage | ≥70% | Vitest coverage reports |
| **User Satisfaction**: GitHub stars/issues | TBD | GitHub metrics |
| **Enterprise Adoption** (roadmap) | 3+ organizations using cloud deployment | Sales/community feedback |
| **Real-Time Latency** (roadmap, v0.5+) | ≤10 seconds (new event → dashboard) | Backend latency monitoring |

---

## 17. Acceptance Criteria

**v0.1.0 (Current) — Complete when:**
1. All tests pass on macOS, Linux, and Windows CI runners
2. Code coverage ≥70%
3. README with usage examples is clear
4. No unhandled exceptions; error messages guide users to resolution
5. Redaction verified for common credential patterns
6. npm package published and installable

**v0.5.0 (Real-Time Roadmap) — Complete when:**
1. File watcher detects datastore changes within 10 seconds
2. Backend API (REST) operational on localhost:3000
3. Events stream to backend and persist in local database
4. Web UI dashboard displays live data (refresh ≤5 seconds)
5. E2E test: import → watch → stream → query → UI reflects new events

**v1.0.0 (Stable) — Complete when:**
1. All phases complete (Phase 1–7)
2. Performance SLAs met (import, query, stream latency)
3. GDPR/SOC2 documentation complete; no audit findings
4. Production deployment guide tested on Azure AKS
5. Community feedback positive; adoption tracking active

---

## 18. Dependencies and Risks

### 18.1 Dependencies

| Dependency | Type | Version | Risk if Unavailable | Mitigation |
|------------|------|---------|---------------------|------------|
| Node.js | Runtime | 22+ | Cannot run CLI | Require specific version in engines field; document LTS schedule |
| SQLite3 CLI | External tool | Latest | Cannot import from session-store.db | Tests skip gracefully; document installation; provide shell script |
| Zod | npm | ^4.1.5 | Cannot validate schemas | Actively maintained; stable API; minimal breaking changes |
| TypeScript | npm | ^5.9.2 | Cannot compile | Actively maintained; auto-upgradable |
| Vitest | npm | ^4.0.0 | Cannot run tests | Actively maintained; equivalent to Jest |
| Azure SDK (future) | npm | TBD | Cannot stream to cloud | Support multiple backends (SQL Server, Postgres, DuckDB) |
| React (future) | npm | TBD | Cannot build web UI | Alternatives: Vue, Svelte, plain HTML (if needed) |

### 18.2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **SQLite import fails on Windows** | Medium | Cannot import on 20%+ of user machines | Test on windows-latest CI; install sqlite3 in CI; provide fallback |
| **Schema versioning breaks compatibility** | Low | Old datastores become unreadable | Plan migration path; version events; document breaking changes |
| **Redaction patterns miss credentials** | Low | Privacy breach; data leakage | Quarterly pattern review; test against known examples; community audit |
| **Real-time stream latency exceeds SLA** | Medium (v0.5) | Dashboard not useful for alerts | Profile code; optimize batching; consider Kafka if needed |
| **Data scale exceeds expectations** | Medium | Import/query performance degrades | Performance testing early; optimize indexes; plan horizontal scaling |
| **Cloud provider outage** | Low | Team datastores unreachable | Multi-region failover; local fallback (CLI); data replication |
| **Compliance audit failure** | Medium | Cannot be used in regulated orgs | Engage compliance team early; document controls; regular audits |

---

## 19. Future Considerations

| Item | Description | Potential Version |
|------|-------------|-------------------|
| **Offline Mode** | Full-featured CLI without backend; cloud sync optional | v1.0 |
| **Mobile Alerts** | Push notifications to mobile devices (e.g., Copilot usage spike) | v1.2 |
| **Data Marketplace** | Share anonymized datasets with researchers | v1.5 |
| **Custom Facet Plugins** | Plugin API for domain-specific facet extraction | v1.0 |
| **GraphQL API** | Alternative to REST API for complex queries | v0.8 |
| **Comparative Analytics** | Benchmark your team vs. anonymized aggregate data | v1.1 |
| **Cost Attribution** | Allocate token costs to projects/teams; chargeback reports | v1.1 |
| **Copilot-Native Integration** | Direct hook into Copilot for telemetry; no local DB required | v2.0 |
| **Jupyter Notebooks** | Built-in notebook templates for data exploration | v1.0 |
| **Time-Series Forecasting** | Predict token usage trends; alert on anomalies | v1.5 |

---

## 20. Open Questions

| # | Question | Default Assumption |
|---|----------|-------------------|
| 1 | What is the expected scale of datastores (MB, GB, TB)? | ~100MB–1GB per user per year; assume streaming for larger scales |
| 2 | Should redaction policies be user-supplied or pre-built? | Both; start with strict built-in, allow customization in v0.5+ |
| 3 | Will the tool support other cloud providers (AWS, GCP)? | Yes, but Azure prioritized in v0.5–0.7; abstract cloud layer for future expansion |
| 4 | How will the team handle data retention and GDPR right-to-delete? | Append-only + tombstone records; full deletion requires datastore reconstruction |
| 5 | Should research plugins support custom schemas or facets? | Custom facets via plugin hooks; core schema remains stable |
| 6 | Is real-time (≤10s) a hard requirement or a nice-to-have? | Nice-to-have initially; can relax to 30–60s if streaming architecture is complex |
| 7 | Should the web UI support multi-tenancy (team members) in v0.8? | Single-user in v0.5, add multi-tenancy in v0.9 |
| 8 | Will there be a SaaS offering, or self-hosted only? | Undecided; plan architecture to support both |
| 9 | How should the team handle breaking schema changes (e.g., new event types)? | Version events; publish migration guide; support dual-version reads during transition |
| 10 | Should CLI support configuration files (e.g., `~/.copilot-trace-importer/config.json`)? | Yes, in v0.5; allow defaults for common options |

---

## 21. Glossary

| Term | Definition |
|------|------------|
| **Datastore** | Append-only JSONL file containing normalized and redacted Copilot session events |
| **EventEnvelope** | Metadata wrapper around an event (timestamp, source, session ID, machine ID) |
| **EventFacets** | Rich structured metadata extracted from event payloads (tokens, models, tools, files, agents) |
| **Redaction** | Process of removing sensitive data (credentials, API keys, tokens) before persistence |
| **Facet** | Structured dimension of an event (e.g., "tokens used", "tool invoked", "model selected") |
| **Session** | A contiguous period of Copilot activity, identified by `sessionId` from session-store.db |
| **Machine ID** | Human-readable identifier for a machine (e.g., hostname); supports multi-machine tracking |
| **Source** | Origin of an event (e.g., "copilot-cli", "vscode", "unknown") |
| **Confidence Level** | Degree of certainty in a facet value ("exact", "inferred", "heuristic", "unknown") |
| **Privacy Classification** | Metadata label for data sensitivity ("public", "internal", "confidential", "restricted") |
| **Tool Call** | Invocation of a tool (shell, editor, MCP, agent, debug command, file mutation, etc.) |
| **Import** | Process of reading source data and appending normalized events to the datastore |
| **Summary** | Aggregated view of datastore contents (event count, date range, facet breakdown) |
| **Real-Time** | Near-instantaneous (≤10 seconds) detection and streaming of new events to backend |
| **Streaming** | Continuous flow of new events from CLI to backend; enables live dashboards |
| **Redaction Policy** | Configuration specifying which fields to redact, anonymization rules, retention periods |
| **Schema Version** | Identifier (e.g., "1.0.0") for EventEnvelope and facet structure; supports compatibility checks |
| **Idempotent Import** | Re-running import with same inputs produces same result; no duplicate events |

---

## Document Change Log

- **v1.0 (2026-05-13)**: Initial comprehensive PRD based on v0.1.0 implementation and team Q&A; aligned with roadmap for real-time, cloud, and web UI features.

