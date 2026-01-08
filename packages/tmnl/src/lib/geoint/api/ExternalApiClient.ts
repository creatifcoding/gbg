/**
 * External API Client Services
 *
 * Effect HttpClient implementations for external GEOINT APIs:
 * - OpenSky Network (ADS-B flight tracking)
 * - Overpass API (OpenStreetMap POI queries)
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Rate limiting per API
 * - Response parsing with Effect Schema
 * - Timeout handling
 *
 * @see beads:tmnl-cds9q HttpApi: External API Integrations
 * @module
 */

import {
  Effect,
  Layer,
  Context,
  Schema,
  Duration,
  Ref,
  pipe,
} from 'effect'
import { HttpClient, HttpClientRequest } from '@effect/platform'
import {
  OpenSkyStateVector,
  OpenSkyResponse,
  OverpassElement,
  OverpassResponse,
  AdsbLolAircraft,
  AdsbLolResponse,
  AdsbLolResponseSchema,
  PlanetItemType,
  PlanetItem,
  PlanetSearchResponse,
  PlanetSearchResponseSchema,
  PlanetItemSchema,
  SentinelCollection,
  SentinelItem,
  SentinelSearchResponse,
  SentinelSearchResponseSchema,
  SentinelItemSchema,
  WeatherForecast,
  WeatherForecastSchema,
  GeocodingResponse,
  GeocodingResponseSchema,
  GeocodingLocation,
  SearchResultFlight,
  SearchResultPoi,
  SearchResultFeature,
  SearchResultWeather,
  SearchResultImagery,
  SearchResultId,
  Icao24,
  AircraftCategory,
  PoiId,
  FeatureId,
} from '../schemas'

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error from external API call
 */
export class ExternalApiError extends Schema.TaggedError<ExternalApiError>()(
  'ExternalApiError',
  {
    source: Schema.String,
    statusCode: Schema.Number,
    message: Schema.String,
    retryable: Schema.Boolean,
  }
) {}

/**
 * Rate limit error
 */
export class RateLimitError extends Schema.TaggedError<RateLimitError>()(
  'RateLimitError',
  {
    source: Schema.String,
    retryAfterSeconds: Schema.Number,
    message: Schema.String,
  }
) {}

/**
 * Timeout error
 */
export class TimeoutError extends Schema.TaggedError<TimeoutError>()(
  'TimeoutError',
  {
    source: Schema.String,
    timeoutMs: Schema.Number,
    message: Schema.String,
  }
) {}

// =============================================================================
// Rate Limiter
// =============================================================================

/**
 * Simple token bucket rate limiter
 */
export interface RateLimiter {
  readonly acquire: Effect.Effect<void, RateLimitError>
  readonly release: Effect.Effect<void>
}

/**
 * Create a token bucket rate limiter
 */
export const makeRateLimiter = (
  source: string,
  tokensPerMinute: number,
  burstSize: number
): Effect.Effect<RateLimiter, never, never> =>
  Effect.gen(function* () {
    const tokens = yield* Ref.make(burstSize)
    const lastRefill = yield* Ref.make(Date.now())

    const refillTokens = Effect.gen(function* () {
      const now = Date.now()
      const last = yield* Ref.get(lastRefill)
      const elapsed = now - last
      const tokensToAdd = Math.floor((elapsed / 60000) * tokensPerMinute)

      if (tokensToAdd > 0) {
        yield* Ref.set(lastRefill, now)
        yield* Ref.update(tokens, (t) => Math.min(t + tokensToAdd, burstSize))
      }
    })

    const acquire: Effect.Effect<void, RateLimitError> = Effect.gen(function* () {
      yield* refillTokens
      const current = yield* Ref.get(tokens)

      if (current <= 0) {
        const waitSeconds = Math.ceil(60 / tokensPerMinute)
        yield* Effect.fail(
          new RateLimitError({
            source,
            retryAfterSeconds: waitSeconds,
            message: `Rate limit exceeded for ${source}. Try again in ${waitSeconds}s.`,
          })
        )
      }

      yield* Ref.update(tokens, (t) => t - 1)
    })

    const release: Effect.Effect<void> = Ref.update(tokens, (t) =>
      Math.min(t + 1, burstSize)
    )

    return { acquire, release } as RateLimiter
  })

// =============================================================================
// OpenSky Client
// =============================================================================

/**
 * OpenSky Network API configuration
 */
export interface OpenSkyConfig {
  readonly baseUrl: string
  readonly username?: string
  readonly password?: string
  readonly timeoutMs: number
  readonly requestsPerMinute: number
}

/**
 * Default OpenSky configuration
 */
export const DEFAULT_OPENSKY_CONFIG: OpenSkyConfig = {
  baseUrl: 'https://opensky-network.org/api',
  timeoutMs: 30000,
  requestsPerMinute: 10, // Anonymous limit
}

/**
 * OpenSky client service interface
 */
export interface OpenSkyClient {
  readonly getStates: (options: {
    bounds?: readonly [number, number, number, number]
    icao24?: readonly string[]
    time?: number
  }) => Effect.Effect<OpenSkyResponse, ExternalApiError | RateLimitError | TimeoutError>
}

/**
 * OpenSky client service tag
 */
export class OpenSkyClientService extends Context.Tag('geoint/OpenSkyClient')<
  OpenSkyClientService,
  OpenSkyClient
>() {}

/**
 * Raw OpenSky state tuple type (17 required + 1 optional element)
 */
const OpenSkyStateTuple = Schema.Tuple(
  Schema.String,                   // 0: icao24
  Schema.NullOr(Schema.String),    // 1: callsign
  Schema.String,                   // 2: origin_country
  Schema.NullOr(Schema.Number),    // 3: time_position
  Schema.Number,                   // 4: last_contact
  Schema.NullOr(Schema.Number),    // 5: longitude
  Schema.NullOr(Schema.Number),    // 6: latitude
  Schema.NullOr(Schema.Number),    // 7: baro_altitude
  Schema.Boolean,                  // 8: on_ground
  Schema.NullOr(Schema.Number),    // 9: velocity
  Schema.NullOr(Schema.Number),    // 10: true_track
  Schema.NullOr(Schema.Number),    // 11: vertical_rate
  Schema.NullOr(Schema.Array(Schema.Number)), // 12: sensors
  Schema.NullOr(Schema.Number),    // 13: geo_altitude
  Schema.NullOr(Schema.String),    // 14: squawk
  Schema.Boolean,                  // 15: spi
  Schema.Number,                   // 16: position_source
  Schema.optionalElement(Schema.Number),  // 17: category (optional)
)

/**
 * Raw OpenSky API response schema
 */
const OpenSkyRawResponse = Schema.Struct({
  time: Schema.Number,
  states: Schema.NullOr(Schema.Array(OpenSkyStateTuple)),
})

type OpenSkyStateTupleType = typeof OpenSkyStateTuple.Type

/**
 * Transform raw OpenSky tuple to OpenSkyStateVector
 */
const transformOpenSkyState = (raw: OpenSkyStateTupleType): OpenSkyStateVector =>
  new OpenSkyStateVector({
    icao24: raw[0] as Icao24,
    callsign: raw[1],
    originCountry: raw[2],
    timePosition: raw[3],
    lastContact: raw[4],
    longitude: raw[5],
    latitude: raw[6],
    baroAltitude: raw[7],
    onGround: raw[8],
    velocity: raw[9],
    trueTrack: raw[10],
    verticalRate: raw[11],
    sensors: raw[12] as number[] | null,
    geoAltitude: raw[13],
    squawk: raw[14],
    spi: raw[15],
    positionSource: raw[16],
    category: raw[17] ?? 0,
  })

/**
 * Create OpenSky client layer
 */
