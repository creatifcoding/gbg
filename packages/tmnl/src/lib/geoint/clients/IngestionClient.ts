/**
 * IngestionClient - AtomRpc.Tag client for on-demand flight ingestion
 *
 * Provides reactive RPC-triggered ingestion for specific entities:
 * - ingestFlightByIcao: Fetch and persist flight data by ICAO24 hex code
 * - ingestFlightsByRegion: Fetch and persist flights in a bounding box
 * - Orchestrator control: start/stop/status for background ingesters
 *
 * This enables browser testbeds to trigger ingestion through the RPC layer,
 * completing the vertical slice:
 * Browser → AtomRpc → Handler → External API → PostgreSQL → DurableStreams → Electric → Atoms → UI
 *
 * @see beads:tmnl-vertical-slice ECS Vertical Slice Integration
 * @module
 */

import * as AtomRpc from '@effect-atom/atom/AtomRpc'
import { Rpc, RpcGroup, RpcSerialization } from '@effect/rpc'
import * as RpcClient from '@effect/rpc/RpcClient'
import * as Socket from '@effect/platform/Socket'
import { Context, Layer, Schema, Duration, Effect, Config } from 'effect'
import { FlightSource } from '../schemas/flight-events'

// =============================================================================
// Error Types
// =============================================================================

/**
 * Ingestion operation error
 */
export class IngestionError extends Schema.TaggedError<IngestionError>()(
  'IngestionError',
  {
    operation: Schema.String,
    source: Schema.optional(FlightSource),
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

/**
 * Flight not found error
 */
export class FlightNotFoundError extends Schema.TaggedError<FlightNotFoundError>()(
  'FlightNotFoundError',
  {
    icao24: Schema.String,
    source: FlightSource,
    message: Schema.String,
  }
) {}

// =============================================================================
// Result Schemas
// =============================================================================

/**
 * Result of a single flight ingestion operation
 */
export const FlightIngestionResult = Schema.Struct({
  icao24: Schema.String,
  source: FlightSource,
  positionsIngested: Schema.Number,
  streamEventsPublished: Schema.Number,
  latencyMs: Schema.Number,
  position: Schema.optional(Schema.Tuple(Schema.Number, Schema.Number, Schema.Number)),
  callsign: Schema.optional(Schema.String),
  heading: Schema.optional(Schema.Number),
  speed: Schema.optional(Schema.Number),
})
export type FlightIngestionResult = typeof FlightIngestionResult.Type

/**
 * Result of a region ingestion operation
 */
export const RegionIngestionResult = Schema.Struct({
  region: Schema.String,
  source: FlightSource,
  flightsIngested: Schema.Number,
  positionsIngested: Schema.Number,
  streamEventsPublished: Schema.Number,
  latencyMs: Schema.Number,
})
export type RegionIngestionResult = typeof RegionIngestionResult.Type

/**
 * POI source type
 */
export const PoiSource = Schema.Literal('overpass')
export type PoiSource = typeof PoiSource.Type

/**
 * Result of POI ingestion operation
 */
export const PoiIngestionResult = Schema.Struct({
  region: Schema.String,
  source: PoiSource,
  poisIngested: Schema.Number,
  streamEventsPublished: Schema.Number,
  latencyMs: Schema.Number,
})
export type PoiIngestionResult = typeof PoiIngestionResult.Type

/**
 * Weather source type
 */
export const WeatherSource = Schema.Literal('openmeteo')
export type WeatherSource = typeof WeatherSource.Type

/**
 * Result of weather ingestion operation
 */
export const WeatherIngestionResult = Schema.Struct({
  grid: Schema.String,
  source: WeatherSource,
  observationsIngested: Schema.Number,
  pointsQueried: Schema.Number,
  streamEventsPublished: Schema.Number,
  latencyMs: Schema.Number,
})
export type WeatherIngestionResult = typeof WeatherIngestionResult.Type

/**
 * Imagery provider type
 */
export const ImageryProvider = Schema.Literal('planet', 'sentinel')
export type ImageryProvider = typeof ImageryProvider.Type

/**
 * Result of imagery ingestion operation
 */
export const ImageryIngestionResult = Schema.Struct({
  region: Schema.String,
  provider: ImageryProvider,
  itemsIngested: Schema.Number,
  streamEventsPublished: Schema.Number,
  latencyMs: Schema.Number,
})
export type ImageryIngestionResult = typeof ImageryIngestionResult.Type

/**
 * Individual ingester status
 */
export const IngesterStatus = Schema.Struct({
  name: Schema.String,
  running: Schema.Boolean,
  lastPollAt: Schema.optional(Schema.DateFromString),
  recordsIngested: Schema.Number,
  errorCount: Schema.Number,
  lastError: Schema.optional(Schema.String),
})
export type IngesterStatus = typeof IngesterStatus.Type

/**
 * Orchestrator status (all ingesters)
 */
export const OrchestratorStatus = Schema.Struct({
  running: Schema.Boolean,
  ingesters: Schema.Array(IngesterStatus),
  startedAt: Schema.optional(Schema.DateFromString),
  totalRecordsIngested: Schema.Number,
})
export type OrchestratorStatus = typeof OrchestratorStatus.Type

// =============================================================================
// RPC Payloads
// =============================================================================

/**
 * Ingest flight by ICAO24 payload
 */
export const IngestFlightByIcaoPayload = Schema.Struct({
  /** ICAO24 hex code (6 characters, lowercase) */
  icao24: Schema.String.pipe(
    Schema.pattern(/^[0-9a-f]{6}$/),
    Schema.annotations({ description: 'ICAO24 hex code (6 lowercase hex characters)' })
  ),
  /** Preferred source (defaults to adsb_lol for single-flight queries) */
  source: Schema.optionalWith(FlightSource, { default: () => 'adsb_lol' as const }),
})

/**
 * Ingest flights by region payload
 */
export const IngestFlightsByRegionPayload = Schema.Struct({
  /** Region name for logging */
  regionName: Schema.String,
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  bounds: Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number),
  /** Source to use */
  source: Schema.optionalWith(FlightSource, { default: () => 'opensky' as const }),
  /** For ADSB.lol: radius in nautical miles (max 250) */
  radiusNm: Schema.optionalWith(Schema.Number, { default: () => 150 }),
})

/**
 * Ingest POI by region payload
 */
export const IngestPoiByRegionPayload = Schema.Struct({
  /** Region name for logging */
  regionName: Schema.String,
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  bounds: Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number),
  /** Amenity types to fetch (e.g., 'restaurant', 'hospital') */
  amenities: Schema.optionalWith(Schema.Array(Schema.String), {
    default: () => ['restaurant', 'cafe', 'hospital', 'pharmacy', 'fuel', 'bank'],
  }),
  /** TTL in days for cached POIs (default: 7) */
  ttlDays: Schema.optionalWith(Schema.Number, { default: () => 7 }),
})

