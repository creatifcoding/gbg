import { describe, expect, it } from 'vitest'
import {
  getSourceById,
  isSourceEnabledForRole,
  listSourceRegistry,
  resolveCanonicalSource,
  resolveSourceEntry,
  toCanonicalSourceSet,
} from '../sourceRegistry'

describe('source registry', () => {
  it('lists seeded source registry entries', () => {
    const entries = listSourceRegistry()

    expect(entries.length).toBeGreaterThanOrEqual(6)
    expect(entries.some((entry) => String(entry.sourceId) === 'opensky')).toBe(true)
    expect(entries.some((entry) => String(entry.sourceId) === 'copernicus-stac')).toBe(true)
  })

  it('resolves legacy aliases to canonical source IDs', () => {
    expect(resolveCanonicalSource('adsb-lol')).toBe('adsb-lol')
    expect(resolveCanonicalSource('openmeteo')).toBe('openmeteo')
  })

  it('resolves source entry by alias', () => {
    const entry = resolveSourceEntry('adsb-lol')

    expect(entry).toBeDefined()
    expect(entry?.canonicalSource).toBe('adsb-lol')
  })

  it('captures STAC semantics for STAC-backed sources', () => {
    const stac = resolveSourceEntry('copernicus')

    expect(stac?.capabilities.provider).toBe('stac')
    expect(stac?.capabilities.stac?.objectTypes).toEqual(['Item', 'Catalog', 'Collection'])
    expect(stac?.capabilities.stac?.supportsSearchEndpoint).toBe(true)
  })

  it('builds canonical source sets from mixed source IDs', () => {
    const set = toCanonicalSourceSet(['opensky', 'adsb-lol', 'openmeteo', 'unknown-source'])

    expect(set.has('opensky')).toBe(true)
    expect(set.has('adsb-lol')).toBe(true)
    expect(set.has('openmeteo')).toBe(true)
    expect(set.size).toBe(3)
  })

  it('applies role enablement policy', () => {
    expect(isSourceEnabledForRole('opensky', 'trigger')).toBe(true)
    expect(isSourceEnabledForRole('copernicus-stac', 'trigger')).toBe(false)
    expect(isSourceEnabledForRole('copernicus-stac', 'archive')).toBe(true)
  })

  it('returns undefined for unknown source lookups', () => {
    expect(getSourceById('nope')).toBeUndefined()
    expect(resolveCanonicalSource('nope')).toBeUndefined()
    expect(resolveSourceEntry('nope')).toBeUndefined()
  })
})
