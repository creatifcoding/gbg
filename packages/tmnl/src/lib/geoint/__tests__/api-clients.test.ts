/**
 * External API Client Tests
 *
 * Unit tests for GEOINT API clients using mock HttpClient layer.
 * Tests request construction, response parsing, rate limiting, and error handling.
 *
 * @module geoint/__tests__/api-clients.test
 */

import { describe, it, expect } from 'vitest'
import { Effect, Layer, Exit } from 'effect'
import { HttpClient, HttpClientRequest, HttpClientResponse } from '@effect/platform'
import {
  makeOpenSkyClient,
  makeOverpassClient,
  makeAdsbLolClient,
  makeRateLimiter,
  DEFAULT_OPENSKY_CONFIG,
  DEFAULT_OVERPASS_CONFIG,
  DEFAULT_ADSB_LOL_CONFIG,
} from '../api/ExternalApiClient'

// =============================================================================
// Mock Fixtures
// =============================================================================

const MOCK_OPENSKY_RESPONSE = {
  time: 1700000000,
  states: [
    [
      'abc123', // icao24
      'UAL123 ', // callsign (with trailing space)
      'United States', // origin country
      1700000000, // time_position
      1700000000, // last_contact
      -122.4194, // longitude
      37.7749, // latitude
      10000, // baro_altitude
      false, // on_ground
      250, // velocity
      180, // true_track
      5, // vertical_rate
      null, // sensors
      10100, // geo_altitude
      '1234', // squawk
      false, // spi
      0, // position_source
      3, // category (heavy)
    ],
    [
      'def456', // icao24
      null, // callsign (null)
      'Germany',
      null,
      1700000005,
      null, // no position
      null,
      8000,
      true,
      0,
      null,
      null,
      null,
      8000,
      null,
      false,
      0,
    ],
  ],
}

const MOCK_OVERPASS_RESPONSE = {
  version: 0.6,
  generator: 'Overpass API',
  osm3s: {
    timestamp_osm_base: '2024-01-15T12:00:00Z',
    copyright: 'OpenStreetMap contributors',
  },
  elements: [
    {
      type: 'node' as const,
      id: 12345678,
      lat: 37.7749,
      lon: -122.4194,
      tags: {
        name: 'Test Restaurant',
        amenity: 'restaurant',
        cuisine: 'italian',
      },
    },
    {
      type: 'way' as const,
      id: 87654321,
      center: {
        lat: 37.78,
        lon: -122.42,
      },
      tags: {
        name: 'Test Park',
        leisure: 'park',
      },
    },
  ],
}

const MOCK_ADSB_LOL_RESPONSE = {
  now: Date.now() / 1000,
  total: 2,
  ctime: 1700000000,
  ptime: 1700000001,
  ac: [
    {
      hex: 'ABC123',
      flight: 'UAL456  ',
      r: 'N12345',
      t: 'A320',
      desc: 'Airbus A320',
      dbFlags: 0,
      lat: 37.7749,
      lon: -122.4194,
      alt_baro: 35000,
      alt_geom: 35200,
      gs: 450,
      ias: 280,
      tas: 460,
      mach: 0.78,
      track: 270,
      baro_rate: 0,
      geom_rate: 0,
      squawk: '1234',
      emergency: null,
      category: 'B2',
      nav_modes: null,
      seen: 1,
      seen_pos: 1,
      rssi: -28.5,
      alert: 0,
      spi: 0,
      wake: null,
      version: 2,
      nic: 8,
      nac_p: 9,
      nac_v: 2,
      sil: 3,
      sil_type: 'perhour',
      gva: 2,
      sda: 2,
      messages: 12345,
    },
    {
      hex: 'MIL001',
      flight: 'RCH123  ',
      r: null,
      t: 'C17',
      desc: 'Boeing C-17',
      dbFlags: 1, // Military flag
      lat: 38.0,
      lon: -121.5,
      alt_baro: 28000,
      alt_geom: null,
      gs: 400,
      ias: null,
      tas: null,
      mach: null,
      track: 90,
      baro_rate: 1000,
      geom_rate: null,
      squawk: '7777',
      emergency: null,
      category: 'C3',
      nav_modes: null,
      seen: 5,
      seen_pos: 5,
      rssi: -30,
      alert: null,
      spi: null,
      wake: null,
      version: null,
      nic: null,
      nac_p: null,
      nac_v: null,
      sil: null,
      sil_type: null,
      gva: null,
      sda: null,
      messages: 5000,
    },
  ],
  msg: null,
}

