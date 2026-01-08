/**
 * GeointService - GEOINT Service with reactive atom properties
 *
 * Provides unified access to GEOINT clients with:
 * - FiberMap for subscription lifecycle management
 * - Atom.family for spatial queries with caching
 * - Derived atoms for Deck.gl layer configurations
 *
 * @see .cursor/prd/features.md
 * @module
 */

import { Context, Data, Effect, FiberMap, Layer, Stream } from 'effect'
import {
  IntelClient,
  FeatureClient,
  GeospatialClient,
  activeTracksAtom,
  allTracksAtom,
  layersAtom,
  createFeaturesInBoundsAtom
} from '../clients'
import type { TrackId, BBox } from '../schemas'

// ============================================================================
// Errors
// ============================================================================

export class GeointSubscriptionError extends Data.TaggedError('GeointSubscriptionError')<{
  readonly trackId?: string
  readonly message: string
  readonly cause?: unknown
}> {}

export class GeointQueryError extends Data.TaggedError('GeointQueryError')<{
  readonly operation: string
  readonly message: string
  readonly cause?: unknown
}> {}

export type GeointServiceError = GeointSubscriptionError | GeointQueryError

// ============================================================================
// Service Definition
// ============================================================================

/**
 * GeointService interface
 *
 * Provides reactive access to GEOINT operations with:
 * - Track subscription management via FiberMap
 * - Spatial query caching via Atom.family
 * - Layer management atoms
 */
export interface GeointService {
  /**
   * Active tracks atom - auto-refreshes every 30 seconds
   * Use with useAtomValue() in React components
   */
  readonly activeTracks: typeof activeTracksAtom

  /**
   * All tracks atom - 2 minute TTL
   */
  readonly allTracks: typeof allTracksAtom

  /**
   * Available layers atom - 10 minute TTL
   */
  readonly layers: typeof layersAtom

  /**
   * Factory for creating bounded feature queries
   * Automatically caches by bounds key
   */
  readonly featuresInBounds: (bounds: BBox) => ReturnType<typeof createFeaturesInBoundsAtom>

  /**
   * Subscribe to real-time track position updates
   * Returns a stream of position updates for a specific track
   */
  readonly subscribeTrackPositions: (
    trackId: TrackId
  ) => Stream.Stream<unknown, GeointSubscriptionError>

  /**
   * FiberMap for managing track subscription fibers
   * Automatically removes fibers when they complete
   */
  readonly trackFibers: FiberMap.FiberMap<TrackId, void, GeointSubscriptionError>

  /**
   * Classify a track (mutation with reactivity keys)
   * Automatically invalidates track caches
   */
  readonly classifyTrack: (params: {
    trackId: TrackId
    classification: 'friendly' | 'hostile' | 'neutral' | 'unknown'
    reason?: string
  }) => Effect.Effect<boolean, GeointQueryError>

  /**
   * Get active subscription count
   */
  readonly activeSubscriptionCount: Effect.Effect<number>
}

export const GeointService = Context.GenericTag<GeointService>('geoint/GeointService')

// ============================================================================
// Implementation
// ============================================================================

const make = Effect.gen(function* () {
  // FiberMap for subscription lifecycle
  const trackFibers = yield* FiberMap.make<TrackId, void, GeointSubscriptionError>()

  // Bounds cache for Atom.family pattern
  const boundsCache = new Map<string, ReturnType<typeof createFeaturesInBoundsAtom>>()

  /**
   * Factory for bounded feature queries
   * Uses bounds string key for caching
   */
  const featuresInBounds = (bounds: BBox): ReturnType<typeof createFeaturesInBoundsAtom> => {
    const key = bounds.join(',')
    let atom = boundsCache.get(key)
    if (!atom) {
      atom = createFeaturesInBoundsAtom(bounds)
      boundsCache.set(key, atom)
    }
    return atom
  }

  /**
   * Subscribe to track position updates
   * Wraps IntelClient streaming RPC
   */
  const subscribeTrackPositions = (
    trackId: TrackId
  ): Stream.Stream<unknown, GeointSubscriptionError> =>
    Stream.fail(
      new GeointSubscriptionError({
        trackId,
        message: 'Track position subscription not yet implemented - requires backend'
      })
    )

  /**
   * Classify a track
   * Uses IntelClient mutation with reactivity keys
   */
  const classifyTrack = (params: {
    trackId: TrackId
    classification: 'friendly' | 'hostile' | 'neutral' | 'unknown'
    reason?: string
  }): Effect.Effect<boolean, GeointQueryError> =>
    Effect.fail(
      new GeointQueryError({
        operation: 'classifyTrack',
        message: `Classification for ${params.trackId} not yet implemented - requires backend`
      })
    )

  /**
   * Get active subscription count
   */
  const activeSubscriptionCount = FiberMap.size(trackFibers)

  return {
    // Atom properties (re-exported from clients)
    activeTracks: activeTracksAtom,
    allTracks: allTracksAtom,
    layers: layersAtom,

    // Atom.family for spatial queries
    featuresInBounds,

    // Subscription management
    subscribeTrackPositions,
    trackFibers,

    // Mutations
    classifyTrack,

    // Introspection
    activeSubscriptionCount
  } satisfies GeointService
})

// ============================================================================
// Layer
// ============================================================================

/**
 * GeointService live layer
 * Composes all client layers
 */
export const GeointServiceLive = Layer.scoped(GeointService, make).pipe(
  Layer.provide(IntelClient.layer),
  Layer.provide(FeatureClient.layer),
  Layer.provide(GeospatialClient.layer)
)

/**
 * Default config layer for development
 */
export const GeointServiceDev = GeointServiceLive

export default GeointService
