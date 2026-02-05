/**
 * Terminal v3 Schemas
 *
 * Effect Schema exports are both values AND types.
 * Use Schema.Type<typeof X> for type extraction.
 */

// =============================================================================
// Block Schemas & Factories
// =============================================================================

export {
  // Stream reference (schema + type)
  StreamRef,
  // Block schemas (also serve as types via Schema.Type<>)
  AIResponseBlockV3,
  CommandBlockV3,
  InteractiveBlockV3,
  SystemBlockV3,
  ErrorBlockV3,
  JsonRenderBlockV3,
  BlockV3,
  // Type guards
  isAIResponseBlock,
  isCommandBlock,
  isInteractiveBlock,
  isSystemBlock,
  isErrorBlock,
  isJsonRenderBlock,
  isBlockActive,
  // Factories
  createAIResponseBlock,
  createCommandBlock,
  createInteractiveBlock,
  createSystemBlock,
  createErrorBlock,
} from './blocks'

// Block type aliases for convenience (distinct names to avoid conflicts)
export type {
  StreamRef as StreamRefType,
  AIResponseBlockV3 as AIResponseBlockV3Type,
  CommandBlockV3 as CommandBlockV3Type,
  InteractiveBlockV3 as InteractiveBlockV3Type,
  SystemBlockV3 as SystemBlockV3Type,
  ErrorBlockV3 as ErrorBlockV3Type,
  BlockV3 as BlockV3Type,
} from './blocks'

// =============================================================================
// JsonRenderBlock
// =============================================================================

export {
  SemanticRegionEntry,
  createJsonRenderBlock,
  createJsonRenderBlockWithRegions,
} from './json-render-block'

export type {
  JsonRenderBlockV3 as JsonRenderBlockV3ExportType,
  SemanticRegionEntry as SemanticRegionEntryExportType,
} from './json-render-block'

// =============================================================================
// Map Output Schemas
// =============================================================================

export {
  // GeoJSON schemas
  Position,
  GeometryType,
  Geometry,
  Feature,
  FeatureCollection,
  // Map configuration schemas
  MapLayerType,
  ColorSpec,
  MapLayer,
  MapMarker,
  MapBounds,
  // Structured output schemas
  StructuredMapOutput,
  DetectionSource,
  DetectedMapData,
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

// Map type aliases for convenience (distinct names)
export type {
  Position as PositionType,
  GeometryType as GeometryTypeType,
  Geometry as GeometrySchemaType,
  Feature as FeatureType,
  FeatureCollection as FeatureCollectionType,
  MapLayerType as MapLayerTypeType,
  ColorSpec as ColorSpecType,
  MapLayer as MapLayerSchemaType,
  MapMarker as MapMarkerType,
  MapBounds as MapBoundsType,
  StructuredMapOutput as StructuredMapOutputType,
  DetectionSource as DetectionSourceType,
  DetectedMapData as DetectedMapDataType,
} from './map-output'
