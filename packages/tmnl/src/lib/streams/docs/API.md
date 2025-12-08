# TMNL Streams — API Reference

Complete API documentation for the TMNL Streams library.

---

## Table of Contents

- [Stateless Factories](#stateless-factories)
  - [ticker](#ticker)
  - [pulse](#pulse)
  - [counter](#counter)
  - [heartbeat](#heartbeat)
- [Feed Class](#feed-class)
  - [FeedConfig](#feedconfig)
  - [FeedState](#feedstate)
  - [FeedStatus](#feedstatus)
  - [FeedSignal](#feedsignal)
  - [Feed Methods](#feed-methods)
- [FeedsManager Service](#feedsmanager-service)
  - [FeedId](#feedid)
  - [FeedCommand](#feedcommand)
  - [FeedManagerEvent](#feedmanagerevent)
  - [FeedsManagerService](#feedsmanagerservice-interface)
  - [Layers](#layers)
  - [Convenience Functions](#convenience-functions)

---

## Stateless Factories

### ticker

Creates a Stream that emits timestamps at a fixed interval.

```typescript
function ticker(
  interval: Duration.DurationInput,
  options?: TickerOptions
): Stream.Stream<number>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `interval` | `DurationInput` | Time between emissions (e.g., `"1 second"`, `"500 millis"`) |
| `options.immediate` | `boolean` | Emit first value immediately (default: `true`) |

**Returns:** `Stream<number>` — timestamps from `Date.now()`

**Example:**

```typescript
// Emit every second, starting immediately
const stream = ticker("1 second")

// Emit every 500ms, wait for first interval
const delayed = ticker("500 millis", { immediate: false })
```

---

### pulse

Creates a Stream that runs an Effect at a fixed interval.

```typescript
function pulse<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  interval: Duration.DurationInput,
  options?: PulseOptions
): Stream.Stream<A, E, R>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `effect` | `Effect<A, E, R>` | Effect to run on each pulse |
| `interval` | `DurationInput` | Time between runs |
| `options.immediate` | `boolean` | Run first effect immediately (default: `true`) |

**Returns:** `Stream<A, E, R>` — results from each effect execution

**Example:**

```typescript
const statusStream = pulse(fetchSystemStatus, "5 seconds")
const sensorStream = pulse(readSensor, "100 millis", { immediate: false })
```

---

### counter

Creates a Stream that emits incrementing integers.

```typescript
function counter(interval: Duration.DurationInput): Stream.Stream<number>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `interval` | `DurationInput` | Time between emissions |

**Returns:** `Stream<number>` — `0, 1, 2, 3, ...`

**Example:**

```typescript
counter("1 second").pipe(Stream.take(5), Stream.runCollect)
// → Chunk(0, 1, 2, 3, 4)
```

---

### heartbeat

Pre-configured ticker at 1-second intervals.

```typescript
const heartbeat: Stream.Stream<number>
```

Equivalent to `ticker("1 second")`.

---

## Feed Class

### FeedConfig

Configuration for creating a Feed instance.

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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier |
| `name` | `string` | Yes | Human-readable name |
| `schema` | `Schema<A>` | No | Schema for runtime validation |
| `producer` | `Effect<A, E, R>` | Yes | Effect that produces each event |
| `interval` | `DurationInput` | No | Time between productions |
| `onConnect` | `Effect<void>` | No | Runs when feed starts |
| `onDisconnect` | `Effect<void>` | No | Runs when feed stops |

---

### FeedState

Internal runtime state of a Feed.

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

---

### FeedStatus

```typescript
type FeedStatus = "idle" | "running" | "paused" | "stopped"
```

---

### FeedSignal

Signals for event-driven feed control.

```typescript
type FeedSignal =
  | { readonly _tag: "Start" }
  | { readonly _tag: "Stop" }
  | { readonly _tag: "Pause" }
  | { readonly _tag: "Resume" }
```

---

### Feed Methods

#### `Feed.make`

Factory method to create a Feed instance.

```typescript
static make<A, E = never, R = never>(
  config: FeedConfig<A, E, R>
): Feed<A, E, R>
```

#### `feed.start()`

Start the feed. Idempotent — does nothing if already running.

```typescript
start(): Effect.Effect<void, E, R>
```

#### `feed.stop()`

Stop the feed. Interrupts the fiber if running.

```typescript
stop(): Effect.Effect<void>
```

#### `feed.signal(sig)`

Send a signal to the feed.

```typescript
signal(sig: FeedSignal): Effect.Effect<void, E, R>
```

#### `feed.status`

Get current feed status.

```typescript
get status(): Effect.Effect<FeedStatus>
```

#### `feed.state`

Get full feed state.

```typescript
get state(): Effect.Effect<FeedState<A, E>>
```

#### `feed.isRunning`

Check if feed is currently running.

```typescript
get isRunning(): Effect.Effect<boolean>
```

#### `feed.stream`

Get the underlying event stream.

```typescript
get stream(): Stream.Stream<A, E, R>
```

#### `feed.subscribe()`

Subscribe to events via PubSub.

```typescript
subscribe(): Effect.Effect<Queue.Dequeue<A>, never, Scope.Scope>
```

#### `feed.run(handler, options?)`

Run the feed with a handler for each event.

```typescript
run(
  handler: (event: A) => Effect.Effect<void, never, R>,
  options?: { duration?: Duration.DurationInput }
): Effect.Effect<void, E, R | Scope.Scope>
```

---

### makeFeed

Convenience factory for simple feeds.

```typescript
function makeFeed<A, E = never, R = never>(
  id: string,
  producer: Effect.Effect<A, E, R>,
  options?: Partial<Omit<FeedConfig<A, E, R>, "id" | "producer">>
): Feed<A, E, R>
```

---

## FeedsManager Service

### FeedId

Branded string type for type-safe feed retrieval.

```typescript
type FeedId<A> = string & { readonly _feedType: A }

function FeedId<A>(id: string): FeedId<A>
```

**Example:**

```typescript
const tempId: FeedId<TemperatureReading> = FeedId("temp-sensor")
```

---

### FeedCommand

Commands for the PubSub channel.

```typescript
type FeedCommand =
  | { readonly _tag: "RegisterFeed"; readonly id: string }
  | { readonly _tag: "UnregisterFeed"; readonly id: string }
  | { readonly _tag: "StartFeed"; readonly id: string }
  | { readonly _tag: "StopFeed"; readonly id: string }
  | { readonly _tag: "StartAll" }
  | { readonly _tag: "StopAll" }
  | { readonly _tag: "SignalFeed"; readonly id: string; readonly signal: FeedSignal }
```

---

### FeedManagerEvent

Events emitted by the manager.

```typescript
type FeedManagerEvent =
  | { readonly _tag: "FeedRegistered"; readonly id: string; readonly name: string }
  | { readonly _tag: "FeedUnregistered"; readonly id: string }
  | { readonly _tag: "FeedStarted"; readonly id: string }
  | { readonly _tag: "FeedStopped"; readonly id: string }
  | { readonly _tag: "FeedError"; readonly id: string; readonly error: unknown }
```

---

### FeedsManagerService Interface

```typescript
interface FeedsManagerService {
  // Registration
  readonly register: <A, E, R>(
    feed: Feed<A, E, R>,
    options?: { tags?: readonly string[] }
  ) => Effect.Effect<FeedId<A>>

  readonly unregister: (id: string) => Effect.Effect<void>

  // Retrieval
  readonly get: <A>(id: FeedId<A>) => Effect.Effect<Option.Option<Feed<A, unknown, unknown>>>
  readonly getById: (id: string) => Effect.Effect<Option.Option<Feed<unknown, unknown, unknown>>>
  readonly getByTag: (tag: string) => Effect.Effect<ReadonlyArray<Feed<unknown, unknown, unknown>>>
  readonly listIds: () => Effect.Effect<ReadonlyArray<string>>
  readonly getStatuses: () => Effect.Effect<HashMap.HashMap<string, FeedStatus>>

  // Lifecycle
  readonly start: (id: string) => Effect.Effect<void, unknown, unknown>
  readonly stop: (id: string) => Effect.Effect<void>
  readonly startAll: () => Effect.Effect<void, unknown, unknown>
  readonly stopAll: () => Effect.Effect<void>
  readonly signal: (id: string, sig: FeedSignal) => Effect.Effect<void, unknown, unknown>

  // Event bus
  readonly commands: PubSub.PubSub<FeedCommand>
  readonly events: PubSub.PubSub<FeedManagerEvent>
  readonly subscribeEvents: () => Effect.Effect<Queue.Dequeue<FeedManagerEvent>, never, Scope.Scope>
}
```

---

### Layers

#### `FeedsManagerLive`

Standard live layer.

```typescript
const FeedsManagerLive: Layer.Layer<FeedsManager>
```

#### `FeedsManagerScoped`

Scoped layer — stops all feeds when scope closes.

```typescript
const FeedsManagerScoped: Layer.Layer<FeedsManager, never, Scope.Scope>
```

---

### Convenience Functions

#### `registerFeed`

```typescript
function registerFeed<A, E, R>(
  feed: Feed<A, E, R>,
  options?: { tags?: readonly string[] }
): Effect.Effect<FeedId<A>, never, FeedsManager>
```

#### `getFeed`

```typescript
function getFeed<A>(
  id: FeedId<A>
): Effect.Effect<Option.Option<Feed<A, unknown, unknown>>, never, FeedsManager>
```

#### `sendCommand`

```typescript
function sendCommand(
  cmd: FeedCommand
): Effect.Effect<boolean, never, FeedsManager>
```

---

## Channel Schemas

The Channel construct provides a topological multiplexing protocol for multi-input, multi-output streaming with resilience patterns.

> **Note:** Channel schemas define the protocol. Implementation (ChannelBuilder, ChannelService) follows in a future iteration.

### Identity Types

Branded string types for type-safe references.

```typescript
// All follow the same pattern:
const ChannelId = Schema.String.pipe(Schema.brand("ChannelId"))
type ChannelId = typeof ChannelId.Type  // string & Brand<"ChannelId">
```

| Type | Purpose |
|------|---------|
| `ChannelId` | Unique channel identifier |
| `InletId` | Input port identifier |
| `OutletId` | Output port identifier |
| `JunctionId` | Transform point identifier |
| `WireId` | Connection identifier |
| `CorrelationId` | Request/response correlation |

---

### ChannelStatus

```typescript
const ChannelStatus = Schema.Literal("idle", "open", "closed", "faulted")
type ChannelStatus = "idle" | "open" | "closed" | "faulted"
```

---

### Topology Components

#### Inlet

Input port that accepts streams/feeds.

```typescript
class Inlet extends Schema.TaggedClass<Inlet>()("Inlet", {
  id: InletId,
  name: Schema.String,
  channelId: ChannelId,
  schema: Schema.optional(Schema.Unknown),
  connected: Schema.Boolean,
  sourceId: Schema.optional(Schema.String),
})
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `InletId` | Unique inlet identifier |
| `name` | `string` | Human-readable name |
| `channelId` | `ChannelId` | Parent channel |
| `schema` | `Schema<unknown>?` | Incoming data validation |
| `connected` | `boolean` | Connection status |
| `sourceId` | `string?` | Connected feed/stream ID |

---

#### Outlet

Output port that provides streams to subscribers.

```typescript
class Outlet extends Schema.TaggedClass<Outlet>()("Outlet", {
  id: OutletId,
  name: Schema.String,
  channelId: ChannelId,
  broadcast: Schema.Boolean,
  maxLag: Schema.Number,
  subscriberCount: Schema.Number,
})
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `OutletId` | Unique outlet identifier |
| `name` | `string` | Human-readable name |
| `channelId` | `ChannelId` | Parent channel |
| `broadcast` | `boolean` | Multi-subscriber mode |
| `maxLag` | `number` | Backpressure threshold |
| `subscriberCount` | `number` | Active subscribers |

---

#### Junction

Transform point in the topology.

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

---

#### Wire

Connection between ports/junctions.

```typescript
class Wire extends Schema.TaggedClass<Wire>()("Wire", {
  id: WireId,
  channelId: ChannelId,
  from: Schema.Union(InletId, JunctionId),
  to: Schema.Union(OutletId, JunctionId),
  active: Schema.Boolean,
})
```

---

### Protocol Configuration

#### BackpressureConfig

```typescript
const BackpressureStrategy = Schema.Literal(
  "block",       // Block producer
  "drop-oldest", // Drop oldest items
  "drop-newest", // Drop newest items
  "error"        // Fail the stream
)

class BackpressureConfig extends Schema.TaggedClass<BackpressureConfig>()("BackpressureConfig", {
  strategy: BackpressureStrategy,
  capacity: Schema.Number,
})
```

---

#### CircuitBreakerConfig

```typescript
const CircuitState = Schema.Literal("closed", "open", "half-open")

class CircuitBreakerConfig extends Schema.TaggedClass<CircuitBreakerConfig>()("CircuitBreakerConfig", {
  threshold: Schema.Number,      // Failures before opening
  resetAfter: Schema.String,     // Duration to half-open
  state: CircuitState,           // Current state
  failureCount: Schema.Number,   // Current failures
})
```

---

#### TimeoutConfig

```typescript
const TimeoutBehavior = Schema.Literal("fail", "warn", "skip")

class TimeoutConfig extends Schema.TaggedClass<TimeoutConfig>()("TimeoutConfig", {
  duration: Schema.String,       // DurationInput
  behavior: TimeoutBehavior,
})
```

---

#### RetryConfig

```typescript
class RetryConfig extends Schema.TaggedClass<RetryConfig>()("RetryConfig", {
  times: Schema.Number,
  backoff: Schema.Literal("fixed", "exponential", "fibonacci"),
  initialDelay: Schema.String,
  maxDelay: Schema.optional(Schema.String),
})
```

---

#### ChannelProtocol

Combined protocol configuration.

```typescript
class ChannelProtocol extends Schema.TaggedClass<ChannelProtocol>()("ChannelProtocol", {
  timeout: Schema.optional(TimeoutConfig),
  circuitBreaker: Schema.optional(CircuitBreakerConfig),
  backpressure: Schema.optional(BackpressureConfig),
  retry: Schema.optional(RetryConfig),
})
```

---

### Channel Commands

```typescript
type ChannelCommand =
  | OpenChannel        // { id: ChannelId }
  | CloseChannel       // { id: ChannelId, reason?: string }
  | ConnectInlet       // { channelId, inletId, sourceId }
  | DisconnectInlet    // { channelId, inletId }
  | SubscribeOutlet    // { channelId, outletId, subscriberId }
  | UnsubscribeOutlet  // { channelId, outletId, subscriberId }
  | ResetCircuitBreaker // { channelId }
```

---

### Channel Events

```typescript
type ChannelEvent =
  | ChannelOpened           // { channelId, timestamp }
  | ChannelClosed           // { channelId, reason?, timestamp }
  | ChannelFaulted          // { channelId, error, timestamp }
  | InletConnected          // { channelId, inletId, sourceId, timestamp }
  | InletDisconnected       // { channelId, inletId, timestamp }
  | OutletSubscribed        // { channelId, outletId, subscriberId, timestamp }
  | OutletUnsubscribed      // { channelId, outletId, subscriberId, timestamp }
  | CircuitBreakerTripped   // { channelId, failureCount, timestamp }
  | CircuitBreakerReset     // { channelId, timestamp }
  | TimeoutOccurred         // { channelId, inletId?, duration, timestamp }
  | BackpressureEngaged     // { channelId, strategy, bufferSize, timestamp }
```

---

### Bidirectional Patterns

#### ChannelRequest

Factory function for typed request envelopes.

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

// Usage:
const MyRequest = ChannelRequest(Schema.Struct({ query: Schema.String }))
type MyRequest = typeof MyRequest.Type
```

---

#### ChannelResponse

Factory function for typed response envelopes.

```typescript
const ChannelResponse = <A, I, R>(payloadSchema: Schema.Schema<A, I, R>) =>
  Schema.TaggedStruct("ChannelResponse", {
    correlationId: CorrelationId,
    channelId: ChannelId,
    payload: payloadSchema,
    final: Schema.Boolean,       // For streaming responses
    timestamp: Schema.Number,
  })
```

---

#### ChannelAck / ChannelNack

Acknowledgment types for reliable delivery.

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

---

### State Schemas

#### ChannelTopology

```typescript
class ChannelTopology extends Schema.TaggedClass<ChannelTopology>()("ChannelTopology", {
  inlets: Schema.Array(Inlet),
  outlets: Schema.Array(Outlet),
  junctions: Schema.Array(Junction),
  wires: Schema.Array(Wire),
})
```

---

#### ChannelMetrics

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

---

#### ChannelState

Complete channel state representation.

```typescript
class ChannelState extends Schema.TaggedClass<ChannelState>()("ChannelState", {
  id: ChannelId,
  name: Schema.String,
  status: ChannelStatus,
  topology: ChannelTopology,
  protocol: ChannelProtocol,
  metrics: ChannelMetrics,
  createdAt: Schema.Number,
  openedAt: Schema.optional(Schema.Number),
  closedAt: Schema.optional(Schema.Number),
})
```

---

#### ChannelConfig

Builder input configuration.

```typescript
class ChannelConfig extends Schema.TaggedClass<ChannelConfig>()("ChannelConfig", {
  id: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  protocol: Schema.optional(ChannelProtocol),
})
```

---

## Type Exports

```typescript
// Feed Types
export type { FeedConfig, FeedState, FeedsManagerService, FeedEntry }

// Feed Schemas
export { FeedStatus, FeedSignal, FeedCommand, FeedManagerEvent }

// Channel Identity
export {
  ChannelId, InletId, OutletId, JunctionId, WireId, CorrelationId
}

// Channel Status & Kinds
export { ChannelStatus, JunctionKind, BackpressureStrategy, CircuitState, TimeoutBehavior }

// Channel Topology
export { Inlet, Outlet, Junction, Wire }

// Channel Protocol
export { BackpressureConfig, CircuitBreakerConfig, TimeoutConfig, RetryConfig, ChannelProtocol }

// Channel Commands & Events
export { ChannelCommand, ChannelEvent }
export {
  OpenChannel, CloseChannel, ConnectInlet, DisconnectInlet,
  SubscribeOutlet, UnsubscribeOutlet, ResetCircuitBreaker
}
export {
  ChannelOpened, ChannelClosed, ChannelFaulted,
  InletConnected, InletDisconnected,
  OutletSubscribed, OutletUnsubscribed,
  CircuitBreakerTripped, CircuitBreakerReset,
  TimeoutOccurred, BackpressureEngaged
}

// Channel Bidirectional
export { ChannelRequest, ChannelResponse, ChannelAck, ChannelNack }

// Channel State
export { ChannelTopology, ChannelMetrics, ChannelState, ChannelConfig }
```
