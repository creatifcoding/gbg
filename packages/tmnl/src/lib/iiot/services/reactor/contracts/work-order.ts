/** WorkOrder Reactor reaction contract. */

import { Effect, Option } from 'effect'
import { WorkOrderEntity, WorkOrderSuspendTag } from '../../../entity/WorkOrderEntity'
import { WorkOrderState } from '../../../state'
import { WorkOrderTransitionRepo } from '../../../repos/WorkOrderTransitionRepo'
import type { WorkOrderId as WorkOrderIdType } from '../../../schemas/identifiers'
import {
  classifyWorkOrderSuspendEligibility,
  workOrderNotFoundSuspendEligibility,
} from '../../../machines/graphs/work-order-eligibility'
import type { EntityReactionContract } from '../ReactorRegistry'

export const makeWorkOrderReactionContract: Effect.Effect<EntityReactionContract, never, WorkOrderState | WorkOrderEntity> =
  Effect.gen(function* () {
    const workOrders = yield* WorkOrderState
    const makeClient = yield* WorkOrderEntity.client
    const transitionRepo = yield* Effect.serviceOption(WorkOrderTransitionRepo)

    return {
      entityType: 'work_order',
      capabilities: new Map([
        ['dependency.blocked', {
          id: 'dependency.blocked',
          classify: (request) =>
            Effect.gen(function* () {
              const workOrderId = request.target.id as WorkOrderIdType
              const alreadyHandledPropagation = Option.isSome(transitionRepo)
                ? yield* transitionRepo.value.hasInboundPropagation(workOrderId, request.causality.propagationId)
                : false

              return yield* workOrders.get(workOrderId).pipe(
                Effect.map((workOrder) => classifyWorkOrderSuspendEligibility(workOrder, {
                  causedByPropagationId: request.causality.propagationId,
                  alreadyHandledPropagation,
                })),
                Effect.catchAll(() => Effect.succeed(workOrderNotFoundSuspendEligibility(workOrderId))),
              )
            }),
          dispatch: (request) => {
            const workOrderId = request.target.id as WorkOrderIdType
            const sourceMachineId = request.source.id
            const client = makeClient(workOrderId)

            return client[WorkOrderSuspendTag]({
              workOrderId,
              reason: 'equipment_unavailable',
              expectedResume: Option.none(),
              causedByPropagationId: Option.some(request.causality.propagationId),
              notes: Option.some(
                `Reactor: dependency blocked by ${request.source.type} ${sourceMachineId}; propagation=${request.causality.propagationId}`,
              ),
            })
          },
        }],
      ]),
    }
  })
