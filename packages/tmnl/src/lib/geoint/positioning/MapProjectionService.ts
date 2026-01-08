/**
 * MapProjectionService - Effect Service for Geographic Projection
 *
 * Wraps deck.gl's WebMercatorViewport to provide Effect-native
 * coordinate transformations. Manages viewport state and provides
 * batch projection for efficient entity updates.
 *
 * @see .cursor/prd/features.md F001 (Track Visualization)
 * @module geoint/positioning/MapProjectionService
 */

import { Context, Effect, Layer, Ref, Data, Stream, Scope, pipe } from 'effect'
import { WebMercatorViewport } from '@deck.gl/core'

// =============================================================================
// Types
// =============================================================================

/**
 * Viewport state matching deck.gl/mapbox conventions.
 */
export interface ViewportState {
  readonly longitude: number
  readonly latitude: number
  readonly zoom: number
  readonly pitch: number
  readonly bearing: number
  readonly width: number
  readonly height: number
}

/**
 * Geographic coordinate (WGS84).
 */
export interface GeoCoord {
  readonly longitude: number
  readonly latitude: number
  readonly altitude?: number
}

/**
 * Screen coordinate (pixels from top-left).
 */
export interface ScreenCoord {
  readonly x: number
  readonly y: number
  readonly z?: number
}

/**
 * Centered screen coordinate (pixels from center).
 */
export interface CenteredScreenCoord {
  readonly x: number
  readonly y: number
  readonly z?: number
}

/**
 * Normalized Device Coordinate (-1 to 1).
 */
export interface NDCCoord {
  readonly x: number
  readonly y: number
  readonly z?: number
}

/**
 * Projection result with visibility information.
 */
export interface ProjectionResult {
  readonly screen: CenteredScreenCoord
  readonly ndc: NDCCoord
  readonly isVisible: boolean
}

/**
 * Batch projection input.
 */
export interface BatchProjectionInput {
  readonly id: string
  readonly coord: GeoCoord
}

/**
 * Batch projection result.
 */
export interface BatchProjectionResult {
  readonly id: string
  readonly result: ProjectionResult
}

// =============================================================================
// Errors
// =============================================================================

export class MapProjectionError extends Data.TaggedError('MapProjectionError')<{
  readonly operation: 'project' | 'unproject' | 'viewport' | 'batch'
  readonly message: string
  readonly cause?: unknown
}> {}

// =============================================================================
// Service Interface
// =============================================================================

export interface MapProjectionServiceOps {
  /**
   * Get current viewport state.
   */
  readonly getViewport: () => Effect.Effect<ViewportState>

  /**
   * Update viewport state.
   * Triggers re-projection for all subscribed entities.
   */
  readonly setViewport: (state: ViewportState) => Effect.Effect<void>

  /**
   * Project geographic coordinate to screen space.
   */
  readonly project: (coord: GeoCoord) => Effect.Effect<ProjectionResult, MapProjectionError>

  /**
   * Project multiple coordinates in batch (optimized).
   */
  readonly projectBatch: (
    coords: readonly BatchProjectionInput[]
  ) => Effect.Effect<readonly BatchProjectionResult[], MapProjectionError>

  /**
   * Unproject screen coordinate to geographic.
   */
  readonly unproject: (
    screen: ScreenCoord
  ) => Effect.Effect<GeoCoord, MapProjectionError>

  /**
   * Get meters per pixel at a given latitude.
   */
  readonly metersPerPixel: (latitude: number) => Effect.Effect<number>

  /**
   * Check if a coordinate is within the visible viewport.
   */
  readonly isInViewport: (coord: GeoCoord) => Effect.Effect<boolean>

  /**
   * Get the visible bounds as [minLon, minLat, maxLon, maxLat].
   */
  readonly getVisibleBounds: () => Effect.Effect<readonly [number, number, number, number]>

