# IIoT Reactor Architecture Roadmap

> **Status:** Draft execution roadmap  
> **Date:** 2026-05-18  
> **Domain:** `src/lib/iiot/`  
> **Companions:** [`ENTITY-RELATIONSHIPS-RFC.md`](./ENTITY-RELATIONSHIPS-RFC.md), [`REACTOR-CONSISTENCY-MODEL.md`](./REACTOR-CONSISTENCY-MODEL.md), [`ENTITY_RELATIONSHIP_LAYER.md`](./ENTITY_RELATIONSHIP_LAYER.md)  
> **Anchor slice:** Machine unavailable/maintenance → related WorkOrders suspend

---

## 1. Architectural Thesis

The IIoT entity graph is not merely a navigation layer. It is the topology that
lets independently owned entities remain consistent without collapsing into a
single distributed transaction or orchestration god-object.

The model has four durable primitives:

1. **Entity state** — owned by the entity that can change it.
2. **Domain events** — schema-backed facts emitted by committed transitions.
3. **Relationship graph** — typed topology and propagation descriptors.
4. **Transition audit** — local state-change records linked into causal DAGs.

The Reactor is the consistency mechanism between those primitives:

```text
source entity transition
  -> durable domain event
  -> Reactor relationship traversal
  -> typed target entity command
  -> target local transition
  -> causal audit link
```

It is not a user-facing entity, not a workflow engine, and not a distributed
transaction coordinator. Workflows remain intentional multi-entity activities;
Reactor propagation remains structural consistency.

---

## 2. Non-Negotiable Invariants

### 2.1 Events are primitive

`LISTEN/NOTIFY`, PubSub, NATS, RPC, and EventJournal replay are delivery modes.
The domain event is the fact. The transport is only how a fact moves.

### 2.2 Responsibility locality

The owner of state owns the decision to change that state.

A Machine does not suspend WorkOrders. A Machine emits a fact that it became
unavailable. The Reactor finds affected WorkOrders and asks each WorkOrder to
suspend itself. The WorkOrder applies its own guard, idempotency, transition
audit, and event emission.

### 2.3 Local atomicity, not distributed fantasy

One entity transition is one local transaction boundary. Cross-entity cascades
are causal DAGs of local transitions:

```text
EquipmentState propagation_id=P1
  causes
WorkOrderTransition caused_by_propagation_id=P1, propagation_id=P2
```

There is no claim that the Machine and WorkOrder changed atomically together.
There is a durable, replay-safe chain proving why each local transition happened.

### 2.4 Relationship descriptors are data

Propagation rules belong in Schema-backed descriptors attached to relationship
edge types. Reactor behavior should not remain hard-coded in services once the
first vertical slice is proven.

---

## 3. Current Baseline

Already implemented:

- Real EventLog-backed event truth for WorkOrder and EquipmentState.
- Strict durable-first emitter paths for Reactor v1 source/target transitions.
- Local transaction fusion for:
  - EquipmentState transition + durable `EquipmentStateChanged` event.
  - WorkOrder suspend + transition audit + durable `WorkOrderSuspended` event.
- WorkOrder propagation metadata:
  - `propagation_id`
  - `caused_by_propagation_id`
- Command-level duplicate handling for WorkOrder suspend by inbound propagation.
- Reactor checkpoint/dedupe table.
- Registry-validated generic graph relationship node/edge CRUD.
- Reactor v1 sidecar service for Machine unavailable → WorkOrder suspend.

This proves the vertical slice. The roadmap below turns the slice into a durable
architecture.

---

## 4. Eight Roadmap Workstreams

### 4.1 Causal DAG reconstruction

**Feature:** `#F1012` — IIoT Reactor: Causal DAG reconstruction

Goal: reconstruct how a source fact produced target transitions.

Canonical query:

```text
EquipmentStateChanged(machine=MCH-001, propagation_id=P1)
  -> Reactor traversed (work_order)-[:targets]->(machine)
  -> WorkOrder WO-123 suspended with caused_by_propagation_id=P1
```

Deliverables:

- Schema-backed causal chain projection.
- SQL/repo query helper for bounded reconstruction.
- Integration test that performs the vertical slice and reconstructs the chain.
- Documentation of limitations where source entities lack transition tables.

Why it matters: without reconstruction, Reactor behavior is operationally useful
but not auditable.

---

### 4.2 First-class propagation IDs

