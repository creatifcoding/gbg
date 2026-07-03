# Custom Rendering Observability

## Purpose

You cannot manage transform budget without per-stage visibility. This document defines the instrumentation contract for custom delta rendering pipelines on top of harness events.

---

## 1) Existing harness metrics (currently emitted)

From `src/lib/harness/schemas.ts` (`chat:v2/metric`):

- `ackLatencyMs`
- `firstDeltaLagMs`
- `toolRoundTripMs`
- `abortToStopMs`
- `retryCount`

These measure transport/runtime behavior, not renderer cost.

---

## 2) Proposed renderer metrics

To budget delta transforms, add renderer-side metrics (either as local telemetry or extended `chat:v2/metric`):

### Per-event ingest

- `renderTransformDeltaMs`
  - time spent processing one incoming marker/delta in hot path
- `renderTransformDeltaBytes`
  - optional: size of processed payload

### Per-frame flush

- `renderTransformBatchMs`
  - time spent in frame-coalesced flush
- `renderCommitMs`
  - time spent committing state to UI layer
- `renderBatchSize`
  - count of deltas processed in the batch

### Pipeline health

- `renderBacklogDepth`
  - pending delta count or equivalent frame backlog
- `renderDroppedDecorations`
  - count of non-critical transforms skipped in backpressure mode
- `unknownMarkerCount`
  - count of `provider:marker/unknown`

---

## 3) Target SLOs

Recommended starting SLOs:

- `renderTransformDeltaMs`
  - p50 <= 0.15ms
  - p95 <= 0.50ms
  - p99 <= 1.0ms

- `renderTransformBatchMs`
  - p95 <= 2.0ms

- `renderCommitMs`
  - p95 <= 4.0ms

- `renderBacklogDepth`
  - sustained < 2 frame windows

These values should be tuned per surface, but use them as baseline guardrails.

---

## 4) Instrumentation points

### A) Ingest callback

Wrap only the transform section, not subscription overhead:

```ts
const t0 = performance.now()
transformIncomingMarker(marker)
record('renderTransformDeltaMs', performance.now() - t0)
```

### B) Frame flush

```ts
const t0 = performance.now()
const batch = drainPending()
record('renderBatchSize', batch.length)
transformBatch(batch)
record('renderTransformBatchMs', performance.now() - t0)
```

### C) Commit

```ts
const t0 = performance.now()
commitState(next)
record('renderCommitMs', performance.now() - t0)
```

---

## 5) Alerting thresholds

Raise warning when any condition persists for N consecutive windows (e.g., 30 windows):

- `renderTransformDeltaMs p95 > 0.75ms`
- `renderTransformBatchMs p95 > 3ms`
- `renderCommitMs p95 > 6ms`
- `renderBacklogDepth >= 3`
- `unknownMarkerCount > 0` in stable provider lane

Raise critical when:

- backlog continues to grow for > 2s
- frame drops correlate with sustained p99 transform > 2ms

---

## 6) Triage sequence

When budget violations appear:

1. confirm event rate (`R`) and compute expected per-delta budget
2. inspect whether hot path is doing non-O(1) work
3. inspect commit frequency (multiple commits/frame?)
4. disable heavy transforms and retest
5. move expensive logic to terminal/idle stage
6. retest with same synthetic workload

No guesswork. Measure, isolate, move, verify.

---

## 7) Suggested phased rollout

Phase 1:
- instrument local renderer metrics only
- validate budgets in dev/testbed

Phase 2:
- emit selected renderer metrics into shared telemetry lane
- add dashboards and alerts

Phase 3:
- enforce SLO gates in load tests for stream-heavy surfaces

---

## 8) Integration note

If renderer metrics are promoted into harness-level `chat:v2/metric`, update `HarnessMetricName` schema and document backward compatibility expectations for existing consumers.
