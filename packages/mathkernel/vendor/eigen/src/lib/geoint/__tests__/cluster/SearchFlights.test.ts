/**
 * SearchFlights Handler Tests
 *
 * Unit tests for the SearchFlights RPC handler in SearchEntity.
 * Tests OpenSky API integration via mock client.
 *
 * @see beads:tmnl-3ancc Cluster: Entity routing tests
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import {
  createSearchTestClient,
  createMockOpenSkyResponse,
  createMockStateVector,
  testSearchId,
  TestShardingConfig,
  TEST_BBOX,
  ExternalApiError,
  RateLimitError,
} from './helpers/mocks'
import { OpenSkyResponse, Icao24 } from '../../schemas'

describe('SearchFlights Handler', () => {
  describe('successful queries', () => {
    it('returns flight results from OpenSky', async () => {
      const mockResponse = createMockOpenSkyResponse(5)

      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          opensky: { response: mockResponse },
        })
        const client = yield* makeClient('flight-worker')

        const results = yield* client.SearchFlights({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(5)
      expect(results[0]).toHaveProperty('source', 'opensky')
    })

    it('maps OpenSky state vectors to SearchResultFlight', async () => {
      const mockStates = [
        createMockStateVector({
          icao24: 'aaa111' as Icao24,
          callsign: 'UAL123  ',
          originCountry: 'United States',
          longitude: -122.4,
          latitude: 37.8,
          baroAltitude: 35000,
          velocity: 500,
          trueTrack: 45,
          onGround: false,
        }),
      ]
      const mockResponse = new OpenSkyResponse({
        time: Math.floor(Date.now() / 1000),
        states: mockStates,
      })

      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          opensky: { response: mockResponse },
        })
        const client = yield* makeClient('flight-worker')

        const results = yield* client.SearchFlights({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(1)
      const result = results[0] as any
      expect(result.source).toBe('opensky')
      expect(result.callsign?.trim()).toBe('UAL123')
      expect(result.position).toBeDefined()
    })

    it('returns empty array when no flights in bounds', async () => {
      const mockResponse = createMockOpenSkyResponse(0)

      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          opensky: { response: mockResponse },
        })
        const client = yield* makeClient('flight-worker')

        const results = yield* client.SearchFlights({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(0)
    })

    it('returns empty array when OpenSky returns null states', async () => {
      const mockResponse = new OpenSkyResponse({
        time: Math.floor(Date.now() / 1000),
        states: null,
      })

      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          opensky: { response: mockResponse },
        })
        const client = yield* makeClient('flight-worker')

        const results = yield* client.SearchFlights({
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

  describe('limit handling', () => {
    it('respects limit parameter', async () => {
      const mockResponse = createMockOpenSkyResponse(20)

      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          opensky: { response: mockResponse },
        })
        const client = yield* makeClient('flight-worker')

        const results = yield* client.SearchFlights({
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
      const mockResponse = createMockOpenSkyResponse(3)

      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          opensky: { response: mockResponse },
        })
        const client = yield* makeClient('flight-worker')

        const results = yield* client.SearchFlights({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(3)
    })

    it('uses default limit when not specified', async () => {
      const mockResponse = createMockOpenSkyResponse(5)

      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          opensky: { response: mockResponse },
        })
        const client = yield* makeClient('flight-worker')

        // Not passing limit - should use default (100)
        const results = yield* client.SearchFlights({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(5) // All 5 returned since < 100
    })
  })

  describe('bounds handling', () => {
    it('works without bounds (returns API default results)', async () => {
      const mockResponse = createMockOpenSkyResponse(3)

      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          opensky: { response: mockResponse },
        })
        const client = yield* makeClient('flight-worker')

        // No bounds specified
        const results = yield* client.SearchFlights({
          searchId: testSearchId(),
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      // Handler returns results even without bounds (passes to OpenSky unbounded)
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('ICAO24 filtering', () => {
    it('accepts icao24 filter parameter', async () => {
      const mockResponse = createMockOpenSkyResponse(1)

      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          opensky: { response: mockResponse },
        })
        const client = yield* makeClient('flight-worker')

        const results = yield* client.SearchFlights({
          searchId: testSearchId(),
          icao24: ['abc123', 'def456'],
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      // Mock doesn't filter, just verify it accepts the param
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('error handling', () => {
    it('handles OpenSky server error gracefully', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          opensky: {
            shouldFail: true,
            error: new ExternalApiError({
              source: 'opensky',
              statusCode: 500,
              message: 'Internal Server Error',
              retryable: true,
            }),
          },
        })
        const client = yield* makeClient('flight-worker')

        // Handler catches errors and returns empty array
        const results = yield* client.SearchFlights({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(0)
    })

    it('handles OpenSky 503 service unavailable', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          opensky: {
            shouldFail: true,
            error: new ExternalApiError({
              source: 'opensky',
              statusCode: 503,
              message: 'Service Temporarily Unavailable',
              retryable: true,
            }),
          },
        })
        const client = yield* makeClient('flight-worker')

        const results = yield* client.SearchFlights({
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
          opensky: {
            shouldFail: true,
            error: new RateLimitError({
              source: 'opensky',
              retryAfterSeconds: 60,
              message: 'Rate limit exceeded',
            }),
          },
        })
        const client = yield* makeClient('flight-worker')

        const results = yield* client.SearchFlights({
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
          opensky: {
            shouldFail: true,
            error: new ExternalApiError({
              source: 'opensky',
              statusCode: 429,
              message: 'Too Many Requests',
              retryable: true,
            }),
          },
        })
        const client = yield* makeClient('flight-worker')

        const results = yield* client.SearchFlights({
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
