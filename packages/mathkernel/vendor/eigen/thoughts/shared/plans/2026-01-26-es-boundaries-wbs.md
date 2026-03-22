# ES Boundaries Implementation - Work Breakdown Structure

**Generated**: 2026-01-26
**Author**: Plan Agent (Val)
**Based On**: ADR-0012-event-sourcing-boundaries-iiot.md, v3-service-architecture.md
**Status**: Draft

---

## Executive Summary

This WBS covers the implementation of Event Sourcing (ES) boundaries as defined in ADR-0012. The ADR establishes a hybrid persistence strategy where:

- **ES Domains**: Alarm Lifecycle, Work Orders, Equipment State Changes
- **Non-ES Domains**: Telemetry (TimescaleDB), Equipment Hierarchy (AGE graph), Device Configuration (CRUD + audit)

The core insight is the litmus test: *"Would replaying the events teach us something about business decisions?"*

### Current State Analysis

| Domain | Current Implementation | Target State |
|--------|----------------------|--------------|
| **Alarms** | `AlarmService` (CRUD), `AlarmEntity` (Effect.Ref), `AlarmRepo` | EventLog + Projection Repo |
| **Work Orders** | Not implemented | New ES domain |
| **Equipment State** | Not explicitly tracked | New ES domain |
| **Telemetry** | `TimeSeriesClient` (TimescaleDB) | Validate as non-ES (no changes) |
| **Equipment Hierarchy** | `GraphClient` (Apache AGE) | Validate as non-ES (no changes) |
| **Device Configuration** | Not implemented | New CRUD + audit log domain |

---

## Epic 1: Event Sourcing Infrastructure

**Goal**: Establish the foundational EventLog and SqlEventJournal infrastructure for PostgreSQL.

### 1.1 EventJournal Schema & Migration

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 1.1.1 | Create `effect_event_journal` table DDL | `models/events/EventJournalModel.ddl.ts` | S |
| 1.1.2 | Create `effect_event_remotes` table DDL | `models/events/EventJournalModel.ddl.ts` | S |
| 1.1.3 | Add migration `0014_event_journal` to `_migrations.ts` | `models/_migrations.ts` | S |
| 1.1.4 | Test migration runs idempotently | `__tests__/models.integration.test.ts` | S |

**SqlEventJournal Schema** (from `@effect/sql`):
```sql
CREATE TABLE IF NOT EXISTS effect_event_journal (
  id UUID PRIMARY KEY,
  event TEXT NOT NULL,
  primary_key TEXT NOT NULL,
  payload BYTEA NOT NULL,
  timestamp BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS effect_event_remotes (
  remote_id UUID NOT NULL,
  entry_id UUID NOT NULL,
  sequence INT NOT NULL,
  PRIMARY KEY (remote_id, entry_id)
);
```

### 1.2 EventLog Service Layer

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 1.2.1 | Create `IIoTEventLogConfig` context tag | `services/l1/IIoTEventLog.ts` | S |
| 1.2.2 | Create `IIoTEventLogLive` layer using `SqlEventJournal.layer` | `services/l1/IIoTEventLog.ts` | M |
| 1.2.3 | Create test layer `IIoTEventLogTest` with in-memory journal | `services/l1/IIoTEventLog.ts` | M |
| 1.2.4 | Export from `services/l1/index.ts` | `services/l1/index.ts` | S |
| 1.2.5 | Integration test: write event, read entries | `__tests__/integration/event-journal.test.ts` | M |

**Code Pattern**:
```typescript
import { SqlEventJournal } from '@effect/sql'
import { EventJournal } from '@effect/experimental/EventJournal'

export const IIoTEventLogLive = SqlEventJournal.layer({
  entryTable: 'iiot_event_journal',  // namespaced for iiot domain
  remotesTable: 'iiot_event_remotes',
})
```

### 1.3 Event Schema Foundation

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 1.3.1 | Create `schemas/events/base.ts` with common event fields | `schemas/events/base.ts` | S |
| 1.3.2 | Define `EventMetadata` schema (timestamp, actor, correlationId) | `schemas/events/base.ts` | S |
| 1.3.3 | Create `Event.make` wrapper for consistent event creation | `schemas/events/base.ts` | M |
| 1.3.4 | Export from `schemas/index.ts` | `schemas/index.ts` | S |

**Acceptance Criteria**:
- [ ] SqlEventJournal tables created by migration
- [ ] EventLog service can write and read events
- [ ] Test layer works without database
- [ ] All event schemas include metadata

---

## Epic 2: Alarm Domain Migration to ES

