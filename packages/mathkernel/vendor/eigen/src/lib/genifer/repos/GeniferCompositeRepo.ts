/**
 * GeniferCompositeRepo — Repository for genifer.composites
 *
 * @module
 */

import { Context, Effect, Layer, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { GeniferCompositeModel } from '../models/GeniferCompositeModel'
import type { GeniferCompositeId } from '../models/_common'
import { decodeOptional, decodeRows, decodeFirst } from './_decode'

// =============================================================================
// Types
// =============================================================================

export type GeniferCompositeRepoError = SqlError.SqlError | ParseResult.ParseError

export interface GeniferCompositeRepository {
  readonly findById: (id: GeniferCompositeId) => Effect.Effect<Option.Option<GeniferCompositeModel>, GeniferCompositeRepoError>
  readonly findByName: (name: string) => Effect.Effect<Option.Option<GeniferCompositeModel>, GeniferCompositeRepoError>
  readonly findAll: (limit?: number) => Effect.Effect<readonly GeniferCompositeModel[], GeniferCompositeRepoError>
  readonly findTopRanked: (limit?: number) => Effect.Effect<readonly GeniferCompositeModel[], GeniferCompositeRepoError>
  readonly upsert: (composite: typeof GeniferCompositeModel.insert.Type) => Effect.Effect<GeniferCompositeModel, GeniferCompositeRepoError>
  readonly updateRating: (id: GeniferCompositeId, rating: number) => Effect.Effect<GeniferCompositeModel, GeniferCompositeRepoError>
  readonly incrementUsage: (id: GeniferCompositeId) => Effect.Effect<void, SqlError.SqlError>
  readonly refreshRankings: () => Effect.Effect<void, SqlError.SqlError>
  readonly delete: (id: GeniferCompositeId) => Effect.Effect<void, SqlError.SqlError>
}

// =============================================================================
// Tag
// =============================================================================

export class GeniferCompositeRepo extends Context.Tag('genifer/CompositeRepo')<
  GeniferCompositeRepo,
  GeniferCompositeRepository
>() {}

// =============================================================================
// Column select
// =============================================================================

const COMP_COLS = `
  id,
  name,
  description,
  template,
  props_schema    AS "propsSchema",
  default_class   AS "defaultClass",
  has_children    AS "hasChildren",
  quality_score   AS "qualityScore",
  human_rating    AS "humanRating",
  usage_count     AS "usageCount",
  created_by      AS "createdBy",
  created_at      AS "createdAt",
  updated_at      AS "updatedAt"
`

// =============================================================================
// Implementation
// =============================================================================

export const GeniferCompositeRepoLive = Layer.effect(
  GeniferCompositeRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findById = (id: GeniferCompositeId) =>
      Effect.gen(function* () {
        const rows = yield* sql.unsafe(
          `SELECT ${COMP_COLS} FROM genifer.composites WHERE id = $1 LIMIT 1`,
          [id]
        )
        return yield* decodeOptional(GeniferCompositeModel)(rows)
      })

    const findByName = (name: string) =>
      Effect.gen(function* () {
        const rows = yield* sql.unsafe(
          `SELECT ${COMP_COLS} FROM genifer.composites WHERE name = $1 LIMIT 1`,
          [name]
        )
        return yield* decodeOptional(GeniferCompositeModel)(rows)
      })

    const findAll = (limit = 100) =>
      Effect.gen(function* () {
        const rows = yield* sql.unsafe(
          `SELECT ${COMP_COLS} FROM genifer.composites ORDER BY updated_at DESC LIMIT $1`,
          [limit]
        )
        return yield* decodeRows(GeniferCompositeModel)(rows)
      })

    const findTopRanked = (limit = 20) =>
      Effect.gen(function* () {
        const rows = yield* sql.unsafe(
          `SELECT c.${COMP_COLS.replace(/\n/g, '')}
           FROM genifer.composite_rankings r
           JOIN genifer.composites c ON c.id = r.id
           ORDER BY r.composite_rank DESC
           LIMIT $1`,
          [limit]
        )
        return yield* decodeRows(GeniferCompositeModel)(rows)
      }).pipe(
        // Fallback if materialized view is empty/stale
        Effect.catchAll(() =>
          Effect.gen(function* () {
            const rows = yield* sql.unsafe(
              `SELECT ${COMP_COLS} FROM genifer.composites ORDER BY quality_score DESC LIMIT $1`,
              [limit]
            )
            return yield* decodeRows(GeniferCompositeModel)(rows)
          })
        )
      )

    const upsert = (composite: typeof GeniferCompositeModel.insert.Type) =>
      Effect.gen(function* () {
        const description = Option.getOrNull(composite.description)
        const propsSchema = Option.getOrNull(composite.propsSchema)
        const defaultClass = Option.getOrNull(composite.defaultClass)
        const humanRating = Option.getOrNull(composite.humanRating)

        const rows = yield* sql.unsafe(
          `INSERT INTO genifer.composites
            (name, description, template, props_schema, default_class, has_children,
             quality_score, human_rating, usage_count, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (name) DO UPDATE SET
            description   = EXCLUDED.description,
            template      = EXCLUDED.template,
            props_schema  = EXCLUDED.props_schema,
            default_class = EXCLUDED.default_class,
            has_children  = EXCLUDED.has_children,
            quality_score = EXCLUDED.quality_score,
            updated_at    = NOW()
          RETURNING ${COMP_COLS}`,
          [
            composite.name, description,
            JSON.stringify(composite.template),
            propsSchema ? JSON.stringify(propsSchema) : null,
            defaultClass, composite.hasChildren ?? false,
            composite.qualityScore ?? 0, humanRating,
            composite.usageCount ?? 0, composite.createdBy ?? 'agent',
          ]
        )
        return yield* decodeFirst(GeniferCompositeModel)(rows)
      })

    const updateRating = (id: GeniferCompositeId, rating: number) =>
      Effect.gen(function* () {
        const rows = yield* sql.unsafe(
          `UPDATE genifer.composites SET human_rating = $1, updated_at = NOW() WHERE id = $2 RETURNING ${COMP_COLS}`,
          [rating, id]
        )
        return yield* decodeFirst(GeniferCompositeModel)(rows)
      })

    const incrementUsage = (id: GeniferCompositeId) =>
      sql.unsafe(
        `UPDATE genifer.composites SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = $1`,
        [id]
      ).pipe(Effect.asVoid)

    const refreshRankings = () =>
      sql.unsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY genifer.composite_rankings`).pipe(Effect.asVoid)

    const del = (id: GeniferCompositeId) =>
      sql.unsafe(`DELETE FROM genifer.composites WHERE id = $1`, [id]).pipe(Effect.asVoid)

    return {
      findById,
      findByName,
      findAll,
      findTopRanked,
      upsert,
      updateRating,
      incrementUsage,
      refreshRankings,
      delete: del,
    } satisfies GeniferCompositeRepository
  })
)
