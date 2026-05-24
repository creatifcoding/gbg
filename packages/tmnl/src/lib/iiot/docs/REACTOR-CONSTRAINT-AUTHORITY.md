# Reactor Constraint Authority

Status: architecture draft / SQL-first substrate

## Problem

Reactor constraints are not helper strings and they do not belong inside a target contract. A constraint is a durable, SQL-authoritative claim that a source condition restricts a target's permissible transitions.

The target contract may decide whether a local transition is allowed. It must not invent global constraint identity.

## Decision summary

1. **SQL owns authority.** `iiot.reactor_constraints` is the distributed authority for assertion, retraction, active-query, and reconciliation state.
2. **Natural identity is authoritative.** The uniqueness tuple is the constraint identity. A `constraint_id` is a SQL-generated/read-model surrogate, not a hand-built target-contract string.
3. **Effect service owns behavior.** `ReactorConstraintAuthority` owns assert/retract/reconcile APIs and transaction boundaries. On the current Effect v3 stack this is implemented with `Context.Tag` + `Layer.effect`; it is the service boundary Prime asked for without sneaking in v4-only APIs.
4. **Target contracts are thin.** A WorkOrder contract may call the authority, but it does not compose IDs, inspect arbitrary payload strings, or decide distributed idempotency.
5. **Release requires an address.** Release-capable requests must carry either a `constraint_id` issued by the authority or an explicit natural address. No fallback synthesis.
6. **Local Effect primitives are supporting only.** `Semaphore`, `STM`, `TMap`, `Ref`, and Cluster entity mailboxes can smooth local execution, but SQL uniqueness/transactions/fencing decide correctness.

## Authority boundary

```text
ReactorObservation
  -> propagation policy
  -> EntityReactionRequest
  -> ReactorConstraintAuthority.assert/retract/reconcile
  -> SQL transaction
  -> target-local transition decision
```

The authority is below Reactor routing and above target-local state machines.

## Service shape

```ts
class ReactorConstraintAuthority extends Context.Tag('iiot/ReactorConstraintAuthority')<
  ReactorConstraintAuthority,
  {
    assert(input: ReactorConstraintAssertion): Effect<ReactorConstraintRecord, ...>
    retract(input: ReactorConstraintRetraction): Effect<TargetConstraintReconciliationResult, ...>
    retractFromReactionRequest(request: EntityReactionRequest): Effect<TargetConstraintReconciliationResult, ...>
    activeForTarget(target: RelationshipEndpoint): Effect<readonly ReactorConstraintRecord[], ...>
  }
>() {}
```

## SQL identity

The natural key is:

```text
target_type
target_id
capability
source_type
source_id
relationship_edge_type
policy_id
propagation_id
```

`constraint_id` is derived by SQL from this tuple for stable references and logs. Callers do not build it.

## Transaction model

### Assert

```text
BEGIN
  INSERT natural key + metadata
  ON CONFLICT natural key DO UPDATE metadata/audit fields only
  RETURN row
COMMIT
```

### Retract

```text
BEGIN
  pg_advisory_xact_lock(target)
  SELECT addressed constraint FOR UPDATE
  if missing -> unknown_constraint
  if already retracted -> idempotent
  UPDATE state = retracted, retracted_at = NOW()
  COUNT active constraints for target
  return constraint_retracted | active_holds_remaining
COMMIT
```

The target may then decide whether the local state graph allows a transition. The authority does not resume WorkOrders.

## WorkOrder dependency-release trial boundary

`WorkOrderDependencyReleaseLive` is a thin target-owned adapter:

1. It asks `ReactorConstraintAuthority` to retract an explicitly addressed constraint.
2. It inspects the post-retraction active constraint count.
3. Only if all constraints are clear does it ask `WorkOrderEntity` to resume through the WorkOrder state graph.
4. It never builds constraint ids and never bypasses SQL authority.

This is still a trial lane. `FaultCleared` and `MaintenanceModeExited` are not promoted to production routing until release-capable observation specs and relationship policies are separately ratified.

## Non-goals

- No WorkOrder-local constraint ID composition.
- No release event promotion until request addressing and WorkOrder transition semantics are explicit.
- No local lock pretending to be distributed authority.
