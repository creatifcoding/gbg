# V3 Service Architecture - Complete Work Breakdown Structure

**Generated**: 2026-01-29
**Author**: Plan Agent (Val)
**Based On**:
- `thoughts/shared/specs/2026-01-25-v3-service-architecture.md` (23 sections, ~2975 lines)
- `assets/documents/iiot/ADR-0012-event-sourcing-boundaries-iiot.md`
- `thoughts/shared/plans/2026-01-26-es-boundaries-wbs.md` (incorporated as Epics 7-12)
- `thoughts/shared/plans/2026-01-29-eventlog-integration-wbs-final.md` (EventLog expansion)
**Status**: Implementation-Ready

**Note**: This version incorporates EventLog integration details (Epics 7-10 expanded, Epic 25 added) from the EventLog Integration WBS finalized 2026-01-29.

---

## Executive Summary

This WBS covers the **complete v3 IIoT Service Architecture** implementation, synthesizing:
- **AMS v2 patterns**: Entity/Event, CQRS, Effect Cluster, Layer composition
- **IIoT patterns**: Model/Repo, DDL co-location, PostgreSQL extensions
- **ADR-0012 boundaries**: Hybrid ES (decisions get ES, data gets CRUD)
- **EventLog Integration**: 75 events across 11 aggregates for full audit trail

The v3 architecture unifies these into a single, coherent system with:
- Effect Cluster entities as domain actors
- Schema-first design with Model derivation
- Manual repos with decode utilities
- Multiple transports (HTTP, RPC, WebSocket)
- PostgreSQL-first with extensions (TimescaleDB, AGE)
- Event sourcing for decision-critical domains

### Scope Overview

| Category | Epics | Story Points |
|----------|-------|--------------|
| **Foundation** (Schemas, Repos, Infrastructure) | 1-6 | 47 |
| **Event Sourcing Boundaries** (with EventLog integration) | 7-12 | 76 |
| **Entity & Service Layer** | 13-16 | 42 |
| **RPC & HTTP Handlers** | 17-18 | 26 |
| **Stream Processing & Real-time** | 19-20 | 21 |
| **Migration & Integration** | 21-22 | 26 |
| **Documentation & DX** | 23-24 | 16 |
| **Regulatory Compliance** (NEW) | 25 | 13 |
| **Total** | **25 Epics** | **~267 SP** |

**Estimated Duration**: 11-15 sprints (5.5-7.5 months)

### Change Summary vs Original WBS

| Metric | Baseline | Updated | Delta |
|--------|----------|---------|-------|
| Epics | 24 | 25 | +1 |
| Story Points | 236 | 267 | +31 |
| Sprints | 10-14 | 11-15 | +1 |
| Duration | 5-7 months | 5.5-7.5 months | +0.5 months |

---

## Critical Path

```
                              ┌──────────────────────────────────────────────────────────────┐
                              │                    UPDATED CRITICAL PATH                      │
                              └──────────────────────────────────────────────────────────────┘

Epic 1 (Schemas) ──┬──> Epic 2 (Models) ──> Epic 3 (DDL) ──> Epic 4 (Repos)
                   │                                              │
                   │                                              v
                   │                               Epic 7 (ES Infrastructure)
                   │                                     │ EL-1: IIoTEventLog
                   │                                     │
                   v                                     v
              Epic 5 (Errors) ───────────────> Epic 8 (Alarm ES Migration)
                                                     │ EL-2: 10 Alarm Events
                                                     │
                              ┌───────────────────────┼───────────────────────┐
                              │                       │                       │
                              v                       v                       v
                    Epic 9 (Work Order)    Epic 10 (Equipment State)   Epic 11 (Non-ES)
                    EL-3: 46 events        EL-4: 6 events
                              │                       │                       │
                              └───────────────────────┼───────────────────────┘
                                                      │
                                                      v
                                            Epic 12 (ES Testing)
                                                      │
                                                      v
                                           ┌─────────────────────┐
                                           │ Epic 25 (NEW)       │
                                           │ Regulatory Compliance│
                                           │ EL-5: 13 events     │
                                           └─────────────────────┘
                                                      │
                                                      v
                                            Epic 13 (Entity Definitions)
                                                      │
                                          ┌───────────┼───────────┐
                                          v           v           v
                                    Epic 14     Epic 15     Epic 16
                                    (State)     (Events)    (Handlers)
                                          │           │           │
                                          └───────────┼───────────┘
                                                      v
                                          ┌───────────┴───────────┐
                                          v                       v
                                    Epic 17 (RPC)           Epic 18 (HTTP)
                                          │                       │
                                          └───────────┬───────────┘
                                                      v
                                          ┌───────────┴───────────┐
                                          v                       v
                                   Epic 19 (Streams)      Epic 20 (WebSocket)
                                          │                       │
                                          └───────────┬───────────┘
                                                      v
                                          ┌───────────┴───────────┐
                                          v                       v
                                   Epic 21 (Migration)    Epic 22 (Layers)
                                          │                       │
                                          └───────────┬───────────┘
                                                      v
                                          ┌───────────┴───────────┐
                                          v                       v
                                   Epic 23 (Docs)         Epic 24 (DX)
```

---

## Phase 1: Foundation (Sprints 1-2)

### Epic 1: Schema Architecture (Section 3)

**Goal**: Establish domain schemas as single source of truth.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 1.1.1 | Create branded identifiers (AssetId, SiteId, DeviceId, etc.) | `schemas/identifiers.ts` | S | - |
| 1.1.2 | Create ISA-95 equipment level enum | `schemas/identifiers.ts` | S | 1.1.1 |
| 1.1.3 | Add PlantId, LineId, MachineId, SensorId | `schemas/identifiers.ts` | S | 1.1.1 |
| 1.2.1 | Define Asset schema with Schema.TaggedClass | `schemas/asset.ts` | M | 1.1.1 |
| 1.2.2 | Define AssetStatus, AssetKind literals | `schemas/asset.ts` | S | - |
| 1.2.3 | Define AssetLocation, AssetProperties | `schemas/asset.ts` | M | 1.1.1 |
| 1.3.1 | Define Alarm schema with ISA-18.2 states | `schemas/alarms.ts` | M | 1.1.1 |
| 1.3.2 | Define AlarmSeverity, AlarmState literals | `schemas/alarms.ts` | S | - |
| 1.3.3 | Add alarm transition validation helpers | `schemas/alarms.ts` | M | 1.3.2 |
| 1.4.1 | Define SensorReading with OPC-UA quality | `schemas/readings.ts` | M | 1.1.1 |
| 1.4.2 | Define AggregatedReading for rollups | `schemas/readings.ts` | S | 1.4.1 |
| 1.5.1 | Create schema barrel exports | `schemas/index.ts` | S | 1.2-1.4 |
| 1.5.2 | Add JSDoc documentation to all schemas | `schemas/*.ts` | M | 1.5.1 |

**Acceptance Criteria**:
- [ ] All domain types use Effect Schema
- [ ] Branded IDs compile-time distinct
- [ ] ISA-18.2 alarm states complete
- [ ] OPC-UA quality codes represented

**Estimate**: 8 SP (T-shirt: M)

---

### Epic 2: Model Derivation (Section 3.6)

