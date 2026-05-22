# RFC — ProjectionScheduler as a SEDA Stage Boundary

## Status

Draft / implementation guide for `#F1101 ProjectionScheduler SEDA Stage-Boundary Rework`.

## Lodestone

Per `stage-boundary-decomposition`, the portable SEDA lesson is:

```text
stage boundary = visibility + control point
```

A queue is an implementation detail. The ProjectionScheduler must therefore expose the projection execution boundary as a typed, observable, controllable handoff — not merely as `Schedule.spaced(...)` around `runner.runOnce(...)`.

## 1. Source Fact

```text
Source fact:       Pure LNK source stream messages selected by FrameProjectionSpec.sources.
Durable location:  LNK Durable Streams and/or Timescale source fact tables.
Why it matters:    Frames must be replayable, idempotent, and explainable from original facts.
Must never reinterpret it: ProjectionScheduler local memory, NATS/Msh micro host, admission gates.
```

The scheduler may shape local work. It may not decide durable truth.

## 2. Artifact Chain

```text
LNK source facts
  -> FrameProjectionSpec + ProjectionPlan
  -> ProjectionWorkItem
  -> AdmissionDecision
  -> Running ProjectionTick
  -> ProjectionWorkerRunSummary
  -> ProjectionWorkerSnapshot + scheduling pressure snapshot
  -> Timescale frame table row / optional LNK frame stream event
```

## 3. Stage Ledger

| Stage | Input artifact | Output artifact | Jurisdiction | Forbidden responsibilities |
| --- | --- | --- | --- | --- |
| Projection declaration | `FrameProjectionSpec` | `ProjectionPlan` | PCT contract/compiler | Start workers, apply migrations secretly, consume streams |
| Work intent creation | registry entry + control request | `ProjectionWorkItem` | ProjectionScheduler | Decide source fact truth, write frames directly |
| Admission | `ProjectionWorkItem` | `AdmissionDecision` | AdmissionController | Become durable authority, silently drop work |
| Execution | admitted work + worker config | `ProjectionWorkerRunSummary` | ProjectionWorkerRunner / LNK runtime | Override admission policy, own global projection registry |
| Ledgering | decision + summary/failure | scheduling ledger records | WorkLedger / future Timescale ledger | Reinterpret frame semantics |
| Materialization | completed frames | Timescale row / LNK frame event | writer ports + durable idempotency ledger | Hide failed/parked work from operators |

## 4. Boundary Contract Matrix

| Boundary | Mode | Type contract | Admission control | Durable authority | Observability |
| --- | --- | --- | --- | --- | --- |
| Registry → work intent | logical | `ProjectionWorkItem` | start mode, worker id, lane defaults | ProjectionRegistry | control-plane span, work id |
| Work intent → admitted work | operational / queued-ready | `ProjectionAdmissionDecision` | duplicate singleflight, keyed gates, global budget, lane priority | Work ledger / future Timescale ledger | admitted/parked/rejected counters |
| Admitted work → runner tick | operational | `ProjectionWorkerConfig` | scoped fiber, semaphore permit | LNK source offsets + projection ledger | tick span, worker id, lane |
| Runner summary → snapshot | durable-adjacent | `ProjectionWorkerRunSummary` | none; record outcome | frame/output ledgers | processed/emitted/failed counters |
| Parked work → retry/backfill | queued / durable future | `ProjectionParkingRecord` | retry budget, availableAt, lane demotion | future durable scheduler ledger | parked reason, retryAt |

## 5. Authority vs Admission Split

| Decision | Durable authority | Local/admission mechanism | Safety rule |
| --- | --- | --- | --- |
| projection ownership | registry + operator config | worker id/start mode | local scheduler cannot invent projection ids |
| idempotency | Timescale/LNK output ledger | duplicate singleflight key | local dedupe may only reduce pressure |
| source offset truth | LNK Durable Stream | max messages per tick | local tick size cannot skip source facts |
| target transition legality | frame assembly/output writer | keyed semaphore / target gate | gate serializes; writer decides accepted output |
| retry/parking | scheduler ledger/future Timescale table | retry budget, parked lane | parking must be visible to operators |

## 6. Pressure-Case Catalog

| Pressure case | Symptom | Boundary to protect | Candidate control | Final authority |
| --- | --- | --- | --- | --- |
| duplicate source/tick work | same projection tick races | work intent → admitted work | singleflight / duplicate key | source/output idempotency ledger |
| hot projection target | many workers converge on same frame table/stream | admitted work → runner tick | keyed semaphore / actor mailbox | writer ledger |
| pool pressure | too many projection ticks run | admission | global budget semaphore | scheduler config/operator |
| replay wave | backfill starves live tail | lane selection | hot/replay/backfill lanes, priority | operator schedule + durable ledger |
| stale worker | old worker continues after replacement | lifecycle | scoped fiber interruption, fencing future | worker lease/fence token future |

## 7. Failure and Parking Policy

| Failure | Retry? | Park? | Durable marker | Human-visible explanation |
| --- | --- | --- | --- | --- |
| duplicate in flight | no immediate retry | optional coalesced/visible duplicate | scheduling ledger counter | duplicate work already in flight |
| hot target busy | yes | yes | parking record | target key is saturated |
| global budget exhausted | yes | yes | parking record | worker pool budget exhausted |
| runner failure | policy-dependent | yes after budget | run failure record | runner failed with cause |
| unknown projection | no | no | control-plane error | projection is not registered |

## 8. Observability Map

| Stage/boundary | Span | Metrics | Audit/log |
| --- | --- | --- | --- |
| work intent | `projection.scheduler.enqueue` | enqueued by lane | work id, projection id |
| admission | `projection.scheduler.admit` | admitted/parked/rejected/duplicate | decision reason |
| execution | `projection.scheduler.tick` | in-flight, tick duration | summary counters |
| parking | `projection.scheduler.park` | parked by reason/lane | retryAt / attempt |
| stop/replace | `projection.scheduler.lifecycle` | interrupted fibers | reason / old worker id |

## 9. Implementation Cut

First production-shaped cut:

1. Add schema-backed `ProjectionWorkItem`, lanes, admission decisions, parking records, pressure snapshots.
2. Add memory-backed `ProjectionWorkLedger` and `ProjectionAdmissionController` ports.
3. Refactor `ProjectionScheduler` so tail/start fibers create work items and execute only through admission.
4. Preserve the NATS micro control-plane API.
5. Keep durable Timescale/LNK authority as explicit future ports — do not hide it behind local memory.
