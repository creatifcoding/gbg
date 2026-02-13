/**
 * IngestionAdapter Service Interface
 *
 * Protocol-agnostic ingestion adapter for IIoT sensor data.
 * Each protocol adapter (OPC-UA, Sparkplug B, Modbus) wraps its
 * library's push/poll API into an Effect Stream of IngestedReading.
 *
 * @module @gbg/tmnl/iiot/adapters/ingestion
 * @see Phase 5 Stream Architecture (Epic 19)
 */

import { Context, Effect, Schema, Stream } from 'effect'

// =============================================================================
// IngestedReading -- Protocol-normalized reading
// =============================================================================

/**
 * Protocol-normalized sensor reading.
 *
 * All protocol adapters emit IngestedReading instances. The downstream
 * pipeline (TopicRouter, QualityMapper, BatchProcessor) consumes these
 * and transforms them into SensorReading for persistence.
 */
export class IngestedReading extends Schema.TaggedClass<IngestedReading>()('IngestedReading', {
  /** Raw topic from protocol (e.g., MQTT topic, OPC-UA NodeId) */
  topic: Schema.String,
  /** Numeric value */
  value: Schema.Number,
  /** Timestamp from source (UTC) */
  sourceTimestamp: Schema.DateTimeUtc,
  /** Protocol-specific quality indicator (mapped to OpcUaQuality later) */
  sourceQuality: Schema.optional(Schema.String),
  /** Protocol metadata (extra fields from source) */
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}) {}

// =============================================================================
// IngestionError -- TaggedError with error codes
// =============================================================================

/**
 * Error emitted by ingestion adapters.
 *
 * Error codes:
 * - CONNECTION_FAILED: Cannot connect to data source
 * - AUTHENTICATION_FAILED: Credentials rejected
 * - SUBSCRIPTION_FAILED: Could not subscribe to topics/nodes
 * - DECODE_ERROR: Message payload could not be decoded
 * - TIMEOUT: Operation timed out
 * - PROTOCOL_ERROR: Protocol-level error (e.g., OPC-UA StatusCode)
 */
export class IngestionError extends Schema.TaggedError<IngestionError>()(
  'IngestionError',
  {
    /** Protocol name (opcua, sparkplug, modbus) */
    protocol: Schema.String,
    /** Human-readable error message */
    message: Schema.String,
    /** Machine-readable error code */
    code: Schema.Literal(
      'CONNECTION_FAILED',
      'AUTHENTICATION_FAILED',
      'SUBSCRIPTION_FAILED',
      'DECODE_ERROR',
      'TIMEOUT',
      'PROTOCOL_ERROR'
    ),
    /** Whether this error is transient and can be retried */
    retryable: Schema.Boolean,
  }
) {}

// =============================================================================
// IngestionHealth -- Health check response
// =============================================================================

/**
 * Health check response from an ingestion adapter.
 *
 * Used for monitoring and circuit-breaker logic.
 */
export const IngestionHealth = Schema.Struct({
  /** Protocol name */
  protocol: Schema.String,
  /** Whether the adapter is currently connected */
  connected: Schema.Boolean,
  /** Timestamp of last received message */
  lastMessageAt: Schema.optional(Schema.DateTimeUtc),
  /** Current throughput (messages per second) */
  messagesPerSecond: Schema.optional(Schema.Number),
  /** Cumulative error count since last connect */
  errorCount: Schema.Number,
})
export type IngestionHealth = Schema.Schema.Type<typeof IngestionHealth>

// =============================================================================
// IngestionAdapter -- Effect Service interface
// =============================================================================

/**
 * Shape of the IngestionAdapter service.
 *
 * Protocol adapters implement this interface to provide a uniform
 * streaming API regardless of the underlying transport.
 */
export interface IngestionAdapterShape {
  /** Protocol name for logging/metrics */
  readonly protocol: string

  /**
   * Connect to the data source and return a stream of readings.
   * The stream should handle reconnection internally.
   * Backpressure is handled by the pipeline consumer (Stream.groupedWithin).
   */
  readonly subscribe: Effect.Effect<
    Stream.Stream<IngestedReading, IngestionError>,
    IngestionError
  >

  /**
   * Health check -- is the connection alive?
   */
  readonly healthCheck: Effect.Effect<IngestionHealth, IngestionError>
}

/**
 * IngestionAdapter service tag.
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const adapter = yield* IngestionAdapter
 *   const stream = yield* adapter.subscribe
 *   // process stream...
 * })
 * ```
 */
export class IngestionAdapter extends Context.Tag('tmnl/iiot/IngestionAdapter')<
  IngestionAdapter,
  IngestionAdapterShape
>() {}