export const makeOpenSkyClient = (
  config: OpenSkyConfig = DEFAULT_OPENSKY_CONFIG
): Effect.Effect<OpenSkyClient, never, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient
    const rateLimiter = yield* makeRateLimiter(
      'opensky',
      config.requestsPerMinute,
      5 // Burst size
    )

    const getStates: OpenSkyClient['getStates'] = (options) =>
      Effect.gen(function* () {
        // Acquire rate limit token
        yield* rateLimiter.acquire

        // Build URL with query params
        let url = `${config.baseUrl}/states/all`
        const params = new URLSearchParams()

        if (options.bounds) {
          const [minLon, minLat, maxLon, maxLat] = options.bounds
          params.set('lamin', minLat.toString())
          params.set('lomin', minLon.toString())
          params.set('lamax', maxLat.toString())
          params.set('lomax', maxLon.toString())
        }

        if (options.icao24 && options.icao24.length > 0) {
          options.icao24.forEach((icao) => params.append('icao24', icao))
        }

        if (options.time !== undefined) {
          params.set('time', options.time.toString())
        }

        const queryString = params.toString()
        if (queryString) {
          url = `${url}?${queryString}`
        }

        // Make request
        let request = HttpClientRequest.get(url)

        // Add auth if configured
        if (config.username && config.password) {
          request = HttpClientRequest.setHeader(
            'Authorization',
            `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`
          )(request)
        }

        // Execute with timeout
        const response = yield* pipe(
          httpClient.execute(request),
          Effect.timeout(Duration.millis(config.timeoutMs)),
          Effect.catchTag('TimeoutException', () =>
            Effect.fail(
              new TimeoutError({
                source: 'opensky',
                timeoutMs: config.timeoutMs,
                message: `OpenSky API request timed out after ${config.timeoutMs}ms`,
              })
            )
          ),
          Effect.catchAllCause((cause) =>
            Effect.fail(
              new ExternalApiError({
                source: 'opensky',
                statusCode: 0,
                message: `OpenSky API request failed: ${String(cause)}`,
                retryable: true,
              })
            )
          )
        )

        // Check status
        if (response.status >= 400) {
          const retryable = response.status === 429 || response.status >= 500
          return yield* Effect.fail(
            new ExternalApiError({
              source: 'opensky',
              statusCode: response.status,
              message: `OpenSky API returned ${response.status}`,
              retryable,
            })
          )
        }

        // Parse response using response.json property
        const json = yield* response.json.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'opensky',
                statusCode: 0,
                message: `Failed to parse OpenSky response: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        const decoded = yield* Schema.decodeUnknown(OpenSkyRawResponse)(json).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'opensky',
                statusCode: 0,
                message: `Invalid OpenSky response format: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        // Transform to OpenSkyResponse
        return new OpenSkyResponse({
          time: decoded.time,
          states: decoded.states
            ? decoded.states.map((s) => transformOpenSkyState(s))
            : null,
        })
      })

    return { getStates }
  })

/**
 * OpenSky client layer
 */
export const OpenSkyClientLive = Layer.effect(
  OpenSkyClientService,
  makeOpenSkyClient()
)

// =============================================================================
// Overpass Client
// =============================================================================

/**
 * Overpass API configuration
 */
export interface OverpassConfig {
  readonly baseUrl: string
  readonly timeoutMs: number
  readonly requestsPerMinute: number
}

/**
 * Default Overpass configuration
 */
export const DEFAULT_OVERPASS_CONFIG: OverpassConfig = {
  baseUrl: 'https://overpass-api.de/api/interpreter',
  timeoutMs: 60000,
  requestsPerMinute: 20,
}

/**
 * Overpass client service interface
 */
export interface OverpassClient {
  readonly query: (
    overpassQL: string,
    options?: { timeout?: number }
  ) => Effect.Effect<OverpassResponse, ExternalApiError | RateLimitError | TimeoutError>

  readonly buildQuery: (options: {
    bounds: readonly [number, number, number, number]
    amenities?: readonly string[]
    tags?: Record<string, string>
  }) => string
}

/**
 * Overpass client service tag
 */
export class OverpassClientService extends Context.Tag('geoint/OverpassClient')<
  OverpassClientService,
  OverpassClient
>() {}

/**
 * Raw Overpass API response schema
 */
const OverpassRawResponse = Schema.Struct({
  version: Schema.Number,
  generator: Schema.String,
  osm3s: Schema.Struct({
    timestamp_osm_base: Schema.String,
    copyright: Schema.String,
  }),
  elements: Schema.Array(
    Schema.Struct({
      type: Schema.Literal('node', 'way', 'relation'),
      id: Schema.Number,
      lat: Schema.optional(Schema.Number),
      lon: Schema.optional(Schema.Number),
      center: Schema.optional(
        Schema.Struct({
          lat: Schema.Number,
          lon: Schema.Number,
        })
      ),
      tags: Schema.optional(
        Schema.Record({ key: Schema.String, value: Schema.String })
      ),
    })
  ),
})

/**
 * Create Overpass client layer
 */
export const makeOverpassClient = (
  config: OverpassConfig = DEFAULT_OVERPASS_CONFIG
): Effect.Effect<OverpassClient, never, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient
    const rateLimiter = yield* makeRateLimiter(
      'overpass',
      config.requestsPerMinute,
      5
    )

    const buildQuery: OverpassClient['buildQuery'] = (options) => {
      const [minLon, minLat, maxLon, maxLat] = options.bounds
      const bbox = `${minLat},${minLon},${maxLat},${maxLon}`

      let queryParts: string[] = []

      // Add amenity filters
      if (options.amenities && options.amenities.length > 0) {
        const amenityRegex = options.amenities.join('|')
        queryParts.push(`node["amenity"~"${amenityRegex}"](${bbox});`)
        queryParts.push(`way["amenity"~"${amenityRegex}"](${bbox});`)
      }

      // Add tag filters
      if (options.tags) {
        for (const [key, value] of Object.entries(options.tags)) {
          queryParts.push(`node["${key}"="${value}"](${bbox});`)
          queryParts.push(`way["${key}"="${value}"](${bbox});`)
        }
      }

      // Default: all nodes/ways if no filters
      if (queryParts.length === 0) {
        queryParts = [`nwr(${bbox});`]
      }

      return `[out:json][timeout:25];
(
  ${queryParts.join('\n  ')}
);
out center;`
    }

    const query: OverpassClient['query'] = (overpassQL, options) =>
      Effect.gen(function* () {
        yield* rateLimiter.acquire

        const effectiveTimeout = options?.timeout
          ? options.timeout * 1000
          : config.timeoutMs

        // Build form data request using bodyText
        const formData = new URLSearchParams()
        formData.set('data', overpassQL)

        const request = pipe(
          HttpClientRequest.post(config.baseUrl),
          HttpClientRequest.setHeader('Content-Type', 'application/x-www-form-urlencoded'),
          HttpClientRequest.bodyText(formData.toString())
        )

        // Execute with timeout
        const response = yield* pipe(
          httpClient.execute(request),
          Effect.timeout(Duration.millis(effectiveTimeout)),
          Effect.catchTag('TimeoutException', () =>
            Effect.fail(
              new TimeoutError({
                source: 'overpass',
                timeoutMs: effectiveTimeout,
                message: `Overpass API request timed out after ${effectiveTimeout}ms`,
              })
            )
          ),
          Effect.catchAllCause((cause) =>
            Effect.fail(
              new ExternalApiError({
                source: 'overpass',
                statusCode: 0,
                message: `Overpass API request failed: ${String(cause)}`,
                retryable: true,
              })
            )
          )
        )

        // Check status
        if (response.status >= 400) {
          const retryable = response.status === 429 || response.status >= 500
          return yield* Effect.fail(
            new ExternalApiError({
              source: 'overpass',
              statusCode: response.status,
              message: `Overpass API returned ${response.status}`,
              retryable,
            })
          )
        }

        // Parse response using response.json property
        const json = yield* response.json.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'overpass',
                statusCode: 0,
                message: `Failed to parse Overpass response: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        const decoded = yield* Schema.decodeUnknown(OverpassRawResponse)(json).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'overpass',
                statusCode: 0,
                message: `Invalid Overpass response format: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        // Transform to OverpassResponse
        return new OverpassResponse({
          version: decoded.version,
          generator: decoded.generator,
          osm3s: {
            timestamp_osm_base: decoded.osm3s.timestamp_osm_base,
            copyright: decoded.osm3s.copyright,
          },
          elements: decoded.elements.map(
            (e) =>
              new OverpassElement({
                type: e.type,
                id: e.id,
                lat: e.lat,
                lon: e.lon,
                center: e.center,
                tags: e.tags ?? {},
              })
          ),
        })
      })

    return { query, buildQuery }
  })

/**
 * Overpass client layer
 */
export const OverpassClientLive = Layer.effect(
  OverpassClientService,
  makeOverpassClient()
)

// =============================================================================
// ADSB.lol Client
// =============================================================================

/**
 * ADSB.lol API configuration
 */
export interface AdsbLolConfig {
  readonly baseUrl: string
  readonly timeoutMs: number
  readonly requestsPerMinute: number
}

/**
 * Default ADSB.lol configuration
 */
export const DEFAULT_ADSB_LOL_CONFIG: AdsbLolConfig = {
  baseUrl: 'https://api.adsb.lol',
  timeoutMs: 30000,
  requestsPerMinute: 60, // ADSB.lol is generous with rate limits
}

/**
 * ADSB.lol client service interface
 */
export interface AdsbLolClient {
  /** Get aircraft within a radius of a point */
  readonly getByPoint: (options: {
    lat: number
    lon: number
    radiusNm: number // Nautical miles, max 250
  }) => Effect.Effect<AdsbLolResponse, ExternalApiError | RateLimitError | TimeoutError>

