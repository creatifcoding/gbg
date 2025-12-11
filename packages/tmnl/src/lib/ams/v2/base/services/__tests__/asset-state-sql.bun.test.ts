/**
 * SQL-Backed AssetState Integration Tests
 *
 * Validates that AssetStateSQLLayer correctly delegates to repositories
 * and produces the same behavior as in-memory AssetState.
 *
 * @module @gbg/tmnl/ams/v2/base/services/__tests__/asset-state-sql.bun.test
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { Effect, Layer, Option } from 'effect'
import { AssetState } from '../asset-state'
import { AssetStateSQLLayer } from '../asset-state-sql'
import { AllRepositoriesLive, SiteRepository } from '../repositories'
import { SiteModel } from '../../repositories/asset'
import { SqliteTestLayer } from '../../repositories/sqlite-layer'
import {
  AssetId,
  SiteId,
  SectorId,
  ContainerId,
  PropertyKey,
  TraitId,
  IdentityId,
} from '../../../core/schemas/identifiers'
import { AssetStatus } from '../../schemas/asset'

// ─────────────────────────────────────────────────────────────────────────────
// Test Layer Composition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SQL-backed test layer:
 * AssetStateSQLLayer needs:
 * 1. Repository services (AssetRepository, AssetPropertyRepository, AssetTraitRepository)
 * 2. SqlClient.SqlClient (for raw SQL queries)
 *
 * Layer composition:
 * 1. SqliteTestLayer provides SqlClient (base)
 * 2. AllRepositoriesLive.pipe(Layer.provide(SqliteTestLayer)) provides repositories
 * 3. AssetStateSQLLayer needs repos + SqlClient
 *
 * Layer.provideMerge: provides deps AND exports both provider and consumer outputs
 */
const RepositoriesLayer = AllRepositoriesLive.pipe(Layer.provide(SqliteTestLayer))

const TestLayer = AssetStateSQLLayer.pipe(
  Layer.provide(RepositoriesLayer),
  Layer.provide(SqliteTestLayer),
  // Merge repositories so tests can access them directly
  Layer.provideMerge(RepositoriesLayer)
)

/**
 * Helper to run Effect in test context
 */
const runTest = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)))

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const testSiteId = 'site-sql-test' as SiteId
const testUser = 'test-user' as IdentityId

/**
 * Create test site prerequisite
 */
