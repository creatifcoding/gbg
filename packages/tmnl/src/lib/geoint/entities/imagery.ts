/**
 * Imagery Entity - Satellite/Aerial Imagery Metadata
 *
 * Represents satellite or aerial imagery metadata.
 * Composes: Spatial, Temporal traits
 *
 * @module geoint/entities/imagery
 */

import { Schema } from 'effect'
import { EntityId, EntityProvenance } from '@/lib/ecs'
import { SpatialTrait, TemporalTrait } from '../schemas/traits'

// =============================================================================
// Imagery-Specific Schemas
// =============================================================================

/**
 * Well-known imagery providers.
 */
export const ImageryProvider = Schema.Literal(
  'planet',    // Planet Labs
  'sentinel',  // ESA Sentinel
  'maxar',     // Maxar (WorldView, GeoEye)
  'landsat',   // USGS Landsat
  'aster',     // NASA ASTER
  'airbus',    // Airbus (Pleiades, SPOT)
  'capella',   // Capella Space (SAR)
  'iceye',     // ICEYE (SAR)
  'other'      // Other provider
).pipe(
  Schema.annotations({
    identifier: 'ImageryProvider',
    title: 'Imagery Provider',
    description: 'Satellite/aerial imagery data provider.',
  })
)
export type ImageryProvider = typeof ImageryProvider.Type

/**
 * Imagery processing level.
 */
export const ProcessingLevel = Schema.Literal(
  'raw',       // Raw sensor data
  'l1a',       // Level 1A - radiometric correction
  'l1b',       // Level 1B - geometric correction
  'l2a',       // Level 2A - atmospheric correction
  'ortho',     // Orthorectified
  'mosaic',    // Mosaic/composite
  'analytic'   // Analysis-ready
).pipe(
  Schema.annotations({
    identifier: 'ProcessingLevel',
    title: 'Processing Level',
    description: 'Imagery processing/correction level.',
  })
)
export type ProcessingLevel = typeof ProcessingLevel.Type

/**
 * Spectral band.
 */
export const SpectralBand = Schema.Literal(
  'coastal',   // Coastal aerosol
  'blue',
  'green',
  'red',
  'rededge',   // Red edge
  'nir',       // Near infrared
  'swir1',     // Shortwave IR 1
  'swir2',     // Shortwave IR 2
  'pan',       // Panchromatic
  'thermal',   // Thermal IR
  'sar'        // SAR
).pipe(
  Schema.annotations({
    identifier: 'SpectralBand',
    title: 'Spectral Band',
    description: 'Spectral band identifier.',
  })
)
export type SpectralBand = typeof SpectralBand.Type

// =============================================================================
// Imagery Entity
// =============================================================================

/**
 * Imagery entity - satellite/aerial imagery metadata.
 */
export class ImageryEntity extends Schema.TaggedClass<ImageryEntity>()(
  'ImageryEntity',
  {
    // Base entity fields
    id: EntityId,
    entityType: Schema.Literal('imagery'),
    provenance: EntityProvenance,
    metadata: Schema.optionalWith(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }),
      { default: () => ({}) }
    ),

    // Embedded traits
    spatial: SpatialTrait,
    temporal: TemporalTrait,

    // Imagery-specific fields
    /** Imagery provider. */
    provider: ImageryProvider,
    /** Collection/product name. */
    collection: Schema.String.pipe(Schema.minLength(1)),
    /** Item/scene ID. */
    itemId: Schema.String.pipe(Schema.minLength(1)),
    /** Acquisition timestamp. */
    acquired: Schema.Date,
    /** Cloud cover percentage (0-100%). */
    cloudCover: Schema.optional(Schema.Number.pipe(Schema.between(0, 100))),
    /** Ground sample distance in meters. */
    gsd: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
    /** Sun elevation angle in degrees. */
    sunElevation: Schema.optional(Schema.Number.pipe(Schema.between(-90, 90))),
    /** Sun azimuth angle in degrees. */
    sunAzimuth: Schema.optional(Schema.Number.pipe(Schema.between(0, 360))),
    /** Off-nadir viewing angle in degrees. */
    offNadir: Schema.optional(Schema.Number.pipe(Schema.between(0, 90))),
    /** Satellite azimuth angle. */
    satAzimuth: Schema.optional(Schema.Number.pipe(Schema.between(0, 360))),
    /** Thumbnail URL. */
    thumbnailUrl: Schema.optional(Schema.String),
    /** Full resolution asset URL. */
    assetUrl: Schema.optional(Schema.String),
    /** Processing level. */
    processingLevel: Schema.optional(ProcessingLevel),
    /** Available spectral bands. */
    bands: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
    /** File format (GeoTIFF, JPEG2000, etc.). */
    format: Schema.optional(Schema.String),
    /** File size in bytes. */
    sizeBytes: Schema.optional(Schema.Number),
    /** Sensor name. */
    sensor: Schema.optional(Schema.String),
    /** Platform/satellite name. */
    platform: Schema.optional(Schema.String),
  },
  {
    identifier: 'ImageryEntity',
    title: 'Imagery Entity',
    description: 'Satellite/aerial imagery metadata. Imagery fields embedded directly.',
  }
) {
  get displayLabel(): string {
    return `${this.provider}:${this.itemId}`
  }

  isClearScene(maxCloudCover = 20): boolean {
    return (this.cloudCover ?? 100) <= maxCloudCover
  }

  hasAsset(): boolean {
    return Boolean(this.assetUrl)
  }

  toSummary(): string {
    const cloud = this.cloudCover != null ? `${this.cloudCover.toFixed(1)}% cloud` : 'cloud N/A'
    return `${this.displayLabel} · ${cloud}`
  }
}
