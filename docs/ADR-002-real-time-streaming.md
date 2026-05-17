# ADR-002: Real-Time Streaming Backend Architecture

**Status:** Proposed

**Date:** 2026-05-17

**Deciders:** McFuzzySquirrel

**Affected Components:** CLI (new `watch`/`stream` commands), datastore writer, future Backend API ingestion endpoint, schema envelope

---

## Context

PRD §3.1 (Roadmap) and §6 (Phase 3 / v0.5) call for **near real-time updating of the datastore** and **streaming relevant data to a backend / enterprise data stores** (Azure Fabric, Snowflake, BigQuery). The acceptance criteria in PRD §10 (v0.5.0) require:

1. A file watcher that detects datastore changes within **≤10 seconds**.
2. Events streamed to a backend and persisted in a local database.
3. An E2E flow: `import → watch → stream → query → UI reflects new events`.

Today (v0.1.0) the tool is strictly batch:

- `import` reads SQLite / JSONL / VS Code logs and appends normalized events to `datastore/events.jsonl` ([ADR-001](ADR-001-append-only-jsonl.md)).
- `summary` reads the same file and aggregates.
- There is no long-running process, no network egress, and no notion of "newest event since cursor X".

To get from here to v0.5 we need to decide:

1. **How does the CLI detect new events?** (Re-scan sources? Tail the JSONL? Watch the FS?)
2. **What does it stream, and to whom?** (Raw lines? Normalized envelopes? To which transport?)
3. **How do we keep the design append-only and offline-capable** so single-user CLI use is unaffected?
4. **How do we stay aligned with [ADR-001](ADR-001-append-only-jsonl.md)** (JSONL as source of truth) and the OpenTelemetry-inspired schema noted in PRD §5?

This ADR addresses (1)–(4). It does **not** select a specific cloud database — that is deferred to ADR-006.

---

## Decision

Adopt a **three-stage pipeline** rooted in the JSONL datastore, with each stage independently runnable and testable:

```
┌──────────────┐    ┌──────────────────┐    ┌────────────────────┐    ┌──────────────┐
│  Sources     │ →  │  import (batch)  │ →  │  events.jsonl      │ ←  │  watch       │
│  SQLite,     │    │  (existing)      │    │  (append-only,     │    │  (new, tails │
│  JSONL, VSC  │    │                  │    │   ADR-001)         │    │   file)      │
└──────────────┘    └──────────────────┘    └────────────────────┘    └──────┬───────┘
                                                                              │
                                                                              ▼
                                                                      ┌──────────────┐
                                                                      │  stream      │
                                                                      │  (new, ships │
                                                                      │   batches to │
                                                                      │   sink)      │
                                                                      └──────┬───────┘
                                                                              │
                                            ┌─────────────────────────────────┴────────────┐
                                            ▼                                              ▼
                                ┌────────────────────────┐                     ┌────────────────────────┐
                                │  Pluggable sink:       │                     │  Pluggable sink:       │
                                │  Backend API (HTTP)    │                     │  Enterprise warehouse  │
                                │  (initial target)      │                     │  adapters (ADR-006)    │
                                └────────────────────────┘                     └────────────────────────┘
```

Concretely:

1. **`events.jsonl` remains the single source of truth.** Watch/stream do **not** re-read upstream sources; they observe what `import` has already normalized and redacted. This keeps redaction guarantees centralized and avoids duplicating parser logic.
2. **Introduce a `watch` command** that tails the JSONL using Node's built-in `fs.watch` + size-cursor fallback (`fs.stat` polling), emitting parsed envelopes on a Node `Readable` stream.
3. **Introduce a `stream` command** that consumes the watch stream and ships batches to a pluggable **sink interface**. The first sink is `HttpSink` (HTTP POST to a backend ingestion endpoint); a `FileSink` is provided for tests and dry-run.
4. **Add a `cursor` to the envelope** — a monotonic byte offset into `events.jsonl` — persisted in `datastore/.stream-cursor.json` per sink, so restarts resume without re-shipping.
5. **Transport for v0.5 is HTTP POST with NDJSON batches** over keep-alive; WebSocket / Kafka / Event Hubs are explicitly out of scope for v0.5 and deferred to later ADRs (see Alternatives).
6. **Backpressure is handled by the Node streams API** with a bounded in-memory queue (default 1,000 events) and a disk-spill fallback that simply pauses tailing — since the JSONL itself is the buffer, no separate spool is needed.

---

## Rationale

**Why JSONL-as-bus instead of an in-process event emitter:**

