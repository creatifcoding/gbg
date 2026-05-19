# Reactor Generalization RFC: Event Observations, Relationship Propagation Policies, Entity Reactions

Status: **Draft / implementation-ready**
Date: 2026-05-18
Scope: `src/lib/iiot/services/reactor`, `src/lib/iiot/schemas/reactor.ts`, `src/lib/iiot/schemas/relationships/edge-types.ts`, `GraphClient`, target entity contracts

---

## 1. Thesis

The Reactor is a **structural consistency propagation engine**.

It consumes the same durable domain events as the rest of the IIoT system, interprets them through graph topology, and sends requests to affected entities. The affected entities decide whether and how to change their own state.

The Reactor is not:

- a workflow orchestrator;
- a separate event bus;
- a second source of truth;
- the owner of target entity state;
- a pile of hardcoded source/target branches.

The generalized Reactor should be built from three composable contracts:

1. **EventObservationSpec** — how a durable event becomes a graph-routable observation.
2. **RelationshipPropagationPolicy** — how a relationship type propagates specific observation signals across graph edges.
3. **EntityReactionContract** — how a target entity reacts to incoming requests and owns local state changes.

This replaces the current v1 branch:

```txt
EquipmentStateChanged -> hardcoded machine unavailable predicate
  -> hardcoded getWorkOrderIdsTargetingMachine
  -> hardcoded WorkOrder suspend dispatcher
```

with a generic loop:

```txt
Domain Event
  -> Observation(subject + semantic signals + causality)
  -> Relationship propagation policies attached to graph edges
  -> Target entity reaction requests
  -> Target-owned local transitions and emitted events
```

---

## 2. Motivation

The current Reactor vertical slice is correct but too specific. It proves the substrate:

- durable EventJournal source truth;
- graph-backed relationship traversal;
- checkpoint dedupe;
- first-class propagation IDs;
- target-local transition audit;
- causal DAG reconstruction.

But the runtime still knows too much about one scenario:

- `RelationshipReactor.reactToJournalEntry` only handles `EquipmentStateChanged`;
- `unavailableEquipmentStates` lives inside Reactor core;
- `GraphClient.getWorkOrderIdsTargetingMachine` bakes in `work_order -[:targets]-> machine`;
- WorkOrder suspend eligibility and command construction leak into the sidecar.

That will not scale. A generalized Reactor must let event owners, relationship owners, and entity owners declare their own participation while the Reactor core stays mechanical.

---

## 3. Terminology

### 3.1 Domain Event

A domain event is the canonical durable fact emitted by entity-local logic.

Examples:

- `EquipmentStateChanged`
- `WorkOrderSuspended`
- `AlarmTriggered`
- `MachineCreated`

These events remain the primitive. The Reactor consumes them from the same EventJournal/realtime delivery substrate as other projections.

### 3.2 Observation

An **Observation** is the Reactor's in-memory routing projection of a durable domain event.

It is not persisted as a new truth object. It exists so the Reactor can answer:

1. Which graph entity did this event say something about?
2. What semantic signals did that event assert/retract/change?
3. What propagation identity should downstream requests carry?

Conceptual shape:

```ts
const ReactorObservation = Schema.Struct({
  event: EventEnvelope,
  subject: RelationshipEndpoint,
  signals: Schema.NonEmptyArray(ObservationSignal),
  causality: PropagationCausality,
  payload: Schema.Unknown,
})
```

Example source event:

```ts
EquipmentStateChanged({
  machineId: "M-1",
  fromState: "running",
  newState: "faulted",
  propagationId: "prop-abc"
})
```

Observation:

```ts
{
  event: {
    id: "evt-42",
    tag: "EquipmentStateChanged",
    occurredAt: "..."
  },
  subject: { type: "machine", id: "M-1" },
  signals: [
    {
      axis: "equipment.availability",
      kind: "condition_asserted",
      value: "unavailable",
      reason: "faulted"
    }
  ],
  causality: {
    propagationId: "prop-abc"
  },
  payload: EquipmentStateChangedPayload
}
```

The observation does **not** say “suspend WorkOrders.” It only says “machine M-1 asserted equipment unavailable.”

### 3.3 Observation Signal

A signal is the semantic bridge between raw event payloads and relationship policies.

Event tags are usually too raw for topology-level propagation. A relationship should not need to inspect every possible event payload shape. It should match stable semantic signals.

Examples:

