---
title: "Entity System Specification"
date: 2026-01-30
status: Active
version: "1.0.0"
source: thoughts/shared/specs/entity-system/00-unified-entity-system-spec.md (consolidated from 01-05)
---

# Entity System Specification

Consolidated from 6 source files in `thoughts/shared/specs/entity-system/`.

## 1. Entity Base Architecture

### Naming Conventions

All Effect Schema `TaggedClass` definitions use the `Schema` postfix:

| Artifact | Pattern | Example |
|----------|---------|---------|
| Schema (TaggedClass) | `{Entity}Schema` | `EnterpriseSchema` |
| Model (Persistence) | `{Entity}Model` | `EnterpriseModel` |
| DDL (SQL) | `{Entity}DDL` | `EnterpriseDDL` |
| Type (Inferred) | `{Entity}` | `Enterprise` |

### BaseAssetFields

Common fields spread into all equipment TaggedClasses:

```typescript
export const BaseAssetFields = {
  name: Schema.NonEmptyString,
  status: AssetStatus,
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  location: Schema.optionalWith(AssetLocation, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { default: () => ({}) }),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  hierarchyPath: HierarchyPath,
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  siteId: Schema.optionalWith(SiteId, { as: 'Option' }),
  // ... parent IDs up the hierarchy
} as const
```

### Validation Layers

| Layer | Mechanism | Validates | Failure Mode |
|-------|-----------|-----------|--------------|
| Compile-time | TypeScript types | Field presence, basic types | Red squiggles |
| Schema.decode | Effect Schema filters | Path consistency, business rules | `ParseError` |
| DDL | Foreign key constraints | Referential integrity | DB error |

## 2. Hierarchy Path System

`HierarchyPath` is a typed data structure representing ISA-95 equipment ancestry.

### Properties

- Immutable after construction
- O(1) depth comparison
- O(d) traversal operations where d = depth
- Runtime-validated ISA-95 hierarchy rules

### Schema

```typescript
export class PathSegment extends Schema.TaggedClass<PathSegment>()('PathSegment', {
  level: EquipmentLevel,
  id: AssetId,
  name: Schema.optional(Schema.NonEmptyString),
}) {}

export class HierarchyPath extends Schema.TaggedClass<HierarchyPath>()('HierarchyPath', {
  segments: Schema.Array(PathSegment),
  materialized: Schema.String,
  depth: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
}) {
  get root(): PathSegment | undefined
  get leaf(): PathSegment | undefined
  getParent(): HierarchyPath | null
  isAncestorOf(other: HierarchyPath): boolean
  canHaveChild(childLevel: EquipmentLevel): boolean
  append(segment: PathSegment): Effect<HierarchyPath, HierarchyValidationError>
}
```

### Algorithmic Complexity

| Operation | Complexity |
|-----------|------------|
| `root`, `leaf`, `isEmpty` | O(1) |
| `depth` comparison | O(1) |
| `getParent()` | O(d) |
| `getAncestors()` | O(d^2) |
| `isAncestorOf()` | O(min(d1,d2)) |
| `validate()` | O(d) |
| `append()` | O(d) |

### Validation Rules

1. **Root must be Enterprise** -- paths must start with an Enterprise segment
2. **Valid parent-child** -- each segment must be a valid child of the previous (see [ISA-95 Reference](../references/isa95-hierarchy.md))
3. **No duplicate IDs** -- each segment ID must be unique within the path

## 3. Event Type Hierarchy

Three **divergent** event bases -- they do NOT inherit from a common root because their storage semantics differ fundamentally.

| Category | Storage | Query Pattern | Retention |
|----------|---------|---------------|-----------|
| **Structural** | EventLog (JSONB) | Replay from origin | Indefinite |
| **Operational** | EventLog (JSONB) | Replay + time-travel | Indefinite |
| **Temporal** | TimescaleDB (columnar) | Time-bucketed aggregation | Tiered |

### Base Event Classes

- **BaseStructuralEvent** -- entity lifecycle and configuration changes. Includes `hierarchyPath` for cascade operations.
- **BaseOperationalEvent** -- runtime business events (state changes, alarms). No `hierarchyPath` (operational events reference a single entity).
- **BaseTemporalEvent** -- high-frequency measurements. Stored in TimescaleDB, not EventLog. Includes `bucketTime` for aggregate joins.

### Event Routing Decision Tree

```
Is this event a measurement/metric?
  YES -> TimescaleDB (BaseTemporalEvent)
  NO  -> EventLog
         Does it change entity structure/config?
           YES -> BaseStructuralEvent (include hierarchyPath)
           NO  -> BaseOperationalEvent (no hierarchyPath)
```

## 4. Storage Architecture

### Dual Store Design

```
ENTITY (e.g., MCH-001)
  +-- EVENT STORE (@effect/experimental)
  |     SqlEventJournal: iiot_event_journal
  |     Domain Events: EquipmentStateChanged, AlarmTriggered, WorkOrderCreated
  |
  +-- TEMPORAL STORE (TimescaleDB)
        Hypertables: iiot.sensor_readings
        Continuous Aggregates: readings_1min, readings_1hour
        Time-Series: sensor values, metrics

entityId = Universal Join Key (cross-store correlation)
```

