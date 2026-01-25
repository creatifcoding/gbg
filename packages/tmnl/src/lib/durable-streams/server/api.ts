/**
 * Durable Streams Server API
 *
 * HttpApi definition for the durable streams server.
 * Type-safe API with automatic OpenAPI generation.
 *
 * @module @gbg/tmnl/durable-streams/server/api
 */

import { Schema } from 'effect'
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from '@effect/platform'
import {
  AppendPayload,
  AppendResult,
  ReadParams,
  StreamData,
  StreamMetadataResponse,
  HealthStatus,
} from './models'

// ─────────────────────────────────────────────────────────────────────────────
// Error Schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stream not found error (404)
 */
export class StreamNotFound extends Schema.TaggedError<StreamNotFound>()(
  'StreamNotFound',
  {
    streamId: Schema.String,
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 404 })
) {}

/**
 * Stream already exists error (409)
 */
export class StreamExists extends Schema.TaggedError<StreamExists>()(
  'StreamExists',
  {
    streamId: Schema.String,
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 409 })
) {}

/**
 * Internal server error (500)
 */
export class InternalError extends Schema.TaggedError<InternalError>()(
  'InternalError',
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

// ─────────────────────────────────────────────────────────────────────────────
// Path Parameters
// ─────────────────────────────────────────────────────────────────────────────

const streamIdParam = HttpApiSchema.param('streamId', Schema.String)

// ─────────────────────────────────────────────────────────────────────────────
// Streams API Group
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Streams API group
 *
 * Endpoints for stream CRUD operations.
 */
class StreamsApi extends HttpApiGroup.make('streams')
  // POST /v1/stream/:streamId - Append to stream (creates if not exists)
  .add(
    HttpApiEndpoint.post('append')`/v1/stream/${streamIdParam}`
      .setPayload(AppendPayload)
      .addSuccess(AppendResult)
      .addError(InternalError)
  )
  // GET /v1/stream/:streamId - Read from stream
  .add(
    HttpApiEndpoint.get('read')`/v1/stream/${streamIdParam}`
      .setUrlParams(ReadParams)
      .addSuccess(StreamData)
      .addError(StreamNotFound)
      .addError(InternalError)
  )
  // HEAD /v1/stream/:streamId - Check if stream exists
  .add(
    HttpApiEndpoint.head('exists')`/v1/stream/${streamIdParam}`
      .addSuccess(Schema.Void)
      .addError(StreamNotFound)
  )
  // DELETE /v1/stream/:streamId - Delete stream
  .add(
    HttpApiEndpoint.del('delete')`/v1/stream/${streamIdParam}`
      .addSuccess(Schema.Void)
      .addError(InternalError)
  )
  // GET /v1/stream/:streamId/metadata - Get stream metadata
  .add(
    HttpApiEndpoint.get('metadata')`/v1/stream/${streamIdParam}/metadata`
      .addSuccess(StreamMetadataResponse)
      .addError(InternalError)
  )
  .annotateContext(OpenApi.annotations({
    title: 'Streams API',
    description: 'Durable stream CRUD operations',
  }))
{}

// ─────────────────────────────────────────────────────────────────────────────
// Health API Group (Top-Level)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Health API group
 *
 * Health check endpoint at root level.
 */
class HealthApi extends HttpApiGroup.make('health', { topLevel: true })
  .add(
    HttpApiEndpoint.get('check', '/health')
      .addSuccess(HealthStatus)
  )
  .annotateContext(OpenApi.annotations({
    title: 'Health API',
    description: 'Health check endpoints',
  }))
{}

// ─────────────────────────────────────────────────────────────────────────────
// Main API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Durable Streams API
 *
 * Combined API with all endpoint groups.
 */
export class DurableStreamsApi extends HttpApi.make('durable-streams')
  .add(StreamsApi)
  .add(HealthApi)
  .annotateContext(OpenApi.annotations({
    title: 'Durable Streams API',
    description: 'HTTP API for durable stream operations with SQLite persistence',
    version: '1.0.0',
  }))
{}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export { StreamsApi, HealthApi }
