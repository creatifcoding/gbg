// =============================================================================
// GEOINT Schemas - Barrel Export
// =============================================================================

// Core types and primitives
export {
  // Branded IDs
  TrackId,
  FeatureId,
  LayerId,
  // Primitives
  Position,
  Position3D,
  BBox,
  // Enums
  Classification,
  ObjectType,
  SensorType,
  LayerType,
  // Colors
  RGBColor,
  RGBAColor,
  classificationColors
} from './core'
export type {
  TrackId as TrackIdType,
  FeatureId as FeatureIdType,
  LayerId as LayerIdType,
  Position as PositionType,
  Position3D as Position3DType,
  BBox as BBoxType,
  Classification as ClassificationType,
  ObjectType as ObjectTypeEnum,
  SensorType as SensorTypeEnum,
  LayerType as LayerTypeEnum,
  RGBColor as RGBColorType,
  RGBAColor as RGBAColorType
} from './core'

// Track schemas (TaggedClass)
export {
  TrackPosition,
  TrackMetadata,
  Track,
  TrackPositionUpdate,
  TrackClassificationUpdate,
  TrackQuery,
  TrackEvent
} from './tracks'
export type { TrackQuery as TrackQueryType, TrackEvent as TrackEventType } from './tracks'

// Feature schemas (TaggedClass)
export {
  // Geometries
  PointGeometry,
  LineStringGeometry,
  PolygonGeometry,
  Geometry,
  // Features
  FeatureProperties,
  Feature,
  GeoJsonFeature,
  FeatureCollection,
  // Layers
  Layer,
  LayerToggle,
  LayerOpacityChange,
  LayerEvent,
  // Queries
  FeatureQuery,
  FeatureQueryResponse
} from './features'
export type {
  PointGeometry as PointGeometryType,
  LineStringGeometry as LineStringGeometryType,
  PolygonGeometry as PolygonGeometryType,
  Geometry as GeometryType,
  FeatureProperties as FeaturePropertiesType,
  GeoJsonFeature as GeoJsonFeatureType,
  FeatureCollection as FeatureCollectionType,
  LayerEvent as LayerEventType,
  FeatureQuery as FeatureQueryType
} from './features'

// Analysis schemas (TaggedClass)
export {
  // Spatial operations
  BufferParams,
  SpatialOperation,
  SpatialAnalysisRequest,
  // Distance & proximity
  DistanceResult,
  ProximityQuery,
  // Tiles
  TileId,
  TileRequest,
  TileData,
  // Imagery
  ImageryMetadata,
  ImageryChunk,
  ImageryRequest,
  // Threat
  ThreatLevel,
  ThreatVolume
} from './analysis'
export type {
  SpatialOperation as SpatialOperationType,
  ThreatLevel as ThreatLevelType
} from './analysis'
