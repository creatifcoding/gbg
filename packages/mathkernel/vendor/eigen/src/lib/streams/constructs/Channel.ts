/**
 * Channel — Topological Multiplexing Protocol
 *
 * A Channel is a configured topology with protocol semantics:
 * - Multi-input (inlets accept streams/feeds)
 * - Multi-output (outlets broadcast to subscribers)
 * - Transformational (junctions filter, map, partition)
 * - Protocol-aware (timeout, circuit breaker, backpressure, correlation)
 *
 * BFO Alignment:
 *   Channel : Generically Dependent Continuant
 *   ├── Has topology (graph of connections)
 *   ├── Has protocol (handshake, ack, backpressure)
 *   ├── Has identity (can be referenced, transferred)
 *   └── Bears qualities (latency, throughput, health)
 *
 * Composition with Feed:
 *   Feed = single source with lifecycle (leaf node)
 *   Channel = topology with protocol (wiring graph)
 *   They compose: Channel.connect(inlet, feed)
 */

import { Schema } from "effect"

// ============================================================================
// IDENTITY — Branded IDs for type-safe references
// ============================================================================

/** Branded channel identifier */
export const ChannelId = Schema.String.pipe(
  Schema.brand("ChannelId"),
  Schema.annotations({ identifier: "ChannelId" })
)
export type ChannelId = typeof ChannelId.Type

/** Branded inlet identifier */
export const InletId = Schema.String.pipe(
  Schema.brand("InletId"),
  Schema.annotations({ identifier: "InletId" })
)
export type InletId = typeof InletId.Type

/** Branded outlet identifier */
export const OutletId = Schema.String.pipe(
  Schema.brand("OutletId"),
  Schema.annotations({ identifier: "OutletId" })
)
export type OutletId = typeof OutletId.Type

/** Branded junction identifier */
export const JunctionId = Schema.String.pipe(
  Schema.brand("JunctionId"),
  Schema.annotations({ identifier: "JunctionId" })
)
export type JunctionId = typeof JunctionId.Type

/** Branded wire identifier */
export const WireId = Schema.String.pipe(
  Schema.brand("WireId"),
  Schema.annotations({ identifier: "WireId" })
)
export type WireId = typeof WireId.Type

/** Correlation ID for request/response patterns */
export const CorrelationId = Schema.String.pipe(
  Schema.brand("CorrelationId"),
  Schema.annotations({ identifier: "CorrelationId" })
)
export type CorrelationId = typeof CorrelationId.Type

// ============================================================================
// CHANNEL STATUS — Lifecycle states
// ============================================================================

export const ChannelStatus = Schema.Literal("idle", "open", "closed", "faulted")
export type ChannelStatus = typeof ChannelStatus.Type

// ============================================================================
// TOPOLOGY COMPONENTS — Sites where processes occur
// ============================================================================

/** Inlet: input port that accepts streams/feeds */
export class Inlet extends Schema.TaggedClass<Inlet>()("Inlet", {
  id: InletId,
  name: Schema.String,
  channelId: ChannelId,
  /** Schema for validating incoming data */
  schema: Schema.optional(Schema.Unknown),
  /** Whether this inlet is currently connected */
  connected: Schema.Boolean,
  /** Source identifier if connected */
  sourceId: Schema.optional(Schema.String),
}) {}

/** Outlet: output port that provides streams to subscribers */
export class Outlet extends Schema.TaggedClass<Outlet>()("Outlet", {
  id: OutletId,
  name: Schema.String,
  channelId: ChannelId,
  /** Optional schema for validating/decoding outgoing payloads at publish boundary */
  schema: Schema.optional(Schema.Unknown),
  /** Enable broadcasting to multiple subscribers */
  broadcast: Schema.Boolean,
  /** Maximum lag for broadcast backpressure */
  maxLag: Schema.Number,
  /** Number of active subscribers */
  subscriberCount: Schema.Number,
}) {}

