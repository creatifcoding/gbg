# Reactor Stage Boundary Ledger

Status: working decomposition ledger
Prereqs: [REACTOR-STAGE-BOUNDARIES.md](./REACTOR-STAGE-BOUNDARIES.md), [REACTOR-ADMISSION-CONTROL-SUBSTRATE.md](./REACTOR-ADMISSION-CONTROL-SUBSTRATE.md)

## Lodestone

> A **stage boundary** in our ontology is a typed, observable handoff between Reactor semantic artifacts where we may attach admission control, idempotency, durability, retry/parking, and ownership rules without changing the meaning of the domain event.

This ledger applies that definition to the Reactor hot path.

## Artifact chain

```text
EventJournal entry
  -> SourceClaim
  -> ReactorObservation
  -> PropagationPlan
  -> ExpandedTargetPath
  -> CoalescedReactionDecision
  -> EntityReactionRequest
  -> ConstraintAssertion/RetractionResult
  -> TargetTransitionResult
  -> EmittedDomainEvents + TransitionAudit
  -> ReactorCheckpoint / claim completion
```

Not every event walks every stage. A non-reactive event may stop after observation classification. A constraint-backed WorkOrder dependency release walks the full chain.

## Stage ledger

| # | Stage | Input artifact | Output artifact | Semantic jurisdiction | Forbidden responsibilities |
| --- | --- | --- | --- | --- | --- |
| 0 | Journal Intake | durable domain event row | candidate source entry | expose primitive event fact | interpreting target eligibility |
| 1 | Source Claim | candidate source entry | source claim decision | decide whether this consumer may process this event | planning, graph traversal, target mutation |
| 2 | Observation | claimed event + decoded payload | `ReactorObservation` | translate event into Reactor routing signals | asserting constraints, traversing graph, mutating targets |
| 3 | Planning | observation + registry | propagation candidates | match signals to policies and capabilities | selecting concrete target instances outside graph proof |
| 4 | Graph Expansion | candidate + subject node | expanded target paths | prove relationship path from source to target | asserting target state or applying policy side effects |
| 5 | Decision Coalescing | expanded target paths | coalesced reaction decisions | collapse duplicate local work while preserving provenance | declaring durable idempotency or dropping causality |
| 6 | Dispatch Preparation | coalesced decision | `EntityReactionRequest` | shape a target-owned request from graph/policy evidence | target transition legality, SQL constraint truth |
| 7 | Constraint Authority | reaction request | constraint assertion/retraction result | assert/retract source-derived target restrictions | resuming WorkOrders, deciding target state legality |
| 8 | Target Reconciliation | active constraints + target state | transition/no-op result | target owns eligibility, idempotency, transition, audit payload | synthesizing constraint IDs, bypassing active constraint set |
| 9 | Emission / Audit | transition result | domain events + transition audit | persist causality and user-visible state history | changing original source fact meaning |
| 10 | Completion / Checkpoint | dispatch outcomes | claim finalization + checkpoint | record Reactor processing outcome | altering target state after completion |

## Boundary matrix

| Boundary | Handoff | Mode | Type contract | Admission control | Durable authority | Observability |
| --- | --- | --- | --- | --- | --- | --- |
| B0 | EventJournal -> Source Claim | durable + operational | source entry identity | source-entry keyed serialization | `iiot.reactor_source_claims` | claim attempt span, owner key, token |
| B1 | Source Claim -> Observation | logical | decoded event payload + claim context | none initially | claim row freezes epoch/fingerprint | observation span |
| B2 | Observation -> Planning | logical | `ReactorObservation` | none initially | registry epoch/fingerprint | policy-match span |
| B3 | Planning -> Graph Expansion | logical + operational later | candidate path spec | bounded fan-out if needed | relationship graph | graph expansion span |
| B4 | Graph Expansion -> Decision Coalescing | operational | expanded path key + provenance | run-local coalescer | downstream SQL idempotency remains judge | coalesced count, provenance count |
| B5 | Coalescing -> Dispatch Prep | logical | coalesced reaction decision | bounded dispatch concurrency | entity contract registry | dispatch-prep span |
| B6 | Dispatch Prep -> Constraint Authority | operational + durable | `EntityReactionRequest` / constraint address | SQL budget + constraint singleflight | `iiot.reactor_constraints` | constraint assert/retract span |
| B7 | Constraint Authority -> Target Reconciliation | operational | active constraint set + result | target-keyed gate | active constraint query + target state | target wait, active hold count |
| B8 | Target Reconciliation -> Emission/Audit | durable | transition result | target-local serialization already held | EventJournal + transition audit | caused-by propagation ID |
| B9 | Dispatch Outcomes -> Completion | durable | outcome summary | source-entry gate cleanup | checkpoint + source claim outcome | completion span, checkpoint lag |

