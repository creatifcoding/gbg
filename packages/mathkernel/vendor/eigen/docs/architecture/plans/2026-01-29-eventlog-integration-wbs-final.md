# EventLog Integration WBS — Final Synthesis

**Generated:** 2026-01-29
**Status:** READY FOR APPROVAL
**Author:** Val (Swarm Synthesis)

**Research Sources:**
- `eventlog-deepwiki-research.md` — API patterns from @Effect-TS/effect
- `eventlog-submodule-patterns.md` — Canonical patterns from submodules + AMS v2
- `eventlog-iiot-architecture.md` — Layer diagram + event schemas
- `eventlog-wbs-draft.md` — Initial WBS with story points

---

## Executive Summary

This WBS integrates EventLog infrastructure across IIoT domains to achieve:
- **Full audit trail** for regulatory compliance (ISA-18.2, FDA 21 CFR Part 11, ISO 9001)
- **Temporal queries** for RCA and OEE calculations
- **Reactive UI** via atom invalidation on event changes
- **Proven patterns** from AMS v2 reference implementation

### Metrics

| Metric | Value |
|--------|-------|
| **Total Story Points** | 76 SP |
| **Epics** | 5 |
| **Sprints** | 7 (~3.5 months) |
| **Event Schemas** | 66 total |
| **Bounded Contexts** | 6 aggregates |

---

## Canonical API Pattern (Confirmed via Research)

```typescript
// 1. Event Definition (Schema.Class for payloads)
export class AlarmTriggeredPayload extends Schema.Class<AlarmTriggeredPayload>(
  'AlarmTriggeredPayload'
)({
  alarmId: AlarmId,
  deviceId: DeviceId,
  severity: AlarmSeverity,
  triggeredAt: Schema.DateTimeUtc,
}) {}

// 2. EventGroup (builder pattern)
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
  // ... more events

// 3. Schema Composition
export const IIoTEventLogSchema = EventLog.schema(
  AlarmEvents,
  WorkOrderEvents,
  EquipmentStateEvents,
  // ... more groups
)

// 4. Handlers (projections)
export const AlarmEventHandlers = EventLog.group(AlarmEvents, (handlers) =>
  handlers
    .handle('AlarmTriggered', ({ payload, entry }) =>
      Effect.gen(function* () {
        yield* AlarmRepo.insert(payload)
        yield* Effect.log(`Alarm ${payload.alarmId} triggered`)
      })
    )
    .handle('AlarmAcknowledged', ({ payload }) =>
      Effect.gen(function* () {
        yield* AlarmRepo.updateState(payload.alarmId, 'acknowledged')
      })
    )
)

// 5. Compaction (optional - for long-lived aggregates)
export const AlarmCompaction = EventLog.groupCompaction(AlarmEvents, {
  fold: (events) => foldAlarmEvents(events),
  snapshot: (state) => Effect.succeed(createAlarmSnapshot(state)),
})

// 6. Reactivity (cache invalidation)
export const AlarmReactivity = EventLog.groupReactivity(AlarmEvents, {
  AlarmTriggered: ['alarms:active', 'alarms:dashboard'],
  AlarmAcknowledged: ['alarms:active'],
  AlarmCleared: ['alarms:active', 'alarms:history'],
})

// 7. Layer Composition
export const IIoTEventLogLayer = Layer.mergeAll(
  EventLog.layer(IIoTEventLogSchema),
  AlarmEventHandlers,
  AlarmReactivity,
  SqlEventJournal.layer({
    eventLogTable: 'iiot_event_journal',
    remotesTable: 'iiot_event_remotes',
  }),
  EventLog.layerIdentityKvs({ key: 'iiot-eventlog-identity' }),
)
```

---

## Epic EL-1: EventLog Infrastructure (Foundation)

**Goal:** IIoT-specific EventLog infrastructure adapting AMS v2 patterns.
**Story Points:** 13 SP
**Sprint:** 1

### Tasks

