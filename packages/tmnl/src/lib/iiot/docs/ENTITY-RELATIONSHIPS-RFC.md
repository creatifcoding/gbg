# RFC: Entity Relationship Layer

> **Status:** Draft  
> **Author:** Val (Vigilant Architecture Layer)  
> **Date:** 2026-05-07  
> **Domain:** `src/lib/iiot/`  
> **Dependencies:** Apache AGE 1.5.0 (PostgreSQL 16), `GraphClient` L1 service, `@effect/sql-pg`
> **Companion:** [`REACTOR-CONSISTENCY-MODEL.md`](./REACTOR-CONSISTENCY-MODEL.md) formalizes event delivery, propagation, idempotency, and the robustness/optimization checklist.  
> **Roadmap:** [`REACTOR-ARCHITECTURE-ROADMAP.md`](./REACTOR-ARCHITECTURE-ROADMAP.md) tracks the eight hardening workstreams that turn the vertical slice into durable architecture.

---

## 1. Problem Statement

The IIoT domain contains **14 entities** across **3 natural classes**, but the relationships between them are expressed as **flat foreign keys** — invisible to graph traversal, opaque to impact analysis, and incapable of carrying context.

When a Plant shuts down, there is no mechanism to traverse "everything affected." When a WorkOrder targets a Line, it holds a single `primaryAssetId` FK — the individual machines, sensors, active alarms, and dependent work orders are not queryable as a connected topology.

**The gap is not the graph database.** Apache AGE is running. The ISA-95 structural hierarchy traverses cleanly. The gap is:

1. **No generic edge creation API.** Every relationship type is hand-coded in `GraphClient`. Adding a new edge type requires new service methods.
2. **No metadata on edges.** Edges carry no timestamps, no actor, no reason, no versioning. You can see *that* a sensor monitors a machine, but not *when* or *why* that relationship was established.
3. **No operational entities in the graph.** WorkOrders, EquipmentStates, and most Alarms exist only in SQL. They reference structural entities via FKs that the graph cannot traverse.
4. **No propagation semantics.** The hierarchy implies cascading effects (Plant closes → Lines stop → Machines idle → WorkOrders suspend), but nothing in the system models or enforces this.

---

## 2. Entity Taxonomy

### Class 1: Structural Hierarchy (9 entities)

The ISA-95 equipment model. These entities form the containment hierarchy of the physical plant. Each has a lifecycle state machine, a `hierarchy_path`, and a parent FK.

```
Enterprise  (L4 - Business Planning)
  └─ Site   (L3 - Manufacturing Operations Management)
    └─ Area (L2 - Supervisory Control)
      └─ Plant (L2 - Process Control)
        └─ Line (L1 - PLC/DCS Control)
          └─ WorkCell (L1 - Work Unit)
            └─ Machine (L0 - Field Device)
              └─ Device (L0 - Control Module)
                └─ Sensor (L0 - Measurement Point)
```

**Current graph presence:** Plant, Line, Machine, Sensor have `:contains` and `:monitors` edges. Enterprise, Site, Area, WorkCell, Device are **not yet in the graph**.

**Relationship role:** These are the **targets** and **context** of operational activity. They form the topology that relationships traverse.

### Class 2: Operational Activity (3 entities)

Things that *happen to* structural entities. They are created in response to conditions, carry lifecycle state, and reference structural entities.

| Entity | References | Nature |
|--------|-----------|--------|
| **WorkOrder** | `primaryAssetId` (FK to any asset) | Planned or reactive work. 12 lifecycle ops. FDA audit trail. |
| **Alarm** | `device_id` (FK to sensor/device) | ISA-18.2 condition notification. 4 ops. Short lifecycle. |
| **EquipmentState** | `machine_id` (FK to machine) | OEE state tracking. Duration-based. 6 ops. |

**Current graph presence:** Only Alarm has a node (`:alarm`) with one edge type (`:triggered_by → :sensor`). WorkOrder and EquipmentState are invisible to the graph.

**Relationship role:** These are the **sources** of relationship edges. A WorkOrder `[:targets]` a Machine. An Alarm `[:triggered_by]` a Sensor. An EquipmentState `[:observed_on]` a Machine. These edges bridge operational activity to structural topology.

### Class 3: Cross-Cutting / Read Projections (2 entities)

Polymorphic read facades that don't own data.

| Entity | Nature |
|--------|--------|
| **Asset** (generic) | Unified query surface over all structural entities. `Get`, `GetChildren`, `GetHierarchy`. |
| **Sensor** (data reader) | Time-series projection. `GetLatest`, `GetAggregated`, `GetStats`. |

**Relationship role:** These are **consumers** of the relationship graph. The Asset entity is the natural home for "get all relationships for entity X" queries.

---

## 3. What We Need to Build

### 3.1 Generic Edge Creation API

**Problem:** Every edge type requires new methods in `GraphClient`. `linkAlarmToSensor()` is a one-off. If we need `linkWorkOrderToMachine()`, `linkWorkOrderToLine()`, `linkAlarmToWorkOrder()`, we'd write N² service methods.

**Solution:** A generic `createEdge(source, target, edgeType, metadata)` API that:
- Accepts any entity class as source or target (identified by type + ID)
- Validates the edge type against a registry of allowed relationship types
- Writes the edge to Apache AGE with full metadata
- Records an audit entry for FDA compliance
- Returns the edge with its graph-assigned ID

