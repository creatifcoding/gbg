/**
 * IIoT Real-time WebSocket Server
 *
 * Composes the RealtimeRpcs group with WebSocket transport using
 * the proven `RpcServer.layerProtocolWebsocketRouter` pattern
 * (same approach as SearchRpcServer at /geoint/search).
 *
 * Mounts at /ws/iiot on the HttpRouter.
 * Uses JSON serialization for browser compatibility.
 *
 * Architecture:
 * ```
 * WS /ws/iiot
 *   -> RpcServer (RealtimeRpcs group)
 *     -> RealtimeRpcHandlers
 *       -> EventDistribution (ChannelService PubSub hub)
 * ```
 *
 * Integration with main server:
 * ```typescript
 * export const IIoTHttpServerDev = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
 *   // ... existing layers ...
 *   Layer.provide(IIoTRealtimeWsServer),  // add this
 *   // ... rest of layers ...
 * )
 * ```
 *
 * @module @gbg/tmnl/iiot/realtime/websocket-server
 * @see thoughts/shared/plans/phase5-websocket-architecture.md Section 4
 */

import * as RpcServer from '@effect/rpc/RpcServer'
import { RpcSerialization } from '@effect/rpc'
import { Effect, Layer, Stream, pipe } from 'effect'
import {
  RealtimeRpcs,
  SubscribeReadings,
  SubscribeAlarms,
  SubscribeEquipmentState,
  SubscribeInvalidations,
} from '../rpc/RealtimeRpcs'
import {
  RealtimeRpcHandlers,
  RealtimeRpcHandlersLayer,
  RealtimeRpcHandlersLive,
} from './realtime-handlers'
import {
  EventDistribution,
  EventDistributionLive,
} from './event-distribution'

// =============================================================================
// RPC Handler Bridge
// =============================================================================

/**
 * Bridge from RealtimeRpcHandlers service to RpcGroup handler format.
 *
 * RpcGroup.toLayer expects an Effect yielding an object keyed by RPC tag names
 * (e.g. "Realtime.SubscribeReadings") with handler functions.
 *
 * For streaming RPCs (stream: true), each handler receives the request payload
 * and returns a Stream of the success type.
 *
 * This Effect resolves the RealtimeRpcHandlers service and maps its methods
 * to the tag-keyed object that RpcGroup.toLayer expects.
 */
const RealtimeRpcHandlersBridge = Effect.gen(function* () {
  const handlers = yield* RealtimeRpcHandlers

  return {
    [SubscribeReadings._tag]: (
      request: typeof SubscribeReadings.payload.Type
    ) =>
      Stream.unwrap(handlers.subscribeReadings(request)),

    [SubscribeAlarms._tag]: (
      request: typeof SubscribeAlarms.payload.Type
    ) =>
      Stream.unwrap(handlers.subscribeAlarms(request)),

    [SubscribeEquipmentState._tag]: (
      request: typeof SubscribeEquipmentState.payload.Type
    ) =>
      Stream.unwrap(handlers.subscribeEquipmentState(request)),

    [SubscribeInvalidations._tag]: (
      request: typeof SubscribeInvalidations.payload.Type
    ) =>
      Stream.unwrap(handlers.subscribeInvalidations(request)),
  }
})

/**
 * Handler layer: RealtimeRpcs group wired to RealtimeRpcHandlers service.
 *
 * Requires RealtimeRpcHandlers in context.
 */
export const RealtimeRpcGroupHandlersLayer = RealtimeRpcs.toLayer(
  RealtimeRpcHandlersBridge
)

// =============================================================================
// WebSocket Server Layer Variants
// =============================================================================

/**
 * Core RPC server for the RealtimeRpcs group.
 *
 * Requires: RealtimeRpcHandlers (handler implementations)
 */
const RealtimeRpcServerCore = RpcServer.layer(RealtimeRpcs).pipe(
  Layer.provide(RealtimeRpcGroupHandlersLayer),
  Layer.provide(RealtimeRpcHandlersLayer),
)

/**
 * IIoT Real-time WebSocket Server (composable).
 *
 * Mounts at /ws/iiot with JSON serialization.
 * Requires: EventDistribution in context.
 *
 * Use this when EventDistribution is already provided higher up:
 * ```typescript
 * const Server = pipe(
 *   IIoTRealtimeWsServer,
 *   Layer.provide(EventDistributionLive),
 * )
 * ```
 */
export const IIoTRealtimeWsServer = pipe(
  RealtimeRpcServerCore,
  Layer.provideMerge(
    RpcServer.layerProtocolWebsocketRouter({ path: '/ws/iiot' })
  ),
  Layer.provide(RpcSerialization.layerJson),
)

/**
 * IIoT Real-time WebSocket Server (self-contained).
 *
 * Bundles EventDistribution internally. For tests and standalone setups.
 */
export const IIoTRealtimeWsServerLive = pipe(
  IIoTRealtimeWsServer,
  Layer.provide(EventDistributionLive),
)
