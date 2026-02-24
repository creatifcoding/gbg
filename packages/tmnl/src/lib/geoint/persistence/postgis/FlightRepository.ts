/**
 * FlightRepository - Repository for raw.flight_positions and entity.flights_current
 *
 * Provides CRUD operations for flight position data using:
 * - raw.flight_positions: TimescaleDB hypertable for append-only position storage
 * - entity.flights_current: Continuous aggregate for latest positions per aircraft
 * - entity.flight_tracks: Continuous aggregate for trajectory summaries
 *
 * Uses Effect Schema with TaggedStruct for domain types with proper Date ↔ DateTime.Utc transforms.
 *
 * @see docker/postgres/init/03-raw-schema.sql
 * @see docker/postgres/init/04-continuous-aggregates.sql
 * @module
 */

import {
  Effect,
  Layer,
  Context,
  Schema,
  Option,
  pipe,
  Array as Arr,
} from 'effect'
import { PgClient } from '@effect/sql-pg'
import type { BBox } from '../../schemas'

// =============================================================================
// Schemas for raw.flight_positions
// =============================================================================

/**
 * Flight data source - identifies the API that provided the data
 */
export const FlightSource = Schema.Literal('opensky', 'adsb-lol')
export type FlightSource = typeof FlightSource.Type

/**
 * Flight position input for insertion
 *
 * Uses plain Date for input since we're inserting into the database.
 */
