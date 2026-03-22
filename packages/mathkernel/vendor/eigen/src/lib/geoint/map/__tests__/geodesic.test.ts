/**
 * Geodesic Math Unit Tests
 *
 * Validates haversine distance, initial bearing, geodesic area,
 * cardinal conversion, and meters-per-pixel against known reference values.
 *
 * Accuracy requirement: <0.5% vs Vincenty/WGS84 reference.
 */

import { describe, it, expect } from 'vitest'
import {
  haversineDistance,
  initialBearing,
  geodesicArea,
  toCardinal,
  metersPerPixel,
  metersToKm,
  metersToNauticalMiles,
  sqMetersToSqKm,
  sqMetersToAcres,
  computeDistance,
  computeBearing,
  computeArea,
  calculateGeoBounds,
  boundsToViewport,
  type GeoCoordInput,
} from '../geodesic'

// =============================================================================
// Known City Pairs (reference distances from Vincenty/WGS84)
// =============================================================================

/** NYC JFK: 40.6413° N, 73.7781° W */
const NYC: GeoCoordInput = { longitude: -73.7781, latitude: 40.6413 }

/** LAX: 33.9416° N, 118.4085° W */
const LAX: GeoCoordInput = { longitude: -118.4085, latitude: 33.9416 }

/** London Heathrow: 51.4700° N, 0.4543° W */
const LHR: GeoCoordInput = { longitude: -0.4543, latitude: 51.47 }

/** Tokyo Narita: 35.7648° N, 140.3864° E */
const NRT: GeoCoordInput = { longitude: 140.3864, latitude: 35.7648 }

/** San Francisco: 37.7749° N, 122.4194° W */
const SFO: GeoCoordInput = { longitude: -122.4194, latitude: 37.7749 }

// =============================================================================
// Distance Tests
// =============================================================================

describe('haversineDistance', () => {
  it('NYC → LAX ≈ 3,983 km', () => {
    const d = haversineDistance(NYC, LAX)
    const km = d / 1000
    // Reference: 3,983 km (Vincenty)
    expect(km).toBeGreaterThan(3900)
    expect(km).toBeLessThan(4050)
  })

  it('London → Tokyo ≈ 9,571 km', () => {
    const d = haversineDistance(LHR, NRT)
    const km = d / 1000
    // Reference: ~9,571 km (Vincenty)
    expect(km).toBeGreaterThan(9450)
    expect(km).toBeLessThan(9700)
  })

  it('same point → 0', () => {
    const d = haversineDistance(NYC, NYC)
    expect(d).toBeCloseTo(0, 3)
  })

  it('antipodal points ≈ half circumference', () => {
    const a: GeoCoordInput = { longitude: 0, latitude: 0 }
    const b: GeoCoordInput = { longitude: 180, latitude: 0 }
    const d = haversineDistance(a, b)
    const km = d / 1000
    // Half circumference ≈ 20,037 km
    expect(km).toBeGreaterThan(19_900)
    expect(km).toBeLessThan(20_100)
  })

  it('north pole → south pole ≈ half circumference', () => {
    const north: GeoCoordInput = { longitude: 0, latitude: 90 }
    const south: GeoCoordInput = { longitude: 0, latitude: -90 }
    const d = haversineDistance(north, south)
    const km = d / 1000
    expect(km).toBeGreaterThan(19_900)
    expect(km).toBeLessThan(20_100)
  })

  it('<0.5% error vs Vincenty for NYC→LAX', () => {
    const d = haversineDistance(NYC, LAX)
    const km = d / 1000
    const vincentyRef = 3983 // km
    const error = Math.abs(km - vincentyRef) / vincentyRef
    expect(error).toBeLessThan(0.005)
  })
})

// =============================================================================
// Bearing Tests
// =============================================================================

