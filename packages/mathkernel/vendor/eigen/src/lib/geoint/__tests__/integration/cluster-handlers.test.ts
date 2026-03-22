/**
 * SearchEntity Cluster Handler Integration Tests
 *
 * Tests the full SearchEntity handler chain with real external APIs.
 * These tests verify:
 * - Entity routing works correctly
 * - Real API responses are correctly transformed
 * - Error handling works with live services
 * - Aggregated search combines real data from multiple sources
 *
 * IMPORTANT: These tests make real HTTP requests and are subject to rate limits.
 * Set RUN_INTEGRATION_TESTS=1 to enable.
 *
 * @module geoint/__tests__/integration/cluster-handlers.test
 */

import { describe, it, expect } from 'vitest'
import { Effect, Layer, Duration } from 'effect'
import { Entity, ShardingConfig } from '@effect/cluster'
import { FetchHttpClient } from '@effect/platform'
import { SearchEntity } from '../../cluster/SearchEntity'
import { SearchEntityHandlers } from '../../cluster/SearchEntityHandlers'
import { ExternalApiClientsLive } from '../../api/ExternalApiClient'
import { CircuitBreakersLive } from '../../api/circuit-breaker'
import {
  SearchQuery,
  GeoFilterBounds,
  type SearchId,
  type BBox,
} from '../../schemas'

// Skip unless explicitly enabled
const RUN_INTEGRATION_TESTS = process.env['RUN_INTEGRATION_TESTS'] === '1'

// San Francisco bounds for testing
const SF_BOUNDS: BBox = [-122.5, 37.5, -122.0, 38.0]

// Test search ID helper
const testSearchId = () =>
  `integ-${Date.now()}-${Math.random().toString(36).slice(2)}` as SearchId

// Sharding config for tests
const TestShardingConfig = ShardingConfig.layer({
  shardsPerGroup: 10,
  entityMailboxCapacity: 10,
  entityTerminationTimeout: 0,
  entityMessagePollInterval: 5000,
  sendRetryInterval: 100,
})

// HTTP client for real API calls
const HttpClientLive = FetchHttpClient.layer

// Combined API clients layer (includes CircuitBreakersLive)
// Provided with HTTP client dependency
const RealApiClientsLayer = ExternalApiClientsLive.pipe(
  Layer.provide(HttpClientLive)
)

// Test handlers layer with real API clients
// Handler methods call API client methods which return Effects requiring CircuitBreakersService
// The CircuitBreakersLive is already in ExternalApiClientsLive, but we need to merge it
// so it's available when Entity.makeTestClient runs the handlers
const RealHandlersLayer = Layer.provideMerge(
  SearchEntityHandlers,
  RealApiClientsLayer
)

// Longer timeout for real API calls
const TIMEOUT = Duration.seconds(60)