**Goal**: Migrate the existing Alarm domain from CRUD to Event Sourcing while maintaining backward compatibility.

### 2.1 Alarm Event Definitions

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 2.1.1 | Define `AlarmTriggered` event schema | `schemas/events/alarm-events.ts` | S |
| 2.1.2 | Define `AlarmAcknowledged` event schema | `schemas/events/alarm-events.ts` | S |
| 2.1.3 | Define `AlarmCleared` event schema | `schemas/events/alarm-events.ts` | S |
| 2.1.4 | Define `AlarmEscalated` event schema | `schemas/events/alarm-events.ts` | S |
| 2.1.5 | Define `AlarmSuppressed` event schema | `schemas/events/alarm-events.ts` | S |
| 2.1.6 | Create `AlarmEvent` union type | `schemas/events/alarm-events.ts` | S |
| 2.1.7 | Create `AlarmEventGroup` using `EventGroup.make` | `schemas/events/alarm-events.ts` | M |

**Event Schema Example**:
```typescript
import * as Event from '@effect/experimental/Event'
import { Schema } from 'effect'

export class AlarmTriggered extends Event.Event('AlarmTriggered', {
  alarmId: AlarmId,
  deviceId: DeviceId,
  alarmType: AlarmType,
  severity: AlarmSeverity,
  message: Schema.optional(Schema.String),
  triggeredAt: Schema.DateTimeUtc,
  triggeredBy: Schema.optional(Schema.String),  // system or user
}) {}

export class AlarmAcknowledged extends Event.Event('AlarmAcknowledged', {
  alarmId: AlarmId,
  acknowledgedBy: Schema.String,
  acknowledgedAt: Schema.DateTimeUtc,
  notes: Schema.optional(Schema.String),
}) {}

export class AlarmCleared extends Event.Event('AlarmCleared', {
  alarmId: AlarmId,
  clearedAt: Schema.DateTimeUtc,
  clearedBy: Schema.optional(Schema.String),  // system auto-clear or user
  resolution: Schema.optional(Schema.String),
}) {}

export class AlarmEscalated extends Event.Event('AlarmEscalated', {
  alarmId: AlarmId,
  escalatedTo: Schema.String,  // role or user
  escalatedAt: Schema.DateTimeUtc,
  reason: Schema.String,
}) {}

export const AlarmEvents = EventGroup.make({
  AlarmTriggered,
  AlarmAcknowledged,
  AlarmCleared,
  AlarmEscalated,
})
```

### 2.2 Alarm Aggregate Projection

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 2.2.1 | Define `AlarmAggregate` type (derived from events) | `schemas/events/alarm-aggregate.ts` | M |
| 2.2.2 | Implement `foldAlarmEvents` reducer function | `schemas/events/alarm-aggregate.ts` | M |
| 2.2.3 | Create `AlarmStatus` derived type ('active', 'acknowledged', 'cleared', 'escalated') | `schemas/events/alarm-aggregate.ts` | S |
| 2.2.4 | Unit test aggregate projection logic | `__tests__/schemas/alarm-aggregate.test.ts` | M |

**Aggregate Pattern**:
```typescript
export interface AlarmAggregate {
  readonly id: AlarmId
  readonly deviceId: DeviceId
  readonly alarmType: AlarmType
  readonly severity: AlarmSeverity
  readonly status: AlarmStatus
  readonly triggeredAt: DateTime.Utc
  readonly acknowledgedAt?: DateTime.Utc
  readonly acknowledgedBy?: string
  readonly clearedAt?: DateTime.Utc
  readonly escalations: ReadonlyArray<{
    escalatedTo: string
    escalatedAt: DateTime.Utc
    reason: string
  }>
}

export const foldAlarmEvents = (
  events: ReadonlyArray<AlarmEvent>
): AlarmAggregate | null =>
  events.reduce((agg, event) => {
    switch (event._tag) {
      case 'AlarmTriggered':
        return { ...event, status: 'active', escalations: [] }
      case 'AlarmAcknowledged':
        return agg ? { ...agg, ...event, status: 'acknowledged' } : null
      case 'AlarmCleared':
        return agg ? { ...agg, ...event, status: 'cleared' } : null
      case 'AlarmEscalated':
        return agg ? {
          ...agg,
          status: 'escalated',
          escalations: [...agg.escalations, event]
        } : null
    }
  }, null as AlarmAggregate | null)
```