export const FlightPositionInput = Schema.TaggedStruct('FlightPositionInput', {
  /** UTC timestamp of the position */
  time: Schema.DateFromSelf,
  /** ICAO 24-bit address (hex string) */
  icao24: Schema.String,
  /** Data source identifier */
  source: FlightSource,
  /** Raw API response JSONB */
  raw: Schema.Unknown,
  /** Longitude */
  longitude: Schema.Number,
  /** Latitude */
  latitude: Schema.Number,
  /** Altitude in meters */
  altitudeM: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Heading in degrees */
  headingDeg: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Velocity in meters per second */
  velocityMps: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Vertical rate in m/s */
  verticalRate: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Whether aircraft is on ground */
  onGround: Schema.optionalWith(Schema.Boolean, { as: 'Option' }),
  /** Callsign */
  callsign: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Squawk code */
  squawk: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Aircraft category */
  category: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Country of origin */
  originCountry: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type FlightPositionInput = typeof FlightPositionInput.Type

/**
 * Flight position row from database
 *
 * Uses DateTimeUtcFromDate to transform Date from SQL to DateTime.Utc for domain use.
 */
export const FlightPositionRow = Schema.TaggedStruct('FlightPositionRow', {
  time: Schema.DateTimeUtcFromDate,
  icao24: Schema.String,
  source: Schema.String,
  raw: Schema.Unknown,
  longitude: Schema.Number,
  latitude: Schema.Number,
  altitude_m: Schema.NullOr(Schema.Number),
  heading_deg: Schema.NullOr(Schema.Number),
  velocity_mps: Schema.NullOr(Schema.Number),
  vertical_rate: Schema.NullOr(Schema.Number),
  on_ground: Schema.NullOr(Schema.Boolean),
  callsign: Schema.NullOr(Schema.String),
  squawk: Schema.NullOr(Schema.String),
  category: Schema.NullOr(Schema.String),
  origin_country: Schema.NullOr(Schema.String),
})
export type FlightPositionRow = typeof FlightPositionRow.Type

/**
 * Current flight from entity.flights_current continuous aggregate
 */
export const CurrentFlight = Schema.TaggedStruct('CurrentFlight', {
  icao24: Schema.String,
  longitude: Schema.Number,
  latitude: Schema.Number,
  altitude_m: Schema.NullOr(Schema.Number),
  heading_deg: Schema.NullOr(Schema.Number),
  velocity_mps: Schema.NullOr(Schema.Number),
  vertical_rate: Schema.NullOr(Schema.Number),
  callsign: Schema.NullOr(Schema.String),
  category: Schema.NullOr(Schema.String),
  source: Schema.NullOr(Schema.String),
  on_ground: Schema.NullOr(Schema.Boolean),
  last_seen: Schema.DateTimeUtcFromDate,
  position_count: Schema.BigInt,
})
export type CurrentFlight = typeof CurrentFlight.Type

/**
 * Flight track summary from entity.flight_tracks continuous aggregate
 */
export const FlightTrackSummary = Schema.TaggedStruct('FlightTrackSummary', {
  icao24: Schema.String,
  bucket: Schema.DateTimeUtcFromDate,
  min_lon: Schema.Number,
  max_lon: Schema.Number,
  min_lat: Schema.Number,
  max_lat: Schema.Number,
  start_time: Schema.DateTimeUtcFromDate,
  end_time: Schema.DateTimeUtcFromDate,
  point_count: Schema.BigInt,
  min_altitude_m: Schema.NullOr(Schema.Number),
  max_altitude_m: Schema.NullOr(Schema.Number),
  avg_altitude_m: Schema.NullOr(Schema.Number),
  avg_velocity_mps: Schema.NullOr(Schema.Number),
  max_velocity_mps: Schema.NullOr(Schema.Number),
  callsign: Schema.NullOr(Schema.String),
  source: Schema.NullOr(Schema.String),
})
export type FlightTrackSummary = typeof FlightTrackSummary.Type

/**
 * Ingestion health row from raw.get_ingestion_health function
 */
export const IngestionHealthRow = Schema.TaggedStruct('IngestionHealthRow', {
  source: Schema.String,
  total_ops: Schema.BigInt,
  success_rate: Schema.NullOr(Schema.Number),
  total_records: Schema.NullOr(Schema.BigInt),
  avg_latency_ms: Schema.NullOr(Schema.Number),
  last_success: Schema.NullOr(Schema.DateTimeUtcFromDate),
  last_error: Schema.NullOr(Schema.String),
})
export type IngestionHealthRow = typeof IngestionHealthRow.Type

// =============================================================================
// Repository Error
// =============================================================================

/**
 * Flight repository error
 */
export class FlightRepositoryError extends Schema.TaggedError<FlightRepositoryError>()(
  'FlightRepositoryError',
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

// =============================================================================
// Repository Interface
// =============================================================================

/**
 * Search options for current flights
 */
export interface CurrentFlightSearchOptions {
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  readonly bounds?: BBox
  /** Only include flights seen within this many minutes (default: 5) */
  readonly sinceMinutes?: number
  /** Filter by ICAO24 addresses */
  readonly icao24s?: readonly string[]
  /** Filter by source */
  readonly source?: FlightSource
  /** Maximum results (default: 500) */
  readonly limit?: number
}

/**
 * Search options for raw flight positions
 */
export interface FlightPositionSearchOptions {
  /** Filter by ICAO24 address */
  readonly icao24: string
  /** Start time */
  readonly from?: Date
  /** End time */
  readonly to?: Date
  /** Maximum results (default: 1000) */
  readonly limit?: number
}

/**
 * Flight repository interface
 */
export interface FlightRepository {
  /**
   * Insert a flight position into raw.flight_positions
   */
  readonly insertPosition: (
    input: FlightPositionInput
  ) => Effect.Effect<void, FlightRepositoryError>

  /**
   * Insert multiple flight positions (batch)
   */
  readonly insertPositions: (
    inputs: readonly FlightPositionInput[]
  ) => Effect.Effect<number, FlightRepositoryError>

  /**
   * Get current flights from entity.flights_current continuous aggregate
   * Uses real-time aggregation for fresh data
   */
  readonly findCurrentFlights: (
    options?: CurrentFlightSearchOptions
  ) => Effect.Effect<readonly CurrentFlight[], FlightRepositoryError>

  /**
   * Get a single current flight by ICAO24
   */
  readonly findCurrentFlight: (
    icao24: string
  ) => Effect.Effect<Option.Option<CurrentFlight>, FlightRepositoryError>

  /**
   * Get flight positions from raw.flight_positions
   */
  readonly findPositions: (
    options: FlightPositionSearchOptions
  ) => Effect.Effect<readonly FlightPositionRow[], FlightRepositoryError>

  /**
   * Get flight track summary from entity.flight_tracks
   */
  readonly findTrackSummary: (
    icao24: string,
    from?: Date,
    to?: Date
  ) => Effect.Effect<readonly FlightTrackSummary[], FlightRepositoryError>

  /**
   * Count positions for an aircraft in a time range
   */
  readonly countPositions: (
    icao24: string,
    from?: Date,
    to?: Date
  ) => Effect.Effect<number, FlightRepositoryError>

  /**
   * Get ingestion health stats from raw.ingestion_log
   */
  readonly getIngestionHealth: (
    lookbackMinutes?: number
  ) => Effect.Effect<readonly IngestionHealthRow[], FlightRepositoryError>
}

// =============================================================================
// Repository Tag
// =============================================================================

/**
 * Flight repository tag for dependency injection
 */
export class FlightRepositoryTag extends Context.Tag('geoint/FlightRepository')<
  FlightRepositoryTag,
  FlightRepository
>() {}

// =============================================================================
// Decode Helpers
// =============================================================================

/**
 * Decode a database row to CurrentFlight, adding the _tag
 */
const decodeCurrentFlight = (row: Record<string, unknown>): CurrentFlight =>
  Schema.decodeUnknownSync(CurrentFlight)({ ...row, _tag: 'CurrentFlight' })

/**
 * Decode a database row to FlightPositionRow, adding the _tag
 */
const decodeFlightPositionRow = (row: Record<string, unknown>): FlightPositionRow =>
  Schema.decodeUnknownSync(FlightPositionRow)({ ...row, _tag: 'FlightPositionRow' })

/**
 * Decode a database row to FlightTrackSummary, adding the _tag
 */
const decodeFlightTrackSummary = (row: Record<string, unknown>): FlightTrackSummary =>
  Schema.decodeUnknownSync(FlightTrackSummary)({ ...row, _tag: 'FlightTrackSummary' })

/**
 * Decode a database row to IngestionHealthRow, adding the _tag
 */
const decodeIngestionHealthRow = (row: Record<string, unknown>): IngestionHealthRow =>
  Schema.decodeUnknownSync(IngestionHealthRow)({ ...row, _tag: 'IngestionHealthRow' })

// =============================================================================
// Repository Implementation
// =============================================================================

/**
 * Create flight repository from SqlClient
 */
export const makeFlightRepository = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  const mapError =
    (operation: string) =>
    (error: unknown): FlightRepositoryError =>
      new FlightRepositoryError({
        operation,
        message: String(error),
        cause: error,
      })

  // ---------------------------------------------------------------------------
  // Insert Operations
  // ---------------------------------------------------------------------------

  const insertPosition: FlightRepository['insertPosition'] = (input) =>
    pipe(
      sql`
        INSERT INTO raw.flight_positions (
          time, icao24, source, raw, position,
          altitude_m, heading_deg, velocity_mps, vertical_rate,
          on_ground, callsign, squawk, category, origin_country
        ) VALUES (
          ${input.time},
          ${input.icao24},
          ${input.source},
          ${input.raw}::jsonb,
          ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326),
          ${Option.getOrNull(input.altitudeM)},
          ${Option.getOrNull(input.headingDeg)},
          ${Option.getOrNull(input.velocityMps)},
          ${Option.getOrNull(input.verticalRate)},
          ${Option.getOrElse(input.onGround, () => false)},
          ${Option.getOrNull(input.callsign)},
          ${Option.getOrNull(input.squawk)},
          ${Option.getOrNull(input.category)},
          ${Option.getOrNull(input.originCountry)}
        )
        ON CONFLICT (time, icao24, source) DO UPDATE SET
          raw = EXCLUDED.raw,
          position = EXCLUDED.position,
          altitude_m = EXCLUDED.altitude_m,
          heading_deg = EXCLUDED.heading_deg,
          velocity_mps = EXCLUDED.velocity_mps,
          vertical_rate = EXCLUDED.vertical_rate,
          on_ground = EXCLUDED.on_ground,
          callsign = EXCLUDED.callsign,
          squawk = EXCLUDED.squawk,
          category = EXCLUDED.category,
          origin_country = EXCLUDED.origin_country
      `,
      Effect.asVoid,
      Effect.mapError(mapError('insertPosition'))
    )

  const insertPositions: FlightRepository['insertPositions'] = (inputs) => {
    if (inputs.length === 0) return Effect.succeed(0)

    // Use batched insert for efficiency
    return pipe(
      Effect.forEach(
        inputs,
        (input) => insertPosition(input).pipe(Effect.as(1)),
        { concurrency: 10 }
      ),
      Effect.map(Arr.reduce(0, (acc, n) => acc + n)),
      Effect.mapError(mapError('insertPositions'))
    )
  }

  // ---------------------------------------------------------------------------
  // Query Operations (Current Flights)
  // ---------------------------------------------------------------------------

  const findCurrentFlights: FlightRepository['findCurrentFlights'] = (
    options = {}
  ) => {
    const sinceMinutes = options.sinceMinutes ?? 5
    const limit = options.limit ?? 500

    // Build spatial filter if bounds provided
    const boundsFilter = options.bounds
      ? sql`AND position && ST_MakeEnvelope(
          ${options.bounds[0]}, ${options.bounds[1]},
          ${options.bounds[2]}, ${options.bounds[3]}, 4326
        )`
      : sql``

    const sourceFilter = options.source
      ? sql`AND source = ${options.source}`
      : sql``

    const icaoFilter =
      options.icao24s && options.icao24s.length > 0
        ? sql`AND icao24 = ANY(${options.icao24s as unknown as string[]})`
        : sql``

    return pipe(
      sql<Record<string, unknown>>`
        SELECT
          icao24,
          ST_X(position) as longitude,
          ST_Y(position) as latitude,
          altitude_m,
          heading_deg,
          velocity_mps,
          vertical_rate,
          callsign,
          category,
          source,
          on_ground,
          last_seen,
          position_count
        FROM entity.flights_current
        WHERE bucket >= NOW() - (${sinceMinutes} || ' minutes')::interval
          ${boundsFilter}
          ${sourceFilter}
          ${icaoFilter}
        ORDER BY last_seen DESC
        LIMIT ${limit}
      `,
      Effect.map((rows) => rows.map(decodeCurrentFlight)),
      Effect.mapError(mapError('findCurrentFlights'))
    )
  }

  const findCurrentFlight: FlightRepository['findCurrentFlight'] = (icao24) =>
    pipe(
      sql<Record<string, unknown>>`
        SELECT
          icao24,
          ST_X(position) as longitude,
          ST_Y(position) as latitude,
          altitude_m,
          heading_deg,
          velocity_mps,
          vertical_rate,
          callsign,
          category,
          source,
          on_ground,
          last_seen,
          position_count
        FROM entity.flights_current
        WHERE icao24 = ${icao24}
        ORDER BY last_seen DESC
        LIMIT 1
      `,
      Effect.map((rows) =>
        rows.length > 0 ? Option.some(decodeCurrentFlight(rows[0])) : Option.none()
      ),
      Effect.mapError(mapError('findCurrentFlight'))
    )

  // ---------------------------------------------------------------------------
  // Query Operations (Raw Positions)
  // ---------------------------------------------------------------------------

  const findPositions: FlightRepository['findPositions'] = (options) => {
    const limit = options.limit ?? 1000
    const from = options.from ?? new Date(Date.now() - 3600000) // 1 hour ago
    const to = options.to ?? new Date()

    return pipe(
      sql<Record<string, unknown>>`
        SELECT
          time,
          icao24,
          source,
          raw,
          ST_X(position) as longitude,
          ST_Y(position) as latitude,
          altitude_m,
          heading_deg,
          velocity_mps,
          vertical_rate,
          on_ground,
          callsign,
          squawk,
          category,
          origin_country
        FROM raw.flight_positions
        WHERE icao24 = ${options.icao24}
          AND time >= ${from}
          AND time <= ${to}
        ORDER BY time
        LIMIT ${limit}
      `,
      Effect.map((rows) => rows.map(decodeFlightPositionRow)),
      Effect.mapError(mapError('findPositions'))
    )
  }

  // ---------------------------------------------------------------------------
  // Query Operations (Track Summaries)
  // ---------------------------------------------------------------------------

  const findTrackSummary: FlightRepository['findTrackSummary'] = (
    icao24,
    from,
    to
  ) => {
    const fromTime = from ?? new Date(Date.now() - 3600000)
    const toTime = to ?? new Date()

    return pipe(
      sql<Record<string, unknown>>`
        SELECT
          icao24,
          bucket,
          min_lon,
          max_lon,
          min_lat,
          max_lat,
          start_time,
          end_time,
          point_count,
          min_altitude_m,
          max_altitude_m,
          avg_altitude_m,
          avg_velocity_mps,
          max_velocity_mps,
          callsign,
          source
        FROM entity.flight_tracks
        WHERE icao24 = ${icao24}
          AND bucket >= time_bucket('1 hour', ${fromTime}::timestamptz)
          AND bucket <= time_bucket('1 hour', ${toTime}::timestamptz)
        ORDER BY bucket
      `,
      Effect.map((rows) => rows.map(decodeFlightTrackSummary)),
      Effect.mapError(mapError('findTrackSummary'))
    )
  }

  // ---------------------------------------------------------------------------
  // Count Operations
  // ---------------------------------------------------------------------------

  const countPositions: FlightRepository['countPositions'] = (
    icao24,
    from,
    to
  ) => {
    const fromTime = from ?? new Date(Date.now() - 86400000) // 24 hours ago
    const toTime = to ?? new Date()

    return pipe(
      sql<{ count: string }>`
        SELECT COUNT(*) as count
        FROM raw.flight_positions
        WHERE icao24 = ${icao24}
          AND time >= ${fromTime}
          AND time <= ${toTime}
      `,
      Effect.map((rows) => parseInt(rows[0]?.count ?? '0', 10)),
      Effect.mapError(mapError('countPositions'))
    )
  }

  // ---------------------------------------------------------------------------
  // Health Operations
  // ---------------------------------------------------------------------------

  const getIngestionHealth: FlightRepository['getIngestionHealth'] = (
    lookbackMinutes = 5
  ) =>
    pipe(
      sql<Record<string, unknown>>`
        SELECT * FROM raw.get_ingestion_health(
          (${lookbackMinutes} || ' minutes')::interval
        )
      `,
      Effect.map((rows) => rows.map(decodeIngestionHealthRow)),
      Effect.mapError(mapError('getIngestionHealth'))
    )

  // ---------------------------------------------------------------------------
  // Return Repository
  // ---------------------------------------------------------------------------

  return {
    insertPosition,
    insertPositions,
    findCurrentFlights,
    findCurrentFlight,
    findPositions,
    findTrackSummary,
    countPositions,
    getIngestionHealth,
  } satisfies FlightRepository
})

// =============================================================================
// Layer
// =============================================================================

/**
 * Flight repository layer
 */
export const FlightRepositoryLive = Layer.effect(
  FlightRepositoryTag,
  makeFlightRepository
)
