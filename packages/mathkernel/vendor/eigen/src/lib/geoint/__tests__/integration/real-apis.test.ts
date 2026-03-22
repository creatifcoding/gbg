/**
 * Real API Integration Tests
 *
 * These tests call actual external APIs to verify the integration works.
 * They are skipped in CI unless RUN_INTEGRATION_TESTS=1 is set.
 *
 * IMPORTANT: These tests make real HTTP requests and are subject to rate limits.
 * Run them sparingly and sequentially.
 *
 * @module geoint/__tests__/integration/real-apis.test
 */

import { describe, it, expect } from 'vitest'
import { Effect, Layer, Duration } from 'effect'
import { FetchHttpClient } from '@effect/platform'
import {
  OpenSkyClientService,
  OverpassClientService,
  AdsbLolClientService,
  OpenMeteoClientService,
  ExternalApiClientsLive,
  openSkyToSearchResult,
  overpassToSearchResult,
  adsbLolToSearchResult,
} from '../../api/ExternalApiClient'

// Skip unless explicitly enabled
const RUN_INTEGRATION_TESTS = process.env['RUN_INTEGRATION_TESTS'] === '1'

// San Francisco bounds for testing
const SF_BOUNDS: readonly [number, number, number, number] = [-122.5, 37.5, -122.0, 38.0]
const SF_CENTER: readonly [number, number] = [-122.4, 37.78]

// Provide the real HTTP client using FetchHttpClient (browser/Bun compatible)
const HttpClientLive = FetchHttpClient.layer

// Combined API clients layer with CircuitBreakers dependency
const ApiClientsWithDeps = ExternalApiClientsLive.pipe(Layer.provide(HttpClientLive))

// Longer timeout for real API calls
const TIMEOUT = Duration.seconds(60)

