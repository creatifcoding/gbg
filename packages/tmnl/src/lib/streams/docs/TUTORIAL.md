# TMNL Streams — Tutorial

A step-by-step guide to building reactive streaming applications with Effect.

---

## Chapter 1: The Heartbeat

Every streaming system starts with a simple question: *how do I emit values over time?*

Let's begin with the most fundamental stream — a heartbeat that emits timestamps every second.

### The Naive Approach (Don't Do This)

```typescript
// WRONG — timestamp captured once at creation
const ts = Date.now()
const stream = Stream.repeat(Stream.succeed(ts), Schedule.spaced("1 second"))
// This emits the SAME timestamp forever!
```

### The Correct Approach

```typescript
import { Stream, Effect, Schedule } from "effect"

const heartbeat = Stream.make(0).pipe(
  Stream.repeat(Schedule.spaced("1 second")),
  Stream.map(() => Date.now())  // ← Evaluated lazily at emission time
)
```

**Key insight:** `Stream.map(() => Date.now())` creates a *thunk* — a deferred computation that runs each time an element is emitted.

### Using the Factory

The library provides this as a ready-made factory:

```typescript
import { ticker } from "@/lib/streams"

const heartbeat = ticker("1 second")
const fastTicker = ticker("100 millis")
const delayedTicker = ticker("1 second", { immediate: false })
```

**Try it:**

```bash
bun run src/lib/streams/playground.ts 1
```

---

## Chapter 2: The Cancellable Feed

Real-world streams need lifecycle management. What happens when:

- The user navigates away?
- An error occurs?
- You need to stop a stream programmatically?

### The Problem

```typescript
// A stream that never ends...
const infiniteEvents = Stream.repeatEffect(fetchEvent)

// How do we clean up when interrupted?
```

### The Solution: Stream.ensuring

```typescript
import { Stream, Effect, Console } from "effect"

const feed = Stream.unwrap(
  Effect.gen(function* () {
    // SETUP: runs once when stream starts
    yield* Console.log("Connected")

    return Stream.repeatEffect(
      Effect.gen(function* () {
        // Produce events...
        return { id: 1, data: "event" }
      })
    ).pipe(
      // TEARDOWN: runs on success, failure, OR interruption
      Stream.ensuring(Console.log("Disconnected"))
    )
  })
)
```

**The magic of `Stream.ensuring`:** It runs your cleanup effect *no matter how the stream ends* — even if a fiber is interrupted mid-flight.

### Stream.unwrap: The Effect-to-Stream Bridge

`Stream.unwrap` is your friend when you need:

1. Setup work before streaming (connect to WebSocket, open file)
2. Closure state that persists across emissions
3. Clean separation of concerns

```typescript
Stream.unwrap(
  Effect.gen(function* () {
    // Setup phase (Effect)
    const connection = yield* connect()
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

**Try it:**

```bash
bun run src/lib/streams/playground.ts 2
```

---

## Chapter 3: The Feed Abstraction

Repeatedly writing `Stream.unwrap` + `ensuring` gets tedious. What if we had a reusable abstraction?

### Introducing Feed

A `Feed` is a **stateful, lifecycle-managed stream source**.

```typescript
import { Feed } from "@/lib/streams"

const sensorFeed = Feed.make({
  id: "temp-sensor",
  name: "Temperature Sensor",
  interval: "500 millis",
  producer: Effect.gen(function* () {
    const celsius = yield* Random.nextIntBetween(18, 28)
    return { celsius, timestamp: Date.now() }
  }),
  onConnect: Console.log("Sensor connected"),
  onDisconnect: Console.log("Sensor disconnected"),
})
```

### Feed Lifecycle

A Feed has explicit state:

```
idle → running → stopped
```

You control it:

```typescript
// Start producing events
yield* sensorFeed.start()

// Check status
const status = yield* sensorFeed.status  // "running"

// Stop gracefully
yield* sensorFeed.stop()
```

### Event-Driven Control

Feeds respond to signals:

```typescript
yield* sensorFeed.signal({ _tag: "Start" })
yield* sensorFeed.signal({ _tag: "Stop" })
```

This enables external systems to control feed lifecycle without direct method calls.

### Consuming Feed Events

Three ways to consume:

```typescript
// 1. Direct stream access
yield* sensorFeed.stream.pipe(
  Stream.take(10),
  Stream.runForEach((event) => Console.log(event))
)

