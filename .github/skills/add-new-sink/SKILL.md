---
name: add-new-sink
description: >
  Scaffold a new sink (destination) for the copilot-trace-importer pipeline against the ADR-005
  Sink interface. Creates the sink source file under `src/sinks/`, the configuration doc under
  `docs/sinks/<name>.md`, wires the CLI flag through cli-engineer, and adds per-sink
  success/failure counters to `DatastoreImportResult`. Use this skill whenever someone says
  "add a new sink", "add an OTLP / Parquet / warehouse / cloud destination", or "ship a
  codeburn-export sink".
---

# Skill: Add a New Sink

Mechanizes SINK-FR-01 through SINK-FR-05 from
[docs/features/sink-interface-and-codeburn-export.md](../../../docs/features/sink-interface-and-codeburn-export.md)
and the rules in ADR-005 (Sink Interface).

---

## Process

### Step 1: Gather inputs

- `<name>` — kebab-case sink identifier (e.g., `otlp`, `parquet`, `codeburn-export`, `azure-cosmos`).
- Target shape: what the consumer expects (schema, file format, API endpoint, table layout).
- Auth model: env-var credentials, managed identity, no auth (local file).
- Whether this is a cloud sink (then `cloud-integration-engineer` owns it under `src/sinks/cloud/`).

### Step 2: Implement against ADR-005

Create `src/sinks/<name>.ts` (or `src/sinks/cloud/<name>.ts` for cloud sinks):

```ts
import type { Sink, SinkContext, EnrichedEnvelope } from "../schema/sink.js";

export const <camelName>Sink: Sink = {
  name: "<name>",
  async open(ctx: SinkContext) { /* ... */ },
  async write(env: EnrichedEnvelope) { /* ... */ },
  async close() { /* ... */ },
};
```

### Step 3: Validate redaction

Every sink MUST refuse to write an envelope that lacks `metadata.policyHash`. The
`codeburn-export` sink MUST additionally refuse to run if `--no-redact` is set in any production
path (SINK-FR-05).

### Step 4: Wire CLI flags

Propose the flag name to `cli-engineer`. Conventions:

- Enable: `--sink <name>` (repeatable) or `--sink-<name>` for boolean toggle.
- Config: `--sink-<name>-<option>` for sink-specific options.
- Document in `--help` and `README.md` in the same PR.

### Step 5: Result accounting

Extend `DatastoreImportResult.sinks[<name>]` with `{ success: number, failure: number, error?: string }`.
Per-sink failures MUST be isolated — one sink failing must not abort the import pass (SINK-FR-04).

### Step 6: Documentation

Create `docs/sinks/<name>.md` with:

1. Purpose and target consumer.
2. Configuration (CLI flags, config-file shape).
3. Output schema / endpoint contract.
4. Auth model and required secrets.
5. Throughput characteristics (for cloud sinks: include the CLOUD-FR-05 benchmark).
6. For `codeburn-export`: a field-by-field mapping table to codeburn's input schema.

### Step 7: Tests

- Unit tests for the sink's transform logic.
- Integration test that runs the import pass with ≥2 sinks fanning out concurrently.
- Failure-isolation test: one sink throws; other sinks complete; result reports failure correctly.

### Step 8: PR checklist

- [ ] New file under `src/sinks/<name>.ts` (or `src/sinks/cloud/<name>.ts`)
- [ ] Implements ADR-005 `Sink` interface (no parallel API)
- [ ] Refuses envelopes without `metadata.policyHash`
- [ ] CLI flag approved by `cli-engineer` and present in `--help` + `README.md`
- [ ] `DatastoreImportResult.sinks[<name>]` populated
- [ ] `docs/sinks/<name>.md` written (with codeburn mapping if applicable)
- [ ] Multi-sink fan-out integration test green
- [ ] Failure-isolation test green
- [ ] 3-OS CI green; coverage ≥70%

---

## Constraints

- Do not introduce a parallel sink interface. ADR-005 is the only contract.
- No hard-coded credentials. Use env vars or managed identity. Verified by secret scanning.
- Honor REDACT `policyHash` and `retentionClass`.
- Per-sink failure MUST NOT abort other sinks in the same pass.