// =============================================================================
// Mock HTTP Client Factory
// =============================================================================

interface MockHttpClientOptions {
  /** Response body to return */
  responseBody?: unknown
  /** HTTP status code to return */
  status?: number
  /** Headers to return */
  headers?: Record<string, string>
  /** Error to throw */
  error?: Error
  /** Simulate timeout */
  timeout?: boolean
  /** Callback to capture request */
  onRequest?: (request: HttpClientRequest.HttpClientRequest) => void
}

const createMockHttpClient = (options: MockHttpClientOptions = {}) => {
  const {
    responseBody = {},
    status = 200,
    headers = { 'content-type': 'application/json' },
    error,
    timeout,
    onRequest,
  } = options

  return HttpClient.HttpClient.of({
    execute: (request: HttpClientRequest.HttpClientRequest) => {
      // Capture request for assertions
      onRequest?.(request)

      // Simulate error
      if (error) {
        return Effect.fail(error)
      }

      // Simulate timeout (never resolves)
      if (timeout) {
        return Effect.never
      }

      // Create mock response
      const response: HttpClientResponse.HttpClientResponse = {
        status,
        headers: {
          get: (name: string) => headers[name.toLowerCase()],
          has: (name: string) => name.toLowerCase() in headers,
          set: () => headers,
          forEach: () => {},
          entries: () => Object.entries(headers).values(),
          keys: () => Object.keys(headers).values(),
          values: () => Object.values(headers).values(),
          [Symbol.iterator]: () => Object.entries(headers).values(),
        } as any,
        json: Effect.succeed(responseBody),
        text: Effect.succeed(JSON.stringify(responseBody)),
        stream: Effect.succeed(new ReadableStream()),
        arrayBuffer: Effect.succeed(new ArrayBuffer(0)),
        formData: Effect.succeed(new FormData()),
        urlParamsBody: Effect.succeed(new URLSearchParams()),
      } as unknown as HttpClientResponse.HttpClientResponse

      return Effect.succeed(response)
    },
    get: () => Effect.never,
    post: () => Effect.never,
    put: () => Effect.never,
    del: () => Effect.never,
    head: () => Effect.never,
    patch: () => Effect.never,
    options: () => Effect.never,
  } as unknown as HttpClient.HttpClient)
}

const createMockHttpClientLayer = (options: MockHttpClientOptions = {}) =>
  Layer.succeed(HttpClient.HttpClient, createMockHttpClient(options))

// =============================================================================
// Rate Limiter Tests
// =============================================================================

describe('makeRateLimiter', () => {
  it('allows requests within rate limit', async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* makeRateLimiter('test', 60, 5)

      // Should allow 5 requests (burst size)
      for (let i = 0; i < 5; i++) {
        yield* limiter.acquire
      }

      return 'success'
    })

    const result = await Effect.runPromise(program)
    expect(result).toBe('success')
  })

  it('fails when rate limit exceeded', async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* makeRateLimiter('test', 60, 3)

      // Exhaust all tokens
      yield* limiter.acquire
      yield* limiter.acquire
      yield* limiter.acquire

      // This should fail
      yield* limiter.acquire
    })

    const exit = await Effect.runPromiseExit(program)
    expect(Exit.isFailure(exit)).toBe(true)

    if (Exit.isFailure(exit)) {
      const error = exit.cause
      // Check the cause contains RateLimitError
      expect(String(error)).toContain('Rate limit exceeded')
    }
  })

  it('releases tokens correctly', async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* makeRateLimiter('test', 60, 2)

      // Use all tokens
      yield* limiter.acquire
      yield* limiter.acquire

      // Release one
      yield* limiter.release

      // Should work now
      yield* limiter.acquire

      return 'success'
    })

    const result = await Effect.runPromise(program)
    expect(result).toBe('success')
  })
})