describe('initialBearing', () => {
  it('due north → 0°', () => {
    const a: GeoCoordInput = { longitude: 0, latitude: 0 }
    const b: GeoCoordInput = { longitude: 0, latitude: 10 }
    const bearing = initialBearing(a, b)
    expect(bearing).toBeCloseTo(0, 0)
  })

  it('due east → 90°', () => {
    const a: GeoCoordInput = { longitude: 0, latitude: 0 }
    const b: GeoCoordInput = { longitude: 10, latitude: 0 }
    const bearing = initialBearing(a, b)
    expect(bearing).toBeCloseTo(90, 0)
  })

  it('due south → 180°', () => {
    const a: GeoCoordInput = { longitude: 0, latitude: 10 }
    const b: GeoCoordInput = { longitude: 0, latitude: 0 }
    const bearing = initialBearing(a, b)
    expect(bearing).toBeCloseTo(180, 0)
  })

  it('due west → 270°', () => {
    const a: GeoCoordInput = { longitude: 10, latitude: 0 }
    const b: GeoCoordInput = { longitude: 0, latitude: 0 }
    const bearing = initialBearing(a, b)
    expect(bearing).toBeCloseTo(270, 0)
  })

  it('NYC → LAX → roughly WSW (≈ 274°)', () => {
    const bearing = initialBearing(NYC, LAX)
    expect(bearing).toBeGreaterThan(260)
    expect(bearing).toBeLessThan(290)
  })

  it('always returns 0-360', () => {
    const bearing = initialBearing(LAX, NYC)
    expect(bearing).toBeGreaterThanOrEqual(0)
    expect(bearing).toBeLessThanOrEqual(360)
  })
})

// =============================================================================
// Cardinal Direction Tests
// =============================================================================

describe('toCardinal', () => {
  it.each([
    [0, 'N'],
    [45, 'NE'],
    [90, 'E'],
    [135, 'SE'],
    [180, 'S'],
    [225, 'SW'],
    [270, 'W'],
    [315, 'NW'],
    [359, 'N'],
    [360, 'N'],
  ] as const)('%i° → %s', (degrees, expected) => {
    expect(toCardinal(degrees)).toBe(expected)
  })

  it('normalizes negative degrees', () => {
    expect(toCardinal(-90)).toBe('W')
    expect(toCardinal(-180)).toBe('S')
  })

  it('normalizes large degrees', () => {
    expect(toCardinal(720)).toBe('N')
    expect(toCardinal(450)).toBe('E')
  })
})

// =============================================================================
// Geodesic Area Tests
// =============================================================================

describe('geodesicArea', () => {
  it('returns 0 for fewer than 3 points', () => {
    expect(geodesicArea([])).toBe(0)
    expect(geodesicArea([{ longitude: 0, latitude: 0 }])).toBe(0)
    expect(
      geodesicArea([
        { longitude: 0, latitude: 0 },
        { longitude: 1, latitude: 0 },
      ])
    ).toBe(0)
  })

  it('small equatorial square ≈ known area', () => {
    // 1° × 1° near equator ≈ 111 km × 111 km ≈ 12,321 km²
    const ring: GeoCoordInput[] = [
      { longitude: 0, latitude: 0 },
      { longitude: 1, latitude: 0 },
      { longitude: 1, latitude: 1 },
      { longitude: 0, latitude: 1 },
    ]
    const area = geodesicArea(ring)
    const areaKm2 = area / 1_000_000
    // Should be around 12,300 km² (± reasonable tolerance)
    expect(areaKm2).toBeGreaterThan(11_000)
    expect(areaKm2).toBeLessThan(13_500)
  })

  it('larger polygon has more area', () => {
    const small: GeoCoordInput[] = [
      { longitude: 0, latitude: 0 },
      { longitude: 0.1, latitude: 0 },
      { longitude: 0.1, latitude: 0.1 },
      { longitude: 0, latitude: 0.1 },
    ]
    const big: GeoCoordInput[] = [
      { longitude: 0, latitude: 0 },
      { longitude: 1, latitude: 0 },
      { longitude: 1, latitude: 1 },
      { longitude: 0, latitude: 1 },
    ]
    expect(geodesicArea(big)).toBeGreaterThan(geodesicArea(small))
  })
})

// =============================================================================
// Unit Conversion Tests
// =============================================================================

describe('unit conversions', () => {
  it('metersToKm', () => {
    expect(metersToKm(1000)).toBe(1)
    expect(metersToKm(1_852)).toBeCloseTo(1.852)
  })

  it('metersToNauticalMiles', () => {
    expect(metersToNauticalMiles(1852)).toBeCloseTo(1)
    expect(metersToNauticalMiles(3704)).toBeCloseTo(2)
  })

  it('sqMetersToSqKm', () => {
    expect(sqMetersToSqKm(1_000_000)).toBe(1)
  })

  it('sqMetersToAcres', () => {
    // 1 acre ≈ 4046.86 m²
    expect(sqMetersToAcres(4046.8564224)).toBeCloseTo(1)
  })
})