  /** Get aircraft by ICAO hex code */
  readonly getByIcao: (
    icaoHex: string
  ) => Effect.Effect<AdsbLolResponse, ExternalApiError | RateLimitError | TimeoutError>

  /** Get aircraft by callsign */
  readonly getByCallsign: (
    callsign: string
  ) => Effect.Effect<AdsbLolResponse, ExternalApiError | RateLimitError | TimeoutError>

  /** Get aircraft by type (e.g., "A320", "B738") */
  readonly getByType: (
    aircraftType: string
  ) => Effect.Effect<AdsbLolResponse, ExternalApiError | RateLimitError | TimeoutError>

  /** Get aircraft by squawk code */
  readonly getBySquawk: (
    squawk: string
  ) => Effect.Effect<AdsbLolResponse, ExternalApiError | RateLimitError | TimeoutError>

  /** Get military aircraft */
  readonly getMilitary: () => Effect.Effect<AdsbLolResponse, ExternalApiError | RateLimitError | TimeoutError>
}

/**
 * ADSB.lol client service tag
 */
export class AdsbLolClientService extends Context.Tag('geoint/AdsbLolClient')<
  AdsbLolClientService,
  AdsbLolClient
>() {}

/**
 * Create ADSB.lol client layer
 *
 * Uses AdsbLolResponseSchema transform for wire format → domain conversion.
 */
export const makeAdsbLolClient = (
  config: AdsbLolConfig = DEFAULT_ADSB_LOL_CONFIG
): Effect.Effect<AdsbLolClient, never, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient
    const rateLimiter = yield* makeRateLimiter(
      'adsb_lol',
      config.requestsPerMinute,
      10 // Burst size
    )

    /**
     * Helper to execute ADSB.lol API request
     * Uses AdsbLolResponseSchema transform for wire → domain conversion.
     */
    const executeRequest = (url: string): Effect.Effect<AdsbLolResponse, ExternalApiError | RateLimitError | TimeoutError> =>
      Effect.gen(function* () {
        yield* rateLimiter.acquire

        const request = HttpClientRequest.get(url)

        const response = yield* pipe(
          httpClient.execute(request),
          Effect.timeout(Duration.millis(config.timeoutMs)),
          Effect.catchTag('TimeoutException', () =>
            Effect.fail(
              new TimeoutError({
                source: 'adsb_lol',
                timeoutMs: config.timeoutMs,
                message: `ADSB.lol API request timed out after ${config.timeoutMs}ms`,
              })
            )
          ),
          Effect.catchAllCause((cause) =>
            Effect.fail(
              new ExternalApiError({
                source: 'adsb_lol',
                statusCode: 0,
                message: `ADSB.lol API request failed: ${String(cause)}`,
                retryable: true,
              })
            )
          )
        )

        if (response.status >= 400) {
          const retryable = response.status === 429 || response.status >= 500
          return yield* Effect.fail(
            new ExternalApiError({
              source: 'adsb_lol',
              statusCode: response.status,
              message: `ADSB.lol API returned ${response.status}`,
              retryable,
            })
          )
        }

        const json = yield* response.json.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'adsb_lol',
                statusCode: 0,
                message: `Failed to parse ADSB.lol response: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        // Use schema transform: wire format → domain type
        const decoded = yield* Schema.decodeUnknown(AdsbLolResponseSchema)(json).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'adsb_lol',
                statusCode: 0,
                message: `Invalid ADSB.lol response format: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        return decoded
      })

    const getByPoint: AdsbLolClient['getByPoint'] = (options) =>
      executeRequest(
        `${config.baseUrl}/v2/point/${options.lat}/${options.lon}/${Math.min(options.radiusNm, 250)}`
      )

    const getByIcao: AdsbLolClient['getByIcao'] = (icaoHex) =>
      executeRequest(`${config.baseUrl}/v2/icao/${icaoHex.toLowerCase()}`)

    const getByCallsign: AdsbLolClient['getByCallsign'] = (callsign) =>
      executeRequest(`${config.baseUrl}/v2/callsign/${callsign.toUpperCase()}`)

    const getByType: AdsbLolClient['getByType'] = (aircraftType) =>
      executeRequest(`${config.baseUrl}/v2/type/${aircraftType.toUpperCase()}`)

    const getBySquawk: AdsbLolClient['getBySquawk'] = (squawk) =>
      executeRequest(`${config.baseUrl}/v2/squawk/${squawk}`)

    const getMilitary: AdsbLolClient['getMilitary'] = () =>
      executeRequest(`${config.baseUrl}/v2/mil`)

    return {
      getByPoint,
      getByIcao,
      getByCallsign,
      getByType,
      getBySquawk,
      getMilitary,
    }
  })

/**
 * ADSB.lol client layer
 */
export const AdsbLolClientLive = Layer.effect(
  AdsbLolClientService,
  makeAdsbLolClient()
)

// =============================================================================
// Planet Labs Client
// =============================================================================

/**
 * Planet Labs Data API configuration
 */
export interface PlanetLabsConfig {
  readonly baseUrl: string
  readonly apiKey: string
  readonly timeoutMs: number
  readonly requestsPerMinute: number
}

/**
 * Default Planet Labs configuration
 * Note: API key must be set via environment or config
 */
export const DEFAULT_PLANET_LABS_CONFIG: Omit<PlanetLabsConfig, 'apiKey'> = {
  baseUrl: 'https://api.planet.com/data/v1',
  timeoutMs: 60000,
  requestsPerMinute: 30, // Planet has reasonable rate limits
}

/**
 * Planet Labs search filter options
 */
export interface PlanetSearchOptions {
  /** GeoJSON geometry for spatial filter */
  geometry: unknown // GeoJSON polygon or point
  /** Item types to search (e.g., 'PSScene', 'SkySatCollect') */
  itemTypes: readonly PlanetItemType[]
  /** Date range start (ISO string) */
  acquiredGte?: string
  /** Date range end (ISO string) */
  acquiredLte?: string
  /** Max cloud cover percentage (0-1) */
  maxCloudCover?: number
  /** Max results to return */
  limit?: number
}

/**
 * Planet Labs client service interface
 */
export interface PlanetLabsClient {
  /** Search for imagery by geographic area and date range */
  readonly quickSearch: (
    options: PlanetSearchOptions
  ) => Effect.Effect<PlanetSearchResponse, ExternalApiError | RateLimitError | TimeoutError>

  /** Get next page of search results */
  readonly getNextPage: (
    nextUrl: string
  ) => Effect.Effect<PlanetSearchResponse, ExternalApiError | RateLimitError | TimeoutError>

  /** Get item details by ID and type */
  readonly getItem: (options: {
    itemType: PlanetItemType
    itemId: string
  }) => Effect.Effect<PlanetItem, ExternalApiError | RateLimitError | TimeoutError>
}

/**
 * Planet Labs client service tag
 */
export class PlanetLabsClientService extends Context.Tag('geoint/PlanetLabsClient')<
  PlanetLabsClientService,
  PlanetLabsClient
>() {}

/**
 * Create Planet Labs client layer
 *
 * Uses PlanetSearchResponseSchema transform for wire format → domain conversion.
 */
