/**
 * Durable Streams Server Repositories
 *
 * Repository pattern for stream persistence.
 * Follows the pattern from src/lib/ams/v2/base/services/repositories.ts
 *
 * @module @gbg/tmnl/durable-streams/server/repositories
 */

import { Context, Effect, Layer, Option, pipe } from 'effect'
import * as SqlClient from '@effect/sql/SqlClient'
import type { SqlError } from '@effect/sql/SqlError'
import { Stream, StreamEntry } from './models'

// ─────────────────────────────────────────────────────────────────────────────
// Stream Repository
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stream repository interface
 */
export interface StreamRepository {
  /**
   * Create a new stream
   */
  readonly create: (streamId: string, contentType?: string) => Effect.Effect<Stream, SqlError>

  /**
   * Find stream by stream ID
   */
  readonly findByStreamId: (streamId: string) => Effect.Effect<Option.Option<Stream>, SqlError>

  /**
   * Check if stream exists
   */
  readonly exists: (streamId: string) => Effect.Effect<boolean, SqlError>

  /**
   * Update stream's current sequence
   */
  readonly updateSequence: (streamId: string, sequence: number) => Effect.Effect<void, SqlError>

  /**
   * Delete stream and all its entries
   */
  readonly delete: (streamId: string) => Effect.Effect<void, SqlError>

  /**
   * Get total stream count
   */
  readonly count: () => Effect.Effect<number, SqlError>

  /**
   * List all streams
   */
  readonly list: (limit?: number, offset?: number) => Effect.Effect<readonly Stream[], SqlError>
}

/**
 * Stream repository tag
 */
export class StreamRepositoryTag extends Context.Tag('tmnl/durable-streams/StreamRepository')<
  StreamRepositoryTag,
  StreamRepository
>() {}

/**
 * Stream repository live implementation
 */
export const StreamRepositoryLive = Layer.effect(
  StreamRepositoryTag,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    return StreamRepositoryTag.of({
      create: (streamId, contentType = 'application/json') =>
        Effect.gen(function* () {
          yield* sql`
            INSERT INTO streams (stream_id, content_type, current_sequence)
            VALUES (${streamId}, ${contentType}, 0)
          `
          const rows = yield* sql<Stream>`
            SELECT * FROM streams WHERE stream_id = ${streamId}
          `
          return rows[0]!
        }),

      findByStreamId: (streamId) =>
        Effect.gen(function* () {
          const rows = yield* sql<Stream>`
            SELECT * FROM streams WHERE stream_id = ${streamId}
          `
          return rows.length > 0 ? Option.some(rows[0]!) : Option.none()
        }),

      exists: (streamId) =>
        Effect.gen(function* () {
          const rows = yield* sql<{ count: number }>`
            SELECT COUNT(*) as count FROM streams WHERE stream_id = ${streamId}
          `
          return (rows[0]?.count ?? 0) > 0
        }),

      updateSequence: (streamId, sequence) =>
        Effect.gen(function* () {
          yield* sql`
            UPDATE streams
            SET current_sequence = ${sequence}, updated_at = datetime('now')
            WHERE stream_id = ${streamId}
          `
        }),

      delete: (streamId) =>
        Effect.gen(function* () {
          // Entries are deleted via CASCADE
          yield* sql`DELETE FROM streams WHERE stream_id = ${streamId}`
        }),

      count: () =>
        Effect.gen(function* () {
          const rows = yield* sql<{ count: number }>`SELECT COUNT(*) as count FROM streams`
          return rows[0]?.count ?? 0
        }),

      list: (limit = 100, offset = 0) =>
        sql<Stream>`
          SELECT * FROM streams
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
    })
  })
)

// ─────────────────────────────────────────────────────────────────────────────
// Stream Entry Repository
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stream entry repository interface
 */
export interface StreamEntryRepository {
  /**
   * Append an entry to a stream, returning the new sequence number
   */
  readonly append: (streamId: string, data: unknown) => Effect.Effect<number, SqlError>

  /**
   * Read entries from a stream starting at offset
   */
  readonly read: (
    streamId: string,
    fromSequence: number,
    limit: number
  ) => Effect.Effect<readonly StreamEntry[], SqlError>

  /**
   * Get the latest entry for a stream
   */
  readonly getLatest: (streamId: string) => Effect.Effect<Option.Option<StreamEntry>, SqlError>

  /**
   * Get entry count for a stream
   */
  readonly count: (streamId: string) => Effect.Effect<number, SqlError>

  /**
   * Delete all entries for a stream
   */
  readonly deleteAll: (streamId: string) => Effect.Effect<void, SqlError>
}

/**
 * Stream entry repository tag
 */
export class StreamEntryRepositoryTag extends Context.Tag('tmnl/durable-streams/StreamEntryRepository')<
  StreamEntryRepositoryTag,
  StreamEntryRepository
>() {}

/**
 * Stream entry repository live implementation
 */
export const StreamEntryRepositoryLive = Layer.effect(
  StreamEntryRepositoryTag,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    return StreamEntryRepositoryTag.of({
      append: (streamId, data) =>
        Effect.gen(function* () {
          // Get current sequence + 1
          const seqRows = yield* sql<{ currentSequence: number }>`
            SELECT current_sequence FROM streams WHERE stream_id = ${streamId}
          `
          const currentSequence = seqRows[0]?.currentSequence ?? 0
          const newSequence = currentSequence + 1

          // Insert entry
          const dataJson = JSON.stringify(data)
          yield* sql`
            INSERT INTO stream_entries (stream_id, sequence, data)
            VALUES (${streamId}, ${newSequence}, ${dataJson})
          `

          // Update stream's current sequence
          yield* sql`
            UPDATE streams
            SET current_sequence = ${newSequence}, updated_at = datetime('now')
            WHERE stream_id = ${streamId}
          `

          return newSequence
        }),

      read: (streamId, fromSequence, limit) =>
        sql<StreamEntry>`
          SELECT * FROM stream_entries
          WHERE stream_id = ${streamId} AND sequence > ${fromSequence}
          ORDER BY sequence ASC
          LIMIT ${limit}
        `,

      getLatest: (streamId) =>
        Effect.gen(function* () {
          const rows = yield* sql<StreamEntry>`
            SELECT * FROM stream_entries
            WHERE stream_id = ${streamId}
            ORDER BY sequence DESC
            LIMIT 1
          `
          return rows.length > 0 ? Option.some(rows[0]!) : Option.none()
        }),

      count: (streamId) =>
        Effect.gen(function* () {
          const rows = yield* sql<{ count: number }>`
            SELECT COUNT(*) as count FROM stream_entries WHERE stream_id = ${streamId}
          `
          return rows[0]?.count ?? 0
        }),

      deleteAll: (streamId) =>
        Effect.gen(function* () {
          yield* sql`DELETE FROM stream_entries WHERE stream_id = ${streamId}`
        }),
    })
  })
)

// ─────────────────────────────────────────────────────────────────────────────
// Combined Repository Layer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All repositories combined
 */
export const AllRepositoriesLive = Layer.mergeAll(
  StreamRepositoryLive,
  StreamEntryRepositoryLive
)
