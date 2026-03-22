/**
 * Approval Events - BDD Tests
 *
 * Feature: Approval Workflow Events
 *   As an IIoT system operator
 *   I want approval workflow events that track approval request lifecycle
 *   So that I have a complete audit trail of approval decisions
 *
 * @module @gbg/tmnl/iiot/schemas/events/operational/__tests__/approval-events.test
 */

import { describe, it, expect } from 'vitest'
import { Schema, DateTime, Option } from 'effect'
import {
  ApprovalRequested,
  ApprovalGranted,
  ApprovalRejected,
  ApprovalEscalated,
  ApprovalCompleted,
  ApprovalExpired,
  ApprovalStatus,
  ApprovalLevel,
  ApproverId,
  ApprovalRequestId,
  APPROVAL_EVENT_TAGS,
  type ApprovalEvent,
  type ApprovalEventTag,
} from '../approval-events'
import { AssetId, EventId, EquipmentLevel } from '../../../../identifiers'

// =============================================================================
// Feature: Branded Identifiers for Approvals
// =============================================================================

describe('Feature: Approval Branded Identifiers', () => {
  describe('Scenario: Valid ApprovalRequestId encoding', () => {
    it('Given a valid string, When encoding as ApprovalRequestId, Then it should succeed', () => {
      const result = Schema.decodeUnknownSync(ApprovalRequestId)('APREQ-001')
      expect(result).toBe('APREQ-001')
    })

    it('Given a non-string, When encoding as ApprovalRequestId, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(ApprovalRequestId)(123)).toThrow()
    })
  })

  describe('Scenario: Valid ApproverId encoding', () => {
    it('Given a valid string, When encoding as ApproverId, Then it should succeed', () => {
      const result = Schema.decodeUnknownSync(ApproverId)('USER-001')
      expect(result).toBe('USER-001')
    })

    it('Given null, When encoding as ApproverId, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(ApproverId)(null)).toThrow()
    })
  })

  describe('Scenario: ApprovalLevel validation', () => {
    it('Given positive integers, When encoding as ApprovalLevel, Then it should succeed', () => {
      expect(Schema.decodeUnknownSync(ApprovalLevel)(1)).toBe(1)
      expect(Schema.decodeUnknownSync(ApprovalLevel)(2)).toBe(2)
      expect(Schema.decodeUnknownSync(ApprovalLevel)(3)).toBe(3)
    })

    it('Given zero or negative, When encoding as ApprovalLevel, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(ApprovalLevel)(0)).toThrow()
      expect(() => Schema.decodeUnknownSync(ApprovalLevel)(-1)).toThrow()
    })

    it('Given non-integer, When encoding as ApprovalLevel, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(ApprovalLevel)(1.5)).toThrow()
    })
  })

  describe('Scenario: ApprovalStatus enum validation', () => {
    it('Given valid status values, When decoding, Then all should succeed', () => {
      const validStatuses = ['pending', 'approved', 'rejected', 'escalated', 'expired']

      validStatuses.forEach((status) => {
        expect(Schema.decodeUnknownSync(ApprovalStatus)(status)).toBe(status)
      })
    })

    it('Given invalid status, When decoding, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(ApprovalStatus)('invalid')).toThrow()
    })
  })
})

// =============================================================================
// Feature: ApprovalRequested Event
// =============================================================================