## Current pressure controls by boundary

| Pressure case | Boundary | Control | Why here |
| --- | --- | --- | --- |
| duplicate hot/warm/cold delivery of same event | B0 | source-entry keyed serialization | suppress local claim stampedes while preserving independent SQL ownership verdicts |
| replay wave overloading SQL | B0, B6, B9 | global Reactor SQL budget | cap local pool pressure without changing SQL truth |
| graph fan-out converges on same target/capability | B4 | run-local coalescer | preserve provenance while dispatching one equivalent request |
| repeated assert/retract for same natural constraint | B6 | constraint-address singleflight | avoid hammering natural-key SQL path |
| same WorkOrder gets block/release storm | B7 | target-keyed gate | serialize local reconcile/transition against one target |
| stale local fiber resumes after lease change | B0, B9 | timeout + SQL token/fingerprint checks | local cleanup plus durable fencing |

## Authority split

| Decision | Local admission may do | Durable/target authority must do |
| --- | --- | --- |
| Source event ownership | serialize in-flight claim attempts, limit claim pressure, never share acquired ownership | insert/update source claim with token, epoch, fingerprint, lease |
| Constraint assertion | coalesce equivalent local requests, limit SQL budget | enforce natural-key uniqueness and generated `constraint_id` |
| Constraint retraction | serialize by target, dedupe identical request | transact retraction, active set query, advisory lock/fencing |
| WorkOrder release | allow one local target reconcile at a time | target checks active constraints, state graph, audit, emitted events |
| Replay progress | bound batch concurrency, park low-criticality work | checkpoint and claim outcome rows decide restart truth |

## Stage-specific contracts

### 1. Source Claim

```text
Input artifact: EventJournal source entry
Output artifact: claim decision + claim token
Jurisdiction: distributed source ownership attempt
Authority boundary: iiot.reactor_source_claims
Admission boundary: source-entry keyed serialization + SQL budget
Idempotency key: consumer_id + source_entry_id
Failure behavior: retry only if SQL claim state allows; zombie completion fenced by token
Observability: claim attempt span, owner_key, policy_epoch, registry_fingerprint
```

### 2. Observation

```text
Input artifact: claimed event + decoded payload
Output artifact: ReactorObservation
Jurisdiction: event-to-signal interpretation
Authority boundary: event schema + observation registry
Admission boundary: none initially
Idempotency key: inherited source entry + event tag
Failure behavior: mark claim failed/parked when payload cannot decode or no observation contract exists
Observability: eventTag, subject, emitted signals
```

### 3. Planning

```text
Input artifact: ReactorObservation
Output artifact: propagation candidates
Jurisdiction: policy/capability matching
Authority boundary: registry fingerprint + policy epoch
Admission boundary: none initially; future policy-class budgets possible
Idempotency key: observation id + policy id + capability
Failure behavior: no candidate is valid no-op, not an error
Observability: matched policies, skipped policies, capability id
```

### 4. Graph Expansion

```text
Input artifact: propagation candidate + source subject
Output artifact: expanded target paths
Jurisdiction: relationship proof
Authority boundary: relationship graph and edge-type schemas
Admission boundary: bounded fan-out if graph expansion becomes hot
Idempotency key: source + policy + edge path + target
Failure behavior: no path is valid no-op; graph query failure parks claim
Observability: edge path, target count, expansion latency
```

