# Reactor Target-Owned Release Semantics

Status: design draft with SQL-first mock substrate

## Definition

A target-owned release is not an inverse dispatch. A source event such as `FaultCleared`, `MaintenanceModeExited`, `NCRClosed`, or `ApprovalGranted` may retract or update one constraint that previously constrained a target, but the target entity owns the decision to change local state.

In other words:

```text
source event -> release constraint request -> target reconciliation -> target verdict -> optional local transition/events
```

The Reactor may route the signal. It must not decide that the WorkOrder, alarm, approval, or quality aggregate is now safe to resume/release.

## Why this exists

Blocking is monotonic enough for the current lane: machine unavailable means a related active WorkOrder can be suspended if the WorkOrder accepts the request.

Release is not monotonic. Clearing one source condition does not prove the target is clear because the target may still have:

- another equipment fault or maintenance hold
- a quality hold
- an approval hold
- a manual/operator hold
- a safety/compliance hold
- a terminal or non-resumable local state
- a previous release already applied
- an unrecognized or stale source constraint

So release must be target-owned reconciliation, not source-owned optimism.

## Ratified working model

From the alignment pass:

- **Primitive**: target constraint-ledger reconciliation.
- **Composition**: all active blocking constraints must clear before target release.
- **Reactor API**: Reactor may send an `EntityReactionRequest` such as `work_order.dependency.released`.
- **Scope**: design the generic substrate first, document it, and trial with WorkOrder mock tests before production promotion.

## Constraint ledger model

The target needs a durable ledger of constraints. Reconstructable/in-memory ledgers are acceptable for trials, but production authority is the SQL table `iiot.reactor_constraints` with stable constraint identity, uniqueness, transaction-scoped target locks, policy epoch, and registry fingerprint.

```text
ConstraintIdentity
  target: RelationshipEndpoint
  capability family: dependency | safety | quality | approval | lifecycle
  source: RelationshipEndpoint
  source event / propagation id
  relationship edge type
  policy id + version

ConstraintState
  asserted | retracted | superseded | ignored

ConstraintEffect
  blocking | holding | informational | release_candidate
```

A blocking event asserts constraint. A release event retracts one constraint identity or one constraint family member. The target then reconciles the remaining active constraints.

## Effect module candidates

Grounded against the installed Effect v3 API (`effect@3.19.18`):

| Module | Use here | Boundary |
| --- | --- | --- |
| `Schema` | Constraint identity, constraint records, release verdicts, reconciliation requests/results. | Domain contract. Good now. |
| `Context` + `Layer` | `TargetConstraintLedger` service and swappable mock/SQL layers. | Service wiring. Good now. |
| `STM` + `TMap` | Atomic in-process mock ledger updates and concurrent trial tests. | Test/local simulation only; not distributed authority. |
| `Effect.makeSemaphore` | In-process serialization for mock target reconciliation. | Useful for deterministic mock trials; not a distributed lock. |
| `Effect.withSpan` | Trace assert/retract/reconcile operations. | Observability. Good now. |
| `DateTime` | Assertion/retraction timestamps. | Domain audit timestamp source. |
| `Schedule` + `Effect.retry` | Future retry/deferred reconciliation for transient failures. | Recovery loops. Use after SQL layer. |
| `Deferred` / `Latch` | Coordinated concurrent tests and gate-style simulations. | Test harness / local orchestration, not authority. |
| `Scope` / `acquireRelease` | Resource-safe sidecar lifecycle if we run a reconciler fiber. | App boundary / sidecar runtime. |
| `@effect/sql` transaction APIs | Production constraint authority via rows, unique keys, transaction isolation, and transaction-scoped advisory locks. | Distributed authority. Present as `ReactorConstraintAuthoritySqlLive`; still needs WorkOrder transition integration before event promotion. |
| `@effect/cluster` Entity | Optional owner-key mailbox serialization by target. | Optimization/coordination; SQL remains authority. |

Distributed rule: local locks, `Semaphore`, `Ref`, `SynchronizedRef`, `STM`, and `TMap` coordinate fibers inside one runtime. They do not protect a multi-runner deployment. SQL is the authority: unique constraint identities, transactional assert/retract, target-scoped advisory locks, fencing metadata, and token/epoch checks analogous to source-entry claims. Local Effect primitives are allowed only as coalescing, deterministic-test, or in-process backpressure aids.

