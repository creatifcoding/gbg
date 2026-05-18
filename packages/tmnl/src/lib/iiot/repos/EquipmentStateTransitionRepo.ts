/**
 * EquipmentStateTransitionRepo - append-only audit trail for equipment state transitions.
 *
 * Query patterns mirror WorkOrderTransitionRepo so causal DAG reconstruction can
 * treat source and target transition records uniformly.
 *
 * @module
 */

import { Context, Effect, Layer, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { MachineId } from '../schemas/assets/machine/schema'
import { EquipmentStateId } from '../schemas/equipment-state/schema'
import { PropagationId } from '../schemas/identifiers'
import { EquipmentStateTransitionModel } from '../models/equipment-state/EquipmentStateTransitionModel'
import { decodeFirst, decodeOptional, decodeRows } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type EquipmentStateTransitionRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

export interface EquipmentStateTransitionRepository {
  /** Insert a new transition audit row. Append-only. */
  readonly insert: (
    transition: typeof EquipmentStateTransitionModel.insert.Type
  ) => Effect.Effect<EquipmentStateTransitionModel, EquipmentStateTransitionRepoError>

  /** Get all transitions for a machine, ordered chronologically. */
  readonly getByMachineId: (
    machineId: MachineId
  ) => Effect.Effect<readonly EquipmentStateTransitionModel[], EquipmentStateTransitionRepoError>

  /** Get all transitions for the created equipment state row. */
  readonly getByEquipmentStateId: (
    equipmentStateId: EquipmentStateId
  ) => Effect.Effect<readonly EquipmentStateTransitionModel[], EquipmentStateTransitionRepoError>

  /** Get the most recent transition for a machine. */
  readonly getLatest: (
    machineId: MachineId
  ) => Effect.Effect<Option.Option<EquipmentStateTransitionModel>, EquipmentStateTransitionRepoError>

  /** Count transitions for a machine. */
  readonly count: (
    machineId: MachineId
  ) => Effect.Effect<number, SqlError.SqlError>

  /** Check whether an inbound propagation already caused a transition for this machine. */
  readonly hasInboundPropagation: (
    machineId: MachineId,
    causedByPropagationId: PropagationId,
  ) => Effect.Effect<boolean, SqlError.SqlError>

  /** Time-bounded audit query for causal reconstruction/compliance. */
  readonly getAuditTrail: (params: {
    machineId?: MachineId
    startDate: Date
    endDate: Date
    userId?: string
  }) => Effect.Effect<readonly EquipmentStateTransitionModel[], EquipmentStateTransitionRepoError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class EquipmentStateTransitionRepo extends Context.Tag('iiot/EquipmentStateTransitionRepo')<
  EquipmentStateTransitionRepo,
  EquipmentStateTransitionRepository
>() {}

// =============================================================================
// Column Mapping
// =============================================================================

const SELECT_COLUMNS = `
  id,
  machine_id AS "machineId",
  equipment_state_id AS "equipmentStateId",
  from_state AS "fromState",
  to_state AS "toState",
  transitioned_at AS "transitionedAt",
  transitioned_by AS "transitionedBy",
  reason,
  notes,
  propagation_id AS "propagationId",
  caused_by_propagation_id AS "causedByPropagationId"
`

// =============================================================================
// Repository Implementation
// =============================================================================

export const EquipmentStateTransitionRepoLive = Layer.effect(
  EquipmentStateTransitionRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const insert = (transition: typeof EquipmentStateTransitionModel.insert.Type) =>
      Effect.gen(function* () {
        const transitionedBy = Option.getOrNull(transition.transitionedBy)
        const reason = Option.getOrNull(transition.reason)
        const notes = Option.getOrNull(transition.notes)
        const propagationId = Option.getOrNull(transition.propagationId ?? Option.none())
        const causedByPropagationId = Option.getOrNull(transition.causedByPropagationId ?? Option.none())

        const rows = yield* sql`
          INSERT INTO iiot.equipment_state_transitions (
            machine_id,
            equipment_state_id,
            from_state,
            to_state,
            transitioned_by,
            reason,
            notes,
            propagation_id,
            caused_by_propagation_id
          )
          VALUES (
            ${transition.machineId},
            ${transition.equipmentStateId},
            ${transition.fromState},
            ${transition.toState},
            ${transitionedBy},
            ${reason},
            ${notes},
            ${propagationId},
            ${causedByPropagationId}
          )
          RETURNING ${sql.unsafe(SELECT_COLUMNS)}
        `
        return yield* decodeFirst(EquipmentStateTransitionModel)(rows)
      })

    const getByMachineId = (machineId: MachineId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.equipment_state_transitions
          WHERE machine_id = ${machineId}
          ORDER BY transitioned_at ASC
        `
        return yield* decodeRows(EquipmentStateTransitionModel)(rows)
      })

    const getByEquipmentStateId = (equipmentStateId: EquipmentStateId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.equipment_state_transitions
          WHERE equipment_state_id = ${equipmentStateId}
          ORDER BY transitioned_at ASC
        `
        return yield* decodeRows(EquipmentStateTransitionModel)(rows)
      })

    const getLatest = (machineId: MachineId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.equipment_state_transitions
          WHERE machine_id = ${machineId}
          ORDER BY transitioned_at DESC
          LIMIT 1
        `
        return yield* decodeOptional(EquipmentStateTransitionModel)(rows)
      })

    const count = (machineId: MachineId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT COUNT(*)::integer AS count
          FROM iiot.equipment_state_transitions
          WHERE machine_id = ${machineId}
        `
        return (rows[0] as { count: number }).count
      })

    const hasInboundPropagation = (machineId: MachineId, causedByPropagationId: PropagationId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT EXISTS (
            SELECT 1
            FROM iiot.equipment_state_transitions
            WHERE machine_id = ${machineId}
              AND caused_by_propagation_id = ${causedByPropagationId}
          ) AS exists
        `
        return Boolean((rows[0] as { exists: boolean }).exists)
      })

    const getAuditTrail = (params: {
      machineId?: MachineId
      startDate: Date
      endDate: Date
      userId?: string
    }) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${sql.unsafe(SELECT_COLUMNS)}
          FROM iiot.equipment_state_transitions
          WHERE transitioned_at >= ${params.startDate}
            AND transitioned_at <= ${params.endDate}
            AND (${params.machineId ?? null}::text IS NULL OR machine_id = ${params.machineId ?? null})
            AND (${params.userId ?? null}::text IS NULL OR transitioned_by = ${params.userId ?? null})
          ORDER BY transitioned_at ASC
        `
        return yield* decodeRows(EquipmentStateTransitionModel)(rows)
      })

    return {
      insert,
      getByMachineId,
      getByEquipmentStateId,
      getLatest,
      count,
      hasInboundPropagation,
      getAuditTrail,
    } satisfies EquipmentStateTransitionRepository
  }),
)
