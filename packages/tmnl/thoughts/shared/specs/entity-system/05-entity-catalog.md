# ISA-95 Entity Catalog

**Status:** REFERENCE SPECIFICATION
**Date:** 2026-01-30
**Scope:** Complete catalog of all 10 ISA-95 entity types
**Source:** `src/lib/iiot/schemas/assets/`

---

## Overview

This document catalogs all ISA-95 entity types in the TMNL IIoT domain model. Each entity follows the ISA-95/IEC 62264 equipment hierarchy standard and is implemented as an Effect Schema `TaggedClass`.

**Entity Count:** 10 entities across 5 ISA-95 levels

```
ISA-95 Automation Pyramid
═════════════════════════════════════════════════════════════════════

    L4  ┌─────────────────────────────────────────────────────────┐
        │                      ENTERPRISE                         │  Business Planning
        │                     (ENT-*)                              │  ERP/BI Scope
        └─────────────────────────────────────────────────────────┘
                                   │
    L3  ┌─────────────────────────────────────────────────────────┐
        │                        SITE                              │  Geographic/MES
        │                      (SIT-*)                             │
        │  ┌─────────────────────────────────────────────────┐    │
        │  │                      PLANT                       │    │  Functional Unit
        │  │                    (PLT-*)                        │    │
        │  └─────────────────────────────────────────────────┘    │
        └─────────────────────────────────────────────────────────┘
                                   │
    L2  ┌─────────────────────────────────────────────────────────┐
        │                        AREA                              │  Supervisory/SCADA
        │                      (ARA-*)                             │
        └─────────────────────────────────────────────────────────┘
                                   │
    L1  ┌─────────────────────────────────────────────────────────┐
        │              LINE (LIN-*) → WORKCELL (WCL-*)             │  Work Center/Unit
        │                           ↓                              │  PLC/DCS
        │                    MACHINE (MCH-*)                       │
        └─────────────────────────────────────────────────────────┘
                                   │
    L0  ┌─────────────────────────────────────────────────────────┐
        │          SENSOR (SNS-*)  |  DEVICE (DEV-*)               │  Control Module
        │             (reads)      |    (writes)                   │  Physical Process
        └─────────────────────────────────────────────────────────┘
```

---

## Entity Summary Table

| Entity | Prefix | Level | ISA-95 Role | Container? | Parent Type(s) |
|--------|--------|-------|-------------|------------|----------------|
| Enterprise | ENT- | L4 | Business Planning | Yes | None (root) |
| Site | SIT- | L3 | Geographic Location | Yes | Enterprise |
| Area | ARA- | L2 | Supervisory Control | Yes | Site |
| Plant | PLT- | L3* | Functional Unit | Yes | Area, Site |
| Line | LIN- | L1 | Work Center | Yes | Plant |
| WorkCell | WCL- | L1 | Work Unit | Yes | Line |
| Machine | MCH- | L1 | Equipment | Yes | WorkCell, Line |
| Sensor | SNS- | L0 | Control Module (read) | No | Machine |
| Device | DEV- | L0 | Control Module (write) | No | Machine |

*Plant is L3 functional but can be nested under L2 Area for organizational flexibility.

---

## ID Pattern Reference

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

---

## Parent Constraint Matrix

This matrix defines valid parent-child relationships. Violations should trigger validation errors.

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

### Validation Rules

| Entity | Parent Field | Required? | Constraint |
|--------|--------------|-----------|------------|
| Enterprise | — | N/A | Root entity, no parent |
| Site | `enterpriseId` | Yes | Must be valid EnterpriseId |
| Area | `siteId` | Yes | Must be valid SiteId |
| Plant | — | No | Can be standalone or under Area/Site |
| Line | `plantId` | Yes | Must be valid PlantId |
| WorkCell | `lineId` | Yes | Must be valid LineId |
| Machine | `lineId` | Yes | Must be valid LineId (or WorkCellId via line) |
| Sensor | `machineId` | Yes | Must be valid MachineId |
| Device | `machineId` | Yes | Must be valid MachineId |

