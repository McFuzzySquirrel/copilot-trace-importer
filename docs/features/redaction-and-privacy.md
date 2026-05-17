# Feature: Redaction & Privacy

## Traceability

| Feature ID | Original PRD ID | Description |
|-----------|----------------|-------------|
| REDACT-US-01 | US-02 | Configure redaction policies before import |
| REDACT-FR-01 | FR-14 | Redact sensitive patterns |
| REDACT-FR-02 | FR-15 | Redaction applied before persistence (no opt-out at import) |
| REDACT-FR-03 | FR-16 | `--include-raw-payload` stores redacted raw payloads (opt-in) |
| REDACT-FR-04 | FR-17 | Redaction policy presets (strict/moderate/permissive) |
| REDACT-FR-05 | FR-18 | Field-level anonymization per policy |
| REDACT-FR-06 | FR-19 | Data retention policy enforcement |
| REDACT-FR-07 | FR-43 | Ship policy-based redaction (ADR-006) so codeburn can safely consume our data |

**Product Vision:** [docs/product-vision.md](../product-vision.md)
**Original PRD:** [docs/PRD.md](../PRD.md)
**Related ADRs:** ADR-006 (Policy-Based Redaction)

---

## 1. Feature Overview

**Feature Name:** Redaction & Privacy
**ID Prefix:** REDACT
**Summary:** Owns the redaction engine, the regex pattern catalogue, the
retention model, and (Phase 5) the policy-preset system from ADR-006. All
envelopes pass through redaction *before* persistence; users cannot disable
it at import time outside testing. The Phase 5 policy presets are what make
this datastore safe to feed to codeburn-style consumers in regulated orgs.
**Dependencies:** PROV
**Priority:** Must

---

## 2. User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|-------------|-----------|----------|
| REDACT-US-01 | Data Analyst | configure redaction policies before import | I can balance privacy with utility depending on data governance rules | Should |

---

## 3. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REDACT-FR-01 | Redact sensitive patterns (GitHub tokens, API keys, AWS keys, passwords, URLs with credentials) | Must |
| REDACT-FR-02 | Redaction is applied before persistence; user cannot opt-out at import time (except `--no-redact` for tests) | Must |
| REDACT-FR-03 | Support `--include-raw-payload` to store *redacted* raw payloads (opt-in) | Must |
| REDACT-FR-04 | Configuration for redaction policy presets (strict/moderate/permissive); apply at import time (ADR-006) | Should |
| REDACT-FR-05 | Support field-level anonymization (paths, email, hostnames) per policy | Should |
| REDACT-FR-06 | Data retention policy enforcement (ephemeral, session, standard, extended) | Should |
| REDACT-FR-07 | Ship strict / moderate / permissive presets so codeburn-style developer dashboards can run on data already redacted to org policy (codeburn alignment, Phase 5) | Should |

---

## 4. UI / Interaction Design

CLI flags:
```
--no-redact                   Disable redaction (NOT recommended; tests only)
--include-raw-payload         Store redacted raw payloads (opt-in)
--redaction-policy <preset>   strict | moderate | permissive  (Phase 5)
--redaction-config <path>     Custom policy file (Phase 5)
```

Policy export (`src/redaction/export-config.ts`) emits the active policy +
pattern list for audit.

---

## 5. Implementation Tasks

### Phase 1: Stabilize current redaction
- [x] Default regex pattern catalogue (`src/redaction/patterns.ts`)
- [x] Retention model (`src/redaction/retention.ts`)
- [x] Policy config export (`src/redaction/export-config.ts`)
- [ ] Expand unit tests for redaction patterns
- [ ] Quarterly pattern-review process documented

### Phase 5: Policy-Based Redaction (v0.8) — ADR-006
- [ ] Implement strict / moderate / permissive presets
- [ ] Implement field-level anonymization (paths, emails, hostnames)
- [ ] Implement retention enforcement (ephemeral / session / standard / extended)
- [ ] Add `--redaction-policy` and `--redaction-config` flags
- [ ] Document codeburn-safe preset (codeburn alignment, FR-43)

---

## 6. Testing Strategy

| Level | Scope | Approach |
|-------|-------|----------|
| Unit Tests | Each regex pattern + each preset | Vitest with known-credential fixtures |
| Integration Tests | End-to-end import with redaction enabled/disabled | Vitest + temp datastore |
| Data Validation | 100% of patterns tested against known examples | Regex pattern testing + manual inspection |

Key test scenarios:
1. GitHub tokens, API keys, AWS keys, passwords are redacted
2. Redaction is applied before persistence (datastore contains no raw credentials)
3. `--include-raw-payload` stores redacted-but-otherwise-complete payloads
4. Each preset (strict/moderate/permissive) applies the correct set of patterns
5. Custom policy file overrides preset behavior
6. Retention tiers produce the expected TTL metadata on envelopes

---

## 7. Acceptance Criteria

1. No credentials, API keys, or tokens are persisted to the datastore in default config (SP-01)
2. All built-in patterns have ≥1 positive and ≥1 negative test
3. Phase 5: at least the three named presets (strict/moderate/permissive) are documented and tested
4. Phase 5: the "moderate" preset is documented as codeburn-safe (suitable for feeding codeburn-style consumers in regulated orgs)
5. Audit export emits the active policy + pattern hash for compliance review

---

## 8. Open Questions

| # | Question | Default Assumption |
|---|----------|--------------------|
| 1 | Should custom redaction policies be user-supplied or pre-built? | Both; start with strict built-in, allow customization in v0.5+ |
| 2 | Do we ship a separate codeburn-specific preset, or is "moderate" sufficient? | Start with "moderate" as the recommended codeburn-safe preset; revisit if community asks |
