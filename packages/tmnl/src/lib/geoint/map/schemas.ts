/**
 * MapController Effect Schema Contracts
 *
 * All input/output types for the MapController abstraction.
 * Per AGENTS.md: domain types as Effect Schema — no raw interfaces.
 *
 * @module geoint/map/schemas
 */

import { Schema } from 'effect'

// =============================================================================
// Primitives
// =============================================================================

/**
 * Geographic coordinate (WGS84).
 */
export const GeoCoord = Schema.Struct({
  longitude: Schema.Number.pipe(
    Schema.clamp(-180, 180),
    Schema.annotations({ description: 'Longitude in WGS84 degrees' })
  ),
  latitude: Schema.Number.pipe(
    Schema.clamp(-90, 90),
    Schema.annotations({ description: 'Latitude in WGS84 degrees' })
  ),
  altitude: Schema.optional(Schema.Number),
})
export type GeoCoord = typeof GeoCoord.Type

/**
 * Geographic bounding box.
 */
export const GeoBounds = Schema.Struct({
  minLon: Schema.Number.pipe(Schema.clamp(-180, 180)),
  minLat: Schema.Number.pipe(Schema.clamp(-90, 90)),
  maxLon: Schema.Number.pipe(Schema.clamp(-180, 180)),
  maxLat: Schema.Number.pipe(Schema.clamp(-90, 90)),
})
export type GeoBounds = typeof GeoBounds.Type

// =============================================================================
// Viewport
// =============================================================================

/** Minimum allowed zoom level */
export const MIN_ZOOM = 0
/** Maximum allowed zoom level */
export const MAX_ZOOM = 22
/** Default zoom step for zoomIn/zoomOut */
export const ZOOM_STEP = 1

/**
 * Map viewport state.
 */
export const ViewportState = Schema.Struct({
  longitude: Schema.Number.pipe(Schema.clamp(-180, 180)),
  latitude: Schema.Number.pipe(Schema.clamp(-90, 90)),
  zoom: Schema.Number.pipe(Schema.clamp(MIN_ZOOM, MAX_ZOOM)),
  pitch: Schema.Number.pipe(Schema.clamp(0, 85)),
  bearing: Schema.Number.pipe(Schema.clamp(-180, 180)),
})
export type ViewportState = typeof ViewportState.Type

/**
 * Default home viewport (San Francisco, zoom 12, top-down).
 */
export const DEFAULT_VIEWPORT: ViewportState = {
  longitude: -122.42,
  latitude: 37.78,
  zoom: 12,
  pitch: 0,
  bearing: 0,
}

// =============================================================================
// Camera
// =============================================================================

/**
 * Easing function for camera transitions.
 */
export const CameraEasing = Schema.Literal(
  'linear',
  'ease-in',
  'ease-out',
  'ease-in-out'
)
export type CameraEasing = typeof CameraEasing.Type

/**
 * Target for camera fly-to animation.
 */
export const FlyToTarget = Schema.Struct({
  longitude: Schema.Number.pipe(Schema.clamp(-180, 180)),
  latitude: Schema.Number.pipe(Schema.clamp(-90, 90)),
  zoom: Schema.optional(Schema.Number.pipe(Schema.clamp(MIN_ZOOM, MAX_ZOOM))),
  pitch: Schema.optional(Schema.Number.pipe(Schema.clamp(0, 85))),
  bearing: Schema.optional(Schema.Number),
  transitionDuration: Schema.optional(
    Schema.Number.pipe(Schema.nonNegative())
  ),
  easing: Schema.optional(CameraEasing),
})
export type FlyToTarget = typeof FlyToTarget.Type

// =============================================================================
// Layers
// =============================================================================

/**
 * Layer key — identifies a toggleable map layer.
 */
export const LayerKey = Schema.Literal(
  'tracks',
  'pois',
  'flights',
  'features',
  'imagery',
  'weather',
  'heatmap',
  'labels'
)
export type LayerKey = typeof LayerKey.Type

