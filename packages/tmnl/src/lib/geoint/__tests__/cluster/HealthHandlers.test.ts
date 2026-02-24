/**
 * Health Handlers Tests
 *
 * Unit tests for health and control RPC handlers in SearchEntity:
 * - GetSourceHealth: Check health status of all sources
 * - PingSource: Ping individual source for health check
 * - CancelSearch: Cancel an ongoing search
 *
 * @see beads:tmnl-3ancc Cluster: Entity routing tests
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import {
  createSearchTestClient,
  createMockOpenSkyResponse,
  createMockOverpassResponse,
  testSearchId,
  TestShardingConfig,
  ExternalApiError,
  RateLimitError,
} from './helpers/mocks'

describe('GetSourceHealth Handler', () => {
  describe('source enumeration', () => {
    it('returns health status for all sources', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({})
        const client = yield* makeClient('health-worker')

        const healthStatuses = yield* client.GetSourceHealth({})

        return healthStatuses
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const healthStatuses = await Effect.runPromise(program)

      expect(Array.isArray(healthStatuses)).toBe(true)
      expect(healthStatuses.length).toBeGreaterThan(0)
    })

    it('includes expected source types', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({})
        const client = yield* makeClient('health-worker')

        const healthStatuses = yield* client.GetSourceHealth({})

        return healthStatuses
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const healthStatuses = await Effect.runPromise(program)

      const sources = healthStatuses.map((s: any) => s.source)
      expect(sources).toContain('osm')
      expect(sources).toContain('opensky')
      expect(sources).toContain('track')
      expect(sources).toContain('feature')
    })

    it('returns source availability status', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({})
        const client = yield* makeClient('health-worker')

        const healthStatuses = yield* client.GetSourceHealth({})

        return healthStatuses
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const healthStatuses = await Effect.runPromise(program)

      for (const status of healthStatuses) {
        expect(status).toHaveProperty('source')
        expect(status).toHaveProperty('available')
        expect(typeof (status as any).available).toBe('boolean')
      }
    })

    it('includes lastChecked timestamp', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({})
        const client = yield* makeClient('health-worker')

        const healthStatuses = yield* client.GetSourceHealth({})

        return healthStatuses
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const healthStatuses = await Effect.runPromise(program)

      for (const status of healthStatuses) {
        expect(status).toHaveProperty('lastChecked')
        expect((status as any).lastChecked).toBeInstanceOf(Date)
      }
    })
  })

  describe('optional service detection', () => {
    it('marks optional services as unavailable when not configured', async () => {
      const program = Effect.gen(function* () {
        // Default mock setup doesn't provide planet/sentinel/weather
        const makeClient = yield* createSearchTestClient({})
        const client = yield* makeClient('health-worker')

        const healthStatuses = yield* client.GetSourceHealth({})

        return healthStatuses
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const healthStatuses = await Effect.runPromise(program)

      // Check planet, sentinel, weather are marked unavailable
      const planetStatus = healthStatuses.find((s: any) => s.source === 'planet')
      const sentinelStatus = healthStatuses.find((s: any) => s.source === 'sentinel')
      const weatherStatus = healthStatuses.find((s: any) => s.source === 'openmeteo')

      if (planetStatus) expect((planetStatus as any).available).toBe(false)
      if (sentinelStatus) expect((sentinelStatus as any).available).toBe(false)
      if (weatherStatus) expect((weatherStatus as any).available).toBe(false)
    })
  })
})

describe('PingSource Handler', () => {
  describe('successful pings', () => {
    it('pings OpenSky successfully', async () => {
      const mockOpenSky = createMockOpenSkyResponse(1)

      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          opensky: { response: mockOpenSky },
        })
        const client = yield* makeClient('health-worker')

        const result = yield* client.PingSource({ source: 'opensky' })

        return result
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const result = await Effect.runPromise(program)

      expect(result.source).toBe('opensky')
      expect(result.available).toBe(true)
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('pings Overpass successfully', async () => {
      const mockOverpass = createMockOverpassResponse(1)

      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          overpass: { response: mockOverpass },
        })
        const client = yield* makeClient('health-worker')

        const result = yield* client.PingSource({ source: 'osm' })

        return result
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const result = await Effect.runPromise(program)

      expect(result.source).toBe('osm')
      expect(result.available).toBe(true)
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('returns latency measurement', async () => {
      const mockOpenSky = createMockOpenSkyResponse(1)

      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          opensky: { response: mockOpenSky },
        })
        const client = yield* makeClient('health-worker')

        const result = yield* client.PingSource({ source: 'opensky' })

        return result
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const result = await Effect.runPromise(program)

      expect(typeof result.latencyMs).toBe('number')
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('failed pings', () => {
    it('handles OpenSky failure gracefully', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          opensky: {
            shouldFail: true,
            error: new ExternalApiError({
              source: 'opensky',
              statusCode: 500,
              message: 'Service unavailable',
              retryable: true,
            }),
          },
        })
        const client = yield* makeClient('health-worker')

        const result = yield* client.PingSource({ source: 'opensky' })

        return result
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const result = await Effect.runPromise(program)

      expect(result.source).toBe('opensky')
      expect(result.available).toBe(false)
      expect(result.lastError).toBeDefined()
    })

    it('handles Overpass failure gracefully', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          overpass: {
            shouldFail: true,
            error: new ExternalApiError({
              source: 'overpass',
              statusCode: 503,
              message: 'Service unavailable',
              retryable: true,
            }),
          },
        })
        const client = yield* makeClient('health-worker')

        const result = yield* client.PingSource({ source: 'osm' })

        return result
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const result = await Effect.runPromise(program)

      expect(result.source).toBe('osm')
      expect(result.available).toBe(false)
      expect(result.lastError).toBeDefined()
    })

    it('handles rate limit error', async () => {
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
        const client = yield* makeClient('health-worker')

        const result = yield* client.PingSource({ source: 'opensky' })

        return result
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const result = await Effect.runPromise(program)

      expect(result.available).toBe(false)
      expect(result.lastError).toBeDefined()
    })
  })

  describe('response structure', () => {
    it('returns SourceHealthStatus structure', async () => {
      const mockOpenSky = createMockOpenSkyResponse(1)

      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({
          opensky: { response: mockOpenSky },
        })
        const client = yield* makeClient('health-worker')

        const result = yield* client.PingSource({ source: 'opensky' })

        return result
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const result = await Effect.runPromise(program)

      expect(result).toHaveProperty('source')
      expect(result).toHaveProperty('available')
      expect(result).toHaveProperty('latencyMs')
      expect(result).toHaveProperty('lastChecked')
    })
  })
})

describe('CancelSearch Handler', () => {
  describe('cancellation requests', () => {
    it('accepts cancel request with searchId', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({})
        const client = yield* makeClient('control-worker')

        // CancelSearch should not throw
        const result = yield* client.CancelSearch({
          searchId: testSearchId(),
        })

        return result
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const result = await Effect.runPromise(program)

      // Handler currently logs and returns void
      expect(result).toBeUndefined()
    })

    it('accepts cancel request with reason', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({})
        const client = yield* makeClient('control-worker')

        const result = yield* client.CancelSearch({
          searchId: testSearchId(),
          reason: 'User cancelled',
        })

        return result
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const result = await Effect.runPromise(program)

      expect(result).toBeUndefined()
    })

    it('handles cancel for non-existent search', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createSearchTestClient({})
        const client = yield* makeClient('control-worker')

        // Should not throw even if search doesn't exist
        const result = yield* client.CancelSearch({
          searchId: 'non-existent-search-id' as any,
        })

        return result
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const result = await Effect.runPromise(program)

      expect(result).toBeUndefined()
    })
  })
})
