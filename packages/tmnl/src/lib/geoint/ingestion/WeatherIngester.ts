/**
 * WeatherIngester - Continuous weather data ingestion service
 *
 * Polls Open-Meteo API on configurable intervals for grid-based locations,
 * transforms responses to WeatherObservationInput, and inserts into raw.weather_observations.
 *
 * Features:
 * - Configurable ingestion grids (bounding boxes with resolution)
 * - Independent polling intervals per grid
 * - Graceful error handling (logs failures, continues ingestion)
 * - Ingestion metrics logging to raw.ingestion_log
 *
 * Rate limits:
 * - Open-Meteo: 60 req/min (no API key required)
 *
 * @see beads:tmnl-weather-ingester WeatherIngester service
 * @module
 */

import {
  Effect,
  Layer,
  Context,
  Schedule,
  Duration,
  Option,
  Schema,
  Fiber,
  pipe,
} from 'effect'
import { PgClient } from '@effect/sql-pg'
import { WeatherForecast } from '../schemas'
import {
  OpenMeteoClientService,
  type ExternalApiError,
  type RateLimitError,
  type TimeoutError,
} from '../api/ExternalApiClient'
import {
  WeatherRepositoryTag,
  type WeatherObservationInput,
  makeLocationId,
} from '../persistence/postgis/WeatherRepository'
import { WeatherStreamHandle } from '../services/WeatherStreamHandle'
import { WeatherObservationEvent, type WeatherSource } from '../schemas/weather-events'

// =============================================================================
// Schemas
// =============================================================================

/**
 * Weather ingestion grid configuration
 */
export const WeatherIngestionGrid = Schema.Struct({
  /** Grid name for logging */
  name: Schema.String,
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  bounds: Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number),
  /** Grid resolution in degrees (default: 0.25 = ~27km at equator) */
  resolution: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { default: () => 0.25 }),
  /** TTL for cached observations in minutes (default: 60) */
  ttlMinutes: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { default: () => 60 }),
})
export type WeatherIngestionGrid = typeof WeatherIngestionGrid.Type

/**
 * WeatherIngester configuration
 */
export const WeatherIngesterConfig = Schema.Struct({
  /** Grids to poll */
  grids: Schema.Array(WeatherIngestionGrid),
  /** Polling interval in milliseconds (default: 300000 = 5 minutes) */
  intervalMs: Schema.optionalWith(Schema.Number, { default: () => 300000 }),
  /** Query timeout in milliseconds (default: 30000 = 30 seconds) */
  queryTimeoutMs: Schema.optionalWith(Schema.Number, { default: () => 30000 }),
  /** Enable ingestion logging to raw.ingestion_log */
  logIngestion: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Include hourly forecast data */
  includeHourly: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Number of hours for hourly forecast (default: 24) */
  hourlyHours: Schema.optionalWith(Schema.Number, { default: () => 24 }),
})
export type WeatherIngesterConfig = typeof WeatherIngesterConfig.Type

/**
 * Default ingestion grids
 */
export const DEFAULT_WEATHER_INGESTION_GRID: readonly WeatherIngestionGrid[] = [
  {
    name: 'sf-bay-area',
    bounds: [-122.6, 37.3, -121.8, 37.9],
    resolution: 0.25,
    ttlMinutes: 60,
  },
]

/**
 * Default WeatherIngester configuration
 */
export const DEFAULT_WEATHER_INGESTER_CONFIG: WeatherIngesterConfig = {
  grids: [...DEFAULT_WEATHER_INGESTION_GRID],
  intervalMs: 300000, // 5 minutes
  queryTimeoutMs: 30000,
  logIngestion: true,
  includeHourly: false,
  hourlyHours: 24,
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * WMO Weather Code descriptions
 * @see https://open-meteo.com/en/docs#weathervariables
 */
export const WMO_WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
}

/**
 * Get weather description from WMO code
 */
export const wmoCodeToDescription = (code: number): string | undefined =>
  WMO_WEATHER_CODES[code]

/**
 * Generate a stable location ID from coordinates
 * Uses 4 decimal places (~11m precision)
 */
export const generateLocationId = (latitude: number, longitude: number): string =>
  makeLocationId(longitude, latitude)

/**
 * Grid point for weather queries
 */