```ts
{ axis: "equipment.availability", kind: "condition_asserted", value: "unavailable" }
{ axis: "alarm.lifecycle", kind: "condition_asserted", value: "triggered" }
{ axis: "work_order.lifecycle", kind: "condition_asserted", value: "completed" }
```

Signals are intentionally small. They are not commands.

### 3.4 RelationshipPropagationPolicy

A relationship propagation policy belongs to a relationship/edge type. It declares how signals propagate across topology.

Example: the `targets` relationship connects `work_order -> machine`. If the target endpoint (`machine`) asserts `equipment.availability = unavailable`, the policy may request the source endpoint (`work_order`) to react to a blocked dependency.

Conceptual shape:

```ts
const RelationshipPropagationPolicy = Schema.Struct({
  id: PropagationPolicyId,
  edgeType: RelationshipEdgeType,
  observedEndpoint: RelationshipEdgeEndpoint, // "source" | "target"
  accepts: SignalMatcher,
  requestEndpoint: RelationshipEdgeEndpoint,  // opposite or same endpoint
  request: EntityReactionRequestTemplate,
  effect: PropagationEffect,
  idempotencyStrategy: PropagationIdempotencyStrategy,
  version: Schema.String,
})
```

Example:

```ts
const TargetsMachineUnavailablePolicy = {
  id: "targets.machine-unavailable.blocks-source-work-order",
  edgeType: "targets",
  observedEndpoint: "target",
  accepts: {
    axis: "equipment.availability",
    value: "unavailable"
  },
  requestEndpoint: "source",
  request: {
    capability: "dependency.blocked",
    dependencyKind: "equipment",
    reason: "target_unavailable"
  },
  effect: "blocking",
  idempotencyStrategy: "source_propagation_id",
  version: "1"
}
```

This is intentionally not named `MachineUnavailableSuspendsWorkOrder`. Suspension is a WorkOrder decision, not a relationship decision.

### 3.5 EntityReactionContract

An entity reaction contract belongs to the target entity owner. It declares which requests the entity can receive and how they map to local behavior.

Example:

```ts
WorkOrderReactionContract = {
  entityType: "work_order",
  capabilities: {
    "dependency.blocked": {
      classify: classifyDependencyBlockedEligibility,
      buildCommand: buildSuspendForBlockedDependency,
      dispatch: dispatchWorkOrderSuspend
    }
  }
}
```

The target entity owns:

- state loading;
- eligibility and skip reasons;
- idempotency checks using local transition/audit tables;
- command construction;
- transaction-fused local state/event writes;
- emitted follow-on events.

The Reactor only routes the request and records the outcome.

---

## 4. Responsibility boundaries

| Owner | Declares | Does not own |
| --- | --- | --- |
| Event owner | Observation adapter: event payload -> subject + signals + causality | Relationship traversal or target state transitions |
| Relationship owner | Propagation policies: signal matcher + edge traversal + target request template | Entity-local guards or commands |
| Entity owner | Reaction contract: capability handling, eligibility, local command dispatch | Source event decoding or graph traversal |
| Reactor core | Generic observe -> match -> expand -> request -> checkpoint loop | Domain-specific source/target branches |

Manual semantics are unavoidable. The system cannot infer from TypeScript shape alone that `faulted` should block dependent work. The goal is to make the remaining manual wiring **localized and stable**.

---

## 5. Base propagation algorithm

```txt
1. Consume durable EventJournal entry.
2. Find EventObservationSpec for entry.event.
3. Decode payload and produce ReactorObservation.
4. Derive stable Reactor owner key from observation.subject.
5. Resolve current policy epoch + registry fingerprint.
6. Acquire atomic source-entry claim for (consumer_id, source_entry_id).
   a. If completed, skip.
   b. If busy, defer/skip.
   c. If epoch conflict or registry drift, block and do not dispatch.
   d. If acquired/reacquired, continue.
7. For each ObservationSignal:
   a. Find relationship propagation policies whose signal matcher accepts it.
   b. Query graph relationships connected to observation.subject.
   c. Select edges where observed endpoint matches subject side.
   d. Resolve request endpoint target entities.
8. For each target entity:
   a. Find EntityReactionContract by entity type.
   b. Find requested capability.
   c. Ask contract to classify eligibility.
   d. If eligible, build and dispatch request/command.
   e. If skipped/deferred, record reason.
9. Complete source-entry claim with the final outcome.
10. Persist Reactor checkpoint outcome.
11. Target entities emit their own durable domain events.
12. Reactor may consume those events in later cycles.
```

