# ADR-006: Policy-Based Redaction (Design Only — Implementation Deferred)

**Status:** Proposed (design accepted; implementation deferred to Phase 5)

**Date:** 2026-05-17

**Deciders:** McFuzzySquirrel

**Affected Components:** `src/redaction/`, future `src/redaction/policy.ts`,
future `prune` CLI command.

---

## Context

Today redaction is a fixed regex list applied to every event. That is
fine for the default "do something safe", but our differentiation
against tools like codeburn rests on a *policy-driven, auditable*
redaction layer that regulated buyers can review and configure.

Real organizations want:

- **Tiered policies** (`strict | moderate | permissive`) selectable
  at import time and recorded in the per-event `privacy` metadata.
- **Custom rules** loaded from a config file (e.g. organization-specific
  internal-system identifiers, PII patterns, project codenames).
- **A redaction report** that lists, per pattern and per session, how
  many redactions occurred — without echoing any redacted value.
- **Retention enforcement**: a `prune` command that removes events
  past their per-event `retention` deadline.
- **GDPR/subject workflows**: export-by-user, delete-by-session, with
  an audit trail.

## Decision (design)

Introduce a policy object loaded from `~/.config/copilot-trace-importer/redaction.json`
(or a path given via `--redaction-policy`) with shape:

```typescript
interface RedactionPolicy {
  tier: "strict" | "moderate" | "permissive";
  /** Built-in pattern groups to enable; default = all. */
  builtinPatterns: Array<"github" | "openai" | "slack" | "aws" | "generic" | "url-creds">;
  /** Additional named patterns from this org. */
  customPatterns: Array<{
    name: string;          // appears in the redaction report; never echoes the value
    pattern: string;       // regex, validated at load
    replacement: string;   // e.g. "[REDACTED_INTERNAL_ID]"
  }>;
  /** Per-tier behavior for prompt bodies (already exists in `RedactionOptions`). */
  prompts: { mode: "drop" | "placeholder" };
}
```

Add three CLI commands behind the existing `bin/ingest.ts`:

- `prune --datastore <path> [--dry-run]` — remove events whose
  retention deadline has passed (uses the existing `retention.ts`).
- `redaction-report --datastore <path>` — emit counts of redactions
  per pattern, per source, per session, with no raw values.
- `gdpr export --user <id>` / `gdpr delete --session <id>` — produce
  an export bundle or rewrite the datastore minus matching events,
  always atomically and always logging the operation.

## Rationale

- Tiers map cleanly to how compliance teams think about data ("strict
  for prod, moderate for analytics, permissive for debugging on a
  developer's own box").
- Custom patterns belong in config, not code, so an organization can
  add patterns without rebuilding the package.
- The redaction report is the artifact compliance reviews actually
  want; without it, "redaction is enabled" is unfalsifiable.

## Consequences

### Positive

- Concrete differentiator vs. codeburn that maps to regulated-buyer
  needs.
- All four pieces (tiers, custom rules, report, prune) compose; none
  requires the others to ship first.

### Negative

- More configuration surface to test, document, and version.
- A buggy custom regex can over-redact and silently destroy data —
  policy load must validate regexes and the redaction report must
  surface counts so over-redaction is detectable.

## Status & Scope

Design only. Current implementation continues to use the fixed pattern
list in `src/redaction/patterns.ts`; that list will become the
`"strict"` tier default when this ADR is implemented.

## References

- `src/redaction/index.ts`, `src/redaction/patterns.ts`,
  `src/redaction/retention.ts`
- PRD §10 (Security and Privacy)
- ADR-001 (Append-Only JSONL — relevant to atomic GDPR delete)
