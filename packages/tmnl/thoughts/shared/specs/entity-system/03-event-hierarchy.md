# Event Type Hierarchy Specification

**Created:** 2026-01-30
**Author:** architect-agent (Val)
**Status:** SPEC
**Related:**
- `src/lib/iiot/schemas/identifiers.ts` (branded IDs, EquipmentLevel)
- `src/lib/iiot/schemas/assets.ts` (Asset entity)
- `src/lib/iiot/schemas/alarms.ts` (AlarmState, AlarmSeverity)
- `src/lib/iiot/schemas/readings.ts` (SensorReading, OpcUaQuality)
- `thoughts/shared/research/eventlog-iiot-architecture.md`

---

## Executive Summary

This specification defines a **three-category event hierarchy** for full event sourcing across all IIoT entities. The categories are **divergent by design** — they do NOT inherit from a common root, because their storage semantics, query patterns, and lifecycle characteristics are fundamentally different.

| Category | Storage | Query Pattern | Retention | Example |
|----------|---------|---------------|-----------|---------|
| **Structural** | EventLog | Replay from origin | Indefinite | EntityCreated, ConfigUpdated |
| **Operational** | EventLog | Replay + time-travel | Indefinite | StateChanged, AlarmRaised |
| **Temporal** | TimescaleDB | Time-bucketed aggregation | Tiered (hot/warm/cold) | SensorReading, Metric |

---

## Why Three Divergent Bases (Not Common Root)

### The Anti-Pattern: Common Base

```typescript
// ❌ WRONG: Forces artificial commonality
class BaseEvent extends Schema.TaggedClass<BaseEvent>()('BaseEvent', {
  eventId: EventId,
  occurredAt: Schema.DateTimeUtc,
  causedBy: Schema.String,
}) {}

class AssetCreated extends BaseEvent.extend<AssetCreated>('AssetCreated')({
  // ...loses temporal event semantics
}) {}
```

### Problems with Common Root

1. **Storage Divergence**: Structural/Operational → EventLog (JSONB journal). Temporal → TimescaleDB hypertable (columnar time-series).

2. **Query Divergence**: 
   - Structural: "What is the entity's configuration NOW?" → Replay entire event stream
   - Operational: "What was the alarm state at 14:00?" → Time-travel query
   - Temporal: "Average temperature last hour?" → Time-bucketed aggregate

3. **Retention Divergence**:
   - Structural: Keep forever (audit compliance)
   - Operational: Keep forever (ISA-18.2, OEE)
   - Temporal: Tiered — raw (7 days), 1min aggregates (90 days), 1hour (indefinite)

4. **Field Divergence**: 
   - Structural needs `hierarchyPath` (full ancestry for cascade)
   - Operational needs `entityType` (for polymorphic dispatch)
   - Temporal needs `bucketTime` (for aggregate joins)

### The Pattern: Divergent Bases

Three separate base classes. No inheritance between them. Consumers choose the appropriate base by domain category.

---

## Base Event Definitions

### 1. BaseStructuralEvent

Structural events capture **entity lifecycle and configuration changes**. These are the "shape" of the system — what exists, where it is in the hierarchy, and how it's configured.

```typescript
import { Schema } from 'effect'
import { EventId, EquipmentLevel, AssetId } from './identifiers'

/**
 * Hierarchy path for cascade operations.
 * Array of AssetIds from root to this entity.
 * 
 * @example ['ENT-001', 'SITE-001', 'AREA-001', 'LINE-001']
 */
export const HierarchyPath = Schema.Array(AssetId).pipe(
  Schema.brand('HierarchyPath'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/events/HierarchyPath',
    description: 'Full path from enterprise root to entity',
  })
)
export type HierarchyPath = Schema.Schema.Type<typeof HierarchyPath>

/**
 * Base class for structural events (entity lifecycle, configuration).
 * 
 * Characteristics:
 * - Stored in EventLog (JSONB journal)
 * - Replayed from origin to reconstruct state
 * - Never deleted (audit compliance)
 * - Includes full hierarchy path for cascade operations
 * 
 * @see ADR-0012 for EventLog boundaries
 */
export class BaseStructuralEvent extends Schema.TaggedClass<BaseStructuralEvent>()(
  'BaseStructuralEvent',
  {
    /** Unique event identifier (ULID for sortability) */
    eventId: EventId,

    /** When the event occurred (not when recorded) */
    occurredAt: Schema.DateTimeUtc,

    /** Principal/actor that caused this event (userId, systemId) */
    causedBy: Schema.String,

    /** Entity this event affects */
    entityId: AssetId,

    /** ISA-95 equipment level of the entity */
    entityType: EquipmentLevel,

    /** Full hierarchy path from root to this entity */
    hierarchyPath: HierarchyPath,

    /** Correlation ID for multi-event transactions */
    correlationId: Schema.optional(Schema.String),

    /** Event version for schema evolution */
    schemaVersion: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  }
) {}
```