The source-entry claim is a production prerequisite for singleton ownership. A
checkpoint written after dispatch is not sufficient to prevent duplicate dispatch
races or policy epoch split-brain. See
[`REACTOR-SOURCE-CLAIM-DESIGN.md`](./REACTOR-SOURCE-CLAIM-DESIGN.md).

---

## 6. Proposed Schema contracts

All shared domain contracts must be Effect Schema-backed.

### 6.1 Event envelope and causality

```ts
export class ReactorEventEnvelope extends Schema.TaggedClass<ReactorEventEnvelope>()('ReactorEventEnvelope', {
  entryId: ReactorSourceEntryId,
  tag: Schema.String,
  primaryKey: Schema.String,
  occurredAt: Schema.DateTimeUtc,
}) {}

export class ReactorCausality extends Schema.TaggedClass<ReactorCausality>()('ReactorCausality', {
  propagationId: PropagationId,
  causedByPropagationId: Schema.optional(PropagationId),
}) {}
```

### 6.2 Signals

```ts
export const ObservationSignalKind = Schema.Literal(
  'condition_asserted',
  'condition_retracted',
  'state_changed',
  'entity_created',
  'entity_deleted',
)

export class ObservationSignal extends Schema.TaggedClass<ObservationSignal>()('ObservationSignal', {
  axis: Schema.String,
  kind: ObservationSignalKind,
  value: Schema.String,
  previousValue: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String),
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}
```

### 6.3 Observation

```ts
export class ReactorObservation extends Schema.TaggedClass<ReactorObservation>()('ReactorObservation', {
  event: ReactorEventEnvelope,
  subject: RelationshipEndpoint,
  signals: Schema.NonEmptyArray(ObservationSignal),
  causality: ReactorCausality,
  payload: Schema.Unknown,
}) {}
```

### 6.4 Observation spec

This is a runtime contract, not just serializable data, because it includes a decoder/adapter.

```ts
export interface EventObservationSpec<Payload> {
  readonly id: string
  readonly eventTag: string
  readonly decode: (entry: EventJournal.Entry) => Effect.Effect<Payload, ParseError>
  readonly observe: (input: {
    readonly entry: EventJournal.Entry
    readonly payload: Payload
  }) => Effect.Effect<ReactorObservation, ReactorObservationError>
}
```

### 6.5 Signal matcher

```ts
export class SignalMatcher extends Schema.TaggedClass<SignalMatcher>()('SignalMatcher', {
  axis: Schema.String,
  kind: Schema.optional(ObservationSignalKind),
  value: Schema.optional(Schema.String),
}) {}
```

### 6.6 Propagation policy

```ts
export const RelationshipEdgeEndpoint = Schema.Literal('source', 'target')

export class EntityReactionRequestTemplate extends Schema.TaggedClass<EntityReactionRequestTemplate>()('EntityReactionRequestTemplate', {
  capability: Schema.String,
  reason: Schema.optional(Schema.String),
  payloadDefaults: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}

export class RelationshipPropagationPolicy extends Schema.TaggedClass<RelationshipPropagationPolicy>()('RelationshipPropagationPolicy', {
  id: Schema.String,
  edgeType: RelationshipEdgeType,
  observedEndpoint: RelationshipEdgeEndpoint,
  accepts: SignalMatcher,
  requestEndpoint: RelationshipEdgeEndpoint,
  request: EntityReactionRequestTemplate,
  effect: PropagationEffect,
  idempotencyStrategy: PropagationIdempotencyStrategy,
  version: Schema.String,
}) {}
```

### 6.7 Target request envelope

```ts
export class EntityReactionRequest extends Schema.TaggedClass<EntityReactionRequest>()('EntityReactionRequest', {
  requestId: Schema.String,
  capability: Schema.String,
  source: RelationshipEndpoint,
  target: RelationshipEndpoint,
  signal: ObservationSignal,
  policyId: Schema.String,
  policyVersion: Schema.String,
  causality: ReactorCausality,
  payload: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
}) {}
```

### 6.8 Plan and outcome

