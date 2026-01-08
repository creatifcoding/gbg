/**
 * GeointService - GEOINT Service with service-provided atoms pattern
 *
 * Uses Effect.Service<>() pattern with:
 * - Atom.family for spatial queries with automatic caching
 * - Derived atoms for Deck.gl layer configurations
 * - FiberMap for subscription lifecycle management
 *
 * @see .cursor/prd/features.md
 * @module
 */

import { Data, Duration, Effect, FiberMap, Stream } from 'effect'
import { Atom, Result } from '@effect-atom/atom'
import type { Layer as DeckLayer } from '@deck.gl/core'
import {
  IntelClient,
  FeatureClient,
  GeospatialClient,
  activeTracksAtom,
  allTracksAtom,
  layersAtom,
} from '../clients'
import type { TrackId, BBox, Track, Feature } from '../schemas'
import {
  createTrackPathLayer,
  createTrackPositionLayer,
  createTrackHeadingLayer,
  createTrackHeatmapLayer,
  createAnimatedTripsLayer,
  createFeatureLayers,
} from '../layers'

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
// Layer Configuration Schema
// ============================================================================

export interface GeointLayerConfig {
  readonly showPaths: boolean
  readonly showPositions: boolean
  readonly showHeadings: boolean
  readonly showHeatmap: boolean
  readonly showTrips: boolean
  readonly animate: boolean
}

const DEFAULT_LAYER_CONFIG: GeointLayerConfig = {
  showPaths: true,
  showPositions: true,
  showHeadings: false,
  showHeatmap: false,
  showTrips: false,
  animate: false,
}

// ============================================================================
// Service Definition
// ============================================================================

export class GeointService extends Effect.Service<GeointService>()('geoint/GeointService', {
  dependencies: [IntelClient.layer, FeatureClient.layer, GeospatialClient.layer],

  scoped: Effect.gen(function* () {
    // FiberMap for subscription lifecycle
    const trackFibers = yield* FiberMap.make<TrackId, void, GeointSubscriptionError>()

    // Configuration atoms
    const layerConfigAtom = Atom.make<GeointLayerConfig>(DEFAULT_LAYER_CONFIG)
    const animationTimeAtom = Atom.make<number>(Date.now())

    // -------------------------------------------------------------------------
    // Atom.family for spatial queries
    // -------------------------------------------------------------------------

    const featuresInBounds = Atom.family((bounds: BBox) =>
      FeatureClient.query(
        'queryFeatures',
        { bounds, layers: [], limit: 1000 },
        {
          reactivityKeys: ['features', bounds.join(',')],
          timeToLive: Duration.minutes(5),
        }
      )
    )

    const tilesInBounds = Atom.family((params: { bounds: BBox; zoom: number }) =>
      GeospatialClient.query(
        'getMapTiles',
        { bounds: params.bounds, zoom: params.zoom },
        {
          reactivityKeys: ['tiles', params.zoom, params.bounds.join(',')],
          timeToLive: Duration.hours(1),
        }
      )
    )

    const trackById = Atom.family((trackId: TrackId) =>
      IntelClient.query(
        'getTrack',
        { trackId },
        {
          reactivityKeys: ['tracks', trackId],
          timeToLive: Duration.minutes(2),
        }
      )
    )

    const tracksInBounds = Atom.family((bounds: BBox) =>
      IntelClient.query(
        'getTracksInBounds',
        {
          minLon: bounds[0],
          minLat: bounds[1],
          maxLon: bounds[2],
          maxLat: bounds[3],
          active: true,
        },
        {
          reactivityKeys: ['tracks', 'bounds', bounds.join(',')],
          timeToLive: Duration.seconds(30),
        }
      )
    )

    // -------------------------------------------------------------------------
    // Derived Deck.gl Layers Atom
    // -------------------------------------------------------------------------

    const deckGlLayers = Atom.make((get): DeckLayer[] => {
      const tracksResult = get(activeTracksAtom)
      const config = get(layerConfigAtom)
      const animTime = get(animationTimeAtom)

      // Extract tracks from Result (return empty if not success)
      const tracks: readonly Track[] = Result.match(tracksResult, {
        onInitial: () => [] as readonly Track[],
        onSuccess: (s) => s.value,
        onFailure: () => [] as readonly Track[],
      })

      const layers: DeckLayer[] = []

      if (config.showPaths) {
        layers.push(
          createTrackPathLayer(tracks, {
            id: 'geoint-derived-paths',
            pickable: true,
          })
        )
      }

      if (config.showPositions) {
        layers.push(
          createTrackPositionLayer(tracks, {
            id: 'geoint-derived-positions',
            pickable: true,
          })
        )
      }

      if (config.showHeadings) {
        layers.push(
          createTrackHeadingLayer(tracks, {
            id: 'geoint-derived-headings',
          })
        )
      }

      if (config.showHeatmap) {
        layers.push(
          createTrackHeatmapLayer(tracks, {
            id: 'geoint-derived-heatmap',
          })
        )
      }

      if (config.showTrips && config.animate) {
        layers.push(
          createAnimatedTripsLayer(tracks, animTime, {
            id: 'geoint-derived-trips',
          })
        )
      }

      return layers
    })

    const combinedLayers = Atom.family((bounds: BBox) =>
      Atom.make((get): DeckLayer[] => {
        const trackLayers = get(deckGlLayers)
        const featuresResult = get(featuresInBounds(bounds))

        const features: Feature[] = Result.match(featuresResult, {
          onInitial: () => [] as Feature[],
          onSuccess: (s) => s.value.features as Feature[],
          onFailure: () => [] as Feature[],
        })

        const featureLayers = createFeatureLayers(features)
        return [...trackLayers, ...featureLayers]
      })
    )

    // -------------------------------------------------------------------------
    // Subscription & Mutations
    // -------------------------------------------------------------------------

    const subscribeTrackPositions = (
      trackId: TrackId
    ): Stream.Stream<unknown, GeointSubscriptionError> =>
      Stream.fail(
        new GeointSubscriptionError({
          trackId,
          message: 'Track position subscription not yet implemented',
        })
      )

    const classifyTrack = (params: {
      trackId: TrackId
      classification: 'friendly' | 'hostile' | 'neutral' | 'unknown'
      reason?: string
    }): Effect.Effect<boolean, GeointQueryError> =>
      Effect.fail(
        new GeointQueryError({
          operation: 'classifyTrack',
          message: `Classification for ${params.trackId} not yet implemented`,
        })
      )

    const activeSubscriptionCount = FiberMap.size(trackFibers)

    // -------------------------------------------------------------------------
    // Service API
    // -------------------------------------------------------------------------

    return {
      // Query atoms
      activeTracks: activeTracksAtom,
      allTracks: allTracksAtom,
      layers: layersAtom,

      // Configuration atoms
      layerConfig: layerConfigAtom,
      animationTime: animationTimeAtom,

      // Atom.family for spatial queries
      featuresInBounds,
      tilesInBounds,
      trackById,
      tracksInBounds,

      // Derived Deck.gl layers
      deckGlLayers,
      combinedLayers,

      // Subscription management
      subscribeTrackPositions,
      trackFibers,

      // Mutations
      classifyTrack,

      // Introspection
      activeSubscriptionCount,
    } as const
  }),
}) {}

// ============================================================================
// Exports
// ============================================================================

export const GeointServiceLive = GeointService.Default

export default GeointService
