# IIoT EventLog Integration Architecture

**Generated:** 2026-01-29
**Author:** Architect Agent (Val)
**Status:** DESIGN
**Related:**
- `thoughts/shared/plans/2026-01-29-work-order-workflow-decomposition.md`
- `thoughts/shared/plans/2026-01-26-v3-service-architecture-wbs.md`
- `src/lib/ams/v2/base/` (reference implementation)

---

## Executive Summary

This document defines the EventLog integration architecture for IIoT domains. The system unifies:
- **Alarm Events** (ISA-18.2 compliant audit trails)
- **Work Order Events** (46 events across 6 aggregates)
- **Equipment State Events** (OEE calculation, RCA support)
- **Cross-Cutting Concerns** (multi-aggregate transactions, compaction, reactivity)

The architecture leverages `@effect/experimental/EventLog` and `@effect/sql/SqlEventJournal` patterns established in AMS v2, extended for IIoT-specific requirements.

---

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              UI / PRESENTATION                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  AlarmDashboard │  │ WorkOrderQueue  │  │ OEE Dashboard   │                  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                    │                           │
│           ▼                    ▼                    ▼                           │
│  ┌─────────────────────────────────────────────────────────────────┐           │
│  │                    REACTIVE ATOMS LAYER                          │           │
│  │  currentAlarmsAtom │ workOrderQueueAtom │ equipmentStateAtom    │           │
│  │  syncProgressAtom  │ validationStateAtom │ oeeMetricsAtom       │           │
│  └─────────────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Atom.runtime + useAtomValue
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              L3: ORCHESTRATION                                   │
│  ┌─────────────────────────────────────────────────────────────────┐           │
│  │                      IIoTService (Facade)                        │           │
│  │  Coordinates: Alarms + WorkOrders + Equipment + L3 Sync         │           │
│  └─────────────────────────────────────────────────────────────────┘           │
│                                      │                                          │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐                      │
│  │  Alarm   │ WorkOrder│ Task     │ Approval │ Equip    │                      │
│  │ Workflow │ Workflow │ Workflow │ Workflow │ Workflow │                      │
│  └────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘                      │
│       │          │          │          │          │                            │
│       ▼          ▼          ▼          ▼          ▼                            │
│  ┌─────────────────────────────────────────────────────────────────┐           │
│  │                    ACTIVITY LIBRARY                              │           │
│  │  AllocateResource │ LockAsset │ RequestApproval │ SyncToERP     │           │
│  │  ReleaseResource  │ UnlockAsset │ WaitForApproval │ SyncToCmms  │           │
│  └─────────────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Activity.make() + compensation
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              L2: DOMAIN SERVICES                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐              │
│  │   AlarmService   │  │ WorkOrderService │  │EquipmentStateService│           │
│  │   - createAlarm  │  │ - createWorkOrder│  │ - changeState      │            │
│  │   - acknowledge  │  │ - approveOrder   │  │ - enterMaintenance │            │
│  │   - clear        │  │ - completeOrder  │  │ - getStateAtTime   │            │
│  │   - getAtTime    │  │ - cancelOrder    │  │ - getDowntimeReport│            │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘              │
│           │                     │                     │                         │
│  ┌────────┴─────────────────────┴─────────────────────┴───────┐                │
│  │                    RPC CLIENT LAYER                          │                │
│  │  AlarmRpc │ WorkOrderRpc │ TaskRpc │ ApprovalRpc │ StateRpc │                │
│  └─────────────────────────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Entity.handle()
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              L1: ENTITY + EVENT LAYER                            │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐            │
│  │                    CLUSTER ENTITIES                              │            │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │            │
│  │  │ AlarmEntity │  │WorkOrderEntity│ │EquipmentStateEntity│      │            │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │            │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │            │
│  │  │ContextEntity│  │TaskEntity   │  │ApprovalEntity│             │            │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │            │
│  └─────────────────────────────────────────────────────────────────┘            │
│                                      │                                          │
│                                      │ EventLog.emit()                          │
│                                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐            │
│  │                    EVENTLOG INFRASTRUCTURE                       │            │
│  │                                                                  │            │
│  │  ┌──────────────────────────────────────────────────────────┐   │            │
│  │  │           IIoTEventLog (Facade Service)                   │   │            │
│  │  │  - emit<TEvent>(event): Effect<void>                      │   │            │
│  │  │  - read(key, opts): Effect<Event[]>                       │   │            │
│  │  │  - atTime(key, t): Effect<Aggregate>                      │   │            │
│  │  └──────────────────────────────────────────────────────────┘   │            │
│  │                              │                                   │            │
│  │                              ▼                                   │            │
│  │  ┌──────────────────────────────────────────────────────────┐   │            │
│  │  │     @effect/experimental/EventLog + SqlEventJournal       │   │            │
│  │  │     Tables: iiot_event_journal, iiot_event_remotes        │   │            │
│  │  └──────────────────────────────────────────────────────────┘   │            │
│  │                              │                                   │            │
│  │                              ▼                                   │            │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │            │
│  │  │  EventHandlers  │  │   Compaction    │  │   Reactivity    │  │            │
│  │  │  (Projections)  │  │  (Snapshots)    │  │ (Cache Invalidate)│ │            │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │            │
│  └─────────────────────────────────────────────────────────────────┘            │
│                                      │                                          │
│                                      │ Projection writes                        │
│                                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐            │
│  │                    PROJECTION TABLES (Read Models)               │            │
│  │  alarms (current state) │ work_orders │ equipment_states        │            │
│  │  alarm_context (mat view) │ task_instances │ approval_requests  │            │
│  └─────────────────────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ PostgreSQL + TimescaleDB
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              L0: INFRASTRUCTURE                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐              │
│  │   IIoTPgClient   │  │ TimeSeriesClient │  │   GraphClient    │              │
│  │   (PostgreSQL)   │  │  (TimescaleDB)   │  │   (Apache AGE)   │              │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Bounded Context: Alarm Events (ISA-18.2)

### Event Payload Schemas

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// ALARM DOMAIN EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

import { Schema } from 'effect'
import * as EventGroup from '@effect/experimental/EventGroup'
import { AlarmId, DeviceId, AssetId } from './identifiers'
import { AlarmState, AlarmSeverity, AlarmType } from './alarms'

// ─────────────────────────────────────────────────────────────────────────────────
// Event Payloads
// ─────────────────────────────────────────────────────────────────────────────────

/** Alarm triggered event - ISA-18.2 compliant */
export class AlarmTriggeredPayload extends Schema.Class<AlarmTriggeredPayload>(
  'AlarmTriggeredPayload'
)({
  alarmId: AlarmId,
  deviceId: DeviceId,
  assetId: Schema.optional(AssetId),
  alarmType: AlarmType,
  severity: AlarmSeverity,
  message: Schema.optional(Schema.String),
  /** Triggering sensor value (for threshold alarms) */
  triggerValue: Schema.optional(Schema.Number),
  /** Configured threshold that was exceeded */
  thresholdValue: Schema.optional(Schema.Number),
  triggeredAt: Schema.DateTimeUtc,
  /** OPC-UA quality code of triggering reading */
  qualityCode: Schema.optional(Schema.Number),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}) {}

