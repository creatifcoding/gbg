# Channel — Topological Multiplexing Protocol

A Channel is a configured topology with protocol semantics for reactive stream composition.

---

## Table of Contents

- [Overview](#overview)
- [Ontology](#ontology)
- [Identity Types](#identity-types)
- [Topology Components](#topology-components)
- [Protocol Configuration](#protocol-configuration)
- [Commands](#commands)
- [Events](#events)
- [Bidirectional Patterns](#bidirectional-patterns)
- [State Management](#state-management)
- [Usage Examples](#usage-examples)

---

## Overview

### What is a Channel?

A **Channel** is a topological multiplexing protocol — a configured graph of connections with protocol semantics:

- **Multi-input**: Accepts streams from multiple sources (Inlets)
- **Multi-output**: Broadcasts to multiple consumers (Outlets)
- **Transformational**: Applies operations at junction points
- **Protocol-aware**: Handles timeout, circuit breaking, backpressure, correlation

### Channel vs Feed

| Aspect | Feed | Channel |
|--------|------|---------|
| **Role** | Single source with lifecycle | Topology with protocol |
| **Inputs** | One producer | Multiple inlets |
| **Outputs** | One stream | Multiple outlets |
| **Transforms** | None (raw producer output) | Junctions (filter, map, partition) |
| **Protocol** | Basic start/stop | Timeout, circuit breaker, backpressure |
| **BFO Type** | Process | Generically Dependent Continuant |

### Composition Model

```
Feed ────────┐
Feed ────────┼──→ Channel ──┬──→ Sink (AG-Grid)
Feed ────────┘              ├──→ Sink (tldraw)
                            └──→ Sink (Logger)
```

Feeds are **leaf nodes** (sources). Channels are **topology graphs** (wiring).

---

## Ontology

### BFO Alignment

The Channel construct aligns with Basic Formal Ontology (BFO) categories:

```
Channel : Generically Dependent Continuant (GDC)
├── Has topology (graph of connections)
├── Has protocol (handshake, ack, backpressure)
├── Has identity (can be referenced, transferred)
└── Bears qualities (latency, throughput, health)

Inlet : Site
└── Spatial region where input processes occur

Outlet : Site
└── Spatial region where output processes occur

Junction : Process
└── Occurrent that transforms data flow

Wire : Relation
└── Connects sites within the topology
```

### Why GDC?

A Generically Dependent Continuant is something that:
1. Depends on bearers (the streams flowing through)
2. Can be transferred (channel topology can be serialized/restored)
3. Has identity independent of specific instances

This fits Channel perfectly — it's a *pattern* of connections, not the data itself.

---

## Identity Types

All identifiers are **branded strings** for type safety.

### ChannelId

```typescript
import { ChannelId } from "@/lib/streams"

// Type: string & Brand<"ChannelId">
const id: ChannelId = "sensors" as ChannelId

// Compile-time safety — can't mix with other IDs
const inletId: InletId = "temp" as InletId
// id === inletId  // Type error!
```

### Complete Identity Hierarchy

| Type | Purpose | Example |
|------|---------|---------|
| `ChannelId` | Channel instance | `"sensor-fusion"` |
| `InletId` | Input port | `"temperature"` |
| `OutletId` | Output port | `"filtered-data"` |
| `JunctionId` | Transform point | `"validate"` |
| `WireId` | Connection | `"temp-to-merge"` |
| `CorrelationId` | Request/response | `"req-abc123"` |

### Schema Definition

```typescript
export const ChannelId = Schema.String.pipe(
  Schema.brand("ChannelId"),
  Schema.annotations({ identifier: "ChannelId" })
)
export type ChannelId = typeof ChannelId.Type
```

---

## Topology Components

### Inlet

An **Inlet** is an input port that accepts streams or feeds.

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

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `id` | `InletId` | Unique identifier |
| `name` | `string` | Human-readable name |
| `channelId` | `ChannelId` | Parent channel |
| `schema` | `Schema?` | Optional validation schema for incoming data |
| `connected` | `boolean` | Whether a source is connected |
| `sourceId` | `string?` | Identifier of connected source (feed ID, etc.) |

**Example:**

```typescript
const tempInlet = new Inlet({
  id: "temp" as InletId,
  name: "Temperature Sensor",
  channelId: "sensors" as ChannelId,
  schema: TemperatureReading,
  connected: false,
  sourceId: undefined,
})
```

---

### Outlet

An **Outlet** is an output port that provides streams to subscribers.

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

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `id` | `OutletId` | Unique identifier |
| `name` | `string` | Human-readable name |
| `channelId` | `ChannelId` | Parent channel |
| `schema` | `Schema?` | Optional outgoing payload validation/decoding |
| `broadcast` | `boolean` | Enable fan-out to multiple subscribers |
| `maxLag` | `number` | Backpressure: max items ahead of slowest consumer |
| `subscriberCount` | `number` | Current number of subscribers |

At runtime, outlet `schema` is enforced at egress publish boundary. Invalid payloads are suppressed for that outlet, `metrics.errors` increments, and `ChannelFaulted` is emitted.

**Example:**

```typescript
const filteredOutlet = new Outlet({
  id: "filtered" as OutletId,
  name: "Filtered Readings",
  channelId: "sensors" as ChannelId,
  schema: Schema.Struct({ at: Schema.DateFromString }),
  broadcast: true,
  maxLag: 16,
  subscriberCount: 0,
})
```

---

### Junction

A **Junction** is a transform point in the topology.

```typescript
const JunctionKind = Schema.Literal(
  "filter",
  "map",
  "flatMap",
  "partition",
  "merge",
  "broadcast",
  "buffer",
  "throttle",
  "debounce",
  "timeout"
)

class Junction extends Schema.TaggedClass<Junction>()("Junction", {
  id: JunctionId,
  name: Schema.String,
  channelId: ChannelId,
  kind: JunctionKind,
  config: Schema.optional(Schema.Unknown),
})
```

**Junction Kinds:**

| Kind | Description | Config Example |
|------|-------------|----------------|
| `filter` | Pass elements matching predicate | `{ predicate: "isValid" }` |
| `map` | Transform each element | `{ transform: "addTimestamp" }` |
| `flatMap` | Transform and flatten | `{ transform: "expandBatch" }` |
| `partition` | Split by predicate | `{ predicates: { temp: "...", press: "..." } }` |
| `merge` | Combine multiple streams | `{ strategy: "interleave" }` |
| `broadcast` | Fan-out to multiple | `{ subscribers: 3, maxLag: 16 }` |
| `buffer` | Batch over time window | `{ duration: "1 second" }` |
| `throttle` | Rate-limit emissions | `{ duration: "100 millis" }` |
| `debounce` | Emit after silence | `{ duration: "300 millis" }` |
| `timeout` | Fail/warn on silence | `{ duration: "5 seconds", behavior: "warn" }` |

**Example:**

```typescript
const validateJunction = new Junction({
  id: "validate" as JunctionId,
  name: "Validation",
  channelId: "sensors" as ChannelId,
  kind: "filter",
  config: { predicate: "isValidReading" },
})
```

---

### Wire

A **Wire** connects ports and junctions within the topology.

```typescript
class Wire extends Schema.TaggedClass<Wire>()("Wire", {
  id: WireId,
  channelId: ChannelId,
  from: Schema.Union(InletId, JunctionId),
  to: Schema.Union(OutletId, JunctionId),
  active: Schema.Boolean,
})
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `id` | `WireId` | Unique identifier |
| `channelId` | `ChannelId` | Parent channel |
| `from` | `InletId \| JunctionId` | Source port |
| `to` | `OutletId \| JunctionId` | Target port |
| `active` | `boolean` | Whether data is flowing |

**Example:**

```typescript
const wire = new Wire({
  id: "w1" as WireId,
  channelId: "sensors" as ChannelId,
  from: "temp" as InletId,
  to: "validate" as JunctionId,
  active: true,
})
```

---

## Protocol Configuration

### BackpressureConfig

Controls behavior when consumers can't keep up.

```typescript
const BackpressureStrategy = Schema.Literal(
  "block",       // Block producer until consumer catches up
  "drop-oldest", // Drop oldest items when buffer full
  "drop-newest", // Drop newest items when buffer full
  "error"        // Fail the stream when buffer full
)

class BackpressureConfig extends Schema.TaggedClass<BackpressureConfig>()("BackpressureConfig", {
  strategy: BackpressureStrategy,
  capacity: Schema.Number,
})
```

**Strategy Comparison:**

| Strategy | Behavior | Use Case |
|----------|----------|----------|
| `block` | Producer waits | Lossless, latency-tolerant |
| `drop-oldest` | Discard stale data | Real-time, latest-wins |
| `drop-newest` | Discard incoming | Preserve history |
| `error` | Fail stream | Strict processing |

**Example:**

```typescript
const backpressure = new BackpressureConfig({
  strategy: "drop-oldest",
  capacity: 1000,
})
```

---

### CircuitBreakerConfig

Prevents cascade failures by opening circuit after repeated errors.

```typescript
const CircuitState = Schema.Literal("closed", "open", "half-open")

class CircuitBreakerConfig extends Schema.TaggedClass<CircuitBreakerConfig>()("CircuitBreakerConfig", {
  threshold: Schema.Number,      // Failures before opening
  resetAfter: Schema.String,     // Duration before half-open
  state: CircuitState,
  failureCount: Schema.Number,
})
```

**State Machine:**

```
     ┌──────────┐
     │  closed  │◄───────────────────┐
     └────┬─────┘                    │
          │ failure >= threshold     │ success in half-open
          ▼                          │
     ┌──────────┐              ┌─────┴─────┐
     │   open   │──resetAfter──►│ half-open │
     └──────────┘              └───────────┘
                                     │
                                     │ failure
                                     ▼
                               back to open
```

**Example:**

```typescript
const circuitBreaker = new CircuitBreakerConfig({
  threshold: 5,
  resetAfter: "30 seconds",
  state: "closed",
  failureCount: 0,
})
```

---

### TimeoutConfig

Detects when sources go silent.

```typescript
const TimeoutBehavior = Schema.Literal("fail", "warn", "skip")

class TimeoutConfig extends Schema.TaggedClass<TimeoutConfig>()("TimeoutConfig", {
  duration: Schema.String,     // DurationInput
  behavior: TimeoutBehavior,
})
```

**Behavior Options:**

| Behavior | Action | Event Emitted |
|----------|--------|---------------|
| `fail` | Close channel with error | `ChannelFaulted` |
| `warn` | Emit warning, continue | `TimeoutOccurred` |
| `skip` | Silently continue | None |

**Example:**

```typescript
const timeout = new TimeoutConfig({
  duration: "5 seconds",
  behavior: "warn",
})
```

---

### RetryConfig

Configures automatic retry on failure.

```typescript
class RetryConfig extends Schema.TaggedClass<RetryConfig>()("RetryConfig", {
  times: Schema.Number,
  backoff: Schema.Literal("fixed", "exponential", "fibonacci"),
  initialDelay: Schema.String,
  maxDelay: Schema.optional(Schema.String),
})
```

**Backoff Strategies:**

| Strategy | Pattern | Example (100ms initial) |
|----------|---------|-------------------------|
| `fixed` | Same delay | 100, 100, 100, 100 |
| `exponential` | Double each time | 100, 200, 400, 800 |
| `fibonacci` | Fib sequence | 100, 100, 200, 300, 500 |

**Example:**

```typescript
const retry = new RetryConfig({
  times: 3,
  backoff: "exponential",
  initialDelay: "100 millis",
  maxDelay: "10 seconds",
})
```

---

### ChannelProtocol

Complete protocol configuration bundle.

```typescript
class ChannelProtocol extends Schema.TaggedClass<ChannelProtocol>()("ChannelProtocol", {
  timeout: Schema.optional(TimeoutConfig),
  circuitBreaker: Schema.optional(CircuitBreakerConfig),
  backpressure: Schema.optional(BackpressureConfig),
  retry: Schema.optional(RetryConfig),
})
```

**Example:**

```typescript
const protocol = new ChannelProtocol({
  timeout: new TimeoutConfig({ duration: "5 seconds", behavior: "warn" }),
  circuitBreaker: new CircuitBreakerConfig({
    threshold: 5,
    resetAfter: "30 seconds",
    state: "closed",
    failureCount: 0,
  }),
  backpressure: new BackpressureConfig({
    strategy: "drop-oldest",
    capacity: 1000,
  }),
})
```

---

## Commands

Commands are **requests** sent to the channel for state changes.

### Command Summary

| Command | Purpose | Key Fields |
|---------|---------|------------|
| `OpenChannel` | Start the channel | `id` |
| `CloseChannel` | Stop the channel | `id`, `reason?` |
| `ConnectInlet` | Attach source to inlet | `channelId`, `inletId`, `sourceId` |
| `DisconnectInlet` | Detach source | `channelId`, `inletId` |
| `SubscribeOutlet` | Add subscriber to outlet | `channelId`, `outletId`, `subscriberId` |
| `UnsubscribeOutlet` | Remove subscriber | `channelId`, `outletId`, `subscriberId` |
| `ResetCircuitBreaker` | Force circuit to closed | `channelId` |

### Command Schemas

```typescript
class OpenChannel extends Schema.TaggedClass<OpenChannel>()("OpenChannel", {
  id: ChannelId,
}) {}

class CloseChannel extends Schema.TaggedClass<CloseChannel>()("CloseChannel", {
  id: ChannelId,
  reason: Schema.optional(Schema.String),
}) {}

class ConnectInlet extends Schema.TaggedClass<ConnectInlet>()("ConnectInlet", {
  channelId: ChannelId,
  inletId: InletId,
  sourceId: Schema.String,
}) {}

class DisconnectInlet extends Schema.TaggedClass<DisconnectInlet>()("DisconnectInlet", {
  channelId: ChannelId,
  inletId: InletId,
}) {}

class SubscribeOutlet extends Schema.TaggedClass<SubscribeOutlet>()("SubscribeOutlet", {
  channelId: ChannelId,
  outletId: OutletId,
  subscriberId: Schema.String,
}) {}

class UnsubscribeOutlet extends Schema.TaggedClass<UnsubscribeOutlet>()("UnsubscribeOutlet", {
  channelId: ChannelId,
  outletId: OutletId,
  subscriberId: Schema.String,
}) {}

class ResetCircuitBreaker extends Schema.TaggedClass<ResetCircuitBreaker>()("ResetCircuitBreaker", {
  channelId: ChannelId,
}) {}

// Union for pattern matching
const ChannelCommand = Schema.Union(
  OpenChannel,
  CloseChannel,
  ConnectInlet,
  DisconnectInlet,
  SubscribeOutlet,
  UnsubscribeOutlet,
  ResetCircuitBreaker
)
```

### Usage

```typescript
import { ChannelCommand, OpenChannel } from "@/lib/streams"

const cmd: ChannelCommand = new OpenChannel({ id: "sensors" as ChannelId })

// Pattern match
switch (cmd._tag) {
  case "OpenChannel":
    console.log(`Opening channel ${cmd.id}`)
    break
  case "CloseChannel":
    console.log(`Closing channel ${cmd.id}: ${cmd.reason}`)
    break
  // ...
}
```

---

## Events

Events are **notifications** emitted when channel state changes.

### Event Summary

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

### Event Schemas

```typescript
class ChannelOpened extends Schema.TaggedClass<ChannelOpened>()("ChannelOpened", {
  channelId: ChannelId,
  timestamp: Schema.Number,
}) {}

class ChannelClosed extends Schema.TaggedClass<ChannelClosed>()("ChannelClosed", {
  channelId: ChannelId,
  reason: Schema.optional(Schema.String),
  timestamp: Schema.Number,
}) {}

class ChannelFaulted extends Schema.TaggedClass<ChannelFaulted>()("ChannelFaulted", {
  channelId: ChannelId,
  error: Schema.String,
  timestamp: Schema.Number,
}) {}

// ... (see Channel.ts for complete definitions)

// Union for pattern matching
const ChannelEvent = Schema.Union(
  ChannelOpened,
  ChannelClosed,
  ChannelFaulted,
  InletConnected,
  InletDisconnected,
  OutletSubscribed,
  OutletUnsubscribed,
  CircuitBreakerTripped,
  CircuitBreakerReset,
  TimeoutOccurred,
  BackpressureEngaged
)
```

### Subscribing to Events

```typescript
import { ChannelEvent } from "@/lib/streams"

// Via PubSub (future implementation)
yield* channel.events.pipe(
  Stream.tap((event) => {
    switch (event._tag) {
      case "ChannelOpened":
        return Console.log(`Channel ${event.channelId} opened`)
      case "CircuitBreakerTripped":
        return Console.log(`Circuit tripped after ${event.failureCount} failures`)
      case "TimeoutOccurred":
        return Console.log(`Timeout on inlet ${event.inletId}`)
      default:
        return Effect.void
    }
  }),
  Stream.runDrain
)
```

---

## Bidirectional Patterns

For request/response communication (NATS-style).

### ChannelRequest

Request envelope with correlation ID for response matching.

```typescript
// Factory function — provide payload schema
const ChannelRequest = <A, I, R>(payloadSchema: Schema.Schema<A, I, R>) =>
  Schema.TaggedStruct("ChannelRequest", {
    correlationId: CorrelationId,
    channelId: ChannelId,
    payload: payloadSchema,
    replyTo: Schema.optional(OutletId),
    timestamp: Schema.Number,
    ttl: Schema.optional(Schema.Number),  // Time-to-live in ms
  })
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `correlationId` | `CorrelationId` | Unique ID for response matching |
| `channelId` | `ChannelId` | Target channel |
| `payload` | `A` | Request data (typed by schema) |
| `replyTo` | `OutletId?` | Where to send response |
| `timestamp` | `number` | Request creation time |
| `ttl` | `number?` | Max lifetime in milliseconds |

**Example:**

```typescript
// Define request schema
const GetDataRequest = ChannelRequest(Schema.Struct({
  query: Schema.String,
  limit: Schema.Number,
}))
type GetDataRequest = typeof GetDataRequest.Type

// Create request
const request: GetDataRequest = {
  _tag: "ChannelRequest",
  correlationId: "req-123" as CorrelationId,
  channelId: "data-service" as ChannelId,
  payload: { query: "SELECT *", limit: 100 },
  timestamp: Date.now(),
  ttl: 5000,
}
```

---

### ChannelResponse

Response envelope with correlation ID for matching.

```typescript
const ChannelResponse = <A, I, R>(payloadSchema: Schema.Schema<A, I, R>) =>
  Schema.TaggedStruct("ChannelResponse", {
    correlationId: CorrelationId,
    channelId: ChannelId,
    payload: payloadSchema,
    final: Schema.Boolean,  // Is this the last response?
    timestamp: Schema.Number,
  })
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `correlationId` | `CorrelationId` | Matches original request |
| `channelId` | `ChannelId` | Source channel |
| `payload` | `A` | Response data (typed by schema) |
| `final` | `boolean` | `true` if last response (for streaming) |
| `timestamp` | `number` | Response creation time |

**Example:**

```typescript
// Define response schema
const GetDataResponse = ChannelResponse(Schema.Struct({
  rows: Schema.Array(Schema.Unknown),
  total: Schema.Number,
}))
type GetDataResponse = typeof GetDataResponse.Type

// Create response
const response: GetDataResponse = {
  _tag: "ChannelResponse",
  correlationId: "req-123" as CorrelationId,
  channelId: "data-service" as ChannelId,
  payload: { rows: [{ id: 1 }, { id: 2 }], total: 100 },
  final: true,
  timestamp: Date.now(),
}
```

---

### ChannelAck / ChannelNack

For reliable delivery confirmation.

```typescript
class ChannelAck extends Schema.TaggedClass<ChannelAck>()("ChannelAck", {
  correlationId: CorrelationId,
  channelId: ChannelId,
  timestamp: Schema.Number,
}) {}

class ChannelNack extends Schema.TaggedClass<ChannelNack>()("ChannelNack", {
  correlationId: CorrelationId,
  channelId: ChannelId,
  reason: Schema.String,
  timestamp: Schema.Number,
}) {}
```

**Use Case:**

```typescript
// Sender waits for ack
yield* sendRequest(request).pipe(
  Effect.flatMap(() => waitForAck(request.correlationId)),
  Effect.timeout("5 seconds"),
  Effect.catchTag("TimeoutException", () =>
    Effect.fail(new RequestTimedOut())
  )
)

// Receiver sends ack
yield* processRequest(request).pipe(
  Effect.tap(() => sendAck(request.correlationId)),
  Effect.catchAll((error) => sendNack(request.correlationId, error.message))
)
```

---

## State Management

### ChannelTopology

Complete graph of the channel's connections.

```typescript
class ChannelTopology extends Schema.TaggedClass<ChannelTopology>()("ChannelTopology", {
  inlets: Schema.Array(Inlet),
  outlets: Schema.Array(Outlet),
  junctions: Schema.Array(Junction),
  wires: Schema.Array(Wire),
})
```

**Example:**

```typescript
const topology = new ChannelTopology({
  inlets: [tempInlet, pressInlet],
  outlets: [rawOutlet, filteredOutlet],
  junctions: [mergeJunction, filterJunction],
  wires: [
    wire("temp", "merge"),
    wire("press", "merge"),
    wire("merge", "filter"),
    wire("filter", "filtered"),
    wire("merge", "raw"),
  ],
})
```

---

### ChannelMetrics

Runtime statistics.

```typescript
class ChannelMetrics extends Schema.TaggedClass<ChannelMetrics>()("ChannelMetrics", {
  messagesIn: Schema.Number,
  messagesOut: Schema.Number,
  bytesIn: Schema.Number,
  bytesOut: Schema.Number,
  errors: Schema.Number,
  latencyMs: Schema.Number,   // Average latency
  uptime: Schema.Number,      // Milliseconds since open
})
```

**Use Case:**

```typescript
// Monitor channel health
yield* channel.metrics.pipe(
  Stream.tap((m) =>
    Console.log(`Throughput: ${m.messagesIn}/s, Latency: ${m.latencyMs}ms, Errors: ${m.errors}`)
  ),
  Stream.schedule(Schedule.spaced("1 second")),
  Stream.runDrain
)
```

---

### ChannelState

Complete channel snapshot.

```typescript
class ChannelState extends Schema.TaggedClass<ChannelState>()("ChannelState", {
  id: ChannelId,
  name: Schema.String,
  status: ChannelStatus,           // "idle" | "open" | "closed" | "faulted"
  topology: ChannelTopology,
  protocol: ChannelProtocol,
  metrics: ChannelMetrics,
  createdAt: Schema.Number,
  openedAt: Schema.optional(Schema.Number),
  closedAt: Schema.optional(Schema.Number),
})
```

**Lifecycle:**

```
idle ──OpenChannel──► open ──CloseChannel──► closed
                        │
                        │ unrecoverable error
                        ▼
                     faulted
```

---

### ChannelConfig

Builder input for creating channels.

```typescript
class ChannelConfig extends Schema.TaggedClass<ChannelConfig>()("ChannelConfig", {
  id: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  protocol: Schema.optional(ChannelProtocol),
})
```

**Example:**

```typescript
const config = new ChannelConfig({
  id: "sensor-fusion",
  name: "Sensor Fusion Channel",
  description: "Merges temperature, pressure, and humidity sensors",
  protocol: new ChannelProtocol({
    timeout: new TimeoutConfig({ duration: "5 seconds", behavior: "warn" }),
    backpressure: new BackpressureConfig({ strategy: "drop-oldest", capacity: 1000 }),
  }),
})
```

---

## Usage Examples

### Example 1: Sensor Fusion Channel

```typescript
import {
  ChannelConfig,
  ChannelProtocol,
  TimeoutConfig,
  BackpressureConfig,
  Inlet,
  Outlet,
  Junction,
  Wire,
  ChannelTopology,
} from "@/lib/streams"

// 1. Define configuration
const config = new ChannelConfig({
  id: "sensors",
  name: "Sensor Fusion",
  protocol: new ChannelProtocol({
    timeout: new TimeoutConfig({ duration: "5 seconds", behavior: "warn" }),
    backpressure: new BackpressureConfig({ strategy: "drop-oldest", capacity: 500 }),
  }),
})

// 2. Define topology
const topology = new ChannelTopology({
  inlets: [
    new Inlet({ id: "temp", name: "Temperature", channelId: "sensors", connected: false }),
    new Inlet({ id: "press", name: "Pressure", channelId: "sensors", connected: false }),
    new Inlet({ id: "humid", name: "Humidity", channelId: "sensors", connected: false }),
  ],
  outlets: [
    new Outlet({ id: "all", name: "All Readings", channelId: "sensors", broadcast: true, maxLag: 16, subscriberCount: 0 }),
    new Outlet({ id: "temp-only", name: "Temperature Only", channelId: "sensors", broadcast: true, maxLag: 16, subscriberCount: 0 }),
  ],
  junctions: [
    new Junction({ id: "merge", name: "Merge All", channelId: "sensors", kind: "merge" }),
    new Junction({ id: "filter-temp", name: "Filter Temperature", channelId: "sensors", kind: "filter", config: { tag: "Temperature" } }),
  ],
  wires: [
    new Wire({ id: "w1", channelId: "sensors", from: "temp", to: "merge", active: true }),
    new Wire({ id: "w2", channelId: "sensors", from: "press", to: "merge", active: true }),
    new Wire({ id: "w3", channelId: "sensors", from: "humid", to: "merge", active: true }),
    new Wire({ id: "w4", channelId: "sensors", from: "merge", to: "all", active: true }),
    new Wire({ id: "w5", channelId: "sensors", from: "merge", to: "filter-temp", active: true }),
    new Wire({ id: "w6", channelId: "sensors", from: "filter-temp", to: "temp-only", active: true }),
  ],
})
```

### Example 2: Request/Response RPC

```typescript
import { ChannelRequest, ChannelResponse, CorrelationId, ChannelId } from "@/lib/streams"
import { Schema } from "effect"

// Define schemas
const QueryRequest = ChannelRequest(Schema.Struct({
  sql: Schema.String,
  params: Schema.Array(Schema.Unknown),
}))

const QueryResponse = ChannelResponse(Schema.Struct({
  rows: Schema.Array(Schema.Unknown),
  rowCount: Schema.Number,
}))

// Create request
const request = {
  _tag: "ChannelRequest" as const,
  correlationId: crypto.randomUUID() as CorrelationId,
  channelId: "db-service" as ChannelId,
  payload: {
    sql: "SELECT * FROM users WHERE active = ?",
    params: [true],
  },
  timestamp: Date.now(),
  ttl: 30000,
}

// Handle response
const handleResponse = (response: typeof QueryResponse.Type) => {
  if (response.correlationId === request.correlationId) {
    console.log(`Got ${response.payload.rowCount} rows`)
  }
}
```

### Example 3: Circuit Breaker Pattern

```typescript
import { CircuitBreakerConfig, CircuitBreakerTripped, CircuitBreakerReset } from "@/lib/streams"

// Configure circuit breaker
const breaker = new CircuitBreakerConfig({
  threshold: 5,          // Open after 5 failures
  resetAfter: "30 seconds",
  state: "closed",
  failureCount: 0,
})

// Handle events
const handleEvent = (event: ChannelEvent) => {
  switch (event._tag) {
    case "CircuitBreakerTripped":
      console.error(`Circuit opened after ${event.failureCount} failures`)
      alertOps("Circuit breaker tripped on channel " + event.channelId)
      break
    case "CircuitBreakerReset":
      console.log(`Circuit reset, resuming normal operation`)
      break
  }
}
```

---

## Runtime Status

Channel runtime is implemented and actively used.

Implemented surfaces:
1. **ChannelBuilder** — Fluent API for constructing channels.
2. **ChannelService** — Effect.Service runtime with connect/open/close/metrics/events.
3. **Protocol enforcement** — retry, timeout, circuit-breaker, and backpressure semantics.
4. **Domain bridges** — IIoT ingestion channel adapter and GEOINT TrackStore channel bridge.

Reference implementation files:
- `constructs/ChannelBuilder.ts`
- `constructs/ChannelService.ts`
- `src/lib/iiot/adapters/ingestion-channel.ts`
- `src/lib/geoint/streaming/TrackStoreChannelBridge.ts`

Throughput/semantics scope policy:
- `.pi/thoughts/shared/specs/streams/2026-02-07-e2e-claim-scope.md`
- `.pi/thoughts/shared/specs/streams/2026-02-07-junction-semantics-depth.md`