### EventLog Configuration

```typescript
export const IIoTSqlEventJournalLayer = SqlEventJournal.layer({
  eventLogTable: 'iiot_event_journal',
  remotesTable: 'iiot_event_remotes',
})
```

### Retention Policies

**EventLog:**

| Domain | Hot Retention | Cold Archive |
|--------|:---:|:---:|
| Alarms | 90 days | 7 years (ISA-18.2) |
| Work Orders | 180 days | 10 years (FDA Part 11) |
| Equipment State | 30 days | 2 years |

**TimescaleDB:**

| Table | Compression After | Drop After |
|-------|:---------:|:--------:|
| sensor_readings | 30 days | 2 years |
| readings_1min | 90 days | 1 year |
| readings_1hour | N/A | 5 years |
| readings_1day | N/A | Forever |

### Cross-Store Query Patterns

1. **Entity History** -- EventLog only (replay domain events)
2. **Time-Series Aggregation** -- TimescaleDB only (continuous aggregates)
3. **Alarm-Reading Correlation** -- Get alarm from EventLog, query surrounding readings from TimescaleDB
4. **OEE Calculation** -- State events from EventLog + production metrics from TimescaleDB

## 5. Entity Catalog

### ID Patterns

All IDs follow `{PREFIX}-{slug}` format:

| Entity | Prefix | Regex | Factory |
|--------|:------:|-------|---------|
| Enterprise | ENT- | `^ENT-[a-zA-Z0-9-]+$` | `makeEnterpriseId(slug)` |
| Site | SIT- | `^SIT-[a-zA-Z0-9-]+$` | `makeSiteId(slug)` |
| Area | ARA- | `^ARA-[a-zA-Z0-9-]+$` | `makeAreaId(slug)` |
| Plant | PLT- | `^PLT-[a-zA-Z0-9-]+$` | `makePlantId(slug)` |
| Line | LIN- | `^LIN-[a-zA-Z0-9-]+$` | `makeLineId(slug)` |
| WorkCell | WCL- | `^WCL-[a-zA-Z0-9-]+$` | `makeWorkCellId(slug)` |
| Machine | MCH- | `^MCH-[a-zA-Z0-9-]+$` | `makeMachineId(slug)` |
| Sensor | SNS- | `^SNS-[a-zA-Z0-9-]+$` | `makeSensorId(slug)` |
| Device | DEV- | `^DEV-[a-zA-Z0-9-]+$` | `makeDeviceId(slug)` |

### Entity-Specific Fields

**Enterprise (L4):** `industry`, `legalName`, `taxId`, `headquarters`

**Site (L3):** `enterpriseId` (required), `timezone` (required), `address`, `city`, `country`

**Area (L2):** `siteId` (required), `areaType`, `building`, `floor`

**Plant (L3):** `timezone` (required), `siteCode`

**Line (L1):** `plantId` (required), `capacity`, `operatingHoursPerDay`

**WorkCell (L1):** `lineId` (required), `cellType`, `cycleTimeSeconds`, `position`

**Machine (L1):** `lineId` (required), `machineType` (required), `manufacturer`, `modelNumber`, `serialNumber`, `installationDate`, `lastMaintenanceDate`, `nextMaintenanceDate`

**Sensor (L0):** `machineId` (required), `sensorType` (required), `unit` (required), `sampleRateMs`, `thresholdHigh`, `thresholdCritical`, `thresholdLow`, `opcUaNodeId`

**Device (L0):** `machineId` (required), `deviceType` (required), `controlMode`, `ratedPower`, `powerUnit`, `opcUaNodeId`

## 6. Type Definitions

```typescript
type EquipmentLevel = 'enterprise' | 'site' | 'area' | 'plant' | 'line'
                    | 'workcell' | 'machine' | 'sensor' | 'device'

type AssetStatus = 'active' | 'inactive' | 'maintenance' | 'decommissioned'

type EquipmentState = 'running' | 'stopped' | 'idle' | 'changeover'
                    | 'planned_downtime' | 'unplanned_downtime' | 'maintenance' | 'faulted'

type EventCategory = 'structural' | 'operational' | 'temporal'

type HierarchyValidationCode = 'INVALID_ROOT' | 'INVALID_PARENT_CHILD'
                             | 'DUPLICATE_ID' | 'ORPHAN_PATH' | 'CYCLE_DETECTED'
```

## Related Documents

- [ADR-004: Entity System Architecture](../decisions/adr-004-entity-system-architecture.md)
- [ISA-95 Equipment Hierarchy](../references/isa95-hierarchy.md)
- [IIoT Invariants Analysis](iiot-invariants.md)
- [V3 Architecture Specification](v3-architecture.md)
- Source: `thoughts/shared/specs/entity-system/` (6 files: 00-unified through 05-entity-catalog)
