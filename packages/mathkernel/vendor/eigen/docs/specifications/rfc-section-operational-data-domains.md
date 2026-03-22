# RFC-001 Section: Operational Data Domains

```
Section:       Operational Data Domains — BOM, Routing, Quality, Scheduling, Energy, Inventory
RFC:           001 — Entity Lifecycle Event Distribution for Metropolitan-Scale IIoT
Status:        DRAFT (Revision 1)
Author:        data-analyst (Val)
Created:       2026-02-12
Source Data:   ISA-95/IEC 62264, B2MML V0700, ISO 7870, ISO 22514, ISO 50001,
               AS9102, AIAG SPC Manual, ISA-88, IPC-2581
Bibliography:  docs/specifications/bibliography.md
```

<!-- INTEGRATION NOTES (for RFC assembly)
- This section is NEW content — does not replace any existing RFC-001 section.
- Should be placed AFTER the equipment hierarchy sections (entity schemas, state machines)
  and BEFORE the regulatory/compliance sections.
- Cross-references: rfc-section-competitive-analysis.md (Gap G-1 event sourcing,
  Gap G-2 reactive hierarchy), rfc-section-effect-architecture.md (Effect Schema patterns),
  rfc-section-two-domain-consistency.md (T3/T4 temporal tiers apply to scheduling),
  rfc-section-multi-tenant-network.md (cross-org BOM sharing, commons inventory),
  rfc-section-introduction.md (Section 1.2 metropolitan-scale manufacturing).
- Dependencies: Equipment hierarchy schemas MUST exist before these operational domains
  reference MachineId, LineId, WorkCellId, etc.
- All proposed schemas use Effect Schema patterns matching the existing codebase:
  Schema.TaggedClass, Schema.brand(), Schema.Literal, Schema.optionalWith({ as: 'Option' }).
- Pending peer review: effect-specialist (Schema patterns), process-analyst (ISA-95 alignment).
-->

---

TMNL covers the equipment hierarchy (Enterprise through Sensor) and three event-sourced entities (Alarm, WorkOrder, EquipmentState). It does not yet cover the six operational data domains that manufacturers actually run their businesses on. This section specifies those domains.

---

## Table of Contents

