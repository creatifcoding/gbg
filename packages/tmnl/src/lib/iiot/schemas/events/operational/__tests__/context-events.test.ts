/**
 * WorkOrderContext Events Tests
 *
 * TDD tests for the 10 context events defined in EL-3.5-8.
 * Tests event construction, schema validation, and branded types.
 *
 * Note: The _tag field inherits from BaseOperationalEvent per Effect Schema
 * pattern. The event tag for EventGroup is managed separately via the
 * EventGroup.add() tag property.
 *
 * @module @gbg/tmnl/iiot/schemas/events/operational/__tests__/context-events
 */

import { describe, it, expect } from 'vitest'
import { Schema, Option, DateTime } from 'effect'

import {
  // Branded Types
  WorkOrderContextId,
  ResourceId,
  ExternalRefId,
  // Events
  ContextCreated,
  ContextUpdated,
  ContextSnapshotted,
  AssetAttached,
  AssetDetached,
  ResourceAllocated,
  ResourceReleased,
  ExternalRefLinked,
  ExternalRefUnlinked,
  ChildWorkOrderSpawned,
  // Union and Tags
  CONTEXT_EVENT_TAGS,
  type ContextEvent,
  type ContextEventTag,
} from '../context-events'

import { EventId, AssetId, WorkOrderId } from '../../../identifiers'

// =============================================================================
// Test Helpers
// =============================================================================

const makeEventId = () => 'EVT-test-001' as EventId
const makeAssetId = () => 'ASSET-001' as AssetId
const makeWorkOrderId = () => 'WO-2026-00001' as WorkOrderId
const makeContextId = () => 'CTX-001' as WorkOrderContextId
const makeResourceId = () => 'RES-001' as ResourceId
const makeExternalRefId = () => 'EXTREF-001' as ExternalRefId
const nowUtc = () => DateTime.unsafeNow()

/** Base operational event fields needed for all event constructors */
const baseEventFields = () => ({
  eventId: makeEventId(),
  occurredAt: nowUtc(),
  correlationId: Option.none() as Option.Option<string>,
})

// =============================================================================
// Branded Type Tests
// =============================================================================

describe('WorkOrderContext Branded Types', () => {
  describe('WorkOrderContextId', () => {
    it('should create a branded WorkOrderContextId', () => {
      const decoded = Schema.decodeUnknownSync(WorkOrderContextId)('CTX-001')
      expect(decoded).toBe('CTX-001')
    })

    it('should fail for non-string values', () => {
      expect(() => Schema.decodeUnknownSync(WorkOrderContextId)(123)).toThrow()
    })
  })

  describe('ResourceId', () => {
    it('should create a branded ResourceId', () => {
      const decoded = Schema.decodeUnknownSync(ResourceId)('RES-TOOL-001')
      expect(decoded).toBe('RES-TOOL-001')
    })
  })

  describe('ExternalRefId', () => {
    it('should create a branded ExternalRefId', () => {
      const decoded = Schema.decodeUnknownSync(ExternalRefId)('SAP-WO-12345')
      expect(decoded).toBe('SAP-WO-12345')
    })
  })
})

// =============================================================================
// Context Event Tests
// =============================================================================