// =============================================================================
// OpenSky Client Tests
// =============================================================================

describe('OpenSkyClient', () => {
  describe('getStates', () => {
    it('fetches states successfully with bounds', async () => {
      let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

      const program = Effect.gen(function* () {
        const client = yield* makeOpenSkyClient({
          ...DEFAULT_OPENSKY_CONFIG,
          requestsPerMinute: 100, // High limit for tests
        })

        return yield* client.getStates({
          bounds: [-123, 37, -122, 38],
        })
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            responseBody: MOCK_OPENSKY_RESPONSE,
            onRequest: (req) => {
              capturedRequest = req
            },
          })
        )
      )

      const response = await Effect.runPromise(program)

      // Verify response
      expect(response._tag).toBe('OpenSkyResponse')
      expect(response.time).toBe(1700000000)
      expect(response.states).toHaveLength(2)

      // Verify first state
      expect(response.states![0].icao24).toBe('abc123')
      expect(response.states![0].callsign).toBe('UAL123 ')
      expect(response.states![0].longitude).toBe(-122.4194)
      expect(response.states![0].latitude).toBe(37.7749)
      expect(response.states![0].category).toBe(3)

      // Verify request URL contains bounds
      expect(capturedRequest?.url).toContain('lamin=37')
      expect(capturedRequest?.url).toContain('lomin=-123')
      expect(capturedRequest?.url).toContain('lamax=38')
      expect(capturedRequest?.url).toContain('lomax=-122')
    })

    it('handles ICAO24 filter', async () => {
      let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

      const program = Effect.gen(function* () {
        const client = yield* makeOpenSkyClient({
          ...DEFAULT_OPENSKY_CONFIG,
          requestsPerMinute: 100,
        })

        return yield* client.getStates({
          icao24: ['abc123', 'def456'],
        })
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            responseBody: MOCK_OPENSKY_RESPONSE,
            onRequest: (req) => {
              capturedRequest = req
            },
          })
        )
      )

      await Effect.runPromise(program)

      // Verify ICAO24 params in URL
      expect(capturedRequest?.url).toContain('icao24=abc123')
      expect(capturedRequest?.url).toContain('icao24=def456')
    })

    it('handles time parameter', async () => {
      let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

      const program = Effect.gen(function* () {
        const client = yield* makeOpenSkyClient({
          ...DEFAULT_OPENSKY_CONFIG,
          requestsPerMinute: 100,
        })

        return yield* client.getStates({
          time: 1700000000,
        })
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            responseBody: MOCK_OPENSKY_RESPONSE,
            onRequest: (req) => {
              capturedRequest = req
            },
          })
        )
      )

      await Effect.runPromise(program)

      expect(capturedRequest?.url).toContain('time=1700000000')
    })

    it('handles null states in response', async () => {
      const program = Effect.gen(function* () {
        const client = yield* makeOpenSkyClient({
          ...DEFAULT_OPENSKY_CONFIG,
          requestsPerMinute: 100,
        })

        return yield* client.getStates({})
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            responseBody: { time: 1700000000, states: null },
          })
        )
      )

      const response = await Effect.runPromise(program)
      expect(response.states).toBeNull()
    })

    it('handles HTTP 429 rate limit error', async () => {
      const program = Effect.gen(function* () {
        const client = yield* makeOpenSkyClient({
          ...DEFAULT_OPENSKY_CONFIG,
          requestsPerMinute: 100,
        })

        return yield* client.getStates({})
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            status: 429,
          })
        )
      )

      const exit = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(exit)).toBe(true)

      if (Exit.isFailure(exit)) {
        const error = String(exit.cause)
        expect(error).toContain('429')
        expect(error).toContain('OpenSky')
      }
    })

    it('handles HTTP 500 server error as retryable', async () => {
      const program = Effect.gen(function* () {
        const client = yield* makeOpenSkyClient({
          ...DEFAULT_OPENSKY_CONFIG,
          requestsPerMinute: 100,
        })

        return yield* client.getStates({})
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            status: 500,
          })
        )
      )

      const exit = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(exit)).toBe(true)

      if (Exit.isFailure(exit)) {
        const error = String(exit.cause)
        expect(error).toContain('500')
      }
    })

    it('handles invalid JSON response', async () => {
      const program = Effect.gen(function* () {
        const client = yield* makeOpenSkyClient({
          ...DEFAULT_OPENSKY_CONFIG,
          requestsPerMinute: 100,
        })

        return yield* client.getStates({})
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            responseBody: { invalid: 'response' }, // Missing required fields
          })
        )
      )

      const exit = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(exit)).toBe(true)

      if (Exit.isFailure(exit)) {
        const error = String(exit.cause)
        expect(error).toContain('Invalid OpenSky response format')
      }
    })
  })
})