### 2.3 Alarm Event Handlers (Projection Update)

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 2.3.1 | Create `AlarmEventHandlers` using `EventLog.group` | `services/l2/AlarmEventHandlers.ts` | L |
| 2.3.2 | Handle `AlarmTriggered`: insert into `iiot.alarms` projection | `services/l2/AlarmEventHandlers.ts` | M |
| 2.3.3 | Handle `AlarmAcknowledged`: update projection | `services/l2/AlarmEventHandlers.ts` | M |
| 2.3.4 | Handle `AlarmCleared`: update projection | `services/l2/AlarmEventHandlers.ts` | M |
| 2.3.5 | Handle `AlarmEscalated`: update projection + notify | `services/l2/AlarmEventHandlers.ts` | M |
| 2.3.6 | Integration test: event -> projection update | `__tests__/integration/alarm-events.test.ts` | L |

**Handler Pattern**:
```typescript
export const AlarmEventHandlers = EventLog.group(
  AlarmEvents,
  (handlers) =>
    handlers
      .handle('AlarmTriggered', ({ payload, entry }) =>
        Effect.gen(function* () {
          const repo = yield* AlarmRepo
          yield* repo.insert({
            id: payload.alarmId,
            deviceId: payload.deviceId,
            alarmType: payload.alarmType,
            severity: payload.severity,
            message: Option.fromNullable(payload.message),
            triggeredAt: payload.triggeredAt,
            // acknowledgedAt, clearedAt start as None
          })
          yield* Effect.logInfo(`Alarm ${payload.alarmId} triggered`)
        })
      )
      .handle('AlarmAcknowledged', ({ payload, entry }) =>
        Effect.gen(function* () {
          const repo = yield* AlarmRepo
          yield* repo.acknowledge(payload.alarmId, payload.acknowledgedBy)
          yield* Effect.logInfo(`Alarm ${payload.alarmId} acknowledged by ${payload.acknowledgedBy}`)
        })
      )
      // ... other handlers
)
```

### 2.4 AlarmService Refactor (Commands -> Events)

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 2.4.1 | Refactor `createAlarm` to emit `AlarmTriggered` event | `services/l2/AlarmService.ts` | M |
| 2.4.2 | Refactor `acknowledgeAlarm` to emit `AlarmAcknowledged` event | `services/l2/AlarmService.ts` | M |
| 2.4.3 | Refactor `clearAlarm` to emit `AlarmCleared` event | `services/l2/AlarmService.ts` | M |
| 2.4.4 | Add `escalateAlarm` command emitting `AlarmEscalated` event | `services/l2/AlarmService.ts` | M |
| 2.4.5 | Keep read operations (getAlarm, getAlarms, getStats) unchanged | - | - |
| 2.4.6 | Update service dependencies to require EventLog | `services/l2/AlarmService.ts` | S |
| 2.4.7 | Update integration tests | `__tests__/services.test.ts` | M |

**Write Pattern**:
```typescript
const createAlarm = (params: CreateAlarmParams) =>
  Effect.gen(function* () {
    const log = yield* EventLog.EventLog
    const alarmId = yield* generateAlarmId()
    const now = yield* DateTime.now

    // Write event (handler updates projection in same transaction)
    yield* log.write(AlarmEvents, 'AlarmTriggered', {
      alarmId,
      deviceId: params.deviceId,
      alarmType: params.alarmType,
      severity: params.severity,
      message: params.message,
      triggeredAt: now,
    })

    // Return the projected state
    return yield* getAlarm(alarmId)
  })
```

### 2.5 AlarmEntity Update (ES-backed)

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 2.5.1 | Update `AlarmEntity` handlers to use EventLog instead of Ref | `entity/AlarmEntity.ts` | L |
| 2.5.2 | Remove module-level counter, use proper ID generation | `entity/AlarmEntity.ts` | S |
| 2.5.3 | Update `AlarmLifecycleWorkflow` to work with ES-backed entity | `workflow/AlarmLifecycleWorkflow.ts` | M |
| 2.5.4 | Integration test: entity -> event -> projection | `__tests__/entity/alarm-entity.test.ts` | L |

### 2.6 AlarmRepo as Read-Only Projection

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 2.6.1 | Document `AlarmRepo` as projection-only (no direct writes) | `repos/AlarmRepo.ts` | S |
| 2.6.2 | Add `@readonly` JSDoc markers on mutation methods | `repos/AlarmRepo.ts` | S |
| 2.6.3 | Ensure mutation methods are only called from event handlers | - | - |

### 2.7 Temporal Query Support

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 2.7.1 | Add `getAlarmAtTime(alarmId, asOf)` method | `services/l2/AlarmService.ts` | M |
| 2.7.2 | Implement by replaying events up to `asOf` timestamp | `services/l2/AlarmService.ts` | L |
| 2.7.3 | Add `getAlarmHistory(alarmId)` returning all state transitions | `services/l2/AlarmService.ts` | M |
| 2.7.4 | Test temporal queries | `__tests__/services/alarm-temporal.test.ts` | M |

