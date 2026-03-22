/**
 * SearchClient - AtomRpc.Tag client for ALLINT COP search operations
 *
 * Provides reactive queries and mutations for:
 * - Multi-source search (tracks, features, POI, flights)
 * - Geographic and temporal filtering
 * - Saved search management
 * - Streaming search results
 *
 * @see beads:tmnl-3xbgy SearchClient: AtomRpc.Tag Service
 * @see beads:tmnl-j5pyc ALLINT COP Search System
 * @module
 */

import * as AtomRpc from '@effect-atom/atom/AtomRpc'
import { Rpc, RpcGroup, RpcSerialization, RpcSchema } from '@effect/rpc'
import * as RpcClient from '@effect/rpc/RpcClient'
import * as Socket from '@effect/platform/Socket'
import { Config, Context, Layer, Schema, Duration, Effect } from 'effect'
import {
  // Query & Filter
  SearchId,
  SearchQuery,
  IntelSource,
  // Response & Results
  SearchResponse,
  SearchEvent,
  // External API
  OpenSkyResponse,
  OverpassResponse,
  // Saved Searches
  SavedSearch,
  SearchHistoryEntry,
  // Primitives
  BBox,
  Position,
  // Ingestion schemas
  IngesterNameSchema,
  IngesterStatusSchema,
  OrchestratorStatusSchema,
} from '../schemas'

// =============================================================================
// RPC Definitions
// =============================================================================

/**
 * Search RPC group defining ALLINT COP operations
 *
 * Operations:
 * - search: Execute a full multi-source search
 * - searchNearby: Radius-based search from a point
 * - searchInBounds: Bounding box search
 * - streamSearch: Real-time streaming search results
 * - External API proxies for OpenSky/Overpass
 * - Saved search management
 */
/**
 * Search RPC group - exported for server-side handler creation
 * @internal Use SearchClient for client-side consumption
 */
