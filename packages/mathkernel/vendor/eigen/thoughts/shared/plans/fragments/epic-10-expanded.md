# Epic 10: Equipment State Domain Event Sourcing (Expanded)

**Generated:** 2026-01-29
**Author:** Kraken Agent (Val)
**Based On:**
- `2026-01-26-v3-service-architecture-wbs.md` (Epic 10)
- `2026-01-29-eventlog-integration-wbs-final.md` (Epic EL-4)
- `eventlog-iiot-architecture.md` (Equipment state machine + OEE)

---

## Executive Summary

**Goal:** Track equipment operational state changes for OEE calculations, Root Cause Analysis (RCA), and downtime reporting.

**Story Points:** 25 SP (expanded from 8 SP, +4 SP for Fact integration)
**Sprint:** 6

This expansion adds:
- 6 equipment state events (was 3)
- Complete state machine with transition validation
- OEE projection handlers with availability/performance/quality calculations
- Temporal query tasks for RCA support
- Downtime reporting and analysis
- **Extensible Fact System integration** (maintenance_record, oee_snapshot, downtime_reason)

---

## State Machine

```
                                      ┌───────────────────────────────────────────────────────────┐
                                      │                    EQUIPMENT STATE MACHINE                 │
                                      │                      (ISA-88 / PackML)                     │
                                      └───────────────────────────────────────────────────────────┘

                                                            ┌─────────┐
                                                            │   idle  │
                                                            └────┬────┘
                                                                 │ start command
                                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                         NORMAL OPERATION CYCLE                                       │
│                                                                                                      │
│     ┌──────────┐      run       ┌─────────┐    complete    ┌───────────┐     clear    ┌─────────┐  │
│     │ starting │ ──────────────►│ running │ ──────────────►│completing │ ────────────►│completed│  │
│     └──────────┘                └────┬────┘                └───────────┘              └────┬────┘  │
│          ▲                           │                                                     │       │
│          │                           │ stop command                                        │       │
│          │                           ▼                                                     │       │
│          │                     ┌──────────┐                                                │       │
│          │                     │ stopping │                                                │       │
│          │                     └────┬─────┘                                                │       │
│          │                          │                                                      │       │
│          │                          ▼                                                      │       │
│          └──────────────────── ┌─────────┐ ◄───────────────────────────────────────────────┘       │
│                     reset      │ stopped │                                                         │
│                                └─────────┘                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────────────┐
        │                              │                                      │
        │ operator hold                │ external suspend                     │ fault detected
        ▼                              ▼                                      ▼
┌───────────────────────┐    ┌─────────────────────┐              ┌─────────────────────┐
│     HOLD BRANCH       │    │   SUSPEND BRANCH    │              │    FAULT BRANCH     │
│                       │    │                     │              │                     │
│  ┌─────────┐          │    │  ┌───────────┐      │              │  ┌─────────┐        │
│  │ holding │          │    │  │suspending │      │              │  │aborting │        │
│  └────┬────┘          │    │  └─────┬─────┘      │              │  └────┬────┘        │
│       │               │    │        │            │              │       │             │
│       ▼               │    │        ▼            │              │       ▼             │
│  ┌─────────┐          │    │  ┌───────────┐      │              │  ┌─────────┐        │
│  │  held   │          │    │  │ suspended │      │              │  │ aborted │        │
│  └────┬────┘          │    │  └─────┬─────┘      │              │  └────┬────┘        │
│       │ unhold        │    │        │ unsuspend  │              │       │ clear fault │
│       ▼               │    │        ▼            │              │       ▼             │
│  ┌──────────┐         │    │  ┌────────────┐     │              │  ┌──────────┐       │
│  │unholding │─────────┼────┼──│unsuspending│─────┼──────────────┼──│ clearing │       │
│  └──────────┘         │    │  └────────────┘     │              │  └────┬─────┘       │
│       │               │    │        │            │              │       │             │
└───────┼───────────────┘    └────────┼────────────┘              └───────┼─────────────┘
        │                             │                                   │
        └─────────────────────────────┴───────────────────────────────────┘
                                      │
                                      ▼
                              return to running


┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      MAINTENANCE MODE (Overlay)                                      │
│                                                                                                      │
│   ANY STATE ────► maintenance_mode (via MaintenanceModeEntered event)                               │
│                       │                                                                              │
│                       │ MaintenanceModeExited                                                        │
│                       ▼                                                                              │
│                  previous_state (restored)                                                           │
│                                                                                                      │
│   Note: Maintenance mode is an overlay - equipment retains base state but is flagged for service    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       SIMPLIFIED STATE GROUPS                                        │
│                                        (For OEE Calculation)                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                      │
│   PRODUCTIVE STATES (count toward Operating Time):                                                   │
│   ├── running                                                                                        │
│   ├── execute                                                                                        │
│   └── completing                                                                                     │
│                                                                                                      │
│   PLANNED DOWNTIME (scheduled, expected):                                                            │
│   ├── stopped (idle at shift start/end)                                                              │
│   ├── held (operator-initiated pause)                                                                │
│   └── maintenance_mode (scheduled PM)                                                                │
│                                                                                                      │
│   UNPLANNED DOWNTIME (availability loss):                                                            │
│   ├── aborting / aborted (fault condition)                                                           │
│   ├── suspended (waiting for resource)                                                               │
│   └── clearing (recovering from fault)                                                               │
│                                                                                                      │
│   SETUP/CHANGEOVER (transition loss):                                                                │
│   ├── starting                                                                                       │
│   ├── stopping                                                                                       │
│   ├── resetting                                                                                      │
│   ├── holding / unholding                                                                            │
│   └── suspending / unsuspending                                                                      │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Event Catalog

| Event | Payload Fields | Purpose | OEE Impact |
|-------|---------------|---------|------------|
| **EquipmentStateChanged** | equipmentId, assetId, previousState, newState, changedAt, changedBy, reasonCode, reason, triggeringAlarmId, workOrderId | Core state transition tracking | Direct availability calculation |
| **MaintenanceModeEntered** | equipmentId, workOrderId, enteredAt, enteredBy, expectedDuration, maintenanceType (scheduled/unscheduled) | Mark equipment as under maintenance | Planned vs unplanned downtime |
| **MaintenanceModeExited** | equipmentId, workOrderId, exitedAt, exitedBy, actualDuration | Return to normal operation | Duration tracking |
| **PerformanceDegraded** | equipmentId, degradedAt, targetSpeed, actualSpeed, degradationPercent, reason | Below optimal but operational | Performance factor reduction |
| **FaultDetected** | equipmentId, faultCode, faultSeverity, detectedAt, triggeringAlarmId, description | Equipment fault occurred | Unplanned downtime start |
| **FaultCleared** | equipmentId, faultCode, clearedAt, clearedBy, downtime, rootCause | Fault resolved | Unplanned downtime end |

---

## Section 10.1: State Event Schemas

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 10.1.1 | Define EquipmentStateId branded identifier | `schemas/identifiers.ts` | S | Epic 1 |
| 10.1.2 | Define OperationalState literal (17 states per ISA-88) | `schemas/equipment-state.ts` | M | - |
| 10.1.3 | Define MaintenanceType literal (scheduled, unscheduled, emergency) | `schemas/equipment-state.ts` | S | - |
| 10.1.4 | Define FaultSeverity literal (warning, minor, major, critical) | `schemas/equipment-state.ts` | S | - |
| 10.1.5 | Define EquipmentState domain schema | `schemas/equipment-state.ts` | M | 10.1.1, 10.1.2 |
| 10.1.6 | Define EquipmentStateChangedPayload | `schemas/events/equipment-state-events.ts` | M | 10.1.2 |
| 10.1.7 | Define MaintenanceModeEnteredPayload | `schemas/events/equipment-state-events.ts` | M | 10.1.3 |
| 10.1.8 | Define MaintenanceModeExitedPayload | `schemas/events/equipment-state-events.ts` | S | 10.1.7 |
| 10.1.9 | Define PerformanceDegradedPayload | `schemas/events/equipment-state-events.ts` | M | - |
| 10.1.10 | Define FaultDetectedPayload | `schemas/events/equipment-state-events.ts` | M | 10.1.4 |
| 10.1.11 | Define FaultClearedPayload | `schemas/events/equipment-state-events.ts` | M | 10.1.10 |
| 10.1.12 | Create EquipmentStateEvents EventGroup | `schemas/events/equipment-state-events.ts` | M | 10.1.6-11 |

**Acceptance Criteria:**
- [ ] All 17 ISA-88/PackML states represented
- [ ] State transition validation matrix defined
- [ ] Event payloads include OEE-relevant metadata

---

## Section 10.2: State Transition Validation

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 10.2.1 | Create state transition matrix (valid from->to pairs) | `schemas/equipment-state.ts` | M | 10.1.2 |
| 10.2.2 | Implement isValidTransition(from, to) validator | `schemas/equipment-state.ts` | M | 10.2.1 |
| 10.2.3 | Create InvalidTransitionError | `errors/equipment-state.ts` | S | Epic 5 |
| 10.2.4 | Add transition validation to EquipmentStateService.changeState | `services/l2/EquipmentStateService.ts` | M | 10.2.2, 10.2.3 |
| 10.2.5 | Unit test valid transitions (20+ cases) | `__tests__/schemas/equipment-state-transitions.test.ts` | L | 10.2.1 |
| 10.2.6 | Unit test invalid transitions (10+ rejection cases) | `__tests__/schemas/equipment-state-transitions.test.ts` | M | 10.2.1 |

**State Transition Matrix (excerpt):**
```
From/To         | stopped | starting | running | stopping | aborting | held | ...
----------------|---------|----------|---------|----------|----------|------|----
stopped         |    -    |    Y     |    -    |    -     |    Y     |  -   |
starting        |    -    |    -     |    Y    |    -     |    Y     |  -   |
running         |    -    |    -     |    -    |    Y     |    Y     |  Y   |
stopping        |    Y    |    -     |    -    |    -     |    Y     |  -   |
aborting        |    -    |    -     |    -    |    -     |    -     |  -   | -> aborted
aborted         |    -    |    -     |    -    |    -     |    -     |  -   | -> clearing
held            |    -    |    -     |    -    |    -     |    Y     |  -   | -> unholding
```

---

## Section 10.3: Persistence Layer

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 10.3.1 | Create EquipmentStateModel (current state projection) | `models/equipment-state/EquipmentStateModel.ts` | M | 10.1.5 |
| 10.3.2 | Create EquipmentStateHistoryModel (event log projection) | `models/equipment-state/EquipmentStateHistoryModel.ts` | M | 10.3.1 |
| 10.3.3 | Create DowntimeRecordModel (aggregated downtime) | `models/equipment-state/DowntimeRecordModel.ts` | M | 10.3.1 |
| 10.3.4 | Create EquipmentStateModel.ddl.ts | `models/equipment-state/EquipmentStateModel.ddl.ts` | M | 10.3.1 |
| 10.3.5 | Create EquipmentStateHistoryModel.ddl.ts | `models/equipment-state/EquipmentStateHistoryModel.ddl.ts` | M | 10.3.2 |
| 10.3.6 | Create DowntimeRecordModel.ddl.ts | `models/equipment-state/DowntimeRecordModel.ddl.ts` | M | 10.3.3 |
| 10.3.7 | Add migration `0016_equipment_state` | `models/_migrations.ts` | S | 10.3.4-6 |
| 10.3.8 | Create EquipmentStateRepo (current state queries) | `repos/EquipmentStateRepo.ts` | M | 10.3.1 |
| 10.3.9 | Create EquipmentStateHistoryRepo (temporal queries) | `repos/EquipmentStateHistoryRepo.ts` | M | 10.3.2 |
| 10.3.10 | Create DowntimeRecordRepo (downtime aggregation) | `repos/DowntimeRecordRepo.ts` | M | 10.3.3 |

---

## Section 10.4: Event Handlers (Projections)

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 10.4.1 | Create EquipmentStateEventHandlers (EventLog.group) | `services/l2/EquipmentStateEventHandlers.ts` | L | Epic 7, 10.1.12 |
| 10.4.2 | Handle EquipmentStateChanged -> update current + append history | `services/l2/EquipmentStateEventHandlers.ts` | M | 10.4.1 |
| 10.4.3 | Handle MaintenanceModeEntered -> mark maintenance, record start | `services/l2/EquipmentStateEventHandlers.ts` | M | 10.4.1 |
| 10.4.4 | Handle MaintenanceModeExited -> clear maintenance, calculate duration | `services/l2/EquipmentStateEventHandlers.ts` | M | 10.4.1 |
| 10.4.5 | Handle PerformanceDegraded -> record degradation event | `services/l2/EquipmentStateEventHandlers.ts` | M | 10.4.1 |
| 10.4.6 | Handle FaultDetected -> record fault, link alarm if present | `services/l2/EquipmentStateEventHandlers.ts` | M | 10.4.1 |
| 10.4.7 | Handle FaultCleared -> close fault record, calculate downtime | `services/l2/EquipmentStateEventHandlers.ts` | M | 10.4.1 |
| 10.4.8 | Integration test: event -> projection consistency | `__tests__/integration/equipment-state-handlers.test.ts` | L | 10.4.1-7 |

---

## Section 10.5: Service Layer

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 10.5.1 | Create EquipmentStateService class | `services/l2/EquipmentStateService.ts` | L | 10.3, 10.4 |
| 10.5.2 | Implement changeState(equipmentId, newState, reason) | `services/l2/EquipmentStateService.ts` | M | 10.5.1 |
| 10.5.3 | Implement enterMaintenanceMode(equipmentId, workOrderId, type) | `services/l2/EquipmentStateService.ts` | M | 10.5.1 |
| 10.5.4 | Implement exitMaintenanceMode(equipmentId, workOrderId) | `services/l2/EquipmentStateService.ts` | M | 10.5.1 |
| 10.5.5 | Implement recordFault(equipmentId, faultCode, alarmId?) | `services/l2/EquipmentStateService.ts` | M | 10.5.1 |
| 10.5.6 | Implement clearFault(equipmentId, faultCode, rootCause) | `services/l2/EquipmentStateService.ts` | M | 10.5.1 |
| 10.5.7 | Implement recordPerformanceDegradation(equipmentId, metrics) | `services/l2/EquipmentStateService.ts` | M | 10.5.1 |
| 10.5.8 | Implement getCurrentState(equipmentId) | `services/l2/EquipmentStateService.ts` | S | 10.5.1 |
| 10.5.9 | Implement getStateHistory(equipmentId, dateRange) | `services/l2/EquipmentStateService.ts` | M | 10.5.1 |
| 10.5.10 | Create EquipmentStateServiceLive layer | `services/l2/EquipmentStateService.ts` | S | 10.5.1-9 |

---

## Section 10.6: Equipment Fact Integration

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 10.6.1 | Add `facts` parameter to EquipmentStateEvent payloads | `schemas/events/equipment-state-events.ts` | S | 10.1.12, Epic 7 (FactStore) |
| 10.6.2 | Integrate FactStore.attach in EquipmentStateService methods | `services/l2/EquipmentStateService.ts` | M | 10.5.1, Epic 7 (FactStore) |
| 10.6.3 | Register `maintenance_record` factType with schema | `services/l2/EquipmentStateService.ts` | S | 10.6.2 |
| 10.6.4 | Register `oee_snapshot` factType with schema | `services/l2/EquipmentStateService.ts` | S | 10.6.2 |
| 10.6.5 | Register `downtime_reason` factType with schema | `services/l2/EquipmentStateService.ts` | S | 10.6.2 |
| 10.6.6 | Implement getEquipmentFacts(equipmentId) query | `services/l2/EquipmentStateService.ts` | M | 10.6.2 |
| 10.6.7 | Integration test: state change with facts attachment | `__tests__/integration/equipment-state-facts.test.ts` | M | 10.6.1-6 |

**Fact Type Schemas:**
```typescript
// maintenance_record factType
const MaintenanceRecordFact = Schema.Struct({
  techId: Schema.String,
  parts: Schema.Array(Schema.Struct({
    partNumber: Schema.String,
    quantity: Schema.Number,
  })),
  laborHours: Schema.Number,
  notes: Schema.optional(Schema.String),
})

