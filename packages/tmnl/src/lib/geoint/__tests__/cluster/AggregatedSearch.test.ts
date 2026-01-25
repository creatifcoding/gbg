/**
 * AggregatedSearch Handler Tests
 *
 * Unit tests for the AggregatedSearch RPC handler in SearchEntity.
 * Tests fan-out/fan-in aggregation pattern across multiple sources.
 *
 * @see beads:tmnl-3ancc Cluster: Entity routing tests
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import {
  createExtendedSearchTestClient,
  createMockOpenSkyResponse,
  createMockOverpassResponse,
  createMockTrackPositions,
  createMockFeatures,
  testSearchId,
  TestShardingConfig,
  TEST_BBOX,
  ExternalApiError,
} from './helpers/mocks'
import { SearchQuery, GeoFilterBounds, SearchId } from '../../schemas'

/**
 * Helper to create a SearchQuery with bounds
 */
const createTestQuery = (overrides?: Partial<{
  sources: readonly string[]
  limitPerSource: number
}>): typeof SearchQuery.Type => {
  const id = testSearchId()
  return new SearchQuery({
    id: id as SearchId,
    sources: (overrides?.sources ?? ['osm', 'opensky']) as any,
    geoFilter: new GeoFilterBounds({ bounds: TEST_BBOX }),
    limitPerSource: overrides?.limitPerSource ?? 100,
  })
}

