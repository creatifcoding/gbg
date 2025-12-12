# rAF + Effect Streams Architecture

## Problem Statement

`setInterval(fn, 30)` cannot reliably achieve 33 events/sec due to:
- Browser timer minimum resolution (~4ms)
- Event loop scheduling jitter
- GC pauses and other main thread contention

**Observed**: 24-28 events/sec
**Target**: 33+ events/sec (configurable up to 100+)

---

## Current Architecture (setInterval)

```
┌─────────────────────────────────────────────────────────────┐
│                     setInterval(30ms)                        │
│                            │                                 │
│                            ▼                                 │
│                    recordEmission()                          │
│                            │                                 │
│              ┌─────────────┴─────────────┐                  │
│              ▼                           ▼                   │
│      [In-Memory Buffers]          [Cached Timestamp]        │
│              │                           │                   │
│              └─────────────┬─────────────┘                  │
│                            │                                 │
│                    (on second boundary)                      │
│                            │                                 │
│                            ▼                                 │
│                   Flush to Atoms                             │
│                            │                                 │
│                            ▼                                 │
│                    React Re-render                           │
└─────────────────────────────────────────────────────────────┘
```

**Bottleneck**: Timer scheduling is unpredictable.

---

## Option A: Pure rAF with Timing Compensation

```
┌─────────────────────────────────────────────────────────────┐
│                 requestAnimationFrame Loop                   │
│                            │                                 │
│                            ▼                                 │
│              ┌─────────────────────────┐                    │
│              │   Calculate deltaTime   │                    │
│              │   since last frame      │                    │
│              └────────────┬────────────┘                    │
│                           │                                  │
│                           ▼                                  │
│              ┌─────────────────────────┐                    │
│              │  eventsToEmit =         │                    │
│              │  floor(deltaTime *      │                    │
│              │        eventsPerSec     │                    │
│              │        / 1000)          │                    │
│              └────────────┬────────────┘                    │
│                           │                                  │
│                           ▼                                  │
│              ┌─────────────────────────┐                    │
│              │  for (i < eventsToEmit) │                    │
│              │    recordEmission()     │                    │
│              └────────────┬────────────┘                    │
│                           │                                  │
│                           ▼                                  │
│                   [In-Memory Buffers]                        │
│                           │                                  │
│                   (on second boundary)                       │
│                           │                                  │
│                           ▼                                  │
│                    Flush to Atoms                            │
└─────────────────────────────────────────────────────────────┘
```

**Pros**:
- Simple, no Effect dependency on hot path
- Timing compensation handles frame drops
- Predictable ~60fps cadence

**Cons**:
- No backpressure semantics
- No fiber interruption
- Not composable with Effect ecosystem

---

## Option B: Effect Stream with rAF Scheduler

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│   Stream.asyncPush<EmissionEvent>                           │
│        │                                                     │
│        │  ┌──────────────────────────────────┐              │
│        │  │  rAF Loop (Producer)             │              │
│        │  │    - calculates eventsToEmit     │              │
│        │  │    - calls emit() N times        │              │
│        │  └──────────────┬───────────────────┘              │
│        │                 │                                   │
│        ▼                 ▼                                   │
│   ┌─────────────────────────────────────────┐               │
│   │           Effect Stream Pipeline         │               │
│   │                                          │               │
│   │  Stream.asyncPush(emit => {              │               │
│   │    // rAF loop calls emit()              │               │
│   │  })                                      │               │
│   │    │                                     │               │
│   │    ▼                                     │               │
│   │  .pipe(Stream.tap(recordToBuffer))       │               │
│   │    │                                     │               │
│   │    ▼                                     │               │
│   │  .pipe(Stream.groupedWithin(            │               │
│   │          1000,    // 1 second            │               │
│   │          Infinity // no count limit      │               │
│   │        ))                                │               │
│   │    │                                     │               │
│   │    ▼                                     │               │
│   │  .pipe(Stream.runForEach(flushToAtoms)) │               │
│   │                                          │               │
│   └─────────────────────────────────────────┘               │
│                         │                                    │
│                         ▼                                    │
│                  Atoms → React                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Pros**:
- Full Effect semantics (interruption, scoping)
- Backpressure if needed
- Composable with other streams
- `groupedWithin` handles batching elegantly

**Cons**:
- More complex
- Effect scheduler overhead on hot path
- Need to bridge rAF → Stream correctly

---