**Acceptance Criteria**:
- [ ] All alarm state changes go through EventLog
- [ ] Projection table (`iiot.alarms`) stays in sync
- [ ] `getAlarmAtTime` can reconstruct historical state
- [ ] `getAlarmHistory` shows full lifecycle
- [ ] ISA-18.2 audit trail requirements met

---

## Epic 3: Work Order Domain (New ES Domain)

**Goal**: Implement Work Orders as a new event-sourced domain for maintenance tracking.

### 3.1 Work Order Schema Design

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 3.1.1 | Define `WorkOrderId` branded identifier | `schemas/identifiers.ts` | S |
| 3.1.2 | Define `WorkOrderStatus` literal type | `schemas/work-orders.ts` | S |
| 3.1.3 | Define `WorkOrderPriority` literal type | `schemas/work-orders.ts` | S |
| 3.1.4 | Define `WorkOrder` domain schema | `schemas/work-orders.ts` | M |
| 3.1.5 | Define `CreateWorkOrderParams` | `schemas/work-orders.ts` | S |

**Schema Design**:
```typescript
export const WorkOrderId = Schema.String.pipe(Schema.brand('WorkOrderId'))
export type WorkOrderId = Schema.Schema.Type<typeof WorkOrderId>

export const WorkOrderStatus = Schema.Literal(
  'draft', 'submitted', 'approved', 'rejected',
  'in_progress', 'completed', 'closed', 'cancelled'
)

export const WorkOrderPriority = Schema.Literal('low', 'medium', 'high', 'critical')

export class WorkOrder extends Schema.TaggedClass<WorkOrder>()('WorkOrder', {
  id: WorkOrderId,
  assetId: AssetId,  // Equipment being worked on
  alarmId: Schema.optional(AlarmId),  // Triggered by alarm?
  title: Schema.String,
  description: Schema.optional(Schema.String),
  status: WorkOrderStatus,
  priority: WorkOrderPriority,
  assignedTo: Schema.optional(Schema.String),
  createdAt: Schema.DateTimeUtc,
  createdBy: Schema.String,
  submittedAt: Schema.optional(Schema.DateTimeUtc),
  approvedAt: Schema.optional(Schema.DateTimeUtc),
  approvedBy: Schema.optional(Schema.String),
  startedAt: Schema.optional(Schema.DateTimeUtc),
  completedAt: Schema.optional(Schema.DateTimeUtc),
  closedAt: Schema.optional(Schema.DateTimeUtc),
}) {}
```

### 3.2 Work Order Event Definitions

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 3.2.1 | Define `WorkOrderCreated` event | `schemas/events/work-order-events.ts` | S |
| 3.2.2 | Define `WorkOrderSubmitted` event | `schemas/events/work-order-events.ts` | S |
| 3.2.3 | Define `WorkOrderApproved` event | `schemas/events/work-order-events.ts` | S |
| 3.2.4 | Define `WorkOrderRejected` event | `schemas/events/work-order-events.ts` | S |
| 3.2.5 | Define `WorkOrderStarted` event | `schemas/events/work-order-events.ts` | S |
| 3.2.6 | Define `WorkOrderCompleted` event | `schemas/events/work-order-events.ts` | S |
| 3.2.7 | Define `WorkOrderClosed` event | `schemas/events/work-order-events.ts` | S |
| 3.2.8 | Define `WorkOrderCancelled` event | `schemas/events/work-order-events.ts` | S |
| 3.2.9 | Create `WorkOrderEvents` event group | `schemas/events/work-order-events.ts` | M |

### 3.3 Work Order Database Objects

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 3.3.1 | Create `WorkOrderModel` for projection table | `models/work-orders/WorkOrderModel.ts` | M |
| 3.3.2 | Create `WorkOrderModel.ddl.ts` with table DDL | `models/work-orders/WorkOrderModel.ddl.ts` | M |
| 3.3.3 | Add migration `0015_work_orders` | `models/_migrations.ts` | S |
| 3.3.4 | Create `WorkOrderRepo` for projection reads | `repos/WorkOrderRepo.ts` | M |

**Table Schema**:
```sql
CREATE TABLE IF NOT EXISTS iiot.work_orders (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES iiot.machines(id),
  alarm_id TEXT REFERENCES iiot.alarms(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_work_orders_status ON iiot.work_orders(status);
CREATE INDEX idx_work_orders_asset ON iiot.work_orders(asset_id);
CREATE INDEX idx_work_orders_alarm ON iiot.work_orders(alarm_id);
```

