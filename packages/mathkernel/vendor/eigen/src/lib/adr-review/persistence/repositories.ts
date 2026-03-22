/**
 * ADR Review Repositories
 *
 * Effect-based CRUD operations for review persistence.
 * Follows the editor v3 repository pattern.
 */
import { SqlClient } from '@effect/sql'
import { SqlError } from '@effect/sql/SqlError'
import { Context, Effect, Layer, Option } from 'effect'

import { ReviewCommentModel, ReviewStatus, UnitReviewModel } from './models'

// =============================================================================
// Repository Types
// =============================================================================

export interface UnitReviewRepository {
  /**
   * Get review status for a specific unit.
   */
  readonly findByUnit: (
    adrId: string,
    unitPath: string
  ) => Effect.Effect<Option.Option<UnitReviewModel>, SqlError>

  /**
   * Get all reviews for an ADR.
   */
  readonly findByAdr: (
    adrId: string
  ) => Effect.Effect<readonly UnitReviewModel[], SqlError>

  /**
   * Upsert a unit review status.
   */
  readonly upsert: (
    adrId: string,
    unitPath: string,
    status: ReviewStatus,
    reviewedBy?: string
  ) => Effect.Effect<void, SqlError>

  /**
   * Delete a review (reset to untracked).
   */
  readonly delete: (adrId: string, unitPath: string) => Effect.Effect<void, SqlError>

  /**
   * Get all reviews across all ADRs.
   */
  readonly listAll: () => Effect.Effect<readonly UnitReviewModel[], SqlError>

  /**
   * Count reviews by status for an ADR.
   */
  readonly countByStatus: (
    adrId: string
  ) => Effect.Effect<Record<ReviewStatus, number>, SqlError>
}

export interface ReviewCommentRepository {
  /**
   * Get all comments for a specific unit.
   */
  readonly findByUnit: (
    adrId: string,
    unitPath: string
  ) => Effect.Effect<readonly ReviewCommentModel[], SqlError>

  /**
   * Get all comments for an ADR.
   */
  readonly findByAdr: (
    adrId: string
  ) => Effect.Effect<readonly ReviewCommentModel[], SqlError>

  /**
   * Add a new comment.
   */
  readonly insert: (
    comment: typeof ReviewCommentModel.insert.Type
  ) => Effect.Effect<ReviewCommentModel, SqlError>

  /**
   * Delete a comment by ID.
   */
  readonly delete: (id: string) => Effect.Effect<void, SqlError>

  /**
   * Get replies to a comment.
   */
  readonly getReplies: (
    commentId: string
  ) => Effect.Effect<readonly ReviewCommentModel[], SqlError>

  /**
   * Count comments per unit for an ADR.
   */
  readonly countByUnit: (
    adrId: string
  ) => Effect.Effect<Record<string, number>, SqlError>
}

// =============================================================================
// Context Tags
// =============================================================================

export class UnitReviewRepo extends Context.Tag('tmnl/adr-review/UnitReviewRepo')<
  UnitReviewRepo,
  UnitReviewRepository
>() {}

export class ReviewCommentRepo extends Context.Tag('tmnl/adr-review/ReviewCommentRepo')<
  ReviewCommentRepo,
  ReviewCommentRepository
>() {}

// =============================================================================
// Repository Implementations
// =============================================================================

/**
 * Live implementation of UnitReviewRepository.
 * Uses composite PK (adr_id, unit_path) so no Model.makeRepository.
 */
