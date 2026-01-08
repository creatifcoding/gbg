/**
 * SceneGraphBridge - Connect Kori ECS to deck.gl Layers
 *
 * Effect Service that transforms Kori entity data into deck.gl layer
 * configurations. Maintains reactive updates when entities change.
 *
 * @see .cursor/prd/features.md F001 (Track Visualization)
 * @module geoint/positioning/SceneGraphBridge
 */

import {
  Context,
  Effect,
  Layer,
  Stream,
  Fiber,
  Data,
  pipe,
  Ref,
  Scope,
  Duration,
  PubSub,
  ScopedCache,
} from 'effect'
import type { Layer as DeckLayer } from '@deck.gl/core'
import { ScatterplotLayer, IconLayer, PathLayer, ArcLayer } from '@deck.gl/layers'
import { ScenegraphLayer } from '@deck.gl/mesh-layers'
import { KoriWorld, type EntityId, type TraitId } from '@/lib/kori'
import { GeoPositionService, type PositionedEntity } from './GeoPositionService'
import { MapProjectionService } from './MapProjectionService'
import type {
  DeckGLLayer,
  TrackClassification,
  ScenegraphModel,
} from './traits'

// =============================================================================
// Types
// =============================================================================

/**
 * Layer configuration for a deck.gl layer.
 */
export interface LayerConfig {
  readonly id: string
  readonly type: DeckGLLayer['layerType']
  readonly visible: boolean
  readonly data: readonly unknown[]
  readonly props: Record<string, unknown>
}

/**
 * Classification colors (RGB arrays for deck.gl).
 */
export const CLASSIFICATION_COLORS: Record<
  TrackClassification['classification'],
  [number, number, number]
> = {
  friendly: [0, 200, 83], // Green
  hostile: [255, 82, 82], // Red
  neutral: [255, 193, 7], // Amber
  unknown: [158, 158, 158], // Gray
}

/**
 * Bridge statistics.
 */
export interface BridgeStats {
  readonly layerCount: number
  readonly entityCount: number
  readonly lastUpdateMs: number
}

// =============================================================================
// Errors
// =============================================================================

export class SceneGraphBridgeError extends Data.TaggedError('SceneGraphBridgeError')<{
  readonly operation: 'build' | 'update' | 'sync'
  readonly message: string
  readonly cause?: unknown
}> {}

// =============================================================================
// Service Interface
// =============================================================================

export interface SceneGraphBridgeOps {
  /**
   * Build deck.gl layers from positioned entities.
   * Returns layer configurations that can be passed to DeckGL component.
   */
  readonly buildLayers: () => Effect.Effect<readonly LayerConfig[], SceneGraphBridgeError>

  /**
   * Build deck.gl Layer instances directly.
   * More convenient but less flexible than buildLayers.
   */
  readonly buildDeckLayers: () => Effect.Effect<readonly DeckLayer[], SceneGraphBridgeError>

  /**
   * Subscribe to layer updates.
   * Emits new layer configs whenever entities change.
   */
  readonly onLayerUpdate: () => Effect.Effect<
    Stream.Stream<readonly LayerConfig[]>,
    never,
    Scope.Scope
  >

  /**
   * Force rebuild all layers.
   */
  readonly rebuild: () => Effect.Effect<void, SceneGraphBridgeError>

  /**
   * Get bridge statistics.
   */
  readonly getStats: () => Effect.Effect<BridgeStats>

  /**
   * Start automatic layer rebuilding on entity changes.
   */
  readonly startAutoRebuild: () => Effect.Effect<
    Fiber.RuntimeFiber<void, never>,
    never,
    Scope.Scope
  >
}

// =============================================================================
// Service Tag
// =============================================================================

export class SceneGraphBridge extends Context.Tag('geoint/SceneGraphBridge')<
  SceneGraphBridge,
  SceneGraphBridgeOps
>() {}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Cache key type for layer configs.
 * Using a simple discriminated union to allow future extension.
 */
type LayerCacheKey = 'all'

