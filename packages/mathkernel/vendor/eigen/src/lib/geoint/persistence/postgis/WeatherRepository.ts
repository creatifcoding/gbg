/**
 * WeatherRepository - Repository for raw.weather_observations
 *
 * Provides CRUD operations for weather observation data:
 * - raw.weather_observations: Hypertable for time-series weather data
 * - Supports spatial queries, location-based lookups, and time-range queries
 *
 * Uses Effect Schema with TaggedStruct for domain types.
 *
 * @see docker/postgres/init/03-raw-schema.sql
 * @module
 */

import {
  Effect,
  Layer,
  Context,
  Schema,
  Option,
  pipe,
  DateTime,
} from 'effect'
import { PgClient } from '@effect/sql-pg'
import type { BBox } from '../../schemas'

// =============================================================================
// Schemas for raw.weather_observations
// =============================================================================

/**
 * Weather observation input for insertion/upsert
 */
export const WeatherObservationInput = Schema.TaggedStruct(
  'WeatherObservationInput',
  {
    /** Observation timestamp */
    time: Schema.DateFromSelf,
    /** Location ID (hash of lat/lon) */
    locationId: Schema.String,
    /** Raw API response JSONB */
    raw: Schema.Unknown,
    /** Longitude */
    longitude: Schema.Number,
    /** Latitude */
    latitude: Schema.Number,
    /** Temperature in Celsius */
    temperature: Schema.optionalWith(Schema.Number, { as: 'Option' }),
    /** Feels-like temperature in Celsius */
    feelsLike: Schema.optionalWith(Schema.Number, { as: 'Option' }),
    /** Humidity percentage (0-100) */
    humidity: Schema.optionalWith(Schema.Number, { as: 'Option' }),
    /** Pressure in hPa */
    pressure: Schema.optionalWith(Schema.Number, { as: 'Option' }),
    /** WMO weather code */
    weatherCode: Schema.optionalWith(Schema.Number, { as: 'Option' }),
    /** Human-readable weather description */
    weatherDesc: Schema.optionalWith(Schema.String, { as: 'Option' }),
    /** Wind speed in m/s */
    windSpeed: Schema.optionalWith(Schema.Number, { as: 'Option' }),
    /** Wind direction in degrees (0-360) */
    windDir: Schema.optionalWith(Schema.Number, { as: 'Option' }),
    /** Wind gusts in m/s */
    windGusts: Schema.optionalWith(Schema.Number, { as: 'Option' }),
    /** Total precipitation in mm */
    precipitation: Schema.optionalWith(Schema.Number, { as: 'Option' }),
    /** Rain in mm */
    rain: Schema.optionalWith(Schema.Number, { as: 'Option' }),
    /** Snow in mm */
    snow: Schema.optionalWith(Schema.Number, { as: 'Option' }),
    /** Visibility in meters */
    visibility: Schema.optionalWith(Schema.Number, { as: 'Option' }),
    /** Cloud cover percentage (0-100) */
    cloudCover: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  }
)
export type WeatherObservationInput = typeof WeatherObservationInput.Type

/**
 * Weather observation row from database
 */
export const WeatherObservationRow = Schema.TaggedStruct(
  'WeatherObservationRow',
  {
    time: Schema.DateTimeUtcFromDate,
    location_id: Schema.String,
    raw: Schema.Unknown,
    longitude: Schema.Number,
    latitude: Schema.Number,
    temperature: Schema.NullOr(Schema.Number),
    feels_like: Schema.NullOr(Schema.Number),
    humidity: Schema.NullOr(Schema.Number),
    pressure: Schema.NullOr(Schema.Number),
    weather_code: Schema.NullOr(Schema.Number),
    weather_desc: Schema.NullOr(Schema.String),
    wind_speed: Schema.NullOr(Schema.Number),
    wind_dir: Schema.NullOr(Schema.Number),
    wind_gusts: Schema.NullOr(Schema.Number),
    precipitation: Schema.NullOr(Schema.Number),
    rain: Schema.NullOr(Schema.Number),
    snow: Schema.NullOr(Schema.Number),
    visibility: Schema.NullOr(Schema.Number),
    cloud_cover: Schema.NullOr(Schema.Number),
  }
)
export type WeatherObservationRow = typeof WeatherObservationRow.Type