**Goal**: Create persistence models derived from domain schemas with DDL co-location.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 2.1.1 | Create common model utilities | `models/_common.ts` | M | - |
| 2.1.2 | Define Model.FieldOption for NULL handling | `models/_common.ts` | S | 2.1.1 |
| 2.1.3 | Define Model.GeneratedByApp for client PKs | `models/_common.ts` | S | 2.1.1 |
| 2.2.1 | Create PlantModel deriving from schemas | `models/assets/PlantModel.ts` | M | Epic 1, 2.1 |
| 2.2.2 | Create LineModel with FK to Plant | `models/assets/LineModel.ts` | M | 2.2.1 |
| 2.2.3 | Create MachineModel with FK to Line | `models/assets/MachineModel.ts` | M | 2.2.2 |
| 2.2.4 | Create SensorModel with FK to Machine | `models/assets/SensorModel.ts` | M | 2.2.3 |
| 2.3.1 | Create AlarmModel as ES projection | `models/alarms/AlarmModel.ts` | M | Epic 1 |
| 2.3.2 | Create AlarmContextModel (materialized view) | `models/alarms/AlarmContextModel.ts` | M | 2.3.1 |
| 2.4.1 | Create SensorReadingModel for hypertable | `models/readings/SensorReadingModel.ts` | M | Epic 1 |
| 2.4.2 | Create AggregatedReadingModel | `models/readings/AggregatedReadingModel.ts` | M | 2.4.1 |
| 2.5.1 | Create WorkOrderModel (new) | `models/work-orders/WorkOrderModel.ts` | M | Epic 1 |
| 2.5.2 | Create EquipmentStateModel (new) | `models/equipment-state/EquipmentStateModel.ts` | M | Epic 1 |
| 2.5.3 | Create DeviceConfigModel (new) | `models/device-config/DeviceConfigModel.ts` | M | Epic 1 |
| 2.6.1 | Create model barrel exports | `models/index.ts` | S | 2.2-2.5 |

**Acceptance Criteria**:
- [ ] Models reuse schema fields via `Entity.fields.fieldName`
- [ ] NULL handling via Model.FieldOption
- [ ] All FK relationships defined
- [ ] Insert/update types auto-derived

**Estimate**: 13 SP (T-shirt: L)

---

### Epic 3: DDL Infrastructure (Section 7.1-7.5)

**Goal**: Co-locate DDL with models, implement migration system.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 3.1.1 | Create infrastructure DDL (extensions) | `models/_infrastructure.ddl.ts` | M | - |
| 3.1.2 | Add TimescaleDB extension setup | `models/_infrastructure.ddl.ts` | S | 3.1.1 |
| 3.1.3 | Add Apache AGE extension setup | `models/_infrastructure.ddl.ts` | S | 3.1.1 |
| 3.1.4 | Add pg_stat_statements, btree_gist | `models/_infrastructure.ddl.ts` | S | 3.1.1 |
| 3.2.1 | Create PlantModel.ddl.ts | `models/assets/PlantModel.ddl.ts` | S | 3.1 |
| 3.2.2 | Create LineModel.ddl.ts with FK | `models/assets/LineModel.ddl.ts` | S | 3.2.1 |
| 3.2.3 | Create MachineModel.ddl.ts with FK | `models/assets/MachineModel.ddl.ts` | S | 3.2.2 |
| 3.2.4 | Create SensorModel.ddl.ts with FK | `models/assets/SensorModel.ddl.ts` | S | 3.2.3 |
| 3.3.1 | Create AlarmModel.ddl.ts | `models/alarms/AlarmModel.ddl.ts` | M | 3.2 |
| 3.3.2 | Create alarm graph trigger DDL | `models/alarms/AlarmModel.ddl.ts` | M | 3.3.1 |
| 3.3.3 | Create AlarmContextModel.ddl.ts (mat view) | `models/alarms/AlarmContextModel.ddl.ts` | M | 3.3.1 |
| 3.4.1 | Create SensorReadingModel.ddl.ts (hypertable) | `models/readings/SensorReadingModel.ddl.ts` | L | 3.2 |
| 3.4.2 | Add continuous aggregate (1min) | `models/readings/SensorReadingModel.ddl.ts` | M | 3.4.1 |
| 3.4.3 | Add continuous aggregate (1hour) | `models/readings/SensorReadingModel.ddl.ts` | M | 3.4.1 |
| 3.4.4 | Add continuous aggregate (1day) | `models/readings/SensorReadingModel.ddl.ts` | S | 3.4.1 |
| 3.4.5 | Add compression & retention policies | `models/readings/SensorReadingModel.ddl.ts` | M | 3.4.1 |
| 3.5.1 | Create WorkOrderModel.ddl.ts | `models/work-orders/WorkOrderModel.ddl.ts` | M | - |
| 3.5.2 | Create EquipmentStateModel.ddl.ts | `models/equipment-state/EquipmentStateModel.ddl.ts` | M | - |
| 3.5.3 | Create DeviceConfigModel.ddl.ts | `models/device-config/DeviceConfigModel.ddl.ts` | M | - |
| 3.5.4 | Create DeviceConfigAuditLog.ddl.ts | `models/device-config/DeviceConfigAuditLog.ddl.ts` | M | 3.5.3 |
| 3.6.1 | Aggregate migrations in _migrations.ts | `models/_migrations.ts` | M | 3.1-3.5 |
| 3.6.2 | Implement Migrator.fromRecord pattern | `migrations/runner.ts` | M | 3.6.1 |
| 3.6.3 | Add graph seed DDL | `models/_graph-seed.ddl.ts` | M | 3.1.3 |
| 3.7.1 | Create migration integration test | `__tests__/models.integration.test.ts` | L | 3.6 |

**Acceptance Criteria**:
- [ ] All DDL co-located with Models
- [ ] TimescaleDB hypertables created
- [ ] Continuous aggregates configured
- [ ] Apache AGE graph created
- [ ] Migrations idempotent

**Estimate**: 13 SP (T-shirt: L)

---

### Epic 4: Repository Layer (Section 4)

**Goal**: Implement manual SQL repositories with decode utilities.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 4.1.1 | Create decode utilities (decodeFirst, decodeRows, decodeOptional) | `repos/_decode.ts` | M | - |
| 4.1.2 | Add prepareUpdate for Option -> null | `repos/_decode.ts` | S | 4.1.1 |
| 4.2.1 | Create PlantRepo with Context.Tag | `repos/PlantRepo.ts` | M | Epic 2, 4.1 |
| 4.2.2 | Create LineRepo with FK operations | `repos/LineRepo.ts` | M | 4.2.1 |
| 4.2.3 | Create MachineRepo | `repos/MachineRepo.ts` | M | 4.2.2 |
| 4.2.4 | Create SensorRepo | `repos/SensorRepo.ts` | M | 4.2.3 |
| 4.3.1 | Create AlarmRepo (projection-only) | `repos/AlarmRepo.ts` | M | Epic 2 |
| 4.3.2 | Create AlarmContextRepo | `repos/AlarmContextRepo.ts` | M | 4.3.1 |
| 4.4.1 | Create SensorReadingRepo (TimescaleDB) | `repos/SensorReadingRepo.ts` | L | Epic 2 |
| 4.4.2 | Add insertBatch with SqlResolver.ordered | `repos/SensorReadingRepo.ts` | M | 4.4.1 |
| 4.4.3 | Add rollup tier query routing | `repos/SensorReadingRepo.ts` | M | 4.4.1 |
| 4.4.4 | Create AggregatedReadingRepo | `repos/AggregatedReadingRepo.ts` | M | 4.4.1 |
| 4.5.1 | Create WorkOrderRepo (projection-only) | `repos/WorkOrderRepo.ts` | M | Epic 2 |
| 4.5.2 | Create EquipmentStateRepo (projection-only) | `repos/EquipmentStateRepo.ts` | M | Epic 2 |
| 4.5.3 | Create DeviceConfigRepo (CRUD + audit) | `repos/DeviceConfigRepo.ts` | L | Epic 2 |
| 4.6.1 | Create AllRepositoriesLive layer | `repos/index.ts` | M | 4.2-4.5 |
| 4.6.2 | Create repository integration tests | `__tests__/repos/*.integration.test.ts` | L | 4.6.1 |

**Acceptance Criteria**:
- [ ] All repos use decodeFirst/decodeRows/decodeOptional
- [ ] Option -> null conversion via prepareUpdate
- [ ] ES projection repos marked as read-only
- [ ] DeviceConfigRepo writes audit log
- [ ] Batch insert for readings works

**Estimate**: 13 SP (T-shirt: L)

---

### Epic 5: Error Schemas (Section 3.7)