```ts
export const ReactorDecisionOutcome = Schema.Literal(
  'eligible',
  'skipped',
  'deferred',
  'failed',
)

export class ReactorDecision extends Schema.TaggedClass<ReactorDecision>()('ReactorDecision', {
  target: RelationshipEndpoint,
  request: EntityReactionRequest,
  outcome: ReactorDecisionOutcome,
  reason: Schema.optional(Schema.String),
}) {}

export class ReactorPlan extends Schema.TaggedClass<ReactorPlan>()('ReactorPlan', {
  observation: ReactorObservation,
  decisions: Schema.Array(ReactorDecision),
}) {}

export class ReactorRun extends Schema.TaggedClass<ReactorRun>()('ReactorRun', {
  plan: ReactorPlan,
  results: Schema.Array(ReactorDecision),
}) {}
```

---

## 7. Service contracts

### 7.1 ReactorRegistry

```ts
export interface ReactorRegistryShape {
  readonly observe: (entry: EventJournal.Entry) => Effect.Effect<Option.Option<ReactorObservation>, ReactorObservationError>
  readonly policiesFor: (signal: ObservationSignal) => readonly RelationshipPropagationPolicy[]
  readonly contractFor: (entityType: RelationshipNodeType) => Option.Option<EntityReactionContract>
}
```

### 7.2 GraphClient extension

```ts
export interface PropagationTargetExpansionInput {
  readonly observation: ReactorObservation
  readonly policy: RelationshipPropagationPolicy
  readonly signal: ObservationSignal
}

export interface PropagationTargetExpansion {
  readonly edgeType: RelationshipEdgeType
  readonly source: RelationshipEndpoint
  readonly target: RelationshipEndpoint
  readonly requestTarget: RelationshipEndpoint
}
```

`GraphClient.expandPropagationTargets(input)` should:

1. validate `policy.edgeType` against `RELATIONSHIP_EDGE_REGISTRY`;
2. find graph edges of that type connected to `observation.subject`;
3. determine whether the subject is the source or target endpoint of each edge;
4. keep only edges where the subject side equals `policy.observedEndpoint`;
5. return the opposite/specified endpoint as `requestTarget`.

### 7.3 EntityReactionContract

```ts
export interface EntityReactionCapability {
  readonly id: string
  readonly classify: (request: EntityReactionRequest) => Effect.Effect<EligibilityResult, unknown>
  readonly dispatch: (request: EntityReactionRequest) => Effect.Effect<unknown, unknown>
}

export interface EntityReactionContract {
  readonly entityType: RelationshipNodeType
  readonly capabilities: ReadonlyMap<string, EntityReactionCapability>
}
```

The contract is the owner-local boundary. It can call entity RPC, machine APIs, repos, or services as appropriate.

---

## 8. Existing v1 behavior expressed in the new model

### 8.1 Observation spec

```ts
const EquipmentStateChangedObservationSpec = {
  id: 'equipment-state-changed-observation',
  eventTag: 'EquipmentStateChanged',
  decode: decodeEquipmentStateChangedPayload,
  observe: ({ entry, payload }) => new ReactorObservation({
    event: envelopeFromEntry(entry),
    subject: new RelationshipEndpoint({ type: 'machine', id: payload.machineId }),
    causality: causalityFromPayloadOrEntry(payload, entry),
    payload,
    signals: [
      new ObservationSignal({
        axis: 'equipment.availability',
        kind: 'condition_asserted',
        value: isUnavailable(payload.newState) ? 'unavailable' : 'available',
        previousValue: payload.previousState,
        reason: payload.newState,
      }),
    ],
  }),
}
```

### 8.2 Relationship policy on `targets`

```ts
const TargetsMachineUnavailablePolicy = new RelationshipPropagationPolicy({
  id: 'targets.machine-unavailable.blocks-source',
  edgeType: 'targets',
  observedEndpoint: 'target',
  accepts: new SignalMatcher({
    axis: 'equipment.availability',
    kind: 'condition_asserted',
    value: 'unavailable',
  }),
  requestEndpoint: 'source',
  request: new EntityReactionRequestTemplate({
    capability: 'dependency.blocked',
    reason: 'target_unavailable',
    payloadDefaults: {
      dependencyKind: 'equipment',
    },
  }),
  effect: 'blocking',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
})
```

### 8.3 WorkOrder reaction contract

```ts
const WorkOrderReactionContract = {
  entityType: 'work_order',
  capabilities: new Map([
    ['dependency.blocked', {
      id: 'dependency.blocked',
      classify: classifyWorkOrderDependencyBlocked,
      dispatch: dispatchWorkOrderSuspendForBlockedDependency,
    }],
  ]),
}
```