## Option C: Hybrid - rAF Producer, Effect Consumer

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    PRODUCER (Main Thread)               │ │
│  │                                                         │ │
│  │   rAF Loop                                              │ │
│  │      │                                                  │ │
│  │      ▼                                                  │ │
│  │   Calculate eventsToEmit                                │ │
│  │      │                                                  │ │
│  │      ▼                                                  │ │
│  │   Push to SharedArrayBuffer / Ring Buffer               │ │
│  │      │                                                  │ │
│  └──────┼──────────────────────────────────────────────────┘ │
│         │                                                    │
│         │  (Lock-free queue)                                │
│         │                                                    │
│  ┌──────┼──────────────────────────────────────────────────┐ │
│  │      ▼                    CONSUMER (Effect Fiber)       │ │
│  │                                                         │ │
│  │   Stream.fromQueue(ringBuffer)                          │ │
│  │      │                                                  │ │
│  │      ▼                                                  │ │
│  │   .pipe(Stream.groupedWithin(1000, Infinity))          │ │
│  │      │                                                  │ │
│  │      ▼                                                  │ │
│  │   .pipe(Stream.runForEach(batch => {                   │ │
│  │       flushToAtoms(batch)                               │ │
│  │   }))                                                   │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Pros**:
- Decoupled producer/consumer
- rAF has zero Effect overhead
- Consumer can be throttled independently
- Could move consumer to Web Worker

**Cons**:
- More complex architecture
- SharedArrayBuffer has COOP/COEP requirements
- Overkill for current needs?

---

## Option D: Effect Schedule with rAF-aware Scheduler

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│   Effect.gen(function*() {                                  │
│     const schedule = Schedule.spaced(Duration.millis(16))   │
│                        .pipe(Schedule.jittered)             │
│                                                              │
│     yield* Stream.repeatEffectWithSchedule(                 │
│       emitBatch,                                             │
│       schedule                                               │
│     ).pipe(                                                  │
│       Stream.tap(recordToBuffer),                           │
│       Stream.groupedWithin(Duration.seconds(1), Infinity),  │
│       Stream.runForEach(flushToAtoms)                       │
│     )                                                        │
│   })                                                         │
│                                                              │
│   // emitBatch calculates how many events to emit           │
│   // based on elapsed time since last call                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Pros**:
- Pure Effect, no rAF
- Schedule combinators are powerful
- Fiber semantics throughout

**Cons**:
- Effect scheduler != rAF timing
- May still have jitter issues
- Not truly frame-aligned

---

## Sequence Diagram: Option B (rAF + Stream)

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  rAF    │     │ Stream  │     │ Buffer  │     │  Atoms  │     │  React  │
│  Loop   │     │ Fiber   │     │ (mem)   │     │         │     │         │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │               │
     │ frame tick    │               │               │               │
     ├──────────────►│               │               │               │
     │  emit(event)  │               │               │               │
     │               │ push          │               │               │
     │               ├──────────────►│               │               │
     │               │               │               │               │
     │ (repeat N×)   │               │               │               │
     ├──────────────►│               │               │               │
     │               ├──────────────►│               │               │
     │               │               │               │               │
     │               │               │               │               │
     │               │ (1 sec passes)│               │               │
     │               │               │               │               │
     │               │ groupedWithin │               │               │
     │               │ fires         │               │               │
     │               ├───────────────┼──────────────►│               │
     │               │               │  flush batch  │               │
     │               │               │               │ notify        │
     │               │               │               ├──────────────►│
     │               │               │               │               │ re-render
     │               │               │               │               │
