# ADR-005: Sink Interface (Design Only — Implementation Deferred)

**Status:** Proposed (design accepted; implementation deferred to Phase 4)

**Date:** 2026-05-17

**Deciders:** McFuzzySquirrel

**Affected Components:** future `src/sinks/`, integration point in the
orchestrator after enrichment + redaction.

---

## Context

Today the orchestrator writes JSONL directly via `appendFile`. That is
fine for v0.1 but blocks our actual value proposition: feeding many
downstream consumers (warehouses, OTel collectors, codeburn,
compliance reports) from one ingest pass without each writing a custom
script.

## Decision (design)

Introduce a **Sink** interface that the orchestrator drives after
enrichment and redaction:

```typescript
interface Sink {
  readonly name: string;
  open(ctx: SinkContext): Promise<void>;
  write(event: EventEnvelope): Promise<void>;
  flush(): Promise<void>;
  close(): Promise<void>;
}
```

Multiple sinks may be configured in parallel; the orchestrator
broadcasts each envelope to every active sink.

Initial sinks (Phase 4):

- `jsonl` — current default; writes append-only JSONL.
- `duckdb` — writes Parquet via DuckDB for warehouse-style queries.
- `otlp` — exports as OTel events for OpenTelemetry collectors.
- `postgres` — direct insert for organizations standardizing on it.

Stretch sinks (Phase 4 or later):
- `azure-fabric` (Eventstream + Lakehouse target)
- `s3-parquet` (rolling partitioned Parquet to S3-compatible storage)
- `codeburn-export` — emit a directory structure codeburn can read,
  so users can run `codeburn` over our redacted, cross-provider data.

## Rationale

- The orchestrator already owns the "what was emitted" contract; adding
  fan-out is local to the orchestrator.
- A narrow `Sink` interface keeps third-party sink contributions
  feasible without exposing internal types.
- `flush` and `close` are explicit so sinks with batch semantics
  (`duckdb`, `s3-parquet`) can amortize writes.

## Consequences

### Positive

- Same import pass feeds every downstream consumer the user cares about.
- `watch` mode (Phase 4) becomes natural: providers emit incrementally,
  enrichers process, sinks broadcast.
- Codeburn becomes a *consumer of our data*, not a competitor.

### Negative

- Backpressure across heterogeneous sinks is non-trivial; the slowest
  sink will pace the fastest unless we add per-sink queues. We will
  accept that for v0.5 and revisit if it becomes a problem.

## Status & Scope

Design only. The current orchestrator's direct `appendFile` is
effectively an inlined `jsonl` sink. When Phase 4 lands, that inlined
code will be wrapped into `JsonlSink` and the orchestrator will simply
broadcast to a list. No public API change is anticipated for the
default behavior.

## References

- ADR-001 (Append-Only JSONL Datastore Format)
- ADR-002 (Provider Isolation)
- ADR-004 (Enrichment Pipeline)