**Goal**: Define domain errors with Schema.TaggedError.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 5.1.1 | Create common errors (ValidationError, NotFoundError) | `errors/common.ts` | M | - |
| 5.1.2 | Create ConflictError with version tracking | `errors/common.ts` | S | 5.1.1 |
| 5.2.1 | Create AssetNotFoundError | `errors/asset.ts` | S | 5.1.1 |
| 5.2.2 | Create AssetValidationError | `errors/asset.ts` | S | 5.1.1 |
| 5.2.3 | Create AssetConflictError | `errors/asset.ts` | S | 5.1.2 |
| 5.2.4 | Create AssetCommandError union | `errors/asset.ts` | S | 5.2.1-3 |
| 5.3.1 | Create AlarmErrors (InvalidTransition, etc.) | `errors/alarm.ts` | M | 5.1.1 |
| 5.4.1 | Create WorkOrderErrors | `errors/work-order.ts` | M | 5.1.1 |
| 5.5.1 | Create EquipmentStateErrors | `errors/equipment-state.ts` | M | 5.1.1 |
| 5.6.1 | Create error barrel exports | `errors/index.ts` | S | 5.1-5.5 |

**Acceptance Criteria**:
- [ ] All errors use Schema.TaggedError
- [ ] Error unions for service signatures
- [ ] Version conflict tracking for optimistic locking

**Estimate**: 5 SP (T-shirt: S)

---

### Epic 6: L1 Infrastructure Services (Section 7)

**Goal**: Establish foundational L1 services.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 6.1.1 | Validate IIoTPgClient configuration | `services/l1/IIoTPgClient.ts` | S | - |
| 6.1.2 | Add connection pooling config | `services/l1/IIoTPgClient.ts` | S | 6.1.1 |
| 6.2.1 | Validate TimeSeriesClient (NOT ES) | `services/l1/TimeSeriesClient.ts` | S | - |
| 6.2.2 | Add JSDoc `@persistence TimescaleDB` | `services/l1/TimeSeriesClient.ts` | S | 6.2.1 |
| 6.3.1 | Validate GraphClient (NOT ES) | `services/l1/GraphClient.ts` | S | - |
| 6.3.2 | Add JSDoc `@persistence Apache AGE` | `services/l1/GraphClient.ts` | S | 6.3.1 |
| 6.3.3 | Add graph traversal helpers | `services/l1/GraphClient.ts` | M | 6.3.1 |
| 6.4.1 | Create L1 layer composition | `services/l1/index.ts` | S | 6.1-6.3 |

**Acceptance Criteria**:
- [ ] L1 services clearly documented as non-ES
- [ ] Connection pooling configured
- [ ] Graph traversal utilities available

**Estimate**: 5 SP (T-shirt: S)

---

## Phase 2: Event Sourcing Boundaries (Sprints 3-6)

*Incorporates ES Boundaries WBS (Epics 1-6) as Epics 7-12, expanded with EventLog integration details*

### Epic 7: ES Infrastructure (Expanded)

**Goal**: Establish IIoT-specific EventLog infrastructure with SqlEventJournal, identity persistence, and AMS v2-aligned patterns.

**Story Points**: 21 SP (expanded from 8 SP)
**Sprint**: 3

See: `thoughts/shared/plans/fragments/epic-7-expanded.md` for complete task breakdown.

**Key Deliverables**:
- IIoTEventLog facade layer (API stability protection)
- SqlEventJournal tables (iiot_event_journal, iiot_event_remotes, iiot_event_identity)
- Event base schemas (EventMetadata, IIoTEventEntry)
- Canonical API patterns (EventGroup.empty, EventLog.group, groupReactivity)
- Integration tests (write/read roundtrip)

**Acceptance Criteria**:
- [ ] `@effect/experimental` version pinned in `package.json`
- [ ] `IIoTEventLogFacade` abstracts EventLog API for domain isolation
- [ ] `iiot_event_journal` and `iiot_event_remotes` tables created via idempotent migration
- [ ] `IIoTSqlEventJournalLayer` writes to PostgreSQL
- [ ] `IIoTEventLogTest` provides in-memory layer for unit tests
- [ ] `IIoTIdentityLayer` persists identity via KeyValueStore
- [ ] `IIoTEventLogStackLayer` composes all layers for production use
- [ ] `EventMetadata` schema captures correlationId, causationId, userId
- [ ] `Event.make` wrapper injects IIoT-specific metadata
- [ ] Integration test: write event, read event, verify payload

---

### Epic 8: Alarm Domain ES Migration (Expanded)

**Goal**: ISA-18.2 compliant alarm lifecycle with full audit trail via EventLog.

**Story Points**: 21 SP (expanded from 13 SP)
**Sprints**: 2-3

See: `thoughts/shared/plans/fragments/epic-8-expanded.md` for complete task breakdown.

**Key Deliverables**:
- 10 Alarm Event Schemas (AlarmTriggered, AlarmAcknowledged, AlarmCleared, AlarmEscalated, AlarmShelved, AlarmUnshelved, AlarmSuppressed, AlarmOutOfService, AlarmReturnedToService, AlarmConfigChanged)
- Event Handlers (projection updates on event writes)
- Reactivity Bindings (atom invalidation for real-time UI)
- Temporal Queries (point-in-time state reconstruction)
- Feature Flag (`ES_ALARM_ENABLED` for safe rollback)

**Acceptance Criteria**:
- [ ] All 10 alarm events implemented with Schema.Class payloads
- [ ] Event handlers update projections in same transaction
- [ ] Reactivity binds to atoms - UI refreshes on events
- [ ] Temporal queries work - reconstruct any past state
- [ ] Feature flag enables rollback - can disable ES at runtime
- [ ] ISA-18.2 compliance verified - full audit trail
- [ ] Performance acceptable - <100ms temporal queries

---

### Epic 9: Work Order Domain (Expanded)

**Goal**: 46 events across 6 aggregates for FDA-compliant work order lifecycle with full audit trail, temporal queries, and compliance support.

**Story Points**: 34 SP (expanded from 13 SP)
**Sprints**: 4-5

See: `thoughts/shared/plans/fragments/epic-9-expanded.md` for complete task breakdown.

**Aggregate Overview**:

| Aggregate | Events | Purpose | Compliance |
|-----------|--------|---------|------------|
| **WorkOrder** | 11 | Lifecycle state machine | ISA-95 L3, FDA 21 CFR Part 11 |
| **WorkOrderContext** | 10 | Hybrid snapshot + live refs | Audit trail, RCA |
| **TaskInstance** | 9 | Task execution tracking | Process control |
| **ApprovalRequest** | 6 | 4-eyes principle, escalation | FDA, ISO 9001 |
| **L3SyncOperation** | 5 | External system integration | ERP reconciliation |
| **WorkflowDefinition** | 5 | Template versioning | Change control |
| **TOTAL** | **46** | | |

**Acceptance Criteria**:
- [ ] All 46 events defined with Effect Schema
- [ ] All 6 EventGroups created
- [ ] Combined IIoTEventLogSchema includes all groups
- [ ] Each event has a projection handler
- [ ] Same-transaction writes (event + projection)
- [ ] Reactivity bindings for cache invalidation
- [ ] `Context.snapshot()` creates immutable audit record
- [ ] `Context.resolve()` returns live entity state
- [ ] `Context.update()` enforces version conflict detection
- [ ] `getWorkOrderAtTime(id, timestamp)` reconstructs state
- [ ] `getHistory(id)` returns full event history
- [ ] Replay produces consistent state
- [ ] FDA 21 CFR Part 11 audit trail
- [ ] 4-eyes approval principle supported
- [ ] All state changes traceable to user + timestamp

---

### Epic 10: Equipment State Domain (Expanded)

**Goal**: Track equipment operational state changes for OEE calculations, Root Cause Analysis (RCA), and downtime reporting.

**Story Points**: 21 SP (expanded from 8 SP)
**Sprint**: 6

