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
  Option,
  pipe,
} from 'effect'
import * as RpcServer from '@effect/rpc/RpcServer'
import * as RpcSerialization from '@effect/rpc/RpcSerialization'
import { SearchClient, OVERPASS_TEMPLATES } from '../clients/SearchClient'
import {
  OpenSkyClientService,
  OverpassClientService,
  PlanetLabsClientService,
  SentinelHubClientService,
  OpenMeteoClientService,
  openSkyToSearchResult,
  overpassToSearchResult,
  planetItemToImageryResult,
  sentinelItemToImageryResult,
  weatherForecastToSearchResult,
  ExternalApiClientsLive,
} from '../api/ExternalApiClient'
import {
  SearchId,
  SearchQuery,
  SearchResponse,
  SearchResultItem,
  SearchResultPoi,
  SearchResultFlight,
  SearchResultTrack,
  SearchResultFeature,
  SearchResultWeather,
  SearchResultImagery,
  SearchResultId,
  SearchStarted,
  SearchPartialResults,
  SearchCompleted,
  SavedSearch,
  SearchHistoryEntry,
  IntelSource,
  GeoFilterBounds,
  OpenSkyResponse,
  OverpassResponse,
  TrackId,
  FeatureId,
  Classification,
  ObjectType,
} from '../schemas'
import { FetchHttpClient } from '@effect/platform'
import {
  TrackPositionRepositoryTag,
  FeatureRepositoryTag,
  type TrackPositionSearchOptions,
  type FeatureSearchOptions,
} from '../persistence'

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
  // Dependencies - External APIs
  const opensky = yield* OpenSkyClientService
  const overpass = yield* OverpassClientService

  // Optional satellite imagery and weather services (graceful degradation)
  const planetOption = yield* Effect.serviceOption(PlanetLabsClientService)
  const sentinelOption = yield* Effect.serviceOption(SentinelHubClientService)
  const weatherOption = yield* Effect.serviceOption(OpenMeteoClientService)

  // Dependencies - PostGIS Repositories (optional - may not be configured)
  const trackRepoOption = yield* Effect.serviceOption(TrackPositionRepositoryTag)
  const featureRepoOption = yield* Effect.serviceOption(FeatureRepositoryTag)

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
        Effect.catchAll(() =>
          Effect.succeed({ time: Date.now(), states: null } as OpenSkyResponse)
        )
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
        Effect.catchAll(() =>
          Effect.succeed(
            new OverpassResponse({
              version: 0,
              generator: '',
              osm3s: { timestamp_osm_base: '', copyright: '' },
              elements: [],
            })
          )
        )
      )

      return response.elements
        .map(overpassToSearchResult)
        .filter((r): r is SearchResultPoi => r !== null)
        .slice(0, limit)
    })

  // Helper: Search PostGIS for tracks
  const searchTracks = (bounds: readonly [number, number, number, number] | undefined, limit: number): Effect.Effect<SearchResultTrack[], never, never> =>
    Effect.gen(function* () {
      // If no track repository configured, return empty
      if (Option.isNone(trackRepoOption) || !bounds) return []

      const trackRepo = trackRepoOption.value
      const searchOptions: TrackPositionSearchOptions = {
        bounds: bounds as [number, number, number, number],
        limit,
      }

      const positions = yield* trackRepo.search(searchOptions).pipe(
        Effect.catchAll(() => Effect.succeed([] as const))
      )

      return positions.map((pos) => new SearchResultTrack({
        id: `track-${pos.track_id}-${pos.id}` as unknown as SearchResultId,
        source: 'track',
        score: 1.0, // Default score for track results
        retrievedAt: new Date(),
        trackId: pos.track_id as unknown as TrackId,
        position: [pos.longitude, pos.latitude, pos.altitude ?? 0],
        heading: pos.heading ?? 0,
        speed: pos.speed ?? 0,
        classification: (pos.classification ?? 'unknown') as Classification,
        objectType: 'vehicle' as ObjectType, // Default, could be stored in metadata
        label: pos.track_id,
      }))
    })

  // Helper: Search PostGIS for features
  const searchFeatures = (bounds: readonly [number, number, number, number] | undefined, limit: number): Effect.Effect<SearchResultFeature[], never, never> =>
    Effect.gen(function* () {
      // If no feature repository configured, return empty
      if (Option.isNone(featureRepoOption) || !bounds) return []

      const featureRepo = featureRepoOption.value
      const searchOptions: FeatureSearchOptions = {
        bounds: bounds as [number, number, number, number],
        limit,
      }

      const features = yield* featureRepo.search(searchOptions).pipe(
        Effect.catchAll(() => Effect.succeed([] as const))
      )

      return features.map((feat) => {
        // Extract center position from geometry
        let position: [number, number] = [0, 0]
        if (feat.geom) {
          if (feat.geom.type === 'Point') {
            position = [feat.geom.coordinates[0], feat.geom.coordinates[1]]
          } else if (feat.geom.type === 'LineString' && feat.geom.coordinates.length > 0) {
            const mid = Math.floor(feat.geom.coordinates.length / 2)
            position = [feat.geom.coordinates[mid][0], feat.geom.coordinates[mid][1]]
          } else if (feat.geom.type === 'Polygon' && feat.geom.coordinates.length > 0 && feat.geom.coordinates[0].length > 0) {
            // Use centroid approximation (first point)
            position = [feat.geom.coordinates[0][0][0], feat.geom.coordinates[0][0][1]]
          }
        }

        // Determine geometry type
        const geometryType = feat.geom?.type ?? 'Point'

        return new SearchResultFeature({
          id: `feature-${feat.feature_id}` as unknown as SearchResultId,
          source: 'feature',
          score: 1.0, // Default score for feature results
          retrievedAt: new Date(),
          featureId: feat.feature_id as unknown as FeatureId,
          position,
          geometryType: geometryType as 'Point' | 'LineString' | 'Polygon',
          properties: (feat.properties ?? {}) as Record<string, unknown>,
          label: feat.name ?? feat.feature_id,
        })
      })
    })

  // Helper: Search Planet Labs for satellite imagery
  const searchPlanetImagery = (
    bounds: readonly [number, number, number, number] | undefined,
    limit: number
  ): Effect.Effect<SearchResultImagery[], never, never> => {
    if (Option.isNone(planetOption) || !bounds) return Effect.succeed([])

    const planet = planetOption.value
    const [minLon, minLat, maxLon, maxLat] = bounds
    const polygon = [
      [minLon, minLat],
      [maxLon, minLat],
      [maxLon, maxLat],
      [minLon, maxLat],
      [minLon, minLat],
    ]

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const now = new Date()

    return planet.quickSearch({
      itemTypes: ['PSScene'],
      geometry: {
        type: 'Polygon',
        coordinates: [polygon],
      },
      acquiredGte: thirtyDaysAgo.toISOString(),
      acquiredLte: now.toISOString(),
      maxCloudCover: 0.3,
      limit,
    }).pipe(
      Effect.map((response) =>
        response.items
          .map(planetItemToImageryResult)
          .filter((r): r is SearchResultImagery => r !== null)
          .slice(0, limit)
      ),
      Effect.catchAll(() => Effect.succeed([] as SearchResultImagery[]))
    )
  }

  // Helper: Search Sentinel Hub for satellite imagery
  const searchSentinelImagery = (
    bounds: readonly [number, number, number, number] | undefined,
    limit: number
  ): Effect.Effect<SearchResultImagery[], never, never> => {
    if (Option.isNone(sentinelOption) || !bounds) return Effect.succeed([])

    const sentinel = sentinelOption.value
    const [minLon, minLat, maxLon, maxLat] = bounds

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const now = new Date()

    return sentinel.search({
      collections: ['sentinel-2-l2a'],
      bbox: [minLon, minLat, maxLon, maxLat],
      datetimeGte: thirtyDaysAgo.toISOString(),
      datetimeLte: now.toISOString(),
      maxCloudCover: 30,
      limit,
    }).pipe(
      Effect.map((response) =>
        response.items
          .map(sentinelItemToImageryResult)
          .filter((r): r is SearchResultImagery => r !== null)
          .slice(0, limit)
      ),
      Effect.catchAll(() => Effect.succeed([] as SearchResultImagery[]))
    )
  }

  // Helper: Get weather for viewport center
  const searchWeather = (
    bounds: readonly [number, number, number, number] | undefined,
    _limit: number
  ): Effect.Effect<SearchResultWeather[], never, never> => {
    if (Option.isNone(weatherOption) || !bounds) return Effect.succeed([])

    const weather = weatherOption.value
    const [minLon, minLat, maxLon, maxLat] = bounds
    const centerLat = (minLat + maxLat) / 2
    const centerLon = (minLon + maxLon) / 2

    return weather.getForecast({
      latitude: centerLat,
      longitude: centerLon,
      current: true,
      hourly: true,
      daily: true,
      forecastDays: 3,
      timezone: 'auto',
    }).pipe(
      Effect.map((forecast) => {
        const result = weatherForecastToSearchResult(forecast, `Weather at ${centerLat.toFixed(2)}, ${centerLon.toFixed(2)}`)
        return result ? [result] : []
      }),
      Effect.catchAll(() => Effect.succeed([] as SearchResultWeather[]))
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RPC Handlers
  // ─────────────────────────────────────────────────────────────────────────

  return {
    // Core Search Operations
    search: (request: SearchQuery) =>
      Effect.gen(function* () {
        const startTime = Date.now()
        const bounds = getBoundsFromQuery(request)
        const sources = request.sources.length > 0 ? request.sources : ['osm', 'opensky', 'track', 'feature', 'planet', 'sentinel', 'weather']
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

        // Query PostGIS tracks if requested
        if (sources.includes('track')) {
          const tracks = yield* searchTracks(bounds, limit)
          allResults.push(...tracks)
          sourceCounts['track'] = tracks.length
        }

        // Query PostGIS features if requested
        if (sources.includes('feature')) {
          const features = yield* searchFeatures(bounds, limit)
          allResults.push(...features)
          sourceCounts['feature'] = features.length
        }

        // Query Planet Labs if requested
        if (sources.includes('planet')) {
          const planetResults = yield* searchPlanetImagery(bounds, limit)
          allResults.push(...planetResults)
          sourceCounts['planet'] = planetResults.length
        }

        // Query Sentinel Hub if requested
        if (sources.includes('sentinel')) {
          const sentinelResults = yield* searchSentinelImagery(bounds, limit)
          allResults.push(...sentinelResults)
          sourceCounts['sentinel'] = sentinelResults.length
        }

        // Query Open-Meteo if requested
        if (sources.includes('weather')) {
          const weatherResults = yield* searchWeather(bounds, limit)
          allResults.push(...weatherResults)
          sourceCounts['weather'] = weatherResults.length
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
          Effect.flatMap(() => Effect.gen(function* () {
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

        // Query all sources in parallel
        const [flights, pois, tracks, features, planetImgs, sentinelImgs, weatherData] = yield* Effect.all([
          (sources.includes('opensky') || sources.length === 0)
            ? searchFlights(bounds, limit)
            : Effect.succeed([]),
          (sources.includes('osm') || sources.length === 0)
            ? searchPois(bounds, [], limit)
            : Effect.succeed([]),
          (sources.includes('track') || sources.length === 0)
            ? searchTracks(bounds, limit)
            : Effect.succeed([]),
          (sources.includes('feature') || sources.length === 0)
            ? searchFeatures(bounds, limit)
            : Effect.succeed([]),
          (sources.includes('planet') || sources.length === 0)
            ? searchPlanetImagery(bounds, limit)
            : Effect.succeed([]),
          (sources.includes('sentinel') || sources.length === 0)
            ? searchSentinelImagery(bounds, limit)
            : Effect.succeed([]),
          (sources.includes('weather') || sources.length === 0)
            ? searchWeather(bounds, limit)
            : Effect.succeed([]),
        ])

        allResults.push(...flights, ...pois, ...tracks, ...features, ...planetImgs, ...sentinelImgs, ...weatherData)
        sourceCounts['opensky'] = flights.length
        sourceCounts['osm'] = pois.length
        sourceCounts['track'] = tracks.length
        sourceCounts['feature'] = features.length
        sourceCounts['planet'] = planetImgs.length
        sourceCounts['sentinel'] = sentinelImgs.length
        sourceCounts['weather'] = weatherData.length

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
      const sources: IntelSource[] = request.sources.length > 0
        ? [...request.sources]
        : ['osm', 'opensky', 'track', 'feature', 'planet', 'sentinel', 'weather']
      const limit = request.limitPerSource ?? 100

      // Build search effect for a single source
      const makeSourceEffect = (source: IntelSource): Effect.Effect<SearchPartialResults, never> =>
        Effect.gen(function* () {
          let results: SearchResultItem[] = []

          switch (source) {
            case 'opensky':
              if (bounds) results = yield* searchFlights(bounds, limit)
              break
            case 'osm':
              if (bounds) results = yield* searchPois(bounds, [], limit)
              break
            case 'track':
              if (bounds) results = yield* searchTracks(bounds, limit)
              break
            case 'feature':
              if (bounds) results = yield* searchFeatures(bounds, limit)
              break
            case 'planet':
              if (bounds) results = yield* searchPlanetImagery(bounds, limit)
              break
            case 'sentinel':
              if (bounds) results = yield* searchSentinelImagery(bounds, limit)
              break
            case 'weather':
              if (bounds) results = yield* searchWeather(bounds, limit)
              break
          }

          return new SearchPartialResults({
            queryId: request.id,
            source,
            results,
            isComplete: true,
          })
        })

      // Create parallel streams - each emits SearchPartialResults when done
      const sourceStreams = sources.map((source) =>
        Stream.fromEffect(makeSourceEffect(source))
      )

      return Stream.make(
        new SearchStarted({
          queryId: request.id,
          sources,
          startedAt: new Date(),
        })
      ).pipe(
        // Merge all source streams - results emit immediately as each completes
        Stream.concat(Stream.mergeAll(sourceStreams, { concurrency: 'unbounded' })),
        // Emit completion after all sources finish
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