| ID | Task | Size | Files |
|----|------|------|-------|
| EL-1.1 | Pin `@effect/experimental` version | S | `package.json` |
| EL-1.2 | Create `IIoTEventLogFacade` service | M | `services/l1/IIoTEventLog.ts` |
| EL-1.3 | Create `iiot_event_journal` table DDL | S | `models/events/EventJournalModel.ddl.ts` |
| EL-1.4 | Create `iiot_event_remotes` table DDL | S | `models/events/EventJournalModel.ddl.ts` |
| EL-1.5 | Migration `0014_iiot_event_journal` | S | `models/_migrations.ts` |
| EL-1.6 | `IIoTEventLogConfig` context tag | S | `services/l1/IIoTEventLog.ts` |
| EL-1.7 | `IIoTSqlEventJournalLayer` | M | `services/l1/IIoTEventLog.ts` |
| EL-1.8 | `IIoTEventLogTest` (in-memory) | M | `services/l1/IIoTEventLog.ts` |
| EL-1.9 | `IIoTIdentityLayer` (KVS-backed) | M | `services/l1/IIoTEventLog.ts` |
| EL-1.10 | `IIoTEventLogStackLayer` (combined) | S | `services/l1/IIoTEventLog.ts` |
| EL-1.11 | Event base schemas (`EventMetadata`) | M | `schemas/events/base.ts` |
| EL-1.12 | `Event.make` wrapper with IIoT metadata | M | `schemas/events/base.ts` |
| EL-1.13 | Integration test: write/read events | L | `__tests__/integration/iiot-event-journal.test.ts` |

### Acceptance Criteria

- [ ] `@effect/experimental` pinned (API stability mitigation)
- [ ] Facade abstracts API changes
- [ ] Tables created via idempotent migration
- [ ] Test layer works without PostgreSQL
- [ ] Identity persisted via KeyValueStore

---

## Epic EL-2: Alarm EventLog Migration (Priority 1)

**Goal:** Migrate AlarmService from CRUD to EventLog with rollback capability.
**Story Points:** 16 SP
**Sprints:** 2-3

### Event Catalog (10 Events)

| Event | Payload Fields | Purpose |
|-------|---------------|---------|
| `AlarmTriggered` | alarmId, deviceId, severity, triggerValue, triggeredAt | Initial alarm |
| `AlarmAcknowledged` | alarmId, acknowledgedBy, acknowledgedAt, comments | Operator ack |
| `AlarmCleared` | alarmId, clearedAt, clearValue, autoClear | Condition resolved |
| `AlarmEscalated` | alarmId, escalationLevel, escalatedTo, elapsedSeconds | No response |
| `AlarmShelved` | alarmId, shelvedBy, shelvedUntil, reason | Temp suppression |
| `AlarmUnshelved` | alarmId, unshelvedAt, autoUnshelve | Shelve ended |
| `AlarmSuppressed` | alarmId, suppressedBy, reason, workOrderId | Design suppression |
| `AlarmOutOfService` | alarmId, reason, workOrderId | Maintenance mode |
| `AlarmReturnedToService` | alarmId, returnedAt, returnedBy | Back online |
| `AlarmConfigChanged` | alarmId, changes, changedBy | Threshold updates |

### Tasks

| ID | Task | Size | Depends On |
|----|------|------|------------|
| EL-2.1 | Feature flag `ES_ALARM_ENABLED` | S | - |
| EL-2.2-7 | Define 10 alarm event schemas | M | EL-1.11 |
| EL-2.8 | Create `AlarmEvents` EventGroup | M | EL-2.2-7 |
| EL-2.9 | `AlarmEventHandlers` (EventLog.group) | L | EL-2.8, EL-1 |
| EL-2.10-13 | Handler for each event type | M each | EL-2.9 |
| EL-2.14-17 | Refactor AlarmService methods | M each | EL-2.1, EL-2.9 |
| EL-2.18 | `AlarmReactivity` bindings | M | EL-2.8 |
| EL-2.19 | `getAlarmAtTime` temporal query | M | EL-2.14 |
| EL-2.20 | `getAlarmHistory` | M | EL-2.19 |
| EL-2.21 | Integration tests | L | EL-2.14 |

### Temporal Query Pattern

```typescript
// Reconstruct alarm state at a specific point in time
const getAlarmAtTime = (alarmId: AlarmId, timestamp: DateTime.Utc) =>
  Effect.gen(function* () {
    const events = yield* eventLog.read(alarmId, { until: timestamp })
    return foldAlarmEvents(events) // Reduce events to state
  })
```

---

## Epic EL-3: Work Order EventLog (Priority 2)

**Goal:** 46 events across 6 aggregates for full work order lifecycle.
**Story Points:** 21 SP
**Sprints:** 4-5

