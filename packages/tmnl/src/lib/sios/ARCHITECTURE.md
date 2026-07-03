# SIOS Architecture Plan

## Reference Architecture: `src/lib/iiot/`

The IIoT module is the canonical pattern. Every SIOS entity must follow the same vertical stack. This document maps that pattern to SIOS's 9 entities, identifies what exists, what's wrong, and what needs to be built — layer by layer, entity by entity.

---

## The IIoT Vertical (Per Entity)

Each entity in IIoT has **8 co-located layers** that compose into a full vertical:

```
Layer 1: Schema      schemas/assets/{entity}/schema.ts
                     → Schema.TaggedClass with METHODS (.isOperational(), etc.)
                     → CreateParams schema (what you need to create one)
                     → UpdateParams schema (what you can change)
                     → Entity-specific status enum
                     → Entity-specific identifier with branded prefix pattern

Layer 2: Model       models/assets/{Entity}Model.ts
                     → Model.Class mapping schema fields to SQL columns
                     → FieldOption for nullable columns
                     → DateTimeInsertFromDate for timestamps
                     → Co-located with DDL

Layer 3: DDL         models/assets/{Entity}Model.ddl.ts
                     → CREATE TABLE with CHECK constraints
                     → Indexes (status, FK, hierarchy)
                     → FK references to parent entities

Layer 4: Graph       machines/graphs/{entity}-graph.ts
                     → Graph.directed<StateNode, TransitionAction>
                     → Per-action validators (canBeginConstruction(), etc.)
                     → isTerminalState(), getValidNextStates()
                     → O(1) lookup after construction

Layer 5: State       state/{Entity}State.ts
                     → Context.Tag service interface (StateShape)
                     → create/get/set/list/delete/exists/count
                     → In-memory impl (Ref<Map>) for testing
                     → SQL adapter factory for production
                     → Per-entity filter type + not-found error

Layer 6: Machine     machines/{Entity}Machine.ts
                     → Machine.make() with procedures per operation
                     → Boots with deps: { state, flags }
                     → Internal TaggedRequest per operation
                     → Internal error types (MachineEntityNotFoundError, etc.)
                     → Each procedure: validate graph → mutate state → emit event
                     → Returns [result, newMachineState] tuple

Layer 7: Entity      entity/{Entity}Entity.ts
                     → Rpc.make() per operation (external contract)
                     → RPC error schemas (TaggedError)
                     → Entity.make(type, [...rpcs])
                     → .toLayer() handler that:
                       1. Yields state + flags from context
                       2. Boots machine
                       3. Maps each RPC to actor.send(InternalRequest)
                       4. Catches machine errors → maps to RPC errors

Layer 8: Repo        repos/{Entity}Repo.ts
                     → Context.Tag service
                     → Direct SQL queries for read-heavy operations
                     → Column alias helpers for camelCase mapping
                     → decode utilities (decodeOptional, decodeRows, decodeFirst)
                     → findById, findAll, findByParent, insert, update, delete
```

### Cross-Cutting Layers

```
EntityStack.ts       → Layer.mergeAll of all entity handlers
                     → EntityTestingStack (in-memory + flags disabled)
                     → EntityProductionHandlersWithEvents

http/api.ts          → HttpApi.make composing EntityProxy.toHttpApiGroup per entity
                     → Query groups for stateless reads
                     → Middleware (auth, rate limit)

http/query-api.ts    → HttpApiGroup per domain for read queries
http/query-handlers.ts → Direct SQL query implementations
http/proxy-handlers.ts → EntityProxyServer.layerHttpApi per entity
http/server.ts       → Layer composition for HTTP server boot
```

---

## SIOS Entity Mapping

### 9 Entities with Their Verticals