/** Alarm acknowledged by operator */
export class AlarmAcknowledgedPayload extends Schema.Class<AlarmAcknowledgedPayload>(
  'AlarmAcknowledgedPayload'
)({
  alarmId: AlarmId,
  acknowledgedBy: Schema.NonEmptyString,
  acknowledgedAt: Schema.DateTimeUtc,
  comments: Schema.optional(Schema.String),
}) {}

/** Alarm cleared (condition resolved) */
export class AlarmClearedPayload extends Schema.Class<AlarmClearedPayload>(
  'AlarmClearedPayload'
)({
  alarmId: AlarmId,
  clearedAt: Schema.DateTimeUtc,
  /** Value at time of clearing (for threshold alarms) */
  clearValue: Schema.optional(Schema.Number),
  /** Auto-cleared vs manual */
  autoClear: Schema.Boolean,
}) {}

/** Alarm escalated due to no response */
export class AlarmEscalatedPayload extends Schema.Class<AlarmEscalatedPayload>(
  'AlarmEscalatedPayload'
)({
  alarmId: AlarmId,
  escalatedAt: Schema.DateTimeUtc,
  escalationLevel: Schema.Number.pipe(Schema.int(), Schema.positive()),
  /** New assignees after escalation */
  escalatedTo: Schema.Array(Schema.String),
  /** Time since alarm triggered (seconds) */
  elapsedSeconds: Schema.Number,
  reason: Schema.String,
}) {}

/** Alarm shelved (temporary suppression with expiry) */
export class AlarmShelvedPayload extends Schema.Class<AlarmShelvedPayload>(
  'AlarmShelvedPayload'
)({
  alarmId: AlarmId,
  shelvedBy: Schema.NonEmptyString,
  shelvedAt: Schema.DateTimeUtc,
  shelvedUntil: Schema.DateTimeUtc,
  /** ISA-18.2 requires reason for shelving */
  reason: Schema.NonEmptyString,
}) {}

/** Alarm unshelved (shelve period expired or manual) */
export class AlarmUnshelvedPayload extends Schema.Class<AlarmUnshelvedPayload>(
  'AlarmUnshelvedPayload'
)({
  alarmId: AlarmId,
  unshelvedAt: Schema.DateTimeUtc,
  /** true if shelve period expired, false if manual */
  autoUnshelve: Schema.Boolean,
  unshelvedBy: Schema.optional(Schema.String),
}) {}

/** Alarm suppressed (design-level suppression) */
export class AlarmSuppressedPayload extends Schema.Class<AlarmSuppressedPayload>(
  'AlarmSuppressedPayload'
)({
  alarmId: AlarmId,
  suppressedBy: Schema.NonEmptyString,
  suppressedAt: Schema.DateTimeUtc,
  reason: Schema.NonEmptyString,
  /** Related work order if suppression is for maintenance */
  workOrderId: Schema.optional(Schema.String),
}) {}

/** Alarm taken out of service (disabled for maintenance) */
export class AlarmOutOfServicePayload extends Schema.Class<AlarmOutOfServicePayload>(
  'AlarmOutOfServicePayload'
)({
  alarmId: AlarmId,
  disabledBy: Schema.NonEmptyString,
  disabledAt: Schema.DateTimeUtc,
  reason: Schema.NonEmptyString,
  /** Related work order ID */
  workOrderId: Schema.optional(Schema.String),
  /** Expected return to service */
  expectedReturnAt: Schema.optional(Schema.DateTimeUtc),
}) {}

/** Alarm returned to service */
export class AlarmReturnedToServicePayload extends Schema.Class<AlarmReturnedToServicePayload>(
  'AlarmReturnedToServicePayload'
)({
  alarmId: AlarmId,
  enabledBy: Schema.NonEmptyString,
  enabledAt: Schema.DateTimeUtc,
  /** Duration out of service (seconds) */
  outOfServiceDuration: Schema.Number,
}) {}

/** Alarm configuration changed (setpoint, priority) */
export class AlarmConfigChangedPayload extends Schema.Class<AlarmConfigChangedPayload>(
  'AlarmConfigChangedPayload'
)({
  alarmId: AlarmId,
  changedBy: Schema.NonEmptyString,
  changedAt: Schema.DateTimeUtc,
  previousSeverity: Schema.optional(AlarmSeverity),
  newSeverity: Schema.optional(AlarmSeverity),
  previousThreshold: Schema.optional(Schema.Number),
  newThreshold: Schema.optional(Schema.Number),
  reason: Schema.NonEmptyString,
}) {}

// ─────────────────────────────────────────────────────────────────────────────────
// Event Group
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Alarm Events EventGroup
 *
 * primaryKey: alarmId (routes all events for an alarm to same entity)
 */
export const AlarmEvents = EventGroup.empty
  .add({
    tag: 'AlarmTriggered',
    payload: AlarmTriggeredPayload,
    primaryKey: (p) => p.alarmId,
  })
  .add({
    tag: 'AlarmAcknowledged',
    payload: AlarmAcknowledgedPayload,
    primaryKey: (p) => p.alarmId,
  })
  .add({
    tag: 'AlarmCleared',
    payload: AlarmClearedPayload,
    primaryKey: (p) => p.alarmId,
  })
  .add({
    tag: 'AlarmEscalated',
    payload: AlarmEscalatedPayload,
    primaryKey: (p) => p.alarmId,
  })
  .add({
    tag: 'AlarmShelved',
    payload: AlarmShelvedPayload,
    primaryKey: (p) => p.alarmId,
  })
  .add({
    tag: 'AlarmUnshelved',
    payload: AlarmUnshelvedPayload,
    primaryKey: (p) => p.alarmId,
  })
  .add({
    tag: 'AlarmSuppressed',
    payload: AlarmSuppressedPayload,
    primaryKey: (p) => p.alarmId,
  })
  .add({
    tag: 'AlarmOutOfService',
    payload: AlarmOutOfServicePayload,
    primaryKey: (p) => p.alarmId,
  })
  .add({
    tag: 'AlarmReturnedToService',
    payload: AlarmReturnedToServicePayload,
    primaryKey: (p) => p.alarmId,
  })
  .add({
    tag: 'AlarmConfigChanged',
    payload: AlarmConfigChangedPayload,
    primaryKey: (p) => p.alarmId,
  })

