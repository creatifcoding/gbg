import { Effect } from 'effect'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  RegistryPlannerLive,
  planRegistryQuery,
} from '../planner'
import { resetSourceRegistry } from '../sourceRegistry'

describe('registry planner', () => {
  beforeEach(() => {
    resetSourceRegistry()
  })

  it('builds a ranked plan and respects maxSources', async () => {
    const plan = await Effect.runPromise(
      planRegistryQuery({
        queryId: 'q-plan-1',
        text: 'air tracks over AOI',
        requestedSources: ['opensky', 'adsb-lol', 'openmeteo'],
        strategy: 'latency-first',
        constraints: {
          _tag: 'QueryConstraintV1',
          maxSources: 2,
        },
      }).pipe(Effect.provide(RegistryPlannerLive))
    )

    expect(plan.decision.selected.length).toBe(2)
    expect(plan.decision.selected[0]?.rank).toBe(0)
    expect(plan.decision.selected[1]?.fallbackOf).toBeDefined()
    expect(plan.decision.rejected.some((item) => item.reason.includes('maxSources=2'))).toBe(true)
  })

  it('rejects sources incompatible with filter language constraints', async () => {
    const plan = await Effect.runPromise(
      planRegistryQuery({
        queryId: 'q-plan-2',
        requestedSources: ['opensky', 'copernicus-stac'],
        strategy: 'coverage-first',
        constraints: {
          _tag: 'QueryConstraintV1',
          filterLanguage: 'cql2-json',
          maxSources: 4,
        },
      }).pipe(Effect.provide(RegistryPlannerLive))
    )

    expect(plan.decision.selected.some((item) => item.canonicalSource === 'copernicus-stac')).toBe(true)
    expect(
      plan.decision.rejected.some(
        (item) => item.canonicalSource === 'opensky' && item.reason.includes('filter language')
      )
    ).toBe(true)
  })

  it('drops health-down sources from selected attempts', async () => {
    const plan = await Effect.runPromise(
      planRegistryQuery({
        queryId: 'q-plan-3',
        requestedSources: ['openmeteo', 'noaa'],
        strategy: 'trust-first',
        health: {
          openmeteo: { state: 'down', score: 0 },
          noaa: { state: 'healthy', score: 0.8 },
        },
      }).pipe(Effect.provide(RegistryPlannerLive))
    )

    expect(plan.decision.selected.every((item) => item.canonicalSource !== 'openmeteo')).toBe(true)
    expect(
      plan.decision.rejected.some(
        (item) => item.canonicalSource === 'openmeteo' && item.reason === 'source health down'
      )
    ).toBe(true)
  })
})