**Design constraint:** The API must be generic enough for an agent to compose arbitrary relationships, but structured enough that the *known* relationship patterns (`:targets`, `:caused_by`, `:depends_on`) get first-class Schema definitions with typed payloads.

### 3.2 Relationship Metadata (Edge Properties)

**Problem:** Current edges carry no data beyond the label. When was this relationship created? By whom? Why? Is it still valid?

**Solution:** Every edge carries a **standard metadata envelope**:

```
{
  created_at:    timestamp,     -- When the edge was created
  created_by:    string,        -- Who/what created it (user, system, agent)
  valid_from:    timestamp,     -- When the relationship became active
  valid_to:      timestamp?,    -- When it was deactivated (null = still active)
  reason:        string?,       -- Why this relationship exists
  context:       jsonb?,        -- Extensible context (shift, production run, etc.)
  version:       integer,       -- Monotonic version counter
  source_type:   string,        -- Entity class of source ('WorkOrder', 'Machine', etc.)
  target_type:   string,        -- Entity class of target
}
```

**Temporal semantics:** Edges are **soft-deleted** via `valid_to`. Never physically removed. This enables temporal queries: "What was linked to WO-2026-00042 at time T?"

### 3.3 Composable Edge Types (Meta-Edges)

**Problem:** The 7 initial edge types (targets, requires, caused_by, depends_on, related_to, supervises, produces) are a starting set, but the real world will demand extensions. We need a way to define, compose, and extend edge types without code changes.

**Solution:** Edge types are defined as a **Schema-backed registry**:

- Each edge type has: `label`, `directionality` (directed | bidirectional), `allowed_source_types`, `allowed_target_types`, `payload_schema` (optional typed data beyond the standard envelope)
- Edge types can be **composed**: a `maintenance_targets` type might extend `targets` with additional properties (`maintenance_type`, `estimated_duration`)
- The registry is queryable at runtime — agents can discover what edge types exist and what they accept

### 3.4 Cascade / Propagation Semantics

**Problem:** "Plant closes → all Lines stop → all Machines idle → all WorkOrders suspend." This cascade is implied by the hierarchy but not enforced or traversable.

**Solution:** Structural hierarchy edges (`:contains`) carry **inheritance descriptors** that define what propagates downward:

- `state_cascade`: When parent enters state X, children enter state Y
- `event_propagation`: When parent emits event X, children receive event Y  
- `constraint_inheritance`: Children inherit operational constraints from parents (operating hours, safety restrictions)

Parents define the canonical inheritance semantics. Children can override with surgical exceptions.

This is **not** the initial scope — it's the architectural runway that the edge metadata system must support.

---

## 4. Architectural Decisions

### 4.1 Graph as Topology Layer, SQL as Source of Truth

The Apache AGE graph is a **projection** of relationships, optimized for traversal. The SQL tables remain the source of truth for entity lifecycle. The relationship layer bridges both:

- **Write path:** Effect service validates → writes to AGE graph → writes audit to SQL transition table
- **Read path:** Cypher queries traverse the graph → results enriched with SQL entity data

### 4.2 Any Entity Can Relate to Any Entity

The generic API is entity-type agnostic. Source and target are identified by `(entity_type, entity_id)` pairs. The edge type registry constrains which combinations are valid, but the underlying mechanism is uniform.

### 4.3 First-Class Treatment for Known Patterns

While the API is generic, the **known** relationship patterns get:
- Typed Effect Schema definitions (e.g., `TargetsEdge`, `CausedByEdge`)
- Dedicated Cypher query helpers (e.g., `getTargetsForWorkOrder()`)
- Dedicated events (e.g., `WorkOrderTargetLinked`, `WorkOrderTargetUnlinked`)
- Validation rules in the edge type registry

### 4.4 Agent-Composable Queries

The design assumes two consumer personas:
1. **Canonical queries** — pre-built, typed, optimized (e.g., "get all machines targeted by this WO")
2. **Agent-composed queries** — arbitrary Cypher assembled by an autonomous agent with a tool. The agent discovers available node labels, edge types, and metadata shapes, then constructs traversal queries to answer operational questions.

The `GraphClient.executeCypher()` low-level API already supports this. The relationship layer adds the **semantic vocabulary** (node labels, edge types, metadata shapes) that agents reason about.

---

## 5. Initial Edge Types

| Edge Type | Direction | Source Classes | Target Classes | Payload |
|-----------|-----------|---------------|----------------|---------|
| `targets` | Directed | Operational | Structural | `{ role: 'primary' \| 'secondary' }` |
| `requires` | Directed | Operational | Any | `{ resource_type: string, quantity?: number }` |
| `caused_by` | Directed | Operational | Operational, Structural | `{ causality: 'direct' \| 'contributing' }` |
| `depends_on` | Directed | Operational | Operational | `{ dependency_type: 'blocks' \| 'informs' }` |
| `related_to` | Bidirectional | Any | Any | `{ relation_context?: string }` |
| `supervises` | Directed | External (person/role) | Operational | `{ role: string }` |
| `produces` | Directed | Operational | External (artifact) | `{ artifact_type: string }` |

---

## 6. Golden Path Test

> *The one scenario that, if handled elegantly, proves the design is right.*

