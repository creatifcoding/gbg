/**
 * Durable Streams Server Models
 *
 * Model.Class definitions for SQLite persistence.
 * Follows the pattern from src/lib/ams/v2/base/repositories/asset.ts
 *
 * @module @gbg/tmnl/durable-streams/server/models
 */

import { Model } from '@effect/sql'
import { Schema } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Branded Types
// ─────────────────────────────────────────────────────────────────────────────

/** Stream ID branded type */
export const StreamId = Schema.String.pipe(Schema.brand('StreamId'))
export type StreamId = typeof StreamId.Type

/** Offset branded type (sequence number as string for compatibility) */
export const Offset = Schema.String.pipe(Schema.brand('Offset'))
export type Offset = typeof Offset.Type

/** Special offset value meaning "start from beginning" */
export const OFFSET_START: Offset = '-1' as Offset

// ─────────────────────────────────────────────────────────────────────────────
// Stream Model
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stream Model
 *
 * Represents a durable stream with metadata.
 * Maps to `streams` table.
 */
export class Stream extends Model.Class<Stream>('Stream')({
  /** Auto-generated row ID */
  id: Model.Generated(Schema.Number),

  /** Unique stream identifier (e.g., "telegram-blocks-12345") */
  streamId: Schema.String,

  /** Content type (e.g., "application/json") */
  contentType: Schema.String,

  /** Current sequence number (last entry's sequence) */
  currentSequence: Schema.Number,

  /** Creation timestamp */
  createdAt: Model.DateTimeInsert,

  /** Last update timestamp */
  updatedAt: Model.DateTimeUpdate,
}) {}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Entry Model
// ─────────────────────────────────────────────────────────────────────────────

/**
 * JSON blob schema with nullable handling
 *
 * SQLite stores JSON as text, so we need to transform on read/write.
 */
export const JsonBlob = Schema.transform(
  Schema.NullOr(Schema.String),
  Schema.Unknown,
  {
    decode: (s) => (s === null ? null : JSON.parse(s)),
    encode: (u) => (u === null || u === undefined ? null : JSON.stringify(u)),
  }
)

/**
 * Stream Entry Model
 *
 * Represents a single entry in a stream.
 * Maps to `stream_entries` table.
 */
export class StreamEntry extends Model.Class<StreamEntry>('StreamEntry')({
  /** Auto-generated row ID */
  id: Model.Generated(Schema.Number),

  /** Foreign key to stream */
  streamId: Schema.String,

  /** Sequence number within the stream (offset) */
  sequence: Schema.Number,

  /** Entry data as JSON blob */
  data: JsonBlob,

  /** Entry creation timestamp */
  createdAt: Model.DateTimeInsert,
}) {}

// ─────────────────────────────────────────────────────────────────────────────
// API Schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Append request payload
 */
export const AppendPayload = Schema.Struct({
  /** Data to append (any JSON-serializable value) */
  data: Schema.Unknown,

  /** Optional content type override */
  contentType: Schema.optional(Schema.String),
})
export type AppendPayload = typeof AppendPayload.Type

/**
 * Append response
 */
export const AppendResult = Schema.Struct({
  /** New offset (sequence number as string) */
  offset: Schema.String,

  /** Stream ID */
  streamId: Schema.String,

  /** Whether the operation succeeded */
  success: Schema.Boolean,
})
export type AppendResult = typeof AppendResult.Type

/**
 * Read request parameters
 */
export const ReadParams = Schema.Struct({
  /** Start reading from this offset ("-1" for beginning) */
  offset: Schema.optional(Schema.String),

  /** Maximum number of entries to return */
  limit: Schema.optional(Schema.Number),

  /** Whether to keep connection open for live updates */
  live: Schema.optional(Schema.Union(
    Schema.Literal(false),
    Schema.Literal('auto'),
    Schema.Literal('long-poll'),
    Schema.Literal('sse'),
  )),
})
export type ReadParams = typeof ReadParams.Type

/**
 * Stream entry in response
 */
export const StreamDataEntry = Schema.Struct({
  /** Entry offset/sequence as string */
  offset: Schema.String,

  /** Entry data */
  data: Schema.Unknown,

  /** Entry timestamp */
  timestamp: Schema.Number,
})
export type StreamDataEntry = typeof StreamDataEntry.Type

/**
 * Read response
 */
export const StreamData = Schema.Struct({
  /** Stream ID */
  streamId: Schema.String,

  /** Array of entries */
  entries: Schema.Array(StreamDataEntry),

  /** Last offset returned */
  lastOffset: Schema.String,

  /** Whether we've reached the end of the stream */
  upToDate: Schema.Boolean,
})
export type StreamData = typeof StreamData.Type

/**
 * Stream metadata response
 */
export const StreamMetadataResponse = Schema.Struct({
  /** Whether the stream exists */
  exists: Schema.Boolean,

  /** Stream ID */
  streamId: Schema.optional(Schema.String),

  /** Content type */
  contentType: Schema.optional(Schema.String),

  /** Current sequence/offset */
  currentOffset: Schema.optional(Schema.String),

  /** Creation timestamp */
  createdAt: Schema.optional(Schema.Number),

  /** Last update timestamp */
  updatedAt: Schema.optional(Schema.Number),
})
export type StreamMetadataResponse = typeof StreamMetadataResponse.Type

/**
 * Health check response
 */
export const HealthStatus = Schema.Struct({
  status: Schema.Literal('ok', 'degraded', 'error'),
  service: Schema.String,
  timestamp: Schema.Number,
  streamCount: Schema.optional(Schema.Number),
})
export type HealthStatus = typeof HealthStatus.Type
