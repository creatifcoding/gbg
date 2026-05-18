# Reactor Consistency Model

> **Status:** Draft formalization  
> **Date:** 2026-05-17  
> **Domain:** `src/lib/iiot/`  
> **Companion RFC:** [`ENTITY-RELATIONSHIPS-RFC.md`](./ENTITY-RELATIONSHIPS-RFC.md)  
> **Roadmap:** [`REACTOR-ARCHITECTURE-ROADMAP.md`](./REACTOR-ARCHITECTURE-ROADMAP.md)  
> **Anchor slice:** Machine maintenance → targeted WorkOrders suspend  

---

## 1. Purpose

This document formalizes the consistency model that sits on top of the IIoT
entity relationship graph.

The relationship RFC defines **what can be connected**. This document defines
**how connected entities remain consistent when one of them changes**.

The key correction is simple:

> **Domain events are the primitive. Delivery mechanisms are secondary.**

`LISTEN/NOTIFY`, PubSub, NATS, RPC, and SQL journal replay are transports or
delivery modes. They are not the consistency model. The Reactor consumes domain
events, queries relationship descriptors, and dispatches local entity commands.

---

## 2. Current Ground Truth

### 2.1 Already present

| Capability | Evidence | Status |
|---|---|---|
| Domain event schemas | `src/lib/iiot/schemas/events/**` | Exists |
| EventGroups | `src/lib/iiot/schemas/events/groups.ts` | Exists |
| EventLog infrastructure | `src/lib/iiot/infrastructure/eventlog-layer.ts` | Exists; Phase 0 includes WorkOrder + EquipmentState groups |
| SQL EventJournal | `src/lib/iiot/infrastructure/sql-event-journal.ts` | Exists |
| EventDistribution | `src/lib/iiot/realtime/event-distribution.ts` | Exists; Phase 0 adds WorkOrder lifecycle stream |
| NATS/Holonet bridge path | `EventDistribution` dual-writes through `HolonetBridge` | Exists |
| WorkOrder transition table/repo | `WorkOrderTransitionRepo`, `WorkOrderTransitionModel` | Exists |
| AGE graph client | `GraphClient` | Exists, hard-coded |

### 2.2 Important gaps

| Gap | Evidence | Consequence |
|---|---|---|
| Asset/Alarm generic helpers remain log-only | `entity/_helpers.ts` helpers log only | Structural/Alarm machines still need the new emitter path when their slices are targeted |
| Machine emission is only partially wired | WorkOrder + EquipmentState machines accept optional `DomainEventEmitter`; other machines do not yet | Reactor v1 should start with the wired vertical slices only |
| Event emission is partially transaction-fused | Reactor v1 source/target paths fuse EquipmentState transition and WorkOrder suspend with durable EventLog writes; WorkOrder reject/resume/complete/fail/cancel/close now share the same status + transition + durable EventLog boundary | V1 cascade and audited WorkOrder lifecycle facts are atomic at local transaction boundaries; non-audited lifecycle notifications remain compatibility paths |
| Realtime distribution is DTO-based | `EventDistribution` streams compact DTOs, not full EventLog entries | Reactor should treat realtime stream as warm notification and use journal for replay/catch-up |
| Only WorkOrder has transition audit | Non-WorkOrder machines mostly `state.set()` | Causal DAG and idempotency are incomplete across entities |
| Graph writes are partially generic | `GraphClient` now has registry-validated generic relationship node/edge APIs; legacy hard-coded helpers still exist | Future slices should use registry APIs and add propagation descriptors |

---

## 3. Core Definitions

### 3.1 Entity

An **Entity** is a state-owning actor with:

- an identity `(entityType, entityId)`;
- a lifecycle state machine;
- a local persistence boundary;
- typed commands exposed through Effect Cluster RPCs;
- optional transition audit records.

The entity that owns the state owns the decision to change that state.

### 3.2 Relationship

A **Relationship** is a directed graph edge:

```ts
(sourceEntity)-[edgeType + metadata + propagationDescriptor]->(targetEntity)
```

The graph stores topology and descriptors. SQL remains the source of truth for
entity state and audit records.

### 3.3 Domain Event

A **DomainEvent** is a fact emitted by an entity transition or lifecycle action.
It is schema-backed and may be persisted, distributed, replayed, or delivered
through multiple transports.

A transport payload is not the domain event. `pg_notify(...)` is a delivery
mechanism. `MachineStateChanged` or `WorkOrderSuspended` is the event.

### 3.4 Transition

A **Transition** is one state change of one entity.

Algebraic bound:

```text
one entity transition = one local transaction boundary = one propagation_id
```

Cross-entity cascades are causal DAGs of local transitions, not one global
transaction.

### 3.5 Propagation

A **Propagation** is the Reactor's interpretation of a domain event through graph
relationship descriptors.

Propagation does not transfer ownership of state. It only informs target
entities that they may need to act.

---

## 4. Responsibility Locality

Responsibility locality is the central invariant:

> The owner of state is responsible for acting on that state.

A Machine does not suspend WorkOrders. A Machine emits a fact:

```text
Machine MCH-001 transitioned operational → scheduled_maintenance
```

The Reactor observes that fact, traverses graph edges, and dispatches a typed
command to each affected WorkOrder:

```text
InternalSuspendWorkOrder(reason = equipment_unavailable, causedBy = PRP-001)
```

Each WorkOrder evaluates its own guard, idempotency, audit, and transition.
Completed WorkOrders are filtered or classified before noisy dispatch.

---

## 5. Event Delivery Tiers

The Reactor consumes a unified event stream. The source of that stream is
pluggable.

| Tier | Mechanism | Role | Durability |
|---|---|---|---|
| Hot | PostgreSQL trigger → `PgClient.listen(channel)` | Fast same-DB wakeup | None; missed while disconnected |
| Warm | `EventDistribution` → PubSub/ChannelService → NATS | Live application distribution | Process/NATS dependent |
| Cold | SQL EventJournal `entries` + `changes` | Replay and reconciliation | Durable |

Canonical Effect facts:

- `EventLog.makeClient(schema)` returns a typed event writer requiring
  `EventLog`.
- `EventLog.layer(schema)` requires event handler services, `EventJournal`, and
  `EventLog.Identity`.
- `EventJournal.entries` reads historical entries.
- `EventJournal.changes` is a scoped queue subscription for newly added local
  entries.
- `PgClient.listen(channel)` returns `Stream<string, SqlError>` and does not
  provide durable catch-up by itself.

The Reactor must therefore support:

1. **replay on boot** from the durable journal;
2. **live consumption** from distribution streams;
3. **optional hot wakeups** from database notifications;
4. **reconciliation** when live delivery is interrupted.

---

## 6. Runtime Shape Decision

The first Reactor should be a **sidecar Effect service/fiber**, not a per-entity
`Entity.toLayerMailbox` conversion.

### 6.1 Why sidecar first

Existing entities already expose typed RPC handlers through `Entity.toLayer`, and
`WorkOrderEntity` boots an internal `Machine` inside that scoped handler layer.
This is good enough for command handling.

A sidecar Reactor can:

1. subscribe to domain event streams;
2. query `GraphClient` for relationship descriptors;
3. pre-filter targets using SQL state;
4. dispatch typed entity RPC commands;
5. record no ownership over target outcomes.

This preserves the current entity boundary and avoids adding a second mailbox
layer before it is proven necessary.

### 6.2 When `toLayerMailbox` becomes appropriate

Use `Entity.toLayerMailbox` only if a specific entity instance must directly
consume a stream alongside its RPC mailbox, for example:

- high-frequency local event correlation;
- entity-local backpressure independent of global Reactor flow;
- event ordering that must be fused with command ordering at the mailbox level.

Until then, `toLayer` remains the command boundary and the Reactor remains a
separate service.