---

## Shared Fields (BaseAssetFields)

All entities inherit these common fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `NonEmptyString` | Yes | Human-readable name |
| `status` | `AssetStatus` | Yes | Operational status |
| `description` | `Option<String>` | No | Free-form description |
| `createdAt` | `DateTimeUtc` | Yes | Creation timestamp |
| `updatedAt` | `Option<DateTimeUtc>` | No | Last update timestamp |
| `metadata` | `Record<string, unknown>` | No | Extensible JSONB |

### AssetStatus Enum

```typescript
type AssetStatus = 'active' | 'inactive' | 'maintenance' | 'decommissioned'
```

---

## Entity Specifications

### 1. Enterprise (L4)

**File:** `src/lib/iiot/schemas/assets/enterprise/schema.ts`
**ISA-95 Role:** Business Planning (ERP/BI scope)
**Container:** Yes (contains Sites)

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `EnterpriseId` | Yes | ENT-{slug} format |
| `name` | `NonEmptyString` | Yes | Enterprise name |
| `status` | `AssetStatus` | Yes | Operational status |
| `industry` | `Option<String>` | No | Industry sector |
| `legalName` | `Option<String>` | No | Legal entity name |
| `taxId` | `Option<String>` | No | Tax identification |
| `headquarters` | `Option<String>` | No | HQ location/address |
| `description` | `Option<String>` | No | Description |
| `createdAt` | `DateTimeUtc` | Yes | Created timestamp |
| `updatedAt` | `Option<DateTimeUtc>` | No | Updated timestamp |
| `metadata` | `AssetMetadata` | No | Extensible metadata |

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getAutomationLevel()` | `() => 4` | Returns ISA-95 Level 4 |
| `isOperational()` | `() => boolean` | True if active or inactive |
| `isContainer()` | `() => true` | Always true |

#### Example

```typescript
import { DateTime, Option } from 'effect'
import { Enterprise, makeEnterpriseId } from './enterprise/schema'

const enterprise = new Enterprise({
  id: makeEnterpriseId('acme-corp'),
  name: 'ACME Corporation',
  status: 'active',
  industry: Option.some('manufacturing'),
  legalName: Option.some('ACME Corporation LLC'),
  taxId: Option.some('12-3456789'),
  headquarters: Option.some('Chicago, IL'),
  description: Option.some('Global manufacturing leader'),
  createdAt: DateTime.unsafeNow(),
  updatedAt: Option.none(),
  metadata: {},
})
```

---

### 2. Site (L3 - Geographic)

**File:** `src/lib/iiot/schemas/assets/site/schema.ts`
**ISA-95 Role:** Geographic location (MES scope)
**Container:** Yes (contains Areas, Plants)
**Parent:** Enterprise (required)

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `SiteId` | Yes | SIT-{slug} format |
| `name` | `NonEmptyString` | Yes | Site name |
| `status` | `AssetStatus` | Yes | Operational status |
| `enterpriseId` | `EnterpriseId` | Yes | Parent enterprise |
| `address` | `Option<String>` | No | Street address |
| `city` | `Option<String>` | No | City name |
| `state` | `Option<String>` | No | State/province |
| `country` | `Option<String>` | No | Country |
| `postalCode` | `Option<String>` | No | Postal/ZIP code |
| `timezone` | `String` | Yes | IANA timezone ID |
| `location` | `Option<AssetLocation>` | No | GPS coordinates |
| `description` | `Option<String>` | No | Description |
| `createdAt` | `DateTimeUtc` | Yes | Created timestamp |
| `updatedAt` | `Option<DateTimeUtc>` | No | Updated timestamp |
| `metadata` | `AssetMetadata` | No | Extensible metadata |

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getAutomationLevel()` | `() => 3` | Returns ISA-95 Level 3 |
| `isOperational()` | `() => boolean` | True if active or inactive |
| `isContainer()` | `() => true` | Always true |

#### Example