See: `thoughts/shared/plans/fragments/epic-10-expanded.md` for complete task breakdown.

**Event Catalog**:

| Event | Purpose | OEE Impact |
|-------|---------|------------|
| **EquipmentStateChanged** | Core state transition tracking | Direct availability calculation |
| **MaintenanceModeEntered** | Mark equipment as under maintenance | Planned vs unplanned downtime |
| **MaintenanceModeExited** | Return to normal operation | Duration tracking |
| **PerformanceDegraded** | Below optimal but operational | Performance factor reduction |
| **FaultDetected** | Equipment fault occurred | Unplanned downtime start |
| **FaultCleared** | Fault resolved | Unplanned downtime end |

**Acceptance Criteria**:
- [ ] All 6 equipment state events defined and validated
- [ ] State transitions validated against ISA-88 state machine
- [ ] Event -> projection handlers maintain consistency
- [ ] `getStateAtTime(equipmentId, timestamp)` returns accurate state reconstruction
- [ ] `getDowntimeReport(equipmentId, range)` calculates MTBF/MTTR correctly
- [ ] OEE calculation matches manual calculation within 0.1%
- [ ] Temporal query on 10K events completes in <100ms
- [ ] OEE calculation for 1 month data completes in <500ms
- [ ] Event handlers update projections within same transaction
- [ ] Reactivity triggers atom refresh within 50ms of event write
- [ ] All state transitions auditable via event stream
- [ ] Maintenance mode tracked with work order linkage
- [ ] Fault events linked to triggering alarms when applicable
- [ ] Downtime reasons captured for regulatory reporting

---

### Epic 11: Non-ES Domain Validation (ES WBS Epic 5)

**Goal**: Explicitly validate non-ES domains.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 11.1.1 | Audit TimeSeriesClient - no EventLog | `services/l1/TimeSeriesClient.ts` | S | - |
| 11.1.2 | Add JSDoc `@persistence TimescaleDB (NOT ES)` | `services/l1/TimeSeriesClient.ts` | S | 11.1.1 |
| 11.1.3 | Document rationale in code | `services/l1/TimeSeriesClient.ts` | S | 11.1.1 |
| 11.1.4 | Add to ADR-0012 appendix | `ADR-0012-*.md` | S | 11.1.1 |
| 11.2.1 | Audit GraphClient - no EventLog | `services/l1/GraphClient.ts` | S | - |
| 11.2.2 | Add JSDoc `@persistence Apache AGE (NOT ES)` | `services/l1/GraphClient.ts` | S | 11.2.1 |
| 11.2.3 | Document rationale | `services/l1/GraphClient.ts` | S | 11.2.1 |
| 11.2.4 | Verify asset tables are CRUD | `models/assets/*.ts` | S | 11.2.1 |
| 11.3.1 | Create DeviceConfig schema | `schemas/device-config.ts` | M | Epic 1 |
| 11.3.2 | Create DeviceConfigModel | `models/device-config/DeviceConfigModel.ts` | M | 11.3.1 |
| 11.3.3 | Create DeviceConfigAuditLogModel | `models/device-config/DeviceConfigAuditLogModel.ts` | M | 11.3.2 |
| 11.3.4 | Create DDL files | `models/device-config/*.ddl.ts` | M | 11.3.2-3 |
| 11.3.5 | Add migration `0017_device_config` | `models/_migrations.ts` | S | 11.3.4 |
| 11.3.6 | Create DeviceConfigRepo with audit log | `repos/DeviceConfigRepo.ts` | M | 11.3.3 |
| 11.3.7 | Create DeviceConfigService | `services/l2/DeviceConfigService.ts` | M | 11.3.6 |
| 11.3.8 | Add JSDoc `@persistence CRUD + audit (NOT ES)` | - | S | 11.3.7 |

**Acceptance Criteria**:
- [ ] Non-ES domains explicitly documented
- [ ] Audit log for config changes (not EventLog)
- [ ] Clear separation from ES domains

**Estimate**: 3 SP (T-shirt: S)

---

### Epic 12: ES Integration & Testing (ES WBS Epic 6)

**Goal**: Ensure ES and non-ES domains integrate correctly.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 12.1.1 | Test: Alarm -> event -> projection | `__tests__/integration/alarm-es.test.ts` | L | Epic 8 |
| 12.1.2 | Test: Work order lifecycle | `__tests__/integration/work-order-es.test.ts` | L | Epic 9 |
| 12.1.3 | Test: Equipment state -> history | `__tests__/integration/equipment-state-es.test.ts` | L | Epic 10 |
| 12.1.4 | Test: Alarm -> Work Order creation | `__tests__/integration/alarm-work-order.test.ts` | M | Epic 8, 9 |
| 12.1.5 | Test: Replay events -> consistent state | `__tests__/integration/event-replay.test.ts` | L | Epic 7 |
| 12.2.1 | Test: getAlarmAtTime historical state | `__tests__/services/alarm-temporal.test.ts` | M | Epic 8 |
| 12.2.2 | Test: getEquipmentStateAtTime | `__tests__/services/equipment-state-temporal.test.ts` | M | Epic 10 |
| 12.2.3 | Test: RCA query across domains | `__tests__/integration/rca-temporal.test.ts` | L | 12.2.1-2 |
| 12.3.1 | Test: ISA-18.2 alarm audit trail | `__tests__/compliance/isa-18-2.test.ts` | M | Epic 8 |
| 12.3.2 | Test: Events immutable | `__tests__/compliance/immutability.test.ts` | M | Epic 7 |
| 12.3.3 | Test: Audit log captures config changes | `__tests__/compliance/config-audit.test.ts` | M | Epic 11 |
| 12.4.1 | Benchmark: Event write throughput | `__tests__/perf/event-write.bench.ts` | M | Epic 7 |
| 12.4.2 | Benchmark: Projection query latency | `__tests__/perf/projection-query.bench.ts` | M | Epic 7 |
| 12.4.3 | Benchmark: Temporal query on 10K events | `__tests__/perf/temporal-query.bench.ts` | M | Epic 8 |

**Acceptance Criteria**:
- [ ] All integration tests pass
- [ ] Temporal queries correct
- [ ] ISA-18.2 verified
- [ ] Performance <100ms for most queries

**Estimate**: 13 SP (T-shirt: L)

---

## Phase 2.5: Regulatory Compliance (Sprint 7) — NEW

### Epic 25: Regulatory Compliance Event Sourcing

**Goal**: Complete audit trail infrastructure for FDA 21 CFR Part 11, ISO 9001, and general operator audit compliance.

**Story Points**: 13 SP
**Sprint**: 7

See: `thoughts/shared/plans/fragments/epic-25-regulatory.md` for complete task breakdown.

**Domain Overview**:

| Domain | Events | Purpose |
|--------|--------|---------|
| **Batch Records** | 4 | FDA 21 CFR Part 11 compliance |
| **Quality Events** | 5 | ISO 9001 NCR-CAPA lifecycle |
| **Operator Actions** | 4 | General audit trail |
| **TOTAL** | **13** | |

**Acceptance Criteria**:
- [ ] **Immutability**: Events in journal cannot be UPDATE/DELETE (enforced at DB level)
- [ ] **Batch Traceability**: Any batch can be reconstructed from events at any point in time
- [ ] **NCR-CAPA Lifecycle**: Complete chain from Inspection -> NCR -> CAPA -> Resolution
- [ ] **Operator Accountability**: All operator actions attributable with timestamp
- [ ] **Temporal Queries**: Point-in-time state reconstruction working for all aggregates
- [ ] **Feature Flag**: `ES_REGULATORY_ENABLED` controls rollout
- [ ] **Test Coverage**: >90% for handlers, 100% for compliance validation

---

## Phase 3: Entity & Service Layer (Sprints 8-9)

### Epic 13: Entity Definitions (Section 6)

