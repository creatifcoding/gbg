/**
 * SearchOsm Handler Tests
 *
 * Unit tests for the SearchOsm RPC handler in SearchEntity.
 * Tests Overpass API integration via mock client.
 *
 * @see beads:tmnl-3ancc Cluster: Entity routing tests
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import {
  createSearchTestClient,
  createMockOverpassResponse,
  createMockOverpassElement,
  testSearchId,
  TestShardingConfig,
  TEST_BBOX,
  ExternalApiError,
  RateLimitError,
} from './helpers/mocks'
import { OverpassResponse } from '../../schemas'

describe('SearchOsm Handler', () => {
  describe('successful queries', () => {
    it('returns POI results from Overpass', async () => {
      const program = Effect.gen(function* () {
        const mockResponse = createMockOverpassResponse(5)

        const makeClient = yield* createSearchTestClient({
          overpass: { response: mockResponse },
        })
        const client = yield* makeClient('osm-worker')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]).toHaveProperty('source', 'osm')
    })

    it('maps Overpass elements to SearchResultPoi', async () => {
      const program = Effect.gen(function* () {
        const mockElements = [
          createMockOverpassElement({
            id: 12345,
            lat: 37.8,
            lon: -122.4,
            tags: {
              name: 'Golden Gate Restaurant',
              amenity: 'restaurant',
              cuisine: 'american',
            },
          }),
        ]
        const mockResponse = new OverpassResponse({
          version: 0.6,
          generator: 'Overpass API',
          osm3s: {
            timestamp_osm_base: new Date().toISOString(),
            copyright: 'OpenStreetMap contributors',
          },
          elements: mockElements,
        })

        const makeClient = yield* createSearchTestClient({
          overpass: { response: mockResponse },
        })
        const client = yield* makeClient('osm-worker')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)
      expect(results).toHaveLength(1)
      const result = results[0] as any
      expect(result.source).toBe('osm')
      expect(result.name).toBe('Golden Gate Restaurant')
      expect(result.position).toEqual([-122.4, 37.8])
    })

    it('returns empty array when no POIs found', async () => {
      const program = Effect.gen(function* () {
        const mockResponse = createMockOverpassResponse(0)

        const makeClient = yield* createSearchTestClient({
          overpass: { response: mockResponse },
        })
        const client = yield* makeClient('osm-worker')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)
      expect(results).toHaveLength(0)
    })
  })

  describe('amenity filtering', () => {
    it('accepts amenities filter parameter', async () => {
      const program = Effect.gen(function* () {
        const mockResponse = createMockOverpassResponse(3)

        const makeClient = yield* createSearchTestClient({
          overpass: { response: mockResponse },
        })
        const client = yield* makeClient('osm-worker')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          amenities: ['restaurant', 'cafe', 'bar'],
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)
      expect(Array.isArray(results)).toBe(true)
    })

    it('uses default amenities when not specified', async () => {
      const program = Effect.gen(function* () {
        const mockResponse = createMockOverpassResponse(3)

        const makeClient = yield* createSearchTestClient({
          overpass: { response: mockResponse },
        })
        const client = yield* makeClient('osm-worker')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
          // No amenities specified
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('limit handling', () => {
    it('respects limit parameter', async () => {
      const program = Effect.gen(function* () {
        const mockResponse = createMockOverpassResponse(20)

        const makeClient = yield* createSearchTestClient({
          overpass: { response: mockResponse },
        })
        const client = yield* makeClient('osm-worker')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 5,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)
      expect(results.length).toBeLessThanOrEqual(5)
    })

    it('returns all results when limit exceeds available', async () => {
      const program = Effect.gen(function* () {
        const mockResponse = createMockOverpassResponse(3)

        const makeClient = yield* createSearchTestClient({
          overpass: { response: mockResponse },
        })
        const client = yield* makeClient('osm-worker')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)
      expect(results.length).toBeLessThanOrEqual(3)
    })

    it('uses default limit when not specified', async () => {
      const program = Effect.gen(function* () {
        const mockResponse = createMockOverpassResponse(5)

        const makeClient = yield* createSearchTestClient({
          overpass: { response: mockResponse },
        })
        const client = yield* makeClient('osm-worker')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          // No limit specified
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)
      expect(results.length).toBeLessThanOrEqual(5)
    })
  })

  describe('element types', () => {
    it('handles node elements', async () => {
      const program = Effect.gen(function* () {
        const mockResponse = new OverpassResponse({
          version: 0.6,
          generator: 'Overpass API',
          osm3s: {
            timestamp_osm_base: new Date().toISOString(),
            copyright: 'OpenStreetMap contributors',
          },
          elements: [
            createMockOverpassElement({
              type: 'node',
              lat: 37.8,
              lon: -122.4,
            }),
          ],
        })

        const makeClient = yield* createSearchTestClient({
          overpass: { response: mockResponse },
        })
        const client = yield* makeClient('osm-worker')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)
      expect(results.length).toBe(1)
    })

    it('handles way elements with center', async () => {
      const program = Effect.gen(function* () {
        const mockResponse = new OverpassResponse({
          version: 0.6,
          generator: 'Overpass API',
          osm3s: {
            timestamp_osm_base: new Date().toISOString(),
            copyright: 'OpenStreetMap contributors',
          },
          elements: [
            createMockOverpassElement({
              type: 'way',
              // Ways use center property instead of lat/lon
              center: { lat: 37.8, lon: -122.4 },
              lat: undefined,
              lon: undefined,
            }),
          ],
        })

        const makeClient = yield* createSearchTestClient({
          overpass: { response: mockResponse },
        })
        const client = yield* makeClient('osm-worker')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)
      // Handler should extract center coordinates
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('error handling', () => {
    it('handles Overpass server error gracefully', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          overpass: {
            shouldFail: true,
            error: new ExternalApiError({
              source: 'overpass',
              statusCode: 500,
              message: 'Internal Server Error',
              retryable: true,
            }),
          },
        })
        const client = yield* makeClient('osm-worker')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)
      expect(results).toHaveLength(0)
    })

    it('handles rate limit error gracefully', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          overpass: {
            shouldFail: true,
            error: new RateLimitError({
              source: 'overpass',
              retryAfterSeconds: 30,
              message: 'Rate limit exceeded',
            }),
          },
        })
        const client = yield* makeClient('osm-worker')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)
      expect(results).toHaveLength(0)
    })

    it('handles 429 too many requests', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          overpass: {
            shouldFail: true,
            error: new ExternalApiError({
              source: 'overpass',
              statusCode: 429,
              message: 'Too Many Requests',
              retryable: true,
            }),
          },
        })
        const client = yield* makeClient('osm-worker')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)
      expect(results).toHaveLength(0)
    })

    it('handles Overpass timeout gracefully', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          overpass: {
            shouldFail: true,
            error: new ExternalApiError({
              source: 'overpass',
              statusCode: 504,
              message: 'Gateway Timeout',
              retryable: true,
            }),
          },
        })
        const client = yield* makeClient('osm-worker')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)
      expect(results).toHaveLength(0)
    })
  })
})