export const UnitReviewRepoLive = Layer.effect(
  UnitReviewRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findByUnit = (
      adrId: string,
      unitPath: string
    ): Effect.Effect<Option.Option<UnitReviewModel>, SqlError> =>
      Effect.gen(function* () {
        const rows = yield* sql<UnitReviewModel>`
          SELECT adr_id as adrId, unit_path as unitPath, status, reviewed_at as reviewedAt, reviewed_by as reviewedBy
          FROM unit_reviews
          WHERE adr_id = ${adrId} AND unit_path = ${unitPath}
          LIMIT 1
        `
        return rows.length > 0 ? Option.some(rows[0]) : Option.none()
      })

    const findByAdr = (
      adrId: string
    ): Effect.Effect<readonly UnitReviewModel[], SqlError> =>
      sql<UnitReviewModel>`
        SELECT adr_id as adrId, unit_path as unitPath, status, reviewed_at as reviewedAt, reviewed_by as reviewedBy
        FROM unit_reviews
        WHERE adr_id = ${adrId}
        ORDER BY unit_path ASC
      `

    const upsert = (
      adrId: string,
      unitPath: string,
      status: ReviewStatus,
      reviewedBy?: string
    ): Effect.Effect<void, SqlError> =>
      Effect.gen(function* () {
        yield* Effect.logInfo(`[adr-review/repo] upsert called: ${adrId}:${unitPath} = ${status}`)
        const now = new Date().toISOString()
        const existing = yield* findByUnit(adrId, unitPath)

        if (Option.isSome(existing)) {
          yield* Effect.logInfo('[adr-review/repo] Updating existing record')
          yield* sql`
            UPDATE unit_reviews
            SET status = ${status},
                reviewed_at = ${now},
                reviewed_by = ${reviewedBy ?? null}
            WHERE adr_id = ${adrId} AND unit_path = ${unitPath}
          `
        } else {
          yield* Effect.logInfo('[adr-review/repo] Inserting new record')
          yield* sql`
            INSERT INTO unit_reviews (adr_id, unit_path, status, reviewed_at, reviewed_by)
            VALUES (${adrId}, ${unitPath}, ${status}, ${now}, ${reviewedBy ?? null})
          `
        }
        yield* Effect.logInfo('[adr-review/repo] upsert complete')
      })

    const del = (adrId: string, unitPath: string): Effect.Effect<void, SqlError> =>
      sql`
        DELETE FROM unit_reviews
        WHERE adr_id = ${adrId} AND unit_path = ${unitPath}
      `.pipe(Effect.asVoid)

    const listAll = (): Effect.Effect<readonly UnitReviewModel[], SqlError> =>
      sql<UnitReviewModel>`
        SELECT adr_id as adrId, unit_path as unitPath, status, reviewed_at as reviewedAt, reviewed_by as reviewedBy
        FROM unit_reviews
        ORDER BY adr_id ASC, unit_path ASC
      `

    const countByStatus = (
      adrId: string
    ): Effect.Effect<Record<ReviewStatus, number>, SqlError> =>
      Effect.gen(function* () {
        const rows = yield* sql<{ status: ReviewStatus; count: number }>`
          SELECT status, COUNT(*) as count
          FROM unit_reviews
          WHERE adr_id = ${adrId}
          GROUP BY status
        `

        const result: Record<ReviewStatus, number> = {
          pending: 0,
          accepted: 0,
          rejected: 0,
          discuss: 0,
        }

        for (const row of rows) {
          result[row.status] = row.count
        }

        return result
      })

    return {
      findByUnit,
      findByAdr,
      upsert,
      delete: del,
      listAll,
      countByStatus,
    } satisfies UnitReviewRepository
  })
)

/**
 * Live implementation of ReviewCommentRepository.
 */
export const ReviewCommentRepoLive = Layer.effect(
  ReviewCommentRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findByUnit = (
      adrId: string,
      unitPath: string
    ): Effect.Effect<readonly ReviewCommentModel[], SqlError> =>
      sql<ReviewCommentModel>`
        SELECT id, adr_id as adrId, unit_path as unitPath, author, content, created_at as createdAt, reply_to as replyTo
        FROM review_comments
        WHERE adr_id = ${adrId} AND unit_path = ${unitPath}
        ORDER BY created_at ASC
      `

    const findByAdr = (
      adrId: string
    ): Effect.Effect<readonly ReviewCommentModel[], SqlError> =>
      sql<ReviewCommentModel>`
        SELECT id, adr_id as adrId, unit_path as unitPath, author, content, created_at as createdAt, reply_to as replyTo
        FROM review_comments
        WHERE adr_id = ${adrId}
        ORDER BY created_at ASC
      `

    const insert = (
      comment: typeof ReviewCommentModel.insert.Type
    ): Effect.Effect<ReviewCommentModel, SqlError> =>
      Effect.gen(function* () {
        const now = new Date().toISOString()

        yield* sql`
          INSERT INTO review_comments (id, adr_id, unit_path, author, content, created_at, reply_to)
          VALUES (${comment.id}, ${comment.adrId}, ${comment.unitPath}, ${comment.author}, ${comment.content}, ${now}, ${comment.replyTo ?? null})
        `

        // Return the inserted model
        const rows = yield* sql<ReviewCommentModel>`
          SELECT id, adr_id as adrId, unit_path as unitPath, author, content, created_at as createdAt, reply_to as replyTo
          FROM review_comments
          WHERE id = ${comment.id}
        `

        return rows[0]
      })

    const del = (id: string): Effect.Effect<void, SqlError> =>
      sql`DELETE FROM review_comments WHERE id = ${id}`.pipe(Effect.asVoid)

    const getReplies = (
      commentId: string
    ): Effect.Effect<readonly ReviewCommentModel[], SqlError> =>
      sql<ReviewCommentModel>`
        SELECT id, adr_id as adrId, unit_path as unitPath, author, content, created_at as createdAt, reply_to as replyTo
        FROM review_comments
        WHERE reply_to = ${commentId}
        ORDER BY created_at ASC
      `

    const countByUnit = (
      adrId: string
    ): Effect.Effect<Record<string, number>, SqlError> =>
      Effect.gen(function* () {
        const rows = yield* sql<{ unitPath: string; count: number }>`
          SELECT unit_path as unitPath, COUNT(*) as count
          FROM review_comments
          WHERE adr_id = ${adrId}
          GROUP BY unit_path
        `

        const result: Record<string, number> = {}
        for (const row of rows) {
          result[row.unitPath] = row.count
        }

        return result
      })

    return {
      findByUnit,
      findByAdr,
      insert,
      delete: del,
      getReplies,
      countByUnit,
    } satisfies ReviewCommentRepository
  })
)

// =============================================================================
// Combined Layer
// =============================================================================

/**
 * All repository layers combined.
 * Requires SqlClient to be provided.
 */
export const AllRepositoriesLive = Layer.mergeAll(UnitReviewRepoLive, ReviewCommentRepoLive)