---

## 7. Formal Flow

Anchor scenario:

```text
MachineAsset/MCH-001 enters scheduled_maintenance.
WorkOrders targeting MCH-001 should suspend with reason equipment_unavailable.
```

### 7.1 Source transition

Inside the Machine entity's local transaction:

1. read current state;
2. validate transition;
3. generate `propagation_id = PRP-001`;
4. update Machine state;
5. insert Machine transition audit row;
6. emit `MachineStateChanged` domain event;
7. commit.

If the transaction rolls back, no propagation exists.

### 7.2 Reactor interpretation

The Reactor receives `MachineStateChanged` from one of the delivery tiers.

It then:

1. decodes and validates the domain event;
2. identifies source `(MachineAsset, MCH-001)` and transition;
3. queries graph relationships that have matching propagation descriptors;
4. joins candidate targets against SQL state for conservative pre-dispatch filtering;
5. dispatches typed commands to eligible target entities.

### 7.3 Target transition

Each WorkOrder receives a command carrying the source propagation id.

Inside the WorkOrder's local transaction:

1. check `hasPropagation(workOrderId, causedByPropagationId = PRP-001)`;
2. evaluate rich guard result;
3. if eligible, generate local `propagation_id = PRP-002`;
4. update WorkOrder state to `suspended`;
5. insert WorkOrder transition row with:
   - `propagation_id = PRP-002`;
   - `caused_by_propagation_id = PRP-001`;
6. emit `WorkOrderSuspended`;
7. commit.

The causal DAG is reconstructed from transition records.

---

## 8. Propagation Descriptor Shape

Relationship edges need descriptors that are explicit but not orchestration-heavy.

```ts
const PropagationDescriptor = Schema.Struct({
  trigger: Schema.Struct({
    eventTag: Schema.String,
    fromState: Schema.optionalWith(Schema.String, { as: 'Option' }),
    toState: Schema.String,
  }),
  target: Schema.Struct({
    entityType: Schema.String,
    command: Schema.String,
  }),
  mode: Schema.Literal('force', 'suggest', 'notify'),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
  filter: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  version: Schema.Number,
})
```

Meaning:

- `force`: strong invariant; target should transition unless impossible.
- `suggest`: target evaluates local policy and may decline.
- `notify`: target is informed but not commanded to transition.

The descriptor defines what **can** happen. Transition rows record what **did**
happen.

---

## 9. Rich Guard Contract

Boolean guards remain useful for local machines, but Reactor code needs richer
classification.

```ts
const EligibilityResult = Schema.Union(
  Schema.TaggedStruct('Eligible', {
    currentState: Schema.String,
    targetState: Schema.String,
  }),
  Schema.TaggedStruct('AlreadyInState', {
    currentState: Schema.String,
  }),
  Schema.TaggedStruct('TerminalState', {
    currentState: Schema.String,
  }),
  Schema.TaggedStruct('InvalidTransition', {
    currentState: Schema.String,
    targetState: Schema.String,
    validTargets: Schema.Array(Schema.String),
  }),
  Schema.TaggedStruct('Deferred', {
    currentState: Schema.String,
    reason: Schema.String,
  }),
)
```

This lets the Reactor distinguish:

- safe no-op;
- permanent skip;
- retryable deferral;
- real error;
- successful dispatch.

---

## 10. Idempotency Rule

Do not create a separate propagation log for v1.

Use transition rows:

```text
target transition has caused_by_propagation_id = incoming propagation id
```

A target entity has already processed an inbound propagation if any of its
transition rows contains that `caused_by_propagation_id`.