export const makePlanetLabsClient = (
  config: PlanetLabsConfig
): Effect.Effect<PlanetLabsClient, never, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient
    const rateLimiter = yield* makeRateLimiter(
      'planet_labs',
      config.requestsPerMinute,
      5 // Burst size
    )

    /**
     * Build authentication header (Basic Auth with API key)
     */
    const authHeader = `Basic ${Buffer.from(`${config.apiKey}:`).toString('base64')}`

    /**
     * Build filter for quick search
     */
    const buildFilter = (options: PlanetSearchOptions): unknown => {
      const filters: unknown[] = [
        {
          type: 'GeometryFilter',
          field_name: 'geometry',
          config: options.geometry,
        },
      ]

      // Date range filter
      if (options.acquiredGte || options.acquiredLte) {
        const dateConfig: Record<string, string> = {}
        if (options.acquiredGte) dateConfig['gte'] = options.acquiredGte
        if (options.acquiredLte) dateConfig['lte'] = options.acquiredLte
        filters.push({
          type: 'DateRangeFilter',
          field_name: 'acquired',
          config: dateConfig,
        })
      }

      // Cloud cover filter
      if (options.maxCloudCover !== undefined) {
        filters.push({
          type: 'RangeFilter',
          field_name: 'cloud_cover',
          config: { lte: options.maxCloudCover },
        })
      }

      // Permission filter - only request items we can download
      filters.push({
        type: 'PermissionFilter',
        config: ['assets:download'],
      })

      return {
        type: 'AndFilter',
        config: filters,
      }
    }

    const quickSearch: PlanetLabsClient['quickSearch'] = (options) =>
      Effect.gen(function* () {
        yield* rateLimiter.acquire

        const requestBody = {
          item_types: options.itemTypes,
          filter: buildFilter(options),
        }

        const request = pipe(
          HttpClientRequest.post(`${config.baseUrl}/quick-search`),
          HttpClientRequest.setHeader('Authorization', authHeader),
          HttpClientRequest.setHeader('Content-Type', 'application/json'),
          HttpClientRequest.bodyJson(requestBody)
        )

        // Handle bodyJson returning Effect
        const finalRequest = yield* request.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'planet_labs',
                statusCode: 0,
                message: `Failed to serialize request body: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        const response = yield* pipe(
          httpClient.execute(finalRequest),
          Effect.timeout(Duration.millis(config.timeoutMs)),
          Effect.catchTag('TimeoutException', () =>
            Effect.fail(
              new TimeoutError({
                source: 'planet_labs',
                timeoutMs: config.timeoutMs,
                message: `Planet Labs API request timed out after ${config.timeoutMs}ms`,
              })
            )
          ),
          Effect.catchAllCause((cause) =>
            Effect.fail(
              new ExternalApiError({
                source: 'planet_labs',
                statusCode: 0,
                message: `Planet Labs API request failed: ${String(cause)}`,
                retryable: true,
              })
            )
          )
        )

        if (response.status >= 400) {
          const retryable = response.status === 429 || response.status >= 500
          return yield* Effect.fail(
            new ExternalApiError({
              source: 'planet_labs',
              statusCode: response.status,
              message: `Planet Labs API returned ${response.status}`,
              retryable,
            })
          )
        }

        const json = yield* response.json.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'planet_labs',
                statusCode: 0,
                message: `Failed to parse Planet Labs response: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        // Use schema transform: wire format → domain type
        const decoded = yield* Schema.decodeUnknown(PlanetSearchResponseSchema)(json).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'planet_labs',
                statusCode: 0,
                message: `Invalid Planet Labs response format: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        return decoded
      })

    const getNextPage: PlanetLabsClient['getNextPage'] = (nextUrl) =>
      Effect.gen(function* () {
        yield* rateLimiter.acquire

        const request = pipe(
          HttpClientRequest.get(nextUrl),
          HttpClientRequest.setHeader('Authorization', authHeader)
        )

        const response = yield* pipe(
          httpClient.execute(request),
          Effect.timeout(Duration.millis(config.timeoutMs)),
          Effect.catchTag('TimeoutException', () =>
            Effect.fail(
              new TimeoutError({
                source: 'planet_labs',
                timeoutMs: config.timeoutMs,
                message: `Planet Labs API request timed out after ${config.timeoutMs}ms`,
              })
            )
          ),
          Effect.catchAllCause((cause) =>
            Effect.fail(
              new ExternalApiError({
                source: 'planet_labs',
                statusCode: 0,
                message: `Planet Labs API request failed: ${String(cause)}`,
                retryable: true,
              })
            )
          )
        )

        if (response.status >= 400) {
          const retryable = response.status === 429 || response.status >= 500
          return yield* Effect.fail(
            new ExternalApiError({
              source: 'planet_labs',
              statusCode: response.status,
              message: `Planet Labs API returned ${response.status}`,
              retryable,
            })
          )
        }

        const json = yield* response.json.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'planet_labs',
                statusCode: 0,
                message: `Failed to parse Planet Labs response: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        const decoded = yield* Schema.decodeUnknown(PlanetSearchResponseSchema)(json).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'planet_labs',
                statusCode: 0,
                message: `Invalid Planet Labs response format: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        return decoded
      })

    const getItem: PlanetLabsClient['getItem'] = (options) =>
      Effect.gen(function* () {
        yield* rateLimiter.acquire

        const url = `${config.baseUrl}/item-types/${options.itemType}/items/${options.itemId}`
        const request = pipe(
          HttpClientRequest.get(url),
          HttpClientRequest.setHeader('Authorization', authHeader)
        )

        const response = yield* pipe(
          httpClient.execute(request),
          Effect.timeout(Duration.millis(config.timeoutMs)),
          Effect.catchTag('TimeoutException', () =>
            Effect.fail(
              new TimeoutError({
                source: 'planet_labs',
                timeoutMs: config.timeoutMs,
                message: `Planet Labs API request timed out after ${config.timeoutMs}ms`,
              })
            )
          ),
          Effect.catchAllCause((cause) =>
            Effect.fail(
              new ExternalApiError({
                source: 'planet_labs',
                statusCode: 0,
                message: `Planet Labs API request failed: ${String(cause)}`,
                retryable: true,
              })
            )
          )
        )

        if (response.status >= 400) {
          const retryable = response.status === 429 || response.status >= 500
          return yield* Effect.fail(
            new ExternalApiError({
              source: 'planet_labs',
              statusCode: response.status,
              message: `Planet Labs API returned ${response.status}`,
              retryable,
            })
          )
        }

        const json = yield* response.json.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'planet_labs',
                statusCode: 0,
                message: `Failed to parse Planet Labs response: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        // Use schema transform: wire format → domain type
        const decoded = yield* Schema.decodeUnknown(PlanetItemSchema)(json).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'planet_labs',
                statusCode: 0,
                message: `Invalid Planet item format: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        return decoded
      })

    return {
      quickSearch,
      getNextPage,
      getItem,
    }
  })

/**
 * Create Planet Labs client layer with API key from environment
 */
export const PlanetLabsClientLive = (apiKey: string) =>
  Layer.effect(
    PlanetLabsClientService,
    makePlanetLabsClient({
      ...DEFAULT_PLANET_LABS_CONFIG,
      apiKey,
    })
  )

// =============================================================================
// Sentinel Hub Client
// =============================================================================

/**
 * Sentinel Hub API configuration
 */
export interface SentinelHubConfig {
  /** Base URL for Sentinel Hub services */
  readonly baseUrl: string
  /** OAuth2 token endpoint */
  readonly tokenUrl: string
  /** OAuth2 client ID */
  readonly clientId: string
  /** OAuth2 client secret */
  readonly clientSecret: string
  /** Request timeout in milliseconds */
  readonly timeoutMs: number
  /** Rate limit (requests per minute) */
  readonly requestsPerMinute: number
}

/**
 * Default Sentinel Hub configuration (Copernicus Data Space Ecosystem)
 * Note: Client ID and secret must be set via environment or config
 */
export const DEFAULT_SENTINEL_HUB_CONFIG: Omit<SentinelHubConfig, 'clientId' | 'clientSecret'> = {
  baseUrl: 'https://sh.dataspace.copernicus.eu',
  tokenUrl: 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
  timeoutMs: 60000,
  requestsPerMinute: 30,
}

/**
 * Sentinel Hub search filter options
 */
export interface SentinelSearchOptions {
  /** Collections to search (e.g., 'sentinel-2-l2a') */
  collections: readonly SentinelCollection[]
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  bbox?: readonly [number, number, number, number]
  /** GeoJSON geometry for intersects filter */
  intersects?: unknown
  /** Date range start (ISO string) */
  datetimeGte?: string
  /** Date range end (ISO string) */
  datetimeLte?: string
  /** Max cloud cover percentage (0-100) */
  maxCloudCover?: number
  /** Max results to return */
  limit?: number
}

/**
 * Sentinel Hub client service interface
 */
export interface SentinelHubClient {
  /** Search for imagery in the catalog */
  readonly search: (
    options: SentinelSearchOptions
  ) => Effect.Effect<SentinelSearchResponse, ExternalApiError | RateLimitError | TimeoutError>

  /** Get next page of search results */
  readonly getNextPage: (
    nextUrl: string
  ) => Effect.Effect<SentinelSearchResponse, ExternalApiError | RateLimitError | TimeoutError>

  /** Get item details by ID */
  readonly getItem: (options: {
    collection: SentinelCollection
    itemId: string
  }) => Effect.Effect<SentinelItem, ExternalApiError | RateLimitError | TimeoutError>
}

/**
 * Sentinel Hub client service tag
 */
export class SentinelHubClientService extends Context.Tag('geoint/SentinelHubClient')<
  SentinelHubClientService,
  SentinelHubClient
>() {}

/**
 * OAuth2 token response schema
 */
const OAuth2TokenResponse = Schema.Struct({
  access_token: Schema.String,
  token_type: Schema.String,
  expires_in: Schema.Number,
  scope: Schema.optional(Schema.String),
})

/**
 * Create Sentinel Hub client layer
 *
 * Handles OAuth2 authentication and uses STAC catalog API for search.
 */
export const makeSentinelHubClient = (
  config: SentinelHubConfig
): Effect.Effect<SentinelHubClient, never, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient
    const rateLimiter = yield* makeRateLimiter(
      'sentinel_hub',
      config.requestsPerMinute,
      5 // Burst size
    )

    // Token cache
    const tokenCache = yield* Ref.make<{ token: string; expiresAt: number } | null>(null)

    /**
     * Get a valid OAuth2 access token (with caching)
     */
    const getAccessToken = (): Effect.Effect<string, ExternalApiError> =>
      Effect.gen(function* () {
        const cached = yield* Ref.get(tokenCache)

        // Return cached token if still valid (with 60s buffer)
        if (cached && cached.expiresAt > Date.now() + 60000) {
          return cached.token
        }

        // Request new token
        const formData = new URLSearchParams()
        formData.set('grant_type', 'client_credentials')
        formData.set('client_id', config.clientId)
        formData.set('client_secret', config.clientSecret)

        const request = pipe(
          HttpClientRequest.post(config.tokenUrl),
          HttpClientRequest.setHeader('Content-Type', 'application/x-www-form-urlencoded'),
          HttpClientRequest.bodyText(formData.toString())
        )

        const response = yield* pipe(
          httpClient.execute(request),
          Effect.timeout(Duration.millis(30000)),
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'sentinel_hub',
                statusCode: 0,
                message: `OAuth2 token request failed: ${String(error)}`,
                retryable: true,
              })
            )
          )
        )

        if (response.status >= 400) {
          return yield* Effect.fail(
            new ExternalApiError({
              source: 'sentinel_hub',
              statusCode: response.status,
              message: `OAuth2 token request returned ${response.status}`,
              retryable: response.status >= 500,
            })
          )
        }

        const json = yield* response.json.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'sentinel_hub',
                statusCode: 0,
                message: `Failed to parse OAuth2 response: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        const tokenResponse = yield* Schema.decodeUnknown(OAuth2TokenResponse)(json).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'sentinel_hub',
                statusCode: 0,
                message: `Invalid OAuth2 response format: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        // Cache the token
        yield* Ref.set(tokenCache, {
          token: tokenResponse.access_token,
          expiresAt: Date.now() + tokenResponse.expires_in * 1000,
        })

        return tokenResponse.access_token
      })

    /**
     * Build STAC search filter
     */
    const buildSearchBody = (options: SentinelSearchOptions): Record<string, unknown> => {
      const body: Record<string, unknown> = {
        collections: [...options.collections],
        limit: options.limit ?? 10,
      }

      // Bounding box
      if (options.bbox) {
        body['bbox'] = [...options.bbox]
      }

      // Intersects geometry
      if (options.intersects) {
        body['intersects'] = options.intersects
      }

      // Datetime filter
      if (options.datetimeGte || options.datetimeLte) {
        const start = options.datetimeGte ?? '..'
        const end = options.datetimeLte ?? '..'
        body['datetime'] = `${start}/${end}`
      }

      // Cloud cover filter (STAC extension)
      if (options.maxCloudCover !== undefined) {
        body['query'] = {
          'eo:cloud_cover': { lte: options.maxCloudCover },
        }
      }

      return body
    }

    const search: SentinelHubClient['search'] = (options) =>
      Effect.gen(function* () {
        yield* rateLimiter.acquire
        const accessToken = yield* getAccessToken()

        const requestBody = buildSearchBody(options)

        const request = pipe(
          HttpClientRequest.post(`${config.baseUrl}/api/v1/catalog/1.0.0/search`),
          HttpClientRequest.setHeader('Authorization', `Bearer ${accessToken}`),
          HttpClientRequest.setHeader('Content-Type', 'application/json'),
          HttpClientRequest.bodyJson(requestBody)
        )

        const finalRequest = yield* request.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'sentinel_hub',
                statusCode: 0,
                message: `Failed to serialize request body: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        const response = yield* pipe(
          httpClient.execute(finalRequest),
          Effect.timeout(Duration.millis(config.timeoutMs)),
          Effect.catchTag('TimeoutException', () =>
            Effect.fail(
              new TimeoutError({
                source: 'sentinel_hub',
                timeoutMs: config.timeoutMs,
                message: `Sentinel Hub API request timed out after ${config.timeoutMs}ms`,
              })
            )
          ),
          Effect.catchAllCause((cause) =>
            Effect.fail(
              new ExternalApiError({
                source: 'sentinel_hub',
                statusCode: 0,
                message: `Sentinel Hub API request failed: ${String(cause)}`,
                retryable: true,
              })
            )
          )
        )

        if (response.status >= 400) {
          const retryable = response.status === 429 || response.status >= 500
          return yield* Effect.fail(
            new ExternalApiError({
              source: 'sentinel_hub',
              statusCode: response.status,
              message: `Sentinel Hub API returned ${response.status}`,
              retryable,
            })
          )
        }

        const json = yield* response.json.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'sentinel_hub',
                statusCode: 0,
                message: `Failed to parse Sentinel Hub response: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        const decoded = yield* Schema.decodeUnknown(SentinelSearchResponseSchema)(json).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'sentinel_hub',
                statusCode: 0,
                message: `Invalid Sentinel Hub response format: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        return decoded
      })

    const getNextPage: SentinelHubClient['getNextPage'] = (nextUrl) =>
      Effect.gen(function* () {
        yield* rateLimiter.acquire
        const accessToken = yield* getAccessToken()

        const request = pipe(
          HttpClientRequest.get(nextUrl),
          HttpClientRequest.setHeader('Authorization', `Bearer ${accessToken}`)
        )

        const response = yield* pipe(
          httpClient.execute(request),
          Effect.timeout(Duration.millis(config.timeoutMs)),
          Effect.catchTag('TimeoutException', () =>
            Effect.fail(
              new TimeoutError({
                source: 'sentinel_hub',
                timeoutMs: config.timeoutMs,
                message: `Sentinel Hub API request timed out after ${config.timeoutMs}ms`,
              })
            )
          ),
          Effect.catchAllCause((cause) =>
            Effect.fail(
              new ExternalApiError({
                source: 'sentinel_hub',
                statusCode: 0,
                message: `Sentinel Hub API request failed: ${String(cause)}`,
                retryable: true,
              })
            )
          )
        )

        if (response.status >= 400) {
          const retryable = response.status === 429 || response.status >= 500
          return yield* Effect.fail(
            new ExternalApiError({
              source: 'sentinel_hub',
              statusCode: response.status,
              message: `Sentinel Hub API returned ${response.status}`,
              retryable,
            })
          )
        }

        const json = yield* response.json.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'sentinel_hub',
                statusCode: 0,
                message: `Failed to parse Sentinel Hub response: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        const decoded = yield* Schema.decodeUnknown(SentinelSearchResponseSchema)(json).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'sentinel_hub',
                statusCode: 0,
                message: `Invalid Sentinel Hub response format: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        return decoded
      })

    const getItem: SentinelHubClient['getItem'] = (options) =>
      Effect.gen(function* () {
        yield* rateLimiter.acquire
        const accessToken = yield* getAccessToken()

        const url = `${config.baseUrl}/api/v1/catalog/1.0.0/collections/${options.collection}/items/${options.itemId}`
        const request = pipe(
          HttpClientRequest.get(url),
          HttpClientRequest.setHeader('Authorization', `Bearer ${accessToken}`)
        )

        const response = yield* pipe(
          httpClient.execute(request),
          Effect.timeout(Duration.millis(config.timeoutMs)),
          Effect.catchTag('TimeoutException', () =>
            Effect.fail(
              new TimeoutError({
                source: 'sentinel_hub',
                timeoutMs: config.timeoutMs,
                message: `Sentinel Hub API request timed out after ${config.timeoutMs}ms`,
              })
            )
          ),
          Effect.catchAllCause((cause) =>
            Effect.fail(
              new ExternalApiError({
                source: 'sentinel_hub',
                statusCode: 0,
                message: `Sentinel Hub API request failed: ${String(cause)}`,
                retryable: true,
              })
            )
          )
        )

        if (response.status >= 400) {
          const retryable = response.status === 429 || response.status >= 500
          return yield* Effect.fail(
            new ExternalApiError({
              source: 'sentinel_hub',
              statusCode: response.status,
              message: `Sentinel Hub API returned ${response.status}`,
              retryable,
            })
          )
        }

        const json = yield* response.json.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'sentinel_hub',
                statusCode: 0,
                message: `Failed to parse Sentinel Hub response: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        const decoded = yield* Schema.decodeUnknown(SentinelItemSchema)(json).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'sentinel_hub',
                statusCode: 0,
                message: `Invalid Sentinel item format: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        return decoded
      })

    return {
      search,
      getNextPage,
      getItem,
    }
  })

