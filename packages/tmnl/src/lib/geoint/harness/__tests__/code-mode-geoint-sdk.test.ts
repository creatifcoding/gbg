import { Effect, Schema } from 'effect'
import { beforeEach, describe, expect, it } from 'vitest'
import { executeCodeMode } from '@/lib/genifer/code-mode'
import { SearchResultFlight, SearchResultItem } from '../../schemas/search'
import {
  GeointHarnessService,
  GeointHarnessServiceLive,
} from '../GeointHarnessService'

describe('code-mode sdk.geoint', () => {
  beforeEach(async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* GeointHarnessService
        yield* service.clear()
      }).pipe(Effect.provide(GeointHarnessServiceLive)),
    )
  })

  it('supports sdk.geoint search/summary/focus/plan operations', async () => {
    const service = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* GeointHarnessService
      }).pipe(Effect.provide(GeointHarnessServiceLive)),
    )

    const flight = new SearchResultFlight({
      id: 'sr-flight-geoint-1' as any,
      source: 'opensky',
      score: 0.9,
      retrievedAt: new Date('2026-01-01T10:00:00Z'),
      icao24: 'abc123' as any,
      callsign: 'VALX01',
      position: [11, 22, 1000],
      velocity: 220,
      heading: 40,
      verticalRate: 0,
      onGround: false,
      category: 'medium',
      originCountry: 'US',
      lastContact: new Date('2026-01-01T09:59:50Z'),
    })

    const encoded = Schema.encodeSync(SearchResultItem)(flight)
    await Effect.runPromise(service.spawnFromSearchResult(flight))

    const result = await Effect.runPromise(
      executeCodeMode(
        {
          mode: 'execute',
          code: `
            const spawned = await sdk.geoint.spawn.one(${JSON.stringify(encoded)})
            const search = await sdk.geoint.search({ mode: 'type', entityType: 'flight' })
            const summary = await sdk.geoint.summary({ scope: 'all', includeViewport: true })
            const plan = await sdk.geoint.plan({
              queryId: 'q-sdk-plan-1',
              requestedSources: ['opensky', 'copernicus-stac'],
              strategy: 'coverage-first',
              constraints: { filterLanguage: 'cql2-json', maxSources: 2 },
            })
            const viewport = await sdk.geoint.focus('flight:abc123', 9)
            return {
              spawnedId: spawned?.entityId,
              searchCount: search.count,
              summaryTotal: summary.total,
              plannedSources: plan.decision.selected.length,
              viewportZoom: viewport.zoom,
            }
          `,
        },
        { geointService: service },
      ),
    )

    expect(result.success).toBe(true)
    expect((result.result as any).spawnedId).toBe('flight:abc123')
    expect((result.result as any).searchCount).toBeGreaterThanOrEqual(1)
    expect((result.result as any).summaryTotal).toBeGreaterThanOrEqual(1)
    expect((result.result as any).plannedSources).toBeGreaterThanOrEqual(1)
    expect((result.result as any).viewportZoom).toBe(9)
  })

  it('throws helpful error when geoint service is not provided', async () => {
    const result = await Effect.runPromiseExit(
      executeCodeMode({
        mode: 'execute',
        code: `
          await sdk.geoint.summary({ scope: 'all' })
          return true
        `,
      }),
    )

    expect(result._tag).toBe('Failure')
  })
})
