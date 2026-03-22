/**
 * WeatherRepository Integration Tests
 *
 * Tests against a real PostgreSQL + TimescaleDB + PostGIS database.
 * Uses the docker-compose postgres service.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 bun test src/lib/geoint/persistence/postgis/__tests__/WeatherRepository.integration.test.ts
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
  WeatherRepositoryTag,
  WeatherRepositoryLive,
  makeLocationId,
  type WeatherObservationInput,
} from '../WeatherRepository'

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

// Combined test layer - provides WeatherRepository with PgClient
const TestLayer = WeatherRepositoryLive.pipe(Layer.provide(PgClientLive))

// Test bounds (San Francisco area)
const SF_BOUNDS: readonly [number, number, number, number] = [
  -122.5, 37.5, -122.0, 38.0,
]

// Generate unique location IDs for tests (uses timestamp to avoid conflicts)
const testLocationIdBase = `test_${Date.now()}`
let testLocationIdCounter = 0
const testLocationId = (): string => {
  testLocationIdCounter++
  return `${testLocationIdBase}_${testLocationIdCounter}`
}

// =============================================================================
// Test Fixtures
// =============================================================================

const createTestObservation = (
  locationId: string,
  time: Date = new Date(),
  overrides: Partial<Omit<WeatherObservationInput, '_tag' | 'locationId' | 'time'>> = {}
): WeatherObservationInput => ({
  _tag: 'WeatherObservationInput',
  time,
  locationId,
  raw: { test: true, source: 'test' },
  longitude: -122.4,
  latitude: 37.78,
  temperature: Option.some(20),
  feelsLike: Option.some(19),
  humidity: Option.some(65),
  pressure: Option.some(1013.25),
  weatherCode: Option.some(1), // Clear sky
  weatherDesc: Option.some('Clear sky'),
  windSpeed: Option.some(5.5),
  windDir: Option.some(270),
  windGusts: Option.some(8.0),
  precipitation: Option.some(0),
  rain: Option.some(0),
  snow: Option.some(0),
  visibility: Option.some(10000),
  cloudCover: Option.some(10),
  ...overrides,
})

// Helper to run effects with the test layer
const runTest = <A, E>(
  effect: Effect.Effect<A, E, WeatherRepositoryTag>
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

describe.skipIf(!RUN_INTEGRATION_TESTS)('WeatherRepository Integration', () => {
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
      // Delete test observations (those with location_id starting with 'test_')
      yield* sql`
        DELETE FROM raw.weather_observations
        WHERE location_id LIKE 'test_%'
      `
    }).pipe(
      Effect.provide(PgClientLive),
      Effect.catchAll(() => Effect.void) // Ignore cleanup errors
    )

    await Effect.runPromise(cleanup)
  })

  describe('insertObservation', () => {
    it('inserts a single weather observation', async () => {
      const locationId = testLocationId()
      const time = new Date()
      const input = createTestObservation(locationId, time)

      await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag

          // Insert
          yield* repo.insertObservation(input)
        })
      )

      // Verify by querying raw table
      const rows = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{ location_id: string; temperature: number }>`
            SELECT location_id, temperature
            FROM raw.weather_observations
            WHERE location_id = ${locationId}
          `
        })
      )

      expect(rows.length).toBe(1)
      expect(rows[0].location_id).toBe(locationId)
      expect(rows[0].temperature).toBe(20)
    })

    it('handles upsert on conflict', async () => {
      const locationId = testLocationId()
      const time = new Date()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag

          // Insert first observation
          yield* repo.insertObservation(
            createTestObservation(locationId, time, {
              temperature: Option.some(15),
            })
          )

          // Insert second observation with same time/location
          yield* repo.insertObservation(
            createTestObservation(locationId, time, {
              temperature: Option.some(25),
            })
          )
        })
      )

      // Verify only one row with updated temperature
      const rows = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{ temperature: number }>`
            SELECT temperature
            FROM raw.weather_observations
            WHERE location_id = ${locationId} AND time = ${time}
          `
        })
      )

      expect(rows.length).toBe(1)
      expect(rows[0].temperature).toBe(25)
    })
  })

  describe('insertObservations', () => {
    it('inserts multiple observations in batch', async () => {
      const locationId = testLocationId()

      // Create 10 observations with different timestamps
      const now = Date.now()
      const inputs = Array.from({ length: 10 }, (_, i) =>
        createTestObservation(locationId, new Date(now - i * 60000), {
          temperature: Option.some(20 + i),
        })
      )

      const count = await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          return yield* repo.insertObservations(inputs)
        })
      )

      expect(count).toBe(10)

      // Verify count
      const rows = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{ count: string }>`
            SELECT COUNT(*)::text as count
            FROM raw.weather_observations
            WHERE location_id = ${locationId}
          `
        })
      )

      expect(parseInt(rows[0].count, 10)).toBe(10)
    })

    it('returns 0 for empty input', async () => {
      const count = await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          return yield* repo.insertObservations([])
        })
      )

      expect(count).toBe(0)
    })
  })

  describe('findObservations', () => {
    it('finds observations in bounding box', async () => {
      const locationId = testLocationId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag

          // Insert observation in SF bounds
          yield* repo.insertObservation(
            createTestObservation(locationId, new Date(), {
              longitude: -122.4,
              latitude: 37.78,
            })
          )
        })
      )

      // Query with bounds
      const observations = await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          return yield* repo.findObservations({
            bounds: SF_BOUNDS,
            limit: 100,
          })
        })
      )

      expect(Array.isArray(observations)).toBe(true)
      expect(observations.length).toBeGreaterThanOrEqual(1)
    })

    it('filters by location ID', async () => {
      const locationId = testLocationId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          yield* repo.insertObservation(createTestObservation(locationId))
        })
      )

      const observations = await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          return yield* repo.findObservations({
            locationId,
            limit: 10,
          })
        })
      )

      expect(observations.length).toBeGreaterThanOrEqual(1)
      for (const obs of observations) {
        expect(obs.location_id).toBe(locationId)
      }
    })

    it('filters by time range', async () => {
      const locationId = testLocationId()
      const now = Date.now()

      // Insert observations at different times
      await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          yield* repo.insertObservations([
            createTestObservation(locationId, new Date(now - 3600000)), // 1 hour ago
            createTestObservation(locationId, new Date(now - 1800000)), // 30 min ago
            createTestObservation(locationId, new Date(now)), // now
          ])
        })
      )

      // Query last 45 minutes only
      const observations = await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          return yield* repo.findObservations({
            locationId,
            from: new Date(now - 2700000), // 45 min ago
            to: new Date(now + 60000),
            limit: 10,
          })
        })
      )

      expect(observations.length).toBe(2) // Should find 30min ago and now
    })
  })

  describe('findNearby', () => {
    it('finds observations near a point', async () => {
      const locationId = testLocationId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag

          // Insert observation at specific location
          yield* repo.insertObservation(
            createTestObservation(locationId, new Date(), {
              longitude: -122.4,
              latitude: 37.78,
            })
          )
        })
      )

      // Query nearby
      const observations = await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          return yield* repo.findNearby({
            longitude: -122.4,
            latitude: 37.78,
            radiusM: 1000,
            maxAgeMinutes: 60,
            limit: 10,
          })
        })
      )

      expect(Array.isArray(observations)).toBe(true)

      // Results should have distance_m
      for (const obs of observations) {
        expect(Option.isSome(obs.distance_m)).toBe(true)
        if (Option.isSome(obs.distance_m)) {
          expect(obs.distance_m.value).toBeLessThanOrEqual(1000)
        }
      }
    })

    it('returns results ordered by distance', async () => {
      const locationId1 = testLocationId()
      const locationId2 = testLocationId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag

          // Insert observations at different distances
          yield* repo.insertObservation(
            createTestObservation(locationId1, new Date(), {
              longitude: -122.41, // ~900m away
              latitude: 37.78,
            })
          )
          yield* repo.insertObservation(
            createTestObservation(locationId2, new Date(), {
              longitude: -122.4, // ~0m away (at center)
              latitude: 37.78,
            })
          )
        })
      )

      const observations = await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          return yield* repo.findNearby({
            longitude: -122.4,
            latitude: 37.78,
            radiusM: 2000,
            maxAgeMinutes: 60,
            limit: 10,
          })
        })
      )

      // First result should be closer
      if (observations.length >= 2) {
        const d1 = Option.getOrElse(observations[0].distance_m, () => Infinity)
        const d2 = Option.getOrElse(observations[1].distance_m, () => Infinity)
        expect(d1).toBeLessThanOrEqual(d2)
      }
    })
  })

  describe('findObservation', () => {
    it('finds observation by location ID and time', async () => {
      const locationId = testLocationId()
      const time = new Date()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          yield* repo.insertObservation(createTestObservation(locationId, time))
        })
      )

      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          return yield* repo.findObservation(locationId, time)
        })
      )

      expect(Option.isSome(result)).toBe(true)
      if (Option.isSome(result)) {
        expect(result.value.location_id).toBe(locationId)
      }
    })

    it('returns None for unknown location', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          return yield* repo.findObservation('unknown_location', new Date())
        })
      )

      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe('getCurrentWeather', () => {
    it('returns most recent observation for location', async () => {
      const locationId = testLocationId()
      const now = Date.now()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag

          // Insert multiple observations
          yield* repo.insertObservations([
            createTestObservation(locationId, new Date(now - 3600000), {
              temperature: Option.some(15),
            }),
            createTestObservation(locationId, new Date(now - 1800000), {
              temperature: Option.some(18),
            }),
            createTestObservation(locationId, new Date(now), {
              temperature: Option.some(22),
            }),
          ])
        })
      )

      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          return yield* repo.getCurrentWeather(locationId)
        })
      )

      expect(Option.isSome(result)).toBe(true)
      if (Option.isSome(result)) {
        expect(result.value.temperature).toBe(22) // Most recent
      }
    })

    it('returns None for unknown location', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          return yield* repo.getCurrentWeather('unknown_location_xyz')
        })
      )

      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe('getCurrentWeatherNearby', () => {
    it('finds current weather near a point', async () => {
      const locationId = testLocationId()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag

          yield* repo.insertObservation(
            createTestObservation(locationId, new Date(), {
              longitude: -122.4,
              latitude: 37.78,
              temperature: Option.some(21),
            })
          )
        })
      )

      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          return yield* repo.getCurrentWeatherNearby(-122.4, 37.78, 5000)
        })
      )

      expect(Option.isSome(result)).toBe(true)
    })
  })

  describe('countObservations', () => {
    it('counts observations matching criteria', async () => {
      const locationId = testLocationId()

      // Insert 5 observations
      await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          const now = Date.now()
          yield* repo.insertObservations(
            Array.from({ length: 5 }, (_, i) =>
              createTestObservation(locationId, new Date(now - i * 60000))
            )
          )
        })
      )

      const count = await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          return yield* repo.countObservations({ locationId })
        })
      )

      expect(count).toBe(5)
    })

    it('returns 0 for no matches', async () => {
      const count = await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          return yield* repo.countObservations({
            locationId: 'nonexistent_location_xyz123',
          })
        })
      )

      expect(count).toBe(0)
    })
  })

  describe('getLocationStats', () => {
    it('returns statistics for location', async () => {
      const locationId = testLocationId()

      // Insert observations with varying temperatures
      await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          const now = Date.now()
          yield* repo.insertObservations([
            createTestObservation(locationId, new Date(now - 3600000), {
              temperature: Option.some(10),
            }),
            createTestObservation(locationId, new Date(now - 1800000), {
              temperature: Option.some(20),
            }),
            createTestObservation(locationId, new Date(now), {
              temperature: Option.some(30),
            }),
          ])
        })
      )

      const stats = await runTest(
        Effect.gen(function* () {
          const repo = yield* WeatherRepositoryTag
          return yield* repo.getLocationStats(locationId, 24)
        })
      )

      expect(stats.observation_count).toBe(3)
      expect(stats.min_temperature).toBe(10)
      expect(stats.max_temperature).toBe(30)
      expect(stats.avg_temperature).toBe(20) // (10+20+30)/3
    })
  })

  describe('makeLocationId', () => {
    it('generates consistent location IDs', () => {
      const id1 = makeLocationId(-122.4, 37.78)
      const id2 = makeLocationId(-122.4, 37.78)
      expect(id1).toBe(id2)
    })

    it('generates different IDs for different locations', () => {
      const id1 = makeLocationId(-122.4, 37.78)
      const id2 = makeLocationId(-122.5, 37.79)
      expect(id1).not.toBe(id2)
    })

    it('generates expected format', () => {
      const id = makeLocationId(-122.4, 37.78)
      expect(id).toBe('37.7800_-122.4000')
    })
  })
})
