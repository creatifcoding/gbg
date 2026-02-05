/**
 * WorkCellRepo - Repository for WorkCell Entity
 *
 * ISA-95 Level 1 (Work Unit) - Parent: Line (required).
 * Model defines schema, Repo handles persistence.
 *
 * Uses decode utilities to ensure FieldOption transforms are applied
 * (null → Option.none()) on raw SQL results.
 *
 * @module
 */

import { Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { WorkCellId, LineId, PlantId } from '../schemas/identifiers'
import { WorkCellModel } from '../models/assets/WorkCellModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type WorkCellRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

export interface WorkCellRepository {
  readonly findById: (id: WorkCellId) => Effect.Effect<Option.Option<WorkCellModel>, WorkCellRepoError>
  readonly findByLine: (lineId: LineId) => Effect.Effect<readonly WorkCellModel[], WorkCellRepoError>
  readonly findByPlant: (plantId: PlantId) => Effect.Effect<readonly WorkCellModel[], WorkCellRepoError>
  readonly findAll: () => Effect.Effect<readonly WorkCellModel[], WorkCellRepoError>
  readonly insert: (workCell: typeof WorkCellModel.insert.Type) => Effect.Effect<WorkCellModel, WorkCellRepoError>
  readonly update: (workCell: typeof WorkCellModel.update.Type) => Effect.Effect<WorkCellModel, WorkCellRepoError>
  readonly delete: (id: WorkCellId) => Effect.Effect<void, SqlError.SqlError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class WorkCellRepo extends Context.Tag('iiot/WorkCellRepo')<
  WorkCellRepo,
  WorkCellRepository
>() {}

// =============================================================================
// Repository Implementation
// =============================================================================

export const WorkCellRepoLive = Layer.effect(
  WorkCellRepo,
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
      line_id AS "lineId",
      description,
      cell_type AS "cellType",
      cycle_time_seconds AS "cycleTimeSeconds",
      position,
      location,
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findById = (id: WorkCellId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.workcells
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(WorkCellModel)(rows)
      })

    const findByLine = (lineId: LineId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.workcells
          WHERE line_id = ${lineId}
          ORDER BY position ASC NULLS LAST, name ASC
        `
        return yield* decodeRows(WorkCellModel)(rows)
      })

    const findByPlant = (plantId: PlantId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.workcells
          WHERE plant_id = ${plantId}
          ORDER BY name ASC
        `
        return yield* decodeRows(WorkCellModel)(rows)
      })

    const findAll = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.workcells
          ORDER BY name ASC
        `
        return yield* decodeRows(WorkCellModel)(rows)
      })

    const insert = (workCell: typeof WorkCellModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO iiot.workcells (
            id, name, status, hierarchy_path, enterprise_id,
            site_id, area_id, plant_id, line_id, description,
            cell_type, cycle_time_seconds, position, location, metadata
          )
          VALUES (
            ${workCell.id},
            ${workCell.name},
            ${workCell.status},
            ${workCell.hierarchyPath},
            ${workCell.enterpriseId},
            ${workCell.siteId},
            ${Option.getOrNull(workCell.areaId)},
            ${workCell.plantId},
            ${workCell.lineId},
            ${Option.getOrNull(workCell.description)},
            ${Option.getOrNull(workCell.cellType)},
            ${Option.getOrNull(workCell.cycleTimeSeconds)},
            ${Option.getOrNull(workCell.position)},
            ${Option.match(workCell.location, { onNone: () => null, onSome: (v) => JSON.stringify(v) })},
            ${Option.match(workCell.metadata, { onNone: () => '{}', onSome: (v) => JSON.stringify(v) })}
          )
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(WorkCellModel)(rows)
      })

    const update = (workCell: typeof WorkCellModel.update.Type) =>
      Effect.gen(function* () {
        const changes = prepareUpdate(workCell)

        const rows = yield* sql`
          UPDATE iiot.workcells
          SET ${sql.update(changes, ['id'])}, updated_at = NOW()
          WHERE id = ${workCell.id}
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(WorkCellModel)(rows)
      })

    const del = (id: WorkCellId) =>
      sql`DELETE FROM iiot.workcells WHERE id = ${id}`.pipe(Effect.asVoid)

    return {
      findById,
      findByLine,
      findByPlant,
      findAll,
      insert,
      update,
      delete: del,
    } satisfies WorkCellRepository
  })
)