1. [Gap Analysis Matrix](#1-gap-analysis-matrix)
2. [ISA-95 Level Mapping](#2-isa-95-level-mapping)
3. [Bill of Materials (BOM)](#3-bill-of-materials-bom)
4. [Routing / Process Plan](#4-routing--process-plan)
5. [Quality / SPC](#5-quality--spc)
6. [Scheduling / Capacity Planning](#6-scheduling--capacity-planning)
7. [Energy Management](#7-energy-management)
8. [Inventory / WIP Tracking](#8-inventory--wip-tracking)
9. [Cross-Domain Integration Map](#9-cross-domain-integration-map)
10. [Event Sourcing Strategy](#10-event-sourcing-strategy)
11. [Commons Implications](#11-commons-implications)
12. [Codebase Grounding](#12-codebase-grounding)
13. [Implementation Priority](#13-implementation-priority)
14. [References](#14-references)

---

## 1. Gap Analysis Matrix

The current TMNL entity schema covers the ISA-95 equipment hierarchy and three operational entities. Six critical domains remain unspecified.

| Domain | Current Coverage | Gap Severity | Proposed Entities | Schema Complexity | Dependencies |
|--------|-----------------|--------------|-------------------|-------------------|--------------|
| **Bill of Materials** | None | **Critical** — Cannot manufacture without knowing what goes into a product | `Part`, `BomHeader`, `BomLine`, `PartRevision` | Medium — multi-level tree with revision control | None (foundational) |
| **Routing / Process Plan** | Partial — WorkOrder exists but has no operation sequence | **Critical** — Cannot schedule or track production steps | `Routing`, `RoutingOperation`, `WorkCenter` | Medium — DAG of operations linked to BOM | BOM (material requirements per operation) |
| **Quality / SPC** | None — Sensor thresholds exist but no statistical analysis | **High** — Quality is the #1 regulatory concern (FDA, AS9102, IATF) | `ControlChart`, `SpcSample`, `InspectionRecord`, `NonConformance`, `CapaAction` | High — statistical models, regulatory workflows | Routing (inspection points), Sensor (data source) |
| **Scheduling** | None — WorkOrder has no time dimension | **High** — Manufacturers cannot plan capacity without scheduling | `ProductionSchedule`, `ScheduledJob`, `CapacitySlot` | Medium — temporal model with constraint satisfaction | Routing (operation durations), Equipment (availability) |
| **Energy Management** | Partial — Device has `ratedPower`/`powerUnit` fields | **Medium** — Energy is top-3 manufacturing cost, ISO 50001 | `EnergyReading`, `EnergyBaseline`, `EnergyCostAllocation` | Medium — time-series with hierarchical aggregation | Machine/Line (metering points), Scheduling (demand response) |
| **Inventory / WIP** | None | **High** — Cannot track material flow without inventory | `InventoryLocation`, `InventoryLot`, `MaterialMovement`, `WipSnapshot` | Medium — location + lot + movement event log | BOM (material consumption), Routing (WIP position) |

**Gap severity legend:**
- **Critical** — System cannot function as a manufacturing platform without this domain
- **High** — Domain is required for regulatory compliance or core operational visibility
- **Medium** — Domain provides significant value but can be deferred to Phase 2

---

## 2. ISA-95 Level Mapping

Each missing domain maps to specific ISA-95 levels. The current TMNL implementation covers Levels 0-2 (sensing/control) and fragments of Level 3 (work orders). The gap is concentrated at **Level 3 (MES/MOM)** and the **Level 3-4 boundary**.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Level 4 — Business Planning (ERP)                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐              │
│  │ Engineering  │  │  Master      │  │  Financial    │              │
│  │ BOM (EBOM)  │  │  Scheduling  │  │  Cost Alloc.  │              │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘              │
│─────────┼────────────────┼───────────────────┼──── Level 3/4 ──────│
│  Level 3 — Manufacturing Operations Management (MES/MOM)            │
│  ┌──────┴──────┐  ┌──────┴───────┐  ┌───────┴───────┐              │
│  │ Mfg BOM     │  │  Detailed    │  │  Energy       │              │
│  │ + Routing   │  │  Scheduling  │  │  Monitoring   │              │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘              │
│  ┌──────┴──────┐  ┌──────┴───────┐  ┌───────┴───────┐              │
│  │ Quality/SPC │  │  WIP/        │  │  Inventory    │              │
│  │ + NCR/CAPA  │  │  Inventory   │  │  Tracking     │              │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘              │
│─────────┼────────────────┼───────────────────┼──── Level 2/3 ──────│
│  Level 2 — Supervisory Control (SCADA)         [COVERED]            │
│  Level 1 — PLC/DCS Control                     [COVERED]            │
│  Level 0 — Physical Process (Sensors/Devices)  [COVERED]            │
└─────────────────────────────────────────────────────────────────────┘
```

| ISA-95 Level | Current TMNL Coverage | Missing Domain | B2MML Object Model |
|---|---|---|---|
| Level 4 → 3 | WorkOrder (partial) | Engineering BOM, Master Schedule | `ProductDefinition`, `ProductionSchedule` |
| Level 3 | WorkOrder lifecycle | Manufacturing BOM, Routing, Quality, WIP | `ProcessSegment`, `ProductSegment`, `QualityTestSpec` |
| Level 3 → 2 | EquipmentState, Alarm | Energy monitoring, SPC data collection | `EquipmentCapabilityTest`, `ResourceUse` |
| Level 2 | Area, Plant, Line, WorkCell | Scheduling capacity model | `EquipmentActual`, `EquipmentCapability` |
| Level 1 | Machine | Per-machine energy metering | N/A (below B2MML scope) |
| Level 0 | Device, Sensor | Sensor → SPC bridge | N/A |

---

## 3. Bill of Materials (BOM)

### 3.1 Domain Overview

A Bill of Materials defines the complete list of raw materials, components, sub-assemblies, and assemblies required to manufacture a product. Three BOM types serve different audiences:

| BOM Type | Owner | Purpose | Example |
|----------|-------|---------|---------|
| **Engineering BOM (EBOM)** | Engineering | Design intent — what the product IS | CAD-driven, includes all design options |
| **Manufacturing BOM (MBOM)** | Manufacturing | How the product is BUILT — includes process materials, consumables | Adds adhesives, coolant, packaging |
| **Service BOM (SBOM)** | Field Service | How the product is MAINTAINED — replaceable units | Groups by field-replaceable modules |

For TMNL's metropolitan-scale commons, the **Manufacturing BOM** is the primary entity. It bridges the gap between ERP product definitions (Level 4) and shop-floor execution (Level 3).

### 3.2 ISA-95/B2MML Alignment

In B2MML, the BOM maps to the **ProductDefinition** object model [ISA-95-2]. The `BillOfMaterialID` within a `ProductDefinition` identifies each material needed for production. Each material entry in the manufacturing bill corresponds to material consumption records tracked at the process segment level.

Key B2MML mappings:
- `ProductDefinition` → `BomHeader`
- `ProductSegment.MaterialSpecification` → `BomLine`
- `MaterialDefinition` → `Part`
- `MaterialLot` → links to Inventory domain

### 3.3 Proposed Effect Schemas

```typescript
// ─────────────────────────────────────────────────────────────────────
// Branded Identifiers
// ─────────────────────────────────────────────────────────────────────

/** Part identifier. Format: 'PRT-{slug}' */
export const PartId = Schema.String.pipe(
  Schema.pattern(/^PRT-[a-zA-Z0-9-]+$/),
  Schema.brand('PartId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/PartId',
    description: 'Part/material identifier with PRT- prefix',
  })
)
export type PartId = typeof PartId.Type

export const makePartId = (slug: string): PartId => `PRT-${slug}` as PartId

/** BOM Header identifier. Format: 'BOM-{slug}' */
export const BomId = Schema.String.pipe(
  Schema.pattern(/^BOM-[a-zA-Z0-9-]+$/),
  Schema.brand('BomId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/BomId',
    description: 'Bill of Materials identifier with BOM- prefix',
  })
)
export type BomId = typeof BomId.Type

export const makeBomId = (slug: string): BomId => `BOM-${slug}` as BomId

/** BOM Line identifier. Format: 'BLN-{slug}' */
export const BomLineId = Schema.String.pipe(
  Schema.pattern(/^BLN-[a-zA-Z0-9-]+$/),
  Schema.brand('BomLineId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/BomLineId',
    description: 'BOM line item identifier with BLN- prefix',
  })
)
export type BomLineId = typeof BomLineId.Type

// ─────────────────────────────────────────────────────────────────────
// Enumerations
// ─────────────────────────────────────────────────────────────────────

/** BOM type classification */
export const BomType = Schema.Literal('engineering', 'manufacturing', 'service')
export type BomType = typeof BomType.Type

/** Part category in ISA-95 material model */
export const PartCategory = Schema.Literal(
  'raw_material',
  'component',
  'sub_assembly',
  'assembly',
  'finished_good',
  'consumable',
  'packaging',
  'tooling'
)
export type PartCategory = typeof PartCategory.Type

/** Unit of measure — extensible set covering common manufacturing units */
export const UnitOfMeasure = Schema.Literal(
  'each', 'kg', 'g', 'lb', 'oz',
  'meter', 'cm', 'mm', 'inch', 'foot',
  'liter', 'ml', 'gallon',
  'sqm', 'sqft',
  'set', 'pair', 'roll', 'sheet'
)
export type UnitOfMeasure = typeof UnitOfMeasure.Type

/** Part lifecycle status */
export const PartStatus = Schema.Literal(
  'draft',
  'active',
  'obsolete',
  'superseded'
).pipe(Schema.annotations({
  identifier: '@gbg/tmnl/iiot/PartStatus',
  description: 'Part lifecycle status',
}))
export type PartStatus = typeof PartStatus.Type

// ─────────────────────────────────────────────────────────────────────
// Part Entity
// ─────────────────────────────────────────────────────────────────────

/**
 * Part Entity — ISA-95 MaterialDefinition
 *
 * Represents a distinct material, component, or product that can appear
 * in a BOM. Parts are the atomic building blocks of manufacturing.
 *
 * B2MML mapping: MaterialDefinition
 */
export class Part extends Schema.TaggedClass<Part>()('Part', {
  id: PartId,
  /** Part number (customer-facing, may differ from id) */
  partNumber: Schema.NonEmptyString,
  /** Human-readable name */
  name: Schema.NonEmptyString,
  /** Current revision (e.g., 'A', 'B', '001') */
  revision: Schema.NonEmptyString,
  /** Part category per ISA-95 material model */
  category: PartCategory,
  /** Lifecycle status */
  status: PartStatus,
  /** Default unit of measure */
  unitOfMeasure: UnitOfMeasure,
  /** Description */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Standard cost per unit (for cost rollup) */
  standardCost: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
  /** Currency code (ISO 4217) */
  currency: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Lead time in hours (for scheduling integration) */
  leadTimeHours: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
  /** Shelf life in days (for perishable materials) */
  shelfLifeDays: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  /** Superseded-by part ID (for obsolete parts) */
  supersededBy: Schema.optionalWith(PartId, { as: 'Option' }),
  /** Owning enterprise */
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  /** Metadata */
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
  /** Created timestamp */
  createdAt: Schema.DateTimeUtc,
  /** Last updated timestamp */
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
}) {
  /** Parts are not equipment — no automation level */
  getAutomationLevel(): null { return null }
  /** Part is active if status is 'active' */
  isActive(): boolean { return this.status === 'active' }
}

// ─────────────────────────────────────────────────────────────────────
// BOM Header Entity
// ─────────────────────────────────────────────────────────────────────

/** BOM lifecycle status */
export const BomStatus = Schema.Literal(
  'draft',
  'released',
  'superseded',
  'obsolete'
).pipe(Schema.annotations({
  identifier: '@gbg/tmnl/iiot/BomStatus',
  description: 'BOM lifecycle status',
}))

/**
 * BomHeader Entity — ISA-95 ProductDefinition
 *
 * The root of a multi-level BOM tree. A BomHeader identifies the
 * finished product or sub-assembly being defined, its revision,
 * and its type (engineering/manufacturing/service).
 *
 * B2MML mapping: ProductDefinition + BillOfMaterialID
 */
export class BomHeader extends Schema.TaggedClass<BomHeader>()('BomHeader', {
  id: BomId,
  /** The part this BOM defines (output product) */
  outputPartId: PartId,
  /** BOM type (engineering/manufacturing/service) */
  bomType: BomType,
  /** BOM revision (independent of part revision) */
  revision: Schema.NonEmptyString,
  /** Lifecycle status */
  status: BomStatus,
  /** Effective date (when this BOM becomes active) */
  effectiveDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  /** Expiration date (when this BOM is superseded) */
  expirationDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  /** Batch size this BOM is optimized for */
  standardBatchSize: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  /** Yield percentage (expected output / theoretical output) */
  expectedYieldPercent: Schema.optionalWith(
    Schema.Number.pipe(Schema.between(0, 100)),
    { as: 'Option' }
  ),
  /** Owning enterprise */
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  /** Description / notes */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
}) {
  isReleased(): boolean { return this.status === 'released' }
}

// ─────────────────────────────────────────────────────────────────────
// BOM Line Entity
// ─────────────────────────────────────────────────────────────────────

/**
 * BomLine Entity — ISA-95 ProductSegment.MaterialSpecification
 *
 * A single line in a BOM representing one material/component
 * and its required quantity. BomLines can reference sub-BOMs
 * (via componentBomId) to create multi-level BOM trees.
 */
export class BomLine extends Schema.TaggedClass<BomLine>()('BomLine', {
  id: BomLineId,
  /** Parent BOM header */
  bomId: BomId,
  /** Line sequence number (display order) */
  lineNumber: Schema.Number.pipe(Schema.int(), Schema.positive()),
  /** Component part */
  componentPartId: PartId,
  /** Quantity required per parent unit */
  quantityPer: Schema.Number.pipe(Schema.positive()),
  /** Unit of measure for this line */
  unitOfMeasure: UnitOfMeasure,
  /** Scrap factor (percentage — e.g., 0.05 = 5% scrap allowance) */
  scrapFactor: Schema.optionalWith(
    Schema.Number.pipe(Schema.between(0, 1)),
    { as: 'Option' }
  ),
  /** Reference to child BOM (for multi-level BOM — recursive) */
  componentBomId: Schema.optionalWith(BomId, { as: 'Option' }),
  /** Which routing operation consumes this material (links BOM→Routing) */
  operationId: Schema.optionalWith(RoutingOperationId, { as: 'Option' }),
  /** Reference designators (e.g., 'R1,R2,R3' for PCB resistors) */
  referenceDesignators: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Whether this is a phantom/blow-through item (not stocked) */
  isPhantom: Schema.optionalWith(Schema.Boolean, { as: 'Option' }),
  /** Item-level notes */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
}) {
  /** Effective quantity including scrap allowance */
  effectiveQuantity(): number {
    const scrap = this.scrapFactor._tag === 'Some' ? this.scrapFactor.value : 0
    return this.quantityPer * (1 + scrap)
  }
}
```

### 3.4 Multi-Level BOM Resolution

Multi-level BOMs form a directed acyclic graph (DAG). Resolution (explosion) traverses from the finished good down through sub-assemblies to raw materials:

```
Finished Good (BOM-widget-v2)
├── BomLine: 1x Sub-Assembly A (BOM-sub-a-v1)
│   ├── BomLine: 2x Component X (PRT-bolt-m6)
│   ├── BomLine: 1x Component Y (PRT-bracket-steel)
│   └── BomLine: 0.5L Adhesive (PRT-adhesive-3m)     ← consumable
├── BomLine: 4x Component Z (PRT-screw-m4)
└── BomLine: 1x Packaging Kit (BOM-pkg-standard)      ← phantom
    ├── BomLine: 1x Box (PRT-box-medium)
    └── BomLine: 1x Foam Insert (PRT-foam-medium)
```

**Phantom items** (isPhantom = true) are not stocked — they exist only to group sub-components and are "blown through" during MRP explosion. This is critical for small shops that cannot afford to stock intermediate assemblies.

### 3.5 Commons Implications

In a metropolitan commons, BOMs enable:
- **Shared part catalogs** — PRT-bolt-m6 is the same bolt across all shops, enabling bulk purchasing
- **Subcontracting** — Shop A shares an MBOM with Shop B for overflow production
- **Cost benchmarking** — Anonymous BOM cost rollups reveal material cost patterns across the commons

---

## 4. Routing / Process Plan

### 4.1 Domain Overview

A **routing** (also called a process plan or operations sheet) defines the sequence of manufacturing operations required to transform raw materials into a finished product. Each operation specifies:
- Which work center (machine, cell, or line) performs the work
- Setup time and run time per unit
- Tooling and fixtures required
- Quality inspection points

The routing is the bridge between the BOM (what materials are needed) and the schedule (when operations execute). Without routings, TMNL's WorkOrder entity is a lifecycle wrapper with no knowledge of the actual manufacturing steps inside it.

### 4.2 ISA-95/B2MML Alignment

In ISA-95 Part 2 [ISA-95-2], routings map to **Process Segment** definitions. Each Process Segment defines resources (personnel, equipment, material) needed for a segment of production. B2MML's `ProcessSegment` schema includes:
- `SegmentDependency` — sequencing between operations
- `EquipmentSpecification` — which equipment is needed
- `MaterialSpecification` — which materials are consumed (links to BOM)
- `PersonnelSpecification` — operator requirements

### 4.3 Proposed Effect Schemas

```typescript
// ─────────────────────────────────────────────────────────────────────
// Branded Identifiers
// ─────────────────────────────────────────────────────────────────────

/** Routing identifier. Format: 'RTG-{slug}' */
export const RoutingId = Schema.String.pipe(
  Schema.pattern(/^RTG-[a-zA-Z0-9-]+$/),
  Schema.brand('RoutingId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/RoutingId',
    description: 'Routing/process plan identifier with RTG- prefix',
  })
)
export type RoutingId = typeof RoutingId.Type

export const makeRoutingId = (slug: string): RoutingId => `RTG-${slug}` as RoutingId

/** Routing Operation identifier. Format: 'ROP-{slug}' */
export const RoutingOperationId = Schema.String.pipe(
  Schema.pattern(/^ROP-[a-zA-Z0-9-]+$/),
  Schema.brand('RoutingOperationId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/RoutingOperationId',
    description: 'Routing operation identifier with ROP- prefix',
  })
)
export type RoutingOperationId = typeof RoutingOperationId.Type

/** Work Center identifier. Format: 'WKC-{slug}' */
export const WorkCenterId = Schema.String.pipe(
  Schema.pattern(/^WKC-[a-zA-Z0-9-]+$/),
  Schema.brand('WorkCenterId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/WorkCenterId',
    description: 'Work center identifier with WKC- prefix',
  })
)
export type WorkCenterId = typeof WorkCenterId.Type

// ─────────────────────────────────────────────────────────────────────
// Enumerations
// ─────────────────────────────────────────────────────────────────────

/** Operation type classification */
export const OperationType = Schema.Literal(
  'fabrication',
  'assembly',
  'machining',
  'welding',
  'painting',
  'inspection',
  'testing',
  'packaging',
  'heat_treatment',
  'cleaning',
  'other'
)
export type OperationType = typeof OperationType.Type

/** Routing status */
export const RoutingStatus = Schema.Literal(
  'draft',
  'released',
  'superseded',
  'obsolete'
)
export type RoutingStatus = typeof RoutingStatus.Type

/** Dependency type between operations */
export const DependencyType = Schema.Literal(
  'finish_to_start',   // Most common: Op B starts after Op A finishes
  'start_to_start',    // Op B can start when Op A starts
  'finish_to_finish',  // Op B finishes when Op A finishes
  'start_to_finish'    // Rare: Op B finishes when Op A starts
)
export type DependencyType = typeof DependencyType.Type

// ─────────────────────────────────────────────────────────────────────
// Work Center Entity
// ─────────────────────────────────────────────────────────────────────

/**
 * WorkCenter — ISA-95 Work Center / Resource
 *
 * A logical grouping of one or more machines/cells that can
 * perform a class of operations. Work centers bridge the gap
 * between the equipment hierarchy (Machine, WorkCell, Line)
 * and the routing model.
 *
 * A single Machine may belong to multiple WorkCenters (e.g.,
 * a CNC mill is both a "Milling" and "Drilling" work center).
 *
 * B2MML mapping: EquipmentClass + EquipmentCapability
 */
export class WorkCenter extends Schema.TaggedClass<WorkCenter>()('WorkCenter', {
  id: WorkCenterId,
  name: Schema.NonEmptyString,
  /** Description of capabilities */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Efficiency factor (0-1) — accounts for breaks, minor stops */
  efficiencyFactor: Schema.optionalWith(
    Schema.Number.pipe(Schema.between(0, 1)),
    { as: 'Option' }
  ),
  /** Number of parallel resources (machines) in this center */
  parallelCapacity: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
    { as: 'Option' }
  ),
  /** Cost per hour for this work center */
  costPerHour: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
  /** Currency code */
  currency: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Equipment references — links to existing ISA-95 hierarchy */
  machineIds: Schema.optionalWith(Schema.Array(MachineId), { as: 'Option' }),
  workCellIds: Schema.optionalWith(Schema.Array(WorkCellId), { as: 'Option' }),
  lineIds: Schema.optionalWith(Schema.Array(LineId), { as: 'Option' }),
  /** Plant where this work center is located */
  plantId: Schema.optionalWith(PlantId, { as: 'Option' }),
  /** Owning enterprise */
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
  createdAt: Schema.DateTimeUtc,
}) {}

// ─────────────────────────────────────────────────────────────────────
// Routing Entity
// ─────────────────────────────────────────────────────────────────────

/**
 * Routing Entity — ISA-95 ProcessSegment collection
 *
 * The header of a process plan. Links a specific part (via BOM)
 * to a sequence of operations. Multiple routings may exist for
 * the same part (alternate routings for different equipment).
 */
export class Routing extends Schema.TaggedClass<Routing>()('Routing', {
  id: RoutingId,
  /** Part this routing manufactures */
  partId: PartId,
  /** BOM consumed by this routing */
  bomId: Schema.optionalWith(BomId, { as: 'Option' }),
  /** Routing revision */
  revision: Schema.NonEmptyString,
  /** Lifecycle status */
  status: RoutingStatus,
  /** Whether this is the primary (default) routing for the part */
  isPrimary: Schema.Boolean,
  /** Description */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Total planned cycle time in minutes (sum of operations) */
  totalCycleTimeMinutes: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
  /** Enterprise owning this routing */
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
}) {
  isReleased(): boolean { return this.status === 'released' }
}

// ─────────────────────────────────────────────────────────────────────
// Routing Operation Entity
// ─────────────────────────────────────────────────────────────────────

/**
 * RoutingOperation — ISA-95 ProcessSegment
 *
 * A single step in a routing. Each operation specifies the work
 * center, time requirements, and material consumption.
 *
 * B2MML mapping: ProcessSegment
 */
export class RoutingOperation extends Schema.TaggedClass<RoutingOperation>()('RoutingOperation', {
  id: RoutingOperationId,
  /** Parent routing */
  routingId: RoutingId,
  /** Sequence number (execution order) */
  operationNumber: Schema.Number.pipe(Schema.int(), Schema.positive()),
  /** Operation name (e.g., 'Mill slot', 'Deburr', 'Final QC') */
  name: Schema.NonEmptyString,
  /** Operation type */
  operationType: OperationType,
  /** Assigned work center */
  workCenterId: WorkCenterId,
  /** Setup time in minutes (one-time per batch) */
  setupTimeMinutes: Schema.Number.pipe(Schema.nonNegative()),
  /** Run time per unit in minutes */
  runTimePerUnitMinutes: Schema.Number.pipe(Schema.nonNegative()),
  /** Teardown/cleanup time in minutes */
  teardownTimeMinutes: Schema.optionalWith(
    Schema.Number.pipe(Schema.nonNegative()),
    { as: 'Option' }
  ),
  /** Queue/wait time before operation in minutes */
  queueTimeMinutes: Schema.optionalWith(
    Schema.Number.pipe(Schema.nonNegative()),
    { as: 'Option' }
  ),
  /** Move time to next operation in minutes */
  moveTimeMinutes: Schema.optionalWith(
    Schema.Number.pipe(Schema.nonNegative()),
    { as: 'Option' }
  ),
  /** Tooling requirements (free text or coded) */
  toolingRequirements: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Whether this operation is a quality inspection point */
  isInspectionPoint: Schema.optionalWith(Schema.Boolean, { as: 'Option' }),
  /** Dependencies on prior operations */
  dependsOn: Schema.optionalWith(
    Schema.Array(Schema.Struct({
      operationId: RoutingOperationId,
      dependencyType: DependencyType,
      lagMinutes: Schema.optionalWith(Schema.Number, { as: 'Option' }),
    })),
    { as: 'Option' }
  ),
  /** Instructions (free text, markdown, or reference to document) */
  instructions: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Description */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
}) {
  /** Total time for a batch of N units */
  batchTimeMinutes(batchSize: number): number {
    const teardown = this.teardownTimeMinutes._tag === 'Some' ? this.teardownTimeMinutes.value : 0
    return this.setupTimeMinutes + (this.runTimePerUnitMinutes * batchSize) + teardown
  }
}
```

### 4.4 BOM-Routing Link

The critical integration point is `BomLine.operationId` — each BOM line can specify which routing operation consumes that material. This enables:
- **Material staging** — Know which materials to deliver to which work center before each operation
- **WIP tracking** — Materials consumed at Operation 20 are deducted from inventory when that operation completes
- **Costing** — Material cost + labor cost per operation = true product cost

```
BOM (BOM-widget-v2)                    Routing (RTG-widget-v2)
├── BomLine: Steel Bar ─────────────── → Op 10: Cut to Length
├── BomLine: Brass Insert ──────────── → Op 20: Mill Slot
├── BomLine: Adhesive ─────────────── → Op 30: Bond Assembly
└── BomLine: Packaging ────────────── → Op 50: Package
                                        Op 40: Inspect (no material)
```

---

## 5. Quality / SPC

### 5.1 Domain Overview

Quality management in manufacturing spans three distinct concerns:

1. **Statistical Process Control (SPC)** — Real-time monitoring of process variation using control charts. Determines whether a process is in statistical control (only common-cause variation) or out of control (special-cause variation present).

2. **Process Capability** — Quantifies whether a process can consistently produce output within specification limits. Key indices: Cp (potential), Cpk (actual), Pp (preliminary potential), Ppk (preliminary actual) [ISO-22514].

3. **Quality Events** — Non-conformances (NCR), Corrective/Preventive Actions (CAPA), First Article Inspections (FAI per AS9102 for aerospace), dimensional inspection results.

### 5.2 Standards Alignment

| Standard | Scope | TMNL Relevance |
|----------|-------|----------------|
| **ISO 7870** [ISO-7870] | Control chart methodology — Shewhart, CUSUM, EWMA | Control chart type definitions, UCL/LCL calculation |
| **ISO 22514** [ISO-22514] | Process capability and performance — Cp, Cpk, Pp, Ppk | Capability indices, minimum sample sizes |
| **AIAG SPC Manual** [AIAG-SPC] | Automotive SPC reference (IATF 16949) | Chart types, rational subgrouping |
| **AS9102** [AS9102] | First Article Inspection for aerospace | FAI schema, characteristic accountability |
| **FDA 21 CFR Part 11** [FDA-CFR11] | Electronic records (pharma) | Audit trail on quality records (already in WorkOrder) |

### 5.3 Proposed Effect Schemas

```typescript
// ─────────────────────────────────────────────────────────────────────
// Branded Identifiers
// ─────────────────────────────────────────────────────────────────────

export const ControlChartId = Schema.String.pipe(
  Schema.pattern(/^CCH-[a-zA-Z0-9-]+$/),
  Schema.brand('ControlChartId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/ControlChartId',
    description: 'Control chart identifier with CCH- prefix',
  })
)
export type ControlChartId = typeof ControlChartId.Type

export const SpcSampleId = Schema.String.pipe(
  Schema.pattern(/^SPC-[a-zA-Z0-9-]+$/),
  Schema.brand('SpcSampleId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/SpcSampleId',
    description: 'SPC sample/subgroup identifier with SPC- prefix',
  })
)
export type SpcSampleId = typeof SpcSampleId.Type

export const InspectionId = Schema.String.pipe(
  Schema.pattern(/^INS-[a-zA-Z0-9-]+$/),
  Schema.brand('InspectionId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/InspectionId',
    description: 'Inspection record identifier with INS- prefix',
  })
)
export type InspectionId = typeof InspectionId.Type

export const NonConformanceId = Schema.String.pipe(
  Schema.pattern(/^NCR-[a-zA-Z0-9-]+$/),
  Schema.brand('NonConformanceId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/NonConformanceId',
    description: 'Non-conformance report identifier with NCR- prefix',
  })
)
export type NonConformanceId = typeof NonConformanceId.Type

export const CapaId = Schema.String.pipe(
  Schema.pattern(/^CAP-[a-zA-Z0-9-]+$/),
  Schema.brand('CapaId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/CapaId',
    description: 'Corrective/preventive action identifier with CAP- prefix',
  })
)
export type CapaId = typeof CapaId.Type

// ─────────────────────────────────────────────────────────────────────
// Enumerations
// ─────────────────────────────────────────────────────────────────────

/** Control chart type per ISO 7870 */
export const ControlChartType = Schema.Literal(
  'xbar_r',          // X-bar and R (mean + range) — subgroup size 2-10
  'xbar_s',          // X-bar and S (mean + std dev) — subgroup size > 10
  'individuals_mr',  // Individual values + Moving Range
  'p_chart',         // Proportion defective (attribute data)
  'np_chart',        // Count defective (constant sample size)
  'c_chart',         // Defects per unit (constant opportunity)
  'u_chart',         // Defects per unit (variable opportunity)
  'cusum',           // Cumulative sum (detects small shifts)
  'ewma'             // Exponentially weighted moving average
).pipe(Schema.annotations({
  identifier: '@gbg/tmnl/iiot/ControlChartType',
  description: 'SPC control chart type per ISO 7870',
}))
export type ControlChartType = typeof ControlChartType.Type

/** Inspection disposition */
export const InspectionDisposition = Schema.Literal(
  'accept',
  'reject',
  'conditional_accept',
  'rework',
  'scrap',
  'pending'
)
export type InspectionDisposition = typeof InspectionDisposition.Type

/** NCR severity */
export const NcrSeverity = Schema.Literal('minor', 'major', 'critical')
export type NcrSeverity = typeof NcrSeverity.Type

/** NCR status (event-sourced candidate) */
export const NcrStatus = Schema.Literal(
  'open',
  'under_investigation',
  'disposition_pending',
  'rework',
  'scrap',
  'use_as_is',
  'closed'
)
export type NcrStatus = typeof NcrStatus.Type

/** CAPA status (event-sourced candidate) */
export const CapaStatus = Schema.Literal(
  'initiated',
  'root_cause_analysis',
  'action_planned',
  'action_in_progress',
  'verification',
  'closed_effective',
  'closed_ineffective'
)
export type CapaStatus = typeof CapaStatus.Type

// ─────────────────────────────────────────────────────────────────────
// Control Chart Definition
// ─────────────────────────────────────────────────────────────────────

/**
 * ControlChart — SPC Control Chart Definition
 *
 * Defines a control chart for a specific characteristic at a specific
 * process point. The chart definition is the configuration; SpcSample
 * entities hold the actual measurement data.
 *
 * The chart links to either a Sensor (for automatic data collection)
 * or an inspection point on a Routing (for manual measurement).
 */
export class ControlChart extends Schema.TaggedClass<ControlChart>()('ControlChart', {
  id: ControlChartId,
  /** Name of the characteristic being monitored */
  characteristicName: Schema.NonEmptyString,
  /** Chart type */
  chartType: ControlChartType,
  /** Part being monitored */
  partId: PartId,
  /** Routing operation where measurement occurs */
  operationId: Schema.optionalWith(RoutingOperationId, { as: 'Option' }),
  /** Sensor providing automatic measurements */
  sensorId: Schema.optionalWith(SensorId, { as: 'Option' }),
  /** Machine where process runs */
  machineId: Schema.optionalWith(MachineId, { as: 'Option' }),
  /** Upper Specification Limit */
  usl: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Lower Specification Limit */
  lsl: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Target / Nominal value */
  target: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Measurement unit */
  unit: Schema.optionalWith(MeasurementUnit, { as: 'Option' }),
  /** Subgroup size (for xbar_r, xbar_s) */
  subgroupSize: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), { as: 'Option' }),
  /** Sampling frequency description (e.g., 'every 30 minutes', 'every 50 parts') */
  samplingFrequency: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Upper Control Limit (calculated from data, not specification) */
  ucl: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Center Line */
  cl: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Lower Control Limit */
  lcl: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Current Cp value */
  cp: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Current Cpk value */
  cpk: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Current Pp value (preliminary) */
  pp: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Current Ppk value (preliminary) */
  ppk: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Whether the chart is currently in statistical control */
  inControl: Schema.optionalWith(Schema.Boolean, { as: 'Option' }),
  /** Enterprise */
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
}) {
  /**
   * Process is capable if Cpk >= 1.33 (industry minimum).
   * Returns null if Cpk not calculated.
   */
  isCapable(): boolean | null {
    if (this.cpk._tag === 'None') return null
    return this.cpk.value >= 1.33
  }
}

