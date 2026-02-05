/**
 * Work Order Events — Unit Tests
 *
 * TDD tests for WorkOrder lifecycle events per ISA-95 Level 3.
 *
 * Tests 11 events:
 * - WorkOrderCreated
 * - WorkOrderSubmitted
 * - WorkOrderApproved
 * - WorkOrderRejected
 * - WorkOrderStarted
 * - WorkOrderSuspended
 * - WorkOrderResumed
 * - WorkOrderCompleted
 * - WorkOrderFailed
 * - WorkOrderCancelled
 * - WorkOrderClosed
 *
 * Note: The _tag field inherits from BaseOperationalEvent per Effect Schema
 * pattern. The event tag for EventGroup is managed separately via the
 * EventGroup.add() tag property.
 *
 * @module @gbg/tmnl/iiot/schemas/events/operational/__tests__/work-order-events
 * @see EL-3.1-4 for work order event requirements
 * @see ISA-95/IEC 62264 for operations management
 */

import { describe, it, expect } from 'vitest'
import { Schema, DateTime, Option } from 'effect'

// =============================================================================
// Import Work Order Events
// =============================================================================

import {
  WorkOrderCreated,
  WorkOrderSubmitted,
  WorkOrderApproved,
  WorkOrderRejected,
  WorkOrderStarted,
  WorkOrderSuspended,
  WorkOrderResumed,
  WorkOrderCompleted,
  WorkOrderFailed,
  WorkOrderCancelled,
  WorkOrderClosed,
  WORK_ORDER_EVENT_TAGS,
  type WorkOrderEvent,
  type WorkOrderEventTag,
} from '../work-order-events'

import type {
  WorkOrderId,
  AssetId,
  EventId,
  WorkflowDefinitionId,
  TaskInstanceId,
} from '../../../identifiers'

import type { WorkOrderPriority, WorkOrderOutcome, SuspensionReason, WorkOrderFinalStatus } from '../../../work-orders'

// =============================================================================
// Test Helpers
// =============================================================================

const makeEventId = (): EventId =>
  `EVT-${Date.now()}-${Math.random().toString(36).slice(2)}` as EventId

const mockWorkOrderId = 'WO-2026-00001' as WorkOrderId
const mockAssetId = 'AST-test-wo-001' as AssetId
const mockWorkflowId = 'WF-pm-001' as WorkflowDefinitionId
const mockTaskId = 'TASK-001' as TaskInstanceId
const nowUtc = () => DateTime.unsafeNow()

/** Base operational event fields needed for all event constructors */
const baseEventFields = () => ({
  eventId: makeEventId(),
  occurredAt: nowUtc(),
  correlationId: Option.none() as Option.Option<string>,
})

// =============================================================================
// Feature: Work Order Event Schemas (EL-3.1-4)
// =============================================================================