/** Junction: transform point in the topology */
export const JunctionKind = Schema.Literal(
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
export type JunctionKind = typeof JunctionKind.Type

export class Junction extends Schema.TaggedClass<Junction>()("Junction", {
  id: JunctionId,
  name: Schema.String,
  channelId: ChannelId,
  kind: JunctionKind,
  /** Configuration for the junction (kind-specific) */
  config: Schema.optional(Schema.Unknown),
}) {}

/** Wire: connection between ports/junctions */
export class Wire extends Schema.TaggedClass<Wire>()("Wire", {
  id: WireId,
  channelId: ChannelId,
  /** Source port (inlet or junction output) */
  from: Schema.Union(InletId, JunctionId),
  /** Target port (outlet or junction input) */
  to: Schema.Union(OutletId, JunctionId),
  /** Whether this wire is active */
  active: Schema.Boolean,
}) {}

// ============================================================================
// PROTOCOL CONFIGURATION — Resilience and flow control
// ============================================================================

/** Backpressure strategy */
export const BackpressureStrategy = Schema.Literal(
  "block",      // Block producer until consumer catches up
  "drop-oldest", // Drop oldest items when buffer full
  "drop-newest", // Drop newest items when buffer full
  "error"       // Fail the stream when buffer full
)
export type BackpressureStrategy = typeof BackpressureStrategy.Type

export class BackpressureConfig extends Schema.TaggedClass<BackpressureConfig>()("BackpressureConfig", {
  strategy: BackpressureStrategy,
  capacity: Schema.Number,
}) {}

/** Circuit breaker state */
export const CircuitState = Schema.Literal("closed", "open", "half-open")
export type CircuitState = typeof CircuitState.Type

export class CircuitBreakerConfig extends Schema.TaggedClass<CircuitBreakerConfig>()("CircuitBreakerConfig", {
  /** Number of failures before opening */
  threshold: Schema.Number,
  /** Duration to wait before half-open */
  resetAfter: Schema.String, // DurationInput
  /** Current state */
  state: CircuitState,
  /** Current failure count */
  failureCount: Schema.Number,
}) {}

/** Timeout behavior */
export const TimeoutBehavior = Schema.Literal("fail", "warn", "skip")
export type TimeoutBehavior = typeof TimeoutBehavior.Type

export class TimeoutConfig extends Schema.TaggedClass<TimeoutConfig>()("TimeoutConfig", {
  duration: Schema.String, // DurationInput
  behavior: TimeoutBehavior,
}) {}

/** Retry configuration */
export class RetryConfig extends Schema.TaggedClass<RetryConfig>()("RetryConfig", {
  times: Schema.Number,
  backoff: Schema.Literal("fixed", "exponential", "fibonacci"),
  initialDelay: Schema.String, // DurationInput
  maxDelay: Schema.optional(Schema.String),
}) {}

/** Complete protocol configuration */
export class ChannelProtocol extends Schema.TaggedClass<ChannelProtocol>()("ChannelProtocol", {
  timeout: Schema.optional(TimeoutConfig),
  circuitBreaker: Schema.optional(CircuitBreakerConfig),
  backpressure: Schema.optional(BackpressureConfig),
  retry: Schema.optional(RetryConfig),
}) {}

// ============================================================================
// CHANNEL COMMANDS — Event-driven control
// ============================================================================

export class OpenChannel extends Schema.TaggedClass<OpenChannel>()("OpenChannel", {
  id: ChannelId,
}) {}

export class CloseChannel extends Schema.TaggedClass<CloseChannel>()("CloseChannel", {
  id: ChannelId,
  reason: Schema.optional(Schema.String),
}) {}

export class ConnectInlet extends Schema.TaggedClass<ConnectInlet>()("ConnectInlet", {
  channelId: ChannelId,
  inletId: InletId,
  sourceId: Schema.String,
}) {}

export class DisconnectInlet extends Schema.TaggedClass<DisconnectInlet>()("DisconnectInlet", {
  channelId: ChannelId,
  inletId: InletId,
}) {}

export class SubscribeOutlet extends Schema.TaggedClass<SubscribeOutlet>()("SubscribeOutlet", {
  channelId: ChannelId,
  outletId: OutletId,
  subscriberId: Schema.String,
}) {}

export class UnsubscribeOutlet extends Schema.TaggedClass<UnsubscribeOutlet>()("UnsubscribeOutlet", {
  channelId: ChannelId,
  outletId: OutletId,
  subscriberId: Schema.String,
}) {}

export class ResetCircuitBreaker extends Schema.TaggedClass<ResetCircuitBreaker>()("ResetCircuitBreaker", {
  channelId: ChannelId,
}) {}

/** Union of all channel commands */
export const ChannelCommand = Schema.Union(
  OpenChannel,
  CloseChannel,
  ConnectInlet,
  DisconnectInlet,
  SubscribeOutlet,
  UnsubscribeOutlet,
  ResetCircuitBreaker
)
export type ChannelCommand = typeof ChannelCommand.Type

// ============================================================================
// CHANNEL EVENTS — Observable state changes
// ============================================================================

export class ChannelOpened extends Schema.TaggedClass<ChannelOpened>()("ChannelOpened", {
  channelId: ChannelId,
  timestamp: Schema.Number,
}) {}

export class ChannelClosed extends Schema.TaggedClass<ChannelClosed>()("ChannelClosed", {
  channelId: ChannelId,
  reason: Schema.optional(Schema.String),
  timestamp: Schema.Number,
}) {}

export class ChannelFaulted extends Schema.TaggedClass<ChannelFaulted>()("ChannelFaulted", {
  channelId: ChannelId,
  error: Schema.String,
  timestamp: Schema.Number,
}) {}

export class InletConnected extends Schema.TaggedClass<InletConnected>()("InletConnected", {
  channelId: ChannelId,
  inletId: InletId,
  sourceId: Schema.String,
  timestamp: Schema.Number,
}) {}

export class InletDisconnected extends Schema.TaggedClass<InletDisconnected>()("InletDisconnected", {
  channelId: ChannelId,
  inletId: InletId,
  timestamp: Schema.Number,
}) {}

export class OutletSubscribed extends Schema.TaggedClass<OutletSubscribed>()("OutletSubscribed", {
  channelId: ChannelId,
  outletId: OutletId,
  subscriberId: Schema.String,
  timestamp: Schema.Number,
}) {}

export class OutletUnsubscribed extends Schema.TaggedClass<OutletUnsubscribed>()("OutletUnsubscribed", {
  channelId: ChannelId,
  outletId: OutletId,
  subscriberId: Schema.String,
  timestamp: Schema.Number,
}) {}

export class CircuitBreakerTripped extends Schema.TaggedClass<CircuitBreakerTripped>()("CircuitBreakerTripped", {
  channelId: ChannelId,
  failureCount: Schema.Number,
  timestamp: Schema.Number,
}) {}

export class CircuitBreakerReset extends Schema.TaggedClass<CircuitBreakerReset>()("CircuitBreakerReset", {
  channelId: ChannelId,
  timestamp: Schema.Number,
}) {}

export class TimeoutOccurred extends Schema.TaggedClass<TimeoutOccurred>()("TimeoutOccurred", {
  channelId: ChannelId,
  inletId: Schema.optional(InletId),
  duration: Schema.String,
  timestamp: Schema.Number,
}) {}

export class BackpressureEngaged extends Schema.TaggedClass<BackpressureEngaged>()("BackpressureEngaged", {
  channelId: ChannelId,
  strategy: BackpressureStrategy,
  bufferSize: Schema.Number,
  timestamp: Schema.Number,
}) {}

/** Union of all channel events */
export const ChannelEvent = Schema.Union(
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
export type ChannelEvent = typeof ChannelEvent.Type

// ============================================================================
// BIDIRECTIONAL — Request/Response patterns (NATS-style)
// ============================================================================

/**
 * Request envelope with correlation.
 * Use ChannelRequest.make(payloadSchema) to create typed variants.
 */
export const ChannelRequest = <A, I, R>(payloadSchema: Schema.Schema<A, I, R>) =>
  Schema.TaggedStruct("ChannelRequest", {
    correlationId: CorrelationId,
    channelId: ChannelId,
    payload: payloadSchema,
    replyTo: Schema.optional(OutletId),
    timestamp: Schema.Number,
    ttl: Schema.optional(Schema.Number), // Time-to-live in ms
  })

/**
 * Response envelope with correlation.
 * Use ChannelResponse.make(payloadSchema) to create typed variants.
 */
export const ChannelResponse = <A, I, R>(payloadSchema: Schema.Schema<A, I, R>) =>
  Schema.TaggedStruct("ChannelResponse", {
    correlationId: CorrelationId,
    channelId: ChannelId,
    payload: payloadSchema,
    /** Whether this is the final response (for streaming responses) */
    final: Schema.Boolean,
    timestamp: Schema.Number,
  })

/** Acknowledgment for reliable delivery */
export class ChannelAck extends Schema.TaggedClass<ChannelAck>()("ChannelAck", {
  correlationId: CorrelationId,
  channelId: ChannelId,
  timestamp: Schema.Number,
}) {}

/** Negative acknowledgment */
export class ChannelNack extends Schema.TaggedClass<ChannelNack>()("ChannelNack", {
  correlationId: CorrelationId,
  channelId: ChannelId,
  reason: Schema.String,
  timestamp: Schema.Number,
}) {}

// ============================================================================
// CHANNEL STATE — Complete channel representation
// ============================================================================

export class ChannelTopology extends Schema.TaggedClass<ChannelTopology>()("ChannelTopology", {
  inlets: Schema.Array(Inlet),
  outlets: Schema.Array(Outlet),
  junctions: Schema.Array(Junction),
  wires: Schema.Array(Wire),
}) {}

export class ChannelMetrics extends Schema.TaggedClass<ChannelMetrics>()("ChannelMetrics", {
  messagesIn: Schema.Number,
  messagesOut: Schema.Number,
  bytesIn: Schema.Number,
  bytesOut: Schema.Number,
  errors: Schema.Number,
  latencyMs: Schema.Number, // Average latency
  uptime: Schema.Number, // Milliseconds since open
}) {}

/** Complete channel state */
export class ChannelState extends Schema.TaggedClass<ChannelState>()("ChannelState", {
  id: ChannelId,
  name: Schema.String,
  status: ChannelStatus,
  topology: ChannelTopology,
  protocol: ChannelProtocol,
  metrics: ChannelMetrics,
  createdAt: Schema.Number,
  openedAt: Schema.optional(Schema.Number),
  closedAt: Schema.optional(Schema.Number),
}) {}

// ============================================================================
// CHANNEL CONFIG — Builder input
// ============================================================================

export class ChannelConfig extends Schema.TaggedClass<ChannelConfig>()("ChannelConfig", {
  id: Schema.String, // Will be branded on creation
  name: Schema.String,
  description: Schema.optional(Schema.String),
  protocol: Schema.optional(ChannelProtocol),
}) {}
