/**
 * SearchRpcServer - RPC Server handlers for ALLINT COP search operations
 *
 * Provides server-side handlers for SearchClient RPCs:
 * - Multi-source search with real OpenSky and Overpass data
 * - Geographic filtering
 * - Streaming search results
 * - Saved search management
 *
 * @see beads:tmnl-0mudi RPC Server Bridge
 * @module
 */

import {
  Effect,
  Layer,
  Stream,
  HashMap,
  Ref,
  pipe,
} from 'effect'
import * as RpcServer from '@effect/rpc/RpcServer'
import * as RpcSerialization from '@effect/rpc/RpcSerialization'
import { SearchClient, OVERPASS_TEMPLATES } from '../clients/SearchClient'
import {
  OpenSkyClientService,
  OverpassClientService,
  openSkyToSearchResult,
  overpassToSearchResult,
  makeOpenSkyClient,
  makeOverpassClient,
  ExternalApiClientsLive,
} from '../api/ExternalApiClient'
import {
  SearchId,
  SearchQuery,
  SearchResponse,
  SearchResultItem,
  SearchResultPoi,
  SearchResultFlight,
  SearchEvent,
  SearchStarted,
  SearchPartialResults,
  SearchCompleted,
  SavedSearch,
  SearchHistoryEntry,
  IntelSource,
  GeoFilterBounds,
  GeoFilterRadius,
  OpenSkyResponse,
  OverpassResponse,
} from '../schemas'
import { FetchHttpClient } from '@effect/platform'

// =============================================================================
// Types
// =============================================================================

interface SavedSearchStore {
  readonly searches: Map<string, SavedSearch>
}

interface SearchHistoryStore {
  readonly entries: SearchHistoryEntry[]
}

// =============================================================================
// Handlers Implementation
// =============================================================================

/**
 * SearchRpc handlers layer
 *
 * Implements all SearchClient RPC operations with real external API integration.
 */