// =============================================================================
// Meters Per Pixel Tests
// =============================================================================

describe('metersPerPixel', () => {
  it('zoom 0 at equator ≈ 156 km/px', () => {
    const mpp = metersPerPixel(0, 0)
    expect(mpp / 1000).toBeGreaterThan(140)
    expect(mpp / 1000).toBeLessThan(170)
  })

  it('higher zoom → smaller meters per pixel', () => {
    const z10 = metersPerPixel(0, 10)
    const z15 = metersPerPixel(0, 15)
    expect(z15).toBeLessThan(z10)
  })

  it('higher latitude → smaller meters per pixel', () => {
    const equator = metersPerPixel(0, 10)
    const arctic = metersPerPixel(70, 10)
    expect(arctic).toBeLessThan(equator)
  })
})

// =============================================================================
// Composite Result Tests
// =============================================================================

describe('computeDistance', () => {
  it('returns DistanceResult with all units', () => {
    const result = computeDistance(NYC, LAX)
    expect(result.meters).toBeGreaterThan(0)
    expect(result.kilometers).toBeCloseTo(result.meters / 1000)
    expect(result.nauticalMiles).toBeCloseTo(result.meters / 1852)
  })
})

describe('computeBearing', () => {
  it('returns BearingResult with degrees + cardinal', () => {
    const result = computeBearing(NYC, LAX)
    expect(result.degrees).toBeGreaterThanOrEqual(0)
    expect(result.degrees).toBeLessThanOrEqual(360)
    expect(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']).toContain(
      result.cardinal
    )
  })
})

describe('computeArea', () => {
  it('returns AreaResult with all units', () => {
    const ring: GeoCoordInput[] = [
      { longitude: 0, latitude: 0 },
      { longitude: 1, latitude: 0 },
      { longitude: 1, latitude: 1 },
      { longitude: 0, latitude: 1 },
    ]
    const result = computeArea(ring)
    expect(result.squareMeters).toBeGreaterThan(0)
    expect(result.squareKilometers).toBeCloseTo(result.squareMeters / 1_000_000)
    expect(result.acres).toBeCloseTo(result.squareMeters / 4046.8564224)
  })
})

// =============================================================================
// Bounds Utilities
// =============================================================================

describe('calculateGeoBounds', () => {
  it('returns null for empty array', () => {
    expect(calculateGeoBounds([])).toBeNull()
  })

  it('calculates correct bounds', () => {
    const coords: GeoCoordInput[] = [
      { longitude: -74, latitude: 40 },
      { longitude: -118, latitude: 34 },
      { longitude: -122, latitude: 37 },
    ]
    const bounds = calculateGeoBounds(coords)!
    expect(bounds.minLon).toBe(-122)
    expect(bounds.maxLon).toBe(-74)
    expect(bounds.minLat).toBe(34)
    expect(bounds.maxLat).toBe(40)
  })

  it('single point → degenerate bounds', () => {
    const bounds = calculateGeoBounds([{ longitude: 10, latitude: 20 }])!
    expect(bounds.minLon).toBe(10)
    expect(bounds.maxLon).toBe(10)
    expect(bounds.minLat).toBe(20)
    expect(bounds.maxLat).toBe(20)
  })
})

describe('boundsToViewport', () => {
  it('calculates center correctly', () => {
    const vp = boundsToViewport({
      minLon: -80,
      maxLon: -70,
      minLat: 35,
      maxLat: 45,
    })
    expect(vp.longitude).toBeCloseTo(-75)
    expect(vp.latitude).toBeCloseTo(40)
  })

  it('smaller bounds → higher zoom', () => {
    const big = boundsToViewport({
      minLon: -120,
      maxLon: -70,
      minLat: 25,
      maxLat: 50,
    })
    const small = boundsToViewport({
      minLon: -75,
      maxLon: -73,
      minLat: 40,
      maxLat: 41,
    })
    expect(small.zoom).toBeGreaterThan(big.zoom)
  })

  it('degenerate bounds → max zoom', () => {
    const vp = boundsToViewport({
      minLon: 10,
      maxLon: 10,
      minLat: 20,
      maxLat: 20,
    })
    expect(vp.zoom).toBe(22)
  })
})
