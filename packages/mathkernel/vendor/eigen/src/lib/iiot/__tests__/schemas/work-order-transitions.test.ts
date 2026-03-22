/**
 * WorkOrder Transitions Array Tests
 *
 * Tests for the FDA 21 CFR Part 11 compliant audit trail via
 * the embedded transitions array on WorkOrder.
 *
 * @module @gbg/tmnl/iiot/__tests__/schemas/work-order-transitions
 * @see FDA 21 CFR Part 11 for electronic records compliance
 */

import { describe, it, expect } from 'vitest'
import { Schema, DateTime, Option } from 'effect'
import { WorkOrder, WorkOrderTransition } from '../../schemas/work-orders'
import type { WorkOrderId, WorkflowDefinitionId } from '../../schemas/identifiers'

// =============================================================================
// Test Constants
// =============================================================================

const TEST_WORK_ORDER_ID = 'WO-TEST-001' as WorkOrderId
const TEST_WORKFLOW_DEF_ID = 'WF-TEST-001' as WorkflowDefinitionId

/**
 * Create a minimal WorkOrder for testing, with all optional fields set to None.
 */
const makeTestWorkOrder = (overrides: Partial<{
  id: WorkOrderId
  status: typeof WorkOrder.Type['status']
  transitions: readonly WorkOrderTransition[]
  createdAt: DateTime.Utc
}> = {}) => new WorkOrder({
  id: overrides.id ?? TEST_WORK_ORDER_ID,
  workflowDefinitionId: TEST_WORKFLOW_DEF_ID,
  workflowVersion: '1.0.0',
  title: 'Test Work Order' as any, // NonEmptyString
  description: 'Test description',
  type: 'preventive_maintenance',
  priority: 'normal',
  status: overrides.status ?? 'created',
  createdBy: 'test-user',
  createdAt: overrides.createdAt ?? DateTime.unsafeNow(),
  scheduledStart: Option.none(),
  dueDate: Option.none(),
  actualStart: Option.none(),
  actualEnd: Option.none(),
  parentWorkOrderId: Option.none(),
  primaryAssetId: Option.none(),
  assignedTo: Option.none(),
  outcome: Option.none(),
  summary: Option.none(),
  failedTaskId: Option.none(),
  failureReason: Option.none(),
  suspensionReason: Option.none(),
  expectedResume: Option.none(),
  cancellationReason: Option.none(),
  finalStatus: Option.none(),
  // transitions field - this is what we're testing
  ...(overrides.transitions !== undefined ? { transitions: overrides.transitions } : {}),
})

// =============================================================================
// WorkOrder Transitions Field Tests
// =============================================================================

