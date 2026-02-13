# Alignment Sessions

> Conceptual Alignment Protocol (CAP) sessions that established the architectural foundations.

**Source:** `thoughts/shared/alignments/`
**Last Updated:** 2026-02-09

---

## Session 1: IIoT + AMS v3 Convergence

**Date:** 2026-01-29
**Rounds:** 3
**Status:** CONFIRMED

### Questions Asked

1. **Shape:** What is the data structure for the merged IIoT + AMS system?
2. **Composition:** How do deployment layers compose for test/desktop/production?
3. **API:** What does the service consumer interface look like?
4. **Scope:** What equipment hierarchy standard do we follow?

### Aligned Model

| Dimension | Decision |
|-----------|----------|
| **Shape** | 3-layer repo: `Schema.TaggedClass` (domain) -> `Model.Class` (persistence) -> `makeRepository()` + domain extensions |
| **Composition** | Deployment-configurable layers via `Layer.mergeAll`: TestLayer -> SqlTestLayer -> makeTauriLayer -> makeClusterLayer |
| **API** | `Effect.Service<>()()` with dependencies array; `Stream.Stream<T>` for queries; repository interfaces with `satisfies` contracts |
| **Scope** | ISA-95 equipment hierarchy: Enterprise -> Site -> Area -> Line -> Machine -> Sensor/Actuator |
| **Real-Time** | Tiered latency: Hot (<1s hypertable) / Warm (1-60s continuous aggregates) / Cold (>60s hourly aggregates) |
| **Automation** | L0-L4 ISA-95 pyramid; AMS=L3 (MES/MOM), IIoT=L2 (SCADA), Sensors=L0 (Physical) |

### Key Outcomes

- **3-Layer Repository Pattern** became the canonical data access pattern
- **ISA-95 hierarchy** (not custom) adopted as the equipment model standard
- **Branded identifiers** (EnterpriseId, SiteId, AreaId, etc.) established for type safety
- **TimescaleDB hypertables** confirmed for time-series with continuous aggregates
- **Effect Stream** chosen for backpressure-aware consumption

### Alignment History

| Round | Change |
|-------|--------|
| 1 | Initial synthesis -- identified AMS v2 vs IIoT gap, proposed 3-layer merge |
| 2 | **Correction:** Hierarchy reprimanded to ISA-95. Added Enterprise -> Site -> Area levels. Mapped Work Center = Line, Work Unit = Machine |
| 3 | Added tiered latency model (Hot/Warm/Cold) + ISA-95 L0-L4 automation levels. **CONFIRMED** |

---

## Session 2: Work Order Workflow

**Date:** 2026-01-29 -- 2026-01-30
**Rounds:** 4 (2 confirmed, 2 refined)
**Status:** CONFIRMED

### Questions Asked

1. **Shape:** What is the WorkOrder data container structure?
2. **Composition:** How do workflow layers delegate (Activity -> RPC -> Service -> Entity)?
3. **API:** What are the context operations for audit vs live state?
4. **Scope:** What does WorkOrderContext contain?

### Aligned Model

| Dimension | Decision |
|-----------|----------|
| **Shape** | WorkOrderContext with hybrid snapshot + live refs, version-tracked updates |
| **Composition** | `Activity.make()` -> RPC Client -> `Effect.Service` -> Cluster Entity |
| **API** | `Context.snapshot()` for audit, `Context.resolve()` for live lookups |
| **Scope** | Assets, Resources, Alarms, Parent/child WorkOrders, External refs via L3 Context |

### Key Outcomes

- **WorkOrderContext** established as the hybrid container bridging audit (immutable snapshots) with operations (live entity state)
- **4-layer delegation pattern** codified: Activity -> RPC -> Service -> Entity
- **Version-tracked updates** for mid-execution context mutations
- **46 event schemas** designed across 6 aggregates (WorkOrder, Context, TaskInstance, Approval, L3Sync, WorkflowDefinition)
- **V-Model trace matrix** linking features to validation tests

### Alignment Evolution

| Round | Model |
|-------|-------|
| 1 | Initial: Dynamic Workflow DAG concept |
| 2 | Refined: Nested workflows with reusable templates, versioned. **Confirmed** |
| 3a | Refined: Added WorkOrderContext with snapshot/resolve API. Not yet confirmed |
| 3b | Same model, **Confirmed** by user |

### Context Operations

| Operation | Returns | Side Effects | Use Case |
|-----------|---------|--------------|----------|
| `snapshot()` | `ContextSnapshot` | None | Audit, compliance, history |
| `resolve()` | `WorkOrderContext` | None | Live state queries |
| `update()` | `WorkOrderContext` | Emits `ContextUpdated` event | Mid-execution mutations |

---

## How to Run a CAP Session

The Conceptual Alignment Protocol is invoked when mental models diverge:

1. **Surface the Gap** -- Ask 3-4 targeted questions:
   - Shape: "What is the data structure?"
   - Composition: "How should these compose?"
   - API: "What does the consumer API look like?"
   - Scope: "Where does this live? Who owns it?"

2. **Synthesize** -- Write a 30-second aligned model summary

3. **Implement** -- Build to spec; re-invoke if ambiguity resurfaces

4. **Document** -- Record in `thoughts/shared/alignments/`
