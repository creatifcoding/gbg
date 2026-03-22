# WBS V2 — Operational Data Domains

**Domain Expert**: data-architect
**RFC Section**: 36 (Part XII: Operational Data Domains), lines 38461-41610
**Total Story Points**: ~451 SP across 33 epics, 4 phases + E2E stack layers (incl. ~124 SP testing)
**Estimated Duration**: 20-25 sprints

---

## Summary

Section 36 specifies six operational data domains that transform TMNL from a monitoring platform into a full ISA-95 MES/MOM system:

1. **Bill of Materials (BOM)** -- Multi-level BOM, phantom assemblies, part catalog (P0)
2. **Routing / Process Plan** -- Operations, work centers, setup/cycle times (P0)
3. **Quality / SPC** -- Control charts, NCR, CAPA, capability indices (P1)
4. **Inventory / WIP** -- Lot/serial tracking, material movements, cycle counting (P1)
5. **Scheduling / Capacity** -- Finite scheduling, constraint-based, capacity slots (P2)
6. **Energy Management** -- ISO 50001, demand response, energy-per-part attribution (P3)

### New Artifacts

| Category | Count | Details |
|----------|-------|---------|
| New Entities | 21 | Part, BomHeader, BomLine, Routing, RoutingOperation, WorkCenter, ControlChart, SpcSample, InspectionRecord, NonConformance, CapaAction, ProductionSchedule, ScheduledJob, CapacitySlot, EnergyReading, EnergyBaseline, EnergyCostAllocation, InventoryLocation, InventoryLot, MaterialMovement, WipSnapshot |
| Branded IDs | 19 | PRT-, BOM-, BLN-, RTG-, ROP-, WKC-, CCH-, SPC-, INS-, NCR-, CAP-, SCH-, SJB-, CSL-, ENR-, ENB-, ILC-, LOT-, MMV- |
| RPC Groups | 7 | BomRpcs, RoutingRpcs, QualityRpcs, SchedulingRpcs, InventoryRpcs, EnergyRpcs (+combined IIoTRpcs update) |
| Event-Sourced | 4 | NonConformance, CapaAction, ScheduledJob, InventoryLot |
| Append-Only (+ event log) | 6 | SpcSample, InspectionRecord, EnergyReading, EnergyCostAllocation, MaterialMovement, WipSnapshot |
| CRUD | 11 | Part, BomHeader, BomLine, Routing, RoutingOperation, WorkCenter, ControlChart, ProductionSchedule, CapacitySlot, EnergyBaseline, InventoryLocation |

### Event Sourcing Strategy (from RFC S36.12)

| Entity | ES? | Rationale |
|--------|-----|-----------|
| Part, BomHeader, BomLine | CRUD | Design-time master data, infrequent changes |
| Routing, RoutingOperation, WorkCenter | CRUD | Design-time, versioned via revision fields |
| ControlChart | CRUD | Configuration data |
| SpcSample, InspectionRecord | Append-only | Regulatory: immutable once recorded |
| NonConformance | **Event-sourced** | FDA 21 CFR Part 11, AS9100 audit trail |
| CapaAction | **Event-sourced** | Regulatory CAPA lifecycle traceability |
| ProductionSchedule, CapacitySlot | CRUD | Mutable by nature (Linda drags magnets) |
| ScheduledJob | **Event-sourced** | Schedule adherence requires reschedule history |
| EnergyReading, EnergyCostAllocation | Append-only | Time-series, immutable once metered |
| EnergyBaseline | CRUD | ISO 50001 baselines are versioned, not evented |
| InventoryLocation | CRUD | Master data |
| InventoryLot | **Event-sourced** | Full traceability for every movement/adjustment |
| MaterialMovement | **Event-sourced** (IS the event log) | The event stream for inventory |
| WipSnapshot | Append-only | Point-in-time, immutable |

### Entity Tier Classification

Each entity is classified as **Machine-backed (Tier 1)** or **CRUD (Tier 2)** based on whether it has a state machine lifecycle with defined transitions.

| Entity | Tier | Stack Layers | Rationale |
|--------|------|-------------|-----------|
| **NonConformance** | **Machine (13)** | Schema, Model, DDL, Repo, Errors, L2 Service, **Graph**, **Machine**, **ES Handler**, **Reactivity**, **Observer**, Entity, RPC, HTTP, Streaming | 7 NCR states (open -> closed), FDA 21 CFR Part 11 audit trail |
| **CapaAction** | **Machine (13)** | (same) | 7 CAPA states (initiated -> closed_effective/ineffective), regulatory traceability |
| **ScheduledJob** | **Machine (13)** | (same) | 6 job states (scheduled -> completed/held), schedule adherence requires reschedule history |
| **InventoryLot** | **Machine (13)** | (same) | 7 lot states (available -> consumed/scrapped/expired), full movement traceability |
| Part | CRUD (8) | Schema, Model, DDL, Repo, Errors, L2 Service, Entity, RPC, HTTP | Master data, infrequent changes |
| BomHeader | CRUD (8) | (same) | Design-time, revision-based |
| BomLine | CRUD (8) | (same) | BOM component, child of BomHeader |
| Routing | CRUD (8) | (same) | Design-time, revision-based |
| RoutingOperation | CRUD (8) | (same) | Child of Routing |
| WorkCenter | CRUD (8) | (same) | Master data |
| ControlChart | CRUD (8) | (same) | Configuration data |
| ProductionSchedule | CRUD (8) | (same) | Mutable by design |
| CapacitySlot | CRUD (8) | (same) | Derived from schedule |
| EnergyBaseline | CRUD (8) | (same) | ISO 50001 versioned |
| InventoryLocation | CRUD (8) | (same) | Master data |
| SpcSample | Append-only (6) | Schema, Model, DDL, Repo, Errors, HTTP | Immutable time-series, no lifecycle |
| InspectionRecord | Append-only (6) | (same) | Immutable regulatory record |
| EnergyReading | Append-only (6) | (same) | Immutable meter data |
| EnergyCostAllocation | Append-only (6) | (same) | Immutable cost record |
| MaterialMovement | Append-only (6) | (same) | IS the event log for inventory |
| WipSnapshot | Append-only (6) | (same) | Point-in-time, immutable |

**Machine-backed entities need 5 EXTRA layers** beyond CRUD:
- **State Graph** (`machines/graphs/`) -- `Graph.directed` with states + valid transitions
- **Machine** (`machines/`) -- `Machine.make` with `Machine.procedures` for each command
- **ES Handler** (`handlers/`) -- `EventLog.group` projections to read model (repo)
- **Reactivity** (`handlers/`) -- `EventLog.groupReactivity` cache invalidation keys
- **Observer** (`entity/`) -- `makeEntityObserver(entityType, Machine.changes)` registered at entity activation; scoped fiber subscribes to `Machine.changes` (`Stream<State>`), computes state diff via `Stream.zipWithPrevious` (NOT `Stream.pairwise` -- does not exist), emits `EntityStateChanged` events through EventDistribution `iiot:entity-changes` channel. First emission has `Option.none()` for previous state (treat as "initialized" action). Infrastructure provided by platform-architect (Epics PL-01, PL-02, PL-06, PL-07); domain entities only need registration.

---

## Phase 1: BOM + Routing Foundations (P0) — 80 SP

### Epic DD-01: BOM Schema & Identifiers — 16 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-01.1.1 | Branded IDs: `PartId` (PRT-), `BomId` (BOM-), `BomLineId` (BLN-) with pattern validation + annotations in `src/lib/iiot/schemas/bom/identifiers.ts` | 2 |
| ⏳  | DD-01.1.2 | Enumerations: `BomType`, `PartCategory`, `UnitOfMeasure`, `PartStatus`, `BomStatus` as Schema.Literal in `src/lib/iiot/schemas/bom/enums.ts` | 2 |
| ⏳  | DD-01.2.1 | `Part` entity (Schema.TaggedClass) -- ISA-95 MaterialDefinition mapping. Fields: partNumber, revision, category, status, standardCost, leadTimeHours, shelfLifeDays, supersededBy. Methods: isActive(), getAutomationLevel() | 3 |
| ⏳  | DD-01.2.2 | `BomHeader` entity (Schema.TaggedClass) -- ISA-95 ProductDefinition mapping. Fields: outputPartId, bomType, revision, status, effectiveDate, expirationDate, standardBatchSize, expectedYieldPercent. Method: isReleased() | 3 |
| ⏳  | DD-01.2.3 | `BomLine` entity (Schema.TaggedClass) -- ISA-95 ProductSegment.MaterialSpecification. Fields: bomId, lineNumber, componentPartId, quantityPer, scrapFactor, componentBomId (recursive), operationId (BOM->Routing link), isPhantom. Method: effectiveQuantity() | 3 |
| ⏳  | DD-01.T.1 | **Schema tests** in `__tests__/schemas/bom.test.ts`: decode/encode roundtrip for Part, BomHeader, BomLine. Branded ID validation (PRT-, BOM-, BLN- prefix). Entity method tests: Part.isActive(), BomHeader.isReleased(), BomLine.effectiveQuantity(). Property-based: all enums decode correctly. | 3 |

**Dependencies**: None (foundational)
**RFC Sections**: S36.3.1-S36.3.7
**Files**: `src/lib/iiot/schemas/bom/`, `src/lib/iiot/__tests__/schemas/`

---

### Epic DD-02: BOM Repository & DDL — 17 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-02.1.1 | DDL: `parts` table with columns matching Part entity, indexes on (enterpriseId, partNumber), (status), unique on (partNumber, revision) | 3 |
| ⏳  | DD-02.1.2 | DDL: `bom_headers` table with FK to parts(id), indexes on (outputPartId, status), unique on (outputPartId, revision, bomType) | 2 |
| ⏳  | DD-02.1.3 | DDL: `bom_lines` table with FK to bom_headers(id) + parts(id), index on (bomId, lineNumber), optional FK to routing_operations(id) | 2 |
| ⏳  | DD-02.2.1 | `PartRepo` -- CRUD: create, findById, findByPartNumber, findByEnterprise, updateStatus, search by category/status | 3 |
| ⏳  | DD-02.2.2 | `BomHeaderRepo` -- CRUD: create, findById, findByOutputPart, findReleasedByPart, updateStatus | 2 |
| ⏳  | DD-02.2.3 | `BomLineRepo` -- CRUD: create, findByBomId (ordered), addLine, removeLine, updateOperationLink. Multi-level BOM explosion query (recursive CTE) | 3 |
| ⏳  | DD-02.3.1 | Migration `0030_bom_schema` aggregating all BOM DDLs | 1 |
| ⏳  | DD-02.T.1 | **Repo integration tests** in `__tests__/repos/bom.integration.test.ts`: PartRepo CRUD cycle (create -> findById -> findByPartNumber -> updateStatus -> verify). BomHeaderRepo CRUD (create -> findByOutputPart -> findReleasedByPart). BomLineRepo ordered retrieval + recursive CTE multi-level BOM explosion. Constraint violation tests (duplicate partNumber+revision, orphan BomLine). | 3 |
| ⏳  | DD-02.T.2 | **DDL migration test** in `__tests__/integration/bom-ddl.test.ts`: tables exist, FK constraints enforced, unique indexes reject duplicates, cascade behavior on Part delete. | 1 |

**Dependencies**: Epic DD-01 (schemas)
**RFC Sections**: S36.3.4-S36.3.5
**Files**: `src/lib/iiot/infrastructure/ddl/`, `src/lib/iiot/repositories/`, `src/lib/iiot/__tests__/repos/`

---

### Epic DD-03: Routing Schema & Identifiers — 12 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-03.1.1 | Branded IDs: `RoutingId` (RTG-), `RoutingOperationId` (ROP-), `WorkCenterId` (WKC-) with pattern validation + annotations in `src/lib/iiot/schemas/routing/identifiers.ts` | 2 |
| ⏳  | DD-03.1.2 | Enumerations: `OperationType`, `RoutingStatus`, `DependencyType` as Schema.Literal in `src/lib/iiot/schemas/routing/enums.ts` | 1 |
| ⏳  | DD-03.2.1 | `WorkCenter` entity (Schema.TaggedClass) -- ISA-95 EquipmentClass + EquipmentCapability. Fields: efficiencyFactor, parallelCapacity, costPerHour, machineIds[], workCellIds[], lineIds[] | 2 |
| ⏳  | DD-03.2.2 | `Routing` entity (Schema.TaggedClass) -- ISA-95 ProcessSegment collection. Fields: partId, bomId (optional), revision, status, isPrimary, totalCycleTimeMinutes. Method: isReleased() | 2 |
| ⏳  | DD-03.2.3 | `RoutingOperation` entity (Schema.TaggedClass) -- ISA-95 ProcessSegment. Fields: routingId, operationNumber, operationType, workCenterId, setupTimeMinutes, runTimePerUnitMinutes, teardownTimeMinutes, queueTimeMinutes, moveTimeMinutes, isInspectionPoint, dependsOn[]. Method: batchTimeMinutes(n) | 3 |
| ⏳  | DD-03.T.1 | **Schema tests** in `__tests__/schemas/routing.test.ts`: decode/encode roundtrip for WorkCenter, Routing, RoutingOperation. Branded ID validation (RTG-, ROP-, WKC-). Entity method tests: Routing.isReleased(), RoutingOperation.batchTimeMinutes(). WorkCenter ARRAY field decode. | 2 |

**Dependencies**: Epic DD-01 (PartId, BomId references)
**RFC Sections**: S36.4.1-S36.4.5
**Files**: `src/lib/iiot/schemas/routing/`, `src/lib/iiot/__tests__/schemas/`

---