describe('WorkOrderContext Events', () => {
  describe('ContextCreated', () => {
    it('should create a ContextCreated event with correct fields', () => {
      const event = new ContextCreated({
        ...baseEventFields(),
        causedBy: 'system',
        entityId: makeAssetId(),
        entityType: 'machine',
        workOrderId: makeWorkOrderId(),
        contextId: makeContextId(),
        initialAssets: [makeAssetId()],
        metadata: Option.none(),
      })

      // _tag inherits from BaseOperationalEvent
      expect(event._tag).toBe('BaseOperationalEvent')
      expect(event.workOrderId).toBe(makeWorkOrderId())
      expect(event.contextId).toBe(makeContextId())
      expect(event.initialAssets).toHaveLength(1)
    })

    it('should accept optional metadata', () => {
      const event = new ContextCreated({
        ...baseEventFields(),
        causedBy: 'system',
        entityId: makeAssetId(),
        entityType: 'machine',
        workOrderId: makeWorkOrderId(),
        contextId: makeContextId(),
        initialAssets: [],
        metadata: Option.some({ priority: 'high' }),
      })

      expect(Option.isSome(event.metadata)).toBe(true)
    })
  })

  describe('ContextUpdated', () => {
    it('should create a ContextUpdated event with field changes', () => {
      const event = new ContextUpdated({
        ...baseEventFields(),
        causedBy: 'operator-001',
        entityId: makeAssetId(),
        entityType: 'machine',
        workOrderId: makeWorkOrderId(),
        contextId: makeContextId(),
        fieldName: 'priority',
        previousValue: Option.some('normal'),
        newValue: 'high',
        reason: Option.some('Escalation required'),
      })

      expect(event.fieldName).toBe('priority')
      expect(event.newValue).toBe('high')
      expect(Option.getOrNull(event.previousValue)).toBe('normal')
    })
  })

  describe('ContextSnapshotted', () => {
    it('should create an immutable snapshot event', () => {
      const snapshotId = 'SNAP-001'
      const event = new ContextSnapshotted({
        ...baseEventFields(),
        causedBy: 'audit-system',
        entityId: makeAssetId(),
        entityType: 'machine',
        workOrderId: makeWorkOrderId(),
        contextId: makeContextId(),
        snapshotId,
        snapshotData: { assets: ['ASSET-001'], resources: ['RES-001'] },
        snapshotReason: 'phase_complete',
        notes: Option.none(),
      })

      expect(event.snapshotId).toBe(snapshotId)
      expect(event.snapshotReason).toBe('phase_complete')
      expect(event.snapshotData).toHaveProperty('assets')
    })
  })

  describe('AssetAttached', () => {
    it('should create an AssetAttached event', () => {
      const attachedAssetId = 'MCH-002' as AssetId
      const event = new AssetAttached({
        ...baseEventFields(),
        causedBy: 'operator-001',
        entityId: makeAssetId(),
        entityType: 'machine',
        workOrderId: makeWorkOrderId(),
        contextId: makeContextId(),
        attachedAssetId,
        assetRole: 'primary_target',
        notes: Option.some('Main machine for work order'),
      })

      expect(event.attachedAssetId).toBe(attachedAssetId)
      expect(event.assetRole).toBe('primary_target')
      expect(Option.getOrNull(event.notes)).toBe('Main machine for work order')
    })
  })

  describe('AssetDetached', () => {
    it('should create an AssetDetached event', () => {
      const detachedAssetId = 'MCH-002' as AssetId
      const event = new AssetDetached({
        ...baseEventFields(),
        causedBy: 'operator-001',
        entityId: makeAssetId(),
        entityType: 'machine',
        workOrderId: makeWorkOrderId(),
        contextId: makeContextId(),
        detachedAssetId,
        reason: 'scope_change',
        notes: Option.none(),
      })

      expect(event.detachedAssetId).toBe(detachedAssetId)
      expect(event.reason).toBe('scope_change')
    })
  })

  describe('ResourceAllocated', () => {
    it('should create a ResourceAllocated event', () => {
      const event = new ResourceAllocated({
        ...baseEventFields(),
        causedBy: 'planner-001',
        entityId: makeAssetId(),
        entityType: 'machine',
        workOrderId: makeWorkOrderId(),
        contextId: makeContextId(),
        resourceId: makeResourceId(),
        resourceType: 'tool',
        resourceName: 'Torque Wrench 50Nm',
        quantity: Option.some(1),
        unit: Option.some('each'),
        allocatedBy: 'planner-001',
        notes: Option.none(),
      })

      expect(event.resourceType).toBe('tool')
      expect(event.resourceName).toBe('Torque Wrench 50Nm')
      expect(Option.getOrNull(event.quantity)).toBe(1)
    })
  })

  describe('ResourceReleased', () => {
    it('should create a ResourceReleased event', () => {
      const event = new ResourceReleased({
        ...baseEventFields(),
        causedBy: 'operator-001',
        entityId: makeAssetId(),
        entityType: 'machine',
        workOrderId: makeWorkOrderId(),
        contextId: makeContextId(),
        resourceId: makeResourceId(),
        releaseReason: 'work_complete',
        releasedBy: 'operator-001',
        quantityReturned: Option.some(1),
        conditionNotes: Option.some('Good condition'),
      })

      expect(event.releaseReason).toBe('work_complete')
      expect(event.releasedBy).toBe('operator-001')
    })
  })

  describe('ExternalRefLinked', () => {
    it('should create an ExternalRefLinked event', () => {
      const event = new ExternalRefLinked({
        ...baseEventFields(),
        causedBy: 'integration-service',
        entityId: makeAssetId(),
        entityType: 'machine',
        workOrderId: makeWorkOrderId(),
        contextId: makeContextId(),
        externalRefId: makeExternalRefId(),
        externalSystem: 'SAP',
        externalType: 'work_order',
        externalIdentifier: 'SAP-PM-2026-00123',
        linkUrl: Option.some('https://sap.example.com/wo/2026-00123'),
        metadata: Option.none(),
      })

      expect(event.externalSystem).toBe('SAP')
      expect(event.externalIdentifier).toBe('SAP-PM-2026-00123')
      expect(Option.getOrNull(event.linkUrl)).toBe('https://sap.example.com/wo/2026-00123')
    })
  })

  describe('ExternalRefUnlinked', () => {
    it('should create an ExternalRefUnlinked event', () => {
      const event = new ExternalRefUnlinked({
        ...baseEventFields(),
        causedBy: 'integration-service',
        entityId: makeAssetId(),
        entityType: 'machine',
        workOrderId: makeWorkOrderId(),
        contextId: makeContextId(),
        externalRefId: makeExternalRefId(),
        reason: 'duplicate_link',
        notes: Option.some('Replaced with correct reference'),
      })

      expect(event.reason).toBe('duplicate_link')
      expect(Option.getOrNull(event.notes)).toBe('Replaced with correct reference')
    })
  })

  describe('ChildWorkOrderSpawned', () => {
    it('should create a ChildWorkOrderSpawned event', () => {
      const childWorkOrderId = 'WO-2026-00002' as WorkOrderId
      const event = new ChildWorkOrderSpawned({
        ...baseEventFields(),
        causedBy: 'operator-001',
        entityId: makeAssetId(),
        entityType: 'machine',
        workOrderId: makeWorkOrderId(),
        contextId: makeContextId(),
        childWorkOrderId,
        childType: 'corrective_maintenance',
        reason: 'Discovered additional issue during inspection',
        inheritAssets: true,
        inheritResources: false,
      })

      expect(event.childWorkOrderId).toBe(childWorkOrderId)
      expect(event.childType).toBe('corrective_maintenance')
      expect(event.inheritAssets).toBe(true)
      expect(event.inheritResources).toBe(false)
    })
  })
})

