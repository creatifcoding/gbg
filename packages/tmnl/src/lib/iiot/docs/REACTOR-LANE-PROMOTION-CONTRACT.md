# Reactor Lane Promotion Contract

Status: v2 promotion control plane

## Purpose

A Reactor lane is not live because a policy exists in the relationship descriptor. A lane becomes live only when the complete event → graph → SQL → target-owned mutation chain is proven.

This contract is the gate between:

- **declared-only** — schemas/policies/docs exist, but runtime activation is forbidden.
- **opt-in-live** — a dedicated layer or feature flag enables the lane for focused tests/controlled runtimes.
- **baseline-live** — included in the default `ReactorGenericLive` behavior.
- **parked** — intentionally non-reactive until missing domain facts or target contracts exist.

Events remain the source of truth. Graph state remains projection. SQL remains distributed authority. Reactor remains structural consistency pressure. Targets own eligibility, transitions, idempotency, audit, and emitted events.

## Promotion checklist

A candidate lane may move to opt-in-live only when all checklist items are satisfied.

| Gate | Required evidence | Owner |
| --- | --- | --- |
| Durable event source | Event exists in `IIoTEventLogSchema`; payload carries the facts needed to identify the observed subject and signal. | Event schema |
| Observation decode | `EventObservationSpec` decodes payload to `ReactorObservation` with typed subject, signal, causality, and payload. | Reactor observation |
| Registry policy | `RelationshipPropagationPolicy` is descriptor-registered with edge type, observed endpoint, accepted signal, request endpoint, capability, effect, idempotency strategy, and version. | Relationship registry |
| Graph expansion | `GraphClient.expandPropagationTargets` or a lane-specific read path proves source/target direction and active-edge filtering. | Graph projection |
| SQL source claim | The source EventJournal entry is fenced by `ReactorSourceClaimRepo` before dispatch. | Reactor source-entry authority |
| Constraint identity | Blocking/holding requests assert a SQL natural key; release requests carry an exact `constraintId` or natural address. | Reactor constraint authority |
| Target contract | The target entity declares the requested capability and owns classify/dispatch semantics. | Target entity |
| Target transition audit | Target mutation, if any, goes through the entity/state machine and writes causality/audit metadata. | Target entity |
| Idempotency proof | Duplicate event replay and duplicate dispatch are harmless under SQL uniqueness and target-owned idempotency. | Reactor + target |
| Atlas readiness | Atlas marks activation group and live/declaration status honestly. | Reactor atlas |
| Documentation | Routing contract states direction, subject, guardrails, and parking reasons. | Domain docs |

## Runtime states

### declared-only

Descriptor and observation contracts exist, but the lane is not passed to the live registry layer.

Allowed:

- policy declaration tests
- observation decode tests
- atlas readiness rows
- documentation

Forbidden:

- adding the policy bundle to `ReactorGenericLive`
- target mutation from projection handlers
- ad hoc target code synthesizing constraint ids

### opt-in-live

A dedicated layer/feature flag provides the lane bundle to the registry for focused runs.

Required shape:

```ts
export const Reactor<Domain>RegistryLive = Layer.effect(
  ReactorRegistry,
  Effect.gen(function* () {
    const contract = yield* makeWorkOrderReactionContract
    return ReactorRegistry.of(makeReactorRegistry({
      observations: <laneObservationSpecs>,
      propagationPolicies: <lanePolicies>,
      entities: [contract],
    }))
  }),
)
```

The opt-in layer must not replace the baseline layer silently. Tests should compose the exact layer they intend to prove.

Environment flags reserved for controlled activation:

| Flag | Lane |
| --- | --- |
| `REACTOR_LANE_DEPENDS_ON_ENABLED` | WorkOrder `depends_on` |
| `REACTOR_LANE_ALARM_SAFETY_ENABLED` | Alarm safety-hold |
| `REACTOR_LANE_STRUCTURAL_DECOMMISSION_ENABLED` | Structural decommission cascade |
| `REACTOR_LANE_EXTERNAL_DEVICE_AVAILABILITY_ENABLED` | External/device availability |

### baseline-live

The lane is included in default `ReactorGenericLive`. This requires all opt-in proofs plus operational confidence: replay behavior, checkpoint drift handling, source-claim contention, and failure recovery.

### parked

Parked lanes are not failures. They are explicit statements that the system refuses to guess.

Typical parking reasons:

- no durable available/release event exists
- graph expansion requires more than one relationship hop
- projection ordering can erase the edge before Reactor reads it
- target entity does not yet own the requested capability
- release cannot address the exact SQL constraint

## Current activation state

Baseline-live today:

| Event tags | Signal | Edges | Target | Capability |
| --- | --- | --- | --- | --- |
| `EquipmentStateChanged`, `MaintenanceModeEntered`, `FaultDetected` | `equipment.availability = unavailable` | `targets`, `requires` | `work_order` | `dependency.blocked` |

Guarded opt-in-live today:

| Lane | Layer | Flag |
| --- | --- | --- |
| WorkOrder `depends_on` | `ReactorDependsOnLive` | `REACTOR_LANE_DEPENDS_ON_ENABLED` |
| Alarm safety-hold | `ReactorAlarmSafetyLive` | `REACTOR_LANE_ALARM_SAFETY_ENABLED` |
| Structural decommission cascade | `ReactorStructuralDecommissionLive` | `REACTOR_LANE_STRUCTURAL_DECOMMISSION_ENABLED` |
| External/device availability | `ReactorExternalDeviceAvailabilityLive` | `REACTOR_LANE_EXTERNAL_DEVICE_AVAILABILITY_ENABLED` |

Everything else remains declared-only, candidate, or parked until this contract is satisfied.

## v2 promotion order

Completed guarded opt-in promotions:

1. **WorkOrder `depends_on`** — WorkOrder target ownership and dependency release vertical slice proven.
2. **Alarm safety-hold** — distinct `safety.hold`/`safety.release` semantics proven with alarm-addressed constraints.
3. **Structural decommission cascade** — direct structural lifecycle pressure and WorkOrder blocking proven.
4. **External/device availability** — projection-ordering/as-of expansion proven for unlink/unavailable routing.
5. **Worker/replay hardening** — source-claim phases, checkpoint repair, fingerprint fences, and zombie recovery coverage added.

Next promotion decision: whether any opt-in-live lane earns baseline-live status. That is an operational decision, not a code-default side effect.

## Non-negotiables

- Do not enable descriptor-registered policies by default just because they compile.
- Do not let projection handlers call Reactor target mutations.
- Do not synthesize constraint ids in target contracts.
- Do not treat release as the inverse of block; release is target-owned reconciliation.
- Do not migrate this stack to Effect v4 while the package remains on Effect v3.