// 2. PubSub subscription (multiple consumers)
const queue = yield* sensorFeed.subscribe()
const event = yield* Queue.take(queue)

// 3. Managed runner
yield* sensorFeed.run(
  (event) => Console.log(event),
  { duration: "10 seconds" }
)
```

**Try it:**

```bash
bun run src/lib/streams/playground.ts 3
```

---

## Chapter 4: The FeedsManager

When you have multiple feeds, you need orchestration:

- Start/stop all feeds together
- Query feed statuses
- Route commands to specific feeds
- React to feed events

### Introducing FeedsManager

```typescript
import { FeedsManager, FeedsManagerLive } from "@/lib/streams"

const program = Effect.gen(function* () {
  const manager = yield* FeedsManager

  // Register feeds
  const tempId = yield* manager.register(temperatureFeed, { tags: ["sensor"] })
  const pressId = yield* manager.register(pressureFeed, { tags: ["sensor"] })

  // Start all
  yield* manager.startAll()

  // Query
  const statuses = yield* manager.getStatuses()
  const sensorFeeds = yield* manager.getByTag("sensor")

  // Stop all
  yield* manager.stopAll()
})

Effect.runPromise(program.pipe(Effect.provide(FeedsManagerLive)))
```

### Type-Safe Heterogeneous Storage

The manager stores feeds of different types safely:

```typescript
// Branded IDs carry type information
const tempId: FeedId<TemperatureReading> = yield* manager.register(tempFeed)
const pressId: FeedId<PressureReading> = yield* manager.register(pressFeed)

// Type-safe retrieval
const maybeFeed = yield* manager.get(tempId)
// maybeFeed: Option<Feed<TemperatureReading>>
```

### PubSub Command Channel

External systems can control feeds via PubSub:

```typescript
// Send commands
yield* PubSub.publish(manager.commands, { _tag: "StopFeed", id: "sensor-01" })
yield* PubSub.publish(manager.commands, { _tag: "StartAll" })

// Subscribe to events
const events = yield* manager.subscribeEvents()
// FeedRegistered, FeedStarted, FeedStopped, FeedError
```

**Try it:**

```bash
bun run src/lib/streams/playground.ts 4
```

---

## Chapter 5: Putting It Together

Let's build a complete sensor monitoring system:

```typescript
import { Effect, Console, Duration, Schema, pipe, Stream } from "effect"
import { Feed, FeedsManager, FeedsManagerLive, FeedId } from "@/lib/streams"

// Define sensor schemas
class TemperatureReading extends Schema.TaggedClass<TemperatureReading>()(
  "TemperatureReading",
  { sensorId: Schema.String, celsius: Schema.Number, timestamp: Schema.Number }
) {}

class PressureReading extends Schema.TaggedClass<PressureReading>()(
  "PressureReading",
  { sensorId: Schema.String, hPa: Schema.Number, timestamp: Schema.Number }
) {}

// Create feeds
const tempFeed = Feed.make({
  id: "temp-01",
  name: "Temperature Sensor",
  schema: TemperatureReading,
  interval: "1 second",
  producer: Effect.succeed(new TemperatureReading({
    sensorId: "temp-01",
    celsius: 22,
    timestamp: Date.now()
  })),
  onConnect: Console.log("[Temp] Connected"),
  onDisconnect: Console.log("[Temp] Disconnected"),
})

const pressFeed = Feed.make({
  id: "press-01",
  name: "Pressure Sensor",
  schema: PressureReading,
  interval: "2 seconds",
  producer: Effect.succeed(new PressureReading({
    sensorId: "press-01",
    hPa: 1013,
    timestamp: Date.now()
  })),
  onConnect: Console.log("[Press] Connected"),
  onDisconnect: Console.log("[Press] Disconnected"),
})

// Main program
const monitoringSystems = Effect.gen(function* () {
  const manager = yield* FeedsManager

  // Register all sensors
  yield* manager.register(tempFeed, { tags: ["sensor", "environmental"] })
  yield* manager.register(pressFeed, { tags: ["sensor", "environmental"] })

  // Subscribe to manager events
  const eventQueue = yield* manager.subscribeEvents()
  yield* pipe(
    Stream.fromQueue(eventQueue),
    Stream.tap((e) => Console.log(`[Event] ${e._tag}`)),
    Stream.runDrain,
    Effect.fork
  )

  // Start all sensors
  yield* manager.startAll()

  // Run for 10 seconds
  yield* Effect.sleep(Duration.seconds(10))

  // Graceful shutdown
  yield* manager.stopAll()
})