```

---

## Questions for Decision

### Q1: Backpressure Semantics

Do we need backpressure? If the consumer can't keep up, should we:

- **A) Drop events** (lossy, but bounded memory)
- **B) Buffer unbounded** (no loss, but memory risk)
- **C) Block producer** (true backpressure, but stalls rAF)
- **D) Sample/downsample** (keep latest N per window)

*Current implementation is effectively (B) with manual buffer limits.*

---

### Q2: Fiber Interruption

When user clicks "Reset" or "Stop", how should in-flight events be handled?

- **A) Immediate drop** - discard buffered events, stop instantly
- **B) Graceful flush** - flush current buffer, then stop
- **C) Timeout flush** - flush with 100ms deadline, then force stop

*Affects whether we need Effect.Scope/Fiber.interrupt semantics.*

---

### Q3: Observability

How important is tracing the emission pipeline?

- **A) Critical** - every emission should have a span
- **B) Sampled** - trace 1% of emissions
- **C) Aggregate only** - trace batch flushes, not individual events
- **D) None on hot path** - observability only on cold path

*Affects whether we use Effect.withSpan in the loop.*

---

### Q4: Multi-Scenario Composition

Will we ever run multiple scenarios simultaneously?

- **A) No** - single scenario at a time
- **B) Yes, isolated** - separate streams, separate atoms
- **C) Yes, merged** - multiple producers into one consumer

*Affects whether Stream.merge or separate registries are needed.*

---

### Q5: Target Throughput Ceiling

What's the maximum events/sec we need to support?

- **A) 100/sec** - current "sustained load" scenario
- **B) 1,000/sec** - stress testing
- **C) 10,000/sec** - high-frequency simulation
- **D) Unlimited** - as fast as possible

*Affects whether we need Web Workers or more aggressive optimizations.*

---

### Q6: Effect Stream vs. Pure rAF

Given the playground is a demo/learning tool, which matters more?

- **A) Effect purity** - showcase Effect Streams properly
- **B) Raw performance** - prove we can hit the numbers
- **C) Both** - hybrid architecture (Option C)

---

## Decisions Made

| Question | Answer | Rationale |
|----------|--------|-----------|
| Q1: Backpressure | **Sample/downsample** | Preserve statistical distribution without unbounded memory |
| Q2: Interruption | Immediate drop | Demo tool, user expects instant response |
| Q3: Observability | **Batch flushes only** | Zero overhead on hot path, trace 1/sec flushes |
| Q4: Multi-scenario | Single | Keep it simple for now |
| Q5: Throughput | **10,000/sec** | High-frequency simulation ceiling |
| Q6: Architecture | **Hybrid** | rAF for timing precision, Effect for consumption |

---

## Final Architecture: Hybrid rAF + Effect with Reservoir Sampling

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     HOT PATH (rAF Loop, ~100μs budget)                  │ │
│  │                                                                         │ │
│  │   requestAnimationFrame(tick)                                           │ │
│  │        │                                                                │ │
│  │        ▼                                                                │ │
│  │   ┌──────────────────────────────────────┐                             │ │
│  │   │  deltaTime = now - lastFrameTime     │                             │ │
│  │   │  eventsToEmit = deltaTime * rate     │                             │ │
│  │   └──────────────┬───────────────────────┘                             │ │
│  │                  │                                                      │ │
│  │                  ▼                                                      │ │
│  │   ┌──────────────────────────────────────┐                             │ │
│  │   │  for (i = 0; i < eventsToEmit; i++)  │                             │ │
│  │   │    latency = generateLatency()       │  ← No allocations           │ │
│  │   │    reservoirSample(latency)          │  ← O(1) probabilistic       │ │
│  │   │    runningSum += latency             │  ← Aggregate stats          │ │
│  │   │    eventCount++                      │                             │ │
│  │   └──────────────┬───────────────────────┘                             │ │
│  │                  │                                                      │ │
│  │                  │  (check secondBoundary)                             │ │
│  │                  │                                                      │ │
│  └──────────────────┼──────────────────────────────────────────────────────┘ │
│                     │                                                        │
│                     │  (on second boundary)                                 │
│                     │                                                        │
│  ┌──────────────────┼──────────────────────────────────────────────────────┐ │
│  │                  ▼              COLD PATH (Effect, 1/sec)               │ │
│  │                                                                         │ │
│  │   Effect.gen(function*() {                                              │ │
│  │     yield* Effect.withSpan("flush-metrics", () =>                      │ │
│  │       Effect.sync(() => {                                               │ │
│  │         // Snapshot reservoir sample                                    │ │
│  │         // Calculate percentiles from sample                            │ │
│  │         // Flush to atoms                                               │ │
│  │         // Reset counters                                               │ │
│  │       })                                                                │ │
│  │     )                                                                   │ │
│  │   })                                                                    │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                     │                                                        │
│                     ▼                                                        │
│              Atoms → React (re-render 1/sec)                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Reservoir Sampling for Latency Distribution

At 10,000 events/sec, we can't store all latency values. **Reservoir Sampling** maintains a statistically representative sample of size K with O(1) per-event cost.

```typescript
// Reservoir of size K (e.g., 1000)
const RESERVOIR_SIZE = 1000
let reservoir: Float64Array = new Float64Array(RESERVOIR_SIZE)
let sampleCount = 0

