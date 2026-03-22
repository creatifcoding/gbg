/**
 * ImageryIngester Integration Tests
 *
 * Tests for the complete satellite imagery ingestion pipeline:
 * - End-to-end region ingestion with mock APIs
 * - Planet Labs and Sentinel Hub provider handling
 * - Cloud cover filtering
 * - Error handling and recovery
 * - Continuous polling lifecycle
 * - Database interaction via mock repositories
 *
 * Run with: RUN_INTEGRATION_TESTS=1 bun test ImageryIngester.integration.test.ts
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Effect, Layer, Option, Duration } from 'effect'
import { PgClient } from '@effect/sql-pg'
import {
  ImageryIngesterTag,
  ImageryIngesterConfigTag,
  ImageryIngestionRegion,
  makeImageryIngester,
  type ImageryIngestionResult,
} from '../ImageryIngester'
import {
  PlanetLabsClientService,
  SentinelHubClientService,
  type ExternalApiError,
} from '../../api/ExternalApiClient'
import {
  ImageryRepositoryTag,
  type ImageryItemInput,
} from '../../persistence/postgis/ImageryRepository'
import { PlanetItem, SentinelItem, PlanetSearchResponse, SentinelSearchResponse } from '../../schemas'

// Skip integration tests unless explicitly enabled
const runIntegrationTests = process.env['RUN_INTEGRATION_TESTS'] === '1'
const describeIntegration = runIntegrationTests ? describe : describe.skip

// =============================================================================
// Test Fixtures
// =============================================================================

const SF_BAY_AREA_REGION: ImageryIngestionRegion = {
  name: 'sf-bay-area',
  bounds: [-122.6, 37.3, -121.8, 37.9],
  providers: ['planet', 'sentinel'],
  maxCloudCover: 30,
  ttlDays: 90,
}

const NYC_REGION: ImageryIngestionRegion = {
  name: 'nyc',
  bounds: [-74.3, 40.5, -73.7, 40.9],
  providers: ['sentinel'], // Sentinel only
  maxCloudCover: 50,
  ttlDays: 30,
}

const PLANET_ONLY_REGION: ImageryIngestionRegion = {
  name: 'planet-only',
  bounds: [-122.0, 37.0, -121.5, 37.5],
  providers: ['planet'],
  maxCloudCover: 20,
  ttlDays: 60,
}

/**
 * Helper to create a valid PlanetItem with all required fields
 */
const makePlanetItem = (overrides: Partial<{
  id: string
  itemType: string
  acquired: Date
  published: Date
  geometry: unknown
  assetsUrl: string
  permissions: readonly string[]
  cloudCover: number
  gsd: number
  sunAzimuth: number
  sunElevation: number
}> = {}) => new PlanetItem({
  id: overrides.id ?? 'test-planet-item',
  itemType: overrides.itemType ?? 'PSScene',
  acquired: overrides.acquired ?? new Date('2024-01-15T18:00:00Z'),
  published: overrides.published ?? new Date('2024-01-15T20:00:00Z'),
  geometry: overrides.geometry ?? {
    type: 'Polygon',
    coordinates: [[[-122.5, 37.0], [-122.0, 37.0], [-122.0, 37.5], [-122.5, 37.5], [-122.5, 37.0]]],
  },
  assetsUrl: overrides.assetsUrl ?? 'https://api.planet.com/data/v1/item-types/PSScene/items/test/assets',
  permissions: overrides.permissions ?? ['download'],
  cloudCover: overrides.cloudCover,
  gsd: overrides.gsd,
  sunAzimuth: overrides.sunAzimuth,
  sunElevation: overrides.sunElevation,
})

/**
 * Helper to create a valid SentinelItem with all required fields
 */
const makeSentinelItem = (overrides: Partial<{
  id: string
  collection: string
  datetime: Date
  geometry: unknown
  cloudCover: number
  gsd: number
  bbox: readonly number[]
}> = {}) => new SentinelItem({
  id: overrides.id ?? 'test-sentinel-item',
  datetime: overrides.datetime ?? new Date('2024-01-15T10:30:00Z'),
  geometry: overrides.geometry ?? {
    type: 'Polygon',
    coordinates: [[[-122.5, 37.0], [-122.0, 37.0], [-122.0, 37.5], [-122.5, 37.5], [-122.5, 37.0]]],
  },
  collection: overrides.collection,
  cloudCover: overrides.cloudCover,
  gsd: overrides.gsd,
  bbox: overrides.bbox,
})

