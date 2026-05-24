# Reactor Admission Control Substrate

Status: emergency architecture spec

## Decision

Reactor production cuts must use **both** layers:

```text
Effect concurrency primitives = app-level pressure control, ordering, coalescing, singleflight
SQL uniqueness / transactions / locks = distributed authority, fencing, durable truth
```

SQL remains the judge. Effect keeps the courtroom from becoming a food fight.

This spec exists because source-entry claims and target constraints are durable authority, but the Reactor hot path is still a highly concurrent application pipeline. If every duplicate, fan-out convergence, replay wave, or target-hot storm goes straight to SQL, we burn pool capacity and widen race surfaces before the authority even gets a chance to speak.

Research lineage and evolving source notes live in [REACTOR-ADMISSION-CONTROL-RESEARCH-LOG.md](./REACTOR-ADMISSION-CONTROL-RESEARCH-LOG.md). The concrete Reactor stage decomposition lives in [REACTOR-STAGE-BOUNDARY-LEDGER.md](./REACTOR-STAGE-BOUNDARY-LEDGER.md).

## Research inventory

Observed current stack/resources:

- `effect@3.19.18` is installed in this repo. Do not use Effect v4-only APIs.
- Official Effect docs emphasize service boundaries, `Effect.gen`, `Effect.withSpan`, and top-level `Layer` composition.
- Installed `Effect.d.ts` exposes `Effect.makeSemaphore(permits)`, `Semaphore.withPermits`, FIFO `take`, and `withPermitsIfAvailable`.
- Installed `Deferred.d.ts` exposes single-assignment `Deferred`, `Deferred.await`, `Deferred.complete`, `Deferred.completeWith`, `Deferred.done`, `Deferred.fail`.
- Installed `STM.d.ts` exposes `STM.commit`, `STM.retry`, and transactional composition.
- Installed `TMap.d.ts` exposes transactional `TMap.empty/get/set/setIfAbsent/remove/values/keys/size`.
- Installed `SynchronizedRef.d.ts` exposes `modifyEffect`, useful for effectful serialized map mutation.
- Existing project usage already includes `Deferred`, `Queue`, `Ref`, `STM`, and `TMap` in tests/services; current Reactor mock ledger uses `STM/TMap/Semaphore` locally.

## Non-negotiable boundary

Local Effect primitives may decide:

- whether to wait
- whether to coalesce
- whether to share an in-flight result
- how to order local target work
- how much SQL pressure to permit

Local Effect primitives may **not** decide:

- that a source entry is globally owned
- that a constraint is asserted/retracted in production
- that a stale owner can complete work
- that a policy epoch/fingerprint mismatch is acceptable
- that a target is released without SQL-backed reconciliation

## Canonical contention categories

### 1. Same source-entry duplicate delivery

Examples:

```text
hot NATS delivery + warm replay + retry loop
same EventJournal entry seen by two fibers in one runner
```

Authority: `iiot.reactor_source_claims`.

App-level guard:

- keyed serialization by `(consumerId, sourceEntryId)`
- only one local fiber attempts SQL claim at a time
- waiters do **not** share an acquired claim result; each waiter performs its own SQL authority check after the local gate opens

Benefit: avoids local SQL stampedes during hot duplicate bursts without duplicating a source ownership token.

### 2. Same target hot key

Examples:

```text
WO-123 receives multiple block/release requests
same machine fans out to many policies converging on same WorkOrder
same target receives manual hold + equipment release + quality hold
```

Authority: SQL constraints + WorkOrder state transition/audit.

App-level guard:

- keyed semaphore by `target.type:target.id`
- `withTargetGate(target, effect)` wraps target-owned reconciliation + local transition

Benefit: preserves local read/reconcile/transition/audit order in one runner.

### 3. Same constraint address duplicate work

Examples:

```text
same release request arrives twice
same assertion produced by two relationship paths
same replay wave re-emits an already processed condition
```

Authority: `iiot.reactor_constraints` natural key + generated `constraint_id`.

App-level guard:

- singleflight by natural constraint address or `constraint_id`
- optional keyed semaphore by constraint address for assert/retract calls

Benefit: avoids needless `INSERT ... ON CONFLICT` or `SELECT ... FOR UPDATE` storms.

### 4. Conflicting target signals

Examples:

```text
FaultCleared -> release dependency
MaintenanceModeEntered -> assert dependency block
AlarmTriggered -> safety hold
ApprovalRevoked -> approval hold
```

Authority: SQL active constraint set; target state graph owns transition.

App-level guard:

- target-keyed serialization
- ordered target pipeline:
  1. SQL assert/retract
  2. read active target constraints
  3. inspect local target state
  4. maybe transition
  5. audit/event

Benefit: app-local state cannot observe a half-ordered blend of release/block work.

### 5. Graph fan-out convergence inside one Reactor run

Examples:

```text
source machine -> targets -> WO-1
source machine -> requires -> WO-1
line -> contains -> machine -> WO-1
```

Authority: SQL natural keys still dedupe.

App-level guard:

- run-local coalescer before dispatch
- group by `(target, capability, source, relationshipEdgeType, policyId, propagationId)`
- retain provenance metadata for all paths, dispatch once

Benefit: removes redundant classification and SQL work before it starts.

### 6. Replay / catch-up pressure wave

Examples:

```text
Reactor restarts after downtime
backfill reads 10k EventJournal entries
NATS reconnect drains backlog
```

Authority: SQL claims/checkpoints/constraints.

App-level guard:

- global SQL budget semaphore
- per-target keyed semaphore
- bounded `Effect.forEach(..., { concurrency })`
- optional queue for cold replay worker lanes

Benefit: protects the pool and prevents target-hot keys from starving other work.

