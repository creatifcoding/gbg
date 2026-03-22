import { describe, expect, it } from 'vitest'
import {
  normalizeGeointSourceListToEcs,
  normalizeToCanonicalSource,
  toEcsIntelSource,
} from '../sourceResolver'

describe('source resolver', () => {
  it('normalizes legacy geoint aliases to canonical source', () => {
    expect(normalizeToCanonicalSource('adsb-lol')).toBe('adsb-lol')
    expect(normalizeToCanonicalSource('openmeteo')).toBe('openmeteo')
    expect(normalizeToCanonicalSource('copernicus')).toBe('copernicus-stac')
  })

  it('maps canonical and registry-extended sources to ECS intel source', () => {
    expect(toEcsIntelSource('opensky')).toBe('opensky')
    expect(toEcsIntelSource('adsb-lol')).toBe('adsb-lol')
    expect(toEcsIntelSource('track')).toBe('derived')
    expect(toEcsIntelSource('feature')).toBe('derived')
    expect(toEcsIntelSource('copernicus-stac')).toBe('sentinel')
    expect(toEcsIntelSource('gdacs')).toBe('unknown')
    expect(toEcsIntelSource('noaa')).toBe('noaa')
  })

  it('deduplicates normalized source lists', () => {
    const normalized = normalizeGeointSourceListToEcs([
      'track',
      'feature',
      'opensky',
      'adsb-lol',
      'openmeteo',
      'openmeteo',
    ])

    expect(normalized).toEqual(['derived', 'opensky', 'adsb-lol', 'openmeteo'])
  })

  it('falls back to unknown for unmapped input', () => {
    expect(normalizeToCanonicalSource('totally-random-source')).toBe('unknown')
    expect(toEcsIntelSource('totally-random-source')).toBe('unknown')
  })
})