### Epic DD-04: Routing Repository & DDL — 14 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-04.1.1 | DDL: `work_centers` table with columns matching WorkCenter, ARRAY columns for machineIds/workCellIds/lineIds, indexes on (plantId), (enterpriseId) | 2 |
| ⏳  | DD-04.1.2 | DDL: `routings` table with FK to parts(id), optional FK to bom_headers(id), indexes on (partId, status), unique on (partId, revision, isPrimary) | 2 |
| ⏳  | DD-04.1.3 | DDL: `routing_operations` table with FK to routings(id) + work_centers(id), index on (routingId, operationNumber), JSONB column for dependsOn | 2 |
| ⏳  | DD-04.2.1 | `WorkCenterRepo` -- CRUD: create, findById, findByPlant, findByMachineCapability | 2 |
| ⏳  | DD-04.2.2 | `RoutingRepo` -- CRUD: create, findById, findPrimaryByPart, findAlternatesByPart. `RoutingOperationRepo` -- CRUD: findByRouting (ordered), addOperation, removeOperation, resequence | 3 |
| ⏳  | DD-04.3.1 | Migration `0031_routing_schema` aggregating all Routing DDLs | 1 |
| ⏳  | DD-04.T.1 | **Repo integration tests** in `__tests__/repos/routing.integration.test.ts`: WorkCenterRepo CRUD + findByMachineCapability with ARRAY match. RoutingRepo CRUD + findPrimaryByPart uniqueness. RoutingOperationRepo ordered retrieval + resequence. BOM-Routing link: verify operationId FK from BomLine to RoutingOperation. | 3 |
| ⏳  | DD-04.T.2 | **DDL migration test**: tables exist, FK constraints to parts + bom_headers enforced, JSONB dependsOn column accepts valid data + rejects malformed. | 1 |

**Dependencies**: Epic DD-02 (BOM DDL for FK), Epic DD-03 (schemas)
**RFC Sections**: S36.4.4-S36.4.6
**Files**: `src/lib/iiot/infrastructure/ddl/`, `src/lib/iiot/repositories/`, `src/lib/iiot/__tests__/repos/`

---

### Epic DD-05: BOM + Routing Entity, Service & RPC Layer — 21 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-05.1.1 | `BomHeaderEntity` -- Entity.make('BomHeader', [Create, AddLine, RemoveLine, SetRevision, Get]). BOM is CRUD-based (not event-sourced). | 2 |
| ⏳  | DD-05.1.2 | `RoutingEntity` -- Entity.make('Routing', [Create, AddOperation, RemoveOperation, ResequenceOperation, AssignWorkCenter, Get]). CRUD-based. | 2 |
| ⏳  | DD-05.1.3 | `PartEntity` -- Entity.make('Part', [Create, Update, UpdateStatus, Get, Search]). CRUD master data. Delegates to PartRepo. | 2 |
| ⏳  | DD-05.1.4 | `WorkCenterEntity` -- Entity.make('WorkCenter', [Create, Update, Get, FindByPlant, FindByCapability]). CRUD master data. Delegates to WorkCenterRepo. | 2 |
| ⏳  | DD-05.2.1 | `BomService` -- Effect.Service (L2): explodeBom(bomId, depth?) -> flat list with cumulative quantities (recursive CTE + phantom resolution), calculateBomCost(bomId) -> rolls up standardCost per part across all levels, resolvePhantoms(bomId) -> replaces phantom assemblies with sub-BOM components, validateBomCircularity(bomId) -> detects circular references before save. | 3 |
| ⏳  | DD-05.3.1 | `BomRpcs` -- EntityProxy.toRpcGroup(BomHeaderEntity). `RoutingRpcs` -- EntityProxy.toRpcGroup(RoutingEntity). `PartRpcs` -- EntityProxy.toRpcGroup(PartEntity). `WorkCenterRpcs` -- EntityProxy.toRpcGroup(WorkCenterEntity). Register all in IIoTRpcs combined group. | 2 |
| ⏳  | DD-05.T.1 | **RPC roundtrip tests** in `__tests__/integration/bom-routing-rpc.test.ts`: BomHeader.Create -> BomHeader.Get roundtrip. BomHeader.AddLine -> verify line persisted. Routing.Create -> Routing.AddOperation -> Routing.Get roundtrip. Part.Create -> Part.Get roundtrip. WorkCenter.Create -> WorkCenter.FindByPlant. RPC error cases: invalid PartId, duplicate revision. | 3 |
| ⏳  | DD-05.T.2 | **Entity lifecycle test** in `__tests__/integration/bom-routing-entity.test.ts`: Full BOM build (create header -> add 3 lines -> remove 1 line -> verify 2 remain). Full Routing build (create -> add 5 operations -> resequence -> assign work centers -> verify ordering). Part CRUD (create -> update -> updateStatus -> verify). WorkCenter CRUD (create -> update -> verify capability search). | 3 |
| ⏳  | DD-05.T.3 | **BomService tests** in `__tests__/services/bom-service.test.ts`: explodeBom with 3-level BOM (verify cumulative quantities). Phantom resolution: phantom assembly line replaced with sub-BOM components. calculateBomCost: known part costs roll up correctly across levels. validateBomCircularity: circular BOM (A->B->C->A) detected and rejected with CircularBomError. Single-level BOM: trivial case, no recursion needed. | 2 |

**Dependencies**: Epics DD-02, DD-04 (repos), existing Entity/RPC infrastructure (Epic 7 from WBS V1)
**RFC Sections**: S36.13.1-S36.13.2
**Files**: `src/lib/iiot/entity/`, `src/lib/iiot/rpc/`, `src/lib/iiot/__tests__/integration/`

---

## Phase 2: Quality + Inventory (P1) — 114 SP

### Epic DD-06: Quality/SPC Schema & Identifiers — 18 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-06.1.1 | Branded IDs: `ControlChartId` (CCH-), `SpcSampleId` (SPC-), `InspectionId` (INS-), `NonConformanceId` (NCR-), `CapaId` (CAP-) in `src/lib/iiot/schemas/quality/identifiers.ts` | 2 |
| ⏳  | DD-06.1.2 | Enumerations: `ControlChartType` (9 types per ISO 7870), `InspectionDisposition`, `NcrSeverity`, `NcrStatus` (7 states), `CapaStatus` (7 states) in `src/lib/iiot/schemas/quality/enums.ts` | 2 |
| ⏳  | DD-06.2.1 | `ControlChart` entity (Schema.TaggedClass) -- SPC chart definition. Fields: characteristicName, chartType, partId, operationId, sensorId, usl/lsl/target, subgroupSize, ucl/cl/lcl, cp/cpk/pp/ppk, inControl. Method: isCapable() | 3 |
| ⏳  | DD-06.2.2 | `SpcSample` entity (Schema.TaggedClass) -- Subgroup measurement. Fields: controlChartId, measuredAt, values[], mean, range, standardDeviation, outOfControl, violatedRule, operatorId, workOrderId, lotId. Append-only. | 2 |
| ⏳  | DD-06.2.3 | `NonConformance` entity (Schema.TaggedClass) -- NCR (event-sourced). Fields: partId, operationId, workOrderId, machineId, severity, status, defectDescription, quantityAffected, lotId, rootCause, disposition, costOfQuality, capaId, reportedBy | 2 |
| ⏳  | DD-06.2.4 | `CapaAction` entity (Schema.TaggedClass) -- CAPA (event-sourced). Fields: capaType (corrective/preventive), status, problemDescription, rootCauseAnalysis, plannedActions, dueDate, verificationMethod, sourceNcrIds[], assignedTo | 2 |
| ⏳  | DD-06.2.5 | `InspectionRecord` entity (Schema.TaggedClass) -- Append-only regulatory record (AS9102 FAIR). Fields: partId, operationId, lotId, workOrderId, inspectionType (first_article/in_process/final/receiving), characteristics[] (name, nominal, tolerance, actual, pass), inspectedBy, inspectedAt, overallResult (pass/fail/conditional), serialNumber, certificateRef. Immutable once recorded. | 2 |
| ⏳  | DD-06.T.1 | **Schema tests** in `__tests__/schemas/quality.test.ts`: decode/encode roundtrip for all 5 entities. Branded ID validation (CCH-, SPC-, INS-, NCR-, CAP-). ControlChart.isCapable() with Cpk > 1.33 / < 1.33 / null. NcrStatus and CapaStatus enum completeness. SpcSample values[] array decode. InspectionRecord characteristics[] nested struct decode/encode. | 3 |

**Dependencies**: Epic DD-01 (PartId), Epic DD-03 (RoutingOperationId), existing SensorId/MachineId/WorkOrderId
**RFC Sections**: S36.5.1-S36.5.6
**Files**: `src/lib/iiot/schemas/quality/`, `src/lib/iiot/__tests__/schemas/`

---

### Epic DD-07: Quality Repository & DDL — 22 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-07.1.1 | DDL: `control_charts` table with FK to parts(id), optional FK to routing_operations(id) + sensors(id) + machines(id), indexes on (partId), (sensorId) | 2 |
| ⏳  | DD-07.1.2 | DDL: `spc_samples` as TimescaleDB hypertable (time-series) partitioned on measuredAt, FK to control_charts(id), ARRAY column for values. Compression policy for samples > 90 days. | 3 |
| ⏳  | DD-07.1.3 | DDL: `non_conformances` table with FK to parts(id), optional FKs to work_orders(id)/machines(id)/routing_operations(id), indexes on (status), (severity, status) | 2 |
| ⏳  | DD-07.1.4 | DDL: `capa_actions` table with FK array to non_conformances(id), indexes on (status), (dueDate) | 1 |
| ⏳  | DD-07.1.5 | DDL: `inspection_records` table with FK to parts(id), optional FKs to routing_operations(id) + work_orders(id) + inventory_lots(id), JSONB for characteristics[], indexes on (partId, inspectionType), (lotId), (inspectedAt). Append-only (no UPDATE/DELETE). | 2 |
| ⏳  | DD-07.2.1 | `ControlChartRepo` -- CRUD: create, findById, findByPart, findBySensor, updateLimits (recalculate UCL/CL/LCL), updateCapability (Cp/Cpk) | 2 |
| ⏳  | DD-07.2.2 | `SpcSampleRepo` -- Append: insertSample, findByChart (time-windowed), findByChartSince, aggregateByChart (mean/range/stddev over window) | 2 |
| ⏳  | DD-07.2.3 | `NonConformanceRepo` -- CRUD: create, findById, findByStatus, findByPart, findBySeverity, updateStatus, linkCapa | 2 |
| ⏳  | DD-07.2.4 | `CapaActionRepo` -- CRUD: create, findById, findByStatus, findOverdue (dueDate < now AND status != closed_*), updateStatus | 2 |
| ⏳  | DD-07.2.5 | `InspectionRecordRepo` -- Append: insertRecord, findById, findByPart, findByLot, findByType(inspectionType, dateRange), findByWorkOrder. No update/delete methods (regulatory immutability). | 2 |
| ⏳  | DD-07.3.1 | Migration `0032_quality_schema` aggregating all Quality DDLs | 1 |
| ⏳  | DD-07.T.1 | **Repo integration tests** in `__tests__/repos/quality.integration.test.ts`: ControlChartRepo CRUD + updateLimits + updateCapability. SpcSampleRepo append + time-windowed query + aggregate. NcrRepo CRUD + findByStatus + linkCapa. CapaRepo CRUD + findOverdue. | 3 |
| ⏳  | DD-07.T.2 | **TimescaleDB hypertable test** in `__tests__/integration/quality-timeseries.test.ts`: spc_samples partitioning verified, compression policy active on aged data, time-windowed query performance. | 1 |

**Dependencies**: Epic DD-06 (schemas), Epic DD-02 (BOM DDL for FK), Epic DD-04 (Routing DDL for FK)
**RFC Sections**: S36.5.4-S36.5.6
**Files**: `src/lib/iiot/infrastructure/ddl/`, `src/lib/iiot/repositories/`, `src/lib/iiot/__tests__/repos/`

---

### Epic DD-08: Quality Service — SPC Computation Engine — 11 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-08.1.1 | `SpcCalculationService` -- Effect.Service: calculateSubgroupStats (mean, range, stddev), Western Electric rules (4 rules), recalculateControlLimits (from 25+ subgroups), recalculateCapability (Cp, Cpk, Pp, Ppk per ISO 22514) | 5 |
| ⏳  | DD-08.1.2 | `SensorSpcBridge` -- Effect.Service: subscribes to sensor readings stream, aggregates into subgroups based on ControlChart.subgroupSize and samplingFrequency, auto-creates SpcSamples. Connects existing SensorReading stream to ControlChart. | 3 |
| ⏳  | DD-08.T.1 | **SPC calculation tests** in `__tests__/services/spc-calculation.test.ts`: calculateSubgroupStats with known dataset (verify mean/range/stddev). Western Electric Rule 1 (1 point > 3σ), Rule 2 (9 consecutive same side), Rule 3 (6 consecutive increasing/decreasing), Rule 4 (14 alternating). recalculateControlLimits with 25 subgroups. recalculateCapability: Cpk > 1.33 capable, Cpk < 1.0 incapable, Cpk with offset (mean ≠ target). | 2 |
| ⏳  | DD-08.T.2 | **Sensor-SPC bridge test** in `__tests__/services/sensor-spc-bridge.test.ts`: emit N sensor readings -> verify subgroup aggregation at correct subgroupSize boundary -> verify SpcSample created via repo. Out-of-control detection: emit values triggering Rule 1 -> verify outOfControl flag + violatedRule populated. **Use `it()` + `Effect.runPromise` for stream tests (NOT `it.effect()`).** | 1 |

**Dependencies**: Epic DD-07 (repos), existing SensorReading/streaming infrastructure
**RFC Sections**: S36.5.5 (Sensor -> SPC Bridge)
**Files**: `src/lib/iiot/services/l2/`

---

