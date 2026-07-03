# RFC: PCT/LNK/MSH Hostile Network and Failure Chaos

Date: 2026-05-25
Status: feature plan
Parent: `#F1125 Feature-plan hostile network and failure chaos`
Research task: `#4097`
Design task: `#4098`

## Intent

Define a chaos/failure feature lane that deliberately attacks the PCT/LNK/MSH
runtime at the seams where production actually bleeds: NATS disconnects,
JetStream leader loss, reconnect buffers, stale leases, CAS races, outbox publish
failures, slow consumers, process restarts, and partial projection frames.

This is not “randomly kill things and vibe-check the logs.” We are civilized.
Barely.

## Research evidence

### Current repo seams

- `packages/msh/src/nats/connection.ts`
  - Uses `nats.ws.connect` with `reconnect`, `maxReconnectAttempts`, and
    `reconnectTimeWait` mapped from `MshConfig`.
  - Connection release drains then closes (`releaseNatsConnection`).
  - Gap: it does not currently expose or record `NatsConnection.status()` events.
- `packages/msh/node_modules/nats.ws/lib/nats-base-client/core.d.ts`
  - `NatsConnection.status()` reports `disconnect`, `reconnect`, `update`,
    `ldm`, `error`, plus debug events like `reconnecting` and `staleConnection`.
  - Gap: MSH can observe these but does not yet surface them through diagnostics
    or telemetry.
- `packages/msh/test/support/mock-nats.ts`
  - Provides a useful in-process NATS/JetStream/KV mock.
  - Existing fault controls are thin: JetStream manager unavailable, revision
    conflict emulation, closed iterators. There is no general fault injection
    DSL for disconnect, timeout, slow consumer, publish ack loss, or delayed KV.
- `packages/lnk/src/services/wire/nats-bridge/CasAppend.ts`
  - CAS append is bounded and scheduler-backed: retries `MetadataCasConflictError`
    and `PublishExpectationConflictError` with `Schedule.spaced`, default
    8 attempts and 5ms delay.
  - Non-retryable domain failures remain explicit: stale epoch, sequence gap,
    stream closed, config mismatch, invalid payload.
- `packages/lnk/src/services/wire/nats-bridge/MshBridgePortLive.ts`
  - Reads long-poll metadata locally every 50ms until LNK timeout; NATS pull
    expiry floor is 1s.
  - Gap: no explicit network retry envelope around source reads/fetches; errors
    are mapped to `FetchError`.
- `packages/lnk/CONFORMANCE.md`
  - Documents deferred long-poll edge cases: cancellation, concurrent timeouts,
    abort handling.
  - Existing conformance covers producer fencing, close semantics, stream closed,
    and long-poll timeout behavior.
- `packages/pct/src/federation/Default.ts`
  - Federation poll loop uses `Schedule.spaced` and scoped daemon fiber.
  - Per-peer failures increment `errorCount` / `lastError` and are swallowed by
    the poll loop; it keeps retrying.
  - Gap: no jitter/backoff/circuit breaker; no chaos drill for peer restart.
- `packages/pct/test/eventlog-remote-live.test.ts`
  - Starts two real `pact serve` processes and cleans them with SIGTERM/SIGKILL.
  - Good process harness anchor, but it does not restart nodes mid-run.
- `packages/pct/src/frames/ProjectionScheduler.ts`
  - Scheduler is an Effect fiber supervisor with `Scope`, `Semaphore`,
    `Schedule`, and durable lease seam.
  - `runTick` catches failures and marks worker snapshots failed; tail mode keeps
    scheduling.
  - Stop interrupts worker fibers.
  - Gap: durable lease heartbeat/stale recovery/fence propagation are explicit
    follow-ups, not implemented in the scheduler seam.
- `packages/pct/src/frames/ProjectionDurableRuntime.ts`
  - Defines durable lanes (`hot`, `replay`, `backfill`, `timeout`, `outbox`),
    leases/fences, checkpoints, outbox states, and memory runtime.
  - Memory runtime includes injected `failIngestBeforeCommit` and
    `failSweepBeforeCommit` hooks for rollback testing.
  - Gap: no Timescale-backed chaos/fault injection yet; memory seam only.
- `packages/pct/src/frames/ProjectionOutboxPublisher.ts`
  - Publish failures mark outbox records failed, schedule retry, and poison after
    threshold.
  - Gap: retry policy is constant delay; no jitter/exponential policy; no separate
    outbox lease in the publisher lane yet.
