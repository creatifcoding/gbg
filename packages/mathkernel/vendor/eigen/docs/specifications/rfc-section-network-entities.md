# RFC-001 Section: Network Entity Types

```
Section:       Network Entity Types
RFC:           001 -- Entity Lifecycle Event Distribution for Metropolitan-Scale IIoT
Status:        DRAFT
Author:        Val (network-entity-writer)
Created:       2026-02-09
Source Data:   src/lib/iiot/schemas/assets/ (all 9 asset schemas)
               src/lib/iiot/machines/graphs/ (all 12 state graphs)
               src/lib/iiot/entity/ (entity handlers + EntityStack)
               src/lib/iiot/schemas/identifiers.ts (branded IDs)
               research-manufacturing-commons.md (commons thesis)
               rfc-section-multi-tenant-network.md (network architecture)
Bibliography:  docs/specifications/bibliography.md
```

---

## Table of Contents

1. [Entity Type Catalog](#1-entity-type-catalog)
2. [Entity State Machines](#2-entity-state-machines)
3. [Entity Cardinality Model](#3-entity-cardinality-model)
4. [Schema Specifications](#4-schema-specifications)
5. [Entity Lifecycle Events](#5-entity-lifecycle-events)
6. [Network-Specific Entity Types](#6-network-specific-entity-types)
7. [Compliance Entity Types](#7-compliance-entity-types)
8. [Codebase Reference Map](#8-codebase-reference-map)

---

## 1. Entity Type Catalog

### 1.1 Overview

The manufacturing commons operates on a four-tier entity taxonomy:

| Tier | Category | Entity Types | Scope |
|------|----------|-------------|-------|
| T1 | Organization | Organization | Tenant boundary, lifecycle |
| T2 | ISA-95 Equipment | Enterprise, Site, Area, Plant, Line, WorkCell, Machine, Device, Sensor | Intra-org hierarchy |
| T3 | Operational | WorkOrder, Alarm, EquipmentState, SensorReading | Cross-cutting process |
| T4 | Network | Capability, Capacity, Reputation | Cross-org marketplace |

Each entity type MUST be implemented as an `@effect/cluster` Entity with a
Machine-driven state automaton. Entity identity MUST use branded `Schema.String`
identifiers with a deterministic prefix pattern per type.

### 1.2 Organization Entity

The Organization is the **top-level tenant boundary** in the manufacturing
commons. It is NOT part of the ISA-95 equipment hierarchy but rather the
governance container that owns one or more Enterprise entities.

```
Organization (tenant boundary)
  +-- Enterprise (ISA-95 L4)
  |     +-- Site (ISA-95 L3 geographic)
  |     |     +-- Area (ISA-95 L2)
  |     |     +-- Plant (ISA-95 L3 functional)
  |     |           +-- Line (ISA-95 L1)
  |     |                 +-- WorkCell (ISA-95 L1)
  |     |                       +-- Machine (Equipment Module)
  |     |                             +-- Device (Control Module - actuation)
  |     |                             +-- Sensor (Control Module - sensing)
  |     +-- Enterprise ...
  +-- Capability[]
  +-- Capacity[]
  +-- Reputation
```

**Organization States:**

| State | Description | Terminal |
|-------|-------------|----------|
| `onboarding` | Initial registration, schema provisioning in progress | No |
| `active` | Fully operational, events flowing, marketplace participation | No |
| `suspended` | Temporarily disabled (billing, compliance, or administrative) | No |
| `deactivated` | Permanently removed from commons (data archived) | Yes |

**Organization Transitions:**

```
onboarding --[CompleteOnboarding]--> active
active --[Suspend]--> suspended
suspended --[Reactivate]--> active
active --[Deactivate]--> deactivated
suspended --[Deactivate]--> deactivated
```

**Guards:**
- `CompleteOnboarding` MUST verify: (a) at least one Enterprise entity created,
  (b) NATS credentials provisioned, (c) schema validation passed.
- `Suspend` MUST drain all active subscriptions within 30 seconds.
- `Deactivate` MUST trigger archival of all entity state and event journals
  to cold storage within the retention window.

**Organization Schema:**

```typescript
const OrganizationId = Schema.String.pipe(
  Schema.pattern(/^ORG-[a-zA-Z0-9-]+$/),
  Schema.brand('OrganizationId')
)

const OrganizationStatus = Schema.Literal(
  'onboarding', 'active', 'suspended', 'deactivated'
)

class Organization extends Schema.TaggedClass<Organization>()('Organization', {
  id: OrganizationId,
  name: Schema.NonEmptyString,
  status: OrganizationStatus,
  tier: Schema.Literal('starter', 'professional', 'enterprise'),
  maxEntities: Schema.Number.pipe(Schema.int(), Schema.positive()),
  region: Schema.String,  // 'atlanta-metro'
  natsAccount: Schema.String,
  createdAt: Schema.DateTimeUtc,
  suspendedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  deactivatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
})
```

### 1.3 ISA-95 Equipment Hierarchy

The equipment hierarchy follows ISA-95/IEC 62264 with nine entity types
spanning automation levels 0 through 4. The TMNL implementation uses
`Schema.TaggedClass` for each entity type with domain-specific status
overrides and branded identifiers.

**Telescoping Depth:**

The key innovation of the manufacturing commons is **variable-depth hierarchy**.
A 2-person machine shop (Earl's Machine Works) MAY register with only:

```
Organization: ORG-earls-machine-works
  Enterprise: ENT-earls
    Site: SIT-main-shop
      Machine: MCH-haas-vf2
        Sensor: SNS-spindle-temp
```

While a global manufacturer (Boeing) MAY use the full hierarchy:

```
Organization: ORG-boeing-atlanta
  Enterprise: ENT-boeing-defense
    Site: SIT-marietta-plant
      Area: ARA-wing-assembly
        Plant: PLT-composite-fab
          Line: LIN-layup-01
            WorkCell: WCL-autoclave-bay
              Machine: MCH-autoclave-01
                Device: DEV-pressure-valve-01
                Sensor: SNS-temp-core-01
```

Implementations MUST treat missing intermediate levels as pass-through for
event propagation. If an Organization has Enterprise -> Site -> Machine with
no Area/Plant/Line/WorkCell, propagation rules U-1 through U-4 MUST skip
the absent levels and apply at the next present ancestor [ISA-95-1].

#### 1.3.1 Enterprise (ISA-95 Level 4)

The Enterprise entity represents a corporation or business unit. It is the
topmost level of the ISA-95 equipment hierarchy and the primary aggregation
point for business-level metrics.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `EnterpriseId` | Yes | Pattern: `ENT-{slug}` |
| `name` | `NonEmptyString` | Yes | Human-readable name |
| `status` | `EnterpriseStatus` | Yes | `active \| restructuring \| merged \| dissolved` |
| `industry` | `Option<String>` | No | Industry sector code |
| `legalName` | `Option<String>` | No | Legal entity name |
| `taxId` | `Option<String>` | No | Tax identification |
| `headquarters` | `Option<String>` | No | HQ location |
| `hierarchyPath` | `HierarchyPath` | Yes | Materialized path |

**Codebase reference:** `src/lib/iiot/schemas/assets/enterprise/schema.ts`
**State graph:** `src/lib/iiot/machines/graphs/enterprise-graph.ts`

#### 1.3.2 Site (ISA-95 Level 3 -- Geographic)

A physical location containing one or more plants or areas. Sites carry
geographic metadata (address, timezone, GPS coordinates) essential for
proximity-based marketplace matching.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `SiteId` | Yes | Pattern: `SIT-{slug}` |
| `status` | `SiteStatus` | Yes | `planned \| under_construction \| operational \| seasonal_shutdown \| closed \| decommissioned` |
| `enterpriseId` | `EnterpriseId` | Yes | Parent enterprise |
| `timezone` | `String` | Yes | IANA timezone |
| `address` | `Option<String>` | No | Street address |
| `city` | `Option<String>` | No | City name |
| `state` | `Option<String>` | No | State/province |
| `country` | `Option<String>` | No | Country ISO code |

**Codebase reference:** `src/lib/iiot/schemas/assets/site/schema.ts`
**State graph:** `src/lib/iiot/machines/graphs/site-graph.ts`

#### 1.3.3 Area (ISA-95 Level 2)

A functional zone within a site (production floor, warehouse, QA lab).
Areas represent logical groupings that may contain lines, work cells,
or standalone machines.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `AreaId` | Yes | Pattern: `ARA-{slug}` |
| `status` | `AreaStatus` | Yes | `active \| restricted \| maintenance \| inactive \| decommissioned` |
| `areaType` | `AreaType` | Yes | `production \| warehouse \| maintenance \| quality \| shipping \| receiving` |

**Codebase reference:** `src/lib/iiot/schemas/assets/area/schema.ts`
**State graph:** `src/lib/iiot/machines/graphs/area-graph.ts`

#### 1.3.4 Plant (ISA-95 Level 3 -- Functional)

A functional processing unit within a site. Distinct from Site (geographic),
Plant represents a self-contained production capability with its own
commissioning lifecycle.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `PlantId` | Yes | Pattern: `PLT-{slug}` |
| `status` | `PlantStatus` | Yes | `commissioning \| operational \| scheduled_shutdown \| emergency_shutdown \| maintenance_shutdown \| decommissioned` |

**Codebase reference:** `src/lib/iiot/schemas/assets/plant/schema.ts`
**State graph:** `src/lib/iiot/machines/graphs/plant-graph.ts`

#### 1.3.5 Line (ISA-95 Level 1 / OEE)

A production line with OEE-aware state transitions. Lines track availability,
performance, and changeover metrics critical for capacity calculations.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `LineId` | Yes | Pattern: `LIN-{slug}` |
| `status` | `LineStatus` | Yes | `idle \| running \| changeover \| starved \| blocked \| maintenance \| decommissioned` |

**Codebase reference:** `src/lib/iiot/schemas/assets/line/schema.ts`
**State graph:** `src/lib/iiot/machines/graphs/line-graph.ts`

#### 1.3.6 WorkCell (ISA-95 Level 1)

A discrete workstation within a line. WorkCells represent the atomic
schedulable unit for work order assignment.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `WorkCellId` | Yes | Pattern: `WCL-{slug}` |
| `status` | `WorkCellStatus` | Yes | `idle \| setup \| running \| blocked \| faulted \| maintenance \| decommissioned` |

**Codebase reference:** `src/lib/iiot/schemas/assets/workcell/schema.ts`
**State graph:** `src/lib/iiot/machines/graphs/workcell-graph.ts`

#### 1.3.7 Machine (Equipment Module)

The fundamental processing equipment. Machines contain devices and sensors.
Machine status drives capacity calculations and maintenance scheduling.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `MachineId` | Yes | Pattern: `MCH-{slug}` |
| `status` | `MachineStatus` | Yes | `commissioned \| operational \| idle \| faulted \| scheduled_maintenance \| unscheduled_maintenance \| retired \| decommissioned` |

**Codebase reference:** `src/lib/iiot/schemas/assets/machine/schema.ts`
**State graph:** `src/lib/iiot/machines/graphs/machine-asset-graph.ts`

#### 1.3.8 Device (Control Module -- Actuation)

Physical actuation hardware (motors, valves, pumps). Devices execute
control actions and report firmware/connectivity status.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `DeviceId` | Yes | Pattern: `DEV-{slug}` |
| `status` | `DeviceStatus` | Yes | `provisioned \| online \| offline \| faulted \| firmware_update \| decommissioned` |
| `deviceType` | `DeviceType` | Yes | `motor \| valve \| pump \| heater \| cooler \| conveyor \| actuator \| servo \| ...` |

**Codebase reference:** `src/lib/iiot/schemas/assets/device/schema.ts`
**State graph:** `src/lib/iiot/machines/graphs/device-graph.ts`

#### 1.3.9 Sensor (Control Module -- Sensing)

Physical instrumentation at ISA-95 Level 0. Sensors are LEAF nodes --
they contain no children. Each sensor has a measurement type, unit,
sample rate, and threshold configuration.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `SensorId` | Yes | Pattern: `SNS-{slug}` |
| `status` | `SensorStatus` | Yes | `active \| calibrating \| needs_calibration \| faulted \| offline \| decommissioned` |
| `sensorType` | `SensorType` | Yes | `temperature \| pressure \| vibration \| humidity \| flow \| level \| speed \| position \| current \| voltage \| power \| force \| torque \| weight \| ph \| conductivity \| other` |
| `unit` | `MeasurementUnit` | Yes | SI and imperial units |
| `sampleRateMs` | `Option<Int>` | No | Sample rate in ms |
| `thresholdHigh` | `Option<Number>` | No | Warning threshold |
| `thresholdCritical` | `Option<Number>` | No | Critical threshold |

**Codebase reference:** `src/lib/iiot/schemas/assets/sensor/schema.ts`
**State graph:** `src/lib/iiot/machines/graphs/sensor-graph.ts`

### 1.4 Operational Entity Types

Operational entities cross-cut the equipment hierarchy. They represent
processes, conditions, and measurements that reference equipment entities
but have independent lifecycles.

#### 1.4.1 Alarm (ISA-18.2)

Alarms implement the ISA-18.2 alarm management lifecycle. An alarm is
triggered by a sensor threshold breach or equipment fault and progresses
through acknowledgment, shelving, suppression, and clearance states.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `AlarmId` | Yes | Unique alarm instance ID |
| `state` | `AlarmState` | Yes | `unacknowledged \| acknowledged \| shelved \| suppressed \| cleared \| out_of_service` |
| `severity` | `AlarmSeverity` | Yes | Per ISA-18.2 priority model |
| `sourceEntityId` | `AssetId` | Yes | Equipment entity that triggered the alarm |
| `sourceEntityType` | `String` | Yes | Entity type tag (Sensor, Machine, etc.) |

**Codebase reference:** `src/lib/iiot/entity/AlarmEntity.ts`
**State graph:** `src/lib/iiot/machines/graphs/alarm-state-graph.ts`

#### 1.4.2 WorkOrder (ISA-95 Operations Management)

Work orders implement FDA 21 CFR Part 11 compliant workflows with full
audit trail. The work order state machine supports 11 states and enforces
approval-gated transitions.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `WorkOrderId` | Yes | Unique work order ID |
| `status` | `WorkOrderStatus` | Yes | 11-state lifecycle (see Section 2.4) |
| `priority` | `WorkOrderPriority` | Yes | Scheduling priority |
| `targetEntityId` | `AssetId` | Yes | Equipment assigned to |
| `estimatedDuration` | `Duration` | No | Estimated completion time |

**Codebase reference:** `src/lib/iiot/entity/WorkOrderEntity.ts`
**State graph:** `src/lib/iiot/machines/graphs/work-order-graph.ts`

#### 1.4.3 EquipmentState (ISA-95 / OEE)

Equipment state represents the current operating condition of a piece
of equipment for OEE calculation. It is a cross-cutting entity that
references a Machine or Line and tracks running, idle, downtime, and
blocked states.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `EquipmentStateId` | Yes | Unique equipment state ID |
| `stateType` | `StateType` | Yes | `running \| idle \| planned_downtime \| unplanned_downtime \| setup \| blocked` |
| `equipmentId` | `AssetId` | Yes | Referenced equipment entity |
| `reason` | `Option<String>` | No | Human-readable reason for state |

**Codebase reference:** `src/lib/iiot/entity/EquipmentStateEntity.ts`
**State graph:** `src/lib/iiot/machines/graphs/equipment-state-graph.ts`

#### 1.4.4 SensorReading

Sensor readings are NOT entity-managed aggregates but rather high-frequency
event streams. A reading is a point-in-time measurement from a sensor.

Readings flow through the ingestion pipeline:
`SparkplugAdapter -> TopicRouter -> ReadingProcessor -> AlarmDetector -> ChannelService`

**Codebase reference:** `src/lib/iiot/schemas/readings.ts`
**Pipeline:** `src/lib/iiot/adapters/ingestion-service.ts`

---

## 2. Entity State Machines

All entity state machines are implemented as `Effect.Graph.directed` graphs
with typed nodes (states) and typed edges (transition actions). Graph
construction is performed once at module load; transition validation uses
O(1) `Graph.hasEdge` lookups.

### 2.1 Enterprise State Machine

```
     +-----------+  Restructure   +---------------+
     |  active   |--------------->| restructuring |
     |           |<---------------|               |
     +--+----+--+  CompleteRestr. +-------+-------+
        |    |                            |
        |    | Merge                      | Dissolve
        |    v                            |
        |  +--------+                    |
        |  | merged | (terminal)         |
        |  +--------+                    |
        |                                |
        | Dissolve                       |
        v                                v
     +-----------+
     | dissolved | (terminal)
     +-----------+
```

**States:** 4 | **Transitions:** 5 | **Terminal:** `merged`, `dissolved`

**Propagation Rules:**
- **Upward (U-1):** Enterprise `dissolved` -> Organization MUST evaluate
  if any remaining Enterprises exist; if none, trigger `Deactivate`.
- **Downward (D-1):** Enterprise `dissolved` -> All child Sites MUST
  transition to `decommissioned` within 24 hours.
- **Lateral:** None (Enterprises are siblings without dependency).

### 2.2 Site State Machine

```
planned -> under_construction -> operational -> seasonal_shutdown -> operational
                                     |                                  |
                                     +---> closed ---> decommissioned <-+
```

**States:** 6 | **Transitions:** 7 | **Terminal:** `decommissioned`

**Propagation Rules:**
- **Upward (U-2):** Site `decommissioned` -> Enterprise SHOULD recalculate
  capacity aggregates. If all Sites decommissioned, Enterprise SHOULD
  transition to `dissolved`.
- **Downward (D-2):** Site `closed` -> All child Areas and Plants MUST
  transition to `inactive` / `maintenance_shutdown` respectively.
- **Lateral:** Site `seasonal_shutdown` -> sibling Sites within the same
  Enterprise SHOULD receive notification for load redistribution.

### 2.3 Area State Machine

```
active <-> restricted <-> maintenance -> inactive -> decommissioned
  ^                                         |
  +------- canActivate --------------------+
```

**States:** 5 | **Transitions:** 7 | **Terminal:** `decommissioned`

**Propagation Rules:**
- **Upward (U-3):** Area `maintenance` -> Site SHOULD update availability
  percentage.
- **Downward (D-3):** Area `restricted` -> all child Lines MUST pause
  (transition to `blocked` or `idle`).
- **Lateral (L-1):** Area `restricted` -> sibling production Areas in the
  same Site SHOULD receive capacity reallocation signal.

### 2.4 Plant State Machine

```
commissioning -> operational -> scheduled_shutdown -> operational
                     |                                    |
                     +-> emergency_shutdown --------> maintenance_shutdown -> decommissioned
```

**States:** 6 | **Transitions:** 8 | **Terminal:** `decommissioned`

**Propagation Rules:**
- **Upward (U-3):** Plant `emergency_shutdown` -> Site MUST emit
  safety-critical alert (priority P1).
- **Downward (D-2):** Plant `emergency_shutdown` -> all child Lines
  MUST stop immediately (transition to `idle`).
- **Lateral (L-2):** Plant `scheduled_shutdown` -> sibling Plants SHOULD
  receive capacity absorption request.

### 2.5 Line State Machine

```
idle <-> running <-> changeover -> running
  |         |             |
  |         +-> starved --+
  |         +-> blocked --+
  |         +-> maintenance -> idle
  +-> decommissioned
```

**States:** 7 | **Transitions:** 11 | **Terminal:** `decommissioned`

**OEE Classification:**

| State | OEE Category |
|-------|-------------|
| `running` | Productive |
| `changeover` | Performance loss |
| `starved` | Performance loss |
| `blocked` | Performance loss |
| `idle` | Availability loss |
| `maintenance` | Availability loss (planned) |

**Propagation Rules:**
- **Upward (U-4):** Line `blocked` -> Plant/Area SHOULD update OEE
  dashboard in real time.
- **Downward (D-3):** Line `maintenance` -> all child WorkCells MUST
  transition to `maintenance`.
- **Lateral (L-3):** Line `starved` -> upstream Lines in the same Plant
  SHOULD receive starvation signal for backpressure management.

### 2.6 WorkCell State Machine

```
idle <-> setup <-> running <-> blocked
  |         |          |          |
  |         |          +-> faulted -+-> maintenance -> idle
  +-> decommissioned
```

**States:** 7 | **Transitions:** 11 | **Terminal:** `decommissioned`

### 2.7 Machine State Machine

```
commissioned -> operational <-> idle <-> faulted
                    |                       |
                    +-> scheduled_maintenance -+
                    +-> unscheduled_maintenance +-> retired -> decommissioned
```

**States:** 8 | **Transitions:** 11 | **Terminal:** `retired`, `decommissioned`

**Propagation Rules:**
- **Upward (U-4):** Machine `faulted` -> parent WorkCell/Line SHOULD
  update availability. If critical machine (single point of failure),
  Line MUST transition to `blocked`.
- **Downward (D-3):** Machine `decommissioned` -> all child Devices and
  Sensors MUST transition to `decommissioned`.

### 2.8 Device State Machine

```
provisioned -> online <-> offline <-> faulted
                 |                       |
                 +-> firmware_update ----+
                 +-> decommissioned
```

**States:** 6 | **Transitions:** 8 | **Terminal:** `decommissioned`

### 2.9 Sensor State Machine

```
active <-> calibrating -> active
  |            |
  +-> needs_calibration -> calibrating
  +-> faulted <-> active
  +-> offline <-> active
  +-> decommissioned
```

**States:** 6 | **Transitions:** 9 | **Terminal:** `decommissioned`

### 2.10 Alarm State Machine (ISA-18.2)

```
                             +------------------+
                             |  out_of_service  |
                             +--------+---------+
                                      | ReturnToService
                                      v
    +-----------------+  Ack   +--------------+
    | unacknowledged  |------->| acknowledged |
    +--------+--------+       +------+-------+
             |                        |
             | Shelve                 | Clear
             v                        v
    +--------+--------+       +------+-------+
    |    shelved      |       |   cleared    |
    +--------+--------+       +--------------+
             | Unshelve              ^
             +----- (re-trigger) ----+

    +------------------+
    |   suppressed     | (enter from unack/ack, exit to unack/ack)
    +------------------+
```

**States:** 6 | **Transitions:** 15 | **Terminal:** none (alarms cycle)

### 2.11 Work Order State Machine (FDA 21 CFR Part 11)

```
created --> submitted --> approved --> started --> completed --> closed
  |              |            |            |            |
  v              v            v            v            v
cancelled    rejected    cancelled    suspended      failed
                                         |              |
                                         v              v
                                      resumed        closed
```

**States:** 11 | **Transitions:** 15 | **Terminal:** `rejected`, `closed`

### 2.12 Equipment State Machine (OEE)

```
running <-> idle <-> planned_downtime
  |           |            |
  +-> setup --+            |
  +-> unplanned_downtime <-+
  +-> blocked <-> idle
```

**States:** 6 | **Transitions:** 12+ (permissive) | **Terminal:** none

---

## 3. Entity Cardinality Model

### 3.1 Scale Projections

The manufacturing commons targets 200,000 organizations in the Atlanta
metropolitan area. Entity counts scale with organization size tiers:

| Tier | Org Count | Avg Entities/Org | Total Entities | Example |
|------|-----------|-----------------|----------------|---------|
| Micro (1-5 employees) | 120,000 | 8 | 960,000 | Earl's Machine Works |
| Small (6-50) | 50,000 | 35 | 1,750,000 | Custom Fabricators Inc. |
| Medium (51-500) | 25,000 | 200 | 5,000,000 | Atlanta Precision Mfg. |
| Large (501-5000) | 4,500 | 2,000 | 9,000,000 | Lockheed Martin site |
| Enterprise (5000+) | 500 | 15,000 | 7,500,000 | Boeing, Delta TechOps |
| **Total** | **200,000** | -- | **~24.2M** | -- |

### 3.2 Entity Count by Type

| Entity Type | Avg per Micro | Avg per Enterprise | Total Projected | Hot-Spot Ratio |
|------------|--------------|-------------------|----------------|---------------|
| Organization | 1 | 1 | 200,000 | 1:1 |
| Enterprise | 1 | 5 | 210,000 | 1:5 |
| Site | 1 | 20 | 280,000 | 1:20 |
| Area | 0 | 50 | 180,000 | 0:50 |
| Plant | 0 | 30 | 120,000 | 0:30 |
| Line | 0 | 100 | 450,000 | 0:100 |
| WorkCell | 0 | 200 | 600,000 | 0:200 |
| Machine | 2 | 2,000 | 3,500,000 | 2:2000 |
| Device | 1 | 3,000 | 4,200,000 | 1:3000 |
| Sensor | 3 | 10,000 | 14,000,000 | 3:10000 |
| Alarm (active) | 1 | 500 | 350,000 | 1:500 |
| WorkOrder (active) | 1 | 200 | 250,000 | 1:200 |
| EquipmentState | 2 | 2,000 | 3,500,000 | 2:2000 |

### 3.3 Shard Assignment Strategy

Entity sharding uses `@effect/cluster` with 5 shard groups per the
research findings [EFFECT-CLUSTER]:

| Shard Group | Entity Types | Shard Count | Rationale |
|-------------|-------------|------------|-----------|
| SG-1: Hierarchy | Enterprise, Site, Area, Plant | 64 | Low churn, read-heavy |
| SG-2: Production | Line, WorkCell, Machine | 256 | Medium churn, OEE-critical |
| SG-3: Instrumentation | Device, Sensor | 512 | High entity count, low individual churn |
| SG-4: Operational | Alarm, WorkOrder, EquipmentState | 256 | High churn, time-critical |
| SG-5: Network | Organization, Capability, Capacity, Reputation | 128 | Cross-org, marketplace |

**Shard Key Derivation:**

Each entity MUST derive its shard key from its `OrganizationId` to ensure
all entities within a single organization are co-located on the same shard
group partition:

```
shardKey = hash(organizationId) % shardCount
```

This ensures that intra-organization queries (e.g., "all machines in org X")
hit a single partition, while cross-organization queries (marketplace
discovery) fan out across partitions.

### 3.4 Hot-Spot Analysis

**Boeing Problem:** A single enterprise-tier org (Boeing Atlanta) may have
15,000 entities. Without mitigation, this org would dominate a single shard.

**Mitigation:**
1. **Sub-sharding by Site:** Large orgs split across multiple shards using
   `hash(organizationId + siteId)` for SG-2 and SG-3.
2. **Dedicated partitions:** Organizations exceeding 5,000 entities SHOULD
   receive dedicated NATS account partitions.
3. **Rate limiting:** Per-organization rate limits on entity creation
   (configurable by tier).

**Earl Problem:** A micro org with 8 entities generates negligible load
but consumes a full shard slot. Since micro orgs represent 60% of the
network, efficient packing is critical.

**Mitigation:**
1. **Shard packing:** Multiple micro orgs share a single shard partition.
   Target: 500+ micro orgs per shard.
2. **Lazy instantiation:** Micro org entities are not pre-materialized in
   memory; they are loaded on first access and evicted after 5 minutes idle.

---

## 4. Schema Specifications

### 4.1 Branded Identifier System

All entity identifiers use Effect `Schema.brand` with deterministic prefixes.
This provides compile-time type safety and runtime pattern validation:

| Entity Type | Brand | Prefix | Pattern | Example |
|------------|-------|--------|---------|---------|
| Organization | `OrganizationId` | `ORG-` | `/^ORG-[a-zA-Z0-9-]+$/` | `ORG-earls-machine-works` |
| Enterprise | `EnterpriseId` | `ENT-` | `/^ENT-[a-zA-Z0-9-]+$/` | `ENT-acme-corp` |
| Site | `SiteId` | `SIT-` | `/^SIT-[a-zA-Z0-9-]+$/` | `SIT-chicago-main` |
| Area | `AreaId` | `ARA-` | `/^ARA-[a-zA-Z0-9-]+$/` | `ARA-wing-assembly` |
| Plant | `PlantId` | `PLT-` | `/^PLT-[a-zA-Z0-9-]+$/` | `PLT-composite-fab` |
| Line | `LineId` | `LIN-` | `/^LIN-[a-zA-Z0-9-]+$/` | `LIN-layup-01` |
| WorkCell | `WorkCellId` | `WCL-` | `/^WCL-[a-zA-Z0-9-]+$/` | `WCL-autoclave-bay` |
| Machine | `MachineId` | `MCH-` | `/^MCH-[a-zA-Z0-9-]+$/` | `MCH-haas-vf2` |
| Device | `DeviceId` | `DEV-` | `/^DEV-[a-zA-Z0-9-]+$/` | `DEV-pressure-valve-01` |
| Sensor | `SensorId` | `SNS-` | `/^SNS-[a-zA-Z0-9-]+$/` | `SNS-spindle-temp` |
| Alarm | `AlarmId` | -- | `Schema.brand('AlarmId')` | UUID-based |
| WorkOrder | `WorkOrderId` | -- | `Schema.brand('WorkOrderId')` | UUID-based |
| EquipmentState | `EquipmentStateId` | -- | `Schema.brand('EquipmentStateId')` | UUID-based |

**Codebase reference:** `src/lib/iiot/schemas/identifiers.ts`

### 4.2 BaseAssetFields

All ISA-95 equipment entities share a common field set via `BaseAssetFields`:

```typescript
// src/lib/iiot/schemas/assets/common/types.ts
const BaseAssetFields = {
  name: Schema.NonEmptyString,
  status: AssetStatus,               // overridden per entity type
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  location: Schema.optionalWith(AssetLocation, { as: 'Option' }),
  metadata: AssetMetadata,           // Record<string, string>
  hierarchyPath: HierarchyPath,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  // Parent ID references (all optional, populated based on hierarchy depth)
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  siteId: Schema.optionalWith(SiteId, { as: 'Option' }),
  areaId: Schema.optionalWith(AreaId, { as: 'Option' }),
  plantId: Schema.optionalWith(PlantId, { as: 'Option' }),
  lineId: Schema.optionalWith(LineId, { as: 'Option' }),
  workCellId: Schema.optionalWith(WorkCellId, { as: 'Option' }),
}
```

### 4.3 HierarchyPath

The `HierarchyPath` is a materialized path structure that encodes the
full ancestry chain for efficient querying and event routing:

```
/ENT-acme-corp/SIT-atlanta-main/ARA-production/PLT-cnc-shop/LIN-lathe-01/MCH-haas-vf2
```

HierarchyPath MUST support:
- `root(id, name)` -- create root-level path
- `fromSegments([...])` -- construct from ancestor chain
- `toString()` -- materialize to `/`-delimited string
- Prefix matching for NATS subject routing

### 4.4 Entity Method Protocol

All ISA-95 equipment entities MUST implement four methods as defined
by `Schema.TaggedClass`:

| Method | Signature | Description |
|--------|-----------|-------------|
| `getAutomationLevel()` | `() => 0 \| 1 \| 2 \| 3 \| 4` | ISA-95 automation level |
| `isOperational()` | `() => boolean` | Whether entity is in an operational state |
| `isContainer()` | `() => boolean` | Whether entity can have children |
| `materializePath()` | `() => string` | Materialized hierarchy path string |

---

## 5. Entity Lifecycle Events

### 5.1 EntityStateChanged Event Structure

All entity state transitions produce an `EntityStateChanged` event that
is published to the NATS event bus. This is the fundamental event type
for intra-organization realtime distribution.

```typescript
const EntityStateChanged = Schema.TaggedStruct('EntityStateChanged', {
  /** Unique event ID */
  eventId: EventId,

  /** ISO-8601 timestamp of the state change */
  timestamp: Schema.DateTimeUtc,

  /** Organization that owns this entity */
  organizationId: OrganizationId,

  /** Entity type discriminator */
  entityType: Schema.Literal(
    'Enterprise', 'Site', 'Area', 'Plant', 'Line',
    'WorkCell', 'Machine', 'Device', 'Sensor',
    'Alarm', 'WorkOrder', 'EquipmentState'
  ),

  /** Entity ID (type-specific branded string) */
  entityId: Schema.String,

  /** Previous state value */
  previousState: Schema.String,

  /** New state value */
  newState: Schema.String,

  /** Transition action that caused the change */
  transitionAction: Schema.String,

  /** Materialized hierarchy path for routing */
  hierarchyPath: Schema.String,

  /** Causal ordering metadata */
  causality: Schema.Struct({
    /** Lamport timestamp for causal ordering within org */
    lamportClock: Schema.Number.pipe(Schema.int()),
    /** Optional parent event ID (for event chains) */
    parentEventId: Schema.optionalWith(EventId, { as: 'Option' }),
    /** Correlation ID for saga tracking */
    correlationId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  }),

  /** Actor who initiated the change */
  actor: Schema.Struct({
    type: Schema.Literal('user', 'system', 'rule', 'external'),
    id: Schema.String,
    name: Schema.optionalWith(Schema.String, { as: 'Option' }),
  }),
})
```

### 5.2 NATS Subject Mapping

Entity lifecycle events MUST be published to NATS subjects that encode
the organization, entity type, and hierarchy path:

```
iiot.{orgId}.entity.{entityType}.{entityId}.state_changed
```

**Examples:**
```
iiot.ORG-earls-machine-works.entity.Machine.MCH-haas-vf2.state_changed
iiot.ORG-boeing-atlanta.entity.Sensor.SNS-temp-core-01.state_changed
iiot.ORG-acme-corp.entity.Alarm.ALM-001.state_changed
```

**Wildcard Subscriptions:**
```
iiot.ORG-earls-machine-works.entity.*.*.state_changed    # All entity changes for org
iiot.ORG-earls-machine-works.entity.Machine.*.state_changed  # All machine changes
iiot.*.entity.Machine.*.state_changed                     # All machine changes across commons (admin only)
```

### 5.3 Event Ordering Guarantees

Entity lifecycle events adhere to the two-domain consistency model
defined in the consistency guarantees section [RFC-CONSISTENCY]:

**Intra-Organization (Domain 1):**
- **G-1 (Entity Ordering):** Events for a single entity MUST be delivered
  in causal order (Lamport clock monotonically increasing).
- **G-2 (Hierarchy Ordering):** Parent state changes MUST be visible before
  child state changes when causally related.
- **G-3 (Cross-Entity Causal):** If event A causes event B (via propagation
  rule), B MUST carry A's eventId as `parentEventId`.

**Inter-Organization (Domain 2):**
- **G-5 (Saga Eventual):** Cross-org events (marketplace signals) converge
  within the SLA window (typically < 5 seconds).
- **G-6 (Conflict-Free):** Network aggregates (capacity, reputation) use
  CRDT semantics -- no ordering requirement.

### 5.4 Event Channel Routing

Entity lifecycle events are routed through the ChannelService with four
broadcast channels:

| Channel | MaxLag | Entity Types | Priority |
|---------|--------|-------------|----------|
| `readings` | 10,000 | SensorReading | Low (high volume) |
| `alarms` | 1,000 | Alarm state changes | High (safety-critical) |
| `equipment` | 1,000 | Machine, Line, WorkCell state changes | Medium |
| `invalidations` | 1,000 | All other entity state changes | Medium |

**Codebase reference:** `src/lib/streams/constructs/ChannelService.ts`

---

## 6. Network-Specific Entity Types

Network entities exist at the cross-organization boundary. They are
visible to the marketplace discovery protocol and represent an
organization's participation in the manufacturing commons.

### 6.1 Capability

A Capability declares what an organization can manufacture. Capabilities
are published to the network for discovery by potential buyers.

```typescript
const CapabilityId = Schema.String.pipe(
  Schema.pattern(/^CAP-[a-zA-Z0-9-]+$/),
  Schema.brand('CapabilityId')
)

const Capability = Schema.TaggedStruct('Capability', {
  id: CapabilityId,
  organizationId: OrganizationId,

  /** Material capabilities */
  materials: Schema.Array(Schema.Literal(
    'aluminum', 'steel', 'stainless_steel', 'titanium',
    'inconel', 'copper', 'brass', 'plastic_abs', 'plastic_nylon',
    'carbon_fiber', 'fiberglass', 'wood', 'ceramic'
  )),

  /** Process capabilities */
  processes: Schema.Array(Schema.Literal(
    'cnc_milling', 'cnc_turning', 'cnc_5axis',
    'manual_milling', 'manual_turning',
    'welding_mig', 'welding_tig', 'welding_spot',
    'sheet_metal_forming', 'sheet_metal_laser',
    'injection_molding', 'blow_molding',
    '3d_print_fdm', '3d_print_sla', '3d_print_sls', '3d_print_dmls',
    'assembly_manual', 'assembly_automated',
    'surface_treatment', 'heat_treatment',
    'inspection_cmm', 'inspection_visual', 'inspection_xray'
  )),

  /** Tolerance capabilities */
  tolerances: Schema.Struct({
    linear: Schema.Literal('rough_1mm', 'standard_0.1mm', 'precision_0.01mm', 'ultra_0.001mm'),
    surface: Schema.Literal('rough_6.3um', 'standard_1.6um', 'fine_0.4um', 'mirror_0.1um'),
  }),

  /** Certification capabilities */
  certifications: Schema.Array(Schema.Literal(
    'iso_9001', 'as9100', 'iso_13485', 'iatf_16949',
    'nadcap', 'itar', 'nist_800_171'
  )),

  /** Maximum part dimensions (mm) */
  maxPartEnvelope: Schema.optionalWith(Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }), { as: 'Option' }),

  /** Last verified date */
  verifiedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
})
```

### 6.2 Capacity

Capacity represents available machine-hours that can be booked by other
organizations. Capacity is an event-sourced aggregate that updates in
real time as machines transition between operational states.

```typescript
const CapacityId = Schema.String.pipe(
  Schema.pattern(/^CPC-[a-zA-Z0-9-]+$/),
  Schema.brand('CapacityId')
)

const Capacity = Schema.TaggedStruct('Capacity', {
  id: CapacityId,
  organizationId: OrganizationId,
  machineId: MachineId,

  /** Available hours in current scheduling window */
  availableHours: Schema.Number.pipe(Schema.nonNegative()),

  /** Scheduling window start */
  windowStart: Schema.DateTimeUtc,

  /** Scheduling window end */
  windowEnd: Schema.DateTimeUtc,

  /** Current utilization percentage (0-100) */
  utilization: Schema.Number.pipe(Schema.between(0, 100)),

  /** Hourly rate in USD (optional -- some orgs prefer RFQ-based) */
  hourlyRate: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),

  /** Booking status */
  status: Schema.Literal('available', 'partially_booked', 'fully_booked', 'maintenance'),

  /** Last updated from machine state change */
  lastUpdated: Schema.DateTimeUtc,
})
```

### 6.3 Job (Cross-Organization Saga)

The Job entity represents a manufacturing request that traverses the capacity
marketplace. Jobs are the primary cross-organization coordination mechanism and
form **sagas** that cross trust boundaries -- a concept absent from all existing
IIoT platforms (see Section 2, competitive analysis).

```typescript
const JobId = Schema.String.pipe(
  Schema.pattern(/^JOB-[0-9]{4}-[0-9]{5,}$/),
  Schema.brand('JobId')
)

const BidId = Schema.String.pipe(
  Schema.pattern(/^BID-[a-zA-Z0-9-]+$/),
  Schema.brand('BidId')
)

const JobPriority = Schema.Literal('standard', 'rush', 'critical')

const JobStatus = Schema.Literal(
  'draft',          // Requester composing, not yet visible
  'posted',         // Visible to matching engine
  'matching',       // Engine identifying candidate organizations
  'offered',        // Offers sent to candidate organizations
  'accepted',       // An organization accepted the job
  'in_progress',    // Work underway at accepting organization
  'completed',      // Work finished, awaiting quality verification
  'verified',       // Quality verified by requester
  'disputed',       // Quality dispute raised
  'cancelled',      // Cancelled by requester before acceptance
  'expired',        // No acceptance within offer window
)

const Job = Schema.TaggedStruct('Job', {
  id: JobId,
  requesterId: OrganizationId,
  acceptorId: Schema.optionalWith(OrganizationId, { as: 'Option' }),

  // Job specification
  title: Schema.NonEmptyString,
  description: Schema.String,
  requiredCapability: CapabilityId,
  materialType: Schema.optionalWith(Schema.String, { as: 'Option' }),
  toleranceClass: Schema.optionalWith(Schema.String, { as: 'Option' }),
  quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  priority: JobPriority,

  // Timing
  requestedDelivery: Schema.DateTimeUtc,
  actualDelivery: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  offerExpiry: Schema.DateTimeUtc,

  // Status
  status: JobStatus,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
})
```

**Job State Machine:**

```
  draft --> posted --> matching --> offered --+--> accepted --> in_progress --> completed --> verified
                                             |                                     |
                                             +--> expired                          v
                                             |                                  disputed
                                             v
                                          cancelled
```

**States:** 11 | **Transitions:** 12 | **Terminal:** `verified`, `disputed` (resolved), `cancelled`, `expired`

**Cross-Organization Transition Ownership:**

| Transition | Actor | NATS Account |
|------------|-------|-------------|
| `draft` -> `posted` | Requester | Requester's account |
| `posted` -> `matching` | Matching engine | `manufacturing-commons` system account |
| `matching` -> `offered` | Matching engine | `manufacturing-commons` system account |
| `offered` -> `accepted` | Accepting org | Acceptor's account (via export/import) |
| `offered` -> `expired` | Timer | `manufacturing-commons` system account |
| `accepted` -> `in_progress` | Accepting org | Acceptor's account |
| `in_progress` -> `completed` | Accepting org | Acceptor's account |
| `completed` -> `verified` | Requester | Requester's account |
| `completed` -> `disputed` | Either party | Initiator's account |
| `posted` -> `cancelled` | Requester | Requester's account |

**Consistency Requirements:**

1. Job state transitions MUST be managed as a saga (G-8, Section 9). Each
   transition is an independent event published to the `manufacturing-commons`
   account.
2. Both the requester and the acceptor MUST retain copies of job events in their
   respective JetStream domains (per Section Z.8.3 audit trail).
3. The `manufacturing-commons` account MUST retain a third copy for network-level
   audit and dispute resolution.
4. Job state changes MUST carry both `originTimestamp` (from acting party) and
   `networkTimestamp` (from `manufacturing-commons` account) for cross-org
   temporal ordering (G-8).

**Job Lifecycle Events:**

```typescript
class JobPosted extends Schema.TaggedClass<JobPosted>()('JobPosted', {
  jobId: JobId,
  requesterId: OrganizationId,
  requiredCapability: CapabilityId,
  title: Schema.NonEmptyString,
  quantity: Schema.Number,
  priority: JobPriority,
  requestedDelivery: Schema.DateTimeUtc,
  offerExpiry: Schema.DateTimeUtc,
  timestamp: Schema.DateTimeUtc,
}) {}

class JobOffered extends Schema.TaggedClass<JobOffered>()('JobOffered', {
  jobId: JobId,
  candidateOrgIds: Schema.Array(OrganizationId),
  matchScores: Schema.Array(Schema.Struct({
    orgId: OrganizationId,
    score: Schema.Number.pipe(Schema.between(0, 1)),
    factors: Schema.Struct({
      capabilityMatch: Schema.Number,
      availabilityMatch: Schema.Number,
      qualityHistory: Schema.Number,
      proximityScore: Schema.Number,
    }),
  })),
  timestamp: Schema.DateTimeUtc,
}) {}

class JobAccepted extends Schema.TaggedClass<JobAccepted>()('JobAccepted', {
  jobId: JobId,
  acceptorId: OrganizationId,
  estimatedDelivery: Schema.DateTimeUtc,
  bidPrice: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  timestamp: Schema.DateTimeUtc,
}) {}

class JobCompleted extends Schema.TaggedClass<JobCompleted>()('JobCompleted', {
  jobId: JobId,
  acceptorId: OrganizationId,
  actualDelivery: Schema.DateTimeUtc,
  qualityReportAttached: Schema.Boolean,
  timestamp: Schema.DateTimeUtc,
}) {}

class QualityVerified extends Schema.TaggedClass<QualityVerified>()('QualityVerified', {
  jobId: JobId,
  verifierId: OrganizationId,
  rating: Schema.Number.pipe(Schema.between(1, 5)),
  meetsSpec: Schema.Boolean,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
  timestamp: Schema.DateTimeUtc,
}) {}

class DisputeRaised extends Schema.TaggedClass<DisputeRaised>()('DisputeRaised', {
  jobId: JobId,
  raisedById: OrganizationId,
  reason: Schema.NonEmptyString,
  evidenceAttached: Schema.Boolean,
  timestamp: Schema.DateTimeUtc,
}) {}
```

### 6.4 Reputation

The Reputation entity tracks an organization's trust score within the
manufacturing commons. It uses a G-10 model (10 dimensions, each 0-100).

```typescript
const Reputation = Schema.TaggedStruct('Reputation', {
  organizationId: OrganizationId,

  /** Composite score (weighted average of dimensions) */
  compositeScore: Schema.Number.pipe(Schema.between(0, 100)),

  /** Individual dimension scores */
  dimensions: Schema.Struct({
    qualityConsistency: Schema.Number.pipe(Schema.between(0, 100)),
    onTimeDelivery: Schema.Number.pipe(Schema.between(0, 100)),
    communicationResponsiveness: Schema.Number.pipe(Schema.between(0, 100)),
    priceFairness: Schema.Number.pipe(Schema.between(0, 100)),
    documentationCompleteness: Schema.Number.pipe(Schema.between(0, 100)),
    safetyCompliance: Schema.Number.pipe(Schema.between(0, 100)),
    environmentalPractices: Schema.Number.pipe(Schema.between(0, 100)),
    workforceExpertise: Schema.Number.pipe(Schema.between(0, 100)),
    equipmentCondition: Schema.Number.pipe(Schema.between(0, 100)),
    disputeResolution: Schema.Number.pipe(Schema.between(0, 100)),
  }),

  /** Total completed work orders (for statistical significance) */
  completedOrders: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),

  /** Last updated */
  updatedAt: Schema.DateTimeUtc,
})
```

### 6.5 Network Health (Derived Entity)

The Network Health entity provides a real-time aggregate view of the manufacturing
commons. It is a **derived entity** -- its state is computed entirely from
Organization, Capability, and Capacity events. It follows the same upward-
propagation principle as reactive ISA-95 (Section 5), but at the network level.

```typescript
const NetworkHealth = Schema.TaggedStruct('NetworkHealth', {
  region: Schema.NonEmptyString,  // e.g., 'atlanta-metro'

  // Organization aggregates
  totalOrganizations: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  activeOrganizations: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  offlineOrganizations: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),

  // Capability coverage
  totalCapabilityClusters: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  coveredCapabilityClusters: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  averageRedundancyFactor: Schema.Number.pipe(Schema.nonNegative()),

  // Job marketplace
  activeJobs: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  jobsCompletedToday: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  averageMatchTimeSeconds: Schema.Number.pipe(Schema.nonNegative()),

  // Resilience
  capabilityCoveragePercent: Schema.Number.pipe(Schema.between(0, 100)),
  singlePointOfFailureCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),

  computedAt: Schema.DateTimeUtc,
})
```

**Derivation:**

```text
NetworkHealth.capabilityCoverage = count(
  cluster WHERE cluster.activeProviders >= 1
) / count(ALL clusters) * 100

NetworkHealth.singlePointOfFailure = count(
  cluster WHERE cluster.activeProviders = 1
)
```

Network health snapshots SHOULD be computed and published at a fixed interval
(RECOMMENDED: every 60 seconds). They are informative, not normative -- no
ordering guarantees apply to health snapshots.

### 6.6 NATS Subject Hierarchy for Network Entities

Network entity events are published to the `manufacturing-commons` system
account using the following subject hierarchy:

```text
commons.org.{orgId}.status           -> OrganizationStatusChanged
commons.org.{orgId}.health           -> OrganizationHealthUpdated
commons.org.{orgId}.capabilities     -> CapabilityAdvertised

commons.capacity.{orgId}.{machineId} -> AvailabilityChanged

commons.job.{jobId}.lifecycle        -> JobPosted, JobOffered, JobAccepted, JobCompleted
commons.job.{jobId}.quality          -> QualityVerified, DisputeRaised

commons.reputation.{orgId}           -> ReputationUpdated

commons.network.health               -> NetworkHealthSnapshot
```

**Subject design rationale:**

1. **`commons.` prefix** distinguishes network-level subjects from intra-org
   `iiot.` subjects (Section 8).
2. **Entity-keyed subjects** (`commons.job.{jobId}.lifecycle`) enable per-entity
   JetStream ordering consistent with the intra-org pattern (G-1).
3. **Org-keyed subjects** (`commons.org.{orgId}.status`) enable per-org
   subscription for interested consumers.
4. **Wildcard subscriptions**: `commons.job.>` subscribes to all job events;
   `commons.org.*.status` subscribes to all organization status changes.

**JetStream Stream Configuration:**

Network entity events MUST be persisted in JetStream streams within the
`manufacturing-commons` account:

| Stream | Subjects | Retention | Max Age | Replicas |
|--------|----------|-----------|---------|----------|
| `COMMONS_ORG` | `commons.org.>` | Limits | 90 days | 3 |
| `COMMONS_CAPACITY` | `commons.capacity.>` | Limits | 30 days | 3 |
| `COMMONS_JOB` | `commons.job.>` | Limits | 1 year | 3 |
| `COMMONS_REPUTATION` | `commons.reputation.>` | Limits | 2 years | 3 |
| `COMMONS_HEALTH` | `commons.network.>` | Limits | 7 days | 1 |

**Retention rationale:**
- Job events retained for 1 year for audit trail (Section Z.8.3).
- Reputation retained for 2 years to enable trend analysis.
- Health snapshots retained for 7 days (ephemeral, re-computable).

### 6.7 Cross-Organization Event Flow

The following sequence illustrates how network entity events flow when a
job traverses from posting to completion:

```text
Earl's Account               manufacturing-commons           Precision Inc Account
================               =======================          ====================

1. Earl posts job
   JobPosted --export-->       commons.job.J42.lifecycle
                               --import-->                     Receives JobOffered

2. Matching engine runs
                               JobOffered (score: 0.87)

3. Precision accepts
                               <--export--  JobAccepted
   Receives confirmation       commons.job.J42.lifecycle

4. Precision completes
                               <--export--  JobCompleted
   Receives completion         commons.job.J42.lifecycle

5. Earl verifies quality
   QualityVerified --export-->   commons.job.J42.quality

6. Reputation updates
                               ReputationUpdated
                               commons.reputation.ORG-prec
```

Each arrow represents a NATS cross-account export/import (Section Z.3.3).
Each event is persisted in three JetStream domains: the requester's, the
acceptor's, and the `manufacturing-commons` system account's.

### 6.8 Attestation Envelope for Network Events

All network entity events that cross organization boundaries MUST be wrapped
in the attestation envelope defined in Section Z.7.1:

```typescript
const NetworkEventEnvelope = Schema.Struct({
  originTimestamp: Schema.DateTimeUtc,
  networkTimestamp: Schema.DateTimeUtc,
  orgId: OrganizationId,
  entityId: Schema.String,
  sequenceNumber: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  payload: Schema.Union(
    JobPosted, JobAccepted, JobCompleted,
    QualityVerified, DisputeRaised,
    CapabilityAdvertised, AvailabilityChanged,
    OrganizationStatusChanged,
    ReputationUpdated, NetworkHealthSnapshot,
  ),
  attestation: Schema.optionalWith(Schema.Struct({
    clockQuality: Schema.optionalWith(
      Schema.Literal('ntp-consumer', 'ntp-enterprise', 'ptp-gps', 'unknown'),
      { as: 'Option' }
    ),
    dataSource: Schema.optionalWith(
      Schema.Literal('sensor-direct', 'manual-entry', 'derived-calculation', 'third-party'),
      { as: 'Option' }
    ),
    certifications: Schema.optionalWith(Schema.Array(Schema.String), { as: 'Option' }),
    softwareVersion: Schema.optionalWith(Schema.String, { as: 'Option' }),
  }), { as: 'Option' }),
})
```

The `networkTimestamp` is set by the `manufacturing-commons` account upon receipt.
The `originTimestamp` is set by the publishing organization. The difference between
these timestamps is used for clock quality scoring (Section Z.7.2).

---

## 7. Compliance Entity Types

Compliance entities support regulatory requirements including FDA 21 CFR
Part 11, AS9100, and ISA-88 batch record keeping.

### 7.1 CertificateOfConformance

```typescript
const CertificateOfConformance = Schema.TaggedStruct('CertificateOfConformance', {
  id: Schema.String.pipe(Schema.brand('CoCId')),
  workOrderId: WorkOrderId,
  organizationId: OrganizationId,
  issuedAt: Schema.DateTimeUtc,
  inspectionRecords: Schema.Array(Schema.String.pipe(Schema.brand('InspectionId'))),
  materialCertifications: Schema.Array(Schema.String),
  dimensionalResults: Schema.Array(Schema.Struct({
    feature: Schema.String,
    nominal: Schema.Number,
    actual: Schema.Number,
    tolerance: Schema.Number,
    inSpec: Schema.Boolean,
  })),
  signedBy: Schema.String,
  digitalSignature: Schema.String,
})
```

### 7.2 InspectionRecord

```typescript
const InspectionRecord = Schema.TaggedStruct('InspectionRecord', {
  id: Schema.String.pipe(Schema.brand('InspectionId')),
  workOrderId: WorkOrderId,
  inspectorId: Schema.String,
  method: Schema.Literal('cmm', 'visual', 'xray', 'ultrasonic', 'dye_penetrant'),
  results: Schema.Array(Schema.Struct({
    characteristic: Schema.String,
    specification: Schema.String,
    measured: Schema.String,
    status: Schema.Literal('pass', 'fail', 'conditional'),
  })),
  inspectedAt: Schema.DateTimeUtc,
  equipmentUsed: Schema.optionalWith(Schema.String, { as: 'Option' }),
  calibrationId: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
```

### 7.3 AuditTrail

```typescript
const AuditTrailEntry = Schema.TaggedStruct('AuditTrailEntry', {
  id: Schema.String.pipe(Schema.brand('AuditEntryId')),
  organizationId: OrganizationId,
  entityType: Schema.String,
  entityId: Schema.String,
  action: Schema.Literal('create', 'update', 'delete', 'state_change', 'approval', 'rejection'),
  previousValue: Schema.optionalWith(Schema.String, { as: 'Option' }),
  newValue: Schema.String,
  actor: Schema.Struct({
    type: Schema.Literal('user', 'system', 'external'),
    id: Schema.String,
    name: Schema.optionalWith(Schema.String, { as: 'Option' }),
    ipAddress: Schema.optionalWith(Schema.String, { as: 'Option' }),
  }),
  timestamp: Schema.DateTimeUtc,
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
```

---

## 8. Codebase Reference Map

| Specification Element | Source File |
|-----------------------|------------|
| Enterprise schema + ID | `src/lib/iiot/schemas/assets/enterprise/schema.ts` |
| Site schema + ID | `src/lib/iiot/schemas/assets/site/schema.ts` |
| Area schema + ID | `src/lib/iiot/schemas/assets/area/schema.ts` |
| Plant schema + ID | `src/lib/iiot/schemas/assets/plant/schema.ts` |
| Line schema + ID | `src/lib/iiot/schemas/assets/line/schema.ts` |
| WorkCell schema + ID | `src/lib/iiot/schemas/assets/workcell/schema.ts` |
| Machine schema + ID | `src/lib/iiot/schemas/assets/machine/schema.ts` |
| Device schema + ID | `src/lib/iiot/schemas/assets/device/schema.ts` |
| Sensor schema + ID | `src/lib/iiot/schemas/assets/sensor/schema.ts` |
| All branded identifiers | `src/lib/iiot/schemas/identifiers.ts` |
| Enterprise state graph | `src/lib/iiot/machines/graphs/enterprise-graph.ts` |
| Site state graph | `src/lib/iiot/machines/graphs/site-graph.ts` |
| Area state graph | `src/lib/iiot/machines/graphs/area-graph.ts` |
| Plant state graph | `src/lib/iiot/machines/graphs/plant-graph.ts` |
| Line state graph | `src/lib/iiot/machines/graphs/line-graph.ts` |
| WorkCell state graph | `src/lib/iiot/machines/graphs/workcell-graph.ts` |
| Machine state graph | `src/lib/iiot/machines/graphs/machine-asset-graph.ts` |
| Device state graph | `src/lib/iiot/machines/graphs/device-graph.ts` |
| Sensor state graph | `src/lib/iiot/machines/graphs/sensor-graph.ts` |
| Alarm state graph (ISA-18.2) | `src/lib/iiot/machines/graphs/alarm-state-graph.ts` |
| Work Order state graph | `src/lib/iiot/machines/graphs/work-order-graph.ts` |
| Equipment state graph (OEE) | `src/lib/iiot/machines/graphs/equipment-state-graph.ts` |
| Graph index (all exports) | `src/lib/iiot/machines/graphs/index.ts` |
| Entity handlers layer | `src/lib/iiot/entity/EntityStack.ts` |
| Alarm entity handler | `src/lib/iiot/entity/AlarmEntity.ts` |
| WorkOrder entity handler | `src/lib/iiot/entity/WorkOrderEntity.ts` |
| EquipmentState entity handler | `src/lib/iiot/entity/EquipmentStateEntity.ts` |
| Sensor readings schema | `src/lib/iiot/schemas/readings.ts` |
| Ingestion pipeline | `src/lib/iiot/adapters/ingestion-service.ts` |
| ChannelService | `src/lib/streams/constructs/ChannelService.ts` |
| Batch events (ISA-88) | `src/lib/iiot/schemas/events/regulatory/batch-events.ts` |
| Quality events | `src/lib/iiot/schemas/events/regulatory/quality-events.ts` |
| Operator events | `src/lib/iiot/schemas/events/regulatory/operator-events.ts` |
| Approval events | `src/lib/iiot/schemas/events/operational/approval-events.ts` |

---

## Bibliography

- [ISA-95-1] ANSI/ISA-95.00.01-2010. Enterprise-Control System Integration, Part 1: Models and Terminology.
- [ISA-18-2] ANSI/ISA-18.2-2016. Management of Alarm Systems for the Process Industries.
- [ISA-95-1] IEC 62264-1:2013. Enterprise-control system integration -- Part 1: Models and terminology.
- [FDA-CFR11] FDA 21 CFR Part 11. Electronic Records; Electronic Signatures.
- [EFFECT-CLUSTER] Effect-TS @effect/cluster documentation. Entity sharding and Machine composition.
- [RFC-CONSISTENCY] TMNL-RFC-001 Section: Consistency Guarantees & Failure Modes.
- [NATS-SUBJECTS] NATS.io Subject-Based Messaging documentation.
