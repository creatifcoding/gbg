/**
 * TaskRepo - Repository for TaskModel
 * @module sios/repos/TaskRepo
 */

import { Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { TaskId, WorkPackageId } from '../schemas/identifiers'
import { TaskModel } from '../models/TaskModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

export type TaskRepoError = SqlError.SqlError | ParseResult.ParseError

export interface TaskRepository {
  readonly findById: (id: TaskId) => Effect.Effect<Option.Option<TaskModel>, TaskRepoError>
  readonly findByWorkPackage: (workPackageId: WorkPackageId) => Effect.Effect<readonly TaskModel[], TaskRepoError>
  readonly findByStatus: (status: string) => Effect.Effect<readonly TaskModel[], TaskRepoError>
  readonly insert: (task: typeof TaskModel.insert.Type) => Effect.Effect<TaskModel, TaskRepoError>
  readonly update: (task: typeof TaskModel.update.Type) => Effect.Effect<TaskModel, TaskRepoError>
}

export class TaskRepo extends Context.Tag('sios/TaskRepo')<
  TaskRepo,
  TaskRepository
>() {}

export const TaskRepoLive = Layer.effect(
  TaskRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const selectColumns = sql`
      id,
      work_package_id AS "workPackageId",
      title,
      description,
      status,
      priority,
      assigned_to AS "assignedTo",
      planned_qty AS "plannedQty",
      actual_qty AS "actualQty",
      planned_hours AS "plannedHours",
      actual_hours AS "actualHours",
      evidence,
      requires_evidence AS "requiresEvidence",
      started_at AS "startedAt",
      completed_at AS "completedAt",
      suspended_at AS "suspendedAt",
      blocked_reason AS "blockedReason",
      blocked_since AS "blockedSince",
      cost_code AS "costCode",
      sort_order AS "sortOrder",
      notes,
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findById = (id: TaskId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.tasks
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(TaskModel)(rows)
      })

    const findByWorkPackage = (workPackageId: WorkPackageId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.tasks
          WHERE work_package_id = ${workPackageId}
          ORDER BY sort_order ASC
        `
        return yield* decodeRows(TaskModel)(rows)
      })

    const findByStatus = (status: string) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.tasks
          WHERE status = ${status}
          ORDER BY created_at DESC
        `
        return yield* decodeRows(TaskModel)(rows)
      })

    const insert = (task: typeof TaskModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO sios.tasks (
            id,
            work_package_id,
            title,
            description,
            status,
            priority,
            assigned_to,
            planned_qty,
            actual_qty,
            planned_hours,
            actual_hours,
            evidence,
            requires_evidence,
            started_at,
            completed_at,
            suspended_at,
            blocked_reason,
            blocked_since,
            cost_code,
            sort_order,
            notes,
            metadata
          )
          VALUES (
            ${task.id},
            ${task.workPackageId},
            ${task.title},
            ${Option.getOrNull(task.description)},
            ${task.status},
            ${task.priority},
            ${Option.getOrNull(task.assignedTo)},
            ${task.plannedQty},
            ${task.actualQty},
            ${task.plannedHours},
            ${task.actualHours},
            ${JSON.stringify(task.evidence)},
            ${task.requiresEvidence},
            ${Option.getOrNull(task.startedAt)},
            ${Option.getOrNull(task.completedAt)},
            ${Option.getOrNull(task.suspendedAt)},
            ${Option.getOrNull(task.blockedReason)},
            ${Option.getOrNull(task.blockedSince)},
            ${Option.getOrNull(task.costCode)},
            ${task.sortOrder},
            ${Option.getOrNull(task.notes)},
            ${Option.match(task.metadata, { onNone: () => null, onSome: (value) => JSON.stringify(value) })}
          )
          RETURNING ${selectColumns}
        `

        return yield* decodeFirst(TaskModel)(rows)
      })

    const update = (task: typeof TaskModel.update.Type) =>
      Effect.gen(function* () {
        const changes = prepareUpdate(task, {
          jsonbFields: ['evidence', 'metadata'],
        })

        const rows = yield* sql`
          UPDATE sios.tasks
          SET ${sql.update(changes, ['id'])}, updated_at = NOW()
          WHERE id = ${task.id}
          RETURNING ${selectColumns}
        `

        return yield* decodeFirst(TaskModel)(rows)
      })

    return {
      findById,
      findByWorkPackage,
      findByStatus,
      insert,
      update,
    } satisfies TaskRepository
  })
)
