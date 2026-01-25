/**
 * Ingestion Entity - Effect Cluster for On-Demand Data Ingestion
 *
 * Provides RPC-triggered ingestion for specific entities:
 * - IngestFlightByIcaoRpc: Fetch and persist flight data by ICAO24 hex code
 * - IngestFlightsByRegionRpc: Fetch and persist flights in a bounding box
 * - IngestPoiByRegionRpc: Fetch and persist POIs from OpenStreetMap
 * - IngestWeatherByGridRpc: Fetch and persist weather for a grid
 * - IngestWeatherByPointRpc: Fetch and persist weather for a single point
 * - IngestImageryByRegionRpc: Fetch and persist satellite imagery metadata
 *
 * This enables browser testbeds to trigger ingestion through the cluster,
 * completing the vertical slice: Browser → Cluster RPC → External API →
 * PostgreSQL → DurableStreams → Materializer → Electric → Atoms → UI
 *
 * Architecture:
 * - IngestionClient (AtomRpc.Tag) connects via WebSocket to IngestionRpcServer
 * - IngestionRpcServer acts as a thin proxy to IngestionEntity.client
 * - IngestionEntityHandlers implement the actual ingestion logic
 * - Handlers use transactional outbox pattern: Postgres + DurableStream in same tx
 *
 * @see beads:tmnl-vertical-slice ECS Vertical Slice Integration
 * @module
 */

import { Schema } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { FlightSource } from '../schemas/flight-events'

// =============================================================================
// Error Types
// =============================================================================

/**
 * Ingestion operation error
 */
export class IngestionEntityError extends Schema.TaggedError<IngestionEntityError>()(
  'IngestionEntityError',
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
 * Result of a flight ingestion operation
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
 * Result of weather grid ingestion operation
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
 * Result of weather point ingestion operation
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

// =============================================================================
// RPCs
// =============================================================================

/**
 * Ingest a single flight by ICAO24 hex code
 *
 * Fetches current position from ADSB.lol or OpenSky,
 * persists to PostgreSQL, and publishes to DurableStreams.
 */
export class IngestFlightByIcaoRpc extends Rpc.make('IngestFlightByIcao', {
  payload: IngestFlightByIcaoPayload,
  success: FlightIngestionResult,
  error: Schema.Union(IngestionEntityError, FlightNotFoundError),
}) {}

/**
 * Ingest flights in a geographic region
 *
 * Fetches all flights in bounding box from OpenSky or ADSB.lol,
 * persists to PostgreSQL, and publishes to DurableStreams.
 */
export class IngestFlightsByRegionRpc extends Rpc.make('IngestFlightsByRegion', {
  payload: IngestFlightsByRegionPayload,
  success: RegionIngestionResult,
  error: IngestionEntityError,
}) {}

/**
 * Ingest POIs in a geographic region
 *
 * Fetches POIs from Overpass API (OpenStreetMap),
 * persists to PostgreSQL, and publishes to DurableStreams.
 */
export class IngestPoiByRegionRpc extends Rpc.make('IngestPoiByRegion', {
  payload: IngestPoiByRegionPayload,
  success: PoiIngestionResult,
  error: IngestionEntityError,
}) {}

/**
 * Ingest weather for a grid of points
 *
 * Fetches current weather from Open-Meteo for grid points,
 * persists to PostgreSQL, and publishes to DurableStreams.
 */
export class IngestWeatherByGridRpc extends Rpc.make('IngestWeatherByGrid', {
  payload: IngestWeatherByGridPayload,
  success: WeatherIngestionResult,
  error: IngestionEntityError,
}) {}

/**
 * Ingest weather for a single point
 *
 * Fetches current weather from Open-Meteo for a specific location.
 * Lighter weight than grid ingestion for single-location queries.
 */
export class IngestWeatherByPointRpc extends Rpc.make('IngestWeatherByPoint', {
  payload: IngestWeatherByPointPayload,
  success: WeatherPointResult,
  error: IngestionEntityError,
}) {}

/**
 * Ingest satellite imagery metadata for a region
 *
 * Fetches recent acquisitions from Planet Labs and/or Sentinel Hub,
 * persists to PostgreSQL, and publishes to DurableStreams.
 */
export class IngestImageryByRegionRpc extends Rpc.make('IngestImageryByRegion', {
  payload: IngestImageryByRegionPayload,
  success: Schema.Array(ImageryIngestionResult),
  error: IngestionEntityError,
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

/**
 * Ingestion Entity
 *
 * Distributed actor for on-demand data ingestion operations.
 * Enables browser testbeds to trigger ingestion through the cluster.
 *
 * Sharding Strategy:
 * - Default shard for general operations
 * - Source-specific shards for flights, POI, weather, imagery
 * - Coordinator shard for orchestration operations
 */
export const IngestionEntity = Entity.make('Ingestion', [
  // Flight ingestion
  IngestFlightByIcaoRpc,
  IngestFlightsByRegionRpc,
  // POI ingestion
  IngestPoiByRegionRpc,
  // Weather ingestion
  IngestWeatherByGridRpc,
  IngestWeatherByPointRpc,
  // Imagery ingestion
  IngestImageryByRegionRpc,
])

/**
 * Type helper for Ingestion Entity
 */
export type IngestionEntity = typeof IngestionEntity

/**
 * Shard groups for ingestion cluster runners
 *
 * Each source type can be sharded independently for load distribution:
 * - ingestion-flights: Flight position data (OpenSky, ADSB.lol)
 * - ingestion-poi: OpenStreetMap POI data
 * - ingestion-weather: Open-Meteo weather observations
 * - ingestion-imagery: Planet Labs / Sentinel Hub imagery metadata
 */
export const INGESTION_SHARD_GROUPS = [
  'ingestion-default',
  'ingestion-flights',
  'ingestion-poi',
  'ingestion-weather',
  'ingestion-imagery',
] as const

export type IngestionShardGroup = (typeof INGESTION_SHARD_GROUPS)[number]