### 3.4 Work Order Service Implementation

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 3.4.1 | Create `WorkOrderService` class | `services/l2/WorkOrderService.ts` | L |
| 3.4.2 | Implement `createWorkOrder` (emit `WorkOrderCreated`) | `services/l2/WorkOrderService.ts` | M |
| 3.4.3 | Implement `submitWorkOrder` (emit `WorkOrderSubmitted`) | `services/l2/WorkOrderService.ts` | M |
| 3.4.4 | Implement `approveWorkOrder` (emit `WorkOrderApproved`) | `services/l2/WorkOrderService.ts` | M |
| 3.4.5 | Implement `rejectWorkOrder` (emit `WorkOrderRejected`) | `services/l2/WorkOrderService.ts` | M |
| 3.4.6 | Implement `startWorkOrder` (emit `WorkOrderStarted`) | `services/l2/WorkOrderService.ts` | M |
| 3.4.7 | Implement `completeWorkOrder` (emit `WorkOrderCompleted`) | `services/l2/WorkOrderService.ts` | M |
| 3.4.8 | Implement `closeWorkOrder` (emit `WorkOrderClosed`) | `services/l2/WorkOrderService.ts` | M |
| 3.4.9 | Implement query methods (getWorkOrder, listWorkOrders) | `services/l2/WorkOrderService.ts` | M |
| 3.4.10 | Create `WorkOrderEventHandlers` layer | `services/l2/WorkOrderEventHandlers.ts` | L |

### 3.5 Work Order Entity & RPCs

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 3.5.1 | Create `WorkOrderEntity` definition | `entity/WorkOrderEntity.ts` | M |
| 3.5.2 | Create RPC definitions in `rpc/WorkOrderRpcs.ts` | `rpc/WorkOrderRpcs.ts` | M |
| 3.5.3 | Implement entity handlers | `entity/WorkOrderEntity.ts` | L |
| 3.5.4 | Integration tests | `__tests__/entity/work-order-entity.test.ts` | L |

**Acceptance Criteria**:
- [ ] Work order lifecycle fully event-sourced
- [ ] Approval workflow enforced (draft -> submitted -> approved/rejected -> in_progress -> completed -> closed)
- [ ] Full audit trail for CMMS compliance
- [ ] Link to triggering alarm (if applicable)

---

## Epic 4: Equipment State Domain (New ES Domain)

**Goal**: Track equipment operational state changes for OEE calculations and RCA.

### 4.1 Equipment State Schema Design

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 4.1.1 | Define `EquipmentStateId` branded identifier | `schemas/identifiers.ts` | S |
| 4.1.2 | Define `OperationalState` literal type | `schemas/equipment-state.ts` | S |
| 4.1.3 | Define `EquipmentState` domain schema | `schemas/equipment-state.ts` | M |

**State Machine**:
```typescript
export const OperationalState = Schema.Literal(
  'operational',    // Normal operation
  'degraded',       // Reduced capability
  'faulted',        // Not functional
  'maintenance',    // Planned downtime
  'offline'         // Disconnected
)

// Valid transitions (enforced by event handlers):
// operational -> degraded, faulted, maintenance, offline
// degraded -> operational, faulted, maintenance, offline
// faulted -> maintenance, offline
// maintenance -> operational, offline
// offline -> operational
```

### 4.2 Equipment State Event Definitions

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 4.2.1 | Define `EquipmentStateChanged` event | `schemas/events/equipment-state-events.ts` | M |
| 4.2.2 | Define `MaintenanceModeEntered` event | `schemas/events/equipment-state-events.ts` | S |
| 4.2.3 | Define `MaintenanceModeExited` event | `schemas/events/equipment-state-events.ts` | S |
| 4.2.4 | Create `EquipmentStateEvents` event group | `schemas/events/equipment-state-events.ts` | M |

**Event Schema**:
```typescript
export class EquipmentStateChanged extends Event.Event('EquipmentStateChanged', {
  equipmentId: MachineId,
  previousState: OperationalState,
  newState: OperationalState,
  changedAt: Schema.DateTimeUtc,
  changedBy: Schema.optional(Schema.String),  // user or 'system'
  reason: Schema.optional(Schema.String),
  relatedAlarmId: Schema.optional(AlarmId),
}) {}
```