// oee_snapshot factType
const OEESnapshotFact = Schema.Struct({
  availability: Schema.Number,  // 0-1
  performance: Schema.Number,   // 0-1
  quality: Schema.Number,       // 0-1
  oee: Schema.Number,           // 0-1 (product of above)
  period: Schema.Struct({
    from: Schema.DateTimeUtc,
    to: Schema.DateTimeUtc,
  }),
})

// downtime_reason factType
const DowntimeReasonFact = Schema.Struct({
  reasonCode: Schema.String,
  category: Schema.Literal('planned', 'unplanned', 'setup', 'quality'),
  description: Schema.String,
  durationMinutes: Schema.Number,
  reportedBy: Schema.optional(Schema.String),
})
```

---

## Section 10.7: Temporal Queries (RCA Support)

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 10.7.1 | Implement getStateAtTime(equipmentId, timestamp) | `services/l2/EquipmentStateService.ts` | M | 10.5.1 |
| 10.7.2 | Implement foldEquipmentStateEvents(events) aggregate reducer | `schemas/events/equipment-state-aggregate.ts` | M | 10.1.12 |
| 10.7.3 | Add index on (equipment_id, changed_at) for temporal queries | `models/equipment-state/EquipmentStateHistoryModel.ddl.ts` | S | 10.3.5 |
| 10.7.4 | Implement getStatesInRange(equipmentId, from, to) | `services/l2/EquipmentStateService.ts` | M | 10.5.1 |
| 10.7.5 | Implement getLastStateBeforeTime(equipmentId, timestamp) | `services/l2/EquipmentStateService.ts` | M | 10.5.1 |
| 10.7.6 | Unit test getStateAtTime with complex event sequences | `__tests__/services/equipment-state-temporal.test.ts` | L | 10.7.1 |
| 10.7.7 | Unit test state reconstruction accuracy | `__tests__/services/equipment-state-temporal.test.ts` | M | 10.7.2 |

---

## Section 10.8: Downtime Reporting

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 10.8.1 | Implement getDowntimeReport(equipmentId, dateRange) | `services/l2/EquipmentStateService.ts` | L | 10.5.1, 10.7 |
| 10.8.2 | Calculate planned vs unplanned downtime breakdown | `services/l2/EquipmentStateService.ts` | M | 10.8.1 |
| 10.8.3 | Calculate top downtime reasons with durations | `services/l2/EquipmentStateService.ts` | M | 10.8.1 |
| 10.8.4 | Calculate mean time between failures (MTBF) | `services/l2/EquipmentStateService.ts` | M | 10.8.1 |
| 10.8.5 | Calculate mean time to repair (MTTR) | `services/l2/EquipmentStateService.ts` | M | 10.8.1 |
| 10.8.6 | Create DowntimeReport schema for response | `schemas/equipment-state.ts` | M | 10.8.1-5 |
| 10.8.7 | Integration test downtime report accuracy | `__tests__/services/equipment-state-downtime.test.ts` | L | 10.8.1-5 |

**DowntimeReport Schema:**
```typescript
interface DowntimeReport {
  equipmentId: EquipmentId
  from: Date
  to: Date