**Why `hierarchyPath`?**

When a Line is relocated under a different Area, all child Machines and Sensors need cascade events. The `hierarchyPath` enables:
- Single-query child lookup: `WHERE hierarchyPath @> ARRAY['LINE-001']`
- Audit trail: "Machine X was under Line Y at the time of this event"
- Cascade validation: Ensure parent exists before child creation

---

### 2. BaseOperationalEvent

Operational events capture **runtime business events** — state changes, alarms, maintenance actions. These are the "behavior" of the system.

```typescript
/**
 * Base class for operational events (business actions, state changes).
 * 
 * Characteristics:
 * - Stored in EventLog (JSONB journal)
 * - Supports time-travel queries ("state at time T")
 * - Never deleted (OEE calculation, RCA support)
 * - No hierarchy path (just entity reference)
 * 
 * Note: Does NOT include hierarchyPath because:
 * 1. Operational events reference a single entity
 * 2. Hierarchy queries use structural events + asset table
 * 3. Avoids stale path data if asset relocated after event
 */
export class BaseOperationalEvent extends Schema.TaggedClass<BaseOperationalEvent>()(
  'BaseOperationalEvent',
  {
    /** Unique event identifier (ULID for sortability) */
    eventId: EventId,

    /** When the event occurred (not when recorded) */
    occurredAt: Schema.DateTimeUtc,

    /** Principal/actor that caused this event */
    causedBy: Schema.String,

    /** Entity this event affects */
    entityId: AssetId,

    /** ISA-95 equipment level (for polymorphic dispatch) */
    entityType: EquipmentLevel,

    /** Correlation ID for multi-event transactions */
    correlationId: Schema.optional(Schema.String),

    /** Event version for schema evolution */
    schemaVersion: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  }
) {}
```

**Why no `hierarchyPath`?**

Operational events describe what happened TO an entity, not what the entity IS. If a Machine is relocated after an alarm, the alarm should still reference the Machine's current position — not stale path data.

---

### 3. BaseTemporalEvent

Temporal events are **high-frequency measurements** — sensor readings, metrics, counters. They are NOT stored in the EventLog.

```typescript
/**
 * Base class for temporal events (time-series data).
 * 
 * Characteristics:
 * - Stored in TimescaleDB hypertable (NOT EventLog)
 * - Time-bucketed aggregation (1min, 1hour continuous aggregates)
 * - Tiered retention (raw: 7d, 1min: 90d, 1hour: indefinite)
 * - Linked to assets via entityId (foreign key)
 * 
 * Note: NOT event sourced. These are measurements, not state transitions.
 * The EventLog handles structural/operational events; TimescaleDB handles data.
 */
export class BaseTemporalEvent extends Schema.TaggedClass<BaseTemporalEvent>()(
  'BaseTemporalEvent',
  {
    /** Measurement timestamp (UTC) */
    time: Schema.DateTimeUtc,

    /** Entity this measurement relates to (sensor/device/machine) */
    entityId: AssetId,

    /** Rounded bucket time for aggregate joins */
    bucketTime: Schema.DateTimeUtc,

    /** OPC-UA quality code for data trustworthiness */
    quality: Schema.optional(Schema.String),
  }
) {}
```

