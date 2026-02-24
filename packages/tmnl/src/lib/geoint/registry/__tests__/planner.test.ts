import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Effect } from 'effect'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  RegistryPlannerLive,
  planRegistryQuery,
  type RegistryPlannerRequest,
} from '../planner'
import type { RegistryQueryPlanV1 } from '../schemas'
import { resetSourceRegistry } from '../sourceRegistry'

const FIXED_NOW = new Date('2026-01-01T00:00:00.000Z')

const readFixture = (name: string) =>
  JSON.parse(
    readFileSync(
      resolve(
        process.cwd(),
        'src/lib/geoint/registry/__tests__/__fixtures__/planner',
        name,
      ),
      'utf8',
    ),
  ) as Record<string, unknown>

const normalizePlan = (plan: RegistryQueryPlanV1) => ({
  ...plan,
  generatedAt: plan.generatedAt.toISOString(),
  intent: {
    ...plan.intent,
    requestedAt: plan.intent.requestedAt.toISOString(),
  },
})

const buildPlan = (request: Omit<RegistryPlannerRequest, 'now'>) =>
  Effect.runPromise(
    planRegistryQuery({
      ...request,
      now: FIXED_NOW,
    }).pipe(Effect.provide(RegistryPlannerLive)),
  )

describe('registry planner', () => {
  beforeEach(() => {
    resetSourceRegistry()
  })

  it('matches golden fixture: latency-first with maxSources=2', async () => {
    const plan = await buildPlan({
      queryId: 'golden-latency-max2',
      text: 'air tracks over AOI',
      requestedSources: ['opensky', 'adsb-lol', 'openmeteo'],
      strategy: 'latency-first',
      constraints: {
        _tag: 'QueryConstraintV1',
        maxSources: 2,
      },
    })

    expect(normalizePlan(plan)).toEqual(readFixture('latency-first.max2.json'))
  })

  it('matches golden fixture: cql2 filter gating', async () => {
    const plan = await buildPlan({
      queryId: 'golden-filter-cql2',
      requestedSources: ['opensky', 'copernicus-stac'],
      strategy: 'coverage-first',
      constraints: {
        _tag: 'QueryConstraintV1',
        filterLanguage: 'cql2-json',
        maxSources: 4,
      },
    })

    expect(normalizePlan(plan)).toEqual(readFixture('filter-cql2.json'))
  })

  it('matches golden fixture: health-down rejection', async () => {
    const plan = await buildPlan({
      queryId: 'golden-health-down',
      requestedSources: ['openmeteo', 'noaa'],
      strategy: 'trust-first',
      health: {
        openmeteo: { state: 'down', score: 0 },
        noaa: { state: 'healthy', score: 0.8 },
      },
    })

    expect(normalizePlan(plan)).toEqual(readFixture('health-down.json'))
  })

  it('is deterministic for identical inputs', async () => {
    const request: Omit<RegistryPlannerRequest, 'now'> = {
      queryId: 'golden-determinism',
      text: 'deterministic test',
      requestedSources: ['opensky', 'adsb-lol', 'openmeteo'],
      strategy: 'latency-first',
      constraints: {
        _tag: 'QueryConstraintV1',
        maxSources: 3,
      },
    }

    const a = normalizePlan(await buildPlan(request))
    resetSourceRegistry()
    const b = normalizePlan(await buildPlan(request))

    expect(a).toEqual(b)
  })
})
