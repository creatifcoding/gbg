/**
 * Operator Events - Unit Tests
 *
 * TDD tests for operator audit trail events per EL-5.10-13.
 * These events support regulatory compliance (FDA 21 CFR Part 11).
 *
 * Tests 5 events:
 * - OperatorLogin
 * - OperatorLogout
 * - ParameterOverride
 * - ManualAcknowledgment
 * - ShiftHandoff
 *
 * @module @gbg/tmnl/iiot/schemas/events/regulatory/__tests__/operator-events
 * @see EL-5.10-13 for operator event requirements
 * @see FDA 21 CFR Part 11 for electronic records compliance
 */

import { describe, it, expect } from 'vitest'
import { Schema, DateTime, Option, Either } from 'effect'

// =============================================================================
// Import Operator Events (will fail until implemented)
// =============================================================================

import {
  // Branded IDs
  SessionId,
  OverrideId,
  AcknowledgmentId,
  HandoffId,
  // Enums
  AuthMethod,
  LogoutReason,
  AcknowledgmentTargetType,
  // Events
  OperatorLogin,
  OperatorLogout,
  ParameterOverride,
  ManualAcknowledgment,
  ShiftHandoff,
  // Tags
  OPERATOR_EVENT_TAGS,
  type OperatorEvent,
  type OperatorEventTag,
} from '../operator-events'

import type { AssetId, EventId } from '../../../../identifiers'

// =============================================================================
// Test Helpers
// =============================================================================

const makeEventId = (): EventId =>
  `EVT-${Date.now()}-${Math.random().toString(36).slice(2)}` as EventId

const mockAssetId = 'AST-operator-test-001' as AssetId
const mockSessionId = 'SESS-2026-00001' as SessionId
const mockOverrideId = 'OVR-2026-00001' as OverrideId
const mockAckId = 'ACK-2026-00001' as AcknowledgmentId
const mockHandoffId = 'HOFF-2026-00001' as HandoffId
const nowUtc = () => DateTime.unsafeNow()

/** Base operational event fields needed for all event constructors */
const baseEventFields = () => ({
  eventId: makeEventId(),
  occurredAt: nowUtc(),
  correlationId: Option.none() as Option.Option<string>,
})

// =============================================================================
// Feature: Operator Audit Trail Events (EL-5.10-13)
// =============================================================================

