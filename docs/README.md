# Documentation

This directory contains architecture decision records (ADRs) and design documentation.

## Architecture Decision Records (ADRs)

ADRs document significant architectural decisions, their rationale, and tradeoffs. Each ADR is written once and updated only to reflect new information or supersession.

### Current ADRs

- **[ADR-001: Append-Only JSONL Datastore Format](ADR-001-append-only-jsonl.md)** — Rationale for JSONL vs. SQLite/Parquet/CSV; streaming-ready design for v0.5+ real-time features
- **[ADR-002: Real-Time Streaming Backend Architecture](ADR-002-real-time-streaming.md)** *(Proposed)* — Tail-the-JSONL + pluggable HTTP NDJSON sinks for the v0.5 streaming pipeline

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
| ADR-002 | Real-Time Streaming Backend Architecture | v0.5 | Proposed (drafted) |
| ADR-003 | Configurable Redaction Policies | v0.5 | Proposed |
| ADR-004 | Schema Versioning and Migration | v1.0 | Proposed |
| ADR-005 | Multi-Tenancy for Team Deployments | v0.9 | Proposed |
| ADR-006 | Cloud Database Selection (Azure Cosmos vs. SQL vs. Fabric) | v0.7 | TBD |

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

