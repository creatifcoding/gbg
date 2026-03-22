/**
 * GEOINT Imagery Traits
 *
 * Trait definitions for satellite imagery entities from Planet Labs, Sentinel Hub.
 *
 * @module
 */

import { Schema } from 'effect'
import { defineTrait, registerTrait, type TraitId } from '../../../kori/schemas/trait'

// ─────────────────────────────────────────────────────────────────────────────
// Imagery Data Trait
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ImageryData trait - core satellite imagery metadata.
 *
 * Combined with GeoPosition (centroid) for location.
 */
export const ImageryData = defineTrait('ImageryData', {
  /** Item ID from provider */
  itemId: Schema.String,
  /** Provider name */
  provider: Schema.Literal('planet', 'sentinel'),
  /** Collection/item type */
  collection: Schema.String,
  /** Acquisition timestamp */
  acquired: Schema.DateFromSelf,
  /** Display label */
  label: Schema.optionalWith(Schema.String, { default: () => '' }),
})
export type ImageryData = typeof ImageryData.Type

/**
 * ImageryQuality trait - image quality metrics.
 */
export const ImageryQuality = defineTrait('ImageryQuality', {
  /** Cloud cover percentage (0-100) */
  cloudCover: Schema.optional(Schema.Number),
  /** Ground sample distance in meters */
  gsd: Schema.optional(Schema.Number),
  /** Quality category */
  qualityCategory: Schema.optional(Schema.String),
  /** Data coverage percentage */
  dataCoverage: Schema.optional(Schema.Number),
})
export type ImageryQuality = typeof ImageryQuality.Type

/**
 * ImageryGeometry trait - viewing geometry.
 */
export const ImageryGeometry = defineTrait('ImageryGeometry', {
  /** Sun azimuth angle */
  sunAzimuth: Schema.optional(Schema.Number),
  /** Sun elevation angle */
  sunElevation: Schema.optional(Schema.Number),
  /** Off-nadir viewing angle */
  offNadir: Schema.optional(Schema.Number),
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  bbox: Schema.optional(Schema.Array(Schema.Number)),
})
export type ImageryGeometry = typeof ImageryGeometry.Type

/**
 * ImageryAssets trait - asset URLs.
 */
export const ImageryAssets = defineTrait('ImageryAssets', {
  /** Thumbnail URL */
  thumbnailUrl: Schema.optional(Schema.String),
  /** Assets download URL */
  assetsUrl: Schema.optional(Schema.String),
})
export type ImageryAssets = typeof ImageryAssets.Type

/**
 * ImagerySatellite trait - satellite info.
 */
export const ImagerySatellite = defineTrait('ImagerySatellite', {
  /** Satellite ID */
  satelliteId: Schema.optional(Schema.String),
  /** Platform name */
  platform: Schema.optional(Schema.String),
  /** Constellation */
  constellation: Schema.optional(Schema.String),
  /** Instruments used */
  instruments: Schema.optional(Schema.Array(Schema.String)),
})
export type ImagerySatellite = typeof ImagerySatellite.Type

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

registerTrait('ImageryData' as TraitId, ImageryData, {
  uniqueness: {
    unique: true,
    uniqueKey: (data) => {
      const d = data as { itemId: string; provider: string }
      return `${d.provider}:${d.itemId}`
    },
  },
})
registerTrait('ImageryQuality' as TraitId, ImageryQuality)
registerTrait('ImageryGeometry' as TraitId, ImageryGeometry)
registerTrait('ImageryAssets' as TraitId, ImageryAssets)
registerTrait('ImagerySatellite' as TraitId, ImagerySatellite)
