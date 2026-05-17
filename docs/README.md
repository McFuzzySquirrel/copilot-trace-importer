# Documentation

This directory contains architecture decision records (ADRs) and design documentation.

## Architecture Decision Records (ADRs)

ADRs document significant architectural decisions, their rationale, and tradeoffs. Each ADR is written once and updated only to reflect new information or supersession.

### Current ADRs

- **[ADR-001: Append-Only JSONL Datastore Format](ADR-001-append-only-jsonl.md)** — Rationale for JSONL vs. SQLite/Parquet/CSV; streaming-ready design for v0.5+ real-time features
- **[ADR-002: Provider Isolation Pattern](ADR-002-provider-isolation.md)** — One file per source under `src/providers/`; uniform `Provider` interface; deliberate non-unification of parsers
- **[ADR-003: Copilot Model Inference, Token Fallback, Deduplication](ADR-003-copilot-inference-and-dedup.md)** — Tool-call ID prefix → model family; `CHARS_PER_TOKEN = 4` output-token fallback; per-pass dedup via `messageId`
- **[ADR-004: Enrichment Pipeline](ADR-004-enrichment-pipeline.md)** — Design only; implementation deferred to Phase 3 (cost + classifier enrichers)
- **[ADR-005: Sink Interface](ADR-005-sink-interface.md)** — Design only; implementation deferred to Phase 4 (DuckDB / OTLP / Postgres + `watch` mode)
- **[ADR-006: Policy-Based Redaction](ADR-006-policy-based-redaction.md)** — Design only; implementation deferred to Phase 5 (tiered policies, custom patterns, redaction report, `prune`)

### Per-provider quirks docs

- **[copilot-session-store](providers/copilot-session-store.md)** — SQLite session metadata
- **[copilot-events-jsonl](providers/copilot-events-jsonl.md)** — Per-session events.jsonl (where the Copilot model-inference and dedup live)
- **[vscode-chat-debug](providers/vscode-chat-debug.md)** — VS Code GitHub Copilot Chat debug logs

### ADR Process

1. **Create**: Copy [ADR-TEMPLATE.md](ADR-TEMPLATE.md) to `ADR-NNN-title-slug.md` (use next sequential number)
2. **Draft**: Fill in Context, Decision, Rationale, Alternatives, Implementation, Consequences
3. **Review**: Discuss in team; get consensus or document dissent
4. **Accept**: Update status to "Accepted"; commit to main
5. **Supersede**: If a later ADR replaces this one, update status to "Superseded By" with link

### When to Write an ADR

Write an ADR for:
- ✅ Major technology choices (frameworks, databases, schema formats)
- ✅ Significant architectural changes (e.g., moving from monolith to microservices)
- ✅ Design decisions affecting multiple teams or long-term maintenance
- ✅ Tradeoffs with meaningful consequences (performance, maintainability, scalability)

Skip ADRs for:
- ❌ Bug fixes or small patches
- ❌ Simple feature additions with no architectural impact
- ❌ Decisions that only affect one person or team

---

## Other Documentation

- **[../README.md](../README.md)** — User-facing guide: installation, usage, examples, troubleshooting
- **[../PRD.md](../PRD.md)** — Product Requirements Document: vision, roadmap, requirements, success criteria
- **[../src/index.ts](../src/index.ts)** — Programmatic API documentation (TypeScript types)
- **[../src/schema/schema.ts](../src/schema/schema.ts)** — Event schema and facet types (Zod definitions)
- **[../src/redaction/patterns.ts](../src/redaction/patterns.ts)** — Sensitive data patterns reference

---

## Roadmap: Planned ADRs

These ADRs are planned for upcoming phases:

| ADR | Title | Phase | Status |
|-----|-------|-------|--------|
| ADR-007 | Real-Time `watch` mode + streaming backend | v0.5 | Proposed |
| ADR-008 | Schema versioning and migration | v1.0 | Proposed |
| ADR-009 | Multi-tenancy for team deployments | v0.9 | Proposed |
| ADR-010 | Analyzer SDK and plugin packaging | v0.8 | Proposed |

---

## Contributing

When proposing architectural changes:

1. **Open an issue** describing the problem or opportunity
2. **Draft an ADR** using [ADR-TEMPLATE.md](ADR-TEMPLATE.md)
3. **Share for review** in a discussion or PR
4. **Get consensus** from core team
5. **Commit** with "Accepted" status and merge to main

---

## References

- **Lightweight ADR Format**: [adr.github.io](https://adr.github.io) — Original ADR format
- **Markdown Template**: [github.com/joelparkerhenderson/architecture_decision_record](https://github.com/joelparkerhenderson/architecture_decision_record)