// =============================================================================
// Event Tags Tests
// =============================================================================

describe('CONTEXT_EVENT_TAGS', () => {
  it('should contain all 10 context event tags', () => {
    expect(CONTEXT_EVENT_TAGS).toHaveLength(10)
    expect(CONTEXT_EVENT_TAGS).toContain('ContextCreated')
    expect(CONTEXT_EVENT_TAGS).toContain('ContextUpdated')
    expect(CONTEXT_EVENT_TAGS).toContain('ContextSnapshotted')
    expect(CONTEXT_EVENT_TAGS).toContain('AssetAttached')
    expect(CONTEXT_EVENT_TAGS).toContain('AssetDetached')
    expect(CONTEXT_EVENT_TAGS).toContain('ResourceAllocated')
    expect(CONTEXT_EVENT_TAGS).toContain('ResourceReleased')
    expect(CONTEXT_EVENT_TAGS).toContain('ExternalRefLinked')
    expect(CONTEXT_EVENT_TAGS).toContain('ExternalRefUnlinked')
    expect(CONTEXT_EVENT_TAGS).toContain('ChildWorkOrderSpawned')
  })

  it('should have correct type for ContextEventTag', () => {
    const tag: ContextEventTag = 'ContextCreated'
    expect(CONTEXT_EVENT_TAGS).toContain(tag)
  })
})

// =============================================================================
// Schema Validation Tests
// =============================================================================

