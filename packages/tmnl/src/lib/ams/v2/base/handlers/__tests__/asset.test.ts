/**
 * Asset Entity Handler Integration Tests
 *
 * Tests the full Entity handler flow using Entity.makeTestClient.
 * Uses in-memory AssetState via DI.
 */

import { describe, it, expect } from '@effect/vitest'
import { DateTime, Effect, Layer } from 'effect'
import { Entity, ShardingConfig } from '@effect/cluster'
import { AssetEntity, AssetEntityLayer, AssetEntityHandlers } from '../asset'
import { AssetState } from '../../services/asset-state'
import {
  AssetId,
  AssetKind,
  AssetLabel,
  SiteId,
  SectorId,
  IdentityId,
  PropertyKey,
  TraitId,
} from '../../../core/schemas/identifiers'
import { PropertyValue } from '../../schemas/property'
import { Provenance, SourceType } from '../../../core/schemas/provenance'
import { CreatedAt } from '../../../core/schemas/timestamps'

// ─────────────────────────────────────────────────────────────────────────────
// Test Configuration
// ─────────────────────────────────────────────────────────────────────────────

const TestShardingConfig = ShardingConfig.layer({
  shardsPerGroup: 10,
  entityMailboxCapacity: 10,
  entityTerminationTimeout: 0,
  entityMessagePollInterval: 5000,
  sendRetryInterval: 100,
})

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

const testSiteId = 'site-test-001' as SiteId
const testSectorId = 'sector-test-001' as SectorId
const testKind = 'EQUIPMENT' as AssetKind
const testLabel = 'Test Forklift #1' as AssetLabel
const testIdentity = 'user-test-001' as IdentityId
const testPropertyKey = 'serial_number' as PropertyKey
const testTraitId = 'trait-temperature-sensor' as TraitId

