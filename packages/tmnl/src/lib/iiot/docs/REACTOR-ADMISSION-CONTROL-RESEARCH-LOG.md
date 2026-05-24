# Reactor Admission Control Research Log

Status: living research log
Owner: IIoT Reactor workstream
Started: 2026-05-21

Related ontology record: [REACTOR-STAGE-BOUNDARIES.md](./REACTOR-STAGE-BOUNDARIES.md)
Reusable skill: `.pi/skills/stage-boundary-decomposition/`

## Why this exists

The Reactor is not just an event dispatcher. It is a structural consistency engine that consumes durable domain events, claims source entries, expands graph relationships, asserts/retracts target constraints, and invokes target-owned transition contracts.

That means we need more than database correctness. We also need an app-level admission layer that prevents duplicate delivery, fan-out convergence, replay waves, and target-hot storms from overloading the SQL authority layer.

Working name: **ReactorAdmissionControl**.

```text
Effect primitives = local admission, pressure control, serialization, duplicate suppression
SQL authority = distributed ownership, idempotency, fencing, durable truth
```

## Primary literature and pattern lineage

| Source | Canonical idea | Relevance to Reactor |
| --- | --- | --- |
| Welsh, Culler — **Adaptive Overload Control for Busy Internet Servers** / SEDA lineage | Services as event-driven stages connected by explicit queues; per-stage admission controllers; overload as a first-class programming concern. | Reactor can be treated as stages: source claim, observation, planning, graph expansion, constraint authority, target transition. Each stage can have bounded admission rather than unbounded fan-out. |
| Welsh, Culler, Brewer — **SEDA: An Architecture for Well-Conditioned, Scalable Internet Services** | Explicit event queues expose request streams and enable resource controllers. | Supports a future Reactor pipeline with explicit stage queues and per-stage backpressure instead of direct recursive dispatch. |
| Google SRE — **Handling Overload** | Systems should accept only the work they can process; protect individual tasks from overload; use throttling, quotas, criticality, and retry budgets. | ReactorAdmissionControl should protect local runners and SQL pools. Replay/backfill traffic should be lower criticality than hot operational traffic. |
| Enterprise Integration Patterns — **Idempotent Receiver** | Receivers must safely handle duplicate messages via dedupe or idempotent semantics. | SQL source claims and constraint natural keys are our durable idempotent receiver mechanism. Effect gates/singleflight reduce duplicate pressure before SQL without replacing authority. |
| Enterprise Integration Patterns — **Competing Consumers** | Multiple consumers on one channel increase throughput, but each message must be handled safely by one receiver or idempotently. | Reactor workers may compete across hot/warm/cold delivery lanes. SQL claims decide global ownership; local admission only reduces local contention. |
| Go `x/sync/singleflight` | Duplicate function-call suppression: one in-flight execution per key; duplicate callers await/share result. | Direct model for constraint operations where sharing a typed result is safe. Source claims use keyed serialization instead, because sharing an acquired claim result would duplicate ownership. |
| Reactive Streams / Reactor Core backpressure | Consumers signal demand; producers do not push unbounded work downstream. | Conceptual support for bounded dispatch and future queue-based Reactor stages, though our durable authority remains SQL. |
| Actor/mailbox systems: Akka, Orleans, Effect Cluster entities | Keyed entity/mailbox serialization preserves per-entity ordering. | Target-owned reaction contracts benefit from target-keyed gates before WorkOrder/Alarm/Machine entity transitions. |

## SEDA notes worth preserving

SEDA is especially interesting because it is not merely “use queues.” Its sharper idea is:

```text
stage boundary = visibility + control point
```

In the Reactor ontology, the lodestone definition is:

```text
A stage boundary is a typed, observable handoff between Reactor semantic artifacts where we may attach admission control, idempotency, durability, retry/parking, and ownership rules without changing the meaning of the domain event.
```

A SEDA stage has:

- an incoming event queue
- an event handler
- worker capacity
- an admission controller
- resource/latency observations

The Reactor analogue:

| SEDA concept | Reactor analogue |
| --- | --- |
| Event-driven stage | Source claim, observation, planning, graph expansion, constraint authority, target transition |
| Explicit queue | Future bounded queue between Reactor phases, or bounded `Effect.forEach` lanes now |
| Admission controller | `ReactorAdmissionControl` methods: SQL budget, target gate, source-claim gate, constraint singleflight, coalescer |
| Stage-local overload signal | SQL budget wait, target wait, singleflight waiter count, queue depth, retry pressure |
| Service degradation | Defer cold replay, reduce fan-out batch size, park low-priority propagation, never bypass authority |
| Class-based differentiation | Hot domain events > warm replay > cold backfill / repair |

