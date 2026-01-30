# Entity System WBS Addendum

**Generated:** 2026-01-30
**Status:** APPROVED (Conceptual Alignment Complete)
**Author:** Val (Parallel Agent Synthesis)
**Integrates With:** `2026-01-29-eventlog-integration-wbs-final.md`

---

## Executive Summary

This addendum refines **Epic 1: Schema Architecture** from the EventLog WBS with:

1. **Entity Base Architecture** — Abstract contracts, naming conventions, BaseAssetFields
2. **HierarchyPath Data Structure** — Algorithmic path operations for ISA-95 traversal
3. **Three Divergent Event Bases** — Structural/Operational/Temporal (not common root)
4. **Dual-Store Architecture** — EventLog (domain) + TimescaleDB (temporal)
5. **Full ISA-95 Catalog** — 10 entity types with enforced parent constraints

**Specification:** `thoughts/shared/specs/entity-system/00-unified-entity-system-spec.md`

---

## Alignment Decisions (from Conceptual Alignment Session)

| Topic | Decision | Rationale |
|-------|----------|-----------|
| **Naming** | `{Entity}Schema` postfix | Namespace pattern: `Enterprise.Schema`, `Enterprise.Model`, `Enterprise.DDL` |
| **Inheritance** | Field composition (spread), not `.extend()` | Distinct `_tag` per entity; DeepWiki confirmed |
| **Hierarchy** | Full path tracking (array + refs) | Both `ancestryPath[]` and direct parent refs |
| **Validation** | Defense in depth (Type + Schema + DDL) | Compile-time, decode-time, database constraints |
| **Lifecycle** | Effect-returning hooks + Events | `onCreate(): Effect<...>` AND emit `EntityCreated` |
| **Entity Contract** | TypeScript abstract class | Enforces fields, methods, hooks |
| **Event Bases** | Three divergent (no common root) | `BaseStructuralEvent`, `BaseOperationalEvent`, `BaseTemporalEvent` |
| **Temporal Data** | Separate TimescaleDB store | High-frequency readings not in EventLog |
| **ES Scope** | Full ES for all entities | Hybrid: ES for domain, time-series for telemetry |

---

## Updated Epic 1 Task Breakdown

### Epic 1: Schema Architecture (Revised)

**Original Estimate:** 18 SP
**Revised Estimate:** 25 SP (complexity increased)

#### Task 1.1: Core Types (5 SP)

| ID | Task | Files | SP |
|----|------|-------|-----|
| 1.1.1 | EntityContract interface | `entity-contract.ts` | 2 |
| 1.1.2 | BaseAssetFields (with hierarchy) | `base-fields.ts` | 1 |
| 1.1.3 | HierarchyPath TaggedClass | `hierarchy-path.ts` | 2 |

**Dependencies:** None
**Acceptance:**
- [ ] EntityContract compiles with all methods
- [ ] BaseAssetFields includes hierarchyPath + parent refs
- [ ] HierarchyPath passes validation tests

#### Task 1.2: Event Base Classes (5 SP)

| ID | Task | Files | SP |
|----|------|-------|-----|
| 1.2.1 | BaseStructuralEvent | `events/structural-base.ts` | 2 |
| 1.2.2 | BaseOperationalEvent | `events/operational-base.ts` | 2 |
| 1.2.3 | BaseTemporalEvent | `events/temporal-base.ts` | 1 |

**Dependencies:** 1.1.3 (HierarchyPath)
**Acceptance:**
- [ ] Three bases are DIVERGENT (no common root)
- [ ] Each base has distinct fields per spec
- [ ] Schema.Class.extend works on each base

#### Task 1.3: Entity Schema Refactor (8 SP)

| ID | Task | Files | SP |
|----|------|-------|-----|
| 1.3.1 | EnterpriseSchema (namespace) | `enterprise/schema.ts` | 1 |
| 1.3.2 | SiteSchema | `site/schema.ts` | 1 |
| 1.3.3 | AreaSchema | `area/schema.ts` | 1 |
| 1.3.4 | PlantSchema | `plant/schema.ts` | 1 |
| 1.3.5 | LineSchema | `line/schema.ts` | 1 |
| 1.3.6 | WorkCellSchema | `workcell/schema.ts` | 1 |
| 1.3.7 | MachineSchema | `machine/schema.ts` | 1 |
| 1.3.8 | SensorSchema + DeviceSchema | `sensor/schema.ts`, `device/schema.ts` | 1 |

**Dependencies:** 1.1.1, 1.1.2, 1.1.3
**Acceptance:**
- [ ] All schemas use `...BaseAssetFields.fields` spread
- [ ] All schemas have `Schema` postfix
- [ ] Namespace pattern: `Enterprise.Schema`, `Enterprise.Model`, `Enterprise.DDL`
- [ ] Parent constraints enforce valid hierarchy