function reservoirSample(value: number): void {
  if (sampleCount < RESERVOIR_SIZE) {
    // Fill phase: just append
    reservoir[sampleCount] = value
  } else {
    // Replacement phase: random chance to replace
    const j = Math.floor(Math.random() * (sampleCount + 1))
    if (j < RESERVOIR_SIZE) {
      reservoir[j] = value
    }
  }
  sampleCount++
}
```

**Properties**:
- Every event has equal probability of being in sample
- Percentile calculations on sample are unbiased
- Memory bounded: exactly RESERVOIR_SIZE * 8 bytes
- O(1) per event, no allocations

---

## TypedArrays for Zero-Allocation Hot Path

```typescript
// Pre-allocated buffers (no GC pressure)
const BUFFER_SIZE = 1024

// Throughput: just need count per window
let throughputCount = 0

// Latency: reservoir sample + running stats
const latencyReservoir = new Float64Array(RESERVOIR_SIZE)
let latencySum = 0
let latencyMin = Infinity
let latencyMax = -Infinity
let latencySampleCount = 0

// Raw events for AG-Grid: ring buffer with pre-allocated slots
const rawEventTimestamps = new Float64Array(MAX_RAW_EVENTS)
const rawEventLatencies = new Float64Array(MAX_RAW_EVENTS)
let rawEventHead = 0
let rawEventCount = 0
```

---

## Timing Compensation Algorithm

```typescript
let lastFrameTime = 0
let fractionalEvents = 0  // Accumulates sub-event residue

function tick(currentTime: DOMHighResTimeStamp): void {
  if (!running) return

  const deltaMs = lastFrameTime === 0 ? 16.67 : currentTime - lastFrameTime
  lastFrameTime = currentTime

  // Calculate events to emit this frame (with fractional accumulation)
  const exactEvents = (deltaMs / 1000) * eventsPerSecond + fractionalEvents
  const wholeEvents = Math.floor(exactEvents)
  fractionalEvents = exactEvents - wholeEvents  // Save remainder

  // Emit events
  for (let i = 0; i < wholeEvents; i++) {
    emitEvent()
  }

  // Check second boundary for flush
  const now = Date.now()
  const secondBoundary = Math.floor(now / 1000) * 1000
  if (secondBoundary > cachedSecondBoundary) {
    flushToAtoms()
    cachedSecondBoundary = secondBoundary
  }

  requestAnimationFrame(tick)
}
```

**Key insight**: `fractionalEvents` accumulates the sub-event residue, ensuring we don't drift over time. At 10,000 events/sec with 60fps, that's ~166.67 events/frame. The `.67` accumulates and eventually triggers an extra event.

---

## Effect Stream Integration

The architecture uses a **Queue bridge** between rAF (producer) and Effect Stream (consumer):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   rAF Loop (Producer)              Queue (Bridge)         Stream (Consumer) │
│                                                                              │
│   ┌─────────────────┐         ┌─────────────────┐     ┌─────────────────┐  │
│   │                 │         │                 │     │                 │  │
│   │  tick()         │         │  Queue.sliding  │     │  Stream.from    │  │
│   │    │            │         │  <Batch>(60)    │     │  Queue(queue)   │  │
│   │    ▼            │         │                 │     │    │            │  │
│   │  emitEvents()   │         │  ┌───────────┐  │     │    ▼            │  │
│   │    │            │  push   │  │ Batch[0]  │  │     │  .pipe(         │  │
│   │    ▼            ├────────►│  │ Batch[1]  │  │────►│    Stream.tap,  │  │
│   │  accumulateIn   │         │  │ Batch[2]  │  │     │    Stream.map,  │  │
│   │  TypedArrays    │         │  │ ...       │  │     │    ...          │  │
│   │    │            │         │  └───────────┘  │     │  )              │  │
│   │    ▼            │         │                 │     │    │            │  │
│   │  (1s boundary)  │         │  Sliding/Drop   │     │    ▼            │  │
│   │  createBatch()  │         │  if consumer    │     │  Stream.run     │  │
│   │  Queue.offer()  │         │  falls behind   │     │  ForEach(...)   │  │
│   │                 │         │                 │     │                 │  │
│   └─────────────────┘         └─────────────────┘     └─────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Bridge: Effect.Queue

```typescript
import { Effect, Queue, Stream } from 'effect'

