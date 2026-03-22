import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  normalizeFilterBundle,
  normalizeRegistryFilter,
  normalizeSourceFilters,
  normalizeStacQuery,
} from '../filter-normalizer'

describe('filter normalizer', () => {
  it('passes through valid cql2-json expressions', async () => {
    const result = await Effect.runPromise(
      normalizeRegistryFilter({
        _tag: 'RegistryFilter',
        lang: 'cql2-json',
        cql2: {
          op: '=',
          args: [{ property: 'platform' }, 'sentinel-2a'],
        },
      })
    )

    expect(result.language).toBe('cql2-json')
    expect(result.expression?.op).toBe('=')
    expect(result.diagnostics).toContain('Normalized from cql2-json')
  })

  it('parses cql2-text into cql2-json expression', async () => {
    const result = await Effect.runPromise(
      normalizeRegistryFilter({
        _tag: 'RegistryFilter',
        lang: 'cql2-text',
        raw: "cloud_cover < 20 AND platform = 'sentinel-2a'",
      })
    )

    expect(result.language).toBe('cql2-json')
    expect(result.expression?.op).toBe('and')
    expect(result.expression?.args).toHaveLength(2)
  })

  it('normalizes STAC query object operators', async () => {
    const result = await Effect.runPromise(
      normalizeStacQuery({
        'eo:cloud_cover': { lt: 15 },
        platform: { eq: 'sentinel-2b' },
        constellation: 'sentinel-2',
      })
    )

    expect(result.expression?.op).toBe('and')
    expect(result.language).toBe('cql2-json')
  })

  it('normalizes source-specific filters', async () => {
    const result = await Effect.runPromise(
      normalizeSourceFilters([
        {
          _tag: 'TrackFilter',
          objectType: 'vehicle',
          classification: 'unknown',
          minConfidence: 0.5,
          active: true,
        },
        {
          _tag: 'FlightFilter',
          icao24: ['a1b2c3'],
          minAltitude: 1000,
          maxAltitude: 9000,
          onGround: false,
        },
      ])
    )

    expect(result.expression?.op).toBe('and')
    expect(result.language).toBe('cql2-json')
  })

  it('combines registry + STAC + source filters into one expression', async () => {
    const result = await Effect.runPromise(
      normalizeFilterBundle({
        registryFilter: {
          _tag: 'RegistryFilter',
          lang: 'cql2-text',
          raw: 'speed > 20',
        },
        stacQuery: {
          platform: { eq: 'sentinel-2a' },
        },
        sourceFilters: [
          {
            _tag: 'FeatureFilter',
            featureIds: ['feat-1'],
          },
        ],
      })
    )

    expect(result.expression?.op).toBe('and')
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(3)
  })

  it('fails on unsupported CQL2 text clauses', async () => {
    await expect(
      Effect.runPromise(
        normalizeRegistryFilter({
          _tag: 'RegistryFilter',
          lang: 'cql2-text',
          raw: 'cloud_cover ~~ 20',
        })
      )
    ).rejects.toThrow('Unsupported CQL2 text clause')
  })
})
