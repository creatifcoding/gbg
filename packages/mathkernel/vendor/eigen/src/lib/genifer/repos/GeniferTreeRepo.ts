/**
 * GeniferTreeRepo — Repository for genifer.trees
 *
 * @module
 */

import { Context, Effect, Layer, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { GeniferTreeModel } from '../models/GeniferTreeModel'
import type { GeniferTreeId } from '../models/_common'
import { decodeOptional, decodeRows, decodeFirst } from './_decode'

// =============================================================================
// Types
// =============================================================================

export type GeniferTreeRepoError = SqlError.SqlError | ParseResult.ParseError

export interface GeniferTreeRepository {
  readonly findById: (id: GeniferTreeId) => Effect.Effect<Option.Option<GeniferTreeModel>, GeniferTreeRepoError>
  readonly findByThread: (threadId: string) => Effect.Effect<readonly GeniferTreeModel[], GeniferTreeRepoError>
  readonly findRecent: (limit?: number) => Effect.Effect<readonly GeniferTreeModel[], GeniferTreeRepoError>
  readonly findByQuality: (minScore: number, limit?: number) => Effect.Effect<readonly GeniferTreeModel[], GeniferTreeRepoError>
  readonly insert: (tree: typeof GeniferTreeModel.insert.Type) => Effect.Effect<GeniferTreeModel, GeniferTreeRepoError>
  readonly updateRating: (id: GeniferTreeId, rating: number) => Effect.Effect<GeniferTreeModel, GeniferTreeRepoError>
  readonly incrementUsage: (id: GeniferTreeId) => Effect.Effect<void, SqlError.SqlError>
  readonly delete: (id: GeniferTreeId) => Effect.Effect<void, SqlError.SqlError>
}

// =============================================================================
// Tag
// =============================================================================

export class GeniferTreeRepo extends Context.Tag('genifer/TreeRepo')<
  GeniferTreeRepo,
  GeniferTreeRepository
>() {}

// =============================================================================
// Column select (camelCase aliases for Model decoding)
// =============================================================================

const TREE_COLS = `
  id,
  prompt,
  root_key        AS "rootKey",
  model,
  quality_score   AS "qualityScore",
  element_count   AS "elementCount",
  repair_count    AS "repairCount",
  duration_ms     AS "durationMs",
  thread_id       AS "threadId",
  parent_tree_id  AS "parentTreeId",
  human_rating    AS "humanRating",
  usage_count     AS "usageCount",
  tags,
  metadata,
  created_at      AS "createdAt",
  updated_at      AS "updatedAt"
`

// =============================================================================
// Implementation
// =============================================================================

export const GeniferTreeRepoLive = Layer.effect(
  GeniferTreeRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findById = (id: GeniferTreeId) =>
      Effect.gen(function* () {
        const rows = yield* sql.unsafe(`SELECT ${TREE_COLS} FROM genifer.trees WHERE id = $1 LIMIT 1`, [id])
        return yield* decodeOptional(GeniferTreeModel)(rows)
      })

    const findByThread = (threadId: string) =>
      Effect.gen(function* () {
        const rows = yield* sql.unsafe(
          `SELECT ${TREE_COLS} FROM genifer.trees WHERE thread_id = $1 ORDER BY created_at ASC`,
          [threadId]
        )
        return yield* decodeRows(GeniferTreeModel)(rows)
      })

    const findRecent = (limit = 50) =>
      Effect.gen(function* () {
        const rows = yield* sql.unsafe(
          `SELECT ${TREE_COLS} FROM genifer.trees ORDER BY created_at DESC LIMIT $1`,
          [limit]
        )
        return yield* decodeRows(GeniferTreeModel)(rows)
      })

    const findByQuality = (minScore: number, limit = 50) =>
      Effect.gen(function* () {
        const rows = yield* sql.unsafe(
          `SELECT ${TREE_COLS} FROM genifer.trees WHERE quality_score >= $1 ORDER BY quality_score DESC LIMIT $2`,
          [minScore, limit]
        )
        return yield* decodeRows(GeniferTreeModel)(rows)
      })

    const insert = (tree: typeof GeniferTreeModel.insert.Type) =>
      Effect.gen(function* () {
        const threadId = Option.getOrNull(tree.threadId)
        const parentTreeId = Option.getOrNull(tree.parentTreeId)
        const model = Option.getOrNull(tree.model)
        const durationMs = Option.getOrNull(tree.durationMs)
        const humanRating = Option.getOrNull(tree.humanRating)
        const metadata = Option.getOrNull(tree.metadata)

        const rows = yield* sql.unsafe(
          `INSERT INTO genifer.trees
            (prompt, root_key, model, quality_score, element_count, repair_count,
             duration_ms, thread_id, parent_tree_id, human_rating, usage_count, tags, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING ${TREE_COLS}`,
          [
            tree.prompt, tree.rootKey, model, tree.qualityScore,
            tree.elementCount, tree.repairCount, durationMs,
            threadId, parentTreeId, humanRating,
            tree.usageCount ?? 0, tree.tags ?? [], metadata,
          ]
        )
        return yield* decodeFirst(GeniferTreeModel)(rows)
      })

    const updateRating = (id: GeniferTreeId, rating: number) =>
      Effect.gen(function* () {
        const rows = yield* sql.unsafe(
          `UPDATE genifer.trees SET human_rating = $1, updated_at = NOW() WHERE id = $2 RETURNING ${TREE_COLS}`,
          [rating, id]
        )
        return yield* decodeFirst(GeniferTreeModel)(rows)
      })

    const incrementUsage = (id: GeniferTreeId) =>
      sql.unsafe(
        `UPDATE genifer.trees SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = $1`,
        [id]
      ).pipe(Effect.asVoid)

    const del = (id: GeniferTreeId) =>
      sql.unsafe(`DELETE FROM genifer.trees WHERE id = $1`, [id]).pipe(Effect.asVoid)

    return {
      findById,
      findByThread,
      findRecent,
      findByQuality,
      insert,
      updateRating,
      incrementUsage,
      delete: del,
    } satisfies GeniferTreeRepository
  })
)