// ─────────────────────────────────────────────────────────────────────
// SPC Sample / Subgroup
// ─────────────────────────────────────────────────────────────────────

/**
 * SpcSample — Individual measurement subgroup
 *
 * A single data point (or subgroup of data points) on a control chart.
 * For X-bar/R charts, a sample contains multiple measurements (subgroup).
 * For individuals charts, a sample contains one measurement.
 */
export class SpcSample extends Schema.TaggedClass<SpcSample>()('SpcSample', {
  id: SpcSampleId,
  /** Parent control chart */
  controlChartId: ControlChartId,
  /** Measurement timestamp */
  measuredAt: Schema.DateTimeUtc,
  /** Individual measurement values in this subgroup */
  values: Schema.Array(Schema.Number),
  /** Subgroup mean (calculated) */
  mean: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Subgroup range (calculated) */
  range: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Subgroup standard deviation (calculated) */
  standardDeviation: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Whether this subgroup triggered an out-of-control signal */
  outOfControl: Schema.Boolean,
  /** Which Western Electric rule was violated (if any) */
  violatedRule: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Operator who took the measurement */
  operatorId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Work order being produced */
  workOrderId: Schema.optionalWith(WorkOrderId, { as: 'Option' }),
  /** Lot/batch being measured */
  lotId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
}) {}

