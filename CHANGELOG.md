# Changelog

All notable changes to this project will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project will adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
once it reaches v1.0.0. While pre-1.0, minor version bumps may include
breaking changes; we will call them out explicitly here.

## [Unreleased]

### Added

- **Provider-isolated architecture.** Source-specific logic moved out
  of the monolithic `src/index.ts` into per-provider files under
  `src/providers/`:
  - `copilot-session-store` — reads the Copilot CLI SQLite session metadata.
  - `copilot-events-jsonl` — parses per-session `events.jsonl` streams.
  - `vscode-chat-debug` — discovers and parses VS Code GitHub Copilot
    Chat debug logs.
  Each provider has its own quirks doc (`docs/providers/<name>.md`)
  and is registered in a single `BUILTIN_PROVIDERS` tuple. See
  [ADR-002](docs/ADR-002-provider-isolation.md).
- **Copilot model inference from tool-call ID prefixes.** When no
  explicit model is recorded, we now infer the model family
  (`anthropic`, `openai`) from prefixes such as `toolu_*` / `call_*`.
  Inferred values carry `confidence: "heuristic"` and never overwrite
  an explicit model. See [ADR-003](docs/ADR-003-copilot-inference-and-dedup.md).
- **Char-based output-token fallback.** When `outputTokens` is missing
  but a message body is present, we estimate
  `ceil(text.length / 4)`. Mirrors codeburn's pragmatic fix.
- **Per-import-pass deduplication for Copilot events.** Events with
  the same `messageId` (or, when absent, the same
  `interactionId + firstToolCallId + sourceEventType` hash) collapse
  into a single envelope. The new
  `DatastoreImportResult.deduplicatedEvents` counter surfaces how
  many were dropped.
- **`--version` / `-v` flag** on the CLI, sourced from
  `package.json`.
- **Release workflow** (`.github/workflows/release.yml`) that
  publishes to npm on Git tag push.
- **Per-provider quirks docs** under `docs/providers/`:
  `copilot-session-store.md`, `copilot-events-jsonl.md`,
  `vscode-chat-debug.md`.
- **ADR-002 — Provider Isolation Pattern** (accepted).
- **ADR-003 — Copilot Model Inference, Token Fallback, Deduplication**
  (accepted).
- **ADR-004 — Enrichment Pipeline** (design only; implementation
  deferred to Phase 3).
- **ADR-005 — Sink Interface** (design only; implementation deferred
  to Phase 4).
- **ADR-006 — Policy-Based Redaction** (design only; implementation
  deferred to Phase 5).
- **CHANGELOG.md** (this file).

### Changed

- **Repositioned README and PRD** away from "normalized, redacted
  datastore" toward the pipeline / agent positioning: *local-first
  telemetry pipeline for AI coding tools — track every
  Copilot/Claude/Cursor session, redacted by default, queryable,
  warehouse-ready*. Explicit non-goal added: we are not a TUI dashboard.
- **Added "Relationship to codeburn" section** to the README; we are
  a complement (the pipe), not a competitor (the dashboard).
- `src/index.ts` is now a thin orchestrator (~280 LOC) that delegates
  source-specific work to providers. Public API
  (`importCopilotSessionStore`, `summarizeDatastore`,
  `getCopilotSessionRows`) is preserved.

### Deprecated

- *(none yet)*

### Removed

- *(none)*

### Fixed

- *(none)*

### Security

- *(none new this release; redaction-by-default unchanged.)*

---

## [0.1.0] — 2026-05-13

Initial beta release. CLI `import` and `summary` commands; SQLite +
JSONL + VS Code Copilot Chat debug log ingest; append-only JSONL
datastore; regex-based redaction by default; multi-machine
provenance; cross-platform (macOS / Linux / Windows).