Important SEDA caution: late-stage rejection wastes upstream work. For Reactor, classify and coalesce early where possible:

```text
journal entry -> source-claim gate -> observation -> coalesce plan -> SQL/target gates
```

## Current adoption map

### Immediate adoption

1. **Keyed serialization by source entry**
   - Key: `consumerId:sourceEntryId`
   - Primitive: per-key semaphore with refcount cleanup
   - Authority remains: `iiot.reactor_source_claims`
   - Non-negotiable: do not share `ReactorClaimAcquired` results between waiters; each caller must observe its own SQL authority verdict.

2. **Singleflight by constraint address**
   - Key: natural constraint address or `constraint_id`
   - Primitive: `Deferred`
   - Authority remains: `iiot.reactor_constraints`

3. **Target-keyed gate**
   - Key: `target.type:target.id`
   - Primitive: keyed `Semaphore(1)`
   - Authority remains: active constraints + target state graph

4. **SQL budget**
   - Key: process-wide Reactor SQL budget
   - Primitive: `Semaphore(N)`
   - Authority remains: database transactions/locks

5. **Run-local coalescing**
   - Key: dispatch natural key
   - Primitive: `TMap` / Map before dispatch
   - Authority remains: constraint natural key uniqueness

### Later adoption / SEDA evolution

1. Split Reactor execution into explicit internal stages.
2. Add bounded queues between hot/warm/cold lanes.
3. Add criticality classes:
   - hot operational event
   - warm replay
   - repair/backfill
   - diagnostic audit query
4. Add stage metrics:
   - queue depth
   - admission rejects/parks
   - p90/p99 wait by gate type
   - coalesced count
   - SQL budget wait
   - target-gate wait
5. Add policy for parking low-criticality work rather than failing it.

## Design implications for this repo

### Keep SQL as authority

Admission control must not become hidden business logic. It can delay/share/coalesce work, but it must not decide the final truth of ownership, active constraints, target release, or transition eligibility.

### Prefer target-owned semantics

The target entity still owns:

- eligibility
- idempotency
- local transition
- audit
- emitted events

Admission control merely decides when/how many local fibers may enter that critical region.

### Treat replay as sheddable/deferable

Hot operational traffic should not be starved by cold replay. This is directly aligned with SRE criticality and SEDA class-based differentiation.

### Coalesce early, validate late

Coalesce duplicate local work before SQL, but always validate through SQL after coalescing.

## Open research questions

1. Should ReactorAdmissionControl be one service or split into:
   - `ReactorAdmissionControl`
   - `ReactorSingleflight`
   - `ReactorTargetGate`
   - `ReactorPressureBudget`
2. Do we need explicit internal queues now, or are bounded `Effect.forEach` + semaphores enough for the first production cut?
3. Should hot/warm/cold delivery lanes have separate SQL budgets?
4. What is the default SQL permit count relative to the `@effect/sql` pool size?
5. Should target gates be per target only, or `(target, capability)` for some capabilities?
6. How should parked low-criticality replay work be checkpointed so parking is durable and inspectable?

## Source links

- Adaptive Overload Control for Busy Internet Servers: https://www.usenix.org/events/usits03/tech/full_papers/welsh/welsh_html/
- SEDA paper PDF: https://people.eecs.berkeley.edu/~brewer/papers/SEDA-sosp.pdf
- Google SRE Handling Overload: https://sre.google/sre-book/handling-overload/
- EIP Idempotent Receiver: https://www.enterpriseintegrationpatterns.com/patterns/messaging/IdempotentReceiver.html
- EIP Competing Consumers: https://www.enterpriseintegrationpatterns.com/patterns/messaging/CompetingConsumers.html
- Go singleflight: https://pkg.go.dev/golang.org/x/sync/singleflight
- Reactive Streams: https://www.reactive-streams.org/
- Project Reactor reference: https://docs.spring.io/projectreactor/reactor-core/docs/current/reference/html/

## Current conclusion

The design is not novel in the dangerous sense. It is a synthesis of known patterns:

```text
SEDA stage admission + SRE overload protection + EIP idempotent receiver
+ singleflight duplicate suppression + actor-style target serialization
+ SQL-backed distributed authority
```

The novel part is the domain binding: graph-expanded domain events become target-owned constraints, and admission control protects that pipeline without stealing authority from SQL or target entities.
