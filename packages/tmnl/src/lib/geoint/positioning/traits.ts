/**
 * GEOINT Positioning Traits
 *
 * Effect Schema-validated traits for geographic positioning in the scenegraph.
 * Integrates with Kori ECS for entity management and deck.gl for map projection.
 *
 * @see .cursor/prd/features.md F001 (Track Visualization)
 * @module geoint/positioning/traits
 */

import { Schema } from 'effect'
import { defineTrait, defineTagTrait, registerTrait, type TraitId } from '@/lib/kori'

// =============================================================================
// Geographic Position Traits
// =============================================================================

/**
 * GeoPosition trait - Geographic coordinates (WGS84)
 *
 * Core positioning trait for map-grounded entities.
 * Uses [lon, lat] order (GeoJSON standard) internally.
 */
export const GeoPosition = defineTrait('GeoPosition', {
  /** Longitude in degrees (-180 to 180) */
  longitude: Schema.Number.pipe(
    Schema.clamp(-180, 180),
    Schema.annotations({ description: 'Longitude in WGS84 degrees' })
  ),
  /** Latitude in degrees (-90 to 90) */
  latitude: Schema.Number.pipe(
    Schema.clamp(-90, 90),
    Schema.annotations({ description: 'Latitude in WGS84 degrees' })
  ),
  /** Altitude in meters above sea level (optional) */
  altitude: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  /** Timestamp of the position (for temporal animation) */
  timestamp: Schema.optionalWith(Schema.DateFromSelf, { default: () => new Date() }),
})
export type GeoPosition = typeof GeoPosition.Type

/**
 * GeoHeading trait - Orientation and bearing
 *
 * Heading/course for directional entities (tracks, vehicles).
 */
export const GeoHeading = defineTrait('GeoHeading', {
  /** Heading in degrees from true north (0-360) */
  heading: Schema.Number.pipe(
    Schema.clamp(0, 360),
    Schema.annotations({ description: 'Heading from true north' })
  ),
  /** Pitch angle in degrees (-90 to 90) */
  pitch: Schema.optionalWith(Schema.Number.pipe(Schema.clamp(-90, 90)), { default: () => 0 }),
  /** Roll angle in degrees (-180 to 180) */
  roll: Schema.optionalWith(Schema.Number.pipe(Schema.clamp(-180, 180)), { default: () => 0 }),
})
export type GeoHeading = typeof GeoHeading.Type

/**
 * GeoVelocity trait - Speed and direction of movement
 */
export const GeoVelocity = defineTrait('GeoVelocity', {
  /** Speed in knots */
  speed: Schema.Number.pipe(Schema.nonNegative()),
  /** Course over ground (degrees from north) */
  course: Schema.Number.pipe(Schema.clamp(0, 360)),
  /** Vertical speed in meters/second (positive = ascending) */
  verticalSpeed: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})
export type GeoVelocity = typeof GeoVelocity.Type

// =============================================================================
// Screen Space Traits (Computed from GeoPosition)
// =============================================================================

/**
 * ScreenPosition trait - Projected screen coordinates
 *
 * Computed from GeoPosition using viewport projection.
 * Values depend on current viewport state.
 */
export const ScreenPosition = defineTrait('ScreenPosition', {
  /** X coordinate in screen pixels (from center) */
  x: Schema.Number,
  /** Y coordinate in screen pixels (from center) */
  y: Schema.Number,
  /** Z depth value for layering */
  z: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  /** Whether the position is within visible viewport */
  isVisible: Schema.Boolean,
})
export type ScreenPosition = typeof ScreenPosition.Type

/**
 * NDCPosition trait - Normalized Device Coordinates (-1 to 1)
 *
 * WebGL-compatible coordinates for R3F overlay.
 */