describe('WorkOrder transitions field', () => {
  it('should have transitions field defaulting to empty array', () => {
    const wo = makeTestWorkOrder()

    expect(wo.transitions).toBeDefined()
    expect(Array.isArray(wo.transitions)).toBe(true)
    expect(wo.transitions.length).toBe(0)
  })

  it('should accept transitions array on construction', () => {
    const now = DateTime.unsafeNow()
    const transition1 = new WorkOrderTransition({
      workOrderId: TEST_WORK_ORDER_ID,
      fromState: 'created',
      toState: 'submitted',
      transitionedAt: now,
      transitionedBy: 'test-user',
      reason: 'Initial submission',
    })

    const wo = makeTestWorkOrder({
      status: 'submitted',
      transitions: [transition1],
    })

    expect(wo.transitions.length).toBe(1)
    expect(wo.transitions[0].fromState).toBe('created')
    expect(wo.transitions[0].toState).toBe('submitted')
  })

  it('should preserve transition history through encode/decode', () => {
    const now = DateTime.unsafeNow()
    const transitions = [
      new WorkOrderTransition({
        workOrderId: TEST_WORK_ORDER_ID,
        fromState: 'created',
        toState: 'submitted',
        transitionedAt: now,
        transitionedBy: 'user-1',
      }),
      new WorkOrderTransition({
        workOrderId: TEST_WORK_ORDER_ID,
        fromState: 'submitted',
        toState: 'approved',
        transitionedAt: DateTime.add(now, { minutes: 30 }),
        transitionedBy: 'approver-1',
        reason: 'Approved by supervisor',
      }),
    ]

    const wo = makeTestWorkOrder({
      status: 'approved',
      transitions,
    })

    // Encode to JSON-compatible format
    const encoded = Schema.encodeSync(WorkOrder)(wo)
    expect(encoded.transitions).toBeDefined()
    expect(encoded.transitions.length).toBe(2)

    // Decode back
    const decoded = Schema.decodeSync(WorkOrder)(encoded)
    expect(decoded.transitions.length).toBe(2)
    expect(decoded.transitions[0].fromState).toBe('created')
    expect(decoded.transitions[1].toState).toBe('approved')
  })

  it('should support full audit trail lifecycle', () => {
    const baseTime = DateTime.unsafeNow()

    // Build up transitions as work order progresses
    const transitions = [
      new WorkOrderTransition({
        workOrderId: TEST_WORK_ORDER_ID,
        fromState: 'created',
        toState: 'submitted',
        transitionedAt: DateTime.add(baseTime, { minutes: 5 }),
        transitionedBy: 'operator-1',
      }),
      new WorkOrderTransition({
        workOrderId: TEST_WORK_ORDER_ID,
        fromState: 'submitted',
        toState: 'approved',
        transitionedAt: DateTime.add(baseTime, { minutes: 30 }),
        transitionedBy: 'supervisor-1',
        reason: 'Approved for execution',
      }),
      new WorkOrderTransition({
        workOrderId: TEST_WORK_ORDER_ID,
        fromState: 'approved',
        toState: 'started',
        transitionedAt: DateTime.add(baseTime, { hours: 1 }),
        transitionedBy: 'technician-1',
      }),
      new WorkOrderTransition({
        workOrderId: TEST_WORK_ORDER_ID,
        fromState: 'started',
        toState: 'completed',
        transitionedAt: DateTime.add(baseTime, { hours: 3 }),
        transitionedBy: 'technician-1',
        reason: 'Work completed successfully',
      }),
    ]

    const wo = makeTestWorkOrder({
      status: 'completed',
      transitions,
      createdAt: baseTime,
    })

    // Verify full audit trail
    expect(wo.transitions.length).toBe(4)

    // Verify chronological order
    const states = wo.transitions.map(t => `${t.fromState}->${t.toState}`)
    expect(states).toEqual([
      'created->submitted',
      'submitted->approved',
      'approved->started',
      'started->completed',
    ])

    // Verify each transition has required audit fields
    wo.transitions.forEach(t => {
      expect(t.workOrderId).toBe(TEST_WORK_ORDER_ID)
      expect(t.transitionedAt).toBeDefined()
      expect(t.transitionedBy).toBeDefined()
    })
  })
})

// =============================================================================
// WorkOrderTransition Schema Tests
// =============================================================================

describe('WorkOrderTransition schema', () => {
  it('should encode and decode correctly', () => {
    const transition = new WorkOrderTransition({
      workOrderId: TEST_WORK_ORDER_ID,
      fromState: 'created',
      toState: 'submitted',
      transitionedAt: DateTime.unsafeNow(),
      transitionedBy: 'test-user',
      reason: 'Test transition',
    })

    const encoded = Schema.encodeSync(WorkOrderTransition)(transition)
    expect(encoded._tag).toBe('WorkOrderTransition')
    expect(encoded.workOrderId).toBe(TEST_WORK_ORDER_ID)

    const decoded = Schema.decodeSync(WorkOrderTransition)(encoded)
    expect(decoded.fromState).toBe('created')
    expect(decoded.toState).toBe('submitted')
  })

  it('should allow optional transitionedBy and reason', () => {
    const transition = new WorkOrderTransition({
      workOrderId: TEST_WORK_ORDER_ID,
      fromState: 'created',
      toState: 'submitted',
      transitionedAt: DateTime.unsafeNow(),
    })

    expect(transition.transitionedBy).toBeUndefined()
    expect(transition.reason).toBeUndefined()
  })
})