const createTestPlanetItems = (): PlanetItem[] => [
  makePlanetItem({
    id: 'planet-item-1',
    cloudCover: 0.15, // 15% - under threshold
    gsd: 3.0,
  }),
  makePlanetItem({
    id: 'planet-item-2',
    cloudCover: 0.25, // 25% - under threshold
    gsd: 3.0,
  }),
  makePlanetItem({
    id: 'planet-item-3',
    cloudCover: 0.45, // 45% - over 30% threshold
    gsd: 3.0,
  }),
]

const createTestSentinelItems = (): SentinelItem[] => [
  makeSentinelItem({
    id: 'sentinel-item-1',
    collection: 'sentinel-2-l2a',
    cloudCover: 10, // 10% - under threshold
    gsd: 10,
    bbox: [-122.5, 37.0, -122.0, 37.5],
  }),
  makeSentinelItem({
    id: 'sentinel-item-2',
    collection: 'sentinel-2-l2a',
    cloudCover: 20, // 20% - under threshold
    gsd: 10,
    bbox: [-122.5, 37.0, -122.0, 37.5],
  }),
  makeSentinelItem({
    id: 'sentinel-item-3',
    collection: 'sentinel-2-l2a',
    cloudCover: 50, // 50% - over 30% threshold
    gsd: 10,
    bbox: [-122.5, 37.0, -122.0, 37.5],
  }),
]

const createTestPlanetResponse = (items: PlanetItem[]): PlanetSearchResponse =>
  new PlanetSearchResponse({
    items,
    selfUrl: 'https://api.planet.com/data/v1/quick-search',
  })

const createTestSentinelResponse = (items: SentinelItem[]): SentinelSearchResponse =>
  new SentinelSearchResponse({
    items,
    totalMatched: items.length,
    totalReturned: items.length,
  })

// =============================================================================
// Mock Factory Functions
// =============================================================================

/**
 * Create mock Planet Labs client with configurable responses
 */
const createMockPlanetClient = (
  items: PlanetItem[],
  options?: {
    shouldFail?: boolean
    failMessage?: string
  }
) =>
  Layer.succeed(
    PlanetLabsClientService,
    {
      quickSearch: (_options) => {
        if (options?.shouldFail) {
          return Effect.fail({
            _tag: 'ExternalApiError',
            message: options.failMessage ?? 'Mock Planet API error',
            source: 'planet',
            statusCode: 500,
            retryable: true,
          } as unknown as ExternalApiError)
        }
        return Effect.succeed(createTestPlanetResponse(items))
      },
      getNextPage: (_nextUrl) => Effect.succeed(createTestPlanetResponse([])),
      getItem: (_options) => Effect.succeed(items[0] ?? makePlanetItem()),
    }
  )

/**
 * Create mock Sentinel Hub client with configurable responses
 */
const createMockSentinelClient = (
  items: SentinelItem[],
  options?: {
    shouldFail?: boolean
    failMessage?: string
  }
) =>
  Layer.succeed(
    SentinelHubClientService,
    {
      search: (_options) => {
        if (options?.shouldFail) {
          return Effect.fail({
            _tag: 'ExternalApiError',
            message: options.failMessage ?? 'Mock Sentinel API error',
            source: 'sentinel',
            statusCode: 500,
            retryable: true,
          } as unknown as ExternalApiError)
        }
        return Effect.succeed(createTestSentinelResponse(items))
      },
      getNextPage: (_nextUrl) => Effect.succeed(createTestSentinelResponse([])),
      getItem: (_options) => Effect.succeed(items[0] ?? makeSentinelItem()),
    }
  )

/**
 * Create mock imagery repository that tracks inserts
 */
