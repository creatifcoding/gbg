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

import { Effect, Stream, Option, pipe, DateTime } from 'effect'
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
  PoiId,
  PoiCategory,
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
  mapAircraftCategory,
} from '../api/ExternalApiClient'
import {
  TrackPositionRepositoryTag,
  FeatureRepositoryTag,
  FlightRepositoryTag,
  PoiRepositoryTag,
  WeatherRepositoryTag,
  ImageryRepositoryTag,
  type TrackPositionSearchOptions,
  type FeatureSearchOptions,
  type CurrentFlightSearchOptions,
  type CurrentFlight,
  type PoiSearchOptions,
  type PoiSearchResult,
  type ImagerySearchOptions,
  type ImageryItemRow,
  type ImageryProvider,
  type CurrentWeather,
  type WeatherSearchOptions,
  type WeatherObservationRow,
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
    const flightRepoOption = yield* Effect.serviceOption(FlightRepositoryTag)
    const poiRepoOption = yield* Effect.serviceOption(PoiRepositoryTag)
    const weatherRepoOption = yield* Effect.serviceOption(WeatherRepositoryTag)
    const imageryRepoOption = yield* Effect.serviceOption(ImageryRepositoryTag)

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
    // Search result type with error tracking (Effect-idiomatic pattern)
    // ─────────────────────────────────────────────────────────────────────────
    interface SearchWithError<T> {
      readonly results: T[]
      readonly error: Option.Option<string>
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Flight search parameters - discriminated union for type safety
    // ─────────────────────────────────────────────────────────────────────────
    type FlightSearchParams =
      | { readonly _tag: 'Spatial'; readonly bounds: BBox; readonly limit: number }
      | { readonly _tag: 'ByIcao24'; readonly icao24s: readonly string[]; readonly limit: number }
      | { readonly _tag: 'Combined'; readonly bounds: BBox; readonly icao24s: readonly string[]; readonly limit: number }

    // ─────────────────────────────────────────────────────────────────────────
    // Weather search parameters - discriminated union for type safety
    // ─────────────────────────────────────────────────────────────────────────
    type WeatherSearchParams =
      | { readonly _tag: 'Spatial'; readonly bounds: BBox; readonly limit: number }
      | { readonly _tag: 'ByLocation'; readonly locationId: string; readonly limit: number }

    // ─────────────────────────────────────────────────────────────────────────
    // Transform ImageryItemRow to SearchResultImagery (pure function)
    // ─────────────────────────────────────────────────────────────────────────
    const imageryRowToSearchResult = (row: ImageryItemRow): SearchResultImagery => {
      const acquiredDate = row.acquired ? DateTime.toDate(row.acquired) : new Date()
      return new SearchResultImagery({
        id: `imagery-${row.provider}-${row.item_id}` as SearchResultId,
        source: row.provider === 'planet' ? 'planet' : 'sentinel',
        score: 1.0,
        retrievedAt: DateTime.toDate(row.fetched_at),
        itemId: row.item_id,
        provider: row.provider as 'planet' | 'sentinel',
        collection: row.collection ?? 'unknown',
        acquired: acquiredDate,
        cloudCover: row.cloud_cover ?? undefined,
        gsd: row.gsd ?? undefined,
        position: [row.centroid_lon ?? 0, row.centroid_lat ?? 0],
        thumbnailUrl: undefined, // Repository doesn't store thumbnails
      })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Transform CurrentFlight to SearchResultFlight (pure function)
    // ─────────────────────────────────────────────────────────────────────────
    const currentFlightToSearchResult = (flight: CurrentFlight): SearchResultFlight => {
      const lastSeenDate = DateTime.toDate(flight.last_seen)
      return new SearchResultFlight({
        id: `flight-${flight.icao24}` as SearchResultId,
        source: 'opensky',
        score: 1.0,
        retrievedAt: lastSeenDate,
        icao24: flight.icao24 as SearchResultFlight['icao24'],
        callsign: flight.callsign ?? '',
        position: [flight.longitude, flight.latitude, flight.altitude_m ?? 0],
        velocity: flight.velocity_mps ?? 0,
        heading: flight.heading_deg ?? 0,
        verticalRate: flight.vertical_rate ?? 0,
        onGround: flight.on_ground ?? false,
        category: mapAircraftCategory(parseInt(flight.category ?? '0', 10)),
        originCountry: 'Unknown',
        lastContact: lastSeenDate,
      })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Transform CurrentWeather to SearchResultWeather (pure function)
    // ─────────────────────────────────────────────────────────────────────────
    const currentWeatherToSearchResult = (weather: CurrentWeather): SearchResultWeather => {
      const lastUpdatedDate = DateTime.toDate(weather.last_updated)
      return new SearchResultWeather({
        id: `weather-${weather.location_id}` as SearchResultId,
        source: 'weather',
        score: 1.0,
        retrievedAt: lastUpdatedDate,
        locationName: `Weather at ${weather.latitude.toFixed(2)}, ${weather.longitude.toFixed(2)}`,
        position: [weather.longitude, weather.latitude],
        temperature: weather.temperature ?? 0,
        feelsLike: weather.feels_like ?? undefined,
        humidity: weather.humidity ?? undefined,
        weatherCode: weather.weather_code ?? undefined,
        weatherDescription: weather.weather_desc ?? undefined,
        windSpeed: weather.wind_speed ?? undefined,
        windDirection: weather.wind_dir ?? undefined,
        cloudCover: weather.cloud_cover ?? undefined,
        pressure: weather.pressure ?? undefined,
        forecastTime: lastUpdatedDate,
        hasHourlyForecast: false,
        hasDailyForecast: false,
      })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POI search parameters - discriminated union for type safety
    // ─────────────────────────────────────────────────────────────────────────
    type PoiSearchParams =
      | { readonly _tag: 'Spatial'; readonly bounds: BBox; readonly amenities: readonly string[]; readonly limit: number }
      | { readonly _tag: 'ByName'; readonly namePattern: string; readonly limit: number }
      | { readonly _tag: 'Combined'; readonly bounds: BBox; readonly amenities: readonly string[]; readonly namePattern: string; readonly limit: number }

    // ─────────────────────────────────────────────────────────────────────────
    // Transform PoiSearchResult to SearchResultPoi (pure function)
    // ─────────────────────────────────────────────────────────────────────────
    const poiSearchResultToSearchResult = (poi: PoiSearchResult): SearchResultPoi => {
      // Determine category from which OSM tag field is set
      const category = poi.amenity
        ? ('amenity' as const)
        : poi.shop
          ? ('shop' as const)
          : poi.leisure
            ? ('leisure' as const)
            : poi.tourism
              ? ('tourism' as const)
              : ('building' as const)

      return new SearchResultPoi({
        id: `poi-${poi.osm_type}-${poi.osm_id}` as SearchResultId,
        source: 'osm',
        score: 1.0,
        retrievedAt: new Date(),
        poiId: `osm-${poi.osm_type}-${poi.osm_id}` as PoiId,
        position: [poi.longitude, poi.latitude],
        name: poi.name ?? 'Unknown',
        category,
        tags: poi.tags as Record<string, string>,
      })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: Search POIs from PoiRepository (repo-first pattern)
    // Falls back to Overpass API on cache miss. Requires validated params.
    // ─────────────────────────────────────────────────────────────────────────
    const searchPoisFromRepo = (
      params: PoiSearchParams
    ): Effect.Effect<SearchWithError<SearchResultPoi>, never> =>
      Effect.gen(function* () {
        const { limit } = params
        const bounds = params._tag === 'ByName' ? undefined : params.bounds
        const amenities = params._tag === 'ByName' ? [] : params.amenities
        const namePattern = params._tag === 'Spatial' ? undefined : params.namePattern

        // Try repository first (if available)
        if (Option.isSome(poiRepoOption)) {
          const poiRepo = poiRepoOption.value
          const searchOptions: PoiSearchOptions = {
            bounds,
            amenity: amenities.length > 0 ? amenities : undefined,
            namePattern,
            onlyFresh: true,
            limit,
          }

          const repoResults = yield* poiRepo.findPois(searchOptions).pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                yield* Effect.logWarning(`PoiRepository error: ${error._tag}`)
                return [] as PoiSearchResult[]
              })
            )
          )

          if (repoResults.length > 0) {
            yield* Effect.logDebug(`POI repo hit: ${repoResults.length} POIs`)
            return {
              results: repoResults.map(poiSearchResultToSearchResult).slice(0, limit),
              error: Option.none(),
            }
          }
          yield* Effect.logDebug('POI repo miss, falling back to Overpass API')
        }

        // Fallback to Overpass API
        if (!bounds) {
          // Name-only search not supported via Overpass without bounds
          return { results: [], error: Option.none() }
        }

        const apiResult = yield* overpass.query(
          overpass.buildQuery({
            bounds: bounds as readonly [number, number, number, number],
            amenities: [...amenities],
          })
        ).pipe(
          Effect.map((response) => ({
            response,
            error: Option.none<string>(),
          })),
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* Effect.logWarning(`Overpass API error: ${error._tag}`)
              return {
                response: { elements: [] as never[], version: 0, generator: '', osm3s: { timestamp_osm_base: '', copyright: '' } },
                error: Option.some(error._tag),
              }
            })
          )
        )

        const results = apiResult.response.elements
          .map(overpassToSearchResult)
          .filter((r): r is SearchResultPoi => r !== null)
          .slice(0, limit)

        yield* Effect.logDebug(`Overpass API: ${results.length} POIs`)
        return { results, error: apiResult.error }
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: Search flights from FlightRepository (repo-first pattern)
    // Falls back to OpenSky API on cache miss. Requires validated params.
    // ─────────────────────────────────────────────────────────────────────────
    const searchFlightsFromRepo = (
      params: FlightSearchParams
    ): Effect.Effect<SearchWithError<SearchResultFlight>, never> =>
      Effect.gen(function* () {
        const { limit } = params
        const bounds = params._tag === 'ByIcao24' ? undefined : params.bounds
        const icao24s = params._tag === 'Spatial' ? [] : params.icao24s

        // Try repository first (if available and spatial search)
        if (Option.isSome(flightRepoOption) && bounds) {
          const flightRepo = flightRepoOption.value
          const searchOptions: CurrentFlightSearchOptions = {
            bounds,
            icao24s: icao24s.length > 0 ? icao24s : undefined,
            sinceMinutes: 5,
            limit,
          }

          const repoResults = yield* flightRepo.findCurrentFlights(searchOptions).pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                yield* Effect.logWarning(`FlightRepository error: ${error._tag}`)
                return [] as CurrentFlight[]
              })
            )
          )

          if (repoResults.length > 0) {
            yield* Effect.logDebug(`Flight repo hit: ${repoResults.length} flights`)
            return {
              results: repoResults.map(currentFlightToSearchResult).slice(0, limit),
              error: Option.none(),
            }
          }
          yield* Effect.logDebug('Flight repo miss, falling back to API')
        }

        // Fallback to OpenSky API
        if (!bounds) {
          // icao24-only search not supported via API without bounds
          return { results: [], error: Option.none() }
        }

        const apiResult = yield* opensky.getStates({
          bounds: bounds as readonly [number, number, number, number],
          icao24: [...icao24s],
        }).pipe(
          Effect.map((response) => ({
            response,
            error: Option.none<string>(),
          })),
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* Effect.logWarning(`OpenSky API error: ${error._tag}`)
              return {
                response: { time: Date.now(), states: null },
                error: Option.some(error._tag),
              }
            })
          )
        )

        const results = (apiResult.response.states ?? [])
          .map(openSkyToSearchResult)
          .filter((r): r is SearchResultFlight => r !== null)
          .slice(0, limit)

        yield* Effect.logDebug(`OpenSky API: ${results.length} flights`)
        return { results, error: apiResult.error }
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: Search weather from WeatherRepository (repo-first pattern)
    // Falls back to Open-Meteo API on cache miss. Requires validated params.
    // ─────────────────────────────────────────────────────────────────────────
    const searchWeatherFromRepo = (
      params: WeatherSearchParams
    ): Effect.Effect<SearchWithError<SearchResultWeather>, never> =>
      Effect.gen(function* () {
        const { limit } = params
        const bounds = params._tag === 'ByLocation' ? undefined : params.bounds

        // Try repository first (if available and spatial search)
        if (Option.isSome(weatherRepoOption) && bounds) {
          const weatherRepo = weatherRepoOption.value
          const searchOptions: WeatherSearchOptions = {
            bounds,
            limit,
          }

          const repoResults = yield* weatherRepo.findObservations(searchOptions).pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                yield* Effect.logWarning(`WeatherRepository error: ${error._tag}`)
                return [] as readonly WeatherObservationRow[]
              })
            )
          )

          if (repoResults.length > 0) {
            yield* Effect.logDebug(`Weather repo hit: ${repoResults.length} observations`)
            // Convert WeatherObservationRow to CurrentWeather-like shape for the transformer
            const results = repoResults.map((row): SearchResultWeather => {
              const lastUpdatedDate = DateTime.toDate(row.time)
              return new SearchResultWeather({
                id: `weather-${row.location_id}` as SearchResultId,
                source: 'weather',
                score: 1.0,
                retrievedAt: lastUpdatedDate,
                locationName: `Weather at ${row.latitude.toFixed(2)}, ${row.longitude.toFixed(2)}`,
                position: [row.longitude, row.latitude],
                temperature: row.temperature ?? 0,
                feelsLike: row.feels_like ?? undefined,
                humidity: row.humidity ?? undefined,
                weatherCode: row.weather_code ?? undefined,
                weatherDescription: row.weather_desc ?? undefined,
                windSpeed: row.wind_speed ?? undefined,
                windDirection: row.wind_dir ?? undefined,
                cloudCover: row.cloud_cover ?? undefined,
                pressure: row.pressure ?? undefined,
                forecastTime: lastUpdatedDate,
                hasHourlyForecast: false,
                hasDailyForecast: false,
              })
            }).slice(0, limit)
            return {
              results,
              error: Option.none(),
            }
          }
          yield* Effect.logDebug('Weather repo miss, falling back to API')
        }

        // Fallback to Open-Meteo API
        if (Option.isNone(weatherOption) || !bounds) {
          return { results: [], error: Option.none() }
        }

        const weather = weatherOption.value
        // Get center of bounds
        const [minLon, minLat, maxLon, maxLat] = bounds
        const centerLat = (minLat + maxLat) / 2
        const centerLon = (minLon + maxLon) / 2

        const apiResult = yield* weather.getForecast({
          latitude: centerLat,
          longitude: centerLon,
          current: true,
          hourly: true,
          daily: true,
          forecastDays: 3,
          timezone: 'auto',
        }).pipe(
          Effect.map((forecast) => ({
            forecast,
            error: Option.none<string>(),
          })),
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* Effect.logWarning(`Open-Meteo API error: ${error._tag}`)
              return {
                forecast: null as null,
                error: Option.some(error._tag),
              }
            })
          )
        )

        if (!apiResult.forecast) {
          return { results: [], error: apiResult.error }
        }

        const result = weatherForecastToSearchResult(
          apiResult.forecast,
          `Weather at ${centerLat.toFixed(2)}, ${centerLon.toFixed(2)}`
        )
        const results = result ? [result] : []

        yield* Effect.logDebug(`Open-Meteo API: ${results.length} forecasts`)
        return { results, error: apiResult.error }
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Imagery search parameters - discriminated union for type safety
    // ─────────────────────────────────────────────────────────────────────────
    type ImagerySearchParams =
      | { readonly _tag: 'Spatial'; readonly bounds: BBox; readonly provider: ImageryProvider | 'both'; readonly limit: number }
      | { readonly _tag: 'ByProvider'; readonly provider: ImageryProvider; readonly limit: number }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: Search imagery from ImageryRepository (repo-first pattern)
    // Falls back to Planet Labs / Sentinel Hub APIs on cache miss.
    // ─────────────────────────────────────────────────────────────────────────
    const searchImageryFromRepo = (
      params: ImagerySearchParams
    ): Effect.Effect<SearchWithError<SearchResultImagery>, never> =>
      Effect.gen(function* () {
        const { limit } = params
        const bounds = params._tag === 'Spatial' ? params.bounds : undefined
        const provider = params.provider

        // Try repository first (if available and spatial search)
        if (Option.isSome(imageryRepoOption) && bounds) {
          const imageryRepo = imageryRepoOption.value

          // Build search options - filter by provider unless 'both'
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          const searchOptions: ImagerySearchOptions = {
            bounds,
            provider: provider === 'both' ? undefined : provider as ImageryProvider,
            acquiredFrom: thirtyDaysAgo,
            maxCloudCover: 30, // Consistent with API fallback
            limit,
          }

          const repoResults = yield* imageryRepo.findItems(searchOptions).pipe(
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                yield* Effect.logWarning(`ImageryRepository error: ${error._tag}`)
                return [] as readonly ImageryItemRow[]
              })
            )
          )

          if (repoResults.length > 0) {
            yield* Effect.logDebug(`Imagery repo hit: ${repoResults.length} items (provider: ${provider})`)
            return {
              results: repoResults.map(imageryRowToSearchResult).slice(0, limit),
              error: Option.none(),
            }
          }
          yield* Effect.logDebug(`Imagery repo miss for provider ${provider}, falling back to API`)
        }

        // Fallback to external APIs
        if (!bounds) {
          // Non-spatial search not supported via API
          return { results: [], error: Option.none() }
        }

        // Determine which APIs to call based on provider
        const shouldCallPlanet = provider === 'planet' || provider === 'both'
        const shouldCallSentinel = provider === 'sentinel' || provider === 'both'

        const allResults: SearchResultImagery[] = []
        let apiError: Option.Option<string> = Option.none()

        // Planet Labs API fallback
        if (shouldCallPlanet && Option.isSome(planetOption)) {
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

          const planetResult = yield* planet.quickSearch({
            itemTypes: ['PSScene'],
            geometry: {
              type: 'Polygon',
              coordinates: [polygon],
            },
            acquiredGte: thirtyDaysAgo.toISOString(),
            acquiredLte: now.toISOString(),
            maxCloudCover: 0.3,
            limit: provider === 'both' ? Math.ceil(limit / 2) : limit,
          }).pipe(
            Effect.map((response) => ({
              items: response.items
                .map(planetItemToImageryResult)
                .filter((r): r is SearchResultImagery => r !== null),
              error: Option.none<string>(),
            })),
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                yield* Effect.logWarning(`Planet API error: ${error._tag}`)
                return { items: [] as SearchResultImagery[], error: Option.some(error._tag) }
              })
            )
          )

          allResults.push(...planetResult.items)
          if (Option.isSome(planetResult.error)) {
            apiError = planetResult.error
          }
          yield* Effect.logDebug(`Planet API: ${planetResult.items.length} items`)
        }

        // Sentinel Hub API fallback
        if (shouldCallSentinel && Option.isSome(sentinelOption)) {
          const sentinel = sentinelOption.value
          const [minLon, minLat, maxLon, maxLat] = bounds

          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          const now = new Date()

          const sentinelResult = yield* sentinel.search({
            collections: ['sentinel-2-l2a'],
            bbox: [minLon, minLat, maxLon, maxLat],
            datetimeGte: thirtyDaysAgo.toISOString(),
            datetimeLte: now.toISOString(),
            maxCloudCover: 30,
            limit: provider === 'both' ? Math.ceil(limit / 2) : limit,
          }).pipe(
            Effect.map((response) => ({
              items: response.items
                .map(sentinelItemToImageryResult)
                .filter((r): r is SearchResultImagery => r !== null),
              error: Option.none<string>(),
            })),
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                yield* Effect.logWarning(`Sentinel API error: ${error._tag}`)
                return { items: [] as SearchResultImagery[], error: Option.some(error._tag) }
              })
            )
          )

          allResults.push(...sentinelResult.items)
          if (Option.isSome(sentinelResult.error) && Option.isNone(apiError)) {
            apiError = sentinelResult.error
          }
          yield* Effect.logDebug(`Sentinel API: ${sentinelResult.items.length} items`)
        }

        return { results: allResults.slice(0, limit), error: apiError }
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: Get weather for viewport center (legacy wrapper for searchWeatherFromRepo)
    // ─────────────────────────────────────────────────────────────────────────
    const searchWeather = (
      bounds: BBox | undefined,
      limit: number
    ): Effect.Effect<SearchResultWeather[], never> => {
      if (!bounds) return Effect.succeed([])
      const params: WeatherSearchParams = { _tag: 'Spatial', bounds, limit }
      return searchWeatherFromRepo(params).pipe(
        Effect.map(({ results }) => results)
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
          const { searchId, bounds, amenities, limit: rawLimit } = envelope.payload
          const limit = rawLimit ?? 100

          yield* Effect.logInfo(`SearchOsm: ${searchId}`)

          // Construct typed search params at the boundary
          const params: PoiSearchParams = bounds
            ? { _tag: 'Spatial', bounds, amenities: amenities ?? [], limit }
            : { _tag: 'Spatial', bounds: [-180, -90, 180, 90] as BBox, amenities: amenities ?? [], limit } // Fallback: global search

          const { results } = yield* searchPoisFromRepo(params)

          yield* Effect.logInfo(`SearchOsm: found ${results.length} POIs`)
          return results as readonly SearchResultItem[]
        }),

      SearchFlights: (envelope) =>
        Effect.gen(function* () {
          const { searchId, bounds, icao24, limit: rawLimit } = envelope.payload
          const limit = rawLimit ?? 100

          yield* Effect.logInfo(`SearchFlights: ${searchId}`)

          // Construct typed search params at the boundary
          const params: FlightSearchParams = bounds
            ? icao24 && icao24.length > 0
              ? { _tag: 'Combined', bounds, icao24s: icao24, limit }
              : { _tag: 'Spatial', bounds, limit }
            : icao24 && icao24.length > 0
              ? { _tag: 'ByIcao24', icao24s: icao24, limit }
              : { _tag: 'Spatial', bounds: [-180, -90, 180, 90] as BBox, limit } // Fallback: global search

          const { results } = yield* searchFlightsFromRepo(params)

          yield* Effect.logInfo(`SearchFlights: found ${results.length} flights`)
          return results as readonly SearchResultItem[]
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
                case 'osm': {
                  // Construct typed params at boundary - require bounds for spatial search
                  if (!bounds) return Effect.succeed({ source, results: [] })
                  const poiParams: PoiSearchParams = { _tag: 'Spatial', bounds, amenities: [], limit }
                  return searchPoisFromRepo(poiParams).pipe(
                    Effect.map(({ results, error }) => {
                      // Record error if present (Effect-idiomatic pattern)
                      if (Option.isSome(error)) {
                        sourceErrors['osm'] = error.value
                      }
                      return { source, results }
                    })
                  )
                }
                case 'opensky': {
                  // Construct typed params at boundary - require bounds for spatial search
                  if (!bounds) return Effect.succeed({ source, results: [] })
                  const flightParams: FlightSearchParams = { _tag: 'Spatial', bounds, limit }
                  return searchFlightsFromRepo(flightParams).pipe(
                    Effect.map(({ results, error }) => {
                      // Record error if present (Effect-idiomatic pattern)
                      if (Option.isSome(error)) {
                        sourceErrors['opensky'] = error.value
                      }
                      return { source, results }
                    })
                  )
                }
                case 'planet': {
                  // Construct typed params at boundary - require bounds for spatial search
                  if (!bounds) return Effect.succeed({ source, results: [] })
                  const planetParams: ImagerySearchParams = { _tag: 'Spatial', bounds, provider: 'planet', limit }
                  return searchImageryFromRepo(planetParams).pipe(
                    Effect.map(({ results, error }) => {
                      if (Option.isSome(error)) {
                        sourceErrors['planet'] = error.value
                      }
                      return { source, results }
                    })
                  )
                }
                case 'sentinel': {
                  // Construct typed params at boundary - require bounds for spatial search
                  if (!bounds) return Effect.succeed({ source, results: [] })
                  const sentinelParams: ImagerySearchParams = { _tag: 'Spatial', bounds, provider: 'sentinel', limit }
                  return searchImageryFromRepo(sentinelParams).pipe(
                    Effect.map(({ results, error }) => {
                      if (Option.isSome(error)) {
                        sourceErrors['sentinel'] = error.value
                      }
                      return { source, results }
                    })
                  )
                }
                case 'weather': {
                  // Construct typed params at boundary - require bounds for spatial search
                  if (!bounds) return Effect.succeed({ source, results: [] })
                  const weatherParams: WeatherSearchParams = { _tag: 'Spatial', bounds, limit }
                  return searchWeatherFromRepo(weatherParams).pipe(
                    Effect.map(({ results, error }) => {
                      // Record error if present (Effect-idiomatic pattern)
                      if (Option.isSome(error)) {
                        sourceErrors['weather'] = error.value
                      }
                      return { source, results }
                    })
                  )
                }
                default:
                  return Effect.succeed({ source, results: [] })
              }
            }
            return makeSourceEffect()
          })

          // Execute source queries with bounded concurrency (max 3 parallel API calls)
          const sourceResults = yield* Effect.all(sourceEffects, { concurrency: 3 })

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
                // Construct typed params at boundary
                if (bounds) {
                  const poiParams: PoiSearchParams = { _tag: 'Spatial', bounds, amenities: [], limit }
                  const poiResult = yield* searchPoisFromRepo(poiParams)
                  results = poiResult.results
                }
                break
              case 'opensky':
                // Construct typed params at boundary
                if (bounds) {
                  const flightParams: FlightSearchParams = { _tag: 'Spatial', bounds, limit }
                  const flightResult = yield* searchFlightsFromRepo(flightParams)
                  results = flightResult.results
                }
                break
              case 'planet':
                // Construct typed params at boundary
                if (bounds) {
                  const planetParams: ImagerySearchParams = { _tag: 'Spatial', bounds, provider: 'planet', limit }
                  const imageryResult = yield* searchImageryFromRepo(planetParams)
                  results = imageryResult.results
                }
                break
              case 'sentinel':
                // Construct typed params at boundary
                if (bounds) {
                  const sentinelParams: ImagerySearchParams = { _tag: 'Spatial', bounds, provider: 'sentinel', limit }
                  const imageryResult = yield* searchImageryFromRepo(sentinelParams)
                  results = imageryResult.results
                }
                break
              case 'weather':
                // Construct typed params at boundary
                if (bounds) {
                  const weatherParams: WeatherSearchParams = { _tag: 'Spatial', bounds, limit }
                  const weatherResult = yield* searchWeatherFromRepo(weatherParams)
                  results = weatherResult.results
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
