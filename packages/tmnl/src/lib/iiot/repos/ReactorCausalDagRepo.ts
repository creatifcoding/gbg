/**
 * ReactorCausalDagRepo - cold-path causal chain reconstruction.
 *
 * Reconstructs how source equipment state transitions caused target work order
 * transitions by joining durable EventJournal entries, source transition audit,
 * target transition audit, and relationship graph topology.
 *
 * @module
 */

import { Context, Effect, Layer } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { GraphClient } from '../services/l1/GraphClient'
import { MachineId, PropagationId, WorkOrderId } from '../schemas/identifiers'
import type { StateType } from '../schemas/equipment-state/schema'
import type { WorkOrderStatus } from '../schemas/work-orders'
import {
  MachineWorkOrderCausalChain,
  type MachineWorkOrderCausalQuery,
} from '../schemas/reactor'

// =============================================================================
// Error Types
// =============================================================================

export type ReactorCausalDagRepoError = SqlError.SqlError | unknown

// =============================================================================
// Repository Interface
// =============================================================================

export interface ReactorCausalDagRepository {
  /**
   * Reconstruct Machine/EquipmentState → WorkOrder causal chains.
   *
   * Bounded by machine, propagation id, and/or time range. If no bounds are
   * supplied the query returns all known chains, ordered by source transition
   * then target transition time.
   */
  readonly getMachineWorkOrderChains: (
    query: typeof MachineWorkOrderCausalQuery.Type,
  ) => Effect.Effect<readonly MachineWorkOrderCausalChain[], ReactorCausalDagRepoError>
}

export class ReactorCausalDagRepo extends Context.Tag('iiot/ReactorCausalDagRepo')<
  ReactorCausalDagRepo,
  ReactorCausalDagRepository
>() {}

interface MachineWorkOrderChainRow {
  readonly sourceMachineId: string
  readonly sourcePropagationId: string
  readonly sourceTransitionId: string
  readonly sourceFromState: string
  readonly sourceToState: string
  readonly sourceTransitionedAt: Date
  readonly sourceEventEntryId: string | null
  readonly sourceEventTag: string | null
  readonly sourceEventPrimaryKey: string | null
  readonly sourceEventCreatedAt: Date | null
  readonly targetWorkOrderId: string
  readonly targetTransitionId: string
  readonly targetFromState: string
  readonly targetToState: string
  readonly targetTransitionedAt: Date
  readonly targetPropagationId: string | null
  readonly causedByPropagationId: string
}

const nullToUndefined = <A>(value: A | null | undefined): A | undefined =>
  value == null ? undefined : value

export const ReactorCausalDagRepoLive = Layer.effect(
  ReactorCausalDagRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const graph = yield* GraphClient

    const getMachineWorkOrderChains = (query: typeof MachineWorkOrderCausalQuery.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql<MachineWorkOrderChainRow>`
          SELECT
            est.machine_id AS "sourceMachineId",
            est.propagation_id AS "sourcePropagationId",
            est.id AS "sourceTransitionId",
            est.from_state AS "sourceFromState",
            est.to_state AS "sourceToState",
            est.transitioned_at AS "sourceTransitionedAt",
            encode(ej.id, 'hex') AS "sourceEventEntryId",
            ej.event_tag AS "sourceEventTag",
            ej.primary_key AS "sourceEventPrimaryKey",
            ej.created_at AS "sourceEventCreatedAt",
            wot.work_order_id AS "targetWorkOrderId",
            wot.id AS "targetTransitionId",
            wot.from_state AS "targetFromState",
            wot.to_state AS "targetToState",
            wot.transitioned_at AS "targetTransitionedAt",
            wot.propagation_id AS "targetPropagationId",
            wot.caused_by_propagation_id AS "causedByPropagationId"
          FROM iiot.equipment_state_transitions est
          JOIN iiot.work_order_transitions wot
            ON wot.caused_by_propagation_id = est.propagation_id
          LEFT JOIN iiot.event_journal ej
            ON ej.event_tag = 'EquipmentStateChanged'
           AND ej.payload->>'propagationId' = est.propagation_id
          WHERE est.propagation_id IS NOT NULL
            AND (${query.machineId ?? null}::text IS NULL OR est.machine_id = ${query.machineId ?? null})
            AND (${query.propagationId ?? null}::text IS NULL OR est.propagation_id = ${query.propagationId ?? null})
            AND (${query.startDate ?? null}::timestamp IS NULL OR est.transitioned_at >= ${query.startDate ?? null})
            AND (${query.endDate ?? null}::timestamp IS NULL OR est.transitioned_at <= ${query.endDate ?? null})
          ORDER BY est.transitioned_at ASC, wot.transitioned_at ASC
        `

        return yield* Effect.forEach(rows, (row) =>
          Effect.gen(function* () {
            const relatedWorkOrders = yield* graph.getWorkOrderIdsTargetingMachine(row.sourceMachineId as MachineId)
            const relationshipVerified = relatedWorkOrders.includes(row.targetWorkOrderId as WorkOrderId)

            return new MachineWorkOrderCausalChain({
              sourceMachineId: row.sourceMachineId as MachineId,
              sourcePropagationId: row.sourcePropagationId as PropagationId,
              sourceTransitionId: row.sourceTransitionId,
              sourceFromState: row.sourceFromState as StateType,
              sourceToState: row.sourceToState as StateType,
              sourceTransitionedAt: row.sourceTransitionedAt,
              sourceEventEntryId: nullToUndefined(row.sourceEventEntryId),
              sourceEventTag: nullToUndefined(row.sourceEventTag),
              sourceEventPrimaryKey: nullToUndefined(row.sourceEventPrimaryKey),
              sourceEventCreatedAt: nullToUndefined(row.sourceEventCreatedAt),
              relationshipEdgeType: 'targets',
              relationshipVerified,
              targetWorkOrderId: row.targetWorkOrderId as WorkOrderId,
              targetTransitionId: row.targetTransitionId,
              targetFromState: row.targetFromState as WorkOrderStatus,
              targetToState: row.targetToState as WorkOrderStatus,
              targetTransitionedAt: row.targetTransitionedAt,
              targetPropagationId: nullToUndefined(row.targetPropagationId) as PropagationId | undefined,
              causedByPropagationId: row.causedByPropagationId as PropagationId,
            })
          }),
          { concurrency: 8 },
        )
      })

    return {
      getMachineWorkOrderChains,
    } satisfies ReactorCausalDagRepository
  }),
)