**Why `bucketTime`?**

TimescaleDB continuous aggregates partition by time buckets. Pre-computing the bucket time:
- Enables efficient aggregate joins
- Avoids repeated `time_bucket()` calls
- Supports multi-resolution queries (hot/warm/cold)

---

## Extension Pattern

All concrete events extend their appropriate base using `Schema.Class.extend`:

```typescript
// ══════════════════════════════════════════════════════════════════════════════
// STRUCTURAL EVENT EXTENSIONS
// ══════════════════════════════════════════════════════════════════════════════

import { AssetLocation, AssetProperties, AssetStatus } from './assets'
import { PlantId, LineId, MachineId, DeviceId } from './identifiers'

/**
 * Plant (site-level entity) created event.
 */
export class PlantCreated extends BaseStructuralEvent.extend<PlantCreated>(
  'PlantCreated'
)({
  /** Specific plant identifier */
  plantId: PlantId,

  /** Plant display name */
  name: Schema.NonEmptyString,

  /** IANA timezone for plant-local time */
  timezone: Schema.String,

  /** Initial plant configuration */
  initialConfig: Schema.optional(AssetProperties),

  /** Initial plant location */
  initialLocation: Schema.optional(AssetLocation),
}) {}

/**
 * Line created under a plant/area.
 */
export class LineCreated extends BaseStructuralEvent.extend<LineCreated>(
  'LineCreated'
)({
  lineId: LineId,
  name: Schema.NonEmptyString,
  /** Parent plant/area this line belongs to */
  parentId: AssetId,
  initialConfig: Schema.optional(AssetProperties),
}) {}

/**
 * Machine created under a line/workcell.
 */
export class MachineCreated extends BaseStructuralEvent.extend<MachineCreated>(
  'MachineCreated'
)({
  machineId: MachineId,
  name: Schema.NonEmptyString,
  parentId: AssetId,
  /** Machine model/type for maintenance templates */
  model: Schema.optional(Schema.String),
  /** Serial number for inventory tracking */
  serialNumber: Schema.optional(Schema.String),
  initialConfig: Schema.optional(AssetProperties),
}) {}

/**
 * Sensor/device created under a machine.
 */
export class SensorCreated extends BaseStructuralEvent.extend<SensorCreated>(
  'SensorCreated'
)({
  deviceId: DeviceId,
  name: Schema.NonEmptyString,
  parentId: AssetId,
  /** Sensor measurement type (temperature, vibration, etc.) */
  sensorType: Schema.String,
  /** Measurement unit */
  unit: Schema.String,
  /** Sample rate in milliseconds */
  sampleRateMs: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
}) {}
```

---

## Full Event List by Entity Type

### Enterprise Events (Structural)

| Event | Base | Description |
|-------|------|-------------|
| `EnterpriseCreated` | Structural | Multi-site corporation registered |
| `EnterpriseUpdated` | Structural | Name, metadata changed |
| `EnterpriseDecommissioned` | Structural | Corporation dissolved (soft delete) |

### Site/Area/Plant Events (Structural)

| Event | Base | Description |
|-------|------|-------------|
| `PlantCreated` | Structural | New plant registered |
| `PlantUpdated` | Structural | Name, description, config changed |
| `PlantRelocated` | Structural | Moved to different parent (rare) |
| `PlantTimezoneChanged` | Structural | Timezone updated (affects all readings) |
| `PlantDecommissioned` | Structural | Plant taken offline |

```typescript
export class PlantRelocated extends BaseStructuralEvent.extend<PlantRelocated>(
  'PlantRelocated'
)({
  plantId: PlantId,
  previousParentId: AssetId,
  newParentId: AssetId,
  /** New hierarchy path after relocation */
  newHierarchyPath: HierarchyPath,
  reason: Schema.optional(Schema.String),
}) {}
```

### Line/WorkCell Events (Structural)

