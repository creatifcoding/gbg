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
// Live Mode (Tagged Union)
// ============================================================================

/**
 * Catch-up mode: Read existing messages, stop at first upToDate
 */
export const LiveModeCatchUp = Schema.TaggedStruct('LiveModeCatchUp', {});
export type LiveModeCatchUp = typeof LiveModeCatchUp.Type;

/**
 * Long-poll mode: Hold connection for live updates
 */
export const LiveModeLongPoll = Schema.TaggedStruct('LiveModeLongPoll', {
  /** Timeout in milliseconds (default 30s) */
  timeoutMs: Schema.optionalWith(Schema.Number, { default: () => 30000 }),
});
export type LiveModeLongPoll = typeof LiveModeLongPoll.Type;

/**
 * SSE mode: Server-sent events for live updates
 */
export const LiveModeSSE = Schema.TaggedStruct('LiveModeSSE', {
  /** Heartbeat interval in milliseconds (default 15s) */
  heartbeatMs: Schema.optionalWith(Schema.Number, { default: () => 15000 }),
});
export type LiveModeSSE = typeof LiveModeSSE.Type;

/**
 * Auto mode: Behavior determined by consumption method
 */
export const LiveModeAuto = Schema.TaggedStruct('LiveModeAuto', {});
export type LiveModeAuto = typeof LiveModeAuto.Type;

/**
 * Live mode union - discriminated by _tag
 */
export const LiveMode = Schema.Union(
  LiveModeCatchUp,
  LiveModeLongPoll,
  LiveModeSSE,
  LiveModeAuto
);
export type LiveMode = typeof LiveMode.Type;

/**
 * Legacy live mode (for backward compatibility with raw client)
 * Maps to: false | 'auto' | 'long-poll' | 'sse'
 */
export const LiveModeLegacy = Schema.Union(
  Schema.Literal(false),
  Schema.Literal('auto'),
  Schema.Literal('long-poll'),
  Schema.Literal('sse')
);
export type LiveModeLegacy = typeof LiveModeLegacy.Type;

// ============================================================================
// Stream Configuration
// ============================================================================

/**
 * Configuration for creating a stream
 * 
 * @property url - Full URL to the durable stream endpoint
 * @property contentType - Content type (defaults to 'application/json' in service)
 * @property ttlSeconds - Time-to-live in seconds
 * @property expiresAt - Expiration timestamp (ISO 8601)
 * @property body - Initial body content
 */
export const StreamCreateConfig = Schema.Struct({
  url: Schema.String,
  contentType: Schema.optional(Schema.String),
  ttlSeconds: Schema.optional(Schema.Number),
  expiresAt: Schema.optional(Schema.String),
  body: Schema.optional(Schema.Unknown),
});
export type StreamCreateConfig = typeof StreamCreateConfig.Type;

/**
 * Configuration for connecting to an existing stream
 * 
 * @property url - Full URL to the durable stream endpoint
 * @property headers - Optional authorization headers
 */
export const StreamConnectConfig = Schema.Struct({
  url: Schema.String,
  headers: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
});
export type StreamConnectConfig = typeof StreamConnectConfig.Type;

/**
 * Configuration for reading from a stream.
 * Defaults are applied at runtime in the service:
 * - offset: '-1' (beginning of stream)
 * - live: false (catch-up mode)
 * - json: true (parse as JSON)
 */
export const StreamReadConfig = Schema.Struct({
  offset: Schema.optional(Schema.String),
  live: Schema.optional(LiveModeLegacy),
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
