# EventLog Integration WBS Draft

**Generated:** 2026-01-29
**Author:** Plan Agent (Val)
**Status:** DRAFT - Awaiting Review
**Based On:**
- `thoughts/shared/plans/2026-01-26-v3-service-architecture-wbs.md` (Epics 7-12)
- `thoughts/shared/plans/2026-01-29-work-order-workflow-decomposition.md` (46 events)
- `thoughts/shared/plans/2026-01-26-es-boundaries-wbs.md` (ES/non-ES boundary decisions)
- `src/lib/ams/v2/base/handlers/sql-event-journal.ts` (existing AMS v2 patterns)

---

## Executive Summary

This WBS integrates EventLog infrastructure across the IIoT domain, building on:
- **Existing AMS v2 patterns**: `SqlEventJournalLayer`, `EventLogStackLayer`, `EventLog.schema()`
- **ADR-0012 boundaries**: Alarms, Work Orders, Equipment State get ES; Telemetry/Hierarchy stay CRUD
- **v3 Architecture WBS**: Epics 7-12 already define ES infrastructure and domain migrations

This document provides a focused breakdown for **EventLog integration specifically**, with story point estimates, dependencies, and risk assessment.

---

## Integration with Existing WBS

### Where EventLog Fits in v3 Architecture

| v3 WBS Epic | EventLog Relevance | This WBS Epic |
|-------------|-------------------|---------------|
| Epic 7: ES Infrastructure | **Foundation** - SqlEventJournal, tables, config | Epic EL-1 |
| Epic 8: Alarm ES Migration | **Domain migration** - AlarmEvents group | Epic EL-2 |
| Epic 9: Work Order Domain | **New domain** - 46 events, 6 aggregates | Epic EL-3 |
| Epic 10: Equipment State | **New domain** - state machine events | Epic EL-4 |
| Epic 15: Event Handlers | **Projection layer** - EventLog.group() | Epic EL-3, EL-4 |

### Story Point Alignment

| Domain | v3 WBS Points | EventLog-Specific | Total |
|--------|--------------|-------------------|-------|
| Infrastructure (Epic 7) | 8 SP | +5 SP (IIoT adaptation) | 13 SP |
| Alarm Migration (Epic 8) | 13 SP | +3 SP (reactivity bindings) | 16 SP |
| Work Order (Epic 9) | 13 SP | +8 SP (46 events, handlers) | 21 SP |
| Equipment State (Epic 10) | 8 SP | +5 SP (OEE projections) | 13 SP |
| Regulatory (NEW) | - | 13 SP (batch records, quality) | 13 SP |
| **TOTAL** | 42 SP | +34 SP | **76 SP** |

---

## Epic EL-1: EventLog Infrastructure (Foundation)

**Goal:** Establish IIoT-specific EventLog infrastructure adapting AMS v2 patterns.

**Existing AMS v2 Reference:**
- `src/lib/ams/v2/base/handlers/sql-event-journal.ts` - `SqlEventJournalLayer`
- `src/lib/ams/v2/base/events/schema.ts` - `AmsEventLogSchema`

### Tasks

| ID | Task | Files | Size | Depends On |
|----|------|-------|------|------------|
| EL-1.1 | Add `@effect/experimental` dependency (pinned version) | `package.json` | S | - |
| EL-1.2 | Create `IIoTEventLogFacade` abstraction layer | `services/l1/IIoTEventLog.ts` | M | EL-1.1 |
| EL-1.3 | Create `iiot_event_journal` table DDL | `models/events/EventJournalModel.ddl.ts` | S | - |
| EL-1.4 | Create `iiot_event_remotes` table DDL | `models/events/EventJournalModel.ddl.ts` | S | EL-1.3 |
| EL-1.5 | Add migration `0014_iiot_event_journal` | `models/_migrations.ts` | S | EL-1.4 |
| EL-1.6 | Create `IIoTEventLogConfig` context tag | `services/l1/IIoTEventLog.ts` | S | EL-1.2 |
| EL-1.7 | Create `IIoTSqlEventJournalLayer` | `services/l1/IIoTEventLog.ts` | M | EL-1.5 |
| EL-1.8 | Create `IIoTEventLogTest` (in-memory) | `services/l1/IIoTEventLog.ts` | M | EL-1.2 |
| EL-1.9 | Create `IIoTIdentityLayer` (KeyValueStore-backed) | `services/l1/IIoTEventLog.ts` | M | EL-1.2 |
| EL-1.10 | Create `IIoTEventLogStackLayer` (combined) | `services/l1/IIoTEventLog.ts` | S | EL-1.7-9 |
| EL-1.11 | Create event base schemas (`EventMetadata`) | `schemas/events/base.ts` | M | - |
| EL-1.12 | Create `Event.make` wrapper with IIoT metadata | `schemas/events/base.ts` | M | EL-1.11 |
| EL-1.13 | Integration test: write/read events | `__tests__/integration/iiot-event-journal.test.ts` | L | EL-1.10 |
| EL-1.14 | Export from `services/l1/index.ts` | `services/l1/index.ts` | S | EL-1.10 |