### Event Catalog by Aggregate

| Aggregate | Events | Count |
|-----------|--------|-------|
| **WorkOrder** | Created, Submitted, Approved, Rejected, Started, Suspended, Resumed, Completed, Failed, Cancelled, Closed | 11 |
| **WorkOrderContext** | ContextCreated, ContextUpdated, ContextSnapshotted, AssetAttached, AssetDetached, ResourceAllocated, ResourceReleased, ExternalRefLinked, ExternalRefUnlinked, ChildWorkOrderSpawned | 10 |
| **TaskInstance** | BecameReady, Started, ProgressUpdated, Blocked, Unblocked, Completed, Failed, Skipped, Compensated | 9 |
| **ApprovalRequest** | Requested, Granted, Rejected, Escalated, Completed, Expired | 6 |
| **L3SyncOperation** | Started, Progress, Completed, Failed, ExternalChangeDetected | 5 |
| **WorkflowDefinition** | Created, Versioned, Activated, Deprecated, Archived | 5 |
| **TOTAL** | | **46** |

### Tasks

| ID | Task | Size |
|----|------|------|
| EL-3.1-2 | WorkOrder lifecycle events + group | L |
| EL-3.3-4 | WorkOrderContext events + group | L |
| EL-3.5-6 | TaskInstance events + group | M |
| EL-3.7-8 | ApprovalRequest events + group | M |
| EL-3.9-10 | L3SyncOperation events + group | M |
| EL-3.11-12 | WorkflowDefinition events + group | M |
| EL-3.13 | Combined `IIoTEventLogSchema` | M |
| EL-3.14-19 | Handlers for each aggregate | L each |
| EL-3.20-22 | Context snapshot/resolve/update | M each |
| EL-3.23-24 | Integration tests | L |

### Context Snapshot Pattern

```typescript
// WorkOrderContext supports dual modes:
// 1. snapshot() - Immutable point-in-time for audit
// 2. resolve() - Live references for current state

const snapshotContext = (workOrderId: WorkOrderId) =>
  Effect.gen(function* () {
    const context = yield* getWorkOrderContext(workOrderId)
    // Emit snapshot event (immutable)
    yield* eventLog.write('ContextSnapshotted', {
      workOrderId,
      snapshot: context,
      snapshotAt: DateTime.now(),
    })
    return context
  })
```

---

## Epic EL-4: Equipment State EventLog (Priority 3)

**Goal:** Track equipment operational state for OEE calculations.
**Story Points:** 13 SP
**Sprint:** 6

### Event Catalog (6 Events)

| Event | Purpose |
|-------|---------|
| `EquipmentStateChanged` | State transition (operational → degraded → faulted) |
| `MaintenanceModeEntered` | Scheduled/unscheduled maintenance |
| `MaintenanceModeExited` | Return to operation |
| `PerformanceDegraded` | Below optimal but operational |
| `FaultDetected` | Equipment fault |
| `FaultCleared` | Fault resolved |

### State Machine

```
operational ─┬─► degraded ─┬─► faulted ─┬─► offline
             │             │            │
             │             └──► maintenance
             │                    │
             └────────────────────┘
```

### OEE Projection

```typescript
// Calculate OEE from equipment state events
const getOEEReport = (equipmentId: AssetId, period: DateRange) =>
  Effect.gen(function* () {
    const events = yield* eventLog.read(equipmentId, { since: period.start, until: period.end })

    const availability = calculateAvailability(events) // Uptime vs downtime
    const performance = calculatePerformance(events)   // Actual vs planned
    const quality = yield* getQualityFromReadings(equipmentId, period)

    return { availability, performance, quality, oee: availability * performance * quality }
  })
```

---

## Epic EL-5: Regulatory Compliance Events (Priority 4)

**Goal:** Event sourcing for regulated domains.
**Story Points:** 13 SP
**Sprint:** 7

### Domain Breakdown

| Domain | Standard | Events |
|--------|----------|--------|
| **Batch Records** | FDA 21 CFR Part 11 | BatchStarted, ParameterRecorded, BatchCompleted, BatchDeviation |
| **Quality Events** | ISO 9001 | InspectionCompleted, NCROpened, NCRClosed, CAPACreated, CAPAResolved |
| **Operator Actions** | General Audit | OperatorLogin, ParameterOverride, ManualAcknowledgment, ShiftHandoff |

