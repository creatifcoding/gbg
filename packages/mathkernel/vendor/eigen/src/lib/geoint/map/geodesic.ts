/**
 * Geodesic Math — Pure Functions for Geographic Computation
 *
 * Zero-dependency module for distance, bearing, area calculations
 * on the WGS84 ellipsoid. All functions accept GeoCoord schema type.
 *
 * Reference: Aviation Formulary by Ed Williams
 * @see http://www.edwilliams.org/avform147.htm
 *
 * @module geoint/map/geodesic
 */

import type { DistanceResult, BearingResult, AreaResult, Cardinal } from './schemas'

/**
 * Geographic coordinate input for geodesic functions.
 * Accepts anything with longitude/latitude (altitude optional).
 */
export interface GeoCoordInput {
  readonly longitude: number
  readonly latitude: number
  readonly altitude?: number | undefined
}

// =============================================================================
// WGS84 Constants
// =============================================================================

/** Earth mean radius in meters (WGS84) */
const EARTH_RADIUS_M = 6_371_008.8

/** Meters per nautical mile */
const METERS_PER_NM = 1_852

/** Square meters per acre */
const SQ_METERS_PER_ACRE = 4_046.8564224

/** Degrees to radians multiplier */
const DEG2RAD = Math.PI / 180

/** Radians to degrees multiplier */
const RAD2DEG = 180 / Math.PI

// =============================================================================
// Core Geodesic Functions
// =============================================================================

/**
 * Haversine distance between two geographic coordinates.
 *
 * Accuracy: ~0.3% vs Vincenty for most practical distances.
 * Sufficient for GEOINT operational use (not survey-grade).
 *
 * @param a - Origin coordinate
 * @param b - Destination coordinate
 * @returns Distance in meters
 */
export function haversineDistance(a: GeoCoordInput, b: GeoCoordInput): number {
  const lat1 = a.latitude * DEG2RAD
  const lat2 = b.latitude * DEG2RAD
  const dLat = (b.latitude - a.latitude) * DEG2RAD
  const dLon = (b.longitude - a.longitude) * DEG2RAD

  const sinHalfLat = Math.sin(dLat / 2)
  const sinHalfLon = Math.sin(dLon / 2)

  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfLon * sinHalfLon

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/**
 * Initial (forward) bearing from point a to point b.
 *
 * @param a - Origin coordinate
 * @param b - Destination coordinate
 * @returns Bearing in degrees (0-360, 0 = true north, clockwise)
 */
export function initialBearing(a: GeoCoordInput, b: GeoCoordInput): number {
  const lat1 = a.latitude * DEG2RAD
  const lat2 = b.latitude * DEG2RAD
  const dLon = (b.longitude - a.longitude) * DEG2RAD

  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)

  const bearing = Math.atan2(y, x) * RAD2DEG

  // Normalize to 0-360
  return ((bearing % 360) + 360) % 360
}

/**
 * Geodesic area of a polygon ring on the sphere.
 *
 * Uses the spherical excess formula (Girard's theorem).
 * Ring must be closed (first point != last point, closure is automatic).
 *
 * @param ring - Array of coordinates forming the polygon boundary (CCW = positive area)
 * @returns Area in square meters (absolute value)
 */
export function geodesicArea(ring: readonly GeoCoordInput[]): number {
  if (ring.length < 3) return 0

  // Spherical excess method
  let sum = 0
  const n = ring.length

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const lon1 = ring[i].longitude * DEG2RAD
    const lat1 = ring[i].latitude * DEG2RAD
    const lon2 = ring[j].longitude * DEG2RAD
    const lat2 = ring[j].latitude * DEG2RAD

    // Shoelmaker on the sphere
    sum += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2))
  }

  // Area in steradians, convert to square meters
  const areaRad = Math.abs(sum / 2)
  return areaRad * EARTH_RADIUS_M * EARTH_RADIUS_M
}

// =============================================================================
// Unit Conversions
// =============================================================================

/**
 * Convert meters to kilometers.
 */
export function metersToKm(meters: number): number {
  return meters / 1_000
}

/**
 * Convert meters to nautical miles.
 */
export function metersToNauticalMiles(meters: number): number {
  return meters / METERS_PER_NM
}

/**
 * Convert square meters to square kilometers.
 */
export function sqMetersToSqKm(sqMeters: number): number {
  return sqMeters / 1_000_000
}

/**
 * Convert square meters to acres.
 */
export function sqMetersToAcres(sqMeters: number): number {
  return sqMeters / SQ_METERS_PER_ACRE
}

// =============================================================================
// Cardinal Direction
// =============================================================================

