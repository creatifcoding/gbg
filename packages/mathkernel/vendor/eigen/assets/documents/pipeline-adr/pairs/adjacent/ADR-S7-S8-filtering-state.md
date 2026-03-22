---
id: S7-S8
title: "Filtering → State Integration — Delta-to-Atom Update Patterns"
commitHash: "6656064"
status: draft
date: 2026-01-02
tier: pair-adjacent
author: Val
dependencies:
  - ADR-S7-filtering
  - ADR-S8-state
  - effect-atom-integration
  - tmnl-registry-patterns
related:
  - ADR-S6-S7-normalization-filtering
  - ADR-S8-S9-state-presentation
---

# ADR-S7-S8: Filtering → State Integration

## Context

The **Filtering Layer (S7)** produces refined sensor deltas via dead-band filtering and decimation. The **State Management Layer (S8)** maintains reactive atoms for UI consumption. The critical integration question: **How do filtered deltas propagate to atoms with proper update semantics, backpressure handling, and Result lifecycle management?**

### Problem Space

1. **Update Granularity**: Single sensor updates vs batched multi-sensor updates
2. **Coalescing Strategy**: Rapid-fire deltas must not thrash React reconciliation
3. **Result Lifecycle**: How do atoms transition through `Initial → Waiting → Success → Failure → Recovery`?
4. **Backpressure Feedback**: When atom updates lag, should filters throttle more aggressively?
5. **Stale Detection**: How to signal when `Success` data is outdated but not failed?

### TMNL Integration Context

- **effect-atom patterns**: `Atom.family()` for keyed state, `registry.set()` for updates
- **Result types**: `Result.success()`, `Result.failure()`, `Result.waiting()`
- **Coalescing**: `Effect.Queue` with sliding window for burst absorption
- **Adaptive feedback**: Backpressure signals propagate upstream to S7

---

## Decision

### 1. Delta-to-Atom Mapping

**Pattern**: One atom per sensor via `Atom.family<SensorId, Result<SensorReading>>()`

```typescript
import { Atom } from "effect-atom"
import { Result } from "@effect/schema"

// Schema definitions
const SensorReading = Schema.Struct({
  value: Schema.Number,
  timestamp: Schema.Number,
  unit: Schema.String,
})

const SensorId = Schema.String.pipe(Schema.brand("SensorId"))

// Atom family for sensor state
export const sensorAtoms = Atom.family<
  typeof SensorId.Type,
  Result.Result<typeof SensorReading.Type>
>({
  key: "sensor-reading",
  default: Result.initial(),
})
```

**Update Protocol**:

```typescript
// Filtered delta from S7
interface FilteredDelta {
  sensorId: SensorId
  value: number
  timestamp: number
  filtered: boolean // true if passed filter, false if suppressed
}

// Atom update in S8
const updateSensorAtom = (
  delta: FilteredDelta,
  registry: Atom.Registry
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const atom = sensorAtoms(delta.sensorId)
    const reading = {
      value: delta.value,
      timestamp: delta.timestamp,
      unit: yield* getUnitForSensor(delta.sensorId),
    }
    registry.set(atom, Result.success(reading))
  })
```

**Batch Updates**:

```typescript
// Multiple sensors updated in single tick
const batchUpdateSensors = (
  deltas: FilteredDelta[],
  registry: Atom.Registry
): Effect.Effect<void> =>
  Effect.gen(function* () {
    // Group by sensor to handle duplicates
    const grouped = Map.groupBy(deltas, (d) => d.sensorId)

    // Take latest delta per sensor
    const updates = Array.from(grouped.entries()).map(([id, deltas]) =>
      deltas.reduce((latest, current) =>
        current.timestamp > latest.timestamp ? current : latest
      )
    )

    // Apply all updates atomically
    yield* Effect.forEach(
      updates,
      (delta) => updateSensorAtom(delta, registry),
      { concurrency: "unbounded" }
    )
  })
```

---

### 2. Update Coalescing

**Problem**: 100Hz sensor updates must not cause 100 React re-renders/sec.

