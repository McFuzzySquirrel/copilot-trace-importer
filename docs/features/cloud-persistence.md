# Feature: Cloud Persistence

## Traceability

| Feature ID | Original PRD ID | Description |
|-----------|----------------|-------------|
| CLOUD-FR-01 | FR-35 | Azure Cosmos DB: store events with session/machine/date indexes |
| CLOUD-FR-02 | FR-36 | Azure SQL: configurable table schema for event storage and aggregations |
| CLOUD-FR-03 | FR-37 | Azure Fabric: export aggregated metrics for BI dashboards |
| CLOUD-FR-04 | FR-38 | Support for other cloud providers (AWS S3+Athena, GCP BigQuery) |

**Product Vision:** [docs/product-vision.md](../product-vision.md)
**Original PRD:** [docs/PRD.md](../PRD.md)

---

## 1. Feature Overview

**Feature Name:** Cloud Persistence
**ID Prefix:** CLOUD
**Summary:** Implements cloud-side sinks (Azure Cosmos / SQL / Fabric first,
then AWS S3+Athena, GCP BigQuery) on top of the SINK interface. Backend
persistence layer used by STREAM for real-time storage and by analyzers /
warehouse consumers downstream.
**Dependencies:** SINK
**Priority:** Should

---

## 2. User Stories

(Inherits STREAM-US-01 — stream to Azure Fabric — and the warehouse/BI
stories at the product vision level.)

---

## 3. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| CLOUD-FR-01 | Azure Cosmos DB sink: store events with session/machine/date indexes | Should |
| CLOUD-FR-02 | Azure SQL sink: configurable table schema for event storage and aggregations | Should |
| CLOUD-FR-03 | Azure Fabric sink: export aggregated metrics for BI dashboards | Could |
| CLOUD-FR-04 | Support for other cloud providers (AWS S3+Athena, GCP BigQuery) | Could |
| CLOUD-FR-05 | Performance: each cloud sink MUST handle 1M+ events with documented throughput | Should |

---

## 4. UI / Interaction Design

```
--sink cosmos://<account>/<db>/<container>
--sink azuresql://<server>/<db>/<table>
--sink s3://<bucket>/<prefix>?format=parquet
--sink bigquery://<project>/<dataset>/<table>
```

Credentials sourced from standard SDK environment / managed identity — never
embedded in URIs.

---

## 5. Implementation Tasks

### Phase 4: v0.7
- [ ] Azure Cosmos DB sink + schema + indexes
- [ ] Azure SQL sink + aggregation tables
- [ ] Azure Fabric export
- [ ] AWS S3+Athena sink
- [ ] GCP BigQuery sink
- [ ] Scale testing at 1M+ events; document throughput per sink

---

## 6. Testing Strategy

| Level | Scope | Approach |
|-------|-------|----------|
| Unit Tests | URI parsing; payload shaping per sink | Vitest |
| Integration Tests | Each sink against an emulator (Cosmos emulator, SQL container, MinIO, BigQuery emulator) | Vitest + Docker |
| Performance | 1M-event throughput per sink | Benchmark |

Key test scenarios:
1. Each sink writes correctly to its emulator
2. Auth via env / managed identity (no creds in URIs)
3. Sink failures surface in `DatastoreImportResult` per-sink counters
4. Throughput meets the documented per-sink SLA

---

## 7. Acceptance Criteria

1. Each named cloud sink has an end-to-end test against an emulator
2. Throughput SLAs documented and met
3. Multi-region failover documented (PRD risk mitigation)

---

## 8. Open Questions

| # | Question | Default Assumption |
|---|----------|--------------------|
| 1 | Which cloud is priority? | Azure first (PRD); AWS / GCP follow |
| 2 | Do we ship Terraform/Bicep starters? | Optional; in docs only initially |