export class SearchRpcs extends RpcGroup.make(
  // =========================================================================
  // Core Search Operations
  // =========================================================================

  /**
   * Execute a multi-source search with full query options
   * @see ALLINT COP requirement: global, all-event search
   */
  Rpc.make('search', {
    payload: SearchQuery,
    success: SearchResponse
  }),

  /**
   * Search nearby a geographic point
   * Convenience method wrapping search with GeoFilterRadius
   */
  Rpc.make('searchNearby', {
    payload: Schema.Struct({
      center: Position,
      radiusMeters: Schema.Number.pipe(Schema.positive()),
      sources: Schema.optionalWith(Schema.Array(IntelSource), {
        default: () => []
      }),
      limit: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), {
        default: () => 100
      })
    }),
    success: SearchResponse
  }),

  /**
   * Search within a bounding box
   * Convenience method wrapping search with GeoFilterBounds
   */
  Rpc.make('searchInBounds', {
    payload: Schema.Struct({
      bounds: BBox,
      sources: Schema.optionalWith(Schema.Array(IntelSource), {
        default: () => []
      }),
      limit: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), {
        default: () => 100
      })
    }),
    success: SearchResponse
  }),

  /**
   * Stream search results as they arrive from each source
   * Enables progressive rendering of results
   */
  Rpc.make('streamSearch', {
    payload: SearchQuery,
    success: RpcSchema.Stream({
      success: SearchEvent,
      failure: Schema.Never
    })
  }),

  // =========================================================================
  // External API Proxies
  // =========================================================================

  /**
   * Query OpenSky Network for ADS-B flight data
   * Proxied through backend for rate limiting and caching
   */
  Rpc.make('queryOpenSky', {
    payload: Schema.Struct({
      bounds: Schema.optional(BBox),
      icao24: Schema.optionalWith(Schema.Array(Schema.String), {
        default: () => []
      }),
      time: Schema.optional(Schema.Number)
    }),
    success: OpenSkyResponse
  }),

  /**
   * Query Overpass API for OpenStreetMap POI data
   * Proxied through backend for rate limiting
   */
  Rpc.make('queryOverpass', {
    payload: Schema.Struct({
      /** Overpass QL query string */
      query: Schema.String,
      /** Output format (json recommended) */
      format: Schema.optionalWith(
        Schema.Literal('json', 'xml', 'csv'),
        { default: () => 'json' as const }
      ),
      /** Timeout in seconds */
      timeout: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), {
        default: () => 25
      })
    }),
    success: OverpassResponse
  }),

  /**
   * Build an Overpass query from structured parameters
   * Returns the QL string to use with queryOverpass
   */
  Rpc.make('buildOverpassQuery', {
    payload: Schema.Struct({
      bounds: BBox,
      amenities: Schema.optionalWith(Schema.Array(Schema.String), {
        default: () => []
      }),
      tags: Schema.optionalWith(
        Schema.Record({ key: Schema.String, value: Schema.String }),
        { default: () => ({}) }
      )
    }),
    success: Schema.String
  }),

  // =========================================================================
  // Saved Search Management
  // =========================================================================

  /**
   * Save a search query for later use
   */
  Rpc.make('saveSearch', {
    payload: Schema.Struct({
      name: Schema.String,
      query: SearchQuery
    }),
    success: SavedSearch
  }),

  /**
   * List all saved searches
   */
  Rpc.make('listSavedSearches', {
    payload: Schema.Struct({
      limit: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), {
        default: () => 50
      })
    }),
    success: Schema.Array(SavedSearch)
  }),

  /**
   * Delete a saved search
   */
  Rpc.make('deleteSavedSearch', {
    payload: Schema.Struct({ id: SearchId }),
    success: Schema.Boolean
  }),

  /**
   * Execute a saved search by ID
   */
  Rpc.make('executeSavedSearch', {
    payload: Schema.Struct({ id: SearchId }),
    success: SearchResponse
  }),

  // =========================================================================
  // Search History
  // =========================================================================

  /**
   * Get recent search history
   */
  Rpc.make('getSearchHistory', {
    payload: Schema.Struct({
      limit: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), {
        default: () => 20
      })
    }),
    success: Schema.Array(SearchHistoryEntry)
  }),

  /**
   * Clear search history
   */
  Rpc.make('clearSearchHistory', {
    payload: Schema.Struct({}),
    success: Schema.Boolean
  }),

  // =========================================================================
  // Aggregation & Analytics
  // =========================================================================

  /**
   * Get aggregated statistics for search results
   * Useful for heatmaps, density analysis
   */
  Rpc.make('aggregateResults', {
    payload: Schema.Struct({
      query: SearchQuery,
      /** Grid cell size in meters for spatial aggregation */
      cellSize: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), {
        default: () => 1000
      }),
      /** Aggregation type */
      aggregationType: Schema.optionalWith(
        Schema.Literal('count', 'density', 'heatmap'),
        { default: () => 'count' as const }
      )
    }),
    success: Schema.Struct({
      cells: Schema.Array(Schema.Struct({
        bounds: BBox,
        count: Schema.Number,
        weight: Schema.Number.pipe(Schema.between(0, 1))
      })),
      totalCount: Schema.Number
    })
  }),

  // =========================================================================
  // Ingestion Control
  // =========================================================================

  /**
   * Start all enabled data ingesters
   * Begins background polling for flight, POI, weather, and imagery data
   */
  Rpc.make('startIngestion', {
    payload: Schema.Struct({}),
    success: OrchestratorStatusSchema
  }),

  /**
   * Stop all running data ingesters gracefully
   */
  Rpc.make('stopIngestion', {
    payload: Schema.Struct({}),
    success: OrchestratorStatusSchema
  }),

  /**
   * Get the current status of all ingesters
   */
  Rpc.make('getIngestionStatus', {
    payload: Schema.Struct({}),
    success: OrchestratorStatusSchema
  }),

  /**
   * Start a specific ingester by name
   */
  Rpc.make('startIngester', {
    payload: Schema.Struct({
      name: IngesterNameSchema
    }),
    success: IngesterStatusSchema
  }),

  /**
   * Stop a specific ingester by name
   */
  Rpc.make('stopIngester', {
    payload: Schema.Struct({
      name: IngesterNameSchema
    }),
    success: IngesterStatusSchema
  })
) {}

