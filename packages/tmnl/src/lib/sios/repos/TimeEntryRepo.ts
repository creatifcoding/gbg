/**
 * TimeEntryRepo - Repository for TimeEntryModel
 * @module sios/repos/TimeEntryRepo
 */

import { Context, Layer, Effect, Option, ParseResult, Schema } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { TaskId, WorkPackageId, WorkerId } from '../schemas/identifiers'
import { TimeEntryModel } from '../models/TimeEntryModel'
import { decodeRows, decodeFirst } from './_decode'

export type TimeEntryRepoError = SqlError.SqlError | ParseResult.ParseError

const TimeEntryAggregateModel = Schema.Struct({
  totalHours: Schema.Number,
  totalCost: Schema.Number,
  entryCount: Schema.Number,
})

export type TimeEntryAggregate = typeof TimeEntryAggregateModel.Type

export interface TimeEntryRepository {
  readonly findByTask: (taskId: TaskId) => Effect.Effect<readonly TimeEntryModel[], TimeEntryRepoError>
  readonly findByWP: (workPackageId: WorkPackageId) => Effect.Effect<readonly TimeEntryModel[], TimeEntryRepoError>
  readonly findByWorker: (workerId: WorkerId) => Effect.Effect<readonly TimeEntryModel[], TimeEntryRepoError>
  readonly aggregateByWP: (workPackageId: WorkPackageId) => Effect.Effect<TimeEntryAggregate, TimeEntryRepoError>
  readonly aggregateByTask: (taskId: TaskId) => Effect.Effect<TimeEntryAggregate, TimeEntryRepoError>
  readonly insert: (timeEntry: typeof TimeEntryModel.insert.Type) => Effect.Effect<TimeEntryModel, TimeEntryRepoError>
}

export class TimeEntryRepo extends Context.Tag('sios/TimeEntryRepo')<
  TimeEntryRepo,
  TimeEntryRepository
>() {}

export const TimeEntryRepoLive = Layer.effect(
  TimeEntryRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const selectColumns = sql`
      id,
      task_id AS "taskId",
      work_package_id AS "workPackageId",
      worker_id AS "workerId",
      hours,
      cost,
      work_date AS "workDate",
      shift_pattern AS "shiftPattern",
      cost_code AS "costCode",
      notes,
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findByTask = (taskId: TaskId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.time_entries
          WHERE task_id = ${taskId}
          ORDER BY work_date DESC
        `

        return yield* decodeRows(TimeEntryModel)(rows)
      })

    const findByWP = (workPackageId: WorkPackageId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.time_entries
          WHERE work_package_id = ${workPackageId}
          ORDER BY work_date DESC
        `

        return yield* decodeRows(TimeEntryModel)(rows)
      })

    const findByWorker = (workerId: WorkerId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.time_entries
          WHERE worker_id = ${workerId}
          ORDER BY work_date DESC
        `

        return yield* decodeRows(TimeEntryModel)(rows)
      })

    const aggregateByWP = (workPackageId: WorkPackageId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            COALESCE(SUM(hours), 0)::double precision AS "totalHours",
            COALESCE(SUM(COALESCE(cost, 0)), 0)::double precision AS "totalCost",
            COUNT(*)::double precision AS "entryCount"
          FROM sios.time_entries
          WHERE work_package_id = ${workPackageId}
        `

        return yield* decodeFirst(TimeEntryAggregateModel)(rows)
      })

    const aggregateByTask = (taskId: TaskId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            COALESCE(SUM(hours), 0)::double precision AS "totalHours",
            COALESCE(SUM(COALESCE(cost, 0)), 0)::double precision AS "totalCost",
            COUNT(*)::double precision AS "entryCount"
          FROM sios.time_entries
          WHERE task_id = ${taskId}
        `

        return yield* decodeFirst(TimeEntryAggregateModel)(rows)
      })

    const insert = (timeEntry: typeof TimeEntryModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO sios.time_entries (
            id,
            task_id,
            work_package_id,
            worker_id,
            hours,
            cost,
            work_date,
            shift_pattern,
            cost_code,
            notes,
            metadata
          )
          VALUES (
            ${timeEntry.id},
            ${timeEntry.taskId},
            ${timeEntry.workPackageId},
            ${timeEntry.workerId},
            ${timeEntry.hours},
            ${Option.getOrNull(timeEntry.cost)},
            ${timeEntry.workDate},
            ${Option.getOrNull(timeEntry.shiftPattern)},
            ${Option.getOrNull(timeEntry.costCode)},
            ${Option.getOrNull(timeEntry.notes)},
            ${Option.match(timeEntry.metadata, { onNone: () => null, onSome: (value) => JSON.stringify(value) })}
          )
          RETURNING ${selectColumns}
        `

        return yield* decodeFirst(TimeEntryModel)(rows)
      })

    return {
      findByTask,
      findByWP,
      findByWorker,
      aggregateByWP,
      aggregateByTask,
      insert,
    } satisfies TimeEntryRepository
  })
)
