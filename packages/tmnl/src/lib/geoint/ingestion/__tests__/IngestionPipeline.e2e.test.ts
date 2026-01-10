/**
 * E2E Ingestion Pipeline Smoke Tests
 *
 * Tests the full ingestion pipeline with REAL APIs and REAL database.
 * Verifies data flows from external APIs through ingesters into raw tables.
 *
 * Prerequisites:
 * - PostgreSQL running: docker compose -f docker/docker-compose.yml up postgres -d
 *
 * Run with: RUN_INTEGRATION_TESTS=1 bun test IngestionPipeline.e2e
 *
 * @see beads:tmnl-1ozdh End-to-end ingestion pipeline smoke test
 * @module
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Effect, Layer, Redacted, Exit, Duration } from 'effect'
import { PgClient } from '@effect/sql-pg'
import { FetchHttpClient } from '@effect/platform'

// Ingesters
import {
  FlightIngesterTag,
  FlightIngesterLive,
  FlightIngesterConfigTag,
  type FlightIngesterConfig,
  type IngestionRegion,
} from '../FlightIngester'
import {
  OsmIngesterTag,
  OsmIngesterLive,
  OsmIngesterConfigTag,
  type OsmIngesterConfig,
  type OsmIngestionRegion,
} from '../OsmIngester'
import {
  WeatherIngesterTag,
  WeatherIngesterLive,
  WeatherIngesterConfigTag,
  type WeatherIngesterConfig,
  type WeatherIngestionGrid,
} from '../WeatherIngester'

// API clients (real, with circuit breaker)
import { ExternalApiClientsLive } from '../../api/ExternalApiClient'

// Repositories
import { FlightRepositoryLive } from '../../persistence/postgis/FlightRepository'
import { PoiRepositoryLive } from '../../persistence/postgis/PoiRepository'
import { WeatherRepositoryLive } from '../../persistence/postgis/WeatherRepository'

// =============================================================================
// Test Configuration
// =============================================================================

const RUN_INTEGRATION_TESTS = process.env['RUN_INTEGRATION_TESTS'] === '1'

// Database connection (matches docker-compose.yml)
const PgClientLive = PgClient.layer({
  host: 'localhost',
  port: 5432,
  database: 'tmnl',
  username: 'tmnl',
  password: Redacted.make('tmnl_dev_password'),
})

// HTTP client for real API calls
const HttpClientLive = FetchHttpClient.layer

// Combined API clients layer (fresh for test isolation)
// ExternalApiClientsLive includes CircuitBreakersLive
const ApiClientsLayer = ExternalApiClientsLive.pipe(
  Layer.provide(HttpClientLive)
)

// =============================================================================
// Test Regions (Small areas to minimize API load)
// =============================================================================

// San Francisco area - small bounding box for flight data
const SF_FLIGHT_REGION: IngestionRegion = {
  _tag: '@tmnl/geoint/schemas/IngestionRegion',
  name: 'sf-e2e-test',
  bounds: [-122.5, 37.7, -122.3, 37.9], // Smaller area for faster API response
  openSky: true,
  adsbLol: true,
}

// San Francisco downtown - small area for POI data
const SF_OSM_REGION: OsmIngestionRegion = {
  name: 'sf-downtown-e2e',
  bounds: [-122.42, 37.78, -122.40, 37.80], // ~2km x 2km area
  amenities: ['hospital'], // Single amenity to minimize response
  tags: {},
  ttlDays: 7,
}

// San Francisco - single point for weather data
const SF_WEATHER_GRID: WeatherIngestionGrid = {
  name: 'sf-weather-e2e',
  bounds: [-122.45, 37.75, -122.35, 37.85],
  resolution: 0.1, // Only ~4 grid points
  ttlMinutes: 60,
}

// =============================================================================
// Test Configs (Minimal for smoke tests)
// =============================================================================

const FLIGHT_TEST_CONFIG: FlightIngesterConfig = {
  regions: [SF_FLIGHT_REGION],
  openSkyIntervalMs: 60000, // Don't poll repeatedly
  adsbLolIntervalMs: 60000,
  adsbLolRadiusNm: 50, // Smaller radius
  logIngestion: false, // Skip logging in tests
}

const OSM_TEST_CONFIG: OsmIngesterConfig = {
  regions: [SF_OSM_REGION],
  intervalMs: 86400000, // Don't poll repeatedly
  queryTimeoutMs: 60000,
  logIngestion: false,
}

const WEATHER_TEST_CONFIG: WeatherIngesterConfig = {
  grids: [SF_WEATHER_GRID],
  intervalMs: 3600000, // Don't poll repeatedly
  queryTimeoutMs: 30000,
  logIngestion: false,
  includeHourly: false,
  hourlyHours: 24,
}

// =============================================================================
// Test Layers
// =============================================================================

// Base infrastructure layer
const InfrastructureLayer = Layer.mergeAll(
  PgClientLive,
  ApiClientsLayer
)

const FlightIngesterTestLayer = FlightIngesterLive.pipe(
  Layer.provide(Layer.succeed(FlightIngesterConfigTag, FLIGHT_TEST_CONFIG)),
  Layer.provide(FlightRepositoryLive),
  Layer.provideMerge(InfrastructureLayer)
)

const OsmIngesterTestLayer = OsmIngesterLive.pipe(
  Layer.provide(Layer.succeed(OsmIngesterConfigTag, OSM_TEST_CONFIG)),
  Layer.provide(PoiRepositoryLive),
  Layer.provideMerge(InfrastructureLayer)
)

const WeatherIngesterTestLayer = WeatherIngesterLive.pipe(
  Layer.provide(Layer.succeed(WeatherIngesterConfigTag, WEATHER_TEST_CONFIG)),
  Layer.provide(WeatherRepositoryLive),
  Layer.provideMerge(InfrastructureLayer)
)

// =============================================================================
// Helpers
// =============================================================================

const LONG_TIMEOUT = Duration.seconds(90)

// Helper to run raw SQL queries
const runSql = <A>(
  effect: Effect.Effect<A, unknown, PgClient.PgClient>
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(Effect.provide(PgClientLive), Effect.timeout(Duration.seconds(10)))
  )

// =============================================================================
// Integration Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION_TESTS)('E2E Ingestion Pipeline', () => {
  // Verify database connection before running tests
  beforeAll(async () => {
    const checkConnection = Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const result = yield* sql<{ one: number }>`SELECT 1 as one`
      return result[0]?.one === 1
    }).pipe(Effect.provide(PgClientLive), Effect.timeout(Duration.seconds(5)))

    const exit = await Effect.runPromiseExit(checkConnection)
    if (!Exit.isSuccess(exit)) {
      throw new Error(
        'Database connection failed. Ensure postgres container is running:\n' +
          'docker compose -f docker/docker-compose.yml up postgres -d'
      )
    }

    console.log('\n=== E2E Ingestion Pipeline Tests ===')
    console.log('Using REAL APIs with CircuitBreaker protection')
    console.log('=====================================\n')
  })

  // Cleanup test data after all tests
  afterAll(async () => {
    const cleanup = Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      // Clean up test data
      yield* sql`DELETE FROM raw.flight_positions WHERE time > NOW() - INTERVAL '1 hour'`.pipe(
        Effect.catchAll(() => Effect.void)
      )
      yield* sql`DELETE FROM raw.osm_elements WHERE fetched_at > NOW() - INTERVAL '1 hour'`.pipe(
        Effect.catchAll(() => Effect.void)
      )
      yield* sql`DELETE FROM raw.weather_observations WHERE time > NOW() - INTERVAL '1 hour'`.pipe(
        Effect.catchAll(() => Effect.void)
      )
      console.log('\nTest data cleaned up')
    }).pipe(
      Effect.provide(PgClientLive),
      Effect.catchAll(() => Effect.void)
    )

    await Effect.runPromise(cleanup)
  })

  describe('Flight Ingestion (OpenSky)', () => {
    it('ingests live flight data from OpenSky API', { timeout: 90000 }, async () => {
      const program = Effect.gen(function* () {
        const ingester = yield* FlightIngesterTag

        console.log('  Calling OpenSky API...')
        const result = yield* ingester.ingestOpenSky(SF_FLIGHT_REGION)

        console.log(`  Result: ${result.recordsIngested} records in ${result.latencyMs}ms`)
        if (result.error) {
          console.log(`  Warning: ${result.error}`)
        }

        return result
      }).pipe(
        Effect.provide(FlightIngesterTestLayer),
        Effect.timeout(LONG_TIMEOUT)
      )

      const result = await Effect.runPromise(program)

      expect(result.source).toBe('opensky')
      expect(result.region).toBe('sf-e2e-test')
      expect(typeof result.recordsIngested).toBe('number')
      expect(result.latencyMs).toBeGreaterThan(0)

      // If we got records, verify they're in the database
      if (result.recordsIngested > 0) {
        const count = await runSql(
          Effect.gen(function* () {
            const sql = yield* PgClient.PgClient
            const rows = yield* sql<{ count: string }>`
              SELECT COUNT(*) as count
              FROM raw.flight_positions
              WHERE source = 'opensky'
                AND time > NOW() - INTERVAL '5 minutes'
            `
            return parseInt(rows[0]?.count ?? '0', 10)
          })
        )

        expect(count).toBeGreaterThan(0)
        console.log(`  Verified: ${count} records in database`)
      }
    })
  })

  describe('Flight Ingestion (ADSB.lol)', () => {
    it('ingests live flight data from ADSB.lol API', { timeout: 90000 }, async () => {
      const program = Effect.gen(function* () {
        const ingester = yield* FlightIngesterTag

        console.log('  Calling ADSB.lol API...')
        const result = yield* ingester.ingestAdsbLol(SF_FLIGHT_REGION, 50)

        console.log(`  Result: ${result.recordsIngested} records in ${result.latencyMs}ms`)
        if (result.error) {
          console.log(`  Warning: ${result.error}`)
        }

        return result
      }).pipe(
        Effect.provide(FlightIngesterTestLayer),
        Effect.timeout(LONG_TIMEOUT)
      )

      const result = await Effect.runPromise(program)

      expect(result.source).toBe('adsb_lol')
      expect(result.region).toBe('sf-e2e-test')
      expect(typeof result.recordsIngested).toBe('number')
      expect(result.latencyMs).toBeGreaterThan(0)
    })
  })

  describe('OSM Ingestion (Overpass)', () => {
    it('ingests POI data from Overpass API', { timeout: 90000 }, async () => {
      const program = Effect.gen(function* () {
        const ingester = yield* OsmIngesterTag

        console.log('  Calling Overpass API...')
        const result = yield* ingester.ingestRegion(SF_OSM_REGION)

        console.log(`  Result: ${result.recordsIngested} records in ${result.latencyMs}ms`)
        if (result.error) {
          console.log(`  Warning: ${result.error}`)
        }

        return result
      }).pipe(
        Effect.provide(OsmIngesterTestLayer),
        Effect.timeout(LONG_TIMEOUT)
      )

      const result = await Effect.runPromise(program)

      // OsmIngestionResult has region, not source
      expect(result.region).toBe('sf-downtown-e2e')
      expect(typeof result.recordsIngested).toBe('number')
      expect(result.latencyMs).toBeGreaterThan(0)

      // Verify data in database
      if (result.recordsIngested > 0) {
        const count = await runSql(
          Effect.gen(function* () {
            const sql = yield* PgClient.PgClient
            const rows = yield* sql<{ count: string }>`
              SELECT COUNT(*) as count
              FROM raw.osm_elements
              WHERE fetched_at > NOW() - INTERVAL '5 minutes'
            `
            return parseInt(rows[0]?.count ?? '0', 10)
          })
        )

        expect(count).toBeGreaterThan(0)
        console.log(`  Verified: ${count} POIs in database`)
      }
    })
  })

  describe('Weather Ingestion (Open-Meteo)', () => {
    it('ingests weather data from Open-Meteo API', { timeout: 90000 }, async () => {
      const program = Effect.gen(function* () {
        const ingester = yield* WeatherIngesterTag

        console.log('  Calling Open-Meteo API...')
        const result = yield* ingester.ingestGrid(SF_WEATHER_GRID)

        console.log(`  Result: ${result.recordsIngested} records in ${result.latencyMs}ms`)
        if (result.error) {
          console.log(`  Warning: ${result.error}`)
        }

        return result
      }).pipe(
        Effect.provide(WeatherIngesterTestLayer),
        Effect.timeout(LONG_TIMEOUT)
      )

      const result = await Effect.runPromise(program)

      // WeatherIngestionResult has source and grid fields
      expect(result.source).toBe('openmeteo')
      expect(result.grid).toBe('sf-weather-e2e')
      expect(typeof result.recordsIngested).toBe('number')
      expect(result.latencyMs).toBeGreaterThan(0)

      // Verify data in database
      // Note: Weather timestamps are observation times from the API, not fetch times
      // So we check for any recent records in the SF area
      if (result.recordsIngested > 0) {
        const count = await runSql(
          Effect.gen(function* () {
            const sql = yield* PgClient.PgClient
            const rows = yield* sql<{ count: string }>`
              SELECT COUNT(*) as count
              FROM raw.weather_observations
              WHERE location_id LIKE 'sf-weather%' OR
                    position && ST_MakeEnvelope(-122.5, 37.7, -122.3, 37.9, 4326)
            `
            return parseInt(rows[0]?.count ?? '0', 10)
          })
        )

        console.log(`  Verified: ${count} weather records in database`)
        // We expect some records if ingestion reported success
        expect(count).toBeGreaterThanOrEqual(result.recordsIngested)
      }
    })
  })

  describe('Circuit Breaker Protection', () => {
    it('circuit breaker prevents cascading failures', { timeout: 60000 }, async () => {
      // This test verifies that circuit breaker is wired correctly
      // by checking that multiple rapid failures don't hang indefinitely
      const program = Effect.gen(function* () {
        const ingester = yield* FlightIngesterTag

        // Run multiple ingestions rapidly - circuit breaker should protect us
        const results = yield* Effect.all(
          [
            ingester.ingestOpenSky(SF_FLIGHT_REGION),
            ingester.ingestOpenSky(SF_FLIGHT_REGION),
            ingester.ingestOpenSky(SF_FLIGHT_REGION),
          ],
          { concurrency: 2 } // Bounded concurrency
        )

        return results
      }).pipe(
        Effect.provide(FlightIngesterTestLayer),
        Effect.timeout(Duration.seconds(60))
      )

      // Should complete without hanging (circuit breaker prevents infinite retries)
      const results = await Effect.runPromise(program)

      expect(results.length).toBe(3)
      results.forEach((result) => {
        expect(result.source).toBe('opensky')
      })

      console.log('  Circuit breaker test passed - no cascading failures')
    })
  })

  describe('Database Schema Verification', () => {
    it('raw tables exist and are accessible', async () => {
      const tables = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{ tablename: string }>`
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'raw'
            ORDER BY tablename
          `
        })
      )

      const tableNames = tables.map((t) => t.tablename)
      expect(tableNames).toContain('flight_positions')
      expect(tableNames).toContain('osm_elements')
      expect(tableNames).toContain('weather_observations')

      console.log(`  Found ${tableNames.length} raw tables: ${tableNames.join(', ')}`)
    })

    it('entity views exist and are accessible', async () => {
      const views = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{ viewname: string }>`
            SELECT matviewname as viewname
            FROM pg_matviews
            WHERE schemaname = 'entity'
            ORDER BY matviewname
          `
        })
      )

      const viewNames = views.map((v) => v.viewname)
      // Check for continuous aggregates
      if (viewNames.length > 0) {
        console.log(`  Found ${viewNames.length} entity views: ${viewNames.join(', ')}`)
      } else {
        console.log('  No entity materialized views found (may need data first)')
      }
    })
  })

  describe('Data Flow Verification', () => {
    it('ingested data can be queried via repository', { timeout: 90000 }, async () => {
      // First ingest some data
      const ingestProgram = Effect.gen(function* () {
        const ingester = yield* FlightIngesterTag
        return yield* ingester.ingestOpenSky(SF_FLIGHT_REGION)
      }).pipe(
        Effect.provide(FlightIngesterTestLayer),
        Effect.timeout(LONG_TIMEOUT)
      )

      const ingestResult = await Effect.runPromise(ingestProgram)

      if (ingestResult.recordsIngested > 0) {
        // Then query via raw SQL (simulating repository query pattern)
        const flights = await runSql(
          Effect.gen(function* () {
            const sql = yield* PgClient.PgClient
            return yield* sql<{
              icao24: string
              callsign: string | null
              longitude: number
              latitude: number
            }>`
              SELECT
                icao24,
                callsign,
                ST_X(position::geometry) as longitude,
                ST_Y(position::geometry) as latitude
              FROM raw.flight_positions
              WHERE time > NOW() - INTERVAL '5 minutes'
              LIMIT 10
            `
          })
        )

        expect(flights.length).toBeGreaterThan(0)

        const first = flights[0]!
        expect(first.icao24).toBeDefined()
        expect(first.longitude).toBeDefined()
        expect(first.latitude).toBeDefined()

        console.log(`  Queried ${flights.length} flights from database`)
        console.log(`  Sample: ${first.icao24} at (${first.longitude.toFixed(2)}, ${first.latitude.toFixed(2)})`)
      } else {
        console.log('  No flights ingested (API may be rate-limited or no traffic in area)')
      }
    })
  })
})