// Run
pipe(
  monitoringSystem,
  Effect.scoped,
  Effect.provide(FeedsManagerLive),
  Effect.runPromise
)
```

---

## Summary

| Concept | Purpose | Use When |
|---------|---------|----------|
| `ticker`/`pulse` | Stateless stream factories | Simple periodic emissions |
| `Feed` | Stateful lifecycle manager | Need start/stop/status |
| `FeedsManager` | Orchestration kernel | Multiple feeds, coordination |
| `Stream.ensuring` | Guaranteed cleanup | Resource management |
| `Stream.unwrap` | Effect → Stream bridge | Setup before streaming |
| Branded `FeedId<A>` | Type-safe registry | Heterogeneous feeds |
| PubSub commands | Event-driven control | Decoupled architecture |

---

## Chapter 6: Multi-Source Patterns

Real systems rarely have just one data source. Challenge 6 introduces patterns for combining, partitioning, and protecting multiple streams.

### Merging Multiple Sources

When sensors of different types need unified processing:

```typescript
import { Stream } from "effect"

const temperature$ = Stream.repeatEffect(readTemperature)
const pressure$ = Stream.repeatEffect(readPressure)
const humidity$ = Stream.repeatEffect(readHumidity)

// Merge all into a single stream
const allSensors$ = Stream.mergeAll(
  [temperature$, pressure$, humidity$],
  { concurrency: "unbounded" }
)
```

**Key insight:** `Stream.mergeAll` combines streams in arrival order, not round-robin. Events interleave based on when they're emitted.

### Partitioning by Type

After merging, you often need to split by discriminator:

```typescript
// Broadcast to 3 consumers
const partitioned = yield* Stream.broadcast(allSensors$, 3, 16)
const [s1, s2, s3] = partitioned

// Filter each stream by type
const temperature$ = s1.pipe(Stream.filter((r): r is Temperature => r._tag === "Temperature"))
const pressure$ = s2.pipe(Stream.filter((r): r is Pressure => r._tag === "Pressure"))
const humidity$ = s3.pipe(Stream.filter((r): r is Humidity => r._tag === "Humidity"))
```

**Pattern:** `broadcast(n, maxLag)` → filter each branch

### Timeout with Recovery

Unreliable sources need protection:

```typescript
const resilientSensor = sensorStream.pipe(
  // Fail after 2 seconds of silence
  Stream.timeoutFail(
    () => new Error("Sensor timeout"),
    "2 seconds"
  ),
  // Recover by restarting after delay
  Stream.catchAll(() =>
    Stream.fromEffect(
      Effect.gen(function* () {
        yield* Console.log("Recovering...")
        yield* Effect.sleep("500 millis")
        return { _tag: "Recovery", timestamp: Date.now() }
      })
    ).pipe(Stream.concat(sensorStream))
  )
)
```

**⚠️ API Note:** `Stream.timeoutFail(onTimeout, duration)` — positional args, not object form like `Effect.timeoutFail`.

**Try it:**

```bash
bun run src/lib/streams/challenges/playground.ts 6
```

---

## Chapter 7: The Channel Abstraction (Preview)

Feeds manage single sources. But what about:

- **Multi-input → Multi-output** routing?
- **Backpressure** across the entire pipeline?
- **Circuit breakers** for fault isolation?
- **Request/Response** patterns (NATS-style)?

### Introducing Channel

A **Channel** is a *topological multiplexing protocol* — it defines how data flows through a graph of inlets, junctions, and outlets.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Channel (Topology)                               │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐          │
│   │ Inlet A │────►│ Merge   │────►│Partition│────►│Outlet X │          │
│   └─────────┘     └─────────┘     └────┬────┘     └─────────┘          │
│   ┌─────────┐          ▲               │          ┌─────────┐          │
│   │ Inlet B │──────────┘               └─────────►│Outlet Y │          │
│   └─────────┘                                     └─────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Feed vs Channel:**

| Aspect | Feed | Channel |
|--------|------|---------|
| Topology | Single source | Graph (inlets → junctions → outlets) |
| Flow | Unidirectional | Multi-directional, bidirectional |
| Protocol | Lifecycle only | Backpressure, circuit breaker, timeout, retry |
| Composition | Register in manager | Wire to other channels |

### Channel Components

**Inlet** — Input port that accepts streams/feeds:
```typescript
class Inlet {
  id: InletId
  name: string
  channelId: ChannelId
  schema?: Schema<A>     // Validate incoming data
  connected: boolean
  sourceId?: string      // Connected feed ID
}
```

**Outlet** — Output port that broadcasts to subscribers:
```typescript
class Outlet {
  id: OutletId
  name: string
  channelId: ChannelId
  broadcast: boolean     // Multi-subscriber mode
  maxLag: number         // Backpressure threshold
  subscriberCount: number
}
```

**Junction** — Transform point (filter, map, merge, etc.):
```typescript
class Junction {
  id: JunctionId
  kind: "filter" | "map" | "merge" | "partition" | ...
  config?: unknown       // Kind-specific configuration
}
```

**Wire** — Connection between components:
```typescript
class Wire {
  id: WireId
  from: InletId | JunctionId
  to: OutletId | JunctionId
  active: boolean
}
```

### Protocol Configuration

Channels carry resilience patterns as first-class configuration:

```typescript
class ChannelProtocol {
  timeout?: TimeoutConfig       // { duration, behavior: "fail"|"warn"|"skip" }
  circuitBreaker?: CircuitBreakerConfig  // { threshold, resetAfter, state }
  backpressure?: BackpressureConfig      // { strategy, capacity }
  retry?: RetryConfig           // { times, backoff, initialDelay }
}
```

### Bidirectional: Request/Response

NATS-style correlation for RPC patterns:

```typescript
// Define typed request schema
const QueryRequest = ChannelRequest(
  Schema.Struct({ query: Schema.String, limit: Schema.Number })
)