export interface GridPoint {
  readonly lat: number
  readonly lon: number
}

/**
 * Generate grid points for a given grid configuration
 * Creates a uniform grid of points within the bounding box
 */
export const generateGridPoints = (grid: WeatherIngestionGrid): readonly GridPoint[] => {
  const [minLon, minLat, maxLon, maxLat] = grid.bounds
  const resolution = grid.resolution

  const points: GridPoint[] = []

  // Generate points from min to max (inclusive)
  for (let lat = minLat; lat <= maxLat + 0.0001; lat += resolution) {
    for (let lon = minLon; lon <= maxLon + 0.0001; lon += resolution) {
      // Clamp to bounds to avoid floating point errors
      points.push({
        lat: Math.min(lat, maxLat),
        lon: Math.min(lon, maxLon),
      })
    }
  }

  return points
}

// =============================================================================
// Transformers
// =============================================================================

/**
 * Transform WeatherForecast current weather to WeatherObservationInput
 */
export const weatherForecastToObservationInput = (
  forecast: WeatherForecast,
  raw: unknown,
  _ttlMinutes: number
): WeatherObservationInput | null => {
  // Skip forecasts without current weather
  if (forecast.current === undefined) {
    return null
  }

  const current = forecast.current
  const weatherDesc = current.weatherCode !== undefined
    ? wmoCodeToDescription(current.weatherCode)
    : undefined

  return {
    _tag: 'WeatherObservationInput',
    time: current.time,
    locationId: generateLocationId(forecast.latitude, forecast.longitude),
    raw,
    longitude: forecast.longitude,
    latitude: forecast.latitude,
    temperature: current.temperature !== undefined ? Option.some(current.temperature) : Option.none(),
    feelsLike: current.feelsLike !== undefined ? Option.some(current.feelsLike) : Option.none(),
    humidity: current.humidity !== undefined ? Option.some(current.humidity) : Option.none(),
    pressure: current.pressure !== undefined ? Option.some(current.pressure) : Option.none(),
    weatherCode: current.weatherCode !== undefined ? Option.some(current.weatherCode) : Option.none(),
    weatherDesc: weatherDesc !== undefined ? Option.some(weatherDesc) : Option.none(),
    windSpeed: current.windSpeed !== undefined ? Option.some(current.windSpeed) : Option.none(),
    windDir: current.windDirection !== undefined ? Option.some(current.windDirection) : Option.none(),
    windGusts: current.windGusts !== undefined ? Option.some(current.windGusts) : Option.none(),
    precipitation: current.precipitation !== undefined ? Option.some(current.precipitation) : Option.none(),
    rain: Option.none(),
    snow: Option.none(),
    visibility: Option.none(),
    cloudCover: current.cloudCover !== undefined ? Option.some(current.cloudCover) : Option.none(),
  }
}

/**
 * Transform WeatherForecast hourly data to multiple WeatherObservationInputs
 */
export const weatherForecastToHourlyInputs = (
  forecast: WeatherForecast,
  raw: unknown,
  _ttlMinutes: number
): readonly WeatherObservationInput[] => {
  // Skip forecasts without hourly data
  if (forecast.hourly === undefined || forecast.hourly.length === 0) {
    return []
  }

  const locationId = generateLocationId(forecast.latitude, forecast.longitude)

  return forecast.hourly.map((hourly): WeatherObservationInput => {
    const weatherDesc = hourly.weatherCode !== undefined
      ? wmoCodeToDescription(hourly.weatherCode)
      : undefined

    return {
      _tag: 'WeatherObservationInput',
      time: hourly.time,
      locationId,
      raw,
      longitude: forecast.longitude,
      latitude: forecast.latitude,
      temperature: hourly.temperature !== undefined ? Option.some(hourly.temperature) : Option.none(),
      feelsLike: hourly.feelsLike !== undefined ? Option.some(hourly.feelsLike) : Option.none(),
      humidity: hourly.humidity !== undefined ? Option.some(hourly.humidity) : Option.none(),
      pressure: Option.none(),
      weatherCode: hourly.weatherCode !== undefined ? Option.some(hourly.weatherCode) : Option.none(),
      weatherDesc: weatherDesc !== undefined ? Option.some(weatherDesc) : Option.none(),
      windSpeed: hourly.windSpeed !== undefined ? Option.some(hourly.windSpeed) : Option.none(),
      windDir: hourly.windDirection !== undefined ? Option.some(hourly.windDirection) : Option.none(),
      windGusts: hourly.windGusts !== undefined ? Option.some(hourly.windGusts) : Option.none(),
      precipitation: hourly.precipitation !== undefined ? Option.some(hourly.precipitation) : Option.none(),
      rain: Option.none(),
      snow: Option.none(),
      visibility: hourly.visibility !== undefined ? Option.some(hourly.visibility) : Option.none(),
      cloudCover: hourly.cloudCover !== undefined ? Option.some(hourly.cloudCover) : Option.none(),
    }
  })
}