/**
 * Ingest weather by grid payload
 */
export const IngestWeatherByGridPayload = Schema.Struct({
  /** Grid name for logging */
  gridName: Schema.String,
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  bounds: Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number),
  /** Grid resolution in degrees (default: 0.25 = ~27km) */
  resolution: Schema.optionalWith(Schema.Number, { default: () => 0.25 }),
  /** TTL in minutes (default: 60) */
  ttlMinutes: Schema.optionalWith(Schema.Number, { default: () => 60 }),
})

/**
 * Ingest weather by point payload
 */
export const IngestWeatherByPointPayload = Schema.Struct({
  /** Latitude */
  latitude: Schema.Number,
  /** Longitude */
  longitude: Schema.Number,
  /** TTL in minutes (default: 60) */
  ttlMinutes: Schema.optionalWith(Schema.Number, { default: () => 60 }),
})

/**
 * Weather point result
 */
export const WeatherPointResult = Schema.Struct({
  locationId: Schema.String,
  latitude: Schema.Number,
  longitude: Schema.Number,
  temperature: Schema.optional(Schema.Number),
  feelsLike: Schema.optional(Schema.Number),
  humidity: Schema.optional(Schema.Number),
  weatherDesc: Schema.optional(Schema.String),
  windSpeed: Schema.optional(Schema.Number),
  observedAt: Schema.DateFromString,
  latencyMs: Schema.Number,
})
export type WeatherPointResult = typeof WeatherPointResult.Type

/**
 * Ingest imagery by region payload
 */
export const IngestImageryByRegionPayload = Schema.Struct({
  /** Region name for logging */
  regionName: Schema.String,
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  bounds: Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number),
  /** Providers to use (default: both) */
  providers: Schema.optionalWith(Schema.Array(ImageryProvider), {
    default: () => ['planet', 'sentinel'] as Array<'planet' | 'sentinel'>,
  }),
  /** Maximum cloud cover percentage (0-100, default: 30) */
  maxCloudCover: Schema.optionalWith(Schema.Number, { default: () => 30 }),
  /** Lookback days for recent acquisitions (default: 3) */
  lookbackDays: Schema.optionalWith(Schema.Number, { default: () => 3 }),
})

/**
 * Ingester name enum
 */
export const IngesterName = Schema.Literal('flights', 'poi', 'weather', 'imagery')
export type IngesterName = typeof IngesterName.Type

// =============================================================================
// RPC Group Definition
// =============================================================================