### Code Pattern (from AMS v2)

```typescript
// Adapting existing pattern from src/lib/ams/v2/base/handlers/sql-event-journal.ts

import * as SqlEventJournal from '@effect/sql/SqlEventJournal'
import * as EventLog from '@effect/experimental/EventLog'

// IIoT-specific namespacing
export const IIoTSqlEventJournalLayer = SqlEventJournal.layer({
  eventLogTable: 'iiot_event_journal',  // Separate from AMS tables
  remotesTable: 'iiot_event_remotes',
})

// Facade to abstract @effect/experimental API
export interface IIoTEventLogFacade {
  readonly write: <E extends IIoTEvent>(event: E) => Effect.Effect<void, EventWriteError>
  readonly read: (primaryKey: string) => Effect.Effect<ReadonlyArray<EventEntry>, EventReadError>
  readonly replay: (since: DateTime.Utc) => Stream.Stream<EventEntry>
}
```

### Acceptance Criteria

- [ ] `@effect/experimental` pinned to stable version (mitigation from pre-mortem)
- [ ] `IIoTEventLogFacade` abstracts API changes (mitigation from pre-mortem)
- [ ] Tables created via migration (idempotent)
- [ ] Test layer works without PostgreSQL
- [ ] Identity persisted via KeyValueStore

**Estimate:** 13 SP (T-shirt: M)

---

## Epic EL-2: Alarm EventLog Migration (Priority 1)

**Goal:** Migrate AlarmService from CRUD to EventLog while maintaining backward compatibility.

**Dependencies:**
- Epic EL-1 (Infrastructure)
- v3 WBS Epic 8 (Alarm ES Migration)

### Tasks

| ID | Task | Files | Size | Depends On |
|----|------|-------|------|------------|
| EL-2.1 | Create `ES_ENABLED` feature flag | `config/IIoTConfig.ts` | S | - |
| EL-2.2 | Define `AlarmTriggered` event schema | `schemas/events/alarm-events.ts` | S | EL-1.11 |
| EL-2.3 | Define `AlarmAcknowledged` event schema | `schemas/events/alarm-events.ts` | S | EL-2.2 |
| EL-2.4 | Define `AlarmCleared` event schema | `schemas/events/alarm-events.ts` | S | EL-2.2 |
| EL-2.5 | Define `AlarmEscalated` event schema | `schemas/events/alarm-events.ts` | S | EL-2.2 |
| EL-2.6 | Define `AlarmSuppressed` event schema | `schemas/events/alarm-events.ts` | S | EL-2.2 |
| EL-2.7 | Define `AlarmShelved` event schema | `schemas/events/alarm-events.ts` | S | EL-2.2 |
| EL-2.8 | Create `AlarmEvents` EventGroup | `schemas/events/alarm-events.ts` | M | EL-2.2-7 |
| EL-2.9 | Create `AlarmEventHandlers` (EventLog.group) | `services/l2/AlarmEventHandlers.ts` | L | EL-2.8, EL-1 |
| EL-2.10 | Handle `AlarmTriggered` -> insert projection | `services/l2/AlarmEventHandlers.ts` | M | EL-2.9 |
| EL-2.11 | Handle `AlarmAcknowledged` -> update projection | `services/l2/AlarmEventHandlers.ts` | M | EL-2.9 |
| EL-2.12 | Handle `AlarmCleared` -> update projection | `services/l2/AlarmEventHandlers.ts` | M | EL-2.9 |
| EL-2.13 | Handle `AlarmEscalated` -> update + notify | `services/l2/AlarmEventHandlers.ts` | M | EL-2.9 |
| EL-2.14 | Refactor `AlarmService.createAlarm` with flag | `services/l2/AlarmService.ts` | M | EL-2.1, EL-2.9 |
| EL-2.15 | Refactor `AlarmService.acknowledgeAlarm` | `services/l2/AlarmService.ts` | M | EL-2.14 |
| EL-2.16 | Refactor `AlarmService.clearAlarm` | `services/l2/AlarmService.ts` | M | EL-2.14 |
| EL-2.17 | Add `AlarmService.escalateAlarm` | `services/l2/AlarmService.ts` | M | EL-2.14 |
| EL-2.18 | Create `AlarmReactivity` bindings | `services/l2/AlarmReactivity.ts` | M | EL-2.8 |
| EL-2.19 | Add `getAlarmAtTime` temporal query | `services/l2/AlarmService.ts` | M | EL-2.14 |
| EL-2.20 | Add `getAlarmHistory` | `services/l2/AlarmService.ts` | M | EL-2.19 |
| EL-2.21 | Integration test: event -> projection | `__tests__/integration/alarm-events.test.ts` | L | EL-2.14 |
| EL-2.22 | Document AlarmRepo as projection-only | `repos/AlarmRepo.ts` | S | EL-2.14 |

