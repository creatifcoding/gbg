/**
 * Terminal v3 Schemas
 */

export {
  // Stream reference
  StreamRef,
  type StreamRef,
  // Blocks
  AIResponseBlockV3,
  CommandBlockV3,
  InteractiveBlockV3,
  SystemBlockV3,
  ErrorBlockV3,
  BlockV3,
  type AIResponseBlockV3,
  type CommandBlockV3,
  type InteractiveBlockV3,
  type SystemBlockV3,
  type ErrorBlockV3,
  type BlockV3,
  // Type guards
  isAIResponseBlock,
  isCommandBlock,
  isInteractiveBlock,
  isSystemBlock,
  isErrorBlock,
  isBlockActive,
  // Factories
  createAIResponseBlock,
  createCommandBlock,
  createInteractiveBlock,
  createSystemBlock,
  createErrorBlock,
} from './blocks'

// Map output schemas for tool result detection
export {
  // GeoJSON types
  Position,
  GeometryType,
  Geometry,
  Feature,
  FeatureCollection,
  type Position,
  type GeometryType,
  type Geometry,
  type Feature,
  type FeatureCollection,
  // Map configuration
  MapLayerType,
  ColorSpec,
  MapLayer,
  MapMarker,
  MapBounds,
  type MapLayerType,
  type ColorSpec,
  type MapLayer,
  type MapMarker,
  type MapBounds,
  // Structured output
  StructuredMapOutput,
  DetectionSource,
  DetectedMapData,
  type StructuredMapOutput,
  type DetectionSource,
  type DetectedMapData,
  // Type guards
  isFeatureCollection,
  isFeature,
  isGeometry,
  isCoordinateArray,
  isMapBounds,
  isStructuredMapOutput,
  // Decoders
  decodeStructuredMapOutput,
  decodeFeatureCollection,
  decodeFeature,
} from './map-output'
