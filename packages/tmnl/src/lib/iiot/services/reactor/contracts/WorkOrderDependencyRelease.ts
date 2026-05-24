/**
 * WorkOrderDependencyRelease — target-owned release adapter.
 *
 * This is intentionally thin: SQL constraint authority reconciles the source
 * constraint first, then WorkOrder local state graph decides whether a resume
 * transition is legal. The adapter never builds constraint ids.
 *
 * @module
 */

import { Context, Effect, Layer, Option } from 'effect'
import { WorkOrderEntity } from '../../../entity/WorkOrderEntity'
import { WorkOrderState } from '../../../state'
import { WorkOrder, WorkOrderStatus } from '../../../schemas/work-orders'
import type { PropagationId, WorkOrderId } from '../../../schemas/identifiers'
import { EntityCapabilityIds, eligible, skipped } from '../../../schemas/relationships'
import {
  EntityReactionRequest,
  TargetConstraintReconciliationResult,
} from '../../../schemas/reactor'
import { ReactorConstraintAuthority } from '../ReactorConstraintAuthority'
import {
  ReactorAdmissionControl,
  reactorAdmissionControlPassthrough,
} from '../ReactorAdmissionControl'

export interface WorkOrderDependencyReleaseTransitionShape {
  readonly resume: (input: {
    readonly workOrderId: WorkOrderId
    readonly causedByPropagationId: PropagationId
    readonly note: string
  }) => Effect.Effect<WorkOrder, unknown>
}

export class WorkOrderDependencyReleaseTransition extends Context.Tag('iiot/WorkOrderDependencyReleaseTransition')<
  WorkOrderDependencyReleaseTransition,
  WorkOrderDependencyReleaseTransitionShape
>() {}

export interface WorkOrderDependencyReleaseShape {
  readonly classify: (request: EntityReactionRequest) => Effect.Effect<ReturnType<typeof eligible> | ReturnType<typeof skipped>, unknown>
  readonly dispatch: (request: EntityReactionRequest) => Effect.Effect<TargetConstraintReconciliationResult, unknown>
}

export class WorkOrderDependencyRelease extends Context.Tag('iiot/WorkOrderDependencyRelease')<
  WorkOrderDependencyRelease,
  WorkOrderDependencyReleaseShape
>() {}

const terminalWorkOrderStatuses = new Set<WorkOrderStatus>([
  'rejected',
  'completed',
  'failed',
  'cancelled',
  'closed',
])

const resultWith = (
  result: TargetConstraintReconciliationResult,
  patch: Partial<{
    readonly verdict: typeof result.verdict
    readonly targetState: string
    readonly reason: string
  }>,
): TargetConstraintReconciliationResult => new TargetConstraintReconciliationResult({
  target: result.target,
  capability: result.capability,
  constraintId: result.constraintId,
  verdict: patch.verdict ?? result.verdict,
  activeConstraintCount: result.activeConstraintCount,
  targetState: patch.targetState ?? result.targetState,
  reason: patch.reason ?? result.reason,
  metadata: result.metadata,
})

export const WorkOrderDependencyReleaseTransitionEntityLive = Layer.effect(
  WorkOrderDependencyReleaseTransition,
  Effect.gen(function* () {
    const makeClient = yield* WorkOrderEntity.client

    return WorkOrderDependencyReleaseTransition.of({
      resume: (input) => {
        const client = makeClient(input.workOrderId)
        return client.WorkOrder.Resume({
          workOrderId: input.workOrderId,
          notes: Option.some(input.note),
          causedByPropagationId: Option.some(input.causedByPropagationId),
        }).pipe(
          Effect.catchAll((error) => Effect.fail(new Error(`WorkOrder resume rejected after constraint retraction: ${String(error)}`))),
        )
      },
    })
  }),
)

export const WorkOrderDependencyReleaseLive = Layer.effect(
  WorkOrderDependencyRelease,
  Effect.gen(function* () {
    const workOrders = yield* WorkOrderState
    const transition = yield* WorkOrderDependencyReleaseTransition
    const constraintAuthority = yield* ReactorConstraintAuthority
    const admissionOption = yield* Effect.serviceOption(ReactorAdmissionControl)
    const admission = Option.getOrElse(admissionOption, () => reactorAdmissionControlPassthrough)

    const classify: WorkOrderDependencyReleaseShape['classify'] = (request) =>
      workOrders.get(request.target.id as WorkOrderId).pipe(
        Effect.map((workOrder) => eligible({
          entityType: 'work_order',
          entityId: workOrder.id,
          currentState: workOrder.status,
          targetState: 'resumed',
        })),
        Effect.catchAll(() => Effect.succeed(skipped({
          entityType: 'work_order',
          entityId: request.target.id,
          targetState: 'resumed',
          reason: 'not_found',
          remediation: 'The graph relationship points to a WorkOrder that is absent from target state.',
        }))),
      )

    const dispatch: WorkOrderDependencyReleaseShape['dispatch'] = (request) =>
      admission.withTargetGate(request.target, Effect.gen(function* () {
        const reconciliation = yield* constraintAuthority.retractFromReactionRequest(request)

        if (reconciliation.verdict !== 'constraint_retracted' || reconciliation.activeConstraintCount !== 0) {
          return reconciliation
        }

        const workOrder = yield* workOrders.get(request.target.id as WorkOrderId)

        if (terminalWorkOrderStatuses.has(workOrder.status)) {
          return resultWith(reconciliation, {
            verdict: 'terminal_state',
            targetState: workOrder.status,
            reason: 'Constraint retracted, but terminal WorkOrder state vetoes automatic release.',
          })
        }

        if (workOrder.status !== 'suspended') {
          return resultWith(reconciliation, {
            verdict: 'constraint_retracted',
            targetState: workOrder.status,
            reason: 'Constraint retracted; WorkOrder was not suspended, so no resume transition was attempted.',
          })
        }

        const note = `Reactor: dependency release accepted; constraint=${Option.getOrElse(reconciliation.constraintId, () => 'unknown')}; propagation=${request.causality.propagationId}`
        const resumed = yield* transition.resume({
          workOrderId: workOrder.id,
          causedByPropagationId: request.causality.propagationId,
          note,
        })

        return resultWith(reconciliation, {
          verdict: EntityCapabilityIds.DependencyReleased === request.capability ? 'released' : 'constraint_retracted',
          targetState: resumed.status,
          reason: 'Constraint cleared and WorkOrder resumed through its target-owned state graph.',
        })
      })).pipe(Effect.withSpan('iiot.reactor.workOrderDependencyRelease.dispatch'))

    return WorkOrderDependencyRelease.of({
      classify,
      dispatch,
    })
  }),
)