```typescript
const site = new Site({
  id: makeSiteId('chicago-main'),
  name: 'Chicago Main Site',
  status: 'active',
  enterpriseId: makeEnterpriseId('acme-corp'),
  address: Option.some('123 Industrial Pkwy'),
  city: Option.some('Chicago'),
  state: Option.some('IL'),
  country: Option.some('USA'),
  postalCode: Option.some('60601'),
  timezone: 'America/Chicago',
  location: Option.none(),
  description: Option.some('Primary manufacturing site'),
  createdAt: DateTime.unsafeNow(),
  updatedAt: Option.none(),
  metadata: {},
})
```

---

### 3. Area (L2)

**File:** `src/lib/iiot/schemas/assets/area/schema.ts`
**ISA-95 Role:** Supervisory Control (SCADA scope)
**Container:** Yes (contains Plants, Lines)
**Parent:** Site (required)

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `AreaId` | Yes | ARA-{slug} format |
| `name` | `NonEmptyString` | Yes | Area name |
| `status` | `AssetStatus` | Yes | Operational status |
| `siteId` | `SiteId` | Yes | Parent site |
| `areaType` | `Option<AreaType>` | No | Area classification |
| `building` | `Option<String>` | No | Building name |
| `floor` | `Option<String>` | No | Floor/level |
| `zone` | `Option<String>` | No | Zone designation |
| `description` | `Option<String>` | No | Description |
| `createdAt` | `DateTimeUtc` | Yes | Created timestamp |
| `updatedAt` | `Option<DateTimeUtc>` | No | Updated timestamp |
| `metadata` | `AssetMetadata` | No | Extensible metadata |

#### AreaType Enum

```typescript
type AreaType = 'production' | 'warehouse' | 'maintenance' | 'quality' | 'shipping' | 'receiving'
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getAutomationLevel()` | `() => 2` | Returns ISA-95 Level 2 |
| `isOperational()` | `() => boolean` | True if not maintenance/decommissioned |
| `isContainer()` | `() => true` | Always true |

#### Example

```typescript
const area = new Area({
  id: makeAreaId('production-1'),
  name: 'Production Area 1',
  status: 'active',
  siteId: makeSiteId('chicago-main'),
  areaType: Option.some('production'),
  building: Option.some('Building A'),
  floor: Option.some('Ground'),
  zone: Option.some('Zone 1'),
  description: Option.some('Main production area'),
  createdAt: DateTime.unsafeNow(),
  updatedAt: Option.none(),
  metadata: {},
})
```

---

### 4. Plant (L3 - Functional)

**File:** `src/lib/iiot/schemas/assets/plant/schema.ts`
**ISA-95 Role:** Functional manufacturing unit
**Container:** Yes (contains Lines)
**Parent:** Area or Site (optional in current impl)

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `PlantId` | Yes | PLT-{slug} format |
| `name` | `NonEmptyString` | Yes | Plant name |
| `status` | `AssetStatus` | Yes | Operational status |
| `timezone` | `String` | Yes | IANA timezone ID |
| `siteCode` | `Option<String>` | No | ERP site code |
| `description` | `Option<String>` | No | Description |
| `location` | `Option<AssetLocation>` | No | Physical location |
| `createdAt` | `DateTimeUtc` | Yes | Created timestamp |
| `updatedAt` | `Option<DateTimeUtc>` | No | Updated timestamp |
| `metadata` | `AssetMetadata` | No | Extensible metadata |

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getAutomationLevel()` | `() => 3` | Returns ISA-95 Level 3 |
| `isOperational()` | `() => boolean` | True if active or inactive |
| `isContainer()` | `() => true` | Always true |

#### Example

```typescript
const plant = new Plant({
  id: makePlantId('chicago-assembly'),
  name: 'Chicago Assembly Plant',
  status: 'active',
  timezone: 'America/Chicago',
  siteCode: Option.some('CHI-01'),
  description: Option.some('Main assembly facility'),
  location: Option.none(),
  createdAt: DateTime.unsafeNow(),
  updatedAt: Option.none(),
  metadata: {},
})
```

---

### 5. Line (L1 - Work Center)

**File:** `src/lib/iiot/schemas/assets/line/schema.ts`
**ISA-95 Role:** Work Center (production line)
**Container:** Yes (contains WorkCells, Machines)
**Parent:** Plant (required)

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `LineId` | Yes | LIN-{slug} format |
| `name` | `NonEmptyString` | Yes | Line name |
| `status` | `AssetStatus` | Yes | Operational status |
| `plantId` | `PlantId` | Yes | Parent plant |
| `capacity` | `Option<Number>` | No | Units/hour capacity |
| `lineType` | `Option<String>` | No | Line classification |
| `operatingHoursPerDay` | `Option<Number>` | No | Operating hours (0-24) |
| `description` | `Option<String>` | No | Description |
| `createdAt` | `DateTimeUtc` | Yes | Created timestamp |
| `updatedAt` | `Option<DateTimeUtc>` | No | Updated timestamp |
| `metadata` | `AssetMetadata` | No | Extensible metadata |

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getAutomationLevel()` | `() => 1` | Returns ISA-95 Level 1 |
| `isOperational()` | `() => boolean` | True if not maintenance/decommissioned |
| `isContainer()` | `() => true` | Always true |

