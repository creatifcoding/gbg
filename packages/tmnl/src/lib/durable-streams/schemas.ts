/**
 * Durable Streams Schemas
 *
 * Effect Schema definitions for the durable streams protocol.
 * Following Schema Discipline from CLAUDE.md.
 */

import { Schema } from 'effect';

// ============================================================================
// Offset (opaque string)
// ============================================================================

/**
 * Stream offset - opaque to the client.
 * Special value "-1" means start of stream.
 */
export const Offset = Schema.String.pipe(Schema.brand('DurableStreamOffset'));
export type Offset = typeof Offset.Type;

/**
 * Start of stream sentinel value
 */
export const OFFSET_START: Offset = '-1' as Offset;

// ============================================================================
// Live Mode
// ============================================================================

/**
 * Live mode for reading from a stream.
 * - false: Catch-up only, stop at first upToDate
 * - "auto": Behavior driven by consumption method
 * - "long-poll": Explicit long-poll for live updates
 * - "sse": Server-sent events for live updates
 */
export const LiveMode = Schema.Union(
  Schema.Literal(false),
  Schema.Literal('auto'),
  Schema.Literal('long-poll'),
  Schema.Literal('sse')
);
export type LiveMode = typeof LiveMode.Type;

// ============================================================================
// Stream Configuration
// ============================================================================

/**
 * Configuration for creating a stream
 */
export const StreamCreateConfig = Schema.Struct({
  /** Full URL to the durable stream endpoint */
  url: Schema.String,
  /** Content type (e.g., "application/json", "text/plain") */
  contentType: Schema.optional(Schema.String),
  /** Time-to-live in seconds */
  ttlSeconds: Schema.optional(Schema.Number),
  /** Expiration timestamp (ISO 8601) */
  expiresAt: Schema.optional(Schema.String),
  /** Initial body content */
  body: Schema.optional(Schema.Unknown),
});
export type StreamCreateConfig = typeof StreamCreateConfig.Type;

/**
 * Configuration for connecting to an existing stream
 */
export const StreamConnectConfig = Schema.Struct({
  /** Full URL to the durable stream endpoint */
  url: Schema.String,
  /** Optional authorization headers */
  headers: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
});
export type StreamConnectConfig = typeof StreamConnectConfig.Type;

/**
 * Configuration for reading from a stream
 */
export const StreamReadConfig = Schema.Struct({
  /** Starting offset (defaults to "-1" for beginning) */
  offset: Schema.optional(Schema.String),
  /** Live mode */
  live: Schema.optional(LiveMode),
  /** Treat content as JSON */
  json: Schema.optional(Schema.Boolean),
});
export type StreamReadConfig = typeof StreamReadConfig.Type;

// ============================================================================
// Stream Metadata
// ============================================================================

/**
 * Metadata returned from HEAD request
 */
export const StreamMetadata = Schema.Struct({
  exists: Schema.Boolean,
  contentType: Schema.optional(Schema.String),
  offset: Schema.optional(Schema.String),
  etag: Schema.optional(Schema.String),
  cacheControl: Schema.optional(Schema.String),
});
export type StreamMetadata = typeof StreamMetadata.Type;

// ============================================================================
// JSON Batch (for subscribeJson)
// ============================================================================

/**
 * Batch of JSON items from a stream read
 */
export const JsonBatch = <T extends Schema.Schema.AnyNoContext>(itemSchema: T) =>
  Schema.Struct({
    items: Schema.Array(itemSchema),
    offset: Schema.String,
    upToDate: Schema.Boolean,
  });

/**
 * Generic JSON batch type
 */
export type JsonBatch<T> = {
  readonly items: readonly T[];
  readonly offset: string;
  readonly upToDate: boolean;
};

// ============================================================================
// Stream Events (for block system integration)
// ============================================================================

/**
 * Base stream event with timestamp
 */
export const StreamEventBase = Schema.Struct({
  timestamp: Schema.Number,
});

/**
 * Stream opened event
 */
export const StreamOpened = Schema.TaggedStruct('StreamOpened', {
  url: Schema.String,
  contentType: Schema.optional(Schema.String),
  timestamp: Schema.Number,
});
export type StreamOpened = typeof StreamOpened.Type;

/**
 * Stream closed event
 */
export const StreamClosed = Schema.TaggedStruct('StreamClosed', {
  url: Schema.String,
  reason: Schema.optional(Schema.String),
  timestamp: Schema.Number,
});
export type StreamClosed = typeof StreamClosed.Type;

/**
 * Stream error event
 */
export const StreamError = Schema.TaggedStruct('StreamError', {
  url: Schema.String,
  code: Schema.String,
  message: Schema.String,
  timestamp: Schema.Number,
});
export type StreamError = typeof StreamError.Type;

/**
 * Stream data received event
 */
export const StreamDataReceived = Schema.TaggedStruct('StreamDataReceived', {
  url: Schema.String,
  offset: Schema.String,
  itemCount: Schema.Number,
  upToDate: Schema.Boolean,
  timestamp: Schema.Number,
});
export type StreamDataReceived = typeof StreamDataReceived.Type;

/**
 * Union of all stream lifecycle events
 */
export const StreamLifecycleEvent = Schema.Union(
  StreamOpened,
  StreamClosed,
  StreamError,
  StreamDataReceived
);
export type StreamLifecycleEvent = typeof StreamLifecycleEvent.Type;
