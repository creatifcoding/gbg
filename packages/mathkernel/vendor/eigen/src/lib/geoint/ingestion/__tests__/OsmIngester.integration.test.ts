/**
 * OsmIngester Integration Tests
 *
 * Tests for the complete OSM ingestion pipeline:
 * - End-to-end region ingestion with mock API
 * - Error handling and recovery
 * - Continuous polling lifecycle
 * - Database interaction via mock repositories
 *
 * Run with: RUN_INTEGRATION_TESTS=1 bun test OsmIngester.integration.test.ts
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Effect, Layer, Option, Duration } from 'effect'
import { PgClient } from '@effect/sql-pg'
import {
  OsmIngesterTag,
  OsmIngesterConfigTag,
  OsmIngestionRegion,
  makeOsmIngester,
  type OsmIngestionResult,
} from '../OsmIngester'
import {
  OverpassClientService,
  type ExternalApiError,
} from '../../api/ExternalApiClient'
import {
  PoiRepositoryTag,
  type PoiInput,
} from '../../persistence/postgis/PoiRepository'
import { OverpassElement, OverpassResponse } from '../../schemas'

// Skip integration tests unless explicitly enabled
const runIntegrationTests = process.env['RUN_INTEGRATION_TESTS'] === '1'
const describeIntegration = runIntegrationTests ? describe : describe.skip

// =============================================================================
// Test Fixtures
// =============================================================================

const SF_BAY_AREA_REGION: OsmIngestionRegion = {
  name: 'sf-bay-area',
  bounds: [-122.6, 37.3, -121.8, 37.9],
  amenities: ['restaurant', 'cafe'],
  tags: {},
  ttlDays: 7,
}

const NYC_REGION: OsmIngestionRegion = {
  name: 'nyc',
  bounds: [-74.3, 40.5, -73.7, 40.9],
  amenities: ['hospital'],
  tags: {},
  ttlDays: 14,
}

const createTestElements = (): OverpassElement[] => [
  new OverpassElement({
    type: 'node',
    id: 123456789,
    lat: 37.7749,
    lon: -122.4194,
    tags: {
      name: 'Test Restaurant',
      amenity: 'restaurant',
    },
  }),
  new OverpassElement({
    type: 'node',
    id: 987654321,
    lat: 37.7850,
    lon: -122.4094,
    tags: {
      name: 'Test Cafe',
      amenity: 'cafe',
    },
  }),
  new OverpassElement({
    type: 'way',
    id: 456789012,
    center: { lat: 37.7650, lon: -122.4294 },
    tags: {
      name: 'Golden Gate Park',
      leisure: 'park',
    },
  }),
]

const createTestOverpassResponse = (elements: OverpassElement[]): OverpassResponse =>
  new OverpassResponse({
    version: 0.6,
    generator: 'Overpass API test',
    osm3s: {
      timestamp_osm_base: '2024-01-01T00:00:00Z',
      copyright: 'OpenStreetMap contributors',
    },
    elements,
  })

// =============================================================================
// Mock Factory Functions
// =============================================================================

/**
 * Create mock Overpass client with configurable responses
 */
const createMockOverpassClient = (
  elements: OverpassElement[],
  options?: {
    shouldFail?: boolean
    failMessage?: string
  }
) =>
  Layer.succeed(
    OverpassClientService,
    OverpassClientService.of({
      query: (_overpassQL: string) => {
        if (options?.shouldFail) {
          return Effect.fail({
            _tag: 'ExternalApiError',
            message: options.failMessage ?? 'Mock API error',
            source: 'overpass',
            statusCode: 500,
            retryable: true,
          } as unknown as ExternalApiError)
        }
        return Effect.succeed(createTestOverpassResponse(elements))
      },
      buildQuery: () => '[out:json][timeout:60];node[amenity];out center;',
    })
  )

/**
 * Create mock POI repository that tracks upserts
 */
const createMockPoiRepository = (upsertedPois: PoiInput[]) =>
  Layer.succeed(
    PoiRepositoryTag,
    PoiRepositoryTag.of({
      upsertPoi: () => Effect.void,
      upsertPois: (pois: readonly PoiInput[]) => {
        upsertedPois.push(...pois)
        return Effect.succeed(pois.length)
      },
      findPois: () => Effect.succeed([]),
      findNearby: () => Effect.succeed([]),
      findPoi: () => Effect.succeed(Option.none()),
      isStale: () => Effect.succeed(true),
    })
  )

