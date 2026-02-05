/**
 * AreaRepo - Repository for Area Entity
 *
 * ISA-95 Level 2 (Supervisory Control) - Parent: Site (required).
 * Model defines schema, Repo handles persistence.
 *
 * Uses decode utilities to ensure FieldOption transforms are applied
 * (null → Option.none()) on raw SQL results.
 *
 * @module
 */

import { Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { AreaId, SiteId } from '../schemas/identifiers'
import { AreaModel } from '../models/assets/AreaModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type AreaRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

export interface AreaRepository {
  readonly findById: (id: AreaId) => Effect.Effect<Option.Option<AreaModel>, AreaRepoError>
  readonly findBySite: (siteId: SiteId) => Effect.Effect<readonly AreaModel[], AreaRepoError>
  readonly findAll: () => Effect.Effect<readonly AreaModel[], AreaRepoError>
  readonly insert: (area: typeof AreaModel.insert.Type) => Effect.Effect<AreaModel, AreaRepoError>
  readonly update: (area: typeof AreaModel.update.Type) => Effect.Effect<AreaModel, AreaRepoError>
  readonly delete: (id: AreaId) => Effect.Effect<void, SqlError.SqlError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class AreaRepo extends Context.Tag('iiot/AreaRepo')<
  AreaRepo,
  AreaRepository
>() {}

// =============================================================================
// Repository Implementation
// =============================================================================

export const AreaRepoLive = Layer.effect(
  AreaRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    // Column alias helper for SELECT statements
    const selectColumns = sql`
      id,
      name,
      status,
      hierarchy_path AS "hierarchyPath",
      enterprise_id AS "enterpriseId",
      site_id AS "siteId",
      description,
      area_type AS "areaType",
      building,
      floor,
      location,
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findById = (id: AreaId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.areas
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(AreaModel)(rows)
      })

    const findBySite = (siteId: SiteId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.areas
          WHERE site_id = ${siteId}
          ORDER BY name ASC
        `
        return yield* decodeRows(AreaModel)(rows)
      })

    const findAll = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.areas
          ORDER BY name ASC
        `
        return yield* decodeRows(AreaModel)(rows)
      })

    const insert = (area: typeof AreaModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO iiot.areas (
            id, name, status, hierarchy_path, enterprise_id,
            site_id, description, area_type, building, floor,
            location, metadata
          )
          VALUES (
            ${area.id},
            ${area.name},
            ${area.status},
            ${area.hierarchyPath},
            ${area.enterpriseId},
            ${area.siteId},
            ${Option.getOrNull(area.description)},
            ${Option.getOrNull(area.areaType)},
            ${Option.getOrNull(area.building)},
            ${Option.getOrNull(area.floor)},
            ${Option.match(area.location, { onNone: () => null, onSome: (v) => JSON.stringify(v) })},
            ${Option.match(area.metadata, { onNone: () => '{}', onSome: (v) => JSON.stringify(v) })}
          )
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(AreaModel)(rows)
      })

    const update = (area: typeof AreaModel.update.Type) =>
      Effect.gen(function* () {
        const changes = prepareUpdate(area)

        const rows = yield* sql`
          UPDATE iiot.areas
          SET ${sql.update(changes, ['id'])}, updated_at = NOW()
          WHERE id = ${area.id}
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(AreaModel)(rows)
      })

    const del = (id: AreaId) =>
      sql`DELETE FROM iiot.areas WHERE id = ${id}`.pipe(Effect.asVoid)

    return {
      findById,
      findBySite,
      findAll,
      insert,
      update,
      delete: del,
    } satisfies AreaRepository
  })
)
