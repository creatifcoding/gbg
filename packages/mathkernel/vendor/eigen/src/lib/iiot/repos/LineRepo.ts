/**
 * LineRepo - Repository for Production Line Entity
 *
 * Separated from LineModel for clean architecture.
 * Model defines schema, Repo handles persistence.
 *
 * Uses decode utilities to ensure Schema transforms are applied
 * on raw SQL results.
 *
 * @module
 */

import { Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { LineId, PlantId } from '../schemas/identifiers'
import { LineModel } from '../models/assets/LineModel'
import { decodeOptional, decodeRows, decodeFirst } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type LineRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

export interface LineRepository {
  readonly findById: (id: LineId) => Effect.Effect<Option.Option<LineModel>, LineRepoError>
  readonly findByPlant: (plantId: PlantId) => Effect.Effect<readonly LineModel[], LineRepoError>
  readonly findAll: () => Effect.Effect<readonly LineModel[], LineRepoError>
  readonly insert: (line: typeof LineModel.insert.Type) => Effect.Effect<LineModel, LineRepoError>
  readonly update: (line: typeof LineModel.update.Type) => Effect.Effect<LineModel, LineRepoError>
  readonly delete: (id: LineId) => Effect.Effect<void, SqlError.SqlError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class LineRepo extends Context.Tag('iiot/LineRepo')<
  LineRepo,
  LineRepository
>() {}

// =============================================================================
// Repository Implementation
// =============================================================================

export const LineRepoLive = Layer.effect(
  LineRepo,
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
      plant_id AS "plantId",
      description,
      capacity,
      operating_hours_per_day AS "operatingHoursPerDay",
      location,
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findById = (id: LineId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.lines
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(LineModel)(rows)
      })

    const findByPlant = (plantId: PlantId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.lines
          WHERE plant_id = ${plantId}
          ORDER BY name ASC
        `
        return yield* decodeRows(LineModel)(rows)
      })

    const findAll = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.lines
          ORDER BY name ASC
        `
        return yield* decodeRows(LineModel)(rows)
      })

    const insert = (line: typeof LineModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO iiot.lines (
            id, name, status, hierarchy_path, enterprise_id,
            site_id, area_id, plant_id, description, capacity,
            operating_hours_per_day, location, metadata
          )
          VALUES (
            ${line.id},
            ${line.name},
            ${line.status},
            ${line.hierarchyPath},
            ${line.enterpriseId},
            ${line.siteId},
            ${Option.getOrNull(line.areaId)},
            ${line.plantId},
            ${Option.getOrNull(line.description)},
            ${Option.getOrNull(line.capacity)},
            ${Option.getOrNull(line.operatingHoursPerDay)},
            ${Option.match(line.location, { onNone: () => null, onSome: (v) => JSON.stringify(v) })},
            ${Option.match(line.metadata, { onNone: () => '{}', onSome: (v) => JSON.stringify(v) })}
          )
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(LineModel)(rows)
      })

    const update = (line: typeof LineModel.update.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          UPDATE iiot.lines
          SET
            name = COALESCE(${line.name ?? null}, name),
            updated_at = NOW()
          WHERE id = ${line.id}
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(LineModel)(rows)
      })

    const del = (id: LineId) =>
      sql`DELETE FROM iiot.lines WHERE id = ${id}`.pipe(Effect.asVoid)

    return {
      findById,
      findByPlant,
      findAll,
      insert,
      update,
      delete: del,
    } satisfies LineRepository
  })
)