| Event | Base | Description |
|-------|------|-------------|
| `LineCreated` | Structural | Production line registered |
| `LineUpdated` | Structural | Name, description changed |
| `LineConfigChanged` | Structural | Line parameters updated |
| `LineRelocated` | Structural | Moved to different plant/area |
| `LineDecommissioned` | Structural | Line taken offline |

### Machine Events (Structural + Operational)

**Structural:**

| Event | Base | Description |
|-------|------|-------------|
| `MachineCreated` | Structural | Machine registered |
| `MachineUpdated` | Structural | Metadata changed |
| `MachineConfigChanged` | Structural | Operating parameters updated |
| `MachineRelocated` | Structural | Moved to different line |
| `MachineDecommissioned` | Structural | Machine retired |

**Operational:**

| Event | Base | Description |
|-------|------|-------------|
| `MachineStateChanged` | Operational | Running/Stopped/Faulted/Maintenance |
| `MachineMaintenanceScheduled` | Operational | Preventive maintenance scheduled |
| `MachineMaintenanceStarted` | Operational | Maintenance work begins |
| `MachineMaintenanceCompleted` | Operational | Maintenance work ends |
| `MachineAlarmRaised` | Operational | Machine-level alarm triggered |
| `MachineAlarmCleared` | Operational | Machine-level alarm resolved |

```typescript
// ══════════════════════════════════════════════════════════════════════════════
// MACHINE OPERATIONAL EVENTS
// ══════════════════════════════════════════════════════════════════════════════

/** ISA-88 equipment states for OEE calculation */
export const EquipmentState = Schema.Literal(
  'running',
  'stopped',
  'idle',
  'changeover',
  'planned_downtime',
  'unplanned_downtime',
  'maintenance',
  'faulted'
)
export type EquipmentState = Schema.Schema.Type<typeof EquipmentState>

export class MachineStateChanged extends BaseOperationalEvent.extend<MachineStateChanged>(
  'MachineStateChanged'
)({
  machineId: MachineId,
  previousState: EquipmentState,
  newState: EquipmentState,
  /** Duration in previous state (seconds) */
  previousStateDuration: Schema.optional(Schema.Number),
  /** Reason code for state change */
  reasonCode: Schema.optional(Schema.String),
  /** Operator notes */
  notes: Schema.optional(Schema.String),
}) {}

export class MachineMaintenanceScheduled extends BaseOperationalEvent.extend<MachineMaintenanceScheduled>(
  'MachineMaintenanceScheduled'
)({
  machineId: MachineId,
  /** Work order ID for this maintenance */
  workOrderId: Schema.optional(Schema.String),
  /** Scheduled start time */
  scheduledStart: Schema.DateTimeUtc,
  /** Estimated duration (minutes) */
  estimatedDurationMinutes: Schema.Number.pipe(Schema.int(), Schema.positive()),
  /** Maintenance type */
  maintenanceType: Schema.Literal('preventive', 'predictive', 'corrective'),
}) {}

export class MachineAlarmRaised extends BaseOperationalEvent.extend<MachineAlarmRaised>(
  'MachineAlarmRaised'
)({
  machineId: MachineId,
  alarmId: AlarmId,
  alarmType: AlarmType,
  severity: AlarmSeverity,
  /** Triggering sensor (if applicable) */
  triggeringDeviceId: Schema.optional(DeviceId),
  /** Value that triggered alarm */
  triggerValue: Schema.optional(Schema.Number),
  /** Threshold exceeded */
  thresholdValue: Schema.optional(Schema.Number),
  message: Schema.optional(Schema.String),
}) {}
```

### Sensor/Device Events (Structural + Operational + Temporal)

**Structural:**

| Event | Base | Description |
|-------|------|-------------|
| `SensorCreated` | Structural | Sensor registered |
| `SensorUpdated` | Structural | Metadata changed |
| `SensorCalibrated` | Structural | Calibration performed (affects readings) |
| `SensorThresholdChanged` | Structural | Alarm thresholds updated |
| `SensorDecommissioned` | Structural | Sensor retired |

**Operational:**

