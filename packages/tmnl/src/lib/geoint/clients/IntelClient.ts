/**
 * IntelClient - AtomRpc.Tag client for track intelligence operations
 *
 * Provides reactive queries and mutations for:
 * - Track retrieval with filtering
 * - Track classification updates
 * - Track position streaming
 *
 * @see .cursor/prd/features.md F001 (Track Visualization)
 * @see .cursor/prd/features.md F005 (Track Classification)
 * @module
 */

import * as AtomRpc from '@effect-atom/atom/AtomRpc'
import { Rpc, RpcGroup, RpcSerialization, RpcSchema } from '@effect/rpc'
import * as RpcClient from '@effect/rpc/RpcClient'
import * as Socket from '@effect/platform/Socket'
import { Layer, Schema, Duration } from 'effect'
import {
  Track,
  TrackId,
  Classification,
  TrackQuery,
  TrackPositionUpdate
} from '../schemas'

// =============================================================================
// RPC Definitions
// =============================================================================

/**
 * Intel RPC group defining track operations
 *
 * Operations:
 * - getTracks: Query tracks with optional filters
 * - classifyTrack: Update track classification
 * - subscribeTrackPositions: Stream position updates for a track
 */
class IntelRpcs extends RpcGroup.make(
  /**
   * Query tracks with optional filtering
   * @see F001 Track Visualization
   */
  Rpc.make('getTracks', {
    payload: TrackQuery,
    success: Schema.Array(Track)
  }),

  /**
   * Update track classification (friend/foe identification)
   * @see F005 Track Classification
   */
  Rpc.make('classifyTrack', {
    payload: Schema.Struct({
      trackId: TrackId,
      classification: Classification,
      reason: Schema.optionalWith(Schema.String, { default: () => '' })
    }),
    success: Schema.Boolean
  }),

  /**
   * Stream position updates for a specific track
   * Returns a stream of TrackPositionUpdate events
   */
  Rpc.make('subscribeTrackPositions', {
    payload: Schema.Struct({
      trackId: TrackId
    }),
    success: RpcSchema.Stream({ success: TrackPositionUpdate, failure: Schema.Never })
  }),

  /**
   * Get a single track by ID
   */
  Rpc.make('getTrack', {
    payload: Schema.Struct({ trackId: TrackId }),
    success: Schema.OptionFromNullOr(Track)
  }),

  /**
   * Get tracks within a bounding box
   */
  Rpc.make('getTracksInBounds', {
    payload: Schema.Struct({
      minLon: Schema.Number,
      minLat: Schema.Number,
      maxLon: Schema.Number,
      maxLat: Schema.Number,
      active: Schema.optionalWith(Schema.Boolean, { default: () => true })
    }),
    success: Schema.Array(Track)
  })
) {}

// =============================================================================
// AtomRpc.Tag Client
// =============================================================================

/**
 * IntelClient - Reactive RPC client for track intelligence operations
 *
 * Features:
 * - Automatic query caching with configurable TTL
 * - Reactivity keys for cache invalidation on mutations
 * - Stream support for real-time position updates
 *
 * @example
 * ```typescript
 * // Query all active tracks
 * const tracksAtom = IntelClient.query('getTracks', { active: true }, {
 *   reactivityKeys: ['tracks'],
 *   timeToLive: Duration.seconds(30)
 * })
 *
 * // Classify a track (invalidates cache)
 * const classifyFn = IntelClient.mutation('classifyTrack')
 * await classifyFn({
 *   payload: { trackId: 'track-001', classification: 'hostile' },
 *   reactivityKeys: ['tracks', 'track-001']
 * })
 * ```
 */
export class IntelClient extends AtomRpc.Tag<IntelClient>()('geoint/IntelClient', {
  group: IntelRpcs,
  protocol: RpcClient.layerProtocolSocket({ retryTransientErrors: true }).pipe(
    Layer.provide(RpcSerialization.layerJson),
    // WebSocket endpoint - will be configured via environment/config
    Layer.provide(Socket.layerWebSocket('ws://localhost:8080/geoint/intel')),
    Layer.provide(Socket.layerWebSocketConstructorGlobal)
  ),
  spanPrefix: 'geoint-intel'
}) {}

// =============================================================================
// Convenience Atoms
// =============================================================================

/**
 * Active tracks query with automatic refresh
 * Invalidated when any track classification changes
 */
export const activeTracksAtom = IntelClient.query(
  'getTracks',
  { active: true },
  {
    reactivityKeys: ['tracks', 'activeTracks'],
    timeToLive: Duration.seconds(30)
  }
)

/**
 * All tracks query (less frequent refresh)
 */
export const allTracksAtom = IntelClient.query(
  'getTracks',
  {},
  {
    reactivityKeys: ['tracks'],
    timeToLive: Duration.minutes(2)
  }
)

/**
 * Classification mutation with reactivity
 */
export const classifyTrackMutation = IntelClient.mutation('classifyTrack')