/**
 * Create mock PgClient for ingestion logging
 */
const createMockPgClient = (_loggedResults: OsmIngestionResult[]) =>
  Layer.succeed(
    PgClient.PgClient,
    {
      // Mock implementation that captures log data
      safe: () => Effect.succeed([]),
      unsafe: () => Effect.succeed([]),
      withTransaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
    } as any
  )

/**
 * Create test configuration layer
 */
const createTestConfig = (regions: OsmIngestionRegion[], options?: {
  intervalMs?: number
  queryTimeoutMs?: number
  logIngestion?: boolean
}) =>
  Layer.succeed(
    OsmIngesterConfigTag,
    {
      regions,
      intervalMs: options?.intervalMs ?? 1000,
      queryTimeoutMs: options?.queryTimeoutMs ?? 5000,
      logIngestion: options?.logIngestion ?? false, // Disable for simpler tests
    }
  )

/**
 * Build a complete test layer with all dependencies correctly composed
 */
const buildTestLayer = (options: {
  elements?: OverpassElement[]
  upsertedPois: PoiInput[]
  loggedResults?: OsmIngestionResult[]
  regions: OsmIngestionRegion[]
  overpassOptions?: { shouldFail?: boolean; failMessage?: string }
  configOptions?: { intervalMs?: number; queryTimeoutMs?: number; logIngestion?: boolean }
  skipOverpassClient?: boolean
}) => {
  const configLayer = createTestConfig(options.regions, options.configOptions)
  const repoLayer = createMockPoiRepository(options.upsertedPois)
  const pgLayer = createMockPgClient(options.loggedResults ?? [])

  // All dependencies merged together
  const depsLayer = options.skipOverpassClient
    ? Layer.mergeAll(repoLayer, pgLayer, configLayer)
    : Layer.mergeAll(
        createMockOverpassClient(options.elements ?? [], options.overpassOptions),
        repoLayer,
        pgLayer,
        configLayer
      )

  // Build ingester layer with dependencies provided
  const ingesterLayer = Layer.effect(OsmIngesterTag, makeOsmIngester).pipe(
    Layer.provide(depsLayer)
  )

  // Return merged layer with both deps and ingester available
  return Layer.merge(depsLayer, ingesterLayer)
}

// =============================================================================
// Integration Tests
// =============================================================================