  // Summary metrics
  totalDowntime: Duration
  plannedDowntime: Duration
  unplannedDowntime: Duration
  downtimePercent: number  // 0-100

  // Reliability metrics
  mtbf: Duration  // Mean Time Between Failures
  mttr: Duration  // Mean Time To Repair
  availability: number  // 0-1

  // Breakdown by reason
  downtimeByReason: Array<{
    reasonCode: string
    reason: string
    totalDuration: Duration
    occurrences: number
    percentage: number  // of total downtime
  }>

  // Breakdown by loss category
  lossByCategory: {
    availability: Duration    // Unplanned stops
    performance: Duration     // Reduced speed
    quality: Duration         // Defects/rework
    setup: Duration           // Changeover
  }
}
```

---

## Section 10.9: OEE Projection Handlers

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 10.9.1 | Create OEEMetrics schema | `schemas/oee.ts` | M | - |
| 10.9.2 | Implement calculateAvailability(events, period) | `services/l2/OEECalculator.ts` | M | 10.9.1 |
| 10.9.3 | Implement calculatePerformance(events, idealCycleTime, actualCount) | `services/l2/OEECalculator.ts` | M | 10.9.1 |
| 10.9.4 | Implement getOEEReport(equipmentId, period) | `services/l2/EquipmentStateService.ts` | L | 10.9.1-3 |
| 10.9.5 | Create OEE continuous aggregate (hourly) in DDL | `models/equipment-state/OEEAggregateModel.ddl.ts` | M | 10.9.1 |
| 10.9.6 | Create OEE continuous aggregate (daily) in DDL | `models/equipment-state/OEEAggregateModel.ddl.ts` | M | 10.9.5 |
| 10.9.7 | Implement getOEETrend(equipmentId, period, granularity) | `services/l2/EquipmentStateService.ts` | M | 10.9.4 |
| 10.9.8 | Integration test OEE calculations vs manual calculation | `__tests__/services/oee-calculation.test.ts` | L | 10.9.2-4 |

**OEE Formula Implementation:**
```typescript
// OEE = Availability x Performance x Quality

