# Reactor Stage Boundaries and Semantic Jurisdictions

Status: ontology record
Companion: [REACTOR-ADMISSION-CONTROL-SUBSTRATE.md](./REACTOR-ADMISSION-CONTROL-SUBSTRATE.md)
Ledger: [REACTOR-STAGE-BOUNDARY-LEDGER.md](./REACTOR-STAGE-BOUNDARY-LEDGER.md)

## Lodestone definition

> A **stage boundary** in our ontology is a typed, observable handoff between Reactor semantic artifacts where we may attach admission control, idempotency, durability, retry/parking, and ownership rules without changing the meaning of the domain event.

This is the central cut. The boundary is not just a code split. It is where meaning, artifact shape, authority, and operational pressure are made explicit.

## Terms inside the Reactor ontology

### Semantic jurisdiction

A jurisdiction is a zone of ownership. It answers:

- Who is allowed to interpret this artifact?
- Who owns the next decision?
- Which authority decides truth here?
- Which operations are forbidden here?

Example: the observation stage may interpret a durable event into Reactor routing language, but it may not mutate WorkOrder state.

### Decomposition

Decomposition means splitting the Reactor by semantic jurisdiction, not by file size.

```text
Durable Event
  -> ReactorObservation
  -> Propagation Candidate
  -> Expanded Target Path
  -> EntityReactionRequest
  -> ReactorConstraint assertion/retraction
  -> Target-owned transition/no-op
  -> Durable event + audit
```

Every arrow is a candidate stage boundary.

### Stage

A stage is a named transformation that consumes one canonical artifact and produces another.

```text
Observation Stage
  input:  EventJournal entry + decoded payload
  output: ReactorObservation
```

A stage should be able to say: "I own this transformation, and not the next one."

### Stage boundary

A boundary is the contract line between stages. It can carry four independent layers:

| Layer | Purpose | Reactor examples |
| --- | --- | --- |
| Type boundary | Schema/TypeScript artifact contract | `ReactorObservation`, `EntityReactionRequest` |
| Admission boundary | Local pressure control | singleflight, target gate, SQL budget |
| Authority boundary | Durable truth/fencing | SQL uniqueness, transactions, advisory locks |
| Observability boundary | Explainability and review | spans, metrics, audit rows, diagrams |

## Finding #4: a boundary is not necessarily a queue

SEDA used explicit queues, but the lesson is broader. A boundary can be logical, operational, durable, or queued.

| Boundary mode | What it means | When to use |
| --- | --- | --- |
| Logical boundary | A pure function or service method with a typed artifact handoff | Always, for semantic clarity |
| Operational boundary | A handoff guarded by admission control | Contended work, hot targets, SQL pressure |
| Durable boundary | A handoff persisted as SQL/event/audit authority | Ownership, idempotency, recovery, replay |
| Queued boundary | A handoff through `Queue`, PubSub, NATS, or a worker lane | Independent scaling, parking, async replay |

Do not add queues everywhere. That is architecture cosplay. Use a queue only when it buys independent scheduling, buffering, parking, or scale isolation.

## Reactor ontology mapping

| Reactor stage | Input artifact | Output artifact | Jurisdiction | Authority |
| --- | --- | --- | --- | --- |
| Source Claim | EventJournal entry | Claimed source work | Decide whether this runner may process the source | `iiot.reactor_source_claims` |
| Observation | Claimed event + decoded payload | `ReactorObservation` | Interpret event into Reactor signals | Event schema + observation registry |
| Planning | `ReactorObservation` | propagation candidates | Match signals to propagation policies | Reactor registry / policy epoch |
| Graph Expansion | candidate + source node | expanded target paths | Traverse relationship graph | relationship graph / edge types |
| Dispatch Preparation | expanded target path | `EntityReactionRequest` | Shape request for target contract | entity contract registry |
| Constraint Authority | reaction request | asserted/retracted constraint result | Assert/retract source-derived restrictions | `iiot.reactor_constraints` |
| Target Reconciliation | active constraints + target state | transition or no-op | Decide whether target can move | target entity/state machine |
| Emission/Audit | transition result | durable event + audit row | Persist causality and state history | EventJournal + transition audit |

## Where ReactorAdmissionControl belongs

Admission control lives on boundaries, not inside domain truth.

```text
Before source claim SQL:
  source-entry singleflight

Before constraint SQL:
  SQL budget + constraint singleflight

Before target reconciliation:
  target-keyed gate

Before dispatch fan-out:
  run-local coalescing
```

It answers: "Should this local fiber enter the next expensive or contended stage right now?"

It does not answer:

- Is the event globally owned?
- Is the constraint active?
- Is the WorkOrder releasable?
- Is the target transition legal?

Those remain SQL-backed or target-owned decisions.

## Stage contract template

Every stage should be documented with this contract:

```text
Stage name:
Input artifact:
Output artifact:
Semantic jurisdiction:
Forbidden responsibilities:
Authority boundary:
Admission boundary:
Idempotency key:
Failure behavior:
Parking/retry policy:
Observability:
Downstream handoff:
```

## Generalized SEDA lesson

SEDA's durable contribution is not "queue everything." It is:

```text
Make the request stream visible at semantic boundaries,
then attach stage-appropriate admission and resource control.
```

In any domain, use this move when a system has:

- event-driven propagation
- duplicate delivery
- fan-out/fan-in convergence
- expensive authority checks
- target-hot keys
- replay/backfill waves
- cross-entity consistency pressure

## Anti-patterns

- Splitting files without naming artifact boundaries.
- Adding queues where a typed function boundary is enough.
- Letting admission control decide durable truth.
- Letting target transitions leak backward into observation/planning.
- Treating replay traffic as equal criticality to hot operational events.
- Hiding idempotency in ad-hoc strings instead of authoritative natural keys.

## Next application to Reactor

1. Create a stage ledger for current Reactor hot path.
2. Mark each boundary as logical, operational, durable, queued, or mixed.
3. Add `ReactorAdmissionControl` only at operational pressure points.
4. Keep source claims and constraints SQL-authoritative.
5. Keep release/resume target-owned.
6. Add diagrams and tests per stage boundary before introducing queues.
