/**
 * Repository Services DI Wiring Tests
 *
 * Validates that Effect.Service-based repositories correctly wire
 * with SqlClient via Layer composition.
 *
 * @module @gbg/tmnl/ams/v2/base/services/__tests__/repositories.bun.test
 */

import { describe, test, expect } from 'bun:test'
import { Effect, Option, Layer } from 'effect'
import {
  AssetRepository,
  SiteRepository,
  ContainerRepository,
  AssetPropertyRepository,
  AssetTraitRepository,
  EventJournalRepository,
  AllRepositoriesLive,
} from '../repositories'
import {
  AssetModel,
  SiteModel,
  ContainerModel,
  AssetPropertyModel,
  AssetTraitModel,
  EventJournalModel,
} from '../../repositories/asset'
import { SqliteTestLayer } from '../../repositories/sqlite-layer'
import { AssetId, SiteId, ContainerId } from '../../../core/schemas/identifiers'
import { AssetStatus } from '../../schemas/asset'

// ─────────────────────────────────────────────────────────────────────────────
// Test Layer Composition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full test layer with all repositories + SQLite
 *
 * This validates the DI wiring:
 * AllRepositoriesLive → SqlClient.SqlClient → SqliteTestLayer
 */
const TestLayer = AllRepositoriesLive.pipe(Layer.provide(SqliteTestLayer))

/**
 * Helper to run Effect in test context
 */
const runTest = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)))