/**
 * Create Sentinel Hub client layer with OAuth2 credentials
 */
export const SentinelHubClientLive = (clientId: string, clientSecret: string) =>
  Layer.effect(
    SentinelHubClientService,
    makeSentinelHubClient({
      ...DEFAULT_SENTINEL_HUB_CONFIG,
      clientId,
      clientSecret,
    })
  )

// =============================================================================
// Open-Meteo Weather Client
// =============================================================================

/**
 * Open-Meteo API configuration
 */
export interface OpenMeteoConfig {
  /** Base URL for forecast API */
  readonly forecastUrl: string
  /** Base URL for geocoding API */
  readonly geocodingUrl: string
  /** Request timeout in milliseconds */
  readonly timeoutMs: number
  /** Rate limit (requests per minute) - Open-Meteo is free but fair use */
  readonly requestsPerMinute: number
}

/**
 * Default Open-Meteo configuration
 * Note: Open-Meteo is free and doesn't require an API key
 */
export const DEFAULT_OPEN_METEO_CONFIG: OpenMeteoConfig = {
  forecastUrl: 'https://api.open-meteo.com/v1/forecast',
  geocodingUrl: 'https://geocoding-api.open-meteo.com/v1/search',
  timeoutMs: 30000,
  requestsPerMinute: 60, // Fair use limit
}