export type AlarmEvent = EventGroup.EventGroup.Events<typeof AlarmEvents>
```

### State Aggregation Logic

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// ALARM AGGREGATE (Fold Events -> Current State)
// ═══════════════════════════════════════════════════════════════════════════════

import { Match, pipe } from 'effect'

/** Alarm aggregate state */
export interface AlarmAggregate {
  alarmId: AlarmId
  deviceId: DeviceId
  assetId?: AssetId
  alarmType: AlarmType
  severity: AlarmSeverity
  state: AlarmState
  message?: string
  triggeredAt: Date
  acknowledgedAt?: Date
  acknowledgedBy?: string
  clearedAt?: Date
  shelvedUntil?: Date
  escalationLevel: number
  version: number
}

/** Initial aggregate state */
export const initialAlarmAggregate = (): Partial<AlarmAggregate> => ({
  state: 'cleared' as AlarmState,
  escalationLevel: 0,
  version: 0,
})

/**
 * Fold alarm events into aggregate state.
 * Used for temporal queries and compaction.
 */
export const foldAlarmEvents = (
  state: Partial<AlarmAggregate>,
  event: AlarmEvent
): Partial<AlarmAggregate> =>
  pipe(
    Match.value(event),
    Match.tag('AlarmTriggered', (e) => ({
      ...state,
      alarmId: e.payload.alarmId,
      deviceId: e.payload.deviceId,
      assetId: e.payload.assetId,
      alarmType: e.payload.alarmType,
      severity: e.payload.severity,
      state: 'unacknowledged' as AlarmState,
      message: e.payload.message,
      triggeredAt: e.payload.triggeredAt,
      acknowledgedAt: undefined,
      acknowledgedBy: undefined,
      clearedAt: undefined,
      escalationLevel: 0,
      version: (state.version ?? 0) + 1,
    })),
    Match.tag('AlarmAcknowledged', (e) => ({
      ...state,
      state: 'acknowledged' as AlarmState,
      acknowledgedAt: e.payload.acknowledgedAt,
      acknowledgedBy: e.payload.acknowledgedBy,
      version: (state.version ?? 0) + 1,
    })),
    Match.tag('AlarmCleared', (e) => ({
      ...state,
      state: 'cleared' as AlarmState,
      clearedAt: e.payload.clearedAt,
      version: (state.version ?? 0) + 1,
    })),
    Match.tag('AlarmEscalated', (e) => ({
      ...state,
      escalationLevel: e.payload.escalationLevel,
      version: (state.version ?? 0) + 1,
    })),
    Match.tag('AlarmShelved', (e) => ({
      ...state,
      state: 'shelved' as AlarmState,
      shelvedUntil: e.payload.shelvedUntil,
      version: (state.version ?? 0) + 1,
    })),
    Match.tag('AlarmUnshelved', () => ({
      ...state,
      state: (state.acknowledgedAt ? 'acknowledged' : 'unacknowledged') as AlarmState,
      shelvedUntil: undefined,
      version: (state.version ?? 0) + 1,
    })),
    Match.tag('AlarmSuppressed', () => ({
      ...state,
      state: 'suppressed' as AlarmState,
      version: (state.version ?? 0) + 1,
    })),
    Match.tag('AlarmOutOfService', () => ({
      ...state,
      state: 'out_of_service' as AlarmState,
      version: (state.version ?? 0) + 1,
    })),
    Match.tag('AlarmReturnedToService', () => ({
      ...state,
      state: (state.clearedAt ? 'cleared' : 'unacknowledged') as AlarmState,
      version: (state.version ?? 0) + 1,
    })),
    Match.tag('AlarmConfigChanged', (e) => ({
      ...state,
      severity: e.payload.newSeverity ?? state.severity,
      version: (state.version ?? 0) + 1,
    })),
    Match.exhaustive
  )

/**
 * Reconstruct alarm state at a specific point in time.
 * Core primitive for temporal queries.
 */
export const getAlarmAtTime = (
  events: AlarmEvent[],
  asOf: Date
): Partial<AlarmAggregate> => {
  const relevantEvents = events.filter((e) => {
    const eventTime = 'triggeredAt' in e.payload 
      ? e.payload.triggeredAt 
      : 'acknowledgedAt' in e.payload
      ? e.payload.acknowledgedAt
      : (e.payload as any).clearedAt ?? (e.payload as any).changedAt
    return eventTime <= asOf
  })
  return relevantEvents.reduce(foldAlarmEvents, initialAlarmAggregate())
}
```

### ISA-18.2 Compliance Requirements

| Requirement | Implementation |
|-------------|----------------|
| **Full Audit Trail** | All state changes as immutable events |
| **Shelve Time Limits** | `shelvedUntil` field with max 24hr policy |
| **Suppression Reason** | Required `reason` field on AlarmSuppressed |
| **Out-of-Service Tracking** | AlarmOutOfService/ReturnedToService events |
| **Acknowledgment Recording** | `acknowledgedBy`, `acknowledgedAt` fields |
| **Escalation History** | AlarmEscalated events with level tracking |
| **Configuration Audit** | AlarmConfigChanged events for setpoint changes |

---

## Bounded Context: Work Order Events

### Event Summary (46 Events, 6 Aggregates)

| Aggregate | Event Count | Events |
|-----------|-------------|--------|
| **WorkOrder** | 11 | Created, Submitted, Approved, Rejected, Started, Suspended, Resumed, Completed, Failed, Cancelled, Closed |
| **WorkOrderContext** | 10 | ContextCreated, ContextUpdated, ContextSnapshotted, AssetAttached, AssetDetached, ResourceAllocated, ResourceReleased, ExternalRefLinked, ExternalRefUnlinked, ChildWorkOrderSpawned |
| **TaskInstance** | 9 | BecameReady, Started, ProgressUpdated, Blocked, Unblocked, Completed, Failed, Skipped, Compensated |
| **ApprovalRequest** | 6 | Requested, Granted, Rejected, Escalated, Completed, Expired |
| **L3SyncOperation** | 5 | Started, Progress, Completed, Failed, ExternalChangeDetected |
| **WorkflowDefinition** | 5 | Created, Versioned, Activated, Deprecated, Archived |

### Event Group Composition

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// WORK ORDER DOMAIN EVENT GROUPS
// ═══════════════════════════════════════════════════════════════════════════════

import * as EventGroup from '@effect/experimental/EventGroup'
import * as EventLog from '@effect/experimental/EventLog'