### 5. Decision Coalescing

```text
Input artifact: expanded target paths
Output artifact: coalesced reaction decisions
Jurisdiction: local equivalence collapse with provenance retention
Authority boundary: none; downstream SQL remains idempotency judge
Admission boundary: run-local coalescer
Idempotency key: target + capability + source + relationshipEdgeType + policyId + propagationId
Failure behavior: coalescer failure should fail fast; never silently drop provenance
Observability: coalesced count, provenance bundle size
```

### 6. Dispatch Preparation

```text
Input artifact: coalesced reaction decision
Output artifact: EntityReactionRequest
Jurisdiction: target contract request shaping
Authority boundary: entity contract registry
Admission boundary: bounded dispatch concurrency
Idempotency key: reaction request id / propagation id
Failure behavior: unknown capability parks claim with contract-missing reason
Observability: targetType, targetId, capability, propagationId
```

### 7. Constraint Authority

```text
Input artifact: EntityReactionRequest carrying explicit constraint address or natural address
Output artifact: assert/retract result and active target holds
Jurisdiction: source-derived restrictions on target transitions
Authority boundary: iiot.reactor_constraints
Admission boundary: SQL budget + constraint singleflight + target lock for retraction path
Idempotency key: SQL natural key or generated constraint_id
Failure behavior: SQL failure parks/retries by policy; no WorkOrder-local ID synthesis
Observability: action, constraint_id, natural address, active hold count
```

### 8. Target Reconciliation

```text
Input artifact: active constraints + target state
Output artifact: transition/no-op result
Jurisdiction: target-owned eligibility and transition legality
Authority boundary: target entity/state machine + transition audit
Admission boundary: target-keyed gate
Idempotency key: target + causedByPropagationId + transition semantics
Failure behavior: terminal/stale/non-suspended states veto or no-op; active holds block release
Observability: target state before/after, veto reason, causedByPropagationId
```

### 9. Emission / Audit

```text
Input artifact: transition result
Output artifact: emitted domain events + transition audit
Jurisdiction: durable causality record
Authority boundary: EventJournal + transition audit tables
Admission boundary: target serialization already applies
Idempotency key: transition id / causedByPropagationId where applicable
Failure behavior: transition and event/audit write must remain transactionally fused where state changes
Observability: emitted event tags, transition audit id, causality links
```

### 10. Completion / Checkpoint

```text
Input artifact: dispatch outcomes
Output artifact: claim finalization + checkpoint
Jurisdiction: Reactor processing lifecycle record
Authority boundary: source claim row + checkpoint table
Admission boundary: source-entry gate cleanup
Idempotency key: consumer_id + source_entry_id
Failure behavior: completion fenced by claim token; checkpoint repair can reconcile completed claim gaps
Observability: outcome, attempts, checkpoint position, lag
```

## Immediate implementation implications

1. `ReactorAdmissionControl` should be inserted at B0, B4, B6, B7, and B9 cleanup.
2. The first implementation should not introduce actual queues unless a boundary needs independent scheduling or parking.
3. `ReactorDispatcher` should gain coalescing before target contract invocation.
4. `ReactorConstraintAuthoritySqlLive` should be wrapped by SQL budget and constraint singleflight.
5. `WorkOrderDependencyReleaseLive` should reconcile under a target-keyed gate.
6. Tests should be written by boundary, not by incidental method shape.

## Open design questions

- Should `Decision Coalescing` live in `ReactorPlanner`, `ReactorDispatcher`, or its own `ReactorDecisionCoalescer`?
- Should SQL budget be global for all Reactor SQL or split by hot/warm/cold lane?
- Should target gates key only by target, or by `(target, capability)` for capabilities proven independent?
- Should parked replay work become a durable queue table, or reuse claim/checkpoint metadata first?
- Which boundaries deserve p90/p99 wait metrics in the first cut?
