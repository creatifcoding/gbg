import { Effect, Schema } from 'effect'
import { beforeEach, describe, expect, it } from 'vitest'
import { SearchResultFlight, SearchResultPoi, SearchResultItem } from '../../schemas/search'
import {
  GeointHarnessService,
  GeointHarnessServiceLive,
} from '../GeointHarnessService'
import { createGeointTools } from '../bridge'

const getService = () =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* GeointHarnessService
    }).pipe(Effect.provide(GeointHarnessServiceLive)),
  )

const getTool = (tools: ReturnType<typeof createGeointTools>, name: string) => {
  const tool = tools.find((t) => t.name === name)
  if (!tool) throw new Error(`Tool ${name} not found`)
  return tool
}

const encodeResult = (result: SearchResultItem) =>
  Schema.encodeSync(SearchResultItem)(result)

describe('GEOINT harness tools', () => {
  beforeEach(async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* GeointHarnessService
        yield* service.clear()
      }).pipe(Effect.provide(GeointHarnessServiceLive)),
    )
  })

  it('geoint_spawn + geoint_summary spawn and summarize entities', async () => {
    const service = await getService()
    const tools = createGeointTools(service)

    const spawnTool = getTool(tools, 'geoint_spawn')
    const summaryTool = getTool(tools, 'geoint_summary')

    const flight = new SearchResultFlight({
      id: 'sr-flight-1' as any,
      source: 'opensky',
      score: 0.91,
      retrievedAt: new Date('2026-01-01T10:00:00Z'),
      icao24: 'abc123' as any,
      callsign: 'VAL001',
      position: [-71.1, 42.3, 1200],
      velocity: 220,
      heading: 80,
      verticalRate: 1,
      onGround: false,
      category: 'medium',
      originCountry: 'US',
      lastContact: new Date('2026-01-01T09:59:50Z'),
    })

    const spawn = await spawnTool.execute('tc-1', { mode: 'one', result: encodeResult(flight) } as any, undefined, undefined, undefined as any)
    expect((spawn.details as any).spawnedCount).toBe(1)
    expect((spawn.details as any).entityIds[0]).toBe('flight:abc123')

    const summary = await summaryTool.execute('tc-2', { scope: 'all', includeViewport: true } as any, undefined, undefined, undefined as any)
    expect((summary.details as any).total).toBe(1)
    expect((summary.details as any).byType.flight).toBe(1)
    expect((summary.details as any).viewport).toBeDefined()
  })

  it('geoint_search filters by type and bounds', async () => {
    const service = await getService()
    const tools = createGeointTools(service)

    const spawnTool = getTool(tools, 'geoint_spawn')
    const searchTool = getTool(tools, 'geoint_search')

    const flight = new SearchResultFlight({
      id: 'sr-flight-2' as any,
      source: 'opensky',
      score: 0.93,
      retrievedAt: new Date('2026-01-01T10:00:00Z'),
      icao24: 'def456' as any,
      callsign: 'VAL002',
      position: [10, 20, 3000],
      velocity: 250,
      heading: 120,
      verticalRate: 0,
      onGround: false,
      category: 'heavy',
      originCountry: 'DE',
      lastContact: new Date('2026-01-01T09:59:50Z'),
    })

    const poi = new SearchResultPoi({
      id: 'sr-poi-2' as any,
      source: 'osm',
      score: 0.72,
      retrievedAt: new Date('2026-01-01T10:00:00Z'),
      poiId: 'poi-7' as any,
      position: [30, 40],
      name: 'Ops Cafe',
      category: 'amenity',
      tags: { amenity: 'cafe' },
    })

    await spawnTool.execute('tc-3', { mode: 'batch', results: [encodeResult(flight), encodeResult(poi)] } as any, undefined, undefined, undefined as any)

    const search = await searchTool.execute(
      'tc-4',
      {
        mode: 'type+bounds',
        entityType: 'flight',
        bounds: { west: 0, east: 20, south: 10, north: 30 },
      } as any,
      undefined,
      undefined,
      undefined as any,
    )

    expect((search.details as any).count).toBe(1)
    expect((search.details as any).entityIds).toEqual(['flight:def456'])

    const bySource = await searchTool.execute(
      'tc-4b',
      {
        mode: 'all',
        sources: ['opensky'],
      } as any,
      undefined,
      undefined,
      undefined as any,
    )

    expect((bySource.details as any).count).toBe(1)
    expect((bySource.details as any).entityIds).toEqual(['flight:def456'])
  })

  it('geoint_select focus updates selection and returns viewport', async () => {
    const service = await getService()
    const tools = createGeointTools(service)

    const spawnTool = getTool(tools, 'geoint_spawn')
    const selectTool = getTool(tools, 'geoint_select')

    const flight = new SearchResultFlight({
      id: 'sr-flight-3' as any,
      source: 'opensky',
      score: 0.9,
      retrievedAt: new Date('2026-01-01T10:00:00Z'),
      icao24: 'f0f0f0' as any,
      callsign: 'VAL003',
      position: [12.5, 47.9, 3200],
      velocity: 210,
      heading: 60,
      verticalRate: 0,
      onGround: false,
      category: 'medium',
      originCountry: 'AT',
      lastContact: new Date('2026-01-01T09:59:50Z'),
    })

    await spawnTool.execute('tc-5', { mode: 'one', result: encodeResult(flight) } as any, undefined, undefined, undefined as any)

    const focus = await selectTool.execute(
      'tc-6',
      { action: 'focus', entityId: 'flight:f0f0f0', zoom: 11 } as any,
      undefined,
      undefined,
      undefined as any,
    )

    expect((focus.details as any).selectedEntityId).toBe('flight:f0f0f0')
    expect((focus.details as any).viewport.zoom).toBe(11)
  })

  it('geoint_plan returns ranked source attempts and rejections', async () => {
    const service = await getService()
    const tools = createGeointTools(service)

    const planTool = getTool(tools, 'geoint_plan')

    const plan = await planTool.execute(
      'tc-7',
      {
        queryId: 'q-tools-plan-1',
        requestedSources: ['opensky', 'copernicus-stac'],
        strategy: 'coverage-first',
        constraints: { filterLanguage: 'cql2-json', maxSources: 2 },
      } as any,
      undefined,
      undefined,
      undefined as any,
    )

    expect((plan.details as any).planId).toContain('q-tools-plan-1')
    expect((plan.details as any).selectedCount).toBeGreaterThanOrEqual(1)
    expect(Array.isArray((plan.details as any).selected)).toBe(true)
    expect(Array.isArray((plan.details as any).rejected)).toBe(true)
  })
})