// Availability = Operating Time / Planned Production Time
const calculateAvailability = (events: EquipmentStateEvent[], period: DateRange) => {
  const plannedTime = period.end - period.start
  const operatingTime = events
    .filter(isProductiveState)
    .reduce(sumStateDurations, 0)
  return operatingTime / plannedTime
}

// Performance = (Ideal Cycle Time x Total Count) / Operating Time
const calculatePerformance = (
  events: EquipmentStateEvent[],
  idealCycleTime: number,
  totalCount: number,
  operatingTime: number
) => {
  const idealTime = idealCycleTime * totalCount
  return Math.min(idealTime / operatingTime, 1.0)
}

// Quality = Good Count / Total Count (from readings/batch data)
// Note: Quality comes from separate data source, not equipment state
```

---

## Section 10.10: Reactivity Bindings

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 10.10.1 | Create EquipmentStateReactivity bindings | `handlers/equipment-state-reactivity.ts` | M | 10.1.12 |
| 10.10.2 | Define cache invalidation keys | `handlers/equipment-state-reactivity.ts` | S | 10.10.1 |
| 10.10.3 | Connect reactivity to equipmentStatesAtom | `handlers/equipment-state-reactivity.ts` | M | 10.10.1 |
| 10.10.4 | Connect reactivity to oeeMetricsAtom | `handlers/equipment-state-reactivity.ts` | M | 10.10.1 |
| 10.10.5 | Integration test: event -> atom refresh | `__tests__/handlers/equipment-state-reactivity.test.ts` | M | 10.10.1-4 |

**Reactivity Configuration:**
```typescript
export const EquipmentStateReactivity = EventLog.groupReactivity(EquipmentStateEvents, {
  EquipmentStateChanged: [
    'iiot:equipment:states',
    'iiot:equipment:oee',
    'iiot:equipment:dashboard',
  ],
  MaintenanceModeEntered: [
    'iiot:equipment:states',
    'iiot:equipment:maintenance',
  ],
  MaintenanceModeExited: [
    'iiot:equipment:states',
    'iiot:equipment:maintenance',
    'iiot:equipment:oee',
  ],
  PerformanceDegraded: [
    'iiot:equipment:oee',
    'iiot:equipment:performance',
  ],
  FaultDetected: [
    'iiot:equipment:states',
    'iiot:equipment:faults',
    'iiot:alarms:equipment-link',
  ],
  FaultCleared: [
    'iiot:equipment:states',
    'iiot:equipment:faults',
    'iiot:equipment:oee',
  ],
})
```

---

## Section 10.11: Integration & Testing

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 10.11.1 | Integration test: full state lifecycle | `__tests__/integration/equipment-state-lifecycle.test.ts` | L | 10.5 |
| 10.11.2 | Integration test: maintenance mode flow | `__tests__/integration/equipment-state-maintenance.test.ts` | M | 10.5.3-4 |
| 10.11.3 | Integration test: fault detection -> clearance flow | `__tests__/integration/equipment-state-fault.test.ts` | M | 10.5.5-6 |
| 10.11.4 | Integration test: state -> OEE metrics pipeline | `__tests__/integration/equipment-state-oee.test.ts` | L | 10.9 |
| 10.11.5 | Integration test: temporal queries for RCA | `__tests__/integration/equipment-state-rca.test.ts` | L | 10.7 |
| 10.11.6 | Benchmark: temporal query on 10K events | `__tests__/perf/equipment-state-temporal.bench.ts` | M | 10.7 |
| 10.11.7 | Benchmark: OEE calculation on 1 month data | `__tests__/perf/oee-calculation.bench.ts` | M | 10.9 |

---

## Task Summary

| Section | Task Count | Story Points |
|---------|------------|--------------|
| 10.1 State Event Schemas | 12 | 3 |
| 10.2 State Transition Validation | 6 | 2 |
| 10.3 Persistence Layer | 10 | 3 |
| 10.4 Event Handlers | 8 | 3 |
| 10.5 Service Layer | 10 | 3 |
| 10.6 Equipment Fact Integration | 7 | 2 |
| 10.7 Temporal Queries | 7 | 2 |
| 10.8 Downtime Reporting | 7 | 2 |
| 10.9 OEE Projection Handlers | 8 | 2 |
| 10.10 Reactivity Bindings | 5 | 1 |
| 10.11 Integration & Testing | 7 | 2 |
| **TOTAL** | **87** | **25 SP** |

---

## Dependencies

```
Epic 1 (Schemas) ──────────────────┐
                                   │