- Preserves ADR-001's append-only, audit-friendly semantics. Anything streamed has already been persisted, so there is no "ghost event" that was streamed but not durable.
- Decouples lifetimes: `import` can be a cron job, `watch` can be a long-running daemon, and they can crash independently.
- Makes the streaming path trivially testable with a fixture `events.jsonl` and no live Copilot session.

**Why HTTP NDJSON for v0.5:**

- Smallest possible operational surface — works behind corporate proxies, requires no broker, and is supported by every backend stack the PRD mentions (Express/Fastify, Azure Functions, Fabric, Snowflake via REST, BigQuery via REST).
- Batches map 1:1 to JSONL lines, so the wire format is literally a slice of the datastore file. This makes replay and debugging straightforward (`curl --data-binary @slice.jsonl`).
- The 5–10 s latency target in PRD §10 is easily met by a 1–5 s flush interval; WebSocket / Kafka would add complexity without meeting a stricter SLA that the PRD does not require.

**Why a per-sink cursor file:**

- Multiple sinks (e.g., backend API + research export) may progress at different rates. A single global cursor would force the slowest sink to gate the others.
- A small JSON file fits the offline-first, no-extra-dependencies posture of the project.

---

## Alternatives Considered

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **Tail `events.jsonl` + HTTP NDJSON sink** (chosen) | Reuses ADR-001; no new infra; cross-platform; testable; meets ≤10 s SLA | Slightly higher latency than a direct in-process emitter; requires cursor bookkeeping | ✅ Selected for v0.5 |
| In-process `EventEmitter` from `import` straight to sink | Lowest latency (sub-second); no FS watching | Couples streaming to the import process lifetime; events could be streamed but lost before `fsync`; breaks the append-only-first invariant | ❌ Rejected |
| WebSocket from CLI to Backend | Bidirectional; lower per-message overhead | Requires the backend to expose stateful sockets; harder behind corporate proxies; no clear v0.5 use case for server→CLI messages | ❌ Deferred (revisit if a bidirectional control plane is needed) |
| Apache Kafka / Azure Event Hubs as transport | Battle-tested high-throughput streaming; native fan-out | Enormous operational overhead for a CLI tool; out of scope for single-user / small-team v0.5 | ❌ Deferred to a future ADR if multi-tenant throughput justifies it |
| Re-implement streaming inside the source readers (SQLite/JSONL/VSC) | Lowest end-to-end latency from Copilot event to sink | Duplicates redaction; requires three watcher implementations; violates ADR-001's "JSONL is the source of truth" | ❌ Rejected |
| OTLP/HTTP (OpenTelemetry Protocol) as the wire format | Aligns with PRD §5 OpenTelemetry mention; standard tooling | OTLP's data model is span/metric/log-centric and does not naturally fit the existing facet envelope; would force a lossy mapping for v0.5 | ❌ Deferred; revisit when a Backend API ADR is written |

---

## Implementation Details

### New CLI surface

```
copilot-trace-importer watch  [--datastore <dir>] [--from-start] [--poll-ms 500]
copilot-trace-importer stream [--datastore <dir>]
                              --sink http --url <endpoint> [--header K=V ...]
                              [--batch-size 100] [--flush-ms 2000]
                              [--sink-id <name>]
```

`watch` is usable standalone (prints events to stdout) so users can adopt the new pipeline without standing up a backend.

### Module layout (proposed)

```
src/
├── stream/
│   ├── tailer.ts          # fs.watch + stat-polling tail of events.jsonl
│   ├── cursor.ts          # load/save per-sink cursor (byte offset + lastEventId)
│   ├── batcher.ts         # size+time batching (Node Transform stream)
│   └── sinks/
│       ├── index.ts       # Sink interface
│       ├── http.ts        # HttpSink (NDJSON POST, retries with backoff)
│       └── file.ts        # FileSink (writes to a file, for tests / dry-run)
```

### Sink interface (sketch)

```ts
export interface Sink {
  readonly id: string;
  send(batch: Envelope[]): Promise<SinkResult>;
  close?(): Promise<void>;
}

export type SinkResult =
  | { ok: true; ackedCursor: string }
  | { ok: false; retryable: boolean; error: Error };
```

### Cursor file

`datastore/.stream-cursor.json`:

```json
{
  "version": 1,
  "sinks": {
    "default-http": { "offset": 1048576, "lastEventId": "evt_…", "updatedAt": "2026-05-17T16:00:00Z" }
  }
}
```