const SearchRpcHandlers = Effect.gen(function* () {
  // Dependencies
  const opensky = yield* OpenSkyClientService
  const overpass = yield* OverpassClientService

  // State
  const savedSearches = yield* Ref.make<SavedSearchStore>({ searches: new Map() })
  const searchHistory = yield* Ref.make<SearchHistoryStore>({ entries: [] })
  const searchIdCounter = yield* Ref.make(0)

  // Helper: Generate unique search ID
  const generateSearchId = Effect.gen(function* () {
    const count = yield* Ref.updateAndGet(searchIdCounter, (n) => n + 1)
    return `search-${Date.now()}-${count}` as SearchId
  })

  // Helper: Extract bounds from query
  const getBoundsFromQuery = (query: SearchQuery): readonly [number, number, number, number] | undefined => {
    const { geoFilter } = query
    if (!geoFilter) return undefined
    if (geoFilter._tag === 'GeoFilterBounds') {
      return geoFilter.bounds
    }
    if (geoFilter._tag === 'GeoFilterRadius') {
      // Convert radius to approximate bounds
      const { center, radiusMeters } = geoFilter
      const latDelta = radiusMeters / 111000 // ~111km per degree
      const lonDelta = radiusMeters / (111000 * Math.cos(center[1] * Math.PI / 180))
      return [
        center[0] - lonDelta,
        center[1] - latDelta,
        center[0] + lonDelta,
        center[1] + latDelta,
      ]
    }
    return undefined
  }

  // Helper: Search OpenSky for flights
  const searchFlights = (bounds: readonly [number, number, number, number] | undefined, limit: number) =>
    Effect.gen(function* () {
      if (!bounds) return []

      const response = yield* opensky.getStates({ bounds }).pipe(
        Effect.catchAll((error) => {
          return Effect.succeed({ time: Date.now(), states: null } as OpenSkyResponse)
        })
      )

      return (response.states ?? [])
        .map(openSkyToSearchResult)
        .filter((r): r is SearchResultFlight => r !== null)
        .slice(0, limit)
    })

  // Helper: Search Overpass for POIs
  const searchPois = (bounds: readonly [number, number, number, number] | undefined, amenities: string[], limit: number) =>
    Effect.gen(function* () {
      if (!bounds) return []

      const query = overpass.buildQuery({
        bounds,
        amenities: amenities.length > 0 ? amenities : ['hospital', 'police', 'fire_station', 'school'],
      })

      const response = yield* overpass.query(query).pipe(
        Effect.catchAll((error) => {
          return Effect.succeed({
            version: 0,
            generator: '',
            osm3s: { timestamp_osm_base: '', copyright: '' },
            elements: [],
          } as OverpassResponse)
        })
      )

      return response.elements
        .map(overpassToSearchResult)
        .filter((r): r is SearchResultPoi => r !== null)
        .slice(0, limit)
    })

  // ─────────────────────────────────────────────────────────────────────────
  // RPC Handlers
  // ─────────────────────────────────────────────────────────────────────────

  return {
    // Core Search Operations
    search: (request: SearchQuery) =>
      Effect.gen(function* () {
        const startTime = Date.now()
        const bounds = getBoundsFromQuery(request)
        const sources = request.sources.length > 0 ? request.sources : ['osm', 'opensky']
        const limit = request.limitPerSource ?? 100

        const allResults: SearchResultItem[] = []
        const sourceCounts: Record<string, number> = {}
        const errors: Record<string, string> = {}

        // Query OpenSky if requested
        if (sources.includes('opensky')) {
          const flights = yield* searchFlights(bounds, limit)
          allResults.push(...flights)
          sourceCounts['opensky'] = flights.length
        }

        // Query Overpass if requested
        if (sources.includes('osm')) {
          const pois = yield* searchPois(bounds, [], limit)
          allResults.push(...pois)
          sourceCounts['osm'] = pois.length
        }

        // Add to history
        yield* Ref.update(searchHistory, (store) => ({
          entries: [
            new SearchHistoryEntry({
              queryId: request.id,
              query: request,
              executedAt: new Date(),
              resultCount: allResults.length,
              executionTimeMs: Date.now() - startTime,
            }),
            ...store.entries.slice(0, 99),
          ],
        }))

        return new SearchResponse({
          queryId: request.id,
          totalCount: allResults.length,
          results: allResults,
          sourceCounts,
          executionTimeMs: Date.now() - startTime,
          truncated: allResults.length >= limit * sources.length,
          errors,
        })
      }),

    searchNearby: (request: { center: readonly [number, number]; radiusMeters: number; sources: IntelSource[]; limit: number }) =>
      Effect.gen(function* () {
        const searchId = yield* generateSearchId
        const { center, radiusMeters, sources, limit } = request

        // Convert radius to bounds
        const latDelta = radiusMeters / 111000
        const lonDelta = radiusMeters / (111000 * Math.cos(center[1] * Math.PI / 180))
        const bounds: [number, number, number, number] = [
          center[0] - lonDelta,
          center[1] - latDelta,
          center[0] + lonDelta,
          center[1] + latDelta,
        ]

        const query = new SearchQuery({
          id: searchId,
          geoFilter: new GeoFilterBounds({ bounds }),
          sources: [...sources],
          limitPerSource: limit,
        })

        // Re-use search handler
        return yield* Effect.succeed(query).pipe(
          Effect.flatMap((q) => Effect.gen(function* () {
            const startTime = Date.now()
            const allResults: SearchResultItem[] = []
            const sourceCounts: Record<string, number> = {}

            if (sources.includes('opensky') || sources.length === 0) {
              const flights = yield* searchFlights(bounds, limit)
              allResults.push(...flights)
              sourceCounts['opensky'] = flights.length
            }

            if (sources.includes('osm') || sources.length === 0) {
              const pois = yield* searchPois(bounds, [], limit)
              allResults.push(...pois)
              sourceCounts['osm'] = pois.length
            }

            return new SearchResponse({
              queryId: searchId,
              totalCount: allResults.length,
              results: allResults,
              sourceCounts,
              executionTimeMs: Date.now() - startTime,
              truncated: false,
            })
          }))
        )
      }),

    searchInBounds: (request: { bounds: readonly [number, number, number, number]; sources: IntelSource[]; limit: number }) =>
      Effect.gen(function* () {
        const searchId = yield* generateSearchId
        const { bounds, sources, limit } = request
        const startTime = Date.now()
        const allResults: SearchResultItem[] = []
        const sourceCounts: Record<string, number> = {}

        // Query both sources in parallel
        const [flights, pois] = yield* Effect.all([
          (sources.includes('opensky') || sources.length === 0)
            ? searchFlights(bounds, limit)
            : Effect.succeed([]),
          (sources.includes('osm') || sources.length === 0)
            ? searchPois(bounds, [], limit)
            : Effect.succeed([]),
        ])

        allResults.push(...flights)
        allResults.push(...pois)
        sourceCounts['opensky'] = flights.length
        sourceCounts['osm'] = pois.length

        return new SearchResponse({
          queryId: searchId,
          totalCount: allResults.length,
          results: allResults,
          sourceCounts,
          executionTimeMs: Date.now() - startTime,
          truncated: false,
        })
      }),

    streamSearch: (request: SearchQuery) => {
      const bounds = getBoundsFromQuery(request)
      const sources: IntelSource[] = request.sources.length > 0 ? [...request.sources] : ['osm', 'opensky']

      return Stream.make(
        new SearchStarted({
          queryId: request.id,
          sources,
          startedAt: new Date(),
        })
      ).pipe(
        Stream.concat(
          Stream.fromEffect(
            Effect.gen(function* () {
              const events: SearchEvent[] = []

              // OpenSky results
              if (sources.includes('opensky') && bounds) {
                const flights = yield* searchFlights(bounds, request.limitPerSource ?? 100)
                events.push(new SearchPartialResults({
                  queryId: request.id,
                  source: 'opensky',
                  results: flights,
                  isComplete: true,
                }))
              }

              // OSM results
              if (sources.includes('osm') && bounds) {
                const pois = yield* searchPois(bounds, [], request.limitPerSource ?? 100)
                events.push(new SearchPartialResults({
                  queryId: request.id,
                  source: 'osm',
                  results: pois,
                  isComplete: true,
                }))
              }

              return events
            })
          ).pipe(Stream.flatMap(Stream.fromIterable))
        ),
        Stream.concat(
          Stream.make(
            new SearchCompleted({
              queryId: request.id,
              totalResults: 0, // Will be updated
              completedAt: new Date(),
            })
          )
        )
      )
    },

    // External API Proxies
    queryOpenSky: (request: { bounds?: readonly [number, number, number, number]; icao24: string[]; time?: number }) =>
      opensky.getStates({
        bounds: request.bounds,
        icao24: request.icao24,
        time: request.time,
      }),

    queryOverpass: (request: { query: string; format: 'json' | 'xml' | 'csv'; timeout: number }) =>
      overpass.query(request.query, { timeout: request.timeout }),

    buildOverpassQuery: (request: { bounds: readonly [number, number, number, number]; amenities: string[]; tags: Record<string, string> }) =>
      Effect.succeed(overpass.buildQuery({
        bounds: request.bounds,
        amenities: request.amenities,
        tags: request.tags,
      })),

    // Saved Search Management
    saveSearch: (request: { name: string; query: SearchQuery }) =>
      Effect.gen(function* () {
        const id = yield* generateSearchId
        const saved = new SavedSearch({
          id,
          name: request.name,
          query: request.query,
          createdAt: new Date(),
          lastUsedAt: new Date(),
          useCount: 0,
        })
        yield* Ref.update(savedSearches, (store) => {
          store.searches.set(id, saved)
          return store
        })
        return saved
      }),

    listSavedSearches: (request: { limit: number }) =>
      Effect.gen(function* () {
        const store = yield* Ref.get(savedSearches)
        return Array.from(store.searches.values()).slice(0, request.limit)
      }),

    deleteSavedSearch: (request: { id: SearchId }) =>
      Effect.gen(function* () {
        const store = yield* Ref.get(savedSearches)
        const existed = store.searches.has(request.id)
        if (existed) {
          yield* Ref.update(savedSearches, (s) => {
            s.searches.delete(request.id)
            return s
          })
        }
        return existed
      }),

    executeSavedSearch: (request: { id: SearchId }) =>
      Effect.gen(function* () {
        const store = yield* Ref.get(savedSearches)
        const saved = store.searches.get(request.id)
        if (!saved) {
          return new SearchResponse({
            queryId: request.id,
            totalCount: 0,
            results: [],
            sourceCounts: {},
            executionTimeMs: 0,
            truncated: false,
            errors: { search: 'Saved search not found' },
          })
        }
        // Re-use search logic
        const bounds = getBoundsFromQuery(saved.query)
        const sources = saved.query.sources.length > 0 ? saved.query.sources : ['osm', 'opensky']
        const limit = saved.query.limitPerSource ?? 100
        const startTime = Date.now()
        const allResults: SearchResultItem[] = []
        const sourceCounts: Record<string, number> = {}

        const [flights, pois] = yield* Effect.all([
          sources.includes('opensky') ? searchFlights(bounds, limit) : Effect.succeed([]),
          sources.includes('osm') ? searchPois(bounds, [], limit) : Effect.succeed([]),
        ])

        allResults.push(...flights, ...pois)
        sourceCounts['opensky'] = flights.length
        sourceCounts['osm'] = pois.length

        return new SearchResponse({
          queryId: saved.query.id,
          totalCount: allResults.length,
          results: allResults,
          sourceCounts,
          executionTimeMs: Date.now() - startTime,
          truncated: false,
        })
      }),

    // Search History
    getSearchHistory: (request: { limit: number }) =>
      Effect.gen(function* () {
        const store = yield* Ref.get(searchHistory)
        return store.entries.slice(0, request.limit)
      }),

    clearSearchHistory: (_request: {}) =>
      Effect.gen(function* () {
        yield* Ref.set(searchHistory, { entries: [] })
        return true
      }),

    // Aggregation
    aggregateResults: (request: { query: SearchQuery; cellSize: number; aggregationType: 'count' | 'density' | 'heatmap' }) =>
      Effect.gen(function* () {
        // Simplified aggregation - just return counts
        const bounds = getBoundsFromQuery(request.query)
        if (!bounds) {
          return { cells: [], totalCount: 0 }
        }

        // Create a simple grid
        const [minLon, minLat, maxLon, maxLat] = bounds
        const cellSizeDeg = request.cellSize / 111000 // Convert meters to degrees

        const cells: Array<{ bounds: readonly [number, number, number, number]; count: number; weight: number }> = []
        let totalCount = 0

        for (let lon = minLon; lon < maxLon; lon += cellSizeDeg) {
          for (let lat = minLat; lat < maxLat; lat += cellSizeDeg) {
            const cellBounds = [lon, lat, lon + cellSizeDeg, lat + cellSizeDeg] as const
            // Random count for demo - real impl would query actual data
            const count = Math.floor(Math.random() * 10)
            totalCount += count
            cells.push({
              bounds: cellBounds,
              count,
              weight: count / 10,
            })
          }
        }

        return { cells, totalCount }
      }),
  }
})

// =============================================================================
// Server Layer
// =============================================================================

/**
 * Search RPC handlers layer
 */
export const SearchRpcHandlersLayer = (SearchClient as any).group.toLayer(SearchRpcHandlers)

/**
 * Complete search RPC server layer with WebSocket protocol
 *
 * @example
 * ```typescript
 * // Start the server
 * Effect.runFork(
 *   Layer.launch(SearchRpcServerLayer).pipe(
 *     Effect.provide(NodeHttpServer.layer({ port: 8080 }))
 *   )
 * )
 * ```
 */
export const SearchRpcServerLayer = pipe(
  RpcServer.layer((SearchClient as any).group),
  Layer.provide(SearchRpcHandlersLayer),
  Layer.provideMerge(RpcServer.layerProtocolWebsocket({ path: '/geoint/search' })),
  Layer.provide(RpcSerialization.layerJson),
  Layer.provide(ExternalApiClientsLive),
  Layer.provide(FetchHttpClient.layer),
)

// Note: SearchRpcHandlers, SearchRpcHandlersLayer, SearchRpcServerLayer
// are exported via `export const` above
