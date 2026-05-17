# Product Vision: copilot-trace-importer

## 1. Overview

**Product Name:** copilot-trace-importer

**Summary:** A local-first **telemetry pipeline** for AI coding tools. The
importer / normalizer / redactor / sink layer that sits between raw on-disk
session data (Copilot, Claude Code, Cursor, Codex, …) and downstream
consumers (warehouses, OpenTelemetry collectors, compliance reports,
analyzer SDKs, and third-party dashboards such as
[codeburn](https://github.com/getagentseal/codeburn)).

**Positioning:** We are the *pipe*, not the dashboard. Our differentiation
is schema stability, redaction-by-default, retention metadata, OTel
alignment, multi-machine provenance, and pluggable sinks — the substrate a
regulated organization or platform team needs in order to trust AI-coding
telemetry. Developer dashboards (codeburn, future open-source UIs,
internal dashboards) are downstream consumers of our datastore.

**Target Platform:**
- CLI: macOS, Linux, Windows (Node.js 22+)
- Future: pluggable sinks (DuckDB, OTLP, Postgres, Azure Fabric, S3/Parquet), `watch`-mode streaming, analyzer SDK

**Key Constraints:**
- Redaction-by-default for sensitive data (configurable by policy)
- Append-only JSONL datastore (immutable history)
- Cross-platform path handling (especially Windows case-insensitivity)
- 70%+ code coverage requirement
- Financial-institution compliance needs (GDPR, SOC2, etc.)
- Provider-isolated parsers; unified output schema (ADR-002)

**Original PRD:** [PRD.md](../PRD.md)

---

## 2. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-17 | — | Initial product vision, decomposed from PRD v1.1. Carries forward the v0.2.0 (Unreleased) state and the codeburn-alignment commitments captured in PRD §14.8. |

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

**Shipped since v0.1.0 (v0.2.0 / Unreleased):**
- ✅ Provider-isolated architecture (ADR-002): per-source files under `src/providers/`, thin orchestrator
- ✅ Copilot model inference from tool-call ID prefixes (ADR-003)
- ✅ Char-based output-token fallback (ADR-003) — mirrors the codeburn fix
- ✅ Per-import-pass deduplication for Copilot events (ADR-003) with `deduplicatedEvents` counter
- ✅ `--version` / `-v` CLI flag and npm release workflow on tag push
- ✅ ADR-004 (Enrichment), ADR-005 (Sinks), ADR-006 (Policy-Based Redaction) accepted as designs

**Roadmap (Future Phases):**
- Real-time or near real-time updating of the datastore (streaming)
- Stream relevant selectable data to enterprise data stores (Azure Fabric, Snowflake, BigQuery, etc.)
- Real-time reporting and analytics dashboards
- Governance-focused Web UI for exploring sessions, models, token usage, and redaction/audit state
- Cloud sync support for organization-owned datastores
- Configurable redaction policies (strict, moderate, permissive)
- Research plugins for custom analysis workflows
- Teams/Slack notifications for threshold-based alerts (repo-specific)
- First-party `codeburn-export` sink + codeburn-style analyzer pack over our JSONL

### 3.2 Non-Goals

- ✗ **Not a TUI / web dashboard for developer cost UX.** We feed dashboards (yours, [codeburn](https://github.com/getagentseal/codeburn), internal); we do not build one as our primary UX. A `report` Markdown command (Phase 7) is the most we will ship in this lane.
- ✗ **Not a competitor to codeburn.** Codeburn is the best-in-class developer dashboard for "where did my AI coding tokens go". We are the pipeline that can feed it across providers, with redaction already applied. Where features overlap (e.g. cost reporting), we ship them as *enrichers/sinks*, not as a UI.
- ✗ Real-time hook into live Copilot sessions (import from stored data only)
- ✗ Modifying or deleting Copilot session data
- ✗ Replacing Copilot's own telemetry system
- ✗ On-premises Copilot deployment support (CLI focuses on local/cloud use)
- ✗ Machine learning or predictive modeling (analytics-focused, not ML training)
- ✗ End-user telemetry or privacy intrusion beyond redacted event analysis
- ✗ Support for Copilot versions < current LTS

---

## 4. Personas

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| **Alex (Copilot Dev/PM)** | Works on Copilot platform; needs to understand usage patterns and model performance across user base | Visibility into token usage, model selection patterns, tool invocation frequency; ability to drill down by session, date range, repository |
| **Jamie (Ops/Data Analyst)** | Manages telemetry pipeline for organization; owns the analytics infrastructure | Bulk import capability, schema stability, configurable redaction, integration with Azure/data warehouse, real-time streaming support |
| **Pat (Researcher)** | Studies AI effectiveness and code generation quality; publishes findings | Anonymized, redacted event data; access to patterns and facets; ability to export/share anonymized datasets; plugin extensibility |
| **Sam (End-User/Developer)** | Individual developer on team; curious about own productivity and token usage | Local CLI to see own session stats; privacy-first approach; opt-in data sharing with team |

---

## 5. Research Findings

### Technology Stack Decisions

**Current Stack (v0.2.0):**
- **Runtime:** Node.js 22+ (LTS, actively maintained)
- **Language:** TypeScript 5.9.2 (stable, modern features)
- **Schema Validation:** Zod 4.1.5 (runtime type checking, composes well)
- **Testing:** Vitest 4.1.6 (fast, TypeScript-native)
- **Coverage:** @vitest/coverage-v8 (built-in, no external service)

**Future Stack Considerations:**
- Backend API: Node.js/Express or Fastify (REST), tRPC or GraphQL (data queries)
- Database: Azure SQL, Cosmos DB, or Postgres + time-series extensions
- Streaming: Node.js streams API (built-in), Apache Kafka or Azure Event Hubs (if high-throughput multi-tenant)
- Frontend: React + TypeScript (web UI), with D3/Plotly for visualizations
- Infrastructure: Docker + Kubernetes, Azure Container Instances / ECS

### Competitive / Reference Analysis

| Reference | Relevance | Key Insight |
|-----------|-----------|-------------|
| Datadog Agent (CLI→SaaS) | CLI exports metrics to cloud | Model for local collection + cloud sync |
| OpenTelemetry | Schema design, facets, baggage | Inspired facet design; compatible export format (OTLP) |
| Jupyter + Pandas | Data analysis UI/API | Reference for notebook-style analytics |
| GitHub Actions Artifacts API | Event querying | REST API patterns for telemetry access |
| **codeburn** | Provider-isolated parsers; Copilot heuristics | Adopted provider layout (ADR-002); credited heuristics (ADR-003); first-party export sink planned (Phase 4) |

### Design Principles

1. **Privacy-first:** redaction by default; opt-in for raw payloads; configurable per policy
2. **Append-only:** historical immutability; traceable lineage (source, session, machine)
3. **Composable facets:** events carry rich metadata (tokens, tools, models, agents) for multi-dimensional analysis
4. **Offline-capable:** CLI works without network; optional sync to cloud
5. **Standards-aligned:** schema compatible with OpenTelemetry concepts (events, attributes, span semantics)
6. **Provider-isolated:** one file per source, one quirks doc per source, one registry entry per source (ADR-002)

---

## 6. Technical Architecture

### 6.1 Technology Stack

| Component | Technology | Version | Notes |
|-----------|-----------|---------|-------|
| Runtime | Node.js | 22+ | LTS, stable |
| Language | TypeScript | 5.9.2 | Strict mode |
| CLI / Core | tsx + TypeScript | 5.9.2 | ESM-first, type-safe |
| Schema Validation | Zod | 4.1.5 | Runtime + compile-time checks |
| Testing | Vitest | 4.1.6 | Fast, TypeScript-native |
| Coverage | @vitest/coverage-v8 | 4.1.4 | Integrated, no external service |
| Linting/Format | TypeScript compiler | 5.9.2 | `tsc --noEmit` |
| *(Future)* Backend API | Express / Fastify | TBD | REST + real-time endpoints |
| *(Future)* Database | Azure SQL / Cosmos | TBD | Depends on scale and latency needs |
| *(Future)* Frontend | React + TypeScript | TBD | D3/Plotly for charts |
| *(Future)* Streaming | Node.js Streams / Kafka | TBD | Real-time ingestion |

### 6.2 Project Structure

See [PRD §7.2](../PRD.md#72-project-structure) for the canonical directory tree
(current `src/providers/` layout, ADRs, release workflow, forge skills).

### 6.3 Key APIs / Interfaces

See [PRD §7.3](../PRD.md#73-key-apis--interfaces) for:
- CLI surface (`import`, `summary`, `--version`)
- Programmatic API (`importCopilotSessionStore`, `summarizeDatastore`, `getCopilotSessionRows`)
- Provider interface (`Provider`, `BUILTIN_PROVIDERS`, `ProviderImportContext`)
- Backend API (Roadmap, REST)

---

## 7. Non-Functional Requirements

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

## 8. Security and Privacy

| ID | Requirement | Priority |
|----|-------------|----------|
| SP-01 | No credentials, API keys, or tokens persisted; redaction by default | Must |
| SP-02 | Redaction patterns reviewed and tested quarterly | Should |
| SP-03 | Sensitive patterns (regex) versioned and documented in export-config | Should |
| SP-04 | All file operations respect OS-level file permissions (e.g., `~/.copilot/` read-only) | Must |
| SP-05 | No network calls without explicit user opt-in | Must |
| SP-06 | Datastore file encryption at rest (optional, user-supplied keys) | Could |
| SP-07 | GDPR compliance: right to access, right to delete, data portability | Should |
| SP-08 | SOC2 Type II compliance for cloud deployment | Should |
| SP-09 | Audit log for imports: what was imported, when, by whom (if deployed in team context) | Should |
| SP-10 | Configuration for data retention periods per regulatory requirements | Should |
| SP-11 | Support for data anonymization (hashing, tokenization) at organization policy level | Should |

---

## 9. Accessibility

| ID | Requirement | Priority |
|----|-------------|----------|
| ACC-01 | CLI output machine-readable (JSON, JSONL); optional human-readable tables | Must |
| ACC-02 | CLI help text clear and comprehensive; supports `--help` and `-h` | Must |
| ACC-03 | Error messages actionable; suggest fixes | Should |
| ACC-04 | Web UI (roadmap) meets WCAG 2.1 AA standards | Should |
| ACC-05 | Web UI supports keyboard navigation and screen readers | Should |
| ACC-06 | Charts and visualizations include data tables as fallback | Should |

---

## 10. System States / Lifecycle

See [PRD §13](../PRD.md#13-system-states--lifecycle) for the event-lifecycle and
datastore-state diagrams. The lifecycle is owned at the product level so that
every feature (ingest, redaction, sinks, streaming, alerts) plugs into the same
state machine.

---

## 11. Analytics / Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Adoption — npm downloads/month | 1K+ (by v1.0) | npm registry stats |
| Data Quality — % events successfully imported | ≥95% of valid source events | Import report: `importedEvents / totalLines` |
| Privacy — % credentials redacted | 100% (no leaks) | Regex pattern testing + manual inspection |
| Performance — import 10K events | <30 s | Benchmark on reference hardware |
| Reliability — test coverage | ≥70% | Vitest coverage reports |
| User Satisfaction — GitHub stars/issues | TBD | GitHub metrics |
| Enterprise Adoption (roadmap) | 3+ orgs using cloud deployment | Sales/community feedback |
| Real-Time Latency (roadmap, v0.5+) | ≤10 s (new event → dashboard) | Backend latency monitoring |

---

## 12. Dependencies and Risks

### 12.1 Dependencies

| Dependency | Type | Version | Risk if Unavailable | Mitigation |
|------------|------|---------|---------------------|------------|
| Node.js | Runtime | 22+ | Cannot run CLI | Require specific version in engines field; document LTS schedule |
| SQLite3 CLI | External tool | Latest | Cannot import from session-store.db | Tests skip gracefully; document installation; provide shell script |
| Zod | npm | ^4.1.5 | Cannot validate schemas | Actively maintained; stable API |
| TypeScript | npm | ^5.9.2 | Cannot compile | Actively maintained; auto-upgradable |
| Vitest | npm | ^4.0.0 | Cannot run tests | Actively maintained; equivalent to Jest |
| Azure SDK (future) | npm | TBD | Cannot stream to cloud | Support multiple backends (SQL Server, Postgres, DuckDB) |
| React (future) | npm | TBD | Cannot build web UI | Alternatives: Vue, Svelte, plain HTML |

### 12.2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SQLite import fails on Windows | Medium | Cannot import on 20%+ of user machines | Test on windows-latest CI; install sqlite3 in CI; provide fallback |
| Schema versioning breaks compatibility | Low | Old datastores become unreadable | Plan migration path; version events; document breaking changes |
| Redaction patterns miss credentials | Low | Privacy breach; data leakage | Quarterly pattern review; test against known examples; community audit |
| Real-time stream latency exceeds SLA | Medium (v0.5) | Dashboard not useful for alerts | Profile code; optimize batching; consider Kafka if needed |
| Data scale exceeds expectations | Medium | Import/query performance degrades | Performance testing early; optimize indexes; plan horizontal scaling |
| Cloud provider outage | Low | Team datastores unreachable | Multi-region failover; local fallback; data replication |
| Compliance audit failure | Medium | Cannot be used in regulated orgs | Engage compliance team early; document controls; regular audits |
| **Codeburn alignment drifts** | Medium | Lose the "feed codeburn" wedge; community confusion | PRD §14.8 Codeburn Alignment Matrix tracks per-phase deliverable; every relevant feature carries the owning FR |

---

## 13. Future Considerations

| Item | Description | Potential Version |
|------|-------------|-------------------|
| Offline Mode | Full-featured CLI without backend; cloud sync optional | v1.0 |
| Mobile Alerts | Push notifications to mobile devices | v1.2 |
| Data Marketplace | Share anonymized datasets with researchers | v1.5 |
| Custom Facet Plugins | Plugin API for domain-specific facet extraction | v1.0 |
| GraphQL API | Alternative to REST API for complex queries | v0.8 |
| Comparative Analytics | Benchmark your team vs. anonymized aggregate data | v1.1 |
| Cost Attribution | Allocate token costs to projects/teams; chargeback reports | v1.1 |
| Copilot-Native Integration | Direct hook into Copilot for telemetry; no local DB required | v2.0 |
| Jupyter Notebooks | Built-in notebook templates for data exploration | v1.0 |
| Time-Series Forecasting | Predict token usage trends; alert on anomalies | v1.5 |

---

## 14. Features

Summary of all features decomposed from this product vision. Each row also
notes the **codeburn-alignment commitment** the feature carries (per PRD §14.8).

| # | Feature | File | Deps | Priority | Codeburn-alignment |
|---|---------|------|------|----------|---------------------|
| 1 | Provider Architecture & Ingest | [provider-architecture-and-ingest.md](features/provider-architecture-and-ingest.md) | — (foundation) | Must | Phase 2 — FR-39 (per-provider quirks docs cross-ref codeburn) |
| 2 | Redaction & Privacy | [redaction-and-privacy.md](features/redaction-and-privacy.md) | PROV | Must | Phase 5 — FR-43 (policy presets so codeburn safe in regulated orgs) |
| 3 | Append-only Datastore | [append-only-datastore.md](features/append-only-datastore.md) | PROV, REDACT | Must | — |
| 4 | CLI Summary & Reporting | [cli-summary-and-reporting.md](features/cli-summary-and-reporting.md) | STORE | Must | — |
| 5 | Enrichment Pipeline | [enrichment-pipeline.md](features/enrichment-pipeline.md) | PROV | Should | Phase 3 — FR-40 (codeburn-compatible normalized fields) |
| 6 | Sink Interface & Codeburn Export | [sink-interface-and-codeburn-export.md](features/sink-interface-and-codeburn-export.md) | ENRICH | Must | Phase 4 — FR-41, FR-42 (sink interface + first-party `codeburn-export`) |
| 7 | Real-time Streaming & Backend API | [realtime-streaming-and-backend-api.md](features/realtime-streaming-and-backend-api.md) | STORE | Should | — |
| 8 | Cloud Persistence | [cloud-persistence.md](features/cloud-persistence.md) | SINK | Should | — |
| 9 | Governance Web UI | [governance-web-ui.md](features/governance-web-ui.md) | STREAM | Should | Phase 5 — explicit non-compete (governance, not dev cost UX) |
| 10 | Observability & Alerts | [observability-and-alerts.md](features/observability-and-alerts.md) | STREAM | Should | — |
| 11 | Codeburn-Style Analyzer Pack | [codeburn-style-analyzer-pack.md](features/codeburn-style-analyzer-pack.md) | ENRICH, STORE | Should | Phase 6 — FR-44 (analyzer pack across every provider) |
| 12 | Research Plugins & Marketplace | [research-plugins-and-marketplace.md](features/research-plugins-and-marketplace.md) | PROV, ENRICH, REDACT | Could | Phase 7 — FR-45 (marketplace accepts codeburn-compatible bundles) |

### Feature Dependency Graph

```
PROV (foundation)
├── REDACT
│   └── STORE
│       ├── SUMM
│       ├── STREAM
│       │   ├── WEBUI
│       │   └── ALERT
│       └── ANALYZE (also depends on ENRICH)
├── ENRICH
│   ├── SINK
│   │   └── CLOUD
│   └── ANALYZE
└── PLUGIN (also depends on ENRICH, REDACT)
```

### Codeburn Alignment Coverage by Phase

| Phase | Version | Owning Feature | FR |
|-------|---------|----------------|----|
| 1 | v0.2.0 | PROV (done) | ADR-002, ADR-003 |
| 2 | v0.3.0 | PROV (per-provider docs for new sources) | FR-39 |
| 3 | v0.5.0 | ENRICH | FR-40 |
| 4 | v0.7.0 | SINK | FR-41, FR-42 |
| 5 | v0.8.0 | REDACT | FR-43 |
| 6 | v0.9.0 | ANALYZE | FR-44 |
| 7 | v1.0.0 | PLUGIN | FR-45 |

Every roadmap phase has exactly one owning feature for its codeburn-alignment
deliverable. This matches PRD §14.8 (Codeburn Alignment Matrix).

---

## 15. Glossary

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
| **Provider** | A source-specific module under `src/providers/` implementing the `Provider` interface (ADR-002) |
| **Sink** | A destination for normalized envelopes (JSONL, OTLP, Parquet, warehouse, `codeburn-export`, …); contract defined by ADR-005 |
| **Enrichment** | Derivation of normalized / inferred fields (model family, token fallback flags, cost-ready facets) before sink fan-out (ADR-004) |
| **Codeburn alignment** | The cross-phase commitment to feed [codeburn](https://github.com/getagentseal/codeburn) and codeburn-style consumers rather than compete with them; tracked per phase in PRD §14.8 |

---

## 16. Open Questions

| # | Question | Default Assumption |
|---|----------|--------------------|
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