### Wire format

`POST {url}` with `Content-Type: application/x-ndjson`, body = one envelope JSON per line (exactly as on disk). HTTP 2xx = acked; 4xx = drop with logged error (non-retryable); 5xx / network = retry with exponential backoff and a max-retry cap, then pause the sink.

### Backpressure

- Bounded queue (default 1,000 envelopes) between `tailer` and `batcher`.
- When the queue is full, the tailer stops reading; the JSONL on disk is the spool.
- A `--max-lag-bytes` flag will warn (and optionally exit non-zero) when the cursor falls more than N bytes behind end-of-file, so ops can alert on a stalled sink.

### Testing strategy

- Fixture JSONL appended to in tests; assert `watch` emits the appended envelopes in order and only once.
- `HttpSink` tested against a local Node HTTP server (`node:http`); covers 2xx, 4xx, 5xx, network error, and replay-on-restart.
- Coverage target stays at the existing 70 % (PRD constraint).

---

## Consequences

### Positive

✅ Meets PRD v0.5 acceptance criteria (≤10 s detection, persisted streaming, E2E path).

✅ Preserves ADR-001 invariants: JSONL stays the single source of truth and remains append-only.

✅ Redaction is not duplicated — anything streamed has already passed through the redaction pipeline.

✅ Zero new runtime dependencies for the v0.5 milestone (Node stdlib `fs`, `http`, `stream`).

✅ Cleanly extensible: adding a Snowflake / BigQuery / Fabric sink is a new file under `sinks/`, not a rewrite.

✅ Multi-sink without head-of-line blocking, thanks to per-sink cursors.

### Negative

❌ End-to-end latency is bounded below by the FS poll interval + flush interval (typically 2–7 s in practice). Not suitable for sub-second use cases.

❌ Introduces a long-running process (`watch`/`stream`) into a project that has been pure-batch; operators now need a supervisor (systemd, `pm2`, container, etc.). This will need to be documented.

❌ Cursor file is a small piece of mutable state in an otherwise append-only datastore. It is per-sink and isolated under `datastore/.stream-cursor.json`, but it does break the "nothing in `datastore/` ever changes after write" mental model.

❌ HTTP-only transport means deployments that mandate a broker (Kafka, Event Hubs) need a relay until a future ADR adds native support.

### Mitigation

- Document the supervisor expectations in the v0.5 README section and provide a sample `systemd` unit and Dockerfile.
- Keep the cursor file format versioned (`"version": 1`) so a future move to e.g. SQLite-backed cursors is non-breaking.
- Explicitly call out, in user docs, that `watch`/`stream` are optional — the `import` + `summary` batch workflow continues to work unchanged.
- Add a `--dry-run` flag to `stream` that uses `FileSink` so users can validate end-to-end before pointing at a real backend.

---

## Open Questions

These are deliberately left for follow-up ADRs / issues rather than blocking ADR-002:

1. **Backend ingestion endpoint contract** — auth, idempotency keys, batch size limits. Belongs in the Backend API ADR.
2. **Schema versioning across the wire** — touched by [ADR-001](ADR-001-append-only-jsonl.md) (`schemaVersion` on each envelope); a dedicated ADR-004 will cover migration.
3. **Cloud database selection** — see roadmap entry for ADR-006.
4. **Multi-tenancy / per-team sinks** — see ADR-005 (v0.9).

---

## References

- [PRD §3.1 Roadmap](../PRD.md) — real-time streaming and enterprise data store goals
- [PRD §10 Acceptance Criteria — v0.5.0](../PRD.md) — ≤10 s latency target and E2E flow
- [ADR-001: Append-Only JSONL Datastore Format](ADR-001-append-only-jsonl.md)
- [Node.js Streams documentation](https://nodejs.org/api/stream.html)
- [NDJSON specification](https://github.com/ndjson/ndjson-spec)

---

## Related ADRs

- [ADR-001](ADR-001-append-only-jsonl.md) — JSONL datastore that this ADR builds on
- ADR-003 (planned) — Configurable Redaction Policies; relevant because streamed events must respect policy
- ADR-004 (planned) — Schema Versioning and Migration; relevant for wire compatibility
- ADR-006 (planned) — Cloud Database Selection; downstream of the sinks defined here

---

## Decision Record Metadata

- **Last Updated**: 2026-05-17
- **Status**: Proposed
- **Supersedes**: (none)
- **Superseded By**: (pending)
- **Related ADRs**: ADR-001, ADR-003, ADR-004, ADR-006
