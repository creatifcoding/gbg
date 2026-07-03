/**
 * CrewRepo - Repository for CrewModel
 * @module sios/repos/CrewRepo
 */

import { Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { CrewId, ProjectId } from '../schemas/identifiers'
import { CrewModel } from '../models/CrewModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

export type CrewRepoError = SqlError.SqlError | ParseResult.ParseError

export interface CrewRepository {
  readonly findById: (id: CrewId) => Effect.Effect<Option.Option<CrewModel>, CrewRepoError>
  readonly findByProject: (projectId: ProjectId) => Effect.Effect<readonly CrewModel[], CrewRepoError>
  readonly findByDiscipline: (discipline: string) => Effect.Effect<readonly CrewModel[], CrewRepoError>
  readonly insert: (crew: typeof CrewModel.insert.Type) => Effect.Effect<CrewModel, CrewRepoError>
  readonly update: (crew: typeof CrewModel.update.Type) => Effect.Effect<CrewModel, CrewRepoError>
  readonly delete: (id: CrewId) => Effect.Effect<void, SqlError.SqlError>
}

export class CrewRepo extends Context.Tag('sios/CrewRepo')<
  CrewRepo,
  CrewRepository
>() {}

export const CrewRepoLive = Layer.effect(
  CrewRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const selectColumns = sql`
      id,
      project_id AS "projectId",
      name,
      discipline,
      shift_pattern AS "shiftPattern",
      foreman_id AS "foremanId",
      target_headcount AS "targetHeadcount",
      is_active AS "isActive",
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findById = (id: CrewId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.crews
          WHERE id = ${id}
          LIMIT 1
        `

        return yield* decodeOptional(CrewModel)(rows)
      })

    const findByProject = (projectId: ProjectId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.crews
          WHERE project_id = ${projectId}
          ORDER BY name ASC
        `

        return yield* decodeRows(CrewModel)(rows)
      })

    const findByDiscipline = (discipline: string) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.crews
          WHERE discipline = ${discipline}
          ORDER BY name ASC
        `

        return yield* decodeRows(CrewModel)(rows)
      })

    const insert = (crew: typeof CrewModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO sios.crews (
            id,
            project_id,
            name,
            discipline,
            shift_pattern,
            foreman_id,
            target_headcount,
            is_active,
            metadata
          )
          VALUES (
            ${crew.id},
            ${crew.projectId},
            ${crew.name},
            ${crew.discipline},
            ${crew.shiftPattern},
            ${Option.getOrNull(crew.foremanId)},
            ${crew.targetHeadcount},
            ${crew.isActive},
            ${Option.match(crew.metadata, { onNone: () => null, onSome: (value) => JSON.stringify(value) })}
          )
          RETURNING ${selectColumns}
        `

        return yield* decodeFirst(CrewModel)(rows)
      })

    const update = (crew: typeof CrewModel.update.Type) =>
      Effect.gen(function* () {
        const changes = prepareUpdate(crew, {
          jsonbFields: ['metadata'],
        })

        const rows = yield* sql`
          UPDATE sios.crews
          SET ${sql.update(changes, ['id'])}, updated_at = NOW()
          WHERE id = ${crew.id}
          RETURNING ${selectColumns}
        `

        return yield* decodeFirst(CrewModel)(rows)
      })

    const del = (id: CrewId) =>
      sql`DELETE FROM sios.crews WHERE id = ${id}`.pipe(Effect.asVoid)

    return {
      findById,
      findByProject,
      findByDiscipline,
      insert,
      update,
      delete: del,
    } satisfies CrewRepository
  })
)