**Goal**: Define Effect Cluster entities with RPC protocols.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 13.1.1 | Create Rpc.make pattern for CreateAssetRpc | `entities/asset.ts` | M | Epic 1, 5 |
| 13.1.2 | Create UpdateAssetRpc | `entities/asset.ts` | M | 13.1.1 |
| 13.1.3 | Create MoveAssetRpc | `entities/asset.ts` | M | 13.1.1 |
| 13.1.4 | Create DeleteAssetRpc | `entities/asset.ts` | S | 13.1.1 |
| 13.1.5 | Create GetAssetRpc | `entities/asset.ts` | S | 13.1.1 |
| 13.1.6 | Create ListAssetsRpc (pagination) | `entities/asset.ts` | M | 13.1.1 |
| 13.1.7 | Create SearchAssetsRpc | `entities/asset.ts` | M | 13.1.1 |
| 13.1.8 | Create AssetEntity.make with all RPCs | `entities/asset.ts` | M | 13.1.1-7 |
| 13.2.1 | Create AlarmEntity with ISA-18.2 RPCs | `entities/alarm.ts` | L | Epic 8 |
| 13.2.2 | Add alarm-specific RPCs (Ack, Shelve, etc.) | `entities/alarm.ts` | M | 13.2.1 |
| 13.3.1 | Create SensorEntity | `entities/sensor.ts` | M | Epic 1 |
| 13.3.2 | Add reading ingestion RPCs | `entities/sensor.ts` | M | 13.3.1 |
| 13.4.1 | Create WorkOrderEntity | `entities/work-order.ts` | M | Epic 9 |
| 13.5.1 | Create EquipmentStateEntity | `entities/equipment-state.ts` | M | Epic 10 |
| 13.6.1 | Create entity barrel exports | `entities/index.ts` | S | 13.1-5 |

**Acceptance Criteria**:
- [ ] All entities follow Entity.make pattern
- [ ] RPCs define payload, success, error types
- [ ] Entities support 8+ commands, 13+ queries pattern

**Estimate**: 13 SP (T-shirt: L)

---

### Epic 14: State Services (Section 6.3)

**Goal**: Implement swappable state services (in-memory + SQL).

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 14.1.1 | Create AssetStateShape interface | `services/asset-state-shape.ts` | M | Epic 13 |
| 14.1.2 | Implement AssetState (in-memory, Ref) | `services/asset-state.ts` | L | 14.1.1 |
| 14.1.3 | Implement AssetStateSQLLayer | `services/asset-state-sql.ts` | L | 14.1.1, Epic 4 |
| 14.1.4 | Create modelToAsset transformer | `services/asset-state-sql.ts` | M | 14.1.3 |
| 14.2.1 | Create AlarmStateShape interface | `services/alarm-state-shape.ts` | M | Epic 13 |
| 14.2.2 | Implement AlarmState (in-memory) | `services/alarm-state.ts` | L | 14.2.1 |
| 14.2.3 | Implement AlarmStateSQLLayer | `services/alarm-state-sql.ts` | L | 14.2.1 |
| 14.3.1 | Create SensorStateShape interface | `services/sensor-state-shape.ts` | M | Epic 13 |
| 14.3.2 | Implement SensorState | `services/sensor-state.ts` | M | 14.3.1 |
| 14.3.3 | Implement SensorStateSQLLayer | `services/sensor-state-sql.ts` | L | 14.3.1 |
| 14.4.1 | Create WorkOrderStateShape | `services/work-order-state-shape.ts` | M | Epic 13 |
| 14.4.2 | Implement WorkOrderStateSQLLayer | `services/work-order-state-sql.ts` | L | 14.4.1 |
| 14.5.1 | Create EquipmentStateStateShape | `services/equipment-state-state-shape.ts` | M | Epic 13 |
| 14.5.2 | Implement EquipmentStateStateSQLLayer | `services/equipment-state-state-sql.ts` | L | 14.5.1 |
| 14.6.1 | Unit tests for all state services | `__tests__/services/*.test.ts` | L | 14.1-5 |

**Acceptance Criteria**:
- [ ] All entities have swappable state
- [ ] In-memory for tests, SQL for production
- [ ] State shape interfaces enforced via satisfies

**Estimate**: 13 SP (T-shirt: L)

---

### Epic 15: Event Handlers (Section 5.2)

**Goal**: Implement EventLog.group handlers and reactivity.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 15.1.1 | Create AssetEvents EventGroup | `events/asset-events.ts` | M | Epic 1 |
| 15.1.2 | Define AssetCreated, AssetUpdated, etc. | `events/asset-events.ts` | M | 15.1.1 |
| 15.1.3 | Define primaryKey functions | `events/asset-events.ts` | S | 15.1.2 |
| 15.2.1 | Create AssetEventHandlers | `handlers/event-handlers.ts` | L | 15.1, Epic 14 |
| 15.2.2 | Handle AssetCreated -> projection | `handlers/event-handlers.ts` | M | 15.2.1 |
| 15.2.3 | Handle AssetUpdated -> projection | `handlers/event-handlers.ts` | M | 15.2.1 |
| 15.2.4 | Handle AssetDeleted -> projection | `handlers/event-handlers.ts` | M | 15.2.1 |
| 15.3.1 | Create AssetReactivity bindings | `handlers/reactivity.ts` | M | 15.1 |
| 15.3.2 | Define query invalidation keys | `handlers/reactivity.ts` | S | 15.3.1 |
| 15.4.1 | Create IIoTEventLogSchema | `events/schema.ts` | M | Epic 7 |
| 15.4.2 | Register all event groups | `events/schema.ts` | M | 15.4.1, Epic 8-10 |
| 15.5.1 | Integration test: event -> handler -> projection | `__tests__/handlers/event-handlers.test.ts` | L | 15.2 |

**Acceptance Criteria**:
- [ ] All events have handlers
- [ ] Handlers update projections in same transaction
- [ ] Reactivity invalidates correct queries

**Estimate**: 8 SP (T-shirt: M)

---

### Epic 16: Entity Handlers (Section 6.2)

**Goal**: Implement Entity.toLayer handlers.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 16.1.1 | Create AssetEntityHandlers | `handlers/asset-handlers.ts` | L | Epic 13, 14 |
| 16.1.2 | Implement CreateAsset handler | `handlers/asset-handlers.ts` | M | 16.1.1 |
| 16.1.3 | Implement UpdateAsset handler | `handlers/asset-handlers.ts` | M | 16.1.1 |
| 16.1.4 | Implement MoveAsset handler | `handlers/asset-handlers.ts` | M | 16.1.1 |
| 16.1.5 | Implement DeleteAsset handler | `handlers/asset-handlers.ts` | M | 16.1.1 |
| 16.1.6 | Implement GetAsset handler | `handlers/asset-handlers.ts` | S | 16.1.1 |
| 16.1.7 | Implement ListAssets handler | `handlers/asset-handlers.ts` | M | 16.1.1 |
| 16.1.8 | Implement SearchAssets handler | `handlers/asset-handlers.ts` | M | 16.1.1 |
| 16.1.9 | Add maybeEmit pattern for events | `handlers/asset-handlers.ts` | M | 16.1.1 |
| 16.2.1 | Create AlarmEntityHandlers | `handlers/alarm-handlers.ts` | L | Epic 8, 13 |
| 16.2.2 | Implement ISA-18.2 state transitions | `handlers/alarm-handlers.ts` | L | 16.2.1 |
| 16.3.1 | Create SensorEntityHandlers | `handlers/sensor-handlers.ts` | M | Epic 13, 14 |
| 16.4.1 | Create WorkOrderEntityHandlers | `handlers/work-order-handlers.ts` | L | Epic 9, 13 |
| 16.5.1 | Create EquipmentStateEntityHandlers | `handlers/equipment-state-handlers.ts` | M | Epic 10, 13 |
| 16.6.1 | Create handler barrel exports | `handlers/index.ts` | S | 16.1-5 |
| 16.6.2 | Integration test all handlers | `__tests__/handlers/*.test.ts` | L | 16.6.1 |

