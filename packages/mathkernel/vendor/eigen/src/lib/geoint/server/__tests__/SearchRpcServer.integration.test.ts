/**
 * SearchRpcServer Integration Tests
 *
 * Tests RPC handlers with REAL external APIs (no mocks).
 * Uses @effect/rpc RpcTest.makeClient for in-memory handler testing.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 bunx vitest run src/lib/geoint/server/__tests__/
 *
 * @see tmnl-1ergy - search/searchNearby/searchInBounds handlers
 * @see tmnl-muqzi - queryOpenSky/queryOverpass handlers
 * @see tmnl-u9u0i - streamSearch handler
 * @see tmnl-wn7td - saved search CRUD handlers
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Effect, Layer, Duration, Stream, Chunk, pipe } from 'effect'
import * as RpcTest from '@effect/rpc/RpcTest'
import { FetchHttpClient } from '@effect/platform'
import { SearchRpcs } from '../../clients/SearchClient'
import { SearchRpcHandlersLayer } from '../SearchRpcServer'
import { ExternalApiClientsLive } from '../../api/ExternalApiClient'
import {
  SearchQuery,
  SearchId,
  GeoFilterBounds,
  type BBox,
} from '../../schemas'

// =============================================================================
// Test Configuration
// =============================================================================

const RUN_INTEGRATION_TESTS = process.env['RUN_INTEGRATION_TESTS'] === '1'
const TEST_TIMEOUT = 120000 // 2 minutes for real API calls

// Test bounds - San Francisco Bay Area
const SF_BOUNDS: BBox = [-122.5, 37.5, -122.0, 38.0]
const SF_CENTER: readonly [number, number] = [-122.4194, 37.7749]
const FISHERMANS_WHARF: BBox = [-122.42, 37.805, -122.40, 37.815]

// Generate unique search ID
const testSearchId = () =>
  `rpc-integ-${Date.now()}-${Math.random().toString(36).slice(2)}` as SearchId

// =============================================================================
// Test Layer - Real APIs, No Mocks
// =============================================================================

/**
 * Complete layer with real external API clients.
 * Uses FetchHttpClient for actual network requests.
 */
const TestLayer = pipe(
  SearchRpcHandlersLayer,
  Layer.provideMerge(ExternalApiClientsLive),
  Layer.provide(FetchHttpClient.layer)
)

