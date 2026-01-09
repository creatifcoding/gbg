/**
 * AggregatedSearch Integration Tests
 *
 * Tests multi-source aggregation with real API calls.
 * Run with: RUN_INTEGRATION_TESTS=1 bun test AggregatedSearch.integration
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { SearchEntity } from '../../../cluster/SearchEntity'
import { SearchQuery, GeoFilterBounds } from '../../../schemas'
import {
  RUN_INTEGRATION_TESTS,
  SF_BOUNDS,
  testSearchId,
  TestShardingConfig,
  RealHandlersLayer,
  VERY_LONG_TIMEOUT,
} from './helpers'

describe.skipIf(!RUN_INTEGRATION_TESTS)('AggregatedSearch Integration Tests', () => {

  describe('Multi-Source Aggregation', () => {
    it('aggregates data from OpenSky and OSM', { timeout: 120000 }, async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('aggregated-integ-1')

        const query = new SearchQuery({
          id: testSearchId(),
          sources: ['osm', 'opensky'] as any,
          geoFilter: new GeoFilterBounds({ bounds: SF_BOUNDS }),
          limitPerSource: 25,
        })

        const response = yield* client.AggregatedSearch({ query })

        console.log('\n=== Aggregated Search Results ===')
        console.log(`Total: ${response.totalCount}`)
        console.log(`Time: ${response.executionTimeMs}ms`)
        for (const [source, count] of Object.entries(response.sourceCounts)) {
          console.log(`  ${source}: ${count}`)
        }
        console.log('=================================\n')

        return response
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(VERY_LONG_TIMEOUT)
      )

      const response = await Effect.runPromise(program)

      expect(response.queryId).toBeDefined()
      expect(typeof response.totalCount).toBe('number')
      expect(typeof response.executionTimeMs).toBe('number')
      expect(response.sourceCounts).toBeDefined()
      expect(Array.isArray(response.results)).toBe(true)
    })

    it('returns source counts for each queried source', { timeout: 120000 }, async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('aggregated-integ-2')

        const query = new SearchQuery({
          id: testSearchId(),
          sources: ['osm', 'opensky'] as any,
          geoFilter: new GeoFilterBounds({ bounds: SF_BOUNDS }),
          limitPerSource: 10,
        })

        const response = yield* client.AggregatedSearch({ query })
        return response
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(VERY_LONG_TIMEOUT)
      )

      const response = await Effect.runPromise(program)

      expect(response.sourceCounts).toHaveProperty('osm')
      expect(response.sourceCounts).toHaveProperty('opensky')
      expect(typeof response.sourceCounts['osm']).toBe('number')
      expect(typeof response.sourceCounts['opensky']).toBe('number')
    })

    it('includes execution time in response', { timeout: 120000 }, async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('aggregated-integ-3')

        const query = new SearchQuery({
          id: testSearchId(),
          sources: ['osm'] as any,
          geoFilter: new GeoFilterBounds({ bounds: SF_BOUNDS }),
          limitPerSource: 5,
        })

        const response = yield* client.AggregatedSearch({ query })
        return response
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(VERY_LONG_TIMEOUT)
      )

      const response = await Effect.runPromise(program)

      expect(response.executionTimeMs).toBeDefined()
      expect(response.executionTimeMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Partial Failure Handling', () => {
    it('continues when optional sources are unavailable', { timeout: 120000 }, async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('aggregated-integ-4')

        // Include sources that are likely unavailable (planet, sentinel)
        const query = new SearchQuery({
          id: testSearchId(),
          sources: ['osm', 'opensky', 'planet', 'sentinel'] as any,
          geoFilter: new GeoFilterBounds({ bounds: SF_BOUNDS }),
          limitPerSource: 10,
        })

        const response = yield* client.AggregatedSearch({ query })

        console.log('\nPartial failure test:')
        console.log(`  Total results: ${response.totalCount}`)
        console.log(`  Errors: ${Object.keys(response.errors).length}`)

        return response
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(VERY_LONG_TIMEOUT)
      )

      const response = await Effect.runPromise(program)

      // Should still return valid response
      expect(response).toBeDefined()
      expect(Array.isArray(response.results)).toBe(true)
    })

    it('records errors for failed sources', { timeout: 120000 }, async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('aggregated-integ-5')

        const query = new SearchQuery({
          id: testSearchId(),
          sources: ['osm', 'planet'] as any, // planet likely unavailable
          geoFilter: new GeoFilterBounds({ bounds: SF_BOUNDS }),
          limitPerSource: 5,
        })

        const response = yield* client.AggregatedSearch({ query })
        return response
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(VERY_LONG_TIMEOUT)
      )

      const response = await Effect.runPromise(program)

      // Check that errors object exists
      expect(response.errors).toBeDefined()
      // planet should have an error
      if (response.sourceCounts['planet'] === 0) {
        console.log(`  Planet error: ${response.errors['planet'] ?? 'none recorded'}`)
      }
    })
  })

  describe('Limit Handling', () => {
    it('respects limitPerSource parameter', { timeout: 120000 }, async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('aggregated-integ-6')

        const query = new SearchQuery({
          id: testSearchId(),
          sources: ['osm', 'opensky'] as any,
          geoFilter: new GeoFilterBounds({ bounds: SF_BOUNDS }),
          limitPerSource: 3,
        })

        const response = yield* client.AggregatedSearch({ query })
        return response
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(VERY_LONG_TIMEOUT)
      )

      const response = await Effect.runPromise(program)

      // Each source should respect the limit
      expect(response.sourceCounts['osm']).toBeLessThanOrEqual(3)
      expect(response.sourceCounts['opensky']).toBeLessThanOrEqual(3)
    })
  })

  describe('Response Structure', () => {
    it('returns queryId matching input', { timeout: 120000 }, async () => {
      const queryId = testSearchId()

      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('aggregated-integ-7')

        const query = new SearchQuery({
          id: queryId,
          sources: ['osm'] as any,
          geoFilter: new GeoFilterBounds({ bounds: SF_BOUNDS }),
          limitPerSource: 3,
        })

        const response = yield* client.AggregatedSearch({ query })
        return { response, queryId }
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(VERY_LONG_TIMEOUT)
      )

      const { response, queryId: id } = await Effect.runPromise(program)
      expect(response.queryId).toBe(id)
    })

    it('returns truncated flag', { timeout: 120000 }, async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, RealHandlersLayer)
        const client = yield* makeClient('aggregated-integ-8')

        const query = new SearchQuery({
          id: testSearchId(),
          sources: ['osm'] as any,
          geoFilter: new GeoFilterBounds({ bounds: SF_BOUNDS }),
          limitPerSource: 5,
        })

        const response = yield* client.AggregatedSearch({ query })
        return response
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(VERY_LONG_TIMEOUT)
      )

      const response = await Effect.runPromise(program)
      expect(typeof response.truncated).toBe('boolean')
    })
  })
})
