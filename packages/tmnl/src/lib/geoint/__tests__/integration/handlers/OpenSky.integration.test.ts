/**
 * OpenSky API Integration Tests
 *
 * Tests real OpenSky Network API calls through the SearchEntity handler.
 * Run with: RUN_INTEGRATION_TESTS=1 bun test OpenSky.integration
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { SearchEntity } from '../../../cluster/SearchEntity'
import {
  RUN_INTEGRATION_TESTS,
  SF_BOUNDS,
  testSearchId,
  TestShardingConfig,
  RealHandlersLayer,
  TIMEOUT,
} from './helpers'

describe.skipIf(!RUN_INTEGRATION_TESTS)('OpenSky Integration Tests', () => {

  describe('SearchFlights Handler', () => {
    it('fetches real flight data for San Francisco area', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('opensky-integ-1')

        const results = yield* client.SearchFlights({
          searchId: testSearchId(),
          bounds: SF_BOUNDS,
          limit: 50,
        })

        console.log(`OpenSky: Got ${results.length} flights`)
        return results
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(TIMEOUT)
      )

      const results = await Effect.runPromise(program)
      expect(Array.isArray(results)).toBe(true)

      if (results.length > 0) {
        const first = results[0] as any
        expect(first.source).toBe('opensky')
        expect(first._tag).toBe('SearchResultFlight')
        expect(first.icao24).toBeDefined()
        console.log(`  First: ${first.callsign?.trim() || first.icao24}`)
      }
    })

    it('handles ICAO24 filter parameter', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('opensky-integ-2')

        const results = yield* client.SearchFlights({
          searchId: testSearchId(),
          icao24: ['a00001', 'a00002'],
          limit: 10,
        })

        console.log(`OpenSky ICAO filter: Got ${results.length} matches`)
        return results
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(TIMEOUT)
      )

      const results = await Effect.runPromise(program)
      expect(Array.isArray(results)).toBe(true)
    })

    it('returns empty array for empty bounds', async () => {
      // Very small ocean area with no flights
      const oceanBounds = [-140.0, 25.0, -139.9, 25.1] as const

      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('opensky-integ-3')

        const results = yield* client.SearchFlights({
          searchId: testSearchId(),
          bounds: oceanBounds,
          limit: 10,
        })

        return results
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(TIMEOUT)
      )

      const results = await Effect.runPromise(program)
      expect(Array.isArray(results)).toBe(true)
      // Likely empty but not guaranteed
    })

    it('respects limit parameter', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('opensky-integ-4')

        const results = yield* client.SearchFlights({
          searchId: testSearchId(),
          bounds: SF_BOUNDS,
          limit: 5,
        })

        return results
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(TIMEOUT)
      )

      const results = await Effect.runPromise(program)
      expect(results.length).toBeLessThanOrEqual(5)
    })
  })

  describe('PingSource Handler', () => {
    it('pings OpenSky API and returns latency', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('opensky-ping-1')

        const result = yield* client.PingSource({ source: 'opensky' })

        console.log(`OpenSky ping: ${result.available ? '✓' : '✗'} (${result.latencyMs}ms)`)
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
  })
})