**Scenario: Emergency Repair on MCH-001 (Welding Robot Alpha)**

1. Sensor VIB-001 detects anomalous vibration on MCH-001 → **Alarm** created
2. Graph query: "What does MCH-001 belong to?" → traverse `:contains` edges → LINE-001 → PLANT-A
3. WorkOrder WO-2026-00099 auto-created (caused_by alarm) → **edges created:**
   - `(wo)-[:caused_by]->(alarm)`
   - `(wo)-[:targets]->(mch-001)`
   - `(wo)-[:targets]->(line-001)` (inherited from hierarchy)
   - `(wo)-[:requires {resource_type: 'welding_tech'}]->(personnel)`
4. Impact query: "What else runs on LINE-001?" → traverse to MCH-002 → find active WO on MCH-002 → `(wo-099)-[:related_to]->(wo-088)` auto-created
5. MCH-001 EquipmentState transitions to `down` → `(eq_state)-[:observed_on]->(mch-001)` edge created
6. Supervisor assigned → `(supervisor)-[:supervises]->(wo-099)` edge created
7. **Temporal query:** "At 14:30, what was linked to WO-099?" → filter edges by `valid_from <= 14:30 AND (valid_to IS NULL OR valid_to > 14:30)`
8. WorkOrder completes → repair report produced → `(wo-099)-[:produces]->(report)` edge created
9. **Audit query:** "Show me every relationship change on WO-099 with who/when/why" → query edge audit trail

If each of these steps is a clean, typed Effect program that the agent or the UI can invoke — the design is right.

---

## 7. Propagation & Inheritance Semantics

The codebase already contains four distinct patterns where entity state changes imply effects on connected entities. These patterns are currently **implicit** — encoded in human knowledge, not in traversable graph structure. The relationship layer must make them explicit.

### Evidence From the State Graphs

Four semantic state concepts recur across hierarchy levels, each with different propagation behavior:

**Pattern 1 — `decommissioned`: Pure downward inheritance (8 of 9 structural entities)**

Enterprise is the only one without it (it has `dissolved`). When a Plant decommissions, every Line, WorkCell, Machine, Device, Sensor under it *must* decommission. This is forced, non-negotiable, terminal. The state name is identical at every level.

**Pattern 2 — `maintenance`: Downward inheritance with translation**

Same semantic concept at 5 levels, but the *name* varies by level: Plant says `maintenance_shutdown`, Area/Line/WorkCell say `maintenance`, Machine says `scheduled_maintenance` or `unscheduled_maintenance`. The parent's intent ("enter maintenance") inherits downward, but each child *translates* it into its own vocabulary. And Machine distinguishes *why* — scheduled vs unscheduled — which the parent doesn't care about.

**Pattern 3 — `faulted`: Upward propagation (NOT inheritance)**

Appears at Device, Sensor, Machine, WorkCell — the *bottom* of the hierarchy. A faulted Sensor doesn't make the Machine faulted automatically. But it *might* trigger an Alarm, which *might* cause a WorkOrder, which *might* suspend other WorkOrders on the same Line. This travels upward and *across classes* — through relationship edges, not containment edges.

**Pattern 4 — `blocked`: Lateral/upward propagation with causal coupling**

WorkCell `blocked` → Line might become `starved` (different state name, causal relationship). Equipment-state tracks `blocked` independently. The child's state *informs* the parent's state through a causal rule, not direct state forcing.

And then there's the **cross-class bridge** hiding in plain sight: `SuspensionReason.equipment_unavailable`. The WorkOrder schema already has a literal for "I was suspended because a structural entity changed state." The relationship exists semantically — it's just not modeled as a traversable edge.

### State Distribution Across Hierarchy

| Semantic State | Enterprise | Site | Area | Plant | Line | WorkCell | Machine | Device | Sensor |
|---|---|---|---|---|---|---|---|---|---|
| **Decommissioned** | `dissolved` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Maintenance** | — | — | ✓ | `maintenance_shutdown` | ✓ | ✓ | `scheduled_` / `unscheduled_` | — | — |
| **Faulted** | — | — | — | — | — | ✓ | ✓ | ✓ | ✓ |
| **Blocked** | — | — | — | — | ✓ | ✓ | — | — | — |
| **Running/Active** | `active` | `operational` | `active` | `operational` | `running` | `running` | `operational` | `online` | `active` |
| **Shutdown** | — | `seasonal_shutdown` | — | `scheduled_` / `emergency_` / `maintenance_` | — | — | — | — | — |

### Three Mechanisms

These patterns decompose into three mechanisms that *look* related but operate differently:

| Mechanism | Direction | Edge Type | Action | Example |
|-----------|-----------|-----------|--------|---------|
| **Inheritance** | Parent→Child | `[:contains]` | Force/translate state | Plant decommissions → Lines decommission |
| **Propagation** | Child→Parent | `[:contains]` | Inform/cause state | WorkCell blocked → Line starved |
| **Cross-class reaction** | Across classes | `[:targets]`, `[:caused_by]` | Trigger lifecycle event | Machine maintenance → WorkOrder suspend |

All three are the same abstract operation: "when entity X enters state S, traverse edges of type T, apply action A to connected entities." But they differ in coupling:

- **Coupled:** Decommission inherits downward AND is forced (child has no choice).
- **Decoupled:** Fault propagates upward as *information* — it doesn't force the parent into a faulted state. It might trigger an Alarm (cross-class reaction) which might trigger a WorkOrder (another cross-class reaction), but each step is a separate causal decision.
- **Translated:** Maintenance inherits downward, but the receiving entity maps the parent's intent to its own state vocabulary (`maintenance_shutdown` → `scheduled_maintenance`).

### Implications for the Relationship Layer

The generic edge API must support attaching **propagation descriptors** to edges:

```typescript
// Inheritance descriptor on a [:contains] edge
{
  propagation: {
    direction: 'downward',
    trigger_state: 'decommissioned',
    action: 'force',                    // force | suggest | notify
    target_state: 'decommissioned',     // or a translation map
  }
}

// Cross-class descriptor on a [:targets] edge
{
  propagation: {
    direction: 'reverse',               // WO reacts to Machine, not vice versa
    trigger_state: 'maintenance',
    action: 'suggest',
    target_state: 'suspended',
    reason: 'equipment_unavailable',
  }
}
```

The execution engine that *acts* on these descriptors is out of scope for v1. But the metadata structure must be designed now so that edges carry enough information to drive propagation when the engine arrives.

---

## 8. Primitives Required

The Reactor pattern introduces a coordination problem that nothing in the system currently solves. Each actor is a self-contained consistency boundary — `sql.withTransaction` handles the local case, `Effect.Scope` handles lifecycle, Effect Cluster's `MessageStorage` handles message durability. But **nothing governs the coordination between actors** when a propagation spans multiple entities.

Four primitives are required to close this gap.

---

### 8.1 Rich Guard Returns

**Problem:** Guards today return `boolean`. When the Reactor queries whether a WorkOrder can be suspended, `canSuspend('completed') → false` throws away the *reason*. The Reactor doesn't know if the target is ineligible because it's in a terminal state (skip it permanently), because it's already in the desired state (idempotent, skip it), or because it's in a transitional state (retry later). It just gets `false`.

This matters because the Reactor's audit trail can't distinguish "skipped because already handled" from "skipped because impossible" from "should retry."

**Solution:** Guards return an `EligibilityResult` — a discriminated union that carries the reason.

```typescript
const EligibilityResult = Schema.Union(
  Schema.TaggedStruct('Eligible', {
    currentState: Schema.String,
    targetState: Schema.String,
  }),
  Schema.TaggedStruct('AlreadyInState', {
    currentState: Schema.String,
    // Already in the desired state — idempotent no-op
  }),
  Schema.TaggedStruct('TerminalState', {
    currentState: Schema.String,
    // Entity is in a terminal state — will never be eligible
  }),
  Schema.TaggedStruct('InvalidTransition', {
    currentState: Schema.String,
    targetState: Schema.String,
    validTargets: Schema.Array(Schema.String),
    // Not a valid transition — but entity is still alive, might become eligible
  })
)
type EligibilityResult = typeof EligibilityResult.Type
```

**Call site change:**

```typescript
// BEFORE: boolean guard, no context
if (!canSuspendWorkOrder(currentState)) {
  return yield* Effect.fail(new InvalidTransitionError(...))
}

// AFTER: rich result, Reactor can make informed decisions
const eligibility = checkSuspendEligibility(currentState)
switch (eligibility._tag) {
  case 'Eligible':        break // proceed
  case 'AlreadyInState':  return yield* Effect.succeed(currentEntity) // idempotent
  case 'TerminalState':   return yield* Effect.fail(new TerminalStateError(...))
  case 'InvalidTransition': return yield* Effect.fail(new InvalidTransitionError(...))
}
```

**Impact on existing code:** Every `can*` function in every graph file (`work-order-graph.ts`, `machine-asset-graph.ts`, etc.) gains a richer sibling. The boolean versions remain for backward compatibility. The Reactor exclusively uses the rich versions.

---

### 8.2 Pre-Dispatch Filtering

**Problem:** The Reactor queries the graph for targets, then dispatches RPCs to each one. If a WorkOrder is already `completed`, the RPC fires, hits the guard, and bounces. That's a wasted network round-trip, a wasted actor wake-up, and noise in the audit trail.

The graph query and the entity state live in the **same PostgreSQL instance**. We can join them.

**Solution:** The Reactor's graph query incorporates entity state in the filter — before dispatching.

```sql
-- BEFORE: Find targets, dispatch blindly
SELECT * FROM cypher('iiot_graph', $$
  MATCH (wo:work_order)-[:targets]->(m:machine {id: 'MCH-001'})
  RETURN wo.id AS work_order_id
$$) AS (work_order_id agtype)

-- AFTER: Join graph with relational state, filter ineligible targets
SELECT * FROM cypher('iiot_graph', $$
  MATCH (wo:work_order)-[:targets]->(m:machine {id: 'MCH-001'})
  RETURN wo.id AS work_order_id
$$) AS (work_order_id agtype)
JOIN iiot.work_orders w ON w.id = work_order_id::text
WHERE w.status IN ('started', 'resumed')  -- only dispatchable states
```

This is the PostgreSQL advantage in action — AGE graph traversal and relational filtering in a single query. The Reactor never sends an RPC to a WorkOrder that can't accept it.