### Epic DD-09: Quality Entity & RPC — Event-Sourced NCR/CAPA + CRUD Quality Entities — 20 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-09.1.1 | NCR event schemas: `NcrCreated`, `NcrContained`, `NcrInvestigated`, `NcrDispositioned`, `NcrClosed` in `src/lib/iiot/schemas/events/ncr-events.ts` | 2 |
| ⏳  | DD-09.1.2 | CAPA event schemas: `CapaInitiated`, `CapaInvestigated`, `CapaActionPlanned`, `CapaImplemented`, `CapaVerified`, `CapaClosed` in `src/lib/iiot/schemas/events/capa-events.ts` | 2 |
| ⏳  | DD-09.2.1 | `NonConformanceEntity` -- Entity.make + Machine.boot. ES handler: process NCR lifecycle commands, emit events to EventJournal. Follows AlarmEntity pattern. | 2 |
| ⏳  | DD-09.2.2 | `CapaActionEntity` -- Entity.make + Machine.boot. ES handler: process CAPA lifecycle commands. | 2 |
| ⏳  | DD-09.2.3 | `ControlChartEntity` -- Entity.make('ControlChart', [Create, UpdateLimits, UpdateCapability, Get, FindByPart, FindBySensor]). CRUD configuration entity. Delegates to ControlChartRepo. | 2 |
| ⏳  | DD-09.3.1 | `QualityRpcs` -- EntityProxy.toRpcGroup for NCR + CAPA + ControlChart entities. Stateless query RPCs for SpcSample (time-range read) + InspectionRecord (read by part/lot/workOrder). Register in IIoTRpcs. | 2 |
| ⏳  | DD-09.T.1 | **NCR Machine tests** in `__tests__/machines/ncr-machine.test.ts`: every valid state transition (open -> under_investigation -> disposition_pending -> rework -> closed, etc.), every invalid transition rejected (open -> closed skipping investigation), error mapping (MachineNcrNotFoundError -> RpcNcrNotFoundError). | 3 |
| ⏳  | DD-09.T.2 | **CAPA Machine tests** in `__tests__/machines/capa-machine.test.ts`: linear lifecycle (initiated -> ... -> closed_effective), branch at verification (closed_effective vs closed_ineffective), invalid skip transitions rejected. | 2 |
| ⏳  | DD-09.T.3 | **NCR/CAPA ES integration test** in `__tests__/integration/quality-es.test.ts`: full NCR lifecycle -> verify EventJournal events persisted in order. CAPA lifecycle -> verify events. NCR->CAPA link: create NCR -> trigger CAPA -> verify sourceNcrIds. **Use `it()` + `Effect.runPromise` for PubSub tests (NOT `it.effect()`).** | 3 |

**Dependencies**: Epic DD-08 (SPC triggers NCR), existing EventJournal infrastructure (Epic 7)
**RFC Sections**: S36.12.2, S36.13.2 (Quality RPCs)
**Files**: `src/lib/iiot/entity/`, `src/lib/iiot/handlers/`, `src/lib/iiot/rpc/`, `src/lib/iiot/__tests__/machines/`

---

### Epic DD-10: Inventory Schema & Identifiers — 10 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-10.1.1 | Branded IDs: `InventoryLocationId` (ILC-), `InventoryLotId` (LOT-), `MaterialMovementId` (MMV-), `WipSnapshotId` in `src/lib/iiot/schemas/inventory/identifiers.ts` | 2 |
| ⏳  | DD-10.1.2 | Enumerations: `LocationType` (8 types), `LotStatus` (5 states), `MovementType` (10 types) in `src/lib/iiot/schemas/inventory/enums.ts` | 1 |
| ⏳  | DD-10.2.1 | `InventoryLocation` entity (Schema.TaggedClass) -- ISA-95 StorageZone. Fields: areaId, locationType, capacityKg, isActive | 1 |
| ⏳  | DD-10.2.2 | `InventoryLot` entity (Schema.TaggedClass) -- ISA-95 MaterialLot (event-sourced). Fields: partId, locationId, supplierLot, status, quantityOnHand, parentLotId (lot splitting), workOrderId, expiresAt | 2 |
| ⏳  | DD-10.2.3 | `MaterialMovement` entity (Schema.TaggedClass) -- The event log itself. Fields: movementType, lotId, fromLocationId, toLocationId, quantity, workOrderId, routingOperationId, performedBy, performedAt | 2 |
| ⏳  | DD-10.2.4 | `WipSnapshot` entity (Schema.TaggedClass) -- Point-in-time. Fields: siteId, takenAt, locations[] (nested: locationId, lots[]), totalValueUsd | 1 |
| ⏳  | DD-10.T.1 | **Schema tests** in `__tests__/schemas/inventory.test.ts`: decode/encode roundtrip for InventoryLocation, InventoryLot, MaterialMovement, WipSnapshot. Branded ID validation (ILC-, LOT-, MMV-). LotStatus + MovementType enum completeness. InventoryLot.parentLotId optional field decode (null and present). WipSnapshot nested locations[] array decode/encode. | 2 |

**Dependencies**: Epic DD-01 (PartId), Epic DD-03 (RoutingOperationId), existing AreaId/SiteId/WorkOrderId
**RFC Sections**: S36.8.1-S36.8.3
**Files**: `src/lib/iiot/schemas/inventory/`

---

### Epic DD-11: Inventory Repository & DDL — 13 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-11.1.1 | DDL: `inventory_locations` table with FK to areas(id), index on (areaId, locationType), unique on (areaId, name) | 1 |
| ⏳  | DD-11.1.2 | DDL: `inventory_lots` table with FK to parts(id) + inventory_locations(id), optional FK to work_orders(id), self-FK for parentLotId, indexes on (partId, status), (locationId), (expiresAt) | 2 |
| ⏳  | DD-11.1.3 | DDL: `material_movements` as TimescaleDB hypertable on performedAt. FK to inventory_lots(id), optional FKs to inventory_locations(id) x2 + work_orders(id) + routing_operations(id). Indexes on (lotId), (workOrderId), (movementType, performedAt) | 3 |
| ⏳  | DD-11.1.4 | DDL: `wip_snapshots` table with JSONB for locations array, FK to sites(id), index on (siteId, takenAt) | 1 |
| ⏳  | DD-11.2.1 | `InventoryLocationRepo` -- CRUD: create, findById, findByArea, findByType | 1 |
| ⏳  | DD-11.2.2 | `InventoryLotRepo` -- CRUD: create, findById, findByPart, findByLocation, findByStatus, updateQuantity, updateStatus, findExpiringSoon(daysAhead) | 2 |
| ⏳  | DD-11.2.3 | `MaterialMovementRepo` -- Append: insertMovement, findByLot, findByWorkOrder, findByType (time-windowed). Aggregate: totalConsumed(partId, dateRange), totalProduced(partId, dateRange) | 2 |
| ⏳  | DD-11.3.1 | Migration `0033_inventory_schema` | 1 |
| ⏳  | DD-11.T.1 | **Repo integration tests** in `__tests__/repos/inventory.integration.test.ts`: LocationRepo CRUD + findByType. LotRepo CRUD cycle (create -> findByPart -> findByLocation -> updateQuantity -> findExpiringSoon). MaterialMovementRepo append + findByLot chain + time-windowed findByType + aggregate totalConsumed/totalProduced. Self-FK: parentLotId for lot splitting. | 3 |
| ⏳  | DD-11.T.2 | **DDL migration + TimescaleDB test** in `__tests__/integration/inventory-ddl.test.ts`: tables exist, FK constraints enforced (Part, Location, self-FK parentLotId). material_movements hypertable partitioning verified, compression policy active. wip_snapshots JSONB column accepts nested structure. Unique constraint on (areaId, name) rejects duplicates. | 1 |

**Dependencies**: Epic DD-10 (schemas), Epic DD-02 (BOM DDL for Part FK)
**RFC Sections**: S36.8.3-S36.8.4
**Files**: `src/lib/iiot/infrastructure/ddl/`, `src/lib/iiot/repositories/`

---

### Epic DD-12: Inventory Entity & RPC — Event-Sourced Lot + CRUD Location — 16 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-12.1.1 | Inventory event schemas: `LotReceived`, `LotTransferred`, `LotIssuedToProduction`, `LotConsumed`, `LotQuarantined`, `LotReleased`, `LotScrapped`, `LotAdjusted` in `src/lib/iiot/schemas/events/inventory-events.ts` | 3 |
| ⏳  | DD-12.1.2 | `InventoryLocationEntity` -- Entity.make('InventoryLocation', [Create, Update, Deactivate, Get, FindByArea, FindByType]). CRUD master data. Delegates to InventoryLocationRepo. | 2 |
| ⏳  | DD-12.2.1 | `InventoryLotEntity` -- Entity.make('InventoryLot', [Receive, Transfer, IssueToProduction, Consume, Quarantine, Release, Scrap, Adjust]) + Machine.boot. Each command produces a MaterialMovement event AND updates lot state. | 3 |
| ⏳  | DD-12.2.2 | `InsufficientQuantityError` -- Schema.TaggedError: lotId, requested, available, message | 1 |
| ⏳  | DD-12.3.1 | `InventoryRpcs` -- EntityProxy.toRpcGroup(InventoryLotEntity) + EntityProxy.toRpcGroup(InventoryLocationEntity). Stateless query RPCs for MaterialMovement history (by lot, workOrder, dateRange) + WipSnapshot read. Register in IIoTRpcs. | 2 |
| ⏳  | DD-12.T.1 | **InventoryLot Machine tests** in `__tests__/machines/inventory-lot-machine.test.ts`: every valid transition (available -> allocated -> consumed, available -> quarantined -> available, available -> in_transit -> available). Every invalid transition rejected (consumed -> available, expired -> allocated). InsufficientQuantityError on consume > available. Lot splitting: parentLotId populated correctly. | 3 |
| ⏳  | DD-12.T.2 | **Inventory ES integration test** in `__tests__/integration/inventory-es.test.ts`: full lot lifecycle (receive -> transfer -> issue -> consume -> verify quantity chain + EventJournal events in order). MaterialMovement dual persistence: each lot command produces paired MaterialMovement record. Quarantine + release cycle. Lot adjustment reconciliation. **Use `it()` + `Effect.runPromise` for PubSub tests (NOT `it.effect()`).** | 2 |

**Dependencies**: Epic DD-11 (repos), existing EventJournal infrastructure
**RFC Sections**: S36.8.4, S36.12.2, S36.13.2
**Files**: `src/lib/iiot/entity/`, `src/lib/iiot/handlers/`, `src/lib/iiot/rpc/`

---

## Phase 3: Scheduling (P2) — 50 SP

### Epic DD-13: Scheduling Schema & Identifiers — 10 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-13.1.1 | Branded IDs: `ScheduleId` (SCH-), `ScheduledJobId` (SJB-), `CapacitySlotId` (CSL-) in `src/lib/iiot/schemas/scheduling/identifiers.ts` | 1 |
| ⏳  | DD-13.1.2 | Enumerations: `ScheduleStatus` (4 states), `JobPriority` (5 levels inc. aog_expedite), `ConstraintType` (7 types) in `src/lib/iiot/schemas/scheduling/enums.ts` | 1 |
| ⏳  | DD-13.2.1 | `ProductionSchedule` entity (Schema.TaggedClass) -- CRUD. Fields: siteId, horizonStart/End, status, publishedAt/By | 2 |
| ⏳  | DD-13.2.2 | `ScheduledJob` entity (Schema.TaggedClass) -- Event-sourced. Fields: scheduleId, workOrderId, routingOperationId, workCenterId, priority, scheduledStart/End, setupDuration, runDuration, actualStart/End, quantity, constraints[] | 3 |
| ⏳  | DD-13.2.3 | `CapacitySlot` entity (Schema.TaggedClass) -- CRUD. Fields: workCellId, date, shiftName, totalMinutes, availableMinutes, scheduledJobIds[] | 1 |
| ⏳  | DD-13.T.1 | **Schema tests** in `__tests__/schemas/scheduling.test.ts`: decode/encode roundtrip for ProductionSchedule, ScheduledJob, CapacitySlot. Branded ID validation (SCH-, SJB-, CSL-). JobPriority enum completeness (esp. aog_expedite). ConstraintType enum (7 types). ScheduledJob.constraints[] JSONB decode. CapacitySlot.scheduledJobIds[] ARRAY decode. Optional fields: actualStart/End null when job not yet started. | 2 |

**Dependencies**: Epic DD-03 (RoutingOperationId), existing WorkOrderId/WorkCellId/SiteId
**RFC Sections**: S36.6.1-S36.6.3
**Files**: `src/lib/iiot/schemas/scheduling/`

---

### Epic DD-14: Scheduling Repository & DDL — 12 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-14.1.1 | DDL: `production_schedules` table with FK to sites(id), indexes on (siteId, status), (horizonStart, horizonEnd) | 2 |
| ⏳  | DD-14.1.2 | DDL: `scheduled_jobs` table with FK to production_schedules(id) + work_orders(id) + routing_operations(id) + work_cells(id), JSONB constraints column, indexes on (scheduleId, priority), (workCenterId, scheduledStart), (workOrderId) | 3 |
| ⏳  | DD-14.1.3 | DDL: `capacity_slots` table with FK to work_cells(id), ARRAY for scheduledJobIds, indexes on (workCellId, date), unique on (workCellId, date, shiftName) | 2 |
| ⏳  | DD-14.2.1 | `ProductionScheduleRepo` -- CRUD: create, findById, findBySite, findByStatus, publish (status transition) | 1 |
| ⏳  | DD-14.2.2 | `ScheduledJobRepo` -- CRUD: create, findById, findBySchedule, findByWorkCenter(dateRange), findByWorkOrder, findConflicting(workCenterId, timeRange), updateTimes, recordActuals | 2 |
| ⏳  | DD-14.2.3 | `CapacitySlotRepo` -- CRUD: create, findByWorkCenter(dateRange), updateAvailableMinutes, addScheduledJob, removeScheduledJob | 1 |
| ⏳  | DD-14.3.1 | Migration `0034_scheduling_schema` | 1 |
| ⏳  | DD-14.T.1 | **Repo integration tests** in `__tests__/repos/scheduling.integration.test.ts`: ProductionScheduleRepo CRUD + publish transition. ScheduledJobRepo CRUD + findByWorkCenter range query + findConflicting (overlapping time range returns conflict, non-overlapping returns empty) + recordActuals. CapacitySlotRepo addScheduledJob + removeScheduledJob + verify availableMinutes deduction. | 3 |
| ⏳  | DD-14.T.2 | **DDL migration test** in `__tests__/integration/scheduling-ddl.test.ts`: tables exist, FK constraints enforced (production_schedules -> sites, scheduled_jobs -> work_orders/routing_operations). JSONB constraints column accepts valid + rejects malformed. Unique constraint on (workCellId, date, shiftName) rejects duplicates. | 1 |

