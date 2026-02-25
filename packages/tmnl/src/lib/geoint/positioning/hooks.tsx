/**
 * GEOINT Positioning Hooks
 *
 * React hooks for integrating the positioning system with components.
 * Uses effect-atom with Atom.runtime for Effect-backed operations.
 *
 * @module geoint/positioning/hooks
 */

import { useCallback, useEffect, createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { Effect, Layer, Scope } from 'effect'
import { Atom, Registry } from '@effect-atom/atom'
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react'
import { KoriWorld, KoriWorldLive, type TraitId } from '@/lib/kori'
import { geointRegistry } from '../atoms'
import { asPanelId, getPanelAtoms } from '../atoms/families'
import {
  GeoPositionService,
  GeoPositionServiceLive,
  type PositionedEntity,
  type SpawnPositionedOptions,
  type QueryPositionedOptions,
} from './GeoPositionService'
import {
  MapProjectionService,
  MapProjectionServiceLive,
  type ViewportState,
  type GeoCoord,
} from './MapProjectionService'
import type { CameraBehavior, ScenegraphModel } from './traits'
import {
  SceneGraphBridge,
  SceneGraphBridgeLive,
  type LayerConfig,
} from './SceneGraphBridge'

// =============================================================================
// Singleton Registry
// =============================================================================

/**
 * Positioning system registry (singleton).
 * Used for atom-based reactive state.
 */
export const positioningRegistry = Registry.make()

// =============================================================================
// Layer Composition (Configurable)
// =============================================================================

/**
 * Core positioning layer without KoriWorld.
 * KoriWorld can be configured via Atom.runtime layer override.
 */
const PositioningLayerCore = Layer.mergeAll(
  MapProjectionServiceLive,
  GeoPositionServiceLive.pipe(Layer.provide(MapProjectionServiceLive)),
  SceneGraphBridgeLive.pipe(
    Layer.provide(MapProjectionServiceLive),
    Layer.provide(GeoPositionServiceLive.pipe(Layer.provide(MapProjectionServiceLive)))
  )
)

/**
 * Default positioning layer with KoriWorldLive.
 * Uses provideMerge to expose KoriWorld in the layer output (needed for scenegraph operations).
 * Override via positioningRuntimeAtom.layer for custom KoriWorld configuration.
 */
const PositioningLayerDefault = PositioningLayerCore.pipe(Layer.provideMerge(KoriWorldLive))

// =============================================================================
// Atom.runtime - Effect-backed Operations
// =============================================================================

/**
 * Positioning runtime atom.
 * Provides Effect services for positioning operations.
 *
 * To configure with a custom KoriWorld:
 * ```typescript
 * <RegistryProvider
 *   initialValues={[
 *     Atom.initialValue(
 *       positioningRuntimeAtom.layer,
 *       PositioningLayerCore.pipe(Layer.provide(myCustomKoriWorld))
 *     )
 *   ]}
 * >
 * ```
 */
export const positioningRuntimeAtom = Atom.runtime(PositioningLayerDefault)

/**
 * Export the core layer for consumers who want to provide custom KoriWorld.
 * Usage: PositioningLayerCore.pipe(Layer.provide(myCustomKoriWorld))
 */
export { PositioningLayerCore }

/**
 * Ensure we have a persistent scope for entity spawning.
 */
const ensurePersistentScope = Effect.gen(function* () {
  // Create a new scope for each operation
  // The runtime manages scope lifecycle
  return yield* Scope.make()
})

// =============================================================================
// Reactivity Keys (for automatic atom invalidation)
// =============================================================================

/**
 * Reactivity keys for positioning system.
 * When mutations invalidate these keys, associated atoms automatically refresh.
 */
export const PositioningReactivityKeys = {
  /** Invalidated when entities are spawned, updated, or destroyed */
  entities: 'positioning:entities',
  /** Invalidated when layer configs are rebuilt */
  layers: 'positioning:layers',
  /** Invalidated when viewport changes */
  viewport: 'positioning:viewport',
} as const

// =============================================================================
// Atoms for Reactive State (with Reactivity integration)
// =============================================================================

/**
 * Current viewport state atom.
 * Refreshes when 'positioning:viewport' key is invalidated.
 */
export const viewportAtom = Atom.make<ViewportState>({
  longitude: -122.4,
  latitude: 37.8,
  zoom: 12,
  pitch: 0,
  bearing: 0,
  width: 800,
  height: 600,
}).pipe(Atom.withReactivity([PositioningReactivityKeys.viewport]))

/**
 * Positioned entities atom.
 * Refreshes when 'positioning:entities' key is invalidated.
 */
export const positionedEntitiesAtom = Atom.make<readonly PositionedEntity[]>([]).pipe(
  Atom.withReactivity([PositioningReactivityKeys.entities])
)

/**
 * Layer configs atom.
 * Refreshes when 'positioning:layers' key is invalidated.
 */
export const layerConfigsAtom = Atom.make<readonly LayerConfig[]>([]).pipe(
  Atom.withReactivity([PositioningReactivityKeys.layers])
)

/**
 * Stats atom.
 * Refreshes when entities or layers change.
 */
export const positioningStatsAtom = Atom.make<{
  entityCount: number
  visibleCount: number
  layerCount: number
  lastUpdateMs: number
}>({
  entityCount: 0,
  visibleCount: 0,
  layerCount: 0,
  lastUpdateMs: 0,
}).pipe(
  Atom.withReactivity([PositioningReactivityKeys.entities, PositioningReactivityKeys.layers])
)

// =============================================================================
// React Context for Registry
// =============================================================================

const PositioningRegistryContext = createContext<Registry.Registry | null>(null)

/**
 * Provider component for positioning system registry.
 * Wrap your map component with this to enable positioning hooks.
 */
export function PositioningProvider({ children }: { children: ReactNode }) {
  return (
    <RegistryContext.Provider value={positioningRegistry}>
      <PositioningRegistryContext.Provider value={positioningRegistry}>
        {children}
      </PositioningRegistryContext.Provider>
    </RegistryContext.Provider>
  )
}

/**
 * Hook to get the positioning registry.
 */
export function usePositioningRegistry(): Registry.Registry {
  const registry = useContext(PositioningRegistryContext)
  if (!registry) {
    throw new Error('usePositioningRegistry must be used within PositioningProvider')
  }
  return registry
}

// =============================================================================
// Operation Atoms (Effect-backed via Atom.runtime)
// =============================================================================

// Input types for operation atoms
interface UpdatePositionInput {
  entityId: string
  position: GeoCoord
}

interface FlyToInput {
  entityId: string
  options?: Partial<CameraBehavior>
  panelId?: string
}

interface FlyToBoundsInput {
  entityIds: readonly string[]
  options?: { padding?: number; maxZoom?: number; transitionDuration?: number }
  panelId?: string
}

/**
 * Spawn a positioned entity.
 * Use via positioningOps.spawn() or useAtomSet(spawnAtom).
 */
export const spawnAtom = positioningRuntimeAtom.fn<SpawnPositionedOptions>()(
  (options) =>
    Effect.gen(function* () {
      const scope = yield* ensurePersistentScope
      const service = yield* GeoPositionService

      const entity = yield* service
        .spawn(options)
        .pipe(Effect.provideService(Scope.Scope, scope))

      // Update atoms via registry (module-level singleton)
      const entities = positioningRegistry.get(positionedEntitiesAtom)
      positioningRegistry.set(positionedEntitiesAtom, [...entities, entity])

      return entity
    }),
  { reactivityKeys: [PositioningReactivityKeys.entities] }
)

/**
 * Spawn multiple entities.
 * Use via positioningOps.spawnBatch() or useAtomSet(spawnBatchAtom).
 */
export const spawnBatchAtom = positioningRuntimeAtom.fn<readonly SpawnPositionedOptions[]>()(
  (options) =>
    Effect.gen(function* () {
      const scope = yield* ensurePersistentScope
      const service = yield* GeoPositionService

      const entities = yield* service
        .spawnBatch(options)
        .pipe(Effect.provideService(Scope.Scope, scope))

      // Update atoms via registry
      const existing = positioningRegistry.get(positionedEntitiesAtom)
      positioningRegistry.set(positionedEntitiesAtom, [...existing, ...entities])

      return entities
    }),
  { reactivityKeys: [PositioningReactivityKeys.entities] }
)

/**
 * Update entity position.
 * Use via positioningOps.updatePosition() or useAtomSet(updatePositionAtom).
 */
export const updatePositionAtom = positioningRuntimeAtom.fn<UpdatePositionInput>()(
  ({ entityId, position }) =>
    Effect.gen(function* () {
      const service = yield* GeoPositionService
      const entity = yield* service.updatePosition(entityId as any, position)

      // Update atoms via registry
      const entities = positioningRegistry.get(positionedEntitiesAtom)
      positioningRegistry.set(
        positionedEntitiesAtom,
        entities.map((e: PositionedEntity) =>
          (e.entityId as string) === entityId ? entity : e
        )
      )

      return entity
    }),
  { reactivityKeys: [PositioningReactivityKeys.entities] }
)

/**
 * Query positioned entities.
 * Use via positioningOps.query() or useAtomSet(queryAtom).
 */
export const queryAtom = positioningRuntimeAtom.fn<QueryPositionedOptions | undefined>()(
  (options) =>
    Effect.gen(function* () {
      const service = yield* GeoPositionService
      return yield* service.query(options)
    })
)

/**
 * Destroy entity.
 * Use via positioningOps.destroy() or useAtomSet(destroyAtom).
 */
export const destroyAtom = positioningRuntimeAtom.fn<string>()(
  (entityId) =>
    Effect.gen(function* () {
      const service = yield* GeoPositionService
      yield* service.destroy(entityId as any)

      // Update atoms via registry
      const entities = positioningRegistry.get(positionedEntitiesAtom)
      positioningRegistry.set(
        positionedEntitiesAtom,
        entities.filter((e: PositionedEntity) => (e.entityId as string) !== entityId)
      )
    }),
  { reactivityKeys: [PositioningReactivityKeys.entities] }
)

// =============================================================================
// Scenegraph Operations
// =============================================================================

/**
 * Input type for spawning a scenegraph entity.
 */
type SpawnScenegraphInput = {
  readonly position: SpawnPositionedOptions
  readonly model: Omit<ScenegraphModel, '_tag'>
}

/**
 * Spawn a positioned entity with a 3D model.
 * Use via positioningOps.spawnScenegraph() or useAtomSet(spawnScenegraphEntityAtom).
 */
export const spawnScenegraphEntityAtom = positioningRuntimeAtom.fn<SpawnScenegraphInput>()(
  ({ position, model }) =>
    Effect.gen(function* () {
      const scope = yield* ensurePersistentScope
      const service = yield* GeoPositionService
      const world = yield* KoriWorld

      // Spawn the positioned entity
      const entity = yield* service
        .spawn(position)
        .pipe(Effect.provideService(Scope.Scope, scope))

      // Set the ScenegraphModel trait
      yield* world.setTrait(entity.entityId, 'ScenegraphModel' as TraitId, model)

      // Update atoms via registry
      const entities = positioningRegistry.get(positionedEntitiesAtom)
      positioningRegistry.set(positionedEntitiesAtom, [...entities, entity])

      return entity
    }),
  { reactivityKeys: [PositioningReactivityKeys.entities] }
)

/**
 * Input type for updating a scenegraph model.
 */
type UpdateScenegraphModelInput = {
  readonly entityId: string
  readonly model: Partial<Omit<ScenegraphModel, '_tag'>>
}

/**
 * Update the 3D model configuration on an existing entity.
 * Use via positioningOps.updateScenegraphModel() or useAtomSet(updateScenegraphModelAtom).
 */
export const updateScenegraphModelAtom = positioningRuntimeAtom.fn<UpdateScenegraphModelInput>()(
  ({ entityId, model }) =>
    Effect.gen(function* () {
      const world = yield* KoriWorld

      // Get current model data
      const currentModel = yield* Effect.catchAll(
        world.getTrait(entityId as any, 'ScenegraphModel' as TraitId),
        () => Effect.succeed(null)
      )

      if (!currentModel) {
        // Set new model trait if it doesn't exist
        yield* world.setTrait(entityId as any, 'ScenegraphModel' as TraitId, model)
      } else {
        // Merge with existing model data
        yield* world.setTrait(entityId as any, 'ScenegraphModel' as TraitId, {
          ...currentModel,
          ...model,
        })
      }
    }),
  { reactivityKeys: [PositioningReactivityKeys.entities] }
)

// =============================================================================
// Map Operations
// =============================================================================

/**
 * Update viewport state.
 * Use via positioningOps.setViewport() or useAtomSet(setViewportAtom).
 */
export const setViewportAtom = positioningRuntimeAtom.fn<ViewportState>()(
  (viewport) =>
    Effect.gen(function* () {
      const projection = yield* MapProjectionService
      yield* projection.setViewport(viewport)

      // Update atom via registry
      positioningRegistry.set(viewportAtom, viewport)

      // Sync projections
      const geo = yield* GeoPositionService
      yield* geo.syncProjections()

      // Rebuild layers
      const bridge = yield* SceneGraphBridge
      const layers = yield* bridge.buildLayers()

      positioningRegistry.set(layerConfigsAtom, layers)
    }),
  { reactivityKeys: [PositioningReactivityKeys.viewport, PositioningReactivityKeys.layers] }
)

/**
 * Rebuild all layers.
 * Use via positioningOps.rebuildLayers() or useAtomSet(rebuildLayersAtom).
 */
export const rebuildLayersAtom = positioningRuntimeAtom.fn<void>()(
  () =>
    Effect.gen(function* () {
      const bridge = yield* SceneGraphBridge
      const layers = yield* bridge.buildLayers()

      positioningRegistry.set(layerConfigsAtom, layers)

      return layers
    }),
  { reactivityKeys: [PositioningReactivityKeys.layers] }
)

/**
 * Sync all projections with current viewport.
 * Use via positioningOps.syncProjections() or useAtomSet(syncProjectionsAtom).
 */
export const syncProjectionsAtom = positioningRuntimeAtom.fn<void>()(
  () =>
    Effect.gen(function* () {
      const service = yield* GeoPositionService
      return yield* service.syncProjections()
    })
)

// ===========================================================================
// Camera Navigation Operation Atoms
// ===========================================================================

/**
 * Default camera behavior for merging with options.
 */
const defaultCameraBehavior: CameraBehavior = {
  _tag: 'CameraBehavior',
  defaultZoom: 14,
  defaultPitch: 0,
  defaultBearing: 0,
  followHeading: false,
  transitionDuration: 1000,
  easing: 'ease-out',
  offset: [0, 0],
  minZoom: 0,
  maxZoom: 22,
}

/**
 * Get target view state for flying to an entity.
 * Use via positioningOps.getCameraTarget() or useAtomSet(getCameraTargetAtom).
 */
export const getCameraTargetAtom = positioningRuntimeAtom.fn<FlyToInput>()(
  ({ entityId, options }) =>
    Effect.gen(function* () {
      const service = yield* GeoPositionService
      const entity = yield* service.get(entityId as any)

      const current = positioningRegistry.get(viewportAtom)
      const behavior = { ...defaultCameraBehavior, ...options }

      // Calculate bearing - follow heading if enabled
      const bearing = behavior.followHeading && entity.heading !== undefined
        ? entity.heading
        : behavior.defaultBearing ?? 0

      return {
        longitude: entity.geo.longitude,
        latitude: entity.geo.latitude,
        zoom: Math.min(
          Math.max(behavior.defaultZoom ?? 14, behavior.minZoom ?? 0),
          behavior.maxZoom ?? 22
        ),
        pitch: behavior.defaultPitch ?? 0,
        bearing,
        width: current.width,
        height: current.height,
      }
    })
)

/**
 * Fly camera to an entity with smooth transition.
 * Use via positioningOps.flyTo() or useAtomSet(flyToAtom).
 */
export const flyToAtom = positioningRuntimeAtom.fn<FlyToInput>()(
  ({ entityId, options, panelId }) =>
    Effect.gen(function* () {
      const service = yield* GeoPositionService
      const projection = yield* MapProjectionService
      const entity = yield* service.get(entityId as any)

      const current = positioningRegistry.get(viewportAtom)
      const behavior = { ...defaultCameraBehavior, ...options }

      const bearing = behavior.followHeading && entity.heading !== undefined
        ? entity.heading
        : behavior.defaultBearing ?? 0

      const targetViewport: ViewportState = {
        longitude: entity.geo.longitude,
        latitude: entity.geo.latitude,
        zoom: Math.min(
          Math.max(behavior.defaultZoom ?? 14, behavior.minZoom ?? 0),
          behavior.maxZoom ?? 22
        ),
        pitch: behavior.defaultPitch ?? 0,
        bearing,
        width: current.width,
        height: current.height,
      }

      // Panel-scoped animation path (if provided)
      if (panelId) {
        const panelAtoms = getPanelAtoms(asPanelId(panelId))
        geointRegistry.set(panelAtoms.isAnimatingAtom, true)
        geointRegistry.set(panelAtoms.flyToTargetAtom, {
          longitude: targetViewport.longitude,
          latitude: targetViewport.latitude,
          zoom: targetViewport.zoom,
          pitch: targetViewport.pitch,
          bearing: targetViewport.bearing,
          transitionDuration: behavior.transitionDuration,
          easing: behavior.easing === 'ease-in-out'
            ? 'ease-in-out'
            : behavior.easing === 'ease-in'
              ? 'ease-in'
              : behavior.easing === 'linear'
                ? 'linear'
                : 'ease-out',
        })
        syncPanelViewport(panelId, targetViewport)
      }

      // Set positioning viewport (this triggers projection sync)
      yield* projection.setViewport(targetViewport)
      positioningRegistry.set(viewportAtom, targetViewport)

      // Sync projections
      yield* service.syncProjections()

      // Rebuild layers
      const bridge = yield* SceneGraphBridge
      const layers = yield* bridge.buildLayers()
      positioningRegistry.set(layerConfigsAtom, layers)

      return targetViewport
    }),
  { reactivityKeys: [PositioningReactivityKeys.viewport, PositioningReactivityKeys.layers] }
)

/**
 * Fly to multiple entities, fitting them all in view.
 * Use via positioningOps.flyToBounds() or useAtomSet(flyToBoundsAtom).
 */
export const flyToBoundsAtom = positioningRuntimeAtom.fn<FlyToBoundsInput>()(
  ({ entityIds, options, panelId }) =>
    Effect.gen(function* () {
      const service = yield* GeoPositionService
      const projection = yield* MapProjectionService

      if (entityIds.length === 0) {
        return positioningRegistry.get(viewportAtom)
      }

      // Collect all entity positions
      let minLon = Infinity
      let maxLon = -Infinity
      let minLat = Infinity
      let maxLat = -Infinity

      for (const id of entityIds) {
        const entity = yield* service.get(id as any)
        minLon = Math.min(minLon, entity.geo.longitude)
        maxLon = Math.max(maxLon, entity.geo.longitude)
        minLat = Math.min(minLat, entity.geo.latitude)
        maxLat = Math.max(maxLat, entity.geo.latitude)
      }

      const current = positioningRegistry.get(viewportAtom)
      const padding = options?.padding ?? 50

      // Calculate center
      const centerLon = (minLon + maxLon) / 2
      const centerLat = (minLat + maxLat) / 2

      // Calculate zoom to fit bounds (approximate)
      const lonDelta = maxLon - minLon
      const latDelta = maxLat - minLat
      const maxDelta = Math.max(lonDelta, latDelta)

      // Account for padding in effective viewport size
      const effectiveWidth = Math.max(current.width - padding * 2, 100)
      const effectiveHeight = Math.max(current.height - padding * 2, 100)
      const paddingFactor = Math.min(effectiveWidth / current.width, effectiveHeight / current.height)

      // Rough zoom calculation (360 degrees at zoom 0), adjusted for padding
      let zoom = Math.floor(Math.log2((360 * paddingFactor) / Math.max(maxDelta, 0.001)))
      zoom = Math.min(zoom, options?.maxZoom ?? 18)
      zoom = Math.max(zoom, 1)

      const targetViewport: ViewportState = {
        longitude: centerLon,
        latitude: centerLat,
        zoom,
        pitch: 0,
        bearing: 0,
        width: current.width,
        height: current.height,
      }

      if (panelId) {
        const panelAtoms = getPanelAtoms(asPanelId(panelId))
        geointRegistry.set(panelAtoms.isAnimatingAtom, true)
        geointRegistry.set(panelAtoms.flyToTargetAtom, {
          longitude: targetViewport.longitude,
          latitude: targetViewport.latitude,
          zoom: targetViewport.zoom,
          pitch: targetViewport.pitch,
          bearing: targetViewport.bearing,
          transitionDuration: options?.transitionDuration,
          easing: 'ease-out',
        })
        syncPanelViewport(panelId, targetViewport)
      }

      yield* projection.setViewport(targetViewport)
      positioningRegistry.set(viewportAtom, targetViewport)

      yield* service.syncProjections()

      const bridge = yield* SceneGraphBridge
      const layers = yield* bridge.buildLayers()
      positioningRegistry.set(layerConfigsAtom, layers)

      return targetViewport
    }),
  { reactivityKeys: [PositioningReactivityKeys.viewport, PositioningReactivityKeys.layers] }
)

// =============================================================================
// positioningOps - Convenience Wrapper (backwards compatible)
// =============================================================================

/**
 * Helper to run an operation atom and return a Promise.
 * Uses the singleton registry for execution.
 */
const runOp = <A, I>(atom: Atom.Writable<any, I>, input: I): Promise<A> => {
  return new Promise((resolve, reject) => {
    positioningRegistry.set(atom, input)
    // Subscribe to the result
    const unsubscribe = positioningRegistry.subscribe(atom, (result) => {
      unsubscribe()
      // Result is a Result<A, E> - handle success/failure
      if (result && typeof result === 'object' && '_tag' in result) {
        if (result._tag === 'Success') {
          resolve((result as any).value)
        } else if (result._tag === 'Failure') {
          reject((result as any).cause)
        } else {
          // Assume success value
          resolve(result as A)
        }
      } else {
        resolve(result as A)
      }
    })
  })
}

/**
 * Positioning operations object.
 * Backwards-compatible wrapper around operation atoms.
 * For new code, prefer using the atoms directly with useAtomSet().
 */
export const positioningOps = {
  /**
   * Spawn a positioned entity.
   */
  spawn: (options: SpawnPositionedOptions): Promise<PositionedEntity> =>
    runOp(spawnAtom, options),

  /**
   * Spawn multiple entities.
   */
  spawnBatch: (options: readonly SpawnPositionedOptions[]): Promise<readonly PositionedEntity[]> =>
    runOp(spawnBatchAtom, options),

  /**
   * Update entity position.
   */
  updatePosition: (entityId: string, position: GeoCoord): Promise<PositionedEntity> =>
    runOp(updatePositionAtom, { entityId, position }),

  /**
   * Query positioned entities.
   */
  query: (options?: QueryPositionedOptions): Promise<readonly PositionedEntity[]> =>
    runOp(queryAtom, options),

  /**
   * Destroy entity.
   */
  destroy: (entityId: string): Promise<void> =>
    runOp(destroyAtom, entityId),

  /**
   * Update viewport state.
   */
  setViewport: (viewport: ViewportState): Promise<void> =>
    runOp(setViewportAtom, viewport),

  /**
   * Rebuild all layers.
   */
  rebuildLayers: (): Promise<readonly LayerConfig[]> =>
    runOp(rebuildLayersAtom, undefined),

  /**
   * Sync all projections with current viewport.
   */
  syncProjections: (): Promise<number> =>
    runOp(syncProjectionsAtom, undefined),

  // Camera Navigation
  getCameraTarget: (entityId: string, options?: Partial<CameraBehavior>): Promise<ViewportState> =>
    runOp(getCameraTargetAtom, { entityId, options }),

  flyTo: (
    entityId: string,
    options?: Partial<CameraBehavior>,
    panelId?: string
  ): Promise<ViewportState> =>
    runOp(flyToAtom, { entityId, options, panelId }),

  flyToBounds: (
    entityIds: readonly string[],
    options?: { padding?: number; maxZoom?: number; transitionDuration?: number },
    panelId?: string
  ): Promise<ViewportState> =>
    runOp(flyToBoundsAtom, { entityIds, options, panelId }),

  /**
   * Spawn a positioned entity with a 3D model.
   */
  spawnScenegraph: (
    position: SpawnPositionedOptions,
    model: Omit<ScenegraphModel, '_tag'>
  ): Promise<PositionedEntity> =>
    runOp(spawnScenegraphEntityAtom, { position, model }),

  /**
   * Update the 3D model configuration on an existing entity.
   */
  updateScenegraphModel: (
    entityId: string,
    model: Partial<Omit<ScenegraphModel, '_tag'>>
  ): Promise<void> =>
    runOp(updateScenegraphModelAtom, { entityId, model }),
}

// =============================================================================
// React Hooks (must be used within PositioningProvider)
// =============================================================================

function syncPanelViewport(panelId: string | undefined, viewport: ViewportState): void {
  if (!panelId) return
  const atoms = getPanelAtoms(asPanelId(panelId))
  geointRegistry.set(atoms.viewportAtom, {
    longitude: viewport.longitude,
    latitude: viewport.latitude,
    zoom: viewport.zoom,
    pitch: viewport.pitch,
    bearing: viewport.bearing,
  })
}

function usePanelViewportState(panelId?: string): {
  longitude: number
  latitude: number
  zoom: number
  pitch: number
  bearing: number
} | null {
  const panelAtoms = useMemo(
    () => (panelId ? getPanelAtoms(asPanelId(panelId)) : null),
    [panelId]
  )

  return useSyncExternalStore(
    (onStoreChange) => {
      if (!panelAtoms) return () => {}
      return geointRegistry.subscribe(panelAtoms.viewportAtom, () => onStoreChange())
    },
    () => (panelAtoms ? geointRegistry.get(panelAtoms.viewportAtom) : null),
    () => (panelAtoms ? geointRegistry.get(panelAtoms.viewportAtom) : null)
  )
}

/**
 * Hook to get the current positioning viewport state.
 *
 * When panelId is provided, longitude/latitude/zoom/pitch/bearing are derived
 * from panel-scoped viewport atoms while width/height remain positioning-owned.
 */
export function useViewport(panelId?: string): ViewportState {
  const positioningViewport = useAtomValue(viewportAtom)
  const panelViewport = usePanelViewportState(panelId)

  if (!panelViewport) return positioningViewport

  return {
    ...positioningViewport,
    longitude: panelViewport.longitude,
    latitude: panelViewport.latitude,
    zoom: panelViewport.zoom,
    pitch: panelViewport.pitch,
    bearing: panelViewport.bearing,
  }
}

/**
 * Hook to get positioned entities.
 */
export function usePositionedEntities(): readonly PositionedEntity[] {
  return useAtomValue(positionedEntitiesAtom)
}

/**
 * Hook to get layer configurations for deck.gl.
 */
export function useLayerConfigs(): readonly LayerConfig[] {
  return useAtomValue(layerConfigsAtom)
}

/**
 * Hook to get positioning stats.
 */
export function usePositioningStats() {
  return useAtomValue(positioningStatsAtom)
}

/**
 * Hook for spawning entities with automatic cleanup.
 */
export function useSpawnEntity() {
  const spawn = useCallback(
    (options: SpawnPositionedOptions) => positioningOps.spawn(options),
    []
  )

  const spawnBatch = useCallback(
    (options: readonly SpawnPositionedOptions[]) => positioningOps.spawnBatch(options),
    []
  )

  return { spawn, spawnBatch }
}

/**
 * Hook for managing viewport with automatic layer updates.
 */
export function usePositioningViewport(initialViewport?: Partial<ViewportState>, panelId?: string) {
  const viewport = useViewport(panelId)

  const setViewport = useCallback(
    (newViewport: ViewportState) => {
      syncPanelViewport(panelId, newViewport)
      return positioningOps.setViewport(newViewport)
    },
    [panelId]
  )

  // Initialize viewport if provided
  useEffect(() => {
    if (initialViewport) {
      const next: ViewportState = {
        longitude: initialViewport.longitude ?? -122.4,
        latitude: initialViewport.latitude ?? 37.8,
        zoom: initialViewport.zoom ?? 12,
        pitch: initialViewport.pitch ?? 0,
        bearing: initialViewport.bearing ?? 0,
        width: initialViewport.width ?? 800,
        height: initialViewport.height ?? 600,
      }
      syncPanelViewport(panelId, next)
      positioningOps.setViewport(next)
    }
  }, [initialViewport, panelId])

  return { viewport, setViewport }
}

/**
 * Hook that syncs viewport changes from deck.gl/mapbox.
 * Call this in your map component's onViewStateChange handler.
 */
export function useViewportSync(panelId?: string) {
  const syncViewport = useCallback(
    (viewState: {
      longitude: number
      latitude: number
      zoom: number
      pitch?: number
      bearing?: number
    }) => {
      const current = positioningRegistry.get(viewportAtom)
      const next: ViewportState = {
        ...current,
        longitude: viewState.longitude,
        latitude: viewState.latitude,
        zoom: viewState.zoom,
        pitch: viewState.pitch ?? current.pitch,
        bearing: viewState.bearing ?? current.bearing,
      }
      syncPanelViewport(panelId, next)
      positioningOps.setViewport(next)
    },
    [panelId]
  )

  const syncDimensions = useCallback((width: number, height: number) => {
    const current = positioningRegistry.get(viewportAtom)
    if (current.width !== width || current.height !== height) {
      const next: ViewportState = { ...current, width, height }
      syncPanelViewport(panelId, next)
      positioningOps.setViewport(next)
    }
  }, [panelId])

  return { syncViewport, syncDimensions }
}

/**
 * Complete hook for integrating positioning with a map component.
 * Returns everything needed to render positioned entities.
 */
export function usePositioningSystem(initialViewport?: Partial<ViewportState>, panelId?: string) {
  const { viewport, setViewport } = usePositioningViewport(initialViewport, panelId)
  const entities = usePositionedEntities()
  const layers = useLayerConfigs()
  const { syncViewport, syncDimensions } = useViewportSync(panelId)
  const { spawn, spawnBatch } = useSpawnEntity()

  return {
    // State
    viewport,
    entities,
    layers,
    // Actions
    setViewport,
    syncViewport,
    syncDimensions,
    spawn,
    spawnBatch,
    updatePosition: positioningOps.updatePosition,
    destroy: positioningOps.destroy,
    rebuildLayers: positioningOps.rebuildLayers,
    query: positioningOps.query,
    // Camera navigation
    flyTo: (entityId: string, options?: Partial<CameraBehavior>) =>
      positioningOps.flyTo(entityId, options, panelId),
    flyToBounds: (
      entityIds: readonly string[],
      options?: { padding?: number; maxZoom?: number; transitionDuration?: number }
    ) => positioningOps.flyToBounds(entityIds, options, panelId),
    getCameraTarget: positioningOps.getCameraTarget,
  }
}