describe('AggregatedSearch Handler', () => {
  describe('multi-source aggregation', () => {
    it('aggregates results from multiple sources', async () => {
      const program = Effect.gen(function* () {
        const mockOpenSky = createMockOpenSkyResponse(3)
        const mockOverpass = createMockOverpassResponse(5)

        const makeClient = yield* createExtendedSearchTestClient({
          opensky: { response: mockOpenSky },
          overpass: { response: mockOverpass },
        })
        const client = yield* makeClient('aggregator-worker')

        const query = createTestQuery({ sources: ['osm', 'opensky'] })
        const response = yield* client.AggregatedSearch({ query })

        return response
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const response = await Effect.runPromise(program)

      // Should have results from both sources
      expect(response.totalCount).toBeGreaterThan(0)
      expect(response.results.length).toBeGreaterThan(0)
    })

    it('returns source counts for each queried source', async () => {
      const program = Effect.gen(function* () {
        const mockOpenSky = createMockOpenSkyResponse(3)
        const mockOverpass = createMockOverpassResponse(5)

        const makeClient = yield* createExtendedSearchTestClient({
          opensky: { response: mockOpenSky },
          overpass: { response: mockOverpass },
        })
        const client = yield* makeClient('aggregator-worker')

        const query = createTestQuery({ sources: ['osm', 'opensky'] })
        const response = yield* client.AggregatedSearch({ query })

        return response
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const response = await Effect.runPromise(program)

      // Should have counts per source
      expect(response.sourceCounts).toBeDefined()
      expect(typeof response.sourceCounts['osm']).toBe('number')
      expect(typeof response.sourceCounts['opensky']).toBe('number')
    })

    it('includes execution time in response', async () => {
      const program = Effect.gen(function* () {
        const mockOpenSky = createMockOpenSkyResponse(3)
        const mockOverpass = createMockOverpassResponse(5)

        const makeClient = yield* createExtendedSearchTestClient({
          opensky: { response: mockOpenSky },
          overpass: { response: mockOverpass },
        })
        const client = yield* makeClient('aggregator-worker')

        const query = createTestQuery()
        const response = yield* client.AggregatedSearch({ query })

        return response
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const response = await Effect.runPromise(program)

      expect(response.executionTimeMs).toBeDefined()
      expect(response.executionTimeMs).toBeGreaterThanOrEqual(0)
    })

    it('queries all default sources when none specified', async () => {
      const program = Effect.gen(function* () {
        const mockOpenSky = createMockOpenSkyResponse(2)
        const mockOverpass = createMockOverpassResponse(2)
        const mockTracks = createMockTrackPositions(2)
        const mockFeatures = createMockFeatures(2)

        const makeClient = yield* createExtendedSearchTestClient({
          opensky: { response: mockOpenSky },
          overpass: { response: mockOverpass },
          trackRepo: { searchResults: mockTracks },
          featureRepo: { searchResults: mockFeatures },
        })
        const client = yield* makeClient('aggregator-worker')

        // Empty sources array means query all
        const query = createTestQuery({ sources: [] })
        const response = yield* client.AggregatedSearch({ query })

        return response
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const response = await Effect.runPromise(program)

      expect(response.totalCount).toBeGreaterThan(0)
    })
  })

  describe('partial failure handling', () => {
    it('continues when one source fails', async () => {
      const program = Effect.gen(function* () {
        const mockOverpass = createMockOverpassResponse(5)

        const makeClient = yield* createExtendedSearchTestClient({
          opensky: {
            shouldFail: true,
            error: new ExternalApiError({
              source: 'opensky',
              statusCode: 500,
              message: 'Service unavailable',
              retryable: true,
            }),
          },
          overpass: { response: mockOverpass },
        })
        const client = yield* makeClient('aggregator-worker')

        const query = createTestQuery({ sources: ['osm', 'opensky'] })
        const response = yield* client.AggregatedSearch({ query })

        return response
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const response = await Effect.runPromise(program)

      // Should still have results from working source
      expect(response.results.length).toBeGreaterThan(0)
      // OSM should have results, OpenSky should be 0
      expect(response.sourceCounts['osm']).toBeGreaterThan(0)
      expect(response.sourceCounts['opensky']).toBe(0)
    })

    it('records errors for failed sources', async () => {
      const program = Effect.gen(function* () {
        const mockOverpass = createMockOverpassResponse(5)

        const makeClient = yield* createExtendedSearchTestClient({
          opensky: {
            shouldFail: true,
            error: new ExternalApiError({
              source: 'opensky',
              statusCode: 500,
              message: 'Service unavailable',
              retryable: true,
            }),
          },
          overpass: { response: mockOverpass },
        })
        const client = yield* makeClient('aggregator-worker')

        const query = createTestQuery({ sources: ['osm', 'opensky'] })
        const response = yield* client.AggregatedSearch({ query })

        return response
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const response = await Effect.runPromise(program)

      // Should have error recorded for OpenSky
      expect(response.errors).toBeDefined()
      expect(response.errors['opensky']).toBeDefined()
    })

    it('returns empty when all sources fail', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          opensky: {
            shouldFail: true,
            error: new ExternalApiError({
              source: 'opensky',
              statusCode: 500,
              message: 'Service unavailable',
              retryable: true,
            }),
          },
          overpass: {
            shouldFail: true,
            error: new ExternalApiError({
              source: 'overpass',
              statusCode: 500,
              message: 'Service unavailable',
              retryable: true,
            }),
          },
        })
        const client = yield* makeClient('aggregator-worker')

        const query = createTestQuery({ sources: ['osm', 'opensky'] })
        const response = yield* client.AggregatedSearch({ query })

        return response
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const response = await Effect.runPromise(program)

      // Should return empty results but not fail
      expect(response.totalCount).toBe(0)
      expect(response.results).toHaveLength(0)
    })
  })

  describe('limit handling', () => {
    it('respects limitPerSource parameter', async () => {
      const program = Effect.gen(function* () {
        const mockOpenSky = createMockOpenSkyResponse(20)
        const mockOverpass = createMockOverpassResponse(20)

        const makeClient = yield* createExtendedSearchTestClient({
          opensky: { response: mockOpenSky },
          overpass: { response: mockOverpass },
        })
        const client = yield* makeClient('aggregator-worker')

        const query = createTestQuery({
          sources: ['osm', 'opensky'],
          limitPerSource: 5,
        })
        const response = yield* client.AggregatedSearch({ query })

        return response
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const response = await Effect.runPromise(program)

      // Each source should be limited
      expect(response.sourceCounts['osm']).toBeLessThanOrEqual(5)
      expect(response.sourceCounts['opensky']).toBeLessThanOrEqual(5)
    })

    it('uses default limit when not specified', async () => {
      const program = Effect.gen(function* () {
        const mockOpenSky = createMockOpenSkyResponse(5)
        const mockOverpass = createMockOverpassResponse(5)

        const makeClient = yield* createExtendedSearchTestClient({
          opensky: { response: mockOpenSky },
          overpass: { response: mockOverpass },
        })
        const client = yield* makeClient('aggregator-worker')

        // Default limit is 100
        const query = createTestQuery()
        const response = yield* client.AggregatedSearch({ query })

        return response
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const response = await Effect.runPromise(program)

      expect(response.totalCount).toBeGreaterThan(0)
    })
  })

  describe('bounds handling', () => {
    it('returns empty for sources requiring bounds when none provided', async () => {
      const program = Effect.gen(function* () {
        const mockOverpass = createMockOverpassResponse(5)

        const makeClient = yield* createExtendedSearchTestClient({
          overpass: { response: mockOverpass },
        })
        const client = yield* makeClient('aggregator-worker')

        // Query without geo filter
        const query = new SearchQuery({
          id: testSearchId() as SearchId,
          sources: ['osm'] as any,
          geoFilter: undefined, // No bounds
          limitPerSource: 100,
        })
        const response = yield* client.AggregatedSearch({ query })

        return response
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const response = await Effect.runPromise(program)

      // OSM requires bounds, should return empty
      expect(response.sourceCounts['osm']).toBe(0)
    })
  })

  describe('response structure', () => {
    it('returns queryId matching input', async () => {
      const program = Effect.gen(function* () {
        const mockOverpass = createMockOverpassResponse(3)

        const makeClient = yield* createExtendedSearchTestClient({
          overpass: { response: mockOverpass },
        })
        const client = yield* makeClient('aggregator-worker')

        const query = createTestQuery({ sources: ['osm'] })
        const response = yield* client.AggregatedSearch({ query })

        return { response, queryId: query.id }
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const { response, queryId } = await Effect.runPromise(program)

      expect(response.queryId).toBe(queryId)
    })

    it('returns truncated flag', async () => {
      const program = Effect.gen(function* () {
        const mockOverpass = createMockOverpassResponse(3)

        const makeClient = yield* createExtendedSearchTestClient({
          overpass: { response: mockOverpass },
        })
        const client = yield* makeClient('aggregator-worker')

        const query = createTestQuery({ sources: ['osm'] })
        const response = yield* client.AggregatedSearch({ query })

        return response
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const response = await Effect.runPromise(program)

      expect(typeof response.truncated).toBe('boolean')
    })
  })
})
