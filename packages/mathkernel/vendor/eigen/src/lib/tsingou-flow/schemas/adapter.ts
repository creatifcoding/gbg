/**
 * Adapter Schemas — Health, errors, and lifecycle types for source adapters.
 *
 * These are shared across all adapter implementations. Individual adapters
 * have their own config schemas but share these operational types.
 *
 * @module tsingou-flow/schemas/adapter
 */

import { Schema } from 'effect'
import { SourceId } from './base-signal'

// =============================================================================
// Adapter Status
// =============================================================================

export const AdapterStatus = Schema.Literal(
  'disconnected',  // Not connected, not attempting
  'connecting',    // Connection in progress
  'connected',     // Active and receiving signals
  'degraded',      // Connected but experiencing errors
  'reconnecting',  // Lost connection, attempting recovery
  'error',         // Fatal error, needs manual intervention
)
export type AdapterStatus = typeof AdapterStatus.Type

// =============================================================================
// Adapter Health
// =============================================================================

/**
 * Health snapshot for a running adapter.
 * Polled or pushed by each adapter implementation.
 */
export const AdapterHealth = Schema.Struct({
  /** Current adapter status */
  status: AdapterStatus,

  /** When the last signal was successfully produced */
  lastSignalAt: Schema.optional(Schema.DateFromSelf),

  /** Total signals produced since last connect */
  signalCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),

  /** Total errors since last connect */
  errorCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),

  /** Average processing latency in milliseconds */
  latencyMs: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),

  /** Source-specific health details */
  details: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  })),
})
export type AdapterHealth = typeof AdapterHealth.Type

// =============================================================================
// Adapter Error
// =============================================================================

export const AdapterError = Schema.TaggedStruct('AdapterError', {
  /** Which adapter produced this error */
  adapterId: Schema.String,

  /** Source ID this adapter is bound to */
  sourceId: SourceId,

  /** Human-readable error message */
  message: Schema.String,

  /** Underlying cause (serializable) */
  cause: Schema.optional(Schema.Unknown),

  /** Whether the adapter should attempt recovery */
  retryable: Schema.Boolean,

  /** Timestamp of the error */
  timestamp: Schema.DateFromSelf,
})
export type AdapterError = typeof AdapterError.Type

// =============================================================================
// Adapter Lifecycle Events
// =============================================================================

export const AdapterLifecycleEvent = Schema.Union(
  Schema.TaggedStruct('AdapterRegistered', {
    adapterId: Schema.String,
    sourceId: SourceId,
    kind: Schema.String,
    timestamp: Schema.DateFromSelf,
  }),
  Schema.TaggedStruct('AdapterConnected', {
    adapterId: Schema.String,
    sourceId: SourceId,
    timestamp: Schema.DateFromSelf,
  }),
  Schema.TaggedStruct('AdapterDisconnected', {
    adapterId: Schema.String,
    sourceId: SourceId,
    reason: Schema.optional(Schema.String),
    timestamp: Schema.DateFromSelf,
  }),
  Schema.TaggedStruct('AdapterError', {
    adapterId: Schema.String,
    sourceId: SourceId,
    message: Schema.String,
    retryable: Schema.Boolean,
    timestamp: Schema.DateFromSelf,
  }),
  Schema.TaggedStruct('AdapterUnregistered', {
    adapterId: Schema.String,
    sourceId: SourceId,
    timestamp: Schema.DateFromSelf,
  }),
)
export type AdapterLifecycleEvent = typeof AdapterLifecycleEvent.Type
