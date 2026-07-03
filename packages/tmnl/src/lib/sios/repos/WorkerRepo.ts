/**
 * WorkerRepo - Repository for WorkerModel
 * @module sios/repos/WorkerRepo
 */

import { Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { WorkerId, CrewId } from '../schemas/identifiers'
import { WorkerModel } from '../models/WorkerModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

export type WorkerRepoError = SqlError.SqlError | ParseResult.ParseError

export interface WorkerRepository {
  readonly findById: (id: WorkerId) => Effect.Effect<Option.Option<WorkerModel>, WorkerRepoError>
  readonly findByCrew: (crewId: CrewId) => Effect.Effect<readonly WorkerModel[], WorkerRepoError>
  readonly findDeployable: () => Effect.Effect<readonly WorkerModel[], WorkerRepoError>
  readonly findExpiringBadges: (withinDays: number) => Effect.Effect<readonly WorkerModel[], WorkerRepoError>
  readonly insert: (worker: typeof WorkerModel.insert.Type) => Effect.Effect<WorkerModel, WorkerRepoError>
  readonly update: (worker: typeof WorkerModel.update.Type) => Effect.Effect<WorkerModel, WorkerRepoError>
}

export class WorkerRepo extends Context.Tag('sios/WorkerRepo')<
  WorkerRepo,
  WorkerRepository
>() {}

export const WorkerRepoLive = Layer.effect(
  WorkerRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const selectColumns = sql`
      id,
      crew_id AS "crewId",
      name,
      status,
      trade_role AS "tradeRole",
      hourly_rate AS "hourlyRate",
      certifications,
      badge_number AS "badgeNumber",
      badge_expiry AS "badgeExpiry",
      email,
      phone,
      emergency_contact AS "emergencyContact",
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findById = (id: WorkerId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.workers
          WHERE id = ${id}
          LIMIT 1
        `

        return yield* decodeOptional(WorkerModel)(rows)
      })

    const findByCrew = (crewId: CrewId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.workers
          WHERE crew_id = ${crewId}
          ORDER BY name ASC
        `

        return yield* decodeRows(WorkerModel)(rows)
      })

    const findDeployable = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.workers
          WHERE status = 'active'
            AND (badge_expiry IS NULL OR badge_expiry >= NOW())
          ORDER BY name ASC
        `

        return yield* decodeRows(WorkerModel)(rows)
      })

    const findExpiringBadges = (withinDays: number) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.workers
          WHERE badge_expiry IS NOT NULL
            AND badge_expiry >= NOW()
            AND badge_expiry <= NOW() + (${withinDays} * INTERVAL '1 day')
          ORDER BY badge_expiry ASC
        `

        return yield* decodeRows(WorkerModel)(rows)
      })

    const insert = (worker: typeof WorkerModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO sios.workers (
            id,
            crew_id,
            name,
            status,
            trade_role,
            hourly_rate,
            certifications,
            badge_number,
            badge_expiry,
            email,
            phone,
            emergency_contact,
            metadata
          )
          VALUES (
            ${worker.id},
            ${Option.getOrNull(worker.crewId)},
            ${worker.name},
            ${worker.status},
            ${worker.tradeRole},
            ${worker.hourlyRate},
            ${JSON.stringify(worker.certifications)},
            ${Option.getOrNull(worker.badgeNumber)},
            ${Option.getOrNull(worker.badgeExpiry)},
            ${Option.getOrNull(worker.email)},
            ${Option.getOrNull(worker.phone)},
            ${Option.getOrNull(worker.emergencyContact)},
            ${Option.match(worker.metadata, { onNone: () => null, onSome: (value) => JSON.stringify(value) })}
          )
          RETURNING ${selectColumns}
        `

        return yield* decodeFirst(WorkerModel)(rows)
      })

    const update = (worker: typeof WorkerModel.update.Type) =>
      Effect.gen(function* () {
        const changes = prepareUpdate(worker, {
          jsonbFields: ['certifications', 'metadata'],
        })

        const rows = yield* sql`
          UPDATE sios.workers
          SET ${sql.update(changes, ['id'])}, updated_at = NOW()
          WHERE id = ${worker.id}
          RETURNING ${selectColumns}
        `

        return yield* decodeFirst(WorkerModel)(rows)
      })

    return {
      findById,
      findByCrew,
      findDeployable,
      findExpiringBadges,
      insert,
      update,
    } satisfies WorkerRepository
  })
)