#### Example

```typescript
const line = new Line({
  id: makeLineId('assembly-01'),
  name: 'Assembly Line 1',
  status: 'active',
  plantId: makePlantId('chicago-assembly'),
  capacity: Option.some(500),
  lineType: Option.some('assembly'),
  operatingHoursPerDay: Option.some(16),
  description: Option.some('Primary assembly line'),
  createdAt: DateTime.unsafeNow(),
  updatedAt: Option.none(),
  metadata: {},
})
```

---

### 6. WorkCell (L1 - Work Unit)

**File:** `src/lib/iiot/schemas/assets/workcell/schema.ts`
**ISA-95 Role:** Work Unit (machine grouping)
**Container:** Yes (contains Machines)
**Parent:** Line (required)

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `WorkCellId` | Yes | WCL-{slug} format |
| `name` | `NonEmptyString` | Yes | WorkCell name |
| `status` | `AssetStatus` | Yes | Operational status |
| `lineId` | `LineId` | Yes | Parent line |
| `cellType` | `Option<String>` | No | Cell classification |
| `cycleTimeSeconds` | `Option<Number>` | No | Cycle time (seconds) |
| `position` | `Option<Number>` | No | Sequence position (0-indexed) |
| `description` | `Option<String>` | No | Description |
| `createdAt` | `DateTimeUtc` | Yes | Created timestamp |
| `updatedAt` | `Option<DateTimeUtc>` | No | Updated timestamp |
| `metadata` | `AssetMetadata` | No | Extensible metadata |

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getAutomationLevel()` | `() => 1` | Returns ISA-95 Level 1 |
| `isOperational()` | `() => boolean` | True if not maintenance/decommissioned |
| `isContainer()` | `() => true` | Always true |

#### Example

```typescript
const workCell = new WorkCell({
  id: makeWorkCellId('welding-01'),
  name: 'Welding Station 1',
  status: 'active',
  lineId: makeLineId('assembly-01'),
  cellType: Option.some('welding'),
  cycleTimeSeconds: Option.some(45),
  position: Option.some(3),
  description: Option.some('Primary welding station'),
  createdAt: DateTime.unsafeNow(),
  updatedAt: Option.none(),
  metadata: {},
})
```

---

### 7. Machine (L1 - Equipment)

**File:** `src/lib/iiot/schemas/assets/machine/schema.ts`
**ISA-95 Role:** Equipment (discrete processing unit)
**Container:** Yes (contains Sensors, Devices)
**Parent:** Line (required, or WorkCell via line)

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `MachineId` | Yes | MCH-{slug} format |
| `name` | `NonEmptyString` | Yes | Machine name |
| `status` | `AssetStatus` | Yes | Operational status |
| `lineId` | `LineId` | Yes | Parent line |
| `machineType` | `String` | Yes | Machine type/category |
| `manufacturer` | `Option<String>` | No | Equipment manufacturer |
| `modelNumber` | `Option<String>` | No | Model number |
| `serialNumber` | `Option<String>` | No | Serial number |
| `installationDate` | `Option<DateTimeUtc>` | No | Installation date |
| `lastMaintenanceDate` | `Option<DateTimeUtc>` | No | Last maintenance |
| `nextMaintenanceDate` | `Option<DateTimeUtc>` | No | Scheduled maintenance |
| `description` | `Option<String>` | No | Description |
| `createdAt` | `DateTimeUtc` | Yes | Created timestamp |
| `updatedAt` | `Option<DateTimeUtc>` | No | Updated timestamp |
| `metadata` | `AssetMetadata` | No | Extensible metadata |

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getAutomationLevel()` | `() => 1` | Returns ISA-95 Level 1 |
| `isOperational()` | `() => boolean` | True if not maintenance/decommissioned |
| `isContainer()` | `() => true` | Always true |
| `isMaintenanceOverdue(now?)` | `(Date?) => boolean` | True if past scheduled date |

