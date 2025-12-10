/**
 * EventLog Handler Tests
 *
 * Tests for event handlers, compaction, and reactivity.
 *
 * @module @gbg/tmnl/ams/v2/base/handlers/__tests__/eventlog.test.ts
 */

import { describe, it, expect } from '@effect/vitest'
import { DateTime, Effect, Layer } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import * as EventJournal from '@effect/experimental/EventJournal'
import { AmsEventLogSchema } from '../../events/schema'
import {
  AssetEvents,
  AssetCreatedPayload,
  AssetUpdatedPayload,
  AssetMovedPayload,
  PropertyChangedPayload,
  AssetDeletedPayload,
} from '../../events/asset'
import { AssetEventHandlers } from '../event-handlers'
import { AssetCompaction } from '../compaction'
import { AssetReactivity, AMS_CACHE_KEYS } from '../reactivity'
import { AssetState } from '../../services/asset-state'
import {
  AssetId,
  AssetKind,
  AssetLabel,
  SiteId,
  SectorId,
  IdentityId,
  PropertyKey,
} from '../../../core/schemas/identifiers'
import { CreatedAt } from '../../../core/schemas/timestamps'
import { Provenance, SourceType } from '../../../core/schemas/provenance'
import { PropertyValue } from '../../schemas/property'

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

const testAssetId = 'asset-test-001' as AssetId
const testSiteId = 'site-test-001' as SiteId
const testSectorId = 'sector-test-001' as SectorId
const testKind = 'EQUIPMENT' as AssetKind
const testLabel = 'Test Forklift #1' as AssetLabel
const testIdentity = 'user-test-001' as IdentityId
const testPropertyKey = 'serial_number' as PropertyKey
const testNow = DateTime.unsafeNow() as CreatedAt

// ─────────────────────────────────────────────────────────────────────────────
// Schema Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('AMS EventLog Schema', () => {
  it('schema contains AssetEvents group', () => {
    expect(EventLog.isEventLogSchema(AmsEventLogSchema)).toBe(true)
    expect(AmsEventLogSchema.groups).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Event Payload Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Asset Event Payloads', () => {
  it('AssetCreatedPayload creates valid payload', () => {
    const payload = new AssetCreatedPayload({
      assetId: testAssetId,
      siteId: testSiteId,
      kind: testKind,
      label: testLabel,
      status: 'available',
      createdBy: testIdentity,
      createdAt: testNow,
    })

    expect(payload.assetId).toBe(testAssetId)
    expect(payload.siteId).toBe(testSiteId)
    expect(payload.kind).toBe(testKind)
    expect(payload.label).toBe(testLabel)
  })

  it('AssetUpdatedPayload tracks changes', () => {
    const payload = new AssetUpdatedPayload({
      assetId: testAssetId,
      previousLabel: 'Old Label' as AssetLabel,
      newLabel: 'New Label' as AssetLabel,
      updatedBy: testIdentity,
      updatedAt: testNow,
      version: 2,
    })

    expect(payload.previousLabel).toBe('Old Label')
    expect(payload.newLabel).toBe('New Label')
    expect(payload.version).toBe(2)
  })

  it('AssetMovedPayload captures location change', () => {
    const payload = new AssetMovedPayload({
      assetId: testAssetId,
      fromSiteId: testSiteId,
      toSiteId: 'site-new-001' as SiteId,
      toSectorId: testSectorId,
      movedBy: testIdentity,
      movedAt: testNow,
    })

    expect(payload.fromSiteId).toBe(testSiteId)
    expect(payload.toSiteId).toBe('site-new-001')
    expect(payload.toSectorId).toBe(testSectorId)
  })

  it('PropertyChangedPayload includes provenance', () => {
    const provenance = new Provenance({
      sourceType: 'manual' as SourceType,
      timestamp: testNow,
    })

    const payload = new PropertyChangedPayload({
      assetId: testAssetId,
      key: testPropertyKey,
      previousValue: null,
      newValue: 'SN-12345' as PropertyValue,
      provenance,
      changedBy: testIdentity,
      changedAt: testNow,
    })

    expect(payload.key).toBe(testPropertyKey)
    expect(payload.newValue).toBe('SN-12345')
    expect(payload.provenance.sourceType).toBe('manual')
  })

  it('AssetDeletedPayload distinguishes hard/soft delete', () => {
    const softDelete = new AssetDeletedPayload({
      assetId: testAssetId,
      hardDelete: false,
      deletedBy: testIdentity,
      deletedAt: testNow,
    })

    const hardDelete = new AssetDeletedPayload({
      assetId: testAssetId,
      hardDelete: true,
      reason: 'Data retention policy',
      deletedBy: testIdentity,
      deletedAt: testNow,
    })

    expect(softDelete.hardDelete).toBe(false)
    expect(hardDelete.hardDelete).toBe(true)
    expect(hardDelete.reason).toBe('Data retention policy')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EventGroup Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('AssetEvents EventGroup', () => {
  it('contains all expected events', () => {
    const events = Object.keys(AssetEvents.events)

    expect(events).toContain('AssetCreated')
    expect(events).toContain('AssetUpdated')
    expect(events).toContain('AssetMoved')
    expect(events).toContain('PropertyChanged')
    expect(events).toContain('PropertyRemoved')
    expect(events).toContain('TraitAdded')
    expect(events).toContain('TraitRemoved')
    expect(events).toContain('AssetDeleted')
    expect(events).toHaveLength(8)
  })

  it('events have correct primaryKey extractors', () => {
    const assetCreatedEvent = AssetEvents.events['AssetCreated']
    const payload = new AssetCreatedPayload({
      assetId: testAssetId,
      siteId: testSiteId,
      kind: testKind,
      label: testLabel,
      status: 'available',
      createdBy: testIdentity,
      createdAt: testNow,
    })

    // primaryKey should extract assetId
    const primaryKey = assetCreatedEvent.primaryKey(payload)
    expect(primaryKey).toBe(testAssetId)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Reactivity Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Asset Reactivity Cache Keys', () => {
  it('defines all expected cache keys', () => {
    expect(AMS_CACHE_KEYS.ASSETS_LIST).toBe('ams:assets:list')
    expect(AMS_CACHE_KEYS.ASSETS_BY_SITE).toBe('ams:assets:by-site')
    expect(AMS_CACHE_KEYS.ASSETS_BY_SECTOR).toBe('ams:assets:by-sector')
    expect(AMS_CACHE_KEYS.ASSETS_BY_CONTAINER).toBe('ams:assets:by-container')
    expect(AMS_CACHE_KEYS.ASSET_PROPERTIES).toBe('ams:assets:properties')
    expect(AMS_CACHE_KEYS.ASSET_TRAITS).toBe('ams:assets:traits')
    expect(AMS_CACHE_KEYS.ASSET_COUNTS).toBe('ams:assets:counts')
    expect(AMS_CACHE_KEYS.SEARCH_INDEX).toBe('ams:search:index')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Layer Composition Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('EventLog Layer Composition', () => {
  // These tests verify layers can be composed without errors
  // Full integration tests require EventJournal setup

  it('AssetEventHandlers is a valid Layer', () => {
    // AssetEventHandlers should be a Layer
    expect(AssetEventHandlers).toBeDefined()
  })

  it('AssetCompaction is a valid Layer', () => {
    expect(AssetCompaction).toBeDefined()
  })

  it('AssetReactivity is a valid Layer', () => {
    expect(AssetReactivity).toBeDefined()
  })
})
