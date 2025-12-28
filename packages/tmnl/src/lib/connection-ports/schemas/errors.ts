/**
 * Connection Ports Error Schemas
 *
 * TaggedErrors for typed failure handling in connection ports.
 *
 * @module connection-ports/schemas/errors
 */

import { Schema } from 'effect';

// =============================================================================
// NATS Errors
// =============================================================================

/**
 * NATS connection failure.
 */
export class NatsConnectionError extends Schema.TaggedError<NatsConnectionError>()(
  'NatsConnectionError',
  {
    /** Server URL that failed */
    server: Schema.String,

    /** Error message */
    message: Schema.String,

    /** Underlying error cause */
    cause: Schema.optional(Schema.Unknown),
  }
) {}

/**
 * NATS subscription failure.
 */
export class NatsSubscriptionError extends Schema.TaggedError<NatsSubscriptionError>()(
  'NatsSubscriptionError',
  {
    /** Subject that failed to subscribe */
    subject: Schema.String,

    /** Error message */
    message: Schema.String,

    /** Underlying error cause */
    cause: Schema.optional(Schema.Unknown),
  }
) {}

/**
 * NATS publish failure.
 */
export class NatsPublishError extends Schema.TaggedError<NatsPublishError>()(
  'NatsPublishError',
  {
    /** Subject that failed to publish to */
    subject: Schema.String,

    /** Error message */
    message: Schema.String,

    /** Underlying error cause */
    cause: Schema.optional(Schema.Unknown),
  }
) {}

/**
 * NATS KV operation failure.
 */
export class NatsKvError extends Schema.TaggedError<NatsKvError>()(
  'NatsKvError',
  {
    /** Bucket name */
    bucket: Schema.String,

    /** Key being accessed */
    key: Schema.String,

    /** Operation that failed */
    operation: Schema.Literal('get', 'put', 'delete', 'watch'),

    /** Error message */
    message: Schema.String,

    /** Underlying error cause */
    cause: Schema.optional(Schema.Unknown),
  }
) {}

// =============================================================================
// Durable Streams Errors
// =============================================================================

/**
 * Durable Streams connection failure.
 */
export class DurableStreamsConnectionError extends Schema.TaggedError<DurableStreamsConnectionError>()(
  'DurableStreamsConnectionError',
  {
    /** Server URL that failed */
    url: Schema.String,

    /** Error message */
    message: Schema.String,

    /** HTTP status code (if applicable) */
    statusCode: Schema.optional(Schema.Number),

    /** Underlying error cause */
    cause: Schema.optional(Schema.Unknown),
  }
) {}

/**
 * Durable Streams read failure.
 */
export class DurableStreamsReadError extends Schema.TaggedError<DurableStreamsReadError>()(
  'DurableStreamsReadError',
  {
    /** Stream URL */
    streamUrl: Schema.String,

    /** Offset that failed */
    offset: Schema.optional(Schema.String),

    /** Error message */
    message: Schema.String,

    /** HTTP status code (if applicable) */
    statusCode: Schema.optional(Schema.Number),

    /** Underlying error cause */
    cause: Schema.optional(Schema.Unknown),
  }
) {}

/**
 * Durable Streams append failure.
 */
export class DurableStreamsAppendError extends Schema.TaggedError<DurableStreamsAppendError>()(
  'DurableStreamsAppendError',
  {
    /** Stream URL */
    streamUrl: Schema.String,

    /** Error message */
    message: Schema.String,

    /** HTTP status code (if applicable) */
    statusCode: Schema.optional(Schema.Number),

    /** Underlying error cause */
    cause: Schema.optional(Schema.Unknown),
  }
) {}

// =============================================================================
// Generic Port Errors
// =============================================================================

/**
 * Schema decode failure when parsing stream data.
 */
export class StreamDecodeError extends Schema.TaggedError<StreamDecodeError>()(
  'StreamDecodeError',
  {
    /** Stream identifier */
    streamId: Schema.String,

    /** Raw data that failed to decode */
    rawData: Schema.Unknown,

    /** Expected schema name */
    expectedSchema: Schema.String,

    /** Parse error details */
    parseError: Schema.String,
  }
) {}

/**
 * Stream not found.
 */
export class StreamNotFoundError extends Schema.TaggedError<StreamNotFoundError>()(
  'StreamNotFoundError',
  {
    /** Stream identifier that wasn't found */
    streamId: Schema.String,

    /** Error message */
    message: Schema.String,
  }
) {}

/**
 * Stream already subscribed.
 */
export class StreamAlreadySubscribedError extends Schema.TaggedError<StreamAlreadySubscribedError>()(
  'StreamAlreadySubscribedError',
  {
    /** Stream identifier that's already subscribed */
    streamId: Schema.String,

    /** Error message */
    message: Schema.String,
  }
) {}

/**
 * Connection bus not initialized.
 */
export class ConnectionBusNotInitializedError extends Schema.TaggedError<ConnectionBusNotInitializedError>()(
  'ConnectionBusNotInitializedError',
  {
    /** Error message */
    message: Schema.String,
  }
) {}

// =============================================================================
// Union Types
// =============================================================================

/**
 * All NATS-related errors.
 */
export type NatsError =
  | NatsConnectionError
  | NatsSubscriptionError
  | NatsPublishError
  | NatsKvError;

/**
 * All Durable Streams-related errors.
 */
export type DurableStreamsError =
  | DurableStreamsConnectionError
  | DurableStreamsReadError
  | DurableStreamsAppendError;

/**
 * All connection ports errors.
 */
export type ConnectionPortsError =
  | NatsError
  | DurableStreamsError
  | StreamDecodeError
  | StreamNotFoundError
  | StreamAlreadySubscribedError
  | ConnectionBusNotInitializedError;