describe.skipIf(!RUN_INTEGRATION_TESTS)('Real API Integration Tests', () => {

  describe('OpenSky Network API', () => {
    it('fetches real flight data for San Francisco area', async () => {
      const program = Effect.gen(function* () {
        const client = yield* OpenSkyClientService

        const response = yield* client.getStates({ bounds: SF_BOUNDS })

        console.log(`OpenSky: Got ${response.states?.length ?? 0} flights at time ${response.time}`)

        // Validate response structure
        expect(response.time).toBeGreaterThan(0)

        // Transform to search results
        if (response.states && response.states.length > 0) {
          const searchResults = response.states
            .map(openSkyToSearchResult)
            .filter((r): r is NonNullable<typeof r> => r !== null)

          console.log(`OpenSky: Transformed ${searchResults.length} valid search results`)

          // Verify at least some results transformed correctly
          if (searchResults.length > 0) {
            const first = searchResults[0]
            expect(first._tag).toBe('SearchResultFlight')
            expect(first.source).toBe('opensky')
            expect(first.icao24).toBeDefined()
            expect(first.position).toBeDefined()
          }
        }

        return response
      })

      await Effect.runPromise(
        program.pipe(
          Effect.provide(ApiClientsWithDeps),
          Effect.timeout(TIMEOUT)
        )
      )
    })

    it('handles ICAO24 filter for specific aircraft', async () => {
      // Use a known active ICAO24 (this may vary - using a common US prefix)
      const testIcao24 = ['a00001', 'a00002', 'a00003']

      const program = Effect.gen(function* () {
        const client = yield* OpenSkyClientService

        const response = yield* client.getStates({ icao24: testIcao24 })

        console.log(`OpenSky ICAO filter: Got ${response.states?.length ?? 0} matching aircraft`)

        // Response should be valid even if no matches
        expect(response.time).toBeGreaterThan(0)

        return response
      })

      await Effect.runPromise(
        program.pipe(
          Effect.provide(ApiClientsWithDeps),
          Effect.timeout(TIMEOUT)
        )
      )
    })
  })

  describe('Overpass API (OpenStreetMap)', () => {
    it('fetches real POI data for hospitals in San Francisco', { timeout: 90000 }, async () => {
      const program = Effect.gen(function* () {
        const client = yield* OverpassClientService

        // Query for hospitals in SF - note: buildQuery expects options object
        const query = client.buildQuery({ bounds: SF_BOUNDS, amenities: ['hospital'] })
        console.log('Overpass query:', query.slice(0, 200) + '...')

        const response = yield* client.query(query)

        console.log(`Overpass: Got ${response.elements.length} hospital elements`)

        // Validate response structure
        expect(response.version).toBeDefined()
        expect(Array.isArray(response.elements)).toBe(true)

        // Transform to search results
        if (response.elements.length > 0) {
          const searchResults = response.elements
            .map(overpassToSearchResult)
            .filter((r): r is NonNullable<typeof r> => r !== null)

          console.log(`Overpass: Transformed ${searchResults.length} valid POI results`)

          if (searchResults.length > 0) {
            const first = searchResults[0]
            expect(first._tag).toBe('SearchResultPoi')
            expect(first.source).toBe('osm')
            expect(first.name).toBeDefined()
          }
        }

        return response
      })

      await Effect.runPromise(
        program.pipe(
          Effect.provide(ApiClientsWithDeps),
          Effect.timeout(TIMEOUT)
        )
      )
    })

    it('fetches restaurants near Fisherman\'s Wharf', { timeout: 90000 }, async () => {
      const fishmansWharf: readonly [number, number, number, number] = [-122.42, 37.805, -122.40, 37.815]

      const program = Effect.gen(function* () {
        const client = yield* OverpassClientService

        const query = client.buildQuery({
          bounds: fishmansWharf,
          amenities: ['restaurant', 'cafe'],
        })

        const response = yield* client.query(query)

        console.log(`Overpass (Fisherman's Wharf): Got ${response.elements.length} restaurant/cafe elements`)

        expect(response.elements.length).toBeGreaterThan(0)

        // Check we got some restaurants
        const restaurants = response.elements.filter(
          (el) => el.tags?.['amenity'] === 'restaurant'
        )
        console.log(`  - ${restaurants.length} restaurants`)

        return response
      })

      await Effect.runPromise(
        program.pipe(
          Effect.provide(ApiClientsWithDeps),
          Effect.timeout(TIMEOUT)
        )
      )
    })
  })

  describe('ADSB.lol API', () => {
    it('fetches real aircraft data by geographic point', async () => {
      const program = Effect.gen(function* () {
        const client = yield* AdsbLolClientService

        // Query around SFO airport
        const response = yield* client.getByPoint({
          lat: 37.6213,
          lon: -122.3790,
          radiusNm: 50, // 50nm radius around SFO
        })

        console.log(`ADSB.lol: Got ${response.aircraft?.length ?? 0} aircraft near SFO`)

        // Validate response structure
        expect(response.timestamp).toBeDefined()

        // Transform to search results
        if (response.aircraft && response.aircraft.length > 0) {
          const searchResults = response.aircraft
            .map(adsbLolToSearchResult)
            .filter((r): r is NonNullable<typeof r> => r !== null)

          console.log(`ADSB.lol: Transformed ${searchResults.length} valid flight results`)

          if (searchResults.length > 0) {
            const first = searchResults[0]
            expect(first._tag).toBe('SearchResultFlight')
            expect(first.source).toBe('adsb-lol')
          }
        }

        return response
      })

      await Effect.runPromise(
        program.pipe(
          Effect.provide(ApiClientsWithDeps),
          Effect.timeout(TIMEOUT)
        )
      )
    })

    it('fetches military aircraft feed', async () => {
      const program = Effect.gen(function* () {
        const client = yield* AdsbLolClientService

        const response = yield* client.getMilitary()

        console.log(`ADSB.lol military: Got ${response.aircraft?.length ?? 0} military aircraft`)

        // Military feed might be empty, but should return valid structure
        expect(response.timestamp).toBeDefined()
        expect(Array.isArray(response.aircraft) || response.aircraft === undefined).toBe(true)

        return response
      })

      await Effect.runPromise(
        program.pipe(
          Effect.provide(ApiClientsWithDeps),
          Effect.timeout(TIMEOUT)
        )
      )
    })
  })

  describe('Open-Meteo API', () => {
    it('fetches real weather forecast for San Francisco', async () => {
      const program = Effect.gen(function* () {
        const client = yield* OpenMeteoClientService

        const forecast = yield* client.getForecast({
          latitude: SF_CENTER[1],
          longitude: SF_CENTER[0],
          forecastDays: 1,
        })

        console.log(`Open-Meteo: Got forecast for ${forecast.latitude}, ${forecast.longitude}`)
        console.log(`  Timezone: ${forecast.timezone}`)
        console.log(`  Elevation: ${forecast.elevation}m`)

        // Validate response structure
        expect(forecast.latitude).toBeCloseTo(SF_CENTER[1], 1)
        expect(forecast.longitude).toBeCloseTo(SF_CENTER[0], 1)
        expect(forecast.timezone).toBeDefined()

        // Check we got hourly data
        if (forecast.hourly && forecast.hourly.length > 0) {
          console.log(`  Hourly data points: ${forecast.hourly.length}`)
          expect(forecast.hourly.length).toBeGreaterThan(0)
        }

        return forecast
      })

      await Effect.runPromise(
        program.pipe(
          Effect.provide(ApiClientsWithDeps),
          Effect.timeout(TIMEOUT)
        )
      )
    })

    it('geocodes a city name', async () => {
      const program = Effect.gen(function* () {
        const client = yield* OpenMeteoClientService

        // Geocode "San Francisco" - note: geocode expects GeocodingOptions object
        const response = yield* client.geocode({ name: 'San Francisco' })

        console.log(`Open-Meteo geocode: Got ${response.results?.length ?? 0} results for "San Francisco"`)

        expect(response.results).toBeDefined()
        expect(response.results!.length).toBeGreaterThan(0)

        const sf = response.results![0]
        console.log(`  Top result: ${sf.name}, ${sf.admin1}, ${sf.country}`)
        console.log(`  Coordinates: ${sf.latitude}, ${sf.longitude}`)

        expect(sf.name.toLowerCase()).toContain('san francisco')
        expect(sf.latitude).toBeCloseTo(37.78, 1)
        expect(sf.longitude).toBeCloseTo(-122.42, 1)

        return response
      })

      await Effect.runPromise(
        program.pipe(
          Effect.provide(ApiClientsWithDeps),
          Effect.timeout(TIMEOUT)
        )
      )
    })
  })

  describe('Combined Multi-Source Query', () => {
    it('fetches data from multiple sources for the same area', { timeout: 120000 }, async () => {
      const program = Effect.gen(function* () {
        const opensky = yield* OpenSkyClientService
        const overpass = yield* OverpassClientService
        const adsbLol = yield* AdsbLolClientService
        const weather = yield* OpenMeteoClientService

        // Parallel fetch from all sources with error handling
        const [flights, pois, adsbFlights, forecast] = yield* Effect.all([
          opensky.getStates({ bounds: SF_BOUNDS }).pipe(
            Effect.catchAll(() => Effect.succeed({ time: 0, states: [] }))
          ),
          overpass.query(overpass.buildQuery({ bounds: SF_BOUNDS, amenities: ['hospital'] })).pipe(
            Effect.catchAll(() => Effect.succeed({ version: 0.6, elements: [], generator: 'test', osm3s: { timestamp_osm_base: '', copyright: '' } }))
          ),
          adsbLol.getByPoint({ lat: 37.78, lon: -122.42, radiusNm: 25 }).pipe(
            Effect.catchAll(() => Effect.succeed({ timestamp: new Date(), aircraft: [] }))
          ),
          weather.getForecast({
            latitude: SF_CENTER[1],
            longitude: SF_CENTER[0],
            forecastDays: 1,
          }).pipe(
            Effect.catchAll(() => Effect.succeed({
              latitude: 0,
              longitude: 0,
              generationtime_ms: 0,
              utc_offset_seconds: 0,
              timezone: '',
              timezone_abbreviation: '',
              elevation: 0,
            }))
          ),
        ])

        console.log('\n=== Multi-Source Query Results ===')
        console.log(`OpenSky: ${flights.states?.length ?? 0} flights`)
        console.log(`Overpass: ${pois.elements?.length ?? 0} POIs`)
        console.log(`ADSB.lol: ${adsbFlights.aircraft?.length ?? 0} aircraft`)
        console.log(`Open-Meteo: ${forecast.timezone ? 'Got forecast' : 'No forecast'}`)
        console.log('=================================\n')

        // At least some sources should return data
        const totalResults =
          (flights.states?.length ?? 0) +
          (pois.elements?.length ?? 0) +
          (adsbFlights.aircraft?.length ?? 0)

        console.log(`Total results: ${totalResults}`)

        // We expect at least hospitals to exist in SF
        expect(pois.elements?.length ?? 0).toBeGreaterThan(0)
      })

      await Effect.runPromise(
        program.pipe(
          Effect.provide(ApiClientsWithDeps),
          Effect.timeout(Duration.seconds(120)) // Longer timeout for parallel queries
        )
      )
    })
  })
})
