/**
 * GeointRepository - Unified Facade for All GEOINT Repositories
 *
 * Provides a single service that aggregates all domain repositories:
 * - FlightRepository: Flight positions and tracks
 * - PoiRepository: OSM elements (POIs, features)
 * - WeatherRepository: Weather observations
 * - ImageryRepository: Satellite imagery metadata
 *
 * This facade simplifies dependency injection and provides cross-domain
 * query capabilities.
 *
 * @module
 */

import { Effect, Layer, Context, Option, Schema } from 'effect'
import { PgClient } from '@effect/sql-pg'
import type { BBox } from '../../schemas'

import {
  FlightRepositoryTag,
  FlightRepositoryLive,
  type FlightRepository,
  type CurrentFlight,
} from './FlightRepository'

import {
  PoiRepositoryTag,
  PoiRepositoryLive,
  type PoiRepository,
  type PoiSearchResult,
} from './PoiRepository'

import {
  WeatherRepositoryTag,
  WeatherRepositoryLive,
  type WeatherRepository,
  type CurrentWeather,
} from './WeatherRepository'

import {
  ImageryRepositoryTag,
  ImageryRepositoryLive,
  type ImageryRepository,
  type ImageryItemRow,
} from './ImageryRepository'

// =============================================================================
// Unified Error Type
// =============================================================================

/**
 * Unified GEOINT repository error
 */