### 4.3 Equipment State Database Objects

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 4.3.1 | Create `EquipmentStateModel` for current state projection | `models/equipment-state/EquipmentStateModel.ts` | M |
| 4.3.2 | Create `EquipmentStateHistoryModel` for history | `models/equipment-state/EquipmentStateHistoryModel.ts` | M |
| 4.3.3 | Create DDL files | `models/equipment-state/*.ddl.ts` | M |
| 4.3.4 | Add migration `0016_equipment_state` | `models/_migrations.ts` | S |
| 4.3.5 | Create `EquipmentStateRepo` | `repos/EquipmentStateRepo.ts` | M |

### 4.4 Equipment State Service Implementation

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 4.4.1 | Create `EquipmentStateService` class | `services/l2/EquipmentStateService.ts` | L |
| 4.4.2 | Implement `changeState` with transition validation | `services/l2/EquipmentStateService.ts` | M |
| 4.4.3 | Implement `enterMaintenanceMode` | `services/l2/EquipmentStateService.ts` | M |
| 4.4.4 | Implement `exitMaintenanceMode` | `services/l2/EquipmentStateService.ts` | M |
| 4.4.5 | Implement `getCurrentState` | `services/l2/EquipmentStateService.ts` | S |
| 4.4.6 | Implement `getStateHistory` | `services/l2/EquipmentStateService.ts` | M |
| 4.4.7 | Implement `getStateAtTime` (temporal query) | `services/l2/EquipmentStateService.ts` | M |
| 4.4.8 | Create `EquipmentStateEventHandlers` layer | `services/l2/EquipmentStateEventHandlers.ts` | L |

### 4.5 OEE Integration

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 4.5.1 | Calculate downtime from state history | `services/l2/EquipmentStateService.ts` | M |
| 4.5.2 | Add `getDowntimeReport(equipmentId, since, until)` | `services/l2/EquipmentStateService.ts` | M |
| 4.5.3 | Integration test: state transitions -> OEE metrics | `__tests__/services/equipment-state.test.ts` | L |

**Acceptance Criteria**:
- [ ] All state transitions event-sourced
- [ ] State transitions validated (prevent invalid transitions)
- [ ] Full history available for RCA
- [ ] Downtime calculation for OEE

---

## Epic 5: Non-ES Domain Validation

**Goal**: Explicitly validate that non-ES domains are correctly implemented without event sourcing.

### 5.1 Telemetry (Confirm TimescaleDB, NOT ES)

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 5.1.1 | Audit `TimeSeriesClient` - confirm no EventLog dependency | `services/l1/TimeSeriesClient.ts` | S |
| 5.1.2 | Add JSDoc `@persistence TimescaleDB hypertable (NOT event sourced)` | `services/l1/TimeSeriesClient.ts` | S |
| 5.1.3 | Document rationale in code: "High-volume raw data, no business decisions" | `services/l1/TimeSeriesClient.ts` | S |
| 5.1.4 | Add to ADR-0012 appendix as confirmed non-ES | - | S |

**Verification Checklist**:
- [x] Uses `INSERT INTO iiot.sensor_readings` (direct write)
- [x] No EventLog dependency
- [x] TimescaleDB hypertable for efficient time-series queries
- [x] Continuous aggregates for rollups

### 5.2 Equipment Hierarchy (Confirm Graph + CRUD, NOT ES)

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 5.2.1 | Audit `GraphClient` - confirm no EventLog dependency | `services/l1/GraphClient.ts` | S |
| 5.2.2 | Add JSDoc `@persistence Apache AGE graph (NOT event sourced)` | `services/l1/GraphClient.ts` | S |
| 5.2.3 | Document rationale: "Reference data, graph traversal, not temporal" | `services/l1/GraphClient.ts` | S |
| 5.2.4 | Verify asset tables (plants, lines, machines, sensors) are CRUD | `models/assets/*.ts` | S |

**Verification Checklist**:
- [x] Uses Cypher queries for graph traversal
- [x] Asset hierarchy is reference data (rarely changes)
- [x] No temporal query requirements
- [x] No business decisions attached to hierarchy changes

### 5.3 Device Configuration (Implement CRUD + Audit Log)

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 5.3.1 | Create `DeviceConfig` schema | `schemas/device-config.ts` | M |
| 5.3.2 | Create `DeviceConfigModel` | `models/device-config/DeviceConfigModel.ts` | M |
| 5.3.3 | Create `DeviceConfigAuditLogModel` | `models/device-config/DeviceConfigAuditLogModel.ts` | M |
| 5.3.4 | Create DDL files | `models/device-config/*.ddl.ts` | M |
| 5.3.5 | Add migration `0017_device_config` | `models/_migrations.ts` | S |
| 5.3.6 | Create `DeviceConfigRepo` with audit log writes | `repos/DeviceConfigRepo.ts` | M |
| 5.3.7 | Create `DeviceConfigService` | `services/l2/DeviceConfigService.ts` | M |
| 5.3.8 | Add JSDoc `@persistence CRUD + audit log (NOT event sourced)` | - | S |