// Define typed response schema
const QueryResponse = ChannelResponse(
  Schema.Array(Schema.Struct({ id: Schema.String, score: Schema.Number }))
)

// The correlationId links request → response
const request = new QueryRequest({
  correlationId: CorrelationId("req-001"),
  channelId: myChannelId,
  payload: { query: "effect streams", limit: 10 },
  replyTo: myOutletId,
  timestamp: Date.now(),
})
```

### Status: Schema-Only (Implementation Pending)

The Channel schemas define the complete protocol. Implementation (`ChannelBuilder`, `ChannelService`) follows in a future iteration.

**What's ready:**
- All identity types (branded strings)
- All topology components (TaggedClasses)
- All protocol configuration schemas
- All commands and events
- Bidirectional request/response patterns
- State management schemas

**Coming next:**
- `ChannelBuilder` — Fluent API for constructing channels
- `ChannelService` — Effect service for runtime management
- Feed → Channel integration

**Read more:** [Channel Schema Reference](./CHANNEL.md)

---

## Summary

| Concept | Purpose | Use When |
|---------|---------|----------|
| `ticker`/`pulse` | Stateless stream factories | Simple periodic emissions |
| `Feed` | Stateful lifecycle manager | Need start/stop/status |
| `FeedsManager` | Orchestration kernel | Multiple feeds, coordination |
| `Channel` | Topological protocol | Multi-input/output, resilience |
| `Stream.ensuring` | Guaranteed cleanup | Resource management |
| `Stream.unwrap` | Effect → Stream bridge | Setup before streaming |
| `Stream.mergeAll` | Combine multiple streams | Multi-source fusion |
| `Stream.broadcast` | Fan-out to consumers | Parallel processing |
| `Stream.timeoutFail` | Timeout protection | Unreliable sources |
| Branded `FeedId<A>` | Type-safe registry | Heterogeneous feeds |
| PubSub commands | Event-driven control | Decoupled architecture |

---

## Next Steps

- Read the [API Reference](./API.md) for complete signatures
- Explore the [Patterns Catalog](./PATTERNS.md) for common solutions
- Study the [Channel Schema Reference](./CHANNEL.md) for topology design
- Read the [Ontology Guide](./ONTOLOGY.md) for BFO alignment
- Run the playground to experiment interactively
