/** WorkOrder graph query/projection service built on generic GraphClient primitives. */

import { Effect } from 'effect'
import type { AssetId, MachineId, WorkOrderId } from '../../schemas/identifiers'
import { GraphQueryError } from '../../schemas/errors'
import {
  RELATIONSHIP_EDGE_REGISTRY,
  RelationshipEdgeMetadata,
  RelationshipEdges,
  RelationshipEndpoints,
} from '../../schemas/relationships'
import { GraphClient } from '../l1/GraphClient'

const escapeCypher = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

export class WorkOrderGraphQueries extends Effect.Service<WorkOrderGraphQueries>()('iiot/WorkOrderGraphQueries', {
  dependencies: [GraphClient.Default],
  effect: Effect.gen(function* () {
    const graph = yield* GraphClient

    const upsertWorkOrderNode = (workOrder: {
      readonly id: WorkOrderId
      readonly status?: string
      readonly primaryAssetId?: AssetId
    }): Effect.Effect<void, GraphQueryError> =>
      graph.upsertRelationshipNode(
        RelationshipEndpoints.workOrder(workOrder.id),
        {
          status: workOrder.status,
          primary_asset_id: workOrder.primaryAssetId,
        },
      )

    const linkWorkOrderToMachine = (
      workOrderId: WorkOrderId,
      machineId: MachineId,
    ): Effect.Effect<void, GraphQueryError> =>
      graph.upsertRelationshipEdge(RelationshipEdges.fromDescriptor(
        RELATIONSHIP_EDGE_REGISTRY.targets,
        RelationshipEndpoints.workOrder(workOrderId),
        RelationshipEndpoints.machine(machineId),
        new RelationshipEdgeMetadata({
          createdBy: 'system',
          reason: 'requires_asset',
          context: { targetLevel: 'machine' },
        }),
      ))

    const upsertWorkOrderTargetingMachine = (workOrder: {
      readonly id: WorkOrderId
      readonly status?: string
      readonly machineId: MachineId
    }): Effect.Effect<void, GraphQueryError> =>
      Effect.gen(function* () {
        yield* upsertWorkOrderNode({
          id: workOrder.id,
          status: workOrder.status,
          primaryAssetId: workOrder.machineId as unknown as AssetId,
        })
        yield* linkWorkOrderToMachine(workOrder.id, workOrder.machineId)
      })

    const getWorkOrderIdsTargetingMachine = (
      machineId: MachineId,
    ): Effect.Effect<readonly WorkOrderId[], GraphQueryError> =>
      Effect.gen(function* () {
        const result = yield* graph.executeReadOnlyCypher(
          `MATCH (wo:work_order)-[:targets]->(m:machine {id: '${escapeCypher(machineId)}'})
           RETURN wo.id AS work_order_id
           ORDER BY wo.id`,
          '(work_order_id agtype)',
        )

        return result.rows.map((row) => String(row['workOrderId']) as WorkOrderId)
      })

    return {
      upsertWorkOrderNode,
      linkWorkOrderToMachine,
      upsertWorkOrderTargetingMachine,
      getWorkOrderIdsTargetingMachine,
    } as const
  }),
}) {}

export const WorkOrderGraphQueriesLive = WorkOrderGraphQueries.Default