**Design constraint:** The filter must be conservative. It should filter out entities that are *definitely* ineligible (terminal states, already in target state), but not entities in ambiguous states that the guard should evaluate. Over-filtering is worse than under-filtering — a missed dispatch is silent, a wasted dispatch at least hits the audit trail.

---

### 8.3 Propagation Envelope (Structural, Not Orchestrating)

**Problem:** When a Machine enters maintenance, connected WorkOrders need to react. But *who is responsible* for the WorkOrder's state? The WorkOrder is. Not the Machine. Not a central coordinator.

**Principle: Responsibility Locality.** The entity that owns the state is responsible for acting on it. The Machine doesn't suspend WorkOrders — WorkOrders suspend themselves, *informed* by the Machine's state change.

**Solution:** The Propagation Envelope is a **structural notification** — a fact about what happened — not an orchestration record that tracks outcomes.

```typescript
export class PropagationEnvelope extends Schema.TaggedClass<PropagationEnvelope>()(
  'PropagationEnvelope',
  {
    /** Unique propagation ID — born inside the source entity's transaction */
    id: PropagationId,

    /** What happened (a fact, not a command) */
    source: Schema.Struct({
      entityType: Schema.String,
      entityId: Schema.String,
      from: Schema.String,
      to: Schema.String,
    }),

    /** When it happened */
    emittedAt: Schema.DateTimeUtc,

    /** Causal lineage — if this was triggered by another propagation */
    causedByPropagationId: Schema.optionalWith(PropagationId, { as: 'Option' }),
  }
) {}
```

Note what's absent: no `planned`, no `outcomes`, no `status`. The envelope doesn't track what targets exist, whether they processed it, or what they decided. That's their responsibility.

**Where the PropagationId lives:** On the source entity's transition audit record — two columns added to the existing transition tables:

```sql
ALTER TABLE iiot.work_order_transitions
  ADD COLUMN propagation_id TEXT,
  ADD COLUMN caused_by_propagation_id TEXT;
```

The PropagationId is generated inside the source entity's `sql.withTransaction`, at the same moment the state transition commits. If the transaction rolls back, the propagation never existed. One transition = one PropagationId. Always.

**The Reactor's role changes:** It's a notification sender, not an orchestrator. It fires and forgets.

```typescript
// Source entity (MachineAsset) — after state commits
yield* reactor.propagate(machineReactor, {
  source: { type: 'MachineAsset', id },
  transition: { from: currentState, to: 'scheduled_maintenance' },
  propagationId, // born in the tx above
})
// Reactor queries graph, sends RPCs carrying the envelope
// Does NOT track outcomes — each target handles itself
```

**Crash recovery is local to each entity:**

- **Source crashes before sending notifications:** On restart, the source checks its own edges: "My state is `scheduled_maintenance`. Do my graph edges have propagation descriptors that imply downstream effects? Is my `propagation_id` present in any target's transition records?" If not — re-send.
- **Target crashes before processing notification:** Effect Cluster's `MessageStorage` redelivers the RPC on restart. The target processes it normally.
- **Both crash:** Each entity self-heals independently. The WorkOrder boots, checks its graph edges: "I have a `[:targets]` edge to MCH-001, MCH-001 is in `scheduled_maintenance`, the descriptor says I should be `suspended`, I'm in `started` — I need to act." The graph is the specification.

**Causal DAG:** When A triggers B triggers C, each transition creates its own PropagationId with a `causedByPropagationId` linking back:

```
PRP-001: MachineAsset/MCH-001 (operational → scheduled_maintenance), causedBy: null
  ├── PRP-002: WorkOrder/WO-042 (started → suspended), causedBy: PRP-001
  │    └── PRP-005: WorkOrder/WO-099 (started → notified), causedBy: PRP-002
  ├── PRP-003: WorkOrder/WO-088 (started → suspended), causedBy: PRP-001
  └── (WO-077 → filtered, terminal state, no PropagationId created)
```

The algebraic bound: **one state transition = one PropagationId = one entity's transaction boundary.** The cascade is a chain of propagations, not one propagation. The entity boundary IS the transaction boundary.

The full causal graph is queryable via recursive CTE on the existing transition tables:

```sql
WITH RECURSIVE causal_chain AS (
  SELECT * FROM iiot.work_order_transitions
  WHERE propagation_id = 'PRP-001'
  UNION ALL
  SELECT t.* FROM iiot.work_order_transitions t
  JOIN causal_chain c ON t.caused_by_propagation_id = c.propagation_id
)
SELECT * FROM causal_chain ORDER BY transitioned_at
```

**Recurring patterns:** The graph topology + descriptors define what *can* propagate (the template). The transition records + causal chain define what *did* propagate (the instance). `Reactor.plan()` is a dry-run that returns the template without executing — "what would happen if Plant-A decommissioned?" If certain patterns recur, they're derivable from the graph structure and nameable as propagation templates.

**Two storage layers, two purposes:**

| Question | Storage | Mechanism |
|----------|---------|----------|
| What *can* propagate from MCH-001? | Graph (AGE) | Topology + descriptors |
| What *would* happen if MCH-001 entered maintenance? | Graph (AGE) | `Reactor.plan()` — traversal with descriptor evaluation |
| What *did* happen when MCH-001 entered maintenance Tuesday? | Relational (transition records) | `caused_by_propagation_id` recursive CTE |
| Which edges have never been activated? | Both | Graph has all edges, relational has all propagation IDs. Left join. |

