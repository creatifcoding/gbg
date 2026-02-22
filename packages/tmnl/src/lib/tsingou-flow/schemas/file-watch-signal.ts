/**
 * File Watch Signal Schema
 *
 * Source: Filesystem watcher (JSON/CSV tail, directory monitoring)
 * Covers: Log ingestion, CSV data drops, config changes, local data pipelines
 *
 * @module tsingou-flow/schemas/file-watch-signal
 */

import { Schema } from 'effect'
import { BaseSignal } from './base-signal'

// =============================================================================
// File Watch Payload
// =============================================================================

export const FileWatchEventType = Schema.Literal('create', 'modify', 'delete')
export type FileWatchEventType = typeof FileWatchEventType.Type

export const FileWatchPayload = Schema.Struct({
  /** Absolute file path */
  path: Schema.String,

  /** What happened to the file */
  event: FileWatchEventType,

  /** Parsed file content (for create/modify — decoded by adapter) */
  content: Schema.optional(Schema.Unknown),

  /** File size in bytes */
  size: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),

  /** MIME type (inferred from extension) */
  mimeType: Schema.optional(Schema.String),

  /** For tail mode: which line range was new */
  lineRange: Schema.optional(Schema.Struct({
    start: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
    end: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  })),

  /** File hash (for deduplication) */
  hash: Schema.optional(Schema.String),
})
export type FileWatchPayload = typeof FileWatchPayload.Type

// =============================================================================
// FileWatchSignal
// =============================================================================

export const FileWatchSignal = Schema.extend(
  BaseSignal,
  Schema.Struct({
    kind: Schema.Literal('file-watch'),
    payload: FileWatchPayload,
  }),
)
export type FileWatchSignal = typeof FileWatchSignal.Type