### 7. Zombie/stale local fibers

Examples:

```text
fiber starts claim, stalls, lease expires
another runner reacquires SQL claim
old fiber resumes and tries completion
```

Authority: SQL claim token, lease, policy epoch, registry fingerprint.

App-level guard:

- local timeout/deadline around long phases
- local heartbeat scheduler under the source-entry guard
- `Effect.ensuring`/`Effect.onExit` to remove in-flight map entries

Benefit: local maps do not leak, and zombie fibers are less likely to keep wasting work.

### 8. Target entity mailbox contention

Examples:

```text
WorkOrderEntity gets release/resume bursts
Cluster mailbox serializes but caller side still stamps SQL first
```

Authority: Entity state transition + SQL audit.

App-level guard:

- target-keyed semaphore before calling target entity
- optional mailbox queue integration later

Benefit: caller side applies pressure control before expensive target RPCs.

## Proposed production service

Name: `ReactorAdmissionControl`.

Architectural role: admission control for Reactor work entering expensive or authority-backed stages. Effect v3 implementation: `Context.Tag` + `Layer.effect`.

```ts
interface ReactorAdmissionControlShape {
  readonly withTargetGate: <A, E, R>(
    target: RelationshipEndpoint,
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>

  /** Important: serialize attempts; do not share an acquired ownership result. */
  readonly withSourceEntryClaim: <A, E, R>(
    key: { consumerId: string; sourceEntryId: string },
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>

  readonly withConstraintSingleflight: <A, E, R>(
    key: string,
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>

  readonly singleflight: <A, E, R>(
    key: string,
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>

  readonly withSqlBudget: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>
}
```

### Internal resources

```text
keyedSemaphores: SynchronizedRef<Map<string, { semaphore, lastUsed, refCount }>>
inFlight: TMap<string, Deferred<unknown, unknown>>
sqlBudget: Semaphore(N)
```

### Cleanup rules

- Every `singleflight` insertion must be removed with `Effect.ensuring` or `Effect.onExit`.
- Keyed semaphore map needs TTL or refcount cleanup to avoid unbounded target-key growth.
- Every API must add spans and key annotations.

## Insertion points

### `ReactorConstraintAuthoritySqlLive`

Wrap SQL work:

```text
assert       -> withConstraintSingleflight(constraintNaturalKey, withSqlBudget(sqlAssert))
retract      -> withConstraintSingleflight(retractionAddress, withSqlBudget(sqlTransaction))
activeForTarget -> withSqlBudget(sqlQuery)
```

`retract` already uses PostgreSQL transaction/advisory locks. Target-owned adapters can add `withTargetGate` around the reconcile + target-transition sequence when they need local serialization before target mutation.

### `Reactor` / `ReactorDispatcher`

Before dispatch:

```text
coalesce decisions by stable dispatch key
then Effect.forEach(coalesced, concurrency = bounded)
```

### `WorkOrderDependencyReleaseLive`

Wrap target-local transition path:

```text
withTargetGate(target,
  authority.retractFromReactionRequest(request)
  -> inspect WorkOrder state
  -> maybe WorkOrder resume
)
```

This ensures the SQL reconcile + target state decision are locally serialized for the same target.

### Source-entry claim path

Wrap `tryAcquire`:

```text
withSourceEntryClaim(consumerId:sourceEntryId, withSqlBudget(sourceClaimRepo.tryAcquire(...)))
```

SQL claim remains authoritative. The local guard serializes same-runner attempts but intentionally does **not** singleflight/share results: if the first caller receives `ReactorClaimAcquired`, waiters must perform their own SQL authority check rather than inheriting the owner token.

## Emergency cut plan

### Cut 1 — Introduce service only

- Add `ReactorAdmissionControl.ts`.
- Unit tests for:
  - keyed target serialization
  - singleflight shares one execution across concurrent callers
  - SQL budget caps concurrent effects
  - cleanup after success/failure

### Cut 2 — Wire authority

- Inject `ReactorAdmissionControl` into `ReactorConstraintAuthoritySqlLive`.
- Tests prove concurrent `assert`/`retract` calls produce fewer underlying SQL attempts where singleflight applies.
- SQL integration tests still pass.

### Cut 3 — Wire WorkOrder release adapter

- Wrap release dispatch in `withTarget`.
- Add test proving two concurrent all-clear release requests only attempt one resume when authority returns idempotent/constraint-retracted mix.

### Cut 4 — Dispatcher coalescing

- Add run-local coalescer in dispatcher/planner boundary.
- Preserve provenance metadata for all converged paths.
- Tests for graph fan-out convergence.

### Cut 5 — Observability and defaults

- Spans: `iiot.reactor.admission.withTarget`, `.singleflight`, `.withSqlBudget`.
- Counters in metadata/logs: waiters, coalesced, sqlBudgetWait, targetQueueWait.
- Config defaults:
  - global SQL permits: conservative, e.g. `8`
  - target permits: `1`
  - source-entry keyed serialization: enabled
  - constraint singleflight: enabled for assertion, careful for retraction

## Production cautions

- Do not use local singleflight for operations whose result must be independently observed by each caller unless waiters receive the same typed result safely.
- Do not hold local target semaphore across external calls that can hang without timeout.
- Do not wrap long cold replay batches in one giant target lock; lock per target operation.
- Do not let local maps grow unbounded; use TTL/refcount cleanup.
- Do not treat local dedupe as a checkpoint.

## Verdict

We are in good shape for an emergency cut **if we cut the substrate first**. The current SQL authority is clean enough to wrap. The WorkOrder release adapter is now thin enough to serialize. The remaining risk is not conceptual; it is implementation hygiene around cleanup, boundedness, and tests that prove local guards reduce pressure without weakening SQL authority.