// ─────────────────────────────────────────────────────────────────────
// Non-Conformance Report (NCR)
// ─────────────────────────────────────────────────────────────────────

/**
 * NonConformance — NCR Entity (Event-Sourced Candidate)
 *
 * Records a quality deviation — when a product or process fails to
 * meet specifications. NCRs drive disposition decisions (rework,
 * scrap, use-as-is) and may trigger CAPA actions.
 *
 * EVENT SOURCING CANDIDATE: NCR status transitions require audit
 * trail for FDA 21 CFR Part 11 and AS9100 compliance.
 */
export class NonConformance extends Schema.TaggedClass<NonConformance>()('NonConformance', {
  id: NonConformanceId,
  /** Part that failed */
  partId: PartId,
  /** Which routing operation discovered the defect */
  operationId: Schema.optionalWith(RoutingOperationId, { as: 'Option' }),
  /** Work order context */
  workOrderId: Schema.optionalWith(WorkOrderId, { as: 'Option' }),
  /** Machine that produced the defect */
  machineId: Schema.optionalWith(MachineId, { as: 'Option' }),
  /** Severity classification */
  severity: NcrSeverity,
  /** Current status */
  status: NcrStatus,
  /** Defect description */
  defectDescription: Schema.NonEmptyString,
  /** Quantity affected */
  quantityAffected: Schema.Number.pipe(Schema.int(), Schema.positive()),
  /** Lot/batch affected */
  lotId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Root cause (populated during investigation) */
  rootCause: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Disposition decision */
  disposition: Schema.optionalWith(InspectionDisposition, { as: 'Option' }),
  /** Cost of quality (scrap cost + rework cost) */
  costOfQuality: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
  /** CAPA triggered by this NCR */
  capaId: Schema.optionalWith(CapaId, { as: 'Option' }),
  /** Reported by */
  reportedBy: Schema.NonEmptyString,
  /** Enterprise */
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
}) {}

// ─────────────────────────────────────────────────────────────────────
// Corrective and Preventive Action (CAPA)
// ─────────────────────────────────────────────────────────────────────

/**
 * CapaAction — CAPA Entity (Event-Sourced Candidate)
 *
 * Tracks corrective or preventive actions arising from NCRs,
 * audit findings, or SPC out-of-control signals. CAPA follows
 * a strict lifecycle for regulatory compliance.
 */
export class CapaAction extends Schema.TaggedClass<CapaAction>()('CapaAction', {
  id: CapaId,
  /** Whether this is corrective or preventive */
  capaType: Schema.Literal('corrective', 'preventive'),
  /** Current status */
  status: CapaStatus,
  /** Problem description */
  problemDescription: Schema.NonEmptyString,
  /** Root cause analysis */
  rootCauseAnalysis: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Planned corrective/preventive actions */
  plannedActions: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Due date for action completion */
  dueDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  /** Verification of effectiveness */
  verificationMethod: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** NCR(s) that triggered this CAPA */
  sourceNcrIds: Schema.optionalWith(Schema.Array(NonConformanceId), { as: 'Option' }),
  /** Assigned to */
  assignedTo: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Enterprise */
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
}) {}
```

### 5.4 Sensor → SPC Bridge

TMNL already has Sensor entities with threshold checking. The SPC bridge connects sensor readings to control charts:

```
Sensor (SNS-temp-motor-01)
  ↓ readings at sampleRateMs intervals
  ↓
ControlChart (CCH-motor-temp-xbar)
  ↓ aggregated into subgroups
  ↓
SpcSample (SPC-xxx) ← outOfControl flag triggers Alarm
  ↓
NonConformance (NCR-xxx) ← if disposition required
  ↓
CapaAction (CAP-xxx) ← if systemic issue
```

The critical design decision: SPC samples can be populated either **automatically** (from sensor data via ControlChart.sensorId) or **manually** (from operator measurements at ControlChart.operationId inspection points). Both feed the same ControlChart entity.

---

## 6. Scheduling / Capacity Planning

### 6.1 Domain Overview

Production scheduling sits at the ISA-95 Level 3/4 boundary. Level 4 (ERP) generates a **production plan** — a list of products and quantities needed by dates. Level 3 (MES) transforms this into a **detailed schedule** — specific operations on specific equipment at specific times, subject to capacity constraints.

TMNL's existing WorkOrder entity manages the lifecycle (created → approved → started → completed) but has **no time dimension**. A work order knows its status but not when its operations should execute or on which machines.

### 6.2 ISA-95/B2MML Alignment

In B2MML, scheduling maps to `ProductionSchedule` and `OperationsSchedule` object models [ISA-95-4]:
- `ProductionSchedule` — The set of jobs to execute
- `ProductionRequest` — A single scheduled job
- `SegmentRequirement` — Time/resource requirements per operation
- `OperationsPerformance` — Actual vs. planned tracking

### 6.3 Proposed Effect Schemas

```typescript
// ─────────────────────────────────────────────────────────────────────
// Branded Identifiers
// ─────────────────────────────────────────────────────────────────────

export const ScheduleId = Schema.String.pipe(
  Schema.pattern(/^SCH-[a-zA-Z0-9-]+$/),
  Schema.brand('ScheduleId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/ScheduleId',
    description: 'Production schedule identifier with SCH- prefix',
  })
)
export type ScheduleId = typeof ScheduleId.Type

