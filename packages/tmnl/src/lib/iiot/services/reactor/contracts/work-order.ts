/** WorkOrder Reactor reaction contract. */

import { Effect, Option } from 'effect'
import { WorkOrderEntity } from '../../../entity/WorkOrderEntity'
import { WorkOrderState } from '../../../state'
import { WorkOrderTransitionRepo } from '../../../repos/WorkOrderTransitionRepo'
import type { WorkOrderId as WorkOrderIdType } from '../../../schemas/identifiers'
import type { SuspensionReason } from '../../../schemas/work-orders'
import {
  classifyWorkOrderSuspendEligibility,
  workOrderNotFoundSuspendEligibility,
} from '../../../machines/graphs/work-order-eligibility'
import { EntityCapabilityIds, skipped } from '../../../schemas/relationships'
import {
  ReactorConstraintAssertion,
  ReactorConstraintEffects,
  type ReactorPolicyEpoch,
  type ReactorRegistryFingerprint,
  type ReactorSourceEntryId,
} from '../../../schemas/reactor'
import type { EntityReactionCapability, EntityReactionContract } from '../ReactorRegistry'
import { ReactorConstraintAuthority } from '../ReactorConstraintAuthority'
import { WorkOrderDependencyRelease } from './WorkOrderDependencyRelease'

const payloadString = (payload: Record<string, unknown>, key: string): string | undefined => {
  const value = payload[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export const suspensionReasonFromRequest = (payload: Record<string, unknown>): SuspensionReason => {
  const explicit = payloadString(payload, 'suspensionReason')
  switch (explicit) {
    case 'awaiting_parts':
    case 'awaiting_approval':
    case 'awaiting_personnel':
    case 'equipment_unavailable':
    case 'safety_hold':
    case 'quality_hold':
    case 'scheduling_conflict':
    case 'external_dependency':
    case 'other':
      return explicit
    default:
      return payloadString(payload, 'relationshipEdgeType') === 'depends_on'
        ? 'external_dependency'
        : 'equipment_unavailable'
  }
}

export const sqlConstraintAssertionFromRequest = (request: Parameters<EntityReactionCapability['dispatch']>[0]) => {
  const payload = request.payload
  const relationshipEdgeType = payloadString(payload, 'relationshipEdgeType')
  const sourceEntryId = payloadString(payload, 'sourceEntryId')
  const sourceEvent = payloadString(payload, 'sourceEvent')
  const policyEpoch = payloadString(payload, 'policyEpoch')
  const registryFingerprint = payloadString(payload, 'registryFingerprint')

  if (
    relationshipEdgeType === undefined
    || sourceEntryId === undefined
    || sourceEvent === undefined
    || policyEpoch === undefined
    || registryFingerprint === undefined
  ) {
    return undefined
  }

  return new ReactorConstraintAssertion({
    target: request.target,
    capability: request.capability,
    family: 'dependency',
    source: request.source,
    relationshipEdgeType: relationshipEdgeType as never,
    policyId: request.policyId,
    policyVersion: request.policyVersion,
    policyEpoch: policyEpoch as ReactorPolicyEpoch,
    registryFingerprint: registryFingerprint as ReactorRegistryFingerprint,
    sourceEntryId: sourceEntryId as ReactorSourceEntryId,
    sourceEvent,
    propagationId: request.causality.propagationId,
    effect: ReactorConstraintEffects.Blocking,
    metadata: {
      requestId: request.requestId,
      signalAxis: request.signal.axis,
      signalValue: request.signal.value,
      reason: payloadString(payload, 'reason') ?? request.signal.reason,
    },
  })
}

export const makeWorkOrderReactionContract: Effect.Effect<EntityReactionContract, never, WorkOrderState | WorkOrderEntity> =
  Effect.gen(function* () {
    const workOrders = yield* WorkOrderState
    const makeClient = yield* WorkOrderEntity.client
    const transitionRepo = yield* Effect.serviceOption(WorkOrderTransitionRepo)
    const dependencyRelease = yield* Effect.serviceOption(WorkOrderDependencyRelease)
    const constraintAuthority = yield* Effect.serviceOption(ReactorConstraintAuthority)

    const capabilities: Map<string, EntityReactionCapability> = new Map([
      [EntityCapabilityIds.DependencyBlocked, {
        id: EntityCapabilityIds.DependencyBlocked,
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
          const sourceId = request.source.id
          const client = makeClient(workOrderId)
          const suspensionReason = suspensionReasonFromRequest(request.payload)
          const constraintAssertion = sqlConstraintAssertionFromRequest(request)

          return Effect.gen(function* () {
            if (Option.isSome(constraintAuthority) && constraintAssertion !== undefined) {
              yield* constraintAuthority.value.assert(constraintAssertion)
            }

            return yield* client.WorkOrder.Suspend({
              workOrderId,
              reason: suspensionReason,
              expectedResume: Option.none(),
              causedByPropagationId: Option.some(request.causality.propagationId),
              notes: Option.some(
                `Reactor: dependency blocked by ${request.source.type} ${sourceId}; propagation=${request.causality.propagationId}`,
              ),
            })
          })
        },
      }],
      [EntityCapabilityIds.DependencySatisfied, {
        id: EntityCapabilityIds.DependencySatisfied,
        classify: (request) => Effect.succeed(skipped({
          entityType: 'work_order',
          entityId: request.target.id,
          targetState: 'started',
          reason: 'satisfied_capability_parked',
          remediation: 'dependency.satisfied remains informational until a target-owned progression/no-op contract is designed.',
        })),
        dispatch: () => Effect.void,
      }],
    ])

    if (Option.isSome(dependencyRelease)) {
      capabilities.set(EntityCapabilityIds.DependencyReleased, {
        id: EntityCapabilityIds.DependencyReleased,
        classify: dependencyRelease.value.classify,
        dispatch: dependencyRelease.value.dispatch,
      })
    }

    return {
      entityType: 'work_order',
      capabilities,
    }
  })
