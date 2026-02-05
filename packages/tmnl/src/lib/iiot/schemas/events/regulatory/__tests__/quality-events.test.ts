/**
 * Quality Events - Unit Tests
 *
 * TDD tests for ISO 9001 quality management events.
 *
 * Tests 5 events:
 * - InspectionCompleted
 * - NCROpened
 * - NCRClosed
 * - CAPACreated
 * - CAPAResolved
 *
 * These events support the ISO 9001 quality loop:
 * Inspection -> NCR (if failed) -> CAPA -> Resolution
 *
 * @module @gbg/tmnl/iiot/schemas/events/regulatory/__tests__/quality-events
 * @see EL-5.6-9 for quality event requirements
 * @see ISO 9001:2015 for quality management systems
 */

import { describe, it, expect } from 'vitest'
import { Schema, DateTime, Option, Either } from 'effect'

// =============================================================================
// Import Quality Events (will fail until implementation exists)
// =============================================================================

import {
  // Branded IDs
  InspectionId,
  NCRId,
  CAPAId,
  // Enums/Literals
  InspectionResult,
  NCRSeverity,
  CAPAType,
  EffectivenessRating,
  // Events
  InspectionCompleted,
  NCROpened,
  NCRClosed,
  CAPACreated,
  CAPAResolved,
  // Tags
  QUALITY_EVENT_TAGS,
  type QualityEvent,
  type QualityEventTag,
} from '../quality-events'

import type { AssetId, EventId } from '../../../identifiers'

// =============================================================================
// Test Helpers
// =============================================================================

const makeEventId = (): EventId =>
  `EVT-${Date.now()}-${Math.random().toString(36).slice(2)}` as EventId

const mockInspectionId = 'INS-2026-00001' as InspectionId
const mockNCRId = 'NCR-2026-00001' as NCRId
const mockCAPAId = 'CAPA-2026-00001' as CAPAId
const mockAssetId = 'AST-quality-001' as AssetId
const nowUtc = () => DateTime.unsafeNow()

/** Base operational event fields needed for all event constructors */
const baseEventFields = () => ({
  eventId: makeEventId(),
  occurredAt: nowUtc(),
  correlationId: Option.none() as Option.Option<string>,
})

// =============================================================================
// Feature: Quality Event Schemas (EL-5.6-9)
// =============================================================================

