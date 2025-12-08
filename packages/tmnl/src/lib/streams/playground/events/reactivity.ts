/**
 * Streams Playground Reactivity Bindings
 *
 * Defines which events invalidate which reactive keys.
 * Uses EventLog.groupReactivity() to register key invalidation.
 *
 * @module
 */

import * as Layer from "effect/Layer"
import { EventLog } from "@effect/experimental"
import {
  ScenarioEvents,
  DataFlowEvents,
  BackpressureEvents,
  CircuitBreakerEvents,
  MetricsEvents,
} from "./index"

// ============================================================================
// REACTIVITY KEYS
// ============================================================================

/**
 * Reactivity key constants for the playground.
 * Use these in Reactivity.stream([...keys], effect) calls.
 */
export const Keys = {
  /** Invalidated by scenario events */
  scenario: "playground:scenario",
  /** Invalidated by throughput changes */
  throughput: "playground:throughput",
  /** Invalidated by latency samples */
  latency: "playground:latency",
  /** Invalidated by backpressure events */
  backpressure: "playground:backpressure",
  /** Invalidated by circuit breaker events */
  circuitBreaker: "playground:circuit-breaker",
  /** Invalidated by data flow events */
  dataFlow: "playground:data-flow",
  /** Invalidated by all metrics */
  metrics: "playground:metrics",
  /** Invalidated by everything */
  all: "playground:all",
} as const

// ============================================================================
// SCENARIO REACTIVITY
// ============================================================================

export const ScenarioReactivityLive = EventLog.groupReactivity(
  ScenarioEvents,
  {
    ScenarioStarted: [Keys.scenario, Keys.all],
    ScenarioPaused: [Keys.scenario, Keys.all],
    ScenarioResumed: [Keys.scenario, Keys.all],
    ScenarioCompleted: [Keys.scenario, Keys.all],
    ScenarioErrored: [Keys.scenario, Keys.all],
    ScenarioReset: [Keys.scenario, Keys.all],
  }
)

// ============================================================================
// DATA FLOW REACTIVITY
// ============================================================================

export const DataFlowReactivityLive = EventLog.groupReactivity(
  DataFlowEvents,
  {
    DataEmitted: [Keys.dataFlow, Keys.throughput, Keys.all],
    StreamCompleted: [Keys.dataFlow, Keys.all],
    StreamErrored: [Keys.dataFlow, Keys.all],
  }
)

// ============================================================================
// BACKPRESSURE REACTIVITY
// ============================================================================

export const BackpressureReactivityLive = EventLog.groupReactivity(
  BackpressureEvents,
  {
    BackpressureEngaged: [Keys.backpressure, Keys.all],
    BackpressureReleased: [Keys.backpressure, Keys.all],
    ItemsDropped: [Keys.backpressure, Keys.all],
  }
)

// ============================================================================
// CIRCUIT BREAKER REACTIVITY
// ============================================================================

export const CircuitBreakerReactivityLive = EventLog.groupReactivity(
  CircuitBreakerEvents,
  {
    CircuitStateChanged: [Keys.circuitBreaker, Keys.all],
    FailureRecorded: [Keys.circuitBreaker, Keys.all],
    SuccessRecorded: [Keys.circuitBreaker, Keys.all],
  }
)

// ============================================================================
// METRICS REACTIVITY
// ============================================================================

export const MetricsReactivityLive = EventLog.groupReactivity(
  MetricsEvents,
  {
    ThroughputSampled: [Keys.throughput, Keys.metrics, Keys.all],
    LatencySampled: [Keys.latency, Keys.metrics, Keys.all],
  }
)

// ============================================================================
// COMBINED REACTIVITY
// ============================================================================

/**
 * Complete reactivity layer for the playground.
 * Provides all key bindings for auto-invalidation.
 */
export const PlaygroundReactivityLive = Layer.mergeAll(
  ScenarioReactivityLive,
  DataFlowReactivityLive,
  BackpressureReactivityLive,
  CircuitBreakerReactivityLive,
  MetricsReactivityLive
)