// Import all event payloads (defined in work-order-decomposition.md)
import {
  // WorkOrder aggregate
  WorkOrderCreated, WorkOrderSubmitted, WorkOrderApproved, WorkOrderRejected,
  WorkOrderStarted, WorkOrderSuspended, WorkOrderResumed, WorkOrderCompleted,
  WorkOrderFailed, WorkOrderCancelled, WorkOrderClosed,
  // WorkOrderContext aggregate
  ContextCreated, ContextUpdated, ContextSnapshotted, AssetAttached,
  AssetDetached, ResourceAllocated, ResourceReleased, ExternalRefLinked,
  ExternalRefUnlinked, ChildWorkOrderSpawned,
  // TaskInstance aggregate
  TaskBecameReady, TaskStarted, TaskProgressUpdated, TaskBlocked,
  TaskUnblocked, TaskCompleted, TaskFailed, TaskSkipped, TaskCompensated,
  // ApprovalRequest aggregate
  ApprovalRequested, ApprovalGranted, ApprovalRejected, ApprovalEscalated,
  ApprovalCompleted, ApprovalExpired,
  // L3SyncOperation aggregate
  L3SyncStarted, L3SyncProgress, L3SyncCompleted, L3SyncFailed,
  ExternalChangeDetected,
  // WorkflowDefinition aggregate
  DefinitionCreated, DefinitionVersioned, DefinitionActivated,
  DefinitionDeprecated, DefinitionArchived,
} from './work-order-event-payloads'

// ─────────────────────────────────────────────────────────────────────────────────
// Individual Event Groups (one per aggregate)
// ─────────────────────────────────────────────────────────────────────────────────

/** WorkOrder lifecycle events */
export const WorkOrderLifecycleEvents = EventGroup.empty
  .add({ tag: 'WorkOrderCreated', payload: WorkOrderCreated, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'WorkOrderSubmitted', payload: WorkOrderSubmitted, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'WorkOrderApproved', payload: WorkOrderApproved, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'WorkOrderRejected', payload: WorkOrderRejected, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'WorkOrderStarted', payload: WorkOrderStarted, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'WorkOrderSuspended', payload: WorkOrderSuspended, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'WorkOrderResumed', payload: WorkOrderResumed, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'WorkOrderCompleted', payload: WorkOrderCompleted, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'WorkOrderFailed', payload: WorkOrderFailed, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'WorkOrderCancelled', payload: WorkOrderCancelled, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'WorkOrderClosed', payload: WorkOrderClosed, primaryKey: (p) => p.workOrderId })

/** WorkOrderContext events */
export const WorkOrderContextEvents = EventGroup.empty
  .add({ tag: 'ContextCreated', payload: ContextCreated, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'ContextUpdated', payload: ContextUpdated, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'ContextSnapshotted', payload: ContextSnapshotted, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'AssetAttached', payload: AssetAttached, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'AssetDetached', payload: AssetDetached, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'ResourceAllocated', payload: ResourceAllocated, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'ResourceReleased', payload: ResourceReleased, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'ExternalRefLinked', payload: ExternalRefLinked, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'ExternalRefUnlinked', payload: ExternalRefUnlinked, primaryKey: (p) => p.workOrderId })
  .add({ tag: 'ChildWorkOrderSpawned', payload: ChildWorkOrderSpawned, primaryKey: (p) => p.parentWorkOrderId })

/** TaskInstance events */
export const TaskInstanceEvents = EventGroup.empty
  .add({ tag: 'TaskBecameReady', payload: TaskBecameReady, primaryKey: (p) => p.taskInstanceId })
  .add({ tag: 'TaskStarted', payload: TaskStarted, primaryKey: (p) => p.taskInstanceId })
  .add({ tag: 'TaskProgressUpdated', payload: TaskProgressUpdated, primaryKey: (p) => p.taskInstanceId })
  .add({ tag: 'TaskBlocked', payload: TaskBlocked, primaryKey: (p) => p.taskInstanceId })
  .add({ tag: 'TaskUnblocked', payload: TaskUnblocked, primaryKey: (p) => p.taskInstanceId })
  .add({ tag: 'TaskCompleted', payload: TaskCompleted, primaryKey: (p) => p.taskInstanceId })
  .add({ tag: 'TaskFailed', payload: TaskFailed, primaryKey: (p) => p.taskInstanceId })
  .add({ tag: 'TaskSkipped', payload: TaskSkipped, primaryKey: (p) => p.taskInstanceId })
  .add({ tag: 'TaskCompensated', payload: TaskCompensated, primaryKey: (p) => p.taskInstanceId })

/** ApprovalRequest events */
export const ApprovalEvents = EventGroup.empty
  .add({ tag: 'ApprovalRequested', payload: ApprovalRequested, primaryKey: (p) => p.approvalId })
  .add({ tag: 'ApprovalGranted', payload: ApprovalGranted, primaryKey: (p) => p.approvalId })
  .add({ tag: 'ApprovalRejected', payload: ApprovalRejected, primaryKey: (p) => p.approvalId })
  .add({ tag: 'ApprovalEscalated', payload: ApprovalEscalated, primaryKey: (p) => p.approvalId })
  .add({ tag: 'ApprovalCompleted', payload: ApprovalCompleted, primaryKey: (p) => p.approvalId })
  .add({ tag: 'ApprovalExpired', payload: ApprovalExpired, primaryKey: (p) => p.approvalId })

/** L3SyncOperation events */
export const L3SyncEvents = EventGroup.empty
  .add({ tag: 'L3SyncStarted', payload: L3SyncStarted, primaryKey: (p) => p.syncId })
  .add({ tag: 'L3SyncProgress', payload: L3SyncProgress, primaryKey: (p) => p.syncId })
  .add({ tag: 'L3SyncCompleted', payload: L3SyncCompleted, primaryKey: (p) => p.syncId })
  .add({ tag: 'L3SyncFailed', payload: L3SyncFailed, primaryKey: (p) => p.syncId })
  .add({ tag: 'ExternalChangeDetected', payload: ExternalChangeDetected, primaryKey: (p) => p.workOrderId })

/** WorkflowDefinition events */
export const WorkflowDefinitionEvents = EventGroup.empty
  .add({ tag: 'DefinitionCreated', payload: DefinitionCreated, primaryKey: (p) => p.definitionId })
  .add({ tag: 'DefinitionVersioned', payload: DefinitionVersioned, primaryKey: (p) => p.definitionId })
  .add({ tag: 'DefinitionActivated', payload: DefinitionActivated, primaryKey: (p) => p.definitionId })
  .add({ tag: 'DefinitionDeprecated', payload: DefinitionDeprecated, primaryKey: (p) => p.definitionId })
  .add({ tag: 'DefinitionArchived', payload: DefinitionArchived, primaryKey: (p) => p.definitionId })
