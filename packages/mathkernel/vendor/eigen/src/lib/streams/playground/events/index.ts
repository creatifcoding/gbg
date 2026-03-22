/**
 * Streams Playground Events
 *
 * EventGroup definitions for the playground event log.
 * All events are schema-backed for runtime validation.
 *
 * @module
 */

import { EventGroup, EventLog } from "@effect/experimental"
import { Schema } from "effect"
import { ScenarioId, SourceId, CircuitState, BackpressureStrategy } from "../types"

// ============================================================================
// SCENARIO EVENTS
// ============================================================================

export const ScenarioEvents = EventGroup.empty
  .add({
    tag: "ScenarioStarted",
    primaryKey: (p) => p.scenarioId,
    payload: Schema.Struct({
      scenarioId: ScenarioId,
      name: Schema.String,
      category: Schema.String,
      timestamp: Schema.Number,
    }),
    success: Schema.Void,
  })
  .add({
    tag: "ScenarioPaused",
    primaryKey: (p) => p.scenarioId,
    payload: Schema.Struct({
      scenarioId: ScenarioId,
      timestamp: Schema.Number,
      runtimeMs: Schema.Number,
    }),
    success: Schema.Void,
  })
  .add({
    tag: "ScenarioResumed",
    primaryKey: (p) => p.scenarioId,
    payload: Schema.Struct({
      scenarioId: ScenarioId,
      timestamp: Schema.Number,
    }),
    success: Schema.Void,
  })
  .add({
    tag: "ScenarioCompleted",
    primaryKey: (p) => p.scenarioId,
    payload: Schema.Struct({
      scenarioId: ScenarioId,
      timestamp: Schema.Number,
      totalEvents: Schema.Number,
      durationMs: Schema.Number,
    }),
    success: Schema.Void,
  })
  .add({
    tag: "ScenarioErrored",
    primaryKey: (p) => p.scenarioId,
    payload: Schema.Struct({
      scenarioId: ScenarioId,
      timestamp: Schema.Number,
      error: Schema.String,
    }),
    success: Schema.Void,
  })
  .add({
    tag: "ScenarioReset",
    primaryKey: (p) => p.scenarioId,
    payload: Schema.Struct({
      scenarioId: ScenarioId,
      timestamp: Schema.Number,
    }),
    success: Schema.Void,
  })

// ============================================================================
// DATA FLOW EVENTS
// ============================================================================

export const DataFlowEvents = EventGroup.empty
  .add({
    tag: "DataEmitted",
    primaryKey: (p) => p.sourceId,
    payload: Schema.Struct({
      sourceId: SourceId,
      channelId: Schema.optional(Schema.String),
      timestamp: Schema.Number,
      latencyMs: Schema.Number,
      emitCount: Schema.Number,
    }),
    success: Schema.Void,
  })
  .add({
    tag: "StreamCompleted",
    primaryKey: (p) => p.sourceId,
    payload: Schema.Struct({
      sourceId: SourceId,
      timestamp: Schema.Number,
      totalEmissions: Schema.Number,
      durationMs: Schema.Number,
    }),
    success: Schema.Void,
  })
  .add({
    tag: "StreamErrored",
    primaryKey: (p) => p.sourceId,
    payload: Schema.Struct({
      sourceId: SourceId,
      timestamp: Schema.Number,
      error: Schema.String,
      emitCount: Schema.Number,
    }),
    success: Schema.Void,
  })

// ============================================================================
// BACKPRESSURE EVENTS
// ============================================================================

export const BackpressureEvents = EventGroup.empty
  .add({
    tag: "BackpressureEngaged",
    primaryKey: (p) => p.channelId,
    payload: Schema.Struct({
      channelId: Schema.String,
      strategy: BackpressureStrategy,
      bufferFill: Schema.Number,
      timestamp: Schema.Number,
    }),
    success: Schema.Void,
  })
  .add({
    tag: "BackpressureReleased",
    primaryKey: (p) => p.channelId,
    payload: Schema.Struct({
      channelId: Schema.String,
      timestamp: Schema.Number,
    }),
    success: Schema.Void,
  })
  .add({
    tag: "ItemsDropped",
    primaryKey: (p) => p.channelId,
    payload: Schema.Struct({
      channelId: Schema.String,
      count: Schema.Number,
      strategy: BackpressureStrategy,
      timestamp: Schema.Number,
    }),
    success: Schema.Void,
  })

// ============================================================================
// CIRCUIT BREAKER EVENTS
// ============================================================================

export const CircuitBreakerEvents = EventGroup.empty
  .add({
    tag: "CircuitStateChanged",
    primaryKey: (p) => p.channelId,
    payload: Schema.Struct({
      channelId: Schema.String,
      fromState: CircuitState,
      toState: CircuitState,
      failureCount: Schema.Number,
      timestamp: Schema.Number,
    }),
    success: Schema.Void,
  })
  .add({
    tag: "FailureRecorded",
    primaryKey: (p) => p.channelId,
    payload: Schema.Struct({
      channelId: Schema.String,
      error: Schema.String,
      failureCount: Schema.Number,
      threshold: Schema.Number,
      timestamp: Schema.Number,
    }),
    success: Schema.Void,
  })
  .add({
    tag: "SuccessRecorded",
    primaryKey: (p) => p.channelId,
    payload: Schema.Struct({
      channelId: Schema.String,
      successCount: Schema.Number,
      timestamp: Schema.Number,
    }),
    success: Schema.Void,
  })

// ============================================================================
// METRICS EVENTS
// ============================================================================

export const MetricsEvents = EventGroup.empty
  .add({
    tag: "ThroughputSampled",
    primaryKey: () => "metrics",
    payload: Schema.Struct({
      eventsPerSecond: Schema.Number,
      totalEvents: Schema.Number,
      timestamp: Schema.Number,
    }),
    success: Schema.Void,
  })
  .add({
    tag: "LatencySampled",
    primaryKey: () => "metrics",
    payload: Schema.Struct({
      latencyMs: Schema.Number,
      timestamp: Schema.Number,
    }),
    success: Schema.Void,
  })

// ============================================================================
// COMBINED SCHEMA
// ============================================================================

/**
 * Complete EventLog schema for the Streams Playground.
 */
export const StreamsPlaygroundEvents = EventLog.schema(
  ScenarioEvents,
  DataFlowEvents,
  BackpressureEvents,
  CircuitBreakerEvents,
  MetricsEvents
)

// ============================================================================
// EVENT TAGS
// ============================================================================

export type ScenarioEventTag =
  | "ScenarioStarted"
  | "ScenarioPaused"
  | "ScenarioResumed"
  | "ScenarioCompleted"
  | "ScenarioErrored"
  | "ScenarioReset"

export type DataFlowEventTag =
  | "DataEmitted"
  | "StreamCompleted"
  | "StreamErrored"

export type BackpressureEventTag =
  | "BackpressureEngaged"
  | "BackpressureReleased"
  | "ItemsDropped"

export type CircuitBreakerEventTag =
  | "CircuitStateChanged"
  | "FailureRecorded"
  | "SuccessRecorded"

export type MetricsEventTag =
  | "ThroughputSampled"
  | "LatencySampled"

export type PlaygroundEventTag =
  | ScenarioEventTag
  | DataFlowEventTag
  | BackpressureEventTag
  | CircuitBreakerEventTag
  | MetricsEventTag