**Audit Log Pattern** (from ADR-0012):
```typescript
const updateDeviceConfig = (deviceId: DeviceId, config: DeviceConfig) =>
  Effect.gen(function* () {
    const previous = yield* getDeviceConfig(deviceId)

    // Update current state (CRUD)
    yield* sql`
      UPDATE iiot.device_config
      SET sampling_rate = ${config.samplingRate},
          alarm_threshold = ${config.alarmThreshold},
          updated_at = NOW()
      WHERE device_id = ${deviceId}
    `

    // Audit log (NOT event sourcing - just history)
    yield* sql`
      INSERT INTO iiot.config_audit_log (device_id, field, old_value, new_value, changed_by, changed_at)
      SELECT ${deviceId}, key, old.value, new.value, ${userId}, NOW()
      FROM jsonb_each_text(${previous}::jsonb) old
      FULL OUTER JOIN jsonb_each_text(${config}::jsonb) new USING (key)
      WHERE old.value IS DISTINCT FROM new.value
    `
  })
```

**Acceptance Criteria**:
- [ ] All non-ES domains explicitly documented
- [ ] Audit log for config changes (not EventLog)
- [ ] Clear separation from ES domains

---

## Epic 6: Integration & Testing

**Goal**: Ensure ES and non-ES domains integrate correctly and compliance requirements are met.

### 6.1 ES Domain Integration Tests

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 6.1.1 | Test: Alarm triggered -> event stored -> projection updated | `__tests__/integration/alarm-es.test.ts` | L |
| 6.1.2 | Test: Work order lifecycle -> all events stored | `__tests__/integration/work-order-es.test.ts` | L |
| 6.1.3 | Test: Equipment state change -> history available | `__tests__/integration/equipment-state-es.test.ts` | L |
| 6.1.4 | Test: Cross-domain: Alarm -> Work Order creation | `__tests__/integration/alarm-work-order.test.ts` | M |
| 6.1.5 | Test: Replay all events -> consistent state | `__tests__/integration/event-replay.test.ts` | L |

### 6.2 Temporal Query Tests

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 6.2.1 | Test: `getAlarmAtTime` returns correct historical state | `__tests__/services/alarm-temporal.test.ts` | M |
| 6.2.2 | Test: `getEquipmentStateAtTime` returns correct historical state | `__tests__/services/equipment-state-temporal.test.ts` | M |
| 6.2.3 | Test: RCA query across alarm + equipment state | `__tests__/integration/rca-temporal.test.ts` | L |

### 6.3 Compliance Audit Tests

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 6.3.1 | Test: ISA-18.2 alarm audit trail complete | `__tests__/compliance/isa-18-2.test.ts` | M |
| 6.3.2 | Test: Events are immutable (no UPDATE/DELETE on journal) | `__tests__/compliance/immutability.test.ts` | M |
| 6.3.3 | Test: Audit log captures all config changes | `__tests__/compliance/config-audit.test.ts` | M |

### 6.4 Performance Tests

| Task | Description | Files | Estimate |
|------|-------------|-------|----------|
| 6.4.1 | Benchmark: Event write throughput | `__tests__/perf/event-write.bench.ts` | M |
| 6.4.2 | Benchmark: Projection query latency | `__tests__/perf/projection-query.bench.ts` | M |
| 6.4.3 | Benchmark: Temporal query on 10K events | `__tests__/perf/temporal-query.bench.ts` | M |

**Acceptance Criteria**:
- [ ] All integration tests pass
- [ ] Temporal queries return correct historical state
- [ ] ISA-18.2 audit requirements verified
- [ ] Performance acceptable (<100ms for most queries)

---