/**
 * Ingestion RPC group - separate encapsulation boundary from SearchRpcs
 *
 * Operations:
 * - ingestFlightByIcao: On-demand single flight ingestion
 * - ingestFlightsByRegion: On-demand region ingestion
 * - Orchestrator control: start/stop/status for background ingesters
 */
export class IngestionRpcs extends RpcGroup.make(
  // =========================================================================
  // On-Demand Ingestion Operations
  // =========================================================================

  /**
   * Ingest a single flight by ICAO24 hex code
   *
   * Fetches current position from ADSB.lol or OpenSky,
   * persists to PostgreSQL, and publishes to DurableStreams.
   */
  Rpc.make('ingestFlightByIcao', {
    payload: IngestFlightByIcaoPayload,
    success: FlightIngestionResult,
    error: Schema.Union(IngestionError, FlightNotFoundError),
  }),

  /**
   * Ingest flights in a geographic region
   *
   * Fetches all flights in bounding box from OpenSky or ADSB.lol,
   * persists to PostgreSQL, and publishes to DurableStreams.
   */
  Rpc.make('ingestFlightsByRegion', {
    payload: IngestFlightsByRegionPayload,
    success: RegionIngestionResult,
    error: IngestionError,
  }),

  // =========================================================================
  // POI Ingestion
  // =========================================================================

  /**
   * Ingest POIs in a geographic region
   *
   * Fetches POIs from Overpass API (OpenStreetMap),
   * persists to PostgreSQL, and publishes to DurableStreams.
   */
  Rpc.make('ingestPoiByRegion', {
    payload: IngestPoiByRegionPayload,
    success: PoiIngestionResult,
    error: IngestionError,
  }),

  // =========================================================================
  // Weather Ingestion
  // =========================================================================

  /**
   * Ingest weather for a grid of points
   *
   * Fetches current weather from Open-Meteo for grid points,
   * persists to PostgreSQL, and publishes to DurableStreams.
   */
  Rpc.make('ingestWeatherByGrid', {
    payload: IngestWeatherByGridPayload,
    success: WeatherIngestionResult,
    error: IngestionError,
  }),

  /**
   * Ingest weather for a single point
   *
   * Fetches current weather from Open-Meteo for a specific location.
   */
  Rpc.make('ingestWeatherByPoint', {
    payload: IngestWeatherByPointPayload,
    success: WeatherPointResult,
    error: IngestionError,
  }),

  // =========================================================================
  // Imagery Ingestion
  // =========================================================================

  /**
   * Ingest satellite imagery metadata for a region
   *
   * Fetches recent acquisitions from Planet Labs and/or Sentinel Hub,
   * persists to PostgreSQL, and publishes to DurableStreams.
   */
  Rpc.make('ingestImageryByRegion', {
    payload: IngestImageryByRegionPayload,
    success: Schema.Array(ImageryIngestionResult),
    error: IngestionError,
  }),

  // =========================================================================
  // Orchestrator Control
  // =========================================================================

  /**
   * Start all enabled data ingesters
   * Begins background polling for flight, POI, weather, and imagery data
   */
  Rpc.make('startIngestion', {
    payload: Schema.Struct({}),
    success: OrchestratorStatus,
  }),

  /**
   * Stop all running data ingesters gracefully
   */
  Rpc.make('stopIngestion', {
    payload: Schema.Struct({}),
    success: OrchestratorStatus,
  }),

  /**
   * Get the current status of all ingesters
   */
  Rpc.make('getIngestionStatus', {
    payload: Schema.Struct({}),
    success: OrchestratorStatus,
  }),

  /**
   * Start a specific ingester by name
   */
  Rpc.make('startIngester', {
    payload: Schema.Struct({
      name: IngesterName,
    }),
    success: IngesterStatus,
  }),

  /**
   * Stop a specific ingester by name
   */
  Rpc.make('stopIngester', {
    payload: Schema.Struct({
      name: IngesterName,
    }),
    success: IngesterStatus,
  })
) {}

// =============================================================================
// Configuration Service
// =============================================================================

/**
 * Ingestion service configuration.
 * Provides WebSocket URL and other config via Effect Context.
 */
export interface IngestionConfig {
  readonly wsUrl: string
  readonly retryTransientErrors: boolean
}

/**
 * IngestionConfig service tag.
 * Provide this in your Layer stack to configure the ingestion client.
 */
export class IngestionConfigTag extends Context.Tag('geoint/IngestionConfig')<IngestionConfigTag, IngestionConfig>() {}

/**
 * Config layer for IngestionConfig.
 * Reads from environment or uses defaults.
 *
 * Environment variables:
 * - GEOINT_INGESTION_WS_URL: WebSocket URL (default: ws://localhost:8081/geoint/ingestion)
 * - GEOINT_INGESTION_RETRY: Whether to retry transient errors (default: true)
 */
