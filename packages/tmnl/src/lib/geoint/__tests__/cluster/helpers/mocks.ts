/**
 * Shared test mocks for GEOINT cluster tests
 *
 * Provides:
 * - Mock data factories for OpenSky, Overpass responses
 * - Mock service layers for external API clients
 * - Test helpers for Entity testing
 *
 * @module
 */

import { Effect, Layer, Option as O } from 'effect'
import { Entity, ShardingConfig } from '@effect/cluster'
import {
  OpenSkyClientService,
  OverpassClientService,
  type OpenSkyClient,
  type OverpassClient,
  ExternalApiError,
  RateLimitError,
  TimeoutError,
} from '../../../api/ExternalApiClient'
import {
  TrackPositionRepositoryTag,
  FeatureRepositoryTag,
  type TrackPositionRepository,
  type FeatureRepository,
  type TrackPositionSearchOptions,
  type FeatureSearchOptions,
} from '../../../persistence'
import {
  OpenSkyResponse,
  OpenSkyStateVector,
  OverpassResponse,
  OverpassElement,
  SearchId,
  Icao24,
  type BBox,
} from '../../../schemas'
import { SearchEntity } from '../../../cluster/SearchEntity'
import { SearchEntityHandlers } from '../../../cluster/SearchEntityHandlers'

// =============================================================================
// Test Constants
// =============================================================================

/**
 * Test bounding box (San Francisco area)
 */
export const TEST_BBOX: BBox = [-122.5, 37.7, -122.3, 37.9]

/**
 * Larger test bounding box (Bay Area)
 */
export const TEST_BBOX_LARGE: BBox = [-123.0, 37.0, -121.5, 38.5]

/**
 * Generate unique search ID for tests
 */
export const testSearchId = () =>
  `test-${Date.now()}-${Math.random().toString(36).slice(2)}` as SearchId

/**
 * Sharding config for tests
 */
export const TestShardingConfig = ShardingConfig.layer({
  shardsPerGroup: 10,
  entityMailboxCapacity: 10,
  entityTerminationTimeout: 0,
  entityMessagePollInterval: 5000,
  sendRetryInterval: 100,
})

// =============================================================================
// OpenSky Mock Data Factories
// =============================================================================

/**
 * Create a mock OpenSky state vector with sensible defaults
 */
export const createMockStateVector = (
  overrides?: Partial<typeof OpenSkyStateVector.Type>
) =>
  new OpenSkyStateVector({
    icao24: 'abc123' as Icao24,
    callsign: 'TEST123 ',
    originCountry: 'United States',
    timePosition: Date.now() / 1000,
    lastContact: Date.now() / 1000,
    longitude: -122.4,
    latitude: 37.8,
    baroAltitude: 10000,
    onGround: false,
    velocity: 250,
    trueTrack: 90,
    verticalRate: 0,
    sensors: null,
    geoAltitude: 10500,
    squawk: '1200',
    spi: false,
    positionSource: 0,
    category: 3,
    ...overrides,
  })

/**
 * Create multiple mock state vectors
 */
export const createMockStateVectors = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    createMockStateVector({
      icao24: `abc${String(i).padStart(3, '0')}` as Icao24,
      callsign: `TEST${String(i).padStart(3, '0')} `,
      longitude: -122.4 + i * 0.1,
      latitude: 37.8 + i * 0.05,
    })
  )

/**
 * Create mock OpenSky response
 */
export const createMockOpenSkyResponse = (
  count: number = 3,
  states?: ReadonlyArray<typeof OpenSkyStateVector.Type> | null
) =>
  new OpenSkyResponse({
    time: Math.floor(Date.now() / 1000),
    states: states === undefined ? createMockStateVectors(count) : states,
  })

// =============================================================================
// Overpass Mock Data Factories
// =============================================================================

/**
 * Create a mock Overpass element
 */
export const createMockOverpassElement = (
  overrides?: Partial<typeof OverpassElement.Type>
) =>
  new OverpassElement({
    type: 'node' as const,
    id: Math.floor(Math.random() * 1000000),
    lat: 37.8,
    lon: -122.4,
    tags: {
      name: 'Test POI',
      amenity: 'restaurant',
    },
    ...overrides,
  })