  /**
   * Subscribe to viewport changes.
   * Returns a stream of viewport states.
   */
  readonly onViewportChange: () => Effect.Effect<
    Stream.Stream<ViewportState>,
    never,
    Scope.Scope
  >

  /**
   * Access the underlying WebMercatorViewport (for advanced use).
   */
  readonly getWebMercatorViewport: () => Effect.Effect<WebMercatorViewport>
}

// =============================================================================
// Service Tag
// =============================================================================

export class MapProjectionService extends Context.Tag('geoint/MapProjectionService')<
  MapProjectionService,
  MapProjectionServiceOps
>() {}

// =============================================================================
// Default Viewport
// =============================================================================

const DEFAULT_VIEWPORT: ViewportState = {
  longitude: -122.4,
  latitude: 37.8,
  zoom: 12,
  pitch: 0,
  bearing: 0,
  width: 800,
  height: 600,
}

// =============================================================================
// Implementation
// =============================================================================

export const makeMapProjectionService: Effect.Effect<MapProjectionServiceOps> = Effect.gen(
  function* () {
    // Viewport state reference
    const viewportRef = yield* Ref.make<ViewportState>(DEFAULT_VIEWPORT)

    // Viewport instance cache (recreated on state change)
    const viewportInstanceRef = yield* Ref.make<WebMercatorViewport>(
      new WebMercatorViewport(DEFAULT_VIEWPORT)
    )

    // Subscribers for viewport changes (simple pub/sub)
    const subscribersRef = yield* Ref.make<Set<(v: ViewportState) => void>>(new Set())

    /**
     * Update the viewport instance when state changes.
     */
    const updateViewportInstance = (state: ViewportState) =>
      Ref.set(viewportInstanceRef, new WebMercatorViewport(state))

    /**
     * Notify all subscribers of viewport change.
     */
    const notifySubscribers = (state: ViewportState) =>
      Effect.gen(function* () {
        const subscribers = yield* Ref.get(subscribersRef)
        for (const subscriber of subscribers) {
          subscriber(state)
        }
      })

    // =========================================================================
    // Service Methods
    // =========================================================================

    const getViewport = () => Ref.get(viewportRef)

    const setViewport = (state: ViewportState) =>
      pipe(
        Ref.set(viewportRef, state),
        Effect.tap(() => updateViewportInstance(state)),
        Effect.tap(() => notifySubscribers(state))
      )

    const project = (coord: GeoCoord): Effect.Effect<ProjectionResult, MapProjectionError> =>
      Effect.gen(function* () {
        const viewport = yield* Ref.get(viewportInstanceRef)
        const state = yield* Ref.get(viewportRef)

        try {
          // Project to screen pixels
          const [screenX, screenY] = viewport.project([
            coord.longitude,
            coord.latitude,
            coord.altitude ?? 0,
          ])

          // Convert to centered coordinates (origin at center)
          const centeredX = screenX - state.width / 2
          const centeredY = state.height / 2 - screenY // Flip Y for standard coords

          // Convert to NDC (-1 to 1)
          const ndcX = (screenX / state.width) * 2 - 1
          const ndcY = 1 - (screenY / state.height) * 2

          // Check visibility
          const isVisible =
            screenX >= 0 &&
            screenX <= state.width &&
            screenY >= 0 &&
            screenY <= state.height

          return {
            screen: { x: centeredX, y: centeredY, z: coord.altitude ?? 0 },
            ndc: { x: ndcX, y: ndcY, z: 0.5 },
            isVisible,
          }
        } catch (error) {
          return yield* Effect.fail(
            new MapProjectionError({
              operation: 'project',
              message: `Failed to project coordinate: ${error}`,
              cause: error,
            })
          )
        }
      })

    const projectBatch = (
      coords: readonly BatchProjectionInput[]
    ): Effect.Effect<readonly BatchProjectionResult[], MapProjectionError> =>
      Effect.gen(function* () {
        const viewport = yield* Ref.get(viewportInstanceRef)
        const state = yield* Ref.get(viewportRef)

        try {
          const results: BatchProjectionResult[] = []

          for (const input of coords) {
            const [screenX, screenY] = viewport.project([
              input.coord.longitude,
              input.coord.latitude,
              input.coord.altitude ?? 0,
            ])

            const centeredX = screenX - state.width / 2
            const centeredY = state.height / 2 - screenY
            const ndcX = (screenX / state.width) * 2 - 1
            const ndcY = 1 - (screenY / state.height) * 2
            const isVisible =
              screenX >= 0 &&
              screenX <= state.width &&
              screenY >= 0 &&
              screenY <= state.height

            results.push({
              id: input.id,
              result: {
                screen: { x: centeredX, y: centeredY, z: input.coord.altitude ?? 0 },
                ndc: { x: ndcX, y: ndcY, z: 0.5 },
                isVisible,
              },
            })
          }

          return results
        } catch (error) {
          return yield* Effect.fail(
            new MapProjectionError({
              operation: 'batch',
              message: `Failed to batch project coordinates: ${error}`,
              cause: error,
            })
          )
        }
      })

    const unproject = (screen: ScreenCoord): Effect.Effect<GeoCoord, MapProjectionError> =>
      Effect.gen(function* () {
        const viewport = yield* Ref.get(viewportInstanceRef)

        try {
          const [longitude, latitude] = viewport.unproject([screen.x, screen.y])
          return { longitude, latitude, altitude: screen.z ?? 0 }
        } catch (error) {
          return yield* Effect.fail(
            new MapProjectionError({
              operation: 'unproject',
              message: `Failed to unproject screen coordinate: ${error}`,
              cause: error,
            })
          )
        }
      })

    const metersPerPixel = (latitude: number) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(viewportRef)
        // Standard Web Mercator formula
        const C = 40075016.686 // Earth circumference in meters
        const latRad = (latitude * Math.PI) / 180
        return (C * Math.cos(latRad)) / Math.pow(2, state.zoom + 8)
      })

    const isInViewport = (coord: GeoCoord) =>
      pipe(
        project(coord),
        Effect.map((result) => result.isVisible),
        Effect.catchAll(() => Effect.succeed(false))
      )

    const getVisibleBounds = (): Effect.Effect<readonly [number, number, number, number]> =>
      Effect.gen(function* () {
        const viewport = yield* Ref.get(viewportInstanceRef)
        const state = yield* Ref.get(viewportRef)

        // Get corner coordinates
        const [minLon, maxLat] = viewport.unproject([0, 0])
        const [maxLon, minLat] = viewport.unproject([state.width, state.height])

        return [minLon, minLat, maxLon, maxLat] as const
      })

    const onViewportChange = () =>
      Effect.acquireRelease(
        Effect.sync(() => {
          let emitFn: ((v: ViewportState) => void) | null = null

          const stream = Stream.async<ViewportState>((emit) => {
            emitFn = (v) => emit.single(v)
            // Register subscriber
            Effect.runSync(
              Ref.update(subscribersRef, (set) => {
                set.add(emitFn!)
                return set
              })
            )
          })

          return { stream, emitFn }
        }),
        ({ emitFn }) =>
          Effect.sync(() => {
            if (emitFn) {
              Effect.runSync(
                Ref.update(subscribersRef, (set) => {
                  set.delete(emitFn)
                  return set
                })
              )
            }
          })
      ).pipe(Effect.map(({ stream }) => stream))

    const getWebMercatorViewport = () => Ref.get(viewportInstanceRef)

    return {
      getViewport,
      setViewport,
      project,
      projectBatch,
      unproject,
      metersPerPixel,
      isInViewport,
      getVisibleBounds,
      onViewportChange,
      getWebMercatorViewport,
    }
  }
)

// =============================================================================
// Layer
// =============================================================================

/**
 * MapProjectionService live layer.
 */
export const MapProjectionServiceLive = Layer.effect(
  MapProjectionService,
  makeMapProjectionService
)

export default MapProjectionService
