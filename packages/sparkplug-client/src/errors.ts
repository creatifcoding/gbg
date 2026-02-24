/**
 * SparkplugError — TaggedError for Sparkplug B operations.
 *
 * Covers all failure modes: connection, protocol, encoding,
 * topic resolution, alias lookup, and transport errors.
 *
 * @module @selfcharters/sparkplug-client/errors
 */

import { Schema } from 'effect'

/**
 * Error codes for Sparkplug B client operations.
 *
 * - CONNECTION_FAILED: Cannot connect to MQTT broker
 * - PROTOCOL_ERROR: Sparkplug protocol violation (e.g., missing bdSeq)
 * - ENCODE_ERROR: Protobuf encode/decode failure
 * - TOPIC_ERROR: Invalid Sparkplug topic format
 * - ALIAS_ERROR: Metric alias not found in registry
 * - TRANSPORT_ERROR: MQTT transport-level error
 */
export const SparkplugErrorCode = Schema.Literal(
  'CONNECTION_FAILED',
  'PROTOCOL_ERROR',
  'ENCODE_ERROR',
  'TOPIC_ERROR',
  'ALIAS_ERROR',
  'TRANSPORT_ERROR'
)
export type SparkplugErrorCode = Schema.Schema.Type<typeof SparkplugErrorCode>

export class SparkplugError extends Schema.TaggedError<SparkplugError>()(
  'SparkplugError',
  {
    code: SparkplugErrorCode,
    message: Schema.String,
    /** Whether this error is transient and can be retried */
    retryable: Schema.Boolean,
    /** Underlying cause (for wrapping mqtt.js errors) */
    cause: Schema.optional(Schema.Unknown),
  }
) {}
