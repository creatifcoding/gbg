# Reactor Constraint Addressing Audit

Status: v2 substrate audit

## Question

Can a release-capable Reactor lane retract the exact SQL constraint asserted by the corresponding blocking/holding lane without target-local ID synthesis?

Answer today: **the SQL authority can do it, but the generic planner does not yet enrich every release request with the natural address required to do it automatically.**

## Existing authority

`iiot.reactor_constraints` is the distributed source of truth.

Natural key:

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

The table derives `constraint_id` from that tuple. Callers do not build the surrogate ID.

`ReactorConstraintAuthority` supports:

- `assert(ReactorConstraintAssertion)`
- `retract(ReactorConstraintRetraction)`
- `retractFromReactionRequest(EntityReactionRequest)`
- `activeForTarget(RelationshipEndpoint)`

Retraction already requires either:

- `constraintId`, or
- `ReactorConstraintNaturalAddress`

If neither is present, the service fails with `ReactorConstraintAddressRequired`.

## Current assertion path

Observed live equipment-unavailable flow:

```text
EventJournal entry
  -> EventObservationSpec
  -> ReactorObservation
  -> RelationshipPropagationPolicy
  -> GraphClient.expandPropagationTargets
  -> ReactorPlanner builds EntityReactionRequest
  -> WorkOrder dependency.blocked target capability
  -> WorkOrderEntity.Suspend
  -> WorkOrderTransition audit causality
```

SQL constraint assertion exists in the broader Reactor constraint authority/release slice, but baseline equipment-unavailable blocking currently reaches WorkOrder suspension through the target contract path. v2 promotion should make every blocking/holding target capability consistently assert SQL constraints before or as part of target mutation.

## Current release path

`WorkOrderDependencyReleaseLive` is the cleanest target-owned release adapter:

1. Decode `ReactorConstraintRetractionPayload` from the `EntityReactionRequest.payload`.
2. Ask `ReactorConstraintAuthority.retract` to retract the addressed constraint.
3. If the result is not `constraint_retracted` or other constraints remain, stop.
4. Query target WorkOrder state.
5. If target is terminal or not suspended, stop.
6. Otherwise call `WorkOrderEntity.Resume` with `causedByPropagationId`.

This is correct target ownership, but it depends on the incoming release request already carrying a valid address.

## Gap

`ReactorPlanner` currently builds request payloads primarily from policy `payloadDefaults` plus relationship edge type/reason:

```ts
payload: {
  ...policy.request.payloadDefaults,
  reason: policy.request.reason,
  relationshipEdgeType: policy.edgeType,
}
```

That is enough for simple target-owned blocking, but not enough for generic release.

A release-capable request needs a natural address for the original blocking/holding constraint. For example, a `depends_on.work-order-block-retracted.releases-source` request must be able to address the earlier `depends_on.work-order-blocked.blocks-source` constraint, not the release policy itself.

## Addressing rule

Every release policy needs an explicit mapping from release request to asserted constraint address.

Minimum address fields:

| Field | Source |
| --- | --- |
| `target` | request target endpoint |
| `capability` | originally asserted capability, not necessarily release capability |
| `source` | observed source endpoint used by original pressure |
| `relationshipEdgeType` | original edge type |
| `policyId` | original assertion policy id |
| `propagationId` | original source propagation id or `causedByPropagationId` when release event is derivative |

## Lane-specific audit

### Equipment availability release

Candidate events:

- `MaintenanceModeExited`
- `FaultCleared`
- `EquipmentStateChanged` with available state

Missing before live:

- release policy declaration for equipment available
- mapping from available signal to the original unavailable policy id
- proof that propagation id identifies the prior unavailable condition or carries `causedByPropagationId`

### WorkOrder depends_on release

Candidate event:

- `WorkOrderResumed`

Existing observation uses:

```text
kind = condition_retracted
value = blocked
propagationId = causedByPropagationId
```

This is promising. The release event can point back to the blocking propagation id if upstream resume was caused by Reactor. Still required:

- exact natural address enrichment in planner or policy payload
- integration test proving upstream resumed retracts the same SQL row asserted by upstream suspended/failed/cancelled
- behavior for manual resume without `causedByPropagationId`

### Alarm safety release

Candidate event:

- `AlarmCleared`

Missing before live:

- target-owned `safety.release` contract
- exact mapping to original `safety.hold` policy ids
- multi-alarm proof: clearing one alarm must not release another alarm's hold

### Structural decommission

Mostly assertion-only today. Release is not naturally implied by decommission. No release lane should be invented.

### External/device availability

Candidate events:

- `ExternalRefLinked` -> available/release
- future device available event does not currently exist

Missing before live:

- projection ordering/as-of graph expansion decision
- address mapping to original unavailable policy id
- durable device-available event or explicit parked status

## Required implementation move

Add a schema-backed constraint address payload that the planner can populate for release policies without target contracts constructing IDs.

Implemented model seed:

```ts
class RelationshipConstraintAddressHint extends Schema.TaggedClass<RelationshipConstraintAddressHint>()(
  "RelationshipConstraintAddressHint",
  {
    assertedCapability: EntityCapabilityId,
    assertionPolicyId: PropagationPolicyId,
    propagationIdSource: Schema.Literal("current", "caused_by", "payload"),
    notes: Schema.optional(Schema.String),
  },
) {}
```

`RelationshipPropagationPolicy` can now declare how a release policy maps back to the assertion policy. The first declared hint is on `depends_on.work-order-block-retracted.releases-source`, pointing back to `depends_on.work-order-blocked.blocks-source` with asserted capability `dependency.blocked`.

Next implementation move: the planner must use this hint to produce `ReactorConstraintNaturalAddress` in `EntityReactionRequest.payload.naturalAddress` before dispatch.

## Acceptance for F2

F2 is complete when tests prove:

1. duplicate assertion is idempotent under SQL uniqueness
2. exact natural-address retraction retracts the intended row
3. missing address fails as `ReactorConstraintAddressRequired`
4. wrong source/policy/propagation returns `unknown_constraint`
5. multiple active constraints prevent target resume
6. release request payloads are generated by Reactor planner/policy metadata, not target contracts

## Current risk

The largest risk is assuming that a release event's `propagationId` is always the original blocking propagation id. For derivative events, use `causedByPropagationId` where available. For manually generated release events without causality, the lane should remain candidate or require event-carried target/constraint identity.