// =============================================================================
// Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION_TESTS)('SearchRpcServer Integration Tests', () => {
  beforeAll(() => {
    console.log('Running SearchRpcServer integration tests with REAL APIs')
  })

  // ===========================================================================
  // Core Search Handlers (tmnl-1ergy)
  // ===========================================================================

  describe('Core Search Handlers', () => {
    it('search: executes multi-source search with real OpenSky and Overpass', async () => {
      const program = Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SearchRpcs)

        const query = new SearchQuery({
          id: testSearchId(),
          sources: ['opensky', 'osm'],
          geoFilter: new GeoFilterBounds({ bounds: SF_BOUNDS }),
          limitPerSource: 25,
        })

        const response = yield* client.search(query)

        console.log(`Search results: ${response.totalCount} total`)
        console.log(`Source counts:`, response.sourceCounts)
        console.log(`Execution time: ${response.executionTimeMs}ms`)

        expect(response.queryId).toBe(query.id)
        expect(response.totalCount).toBeGreaterThanOrEqual(0)
        expect(response.results).toBeInstanceOf(Array)
        expect(response.sourceCounts).toBeDefined()
        expect(response.executionTimeMs).toBeGreaterThan(0)

        // Verify we got results from at least one source
        const hasOpenSky = (response.sourceCounts['opensky'] ?? 0) > 0
        const hasOsm = (response.sourceCounts['osm'] ?? 0) > 0
        console.log(`OpenSky: ${hasOpenSky}, OSM: ${hasOsm}`)

        // At least one source should return data (APIs may be flaky)
        expect(hasOpenSky || hasOsm).toBe(true)

        return response
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
        Effect.timeout(Duration.seconds(90))
      )

      await Effect.runPromise(program)
    }, TEST_TIMEOUT)

    it('searchNearby: finds POIs near SF center with radius', async () => {
      const program = Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SearchRpcs)

        const response = yield* client.searchNearby({
          center: SF_CENTER as [number, number],
          radiusMeters: 2000, // 2km
          sources: ['osm'],
          limit: 20,
        })

        console.log(`SearchNearby: ${response.totalCount} POIs within 2km of SF center`)

        expect(response.queryId).toBeDefined()
        expect(response.results).toBeInstanceOf(Array)

        return response
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
        Effect.timeout(Duration.seconds(60))
      )

      await Effect.runPromise(program)
    }, TEST_TIMEOUT)

    it('searchInBounds: finds flights and POIs in Fishermans Wharf', async () => {
      const program = Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SearchRpcs)

        const response = yield* client.searchInBounds({
          bounds: FISHERMANS_WHARF,
          sources: ['opensky', 'osm'],
          limit: 15,
        })

        console.log(`SearchInBounds: ${response.totalCount} results in Fishermans Wharf`)

        expect(response.queryId).toBeDefined()
        expect(response.results).toBeInstanceOf(Array)
        expect(response.sourceCounts).toBeDefined()

        return response
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
        Effect.timeout(Duration.seconds(60))
      )

      await Effect.runPromise(program)
    }, TEST_TIMEOUT)
  })

  // ===========================================================================
  // API Proxy Handlers (tmnl-muqzi)
  // ===========================================================================

  describe('API Proxy Handlers', () => {
    it('queryOpenSky: fetches live flight data from OpenSky Network', async () => {
      const program = Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SearchRpcs)

        const response = yield* client.queryOpenSky({
          bounds: SF_BOUNDS,
        })

        console.log(`OpenSky direct: ${response.states?.length ?? 0} aircraft`)

        expect(response.time).toBeGreaterThan(0)
        // States may be empty if no flights in area
        if (response.states && response.states.length > 0) {
          const firstFlight = response.states[0]
          expect(firstFlight.icao24).toBeDefined()
          expect(firstFlight.latitude).toBeDefined()
          expect(firstFlight.longitude).toBeDefined()
        }

        return response
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
        Effect.timeout(Duration.seconds(45))
      )

      await Effect.runPromise(program)
    }, TEST_TIMEOUT)

    it('queryOverpass: fetches restaurants from Overpass API', async () => {
      const program = Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SearchRpcs)

        // Use small bounds to avoid timeout
        const smallBounds: BBox = [-122.42, 37.78, -122.40, 37.80]

        // Build query using the helper
        const query = yield* client.buildOverpassQuery({
          bounds: smallBounds,
          amenities: ['restaurant'],
        })

        const response = yield* client.queryOverpass({ query })

        console.log(`Overpass direct: ${response.elements.length} restaurants`)

        expect(response.version).toBeDefined()
        expect(response.elements).toBeInstanceOf(Array)

        if (response.elements.length > 0) {
          const first = response.elements[0]
          expect(first.type).toBeDefined()
          expect(first.id).toBeDefined()
        }

        return response
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
        Effect.timeout(Duration.seconds(60))
      )

      await Effect.runPromise(program)
    }, TEST_TIMEOUT)

    it('buildOverpassQuery: generates valid QL query', async () => {
      const program = Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SearchRpcs)

        const query = yield* client.buildOverpassQuery({
          bounds: SF_BOUNDS,
          amenities: ['hospital', 'police'],
        })

        console.log(`Generated query length: ${query.length} chars`)

        expect(query).toContain('[out:json]')
        expect(query).toContain('amenity')
        expect(query.length).toBeGreaterThan(50)

        return query
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
        Effect.timeout(Duration.seconds(10))
      )

      await Effect.runPromise(program)
    }, TEST_TIMEOUT)
  })

  // ===========================================================================
  // Streaming Handler (tmnl-u9u0i)
  // ===========================================================================

  describe('Streaming Handler', () => {
    it('streamSearch: streams partial results from multiple sources', async () => {
      const program = Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SearchRpcs)

        const query = new SearchQuery({
          id: testSearchId(),
          sources: ['opensky', 'osm'],
          geoFilter: new GeoFilterBounds({ bounds: SF_BOUNDS }),
          limitPerSource: 10,
        })

        const events: string[] = []

        // Consume stream and collect event types
        const stream = client.streamSearch(query)
        const chunks = yield* Stream.runCollect(stream)
        const results = Chunk.toArray(chunks)

        for (const event of results) {
          events.push(event._tag)
          console.log(`Stream event: ${event._tag}`)
        }

        // Verify stream lifecycle
        expect(events).toContain('SearchStarted')
        expect(events).toContain('SearchCompleted')

        console.log(`Stream events: ${events.join(' → ')}`)

        return results
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
        Effect.timeout(Duration.seconds(90))
      )

      await Effect.runPromise(program)
    }, TEST_TIMEOUT)
  })

  // ===========================================================================
  // Saved Search CRUD Handlers (tmnl-wn7td)
  // ===========================================================================

  describe('Saved Search CRUD Handlers', () => {
    it('saveSearch → listSavedSearches → executeSavedSearch → deleteSavedSearch', async () => {
      const program = Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SearchRpcs)

        const query = new SearchQuery({
          id: testSearchId(),
          sources: ['osm'],
          geoFilter: new GeoFilterBounds({ bounds: FISHERMANS_WHARF }),
          limitPerSource: 5,
        })

        // 1. Save search (id is auto-generated server-side)
        const saved = yield* client.saveSearch({
          name: 'Integration Test Search',
          query,
        })

        expect(saved.id).toBeDefined()
        expect(saved.name).toBe('Integration Test Search')
        console.log(`Saved search: ${saved.id}`)

        // 2. List saved searches
        const list = yield* client.listSavedSearches({})
        expect(list.length).toBeGreaterThan(0)
        expect(list.some((s) => s.id === saved.id)).toBe(true)
        console.log(`Listed ${list.length} saved searches`)

        // 3. Execute saved search
        const executed = yield* client.executeSavedSearch({ id: saved.id })
        // queryId is from the SearchQuery, not the saved search ID
        expect(executed.queryId).toBe(query.id)
        expect(executed.results).toBeInstanceOf(Array)
        console.log(`Executed saved search: ${executed.totalCount} results`)

        // 4. Delete saved search
        const deleted = yield* client.deleteSavedSearch({ id: saved.id })
        expect(deleted).toBe(true)
        console.log(`Deleted saved search: ${saved.id}`)

        // 5. Verify deletion
        const listAfter = yield* client.listSavedSearches({})
        expect(listAfter.some((s) => s.id === saved.id)).toBe(false)

        return { saved, executed, deleted }
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
        Effect.timeout(Duration.seconds(90))
      )

      await Effect.runPromise(program)
    }, TEST_TIMEOUT)

    it('getSearchHistory: returns search history entries', async () => {
      const program = Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SearchRpcs)

        // Execute a search to populate history
        const query = new SearchQuery({
          id: testSearchId(),
          sources: ['osm'],
          geoFilter: new GeoFilterBounds({ bounds: SF_BOUNDS }),
          limitPerSource: 5,
        })
        yield* client.search(query)

        // Get history
        const history = yield* client.getSearchHistory({ limit: 10 })

        expect(history).toBeInstanceOf(Array)
        console.log(`Search history: ${history.length} entries`)

        return history
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
        Effect.timeout(Duration.seconds(60))
      )

      await Effect.runPromise(program)
    }, TEST_TIMEOUT)
  })

  // ===========================================================================
  // Aggregation Handler
  // ===========================================================================

  describe('Aggregation Handler', () => {
    it('aggregateResults: returns grid cells with counts', async () => {
      const program = Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(SearchRpcs)

        const query = new SearchQuery({
          id: testSearchId(),
          sources: ['osm'],
          geoFilter: new GeoFilterBounds({ bounds: FISHERMANS_WHARF }),
          limitPerSource: 50,
        })

        const result = yield* client.aggregateResults({
          query,
          cellSize: 500, // 500m cells
          aggregationType: 'count',
        })

        expect(result.cells).toBeInstanceOf(Array)
        expect(result.totalCount).toBeGreaterThanOrEqual(0)
        console.log(`Aggregation: ${result.cells.length} cells, ${result.totalCount} total`)

        if (result.cells.length > 0) {
          const firstCell = result.cells[0]
          expect(firstCell.bounds).toHaveLength(4)
          expect(typeof firstCell.count).toBe('number')
        }

        return result
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
        Effect.timeout(Duration.seconds(30))
      )

      await Effect.runPromise(program)
    }, TEST_TIMEOUT)
  })
})