## Release request contract

A release-capable Reactor request should carry enough information for target reconciliation:

```text
EntityReactionRequest
  capability: work_order.dependency.released
  source: machine/device/quality/approval/etc.
  target: work_order
  signal: condition_retracted / state_changed
  policyId + policyVersion
  causality.propagationId
  payload:
    relationshipEdgeType
    constraintFamily
    constraintKey / assertedByPropagationId if known
    releaseReason
```

The request asks for reconciliation. It does not command `ResumeWorkOrder` directly.

## Target verdict vocabulary

The target should return a schema-backed result rather than loose strings:

| Verdict | Meaning |
| --- | --- |
| `released` | Constraint was cleared and target state changed or became releasable. |
| `constraint_retracted` | This constraint cleared, but target did not transition. |
| `active_holds_remaining` | Release accepted, but other holds still block transition. |
| `idempotent` | Same constraint was already retracted or release already handled. |
| `unknown_constraint` | Release refers to constraint the target does not recognize. Usually skip, not fail. |
| `manual_hold` | Human/operator hold prevents automatic release. |
| `safety_hold` | Safety/compliance hold prevents automatic release. |
| `terminal_state` | Target state cannot transition. |
| `invalid_transition` | Local state graph rejects the release transition. |
| `deferred` | Target cannot decide yet; retry/reconciliation needed. |
| `failed` | System or data error, not domain ineligibility. |

## WorkOrder trial semantics

For WorkOrder dependency release:

1. `EquipmentStateChanged/FaultDetected/MaintenanceModeEntered` assert `dependency.blocked` constraint.
2. WorkOrder may suspend if eligible.
3. `FaultCleared/MaintenanceModeExited` may request `dependency.released`.
4. WorkOrder reconciles active constraints.
5. WorkOrder only resumes if:
   - current state is `suspended`
   - the matching constraint is retracted or all equipment constraints are clear
   - no other dependency/safety/quality/approval/manual holds remain
   - target state graph allows `suspended -> resumed`
   - idempotency/audit checks pass
6. WorkOrder emits its own transition/audit/domain event if it resumes.

## Current gaps observed in code

Observed files:

- `src/lib/iiot/services/reactor/contracts/work-order.ts`
- `src/lib/iiot/machines/WorkOrderMachine.ts`
- `src/lib/iiot/repos/WorkOrderTransitionRepo.ts`
- `src/lib/iiot/machines/graphs/work-order-eligibility.ts`
- `src/lib/iiot/schemas/relationships/eligibility.ts`

Current state:

- `dependency.blocked` exists as a WorkOrder capability.
- `dependency.released` is a runtime trial capability only when `WorkOrderDependencyReleaseLive` is provided; it is not in production routing.
- `WorkOrderMachine` has a `Resume` transition, but it is a direct local command, not Reactor reconciliation.
- `WorkOrderTransitionRepo.hasInboundPropagation` proves idempotent blocking by `caused_by_propagation_id`.
- This slice now has schema-backed constraint identity/reconciliation contracts, an in-memory mock ledger, and SQL-backed `ReactorConstraintAuthoritySqlLive` over `iiot.reactor_constraints`.
- The durable ledger asserts constraints idempotently, retracts inside SQL transactions, and serializes target reconciliation with transaction-scoped PostgreSQL advisory locks.
- WorkOrder dependency release now has a thin trial adapter (`WorkOrderDependencyReleaseLive`) that consumes `ReactorConstraintAuthority`; SQL ledger presence is still substrate, not production event promotion.
- `WorkOrderResumed` does not currently carry release causality fields.

## Promotion proof requirements

Before promoting any release event to production Reactor dispatch:

1. **Observation decode test** for release-capable source events.
2. **Registry policy test** for `condition_retracted`/release signal matching.
3. **Constraint ledger test** for assert/retract/idempotency behavior.
4. **All-clear composition test** proving one clear does not release while another hold remains.
5. **Manual/safety veto test** proving target-owned holds block auto-release.
6. **Target transition test** proving WorkOrder owns `suspended -> resumed`.
7. **Source-claim E2E test** proving claim/checkpoint behavior matches block lanes.

## Rule of thumb

A release-capable event may remove a reason to stay blocked. It never proves the target is safe to run.