// =============================================================================
// Temperature Conversion Utilities
// =============================================================================

/**
 * Convert Celsius to Fahrenheit
 */
export const celsiusToFahrenheit = (celsius: number): number =>
  (celsius * 9 / 5) + 32

/**
 * Convert Fahrenheit to Celsius
 */
export const fahrenheitToCelsius = (fahrenheit: number): number =>
  (fahrenheit - 32) * 5 / 9

// =============================================================================
// Error Types
// =============================================================================

/**
 * WeatherIngester error
 */
export class WeatherIngesterError extends Schema.TaggedError<WeatherIngesterError>()(
  'WeatherIngesterError',
  {
    source: Schema.Literal('openmeteo', 'internal'),
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

// =============================================================================
// Ingestion Result
// =============================================================================

/**
 * Result of a single weather ingestion operation
 */
export interface WeatherIngestionResult {
  readonly source: 'openmeteo'
  readonly grid: string
  readonly recordsIngested: number
  readonly pointsQueried: number
  readonly latencyMs: number
  readonly error?: string
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * WeatherIngester service interface
 */
export interface WeatherIngester {
  /**
   * Ingest weather data for a specific grid
   */
  readonly ingestGrid: (
    grid: WeatherIngestionGrid
  ) => Effect.Effect<WeatherIngestionResult, WeatherIngesterError>

  /**
   * Ingest weather for a single point
   */
  readonly ingestPoint: (
    lat: number,
    lon: number,
    ttlMinutes: number
  ) => Effect.Effect<WeatherObservationInput | null, WeatherIngesterError>

  /**
   * Start continuous ingestion for all configured grids
   * Returns fiber handle for the polling loop
   */
  readonly start: () => Effect.Effect<
    Fiber.RuntimeFiber<void, WeatherIngesterError>,
    WeatherIngesterError
  >

  /**
   * Stop ingestion fiber
   */
  readonly stop: (
    fiber: Fiber.RuntimeFiber<void, WeatherIngesterError>
  ) => Effect.Effect<void, never>

  /**
   * Get the current configuration
   */
  readonly config: WeatherIngesterConfig
}

// =============================================================================
// Service Tag
// =============================================================================

/**
 * WeatherIngester service tag
 */
export class WeatherIngesterTag extends Context.Tag('geoint/WeatherIngester')<
  WeatherIngesterTag,
  WeatherIngester
>() {}

/**
 * WeatherIngester config tag
 */
export class WeatherIngesterConfigTag extends Context.Tag('geoint/WeatherIngesterConfig')<
  WeatherIngesterConfigTag,
  WeatherIngesterConfig
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create WeatherIngester service
 */
export const makeWeatherIngester = Effect.gen(function* () {
  const config = yield* WeatherIngesterConfigTag
  const weatherRepo = yield* WeatherRepositoryTag
  const openMeteoClient = yield* Effect.serviceOption(OpenMeteoClientService)
  const weatherStream = yield* Effect.serviceOption(WeatherStreamHandle)
  const sql = yield* PgClient.PgClient

  /**
   * Transform WeatherObservationInput to WeatherObservationEvent for stream publishing.
   */
  const toWeatherEvent = (input: WeatherObservationInput): WeatherObservationEvent => {
    return new WeatherObservationEvent({
      locationId: input.locationId,
      source: 'openmeteo' as WeatherSource,
      position: [input.longitude, input.latitude],
      observedAt: input.time,
      temperature: Option.isSome(input.temperature) ? input.temperature.value : undefined,
      feelsLike: Option.isSome(input.feelsLike) ? input.feelsLike.value : undefined,
      humidity: Option.isSome(input.humidity) ? input.humidity.value : undefined,
      pressure: Option.isSome(input.pressure) ? input.pressure.value : undefined,
      weatherCode: Option.isSome(input.weatherCode) ? input.weatherCode.value : undefined,
      weatherDesc: Option.isSome(input.weatherDesc) ? input.weatherDesc.value : undefined,
      windSpeed: Option.isSome(input.windSpeed) ? input.windSpeed.value : undefined,
      windDir: Option.isSome(input.windDir) ? input.windDir.value : undefined,
      windGusts: Option.isSome(input.windGusts) ? input.windGusts.value : undefined,
      precipitation: Option.isSome(input.precipitation) ? input.precipitation.value : undefined,
      cloudCover: Option.isSome(input.cloudCover) ? input.cloudCover.value : undefined,
      visibility: Option.isSome(input.visibility) ? input.visibility.value : undefined,
      ingestedAt: new Date(),
    })
  }

  /**
   * Log ingestion result to raw.ingestion_log
   */
  const logIngestion = (result: WeatherIngestionResult): Effect.Effect<void, never> => {
    if (!config.logIngestion) return Effect.void

    return pipe(
      sql`
        INSERT INTO raw.ingestion_log (time, source, operation, records_ingested, latency_ms, error)
        VALUES (
          NOW(),
          ${result.source},
          ${'ingest:' + result.grid},
          ${result.recordsIngested},
          ${result.latencyMs},
          ${result.error ?? null}
        )
      `,
      Effect.asVoid,
      Effect.catchAll(() => Effect.void) // Don't fail ingestion if logging fails
    )
  }

  /**
   * Ingest weather for a single point
   */
  const ingestPoint: WeatherIngester['ingestPoint'] = (lat, lon, ttlMinutes) =>
    Effect.gen(function* (_) {
      if (Option.isNone(openMeteoClient)) {
        return null
      }

      const client = openMeteoClient.value

      // Fetch weather forecast
      const fetchResult = yield* client.getForecast({
        latitude: lat,
        longitude: lon,
        current: true,
        hourly: config.includeHourly,
        forecastDays: 1,
      }).pipe(
        Effect.map((response) => ({ _tag: 'success' as const, response })),
        Effect.catchAll((error: ExternalApiError | RateLimitError | TimeoutError) =>
          Effect.succeed({ _tag: 'error' as const, message: error.message })
        )
      )

      if (fetchResult._tag === 'error') {
        yield* Effect.logWarning(`Weather fetch failed for (${lat}, ${lon}): ${fetchResult.message}`)
        return null
      }

      // Transform to observation input
      const observation = weatherForecastToObservationInput(
        fetchResult.response,
        fetchResult.response,
        ttlMinutes
      )

      return observation
    }).pipe(
      Effect.mapError((e) => new WeatherIngesterError({
        source: 'openmeteo',
        operation: 'ingestPoint',
        message: String(e),
        cause: e,
      })),
      // Type assertion: Effect.logWarning has never as R, no real requirements
      (effect) => effect as Effect.Effect<WeatherObservationInput | null, WeatherIngesterError>
    )

  /**
   * Ingest weather data for a grid
   */
  const ingestGrid: WeatherIngester['ingestGrid'] = (grid) =>
    Effect.gen(function* () {
      const startTime = Date.now()

      if (Option.isNone(openMeteoClient)) {
        return {
          source: 'openmeteo' as const,
          grid: grid.name,
          recordsIngested: 0,
          pointsQueried: 0,
          latencyMs: Date.now() - startTime,
          error: 'Open-Meteo client not available',
        }
      }

      // Generate grid points
      const points = generateGridPoints(grid)
      yield* Effect.logDebug(`Weather grid ${grid.name}: ${points.length} points to query`)

      // Query weather for each point with bounded concurrency
      const observations: WeatherObservationInput[] = []

      yield* Effect.forEach(
        points,
        (point) =>
          ingestPoint(point.lat, point.lon, grid.ttlMinutes).pipe(
            Effect.tap((obs) => {
              if (obs !== null) {
                observations.push(obs)
              }
              return Effect.void
            }),
            Effect.catchAll((error) =>
              Effect.logWarning(`Weather point (${point.lat}, ${point.lon}) failed: ${error.message}`)
            )
          ),
        { concurrency: 5 } // Respect rate limits
      )

      // Transform observations to events for stream publishing
      const events = observations.map(toWeatherEvent)

      // Check if we have stream handle for transactional outbox
      if (Option.isSome(weatherStream)) {
        const streamHandle = weatherStream.value

        // TRANSACTIONAL OUTBOX: Insert + Publish atomically
        const insertedCount = yield* sql.withTransaction(
          Effect.gen(function* () {
            // 1. Insert into raw.weather_observations
            const count = yield* weatherRepo.insertObservations(observations)

            // 2. Publish to DurableStream (within same transaction)
            yield* streamHandle.appendBatch(events)

            yield* Effect.logDebug(
              `[WeatherIngester] Transactional commit: ${count} observations + ${events.length} events for ${grid.name}`
            )

            return count
          })
        ).pipe(
          Effect.catchAll((error) =>
            Effect.logWarning(`Weather transactional insert failed: ${String(error)}`).pipe(
              Effect.as(0)
            )
          )
        )

        const result: WeatherIngestionResult = {
          source: 'openmeteo',
          grid: grid.name,
          recordsIngested: insertedCount,
          pointsQueried: points.length,
          latencyMs: Date.now() - startTime,
        }

        yield* logIngestion(result)
        yield* Effect.logDebug(`Weather ${grid.name}: ${insertedCount} observations ingested (with stream)`)

        return result
      }

      // Fallback: No stream handle - just insert to database
      const insertedCount = yield* weatherRepo.insertObservations(observations).pipe(
        Effect.catchAll((error) =>
          Effect.logWarning(`Weather insert failed: ${error.message}`).pipe(
            Effect.as(0)
          )
        )
      )

      const result: WeatherIngestionResult = {
        source: 'openmeteo',
        grid: grid.name,
        recordsIngested: insertedCount,
        pointsQueried: points.length,
        latencyMs: Date.now() - startTime,
      }

      yield* logIngestion(result)
      yield* Effect.logDebug(`Weather ${grid.name}: ${insertedCount} observations ingested (no stream)`)

      return result
    })

  /**
   * Start continuous ingestion
   */
  const start: WeatherIngester['start'] = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Starting weather ingestion service')
      yield* Effect.logInfo(`Grids: ${config.grids.map((g) => g.name).join(', ')}`)

      // Create polling loop
      const pollingLoop = pipe(
        Effect.forEach(
          config.grids,
          (grid) =>
            ingestGrid(grid).pipe(
              Effect.catchAll((error) => {
                return Effect.logWarning(`Weather ingestion error: ${error.message}`)
              })
            ),
          { concurrency: 1 } // Sequential to respect rate limits
        ),
        Effect.repeat(Schedule.spaced(Duration.millis(config.intervalMs))),
        Effect.asVoid
      )

      // Fork the loop
      const fiber = yield* Effect.fork(pollingLoop)

      yield* Effect.logInfo('Weather ingestion started')

      return fiber
    })

  /**
   * Stop ingestion fiber
   */
  const stop: WeatherIngester['stop'] = (fiber) =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Stopping weather ingestion service')
      yield* Fiber.interrupt(fiber)
      yield* Effect.logInfo('Weather ingestion stopped')
    })

  return {
    ingestGrid,
    ingestPoint,
    start,
    stop,
    config,
  } satisfies WeatherIngester
})

// =============================================================================
// Layers
// =============================================================================

/**
 * Default WeatherIngester config layer
 */
export const WeatherIngesterConfigDefault = Layer.succeed(
  WeatherIngesterConfigTag,
  DEFAULT_WEATHER_INGESTER_CONFIG
)

/**
 * WeatherIngester service layer
 *
 * Requires:
 * - WeatherIngesterConfigTag
 * - WeatherRepositoryTag
 * - PgClient.PgClient
 * - OpenMeteoClientService (optional)
 */
export const WeatherIngesterLive = Layer.effect(WeatherIngesterTag, makeWeatherIngester)

/**
 * WeatherIngester with default config
 *
 * Requires:
 * - WeatherRepositoryTag
 * - PgClient.PgClient
 * - OpenMeteoClientService (optional)
 */
export const WeatherIngesterDefault = WeatherIngesterLive.pipe(
  Layer.provide(WeatherIngesterConfigDefault)
)
