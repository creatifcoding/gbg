/**
 * Map Output Schemas
 *
 * Effect Schema definitions for GeoJSON detection and MapOutput structured output.
 * Used for detecting map-producing tool results and normalizing them for editor insertion.
 *
 * @module terminal/v3/schemas/map-output
 */

import { Schema } from 'effect'

// =============================================================================
// GeoJSON Core Types (RFC 7946 compliant)
// =============================================================================

/**
 * GeoJSON Position - [longitude, latitude, altitude?]
 */
export const Position = Schema.Tuple(
  Schema.Number, // longitude
  Schema.Number, // latitude
  Schema.optionalElement(Schema.Number) // altitude
)
export type Position = Schema.Schema.Type<typeof Position>

/**
 * GeoJSON Geometry Types
 */
export const GeometryType = Schema.Literal(
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection'
)
export type GeometryType = Schema.Schema.Type<typeof GeometryType>

/**
 * GeoJSON Geometry object
 * Note: coordinates type varies by geometry type, so we use Unknown
 */
export const Geometry = Schema.Struct({
  type: GeometryType,
  coordinates: Schema.Unknown, // Varies by geometry type
})
export type Geometry = Schema.Schema.Type<typeof Geometry>

/**
 * GeoJSON Feature
 */
export const Feature = Schema.Struct({
  type: Schema.Literal('Feature'),
  geometry: Schema.NullOr(Geometry),
  properties: Schema.NullOr(
    Schema.Record({ key: Schema.String, value: Schema.Unknown })
  ),
  id: Schema.optional(Schema.Union(Schema.String, Schema.Number)),
})
export type Feature = Schema.Schema.Type<typeof Feature>

/**
 * GeoJSON FeatureCollection
 */
export const FeatureCollection = Schema.Struct({
  type: Schema.Literal('FeatureCollection'),
  features: Schema.Array(Feature),
})
export type FeatureCollection = Schema.Schema.Type<typeof FeatureCollection>

// =============================================================================
// Map Layer Configuration
// =============================================================================

/**
 * Supported layer types for map visualization
 */
export const MapLayerType = Schema.Literal(
  'geojson',
  'scatterplot',
  'path',
  'polygon',
  'heatmap',
  'arc',
  'icon'
)
export type MapLayerType = Schema.Schema.Type<typeof MapLayerType>

/**
 * Color specification - hex string or RGB(A) tuple
 */
export const ColorSpec = Schema.Union(
  Schema.String, // Hex color like '#ff0000'
  Schema.Tuple(Schema.Number, Schema.Number, Schema.Number), // RGB
  Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number) // RGBA
)
export type ColorSpec = Schema.Schema.Type<typeof ColorSpec>

/**
 * Map layer definition
 */
export const MapLayer = Schema.Struct({
  id: Schema.String,
  type: MapLayerType,
  data: Schema.Union(
    FeatureCollection,
    Schema.Array(Schema.Unknown) // For non-GeoJSON layer formats
  ),
  visible: Schema.optional(Schema.Boolean),
  opacity: Schema.optional(Schema.Number),
  color: Schema.optional(ColorSpec),
  // Layer-specific options
  radius: Schema.optional(Schema.Number), // For scatterplot
  lineWidth: Schema.optional(Schema.Number), // For path/polygon
  filled: Schema.optional(Schema.Boolean), // For polygon
  stroked: Schema.optional(Schema.Boolean), // For polygon
})
export type MapLayer = Schema.Schema.Type<typeof MapLayer>

// =============================================================================
// Map Marker
// =============================================================================

/**
 * Map marker/point of interest
 */
export const MapMarker = Schema.Struct({
  id: Schema.optional(Schema.String),
  position: Position,
  label: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  color: Schema.optional(Schema.String),
  icon: Schema.optional(Schema.String),
  size: Schema.optional(Schema.Number),
  // Popup/tooltip content
  popup: Schema.optional(Schema.String),
})
export type MapMarker = Schema.Schema.Type<typeof MapMarker>

// =============================================================================
// Map Bounds
// =============================================================================

/**
 * Geographic bounding box
 */
export const MapBounds = Schema.Struct({
  north: Schema.Number, // Max latitude
  south: Schema.Number, // Min latitude
  east: Schema.Number, // Max longitude
  west: Schema.Number, // Min longitude
})
export type MapBounds = Schema.Schema.Type<typeof MapBounds>

// =============================================================================
// Structured Map Output (explicit schema for tool results)
// =============================================================================

/**
 * Structured output schema for map-producing tools.
 * Tools can return this format for explicit map rendering.
 */
