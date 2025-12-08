/**
 * Streams Playground Types
 *
 * Schema-backed types for playground state and metrics.
 * All domain types are Effect Schemas for runtime validation
 * and EventLog compatibility.
 *
 * @module
 */

import { Schema } from "effect"

// ============================================================================
// IDENTIFIERS
// ============================================================================

/** Branded scenario identifier */
export const ScenarioId = Schema.String.pipe(
  Schema.brand("ScenarioId"),
  Schema.annotations({ identifier: "ScenarioId" })
)
export type ScenarioId = typeof ScenarioId.Type

/** Branded source identifier (feed/stream) */
export const SourceId = Schema.String.pipe(
  Schema.brand("SourceId"),
  Schema.annotations({ identifier: "SourceId" })
)
export type SourceId = typeof SourceId.Type

// ============================================================================
// SCENARIO
// ============================================================================

/** Scenario category for grouping */
export const ScenarioCategory = Schema.Literal(
  "throughput",
  "backpressure",
  "circuit",
  "topology",
  "mixed"
)
export type ScenarioCategory = typeof ScenarioCategory.Type

/** Scenario status */
export const ScenarioStatus = Schema.Literal(
  "idle",
  "running",
  "paused",
  "completed",
  "error"
)
export type ScenarioStatus = typeof ScenarioStatus.Type

/** Scenario definition */
export class ScenarioConfig extends Schema.TaggedClass<ScenarioConfig>()(
  "ScenarioConfig",
  {
    id: ScenarioId,
    name: Schema.String,
    description: Schema.String,
    category: ScenarioCategory,
    /** Duration in milliseconds (0 = indefinite) */
    durationMs: Schema.Number,
    /** Target events per second */
    targetThroughput: Schema.Number,
  }
) {}

// ============================================================================
// METRICS
// ============================================================================

/** Throughput metrics snapshot */
export class ThroughputMetrics extends Schema.TaggedClass<ThroughputMetrics>()(
  "ThroughputMetrics",
  {
    /** Current events per second */
    eventsPerSecond: Schema.Number,
    /** Total events emitted */
    totalEvents: Schema.Number,
    /** Peak events per second */
    peakEventsPerSecond: Schema.Number,
    /** Average events per second */
    avgEventsPerSecond: Schema.Number,
    /** Timestamp of snapshot */
    timestamp: Schema.Number,
  }
) {}

/** Latency metrics snapshot */
export class LatencyMetrics extends Schema.TaggedClass<LatencyMetrics>()(
  "LatencyMetrics",
  {
    /** Minimum latency (ms) */
    minMs: Schema.Number,
    /** Maximum latency (ms) */
    maxMs: Schema.Number,
    /** Average latency (ms) */
    avgMs: Schema.Number,
    /** P50 latency (ms) */
    p50Ms: Schema.Number,
    /** P95 latency (ms) */
    p95Ms: Schema.Number,
    /** P99 latency (ms) */
    p99Ms: Schema.Number,
    /** Sample count */
    sampleCount: Schema.Number,
    /** Timestamp of snapshot */
    timestamp: Schema.Number,
  }
) {}

/** Circuit breaker state */
export const CircuitState = Schema.Literal("closed", "open", "half-open")
export type CircuitState = typeof CircuitState.Type

/** Circuit breaker metrics */
export class CircuitBreakerMetrics extends Schema.TaggedClass<CircuitBreakerMetrics>()(
  "CircuitBreakerMetrics",
  {
    state: CircuitState,
    failureCount: Schema.Number,
    successCount: Schema.Number,
    /** Time until next state transition attempt (ms) */
    nextTransitionMs: Schema.optional(Schema.Number),
    /** Last state change timestamp */
    lastStateChange: Schema.Number,
  }
) {}

/** Backpressure strategy */
export const BackpressureStrategy = Schema.Literal(
  "block",
  "drop-oldest",
  "drop-newest",
  "error"
)
export type BackpressureStrategy = typeof BackpressureStrategy.Type

/** Backpressure metrics */
export class BackpressureMetrics extends Schema.TaggedClass<BackpressureMetrics>()(
  "BackpressureMetrics",
  {
    strategy: BackpressureStrategy,
    /** Current buffer fill (0-1) */
    bufferFill: Schema.Number,
    /** Total items dropped */
    droppedCount: Schema.Number,
    /** Is backpressure currently engaged? */
    isEngaged: Schema.Boolean,
    timestamp: Schema.Number,
  }
) {}

/** Combined playground metrics */
export class PlaygroundMetrics extends Schema.TaggedClass<PlaygroundMetrics>()(
  "PlaygroundMetrics",
  {
    throughput: ThroughputMetrics,
    latency: LatencyMetrics,
    circuitBreaker: Schema.optional(CircuitBreakerMetrics),
    backpressure: Schema.optional(BackpressureMetrics),
    /** Scenario runtime (ms) */
    runtimeMs: Schema.Number,
  }
) {}

// ============================================================================
// PLAYGROUND STATE
// ============================================================================

/** Complete playground state */
export class PlaygroundState extends Schema.TaggedClass<PlaygroundState>()(
  "PlaygroundState",
  {
    /** Active scenario */
    activeScenario: Schema.optional(ScenarioConfig),
    /** Scenario status */
    status: ScenarioStatus,
    /** Current metrics */
    metrics: PlaygroundMetrics,
    /** Start timestamp */
    startedAt: Schema.optional(Schema.Number),
    /** Error message if status is "error" */
    error: Schema.optional(Schema.String),
  }
) {}

// ============================================================================
// TIMESERIES DATA
// ============================================================================

/** Single data point for D3 charts */
export class TimeseriesPoint extends Schema.TaggedClass<TimeseriesPoint>()(
  "TimeseriesPoint",
  {
    timestamp: Schema.Number,
    value: Schema.Number,
  }
) {}

/** Timeseries buffer for rolling windows */
export class TimeseriesBuffer extends Schema.TaggedClass<TimeseriesBuffer>()(
  "TimeseriesBuffer",
  {
    /** Buffer name/id */
    name: Schema.String,
    /** Data points */
    points: Schema.Array(TimeseriesPoint),
    /** Maximum points to retain */
    maxPoints: Schema.Number,
  }
) {}

// ============================================================================
// DEFAULTS
// ============================================================================

/** Default throughput metrics */
export const defaultThroughputMetrics = (): ThroughputMetrics =>
  new ThroughputMetrics({
    eventsPerSecond: 0,
    totalEvents: 0,
    peakEventsPerSecond: 0,
    avgEventsPerSecond: 0,
    timestamp: 0, // 0 = sentinel for "no data yet"
  })

/** Default latency metrics */
export const defaultLatencyMetrics = (): LatencyMetrics =>
  new LatencyMetrics({
    minMs: 0,
    maxMs: 0,
    avgMs: 0,
    p50Ms: 0,
    p95Ms: 0,
    p99Ms: 0,
    sampleCount: 0,
    timestamp: 0, // 0 = sentinel for "no data yet"
  })

/** Default playground metrics */
export const defaultPlaygroundMetrics = (): PlaygroundMetrics =>
  new PlaygroundMetrics({
    throughput: defaultThroughputMetrics(),
    latency: defaultLatencyMetrics(),
    runtimeMs: 0,
  })

/** Default playground state */
export const defaultPlaygroundState = (): PlaygroundState =>
  new PlaygroundState({
    status: "idle",
    metrics: defaultPlaygroundMetrics(),
  })