export const ScheduledJobId = Schema.String.pipe(
  Schema.pattern(/^SJB-[a-zA-Z0-9-]+$/),
  Schema.brand('ScheduledJobId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/ScheduledJobId',
    description: 'Scheduled job identifier with SJB- prefix',
  })
)
export type ScheduledJobId = typeof ScheduledJobId.Type

export const CapacitySlotId = Schema.String.pipe(
  Schema.pattern(/^CSL-[a-zA-Z0-9-]+$/),
  Schema.brand('CapacitySlotId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/CapacitySlotId',
    description: 'Capacity slot identifier with CSL- prefix',
  })
)
export type CapacitySlotId = typeof CapacitySlotId.Type

// ─────────────────────────────────────────────────────────────────────
// Enumerations
// ─────────────────────────────────────────────────────────────────────

/** Schedule status */
export const ScheduleStatus = Schema.Literal(
  'draft',
  'published',
  'in_progress',
  'completed',
  'cancelled'
)
export type ScheduleStatus = typeof ScheduleStatus.Type

/** Scheduled job status */
export const ScheduledJobStatus = Schema.Literal(
  'planned',
  'queued',
  'setup',
  'running',
  'completed',
  'delayed',
  'cancelled'
)
export type ScheduledJobStatus = typeof ScheduledJobStatus.Type

/** Scheduling strategy */
export const SchedulingStrategy = Schema.Literal(
  'forward',          // Schedule from earliest start
  'backward',         // Schedule from due date backward
  'bottleneck_first', // Schedule bottleneck resources first
  'priority_based'    // Schedule by job priority
)
export type SchedulingStrategy = typeof SchedulingStrategy.Type

// ─────────────────────────────────────────────────────────────────────
// Production Schedule
// ─────────────────────────────────────────────────────────────────────

/**
 * ProductionSchedule — ISA-95 ProductionSchedule
 *
 * A schedule covering a time horizon (typically a shift, day, or week).
 * Contains a set of ScheduledJobs representing individual work orders
 * or operations assigned to specific resources and time slots.
 */
export class ProductionSchedule extends Schema.TaggedClass<ProductionSchedule>()('ProductionSchedule', {
  id: ScheduleId,
  /** Schedule name (e.g., 'Week 7 - Line A') */
  name: Schema.NonEmptyString,
  /** Status */
  status: ScheduleStatus,
  /** Schedule horizon start */
  horizonStart: Schema.DateTimeUtc,
  /** Schedule horizon end */
  horizonEnd: Schema.DateTimeUtc,
  /** Scheduling strategy used */
  strategy: Schema.optionalWith(SchedulingStrategy, { as: 'Option' }),
  /** Plant this schedule covers */
  plantId: Schema.optionalWith(PlantId, { as: 'Option' }),
  /** Line(s) this schedule covers */
  lineIds: Schema.optionalWith(Schema.Array(LineId), { as: 'Option' }),
  /** Created by (scheduler/user) */
  createdBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Enterprise */
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
}) {
  /** Is schedule active right now? */
  isActive(now: Date): boolean {
    const startMs = Number(this.horizonStart.epochMillis)
    const endMs = Number(this.horizonEnd.epochMillis)
    const nowMs = now.getTime()
    return nowMs >= startMs && nowMs <= endMs && this.status !== 'cancelled'
  }
}

// ─────────────────────────────────────────────────────────────────────
// Scheduled Job (Gantt Bar)
// ─────────────────────────────────────────────────────────────────────

/**
 * ScheduledJob — ISA-95 ProductionRequest + SegmentRequirement
 *
 * Represents a single operation (from a routing) assigned to a specific
 * work center with planned start/end times. The collection of ScheduledJobs
 * for a schedule constitutes the Gantt chart.
 *
 * Each ScheduledJob maps 1:1 to a routing operation for a specific
 * work order, placed on a specific resource at a specific time.
 */
export class ScheduledJob extends Schema.TaggedClass<ScheduledJob>()('ScheduledJob', {
  id: ScheduledJobId,
  /** Parent schedule */
  scheduleId: ScheduleId,
  /** Work order this job serves */
  workOrderId: WorkOrderId,
  /** Routing operation being scheduled */
  operationId: RoutingOperationId,
  /** Work center assigned */
  workCenterId: WorkCenterId,
  /** Specific machine (if assigned beyond work center level) */
  machineId: Schema.optionalWith(MachineId, { as: 'Option' }),
  /** Job status */
  status: ScheduledJobStatus,
  /** Planned start time */
  plannedStart: Schema.DateTimeUtc,
  /** Planned end time */
  plannedEnd: Schema.DateTimeUtc,
  /** Actual start time (populated when job starts) */
  actualStart: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  /** Actual end time (populated when job completes) */
  actualEnd: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  /** Batch/lot size for this job */
  quantity: Schema.Number.pipe(Schema.positive()),
  /** Priority (lower = higher priority) */
  priority: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), { as: 'Option' }),
  /** Setup time allocated in minutes */
  setupMinutes: Schema.Number.pipe(Schema.nonNegative()),
  /** Production time allocated in minutes */
  productionMinutes: Schema.Number.pipe(Schema.nonNegative()),
  /** Part being produced */
  partId: Schema.optionalWith(PartId, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
}) {
  /** Deviation from plan in minutes (positive = late) */
  deviationMinutes(): number | null {
    if (this.actualEnd._tag === 'None') return null
    const plannedMs = Number(this.plannedEnd.epochMillis)
    const actualMs = Number(this.actualEnd.value.epochMillis)
    return (actualMs - plannedMs) / 60_000
  }

  /** On-time delivery flag */
  isOnTime(): boolean | null {
    const deviation = this.deviationMinutes()
    if (deviation === null) return null
    return deviation <= 0
  }
}

// ─────────────────────────────────────────────────────────────────────
// Capacity Slot
// ─────────────────────────────────────────────────────────────────────

/**
 * CapacitySlot — Finite capacity time slot
 *
 * Represents available capacity at a work center for a time period.
 * Used by the scheduler to determine where jobs can be placed.
 * Consumed (decremented) as jobs are scheduled.
 */
export class CapacitySlot extends Schema.TaggedClass<CapacitySlot>()('CapacitySlot', {
  id: CapacitySlotId,
  /** Work center this slot belongs to */
  workCenterId: WorkCenterId,
  /** Slot start time */
  slotStart: Schema.DateTimeUtc,
  /** Slot end time */
  slotEnd: Schema.DateTimeUtc,
  /** Total available minutes in this slot */
  availableMinutes: Schema.Number.pipe(Schema.nonNegative()),
  /** Minutes already consumed by scheduled jobs */
  consumedMinutes: Schema.Number.pipe(Schema.nonNegative()),
  /** Whether this slot is blocked (maintenance, shutdown) */
  isBlocked: Schema.Boolean,
  /** Block reason */
  blockReason: Schema.optionalWith(Schema.String, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
}) {
  /** Remaining capacity in minutes */
  remainingMinutes(): number {
    return Math.max(0, this.availableMinutes - this.consumedMinutes)
  }

  /** Utilization percentage (0-100) */
  utilization(): number {
    if (this.availableMinutes === 0) return 0
    return (this.consumedMinutes / this.availableMinutes) * 100
  }
}
```

### 6.4 Schedule ↔ EquipmentState Integration

The scheduling domain integrates with the existing EquipmentState entity:
- **CapacitySlot.isBlocked** is derived from EquipmentState transitions (planned_downtime, unplanned_downtime)
- **ScheduledJob.actualStart** is triggered by EquipmentState transitioning to 'running'
- **Schedule deviation alerts** fire when EquipmentState goes to 'unplanned_downtime' during a ScheduledJob window

---

## 7. Energy Management

### 7.1 Domain Overview

Energy is a top-3 manufacturing cost. ISO 50001 [ISO-50001] provides the management framework; TMNL provides the data infrastructure. The gap is concentrated: Device entities already have `ratedPower` and `powerUnit` fields, but there is no entity for **actual energy readings**, **baselines**, or **cost allocation**.

Key metrics for manufacturing energy management:
- **kWh per unit produced** (Energy Performance Indicator / EnPI)
- **Demand profile** — peak vs. off-peak consumption
- **Power factor** — reactive power efficiency
- **Carbon intensity** — kg CO2e per kWh (grid-dependent)

### 7.2 ISO 50001 Alignment

ISO 50001:2018 requires [ISO-50001-2018]:
1. **Energy review** — Identify significant energy uses (SEUs)
2. **Energy Performance Indicators (EnPIs)** — Metrics normalized to relevant variables
3. **Energy baselines (EnBs)** — Reference period for comparison
4. **Monitoring plan** — What to measure, how often, how to analyze

TMNL maps these requirements to entities:

| ISO 50001 Requirement | TMNL Entity |
|---|---|
| Energy review / SEU identification | Machine + Device (existing) |
| EnPI calculation | EnergyReading + production data |
| Energy baseline | EnergyBaseline |
| Monitoring plan | Sensor (existing) + EnergyReading collection |
| Cost allocation | EnergyCostAllocation |

### 7.3 Proposed Effect Schemas

```typescript
// ─────────────────────────────────────────────────────────────────────
// Branded Identifiers
// ─────────────────────────────────────────────────────────────────────

export const EnergyReadingId = Schema.String.pipe(
  Schema.pattern(/^ENR-[a-zA-Z0-9-]+$/),
  Schema.brand('EnergyReadingId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/EnergyReadingId',
    description: 'Energy reading identifier with ENR- prefix',
  })
)
export type EnergyReadingId = typeof EnergyReadingId.Type

export const EnergyBaselineId = Schema.String.pipe(
  Schema.pattern(/^ENB-[a-zA-Z0-9-]+$/),
  Schema.brand('EnergyBaselineId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/EnergyBaselineId',
    description: 'Energy baseline identifier with ENB- prefix',
  })
)
export type EnergyBaselineId = typeof EnergyBaselineId.Type

// ─────────────────────────────────────────────────────────────────────
// Enumerations
// ─────────────────────────────────────────────────────────────────────

/** Energy source type */
export const EnergySource = Schema.Literal(
  'grid_electricity',
  'solar',
  'natural_gas',
  'diesel',
  'compressed_air',
  'steam',
  'chilled_water',
  'other'
)
export type EnergySource = typeof EnergySource.Type