Recommended database constraint per transition table:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS ux_work_order_transition_inbound_propagation
ON iiot.work_order_transitions (work_order_id, caused_by_propagation_id)
WHERE caused_by_propagation_id IS NOT NULL;
```

This guarantees that crash retries cannot double-apply the same propagation to
the same entity.

---

## 11. Phase 0 Atomicity Stance

The Phase 0 implementation now writes real durable domain events for the
WorkOrder and EquipmentState slices, but it deliberately does **not** claim full
state/event atomicity yet.

Current behavior:

1. The machine applies its state change using the existing state/repository path.
2. The machine invokes `DomainEventEmitter` after the state operation returns.
3. `DomainEventEmitter` writes the schema-backed EventLog entry.
4. If `EventDistribution` is present, a compact warm notification is published
   after the durable write path is attempted.

This is enough for Reactor v1 bootstrapping because Reactor can treat
`EventJournal` as durable truth and `EventDistribution` as an accelerator. It is
not enough for a final FDA/ISA-grade audit guarantee: a crash between state write
and EventLog write can still produce a committed state transition with no domain
event.

Therefore the next hardening boundary is explicit:

- either move EventLog writes into the same `sql.withTransaction` boundary as the
  state write + transition audit; or
- introduce a transactional outbox row written inside that boundary, with a
  separate dispatcher converting outbox rows into EventLog entries and warm
  notifications.

Until that cut lands, no document or Reactor component should describe the warm
stream as authoritative. The durable replay source is the EventJournal; current
state remains the reconciliation backstop. Prime, no little distributed-systems
fairy tales in the margins.

---

## 12. Robustness Checklist

### 12.1 Event correctness

- [x] Expand `IIoTEventLogSchema` to include `WorkOrderEvents` and
      `EquipmentStateEvents` before Reactor depends on them.
- [x] Compose matching `EventLog.group(...)` handler layers for the included
      WorkOrder/Equipment/Alarm groups.
- [x] Introduce a real `DomainEventEmitter` service for WorkOrder and
      EquipmentState slices.
- [ ] Replace remaining log-only `maybeEmit*` helpers for structural and alarm
      machines as those slices enter scope.
- [x] Ensure event emission is inside the same local transaction as state +
      transition audit when the event claims a committed transition. Done for
      Reactor v1 EquipmentState transition and WorkOrder suspend, and for
      WorkOrder reject/resume/complete/fail/cancel/close lifecycle procedures.
- [x] Ensure EventDistribution publishes only after durable write succeeds, or
      mark the channel explicitly as non-durable telemetry. `DomainEventEmitter`
      strict path now writes durable EventLog first; realtime publish is best-effort
      after durable success.
- [x] Define replay cursor/checkpoint storage for Reactor consumers.

### 12.2 Graph and SQL correctness

- [x] Add v1 `work_order -[:targets]-> machine` graph APIs and relationship
      query.
- [x] Add registry-validated generic edge create/read/soft-delete APIs.
- [ ] Keep arbitrary agent Cypher read-only; never expose write/delete Cypher
      without an allowlisted operation.
- [ ] Use conservative pre-dispatch SQL filters; filter only definitely
      ineligible states.
- [ ] Index relational target state columns used by graph+SQL joins.
- [ ] Store edge descriptors with schema version and migration path.
- [ ] Decide whether each edge gets an application-level `EdgeId` in addition to
      AGE element ids.

### 12.3 Entity and transition correctness

- [ ] Add transition tables for every propagation-participating entity.
- [~] Add `propagation_id` and `caused_by_propagation_id` columns from day one. Done for WorkOrder transitions; other propagation-participating entities still need matching tables.
- [~] Add unique inbound propagation indexes per entity table. Done for WorkOrder transitions.
- [ ] Add `iiot.all_transitions` view for causal DAG queries.
- [ ] Preserve entity-local transactions; no distributed transaction fantasy,
      thank you very much.
- [ ] Keep command RPCs typed and schema-backed.

### 12.4 Reactor runtime correctness

- [x] Reactor is a sidecar service/fiber for v1.
- [x] Bounded concurrency per source event and per target entity type.
- [ ] Deduplicate event delivery across hot/warm/cold tiers.
- [ ] Treat `LISTEN/NOTIFY` as an accelerator only; always catch up from journal.
- [x] Use `Effect.withSpan` around plan, filter, dispatch, and reconciliation.
- [x] Persist Reactor checkpoints only after target dispatch attempt outcomes are
      classified.

### 12.5 Failure-mode checks

- [ ] Source commits but Reactor crashes before dispatch → boot replay catches it.
- [ ] Target processes command then crashes before reply → transition idempotency
      prevents double-apply.
- [ ] Live stream disconnects → journal replay fills gap.
- [x] Completed target appears in graph → pre-dispatch filter or rich guard marks
      terminal skip, no noisy failure.
- [ ] Same entity receives concurrent commands → entity mailbox/machine
      serialization remains authoritative; do not set cluster concurrency above 1
      without explicit per-command concurrency safety proof.

---

## 13. Optimization Checklist

### 13.1 Query optimization

- Prefer one graph traversal + SQL state join over N individual entity reads.
- Cache edge type registry and descriptor schemas in memory; invalidate through
  relationship update events.
- Materialize high-level health indicators incrementally instead of scanning the
  graph on every propagation.
- Add covering indexes on transition tables:
  - `(entity_id, transitioned_at DESC)`;
  - `(propagation_id)`;
  - `(caused_by_propagation_id)`;
  - `(entity_id, caused_by_propagation_id)` unique partial index.

### 13.2 Dispatch optimization

- Batch target classification before dispatch.
- Bound parallel dispatch by entity type and edge descriptor.
- Coalesce multiple notifications for the same `(entityType, entityId)` during a
  short window if they imply the same target command.
- Prefer `Reactor.plan()` for UI/agent previews and `Reactor.execute(planId)` for
  real execution.

### 13.3 Replay optimization

- [x] Store Reactor checkpoint by journal entry id and consumer id.
- Replay in chronological order per source entity.
- Permit parallel replay across independent source entities.
- During replay, run in classify-first mode: compute whether effects already
  exist before dispatching.

---

## 14. Modular Implementation Plan

Keep files small. The RFC is already large; the implementation should not be.

```text
src/lib/iiot/
├── schemas/
│   └── relationships/
│       ├── edge-metadata.ts
│       ├── edge-types.ts
│       ├── eligibility.ts
│       ├── propagation-descriptor.ts
│       ├── propagation-envelope.ts
│       └── reactor-events.ts
├── services/
│   └── reactor/
│       ├── DomainEventEmitter.ts
│       ├── DomainEventSource.ts
│       ├── Reactor.ts
│       ├── ReactorPlanner.ts
│       ├── ReactorDispatcher.ts
│       ├── ReactorCheckpointRepo.ts
│       └── index.ts
├── repos/
│   ├── TransitionRepository.ts
│   └── ReactorCheckpointRepo.ts
└── models/
    └── transitions/
        ├── all-transitions.view.ddl.ts
        └── transition-columns.ts
