import { Schema } from 'effect'

// =============================================================================
// Branded IDs
// =============================================================================

/** Unique identifier for a track (moving object) */
export const TrackId = Schema.String.pipe(Schema.brand('TrackId'))
export type TrackId = typeof TrackId.Type

/** Unique identifier for a feature (static object) */
export const FeatureId = Schema.String.pipe(Schema.brand('FeatureId'))
export type FeatureId = typeof FeatureId.Type

/** Unique identifier for a layer */
export const LayerId = Schema.String.pipe(Schema.brand('LayerId'))
export type LayerId = typeof LayerId.Type

// =============================================================================
// GeoJSON Primitives
// =============================================================================

/** [longitude, latitude] coordinate pair */
export const Position = Schema.Tuple(Schema.Number, Schema.Number)
export type Position = typeof Position.Type

/** [longitude, latitude, altitude] coordinate triple */
export const Position3D = Schema.Tuple(Schema.Number, Schema.Number, Schema.Number)
export type Position3D = typeof Position3D.Type

/** [minLon, minLat, maxLon, maxLat] bounding box */
export const BBox = Schema.Tuple(
  Schema.Number,
  Schema.Number,
  Schema.Number,
  Schema.Number
)
export type BBox = typeof BBox.Type

// =============================================================================
// Classification & Enums
// =============================================================================

/** Track classification for friend/foe identification */
export const Classification = Schema.Literal(
  'friendly',
  'hostile',
  'neutral',
  'unknown'
)
export type Classification = typeof Classification.Type

/** Type of moving object being tracked */
export const ObjectType = Schema.Literal(
  'aircraft',
  'vehicle',
  'vessel',
  'person'
)
export type ObjectType = typeof ObjectType.Type

/** Sensor type for satellite imagery */
export const SensorType = Schema.Literal('optical', 'sar', 'thermal')
export type SensorType = typeof SensorType.Type

/** Layer type for rendering mode */
export const LayerType = Schema.Literal('vector', 'raster', 'imagery')
export type LayerType = typeof LayerType.Type

// =============================================================================
// Color Utilities
// =============================================================================

/** RGB color as [r, g, b] where each is 0-255 */
export const RGBColor = Schema.Tuple(
  Schema.Number.pipe(Schema.between(0, 255)),
  Schema.Number.pipe(Schema.between(0, 255)),
  Schema.Number.pipe(Schema.between(0, 255))
)
export type RGBColor = typeof RGBColor.Type

/** RGBA color as [r, g, b, a] where a is 0-255 */
export const RGBAColor = Schema.Tuple(
  Schema.Number.pipe(Schema.between(0, 255)),
  Schema.Number.pipe(Schema.between(0, 255)),
  Schema.Number.pipe(Schema.between(0, 255)),
  Schema.Number.pipe(Schema.between(0, 255))
)
export type RGBAColor = typeof RGBAColor.Type

// =============================================================================
// Classification Color Mapping
// =============================================================================

/** Get RGB color for a classification */
export const classificationColors: Record<Classification, RGBColor> = {
  friendly: [0, 255, 0],
  hostile: [255, 0, 0],
  neutral: [255, 255, 0],
  unknown: [128, 128, 128]
}