export const IngestionConfigLive = Layer.effect(
  IngestionConfigTag,
  Effect.gen(function* () {
    const wsUrl = yield* Config.string('GEOINT_INGESTION_WS_URL').pipe(
      Config.withDefault('ws://localhost:8081/geoint/ingestion')
    )
    const retryTransientErrors = yield* Config.boolean('GEOINT_INGESTION_RETRY').pipe(
      Config.withDefault(true)
    )
    return { wsUrl, retryTransientErrors }
  })
)

/**
 * Create IngestionConfig layer with specific values (for testing/custom setups).
 */
export const makeIngestionConfigLayer = (config: IngestionConfig) =>
  Layer.succeed(IngestionConfigTag, config)

// Default config for browser usage (no Config provider)
const DEFAULT_CONFIG: IngestionConfig = {
  wsUrl: 'ws://localhost:8081/geoint/ingestion',
  retryTransientErrors: true,
}

// =============================================================================
// AtomRpc.Tag Client
// =============================================================================

/**
 * IngestionClient - Reactive RPC client for on-demand flight ingestion
 *
 * Features:
 * - Automatic query caching with configurable TTL
 * - Reactivity keys for cache invalidation
 * - Full pipeline: Browser → RPC → Handler → API → PostgreSQL → DurableStreams
 *
 * @example
 * ```typescript
 * // Ingest a specific flight by ICAO24
 * const resultAtom = IngestionClient.query(
 *   'ingestFlightByIcao',
 *   { icao24: 'a00001', source: 'adsb_lol' },
 *   { reactivityKeys: ['ingestion', 'flight', 'a00001'] }
 * )
 *
 * // Start background ingesters
 * const startFn = IngestionClient.mutation('startIngestion')
 * await startFn({
 *   payload: {},
 *   reactivityKeys: ['ingestion', 'orchestrator']
 * })
 *
 * // Get orchestrator status with caching
 * const statusAtom = IngestionClient.query(
 *   'getIngestionStatus',
 *   {},
 *   {
 *     reactivityKeys: ['ingestion', 'status'],
 *     timeToLive: Duration.seconds(5)
 *   }
 * )
 * ```
 */
export class IngestionClient extends AtomRpc.Tag<IngestionClient>()('geoint/IngestionClient', {
  group: IngestionRpcs,
  protocol: RpcClient.layerProtocolSocket({ retryTransientErrors: true }).pipe(
    Layer.provide(RpcSerialization.layerJson),
    // WebSocket endpoint - uses default, can be overridden via IngestionConfigLive
    Layer.provide(Socket.layerWebSocket(DEFAULT_CONFIG.wsUrl)),
    Layer.provide(Socket.layerWebSocketConstructorGlobal)
  ),
  spanPrefix: 'geoint-ingestion',
}) {}

// =============================================================================
// Convenience Atoms
// =============================================================================

/**
 * Orchestrator status with automatic refresh
 */
export const ingestionStatusAtom = IngestionClient.query(
  'getIngestionStatus',
  {},
  {
    reactivityKeys: ['ingestion', 'status'],
    timeToLive: Duration.seconds(5),
  }
)

/**
 * Start ingestion mutation with reactivity
 */
export const startIngestionMutation = IngestionClient.mutation('startIngestion')

/**
 * Stop ingestion mutation with reactivity
 */
export const stopIngestionMutation = IngestionClient.mutation('stopIngestion')

/**
 * Ingest flight by ICAO24 mutation
 */
export const ingestFlightByIcaoMutation = IngestionClient.mutation('ingestFlightByIcao')

/**
 * Ingest flights by region mutation
 */
export const ingestFlightsByRegionMutation = IngestionClient.mutation('ingestFlightsByRegion')

/**
 * Create an atom for ingesting a specific flight
 * Use for on-demand single flight queries
 */
export const createFlightIngestionAtom = (icao24: string, source: 'opensky' | 'adsb_lol' = 'adsb_lol') =>
  IngestionClient.query(
    'ingestFlightByIcao',
    { icao24: icao24.toLowerCase(), source },
    {
      reactivityKeys: ['ingestion', 'flight', icao24.toLowerCase()],
      timeToLive: Duration.seconds(30),
    }
  )

/**
 * Create an atom for ingesting a region
 */
export const createRegionIngestionAtom = (
  regionName: string,
  bounds: readonly [number, number, number, number],
  source: 'opensky' | 'adsb_lol' = 'opensky'
) =>
  IngestionClient.query(
    'ingestFlightsByRegion',
    {
      regionName,
      bounds: bounds as [number, number, number, number],
      source,
      radiusNm: 150,
    },
    {
      reactivityKeys: ['ingestion', 'region', regionName],
      timeToLive: Duration.seconds(15),
    }
  )
