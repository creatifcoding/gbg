/**
 * SQLite Repository Integration Tests
 *
 * Tests actual CRUD operations against in-memory SQLite.
 * Uses SqliteTestLayer for database setup and migrations.
 *
 * NOTE: These tests require bun runtime (bun test) because @effect/sql-sqlite-bun
 * uses bun:sqlite which is not available in Node.js/vitest.
 *
 * Run with: bun test src/lib/ams/v2/base/repositories/__tests__/sqlite-integration.test.ts
 *
 * @module @gbg/tmnl/ams/v2/base/repositories/__tests__/sqlite-integration.test.ts
 */

import { describe, test, expect } from 'bun:test'
import { Effect, Option } from 'effect'

import { SqliteTestLayer } from '../sqlite-layer'
import {
  makeAssetRepository,
  makeSiteRepository,
  makeSectorRepository,
  makeContainerRepository,
  makeAssetPropertyRepository,
  makeAssetTraitRepository,
  makeEventJournalRepository,
  AssetModel,
  SiteModel,
  SectorModel,
  ContainerModel,
  AssetPropertyModel,
  AssetTraitModel,
  EventJournalModel,
} from '../asset'
import { AssetId, SiteId, SectorId, ContainerId } from '../../../core/schemas/identifiers'

// Helper to run Effect with SqliteTestLayer
const runTest = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(effect.pipe(Effect.provide(SqliteTestLayer)))

