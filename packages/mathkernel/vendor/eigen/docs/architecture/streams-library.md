# TMNL Streams Library Architecture

> Consolidated from 6 source files in `src/lib/streams/`. See [Source Inventory](#source-inventory) for origins.
> Last updated: 2026-02-09 | Status: Active (ChannelBuilder + ChannelService implemented)

---

## Overview

The TMNL Streams library provides reactive streaming primitives built on Effect, with formal ontological grounding (BFO). It is the foundation for sensor data feeds, real-time dashboards, the IIoT EventDistribution pipeline, and GEOINT track streaming.

```
+---------------------------------------------------------------------------+
|                         Channel (Topology)                                 |
|                  Inlets . Junctions . Outlets . Protocol                   |
|   +---------+     +---------+     +---------+     +---------+             |
|   | Inlet A |---->| Merge   |---->|Partition|---->|Outlet X |             |
|   +---------+     +---------+     +----+----+     +---------+             |
|   +---------+          ^               |          +---------+             |
|   | Inlet B |----------+               +--------->|Outlet Y |             |
|   +---------+                                     +---------+             |
+---------------------------------------------------------------------------+
                              ^
                              | connects
+---------------------------------------------------------------------------+
|                    FeedsManager (Orchestration)                             |
|              Registry . Lifecycle . Event Bus                               |
|   +-------------+  +-------------+  +-------------+                       |
|   |  Feed<A>    |  |  Feed<B>    |  |  Feed<C>    |                       |
|   |  (source)   |  |  (source)   |  |  (source)   |                       |
|   +------+------+  +------+------+  +------+------+                       |
+-----------+----------------+----------------+---------+-------------------+
            |                |                |
            v                v                v
    +----------------------------------------------+
    |           PubSub Command Channel              |
    |     StartFeed . StopFeed . SignalFeed . ...    |
    +----------------------------------------------+
```

### Layer Stack

| Layer | Component | Responsibility | BFO Type |
|-------|-----------|----------------|----------|
| **Primitive** | `ticker`, `pulse`, `counter`, `heartbeat` | Stateless stream factories | -- |
| **Feed** | `Feed<A, E, R>` | Single source with lifecycle | Process |
| **FeedsManager** | `FeedsManager` | Orchestration, registry, event bus | Role-bearing Site |
| **Channel** | `Channel` | Topological multiplexing protocol | GDC (Information Content Entity) |

### Feed vs Channel

| Aspect | Feed | Channel |
|--------|------|---------|
| **Role** | Single source with lifecycle | Topology with protocol |
| **Inputs** | One producer | Multiple inlets |
| **Outputs** | One stream | Multiple outlets |
| **Transforms** | None (raw producer output) | Junctions (filter, map, partition, merge, etc.) |
| **Protocol** | Basic start/stop | Timeout, circuit breaker, backpressure, retry |
| **Composition** | Register in FeedsManager | Wire to other channels |
| **BFO Type** | Process (occurrent) | Generically Dependent Continuant |

---

## Ontological Foundations (BFO)

The library maps to Basic Formal Ontology categories:

```
Entity
+-- Continuant (exists in full at any moment)
|   +-- Independent Continuant
|   |   +-- FeedsManager (Role-bearing Site)
|   +-- Dependent Continuant
|       +-- Specifically Dependent Continuant
|       |   +-- Wire (relation between topology parts)
|       +-- Generically Dependent Continuant
|           +-- Channel (transferable topology + protocol)
|           +-- FeedConfig (disposition)
|           +-- Commands / Events (directive / descriptive ICE)
|
+-- Occurrent (unfolds through time)
    +-- Process
        +-- Feed (has temporal parts: emissions)
```

### Key Mappings

| Construct | BFO Category | Key Insight |
|-----------|-------------|-------------|
| Feed | Process | Unfolds through time, has temporal parts (emissions) |
| FeedConfig | Disposition | Potential for process, realized when Feed starts |
| FeedsManager | Role-bearing Site | Where Feed processes occur; bears Registrar/Controller/Observer roles |
| Channel | Information Content Entity (GDC) | Transferable topology + protocol; can serialize across runtimes |
| Inlet/Outlet | Boundary (Site) | Where data enters/exits the Channel |
| Junction | Site | Where transformation processes occur |
| Wire | Specifically Dependent Continuant | Relation between topology parts; depends on both endpoints |
| Command | Directive ICE | About a process that should occur |
| Event | Descriptive ICE | About a process that did occur |
| Request/Response | Correlated ICE pair | Dialogue unit linked by correlationId |

### Design Implications

1. **Processes are not stored, they occur** -- Don't serialize a Feed. Serialize its FeedConfig (disposition). The process unfolds anew each time.
2. **Sites enable processes** -- FeedsManager and Channel are contexts, not actors.
3. **Information can transfer** -- Channel topologies are GDCs: serialize, transmit, reinstantiate.
4. **Boundaries are real** -- Inlets/Outlets are genuine ontological boundaries where system state changes.
5. **Commands and Events are distinct** -- `OpenChannel` (directive) vs `ChannelOpened` (descriptive).

---

## Stateless Factories

### ticker

Emits timestamps at a fixed interval.

```typescript
function ticker(
  interval: Duration.DurationInput,
  options?: { immediate?: boolean }  // default: true
): Stream.Stream<number>
```

```typescript
const heartbeat = ticker("1 second")
const fast = ticker("100 millis")
const delayed = ticker("1 second", { immediate: false })
```

### pulse

Runs an Effect at a fixed interval, emitting each result.

```typescript
function pulse<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  interval: Duration.DurationInput,
  options?: { immediate?: boolean }
): Stream.Stream<A, E, R>
```

```typescript
const statusStream = pulse(fetchSystemStatus, "5 seconds")
const sensorStream = pulse(readSensor, "100 millis", { immediate: false })
```

### counter

Emits incrementing integers starting from 0.

```typescript
function counter(interval: Duration.DurationInput): Stream.Stream<number>
// 0, 1, 2, 3, ...
```

### heartbeat

Pre-configured ticker at 1-second intervals. Equivalent to `ticker("1 second")`.

### Additional primitives

| Primitive | Signature | Description |
|-----------|-----------|-------------|
| `metronome` | `(bpm) -> Stream<number>` | Emits at beats-per-minute rate |
| `elapsed` | `(interval) -> Stream<number>` | Emits milliseconds since start |
| `backoff` | `(initial, {factor, max}) -> Stream<number>` | Exponential backoff ticker |
| `stopwatch` | `(interval) -> {stream, start, stop, lap, reset}` | Controllable timer |

### Stream Operators

| Operator | Description |
|----------|-------------|
| `delay(duration)` | Delays each emission |
| `debounce(duration)` | Emits after silence |
| `throttle(duration)` | Rate-limits emissions |
| `sample(interval)` | Samples at intervals |
| `buffer(duration)` | Batches into time windows |
| `timeout(duration)` | Fails on timeout |

---

## Feed

A Feed is a **stateful, lifecycle-managed stream source**.

### FeedConfig

```typescript
interface FeedConfig<A, E = never, R = never> {
  readonly id: string
  readonly name: string
  readonly schema?: Schema.Schema<A, unknown>
  readonly producer: Effect.Effect<A, E, R>
  readonly interval?: Duration.DurationInput
  readonly onConnect?: Effect.Effect<void, never, R>
  readonly onDisconnect?: Effect.Effect<void, never, R>
}
```

### FeedState

```typescript
interface FeedState<A, E> {
  readonly status: FeedStatus
  readonly fiber: Option.Option<Fiber.RuntimeFiber<void, E>>
  readonly eventCount: number
  readonly lastEvent: Option.Option<A>
  readonly startedAt: Option.Option<number>
  readonly error: Option.Option<E>
}
```

### FeedStatus & FeedSignal

```typescript
type FeedStatus = "idle" | "running" | "paused" | "stopped"

type FeedSignal =
  | { readonly _tag: "Start" }
  | { readonly _tag: "Stop" }
  | { readonly _tag: "Pause" }
  | { readonly _tag: "Resume" }
```

### Feed Lifecycle

```
idle --> running --> stopped
            |
          paused (future)
```

- **idle**: Created but never started
- **running**: Actively producing events
- **stopped**: Terminated (cleanup complete)

### Feed Methods

```typescript
class Feed<A, E = never, R = never> {
  static make<A, E, R>(config: FeedConfig<A, E, R>): Feed<A, E, R>

  // Lifecycle
  start(): Effect<void, E, R>
  stop(): Effect<void>
  signal(sig: FeedSignal): Effect<void, E, R>

  // State
  get status(): Effect<FeedStatus>
  get state(): Effect<FeedState<A, E>>
  get isRunning(): Effect<boolean>

  // Stream access
  get stream(): Stream<A, E, R>
  subscribe(): Effect<Queue.Dequeue<A>, never, Scope>

  // Managed execution
  run(handler, options?): Effect<void, E, R | Scope>
}
```

### Branded FeedId

Type-safe heterogeneous storage:

```typescript
const tempId: FeedId<TemperatureReading> = yield* manager.register(tempFeed)
const pressId: FeedId<PressureReading> = yield* manager.register(pressFeed)

// Compiler enforces type safety
const feed = yield* manager.get(tempId)  // Option<Feed<TemperatureReading>>
```

---

## FeedsManager Service

Orchestrates a collection of Feeds with centralized lifecycle control.

### Interface

```typescript
interface FeedsManagerService {
  // Registration
  readonly register: <A, E, R>(
    feed: Feed<A, E, R>,
    options?: { tags?: readonly string[] }
  ) => Effect<FeedId<A>>
  readonly unregister: (id: string) => Effect<void>

  // Retrieval
  readonly get: <A>(id: FeedId<A>) => Effect<Option<Feed<A>>>
  readonly getById: (id: string) => Effect<Option<Feed<unknown>>>
  readonly getByTag: (tag: string) => Effect<ReadonlyArray<Feed<unknown>>>
  readonly listIds: () => Effect<ReadonlyArray<string>>
  readonly getStatuses: () => Effect<HashMap<string, FeedStatus>>

  // Lifecycle
  readonly start: (id: string) => Effect<void>
  readonly stop: (id: string) => Effect<void>
  readonly startAll: () => Effect<void>
  readonly stopAll: () => Effect<void>
  readonly signal: (id: string, sig: FeedSignal) => Effect<void>

  // Event bus
  readonly commands: PubSub<FeedCommand>
  readonly events: PubSub<FeedManagerEvent>
  readonly subscribeEvents: () => Effect<Queue.Dequeue<FeedManagerEvent>, never, Scope>
}
```

### FeedCommand

```typescript
type FeedCommand =
  | { _tag: "RegisterFeed"; id: string }
  | { _tag: "UnregisterFeed"; id: string }
  | { _tag: "StartFeed"; id: string }
  | { _tag: "StopFeed"; id: string }
  | { _tag: "StartAll" }
  | { _tag: "StopAll" }
  | { _tag: "SignalFeed"; id: string; signal: FeedSignal }
```

### FeedManagerEvent

```typescript
type FeedManagerEvent =
  | { _tag: "FeedRegistered"; id: string; name: string }
  | { _tag: "FeedUnregistered"; id: string }
  | { _tag: "FeedStarted"; id: string }
  | { _tag: "FeedStopped"; id: string }
  | { _tag: "FeedError"; id: string; error: unknown }
```

### Layers

```typescript
const FeedsManagerLive: Layer.Layer<FeedsManager>
const FeedsManagerScoped: Layer.Layer<FeedsManager, never, Scope>
```

---

## Channel Architecture

### Identity Types

All identifiers are branded strings for type safety:

```typescript
const ChannelId = Schema.String.pipe(Schema.brand("ChannelId"))
const InletId = Schema.String.pipe(Schema.brand("InletId"))
const OutletId = Schema.String.pipe(Schema.brand("OutletId"))
const JunctionId = Schema.String.pipe(Schema.brand("JunctionId"))
const WireId = Schema.String.pipe(Schema.brand("WireId"))
const CorrelationId = Schema.String.pipe(Schema.brand("CorrelationId"))
```

### Topology Components

**Inlet** -- Input port that accepts streams or feeds:

```typescript
class Inlet extends Schema.TaggedClass<Inlet>()("Inlet", {
  id: InletId,
  name: Schema.String,
  channelId: ChannelId,
  schema: Schema.optional(Schema.Unknown),  // Validation schema
  connected: Schema.Boolean,
  sourceId: Schema.optional(Schema.String),
})
```

**Outlet** -- Output port that provides streams to subscribers:

```typescript
class Outlet extends Schema.TaggedClass<Outlet>()("Outlet", {
  id: OutletId,
  name: Schema.String,
  channelId: ChannelId,
  schema: Schema.optional(Schema.Unknown),
  broadcast: Schema.Boolean,
  maxLag: Schema.Number,
  subscriberCount: Schema.Number,
})
```

**Junction** -- Transform point in the topology:

```typescript
const JunctionKind = Schema.Literal(
  "filter", "map", "flatMap", "partition",
  "merge", "broadcast", "buffer",
  "throttle", "debounce", "timeout"
)

class Junction extends Schema.TaggedClass<Junction>()("Junction", {
  id: JunctionId,
  name: Schema.String,
  channelId: ChannelId,
  kind: JunctionKind,
  config: Schema.optional(Schema.Unknown),
})
```

**Wire** -- Connection between ports and junctions:

```typescript
class Wire extends Schema.TaggedClass<Wire>()("Wire", {
  id: WireId,
  channelId: ChannelId,
  from: Schema.Union(InletId, JunctionId),
  to: Schema.Union(OutletId, JunctionId),
  active: Schema.Boolean,
})
```

### Protocol Configuration

**BackpressureConfig**:

| Strategy | Behavior | Use Case |
|----------|----------|----------|
| `block` | Producer waits | Lossless, latency-tolerant |
| `drop-oldest` | Discard stale data | Real-time, latest-wins |
| `drop-newest` | Discard incoming | Preserve history |
| `error` | Fail stream | Strict processing |

```typescript
class BackpressureConfig extends Schema.TaggedClass<BackpressureConfig>()("BackpressureConfig", {
  strategy: Schema.Literal("block", "drop-oldest", "drop-newest", "error"),
  capacity: Schema.Number,
})
```

**CircuitBreakerConfig**:

```
     +----------+
     |  closed  |<-------------------+
     +----+-----+                    |
          | failure >= threshold     | success in half-open
          v                          |
     +----------+              +-----+-----+
     |   open   |--resetAfter->| half-open |
     +----------+              +-----------+
                                     | failure -> back to open
```

```typescript
class CircuitBreakerConfig extends Schema.TaggedClass<CircuitBreakerConfig>()("CircuitBreakerConfig", {
  threshold: Schema.Number,
  resetAfter: Schema.String,    // DurationInput
  state: Schema.Literal("closed", "open", "half-open"),
  failureCount: Schema.Number,
})
```

**TimeoutConfig**:

| Behavior | Action | Event |
|----------|--------|-------|
| `fail` | Close channel with error | `ChannelFaulted` |
| `warn` | Emit warning, continue | `TimeoutOccurred` |
| `skip` | Silently continue | None |

```typescript
class TimeoutConfig extends Schema.TaggedClass<TimeoutConfig>()("TimeoutConfig", {
  duration: Schema.String,
  behavior: Schema.Literal("fail", "warn", "skip"),
})
```

**RetryConfig**:

| Backoff | Pattern | Example (100ms initial) |
|---------|---------|-------------------------|
| `fixed` | Same delay | 100, 100, 100, 100 |
| `exponential` | Double each time | 100, 200, 400, 800 |
| `fibonacci` | Fib sequence | 100, 100, 200, 300, 500 |

```typescript
class RetryConfig extends Schema.TaggedClass<RetryConfig>()("RetryConfig", {
  times: Schema.Number,
  backoff: Schema.Literal("fixed", "exponential", "fibonacci"),
  initialDelay: Schema.String,
  maxDelay: Schema.optional(Schema.String),
})
```

**ChannelProtocol** (bundle):

```typescript
class ChannelProtocol extends Schema.TaggedClass<ChannelProtocol>()("ChannelProtocol", {
  timeout: Schema.optional(TimeoutConfig),
  circuitBreaker: Schema.optional(CircuitBreakerConfig),
  backpressure: Schema.optional(BackpressureConfig),
  retry: Schema.optional(RetryConfig),
})
```

### Channel Commands

| Command | Purpose | Key Fields |
|---------|---------|------------|
| `OpenChannel` | Start the channel | `id` |
| `CloseChannel` | Stop the channel | `id`, `reason?` |
| `ConnectInlet` | Attach source to inlet | `channelId`, `inletId`, `sourceId` |
| `DisconnectInlet` | Detach source | `channelId`, `inletId` |
| `SubscribeOutlet` | Add subscriber to outlet | `channelId`, `outletId`, `subscriberId` |
| `UnsubscribeOutlet` | Remove subscriber | `channelId`, `outletId`, `subscriberId` |
| `ResetCircuitBreaker` | Force circuit to closed | `channelId` |

### Channel Events

| Event | Trigger | Key Fields |
|-------|---------|------------|
| `ChannelOpened` | Channel started | `channelId`, `timestamp` |
| `ChannelClosed` | Channel stopped | `channelId`, `reason?`, `timestamp` |
| `ChannelFaulted` | Unrecoverable error | `channelId`, `error`, `timestamp` |
| `InletConnected` | Source attached | `channelId`, `inletId`, `sourceId`, `timestamp` |
| `InletDisconnected` | Source detached | `channelId`, `inletId`, `timestamp` |
| `OutletSubscribed` | Subscriber added | `channelId`, `outletId`, `subscriberId`, `timestamp` |
| `OutletUnsubscribed` | Subscriber removed | `channelId`, `outletId`, `subscriberId`, `timestamp` |
| `CircuitBreakerTripped` | Circuit opened | `channelId`, `failureCount`, `timestamp` |
| `CircuitBreakerReset` | Circuit closed | `channelId`, `timestamp` |
| `TimeoutOccurred` | Silence detected | `channelId`, `inletId?`, `duration`, `timestamp` |
| `BackpressureEngaged` | Buffer pressure | `channelId`, `strategy`, `bufferSize`, `timestamp` |

### Bidirectional Patterns

For request/response communication (NATS-style):

**ChannelRequest** -- Factory function with typed payload:

```typescript
const ChannelRequest = <A, I, R>(payloadSchema: Schema.Schema<A, I, R>) =>
  Schema.TaggedStruct("ChannelRequest", {
    correlationId: CorrelationId,
    channelId: ChannelId,
    payload: payloadSchema,
    replyTo: Schema.optional(OutletId),
    timestamp: Schema.Number,
    ttl: Schema.optional(Schema.Number),
  })
```

**ChannelResponse** -- Factory function with typed payload:

```typescript
const ChannelResponse = <A, I, R>(payloadSchema: Schema.Schema<A, I, R>) =>
  Schema.TaggedStruct("ChannelResponse", {
    correlationId: CorrelationId,
    channelId: ChannelId,
    payload: payloadSchema,
    final: Schema.Boolean,       // true if last response (for streaming)
    timestamp: Schema.Number,
  })
```

**ChannelAck / ChannelNack** -- Reliable delivery confirmation:

```typescript
class ChannelAck extends Schema.TaggedClass<ChannelAck>()("ChannelAck", {
  correlationId: CorrelationId,
  channelId: ChannelId,
  timestamp: Schema.Number,
})

class ChannelNack extends Schema.TaggedClass<ChannelNack>()("ChannelNack", {
  correlationId: CorrelationId,
  channelId: ChannelId,
  reason: Schema.String,
  timestamp: Schema.Number,
})
```

### Channel State Management

**ChannelTopology** -- Complete graph:

```typescript
class ChannelTopology extends Schema.TaggedClass<ChannelTopology>()("ChannelTopology", {
  inlets: Schema.Array(Inlet),
  outlets: Schema.Array(Outlet),
  junctions: Schema.Array(Junction),
  wires: Schema.Array(Wire),
})
```

**ChannelMetrics** -- Runtime statistics:

```typescript
class ChannelMetrics extends Schema.TaggedClass<ChannelMetrics>()("ChannelMetrics", {
  messagesIn: Schema.Number,
  messagesOut: Schema.Number,
  bytesIn: Schema.Number,
  bytesOut: Schema.Number,
  errors: Schema.Number,
  latencyMs: Schema.Number,
  uptime: Schema.Number,
})
```

**ChannelState** -- Complete snapshot:

```typescript
class ChannelState extends Schema.TaggedClass<ChannelState>()("ChannelState", {
  id: ChannelId,
  name: Schema.String,
  status: ChannelStatus,       // "idle" | "open" | "closed" | "faulted"
  topology: ChannelTopology,
  protocol: ChannelProtocol,
  metrics: ChannelMetrics,
  createdAt: Schema.Number,
  openedAt: Schema.optional(Schema.Number),
  closedAt: Schema.optional(Schema.Number),
})
```

Channel lifecycle: `idle --OpenChannel--> open --CloseChannel--> closed` (or `open --error--> faulted`)

### Runtime Status

ChannelBuilder and ChannelService are implemented and production-wired:

| Surface | File |
|---------|------|
| ChannelBuilder | `constructs/ChannelBuilder.ts` |
| ChannelService | `constructs/ChannelService.ts` |
| IIoT ingestion adapter | `src/lib/iiot/adapters/ingestion-channel.ts` |
| GEOINT track bridge | `src/lib/geoint/streaming/TrackStoreChannelBridge.ts` |

Protocol enforcement (retry, timeout, circuit-breaker, backpressure) is covered by integration tests.

---

## Pattern Catalog

### Stream Creation

| Pattern | Problem | Solution |
|---------|---------|----------|
| Lazy Value Emission | Values captured at creation time | `Stream.repeatEffect(Effect.sync(() => value()))` |
| Immediate vs Delayed | Control first emission timing | `ticker("1s", { immediate: true/false })` |
| Effectful Setup | Setup logic before streaming | `Stream.unwrap(Effect.gen(...))` |

### Lifecycle

| Pattern | Problem | Solution |
|---------|---------|----------|
| Guaranteed Cleanup | Cleanup regardless of termination | `Stream.ensuring(cleanup)` |
| Resource Management | Acquire/release with stream | `Stream.acquireRelease(acquire, release)` + `flatMap` |
| Stateful Feed | Start/stop/status control | `Feed.make({...})` |
| Event-Driven Control | External feed control | `feed.signal()` or PubSub commands |

### Composition

| Pattern | Problem | Solution |
|---------|---------|----------|
| Merge Feeds | Combine multiple sources | `Stream.merge(s1, s2)` or `Stream.mergeAll([...])` |
| Tagged Events | Type-safe heterogeneous merge | `Schema.TaggedClass` discriminated unions |
| Feed Orchestration | Coordinate multiple feeds | `FeedsManager` with tags |
| Broadcasting | Multiple consumers same source | `Stream.broadcast(n, maximumLag)` |
| Partitioning | Split by type | Broadcast + type guard filters |

### Error Handling

| Pattern | Problem | Solution |
|---------|---------|----------|
| Retry on Failure | Transient errors | `Effect.retry` in producer |
| Error Recovery | Continue after errors | `Stream.catchAll` / `Stream.orElse` |
| Error Observation | Log without stopping | `Stream.tapError` |
| Timeout Recovery | Detect silence, continue | `Stream.timeoutFail` + `Stream.catchAll` recursion |
| Racing | First source wins | `Stream.raceAll` |

### API Gotcha

`Stream.timeoutFail` and `Effect.timeoutFail` have **different signatures**:
- **Effect**: `Effect.timeoutFail({ duration, onTimeout })`
- **Stream**: `Stream.timeoutFail(onTimeout, duration)` -- positional args

### IIoT Integration

The ChannelService is used by EventDistribution for real-time data:

```
4 channels with bounded backpressure:
  readings channel      (maxLag: 10,000) -- High-frequency sensor data
  alarms channel        (maxLag: 1,000)  -- Alarm lifecycle events
  equipment channel     (maxLag: 1,000)  -- Equipment state changes
  invalidations channel (maxLag: 1,000)  -- Cache invalidation signals

Flow: PubSub -> connectStream -> ChannelService inlet -> broadcast outlet -> subscriber streams
```

See [Stream Processing](stream-processing.md) for the full IIoT ingestion pipeline architecture.

---

## Testing

### Deterministic Timing

```typescript
import { it } from "@effect/vitest"

it.effect("emits at intervals", () =>
  Effect.gen(function* () {
    const fiber = yield* ticker("1 second").pipe(
      Stream.take(3),
      Stream.runCollect,
      Effect.fork
    )
    yield* TestClock.adjust("2 seconds")
    const result = yield* Fiber.join(fiber)
    expect(Chunk.size(result)).toBe(3)
  })
)
```

### Feed Lifecycle

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

### Running Tests

```bash
bun vitest run src/lib/streams/__tests__/
bun run src/lib/streams/challenges/playground.ts    # Interactive challenges
bun run src/lib/streams/challenges/playground.ts 1  # Specific challenge
```

---

## File Structure

```
src/lib/streams/
+-- index.ts              # Public exports
+-- primitives/
|   +-- index.ts          # Primitive exports
|   +-- time.ts           # Time-based primitives
+-- constructs/
|   +-- index.ts          # Construct exports
|   +-- Feed.ts           # Feed class (single source lifecycle)
|   +-- FeedsManager.ts   # FeedsManager service (orchestration)
|   +-- Channel.ts        # Channel schemas (topology protocol)
|   +-- ChannelBuilder.ts # Fluent API for constructing channels
|   +-- ChannelService.ts # Effect service for runtime management
+-- challenges/           # Interactive playground (6 challenges)
+-- docs/                 # Source documentation (consolidated here)
+-- atoms/                # Fermion atom bindings
+-- __tests__/            # Vitest specs
```

---

## Related Documents

- [Stream Processing](stream-processing.md) -- IIoT ingestion pipeline (TopicRouter, AlarmDetector, EventDistribution)
- [WebSocket Realtime](websocket-realtime.md) -- RPC streaming subscriptions
- [Holonet Transport](holonet-nats.md) -- NATS transport architecture
- [Concurrency Model](concurrency-model.md) -- Effect fiber scheduling

---

## Source Inventory

| Source File | Lines | Content |
|-------------|-------|---------|
| `src/lib/streams/README.md` | 253 | Library overview, architecture diagram, API summary |
| `src/lib/streams/docs/ONTOLOGY.md` | 408 | BFO categorical mapping for all constructs |
| `src/lib/streams/docs/PATTERNS.md` | 625 | Problem-solution pattern catalog (16 patterns) |
| `src/lib/streams/docs/CHANNEL.md` | 1,075 | Channel topology protocol specification |
| `src/lib/streams/docs/API.md` | 862 | Complete API reference (factories, Feed, FeedsManager, Channel schemas) |
| `src/lib/streams/docs/TUTORIAL.md` | 626 | 7-chapter step-by-step tutorial |
| **Total** | **3,849** | |