| Event | Base | Description |
|-------|------|-------------|
| `SensorAlarmTriggered` | Operational | Threshold exceeded |
| `SensorAlarmAcknowledged` | Operational | Operator acknowledged alarm |
| `SensorAlarmCleared` | Operational | Reading returned to normal |
| `SensorCommunicationLost` | Operational | Connection to sensor lost |
| `SensorCommunicationRestored` | Operational | Connection restored |

**Temporal:**

| Event | Base | Storage | Description |
|-------|------|---------|-------------|
| `SensorReading` | Temporal | TimescaleDB | Raw measurement value |
| `SensorMetric` | Temporal | TimescaleDB | Derived/calculated metric |

```typescript
// ══════════════════════════════════════════════════════════════════════════════
// SENSOR STRUCTURAL EVENTS
// ══════════════════════════════════════════════════════════════════════════════

export class SensorCalibrated extends BaseStructuralEvent.extend<SensorCalibrated>(
  'SensorCalibrated'
)({
  deviceId: DeviceId,
  /** Previous calibration offset */
  previousOffset: Schema.optional(Schema.Number),
  /** New calibration offset */
  newOffset: Schema.Number,
  /** Previous calibration gain */
  previousGain: Schema.optional(Schema.Number),
  /** New calibration gain */
  newGain: Schema.Number,
  /** Calibration standard used */
  calibrationStandard: Schema.optional(Schema.String),
  /** Technician who performed calibration */
  calibratedBy: Schema.NonEmptyString,
  /** Next calibration due date */
  nextCalibrationDue: Schema.optional(Schema.DateTimeUtc),
}) {}

export class SensorThresholdChanged extends BaseStructuralEvent.extend<SensorThresholdChanged>(
  'SensorThresholdChanged'
)({
  deviceId: DeviceId,
  thresholdType: Schema.Literal('high', 'critical', 'low', 'critical_low'),
  previousValue: Schema.optional(Schema.Number),
  newValue: Schema.Number,
  reason: Schema.optional(Schema.String),
}) {}

// ══════════════════════════════════════════════════════════════════════════════
// SENSOR TEMPORAL EVENTS (TimescaleDB, NOT EventLog)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Sensor reading (temporal event).
 * Stored in TimescaleDB hypertable, NOT EventLog.
 */
export class SensorReadingEvent extends BaseTemporalEvent.extend<SensorReadingEvent>(
  'SensorReadingEvent'
)({
  deviceId: DeviceId,
  /** Measured value */
  value: Schema.Number,
  /** OPC-UA quality code */
  opcUaQuality: Schema.optional(Schema.String),
  /** Numeric quality score (0-100) */
  qualityScore: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 100))),
}) {}
```

---

## EventLog vs TimescaleDB Routing Rules

### Decision Tree

```
Is this event a measurement/metric?
│
├─ YES → TimescaleDB
│  └─ Characteristics:
│     - High frequency (>1/sec)
│     - Numeric value + timestamp
│     - Aggregatable (avg, min, max)
│     - Time-bucketed retention
│
└─ NO → EventLog
   │
   ├─ Does it change entity structure/config?
   │  └─ YES → BaseStructuralEvent
   │     └─ Include hierarchyPath
   │
   └─ Is it a runtime business event?
      └─ YES → BaseOperationalEvent
         └─ No hierarchyPath
```

### Routing Implementation