#### Example

```typescript
const machine = new Machine({
  id: makeMachineId('cnc-lathe-001'),
  name: 'CNC Lathe Alpha',
  status: 'active',
  lineId: makeLineId('machining-01'),
  machineType: 'CNC Lathe',
  manufacturer: Option.some('Haas'),
  modelNumber: Option.some('ST-10'),
  serialNumber: Option.some('HST10-12345'),
  installationDate: Option.some(DateTime.unsafeFromDate(new Date('2024-01-15'))),
  lastMaintenanceDate: Option.none(),
  nextMaintenanceDate: Option.some(DateTime.unsafeFromDate(new Date('2026-07-15'))),
  description: Option.some('Primary CNC lathe for precision parts'),
  createdAt: DateTime.unsafeNow(),
  updatedAt: Option.none(),
  metadata: {},
})
```

---

### 8. Sensor (L0 - Control Module / Read)

**File:** `src/lib/iiot/schemas/assets/sensor/schema.ts`
**ISA-95 Role:** Control Module (instrumentation - reads values)
**Container:** No (leaf node)
**Parent:** Machine (required)

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `SensorId` | Yes | SNS-{slug} format |
| `name` | `NonEmptyString` | Yes | Sensor name |
| `status` | `AssetStatus` | Yes | Operational status |
| `machineId` | `MachineId` | Yes | Parent machine |
| `sensorType` | `SensorType` | Yes | Measurement type |
| `unit` | `MeasurementUnit` | Yes | Measurement unit |
| `sampleRateMs` | `Option<Number>` | No | Sample rate (ms) |
| `thresholdHigh` | `Option<Number>` | No | Warning high threshold |
| `thresholdCritical` | `Option<Number>` | No | Critical high threshold |
| `thresholdLow` | `Option<Number>` | No | Warning low threshold |
| `thresholdCriticalLow` | `Option<Number>` | No | Critical low threshold |
| `lastCalibrationDate` | `Option<DateTimeUtc>` | No | Last calibration |
| `nextCalibrationDate` | `Option<DateTimeUtc>` | No | Next calibration |
| `opcUaNodeId` | `Option<String>` | No | OPC-UA Node ID |
| `description` | `Option<String>` | No | Description |
| `createdAt` | `DateTimeUtc` | Yes | Created timestamp |
| `updatedAt` | `Option<DateTimeUtc>` | No | Updated timestamp |
| `metadata` | `AssetMetadata` | No | Extensible metadata |

#### SensorType Enum

```typescript
type SensorType = 'temperature' | 'pressure' | 'vibration' | 'humidity' | 'flow' |
                  'level' | 'speed' | 'position' | 'current' | 'voltage' |
                  'power' | 'force' | 'torque' | 'weight' | 'ph' |
                  'conductivity' | 'other'
```

#### MeasurementUnit Enum