**Feature:** `#F1013` — IIoT Reactor: First-class propagation IDs

Goal: source transitions mint propagation IDs; durable events carry them; target
transitions record them as causes.

Current v1 fallback uses EventJournal `entry.idString` as the inbound cause. That
is acceptable for replay safety but not the final domain contract.

Deliverables:

- Add `propagationId` to source event payloads where the event claims a committed
  transition.
- Mint `PropagationId` during source transitions.
- Forward event propagation IDs through Reactor commands.
- Preserve fallback for legacy EventJournal entries.

Why it matters: propagation identity should belong to the domain transition, not
the storage envelope that happened to carry it.

---

### 4.3 Propagation descriptor schemas

**Feature:** `#F1014` — IIoT Reactor: Propagation descriptor schemas

Goal: make propagation rules explicit, typed, and discoverable from relationship
edge descriptors.

Initial descriptor:

```text
source: EquipmentStateChanged where state in unavailable_states
topology: WorkOrder -[:targets]-> Machine
target: InternalSuspendWorkOrder(reason=equipment_unavailable)
idempotency: caused_by_propagation_id
```

Deliverables:

- `PropagationDescriptor` Schema. **Done:** `src/lib/iiot/schemas/relationships/edge-types.ts`.
- Registry attachment for descriptors on edge types. **Done:** descriptors live on `RelationshipEdgeDescriptor.propagationDescriptors`.
- Descriptor for Machine unavailable → WorkOrder suspend. **Done:** `MachineUnavailableSuspendsWorkOrder` on the `targets` edge.
- Tests for descriptor validation and discovery. **Done:** `src/lib/iiot/__tests__/relationships/propagation-descriptors.test.ts`.

Descriptor shape:

```text
edge: work_order -[:targets]-> machine
traversal: target_to_source
source event: EquipmentStateChanged where newState ∈ unavailable states
target command: WorkOrder.Suspend(reason=equipment_unavailable)
idempotency: source_propagation_id
eligibility: work_order.active_started_or_resumed
```

Why it matters: hard-coded Reactor behavior does not scale past the first slice.

---

### 4.4 Rich guard and eligibility results

**Feature:** `#F1015` — IIoT Reactor: Rich guard and eligibility results

Goal: replace boolean guard ambiguity with structured eligibility outcomes.

Examples:

- `eligible`
- `already_suspended`
- `terminal_state`
- `not_started`
- `duplicate_propagation`
- `missing_target`
- `conflict`

Deliverables:

- Schema-backed `EligibilityResult`. **Done:** `src/lib/iiot/schemas/relationships/eligibility.ts`.
- WorkOrder suspend eligibility helper. **Done:** `classifyWorkOrderSuspendEligibility`.
- Reactor planning/reporting based on typed results. **Done:** `RelationshipReactor` now derives decisions from the rich helper.
- Documentation of skip/reject/idempotent vocabulary. **Done:** vocabulary includes `eligible`, `skipped`, `idempotent`, `rejected`, `failed` with reasons such as `terminal_state`, `not_started`, `already_suspended`, and `duplicate_propagation`.

Why it matters: Reactor decisions must be explainable and stable under replay.

---

### 4.5 Full lifecycle transaction-fusion sweep

**Feature:** `#F1016` — IIoT Reactor: Full lifecycle transaction-fusion sweep

Goal: apply durable event/state atomicity beyond the Reactor v1 paths.

Reactor v1 fused the critical path. The broader lifecycle still needs a sweep so
all committed-transition events are emitted inside the same local transaction as
state and audit writes.

Deliverables:

- Emission-site audit matrix. **Done:** audited WorkOrder terminal/reversible transitions now share one local boundary.
- Fusion of remaining WorkOrder transition events where applicable. **Done:** reject, resume, complete, fail, cancel, and close emit durable facts inside the same SQL transaction as status + transition audit writes; suspend was already fused.
- Representative rollback tests for non-suspend commands. **Done:** complete rollback test proves status and transition rows disappear when durable emission fails.
- Docs that distinguish committed facts from best-effort telemetry. **Done:** warm realtime remains post-commit notification; durable EventLog facts are written in the local commit boundary.

