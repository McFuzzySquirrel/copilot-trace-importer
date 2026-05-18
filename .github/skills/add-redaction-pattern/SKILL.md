---
name: add-redaction-pattern
description: >
  Add a new regex-based redaction pattern (or amend an existing one) for the redaction engine
  with the required fixtures, negative-case tests, policy-preset wiring, and source citation.
  Use this skill whenever someone says "add a redaction pattern for <secret type>", "we found
  a credential format the redactor misses", or "extend the strict/moderate/permissive presets".
---

# Skill: Add a Redaction Pattern

Mechanizes REDACT-FR-01, REDACT-FR-04, REDACT-FR-07, and SP-02 / SP-03 from
[docs/features/redaction-and-privacy.md](../../../docs/features/redaction-and-privacy.md) and the
Product Vision security section. Every new pattern ships with a positive fixture, a negative
fixture proving it doesn't over-match, a source citation, and a decision about which policy
presets it applies to.

---

## Process

### Step 1: Gather inputs

- The credential / secret class (e.g., "GitHub fine-grained PAT", "AWS access key ID", "Stripe live key").
- A source citation (vendor format spec, CVE, public blog post). No real-world leaked secrets.
- Which presets apply: `strict` (most things), `moderate`, `permissive` (least). Default: all three.

### Step 2: Compose and test the regex offline

- Build the regex against the format spec.
- Generate synthetic positives that match (looks-like values; never real).
- Generate negatives that *should not* match (similar-looking but valid non-secrets).
- Sanity-check for catastrophic backtracking — keep it linear; profile if uncertain.

### Step 3: Add the pattern

Edit `src/redaction/patterns.ts` (or the equivalent module). Each pattern entry includes:

```ts
{
  id: "<short-id>",
  description: "<one-line>",
  regex: /.../,
  presets: ["strict", "moderate", "permissive"], // pick the subset
  citation: "https://...",                       // SP-03 traceability
}
```

### Step 4: Add fixtures

- Positive fixture in `test/redaction/fixtures/positive/<id>.txt` — at least one matching synthetic.
- Negative fixture in `test/redaction/fixtures/negative/<id>.txt` — at least one similar-looking non-secret.

### Step 5: Add tests

In `test/redaction/patterns.test.ts`:

- `<id>` redacts every line in the positive fixture.
- `<id>` does NOT redact any line in the negative fixture.
- Per-preset test: the pattern is active in exactly the declared presets and inactive elsewhere.

### Step 6: Wire policy presets

If the pattern applies to a preset, ensure the preset's serialized form includes it. The preset
hash will change — this is a policy-version event. Coordinate with `release-manager` for the
CHANGELOG entry.

### Step 7: Update docs

- Append the pattern to `docs/redaction.md` (engine catalogue).
- Append to `docs/redaction-pattern-review.md` (SP-02 quarterly review log) with date and citation.
- If preset hashes changed, update `docs/policies/{strict,moderate,permissive}.md`.

### Step 8: PR checklist

- [ ] Pattern entry in `src/redaction/patterns.ts` with id, description, regex, presets, citation
- [ ] Positive and negative fixtures present
- [ ] Positive / negative / per-preset tests green
- [ ] Performance check: full redaction over 10K-event corpus still within NF-01 (≤30s)
- [ ] `docs/redaction.md` and `docs/redaction-pattern-review.md` updated
- [ ] If preset hash changed: `docs/policies/*.md` updated and CHANGELOG entry coordinated with `release-manager`
- [ ] No real credentials in fixtures (synthetic only)

---

## Constraints

- Fixtures MUST be synthetic. Real credentials — even revoked ones — are never committed.
- Every pattern MUST cite a source (SP-03).
- Every pattern MUST have both a positive and a negative fixture.
- Changes to a preset's pattern set bump the preset hash (a user-visible change) — must appear in CHANGELOG.
- Regex MUST be linear / non-catastrophic. Profile if uncertain.
