/**
 * Search Entity Handlers - Effect Cluster Behavior Implementation
 *
 * Implements the handlers for SearchEntity RPCs:
 * - Source-specific search handlers (tracks, OSM, flights, features)
 * - Aggregation handler with fan-out/fan-in pattern
 * - Health check handlers
 *
 * Architecture:
 * - PostGIS repositories for spatial queries (tracks, features)
 * - External API clients for live data (OpenSky, Overpass)
 * - DurableStreams for search result publishing (client reconnection/replay)
 *
 * @see beads:tmnl-j5139 Effect Cluster: Distributed Search Processing
 * @module
 */

import { Effect, Stream, Option, pipe } from 'effect'
import {
  SearchEntity,
  SearchEntityError,
  SourceHealthStatus,
} from './SearchEntity'
import {
  SearchResponse,
  SearchResultItem,
  IntelSource,
  SearchStarted,
  SearchPartialResults,
  SearchCompleted,
  SearchResultPoi,
  SearchResultFlight,
  SearchResultTrack,
  SearchResultFeature,
  SearchResultWeather,
  SearchResultImagery,
  SearchResultId,
  TrackId,
  FeatureId,
  Classification,
  ObjectType,
  type BBox,
} from '../schemas'
import {
  OpenSkyClientService,
  OverpassClientService,
  PlanetLabsClientService,
  SentinelHubClientService,
  OpenMeteoClientService,
  openSkyToSearchResult,
  overpassToSearchResult,
  planetItemToSearchResult,
  sentinelItemToSearchResult,
  weatherForecastToSearchResult,
  planetItemToImageryResult,
  sentinelItemToImageryResult,
} from '../api/ExternalApiClient'
import {
  TrackPositionRepositoryTag,
  FeatureRepositoryTag,
  type TrackPositionSearchOptions,
  type FeatureSearchOptions,
} from '../persistence'
import { DurableStreamClient } from '../../durable-streams/service'

// =============================================================================
// Handler Implementation
// =============================================================================

/**
 * Search Entity Handlers
 *
 * Single handler object implementing all SearchEntity RPCs.
 * Uses envelope.payload pattern for accessing request data.
 */