describe('Feature: ApprovalRequested Event', () => {
  const makeBaseFields = () => ({
    eventId: 'EVT-001' as EventId,
    occurredAt: DateTime.unsafeNow(),
    causedBy: 'system',
    entityId: 'WO-001' as AssetId,
    entityType: 'machine' as EquipmentLevel,
    correlationId: Option.none<string>(),
  })

  describe('Scenario: Valid approval request creation', () => {
    it('Given valid data, When creating ApprovalRequested, Then it should succeed', () => {
      const event = new ApprovalRequested({
        ...makeBaseFields(),
        approvalRequestId: 'APREQ-001' as Schema.Schema.Type<typeof ApprovalRequestId>,
        requestedBy: 'USER-001' as Schema.Schema.Type<typeof ApproverId>,
        requiredLevel: 1 as Schema.Schema.Type<typeof ApprovalLevel>,
        requestType: 'work_order_approval',
        subjectId: 'WO-001',
        subjectType: 'WorkOrder',
        expiresAt: Option.some(DateTime.unsafeNow()),
        justification: Option.some('Urgent maintenance required'),
        metadata: Option.none(),
      })

      // Note: _tag is inherited from BaseOperationalEvent when using .extend()
      // Check instance type and event-specific fields instead
      expect(event).toBeInstanceOf(ApprovalRequested)
      expect(event.approvalRequestId).toBe('APREQ-001')
      expect(event.requiredLevel).toBe(1)
      expect(event.requestType).toBe('work_order_approval')
    })

    it('Given request without expiry, When creating ApprovalRequested, Then expiresAt should be Option.none', () => {
      const event = new ApprovalRequested({
        ...makeBaseFields(),
        approvalRequestId: 'APREQ-002' as Schema.Schema.Type<typeof ApprovalRequestId>,
        requestedBy: 'USER-001' as Schema.Schema.Type<typeof ApproverId>,
        requiredLevel: 2 as Schema.Schema.Type<typeof ApprovalLevel>,
        requestType: 'config_change',
        subjectId: 'CFG-001',
        subjectType: 'Configuration',
        expiresAt: Option.none(),
        justification: Option.none(),
        metadata: Option.none(),
      })

      expect(Option.isNone(event.expiresAt)).toBe(true)
    })
  })
})

// =============================================================================
// Feature: ApprovalGranted Event
// =============================================================================

describe('Feature: ApprovalGranted Event', () => {
  const makeBaseFields = () => ({
    eventId: 'EVT-002' as EventId,
    occurredAt: DateTime.unsafeNow(),
    causedBy: 'approver-001',
    entityId: 'WO-001' as AssetId,
    entityType: 'machine' as EquipmentLevel,
    correlationId: Option.none<string>(),
  })

  describe('Scenario: Approval granted with conditions', () => {
    it('Given approval with conditions, When creating ApprovalGranted, Then conditions should be preserved', () => {
      const event = new ApprovalGranted({
        ...makeBaseFields(),
        approvalRequestId: 'APREQ-001' as Schema.Schema.Type<typeof ApprovalRequestId>,
        approvedBy: 'APPROVER-001' as Schema.Schema.Type<typeof ApproverId>,
        approvalLevel: 1 as Schema.Schema.Type<typeof ApprovalLevel>,
        conditions: Option.some('Must complete by end of shift'),
        validUntil: Option.some(DateTime.unsafeNow()),
        comments: Option.some('Approved for immediate action'),
      })

      // Note: _tag is inherited from BaseOperationalEvent when using .extend()
      expect(event).toBeInstanceOf(ApprovalGranted)
      expect(Option.isSome(event.conditions)).toBe(true)
      expect(Option.getOrThrow(event.conditions)).toBe('Must complete by end of shift')
      expect(event.approvalLevel).toBe(1)
    })

    it('Given unconditional approval, When creating ApprovalGranted, Then conditions should be Option.none', () => {
      const event = new ApprovalGranted({
        ...makeBaseFields(),
        approvalRequestId: 'APREQ-001' as Schema.Schema.Type<typeof ApprovalRequestId>,
        approvedBy: 'APPROVER-001' as Schema.Schema.Type<typeof ApproverId>,
        approvalLevel: 1 as Schema.Schema.Type<typeof ApprovalLevel>,
        conditions: Option.none(),
        validUntil: Option.none(),
        comments: Option.none(),
      })

      expect(Option.isNone(event.conditions)).toBe(true)
    })
  })
})

// =============================================================================
// Feature: ApprovalRejected Event
// =============================================================================

