/**
 * EquipmentStateRepo - Repository for EquipmentState Entity
 *
 * Separated from EquipmentStateModel for clean architecture.
 * Model defines schema, Repo handles persistence.
 *
 * Uses decode utilities to ensure FieldOption transforms are applied
 * (null -> Option.none()) on raw SQL results.
 *
 * EquipmentStateModel has many FieldOption fields:
 * - reason, endedAt, operatorId, notes, metadata
 *
 * @module
 */

import { Schema, Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { EquipmentStateId, StateType } from '../schemas/equipment-state/schema'
import { MachineId } from '../schemas/assets/machine/schema'
import { EquipmentStateModel } from '../models/equipment-state/EquipmentStateModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type EquipmentStateRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

export interface EquipmentStateRepository {
  readonly findById: (id: EquipmentStateId) => Effect.Effect<Option.Option<EquipmentStateModel>, EquipmentStateRepoError>
  readonly findByMachine: (machineId: MachineId) => Effect.Effect<readonly EquipmentStateModel[], EquipmentStateRepoError>
  readonly findActive: () => Effect.Effect<readonly EquipmentStateModel[], EquipmentStateRepoError>
  readonly findByState: (state: Schema.Schema.Type<typeof StateType>) => Effect.Effect<readonly EquipmentStateModel[], EquipmentStateRepoError>
  readonly findAll: () => Effect.Effect<readonly EquipmentStateModel[], EquipmentStateRepoError>
  readonly query: (params: {
    machineId?: MachineId
    state?: Schema.Schema.Type<typeof StateType>
    onlyActive?: boolean
    since?: Date
    until?: Date
    limit?: number
  }) => Effect.Effect<readonly EquipmentStateModel[], EquipmentStateRepoError>
  readonly insert: (equipmentState: typeof EquipmentStateModel.insert.Type) => Effect.Effect<EquipmentStateModel, EquipmentStateRepoError>
  readonly update: (equipmentState: Partial<typeof EquipmentStateModel.update.Type> & { id: typeof EquipmentStateModel.update.Type['id'] }) => Effect.Effect<EquipmentStateModel, EquipmentStateRepoError>
  readonly endState: (id: EquipmentStateId, endedAt: Date) => Effect.Effect<EquipmentStateModel, EquipmentStateRepoError>
  readonly delete: (id: EquipmentStateId) => Effect.Effect<void, SqlError.SqlError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class EquipmentStateRepo extends Context.Tag('iiot/EquipmentStateRepo')<
  EquipmentStateRepo,
  EquipmentStateRepository
>() {}

// =============================================================================
// Repository Implementation
// =============================================================================

export const EquipmentStateRepoLive = Layer.effect(
  EquipmentStateRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findById = (id: EquipmentStateId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            machine_id AS "machineId",
            state,
            reason,
            started_at AS "startedAt",
            ended_at AS "endedAt",
            operator_id AS "operatorId",
            notes,
            metadata
          FROM iiot.equipment_states
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(EquipmentStateModel)(rows)
      })

    const findByMachine = (machineId: MachineId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            machine_id AS "machineId",
            state,
            reason,
            started_at AS "startedAt",
            ended_at AS "endedAt",
            operator_id AS "operatorId",
            notes,
            metadata
          FROM iiot.equipment_states
          WHERE machine_id = ${machineId}
          ORDER BY started_at DESC
        `
        return yield* decodeRows(EquipmentStateModel)(rows)
      })

    const findActive = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            machine_id AS "machineId",
            state,
            reason,
            started_at AS "startedAt",
            ended_at AS "endedAt",
            operator_id AS "operatorId",
            notes,
            metadata
          FROM iiot.equipment_states
          WHERE ended_at IS NULL
          ORDER BY started_at DESC
        `
        return yield* decodeRows(EquipmentStateModel)(rows)
      })

    const findByState = (state: Schema.Schema.Type<typeof StateType>) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            machine_id AS "machineId",
            state,
            reason,
            started_at AS "startedAt",
            ended_at AS "endedAt",
            operator_id AS "operatorId",
            notes,
            metadata
          FROM iiot.equipment_states
          WHERE state = ${state}
          ORDER BY started_at DESC
        `
        return yield* decodeRows(EquipmentStateModel)(rows)
      })

    const findAll = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            machine_id AS "machineId",
            state,
            reason,
            started_at AS "startedAt",
            ended_at AS "endedAt",
            operator_id AS "operatorId",
            notes,
            metadata
          FROM iiot.equipment_states
          ORDER BY started_at DESC
        `
        return yield* decodeRows(EquipmentStateModel)(rows)
      })

    const query = (params: {
      machineId?: MachineId
      state?: Schema.Schema.Type<typeof StateType>
      onlyActive?: boolean
      since?: Date
      until?: Date
      limit?: number
    }) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            machine_id AS "machineId",
            state,
            reason,
            started_at AS "startedAt",
            ended_at AS "endedAt",
            operator_id AS "operatorId",
            notes,
            metadata
          FROM iiot.equipment_states
          WHERE 1=1
            AND (${params.machineId ?? null}::text IS NULL OR machine_id = ${params.machineId ?? null})
            AND (${params.state ?? null}::text IS NULL OR state = ${params.state ?? null})
            AND (${params.onlyActive ?? false} = false OR ended_at IS NULL)
            AND (${params.since ?? null}::timestamp IS NULL OR started_at >= ${params.since ?? null})
            AND (${params.until ?? null}::timestamp IS NULL OR started_at <= ${params.until ?? null})
          ORDER BY started_at DESC
          LIMIT ${params.limit ?? 1000}
        `
        return yield* decodeRows(EquipmentStateModel)(rows)
      })

    const insert = (equipmentState: typeof EquipmentStateModel.insert.Type) =>
      Effect.gen(function* () {
        // FieldOption fields: use Option.getOrNull to convert Option to null/value
        // NOTE: pg driver handles JSONB objects directly - no JSON.stringify needed
        const reasonValue = Option.getOrNull(equipmentState.reason)
        const operatorIdValue = Option.getOrNull(equipmentState.operatorId)
        const notesValue = Option.getOrNull(equipmentState.notes)
        const metadataValue = Option.getOrNull(equipmentState.metadata)

        const rows = yield* sql`
          INSERT INTO iiot.equipment_states (machine_id, state, reason, operator_id, notes, metadata)
          VALUES (
            ${equipmentState.machineId},
            ${equipmentState.state},
            ${reasonValue},
            ${operatorIdValue},
            ${notesValue},
            ${metadataValue}
          )
          RETURNING
            id,
            machine_id AS "machineId",
            state,
            reason,
            started_at AS "startedAt",
            ended_at AS "endedAt",
            operator_id AS "operatorId",
            notes,
            metadata
        `
        return yield* decodeFirst(EquipmentStateModel)(rows)
      })

    const update = (equipmentState: Partial<typeof EquipmentStateModel.update.Type> & { id: typeof EquipmentStateModel.update.Type['id'] }) =>
      Effect.gen(function* () {
        // sql.update() handles partial updates:
        // - undefined fields -> skipped (not in SET)
        // - Option.none() -> NULL, Option.some(v) -> v
        const changes = prepareUpdate(equipmentState)

        const rows = yield* sql`
          UPDATE iiot.equipment_states
          SET ${sql.update(changes, ['id'])}
          WHERE id = ${equipmentState.id}
          RETURNING
            id,
            machine_id AS "machineId",
            state,
            reason,
            started_at AS "startedAt",
            ended_at AS "endedAt",
            operator_id AS "operatorId",
            notes,
            metadata
        `
        return yield* decodeFirst(EquipmentStateModel)(rows)
      })

    const endState = (id: EquipmentStateId, endedAt: Date) =>
      Effect.gen(function* () {
        // Try to update - only affects rows not yet ended
        const rows = yield* sql`
          UPDATE iiot.equipment_states
          SET ended_at = ${endedAt}
          WHERE id = ${id} AND ended_at IS NULL
          RETURNING
            id,
            machine_id AS "machineId",
            state,
            reason,
            started_at AS "startedAt",
            ended_at AS "endedAt",
            operator_id AS "operatorId",
            notes,
            metadata
        `
        // If rows returned, decode and return the updated state
        if (rows.length > 0) {
          return yield* decodeFirst(EquipmentStateModel)(rows)
        }
        // Idempotent: already ended - return existing state
        const existing = yield* findById(id)
        return yield* Option.match(existing, {
          onNone: () => Effect.fail(new SqlError.SqlError({ message: `EquipmentState not found: ${id}` })),
          onSome: Effect.succeed,
        })
      })

    const del = (id: EquipmentStateId) =>
      sql`DELETE FROM iiot.equipment_states WHERE id = ${id}`.pipe(Effect.asVoid)

    return {
      findById,
      findByMachine,
      findActive,
      findByState,
      findAll,
      query,
      insert,
      update,
      endState,
      delete: del,
    } satisfies EquipmentStateRepository
  })
)