```

### Context Snapshot vs Live Reference Pattern

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT SNAPSHOT VS LIVE REFERENCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * AssetRef: Hybrid reference with optional snapshot.
 *
 * Pattern:
 * - snapshot=true: Capture asset state at attachment time (for audit)
 * - snapshot=false: Live reference, always resolve to current state
 */
export class AssetRef extends Schema.TaggedClass<AssetRef>()('AssetRef', {
  /** Reference to asset */
  assetId: AssetId,
  /** Asset type for quick classification */
  assetType: AssetType,
  /** Snapshot of asset state at attachment time (if captured) */
  snapshot: Schema.optional(AssetSnapshot),
  /** Whether this is a snapshot or live reference */
  isSnapshot: Schema.Boolean,
  /** When attached to work order */
  attachedAt: Schema.DateTimeUtc,
}) {}

/**
 * WorkOrderContext operations
 *
 * snapshot() - Create immutable audit record
 * resolve()  - Get live entity state
 * update()   - Version-tracked mutation
 */
interface WorkOrderContextService {
  /**
   * Create immutable snapshot for audit/compliance.
   * Captures current state of all refs at this moment.
   */
  readonly snapshot: (workOrderId: WorkOrderId) => Effect.Effect<ContextSnapshot, ContextNotFoundError>

  /**
   * Resolve live context state.
   * For snapshot refs: returns captured data.
   * For live refs: queries current entity state.
   */
  readonly resolve: (workOrderId: WorkOrderId) => Effect.Effect<WorkOrderContext, ContextNotFoundError>

  /**
   * Update context with optimistic concurrency.
   * Emits ContextUpdated event with version tracking.
   */
  readonly update: (
    workOrderId: WorkOrderId,
    patch: ContextPatch,
    expectedVersion: number
  ) => Effect.Effect<WorkOrderContext, ContextNotFoundError | VersionConflictError>
}

/**
 * When to use snapshot vs live:
 *
 * | Scenario | Pattern | Rationale |
 * |----------|---------|-----------|
 * | Audit/Compliance | snapshot | Immutable record of state at decision time |
 * | Dashboard display | resolve | Show current asset status |
 * | Report generation | snapshot | Reproducible results |
 * | Task execution | resolve | Need current resource availability |
 * | Historical query | replay events | Full temporal reconstruction |
 */
```

### FDA 21 CFR Part 11 Compliance

| Requirement | Implementation |
|-------------|----------------|
| **Audit Trail** | All events immutable, timestamped, signed |
| **Electronic Signatures** | `approvedBy`, `acknowledgedBy` with identity |
| **Access Control** | Service-level authorization checks |
| **Change Control** | VersionConflictError for concurrent updates |
| **Data Integrity** | EventLog hash chains, no deletion |
| **Record Retention** | Compaction preserves audit trail |

---

## Bounded Context: Equipment State Events

### Event Payloads

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// EQUIPMENT STATE DOMAIN EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Operational states per ISA-88/PackML */
export const OperationalState = Schema.Literal(
  'stopped',      // Machine stopped, ready to start
  'starting',     // Transition to running
  'running',      // Normal production
  'completing',   // Finishing current batch
  'completed',    // Batch complete, awaiting clear
  'stopping',     // Transition to stopped
  'aborting',     // Emergency stop in progress
  'aborted',      // Emergency stop complete
  'holding',      // Temporary hold (operator)
  'held',         // Held state
  'unholding',    // Resuming from hold
  'suspending',   // Suspending due to external cause
  'suspended',    // Suspended (waiting for resource)
  'unsuspending', // Resuming from suspend
  'resetting',    // Returning to initial conditions
  'idle',         // Powered but not producing
  'clearing',     // Clearing faults
  'execute',      // Same as running (PackML term)
)
export type OperationalState = Schema.Schema.Type<typeof OperationalState>

/** Equipment state changed event */
export class EquipmentStateChangedPayload extends Schema.Class<EquipmentStateChangedPayload>(
  'EquipmentStateChangedPayload'
)({
  equipmentId: EquipmentId,
  assetId: AssetId,
  previousState: OperationalState,
  newState: OperationalState,
  changedAt: Schema.DateTimeUtc,
  changedBy: Schema.optional(Schema.String),
  /** Reason code for state change */
  reasonCode: Schema.optional(Schema.String),
  /** Human-readable reason */
  reason: Schema.optional(Schema.String),
  /** Related alarm if state change due to alarm */
  triggeringAlarmId: Schema.optional(AlarmId),
  /** Related work order if in maintenance */
  workOrderId: Schema.optional(WorkOrderId),
}) {}

/** Maintenance mode entered */
export class MaintenanceModeEnteredPayload extends Schema.Class<MaintenanceModeEnteredPayload>(
  'MaintenanceModeEnteredPayload'
)({
  equipmentId: EquipmentId,
  workOrderId: WorkOrderId,
  enteredAt: Schema.DateTimeUtc,
  enteredBy: Schema.NonEmptyString,
  expectedDuration: Schema.optional(Schema.Duration),
}) {}

/** Maintenance mode exited */
export class MaintenanceModeExitedPayload extends Schema.Class<MaintenanceModeExitedPayload>(
  'MaintenanceModeExitedPayload'
)({
  equipmentId: EquipmentId,
  workOrderId: WorkOrderId,
  exitedAt: Schema.DateTimeUtc,
  exitedBy: Schema.NonEmptyString,
  actualDuration: Schema.Duration,
}) {}

/** Downtime reason recorded */
export class DowntimeReasonRecordedPayload extends Schema.Class<DowntimeReasonRecordedPayload>(
  'DowntimeReasonRecordedPayload'
)({
  equipmentId: EquipmentId,
  startedAt: Schema.DateTimeUtc,
  endedAt: Schema.optional(Schema.DateTimeUtc),
  /** OEE loss category */
  lossCategory: Schema.Literal('availability', 'performance', 'quality'),
  /** Detailed reason code */
  reasonCode: Schema.String,
  reason: Schema.String,
  recordedBy: Schema.NonEmptyString,
  recordedAt: Schema.DateTimeUtc,
}) {}

/** Event group */
export const EquipmentStateEvents = EventGroup.empty
  .add({ tag: 'EquipmentStateChanged', payload: EquipmentStateChangedPayload, primaryKey: (p) => p.equipmentId })
  .add({ tag: 'MaintenanceModeEntered', payload: MaintenanceModeEnteredPayload, primaryKey: (p) => p.equipmentId })
  .add({ tag: 'MaintenanceModeExited', payload: MaintenanceModeExitedPayload, primaryKey: (p) => p.equipmentId })
  .add({ tag: 'DowntimeReasonRecorded', payload: DowntimeReasonRecordedPayload, primaryKey: (p) => p.equipmentId })