/**
 * Create multiple mock Overpass elements
 */
export const createMockOverpassElements = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    createMockOverpassElement({
      id: 1000 + i,
      lat: 37.8 + i * 0.01,
      lon: -122.4 + i * 0.01,
      tags: {
        name: `POI ${i}`,
        amenity: i % 3 === 0 ? 'restaurant' : i % 3 === 1 ? 'cafe' : 'hospital',
      },
    })
  )

/**
 * Create mock Overpass response
 */
export const createMockOverpassResponse = (count: number = 3) =>
  new OverpassResponse({
    version: 0.6,
    generator: 'Overpass API',
    osm3s: {
      timestamp_osm_base: new Date().toISOString(),
      copyright: 'OpenStreetMap contributors',
    },
    elements: createMockOverpassElements(count),
  })

// =============================================================================
// Mock Service Factories
// =============================================================================

/**
 * Options for mocking OpenSky client
 */
export interface MockOpenSkyOptions {
  response?: typeof OpenSkyResponse.Type
  shouldFail?: boolean
  error?: ExternalApiError | RateLimitError | TimeoutError
  delay?: number // ms
}

/**
 * Create mock OpenSky client layer
 */
export const createMockOpenSkyLayer = (options: MockOpenSkyOptions = {}) =>
  Layer.succeed(OpenSkyClientService, {
    getStates: (_params): Effect.Effect<
      typeof OpenSkyResponse.Type,
      ExternalApiError | RateLimitError | TimeoutError
    > => {
      if (options.shouldFail) {
        return Effect.fail(
          options.error ??
            new ExternalApiError({
              source: 'opensky',
              statusCode: 500,
              message: 'Mock OpenSky error',
              retryable: false,
            })
        )
      }

      const response = options.response ?? createMockOpenSkyResponse()

      if (options.delay) {
        return Effect.delay(Effect.succeed(response), `${options.delay} millis`)
      }

      return Effect.succeed(response)
    },
  } satisfies OpenSkyClient)

/**
 * Options for mocking Overpass client
 */
export interface MockOverpassOptions {
  response?: typeof OverpassResponse.Type
  shouldFail?: boolean
  error?: ExternalApiError | RateLimitError | TimeoutError
  delay?: number // ms
}

/**
 * Create mock Overpass client layer
 */
export const createMockOverpassLayer = (options: MockOverpassOptions = {}) =>
  Layer.succeed(OverpassClientService, {
    query: (_overpassQL, _options): Effect.Effect<
      typeof OverpassResponse.Type,
      ExternalApiError | RateLimitError | TimeoutError
    > => {
      if (options.shouldFail) {
        return Effect.fail(
          options.error ??
            new ExternalApiError({
              source: 'overpass',
              statusCode: 500,
              message: 'Mock Overpass error',
              retryable: false,
            })
        )
      }

      const response = options.response ?? createMockOverpassResponse()

      if (options.delay) {
        return Effect.delay(Effect.succeed(response), `${options.delay} millis`)
      }

      return Effect.succeed(response)
    },
    buildQuery: (opts) => {
      const [minLon, minLat, maxLon, maxLat] = opts.bounds
      const bbox = `${minLat},${minLon},${maxLat},${maxLon}`
      const amenities = opts.amenities ?? ['restaurant', 'cafe']
      return `[out:json][timeout:25];(node["amenity"~"${amenities.join('|')}"](${bbox}););out center;`
    },
  } satisfies OverpassClient)

/**
 * Combined options for all mock services
 */
export interface MockServicesOptions {
  opensky?: MockOpenSkyOptions
  overpass?: MockOverpassOptions
}

/**
 * Create combined mock services layer
 */
export const createMockServicesLayer = (options: MockServicesOptions = {}) =>
  Layer.mergeAll(
    createMockOpenSkyLayer(options.opensky ?? {}),
    createMockOverpassLayer(options.overpass ?? {})
  )

