/**
 * ImageryRepository Integration Tests
 *
 * Tests against a real PostgreSQL + TimescaleDB + PostGIS database.
 * Uses the docker-compose postgres service.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 bun test src/lib/geoint/persistence/postgis/__tests__/ImageryRepository.integration.test.ts
 *
 * Prerequisites:
 * - docker compose -f docker/docker-compose.yml up postgres -d
 *
 * @module
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Effect, Layer, Option, Redacted, Exit } from 'effect'
import { PgClient } from '@effect/sql-pg'
import {
  ImageryRepositoryTag,
  ImageryRepositoryLive,
  type ImageryItemInput,
  type ImageryProvider,
} from '../ImageryRepository'

// =============================================================================
// Test Configuration
// =============================================================================

const RUN_INTEGRATION_TESTS = process.env['RUN_INTEGRATION_TESTS'] === '1'

// Database connection config (matches docker-compose.yml)
const PgClientLive = PgClient.layer({
  host: 'localhost',
  port: 5432,
  database: 'tmnl',
  username: 'tmnl',
  password: Redacted.make('tmnl_dev_password'),
})

// Combined test layer - provides ImageryRepository with PgClient
const TestLayer = ImageryRepositoryLive.pipe(Layer.provide(PgClientLive))

// Test bounds (San Francisco area)
const SF_BOUNDS: readonly [number, number, number, number] = [
  -122.5, 37.5, -122.0, 38.0,
]

// Generate unique item ID for tests
const testItemIdBase = `test-${Date.now()}`
let testItemIdOffset = 0
const testItemId = (): string => {
  testItemIdOffset += 1
  return `${testItemIdBase}-${testItemIdOffset}`
}

// =============================================================================
// Test Fixtures
// =============================================================================

const createTestItem = (
  itemId: string,
  overrides: Partial<Omit<ImageryItemInput, '_tag' | 'itemId'>> = {}
): ImageryItemInput => ({
  _tag: 'ImageryItemInput',
  itemId,
  provider: 'planet' as ImageryProvider,
  raw: { test: true },
  collection: Option.some('PSScene'),
  acquired: Option.some(new Date()),
  published: Option.some(new Date()),
  updated: Option.none(),
  cloudCover: Option.some(15.5),
  gsd: Option.some(3.0),
  sunAzimuth: Option.some(145.0),
  sunElevation: Option.some(60.0),
  bbox: Option.some([-122.5, 37.7, -122.4, 37.8] as const),
  centroidLon: Option.some(-122.45),
  centroidLat: Option.some(37.75),
  ...overrides,
})

// Helper to run effects with the test layer
const runTest = <A, E>(
  effect: Effect.Effect<A, E, ImageryRepositoryTag>
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(TestLayer),
      Effect.timeout('10 seconds'),
      Effect.catchTag('TimeoutException', () =>
        Effect.die(new Error('Test timed out'))
      )
    )
  )

// Helper to run raw SQL for verification
const runSql = <A>(
  effect: Effect.Effect<A, unknown, PgClient.PgClient>
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(Effect.provide(PgClientLive), Effect.timeout('5 seconds'))
  )

// =============================================================================
// Integration Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION_TESTS)('ImageryRepository Integration', () => {
  // Verify database connection before running tests
  beforeAll(async () => {
    const checkConnection = Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const result = yield* sql<{ one: number }>`SELECT 1 as one`
      return result[0]?.one === 1
    }).pipe(Effect.provide(PgClientLive), Effect.timeout('5 seconds'))

    const exit = await Effect.runPromiseExit(checkConnection)
    if (!Exit.isSuccess(exit)) {
      throw new Error(
        'Database connection failed. Ensure postgres container is running:\n' +
          'docker compose -f docker/docker-compose.yml up postgres -d'
      )
    }
  })

  // Cleanup test data after all tests
  afterAll(async () => {
    const cleanup = Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      // Delete test items (those with item_id starting with 'test-')
      yield* sql`
        DELETE FROM raw.imagery_items
        WHERE item_id LIKE 'test-%'
      `
    }).pipe(
      Effect.provide(PgClientLive),
      Effect.catchAll(() => Effect.void) // Ignore cleanup errors
    )

    await Effect.runPromise(cleanup)
  })

  describe('insertItem', () => {
    it('inserts a single imagery item', async () => {
      const itemId = testItemId()
      const input = createTestItem(itemId)

      await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag

          // Insert
          yield* repo.insertItem(input)
        })
      )

      // Verify by querying raw table
      const rows = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{ item_id: string; provider: string }>`
            SELECT item_id, provider FROM raw.imagery_items
            WHERE item_id = ${itemId}
          `
        })
      )

      expect(rows.length).toBe(1)
      expect(rows[0].item_id).toBe(itemId)
      expect(rows[0].provider).toBe('planet')
    })

    it('handles upsert on conflict', async () => {
      const itemId = testItemId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag

          // Insert first item
          yield* repo.insertItem(
            createTestItem(itemId, {
              cloudCover: Option.some(20),
            })
          )

          // Insert second item with same id/provider
          yield* repo.insertItem(
            createTestItem(itemId, {
              cloudCover: Option.some(10),
            })
          )
        })
      )

      // Verify only one row with updated cloud cover
      const rows = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{ cloud_cover: number }>`
            SELECT cloud_cover FROM raw.imagery_items
            WHERE item_id = ${itemId}
          `
        })
      )

      expect(rows.length).toBe(1)
      expect(rows[0].cloud_cover).toBe(10)
    })

    it('handles sentinel provider', async () => {
      const itemId = testItemId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag

          yield* repo.insertItem(
            createTestItem(itemId, {
              provider: 'sentinel',
              collection: Option.some('sentinel-2-l2a'),
            })
          )
        })
      )

      // Verify provider
      const rows = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{ provider: string; collection: string }>`
            SELECT provider, collection FROM raw.imagery_items
            WHERE item_id = ${itemId}
          `
        })
      )

      expect(rows[0].provider).toBe('sentinel')
      expect(rows[0].collection).toBe('sentinel-2-l2a')
    })
  })

  describe('insertItems', () => {
    it('inserts multiple items in batch', async () => {
      const baseId = testItemId()

      // Create 10 items with different IDs
      const inputs = Array.from({ length: 10 }, (_, i) =>
        createTestItem(`${baseId}-batch-${i}`, {
          cloudCover: Option.some(10 + i),
        })
      )

      const count = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.insertItems(inputs)
        })
      )

      expect(count).toBe(10)

      // Verify count
      const rows = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{ count: string }>`
            SELECT COUNT(*)::text as count FROM raw.imagery_items
            WHERE item_id LIKE ${baseId + '-batch-%'}
          `
        })
      )

      expect(parseInt(rows[0].count, 10)).toBe(10)
    })

    it('returns 0 for empty input', async () => {
      const count = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.insertItems([])
        })
      )

      expect(count).toBe(0)
    })
  })

  describe('findItems', () => {
    it('finds items in bounding box', async () => {
      const itemId = testItemId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag

          // Insert an item in SF
          yield* repo.insertItem(
            createTestItem(itemId, {
              centroidLon: Option.some(-122.4),
              centroidLat: Option.some(37.78),
            })
          )
        })
      )

      // Query with bounds
      const items = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.findItems({
            bounds: SF_BOUNDS,
            limit: 100,
          })
        })
      )

      expect(Array.isArray(items)).toBe(true)
      // Should find at least our item
      const found = items.find((i) => i.item_id === itemId)
      expect(found).toBeDefined()
    })

    it('filters by provider', async () => {
      const itemId = testItemId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag

          // Insert planet item
          yield* repo.insertItem(createTestItem(itemId))
        })
      )

      // Query filtered by provider
      const planetItems = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.findItems({
            provider: 'planet',
            limit: 10,
          })
        })
      )

      expect(Array.isArray(planetItems)).toBe(true)
      for (const item of planetItems) {
        expect(item.provider).toBe('planet')
      }
    })

    it('filters by cloud cover', async () => {
      const itemId = testItemId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag

          yield* repo.insertItem(
            createTestItem(itemId, {
              cloudCover: Option.some(5),
            })
          )
        })
      )

      // Query with max cloud cover
      const items = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.findItems({
            maxCloudCover: 10,
            limit: 100,
          })
        })
      )

      expect(Array.isArray(items)).toBe(true)
      for (const item of items) {
        if (item.cloud_cover !== null) {
          expect(item.cloud_cover).toBeLessThanOrEqual(10)
        }
      }
    })

    it('filters by acquisition time range', async () => {
      const itemId = testItemId()
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag

          yield* repo.insertItem(
            createTestItem(itemId, {
              acquired: Option.some(now),
            })
          )
        })
      )

      // Query with time range
      const items = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.findItems({
            acquiredFrom: yesterday,
            acquiredTo: new Date(now.getTime() + 1000),
            limit: 100,
          })
        })
      )

      expect(Array.isArray(items)).toBe(true)
      const found = items.find((i) => i.item_id === itemId)
      expect(found).toBeDefined()
    })
  })

  describe('findNearby', () => {
    it('finds items near a point', async () => {
      const itemId = testItemId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag

          yield* repo.insertItem(
            createTestItem(itemId, {
              centroidLon: Option.some(-122.4),
              centroidLat: Option.some(37.78),
            })
          )
        })
      )

      // Query nearby
      const items = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.findNearby({
            longitude: -122.4,
            latitude: 37.78,
            radiusM: 10000, // 10km
            withinDays: 365,
            limit: 10,
          })
        })
      )

      expect(Array.isArray(items)).toBe(true)
      const found = items.find((i) => i.item_id === itemId)
      expect(found).toBeDefined()
      expect(Option.isSome(found!.distance_m)).toBe(true)
    })

    it('returns items ordered by distance', async () => {
      const baseId = testItemId()

      // Insert items at different distances
      await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag

          // Close item
          yield* repo.insertItem(
            createTestItem(`${baseId}-close`, {
              centroidLon: Option.some(-122.4),
              centroidLat: Option.some(37.78),
            })
          )

          // Far item
          yield* repo.insertItem(
            createTestItem(`${baseId}-far`, {
              centroidLon: Option.some(-122.3),
              centroidLat: Option.some(37.85),
            })
          )
        })
      )

      // Query nearby
      const items = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.findNearby({
            longitude: -122.4,
            latitude: 37.78,
            radiusM: 20000, // 20km
            withinDays: 365,
            limit: 10,
          })
        })
      )

      // Verify ordering by distance
      if (items.length >= 2) {
        const closeItem = items.find((i) => i.item_id === `${baseId}-close`)
        const farItem = items.find((i) => i.item_id === `${baseId}-far`)
        if (closeItem && farItem) {
          expect(
            Option.getOrElse(closeItem.distance_m, () => Infinity)
          ).toBeLessThan(Option.getOrElse(farItem.distance_m, () => Infinity))
        }
      }
    })
  })

  describe('findItem', () => {
    it('finds item by ID and provider', async () => {
      const itemId = testItemId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          yield* repo.insertItem(createTestItem(itemId))
        })
      )

      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.findItem(itemId, 'planet')
        })
      )

      expect(Option.isSome(result)).toBe(true)
      const item = Option.getOrThrow(result)
      expect(item.item_id).toBe(itemId)
      expect(item.provider).toBe('planet')
    })

    it('returns None for unknown item', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.findItem('unknown_item', 'planet')
        })
      )

      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe('findRecent', () => {
    it('returns items ordered by acquisition time', async () => {
      const baseId = testItemId()
      const now = Date.now()

      // Insert items with different acquisition times
      await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag

          for (let i = 0; i < 5; i++) {
            yield* repo.insertItem(
              createTestItem(`${baseId}-recent-${i}`, {
                acquired: Option.some(new Date(now - i * 3600000)), // 1 hour apart
              })
            )
          }
        })
      )

      // Query recent
      const items = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.findRecent({ limit: 10 })
        })
      )

      expect(items.length).toBeGreaterThan(0)

      // Verify ordering (most recent first)
      for (let i = 1; i < items.length; i++) {
        const prev = items[i - 1].acquired
        const curr = items[i].acquired
        if (prev && curr) {
          expect(prev.epochMillis >= curr.epochMillis).toBe(true)
        }
      }
    })

    it('filters by collection', async () => {
      const itemId = testItemId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          yield* repo.insertItem(
            createTestItem(itemId, {
              collection: Option.some('SkySatCollect'),
            })
          )
        })
      )

      // Query by collection
      const items = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.findRecent({
            collection: 'SkySatCollect',
            limit: 10,
          })
        })
      )

      expect(Array.isArray(items)).toBe(true)
      for (const item of items) {
        expect(item.collection).toBe('SkySatCollect')
      }
    })
  })

  describe('countItems', () => {
    it('counts all items', async () => {
      const count = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.countItems()
        })
      )

      expect(typeof count).toBe('number')
      expect(count).toBeGreaterThanOrEqual(0)
    })

    it('counts items by provider', async () => {
      const itemId = testItemId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          yield* repo.insertItem(createTestItem(itemId))
        })
      )

      const count = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.countItems({ provider: 'planet' })
        })
      )

      expect(count).toBeGreaterThanOrEqual(1)
    })
  })

  describe('getCollectionStats', () => {
    it('returns statistics per collection', async () => {
      const itemId = testItemId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          yield* repo.insertItem(createTestItem(itemId))
        })
      )

      const stats = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.getCollectionStats()
        })
      )

      expect(Array.isArray(stats)).toBe(true)

      // Find PSScene collection
      const psScene = stats.find(
        (s) => s.collection === 'PSScene' && s.provider === 'planet'
      )
      if (psScene) {
        expect(typeof psScene.item_count).toBe('number')
        expect(psScene.item_count).toBeGreaterThan(0)
      }
    })

    it('filters by provider', async () => {
      const stats = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.getCollectionStats('planet')
        })
      )

      expect(Array.isArray(stats)).toBe(true)
      for (const s of stats) {
        expect(s.provider).toBe('planet')
      }
    })
  })

  describe('deleteOlderThan', () => {
    it('deletes items older than specified days', async () => {
      const itemId = testItemId()

      // Insert item then manually update fetched_at to old date
      await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          yield* repo.insertItem(createTestItem(itemId))
        })
      )

      // Set fetched_at to 100 days ago
      await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          yield* sql`
            UPDATE raw.imagery_items
            SET fetched_at = NOW() - INTERVAL '100 days'
            WHERE item_id = ${itemId}
          `
        })
      )

      // Delete items older than 90 days
      const deleted = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.deleteOlderThan(90)
        })
      )

      expect(deleted).toBeGreaterThanOrEqual(1)

      // Verify item is deleted
      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* ImageryRepositoryTag
          return yield* repo.findItem(itemId, 'planet')
        })
      )

      expect(Option.isNone(result)).toBe(true)
    })
  })
})