---

### 8.4 Intrasystem Idempotency

**Problem:** If the Reactor fires the same propagation twice (crash + recovery, or concurrent triggers), the graph guards happen to catch the duplicate — `canSuspend('suspended') → false`. But this is a *coincidence* of the state machine, not a *designed guarantee*.

Consider: Machine enters maintenance, Reactor fires, WO-042 suspends. Machine flickers back to operational, WO-042 resumes. Machine re-enters maintenance, Reactor fires again. WO-042 suspends again — legitimately. The guard doesn't reject the second suspend because the WO is back in `started`. But is this the *same* propagation or a *new* one? The system can't tell.

**Solution:** Each target entity tracks which PropagationIds it has processed. The PropagationId is carried on the incoming RPC — it's part of the structural envelope.

```typescript
// On the target entity (WorkOrder):
// Before processing a Reactor-initiated transition, check:
const alreadyProcessed = yield* propagationLog.hasProcessed(
  workOrderId,
  incomingPropagationId
)
if (alreadyProcessed) {
  // Same propagation, already handled — true idempotency
  return yield* Effect.succeed(currentEntity)
}

// After processing, inside the target's own sql.withTransaction:
yield* transitionRepo.insert({
  ...audit,
  propagation_id: newLocalPropagationId,       // this entity's own
  caused_by_propagation_id: incomingPropagationId, // from the envelope
})
```

This separates two concerns:
- **Guard idempotency:** "Can this entity transition?" — answered by the state machine.
- **Propagation idempotency:** "Has this specific propagation already been applied to this entity?" — answered by querying the entity's own transition records for `caused_by_propagation_id`.

No separate propagation log table needed. The transition records already exist. The `caused_by_propagation_id` column serves double duty: causal chain tracing AND idempotency checking.

