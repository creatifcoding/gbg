/**
 * GEOINT Position Traits
 *
 * Geographic position traits for GEOINT entities.
 * Extends base Kori Position2D/Position3D with geo-specific variants.
 *
 * @module
 */

import { Schema } from 'effect'
import { defineTrait, registerTrait, type TraitId } from '../../../kori/schemas/trait'

// ─────────────────────────────────────────────────────────────────────────────
// Geographic Position Traits
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Geographic position trait (WGS84).
 * Uses [lon, lat] convention matching GeoJSON.
 */
export const GeoPosition = defineTrait('GeoPosition', {
  /** Longitude in degrees (-180 to 180) */
  lon: Schema.Number.pipe(Schema.between(-180, 180)),
  /** Latitude in degrees (-90 to 90) */
  lat: Schema.Number.pipe(Schema.between(-90, 90)),
})
export type GeoPosition = typeof GeoPosition.Type

/**
 * Geographic position with altitude (WGS84 + meters).
 */
export const GeoPosition3D = defineTrait('GeoPosition3D', {
  /** Longitude in degrees */
  lon: Schema.Number.pipe(Schema.between(-180, 180)),
  /** Latitude in degrees */
  lat: Schema.Number.pipe(Schema.between(-90, 90)),
  /** Altitude in meters (can be negative for below sea level) */
  altitudeM: Schema.Number,
})
export type GeoPosition3D = typeof GeoPosition3D.Type

/**
 * Heading/bearing trait for moving entities.
 */
export const Heading = defineTrait('Heading', {
  /** Heading in degrees (0-360, 0 = North) */
  headingDeg: Schema.Number.pipe(Schema.between(0, 360)),
  /** Ground speed in meters per second */
  speedMps: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
})
export type Heading = typeof Heading.Type

/**
 * Velocity trait for 3D movement.
 */
export const GeoVelocity = defineTrait('GeoVelocity', {
  /** Ground speed in m/s */
  groundSpeedMps: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  /** Heading in degrees */
  headingDeg: Schema.Number.pipe(Schema.between(0, 360)),
  /** Vertical rate in m/s (positive = climbing) */
  verticalRateMps: Schema.Number,
})
export type GeoVelocity = typeof GeoVelocity.Type

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

registerTrait('GeoPosition' as TraitId, GeoPosition)
registerTrait('GeoPosition3D' as TraitId, GeoPosition3D)
registerTrait('Heading' as TraitId, Heading)
registerTrait('GeoVelocity' as TraitId, GeoVelocity)
