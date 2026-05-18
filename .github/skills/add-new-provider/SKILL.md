---
name: add-new-provider
description: >
  Scaffold a new ingest provider for the copilot-trace-importer pipeline (e.g., Claude Code,
  Cursor, Codex). Creates the provider source file under `src/providers/`, the quirks doc under
  `docs/providers/<name>.md`, the registry entry in `BUILTIN_PROVIDERS`, and the unit-test
  fixture layout — all without touching the orchestrator. Use this skill whenever someone says
  "add a new provider" or "add support for <tool> as an ingest source".
---

# Skill: Add a New Ingest Provider

Mechanizes PROV-FR-13, PROV-FR-14, PROV-FR-15, and PROV-FR-19 from
[docs/features/provider-architecture-and-ingest.md](../../../docs/features/provider-architecture-and-ingest.md)
and the rules in ADR-002 (Provider Isolation). The result is a provider that ships with one file
of code, one quirks doc, one registry entry, no orchestrator changes — and a quirks doc that
explicitly cross-references the codeburn equivalent parser.

---

## Process

### Step 1: Gather inputs

- `<name>` — kebab-case provider identifier (e.g., `claude-code`, `cursor`, `codex`).
- Source location on disk (path glob the provider scans).
- One or two representative raw event samples (sanitized — no real credentials).
- Link to the codeburn equivalent parser if one exists.

### Step 2: Scaffold the source file

Create `src/providers/<name>.ts`:

```ts
import type { Provider, ProviderImportContext } from "../schema/provider.js";

export const <camelName>Provider: Provider = {
  name: "<name>",
  // Discovery: which paths this provider scans
  discover(ctx: ProviderImportContext) { /* ... */ },
  // Parse: raw → EventEnvelope + EventFacets (use Zod from src/schema/)
  async *parse(ctx) { /* yield envelopes */ },
};
```

The file MUST NOT import from `src/index.ts` or any other provider. All shared types come from
`src/schema/`.

### Step 3: Register in `BUILTIN_PROVIDERS`

Open `src/providers/index.ts` (or wherever the registry lives). Add **exactly one** import line
and **exactly one** registry entry. No other edits.

### Step 4: Write the quirks doc

Create `docs/providers/<name>.md`. Required sections:

1. **Source paths** — where the data lives on macOS / Linux / Windows.
2. **Raw event shape** — a sanitized sample and the field mapping to `EventEnvelope` + `EventFacets`.
3. **Quirks** — anything weird: missing fields, encoding oddities, timezone assumptions, dedup keys.
4. **Heuristics** — any inference (model family, token fallback) and the `confidence` level used.
5. **Codeburn equivalent** *(mandatory per PROV-FR-19)* — link to codeburn's parser, list field-by-field divergences, explain why.

### Step 5: Add tests

Create `test/providers/<name>.test.ts` with at least:

- One fixture per documented quirk.
- A negative test proving invalid events are skipped (not thrown) and logged.
- A cross-platform path-discovery test (mock fs).

Coverage for the new file MUST be ≥70% (NF-04).

### Step 6: Verify no orchestrator changes

Run `git diff src/index.ts`. The diff MUST be empty. PROV-FR-13 enforced.

### Step 7: Build and test

```
npm run build
npm test
```

Both MUST pass on the 3-OS CI matrix before opening the PR.

### Step 8: PR checklist

- [ ] New file under `src/providers/<name>.ts`
- [ ] Exactly one new line + one new entry in `BUILTIN_PROVIDERS`
- [ ] New `docs/providers/<name>.md` with codeburn cross-reference
- [ ] New tests under `test/providers/<name>.test.ts`
- [ ] `git diff src/index.ts` is empty
- [ ] Coverage ≥70% on the new file
- [ ] 3-OS CI green

---

## Constraints

- The orchestrator (`src/index.ts`) MUST NOT contain source-specific parsing. If you find yourself editing it, stop and ask `provider-engineer`.
- Inferred fields MUST carry `confidence: "heuristic"` and MUST NEVER overwrite explicit values.
- The quirks doc MUST cross-reference codeburn's equivalent parser (PROV-FR-19).
- No real credentials in fixtures.