```typescript
type MeasurementUnit = 
  // Temperature
  'celsius' | 'fahrenheit' | 'kelvin' |
  // Pressure
  'psi' | 'bar' | 'pascal' | 'kpa' |
  // Vibration
  'mm_s' | 'in_s' | 'g' |
  // Flow
  'l_min' | 'gpm' | 'm3_h' |
  // Level/Distance
  'meters' | 'feet' | 'mm' | 'inches' |
  // General
  'percent' | 'rpm' | 'ampere' | 'volt' | 'watt' |
  'newton' | 'nm' | 'kg' | 'count' | 'unitless'
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getAutomationLevel()` | `() => 0` | Returns ISA-95 Level 0 |
| `isOperational()` | `() => boolean` | True only if status === 'active' |
| `isContainer()` | `() => false` | Always false (leaf node) |
| `checkThresholds(value)` | `(number) => ThresholdStatus` | Returns 'normal'/'warning'/'critical' |
| `isCalibrationOverdue(now?)` | `(Date?) => boolean` | True if past scheduled date |

#### Example

```typescript
const sensor = new Sensor({
  id: makeSensorId('temp-motor-01'),
  name: 'Motor Temperature Sensor',
  status: 'active',
  machineId: makeMachineId('cnc-lathe-001'),
  sensorType: 'temperature',
  unit: 'celsius',
  sampleRateMs: Option.some(1000),
  thresholdHigh: Option.some(85),
  thresholdCritical: Option.some(95),
  thresholdLow: Option.some(10),
  thresholdCriticalLow: Option.some(0),
  lastCalibrationDate: Option.none(),
  nextCalibrationDate: Option.some(DateTime.unsafeFromDate(new Date('2026-06-01'))),
  opcUaNodeId: Option.some('ns=2;s=CNC.Motor.Temperature'),
  description: Option.some('Monitors motor housing temperature'),
  createdAt: DateTime.unsafeNow(),
  updatedAt: Option.none(),
  metadata: {},
})
```

---

### 9. Device (L0 - Control Module / Write)

**File:** `src/lib/iiot/schemas/assets/device/schema.ts`
**ISA-95 Role:** Control Module (actuator - writes values)
**Container:** No (leaf node)
**Parent:** Machine (required)

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `DeviceId` | Yes | DEV-{slug} format |
| `name` | `NonEmptyString` | Yes | Device name |
| `status` | `AssetStatus` | Yes | Operational status |
| `machineId` | `MachineId` | Yes | Parent machine |
| `deviceType` | `DeviceType` | Yes | Device classification |
| `controlMode` | `Option<ControlMode>` | No | Control authority |
| `ratedPower` | `Option<Number>` | No | Power capacity |
| `powerUnit` | `Option<PowerUnit>` | No | Power unit |
| `lastCommandAt` | `Option<DateTimeUtc>` | No | Last command timestamp |
| `opcUaNodeId` | `Option<String>` | No | OPC-UA Node ID |
| `description` | `Option<String>` | No | Description |
| `createdAt` | `DateTimeUtc` | Yes | Created timestamp |
| `updatedAt` | `Option<DateTimeUtc>` | No | Updated timestamp |
| `metadata` | `AssetMetadata` | No | Extensible metadata |

#### DeviceType Enum

```typescript
type DeviceType = 'motor' | 'valve' | 'pump' | 'heater' | 'cooler' |
                  'conveyor' | 'actuator' | 'servo' | 'relay' | 'vfd' |
                  'solenoid' | 'gripper' | 'light' | 'alarm' | 'other'
```

#### ControlMode Enum

```typescript
type ControlMode = 'manual' | 'auto' | 'remote' | 'local'
```

#### PowerUnit Enum

```typescript
type PowerUnit = 'watts' | 'kilowatts' | 'horsepower'
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getAutomationLevel()` | `() => 0` | Returns ISA-95 Level 0 |
| `isOperational()` | `() => boolean` | True only if status === 'active' |
| `isContainer()` | `() => false` | Always false (leaf node) |
| `isActuator()` | `() => true` | Always true (distinguishes from Sensor) |

