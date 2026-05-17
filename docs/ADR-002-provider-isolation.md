# ADR-002: Provider Isolation Pattern

**Status:** Accepted

**Date:** 2026-05-17

**Deciders:** McFuzzySquirrel

**Affected Components:** `src/providers/`, `src/index.ts` (orchestrator),
per-provider tests under `test/providers/`

---

## Context

v0.1.0 grew the importer as a single 675-line `src/index.ts` that
combined SQLite session-store reading, per-session events.jsonl parsing,
VS Code debug log discovery, normalization, redaction wiring, and
datastore writing. As we plan to add Claude Code, Cursor, and Codex
providers in Phase 2, that monolith becomes a liability:

- Each new source brings its own quirks (model-inference rules,
  token-count fallbacks, dedup semantics) that should not bleed into
  other sources' parsers.
- A single change to the orchestrator can regress every provider at once.
- Fixtures, regression tests, and documentation are tied to specific
  sources, not to the orchestrator.

The maintainers of [codeburn](https://github.com/getagentseal/codeburn)
made the same call early — their `src/providers/<tool>.ts` layout plus
per-provider docs (`docs/providers/<tool>.md`) and per-provider tests
(`tests/providers/<tool>.test.ts`) has scaled to 19+ providers. Their
own Copilot doc explicitly says: *"the two parsers share little code on
purpose; do not unify them unless you understand both formats."* That
is the wisdom worth copying.

## Decision

Adopt a strict provider-isolation pattern:

1. **One file per source** under `src/providers/`. Each file owns its
   discovery, parsing, normalization, and per-source heuristics.
2. **A small `Provider` interface** (`src/providers/types.ts`) that
   every provider implements: `name`, `description`, `import(options, ctx) → ProviderImportResult`.
3. **A registry** (`src/providers/index.ts → BUILTIN_PROVIDERS`) lists
   built-in providers; adding a new provider is a single import + a
   single entry.
4. **A thin orchestrator** (`src/index.ts`) builds the shared
   `ProviderImportContext`, calls each provider, and appends the
   returned envelopes to the JSONL datastore. The orchestrator owns
   no source-specific logic.
5. **Parsers may NOT be unified across sources** even when they look
   similar. Unify the *output schema* (`src/schema/`), not the *input
   parsers*.
6. **Each provider must ship** a quirks doc (`docs/providers/<name>.md`)
   and a fixture-driven test (`test/providers/<name>.test.ts`).

## Rationale

### Why one file per source?

- Quirks stay quarantined. A change to Cursor parsing cannot regress
  Copilot.
- The blast radius of "support for source X is broken on Windows" is
  visible at a glance from the file tree.
- Reviewers can read a single self-contained file end-to-end.

### Why a registry instead of dynamic discovery?

- Static typing: the registry is a typed tuple, so the orchestrator
  knows exactly which providers exist at compile time.
- Reproducibility: behavior on a fresh checkout is deterministic; no
  filesystem scan can change which providers load.
- Phase 6 (analyzer SDK) will add a *separate* npm-installable plugin
  surface for third-party analyzers; provider authorship will remain
  in-tree for now to keep the schema contract tight.

### Why a uniform `Provider` interface, when the inputs differ so much?

- The orchestrator should not know whether a provider reads from SQLite,
  JSONL, log files, or a future binary format. It needs only the
  emitted envelopes and stats.
- A uniform interface lets us add cross-cutting concerns later
  (enrichment, multi-sink emit, watch-mode streaming) without touching
  any individual provider.

### Why NOT unify parsers across sources?

- Codeburn's hard-won experience says they share less than they look
  like they share, and the cost of an over-unified parser is bugs that
  silently affect every source at once.
- Schema versioning is the right place to enforce consistency.
  Providers must produce envelopes that pass Zod validation; the *how*
  is their business.

## Consequences

### Positive

- ✅ Adding a new provider is a one-file change plus a doc + a test.
- ✅ Source-specific heuristics (model inference, token fallback,
  dedup) live with the source they apply to, not in a global hot path.
- ✅ Per-provider docs become a natural place to capture quirks the
  community discovers in the wild.
- ✅ Coverage and review effort scale linearly with provider count
  rather than super-linearly (as they would with a shared parser).

### Negative

- ❌ Some helper code (UUID generation, time-zone handling, JSON-line
  splitting) is duplicated across providers. We accept this; pulling
  it into a shared helper is fine, **but** any helper that grows
  source-specific branches should be inlined back.
- ❌ Orchestrator-level features (e.g. global dedup across providers,
  a single `watch` mode) require explicit plumbing through the
  registry rather than implicit sharing.

### Mitigation

- A small `copilot-shared.ts` module exists for the Copilot-family
  providers only. If/when we need cross-vendor shared helpers, they
  go into `src/providers/_shared/` (not `_shared.ts` next to one
  vendor) to make the cross-cutting nature explicit.

## References

- codeburn `src/providers/` (https://github.com/getagentseal/codeburn/tree/main/src/providers)
- codeburn `docs/providers/copilot.md` — the "do not unify" guidance
- ADR-001 (Append-Only JSONL Datastore Format)
- ADR-003 (Copilot model inference, token fallback, dedup)
