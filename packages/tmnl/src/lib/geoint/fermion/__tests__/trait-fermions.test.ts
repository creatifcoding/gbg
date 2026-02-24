/**
 * Trait Fermions Integration Tests
 *
 * Validates:
 * - Fermion creates per entityId
 * - Store set/get populates data
 * - Multiple traits for same entity are independent
 * - despawnEntityTraits clears all
 * - traitRegistry lookup works
 * - getEntityTraitNames returns correct set
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  geoPositionFermion,
  geoPosition3DFermion,
  flightDataFermion,
  trackDataFermion,
  uiStateFermion,
  animationStateFermion,
  sourceConfidenceFermion,
  poiDataFermion,
  weatherDataFermion,
  imageryDataFermion,
  traitRegistry,
  despawnEntityTraits,
  clearAllTraitStores,
  getEntityTraitNames,
  TraitNotFoundError,
} from '../trait-fermions'

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearAllTraitStores()
})

// ─────────────────────────────────────────────────────────────────────────────
// Store Operations
// ─────────────────────────────────────────────────────────────────────────────

describe('TraitStore operations', () => {
  it('set + peek returns trait data for entity', () => {
    geoPositionFermion.set('flight:abc123', {
      _tag: 'GeoPosition',
      lon: -122.4,
      lat: 37.7,
    })

    const data = geoPositionFermion.peek('flight:abc123')
    expect(data).toEqual({
      _tag: 'GeoPosition',
      lon: -122.4,
      lat: 37.7,
    })
  })

  it('has returns true for populated entity', () => {
    expect(geoPositionFermion.has('flight:abc123')).toBe(false)
    geoPositionFermion.set('flight:abc123', {
      _tag: 'GeoPosition',
      lon: 0,
      lat: 0,
    })
    expect(geoPositionFermion.has('flight:abc123')).toBe(true)
  })

  it('remove deletes trait data for entity', () => {
    geoPositionFermion.set('flight:abc123', {
      _tag: 'GeoPosition',
      lon: 0,
      lat: 0,
    })
    expect(geoPositionFermion.has('flight:abc123')).toBe(true)

    geoPositionFermion.remove('flight:abc123')
    expect(geoPositionFermion.has('flight:abc123')).toBe(false)
  })

  it('clear removes all entries', () => {
    geoPositionFermion.set('e1', { _tag: 'GeoPosition', lon: 0, lat: 0 })
    geoPositionFermion.set('e2', { _tag: 'GeoPosition', lon: 1, lat: 1 })
    geoPositionFermion.clear()
    expect(geoPositionFermion.has('e1')).toBe(false)
    expect(geoPositionFermion.has('e2')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Independent Traits per Entity
// ─────────────────────────────────────────────────────────────────────────────

describe('Independent traits per entity', () => {
  it('same entity can have multiple independent traits', () => {
    const entityId = 'flight:test-001'

    geoPositionFermion.set(entityId, {
      _tag: 'GeoPosition',
      lon: -122.4,
      lat: 37.7,
    })

    flightDataFermion.set(entityId, {
      _tag: 'FlightData',
      icao24: 'abc123',
      callsign: 'UAL1234',
      category: 'heavy',
      originCountry: 'United States',
      onGround: false,
      lastContact: new Date(),
      source: 'opensky',
    } as any)

    uiStateFermion.set(entityId, {
      _tag: 'UIState',
      selected: true,
      hovered: false,
      expanded: false,
      highlighted: false,
      pinned: false,
      viewed: false,
    })

    // All three traits independently populated
    expect(geoPositionFermion.has(entityId)).toBe(true)
    expect(flightDataFermion.has(entityId)).toBe(true)
    expect(uiStateFermion.has(entityId)).toBe(true)

    // Track fermion NOT set for this entity
    expect(trackDataFermion.has(entityId)).toBe(false)
  })

  it('removing one trait does not affect others', () => {
    const entityId = 'flight:test-002'

    geoPositionFermion.set(entityId, { _tag: 'GeoPosition', lon: 0, lat: 0 })
    uiStateFermion.set(entityId, {
      _tag: 'UIState',
      selected: false,
      hovered: false,
      expanded: false,
      highlighted: false,
      pinned: false,
      viewed: false,
    })

    geoPositionFermion.remove(entityId)

    expect(geoPositionFermion.has(entityId)).toBe(false)
    expect(uiStateFermion.has(entityId)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Despawn (bulk removal)
// ─────────────────────────────────────────────────────────────────────────────

describe('despawnEntityTraits', () => {
  it('removes all traits for an entity across all fermions', () => {
    const entityId = 'track:target-alpha'

    geoPositionFermion.set(entityId, { _tag: 'GeoPosition', lon: 10, lat: 20 })
    geoPosition3DFermion.set(entityId, { _tag: 'GeoPosition3D', lon: 10, lat: 20, altitudeM: 5000 })
    trackDataFermion.set(entityId, {
      _tag: 'TrackData',
      trackId: 'target-alpha',
      classification: 'unclassified',
      objectType: 'unknown',
      confidence: 0.8,
    } as any)
    uiStateFermion.set(entityId, {
      _tag: 'UIState',
      selected: true,
      hovered: false,
      expanded: false,
      highlighted: false,
      pinned: true,
      viewed: true,
    })

    // Verify all populated
    expect(getEntityTraitNames(entityId)).toEqual(
      expect.arrayContaining(['GeoPosition', 'GeoPosition3D', 'TrackData', 'UIState']),
    )

    // Despawn
    despawnEntityTraits(entityId)

    // All gone
    expect(geoPositionFermion.has(entityId)).toBe(false)
    expect(geoPosition3DFermion.has(entityId)).toBe(false)
    expect(trackDataFermion.has(entityId)).toBe(false)
    expect(uiStateFermion.has(entityId)).toBe(false)
    expect(getEntityTraitNames(entityId)).toEqual([])
  })

  it('does not affect other entities', () => {
    geoPositionFermion.set('e1', { _tag: 'GeoPosition', lon: 0, lat: 0 })
    geoPositionFermion.set('e2', { _tag: 'GeoPosition', lon: 1, lat: 1 })

    despawnEntityTraits('e1')

    expect(geoPositionFermion.has('e1')).toBe(false)
    expect(geoPositionFermion.has('e2')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Trait Registry
// ─────────────────────────────────────────────────────────────────────────────

describe('traitRegistry', () => {
  it('contains all 33 trait fermions', () => {
    expect(traitRegistry.size).toBe(33)
  })

  it('can look up fermion by trait name', () => {
    const fermion = traitRegistry.get('FlightData')
    expect(fermion).toBeDefined()
    expect(fermion).toBe(flightDataFermion)
  })

  it('returns undefined for unknown trait name', () => {
    expect(traitRegistry.get('NonExistentTrait')).toBeUndefined()
  })

  const expectedTraitNames = [
    'GeoPosition', 'GeoPosition3D', 'Heading', 'GeoVelocity',
    'FlightData', 'FlightRegistration', 'FlightRoute',
    'TrackData', 'TrackHistory', 'TrackSource',
    'UIState', 'UIFocus', 'UIEditState',
    'AnimationState', 'AnimationTarget', 'AnimationEasing',
    'SourceConfidence', 'SourceTiming', 'SourceQuality',
    'PoiData', 'PoiTags', 'PoiContact', 'PoiAddress',
    'WeatherData', 'WeatherWind', 'WeatherPrecipitation', 'WeatherAtmospheric', 'WeatherForecastMeta',
    'ImageryData', 'ImageryQuality', 'ImageryGeometry', 'ImageryAssets', 'ImagerySatellite',
  ]

  it('contains all expected trait names', () => {
    for (const name of expectedTraitNames) {
      expect(traitRegistry.has(name)).toBe(true)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getEntityTraitNames
// ─────────────────────────────────────────────────────────────────────────────

describe('getEntityTraitNames', () => {
  it('returns empty array for unknown entity', () => {
    expect(getEntityTraitNames('nonexistent')).toEqual([])
  })

  it('returns correct trait names for populated entity', () => {
    const entityId = 'poi:test-poi-1'

    poiDataFermion.set(entityId, {
      _tag: 'PoiData',
      poiId: 'test-poi-1',
      name: 'Test POI',
      category: 'building',
      source: 'osm',
    } as any)

    geoPositionFermion.set(entityId, {
      _tag: 'GeoPosition',
      lon: -122.4,
      lat: 37.7,
    })

    uiStateFermion.set(entityId, {
      _tag: 'UIState',
      selected: false,
      hovered: false,
      expanded: false,
      highlighted: false,
      pinned: false,
      viewed: false,
    })

    const names = getEntityTraitNames(entityId)
    expect(names).toHaveLength(3)
    expect(names).toContain('GeoPosition')
    expect(names).toContain('PoiData')
    expect(names).toContain('UIState')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// clearAllTraitStores
// ─────────────────────────────────────────────────────────────────────────────

describe('clearAllTraitStores', () => {
  it('clears every fermion store', () => {
    geoPositionFermion.set('e1', { _tag: 'GeoPosition', lon: 0, lat: 0 })
    flightDataFermion.set('e2', {
      _tag: 'FlightData',
      icao24: 'xyz',
      callsign: 'TEST',
      category: 'light',
      originCountry: 'US',
      onGround: false,
      lastContact: new Date(),
      source: 'opensky',
    } as any)
    uiStateFermion.set('e3', {
      _tag: 'UIState',
      selected: false,
      hovered: false,
      expanded: false,
      highlighted: false,
      pinned: false,
      viewed: false,
    })

    clearAllTraitStores()

    expect(geoPositionFermion.has('e1')).toBe(false)
    expect(flightDataFermion.has('e2')).toBe(false)
    expect(uiStateFermion.has('e3')).toBe(false)
  })
})