**Solution**: Sliding window queue with debounced flush

```typescript
import { Queue } from "effect"

// Coalescing buffer configuration
const CoalescingConfig = Schema.Struct({
  windowMs: Schema.Number.pipe(Schema.default(16)), // ~60fps
  maxBufferSize: Schema.Number.pipe(Schema.default(1000)),
})

// Coalescing service
export class SensorCoalescer extends Effect.Service<SensorCoalescer>()(
  "SensorCoalescer",
  {
    effect: Effect.gen(function* () {
      const config = yield* CoalescingConfig
      const queue = yield* Queue.sliding<FilteredDelta>(config.maxBufferSize)
      const registry = yield* Atom.Registry

      // Flush accumulated deltas to atoms
      const flush = Effect.gen(function* () {
        const deltas = yield* Queue.takeAll(queue)
        if (deltas.length === 0) return

        yield* batchUpdateSensors(deltas, registry)
      })

      // Periodic flush on schedule
      const scheduleFlush = Effect.repeat(
        flush,
        Schedule.spaced(Duration.millis(config.windowMs))
      )

      // Start background flusher
      yield* Effect.forkDaemon(scheduleFlush)

      return {
        enqueue: (delta: FilteredDelta) => Queue.offer(queue, delta),
        forceFlush: flush,
      } as const
    }),
    dependencies: [Atom.Registry.Default],
  }
) {}
```

**Usage**:

```typescript
// S7 filter output pipes to coalescer
const processFilteredDelta = (delta: FilteredDelta) =>
  Effect.gen(function* () {
    const coalescer = yield* SensorCoalescer
    yield* coalescer.enqueue(delta)
  })
```

---

### 3. Result Lifecycle Management

**State Machine**:

```
Initial → Waiting → Success → (Stale Warning) → Success
                     ↓                            ↑
                  Failure ────────────────────────┘
                            (reconnect)
```

**Lifecycle Transitions**:

```typescript
// On subscription (sensor stream starts)
const onSubscribe = (sensorId: SensorId, registry: Atom.Registry) =>
  Effect.sync(() => {
    registry.set(sensorAtoms(sensorId), Result.waiting())
  })

// On first data
const onData = (delta: FilteredDelta, registry: Atom.Registry) =>
  Effect.gen(function* () {
    const reading = yield* createReading(delta)
    registry.set(sensorAtoms(delta.sensorId), Result.success(reading))
  })

// On error
const onError = (sensorId: SensorId, error: Error, registry: Atom.Registry) =>
  Effect.sync(() => {
    registry.set(sensorAtoms(sensorId), Result.failure(error))
  })

// On reconnect after failure
const onReconnect = (sensorId: SensorId, registry: Atom.Registry) =>
  Effect.sync(() => {
    registry.set(sensorAtoms(sensorId), Result.waiting())
  })
```

**Stale Detection**:

```typescript
// Extended Result type with staleness metadata
const SensorResult = Result.Result(SensorReading).pipe(
  Schema.extend(
    Schema.Struct({
      isStale: Schema.Boolean.pipe(Schema.default(false)),
      lastUpdateMs: Schema.Number,
    })
  )
)

// Stale checker (runs periodically)
const checkStaleness = (
  sensorId: SensorId,
  registry: Atom.Registry,
  thresholdMs: number = 5000
) =>
  Effect.gen(function* () {
    const atom = sensorAtoms(sensorId)
    const result = registry.get(atom)

    if (result._tag !== "Success") return

    const now = Date.now()
    const age = now - result.value.timestamp

    if (age > thresholdMs && !result.isStale) {
      // Mark as stale but keep Success state
      registry.set(atom, {
        ...result,
        isStale: true,
        lastUpdateMs: now,
      })
    }
  })
```

---

### 4. Backpressure Feedback

**Problem**: If atom updates lag (e.g., React rendering blocked), queue fills up.

**Solution**: Adaptive threshold adjustment via feedback signal to S7