/**
 * Default TTL for layer cache (100ms).
 * Short TTL allows rapid calls to share computation while still
 * staying responsive to entity changes.
 */
const LAYER_CACHE_TTL = Duration.millis(100)

/**
 * Layer cache capacity (only one entry needed for 'all' key).
 */
const LAYER_CACHE_CAPACITY = 1

export const makeSceneGraphBridge: Effect.Effect<
  SceneGraphBridgeOps,
  never,
  KoriWorld | GeoPositionService | MapProjectionService | Scope.Scope
> = Effect.gen(function* () {
  const world = yield* KoriWorld
  const geoService = yield* GeoPositionService
  // MapProjectionService is required transitively by GeoPositionService
  yield* MapProjectionService

  // Stats
  const statsRef = yield* Ref.make<BridgeStats>({
    layerCount: 0,
    entityCount: 0,
    lastUpdateMs: 0,
  })

  // PubSub for layer update notifications
  // Using sliding(16) backpressure - keeps recent updates, drops oldest if slow consumer
  // This is configurable via Layer composition if different strategy needed
  const layerUpdatePubSub = yield* PubSub.sliding<readonly LayerConfig[]>(16)

  /**
   * Notify subscribers of layer updates via PubSub.
   * Multiple independent subscriber groups can subscribe with different lifecycles.
   */
  const notifySubscribers = (configs: readonly LayerConfig[]) =>
    PubSub.publish(layerUpdatePubSub, configs)

  /**
   * Get classification color for an entity.
   */
  const getClassificationColor = (
    entityId: EntityId
  ): Effect.Effect<[number, number, number]> =>
    pipe(
      world.getTrait(entityId, 'TrackClassification' as TraitId),
      Effect.map((data) => {
        const classification = data as TrackClassification
        return CLASSIFICATION_COLORS[classification.classification]
      }),
      Effect.catchAll(() => Effect.succeed(CLASSIFICATION_COLORS.unknown))
    )

  /**
   * Build scatterplot layer data from positioned entities.
   * Uses Effect.forEach for parallel color lookups.
   */
  const buildScatterplotData = (
    entities: readonly PositionedEntity[]
  ): Effect.Effect<LayerConfig> =>
    Effect.gen(function* () {
      // Filter visible entities first
      const visibleEntities = entities.filter((e) => e.isVisible)

      // Parallel color lookups using Effect.forEach
      const data = yield* Effect.forEach(
        visibleEntities,
        (entity) =>
          Effect.map(getClassificationColor(entity.entityId), (color) => ({
            position: [
              entity.geo.longitude,
              entity.geo.latitude,
              entity.geo.altitude ?? 0,
            ] as [number, number, number],
            color,
            radius: 50, // Base radius in meters
            entityId: entity.entityId as string,
          })),
        { concurrency: 'unbounded' }
      )

      return {
        id: 'positioned-scatterplot',
        type: 'scatterplot' as const,
        visible: true,
        data,
        props: {
          getPosition: (d: (typeof data)[number]) => d.position,
          getRadius: (d: (typeof data)[number]) => d.radius,
          getFillColor: (d: (typeof data)[number]) => [...d.color, 200],
          radiusScale: 1,
          radiusMinPixels: 4,
          radiusMaxPixels: 20,
          pickable: true,
        },
      }
    })

  /**
   * Build icon layer data (heading arrows) from positioned entities.
   * Uses Effect.forEach for parallel color lookups.
   */
  const buildIconData = (
    entities: readonly PositionedEntity[]
  ): Effect.Effect<LayerConfig> =>
    Effect.gen(function* () {
      // Filter visible entities with heading
      const visibleWithHeading = entities.filter(
        (e) => e.isVisible && e.heading !== undefined
      )

      // Parallel color lookups using Effect.forEach
      const data = yield* Effect.forEach(
        visibleWithHeading,
        (entity) =>
          Effect.map(getClassificationColor(entity.entityId), (color) => ({
            position: [
              entity.geo.longitude,
              entity.geo.latitude,
              entity.geo.altitude ?? 0,
            ] as [number, number, number],
            angle: entity.heading!,
            color,
            entityId: entity.entityId as string,
          })),
        { concurrency: 'unbounded' }
      )

      return {
        id: 'positioned-icons',
        type: 'icon' as const,
        visible: true,
        data,
        props: {
          getPosition: (d: (typeof data)[number]) => d.position,
          getAngle: (d: (typeof data)[number]) => d.angle,
          getColor: (d: (typeof data)[number]) => [...d.color, 255],
          getIcon: () => 'arrow',
          iconAtlas:
            'data:image/svg+xml;base64,' +
            btoa(`
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                <polygon points="16,0 32,32 16,24 0,32" fill="white"/>
              </svg>
            `),
          iconMapping: {
            arrow: { x: 0, y: 0, width: 32, height: 32, anchorY: 16 },
          },
          sizeScale: 1,
          sizeMinPixels: 12,
          sizeMaxPixels: 24,
          pickable: true,
        },
      }
    })

  /**
   * Scenegraph entity data for a single instance.
   */
  type ScenegraphEntityData = {
    position: [number, number, number]
    orientation: [number, number, number]
    scale: [number, number, number]
    translation: [number, number, number]
    color: [number, number, number, number]
    entityId: string
  }

  /**
   * Create a stable hash from model URL for layer ID.
   */
  const hashModelUrl = (url: string): string => {
    let hash = 0
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Build scenegraph layers from entities with 3D models.
   * Returns one LayerConfig per unique model URL (deck.gl ScenegraphLayer requirement).
   * Uses Effect.forEach for parallel model/color lookups.
   */
  const buildScenegraphData = (
    entities: readonly PositionedEntity[]
  ): Effect.Effect<readonly LayerConfig[]> =>
    Effect.gen(function* () {
      // Filter visible entities first
      const visibleEntities = entities.filter((e) => e.isVisible)

      // Parallel fetch of model data and colors using Effect.forEach
      const entityResults = yield* Effect.forEach(
        visibleEntities,
        (entity) =>
          Effect.gen(function* () {
            // Check if entity has ScenegraphModel trait
            const modelData = yield* pipe(
              world.getTrait(entity.entityId, 'ScenegraphModel' as TraitId),
              Effect.map((trait) => trait as ScenegraphModel),
              Effect.catchAll(() => Effect.succeed(null))
            )

            if (!modelData) return null

            const color = yield* getClassificationColor(entity.entityId)

            // Spread readonly tuples to mutable arrays for deck.gl compatibility
            const entityData: ScenegraphEntityData & { modelUrl: string } = {
              position: [
                entity.geo.longitude,
                entity.geo.latitude,
                entity.geo.altitude ?? 0,
              ],
              orientation: [...(modelData.orientation ?? [0, 0, 0])] as [number, number, number],
              scale: [...(modelData.modelScale ?? [1, 1, 1])] as [number, number, number],
              translation: [...(modelData.translation ?? [0, 0, 0])] as [number, number, number],
              color: modelData.colorTint
                ? [...modelData.colorTint] as [number, number, number, number]
                : [...color, 255] as [number, number, number, number],
              entityId: entity.entityId as string,
              modelUrl: modelData.modelUrl,
            }

            return entityData
          }),
        { concurrency: 'unbounded' }
      )

      // Group by model URL (synchronous operation on results)
      const modelGroups = new Map<string, ScenegraphEntityData[]>()
      for (const result of entityResults) {
        if (!result) continue
        const { modelUrl, ...entityData } = result
        const group = modelGroups.get(modelUrl) ?? []
        group.push(entityData)
        modelGroups.set(modelUrl, group)
      }

      // Create one LayerConfig per unique model URL
      const layers: LayerConfig[] = []
      for (const [modelUrl, data] of modelGroups) {
        layers.push({
          id: `scenegraph-${hashModelUrl(modelUrl)}`,
          type: 'scenegraph' as const,
          visible: true,
          data,
          props: {
            scenegraph: modelUrl, // One model per layer (deck.gl requirement)
            getPosition: (d: ScenegraphEntityData) => d.position,
            getOrientation: (d: ScenegraphEntityData) => d.orientation,
            getScale: (d: ScenegraphEntityData) => d.scale,
            getTranslation: (d: ScenegraphEntityData) => d.translation,
            getColor: (d: ScenegraphEntityData) => d.color,
            _animations: { '*': { playing: true, speed: 1 } }, // Proper animation config
            _lighting: 'pbr', // PBR lighting for realistic materials
            sizeScale: 1,
            pickable: true,
          },
        })
      }

      return layers
    })

  /**
   * Build path layer from entity history (if available).
   * Uses Effect.forEach for parallel color lookups.
   */
  const buildPathData = (
    entities: readonly PositionedEntity[]
  ): Effect.Effect<LayerConfig> =>
    Effect.gen(function* () {
      // Filter visible entities
      const visibleEntities = entities.filter((e) => e.isVisible)

      // Parallel color lookups using Effect.forEach
      // For now, just show current positions as single-point paths
      // In future, integrate with track history from TrackStore
      const data = yield* Effect.forEach(
        visibleEntities,
        (entity) =>
          Effect.map(getClassificationColor(entity.entityId), (color) => ({
            path: [
              [entity.geo.longitude, entity.geo.latitude, entity.geo.altitude ?? 0],
            ] as [number, number, number][],
            color,
            entityId: entity.entityId as string,
          })),
        { concurrency: 'unbounded' }
      )

      return {
        id: 'positioned-paths',
        type: 'path' as const,
        visible: true,
        data,
        props: {
          getPath: (d: (typeof data)[number]) => d.path,
          getColor: (d: (typeof data)[number]) => [...d.color, 180],
          getWidth: 2,
          widthMinPixels: 1,
          widthMaxPixels: 4,
          capRounded: true,
          jointRounded: true,
          pickable: true,
        },
      }
    })

  // =========================================================================
  // Layer Cache (ScopedCache with TTL)
  // =========================================================================

  /**
   * Inner layer building logic (the actual computation).
   */
  const buildLayersInner = Effect.gen(function* () {
    // Get all positioned entities
    const entities = yield* pipe(
      geoService.query(),
      Effect.mapError(
        (e) =>
          new SceneGraphBridgeError({
            operation: 'build',
            message: `Failed to query entities: ${e.message}`,
            cause: e,
          })
      )
    )

    // Build layer configs in parallel (independent operations)
    const [scatterplot, icons, paths, scenegraphLayers] = yield* Effect.all(
      [
        buildScatterplotData(entities),
        buildIconData(entities),
        buildPathData(entities),
        buildScenegraphData(entities),
      ],
      { concurrency: 'unbounded' }
    )

    const layers = [scatterplot, icons, paths, ...scenegraphLayers].filter((l) => l.data.length > 0)

    return { layers, entityCount: entities.length }
  })

  /**
   * Core layer building logic (the lookup function for ScopedCache).
   * Uses Effect.timed for idiomatic duration measurement.
   */
  const buildLayersCore = (
    _key: LayerCacheKey
  ): Effect.Effect<readonly LayerConfig[], SceneGraphBridgeError, Scope.Scope> =>
    Effect.gen(function* () {
      // Use Effect.timed for idiomatic duration measurement
      const [duration, result] = yield* Effect.timed(buildLayersInner)
      const elapsedMs = Duration.toMillis(duration)

      // Update stats
      yield* Ref.set(statsRef, {
        layerCount: result.layers.length,
        entityCount: result.entityCount,
        lastUpdateMs: elapsedMs,
      })

      return result.layers
    })

  /**
   * ScopedCache for layer configs.
   * - TTL-based automatic invalidation (100ms default)
   * - Manual invalidation via cache.invalidate()
   * - Prevents redundant computation on rapid calls
   */
  const layerCache = yield* ScopedCache.make({
    lookup: buildLayersCore,
    capacity: LAYER_CACHE_CAPACITY,
    timeToLive: LAYER_CACHE_TTL,
  })

  // =========================================================================
  // Service Methods
  // =========================================================================

  /**
   * Build deck.gl layers from positioned entities.
   * Uses ScopedCache for TTL-based caching - rapid calls share computation.
   */
  const buildLayers = (): Effect.Effect<readonly LayerConfig[], SceneGraphBridgeError> =>
    Effect.gen(function* () {
      // Get from cache (will use lookup if expired or missing)
      const layers = yield* Effect.scoped(layerCache.get('all'))

      // Notify subscribers of the (potentially cached) layers
      yield* notifySubscribers(layers)

      return layers
    })

  const buildDeckLayers = (): Effect.Effect<readonly DeckLayer[], SceneGraphBridgeError> =>
    Effect.gen(function* () {
      const configs = yield* buildLayers()
      const layers: DeckLayer[] = []

      for (const config of configs) {
        switch (config.type) {
          case 'scatterplot':
            layers.push(
              new ScatterplotLayer({
                id: config.id,
                data: config.data as unknown[],
                visible: config.visible,
                ...(config.props as object),
              })
            )
            break
          case 'icon':
            layers.push(
              new IconLayer({
                id: config.id,
                data: config.data as unknown[],
                visible: config.visible,
                ...(config.props as object),
              })
            )
            break
          case 'path':
            layers.push(
              new PathLayer({
                id: config.id,
                data: config.data as unknown[],
                visible: config.visible,
                ...(config.props as object),
              })
            )
            break
          case 'arc':
            layers.push(
              new ArcLayer({
                id: config.id,
                data: config.data as unknown[],
                visible: config.visible,
                ...(config.props as object),
              })
            )
            break
          case 'scenegraph':
            layers.push(
              new ScenegraphLayer({
                id: config.id,
                data: config.data as unknown[],
                visible: config.visible,
                ...(config.props as object),
              })
            )
            break
          // Other layer types can be added as needed
        }
      }

      return layers
    })

  const onLayerUpdate = () =>
    Effect.gen(function* () {
      // Subscribe to PubSub - returns a Dequeue that receives published messages
      // Each subscriber group has independent lifecycle and backpressure
      const dequeue = yield* PubSub.subscribe(layerUpdatePubSub)
      // Convert Dequeue to Stream for reactive consumption
      return Stream.fromQueue(dequeue)
    })

  const rebuild = () =>
    Effect.gen(function* () {
      // Invalidate the cache to force re-computation
      yield* layerCache.invalidate('all')
      // Rebuild layers (will trigger fresh lookup)
      yield* buildLayers()
    })

  const getStats = () => Ref.get(statsRef)

  const startAutoRebuild = () =>
    Effect.gen(function* () {
      // Subscribe to entity changes
      const changeStream = yield* geoService.onChange()

      // Rebuild with retry on transient failures (3 attempts with exponential backoff)
      const rebuildWithRetry = pipe(
        rebuild(),
        Effect.retry({ times: 3 }),
        Effect.catchAll(() => Effect.void) // Suppress after retries exhausted
      )

      // Fork supervised fiber for auto-rebuild stream
      const fiber = yield* pipe(
        changeStream,
        Stream.debounce(Duration.millis(50)), // Batch rapid changes
        Stream.runForEach(() => rebuildWithRetry),
        Effect.forkScoped // Fiber lifecycle tied to scope
      )

      return fiber
    })

  return {
    buildLayers,
    buildDeckLayers,
    onLayerUpdate,
    rebuild,
    getStats,
    startAutoRebuild,
  }
})

// =============================================================================
// Layer
// =============================================================================

/**
 * SceneGraphBridge live layer.
 * Uses Layer.scoped to properly manage ScopedCache lifecycle.
 * Requires KoriWorld, GeoPositionService, and MapProjectionService.
 */
export const SceneGraphBridgeLive = Layer.scoped(SceneGraphBridge, makeSceneGraphBridge)

export default SceneGraphBridge
