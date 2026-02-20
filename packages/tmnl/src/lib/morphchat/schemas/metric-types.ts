/**
 * MetricEntry — Schema for harness metrics events.
 *
 * Captures chat:v2/metric events (firstDeltaLagMs, toolRoundTripMs,
 * ackLatencyMs, retryCount) and chat:v2/provider_marker events.
 *
 * @module morphchat/schemas/metric-types
 */

import { Schema } from 'effect'

// =============================================================================
// Metric Entry Schema
// =============================================================================

export const MetricEntry = Schema.Struct({
  /** Metric name (e.g. 'firstDeltaLagMs', 'toolRoundTripMs') */
  metric: Schema.String,
  /** Metric value */
  value: Schema.Number,
  /** Associated message ID (optional) */
  messageId: Schema.optional(Schema.String),
  /** Associated tool call ID (optional) */
  toolCallId: Schema.optional(Schema.String),
  /** Timestamp when metric was recorded */
  at: Schema.Number,
})
export type MetricEntry = typeof MetricEntry.Type

// =============================================================================
// Provider Marker Schema
// =============================================================================

export const ProviderMarker = Schema.Struct({
  /** Provider name (e.g. 'anthropic', 'openai') */
  provider: Schema.String,
  /** Model ID used */
  model: Schema.optional(Schema.String),
  /** Timestamp */
  at: Schema.Number,
})
export type ProviderMarker = typeof ProviderMarker.Type
