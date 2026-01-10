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
  Match,
  pipe,
} from 'effect'
import * as RpcServer from '@effect/rpc/RpcServer'
import * as RpcSerialization from '@effect/rpc/RpcSerialization'
import { SearchRpcs } from '../clients/SearchClient'
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
import { parseError, type SearchError } from '../schemas/errors'
import {
  IngestionOrchestratorTag,
  IngestionPipelineLive,
} from '../ingestion'
import {
  type IngesterName,
  notConfiguredStatus,
  ingesterNotFoundStatus,
  parseIngestionError,
} from '../schemas/ingestion'

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

  // Dependencies - Ingestion Orchestrator (optional - may not be configured)
  const orchestratorOption = yield* Effect.serviceOption(IngestionOrchestratorTag)

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

  // Helper: Handle and classify errors with exhaustive Match-based logging
  const handleSearchError = <T>(source: string) => (error: unknown) =>
    Effect.gen(function* () {
      const searchError = parseError(error)

      // Exhaustive match on error tags for proper logging
      const logEffect = pipe(
        Match.type<SearchError>(),
        Match.tag('SearchRateLimitError', (e) =>
          Effect.logWarning(`[${source}] Rate limited: ${e.message}. Retry in ${e.retryDelayMs}ms`)
        ),
        Match.tag('SearchTimeoutError', (e) =>
          Effect.logWarning(`[${source}] Timeout after ${e.timeoutMs}ms: ${e.message}`)
        ),
        Match.tag('SearchNetworkError', (e) =>
          Effect.logError(`[${source}] Network error: ${e.message}${e.url ? ` (URL: ${e.url})` : ''}`)
        ),
        Match.tag('SearchServerError', (e) =>
          Effect.logError(`[${source}] Server error${e.statusCode ? ` (${e.statusCode})` : ''}: ${e.message}`)
        ),
        Match.tag('SearchAuthError', (e) =>
          Effect.logError(`[${source}] Auth error${e.source ? ` for ${e.source}` : ''}: ${e.message}`)
        ),
        Match.tag('SearchValidationError', (e) =>
          Effect.logWarning(`[${source}] Validation error${e.field ? ` (${e.field})` : ''}: ${e.message}`)
        ),
        Match.tag('SearchNotFoundError', (e) =>
          Effect.logWarning(`[${source}] Not found${e.resource ? ` (${e.resource})` : ''}: ${e.message}`)
        ),
        Match.tag('SearchUnknownError', (e) =>
          Effect.logError(`[${source}] Unknown error: ${e.message}`)
        ),
        Match.exhaustive
      )(searchError)

      yield* logEffect

      return { results: [] as T[], error: searchError as SearchError | undefined }
    })

  // Helper: Search OpenSky for flights with comprehensive error handling
  const searchFlights = (bounds: readonly [number, number, number, number] | undefined, limit: number) =>
    Effect.gen(function* () {
      if (!bounds) return { results: [] as SearchResultFlight[], error: undefined as SearchError | undefined }

      const result = yield* opensky.getStates({ bounds }).pipe(
        Effect.map((response) => ({
          results: (response.states ?? [])
            .map(openSkyToSearchResult)
            .filter((r): r is SearchResultFlight => r !== null)
            .slice(0, limit),
          error: undefined as SearchError | undefined,
        })),
        Effect.catchAll(handleSearchError<SearchResultFlight>('OpenSky'))
      )

      return result
    })

  // Helper: Search Overpass for POIs with comprehensive error handling
  const searchPois = (bounds: readonly [number, number, number, number] | undefined, amenities: string[], limit: number) =>
    Effect.gen(function* () {
      if (!bounds) return { results: [] as SearchResultPoi[], error: undefined as SearchError | undefined }

      const query = overpass.buildQuery({
        bounds,
        amenities: amenities.length > 0 ? amenities : ['hospital', 'police', 'fire_station', 'school'],
      })

      const result = yield* overpass.query(query).pipe(
        Effect.map((response) => ({
          results: response.elements
            .map(overpassToSearchResult)
            .filter((r): r is SearchResultPoi => r !== null)
            .slice(0, limit),
          error: undefined as SearchError | undefined,
        })),
        Effect.catchAll(handleSearchError<SearchResultPoi>('Overpass'))
      )

      return result
    })

  // Helper: Search PostGIS for tracks with comprehensive error handling
  const searchTracks = (bounds: readonly [number, number, number, number] | undefined, limit: number) =>
    Effect.gen(function* () {
      // If no track repository configured, return empty
      if (Option.isNone(trackRepoOption) || !bounds) {
        return { results: [] as SearchResultTrack[], error: undefined as SearchError | undefined }
      }

      const trackRepo = trackRepoOption.value
      const searchOptions: TrackPositionSearchOptions = {
        bounds: bounds as [number, number, number, number],
        limit,
      }

      const result = yield* trackRepo.search(searchOptions).pipe(
        Effect.map((positions) => ({
          results: positions.map((pos) => new SearchResultTrack({
            id: `track-${pos.track_id}-${pos.id}` as unknown as SearchResultId,
            source: 'track',
            score: 1.0,
            retrievedAt: new Date(),
            trackId: pos.track_id as unknown as TrackId,
            position: [pos.longitude, pos.latitude, pos.altitude ?? 0],
            heading: pos.heading ?? 0,
            speed: pos.speed ?? 0,
            classification: (pos.classification ?? 'unknown') as Classification,
            objectType: 'vehicle' as ObjectType,
            label: pos.track_id,
          })),
          error: undefined as SearchError | undefined,
        })),
        Effect.catchAll(handleSearchError<SearchResultTrack>('PostGIS Tracks'))
      )

      return result
    })

  // Helper: Search PostGIS for features with comprehensive error handling
  const searchFeatures = (bounds: readonly [number, number, number, number] | undefined, limit: number) =>
    Effect.gen(function* () {
      // If no feature repository configured, return empty
      if (Option.isNone(featureRepoOption) || !bounds) {
        return { results: [] as SearchResultFeature[], error: undefined as SearchError | undefined }
      }

      const featureRepo = featureRepoOption.value
      const searchOptions: FeatureSearchOptions = {
        bounds: bounds as [number, number, number, number],
        limit,
      }

      const result = yield* featureRepo.search(searchOptions).pipe(
        Effect.map((features) => ({
          results: features.map((feat) => {
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
              score: 1.0,
              retrievedAt: new Date(),
              featureId: feat.feature_id as unknown as FeatureId,
              position,
              geometryType: geometryType as 'Point' | 'LineString' | 'Polygon',
              properties: (feat.properties ?? {}) as Record<string, unknown>,
              label: feat.name ?? feat.feature_id,
            })
          }),
          error: undefined as SearchError | undefined,
        })),
        Effect.catchAll(handleSearchError<SearchResultFeature>('PostGIS Features'))
      )

      return result
    })

  // Helper: Search Planet Labs for satellite imagery with comprehensive error handling
  const searchPlanetImagery = (bounds: readonly [number, number, number, number] | undefined, limit: number) =>
    Effect.gen(function* () {
      if (Option.isNone(planetOption) || !bounds) {
        return { results: [] as SearchResultImagery[], error: undefined as SearchError | undefined }
      }

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

      const result = yield* planet.quickSearch({
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
        Effect.map((response) => ({
          results: response.items
            .map(planetItemToImageryResult)
            .filter((r): r is SearchResultImagery => r !== null)
            .slice(0, limit),
          error: undefined as SearchError | undefined,
        })),
        Effect.catchAll(handleSearchError<SearchResultImagery>('Planet Labs'))
      )

      return result
    })

  // Helper: Search Sentinel Hub for satellite imagery with comprehensive error handling
  const searchSentinelImagery = (bounds: readonly [number, number, number, number] | undefined, limit: number) =>
    Effect.gen(function* () {
      if (Option.isNone(sentinelOption) || !bounds) {
        return { results: [] as SearchResultImagery[], error: undefined as SearchError | undefined }
      }

      const sentinel = sentinelOption.value
      const [minLon, minLat, maxLon, maxLat] = bounds

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const now = new Date()

      const result = yield* sentinel.search({
        collections: ['sentinel-2-l2a'],
        bbox: [minLon, minLat, maxLon, maxLat],
        datetimeGte: thirtyDaysAgo.toISOString(),
        datetimeLte: now.toISOString(),
        maxCloudCover: 30,
        limit,
      }).pipe(
        Effect.map((response) => ({
          results: response.items
            .map(sentinelItemToImageryResult)
            .filter((r): r is SearchResultImagery => r !== null)
            .slice(0, limit),
          error: undefined as SearchError | undefined,
        })),
        Effect.catchAll(handleSearchError<SearchResultImagery>('Sentinel Hub'))
      )

      return result
    })

  // Helper: Get weather for viewport center with comprehensive error handling
  const searchWeather = (bounds: readonly [number, number, number, number] | undefined, _limit: number) =>
    Effect.gen(function* () {
      if (Option.isNone(weatherOption) || !bounds) {
        return { results: [] as SearchResultWeather[], error: undefined as SearchError | undefined }
      }

      const weather = weatherOption.value
      const [minLon, minLat, maxLon, maxLat] = bounds
      const centerLat = (minLat + maxLat) / 2
      const centerLon = (minLon + maxLon) / 2

      const result = yield* weather.getForecast({
        latitude: centerLat,
        longitude: centerLon,
        current: true,
        hourly: true,
        daily: true,
        forecastDays: 3,
        timezone: 'auto',
      }).pipe(
        Effect.map((forecast) => {
          const weatherResult = weatherForecastToSearchResult(forecast, `Weather at ${centerLat.toFixed(2)}, ${centerLon.toFixed(2)}`)
          return {
            results: weatherResult ? [weatherResult] : [] as SearchResultWeather[],
            error: undefined as SearchError | undefined,
          }
        }),
        Effect.catchAll(handleSearchError<SearchResultWeather>('Open-Meteo'))
      )

      return result
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
        const sources = request.sources.length > 0 ? request.sources : ['osm', 'opensky', 'track', 'feature', 'planet', 'sentinel', 'weather']
        const limit = request.limitPerSource ?? 100

        const allResults: SearchResultItem[] = []
        const sourceCounts: Record<string, number> = {}
        const errors: Record<string, string> = {}

        // Query OpenSky if requested
        if (sources.includes('opensky')) {
          const { results, error } = yield* searchFlights(bounds, limit)
          allResults.push(...results)
          sourceCounts['opensky'] = results.length
          if (error) errors['opensky'] = `${error._tag}: ${error.userMessage}`
        }

        // Query Overpass if requested
        if (sources.includes('osm')) {
          const { results, error } = yield* searchPois(bounds, [], limit)
          allResults.push(...results)
          sourceCounts['osm'] = results.length
          if (error) errors['osm'] = `${error._tag}: ${error.userMessage}`
        }

        // Query PostGIS tracks if requested
        if (sources.includes('track')) {
          const { results, error } = yield* searchTracks(bounds, limit)
          allResults.push(...results)
          sourceCounts['track'] = results.length
          if (error) errors['track'] = `${error._tag}: ${error.userMessage}`
        }

        // Query PostGIS features if requested
        if (sources.includes('feature')) {
          const { results, error } = yield* searchFeatures(bounds, limit)
          allResults.push(...results)
          sourceCounts['feature'] = results.length
          if (error) errors['feature'] = `${error._tag}: ${error.userMessage}`
        }

        // Query Planet Labs if requested
        if (sources.includes('planet')) {
          const { results, error } = yield* searchPlanetImagery(bounds, limit)
          allResults.push(...results)
          sourceCounts['planet'] = results.length
          if (error) errors['planet'] = `${error._tag}: ${error.userMessage}`
        }

        // Query Sentinel Hub if requested
        if (sources.includes('sentinel')) {
          const { results, error } = yield* searchSentinelImagery(bounds, limit)
          allResults.push(...results)
          sourceCounts['sentinel'] = results.length
          if (error) errors['sentinel'] = `${error._tag}: ${error.userMessage}`
        }

        // Query Open-Meteo if requested
        if (sources.includes('weather')) {
          const { results, error } = yield* searchWeather(bounds, limit)
          allResults.push(...results)
          sourceCounts['weather'] = results.length
          if (error) errors['weather'] = `${error._tag}: ${error.userMessage}`
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

    searchNearby: (request: { center: readonly [number, number]; radiusMeters: number; sources: readonly IntelSource[]; limit: number }) =>
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

        const startTime = Date.now()
        const allResults: SearchResultItem[] = []
        const sourceCounts: Record<string, number> = {}
        const errors: Record<string, string> = {}

        if (sources.includes('opensky') || sources.length === 0) {
          const { results, error } = yield* searchFlights(bounds, limit)
          allResults.push(...results)
          sourceCounts['opensky'] = results.length
          if (error) errors['opensky'] = `${error._tag}: ${error.userMessage}`
        }

        if (sources.includes('osm') || sources.length === 0) {
          const { results, error } = yield* searchPois(bounds, [], limit)
          allResults.push(...results)
          sourceCounts['osm'] = results.length
          if (error) errors['osm'] = `${error._tag}: ${error.userMessage}`
        }

        return new SearchResponse({
          queryId: searchId,
          totalCount: allResults.length,
          results: allResults,
          sourceCounts,
          executionTimeMs: Date.now() - startTime,
          truncated: false,
          errors,
        })
      }),

    searchInBounds: (request: { bounds: readonly [number, number, number, number]; sources: readonly IntelSource[]; limit: number }) =>
      Effect.gen(function* () {
        const searchId = yield* generateSearchId
        const { bounds, sources, limit } = request
        const startTime = Date.now()
        const allResults: SearchResultItem[] = []
        const sourceCounts: Record<string, number> = {}
        const errors: Record<string, string> = {}

        // Empty result helper
        const emptyResult = <T>() => Effect.succeed({ results: [] as T[], error: undefined as SearchError | undefined })

        // Query all sources in parallel
        const [flights, pois, tracks, features, planetImgs, sentinelImgs, weatherData] = yield* Effect.all([
          (sources.includes('opensky') || sources.length === 0)
            ? searchFlights(bounds, limit)
            : emptyResult<SearchResultFlight>(),
          (sources.includes('osm') || sources.length === 0)
            ? searchPois(bounds, [], limit)
            : emptyResult<SearchResultPoi>(),
          (sources.includes('track') || sources.length === 0)
            ? searchTracks(bounds, limit)
            : emptyResult<SearchResultTrack>(),
          (sources.includes('feature') || sources.length === 0)
            ? searchFeatures(bounds, limit)
            : emptyResult<SearchResultFeature>(),
          (sources.includes('planet') || sources.length === 0)
            ? searchPlanetImagery(bounds, limit)
            : emptyResult<SearchResultImagery>(),
          (sources.includes('sentinel') || sources.length === 0)
            ? searchSentinelImagery(bounds, limit)
            : emptyResult<SearchResultImagery>(),
          (sources.includes('weather') || sources.length === 0)
            ? searchWeather(bounds, limit)
            : emptyResult<SearchResultWeather>(),
        ])

        // Aggregate results and errors
        allResults.push(...flights.results, ...pois.results, ...tracks.results, ...features.results, ...planetImgs.results, ...sentinelImgs.results, ...weatherData.results)
        sourceCounts['opensky'] = flights.results.length
        sourceCounts['osm'] = pois.results.length
        sourceCounts['track'] = tracks.results.length
        sourceCounts['feature'] = features.results.length
        sourceCounts['planet'] = planetImgs.results.length
        sourceCounts['sentinel'] = sentinelImgs.results.length
        sourceCounts['weather'] = weatherData.results.length

        // Track errors per source
        if (flights.error) errors['opensky'] = `${flights.error._tag}: ${flights.error.userMessage}`
        if (pois.error) errors['osm'] = `${pois.error._tag}: ${pois.error.userMessage}`
        if (tracks.error) errors['track'] = `${tracks.error._tag}: ${tracks.error.userMessage}`
        if (features.error) errors['feature'] = `${features.error._tag}: ${features.error.userMessage}`
        if (planetImgs.error) errors['planet'] = `${planetImgs.error._tag}: ${planetImgs.error.userMessage}`
        if (sentinelImgs.error) errors['sentinel'] = `${sentinelImgs.error._tag}: ${sentinelImgs.error.userMessage}`
        if (weatherData.error) errors['weather'] = `${weatherData.error._tag}: ${weatherData.error.userMessage}`

        return new SearchResponse({
          queryId: searchId,
          totalCount: allResults.length,
          results: allResults,
          sourceCounts,
          executionTimeMs: Date.now() - startTime,
          truncated: false,
          errors,
        })
      }),

    streamSearch: (request: SearchQuery) => {
      const bounds = getBoundsFromQuery(request)
      const sources: IntelSource[] = request.sources.length > 0
        ? [...request.sources]
        : ['osm', 'opensky', 'track', 'feature', 'planet', 'sentinel', 'weather']
      const limit = request.limitPerSource ?? 100

      // Build search effect for a single source with error tracking
      const makeSourceEffect = (source: IntelSource) =>
        Effect.gen(function* () {
          let results: SearchResultItem[] = []
          let sourceError: SearchError | undefined

          switch (source) {
            case 'opensky':
              if (bounds) {
                const r = yield* searchFlights(bounds, limit)
                results = r.results
                sourceError = r.error
              }
              break
            case 'osm':
              if (bounds) {
                const r = yield* searchPois(bounds, [], limit)
                results = r.results
                sourceError = r.error
              }
              break
            case 'track':
              if (bounds) {
                const r = yield* searchTracks(bounds, limit)
                results = r.results
                sourceError = r.error
              }
              break
            case 'feature':
              if (bounds) {
                const r = yield* searchFeatures(bounds, limit)
                results = r.results
                sourceError = r.error
              }
              break
            case 'planet':
              if (bounds) {
                const r = yield* searchPlanetImagery(bounds, limit)
                results = r.results
                sourceError = r.error
              }
              break
            case 'sentinel':
              if (bounds) {
                const r = yield* searchSentinelImagery(bounds, limit)
                results = r.results
                sourceError = r.error
              }
              break
            case 'weather':
              if (bounds) {
                const r = yield* searchWeather(bounds, limit)
                results = r.results
                sourceError = r.error
              }
              break
          }

          return new SearchPartialResults({
            queryId: request.id,
            source,
            results,
            isComplete: true,
            error: sourceError ? `${sourceError._tag}: ${sourceError.userMessage}` : undefined,
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
        // Bounded concurrency (2) to limit memory pressure from concurrent API calls
        Stream.concat(Stream.mergeAll(sourceStreams, { concurrency: 2 })),
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

    // External API Proxies (wrapped with comprehensive error handling)
    queryOpenSky: (request: { bounds?: readonly [number, number, number, number]; icao24: readonly string[]; time?: number }) =>
      opensky.getStates({
        bounds: request.bounds,
        icao24: [...request.icao24], // Convert readonly to mutable
        time: request.time,
      }).pipe(
        Effect.catchAll(handleSearchError<OpenSkyResponse>('queryOpenSky')),
        Effect.map((result) => 'results' in result
          ? new OpenSkyResponse({ time: Date.now() / 1000, states: null })
          : result
        )
      ),

    queryOverpass: (request: { query: string; format: 'json' | 'xml' | 'csv'; timeout: number }) =>
      overpass.query(request.query, { timeout: request.timeout }).pipe(
        Effect.catchAll(handleSearchError<OverpassResponse>('queryOverpass')),
        Effect.map((result) => 'results' in result
          ? new OverpassResponse({
              version: 0.6,
              generator: 'SearchRpcServer (error fallback)',
              osm3s: {
                timestamp_osm_base: new Date().toISOString(),
                copyright: 'Error occurred'
              },
              elements: []
            })
          : result
        )
      ),

    buildOverpassQuery: (request: { bounds: readonly [number, number, number, number]; amenities: readonly string[]; tags: Record<string, string> }) =>
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
        const errors: Record<string, string> = {}

        // Empty result helper
        const emptyResult = <T>() => Effect.succeed({ results: [] as T[], error: undefined as SearchError | undefined })

        const [flightsResult, poisResult] = yield* Effect.all([
          sources.includes('opensky') ? searchFlights(bounds, limit) : emptyResult<SearchResultFlight>(),
          sources.includes('osm') ? searchPois(bounds, [], limit) : emptyResult<SearchResultPoi>(),
        ])

        allResults.push(...flightsResult.results, ...poisResult.results)
        sourceCounts['opensky'] = flightsResult.results.length
        sourceCounts['osm'] = poisResult.results.length
        if (flightsResult.error) errors['opensky'] = `${flightsResult.error._tag}: ${flightsResult.error.userMessage}`
        if (poisResult.error) errors['osm'] = `${poisResult.error._tag}: ${poisResult.error.userMessage}`

        return new SearchResponse({
          queryId: saved.query.id,
          totalCount: allResults.length,
          results: allResults,
          sourceCounts,
          executionTimeMs: Date.now() - startTime,
          truncated: false,
          errors,
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

    // ─────────────────────────────────────────────────────────────────────────
    // Ingestion Control
    // ─────────────────────────────────────────────────────────────────────────

    startIngestion: (_request: {}) =>
      Effect.gen(function* () {
        if (Option.isNone(orchestratorOption)) {
          yield* Effect.logWarning('[Ingestion] Orchestrator not configured')
          return notConfiguredStatus()
        }

        const orchestrator = orchestratorOption.value
        yield* orchestrator.start().pipe(
          Effect.catchAll((e) => {
            const ingestionError = parseIngestionError(e)
            return Effect.logError(`[Ingestion] ${ingestionError.userMessage}`)
          })
        )
        return yield* orchestrator.status()
      }),

    stopIngestion: (_request: {}) =>
      Effect.gen(function* () {
        if (Option.isNone(orchestratorOption)) {
          yield* Effect.logWarning('[Ingestion] Orchestrator not configured')
          return notConfiguredStatus()
        }

        const orchestrator = orchestratorOption.value
        yield* orchestrator.stop().pipe(
          Effect.catchAll((e) => {
            const ingestionError = parseIngestionError(e)
            return Effect.logError(`[Ingestion] ${ingestionError.userMessage}`)
          })
        )
        return yield* orchestrator.status()
      }),

    getIngestionStatus: (_request: {}) =>
      Effect.gen(function* () {
        if (Option.isNone(orchestratorOption)) {
          return notConfiguredStatus()
        }

        return yield* orchestratorOption.value.status()
      }),

    startIngester: (request: { name: IngesterName }) =>
      Effect.gen(function* () {
        if (Option.isNone(orchestratorOption)) {
          yield* Effect.logWarning(`[Ingestion] Orchestrator not configured, cannot start ${request.name}`)
          return ingesterNotFoundStatus(request.name)
        }

        const orchestrator = orchestratorOption.value
        yield* orchestrator.startIngester(request.name).pipe(
          Effect.catchAll((e) => {
            const ingestionError = parseIngestionError(e)
            return Effect.logError(`[Ingestion] ${ingestionError.userMessage}`)
          })
        )
        const status = yield* orchestrator.status()
        const ingesterStatus = status.ingesters.find((i) => i.name === request.name)

        return ingesterStatus ?? ingesterNotFoundStatus(request.name)
      }),

    stopIngester: (request: { name: IngesterName }) =>
      Effect.gen(function* () {
        if (Option.isNone(orchestratorOption)) {
          yield* Effect.logWarning(`[Ingestion] Orchestrator not configured, cannot stop ${request.name}`)
          return ingesterNotFoundStatus(request.name)
        }

        const orchestrator = orchestratorOption.value
        yield* orchestrator.stopIngester(request.name).pipe(
          Effect.catchAll((e) => {
            const ingestionError = parseIngestionError(e)
            return Effect.logError(`[Ingestion] ${ingestionError.userMessage}`)
          })
        )
        const status = yield* orchestrator.status()
        const ingesterStatus = status.ingesters.find((i) => i.name === request.name)

        // For stop, return stopped status if not found (already stopped)
        return ingesterStatus ?? {
          name: request.name,
          running: false,
          startedAt: Option.none(),
          error: Option.none(),
        }
      }),
  }
})

// =============================================================================
// Server Layer
// =============================================================================

/**
 * Search RPC handlers layer
 */
export const SearchRpcHandlersLayer = SearchRpcs.toLayer(SearchRpcHandlers)

/**
 * Complete search RPC server layer with WebSocket protocol
 *
 * Uses RpcServer.layerProtocolWebsocketRouter for proper integration
 * with HttpLayerRouter and BunHttpServer.
 *
 * @example
 * ```typescript
 * // Start the server with HttpRouter.Default.serve()
 * const ServerLive = HttpRouter.Default.serve().pipe(
 *   Layer.provide(SearchRpcServerLayer),
 *   Layer.provide(BunHttpServer.layer({ port: 8081 })),
 *   Layer.provide(BunContext.layer)
 * )
 * BunRuntime.runMain(Layer.launch(ServerLive))
 * ```
 */
export const SearchRpcServerLayer = pipe(
  RpcServer.layer(SearchRpcs),
  Layer.provide(SearchRpcHandlersLayer),
  Layer.provideMerge(RpcServer.layerProtocolWebsocketRouter({ path: '/geoint/search' })),
  Layer.provide(RpcSerialization.layerJson),
  // ExternalApiClientsLive depends on HttpClient.HttpClient from FetchHttpClient
  // The dependency order is: SearchRpcHandlersLayer -> ExternalApiClientsLive -> FetchHttpClient
  Layer.provide(
    ExternalApiClientsLive.pipe(
      Layer.provide(FetchHttpClient.layer)
    )
  ),
)

/**
 * Search RPC server layer with full ingestion pipeline
 *
 * Includes background data polling for:
 * - OpenSky Network flights
 * - OpenStreetMap POIs via Overpass
 * - Open-Meteo weather
 * - Satellite imagery (Planet Labs, Sentinel Hub)
 *
 * **Requires:**
 * - `PgClient.PgClient` (PostgreSQL connection for repositories)
 *
 * Use `startIngestion` RPC to begin background polling.
 *
 * @example
 * ```typescript
 * const ServerLive = HttpRouter.Default.serve().pipe(
 *   Layer.provide(SearchRpcServerWithIngestionLayer),
 *   Layer.provide(BunHttpServer.layer({ port: 8081 })),
 *   Layer.provide(BunContext.layer),
 *   Layer.provide(PgClientLive)
 * )
 * ```
 */
export const SearchRpcServerWithIngestionLayer = pipe(
  RpcServer.layer(SearchRpcs),
  Layer.provide(SearchRpcHandlersLayer),
  Layer.provideMerge(RpcServer.layerProtocolWebsocketRouter({ path: '/geoint/search' })),
  Layer.provide(RpcSerialization.layerJson),
  // Ingestion pipeline includes all ingesters, orchestrator, repositories, and API clients
  Layer.provide(
    IngestionPipelineLive.pipe(
      Layer.provide(FetchHttpClient.layer)
    )
  ),
)

// Note: SearchRpcHandlers, SearchRpcHandlersLayer, SearchRpcServerLayer,
// SearchRpcServerWithIngestionLayer are exported via `export const` above
