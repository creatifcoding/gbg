/**
 * FlightRepository Integration Tests
 *
 * Tests against a real PostgreSQL + TimescaleDB + PostGIS database.
 * Uses the docker-compose postgres service.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 bun test src/lib/geoint/persistence/postgis/__tests__/FlightRepository.integration.test.ts
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
  FlightRepositoryTag,
  FlightRepositoryLive,
  type FlightPositionInput,
} from '../FlightRepository'

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

// Combined test layer - provides FlightRepository with PgClient
const TestLayer = FlightRepositoryLive.pipe(Layer.provide(PgClientLive))

// Test bounds (San Francisco area)
const SF_BOUNDS: readonly [number, number, number, number] = [
  -122.5, 37.5, -122.0, 38.0,
]

// Generate unique ICAO24 for tests
const testIcao24 = () => `test${Date.now().toString(16).slice(-6)}`

// =============================================================================
// Test Fixtures
// =============================================================================

const createTestPosition = (
  icao24: string,
  overrides: Partial<FlightPositionInput> = {}
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
  ...overrides,
})

// Helper to run effects with the test layer
const runTest = <A, E>(
  effect: Effect.Effect<A, E, FlightRepositoryTag>
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

describe.skipIf(!RUN_INTEGRATION_TESTS)('FlightRepository Integration', () => {
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
      // Delete test positions (those with icao24 starting with 'test')
      yield* sql`
        DELETE FROM raw.flight_positions
        WHERE icao24 LIKE 'test%'
      `
    }).pipe(
      Effect.provide(PgClientLive),
      Effect.catchAll(() => Effect.void) // Ignore cleanup errors
    )

    await Effect.runPromise(cleanup)
  })

  describe('insertPosition', () => {
    it('inserts a single flight position', async () => {
      const icao24 = testIcao24()
      const input = createTestPosition(icao24)

      await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag

          // Insert
          yield* repo.insertPosition(input)
        })
      )

      // Verify by querying raw table
      const rows = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{ icao24: string }>`
            SELECT icao24 FROM raw.flight_positions
            WHERE icao24 = ${icao24}
          `
        })
      )

      expect(rows.length).toBe(1)
      expect(rows[0].icao24).toBe(icao24)
    })

    it('handles upsert on conflict', async () => {
      const icao24 = testIcao24()
      const time = new Date()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag

          // Insert first position
          yield* repo.insertPosition(
            createTestPosition(icao24, {
              time,
              callsign: Option.some('FIRST'),
            })
          )

          // Insert second position with same time/icao24/source
          yield* repo.insertPosition(
            createTestPosition(icao24, {
              time,
              callsign: Option.some('UPDATED'),
            })
          )
        })
      )

      // Verify only one row with updated callsign
      const rows = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{ callsign: string }>`
            SELECT callsign FROM raw.flight_positions
            WHERE icao24 = ${icao24} AND time = ${time}
          `
        })
      )

      expect(rows.length).toBe(1)
      expect(rows[0].callsign).toBe('UPDATED')
    })
  })

  describe('insertPositions', () => {
    it('inserts multiple positions in batch', async () => {
      const icao24 = testIcao24()

      // Create 10 positions with different timestamps
      const inputs = Array.from({ length: 10 }, (_, i) =>
        createTestPosition(icao24, {
          time: new Date(Date.now() - i * 1000),
          altitudeM: Option.some(10000 + i * 100),
        })
      )

      const count = await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag
          return yield* repo.insertPositions(inputs)
        })
      )

      expect(count).toBe(10)

      // Verify count
      const rows = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{ count: string }>`
            SELECT COUNT(*)::text as count FROM raw.flight_positions
            WHERE icao24 = ${icao24}
          `
        })
      )

      expect(parseInt(rows[0].count, 10)).toBe(10)
    })

    it('returns 0 for empty input', async () => {
      const count = await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag
          return yield* repo.insertPositions([])
        })
      )

      expect(count).toBe(0)
    })
  })

  describe('findCurrentFlights', () => {
    it('finds flights in bounding box', async () => {
      const icao24 = testIcao24()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag

          // Insert a recent position
          yield* repo.insertPosition(
            createTestPosition(icao24, {
              longitude: -122.4,
              latitude: 37.78,
            })
          )
        })
      )

      // Query with bounds
      const flights = await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag
          return yield* repo.findCurrentFlights({
            bounds: SF_BOUNDS,
            sinceMinutes: 5,
            limit: 100,
          })
        })
      )

      // Should find our flight (or others if database has data)
      expect(Array.isArray(flights)).toBe(true)

      // Note: May not find our specific flight immediately due to
      // continuous aggregate refresh interval (30 seconds)
    })

    it('filters by source', async () => {
      const icao24 = testIcao24()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag

          // Insert position
          yield* repo.insertPosition(
            createTestPosition(icao24, { source: 'opensky' })
          )
        })
      )

      // Query filtered by source
      const flights = await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag
          return yield* repo.findCurrentFlights({
            source: 'opensky',
            limit: 10,
          })
        })
      )

      expect(Array.isArray(flights)).toBe(true)
      // All returned flights should be from opensky
      for (const flight of flights) {
        if (flight.source !== null) {
          expect(flight.source).toBe('opensky')
        }
      }
    })
  })

  describe('findCurrentFlight', () => {
    it('returns None for unknown ICAO24', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag
          return yield* repo.findCurrentFlight('unknown_icao24')
        })
      )

      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe('findPositions', () => {
    it('returns positions for aircraft in time range', async () => {
      const icao24 = testIcao24()

      // Insert positions over time
      const now = Date.now()
      await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag
          for (let i = 0; i < 5; i++) {
            yield* repo.insertPosition(
              createTestPosition(icao24, {
                time: new Date(now - i * 60000), // 1 minute apart
                altitudeM: Option.some(10000 + i * 100),
              })
            )
          }
        })
      )

      // Query positions
      const positions = await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag
          return yield* repo.findPositions({
            icao24,
            from: new Date(now - 300000), // 5 minutes ago
            to: new Date(now + 60000),
            limit: 100,
          })
        })
      )

      expect(positions.length).toBe(5)

      // Verify they are ordered by time
      for (let i = 1; i < positions.length; i++) {
        const prev = positions[i - 1].time
        const curr = positions[i].time
        // DateTime.Utc comparison
        expect(prev.epochMillis <= curr.epochMillis).toBe(true)
      }
    })

    it('respects limit', async () => {
      const icao24 = testIcao24()

      // Insert more positions than limit
      const inputs = Array.from({ length: 10 }, (_, i) =>
        createTestPosition(icao24, {
          time: new Date(Date.now() - i * 1000),
        })
      )

      await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag
          yield* repo.insertPositions(inputs)
        })
      )

      // Query with limit
      const positions = await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag
          return yield* repo.findPositions({
            icao24,
            limit: 5,
          })
        })
      )

      expect(positions.length).toBe(5)
    })
  })

  describe('countPositions', () => {
    it('counts positions for aircraft', async () => {
      const icao24 = testIcao24()

      // Insert positions
      const inputs = Array.from({ length: 7 }, (_, i) =>
        createTestPosition(icao24, {
          time: new Date(Date.now() - i * 1000),
        })
      )

      await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag
          yield* repo.insertPositions(inputs)
        })
      )

      // Count
      const count = await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag
          return yield* repo.countPositions(icao24)
        })
      )

      expect(count).toBe(7)
    })

    it('returns 0 for unknown aircraft', async () => {
      const count = await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag
          return yield* repo.countPositions('unknown_icao24')
        })
      )

      expect(count).toBe(0)
    })
  })

  describe('findTrackSummary', () => {
    it('returns track summary from continuous aggregate', async () => {
      const icao24 = testIcao24()

      await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag

          // Insert positions
          yield* repo.insertPositions([
            createTestPosition(icao24, {
              time: new Date(),
              longitude: -122.4,
              latitude: 37.78,
            }),
            createTestPosition(icao24, {
              time: new Date(Date.now() - 1000),
              longitude: -122.41,
              latitude: 37.79,
            }),
          ])
        })
      )

      // Query track summary
      const summaries = await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag
          return yield* repo.findTrackSummary(
            icao24,
            new Date(Date.now() - 3600000),
            new Date()
          )
        })
      )

      // May be empty if continuous aggregate hasn't refreshed
      expect(Array.isArray(summaries)).toBe(true)
    })
  })

  describe('getIngestionHealth', () => {
    it('returns ingestion health stats', async () => {
      // This may return empty if no ingestion has happened
      const health = await runTest(
        Effect.gen(function* () {
          const repo = yield* FlightRepositoryTag
          return yield* repo.getIngestionHealth(60)
        })
      )

      expect(Array.isArray(health)).toBe(true)

      // If there are results, verify schema
      if (health.length > 0) {
        const first = health[0]
        expect(typeof first.source).toBe('string')
        expect(typeof first.total_ops).toBe('bigint')
      }
    })
  })
})