export const StructuredMapOutput = Schema.Struct({
  /** Optional type tag for explicit detection */
  _type: Schema.optional(Schema.Literal('MapOutput')),
  /** Pre-configured layers */
  layers: Schema.optional(Schema.Array(MapLayer)),
  /** Point markers */
  markers: Schema.optional(Schema.Array(MapMarker)),
  /** Raw GeoJSON (will be converted to layer) */
  geojson: Schema.optional(Schema.Union(FeatureCollection, Feature)),
  /** Suggested viewport bounds */
  bounds: Schema.optional(MapBounds),
  /** Display title */
  title: Schema.optional(Schema.String),
  /** Description text */
  description: Schema.optional(Schema.String),
})
export type StructuredMapOutput = Schema.Schema.Type<typeof StructuredMapOutput>

// =============================================================================
// Detection Source
// =============================================================================

/**
 * How the map data was detected
 */
export const DetectionSource = Schema.Literal(
  'explicit', // Tool name in MAP_PRODUCING_TOOLS
  'schema', // Matched StructuredMapOutput schema
  'detection' // Auto-detected from GeoJSON/coordinates
)
export type DetectionSource = Schema.Schema.Type<typeof DetectionSource>

// =============================================================================
// Detected Map Data (normalized internal format)
// =============================================================================

/**
 * Normalized map data after detection.
 * All detection methods produce this format.
 */
export const DetectedMapData = Schema.Struct({
  /** Unique ID for this detection */
  id: Schema.String,
  /** Normalized layers */
  layers: Schema.Array(MapLayer),
  /** Normalized markers */
  markers: Schema.Array(MapMarker),
  /** Computed or provided bounds */
  bounds: Schema.optional(MapBounds),
  /** Display title */
  title: Schema.optional(Schema.String),
  /** How this data was detected */
  source: DetectionSource,
})
export type DetectedMapData = Schema.Schema.Type<typeof DetectedMapData>

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if value is a valid FeatureCollection
 */
export function isFeatureCollection(value: unknown): value is FeatureCollection {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return obj.type === 'FeatureCollection' && Array.isArray(obj.features)
}

/**
 * Check if value is a valid Feature
 */
export function isFeature(value: unknown): value is Feature {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return obj.type === 'Feature' && 'geometry' in obj
}

/**
 * Check if value is a valid Geometry
 */
export function isGeometry(value: unknown): value is Geometry {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  const validTypes = [
    'Point',
    'MultiPoint',
    'LineString',
    'MultiLineString',
    'Polygon',
    'MultiPolygon',
    'GeometryCollection',
  ]
  return typeof obj.type === 'string' && validTypes.includes(obj.type)
}

/**
 * Check if value looks like a coordinate array [lon, lat] or [lon, lat, alt]
 */
export function isCoordinateArray(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 2 || value.length > 3) return false

  const [lon, lat, alt] = value

  // Validate longitude (-180 to 180)
  if (typeof lon !== 'number' || lon < -180 || lon > 180) return false

  // Validate latitude (-90 to 90)
  if (typeof lat !== 'number' || lat < -90 || lat > 90) return false

  // Optional altitude validation
  if (alt !== undefined && typeof alt !== 'number') return false

  return true
}

/**
 * Check if value is a valid MapBounds
 */
export function isMapBounds(value: unknown): value is MapBounds {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>

  return (
    typeof obj.north === 'number' &&
    typeof obj.south === 'number' &&
    typeof obj.east === 'number' &&
    typeof obj.west === 'number' &&
    obj.north >= -90 &&
    obj.north <= 90 &&
    obj.south >= -90 &&
    obj.south <= 90 &&
    obj.east >= -180 &&
    obj.east <= 180 &&
    obj.west >= -180 &&
    obj.west <= 180
  )
}

/**
 * Check if value matches StructuredMapOutput schema
 */
export function isStructuredMapOutput(value: unknown): value is StructuredMapOutput {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>

  // Must have explicit _type tag OR have layers/markers/geojson
  const hasTypeTag = obj._type === 'MapOutput'
  const hasMapData = 'layers' in obj || 'markers' in obj || 'geojson' in obj

  return hasTypeTag || hasMapData
}

// =============================================================================
// Schema Decoders
// =============================================================================

/**
 * Attempt to decode a value as StructuredMapOutput
 */
export const decodeStructuredMapOutput = Schema.decodeUnknownOption(StructuredMapOutput)

/**
 * Attempt to decode a value as FeatureCollection
 */
export const decodeFeatureCollection = Schema.decodeUnknownOption(FeatureCollection)

/**
 * Attempt to decode a value as Feature
 */
export const decodeFeature = Schema.decodeUnknownOption(Feature)