| Command | State write | Transition audit | Durable EventLog fact | Boundary |
| --- | --- | --- | --- | --- |
| `InternalRejectWorkOrder` | yes | yes | `WorkOrderRejected` | single SQL transaction |
| `InternalSuspendWorkOrder` | yes | yes | `WorkOrderSuspended` | single SQL transaction |
| `InternalResumeWorkOrder` | yes | yes | `WorkOrderResumed` | single SQL transaction |
| `InternalCompleteWorkOrder` | yes | yes | `WorkOrderCompleted` | single SQL transaction |
| `InternalFailWorkOrder` | yes | yes | `WorkOrderFailed` | single SQL transaction |
| `InternalCancelWorkOrder` | yes | yes | `WorkOrderCancelled` | single SQL transaction |
| `InternalCloseWorkOrder` | yes | yes | `WorkOrderClosed` | single SQL transaction |

Why it matters: a durable event claiming a committed transition must not diverge
from state/audit persistence.

---

### 4.6 Transition tables beyond WorkOrder

**Feature:** `#F1017` — IIoT Reactor: Transition tables beyond WorkOrder

Goal: source and target entities participating in propagation need transition
audit records, not just current state rows.

First target: EquipmentState.

Deliverables:

- EquipmentState transition model/DDL/repo.
- Atomic write from EquipmentStateMachine.
- Propagation metadata on source transitions.
- Integration coverage for audit rows and rollback behavior.

Why it matters: causal DAGs need both ends of the chain to expose local
transition records.

---

### 4.7 Relationship layer hardening

**Feature:** `#F1018` — IIoT Reactor: Relationship layer hardening

Goal: move generic graph CRUD from useful to governable.

Deliverables:

- Stable application-level `EdgeId`. **Done:** graph edges get `edge_id` and audit rows correlate by the same value.
- Insert-only SQL edge audit trail. **Done:** `iiot.relationship_edge_audit` via migration `0026_relationship_edge_audit`.
- Descriptor version metadata. **Done:** audit rows carry `descriptor_version`.
- Read-only agent Cypher guardrails. **Done:** `GraphClient.executeReadOnlyCypher` rejects mutating Cypher verbs.

Why it matters: relationship edges influence operational propagation. They need
traceability, safety, and migration discipline.

---

### 4.8 Structural and Alarm event truth wiring

**Feature:** `#F1020` — IIoT Reactor: Structural and Alarm event truth wiring

Goal: replace log-only/legacy helper paths with real durable events when
structural hierarchy and alarm slices become propagation participants.

Deliverables:

- Audit of log-only helpers and handler-only paths. **Done:** structural and alarm slices already have EventGroup schemas; legacy helper paths remain scoped for future machine/entity owners.
- Durable Schema/EventGroup definitions where missing. **Done:** selected `MachineCreated` and `AlarmTriggered` facts use existing Schema-backed `StructuralEvents`/`AlarmEvents` payloads.
- DomainEventEmitter/layer wiring for selected events. **Done:** `emitStructuralEventStrict` and `emitAlarmEventStrict` provide durable strict write paths through the shared EventLog schema.
- Strict emission rollback tests or explicit telemetry-only classification. **Done:** strict emitter tests prove selected structural/alarm facts are written to the EventJournal; state rollback is deferred to the owning structural/alarm machines because Reactor does not own those transitions.

Why it matters: the Reactor can only be as trustworthy as its source facts.

---

## 5. Dependency Shape

Recommended order:

```text
First-class propagation IDs
  -> Transition tables beyond WorkOrder
  -> Causal DAG reconstruction

Propagation descriptor schemas
  -> Rich eligibility results
  -> Relationship layer hardening

Lifecycle transaction-fusion sweep
  -> Structural/Alarm event truth wiring
```

Practical sequencing:

1. **First-class propagation IDs** — stabilize causal identity.
2. **EquipmentState transition table** — give the source side an audit record.
3. **Causal DAG reconstruction** — close the audit loop.
4. **Propagation descriptors + eligibility** — turn implicit behavior into data.
5. **Relationship hardening** — make topology changes auditable/safe.
6. **Lifecycle fusion + structural/alarm truth** — broaden guarantees across the
   IIoT domain.

---

## 6. Done Means

The architecture is done when the following statement is true and test-backed:

> For any Reactor-supported propagation, we can identify the source local
> transition, the durable source event, the relationship descriptor that made the
> target relevant, the target command dispatched, the target local transition,
> and the idempotency/checkpoint records that make replay safe.

If we cannot reconstruct that chain, we built magic. Prime, we are not building
magic. We are building a machine with receipts.