// =============================================================================
// Overpass Client Tests
// =============================================================================

describe('OverpassClient', () => {
  describe('buildQuery', () => {
    it('builds query with amenity filters', async () => {
      const program = Effect.gen(function* () {
        const client = yield* makeOverpassClient({
          ...DEFAULT_OVERPASS_CONFIG,
          requestsPerMinute: 100,
        })

        return client.buildQuery({
          bounds: [-123, 37, -122, 38],
          amenities: ['restaurant', 'cafe'],
        })
      }).pipe(Effect.provide(createMockHttpClientLayer()))

      const query = await Effect.runPromise(program)

      expect(query).toContain('[out:json][timeout:25]')
      expect(query).toContain('37,-123,38,-122') // bbox format
      expect(query).toContain('amenity')
      expect(query).toContain('restaurant|cafe')
      expect(query).toContain('out center')
    })

    it('builds query with tag filters', async () => {
      const program = Effect.gen(function* () {
        const client = yield* makeOverpassClient({
          ...DEFAULT_OVERPASS_CONFIG,
          requestsPerMinute: 100,
        })

        return client.buildQuery({
          bounds: [-123, 37, -122, 38],
          tags: { shop: 'supermarket', cuisine: 'italian' },
        })
      }).pipe(Effect.provide(createMockHttpClientLayer()))

      const query = await Effect.runPromise(program)

      expect(query).toContain('"shop"="supermarket"')
      expect(query).toContain('"cuisine"="italian"')
    })

    it('builds default query when no filters', async () => {
      const program = Effect.gen(function* () {
        const client = yield* makeOverpassClient({
          ...DEFAULT_OVERPASS_CONFIG,
          requestsPerMinute: 100,
        })

        return client.buildQuery({
          bounds: [-123, 37, -122, 38],
        })
      }).pipe(Effect.provide(createMockHttpClientLayer()))

      const query = await Effect.runPromise(program)

      expect(query).toContain('nwr(')
    })
  })

  describe('query', () => {
    it('executes query successfully', async () => {
      let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

      const program = Effect.gen(function* () {
        const client = yield* makeOverpassClient({
          ...DEFAULT_OVERPASS_CONFIG,
          requestsPerMinute: 100,
        })

        return yield* client.query('[out:json];node(37,-123,38,-122);out;')
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            responseBody: MOCK_OVERPASS_RESPONSE,
            onRequest: (req) => {
              capturedRequest = req
            },
          })
        )
      )

      const response = await Effect.runPromise(program)

      // Verify response
      expect(response._tag).toBe('OverpassResponse')
      expect(response.version).toBe(0.6)
      expect(response.generator).toBe('Overpass API')
      expect(response.elements).toHaveLength(2)

      // Verify node element
      expect(response.elements[0].type).toBe('node')
      expect(response.elements[0].id).toBe(12345678)
      expect(response.elements[0].tags['name']).toBe('Test Restaurant')

      // Verify way element with center
      expect(response.elements[1].type).toBe('way')
      expect(response.elements[1].center?.lat).toBe(37.78)

      // Verify request is POST
      expect(capturedRequest?.method).toBe('POST')
    })

    it('handles empty elements response', async () => {
      const program = Effect.gen(function* () {
        const client = yield* makeOverpassClient({
          ...DEFAULT_OVERPASS_CONFIG,
          requestsPerMinute: 100,
        })

        return yield* client.query('[out:json];node(0,0,1,1);out;')
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            responseBody: {
              ...MOCK_OVERPASS_RESPONSE,
              elements: [],
            },
          })
        )
      )

      const response = await Effect.runPromise(program)
      expect(response.elements).toHaveLength(0)
    })

    it('handles custom timeout', async () => {
      const program = Effect.gen(function* () {
        const client = yield* makeOverpassClient({
          ...DEFAULT_OVERPASS_CONFIG,
          requestsPerMinute: 100,
        })

        return yield* client.query('[out:json];node(37,-123,38,-122);out;', {
          timeout: 120, // 120 seconds
        })
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            responseBody: MOCK_OVERPASS_RESPONSE,
          })
        )
      )

      const response = await Effect.runPromise(program)
      expect(response._tag).toBe('OverpassResponse')
    })
  })
})