// ─────────────────────────────────────────────────────────────────────────────
// Site Repository Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Site Repository Integration', () => {
  test('inserts and retrieves a site', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* makeSiteRepository

        const site = yield* repo.insert(
          SiteModel.insert.make({
            id: 'site-001' as SiteId,
            bfoClass: 'site',
            name: 'Main Warehouse',
            geoFrameJson: Option.none(),
          })
        )

        expect(site.id).toBe('site-001')
        expect(site.name).toBe('Main Warehouse')
        expect(site.bfoClass).toBe('site')

        const foundOption = yield* repo.findById('site-001' as SiteId)
        const found = Option.getOrThrow(foundOption)
        expect(found.name).toBe('Main Warehouse')
      })
    )
  })

  test('updates a site', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* makeSiteRepository

        const site = yield* repo.insert(
          SiteModel.insert.make({
            id: 'site-update-001' as SiteId,
            bfoClass: 'site',
            name: 'Old Name',
            geoFrameJson: Option.none(),
          })
        )

        const updated = yield* repo.update({
          ...site,
          name: 'New Name',
        })

        expect(updated.name).toBe('New Name')
      })
    )
  })

  test('deletes a site', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* makeSiteRepository

        yield* repo.insert(
          SiteModel.insert.make({
            id: 'site-delete-001' as SiteId,
            bfoClass: 'site',
            name: 'To Delete',
            geoFrameJson: Option.none(),
          })
        )

        yield* repo.delete('site-delete-001' as SiteId)

        const result = yield* repo.findById('site-delete-001' as SiteId)
        expect(Option.isNone(result)).toBe(true)
      })
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Sector Repository Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Sector Repository Integration', () => {
  test('inserts and retrieves a sector', async () => {
    await runTest(
      Effect.gen(function* () {
        const siteRepo = yield* makeSiteRepository
        const sectorRepo = yield* makeSectorRepository

        // Create parent site first
        yield* siteRepo.insert(
          SiteModel.insert.make({
            id: 'site-for-sector' as SiteId,
            bfoClass: 'site',
            name: 'Site for Sector',
            geoFrameJson: Option.none(),
          })
        )

        const sector = yield* sectorRepo.insert(
          SectorModel.insert.make({
            id: 'sector-001' as SectorId,
            bfoClass: 'spatial_region',
            siteId: 'site-for-sector' as SiteId,
            sectorTypeId: 'zone',
            name: 'Zone A',
            footprintJson: Option.none(),
          })
        )

        expect(sector.id).toBe('sector-001')
        expect(sector.siteId).toBe('site-for-sector')
        expect(sector.name).toBe('Zone A')

        const found = Option.getOrThrow(yield* sectorRepo.findById('sector-001' as SectorId))
        expect(found.sectorTypeId).toBe('zone')
      })
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Container Repository Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Container Repository Integration', () => {
  test('inserts and retrieves a container', async () => {
    await runTest(
      Effect.gen(function* () {
        const siteRepo = yield* makeSiteRepository
        const containerRepo = yield* makeContainerRepository

        // Create parent site first
        yield* siteRepo.insert(
          SiteModel.insert.make({
            id: 'site-for-container' as SiteId,
            bfoClass: 'site',
            name: 'Site for Container',
            geoFrameJson: Option.none(),
          })
        )

        const container = yield* containerRepo.insert(
          ContainerModel.insert.make({
            id: 'container-001' as ContainerId,
            bfoClass: 'object',
            siteId: 'site-for-container' as SiteId,
            sectorId: Option.none(),
            containerTypeId: 'rack',
            label: 'Rack 01',
            parentContainerId: Option.none(),
            isMobile: false,
          })
        )

        expect(container.id).toBe('container-001')
        expect(container.label).toBe('Rack 01')
        expect(container.isMobile).toBe(false)

        const found = Option.getOrThrow(yield* containerRepo.findById('container-001' as ContainerId))
        expect(found.containerTypeId).toBe('rack')
      })
    )
  })

  test('supports nested containers', async () => {
    await runTest(
      Effect.gen(function* () {
        const siteRepo = yield* makeSiteRepository
        const containerRepo = yield* makeContainerRepository

        yield* siteRepo.insert(
          SiteModel.insert.make({
            id: 'site-nested' as SiteId,
            bfoClass: 'site',
            name: 'Site for Nested',
            geoFrameJson: Option.none(),
          })
        )

        // Parent container (rack)
        yield* containerRepo.insert(
          ContainerModel.insert.make({
            id: 'rack-parent' as ContainerId,
            bfoClass: 'object',
            siteId: 'site-nested' as SiteId,
            sectorId: Option.none(),
            containerTypeId: 'rack',
            label: 'Rack Parent',
            parentContainerId: Option.none(),
            isMobile: false,
          })
        )

        // Child container (shelf)
        const shelf = yield* containerRepo.insert(
          ContainerModel.insert.make({
            id: 'shelf-child' as ContainerId,
            bfoClass: 'object',
            siteId: 'site-nested' as SiteId,
            sectorId: Option.none(),
            containerTypeId: 'shelf',
            label: 'Shelf A1',
            parentContainerId: Option.some('rack-parent' as ContainerId),
            isMobile: false,
          })
        )

        expect(Option.getOrNull(shelf.parentContainerId)).toBe('rack-parent')
      })
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Asset Repository Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Asset Repository Integration', () => {
  test('inserts and retrieves an asset', async () => {
    await runTest(
      Effect.gen(function* () {
        const siteRepo = yield* makeSiteRepository
        const assetRepo = yield* makeAssetRepository

        // Create parent site first
        yield* siteRepo.insert(
          SiteModel.insert.make({
            id: 'site-for-asset' as SiteId,
            bfoClass: 'site',
            name: 'Site for Asset',
            geoFrameJson: Option.none(),
          })
        )

        const asset = yield* assetRepo.insert(
          AssetModel.insert.make({
            id: 'asset-001' as AssetId,
            bfoClass: 'material_entity',
            kind: 'EQUIPMENT' as never,
            label: 'Forklift #1' as never,
            description: Option.some('Electric forklift' as never),
            status: 'available' as never,
            siteId: 'site-for-asset' as SiteId,
            sectorId: Option.none(),
            containerId: Option.none(),
            basePropertiesJson: Option.none(),
            tagsJson: Option.some(['forklift', 'electric'] as never),
            version: 1,
          })
        )

        expect(asset.id).toBe('asset-001')
        expect(asset.kind).toBe('EQUIPMENT')
        expect(asset.label).toBe('Forklift #1')
        expect(asset.status).toBe('available')
        expect(asset.version).toBe(1)

        const found = Option.getOrThrow(yield* assetRepo.findById('asset-001' as AssetId))
        expect(found.kind).toBe('EQUIPMENT')
        expect(Option.getOrNull(found.description)).toBe('Electric forklift')
      })
    )
  })

  test('updates an asset with version increment', async () => {
    await runTest(
      Effect.gen(function* () {
        const siteRepo = yield* makeSiteRepository
        const assetRepo = yield* makeAssetRepository

        yield* siteRepo.insert(
          SiteModel.insert.make({
            id: 'site-for-update' as SiteId,
            bfoClass: 'site',
            name: 'Site for Update',
            geoFrameJson: Option.none(),
          })
        )

        const asset = yield* assetRepo.insert(
          AssetModel.insert.make({
            id: 'asset-update-001' as AssetId,
            bfoClass: 'material_entity',
            kind: 'HAND_TOOL' as never,
            label: 'Hammer' as never,
            description: Option.none(),
            status: 'available' as never,
            siteId: 'site-for-update' as SiteId,
            sectorId: Option.none(),
            containerId: Option.none(),
            basePropertiesJson: Option.none(),
            tagsJson: Option.none(),
            version: 1,
          })
        )

        const updated = yield* assetRepo.update({
          ...asset,
          label: 'Updated Hammer' as never,
          version: 2,
        })

        expect(updated.label).toBe('Updated Hammer')
        expect(updated.version).toBe(2)
      })
    )
  })

  test('deletes an asset', async () => {
    await runTest(
      Effect.gen(function* () {
        const siteRepo = yield* makeSiteRepository
        const assetRepo = yield* makeAssetRepository

        yield* siteRepo.insert(
          SiteModel.insert.make({
            id: 'site-for-delete' as SiteId,
            bfoClass: 'site',
            name: 'Site for Delete',
            geoFrameJson: Option.none(),
          })
        )

        yield* assetRepo.insert(
          AssetModel.insert.make({
            id: 'asset-delete-001' as AssetId,
            bfoClass: 'material_entity',
            kind: 'EQUIPMENT' as never,
            label: 'To Delete' as never,
            description: Option.none(),
            status: 'available' as never,
            siteId: 'site-for-delete' as SiteId,
            sectorId: Option.none(),
            containerId: Option.none(),
            basePropertiesJson: Option.none(),
            tagsJson: Option.none(),
            version: 1,
          })
        )

        yield* assetRepo.delete('asset-delete-001' as AssetId)

        const result = yield* assetRepo.findById('asset-delete-001' as AssetId)
        expect(Option.isNone(result)).toBe(true)
      })
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Asset Property Repository Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Asset Property Repository Integration', () => {
  test('inserts and retrieves a property', async () => {
    await runTest(
      Effect.gen(function* () {
        const siteRepo = yield* makeSiteRepository
        const assetRepo = yield* makeAssetRepository
        const propRepo = yield* makeAssetPropertyRepository

        yield* siteRepo.insert(
          SiteModel.insert.make({
            id: 'site-for-prop' as SiteId,
            bfoClass: 'site',
            name: 'Site for Prop',
            geoFrameJson: Option.none(),
          })
        )

        yield* assetRepo.insert(
          AssetModel.insert.make({
            id: 'asset-for-prop' as AssetId,
            bfoClass: 'material_entity',
            kind: 'EQUIPMENT' as never,
            label: 'Test Asset' as never,
            description: Option.none(),
            status: 'available' as never,
            siteId: 'site-for-prop' as SiteId,
            sectorId: Option.none(),
            containerId: Option.none(),
            basePropertiesJson: Option.none(),
            tagsJson: Option.none(),
            version: 1,
          })
        )

        const prop = yield* propRepo.insert(
          AssetPropertyModel.insert.make({
            assetId: 'asset-for-prop' as AssetId,
            key: 'serialNumber',
            value: 'SN-12345',
            provenanceJson: {
              sourceType: 'manual',
              timestamp: new Date().toISOString(),
            },
          })
        )

        expect(prop.assetId).toBe('asset-for-prop')
        expect(prop.key).toBe('serialNumber')
        expect(prop.value).toBe('SN-12345')
        expect(prop.id).toBeGreaterThan(0)

        const found = Option.getOrThrow(yield* propRepo.findById(prop.id))
        expect(found.key).toBe('serialNumber')
      })
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Asset Trait Repository Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Asset Trait Repository Integration', () => {
  test('inserts and retrieves a trait', async () => {
    await runTest(
      Effect.gen(function* () {
        const siteRepo = yield* makeSiteRepository
        const assetRepo = yield* makeAssetRepository
        const traitRepo = yield* makeAssetTraitRepository

        yield* siteRepo.insert(
          SiteModel.insert.make({
            id: 'site-for-trait' as SiteId,
            bfoClass: 'site',
            name: 'Site for Trait',
            geoFrameJson: Option.none(),
          })
        )

        yield* assetRepo.insert(
          AssetModel.insert.make({
            id: 'asset-for-trait' as AssetId,
            bfoClass: 'material_entity',
            kind: 'EQUIPMENT' as never,
            label: 'Test Asset' as never,
            description: Option.none(),
            status: 'available' as never,
            siteId: 'site-for-trait' as SiteId,
            sectorId: Option.none(),
            containerId: Option.none(),
            basePropertiesJson: Option.none(),
            tagsJson: Option.none(),
            version: 1,
          })
        )

        const trait = yield* traitRepo.insert(
          AssetTraitModel.insert.make({
            assetId: 'asset-for-trait' as AssetId,
            traitId: 'inspectable',
            configJson: Option.some({ interval: 'monthly' }),
          })
        )

        expect(trait.assetId).toBe('asset-for-trait')
        expect(trait.traitId).toBe('inspectable')
        expect(Option.getOrNull(trait.configJson)).toEqual({ interval: 'monthly' })

        const found = Option.getOrThrow(yield* traitRepo.findById(trait.id))
        expect(found.traitId).toBe('inspectable')
      })
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Event Journal Repository Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Event Journal Repository Integration', () => {
  test('inserts and retrieves an event', async () => {
    await runTest(
      Effect.gen(function* () {
        const journalRepo = yield* makeEventJournalRepository

        const event = yield* journalRepo.insert(
          EventJournalModel.insert.make({
            eventTag: 'AssetCreated',
            primaryKey: 'asset-001',
            payloadJson: {
              assetId: 'asset-001',
              kind: 'EQUIPMENT',
              label: 'Test Asset',
              status: 'available',
              siteId: 'site-001',
              createdBy: 'user-123',
            },
            triggeredBy: 'user-123',
            aggregateVersion: 1,
          })
        )

        expect(event.eventTag).toBe('AssetCreated')
        expect(event.primaryKey).toBe('asset-001')
        expect(event.aggregateVersion).toBe(1)
        expect(event.sequenceNumber).toBeGreaterThan(0)

        const found = Option.getOrThrow(yield* journalRepo.findById(event.sequenceNumber))
        expect(found.eventTag).toBe('AssetCreated')
      })
    )
  })

  test('preserves event ordering', async () => {
    await runTest(
      Effect.gen(function* () {
        const journalRepo = yield* makeEventJournalRepository

        const event1 = yield* journalRepo.insert(
          EventJournalModel.insert.make({
            eventTag: 'AssetCreated',
            primaryKey: 'asset-ordering-001',
            payloadJson: { step: 1 },
            triggeredBy: 'user-123',
            aggregateVersion: 1,
          })
        )

        const event2 = yield* journalRepo.insert(
          EventJournalModel.insert.make({
            eventTag: 'AssetUpdated',
            primaryKey: 'asset-ordering-001',
            payloadJson: { step: 2 },
            triggeredBy: 'user-123',
            aggregateVersion: 2,
          })
        )

        const event3 = yield* journalRepo.insert(
          EventJournalModel.insert.make({
            eventTag: 'PropertyChanged',
            primaryKey: 'asset-ordering-001',
            payloadJson: { step: 3 },
            triggeredBy: 'user-123',
            aggregateVersion: 3,
          })
        )

        // Verify sequence numbers are in order
        expect(event2.sequenceNumber).toBeGreaterThan(event1.sequenceNumber)
        expect(event3.sequenceNumber).toBeGreaterThan(event2.sequenceNumber)
      })
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Cross-Repository Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Cross-Repository Integration', () => {
  test('creates complete asset hierarchy', async () => {
    await runTest(
      Effect.gen(function* () {
        const siteRepo = yield* makeSiteRepository
        const sectorRepo = yield* makeSectorRepository
        const containerRepo = yield* makeContainerRepository
        const assetRepo = yield* makeAssetRepository
        const propRepo = yield* makeAssetPropertyRepository
        const traitRepo = yield* makeAssetTraitRepository

        // 1. Create site
        yield* siteRepo.insert(
          SiteModel.insert.make({
            id: 'site-hierarchy' as SiteId,
            bfoClass: 'site',
            name: 'Hierarchy Test Site',
            geoFrameJson: Option.none(),
          })
        )

        // 2. Create sector
        yield* sectorRepo.insert(
          SectorModel.insert.make({
            id: 'sector-hierarchy' as SectorId,
            bfoClass: 'spatial_region',
            siteId: 'site-hierarchy' as SiteId,
            sectorTypeId: 'zone',
            name: 'Zone A',
            footprintJson: Option.none(),
          })
        )

        // 3. Create container
        yield* containerRepo.insert(
          ContainerModel.insert.make({
            id: 'container-hierarchy' as ContainerId,
            bfoClass: 'object',
            siteId: 'site-hierarchy' as SiteId,
            sectorId: Option.some('sector-hierarchy' as SectorId),
            containerTypeId: 'rack',
            label: 'Rack 01',
            parentContainerId: Option.none(),
            isMobile: false,
          })
        )

        // 4. Create asset in container
        const asset = yield* assetRepo.insert(
          AssetModel.insert.make({
            id: 'asset-hierarchy' as AssetId,
            bfoClass: 'material_entity',
            kind: 'EQUIPMENT' as never,
            label: 'Forklift' as never,
            description: Option.none(),
            status: 'available' as never,
            siteId: 'site-hierarchy' as SiteId,
            sectorId: Option.some('sector-hierarchy' as SectorId),
            containerId: Option.some('container-hierarchy' as ContainerId),
            basePropertiesJson: Option.none(),
            tagsJson: Option.none(),
            version: 1,
          })
        )

        // 5. Add properties
        yield* propRepo.insert(
          AssetPropertyModel.insert.make({
            assetId: 'asset-hierarchy' as AssetId,
            key: 'serialNumber',
            value: 'SN-HIER-001',
            provenanceJson: { sourceType: 'manual', timestamp: new Date().toISOString() },
          })
        )

        yield* propRepo.insert(
          AssetPropertyModel.insert.make({
            assetId: 'asset-hierarchy' as AssetId,
            key: 'manufacturer',
            value: 'Toyota',
            provenanceJson: { sourceType: 'manual', timestamp: new Date().toISOString() },
          })
        )

        // 6. Add traits
        yield* traitRepo.insert(
          AssetTraitModel.insert.make({
            assetId: 'asset-hierarchy' as AssetId,
            traitId: 'inspectable',
            configJson: Option.some({ interval: 'weekly' }),
          })
        )

        // Verify the complete hierarchy
        expect(asset.siteId).toBe('site-hierarchy')
        expect(Option.getOrNull(asset.sectorId)).toBe('sector-hierarchy')
        expect(Option.getOrNull(asset.containerId)).toBe('container-hierarchy')

        // Verify asset can be retrieved
        const foundAsset = Option.getOrThrow(yield* assetRepo.findById('asset-hierarchy' as AssetId))
        expect(foundAsset.label).toBe('Forklift')
      })
    )
  })
})
