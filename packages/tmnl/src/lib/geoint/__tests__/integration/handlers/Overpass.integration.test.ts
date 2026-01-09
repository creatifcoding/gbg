/**
 * Overpass API Integration Tests
 *
 * Tests real Overpass (OpenStreetMap) API calls through SearchEntity handler.
 * Run with: RUN_INTEGRATION_TESTS=1 bun test Overpass.integration
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { SearchEntity } from '../../../cluster/SearchEntity'
import {
  RUN_INTEGRATION_TESTS,
  SF_BOUNDS,
  FISHERMANS_WHARF,
  testSearchId,
  TestShardingConfig,
  RealHandlersLayer,
  LONG_TIMEOUT,
} from './helpers'

describe.skipIf(!RUN_INTEGRATION_TESTS)('Overpass Integration Tests', () => {

  describe('SearchOsm Handler', () => {
    it('fetches hospitals in San Francisco', { timeout: 90000 }, async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('overpass-integ-1')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: SF_BOUNDS,
          amenities: ['hospital'],
          limit: 50,
        })

        console.log(`Overpass hospitals: Got ${results.length} results`)
        return results
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(LONG_TIMEOUT)
      )

      const results = await Effect.runPromise(program)

      // SF should have hospitals
      expect(results.length).toBeGreaterThan(0)

      const first = results[0] as any
      expect(first.source).toBe('osm')
      expect(first._tag).toBe('SearchResultPoi')
      expect(first.name).toBeDefined()
      console.log(`  First: ${first.name}`)
    })

    it('fetches restaurants at Fishermans Wharf', { timeout: 90000 }, async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('overpass-integ-2')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: FISHERMANS_WHARF,
          amenities: ['restaurant', 'cafe'],
          limit: 30,
        })

        console.log(`Overpass restaurants: Got ${results.length} results`)
        return results
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(LONG_TIMEOUT)
      )

      const results = await Effect.runPromise(program)
      // API may rate-limit; verify structure if we got results
      expect(Array.isArray(results)).toBe(true)
      if (results.length > 0) {
        const first = results[0] as any
        expect(first.source).toBe('osm')
      }
    })

    it('handles multiple amenity types', { timeout: 90000 }, async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('overpass-integ-3')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: SF_BOUNDS,
          amenities: ['hospital', 'pharmacy', 'clinic'],
          limit: 50,
        })

        console.log(`Overpass healthcare: Got ${results.length} results`)
        return results
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(LONG_TIMEOUT)
      )

      const results = await Effect.runPromise(program)
      expect(Array.isArray(results)).toBe(true)
    })

    it('respects limit parameter', { timeout: 90000 }, async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('overpass-integ-4')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: SF_BOUNDS,
          amenities: ['restaurant'],
          limit: 5,
        })

        return results
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(LONG_TIMEOUT)
      )

      const results = await Effect.runPromise(program)
      expect(results.length).toBeLessThanOrEqual(5)
    })

    it('returns POI with position data', { timeout: 90000 }, async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('overpass-integ-5')

        const results = yield* client.SearchOsm({
          searchId: testSearchId(),
          bounds: SF_BOUNDS,
          amenities: ['hospital'],
          limit: 1,
        })

        return results
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(LONG_TIMEOUT)
      )

      const results = await Effect.runPromise(program)

      if (results.length > 0) {
        const poi = results[0] as any
        expect(poi.position).toBeDefined()
        expect(Array.isArray(poi.position)).toBe(true)
        expect(poi.position.length).toBe(2)
        // Position should be within SF bounds
        const [lon, lat] = poi.position
        expect(lon).toBeGreaterThan(-123)
        expect(lon).toBeLessThan(-122)
        expect(lat).toBeGreaterThan(37)
        expect(lat).toBeLessThan(38)
      }
    })
  })

  describe('PingSource Handler', () => {
    it('pings Overpass API and returns latency', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('overpass-ping-1')

        const result = yield* client.PingSource({ source: 'osm' })

        console.log(`Overpass ping: ${result.available ? '✓' : '✗'} (${result.latencyMs}ms)`)
        return result
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(LONG_TIMEOUT)
      )

      const result = await Effect.runPromise(program)
      expect(result.source).toBe('osm')
      expect(typeof result.available).toBe('boolean')
      expect(typeof result.latencyMs).toBe('number')
    })
  })
})
