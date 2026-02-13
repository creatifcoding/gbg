# TMNL Entity System Specification

**Version:** 1.0.0
**Created:** 2026-01-30
**Status:** UNIFIED SPECIFICATION
**Authors:** architect-agent (Val)
**Sources:** entity-system/01-05

---

## Executive Summary

The TMNL Entity System implements the ISA-95 (IEC 62264) Equipment Hierarchy standard using Effect-TS for type-safe, event-sourced manufacturing operations. This specification unifies the foundational patterns for:

1. **Entity Base Architecture** — Naming conventions, abstract contracts, and shared fields
2. **Hierarchy Path System** — Typed data structure for equipment ancestry
3. **Event Type Hierarchy** — Three-category divergent event model (Structural/Operational/Temporal)
4. **Storage Architecture** — Dual-store design (EventLog + TimescaleDB)
5. **Entity Catalog** — Complete definitions for all 10 ISA-95 entity types

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Effect Schema TaggedClass** | Runtime validation, branded types, JSON Schema generation |
| **Three divergent event bases** | Storage/query/retention characteristics differ fundamentally |
| **Dual-store architecture** | EventLog for domain events, TimescaleDB for time-series |
| **HierarchyPath data structure** | O(1) depth, O(d) traversal, immutable, validated |
| **EntityId as universal join key** | Cross-store correlation for RCA, OEE calculation |

---

## Table of Contents