```

Target file size: 150–500 lines each. Split by boundary, not by whim.

---

## 15. Implementation Sequence

### Phase 0 — Event truth before Reactor

1. Expand `IIoTEventLogSchema` to include all groups Reactor needs. **Done for WorkOrder + EquipmentState.**
2. Compose matching event handler layers. **Done for Alarm + WorkOrder + EquipmentState.**
3. Replace `maybeEmit*` with `DomainEventEmitter`. **Done for WorkOrder + EquipmentState machines.**
4. Test that `WorkOrderMachine` emits real `WorkOrderSuspended` entries. **Done.**
5. Test that Equipment/Machine transition emits a real state-change event. **Done.**

### Phase 1 — Relationship vocabulary

1. Add edge metadata schemas. **Done for v1 envelope.**
2. Add edge type registry. **Done for initial edge vocabulary.**
3. Add propagation descriptor schema. **Pending.**
4. Add generic graph edge create/read/update/soft-delete operations. **Create/read/soft-delete done; update via upsert done.**
5. **Current v1 shape:** concrete `work_order -[:targets]-> machine` helpers now delegate to the generic registry-validated API.

### Phase 2 — Transition standardization

1. Add propagation columns to WorkOrder transitions.
2. Add transition tables for Machine and the first structural participants.
3. Add inbound propagation unique indexes.
4. Add `iiot.all_transitions` view.

### Phase 3 — Reactor sidecar

1. Implement `DomainEventSource` adapters:
   - EventJournal replay entry adapter; **done for `EquipmentStateChanged`**
   - EventDistribution live stream; **done for warm `EquipmentStateChange` DTOs**
   - optional Listen/Notify hot path later.
2. Implement `ReactorPlanner` for Machine maintenance → WorkOrder suspend. **Done for v1 service.**
3. Implement conservative SQL pre-dispatch filter. **Done for WorkOrder state classification.**
4. Implement `ReactorDispatcher` via typed entity RPC. **Done as a dispatcher port with production Entity RPC adapter.**
5. Add spans and checkpointing. **Done for v1 journal-entry dedupe.**

### Phase 4 — Hot path acceleration

1. Add PostgreSQL triggers that emit compact notification payloads.
2. Add `PgClient.listen` source with reconnect and journal catch-up.
3. Deduplicate hot/warm/cold delivery by event identity.

---

## 16. First Vertical Slice Acceptance Criteria

For Machine maintenance → WorkOrders suspend:

- [x] Machine transition creates a durable event.
- [x] Machine/EquipmentState transition creates a `propagation_id` and carries it on `EquipmentStateChanged`.
- [x] WorkOrders target Machine through graph `targets` edges.
- [x] Reactor sees Machine state-change event via durable EventJournal entry and warm EventDistribution DTO.
- [x] Reactor pre-filters completed/closed/cancelled WorkOrders.
- [x] Reactor dispatches suspend command only to eligible WorkOrders.
- [ ] WorkOrder rich guard classifies the transition.
- [x] WorkOrder transition row stores local `propagation_id` and inbound
      `caused_by_propagation_id`.
- [x] Replaying the same source event does not double-suspend.
  Reactor checkpoint dedupe skips already processed source journal entries;
  WorkOrder suspend also treats duplicate inbound `caused_by_propagation_id`
  as an idempotent no-op before state-graph rejection.
- [x] Causal chain query reconstructs Machine → WorkOrder propagation via `ReactorCausalDagRepo.getMachineWorkOrderChains`.

---

## 17. Causal DAG Query Contract

`ReactorCausalDagRepo.getMachineWorkOrderChains(query)` is the first cold-path
causal reconstruction API.

Supported bounds:

- `machineId`
- `propagationId`
- `startDate`
- `endDate`

The query reconstructs:

```text
iiot.equipment_state_transitions.propagation_id
  -> iiot.event_journal.payload.propagationId
  -> graph (work_order)-[:targets]->(machine)
  -> iiot.work_order_transitions.caused_by_propagation_id
```

Each returned `MachineWorkOrderCausalChain` includes:

- source Machine id;
- source local propagation id;
- source transition id/from/to/timestamp;
- optional durable EventJournal entry metadata;
- relationship edge type and graph verification flag;
- target WorkOrder id;
- target transition id/from/to/timestamp;
- target local propagation id;
- target inbound `caused_by_propagation_id`.

This is intentionally a **cold-path audit query**. It is not used on the hot
Reactor dispatch path.

---

## 18. Remaining Questions

1. Should skipped targets get a lightweight audit record, or is classification
   telemetry enough for v1?
2. Where should persistent EventLog identity live in production: DB table,
   KeyValueStore, or deployment-specific config?
3. Should `DomainEventEmitter` publish to EventDistribution directly, or should
   EventDistribution subscribe to EventJournal changes and fan out after durable
   write?
4. What is the v1 policy for descriptor migration when edge semantics change?
5. Should the first generic graph write API create application-level `EdgeId`s
   immediately, or can that wait until audit trail implementation?