### Feature Flag Pattern (Rollback Capability)

```typescript
// config/IIoTConfig.ts
export interface IIoTConfig {
  readonly esEnabled: boolean  // Toggle ES vs direct CRUD
  readonly esAlarmEnabled: boolean  // Per-domain toggle
  readonly esWorkOrderEnabled: boolean
  readonly esEquipmentStateEnabled: boolean
}

// services/l2/AlarmService.ts
const createAlarm = (params: CreateAlarmParams) =>
  Effect.gen(function* () {
    const config = yield* IIoTConfig

    if (config.esAlarmEnabled) {
      // ES path: emit event, handler updates projection
      yield* eventLog.write(AlarmEvents, 'AlarmTriggered', { ... })
    } else {
      // CRUD fallback: direct insert
      yield* alarmRepo.insert({ ... })
    }

    return yield* getAlarm(alarmId)
  })
```

### Acceptance Criteria

- [ ] Feature flag allows runtime toggle (rollback per pre-mortem)
- [ ] All ISA-18.2 alarm states captured as events
- [ ] Temporal queries work (`getAlarmAtTime`)
- [ ] Reactivity invalidates correct atom families
- [ ] Integration tests pass

**Estimate:** 16 SP (T-shirt: L)

---

## Epic EL-3: Work Order EventLog (Priority 2)

**Goal:** Implement Work Order domain with 46 events across 6 aggregates.

**Dependencies:**
- Epic EL-1 (Infrastructure)
- `thoughts/shared/plans/2026-01-29-work-order-workflow-decomposition.md` (event catalog)

### Event Catalog Summary

| Aggregate | Event Count | Events |
|-----------|-------------|--------|
| **WorkOrder** | 11 | Created, Submitted, Approved, Rejected, Started, Suspended, Resumed, Completed, Failed, Cancelled, Closed |
| **WorkOrderContext** | 10 | ContextCreated, ContextUpdated, ContextSnapshotted, AssetAttached, AssetDetached, ResourceAllocated, ResourceReleased, ExternalRefLinked, ExternalRefUnlinked, ChildWorkOrderSpawned |
| **TaskInstance** | 9 | BecameReady, Started, ProgressUpdated, Blocked, Unblocked, Completed, Failed, Skipped, Compensated |
| **ApprovalRequest** | 6 | Requested, Granted, Rejected, Escalated, Completed, Expired |
| **L3SyncOperation** | 5 | Started, Progress, Completed, Failed, ExternalChangeDetected |
| **WorkflowDefinition** | 5 | Created, Versioned, Activated, Deprecated, Archived |
| **TOTAL** | **46** | |

### Tasks

