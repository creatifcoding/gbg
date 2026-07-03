/**
 * WorkPackageRepo - Repository for WorkPackageModel
 * @module sios/repos/WorkPackageRepo
 */

import { Context, Layer, Effect, Option, ParseResult, Schema } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { WorkPackageId, ZoneId, ProjectId } from '../schemas/identifiers'
import { WorkPackageModel } from '../models/WorkPackageModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

export type WorkPackageRepoError = SqlError.SqlError | ParseResult.ParseError

const WorkPackageActualsSummaryModel = Schema.Struct({
  actualQty: Schema.Number,
  actualCost: Schema.Number,
  actualHours: Schema.Number,
  packageCount: Schema.Number,
})

export type WorkPackageActualsSummary = typeof WorkPackageActualsSummaryModel.Type

export interface WorkPackageRepository {
  readonly findById: (id: WorkPackageId) => Effect.Effect<Option.Option<WorkPackageModel>, WorkPackageRepoError>
  readonly findByZone: (zoneId: ZoneId) => Effect.Effect<readonly WorkPackageModel[], WorkPackageRepoError>
  readonly findByProject: (projectId: ProjectId) => Effect.Effect<readonly WorkPackageModel[], WorkPackageRepoError>
  readonly findByDiscipline: (discipline: string) => Effect.Effect<readonly WorkPackageModel[], WorkPackageRepoError>
  readonly insert: (workPackage: typeof WorkPackageModel.insert.Type) => Effect.Effect<WorkPackageModel, WorkPackageRepoError>
  readonly update: (workPackage: typeof WorkPackageModel.update.Type) => Effect.Effect<WorkPackageModel, WorkPackageRepoError>
  readonly sumActualsByProject: (projectId: ProjectId) => Effect.Effect<WorkPackageActualsSummary, WorkPackageRepoError>
}

export class WorkPackageRepo extends Context.Tag('sios/WorkPackageRepo')<
  WorkPackageRepo,
  WorkPackageRepository
>() {}

export const WorkPackageRepoLive = Layer.effect(
  WorkPackageRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const selectColumns = sql`
      id,
      project_id AS "projectId",
      zone_id AS "zoneId",
      name,
      code,
      status,
      discipline,
      progress_unit AS "progressUnit",
      equipment_family AS "equipmentFamily",
      assigned_crew_id AS "assignedCrewId",
      planned_qty AS "plannedQty",
      actual_qty AS "actualQty",
      budgeted_cost AS "budgetedCost",
      actual_cost AS "actualCost",
      planned_hours AS "plannedHours",
      actual_hours AS "actualHours",
      scheduled_start AS "scheduledStart",
      scheduled_end AS "scheduledEnd",
      actual_start AS "actualStart",
      actual_end AS "actualEnd",
      description,
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findById = (id: WorkPackageId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.work_packages
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(WorkPackageModel)(rows)
      })

    const findByZone = (zoneId: ZoneId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.work_packages
          WHERE zone_id = ${zoneId}
          ORDER BY name ASC
        `
        return yield* decodeRows(WorkPackageModel)(rows)
      })

    const findByProject = (projectId: ProjectId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.work_packages
          WHERE project_id = ${projectId}
          ORDER BY name ASC
        `
        return yield* decodeRows(WorkPackageModel)(rows)
      })

    const findByDiscipline = (discipline: string) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.work_packages
          WHERE discipline = ${discipline}
          ORDER BY name ASC
        `
        return yield* decodeRows(WorkPackageModel)(rows)
      })

    const insert = (workPackage: typeof WorkPackageModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO sios.work_packages (
            id,
            project_id,
            zone_id,
            name,
            code,
            status,
            discipline,
            progress_unit,
            equipment_family,
            assigned_crew_id,
            planned_qty,
            actual_qty,
            budgeted_cost,
            actual_cost,
            planned_hours,
            actual_hours,
            scheduled_start,
            scheduled_end,
            actual_start,
            actual_end,
            description,
            metadata
          )
          VALUES (
            ${workPackage.id},
            ${workPackage.projectId},
            ${workPackage.zoneId},
            ${workPackage.name},
            ${workPackage.code},
            ${workPackage.status},
            ${workPackage.discipline},
            ${workPackage.progressUnit},
            ${Option.getOrNull(workPackage.equipmentFamily)},
            ${Option.getOrNull(workPackage.assignedCrewId)},
            ${workPackage.plannedQty},
            ${workPackage.actualQty},
            ${workPackage.budgetedCost},
            ${workPackage.actualCost},
            ${workPackage.plannedHours},
            ${workPackage.actualHours},
            ${Option.getOrNull(workPackage.scheduledStart)},
            ${Option.getOrNull(workPackage.scheduledEnd)},
            ${Option.getOrNull(workPackage.actualStart)},
            ${Option.getOrNull(workPackage.actualEnd)},
            ${Option.getOrNull(workPackage.description)},
            ${Option.match(workPackage.metadata, { onNone: () => null, onSome: (value) => JSON.stringify(value) })}
          )
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(WorkPackageModel)(rows)
      })

    const update = (workPackage: typeof WorkPackageModel.update.Type) =>
      Effect.gen(function* () {
        const changes = prepareUpdate(workPackage, {
          jsonbFields: ['metadata'],
        })

        const rows = yield* sql`
          UPDATE sios.work_packages
          SET ${sql.update(changes, ['id'])}, updated_at = NOW()
          WHERE id = ${workPackage.id}
          RETURNING ${selectColumns}
        `

        return yield* decodeFirst(WorkPackageModel)(rows)
      })

    const sumActualsByProject = (projectId: ProjectId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            COALESCE(SUM(actual_qty), 0)::double precision AS "actualQty",
            COALESCE(SUM(actual_cost), 0)::double precision AS "actualCost",
            COALESCE(SUM(actual_hours), 0)::double precision AS "actualHours",
            COUNT(*)::double precision AS "packageCount"
          FROM sios.work_packages
          WHERE project_id = ${projectId}
        `

        return yield* decodeFirst(WorkPackageActualsSummaryModel)(rows)
      })

    return {
      findById,
      findByZone,
      findByProject,
      findByDiscipline,
      insert,
      update,
      sumActualsByProject,
    } satisfies WorkPackageRepository
  })
)