WorkOrder maps `dependency.blocked` to suspension only if local state permits it. Terminal or already-suspended WorkOrders return typed skip reasons.

---

## 9. Implementation phases

### Phase 1 — RFC and feature plan

- Create this RFC.
- Create a feature plan for implementation and tests.
- Align terminology in the visual implementation artifact.

### Phase 2 — Schema contracts

- Extend `src/lib/iiot/schemas/reactor.ts` with base observation, signal, request, plan, and run schemas.
- Rename or supersede `PropagationDescriptor` vocabulary with `RelationshipPropagationPolicy`.
- Keep compatibility exports if needed while migrating tests.

### Phase 3 — Registry and planner

- Add `ReactorRegistry` for observation specs, policies, and entity reaction contracts.
- Add `ReactorPlanner` that turns a journal entry or observation into a plan.
- Unit test unsupported events, malformed supported events, no policy, missing contract, and eligible target request creation.

### Phase 4 — Graph expansion

- Add generic `GraphClient.expandPropagationTargets`.
- Keep `getWorkOrderIdsTargetingMachine` temporarily for compatibility.
- Prove the generic graph expansion can express `work_order -[:targets]-> machine` from the machine endpoint back to WorkOrders.

### Phase 5 — WorkOrder contract and migration

- Add WorkOrder reaction contract for `dependency.blocked`.
- Route existing Machine unavailable -> WorkOrder suspend behavior through observation + policy + contract.
- Keep the public `RelationshipReactor` surface as a shim while implementation migrates.

### Phase 6 — Generality proof

- Add a second observation/policy/contract shape.
- Prefer an alarm or structural event path because durable event truth now exists there.
- Plan-only is acceptable if no safe target command semantics exist yet.

### Phase 7 — Source-entry ownership claim

- Add `iiot.reactor_source_claims` as the pre-dispatch ownership table.
- Add `ReactorSourceClaimRepo` with acquire, heartbeat, complete, and block operations.
- Add registry `policyEpoch` and deterministic `registryFingerprint`.
- Update Reactor execution so source-entry claim acquisition happens before graph planning or target dispatch.
- Test duplicate delivery races, epoch conflicts, stale claim tokens, and crash-after-dispatch retry behavior.

### Phase 8 — Replay and hardening

- Add replay/dry-run surface over durable EventJournal rows.
- Add bounded concurrency controls, retry/dead-letter policy, and span metrics keyed by `propagationId`.

---

## 10. Acceptance criteria

- Reactor core has no hardcoded `EquipmentStateChanged` branch.
- Reactor core has no hardcoded WorkOrder status eligibility.
- Reactor core has no WorkOrder-specific graph query.
- Machine unavailable -> WorkOrder suspend still works.
- Target WorkOrder skip reasons remain typed and replay-stable.
- Reactor checkpoint dedupe still skips duplicate source journal entries.
- Reactor source-entry claim prevents duplicate pre-checkpoint dispatch races.
- Reactor source-entry claim blocks policy epoch split-brain instead of dispatching under two epochs.
- At least two propagation policies can be planned by the same core loop.
- New public contracts are Schema-backed.

---

## 11. Open questions

1. Should observation signals use string axes only, or should common axes become Schema literals as they stabilize?
2. Should relationship propagation policies live entirely in `edge-types.ts`, or should large policies move to focused modules per relationship type?
3. Should `EntityReactionRequest.payload` remain a generic record, or should each capability provide a Schema for its payload?
4. Should failed target dispatch checkpoint as `failed` immediately, or remain uncheckpointed for retry until a dead-letter policy exists?

---

## 12. Non-goals

- No attempt to infer propagation semantics from arbitrary event names.
- No global workflow DAG engine.
- No distributed transaction across source and target entities.
- No user-facing `RelationshipEntity`.
- No replacement of target entity machines with Reactor-owned transition logic.

---

## 13. Summary

The generalized Reactor becomes meaningful when it stops declaring whole scenarios and starts composing smaller responsibilities:

```txt
Event owner:        This event observes these signals on this graph subject.
Relationship owner: This edge propagates these signals to that endpoint as this request.
Entity owner:       This entity reacts to that request under these local rules.
Reactor core:       Observe, match, expand, request, checkpoint.
```

That is the path from a correct vertical slice to a reusable IIoT consistency layer.
