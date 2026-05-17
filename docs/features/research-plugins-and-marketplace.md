# Feature: Research Plugins & Marketplace

## Traceability

| Feature ID | Original PRD ID | Description |
|-----------|----------------|-------------|
| PLUGIN-US-01 | US-05 | Export anonymized session data with configurable facets |
| PLUGIN-US-02 | US-07 | Install plugins for custom event analysis |
| PLUGIN-FR-01 | FR-45 | Community marketplace for redaction policies and analyzers, including codeburn-compatible bundles |

**Product Vision:** [docs/product-vision.md](../product-vision.md)
**Original PRD:** [docs/PRD.md](../PRD.md)

---

## 1. Feature Overview

**Feature Name:** Research Plugins & Marketplace
**ID Prefix:** PLUGIN
**Summary:** Extension points across the pipeline (custom facet extractors,
custom enrichers, custom analyzers, custom redaction patterns) plus a
**community marketplace** for sharing redaction policies and analyzer
bundles. The marketplace explicitly accepts **codeburn-compatible bundles**
(Phase 7 codeburn-alignment commitment, PRD §14.8 FR-45) so the community
can publish codeburn-style insights without re-implementing the pipeline.
**Dependencies:** PROV, ENRICH, REDACT
**Priority:** Could

---

## 2. User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|-------------|-----------|----------|
| PLUGIN-US-01 | Researcher | export anonymized session data with configurable facets | I can publish findings without exposing user details | Could |
| PLUGIN-US-02 | Ops Engineer | install plugins for custom event analysis | I can extend the system for domain-specific needs | Could |
| PLUGIN-US-03 | Community contributor | publish a codeburn-compatible analyzer / redaction-policy bundle | others can use it without re-deriving the pipeline | Could |

---

## 3. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| PLUGIN-FR-01 | Plugin hook system for: custom facet extractors (PROV), custom enrichers (ENRICH), custom analyzers (ANALYZE), custom redaction patterns/presets (REDACT) | Could |
| PLUGIN-FR-02 | Plugin manifest with: name, version, hook type, declared inputs/outputs, declared compatibility with our schema version | Could |
| PLUGIN-FR-03 | Anonymized export: redacted JSONL + facet selection + optional further anonymization (hash/tokenize) for sharing | Could |
| PLUGIN-FR-04 | Community marketplace (catalog + install command) for redaction policies and analyzer bundles, **explicitly accepting codeburn-compatible bundles** (codeburn alignment, Phase 7) | Could |
| PLUGIN-FR-05 | Marketplace bundles MUST declare which redaction policy they assume and which schema version they target | Could |
| PLUGIN-FR-06 | A documented process for offering upstream-friendly parser fixes back to codeburn where they apply (codeburn alignment, Phase 7) | Should |

---

## 4. UI / Interaction Design

```
copilot-trace-importer plugins install <name>[@<version>]
copilot-trace-importer plugins list
copilot-trace-importer plugins enable <name>
copilot-trace-importer export anonymized --datastore <path> --facets <csv> --out <path>
```

Marketplace browser available in WEBUI.

---

## 5. Implementation Tasks

### Phase 7: v1.0
- [ ] Define plugin manifest schema
- [ ] Implement hook registration for facets / enrichers / analyzers / redaction
- [ ] Build the marketplace catalog (initially: a curated GitHub-hosted JSON index)
- [ ] CLI `plugins` and `export anonymized` subcommands
- [ ] Document codeburn-compatibility contract for bundles (PLUGIN-FR-04)
- [ ] Document upstream contribution process to codeburn (PLUGIN-FR-06)

---

## 6. Testing Strategy

| Level | Scope | Approach |
|-------|-------|----------|
| Unit Tests | Plugin loader; manifest validation | Vitest |
| Integration Tests | Loaded plugin runs in pipeline as expected | Vitest |
| Security | Plugins run with reduced privileges; declared inputs/outputs enforced | Vitest |

Key test scenarios:
1. Manifest with mismatched schema version is rejected with a clear error
2. Analyzer plugin produces output via the same shape as built-ins
3. Anonymized export drops/hashes the documented fields
4. Marketplace install verifies signature/checksum before activation

---

## 7. Acceptance Criteria

1. At least one third-party-style plugin (built as a sample) loads and runs end-to-end
2. Marketplace catalog has documented contribution guidelines, including a codeburn-compatibility track
3. Anonymized export produces data that satisfies a documented threat model
4. PRD §14.8 row for Phase 7 (FR-45) is marked Done

---

## 8. Open Questions

| # | Question | Default Assumption |
|---|----------|--------------------|
| 1 | Should plugins run in-process or sandboxed? | Start in-process with capability declarations; consider sandboxing in v1.x if needed |
| 2 | How do we signal "codeburn-compatible" in the catalog? | A `codeburn-compatible: true` flag in the bundle manifest + a curated tag in the catalog index |
| 3 | Do we run a SaaS marketplace, or stay GitHub-hosted? | GitHub-hosted JSON index initially; revisit if community traction warrants |