/**
 * Map basemap style.
 */
export const MapStyle = Schema.Literal(
  'dark',
  'satellite',
  'streets',
  'terrain',
  'light'
)
export type MapStyle = typeof MapStyle.Type

/**
 * Mapbox style URL registry.
 */
export const MAP_STYLE_URLS: Record<MapStyle, string> = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  streets: 'mapbox://styles/mapbox/streets-v12',
  terrain: 'mapbox://styles/mapbox/outdoors-v12',
  light: 'mapbox://styles/mapbox/light-v11',
}

/**
 * Ordered style list for cycleMapStyle().
 */
export const MAP_STYLE_ORDER: readonly MapStyle[] = [
  'dark',
  'satellite',
  'streets',
  'terrain',
  'light',
] as const

// =============================================================================
// Screen Space
// =============================================================================

/**
 * Screen coordinate result from projection.
 */
export const ScreenCoord = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  isVisible: Schema.Boolean,
})
export type ScreenCoord = typeof ScreenCoord.Type

// =============================================================================
// Measurement Results
// =============================================================================

/**
 * Distance measurement result (multi-unit).
 */
export const DistanceResult = Schema.Struct({
  meters: Schema.Number.pipe(Schema.nonNegative()),
  kilometers: Schema.Number.pipe(Schema.nonNegative()),
  nauticalMiles: Schema.Number.pipe(Schema.nonNegative()),
})
export type DistanceResult = typeof DistanceResult.Type

/**
 * Cardinal direction.
 */
export const Cardinal = Schema.Literal(
  'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'
)
export type Cardinal = typeof Cardinal.Type

/**
 * Bearing measurement result.
 */
export const BearingResult = Schema.Struct({
  degrees: Schema.Number.pipe(Schema.clamp(0, 360)),
  cardinal: Cardinal,
})
export type BearingResult = typeof BearingResult.Type

/**
 * Area measurement result (multi-unit).
 */
export const AreaResult = Schema.Struct({
  squareMeters: Schema.Number.pipe(Schema.nonNegative()),
  squareKilometers: Schema.Number.pipe(Schema.nonNegative()),
  acres: Schema.Number.pipe(Schema.nonNegative()),
})
export type AreaResult = typeof AreaResult.Type

// =============================================================================
// Export Results
// =============================================================================

/**
 * Export format.
 */
export const ExportFormat = Schema.Literal('geojson', 'png')
export type ExportFormat = typeof ExportFormat.Type

/**
 * Export result metadata.
 */
export const ExportResult = Schema.TaggedStruct('ExportResult', {
  format: ExportFormat,
  featureCount: Schema.Number.pipe(Schema.nonNegative()),
  bounds: Schema.NullOr(GeoBounds),
  generatedAt: Schema.DateFromSelf,
})
export type ExportResult = typeof ExportResult.Type

// =============================================================================
// Annotation (Phase 2 stubs)
// =============================================================================

/**
 * Drawing mode for annotation tools.
 */
export const DrawingMode = Schema.Literal('polygon', 'line', 'circle')
export type DrawingMode = typeof DrawingMode.Type

/**
 * Marker options.
 */
export const MarkerOptions = Schema.Struct({
  label: Schema.optional(Schema.String),
  color: Schema.optional(Schema.String),
  icon: Schema.optional(Schema.String),
})
export type MarkerOptions = typeof MarkerOptions.Type

// =============================================================================
// Controller Status
// =============================================================================

/**
 * MapController status snapshot.
 */
export const MapControllerStatus = Schema.Struct({
  panelId: Schema.String,
  viewport: ViewportState,
  mapStyle: MapStyle,
  selectionCount: Schema.Number.pipe(Schema.nonNegative()),
  resultCount: Schema.Number.pipe(Schema.nonNegative()),
  isAnimating: Schema.Boolean,
})
export type MapControllerStatus = typeof MapControllerStatus.Type
