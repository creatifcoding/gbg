/**
 * Open-Meteo API Integration Tests
 *
 * Tests real Open-Meteo API calls for weather data.
 * Run with: RUN_INTEGRATION_TESTS=1 bun test OpenMeteo.integration
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { OpenMeteoClientService } from '../../../api/ExternalApiClient'
import {
  RUN_INTEGRATION_TESTS,
  SF_CENTER,
  TIMEOUT,
  FreshApiClientsLayer,
} from './helpers'

describe.skipIf(!RUN_INTEGRATION_TESTS)('Open-Meteo Integration Tests', () => {
  describe('getForecast', () => {
    it('fetches weather forecast for San Francisco', async () => {
      const program = Effect.gen(function* () {
        const client = yield* OpenMeteoClientService

        const forecast = yield* client.getForecast({
          latitude: SF_CENTER[1],
          longitude: SF_CENTER[0],
          forecastDays: 1,
        })

        console.log(`Open-Meteo forecast: ${forecast.timezone}`)
        console.log(`  Elevation: ${forecast.elevation}m`)
        console.log(`  Hourly points: ${forecast.hourly?.length ?? 0}`)

        return forecast
      }).pipe(Effect.provide(FreshApiClientsLayer), Effect.timeout(TIMEOUT))

      const forecast = await Effect.runPromise(program)

      expect(forecast.latitude).toBeCloseTo(SF_CENTER[1], 1)
      expect(forecast.longitude).toBeCloseTo(SF_CENTER[0], 1)
      expect(forecast.timezone).toBeDefined()
      expect(forecast.elevation).toBeDefined()
    })

    it('fetches multi-day forecast', async () => {
      const program = Effect.gen(function* () {
        const client = yield* OpenMeteoClientService

        const forecast = yield* client.getForecast({
          latitude: SF_CENTER[1],
          longitude: SF_CENTER[0],
          forecastDays: 3,
        })

        console.log(`3-day forecast: ${forecast.hourly?.length ?? 0} hourly points`)

        return forecast
      }).pipe(Effect.provide(FreshApiClientsLayer), Effect.timeout(TIMEOUT))

      const forecast = await Effect.runPromise(program)

      if (forecast.hourly) {
        expect(forecast.hourly.length).toBeGreaterThanOrEqual(24)
      }
    })

    it('returns hourly data structure', async () => {
      const program = Effect.gen(function* () {
        const client = yield* OpenMeteoClientService

        const forecast = yield* client.getForecast({
          latitude: SF_CENTER[1],
          longitude: SF_CENTER[0],
          forecastDays: 1,
        })

        return forecast
      }).pipe(Effect.provide(FreshApiClientsLayer), Effect.timeout(TIMEOUT))

      const forecast = await Effect.runPromise(program)

      if (forecast.hourly && forecast.hourly.length > 0) {
        const first = forecast.hourly[0] as any
        expect(first).toBeDefined()
      }
    })
  })

  describe('geocode', () => {
    it('geocodes San Francisco', async () => {
      const program = Effect.gen(function* () {
        const client = yield* OpenMeteoClientService

        const response = yield* client.geocode({ name: 'San Francisco' })

        console.log(`Geocode results: ${response.results?.length ?? 0}`)

        return response
      }).pipe(Effect.provide(FreshApiClientsLayer), Effect.timeout(TIMEOUT))

      const response = await Effect.runPromise(program)

      expect(response.results).toBeDefined()
      expect(response.results!.length).toBeGreaterThan(0)

      const sf = response.results![0]
      expect(sf.name.toLowerCase()).toContain('san francisco')
      expect(sf.latitude).toBeCloseTo(37.78, 1)
      expect(sf.longitude).toBeCloseTo(-122.42, 1)

      console.log(`  Top result: ${sf.name}, ${sf.admin1}, ${sf.country}`)
    })

    it('geocodes major city', async () => {
      const program = Effect.gen(function* () {
        const client = yield* OpenMeteoClientService

        const response = yield* client.geocode({ name: 'New York' })

        return response
      }).pipe(Effect.provide(FreshApiClientsLayer), Effect.timeout(TIMEOUT))

      const response = await Effect.runPromise(program)

      expect(response.results).toBeDefined()
      expect(response.results!.length).toBeGreaterThan(0)

      const ny = response.results![0]
      console.log(`New York: ${ny.latitude}, ${ny.longitude}`)
      expect(ny.latitude).toBeCloseTo(40.7, 1)
      expect(ny.longitude).toBeCloseTo(-74.0, 1)
    })

    it('handles unknown location gracefully', async () => {
      const program = Effect.gen(function* () {
        const client = yield* OpenMeteoClientService

        const response = yield* client.geocode({ name: 'xyznonexistentplace123' })

        return response
      }).pipe(Effect.provide(FreshApiClientsLayer), Effect.timeout(TIMEOUT))

      const response = await Effect.runPromise(program)

      expect(response.results === undefined || response.results.length === 0).toBe(true)
    })
  })

  describe('Combined Weather Query', () => {
    it('geocodes then gets forecast', async () => {
      const program = Effect.gen(function* () {
        const client = yield* OpenMeteoClientService

        const geoResult = yield* client.geocode({ name: 'San Francisco' })

        if (!geoResult.results || geoResult.results.length === 0) {
          return null
        }

        const location = geoResult.results[0]

        const forecast = yield* client.getForecast({
          latitude: location.latitude,
          longitude: location.longitude,
          forecastDays: 1,
        })

        console.log(`Weather for ${location.name}: ${forecast.timezone}`)

        return { location, forecast }
      }).pipe(Effect.provide(FreshApiClientsLayer), Effect.timeout(TIMEOUT))

      const result = await Effect.runPromise(program)

      if (result) {
        expect(result.location.name.toLowerCase()).toContain('san francisco')
        expect(result.forecast.timezone).toBeDefined()
      }
    })
  })
})