describe('Feature: ApprovalRejected Event', () => {
  const makeBaseFields = () => ({
    eventId: 'EVT-003' as EventId,
    occurredAt: DateTime.unsafeNow(),
    causedBy: 'approver-002',
    entityId: 'WO-001' as AssetId,
    entityType: 'machine' as EquipmentLevel,
    correlationId: Option.none<string>(),
  })

  describe('Scenario: Approval rejection with reason', () => {
    it('Given rejection with reason, When creating ApprovalRejected, Then reason must be non-empty', () => {
      const event = new ApprovalRejected({
        ...makeBaseFields(),
        approvalRequestId: 'APREQ-001' as Schema.Schema.Type<typeof ApprovalRequestId>,
        rejectedBy: 'APPROVER-002' as Schema.Schema.Type<typeof ApproverId>,
        approvalLevel: 1 as Schema.Schema.Type<typeof ApprovalLevel>,
        reason: 'Insufficient justification provided',
        canResubmit: true,
        suggestedChanges: Option.some('Please provide cost-benefit analysis'),
      })

      // Note: _tag is inherited from BaseOperationalEvent when using .extend()
      expect(event).toBeInstanceOf(ApprovalRejected)
      expect(event.reason).toBe('Insufficient justification provided')
      expect(event.canResubmit).toBe(true)
    })

    it('Given final rejection, When creating ApprovalRejected, Then canResubmit should be false', () => {
      const event = new ApprovalRejected({
        ...makeBaseFields(),
        approvalRequestId: 'APREQ-001' as Schema.Schema.Type<typeof ApprovalRequestId>,
        rejectedBy: 'APPROVER-002' as Schema.Schema.Type<typeof ApproverId>,
        approvalLevel: 2 as Schema.Schema.Type<typeof ApprovalLevel>,
        reason: 'Request permanently denied due to policy violation',
        canResubmit: false,
        suggestedChanges: Option.none(),
      })

      expect(event.canResubmit).toBe(false)
    })
  })
})

// =============================================================================
// Feature: ApprovalEscalated Event
// =============================================================================

describe('Feature: ApprovalEscalated Event', () => {
  const makeBaseFields = () => ({
    eventId: 'EVT-004' as EventId,
    occurredAt: DateTime.unsafeNow(),
    causedBy: 'system',
    entityId: 'WO-001' as AssetId,
    entityType: 'machine' as EquipmentLevel,
    correlationId: Option.none<string>(),
  })

  describe('Scenario: Approval escalation to higher authority', () => {
    it('Given timeout escalation, When creating ApprovalEscalated, Then escalation path should be tracked', () => {
      const event = new ApprovalEscalated({
        ...makeBaseFields(),
        approvalRequestId: 'APREQ-001' as Schema.Schema.Type<typeof ApprovalRequestId>,
        fromLevel: 1 as Schema.Schema.Type<typeof ApprovalLevel>,
        toLevel: 2 as Schema.Schema.Type<typeof ApprovalLevel>,
        escalatedTo: 'MANAGER-001' as Schema.Schema.Type<typeof ApproverId>,
        escalationReason: 'timeout',
        elapsedSeconds: 3600,
        previousApprovers: ['APPROVER-001'],
        notes: Option.some('No response within SLA'),
      })

      // Note: _tag is inherited from BaseOperationalEvent when using .extend()
      expect(event).toBeInstanceOf(ApprovalEscalated)
      expect(event.fromLevel).toBe(1)
      expect(event.toLevel).toBe(2)
      expect(event.escalationReason).toBe('timeout')
    })

    it('Given manual escalation, When creating ApprovalEscalated, Then reason should be manual', () => {
      const event = new ApprovalEscalated({
        ...makeBaseFields(),
        approvalRequestId: 'APREQ-001' as Schema.Schema.Type<typeof ApprovalRequestId>,
        fromLevel: 1 as Schema.Schema.Type<typeof ApprovalLevel>,
        toLevel: 3 as Schema.Schema.Type<typeof ApprovalLevel>,
        escalatedTo: 'DIRECTOR-001' as Schema.Schema.Type<typeof ApproverId>,
        escalationReason: 'manual',
        elapsedSeconds: 1800,
        previousApprovers: ['APPROVER-001', 'MANAGER-001'],
        notes: Option.some('Escalated by manager request'),
      })

      expect(event.escalationReason).toBe('manual')
      expect(event.previousApprovers).toContain('MANAGER-001')
    })
  })
})

// =============================================================================
// Feature: ApprovalCompleted Event
// =============================================================================