| ID | Task | Files | Size | Depends On |
|----|------|-------|------|------------|
| **Schemas (46 events)** | | | | |
| EL-3.1 | Define 11 WorkOrder lifecycle events | `schemas/events/work-order-events.ts` | L | EL-1.11 |
| EL-3.2 | Create `WorkOrderEvents` EventGroup | `schemas/events/work-order-events.ts` | M | EL-3.1 |
| EL-3.3 | Define 10 WorkOrderContext events | `schemas/events/context-events.ts` | L | EL-1.11 |
| EL-3.4 | Create `WorkOrderContextEvents` EventGroup | `schemas/events/context-events.ts` | M | EL-3.3 |
| EL-3.5 | Define 9 TaskInstance events | `schemas/events/task-events.ts` | M | EL-1.11 |
| EL-3.6 | Create `TaskInstanceEvents` EventGroup | `schemas/events/task-events.ts` | S | EL-3.5 |
| EL-3.7 | Define 6 ApprovalRequest events | `schemas/events/approval-events.ts` | M | EL-1.11 |
| EL-3.8 | Create `ApprovalEvents` EventGroup | `schemas/events/approval-events.ts` | S | EL-3.7 |
| EL-3.9 | Define 5 L3SyncOperation events | `schemas/events/l3-sync-events.ts` | M | EL-1.11 |
| EL-3.10 | Create `L3SyncEvents` EventGroup | `schemas/events/l3-sync-events.ts` | S | EL-3.9 |
| EL-3.11 | Define 5 WorkflowDefinition events | `schemas/events/definition-events.ts` | M | EL-1.11 |
| EL-3.12 | Create `WorkflowDefinitionEvents` EventGroup | `schemas/events/definition-events.ts` | S | EL-3.11 |
| EL-3.13 | Create combined `IIoTEventLogSchema` | `schemas/events/schema.ts` | M | EL-2.8, EL-3.2-12 |
| **Handlers (6 aggregates)** | | | | |
| EL-3.14 | Create `WorkOrderEventHandlers` | `services/l2/WorkOrderEventHandlers.ts` | L | EL-3.2, EL-1 |
| EL-3.15 | Create `WorkOrderContextEventHandlers` | `services/l2/ContextEventHandlers.ts` | L | EL-3.4 |
| EL-3.16 | Create `TaskInstanceEventHandlers` | `services/l2/TaskEventHandlers.ts` | M | EL-3.6 |
| EL-3.17 | Create `ApprovalEventHandlers` | `services/l2/ApprovalEventHandlers.ts` | M | EL-3.8 |
| EL-3.18 | Create `L3SyncEventHandlers` | `services/l2/L3SyncEventHandlers.ts` | M | EL-3.10 |
| EL-3.19 | Create `WorkflowDefinitionEventHandlers` | `services/l2/DefinitionEventHandlers.ts` | M | EL-3.12 |
| **Context Snapshot Logic** | | | | |
| EL-3.20 | Implement `Context.snapshot()` | `services/l2/WorkOrderContextService.ts` | M | EL-3.4 |
| EL-3.21 | Implement `Context.resolve()` | `services/l2/WorkOrderContextService.ts` | M | EL-3.20 |
| EL-3.22 | Implement version-tracked `Context.update()` | `services/l2/WorkOrderContextService.ts` | M | EL-3.21 |
| **Integration** | | | | |
| EL-3.23 | Integration test: WorkOrder lifecycle | `__tests__/integration/work-order-events.test.ts` | L | EL-3.14 |
| EL-3.24 | Integration test: Context snapshot/resolve | `__tests__/integration/context-events.test.ts` | L | EL-3.22 |

### Acceptance Criteria

- [ ] All 46 events defined with ISA-95/ISA-88 alignment
- [ ] 6 aggregate handlers project to repos
- [ ] WorkOrderContext supports snapshot/resolve duality
- [ ] Version-tracked updates with optimistic concurrency
- [ ] Temporal queries for audit

**Estimate:** 21 SP (T-shirt: XL)

---

## Epic EL-4: Equipment State EventLog (Priority 3)

**Goal:** Track equipment operational state changes for OEE calculations.

**Dependencies:**
- Epic EL-1 (Infrastructure)
- v3 WBS Epic 10 (Equipment State Domain)

### Tasks

