import { Effect } from 'effect'
import { beforeEach, describe, expect, it } from 'vitest'
import { SearchResultFlight, SearchResultPoi } from '../../schemas/search'
import {
  GeointHarnessService,
  GeointHarnessServiceLive,
} from '../GeointHarnessService'

const provideService = <A, E>(effect: Effect.Effect<A, E, GeointHarnessService>) =>
  effect.pipe(Effect.provide(GeointHarnessServiceLive))

describe('GeointHarnessService', () => {
  beforeEach(async () => {
    await Effect.runPromise(
      provideService(
        Effect.gen(function* () {
          const service = yield* GeointHarnessService
          yield* service.clear()
        }),
      ),
    )
  })

  it('spawns entities from search results and exposes summaries', async () => {
    const result = await Effect.runPromise(
      provideService(
        Effect.gen(function* () {
          const service = yield* GeointHarnessService

          const flight = new SearchResultFlight({
            id: 'sr-flight-1' as any,
            source: 'opensky',
            score: 0.92,
            retrievedAt: new Date('2026-01-01T10:00:00Z'),
            icao24: 'abc123' as any,
            callsign: 'VAL007',
            position: [-71.1, 42.3, 1500],
            velocity: 240,
            heading: 45,
            verticalRate: 1,
            onGround: false,
            category: 'medium',
            originCountry: 'US',
            lastContact: new Date('2026-01-01T09:59:50Z'),
          })

          const poi = new SearchResultPoi({
            id: 'sr-poi-1' as any,
            source: 'osm',
            score: 0.7,
            retrievedAt: new Date('2026-01-01T10:00:00Z'),
            poiId: 'poi-1' as any,
            position: [-71.09, 42.35],
            name: 'Ops Cafe',
            category: 'amenity',
            tags: { amenity: 'cafe' },
          })

          yield* service.spawnFromSearchResult(flight)
          yield* service.spawnFromSearchResult(poi)

          const summaries = yield* service.getAllSummaries()
          const flights = yield* service.getByType('flight')
          const pois = yield* service.getByType('poi')
          return {
            summaries,
            flights,
            pois,
          }
        }),
      ),
    )

    expect(result.summaries).toHaveLength(2)
    expect(result.flights).toHaveLength(1)
    expect(result.pois).toHaveLength(1)
    expect(result.summaries.some((s) => s?.entityId === 'flight:abc123')).toBe(true)
    expect(result.summaries.some((s) => s?.entityId === 'poi:poi-1')).toBe(true)
  })

  it('focuses entity and updates viewport + selection', async () => {
    await Effect.runPromise(
      provideService(
        Effect.gen(function* () {
          const service = yield* GeointHarnessService

          const flight = new SearchResultFlight({
            id: 'sr-flight-2' as any,
            source: 'opensky',
            score: 0.95,
            retrievedAt: new Date('2026-01-01T10:00:00Z'),
            icao24: 'def456' as any,
            callsign: 'PRIME1',
            position: [12.5, 47.9, 3200],
            velocity: 250,
            heading: 120,
            verticalRate: 0,
            onGround: false,
            category: 'heavy',
            originCountry: 'DE',
            lastContact: new Date('2026-01-01T09:59:50Z'),
          })

          yield* service.spawnFromSearchResult(flight)
          const viewport = yield* service.focusEntity('flight:def456', 11)

          expect(viewport.longitude).toBe(12.5)
          expect(viewport.latitude).toBe(47.9)
          expect(viewport.zoom).toBe(11)

          const summary = yield* service.getSummary('flight:def456')
          expect(summary?.selected).toBe(true)
        }),
      ),
    )
  })

  it('rejects invalid viewport updates', async () => {
    const exit = await Effect.runPromiseExit(
      provideService(
        Effect.gen(function* () {
          const service = yield* GeointHarnessService
          yield* service.setViewport({ latitude: 120 })
        }),
      ),
    )

    expect(exit._tag).toBe('Failure')

    const viewport = await Effect.runPromise(
      provideService(
        Effect.gen(function* () {
          const service = yield* GeointHarnessService
          return yield* service.getViewport()
        }),
      ),
    )

    expect(viewport.latitude).toBeGreaterThanOrEqual(-90)
    expect(viewport.latitude).toBeLessThanOrEqual(90)
  })
})