**Acceptance Criteria**:
- [ ] All entity handlers implement their RPCs
- [ ] Event emission via maybeEmit pattern
- [ ] Defect retry policy configured

**Estimate**: 8 SP (T-shirt: M)

---

## Phase 4: RPC & HTTP Layer (Sprints 10-11)

### Epic 17: RPC Handler Layer (Section 6.1)

**Goal**: Generate type-safe RPC proxies from entities.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 17.1.1 | Create AssetEntity.toRpcProxy | `rpc/asset-rpc.ts` | M | Epic 13 |
| 17.1.2 | Create AlarmEntity.toRpcProxy | `rpc/alarm-rpc.ts` | M | Epic 13 |
| 17.1.3 | Create SensorEntity.toRpcProxy | `rpc/sensor-rpc.ts` | M | Epic 13 |
| 17.1.4 | Create WorkOrderEntity.toRpcProxy | `rpc/work-order-rpc.ts` | M | Epic 13 |
| 17.1.5 | Create EquipmentStateEntity.toRpcProxy | `rpc/equipment-state-rpc.ts` | M | Epic 13 |
| 17.2.1 | Create RPC layer composition | `rpc/index.ts` | M | 17.1 |
| 17.2.2 | Add RPC authentication middleware | `rpc/middleware/auth.ts` | M | 17.2.1 |
| 17.2.3 | Add RPC rate limiting middleware | `rpc/middleware/rate-limit.ts` | M | 17.2.1 |
| 17.3.1 | Integration test RPC calls | `__tests__/rpc/*.test.ts` | L | 17.2 |

**Acceptance Criteria**:
- [ ] Type-safe RPC proxies generated
- [ ] Authentication middleware applied
- [ ] Rate limiting configured

**Estimate**: 13 SP (T-shirt: L)

---

### Epic 18: HTTP API Layer (Section 2, L3)

**Goal**: Generate HTTP APIs with OpenAPI documentation.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 18.1.1 | Create AssetEntity.toHttp | `http/asset-api.ts` | M | Epic 13 |
| 18.1.2 | Create AlarmEntity.toHttp | `http/alarm-api.ts` | M | Epic 13 |
| 18.1.3 | Create SensorEntity.toHttp | `http/sensor-api.ts` | M | Epic 13 |
| 18.1.4 | Create WorkOrderEntity.toHttp | `http/work-order-api.ts` | M | Epic 13 |
| 18.1.5 | Create EquipmentStateEntity.toHttp | `http/equipment-state-api.ts` | M | Epic 13 |
| 18.2.1 | Generate OpenAPI schema | `http/openapi.ts` | L | 18.1 |
| 18.2.2 | Add Swagger UI endpoint | `http/swagger.ts` | M | 18.2.1 |
| 18.3.1 | Add HTTP authentication middleware | `http/middleware/auth.ts` | M | 18.1 |
| 18.3.2 | Add CORS middleware | `http/middleware/cors.ts` | S | 18.1 |
| 18.3.3 | Add request logging middleware | `http/middleware/logging.ts` | M | 18.1 |
| 18.4.1 | Create HTTP layer composition | `http/index.ts` | M | 18.1-3 |
| 18.4.2 | Integration test HTTP endpoints | `__tests__/http/*.test.ts` | L | 18.4.1 |

**Acceptance Criteria**:
- [ ] REST endpoints generated from entities
- [ ] OpenAPI documentation auto-generated
- [ ] Swagger UI accessible
- [ ] Authentication enforced

**Estimate**: 13 SP (T-shirt: L)

---

## Phase 5: Stream Processing & Real-time (Sprints 12-13)

### Epic 19: Stream Processing (Section 20.3)

**Goal**: Implement ingestion adapters and stream processing.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 19.1.1 | Create IngestionAdapter interface | `adapters/ingestion.ts` | M | - |
| 19.1.2 | Implement OpcUaAdapter | `adapters/opcua-adapter.ts` | L | 19.1.1 |
| 19.1.3 | Implement SparkplugAdapter | `adapters/sparkplug-adapter.ts` | L | 19.1.1 |
| 19.1.4 | Implement ModbusAdapter | `adapters/modbus-adapter.ts` | M | 19.1.1 |
| 19.2.1 | Create MQTT Stream subscription | `streams/mqtt-stream.ts` | L | 19.1 |
| 19.2.2 | Implement topic -> DeviceId routing | `streams/device-routing.ts` | M | 19.2.1 |
| 19.2.3 | Add quality code mapping | `streams/quality-mapping.ts` | M | 19.2.1 |
| 19.3.1 | Create reading batch processor | `streams/reading-processor.ts` | L | 19.2, Epic 4 |
| 19.3.2 | Add alarm threshold detection | `streams/alarm-detection.ts` | M | 19.3.1 |
| 19.4.1 | Integration test ingestion pipeline | `__tests__/streams/ingestion.test.ts` | L | 19.3 |

**Acceptance Criteria**:
- [ ] Multiple protocol adapters implemented
- [ ] Stream-based ingestion working
- [ ] Alarm detection from thresholds

**Estimate**: 13 SP (T-shirt: L)

---

### Epic 20: Real-time Subscriptions (Section 2, L3)

**Goal**: Implement WebSocket handlers for real-time updates.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 20.1.1 | Create WebSocket handler infrastructure | `ws/handler.ts` | M | - |
| 20.1.2 | Implement subscription management | `ws/subscriptions.ts` | M | 20.1.1 |
| 20.2.1 | Create alarm subscription channel | `ws/channels/alarms.ts` | M | 20.1, Epic 15 |
| 20.2.2 | Create reading subscription channel | `ws/channels/readings.ts` | M | 20.1 |
| 20.2.3 | Create equipment state channel | `ws/channels/equipment-state.ts` | M | 20.1 |
| 20.3.1 | Add EventLog reactivity integration | `ws/reactivity.ts` | M | 20.1, Epic 15 |
| 20.3.2 | Implement query invalidation push | `ws/invalidation.ts` | M | 20.3.1 |
| 20.4.1 | Integration test WebSocket channels | `__tests__/ws/*.test.ts` | L | 20.1-3 |

**Acceptance Criteria**:
- [ ] WebSocket subscriptions working
- [ ] Reactivity pushes invalidations
- [ ] Multiple channel types supported

**Estimate**: 8 SP (T-shirt: M)

---

## Phase 6: Migration & Integration (Sprints 14-15)

### Epic 21: Migration Path (Section 11)

**Goal**: Migrate existing IIoT code to v3 patterns.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 21.1.1 | Audit existing IIoT schemas | `iiot/schemas/*.ts` | M | - |
| 21.1.2 | Create schema migration plan | `docs/migration/schemas.md` | M | 21.1.1 |
| 21.1.3 | Migrate identifiers to branded types | `schemas/identifiers.ts` | M | 21.1.2 |
| 21.2.1 | Audit existing IIoT models | `iiot/models/**/*.ts` | M | - |
| 21.2.2 | Create model migration plan | `docs/migration/models.md` | M | 21.2.1 |
| 21.2.3 | Update models to use schema derivation | `models/**/*.ts` | L | 21.2.2 |
| 21.3.1 | Audit existing IIoT repos | `iiot/repos/*.ts` | M | - |
| 21.3.2 | Add decode utilities to existing repos | `repos/*.ts` | L | 21.3.1 |
| 21.4.1 | Audit existing IIoT services | `iiot/services/**/*.ts` | M | - |
| 21.4.2 | Migrate AlarmService to ES pattern | `services/l2/AlarmService.ts` | L | 21.4.1, Epic 8 |
| 21.5.1 | Create backward compatibility layer | `compat/index.ts` | M | 21.1-4 |
| 21.5.2 | Add deprecation warnings | `compat/*.ts` | S | 21.5.1 |
| 21.6.1 | Integration test migration | `__tests__/migration/*.test.ts` | L | 21.5 |

