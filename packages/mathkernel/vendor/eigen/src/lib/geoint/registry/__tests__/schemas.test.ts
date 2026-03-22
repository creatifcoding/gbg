import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  RegistryPageV1,
  RegistryQueryPlanV1,
  RegistrySearchQueryV1,
  SourceRegistryEntry,
} from '../schemas'

describe('geoint registry schemas', () => {
  it('decodes a valid RegistrySearchQueryV1', () => {
    const decode = Schema.decodeUnknownSync(RegistrySearchQueryV1)

    const query = decode({
      _tag: 'RegistrySearchQueryV1',
      version: 'geoint.registry.v1',
      queryId: 'q-1',
      text: 'ports in AOI',
      collections: [{ provider: 'stac', id: 'sentinel-2-l2a' }],
      bbox: [-74, 40, -73, 41],
      filter: {
        _tag: 'RegistryFilter',
        lang: 'cql2-json',
        cql2: { op: '=', args: [{ property: 'platform' }, 'sentinel-2a'] },
      },
      page: {
        _tag: 'PagingRequestV1',
        mode: 'token',
        limit: 100,
      },
    })

    expect(query.queryId).toBe('q-1')
    expect(query.collections[0].provider).toBe('stac')
    expect(query.page.mode).toBe('token')
  })

  it('rejects an invalid page limit', () => {
    const decode = Schema.decodeUnknownSync(RegistrySearchQueryV1)

    expect(() =>
      decode({
        _tag: 'RegistrySearchQueryV1',
        version: 'geoint.registry.v1',
        queryId: 'q-2',
        collections: [],
        page: {
          _tag: 'PagingRequestV1',
          mode: 'offset',
          limit: 1001,
        },
      })
    ).toThrowError()
  })

  it('decodes source entry and page envelope', () => {
    const decodeSource = Schema.decodeUnknownSync(SourceRegistryEntry)
    const decodePage = Schema.decodeUnknownSync(RegistryPageV1)

    const source = decodeSource({
      _tag: 'SourceRegistryEntry',
      version: 'geoint.registry.v1',
      sourceId: 'test-source',
      canonicalSource: 'unknown',
      displayName: 'Test source',
      endpoint: 'https://example.com',
      enabled: true,
      role: 'context',
      priority: 60,
      weight: 0.7,
      aliases: [],
      capabilities: {
        provider: 'native',
        supportsCollections: false,
        supportsIds: true,
        supportsBBox: true,
        supportsIntersects: false,
        supportsDatetime: true,
        supportsFilter: false,
        supportedFilterLangs: ['none'],
        supportsFilterCrs: false,
        pagingModes: ['offset'],
        supportsPostNextHints: false,
        defaultTtlSeconds: 300,
      },
      metadata: {},
    })

    const page = decodePage({
      _tag: 'RegistryPageV1',
      version: 'geoint.registry.v1',
      queryId: 'q-3',
      items: [],
      paging: {
        _tag: 'PagingStateV1',
        mode: 'offset',
        returned: 0,
        hasNext: false,
      },
      sourceCounts: {},
      errors: {},
      executionTimeMs: 8,
    })

    expect(String(source.sourceId)).toBe('test-source')
    expect(page.paging.hasNext).toBe(false)
  })

  it('decodes a valid RegistryQueryPlanV1', () => {
    const decode = Schema.decodeUnknownSync(RegistryQueryPlanV1)

    const plan = decode({
      _tag: 'RegistryQueryPlanV1',
      version: 'geoint.registry.v1',
      planId: 'plan-1',
      generatedAt: '2026-02-24T09:00:00Z',
      intent: {
        _tag: 'PlannerIntentV1',
        version: 'geoint.registry.v1',
        queryId: 'q-brief-1',
        requestedAt: '2026-02-24T08:59:58Z',
        text: 'air tracks near AOI',
        bbox: [-122.5, 37.7, -122.3, 37.9],
        requestedSources: ['opensky', 'adsb-lol', 'openmeteo'],
        constraints: {
          _tag: 'QueryConstraintV1',
          filterLanguage: 'none',
          maxSources: 3,
        },
      },
      decision: {
        _tag: 'PlanDecisionV1',
        strategy: 'latency-first',
        selected: [
          {
            _tag: 'SourceAttemptV1',
            sourceId: 'opensky',
            canonicalSource: 'opensky',
            role: 'trigger',
            provider: 'native',
            priority: 95,
            weight: 1,
            rank: 0,
            rationale: 'primary air source',
          },
        ],
        rejected: [
          {
            _tag: 'SourceRejectionV1',
            sourceId: 'nws-api',
            canonicalSource: 'noaa',
            reason: 'outside source intent for this query',
          },
        ],
      },
    })

    expect(plan.planId).toBe('plan-1')
    expect(plan.decision.selected[0]?.canonicalSource).toBe('opensky')
    expect(plan.decision.rejected[0]?.canonicalSource).toBe('noaa')
  })
})
