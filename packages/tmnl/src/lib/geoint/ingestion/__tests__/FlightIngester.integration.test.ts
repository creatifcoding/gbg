/**
 * FlightIngester Integration Tests
 *
 * Tests the FlightIngester service against a real PostgreSQL database
 * with mock API clients for OpenSky and ADSB.lol.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 bun test src/lib/geoint/ingestion/__tests__/FlightIngester.integration.test.ts
 *
 * Prerequisites:
 * - docker compose -f docker/docker-compose.yml up postgres -d
 *
 * @module
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Effect, Layer, Redacted, Exit } from 'effect'
import { PgClient } from '@effect/sql-pg'
import {
  FlightIngesterTag,
  FlightIngesterLive,
  FlightIngesterConfigTag,
  type FlightIngesterConfig,
  type IngestionRegion,
} from '../FlightIngester'
import {
  FlightRepositoryLive,
} from '../../persistence/postgis/FlightRepository'
import {
  OpenSkyClientService,
  AdsbLolClientService,
} from '../../api/ExternalApiClient'
import {
  OpenSkyResponse,
  OpenSkyStateVector,
  AdsbLolResponse,
  AdsbLolAircraft,
  Icao24,
} from '../../schemas'

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

// Test region (small area for testing)
const TEST_REGION: IngestionRegion = {
  name: 'test-region',
  bounds: [-122.5, 37.5, -122.0, 38.0],
  openSky: true,
  adsbLol: true,
}

// Test config with single region
const TEST_CONFIG: FlightIngesterConfig = {
  regions: [TEST_REGION],
  openSkyIntervalMs: 60000, // Don't actually poll in tests
  adsbLolIntervalMs: 60000,
  adsbLolRadiusNm: 100,
  logIngestion: false, // Skip logging to raw.ingestion_log in tests
}

// Generate unique ICAOs for tests
const testPrefix = `test-${Date.now()}`
const testIcao24 = () => `${testPrefix.slice(-6)}`.padStart(6, '0').slice(0, 6)

// =============================================================================
// Mock API Clients
// =============================================================================

/**
 * Create a mock OpenSky client that returns canned data
 */
const createMockOpenSkyClient = (states: OpenSkyStateVector[]) =>
  Layer.succeed(
    OpenSkyClientService,
    OpenSkyClientService.of({
      getStates: () =>
        Effect.succeed(
          new OpenSkyResponse({
            time: Math.floor(Date.now() / 1000),
            states,
          })
        ),
    })
  )

/**
 * Create a mock ADSB.lol client that returns canned data
 */
const createMockAdsbLolClient = (aircraft: AdsbLolAircraft[]) =>
  Layer.succeed(
    AdsbLolClientService,
    AdsbLolClientService.of({
      getByPoint: () =>
        Effect.succeed(
          new AdsbLolResponse({
            timestamp: new Date(),
            total: aircraft.length,
            aircraft,
          })
        ),
      getByIcao: () =>
        Effect.succeed(
          new AdsbLolResponse({
            timestamp: new Date(),
            total: 0,
            aircraft: [],
          })
        ),
      getByCallsign: () =>
        Effect.succeed(
          new AdsbLolResponse({
            timestamp: new Date(),
            total: 0,
            aircraft: [],
          })
        ),
      getByType: () =>
        Effect.succeed(
          new AdsbLolResponse({
            timestamp: new Date(),
            total: 0,
            aircraft: [],
          })
        ),
      getBySquawk: () =>
        Effect.succeed(
          new AdsbLolResponse({
            timestamp: new Date(),
            total: 0,
            aircraft: [],
          })
        ),
      getMilitary: () =>
        Effect.succeed(
          new AdsbLolResponse({
            timestamp: new Date(),
            total: 0,
            aircraft: [],
          })
        ),
    })
  )

/**
 * Create a mock client that fails
 */
const createFailingOpenSkyClient = (errorMessage: string) =>
  Layer.succeed(
    OpenSkyClientService,
    OpenSkyClientService.of({
      getStates: () =>
        Effect.fail({
          _tag: 'ExternalApiError',
          message: errorMessage,
          source: 'opensky',
          operation: 'getStates',
          statusCode: 500,
          retryable: false,
        } as any),
    })
  )

// =============================================================================
// Test Fixtures
// =============================================================================

const createTestOpenSkyState = (icao24: string): OpenSkyStateVector =>
  new OpenSkyStateVector({
    icao24: icao24 as Icao24,
    callsign: 'TEST123',
    originCountry: 'United States',
    timePosition: Date.now() / 1000,
    lastContact: Date.now() / 1000,
    longitude: -122.4,
    latitude: 37.78,
    baroAltitude: 10000,
    onGround: false,
    velocity: 250,
    trueTrack: 90,
    verticalRate: 0,
    sensors: null,
    geoAltitude: 10050,
    squawk: '1200',
    spi: false,
    positionSource: 0,
    category: 1,
  })

