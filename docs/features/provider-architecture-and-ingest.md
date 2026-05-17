# Feature: Provider Architecture & Ingest

## Traceability

| Feature ID | Original PRD ID | Description |
|-----------|----------------|-------------|
| PROV-US-01 | US-01 | Import session events from local store and VS Code logs |
| PROV-FR-01 | FR-01 | Import from `~/.copilot/session-store.db` (SQLite) |
| PROV-FR-02 | FR-02 | Import JSONL events from `~/.copilot/session-state/<id>/events.jsonl` |
| PROV-FR-03 | FR-03 | Import VS Code GitHub Copilot Chat debug logs |
| PROV-FR-04 | FR-04 | Filter by `--ids` |
| PROV-FR-05 | FR-05 | Multi-machine tagging (`--machine-id`, `--user-id`) |
| PROV-FR-06 | FR-07 | Batch import with progress reporting |
| PROV-FR-07 | FR-08 | Support streaming import to backend (handoff to STREAM) |
| PROV-FR-08 | FR-09 | Normalize all sources to `EventEnvelope` + `EventFacets` |
| PROV-FR-09 | FR-10 | Validate via Zod; skip invalid with logging |
| PROV-FR-10 | FR-11 | Extract facets (models, tokens, tools, files, agents, debug) |
| PROV-FR-11 | FR-12 | Preserve source event type and version |
| PROV-FR-12 | FR-13 | Schema versioning + compat checks |
| PROV-FR-13 | FR-08a | Provider isolation: one file per source in `src/providers/` |
| PROV-FR-14 | FR-08b | Per-provider quirks doc under `docs/providers/<name>.md` |
| PROV-FR-15 | FR-08c | Registration via `BUILTIN_PROVIDERS` (one import + one entry) |
| PROV-FR-16 | FR-08d | Copilot model inference from tool-call ID prefixes |
| PROV-FR-17 | FR-08e | Char-based output-token fallback |
| PROV-FR-18 | FR-08f | Per-pass dedup + `deduplicatedEvents` counter |
| PROV-FR-19 | FR-39 | Per-provider quirks docs cross-reference codeburn parsers |

**Product Vision:** [docs/product-vision.md](../product-vision.md)
**Original PRD:** [docs/PRD.md](../PRD.md)
**Related ADRs:** ADR-002 (Provider Isolation), ADR-003 (Copilot Inference/Dedup)

---

## 1. Feature Overview

**Feature Name:** Provider Architecture & Ingest
**ID Prefix:** PROV
**Summary:** The foundation feature. Defines the `Provider` interface, the
`BUILTIN_PROVIDERS` registry, the thin orchestrator, and the three v0.2.0
built-in providers (`copilot-session-store`, `copilot-events-jsonl`,
`vscode-chat-debug`). Owns schema validation and facet extraction. Expands
in Phase 2 with Claude Code, Cursor, and Codex providers — each shipped
with its own quirks doc cross-referencing codeburn.
**Dependencies:** None (foundation)
**Priority:** Must

---

## 2. User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|-------------|-----------|----------|
| PROV-US-01 | Copilot Developer | import session events from my local store and VS Code logs | I can analyze Copilot behavior without external dependencies | Must |
| PROV-US-02 | Ops/Data Analyst | add a new AI-coding source (Claude Code, Cursor, Codex) without touching the orchestrator | I can onboard providers safely and incrementally | Should |

---

## 3. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| PROV-FR-01 | Import session metadata and events from `~/.copilot/session-store.db` (SQLite) | Must |
| PROV-FR-02 | Import session events from JSONL files in `~/.copilot/session-state/<session-id>/events.jsonl` | Must |
| PROV-FR-03 | Import VS Code GitHub Copilot Chat debug logs from `logs/` and `User/workspaceStorage/**/GitHub.copilot-chat/**/` | Must |
| PROV-FR-04 | Filter imported sessions by ID (comma-separated `--ids`) | Must |
| PROV-FR-05 | Support multi-machine ingestion; tag events with `--machine-id` and optional `--user-id` | Must |
| PROV-FR-06 | Batch import for bulk datastores (100K+ events) with progress reporting | Should |
| PROV-FR-07 | Surface a streaming-friendly import path to be consumed by STREAM | Should |
| PROV-FR-08 | Normalize all source events to a consistent `EventEnvelope` + `EventFacets` schema | Must |
| PROV-FR-09 | Validate events using Zod; skip invalid events with structured logging | Must |
| PROV-FR-10 | Extract facets from event data: models, tokens, tools, files, agents, debug signals | Must |
| PROV-FR-11 | Preserve source event type and version for traceability | Must |
| PROV-FR-12 | Support schema versioning (current: 1.0.0); allow forward/backward compatibility checks | Should |
| PROV-FR-13 | Each source MUST live in its own file under `src/providers/` implementing the `Provider` interface; the orchestrator MUST NOT contain source-specific parsing logic | Must |
| PROV-FR-14 | Every provider MUST have a quirks doc under `docs/providers/<name>.md` | Must |
| PROV-FR-15 | New providers MUST be added via `BUILTIN_PROVIDERS` (single import + single registry entry) with no orchestrator changes | Must |
| PROV-FR-16 | Copilot events MUST infer model family from tool-call ID prefixes (`toolu_*` → `anthropic`, `call_*` → `openai`) when no explicit model is present; inferred values MUST carry `confidence: "heuristic"` and MUST NOT overwrite explicit values | Must |
| PROV-FR-17 | When `outputTokens` is missing but message body text is present, the importer MUST estimate `ceil(text.length / 4)` and mark the value as a fallback | Must |
| PROV-FR-18 | Copilot events MUST be deduplicated within a single import pass by `messageId`, falling back to `interactionId + firstToolCallId + sourceEventType` hash; count exposed as `DatastoreImportResult.deduplicatedEvents` | Must |
| PROV-FR-19 | Per-provider quirks docs MUST cross-reference codeburn's equivalent parser when one exists, noting where we diverge and why (codeburn alignment, Phase 2) | Must |