```typescript
// Backpressure signal
const BackpressureSignal = Schema.TaggedClass<BackpressureSignal>()(
  "BackpressureSignal",
  {
    sensorId: SensorId,
    queueUtilization: Schema.Number, // 0.0 to 1.0
    recommendedThreshold: Schema.Number, // suggested dead-band increase
  }
)

// Monitor queue depth in coalescer
export class BackpressureMonitor extends Effect.Service<BackpressureMonitor>()(
  "BackpressureMonitor",
  {
    effect: Effect.gen(function* () {
      const coalescer = yield* SensorCoalescer
      const signalQueue = yield* Queue.unbounded<BackpressureSignal>()

      const monitor = Effect.gen(function* () {
        const queueSize = yield* Queue.size(coalescer.queue)
        const utilization = queueSize / coalescer.maxBufferSize

        if (utilization > 0.8) {
          // Queue filling up, signal S7 to increase filter threshold
          const signal = new BackpressureSignal({
            sensorId: "global", // or per-sensor
            queueUtilization: utilization,
            recommendedThreshold: utilization * 1.5, // 50% stricter
          })

          yield* Queue.offer(signalQueue, signal)
        }
      })

      // Check every 100ms
      yield* Effect.forkDaemon(
        Effect.repeat(monitor, Schedule.spaced(Duration.millis(100)))
      )

      return {
        signals: Queue.take(signalQueue),
      } as const
    }),
    dependencies: [SensorCoalescer.Default],
  }
) {}
```

**S7 Integration**:

```typescript
// Filter layer subscribes to backpressure signals
const adaptFilterThreshold = (signal: BackpressureSignal) =>
  Effect.gen(function* () {
    const filterSvc = yield* FilterService

    yield* filterSvc.updateDeadBand(
      signal.sensorId,
      signal.recommendedThreshold
    )

    Console.log(
      `Increased filter threshold to ${signal.recommendedThreshold} due to backpressure`
    )
  })
```

---

## Interfaces

### FilterOutput (S7 → S8)

```typescript
interface FilteredDelta {
  sensorId: SensorId
  value: number
  timestamp: number
  filtered: boolean // true = passed filter, false = suppressed
  filterType: "deadband" | "decimation" | "none"
}
```

### AtomUpdate (S8 Internal)

```typescript
// Registry operation
registry.set(
  sensorAtoms(sensorId),
  Result.success({
    value: number,
    timestamp: number,
    unit: string,
  })
)
```

### BackpressureFeedback (S8 → S7)

```typescript
interface BackpressureSignal {
  sensorId: SensorId
  queueUtilization: number // 0.0 to 1.0
  recommendedThreshold: number // multiplicative factor
}
```

---

## Consequences

### Positive

1. **Clean Separation**: S7 produces deltas, S8 manages state — no coupling
2. **Coalescing Efficiency**: 100Hz sensor → 60Hz React updates
3. **Result Hygiene**: Explicit lifecycle prevents "undefined" confusion
4. **Adaptive Feedback**: System self-regulates under load
5. **Stale Detection**: UI can warn user without failing state

### Negative

1. **Latency**: 16ms coalescing window adds delay (acceptable for sensors)
2. **Memory Overhead**: Queue buffer + atom family + per-sensor metadata
3. **Complexity**: Backpressure feedback loop requires tuning

### Neutral

1. **Effect-Atom Dependency**: Committed to effect-atom patterns (already chosen)
2. **Testing**: Need mock registry for atom update verification

---

## Implementation Notes

1. **Start Simple**: Implement basic delta-to-atom mapping first
2. **Add Coalescing**: Introduce queue only when >30 sensors active
3. **Backpressure Last**: Deploy after observing real-world queue behavior
4. **Stale Detection**: Optional feature, enable per-sensor via config

---

## Related Patterns

- **Atom.family()**: `/effect-atom-integration` skill
- **Result lifecycle**: `RESULT_PATTERN_ANALYSIS.md`
- **Registry patterns**: `/tmnl-registry-patterns` skill
- **Queue.sliding()**: Effect documentation

---

## Revision History

- **2026-01-02**: Initial draft (Val)