| ID | Task | Files | Size | Depends On |
|----|------|-------|------|------------|
| EL-4.1 | Define `EquipmentStateChanged` event | `schemas/events/equipment-state-events.ts` | M | EL-1.11 |
| EL-4.2 | Define `MaintenanceModeEntered` event | `schemas/events/equipment-state-events.ts` | S | EL-4.1 |
| EL-4.3 | Define `MaintenanceModeExited` event | `schemas/events/equipment-state-events.ts` | S | EL-4.1 |
| EL-4.4 | Define `PerformanceDegraded` event | `schemas/events/equipment-state-events.ts` | S | EL-4.1 |
| EL-4.5 | Define `FaultDetected` event | `schemas/events/equipment-state-events.ts` | S | EL-4.1 |
| EL-4.6 | Define `FaultCleared` event | `schemas/events/equipment-state-events.ts` | S | EL-4.1 |
| EL-4.7 | Create `EquipmentStateEvents` EventGroup | `schemas/events/equipment-state-events.ts` | M | EL-4.1-6 |
| EL-4.8 | Add to `IIoTEventLogSchema` | `schemas/events/schema.ts` | S | EL-4.7, EL-3.13 |
| EL-4.9 | Create `EquipmentStateEventHandlers` | `services/l2/EquipmentStateEventHandlers.ts` | L | EL-4.7, EL-1 |
| EL-4.10 | Handle state transitions with validation | `services/l2/EquipmentStateEventHandlers.ts` | M | EL-4.9 |
| EL-4.11 | Implement `getStateAtTime` temporal query | `services/l2/EquipmentStateService.ts` | M | EL-4.9 |
| EL-4.12 | Implement `getDowntimeReport` (OEE) | `services/l2/EquipmentStateService.ts` | M | EL-4.11 |
| EL-4.13 | Create OEE projection handler | `services/l2/OEEProjectionHandler.ts` | L | EL-4.9 |
| EL-4.14 | Integration test: state -> OEE | `__tests__/integration/equipment-state-oee.test.ts` | L | EL-4.13 |

### State Machine (Validated Transitions)

