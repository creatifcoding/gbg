/**
 * ZoneRepo - Repository for ZoneModel
 * @module sios/repos/ZoneRepo
 */

import { Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { ZoneId, ProjectId } from '../schemas/identifiers'
import { ZoneModel } from '../models/ZoneModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

export type ZoneRepoError = SqlError.SqlError | ParseResult.ParseError

export interface ZoneRepository {
  readonly findById: (id: ZoneId) => Effect.Effect<Option.Option<ZoneModel>, ZoneRepoError>
  readonly findByProject: (projectId: ProjectId) => Effect.Effect<readonly ZoneModel[], ZoneRepoError>
  readonly findByStatus: (status: string) => Effect.Effect<readonly ZoneModel[], ZoneRepoError>
  readonly insert: (zone: typeof ZoneModel.insert.Type) => Effect.Effect<ZoneModel, ZoneRepoError>
  readonly update: (zone: typeof ZoneModel.update.Type) => Effect.Effect<ZoneModel, ZoneRepoError>
  readonly delete: (id: ZoneId) => Effect.Effect<void, SqlError.SqlError>
}

export class ZoneRepo extends Context.Tag('sios/ZoneRepo')<
  ZoneRepo,
  ZoneRepository
>() {}

export const ZoneRepoLive = Layer.effect(
  ZoneRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const selectColumns = sql`
      id,
      project_id AS "projectId",
      name,
      code,
      status,
      description,
      phase_number AS "phaseNumber",
      access_constraints AS "accessConstraints",
      area_square_feet AS "areaSquareFeet",
      location,
      hold_reason AS "holdReason",
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findById = (id: ZoneId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.zones
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(ZoneModel)(rows)
      })

    const findByProject = (projectId: ProjectId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.zones
          WHERE project_id = ${projectId}
          ORDER BY phase_number ASC NULLS LAST, name ASC
        `
        return yield* decodeRows(ZoneModel)(rows)
      })

    const findByStatus = (status: string) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.zones
          WHERE status = ${status}
          ORDER BY name ASC
        `
        return yield* decodeRows(ZoneModel)(rows)
      })

    const insert = (zone: typeof ZoneModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO sios.zones (
            id,
            project_id,
            name,
            code,
            status,
            description,
            phase_number,
            access_constraints,
            area_square_feet,
            location,
            hold_reason,
            metadata
          )
          VALUES (
            ${zone.id},
            ${zone.projectId},
            ${zone.name},
            ${zone.code},
            ${zone.status},
            ${Option.getOrNull(zone.description)},
            ${Option.getOrNull(zone.phaseNumber)},
            ${Option.getOrNull(zone.accessConstraints)},
            ${Option.getOrNull(zone.areaSquareFeet)},
            ${Option.match(zone.location, { onNone: () => null, onSome: (value) => JSON.stringify(value) })},
            ${Option.getOrNull(zone.holdReason)},
            ${Option.match(zone.metadata, { onNone: () => null, onSome: (value) => JSON.stringify(value) })}
          )
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(ZoneModel)(rows)
      })

    const update = (zone: typeof ZoneModel.update.Type) =>
      Effect.gen(function* () {
        const changes = prepareUpdate(zone, {
          jsonbFields: ['location', 'metadata'],
        })

        const rows = yield* sql`
          UPDATE sios.zones
          SET ${sql.update(changes, ['id'])}, updated_at = NOW()
          WHERE id = ${zone.id}
          RETURNING ${selectColumns}
        `

        return yield* decodeFirst(ZoneModel)(rows)
      })

    const del = (id: ZoneId) =>
      sql`DELETE FROM sios.zones WHERE id = ${id}`.pipe(Effect.asVoid)

    return {
      findById,
      findByProject,
      findByStatus,
      insert,
      update,
      delete: del,
    } satisfies ZoneRepository
  })
)