**Dependencies**: Epic DD-13 (schemas), Epic DD-04 (Routing DDL for FK)
**RFC Sections**: S36.6.3
**Files**: `src/lib/iiot/infrastructure/ddl/`, `src/lib/iiot/repositories/`

---

### Epic DD-15: Scheduling Entity & RPC — Event-Sourced Jobs + CRUD Schedule/Capacity — 17 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-15.1.1 | Scheduling event schemas: `JobScheduled`, `JobRescheduled`, `JobStarted`, `JobCompleted`, `JobExpedited`, `JobHeld` in `src/lib/iiot/schemas/events/scheduling-events.ts` | 2 |
| ⏳  | DD-15.2.1 | `ScheduledJobEntity` -- Entity.make('ScheduledJob', [Schedule, Reschedule, Start, Complete, Expedite, Hold]) + Machine.boot. Schedule/Reschedule check capacity conflicts via repo. | 3 |
| ⏳  | DD-15.2.2 | `SchedulingConflictError` -- Schema.TaggedError: conflictingJobId, workCenterId, overlapStart/End, message | 1 |
| ⏳  | DD-15.2.3 | `ProductionScheduleEntity` -- Entity.make('ProductionSchedule', [Create, Publish, Get, FindBySite]). CRUD. Publish transitions status from draft -> published. Delegates to ProductionScheduleRepo. | 2 |
| ⏳  | DD-15.2.4 | `CapacitySlotEntity` -- Entity.make('CapacitySlot', [Create, AddJob, RemoveJob, Get, FindByWorkCenter]). CRUD. Updates availableMinutes on add/remove. Delegates to CapacitySlotRepo. | 2 |
| ⏳  | DD-15.3.1 | `SchedulingRpcs` -- EntityProxy.toRpcGroup(ScheduledJobEntity) + EntityProxy.toRpcGroup(ProductionScheduleEntity) + EntityProxy.toRpcGroup(CapacitySlotEntity). Register in IIoTRpcs. | 1 |
| ⏳  | DD-15.T.1 | **ScheduledJob Machine tests** in `__tests__/machines/scheduled-job-machine.test.ts`: every valid transition (scheduled -> started -> completed, scheduled -> held -> started -> completed, scheduled -> expedited). Every invalid transition rejected (completed -> started, held -> completed skipping start). SchedulingConflictError on overlapping time ranges at same workCenterId. Expedite: verify priority elevation. | 3 |
| ⏳  | DD-15.T.2 | **Scheduling ES integration test** in `__tests__/integration/scheduling-es.test.ts`: full job lifecycle (schedule -> start -> complete -> verify EventJournal events in order). Schedule adherence: actualStart/End vs scheduledStart/End deviation calculation. Reschedule: verify capacity rebalancing (old slot released, new slot consumed). Hold + resume cycle. **Use `it()` + `Effect.runPromise` for PubSub tests (NOT `it.effect()`).** | 2 |
| ⏳  | DD-15.T.3 | **RPC roundtrip test** in `__tests__/integration/scheduling-rpc.test.ts`: Schedule -> Get roundtrip. Start -> Get (verify actualStart populated). Complete -> Get (verify actualEnd populated). Error case: SchedulingConflictError surfaces through RPC failure channel. | 1 |

**Dependencies**: Epic DD-14 (repos), existing EventJournal infrastructure
**RFC Sections**: S36.6.4, S36.12.2, S36.13.2
**Files**: `src/lib/iiot/entity/`, `src/lib/iiot/handlers/`, `src/lib/iiot/rpc/`

---

### Epic DD-16: Scheduling Service — Capacity Analysis — 7 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-16.1.1 | `CapacityAnalysisService` -- Effect.Service: calculateUtilization(workCenterId, dateRange), findAvailableSlots(workCenterId, durationNeeded, dateRange), calculateScheduleAdherence(scheduleId), identifyJobsAtRisk(scheduleId) | 3 |
| ⏳  | DD-16.1.2 | `ScheduleImpactService` -- Effect.Service: evaluateImpact(proposedJob) -> returns list of affected existing jobs. Used by Linda to answer "what happens if I insert this AOG?" | 2 |
| ⏳  | DD-16.T.1 | **Capacity service tests** in `__tests__/services/capacity-analysis.test.ts`: calculateUtilization with known slot data (100% utilized, 50%, 0%). findAvailableSlots returns correct windows when gaps exist. calculateScheduleAdherence with on-time/late/early jobs. identifyJobsAtRisk when job duration exceeds remaining capacity. ScheduleImpactService.evaluateImpact: insert AOG job -> returns displaced jobs list. | 2 |

**Dependencies**: Epic DD-15 (entity), Epic DD-14 (repos)
**RFC Sections**: S36.6.5
**Files**: `src/lib/iiot/services/l2/`

---

### Epic DD-17: WIP Snapshot Service — 4 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-17.1.1 | `WipSnapshotService` -- Effect.Service: takeSnapshot(siteId) -> reads all locations + lots, creates WipSnapshot record. reconcile(snapshotId, physicalCounts[]) -> generates adjustment MaterialMovements for discrepancies. | 3 |
| ⏳  | DD-17.T.1 | **WIP snapshot tests** in `__tests__/services/wip-snapshot.test.ts`: takeSnapshot aggregates all locations + lots into correct nested structure + calculates totalValueUsd. Reconcile: physical count > system -> generates positive adjustment MaterialMovement. Physical count < system -> negative adjustment. No discrepancy -> no movements generated. | 1 |

**Dependencies**: Epic DD-11 (Inventory repos)
**RFC Sections**: S36.8.3 (WipSnapshot)
**Files**: `src/lib/iiot/services/l2/`

---

### Epic DD-18: WBS Completion Verification — 4 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-18.1.1 | Barrel exports: `src/lib/iiot/schemas/bom/index.ts`, `routing/index.ts`, `quality/index.ts`, `scheduling/index.ts`, `inventory/index.ts`, `energy/index.ts` | 1 |
| ⏳  | DD-18.1.2 | Update `src/lib/iiot/schemas/identifiers.ts` with all 19 new branded ID re-exports | 1 |
| ⏳  | DD-18.1.3 | Update `src/lib/iiot/rpc/index.ts` with all 7 new RPC groups in IIoTRpcs combined group | 1 |
| ⏳  | DD-18.T.1 | **Import verification test** in `__tests__/integration/barrel-exports.test.ts`: import each barrel index and verify all expected exports are present (schema types, branded IDs, enums, RPC groups). Prevents silent regressions from missing re-exports. `bunx tsc --noEmit` on all barrel files. | 1 |

**Dependencies**: All prior epics
**RFC Sections**: S36.16.2 (File Locations)
**Files**: `src/lib/iiot/schemas/`, `src/lib/iiot/rpc/`

---

## Phase 4: Energy Management (P3) — 34 SP

### Epic DD-19: Energy Schema & Identifiers — 7 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-19.1.1 | Branded IDs: `EnergyReadingId` (ENR-), `EnergyBaselineId` (ENB-) in `src/lib/iiot/schemas/energy/identifiers.ts` | 1 |
| ⏳  | DD-19.1.2 | Enumerations: `EnergySource` (6 types), `MeteringScope` (6 levels) in `src/lib/iiot/schemas/energy/enums.ts` | 1 |
| ⏳  | DD-19.2.1 | `EnergyReading` entity (Schema.TaggedClass) -- Append-only time-series. Fields: assetRef (Schema.Union of equipment IDs), meteringScope, energySource, intervalStart/End, kwhConsumed, peakDemandKw, powerFactor, voltage, current, cost | 2 |
| ⏳  | DD-19.2.2 | `EnergyBaseline` entity (Schema.TaggedClass) -- ISO 50001 reference. Fields: assetRef, energySource, baselinePeriodStart/End, totalKwh, normalizedKwhPerUnit, productionUnits, regressionModel | 1 |
| ⏳  | DD-19.2.3 | `EnergyCostAllocation` entity (Schema.TaggedClass) -- Append-only cost record. Fields: workOrderId, lineId, energySource, periodStart/End, kwhAllocated, costAllocated, allocationMethod (direct_metered/proportional_runtime/proportional_output) | 1 |
| ⏳  | DD-19.T.1 | **Schema tests** in `__tests__/schemas/energy.test.ts`: decode/encode roundtrip for EnergyReading, EnergyBaseline, EnergyCostAllocation. Branded ID validation (ENR-, ENB-). EnergySource + MeteringScope enum completeness. Polymorphic assetRef (Schema.Union) decode with MachineId vs LineId vs SiteId. AllocationMethod enum. EnergyBaseline.regressionModel JSONB decode. | 2 |

**Dependencies**: Existing equipment hierarchy IDs (SiteId, LineId, MachineId, etc.)
**RFC Sections**: S36.7.1-S36.7.3
**Files**: `src/lib/iiot/schemas/energy/`

---

### Epic DD-20: Energy Repository & DDL — 10 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-20.1.1 | DDL: `energy_readings` as TimescaleDB hypertable on intervalStart. Polymorphic assetRef column (text + assetType discriminator), indexes on (assetRef, energySource, intervalStart), (peakDemandKw DESC for billing peak). Compression for readings > 30 days. | 3 |
| ⏳  | DD-20.1.2 | DDL: `energy_baselines` table with polymorphic assetRef, indexes on (assetRef, energySource), unique on (assetRef, energySource, baselinePeriodStart) | 1 |
| ⏳  | DD-20.1.3 | DDL: `energy_cost_allocations` table with FK to work_orders(id) + lines(id), indexes on (workOrderId), (lineId, periodStart) | 1 |
| ⏳  | DD-20.2.1 | `EnergyReadingRepo` -- Append: insertReading, findByAsset(source, timeRange, interval aggregation), getPeakDemand(siteId, billingPeriod), getAverageKwh(assetRef, timeRange) | 2 |
| ⏳  | DD-20.2.2 | `EnergyBaselineRepo` -- CRUD: create, findByAsset, findCurrent(assetRef, energySource). `EnergyCostAllocationRepo` -- Append: allocate, findByWorkOrder, findByLine(dateRange) | 2 |
| ⏳  | DD-20.3.1 | Migration `0035_energy_schema` | 1 |
| ⏳  | DD-20.T.1 | **Repo integration tests** in `__tests__/repos/energy.integration.test.ts`: EnergyReadingRepo append + findByAsset time-windowed + getPeakDemand (verify MAX over billing period) + getAverageKwh. EnergyBaselineRepo CRUD + findCurrent returns latest baseline. EnergyCostAllocationRepo allocate + findByWorkOrder + findByLine date range filter. | 2 |
| ⏳  | DD-20.T.2 | **TimescaleDB + DDL test** in `__tests__/integration/energy-ddl.test.ts`: energy_readings hypertable partitioning verified, compression policy active on aged data. Polymorphic assetRef query with different asset types. Unique constraint on baselines (assetRef, energySource, baselinePeriodStart). FK constraints on cost_allocations. | 1 |

**Dependencies**: Epic DD-19 (schemas)
**RFC Sections**: S36.7.3-S36.7.4
**Files**: `src/lib/iiot/infrastructure/ddl/`, `src/lib/iiot/repositories/`

---

### Epic DD-21: Energy Entity, RPC & Service — 10 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-21.1.1 | `EnergyBaselineEntity` -- Entity.make('EnergyBaseline', [Create, Update, Get, FindByAsset, FindCurrent]). CRUD. ISO 50001 baselines are versioned, not evented. Delegates to EnergyBaselineRepo. | 2 |
| ⏳  | DD-21.1.2 | `EnergyRpcs` -- EntityProxy.toRpcGroup(EnergyBaselineEntity) + stateless query RPCs: GetEnergyReadings(assetRef, source, from, to, interval), GetPeakDemand(siteId, billingPeriod), GetEnergyCostAllocations(workOrderId). Register in IIoTRpcs. | 2 |
| ⏳  | DD-21.1.3 | `EnergyAnalysisService` -- Effect.Service: calculateEnPI(assetRef, source, period vs baseline), calculateDemandCharge(siteId, tariffPerKw), projectMonthlyCharge(siteId, currentPeak) | 2 |
| ⏳  | DD-21.2.1 | Register EnergyRpcs in IIoTRpcs. Wire EnergyBaselineEntity proxy handlers. | 1 |
| ⏳  | DD-21.T.1 | **Energy RPC + service tests** in `__tests__/integration/energy-rpc.test.ts`: EnergyBaseline.Create -> EnergyBaseline.Get roundtrip. EnergyBaseline.FindCurrent returns latest. Stateless query roundtrip: GetEnergyReadings, GetPeakDemand, GetEnergyCostAllocations. EnergyAnalysisService: calculateEnPI with known baseline (improvement/regression detection), calculateDemandCharge with tariff, projectMonthlyCharge extrapolation from current peak. | 3 |

**Dependencies**: Epic DD-20 (repos), existing Sensor/streaming infrastructure
**RFC Sections**: S36.7.4, S36.13.3
**Files**: `src/lib/iiot/rpc/`, `src/lib/iiot/services/l2/`

---