**Acceptance Criteria**:
- [ ] Existing code continues to work
- [ ] Gradual migration path documented
- [ ] Deprecation warnings in place
- [ ] Integration tests pass

**Estimate**: 13 SP (T-shirt: L)

---

### Epic 22: Layer Composition (Section 8)

**Goal**: Create deployment profile layers.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 22.1.1 | Create TestLayer (in-memory) | `layers/deployments.ts` | M | Epic 14, 16 |
| 22.1.2 | Create SqlTestLayer (SQLite) | `layers/deployments.ts` | M | 22.1.1 |
| 22.1.3 | Create TauriLayer (SQLite file) | `layers/deployments.ts` | M | 22.1.2 |
| 22.1.4 | Create ClusterLayer (PostgreSQL) | `layers/deployments.ts` | M | 22.1.3 |
| 22.2.1 | Create V3Mode config | `layers/runtime.ts` | M | 22.1 |
| 22.2.2 | Create V3RuntimeLayer (config-driven) | `layers/runtime.ts` | M | 22.2.1 |
| 22.3.1 | Create layer barrel exports | `layers/index.ts` | S | 22.1-2 |
| 22.3.2 | Integration test all deployment profiles | `__tests__/layers/*.test.ts` | L | 22.3.1 |

**Acceptance Criteria**:
- [ ] All deployment modes work
- [ ] Config-driven layer selection
- [ ] Tests pass in all modes

**Estimate**: 13 SP (T-shirt: L)

---

## Phase 7: Documentation & DX (Sprint 16)

### Epic 23: Documentation

**Goal**: Comprehensive documentation for v3 architecture.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 23.1.1 | Create v3 architecture overview | `docs/architecture/overview.md` | M | All |
| 23.1.2 | Document schema patterns | `docs/patterns/schemas.md` | M | Epic 1 |
| 23.1.3 | Document repository patterns | `docs/patterns/repositories.md` | M | Epic 4 |
| 23.1.4 | Document entity patterns | `docs/patterns/entities.md` | M | Epic 13 |
| 23.1.5 | Document ES boundaries | `docs/patterns/event-sourcing.md` | M | Epic 7-12 |
| 23.2.1 | Create developer quickstart | `docs/quickstart.md` | M | All |
| 23.2.2 | Create migration guide | `docs/migration.md` | L | Epic 21 |
| 23.3.1 | Add inline JSDoc to all public APIs | `**/*.ts` | L | All |
| 23.3.2 | Generate API documentation | `docs/api/` | M | 23.3.1 |

**Acceptance Criteria**:
- [ ] Architecture documented
- [ ] Pattern catalog complete
- [ ] Quickstart guide available
- [ ] API docs generated

**Estimate**: 8 SP (T-shirt: M)

---

### Epic 24: Developer Experience

**Goal**: Tooling and DX improvements.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 24.1.1 | Create entity generator CLI | `tools/generate-entity.ts` | M | Epic 13 |
| 24.1.2 | Create model generator CLI | `tools/generate-model.ts` | M | Epic 2 |
| 24.1.3 | Create migration generator CLI | `tools/generate-migration.ts` | M | Epic 3 |
| 24.2.1 | Add VS Code snippets | `.vscode/snippets.json` | S | All |
| 24.2.2 | Add recommended extensions | `.vscode/extensions.json` | S | - |
| 24.3.1 | Create seed data CLI enhancement | `seed/ctl/src/index.ts` | M | Epic 4 |
| 24.3.2 | Add schema validation CLI | `tools/validate-schema.ts` | M | Epic 1 |
| 24.4.1 | Integration test generators | `__tests__/tools/*.test.ts` | M | 24.1 |

**Acceptance Criteria**:
- [ ] Code generators working
- [ ] VS Code integration
- [ ] CLI tools documented

**Estimate**: 8 SP (T-shirt: M)

---

## Dependencies Matrix

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           DEPENDENCY GRAPH                                         │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Epic 1 (Schemas) ────────┬─────────────────────────────────────────────────────│
│         │                 │                                                      │
│         v                 v                                                      │
│  Epic 2 (Models) ──> Epic 5 (Errors)                                             │
│         │                 │                                                      │
│         v                 │                                                      │
│  Epic 3 (DDL) ────────────┼───────> Epic 7 (ES Infra) ──> Epic 8 (Alarm ES)      │
│         │                 │                │                    │                │
│         v                 │                │                    v                │
│  Epic 4 (Repos) <─────────┘                │              Epic 9 (Work Order)    │
│         │                                  │                    │                │
│         v                                  v                    v                │
│  Epic 6 (L1 Services)              Epic 10 (Equip State)  Epic 11 (Non-ES)       │
│         │                                  │                    │                │
│         └──────────────────────────────────┼────────────────────┘                │
│                                            v                                     │
│                                    Epic 12 (ES Testing)                          │
│                                            │                                     │
│                                            v                                     │
│                                    Epic 25 (Regulatory)                          │
│                                            │                                     │
│                                            v                                     │
│  Epic 13 (Entities) <──────────────────────┘                                     │
│         │                                                                        │
│         ├─────────────────────┬──────────────────────┐                          │
│         v                     v                      v                          │
│  Epic 14 (State)       Epic 15 (Events)      Epic 16 (Handlers)                 │
│         │                     │                      │                          │
│         └─────────────────────┼──────────────────────┘                          │
│                               v                                                  │
│                    ┌──────────┴──────────┐                                      │
│                    v                     v                                      │
│              Epic 17 (RPC)         Epic 18 (HTTP)                               │
│                    │                     │                                      │
│                    └─────────┬───────────┘                                      │
│                              v                                                  │
│               ┌──────────────┴──────────────┐                                   │
│               v                             v                                   │
│        Epic 19 (Streams)            Epic 20 (WebSocket)                         │
│               │                             │                                   │
│               └──────────────┬──────────────┘                                   │
│                              v                                                  │
│               ┌──────────────┴──────────────┐                                   │
│               v                             v                                   │
│        Epic 21 (Migration)          Epic 22 (Layers)                            │
│               │                             │                                   │
│               └──────────────┬──────────────┘                                   │
│                              v                                                  │
│               ┌──────────────┴──────────────┐                                   │
│               v                             v                                   │
│        Epic 23 (Docs)               Epic 24 (DX)                                │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Complexity Estimates Summary

| Epic | T-Shirt | Story Points | Rationale |
|------|---------|--------------|-----------|
| 1. Schema Architecture | M | 8 | Foundation work, well-defined patterns |
| 2. Model Derivation | L | 13 | Many files, FK relationships |
| 3. DDL Infrastructure | L | 13 | TimescaleDB complexity, many migrations |
| 4. Repository Layer | L | 13 | Many repos, batch insert complexity |
| 5. Error Schemas | S | 5 | Straightforward Schema.TaggedError |
| 6. L1 Infrastructure | S | 5 | Validation and documentation |
| 7. ES Infrastructure (Expanded) | XL | 21 | EventLog facade, tables, identity layer |
| 8. Alarm ES Migration (Expanded) | XL | 21 | 10 events, temporal queries, reactivity |
| 9. Work Order Domain (Expanded) | XXL | 34 | 46 events, 6 aggregates, complex lifecycle |
| 10. Equipment State (Expanded) | XL | 21 | 6 events, state machine, OEE |
| 11. Non-ES Validation | S | 3 | Mostly documentation |
| 12. ES Integration Testing | L | 13 | Comprehensive testing |
| 13. Entity Definitions | L | 13 | Many RPCs, multiple entities |
| 14. State Services | L | 13 | Swappable implementations |
| 15. Event Handlers | M | 8 | EventLog.group pattern |
| 16. Entity Handlers | M | 8 | Entity.toLayer pattern |
| 17. RPC Handler Layer | L | 13 | Transport layer, middleware |
| 18. HTTP API Layer | L | 13 | OpenAPI generation |
| 19. Stream Processing | L | 13 | Multiple protocol adapters |
| 20. Real-time Subscriptions | M | 8 | WebSocket infrastructure |
| 21. Migration Path | L | 13 | Careful backward compat |
| 22. Layer Composition | L | 13 | Multiple deployment modes |
| 23. Documentation | M | 8 | Comprehensive docs needed |
| 24. Developer Experience | M | 8 | Tooling and generators |
| 25. Regulatory Compliance (NEW) | L | 13 | FDA/ISO compliance events |
| **TOTAL** | - | **~267 SP** | **11-15 sprints** |