export const NDCPosition = defineTrait('NDCPosition', {
  /** X in NDC (-1 to 1) */
  ndcX: Schema.Number.pipe(Schema.clamp(-2, 2)), // Allow slight overflow for interpolation
  /** Y in NDC (-1 to 1) */
  ndcY: Schema.Number.pipe(Schema.clamp(-2, 2)),
  /** Depth in NDC (0 to 1) */
  ndcZ: Schema.optionalWith(Schema.Number.pipe(Schema.clamp(0, 1)), { default: () => 0.5 }),
})
export type NDCPosition = typeof NDCPosition.Type

// =============================================================================
// Scenegraph Hierarchy Traits
// =============================================================================

/**
 * GeoAnchor trait - Anchors entity to a geographic reference point
 *
 * Used for entities that should follow a specific position while
 * allowing local offsets.
 */
export const GeoAnchor = defineTrait('GeoAnchor', {
  /** Reference entity ID to anchor to (optional) */
  anchorEntityId: Schema.optionalWith(Schema.String, { default: () => '' }),
  /** Local offset in meters (east, north, up) */
  offsetEast: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  offsetNorth: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  offsetUp: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})
export type GeoAnchor = typeof GeoAnchor.Type

/**
 * GeoScale trait - Scale factor for map-aware sizing
 *
 * Allows entities to scale based on zoom level or fixed size.
 */
export const GeoScale = defineTrait('GeoScale', {
  /** Base scale factor */
  scale: Schema.Number.pipe(Schema.positive()),
  /** Scale mode */
  scaleMode: Schema.Literal('fixed', 'zoomDependent', 'metersPerPixel'),
  /** Minimum scale (for zoom-dependent) */
  minScale: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { default: () => 0.1 }),
  /** Maximum scale (for zoom-dependent) */
  maxScale: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { default: () => 10 }),
})
export type GeoScale = typeof GeoScale.Type

// =============================================================================
// Layer Assignment Traits
// =============================================================================

/**
 * DeckGLLayer trait - Assigns entity to a specific deck.gl layer
 */
export const DeckGLLayer = defineTrait('DeckGLLayer', {
  /** Layer type identifier */
  layerType: Schema.Literal(
    // Core layers
    'scatterplot',
    'icon',
    'path',
    'polygon',
    'arc',
    'line',
    'text',
    'column',
    'bitmap',
    'point-cloud',
    // Aggregation layers
    'heatmap',
    'hexagon',
    'grid',
    'contour',
    'screen-grid',
    // Geo layers
    'trips',
    'geojson',
    'mvt',
    'tile',
    'terrain',
    'great-circle',
    // Mesh layers
    'simple-mesh',
    'scenegraph'
  ),
  /** Layer ID for grouping */
  layerId: Schema.String,
  /** Render order (higher = on top) */
  zIndex: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})
export type DeckGLLayer = typeof DeckGLLayer.Type

/**
 * R3FOverlay trait - Marks entity for React Three Fiber rendering
 */
export const R3FOverlay = defineTrait('R3FOverlay', {
  /** 3D mesh type */
  meshType: Schema.Literal('cone', 'sphere', 'box', 'cylinder', 'plane', 'custom'),
  /** Color (CSS color string or hex) */
  color: Schema.String,
  /** Opacity (0-1) */
  opacity: Schema.optionalWith(Schema.Number.pipe(Schema.clamp(0, 1)), { default: () => 1 }),
  /** Custom geometry URL (for meshType='custom') */
  geometryUrl: Schema.optionalWith(Schema.String, { default: () => '' }),
})
export type R3FOverlay = typeof R3FOverlay.Type

// =============================================================================
// Tag Traits (Markers)
// =============================================================================

/** Marks entity as requiring projection update on viewport change */
export const NeedsProjection = defineTagTrait('NeedsProjection')
export type NeedsProjection = typeof NeedsProjection.Type

/** Marks entity as visible in current viewport */
export const InViewport = defineTagTrait('InViewport')
export type InViewport = typeof InViewport.Type