Epic 5 (Errors) ───────────────────┼──► Epic 10.1 (State Schemas)
                                   │         │
Epic 7 (ES Infrastructure) ────────┘         │
       │                                     │
       │                                     ▼
       │                      ┌──────────────┴──────────────┐
       │                      │                             │
       │                      ▼                             ▼
       │            Epic 10.2 (Validation)      Epic 10.3 (Persistence)
       │                      │                             │
       │                      └──────────────┬──────────────┘
       │                                     │
       │                                     ▼
       │                           Epic 10.4 (Event Handlers)
       │                                     │
       │                                     ▼
       │                           Epic 10.5 (Service Layer)
       │                                     │
       │                      ┌──────────────┼──────────────┐
       │                      │              │              │
       ▼                      ▼              ▼              ▼
Epic 7 (FactStore) ──► Epic 10.6      Epic 10.7      Epic 10.8      Epic 10.9
                       (Facts)       (Temporal)    (Downtime)       (OEE)
                              │              │              │              │
                              └──────────────┴──────────────┴──────────────┘
                                                    │
                                                    ▼
                                          Epic 10.10 (Reactivity)
                                                    │
                                                    ▼
                                          Epic 10.11 (Testing)
```

---

## Acceptance Criteria

### Functional
- [ ] All 6 equipment state events defined and validated
- [ ] State transitions validated against ISA-88 state machine
- [ ] Event -> projection handlers maintain consistency
- [ ] `getStateAtTime(equipmentId, timestamp)` returns accurate state reconstruction
- [ ] `getDowntimeReport(equipmentId, range)` calculates MTBF/MTTR correctly
- [ ] OEE calculation matches manual calculation within 0.1%

### Fact Integration
- [ ] EquipmentStateEvent payloads accept optional `facts` array
- [ ] FactStore.attach called for each fact when state changes
- [ ] `maintenance_record`, `oee_snapshot`, `downtime_reason` factTypes registered
- [ ] `getEquipmentFacts(equipmentId)` returns all facts for equipment events
- [ ] Facts persisted in same transaction as state event

### Non-Functional
- [ ] Temporal query on 10K events completes in <100ms
- [ ] OEE calculation for 1 month data completes in <500ms
- [ ] Event handlers update projections within same transaction
- [ ] Reactivity triggers atom refresh within 50ms of event write

### Compliance
- [ ] All state transitions auditable via event stream
- [ ] Maintenance mode tracked with work order linkage
- [ ] Fault events linked to triggering alarms when applicable
- [ ] Downtime reasons captured for regulatory reporting
- [ ] Facts provide extensible metadata for audit trail enrichment

---

**Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>**