const createTestAdsbLolAircraft = (hex: string): AdsbLolAircraft =>
  new AdsbLolAircraft({
    hex,
    flight: 'TEST456',
    lat: 37.76,
    lon: -122.42,
    altitudeFt: 32000,
    groundSpeedKts: 450,
    trackDeg: 270,
    verticalRateFpm: -500,
    squawk: '4567',
    category: 'A3',
    onGround: false,
    seenSec: 2,
  })

// =============================================================================
// Test Layer Factory
// =============================================================================

const createTestLayer = (
  openSkyStates: OpenSkyStateVector[],
  adsbAircraft: AdsbLolAircraft[]
) => {
  const configLayer = Layer.succeed(FlightIngesterConfigTag, TEST_CONFIG)
  const mockOpenSky = createMockOpenSkyClient(openSkyStates)
  const mockAdsb = createMockAdsbLolClient(adsbAircraft)

  return FlightIngesterLive.pipe(
    Layer.provide(configLayer),
    Layer.provide(FlightRepositoryLive),
    Layer.provide(mockOpenSky),
    Layer.provide(mockAdsb),
    Layer.provide(PgClientLive)
  )
}

// Helper to run effects with the test layer
const runTest = <A, E>(
  effect: Effect.Effect<A, E, FlightIngesterTag>,
  openSkyStates: OpenSkyStateVector[] = [],
  adsbAircraft: AdsbLolAircraft[] = []
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(createTestLayer(openSkyStates, adsbAircraft)),
      Effect.timeout('20 seconds'),
      Effect.catchTag('TimeoutException', () =>
        Effect.die(new Error('Test timed out'))
      )
    )
  )

// Helper to run raw SQL
const runSql = <A>(
  effect: Effect.Effect<A, unknown, PgClient.PgClient>
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(Effect.provide(PgClientLive), Effect.timeout('5 seconds'))
  )

