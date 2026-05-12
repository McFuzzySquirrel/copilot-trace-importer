# ADR-001: Append-Only JSONL Datastore Format

**Status:** Accepted

**Date:** 2026-05-13

**Deciders:** McFuzzySquirrel

**Affected Components:** Core datastore format, CLI `import` and `summary` commands, schema validation

---

## Context

The tool needed a persistent, queryable format for normalized Copilot session events. Key requirements:

1. **Offline-first**: Should work entirely locally without external databases during data collection
2. **Multi-source**: Import from SQLite (session-store.db), JSONL (session-state), and VS Code debug logs
3. **Immutable history**: Preserve full audit trail; no deletions or modifications
4. **Queryable**: Support filtering, aggregation, and analysis without requiring specialized tools
5. **Privacy-aware**: Redaction applied before persistence; no leakage of credentials
6. **Extensible**: Support facet extraction (tokens, tools, models, agents) for analytics
7. **Cross-platform**: Work on macOS, Linux, Windows without path-specific dependencies

### Alternatives Considered

| Format | Pros | Cons | Decision |
|--------|------|------|----------|
| **JSONL** (chosen) | Line-delimited, streaming-friendly, queryable with grep/jq, append-only natural, human-readable, no schema migration | Slower for complex queries, larger disk footprint than binary | ✅ Selected |
| SQLite | Efficient queries, ACID transactions, indexing, offline-capable | Requires external tool (sqlite3), harder to append concurrently, schema migrations complex | ❌ Rejected |
| Parquet | Columnar efficiency, compression, BI-tool support | Not append-only by design, requires writer lock, batch writes only | ❌ Rejected (consider for v0.7 export) |
| CSV | Simple, spreadsheet-friendly | No nested structure (facets), poor handling of escaping, not schema-aware | ❌ Rejected |
| Protocol Buffers | Compact binary, versioning, streaming | Not human-readable, requires code generation, debugging harder | ❌ Rejected (consider for wire format in v0.5+) |

---

## Decision

**Adopt append-only JSONL format for the primary datastore.**

Each event is one line (JSON object), followed by newline (`\n`). This design:

1. **Enables true append-only semantics**: Any process can append without locking; no coordination needed
2. **Preserves history**: Events are never deleted or modified; full audit trail available
3. **Supports streaming**: New events appended as they're generated; watcher can detect changes (v0.5+)
4. **Is queryable without external DB**: Use grep, jq, AWK, or load into DuckDB/pandas for analysis
5. **Simplifies redaction**: Redact events before writing; no in-place updates needed
6. **Allows versioning**: Each event carries `schemaVersion`; migration logic at read time (v1.0+)

### Data Layout

```
datastore/
└── events.jsonl        # Append-only normalized event store
    ├─ Line 1: Event 1 (envelope + facets + payload)
    ├─ Line 2: Event 2
    ├─ Line 3: Event 3
    └─ ... (append new events)
```

Each line is valid JSON; the file as a whole is JSONL (ndjson).

### Schema Structure

Each event includes:

- **`envelope`**: Metadata (timestamp, source, session ID, machine ID, user ID)
- **`facets`**: Extracted structured data (tokens, tools, models, agents, errors, debug signals)
- **`privacy`**: Redaction metadata (classification, redaction applied, retention period)
- **`payload`**: Raw event data (preserved for auditing, still redacted)

Example:

```json
{
  "envelope": {
    "timestamp": "2026-05-13T14:30:00.000Z",
    "source": "copilot-session-store",
    "sessionId": "sess-123",
    "machineId": "laptop-1",
    "userId": "alice@company.com",
    "schemaVersion": "1.0.0"
  },
  "facets": {
    "modelUsage": { "model": "gpt-4-turbo", "inputTokens": 250, "outputTokens": 150, ... },
    "toolCalls": [ { "toolName": "subagent", "category": "agent_delegation", "status": "success", ... } ],
    "tokens": { "inputTokens": 250, "outputTokens": 150, ... },
    "filesTouched": [ { "path": "src/handler.ts", "action": "read", ... } ],
    "agentActivity": { "agentName": "qa-engineer", "action": "started", ... }
  },
  "privacy": {
    "classification": "internal",
    "locallyRedacted": true,
    "rawPayloadOptIn": false,
    "retention": "standard"
  },
  "payload": { "type": "assistant.message", "data": { ... } }
}
```

### Schema Validation

**Zod** (TypeScript runtime schema validator) enforces structure at import time:

1. Parse raw event from source
2. Validate against Zod schema
3. If invalid, log error and skip (resilient to malformed data)
4. If valid, extract facets and apply redaction
5. Append to JSONL