/**
 * Weather forecast options
 */
export interface WeatherForecastOptions {
  /** Latitude in degrees */
  latitude: number
  /** Longitude in degrees */
  longitude: number
  /** Include current weather */
  current?: boolean
  /** Include hourly forecast */
  hourly?: boolean
  /** Number of hourly forecast hours (default: 24) */
  forecastHours?: number
  /** Include daily forecast */
  daily?: boolean
  /** Number of daily forecast days (default: 7) */
  forecastDays?: number
  /** Timezone for times (e.g., 'auto', 'America/New_York') */
  timezone?: string
  /** Temperature unit ('celsius' | 'fahrenheit') */
  temperatureUnit?: 'celsius' | 'fahrenheit'
  /** Wind speed unit ('kmh' | 'ms' | 'mph' | 'kn') */
  windSpeedUnit?: 'kmh' | 'ms' | 'mph' | 'kn'
  /** Precipitation unit ('mm' | 'inch') */
  precipitationUnit?: 'mm' | 'inch'
}

/**
 * Geocoding search options
 */
export interface GeocodingOptions {
  /** Name of location to search */
  name: string
  /** Maximum number of results (default: 10) */
  count?: number
  /** Language code for results (e.g., 'en', 'de') */
  language?: string
}

/**
 * Open-Meteo client service interface
 */
export interface OpenMeteoClient {
  /** Get weather forecast for a location */
  readonly getForecast: (
    options: WeatherForecastOptions
  ) => Effect.Effect<WeatherForecast, ExternalApiError | RateLimitError | TimeoutError>

  /** Search for locations by name */
  readonly geocode: (
    options: GeocodingOptions
  ) => Effect.Effect<GeocodingResponse, ExternalApiError | RateLimitError | TimeoutError>

  /** Get weather forecast for a named location (combines geocoding + forecast) */
  readonly getWeatherForLocation: (
    locationName: string,
    forecastOptions?: Omit<WeatherForecastOptions, 'latitude' | 'longitude'>
  ) => Effect.Effect<{ location: GeocodingResponse; weather: WeatherForecast }, ExternalApiError | RateLimitError | TimeoutError>
}

/**
 * Open-Meteo client service tag
 */
export class OpenMeteoClientService extends Context.Tag('geoint/OpenMeteoClient')<
  OpenMeteoClientService,
  OpenMeteoClient
>() {}

/**
 * Create Open-Meteo client layer
 *
 * No authentication required - Open-Meteo is free and open.
 */
