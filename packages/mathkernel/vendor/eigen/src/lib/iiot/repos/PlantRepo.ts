/**
 * PlantRepo - Repository for Plant Entity
 *
 * Separated from PlantModel for clean architecture.
 * Model defines schema, Repo handles persistence.
 *
 * Uses decode utilities to ensure FieldOption transforms are applied
 * (null → Option.none()) on raw SQL results.
 *
 * @module
 */

import { Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { PlantId } from '../schemas/identifiers'
import { PlantModel } from '../models/assets/PlantModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type PlantRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

/**
 * Partial update type - id required, all other fields optional
 */
type PlantUpdate = Partial<typeof PlantModel.update.Type> & { id: PlantId }

export interface PlantRepository {
  readonly findById: (id: PlantId) => Effect.Effect<Option.Option<PlantModel>, PlantRepoError>
  readonly findAll: () => Effect.Effect<readonly PlantModel[], PlantRepoError>
  readonly insert: (plant: typeof PlantModel.insert.Type) => Effect.Effect<PlantModel, PlantRepoError>
  readonly update: (plant: PlantUpdate) => Effect.Effect<PlantModel, PlantRepoError>
  readonly delete: (id: PlantId) => Effect.Effect<void, SqlError.SqlError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class PlantRepo extends Context.Tag('iiot/PlantRepo')<
  PlantRepo,
  PlantRepository
>() {}

// =============================================================================
// Repository Implementation
// =============================================================================

export const PlantRepoLive = Layer.effect(
  PlantRepo,
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
      area_id AS "areaId",
      timezone,
      description,
      site_code AS "siteCode",
      location,
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findById = (id: PlantId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.plants
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(PlantModel)(rows)
      })

    const findAll = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.plants
          ORDER BY name ASC
        `
        return yield* decodeRows(PlantModel)(rows)
      })

    const insert = (plant: typeof PlantModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO iiot.plants (
            id, name, status, hierarchy_path, enterprise_id,
            site_id, area_id, timezone, description, site_code,
            location, metadata
          )
          VALUES (
            ${plant.id},
            ${plant.name},
            ${plant.status},
            ${plant.hierarchyPath},
            ${plant.enterpriseId},
            ${Option.getOrNull(plant.siteId)},
            ${Option.getOrNull(plant.areaId)},
            ${plant.timezone},
            ${Option.getOrNull(plant.description)},
            ${Option.getOrNull(plant.siteCode)},
            ${Option.match(plant.location, { onNone: () => null, onSome: (v) => JSON.stringify(v) })},
            ${Option.match(plant.metadata, { onNone: () => '{}', onSome: (v) => JSON.stringify(v) })}
          )
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(PlantModel)(rows)
      })

    const update = (plant: PlantUpdate) =>
      Effect.gen(function* () {
        // sql.update() handles partial updates:
        // - undefined fields → skipped (not in SET)
        // - Option.none() → NULL, Option.some(v) → v
        // JSONB fields need JSON.stringify
        const changes = prepareUpdate(plant, { jsonbFields: ['location', 'metadata'] })

        const rows = yield* sql`
          UPDATE iiot.plants
          SET ${sql.update(changes, ['id'])}, updated_at = NOW()
          WHERE id = ${plant.id}
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(PlantModel)(rows)
      })

    const del = (id: PlantId) =>
      sql`DELETE FROM iiot.plants WHERE id = ${id}`.pipe(Effect.asVoid)

    return {
      findById,
      findAll,
      insert,
      update,
      delete: del,
    } satisfies PlantRepository
  })
)