describe('Feature: Operator Events (EL-5.10-13)', () => {
  // ===========================================================================
  // OperatorLogin Event
  // ===========================================================================

  describe('Scenario: OperatorLogin event', () => {
    it('Given an operator authenticating, When they login, Then OperatorLogin event should be valid', () => {
      const event = new OperatorLogin({
        ...baseEventFields(),
        causedBy: 'system',
        entityId: mockAssetId,
        entityType: 'workcell',
        sessionId: mockSessionId,
        operatorId: 'operator-123',
        workstation: 'WS-LINE1-01',
        loginAt: nowUtc(),
        authMethod: 'badge',
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.sessionId).toBe(mockSessionId)
      expect(event.operatorId).toBe('operator-123')
      expect(event.workstation).toBe('WS-LINE1-01')
      expect(event.authMethod).toBe('badge')
    })

    it('should accept all valid auth methods', () => {
      const authMethods = ['badge', 'password', 'biometric'] as const

      authMethods.forEach((method) => {
        const event = new OperatorLogin({
          ...baseEventFields(),
          causedBy: 'system',
          entityId: mockAssetId,
          entityType: 'workcell',
          sessionId: mockSessionId,
          operatorId: 'operator-123',
          workstation: 'WS-LINE1-01',
          loginAt: nowUtc(),
          authMethod: method,
        })

        expect(event.authMethod).toBe(method)
      })
    })

    it('should round-trip encode/decode correctly', () => {
      const event = new OperatorLogin({
        ...baseEventFields(),
        causedBy: 'system',
        entityId: mockAssetId,
        entityType: 'workcell',
        sessionId: mockSessionId,
        operatorId: 'operator-123',
        workstation: 'WS-LINE1-01',
        loginAt: nowUtc(),
        authMethod: 'biometric',
      })

      const encoded = Schema.encodeSync(OperatorLogin)(event)
      const decoded = Schema.decodeSync(OperatorLogin)(encoded)

      expect(decoded.sessionId).toBe(event.sessionId)
      expect(decoded.operatorId).toBe(event.operatorId)
      expect(decoded.authMethod).toBe('biometric')
    })
  })

  // ===========================================================================
  // OperatorLogout Event
  // ===========================================================================

  describe('Scenario: OperatorLogout event', () => {
    it('Given a logged-in operator, When they logout, Then OperatorLogout event should be valid', () => {
      const event = new OperatorLogout({
        ...baseEventFields(),
        causedBy: 'operator-123',
        entityId: mockAssetId,
        entityType: 'workcell',
        sessionId: mockSessionId,
        operatorId: 'operator-123',
        logoutAt: nowUtc(),
        reason: 'manual',
      })

      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.sessionId).toBe(mockSessionId)
      expect(event.operatorId).toBe('operator-123')
      expect(event.reason).toBe('manual')
    })

    it('should accept all valid logout reasons', () => {
      const reasons = ['manual', 'timeout', 'forced'] as const

      reasons.forEach((reason) => {
        const event = new OperatorLogout({
          ...baseEventFields(),
          causedBy: 'operator-123',
          entityId: mockAssetId,
          entityType: 'workcell',
          sessionId: mockSessionId,
          operatorId: 'operator-123',
          logoutAt: nowUtc(),
          reason,
        })

        expect(event.reason).toBe(reason)
      })
    })

    it('should round-trip encode/decode correctly', () => {
      const event = new OperatorLogout({
        ...baseEventFields(),
        causedBy: 'system',
        entityId: mockAssetId,
        entityType: 'workcell',
        sessionId: mockSessionId,
        operatorId: 'operator-123',
        logoutAt: nowUtc(),
        reason: 'timeout',
      })

      const encoded = Schema.encodeSync(OperatorLogout)(event)
      const decoded = Schema.decodeSync(OperatorLogout)(encoded)

      expect(decoded.sessionId).toBe(event.sessionId)
      expect(decoded.reason).toBe('timeout')
    })
  })

  // ===========================================================================
  // ParameterOverride Event
  // ===========================================================================

  describe('Scenario: ParameterOverride event', () => {
    it('Given a parameter requiring override, When operator overrides it, Then ParameterOverride event should be valid', () => {
      const event = new ParameterOverride({
        ...baseEventFields(),
        causedBy: 'operator-123',
        entityId: mockAssetId,
        entityType: 'machine',
        overrideId: mockOverrideId,
        operatorId: 'operator-123',
        parameterId: 'PARAM-temp-setpoint',
        previousValue: '150',
        newValue: '155',
        reason: 'Process optimization per SOP-2026-001',
        approvedBy: Option.none(),
      })

      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.overrideId).toBe(mockOverrideId)
      expect(event.operatorId).toBe('operator-123')
      expect(event.parameterId).toBe('PARAM-temp-setpoint')
      expect(event.previousValue).toBe('150')
      expect(event.newValue).toBe('155')
    })

    it('should capture approval when present', () => {
      const event = new ParameterOverride({
        ...baseEventFields(),
        causedBy: 'operator-123',
        entityId: mockAssetId,
        entityType: 'machine',
        overrideId: mockOverrideId,
        operatorId: 'operator-123',
        parameterId: 'PARAM-pressure-limit',
        previousValue: '100',
        newValue: '120',
        reason: 'Emergency pressure adjustment',
        approvedBy: Option.some('supervisor-456'),
      })

      expect(Option.isSome(event.approvedBy)).toBe(true)
      expect(Option.getOrNull(event.approvedBy)).toBe('supervisor-456')
    })

    it('should round-trip encode/decode correctly', () => {
      const event = new ParameterOverride({
        ...baseEventFields(),
        causedBy: 'operator-123',
        entityId: mockAssetId,
        entityType: 'machine',
        overrideId: mockOverrideId,
        operatorId: 'operator-123',
        parameterId: 'PARAM-speed',
        previousValue: '1000',
        newValue: '1200',
        reason: 'Test run adjustment',
        approvedBy: Option.some('lead-789'),
      })

      const encoded = Schema.encodeSync(ParameterOverride)(event)
      const decoded = Schema.decodeSync(ParameterOverride)(encoded)

      expect(decoded.overrideId).toBe(event.overrideId)
      expect(decoded.previousValue).toBe('1000')
      expect(decoded.newValue).toBe('1200')
    })
  })

  // ===========================================================================
  // ManualAcknowledgment Event
  // ===========================================================================

  describe('Scenario: ManualAcknowledgment event', () => {
    it('Given an alarm requiring acknowledgment, When operator acknowledges it, Then ManualAcknowledgment event should be valid', () => {
      const event = new ManualAcknowledgment({
        ...baseEventFields(),
        causedBy: 'operator-123',
        entityId: mockAssetId,
        entityType: 'machine',
        acknowledgmentId: mockAckId,
        operatorId: 'operator-123',
        targetType: 'alarm',
        targetId: 'ALM-temp-high-001',
        comment: Option.some('Acknowledged high temp alarm - within tolerance'),
      })

      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.acknowledgmentId).toBe(mockAckId)
      expect(event.operatorId).toBe('operator-123')
      expect(event.targetType).toBe('alarm')
      expect(event.targetId).toBe('ALM-temp-high-001')
    })

    it('should accept all valid target types', () => {
      const targetTypes = ['alarm', 'deviation', 'message'] as const

      targetTypes.forEach((targetType) => {
        const event = new ManualAcknowledgment({
          ...baseEventFields(),
          causedBy: 'operator-123',
          entityId: mockAssetId,
          entityType: 'machine',
          acknowledgmentId: mockAckId,
          operatorId: 'operator-123',
          targetType,
          targetId: `TARGET-${targetType}-001`,
          comment: Option.none(),
        })

        expect(event.targetType).toBe(targetType)
      })
    })

    it('should round-trip encode/decode correctly', () => {
      const event = new ManualAcknowledgment({
        ...baseEventFields(),
        causedBy: 'operator-123',
        entityId: mockAssetId,
        entityType: 'machine',
        acknowledgmentId: mockAckId,
        operatorId: 'operator-123',
        targetType: 'deviation',
        targetId: 'DEV-quality-001',
        comment: Option.some('Deviation noted and corrective action initiated'),
      })

      const encoded = Schema.encodeSync(ManualAcknowledgment)(event)
      const decoded = Schema.decodeSync(ManualAcknowledgment)(encoded)

      expect(decoded.acknowledgmentId).toBe(event.acknowledgmentId)
      expect(decoded.targetType).toBe('deviation')
      expect(Option.isSome(decoded.comment)).toBe(true)
    })
  })

  // ===========================================================================
  // ShiftHandoff Event
  // ===========================================================================

  describe('Scenario: ShiftHandoff event', () => {
    it('Given operators changing shifts, When handoff occurs, Then ShiftHandoff event should be valid', () => {
      const event = new ShiftHandoff({
        ...baseEventFields(),
        causedBy: 'operator-outgoing',
        entityId: mockAssetId,
        entityType: 'workcell',
        handoffId: mockHandoffId,
        outgoingOperatorId: 'operator-outgoing',
        incomingOperatorId: 'operator-incoming',
        handoffAt: nowUtc(),
        notes: Option.some('Line running stable. WO-2026-00005 in progress.'),
        openItems: Schema.decodeSync(Schema.Array(Schema.String))([
          'WO-2026-00005: 75% complete',
          'Pending parts delivery for WO-2026-00006',
          'Temperature sensor calibration due tomorrow',
        ]),
      })

      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.handoffId).toBe(mockHandoffId)
      expect(event.outgoingOperatorId).toBe('operator-outgoing')
      expect(event.incomingOperatorId).toBe('operator-incoming')
      expect(event.openItems).toHaveLength(3)
    })

    it('should allow empty open items array', () => {
      const event = new ShiftHandoff({
        ...baseEventFields(),
        causedBy: 'operator-outgoing',
        entityId: mockAssetId,
        entityType: 'workcell',
        handoffId: mockHandoffId,
        outgoingOperatorId: 'operator-outgoing',
        incomingOperatorId: 'operator-incoming',
        handoffAt: nowUtc(),
        notes: Option.none(),
        openItems: [],
      })

      expect(event.openItems).toHaveLength(0)
      expect(Option.isNone(event.notes)).toBe(true)
    })

    it('should round-trip encode/decode correctly', () => {
      const event = new ShiftHandoff({
        ...baseEventFields(),
        causedBy: 'operator-outgoing',
        entityId: mockAssetId,
        entityType: 'workcell',
        handoffId: mockHandoffId,
        outgoingOperatorId: 'operator-A',
        incomingOperatorId: 'operator-B',
        handoffAt: nowUtc(),
        notes: Option.some('Quiet shift'),
        openItems: ['Item 1', 'Item 2'],
      })

      const encoded = Schema.encodeSync(ShiftHandoff)(event)
      const decoded = Schema.decodeSync(ShiftHandoff)(encoded)

      expect(decoded.handoffId).toBe(event.handoffId)
      expect(decoded.outgoingOperatorId).toBe('operator-A')
      expect(decoded.incomingOperatorId).toBe('operator-B')
      expect(decoded.openItems).toEqual(['Item 1', 'Item 2'])
    })
  })

  // ===========================================================================
  // Event Tag Constants
  // ===========================================================================

  describe('Scenario: Event tag constants', () => {
    it('Given OPERATOR_EVENT_TAGS, Then all 5 events should be listed', () => {
      expect(OPERATOR_EVENT_TAGS).toHaveLength(5)
      expect(OPERATOR_EVENT_TAGS).toContain('OperatorLogin')
      expect(OPERATOR_EVENT_TAGS).toContain('OperatorLogout')
      expect(OPERATOR_EVENT_TAGS).toContain('ParameterOverride')
      expect(OPERATOR_EVENT_TAGS).toContain('ManualAcknowledgment')
      expect(OPERATOR_EVENT_TAGS).toContain('ShiftHandoff')
    })
  })

  // ===========================================================================
  // Branded ID Validation
  // ===========================================================================

  describe('Scenario: Branded ID types', () => {
    it('SessionId should be a branded string', () => {
      const result = Schema.decodeEither(SessionId)('SESS-001')
      expect(Either.isRight(result)).toBe(true)
    })

    it('OverrideId should be a branded string', () => {
      const result = Schema.decodeEither(OverrideId)('OVR-001')
      expect(Either.isRight(result)).toBe(true)
    })

    it('AcknowledgmentId should be a branded string', () => {
      const result = Schema.decodeEither(AcknowledgmentId)('ACK-001')
      expect(Either.isRight(result)).toBe(true)
    })

    it('HandoffId should be a branded string', () => {
      const result = Schema.decodeEither(HandoffId)('HOFF-001')
      expect(Either.isRight(result)).toBe(true)
    })
  })

  // ===========================================================================
  // EventGroup Integration Fields
  // ===========================================================================

  describe('Scenario: EventGroup integration', () => {
    it('All events should have required base fields for EventGroup', () => {
      const events = [
        new OperatorLogin({
          ...baseEventFields(),
          causedBy: 'system',
          entityId: mockAssetId,
          entityType: 'workcell',
          sessionId: mockSessionId,
          operatorId: 'op-1',
          workstation: 'WS-1',
          loginAt: nowUtc(),
          authMethod: 'badge',
        }),
        new OperatorLogout({
          ...baseEventFields(),
          causedBy: 'op-1',
          entityId: mockAssetId,
          entityType: 'workcell',
          sessionId: mockSessionId,
          operatorId: 'op-1',
          logoutAt: nowUtc(),
          reason: 'manual',
        }),
        new ParameterOverride({
          ...baseEventFields(),
          causedBy: 'op-1',
          entityId: mockAssetId,
          entityType: 'machine',
          overrideId: mockOverrideId,
          operatorId: 'op-1',
          parameterId: 'P-1',
          previousValue: '1',
          newValue: '2',
          reason: 'Test',
          approvedBy: Option.none(),
        }),
        new ManualAcknowledgment({
          ...baseEventFields(),
          causedBy: 'op-1',
          entityId: mockAssetId,
          entityType: 'machine',
          acknowledgmentId: mockAckId,
          operatorId: 'op-1',
          targetType: 'alarm',
          targetId: 'A-1',
          comment: Option.none(),
        }),
        new ShiftHandoff({
          ...baseEventFields(),
          causedBy: 'op-1',
          entityId: mockAssetId,
          entityType: 'workcell',
          handoffId: mockHandoffId,
          outgoingOperatorId: 'op-1',
          incomingOperatorId: 'op-2',
          handoffAt: nowUtc(),
          notes: Option.none(),
          openItems: [],
        }),
      ]

      events.forEach((event) => {
        expect(event).toHaveProperty('eventId')
        expect(event).toHaveProperty('occurredAt')
        expect(event).toHaveProperty('causedBy')
        expect(event).toHaveProperty('entityId')
        expect(event).toHaveProperty('entityType')
      })
    })
  })
})