| Entity | Status Enum | Graph? | Machine? | Key Domain Logic |
|--------|-------------|--------|----------|------------------|
| **Project** | bidding→awarded→mobilising→active→commissioning→complete | Yes | Yes | Shift window, EVM rollup, delivery method |
| **Zone** | defined→active→commissioning→handed_over | Yes | Yes | Brownfield phase tracking, access constraints |
| **WorkPackage** | planned→active→suspended→complete→closed | Yes | Yes | **EVM boundary**, discipline-scoped, crew assignment, progress tracking |
| **Task** | pending→active→suspended→needs_evidence→done→blocked→cancelled | Yes | Yes | **7-state lifecycle**, evidence capture, cost code tracking |
| **Crew** | (no lifecycle states) | No | No | Discipline, shift pattern, foreman assignment, headcount |
| **Worker** | active→on_leave→badge_pending→badge_expired→cert_expired→offboarded | Yes | Yes | Cert tracking, badge expiry, rate tracking |
| **TimeEntry** | (no lifecycle states — append-only) | No | No | Hours × rate = cost, feeds EVM actual cost |
| **Issue** | open→assigned→in_progress→resolved→verified→closed | Yes | Yes | Severity, category, evidence, SLA tracking |
| **Checkpoint** | pending→ready→passed→failed→waived | Yes | Yes | Evidence requirements, commissioning gates |

### Which Entities Need Machines?

**Full machine (graph + state + machine):** Project, Zone, WorkPackage, Task, Worker, Issue, Checkpoint — 7 of 9.

**Simple CRUD (state service only, no graph):** Crew, TimeEntry — 2 of 9. These don't have meaningful lifecycle state transitions. Crew composition changes are mutations, not state transitions. TimeEntries are append-only records.

---

## Current State Audit

### What Exists (and its quality)

```
schemas/
  identifiers.ts    ✅ Good. 9 branded IDs. Keep.
  value-objects.ts   ✅ Good. 7 VOs. Keep but will need ShiftWindow/Evidence/Certification
                     to become TaggedClasses (methods needed).
  domain.ts          ⚠️  WRONG PATTERN. Has all 9 entities as TaggedStructs in one file.
                     Must be split into per-entity schema directories with TaggedClass.

models/
  WorkPackageModel.ts ⚠️  Exists but needs rework — must match per-entity schema.
  TaskModel.ts        ⚠️  Same.
  TimeEntryModel.ts   ⚠️  Same.
  (Missing: Project, Zone, Crew, Worker, Issue, Checkpoint models)
  (Missing: ALL .ddl.ts files)

services/
  EVMService.ts       ✅ Good. Pure calculation. Keep as-is. Not per-entity — cross-cutting.
  TaskStateMachine.ts  ⚠️  WRONG PATTERN. This is a flat transition map.
                      Must become Graph.directed with typed state nodes
                      and per-action validators, following site-graph.ts pattern.

entity/
  ALL FILES           ❌ WRONG PATTERN. RPCs defined with inline ad-hoc schemas.
                      Must reference per-entity TaggedClass schemas.
                      Handlers missing. Machine wiring missing.
                      Must follow SiteEntity.ts pattern: boot machine → delegate.

(Missing entirely)
  state/              State services per entity (in-memory + SQL adapter)
  machines/           Machine.make per entity with Internal* requests
  machines/graphs/    Graph.directed per entity
  repos/              Direct SQL repos per entity
  entity/EntityStack  Layer composition
  http/               API contract, handlers, query groups
```

---

## Build Plan — 3 Passes

### Pass 1: Foundation (Schemas + Graphs + State)

The bottom of the dependency graph. No external deps. Fully testable in isolation.

**For each of the 9 entities, create:**

```
schemas/{entity}/
  schema.ts          TaggedClass with methods, CreateParams, UpdateParams
  index.ts           Re-exports
```

**For the 7 entities with lifecycles, create:**

```
machines/graphs/
  {entity}-graph.ts   Graph.directed, typed nodes/actions, per-action validators
```

**For all 9 entities, create:**

```
state/
  {Entity}State.ts    Context.Tag, StateShape, filter type, not-found error,
                      in-memory impl (Ref<Map>)
```

**Order within Pass 1:**