### Tasks

| ID | Task | Size |
|----|------|------|
| EL-5.1-5 | Batch Records events + handlers | L |
| EL-5.6-9 | Quality Events + NCR-CAPA linking | M |
| EL-5.10-13 | Operator Actions + audit trail | M |
| EL-5.14 | Add all groups to schema | S |
| EL-5.15-16 | Compliance integration tests | L |

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EPIC DEPENDENCIES                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                    EL-1: Infrastructure (13 SP)                          │
│                              │                                           │
│         ┌────────────────────┼────────────────────┐                     │
│         │                    │                    │                     │
│         ▼                    ▼                    ▼                     │
│  EL-2: Alarm (16)    EL-3: WorkOrder (21)   EL-4: Equipment (13)       │
│         │                    │                    │                     │
│         │                    │                    │                     │
│         └────────────────────┼────────────────────┘                     │
│                              │                                           │
│                              ▼                                           │
│                    EL-5: Regulatory (13 SP)                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

Critical Path: EL-1 → EL-2 → EL-3 → EL-5
Parallel Path:  EL-1 → EL-4 (can run parallel to EL-2/EL-3)
```

---

## Risk Mitigations (Pre-Incorporated)

| Risk | Mitigation | WBS Task |
|------|------------|----------|
| EventLog API instability | Pinned version + facade | EL-1.1, EL-1.2 |
| No rollback during migration | Feature flags per domain | EL-2.1 |
| Projection inconsistency | Same-transaction writes | All handlers |
| Team unfamiliar with temporal queries | Spike with Alarm first | EL-2.19-21 |

---

## Implementation Schedule

| Sprint | Epic | Story Points | Deliverable |
|--------|------|--------------|-------------|
| 1 | EL-1: Infrastructure | 13 SP | Working `IIoTEventLogStackLayer` |
| 2-3 | EL-2: Alarm Migration | 16 SP | Alarm events + temporal queries |
| 4-5 | EL-3: Work Order | 21 SP | 46 events, 6 aggregates |
| 6 | EL-4: Equipment State | 13 SP | State machine + OEE |
| 7 | EL-5: Regulatory | 13 SP | FDA/ISO compliance events |
| **TOTAL** | | **76 SP** | **~3.5 months** |

---

## Files to Create

```
src/lib/iiot/
├── events/
│   ├── alarm-events.ts          # 10 events + AlarmEvents group
│   ├── work-order-events.ts     # 11 WorkOrder lifecycle events
│   ├── context-events.ts        # 10 WorkOrderContext events
│   ├── task-events.ts           # 9 TaskInstance events
│   ├── approval-events.ts       # 6 ApprovalRequest events
│   ├── l3-sync-events.ts        # 5 L3SyncOperation events
│   ├── definition-events.ts     # 5 WorkflowDefinition events
│   ├── equipment-state-events.ts # 6 Equipment state events
│   ├── batch-events.ts          # Batch records (FDA)
│   ├── quality-events.ts        # Quality events (ISO)
│   ├── operator-events.ts       # Operator actions
│   └── schema.ts                # Combined IIoTEventLogSchema
├── handlers/
│   ├── alarm-handlers.ts        # AlarmEventHandlers
│   ├── work-order-handlers.ts   # WorkOrderEventHandlers
│   ├── context-handlers.ts      # ContextEventHandlers
│   ├── task-handlers.ts         # TaskInstanceEventHandlers
│   ├── approval-handlers.ts     # ApprovalEventHandlers
│   ├── equipment-handlers.ts    # EquipmentStateEventHandlers
│   ├── compaction.ts            # Compaction strategies
│   └── reactivity.ts            # Cache invalidation bindings
├── services/
│   └── l1/
│       └── IIoTEventLog.ts      # Facade + layers
└── models/
    └── events/
        └── EventJournalModel.ddl.ts # Table definitions
```

---

## Approval Request

This WBS synthesizes findings from 4 parallel research agents:

1. **DeepWiki** — Confirmed API patterns (EventLog.schema, group, groupReactivity)
2. **Submodules** — Extracted canonical patterns from Effect + AMS v2
3. **Architecture** — Designed layer diagram + concrete event schemas
4. **Planning** — Structured into 5 Epics with dependencies

**Ready for Prime approval.**

---

**Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>**
