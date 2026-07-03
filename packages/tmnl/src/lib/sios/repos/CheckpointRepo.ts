/**
 * CheckpointRepo - Repository for CheckpointModel
 * @module sios/repos/CheckpointRepo
 */

import { Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { CheckpointId, WorkPackageId, ZoneId } from '../schemas/identifiers'
import { CheckpointModel } from '../models/CheckpointModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

export type CheckpointRepoError = SqlError.SqlError | ParseResult.ParseError

export interface CheckpointRepository {
  readonly findById: (id: CheckpointId) => Effect.Effect<Option.Option<CheckpointModel>, CheckpointRepoError>
  readonly findByWP: (workPackageId: WorkPackageId) => Effect.Effect<readonly CheckpointModel[], CheckpointRepoError>
  readonly findByZone: (zoneId: ZoneId) => Effect.Effect<readonly CheckpointModel[], CheckpointRepoError>
  readonly findPendingByZone: (zoneId: ZoneId) => Effect.Effect<readonly CheckpointModel[], CheckpointRepoError>
  readonly insert: (checkpoint: typeof CheckpointModel.insert.Type) => Effect.Effect<CheckpointModel, CheckpointRepoError>
  readonly update: (checkpoint: typeof CheckpointModel.update.Type) => Effect.Effect<CheckpointModel, CheckpointRepoError>
}

export class CheckpointRepo extends Context.Tag('sios/CheckpointRepo')<
  CheckpointRepo,
  CheckpointRepository
>() {}

export const CheckpointRepoLive = Layer.effect(
  CheckpointRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const selectColumns = sql`
      id,
      work_package_id AS "workPackageId",
      zone_id AS "zoneId",
      name,
      description,
      status,
      category,
      checklist_items AS "checklistItems",
      required_evidence AS "requiredEvidence",
      collected_evidence AS "collectedEvidence",
      inspector_id AS "inspectorId",
      scheduled_date AS "scheduledDate",
      completed_date AS "completedDate",
      failure_reason AS "failureReason",
      waiver_reason AS "waiverReason",
      waiver_approved_by AS "waiverApprovedBy",
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findById = (id: CheckpointId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.checkpoints
          WHERE id = ${id}
          LIMIT 1
        `

        return yield* decodeOptional(CheckpointModel)(rows)
      })

    const findByWP = (workPackageId: WorkPackageId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.checkpoints
          WHERE work_package_id = ${workPackageId}
          ORDER BY scheduled_date ASC NULLS LAST, created_at ASC
        `

        return yield* decodeRows(CheckpointModel)(rows)
      })

    const findByZone = (zoneId: ZoneId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.checkpoints
          WHERE zone_id = ${zoneId}
          ORDER BY scheduled_date ASC NULLS LAST, created_at ASC
        `

        return yield* decodeRows(CheckpointModel)(rows)
      })

    const findPendingByZone = (zoneId: ZoneId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM sios.checkpoints
          WHERE zone_id = ${zoneId}
            AND status NOT IN ('passed', 'waived')
          ORDER BY scheduled_date ASC NULLS LAST, created_at ASC
        `

        return yield* decodeRows(CheckpointModel)(rows)
      })

    const insert = (checkpoint: typeof CheckpointModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO sios.checkpoints (
            id,
            work_package_id,
            zone_id,
            name,
            description,
            status,
            category,
            checklist_items,
            required_evidence,
            collected_evidence,
            inspector_id,
            scheduled_date,
            completed_date,
            failure_reason,
            waiver_reason,
            waiver_approved_by,
            metadata
          )
          VALUES (
            ${checkpoint.id},
            ${checkpoint.workPackageId},
            ${Option.getOrNull(checkpoint.zoneId)},
            ${checkpoint.name},
            ${Option.getOrNull(checkpoint.description)},
            ${checkpoint.status},
            ${checkpoint.category},
            ${JSON.stringify(checkpoint.checklistItems)},
            ${JSON.stringify(checkpoint.requiredEvidence)},
            ${JSON.stringify(checkpoint.collectedEvidence)},
            ${Option.getOrNull(checkpoint.inspectorId)},
            ${Option.getOrNull(checkpoint.scheduledDate)},
            ${Option.getOrNull(checkpoint.completedDate)},
            ${Option.getOrNull(checkpoint.failureReason)},
            ${Option.getOrNull(checkpoint.waiverReason)},
            ${Option.getOrNull(checkpoint.waiverApprovedBy)},
            ${Option.match(checkpoint.metadata, { onNone: () => null, onSome: (value) => JSON.stringify(value) })}
          )
          RETURNING ${selectColumns}
        `

        return yield* decodeFirst(CheckpointModel)(rows)
      })

    const update = (checkpoint: typeof CheckpointModel.update.Type) =>
      Effect.gen(function* () {
        const changes = prepareUpdate(checkpoint, {
          jsonbFields: ['checklistItems', 'requiredEvidence', 'collectedEvidence', 'metadata'],
        })

        const rows = yield* sql`
          UPDATE sios.checkpoints
          SET ${sql.update(changes, ['id'])}, updated_at = NOW()
          WHERE id = ${checkpoint.id}
          RETURNING ${selectColumns}
        `

        return yield* decodeFirst(CheckpointModel)(rows)
      })

    return {
      findById,
      findByWP,
      findByZone,
      findPendingByZone,
      insert,
      update,
    } satisfies CheckpointRepository
  })
)