describe('Feature: Quality Events (EL-5.6-9)', () => {
  // ===========================================================================
  // InspectionCompleted
  // ===========================================================================

  describe('Scenario: InspectionCompleted event', () => {
    it('Given an inspection, When completed with pass, Then InspectionCompleted event should be valid', () => {
      const event = new InspectionCompleted({
        ...baseEventFields(),
        causedBy: 'inspector-123',
        entityId: mockAssetId,
        entityType: 'machine',
        inspectionId: mockInspectionId,
        inspectorId: 'inspector-123',
        itemId: 'ITEM-001',
        result: 'pass',
        criteria: ['visual_check', 'dimension_check'],
        measurements: Option.some({
          length: { value: 100.5, unit: 'mm', tolerance: 0.1 },
          width: { value: 50.2, unit: 'mm', tolerance: 0.05 },
        }),
      })

      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.inspectionId).toBe(mockInspectionId)
      expect(event.result).toBe('pass')
      expect(event.criteria).toContain('visual_check')
    })

    it('Given an inspection, When completed with conditional pass, Then event should include conditions', () => {
      const event = new InspectionCompleted({
        ...baseEventFields(),
        causedBy: 'inspector-123',
        entityId: mockAssetId,
        entityType: 'machine',
        inspectionId: mockInspectionId,
        inspectorId: 'inspector-123',
        itemId: 'ITEM-002',
        result: 'conditional',
        criteria: ['functional_test'],
        measurements: Option.none(),
      })

      expect(event.result).toBe('conditional')
    })

    it('should round-trip encode/decode InspectionCompleted', () => {
      const event = new InspectionCompleted({
        ...baseEventFields(),
        causedBy: 'inspector-123',
        entityId: mockAssetId,
        entityType: 'machine',
        inspectionId: mockInspectionId,
        inspectorId: 'inspector-123',
        itemId: 'ITEM-001',
        result: 'fail',
        criteria: ['visual_check'],
        measurements: Option.none(),
      })

      const encoded = Schema.encodeSync(InspectionCompleted)(event)
      const decoded = Schema.decodeSync(InspectionCompleted)(encoded)

      expect(decoded.inspectionId).toBe(event.inspectionId)
      expect(decoded.result).toBe(event.result)
      expect(decoded.itemId).toBe(event.itemId)
    })
  })

  // ===========================================================================
  // NCROpened
  // ===========================================================================

  describe('Scenario: NCROpened event', () => {
    it('Given a non-conformance, When NCR opened, Then NCROpened event should be valid', () => {
      const detectedAt = nowUtc()
      const event = new NCROpened({
        ...baseEventFields(),
        causedBy: 'quality-engineer-123',
        entityId: mockAssetId,
        entityType: 'machine',
        ncrId: mockNCRId,
        title: 'Out of tolerance dimension',
        description: 'Part dimension exceeds tolerance by 0.2mm',
        severity: 'major',
        affectedItems: ['ITEM-001', 'ITEM-002', 'ITEM-003'],
        detectedBy: 'inspector-123',
        detectedAt,
      })

      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.ncrId).toBe(mockNCRId)
      expect(event.severity).toBe('major')
      expect(event.affectedItems).toHaveLength(3)
    })

    it('should accept all valid NCR severities', () => {
      const severities = ['minor', 'major', 'critical'] as const

      severities.forEach((severity) => {
        const event = new NCROpened({
          ...baseEventFields(),
          causedBy: 'quality-engineer-123',
          entityId: mockAssetId,
          entityType: 'machine',
          ncrId: mockNCRId,
          title: 'Test NCR',
          description: 'Test description',
          severity,
          affectedItems: ['ITEM-001'],
          detectedBy: 'inspector-123',
          detectedAt: nowUtc(),
        })

        expect(event.severity).toBe(severity)
      })
    })

    it('should round-trip encode/decode NCROpened', () => {
      const event = new NCROpened({
        ...baseEventFields(),
        causedBy: 'quality-engineer-123',
        entityId: mockAssetId,
        entityType: 'machine',
        ncrId: mockNCRId,
        title: 'Defective weld',
        description: 'Weld porosity detected in joint',
        severity: 'critical',
        affectedItems: ['WELD-001'],
        detectedBy: 'inspector-123',
        detectedAt: nowUtc(),
      })

      const encoded = Schema.encodeSync(NCROpened)(event)
      const decoded = Schema.decodeSync(NCROpened)(encoded)

      expect(decoded.ncrId).toBe(event.ncrId)
      expect(decoded.severity).toBe(event.severity)
      expect(decoded.title).toBe(event.title)
    })
  })

  // ===========================================================================
  // NCRClosed
  // ===========================================================================

  describe('Scenario: NCRClosed event', () => {
    it('Given an open NCR, When closed with resolution, Then NCRClosed event should be valid', () => {
      const closedAt = nowUtc()
      const event = new NCRClosed({
        ...baseEventFields(),
        causedBy: 'quality-manager-123',
        entityId: mockAssetId,
        entityType: 'machine',
        ncrId: mockNCRId,
        closedBy: 'quality-manager-123',
        resolution: 'Parts reworked and re-inspected successfully',
        rootCause: 'Tool wear caused dimension drift',
        closedAt,
        linkedCAPAId: Option.some(mockCAPAId),
      })

      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.ncrId).toBe(mockNCRId)
      expect(event.resolution).toBe('Parts reworked and re-inspected successfully')
      expect(Option.isSome(event.linkedCAPAId)).toBe(true)
    })

    it('Given an NCR, When closed without CAPA, Then linkedCAPAId should be none', () => {
      const event = new NCRClosed({
        ...baseEventFields(),
        causedBy: 'quality-manager-123',
        entityId: mockAssetId,
        entityType: 'machine',
        ncrId: mockNCRId,
        closedBy: 'quality-manager-123',
        resolution: 'Use as-is approved by engineering',
        rootCause: 'Design tolerance too tight for process capability',
        closedAt: nowUtc(),
        linkedCAPAId: Option.none(),
      })

      expect(Option.isNone(event.linkedCAPAId)).toBe(true)
    })

    it('should round-trip encode/decode NCRClosed', () => {
      const event = new NCRClosed({
        ...baseEventFields(),
        causedBy: 'quality-manager-123',
        entityId: mockAssetId,
        entityType: 'machine',
        ncrId: mockNCRId,
        closedBy: 'quality-manager-123',
        resolution: 'Scrap and replace',
        rootCause: 'Material defect',
        closedAt: nowUtc(),
        linkedCAPAId: Option.none(),
      })

      const encoded = Schema.encodeSync(NCRClosed)(event)
      const decoded = Schema.decodeSync(NCRClosed)(encoded)

      expect(decoded.ncrId).toBe(event.ncrId)
      expect(decoded.resolution).toBe(event.resolution)
      expect(decoded.rootCause).toBe(event.rootCause)
    })
  })

  // ===========================================================================
  // CAPACreated
  // ===========================================================================

  describe('Scenario: CAPACreated event', () => {
    it('Given NCRs requiring action, When CAPA created, Then CAPACreated event should be valid', () => {
      const dueDate = nowUtc()
      const event = new CAPACreated({
        ...baseEventFields(),
        causedBy: 'quality-manager-123',
        entityId: mockAssetId,
        entityType: 'machine',
        capaId: mockCAPAId,
        type: 'corrective',
        title: 'Implement tool wear monitoring',
        description: 'Add automated tool wear detection to prevent dimension drift',
        linkedNCRIds: [mockNCRId, 'NCR-2026-00002' as NCRId],
        assignedTo: 'maintenance-team',
        dueDate,
      })

      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.capaId).toBe(mockCAPAId)
      expect(event.type).toBe('corrective')
      expect(event.linkedNCRIds).toHaveLength(2)
    })

    it('should accept both corrective and preventive CAPA types', () => {
      const types = ['corrective', 'preventive'] as const

      types.forEach((type) => {
        const event = new CAPACreated({
          ...baseEventFields(),
          causedBy: 'quality-manager-123',
          entityId: mockAssetId,
          entityType: 'machine',
          capaId: mockCAPAId,
          type,
          title: `${type} action`,
          description: 'Test CAPA',
          linkedNCRIds: [mockNCRId],
          assignedTo: 'team-quality',
          dueDate: nowUtc(),
        })

        expect(event.type).toBe(type)
      })
    })

    it('should round-trip encode/decode CAPACreated', () => {
      const event = new CAPACreated({
        ...baseEventFields(),
        causedBy: 'quality-manager-123',
        entityId: mockAssetId,
        entityType: 'machine',
        capaId: mockCAPAId,
        type: 'preventive',
        title: 'Add SPC monitoring',
        description: 'Implement statistical process control',
        linkedNCRIds: [mockNCRId],
        assignedTo: 'process-engineering',
        dueDate: nowUtc(),
      })

      const encoded = Schema.encodeSync(CAPACreated)(event)
      const decoded = Schema.decodeSync(CAPACreated)(encoded)

      expect(decoded.capaId).toBe(event.capaId)
      expect(decoded.type).toBe(event.type)
      expect(decoded.title).toBe(event.title)
    })
  })

  // ===========================================================================
  // CAPAResolved
  // ===========================================================================

  describe('Scenario: CAPAResolved event', () => {
    it('Given an open CAPA, When resolved and verified, Then CAPAResolved event should be valid', () => {
      const resolvedAt = nowUtc()
      const event = new CAPAResolved({
        ...baseEventFields(),
        causedBy: 'quality-manager-123',
        entityId: mockAssetId,
        entityType: 'machine',
        capaId: mockCAPAId,
        resolvedBy: 'maintenance-lead-123',
        resolution: 'Tool wear monitoring system installed and calibrated',
        verificationMethod: 'Monitored 100 parts with zero tolerance exceedances',
        effectivenessRating: 'effective',
        resolvedAt,
      })

      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.capaId).toBe(mockCAPAId)
      expect(event.effectivenessRating).toBe('effective')
      expect(event.resolution).toContain('monitoring system')
    })

    it('should accept all valid effectiveness ratings', () => {
      const ratings = ['effective', 'partially_effective', 'ineffective'] as const

      ratings.forEach((rating) => {
        const event = new CAPAResolved({
          ...baseEventFields(),
          causedBy: 'quality-manager-123',
          entityId: mockAssetId,
          entityType: 'machine',
          capaId: mockCAPAId,
          resolvedBy: 'engineer-123',
          resolution: 'Action completed',
          verificationMethod: 'Verification performed',
          effectivenessRating: rating,
          resolvedAt: nowUtc(),
        })

        expect(event.effectivenessRating).toBe(rating)
      })
    })

    it('should round-trip encode/decode CAPAResolved', () => {
      const event = new CAPAResolved({
        ...baseEventFields(),
        causedBy: 'quality-manager-123',
        entityId: mockAssetId,
        entityType: 'machine',
        capaId: mockCAPAId,
        resolvedBy: 'engineer-123',
        resolution: 'SPC monitoring implemented',
        verificationMethod: 'Cpk verified above 1.33 for 30 days',
        effectivenessRating: 'effective',
        resolvedAt: nowUtc(),
      })

      const encoded = Schema.encodeSync(CAPAResolved)(event)
      const decoded = Schema.decodeSync(CAPAResolved)(encoded)

      expect(decoded.capaId).toBe(event.capaId)
      expect(decoded.effectivenessRating).toBe(event.effectivenessRating)
      expect(decoded.resolution).toBe(event.resolution)
    })
  })

  // ===========================================================================
  // Event Tags & Union Type
  // ===========================================================================

  describe('Scenario: Event tag constants', () => {
    it('Given QUALITY_EVENT_TAGS, Then all 5 events should be listed', () => {
      expect(QUALITY_EVENT_TAGS).toHaveLength(5)
      expect(QUALITY_EVENT_TAGS).toContain('InspectionCompleted')
      expect(QUALITY_EVENT_TAGS).toContain('NCROpened')
      expect(QUALITY_EVENT_TAGS).toContain('NCRClosed')
      expect(QUALITY_EVENT_TAGS).toContain('CAPACreated')
      expect(QUALITY_EVENT_TAGS).toContain('CAPAResolved')
    })
  })

  // ===========================================================================
  // NCR-CAPA Linking Pattern
  // ===========================================================================

  describe('Scenario: NCR-CAPA linking', () => {
    it('Given multiple NCRs, When CAPA created, Then linkedNCRIds should contain all', () => {
      const ncrIds = [
        'NCR-2026-00001' as NCRId,
        'NCR-2026-00002' as NCRId,
        'NCR-2026-00003' as NCRId,
      ]

      const event = new CAPACreated({
        ...baseEventFields(),
        causedBy: 'quality-manager-123',
        entityId: mockAssetId,
        entityType: 'machine',
        capaId: mockCAPAId,
        type: 'corrective',
        title: 'Address recurring quality issue',
        description: 'Multiple NCRs with same root cause',
        linkedNCRIds: ncrIds,
        assignedTo: 'team-quality',
        dueDate: nowUtc(),
      })

      expect(event.linkedNCRIds).toEqual(ncrIds)
      expect(event.linkedNCRIds).toHaveLength(3)
    })

    it('Given NCR closed with CAPA, When verified, Then link is maintained', () => {
      // NCR references CAPA
      const ncrClosed = new NCRClosed({
        ...baseEventFields(),
        causedBy: 'quality-manager-123',
        entityId: mockAssetId,
        entityType: 'machine',
        ncrId: mockNCRId,
        closedBy: 'quality-manager-123',
        resolution: 'CAPA implemented',
        rootCause: 'Process issue',
        closedAt: nowUtc(),
        linkedCAPAId: Option.some(mockCAPAId),
      })

      expect(Option.getOrNull(ncrClosed.linkedCAPAId)).toBe(mockCAPAId)
    })
  })

  // ===========================================================================
  // Schema Validation
  // ===========================================================================

  describe('Scenario: Schema validation', () => {
    it('should have all required fields for EventGroup integration', () => {
      const event = new InspectionCompleted({
        ...baseEventFields(),
        causedBy: 'inspector-123',
        entityId: mockAssetId,
        entityType: 'machine',
        inspectionId: mockInspectionId,
        inspectorId: 'inspector-123',
        itemId: 'ITEM-001',
        result: 'pass',
        criteria: ['check-1'],
        measurements: Option.none(),
      })

      // EventGroup requires these base fields
      expect(event).toHaveProperty('eventId')
      expect(event).toHaveProperty('occurredAt')
      expect(event).toHaveProperty('causedBy')
      expect(event).toHaveProperty('entityId')
      expect(event).toHaveProperty('entityType')

      // Quality events require their specific IDs
      expect(event).toHaveProperty('inspectionId')
    })
  })
})
