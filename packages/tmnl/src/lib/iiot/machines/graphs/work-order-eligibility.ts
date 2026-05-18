/**
 * Rich WorkOrder eligibility helpers for Reactor-facing decisions.
 *
 * The existing boolean graph guards remain the fast local transition checks.
 * These helpers provide explainable outcomes for planning, replay, and audit.
 *
 * @module
 */

import type { WorkOrder } from '../../schemas/work-orders'
import type { PropagationId } from '../../schemas/identifiers'
import {
  EligibilityResult,
  eligible,
  idempotent,
  skipped,
} from '../../schemas/relationships'

const terminalStatuses = new Set([
  'rejected',
  'completed',
  'failed',
  'cancelled',
  'closed',
])

export const classifyWorkOrderSuspendEligibility = (
  workOrder: WorkOrder,
  input: { readonly causedByPropagationId?: PropagationId; readonly alreadyHandledPropagation?: boolean } = {},
): EligibilityResult => {
  if (input.alreadyHandledPropagation) {
    return idempotent({
      entityType: 'work_order',
      entityId: workOrder.id,
      currentState: workOrder.status,
      targetState: 'suspended',
      remediation: input.causedByPropagationId
        ? `Propagation ${input.causedByPropagationId} was already applied to this WorkOrder.`
        : 'Inbound propagation was already applied to this WorkOrder.',
    })
  }

  if (workOrder.status === 'started' || workOrder.status === 'resumed') {
    return eligible({
      entityType: 'work_order',
      entityId: workOrder.id,
      currentState: workOrder.status,
      targetState: 'suspended',
    })
  }

  if (workOrder.status === 'suspended') {
    return skipped({
      entityType: 'work_order',
      entityId: workOrder.id,
      currentState: workOrder.status,
      targetState: 'suspended',
      reason: 'already_suspended',
      remediation: 'No dispatch required; WorkOrder is already suspended.',
    })
  }

  return skipped({
    entityType: 'work_order',
    entityId: workOrder.id,
    currentState: workOrder.status,
    targetState: 'suspended',
    reason: terminalStatuses.has(workOrder.status) ? 'terminal_state' : 'not_started',
    remediation: terminalStatuses.has(workOrder.status)
      ? 'Terminal WorkOrders are not mutated by Reactor consistency propagation.'
      : 'Only started or resumed WorkOrders are eligible for equipment-unavailable suspension.',
  })
}

export const workOrderNotFoundSuspendEligibility = (workOrderId: string): EligibilityResult =>
  skipped({
    entityType: 'work_order',
    entityId: workOrderId,
    targetState: 'suspended',
    reason: 'not_found',
    remediation: 'The graph relationship points to a WorkOrder that is absent from relational state.',
  })
