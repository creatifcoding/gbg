/**
 * GEOINT Positioning System - Barrel Export
 *
 * Effect-native positioning system for placing entities into the
 * deck.gl scenegraph via Kori ECS. Provides:
 *
 * - Geographic position traits (GeoPosition, GeoHeading, GeoVelocity)
 * - Screen-space projection (ScreenPosition, NDCPosition)
 * - MapProjectionService for coordinate transformations
 * - GeoPositionService for entity lifecycle management
 * - SceneGraphBridge for deck.gl layer generation
 *
 * @example
 * ```typescript
 * import {
 *   GeoPositionService,
 *   MapProjectionService,
 *   SceneGraphBridge,
 *   GeoPositionServiceLive,
 *   MapProjectionServiceLive,
 *   SceneGraphBridgeLive,
 * } from '@/lib/geoint/positioning'
 *
 * // Compose layers
 * const PositioningLive = Layer.mergeAll(
 *   MapProjectionServiceLive,
 *   GeoPositionServiceLive,
 *   SceneGraphBridgeLive,
 * ).pipe(Layer.provide(KoriWorldLive))
 *
 * // Use in Effect program
 * const program = Effect.gen(function* () {
 *   const geo = yield* GeoPositionService
 *   const bridge = yield* SceneGraphBridge
 *
 *   // Spawn positioned entity
 *   const entity = yield* geo.spawn({
 *     position: { longitude: -122.4, latitude: 37.8 },
 *     heading: { heading: 45 },
 *   })
 *
 *   // Build deck.gl layers
 *   const layers = yield* bridge.buildDeckLayers()
 * })
 * ```
 *
 * @module geoint/positioning
 */

// =============================================================================
// Traits
// =============================================================================

export {
  // Geographic position traits
  GeoPosition,
  GeoHeading,
  GeoVelocity,
  // Screen-space traits
  ScreenPosition,
  NDCPosition,
  // Hierarchy traits
  GeoAnchor,
  GeoScale,
  // Layer assignment traits
  DeckGLLayer,
  // Tag traits
  NeedsProjection,
  InViewport,
  IsSelected,
  IsHovered,
  IsAnimated,
  // Classification traits
  TrackClassification,
  // Camera behavior
  CameraBehavior,
  // Note: ThreatLevel is NOT exported here to avoid conflict with geoint/schemas
  // Import directly from positioning/traits if needed
  ThreatLevel as EntityThreatLevel,
  // Types
  type GeoPosition as GeoPositionType,
  type GeoHeading as GeoHeadingType,
  type GeoVelocity as GeoVelocityType,
  type ScreenPosition as ScreenPositionType,
  type NDCPosition as NDCPositionType,
  type GeoAnchor as GeoAnchorType,
  type GeoScale as GeoScaleType,
  type DeckGLLayer as DeckGLLayerType,
  type CameraBehavior as CameraBehaviorType,
  type TrackClassification as TrackClassificationType,
  type ThreatLevel as EntityThreatLevelType,
} from './traits'

// =============================================================================
// MapProjectionService
// =============================================================================

export {
  MapProjectionService,
  MapProjectionServiceLive,
  makeMapProjectionService,
  MapProjectionError,
  // Types
  type MapProjectionServiceOps,
  type ViewportState,
  type GeoCoord,
  type ScreenCoord,
  type CenteredScreenCoord,
  type NDCCoord,
  type ProjectionResult,
  type BatchProjectionInput,
  type BatchProjectionResult,
} from './MapProjectionService'

// =============================================================================
// GeoPositionService
// =============================================================================

export {
  GeoPositionService,
  GeoPositionServiceLive,
  makeGeoPositionService,
  GeoPositionError,
  // Types
  type GeoPositionServiceOps,
  type SpawnPositionedOptions,
  type PositionedEntity,
  type QueryPositionedOptions,
  type BatchPositionUpdate,
} from './GeoPositionService'

// =============================================================================
// SceneGraphBridge
// =============================================================================

export {
  SceneGraphBridge,
  SceneGraphBridgeLive,
  makeSceneGraphBridge,
  SceneGraphBridgeError,
  CLASSIFICATION_COLORS,
  // Types
  type SceneGraphBridgeOps,
  type LayerConfig,
  type BridgeStats,
} from './SceneGraphBridge'

// =============================================================================
// Composed Layers
// =============================================================================

import { Layer } from 'effect'
import { KoriWorldLive } from '@/lib/kori'
import { MapProjectionServiceLive } from './MapProjectionService'
import { GeoPositionServiceLive } from './GeoPositionService'
import { SceneGraphBridgeLive } from './SceneGraphBridge'

/**
 * Complete positioning system layer.
 * Provides MapProjectionService, GeoPositionService, and SceneGraphBridge.
 * Requires KoriWorld (provided by default).
 */
export const PositioningSystemLive = Layer.mergeAll(
  MapProjectionServiceLive,
  GeoPositionServiceLive.pipe(
    Layer.provide(MapProjectionServiceLive)
  ),
  SceneGraphBridgeLive.pipe(
    Layer.provide(MapProjectionServiceLive),
    Layer.provide(GeoPositionServiceLive.pipe(Layer.provide(MapProjectionServiceLive)))
  )
).pipe(Layer.provide(KoriWorldLive))

/**
 * Positioning system layer without KoriWorld (for custom world configuration).
 */
export const PositioningSystemCore = Layer.mergeAll(
  MapProjectionServiceLive,
  GeoPositionServiceLive.pipe(
    Layer.provide(MapProjectionServiceLive)
  ),
  SceneGraphBridgeLive.pipe(
    Layer.provide(MapProjectionServiceLive),
    Layer.provide(GeoPositionServiceLive.pipe(Layer.provide(MapProjectionServiceLive)))
  )
)

// =============================================================================
// React Hooks & Atom.runtime
// =============================================================================

export {
  // Registry & Provider
  positioningRegistry,
  PositioningProvider,
  usePositioningRegistry,
  // Runtime (for custom layer configuration)
  positioningRuntimeAtom,
  PositioningLayerCore,
  // State Atoms
  viewportAtom,
  positionedEntitiesAtom,
  layerConfigsAtom,
  positioningStatsAtom,
  // Operation Atoms (Atom.runtime.fn pattern)
  spawnAtom,
  spawnBatchAtom,
  updatePositionAtom,
  queryAtom,
  destroyAtom,
  setViewportAtom,
  rebuildLayersAtom,
  syncProjectionsAtom,
  getCameraTargetAtom,
  flyToAtom,
  flyToBoundsAtom,
  // Scenegraph Operation Atoms
  spawnScenegraphEntityAtom,
  updateScenegraphModelAtom,
  // Operations (backwards-compatible wrapper)
  positioningOps,
  // Hooks
  useViewport,
  usePositionedEntities,
  useLayerConfigs,
  usePositioningStats,
  useSpawnEntity,
  usePositioningViewport,
  useViewportSync,
  usePositioningSystem,
} from './hooks'