```
┌─────────────────────────────────────────────────────────────────┐
│                 EQUIPMENT STATE MACHINE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│    ┌───────────────┐                                             │
│    │  operational  │◄────────────────────────────────┐          │
│    └───────┬───────┘                                 │          │
│            │                                          │          │
│    ┌───────▼───────┐      ┌─────────────┐            │          │
│    │   degraded    │◄─────│ maintenance │────────────┤          │
│    └───────┬───────┘      └──────▲──────┘            │          │
│            │                     │                    │          │
│    ┌───────▼───────┐             │                    │          │
│    │    faulted    │─────────────┘                    │          │
│    └───────┬───────┘                                  │          │
│            │                                          │          │
│    ┌───────▼───────┐                                  │          │
│    │    offline    │──────────────────────────────────┘          │
│    └───────────────┘                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Acceptance Criteria

- [ ] State transitions validated (prevent invalid)
- [ ] OEE availability calculated from event history
- [ ] `getDowntimeReport` aggregates by reason code
- [ ] Integration with alarm -> equipment state

**Estimate:** 13 SP (T-shirt: L)

---

## Epic EL-5: Regulatory Compliance Events (Priority 4)

**Goal:** Event sourcing for regulated domains: Batch Records, Quality Events, Operator Actions.

**Dependencies:**
- Epic EL-1 (Infrastructure)
- Epic EL-3 (Work Order for batch context)

### Compliance Domains

| Domain | Purpose | Key Events |
|--------|---------|------------|
| **Batch Records** | 21 CFR Part 11, FDA batch traceability | BatchStarted, ParameterRecorded, BatchCompleted, BatchDeviation |
| **Quality Events** | ISO 9001, CAPA tracking | InspectionCompleted, NCROpened, NCRClosed, CAPACreated, CAPAResolved |
| **Operator Actions** | Audit trail for manual interventions | OperatorLogin, ParameterOverride, ManualAcknowledgment, ShiftHandoff |

### Tasks

| ID | Task | Files | Size | Depends On |
|----|------|-------|------|------------|
| **Batch Records Domain** | | | | |
| EL-5.1 | Define `BatchRecordId` identifier | `schemas/identifiers.ts` | S | - |
| EL-5.2 | Define Batch lifecycle events (6) | `schemas/events/batch-events.ts` | M | EL-1.11 |
| EL-5.3 | Create `BatchRecordEvents` EventGroup | `schemas/events/batch-events.ts` | S | EL-5.2 |
| EL-5.4 | Create `BatchRecordEventHandlers` | `services/l2/BatchEventHandlers.ts` | L | EL-5.3, EL-1 |
| EL-5.5 | Implement batch traceability query | `services/l2/BatchRecordService.ts` | M | EL-5.4 |
| **Quality Events Domain** | | | | |
| EL-5.6 | Define Quality event schemas (5) | `schemas/events/quality-events.ts` | M | EL-1.11 |
| EL-5.7 | Create `QualityEvents` EventGroup | `schemas/events/quality-events.ts` | S | EL-5.6 |
| EL-5.8 | Create `QualityEventHandlers` | `services/l2/QualityEventHandlers.ts` | M | EL-5.7 |
| EL-5.9 | Implement NCR-to-CAPA linking | `services/l2/QualityService.ts` | M | EL-5.8 |
| **Operator Actions Domain** | | | | |
| EL-5.10 | Define Operator action events (4) | `schemas/events/operator-events.ts` | M | EL-1.11 |
| EL-5.11 | Create `OperatorActionEvents` EventGroup | `schemas/events/operator-events.ts` | S | EL-5.10 |
| EL-5.12 | Create `OperatorActionEventHandlers` | `services/l2/OperatorEventHandlers.ts` | M | EL-5.11 |
| EL-5.13 | Implement operator audit trail query | `services/l2/OperatorAuditService.ts` | M | EL-5.12 |
| **Integration** | | | | |
| EL-5.14 | Add all groups to `IIoTEventLogSchema` | `schemas/events/schema.ts` | S | EL-5.3, 7, 11 |
| EL-5.15 | Integration test: batch traceability | `__tests__/compliance/batch-traceability.test.ts` | L | EL-5.5 |
| EL-5.16 | Integration test: NCR-CAPA workflow | `__tests__/compliance/ncr-capa.test.ts` | M | EL-5.9 |

### Acceptance Criteria

- [ ] Events immutable (no UPDATE/DELETE on journal)
- [ ] Batch records traceable end-to-end
- [ ] Operator actions include e-signature support
- [ ] CAPA lifecycle complete

**Estimate:** 13 SP (T-shirt: L)

---

## Dependencies Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EVENTLOG WBS DEPENDENCY GRAPH                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  EL-1: Infrastructure                                                        │
│       │                                                                      │
│       ├───────────────┬───────────────┬───────────────┐                     │
│       │               │               │               │                     │
│       ▼               ▼               ▼               ▼                     │
│  EL-2: Alarm     EL-3: Work      EL-4: Equip     EL-5: Regulatory           │
│  (Priority 1)    Order           State          Compliance                   │
│       │          (Priority 2)    (Priority 3)   (Priority 4)                │
│       │               │               │               │                     │
│       │               ├───────────────┤               │                     │
│       │               │               │               │                     │
│       │               ▼               │               │                     │
│       │          IIoTEventLogSchema   │               │                     │
│       │               │               │               │                     │
│       └───────────────┴───────────────┴───────────────┘                     │
│                              │                                               │
│                              ▼                                               │
│                    EventLogStackLayer                                        │
│                    (combined schema)                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cross-Epic Dependencies

| Source | Target | Dependency Type |
|--------|--------|-----------------|
| EL-2, EL-3, EL-4, EL-5 | EL-1 | Foundation - must complete first |
| EL-3 | EL-2 | Alarm-triggered Work Orders |
| EL-4 | EL-2 | Alarm-triggered state changes |
| EL-5 | EL-3 | Work Order context for batch records |
| All epics | EL-3.13 | Schema aggregation |

---

## Risk Assessment

### Tigers (High Impact, Likely)

| Risk | Probability | Impact | Mitigation | WBS Task |
|------|-------------|--------|------------|----------|
| **EventLog API instability** (`@effect/experimental`) | Medium | High | Pin version, create facade abstraction | EL-1.1, EL-1.2 |
| **No rollback during migration** | Medium | High | Feature flags per domain, toggle at runtime | EL-2.1 |
| **Projection inconsistency** (event/projection diverge) | Low | High | Same-transaction writes, integration tests | All handlers |

### Elephants (High Impact, Overlooked)

| Risk | Probability | Impact | Mitigation | WBS Task |
|------|-------------|--------|------------|----------|
| **Team unfamiliar with temporal queries** | Medium | Medium | Spike with Alarm domain first (EL-2.19) | EL-2.19-21 |
| **46 event schemas is a lot** | Low | Medium | Generate from Work Order decomposition doc | EL-3.1-12 |
| **OEE calculation complexity** | Medium | Medium | Use existing TimescaleDB aggregates as baseline | EL-4.12-13 |

### Paper Tigers (Perceived Risks, Lower Than Expected)

| Risk | Reality |
|------|---------|
| "EventLog is too new" | AMS v2 already uses it (76 files reference it) |
| "Performance will suffer" | SqlEventJournal optimized for writes; projections serve reads |
| "Team doesn't know Effect" | Team has been using Effect for 6+ months |

---

## Implementation Order (Sprints)

### Sprint 1: Foundation (EL-1)
- **Focus:** Infrastructure setup, tables, layers
- **Deliverable:** Working `IIoTEventLogStackLayer`
- **Points:** 13 SP

### Sprint 2-3: Alarm Migration (EL-2)
- **Focus:** First ES domain migration with rollback capability
- **Deliverable:** Alarm events + temporal queries
- **Points:** 16 SP

### Sprint 4-5: Work Order (EL-3)
- **Focus:** 46 events, 6 handlers, context snapshot
- **Deliverable:** Complete WorkOrder ES domain
- **Points:** 21 SP

### Sprint 6: Equipment State (EL-4)
- **Focus:** State machine events, OEE projections
- **Deliverable:** Equipment state + OEE integration
- **Points:** 13 SP

### Sprint 7: Regulatory (EL-5)
- **Focus:** Compliance domains for FDA/ISO
- **Deliverable:** Batch records, quality events, operator audit
- **Points:** 13 SP

### Total: ~76 SP / 7 sprints (3.5 months)

---

## Integration Points with v3 WBS

| v3 WBS Task | EventLog WBS Task | Integration Type |
|-------------|-------------------|------------------|
| 7.0.1 (Pin experimental) | EL-1.1 | Same task |
| 7.0.2 (Facade interface) | EL-1.2 | Same task |
| 7.1.1-7.1.3 (DDL) | EL-1.3-5 | Same tasks |
| 7.2.1-7.2.5 (EventLog layer) | EL-1.6-10 | Same tasks |
| 8.0.1 (Feature flag) | EL-2.1 | Same task |
| 8.1.1-8.1.7 (Alarm events) | EL-2.2-8 | Same tasks |
| 8.3.1-8.3.6 (Handlers) | EL-2.9-13 | Same tasks |
| 8.4.1-8.4.7 (Service refactor) | EL-2.14-17 | Same tasks |
| 8.7.1-8.7.3 (Temporal queries) | EL-2.19-20 | Same tasks |
| 9.2.1-9.2.9 (Work order events) | EL-3.1-2 | Subset |
| 10.2.1-10.2.4 (Equipment events) | EL-4.1-7 | Same tasks |

**Note:** This WBS expands on v3 WBS Epics 7-12 with additional detail for:
- Work Order Context events (10 events)
- Regulatory compliance events (15 events)
- Reactivity bindings
- OEE projection handlers

---

## Codebase References

| Component | Location | Purpose |
|-----------|----------|---------|
| AMS v2 SqlEventJournalLayer | `src/lib/ams/v2/base/handlers/sql-event-journal.ts` | Pattern reference |
| AMS v2 EventLogSchema | `src/lib/ams/v2/base/events/schema.ts` | Pattern reference |
| AMS v2 Event handlers | `src/lib/ams/v2/base/handlers/event-handlers.ts` | Pattern reference |
| Work Order event catalog | `thoughts/shared/plans/2026-01-29-work-order-workflow-decomposition.md` | Event definitions |
| ES Boundaries WBS | `thoughts/shared/plans/2026-01-26-es-boundaries-wbs.md` | Domain decisions |
| v3 Architecture WBS | `thoughts/shared/plans/2026-01-26-v3-service-architecture-wbs.md` | Parent WBS |

---

## Summary

| Epic | Story Points | Priority | Sprints |
|------|-------------|----------|---------|
| EL-1: Infrastructure | 13 SP | Foundation | 1 |
| EL-2: Alarm Migration | 16 SP | Priority 1 | 2-3 |
| EL-3: Work Order | 21 SP | Priority 2 | 4-5 |
| EL-4: Equipment State | 13 SP | Priority 3 | 6 |
| EL-5: Regulatory | 13 SP | Priority 4 | 7 |
| **TOTAL** | **76 SP** | - | **7 sprints** |

---

*"The right question is not 'should we use event sourcing?' but 'where does event sourcing pay its complexity cost?'"* — ADR-0012

---

**Generated by Plan Agent (Val)**
**Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>**