// =============================================================================
// Entity Test Helpers
// =============================================================================

/**
 * Create the SearchEntity handlers layer with mock services
 */
export const createTestHandlersLayer = (options: MockServicesOptions = {}) =>
  SearchEntityHandlers.pipe(Layer.provide(createMockServicesLayer(options)))

/**
 * Create a test client for the SearchEntity
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const makeClient = yield* createSearchTestClient({ opensky: { response: mockResponse }})
 *   const client = yield* makeClient('flight-worker')
 *   const results = yield* client.SearchFlights({ searchId, bounds, limit: 100 })
 *   return results
 * }).pipe(Effect.provide(TestShardingConfig))
 * ```
 */
export const createSearchTestClient = (options: MockServicesOptions = {}) =>
  Entity.makeTestClient(SearchEntity, createTestHandlersLayer(options))

// =============================================================================
// Error Factories
// =============================================================================

/**
 * Create ExternalApiError
 */
export const createApiError = (
  source: string,
  statusCode: number,
  message: string,
  retryable: boolean = false
) =>
  new ExternalApiError({
    source,
    statusCode,
    message,
    retryable,
  })

/**
 * Create RateLimitError
 */
export const createRateLimitError = (
  source: string,
  retryAfterSeconds: number = 60
) =>
  new RateLimitError({
    source,
    retryAfterSeconds,
    message: `Rate limit exceeded for ${source}. Try again in ${retryAfterSeconds}s.`,
  })

/**
 * Create TimeoutError
 */
export const createTimeoutError = (source: string, timeoutMs: number = 30000) =>
  new TimeoutError({
    source,
    timeoutMs,
    message: `${source} API request timed out after ${timeoutMs}ms`,
  })

// =============================================================================
// PostGIS Repository Mock Factories
// =============================================================================

/**
 * Valid classification values for SearchResultTrack
 */
export type MockClassification = 'friendly' | 'hostile' | 'neutral' | 'unknown'

/**
 * Create mock track position data
 */
export const createMockTrackPosition = (overrides?: {
  id?: number
  track_id?: string
  longitude?: number
  latitude?: number
  altitude?: number
  heading?: number
  speed?: number
  classification?: MockClassification
  timestamp?: Date
}) => ({
  id: overrides?.id ?? Math.floor(Math.random() * 1000000),
  track_id: overrides?.track_id ?? `TRACK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  longitude: overrides?.longitude ?? -122.4,
  latitude: overrides?.latitude ?? 37.8,
  altitude: overrides?.altitude ?? 1000,
  heading: overrides?.heading ?? 90,
  speed: overrides?.speed ?? 50,
  classification: overrides?.classification ?? 'unknown',
  timestamp: overrides?.timestamp ?? new Date(),
  geom: null, // Not needed for tests
})

/**
 * Create multiple mock track positions
 */
export const createMockTrackPositions = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    createMockTrackPosition({
      id: 1000 + i,
      track_id: `TRACK-${String(i).padStart(3, '0')}`,
      longitude: -122.4 + i * 0.01,
      latitude: 37.8 + i * 0.01,
    })
  )

/**
 * Create mock feature data
 */
export const createMockFeature = (overrides?: {
  id?: number
  feature_id?: string
  name?: string
  feature_type?: string
  geom?: { type: string; coordinates: number[] | number[][] | number[][][] }
  properties?: Record<string, unknown>
}) => ({
  id: overrides?.id ?? Math.floor(Math.random() * 1000000),
  feature_id: overrides?.feature_id ?? `FEAT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  name: overrides?.name ?? 'Test Feature',
  feature_type: overrides?.feature_type ?? 'polygon',
  geom: overrides?.geom ?? { type: 'Point', coordinates: [-122.4, 37.8] },
  properties: overrides?.properties ?? {},
  created_at: new Date(),
  updated_at: new Date(),
})

/**
 * Create multiple mock features
 */