export class GeointRepositoryError extends Schema.TaggedError<GeointRepositoryError>()(
  'GeointRepositoryError',
  {
    domain: Schema.Literal('flight', 'poi', 'weather', 'imagery', 'unified'),
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

// =============================================================================
// Unified Search Types
// =============================================================================

/**
 * Combined search options for multi-domain queries
 */
export interface UnifiedSearchOptions {
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  readonly bounds: BBox
  /** Domains to search */
  readonly domains?: readonly ('flight' | 'poi' | 'weather' | 'imagery')[]
  /** Time filter for time-series data */
  readonly since?: Date
  /** Maximum results per domain */
  readonly limitPerDomain?: number
}

/**
 * Unified search result across all domains
 */
export interface UnifiedSearchResult {
  readonly flights: readonly CurrentFlight[]
  readonly pois: readonly PoiSearchResult[]
  readonly weather: readonly CurrentWeather[]
  readonly imagery: readonly ImageryItemRow[]
}

/**
 * Entity health check result
 */
export interface RepositoryHealth {
  readonly domain: 'flight' | 'poi' | 'weather' | 'imagery'
  readonly status: 'healthy' | 'unhealthy' | 'unknown'
  readonly latencyMs?: number
  readonly error?: string
}

// =============================================================================
// GeointRepository Interface
// =============================================================================

/**
 * Unified GEOINT repository interface
 */
export interface GeointRepository {
  // ---------------------------------------------------------------------------
  // Individual Repositories (for domain-specific operations)
  // ---------------------------------------------------------------------------

  /** Flight repository */
  readonly flight: FlightRepository

  /** POI repository */
  readonly poi: PoiRepository

  /** Weather repository */
  readonly weather: WeatherRepository

  /** Imagery repository */
  readonly imagery: ImageryRepository

  // ---------------------------------------------------------------------------
  // Unified Operations
  // ---------------------------------------------------------------------------

  /**
   * Search all domains within a bounding box
   */
  readonly searchAll: (
    options: UnifiedSearchOptions
  ) => Effect.Effect<UnifiedSearchResult, GeointRepositoryError>

  /**
   * Search nearby across all domains
   */
  readonly searchNearby: (options: {
    readonly longitude: number
    readonly latitude: number
    readonly radiusM: number
    readonly domains?: readonly ('flight' | 'poi' | 'weather' | 'imagery')[]
    readonly limitPerDomain?: number
  }) => Effect.Effect<UnifiedSearchResult, GeointRepositoryError>

  /**
   * Check health of all repositories
   */
  readonly healthCheck: () => Effect.Effect<
    readonly RepositoryHealth[],
    GeointRepositoryError
  >

  /**
   * Get statistics across all domains
   */
  readonly getStats: () => Effect.Effect<
    {
      readonly flights: { count: number; recentCount: number }
      readonly pois: { count: number; expiredCount: number }
      readonly weather: { count: number; locationCount: number }
      readonly imagery: { count: number; providerCounts: Record<string, number> }
    },
    GeointRepositoryError
  >
}

// =============================================================================
// Repository Tag
// =============================================================================

export class GeointRepositoryTag extends Context.Tag('geoint/GeointRepository')<
  GeointRepositoryTag,
  GeointRepository
>() {}

// =============================================================================
// Repository Implementation
// =============================================================================

/**
 * Create GeointRepository from all domain repositories
 */
export const makeGeointRepository = Effect.gen(function* () {
  const flight = yield* FlightRepositoryTag
  const poi = yield* PoiRepositoryTag
  const weather = yield* WeatherRepositoryTag
  const imagery = yield* ImageryRepositoryTag
  const sql = yield* PgClient.PgClient

  const mapDomainError =
    (domain: 'flight' | 'poi' | 'weather' | 'imagery' | 'unified') =>
    (operation: string) =>
    (error: unknown): GeointRepositoryError =>
      new GeointRepositoryError({
        domain,
        operation,
        message: String(error),
        cause: error,
      })

  // ---------------------------------------------------------------------------
  // Unified Operations
  // ---------------------------------------------------------------------------

  const searchAll: GeointRepository['searchAll'] = (options) => {
    const domains = options.domains ?? ['flight', 'poi', 'weather', 'imagery']
    const limit = options.limitPerDomain ?? 50
    const since = options.since ?? new Date(Date.now() - 3600000) // Default: 1 hour

    return Effect.gen(function* () {
      // Run all domain queries in parallel
      const [flightResult, poiResult, weatherResult, imageryResult] =
        yield* Effect.all(
          [
            // Flights
            domains.includes('flight')
              ? flight
                  .findCurrentFlights({
                    bounds: options.bounds,
                    sinceMinutes: Math.ceil(
                      (Date.now() - since.getTime()) / 60000
                    ),
                    limit,
                  })
                  .pipe(Effect.catchAll(() => Effect.succeed([])))
              : Effect.succeed([]),

            // POIs
            domains.includes('poi')
              ? poi
                  .findPois({
                    bounds: options.bounds,
                    limit,
                  })
                  .pipe(Effect.catchAll(() => Effect.succeed([])))
              : Effect.succeed([]),

            // Weather - get unique locations in bounds
            domains.includes('weather')
              ? Effect.gen(function* () {
                  const observations = yield* weather.findObservations({
                    bounds: options.bounds,
                    from: since,
                    limit: limit * 2, // Get more to find unique locations
                  })
                  // Get current weather for unique locations
                  const locationIds = [
                    ...new Set(observations.map((o) => o.location_id)),
                  ].slice(0, limit)
                  const currentWeathers: CurrentWeather[] = []
                  for (const locationId of locationIds) {
                    const current = yield* weather.getCurrentWeather(locationId)
                    if (Option.isSome(current)) {
                      currentWeathers.push(current.value)
                    }
                  }
                  return currentWeathers
                }).pipe(Effect.catchAll(() => Effect.succeed([])))
              : Effect.succeed([]),

            // Imagery
            domains.includes('imagery')
              ? imagery
                  .findItems({
                    bounds: options.bounds,
                    acquiredFrom: since,
                    limit,
                  })
                  .pipe(Effect.catchAll(() => Effect.succeed([])))
              : Effect.succeed([]),
          ],
          { concurrency: 4 }
        )

      return {
        flights: flightResult as CurrentFlight[],
        pois: poiResult as PoiSearchResult[],
        weather: weatherResult as CurrentWeather[],
        imagery: imageryResult as ImageryItemRow[],
      }
    }).pipe(Effect.mapError(mapDomainError('unified')('searchAll')))
  }

  const searchNearby: GeointRepository['searchNearby'] = (options) => {
    const domains = options.domains ?? ['flight', 'poi', 'weather', 'imagery']
    const limit = options.limitPerDomain ?? 10

    return Effect.gen(function* () {
      const [flightResult, poiResult, weatherResult, imageryResult] =
        yield* Effect.all(
          [
            // Flights - use bounds around the point
            domains.includes('flight')
              ? (() => {
                  // Approximate radius in degrees (rough, ~111km per degree)
                  const deltaLat = options.radiusM / 111000
                  const deltaLon =
                    options.radiusM /
                    (111000 * Math.cos((options.latitude * Math.PI) / 180))
                  const bounds: BBox = [
                    options.longitude - deltaLon,
                    options.latitude - deltaLat,
                    options.longitude + deltaLon,
                    options.latitude + deltaLat,
                  ]
                  return flight
                    .findCurrentFlights({
                      bounds,
                      sinceMinutes: 60,
                      limit,
                    })
                    .pipe(Effect.catchAll(() => Effect.succeed([])))
                })()
              : Effect.succeed([]),

            // POIs
            domains.includes('poi')
              ? poi
                  .findNearby({
                    longitude: options.longitude,
                    latitude: options.latitude,
                    radiusM: options.radiusM,
                    limit,
                  })
                  .pipe(Effect.catchAll(() => Effect.succeed([])))
              : Effect.succeed([]),

            // Weather
            domains.includes('weather')
              ? weather
                  .getCurrentWeatherNearby(
                    options.longitude,
                    options.latitude,
                    options.radiusM
                  )
                  .pipe(
                    Effect.map((opt) =>
                      Option.isSome(opt) ? [opt.value] : []
                    ),
                    Effect.catchAll(() => Effect.succeed([]))
                  )
              : Effect.succeed([]),

            // Imagery
            domains.includes('imagery')
              ? imagery
                  .findNearby({
                    longitude: options.longitude,
                    latitude: options.latitude,
                    radiusM: options.radiusM,
                    limit,
                  })
                  .pipe(
                    // Convert ImagerySearchResult to ImageryItemRow for consistency
                    Effect.map((results) =>
                      results.map(
                        (r) =>
                          ({
                            _tag: 'ImageryItemRow',
                            item_id: r.item_id,
                            provider: r.provider,
                            raw: {},
                            collection: r.collection,
                            acquired: r.acquired,
                            published: null,
                            updated: null,
                            cloud_cover: r.cloud_cover,
                            gsd: r.gsd,
                            sun_azimuth: null,
                            sun_elevation: null,
                            centroid_lon: r.centroid_lon,
                            centroid_lat: r.centroid_lat,
                            fetched_at: r.acquired ?? null,
                          }) as unknown as ImageryItemRow
                      )
                    ),
                    Effect.catchAll(() => Effect.succeed([]))
                  )
              : Effect.succeed([]),
          ],
          { concurrency: 4 }
        )

      return {
        flights: flightResult as CurrentFlight[],
        pois: poiResult as PoiSearchResult[],
        weather: weatherResult as CurrentWeather[],
        imagery: imageryResult as ImageryItemRow[],
      }
    }).pipe(Effect.mapError(mapDomainError('unified')('searchNearby')))
  }

  const healthCheck: GeointRepository['healthCheck'] = () =>
    Effect.gen(function* () {
      const checks = yield* Effect.all(
        [
          // Flight health check
          Effect.gen(function* () {
            const start = Date.now()
            yield* flight.findCurrentFlights({ limit: 1 })
            return {
              domain: 'flight' as const,
              status: 'healthy' as const,
              latencyMs: Date.now() - start,
            }
          }).pipe(
            Effect.catchAll((error) =>
              Effect.succeed({
                domain: 'flight' as const,
                status: 'unhealthy' as const,
                error: String(error),
              })
            )
          ),

          // POI health check
          Effect.gen(function* () {
            const start = Date.now()
            yield* poi.countPois()
            return {
              domain: 'poi' as const,
              status: 'healthy' as const,
              latencyMs: Date.now() - start,
            }
          }).pipe(
            Effect.catchAll((error) =>
              Effect.succeed({
                domain: 'poi' as const,
                status: 'unhealthy' as const,
                error: String(error),
              })
            )
          ),

          // Weather health check
          Effect.gen(function* () {
            const start = Date.now()
            yield* weather.countObservations()
            return {
              domain: 'weather' as const,
              status: 'healthy' as const,
              latencyMs: Date.now() - start,
            }
          }).pipe(
            Effect.catchAll((error) =>
              Effect.succeed({
                domain: 'weather' as const,
                status: 'unhealthy' as const,
                error: String(error),
              })
            )
          ),

          // Imagery health check
          Effect.gen(function* () {
            const start = Date.now()
            yield* imagery.countItems()
            return {
              domain: 'imagery' as const,
              status: 'healthy' as const,
              latencyMs: Date.now() - start,
            }
          }).pipe(
            Effect.catchAll((error) =>
              Effect.succeed({
                domain: 'imagery' as const,
                status: 'unhealthy' as const,
                error: String(error),
              })
            )
          ),
        ],
        { concurrency: 4 }
      )

      return checks
    }).pipe(Effect.mapError(mapDomainError('unified')('healthCheck')))

  const getStats: GeointRepository['getStats'] = () =>
    Effect.gen(function* () {
      // Run all stats queries in parallel using raw SQL for efficiency
      const [flightStats, poiStats, weatherStats, imageryStats] =
        yield* Effect.all(
          [
            // Flight stats
            sql<{ count: string; recent_count: string }>`
              SELECT
                COUNT(*)::text AS count,
                COUNT(*) FILTER (WHERE time > NOW() - INTERVAL '1 hour')::text AS recent_count
              FROM raw.flight_positions
            `.pipe(
              Effect.map((rows) => ({
                count: parseInt(rows[0]?.count ?? '0', 10),
                recentCount: parseInt(rows[0]?.recent_count ?? '0', 10),
              })),
              Effect.catchAll(() =>
                Effect.succeed({ count: 0, recentCount: 0 })
              )
            ),

            // POI stats
            sql<{ count: string; expired_count: string }>`
              SELECT
                COUNT(*)::text AS count,
                COUNT(*) FILTER (WHERE expires_at < NOW())::text AS expired_count
              FROM raw.osm_elements
            `.pipe(
              Effect.map((rows) => ({
                count: parseInt(rows[0]?.count ?? '0', 10),
                expiredCount: parseInt(rows[0]?.expired_count ?? '0', 10),
              })),
              Effect.catchAll(() =>
                Effect.succeed({ count: 0, expiredCount: 0 })
              )
            ),

            // Weather stats
            sql<{ count: string; location_count: string }>`
              SELECT
                COUNT(*)::text AS count,
                COUNT(DISTINCT location_id)::text AS location_count
              FROM raw.weather_observations
            `.pipe(
              Effect.map((rows) => ({
                count: parseInt(rows[0]?.count ?? '0', 10),
                locationCount: parseInt(rows[0]?.location_count ?? '0', 10),
              })),
              Effect.catchAll(() =>
                Effect.succeed({ count: 0, locationCount: 0 })
              )
            ),

            // Imagery stats
            sql<{ count: string; provider: string; provider_count: string }>`
              SELECT
                (SELECT COUNT(*)::text FROM raw.imagery_items) AS count,
                provider,
                COUNT(*)::text AS provider_count
              FROM raw.imagery_items
              GROUP BY provider
            `.pipe(
              Effect.map((rows) => ({
                count: parseInt(rows[0]?.count ?? '0', 10),
                providerCounts: rows.reduce(
                  (acc, row) => {
                    acc[row.provider] = parseInt(row.provider_count, 10)
                    return acc
                  },
                  {} as Record<string, number>
                ),
              })),
              Effect.catchAll(() =>
                Effect.succeed({ count: 0, providerCounts: {} })
              )
            ),
          ],
          { concurrency: 4 }
        )

      return {
        flights: flightStats,
        pois: poiStats,
        weather: weatherStats,
        imagery: imageryStats,
      }
    }).pipe(Effect.mapError(mapDomainError('unified')('getStats')))

  // ---------------------------------------------------------------------------
  // Return Repository
  // ---------------------------------------------------------------------------

  return {
    flight,
    poi,
    weather,
    imagery,
    searchAll,
    searchNearby,
    healthCheck,
    getStats,
  } satisfies GeointRepository
})

// =============================================================================
// Repository Layer
// =============================================================================

/**
 * Combined layer for all domain repositories
 * Requires PgClient.PgClient
 */
export const AllRepositoriesLive = Layer.mergeAll(
  FlightRepositoryLive,
  PoiRepositoryLive,
  WeatherRepositoryLive,
  ImageryRepositoryLive
)

/**
 * Live layer for GeointRepository
 * Requires PgClient.PgClient
 */
export const GeointRepositoryLive = Layer.effect(
  GeointRepositoryTag,
  makeGeointRepository
).pipe(Layer.provide(AllRepositoriesLive))
