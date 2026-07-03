/**
 * ProjectRepo - Repository for ProjectModel
 * @module sios/repos/ProjectRepo
 */

import { Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { ProjectId } from '../schemas/identifiers'
import { ProjectModel } from '../models/ProjectModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

export type ProjectRepoError = SqlError.SqlError | ParseResult.ParseError

export interface ProjectRepository {
  readonly findById: (id: ProjectId) => Effect.Effect<Option.Option<ProjectModel>, ProjectRepoError>
  readonly findAll: () => Effect.Effect<readonly ProjectModel[], ProjectRepoError>
  readonly findByStatus: (status: string) => Effect.Effect<readonly ProjectModel[], ProjectRepoError>
  readonly insert: (project: typeof ProjectModel.insert.Type) => Effect.Effect<ProjectModel, ProjectRepoError>
  readonly update: (project: typeof ProjectModel.update.Type) => Effect.Effect<ProjectModel, ProjectRepoError>
  readonly delete: (id: ProjectId) => Effect.Effect<void, SqlError.SqlError>
}

export class ProjectRepo extends Context.Tag('sios/ProjectRepo')<
  ProjectRepo,
  ProjectRepository
>() {}

export const ProjectRepoLive = Layer.effect(
  ProjectRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const selectColumns = sql`
      id,
      name,
      code,
      status,
      client,
      integrator,
      project_type AS "projectType",
      delivery_method AS "deliveryMethod",
      site_condition AS "siteCondition",
      location,
      shift_window AS "shiftWindow",
      timezone,
      start_date AS "startDate",
      end_date AS "endDate",
      actual_start_date AS "actualStartDate",
      actual_end_date AS "actualEndDate",
      budgeted_cost AS "budgetedCost",
      hold_reason AS "holdReason",
      description,
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findById = (id: ProjectId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.projects
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(ProjectModel)(rows)
      })

    const findAll = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.projects
          ORDER BY name ASC
        `
        return yield* decodeRows(ProjectModel)(rows)
      })

    const findByStatus = (status: string) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.projects
          WHERE status = ${status}
          ORDER BY name ASC
        `
        return yield* decodeRows(ProjectModel)(rows)
      })

    const insert = (project: typeof ProjectModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO sios.projects (
            id,
            name,
            code,
            status,
            client,
            integrator,
            project_type,
            delivery_method,
            site_condition,
            location,
            shift_window,
            timezone,
            start_date,
            end_date,
            actual_start_date,
            actual_end_date,
            budgeted_cost,
            hold_reason,
            description,
            metadata
          )
          VALUES (
            ${project.id},
            ${project.name},
            ${project.code},
            ${project.status},
            ${project.client},
            ${Option.getOrNull(project.integrator)},
            ${project.projectType},
            ${project.deliveryMethod},
            ${project.siteCondition},
            ${Option.match(project.location, { onNone: () => null, onSome: (value) => JSON.stringify(value) })},
            ${Option.match(project.shiftWindow, { onNone: () => null, onSome: (value) => JSON.stringify(value) })},
            ${Option.getOrNull(project.timezone)},
            ${Option.getOrNull(project.startDate)},
            ${Option.getOrNull(project.endDate)},
            ${Option.getOrNull(project.actualStartDate)},
            ${Option.getOrNull(project.actualEndDate)},
            ${project.budgetedCost},
            ${Option.getOrNull(project.holdReason)},
            ${Option.getOrNull(project.description)},
            ${Option.match(project.metadata, { onNone: () => null, onSome: (value) => JSON.stringify(value) })}
          )
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(ProjectModel)(rows)
      })

    const update = (project: typeof ProjectModel.update.Type) =>
      Effect.gen(function* () {
        const changes = prepareUpdate(project, {
          jsonbFields: ['location', 'shiftWindow', 'metadata'],
        })

        const rows = yield* sql`
          UPDATE sios.projects
          SET ${sql.update(changes, ['id'])}, updated_at = NOW()
          WHERE id = ${project.id}
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(ProjectModel)(rows)
      })

    const del = (id: ProjectId) =>
      sql`DELETE FROM sios.projects WHERE id = ${id}`.pipe(Effect.asVoid)

    return {
      findById,
      findAll,
      findByStatus,
      insert,
      update,
      delete: del,
    } satisfies ProjectRepository
  })
)