/** Cardinal direction thresholds (center of each 45° sector) */
const CARDINAL_SECTORS: readonly [number, Cardinal][] = [
  [22.5, 'N'],
  [67.5, 'NE'],
  [112.5, 'E'],
  [157.5, 'SE'],
  [202.5, 'S'],
  [247.5, 'SW'],
  [292.5, 'W'],
  [337.5, 'NW'],
  [360, 'N'],
]

/**
 * Convert bearing degrees to cardinal direction.
 *
 * @param degrees - Bearing in degrees (0-360)
 * @returns Cardinal direction ('N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW')
 */
export function toCardinal(degrees: number): Cardinal {
  const normalized = ((degrees % 360) + 360) % 360
  for (const [threshold, cardinal] of CARDINAL_SECTORS) {
    if (normalized < threshold) return cardinal
  }
  return 'N'
}

// =============================================================================
// Meters Per Pixel
// =============================================================================

/**
 * Calculate meters per pixel at a given latitude and zoom level.
 *
 * Uses the Web Mercator formula.
 *
 * @param latitude - Latitude in degrees
 * @param zoom - Map zoom level (0-22)
 * @returns Meters per pixel at the given latitude/zoom
 */
export function metersPerPixel(latitude: number, zoom: number): number {
  const C = 40_075_016.686 // Earth circumference in meters
  const latRad = latitude * DEG2RAD
  return (C * Math.cos(latRad)) / Math.pow(2, zoom + 8)
}

// =============================================================================
// Composite Results (Schema-typed)
// =============================================================================

/**
 * Compute full distance result with all unit conversions.
 *
 * @param a - Origin coordinate
 * @param b - Destination coordinate
 * @returns DistanceResult with meters, kilometers, and nautical miles
 */
export function computeDistance(a: GeoCoordInput, b: GeoCoordInput): DistanceResult {
  const meters = haversineDistance(a, b)
  return {
    meters,
    kilometers: metersToKm(meters),
    nauticalMiles: metersToNauticalMiles(meters),
  }
}

/**
 * Compute full bearing result with cardinal direction.
 *
 * @param a - Origin coordinate
 * @param b - Destination coordinate
 * @returns BearingResult with degrees and cardinal direction
 */
export function computeBearing(a: GeoCoordInput, b: GeoCoordInput): BearingResult {
  const degrees = initialBearing(a, b)
  return {
    degrees,
    cardinal: toCardinal(degrees),
  }
}

/**
 * Compute full area result with all unit conversions.
 *
 * @param ring - Polygon boundary coordinates
 * @returns AreaResult with square meters, square kilometers, and acres
 */
export function computeArea(ring: readonly GeoCoordInput[]): AreaResult {
  const squareMeters = geodesicArea(ring)
  return {
    squareMeters,
    squareKilometers: sqMetersToSqKm(squareMeters),
    acres: sqMetersToAcres(squareMeters),
  }
}

// =============================================================================
// Bounds Utilities
// =============================================================================

/**
 * Calculate bounding box from array of coordinates.
 *
 * @param coords - Array of geographic coordinates
 * @returns GeoBounds or null if empty
 */
export function calculateGeoBounds(
  coords: readonly GeoCoordInput[]
): { minLon: number; minLat: number; maxLon: number; maxLat: number } | null {
  if (coords.length === 0) return null

  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity

  for (const c of coords) {
    if (c.longitude < minLon) minLon = c.longitude
    if (c.longitude > maxLon) maxLon = c.longitude
    if (c.latitude < minLat) minLat = c.latitude
    if (c.latitude > maxLat) maxLat = c.latitude
  }

  return { minLon, minLat, maxLon, maxLat }
}

/**
 * Convert bounding box to viewport center + zoom.
 *
 * @param bounds - Geographic bounding box
 * @param padding - Zoom padding factor (default 1 = one zoom level buffer)
 * @returns Partial viewport with longitude, latitude, zoom
 */
export function boundsToViewport(
  bounds: { minLon: number; minLat: number; maxLon: number; maxLat: number },
  padding: number = 1
): { longitude: number; latitude: number; zoom: number } {
  const longitude = (bounds.minLon + bounds.maxLon) / 2
  const latitude = (bounds.minLat + bounds.maxLat) / 2

  const lonExtent = bounds.maxLon - bounds.minLon
  const latExtent = bounds.maxLat - bounds.minLat
  const maxExtent = Math.max(lonExtent, latExtent)

  // Logarithmic zoom from extent
  const zoom =
    maxExtent <= 0
      ? 22
      : Math.max(0, Math.min(20, Math.log2(360 / maxExtent) - padding))

  return { longitude, latitude, zoom }
}