// =============================================================================
// ADSB.lol Client Tests
// =============================================================================

describe('AdsbLolClient', () => {
  describe('getByPoint', () => {
    it('fetches aircraft by point successfully', async () => {
      let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

      const program = Effect.gen(function* () {
        const client = yield* makeAdsbLolClient({
          ...DEFAULT_ADSB_LOL_CONFIG,
          requestsPerMinute: 100,
        })

        return yield* client.getByPoint({
          lat: 37.7749,
          lon: -122.4194,
          radiusNm: 50,
        })
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            responseBody: MOCK_ADSB_LOL_RESPONSE,
            onRequest: (req) => {
              capturedRequest = req
            },
          })
        )
      )

      const response = await Effect.runPromise(program)

      // Verify response structure (domain type)
      expect(response._tag).toBe('AdsbLolResponse')
      expect(response.timestamp).toBeInstanceOf(Date)
      expect(response.aircraft).toHaveLength(2)

      // Verify first aircraft (domain type, transformed)
      const firstAircraft = response.aircraft[0]
      expect(firstAircraft.hex).toBe('ABC123')
      expect(firstAircraft.flight).toBe('UAL456  ')
      expect(firstAircraft.registration).toBe('N12345')
      expect(firstAircraft.aircraftType).toBe('A320')
      expect(firstAircraft.altitudeFt).toBe(35000)
      expect(firstAircraft.groundSpeedKts).toBe(450)
      expect(firstAircraft.category).toBe('B2')

      // Verify military flag detection
      const militaryAircraft = response.aircraft[1]
      expect(militaryAircraft.isMilitary).toBe(true)

      // Verify URL format
      expect(capturedRequest?.url).toContain('/v2/point/37.7749/-122.4194/50')
    })

    it('caps radius at 250nm', async () => {
      let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

      const program = Effect.gen(function* () {
        const client = yield* makeAdsbLolClient({
          ...DEFAULT_ADSB_LOL_CONFIG,
          requestsPerMinute: 100,
        })

        return yield* client.getByPoint({
          lat: 37.7749,
          lon: -122.4194,
          radiusNm: 500, // Over max
        })
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            responseBody: MOCK_ADSB_LOL_RESPONSE,
            onRequest: (req) => {
              capturedRequest = req
            },
          })
        )
      )

      await Effect.runPromise(program)

      // Should cap at 250
      expect(capturedRequest?.url).toContain('/v2/point/37.7749/-122.4194/250')
    })
  })

  describe('getByIcao', () => {
    it('fetches aircraft by ICAO hex code', async () => {
      let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

      const program = Effect.gen(function* () {
        const client = yield* makeAdsbLolClient({
          ...DEFAULT_ADSB_LOL_CONFIG,
          requestsPerMinute: 100,
        })

        return yield* client.getByIcao('ABC123')
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            responseBody: MOCK_ADSB_LOL_RESPONSE,
            onRequest: (req) => {
              capturedRequest = req
            },
          })
        )
      )

      await Effect.runPromise(program)

      // Should lowercase the ICAO
      expect(capturedRequest?.url).toContain('/v2/icao/abc123')
    })
  })

  describe('getByCallsign', () => {
    it('fetches aircraft by callsign', async () => {
      let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

      const program = Effect.gen(function* () {
        const client = yield* makeAdsbLolClient({
          ...DEFAULT_ADSB_LOL_CONFIG,
          requestsPerMinute: 100,
        })

        return yield* client.getByCallsign('ual456')
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            responseBody: MOCK_ADSB_LOL_RESPONSE,
            onRequest: (req) => {
              capturedRequest = req
            },
          })
        )
      )

      await Effect.runPromise(program)

      // Should uppercase the callsign
      expect(capturedRequest?.url).toContain('/v2/callsign/UAL456')
    })
  })

  describe('getByType', () => {
    it('fetches aircraft by type code', async () => {
      let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

      const program = Effect.gen(function* () {
        const client = yield* makeAdsbLolClient({
          ...DEFAULT_ADSB_LOL_CONFIG,
          requestsPerMinute: 100,
        })

        return yield* client.getByType('a320')
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            responseBody: MOCK_ADSB_LOL_RESPONSE,
            onRequest: (req) => {
              capturedRequest = req
            },
          })
        )
      )

      await Effect.runPromise(program)

      expect(capturedRequest?.url).toContain('/v2/type/A320')
    })
  })

  describe('getBySquawk', () => {
    it('fetches aircraft by squawk code', async () => {
      let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

      const program = Effect.gen(function* () {
        const client = yield* makeAdsbLolClient({
          ...DEFAULT_ADSB_LOL_CONFIG,
          requestsPerMinute: 100,
        })

        return yield* client.getBySquawk('7700') // Emergency
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            responseBody: MOCK_ADSB_LOL_RESPONSE,
            onRequest: (req) => {
              capturedRequest = req
            },
          })
        )
      )

      await Effect.runPromise(program)

      expect(capturedRequest?.url).toContain('/v2/squawk/7700')
    })
  })

  describe('getMilitary', () => {
    it('fetches military aircraft', async () => {
      let capturedRequest: HttpClientRequest.HttpClientRequest | undefined

      const program = Effect.gen(function* () {
        const client = yield* makeAdsbLolClient({
          ...DEFAULT_ADSB_LOL_CONFIG,
          requestsPerMinute: 100,
        })

        return yield* client.getMilitary()
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            responseBody: MOCK_ADSB_LOL_RESPONSE,
            onRequest: (req) => {
              capturedRequest = req
            },
          })
        )
      )

      await Effect.runPromise(program)

      expect(capturedRequest?.url).toContain('/v2/mil')
    })
  })

  describe('error handling', () => {
    it('handles ground aircraft altitude', async () => {
      const groundResponse = {
        ...MOCK_ADSB_LOL_RESPONSE,
        ac: [
          {
            ...MOCK_ADSB_LOL_RESPONSE.ac[0],
            alt_baro: 'ground' as const, // On ground
            gs: 0,
          },
        ],
      }

      const program = Effect.gen(function* () {
        const client = yield* makeAdsbLolClient({
          ...DEFAULT_ADSB_LOL_CONFIG,
          requestsPerMinute: 100,
        })

        return yield* client.getByPoint({ lat: 37, lon: -122, radiusNm: 50 })
      }).pipe(
        Effect.provide(
          createMockHttpClientLayer({
            responseBody: groundResponse,
          })
        )
      )

      const response = await Effect.runPromise(program)

      expect(response.aircraft[0].altitudeFt).toBe(0)
      expect(response.aircraft[0].onGround).toBe(true)
    })
  })
})
