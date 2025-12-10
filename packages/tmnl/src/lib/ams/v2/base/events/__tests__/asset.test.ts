/**
 * Asset Event Unit Tests
 */

import { describe, it, expect } from '@effect/vitest'
import { Effect, Schema, DateTime } from 'effect'
import {
  AssetCreatedPayload,
  AssetUpdatedPayload,
  AssetMovedPayload,
  PropertyChangedPayload,
  PropertyRemovedPayload,
  TraitAddedPayload,
  TraitRemovedPayload,
  AssetDeletedPayload,
  AssetEvents,
} from '../asset'
import {
  AssetId,
  AssetKind,
  AssetLabel,
  SiteId,
  SectorId,
  PropertyKey,
  TraitId,
  IdentityId,
} from '../../../core/schemas/identifiers'
import { CreatedAt, SourceType } from '../../../core/schemas/provenance'
import { Provenance } from '../../../core/schemas/provenance'
import { AssetStatus } from '../../schemas/asset'
import { PropertyValue } from '../../schemas/property'

describe('Asset Events', () => {
  const now = DateTime.unsafeNow() as CreatedAt
  const testIdentity = 'user-123' as IdentityId
  const testAssetId = 'asset-001' as AssetId

  describe('Payload Schemas', () => {
    it('AssetCreatedPayload creates instance', () => {
      const payload = new AssetCreatedPayload({
        assetId: testAssetId,
        siteId: 'site-01' as SiteId,
        kind: 'EQUIPMENT' as AssetKind,
        label: 'Test Equipment' as AssetLabel,
        status: 'available' as AssetStatus,
        createdBy: testIdentity,
        createdAt: now,
      })

      expect(payload.assetId).toBe('asset-001')
      expect(payload.siteId).toBe('site-01')
      expect(payload.kind).toBe('EQUIPMENT')
    })

    it('AssetUpdatedPayload tracks changes', () => {
      const payload = new AssetUpdatedPayload({
        assetId: testAssetId,
        previousLabel: 'Old Label' as AssetLabel,
        newLabel: 'New Label' as AssetLabel,
        previousStatus: 'available' as AssetStatus,
        newStatus: 'maintenance' as AssetStatus,
        updatedBy: testIdentity,
        updatedAt: now,
        version: 2,
      })

      expect(payload.previousLabel).toBe('Old Label')
      expect(payload.newLabel).toBe('New Label')
      expect(payload.version).toBe(2)
    })

    it('AssetMovedPayload tracks location change', () => {
      const payload = new AssetMovedPayload({
        assetId: testAssetId,
        fromSiteId: 'site-01' as SiteId,
        fromSectorId: 'sector-A' as SectorId,
        toSiteId: 'site-02' as SiteId,
        toSectorId: 'sector-B' as SectorId,
        reason: 'Relocation',
        movedBy: testIdentity,
        movedAt: now,
      })

      expect(payload.fromSiteId).toBe('site-01')
      expect(payload.toSiteId).toBe('site-02')
      expect(payload.reason).toBe('Relocation')
    })

    it('PropertyChangedPayload includes provenance', () => {
      const provenance = new Provenance({
        sourceType: 'manual' as SourceType,
        timestamp: now,
      })

      const payload = new PropertyChangedPayload({
        assetId: testAssetId,
        key: 'serialNumber' as PropertyKey,
        previousValue: null,
        newValue: 'SN-12345' as PropertyValue,
        provenance,
        changedBy: testIdentity,
        changedAt: now,
      })

      expect(payload.key).toBe('serialNumber')
      expect(payload.previousValue).toBeNull()
      expect(payload.newValue).toBe('SN-12345')
    })

    it('PropertyRemovedPayload tracks removal', () => {
      const payload = new PropertyRemovedPayload({
        assetId: testAssetId,
        key: 'serialNumber' as PropertyKey,
        removedValue: 'SN-12345' as PropertyValue,
        reason: 'Data correction',
        removedBy: testIdentity,
        removedAt: now,
      })

      expect(payload.key).toBe('serialNumber')
      expect(payload.removedValue).toBe('SN-12345')
    })

    it('TraitAddedPayload accepts config', () => {
      const payload = new TraitAddedPayload({
        assetId: testAssetId,
        traitId: 'temperature-sensitive' as TraitId,
        config: { minTemp: -20, maxTemp: 40 },
        addedBy: testIdentity,
        addedAt: now,
      })

      expect(payload.traitId).toBe('temperature-sensitive')
      expect(payload.config).toEqual({ minTemp: -20, maxTemp: 40 })
    })

    it('TraitRemovedPayload tracks removal', () => {
      const payload = new TraitRemovedPayload({
        assetId: testAssetId,
        traitId: 'inspectable' as TraitId,
        reason: 'No longer applicable',
        removedBy: testIdentity,
        removedAt: now,
      })

      expect(payload.traitId).toBe('inspectable')
    })

    it('AssetDeletedPayload tracks deletion', () => {
      const payload = new AssetDeletedPayload({
        assetId: testAssetId,
        reason: 'End of life',
        hardDelete: false,
        deletedBy: testIdentity,
        deletedAt: now,
      })

      expect(payload.hardDelete).toBe(false)
      expect(payload.reason).toBe('End of life')
    })
  })

  describe('Event Group', () => {
    it('AssetEvents is an EventGroup', () => {
      // EventGroup has events record
      expect(AssetEvents.events).toBeDefined()
      expect(typeof AssetEvents.events).toBe('object')
    })

    it('AssetEvents contains all events', () => {
      const events = AssetEvents.events
      expect(events.AssetCreated).toBeDefined()
      expect(events.AssetUpdated).toBeDefined()
      expect(events.AssetMoved).toBeDefined()
      expect(events.PropertyChanged).toBeDefined()
      expect(events.PropertyRemoved).toBeDefined()
      expect(events.TraitAdded).toBeDefined()
      expect(events.TraitRemoved).toBeDefined()
      expect(events.AssetDeleted).toBeDefined()
    })

    it('events have primaryKey functions', () => {
      const events = AssetEvents.events
      // Each event in the group should have a primaryKey function
      expect(typeof events.AssetCreated.primaryKey).toBe('function')
      expect(typeof events.AssetUpdated.primaryKey).toBe('function')
      expect(typeof events.AssetMoved.primaryKey).toBe('function')
      expect(typeof events.PropertyChanged.primaryKey).toBe('function')
      expect(typeof events.PropertyRemoved.primaryKey).toBe('function')
      expect(typeof events.TraitAdded.primaryKey).toBe('function')
      expect(typeof events.TraitRemoved.primaryKey).toBe('function')
      expect(typeof events.AssetDeleted.primaryKey).toBe('function')
    })
  })

  describe('Payload Encoding/Decoding', () => {
    it.effect('AssetCreatedPayload roundtrip', () =>
      Effect.gen(function* () {
        const payload = new AssetCreatedPayload({
          assetId: testAssetId,
          siteId: 'site-01' as SiteId,
          kind: 'EQUIPMENT' as AssetKind,
          label: 'Test' as AssetLabel,
          status: 'available' as AssetStatus,
          createdBy: testIdentity,
          createdAt: now,
        })

        const encoded = yield* Schema.encode(AssetCreatedPayload)(payload)
        expect(encoded).toBeDefined()

        const decoded = yield* Schema.decode(AssetCreatedPayload)(encoded)
        expect(decoded.assetId).toBe('asset-001')
      })
    )

    it.effect('PropertyChangedPayload roundtrip with provenance', () =>
      Effect.gen(function* () {
        const provenance = new Provenance({
          sourceType: 'sensor' as SourceType,
          timestamp: now,
          confidence: 0.95 as never,
        })

        const payload = new PropertyChangedPayload({
          assetId: testAssetId,
          key: 'temperature' as PropertyKey,
          previousValue: '20' as PropertyValue,
          newValue: '25' as PropertyValue,
          provenance,
          changedBy: testIdentity,
          changedAt: now,
        })

        const encoded = yield* Schema.encode(PropertyChangedPayload)(payload)
        const decoded = yield* Schema.decode(PropertyChangedPayload)(encoded)

        expect(decoded.key).toBe('temperature')
        expect(decoded.provenance.sourceType).toBe('sensor')
      })
    )
  })
})
