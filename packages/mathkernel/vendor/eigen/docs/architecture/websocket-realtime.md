# WebSocket Real-time Architecture

> Consolidated from `thoughts/shared/plans/phase5-websocket-architecture.md`
> Original date: 2026-02-07 | Status: Implemented (Epic 20)

## Overview

Epic 20 adds WebSocket-based real-time subscriptions to the IIoT system. Clients connect via WebSocket and subscribe to channels (alarm events, sensor readings, equipment state changes).

The architecture leverages `RpcServer.layerProtocolWebsocketRouter` combined with an internal PubSub-based event distribution layer (EventDistribution via ChannelService).

## Decision: RPC WebSocket over Raw WebSocket

| Option | Probability | Rationale |
|--------|-------------|-----------|
| **A: RpcServer.layerProtocolWebsocketRouter** | **75% (chosen)** | Type-safe, schema-validated, streaming RPCs, proven in codebase |
| B: Raw Bun WebSocket handlers | 10% | Full control but no schema validation |
| C: Hybrid | 10% | Two protocols to maintain |
| D: Server-Sent Events | 5% | One-directional only |

**Key insight**: Streaming RPCs over WebSocket IS the subscription mechanism. A client calls `Subscribe({ deviceId })` and receives a `Stream<SensorReading>` that stays open until disconnect. No custom subscription protocol needed.

## Architecture

```
Client Layer (Dashboard, Mobile, SCADA/HMI)
    |
    WebSocket /ws/iiot
    |
IIoT WebSocket Server
    RpcServer.layerProtocolWebsocketRouter({ path: '/ws/iiot' })
    + RpcSerialization.layerJson
    |
    RPC Handler Layer (IIoTRealtimeRpcs)
    |
    +-- SubscribeReadings (Stream)
    +-- SubscribeAlarms (Stream)
    +-- SubscribeEquipmentState (Stream)
    +-- SubscribeEntityEvents (Stream)
    +-- SubscribeInvalidations (Stream)
    |
    Internal Event Distribution
    |
    +-- iiot:readings (PubSub, maxLag 10k)
    +-- iiot:alarms (PubSub, maxLag 1k)
    +-- iiot:equipment (PubSub, maxLag 1k)
    +-- iiot:invalidations (PubSub, maxLag 1k)
```

## Streaming RPC Definitions

```typescript
export const SubscribeReadings = Rpc.make('Realtime.SubscribeReadings', {
  payload: Schema.Struct({
    deviceId: Schema.optional(DeviceId),
    plantId: Schema.optional(PlantId),
    throttleMs: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  }),
  success: SensorReading,
  error: RealtimeError,
  stream: true,  // <-- Key: produces Stream<SensorReading>
})
```

## Handler Bridge Pattern

Entity handlers return `Effect<Stream<A>>` but `RpcGroup.toLayer()` expects handlers returning `Stream<A>`. The bridge uses `Stream.unwrap()`:

```typescript
const RealtimeRpcHandlersBridge = Effect.gen(function* () {
  const handlers = yield* RealtimeRpcHandlers
  return {
    'Realtime.SubscribeReadings': (request) =>
      Stream.unwrap(handlers.subscribeReadings(request)),
    'Realtime.SubscribeAlarms': (request) =>
      Stream.unwrap(handlers.subscribeAlarms(request)),
    // ...
  }
})
```

## Layer Composition

```typescript
// Composable variant (requires EventDistribution)
export const IIoTRealtimeWsServer = pipe(
  RpcServer.layer(RealtimeRpcs),
  Layer.provide(RealtimeRpcHandlersBridgeLayer),
  Layer.provideMerge(
    RpcServer.layerProtocolWebsocketRouter({ path: '/ws/iiot' })
  ),
  Layer.provide(RpcSerialization.layerJson),
)

// Self-contained variant (for tests)
export const IIoTRealtimeWsServerLive = IIoTRealtimeWsServer.pipe(
  Layer.provide(EventDistributionLive),
)
```

## Client Reconnection Strategy

- **Stateless subscriptions**: No server-side session tracking
- **Client manages reconnect + re-subscribe**: On disconnect, client reconnects and calls Subscribe RPCs again
- **No message replay**: Missed messages during disconnect are not replayed (real-time only)