```

### OEE Calculation from Events

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// OEE METRICS FROM EQUIPMENT STATE EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate OEE components from event stream.
 *
 * OEE = Availability × Performance × Quality
 *
 * Availability = Operating Time / Planned Production Time
 * Performance = (Ideal Cycle Time × Total Count) / Operating Time
 * Quality = Good Count / Total Count
 */
export interface OEEMetrics {
  /** Time range for calculation */
  from: Date
  to: Date
  /** Equipment being measured */
  equipmentId: EquipmentId

  /** Planned production time (seconds) */
  plannedProductionTime: number
  /** Actual operating time (seconds) */
  operatingTime: number
  /** Downtime (seconds) */
  downtime: number

  /** Availability loss breakdown */
  availabilityLosses: {
    unplannedDowntime: number
    plannedDowntime: number
    setupTime: number
  }

  /** OEE percentages */
  availability: number  // 0-1
  performance: number   // 0-1
  quality: number       // 0-1
  oee: number           // 0-1

  /** Top downtime reasons */
  topDowntimeReasons: Array<{
    reasonCode: string
    reason: string
    duration: number
    percentage: number
  }>
}

/**
 * Calculate availability from state events.
 * Availability = Operating Time / Planned Production Time
 */
export const calculateAvailability = (
  events: EquipmentStateEvent[],
  from: Date,
  to: Date
): { operatingTime: number; downtime: number; availability: number } => {
  const plannedTime = (to.getTime() - from.getTime()) / 1000

  // Group events into state intervals
  const intervals = eventsToIntervals(events, from, to)

  const runningStates: OperationalState[] = ['running', 'execute', 'completing']
  const operatingTime = intervals
    .filter((i) => runningStates.includes(i.state))
    .reduce((sum, i) => sum + i.duration, 0)

  const downtime = plannedTime - operatingTime
  const availability = operatingTime / plannedTime

  return { operatingTime, downtime, availability }
}

/**
 * Get equipment state at a specific point in time.
 * Core primitive for RCA temporal queries.
 */
export const getEquipmentStateAtTime = (
  events: EquipmentStateEvent[],
  asOf: Date
): OperationalState => {
  const relevantEvents = events
    .filter((e) => e.payload.changedAt <= asOf)
    .sort((a, b) => a.payload.changedAt.getTime() - b.payload.changedAt.getTime())

  if (relevantEvents.length === 0) return 'idle'

  const lastEvent = relevantEvents[relevantEvents.length - 1]
  return lastEvent.payload.newState
}
```

### RCA Temporal Query Support

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// ROOT CAUSE ANALYSIS TEMPORAL QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RCA query: "What was the system state when this alarm triggered?"
 *
 * Returns correlated state across domains at a point in time.
 */
export interface RCASnapshot {
  asOf: Date
  triggeredBy: {
    type: 'alarm' | 'equipment_state' | 'manual'
    id: string
  }

  /** Alarm states at time of incident */
  alarms: Array<{
    alarmId: AlarmId
    state: AlarmState
    severity: AlarmSeverity
  }>

  /** Equipment states at time of incident */
  equipment: Array<{
    equipmentId: EquipmentId
    state: OperationalState
  }>

  /** Active work orders at time of incident */
  workOrders: Array<{
    workOrderId: WorkOrderId
    status: WorkOrderStatus
    currentTask?: TaskInstanceId
  }>
}

/**
 * Get RCA snapshot at a specific time.
 * Queries all relevant event streams and reconstructs state.
 */
export const getRCASnapshot = (
  alarmEvents: AlarmEvent[],
  equipmentEvents: EquipmentStateEvent[],
  workOrderEvents: WorkOrderEvent[],
  asOf: Date,
  scope: { assetIds?: AssetId[]; alarmId?: AlarmId }
): RCASnapshot => {
  // Reconstruct each domain's state at the given time
  const alarms = reconstructAlarmsAtTime(alarmEvents, asOf, scope.assetIds)
  const equipment = reconstructEquipmentAtTime(equipmentEvents, asOf, scope.assetIds)
  const workOrders = reconstructWorkOrdersAtTime(workOrderEvents, asOf, scope.assetIds)

  return {
    asOf,
    triggeredBy: scope.alarmId
      ? { type: 'alarm', id: scope.alarmId }
      : { type: 'manual', id: 'rca-query' },
    alarms,
    equipment,
    workOrders,
  }
}
```

---

## Cross-Cutting Concerns

### IIoT EventLog Schema (Combined)

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED IIOT EVENTLOG SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

import * as EventLog from '@effect/experimental/EventLog'

/**
 * Combined IIoT EventLog Schema.
 *
 * Aggregates all IIoT event groups into a single EventLog instance.
 * This allows cross-domain queries and unified event processing.
 */
export const IIoTEventLogSchema = EventLog.schema(
  // Alarm domain
  AlarmEvents,
  // Work order domain
  WorkOrderLifecycleEvents,
  WorkOrderContextEvents,
  TaskInstanceEvents,
  ApprovalEvents,
  L3SyncEvents,
  WorkflowDefinitionEvents,
  // Equipment state domain
  EquipmentStateEvents,
)

export type IIoTEventLogSchema = typeof IIoTEventLogSchema
```

### SqlEventJournal Configuration

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// SQL EVENT JOURNAL LAYER
// ═══════════════════════════════════════════════════════════════════════════════

import { Layer } from 'effect'
import * as SqlEventJournal from '@effect/sql/SqlEventJournal'
import * as EventLog from '@effect/experimental/EventLog'

/**
 * SQL-backed EventJournal for IIoT.
 *
 * Creates tables:
 * - iiot_event_journal: event entries (partitioned by aggregate type)
 * - iiot_event_remotes: remote sync tracking for CRDT
 */
export const IIoTSqlEventJournalLayer = SqlEventJournal.layer({
  eventLogTable: 'iiot_event_journal',
  remotesTable: 'iiot_event_remotes',
})

/**
 * Identity layer for EventLog.
 * Production: persist via KeyValueStore.
 * Testing: random identity sufficient.
 */
export const IIoTIdentityLayer = Layer.succeed(
  EventLog.Identity,
  EventLog.Identity.makeRandom()
)

/**
 * EventLog layer using IIoT schema.
 */
export const IIoTEventLogLayer = EventLog.layer(IIoTEventLogSchema)

/**
 * Combined stack layer.
 * Requires: SqlClient.SqlClient (IIoTPgClient)
 */