- `packages/pct/src/frames/ProjectionLnkAdapters.ts`
  - Source reader uses LNK `Wire.get(limit: 1)` and requires durable `nextOffset`.
  - Frame publisher maps LNK append failures to projection outbox failures.
  - Gap: the current reader starts from `-1`; checkpoint resume semantics are a
    separate hardening seam.
- `packages/lnk/test/support/live-nats.ts`
  - Preferred local live substrate; it can start and stop NATS, accepts extra
    server config, and exposes monitor URL.
  - Gap: no restart/bounce API, no packet loss/latency simulation, no slow
    consumer harness.

### External / DeepWiki findings

- NATS clients automatically reconnect by default, re-establish subscriptions,
  and support reconnect wait, max attempts, reconnect buffer, and reconnect event
  callbacks. Source: https://docs.nats.io/using-nats/developer/connecting/reconnect
- `nats.ws` exposes status events via `NatsConnection.status()`; MSH can consume
  this directly.
- JetStream publish returns an ack that confirms persistence. Publish options can
  include `msgID` and expectations such as stream name or last sequence; failed
  expectations reject the publish. Source:
  https://docs.nats.io/using-nats/developer/develop_jetstream/publish
- JetStream deduplicates by `Nats-Msg-Id` within a duplicate window; exact-once
  publish/consume depends on message deduplication plus acknowledgement discipline.
  Source: https://docs.nats.io/using-nats/developer/develop_jetstream/model_deep_dive
- JetStream consumers are at-least-once; unacked messages can redeliver, and
  pending/redelivery counts are visible in consumer state. Source:
  https://docs.nats.io/using-nats/developer/develop_jetstream/model_deep_dive
- NATS slow-consumer behavior protects the system: client-side slow consumers may
  drop messages and server-side slow consumers may be disconnected. The `varz`
  monitor endpoint exposes `slow_consumers`. Source:
  https://docs.nats.io/running-a-nats-service/nats_admin/slow_consumers
- JetStream clustering uses RAFT groups for the meta group, each stream, and each
  consumer. If a stream has no leader it will not accept messages. Recommended HA
  cluster sizes are 3 or 5 nodes. Source:
  https://docs.nats.io/running-a-nats-service/configuration/clustering/jetstream_clustering
- DeepWiki on `nats-io/nats-server` highlighted server restart, full cluster
  restart, leader failure, network partition, disk loss/recovery, stream/consumer
  recovery, and `/healthz` checks as actionable chaos scenarios.
- NATS monitoring endpoints (`/healthz`, `/varz`, `/connz`, `/jsz`, `/routez`)
  are the right substrate for failure artifacts. Source:
  https://docs.nats.io/running-a-nats-service/nats_admin/monitoring

## Boundary decisions

1. **Chaos hooks are substrate-specific; invariants are stack-specific.**
   A NATS pod restart is a substrate fault. “No duplicated LNK offsets after
   drain” is a stack invariant. Keep those concerns separate.

2. **Start deterministic, then go hostile.**
   Local fake fault injection should precede Kubernetes chaos. If we cannot prove
   a delayed publish ack in a mock, we have no business debugging a partitioned
   cluster at midnight.

3. **NATS reconnect is not a correctness proof.**
   The client reconnects; the application must still prove idempotent append,
   checkpoint, outbox, and projection behavior across the gap.

4. **Crash windows must be named.**
   Every chaos case should identify whether it lands before publish, after
   publish before metadata commit, after metadata commit before checkpoint, after
   frame state commit before outbox publish, etc.

5. **Chaos belongs behind the soak runner as hooks.**
   The soak runner from `RFC-LONG-RUNNING-MULTI-NODE-SOAK.md` supplies workload,
   metrics, and integrity gates. This feature supplies fault injectors and
   failure assertions.

## Current failure-handling matrix