1. `schemas/common/types.ts` — BaseFields shared across entities (like iiot's BaseAssetFields)
2. Schema files in dependency order: Project → Zone → WorkPackage → Task → TimeEntry → Crew → Worker → Issue → Checkpoint
3. Graphs in same order (only for the 7 with lifecycles)
4. State services in same order (all 9)

**Validation checkpoint:** Every schema compiles. Every graph has tests for valid/invalid transitions. Every in-memory state service can create/get/list.

### Pass 2: Machines + Entities + Models + DDL

The middle of the stack. Depends on Pass 1 outputs.

**For the 7 entities with lifecycles:**

```
machines/
  {Entity}Machine.ts   Machine.make, Internal* requests, procedures,
                       graph validation, state mutation, event emission
```

**For all 9 entities:**

```
entity/
  {Entity}Entity.ts    Rpc.make, RPC errors, Entity.make,
                       .toLayer() handler → boot machine → delegate

models/{entity}/
  {Entity}Model.ts     Model.Class matching schema fields
  {Entity}Model.ddl.ts CREATE TABLE + indexes
```

**Also create:**

```
entity/EntityStack.ts  Layer.mergeAll of all handlers
                       EntityTestingStack (in-memory + flags disabled)

models/_migrations.ts  Migrator.fromRecord composing all DDLs
models/_common.ts      Shared model helpers (CreatedAt, OptionalMetadata)
```

**Order within Pass 2:**

1. Common model helpers
2. Models + DDL (all 9, dependency order)
3. Machines (7 with lifecycles)
4. Entities (all 9, handlers wired)
5. EntityStack composition
6. Migration runner

**Validation checkpoint:** EntityTestingStack boots without errors. Can create a Project → Zone → WorkPackage → Task → complete the task → verify EVM update flows.

### Pass 3: API + Repos + HTTP

The top of the stack. Depends on Pass 2 outputs.

```
repos/
  _decode.ts           Shared decode utilities
  {Entity}Repo.ts      Direct SQL repos (9 files)

http/
  api.ts               SiosApi extends HttpApi, composes all entity groups
  query-api.ts         HttpApiGroup for EVM rollups, dashboard queries
  query-handlers.ts    Direct SQL implementations
  proxy-handlers.ts    EntityProxyServer.layerHttpApi per entity
  server.ts            Layer composition for HTTP boot
```

**Validation checkpoint:** OpenAPI spec generates. REST endpoints respond. EVM dashboard query returns zone-level CPI/SPI.

---

## Entity-Specific Design Notes

### Project

**TaggedClass methods:**
- `isActive()`: status is 'active' or 'commissioning'
- `isNightShift()`: shiftWindow is defined
- `productiveHoursPerShift()`: derives from shiftWindow
- `shiftProductivityCoefficient()`: derives from shiftWindow
- `isBrownfield()`: siteCondition starts with 'brownfield'

**Graph transitions:**
```
bidding → awarded → mobilising → active → commissioning → complete
  ↓                    ↓           ↓          ↓
cancelled          on_hold      on_hold    on_hold
                   (↔ mobilising) (↔ active) (↔ commissioning)
```

**State filter:** by status, projectType, integrator, siteCondition

### Zone

**TaggedClass methods:**
- `isBrownfieldPhase()`: phaseNumber is defined
- `isAccessible()`: status is 'active' and not restricted

**Graph transitions:**
```
defined → active → commissioning → handed_over
  ↓        ↓
on_hold  on_hold
(↔ defined)(↔ active)
```

**State filter:** by projectId, status, phaseNumber

### WorkPackage (CRITICAL — EVM boundary)

**TaggedClass methods:**
- `percentComplete()`: actualQty / plannedQty × 100
- `earnedValue()`: budgetedCost × percentComplete / 100
- `costVariance()`: earnedValue - actualCost
- `scheduleVariance(scheduledQtyToDate)`: needs planned progress curve
- `cpi()`: earnedValue / actualCost (guard div/0)
- `isOverBudget()`: cpi < 1.0
- `isBehindSchedule(scheduledQtyToDate)`: spi < 1.0

These methods make the WorkPackage a **live EVM calculator** — not just a data bag.

**Graph transitions:**
```
planned → active → suspended → active → complete → closed
  ↓                                        
cancelled                                  
```

**State filter:** by projectId, zoneId, discipline, status, assignedCrewId

### Task (7-state lifecycle)

**TaggedClass methods:**
- `isTerminal()`: status is 'done' or 'cancelled'
- `isBlocked()`: status is 'blocked'
- `needsEvidence()`: status is 'needs_evidence'
- `actualCostCode()`: falls back to WP default if not set
- `hoursRemaining()`: plannedHours - actualHours (clamped to 0)

**Graph transitions:**
```
pending → active → suspended → active (resume)
                 → needs_evidence → done
                 → blocked → active (unblock)
                 → cancelled
pending → cancelled
```

**State filter:** by workPackageId, status, priority, assignedTo

### Worker

**TaggedClass methods:**
- `hasValidBadge()`: badgeExpiry is in the future
- `badgeExpiresWithin(days)`: alert threshold
- `hasActiveCert(type)`: checks certifications array
- `nearestCertExpiry()`: soonest expiring cert
- `isDeployable()`: status is 'active' AND badge valid AND no expired critical certs
- `effectiveHourlyRate()`: hourlyRate or default by tradeRole

**Graph transitions:**
```
active → on_leave → active
active → badge_pending → active (badge issued)
active → badge_expired (auto-detected)
active → cert_expired (auto-detected)
any → offboarded (terminal)
```

### Crew (no graph — simple CRUD)

**TaggedClass methods:**
- `headcount()`: derived from Worker count (not stored, queried)
- `isFullyStaffed(target)`: headcount >= targetHeadcount

### TimeEntry (no graph — append-only)

**TaggedClass methods:**
- `derivedCost(worker)`: hours × worker.effectiveHourlyRate()

### Issue

**Graph transitions:**
```
open → assigned → in_progress → resolved → verified → closed
                              → wont_fix
open → closed (duplicate/invalid)
```

### Checkpoint

**Graph transitions:**
```
pending → ready → passed
               → failed → pending (rework cycle)
               → waived
```

---

## Shared Infrastructure

### Common Types (`schemas/common/types.ts`)

Like IIoT's `BaseAssetFields`, SIOS needs shared field spreads:

```typescript
export const BaseSiosFields = {
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  metadata: Schema.optionalWith(SiosMetadata, { default: () => ({}) }),
} as const
```

### Errors (`errors/`)

Per-domain error modules following IIoT's pattern:
- `errors/common.ts` — SiosNotFoundError, SiosValidationError
- `errors/task.ts` — TaskTransitionError
- `errors/evm.ts` — EVMCalculationError

### Services (cross-cutting)

- `services/EVMService.ts` ✅ Exists. Keep as-is. Pure calculation.
- `services/ProgressAggregator.ts` — NEW. Aggregates Task→WP→Zone→Project EVM.
- `services/CertComplianceService.ts` — NEW. Checks worker cert validity, badge expiry.
- `services/CrewSizingService.ts` — NEW. Crew = (Qty / Rate) / Days formula engine.

### Feature Flags

Follow IIoT's `IIoTFeatureFlags` pattern:
```typescript
export class SiosFeatureFlags extends Context.Tag('sios/FeatureFlags')<...>() {}
export const SiosFlagsDisabledLayer = ...
export const SiosFlagsEnabledLayer = ...
```

Controls event emission, AI features, experimental capabilities.

---

## File Structure (Target)

```
src/lib/sios/
├── ARCHITECTURE.md                  ← this file
├── index.ts                         public exports
│
├── schemas/
│   ├── common/
│   │   ├── types.ts                 BaseSiosFields, SiosMetadata
│   │   └── index.ts
│   ├── identifiers.ts               9 branded IDs (KEEP)
│   ├── value-objects.ts             VOs (KEEP, upgrade to TaggedClass where needed)
│   ├── project/
│   │   ├── schema.ts               Project TaggedClass + CreateParams + UpdateParams
│   │   └── index.ts
│   ├── zone/
│   │   ├── schema.ts
│   │   └── index.ts
│   ├── work-package/
│   │   ├── schema.ts               WorkPackage TaggedClass with EVM methods
│   │   └── index.ts
│   ├── task/
│   │   ├── schema.ts               Task TaggedClass with lifecycle methods
│   │   └── index.ts
│   ├── crew/
│   │   ├── schema.ts
│   │   └── index.ts
│   ├── worker/
│   │   ├── schema.ts               Worker TaggedClass with cert/badge methods
│   │   └── index.ts
│   ├── time-entry/
│   │   ├── schema.ts
│   │   └── index.ts
│   ├── issue/
│   │   ├── schema.ts
│   │   └── index.ts
│   ├── checkpoint/
│   │   ├── schema.ts
│   │   └── index.ts
│   └── index.ts                     barrel
│
├── machines/
│   ├── graphs/
│   │   ├── project-graph.ts
│   │   ├── zone-graph.ts
│   │   ├── work-package-graph.ts
│   │   ├── task-graph.ts
│   │   ├── worker-graph.ts
│   │   ├── issue-graph.ts
│   │   ├── checkpoint-graph.ts
│   │   └── index.ts
│   ├── ProjectMachine.ts
│   ├── ZoneMachine.ts
│   ├── WorkPackageMachine.ts
│   ├── TaskMachine.ts
│   ├── WorkerMachine.ts
│   ├── IssueMachine.ts
│   ├── CheckpointMachine.ts
│   └── index.ts
│
├── state/
│   ├── StateShape.ts                shared filter/pagination types
│   ├── ProjectState.ts
│   ├── ZoneState.ts
│   ├── WorkPackageState.ts
│   ├── TaskState.ts
│   ├── CrewState.ts
│   ├── WorkerState.ts
│   ├── TimeEntryState.ts
│   ├── IssueState.ts
│   ├── CheckpointState.ts
│   └── index.ts                     AllStateServicesInMemory layer
│
├── entity/
│   ├── ProjectEntity.ts
│   ├── ZoneEntity.ts
│   ├── WorkPackageEntity.ts
│   ├── TaskEntity.ts
│   ├── CrewEntity.ts
│   ├── WorkerEntity.ts
│   ├── TimeEntryEntity.ts
│   ├── IssueEntity.ts
│   ├── CheckpointEntity.ts
│   ├── EntityStack.ts               testing + production stacks
│   └── index.ts
│
├── models/
│   ├── _common.ts                   CreatedAt, OptionalMetadata helpers
│   ├── _migrations.ts               Migrator.fromRecord
│   ├── project/
│   │   ├── ProjectModel.ts
│   │   └── ProjectModel.ddl.ts
│   ├── zone/
│   │   ├── ZoneModel.ts
│   │   └── ZoneModel.ddl.ts
│   ├── work-package/
│   │   ├── WorkPackageModel.ts
│   │   └── WorkPackageModel.ddl.ts
│   ├── task/
│   │   ├── TaskModel.ts
│   │   └── TaskModel.ddl.ts
│   ├── crew/
│   │   ├── CrewModel.ts
│   │   └── CrewModel.ddl.ts
│   ├── worker/
│   │   ├── WorkerModel.ts
│   │   └── WorkerModel.ddl.ts
│   ├── time-entry/
│   │   ├── TimeEntryModel.ts
│   │   └── TimeEntryModel.ddl.ts
│   ├── issue/
│   │   ├── IssueModel.ts
│   │   └── IssueModel.ddl.ts
│   ├── checkpoint/
│   │   ├── CheckpointModel.ts
│   │   └── CheckpointModel.ddl.ts
│   └── index.ts
│
├── repos/
│   ├── _decode.ts
│   ├── ProjectRepo.ts
│   ├── ZoneRepo.ts
│   ├── WorkPackageRepo.ts
│   ├── TaskRepo.ts
│   ├── CrewRepo.ts
│   ├── WorkerRepo.ts
│   ├── TimeEntryRepo.ts
│   ├── IssueRepo.ts
│   ├── CheckpointRepo.ts
│   └── index.ts
│
├── services/
│   ├── EVMService.ts                ✅ exists, keep
│   ├── ProgressAggregator.ts        Task→WP→Zone→Project rollup
│   ├── CertComplianceService.ts     badge/cert expiry checking
│   ├── CrewSizingService.ts         Crew = (Qty/Rate)/Days
│   └── index.ts
│
├── errors/
│   ├── common.ts
│   ├── task.ts
│   ├── evm.ts
│   └── index.ts
│
├── infrastructure/
│   ├── feature-flags.ts
│   └── index.ts
│
├── http/
│   ├── api.ts                       SiosApi extends HttpApi
│   ├── query-api.ts                 EVM rollup queries, dashboard queries
│   ├── query-handlers.ts
│   ├── proxy-handlers.ts
│   ├── server.ts
│   └── index.ts
│
└── __tests__/
    ├── schemas/                     property tests for schemas
    ├── graphs/                      transition validation tests
    ├── machines/                    machine procedure tests
    ├── state/                       state service tests
    ├── services/                    EVM, cert compliance tests
    └── e2e/                         full lifecycle tests
```

**Total target: ~90 files across 9 entities + cross-cutting layers.**

---

## Implementation Order

### Priority: WorkPackage → Task → TimeEntry first (the EVM triad)

These three entities form the core data flow:
```
Task.complete(actualQty, actualHours, evidence)
  → creates TimeEntry
  → updates WorkPackage.actualQty, actualHours, actualCost
  → triggers EVM recalculation
  → propagates to Zone and Project dashboards
```

If this triad works, everything else is additive. If it doesn't, nothing else matters.

### Full sequence:

1. `schemas/common/types.ts` + infrastructure/feature-flags.ts
2. WorkPackage schema → graph → state → machine → entity → model → ddl → repo
3. Task schema → graph → state → machine → entity → model → ddl → repo
4. TimeEntry schema → state → entity → model → ddl → repo (no graph/machine)
5. **CHECKPOINT: EVM triad test — create WP, create tasks, complete tasks, verify EVM flows**
6. Project schema → graph → state → machine → entity → model → ddl → repo
7. Zone schema → graph → state → machine → entity → model → ddl → repo
8. Crew schema → state → entity → model → ddl → repo (no graph/machine)
9. Worker schema → graph → state → machine → entity → model → ddl → repo
10. Issue schema → graph → state → machine → entity → model → ddl → repo
11. Checkpoint schema → graph → state → machine → entity → model → ddl → repo
12. EntityStack.ts, services/ProgressAggregator, services/CertCompliance
13. HTTP layer: api.ts, query-api, proxy-handlers, server
14. Full E2E test: Create project → zones → WPs → tasks → complete → verify EVM → verify dashboard query

---

## What Must Be Deleted

The current SIOS code has the wrong architecture. Before starting Pass 1:

- **DELETE** `schemas/domain.ts` — monolithic, TaggedStruct not TaggedClass, wrong pattern
- **DELETE** `entity/*.ts` (all 10 files) — RPCs without schemas, no handlers, no machine wiring
- **DELETE** `models/WorkPackageModel.ts`, `TaskModel.ts`, `TimeEntryModel.ts` — wrong schema refs
- **DELETE** `services/TaskStateMachine.ts` — flat transition map, not Graph.directed

**KEEP:**
- `schemas/identifiers.ts` — branded IDs are correct
- `schemas/value-objects.ts` — VOs are solid, may need TaggedClass upgrade
- `services/EVMService.ts` — pure calculation, correct
- `services/index.ts` — will be updated

---

*Architecture plan authored by Val. Triple-passed 2026-03-31.*
*Reference: src/lib/iiot/ — 435 files, the canonical Effect Cluster pattern.*
