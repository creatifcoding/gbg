/**
 * GeointRepository (Facade) Integration Tests
 *
 * Tests the unified GEOINT repository facade against a real PostgreSQL database.
 * Validates cross-domain operations and unified search capabilities.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 bun test src/lib/geoint/persistence/postgis/__tests__/GeointRepository.integration.test.ts
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
  GeointRepositoryTag,
  GeointRepositoryLive,
} from '../GeointRepository'
import { type FlightPositionInput } from '../FlightRepository'
import { type PoiInput } from '../PoiRepository'
import { type WeatherObservationInput } from '../WeatherRepository'
import { type ImageryItemInput, type ImageryProvider } from '../ImageryRepository'

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

// Combined test layer - provides GeointRepository with all domain repos and PgClient
const TestLayer = GeointRepositoryLive.pipe(Layer.provide(PgClientLive))

// Test bounds (San Francisco area)
const SF_BOUNDS: readonly [number, number, number, number] = [
  -122.5, 37.5, -122.0, 38.0,
]

// Generate unique IDs for tests
const testPrefix = `test-${Date.now()}`
const testIcao24 = () => `${testPrefix.slice(-6)}-${Math.random().toString(36).slice(2, 6)}`
const testOsmId = (): bigint => BigInt(-Date.now()) - BigInt(Math.floor(Math.random() * 10000))
const testLocationId = () => `${testPrefix}-${Math.random().toString(36).slice(2, 8)}`
const testItemId = () => `${testPrefix}-${Math.random().toString(36).slice(2, 8)}`

// =============================================================================
// Test Fixtures
// =============================================================================

const createTestFlightPosition = (
  icao24: string
): FlightPositionInput => ({
  _tag: 'FlightPositionInput',
  time: new Date(),
  icao24,
  source: 'opensky',
  raw: { test: true },
  longitude: -122.4,
  latitude: 37.78,
  altitudeM: Option.some(10000),
  headingDeg: Option.some(90),
  velocityMps: Option.some(250),
  verticalRate: Option.some(0),
  onGround: Option.some(false),
  callsign: Option.some('TEST123'),
  squawk: Option.some('1200'),
  category: Option.some('A1'),
  originCountry: Option.some('United States'),
})

const createTestPoi = (osmId: bigint): PoiInput => ({
  _tag: 'PoiInput',
  osmId,
  osmType: 'node',
  raw: { test: true },
  geometry: { type: 'Point', coordinates: [-122.42, 37.76] },
  centroidLon: Option.some(-122.42),
  centroidLat: Option.some(37.76),
  tags: { name: 'Test POI', amenity: 'restaurant' },
  queryBbox: Option.none(),
  ttlDays: Option.some(7),
})

const createTestWeatherObservation = (
  locationId: string
): WeatherObservationInput => ({
  _tag: 'WeatherObservationInput',
  time: new Date(),
  locationId,
  raw: { test: true },
  longitude: -122.38,
  latitude: 37.8,
  temperature: Option.some(18.5),
  feelsLike: Option.some(17.0),
  humidity: Option.some(65),
  pressure: Option.some(1013.25),
  weatherCode: Option.some(0),
  weatherDesc: Option.some('Clear sky'),
  windSpeed: Option.some(5.5),
  windDir: Option.some(270),
  windGusts: Option.none(),
  precipitation: Option.none(),
  rain: Option.none(),
  snow: Option.none(),
  visibility: Option.some(10000),
  cloudCover: Option.some(10),
})

const createTestImageryItem = (itemId: string): ImageryItemInput => ({
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
  centroidLon: Option.some(-122.35),
  centroidLat: Option.some(37.72),
})

// Helper to run effects with the test layer
const runTest = <A, E>(
  effect: Effect.Effect<A, E, GeointRepositoryTag>
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(TestLayer),
      Effect.timeout('20 seconds'),
      Effect.catchTag('TimeoutException', () =>
        Effect.die(new Error('Test timed out'))
      )
    )
  )

// Helper to run raw SQL for cleanup
const runSql = <A>(
  effect: Effect.Effect<A, unknown, PgClient.PgClient>
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(Effect.provide(PgClientLive), Effect.timeout('5 seconds'))
  )

// =============================================================================
// Integration Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION_TESTS)('GeointRepository Integration', () => {
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
      yield* sql`DELETE FROM raw.flight_positions WHERE icao24 LIKE 'test-%'`
      yield* sql`DELETE FROM raw.osm_elements WHERE osm_id < 0`
      yield* sql`DELETE FROM raw.weather_observations WHERE location_id LIKE 'test-%'`
      yield* sql`DELETE FROM raw.imagery_items WHERE item_id LIKE 'test-%'`
    }).pipe(
      Effect.provide(PgClientLive),
      Effect.catchAll(() => Effect.void)
    )

    await Effect.runPromise(cleanup)
  })

  describe('Individual Repository Access', () => {
    it('provides access to flight repository', async () => {
      await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag
          expect(geoint.flight).toBeDefined()
          expect(typeof geoint.flight.findCurrentFlights).toBe('function')
        })
      )
    })

    it('provides access to POI repository', async () => {
      await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag
          expect(geoint.poi).toBeDefined()
          expect(typeof geoint.poi.findPois).toBe('function')
        })
      )
    })

    it('provides access to weather repository', async () => {
      await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag
          expect(geoint.weather).toBeDefined()
          expect(typeof geoint.weather.findObservations).toBe('function')
        })
      )
    })

    it('provides access to imagery repository', async () => {
      await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag
          expect(geoint.imagery).toBeDefined()
          expect(typeof geoint.imagery.findItems).toBe('function')
        })
      )
    })
  })

  describe('searchAll', () => {
    it('searches all domains in parallel', async () => {
      // Insert test data in each domain
      const icao24 = testIcao24()
      const osmId = testOsmId()
      const locationId = testLocationId()
      const itemId = testItemId()

      await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag

          // Insert test data
          yield* geoint.flight.insertPosition(createTestFlightPosition(icao24))
          yield* geoint.poi.upsertPoi(createTestPoi(osmId))
          yield* geoint.weather.insertObservation(createTestWeatherObservation(locationId))
          yield* geoint.imagery.insertItem(createTestImageryItem(itemId))
        })
      )

      // Search all domains
      const result = await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag
          return yield* geoint.searchAll({
            bounds: SF_BOUNDS,
            limitPerDomain: 50,
          })
        })
      )

      expect(result).toBeDefined()
      expect(Array.isArray(result.flights)).toBe(true)
      expect(Array.isArray(result.pois)).toBe(true)
      expect(Array.isArray(result.weather)).toBe(true)
      expect(Array.isArray(result.imagery)).toBe(true)
    })

    it('filters by specific domains', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag
          return yield* geoint.searchAll({
            bounds: SF_BOUNDS,
            domains: ['flight', 'poi'], // Only these domains
            limitPerDomain: 10,
          })
        })
      )

      expect(result).toBeDefined()
      // Weather and imagery should be empty when not requested
      // (they still have arrays, just empty)
      expect(Array.isArray(result.flights)).toBe(true)
      expect(Array.isArray(result.pois)).toBe(true)
    })

    it('handles errors gracefully', async () => {
      // Even with potentially empty/failing queries, should return results
      const result = await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag
          return yield* geoint.searchAll({
            bounds: [-180, -90, -179, -89], // Remote area with no data
            limitPerDomain: 10,
          })
        })
      )

      expect(result).toBeDefined()
      expect(Array.isArray(result.flights)).toBe(true)
      expect(Array.isArray(result.pois)).toBe(true)
    })
  })

  describe('searchNearby', () => {
    it('searches nearby across all domains', async () => {
      // Insert test data
      const osmId = testOsmId()

      await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag
          yield* geoint.poi.upsertPoi(createTestPoi(osmId))
        })
      )

      const result = await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag
          return yield* geoint.searchNearby({
            longitude: -122.4,
            latitude: 37.78,
            radiusM: 50000, // 50km
            limitPerDomain: 10,
          })
        })
      )

      expect(result).toBeDefined()
      expect(Array.isArray(result.flights)).toBe(true)
      expect(Array.isArray(result.pois)).toBe(true)
      expect(Array.isArray(result.weather)).toBe(true)
      expect(Array.isArray(result.imagery)).toBe(true)
    })

    it('limits results per domain', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag
          return yield* geoint.searchNearby({
            longitude: -122.4,
            latitude: 37.78,
            radiusM: 100000,
            limitPerDomain: 5,
          })
        })
      )

      expect(result.pois.length).toBeLessThanOrEqual(5)
      expect(result.flights.length).toBeLessThanOrEqual(5)
    })
  })

  describe('healthCheck', () => {
    it('returns health status for all domains', async () => {
      const health = await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag
          return yield* geoint.healthCheck()
        })
      )

      expect(Array.isArray(health)).toBe(true)
      expect(health.length).toBe(4) // All 4 domains

      for (const check of health) {
        expect(['flight', 'poi', 'weather', 'imagery']).toContain(check.domain)
        expect(['healthy', 'unhealthy', 'unknown']).toContain(check.status)
        if (check.status === 'healthy') {
          expect(check.latencyMs).toBeDefined()
          expect(typeof check.latencyMs).toBe('number')
        }
      }
    })

    it('all domains should be healthy with database running', async () => {
      const health = await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag
          return yield* geoint.healthCheck()
        })
      )

      const healthyCount = health.filter((h) => h.status === 'healthy').length
      expect(healthyCount).toBe(4) // All should be healthy
    })
  })

  describe('getStats', () => {
    it('returns statistics for all domains', async () => {
      const stats = await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag
          return yield* geoint.getStats()
        })
      )

      expect(stats).toBeDefined()

      // Flight stats
      expect(typeof stats.flights.count).toBe('number')
      expect(typeof stats.flights.recentCount).toBe('number')

      // POI stats
      expect(typeof stats.pois.count).toBe('number')
      expect(typeof stats.pois.expiredCount).toBe('number')

      // Weather stats
      expect(typeof stats.weather.count).toBe('number')
      expect(typeof stats.weather.locationCount).toBe('number')

      // Imagery stats
      expect(typeof stats.imagery.count).toBe('number')
      expect(typeof stats.imagery.providerCounts).toBe('object')
    })

    it('reflects inserted data', async () => {
      const icao24 = testIcao24()

      await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag
          yield* geoint.flight.insertPosition(createTestFlightPosition(icao24))
        })
      )

      const stats = await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag
          return yield* geoint.getStats()
        })
      )

      expect(stats.flights.count).toBeGreaterThan(0)
    })
  })

  describe('Cross-Domain Operations', () => {
    it('can insert and query data across all domains in single effect', async () => {
      const icao24 = testIcao24()
      const osmId = testOsmId()
      const locationId = testLocationId()
      const itemId = testItemId()

      const result = await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag

          // Insert data in all domains
          yield* geoint.flight.insertPosition(createTestFlightPosition(icao24))
          yield* geoint.poi.upsertPoi(createTestPoi(osmId))
          yield* geoint.weather.insertObservation(createTestWeatherObservation(locationId))
          yield* geoint.imagery.insertItem(createTestImageryItem(itemId))

          // Query all domains
          const search = yield* geoint.searchAll({
            bounds: SF_BOUNDS,
            limitPerDomain: 100,
          })

          return search
        })
      )

      // Should find inserted data
      expect(result.flights.length).toBeGreaterThan(0)
      expect(result.pois.length).toBeGreaterThan(0)
    })

    it('handles concurrent operations', async () => {
      const ids = Array.from({ length: 5 }, () => testOsmId())

      await runTest(
        Effect.gen(function* () {
          const geoint = yield* GeointRepositoryTag

          // Insert multiple POIs concurrently
          yield* Effect.all(
            ids.map((id) => geoint.poi.upsertPoi(createTestPoi(id))),
            { concurrency: 5 }
          )

          // All should be inserted
          const count = yield* geoint.poi.countPois()
          expect(count).toBeGreaterThanOrEqual(5)
        })
      )
    })
  })
})