export const SearchEntityHandlers = SearchEntity.toLayer(
  Effect.gen(function* () {
    // Yield external API services
    const opensky = yield* OpenSkyClientService
    const overpass = yield* OverpassClientService

    // Optional satellite imagery and weather services (graceful degradation)
    const planetOption = yield* Effect.serviceOption(PlanetLabsClientService)
    const sentinelOption = yield* Effect.serviceOption(SentinelHubClientService)
    const weatherOption = yield* Effect.serviceOption(OpenMeteoClientService)

    // Optional PostGIS repositories (graceful degradation if not configured)
    const trackRepoOption = yield* Effect.serviceOption(TrackPositionRepositoryTag)
    const featureRepoOption = yield* Effect.serviceOption(FeatureRepositoryTag)

    // Optional DurableStreamClient for search result publishing
    const durableStreamOption = yield* Effect.serviceOption(DurableStreamClient)

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: Search tracks from PostGIS repository
    // ─────────────────────────────────────────────────────────────────────────
    const searchTracksFromRepo = (
      bounds: BBox | undefined,
      limit: number
    ): Effect.Effect<SearchResultTrack[], never> => {
      if (Option.isNone(trackRepoOption) || !bounds) return Effect.succeed([])

      const trackRepo = trackRepoOption.value
      const searchOptions: TrackPositionSearchOptions = {
        bounds: bounds as [number, number, number, number],
        limit,
      }

      return trackRepo.search(searchOptions).pipe(
        Effect.map((positions) =>
          positions.map(
            (pos) =>
              new SearchResultTrack({
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
              })
          )
        ),
        Effect.tap(() => Effect.logDebug('Track search completed')),
        Effect.catchAll(() => Effect.succeed([] as SearchResultTrack[]))
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: Search features from PostGIS repository
    // ─────────────────────────────────────────────────────────────────────────
    const searchFeaturesFromRepo = (
      bounds: BBox | undefined,
      featureTypes: readonly string[],
      limit: number
    ): Effect.Effect<SearchResultFeature[], never> => {
      if (Option.isNone(featureRepoOption) || !bounds) return Effect.succeed([])

      const featureRepo = featureRepoOption.value
      const searchOptions: FeatureSearchOptions = {
        bounds: bounds as [number, number, number, number],
        featureType: featureTypes.length > 0 ? featureTypes[0] : undefined,
        limit,
      }

      return featureRepo.search(searchOptions).pipe(
        Effect.map((features) =>
          features.map((feat) => {
            // Extract center position from geometry
            let position: [number, number] = [0, 0]
            if (feat.geom) {
              const geom = feat.geom
              if (geom.type === 'Point') {
                position = [geom.coordinates[0], geom.coordinates[1]]
              } else if (geom.type === 'LineString') {
                const mid = Math.floor(geom.coordinates.length / 2)
                position = geom.coordinates[mid] as [number, number]
              } else if (geom.type === 'Polygon') {
                const coords = geom.coordinates[0]
                const centroidX = coords.reduce((sum, c) => sum + c[0], 0) / coords.length
                const centroidY = coords.reduce((sum, c) => sum + c[1], 0) / coords.length
                position = [centroidX, centroidY]
              }
            }

            return new SearchResultFeature({
              id: `feature-${feat.feature_id}` as unknown as SearchResultId,
              source: 'feature',
              score: 1.0,
              retrievedAt: new Date(),
              featureId: feat.feature_id as unknown as FeatureId,
              position,
              geometryType: (feat.geom?.type ?? 'Point') as 'Point' | 'LineString' | 'Polygon',
              properties: (feat.properties ?? {}) as Record<string, unknown>,
              label: feat.name ?? feat.feature_id,
            })
          })
        ),
        Effect.tap(() => Effect.logDebug('Feature search completed')),
        Effect.catchAll(() => Effect.succeed([] as SearchResultFeature[]))
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: Search Planet Labs for satellite imagery
    // ─────────────────────────────────────────────────────────────────────────
    const searchPlanetImagery = (
      bounds: BBox | undefined,
      limit: number
    ): Effect.Effect<SearchResultImagery[], never> => {
      if (Option.isNone(planetOption) || !bounds) return Effect.succeed([])

      const planet = planetOption.value
      // Convert BBox [minLon, minLat, maxLon, maxLat] to polygon coordinates
      const [minLon, minLat, maxLon, maxLat] = bounds
      const polygon = [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ]

      // Date range: last 30 days
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
        Effect.tap((results) => Effect.logDebug(`Planet search: ${results.length} items`)),
        Effect.catchAll(() => Effect.succeed([] as SearchResultImagery[]))
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: Search Sentinel Hub for satellite imagery
    // ─────────────────────────────────────────────────────────────────────────
    const searchSentinelImagery = (
      bounds: BBox | undefined,
      limit: number
    ): Effect.Effect<SearchResultImagery[], never> => {
      if (Option.isNone(sentinelOption) || !bounds) return Effect.succeed([])

      const sentinel = sentinelOption.value
      const [minLon, minLat, maxLon, maxLat] = bounds

      // Date range: last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const now = new Date()

      return sentinel.search({
        collections: ['sentinel-2-l2a'],
        bbox: [minLon, minLat, maxLon, maxLat],
        datetimeGte: thirtyDaysAgo.toISOString(),
        datetimeLte: now.toISOString(),
        maxCloudCover: 30, // 0-100 scale for Sentinel
        limit,
      }).pipe(
        Effect.map((response) =>
          response.items
            .map(sentinelItemToImageryResult)
            .filter((r): r is SearchResultImagery => r !== null)
            .slice(0, limit)
        ),
        Effect.tap((results) => Effect.logDebug(`Sentinel search: ${results.length} items`)),
        Effect.catchAll(() => Effect.succeed([] as SearchResultImagery[]))
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: Get weather for viewport center
    // ─────────────────────────────────────────────────────────────────────────
    const searchWeather = (
      bounds: BBox | undefined,
      _limit: number
    ): Effect.Effect<SearchResultWeather[], never> => {
      if (Option.isNone(weatherOption) || !bounds) return Effect.succeed([])

      const weather = weatherOption.value
      // Get center of bounds
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
        Effect.tap((results) => Effect.logDebug(`Weather search: ${results.length} forecasts`)),
        Effect.catchAll(() => Effect.succeed([] as SearchResultWeather[]))
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: Publish search event to DurableStream (if configured)
    // Fire-and-forget pattern with graceful degradation
    // ─────────────────────────────────────────────────────────────────────────
    const publishSearchEvent = <T>(
      streamUrl: string,
      event: T
    ): Effect.Effect<void, never> => {
      if (Option.isNone(durableStreamOption)) return Effect.void

      const dsClient = durableStreamOption.value
      return dsClient
        .getOrCreate<T>({ url: streamUrl })
        .pipe(
          Effect.flatMap((handle) => handle.append(event)),
          Effect.catchAll(() => Effect.void)
        )
    }

    return {
      // ─────────────────────────────────────────────────────────────────────────
      // Source-Specific Handlers
      // ─────────────────────────────────────────────────────────────────────────

      SearchTracks: (envelope) =>
        Effect.gen(function* () {
          const { searchId, bounds, limit } = envelope.payload

          yield* Effect.logInfo(`SearchTracks: ${searchId}`)

          // Query PostGIS repository for tracks within bounds
          const results = yield* searchTracksFromRepo(
            bounds as BBox | undefined,
            limit ?? 100
          )

          yield* Effect.logInfo(`SearchTracks: found ${results.length} tracks`)
          return results as readonly SearchResultItem[]
        }),

      SearchOsm: (envelope) =>
        Effect.gen(function* () {
          const { searchId, bounds, amenities, limit } = envelope.payload

          yield* Effect.logInfo(`SearchOsm: ${searchId}`)

          // Build Overpass query
          const overpassQuery = overpass.buildQuery({
            bounds: bounds as readonly [number, number, number, number],
            amenities: amenities ?? [],
          })

          // Execute query with error handling
          const response = yield* overpass.query(overpassQuery).pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                yield* Effect.logWarning(`SearchOsm error: ${error._tag}`)
                return { elements: [] as never[], version: 0, generator: '', osm3s: { timestamp_osm_base: '', copyright: '' } }
              })
            )
          )

          // Transform to SearchResultItem[]
          const results: readonly SearchResultItem[] = response.elements
            .map(overpassToSearchResult)
            .filter((r): r is SearchResultPoi => r !== null)
            .slice(0, limit ?? 100)

          yield* Effect.logInfo(`SearchOsm: found ${results.length} POIs`)
          return results
        }),

      SearchFlights: (envelope) =>
        Effect.gen(function* () {
          const { searchId, bounds, icao24, limit } = envelope.payload

          yield* Effect.logInfo(`SearchFlights: ${searchId}`)

          // Call OpenSky API
          const response = yield* opensky.getStates({
            bounds: bounds as readonly [number, number, number, number] | undefined,
            icao24: icao24 ?? [],
          }).pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                yield* Effect.logWarning(`SearchFlights error: ${error._tag}`)
                return { time: Date.now(), states: null }
              })
            )
          )

          // Transform to SearchResultItem[]
          const results: readonly SearchResultItem[] = (response.states ?? [])
            .map(openSkyToSearchResult)
            .filter((r): r is SearchResultFlight => r !== null)
            .slice(0, limit ?? 100)

          yield* Effect.logInfo(`SearchFlights: found ${results.length} flights`)
          return results
        }),

      SearchFeatures: (envelope) =>
        Effect.gen(function* () {
          const { searchId, bounds, featureTypes, limit } = envelope.payload

          yield* Effect.logInfo(`SearchFeatures: ${searchId}`)

          // Query PostGIS repository for features within bounds
          const results = yield* searchFeaturesFromRepo(
            bounds as BBox | undefined,
            featureTypes ?? [],
            limit ?? 100
          )

          yield* Effect.logInfo(`SearchFeatures: found ${results.length} features`)
          return results as readonly SearchResultItem[]
        }),

      // ─────────────────────────────────────────────────────────────────────────
      // Aggregation Handlers
      // ─────────────────────────────────────────────────────────────────────────

      AggregatedSearch: (envelope) =>
        Effect.gen(function* () {
          const { query } = envelope.payload
          const queryId = query.id
          const startTime = Date.now()

          yield* Effect.logInfo(`AggregatedSearch: ${queryId}`)

          // Extract bounds from query geo filter
          const bounds = query.geoFilter?._tag === 'GeoFilterBounds'
            ? query.geoFilter.bounds
            : undefined
          const limit = query.limitPerSource ?? 100

          // Determine sources to query
          const sourcesToQuery: readonly IntelSource[] =
            query.sources.length > 0
              ? query.sources
              : (['track', 'osm', 'opensky', 'feature', 'planet', 'sentinel', 'weather'] as const)

          // Fan-out: Query all sources in parallel using Effect.all
          const sourceErrors: Record<string, string> = {}

          // Build effects for each requested source (returns { source, results, error? })
          const sourceEffects = sourcesToQuery.map((source) => {
            const makeSourceEffect = (): Effect.Effect<{ source: IntelSource; results: SearchResultItem[] }, never> => {
              switch (source) {
                case 'track':
                  return searchTracksFromRepo(bounds as BBox | undefined, limit).pipe(
                    Effect.map((results) => ({ source, results }))
                  )
                case 'feature':
                  return searchFeaturesFromRepo(bounds as BBox | undefined, [], limit).pipe(
                    Effect.map((results) => ({ source, results }))
                  )
                case 'osm':
                  if (!bounds) return Effect.succeed({ source, results: [] })
                  return pipe(
                    overpass.query(overpass.buildQuery({
                      bounds: bounds as readonly [number, number, number, number],
                      amenities: [],
                    })),
                    Effect.map((response) =>
                      response.elements
                        .map(overpassToSearchResult)
                        .filter((r): r is SearchResultPoi => r !== null)
                        .slice(0, limit)
                    ),
                    Effect.catchAll((error) => {
                      sourceErrors['osm'] = error._tag
                      return Effect.succeed([] as SearchResultPoi[])
                    }),
                    Effect.map((results) => ({ source, results }))
                  )
                case 'opensky':
                  if (!bounds) return Effect.succeed({ source, results: [] })
                  return pipe(
                    opensky.getStates({
                      bounds: bounds as readonly [number, number, number, number],
                      icao24: [],
                    }),
                    Effect.map((response) =>
                      (response.states ?? [])
                        .map(openSkyToSearchResult)
                        .filter((r): r is SearchResultFlight => r !== null)
                        .slice(0, limit)
                    ),
                    Effect.catchAll((error) => {
                      sourceErrors['opensky'] = error._tag
                      return Effect.succeed([] as SearchResultFlight[])
                    }),
                    Effect.map((results) => ({ source, results }))
                  )
                case 'planet':
                  return searchPlanetImagery(bounds as BBox | undefined, limit).pipe(
                    Effect.map((results) => ({ source, results }))
                  )
                case 'sentinel':
                  return searchSentinelImagery(bounds as BBox | undefined, limit).pipe(
                    Effect.map((results) => ({ source, results }))
                  )
                case 'weather':
                  return searchWeather(bounds as BBox | undefined, limit).pipe(
                    Effect.map((results) => ({ source, results }))
                  )
                default:
                  return Effect.succeed({ source, results: [] })
              }
            }
            return makeSourceEffect()
          })

          // Execute all source queries in parallel
          const sourceResults = yield* Effect.all(sourceEffects, { concurrency: 'unbounded' })

          // Aggregate results
          const allResults: SearchResultItem[] = []
          const sourceCounts: Record<string, number> = {}
          for (const { source, results } of sourceResults) {
            allResults.push(...results)
            sourceCounts[source] = results.length
          }

          const executionTimeMs = Date.now() - startTime

          // Publish aggregated result to DurableStream for client replay
          const searchStreamUrl = `/search/results/${queryId}`
          yield* publishSearchEvent(searchStreamUrl, {
            _tag: 'SearchCompleted',
            queryId,
            totalResults: allResults.length,
            sourceCounts,
            executionTimeMs,
            completedAt: new Date(),
          })

          return new SearchResponse({
            queryId,
            totalCount: allResults.length,
            results: allResults,
            sourceCounts,
            executionTimeMs,
            truncated: false,
            errors: sourceErrors,
          })
        }),

      StreamSearch: (envelope) => {
        const { query } = envelope.payload
        const queryId = query.id

        // Extract bounds from query geo filter
        const bounds = query.geoFilter?._tag === 'GeoFilterBounds'
          ? query.geoFilter.bounds
          : undefined
        const limit = query.limitPerSource ?? 100

        const sourcesToQuery: readonly IntelSource[] =
          query.sources.length > 0
            ? query.sources
            : (['track', 'osm', 'opensky', 'feature', 'planet', 'sentinel', 'weather'] as const)

        // DurableStream URL for this search (clients can reconnect and resume)
        const searchStreamUrl = `/search/stream/${queryId}`

        // Build individual search effect for each source
        const makeSourceSearchEffect = (
          source: IntelSource
        ): Effect.Effect<SearchPartialResults, never> =>
          Effect.gen(function* () {
            let results: SearchResultItem[] = []

            // Query appropriate source
            switch (source) {
              case 'track':
                results = yield* searchTracksFromRepo(bounds as BBox | undefined, limit)
                break
              case 'feature':
                results = yield* searchFeaturesFromRepo(bounds as BBox | undefined, [], limit)
                break
              case 'osm':
                if (bounds) {
                  const overpassQuery = overpass.buildQuery({
                    bounds: bounds as readonly [number, number, number, number],
                    amenities: [],
                  })
                  const osmResponse = yield* overpass.query(overpassQuery).pipe(
                    Effect.catchAll(() =>
                      Effect.succeed({
                        elements: [] as never[],
                        version: 0,
                        generator: '',
                        osm3s: { timestamp_osm_base: '', copyright: '' },
                      })
                    )
                  )
                  results = osmResponse.elements
                    .map(overpassToSearchResult)
                    .filter((r): r is SearchResultPoi => r !== null)
                    .slice(0, limit)
                }
                break
              case 'opensky':
                if (bounds) {
                  const flightResponse = yield* opensky
                    .getStates({
                      bounds: bounds as readonly [number, number, number, number],
                      icao24: [],
                    })
                    .pipe(
                      Effect.catchAll(() =>
                        Effect.succeed({ time: Date.now(), states: null })
                      )
                    )
                  results = (flightResponse.states ?? [])
                    .map(openSkyToSearchResult)
                    .filter((r): r is SearchResultFlight => r !== null)
                    .slice(0, limit)
                }
                break
              case 'planet':
                if (bounds) {
                  results = yield* searchPlanetImagery(
                    bounds as BBox | undefined,
                    limit
                  )
                }
                break
              case 'sentinel':
                if (bounds) {
                  results = yield* searchSentinelImagery(
                    bounds as BBox | undefined,
                    limit
                  )
                }
                break
              case 'weather':
                if (bounds) {
                  results = yield* searchWeather(bounds as BBox | undefined, limit)
                }
                break
              default:
                // Unknown source - return empty results
                break
            }

            // Create partial results event
            const partialEvent = new SearchPartialResults({
              queryId,
              source,
              results,
              isComplete: true,
            })

            // Publish to DurableStream (fire and forget)
            yield* publishSearchEvent(searchStreamUrl, partialEvent)

            return partialEvent
          })

        // Create parallel source streams - each emits SearchPartialResults when done
        const sourceStreams = sourcesToQuery.map((source) =>
          Stream.fromEffect(makeSourceSearchEffect(source))
        )

        // Return stream of search events with parallel source execution
        return pipe(
          // 1. Emit SearchStarted
          Stream.make(
            new SearchStarted({
              queryId,
              sources: [...sourcesToQuery],
              startedAt: new Date(),
            })
          ),
          // 2. Merge all source streams - results emit immediately as each completes
          Stream.concat(
            Stream.mergeAll(sourceStreams, { concurrency: 'unbounded' })
          ),
          // 3. Emit SearchCompleted after all sources finish
          Stream.concat(
            Stream.fromEffect(
              Effect.gen(function* () {
                const completedEvent = new SearchCompleted({
                  queryId,
                  totalResults: 0, // Actual count would require aggregation
                  completedAt: new Date(),
                })

                // Publish completion to DurableStream
                yield* publishSearchEvent(searchStreamUrl, completedEvent)

                return completedEvent
              })
            )
          )
        )
      },

      CancelSearch: (envelope) =>
        Effect.gen(function* () {
          const { searchId, reason } = envelope.payload
          yield* Effect.logInfo(
            `CancelSearch: ${searchId} - ${reason ?? 'No reason provided'}`
          )
          // TODO: Track active searches and cancel their fibers
        }),

      // ─────────────────────────────────────────────────────────────────────────
      // Health Handlers
      // ─────────────────────────────────────────────────────────────────────────

      GetSourceHealth: (_envelope) =>
        Effect.gen(function* () {
          const sources: IntelSource[] = [
            'track', 'osm', 'opensky', 'feature',
            'planet', 'sentinel', 'weather'
          ]
          const now = new Date()

          return sources.map((source) => {
            // Check if optional services are configured
            let available = true
            if (source === 'planet') available = Option.isSome(planetOption)
            if (source === 'sentinel') available = Option.isSome(sentinelOption)
            if (source === 'weather') available = Option.isSome(weatherOption)

            return {
              source,
              available,
              latencyMs: undefined,
              lastError: undefined,
              lastChecked: now,
            } satisfies typeof SourceHealthStatus.Type
          })
        }),

      PingSource: (envelope) =>
        Effect.gen(function* () {
          const { source } = envelope.payload
          const start = Date.now()

          yield* Effect.logInfo(`PingSource: ${source}`)

          // Ping the actual source
          let available = true
          let lastError: string | undefined

          if (source === 'opensky') {
            yield* opensky.getStates({}).pipe(
              Effect.catchAll((error) =>
                Effect.gen(function* () {
                  available = false
                  lastError = error._tag
                  return { time: 0, states: null }
                })
              )
            )
          } else if (source === 'osm') {
            // Simple health check query for Overpass
            yield* overpass.query('[out:json][timeout:5];node(1);out;').pipe(
              Effect.catchAll((error) =>
                Effect.gen(function* () {
                  available = false
                  lastError = error._tag
                  return { elements: [], version: 0, generator: '', osm3s: { timestamp_osm_base: '', copyright: '' } }
                })
              )
            )
          } else if (source === 'planet') {
            // Check Planet Labs availability
            if (Option.isNone(planetOption)) {
              available = false
              lastError = 'NotConfigured'
            } else {
              // Try a minimal search to test API connectivity
              yield* planetOption.value.quickSearch({
                itemTypes: ['PSScene'],
                geometry: { type: 'Point', coordinates: [0, 0] },
                limit: 1,
              }).pipe(
                Effect.catchAll((error) =>
                  Effect.gen(function* () {
                    available = false
                    lastError = error._tag
                    return { items: [], selfUrl: '' }
                  })
                )
              )
            }
          } else if (source === 'sentinel') {
            // Check Sentinel Hub availability
            if (Option.isNone(sentinelOption)) {
              available = false
              lastError = 'NotConfigured'
            } else {
              yield* sentinelOption.value.search({
                collections: ['sentinel-2-l2a'],
                bbox: [0, 0, 1, 1],
                limit: 1,
              }).pipe(
                Effect.catchAll((error) =>
                  Effect.gen(function* () {
                    available = false
                    lastError = error._tag
                    return { items: [] }
                  })
                )
              )
            }
          } else if (source === 'weather') {
            // Check Open-Meteo availability
            if (Option.isNone(weatherOption)) {
              available = false
              lastError = 'NotConfigured'
            } else {
              yield* weatherOption.value.getForecast({
                latitude: 0,
                longitude: 0,
                current: true,
              }).pipe(
                Effect.catchAll((error) =>
                  Effect.gen(function* () {
                    available = false
                    lastError = error._tag
                    return { latitude: 0, longitude: 0 }
                  })
                )
              )
            }
          }
          // track and feature sources assumed available (local)

          const latencyMs = Date.now() - start

          return {
            source,
            available,
            latencyMs,
            lastError,
            lastChecked: new Date(),
          } satisfies typeof SourceHealthStatus.Type
        }),
    }
  }),
  {
    maxIdleTime: '5 minutes',
  }
)

/**
 * Search entity layer with handlers
 */
export const SearchEntityLayer = SearchEntityHandlers
