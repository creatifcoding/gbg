import { Schema } from 'effect'
import { BBox, Position, FeatureId, TrackId, SensorType } from './core'

// =============================================================================
// Spatial Analysis Types
// =============================================================================

/** Buffer operation parameters */
export class BufferParams extends Schema.TaggedClass<BufferParams>(
  'BufferParams'
)('BufferParams', {
  /** Distance in meters */
  distance: Schema.Number.pipe(Schema.positive()),

  /** Number of segments for curved buffers */
  segments: Schema.optionalWith(Schema.Number.pipe(Schema.between(4, 64)), {
    default: () => 32
  })
}) {}

/** Spatial analysis operation types */
export const SpatialOperation = Schema.Literal(
  'buffer',
  'intersection',
  'union',
  'difference',
  'convexHull',
  'centroid'
)
export type SpatialOperation = typeof SpatialOperation.Type

/** Spatial analysis request */
export class SpatialAnalysisRequest extends Schema.TaggedClass<SpatialAnalysisRequest>(
  'SpatialAnalysisRequest'
)('SpatialAnalysisRequest', {
  /** Operation to perform */
  operation: SpatialOperation,

  /** Feature IDs to operate on */
  featureIds: Schema.Array(FeatureId),

  /** Buffer parameters (for buffer operation) */
  bufferParams: Schema.optional(BufferParams)
}) {}

// =============================================================================
// Distance & Proximity
// =============================================================================

/** Distance calculation result */
export class DistanceResult extends Schema.TaggedClass<DistanceResult>(
  'DistanceResult'
)('DistanceResult', {
  /** Distance in meters */
  meters: Schema.Number,

  /** Distance in nautical miles */
  nauticalMiles: Schema.Number,

  /** Distance in kilometers */
  kilometers: Schema.Number
}) {}

/** Proximity query parameters */
export class ProximityQuery extends Schema.TaggedClass<ProximityQuery>(
  'ProximityQuery'
)('ProximityQuery', {
  /** Center point */
  center: Position,

  /** Radius in meters */
  radius: Schema.Number.pipe(Schema.positive()),

  /** Limit results */
  limit: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), {
    default: () => 50
  })
}) {}

// =============================================================================
// Tile Data
// =============================================================================

/** Map tile identifier */
export class TileId extends Schema.TaggedClass<TileId>('TileId')('TileId', {
  x: Schema.Number.pipe(Schema.int()),
  y: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.between(0, 22))
}) {}

/** Tile request parameters */
export class TileRequest extends Schema.TaggedClass<TileRequest>(
  'TileRequest'
)('TileRequest', {
  /** Bounding box to fetch tiles for */
  bounds: BBox,

  /** Zoom level */
  zoom: Schema.Number.pipe(Schema.between(0, 22))
}) {}

/** Tile data response */
export class TileData extends Schema.TaggedClass<TileData>('TileData')(
  'TileData',
  {
    /** Tile identifier */
    tileId: TileId,

    /** Tile URL or data URI */
    url: Schema.String,

    /** Whether tile is from cache */
    cached: Schema.Boolean
  }
) {}

// =============================================================================
// Satellite Imagery
// =============================================================================

/** Imagery metadata */
export class ImageryMetadata extends Schema.TaggedClass<ImageryMetadata>(
  'ImageryMetadata'
)('ImageryMetadata', {
  /** Sensor type */
  sensorType: SensorType,

  /** Acquisition timestamp */
  acquisitionTime: Schema.Date,

  /** Cloud cover percentage (0-100) */
  cloudCover: Schema.Number.pipe(Schema.between(0, 100)),

  /** Resolution in meters per pixel */
  resolution: Schema.Number.pipe(Schema.positive())
}) {}

/** Streaming imagery chunk */
export class ImageryChunk extends Schema.TaggedClass<ImageryChunk>(
  'ImageryChunk'
)('ImageryChunk', {
  /** Tile identifier */
  tileId: Schema.String,

  /** Image data as base64 or ArrayBuffer reference */
  imageData: Schema.Uint8Array,

  /** Imagery metadata */
  metadata: ImageryMetadata
}) {}

/** Imagery request parameters */
export class ImageryRequest extends Schema.TaggedClass<ImageryRequest>(
  'ImageryRequest'
)('ImageryRequest', {
  /** Bounding box */
  bounds: BBox,

  /** Sensor type to request */
  sensorType: SensorType,

  /** Maximum cloud cover (0-100) */
  maxCloudCover: Schema.optionalWith(
    Schema.Number.pipe(Schema.between(0, 100)),
    { default: () => 100 }
  ),

  /** Date range start */
  startDate: Schema.optional(Schema.Date),

  /** Date range end */
  endDate: Schema.optional(Schema.Date)
}) {}

// =============================================================================
// Threat Assessment
// =============================================================================

/** Threat level enum */
export const ThreatLevel = Schema.Literal('low', 'medium', 'high', 'critical')
export type ThreatLevel = typeof ThreatLevel.Type

/** Threat volume definition (3D space) */
export class ThreatVolume extends Schema.TaggedClass<ThreatVolume>(
  'ThreatVolume'
)('ThreatVolume', {
  /** Center position */
  center: Position,

  /** Radius in meters */
  radius: Schema.Number.pipe(Schema.positive()),

  /** Height in meters */
  height: Schema.Number.pipe(Schema.positive()),

  /** Threat level */
  level: ThreatLevel,

  /** Associated track ID (if any) */
  trackId: Schema.optional(TrackId),

  /** Confidence (0-1) */
  confidence: Schema.Number.pipe(Schema.between(0, 1))
}) {}