const testProvenance = new Provenance({
  sourceType: 'manual' as SourceType,
  timestamp: DateTime.unsafeNow() as CreatedAt,
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Asset Entity Handlers', () => {
  describe('Command Handlers', () => {
    it.scoped('CreateAsset creates a new asset', () =>
      Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(AssetEntity, AssetEntityLayer)
        const client = yield* makeClient('test-entity-1')

        const asset = yield* client.CreateAsset({
          siteId: testSiteId,
          kind: testKind,
          label: testLabel,
          createdBy: testIdentity,
        })

        expect(asset._tag).toBe('Asset')
        expect(asset.kind).toBe(testKind)
        expect(asset.label).toBe(testLabel)
        expect(asset.siteId).toBe(testSiteId)
        expect(asset.status).toBe('available')
        expect(asset.id).toBeDefined()
      }).pipe(Effect.provide(TestShardingConfig))
    )

    it.scoped('UpdateAsset updates asset metadata', () =>
      Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(AssetEntity, AssetEntityLayer)
        const client = yield* makeClient('test-entity-2')

        // Create first
        const created = yield* client.CreateAsset({
          siteId: testSiteId,
          kind: testKind,
          label: testLabel,
          createdBy: testIdentity,
        })

        // Update
        const newLabel = 'Updated Forklift #1' as AssetLabel
        const updated = yield* client.UpdateAsset({
          assetId: created.id,
          label: newLabel,
          updatedBy: testIdentity,
        })

        expect(updated.label).toBe(newLabel)
        expect(updated.id).toBe(created.id)
      }).pipe(Effect.provide(TestShardingConfig))
    )

    it.scoped('MoveAsset changes asset location', () =>
      Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(AssetEntity, AssetEntityLayer)
        const client = yield* makeClient('test-entity-3')

        // Create
        const created = yield* client.CreateAsset({
          siteId: testSiteId,
          kind: testKind,
          label: testLabel,
          createdBy: testIdentity,
        })

        // Move
        const newSiteId = 'site-new-001' as SiteId
        const moved = yield* client.MoveAsset({
          assetId: created.id,
          toSiteId: newSiteId,
          toSectorId: testSectorId,
          movedBy: testIdentity,
        })

        expect(moved.siteId).toBe(newSiteId)
        expect(moved.sectorId).toBe(testSectorId)
      }).pipe(Effect.provide(TestShardingConfig))
    )

    it.scoped('SetAssetProperty sets a property', () =>
      Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(AssetEntity, AssetEntityLayer)
        const client = yield* makeClient('test-entity-4')

        // Create
        const created = yield* client.CreateAsset({
          siteId: testSiteId,
          kind: testKind,
          label: testLabel,
          createdBy: testIdentity,
        })

        // Set property
        yield* client.SetAssetProperty({
          assetId: created.id,
          key: testPropertyKey,
          value: 'SN-12345' as PropertyValue,
          provenance: testProvenance,
          changedBy: testIdentity,
        })

        // Get property
        const prop = yield* client.GetAssetProperty({
          assetId: created.id,
          key: testPropertyKey,
        })

        expect(prop.key).toBe(testPropertyKey)
        expect(prop.value).toBe('SN-12345')
      }).pipe(Effect.provide(TestShardingConfig))
    )

    it.scoped('AddAssetTrait adds a trait', () =>
      Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(AssetEntity, AssetEntityLayer)
        const client = yield* makeClient('test-entity-5')

        // Create
        const created = yield* client.CreateAsset({
          siteId: testSiteId,
          kind: testKind,
          label: testLabel,
          createdBy: testIdentity,
        })

        // Add trait (should not fail)
        yield* client.AddAssetTrait({
          assetId: created.id,
          traitId: testTraitId,
          config: { threshold: 25 },
          addedBy: testIdentity,
        })

        // Verify asset still exists
        const asset = yield* client.GetAsset({ assetId: created.id })
        expect(asset._tag).toBe('Asset')
      }).pipe(Effect.provide(TestShardingConfig))
    )

    it.scoped('DeleteAsset soft deletes (retires) asset', () =>
      Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(AssetEntity, AssetEntityLayer)
        const client = yield* makeClient('test-entity-6')

        // Create
        const created = yield* client.CreateAsset({
          siteId: testSiteId,
          kind: testKind,
          label: testLabel,
          createdBy: testIdentity,
        })

        // Soft delete
        yield* client.DeleteAsset({
          assetId: created.id,
          deletedBy: testIdentity,
        })

        // Should still exist but be retired
        const asset = yield* client.GetAsset({ assetId: created.id })
        expect(asset.status).toBe('retired')
      }).pipe(Effect.provide(TestShardingConfig))
    )
  })

  describe('Query Handlers', () => {
    it.scoped('GetAsset retrieves an asset by ID', () =>
      Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(AssetEntity, AssetEntityLayer)
        const client = yield* makeClient('test-entity-7')

        // Create
        const created = yield* client.CreateAsset({
          siteId: testSiteId,
          kind: testKind,
          label: testLabel,
          createdBy: testIdentity,
        })

        // Get
        const asset = yield* client.GetAsset({ assetId: created.id })

        expect(asset._tag).toBe('Asset')
        expect(asset.id).toBe(created.id)
        expect(asset.label).toBe(testLabel)
      }).pipe(Effect.provide(TestShardingConfig))
    )

    it.scoped('GetAssetSummary retrieves a lightweight summary', () =>
      Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(AssetEntity, AssetEntityLayer)
        const client = yield* makeClient('test-entity-8')

        // Create
        const created = yield* client.CreateAsset({
          siteId: testSiteId,
          kind: testKind,
          label: testLabel,
          createdBy: testIdentity,
        })

        // Get summary
        const summary = yield* client.GetAssetSummary({ assetId: created.id })

        expect(summary._tag).toBe('AssetSummary')
        expect(summary.id).toBe(created.id)
        expect(summary.label).toBe(testLabel)
        expect(summary.siteId).toBe(testSiteId)
      }).pipe(Effect.provide(TestShardingConfig))
    )

    it.scoped('AssetExists returns true for existing asset', () =>
      Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(AssetEntity, AssetEntityLayer)
        const client = yield* makeClient('test-entity-9')

        // Create
        const created = yield* client.CreateAsset({
          siteId: testSiteId,
          kind: testKind,
          label: testLabel,
          createdBy: testIdentity,
        })

        // Check exists
        const exists = yield* client.AssetExists({ assetId: created.id })
        expect(exists).toBe(true)

        // Check non-existent
        const notExists = yield* client.AssetExists({ assetId: 'asset-nonexistent' as AssetId })
        expect(notExists).toBe(false)
      }).pipe(Effect.provide(TestShardingConfig))
    )

    it.scoped('ListAssetsBySite returns paginated results', () =>
      Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(AssetEntity, AssetEntityLayer)
        const client = yield* makeClient('test-entity-10')

        // Create some assets
        yield* client.CreateAsset({
          siteId: testSiteId,
          kind: testKind,
          label: 'Asset 1' as AssetLabel,
          createdBy: testIdentity,
        })
        yield* client.CreateAsset({
          siteId: testSiteId,
          kind: testKind,
          label: 'Asset 2' as AssetLabel,
          createdBy: testIdentity,
        })

        // List
        const result = yield* client.ListAssetsBySite({
          siteId: testSiteId,
          limit: 10,
        })

        expect(result._tag).toBe('PaginatedAssets')
        expect(result.items.length).toBeGreaterThanOrEqual(2)
        expect(result.pageInfo._tag).toBe('PageInfo')
      }).pipe(Effect.provide(TestShardingConfig))
    )

    it.scoped('SearchAssets filters by criteria', () =>
      Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(AssetEntity, AssetEntityLayer)
        const client = yield* makeClient('test-entity-11')

        // Create assets
        yield* client.CreateAsset({
          siteId: testSiteId,
          kind: 'EQUIPMENT' as AssetKind,
          label: 'Forklift ABC' as AssetLabel,
          createdBy: testIdentity,
        })
        yield* client.CreateAsset({
          siteId: testSiteId,
          kind: 'CONTAINER' as AssetKind,
          label: 'Pallet XYZ' as AssetLabel,
          createdBy: testIdentity,
        })

        // Search by kind
        const result = yield* client.SearchAssets({
          siteId: testSiteId,
          kind: 'EQUIPMENT' as AssetKind,
          limit: 10,
        })

        expect(result._tag).toBe('PaginatedAssets')
        // All results should be EQUIPMENT
        for (const item of result.items) {
          expect(item.kind).toBe('EQUIPMENT')
        }
      }).pipe(Effect.provide(TestShardingConfig))
    )

    it.scoped('CountAssetsBySite returns correct count', () =>
      Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(AssetEntity, AssetEntityLayer)
        const client = yield* makeClient('test-entity-12')

        // Create assets
        yield* client.CreateAsset({
          siteId: testSiteId,
          kind: testKind,
          label: 'Count Test 1' as AssetLabel,
          createdBy: testIdentity,
        })
        yield* client.CreateAsset({
          siteId: testSiteId,
          kind: testKind,
          label: 'Count Test 2' as AssetLabel,
          createdBy: testIdentity,
        })

        // Count
        const count = yield* client.CountAssetsBySite({ siteId: testSiteId })
        expect(count).toBeGreaterThanOrEqual(2)
      }).pipe(Effect.provide(TestShardingConfig))
    )
  })

  describe('Error Handling', () => {
    it.scoped('GetAsset fails for non-existent asset', () =>
      Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(AssetEntity, AssetEntityLayer)
        const client = yield* makeClient('test-entity-13')

        const result = yield* client
          .GetAsset({ assetId: 'asset-does-not-exist' as AssetId })
          .pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('AssetNotFoundError')
        }
      }).pipe(Effect.provide(TestShardingConfig))
    )

    it.scoped('UpdateAsset fails with version conflict', () =>
      Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(AssetEntity, AssetEntityLayer)
        const client = yield* makeClient('test-entity-14')

        // Create
        const created = yield* client.CreateAsset({
          siteId: testSiteId,
          kind: testKind,
          label: testLabel,
          createdBy: testIdentity,
        })

        // Update with wrong version
        const result = yield* client
          .UpdateAsset({
            assetId: created.id,
            label: 'Should Fail' as AssetLabel,
            expectedVersion: 999,
            updatedBy: testIdentity,
          })
          .pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('AssetConflictError')
        }
      }).pipe(Effect.provide(TestShardingConfig))
    )
  })
})