/**
 * Weather search result with distance
 */
export const WeatherSearchResult = Schema.TaggedStruct('WeatherSearchResult', {
  time: Schema.DateTimeUtcFromDate,
  location_id: Schema.String,
  longitude: Schema.Number,
  latitude: Schema.Number,
  temperature: Schema.NullOr(Schema.Number),
  feels_like: Schema.NullOr(Schema.Number),
  humidity: Schema.NullOr(Schema.Number),
  weather_code: Schema.NullOr(Schema.Number),
  weather_desc: Schema.NullOr(Schema.String),
  wind_speed: Schema.NullOr(Schema.Number),
  wind_dir: Schema.NullOr(Schema.Number),
  cloud_cover: Schema.NullOr(Schema.Number),
  /** Distance in meters (when using ST_Distance) */
  distance_m: Schema.optionalWith(Schema.Number, { as: 'Option' }),
})
export type WeatherSearchResult = typeof WeatherSearchResult.Type

/**
 * Current weather summary for a location
 */
export const CurrentWeather = Schema.TaggedStruct('CurrentWeather', {
  location_id: Schema.String,
  longitude: Schema.Number,
  latitude: Schema.Number,
  last_updated: Schema.DateTimeUtcFromDate,
  temperature: Schema.NullOr(Schema.Number),
  feels_like: Schema.NullOr(Schema.Number),
  humidity: Schema.NullOr(Schema.Number),
  pressure: Schema.NullOr(Schema.Number),
  weather_code: Schema.NullOr(Schema.Number),
  weather_desc: Schema.NullOr(Schema.String),
  wind_speed: Schema.NullOr(Schema.Number),
  wind_dir: Schema.NullOr(Schema.Number),
  visibility: Schema.NullOr(Schema.Number),
  cloud_cover: Schema.NullOr(Schema.Number),
})
export type CurrentWeather = typeof CurrentWeather.Type

// =============================================================================
// Repository Error
// =============================================================================

/**
 * Weather repository error
 */