describe('Feature: ApprovalCompleted Event', () => {
  const makeBaseFields = () => ({
    eventId: 'EVT-005' as EventId,
    occurredAt: DateTime.unsafeNow(),
    causedBy: 'system',
    entityId: 'WO-001' as AssetId,
    entityType: 'machine' as EquipmentLevel,
    correlationId: Option.none<string>(),
  })

  describe('Scenario: Approval process completion', () => {
    it('Given successful approval chain, When creating ApprovalCompleted, Then final status should be approved', () => {
      const event = new ApprovalCompleted({
        ...makeBaseFields(),
        approvalRequestId: 'APREQ-001' as Schema.Schema.Type<typeof ApprovalRequestId>,
        finalStatus: 'approved',
        totalLevelsRequired: 2 as Schema.Schema.Type<typeof ApprovalLevel>,
        totalLevelsCompleted: 2 as Schema.Schema.Type<typeof ApprovalLevel>,
        approvers: ['APPROVER-001', 'MANAGER-001'],
        totalDurationSeconds: 7200,
        notes: Option.some('All approvals obtained'),
      })

      // Note: _tag is inherited from BaseOperationalEvent when using .extend()
      expect(event).toBeInstanceOf(ApprovalCompleted)
      expect(event.finalStatus).toBe('approved')
      expect(event.totalLevelsCompleted).toBe(2)
    })

    it('Given rejected approval, When creating ApprovalCompleted, Then final status should be rejected', () => {
      const event = new ApprovalCompleted({
        ...makeBaseFields(),
        approvalRequestId: 'APREQ-001' as Schema.Schema.Type<typeof ApprovalRequestId>,
        finalStatus: 'rejected',
        totalLevelsRequired: 3 as Schema.Schema.Type<typeof ApprovalLevel>,
        totalLevelsCompleted: 1 as Schema.Schema.Type<typeof ApprovalLevel>,
        approvers: ['APPROVER-001'],
        totalDurationSeconds: 3600,
        notes: Option.some('Rejected at level 2'),
      })

      expect(event.finalStatus).toBe('rejected')
      expect(event.totalLevelsCompleted).toBe(1)
    })
  })
})

// =============================================================================
// Feature: ApprovalExpired Event
// =============================================================================

describe('Feature: ApprovalExpired Event', () => {
  const makeBaseFields = () => ({
    eventId: 'EVT-006' as EventId,
    occurredAt: DateTime.unsafeNow(),
    causedBy: 'system',
    entityId: 'WO-001' as AssetId,
    entityType: 'machine' as EquipmentLevel,
    correlationId: Option.none<string>(),
  })

  describe('Scenario: Approval request expiration', () => {
    it('Given expired request, When creating ApprovalExpired, Then expiration details should be tracked', () => {
      const event = new ApprovalExpired({
        ...makeBaseFields(),
        approvalRequestId: 'APREQ-001' as Schema.Schema.Type<typeof ApprovalRequestId>,
        expiredAt: DateTime.unsafeNow(),
        lastActiveLevel: 1 as Schema.Schema.Type<typeof ApprovalLevel>,
        pendingApprovers: ['APPROVER-001'],
        autoRenew: false,
        notes: Option.some('Request expired after 24 hours without action'),
      })

      // Note: _tag is inherited from BaseOperationalEvent when using .extend()
      expect(event).toBeInstanceOf(ApprovalExpired)
      expect(event.autoRenew).toBe(false)
      expect(event.pendingApprovers).toContain('APPROVER-001')
    })

    it('Given auto-renewable expiration, When creating ApprovalExpired, Then autoRenew should be true', () => {
      const event = new ApprovalExpired({
        ...makeBaseFields(),
        approvalRequestId: 'APREQ-001' as Schema.Schema.Type<typeof ApprovalRequestId>,
        expiredAt: DateTime.unsafeNow(),
        lastActiveLevel: 2 as Schema.Schema.Type<typeof ApprovalLevel>,
        pendingApprovers: [],
        autoRenew: true,
        notes: Option.some('Auto-renewal triggered'),
      })

      expect(event.autoRenew).toBe(true)
    })
  })
})

// =============================================================================
// Feature: Event Tags and Union Types
// =============================================================================

describe('Feature: Approval Event Tags', () => {
  describe('Scenario: All approval events have correct tags', () => {
    it('Given APPROVAL_EVENT_TAGS constant, When checking, Then it should contain all 6 event types', () => {
      expect(APPROVAL_EVENT_TAGS).toContain('ApprovalRequested')
      expect(APPROVAL_EVENT_TAGS).toContain('ApprovalGranted')
      expect(APPROVAL_EVENT_TAGS).toContain('ApprovalRejected')
      expect(APPROVAL_EVENT_TAGS).toContain('ApprovalEscalated')
      expect(APPROVAL_EVENT_TAGS).toContain('ApprovalCompleted')
      expect(APPROVAL_EVENT_TAGS).toContain('ApprovalExpired')
      expect(APPROVAL_EVENT_TAGS.length).toBe(6)
    })
  })
})
