/**
 * AVA v2 Channel Data Schemas
 *
 * Effect Schema definitions for hydrated channel payloads.
 * These types represent the actual data content delivered to clients.
 *
 * Matches Rust ava-domain/src/views.rs::ChannelData enum exactly.
 *
 * @pattern Effect Schema discriminated union
 * @see src-ava/ava-domain/src/views.rs
 * @module
 */

import { Schema } from 'effect'

// ============================================================================
// Channel Data Variants
// ============================================================================

/**
 * Inline JSON data (scalars, small objects, config)
 * Server-hydrated, directly usable by client
 */
export const ChannelDataInline = Schema.Struct({
  type: Schema.Literal('inline'),
  value: Schema.Unknown,
}).pipe(
  Schema.annotations({
    title: 'ChannelDataInline',
    description: 'Inline JSON data hydrated by server',
  })
)
export type ChannelDataInline = typeof ChannelDataInline.Type

/**
 * Tabular row data (query results, telemetry batches)
 * Server-hydrated as JSON array of objects for portability
 */
export const ChannelDataRows = Schema.Struct({
  type: Schema.Literal('rows'),
  value: Schema.Array(Schema.Unknown),
}).pipe(
  Schema.annotations({
    title: 'ChannelDataRows',
    description: 'Tabular row data hydrated by server',
  })
)
export type ChannelDataRows = typeof ChannelDataRows.Type

/**
 * Reference to external asset (3D models, textures, large blobs)
 * Client-fetched: server returns pointer, client fetches via URI
 */
export const ChannelDataAssetRef = Schema.Struct({
  type: Schema.Literal('assetRef'),
  value: Schema.Struct({
    /** URI to fetch the asset (s3://, https://, file://) */
    uri: Schema.String,
    /** MIME type hint for client */
    mimeType: Schema.optional(Schema.String),
    /** ETag for cache validation */
    etag: Schema.optional(Schema.String),
    /** Content hash for integrity */
    contentHash: Schema.optional(Schema.String),
  }),
}).pipe(
  Schema.annotations({
    title: 'ChannelDataAssetRef',
    description: 'Reference to external asset for client-side fetching',
  })
)
export type ChannelDataAssetRef = typeof ChannelDataAssetRef.Type

/**
 * Handle to active stream (real-time position, events)
 * Client uses this to subscribe to ongoing updates
 */
export const ChannelDataStreamHandle = Schema.Struct({
  type: Schema.Literal('streamHandle'),
  value: Schema.Struct({
    /** Topic/subject to subscribe to */
    topic: Schema.String,
    /** Current cursor position (for resume) */
    cursor: Schema.optional(Schema.Number),
    /** Schema hint for decoding */
    schemaUri: Schema.optional(Schema.String),
  }),
}).pipe(
  Schema.annotations({
    title: 'ChannelDataStreamHandle',
    description: 'Handle to active stream for client subscription',
  })
)
export type ChannelDataStreamHandle = typeof ChannelDataStreamHandle.Type

/**
 * Channel hydration failed
 */
export const ChannelDataError = Schema.Struct({
  type: Schema.Literal('error'),
  value: Schema.Struct({
    /** Error code for programmatic handling */
    code: Schema.String,
    /** Human-readable message */
    message: Schema.String,
    /** Whether this is retryable */
    retryable: Schema.Boolean,
  }),
}).pipe(
  Schema.annotations({
    title: 'ChannelDataError',
    description: 'Channel hydration error',
  })
)
export type ChannelDataError = typeof ChannelDataError.Type

/**
 * Channel not yet hydrated (pending)
 */
export const ChannelDataPending = Schema.Struct({
  type: Schema.Literal('pending'),
}).pipe(
  Schema.annotations({
    title: 'ChannelDataPending',
    description: 'Channel hydration pending',
  })
)
export type ChannelDataPending = typeof ChannelDataPending.Type

// ============================================================================
// Channel Data Union
// ============================================================================

/**
 * ChannelData - Union of all hydrated channel data types
 *
 * Discriminated union on `type` field matching Rust serde tag.
 * Uses `tag = "type", content = "value"` adjacently tagged enum pattern.
 */
export const ChannelData = Schema.Union(
  ChannelDataInline,
  ChannelDataRows,
  ChannelDataAssetRef,
  ChannelDataStreamHandle,
  ChannelDataError,
  ChannelDataPending
).pipe(
  Schema.annotations({
    title: 'ChannelData',
    description: 'Hydrated channel data payload',
  })
)
export type ChannelData = typeof ChannelData.Type

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if channel data is hydrated with actual data (not pending, not error)
 */
export const isHydrated = (data: ChannelData): boolean => {
  return data.type !== 'pending' && data.type !== 'error'
}

/**
 * Check if channel data represents an error
 */
export const isError = (data: ChannelData): data is ChannelDataError => {
  return data.type === 'error'
}

/**
 * Check if channel data is pending hydration
 */
export const isPending = (data: ChannelData): data is ChannelDataPending => {
  return data.type === 'pending'
}

/**
 * Check if channel data is inline JSON
 */
export const isInline = (data: ChannelData): data is ChannelDataInline => {
  return data.type === 'inline'
}

/**
 * Check if channel data is tabular rows
 */
export const isRows = (data: ChannelData): data is ChannelDataRows => {
  return data.type === 'rows'
}

/**
 * Check if channel data is an asset reference
 */
export const isAssetRef = (data: ChannelData): data is ChannelDataAssetRef => {
  return data.type === 'assetRef'
}

/**
 * Check if channel data is a stream handle
 */
export const isStreamHandle = (data: ChannelData): data is ChannelDataStreamHandle => {
  return data.type === 'streamHandle'
}