// Batch type - what flows through the stream
interface EmissionBatch {
  readonly timestamp: number
  readonly throughputCount: number
  readonly latencyReservoir: Float64Array  // Copy, not reference
  readonly latencySampleCount: number
  readonly latencyMin: number
  readonly latencyMax: number
  readonly latencySum: number
  readonly rawEvents: RawEventBatch
}

// Create sliding queue (drops oldest if consumer falls behind)
const makeBatchQueue = Effect.map(
  Queue.sliding<EmissionBatch>(60),  // 60 seconds buffer
  (queue) => queue
)

// rAF pushes batches (called from outside Effect runtime)
function pushBatch(queue: Queue.Queue<EmissionBatch>, batch: EmissionBatch): void {
  // unsafeOffer is synchronous, safe to call from rAF
  Queue.unsafeOffer(queue, batch)
}
```

### The Consumer: Effect Stream Pipeline

```typescript
const createEmissionStream = (queue: Queue.Queue<EmissionBatch>) =>
  Stream.fromQueue(queue).pipe(
    // Add observability span to each batch
    Stream.tap((batch) =>
      Effect.withSpan("playground/process-batch", {
        attributes: {
          throughput: batch.throughputCount,
          latencySamples: batch.latencySampleCount,
        },
      })(Effect.void)
    ),

    // Compute derived metrics
    Stream.map((batch) => ({
      ...batch,
      latencyStats: computePercentiles(batch.latencyReservoir, batch.latencySampleCount),
      throughputRate: batch.throughputCount, // events/sec (batch is 1 second)
    })),

    // Side effect: flush to atoms
    Stream.tap((enrichedBatch) =>
      Effect.sync(() => {
        playgroundRegistry.set(throughputAtom, enrichedBatch.throughputRate)
        playgroundRegistry.set(latencyAtom, enrichedBatch.latencyStats)
        playgroundRegistry.set(rawEventsAtom, enrichedBatch.rawEvents)
      })
    ),

    // Could add more pipeline stages:
    // Stream.filter(...),
    // Stream.mapAccum(...) for running averages,
    // Stream.throttle(...) if needed,
  )

// Run the stream as a fiber
const runEmissionStream = (queue: Queue.Queue<EmissionBatch>) =>
  Effect.gen(function* () {
    const fiber = yield* createEmissionStream(queue).pipe(
      Stream.runDrain,
      Effect.fork,  // Run in background fiber
    )
    return fiber
  })
```

### Full Integration: EmissionEngine

```typescript
import { Effect, Queue, Stream, Fiber, Scope } from 'effect'

class EmissionEngine {
  private queue: Queue.Queue<EmissionBatch> | null = null
  private fiber: Fiber.Fiber<void, never> | null = null
  private rafId: number | null = null
  private running = false

  // Typed arrays for hot path
  private latencyReservoir = new Float64Array(RESERVOIR_SIZE)
  private throughputCount = 0
  // ... other state

  /** Start the engine - creates queue, starts stream fiber, starts rAF */
  start = Effect.gen(this, function* () {
    // Create the queue bridge
    this.queue = yield* Queue.sliding<EmissionBatch>(60)

    // Start the consumer fiber
    this.fiber = yield* createEmissionStream(this.queue).pipe(
      Stream.runDrain,
      Effect.fork,
    )

    // Start rAF loop (pure JS side)
    this.running = true
    this.rafId = requestAnimationFrame(this.tick)

    yield* Effect.log("EmissionEngine started")
  })