This ensures:
- Type safety at compile-time (TypeScript strict mode)
- Runtime validation (Zod)
- Consistent facet structure (multi-dimensional queries)
- Resilience (malformed events don't break the pipeline)

---

## Rationale

### Why Not SQLite?

While SQLite is powerful for querying, it violates the **offline-first, append-only** requirement:

1. **Locking**: Concurrent appends from multiple machines require coordination (complex for local usage)
2. **Schema migrations**: Adding facets or fields requires schema changes; JSONL avoids this
3. **Overhead**: SQLite adds binary-format complexity for a local tool; JSONL is more transparent
4. **Debugging**: SQLite requires sqlite3 CLI or a library to inspect; JSONL is readable with `cat`/`less`

**Decision:** Keep SQLite for input (session-store.db is read-only) but output to JSONL.

### Why Not Other Formats?

- **CSV**: Doesn't support nested structures (facets are objects/arrays)
- **Parquet**: Not append-only by design; requires batch writes and schema specification upfront
- **Protocol Buffers**: Binary format; not debuggable without tools; overkill for local datastore

**Decision:** JSONL fits the append-only + queryable + human-readable sweet spot for v0.1.

### Streaming and Real-Time (Roadmap)

JSONL design supports future real-time features (v0.5+):

1. **File watcher**: Detect new lines appended to JSONL
2. **Stream to backend**: Send new events to API (batched)
3. **Backend indexing**: Persist to database for fast queries
4. **Live dashboard**: Real-time updates via WebSocket

Because JSONL is append-only, detecting changes is trivial: track file size/inode or tail -f.

---

## Consequences

### Positive

✅ **Offline capability**: No external DB needed during collection; collect anywhere, analyze anywhere

✅ **Append-only immutability**: Full audit trail; no accidental deletions; strong privacy guarantees

✅ **Queryable without tools**: grep, jq, AWK work natively; load into DuckDB/pandas/SQL as needed

✅ **Version-safe**: Each event carries schema version; migration logic at read time (supports v1.0 breaking changes)

✅ **Streaming-ready**: File watcher + tail enable real-time detection for v0.5+ features

✅ **Human-readable**: Inspect events with cat, less, or grep; easier to debug

✅ **Flexible facets**: Add new facet types without schema migration; Zod validates at import

### Negative

❌ **No query indexing**: JSONL doesn't support indexes; large files (TB+) require sequential scans

❌ **No transactions**: If process crashes mid-append, line may be incomplete (mitigated: validate each line independently)

❌ **Disk footprint**: JSON is verbose; JSONL files are larger than binary or columnar formats

❌ **Complex queries**: Filtering by multiple facets requires custom code (vs. SQL WHERE clause)

### Mitigation Strategy

1. **Indexing (v0.5+)**: Backend API indexes events in database (Cosmos, SQL, or DuckDB) for fast queries
2. **Compression (v0.7+)**: Support optional gzip compression for archived datastores
3. **Partitioning (v0.7+)**: Split into multiple files by date/machine to reduce scan time
4. **Export formats (v1.0+)**: Parquet, CSV, DuckDB for different downstream tools

---

## Implementation Notes

### Appending to JSONL

```typescript
// Each event is appended as a complete line
const event = { envelope: {...}, facets: {...}, privacy: {...}, payload: {...} };
await appendFile(datastorePath, JSON.stringify(event) + '\n');
```

### Reading and Querying

```typescript
// Option 1: Stream line-by-line (memory-efficient)
const reader = createReadStream(datastorePath);
for await (const line of reader) {
  const event = JSON.parse(line);
  // process event
}

// Option 2: Load entire file (for small datastores)
const content = await readFile(datastorePath, 'utf-8');
const events = content.split('\n').filter(Boolean).map(JSON.parse);

// Option 3: Use external tools
// cat datastore.jsonl | jq '.facets.modelUsage.model' | sort | uniq -c
```

### Schema Versioning

Events carry `schemaVersion: "1.0.0"`. When reading:

```typescript
const event = JSON.parse(line);
switch (event.envelope.schemaVersion) {
  case "1.0.0": 
    return parseV1(event);
  case "2.0.0":
    return parseV2(event);
  default:
    throw new Error(`Unsupported schema version: ${event.envelope.schemaVersion}`);
}
```

This supports forward/backward compatibility; breaking changes migrate at read time.

### Error Handling

```typescript
// Malformed JSON line → skip with logging
for (const line of lines) {
  try {
    const event = JSON.parse(line);
    validateWithZod(event); // throws if invalid
    // process event
  } catch (err) {
    logger.warn(`Skipped invalid event on line ${lineNum}: ${err.message}`);
  }
}
```

---

## References

- **JSONL Format**: [jsonlines.org](https://jsonlines.org)
- **Zod**: [zod.dev](https://zod.dev) — TypeScript-first schema validation
- **Append-Only Data Structures**: [bit.io/append-only](https://bit.io/blog/append-only)
- **Event Sourcing**: [martinfowler.com/eaaDev/EventSourcing.html](https://martinfowler.com/eaaDev/EventSourcing.html) — Related pattern; JSONL fits naturally

---

## Appendix: File Format Comparison

| Aspect | JSONL | SQLite | Parquet | CSV |
|--------|-------|--------|---------|-----|
| **Append-Only** | ✅ Native | ❌ Requires coordination | ❌ No | ⚠️ Possible but not natural |
| **Queryable** | ✅ grep/jq | ✅ SQL | ✅ Columnar | ⚠️ grep only |
| **Nesting** | ✅ Full JSON support | ✅ Via JSON columns | ❌ Flat rows | ❌ No |
| **Compression** | ✅ gzip (v0.7+) | ✅ Built-in | ✅ Best-in-class | ✅ gzip |
| **Indexing** | ❌ No | ✅ Yes | ❌ Requires recompute | ❌ No |
| **Transactions** | ❌ No | ✅ ACID | ❌ No | ❌ No |
| **Human-Readable** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **External Tool Required** | ✅ No (jq optional) | ✅ sqlite3 CLI | ✅ Parquet tools | ✅ No |
| **Streaming** | ✅ Tail-friendly | ❌ Not designed | ❌ No | ⚠️ Line-based only |
| **Backwards Compat** | ✅ Event-level versioning | ⚠️ Schema migration | ⚠️ Schema evolution | ❌ Header change breaks |

---

## Decision Record Metadata

- **Last Updated**: 2026-05-13
- **Status**: Accepted
- **Supersedes**: None
- **Superseded By**: (pending: ADR-002 for real-time streaming backend, v0.5+)
- **Related ADRs**: ADR-003 (Redaction policy), ADR-004 (Schema versioning)