| Surface | Existing behavior | Gap |
| --- | --- | --- |
| MSH connection | reconnect options, scoped drain/close | no status-event telemetry; no forced reconnect helper; no reconnect-buffer checks |
| MSH mock | mock JetStream/KV/core basics, conflicts | no fault DSL for disconnect/timeouts/delays/lost ack/slow consumer |
| MSH diagnostics | core flush, JSM, stream info, KV, auth metadata | not chaos-aware; no before/during/after snapshots |
| LNK append | bounded retry on CAS/publish expectation conflicts | no injected post-publish/pre-metadata crash test in live bridge |
| LNK read | long-poll timeout and close semantics | no network-interruption/consumer redelivery fault proof |
| LNK producer fencing | conformance covers stale epoch and seq | no restart/unfence chaos harness for real bridge |
| PCT federation | poll loop swallows errors and keeps retrying | no jitter/backoff/circuit breaker; no restart/resume drill |
| EventLogRemote | challenge auth, live two-process convergence | no mid-replication peer restart/drain/duplicate replay drill |
| Projection scheduler | fiber supervisor, local admission, durable lease seam | no heartbeat/stale lease takeover; no forced worker crash test |
| Projection durable runtime | memory rollback injection hooks | no Timescale fault injection or transaction boundary proof |
| Projection outbox | retry/poison on publish failure | no exponential/jitter policy; no publisher crash/resume proof |
| Soak substrate | local NATS start/stop | no bounce/restart/cluster/partition adapter yet |

## Chaos scenario catalog

### Tier 0 — Deterministic in-process faults

Use fake ports/mocks. Fast, repeatable, CI-safe.

- MSH mock disconnect before request.
- MSH mock timeout on `$JS.API` request.
- JetStream publish returns ack then metadata commit fails.
- JetStream publish expectation conflict loops until max attempts.
- KV CAS update conflict storm.
- Consumer fetch returns delayed/empty/duplicate messages.
- Projection ingest failure before commit.
- Projection timeout sweep failure before commit.
- Outbox publisher fails N times then succeeds.
- EventLogRemote peer client returns incomplete delta repeatedly.

### Tier 1 — Local live NATS process faults

Use `startLiveNats` plus a new restart/bounce controller.

- Kill NATS during LNK append steady load.
- Kill NATS after JetStream ack but before caller metadata update completes.
- Restart NATS while `NatsSchemaResolver` is issuing `schema.get` requests.
- Restart NATS while projection outbox publisher drains.
- Force client reconnect via `NatsConnection.reconnect()` and assert status events.
- Start with invalid auth then restore valid auth and confirm fail-closed behavior.

### Tier 2 — Multi-process PCT faults

Use `pact serve` process harness.

- Kill node A after publish but before node B converges.
- Kill node B mid EventLogRemote changes stream; restart and verify convergence.
- Restart schema host while LNK typed clients retry schema resolution.
- Start two projection workers for same projection and verify lease/fence behavior.
- Kill one projection worker mid-frame and verify takeover after stale lease policy
  once implemented.

### Tier 3 — Kubernetes/NATS cluster faults

Use the soak Kubernetes overlay and official NATS Helm chart.

- Delete one NATS pod in 3-node JetStream cluster.
- Delete current meta/stream/consumer leader if discoverable from `/jsz`.
- Roll restart all NATS pods.
- Delete one PCT control-plane pod.
- Delete one LNK writer pod.
- Delete one projection worker pod.
- Pause outbox publisher deployment.
- Introduce slow reader/consumer pressure.
- Later: network partition/delay via Chaos Mesh/Litmus or equivalent.

### Tier 4 — Disaster / data loss drills

Manual/controlled only.

- Remove one JetStream PVC/store directory and verify replica catch-up.
- Restore from stream snapshot.
- Full cluster restart with persistent store.
- Quorum-loss drill with explicit expected downtime window.

## Invariants per fault family

### NATS reconnect/disconnect

- MSH records `disconnect`/`reconnect`/`error` status events.
- No secret material appears in status artifacts.
- Request/reply clients either complete or fail with typed timeout/fetch errors.
- After recovery, schema.get/capabilities.get succeeds without process restart.

### LNK append and producer idempotency

- Duplicate publish with same message id does not duplicate durable messages.
- CAS conflict retry count remains bounded.
- If publish succeeds but metadata commit fails, retry converges to correct tail or
  reports conflict; it must not silently append extra payloads.
- Stale producer epoch remains a hard failure, not a retry.

### LNK read / consumer behavior

- Long-poll timeout returns empty/up-to-date semantics, not a spurious error.
- Restart during read does not regress durable offset.
- Consumer redelivery does not produce duplicate logical source offsets after
  checkpoint/drain.

### PCT federation / EventLogRemote

- Temporary peer failure increments error state and later clears on success.
- Restarted peers converge to expected revision.
- Replayed remote entries remain idempotent.
- Auth/session failures are distinguished from transport failures.

