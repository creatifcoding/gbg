# TMNL Streams — Pattern Catalog

Common problems and their solutions using TMNL Streams.

---

## Table of Contents

- [Stream Creation Patterns](#stream-creation-patterns)
- [Lifecycle Patterns](#lifecycle-patterns)
- [Composition Patterns](#composition-patterns)
- [Error Handling Patterns](#error-handling-patterns)
- [Testing Patterns](#testing-patterns)
- [Integration Patterns](#integration-patterns)

---

## Stream Creation Patterns

### Pattern: Lazy Value Emission

**Problem:** You want to emit values that are computed at emission time, not stream creation time.

**Solution:** Use `Stream.map` with a thunk or `Stream.repeatEffect`.

```typescript
// WRONG — value computed once
const timestamp = Date.now()
const stream = Stream.repeat(Stream.succeed(timestamp), schedule)

// RIGHT — value computed each emission
const stream = Stream.repeatEffect(Effect.sync(() => Date.now()))

// ALSO RIGHT — map with thunk
const stream = Stream.make(0).pipe(
  Stream.repeat(Schedule.spaced("1 second")),
  Stream.map(() => Date.now())
)
```

---

### Pattern: Immediate vs Delayed First Emission

**Problem:** Sometimes you want the first value immediately, sometimes after the first interval.

**Solution:** Choose between `Stream.repeat` and `Stream.schedule`.

```typescript
// Immediate first emission (repeat restarts AFTER completion)
const immediate = Stream.make(0).pipe(
  Stream.repeat(Schedule.spaced("1 second")),
  Stream.map(() => computeValue())
)

// Delayed first emission (schedule delays BEFORE each emission)
const delayed = Stream.repeatEffect(computeValue()).pipe(
  Stream.schedule(Schedule.spaced("1 second"))
)

// Or use the factory options
import { ticker } from "@/lib/streams"
const immediate = ticker("1 second", { immediate: true })
const delayed = ticker("1 second", { immediate: false })
```

---

### Pattern: Effectful Stream Setup

**Problem:** You need to run setup logic before streaming begins.

**Solution:** Use `Stream.unwrap` to bridge Effect to Stream.

```typescript
const stream = Stream.unwrap(
  Effect.gen(function* () {
    // Setup phase (runs once)
    const connection = yield* openConnection()
    const config = yield* loadConfig()
    let counter = 0

    // Return the actual stream
    return Stream.repeatEffect(
      Effect.gen(function* () {
        counter++
        return yield* connection.read()
      })
    )
  })
)
```

---

## Lifecycle Patterns

### Pattern: Guaranteed Cleanup

**Problem:** Ensure cleanup runs regardless of how the stream ends (success, failure, interruption).

**Solution:** Use `Stream.ensuring`.

```typescript
const stream = Stream.repeatEffect(fetchData).pipe(
  Stream.ensuring(
    Effect.gen(function* () {
      yield* closeConnection()
      yield* Console.log("Cleaned up")
    })
  )
)
```

**Note:** `Stream.ensuring` runs on ALL termination types. For success/failure only, use `Stream.onDone`.

---

### Pattern: Resource Acquisition and Release

**Problem:** Acquire a resource, use it for streaming, release when done.

**Solution:** Use `Stream.acquireRelease` + `Stream.flatMap`.

```typescript
const stream = Stream.acquireRelease(
  // Acquire
  Effect.gen(function* () {
    const conn = yield* openConnection()
    yield* Console.log(`Connected: ${conn.id}`)
    return conn
  }),
  // Release (runs on any termination)
  (conn) => Console.log(`Disconnected: ${conn.id}`)
).pipe(
  Stream.flatMap((conn) =>
    Stream.repeatEffect(conn.read())
  )
)
```

---

### Pattern: Stateful Feed with Lifecycle

**Problem:** You need a stream source with explicit start/stop control and status inspection.

**Solution:** Use the `Feed` class.

```typescript
const feed = Feed.make({
  id: "my-feed",
  name: "My Feed",
  interval: "500 millis",
  producer: computeEvent,
  onConnect: Console.log("Started"),
  onDisconnect: Console.log("Stopped"),
})

// Control lifecycle
yield* feed.start()
const status = yield* feed.status  // "running"
yield* feed.stop()
```

---

### Pattern: Event-Driven Feed Control

**Problem:** Control feeds from external systems without direct method calls.

**Solution:** Use the signal API.

```typescript
// Direct signal to feed
yield* feed.signal({ _tag: "Start" })
yield* feed.signal({ _tag: "Stop" })

// Via FeedsManager PubSub
yield* PubSub.publish(manager.commands, { _tag: "StartFeed", id: "my-feed" })
yield* PubSub.publish(manager.commands, { _tag: "StopAll" })
```

---

## Composition Patterns

### Pattern: Merging Multiple Feeds

**Problem:** Combine events from multiple feeds into a single stream.

**Solution:** Use `Stream.merge` or `Stream.mergeAll`.

```typescript
const tempFeed = Feed.make({ id: "temp", ... })
const pressFeed = Feed.make({ id: "press", ... })

// Merge two streams
const combined = Stream.merge(tempFeed.stream, pressFeed.stream)

// Merge many streams
const all = Stream.mergeAll(
  [tempFeed.stream, pressFeed.stream, humidFeed.stream],
  { concurrency: "unbounded" }
)
```

---

### Pattern: Tagged Event Union

**Problem:** Merge heterogeneous event types while preserving type information.

**Solution:** Use Schema.TaggedClass and discriminated unions.

```typescript
class TemperatureEvent extends Schema.TaggedClass<TemperatureEvent>()(
  "TemperatureEvent",
  { celsius: Schema.Number }
) {}

class PressureEvent extends Schema.TaggedClass<PressureEvent>()(
  "PressureEvent",
  { hPa: Schema.Number }
) {}

type SensorEvent = TemperatureEvent | PressureEvent

const merged: Stream<SensorEvent> = Stream.merge(
  tempFeed.stream,
  pressFeed.stream
)

// Pattern match on _tag
yield* merged.pipe(
  Stream.tap((event) => {
    switch (event._tag) {
      case "TemperatureEvent":
        return Console.log(`Temp: ${event.celsius}°C`)
      case "PressureEvent":
        return Console.log(`Press: ${event.hPa} hPa`)
    }
  }),
  Stream.runDrain
)
```

---

### Pattern: Feed Orchestration

**Problem:** Manage multiple feeds with coordinated start/stop.

**Solution:** Use `FeedsManager`.

```typescript
const program = Effect.gen(function* () {
  const manager = yield* FeedsManager

  // Register with tags
  yield* manager.register(tempFeed, { tags: ["sensor"] })
  yield* manager.register(pressFeed, { tags: ["sensor"] })
  yield* manager.register(logFeed, { tags: ["diagnostic"] })

  // Start only sensors
  const sensors = yield* manager.getByTag("sensor")
  yield* Effect.all(sensors.map((f) => f.start()))

  // Later: stop all
  yield* manager.stopAll()
})
```

---

## Error Handling Patterns

### Pattern: Retry on Failure

**Problem:** Retry failed event production.

**Solution:** Use `Effect.retry` in the producer.

```typescript
const feed = Feed.make({
  id: "resilient",
  producer: fetchData.pipe(
    Effect.retry({ times: 3, schedule: Schedule.exponential("100 millis") })
  ),
  ...
})
```

---

### Pattern: Error Recovery in Stream

**Problem:** Continue streaming after recoverable errors.

**Solution:** Use `Stream.catchAll` or `Stream.orElse`.

```typescript
const resilientStream = primaryFeed.stream.pipe(
  Stream.catchAll((error) =>
    Effect.gen(function* () {
      yield* Console.log(`Error: ${error}, switching to fallback`)
      return fallbackFeed.stream
    })
  )
)
```

---

### Pattern: Error Observation

**Problem:** Log errors without stopping the stream.

**Solution:** Use `Stream.tapError`.

```typescript
const observed = feed.stream.pipe(
  Stream.tapError((error) =>
    Console.log(`Error observed: ${error}`)
  )
)
```

---

## Testing Patterns

### Pattern: Deterministic Timing with TestClock

**Problem:** Test time-based streams without waiting.

**Solution:** Use `@effect/vitest` with `TestClock`.

```typescript
import { describe, it, expect } from "@effect/vitest"
import { Effect, Stream, Chunk, TestClock, Fiber } from "effect"

it.effect("emits at intervals", () =>
  Effect.gen(function* () {
    const fiber = yield* ticker("1 second").pipe(
      Stream.take(3),
      Stream.runCollect,
      Effect.fork
    )

    // Advance virtual time
    yield* TestClock.adjust("2 seconds")

    const result = yield* Fiber.join(fiber)
    expect(Chunk.size(result)).toBe(3)
  })
)
```

---

### Pattern: Testing Feed Lifecycle

**Problem:** Verify feed state transitions.

**Solution:** Check status after operations.

```typescript
it.effect("transitions through lifecycle", () =>
  Effect.gen(function* () {
    const feed = Feed.make({ id: "test", producer: Effect.succeed(1), ... })

    expect(yield* feed.status).toBe("idle")

    yield* feed.start()
    expect(yield* feed.status).toBe("running")

    yield* feed.stop()
    expect(yield* feed.status).toBe("stopped")
  })
)
```

---

## Integration Patterns

### Pattern: WebSocket Feed

**Problem:** Stream events from a WebSocket connection.

**Solution:** Use `Stream.async` or `Stream.acquireRelease`.

```typescript
const webSocketFeed = Feed.make({
  id: "ws-feed",
  name: "WebSocket Feed",
  producer: Effect.async<Message, WebSocketError>((emit) => {
    socket.onmessage = (event) => emit(Effect.succeed(JSON.parse(event.data)))
    socket.onerror = (error) => emit(Effect.fail(new WebSocketError(error)))
  }),
  onConnect: Effect.sync(() => socket.connect()),
  onDisconnect: Effect.sync(() => socket.close()),
})
```

---

### Pattern: SSE (Server-Sent Events) Feed

**Problem:** Stream events from an SSE endpoint.

**Solution:** Similar to WebSocket, using EventSource.

```typescript
const sseFeed = Feed.make({
  id: "sse-feed",
  producer: Effect.async<ServerEvent>((emit) => {
    eventSource.onmessage = (event) => {
      emit(Effect.succeed(JSON.parse(event.data)))
    }
  }),
  onConnect: Effect.sync(() => {
    eventSource = new EventSource("/events")
  }),
  onDisconnect: Effect.sync(() => {
    eventSource.close()
  }),
})
```

---

### Pattern: Feeding AG-Grid

**Problem:** Stream data updates to an AG-Grid instance.

**Solution:** Subscribe to feed events and apply transactions.

```typescript
const gridUpdater = Effect.gen(function* () {
  const manager = yield* FeedsManager
  const dataFeed = yield* manager.get(dataFeedId)

  if (Option.isSome(dataFeed)) {
    yield* dataFeed.value.stream.pipe(
      Stream.tap((event) =>
        Effect.sync(() => {
          gridApi.applyTransaction({ update: [event] })
        })
      ),
      Stream.runDrain
    )
  }
})
```

---

### Pattern: Feeding tldraw Shapes

**Problem:** Update tldraw shapes from a feed.

**Solution:** Stream events to shape updates.

```typescript
const shapeUpdater = Effect.gen(function* () {
  yield* positionFeed.stream.pipe(
    Stream.tap((pos) =>
      Effect.sync(() => {
        editor.updateShape({
          id: shapeId,
          type: "geo",
          x: pos.x,
          y: pos.y,
        })
      })
    ),
    Stream.runDrain
  )
})
```

---

## Multi-Source Patterns

### Pattern: Broadcasting to Multiple Consumers

**Problem:** You need multiple consumers to receive the same stream elements.

**Solution:** Use `Stream.broadcast(n, maximumLag)`.

```typescript
// broadcast(numConsumers, maximumLag) returns Stream<[Stream, Stream, ...]>
const program = Effect.scoped(
  stream.pipe(
    Stream.broadcast(3, 16),
    Stream.runHead,
    Effect.flatMap((opt) => {
      const [s1, s2, s3] = opt._tag === "Some" ? opt.value : []

      // Run all consumers in parallel
      return Effect.all([
        s1.pipe(Stream.runCollect),
        s2.pipe(Stream.runFold(0, Math.max)),
        s3.pipe(Stream.runForEach(Console.log)),
      ], { concurrency: "unbounded" })
    })
  )
)
```

**Note:** `maximumLag` controls backpressure — how far ahead the source can get before slowing to match the slowest consumer.

---

### Pattern: Partitioning by Type

**Problem:** Split a merged stream back into typed sub-streams.

**Solution:** Broadcast + filter with type guards.

```typescript
type SensorReading = Temperature | Pressure | Humidity

const partition = (stream: Stream<SensorReading>) =>
  Effect.scoped(
    stream.pipe(
      Stream.broadcast(3, 16),
      Stream.runHead,
      Effect.map((opt) => {
        const [s1, s2, s3] = opt._tag === "Some" ? opt.value : []
        return {
          temperature: s1.pipe(Stream.filter((r): r is Temperature => r._tag === "Temperature")),
          pressure: s2.pipe(Stream.filter((r): r is Pressure => r._tag === "Pressure")),
          humidity: s3.pipe(Stream.filter((r): r is Humidity => r._tag === "Humidity")),
        }
      })
    )
  )
```

---

### Pattern: Timeout with Recovery

**Problem:** Detect when a stream goes silent and emit warnings, then continue monitoring.

**Solution:** Use `Stream.timeoutFail` + `Stream.catchAll` with recursion.

```typescript
const withTimeoutWarning = <A>(
  stream: Stream<A>,
  name: string
): Stream<Either<string, A>> => {
  // IMPORTANT: Stream.timeoutFail signature is (onTimeout, duration)
  // NOT an options object like Effect.timeoutFail!
  const monitored: Stream<Either<string, A>> = stream.pipe(
    Stream.map(Either.right),
    Stream.timeoutFail(() => new Error(`${name} timeout`), "2 seconds"),
    Stream.catchAll((error) =>
      Stream.make(Either.left(`Warning: ${error.message}`)).pipe(
        Stream.concat(monitored) // Recurse to continue monitoring
      )
    )
  )
  return monitored
}

// Usage
yield* withTimeoutWarning(sensorStream, "Sensor").pipe(
  Stream.tap((either) =>
    Either.match(either, {
      onLeft: (warning) => Console.log(warning),
      onRight: (reading) => Console.log(`Got: ${reading}`),
    })
  ),
  Stream.runDrain
)
```

**Warning:** `Stream.timeoutFail` and `Effect.timeoutFail` have DIFFERENT signatures:
- **Effect**: `Effect.timeoutFail({ duration, onTimeout })`
- **Stream**: `Stream.timeoutFail(onTimeout, duration)`

---

### Pattern: Racing Streams

**Problem:** Take whichever stream produces first, cancel the others.

**Solution:** Use `Stream.raceAll`.

```typescript
const fastest = Stream.raceAll([
  primarySource.pipe(Stream.map((v) => ({ source: "primary", value: v }))),
  backupSource.pipe(Stream.map((v) => ({ source: "backup", value: v }))),
])
```

---

## Summary

| Pattern | Problem | Solution |
|---------|---------|----------|
| Lazy Value | Values captured at creation | `Stream.map(() => ...)` or `repeatEffect` |
| Immediate/Delayed | Control first emission timing | `repeat` vs `schedule` |
| Effectful Setup | Setup before streaming | `Stream.unwrap` |
| Guaranteed Cleanup | Cleanup on any termination | `Stream.ensuring` |
| Resource Management | Acquire/release lifecycle | `Stream.acquireRelease` + `flatMap` |
| Stateful Feed | Start/stop/status control | `Feed` class |
| Event-Driven Control | External feed control | `signal()` or PubSub commands |
| Merge Feeds | Combine multiple sources | `Stream.merge` / `mergeAll` |
| Tagged Events | Type-safe heterogeneous merge | `Schema.TaggedClass` |
| Orchestration | Coordinate multiple feeds | `FeedsManager` |
| Retry | Handle transient failures | `Effect.retry` in producer |
| Error Recovery | Continue after errors | `Stream.catchAll` |
| Deterministic Tests | Test timing without waiting | `TestClock` |
| Broadcasting | Multiple consumers same source | `Stream.broadcast(n, lag)` |
| Partitioning | Split by type | Broadcast + type guard filters |
| Timeout Recovery | Detect silence, continue | `timeoutFail` + `catchAll` recursion |
| Racing | First wins | `Stream.raceAll` |
