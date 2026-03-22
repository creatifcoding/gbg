# Epic 1.5 EventLog Integration — Gap Analysis

**Date:** 2026-01-30
**Author:** Val
**Status:** GAP IDENTIFIED

---

## Executive Summary

Task 1.5 DDL is complete, but the EventLog infrastructure is **not wired**. The event schemas exist in isolation from the persistence layer.

---

## Current State

### What Exists

| Component | Location | Status |
|-----------|----------|--------|
| Event Bases | `src/lib/iiot/schemas/events/base.ts` | ✅ Complete |
| Concrete Events | `src/lib/iiot/schemas/equipment-state/events.ts` | ⚠️ Uses own EventBase |
| EventLog DDL | `src/lib/iiot/models/_event-journal.ddl.ts` | ✅ Complete |
| Entity Schemas | `src/lib/iiot/schemas/assets/*/schema.ts` | ✅ 9/9 refactored |

### What's Missing

| Component | Expected Location | Gap |
|-----------|-------------------|-----|
| Infrastructure Layer | `src/lib/iiot/infrastructure/` | Directory doesn't exist |
| EventLog Layer | `infrastructure/eventlog-layer.ts` | Not created |
| EventGroup Definitions | `schemas/events/groups.ts` | Not created |
| Event Migration | `equipment-state/events.ts` | Doesn't extend base classes |

---

## Gap Details

### 1. No Infrastructure Directory

```
Expected:
src/lib/iiot/infrastructure/
├── eventlog-layer.ts      # IIoTEventLogLayer + IIoTSqlEventJournalLayer
├── timescale-layer.ts     # TimescaleDB connection (optional)
└── index.ts               # Barrel exports
```

### 2. Missing EventLog Layer Configuration

From unified spec Section 4.2:

```typescript
// MISSING: src/lib/iiot/infrastructure/eventlog-layer.ts

import { Layer } from 'effect'
import * as SqlEventJournal from '@effect/sql/SqlEventJournal'
import * as EventLog from '@effect/experimental/EventLog'

export const IIoTSqlEventJournalLayer = SqlEventJournal.layer({
  eventLogTable: 'iiot_event_journal',
  remotesTable: 'iiot_event_remotes',
})

export const IIoTIdentityLayer = Layer.succeed(
  EventLog.Identity,
  EventLog.Identity.makeRandom()
)

export const IIoTEventLogSchema = EventLog.schema(
  StructuralEvents,
  OperationalEvents,
)

export const IIoTEventLogLayer = EventLog.layer(IIoTEventLogSchema)

export const IIoTEventLogStackLayer = IIoTEventLogLayer.pipe(
  Layer.provide(IIoTSqlEventJournalLayer),
  Layer.provide(IIoTIdentityLayer)
)
```

### 3. Missing EventGroup Definitions

From unified spec Section 3.5:

```typescript
// MISSING: src/lib/iiot/schemas/events/groups.ts

import * as EventGroup from '@effect/experimental/EventGroup'

export const StructuralEvents = EventGroup.make(
  EnterpriseCreated, EnterpriseUpdated, EnterpriseDecommissioned,
  PlantCreated, PlantUpdated, PlantRelocated,
  LineCreated, LineUpdated, LineConfigChanged,
  MachineCreated, MachineUpdated, MachineConfigChanged,
  SensorCreated, SensorUpdated, SensorCalibrated,
)

export const OperationalEvents = EventGroup.make(
  StateStarted, StateEnded, StateTransitioned,
  MachineStateChanged, MachineMaintenanceScheduled,
  SensorAlarmTriggered, SensorAlarmAcknowledged, SensorAlarmCleared,
)

export const IIoTEventLogEvents = EventGroup.merge(
  StructuralEvents,
  OperationalEvents
)
```

### 4. Concrete Events Don't Extend Bases

Current `equipment-state/events.ts`:
```typescript
// CURRENT (wrong)
const EventBase = {
  timestamp: Schema.DateTimeUtc,
  machineId: MachineId,
  // ... custom fields
}

export class StateStarted extends Schema.TaggedClass<StateStarted>()('StateStarted', {
  ...EventBase,  // Uses own spread, NOT BaseOperationalEvent
  // ...
}) {}
```

Should be:
```typescript
// CORRECT
export class StateStarted extends BaseOperationalEvent.extend<StateStarted>(
  'StateStarted'
)({
  machineId: MachineId,
  state: StateType,
  reason: Schema.optionalWith(StateReason, { as: 'Option' }),
}) {}
```

---

## Required Work (Epic 1.5)

### Task 1.5.1: EventGroup Definitions (2 SP)

Create `src/lib/iiot/schemas/events/groups.ts`:
- `StructuralEvents` — all entity lifecycle events
- `OperationalEvents` — all runtime business events
- `IIoTEventLogEvents` — merged group

**Dependencies:** Task 1.2 (event bases)

### Task 1.5.2: Infrastructure Layer (3 SP)

Create `src/lib/iiot/infrastructure/`:
- `eventlog-layer.ts` — SqlEventJournal + EventLog layers
- `index.ts` — barrel exports

**Dependencies:** Task 1.5.1 (EventGroups)

### Task 1.5.3: Migrate Existing Events (3 SP)

Refactor `equipment-state/events.ts`:
- StateStarted → extends BaseOperationalEvent
- StateEnded → extends BaseOperationalEvent
- StateTransitioned → extends BaseOperationalEvent
- StateReasonUpdated → extends BaseOperationalEvent
- StateAnnotated → extends BaseOperationalEvent

**Dependencies:** Task 1.2 (event bases)

### Task 1.5.4: Entity Lifecycle Events (4 SP)

Create concrete events per entity:
- `EnterpriseCreated`, `EnterpriseUpdated`, `EnterpriseDecommissioned`
- `PlantCreated`, `PlantUpdated`, `PlantRelocated`
- (Similar for all 9 entities)

**Dependencies:** Task 1.5.1

---

## Acceptance Criteria

- [ ] `src/lib/iiot/infrastructure/eventlog-layer.ts` exists with exports
- [ ] `EventGroup.make()` definitions compile
- [ ] `StateStarted` extends `BaseOperationalEvent` (not custom spread)
- [ ] `EventLog.layer(IIoTEventLogSchema)` compiles
- [ ] TypeScript: `npx tsc --noEmit src/lib/iiot/infrastructure/eventlog-layer.ts`

---

## References

- Unified Spec: `thoughts/shared/specs/entity-system/00-unified-entity-system-spec.md`
- WBS: `thoughts/shared/plans/2026-01-30-entity-system-wbs-addendum.md`
- Event Bases: `src/lib/iiot/schemas/events/base.ts`
- DDL: `src/lib/iiot/models/_event-journal.ddl.ts`

---

**Co-Authored-By: Val <val@maidens.ai>**