// =============================================================================
// AtomRpc.Tag Client
// =============================================================================

/**
 * SearchClient - Reactive RPC client for ALLINT COP search operations
 *
 * Features:
 * - Automatic query caching with configurable TTL
 * - Reactivity keys for cache invalidation
 * - Stream support for progressive search results
 * - Rate-limited external API proxies
 *
 * @example
 * ```typescript
 * // Nearby search with caching
 * const nearbyAtom = SearchClient.query(
 *   'searchNearby',
 *   { center: [-122.4, 37.8], radiusMeters: 5000 },
 *   { reactivityKeys: ['search', 'nearby'], timeToLive: Duration.seconds(30) }
 * )
 *
 * // Streaming search
 * const streamAtom = SearchClient.stream(
 *   'streamSearch',
 *   searchQuery,
 *   { reactivityKeys: ['search', 'stream'] }
 * )
 *
 * // Save search mutation
 * const saveFn = SearchClient.mutation('saveSearch')
 * await saveFn({
 *   payload: { name: 'Hospital search', query: myQuery },
 *   reactivityKeys: ['savedSearches']
 * })
 * ```
 */
// =============================================================================
// Configuration Service
// =============================================================================

/**
 * Search service configuration.
 * Provides WebSocket URL and other config via Effect Context.
 */
export interface SearchConfig {
  readonly wsUrl: string
  readonly retryTransientErrors: boolean
}

/**
 * SearchConfig service tag.
 * Provide this in your Layer stack to configure the search client.
 */
export class SearchConfigTag extends Context.Tag('geoint/SearchConfig')<SearchConfigTag, SearchConfig>() {}

/**
 * Config layer for SearchConfig.
 * Reads from environment or uses defaults.
 *
 * Environment variables:
 * - GEOINT_SEARCH_WS_URL: WebSocket URL (default: ws://localhost:8081/geoint/search)
 * - GEOINT_SEARCH_RETRY: Whether to retry transient errors (default: true)
 */
export const SearchConfigLive = Layer.effect(
  SearchConfigTag,
  Effect.gen(function* () {
    const wsUrl = yield* Config.string('GEOINT_SEARCH_WS_URL').pipe(
      Config.withDefault('ws://localhost:8081/geoint/search')
    )
    const retryTransientErrors = yield* Config.boolean('GEOINT_SEARCH_RETRY').pipe(
      Config.withDefault(true)
    )
    return { wsUrl, retryTransientErrors }
  })
)

/**
 * Create SearchConfig layer with specific values (for testing/custom setups).
 */
export const makeSearchConfigLayer = (config: SearchConfig) =>
  Layer.succeed(SearchConfigTag, config)

// Default config for browser usage (no Config provider)
const DEFAULT_CONFIG: SearchConfig = {
  wsUrl: 'ws://localhost:8081/geoint/search',
  retryTransientErrors: true
}

export class SearchClient extends AtomRpc.Tag<SearchClient>()('geoint/SearchClient', {
  group: SearchRpcs,
  protocol: RpcClient.layerProtocolSocket({ retryTransientErrors: true }).pipe(
    Layer.provide(RpcSerialization.layerJson),
    // WebSocket endpoint - uses default, can be overridden via SearchConfigLive
    Layer.provide(Socket.layerWebSocket(DEFAULT_CONFIG.wsUrl)),
    Layer.provide(Socket.layerWebSocketConstructorGlobal)
  ),
  spanPrefix: 'geoint-search'
}) {}