export class WeatherRepositoryError extends Schema.TaggedError<WeatherRepositoryError>()(
  'WeatherRepositoryError',
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
 * Search options for weather observations
 */
export interface WeatherSearchOptions {
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  readonly bounds?: BBox
  /** Location ID filter */
  readonly locationId?: string
  /** From time */
  readonly from?: Date
  /** To time */
  readonly to?: Date
  /** Max number of results */
  readonly limit?: number
}

/**
 * Nearby weather search options
 */
export interface WeatherNearbyOptions {
  /** Center longitude */
  readonly longitude: number
  /** Center latitude */
  readonly latitude: number
  /** Search radius in meters */
  readonly radiusM: number
  /** Maximum age of observations in minutes */
  readonly maxAgeMinutes?: number
  /** Max number of results */
  readonly limit?: number
}

/**
 * Weather repository interface
 */
export interface WeatherRepository {
  // ---------------------------------------------------------------------------
  // Upsert Operations
  // ---------------------------------------------------------------------------

  /**
   * Insert or update a single weather observation
   */
  readonly insertObservation: (
    input: WeatherObservationInput
  ) => Effect.Effect<void, WeatherRepositoryError>

  /**
   * Batch insert/update weather observations
   */
  readonly insertObservations: (
    inputs: readonly WeatherObservationInput[]
  ) => Effect.Effect<number, WeatherRepositoryError>

  // ---------------------------------------------------------------------------
  // Query Operations
  // ---------------------------------------------------------------------------

  /**
   * Find weather observations matching search options
   */
  readonly findObservations: (
    options: WeatherSearchOptions
  ) => Effect.Effect<readonly WeatherObservationRow[], WeatherRepositoryError>

  /**
   * Find weather observations near a point
   */
  readonly findNearby: (
    options: WeatherNearbyOptions
  ) => Effect.Effect<readonly WeatherSearchResult[], WeatherRepositoryError>

  /**
   * Find a single weather observation by location ID
   */
  readonly findObservation: (
    locationId: string,
    time: Date
  ) => Effect.Effect<Option.Option<WeatherObservationRow>, WeatherRepositoryError>

  /**
   * Get current (most recent) weather for a location
   */
  readonly getCurrentWeather: (
    locationId: string
  ) => Effect.Effect<Option.Option<CurrentWeather>, WeatherRepositoryError>

  /**
   * Get current weather near a point
   */
  readonly getCurrentWeatherNearby: (
    longitude: number,
    latitude: number,
    radiusM?: number
  ) => Effect.Effect<Option.Option<CurrentWeather>, WeatherRepositoryError>

  // ---------------------------------------------------------------------------
  // Analytics
  // ---------------------------------------------------------------------------

  /**
   * Count weather observations matching criteria
   */
  readonly countObservations: (
    options?: WeatherSearchOptions
  ) => Effect.Effect<number, WeatherRepositoryError>

  /**
   * Get observation statistics for a location
   */
  readonly getLocationStats: (
    locationId: string,
    hours?: number
  ) => Effect.Effect<
    {
      readonly observation_count: number
      readonly avg_temperature: number | null
      readonly min_temperature: number | null
      readonly max_temperature: number | null
      readonly avg_humidity: number | null
    },
    WeatherRepositoryError
  >
}

// =============================================================================
// Repository Tag
// =============================================================================

export class WeatherRepositoryTag extends Context.Tag('geoint/WeatherRepository')<
  WeatherRepositoryTag,
  WeatherRepository
>() {}

// =============================================================================
// Repository Implementation
// =============================================================================

/**
 * Create Weather repository from SqlClient
 */
export const makeWeatherRepository = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  const mapError =
    (operation: string) =>
    (error: unknown): WeatherRepositoryError =>
      new WeatherRepositoryError({
        operation,
        message: String(error),
        cause: error,
      })

  // ---------------------------------------------------------------------------
  // Upsert Operations
  // ---------------------------------------------------------------------------

  const insertObservation: WeatherRepository['insertObservation'] = (input) =>
    pipe(
      sql`
        INSERT INTO raw.weather_observations (
          time, location_id, raw, position,
          temperature, feels_like, humidity, pressure,
          weather_code, weather_desc,
          wind_speed, wind_dir, wind_gusts,
          precipitation, rain, snow,
          visibility, cloud_cover
        ) VALUES (
          ${input.time},
          ${input.locationId},
          ${input.raw}::jsonb,
          ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326),
          ${Option.getOrNull(input.temperature)},
          ${Option.getOrNull(input.feelsLike)},
          ${Option.getOrNull(input.humidity)},
          ${Option.getOrNull(input.pressure)},
          ${Option.getOrNull(input.weatherCode)},
          ${Option.getOrNull(input.weatherDesc)},
          ${Option.getOrNull(input.windSpeed)},
          ${Option.getOrNull(input.windDir)},
          ${Option.getOrNull(input.windGusts)},
          ${Option.getOrNull(input.precipitation)},
          ${Option.getOrNull(input.rain)},
          ${Option.getOrNull(input.snow)},
          ${Option.getOrNull(input.visibility)},
          ${Option.getOrNull(input.cloudCover)}
        )
        ON CONFLICT (time, location_id) DO UPDATE SET
          raw = EXCLUDED.raw,
          position = EXCLUDED.position,
          temperature = EXCLUDED.temperature,
          feels_like = EXCLUDED.feels_like,
          humidity = EXCLUDED.humidity,
          pressure = EXCLUDED.pressure,
          weather_code = EXCLUDED.weather_code,
          weather_desc = EXCLUDED.weather_desc,
          wind_speed = EXCLUDED.wind_speed,
          wind_dir = EXCLUDED.wind_dir,
          wind_gusts = EXCLUDED.wind_gusts,
          precipitation = EXCLUDED.precipitation,
          rain = EXCLUDED.rain,
          snow = EXCLUDED.snow,
          visibility = EXCLUDED.visibility,
          cloud_cover = EXCLUDED.cloud_cover
      `,
      Effect.asVoid,
      Effect.mapError(mapError('insertObservation'))
    )

  const insertObservations: WeatherRepository['insertObservations'] = (
    inputs
  ) => {
    if (inputs.length === 0) {
      return Effect.succeed(0)
    }

    // Use a single batch insert with unnest for efficiency
    return pipe(
      Effect.forEach(
        inputs,
        (input) => insertObservation(input),
        { concurrency: 10 }
      ),
      Effect.map((results) => results.length),
      Effect.mapError(mapError('insertObservations'))
    )
  }

  // ---------------------------------------------------------------------------
  // Query Operations
  // ---------------------------------------------------------------------------

  const findObservations: WeatherRepository['findObservations'] = (options) => {
    const limit = options.limit ?? 100

    // Build WHERE conditions
    const conditions: string[] = ['1=1']
    if (options.locationId) {
      conditions.push(`location_id = '${options.locationId}'`)
    }

    return pipe(
      options.bounds
        ? sql<{
            time: Date
            location_id: string
            raw: unknown
            longitude: number
            latitude: number
            temperature: number | null
            feels_like: number | null
            humidity: number | null
            pressure: number | null
            weather_code: number | null
            weather_desc: string | null
            wind_speed: number | null
            wind_dir: number | null
            wind_gusts: number | null
            precipitation: number | null
            rain: number | null
            snow: number | null
            visibility: number | null
            cloud_cover: number | null
          }>`
            SELECT
              time,
              location_id,
              raw,
              ST_X(position) AS longitude,
              ST_Y(position) AS latitude,
              temperature,
              feels_like,
              humidity,
              pressure,
              weather_code,
              weather_desc,
              wind_speed,
              wind_dir,
              wind_gusts,
              precipitation,
              rain,
              snow,
              visibility,
              cloud_cover
            FROM raw.weather_observations
            WHERE position && ST_MakeEnvelope(
              ${options.bounds[0]}, ${options.bounds[1]},
              ${options.bounds[2]}, ${options.bounds[3]}, 4326
            )
            ${options.from ? sql`AND time >= ${options.from}` : sql``}
            ${options.to ? sql`AND time <= ${options.to}` : sql``}
            ${options.locationId ? sql`AND location_id = ${options.locationId}` : sql``}
            ORDER BY time DESC
            LIMIT ${limit}
          `
        : sql<{
            time: Date
            location_id: string
            raw: unknown
            longitude: number
            latitude: number
            temperature: number | null
            feels_like: number | null
            humidity: number | null
            pressure: number | null
            weather_code: number | null
            weather_desc: string | null
            wind_speed: number | null
            wind_dir: number | null
            wind_gusts: number | null
            precipitation: number | null
            rain: number | null
            snow: number | null
            visibility: number | null
            cloud_cover: number | null
          }>`
            SELECT
              time,
              location_id,
              raw,
              ST_X(position) AS longitude,
              ST_Y(position) AS latitude,
              temperature,
              feels_like,
              humidity,
              pressure,
              weather_code,
              weather_desc,
              wind_speed,
              wind_dir,
              wind_gusts,
              precipitation,
              rain,
              snow,
              visibility,
              cloud_cover
            FROM raw.weather_observations
            WHERE 1=1
            ${options.from ? sql`AND time >= ${options.from}` : sql``}
            ${options.to ? sql`AND time <= ${options.to}` : sql``}
            ${options.locationId ? sql`AND location_id = ${options.locationId}` : sql``}
            ORDER BY time DESC
            LIMIT ${limit}
          `,
      Effect.map((rows) =>
        rows.map(
          (row): WeatherObservationRow => ({
            _tag: 'WeatherObservationRow',
            time: DateTime.unsafeMake(row.time),
            location_id: row.location_id,
            raw: row.raw,
            longitude: row.longitude,
            latitude: row.latitude,
            temperature: row.temperature,
            feels_like: row.feels_like,
            humidity: row.humidity,
            pressure: row.pressure,
            weather_code: row.weather_code,
            weather_desc: row.weather_desc,
            wind_speed: row.wind_speed,
            wind_dir: row.wind_dir,
            wind_gusts: row.wind_gusts,
            precipitation: row.precipitation,
            rain: row.rain,
            snow: row.snow,
            visibility: row.visibility,
            cloud_cover: row.cloud_cover,
          })
        )
      ),
      Effect.mapError(mapError('findObservations'))
    )
  }

  const findNearby: WeatherRepository['findNearby'] = (options) => {
    const maxAgeMinutes = options.maxAgeMinutes ?? 60
    const limit = options.limit ?? 10

    return pipe(
      sql<{
        time: Date
        location_id: string
        longitude: number
        latitude: number
        temperature: number | null
        feels_like: number | null
        humidity: number | null
        weather_code: number | null
        weather_desc: string | null
        wind_speed: number | null
        wind_dir: number | null
        cloud_cover: number | null
        distance_m: number
      }>`
        SELECT
          time,
          location_id,
          ST_X(position) AS longitude,
          ST_Y(position) AS latitude,
          temperature,
          feels_like,
          humidity,
          weather_code,
          weather_desc,
          wind_speed,
          wind_dir,
          cloud_cover,
          ST_Distance(
            position::geography,
            ST_SetSRID(ST_MakePoint(${options.longitude}, ${options.latitude}), 4326)::geography
          ) AS distance_m
        FROM raw.weather_observations
        WHERE ST_DWithin(
          position::geography,
          ST_SetSRID(ST_MakePoint(${options.longitude}, ${options.latitude}), 4326)::geography,
          ${options.radiusM}
        )
        AND time >= NOW() - (${maxAgeMinutes} || ' minutes')::interval
        ORDER BY distance_m ASC, time DESC
        LIMIT ${limit}
      `,
      Effect.map((rows) =>
        rows.map(
          (row): WeatherSearchResult => ({
            _tag: 'WeatherSearchResult',
            time: DateTime.unsafeMake(row.time),
            location_id: row.location_id,
            longitude: row.longitude,
            latitude: row.latitude,
            temperature: row.temperature,
            feels_like: row.feels_like,
            humidity: row.humidity,
            weather_code: row.weather_code,
            weather_desc: row.weather_desc,
            wind_speed: row.wind_speed,
            wind_dir: row.wind_dir,
            cloud_cover: row.cloud_cover,
            distance_m: Option.some(row.distance_m),
          })
        )
      ),
      Effect.mapError(mapError('findNearby'))
    )
  }

  const findObservation: WeatherRepository['findObservation'] = (
    locationId,
    time
  ) =>
    pipe(
      sql<{
        time: Date
        location_id: string
        raw: unknown
        longitude: number
        latitude: number
        temperature: number | null
        feels_like: number | null
        humidity: number | null
        pressure: number | null
        weather_code: number | null
        weather_desc: string | null
        wind_speed: number | null
        wind_dir: number | null
        wind_gusts: number | null
        precipitation: number | null
        rain: number | null
        snow: number | null
        visibility: number | null
        cloud_cover: number | null
      }>`
        SELECT
          time,
          location_id,
          raw,
          ST_X(position) AS longitude,
          ST_Y(position) AS latitude,
          temperature,
          feels_like,
          humidity,
          pressure,
          weather_code,
          weather_desc,
          wind_speed,
          wind_dir,
          wind_gusts,
          precipitation,
          rain,
          snow,
          visibility,
          cloud_cover
        FROM raw.weather_observations
        WHERE location_id = ${locationId} AND time = ${time}
        LIMIT 1
      `,
      Effect.map((rows) =>
        rows.length > 0
          ? Option.some<WeatherObservationRow>({
              _tag: 'WeatherObservationRow',
              time: DateTime.unsafeMake(rows[0].time),
              location_id: rows[0].location_id,
              raw: rows[0].raw,
              longitude: rows[0].longitude,
              latitude: rows[0].latitude,
              temperature: rows[0].temperature,
              feels_like: rows[0].feels_like,
              humidity: rows[0].humidity,
              pressure: rows[0].pressure,
              weather_code: rows[0].weather_code,
              weather_desc: rows[0].weather_desc,
              wind_speed: rows[0].wind_speed,
              wind_dir: rows[0].wind_dir,
              wind_gusts: rows[0].wind_gusts,
              precipitation: rows[0].precipitation,
              rain: rows[0].rain,
              snow: rows[0].snow,
              visibility: rows[0].visibility,
              cloud_cover: rows[0].cloud_cover,
            })
          : Option.none()
      ),
      Effect.mapError(mapError('findObservation'))
    )

  const getCurrentWeather: WeatherRepository['getCurrentWeather'] = (
    locationId
  ) =>
    pipe(
      sql<{
        location_id: string
        longitude: number
        latitude: number
        last_updated: Date
        temperature: number | null
        feels_like: number | null
        humidity: number | null
        pressure: number | null
        weather_code: number | null
        weather_desc: string | null
        wind_speed: number | null
        wind_dir: number | null
        visibility: number | null
        cloud_cover: number | null
      }>`
        SELECT
          location_id,
          ST_X(position) AS longitude,
          ST_Y(position) AS latitude,
          time AS last_updated,
          temperature,
          feels_like,
          humidity,
          pressure,
          weather_code,
          weather_desc,
          wind_speed,
          wind_dir,
          visibility,
          cloud_cover
        FROM raw.weather_observations
        WHERE location_id = ${locationId}
        ORDER BY time DESC
        LIMIT 1
      `,
      Effect.map((rows) =>
        rows.length > 0
          ? Option.some<CurrentWeather>({
              _tag: 'CurrentWeather',
              location_id: rows[0].location_id,
              longitude: rows[0].longitude,
              latitude: rows[0].latitude,
              last_updated: DateTime.unsafeMake(rows[0].last_updated),
              temperature: rows[0].temperature,
              feels_like: rows[0].feels_like,
              humidity: rows[0].humidity,
              pressure: rows[0].pressure,
              weather_code: rows[0].weather_code,
              weather_desc: rows[0].weather_desc,
              wind_speed: rows[0].wind_speed,
              wind_dir: rows[0].wind_dir,
              visibility: rows[0].visibility,
              cloud_cover: rows[0].cloud_cover,
            })
          : Option.none()
      ),
      Effect.mapError(mapError('getCurrentWeather'))
    )

  const getCurrentWeatherNearby: WeatherRepository['getCurrentWeatherNearby'] =
    (longitude, latitude, radiusM = 50000) =>
      pipe(
        sql<{
          location_id: string
          longitude: number
          latitude: number
          last_updated: Date
          temperature: number | null
          feels_like: number | null
          humidity: number | null
          pressure: number | null
          weather_code: number | null
          weather_desc: string | null
          wind_speed: number | null
          wind_dir: number | null
          visibility: number | null
          cloud_cover: number | null
        }>`
          SELECT DISTINCT ON (location_id)
            location_id,
            ST_X(position) AS longitude,
            ST_Y(position) AS latitude,
            time AS last_updated,
            temperature,
            feels_like,
            humidity,
            pressure,
            weather_code,
            weather_desc,
            wind_speed,
            wind_dir,
            visibility,
            cloud_cover
          FROM raw.weather_observations
          WHERE ST_DWithin(
            position::geography,
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
            ${radiusM}
          )
          ORDER BY location_id, time DESC
        `,
        Effect.map((rows) =>
          rows.length > 0
            ? Option.some<CurrentWeather>({
                _tag: 'CurrentWeather',
                location_id: rows[0].location_id,
                longitude: rows[0].longitude,
                latitude: rows[0].latitude,
                last_updated: DateTime.unsafeMake(rows[0].last_updated),
                temperature: rows[0].temperature,
                feels_like: rows[0].feels_like,
                humidity: rows[0].humidity,
                pressure: rows[0].pressure,
                weather_code: rows[0].weather_code,
                weather_desc: rows[0].weather_desc,
                wind_speed: rows[0].wind_speed,
                wind_dir: rows[0].wind_dir,
                visibility: rows[0].visibility,
                cloud_cover: rows[0].cloud_cover,
              })
            : Option.none()
        ),
        Effect.mapError(mapError('getCurrentWeatherNearby'))
      )

  // ---------------------------------------------------------------------------
  // Analytics
  // ---------------------------------------------------------------------------

  const countObservations: WeatherRepository['countObservations'] = (
    options = {}
  ) =>
    pipe(
      options.bounds
        ? sql<{ count: string }>`
            SELECT COUNT(*)::text AS count
            FROM raw.weather_observations
            WHERE position && ST_MakeEnvelope(
              ${options.bounds[0]}, ${options.bounds[1]},
              ${options.bounds[2]}, ${options.bounds[3]}, 4326
            )
            ${options.from ? sql`AND time >= ${options.from}` : sql``}
            ${options.to ? sql`AND time <= ${options.to}` : sql``}
            ${options.locationId ? sql`AND location_id = ${options.locationId}` : sql``}
          `
        : sql<{ count: string }>`
            SELECT COUNT(*)::text AS count
            FROM raw.weather_observations
            WHERE 1=1
            ${options.from ? sql`AND time >= ${options.from}` : sql``}
            ${options.to ? sql`AND time <= ${options.to}` : sql``}
            ${options.locationId ? sql`AND location_id = ${options.locationId}` : sql``}
          `,
      Effect.map((rows) => parseInt(rows[0]?.count ?? '0', 10)),
      Effect.mapError(mapError('countObservations'))
    )

  const getLocationStats: WeatherRepository['getLocationStats'] = (
    locationId,
    hours = 24
  ) =>
    pipe(
      sql<{
        observation_count: string
        avg_temperature: number | null
        min_temperature: number | null
        max_temperature: number | null
        avg_humidity: number | null
      }>`
        SELECT
          COUNT(*)::text AS observation_count,
          AVG(temperature) AS avg_temperature,
          MIN(temperature) AS min_temperature,
          MAX(temperature) AS max_temperature,
          AVG(humidity) AS avg_humidity
        FROM raw.weather_observations
        WHERE location_id = ${locationId}
          AND time >= NOW() - (${hours} || ' hours')::interval
      `,
      Effect.map((rows) => ({
        observation_count: parseInt(rows[0]?.observation_count ?? '0', 10),
        avg_temperature: rows[0]?.avg_temperature ?? null,
        min_temperature: rows[0]?.min_temperature ?? null,
        max_temperature: rows[0]?.max_temperature ?? null,
        avg_humidity: rows[0]?.avg_humidity ?? null,
      })),
      Effect.mapError(mapError('getLocationStats'))
    )

  // ---------------------------------------------------------------------------
  // Return Repository
  // ---------------------------------------------------------------------------

  return {
    insertObservation,
    insertObservations,
    findObservations,
    findNearby,
    findObservation,
    getCurrentWeather,
    getCurrentWeatherNearby,
    countObservations,
    getLocationStats,
  } satisfies WeatherRepository
})

// =============================================================================
// Repository Layer
// =============================================================================

/**
 * Live layer for WeatherRepository
 * Requires PgClient.PgClient
 */
export const WeatherRepositoryLive = Layer.effect(
  WeatherRepositoryTag,
  makeWeatherRepository
)

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a location ID from coordinates
 * Uses a simple hash of lat/lon with 4 decimal places (~11m precision)
 */
export const makeLocationId = (longitude: number, latitude: number): string => {
  const lon = longitude.toFixed(4)
  const lat = latitude.toFixed(4)
  return `${lat}_${lon}`
}