const createMockImageryRepository = (insertedItems: ImageryItemInput[]) =>
  Layer.succeed(
    ImageryRepositoryTag,
    {
      insertItem: (input: ImageryItemInput) => {
        insertedItems.push(input)
        return Effect.void
      },
      insertItems: (inputs: readonly ImageryItemInput[]) => {
        insertedItems.push(...inputs)
        return Effect.succeed(inputs.length)
      },
      findItems: () => Effect.succeed([]),
      findNearby: () => Effect.succeed([]),
      findItem: () => Effect.succeed(Option.none()),
      findRecent: () => Effect.succeed([]),
      countItems: () => Effect.succeed(0),
      getCollectionStats: () => Effect.succeed([]),
      deleteOlderThan: () => Effect.succeed(0),
    }
  )

/**
 * Create mock PgClient for ingestion logging
 */
const createMockPgClient = (_loggedResults: ImageryIngestionResult[]) =>
  Layer.succeed(
    PgClient.PgClient,
    {
      safe: () => Effect.succeed([]),
      unsafe: () => Effect.succeed([]),
      withTransaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
    } as any
  )

/**
 * Create test configuration layer
 */
const createTestConfig = (regions: ImageryIngestionRegion[], options?: {
  intervalMs?: number
  queryTimeoutMs?: number
  logIngestion?: boolean
  lookbackDays?: number
}) =>
  Layer.succeed(
    ImageryIngesterConfigTag,
    {
      regions,
      intervalMs: options?.intervalMs ?? 1000,
      queryTimeoutMs: options?.queryTimeoutMs ?? 5000,
      logIngestion: options?.logIngestion ?? false,
      planetItemTypes: ['PSScene'],
      sentinelCollections: ['sentinel-2-l2a'],
      lookbackDays: options?.lookbackDays ?? 3,
    }
  )

/**
 * Build a complete test layer with all dependencies
 */
const buildTestLayer = (options: {
  planetItems?: PlanetItem[]
  sentinelItems?: SentinelItem[]
  insertedItems: ImageryItemInput[]
  loggedResults?: ImageryIngestionResult[]
  regions: ImageryIngestionRegion[]
  planetOptions?: { shouldFail?: boolean; failMessage?: string }
  sentinelOptions?: { shouldFail?: boolean; failMessage?: string }
  configOptions?: { intervalMs?: number; queryTimeoutMs?: number; logIngestion?: boolean; lookbackDays?: number }
}) => {
  const configLayer = createTestConfig(options.regions, options.configOptions)
  const repoLayer = createMockImageryRepository(options.insertedItems)
  const pgLayer = createMockPgClient(options.loggedResults ?? [])
  const planetLayer = createMockPlanetClient(options.planetItems ?? [], options.planetOptions)
  const sentinelLayer = createMockSentinelClient(options.sentinelItems ?? [], options.sentinelOptions)

  // All dependencies merged together
  const depsLayer = Layer.mergeAll(
    configLayer,
    repoLayer,
    pgLayer,
    planetLayer,
    sentinelLayer
  )

  // Build ingester layer with dependencies provided
  const ingesterLayer = Layer.effect(ImageryIngesterTag, makeImageryIngester).pipe(
    Layer.provide(depsLayer)
  )

  // Return merged layer with both deps and ingester available
  return Layer.merge(depsLayer, ingesterLayer)
}

// =============================================================================
// Integration Tests
// =============================================================================

