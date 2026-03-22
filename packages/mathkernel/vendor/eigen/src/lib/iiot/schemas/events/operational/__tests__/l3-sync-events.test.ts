/**
 * L3 Sync Operation Events — Unit Tests
 *
 * TDD tests for ISA-95 Level 3 system integration events.
 *
 * Tests 5 events:
 * - L3SyncStarted: Sync operation initiated
 * - L3SyncProgress: Progress update during sync
 * - L3SyncCompleted: Sync completed successfully
 * - L3SyncFailed: Sync failed with error
 * - ExternalChangeDetected: External system change detected
 *
 * Note: The _tag field inherits from BaseOperationalEvent per Effect Schema
 * pattern. The event tag for EventGroup is managed separately via the
 * EventGroup.add() tag property.
 *
 * @module @gbg/tmnl/iiot/schemas/events/operational/__tests__/l3-sync-events
 * @see EL-3.9-10 for L3 sync event requirements
 * @see ISA-95/IEC 62264 for operations management
 */

import { describe, it, expect } from 'vitest'
import { Schema, DateTime, Option } from 'effect'

// =============================================================================
// Import L3 Sync Events
// =============================================================================

import {
  L3SyncStarted,
  L3SyncProgress,
  L3SyncCompleted,
  L3SyncFailed,
  ExternalChangeDetected,
  L3_SYNC_EVENT_TAGS,
  type L3SyncEvent,
  type L3SyncEventTag,
} from '../l3-sync-events'

import type {
  SyncId,
  AssetId,
  EventId,
} from '../../../identifiers'

import type { ChangeId } from '../l3-sync-events'

// =============================================================================
// Test Helpers
// =============================================================================

const makeEventId = (): EventId =>
  `EVT-${Date.now()}-${Math.random().toString(36).slice(2)}` as EventId

const mockSyncId = 'SYNC-2026-00001' as SyncId
const mockChangeId = 'CHG-2026-00001' as ChangeId
const mockAssetId = 'AST-test-sync-001' as AssetId
const nowUtc = () => DateTime.unsafeNow()

/** Base operational event fields needed for all event constructors */
const baseEventFields = () => ({
  eventId: makeEventId(),
  occurredAt: nowUtc(),
  correlationId: Option.none() as Option.Option<string>,
})

// =============================================================================
// Feature: L3 Sync Operation Event Schemas (EL-3.9-10)
// =============================================================================