## Dependencies Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1.1.1 (EventJournal DDL) | - | 1.1.2, 1.2.x, 2.x, 3.x, 4.x |
| 1.2.2 (EventLog layer) | 1.1.x | 2.3.x, 2.4.x, 3.4.x, 4.4.x |
| 2.1.x (Alarm events) | - | 2.2.x, 2.3.x |
| 2.2.x (Alarm aggregate) | 2.1.x | 2.3.x, 2.7.x |
| 2.3.x (Event handlers) | 1.2.x, 2.1.x | 2.4.x |
| 2.4.x (AlarmService refactor) | 2.3.x | 2.5.x, 6.1.1 |
| 3.1.x (Work order schema) | - | 3.2.x, 3.3.x |
| 3.3.x (Work order DB) | 3.1.x | 3.4.x |
| 3.4.x (Work order service) | 1.2.x, 3.2.x, 3.3.x | 6.1.2 |
| 4.1.x (Equipment state schema) | - | 4.2.x, 4.3.x |
| 4.4.x (Equipment state service) | 1.2.x, 4.2.x, 4.3.x | 6.1.3 |
| 5.3.x (Device config) | - | 6.3.3 |
| 6.x (Integration tests) | 2.x, 3.x, 4.x, 5.x | - |

---

## Complexity Estimates

| Epic | T-Shirt Size | Story Points | Rationale |
|------|--------------|--------------|-----------|
| Epic 1: Infrastructure | M | 8 | New pattern, but Effect provides good primitives |
| Epic 2: Alarm Migration | L | 13 | Refactoring existing code with backward compat |
| Epic 3: Work Orders | L | 13 | New domain, but follows established ES pattern |
| Epic 4: Equipment State | M | 8 | Smaller domain, clear state machine |
| Epic 5: Non-ES Validation | S | 3 | Mostly documentation and audit |
| Epic 6: Integration | L | 13 | Comprehensive testing across domains |

**Total Estimated Effort**: ~58 story points / ~4-6 sprints

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **EventLog API changes** (`@effect/experimental`) | Medium | High | Pin version, monitor Effect releases, abstract behind internal interface |
| **Projection consistency** (events and projections diverge) | Low | High | Same-transaction writes, integration tests, monitoring |
| **Migration complexity** (existing alarm data) | Medium | Medium | Backfill events from existing data, test on staging first |
| **Performance degradation** (event writes slower than direct SQL) | Low | Medium | Benchmark early, optimize projection queries |
| **Team learning curve** (ES is new pattern) | Medium | Medium | Spike with alarm domain first, document patterns |
| **Partial adoption confusion** (some ES, some not) | Medium | Low | Clear documentation, code annotations, ADR-0012 as reference |

---

## Implementation Order

### Phase 1: Foundation (Sprint 1)
1. **Epic 1**: Event Sourcing Infrastructure (all tasks)
2. **Epic 5.1-5.2**: Validate telemetry and hierarchy as non-ES

### Phase 2: Alarm Migration (Sprint 2-3)
3. **Epic 2.1-2.3**: Alarm events and handlers
4. **Epic 2.4-2.6**: AlarmService and Entity refactor
5. **Epic 2.7**: Temporal queries
6. **Epic 6.1.1, 6.2.1, 6.3.1**: Alarm integration and compliance tests

### Phase 3: Work Orders (Sprint 3-4)
7. **Epic 3.1-3.3**: Work order schema and database
8. **Epic 3.4-3.5**: Work order service and entity
9. **Epic 6.1.2, 6.1.4**: Work order integration tests

### Phase 4: Equipment State (Sprint 4-5)
10. **Epic 4.1-4.3**: Equipment state schema and database
11. **Epic 4.4-4.5**: Equipment state service and OEE
12. **Epic 6.1.3, 6.2.2, 6.2.3**: Equipment state tests

### Phase 5: Finalization (Sprint 5-6)
13. **Epic 5.3**: Device configuration (CRUD + audit)
14. **Epic 6.3, 6.4**: Compliance and performance tests
15. Documentation updates, ADR-0012 appendix

---

## Codebase References

| Component | Current Location | Purpose |
|-----------|-----------------|---------|
| AlarmService | `src/lib/iiot/services/l2/AlarmService.ts` | To be refactored for ES |
| AlarmEntity | `src/lib/iiot/entity/AlarmEntity.ts` | To be updated for ES-backed state |
| AlarmRepo | `src/lib/iiot/repos/AlarmRepo.ts` | Will become projection-only |
| Alarm schema | `src/lib/iiot/schemas/alarms.ts` | Events will extend from this |
| TimeSeriesClient | `src/lib/iiot/services/l1/TimeSeriesClient.ts` | Confirm non-ES |
| GraphClient | `src/lib/iiot/services/l1/GraphClient.ts` | Confirm non-ES |
| Migrations | `src/lib/iiot/models/_migrations.ts` | Add new migrations |
| SqlEventJournal | `@effect/sql/SqlEventJournal` | Foundation for ES |
| EventLog.group | `@effect/experimental/EventLog` | Event handler pattern |

---

*"The right question is not 'should we use event sourcing?' but 'where does event sourcing pay its complexity cost?'"* - ADR-0012