// =============================================================================
// Integration Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION_TESTS)('FlightIngester Integration', () => {
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
      // Clean up test data using ICAO24 prefix pattern
      yield* sql`DELETE FROM raw.flight_positions WHERE icao24 LIKE 'test-%'`
      yield* sql`DELETE FROM raw.flight_positions WHERE icao24 ~ '^[0-9]{6}$'`
    }).pipe(
      Effect.provide(PgClientLive),
      Effect.catchAll(() => Effect.void)
    )

    await Effect.runPromise(cleanup)
  })

  describe('ingestOpenSky', () => {
    it('ingests OpenSky data into raw.flight_positions', async () => {
      const icao24 = testIcao24()
      const states = [createTestOpenSkyState(icao24)]

      const result = await runTest(
        Effect.gen(function* () {
          const ingester = yield* FlightIngesterTag
          return yield* ingester.ingestOpenSky(TEST_REGION)
        }),
        states,
        []
      )

      expect(result.source).toBe('opensky')
      expect(result.region).toBe('test-region')
      expect(result.recordsIngested).toBe(1)
      expect(result.error).toBeUndefined()
      expect(result.latencyMs).toBeGreaterThan(0)
    })

    it('skips states without valid position', async () => {
      const icao24 = testIcao24()
      const stateWithPosition = createTestOpenSkyState(icao24)
      const stateWithoutPosition = new OpenSkyStateVector({
        icao24: `${icao24.slice(0, 5)}1` as Icao24,
        callsign: 'NOPOS',
        originCountry: 'Unknown',
        timePosition: null,
        lastContact: Date.now() / 1000,
        longitude: null, // No position
        latitude: null,
        baroAltitude: null,
        onGround: false,
        velocity: null,
        trueTrack: null,
        verticalRate: null,
        sensors: null,
        geoAltitude: null,
        squawk: null,
        spi: false,
        positionSource: 0,
        category: undefined,
      })

      const result = await runTest(
        Effect.gen(function* () {
          const ingester = yield* FlightIngesterTag
          return yield* ingester.ingestOpenSky(TEST_REGION)
        }),
        [stateWithPosition, stateWithoutPosition],
        []
      )

      // Only the state with position should be ingested
      expect(result.recordsIngested).toBe(1)
    })

    it('handles API errors gracefully', async () => {
      // Create a special layer with failing client
      const configLayer = Layer.succeed(FlightIngesterConfigTag, TEST_CONFIG)
      const failingClient = createFailingOpenSkyClient('Test API failure')
      const mockAdsb = createMockAdsbLolClient([])

      const testLayer = FlightIngesterLive.pipe(
        Layer.provide(configLayer),
        Layer.provide(FlightRepositoryLive),
        Layer.provide(failingClient),
        Layer.provide(mockAdsb),
        Layer.provide(PgClientLive)
      )

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const ingester = yield* FlightIngesterTag
          return yield* ingester.ingestOpenSky(TEST_REGION)
        }).pipe(
          Effect.provide(testLayer),
          Effect.timeout('10 seconds')
        )
      )

      expect(result.source).toBe('opensky')
      expect(result.recordsIngested).toBe(0)
      expect(result.error).toBe('Test API failure')
    })

    it('returns zero records when OpenSky client is unavailable', async () => {
      // Create layer without OpenSky client
      const configLayer = Layer.succeed(FlightIngesterConfigTag, TEST_CONFIG)
      const mockAdsb = createMockAdsbLolClient([])

      const testLayer = FlightIngesterLive.pipe(
        Layer.provide(configLayer),
        Layer.provide(FlightRepositoryLive),
        Layer.provide(mockAdsb),
        Layer.provide(PgClientLive)
      )

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const ingester = yield* FlightIngesterTag
          return yield* ingester.ingestOpenSky(TEST_REGION)
        }).pipe(
          Effect.provide(testLayer),
          Effect.timeout('10 seconds')
        )
      )

      expect(result.source).toBe('opensky')
      expect(result.recordsIngested).toBe(0)
      expect(result.error).toBe('OpenSky client not available')
    })
  })

  describe('ingestAdsbLol', () => {
    it('ingests ADSB.lol data into raw.flight_positions', async () => {
      const hex = testIcao24()
      const aircraft = [createTestAdsbLolAircraft(hex)]

      const result = await runTest(
        Effect.gen(function* () {
          const ingester = yield* FlightIngesterTag
          return yield* ingester.ingestAdsbLol(TEST_REGION, 100)
        }),
        [],
        aircraft
      )

      expect(result.source).toBe('adsb_lol')
      expect(result.region).toBe('test-region')
      expect(result.recordsIngested).toBe(1)
      expect(result.error).toBeUndefined()
      expect(result.latencyMs).toBeGreaterThan(0)
    })

    it('skips aircraft without valid position', async () => {
      const hex = testIcao24()
      const aircraftWithPosition = createTestAdsbLolAircraft(hex)
      const aircraftWithoutPosition = new AdsbLolAircraft({
        hex: `${hex.slice(0, 5)}1`,
        flight: 'NOPOS',
        lat: undefined, // No position
        lon: undefined,
        altitudeFt: undefined,
        groundSpeedKts: undefined,
        trackDeg: undefined,
        verticalRateFpm: undefined,
        squawk: undefined,
        category: undefined,
        onGround: undefined,
        seenSec: undefined,
      })

      const result = await runTest(
        Effect.gen(function* () {
          const ingester = yield* FlightIngesterTag
          return yield* ingester.ingestAdsbLol(TEST_REGION, 100)
        }),
        [],
        [aircraftWithPosition, aircraftWithoutPosition]
      )

      // Only the aircraft with position should be ingested
      expect(result.recordsIngested).toBe(1)
    })

    it('filters invalid ICAO24 codes', async () => {
      const validHex = testIcao24()
      const aircraftValid = createTestAdsbLolAircraft(validHex)
      const aircraftInvalidShort = new AdsbLolAircraft({
        hex: 'abc', // Too short
        flight: 'SHORT',
        lat: 37.7,
        lon: -122.3,
        altitudeFt: 5000,
        groundSpeedKts: 200,
        trackDeg: 45,
        verticalRateFpm: 0,
        squawk: undefined,
        category: undefined,
        onGround: false,
        seenSec: 0,
      })

      const result = await runTest(
        Effect.gen(function* () {
          const ingester = yield* FlightIngesterTag
          return yield* ingester.ingestAdsbLol(TEST_REGION, 100)
        }),
        [],
        [aircraftValid, aircraftInvalidShort]
      )

      // Only the aircraft with valid ICAO24 should be ingested
      expect(result.recordsIngested).toBe(1)
    })

    it('handles MLAT tilde prefix', async () => {
      const baseHex = testIcao24()
      const aircraftMlat = new AdsbLolAircraft({
        hex: `~${baseHex}`, // MLAT prefix
        flight: 'MLAT',
        lat: 37.8,
        lon: -122.5,
        altitudeFt: 8000,
        groundSpeedKts: 300,
        trackDeg: 180,
        verticalRateFpm: -200,
        squawk: '1234',
        category: 'A2',
        onGround: false,
        seenSec: 1,
      })

      const result = await runTest(
        Effect.gen(function* () {
          const ingester = yield* FlightIngesterTag
          return yield* ingester.ingestAdsbLol(TEST_REGION, 100)
        }),
        [],
        [aircraftMlat]
      )

      // Should successfully ingest with tilde stripped
      expect(result.recordsIngested).toBe(1)
    })
  })

  describe('Multiple Ingestions', () => {
    it('ingests from both sources in sequence', async () => {
      const openSkyIcao = testIcao24()
      const adsbHex = `${openSkyIcao.slice(0, 5)}9`
      const openSkyStates = [createTestOpenSkyState(openSkyIcao)]
      const adsbAircraft = [createTestAdsbLolAircraft(adsbHex)]

      const [openSkyResult, adsbResult] = await runTest(
        Effect.gen(function* () {
          const ingester = yield* FlightIngesterTag
          const os = yield* ingester.ingestOpenSky(TEST_REGION)
          const adsb = yield* ingester.ingestAdsbLol(TEST_REGION, 100)
          return [os, adsb] as const
        }),
        openSkyStates,
        adsbAircraft
      )

      expect(openSkyResult.source).toBe('opensky')
      expect(openSkyResult.recordsIngested).toBe(1)

      expect(adsbResult.source).toBe('adsb_lol')
      expect(adsbResult.recordsIngested).toBe(1)
    })

    it('handles multiple aircraft per ingestion', async () => {
      const icao1 = testIcao24()
      const icao2 = `${icao1.slice(0, 5)}a`
      const icao3 = `${icao1.slice(0, 5)}b`

      const states = [
        createTestOpenSkyState(icao1),
        createTestOpenSkyState(icao2),
        createTestOpenSkyState(icao3),
      ]

      const result = await runTest(
        Effect.gen(function* () {
          const ingester = yield* FlightIngesterTag
          return yield* ingester.ingestOpenSky(TEST_REGION)
        }),
        states,
        []
      )

      expect(result.recordsIngested).toBe(3)
    })
  })

  describe('Data Persistence Verification', () => {
    it('persisted data can be queried from database', async () => {
      const icao24 = `abc${Date.now().toString().slice(-3)}`
      const states = [createTestOpenSkyState(icao24)]

      // Ingest data
      await runTest(
        Effect.gen(function* () {
          const ingester = yield* FlightIngesterTag
          return yield* ingester.ingestOpenSky(TEST_REGION)
        }),
        states,
        []
      )

      // Query directly from database
      const rows = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{
            icao24: string
            source: string
            longitude: number
            latitude: number
          }>`
            SELECT icao24, source, ST_X(position::geometry) as longitude, ST_Y(position::geometry) as latitude
            FROM raw.flight_positions
            WHERE icao24 = ${icao24}
            ORDER BY time DESC
            LIMIT 1
          `
        })
      )

      expect(rows.length).toBe(1)
      expect(rows[0]?.icao24).toBe(icao24)
      expect(rows[0]?.source).toBe('opensky')
      expect(rows[0]?.longitude).toBeCloseTo(-122.4, 1)
      expect(rows[0]?.latitude).toBeCloseTo(37.78, 1)
    })

    it('unit conversions are applied correctly for ADSB.lol', async () => {
      const hex = `def${Date.now().toString().slice(-3)}`
      const aircraft = [
        new AdsbLolAircraft({
          hex,
          flight: 'CONV',
          lat: 37.5,
          lon: -122.0,
          altitudeFt: 10000, // feet
          groundSpeedKts: 200, // knots
          verticalRateFpm: 1000, // fpm
          trackDeg: 45,
          squawk: undefined,
          category: undefined,
          onGround: false,
          seenSec: 0,
        }),
      ]

      await runTest(
        Effect.gen(function* () {
          const ingester = yield* FlightIngesterTag
          return yield* ingester.ingestAdsbLol(TEST_REGION, 100)
        }),
        [],
        aircraft
      )

      // Query and verify conversions
      const rows = await runSql(
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient
          return yield* sql<{
            altitude_m: number
            velocity_mps: number
            vertical_rate: number
          }>`
            SELECT altitude_m, velocity_mps, vertical_rate
            FROM raw.flight_positions
            WHERE icao24 = ${hex}
            ORDER BY time DESC
            LIMIT 1
          `
        })
      )

      expect(rows.length).toBe(1)
      // 10000 ft * 0.3048 = 3048 m
      expect(rows[0]?.altitude_m).toBeCloseTo(3048, 0)
      // 200 kts * 0.514444 = 102.9 m/s
      expect(rows[0]?.velocity_mps).toBeCloseTo(102.9, 0)
      // 1000 fpm * 0.00508 = 5.08 m/s
      expect(rows[0]?.vertical_rate).toBeCloseTo(5.08, 1)
    })
  })

  describe('Configuration', () => {
    it('exposes config through service', async () => {
      const config = await runTest(
        Effect.gen(function* () {
          const ingester = yield* FlightIngesterTag
          return ingester.config
        }),
        [],
        []
      )

      expect(config.regions.length).toBe(1)
      expect(config.regions[0]?.name).toBe('test-region')
      expect(config.logIngestion).toBe(false)
    })
  })
})