1. [Entity Base Architecture](#1-entity-base-architecture)
2. [Hierarchy Path System](#2-hierarchy-path-system)
3. [Event Type Hierarchy](#3-event-type-hierarchy)
4. [Storage Architecture](#4-storage-architecture)
5. [Entity Catalog](#5-entity-catalog)
6. [Implementation Roadmap](#6-implementation-roadmap)
7. [Appendix A: Type Definitions](#appendix-a-type-definitions)
8. [Appendix B: Schema Definitions](#appendix-b-schema-definitions)
9. [Appendix C: DDL Templates](#appendix-c-ddl-templates)

---

## 1. Entity Base Architecture

### 1.1 Naming Conventions

All Effect Schema `TaggedClass` definitions receive the `Schema` postfix to distinguish them from other artifacts:

| Artifact Type | Naming Pattern | Example |
|---------------|----------------|---------|
| Schema (TaggedClass) | `{Entity}Schema` | `EnterpriseSchema`, `PlantSchema`, `LineSchema` |
| Model (Persistence) | `{Entity}Model` | `EnterpriseModel`, `PlantModel`, `LineModel` |
| DDL (SQL) | `{Entity}DDL` | `EnterpriseDDL`, `PlantDDL`, `LineDDL` |
| Type (Inferred) | `{Entity}` | `Enterprise`, `Plant`, `Line` |

#### Namespace Pattern

Each entity exports a namespace containing all related artifacts:

```typescript
// src/lib/iiot/schemas/enterprise.ts

export const EnterpriseSchema = Schema.TaggedClass<EnterpriseSchema>()('Enterprise', { ... })
export type Enterprise = Schema.Schema.Type<typeof EnterpriseSchema>

export namespace Enterprise {
  export const Schema = EnterpriseSchema
  export type Model = typeof EnterpriseModel.Type
  export const DDL = `CREATE TABLE enterprises (...)`
  export type Type = Enterprise
}
```

#### Export Strategy

Statics are exported separately for tree-shaking:

```typescript
// Named exports for tree-shaking
export { EnterpriseSchema, EnterpriseModel, EnterpriseDDL }

// Namespace export for convenience
export { Enterprise }

// Type export
export type { Enterprise }
```

#### Complete Naming Table

| Equipment Level | Schema Class | Model Class | DDL Constant | Type Alias |
|-----------------|--------------|-------------|--------------|------------|
| Enterprise | `EnterpriseSchema` | `EnterpriseModel` | `EnterpriseDDL` | `Enterprise` |
| Site | `SiteSchema` | `SiteModel` | `SiteDDL` | `Site` |
| Area | `AreaSchema` | `AreaModel` | `AreaDDL` | `Area` |
| Plant | `PlantSchema` | `PlantModel` | `PlantDDL` | `Plant` |
| Line | `LineSchema` | `LineModel` | `LineDDL` | `Line` |
| WorkCell | `WorkCellSchema` | `WorkCellModel` | `WorkCellDDL` | `WorkCell` |
| Machine | `MachineSchema` | `MachineModel` | `MachineDDL` | `Machine` |
| Sensor | `SensorSchema` | `SensorModel` | `SensorDDL` | `Sensor` |
| Device | `DeviceSchema` | `DeviceModel` | `DeviceDDL` | `Device` |

### 1.2 Abstract Entity Contract

All equipment hierarchy entities must satisfy a common contract for:
- Operational status queries
- Automation level mapping (ISA-95 L0-L4)
- Hierarchy path materialization
- Lifecycle hooks with Effect integration

```typescript
// src/lib/iiot/schemas/entity-contract.ts

import { Effect, Schema } from 'effect'
import type { EntityError, ValidationError } from './errors'

/**
 * Abstract contract for all ISA-95 equipment entities.
 */
export interface EntityContract<
  TSchema extends Schema.Schema.Any,
  TModel,
  TDeps = never
> {
  // Schema Introspection (Static)
  readonly Schema: TSchema
  readonly Model: TModel
  readonly DDL: string

  // Operational Methods (Instance)
  isOperational(): boolean
  getAutomationLevel(): 0 | 1 | 2 | 3 | 4
  materializePath(): string

  // Lifecycle Hooks (Effect-Native)
  onCreate(): Effect.Effect<void, EntityError, TDeps>
  onUpdate(): Effect.Effect<void, EntityError, TDeps>
  validate(): Effect.Effect<void, ValidationError, never>
}
```

### 1.3 BaseAssetFields

Common fields spread into all equipment TaggedClasses:

```typescript
// src/lib/iiot/schemas/base-fields.ts

export const BaseAssetFields = {
  // Core Identity
  name: Schema.NonEmptyString,
  status: AssetStatus,
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  // Location & Metadata
  location: Schema.optionalWith(AssetLocation, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { default: () => ({}) }),

  // Timestamps
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  // Hierarchy (New Fields)
  hierarchyPath: HierarchyPath,
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  siteId: Schema.optionalWith(SiteId, { as: 'Option' }),
  areaId: Schema.optionalWith(AreaId, { as: 'Option' }),
  plantId: Schema.optionalWith(PlantId, { as: 'Option' }),
  lineId: Schema.optionalWith(LineId, { as: 'Option' }),
  machineId: Schema.optionalWith(MachineId, { as: 'Option' }),
} as const
```

### 1.4 Validation Layers

| Layer | Mechanism | Validates | Failure Mode |
|-------|-----------|-----------|--------------|
| Compile-time | TypeScript types | Field presence, basic types | Red squiggles |
| Schema.decode | Effect Schema filters | Path consistency, business rules | `ParseError` |
| DDL | Foreign key constraints | Referential integrity | DB error |

#### Schema Filter Example

```typescript
// Validate hierarchyPath matches parent ID fields
const validatePathConsistency = Schema.filter(
  (entity: { hierarchyPath: string; enterpriseId?: string; siteId?: string }) => {
    const parsed = parseHierarchyPath(entity.hierarchyPath as HierarchyPath)
    
    if (entity.enterpriseId && parsed.enterpriseId !== entity.enterpriseId) {
      return false
    }
    if (entity.siteId && parsed.siteId !== entity.siteId) {
      return false
    }
    
    return true
  },
  { message: () => 'hierarchyPath must match parent ID fields' }
)
```

### 1.5 ISA-95 Automation Level Mapping

```typescript
// src/lib/iiot/schemas/automation-levels.ts

export type AutomationLevel = 0 | 1 | 2 | 3 | 4

export const getAutomationLevelForEquipment = (kind: EquipmentLevel): AutomationLevel => {
  switch (kind) {
    case 'enterprise': return 4  // L4: Business Planning
    case 'site':       return 3  // L3: Manufacturing Ops (MES)
    case 'area':       return 2  // L2: Supervisory Control (SCADA)
    case 'plant':      return 3  // L3: Manufacturing Ops (functional)
    case 'line':       return 1  // L1: Automation Control (PLC)
    case 'workcell':   return 1  // L1: Work Unit
    case 'machine':    return 1  // L1: Equipment
    case 'sensor':     return 0  // L0: Physical Process
    case 'device':     return 0  // L0: Physical Process
  }
}

export const AUTOMATION_LEVELS: Record<AutomationLevel, {
  name: string
  systems: string[]
  tmnlScope: string
}> = {
  4: { name: 'Business Planning', systems: ['ERP', 'BI'], tmnlScope: 'Future integration' },
  3: { name: 'Manufacturing Ops', systems: ['MES', 'MOM'], tmnlScope: 'AMS v3' },
  2: { name: 'Supervisory Control', systems: ['SCADA', 'HMI'], tmnlScope: 'IIoT Services' },
  1: { name: 'Automation Control', systems: ['PLC', 'DCS'], tmnlScope: 'Control Module schemas' },
  0: { name: 'Physical Process', systems: ['Sensors', 'Actuators'], tmnlScope: 'sensor_readings hypertable' },
}
```

---

## 2. Hierarchy Path System

### 2.1 HierarchyPath Schema

`HierarchyPath` is a typed data structure representing a position within the ISA-95 equipment hierarchy. It provides efficient traversal, membership testing, and validation operations with documented algorithmic characteristics.

**Key Properties:**
- Immutable after construction
- O(1) depth comparison
- O(d) traversal operations where d = depth
- Runtime-validated ISA-95 hierarchy rules

#### ISA-95 Hierarchy Model

```
Level 4 (Enterprise)
    └── Level 3 (Site)
            └── Level 2 (Area)
                    └── Level 3* (Plant - functional within Site)
                            └── Level 1 (Line)
                                    └── Level 1 (WorkCell)
                                            └── Level 1 (Machine)
                                                    └── Level 0 (Sensor/Device)
```

#### Schema Definition

```typescript
import { Schema, Effect, Data } from 'effect'
import { EquipmentLevel, AssetId } from '../identifiers'

/**
 * A single segment in the hierarchy path.
 */
export class PathSegment extends Schema.TaggedClass<PathSegment>()('PathSegment', {
  level: EquipmentLevel,
  id: AssetId,
  name: Schema.optional(Schema.NonEmptyString),
}) {}

/**
 * A complete path through the ISA-95 equipment hierarchy.
 */
export class HierarchyPath extends Schema.TaggedClass<HierarchyPath>()('HierarchyPath', {
  segments: Schema.Array(PathSegment),
  materialized: Schema.String,
  depth: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
}) {
  get root(): PathSegment | undefined { return this.segments[0] }
  get leaf(): PathSegment | undefined { return this.segments[this.segments.length - 1] }
  get isEmpty(): boolean { return this.depth === 0 }

  getParent(): HierarchyPath | null { /* ... */ }
  getAncestors(): ReadonlyArray<HierarchyPath> { /* ... */ }
  isAncestorOf(other: HierarchyPath): boolean { /* ... */ }
  isDescendantOf(other: HierarchyPath): boolean { /* ... */ }
  contains(assetId: AssetId): boolean { /* ... */ }
  getCommonAncestor(other: HierarchyPath): HierarchyPath | null { /* ... */ }
  getAncestorAtLevel(level: EquipmentLevel): AssetId | null { /* ... */ }

  validate(): Effect.Effect<void, HierarchyValidationError, never> { /* ... */ }
  canHaveChild(childLevel: EquipmentLevel): boolean { /* ... */ }
  append(segment: PathSegment): Effect.Effect<HierarchyPath, HierarchyValidationError, never> { /* ... */ }

  static fromSegments(segments: ReadonlyArray<PathSegment>): HierarchyPath { /* ... */ }
  static fromMaterialized(path: string, levelMap: Map<string, EquipmentLevel>): Effect.Effect<HierarchyPath, HierarchyParseError, never> { /* ... */ }
  static empty(): HierarchyPath { /* ... */ }
  static root(segment: PathSegment): Effect.Effect<HierarchyPath, HierarchyValidationError, never> { /* ... */ }
}
```

### 2.2 Algorithmic Operations

| Operation | Complexity | Notes |
|-----------|------------|-------|
| `root`, `leaf`, `isEmpty` | O(1) | Direct array access |
| `getSegmentAt(i)` | O(1) | Array index |
| `depth` comparison | O(1) | Stored field |
| `getParent()` | O(d) | Recomputes materialized |
| `getAncestors()` | O(d²) | Creates d paths |
| `getAncestorIds()` | O(d) | Array slice + map |
| `isAncestorOf()` | O(min(d1,d2)) | Segment comparison |
| `contains(id)` | O(d) | Linear search |
| `getCommonAncestor()` | O(min(d1,d2)) | Prefix comparison |
| `validate()` | O(d) | Single pass |
| `append()` | O(d) | Validation + construction |
| `fromSegments()` | O(d) | Materialized computation |
| `fromMaterialized()` | O(d) | String parsing |

### 2.3 Validation Rules

#### Rule 1: Root Must Be Enterprise

```typescript
// Valid
[enterprise] -> [site] -> [plant]

// Invalid - Missing enterprise root
[site] -> [plant]
// Error: INVALID_ROOT
```

#### Rule 2: Valid Parent-Child Relationships

| Parent Level | Valid Child Levels |
|--------------|-------------------|
| enterprise | site |
| site | area, plant |
| area | plant, line |
| plant | line |
| line | workcell, machine |
| workcell | machine, sensor |
| machine | sensor |
| sensor | (none - leaf only) |

#### Rule 3: No Duplicate IDs

```typescript
// Invalid
[ENT-acme] -> [SIT-chicago] -> [SIT-chicago]
// Error: DUPLICATE_ID
```

### 2.4 ISA-95 Level Mapping

```typescript
export function getAutomationLevel(level: EquipmentLevel): 0 | 1 | 2 | 3 | 4 {
  const levels: Record<EquipmentLevel, 0 | 1 | 2 | 3 | 4> = {
    enterprise: 4,
    site: 3,
    area: 2,
    plant: 3, // Functional L3 within Site
    line: 1,
    workcell: 1,
    machine: 1,
    sensor: 0,
  }
  return levels[level]
}

export const STANDARD_LEVEL_MAP = new Map<string, EquipmentLevel>([
  ['ENT', 'enterprise'],
  ['SIT', 'site'],
  ['ARE', 'area'],
  ['PLT', 'plant'],
  ['LIN', 'line'],
  ['WCL', 'workcell'],
  ['MCH', 'machine'],
  ['SEN', 'sensor'],
  ['DEV', 'sensor'], // Alias for sensor/device
])
```

### 2.5 Helper Functions

```typescript
/**
 * Check if a parent-child relationship is valid per ISA-95.
 */
export function isValidParentChild(
  parent: EquipmentLevel,
  child: EquipmentLevel
): boolean {
  const validChildren: Record<EquipmentLevel, ReadonlyArray<EquipmentLevel>> = {
    enterprise: ['site'],
    site: ['area', 'plant'],
    area: ['plant', 'line'],
    plant: ['line'],
    line: ['workcell', 'machine'],
    workcell: ['machine', 'sensor'],
    machine: ['sensor'],
    sensor: [],
  }
  
  return validChildren[parent].includes(child)
}
```

---

## 3. Event Type Hierarchy

### 3.1 Event Classification (Structural/Operational/Temporal)

This specification defines a **three-category event hierarchy** for full event sourcing across all IIoT entities. The categories are **divergent by design** — they do NOT inherit from a common root, because their storage semantics, query patterns, and lifecycle characteristics are fundamentally different.

| Category | Storage | Query Pattern | Retention | Example |
|----------|---------|---------------|-----------|---------|
| **Structural** | EventLog | Replay from origin | Indefinite | EntityCreated, ConfigUpdated |
| **Operational** | EventLog | Replay + time-travel | Indefinite | StateChanged, AlarmRaised |
| **Temporal** | TimescaleDB | Time-bucketed aggregation | Tiered (hot/warm/cold) | SensorReading, Metric |

#### Why Three Divergent Bases (Not Common Root)

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

### 3.2 Base Event Classes (divergent)

#### BaseStructuralEvent

Structural events capture **entity lifecycle and configuration changes**. These are the "shape" of the system.

```typescript
export class BaseStructuralEvent extends Schema.TaggedClass<BaseStructuralEvent>()(
  'BaseStructuralEvent',
  {
    eventId: EventId,
    occurredAt: Schema.DateTimeUtc,
    causedBy: Schema.String,
    entityId: AssetId,
    entityType: EquipmentLevel,
    hierarchyPath: HierarchyPath,  // For cascade operations
    correlationId: Schema.optional(Schema.String),
    schemaVersion: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  }
) {}
```

**Why `hierarchyPath`?** When a Line is relocated under a different Area, all child Machines and Sensors need cascade events. The `hierarchyPath` enables:
- Single-query child lookup: `WHERE hierarchyPath @> ARRAY['LINE-001']`
- Audit trail: "Machine X was under Line Y at the time of this event"
- Cascade validation: Ensure parent exists before child creation

#### BaseOperationalEvent

Operational events capture **runtime business events** — state changes, alarms, maintenance actions.

```typescript
export class BaseOperationalEvent extends Schema.TaggedClass<BaseOperationalEvent>()(
  'BaseOperationalEvent',
  {
    eventId: EventId,
    occurredAt: Schema.DateTimeUtc,
    causedBy: Schema.String,
    entityId: AssetId,
    entityType: EquipmentLevel,
    // NO hierarchyPath — operational events reference a single entity
    correlationId: Schema.optional(Schema.String),
    schemaVersion: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  }
) {}
```

**Why no `hierarchyPath`?** Operational events describe what happened TO an entity, not what the entity IS. If a Machine is relocated after an alarm, the alarm should still reference the Machine's current position.

#### BaseTemporalEvent

Temporal events are **high-frequency measurements** — sensor readings, metrics, counters. They are NOT stored in the EventLog.

```typescript
export class BaseTemporalEvent extends Schema.TaggedClass<BaseTemporalEvent>()(
  'BaseTemporalEvent',
  {
    time: Schema.DateTimeUtc,
    entityId: AssetId,
    bucketTime: Schema.DateTimeUtc,  // Pre-computed for aggregate joins
    quality: Schema.optional(Schema.String),
  }
) {}
```

**Why `bucketTime`?** TimescaleDB continuous aggregates partition by time buckets. Pre-computing the bucket time:
- Enables efficient aggregate joins
- Avoids repeated `time_bucket()` calls
- Supports multi-resolution queries (hot/warm/cold)

### 3.3 Extension Patterns

All concrete events extend their appropriate base using `Schema.Class.extend`:

```typescript
// Structural Event Extension
export class PlantCreated extends BaseStructuralEvent.extend<PlantCreated>(
  'PlantCreated'
)({
  plantId: PlantId,
  name: Schema.NonEmptyString,
  timezone: Schema.String,
  initialConfig: Schema.optional(AssetProperties),
  initialLocation: Schema.optional(AssetLocation),
}) {}

// Operational Event Extension
export class MachineStateChanged extends BaseOperationalEvent.extend<MachineStateChanged>(
  'MachineStateChanged'
)({
  machineId: MachineId,
  previousState: EquipmentState,
  newState: EquipmentState,
  previousStateDuration: Schema.optional(Schema.Number),
  reasonCode: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String),
}) {}

// Temporal Event Extension
export class SensorReadingEvent extends BaseTemporalEvent.extend<SensorReadingEvent>(
  'SensorReadingEvent'
)({
  deviceId: DeviceId,
  value: Schema.Number,
  opcUaQuality: Schema.optional(Schema.String),
  qualityScore: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 100))),
}) {}
```

### 3.4 Event Catalog per Entity

#### Enterprise Events (Structural)

| Event | Base | Description |
|-------|------|-------------|
| `EnterpriseCreated` | Structural | Multi-site corporation registered |
| `EnterpriseUpdated` | Structural | Name, metadata changed |
| `EnterpriseDecommissioned` | Structural | Corporation dissolved (soft delete) |

#### Site/Area/Plant Events (Structural)

| Event | Base | Description |
|-------|------|-------------|
| `PlantCreated` | Structural | New plant registered |
| `PlantUpdated` | Structural | Name, description, config changed |
| `PlantRelocated` | Structural | Moved to different parent (rare) |
| `PlantTimezoneChanged` | Structural | Timezone updated (affects all readings) |
| `PlantDecommissioned` | Structural | Plant taken offline |

#### Machine Events (Structural + Operational)

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

#### Sensor Events (Structural + Operational + Temporal)

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

### 3.5 Event Routing

#### Decision Tree

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

#### EventGroup Definitions

```typescript
import * as EventGroup from '@effect/experimental/EventGroup'

export const StructuralEvents = EventGroup.make(
  EnterpriseCreated, EnterpriseUpdated, EnterpriseDecommissioned,
  PlantCreated, PlantUpdated, PlantRelocated, PlantTimezoneChanged, PlantDecommissioned,
  LineCreated, LineUpdated, LineConfigChanged, LineRelocated, LineDecommissioned,
  MachineCreated, MachineUpdated, MachineConfigChanged, MachineRelocated, MachineDecommissioned,
  SensorCreated, SensorUpdated, SensorCalibrated, SensorThresholdChanged, SensorDecommissioned,
)

export const OperationalEvents = EventGroup.make(
  MachineStateChanged, MachineMaintenanceScheduled, MachineMaintenanceStarted,
  MachineMaintenanceCompleted, MachineAlarmRaised, MachineAlarmCleared,
  SensorAlarmTriggered, SensorAlarmAcknowledged, SensorAlarmCleared,
  SensorCommunicationLost, SensorCommunicationRestored,
  AlarmTriggered, AlarmAcknowledged, AlarmShelved, AlarmSuppressed, AlarmCleared,
)

export const IIoTEventLogEvents = EventGroup.merge(
  StructuralEvents,
  OperationalEvents
)
```

---

## 4. Storage Architecture

### 4.1 Dual Store Design

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    ENTITY (MCH-001)                                      │
│                                                                                          │
│    entityId: MachineId = "MCH-001"                                                       │
│                                                                                          │
├─────────────────────────────────────┬───────────────────────────────────────────────────┤
│          EVENT STORE                │            TEMPORAL STORE                          │
│       (@effect/experimental)        │             (TimescaleDB)                          │
│                                     │                                                    │
│  ┌─────────────────────────────┐    │    ┌─────────────────────────────┐                │
│  │     SqlEventJournal         │    │    │      Hypertables            │                │
│  │  • iiot_event_journal       │    │    │  • iiot.sensor_readings     │                │
│  │  • iiot_event_remotes       │    │    │  • readings_1min (cagg)     │                │
│  └─────────────────────────────┘    │    │  • readings_1hour (cagg)    │                │
│                                     │    └─────────────────────────────┘                │
│  Domain Events:                     │                                                    │
│  • EquipmentStateChanged            │    Time-Series Data:                               │
│  • AlarmTriggered                   │    • Sensor readings (values)                      │
│  • WorkOrderCreated                 │    • Metrics/telemetry                             │
│                                     │                                                    │
└──────────────────┬──────────────────┴───────────────────┬────────────────────────────────┘
                   │                                      │
                   └────────────┬─────────────────────────┘
                                │
                          ┌─────┴─────┐
                          │ entityId  │  ← Universal Join Key
                          └───────────┘
```

### 4.2 EventLog Configuration

```typescript
// src/lib/iiot/infrastructure/eventlog-layer.ts

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
  AlarmEvents,
  WorkOrderLifecycleEvents,
  EquipmentStateEvents,
)

export const IIoTEventLogLayer = EventLog.layer(IIoTEventLogSchema)

export const IIoTEventLogStackLayer = IIoTEventLogLayer.pipe(
  Layer.provide(IIoTSqlEventJournalLayer),
  Layer.provide(IIoTIdentityLayer)
)
```

### 4.3 TimescaleDB Schema

```sql
-- Main sensor readings hypertable
CREATE TABLE iiot.sensor_readings (
  time            TIMESTAMPTZ NOT NULL,
  device_id       VARCHAR(128) NOT NULL,
  asset_id        VARCHAR(128),
  value           DOUBLE PRECISION NOT NULL,
  quality         SMALLINT NOT NULL DEFAULT 100,
  opc_ua_quality  VARCHAR(64),
  
  PRIMARY KEY (device_id, time)
);

SELECT create_hypertable('iiot.sensor_readings', by_range('time', INTERVAL '7 days'));

-- Continuous Aggregates
CREATE MATERIALIZED VIEW iiot.readings_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', time) AS bucket,
  device_id,
  AVG(value) AS avg_value,
  MIN(value) AS min_value,
  MAX(value) AS max_value,
  STDDEV(value) AS stddev_value,
  COUNT(*) AS sample_count
FROM iiot.sensor_readings
GROUP BY bucket, device_id
WITH NO DATA;

CREATE MATERIALIZED VIEW iiot.readings_1hour
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  device_id,
  AVG(value) AS avg_value,
  MIN(value) AS min_value,
  MAX(value) AS max_value,
  STDDEV(value) AS stddev_value,
  COUNT(*) AS sample_count
FROM iiot.sensor_readings
GROUP BY bucket, device_id
WITH NO DATA;
```

### 4.4 Cross-Store Queries

#### Pattern 1: Entity History (EventLog Only)

```typescript
export const getEntityHistory = (entityId: MachineId) =>
  Effect.gen(function* () {
    const eventLog = yield* IIoTEventLog
    const events = yield* eventLog.read({
      primaryKey: entityId,
      limit: 100,
    })
    return events
  })
```

#### Pattern 2: Time-Series Aggregation (TimescaleDB Only)

```typescript
export const getReadingsLast24h = (deviceId: DeviceId) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const readings = yield* sql`
      SELECT bucket, avg_value, min_value, max_value, sample_count
      FROM iiot.readings_1hour
      WHERE device_id = ${deviceId}
        AND bucket >= NOW() - INTERVAL '24 hours'
      ORDER BY bucket DESC
    `
    return readings
  })
```

#### Pattern 3: Cross-Store Correlation (Join Pattern)

```typescript
export const correlateAlarmWithReadings = (alarmId: AlarmId, windowMinutes = 5) =>
  Effect.gen(function* () {
    const eventLog = yield* IIoTEventLog
    const sql = yield* SqlClient.SqlClient
    
    // Step 1: Get alarm event from EventLog
    const alarmEvents = yield* eventLog.read({
      primaryKey: alarmId,
      tags: ['AlarmTriggered'],
      limit: 1,
    })
    
    const alarm = alarmEvents[0].payload
    const alarmTime = alarm.triggeredAt
    const deviceId = alarm.deviceId
    
    // Step 2: Query TimescaleDB for readings in time window
    const readings = yield* sql`
      SELECT time, value, quality
      FROM iiot.sensor_readings
      WHERE device_id = ${deviceId}
        AND time BETWEEN 
          ${alarmTime}::timestamptz - INTERVAL '${windowMinutes} minutes'
          AND ${alarmTime}::timestamptz + INTERVAL '${windowMinutes} minutes'
      ORDER BY time ASC
    `
    
    return { alarm, readings, window: { before: windowMinutes, after: windowMinutes } }
  })
```

#### Pattern 4: OEE Calculation (Hybrid)

```typescript
export const calculateOEE = (equipmentId: MachineId, from: Date, to: Date) =>
  Effect.gen(function* () {
    const eventLog = yield* IIoTEventLog
    const sql = yield* SqlClient.SqlClient
    
    // Step 1: Get state events from EventLog
    const stateEvents = yield* eventLog.read({
      primaryKey: equipmentId,
      entityType: 'equipment',
      after: from,
      before: to,
    })
    
    // Step 2: Calculate availability from state durations
    const availability = calculateAvailabilityFromEvents(stateEvents, from, to)
    
    // Step 3: Get production metrics from TimescaleDB
    const metrics = yield* sql`
      SELECT 
        SUM(value) FILTER (WHERE metric_name = 'actual_count') as actual_count,
        SUM(value) FILTER (WHERE metric_name = 'ideal_count') as ideal_count,
        SUM(value) FILTER (WHERE metric_name = 'good_count') as good_count
      FROM iiot.equipment_metrics
      WHERE equipment_id = ${equipmentId}
        AND time BETWEEN ${from} AND ${to}
    `
    
    // Step 4: Calculate OEE components
    const performance = metrics.actual_count / metrics.ideal_count
    const quality = metrics.good_count / metrics.actual_count
    const oee = availability.availability * performance * quality
    
    return { equipmentId, from, to, availability: availability.availability, performance, quality, oee }
  })
```

### 4.5 Retention Policies

#### EventLog Retention

| Domain | Hot Retention | Compaction Trigger | Cold Archive |
|--------|---------------|-------------------|--------------|
| **Alarms** | 90 days | > 1000 events/entity OR status=cleared + 7 days | 7 years (ISA-18.2) |
| **Work Orders** | 180 days | status=closed + 30 days | 10 years (FDA 21 CFR Part 11) |
| **Equipment State** | 30 days | > 500 events/entity | 2 years |
| **Tasks** | 90 days | parent WO closed + 30 days | 5 years |
| **Approvals** | 180 days | status=completed + 30 days | 10 years (FDA) |

#### TimescaleDB Retention

| Table | Chunk Interval | Compression After | Drop After |
|-------|----------------|-------------------|------------|
| **sensor_readings** | 7 days | 30 days | 2 years |
| **readings_1min** | 7 days | 90 days | 1 year |
| **readings_1hour** | 30 days | N/A | 5 years |
| **readings_1day** | 90 days | N/A | Forever |
| **equipment_metrics** | 7 days | 30 days | 2 years |

---

## 5. Entity Catalog

### 5.1 ID Patterns

All entity IDs follow a consistent pattern: `{PREFIX}-{slug}` where slug is alphanumeric with hyphens.

| Entity | Prefix | Regex Pattern | Factory Function |
|--------|--------|---------------|------------------|
| Enterprise | ENT- | `^ENT-[a-zA-Z0-9-]+$` | `makeEnterpriseId(slug)` |
| Site | SIT- | `^SIT-[a-zA-Z0-9-]+$` | `makeSiteId(slug)` |
| Area | ARA- | `^ARA-[a-zA-Z0-9-]+$` | `makeAreaId(slug)` |
| Plant | PLT- | `^PLT-[a-zA-Z0-9-]+$` | `makePlantId(slug)` |
| Line | LIN- | `^LIN-[a-zA-Z0-9-]+$` | `makeLineId(slug)` |
| WorkCell | WCL- | `^WCL-[a-zA-Z0-9-]+$` | `makeWorkCellId(slug)` |
| Machine | MCH- | `^MCH-[a-zA-Z0-9-]+$` | `makeMachineId(slug)` |
| Sensor | SNS- | `^SNS-[a-zA-Z0-9-]+$` | `makeSensorId(slug)` |
| Device | DEV- | `^DEV-[a-zA-Z0-9-]+$` | `makeDeviceId(slug)` |

### 5.2 Parent Constraints

```
                    Valid Parent →
Child ↓             ENT  SIT  ARA  PLT  LIN  WCL  MCH  SNS  DEV
─────────────────────────────────────────────────────────────────
Enterprise          ─    ✗    ✗    ✗    ✗    ✗    ✗    ✗    ✗
Site                ✓    ─    ✗    ✗    ✗    ✗    ✗    ✗    ✗
Area                ✗    ✓    ─    ✗    ✗    ✗    ✗    ✗    ✗
Plant               ✗    ✓    ✓    ─    ✗    ✗    ✗    ✗    ✗
Line                ✗    ✗    ✗    ✓    ─    ✗    ✗    ✗    ✗
WorkCell            ✗    ✗    ✗    ✗    ✓    ─    ✗    ✗    ✗
Machine             ✗    ✗    ✗    ✗    ✓    ✓    ─    ✗    ✗
Sensor              ✗    ✗    ✗    ✗    ✗    ✗    ✓    ─    ✗
Device              ✗    ✗    ✗    ✗    ✗    ✗    ✓    ✗    ─

Legend: ✓ = valid parent, ✗ = invalid parent, ─ = self (N/A)
```

### 5.3 Entity Definitions

#### Enterprise (L4)

**ISA-95 Role:** Business Planning (ERP/BI scope)
**Container:** Yes (contains Sites)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `EnterpriseId` | Yes | ENT-{slug} format |
| `name` | `NonEmptyString` | Yes | Enterprise name |
| `status` | `AssetStatus` | Yes | Operational status |
| `industry` | `Option<String>` | No | Industry sector |
| `legalName` | `Option<String>` | No | Legal entity name |
| `taxId` | `Option<String>` | No | Tax identification |
| `headquarters` | `Option<String>` | No | HQ location/address |

#### Site (L3 - Geographic)

**ISA-95 Role:** Geographic location (MES scope)
**Container:** Yes (contains Areas, Plants)
**Parent:** Enterprise (required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `SiteId` | Yes | SIT-{slug} format |
| `enterpriseId` | `EnterpriseId` | Yes | Parent enterprise |
| `timezone` | `String` | Yes | IANA timezone ID |
| `address` | `Option<String>` | No | Street address |
| `city` | `Option<String>` | No | City name |
| `country` | `Option<String>` | No | Country |

#### Area (L2)

**ISA-95 Role:** Supervisory Control (SCADA scope)
**Container:** Yes (contains Plants, Lines)
**Parent:** Site (required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `AreaId` | Yes | ARA-{slug} format |
| `siteId` | `SiteId` | Yes | Parent site |
| `areaType` | `Option<AreaType>` | No | Area classification |
| `building` | `Option<String>` | No | Building name |
| `floor` | `Option<String>` | No | Floor/level |

#### Plant (L3 - Functional)

**ISA-95 Role:** Functional manufacturing unit
**Container:** Yes (contains Lines)
**Parent:** Area or Site (optional)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `PlantId` | Yes | PLT-{slug} format |
| `timezone` | `String` | Yes | IANA timezone ID |
| `siteCode` | `Option<String>` | No | ERP site code |

#### Line (L1 - Work Center)

**ISA-95 Role:** Work Center (production line)
**Container:** Yes (contains WorkCells, Machines)
**Parent:** Plant (required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `LineId` | Yes | LIN-{slug} format |
| `plantId` | `PlantId` | Yes | Parent plant |
| `capacity` | `Option<Number>` | No | Units/hour capacity |
| `operatingHoursPerDay` | `Option<Number>` | No | Operating hours (0-24) |

#### WorkCell (L1 - Work Unit)

**ISA-95 Role:** Work Unit (machine grouping)
**Container:** Yes (contains Machines)
**Parent:** Line (required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `WorkCellId` | Yes | WCL-{slug} format |
| `lineId` | `LineId` | Yes | Parent line |
| `cellType` | `Option<String>` | No | Cell classification |
| `cycleTimeSeconds` | `Option<Number>` | No | Cycle time (seconds) |
| `position` | `Option<Number>` | No | Sequence position |

#### Machine (L1 - Equipment)

**ISA-95 Role:** Equipment (discrete processing unit)
**Container:** Yes (contains Sensors, Devices)
**Parent:** Line (required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `MachineId` | Yes | MCH-{slug} format |
| `lineId` | `LineId` | Yes | Parent line |
| `machineType` | `String` | Yes | Machine type/category |
| `manufacturer` | `Option<String>` | No | Equipment manufacturer |
| `modelNumber` | `Option<String>` | No | Model number |
| `serialNumber` | `Option<String>` | No | Serial number |
| `installationDate` | `Option<DateTimeUtc>` | No | Installation date |
| `lastMaintenanceDate` | `Option<DateTimeUtc>` | No | Last maintenance |
| `nextMaintenanceDate` | `Option<DateTimeUtc>` | No | Scheduled maintenance |

#### Sensor (L0 - Control Module / Read)

**ISA-95 Role:** Control Module (instrumentation - reads values)
**Container:** No (leaf node)
**Parent:** Machine (required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `SensorId` | Yes | SNS-{slug} format |
| `machineId` | `MachineId` | Yes | Parent machine |
| `sensorType` | `SensorType` | Yes | Measurement type |
| `unit` | `MeasurementUnit` | Yes | Measurement unit |
| `sampleRateMs` | `Option<Number>` | No | Sample rate (ms) |
| `thresholdHigh` | `Option<Number>` | No | Warning high threshold |
| `thresholdCritical` | `Option<Number>` | No | Critical high threshold |
| `thresholdLow` | `Option<Number>` | No | Warning low threshold |
| `opcUaNodeId` | `Option<String>` | No | OPC-UA Node ID |

**SensorType:** `'temperature' | 'pressure' | 'vibration' | 'humidity' | 'flow' | 'level' | 'speed' | 'position' | 'current' | 'voltage' | 'power' | 'force' | 'torque' | 'weight' | 'ph' | 'conductivity' | 'other'`

**MeasurementUnit:** `'celsius' | 'fahrenheit' | 'kelvin' | 'psi' | 'bar' | 'pascal' | 'mm_s' | 'g' | 'l_min' | 'gpm' | 'meters' | 'feet' | 'percent' | 'rpm' | 'ampere' | 'volt' | 'watt' | 'newton' | 'nm' | 'kg' | 'count' | 'unitless'`

#### Device (L0 - Control Module / Write)

**ISA-95 Role:** Control Module (actuator - writes values)
**Container:** No (leaf node)
**Parent:** Machine (required)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `DeviceId` | Yes | DEV-{slug} format |
| `machineId` | `MachineId` | Yes | Parent machine |
| `deviceType` | `DeviceType` | Yes | Device classification |
| `controlMode` | `Option<ControlMode>` | No | Control authority |
| `ratedPower` | `Option<Number>` | No | Power capacity |
| `powerUnit` | `Option<PowerUnit>` | No | Power unit |
| `opcUaNodeId` | `Option<String>` | No | OPC-UA Node ID |

**DeviceType:** `'motor' | 'valve' | 'pump' | 'heater' | 'cooler' | 'conveyor' | 'actuator' | 'servo' | 'relay' | 'vfd' | 'solenoid' | 'gripper' | 'light' | 'alarm' | 'other'`

**ControlMode:** `'manual' | 'auto' | 'remote' | 'local'`

---

## 6. Implementation Roadmap

### 6.1 Phase 1: Core Types (3 days)

**Deliverables:**
- `src/lib/iiot/schemas/entity-contract.ts`
- `src/lib/iiot/schemas/automation-levels.ts`
- `src/lib/iiot/schemas/base-fields.ts`
- `src/lib/iiot/schemas/hierarchy-path.ts`
- Refactor `identifiers.ts` with all branded ID types

**Acceptance:**
- [ ] Types compile
- [ ] Interface documented
- [ ] HierarchyPath validation passes

### 6.2 Phase 2: Event System (5 days)

**Deliverables:**
- `src/lib/iiot/schemas/events/base.ts` — Three base event classes
- `src/lib/iiot/schemas/events/structural.ts` — All structural events
- `src/lib/iiot/schemas/events/operational.ts` — All operational events
- `src/lib/iiot/schemas/events/groups.ts` — EventGroup definitions

**Acceptance:**
- [ ] All event schemas validate
- [ ] Events emit to journal correctly
- [ ] Replay produces correct aggregate state

### 6.3 Phase 3: Storage Integration (4 days)

**Deliverables:**
- `IIoTSqlEventJournalLayer` configuration
- DDL for `iiot_event_journal` table (partitioned)
- DDL for TimescaleDB hypertables
- Continuous aggregate definitions

**Acceptance:**
- [ ] EventJournal tables created successfully
- [ ] Hypertables created with compression policies
- [ ] Layer composition compiles

### 6.4 Phase 4: Entity Implementation (5 days)

**Deliverables:**
- Individual entity files: `enterprise.ts`, `site.ts`, `area.ts`, `plant.ts`, `line.ts`, `workcell.ts`, `machine.ts`, `sensor.ts`, `device.ts`
- Update `index.ts` barrel exports
- Add tests for HierarchyPath parsing and validation

**Acceptance:**
- [ ] All entities implement EntityContract
- [ ] DDL generates correctly
- [ ] Unit tests pass

### 6.5 Phase 5: Cross-Store Queries (3 days)

**Deliverables:**
- `correlateAlarmWithReadings()` query
- `getRCASnapshot()` multi-domain query
- `calculateOEE()` hybrid query

**Acceptance:**
- [ ] RCA snapshot < 1s for single asset
- [ ] OEE calculation matches manual calculation
- [ ] Temporal queries < 100ms

---

## Appendix A: Type Definitions

```typescript
// Branded ID Types
export type EnterpriseId = string & { readonly _brand: 'EnterpriseId' }
export type SiteId = string & { readonly _brand: 'SiteId' }
export type AreaId = string & { readonly _brand: 'AreaId' }
export type PlantId = string & { readonly _brand: 'PlantId' }
export type LineId = string & { readonly _brand: 'LineId' }
export type WorkCellId = string & { readonly _brand: 'WorkCellId' }
export type MachineId = string & { readonly _brand: 'MachineId' }
export type SensorId = string & { readonly _brand: 'SensorId' }
export type DeviceId = string & { readonly _brand: 'DeviceId' }
export type AssetId = EnterpriseId | SiteId | AreaId | PlantId | LineId | WorkCellId | MachineId | SensorId | DeviceId

// Equipment Level
export type EquipmentLevel = 'enterprise' | 'site' | 'area' | 'plant' | 'line' | 'workcell' | 'machine' | 'sensor' | 'device'

// Automation Level
export type AutomationLevel = 0 | 1 | 2 | 3 | 4

// Asset Status
export type AssetStatus = 'active' | 'inactive' | 'maintenance' | 'decommissioned'

// Equipment State (ISA-88)
export type EquipmentState = 'running' | 'stopped' | 'idle' | 'changeover' | 'planned_downtime' | 'unplanned_downtime' | 'maintenance' | 'faulted'

// Error Types
export type HierarchyValidationCode = 'INVALID_ROOT' | 'INVALID_PARENT_CHILD' | 'DUPLICATE_ID' | 'ORPHAN_PATH' | 'CYCLE_DETECTED'

// Event Category
export type EventCategory = 'structural' | 'operational' | 'temporal'
```

---

## Appendix B: Schema Definitions

```typescript
// src/lib/iiot/schemas/identifiers.ts

import { Schema } from 'effect'

export const EnterpriseId = Schema.String.pipe(
  Schema.pattern(/^ENT-[a-zA-Z0-9-]+$/),
  Schema.brand('EnterpriseId'),
  Schema.annotations({ identifier: '@gbg/tmnl/iiot/EnterpriseId' })
)

export const SiteId = Schema.String.pipe(
  Schema.pattern(/^SIT-[a-zA-Z0-9-]+$/),
  Schema.brand('SiteId'),
  Schema.annotations({ identifier: '@gbg/tmnl/iiot/SiteId' })
)

// ... similar for other IDs

export const EquipmentLevel = Schema.Literal(
  'enterprise', 'site', 'area', 'plant', 'line', 'workcell', 'machine', 'sensor', 'device'
)

export const AssetStatus = Schema.Literal(
  'active', 'inactive', 'maintenance', 'decommissioned'
)

export const AssetLocation = Schema.Struct({
  latitude: Schema.optional(Schema.Number),
  longitude: Schema.optional(Schema.Number),
  altitude: Schema.optional(Schema.Number),
  building: Schema.optional(Schema.String),
  floor: Schema.optional(Schema.String),
  room: Schema.optional(Schema.String),
})

export const AssetMetadata = Schema.Record({ key: Schema.String, value: Schema.Unknown })
```

---

## Appendix C: DDL Templates

### EventLog Tables

```sql
-- iiot_event_journal: Main event storage (partitioned)
CREATE TABLE iiot.event_journal (
  sequence_num    BIGSERIAL,
  entity_type     VARCHAR(64) NOT NULL,
  primary_key     VARCHAR(255) NOT NULL,
  event_tag       VARCHAR(128) NOT NULL,
  payload         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  identity_id     UUID NOT NULL,
  
  PRIMARY KEY (entity_type, sequence_num)
) PARTITION BY LIST (entity_type);

CREATE TABLE iiot.event_journal_alarm PARTITION OF iiot.event_journal FOR VALUES IN ('alarm');
CREATE TABLE iiot.event_journal_work_order PARTITION OF iiot.event_journal FOR VALUES IN ('work_order');
CREATE TABLE iiot.event_journal_equipment PARTITION OF iiot.event_journal FOR VALUES IN ('equipment');
CREATE TABLE iiot.event_journal_task PARTITION OF iiot.event_journal FOR VALUES IN ('task');
CREATE TABLE iiot.event_journal_approval PARTITION OF iiot.event_journal FOR VALUES IN ('approval');

CREATE INDEX idx_event_journal_temporal ON iiot.event_journal (primary_key, created_at DESC);
CREATE INDEX idx_event_journal_tag ON iiot.event_journal (event_tag, created_at DESC);
CREATE INDEX idx_event_journal_payload_gin ON iiot.event_journal USING GIN (payload jsonb_path_ops);
```

### TimescaleDB Hypertables

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE iiot.sensor_readings (
  time            TIMESTAMPTZ NOT NULL,
  device_id       VARCHAR(128) NOT NULL,
  asset_id        VARCHAR(128),
  value           DOUBLE PRECISION NOT NULL,
  quality         SMALLINT NOT NULL DEFAULT 100,
  opc_ua_quality  VARCHAR(64),
  
  PRIMARY KEY (device_id, time)
);

SELECT create_hypertable('iiot.sensor_readings', by_range('time', INTERVAL '7 days'));

ALTER TABLE iiot.sensor_readings SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'device_id',
  timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('iiot.sensor_readings', INTERVAL '30 days');
SELECT add_retention_policy('iiot.sensor_readings', INTERVAL '2 years');
```

### Entity DDL Template

```sql
-- Template for {Entity} table
CREATE TABLE IF NOT EXISTS {table_name} (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'maintenance', 'decommissioned')),
  description TEXT,
  location JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  hierarchy_path TEXT NOT NULL,
  -- Parent references (entity-specific)
  {parent_field} TEXT REFERENCES {parent_table}(id),
  -- Entity-specific fields
  {specific_fields}
);

CREATE INDEX IF NOT EXISTS idx_{table_name}_hierarchy ON {table_name} USING GIST (hierarchy_path gist_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_{table_name}_status ON {table_name}(status);
CREATE INDEX IF NOT EXISTS idx_{table_name}_parent ON {table_name}({parent_field});
```

---

## References

- **ISA-95 (IEC 62264)** — Equipment Hierarchy Standard
- **ISA-88** — Equipment State Model
- **ISA-18.2** — Alarm Management Standard
- **FDA 21 CFR Part 11** — Electronic Records; Electronic Signatures
- **ISO 22400** — Key Performance Indicators for Manufacturing Operations
- **@effect/experimental/EventLog** — Core event sourcing API
- **@effect/sql/SqlEventJournal** — SQL persistence backend
- **TimescaleDB** — Time-series extension for PostgreSQL

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-01-30 | 1.0.0 | Unified specification created from 01-05 source specs |
