/**
 * Asset Schema Unit Tests
 */

import { describe, it, expect } from '@effect/vitest'
import { Effect, Schema, DateTime } from 'effect'
import {
  Asset,
  AssetStatus,
  AssetSummary,
  BaseAssetProperties,
} from '../asset'
import { AssetLocation } from '../location'
import { AssetProperty, AssetProperties } from '../property'
import { AssetTraits, TraitInstance } from '../trait'
import { Provenance, SourceType, CreatedAt, Confidence } from '../../../core/schemas/provenance'
import {
  AssetId,
  AssetKind,
  AssetLabel,
  SiteId,
  SectorId,
  PropertyKey,
  TraitId,
  Tags,
  Tag,
} from '../../../core/schemas/identifiers'
import { BfoMaterialEntity } from '../../../core/schemas/bfo'
import { UpdatedAt } from '../../../core/schemas/timestamps'

describe('Asset Schema', () => {
  const now = DateTime.unsafeNow()

  // Helper to create valid test data
  const makeTestAsset = () =>
    new Asset({
      id: 'asset-001' as AssetId,
      bfoClass: 'material_entity' as BfoMaterialEntity,
      kind: 'HAND_TOOL' as AssetKind,
      label: '16oz Claw Hammer' as AssetLabel,
      status: 'available' as AssetStatus,
      location: new AssetLocation({
        siteId: 'site-01' as SiteId,
        sectorId: 'sector-A' as SectorId,
      }),
      baseProperties: new BaseAssetProperties({
        quantity: 1,
        weightKg: 0.8,
        dimensionsMm: { l: 330, w: 120, h: 30 },
      }),
      properties: [] as unknown as AssetProperties,
      traits: [] as unknown as AssetTraits,
      tags: ['hand-tool', 'steel'] as unknown as Tags,
      createdAt: now as CreatedAt,
      updatedAt: now as UpdatedAt,
    })

  describe('Asset', () => {
    it('creates Asset instance with _tag', () => {
      const asset = makeTestAsset()
      expect(asset._tag).toBe('Asset')
      expect(asset.id).toBe('asset-001')
      expect(asset.label).toBe('16oz Claw Hammer')
    })

    it('isOperational returns true for available asset', () => {
      const asset = makeTestAsset()
      expect(asset.isOperational()).toBe(true)
      expect(asset.isAvailable()).toBe(true)
    })

    it('isOperational returns false for maintenance status', () => {
      const asset = new Asset({
        ...makeTestAsset(),
        status: 'maintenance' as AssetStatus,
      })
      expect(asset.isOperational()).toBe(false)
      expect(asset.isAvailable()).toBe(false)
    })

    it('isOperational returns false for retired status', () => {
      const asset = new Asset({
        ...makeTestAsset(),
        status: 'retired' as AssetStatus,
      })
      expect(asset.isOperational()).toBe(false)
    })

    it('exposes siteId getter', () => {
      const asset = makeTestAsset()
      expect(asset.siteId).toBe('site-01')
    })

    it('exposes sectorId getter', () => {
      const asset = makeTestAsset()
      expect(asset.sectorId).toBe('sector-A')
    })

    it.effect('encodes and decodes Asset', () =>
      Effect.gen(function* () {
        const asset = makeTestAsset()
        const encoded = yield* Schema.encode(Asset)(asset)
        expect(encoded).toBeDefined()
        expect(typeof encoded).toBe('object')

        const decoded = yield* Schema.decode(Asset)(encoded)
        expect(decoded._tag).toBe('Asset')
        expect(decoded.id).toBe('asset-001')
        expect(decoded.label).toBe('16oz Claw Hammer')
      })
    )
  })

  describe('AssetStatus', () => {
    it.effect('accepts valid status values', () =>
      Effect.gen(function* () {
        const validStatuses = ['available', 'reserved', 'in_transit', 'maintenance', 'retired']
        for (const status of validStatuses) {
          const decoded = yield* Schema.decodeUnknown(AssetStatus)(status)
          expect(decoded).toBe(status)
        }
      })
    )

    it.effect('rejects invalid status', () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(AssetStatus)('invalid').pipe(Effect.either)
        expect(result._tag).toBe('Left')
      })
    )
  })

  describe('BaseAssetProperties', () => {
    it('creates instance with _tag', () => {
      const props = new BaseAssetProperties({
        quantity: 5,
        weightKg: 2.5,
      })
      expect(props._tag).toBe('BaseAssetProperties')
      expect(props.quantity).toBe(5)
      expect(props.weightKg).toBe(2.5)
    })

    it('volumeMm3 returns undefined without dimensions', () => {
      const props = new BaseAssetProperties({ quantity: 1 })
      expect(props.volumeMm3()).toBeUndefined()
    })

    it('volumeMm3 calculates correctly with dimensions', () => {
      const props = new BaseAssetProperties({
        quantity: 1,
        dimensionsMm: { l: 100, w: 50, h: 20 },
      })
      expect(props.volumeMm3()).toBe(100000) // 100 * 50 * 20
    })
  })

  describe('AssetSummary', () => {
    it('creates lightweight projection', () => {
      const summary = new AssetSummary({
        id: 'asset-001' as AssetId,
        kind: 'HAND_TOOL' as AssetKind,
        label: 'Hammer' as AssetLabel,
        status: 'available' as AssetStatus,
        siteId: 'site-01' as SiteId,
      })
      expect(summary._tag).toBe('AssetSummary')
      expect(summary.id).toBe('asset-001')
    })

    it.effect('encodes and decodes AssetSummary', () =>
      Effect.gen(function* () {
        const summary = new AssetSummary({
          id: 'asset-001' as AssetId,
          kind: 'HAND_TOOL' as AssetKind,
          label: 'Hammer' as AssetLabel,
          status: 'available' as AssetStatus,
          siteId: 'site-01' as SiteId,
          sectorId: 'sector-A' as SectorId,
        })

        const encoded = yield* Schema.encode(AssetSummary)(summary)
        const decoded = yield* Schema.decode(AssetSummary)(encoded)
        expect(decoded._tag).toBe('AssetSummary')
        expect(decoded.sectorId).toBe('sector-A')
      })
    )
  })
})
