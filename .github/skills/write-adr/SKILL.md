---
name: write-adr
description: >
  Author a new Architecture Decision Record (ADR) or amend an existing one in
  `docs/ADR-NNN-<slug>.md`, following the project's existing `docs/ADR-TEMPLATE.md`. Use this
  skill whenever a change introduces a public-contract breakage, a new architectural pattern,
  or a schema/format bump: new provider hook, sink interface change, new redaction policy
  preset, datastore format change, plugin manifest format change, etc.
---

# Skill: Write or Amend an ADR

The project tracks architectural decisions in `docs/ADR-NNN-<slug>.md`. ADRs 001–006 exist; the
template is `docs/ADR-TEMPLATE.md`. ADRs are immutable once accepted — amendments are made by
publishing a new ADR that supersedes the old one and adding a `Status: Superseded by <ADR-NNN>`
link to the older record.

---

## Process

### Step 1: Decide: new ADR, or amendment?

- **New ADR** — for any new decision (new contract, new pattern, new format).
- **Supersede an existing ADR** — when a previously accepted decision is being replaced. Do not edit the old ADR's content; only add the `Superseded by` link to its `Status`.

### Step 2: Pick the next ADR number

```
ls docs/ADR-*.md | sort | tail -1
```

Take the next monotonic number. Name the file `docs/ADR-NNN-<short-slug>.md`.

### Step 3: Copy the template

Start from `docs/ADR-TEMPLATE.md`. Fill in every section. Required sections (per the existing
ADRs):

- **Title** — `# ADR-NNN: <Decision in one phrase>`
- **Status** — `Proposed` initially; `Accepted` after review; `Superseded by ADR-MMM` if replaced.
- **Date** — ISO-8601 (YYYY-MM-DD).
- **Context** — What forced the decision. Link the relevant PRD section, feature file, and FR ids.
- **Decision** — The chosen approach in clear, declarative language.
- **Consequences** — Positive, negative, and neutral consequences. Be honest about the negatives.
- **Alternatives Considered** — At least two, with the reason each was rejected.
- **References** — Links to: feature file(s), prior ADRs, external standards (OTel, GDPR clauses), codeburn parsers when relevant.

### Step 4: Cross-link from the affected feature file(s)

In each feature file affected by the decision, add the new ADR to the **Related ADRs** line in
the header so future readers find it.

### Step 5: Coordinate the release

- Public-contract changes (envelope schema, on-disk format, sink interface, manifest format) require a `schemaVersion` / format bump and a CHANGELOG entry. Coordinate with `release-manager`.
- If the ADR supersedes an existing one, edit only the old ADR's `Status` line to add the supersession link — nothing else.

### Step 6: Open the PR

The PR description must:

- Link the ADR file.
- Summarize the decision in 2–3 sentences.
- Call out which agents and which feature files are affected.
- Note whether a schema/format bump is required and whether `release-manager` has been looped in.

### Step 7: Accept the ADR

Once the PR is merged with the ADR at `Status: Proposed`, the owning agent flips it to
`Status: Accepted` in a follow-up PR (or the same PR if review has signed off).

---

## Constraints

- ADRs are immutable after `Accepted` except for adding a `Superseded by` link to `Status`.
- ADR numbers are monotonic; never reuse a number.
- Every ADR cites at least one feature file FR or PRD section in **Context** / **References**.
- Schema / format / interface changes ALWAYS get an ADR. No exceptions.
- The ADR template (`docs/ADR-TEMPLATE.md`) is the canonical structure — do not invent sections.