// ─────────────────────────────────────────────────────────────────────────────
// DI Wiring Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Repository Services (DI Wiring)', () => {
  describe('Layer Composition', () => {
    test('AllRepositoriesLive composes with SqliteTestLayer', async () => {
      await runTest(
        Effect.gen(function* () {
          // Simply yielding the services proves DI wiring works
          const assetRepo = yield* AssetRepository
          const siteRepo = yield* SiteRepository
          const containerRepo = yield* ContainerRepository
          const propertyRepo = yield* AssetPropertyRepository
          const traitRepo = yield* AssetTraitRepository
          const journalRepo = yield* EventJournalRepository

          // Verify we got actual repository objects
          expect(assetRepo).toBeDefined()
          expect(assetRepo.insert).toBeDefined()
          expect(assetRepo.findById).toBeDefined()

          expect(siteRepo).toBeDefined()
          expect(siteRepo.insert).toBeDefined()

          expect(containerRepo).toBeDefined()
          expect(propertyRepo).toBeDefined()
          expect(traitRepo).toBeDefined()
          expect(journalRepo).toBeDefined()
        })
      )
    })
  })

  describe('SiteRepository', () => {
    test('insert and findById via DI', async () => {
      await runTest(
        Effect.gen(function* () {
          const repo = yield* SiteRepository

          const site = yield* repo.insert(
            SiteModel.insert.make({
              id: 'site-di-test' as SiteId,
              bfoClass: 'site',
              name: 'DI Test Site',
              geoFrameJson: Option.none(),
            })
          )

          expect(site.id).toBe('site-di-test')
          expect(site.name).toBe('DI Test Site')

          const found = Option.getOrThrow(yield* repo.findById(site.id))
          expect(found.name).toBe('DI Test Site')
        })
      )
    })
  })

  describe('AssetRepository', () => {
    test('insert and findById via DI', async () => {
      await runTest(
        Effect.gen(function* () {
          const siteRepo = yield* SiteRepository
          const assetRepo = yield* AssetRepository

          // Create prerequisite site
          yield* siteRepo.insert(
            SiteModel.insert.make({
              id: 'site-asset-di' as SiteId,
              bfoClass: 'site',
              name: 'Asset DI Test Site',
              geoFrameJson: Option.none(),
            })
          )

          // Create asset
          const asset = yield* assetRepo.insert(
            AssetModel.insert.make({
              id: 'asset-di-001' as AssetId,
              bfoClass: 'material_entity',
              kind: 'EQUIPMENT' as never,
              label: 'DI Test Asset' as never,
              description: Option.none(),
              status: 'available' as AssetStatus,
              siteId: 'site-asset-di' as SiteId,
              sectorId: Option.none(),
              containerId: Option.none(),
              basePropertiesJson: Option.none(),
              tagsJson: Option.none(),
              version: 1,
            })
          )

          expect(asset.id).toBe('asset-di-001')
          expect(asset.label).toBe('DI Test Asset')

          const found = Option.getOrThrow(yield* assetRepo.findById(asset.id))
          expect(found.kind).toBe('EQUIPMENT')
        })
      )
    })
  })

  describe('ContainerRepository', () => {
    test('insert with parent container via DI', async () => {
      await runTest(
        Effect.gen(function* () {
          const siteRepo = yield* SiteRepository
          const containerRepo = yield* ContainerRepository

          // Create prerequisite site
          yield* siteRepo.insert(
            SiteModel.insert.make({
              id: 'site-container-di' as SiteId,
              bfoClass: 'site',
              name: 'Container DI Test Site',
              geoFrameJson: Option.none(),
            })
          )

          // Create parent container
          const parent = yield* containerRepo.insert(
            ContainerModel.insert.make({
              id: 'container-parent-di' as ContainerId,
              bfoClass: 'object',
              siteId: 'site-container-di' as SiteId,
              sectorId: Option.none(),
              containerTypeId: 'rack',
              label: 'Parent Rack',
              parentContainerId: Option.none(),
              isMobile: false,
            })
          )

          // Create child container
          const child = yield* containerRepo.insert(
            ContainerModel.insert.make({
              id: 'container-child-di' as ContainerId,
              bfoClass: 'object',
              siteId: 'site-container-di' as SiteId,
              sectorId: Option.none(),
              containerTypeId: 'shelf',
              label: 'Child Shelf',
              parentContainerId: Option.some(parent.id),
              isMobile: false,
            })
          )

          expect(child.id).toBe('container-child-di')

          const found = Option.getOrThrow(yield* containerRepo.findById(child.id))
          expect(Option.getOrNull(found.parentContainerId)).toBe('container-parent-di')
        })
      )
    })
  })

  describe('AssetPropertyRepository', () => {
    test('insert EAV property via DI', async () => {
      await runTest(
        Effect.gen(function* () {
          const siteRepo = yield* SiteRepository
          const assetRepo = yield* AssetRepository
          const propertyRepo = yield* AssetPropertyRepository

          // Create prerequisite site
          yield* siteRepo.insert(
            SiteModel.insert.make({
              id: 'site-prop-di' as SiteId,
              bfoClass: 'site',
              name: 'Property DI Test Site',
              geoFrameJson: Option.none(),
            })
          )

          // Create prerequisite asset
          yield* assetRepo.insert(
            AssetModel.insert.make({
              id: 'asset-prop-di' as AssetId,
              bfoClass: 'material_entity',
              kind: 'EQUIPMENT' as never,
              label: 'Property Test Asset' as never,
              description: Option.none(),
              status: 'available' as AssetStatus,
              siteId: 'site-prop-di' as SiteId,
              sectorId: Option.none(),
              containerId: Option.none(),
              basePropertiesJson: Option.none(),
              tagsJson: Option.none(),
              version: 1,
            })
          )

          // Create property
          const prop = yield* propertyRepo.insert(
            AssetPropertyModel.insert.make({
              assetId: 'asset-prop-di' as AssetId,
              key: 'serialNumber',
              value: 'SN-DI-123',
              provenanceJson: { sourceType: 'manual', timestamp: new Date().toISOString() },
            })
          )

          expect(prop.key).toBe('serialNumber')
          expect(prop.value).toBe('SN-DI-123')
        })
      )
    })
  })

  describe('AssetTraitRepository', () => {
    test('insert trait via DI', async () => {
      await runTest(
        Effect.gen(function* () {
          const siteRepo = yield* SiteRepository
          const assetRepo = yield* AssetRepository
          const traitRepo = yield* AssetTraitRepository

          // Create prerequisite site
          yield* siteRepo.insert(
            SiteModel.insert.make({
              id: 'site-trait-di' as SiteId,
              bfoClass: 'site',
              name: 'Trait DI Test Site',
              geoFrameJson: Option.none(),
            })
          )

          // Create prerequisite asset
          yield* assetRepo.insert(
            AssetModel.insert.make({
              id: 'asset-trait-di' as AssetId,
              bfoClass: 'material_entity',
              kind: 'EQUIPMENT' as never,
              label: 'Trait Test Asset' as never,
              description: Option.none(),
              status: 'available' as AssetStatus,
              siteId: 'site-trait-di' as SiteId,
              sectorId: Option.none(),
              containerId: Option.none(),
              basePropertiesJson: Option.none(),
              tagsJson: Option.none(),
              version: 1,
            })
          )

          // Create trait
          const trait = yield* traitRepo.insert(
            AssetTraitModel.insert.make({
              assetId: 'asset-trait-di' as AssetId,
              traitId: 'inspectable',
              configJson: Option.some({ interval: 30, unit: 'days' }),
            })
          )

          expect(trait.traitId).toBe('inspectable')
          expect(Option.getOrNull(trait.configJson)).toEqual({ interval: 30, unit: 'days' })
        })
      )
    })
  })

  describe('EventJournalRepository', () => {
    test('insert event via DI', async () => {
      await runTest(
        Effect.gen(function* () {
          const journalRepo = yield* EventJournalRepository

          const event = yield* journalRepo.insert(
            EventJournalModel.insert.make({
              eventTag: 'AssetCreated',
              primaryKey: 'asset-di-journal-test',
              payloadJson: {
                assetId: 'asset-di-journal-test',
                kind: 'EQUIPMENT',
                label: 'Journal Test',
              },
              triggeredBy: 'system',
              aggregateVersion: 1,
            })
          )

          expect(event.eventTag).toBe('AssetCreated')
          expect(event.primaryKey).toBe('asset-di-journal-test')
          expect(event.sequenceNumber).toBeGreaterThan(0)
        })
      )
    })
  })
})
