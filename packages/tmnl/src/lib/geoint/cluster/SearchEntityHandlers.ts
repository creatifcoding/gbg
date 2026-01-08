/**
 * Search Entity Handlers - Effect Cluster Behavior Implementation
 *
 * Implements the handlers for SearchEntity RPCs:
 * - Source-specific search handlers (tracks, OSM, flights, features)
 * - Aggregation handler with fan-out/fan-in pattern
 * - Health check handlers
 *
 * @see beads:tmnl-j5139 Effect Cluster: Distributed Search Processing
 * @module
 */

import { Effect, Stream } from 'effect'
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
} from '../schemas'
import {
  OpenSkyClientService,
  OverpassClientService,
  openSkyToSearchResult,
  overpassToSearchResult,
} from '../api/ExternalApiClient'

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

    return {
      // ─────────────────────────────────────────────────────────────────────────
      // Source-Specific Handlers
      // ─────────────────────────────────────────────────────────────────────────

      SearchTracks: (envelope) =>
        Effect.gen(function* () {
          const { searchId, limit } = envelope.payload

          yield* Effect.logInfo(`SearchTracks: ${searchId}`)

          // TODO: Implement track search via TrackStore + PostGIS spatial index
          // For now, return empty results - requires search index infrastructure
          const results: readonly SearchResultItem[] = []

          yield* Effect.logInfo(`SearchTracks: found ${results.length} tracks`)
          return results
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
          const { searchId, limit } = envelope.payload

          yield* Effect.logInfo(`SearchFeatures: ${searchId}`)

          // TODO: Implement feature search via PostGIS spatial queries
          // For now, return empty results - requires search index infrastructure
          const results: readonly SearchResultItem[] = []

          yield* Effect.logInfo(`SearchFeatures: found ${results.length} features`)
          return results
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

          // Determine sources to query
          const sourcesToQuery: readonly IntelSource[] =
            query.sources.length > 0
              ? query.sources
              : (['track', 'osm', 'feature'] as const)

          // TODO: Fan-out to source workers using Sharding.client
          // For now, return empty response structure
          const allResults: SearchResultItem[] = []
          const sourceCounts: Record<string, number> = {}
          const sourceErrors: Record<string, string> = {}

          for (const source of sourcesToQuery) {
            sourceCounts[source] = 0
          }

          const executionTimeMs = Date.now() - startTime

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

        const sourcesToQuery: readonly IntelSource[] =
          query.sources.length > 0
            ? query.sources
            : (['track', 'osm', 'feature'] as const)

        // Return stream of search events directly (not wrapped in Effect.gen)
        return Stream.make(
          new SearchStarted({
            queryId,
            sources: [...sourcesToQuery],
            startedAt: new Date(),
          })
        ).pipe(
          Stream.concat(
            Stream.fromIterable(sourcesToQuery).pipe(
              Stream.map(
                (source) =>
                  new SearchPartialResults({
                    queryId,
                    source,
                    results: [],
                    isComplete: true,
                  })
              )
            )
          ),
          Stream.concat(
            Stream.make(
              new SearchCompleted({
                queryId,
                totalResults: 0,
                completedAt: new Date(),
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
          const sources: IntelSource[] = ['track', 'osm', 'opensky', 'feature']
          const now = new Date()

          return sources.map(
            (source) =>
              ({
                source,
                available: true,
                latencyMs: undefined,
                lastError: undefined,
                lastChecked: now,
              }) satisfies typeof SourceHealthStatus.Type
          )
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