/** Marks entity as selected */
export const IsSelected = defineTagTrait('IsSelected')
export type IsSelected = typeof IsSelected.Type

/** Marks entity as hovered */
export const IsHovered = defineTagTrait('IsHovered')
export type IsHovered = typeof IsHovered.Type

/** Marks entity for animated updates (trips layer) */
export const IsAnimated = defineTagTrait('IsAnimated')
export type IsAnimated = typeof IsAnimated.Type

// =============================================================================
// Camera Behavior Traits
// =============================================================================

/**
 * CameraBehavior trait - Defines how the camera should behave when focusing on entity
 */
export const CameraBehavior = defineTrait('CameraBehavior', {
  /** Default zoom level when focusing on this entity */
  defaultZoom: Schema.optionalWith(Schema.Number.pipe(Schema.clamp(0, 22)), { default: () => 14 }),
  /** Default pitch when focusing (0 = top-down, 60 = angled) */
  defaultPitch: Schema.optionalWith(Schema.Number.pipe(Schema.clamp(0, 85)), { default: () => 0 }),
  /** Default bearing when focusing (0 = north) */
  defaultBearing: Schema.optionalWith(Schema.Number.pipe(Schema.clamp(-180, 180)), { default: () => 0 }),
  /** Whether to follow entity heading for bearing */
  followHeading: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Transition duration in ms */
  transitionDuration: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { default: () => 1000 }),
  /** Easing function type */
  easing: Schema.optionalWith(
    Schema.Literal('linear', 'ease-in', 'ease-out', 'ease-in-out'),
    { default: () => 'ease-out' as const }
  ),
  /** Offset from entity center [x, y] in pixels */
  offset: Schema.optionalWith(
    Schema.Tuple(Schema.Number, Schema.Number),
    { default: () => [0, 0] as [number, number] }
  ),
  /** Minimum zoom constraint */
  minZoom: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  /** Maximum zoom constraint */
  maxZoom: Schema.optionalWith(Schema.Number, { default: () => 22 }),
})
export type CameraBehavior = typeof CameraBehavior.Type

// =============================================================================
// ScenegraphLayer Traits (3D Model Integration)
// =============================================================================

/**
 * ScenegraphModel trait - Configuration for 3D model rendering
 *
 * Used with deck.gl ScenegraphLayer for placing glTF/GLB models
 * at geographic positions in the scenegraph.
 *
 * @see https://deck.gl/docs/api-reference/mesh-layers/scenegraph-layer
 */
export const ScenegraphModel = defineTrait('ScenegraphModel', {
  /** URL to the 3D model (glTF or GLB format) */
  modelUrl: Schema.String.pipe(
    Schema.annotations({ description: 'URL to glTF/GLB 3D model' })
  ),
  /**
   * Orientation as Euler angles [pitch, yaw, roll] in degrees.
   * - pitch: rotation around X axis
   * - yaw: rotation around Y axis (heading)
   * - roll: rotation around Z axis
   */
  orientation: Schema.optionalWith(
    Schema.Tuple(Schema.Number, Schema.Number, Schema.Number),
    { default: () => [0, 0, 0] as [number, number, number] }
  ),
  /** Scale factor [x, y, z] */
  modelScale: Schema.optionalWith(
    Schema.Tuple(Schema.Number, Schema.Number, Schema.Number),
    { default: () => [1, 1, 1] as [number, number, number] }
  ),
  /** Translation offset [x, y, z] in meters from position */
  translation: Schema.optionalWith(
    Schema.Tuple(Schema.Number, Schema.Number, Schema.Number),
    { default: () => [0, 0, 0] as [number, number, number] }
  ),
  /** Animation name to play (if model has animations) */
  animation: Schema.optionalWith(Schema.String, { default: () => '' }),
  /** Animation speed multiplier */
  animationSpeed: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { default: () => 1 }),
  /** Whether animation should loop */
  animationLoop: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** RGBA color tint [r, g, b, a] 0-255 */
  colorTint: Schema.optionalWith(
    Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number),
    { default: () => [255, 255, 255, 255] as [number, number, number, number] }
  ),
  /** Minimum size in pixels (prevents model from disappearing at far zoom) */
  sizeMinPixels: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { default: () => 0 }),
  /** Maximum size in pixels (prevents model from being too large at close zoom) */
  sizeMaxPixels: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { default: () => Number.MAX_SAFE_INTEGER }),
})
export type ScenegraphModel = typeof ScenegraphModel.Type

