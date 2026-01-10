/**
 * ADSB.lol API Integration Tests
 *
 * Tests real ADSB.lol API calls for flight data.
 * Run with: RUN_INTEGRATION_TESTS=1 bun test AdsbLol.integration
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import {
  AdsbLolClientService,
  adsbLolToSearchResult,
} from '../../../api/ExternalApiClient'
import {
  RUN_INTEGRATION_TESTS,
  SFO_AIRPORT,
  TIMEOUT,
  RealApiClientsLayer,
} from './helpers'

describe.skipIf(!RUN_INTEGRATION_TESTS)('ADSB.lol Integration Tests', () => {

  describe('getByPoint', () => {
    it('fetches aircraft near SFO airport', async () => {
      const program = Effect.gen(function* () {
        const client = yield* AdsbLolClientService

        const response = yield* client.getByPoint({
          lat: SFO_AIRPORT[0],
          lon: SFO_AIRPORT[1],
          radiusNm: 50,
        })

        console.log(`ADSB.lol near SFO: ${response.aircraft?.length ?? 0} aircraft`)
        return response
      }).pipe(
        Effect.provide(RealApiClientsLayer),
        Effect.timeout(TIMEOUT)
      )

      const response = await Effect.runPromise(program)

      expect(response.timestamp).toBeDefined()
      expect(Array.isArray(response.aircraft) || response.aircraft === undefined).toBe(true)

      if (response.aircraft && response.aircraft.length > 0) {
        const first = response.aircraft[0]
        console.log(`  First aircraft: ${first.flight?.trim() || first.hex}`)

        // Test transformation
        const searchResult = adsbLolToSearchResult(first)
        if (searchResult) {
          expect(searchResult._tag).toBe('SearchResultFlight')
          expect(searchResult.source).toBe('adsb_lol')
        }
      }
    })

    it('handles small radius query', async () => {
      const program = Effect.gen(function* () {
        const client = yield* AdsbLolClientService

        const response = yield* client.getByPoint({
          lat: SFO_AIRPORT[0],
          lon: SFO_AIRPORT[1],
          radiusNm: 5, // Very small radius
        })

        console.log(`ADSB.lol 5nm radius: ${response.aircraft?.length ?? 0} aircraft`)
        return response
      }).pipe(
        Effect.provide(RealApiClientsLayer),
        Effect.timeout(TIMEOUT)
      )

      const response = await Effect.runPromise(program)
      expect(response.timestamp).toBeDefined()
    })
  })

  describe('getMilitary', () => {
    it('fetches military aircraft feed', async () => {
      const program = Effect.gen(function* () {
        const client = yield* AdsbLolClientService

        const response = yield* client.getMilitary()

        console.log(`ADSB.lol military: ${response.aircraft?.length ?? 0} aircraft`)
        return response
      }).pipe(
        Effect.provide(RealApiClientsLayer),
        Effect.timeout(TIMEOUT)
      )

      const response = await Effect.runPromise(program)

      expect(response.timestamp).toBeDefined()
      // Military feed might be empty, but should return valid structure
      expect(Array.isArray(response.aircraft) || response.aircraft === undefined).toBe(true)
    })
  })

  describe('getByCallsign', () => {
    it('fetches aircraft by callsign', async () => {
      const program = Effect.gen(function* () {
        const client = yield* AdsbLolClientService

        // UAL (United Airlines) is a common callsign prefix
        const response = yield* client.getByCallsign('UAL')

        console.log(`ADSB.lol callsign UAL: ${response.aircraft?.length ?? 0} aircraft`)
        return response
      }).pipe(
        Effect.provide(RealApiClientsLayer),
        Effect.timeout(TIMEOUT)
      )

      const response = await Effect.runPromise(program)
      expect(response.timestamp).toBeDefined()
    })
  })

  describe('getByType', () => {
    it('fetches aircraft by type code', async () => {
      const program = Effect.gen(function* () {
        const client = yield* AdsbLolClientService

        // B738 (Boeing 737-800) is a very common aircraft type
        const response = yield* client.getByType('B738')

        console.log(`ADSB.lol type B738: ${response.aircraft?.length ?? 0} aircraft`)
        return response
      }).pipe(
        Effect.provide(RealApiClientsLayer),
        Effect.timeout(TIMEOUT)
      )

      const response = await Effect.runPromise(program)
      expect(response.timestamp).toBeDefined()
    })
  })

  describe('getBySquawk', () => {
    it('fetches aircraft by squawk code', async () => {
      const program = Effect.gen(function* () {
        const client = yield* AdsbLolClientService

        // 7700 is emergency squawk - might be empty but tests the endpoint
        const response = yield* client.getBySquawk('7700')

        console.log(`ADSB.lol squawk 7700: ${response.aircraft?.length ?? 0} aircraft`)
        return response
      }).pipe(
        Effect.provide(RealApiClientsLayer),
        Effect.timeout(TIMEOUT)
      )

      const response = await Effect.runPromise(program)
      expect(response.timestamp).toBeDefined()
    })
  })

  describe('Transformation', () => {
    it('transforms aircraft to SearchResultFlight correctly', async () => {
      const program = Effect.gen(function* () {
        const client = yield* AdsbLolClientService

        const response = yield* client.getByPoint({
          lat: SFO_AIRPORT[0],
          lon: SFO_AIRPORT[1],
          radiusNm: 100,
        })

        if (!response.aircraft || response.aircraft.length === 0) {
          return null
        }

        // Transform all aircraft
        const searchResults = response.aircraft
          .map(adsbLolToSearchResult)
          .filter((r): r is NonNullable<typeof r> => r !== null)

        console.log(`Transformed ${searchResults.length}/${response.aircraft.length} aircraft`)

        return searchResults
      }).pipe(
        Effect.provide(RealApiClientsLayer),
        Effect.timeout(TIMEOUT)
      )

      const results = await Effect.runPromise(program)

      if (results && results.length > 0) {
        const first = results[0]
        expect(first._tag).toBe('SearchResultFlight')
        expect(first.source).toBe('adsb_lol')
        expect(first.position).toBeDefined()
        expect(first.retrievedAt).toBeInstanceOf(Date)
      }
    })
  })
})
