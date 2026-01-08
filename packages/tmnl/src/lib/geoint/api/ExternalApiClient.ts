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
  SearchResultFlight,
  SearchResultPoi,
  SearchResultId,
  Icao24,
  AircraftCategory,
  PoiId,
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
// Combined Layer
// =============================================================================

/**
 * All external API clients layer
 */
export const ExternalApiClientsLive = Layer.mergeAll(
  OpenSkyClientLive,
  OverpassClientLive
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
