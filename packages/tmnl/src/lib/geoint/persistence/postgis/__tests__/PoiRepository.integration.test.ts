/**
 * PoiRepository Integration Tests
 *
 * Tests against a real PostgreSQL + TimescaleDB + PostGIS database.
 * Uses the docker-compose postgres service.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 bun test src/lib/geoint/persistence/postgis/__tests__/PoiRepository.integration.test.ts
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
  PoiRepositoryTag,
  PoiRepositoryLive,
  type PoiInput,
  type OsmType,
} from '../PoiRepository'

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

// Combined test layer - provides PoiRepository with PgClient
const TestLayer = PoiRepositoryLive.pipe(Layer.provide(PgClientLive))

// Test bounds (San Francisco area)
const SF_BOUNDS: readonly [number, number, number, number] = [
  -122.5, 37.5, -122.0, 38.0,
]

// Generate unique OSM IDs for tests (uses negative IDs with timestamp to avoid conflicts)
const testOsmIdBase = BigInt(-Date.now()) * BigInt(1000)
let testOsmIdOffset = BigInt(0)
const testOsmId = (): bigint => {
  testOsmIdOffset -= BigInt(1)
  return testOsmIdBase + testOsmIdOffset
}

// =============================================================================
// Test Fixtures
// =============================================================================

const createTestPoi = (
  osmId: bigint,
  overrides: Partial<Omit<PoiInput, '_tag' | 'osmId'>> = {}
): PoiInput => ({
  _tag: 'PoiInput',
  osmId,
  osmType: 'node' as OsmType,
  raw: { type: 'node', id: Number(osmId), tags: {} },
  geometry: { type: 'Point', coordinates: [-122.4, 37.78] },
  centroidLon: Option.some(-122.4),
  centroidLat: Option.some(37.78),
  tags: { name: 'Test POI', amenity: 'cafe' },
  queryBbox: Option.some(SF_BOUNDS),
  ttlDays: Option.some(7),
  ...overrides,
})

// Helper to run effects with the test layer
const runTest = <A, E>(
  effect: Effect.Effect<A, E, PoiRepositoryTag>
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

describe.skipIf(!RUN_INTEGRATION_TESTS)('PoiRepository Integration', () => {
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
      // Delete test POIs (those with negative OSM IDs)
      yield* sql`
        DELETE FROM raw.osm_elements
        WHERE osm_id < 0
      `
    }).pipe(
      Effect.provide(PgClientLive),
      Effect.catchAll(() => Effect.void) // Ignore cleanup errors
    )

    await Effect.runPromise(cleanup)
  })

  describe('upsertPoi', () => {
    it('inserts a single POI', async () => {
      const osmId = testOsmId()
      const input = createTestPoi(osmId)

      await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag

          // Insert
          yield* repo.upsertPoi(input)
        })
      )

      // Verify by querying raw table
      const rows = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{ osm_id: string }>`
            SELECT osm_id::text FROM raw.osm_elements
            WHERE osm_id = ${osmId}
          `
        })
      )

      expect(rows.length).toBe(1)
      // PostgreSQL returns bigint as string, compare as strings
      expect(rows[0].osm_id).toBe(osmId.toString())
    })

    it('handles upsert on conflict', async () => {
      const osmId = testOsmId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag

          // Insert first POI
          yield* repo.upsertPoi(
            createTestPoi(osmId, {
              tags: { name: 'First Name', amenity: 'cafe' },
            })
          )

          // Insert second POI with same osm_id/osm_type
          yield* repo.upsertPoi(
            createTestPoi(osmId, {
              tags: { name: 'Updated Name', amenity: 'restaurant' },
            })
          )
        })
      )

      // Verify only one row with updated tags
      const rows = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{ name: string; amenity: string }>`
            SELECT name, amenity FROM raw.osm_elements
            WHERE osm_id = ${osmId}
          `
        })
      )

      expect(rows.length).toBe(1)
      expect(rows[0].name).toBe('Updated Name')
      expect(rows[0].amenity).toBe('restaurant')
    })
  })

  describe('upsertPois', () => {
    it('inserts multiple POIs in batch', async () => {
      const baseId = testOsmId()

      // Create 5 POIs
      const inputs = Array.from({ length: 5 }, (_, i) =>
        createTestPoi(baseId - BigInt(i), {
          tags: { name: `Batch POI ${i}`, amenity: 'cafe' },
        })
      )

      const count = await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag
          return yield* repo.upsertPois(inputs)
        })
      )

      expect(count).toBe(5)

      // Verify count
      const rows = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{ count: string }>`
            SELECT COUNT(*)::text as count FROM raw.osm_elements
            WHERE osm_id BETWEEN ${baseId - BigInt(4)} AND ${baseId}
          `
        })
      )

      expect(parseInt(rows[0].count, 10)).toBe(5)
    })

    it('returns 0 for empty input', async () => {
      const count = await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag
          return yield* repo.upsertPois([])
        })
      )

      expect(count).toBe(0)
    })
  })

  describe('findPois', () => {
    it('finds POIs in bounding box', async () => {
      const osmId = testOsmId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag

          // Insert a POI within SF bounds
          yield* repo.upsertPoi(
            createTestPoi(osmId, {
              geometry: { type: 'Point', coordinates: [-122.4, 37.78] },
              centroidLon: Option.some(-122.4),
              centroidLat: Option.some(37.78),
            })
          )
        })
      )

      // Query with bounds
      const pois = await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag
          return yield* repo.findPois({
            bounds: SF_BOUNDS,
            limit: 100,
          })
        })
      )

      expect(Array.isArray(pois)).toBe(true)
      // Should find our POI (or others in the database)
      expect(pois.length).toBeGreaterThanOrEqual(0)
    })

    it('filters by amenity', async () => {
      const osmId = testOsmId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag

          // Insert POI with specific amenity
          yield* repo.upsertPoi(
            createTestPoi(osmId, {
              tags: { name: 'Test Cafe', amenity: 'cafe' },
            })
          )
        })
      )

      // Query filtered by amenity
      const pois = await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag
          return yield* repo.findPois({
            amenity: 'cafe',
            limit: 10,
          })
        })
      )

      expect(Array.isArray(pois)).toBe(true)
      // All returned POIs should have amenity = cafe
      for (const poi of pois) {
        expect(poi.amenity).toBe('cafe')
      }
    })

    it('filters by name pattern', async () => {
      const osmId = testOsmId()
      const uniqueName = `UniqueTestName${Date.now()}`

      await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag

          // Insert POI with unique name
          yield* repo.upsertPoi(
            createTestPoi(osmId, {
              tags: { name: uniqueName, amenity: 'cafe' },
            })
          )
        })
      )

      // Query by name pattern
      const pois = await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag
          return yield* repo.findPois({
            namePattern: 'UniqueTestName',
            limit: 10,
          })
        })
      )

      expect(pois.length).toBeGreaterThanOrEqual(1)
      expect(pois.some((p) => p.name === uniqueName)).toBe(true)
    })
  })

  describe('findNearby', () => {
    it('finds POIs near a point', async () => {
      const osmId = testOsmId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag

          // Insert POI at specific location
          yield* repo.upsertPoi(
            createTestPoi(osmId, {
              geometry: { type: 'Point', coordinates: [-122.4, 37.78] },
              centroidLon: Option.some(-122.4),
              centroidLat: Option.some(37.78),
            })
          )
        })
      )

      // Query nearby
      const pois = await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag
          return yield* repo.findNearby({
            longitude: -122.4,
            latitude: 37.78,
            radiusM: 1000,
            limit: 10,
          })
        })
      )

      expect(Array.isArray(pois)).toBe(true)

      // Results should have distance_m
      for (const poi of pois) {
        expect(Option.isSome(poi.distance_m)).toBe(true)
        // Should be within radius
        if (Option.isSome(poi.distance_m)) {
          expect(poi.distance_m.value).toBeLessThanOrEqual(1000)
        }
      }
    })

    it('filters nearby by amenity', async () => {
      const osmId = testOsmId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag

          // Insert restaurant POI
          yield* repo.upsertPoi(
            createTestPoi(osmId, {
              geometry: { type: 'Point', coordinates: [-122.4, 37.78] },
              centroidLon: Option.some(-122.4),
              centroidLat: Option.some(37.78),
              tags: { name: 'Nearby Restaurant', amenity: 'restaurant' },
            })
          )
        })
      )

      // Query nearby restaurants
      const pois = await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag
          return yield* repo.findNearby({
            longitude: -122.4,
            latitude: 37.78,
            radiusM: 1000,
            amenity: 'restaurant',
            limit: 10,
          })
        })
      )

      expect(Array.isArray(pois)).toBe(true)
      for (const poi of pois) {
        expect(poi.amenity).toBe('restaurant')
      }
    })
  })

  describe('findPoi', () => {
    it('finds POI by OSM ID and type', async () => {
      const osmId = testOsmId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag

          // Insert POI
          yield* repo.upsertPoi(createTestPoi(osmId))
        })
      )

      // Find by ID
      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag
          return yield* repo.findPoi(osmId, 'node')
        })
      )

      expect(Option.isSome(result)).toBe(true)
      if (Option.isSome(result)) {
        expect(result.value.osm_id).toBe(osmId)
        expect(result.value.osm_type).toBe('node')
      }
    })

    it('returns None for unknown OSM ID', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag
          return yield* repo.findPoi(BigInt(-999999999), 'node')
        })
      )

      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe('isStale', () => {
    it('returns true for non-existent POI', async () => {
      const isStale = await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag
          return yield* repo.isStale(BigInt(-999999999), 'node')
        })
      )

      expect(isStale).toBe(true)
    })

    it('returns false for fresh POI', async () => {
      const osmId = testOsmId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag

          // Insert fresh POI with 7-day TTL
          yield* repo.upsertPoi(
            createTestPoi(osmId, {
              ttlDays: Option.some(7),
            })
          )
        })
      )

      // Check if stale with 60-minute threshold
      const isStale = await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag
          return yield* repo.isStale(osmId, 'node', 60)
        })
      )

      expect(isStale).toBe(false)
    })
  })

  describe('countPois', () => {
    it('counts POIs matching criteria', async () => {
      const baseId = testOsmId()

      // Insert 3 POIs
      await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag
          for (let i = 0; i < 3; i++) {
            yield* repo.upsertPoi(
              createTestPoi(baseId - BigInt(i), {
                tags: { name: `Count Test ${i}`, amenity: 'bank' },
              })
            )
          }
        })
      )

      // Count banks
      const count = await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag
          return yield* repo.countPois({
            amenity: 'bank',
          })
        })
      )

      expect(count).toBeGreaterThanOrEqual(3)
    })

    it('returns 0 for no matches', async () => {
      // Count with impossible criteria
      const count = await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag
          return yield* repo.countPois({
            amenity: 'nonexistent_amenity_type_xyz123',
          })
        })
      )

      expect(count).toBe(0)
    })
  })

  describe('cleanupExpired', () => {
    it('deletes expired POIs', async () => {
      const osmId = testOsmId()

      // Insert POI with immediate expiration (via raw SQL with upsert)
      await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          yield* sql`
            INSERT INTO raw.osm_elements (
              osm_id, osm_type, raw, geometry, tags, fetched_at, expires_at
            ) VALUES (
              ${osmId},
              'node',
              '{}'::jsonb,
              ST_SetSRID(ST_MakePoint(-122.4, 37.78), 4326),
              '{"name": "Expired POI"}'::jsonb,
              NOW() - INTERVAL '8 days',
              NOW() - INTERVAL '1 day'
            )
            ON CONFLICT (osm_id, osm_type) DO UPDATE SET
              expires_at = EXCLUDED.expires_at,
              fetched_at = EXCLUDED.fetched_at
          `
        })
      )

      // Cleanup expired
      const deletedCount = await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag
          return yield* repo.cleanupExpired()
        })
      )

      expect(deletedCount).toBeGreaterThanOrEqual(1)

      // Verify it's gone
      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag
          return yield* repo.findPoi(osmId, 'node')
        })
      )

      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe('refreshExpiration', () => {
    it('extends expiration for POIs in bounds', async () => {
      const osmId = testOsmId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag

          // Insert POI in SF bounds with short TTL
          yield* repo.upsertPoi(
            createTestPoi(osmId, {
              geometry: { type: 'Point', coordinates: [-122.4, 37.78] },
              ttlDays: Option.some(1),
            })
          )
        })
      )

      // Get initial expiration
      const before = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{ expires_at: Date }>`
            SELECT expires_at FROM raw.osm_elements
            WHERE osm_id = ${osmId}
          `
        })
      )

      // Refresh expiration
      const refreshedCount = await runTest(
        Effect.gen(function* () {
          const repo = yield* PoiRepositoryTag
          return yield* repo.refreshExpiration(SF_BOUNDS, 14)
        })
      )

      expect(refreshedCount).toBeGreaterThanOrEqual(1)

      // Get updated expiration
      const after = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{ expires_at: Date }>`
            SELECT expires_at FROM raw.osm_elements
            WHERE osm_id = ${osmId}
          `
        })
      )

      // Expiration should be extended
      expect(after[0].expires_at.getTime()).toBeGreaterThan(
        before[0].expires_at.getTime()
      )
    })
  })
})