export const IIoTEventLogStackLayer = IIoTEventLogLayer.pipe(
  Layer.provide(IIoTSqlEventJournalLayer),
  Layer.provide(IIoTIdentityLayer)
)
```

### Compaction Strategy

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// COMPACTION STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Alarm compaction strategy.
 *
 * Alarms compact to either:
 * - AlarmTriggered snapshot (if still active)
 * - AlarmCleared marker (if resolved)
 *
 * Preserves full audit trail for ISA-18.2 compliance.
 */
export const AlarmCompaction = EventLog.groupCompaction(
  AlarmEvents,
  ({ primaryKey, events, write }) =>
    Effect.gen(function* () {
      const finalState = events.reduce(foldAlarmEvents, initialAlarmAggregate())

      if (finalState.state === 'cleared') {
        // Write cleared marker - can be garbage collected after retention
        yield* write('AlarmCleared', {
          alarmId: primaryKey,
          clearedAt: finalState.clearedAt!,
          autoClear: false, // Compaction marker
        })
      } else {
        // Write current state snapshot
        yield* write('AlarmTriggered', {
          alarmId: primaryKey,
          deviceId: finalState.deviceId!,
          assetId: finalState.assetId,
          alarmType: finalState.alarmType!,
          severity: finalState.severity!,
          state: finalState.state,
          message: finalState.message,
          triggeredAt: finalState.triggeredAt!,
          // Include acknowledgment info in snapshot
          metadata: {
            acknowledgedAt: finalState.acknowledgedAt,
            acknowledgedBy: finalState.acknowledgedBy,
            escalationLevel: finalState.escalationLevel,
          },
        })
      }

      yield* Effect.log(`[Compaction] Compacted ${events.length} alarm events for ${primaryKey}`)
    })
)

/**
 * Work order compaction strategy.
 *
 * WorkOrders compact to WorkOrderCreated snapshot with embedded status.
 * Closed work orders can be archived to cold storage.
 */
export const WorkOrderCompaction = EventLog.groupCompaction(
  WorkOrderLifecycleEvents,
  ({ primaryKey, events, write }) =>
    Effect.gen(function* () {
      const finalState = events.reduce(foldWorkOrderEvents, initialWorkOrderAggregate())

      // Write snapshot event with current state
      yield* write('WorkOrderCreated', {
        workOrderId: primaryKey,
        workflowDefinitionId: finalState.workflowDefinitionId!,
        workflowVersion: finalState.workflowVersion!,
        title: finalState.title!,
        description: finalState.description,
        priority: finalState.priority!,
        createdBy: finalState.createdBy!,
        createdAt: finalState.createdAt!,
        scheduledStart: finalState.scheduledStart,
        dueDate: finalState.dueDate,
        // Embed current status in metadata
        metadata: {
          compactedStatus: finalState.status,
          compactedAt: new Date(),
        },
      })

      yield* Effect.log(
        `[Compaction] Compacted ${events.length} work order events for ${primaryKey}`
      )
    })
)
```

### Reactivity Bindings to Atom.runtime

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// REACTIVITY -> ATOM.RUNTIME BINDINGS
// ═══════════════════════════════════════════════════════════════════════════════

import { Atom } from '@effect-rx/rx-react'

/**
 * IIoT cache keys for reactivity.
 */
export const IIOT_CACHE_KEYS = {
  // Alarm domain
  ACTIVE_ALARMS: 'iiot:alarms:active',
  ALARMS_BY_ASSET: 'iiot:alarms:by-asset',
  ALARMS_BY_SEVERITY: 'iiot:alarms:by-severity',
  ALARM_COUNTS: 'iiot:alarms:counts',

  // Work order domain
  ACTIVE_WORK_ORDERS: 'iiot:work-orders:active',
  WORK_ORDERS_BY_ASSET: 'iiot:work-orders:by-asset',
  PENDING_APPROVALS: 'iiot:approvals:pending',
  TASK_QUEUE: 'iiot:tasks:queue',

  // Equipment state domain
  EQUIPMENT_STATES: 'iiot:equipment:states',
  OEE_METRICS: 'iiot:equipment:oee',
} as const

/**
 * Alarm reactivity configuration.
 */
export const AlarmReactivity = EventLog.groupReactivity(AlarmEvents, {
  AlarmTriggered: [
    IIOT_CACHE_KEYS.ACTIVE_ALARMS,
    IIOT_CACHE_KEYS.ALARMS_BY_ASSET,
    IIOT_CACHE_KEYS.ALARMS_BY_SEVERITY,
    IIOT_CACHE_KEYS.ALARM_COUNTS,
  ],
  AlarmAcknowledged: [
    IIOT_CACHE_KEYS.ACTIVE_ALARMS,
    IIOT_CACHE_KEYS.ALARM_COUNTS,
  ],
  AlarmCleared: [
    IIOT_CACHE_KEYS.ACTIVE_ALARMS,
    IIOT_CACHE_KEYS.ALARM_COUNTS,
  ],
  AlarmEscalated: [
    IIOT_CACHE_KEYS.ACTIVE_ALARMS,
  ],
  AlarmShelved: [
    IIOT_CACHE_KEYS.ACTIVE_ALARMS,
  ],
  AlarmUnshelved: [
    IIOT_CACHE_KEYS.ACTIVE_ALARMS,
  ],
  AlarmSuppressed: [
    IIOT_CACHE_KEYS.ACTIVE_ALARMS,
  ],
  AlarmOutOfService: [
    IIOT_CACHE_KEYS.ACTIVE_ALARMS,
    IIOT_CACHE_KEYS.ALARM_COUNTS,
  ],
  AlarmReturnedToService: [
    IIOT_CACHE_KEYS.ACTIVE_ALARMS,
    IIOT_CACHE_KEYS.ALARM_COUNTS,
  ],
  AlarmConfigChanged: [],
})

/**
 * Atom invalidation bridge.
 *
 * Connects EventLog reactivity to Atom.runtime.
 * When cache keys are invalidated, corresponding atoms refresh.
 */
export const connectReactivityToAtoms = (
  invalidatedKeys: readonly string[],
  registry: Atom.Registry
): Effect.Effect<void> =>
  Effect.gen(function* () {
    for (const key of invalidatedKeys) {
      switch (key) {
        case IIOT_CACHE_KEYS.ACTIVE_ALARMS:
          // Trigger refresh of active alarms atom
          yield* Effect.sync(() => registry.refresh(activeAlarmsAtom))
          break
        case IIOT_CACHE_KEYS.ALARM_COUNTS:
          yield* Effect.sync(() => registry.refresh(alarmCountsAtom))
          break
        case IIOT_CACHE_KEYS.ACTIVE_WORK_ORDERS:
          yield* Effect.sync(() => registry.refresh(activeWorkOrdersAtom))
          break
        case IIOT_CACHE_KEYS.EQUIPMENT_STATES:
          yield* Effect.sync(() => registry.refresh(equipmentStatesAtom))
          break
        case IIOT_CACHE_KEYS.OEE_METRICS:
          yield* Effect.sync(() => registry.refresh(oeeMetricsAtom))
          break
        // ... handle other keys
      }
    }
  })