```typescript
import { Schema, Match, pipe } from 'effect'

/** Event category discriminator */
export const EventCategory = Schema.Literal('structural', 'operational', 'temporal')
export type EventCategory = Schema.Schema.Type<typeof EventCategory>

/** Event routing metadata */
export class EventRouting extends Schema.TaggedClass<EventRouting>()('EventRouting', {
  eventType: Schema.String,
  category: EventCategory,
  /** For temporal: TimescaleDB table name */
  temporalTable: Schema.optional(Schema.String),
  /** For structural/operational: EventLog partition key pattern */
  partitionKeyPattern: Schema.optional(Schema.String),
}) {}

/** Route an event to its storage destination */
export const routeEvent = <E extends { _tag: string }>(event: E): EventRouting => {
  // Temporal events → TimescaleDB
  if (event._tag.endsWith('Reading') || event._tag.endsWith('Metric')) {
    return new EventRouting({
      eventType: event._tag,
      category: 'temporal' as const,
      temporalTable: event._tag.includes('Sensor') ? 'iiot.sensor_readings' : 'iiot.metrics',
    })
  }

  // Structural events → EventLog with hierarchy-based partition
  if (event._tag.endsWith('Created') || 
      event._tag.endsWith('Updated') || 
      event._tag.endsWith('Decommissioned') ||
      event._tag.endsWith('Calibrated') ||
      event._tag.endsWith('ThresholdChanged') ||
      event._tag.endsWith('ConfigChanged') ||
      event._tag.endsWith('Relocated')) {
    return new EventRouting({
      eventType: event._tag,
      category: 'structural' as const,
      partitionKeyPattern: 'entity:{entityId}',
    })
  }

  // Operational events → EventLog with entity-based partition
  return new EventRouting({
    eventType: event._tag,
    category: 'operational' as const,
    partitionKeyPattern: 'entity:{entityId}',
  })
}
```

### Storage Characteristics Comparison

| Aspect | EventLog (Structural/Operational) | TimescaleDB (Temporal) |
|--------|-----------------------------------|------------------------|
| **Schema** | JSONB payload column | Columnar (time, entityId, value) |
| **Indexing** | entityId, occurredAt, eventType | Hypertable on time, entityId |
| **Query** | Event replay, time-travel | Time-bucket aggregation |
| **Retention** | Indefinite (audit) | Tiered (raw→1min→1hour) |
| **Compaction** | Snapshot every N events | Continuous aggregates |
| **Reactivity** | Atom cache invalidation | Real-time aggregate refresh |

---

## Event Group Definitions

For `@effect/experimental/EventGroup` integration:

```typescript
import * as EventGroup from '@effect/experimental/EventGroup'

// ══════════════════════════════════════════════════════════════════════════════
// STRUCTURAL EVENT GROUP
// ══════════════════════════════════════════════════════════════════════════════

export const StructuralEvents = EventGroup.make(
  // Enterprise
  EnterpriseCreated,
  EnterpriseUpdated,
  EnterpriseDecommissioned,
  // Plant
  PlantCreated,
  PlantUpdated,
  PlantRelocated,
  PlantTimezoneChanged,
  PlantDecommissioned,
  // Line
  LineCreated,
  LineUpdated,
  LineConfigChanged,
  LineRelocated,
  LineDecommissioned,
  // Machine
  MachineCreated,
  MachineUpdated,
  MachineConfigChanged,
  MachineRelocated,
  MachineDecommissioned,
  // Sensor
  SensorCreated,
  SensorUpdated,
  SensorCalibrated,
  SensorThresholdChanged,
  SensorDecommissioned,
)

// ══════════════════════════════════════════════════════════════════════════════
// OPERATIONAL EVENT GROUP
// ══════════════════════════════════════════════════════════════════════════════

export const OperationalEvents = EventGroup.make(
  // Machine operations
  MachineStateChanged,
  MachineMaintenanceScheduled,
  MachineMaintenanceStarted,
  MachineMaintenanceCompleted,
  MachineAlarmRaised,
  MachineAlarmCleared,
  // Sensor operations
  SensorAlarmTriggered,
  SensorAlarmAcknowledged,
  SensorAlarmCleared,
  SensorCommunicationLost,
  SensorCommunicationRestored,
  // Alarm operations (ISA-18.2)
  AlarmTriggered,
  AlarmAcknowledged,
  AlarmShelved,
  AlarmSuppressed,
  AlarmCleared,
  AlarmOutOfService,
  AlarmReturnedToService,
)

// ══════════════════════════════════════════════════════════════════════════════
// COMBINED EVENTLOG GROUP (for SqlEventJournal)
// ══════════════════════════════════════════════════════════════════════════════

export const IIoTEventLogEvents = EventGroup.merge(
  StructuralEvents,
  OperationalEvents
)

// Temporal events are NOT in an EventGroup — they go to TimescaleDB
```

---