### Projection workers

- RunOnce failure produces failed snapshot and ledger failure.
- Tail worker recovers on subsequent ticks unless the fault is persistent.
- Durable lease conflict prevents dual writers.
- Stale lease takeover is not claimed until implemented and tested.
- Source checkpoint commits never move backward.

### Outbox

- Publish failure marks failed with retry time.
- Repeated failure poisons after configured threshold.
- Restarted publisher drains pending/failed records that are available.
- Idempotency key / producer sequence prevents duplicate frame stream emissions.

## Implementation slices

### Slice A — Fault vocabulary and scenario schemas

Deliverables:

- Effect Schema contracts for:
  - `ChaosScenario`
  - `FaultInjectionEvent`
  - `FaultTarget`
  - `ChaosRunPhase`
  - `ChaosInvariant`
  - `ChaosArtifact`
- A stable JSONL event format that can be consumed by the soak artifact writer.

### Slice B — MSH connection status telemetry

Deliverables:

- Scoped status-event collector over `NatsConnection.status()`.
- Events for disconnect, reconnect, update, lame-duck, error, stale connection.
- Diagnostics integration and redacted artifacts.
- Tests with fake status iterator.

### Slice C — Deterministic mock fault DSL

Deliverables:

- Extend `packages/msh/test/support/mock-nats.ts` or add a new reusable mock
  substrate with scripted faults:
  - fail next core request;
  - fail/delay next JetStream publish;
  - return duplicate publish ack;
  - fail/delay KV get/update;
  - fail consumer fetch/next;
  - close subscriptions/iterators.
- Keep it test-support only unless a production simulation package is justified.

### Slice D — LNK bridge crash-window tests

Deliverables:

- Fake publisher/store tests for post-publish/pre-metadata commit windows.
- Conflict-storm tests proving retry budget and error mapping.
- Producer restart/unfence tests against the concrete MSH bridge port.
- Read interruption/timeout tests for live semantics.

### Slice E — PCT federation and EventLogRemote restart drills

Deliverables:

- Reusable `pact serve` process controller extracted from live tests.
- Node restart mid-replication drill.
- Peer unavailable/back-online federation drill.
- Clear artifacts for revisions, error counts, and convergence duration.

### Slice F — Projection worker failure drills

Deliverables:

- Worker runner fault injection for runOnce/tail.
- Lease conflict and lost-lease tests.
- Explicit stale-lease takeover design gate: either implement heartbeat/reclaim or
  assert that takeover is not supported yet.
- Checkpoint monotonicity tests under repeated failure.

### Slice G — Outbox chaos and retry policy

Deliverables:

- Publisher failure sequences: fail N then succeed, fail through poison,
  duplicate receipt replay.
- Exponential/jitter retry policy decision.
- Optional outbox lease seam for multi-publisher drains.

### Slice H — Local live NATS bounce adapter

Deliverables:

- Extend preferred LNK live NATS harness with:
  - `restart()` / `bounce()`;
  - `kill(signal)`;
  - preserved store directory option;
  - monitor snapshots before/after.
- Use it in short live chaos tests.

### Slice I — Kubernetes chaos hook overlay

Deliverables:

- Hook API compatible with the soak runner.
- Kubernetes pod-delete and rollout-restart hooks.
- Slow-consumer deployment/workload option.
- Document network partition as future/manual unless the project chooses a chaos
  controller dependency.

## Proposed follow-on implementation feature

Create under `#F1121`:

- Feature: `PCT/LNK/MSH Hostile Network and Failure Chaos Harness`
  - A: Fault vocabulary and scenario schemas
  - B: MSH connection status telemetry
  - C: Deterministic mock fault DSL
  - D: LNK bridge crash-window tests
  - E: PCT federation/EventLogRemote restart drills
  - F: Projection worker failure drills
  - G: Outbox chaos and retry policy
  - H: Local live NATS bounce adapter
  - I: Kubernetes chaos hook overlay

## Recommendation

Build this after the soak runner contract lands, but start Slice B/C early if the
team is debugging live NATS behavior now. The highest leverage first cut is:

1. MSH status-event telemetry;
2. deterministic mock fault DSL;
3. LNK CAS crash-window tests;
4. local NATS bounce adapter.

Kubernetes chaos is valuable, but only after the local harness can prove the
same invariants deterministically. Otherwise we will be debugging a distributed
system with a fog machine and calling it science.