const createTestSite = Effect.gen(function* () {
  const siteRepo = yield* SiteRepository
  yield* siteRepo.insert(
    SiteModel.insert.make({
      id: testSiteId,
      bfoClass: 'site',
      name: 'SQL Test Site',
      geoFrameJson: Option.none(),
    })
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Command Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('AssetStateSQLLayer', () => {
  describe('Commands', () => {
    test('create: creates asset in database', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          const asset = yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'SQL Test Asset' as never,
            status: 'available' as AssetStatus,
            createdBy: testUser,
          })

          expect(asset.id).toMatch(/^asset-/)
          expect(asset.label).toBe('SQL Test Asset')
          expect(asset.status).toBe('available')
          expect(asset.siteId).toBe(testSiteId)
        })
      )
    })

    test('update: updates asset in database', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          const asset = yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'Original Label' as never,
            createdBy: testUser,
          })

          const updated = yield* state.update({
            assetId: asset.id,
            label: 'Updated Label' as never,
            status: 'reserved' as AssetStatus,
            updatedBy: testUser,
          })

          expect(updated.label).toBe('Updated Label')
          expect(updated.status).toBe('reserved')
        })
      )
    })

    test('update: rejects version conflict', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          const asset = yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'Conflict Test' as never,
            createdBy: testUser,
          })

          const result = yield* state
            .update({
              assetId: asset.id,
              label: 'Bad Update' as never,
              expectedVersion: 999, // Wrong version
              updatedBy: testUser,
            })
            .pipe(Effect.either)

          expect(result._tag).toBe('Left')
          if (result._tag === 'Left') {
            expect(result.left._tag).toBe('AssetConflictError')
          }
        })
      )
    })

    test('move: updates asset location', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          const asset = yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'Move Test' as never,
            createdBy: testUser,
          })

          const newSiteId = 'site-sql-test-2' as SiteId

          // Create target site
          const siteRepo = yield* SiteRepository
          yield* siteRepo.insert(
            SiteModel.insert.make({
              id: newSiteId,
              bfoClass: 'site',
              name: 'Target Site',
              geoFrameJson: Option.none(),
            })
          )

          const moved = yield* state.move({
            assetId: asset.id,
            toSiteId: newSiteId,
            movedBy: testUser,
          })

          expect(moved.siteId).toBe(newSiteId)
        })
      )
    })

    test('setProperty: creates and updates property', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          const asset = yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'Property Test' as never,
            createdBy: testUser,
          })

          // Set property
          yield* state.setProperty({
            assetId: asset.id,
            key: 'serialNumber' as PropertyKey,
            value: 'SN-12345' as never,
            provenance: { sourceType: 'manual', timestamp: new Date().toISOString() } as never,
            changedBy: testUser,
          })

          // Retrieve property
          const prop = yield* state.getProperty({
            assetId: asset.id,
            key: 'serialNumber' as PropertyKey,
          })

          expect(prop.key).toBe('serialNumber')
          expect(prop.value).toBe('SN-12345')
        })
      )
    })

    test('removeProperty: deletes property', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          const asset = yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'Remove Prop Test' as never,
            createdBy: testUser,
          })

          // Set then remove property
          yield* state.setProperty({
            assetId: asset.id,
            key: 'tempProp' as PropertyKey,
            value: 'temp' as never,
            provenance: { sourceType: 'manual', timestamp: new Date().toISOString() } as never,
            changedBy: testUser,
          })

          yield* state.removeProperty({
            assetId: asset.id,
            key: 'tempProp' as PropertyKey,
            removedBy: testUser,
          })

          // Verify removed
          const result = yield* state
            .getProperty({
              assetId: asset.id,
              key: 'tempProp' as PropertyKey,
            })
            .pipe(Effect.either)

          expect(result._tag).toBe('Left')
        })
      )
    })

    test('addTrait: creates trait', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          const asset = yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'Trait Test' as never,
            createdBy: testUser,
          })

          yield* state.addTrait({
            assetId: asset.id,
            traitId: 'inspectable' as TraitId,
            config: { interval: 30 },
            addedBy: testUser,
          })

          // Trait added successfully (no error)
          expect(true).toBe(true)
        })
      )
    })

    test('delete: soft delete marks as retired', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          const asset = yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'Soft Delete Test' as never,
            createdBy: testUser,
          })

          yield* state.delete({
            assetId: asset.id,
            hardDelete: false,
            deletedBy: testUser,
          })

          // Asset should still exist but be retired
          const found = yield* state.findById(asset.id)
          expect(found.status).toBe('retired')
        })
      )
    })

    test('delete: hard delete removes asset', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          const asset = yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'Hard Delete Test' as never,
            createdBy: testUser,
          })

          yield* state.delete({
            assetId: asset.id,
            hardDelete: true,
            deletedBy: testUser,
          })

          // Asset should not exist
          const result = yield* state.findById(asset.id).pipe(Effect.either)
          expect(result._tag).toBe('Left')
        })
      )
    })
  })

  describe('Queries', () => {
    test('findById: returns asset', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          const asset = yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'Find Test' as never,
            createdBy: testUser,
          })

          const found = yield* state.findById(asset.id)
          expect(found.id).toBe(asset.id)
          expect(found.label).toBe('Find Test')
        })
      )
    })

    test('findById: fails for non-existent asset', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          const result = yield* state
            .findById('nonexistent' as AssetId)
            .pipe(Effect.either)

          expect(result._tag).toBe('Left')
          if (result._tag === 'Left') {
            expect(result.left._tag).toBe('AssetNotFoundError')
          }
        })
      )
    })

    test('findSummaryById: returns summary', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          const asset = yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'Summary Test' as never,
            createdBy: testUser,
          })

          const summary = yield* state.findSummaryById(asset.id)
          expect(summary.id).toBe(asset.id)
          expect(summary.kind).toBe('EQUIPMENT')
          expect(summary.label).toBe('Summary Test')
        })
      )
    })

    test('exists: returns true for existing asset', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          const asset = yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'Exists Test' as never,
            createdBy: testUser,
          })

          const exists = yield* state.exists(asset.id)
          expect(exists).toBe(true)
        })
      )
    })

    test('exists: returns false for non-existent asset', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          const exists = yield* state.exists('nonexistent' as AssetId)
          expect(exists).toBe(false)
        })
      )
    })

    test('listBySite: returns paginated assets', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          // Create multiple assets
          yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'Asset 1' as never,
            createdBy: testUser,
          })
          yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'Asset 2' as never,
            createdBy: testUser,
          })

          const result = yield* state.listBySite({ siteId: testSiteId, limit: 10 })

          expect(result._tag).toBe('PaginatedAssets')
          expect(result.items.length).toBeGreaterThanOrEqual(2)
          expect(result.pageInfo.totalCount).toBeGreaterThanOrEqual(2)
        })
      )
    })

    test('countBySite: returns correct count', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          // Get initial count
          const initialCount = yield* state.countBySite(testSiteId)

          // Create assets
          yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'Count Test 1' as never,
            createdBy: testUser,
          })
          yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'Count Test 2' as never,
            createdBy: testUser,
          })

          const finalCount = yield* state.countBySite(testSiteId)
          expect(finalCount).toBe(initialCount + 2)
        })
      )
    })

    test('countByStatus: returns correct count', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          // Create asset with specific status
          yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'Status Count Test' as never,
            status: 'maintenance' as AssetStatus,
            createdBy: testUser,
          })

          const count = yield* state.countByStatus('maintenance' as AssetStatus)
          expect(count).toBeGreaterThanOrEqual(1)
        })
      )
    })

    test('getProperties: returns all properties for asset', async () => {
      await runTest(
        Effect.gen(function* () {
          yield* createTestSite
          const state = yield* AssetState

          const asset = yield* state.create({
            siteId: testSiteId,
            kind: 'EQUIPMENT' as never,
            label: 'Props Test' as never,
            createdBy: testUser,
          })

          // Set multiple properties
          yield* state.setProperty({
            assetId: asset.id,
            key: 'prop1' as PropertyKey,
            value: 'value1' as never,
            provenance: { sourceType: 'manual', timestamp: new Date().toISOString() } as never,
            changedBy: testUser,
          })
          yield* state.setProperty({
            assetId: asset.id,
            key: 'prop2' as PropertyKey,
            value: 'value2' as never,
            provenance: { sourceType: 'manual', timestamp: new Date().toISOString() } as never,
            changedBy: testUser,
          })

          const props = yield* state.getProperties({ assetId: asset.id })
          expect(props.length).toBe(2)
        })
      )
    })
  })
})
