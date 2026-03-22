/**
 * GeospatialClient - AtomRpc.Tag client for tile and imagery operations
 *
 * Provides reactive queries for:
 * - Map tile retrieval
 * - Satellite imagery streaming
 * - Sensor data access
 *
 * @see .cursor/prd/features.md F003 (Satellite Imagery)
 * @module
 */

import * as AtomRpc from '@effect-atom/atom/AtomRpc'
import { Rpc, RpcGroup, RpcSerialization, RpcSchema } from '@effect/rpc'
import * as RpcClient from '@effect/rpc/RpcClient'
import * as Socket from '@effect/platform/Socket'
import { Layer, Schema, Duration } from 'effect'
import {
  TileRequest,
  TileData,
  ImageryRequest,
  ImageryChunk,
  ImageryMetadata,
  BBox,
  SensorType
} from '../schemas'

// =============================================================================
// RPC Definitions
// =============================================================================

/**
 * Geospatial RPC group defining tile and imagery operations
 *
 * Operations:
 * - getMapTiles: Request tiles for a bounding box
 * - getSatelliteImagery: Stream satellite imagery chunks
 * - getImageryMetadata: Get metadata for available imagery
 */
class GeospatialRpcs extends RpcGroup.make(
  /**
   * Get map tiles for a bounding box and zoom level
   */
  Rpc.make('getMapTiles', {
    payload: TileRequest,
    success: Schema.Array(TileData)
  }),

  /**
   * Stream satellite imagery chunks for a region
   * @see F003 Satellite Imagery
   */
  Rpc.make('getSatelliteImagery', {
    payload: ImageryRequest,
    success: RpcSchema.Stream({ success: ImageryChunk, failure: Schema.Never })
  }),

  /**
   * Get metadata for available imagery in a region
   */
  Rpc.make('getImageryMetadata', {
    payload: Schema.Struct({
      bounds: BBox,
      sensorType: Schema.optional(SensorType)
    }),
    success: Schema.Array(ImageryMetadata)
  }),

  /**
   * Get tile URL for direct loading
   */
  Rpc.make('getTileUrl', {
    payload: Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
      style: Schema.optionalWith(Schema.String, { default: () => 'satellite' })
    }),
    success: Schema.String
  }),

  /**
   * Check tile cache status
   */
  Rpc.make('getTileCacheStatus', {
    payload: Schema.Struct({
      bounds: BBox,
      zoom: Schema.Number
    }),
    success: Schema.Struct({
      totalTiles: Schema.Number,
      cachedTiles: Schema.Number,
      missingTiles: Schema.Number
    })
  }),

  /**
   * Prefetch tiles for offline use
   */
  Rpc.make('prefetchTiles', {
    payload: Schema.Struct({
      bounds: BBox,
      minZoom: Schema.Number,
      maxZoom: Schema.Number
    }),
    success: Schema.Struct({
      queued: Schema.Number,
      estimated: Schema.String
    })
  })
) {}

// =============================================================================
// AtomRpc.Tag Client
// =============================================================================

/**
 * GeospatialClient - Reactive RPC client for tile and imagery operations
 *
 * Features:
 * - Tile caching with configurable TTL
 * - Progressive imagery streaming
 * - Sensor-type filtering
 *
 * @example
 * ```typescript
 * // Get tiles for a region
 * const tilesAtom = GeospatialClient.query('getMapTiles', {
 *   bounds: [-122.5, 37.7, -122.4, 37.8],
 *   zoom: 14
 * }, {
 *   reactivityKeys: ['tiles', 14, '-122.5,37.7'],
 *   timeToLive: Duration.hours(1)
 * })
 *
 * // Stream satellite imagery (pull atom for streaming)
 * const imageryAtom = GeospatialClient.query('getSatelliteImagery', {
 *   bounds: [-122.5, 37.7, -122.4, 37.8],
 *   sensorType: 'optical',
 *   maxCloudCover: 20
 * })
 * ```
 */
export class GeospatialClient extends AtomRpc.Tag<GeospatialClient>()(
  'geoint/GeospatialClient',
  {
    group: GeospatialRpcs,
    protocol: RpcClient.layerProtocolSocket({ retryTransientErrors: true }).pipe(
      Layer.provide(RpcSerialization.layerJson),
      Layer.provide(Socket.layerWebSocket('ws://localhost:8081/geoint/geospatial')),
      Layer.provide(Socket.layerWebSocketConstructorGlobal)
    ),
    spanPrefix: 'geoint-geospatial'
  }
) {}

// =============================================================================
// Convenience Atoms
// =============================================================================

/**
 * Factory for creating tile request atoms
 */
export const createTilesAtom = (
  bounds: readonly [number, number, number, number],
  zoom: number
) =>
  GeospatialClient.query(
    'getMapTiles',
    { bounds: bounds as [number, number, number, number], zoom },
    {
      reactivityKeys: ['tiles', zoom, bounds.join(',')],
      timeToLive: Duration.hours(1)
    }
  )

/**
 * Prefetch tiles mutation
 */
export const prefetchTilesMutation = GeospatialClient.mutation('prefetchTiles')