  /** Stop the engine - interrupt fiber, cancel rAF */
  stop = Effect.gen(this, function* () {
    this.running = false

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }

    if (this.fiber !== null) {
      yield* Fiber.interrupt(this.fiber)
      this.fiber = null
    }

    if (this.queue !== null) {
      yield* Queue.shutdown(this.queue)
      this.queue = null
    }

    yield* Effect.log("EmissionEngine stopped")
  })

  /** rAF tick - pure JS, zero Effect overhead */
  private tick = (currentTime: DOMHighResTimeStamp): void => {
    if (!this.running) return

    // ... timing compensation, emit events to TypedArrays ...

    // On second boundary: create batch and push to queue
    if (secondBoundary > this.cachedSecondBoundary) {
      const batch = this.createBatch()
      if (this.queue) {
        Queue.unsafeOffer(this.queue, batch)
      }
      this.resetCounters()
      this.cachedSecondBoundary = secondBoundary
    }

    this.rafId = requestAnimationFrame(this.tick)
  }

  /** Create batch from current state (copies TypedArray) */
  private createBatch(): EmissionBatch {
    return {
      timestamp: Date.now(),
      throughputCount: this.throughputCount,
      latencyReservoir: new Float64Array(this.latencyReservoir),  // Copy!
      latencySampleCount: this.latencySampleCount,
      latencyMin: this.latencyMin,
      latencyMax: this.latencyMax,
      latencySum: this.latencySum,
      rawEvents: this.snapshotRawEvents(),
    }
  }
}
```

### Stream Composition Examples

The Effect Stream consumer enables powerful composition:

```typescript
// Example 1: Running average over last 10 seconds
const withRunningAverage = (stream: Stream.Stream<EnrichedBatch>) =>
  stream.pipe(
    Stream.sliding(10),  // Window of last 10 batches
    Stream.map((window) => ({
      currentBatch: window[window.length - 1],
      avgThroughput: window.reduce((s, b) => s + b.throughputRate, 0) / window.length,
      avgLatency: window.reduce((s, b) => s + b.latencyStats.avg, 0) / window.length,
    }))
  )

// Example 2: Alert on anomalies
const withAnomalyDetection = (stream: Stream.Stream<EnrichedBatch>) =>
  stream.pipe(
    Stream.tap((batch) =>
      batch.latencyStats.p99 > 100
        ? Effect.log(`ALERT: p99 latency spike: ${batch.latencyStats.p99}ms`)
        : Effect.void
    )
  )

// Example 3: Fan-out to multiple sinks
const withMultipleSinks = (stream: Stream.Stream<EnrichedBatch>) =>
  stream.pipe(
    Stream.broadcast(2, 16),  // 2 consumers, buffer 16
    Effect.flatMap(([s1, s2]) =>
      Effect.all([
        s1.pipe(Stream.runForEach(flushToAtoms)),
        s2.pipe(Stream.runForEach(sendToTelemetry)),
      ], { concurrency: 2 })
    )
  )
```

### Why This Architecture?

| Concern | Solution |
|---------|----------|
| Hot path performance | rAF + TypedArrays, zero Effect overhead |
| Effect Stream consumption | Queue bridge, fiber-based consumer |
| Backpressure | `Queue.sliding` drops oldest batches |
| Interruption | `Fiber.interrupt` cleanly stops consumer |
| Composition | Full Stream combinators available |
| Observability | `Effect.withSpan` on batch processing |

---

## Performance Budget

| Operation | Budget | Notes |
|-----------|--------|-------|
| Event emission | 100μs | 10,000/sec = 100μs each |
| Frame budget | 16.67ms | 60fps |
| Events per frame | ~167 | 10,000/60 |
| Time per event in frame | ~100μs | 16.67ms / 167 |
| Flush (1/sec) | 5ms max | Effect.withSpan + atom writes |

At 10,000 events/sec, we have ~100μs per event. Current operations:
- `Date.now()`: ~1μs
- `Math.random()`: ~0.1μs
- `Float64Array` write: ~0.01μs
- Counter increment: ~0.001μs

**Total**: ~2μs per event = **5,000x headroom** ✓


 The key insight is the Queue bridge:

  rAF (10k/sec)  →  TypedArrays  →  Queue.sliding  →  Stream.fromQueue  →  Pipeline
       ↑                              ↑                      ↑
     hot path                    1 batch/sec            full Effect
     zero Effect                unsafeOffer()           composition

  Data flow:
  1. rAF accumulates 10k events/sec into TypedArrays (zero allocations)
  2. On second boundary: snapshot → EmissionBatch → Queue.unsafeOffer()
  3. Effect Stream consumes from queue: Stream.fromQueue(queue).pipe(...)
  4. Full Stream combinators: tap, map, sliding, broadcast, etc.

  The Queue is the bridge - it's the only place where the JS world touches the Effect world. unsafeOffer is
  synchronous and safe to call from rAF.


---

## Implementation Checklist

- [ ] Create `EmissionEngine` class with rAF loop
- [ ] Implement reservoir sampling with Float64Array
- [ ] Implement timing compensation with fractional accumulation
- [ ] Add Effect.withSpan on flush path only
- [ ] Wire to existing atoms (throughputAtom, latencyAtom, rawEventsAtom)
- [ ] Add start/stop/reset controls
- [ ] Update scenarios to use new engine
- [ ] Benchmark to verify 10,000/sec ceiling