/** Energy unit */
export const EnergyUnit = Schema.Literal(
  'kwh',           // kilowatt-hours (electricity)
  'mwh',           // megawatt-hours
  'therms',        // natural gas
  'mmbtu',         // million BTU
  'cubic_meters',  // compressed air / gas volume
  'kg_steam',      // steam
  'liters'         // liquid fuels
)
export type EnergyUnit = typeof EnergyUnit.Type

/** Metering level in the hierarchy */
export const MeteringLevel = Schema.Literal(
  'facility',   // Whole-site utility meter
  'area',       // Area submeter
  'line',       // Production line submeter
  'machine',    // Individual machine meter
  'device'      // Individual device (motor, compressor)
)
export type MeteringLevel = typeof MeteringLevel.Type

// ─────────────────────────────────────────────────────────────────────
// Energy Reading Entity
// ─────────────────────────────────────────────────────────────────────

/**
 * EnergyReading — Time-series energy consumption data point
 *
 * Represents a metered energy reading at a specific point in the
 * asset hierarchy. Readings are collected at intervals (15-minute
 * is standard for utility billing reconciliation).
 *
 * Links to the existing Sensor entity for the physical meter,
 * and to Machine/Line/Area for hierarchical aggregation.
 */
export class EnergyReading extends Schema.TaggedClass<EnergyReading>()('EnergyReading', {
  id: EnergyReadingId,
  /** Metering point in the hierarchy */
  meteringLevel: MeteringLevel,
  /** Energy source being metered */
  energySource: EnergySource,
  /** Energy unit */
  unit: EnergyUnit,
  /** Reading timestamp (interval start) */
  timestamp: Schema.DateTimeUtc,
  /** Interval duration in minutes (typically 15) */
  intervalMinutes: Schema.Number.pipe(Schema.int(), Schema.positive()),
  /** Energy consumed in this interval */
  consumption: Schema.Number.pipe(Schema.nonNegative()),
  /** Peak demand in kW (for demand charge calculation) */
  peakDemandKw: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
  /** Power factor (0-1, for reactive power tracking) */
  powerFactor: Schema.optionalWith(Schema.Number.pipe(Schema.between(0, 1)), { as: 'Option' }),
  /** Cost for this interval (in local currency) */
  cost: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
  /** Carbon emissions (kg CO2e) */
  carbonKgCo2e: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
  /** Units produced during this interval (for kWh/unit calculation) */
  unitsProduced: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
  // ── Hierarchy links ──
  sensorId: Schema.optionalWith(SensorId, { as: 'Option' }),
  machineId: Schema.optionalWith(MachineId, { as: 'Option' }),
  lineId: Schema.optionalWith(LineId, { as: 'Option' }),
  areaId: Schema.optionalWith(AreaId, { as: 'Option' }),
  siteId: Schema.optionalWith(SiteId, { as: 'Option' }),
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
}) {
  /** kWh per unit produced (EnPI) — null if no production data */
  kwhPerUnit(): number | null {
    if (this.unitsProduced._tag === 'None' || this.unitsProduced.value === 0) return null
    return this.consumption / this.unitsProduced.value
  }
}

// ─────────────────────────────────────────────────────────────────────
// Energy Baseline
// ─────────────────────────────────────────────────────────────────────

/**
 * EnergyBaseline — ISO 50001 Energy Baseline (EnB)
 *
 * A reference period's energy performance used for comparison.
 * Baselines are established during the energy review and updated
 * when significant changes occur (new equipment, production mix).
 */
export class EnergyBaseline extends Schema.TaggedClass<EnergyBaseline>()('EnergyBaseline', {
  id: EnergyBaselineId,
  /** Name (e.g., 'Q1 2026 Baseline - Line A') */
  name: Schema.NonEmptyString,
  /** Baseline period start */
  periodStart: Schema.DateTimeUtc,
  /** Baseline period end */
  periodEnd: Schema.DateTimeUtc,
  /** Metering level */
  meteringLevel: MeteringLevel,
  /** Energy source */
  energySource: EnergySource,
  /** Total energy consumption during baseline period */
  totalConsumption: Schema.Number.pipe(Schema.nonNegative()),
  /** Energy unit */
  unit: EnergyUnit,
  /** Total units produced during baseline period */
  totalUnitsProduced: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
  /** Baseline kWh per unit (EnPI baseline) */
  baselineKwhPerUnit: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
  /** Relevant variables (production volume, weather, etc.) */
  relevantVariables: Schema.optionalWith(Schema.String, { as: 'Option' }),
  // ── Hierarchy links ──
  machineId: Schema.optionalWith(MachineId, { as: 'Option' }),
  lineId: Schema.optionalWith(LineId, { as: 'Option' }),
  siteId: Schema.optionalWith(SiteId, { as: 'Option' }),
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
  createdAt: Schema.DateTimeUtc,
}) {}
```

### 7.4 Demand Response Integration

For the metropolitan commons, energy data enables **demand response** — when grid pricing peaks, the scheduler can shift non-critical operations to off-peak hours. This requires:
1. EnergyReading with cost data from utility API
2. ScheduledJob flexibility flags (can this job be shifted?)
3. EquipmentState correlation (idle machines consume base load)

---

## 8. Inventory / WIP Tracking

### 8.1 Domain Overview

Inventory tracking covers three material states:

| State | Description | Key Concern |
|-------|-------------|-------------|
| **Raw Material** | Purchased materials not yet in production | Location, lot traceability, FIFO/FEFO |
| **Work-in-Progress (WIP)** | Materials currently being transformed | Which routing step? How much? Where? |
| **Finished Goods** | Completed products awaiting shipment | Location, lot traceability, hold status |

The critical integration is material flow: BOM defines what is needed → Routing defines where it is consumed → Inventory tracks where it actually is → WIP tracks its progress through operations.

### 8.2 Standards Alignment

| Standard / Practice | Scope |
|---|---|
| **ISA-95 Part 2** [ISA-95-2] Material Model | Material definition, material lot, material sublot |
| **GS1** [GS1] | Barcode/RFID standards (GTIN, SSCC, SGTIN) |
| **ISO/IEC 15459** | Unique identification for transport units |
| **FDA 21 CFR 211** | Lot traceability for pharmaceutical manufacturing |

### 8.3 Proposed Effect Schemas

```typescript
// ─────────────────────────────────────────────────────────────────────
// Branded Identifiers
// ─────────────────────────────────────────────────────────────────────

export const InventoryLocationId = Schema.String.pipe(
  Schema.pattern(/^ILC-[a-zA-Z0-9-]+$/),
  Schema.brand('InventoryLocationId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/InventoryLocationId',
    description: 'Inventory location identifier with ILC- prefix',
  })
)
export type InventoryLocationId = typeof InventoryLocationId.Type

export const LotId = Schema.String.pipe(
  Schema.pattern(/^LOT-[a-zA-Z0-9-]+$/),
  Schema.brand('LotId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/LotId',
    description: 'Material lot identifier with LOT- prefix',
  })
)
export type LotId = typeof LotId.Type

export const MaterialMovementId = Schema.String.pipe(
  Schema.pattern(/^MMV-[a-zA-Z0-9-]+$/),
  Schema.brand('MaterialMovementId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/MaterialMovementId',
    description: 'Material movement identifier with MMV- prefix',
  })
)
export type MaterialMovementId = typeof MaterialMovementId.Type

// ─────────────────────────────────────────────────────────────────────
// Enumerations
// ─────────────────────────────────────────────────────────────────────

/** Inventory location type */
export const LocationType = Schema.Literal(
  'receiving',
  'raw_material_storage',
  'wip_buffer',
  'work_center',
  'finished_goods',
  'shipping',
  'quarantine',
  'scrap'
)
export type LocationType = typeof LocationType.Type

/** Lot status */
export const LotStatus = Schema.Literal(
  'available',
  'allocated',
  'in_process',
  'on_hold',
  'quarantine',
  'consumed',
  'shipped',
  'scrapped'
)
export type LotStatus = typeof LotStatus.Type

/** Material movement type */
export const MovementType = Schema.Literal(
  'receipt',           // Inbound from supplier
  'issue_to_production', // Issued to a work order
  'wip_transfer',      // Move between operations
  'return_to_stock',   // Unused material returned
  'scrap',             // Material scrapped
  'adjustment',        // Inventory count adjustment
  'shipment',          // Outbound to customer
  'transfer'           // Inter-location transfer
)
export type MovementType = typeof MovementType.Type

// ─────────────────────────────────────────────────────────────────────
// Inventory Location
// ─────────────────────────────────────────────────────────────────────

/**
 * InventoryLocation — Physical storage location
 *
 * Represents a specific place where material can be stored.
 * Locations form a hierarchy: Area → Zone → Bin/Shelf.
 *
 * Links to the existing ISA-95 hierarchy (Area, WorkCell)
 * for WIP locations at work centers.
 */
export class InventoryLocation extends Schema.TaggedClass<InventoryLocation>()('InventoryLocation', {
  id: InventoryLocationId,
  name: Schema.NonEmptyString,
  locationType: LocationType,
  /** Parent location (for nested hierarchy) */
  parentLocationId: Schema.optionalWith(InventoryLocationId, { as: 'Option' }),
  /** Zone within the location */
  zone: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Aisle/row */
  aisle: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Shelf/rack */
  shelf: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Bin/position */
  bin: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Barcode for this location */
  barcode: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Maximum capacity (weight or volume or units) */
  maxCapacity: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  /** Capacity unit */
  capacityUnit: Schema.optionalWith(UnitOfMeasure, { as: 'Option' }),
  // ── Hierarchy links ──
  areaId: Schema.optionalWith(AreaId, { as: 'Option' }),
  workCellId: Schema.optionalWith(WorkCellId, { as: 'Option' }),
  siteId: Schema.optionalWith(SiteId, { as: 'Option' }),
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
  createdAt: Schema.DateTimeUtc,
}) {}

// ─────────────────────────────────────────────────────────────────────
// Inventory Lot
// ─────────────────────────────────────────────────────────────────────

/**
 * InventoryLot — ISA-95 MaterialLot / MaterialSublot
 *
 * Represents a specific quantity of a specific part at a specific
 * location with full traceability. Lots are the fundamental unit
 * of inventory accounting and quality traceability.
 *
 * For FIFO/FEFO compliance, lots track receipt date and expiration.
 */