export const createMockFeatures = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    createMockFeature({
      id: 1000 + i,
      feature_id: `FEAT-${String(i).padStart(3, '0')}`,
      name: `Feature ${i}`,
      geom: { type: 'Point', coordinates: [-122.4 + i * 0.01, 37.8 + i * 0.01] },
    })
  )

/**
 * Options for mocking TrackPositionRepository
 */
export interface MockTrackRepoOptions {
  searchResults?: ReturnType<typeof createMockTrackPosition>[]
  shouldFail?: boolean
  error?: Error
}

/**
 * Create mock TrackPositionRepository layer
 */
export const createMockTrackRepoLayer = (options: MockTrackRepoOptions = {}) =>
  Layer.succeed(TrackPositionRepositoryTag, {
    insert: (_input) => Effect.succeed(createMockTrackPosition() as any),
    insertBatch: (inputs) =>
      Effect.succeed(inputs.map((_, i) => createMockTrackPosition({ id: i })) as any),
    getLatest: (_trackId) => Effect.succeed(O.some(createMockTrackPosition() as any)),
    getHistory: (_trackId, _opts) =>
      Effect.succeed(createMockTrackPositions(3) as any),
    search: (_options: TrackPositionSearchOptions) => {
      if (options.shouldFail) {
        return Effect.fail(options.error ?? new Error('Mock track repo error'))
      }
      return Effect.succeed((options.searchResults ?? createMockTrackPositions(3)) as any)
    },
    count: (_options) => Effect.succeed(options.searchResults?.length ?? 3),
    deleteOlderThan: (_date) => Effect.succeed(0),
  } as TrackPositionRepository)

/**
 * Options for mocking FeatureRepository
 */
export interface MockFeatureRepoOptions {
  searchResults?: ReturnType<typeof createMockFeature>[]
  shouldFail?: boolean
  error?: Error
}

/**
 * Create mock FeatureRepository layer
 */
export const createMockFeatureRepoLayer = (options: MockFeatureRepoOptions = {}) =>
  Layer.succeed(FeatureRepositoryTag, {
    upsert: (_input) => Effect.succeed(createMockFeature() as any),
    upsertBatch: (inputs) =>
      Effect.succeed(inputs.map((_, i) => createMockFeature({ id: i })) as any),
    getById: (_featureId) => Effect.succeed(O.some(createMockFeature() as any)),
    search: (_options: FeatureSearchOptions) => {
      if (options.shouldFail) {
        return Effect.fail(options.error ?? new Error('Mock feature repo error'))
      }
      return Effect.succeed((options.searchResults ?? createMockFeatures(3)) as any)
    },
    delete: (_featureId) => Effect.succeed(true),
  } as FeatureRepository)

// =============================================================================
// Extended Mock Services Options
// =============================================================================

/**
 * Extended options including repository mocks
 */
export interface ExtendedMockServicesOptions extends MockServicesOptions {
  trackRepo?: MockTrackRepoOptions
  featureRepo?: MockFeatureRepoOptions
}

/**
 * Create combined mock services layer with repositories
 */
export const createExtendedMockServicesLayer = (options: ExtendedMockServicesOptions = {}) =>
  Layer.mergeAll(
    createMockOpenSkyLayer(options.opensky ?? {}),
    createMockOverpassLayer(options.overpass ?? {}),
    ...(options.trackRepo ? [createMockTrackRepoLayer(options.trackRepo)] : []),
    ...(options.featureRepo ? [createMockFeatureRepoLayer(options.featureRepo)] : [])
  )

/**
 * Create test handlers layer with extended services
 */
export const createExtendedTestHandlersLayer = (options: ExtendedMockServicesOptions = {}) =>
  SearchEntityHandlers.pipe(Layer.provide(createExtendedMockServicesLayer(options)))

/**
 * Create a test client with extended mock services
 */
export const createExtendedSearchTestClient = (options: ExtendedMockServicesOptions = {}) =>
  Entity.makeTestClient(SearchEntity, createExtendedTestHandlersLayer(options))

// =============================================================================
// Re-exports for convenience
// =============================================================================

export { SearchEntity, SearchEntityHandlers }
export { ExternalApiError, RateLimitError, TimeoutError }