The Machine → maintenance → WO suspend → Machine → operational → WO resume → Machine → maintenance → WO suspend sequence is two *different* propagations (two different `PropagationId` values on the Machine's transition records), each producing a unique `caused_by_propagation_id` on the WorkOrder's transition records. If the first propagation crashes and retries, the retry carries the *same* incoming `PropagationId` and is recognized as a duplicate.

---

## 9. Transition Table Standardization

The Reactor, the propagation chain, the causal DAG materialization, and the rich guard returns all depend on one prerequisite: **every entity that participates in propagation must have a transition table**.

Today, only WorkOrder has one. The other 11 entities do `state.set()` with no audit trail. This is not intentional — it's incomplete. The evidence:

- All 12 machines have identical architecture: `Machine.make()` + graph-validated guards + state service
- LineMachine extracted a `makeTransitionProcedure` helper specifically to standardize the pattern — preparation for extension
- All entities claim "ISA-95 compliant" — which implies auditable state transitions
- The deps interface is identical across all 11 non-WorkOrder machines (`state + flags`). WorkOrder simply added `transitionRepo + sql` on top
- No comment or TODO anywhere says these entities don't need transition tables

### 9.1 The Base Transition Shape

Every entity's transition table shares a common shape, extended with entity-specific fields:

```typescript
// Base columns — shared by ALL entity transition tables
export class BaseTransitionFields {
  /** Auto-generated UUID */
  id: Model.Generated(Schema.String)

  /** Entity type (e.g., 'WorkOrder', 'MachineAsset', 'Plant') */
  entityType: Schema.String

  /** Entity ID (FK to the entity's primary table) */
  entityId: Schema.String

  /** State before transition */
  fromState: Schema.String

  /** State after transition */
  toState: Schema.String

  /** Server-generated timestamp (FDA 21 CFR Part 11 tamper-proof) */
  transitionedAt: Model.Generated(Schema.DateFromSelf)

  /** Who performed the transition */
  transitionedBy: Model.FieldOption(Schema.String)

  /** Reason/justification */
  reason: Model.FieldOption(Schema.String)

  // ─── Propagation columns (new) ───────────────────────────

  /** This transition's propagation ID (null if not a propagation source) */
  propagationId: Model.FieldOption(Schema.String)

  /** The propagation ID that caused this transition (null if user-initiated) */
  causedByPropagationId: Model.FieldOption(Schema.String)
}
```

### 9.2 Entity-Specific Transition Tables

Each entity type gets its own table with entity-specific CHECK constraints on the state columns. The table naming convention is `iiot.{entity_type}_transitions`:

| Entity Type | Table | FK Target | State Enum |
|---|---|---|---|
| WorkOrder | `iiot.work_order_transitions` | `iiot.work_orders(id)` | WorkOrderStatus (11 states) |
| MachineAsset | `iiot.machine_transitions` | `iiot.machines(id)` | MachineAssetStateNode (10 states) |
| Plant | `iiot.plant_transitions` | `iiot.plants(id)` | PlantStateNode (7 states) |
| Line | `iiot.line_transitions` | `iiot.lines(id)` | LineStateNode (9 states) |
| WorkCell | `iiot.workcell_transitions` | `iiot.workcells(id)` | WorkcellStateNode (9 states) |
| Alarm | `iiot.alarm_transitions` | `iiot.alarms(id)` | AlarmStateNode (7 states) |
| EquipmentState | `iiot.equipment_state_transitions` | `iiot.equipment_states(id)` | EquipmentStateNode (7 states) |
| Device | `iiot.device_transitions` | `iiot.devices(id)` | DeviceStateNode (6 states) |
| SensorAsset | `iiot.sensor_transitions` | `iiot.sensors(device_id)` | SensorStateNode (7 states) |
| Enterprise | `iiot.enterprise_transitions` | `iiot.enterprises(id)` | EnterpriseStateNode (4 states) |
| Site | `iiot.site_transitions` | `iiot.sites(id)` | SiteStateNode (6 states) |
| Area | `iiot.area_transitions` | `iiot.areas(id)` | AreaStateNode (6 states) |

### 9.3 The Universal Transition View

For cross-entity causal chain traversal, a SQL view unions all transition tables into one queryable surface:

```sql
CREATE VIEW iiot.all_transitions AS
  SELECT 'WorkOrder' AS entity_type, work_order_id AS entity_id,
         from_state, to_state, transitioned_at, transitioned_by, reason,
         propagation_id, caused_by_propagation_id
  FROM iiot.work_order_transitions
  UNION ALL
  SELECT 'MachineAsset', machine_id, ...
  FROM iiot.machine_transitions
  UNION ALL
  -- ... one SELECT per entity type
```

The recursive CTE for causal chain traversal runs against this view:

```sql
WITH RECURSIVE chain AS (
  SELECT * FROM iiot.all_transitions
  WHERE propagation_id = 'PRP-001'
  UNION ALL
  SELECT t.* FROM iiot.all_transitions t
  JOIN chain c ON t.caused_by_propagation_id = c.propagation_id
)
SELECT * FROM chain ORDER BY transitioned_at
```

This solves the polymorphic lookup problem without a separate `iiot.propagations` table. The view IS the unified surface. Each entity retains its own table with its own CHECK constraints, FK relationships, and immutability triggers. The view is read-only by nature.

### 9.4 Machine Procedure Extension Pattern

The existing `makeTransitionProcedure` helper in LineMachine shows the seam. The extension from `state.set()` to `state.set() + transitionRepo.insert()` follows the WorkOrder pattern:

```typescript
// BEFORE: state.set() only
const updated = new Line({ ...line, status: targetState })
yield* state.set(updated)
yield* Effect.logInfo(`[LineMachine] Line ${request.lineId} ${actionName}`)
return [updated, { mode: targetState }] as const

// AFTER: dual-write with propagation columns
const propagationId = generatePropagationId()
const updated = new Line({ ...line, status: targetState })

yield* sql.withTransaction(
  Effect.gen(function* () {
    yield* state.set(updated)
    yield* transitionRepo.insert({
      entityId: request.lineId,
      fromState: currentState,
      toState: targetState,
      transitionedBy: Option.some(request.initiatedBy),
      reason: request.reason ?? Option.none(),
      propagationId: Option.some(propagationId),
      causedByPropagationId: request.causedByPropagationId ?? Option.none(),
    })
  })
)

yield* reactor.propagate(lineReactor, {
  source: { type: 'Line', id: request.lineId },
  transition: { from: currentState, to: targetState },
  propagationId,
})

return [updated, { mode: targetState }] as const
```

The deps interface for every Machine gains two new ports:

```typescript
// BEFORE: state + flags
interface LineMachineDeps {
  readonly state: LineStateShape
  readonly flags: FeatureFlagsShape
}

// AFTER: state + flags + transitionRepo + sql
interface LineMachineDeps {
  readonly state: LineStateShape
  readonly flags: FeatureFlagsShape
  readonly transitionRepo: TransitionRepository  // generic interface
  readonly sql: SqlClient.SqlClient
}
```

### 9.5 Generic TransitionRepository Interface

Rather than 12 separate repo interfaces, a single generic interface parameterized by entity ID type:

```typescript
export interface TransitionRepository<EntityId extends string = string> {
  readonly insert: (transition: {
    entityId: EntityId
    fromState: string
    toState: string
    transitionedBy: Option.Option<string>
    reason: Option.Option<string>
    propagationId: Option.Option<string>
    causedByPropagationId: Option.Option<string>
  }) => Effect.Effect<TransitionRecord, TransitionRepoError>

  readonly getByEntityId: (
    entityId: EntityId
  ) => Effect.Effect<readonly TransitionRecord[], TransitionRepoError>

  readonly getLatest: (
    entityId: EntityId
  ) => Effect.Effect<Option.Option<TransitionRecord>, TransitionRepoError>

  readonly getAuditTrail: (params: {
    entityId?: EntityId
    startDate: Date
    endDate: Date
    userId?: string
  }) => Effect.Effect<readonly TransitionRecord[], TransitionRepoError>

  readonly hasPropagation: (
    entityId: EntityId,
    causedByPropagationId: string
  ) => Effect.Effect<boolean, TransitionRepoError>
}
```

The `hasPropagation` method serves double duty: intrasystem idempotency check (§8.4) AND causal chain membership query.

Each entity type provides a concrete `Context.Tag` wrapping this interface, backed by its own table:

```typescript
export class LineTransitionRepo extends Context.Tag('iiot/LineTransitionRepo')<
  LineTransitionRepo,
  TransitionRepository<LineId>
>() {}

export class PlantTransitionRepo extends Context.Tag('iiot/PlantTransitionRepo')<
  PlantTransitionRepo,
  TransitionRepository<PlantId>
>() {}
// ... etc
```

### 9.6 Migration Strategy

The transition table rollout is incremental — each entity can be extended independently:

1. Create the DDL for the entity's transition table (follow `WorkOrderTransitionModel.ddl.ts` pattern)
2. Create the Model (follow `WorkOrderTransitionModel.ts` pattern, adding propagation columns)
3. Create or instantiate the Repo (generic `TransitionRepository` with entity-specific table name)
4. Add `transitionRepo + sql` to the Machine's deps interface
5. Wrap `state.set()` in `sql.withTransaction` with `transitionRepo.insert()`
6. Add to the `iiot.all_transitions` view

Existing tests continue to work — the in-memory state services don't require transition repos. The transition repo is injected via Layer, stubbed in unit tests (same pattern as WorkOrder's test suite).