```

### Multi-Aggregate Transactions

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-AGGREGATE TRANSACTIONS (SAGA PATTERN)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Alarm → WorkOrder creation saga.
 *
 * When a critical alarm triggers maintenance work:
 * 1. Emit AlarmTriggered event
 * 2. Create WorkOrder referencing alarm
 * 3. Attach asset context
 * 4. If any step fails, compensate previous steps
 */
export const alarmToWorkOrderSaga = (
  alarm: AlarmTriggeredPayload,
  workflowDefinitionId: WorkflowDefinitionId
): Effect.Effect<WorkOrderId, SagaError, IIoTEventLog | WorkOrderService> =>
  Effect.gen(function* () {
    const eventLog = yield* IIoTEventLog
    const workOrderService = yield* WorkOrderService

    // Step 1: Alarm already emitted by caller

    // Step 2: Create work order
    const workOrder = yield* workOrderService.create({
      workflowDefinitionId,
      title: `Maintenance for alarm: ${alarm.message ?? alarm.alarmType}`,
      priority: severityToPriority(alarm.severity),
      triggeringAlarmId: alarm.alarmId,
    }).pipe(
      Effect.catchAll((e) =>
        // Compensation: cannot undo alarm trigger, just fail saga
        Effect.fail(new SagaError({ step: 'create_work_order', cause: e }))
      )
    )

    // Step 3: Attach asset to context
    yield* workOrderService.attachAsset(workOrder.workOrderId, alarm.assetId!, true).pipe(
      Effect.catchAll((e) =>
        // Compensation: cancel work order
        workOrderService.cancel(workOrder.workOrderId, 'Saga failed: asset attachment').pipe(
          Effect.flatMap(() => Effect.fail(new SagaError({ step: 'attach_asset', cause: e })))
        )
      )
    )

    return workOrder.workOrderId
  })
```

---

## Open Questions for Synthesis

### 1. Event Journal Partitioning Strategy

**Question:** Should we partition the `iiot_event_journal` table by aggregate type or by time?

| Option | Pros | Cons |
|--------|------|------|
| **By aggregate** | Fast per-entity queries | Cross-aggregate queries need joins |
| **By time** | Natural retention, good for time-range queries | Entity reconstruction requires scanning multiple partitions |
| **Hybrid (aggregate + time)** | Best of both | More complex schema, increased maintenance |

**Recommendation:** Hybrid partitioning with PostgreSQL declarative partitioning:
```sql
CREATE TABLE iiot_event_journal (
  ...
) PARTITION BY LIST (aggregate_type);

CREATE TABLE iiot_event_journal_alarm PARTITION OF iiot_event_journal
  FOR VALUES IN ('alarm')
  PARTITION BY RANGE (created_at);
```

### 2. Temporal Query Index Strategy

**Question:** How do we efficiently support `getAlarmAtTime(alarmId, timestamp)` queries?

| Option | Index Size | Query Time | Storage Cost |
|--------|------------|------------|--------------|
| **Full scan** | None | O(n) | Minimal |
| **B-tree on (entity_id, timestamp)** | Medium | O(log n) | Low |
| **Materialized snapshots** | Large | O(1) | High |
| **Checkpoint + scan** | Medium | O(checkpoint_interval) | Medium |

**Recommendation:** B-tree index with periodic checkpoint events:
```sql
CREATE INDEX idx_event_journal_temporal
  ON iiot_event_journal (primary_key, created_at DESC);

-- Generate checkpoint events every N events per entity
-- Temporal query scans from checkpoint to target time
```

### 3. Cross-Domain RCA Query Performance

**Question:** How do we efficiently answer "what was the state of equipment X, alarms on X, and work orders for X at time T"?

**Approaches:**
1. **Sequential queries** - Query each domain separately, merge in application
2. **Materialized RCA view** - Pre-compute cross-domain snapshots at intervals
3. **Graph database** - Use Apache AGE for relationship traversal with temporal constraints

**Recommendation:** Sequential queries with parallel execution + caching:
```typescript
const getRCASnapshot = (assetId: AssetId, asOf: Date) =>
  Effect.all([
    getAlarmAtTime(assetId, asOf),
    getEquipmentStateAtTime(assetId, asOf),
    getWorkOrdersAtTime(assetId, asOf),
  ], { concurrency: 'unbounded' })
```

### 4. L3 Sync Conflict Resolution

**Question:** When external system (ERP) changes conflict with local events, which wins?

| Scenario | Resolution Strategy |
|----------|---------------------|
| ERP updates work order status | **ERP wins** - emit reconciliation event |
| Local task completion vs ERP cancellation | **ERP wins** with compensation |
| Resource allocation conflict | **Lock-based** - first sync wins, second retries |

**Recommendation:** External system as source of truth with local compensation:
```typescript
// ExternalChangeDetected handler
Match.tag('ExternalChangeDetected', (e) =>
  Effect.gen(function* () {
    if (e.payload.changeType === 'status_change') {
      // Record discrepancy event
      yield* eventLog.emit(new LocalStateOverridden({
        workOrderId: e.payload.workOrderId,
        localStatus: localState.status,
        externalStatus: e.payload.newStatus,
        reconciledAt: DateTime.now,
      }))
      // Update local projection to match external
      yield* updateLocalProjection(e.payload)
    }
  })
)
```

### 5. Compaction Retention Policy

**Question:** How long do we retain event history before compaction?

| Domain | Retention (hot) | Compaction Trigger | Archive (cold) |
|--------|-----------------|-------------------|----------------|
| Alarms | 90 days | >1000 events/entity | 7 years |
| Work Orders | 180 days | Closed + 30 days | 10 years (FDA) |
| Equipment State | 30 days | >500 events/entity | 2 years |

**Recommendation:** Configurable per domain with regulatory compliance defaults:
```typescript
const IIoTCompactionConfig = {
  alarm: {
    hotRetention: Duration.days(90),
    triggerThreshold: 1000,
    coldRetention: Duration.years(7),
  },
  workOrder: {
    hotRetention: Duration.days(180),
    triggerThreshold: 'status:closed + Duration.days(30)',
    coldRetention: Duration.years(10), // FDA 21 CFR Part 11
  },
  equipmentState: {
    hotRetention: Duration.days(30),
    triggerThreshold: 500,
    coldRetention: Duration.years(2),
  },
}
```

---

## Success Criteria

1. **ISA-18.2 Compliance**: Full alarm audit trail with all required transitions
2. **FDA 21 CFR Part 11**: Electronic signatures, access control, data integrity
3. **OEE Calculation**: Equipment state events support availability/performance/quality
4. **Temporal Queries**: `getXAtTime()` primitives for all domains
5. **RCA Support**: Cross-domain state reconstruction at any point in time
6. **Reactivity**: UI atoms auto-refresh on relevant event writes
7. **Performance**: <100ms for single-entity temporal queries, <1s for RCA snapshots

---

## Implementation Priority

| Phase | Deliverable | Dependencies | Estimate |
|-------|-------------|--------------|----------|
| 1 | IIoTEventLog facade + SqlEventJournal tables | IIoTPgClient | 3 days |
| 2 | AlarmEvents group + handlers + compaction | Phase 1 | 5 days |
| 3 | WorkOrder event groups (all 6 aggregates) | Phase 1 | 8 days |
| 4 | EquipmentStateEvents + OEE calculation | Phase 1 | 4 days |
| 5 | Temporal query primitives | Phases 2-4 | 5 days |
| 6 | Reactivity → Atom.runtime bridge | Phases 2-4 | 3 days |
| 7 | Cross-domain RCA queries | Phase 5 | 3 days |
| 8 | Compaction policies + cold storage | Phases 2-4 | 4 days |

**Total Estimate:** 35 days (~7 sprints)