### Epic DD-22: Energy Cost Attribution — 7 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-22.1.1 | `EnergyCostAttributionService` -- Effect.Service: allocateByDirectMeter(workOrderId, meterReadings), allocateByRuntime(workOrderId, lineId, runTimeMinutes), allocateByOutput(workOrderId, lineId, unitsProduced). Chooses method based on metering granularity. | 3 |
| ⏳  | DD-22.1.2 | `DemandResponseService` -- Effect.Service: evaluateStaggerOpportunity(siteId, scheduledJobs[]) -> suggests timing shifts to avoid demand peaks. Cross-domain: reads scheduling data + energy readings. | 2 |
| ⏳  | DD-22.T.1 | **Cost attribution tests** in `__tests__/services/energy-cost-attribution.test.ts`: allocateByDirectMeter with known meter readings -> verify kwhAllocated matches sum of readings. allocateByRuntime with known runtime -> verify proportional allocation. allocateByOutput with known output -> verify per-unit cost. Method selection: direct_metered when meter data available, fallback to proportional_runtime, then proportional_output. | 1 |
| ⏳  | DD-22.T.2 | **Demand response tests** in `__tests__/services/demand-response.test.ts`: evaluateStaggerOpportunity with peak-concentrated schedule -> suggests shifts. Already-staggered schedule -> no changes suggested. Cross-domain verification: reads from both scheduling and energy repos correctly. | 1 |

**Dependencies**: Epic DD-21 (EnergyRpcs), Epic DD-15 (ScheduledJobEntity for cross-domain)
**RFC Sections**: S36.7.3 (EnergyCostAllocation), S36.10.1 (Energy -> Scheduling flow)
**Files**: `src/lib/iiot/services/l2/`

---

## Cross-Domain Integration (Spanning All Phases) — 29 SP

### Epic DD-23: Derived Atoms (Fermions) — 10 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-23.1.1 | `bomFermion.ts` -- partsAtom, bomLinesAtom (family), bomCostAtom (derived: sum line costs), flatBomAtom (derived: recursive explosion) | 2 |
| ⏳  | DD-23.1.2 | `routingFermion.ts` -- routingOpsAtom (family), routingBatchTimeAtom (derived), workCenterLoadAtom (derived) | 1 |
| ⏳  | DD-23.1.3 | `qualityFermion.ts` -- spcSamplesAtom (family), chartInControlAtom (derived: last 20 samples), runningCpkAtom (derived: ISO 22514 calc), openNcrCountAtom (derived) | 2 |
| ⏳  | DD-23.1.4 | `schedulingFermion.ts` -- scheduleJobsAtom (family), workCenterUtilizationAtom (derived), scheduleAdherenceAtom (derived), jobsAtRiskAtom (derived) | 1 |
| ⏳  | DD-23.1.5 | `energyFermion.ts` -- energyReadingsAtom (family), billingPeakDemandAtom (derived), energyIntensityAtom (derived), demandChargeProjectionAtom (derived) | 1 |
| ⏳  | DD-23.1.6 | `inventoryFermion.ts` -- locationLotsAtom (family), partLotsAtom (family), partAvailableQuantityAtom (derived: by location + status), wipValueAtom (derived), expiringLotsAtom (derived) | 2 |
| ⏳  | DD-23.T.1 | **Fermion derivation tests** in `__tests__/fermion/data-domains.test.ts` using `Registry.make()`: bomCostAtom derives correct total from bomLines (add lines -> verify sum). flatBomAtom recursive explosion (multi-level BOM flattens correctly). chartInControlAtom with 20 in-control samples (true), then add out-of-control (false). partAvailableQuantityAtom sums correctly by location + status filter. expiringLotsAtom filters by expiresAt threshold. | 2 |

**Dependencies**: All schema epics (DD-01, DD-03, DD-06, DD-10, DD-13, DD-19)
**RFC Sections**: S36.3.6, S36.4.6, S36.5.6, S36.6.5, S36.7.4, S36.8.5
**Files**: `src/lib/iiot/fermion/`

---

### Epic DD-24: Cross-Domain Event Propagation — 10 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-24.1.1 | NCR -> Inventory: when NCR created, auto-quarantine affected lot via InventoryLotEntity.Quarantine. Event handler subscribes to NCR events. | 2 |
| ⏳  | DD-24.1.2 | NCR -> Scheduling: when NCR created with quantityAffected, inject rework time into schedule. Calculate additional cycle time from Routing, create rework ScheduledJob. | 2 |
| ⏳  | DD-24.1.3 | SPC out-of-control -> Alarm: when SpcSample.outOfControl = true, auto-create Alarm via existing AlarmEntity.Create. Bridges Quality domain to existing alarm infrastructure. | 2 |
| ⏳  | DD-24.1.4 | Material received -> Scheduling: when InventoryLot.Receive fires, check for material-constrained ScheduledJobs and unblock them (remove 'material' constraint). | 2 |
| ⏳  | DD-24.T.1 | **Cross-domain event propagation tests** in `__tests__/integration/cross-domain-events.test.ts`: NCR->Inventory: create NCR with lotId -> verify lot quarantined. NCR->Scheduling: create NCR with quantityAffected -> verify rework ScheduledJob created. SPC->Alarm: insert out-of-control SpcSample -> verify Alarm created. MaterialReceived->Scheduling: receive lot for constrained material -> verify material constraint removed from blocked job. **Use `it()` + `Effect.runPromise` for all PubSub-based cross-domain tests.** | 2 |

**Dependencies**: Epics DD-09, DD-12, DD-15 (event-sourced entities), existing AlarmEntity
**RFC Sections**: S36.9.1 (Order-to-Shipment flow), S36.10.2 (Event Propagation)
**Files**: `src/lib/iiot/handlers/`

---

### Epic DD-25: Commons Projections — 9 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-25.1.1 | `CommonsBomView` schema -- redacted BOM projection (no costs, no supplier data). Shared structure only. | 1 |
| ⏳  | DD-25.1.2 | `CommonsQualityView` schema -- aggregated Cpk/Ppk statistics (no raw measurements). For customer quality audits (AS9102 FAIR). | 1 |
| ⏳  | DD-25.1.3 | `CommonsInventoryView` schema -- lot status only (available/allocated), no quantities. For subcontractor material availability. | 1 |
| ⏳  | DD-25.1.4 | `CommonsEnergyView` schema -- site-level EnPIs for ESG reporting. No per-machine granularity. | 1 |
| ⏳  | DD-25.2.1 | `CommonsProjectionService` -- Effect.Service: projectBom(bomId, redactionLevel), projectQuality(partId, dateRange), projectInventory(partId), projectEnergy(siteId, period). Enforces field-level access control per S36.14.1 shareable matrix. | 3 |
| ⏳  | DD-25.T.1 | **Commons projection tests** in `__tests__/services/commons-projections.test.ts`: projectBom verifies cost fields stripped, supplier data removed, structure preserved. projectQuality returns aggregated Cpk/Ppk but no raw SpcSample values. projectInventory returns status but no quantities. projectEnergy returns site-level EnPIs but no per-machine data. Field-level redaction verification: all sensitive fields absent in projection output. | 2 |

**Dependencies**: All schema + repo epics, network-architect's multi-tenant architecture
**RFC Sections**: S36.14.1-S36.14.4
**Files**: `src/lib/iiot/services/l2/`, `src/lib/iiot/schemas/commons/`

---

## E2E Stack Layers (Missing from Initial WBS) — 76 SP

These epics close the gap between Schema definitions and fully operational entities. WBS V1 established a 10-layer vertical stack; the initial WBS covered Schemas, DDL/Repos, Services, Entities, RPCs, and Fermions. These epics add the 4 missing layers: **Model Derivation**, **Error Schemas**, **HTTP Endpoints**, and **Streaming RPCs**.

### Epic DD-26: Model Derivation Layer — 21 SP

Model.Class from `@effect/sql` derives PostgreSQL-aware types from domain schemas. Each domain needs Model classes with `Model.Generated` for auto-increment PKs, `Model.FieldOption` for nullable columns, `Model.DateTimeInsertFromDate` for timestamps, and `Model.JsonFromString` for JSONB columns.

**Pattern reference**: `src/lib/iiot/models/alarms/AlarmModel.ts`, `src/lib/iiot/models/_common.ts`

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-26.1.1 | `PartModel`, `BomHeaderModel`, `BomLineModel` in `src/lib/iiot/models/bom/`. PartModel: Model.Generated(PartId), Model.FieldOption for supersededBy/shelfLifeDays, OptionalMetadata. BomHeaderModel: Model.Generated(BomId), Model.FieldOption for expirationDate. BomLineModel: Model.Generated(BomLineId), Model.FieldOption for componentBomId/operationId (nullable FKs). | 3 |
| ⏳  | DD-26.1.2 | `WorkCenterModel`, `RoutingModel`, `RoutingOperationModel` in `src/lib/iiot/models/routing/`. WorkCenterModel: ARRAY columns for machineIds/workCellIds/lineIds as `Model.JsonFromString`. RoutingOperationModel: Model.FieldOption for dependsOn (JSONB). | 3 |
| ⏳  | DD-26.2.1 | `ControlChartModel`, `SpcSampleModel`, `InspectionRecordModel` in `src/lib/iiot/models/quality/`. ControlChartModel: extensive Model.FieldOption for ucl/cl/lcl/cp/cpk/pp/ppk (nullable until computed). SpcSampleModel: Model.JsonFromString for values[] array, Model.FieldOption for violatedRule. | 3 |
| ⏳  | DD-26.2.2 | `NonConformanceModel`, `CapaActionModel` in `src/lib/iiot/models/quality/`. NCR: many Model.FieldOption fields (rootCause, disposition, costOfQuality — nullable until investigation). CAPA: Model.FieldOption for rootCauseAnalysis, verificationMethod, Model.JsonFromString for sourceNcrIds/plannedActions. | 2 |
| ⏳  | DD-26.3.1 | `InventoryLocationModel`, `InventoryLotModel`, `MaterialMovementModel`, `WipSnapshotModel` in `src/lib/iiot/models/inventory/`. LotModel: Model.FieldOption for parentLotId/workOrderId/expiresAt. MovementModel: Model.FieldOption for fromLocationId/toLocationId (not all movements have both). WipModel: Model.JsonFromString for locations[] nested structure. | 3 |
| ⏳  | DD-26.4.1 | `ProductionScheduleModel`, `ScheduledJobModel`, `CapacitySlotModel` in `src/lib/iiot/models/scheduling/`. JobModel: Model.FieldOption for actualStart/actualEnd (null until execution), Model.JsonFromString for constraints[]. SlotModel: ARRAY column for scheduledJobIds. | 2 |
| ⏳  | DD-26.5.1 | `EnergyReadingModel`, `EnergyBaselineModel`, `EnergyCostAllocationModel` in `src/lib/iiot/models/energy/`. ReadingModel: polymorphic assetRef handling (text + discriminator). BaselineModel: Model.JsonFromString for regressionModel. | 2 |
| ⏳  | DD-26.6.1 | Shared model transforms: extend `src/lib/iiot/models/_common.ts` with any new common transforms needed (e.g., ArrayFromPg for ARRAY columns, PolymorphicAssetRef). Barrel exports from each domain's `models/` index.ts. | 1 |
| ⏳  | DD-26.T.1 | **Model derivation tests** in `__tests__/models/data-domain-models.test.ts`: for each domain (BOM, Routing, Quality, Inventory, Scheduling, Energy) — create entity via Schema.TaggedClass -> verify Model.Class round-trips through insert/select. Model.Generated auto-increments. Model.FieldOption handles null -> Option.none. Model.JsonFromString for JSONB columns (constraints[], values[], locations[]). Model.DateTimeInsertFromDate for timestamps. ArrayFromPg for ARRAY columns (machineIds[], scheduledJobIds[]). | 3 |

**Dependencies**: All schema epics (DD-01, DD-03, DD-06, DD-10, DD-13, DD-19)
**RFC Sections**: S36.3-S36.8 (entity definitions)
**Files**: `src/lib/iiot/models/bom/`, `models/routing/`, `models/quality/`, `models/inventory/`, `models/scheduling/`, `models/energy/`

---

### Epic DD-27: Error Schema Layer — 14 SP

Domain-specific `Data.TaggedError` types for each operational data domain. Each domain produces a union error type used in RPC failure channels and entity command rejection.