---

## 4. UI / Interaction Design

CLI surface (existing, extended per phase):

```
copilot-trace-importer import \
  --db-path <path> \
  --datastore <path> \
  [--ids <csv>] \
  [--machine-id <id>] [--user-id <id>] \
  [--include-vscode-chat-debug] [--vscode-chat-debug-path <path>] \
  [--no-session-store] \
  [--include-raw-payload]
```

Import result (JSON):
```json
{
  "importedEvents": 1234,
  "deduplicatedEvents": 17,
  "sessions": ["..."],
  "machines": ["..."],
  "providers": ["copilot-session-store", "copilot-events-jsonl", "vscode-chat-debug"],
  "durationMs": 4821
}
```

---

## 5. Implementation Tasks

### Phase 1: Stabilize v0.2.0 (Done / In Progress)
- [x] Extract source-specific logic into `src/providers/`
- [x] Define `Provider` interface and `BUILTIN_PROVIDERS` registry
- [x] Implement model inference, char-based token fallback, per-pass dedup
- [x] Write `docs/providers/{copilot-session-store,copilot-events-jsonl,vscode-chat-debug}.md`
- [x] Author ADR-002 and ADR-003
- [ ] Expand provider-specific unit tests under `test/providers/`
- [ ] Document schema stability guarantees

### Phase 2: Additional Providers (v0.3)
- [ ] Implement `claude-code` provider
- [ ] Implement `cursor` provider
- [ ] Implement `codex` provider
- [ ] For each new provider: write quirks doc that cross-references codeburn's equivalent parser (PROV-FR-19)
- [ ] Add a plugin hook system so external providers can register at runtime

---

## 6. Testing Strategy

| Level | Scope | Approach |
|-------|-------|----------|
| Unit Tests | Each provider's parser; model inference; token fallback; dedup | Vitest fixtures per provider |
| Integration Tests | Orchestrator → provider fan-out → JSONL output | Vitest + temp DB + file fixtures |
| Cross-Platform | Windows path handling for VS Code log discovery | GitHub Actions 3-OS matrix |

Key test scenarios:
1. Import from SQLite with valid session data
2. Import from JSONL with mixed valid/invalid events
3. Import VS Code debug logs (Linux/macOS/Windows paths)
4. Filter by session ID (single and multiple)
5. Multi-machine import with `--machine-id` tags
6. Model inference: `toolu_*` infers `anthropic`; `call_*` infers `openai`; explicit model wins
7. Token fallback: missing `outputTokens` + message body → `ceil(len/4)` with fallback flag
8. Dedup: duplicate `messageId` events collapse; `deduplicatedEvents` counter is correct
9. Adding a new provider does not require changes to `src/index.ts`

---

## 7. Acceptance Criteria

1. All current providers (`copilot-session-store`, `copilot-events-jsonl`, `vscode-chat-debug`) pass their per-provider tests on macOS, Linux, and Windows
2. `src/index.ts` contains no source-specific parsing logic (verified by inspection / lint rule)
3. Adding the Phase 2 Claude Code / Cursor / Codex providers required only: one new file under `src/providers/`, one new quirks doc under `docs/providers/`, one new entry in `BUILTIN_PROVIDERS`
4. Each new Phase 2 provider's quirks doc explicitly cross-references codeburn's equivalent parser (codeburn alignment)
5. Code coverage ≥70% across provider modules
6. `DatastoreImportResult.deduplicatedEvents` is reported on every import

---

## 8. Open Questions

| # | Question | Default Assumption |
|---|----------|--------------------|
| 1 | Should Phase 2 providers be opt-in (off by default) until each has a tagged release? | Yes — gate behind `--providers <csv>` until each has shipped a stable parser |
| 2 | How do we version the `Provider` interface as we add Phase 2 sources? | SemVer the interface; deprecate fields for one minor before removal |