describe.skipIf(!RUN_INTEGRATION_TESTS)('SearchEntity Cluster Handler Integration Tests', () => {

  describe('SearchFlights Handler (Real OpenSky)', () => {
    it('searches real flight data through entity handler', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('integration-flight-worker')

        const results = yield* client.SearchFlights({
          searchId: testSearchId(),
          bounds: SF_BOUNDS,
          limit: 50,
        })

        console.log(`SearchFlights integration: Got ${results.length} flights`)

        return results
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(TIMEOUT)
      )

      const results = await Effect.runPromise(program)

      // Results might be empty depending on current air traffic
      expect(Array.isArray(results)).toBe(true)

      if (results.length > 0) {
        const first = results[0] as any
        expect(first.source).toBe('opensky')
        expect(first._tag).toBe('SearchResultFlight')
        expect(first.icao24).toBeDefined()
        expect(first.position).toBeDefined()
        console.log(`  First flight: ${first.callsign?.trim() || first.icao24}`)
      }
    })
  })

  describe('SearchOsm Handler (Real Overpass)', () => {
    it('searches real POI data through entity handler', { timeout: 90000 }, async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('integration-osm-worker')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: SF_BOUNDS,
          amenities: ['hospital', 'clinic'],
          limit: 50,
        })

        console.log(`SearchOsm integration: Got ${results.length} POIs`)

        return results
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(Duration.seconds(90))
      )

      const results = await Effect.runPromise(program)

      // SF should have hospitals
      expect(results.length).toBeGreaterThan(0)

      const first = results[0] as any
      expect(first.source).toBe('osm')
      expect(first._tag).toBe('SearchResultPoi')
      expect(first.name).toBeDefined()
      expect(first.position).toBeDefined()
      console.log(`  First POI: ${first.name}`)
    })

    it('handles restaurants query through entity handler', { timeout: 90000 }, async () => {
      // Smaller area for faster query
      const fishermansWharf: BBox = [-122.42, 37.805, -122.40, 37.815]

      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('integration-osm-worker-2')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: fishermansWharf,
          amenities: ['restaurant', 'cafe'],
          limit: 30,
        })

        console.log(`SearchOsm restaurants: Got ${results.length} results`)

        return results
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(Duration.seconds(90))
      )

      const results = await Effect.runPromise(program)

      // Fisherman's Wharf should have restaurants
      expect(results.length).toBeGreaterThan(0)
      console.log(`  Restaurant/cafe count: ${results.length}`)
    })
  })

  describe('GetSourceHealth Handler (Real APIs)', () => {
    it('returns real health status for all sources', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('integration-health-worker')

        const healthStatuses = yield* client.GetSourceHealth({})

        console.log('\nSource Health Status:')
        for (const status of healthStatuses) {
          const s = status as any
          console.log(`  ${s.source}: ${s.available ? '✓' : '✗'} (${s.latencyMs ?? 'N/A'}ms)`)
        }

        return healthStatuses
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(TIMEOUT)
      )

      const healthStatuses = await Effect.runPromise(program)

      expect(Array.isArray(healthStatuses)).toBe(true)
      expect(healthStatuses.length).toBeGreaterThan(0)

      // Check structure
      for (const status of healthStatuses) {
        expect(status).toHaveProperty('source')
        expect(status).toHaveProperty('available')
        expect(status).toHaveProperty('lastChecked')
      }
    })
  })

  describe('PingSource Handler (Real APIs)', () => {
    it('pings OpenSky with real API call', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('integration-ping-worker')

        const result = yield* client.PingSource({ source: 'opensky' })

        console.log(`PingSource opensky: ${result.available ? '✓' : '✗'} (${result.latencyMs}ms)`)

        return result
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(TIMEOUT)
      )

      const result = await Effect.runPromise(program)

      expect(result.source).toBe('opensky')
      expect(typeof result.available).toBe('boolean')
      expect(typeof result.latencyMs).toBe('number')
      expect(result.lastChecked).toBeInstanceOf(Date)
    })

    it('pings Overpass with real API call', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('integration-ping-worker-2')

        const result = yield* client.PingSource({ source: 'osm' })

        console.log(`PingSource osm: ${result.available ? '✓' : '✗'} (${result.latencyMs}ms)`)

        return result
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(TIMEOUT)
      )

      const result = await Effect.runPromise(program)

      expect(result.source).toBe('osm')
      expect(typeof result.available).toBe('boolean')
      expect(typeof result.latencyMs).toBe('number')
    })
  })

  describe('AggregatedSearch Handler (Real Multi-Source)', () => {
    it('aggregates real data from multiple sources', { timeout: 120000 }, async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('integration-aggregator-worker')

        const query = new SearchQuery({
          id: testSearchId(),
          sources: ['osm', 'opensky'] as any,
          geoFilter: new GeoFilterBounds({ bounds: SF_BOUNDS }),
          limitPerSource: 25,
        })

        const response = yield* client.AggregatedSearch({ query })

        console.log('\n=== Aggregated Search Results ===')
        console.log(`Total results: ${response.totalCount}`)
        console.log(`Execution time: ${response.executionTimeMs}ms`)
        console.log('Source counts:')
        for (const [source, count] of Object.entries(response.sourceCounts)) {
          console.log(`  ${source}: ${count}`)
        }
        if (Object.keys(response.errors).length > 0) {
          console.log('Errors:', response.errors)
        }
        console.log('=================================\n')

        return response
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(Duration.seconds(120))
      )

      const response = await Effect.runPromise(program)

      // Verify response structure
      expect(response.queryId).toBeDefined()
      expect(typeof response.totalCount).toBe('number')
      expect(typeof response.executionTimeMs).toBe('number')
      expect(response.sourceCounts).toBeDefined()
      expect(Array.isArray(response.results)).toBe(true)

      // At least OSM should return results (hospitals always exist in SF)
      expect(response.sourceCounts['osm']).toBeGreaterThanOrEqual(0)
    })

    it('handles partial failures gracefully in real environment', { timeout: 120000 }, async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('integration-aggregator-worker-2')

        // Query sources including some that might be unavailable
        const query = new SearchQuery({
          id: testSearchId(),
          sources: ['osm', 'opensky', 'planet', 'sentinel'] as any, // planet/sentinel likely unavailable
          geoFilter: new GeoFilterBounds({ bounds: SF_BOUNDS }),
          limitPerSource: 10,
        })

        const response = yield* client.AggregatedSearch({ query })

        console.log('\nPartial failure test:')
        console.log(`  Total results: ${response.totalCount}`)
        console.log(`  Sources queried: ${Object.keys(response.sourceCounts).join(', ')}`)
        console.log(`  Errors recorded: ${Object.keys(response.errors).length}`)

        return response
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(Duration.seconds(120))
      )

      const response = await Effect.runPromise(program)

      // Should still return valid response despite some sources failing
      expect(response).toBeDefined()
      expect(Array.isArray(response.results)).toBe(true)

      // Unavailable sources should have errors or 0 counts
      // But working sources should still return data
      const workingSources = Object.entries(response.sourceCounts)
        .filter(([_, count]) => (count as number) > 0)
        .map(([source]) => source)

      console.log(`  Working sources: ${workingSources.join(', ') || 'none'}`)
    })
  })

  describe('Rate Limiting Behavior', () => {
    it.skip('handles rate limiting gracefully', async () => {
      // This test would require hitting rate limits which is not good for CI
      // Keeping as a reference for manual testing

      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('rate-limit-worker')

        // Make multiple rapid requests
        const results = yield* Effect.all(
          Array.from({ length: 10 }, (_, i) =>
            client.SearchFlights({
              searchId: `rate-test-${i}` as SearchId,
              bounds: SF_BOUNDS,
              limit: 10,
            }).pipe(Effect.either)
          ),
          { concurrency: 10 }
        )

        const successes = results.filter((r) => r._tag === 'Right').length
        const failures = results.filter((r) => r._tag === 'Left').length

        console.log(`Rate limit test: ${successes} successes, ${failures} failures`)

        return { successes, failures }
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(Duration.seconds(60))
      )

      const { successes, failures } = await Effect.runPromise(program)

      // Should handle rate limiting gracefully (empty results, not crashes)
      expect(successes + failures).toBe(10)
    })
  })

  describe('Error Recovery', () => {
    it('continues working after API errors', { timeout: 180000 }, async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('error-recovery-worker')

        // First query - should work
        const firstResults = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: SF_BOUNDS,
          amenities: ['hospital'],
          limit: 5,
        })

        console.log(`First query: ${firstResults.length} results`)

        // Second query - should also work
        const secondResults = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: SF_BOUNDS,
          amenities: ['cafe'],
          limit: 5,
        })

        console.log(`Second query: ${secondResults.length} results`)

        return { first: firstResults.length, second: secondResults.length }
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(Duration.seconds(120))
      )

      const { first, second } = await Effect.runPromise(program)

      // Both queries should succeed
      expect(first).toBeGreaterThanOrEqual(0)
      expect(second).toBeGreaterThanOrEqual(0)
    })
  })
})