describe('Feature: Work Order Events (EL-3.1-4)', () => {
  describe('Scenario: WorkOrderCreated event', () => {
    it('Given a new work order, When created, Then WorkOrderCreated event should be valid', () => {
      const event = new WorkOrderCreated({
        ...baseEventFields(),
        causedBy: 'user-123',
        entityId: mockWorkOrderId as unknown as AssetId,
        entityType: 'workcell',
        workOrderId: mockWorkOrderId,
        templateId: Option.some(mockWorkflowId),
        priority: 'normal' as WorkOrderPriority,
        scheduledStart: Option.some(DateTime.unsafeNow()),
        assignedTo: Option.none(),
        title: 'Monthly PM - Line 1',
        description: Option.some('Scheduled preventive maintenance'),
        metadata: Option.none(),
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.workOrderId).toBe(mockWorkOrderId)
      expect(event.priority).toBe('normal')
      expect(Option.isSome(event.templateId)).toBe(true)
    })
  })

  describe('Scenario: WorkOrderSubmitted event', () => {
    it('Given a draft work order, When submitted, Then WorkOrderSubmitted event should be valid', () => {
      const event = new WorkOrderSubmitted({
        ...baseEventFields(),
        causedBy: 'user-123',
        entityId: mockWorkOrderId as unknown as AssetId,
        entityType: 'workcell',
        workOrderId: mockWorkOrderId,
        comments: Option.some('Ready for approval'),
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.workOrderId).toBe(mockWorkOrderId)
      expect(Option.isSome(event.comments)).toBe(true)
    })
  })

  describe('Scenario: WorkOrderApproved event', () => {
    it('Given a submitted work order, When approved, Then WorkOrderApproved event should be valid', () => {
      const event = new WorkOrderApproved({
        ...baseEventFields(),
        causedBy: 'approver-123',
        entityId: mockWorkOrderId as unknown as AssetId,
        entityType: 'workcell',
        workOrderId: mockWorkOrderId,
        approvedBy: 'approver-123',
        approvalLevel: 1,
        comments: Option.some('Approved for execution'),
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.workOrderId).toBe(mockWorkOrderId)
      expect(event.approvedBy).toBe('approver-123')
      expect(event.approvalLevel).toBe(1)
    })
  })

  describe('Scenario: WorkOrderRejected event', () => {
    it('Given a submitted work order, When rejected, Then WorkOrderRejected event should be valid', () => {
      const event = new WorkOrderRejected({
        ...baseEventFields(),
        causedBy: 'approver-123',
        entityId: mockWorkOrderId as unknown as AssetId,
        entityType: 'workcell',
        workOrderId: mockWorkOrderId,
        rejectedBy: 'approver-123',
        reason: 'Insufficient documentation',
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.workOrderId).toBe(mockWorkOrderId)
      expect(event.rejectedBy).toBe('approver-123')
      expect(event.reason).toBe('Insufficient documentation')
    })
  })

  describe('Scenario: WorkOrderStarted event', () => {
    it('Given an approved work order, When started, Then WorkOrderStarted event should be valid', () => {
      const event = new WorkOrderStarted({
        ...baseEventFields(),
        causedBy: 'operator-123',
        entityId: mockWorkOrderId as unknown as AssetId,
        entityType: 'workcell',
        workOrderId: mockWorkOrderId,
        startedBy: 'operator-123',
        assignedTo: Option.some('team-maintenance'),
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.workOrderId).toBe(mockWorkOrderId)
      expect(event.startedBy).toBe('operator-123')
    })
  })

  describe('Scenario: WorkOrderSuspended event', () => {
    it('Given an active work order, When suspended, Then WorkOrderSuspended event should be valid', () => {
      const event = new WorkOrderSuspended({
        ...baseEventFields(),
        causedBy: 'operator-123',
        entityId: mockWorkOrderId as unknown as AssetId,
        entityType: 'workcell',
        workOrderId: mockWorkOrderId,
        suspendedBy: 'operator-123',
        reason: 'awaiting_parts' as SuspensionReason,
        expectedResume: Option.some(DateTime.unsafeNow()),
        notes: Option.some('Waiting for replacement bearing'),
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.workOrderId).toBe(mockWorkOrderId)
      expect(event.reason).toBe('awaiting_parts')
    })
  })

  describe('Scenario: WorkOrderResumed event', () => {
    it('Given a suspended work order, When resumed, Then WorkOrderResumed event should be valid', () => {
      const event = new WorkOrderResumed({
        ...baseEventFields(),
        causedBy: 'operator-123',
        entityId: mockWorkOrderId as unknown as AssetId,
        entityType: 'workcell',
        workOrderId: mockWorkOrderId,
        resumedBy: 'operator-123',
        notes: Option.some('Parts received'),
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.workOrderId).toBe(mockWorkOrderId)
      expect(event.resumedBy).toBe('operator-123')
    })
  })

  describe('Scenario: WorkOrderCompleted event', () => {
    it('Given an active work order, When completed, Then WorkOrderCompleted event should be valid', () => {
      const event = new WorkOrderCompleted({
        ...baseEventFields(),
        causedBy: 'operator-123',
        entityId: mockWorkOrderId as unknown as AssetId,
        entityType: 'workcell',
        workOrderId: mockWorkOrderId,
        completedBy: 'operator-123',
        outcome: 'success' as WorkOrderOutcome,
        summary: 'All tasks completed successfully',
        actualDurationMinutes: Option.some(120),
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.workOrderId).toBe(mockWorkOrderId)
      expect(event.outcome).toBe('success')
      expect(event.summary).toBe('All tasks completed successfully')
    })
  })

  describe('Scenario: WorkOrderFailed event', () => {
    it('Given an active work order, When failed, Then WorkOrderFailed event should be valid', () => {
      const event = new WorkOrderFailed({
        ...baseEventFields(),
        causedBy: 'operator-123',
        entityId: mockWorkOrderId as unknown as AssetId,
        entityType: 'workcell',
        workOrderId: mockWorkOrderId,
        failedTaskId: Option.some(mockTaskId),
        failureReason: 'Equipment malfunction during execution',
        reportedBy: 'operator-123',
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.workOrderId).toBe(mockWorkOrderId)
      expect(event.failureReason).toBe('Equipment malfunction during execution')
      expect(Option.isSome(event.failedTaskId)).toBe(true)
    })
  })

  describe('Scenario: WorkOrderCancelled event', () => {
    it('Given a work order, When cancelled, Then WorkOrderCancelled event should be valid', () => {
      const event = new WorkOrderCancelled({
        ...baseEventFields(),
        causedBy: 'manager-123',
        entityId: mockWorkOrderId as unknown as AssetId,
        entityType: 'workcell',
        workOrderId: mockWorkOrderId,
        cancelledBy: 'manager-123',
        reason: 'Equipment decommissioned',
        compensationRequired: false,
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.workOrderId).toBe(mockWorkOrderId)
      expect(event.reason).toBe('Equipment decommissioned')
      expect(event.compensationRequired).toBe(false)
    })
  })

  describe('Scenario: WorkOrderClosed event', () => {
    it('Given a terminal work order, When closed, Then WorkOrderClosed event should be valid', () => {
      const event = new WorkOrderClosed({
        ...baseEventFields(),
        causedBy: 'system',
        entityId: mockWorkOrderId as unknown as AssetId,
        entityType: 'workcell',
        workOrderId: mockWorkOrderId,
        closedBy: 'system',
        finalStatus: 'completed_success' as WorkOrderFinalStatus,
        archiveReference: Option.some('ARCH-2026-00001'),
        notes: Option.some('Archived for compliance'),
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.workOrderId).toBe(mockWorkOrderId)
      expect(event.finalStatus).toBe('completed_success')
    })
  })

  describe('Scenario: Event tag constants', () => {
    it('Given WORK_ORDER_EVENT_TAGS, Then all 11 events should be listed', () => {
      expect(WORK_ORDER_EVENT_TAGS).toHaveLength(11)
      expect(WORK_ORDER_EVENT_TAGS).toContain('WorkOrderCreated')
      expect(WORK_ORDER_EVENT_TAGS).toContain('WorkOrderSubmitted')
      expect(WORK_ORDER_EVENT_TAGS).toContain('WorkOrderApproved')
      expect(WORK_ORDER_EVENT_TAGS).toContain('WorkOrderRejected')
      expect(WORK_ORDER_EVENT_TAGS).toContain('WorkOrderStarted')
      expect(WORK_ORDER_EVENT_TAGS).toContain('WorkOrderSuspended')
      expect(WORK_ORDER_EVENT_TAGS).toContain('WorkOrderResumed')
      expect(WORK_ORDER_EVENT_TAGS).toContain('WorkOrderCompleted')
      expect(WORK_ORDER_EVENT_TAGS).toContain('WorkOrderFailed')
      expect(WORK_ORDER_EVENT_TAGS).toContain('WorkOrderCancelled')
      expect(WORK_ORDER_EVENT_TAGS).toContain('WorkOrderClosed')
    })
  })

  describe('Scenario: Schema validation', () => {
    it('Given a WorkOrderCreated event, When encoded, Then it should produce correct output', () => {
      const event = new WorkOrderCreated({
        ...baseEventFields(),
        causedBy: 'user-123',
        entityId: mockWorkOrderId as unknown as AssetId,
        entityType: 'workcell',
        workOrderId: mockWorkOrderId,
        templateId: Option.some(mockWorkflowId),
        priority: 'high' as WorkOrderPriority,
        scheduledStart: Option.none(),
        assignedTo: Option.none(),
        title: 'Emergency Repair',
        description: Option.some('Urgent repair needed'),
        metadata: Option.none(),
      })

      const encoded = Schema.encodeSync(WorkOrderCreated)(event)
      expect(encoded.workOrderId).toBe(mockWorkOrderId)
      expect(encoded.priority).toBe('high')
      expect(encoded.title).toBe('Emergency Repair')
    })

    it('should have all required fields for EventGroup integration', () => {
      const event = new WorkOrderCreated({
        ...baseEventFields(),
        causedBy: 'user-123',
        entityId: mockWorkOrderId as unknown as AssetId,
        entityType: 'workcell',
        workOrderId: mockWorkOrderId,
        templateId: Option.none(),
        priority: 'normal' as WorkOrderPriority,
        scheduledStart: Option.none(),
        assignedTo: Option.none(),
        title: 'Test WO',
        description: Option.none(),
        metadata: Option.none(),
      })

      // EventGroup requires these base fields
      expect(event).toHaveProperty('eventId')
      expect(event).toHaveProperty('occurredAt')
      expect(event).toHaveProperty('causedBy')
      expect(event).toHaveProperty('entityId')
      expect(event).toHaveProperty('entityType')

      // WorkOrder events require workOrderId
      expect(event).toHaveProperty('workOrderId')
    })
  })

  describe('Scenario: Priority validation', () => {
    const validPriorities = ['low', 'normal', 'high', 'urgent', 'emergency'] as const

    validPriorities.forEach((priority) => {
      it(`should accept priority: ${priority}`, () => {
        const event = new WorkOrderCreated({
          ...baseEventFields(),
          causedBy: 'user-123',
          entityId: mockWorkOrderId as unknown as AssetId,
          entityType: 'workcell',
          workOrderId: mockWorkOrderId,
          templateId: Option.none(),
          priority: priority as WorkOrderPriority,
          scheduledStart: Option.none(),
          assignedTo: Option.none(),
          title: 'Test WO',
          description: Option.none(),
          metadata: Option.none(),
        })

        expect(event.priority).toBe(priority)
      })
    })
  })

  describe('Scenario: Suspension reason validation', () => {
    const validReasons = [
      'awaiting_parts',
      'awaiting_approval',
      'awaiting_personnel',
      'equipment_unavailable',
      'safety_hold',
      'quality_hold',
      'scheduling_conflict',
      'external_dependency',
      'other',
    ] as const

    validReasons.forEach((reason) => {
      it(`should accept suspension reason: ${reason}`, () => {
        const event = new WorkOrderSuspended({
          ...baseEventFields(),
          causedBy: 'operator-123',
          entityId: mockWorkOrderId as unknown as AssetId,
          entityType: 'workcell',
          workOrderId: mockWorkOrderId,
          suspendedBy: 'operator-123',
          reason: reason as SuspensionReason,
          expectedResume: Option.none(),
          notes: Option.none(),
        })

        expect(event.reason).toBe(reason)
      })
    })
  })
})