describeIntegration('OsmIngester Integration Tests', () => {
  describe('ingestRegion', () => {
    it('ingests POIs from a single region', async () => {
      const elements = createTestElements()
      const upsertedPois: PoiInput[] = []
      const loggedResults: OsmIngestionResult[] = []

      const testLayer = buildTestLayer({
        elements,
        upsertedPois,
        loggedResults,
        regions: [SF_BAY_AREA_REGION],
      })

      const program = Effect.gen(function* () {
        const ingester = yield* OsmIngesterTag
        return yield* ingester.ingestRegion(SF_BAY_AREA_REGION)
      }).pipe(Effect.provide(testLayer))

      const result = await Effect.runPromise(program)

      expect(result.region).toBe('sf-bay-area')
      expect(result.recordsIngested).toBe(3) // All 3 elements have coords
      expect(result.error).toBeUndefined()
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)

      // Verify POIs were upserted
      expect(upsertedPois.length).toBe(3)
      expect(upsertedPois[0].osmId).toBe(BigInt(123456789))
      expect(upsertedPois[1].osmId).toBe(BigInt(987654321))
      expect(upsertedPois[2].osmId).toBe(BigInt(456789012))
    })

    it('filters out elements without coordinates', async () => {
      const elements = [
        new OverpassElement({
          type: 'node',
          id: 111,
          lat: 37.7749,
          lon: -122.4194,
          tags: { name: 'Has coords' },
        }),
        new OverpassElement({
          type: 'node',
          id: 222,
          // No lat/lon
          tags: { name: 'No coords' },
        }),
        new OverpassElement({
          type: 'way',
          id: 333,
          // No center
          tags: { name: 'No center' },
        }),
      ]
      const upsertedPois: PoiInput[] = []

      const testLayer = buildTestLayer({
        elements,
        upsertedPois,
        regions: [SF_BAY_AREA_REGION],
      })

      const program = Effect.gen(function* () {
        const ingester = yield* OsmIngesterTag
        return yield* ingester.ingestRegion(SF_BAY_AREA_REGION)
      }).pipe(Effect.provide(testLayer))

      const result = await Effect.runPromise(program)

      expect(result.recordsIngested).toBe(1) // Only the node with coords
      expect(upsertedPois.length).toBe(1)
      expect(upsertedPois[0].osmId).toBe(BigInt(111))
    })

    it('handles API errors gracefully', async () => {
      const upsertedPois: PoiInput[] = []

      const testLayer = buildTestLayer({
        elements: [],
        upsertedPois,
        regions: [SF_BAY_AREA_REGION],
        overpassOptions: {
          shouldFail: true,
          failMessage: 'Overpass service unavailable',
        },
      })

      const program = Effect.gen(function* () {
        const ingester = yield* OsmIngesterTag
        return yield* ingester.ingestRegion(SF_BAY_AREA_REGION)
      }).pipe(Effect.provide(testLayer))

      const result = await Effect.runPromise(program)

      expect(result.region).toBe('sf-bay-area')
      expect(result.recordsIngested).toBe(0)
      expect(result.error).toBe('Overpass service unavailable')
    })

    it('handles empty API responses', async () => {
      const upsertedPois: PoiInput[] = []

      const testLayer = buildTestLayer({
        elements: [],
        upsertedPois,
        regions: [SF_BAY_AREA_REGION],
      })

      const program = Effect.gen(function* () {
        const ingester = yield* OsmIngesterTag
        return yield* ingester.ingestRegion(SF_BAY_AREA_REGION)
      }).pipe(Effect.provide(testLayer))

      const result = await Effect.runPromise(program)

      expect(result.recordsIngested).toBe(0)
      expect(result.error).toBeUndefined()
      expect(upsertedPois.length).toBe(0)
    })

    it('returns error result when Overpass client not available', async () => {
      const upsertedPois: PoiInput[] = []

      // Layer without Overpass client - just the other dependencies
      const testLayer = buildTestLayer({
        upsertedPois,
        regions: [SF_BAY_AREA_REGION],
        skipOverpassClient: true,
      })

      const program = Effect.gen(function* () {
        const ingester = yield* OsmIngesterTag
        return yield* ingester.ingestRegion(SF_BAY_AREA_REGION)
      }).pipe(Effect.provide(testLayer))

      const result = await Effect.runPromise(program)

      expect(result.recordsIngested).toBe(0)
      expect(result.error).toBe('Overpass client not available')
    })
  })

  describe('multiple regions', () => {
    it('ingests from multiple regions sequentially', async () => {
      const elements = createTestElements()
      const upsertedPois: PoiInput[] = []

      const testLayer = buildTestLayer({
        elements,
        upsertedPois,
        regions: [SF_BAY_AREA_REGION, NYC_REGION],
      })

      const program = Effect.gen(function* () {
        const ingester = yield* OsmIngesterTag
        const sfResult = yield* ingester.ingestRegion(SF_BAY_AREA_REGION)
        const nycResult = yield* ingester.ingestRegion(NYC_REGION)
        return [sfResult, nycResult]
      }).pipe(Effect.provide(testLayer))

      const results = await Effect.runPromise(program)

      expect(results.length).toBe(2)
      expect(results[0].region).toBe('sf-bay-area')
      expect(results[1].region).toBe('nyc')

      // Each region ingests 3 POIs
      expect(upsertedPois.length).toBe(6)
    })
  })

  describe('data transformation', () => {
    it('correctly transforms OSM tags to POI input', async () => {
      const elements = [
        new OverpassElement({
          type: 'node',
          id: 999,
          lat: 37.8,
          lon: -122.5,
          tags: {
            name: 'Special Chars & Symbols',
            amenity: 'restaurant',
            cuisine: 'italian;french',
            'addr:street': '123 Main St',
            opening_hours: 'Mo-Fr 09:00-17:00',
          },
        }),
      ]
      const upsertedPois: PoiInput[] = []

      const testLayer = buildTestLayer({
        elements,
        upsertedPois,
        regions: [SF_BAY_AREA_REGION],
      })

      const program = Effect.gen(function* () {
        const ingester = yield* OsmIngesterTag
        return yield* ingester.ingestRegion(SF_BAY_AREA_REGION)
      }).pipe(Effect.provide(testLayer))

      await Effect.runPromise(program)

      expect(upsertedPois.length).toBe(1)
      const poi = upsertedPois[0]

      expect(poi.tags?.['name']).toBe('Special Chars & Symbols')
      expect(poi.tags?.['cuisine']).toBe('italian;french')
      expect(poi.tags?.['addr:street']).toBe('123 Main St')
      expect(Option.getOrNull(poi.centroidLat)).toBe(37.8)
      expect(Option.getOrNull(poi.centroidLon)).toBe(-122.5)
    })

    it('preserves bbox and TTL in POI input', async () => {
      const elements = [
        new OverpassElement({
          type: 'node',
          id: 100,
          lat: 37.7,
          lon: -122.4,
          tags: { name: 'Test' },
        }),
      ]
      const upsertedPois: PoiInput[] = []

      const testLayer = buildTestLayer({
        elements,
        upsertedPois,
        regions: [{ ...SF_BAY_AREA_REGION, ttlDays: 30 }],
      })

      const program = Effect.gen(function* () {
        const ingester = yield* OsmIngesterTag
        return yield* ingester.ingestRegion({ ...SF_BAY_AREA_REGION, ttlDays: 30 })
      }).pipe(Effect.provide(testLayer))

      await Effect.runPromise(program)

      const poi = upsertedPois[0]
      expect(Option.getOrNull(poi.queryBbox)).toEqual(SF_BAY_AREA_REGION.bounds)
      expect(Option.getOrNull(poi.ttlDays)).toBe(30)
    })
  })

  describe('configuration', () => {
    it('exposes configuration via service', async () => {
      const testLayer = buildTestLayer({
        elements: [],
        upsertedPois: [],
        regions: [SF_BAY_AREA_REGION, NYC_REGION],
        configOptions: {
          intervalMs: 60000,
          queryTimeoutMs: 30000,
          logIngestion: false,
        },
      })

      const program = Effect.gen(function* () {
        const ingester = yield* OsmIngesterTag
        return ingester.config
      }).pipe(Effect.provide(testLayer))

      const config = await Effect.runPromise(program)

      expect(config.regions.length).toBe(2)
      expect(config.intervalMs).toBe(60000)
      expect(config.queryTimeoutMs).toBe(30000)
      expect(config.logIngestion).toBe(false)
    })
  })

  describe('start/stop lifecycle', () => {
    it('starts continuous polling fiber', async () => {
      const elements = createTestElements()
      const upsertedPois: PoiInput[] = []

      const testLayer = buildTestLayer({
        elements,
        upsertedPois,
        regions: [SF_BAY_AREA_REGION],
        configOptions: { intervalMs: 50 },
      })

      const program = Effect.gen(function* () {
        const ingester = yield* OsmIngesterTag
        const fiber = yield* ingester.start()

        // Let it run for a bit
        yield* Effect.sleep(Duration.millis(150))

        // Stop the fiber
        yield* ingester.stop(fiber)

        return upsertedPois.length
      }).pipe(Effect.provide(testLayer))

      const count = await Effect.runPromise(program)

      // Should have ingested at least once (3 POIs per ingestion)
      expect(count).toBeGreaterThanOrEqual(3)
    })

    it('stops fiber cleanly', async () => {
      const elements = createTestElements()
      const upsertedPois: PoiInput[] = []

      const testLayer = buildTestLayer({
        elements,
        upsertedPois,
        regions: [SF_BAY_AREA_REGION],
        configOptions: { intervalMs: 10 },
      })

      const program = Effect.gen(function* () {
        const ingester = yield* OsmIngesterTag
        const fiber = yield* ingester.start()

        // Let it run briefly
        yield* Effect.sleep(Duration.millis(30))

        // Stop immediately
        yield* ingester.stop(fiber)

        const countAtStop = upsertedPois.length

        // Wait and verify no more ingestion
        yield* Effect.sleep(Duration.millis(50))

        return { countAtStop, countAfterStop: upsertedPois.length }
      }).pipe(Effect.provide(testLayer))

      const { countAtStop, countAfterStop } = await Effect.runPromise(program)

      // Count should not increase after stop
      expect(countAfterStop).toBe(countAtStop)
    })
  })
})
