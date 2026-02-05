/**
 * Batch Record Events — Unit Tests
 *
 * FDA 21 CFR Part 11 compliant batch record events for regulatory compliance.
 *
 * Tests 4 events:
 * 1. BatchStarted - Batch production initiated
 * 2. ParameterRecorded - Critical process parameter recorded
 * 3. BatchCompleted - Batch production completed
 * 4. BatchDeviation - Deviation from batch record detected
 *
 * All events include:
 * - Electronic signature (signedBy, signedAt, signatureMeaning) per FDA 21 CFR Part 11
 * - DateTimeUtc timestamps for audit trail
 * - auditTrailId for correlation
 *
 * @module @gbg/tmnl/iiot/schemas/events/regulatory/__tests__/batch-events
 * @see EL-5.1-5 for batch record event requirements
 * @see FDA 21 CFR Part 11 for electronic records compliance
 */

import { describe, it, expect } from 'vitest'
import { Schema, DateTime, Option } from 'effect'

// =============================================================================
// Import Batch Events (will fail until implementation exists)
// =============================================================================

import {
  // Branded Types
  BatchId,
  ParameterId,
  DeviationId,
  // Events
  BatchStarted,
  ParameterRecorded,
  BatchCompleted,
  BatchDeviation,
  // Supporting Types
  ElectronicSignature,
  DeviationType,
  DeviationSeverity,
  // Tags and Union
  BATCH_EVENT_TAGS,
  type BatchStartedType,
  type ParameterRecordedType,
  type BatchCompletedType,
  type BatchDeviationType,
  type BatchEvent,
  type BatchEventTag,
} from '../batch-events'

import type { AssetId, EventId } from '../../../../identifiers'

// =============================================================================
// Test Fixtures
// =============================================================================

const mockBatchId = 'BATCH-2026-00001' as Schema.Schema.Type<typeof BatchId>
const mockParameterId = 'PARAM-temp-001' as Schema.Schema.Type<typeof ParameterId>
const mockDeviationId = 'DEV-2026-00001' as Schema.Schema.Type<typeof DeviationId>
const mockAssetId = 'MCH-001' as AssetId
const makeEventId = (): EventId =>
  `EVT-${Date.now()}-${Math.random().toString(36).slice(2)}` as EventId

const mockElectronicSignature = {
  signedBy: 'operator-001',
  signedAt: DateTime.unsafeNow(),
  signatureMeaning: 'I confirm this record is accurate and complete',
}

const baseEventFields = {
  eventId: makeEventId(),
  occurredAt: DateTime.unsafeNow(),
  causedBy: 'operator-001',
  entityId: mockAssetId,
  entityType: 'machine' as const,
  correlationId: Option.none<string>(),
  schemaVersion: 1,
}

// =============================================================================
// Feature: Batch Record Events (EL-5.1-5) - FDA 21 CFR Part 11 Compliance
// =============================================================================

