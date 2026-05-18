/**
 * Reactor causal DAG reconstruction integration tests.
 *
 * Proves the cold path can reconstruct:
 * EquipmentState transition → durable source event → targets graph edge →
 * WorkOrder suspend transition.
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { PgClient } from '@effect/sql-pg'
import { GraphClient } from '../../services/l1/GraphClient'
import {
  ReactorCausalDagRepo,
  ReactorCausalDagRepoLive,
} from '../../repos/ReactorCausalDagRepo'
import type { MachineId, PropagationId, WorkOrderId } from '../../schemas/identifiers'
import { GraphIntegrationLayer } from './layer'
import {
  setupTestMachine,
  withCleanMachineDatabase,
} from './machines/layer'

const RUN = process.env['RUN_INTEGRATION_TESTS'] === '1'

let counter = 0
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${++counter}`

describe.skipIf(!RUN)('Reactor causal DAG reconstruction', () => {
  it.effect('reconstructs Machine maintenance → WorkOrder suspend causal chain', () =>
    withCleanMachineDatabase(
      Effect.gen(function* () {
        const sql = yield* PgClient.PgClient
        const graph = yield* GraphClient
        const causalDag = yield* ReactorCausalDagRepo

        const machineId = nextId('TEST-MCH-CAUSAL') as MachineId
        const workOrderId = nextId('TEST-WO-CAUSAL') as WorkOrderId
        const equipmentStateId = `EST-${nextId('causal')}`
        const sourcePropagationId = nextId('PROP-CAUSAL-SOURCE') as PropagationId
        const targetPropagationId = nextId('PROP-CAUSAL-TARGET') as PropagationId

        yield* setupTestMachine(machineId)

        yield* sql`
          INSERT INTO iiot.equipment_states (id, machine_id, state, reason, operator_id, notes)
          VALUES (${equipmentStateId}, ${machineId}, 'planned_downtime', 'scheduled_maintenance', 'reactor-test', 'source transition')
        `

        yield* sql`
          INSERT INTO iiot.equipment_state_transitions (
            machine_id,
            equipment_state_id,
            from_state,
            to_state,
            transitioned_by,
            reason,
            notes,
            propagation_id
          )
          VALUES (
            ${machineId},
            ${equipmentStateId},
            'running',
            'planned_downtime',
            'reactor-test',
            'scheduled_maintenance',
            'source transition',
            ${sourcePropagationId}
          )
        `

        yield* sql`
          INSERT INTO iiot.event_journal (
            id,
            entity_type,
            primary_key,
            event_tag,
            payload,
            identity_id
          )
          VALUES (
            decode(md5(${sourcePropagationId}), 'hex'),
            'equipment',
            ${machineId},
            'EquipmentStateChanged',
            ${JSON.stringify({
              machineId,
              previousState: 'operational',
              newState: 'maintenance',
              propagationId: sourcePropagationId,
            })}::jsonb,
            decode(md5('reactor-causal-dag-test'), 'hex')
          )
          ON CONFLICT DO NOTHING
        `

        yield* sql`
          INSERT INTO iiot.work_orders (
            id,
            workflow_definition_id,
            workflow_version,
            title,
            description,
            type,
            priority,
            status,
            created_by,
            primary_asset_id,
            suspension_reason
          )
          VALUES (
            ${workOrderId},
            'WF-CAUSAL',
            '1',
            'Causal DAG test work order',
            'verifies Reactor chain reconstruction',
            'preventive_maintenance',
            'normal',
            'suspended',
            'reactor-test',
            ${machineId},
            'equipment_unavailable'
          )
        `

        yield* graph.upsertRelationshipNode(
          { type: 'machine', id: machineId },
          { status: 'planned_downtime' },
        )
        yield* graph.upsertWorkOrderTargetingMachine({
          id: workOrderId,
          status: 'suspended',
          machineId,
        })

        yield* sql`
          INSERT INTO iiot.work_order_transitions (
            work_order_id,
            from_state,
            to_state,
            transitioned_by,
            reason,
            propagation_id,
            caused_by_propagation_id
          )
          VALUES (
            ${workOrderId},
            'started',
            'suspended',
            'relationship-reactor-v1',
            'equipment_unavailable',
            ${targetPropagationId},
            ${sourcePropagationId}
          )
        `

        const chains = yield* causalDag.getMachineWorkOrderChains({
          machineId,
          propagationId: sourcePropagationId,
        })

        expect(chains).toHaveLength(1)
        expect(chains[0]!.sourceMachineId).toBe(machineId)
        expect(chains[0]!.sourcePropagationId).toBe(sourcePropagationId)
        expect(chains[0]!.sourceFromState).toBe('running')
        expect(chains[0]!.sourceToState).toBe('planned_downtime')
        expect(chains[0]!.sourceEventTag).toBe('EquipmentStateChanged')
        expect(chains[0]!.sourceEventPrimaryKey).toBe(machineId)
        expect(chains[0]!.relationshipEdgeType).toBe('targets')
        expect(chains[0]!.relationshipVerified).toBe(true)
        expect(chains[0]!.targetWorkOrderId).toBe(workOrderId)
        expect(chains[0]!.targetFromState).toBe('started')
        expect(chains[0]!.targetToState).toBe('suspended')
        expect(chains[0]!.targetPropagationId).toBe(targetPropagationId)
        expect(chains[0]!.causedByPropagationId).toBe(sourcePropagationId)
      })
    ).pipe(
      Effect.provide(ReactorCausalDagRepoLive),
      Effect.provide(GraphIntegrationLayer),
    )
  )
})