## Schema Evolution Strategy

All events include optional `schemaVersion` for forward compatibility:

```typescript
// Version 1: Original schema
export class SensorCreatedV1 extends BaseStructuralEvent.extend<SensorCreatedV1>(
  'SensorCreated' // Same tag
)({
  deviceId: DeviceId,
  name: Schema.NonEmptyString,
  parentId: AssetId,
  sensorType: Schema.String,
  unit: Schema.String,
  schemaVersion: Schema.Literal(1).pipe(Schema.optional),
}) {}

// Version 2: Added sampleRateMs
export class SensorCreatedV2 extends BaseStructuralEvent.extend<SensorCreatedV2>(
  'SensorCreated' // Same tag
)({
  deviceId: DeviceId,
  name: Schema.NonEmptyString,
  parentId: AssetId,
  sensorType: Schema.String,
  unit: Schema.String,
  sampleRateMs: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  schemaVersion: Schema.Literal(2),
}) {}

/** Union of all versions for decoding */
export const SensorCreated = Schema.Union(SensorCreatedV1, SensorCreatedV2)
export type SensorCreated = Schema.Schema.Type<typeof SensorCreated>
```

---

## Implementation Checklist

### Phase 1: Base Classes

- [ ] Define `HierarchyPath` branded type in `identifiers.ts`
- [ ] Create `src/lib/iiot/schemas/events/base.ts` with three base classes
- [ ] Add `EquipmentState` literal to `identifiers.ts` or new `equipment-state.ts`

### Phase 2: Structural Events

- [ ] Create `src/lib/iiot/schemas/events/structural.ts`
- [ ] Implement all `*Created`, `*Updated`, `*Decommissioned` events
- [ ] Implement `*Relocated`, `*ConfigChanged` events
- [ ] Implement `SensorCalibrated`, `SensorThresholdChanged`

### Phase 3: Operational Events

- [ ] Create `src/lib/iiot/schemas/events/operational.ts`
- [ ] Implement `MachineStateChanged` with ISA-88 states
- [ ] Implement maintenance lifecycle events
- [ ] Implement alarm lifecycle events (ISA-18.2)

### Phase 4: Temporal Events

- [ ] Verify `SensorReading` in `readings.ts` aligns with `BaseTemporalEvent`
- [ ] Add `bucketTime` field if missing
- [ ] Ensure TimescaleDB schema matches

### Phase 5: EventGroup Integration

- [ ] Create `src/lib/iiot/schemas/events/groups.ts`
- [ ] Define `StructuralEvents`, `OperationalEvents`, `IIoTEventLogEvents`
- [ ] Wire into `SqlEventJournal` configuration

---

## Appendix: Complete Event Inventory

| Entity | Structural | Operational | Temporal |
|--------|------------|-------------|----------|
| Enterprise | Created, Updated, Decommissioned | — | — |
| Site/Plant | Created, Updated, Relocated, TimezoneChanged, Decommissioned | — | — |
| Area | Created, Updated, Relocated, Decommissioned | — | — |
| Line | Created, Updated, ConfigChanged, Relocated, Decommissioned | — | — |
| WorkCell | Created, Updated, ConfigChanged, Relocated, Decommissioned | — | — |
| Machine | Created, Updated, ConfigChanged, Relocated, Decommissioned | StateChanged, MaintenanceScheduled/Started/Completed, AlarmRaised/Cleared | — |
| Sensor | Created, Updated, Calibrated, ThresholdChanged, Decommissioned | AlarmTriggered/Acknowledged/Cleared, CommunicationLost/Restored | Reading, Metric |

**Total:** 
- Structural: ~25 events
- Operational: ~15 events  
- Temporal: 2 event types (high volume)

---

## References

- ISA-95 (IEC 62264): Equipment hierarchy standard
- ISA-88: Equipment state model
- ISA-18.2: Alarm management standard
- `@effect/experimental/EventLog`: Event sourcing infrastructure
- `@effect/sql/SqlEventJournal`: PostgreSQL journal implementation
- TimescaleDB: Time-series extension for PostgreSQL
