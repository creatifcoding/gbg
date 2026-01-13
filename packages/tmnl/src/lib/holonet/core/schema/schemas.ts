/**
 * Schema Registry Schemas
 *
 * Core schemas and error types for the SchemaRegistry service.
 *
 * @module holonet/core/schema/schemas
 */

import { Schema, Data } from 'effect';

// =============================================================================
// Schemas
// =============================================================================

/**
 * Schema metadata stored per stream in NATS KV.
 *
 * When a stream is created with a Content-Type header like:
 * `application/json; schema=BlockEvent`
 *
 * This metadata is extracted and stored in the STREAM_META KV bucket.
 */
export const StreamSchemaMeta = Schema.Struct({
  /** Schema ID for lookup (e.g., 'BlockEvent', 'GeointEvent') */
  schemaId: Schema.String,
  /** MIME type (e.g., 'application/json') */
  contentType: Schema.String,
  /** Optional schema version for evolution */
  version: Schema.optional(Schema.Number),
  /** Optional Standard Schema V1 JSON representation for client introspection */
  standardSchema: Schema.optional(Schema.Unknown),
  /** Timestamp when schema was registered for this stream */
  registeredAt: Schema.Number,
});
export type StreamSchemaMeta = typeof StreamSchemaMeta.Type;

/**
 * Schema ID type - branded for type safety
 */
export const SchemaId = Schema.String.pipe(Schema.brand('SchemaId'));
export type SchemaId = typeof SchemaId.Type;

/**
 * Stream ID type - branded for type safety
 */
export const StreamId = Schema.String.pipe(Schema.brand('StreamId'));
export type StreamId = typeof StreamId.Type;

// =============================================================================
// Errors
// =============================================================================

/**
 * Error thrown when a schema ID is not found in the registry.
 */
export class SchemaNotFoundError extends Data.TaggedError('SchemaNotFoundError')<{
  readonly schemaId: string;
  readonly message?: string;
}> {
  override get message(): string {
    return this.message ?? `Schema not found: '${this.schemaId}'`;
  }
}

/**
 * Error thrown when schema metadata is not found for a stream.
 */
export class StreamSchemaNotFoundError extends Data.TaggedError('StreamSchemaNotFoundError')<{
  readonly streamId: string;
  readonly message?: string;
}> {
  override get message(): string {
    return this.message ?? `Schema metadata not found for stream: '${this.streamId}'`;
  }
}

/**
 * Error thrown when a schema is already registered with the same ID.
 */
export class SchemaAlreadyRegisteredError extends Data.TaggedError('SchemaAlreadyRegisteredError')<{
  readonly schemaId: string;
  readonly message?: string;
}> {
  override get message(): string {
    return this.message ?? `Schema already registered: '${this.schemaId}'`;
  }
}

/**
 * Error thrown when Content-Type parsing fails.
 */
export class ContentTypeParseError extends Data.TaggedError('ContentTypeParseError')<{
  readonly contentType: string;
  readonly reason: string;
}> {
  override get message(): string {
    return `Failed to parse Content-Type '${this.contentType}': ${this.reason}`;
  }
}
