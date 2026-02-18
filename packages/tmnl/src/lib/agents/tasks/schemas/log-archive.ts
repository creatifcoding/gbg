/**
 * Agent Task Log Archive Schemas
 *
 * Contracts for persisted archive manifests + chunks used by local spillover.
 *
 * @module agent-task/schemas/log-archive
 */

import { Schema } from 'effect'
import { AgentTaskLogEntrySchema } from './log-entry'

export const LogArchiveManifestFields = {
  taskId: Schema.String,
  version: Schema.Number.pipe(Schema.int(), Schema.positive()),
  nextChunkIndex: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  latestChunkIndex: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  chunkCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  totalEntries: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  evictedChunkCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  oldestTimestamp: Schema.optional(Schema.DateTimeUtc),
  newestTimestamp: Schema.optional(Schema.DateTimeUtc),
  lastDurabilitySequence: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
  ),
  updatedAt: Schema.DateTimeUtc,
}

export class LogArchiveManifest extends Schema.TaggedClass<LogArchiveManifest>()(
  'LogArchiveManifest',
  LogArchiveManifestFields,
) {}

export const LogArchiveManifestSchema = LogArchiveManifest

export const LogArchiveChunkFields = {
  taskId: Schema.String,
  chunkIndex: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  entryCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  entries: Schema.Array(AgentTaskLogEntrySchema),
  oldestTimestamp: Schema.optional(Schema.DateTimeUtc),
  newestTimestamp: Schema.optional(Schema.DateTimeUtc),
  firstDurabilitySequence: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
  ),
  lastDurabilitySequence: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
  ),
  approxBytes: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  ),
  persistedAt: Schema.DateTimeUtc,
}

export class LogArchiveChunk extends Schema.TaggedClass<LogArchiveChunk>()(
  'LogArchiveChunk',
  LogArchiveChunkFields,
) {}

export const LogArchiveChunkSchema = LogArchiveChunk
