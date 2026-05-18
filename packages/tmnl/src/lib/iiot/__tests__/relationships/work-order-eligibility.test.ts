import { describe, expect, it } from 'vitest'
import { DateTime, Option } from 'effect'
import { WorkOrder, type WorkOrderStatus } from '../../schemas/work-orders'
import type { AssetId, PropagationId, WorkOrderId, WorkflowDefinitionId } from '../../schemas/identifiers'
import { classifyWorkOrderSuspendEligibility } from '../../machines/graphs/work-order-eligibility'

const makeWorkOrder = (status: WorkOrderStatus) => new WorkOrder({
  id: `TEST-WO-ELIG-${status}` as WorkOrderId,
  workflowDefinitionId: 'WF-ELIG' as WorkflowDefinitionId,
  workflowVersion: '1',
  title: 'Eligibility fixture',
  description: 'Eligibility fixture',
  type: 'preventive_maintenance',
  priority: 'normal',
  status,
  createdBy: 'test',
  createdAt: DateTime.unsafeNow(),
  scheduledStart: Option.none(),
  dueDate: Option.none(),
  actualStart: Option.none(),
  actualEnd: Option.none(),
  parentWorkOrderId: Option.none(),
  primaryAssetId: Option.some('MCH-ELIG' as AssetId),
  assignedTo: Option.none(),
  outcome: Option.none(),
  summary: Option.none(),
  failedTaskId: Option.none(),
  failureReason: Option.none(),
  suspensionReason: Option.none(),
  expectedResume: Option.none(),
  cancellationReason: Option.none(),
  compensationRequired: false,
  finalStatus: Option.none(),
  metadata: {},
  transitions: [],
})

describe('WorkOrder suspend eligibility', () => {
  it('marks started and resumed WorkOrders eligible', () => {
    expect(classifyWorkOrderSuspendEligibility(makeWorkOrder('started')).outcome).toBe('eligible')
    expect(classifyWorkOrderSuspendEligibility(makeWorkOrder('resumed')).outcome).toBe('eligible')
  })

  it('classifies skipped and idempotent cases with stable reasons', () => {
    expect(classifyWorkOrderSuspendEligibility(makeWorkOrder('completed')).reason).toBe('terminal_state')
    expect(classifyWorkOrderSuspendEligibility(makeWorkOrder('created')).reason).toBe('not_started')
    expect(classifyWorkOrderSuspendEligibility(makeWorkOrder('suspended')).reason).toBe('already_suspended')

    const duplicate = classifyWorkOrderSuspendEligibility(makeWorkOrder('suspended'), {
      causedByPropagationId: 'PROP-DUPLICATE' as PropagationId,
      alreadyHandledPropagation: true,
    })
    expect(duplicate.outcome).toBe('idempotent')
    expect(duplicate.reason).toBe('duplicate_propagation')
  })
})