export class InventoryLot extends Schema.TaggedClass<InventoryLot>()('InventoryLot', {
  id: LotId,
  /** Part this lot contains */
  partId: PartId,
  /** Current location */
  locationId: InventoryLocationId,
  /** Lot status */
  status: LotStatus,
  /** Current quantity on hand */
  quantityOnHand: Schema.Number.pipe(Schema.nonNegative()),
  /** Quantity allocated to work orders (reserved but not consumed) */
  quantityAllocated: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
  /** Unit of measure */
  unitOfMeasure: UnitOfMeasure,
  /** Supplier lot number (for inbound traceability) */
  supplierLotNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Supplier name */
  supplierName: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Purchase order reference */
  purchaseOrderRef: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Date received */
  receivedDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  /** Expiration date (for perishable materials) */
  expirationDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  /** Certificate of conformance reference */
  cocReference: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Work order consuming this lot (for WIP) */
  workOrderId: Schema.optionalWith(WorkOrderId, { as: 'Option' }),
  /** Current routing operation (for WIP position tracking) */
  currentOperationId: Schema.optionalWith(RoutingOperationId, { as: 'Option' }),
  /** Barcode/RFID tag ID */
  barcodeTag: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Enterprise */
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
}) {
  /** Available quantity (on hand minus allocated) */
  quantityAvailable(): number {
    const allocated = this.quantityAllocated._tag === 'Some' ? this.quantityAllocated.value : 0
    return Math.max(0, this.quantityOnHand - allocated)
  }

  /** Is this lot expired? */
  isExpired(now?: Date): boolean {
    if (this.expirationDate._tag === 'None') return false
    const checkDate = now ?? new Date()
    return checkDate > new Date(Number(this.expirationDate.value.epochMillis))
  }
}

// ─────────────────────────────────────────────────────────────────────
// Material Movement (Event Log)
// ─────────────────────────────────────────────────────────────────────

/**
 * MaterialMovement — Inventory transaction event
 *
 * Every material movement (receipt, issue, transfer, scrap) is
 * recorded as an immutable event. This provides full traceability
 * and enables inventory reconciliation.
 *
 * EVENT SOURCED: MaterialMovement is append-only. The current
 * InventoryLot state is a projection of all MaterialMovements
 * for that lot.
 */
export class MaterialMovement extends Schema.TaggedClass<MaterialMovement>()('MaterialMovement', {
  id: MaterialMovementId,
  /** Movement type */
  movementType: MovementType,
  /** Lot being moved */
  lotId: LotId,
  /** Part (denormalized for query efficiency) */
  partId: PartId,
  /** Quantity moved */
  quantity: Schema.Number.pipe(Schema.positive()),
  /** Unit of measure */
  unitOfMeasure: UnitOfMeasure,
  /** Source location (null for receipts) */
  fromLocationId: Schema.optionalWith(InventoryLocationId, { as: 'Option' }),
  /** Destination location (null for scrap/shipment) */
  toLocationId: Schema.optionalWith(InventoryLocationId, { as: 'Option' }),
  /** Work order context (for issue/return) */
  workOrderId: Schema.optionalWith(WorkOrderId, { as: 'Option' }),
  /** Routing operation context (for WIP transfer) */
  operationId: Schema.optionalWith(RoutingOperationId, { as: 'Option' }),
  /** Who performed the movement */
  performedBy: Schema.NonEmptyString,
  /** Transaction timestamp */
  transactedAt: Schema.DateTimeUtc,
  /** Reason/notes */
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Barcode/RFID scan reference */
  scanReference: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Enterprise */
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
}) {}
```

### 8.4 WIP Flow Through Routing Operations

WIP tracking is the intersection of Inventory and Routing. As material progresses through operations:

```
Receipt (MMV-001)
  → LOT-steel-bar-001 at ILC-raw-storage
Issue to Production (MMV-002)
  → LOT-steel-bar-001 at ILC-wip-lathe-01 (currentOperationId: ROP-cut)
WIP Transfer (MMV-003)
  → LOT-steel-bar-001 at ILC-wip-mill-03 (currentOperationId: ROP-mill)
WIP Transfer (MMV-004)
  → LOT-widget-batch-42 at ILC-wip-inspect (currentOperationId: ROP-inspect)
Finished Goods (MMV-005)
  → LOT-widget-batch-42 at ILC-finished-goods
Shipment (MMV-006)
  → LOT-widget-batch-42 shipped (status: 'shipped')
```

Each MaterialMovement is an immutable event. The current state of any lot is a projection of its movement history — fully compatible with TMNL's event sourcing architecture.

---

## 9. Cross-Domain Integration Map

All six domains are interconnected. No domain operates in isolation.

```
                    ┌──────────────┐
                    │  SCHEDULING  │
                    │  (when)      │
                    └──────┬───────┘
                           │ ScheduledJob.operationId
                           │ ScheduledJob.workCenterId
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐
    │  ROUTING   │   │  EQUIP.   │   │  ENERGY   │
    │  (how)     │   │  STATE    │   │  (cost)   │
    └─────┬─────┘   │  (status) │   └─────┬─────┘
          │         └───────────┘         │
          │ RoutingOp.workCenterId        │ EnergyReading.machineId
          │ BomLine.operationId           │
    ┌─────┴─────┐                   ┌─────┴─────┐
    │    BOM     │                   │  MACHINE   │
    │  (what)    │                   │  (where)   │
    └─────┬─────┘                   └───────────┘
          │ BomLine.componentPartId
          │ InventoryLot.partId
    ┌─────┴─────┐         ┌─────────────┐
    │ INVENTORY  │────────→│  QUALITY    │
    │  (where)   │         │  (pass/fail)│
    └────────────┘         └─────────────┘
     MaterialMovement.lotId   NonConformance.lotId
     InventoryLot.workOrderId SpcSample.workOrderId
```

### Integration Points Summary

| From | To | Link Field | Relationship |
|------|-----|------------|-------------|
| BomLine | RoutingOperation | `operationId` | Which operation consumes this material |
| BomLine | Part | `componentPartId` | Which part is required |
| RoutingOperation | WorkCenter | `workCenterId` | Where the operation executes |
| WorkCenter | Machine/Line | `machineIds`/`lineIds` | Physical equipment mapping |
| ScheduledJob | RoutingOperation | `operationId` | What is being scheduled |
| ScheduledJob | WorkOrder | `workOrderId` | Which order this serves |
| ScheduledJob | WorkCenter | `workCenterId` | Where it is scheduled |
| ControlChart | RoutingOperation | `operationId` | Where quality is measured |
| ControlChart | Sensor | `sensorId` | Automatic data collection |
| NonConformance | WorkOrder | `workOrderId` | Which order had the defect |
| NonConformance | RoutingOperation | `operationId` | Which step had the defect |
| EnergyReading | Machine | `machineId` | Per-machine energy |
| EnergyReading | Line | `lineId` | Per-line energy |
| InventoryLot | Part | `partId` | What material is in this lot |
| InventoryLot | RoutingOperation | `currentOperationId` | WIP position |
| MaterialMovement | WorkOrder | `workOrderId` | Material consumption per order |
| CapacitySlot | WorkCenter | `workCenterId` | Available time |

---

## 10. Event Sourcing Strategy

Three of the six domains are candidates for event sourcing, following the pattern established by AlarmEntity, WorkOrderEntity, and EquipmentStateEntity (`src/lib/iiot/entity/index.ts:8-14`).

| Domain | Event Sourcing? | Rationale |
|--------|----------------|-----------|
| **BOM** | No — mutable CRUD | BOMs change via engineering change orders; revision history via `revision` field is sufficient. No regulatory requirement for append-only. |
| **Routing** | No — mutable CRUD | Same as BOM. Revision-controlled, not event-sourced. |
| **Quality (NCR/CAPA)** | **Yes** | FDA 21 CFR Part 11 requires complete audit trail on quality records. NCR status transitions and CAPA actions must be append-only. |
| **Scheduling** | No — mutable | Schedules are continuously adjusted. Snapshot-based, not event-sourced. |
| **Energy** | No — time-series | EnergyReadings are inherently append-only (immutable time-series). No need for event sourcing machinery; simple insert. |
| **Inventory** | **Yes** (MaterialMovement) | MaterialMovements are already modeled as immutable events. InventoryLot is a projection. This is natural event sourcing. |

### Proposed Entity Classification Update

The current entity barrel export (`src/lib/iiot/entity/index.ts:8-14`) classifies entities as event-sourced or mutable. The new domains extend this:

```typescript
// Event-sourced entities (append-only, full audit trail)
export const EVENT_SOURCED_ENTITIES = [
  'Alarm',           // Existing
  'WorkOrder',       // Existing
  'EquipmentState',  // Existing
  'NonConformance',  // NEW — FDA 21 CFR Part 11
  'CapaAction',      // NEW — Regulatory audit trail
  'MaterialMovement' // NEW — Lot traceability
] as const

// Mutable entities (CRUD with revision control)
export const MUTABLE_ENTITIES = [
  // Existing ISA-95 hierarchy...
  'Part',              // NEW
  'BomHeader',         // NEW
  'BomLine',           // NEW
  'WorkCenter',        // NEW
  'Routing',           // NEW
  'RoutingOperation',  // NEW
  'ControlChart',      // NEW
  'SpcSample',         // NEW (append-only time-series, not event-sourced)
  'ProductionSchedule', // NEW
  'ScheduledJob',      // NEW
  'CapacitySlot',      // NEW
  'EnergyReading',     // NEW (append-only time-series)
  'EnergyBaseline',    // NEW
  'InventoryLocation', // NEW
  'InventoryLot',      // NEW (state is projection of MaterialMovements)
] as const
```

---

## 11. Commons Implications

These six domains are not just internal to a single organization. In TMNL's metropolitan commons model, they enable inter-organization collaboration.

### 11.1 Shared Part Catalogs

When 200 shops use the same PRT-bolt-m6-ss316, the commons can:
- Aggregate demand for bulk purchasing power
- Identify common failure modes across organizations (anonymized quality data)
- Enable one-click reorder from approved suppliers

### 11.2 Subcontracting via Shared Routings

Shop A has a CNC mill but no heat treatment. Shop B has heat treatment. Through shared routing visibility:
1. Shop A's routing includes Op 30: Heat Treat (external)
2. Commons matches Shop A's need to Shop B's capacity (via CapacitySlot)
3. MaterialMovement tracks the WIP transfer between organizations
4. Quality data follows the lot across organizational boundaries

### 11.3 Energy Benchmarking

Anonymous energy data enables:
- "Your CNC mill uses 2.3 kWh/part. The commons median is 1.8 kWh/part."
- Demand response coordination: "12 shops on the same grid can collectively shift 200 kW"
- Carbon footprint per part for supply chain reporting

### 11.4 Quality Intelligence

Aggregated (anonymized) SPC data reveals:
- Common defect modes by material, machine type, or supplier lot
- Process capability benchmarks by operation type
- Early warning when a supplier's material quality drifts

### 11.5 NATS Subject Mapping

Each domain maps to NATS subjects for real-time event distribution:

```
tmnl.{org}.bom.{bomId}.>          — BOM change events
tmnl.{org}.routing.{routingId}.>  — Routing updates
tmnl.{org}.quality.ncr.{ncrId}.>  — NCR lifecycle events
tmnl.{org}.quality.spc.{chartId}.> — SPC out-of-control signals
tmnl.{org}.schedule.{scheduleId}.> — Schedule change events
tmnl.{org}.energy.{machineId}.>   — Energy reading stream
tmnl.{org}.inventory.{lotId}.>    — Material movement events