// =============================================================================
// Convenience Atoms
// =============================================================================

/**
 * Recent search results within viewport bounds
 * Requires viewportBounds to be provided by the consumer
 */
export const createViewportSearchAtom = (bounds: readonly [number, number, number, number]) =>
  SearchClient.query(
    'searchInBounds',
    { bounds: bounds as [number, number, number, number], limit: 500 },
    {
      reactivityKeys: ['search', 'viewport', bounds.join(',')],
      timeToLive: Duration.seconds(30)
    }
  )

/**
 * OpenSky flight data for a bounding box
 */
export const createFlightDataAtom = (bounds: readonly [number, number, number, number]) =>
  SearchClient.query(
    'queryOpenSky',
    { bounds: bounds as [number, number, number, number] },
    {
      reactivityKeys: ['opensky', bounds.join(',')],
      timeToLive: Duration.seconds(15) // OpenSky updates every ~10s
    }
  )

/**
 * Saved searches list with automatic refresh
 */
export const savedSearchesAtom = SearchClient.query(
  'listSavedSearches',
  { limit: 50 },
  {
    reactivityKeys: ['savedSearches'],
    timeToLive: Duration.minutes(5)
  }
)

/**
 * Search history with automatic refresh
 */
export const searchHistoryAtom = SearchClient.query(
  'getSearchHistory',
  { limit: 20 },
  {
    reactivityKeys: ['searchHistory'],
    timeToLive: Duration.minutes(1)
  }
)

/**
 * Save search mutation with reactivity
 */
export const saveSearchMutation = SearchClient.mutation('saveSearch')

/**
 * Delete saved search mutation
 */
export const deleteSavedSearchMutation = SearchClient.mutation('deleteSavedSearch')

/**
 * Clear history mutation
 */
export const clearHistoryMutation = SearchClient.mutation('clearSearchHistory')

// =============================================================================
// Overpass Query Builders
// =============================================================================

/**
 * Pre-built Overpass query templates for common use cases
 */
export const OVERPASS_TEMPLATES = {
  /**
   * Find hospitals within bounds
   */
  hospitals: (bounds: readonly [number, number, number, number]) =>
    `[out:json][timeout:25];
     (
       node["amenity"="hospital"](${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]});
       way["amenity"="hospital"](${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]});
     );
     out center;`,

  /**
   * Find airports and airstrips
   */
  airports: (bounds: readonly [number, number, number, number]) =>
    `[out:json][timeout:25];
     (
       node["aeroway"~"aerodrome|helipad|airstrip"](${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]});
       way["aeroway"~"aerodrome|helipad|airstrip"](${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]});
     );
     out center;`,

  /**
   * Find military installations
   */
  military: (bounds: readonly [number, number, number, number]) =>
    `[out:json][timeout:25];
     (
       node["military"](${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]});
       way["military"](${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]});
       relation["military"](${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]});
     );
     out center;`,

  /**
   * Find emergency services
   */
  emergency: (bounds: readonly [number, number, number, number]) =>
    `[out:json][timeout:25];
     (
       node["amenity"~"fire_station|police|hospital|clinic"](${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]});
       way["amenity"~"fire_station|police|hospital|clinic"](${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]});
     );
     out center;`,

  /**
   * Find transportation hubs
   */
  transport: (bounds: readonly [number, number, number, number]) =>
    `[out:json][timeout:25];
     (
       node["public_transport"~"station|stop_position"](${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]});
       node["railway"="station"](${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]});
       way["aeroway"="terminal"](${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]});
     );
     out center;`,

  /**
   * Generic amenity search
   */
  amenity: (bounds: readonly [number, number, number, number], amenity: string) =>
    `[out:json][timeout:25];
     (
       node["amenity"="${amenity}"](${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]});
       way["amenity"="${amenity}"](${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]});
     );
     out center;`
} as const