export const makeOpenMeteoClient = (
  config: OpenMeteoConfig = DEFAULT_OPEN_METEO_CONFIG
): Effect.Effect<OpenMeteoClient, never, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient
    const rateLimiter = yield* makeRateLimiter(
      'open_meteo',
      config.requestsPerMinute,
      10 // Larger burst size since it's free
    )

    /**
     * Build query parameters for forecast request
     */
    const buildForecastParams = (options: WeatherForecastOptions): URLSearchParams => {
      const params = new URLSearchParams()
      params.set('latitude', options.latitude.toString())
      params.set('longitude', options.longitude.toString())

      // Current weather variables
      if (options.current !== false) {
        params.set('current', [
          'temperature_2m',
          'relative_humidity_2m',
          'apparent_temperature',
          'is_day',
          'precipitation',
          'rain',
          'showers',
          'snowfall',
          'weather_code',
          'cloud_cover',
          'pressure_msl',
          'surface_pressure',
          'wind_speed_10m',
          'wind_direction_10m',
          'wind_gusts_10m',
        ].join(','))
      }

      // Hourly forecast variables
      if (options.hourly !== false) {
        params.set('hourly', [
          'temperature_2m',
          'relative_humidity_2m',
          'apparent_temperature',
          'precipitation_probability',
          'precipitation',
          'weather_code',
          'cloud_cover',
          'visibility',
          'wind_speed_10m',
          'wind_direction_10m',
          'wind_gusts_10m',
          'uv_index',
        ].join(','))
        params.set('forecast_hours', (options.forecastHours ?? 24).toString())
      }

      // Daily forecast variables
      if (options.daily) {
        params.set('daily', [
          'weather_code',
          'temperature_2m_max',
          'temperature_2m_min',
          'apparent_temperature_max',
          'apparent_temperature_min',
          'sunrise',
          'sunset',
          'precipitation_sum',
          'precipitation_probability_max',
          'wind_speed_10m_max',
          'wind_gusts_10m_max',
          'wind_direction_10m_dominant',
          'uv_index_max',
        ].join(','))
        params.set('forecast_days', (options.forecastDays ?? 7).toString())
      }

      // Options
      params.set('timezone', options.timezone ?? 'auto')
      if (options.temperatureUnit) params.set('temperature_unit', options.temperatureUnit)
      if (options.windSpeedUnit) params.set('wind_speed_unit', options.windSpeedUnit)
      if (options.precipitationUnit) params.set('precipitation_unit', options.precipitationUnit)

      return params
    }

    const getForecast: OpenMeteoClient['getForecast'] = (options) =>
      Effect.gen(function* () {
        yield* rateLimiter.acquire

        const params = buildForecastParams(options)
        const url = `${config.forecastUrl}?${params.toString()}`

        const request = pipe(
          HttpClientRequest.get(url),
          HttpClientRequest.setHeader('Accept', 'application/json')
        )

        const response = yield* pipe(
          httpClient.execute(request),
          Effect.timeout(Duration.millis(config.timeoutMs)),
          Effect.catchTag('TimeoutException', () =>
            Effect.fail(
              new TimeoutError({
                source: 'open_meteo',
                timeoutMs: config.timeoutMs,
                message: `Weather forecast request timed out after ${config.timeoutMs}ms`,
              })
            )
          ),
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'open_meteo',
                statusCode: 0,
                message: `Weather forecast request failed: ${String(error)}`,
                retryable: true,
              })
            )
          )
        )

        // Handle rate limiting (Open-Meteo uses 429)
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers['retry-after'] ?? '60', 10)
          return yield* Effect.fail(
            new RateLimitError({
              source: 'open_meteo',
              retryAfterSeconds: retryAfter,
              message: 'Open-Meteo rate limit exceeded',
            })
          )
        }

        if (response.status >= 400) {
          return yield* Effect.fail(
            new ExternalApiError({
              source: 'open_meteo',
              statusCode: response.status,
              message: `Weather forecast request returned ${response.status}`,
              retryable: response.status >= 500,
            })
          )
        }

        const json = yield* response.json.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'open_meteo',
                statusCode: 0,
                message: `Failed to parse weather response: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        // Decode using transform schema
        const decoded = yield* Schema.decodeUnknown(WeatherForecastSchema)(json).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'open_meteo',
                statusCode: 0,
                message: `Invalid weather forecast format: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        return decoded
      })

    const geocode: OpenMeteoClient['geocode'] = (options) =>
      Effect.gen(function* () {
        yield* rateLimiter.acquire

        const params = new URLSearchParams()
        params.set('name', options.name)
        params.set('count', (options.count ?? 10).toString())
        params.set('format', 'json')
        if (options.language) params.set('language', options.language)

        const url = `${config.geocodingUrl}?${params.toString()}`

        const request = pipe(
          HttpClientRequest.get(url),
          HttpClientRequest.setHeader('Accept', 'application/json')
        )

        const response = yield* pipe(
          httpClient.execute(request),
          Effect.timeout(Duration.millis(config.timeoutMs)),
          Effect.catchTag('TimeoutException', () =>
            Effect.fail(
              new TimeoutError({
                source: 'open_meteo',
                timeoutMs: config.timeoutMs,
                message: `Geocoding request timed out after ${config.timeoutMs}ms`,
              })
            )
          ),
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'open_meteo',
                statusCode: 0,
                message: `Geocoding request failed: ${String(error)}`,
                retryable: true,
              })
            )
          )
        )

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers['retry-after'] ?? '60', 10)
          return yield* Effect.fail(
            new RateLimitError({
              source: 'open_meteo',
              retryAfterSeconds: retryAfter,
              message: 'Open-Meteo geocoding rate limit exceeded',
            })
          )
        }

        if (response.status >= 400) {
          return yield* Effect.fail(
            new ExternalApiError({
              source: 'open_meteo',
              statusCode: response.status,
              message: `Geocoding request returned ${response.status}`,
              retryable: response.status >= 500,
            })
          )
        }

        const json = yield* response.json.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'open_meteo',
                statusCode: 0,
                message: `Failed to parse geocoding response: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        // Decode using transform schema
        const decoded = yield* Schema.decodeUnknown(GeocodingResponseSchema)(json).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ExternalApiError({
                source: 'open_meteo',
                statusCode: 0,
                message: `Invalid geocoding format: ${String(error)}`,
                retryable: false,
              })
            )
          )
        )

        return decoded
      })

    const getWeatherForLocation: OpenMeteoClient['getWeatherForLocation'] = (locationName, forecastOptions) =>
      Effect.gen(function* () {
        // First, geocode the location
        const geocodingResult = yield* geocode({ name: locationName, count: 1 })

        if (geocodingResult.results.length === 0) {
          return yield* Effect.fail(
            new ExternalApiError({
              source: 'open_meteo',
              statusCode: 404,
              message: `Location not found: ${locationName}`,
              retryable: false,
            })
          )
        }

        const location = geocodingResult.results[0]

        // Then, get the forecast
        const weather = yield* getForecast({
          latitude: location.latitude,
          longitude: location.longitude,
          ...forecastOptions,
        })

        return { location: geocodingResult, weather }
      })

    return {
      getForecast,
      geocode,
      getWeatherForLocation,
    }
  })

/**
 * Open-Meteo client layer (no configuration required)
 */
export const OpenMeteoClientLive = Layer.effect(
  OpenMeteoClientService,
  makeOpenMeteoClient()
)

// =============================================================================
// Combined Layer
// =============================================================================

/**
 * All external API clients layer
 * Note: Planet Labs and Sentinel Hub require API keys, add them separately.
 */
export const ExternalApiClientsLive = Layer.mergeAll(
  OpenSkyClientLive,
  OverpassClientLive,
  AdsbLolClientLive,
  OpenMeteoClientLive
)

// =============================================================================
// Result Transformers
// =============================================================================

/**
 * Map OpenSky category number to AircraftCategory
 */
const mapAircraftCategory = (category: number): AircraftCategory => {
  switch (category) {
    case 1: return 'light'
    case 2: return 'medium'
    case 3: return 'heavy'
    case 4: return 'super' // High vortex large
    case 5: return 'heavy'
    case 6: return 'heavy'
    case 7: return 'rotorcraft'
    case 8: return 'rotorcraft'
    case 9: return 'glider'
    case 10: return 'balloon' // Lighter than air
    case 11: return 'uav' // Parachute
    case 12: return 'uav' // Ultralight
    case 13: return 'uav'
    case 14: return 'uav'
    case 15: return 'space'
    case 16: return 'glider' // Surface emergency
    case 17: return 'unknown' // Ground service
    default: return 'unknown'
  }
}

/**
 * Transform OpenSky state to SearchResultFlight
 */
export const openSkyToSearchResult = (
  state: OpenSkyStateVector
): SearchResultFlight | null => {
  // Skip states without position
  if (state.longitude === null || state.latitude === null) {
    return null
  }

  return new SearchResultFlight({
    id: `flight-${state.icao24}` as SearchResultId,
    source: 'opensky',
    score: 1.0,
    retrievedAt: new Date(),
    icao24: state.icao24,
    callsign: state.callsign ?? '',
    position: [
      state.longitude,
      state.latitude,
      state.baroAltitude ?? state.geoAltitude ?? 0,
    ],
    velocity: state.velocity ?? 0,
    heading: state.trueTrack ?? 0,
    verticalRate: state.verticalRate ?? 0,
    onGround: state.onGround,
    category: mapAircraftCategory(state.category ?? 0),
    originCountry: state.originCountry,
    lastContact: new Date(state.lastContact * 1000),
  })
}

/**
 * Transform Overpass element to SearchResultPoi
 */
export const overpassToSearchResult = (
  element: OverpassElement
): SearchResultPoi | null => {
  // Get position from lat/lon or center
  const lat = element.lat ?? element.center?.lat
  const lon = element.lon ?? element.center?.lon

  if (lat === undefined || lon === undefined) {
    return null
  }

  // Determine category from tags using bracket notation for index signatures
  const tags = element.tags
  let category: SearchResultPoi['category'] = 'amenity'

  if (tags['amenity']) category = 'amenity'
  else if (tags['building']) category = 'building'
  else if (tags['highway']) category = 'highway'
  else if (tags['landuse']) category = 'landuse'
  else if (tags['leisure']) category = 'leisure'
  else if (tags['natural']) category = 'natural'
  else if (tags['shop']) category = 'shop'
  else if (tags['tourism']) category = 'tourism'
  else if (tags['aeroway']) category = 'aeroway'
  else if (tags['military']) category = 'military'
  else if (tags['emergency']) category = 'emergency'
  else if (tags['healthcare']) category = 'healthcare'
  else if (tags['office']) category = 'office'
  else if (tags['public_transport']) category = 'public_transport'

  return new SearchResultPoi({
    id: `osm-${element.type}-${element.id}` as SearchResultId,
    source: 'osm',
    score: 1.0,
    retrievedAt: new Date(),
    poiId: `${element.type}/${element.id}` as PoiId,
    position: [lon, lat],
    name: tags['name'] ?? tags['ref'] ?? `${element.type}/${element.id}`,
    category,
    tags,
  })
}

/**
 * Map ADSB.lol category string to AircraftCategory
 */
const mapAdsbLolCategory = (category: string | undefined): AircraftCategory => {
  if (!category) return 'unknown'
  // ADSB.lol uses single letter codes: A0-A7, B0-B7, C0-C7, D0-D7
  // A = Light, B = Medium, C = Heavy, D = High Performance
  const prefix = category.charAt(0).toUpperCase()
  switch (prefix) {
    case 'A': return 'light'
    case 'B': return 'medium'
    case 'C': return 'heavy'
    case 'D': return 'super'
    default: return 'unknown'
  }
}

/**
 * Transform ADSB.lol aircraft to SearchResultFlight
 */
export const adsbLolToSearchResult = (
  aircraft: AdsbLolAircraft
): SearchResultFlight | null => {
  // Skip aircraft without position
  if (aircraft.lat === undefined || aircraft.lon === undefined) {
    return null
  }

  // Convert altitude from feet to meters
  const altitudeMeters = aircraft.altitudeFt !== undefined
    ? aircraft.altitudeFt * 0.3048
    : 0

  // Convert ground speed from knots to m/s
  const velocityMs = aircraft.groundSpeedKts !== undefined
    ? aircraft.groundSpeedKts * 0.514444
    : 0

  // Convert vertical rate from fpm to m/s
  const verticalRateMs = aircraft.verticalRateFpm !== undefined
    ? aircraft.verticalRateFpm * 0.00508
    : 0

  return new SearchResultFlight({
    id: `adsb-${aircraft.hex}` as SearchResultId,
    source: 'adsb_lol',
    score: 1.0,
    retrievedAt: new Date(),
    icao24: aircraft.hex.toLowerCase() as Icao24,
    callsign: aircraft.flight?.trim() ?? '',
    position: [aircraft.lon, aircraft.lat, altitudeMeters],
    velocity: velocityMs,
    heading: aircraft.trackDeg ?? 0,
    verticalRate: verticalRateMs,
    onGround: aircraft.onGround ?? false,
    category: mapAdsbLolCategory(aircraft.category),
    originCountry: '', // ADSB.lol doesn't provide origin country
    lastContact: new Date(Date.now() - (aircraft.seenSec ?? 0) * 1000),
  })
}

/**
 * Extract centroid from GeoJSON geometry for position
 */
const extractCentroid = (geometry: unknown): readonly [number, number] | null => {
  if (!geometry || typeof geometry !== 'object') return null

  const geo = geometry as { type?: string; coordinates?: unknown }
  if (!geo.type || !geo.coordinates) return null

  switch (geo.type) {
    case 'Point': {
      const coords = geo.coordinates as [number, number]
      return coords
    }
    case 'Polygon': {
      // Use first coordinate of first ring as approximate centroid
      const coords = geo.coordinates as number[][][]
      if (coords.length > 0 && coords[0].length > 0) {
        const ring = coords[0]
        // Calculate centroid as average of all points
        let sumLon = 0, sumLat = 0
        for (const pt of ring) {
          sumLon += pt[0]
          sumLat += pt[1]
        }
        return [sumLon / ring.length, sumLat / ring.length]
      }
      return null
    }
    case 'MultiPolygon': {
      // Use first polygon's first coordinate
      const coords = geo.coordinates as number[][][][]
      if (coords.length > 0 && coords[0].length > 0 && coords[0][0].length > 0) {
        const ring = coords[0][0]
        let sumLon = 0, sumLat = 0
        for (const pt of ring) {
          sumLon += pt[0]
          sumLat += pt[1]
        }
        return [sumLon / ring.length, sumLat / ring.length]
      }
      return null
    }
    default:
      return null
  }
}

/**
 * Determine geometry type from GeoJSON geometry
 */
const getGeometryType = (geometry: unknown): 'Point' | 'LineString' | 'Polygon' => {
  if (!geometry || typeof geometry !== 'object') return 'Polygon'
  const geo = geometry as { type?: string }
  switch (geo.type) {
    case 'Point': return 'Point'
    case 'LineString': return 'LineString'
    case 'Polygon':
    case 'MultiPolygon':
    default:
      return 'Polygon'
  }
}

/**
 * Transform Planet Labs item to SearchResultFeature
 */
export const planetItemToSearchResult = (
  item: PlanetItem
): SearchResultFeature | null => {
  // Extract centroid from geometry
  const centroid = extractCentroid(item.geometry)
  if (!centroid) return null

  return new SearchResultFeature({
    id: `planet-${item.id}` as SearchResultId,
    source: 'planet',
    score: 1.0,
    retrievedAt: new Date(),
    featureId: item.id as FeatureId,
    position: centroid,
    geometryType: getGeometryType(item.geometry),
    properties: {
      name: `${item.itemType} - ${item.id}`,
      itemType: item.itemType,
      acquired: item.acquired.toISOString(),
      published: item.published.toISOString(),
      cloudCover: item.cloudCover,
      gsd: item.gsd,
      sunAzimuth: item.sunAzimuth,
      sunElevation: item.sunElevation,
      viewAngle: item.viewAngle,
      satelliteId: item.satelliteId,
      provider: item.provider,
      qualityCategory: item.qualityCategory,
      thumbnailUrl: item.thumbnailUrl,
      assetsUrl: item.assetsUrl,
      geometry: item.geometry,
    },
    label: `${item.itemType} - ${item.acquired.toISOString().slice(0, 10)}`,
  })
}

/**
 * Transform Sentinel Hub item to SearchResultFeature
 */
export const sentinelItemToSearchResult = (
  item: SentinelItem
): SearchResultFeature | null => {
  // Extract centroid from geometry
  const centroid = extractCentroid(item.geometry)
  if (!centroid) return null

  return new SearchResultFeature({
    id: `sentinel-${item.id}` as SearchResultId,
    source: 'feature', // Using 'feature' as generic satellite imagery source
    score: 1.0,
    retrievedAt: new Date(),
    featureId: item.id as FeatureId,
    position: centroid,
    geometryType: getGeometryType(item.geometry),
    properties: {
      name: `${item.collection ?? 'Sentinel'} - ${item.id}`,
      collection: item.collection,
      datetime: item.datetime.toISOString(),
      cloudCover: item.cloudCover,
      productId: item.productId,
      dataCoverage: item.dataCoverage,
      platform: item.platform,
      constellation: item.constellation,
      instruments: item.instruments,
      epsg: item.epsg,
      sunAzimuth: item.sunAzimuth,
      sunElevation: item.sunElevation,
      offNadir: item.offNadir,
      gsd: item.gsd,
      bbox: item.bbox,
      geometry: item.geometry,
      assets: item.assets,
    },
    label: `${item.collection ?? 'Sentinel'} - ${item.datetime.toISOString().slice(0, 10)}`,
  })
}

// =============================================================================
// Weather Result Transformers
// =============================================================================

/**
 * Map WMO weather code to human-readable description
 */
const wmoCodeToDescription = (code: number | undefined): string | undefined => {
  if (code === undefined) return undefined
  const descriptions: Record<number, string> = {
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
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
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
  return descriptions[code] ?? `Weather code ${code}`
}

/**
 * Transform Open-Meteo weather forecast to SearchResultWeather
 */
export const weatherForecastToSearchResult = (
  forecast: WeatherForecast,
  locationName: string
): SearchResultWeather | null => {
  const current = forecast.current
  if (!current) return null

  return new SearchResultWeather({
    id: `weather-${forecast.latitude.toFixed(4)}-${forecast.longitude.toFixed(4)}` as SearchResultId,
    source: 'weather',
    score: 1.0,
    retrievedAt: new Date(),
    locationName,
    position: [forecast.longitude, forecast.latitude],
    elevation: forecast.elevation,
    timezone: forecast.timezone,
    temperature: current.temperature,
    feelsLike: current.feelsLike,
    humidity: current.humidity,
    weatherCode: current.weatherCode,
    weatherDescription: wmoCodeToDescription(current.weatherCode),
    windSpeed: current.windSpeed,
    windDirection: current.windDirection,
    cloudCover: current.cloudCover,
    precipitation: current.precipitation,
    pressure: current.pressure,
    isDay: current.isDay,
    forecastTime: current.time,
    hasHourlyForecast: forecast.hourly !== undefined && forecast.hourly.length > 0,
    hasDailyForecast: forecast.daily !== undefined && forecast.daily.length > 0,
  })
}

/**
 * Transform geocoding location to SearchResultWeather (with placeholder weather)
 * Used when weather data not yet fetched
 */
export const geocodingLocationToSearchResult = (
  location: GeocodingLocation
): SearchResultWeather => {
  return new SearchResultWeather({
    id: `geocode-${location.id}` as SearchResultId,
    source: 'weather',
    score: 1.0,
    retrievedAt: new Date(),
    locationName: `${location.name}${location.country ? `, ${location.country}` : ''}`,
    position: [location.longitude, location.latitude],
    elevation: location.elevation,
    timezone: location.timezone,
    temperature: 0, // Placeholder - fetch actual weather separately
    forecastTime: new Date(),
    hasHourlyForecast: false,
    hasDailyForecast: false,
  })
}

// =============================================================================
// Imagery Result Transformers (Unified Planet + Sentinel)
// =============================================================================

/**
 * Transform Planet Labs item to SearchResultImagery
 */
export const planetItemToImageryResult = (
  item: PlanetItem
): SearchResultImagery | null => {
  const centroid = extractCentroid(item.geometry)
  if (!centroid) return null

  return new SearchResultImagery({
    id: `planet-img-${item.id}` as SearchResultId,
    source: 'planet',
    score: 1.0,
    retrievedAt: new Date(),
    itemId: item.id,
    provider: 'planet',
    collection: item.itemType,
    position: centroid,
    acquired: item.acquired,
    cloudCover: item.cloudCover,
    gsd: item.gsd,
    sunAzimuth: item.sunAzimuth,
    sunElevation: item.sunElevation,
    offNadir: item.viewAngle,
    thumbnailUrl: item.thumbnailUrl,
    assetsUrl: item.assetsUrl,
    label: `Planet ${item.itemType} - ${item.acquired.toISOString().slice(0, 10)}`,
  })
}

/**
 * Transform Sentinel Hub item to SearchResultImagery
 */
export const sentinelItemToImageryResult = (
  item: SentinelItem
): SearchResultImagery | null => {
  const centroid = extractCentroid(item.geometry)
  if (!centroid) return null

  return new SearchResultImagery({
    id: `sentinel-img-${item.id}` as SearchResultId,
    source: 'sentinel',
    score: 1.0,
    retrievedAt: new Date(),
    itemId: item.id,
    provider: 'sentinel',
    collection: item.collection ?? 'sentinel-2',
    position: centroid,
    acquired: item.datetime,
    cloudCover: item.cloudCover,
    gsd: item.gsd,
    sunAzimuth: item.sunAzimuth,
    sunElevation: item.sunElevation,
    offNadir: item.offNadir,
    bbox: item.bbox,
    label: `${item.collection ?? 'Sentinel'} - ${item.datetime.toISOString().slice(0, 10)}`,
  })
}