# Cross-org (commons-level) subjects
tmnl.commons.capacity.available.> — Available capacity signals
tmnl.commons.demand.material.>    — Aggregated material demand
tmnl.commons.quality.alert.>      — Anonymized quality alerts
```

---

## 12. Codebase Grounding

All proposed schemas follow the patterns established in the existing TMNL codebase.

### 12.1 Pattern Conformance

| Pattern | Existing Example | Proposed Usage |
|---------|------------------|----------------|
| `Schema.TaggedClass<T>()('Tag', {...})` | `Enterprise` (`src/lib/iiot/schemas/assets/enterprise/schema.ts:96`) | All 18 new entity classes |
| `Schema.String.pipe(Schema.pattern(...), Schema.brand('X'))` | `EnterpriseId` (`schema.ts:29-36`) | All 18 new branded IDs (PartId, BomId, etc.) |
| `Schema.Literal(...)` for status enums | `EnterpriseStatus` (`schema.ts:56-66`) | All status types (BomStatus, NcrStatus, etc.) |
| `Schema.optionalWith(T, { as: 'Option' })` | Throughout all entity schemas | All optional fields |
| `makeXxxId(slug)` factory functions | `makeEnterpriseId` (`schema.ts:45`) | All ID factory functions |
| `Schema.TaggedError<T>()('Tag', {...})` | `RpcWorkOrderNotFoundError` (`WorkOrderEntity.ts:68-73`) | NCR/CAPA RPC errors |
| `Entity.make(type, [Rpc...])` | `WorkOrderEntity` (`WorkOrderEntity.ts:305-318`) | NonConformance, MaterialMovement entities |
| `Rpc.make(tag, {...})` | `CreateWorkOrderRpc` (`WorkOrderEntity.ts:120-141`) | Quality/Inventory RPCs |

### 12.2 ID Prefix Registry

Existing prefixes (from `src/lib/iiot/schemas/`):

| Prefix | Entity | File |
|--------|--------|------|
| `ENT-` | Enterprise | `assets/enterprise/schema.ts` |
| `SIT-` | Site | `assets/site/schema.ts` |
| `ARA-` | Area | `assets/area/schema.ts` |
| `PLT-` | Plant | `assets/plant/schema.ts` |
| `LIN-` | Line | `assets/line/schema.ts` |
| `WCL-` | WorkCell | `assets/workcell/schema.ts` |
| `MCH-` | Machine | `assets/machine/schema.ts` |
| `DEV-` | Device | `assets/device/schema.ts` |
| `SNS-` | Sensor | `assets/sensor/schema.ts` |

Proposed new prefixes:

| Prefix | Entity | Domain |
|--------|--------|--------|
| `PRT-` | Part | BOM |
| `BOM-` | BomHeader | BOM |
| `BLN-` | BomLine | BOM |
| `RTG-` | Routing | Routing |
| `ROP-` | RoutingOperation | Routing |
| `WKC-` | WorkCenter | Routing |
| `CCH-` | ControlChart | Quality |
| `SPC-` | SpcSample | Quality |
| `INS-` | InspectionRecord | Quality |
| `NCR-` | NonConformance | Quality |
| `CAP-` | CapaAction | Quality |
| `SCH-` | ProductionSchedule | Scheduling |
| `SJB-` | ScheduledJob | Scheduling |
| `CSL-` | CapacitySlot | Scheduling |
| `ENR-` | EnergyReading | Energy |
| `ENB-` | EnergyBaseline | Energy |
| `ILC-` | InventoryLocation | Inventory |
| `LOT-` | InventoryLot | Inventory |
| `MMV-` | MaterialMovement | Inventory |

### 12.3 Existing Entity Integration Points

| Existing Entity | New Domain Link | Integration Mechanism |
|---|---|---|
| `WorkOrder` (`entity/WorkOrderEntity.ts`) | Scheduling, Quality, Inventory | `ScheduledJob.workOrderId`, `NonConformance.workOrderId`, `MaterialMovement.workOrderId` |
| `Machine` (`schemas/assets/machine/schema.ts`) | Routing, Energy, Quality | `WorkCenter.machineIds`, `EnergyReading.machineId`, `ControlChart.machineId` |
| `Sensor` (`schemas/assets/sensor/schema.ts`) | Quality, Energy | `ControlChart.sensorId`, `EnergyReading.sensorId` |
| `EquipmentState` (`entity/EquipmentStateEntity.ts`) | Scheduling | `CapacitySlot.isBlocked` derived from equipment downtime |
| `Alarm` (`entity/AlarmEntity.ts`) | Quality | SPC out-of-control signals can trigger alarms |
| `Line` (`schemas/assets/line/schema.ts`) | Scheduling, Energy | `ProductionSchedule.lineIds`, `EnergyReading.lineId` |

---

## 13. Implementation Priority

Based on dependency analysis and value delivery:

### Phase 1: Foundation (BOM + Routing + Inventory)

These three domains are interdependent and foundational. Without knowing what to make (BOM), how to make it (Routing), and what materials are available (Inventory), no other domain can function.

| Priority | Entity | Rationale |
|----------|--------|-----------|
| P1.1 | Part, BomHeader, BomLine | Foundation — everything references parts |
| P1.2 | WorkCenter, Routing, RoutingOperation | Connects BOM to shop floor |
| P1.3 | InventoryLocation, InventoryLot, MaterialMovement | Tracks material flow |

### Phase 2: Execution (Scheduling + Quality)

With BOM/Routing/Inventory in place, scheduling and quality provide execution visibility.

| Priority | Entity | Rationale |
|----------|--------|-----------|
| P2.1 | ProductionSchedule, ScheduledJob, CapacitySlot | Finite capacity scheduling |
| P2.2 | ControlChart, SpcSample | Statistical quality monitoring |
| P2.3 | NonConformance, CapaAction | Quality event management (event-sourced) |

### Phase 3: Optimization (Energy)

Energy management provides cost optimization once production is tracked.

| Priority | Entity | Rationale |
|----------|--------|-----------|
| P3.1 | EnergyReading, EnergyBaseline | ISO 50001 compliance, cost tracking |
| P3.2 | EnergyCostAllocation | Per-part energy costing |

---

## 14. References

### Standards

- [ISA-95-1] ANSI/ISA-95.00.01 — Enterprise-Control System Integration Part 1: Models and Terminology
- [ISA-95-2] ANSI/ISA-95.00.02 — Enterprise-Control System Integration Part 2: Object Model Attributes
- [ISA-95-4] ANSI/ISA-95.00.04 — Enterprise-Control System Integration Part 4: Objects and Attributes for Manufacturing Operations Management Integration
- [B2MML] B2MML V0700 — Business to Manufacturing Markup Language, MESA International. https://mesa.org/topics-resources/b2mml/
- [ISO-7870] ISO 7870 — Control charts
- [ISO-22514] ISO 22514 — Statistical methods in process management — Capability and performance
- [AIAG-SPC] AIAG Statistical Process Control Reference Manual, 2nd Edition
- [AS9102] SAE AS9102 — First Article Inspection Requirement
- [ISO-50001] ISO 50001:2018 — Energy management systems — Requirements with guidance for use. https://www.iso.org/standard/69426.html
- [ISO-50001-2018] ISO 50001:2018. https://www.iso.org/iso-50001-energy-management.html
- [FDA-CFR11] FDA 21 CFR Part 11 — Electronic Records; Electronic Signatures
- [GS1] GS1 General Specifications — Barcode and RFID standards. https://www.gs1.org/

### Industry References

- [MESA-WP21] MESA White Paper #21 — ISA-95 Implementation Best Practices: Workflow Descriptions Using B2MML
- [OPC-ISA95] OPC UA Companion Specification for ISA-95 Common Object Model. https://reference.opcfoundation.org/ISA-95/v100/docs/1
- [B2MML-GITHUB] MESA International B2MML GitHub Repository. https://github.com/MESAInternational/B2MML-BatchML
- [NIST-ISA95-L3] NIST GCR 19-022 — Formalizing ISA-95 Level 3 Control
- [SIEMENS-ISA95] Siemens ISA-95 Framework and Layers. https://www.sw.siemens.com/en-US/technology/isa-95-framework-layers/
- [FRONTIERS-SCHED] Sharing Data for Production Scheduling Using the ISA-95 Standard, Frontiers in Energy Research. https://www.frontiersin.org/journals/energy-research/articles/10.3389/fenrg.2014.00044/full

### TMNL Codebase

- [TMNL-ENTERPRISE] `src/lib/iiot/schemas/assets/enterprise/schema.ts` — Enterprise entity pattern
- [TMNL-MACHINE] `src/lib/iiot/schemas/assets/machine/schema.ts` — Machine entity with maintenance fields
- [TMNL-SENSOR] `src/lib/iiot/schemas/assets/sensor/schema.ts` — Sensor entity with thresholds
- [TMNL-WORKORDER] `src/lib/iiot/entity/WorkOrderEntity.ts` — Event-sourced work order
- [TMNL-ALARM] `src/lib/iiot/entity/AlarmEntity.ts` — Event-sourced alarm (ISA-18.2)
- [TMNL-EQSTATE] `src/lib/iiot/entity/EquipmentStateEntity.ts` — Event-sourced equipment state (OEE)
- [TMNL-IDENTIFIERS] `src/lib/iiot/schemas/identifiers.ts` — Branded identifier registry
- [TMNL-ENTITY-INDEX] `src/lib/iiot/entity/index.ts` — Entity classification (event-sourced vs mutable)

### Cross-References to Other RFC Sections

- [RFC-COMPETITIVE] `rfc-section-competitive-analysis.md` — Gap G-1 (event sourcing), Gap G-2 (reactive hierarchy)
- [RFC-EFFECT] `rfc-section-effect-architecture.md` — Effect Schema patterns, Layer composition
- [RFC-TEMPORAL] `rfc-section-two-domain-consistency.md` — T3/T4 temporal tiers for scheduling
- [RFC-COMMONS] `rfc-section-multi-tenant-network.md` — Cross-org data sharing, Ostrom principles
- [RFC-INTRO] `rfc-section-introduction.md` — Metropolitan-scale manufacturing vision