The `propagation_id` and `caused_by_propagation_id` columns exist from day one on every table, even before the Reactor is implemented. They're nullable — no migration pain when the Reactor arrives.

---

## 10. Out of Scope (For Now)

- **RelationshipGroup concept** — deferred until the edge API proves itself.
- **Event sourcing of edges** — edges get audit trail but are not event-sourced via `@effect/experimental EventLog` in v1.
- **Full ISA-95 hierarchy in graph** — Enterprise, Site, Area, WorkCell, Device nodes not yet in AGE. The edge API should work once they are.
- **ETL infrastructure** — job scheduling, MinIO/S3 artifact storage service, pg_lake analytics. Required for causal chain materialization but separate from the relationship layer itself.
- **Causal chain materialization** — the cold-path analytical artifact (recursive CTE → document → S3). Depends on transition table standardization (§9) being complete. Designed for hours/days time bounds, consumed by agents and compliance workflows.

---

- **RelationshipGroup concept** — deferred until the edge API proves itself. The initial need ("WO has multiple Machines, retrieve them explicitly") is satisfied by querying `(wo)-[:targets]->(m:machine)`.
- **Event sourcing of edges** — edges get audit trail (SQL transition table) but are not event-sourced via `@effect/experimental EventLog` in v1.
- **Full ISA-95 hierarchy in graph** — Enterprise, Site, Area, WorkCell, Device nodes are not yet created. The edge API should work once they are.

---

## 11. File Map (Proposed)

```
src/lib/iiot/
├── schemas/
│   └── relationships/
│       ├── edge-types.ts           # Edge type registry (Schema definitions)
│       ├── edge-metadata.ts        # Standard metadata envelope
│       ├── eligibility.ts          # EligibilityResult schema (8.1)
│       ├── propagation-envelope.ts # PropagationEnvelope schema (8.3)
│       └── events/                 # Relationship events (Linked, Unlinked, etc.)
├── services/
│   ├── l1/
│   │   └── GraphClient.ts         # Extended with generic edge CRUD + filtered queries
│   └── reactor/
│       ├── Reactor.ts              # Effect.Service — propagate/plan/execute
│       ├── AbstractReactor.ts      # Base class for per-entity reactor config
│       └── PropagationLog.ts       # Idempotency tracking (8.4)
├── machines/
│   └── graphs/
│       ├── eligibility/            # Rich guard returns per entity type (8.1)
│       │   ├── work-order-eligibility.ts
│       │   ├── machine-asset-eligibility.ts
│       │   └── ...
│       └── edge-type-registry.ts   # Effect.Graph for edge type validation
├── repos/
│   ├── EdgeAuditRepo.ts            # INSERT-only audit trail for edge changes
│   └── PropagationEnvelopeRepo.ts  # Envelope persistence + resumption queries (8.3)
└── models/
    └── relationships/
        ├── EdgeAuditModel.ts        # SQL Model for audit records
        ├── EdgeAuditModel.ddl.ts    # PostgreSQL DDL
        ├── PropagationEnvelopeModel.ts
        └── PropagationEnvelopeModel.ddl.ts
```

---

## 12. Open Questions

1. **Node labels for operational entities:** Should WorkOrder be `:work_order` in AGE, or should we use a generic `:entity {type: 'WorkOrder', id: '...'}` label? Type-specific labels enable faster Cypher pattern matching but require label creation per entity type.

2. **Edge ID strategy:** AGE auto-generates graph element IDs. Do we also store our own branded `EdgeId` for cross-referencing with the SQL audit trail?

3. **Bidirectional edge implementation:** AGE edges are inherently directed. For `related_to` (bidirectional), do we create two directed edges, or one edge queried in both directions via `MATCH (a)-[:related_to]-(b)` (undirected match)?

4. **Agent query safety:** If agents compose arbitrary Cypher, what guardrails prevent destructive operations (`DELETE`, `DETACH DELETE`)? Read-only Cypher execution mode?

5. **Envelope storage location:** Does the PropagationEnvelope live in a relational table (`iiot.propagation_envelopes`) or as a graph node? Relational gives us SQL queries for resumption; graph gives us traversal context. Possibly both — relational as source of truth, graph node for topological queries.

6. **Effect Cluster MessageStorage integration:** `MessageStorage.unprocessedMessages` already tracks undelivered messages. Can the Propagation Envelope piggyback on this, or does it need its own persistence layer? The envelope carries richer semantics (planned vs dispatched vs filtered) than MessageStorage's binary processed/unprocessed.