describe('Schema Validation', () => {
  it('should validate ContextCreated structure', () => {
    const event = new ContextCreated({
      ...baseEventFields(),
      causedBy: 'test',
      entityId: 'ASSET-001' as AssetId,
      entityType: 'machine',
      workOrderId: 'WO-001' as WorkOrderId,
      contextId: 'CTX-001' as WorkOrderContextId,
      initialAssets: [],
      metadata: Option.none(),
    })

    expect(event.workOrderId).toBe('WO-001')
    expect(event.contextId).toBe('CTX-001')
    expect(event.entityType).toBe('machine')
  })

  it('should reject invalid entityType during construction', () => {
    expect(() =>
      new ContextCreated({
        ...baseEventFields(),
        causedBy: 'test',
        entityId: 'ASSET-001' as AssetId,
        // @ts-expect-error - Testing runtime validation
        entityType: 'invalid_type',
        workOrderId: 'WO-001' as WorkOrderId,
        contextId: 'CTX-001' as WorkOrderContextId,
        initialAssets: [],
        metadata: Option.none(),
      })
    ).toThrow()
  })

  it('should require workOrderId on all context events', () => {
    const fieldsWithoutWorkOrderId = {
      ...baseEventFields(),
      causedBy: 'test',
      entityId: 'ASSET-001' as AssetId,
      entityType: 'machine' as const,
      contextId: 'CTX-001' as WorkOrderContextId,
      attachedAssetId: 'MCH-002' as AssetId,
      assetRole: 'primary_target' as const,
      notes: Option.none() as Option.Option<string>,
    }

    // @ts-expect-error - workOrderId is required
    expect(() => new AssetAttached(fieldsWithoutWorkOrderId)).toThrow()
  })

  it('should encode ContextCreated to JSON-compatible format', () => {
    const event = new ContextCreated({
      ...baseEventFields(),
      causedBy: 'test',
      entityId: 'ASSET-001' as AssetId,
      entityType: 'machine',
      workOrderId: 'WO-001' as WorkOrderId,
      contextId: 'CTX-001' as WorkOrderContextId,
      initialAssets: ['ASSET-002' as AssetId],
      metadata: Option.some({ key: 'value' }),
    })

    const encoded = Schema.encodeSync(ContextCreated)(event)
    expect(encoded.workOrderId).toBe('WO-001')
    expect(encoded.initialAssets).toEqual(['ASSET-002'])
    expect(encoded.entityType).toBe('machine')
  })

  it('should have all required fields for EventGroup integration', () => {
    // Verify the shape matches what EventGroup expects
    const event = new ContextCreated({
      ...baseEventFields(),
      causedBy: 'test',
      entityId: 'ASSET-001' as AssetId,
      entityType: 'machine',
      workOrderId: 'WO-001' as WorkOrderId,
      contextId: 'CTX-001' as WorkOrderContextId,
      initialAssets: [],
      metadata: Option.none(),
    })

    // EventGroup requires these base fields
    expect(event).toHaveProperty('eventId')
    expect(event).toHaveProperty('occurredAt')
    expect(event).toHaveProperty('causedBy')
    expect(event).toHaveProperty('entityId')
    expect(event).toHaveProperty('entityType')

    // Context events require these additional fields
    expect(event).toHaveProperty('workOrderId')
    expect(event).toHaveProperty('contextId')
  })
})

// =============================================================================
// Resource Type Tests
// =============================================================================

describe('ResourceType validation', () => {
  const validResourceTypes = [
    'tool',
    'material',
    'consumable',
    'equipment',
    'personnel',
    'documentation',
    'other',
  ] as const

  validResourceTypes.forEach((resourceType) => {
    it(`should accept resource type: ${resourceType}`, () => {
      const event = new ResourceAllocated({
        ...baseEventFields(),
        causedBy: 'planner-001',
        entityId: makeAssetId(),
        entityType: 'machine',
        workOrderId: makeWorkOrderId(),
        contextId: makeContextId(),
        resourceId: makeResourceId(),
        resourceType,
        resourceName: 'Test Resource',
        quantity: Option.none(),
        unit: Option.none(),
        allocatedBy: 'planner-001',
        notes: Option.none(),
      })

      expect(event.resourceType).toBe(resourceType)
    })
  })
})

// =============================================================================
// Snapshot Reason Tests
// =============================================================================

describe('SnapshotReason validation', () => {
  const validSnapshotReasons = [
    'phase_complete',
    'audit_request',
    'approval_checkpoint',
    'external_sync',
    'manual_request',
    'system_backup',
  ] as const

  validSnapshotReasons.forEach((snapshotReason) => {
    it(`should accept snapshot reason: ${snapshotReason}`, () => {
      const event = new ContextSnapshotted({
        ...baseEventFields(),
        causedBy: 'audit-system',
        entityId: makeAssetId(),
        entityType: 'machine',
        workOrderId: makeWorkOrderId(),
        contextId: makeContextId(),
        snapshotId: 'SNAP-001',
        snapshotData: {},
        snapshotReason,
        notes: Option.none(),
      })

      expect(event.snapshotReason).toBe(snapshotReason)
    })
  })
})
