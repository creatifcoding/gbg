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

export interface PlantRepository {
  readonly findById: (id: PlantId) => Effect.Effect<Option.Option<PlantModel>, PlantRepoError>
  readonly findAll: () => Effect.Effect<readonly PlantModel[], PlantRepoError>
  readonly insert: (plant: typeof PlantModel.insert.Type) => Effect.Effect<PlantModel, PlantRepoError>
  readonly update: (plant: typeof PlantModel.update.Type) => Effect.Effect<PlantModel, PlantRepoError>
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

    const findById = (id: PlantId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            name,
            location,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM iiot.plants
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(PlantModel)(rows)
      })

    const findAll = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            name,
            location,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM iiot.plants
          ORDER BY name ASC
        `
        return yield* decodeRows(PlantModel)(rows)
      })

    const insert = (plant: typeof PlantModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO iiot.plants (id, name, location)
          VALUES (${plant.id}, ${plant.name}, ${Option.getOrNull(plant.location)})
          RETURNING
            id,
            name,
            location,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `
        return yield* decodeFirst(PlantModel)(rows)
      })

    const update = (plant: typeof PlantModel.update.Type) =>
      Effect.gen(function* () {
        // sql.update() handles partial updates:
        // - undefined fields → skipped (not in SET)
        // - Option.none() → NULL, Option.some(v) → v
        const changes = prepareUpdate(plant)

        const rows = yield* sql`
          UPDATE iiot.plants
          SET ${sql.update(changes, ['id'])}, updated_at = NOW()
          WHERE id = ${plant.id}
          RETURNING
            id,
            name,
            location,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
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