#### Example

```typescript
const device = new Device({
  id: makeDeviceId('spindle-motor-01'),
  name: 'Main Spindle Motor',
  status: 'active',
  machineId: makeMachineId('cnc-lathe-001'),
  deviceType: 'motor',
  controlMode: Option.some('auto'),
  ratedPower: Option.some(7500),
  powerUnit: Option.some('watts'),
  lastCommandAt: Option.none(),
  opcUaNodeId: Option.some('ns=2;s=CNC.SpindleMotor'),
  description: Option.some('Main spindle drive motor'),
  createdAt: DateTime.unsafeNow(),
  updatedAt: Option.none(),
  metadata: {},
})
```

---

## Factory Function Signatures

All factory functions follow the pattern:

```typescript
// Pattern: make{Entity}Id(slug: string) => {Entity}Id
const makeEnterpriseId: (slug: string) => EnterpriseId
const makeSiteId: (slug: string) => SiteId
const makeAreaId: (slug: string) => AreaId
const makePlantId: (slug: string) => PlantId
const makeLineId: (slug: string) => LineId
const makeWorkCellId: (slug: string) => WorkCellId
const makeMachineId: (slug: string) => MachineId
const makeSensorId: (slug: string) => SensorId
const makeDeviceId: (slug: string) => DeviceId
```

**Implementation Pattern:**

```typescript
export const make{Entity}Id = (slug: string): {Entity}Id => 
  `{PREFIX}-${slug}` as {Entity}Id
```

---

## CreateParams Schemas

Each entity has a corresponding `Create{Entity}Params` schema for command handlers:

| Entity | Params Schema | Key Differences from Entity |
|--------|---------------|----------------------------|
| Enterprise | `CreateEnterpriseParams` | Takes `slug` instead of `id` |
| Site | `CreateSiteParams` | Takes `slug`, requires `enterpriseId`, `timezone` |
| Area | `CreateAreaParams` | Takes `slug`, requires `siteId` |
| Plant | `CreatePlantParams` | Takes `slug`, requires `timezone` |
| Line | `CreateLineParams` | Takes `slug`, requires `plantId` |
| WorkCell | `CreateWorkCellParams` | Takes `slug`, requires `lineId` |
| Machine | `CreateMachineParams` | Takes `slug`, requires `lineId`, `machineType` |
| Sensor | `CreateSensorParams` | Takes `slug`, requires `machineId`, `sensorType`, `unit` |
| Device | `CreateDeviceParams` | Takes `slug`, requires `machineId`, `deviceType` |

---

## Import Paths

```typescript
// Individual entities
import { Enterprise, makeEnterpriseId } from '@gbg/tmnl/iiot/schemas/assets/enterprise'
import { Site, makeSiteId } from '@gbg/tmnl/iiot/schemas/assets/site'
import { Area, makeAreaId } from '@gbg/tmnl/iiot/schemas/assets/area'
import { Plant, makePlantId } from '@gbg/tmnl/iiot/schemas/assets/plant'
import { Line, makeLineId } from '@gbg/tmnl/iiot/schemas/assets/line'
import { WorkCell, makeWorkCellId } from '@gbg/tmnl/iiot/schemas/assets/workcell'
import { Machine, makeMachineId } from '@gbg/tmnl/iiot/schemas/assets/machine'
import { Sensor, makeSensorId } from '@gbg/tmnl/iiot/schemas/assets/sensor'
import { Device, makeDeviceId } from '@gbg/tmnl/iiot/schemas/assets/device'

// Common types
import { AssetStatus, AssetLocation, AssetMetadata } from '@gbg/tmnl/iiot/schemas/assets/common'

// All identifiers
import {
  EnterpriseId, SiteId, AreaId, PlantId, LineId,
  WorkCellId, MachineId, SensorId, DeviceId,
  EquipmentLevel
} from '@gbg/tmnl/iiot/schemas/identifiers'
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-30 | Initial catalog created from implementation |