**Pattern reference**: `src/lib/iiot/errors/alarm.ts`, `src/lib/iiot/errors/common.ts`

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-27.1.1 | `src/lib/iiot/errors/bom.ts` -- `PartNotFoundError`, `BomNotFoundError`, `BomLineNotFoundError`, `CircularBomError` (recursive BOM detected), `PhantomBomResolutionError` (phantom assembly has no sub-BOM), `DuplicatePartRevisionError`. Union: `BomCommandError`. | 2 |
| ⏳  | DD-27.1.2 | `src/lib/iiot/errors/routing.ts` -- `RoutingNotFoundError`, `WorkCenterNotFoundError`, `OperationNotFoundError`, `DuplicateOperationNumberError`, `InvalidDependencyError` (depends on nonexistent operation), `RoutingAlreadyReleasedError`. Union: `RoutingCommandError`. | 2 |
| ⏳  | DD-27.2.1 | `src/lib/iiot/errors/quality.ts` -- `ControlChartNotFoundError`, `NcrNotFoundError`, `CapaNotFoundError`, `InvalidNcrTransitionError` (invalid status transition), `CapaAlreadyClosedError`, `InspectionNotFoundError`, `ControlLimitsNotCalculatedError` (< 25 subgroups). Union: `QualityCommandError`. | 2 |
| ⏳  | DD-27.2.2 | `src/lib/iiot/errors/inventory.ts` -- `LocationNotFoundError`, `LotNotFoundError`, `InsufficientQuantityError` (includes available/requested), `LotQuarantinedError` (can't issue quarantined lot), `LotExpiredError`, `DuplicateLotReceiptError`, `InvalidMovementError` (from/to location mismatch). Union: `InventoryCommandError`. | 2 |
| ⏳  | DD-27.3.1 | `src/lib/iiot/errors/scheduling.ts` -- `ScheduleNotFoundError`, `JobNotFoundError`, `CapacitySlotNotFoundError`, `SchedulingConflictError` (overlapping job), `InsufficientCapacityError`, `InvalidJobTransitionError`, `MaterialConstraintError` (material not available). Union: `SchedulingCommandError`. | 2 |
| ⏳  | DD-27.3.2 | `src/lib/iiot/errors/energy.ts` -- `EnergyReadingNotFoundError`, `BaselineNotFoundError`, `InvalidAllocationMethodError`, `BaselinePeriodOverlapError`, `InsufficientMeteringDataError`. Union: `EnergyCommandError`. | 1 |
| ⏳  | DD-27.4.1 | Update `src/lib/iiot/errors/index.ts` barrel exports with all 6 new domain error modules. | 1 |
| ⏳  | DD-27.T.1 | **Error schema tests** in `__tests__/errors/data-domain-errors.test.ts`: for each domain error union (BomCommandError, RoutingCommandError, QualityCommandError, InventoryCommandError, SchedulingCommandError, EnergyCommandError) — verify _tag discrimination, instanceof checks, error message formatting. CircularBomError and InsufficientQuantityError carry contextual fields. All errors extend Data.TaggedError. Union type exhaustiveness: switch on _tag covers all members. | 2 |

**Dependencies**: All schema epics (DD-01, DD-03, DD-06, DD-10, DD-13, DD-19) — error types reference domain entity IDs
**RFC Sections**: S36.3-S36.8 (entity lifecycle rules define failure modes)
**Files**: `src/lib/iiot/errors/`

---

### Epic DD-28: HTTP API Layer — 19 SP

REST endpoints via `EntityProxy.toHttpApiGroup` for entity-backed domains and `HttpApiBuilder.group` for stateless query domains. Follows `src/lib/iiot/http/api.ts` + `proxy-handlers.ts` pattern.

**Pattern reference**: `src/lib/iiot/http/api.ts`, `src/lib/iiot/http/proxy-handlers.ts`, `src/lib/iiot/http/query-handlers.ts`

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-28.1.1 | Register BOM entities in `IIoTApi`: `EntityProxy.toHttpApiGroup('bom-headers', BomHeaderEntity).prefix('/api/bom')`, `EntityProxy.toHttpApiGroup('parts', PartEntity).prefix('/api/parts')`. Note: BomLine ops go through BomHeader entity. | 2 |
| ⏳  | DD-28.1.2 | Register Routing entities: `EntityProxy.toHttpApiGroup('routings', RoutingEntity).prefix('/api/routings')`, `EntityProxy.toHttpApiGroup('work-centers', WorkCenterEntity).prefix('/api/work-centers')`. | 2 |
| ⏳  | DD-28.2.1 | Register Quality entities: `EntityProxy.toHttpApiGroup('non-conformances', NonConformanceEntity).prefix('/api/ncr')`, `EntityProxy.toHttpApiGroup('capa-actions', CapaActionEntity).prefix('/api/capa')`, `EntityProxy.toHttpApiGroup('control-charts', ControlChartEntity).prefix('/api/quality/charts')`. Stateless query group for SpcSample (time-range read) + InspectionRecord (read by part/lot/workOrder, append-only insert). | 2 |
| ⏳  | DD-28.2.2 | Register Inventory entities: `EntityProxy.toHttpApiGroup('inventory-lots', InventoryLotEntity).prefix('/api/inventory/lots')`, `EntityProxy.toHttpApiGroup('inventory-locations', InventoryLocationEntity).prefix('/api/inventory/locations')`. Stateless query group for MaterialMovement history and WipSnapshot read. | 2 |
| ⏳  | DD-28.3.1 | Register Scheduling entities: `EntityProxy.toHttpApiGroup('scheduled-jobs', ScheduledJobEntity).prefix('/api/scheduling/jobs')`, `EntityProxy.toHttpApiGroup('production-schedules', ProductionScheduleEntity).prefix('/api/scheduling/schedules')`, `EntityProxy.toHttpApiGroup('capacity-slots', CapacitySlotEntity).prefix('/api/scheduling/capacity')`. | 2 |
| ⏳  | DD-28.3.2 | Register Energy entities + query group: `EntityProxy.toHttpApiGroup('energy-baselines', EnergyBaselineEntity).prefix('/api/energy/baselines')`. Stateless query group: GET endpoints for readings, peak demand, cost allocations. Append-only insert for EnergyReading + EnergyCostAllocation. | 2 |
| ⏳  | DD-28.4.1 | `ProxyHandlers` layer updates in `proxy-handlers.ts`: add `EntityProxyServer.layerHttpApi(IIoTApi, 'domain', Entity)` for each entity-backed domain (BomHeader, Part, Routing, WorkCenter, NCR, CAPA, ControlChart, InventoryLot, InventoryLocation, ScheduledJob, ProductionSchedule, CapacitySlot, EnergyBaseline). | 2 |
| ⏳  | DD-28.4.2 | Query handler implementations in `query-handlers.ts`: `HttpApiBuilder.group(IIoTApi, 'group-name', handlers => ...)` for BOM explosion query, SPC sample time-range queries, InspectionRecord read endpoints, MaterialMovement history, WipSnapshot read, energy readings/peak demand/cost allocations. Append-only POST handlers for SpcSample, InspectionRecord, EnergyReading, EnergyCostAllocation. | 2 |
| ⏳  | DD-28.T.1 | **HTTP endpoint tests** in `__tests__/integration/http-data-domains.test.ts`: entity-backed endpoints: POST + GET roundtrip for all 13 entity-backed endpoints (BomHeader, Part, Routing, WorkCenter, NCR, CAPA, ControlChart, InventoryLot, InventoryLocation, ScheduledJob, ProductionSchedule, CapacitySlot, EnergyBaseline). Append-only endpoints: SpcSample, InspectionRecord, EnergyReading POST + GET. Query endpoints: BOM explosion, MaterialMovement history. Error status codes: 404 for NotFound, 409 for InvalidTransition/Conflict, 422 for validation failures. Content-type verification (application/json). | 3 |

**Dependencies**: All entity epics (DD-05, DD-09, DD-12, DD-15), Epic DD-21 (Energy RPCs)
**RFC Sections**: S36.13.1-S36.13.3 (RPC definitions map to HTTP endpoints)
**Files**: `src/lib/iiot/http/api.ts`, `src/lib/iiot/http/proxy-handlers.ts`, `src/lib/iiot/http/query-handlers.ts`

---

### Epic DD-29: Streaming RPC Layer — 13 SP

Real-time WebSocket subscriptions via `Rpc.make` with `stream: true`. Extends the existing `RealtimeRpcs` group with domain-specific subscription streams for live dashboards.

**Pattern reference**: `src/lib/iiot/rpc/RealtimeRpcs.ts`

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-29.1.1 | Quality streaming event schemas: `SpcOutOfControlEvent` (chartId, sampleId, violatedRule, values), `NcrStatusChangeEvent` (ncrId, fromStatus, toStatus, timestamp), `CapaStatusChangeEvent`. Add to `RealtimeRpcs` or new `QualityRealtimeRpcs`. | 2 |
| ⏳  | DD-29.1.2 | `Realtime.SubscribeSpcAlerts` -- `Rpc.make('Realtime.SubscribeSpcAlerts', { ..., stream: true })`. Streams SpcOutOfControlEvent when any chart goes out of control. Filter by partId, operationId, or chartId. | 2 |
| ⏳  | DD-29.2.1 | Inventory streaming event schemas: `InventoryMovementEvent` (lotId, movementType, quantity, from, to), `LotStatusChangeEvent` (lotId, fromStatus, toStatus), `LowStockAlertEvent` (partId, locationId, quantityOnHand, reorderPoint). | 2 |
| ⏳  | DD-29.2.2 | `Realtime.SubscribeInventoryMovements` -- Streams MaterialMovement events in real time. Filter by locationId, partId, or movementType. `Realtime.SubscribeLowStock` -- Streams low-stock alerts. | 2 |
| ⏳  | DD-29.3.1 | Scheduling streaming event schemas: `JobStateChangeEvent` (jobId, fromState, toState, actualTimestamp), `ScheduleAdherenceEvent` (jobId, scheduledStart, actualStart, deviationMinutes). | 1 |
| ⏳  | DD-29.3.2 | `Realtime.SubscribeScheduleChanges` -- Streams job lifecycle events. Filter by scheduleId, workCenterId. `Realtime.SubscribeAdherence` -- Streams deviation alerts when jobs start/end outside threshold. | 2 |
| ⏳  | DD-29.4.1 | `Realtime.SubscribeEnergyDemand` -- Streams EnergyReading events with peak demand alerts when approaching billing threshold. Filter by siteId, energySource. | 1 |
| ⏳  | DD-29.5.1 | Register all new streaming RPCs in IIoTRpcs combined group. Wire handlers to EventDistribution channels (extend ChannelService with new domain channels). | 1 |
| ⏳  | DD-29.T.1 | **Streaming RPC tests** in `__tests__/integration/streaming-data-domains.test.ts`: for each streaming RPC (SubscribeSpcAlerts, SubscribeInventoryMovements, SubscribeLowStock, SubscribeScheduleChanges, SubscribeAdherence, SubscribeEnergyDemand) — subscribe -> trigger domain event -> verify stream delivers correct event type. Filter tests: subscribe with partId filter -> only matching events delivered. ChannelService channel registration verification. **Use `it()` + `Effect.runPromise` for ALL streaming tests (NOT `it.effect()`).** | 2 |

**Dependencies**: All entity epics (DD-09, DD-12, DD-15), Epic DD-21 (Energy), existing EventDistribution/ChannelService infrastructure
**RFC Sections**: S36.13.2 (Streaming subscriptions), S36.10.2 (Event propagation)
**Files**: `src/lib/iiot/rpc/`, `src/lib/iiot/streaming/`

---

### Epic DD-30: Model + Error Integration Testing — 5 SP

Validates that the Model and Error layers compose correctly with repos, entities, and RPCs across all 6 domains.

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-30.1.1 | Model roundtrip tests: for each domain, create entity via Schema -> persist via Model.Class insert -> read back -> decode to domain type. Verifies Model.Generated, Model.FieldOption, Model.JsonFromString roundtrip fidelity. | 2 |
| ⏳  | DD-30.1.2 | Error propagation tests: for each event-sourced entity (NCR, CAPA, InventoryLot, ScheduledJob), trigger invalid state transition -> verify correct Data.TaggedError is raised -> verify error surfaces through RPC failure channel with proper _tag. | 2 |
| ⏳  | DD-30.1.3 | HTTP error serialization test: trigger domain errors through HTTP endpoints -> verify proper HTTP status codes (404 for NotFound, 409 for Conflict/InvalidTransition, 422 for Validation). | 1 |

**Dependencies**: Epics DD-26 through DD-29
**RFC Sections**: S36.12 (Error handling strategy)
**Files**: `src/lib/iiot/__tests__/integration/`

---

### Epic DD-31: E2E Stack Barrel Exports & Wiring — 4 SP

Final wiring to ensure all new layers are properly exported and registered in the main service composition.

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-31.1.1 | Model barrel exports: `src/lib/iiot/models/bom/index.ts`, `models/routing/index.ts`, `models/quality/index.ts`, `models/inventory/index.ts`, `models/scheduling/index.ts`, `models/energy/index.ts`. Update `models/index.ts` master barrel. | 1 |
| ⏳  | DD-31.1.2 | Verify HTTP proxy handler Layer.mergeAll includes all new entity handlers. Verify IIoTApi .add() includes all new entity groups + query groups. | 1 |
| ⏳  | DD-31.1.3 | Verify IIoTRpcs combined group includes all new domain RPCs + streaming RPCs. Verify EventDistribution channel registration for new domain event types. | 1 |
| ⏳  | DD-31.T.1 | **Wiring smoke test** in `__tests__/integration/e2e-wiring.test.ts`: `bunx tsc --noEmit` verifying all barrel imports compile. Layer.mergeAll with all proxy handlers resolves without missing dependencies. IIoTRpcs group type-checks with all domain RPCs present. EventDistribution channel count matches expected (existing + new domain channels). | 1 |

**Dependencies**: Epics DD-26 through DD-30, DD-32, DD-33
**RFC Sections**: S36.16.2 (File organization)
**Files**: `src/lib/iiot/models/`, `src/lib/iiot/http/`, `src/lib/iiot/rpc/`

---

### Epic DD-32: Machine-Backed Entity Infrastructure — State Graphs + Machines + Observer Wiring — 41 SP

The 4 Machine-backed entities (NonConformance, CapaAction, ScheduledJob, InventoryLot) each require a state graph (`Graph.directed`), a Machine definition (`Machine.make` with `Machine.procedures`), and observer registration (`makeEntityObserver` wiring into `Machine.changes`). This is the core of the 13-layer stack that distinguishes Machine entities from CRUD.

**Pattern reference**: `src/lib/iiot/machines/graphs/alarm-state-graph.ts`, `src/lib/iiot/machines/AlarmMachine.ts`

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-32.1.1 | **NCR State Graph** in `src/lib/iiot/machines/graphs/ncr-state-graph.ts`. States: open, under_investigation, disposition_pending, rework, scrap, use_as_is, closed. Transitions: Report (-> open), Investigate (open -> under_investigation), Disposition (under_investigation -> disposition_pending -> rework/scrap/use_as_is), Close (rework/scrap/use_as_is -> closed). Validators: `canInvestigateNcr()`, `canDispositionNcr()`, `canCloseNcr()`. Per FDA 21 CFR Part 11. | 2 |
| ⏳  | DD-32.1.2 | **NCR Machine** in `src/lib/iiot/machines/NonConformanceMachine.ts`. Machine.make with deps: NcrState, FeatureFlags. Internal requests: InternalCreateNcr, InternalInvestigateNcr, InternalContainNcr, InternalDispositionNcr, InternalCloseNcr, InternalGetNcr. Each procedure validates transition via ncr-state-graph, mutates state, emits events via maybeEmitNcr(). | 3 |
| ⏳  | DD-32.2.1 | **CAPA State Graph** in `src/lib/iiot/machines/graphs/capa-state-graph.ts`. States: initiated, root_cause_analysis, action_planned, action_in_progress, verification, closed_effective, closed_ineffective. Linear with one branch at verification (effective/ineffective). Validators: `canInvestigateCapa()`, `canPlanAction()`, `canImplementAction()`, `canVerifyCapa()`, `canCloseCapa()`. | 2 |
| ⏳  | DD-32.2.2 | **CAPA Machine** in `src/lib/iiot/machines/CapaActionMachine.ts`. Machine.make with deps: CapaState, FeatureFlags. Internal requests: InternalCreateCapa, InternalInvestigateCapa, InternalPlanAction, InternalImplementAction, InternalVerifyCapa, InternalCloseCapa. Branching at verification: VerifyEffective (-> closed_effective) or VerifyIneffective (-> closed_ineffective, triggers new CAPA). | 3 |
| ⏳  | DD-32.3.1 | **ScheduledJob State Graph** in `src/lib/iiot/machines/graphs/scheduled-job-graph.ts`. States: scheduled, started, paused, completed, held, expedited (priority modifier, not terminal). Transitions: Schedule (-> scheduled), Start (scheduled/held -> started), Pause (started -> paused), Resume (paused -> started), Complete (started -> completed), Hold (scheduled -> held), Expedite (any non-terminal -> expedited priority). Validators: `canStartJob()`, `canPauseJob()`, `canCompleteJob()`, `canHoldJob()`. | 2 |
| ⏳  | DD-32.3.2 | **ScheduledJob Machine** in `src/lib/iiot/machines/ScheduledJobMachine.ts`. Machine.make with deps: JobState, CapacitySlotRepo, FeatureFlags. Internal requests: InternalScheduleJob (checks capacity conflicts), InternalRescheduleJob (updates capacity), InternalStartJob (records actual start), InternalCompleteJob (records actual end, calculates adherence), InternalHoldJob, InternalExpediteJob. | 3 |
| ⏳  | DD-32.4.1 | **InventoryLot State Graph** in `src/lib/iiot/machines/graphs/inventory-lot-graph.ts`. States: available, allocated, in_transit, quarantined, consumed, scrapped, expired. Transitions: Receive (-> available), Allocate (available -> allocated), Transfer (available/allocated -> in_transit -> available), Quarantine (available/allocated -> quarantined), Release (quarantined -> available), IssueToProduction (available -> allocated), Consume (allocated -> consumed), Scrap (any non-terminal -> scrapped), Expire (available/quarantined -> expired). Validators: `canAllocateLot()`, `canTransferLot()`, `canQuarantineLot()`, `canReleaseLot()`, `canConsumeLot()`. | 2 |
| ⏳  | DD-32.4.2 | **InventoryLot Machine** in `src/lib/iiot/machines/InventoryLotMachine.ts`. Machine.make with deps: LotState, LocationRepo, FeatureFlags. Internal requests: InternalReceiveLot (creates lot + MaterialMovement), InternalTransferLot (updates location + MaterialMovement), InternalIssueToProduction (checks available quantity), InternalConsumeLot (decrements quantity + MaterialMovement), InternalQuarantineLot, InternalReleaseLot, InternalScrapLot, InternalAdjustLot (reconciliation). Each procedure creates a paired MaterialMovement event. | 3 |
| ⏳  | DD-32.5.1 | **Entity.make + Machine.boot + Observer wiring** for all 4 Machine entities: `NonConformanceEntity`, `CapaActionEntity`, `ScheduledJobEntity`, `InventoryLotEntity` in `src/lib/iiot/entity/`. Each follows AlarmEntity.ts pattern: boot Machine in `Entity.toLayer(Effect.gen(...))`, delegate handlers to `actor.send(Internal*)`. Map Machine errors to RPC errors. **Additionally**: register `makeEntityObserver(entityType, machine.changes)` as a scoped fiber during entity activation. The observer subscribes to `Machine.changes` (Stream<State>), computes state diffs via `Stream.zipWithPrevious`, and publishes `EntityStateChanged` events to EventDistribution `iiot:entity-changes` channel. First emission has `Option.none()` for previousState — emit with action "initialized". | 4 |
| ⏳  | DD-32.5.2 | **State services** for Machine entities: `NcrState`, `CapaState`, `ScheduledJobState`, `InventoryLotState` in `src/lib/iiot/state/`. Follow AlarmState pattern: get/set/create operations, in-memory + persistent implementations. | 2 |
| ⏳  | DD-32.6.1 | **EntityStateChanged schemas** for data domain entities in `src/lib/iiot/schemas/events/entity-state-changed.ts`. Domain-specific discriminated variants: `NcrStateChanged`, `CapaStateChanged`, `ScheduledJobStateChanged`, `InventoryLotStateChanged`. Each carries: entityType, entityId, previousState (Option), currentState, action (derived from transition), timestamp, metadata (e.g., NCR severity, lot quantity). Register all variants in EventDistribution `iiot:entity-changes` channel. | 2 |
| ⏳  | DD-32.T.1 | **State graph tests** in `__tests__/machines/graphs/data-domain-graphs.test.ts`: for each graph (NCR, CAPA, ScheduledJob, InventoryLot) — every valid transition returns true via Graph.hasEdge. Every invalid transition returns false. Graph completeness: all states reachable from initial state. Terminal state verification: no outgoing edges from closed/consumed/scrapped/expired/completed. Validator functions: canInvestigateNcr(open)=true, canInvestigateNcr(closed)=false, etc. | 3 |
| ⏳  | DD-32.T.2 | **Machine procedure tests** in `__tests__/machines/data-domain-machines.test.ts`: for each Machine (NCR, CAPA, ScheduledJob, InventoryLot) — each procedure returns [result, newState]. State graph validation: procedure rejects invalid transitions with correct error _tag. InventoryLotMachine: quantity tracking across procedures (receive 100 -> consume 30 -> verify 70 remaining). ScheduledJobMachine: capacity conflict detection on schedule/reschedule. Error mapping: Machine errors map to RPC errors correctly. | 5 |
| ⏳  | DD-32.T.3 | **Entity lifecycle tests** in `__tests__/integration/machine-entity-lifecycle.test.ts`: for each Machine entity — full lifecycle through Entity.make + Machine.boot. NCR: create -> investigate -> disposition -> rework -> close. CAPA: create -> investigate -> plan -> implement -> verify effective -> close. ScheduledJob: schedule -> start -> complete (verify adherence). InventoryLot: receive -> transfer -> issue -> consume. RPC delegation: actor.send routes to correct Machine procedure. | 3 |
| ⏳  | DD-32.T.4 | **Observer wiring tests** in `__tests__/integration/machine-observer.test.ts`: for each Machine entity — trigger state transition via entity command -> verify `Machine.changes` emits new state -> verify observer catches emission and publishes `EntityStateChanged` to EventDistribution `iiot:entity-changes` channel. First activation: verify "initialized" action with `Option.none()` previousState. `Stream.zipWithPrevious` diff: transition open->under_investigation produces {previousState: "open", currentState: "under_investigation", action: "investigate"}. Channel subscription: subscribe to `iiot:entity-changes` -> trigger NCR transition -> verify event delivered. **Use `it()` + `Effect.runPromise` for all observer + EventDistribution tests (NOT `it.effect()`).** | 3 |

**Dependencies**: Epics DD-06, DD-10, DD-13 (schemas), Epics DD-07, DD-11, DD-14 (repos for state persistence), Epic DD-27 (error types), platform-architect Epics PL-07, PL-08, PL-09, PL-11 (observer infrastructure)
**RFC Sections**: S36.5.4 (NCR lifecycle), S36.5.5 (CAPA lifecycle), S36.6.3 (Job lifecycle), S36.8.3 (Lot lifecycle), S36.12.2 (ES implementation pattern), S12 (Observer Pattern & Entity Integration)
**Files**: `src/lib/iiot/machines/graphs/`, `src/lib/iiot/machines/`, `src/lib/iiot/entity/`, `src/lib/iiot/state/`, `src/lib/iiot/schemas/events/`

---

### Epic DD-33: Machine-Backed Entity Infrastructure — ES Handlers + Reactivity — 27 SP

EventLog.group projections and EventLog.groupReactivity cache invalidation for the 4 Machine-backed entities. Handlers project events to the read model (repos). Reactivity maps events to cache keys for invalidation.

**Pattern reference**: `src/lib/iiot/handlers/alarm-handlers.ts`, `src/lib/iiot/handlers/alarm-reactivity.ts`

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| ⏳  | DD-33.1.1 | **NCR Event Handlers** in `src/lib/iiot/handlers/ncr-handlers.ts`. `EventLog.group(NcrEvents, handlers => ...)`. Handlers: NcrCreated (insert to repo), NcrContained (update status + containment fields), NcrInvestigated (update rootCause), NcrDispositioned (update disposition + costOfQuality), NcrClosed (update status). All wrapped in `catchHandlerError`. Idempotent by design. | 3 |
| ⏳  | DD-33.1.2 | **NCR Reactivity** in `src/lib/iiot/handlers/ncr-reactivity.ts`. `EventLog.groupReactivity(NcrEvents, {...})`. Cache keys: NCR_OPEN, NCR_DASHBOARD (count by severity), NCR_BY_PART, NCR_CAPA_LINKED. NcrCreated -> [NCR_OPEN, NCR_DASHBOARD]. NcrClosed -> [NCR_OPEN, NCR_DASHBOARD, NCR_HISTORY]. | 2 |
| ⏳  | DD-33.2.1 | **CAPA Event Handlers** in `src/lib/iiot/handlers/capa-handlers.ts`. `EventLog.group(CapaEvents, handlers => ...)`. Handlers: CapaInitiated (insert), CapaInvestigated (update rootCauseAnalysis), CapaActionPlanned (update plannedActions), CapaImplemented (update status), CapaVerified (update verificationMethod + status), CapaClosed (update final status). | 3 |
| ⏳  | DD-33.2.2 | **CAPA Reactivity** in `src/lib/iiot/handlers/capa-reactivity.ts`. Cache keys: CAPA_OPEN, CAPA_OVERDUE, CAPA_DASHBOARD, CAPA_BY_NCR. CapaInitiated -> [CAPA_OPEN, CAPA_DASHBOARD]. CapaClosed -> [CAPA_OPEN, CAPA_DASHBOARD]. CapaVerified -> [CAPA_OPEN, CAPA_OVERDUE]. | 1 |
| ⏳  | DD-33.3.1 | **ScheduledJob Event Handlers** in `src/lib/iiot/handlers/scheduled-job-handlers.ts`. `EventLog.group(SchedulingEvents, handlers => ...)`. Handlers: JobScheduled (insert to repo + deduct capacity from CapacitySlot), JobRescheduled (update times + rebalance capacity), JobStarted (update actualStart), JobCompleted (update actualEnd, calculate adherence delta), JobHeld (update status + add constraint), JobExpedited (update priority). | 3 |
| ⏳  | DD-33.3.2 | **ScheduledJob Reactivity** in `src/lib/iiot/handlers/scheduled-job-reactivity.ts`. Cache keys: SCHEDULE_ACTIVE, SCHEDULE_ADHERENCE, CAPACITY_BY_WORKCENTER, JOBS_AT_RISK. JobScheduled -> [SCHEDULE_ACTIVE, CAPACITY_BY_WORKCENTER]. JobRescheduled -> [SCHEDULE_ACTIVE, CAPACITY_BY_WORKCENTER, SCHEDULE_ADHERENCE]. JobCompleted -> [SCHEDULE_ACTIVE, SCHEDULE_ADHERENCE]. | 2 |
| ⏳  | DD-33.4.1 | **InventoryLot Event Handlers** in `src/lib/iiot/handlers/inventory-handlers.ts`. `EventLog.group(InventoryEvents, handlers => ...)`. Handlers: LotReceived (insert lot + insert MaterialMovement), LotTransferred (update location + MaterialMovement), LotIssuedToProduction (update quantity/status + MaterialMovement), LotConsumed (update quantity + MaterialMovement), LotQuarantined (update status), LotReleased (update status), LotScrapped (update status + MaterialMovement), LotAdjusted (update quantity + MaterialMovement with adjustment delta). | 3 |
| ⏳  | DD-33.4.2 | **InventoryLot Reactivity** in `src/lib/iiot/handlers/inventory-reactivity.ts`. Cache keys: INVENTORY_BY_LOCATION, INVENTORY_BY_PART, INVENTORY_QUARANTINE, INVENTORY_LOW_STOCK, INVENTORY_EXPIRING, WIP_DASHBOARD. LotReceived -> [INVENTORY_BY_LOCATION, INVENTORY_BY_PART]. LotTransferred -> [INVENTORY_BY_LOCATION]. LotQuarantined -> [INVENTORY_QUARANTINE, INVENTORY_BY_LOCATION]. LotConsumed -> [INVENTORY_BY_PART, WIP_DASHBOARD, INVENTORY_LOW_STOCK]. | 2 |
| ⏳  | DD-33.5.1 | **Event group definitions** in `src/lib/iiot/schemas/events/groups.ts`. Define `NcrEvents`, `CapaEvents`, `SchedulingEvents`, `InventoryEvents` EventLog groups following `AlarmEvents` pattern. Register all event schemas in each group. | 1 |
| ⏳  | DD-33.T.1 | **ES handler tests** in `__tests__/handlers/data-domain-handlers.test.ts`: for each EventLog.group (NCR, CAPA, ScheduledJob, InventoryLot) — emit each event type -> verify repo updated correctly (insert/update/status change). Idempotency: emit same event twice -> no duplicate repo entries. catchHandlerError: handler errors don't propagate (logged, not thrown). NCR handler: NcrCreated inserts, NcrClosed updates status. Inventory handler: LotReceived creates lot + MaterialMovement, LotConsumed decrements quantity. | 3 |
| ⏳  | DD-33.T.2 | **Reactivity cache key tests** in `__tests__/handlers/data-domain-reactivity.test.ts`: for each EventLog.groupReactivity (NCR, CAPA, ScheduledJob, InventoryLot) — verify each event type maps to correct cache key set. NcrCreated -> [NCR_OPEN, NCR_DASHBOARD]. LotConsumed -> [INVENTORY_BY_PART, WIP_DASHBOARD, INVENTORY_LOW_STOCK]. JobScheduled -> [SCHEDULE_ACTIVE, CAPACITY_BY_WORKCENTER]. Coverage: every event in every group has at least one cache key mapping. | 2 |
| ⏳  | DD-33.T.3 | **ES roundtrip integration test** in `__tests__/integration/es-handler-roundtrip.test.ts`: emit event to EventJournal -> handler projects to read model -> verify read model updated. Full cycle for one entity per domain (NCR lifecycle, Lot receive+consume, Job schedule+complete). Reactivity: verify cache keys invalidated after event processing. **Use `it()` + `Effect.runPromise` for PubSub-based handler tests.** | 2 |

**Dependencies**: Epic DD-32 (Machines produce events that these handlers consume), Epics DD-07, DD-11, DD-14 (repos for projection writes), Epic DD-09 (NCR/CAPA event schemas), Epic DD-12 (Inventory event schemas), Epic DD-15 (Scheduling event schemas)
**RFC Sections**: S36.12.2 (ES implementation pattern), S36.10.2 (Event propagation)
**Files**: `src/lib/iiot/handlers/`, `src/lib/iiot/schemas/events/`

---

## Dependency Graph

```
Phase 1 (P0):
  Epic DD-01 (BOM Schema) ──────────┐
  Epic DD-02 (BOM DDL/Repo) ────────┤
  Epic DD-03 (Routing Schema) ──────┼──▶ Epic DD-05 (BOM+Routing Entity/RPC)
  Epic DD-04 (Routing DDL/Repo) ────┘

Phase 2 (P1):
  Epic DD-06 (Quality Schema) ──────┐
  Epic DD-07 (Quality DDL/Repo) ────┼──▶ Epic DD-08 (SPC Service) ──▶ Epic DD-09 (NCR/CAPA Entity)
                                 │
  Epic DD-10 (Inventory Schema) ────┤
  Epic DD-11 (Inventory DDL/Repo) ──┼──▶ Epic DD-12 (Inventory Entity/RPC)
                                 │
                                 └──▶ Epic DD-17 (WIP Snapshot)

Phase 3 (P2):
  Epic DD-13 (Scheduling Schema) ───┐
  Epic DD-14 (Scheduling DDL/Repo) ─┼──▶ Epic DD-15 (Scheduling Entity) ──▶ Epic DD-16 (Capacity Service)
                                 └──▶ Epic DD-18 (Barrel Exports)

Phase 4 (P3):
  Epic DD-19 (Energy Schema) ───────┐
  Epic DD-20 (Energy DDL/Repo) ─────┼──▶ Epic DD-21 (Energy RPC/Service) ──▶ Epic DD-22 (Cost Attribution)

Cross-Domain (all phases):
  All Schemas ──▶ Epic DD-23 (Derived Atoms/Fermions)
  All Entities ──▶ Epic DD-24 (Cross-Domain Event Propagation)
  All + Network ──▶ Epic DD-25 (Commons Projections)

E2E Stack Layers (parallel to all phases):
  All Schemas ──▶ Epic DD-26 (Model Derivation) ──▶ Epic DD-30 (Integration Tests)
  All Schemas ──▶ Epic DD-27 (Error Schemas) ──────▶ Epic DD-30 (Integration Tests)
  All Entities ──▶ Epic DD-28 (HTTP API Layer) ────▶ Epic DD-30 (Integration Tests)
  All Entities ──▶ Epic DD-29 (Streaming RPCs) ────▶ Epic DD-30 (Integration Tests)

Machine-Backed Entity Layers (4 entities: NCR, CAPA, ScheduledJob, InventoryLot):
  Schemas + Repos + Errors ──▶ Epic DD-32 (State Graphs + Machines + Observer Wiring) ──▶ Epic DD-33 (ES Handlers + Reactivity)
  Event Schemas (DD-09, DD-12, DD-15) ──▶ Epic DD-33 (ES Handlers consume event groups)
  Epic DD-32 ──▶ modifies Entity epics (DD-09, DD-12, DD-15) to use Machine.boot pattern
  platform-architect Epics PL-07, PL-08, PL-09, PL-11 (Observer infra) ──▶ Epic DD-32 (.5.1 observer registration, .6.1 EntityStateChanged schemas)
  Machine.changes ──▶ makeEntityObserver() ──▶ EntityStateChanged ──▶ EventDistribution iiot:entity-changes ──▶ Streaming RPCs (DD-29)

  Epics DD-26 through DD-33 ──▶ Epic DD-31 (Barrel Exports & Wiring)
```

---

## Cross-Domain Dependencies (Other WBS Architects)

| Dependency | From | To | Nature |
|------------|------|----|--------|
| Multi-tenant isolation | data-architect (Epic DD-25) | network-architect | Commons projections need tenant-scoped views |
| Pricing per domain | data-architect (all) | product-architect | Each domain has pricing implications (BOM = per-part, SPC = per-chart, etc.) |
| Existing entity patterns | data-architect (all) | platform-architect | Follow Entity.make, Machine.boot, EntityProxy.toRpcGroup patterns |
| Audit trail requirements | data-architect (Epics DD-09, DD-12) | security-architect | NCR/CAPA event sourcing supports FDA 21 CFR Part 11 |
| Equipment hierarchy IDs | data-architect (all) | platform-architect | All domains reference existing MachineId, LineId, SiteId, etc. |
| Sensor -> SPC bridge | data-architect (Epic DD-08) | platform-architect | SensorReading stream feeds ControlChart |
| **Observer infrastructure** | data-architect (Epic DD-32.5.1, DD-32.6.1) | **platform-architect (Epics PL-01, PL-02, PL-06, PL-07)** | `makeEntityObserver()` + `EntityStateChanged` + EventDistribution `iiot:entity-changes` channel. Data domain Machine entities REGISTER with platform's observer infra — they don't rebuild it. |
| Observer -> Streaming RPCs | data-architect (Epic DD-32) | data-architect (Epic DD-29) | EntityStateChanged events flow through `iiot:entity-changes` channel to streaming RPC subscriptions |

---

## SP Summary

| Phase | Epics | SP | Priority |
|-------|-------|-----|----------|
| Phase 1: BOM + Routing | DD-01 -- DD-05 | 80 | P0 (Immediate) |
| Phase 2: Quality + Inventory | DD-06 -- DD-12, DD-17 | 114 | P1 (Near-term) |
| Phase 3: Scheduling | DD-13 -- DD-16, DD-18 | 50 | P2 (Medium-term) |
| Phase 4: Energy | DD-19 -- DD-22 | 34 | P3 (Long-term) |
| Cross-Domain | DD-23 -- DD-25 | 29 | Spans all phases |
| E2E Stack Layers (all entities) | DD-26 -- DD-31 | 76 | Parallel to all phases |
| Machine-Backed Layers (Tier 1) | DD-32 -- DD-33 | 68 | Parallel to entity epics |
| **Total** | **33 epics** | **451 SP** | |

### Testing SP Breakdown

~124 SP of the total is dedicated testing (27% of total), distributed per-entity at each layer:

| Test Category | SP | Coverage |
|---------------|-----|----------|
| Schema roundtrip tests | 15 | All 6 domains |
| Repo integration tests | 18 | All repo layers + DDL migration verification |
| Machine transition tests | 14 | 4 Machine-backed entities (NCR, CAPA, ScheduledJob, InventoryLot) |
| ES integration tests | 9 | EventJournal + PubSub roundtrips |
| L2 service tests | 9 | BOM explosion/phantom, SPC, Capacity, WIP, Energy, DemandResponse |
| RPC roundtrip tests | 6 | Entity + stateless query RPCs (all CRUD entities now covered) |
| State graph tests | 3 | Graph.directed validation for 4 machines |
| Machine procedure tests | 5 | Machine.make + Machine.procedures |
| Entity lifecycle tests | 4 | Entity.make CRUD + Machine.boot full lifecycle (all entities) |
| Observer wiring tests | 3 | Machine.changes emission + makeEntityObserver + EntityStateChanged + EventDistribution roundtrip |
| ES handler + reactivity tests | 7 | EventLog.group + groupReactivity |
| Cross-domain event tests | 2 | NCR->Inventory, SPC->Alarm, etc. |
| Fermion derivation tests | 2 | Atom derivation correctness |
| HTTP endpoint tests | 3 | Status codes, content-type, error mapping |
| Streaming RPC tests | 2 | Subscribe + filter + event delivery |
| Model derivation tests | 3 | Model.Class roundtrip fidelity |
| Error schema tests | 2 | TaggedError discrimination + union exhaustiveness |
| Barrel/wiring smoke tests | 2 | Import verification + Layer.mergeAll resolution |
| Integration layer tests (Epic DD-30) | 5 | Model + Error + HTTP cross-layer |
| Commons projection tests | 2 | Field-level redaction verification |

---

## Implementation Notes

### E2E Stack Coverage (13 Layers for Machine-Backed, 8 for CRUD)

All 6 operational data domains now cover the full vertical stack. Machine-backed entities get 5 extra layers (Graph, Machine, ES Handler, Reactivity, Observer).

### Tier 2 (CRUD) — 8 Layers (All Entities)

| # | Layer | Epic(s) | Pattern |
|---|-------|---------|---------|
| 1 | Schema (TaggedClass + branded IDs) | DD-01, DD-03, DD-06, DD-10, DD-13, DD-19 | `Schema.TaggedClass`, `Schema.brand()` |
| 2 | Model Derivation | **DD-26** | `Model.Class` from `@effect/sql` |
| 3 | DDL / Migrations | DD-02, DD-04, DD-07, DD-11, DD-14, DD-20 | TimescaleDB hypertables + PostgreSQL |
| 4 | Repository | DD-02, DD-04, DD-07, DD-11, DD-14, DD-20 | `Effect.Service` with SQL queries |
| 5 | Error Schemas | **DD-27** | `Data.TaggedError` + union types |
| 6 | L2 Services | DD-05, DD-08, DD-16, DD-17, DD-21, DD-22 | `Effect.Service` business logic |
| 7 | RPC Groups | DD-05, DD-09, DD-12, DD-15, DD-21 | `EntityProxy.toRpcGroup()` |
| 8 | HTTP Endpoints | **DD-28** | `EntityProxy.toHttpApiGroup` + `HttpApiBuilder.group` |

### Tier 1 (Machine-Backed) — 5 EXTRA Layers (NCR, CAPA, ScheduledJob, InventoryLot)

| # | Layer | Epic(s) | Pattern |
|---|-------|---------|---------|
| 9 | **State Graph** | **DD-32** | `Graph.directed` with states + transitions |
| 10 | **Machine** | **DD-32** | `Machine.make` + `Machine.procedures` |
| 11 | **ES Handler** | **DD-33** | `EventLog.group` projections to read model |
| 12 | **Reactivity** | **DD-33** | `EventLog.groupReactivity` cache invalidation |
| 13 | **Observer** | **DD-32** (.5.1, .6.1) | `makeEntityObserver(entityType, Machine.changes)` -> `EntityStateChanged` via `iiot:entity-changes` channel. Uses `Stream.zipWithPrevious` (NOT `Stream.pairwise`). First emission: `Option.none()` previous = "initialized" action. Infrastructure from platform-architect Epics PL-07, PL-08, PL-09, PL-11; domain entities register only. |
| + | Entity (Machine.boot + Observer) | **DD-32** (.5.1) | `Entity.make` + `Entity.toLayer(Machine.boot(...))` + `makeEntityObserver()` scoped fiber |
| + | State Service | **DD-32** (.5.2) | get/set/create for Machine state |
| + | EntityStateChanged Schema | **DD-32** (.6.1) | Domain-specific variants: `NcrStateChanged`, `CapaStateChanged`, `ScheduledJobStateChanged`, `InventoryLotStateChanged` |

### Cross-Cutting Layers (Both Tiers)

| # | Layer | Epic(s) | Pattern |
|---|-------|---------|---------|
| + | Streaming RPCs | **DD-29** | `Rpc.make` with `stream: true` |
| + | Fermions (Atoms) | DD-23 | `Atom.family()` + `Atom.derived()` |
| + | Cross-Domain Events | DD-24 | Event handler subscriptions |
| + | Commons Projections | DD-25 | Field-level redacted views |
| + | Integration Tests | **DD-30** | Model roundtrip + error propagation |
| + | Barrel Exports | DD-18, **DD-31** | Index files + wiring verification |

**Bold** epics are the E2E stack layer epics (DD-26 through DD-33) added after the initial WBS.

### TimescaleDB Hypertables (3 new)

| Table | Partition Column | Compression | Retention |
|-------|-----------------|-------------|-----------|
| `spc_samples` | `measuredAt` | > 90 days | Indefinite (regulatory) |
| `material_movements` | `performedAt` | > 90 days | Indefinite (traceability) |
| `energy_readings` | `intervalStart` | > 30 days | Configurable per ISO 50001 |

### Standards Compliance Matrix

| Standard | Domain | Entities Involved |
|----------|--------|-------------------|
| ISO 7870 | Quality | ControlChart, SpcSample |
| ISO 22514 | Quality | ControlChart (Cp/Cpk/Pp/Ppk) |
| ISO 50001 | Energy | EnergyBaseline, EnergyReading |
| FDA 21 CFR Part 11 | Quality | NonConformance, CapaAction (event-sourced audit trail) |
| AS9102 | Quality | InspectionRecord, ControlChart |
| IATF 16949 | Quality | ControlChart (SPC mandate), NonConformance |
| ISA-95 | All | Entity hierarchy maps to ISA-95 Levels 2-4 |
| B2MML V0700 | BOM, Routing | ProductDefinition -> BomHeader, ProcessSegment -> RoutingOperation |