describe('Feature: L3 Sync Operation Events (EL-3.9-10)', () => {
  describe('Scenario: L3SyncStarted event', () => {
    it('Given a sync request, When initiated, Then L3SyncStarted event should be valid', () => {
      const event = new L3SyncStarted({
        ...baseEventFields(),
        causedBy: 'system-scheduler',
        entityId: mockAssetId,
        entityType: 'site',
        syncId: mockSyncId,
        targetSystem: 'SAP-ERP',
        syncType: 'full',
        initiatedBy: 'system-scheduler',
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.syncId).toBe(mockSyncId)
      expect(event.targetSystem).toBe('SAP-ERP')
      expect(event.syncType).toBe('full')
      expect(event.initiatedBy).toBe('system-scheduler')
    })

    it('should accept delta sync type', () => {
      const event = new L3SyncStarted({
        ...baseEventFields(),
        causedBy: 'user-123',
        entityId: mockAssetId,
        entityType: 'site',
        syncId: mockSyncId,
        targetSystem: 'MES-001',
        syncType: 'delta',
        initiatedBy: 'user-123',
      })

      expect(event.syncType).toBe('delta')
    })
  })

  describe('Scenario: L3SyncProgress event', () => {
    it('Given an active sync, When progress updates, Then L3SyncProgress event should be valid', () => {
      const event = new L3SyncProgress({
        ...baseEventFields(),
        causedBy: 'sync-worker',
        entityId: mockAssetId,
        entityType: 'site',
        syncId: mockSyncId,
        recordsProcessed: 500,
        totalRecords: 1000,
        status: 'running',
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.syncId).toBe(mockSyncId)
      expect(event.recordsProcessed).toBe(500)
      expect(event.totalRecords).toBe(1000)
      expect(event.status).toBe('running')
    })

    it('should accept paused status', () => {
      const event = new L3SyncProgress({
        ...baseEventFields(),
        causedBy: 'sync-worker',
        entityId: mockAssetId,
        entityType: 'site',
        syncId: mockSyncId,
        recordsProcessed: 250,
        totalRecords: 1000,
        status: 'paused',
      })

      expect(event.status).toBe('paused')
    })
  })

  describe('Scenario: L3SyncCompleted event', () => {
    it('Given a completed sync, When finished, Then L3SyncCompleted event should be valid', () => {
      const event = new L3SyncCompleted({
        ...baseEventFields(),
        causedBy: 'sync-worker',
        entityId: mockAssetId,
        entityType: 'site',
        syncId: mockSyncId,
        recordsCreated: 100,
        recordsUpdated: 250,
        recordsDeleted: 10,
        duration: 45000, // 45 seconds in milliseconds
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.syncId).toBe(mockSyncId)
      expect(event.recordsCreated).toBe(100)
      expect(event.recordsUpdated).toBe(250)
      expect(event.recordsDeleted).toBe(10)
      expect(event.duration).toBe(45000)
    })
  })

  describe('Scenario: L3SyncFailed event', () => {
    it('Given a failed sync, When error occurs, Then L3SyncFailed event should be valid', () => {
      const event = new L3SyncFailed({
        ...baseEventFields(),
        causedBy: 'sync-worker',
        entityId: mockAssetId,
        entityType: 'site',
        syncId: mockSyncId,
        errorCode: 'CONN_TIMEOUT',
        errorMessage: 'Connection to SAP-ERP timed out after 30 seconds',
        failedAt: nowUtc(),
        retryable: true,
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.syncId).toBe(mockSyncId)
      expect(event.errorCode).toBe('CONN_TIMEOUT')
      expect(event.errorMessage).toBe('Connection to SAP-ERP timed out after 30 seconds')
      expect(event.retryable).toBe(true)
    })

    it('should handle non-retryable errors', () => {
      const event = new L3SyncFailed({
        ...baseEventFields(),
        causedBy: 'sync-worker',
        entityId: mockAssetId,
        entityType: 'site',
        syncId: mockSyncId,
        errorCode: 'AUTH_FAILED',
        errorMessage: 'Invalid credentials for external system',
        failedAt: nowUtc(),
        retryable: false,
      })

      expect(event.retryable).toBe(false)
    })
  })

  describe('Scenario: ExternalChangeDetected event', () => {
    it('Given an external system, When change detected, Then ExternalChangeDetected event should be valid', () => {
      const event = new ExternalChangeDetected({
        ...baseEventFields(),
        causedBy: 'change-listener',
        entityId: mockAssetId,
        entityType: 'site',
        changeId: mockChangeId,
        sourceSystem: 'SAP-ERP',
        changeType: 'update',
        affectedEntities: ['WO-001', 'WO-002'],
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.changeId).toBe(mockChangeId)
      expect(event.sourceSystem).toBe('SAP-ERP')
      expect(event.changeType).toBe('update')
      expect(event.affectedEntities).toEqual(['WO-001', 'WO-002'])
    })

    it('should accept create change type', () => {
      const event = new ExternalChangeDetected({
        ...baseEventFields(),
        causedBy: 'change-listener',
        entityId: mockAssetId,
        entityType: 'site',
        changeId: mockChangeId,
        sourceSystem: 'MES-001',
        changeType: 'create',
        affectedEntities: ['WO-003'],
      })

      expect(event.changeType).toBe('create')
    })

    it('should accept delete change type', () => {
      const event = new ExternalChangeDetected({
        ...baseEventFields(),
        causedBy: 'change-listener',
        entityId: mockAssetId,
        entityType: 'site',
        changeId: mockChangeId,
        sourceSystem: 'MES-001',
        changeType: 'delete',
        affectedEntities: ['WO-004'],
      })

      expect(event.changeType).toBe('delete')
    })
  })

  describe('Scenario: Event tag constants', () => {
    it('Given L3_SYNC_EVENT_TAGS, Then all 5 events should be listed', () => {
      expect(L3_SYNC_EVENT_TAGS).toHaveLength(5)
      expect(L3_SYNC_EVENT_TAGS).toContain('L3SyncStarted')
      expect(L3_SYNC_EVENT_TAGS).toContain('L3SyncProgress')
      expect(L3_SYNC_EVENT_TAGS).toContain('L3SyncCompleted')
      expect(L3_SYNC_EVENT_TAGS).toContain('L3SyncFailed')
      expect(L3_SYNC_EVENT_TAGS).toContain('ExternalChangeDetected')
    })
  })

  describe('Scenario: Schema round-trip encode/decode', () => {
    it('Given an L3SyncStarted event, When encoded and decoded, Then it should round-trip correctly', () => {
      const event = new L3SyncStarted({
        ...baseEventFields(),
        causedBy: 'user-123',
        entityId: mockAssetId,
        entityType: 'site',
        syncId: mockSyncId,
        targetSystem: 'SAP-ERP',
        syncType: 'full',
        initiatedBy: 'user-123',
      })

      const encoded = Schema.encodeSync(L3SyncStarted)(event)
      const decoded = Schema.decodeSync(L3SyncStarted)(encoded)

      expect(decoded.syncId).toBe(mockSyncId)
      expect(decoded.targetSystem).toBe('SAP-ERP')
      expect(decoded.syncType).toBe('full')
    })

    it('Given an L3SyncProgress event, When encoded and decoded, Then it should round-trip correctly', () => {
      const event = new L3SyncProgress({
        ...baseEventFields(),
        causedBy: 'sync-worker',
        entityId: mockAssetId,
        entityType: 'site',
        syncId: mockSyncId,
        recordsProcessed: 750,
        totalRecords: 1000,
        status: 'running',
      })

      const encoded = Schema.encodeSync(L3SyncProgress)(event)
      const decoded = Schema.decodeSync(L3SyncProgress)(encoded)

      expect(decoded.recordsProcessed).toBe(750)
      expect(decoded.totalRecords).toBe(1000)
    })

    it('Given an L3SyncCompleted event, When encoded and decoded, Then it should round-trip correctly', () => {
      const event = new L3SyncCompleted({
        ...baseEventFields(),
        causedBy: 'sync-worker',
        entityId: mockAssetId,
        entityType: 'site',
        syncId: mockSyncId,
        recordsCreated: 50,
        recordsUpdated: 100,
        recordsDeleted: 5,
        duration: 30000,
      })

      const encoded = Schema.encodeSync(L3SyncCompleted)(event)
      const decoded = Schema.decodeSync(L3SyncCompleted)(encoded)

      expect(decoded.recordsCreated).toBe(50)
      expect(decoded.recordsUpdated).toBe(100)
      expect(decoded.recordsDeleted).toBe(5)
      expect(decoded.duration).toBe(30000)
    })

    it('Given an L3SyncFailed event, When encoded and decoded, Then it should round-trip correctly', () => {
      const failedAt = nowUtc()
      const event = new L3SyncFailed({
        ...baseEventFields(),
        causedBy: 'sync-worker',
        entityId: mockAssetId,
        entityType: 'site',
        syncId: mockSyncId,
        errorCode: 'DATA_MISMATCH',
        errorMessage: 'Schema mismatch in payload',
        failedAt,
        retryable: false,
      })

      const encoded = Schema.encodeSync(L3SyncFailed)(event)
      const decoded = Schema.decodeSync(L3SyncFailed)(encoded)

      expect(decoded.errorCode).toBe('DATA_MISMATCH')
      expect(decoded.errorMessage).toBe('Schema mismatch in payload')
      expect(decoded.retryable).toBe(false)
    })

    it('Given an ExternalChangeDetected event, When encoded and decoded, Then it should round-trip correctly', () => {
      const event = new ExternalChangeDetected({
        ...baseEventFields(),
        causedBy: 'change-listener',
        entityId: mockAssetId,
        entityType: 'site',
        changeId: mockChangeId,
        sourceSystem: 'SAP-ERP',
        changeType: 'update',
        affectedEntities: ['WO-001', 'WO-002', 'WO-003'],
      })

      const encoded = Schema.encodeSync(ExternalChangeDetected)(event)
      const decoded = Schema.decodeSync(ExternalChangeDetected)(encoded)

      expect(decoded.changeId).toBe(mockChangeId)
      expect(decoded.sourceSystem).toBe('SAP-ERP')
      expect(decoded.changeType).toBe('update')
      expect(decoded.affectedEntities).toEqual(['WO-001', 'WO-002', 'WO-003'])
    })
  })

  describe('Scenario: EventGroup integration', () => {
    it('should have all required fields for EventGroup integration', () => {
      const event = new L3SyncStarted({
        ...baseEventFields(),
        causedBy: 'user-123',
        entityId: mockAssetId,
        entityType: 'site',
        syncId: mockSyncId,
        targetSystem: 'SAP-ERP',
        syncType: 'full',
        initiatedBy: 'user-123',
      })

      // EventGroup requires these base fields
      expect(event).toHaveProperty('eventId')
      expect(event).toHaveProperty('occurredAt')
      expect(event).toHaveProperty('causedBy')
      expect(event).toHaveProperty('entityId')
      expect(event).toHaveProperty('entityType')

      // L3Sync events require syncId
      expect(event).toHaveProperty('syncId')
    })
  })

  describe('Scenario: Sync type validation', () => {
    const validSyncTypes = ['full', 'delta'] as const

    validSyncTypes.forEach((syncType) => {
      it(`should accept sync type: ${syncType}`, () => {
        const event = new L3SyncStarted({
          ...baseEventFields(),
          causedBy: 'user-123',
          entityId: mockAssetId,
          entityType: 'site',
          syncId: mockSyncId,
          targetSystem: 'SAP-ERP',
          syncType,
          initiatedBy: 'user-123',
        })

        expect(event.syncType).toBe(syncType)
      })
    })
  })

  describe('Scenario: Progress status validation', () => {
    const validStatuses = ['running', 'paused'] as const

    validStatuses.forEach((status) => {
      it(`should accept progress status: ${status}`, () => {
        const event = new L3SyncProgress({
          ...baseEventFields(),
          causedBy: 'sync-worker',
          entityId: mockAssetId,
          entityType: 'site',
          syncId: mockSyncId,
          recordsProcessed: 100,
          totalRecords: 1000,
          status,
        })

        expect(event.status).toBe(status)
      })
    })
  })

  describe('Scenario: Change type validation', () => {
    const validChangeTypes = ['create', 'update', 'delete'] as const

    validChangeTypes.forEach((changeType) => {
      it(`should accept change type: ${changeType}`, () => {
        const event = new ExternalChangeDetected({
          ...baseEventFields(),
          causedBy: 'change-listener',
          entityId: mockAssetId,
          entityType: 'site',
          changeId: mockChangeId,
          sourceSystem: 'SAP-ERP',
          changeType,
          affectedEntities: ['WO-001'],
        })

        expect(event.changeType).toBe(changeType)
      })
    })
  })
})