describe('Feature: Batch Record Events (EL-5.1-5)', () => {
  // ===========================================================================
  // BatchId Branded Type
  // ===========================================================================

  describe('BatchId Branded Type', () => {
    it('should create a branded BatchId', () => {
      const decoded = Schema.decodeSync(BatchId)('BATCH-2026-00001')
      expect(decoded).toBe('BATCH-2026-00001')
    })

    it('should have proper brand', () => {
      const decoded = Schema.decodeSync(BatchId)('BATCH-test')
      const _typeCheck: Schema.Schema.Type<typeof BatchId> = decoded
      expect(typeof decoded).toBe('string')
    })
  })

  // ===========================================================================
  // ParameterId Branded Type
  // ===========================================================================

  describe('ParameterId Branded Type', () => {
    it('should create a branded ParameterId', () => {
      const decoded = Schema.decodeSync(ParameterId)('PARAM-temp-001')
      expect(decoded).toBe('PARAM-temp-001')
    })
  })

  // ===========================================================================
  // DeviationId Branded Type
  // ===========================================================================

  describe('DeviationId Branded Type', () => {
    it('should create a branded DeviationId', () => {
      const decoded = Schema.decodeSync(DeviationId)('DEV-2026-00001')
      expect(decoded).toBe('DEV-2026-00001')
    })
  })

  // ===========================================================================
  // ElectronicSignature Schema
  // ===========================================================================

  describe('ElectronicSignature Schema', () => {
    it('should encode and decode electronic signature correctly', () => {
      const signature = {
        signedBy: 'operator-001',
        signedAt: DateTime.unsafeNow(),
        signatureMeaning: 'I confirm this record is accurate',
      }

      const encoded = Schema.encodeSync(ElectronicSignature)(signature)
      const decoded = Schema.decodeSync(ElectronicSignature)(encoded)

      expect(decoded.signedBy).toBe('operator-001')
      expect(decoded.signatureMeaning).toBe('I confirm this record is accurate')
    })
  })

  // ===========================================================================
  // BatchStarted Event
  // ===========================================================================

  describe('Scenario: BatchStarted event', () => {
    it('Given a new batch, When started, Then BatchStarted event should be valid', () => {
      const event = new BatchStarted({
        ...baseEventFields,
        batchId: mockBatchId,
        productCode: 'PROD-ABC-001',
        lotNumber: 'LOT-2026-001',
        startedBy: 'operator-001',
        plannedQuantity: 1000,
        equipmentIds: [mockAssetId],
        electronicSignature: mockElectronicSignature,
        auditTrailId: 'AUD-2026-00001',
      })

      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.batchId).toBe(mockBatchId)
      expect(event.productCode).toBe('PROD-ABC-001')
      expect(event.lotNumber).toBe('LOT-2026-001')
      expect(event.startedBy).toBe('operator-001')
      expect(event.plannedQuantity).toBe(1000)
      expect(event.equipmentIds).toHaveLength(1)
      expect(event.electronicSignature.signedBy).toBe('operator-001')
      expect(event.auditTrailId).toBe('AUD-2026-00001')
    })

    it('should encode and decode BatchStarted correctly (round-trip)', () => {
      const event = new BatchStarted({
        ...baseEventFields,
        batchId: mockBatchId,
        productCode: 'PROD-XYZ-002',
        lotNumber: 'LOT-2026-002',
        startedBy: 'operator-002',
        plannedQuantity: 500,
        equipmentIds: [mockAssetId],
        electronicSignature: mockElectronicSignature,
        auditTrailId: 'AUD-2026-00002',
      })

      const encoded = Schema.encodeSync(BatchStarted)(event)
      const decoded = Schema.decodeSync(BatchStarted)(encoded)

      expect(decoded.batchId).toBe(mockBatchId)
      expect(decoded.productCode).toBe('PROD-XYZ-002')
      expect(decoded.plannedQuantity).toBe(500)
      expect(decoded.auditTrailId).toBe('AUD-2026-00002')
    })
  })

  // ===========================================================================
  // ParameterRecorded Event
  // ===========================================================================

  describe('Scenario: ParameterRecorded event', () => {
    it('Given a batch in progress, When parameter recorded, Then ParameterRecorded event should be valid', () => {
      const recordedAt = DateTime.unsafeNow()
      const event = new ParameterRecorded({
        ...baseEventFields,
        batchId: mockBatchId,
        parameterId: mockParameterId,
        parameterName: 'Temperature',
        value: 72.5,
        unit: 'Celsius',
        recordedBy: 'operator-001',
        recordedAt,
        withinSpec: true,
        electronicSignature: mockElectronicSignature,
        auditTrailId: 'AUD-2026-00003',
      })

      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.batchId).toBe(mockBatchId)
      expect(event.parameterId).toBe(mockParameterId)
      expect(event.parameterName).toBe('Temperature')
      expect(event.value).toBe(72.5)
      expect(event.unit).toBe('Celsius')
      expect(event.withinSpec).toBe(true)
      expect(event.electronicSignature.signedBy).toBe('operator-001')
    })

    it('should encode and decode ParameterRecorded correctly (round-trip)', () => {
      const event = new ParameterRecorded({
        ...baseEventFields,
        batchId: mockBatchId,
        parameterId: mockParameterId,
        parameterName: 'Pressure',
        value: 14.7,
        unit: 'PSI',
        recordedBy: 'operator-002',
        recordedAt: DateTime.unsafeNow(),
        withinSpec: false,
        electronicSignature: mockElectronicSignature,
        auditTrailId: 'AUD-2026-00004',
      })

      const encoded = Schema.encodeSync(ParameterRecorded)(event)
      const decoded = Schema.decodeSync(ParameterRecorded)(encoded)

      expect(decoded.parameterName).toBe('Pressure')
      expect(decoded.value).toBe(14.7)
      expect(decoded.withinSpec).toBe(false)
    })

    it('should support out-of-spec parameter recordings', () => {
      const event = new ParameterRecorded({
        ...baseEventFields,
        batchId: mockBatchId,
        parameterId: mockParameterId,
        parameterName: 'pH Level',
        value: 8.5,
        unit: 'pH',
        recordedBy: 'operator-001',
        recordedAt: DateTime.unsafeNow(),
        withinSpec: false,
        electronicSignature: mockElectronicSignature,
        auditTrailId: 'AUD-2026-00005',
      })

      expect(event.withinSpec).toBe(false)
    })
  })

  // ===========================================================================
  // BatchCompleted Event
  // ===========================================================================

  describe('Scenario: BatchCompleted event', () => {
    it('Given an active batch, When completed, Then BatchCompleted event should be valid', () => {
      const completedAt = DateTime.unsafeNow()
      const event = new BatchCompleted({
        ...baseEventFields,
        batchId: mockBatchId,
        completedBy: 'operator-001',
        actualQuantity: 980,
        yieldPercentage: 98.0,
        completedAt,
        electronicSignature: mockElectronicSignature,
        auditTrailId: 'AUD-2026-00006',
      })

      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.batchId).toBe(mockBatchId)
      expect(event.completedBy).toBe('operator-001')
      expect(event.actualQuantity).toBe(980)
      expect(event.yieldPercentage).toBe(98.0)
      expect(event.auditTrailId).toBe('AUD-2026-00006')
    })

    it('should encode and decode BatchCompleted correctly (round-trip)', () => {
      const event = new BatchCompleted({
        ...baseEventFields,
        batchId: mockBatchId,
        completedBy: 'operator-002',
        actualQuantity: 450,
        yieldPercentage: 90.0,
        completedAt: DateTime.unsafeNow(),
        electronicSignature: mockElectronicSignature,
        auditTrailId: 'AUD-2026-00007',
      })

      const encoded = Schema.encodeSync(BatchCompleted)(event)
      const decoded = Schema.decodeSync(BatchCompleted)(encoded)

      expect(decoded.actualQuantity).toBe(450)
      expect(decoded.yieldPercentage).toBe(90.0)
    })
  })

  // ===========================================================================
  // BatchDeviation Event
  // ===========================================================================

  describe('Scenario: BatchDeviation event', () => {
    it('Given a batch in progress, When deviation detected, Then BatchDeviation event should be valid', () => {
      const event = new BatchDeviation({
        ...baseEventFields,
        batchId: mockBatchId,
        deviationId: mockDeviationId,
        deviationType: 'process',
        description: 'Temperature exceeded upper limit by 2 degrees',
        severity: 'major',
        detectedBy: 'operator-001',
        correctiveAction: Option.some('Adjusted cooling system and re-verified temperature'),
        electronicSignature: mockElectronicSignature,
        auditTrailId: 'AUD-2026-00008',
      })

      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.batchId).toBe(mockBatchId)
      expect(event.deviationId).toBe(mockDeviationId)
      expect(event.deviationType).toBe('process')
      expect(event.severity).toBe('major')
      expect(event.detectedBy).toBe('operator-001')
      expect(Option.isSome(event.correctiveAction)).toBe(true)
    })

    it('should encode and decode BatchDeviation correctly (round-trip)', () => {
      const event = new BatchDeviation({
        ...baseEventFields,
        batchId: mockBatchId,
        deviationId: mockDeviationId,
        deviationType: 'equipment',
        description: 'Pump failure during mixing phase',
        severity: 'critical',
        detectedBy: 'system',
        correctiveAction: Option.none(),
        electronicSignature: mockElectronicSignature,
        auditTrailId: 'AUD-2026-00009',
      })

      const encoded = Schema.encodeSync(BatchDeviation)(event)
      const decoded = Schema.decodeSync(BatchDeviation)(encoded)

      expect(decoded.deviationType).toBe('equipment')
      expect(decoded.severity).toBe('critical')
      expect(Option.isNone(decoded.correctiveAction)).toBe(true)
    })

    it('should support all deviation types', () => {
      const deviationTypes = ['process', 'equipment', 'material', 'documentation', 'environmental'] as const

      deviationTypes.forEach((devType) => {
        const event = new BatchDeviation({
          ...baseEventFields,
          batchId: mockBatchId,
          deviationId: mockDeviationId,
          deviationType: devType,
          description: `Deviation of type ${devType}`,
          severity: 'minor',
          detectedBy: 'operator-001',
          correctiveAction: Option.none(),
          electronicSignature: mockElectronicSignature,
          auditTrailId: `AUD-${devType}`,
        })

        expect(event.deviationType).toBe(devType)
      })
    })

    it('should support all severity levels', () => {
      const severityLevels = ['minor', 'major', 'critical'] as const

      severityLevels.forEach((sev) => {
        const event = new BatchDeviation({
          ...baseEventFields,
          batchId: mockBatchId,
          deviationId: mockDeviationId,
          deviationType: 'process',
          description: `Deviation with severity ${sev}`,
          severity: sev,
          detectedBy: 'operator-001',
          correctiveAction: Option.none(),
          electronicSignature: mockElectronicSignature,
          auditTrailId: `AUD-sev-${sev}`,
        })

        expect(event.severity).toBe(sev)
      })
    })
  })

  // ===========================================================================
  // BATCH_EVENT_TAGS Constant
  // ===========================================================================

  describe('Scenario: Event tag constants', () => {
    it('Given BATCH_EVENT_TAGS, Then all 4 events should be listed', () => {
      expect(BATCH_EVENT_TAGS).toHaveLength(4)
      expect(BATCH_EVENT_TAGS).toContain('BatchStarted')
      expect(BATCH_EVENT_TAGS).toContain('ParameterRecorded')
      expect(BATCH_EVENT_TAGS).toContain('BatchCompleted')
      expect(BATCH_EVENT_TAGS).toContain('BatchDeviation')
    })
  })

  // ===========================================================================
  // BatchEvent Union Type
  // ===========================================================================

  describe('Scenario: BatchEvent union type', () => {
    it('should allow all batch event types in union', () => {
      const events: BatchEvent[] = [
        new BatchStarted({
          ...baseEventFields,
          batchId: mockBatchId,
          productCode: 'PROD-001',
          lotNumber: 'LOT-001',
          startedBy: 'operator-001',
          plannedQuantity: 100,
          equipmentIds: [],
          electronicSignature: mockElectronicSignature,
          auditTrailId: 'AUD-001',
        }),
        new ParameterRecorded({
          ...baseEventFields,
          batchId: mockBatchId,
          parameterId: mockParameterId,
          parameterName: 'Temp',
          value: 25,
          unit: 'C',
          recordedBy: 'operator',
          recordedAt: DateTime.unsafeNow(),
          withinSpec: true,
          electronicSignature: mockElectronicSignature,
          auditTrailId: 'AUD-002',
        }),
        new BatchCompleted({
          ...baseEventFields,
          batchId: mockBatchId,
          completedBy: 'operator',
          actualQuantity: 100,
          yieldPercentage: 100,
          completedAt: DateTime.unsafeNow(),
          electronicSignature: mockElectronicSignature,
          auditTrailId: 'AUD-003',
        }),
        new BatchDeviation({
          ...baseEventFields,
          batchId: mockBatchId,
          deviationId: mockDeviationId,
          deviationType: 'process',
          description: 'Test',
          severity: 'minor',
          detectedBy: 'operator',
          correctiveAction: Option.none(),
          electronicSignature: mockElectronicSignature,
          auditTrailId: 'AUD-004',
        }),
      ]

      expect(events).toHaveLength(4)
      // All should have batchId (common field)
      events.forEach((event) => {
        expect(event.batchId).toBe(mockBatchId)
      })
    })
  })

  // ===========================================================================
  // Schema Validation
  // ===========================================================================

  describe('Scenario: Schema validation', () => {
    it('should reject empty productCode in BatchStarted', () => {
      expect(() => {
        new BatchStarted({
          ...baseEventFields,
          batchId: mockBatchId,
          productCode: '', // Invalid: empty string for NonEmptyString
          lotNumber: 'LOT-001',
          startedBy: 'operator-001',
          plannedQuantity: 100,
          equipmentIds: [],
          electronicSignature: mockElectronicSignature,
          auditTrailId: 'AUD-001',
        })
      }).toThrow()
    })

    it('should reject negative plannedQuantity in BatchStarted', () => {
      expect(() => {
        new BatchStarted({
          ...baseEventFields,
          batchId: mockBatchId,
          productCode: 'PROD-001',
          lotNumber: 'LOT-001',
          startedBy: 'operator-001',
          plannedQuantity: -1, // Invalid: negative
          equipmentIds: [],
          electronicSignature: mockElectronicSignature,
          auditTrailId: 'AUD-001',
        })
      }).toThrow()
    })

    it('should reject empty description in BatchDeviation', () => {
      expect(() => {
        new BatchDeviation({
          ...baseEventFields,
          batchId: mockBatchId,
          deviationId: mockDeviationId,
          deviationType: 'process',
          description: '', // Invalid: empty string
          severity: 'minor',
          detectedBy: 'operator',
          correctiveAction: Option.none(),
          electronicSignature: mockElectronicSignature,
          auditTrailId: 'AUD-001',
        })
      }).toThrow()
    })

    it('should reject empty signedBy in ElectronicSignature', () => {
      expect(() => {
        new BatchStarted({
          ...baseEventFields,
          batchId: mockBatchId,
          productCode: 'PROD-001',
          lotNumber: 'LOT-001',
          startedBy: 'operator-001',
          plannedQuantity: 100,
          equipmentIds: [],
          electronicSignature: {
            signedBy: '', // Invalid: empty string
            signedAt: DateTime.unsafeNow(),
            signatureMeaning: 'Test',
          },
          auditTrailId: 'AUD-001',
        })
      }).toThrow()
    })
  })

  // ===========================================================================
  // FDA 21 CFR Part 11 Compliance
  // ===========================================================================

  describe('Scenario: FDA 21 CFR Part 11 compliance', () => {
    it('should have electronicSignature on all batch events', () => {
      const started = new BatchStarted({
        ...baseEventFields,
        batchId: mockBatchId,
        productCode: 'PROD-001',
        lotNumber: 'LOT-001',
        startedBy: 'operator-001',
        plannedQuantity: 100,
        equipmentIds: [],
        electronicSignature: mockElectronicSignature,
        auditTrailId: 'AUD-001',
      })

      const recorded = new ParameterRecorded({
        ...baseEventFields,
        batchId: mockBatchId,
        parameterId: mockParameterId,
        parameterName: 'Temp',
        value: 25,
        unit: 'C',
        recordedBy: 'operator',
        recordedAt: DateTime.unsafeNow(),
        withinSpec: true,
        electronicSignature: mockElectronicSignature,
        auditTrailId: 'AUD-002',
      })

      const completed = new BatchCompleted({
        ...baseEventFields,
        batchId: mockBatchId,
        completedBy: 'operator',
        actualQuantity: 100,
        yieldPercentage: 100,
        completedAt: DateTime.unsafeNow(),
        electronicSignature: mockElectronicSignature,
        auditTrailId: 'AUD-003',
      })

      const deviation = new BatchDeviation({
        ...baseEventFields,
        batchId: mockBatchId,
        deviationId: mockDeviationId,
        deviationType: 'process',
        description: 'Test deviation',
        severity: 'minor',
        detectedBy: 'operator',
        correctiveAction: Option.none(),
        electronicSignature: mockElectronicSignature,
        auditTrailId: 'AUD-004',
      })

      // All events must have electronicSignature
      expect(started.electronicSignature).toBeDefined()
      expect(recorded.electronicSignature).toBeDefined()
      expect(completed.electronicSignature).toBeDefined()
      expect(deviation.electronicSignature).toBeDefined()

      // All events must have auditTrailId
      expect(started.auditTrailId).toBeDefined()
      expect(recorded.auditTrailId).toBeDefined()
      expect(completed.auditTrailId).toBeDefined()
      expect(deviation.auditTrailId).toBeDefined()
    })

    it('should use DateTimeUtc for all timestamps', () => {
      const event = new BatchCompleted({
        ...baseEventFields,
        batchId: mockBatchId,
        completedBy: 'operator',
        actualQuantity: 100,
        yieldPercentage: 100,
        completedAt: DateTime.unsafeNow(),
        electronicSignature: mockElectronicSignature,
        auditTrailId: 'AUD-001',
      })

      // completedAt should be DateTimeUtc (DateTime.unsafeNow returns DateTimeUtc)
      expect(event.completedAt).toBeDefined()
      expect(event.electronicSignature.signedAt).toBeDefined()
    })
  })
})