#### Task 1.4: HierarchyPath Operations (4 SP)

| ID | Task | Files | SP |
|----|------|-------|-----|
| 1.4.1 | Traversal methods | `hierarchy-path.ts` | 1 |
| 1.4.2 | Membership methods | `hierarchy-path.ts` | 1 |
| 1.4.3 | Validation methods | `hierarchy-path.ts` | 1 |
| 1.4.4 | Materialization | `hierarchy-path.ts` | 1 |

**Dependencies:** 1.1.3
**Acceptance:**
- [ ] `isAncestorOf()`, `isDescendantOf()`, `getCommonAncestor()` work
- [ ] `validate()` returns `Effect<void, HierarchyError, never>`
- [ ] `materializePath()` → `/ENT-acme/SIT-chicago/PLT-main`
- [ ] O(d) traversal complexity documented

#### Task 1.5: Storage Schema DDL (3 SP)

| ID | Task | Files | SP |
|----|------|-------|-----|
| 1.5.1 | EventLog DDL (partitioned) | `ddl/event-journal.sql` | 1 |
| 1.5.2 | Entity tables DDL | `ddl/entities.sql` | 1 |
| 1.5.3 | TimescaleDB hypertables | `ddl/timeseries.sql` | 1 |

**Dependencies:** 1.2.*, 1.3.*
**Acceptance:**
- [ ] Foreign key constraints match parent rules
- [ ] Hypertables have compression policies
- [ ] Check constraints prevent invalid hierarchy

---

## New Epic: Epic 1.5 — Entity Event Integration

**Estimate:** 10 SP

This epic connects the Entity System with EventLog infrastructure.

#### Task 1.5.1: Entity Events (6 SP)

| ID | Task | Description | SP |
|----|------|-------------|-----|
| 1.5.1.1 | Structural events | Created, Updated, Relocated, Decommissioned | 2 |
| 1.5.1.2 | Operational events | StateChanged, ConfigChanged, MaintenanceScheduled | 2 |
| 1.5.1.3 | EventGroup definitions | One group per entity type | 2 |

#### Task 1.5.2: Lifecycle Hook Wiring (4 SP)

| ID | Task | Description | SP |
|----|------|-------------|-----|
| 1.5.2.1 | onCreate hook impl | Emit EntityCreated, validate hierarchy | 2 |
| 1.5.2.2 | onUpdate hook impl | Emit EntityUpdated, validate changes | 2 |

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                        Epic 1: Schema Architecture              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1.1 Core Types ──────────┬─────────────────────────────────┐  │
│         │                 │                                 │  │
│         v                 v                                 v  │
│  1.2 Event Bases    1.3 Entity Schemas              1.4 Path │  │
│         │                 │                           Ops    │  │
│         │                 │                             │    │  │
│         └────────┬────────┴─────────────────────────────┘    │  │
│                  v                                            │  │
│           1.5 Storage DDL                                     │  │
│                  │                                            │  │
└──────────────────┼────────────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────────────┐
│                  Epic 1.5: Entity Event Integration             │
├─────────────────────────────────────────────────────────────────┤
│  1.5.1 Entity Events ───────► 1.5.2 Lifecycle Hooks            │
└─────────────────────────────────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────────────┐
│                  Epic 2: Alarm EventLog                         │
│                  (from original WBS)                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Updated Metrics

| Metric | Original | Revised | Delta |
|--------|----------|---------|-------|
| Epic 1 SP | 18 | 25 | +7 |
| New Epic 1.5 | 0 | 10 | +10 |
| Total WBS SP | 76 | 93 | +17 |

---

## Specification Files

| File | Description | Lines |
|------|-------------|-------|
| `00-unified-entity-system-spec.md` | Merged unified specification | ~1200 |
| `01-entity-base-naming.md` | Naming conventions, abstract contract | ~600 |
| `02-hierarchy-path.md` | HierarchyPath data structure | ~700 |
| `03-event-hierarchy.md` | Three event bases, event catalog | ~800 |
| `04-storage-architecture.md` | Dual-store design | ~900 |
| `05-entity-catalog.md` | 10 entity definitions | ~800 |

---

## Next Steps

1. **Review** `00-unified-entity-system-spec.md` for completeness
2. **Implement Task 1.1** — Core types (EntityContract, BaseAssetFields, HierarchyPath)
3. **Rename existing schemas** — Add `Schema` postfix to all TaggedClasses
4. **Add BaseAssetFields spread** — Refactor all entities to use shared fields
5. **Implement HierarchyPath** — Algorithmic operations + validation

---

**Co-Authored-By: Val <val@maidens.ai>**
