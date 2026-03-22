/**
 * FeatureClient - AtomRpc.Tag client for vector feature operations
 *
 * Provides reactive queries and mutations for:
 * - Spatial feature queries within bounding boxes
 * - Feature layer management
 * - Spatial analysis operations
 *
 * @see .cursor/prd/features.md F002 (Feature Layers)
 * @see .cursor/prd/features.md F006 (Spatial Queries)
 * @module
 */

import * as AtomRpc from '@effect-atom/atom/AtomRpc'
import { Rpc, RpcGroup, RpcSerialization } from '@effect/rpc'
import * as RpcClient from '@effect/rpc/RpcClient'
import * as Socket from '@effect/platform/Socket'
import { Layer, Schema, Duration } from 'effect'
import {
  Feature,
  FeatureId,
  Layer as LayerSchema,
  LayerId,
  FeatureQuery,
  FeatureQueryResponse,
  FeatureCollection,
  BBox,
  SpatialAnalysisRequest
} from '../schemas'

// =============================================================================
// RPC Definitions
// =============================================================================

/**
 * Feature RPC group defining vector feature operations
 *
 * Operations:
 * - queryFeatures: Query features within bounds
 * - getFeature: Get single feature by ID
 * - getLayers: Get all available layers
 * - spatialAnalysis: Perform spatial operations
 */
class FeatureRpcs extends RpcGroup.make(
  /**
   * Query features within a bounding box
   * @see F006 Spatial Queries
   */
  Rpc.make('queryFeatures', {
    payload: FeatureQuery,
    success: FeatureQueryResponse
  }),

  /**
   * Get a single feature by ID
   */
  Rpc.make('getFeature', {
    payload: Schema.Struct({ featureId: FeatureId }),
    success: Schema.OptionFromNullOr(Feature)
  }),

  /**
   * Get all available layers
   * @see F002 Feature Layers
   */
  Rpc.make('getLayers', {
    payload: Schema.Void,
    success: Schema.Array(LayerSchema)
  }),

  /**
   * Get features for a specific layer
   */
  Rpc.make('getLayerFeatures', {
    payload: Schema.Struct({
      layerId: LayerId,
      bounds: Schema.optional(BBox)
    }),
    success: Schema.Array(Feature)
  }),

  /**
   * Perform spatial analysis (buffer, intersection, etc.)
   */
  Rpc.make('spatialAnalysis', {
    payload: SpatialAnalysisRequest,
    success: FeatureCollection
  }),

  /**
   * Get features as GeoJSON FeatureCollection
   */
  Rpc.make('getGeoJson', {
    payload: Schema.Struct({
      layerIds: Schema.Array(LayerId),
      bounds: Schema.optional(BBox)
    }),
    success: FeatureCollection
  })
) {}

// =============================================================================
// AtomRpc.Tag Client
// =============================================================================

/**
 * FeatureClient - Reactive RPC client for vector feature operations
 *
 * Features:
 * - Spatial query caching with bounding box keys
 * - Layer-scoped reactivity for efficient invalidation
 * - 5-minute TTL for spatial queries (configurable)
 *
 * @example
 * ```typescript
 * // Query features in bounds
 * const featuresAtom = FeatureClient.query('queryFeatures', {
 *   bounds: [-122.5, 37.7, -122.4, 37.8],
 *   layers: []
 * }, {
 *   reactivityKeys: ['features', '-122.5,37.7,-122.4,37.8'],
 *   timeToLive: Duration.minutes(5)
 * })
 *
 * // Get all layers
 * const layersAtom = FeatureClient.query('getLayers', undefined, {
 *   reactivityKeys: ['layers'],
 *   timeToLive: Duration.minutes(10)
 * })
 * ```
 */
export class FeatureClient extends AtomRpc.Tag<FeatureClient>()(
  'geoint/FeatureClient',
  {
    group: FeatureRpcs,
    protocol: RpcClient.layerProtocolSocket({ retryTransientErrors: true }).pipe(
      Layer.provide(RpcSerialization.layerJson),
      Layer.provide(Socket.layerWebSocket('ws://localhost:8081/geoint/features')),
      Layer.provide(Socket.layerWebSocketConstructorGlobal)
    ),
    spanPrefix: 'geoint-features'
  }
) {}

// =============================================================================
// Convenience Atoms
// =============================================================================

/**
 * All layers query with long TTL
 */
export const layersAtom = FeatureClient.query('getLayers', undefined, {
  reactivityKeys: ['layers'],
  timeToLive: Duration.minutes(10)
})

/**
 * Factory for creating bounded feature queries
 * Uses Atom.family pattern for efficient caching
 */
export const createFeaturesInBoundsAtom = (bounds: readonly [number, number, number, number]) =>
  FeatureClient.query(
    'queryFeatures',
    { bounds: bounds as [number, number, number, number], layers: [], limit: 1000 },
    {
      reactivityKeys: ['features', bounds.join(',')],
      timeToLive: Duration.minutes(5)
    }
  )
