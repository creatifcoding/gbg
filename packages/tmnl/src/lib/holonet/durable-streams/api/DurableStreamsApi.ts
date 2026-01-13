/**
 * Durable-Streams NATS Bridge HttpApi
 *
 * Effect HttpApi definition for the durable-streams protocol fronting NATS.
 * Follows the durable-streams wire format for client compatibility.
 *
 * @see https://github.com/durable-streams/protocol
 * @module holonet/durable-streams/api/DurableStreamsApi
 */

import { Schema } from 'effect';
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from '@effect/platform';
import {
  StreamConfig,
  ReadResponse,
  AppendResult,
  HealthResponse,
} from '../schemas/protocol';

// =============================================================================
// Error Schemas (HttpApi-compatible)
// =============================================================================

/**
 * Invalid token error (401)
 */
export class ApiInvalidTokenError extends Schema.TaggedError<ApiInvalidTokenError>()(
  'ApiInvalidTokenError',
  {
    message: Schema.String,
    reason: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({ status: 401 })
) {}

/**
 * Forbidden error (403)
 */
export class ApiForbiddenError extends Schema.TaggedError<ApiForbiddenError>()(
  'ApiForbiddenError',
  {
    message: Schema.String,
    operation: Schema.optional(Schema.String),
    requiredPermission: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({ status: 403 })
) {}

/**
 * Invalid offset error (400)
 */
export class ApiInvalidOffsetError extends Schema.TaggedError<ApiInvalidOffsetError>()(
  'ApiInvalidOffsetError',
  {
    message: Schema.String,
    offset: Schema.String,
    reason: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({ status: 400 })
) {}

/**
 * Schema validation error (422)
 */
export class ApiSchemaValidationError extends Schema.TaggedError<ApiSchemaValidationError>()(
  'ApiSchemaValidationError',
  {
    message: Schema.String,
    schemaId: Schema.optional(Schema.String),
    errors: Schema.optional(Schema.Array(Schema.String)),
  },
  HttpApiSchema.annotations({ status: 422 })
) {}

/**
 * Stream not found error (404)
 */
export class ApiStreamNotFoundError extends Schema.TaggedError<ApiStreamNotFoundError>()(
  'ApiStreamNotFoundError',
  {
    streamId: Schema.String,
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 404 })
) {}

/**
 * Stream already exists error (409)
 */
export class ApiStreamExistsError extends Schema.TaggedError<ApiStreamExistsError>()(
  'ApiStreamExistsError',
  {
    streamId: Schema.String,
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 409 })
) {}

/**
 * Content type mismatch error (409)
 */
export class ApiContentTypeMismatchError extends Schema.TaggedError<ApiContentTypeMismatchError>()(
  'ApiContentTypeMismatchError',
  {
    message: Schema.String,
    streamId: Schema.String,
    expected: Schema.String,
    received: Schema.String,
  },
  HttpApiSchema.annotations({ status: 409 })
) {}

/**
 * Sequence conflict error (409) - producer idempotency conflict
 */
export class ApiSequenceConflictError extends Schema.TaggedError<ApiSequenceConflictError>()(
  'ApiSequenceConflictError',
  {
    message: Schema.String,
    streamId: Schema.String,
    expectedSeq: Schema.Number,
    receivedSeq: Schema.Number,
  },
  HttpApiSchema.annotations({ status: 409 })
) {}

/**
 * Long-poll timeout (204) - not an error, just no data
 */
export class ApiLongPollTimeoutError extends Schema.TaggedError<ApiLongPollTimeoutError>()(
  'ApiLongPollTimeoutError',
  {
    streamId: Schema.String,
    lastOffset: Schema.Number,
  },
  HttpApiSchema.annotations({ status: 204 })
) {}

/**
 * NATS connection error (503)
 */
export class ApiNatsConnectionError extends Schema.TaggedError<ApiNatsConnectionError>()(
  'ApiNatsConnectionError',
  {
    message: Schema.String,
    reason: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({ status: 503 })
) {}

/**
 * Internal server error (500)
 */
export class ApiInternalError extends Schema.TaggedError<ApiInternalError>()(
  'ApiInternalError',
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

// =============================================================================
// Path Parameters
// =============================================================================

const streamIdParam = HttpApiSchema.param('streamId', Schema.String);

// =============================================================================
// Request/Response Schemas (API-specific)
// =============================================================================

/**
 * Create stream request body
 */
export const CreateStreamRequest = Schema.Struct({
  contentType: Schema.String.pipe(
    Schema.annotations({
      description: 'MIME type with optional schema parameter (e.g., "application/json; schema=BlockEvent")',
    })
  ),
  retention: Schema.optional(Schema.Literal('limits', 'interest', 'workqueue')),
  maxAge: Schema.optional(Schema.Number.pipe(Schema.positive())),
  maxMessages: Schema.optional(Schema.Number.pipe(Schema.positive(), Schema.int())),
  maxBytes: Schema.optional(Schema.Number.pipe(Schema.positive(), Schema.int())),
});

export type CreateStreamRequest = typeof CreateStreamRequest.Type;

/**
 * Create stream response
 */
export const CreateStreamResponse = Schema.Struct({
  streamId: Schema.String,
  created: Schema.Boolean,
  config: StreamConfig,
});

export type CreateStreamResponse = typeof CreateStreamResponse.Type;

/**
 * Read query parameters (URL params)
 * Note: All URL params must be string-encodeable
 */
export const ReadQueryParams = Schema.Struct({
  offset: Schema.optionalWith(Schema.String, { default: () => '-1' }),
  limit: Schema.optionalWith(Schema.NumberFromString.pipe(Schema.int(), Schema.positive()), { default: () => 100 }),
  live: Schema.optional(Schema.Literal('long-poll', 'sse')),
  timeout: Schema.optionalWith(Schema.NumberFromString.pipe(Schema.positive()), { default: () => 30000 }),
});

export type ReadQueryParams = typeof ReadQueryParams.Type;

/**
 * Append request with optional producer headers
 */
export const AppendRequestBody = Schema.Struct({
  data: Schema.Unknown,
});

export type AppendRequestBody = typeof AppendRequestBody.Type;

/**
 * Producer idempotency headers (optional)
 */
export const ProducerQueryParams = Schema.Struct({
  producerId: Schema.optional(Schema.String),
  producerSeq: Schema.optional(Schema.NumberFromString.pipe(Schema.int())),
});

export type ProducerQueryParams = typeof ProducerQueryParams.Type;

// =============================================================================
// Streams API Group
// =============================================================================

/**
 * Streams API group - CRUD operations on durable streams
 */
class StreamsApi extends HttpApiGroup.make('streams')
  // PUT /v1/stream/:streamId - Create stream
  .add(
    HttpApiEndpoint.put('create')`/v1/stream/${streamIdParam}`
      .setPayload(CreateStreamRequest)
      .addSuccess(CreateStreamResponse, { status: 201 })
      .addError(ApiStreamExistsError)
      .addError(ApiForbiddenError)
      .addError(ApiNatsConnectionError)
      .addError(ApiInternalError)
  )
  // POST /v1/stream/:streamId - Append to stream
  .add(
    HttpApiEndpoint.post('append')`/v1/stream/${streamIdParam}`
      .setPayload(AppendRequestBody)
      .setUrlParams(ProducerQueryParams)
      .addSuccess(AppendResult, { status: 204 })
      .addError(ApiStreamNotFoundError)
      .addError(ApiSchemaValidationError)
      .addError(ApiContentTypeMismatchError)
      .addError(ApiSequenceConflictError)
      .addError(ApiForbiddenError)
      .addError(ApiNatsConnectionError)
      .addError(ApiInternalError)
  )
  // GET /v1/stream/:streamId - Read from stream (batch, long-poll, or SSE)
  .add(
    HttpApiEndpoint.get('read')`/v1/stream/${streamIdParam}`
      .setUrlParams(ReadQueryParams)
      .addSuccess(ReadResponse)
      .addError(ApiStreamNotFoundError)
      .addError(ApiInvalidOffsetError)
      .addError(ApiLongPollTimeoutError)
      .addError(ApiForbiddenError)
      .addError(ApiNatsConnectionError)
      .addError(ApiInternalError)
  )
  // HEAD /v1/stream/:streamId - Get stream metadata
  .add(
    HttpApiEndpoint.head('metadata')`/v1/stream/${streamIdParam}`
      .addSuccess(Schema.Void)
      .addError(ApiStreamNotFoundError)
  )
  // DELETE /v1/stream/:streamId - Delete stream
  .add(
    HttpApiEndpoint.del('delete')`/v1/stream/${streamIdParam}`
      .addSuccess(Schema.Void, { status: 204 })
      .addError(ApiStreamNotFoundError)
      .addError(ApiForbiddenError)
      .addError(ApiNatsConnectionError)
      .addError(ApiInternalError)
  )
  .annotateContext(OpenApi.annotations({
    title: 'Streams API',
    description: 'Durable stream CRUD operations backed by NATS JetStream',
  }))
{}

// =============================================================================
// Health API Group
// =============================================================================

/**
 * Health API group - Service health check
 */
class HealthApi extends HttpApiGroup.make('health', { topLevel: true })
  .add(
    HttpApiEndpoint.get('check', '/health')
      .addSuccess(HealthResponse)
  )
  .annotateContext(OpenApi.annotations({
    title: 'Health API',
    description: 'Service health and NATS connectivity checks',
  }))
{}

// =============================================================================
// Main API
// =============================================================================

/**
 * Durable-Streams NATS Bridge API
 *
 * HTTP API for durable stream operations backed by NATS JetStream.
 * Follows the durable-streams protocol for client compatibility.
 *
 * @example
 * ```typescript
 * import { HolonetDurableStreamsApi } from '@/lib/holonet/durable-streams/api'
 * import { HttpApiBuilder } from '@effect/platform'
 *
 * const handlers = HttpApiBuilder.group(HolonetDurableStreamsApi, 'streams', (handlers) =>
 *   handlers
 *     .handle('create', ({ path, payload }) => Effect.gen(function* () {
 *       // ...
 *     }))
 * )
 * ```
 */
export class HolonetDurableStreamsApi extends HttpApi.make('holonet-durable-streams')
  .add(StreamsApi)
  .add(HealthApi)
  .annotateContext(OpenApi.annotations({
    title: 'Holonet Durable-Streams API',
    description: 'Durable stream HTTP protocol backed by NATS JetStream for edge clients',
    version: '1.0.0',
  }))
{}

// =============================================================================
// Exports
// =============================================================================

export { StreamsApi, HealthApi };