---

## Event Catalog Summary

| Domain | Events | Source |
|--------|--------|--------|
| Alarm | 10 | Epic 8 (EL-2) |
| WorkOrder Lifecycle | 11 | Epic 9 (EL-3) |
| WorkOrderContext | 10 | Epic 9 (EL-3) |
| TaskInstance | 9 | Epic 9 (EL-3) |
| ApprovalRequest | 6 | Epic 9 (EL-3) |
| L3SyncOperation | 5 | Epic 9 (EL-3) |
| WorkflowDefinition | 5 | Epic 9 (EL-3) |
| Equipment State | 6 | Epic 10 (EL-4) |
| Batch Records | 4 | Epic 25 (EL-5) |
| Quality Events | 5 | Epic 25 (EL-5) |
| Operator Actions | 4 | Epic 25 (EL-5) |
| **Total** | **75 events** | |

---

## Risk Mitigations (Pre-Mortem 2026-01-29)

### Tigers Addressed (EventLog Integration)

1. **EventLog API stability (@effect/experimental)** (severity: MEDIUM)
   - Mitigation: Pin `@effect/experimental` version in package.json, create internal `IIoTEventLogFacade` interface
   - Task: Epic 7 (7.0.1, 7.0.2)
   - Rollback: If API breaks, update facade without changing domain code

2. **No rollback strategy for ES migration** (severity: HIGH)
   - Mitigation: Feature flags per domain (`ES_ALARM_ENABLED`, `ES_REGULATORY_ENABLED`)
   - Tasks: Epic 8 (8.0.1-2), Epic 25 (25.4.8)
   - AlarmService will check flag: `ES_ALARM_ENABLED ? emitEvent() : directCRUD()`
   - Allows runtime toggle during migration phase

3. **Team unfamiliar with temporal query debugging** (severity: MEDIUM)
   - Mitigation: Execute Epic 8 temporal queries (8.7.1-8.7.3) as spike BEFORE full work order implementation
   - Team builds competence on alarm domain before tackling more complex Work Order ES

### Pre-Mortem Runs
- Date: 2026-01-29
- Mode: deep
- Tigers: 3 (all mitigated)
- Elephants: 1 (addressed)
- Paper Tigers: 4 (EventLog team competence verified via 76 existing files)

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **EventLog API changes** (`@effect/experimental`) | Medium | High | Pin version, abstract behind internal interface, monitor releases, **facade added per pre-mortem** |
| **Projection consistency** (events/projections diverge) | Low | High | Same-transaction writes, integration tests, monitoring |
| **Migration complexity** (existing alarm data) | Medium | Medium | Backfill events from existing data, test on staging, **feature flags** |
| **Performance degradation** (ES writes slower) | Low | Medium | Benchmark early, optimize projection queries |
| **Team learning curve** (ES is new pattern) | Medium | Medium | Spike with alarm domain first, document patterns, **temporal query training** |
| **Partial adoption confusion** (some ES, some not) | Medium | Low | Clear documentation, code annotations, ADR-0012, **@persistence JSDoc** |
| **Protocol adapter complexity** (OPC-UA, Sparkplug) | Medium | Medium | Start with single protocol, add others incrementally |
| **Layer composition complexity** | Medium | Medium | Clear deployment profiles, extensive testing |
| **Schema/model drift** | Low | Medium | Enforce Model.fields reuse, add validation |
| **Transaction scope issues** | Low | High | Clear saga patterns, compensation events documented |
| **FDA audit fails on mutability** | Low | High | DB-level constraints + immutability tests |
| **NCR-CAPA chain breaks** | Low | Medium | Lifecycle integration tests |

---

## Implementation Order (Phased Sprints)

### Sprint 1-2: Foundation
1. Epic 1: Schema Architecture
2. Epic 2: Model Derivation
3. Epic 3: DDL Infrastructure
4. Epic 4: Repository Layer
5. Epic 5: Error Schemas
6. Epic 6: L1 Infrastructure

### Sprint 3: ES Infrastructure
7. Epic 7: ES Infrastructure (IIoTEventLog, facade, tables)

### Sprint 4: Alarm ES
8. Epic 8: Alarm ES Migration (10 events, temporal queries)

### Sprint 5: Work Order ES (Start)
9. Epic 9: Work Order Domain (start - schemas, events)

### Sprint 6: Work Order ES (Complete) + Equipment State
9. Epic 9: Work Order Domain (complete - handlers, services)
10. Epic 10: Equipment State Domain (6 events, OEE)
11. Epic 11: Non-ES Validation

### Sprint 7: ES Testing + Regulatory
12. Epic 12: ES Integration & Testing
25. Epic 25: Regulatory Compliance (13 events)

### Sprint 8-9: Entity Layer
13. Epic 13: Entity Definitions
14. Epic 14: State Services
15. Epic 15: Event Handlers
16. Epic 16: Entity Handlers

### Sprint 10-11: Transport Layer
17. Epic 17: RPC Handler Layer
18. Epic 18: HTTP API Layer

### Sprint 12-13: Real-time
19. Epic 19: Stream Processing
20. Epic 20: Real-time Subscriptions

### Sprint 14-15: Integration
21. Epic 21: Migration Path
22. Epic 22: Layer Composition

### Sprint 16: Polish
23. Epic 23: Documentation
24. Epic 24: Developer Experience

---

## Codebase References

| Component | Current Location | Target Location |
|-----------|-----------------|-----------------|
| IIoT Schemas | `src/lib/iiot/schemas/*.ts` | `src/lib/v3/schemas/*.ts` |
| IIoT Models | `src/lib/iiot/models/**/*.ts` | `src/lib/v3/models/**/*.ts` |
| IIoT Repos | `src/lib/iiot/repos/*.ts` | `src/lib/v3/repos/*.ts` |
| IIoT Services | `src/lib/iiot/services/**/*.ts` | `src/lib/v3/services/**/*.ts` |
| AlarmEntity | `src/lib/iiot/entity/AlarmEntity.ts` | `src/lib/v3/entities/alarm.ts` |
| AMS v2 Entities | `src/lib/ams/v2/base/entities/*.ts` | Pattern reference |
| AMS v2 Handlers | `src/lib/ams/v2/base/handlers/*.ts` | Pattern reference |
| AMS v2 Events | `src/lib/ams/v2/base/events/*.ts` | Pattern reference |
| AMS v2 Layers | `src/lib/ams/v2/base/layers/*.ts` | Pattern reference |

---

## Success Criteria

### Technical Metrics
- [ ] All 25 epics completed
- [ ] 100% schema validation coverage
- [ ] Integration tests pass all deployment modes
- [ ] Performance: <100ms for 95% of queries
- [ ] ES temporal queries accurate to 1ms
- [ ] All 75 events implemented and tested

### Quality Metrics
- [ ] Zero schema/model drift
- [ ] ISA-18.2 compliance verified
- [ ] ISA-95 hierarchy complete
- [ ] OpenAPI documentation generated
- [ ] FDA 21 CFR Part 11 compliance verified
- [ ] ISO 9001 NCR-CAPA lifecycle complete

### Team Metrics
- [ ] All developers trained on ES patterns
- [ ] Pattern documentation complete
- [ ] Quickstart guide validated by new team members
- [ ] Temporal query competence demonstrated

---

*"The right question is not 'should we use event sourcing?' but 'where does event sourcing pay its complexity cost?'"* - ADR-0012

---

**Generated by Plan Agent (Val)**
**Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>**