describeIntegration('ImageryIngester Integration Tests', () => {
  describe('ingestRegion', () => {
    it('ingests imagery from both Planet and Sentinel for a region', async () => {
      const planetItems = createTestPlanetItems()
      const sentinelItems = createTestSentinelItems()
      const insertedItems: ImageryItemInput[] = []

      const testLayer = buildTestLayer({
        planetItems,
        sentinelItems,
        insertedItems,
        regions: [SF_BAY_AREA_REGION],
      })

      const program = Effect.gen(function* () {
        const ingester = yield* ImageryIngesterTag
        return yield* ingester.ingestRegion(SF_BAY_AREA_REGION)
      }).pipe(Effect.provide(testLayer))

      const results = await Effect.runPromise(program)

      // Should have results from both providers
      expect(results.length).toBe(2)

      const planetResult = results.find(r => r.source === 'planet')
      const sentinelResult = results.find(r => r.source === 'sentinel')

      expect(planetResult).toBeDefined()
      expect(planetResult!.region).toBe('sf-bay-area')
      // Planet has 2 items under 30% cloud cover (15%, 25%), 1 filtered (45%)
      expect(planetResult!.recordsIngested).toBe(2)
      expect(planetResult!.recordsFiltered).toBe(1)
      expect(planetResult!.error).toBeUndefined()

      expect(sentinelResult).toBeDefined()
      expect(sentinelResult!.region).toBe('sf-bay-area')
      // Sentinel has 2 items under 30% cloud cover (10%, 20%), 1 filtered (50%)
      expect(sentinelResult!.recordsIngested).toBe(2)
      expect(sentinelResult!.recordsFiltered).toBe(1)
      expect(sentinelResult!.error).toBeUndefined()

      // Verify items were inserted (2 + 2 = 4)
      expect(insertedItems.length).toBe(4)
    })

    it('ingests from Sentinel only when region specifies', async () => {
      const planetItems = createTestPlanetItems()
      const sentinelItems = createTestSentinelItems()
      const insertedItems: ImageryItemInput[] = []

      const testLayer = buildTestLayer({
        planetItems,
        sentinelItems,
        insertedItems,
        regions: [NYC_REGION],
      })

      const program = Effect.gen(function* () {
        const ingester = yield* ImageryIngesterTag
        return yield* ingester.ingestRegion(NYC_REGION)
      }).pipe(Effect.provide(testLayer))

      const results = await Effect.runPromise(program)

      // Should only have Sentinel result
      expect(results.length).toBe(1)
      expect(results[0].source).toBe('sentinel')
      expect(results[0].region).toBe('nyc')
      // NYC region has maxCloudCover of 50%, so all 3 Sentinel items pass
      expect(results[0].recordsIngested).toBe(3)
      expect(results[0].recordsFiltered).toBe(0)
    })

    it('ingests from Planet only when region specifies', async () => {
      const planetItems = createTestPlanetItems()
      const sentinelItems = createTestSentinelItems()
      const insertedItems: ImageryItemInput[] = []

      const testLayer = buildTestLayer({
        planetItems,
        sentinelItems,
        insertedItems,
        regions: [PLANET_ONLY_REGION],
      })

      const program = Effect.gen(function* () {
        const ingester = yield* ImageryIngesterTag
        return yield* ingester.ingestRegion(PLANET_ONLY_REGION)
      }).pipe(Effect.provide(testLayer))

      const results = await Effect.runPromise(program)

      // Should only have Planet result
      expect(results.length).toBe(1)
      expect(results[0].source).toBe('planet')
      expect(results[0].region).toBe('planet-only')
      // Planet only region has maxCloudCover of 20%, so only 1 item passes (15%)
      expect(results[0].recordsIngested).toBe(1)
      expect(results[0].recordsFiltered).toBe(2)
    })

    it('handles Planet API errors gracefully', async () => {
      const sentinelItems = createTestSentinelItems()
      const insertedItems: ImageryItemInput[] = []

      const testLayer = buildTestLayer({
        planetItems: [],
        sentinelItems,
        insertedItems,
        regions: [SF_BAY_AREA_REGION],
        planetOptions: {
          shouldFail: true,
          failMessage: 'Planet API rate limited',
        },
      })

      const program = Effect.gen(function* () {
        const ingester = yield* ImageryIngesterTag
        return yield* ingester.ingestRegion(SF_BAY_AREA_REGION)
      }).pipe(Effect.provide(testLayer))

      const results = await Effect.runPromise(program)

      // Should have results from both - Planet with error, Sentinel with success
      expect(results.length).toBe(2)

      const planetResult = results.find(r => r.source === 'planet')
      expect(planetResult!.recordsIngested).toBe(0)
      expect(planetResult!.error).toBe('Planet API rate limited')

      const sentinelResult = results.find(r => r.source === 'sentinel')
      expect(sentinelResult!.recordsIngested).toBe(2)
      expect(sentinelResult!.error).toBeUndefined()
    })

    it('handles Sentinel API errors gracefully', async () => {
      const planetItems = createTestPlanetItems()
      const insertedItems: ImageryItemInput[] = []

      const testLayer = buildTestLayer({
        planetItems,
        sentinelItems: [],
        insertedItems,
        regions: [SF_BAY_AREA_REGION],
        sentinelOptions: {
          shouldFail: true,
          failMessage: 'Sentinel Hub unavailable',
        },
      })

      const program = Effect.gen(function* () {
        const ingester = yield* ImageryIngesterTag
        return yield* ingester.ingestRegion(SF_BAY_AREA_REGION)
      }).pipe(Effect.provide(testLayer))

      const results = await Effect.runPromise(program)

      // Should have results from both - Planet with success, Sentinel with error
      const planetResult = results.find(r => r.source === 'planet')
      expect(planetResult!.recordsIngested).toBe(2)
      expect(planetResult!.error).toBeUndefined()

      const sentinelResult = results.find(r => r.source === 'sentinel')
      expect(sentinelResult!.recordsIngested).toBe(0)
      expect(sentinelResult!.error).toBe('Sentinel Hub unavailable')
    })

    it('handles empty API responses', async () => {
      const insertedItems: ImageryItemInput[] = []

      const testLayer = buildTestLayer({
        planetItems: [],
        sentinelItems: [],
        insertedItems,
        regions: [SF_BAY_AREA_REGION],
      })

      const program = Effect.gen(function* () {
        const ingester = yield* ImageryIngesterTag
        return yield* ingester.ingestRegion(SF_BAY_AREA_REGION)
      }).pipe(Effect.provide(testLayer))

      const results = await Effect.runPromise(program)

      expect(results.length).toBe(2)
      results.forEach(result => {
        expect(result.recordsIngested).toBe(0)
        expect(result.recordsFiltered).toBe(0)
        expect(result.error).toBeUndefined()
      })
      expect(insertedItems.length).toBe(0)
    })
  })

  describe('ingestPlanet', () => {
    it('ingests from Planet Labs specifically', async () => {
      const planetItems = createTestPlanetItems()
      const insertedItems: ImageryItemInput[] = []

      const testLayer = buildTestLayer({
        planetItems,
        insertedItems,
        regions: [SF_BAY_AREA_REGION],
      })

      const program = Effect.gen(function* () {
        const ingester = yield* ImageryIngesterTag
        return yield* ingester.ingestPlanet(SF_BAY_AREA_REGION)
      }).pipe(Effect.provide(testLayer))

      const result = await Effect.runPromise(program)

      expect(result.source).toBe('planet')
      expect(result.region).toBe('sf-bay-area')
      expect(result.recordsIngested).toBe(2)
      expect(result.recordsFiltered).toBe(1)
      expect(insertedItems.length).toBe(2)
    })

    it('applies cloud cover filtering correctly', async () => {
      // All items have low cloud cover (under any threshold)
      const lowCloudItems = [
        makePlanetItem({ id: 'low-1', cloudCover: 0.05 }), // 5%
        makePlanetItem({ id: 'low-2', cloudCover: 0.10 }), // 10%
        makePlanetItem({ id: 'low-3', cloudCover: 0.15 }), // 15%
      ]
      const insertedItems: ImageryItemInput[] = []

      const testLayer = buildTestLayer({
        planetItems: lowCloudItems,
        insertedItems,
        regions: [PLANET_ONLY_REGION], // 20% max threshold
      })

      const program = Effect.gen(function* () {
        const ingester = yield* ImageryIngesterTag
        return yield* ingester.ingestPlanet(PLANET_ONLY_REGION)
      }).pipe(Effect.provide(testLayer))

      const result = await Effect.runPromise(program)

      // All 3 items should pass the 20% threshold
      expect(result.recordsIngested).toBe(3)
      expect(result.recordsFiltered).toBe(0)
    })
  })

  describe('ingestSentinel', () => {
    it('ingests from Sentinel Hub specifically', async () => {
      const sentinelItems = createTestSentinelItems()
      const insertedItems: ImageryItemInput[] = []

      const testLayer = buildTestLayer({
        sentinelItems,
        insertedItems,
        regions: [SF_BAY_AREA_REGION],
      })

      const program = Effect.gen(function* () {
        const ingester = yield* ImageryIngesterTag
        return yield* ingester.ingestSentinel(SF_BAY_AREA_REGION)
      }).pipe(Effect.provide(testLayer))

      const result = await Effect.runPromise(program)

      expect(result.source).toBe('sentinel')
      expect(result.region).toBe('sf-bay-area')
      expect(result.recordsIngested).toBe(2)
      expect(result.recordsFiltered).toBe(1)
      expect(insertedItems.length).toBe(2)
    })

    it('handles Sentinel items with bounding boxes', async () => {
      const sentinelItems = [
        makeSentinelItem({
          id: 'with-bbox',
          bbox: [-123.0, 36.0, -121.0, 38.0],
          cloudCover: 10,
        }),
      ]
      const insertedItems: ImageryItemInput[] = []

      const testLayer = buildTestLayer({
        sentinelItems,
        insertedItems,
        regions: [SF_BAY_AREA_REGION],
      })

      const program = Effect.gen(function* () {
        const ingester = yield* ImageryIngesterTag
        return yield* ingester.ingestSentinel(SF_BAY_AREA_REGION)
      }).pipe(Effect.provide(testLayer))

      await Effect.runPromise(program)

      expect(insertedItems.length).toBe(1)
      expect(Option.isSome(insertedItems[0].bbox)).toBe(true)
      const bbox = Option.getOrNull(insertedItems[0].bbox)
      expect(bbox).toEqual([-123.0, 36.0, -121.0, 38.0])
    })
  })

  describe('multiple regions', () => {
    it('ingests from multiple regions sequentially', async () => {
      const planetItems = createTestPlanetItems()
      const sentinelItems = createTestSentinelItems()
      const insertedItems: ImageryItemInput[] = []

      const testLayer = buildTestLayer({
        planetItems,
        sentinelItems,
        insertedItems,
        regions: [SF_BAY_AREA_REGION, NYC_REGION],
      })

      const program = Effect.gen(function* () {
        const ingester = yield* ImageryIngesterTag
        const sfResults = yield* ingester.ingestRegion(SF_BAY_AREA_REGION)
        const nycResults = yield* ingester.ingestRegion(NYC_REGION)
        return [...sfResults, ...nycResults]
      }).pipe(Effect.provide(testLayer))

      const results = await Effect.runPromise(program)

      // SF: 2 results (Planet + Sentinel), NYC: 1 result (Sentinel only)
      expect(results.length).toBe(3)

      const sfResults = results.filter(r => r.region === 'sf-bay-area')
      expect(sfResults.length).toBe(2)

      const nycResults = results.filter(r => r.region === 'nyc')
      expect(nycResults.length).toBe(1)
      expect(nycResults[0].source).toBe('sentinel')
    })
  })

  describe('data transformation', () => {
    it('correctly transforms Planet items to repository format', async () => {
      const planetItems = [
        makePlanetItem({
          id: 'transform-test',
          cloudCover: 0.12, // 12% -> should become 12 after conversion
          gsd: 3.5,
          sunAzimuth: 145.0,
          sunElevation: 65.0,
        }),
      ]
      const insertedItems: ImageryItemInput[] = []

      const testLayer = buildTestLayer({
        planetItems,
        insertedItems,
        regions: [SF_BAY_AREA_REGION],
      })

      const program = Effect.gen(function* () {
        const ingester = yield* ImageryIngesterTag
        return yield* ingester.ingestPlanet(SF_BAY_AREA_REGION)
      }).pipe(Effect.provide(testLayer))

      await Effect.runPromise(program)

      expect(insertedItems.length).toBe(1)
      const item = insertedItems[0]

      expect(item._tag).toBe('ImageryItemInput')
      expect(item.itemId).toBe('transform-test')
      expect(item.provider).toBe('planet')
      expect(Option.getOrNull(item.cloudCover)).toBe(12) // Converted from 0.12
      expect(Option.getOrNull(item.gsd)).toBe(3.5)
      expect(Option.getOrNull(item.sunAzimuth)).toBe(145.0)
      expect(Option.getOrNull(item.sunElevation)).toBe(65.0)
    })

    it('correctly transforms Sentinel items to repository format', async () => {
      const sentinelItems = [
        makeSentinelItem({
          id: 'sentinel-transform-test',
          collection: 'sentinel-2-l2a',
          cloudCover: 15, // Already percentage
          gsd: 10,
          bbox: [-122.5, 37.0, -122.0, 37.5],
        }),
      ]
      const insertedItems: ImageryItemInput[] = []

      const testLayer = buildTestLayer({
        sentinelItems,
        insertedItems,
        regions: [SF_BAY_AREA_REGION],
      })

      const program = Effect.gen(function* () {
        const ingester = yield* ImageryIngesterTag
        return yield* ingester.ingestSentinel(SF_BAY_AREA_REGION)
      }).pipe(Effect.provide(testLayer))

      await Effect.runPromise(program)

      expect(insertedItems.length).toBe(1)
      const item = insertedItems[0]

      expect(item._tag).toBe('ImageryItemInput')
      expect(item.itemId).toBe('sentinel-transform-test')
      expect(item.provider).toBe('sentinel')
      expect(Option.getOrNull(item.collection)).toBe('sentinel-2-l2a')
      expect(Option.getOrNull(item.cloudCover)).toBe(15)
      expect(Option.getOrNull(item.gsd)).toBe(10)
      expect(Option.isSome(item.bbox)).toBe(true)
    })

    it('computes centroid from bbox correctly', async () => {
      const sentinelItems = [
        makeSentinelItem({
          id: 'centroid-test',
          bbox: [-122.0, 37.0, -121.0, 38.0], // Center should be -121.5, 37.5
          cloudCover: 10,
        }),
      ]
      const insertedItems: ImageryItemInput[] = []

      const testLayer = buildTestLayer({
        sentinelItems,
        insertedItems,
        regions: [SF_BAY_AREA_REGION],
      })

      const program = Effect.gen(function* () {
        const ingester = yield* ImageryIngesterTag
        return yield* ingester.ingestSentinel(SF_BAY_AREA_REGION)
      }).pipe(Effect.provide(testLayer))

      await Effect.runPromise(program)

      expect(insertedItems.length).toBe(1)
      const item = insertedItems[0]

      expect(Option.getOrNull(item.centroidLon)).toBe(-121.5)
      expect(Option.getOrNull(item.centroidLat)).toBe(37.5)
    })
  })

  describe('lifecycle', () => {
    it('starts and stops polling fiber', async () => {
      const planetItems = createTestPlanetItems()
      const sentinelItems = createTestSentinelItems()
      const insertedItems: ImageryItemInput[] = []

      const testLayer = buildTestLayer({
        planetItems,
        sentinelItems,
        insertedItems,
        regions: [SF_BAY_AREA_REGION],
        configOptions: { intervalMs: 100 },
      })

      const program = Effect.gen(function* () {
        const ingester = yield* ImageryIngesterTag

        // Start the ingester
        const fiber = yield* ingester.start()

        // Wait a short time for at least one ingestion cycle
        yield* Effect.sleep(Duration.millis(250))

        // Stop the fiber
        yield* ingester.stop(fiber)

        return insertedItems.length
      }).pipe(Effect.provide(testLayer))

      const count = await Effect.runPromise(program)

      // Should have ingested at least some items
      expect(count).toBeGreaterThan(0)
    })

    it('exposes configuration via config property', async () => {
      const testLayer = buildTestLayer({
        insertedItems: [],
        regions: [SF_BAY_AREA_REGION],
        configOptions: {
          intervalMs: 5000,
          lookbackDays: 7,
        },
      })

      const program = Effect.gen(function* () {
        const ingester = yield* ImageryIngesterTag
        return ingester.config
      }).pipe(Effect.provide(testLayer))

      const config = await Effect.runPromise(program)

      expect(config.intervalMs).toBe(5000)
      expect(config.lookbackDays).toBe(7)
      expect(config.regions.length).toBe(1)
      expect(config.regions[0].name).toBe('sf-bay-area')
    })
  })
})