/**
 * ScenegraphAnimationState trait - Runtime animation state
 *
 * Tracks current animation state for animated 3D models.
 */
export const ScenegraphAnimationState = defineTrait('ScenegraphAnimationState', {
  /** Current animation time in seconds */
  currentTime: Schema.Number.pipe(Schema.nonNegative()),
  /** Is animation currently playing */
  isPlaying: Schema.Boolean,
  /** Current animation name */
  currentAnimation: Schema.String,
})
export type ScenegraphAnimationState = typeof ScenegraphAnimationState.Type

// =============================================================================
// Classification Traits (GEOINT-specific)
// =============================================================================

/**
 * TrackClassification trait - Intelligence classification
 */
export const TrackClassification = defineTrait('TrackClassification', {
  /** Friend/Foe classification */
  classification: Schema.Literal('friendly', 'hostile', 'neutral', 'unknown'),
  /** Confidence level (0-1) */
  confidence: Schema.Number.pipe(Schema.clamp(0, 1)),
  /** Data source identifier */
  source: Schema.String,
  /** Last updated timestamp */
  updatedAt: Schema.DateFromSelf,
})
export type TrackClassification = typeof TrackClassification.Type

/**
 * ThreatLevel trait - Threat assessment
 */
export const ThreatLevel = defineTrait('ThreatLevel', {
  /** Threat level */
  level: Schema.Literal('critical', 'high', 'medium', 'low', 'none'),
  /** Threat radius in meters */
  radius: Schema.Number.pipe(Schema.nonNegative()),
  /** Assessment source */
  assessedBy: Schema.String,
})
export type ThreatLevel = typeof ThreatLevel.Type

// =============================================================================
// Register All Traits
// =============================================================================

// Geographic traits
registerTrait('GeoPosition' as TraitId, GeoPosition)
registerTrait('GeoHeading' as TraitId, GeoHeading)
registerTrait('GeoVelocity' as TraitId, GeoVelocity)

// Screen space traits
registerTrait('ScreenPosition' as TraitId, ScreenPosition)
registerTrait('NDCPosition' as TraitId, NDCPosition)

// Hierarchy traits
registerTrait('GeoAnchor' as TraitId, GeoAnchor)
registerTrait('GeoScale' as TraitId, GeoScale)

// Layer assignment traits
registerTrait('DeckGLLayer' as TraitId, DeckGLLayer)
registerTrait('R3FOverlay' as TraitId, R3FOverlay)

// Tag traits
registerTrait('NeedsProjection' as TraitId, NeedsProjection, { isTag: true })
registerTrait('InViewport' as TraitId, InViewport, { isTag: true })
registerTrait('IsSelected' as TraitId, IsSelected, { isTag: true })
registerTrait('IsHovered' as TraitId, IsHovered, { isTag: true })
registerTrait('IsAnimated' as TraitId, IsAnimated, { isTag: true })

// Camera behavior
registerTrait('CameraBehavior' as TraitId, CameraBehavior)

// Scenegraph traits
registerTrait('ScenegraphModel' as TraitId, ScenegraphModel)
registerTrait('ScenegraphAnimationState' as TraitId, ScenegraphAnimationState)

// Classification traits
registerTrait('TrackClassification' as TraitId, TrackClassification)
registerTrait('ThreatLevel' as TraitId, ThreatLevel)
