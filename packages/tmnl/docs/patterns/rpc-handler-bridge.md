# Pattern: RPC Handler Bridge (Stream.unwrap)

> Derived from `thoughts/shared/handoffs/kraken-websocket-server/current.md`
> Original date: 2026-02-09

## Problem

`RpcGroup.toLayer()` for `stream: true` RPCs expects handlers returning `Stream<A>`. But handler services return `Effect<Stream<A>>` (because they need to access services to construct the stream). The types don't match.

## Solution

Use `Stream.unwrap()` to convert `Effect<Stream<A>>` into `Stream<A>`:

```typescript
const RealtimeRpcHandlersBridge = Effect.gen(function* () {
  const handlers = yield* RealtimeRpcHandlers

  return {
    'Realtime.SubscribeReadings': (request) =>
      Stream.unwrap(handlers.subscribeReadings(request)),

    'Realtime.SubscribeAlarms': (request) =>
      Stream.unwrap(handlers.subscribeAlarms(request)),

    'Realtime.SubscribeEquipmentState': (request) =>
      Stream.unwrap(handlers.subscribeEquipmentState(request)),

    'Realtime.SubscribeEntityEvents': (request) =>
      Stream.unwrap(handlers.subscribeEntityEvents(request)),

    'Realtime.SubscribeInvalidations': (request) =>
      Stream.unwrap(handlers.subscribeInvalidations(request)),
  }
})
```

## Why This Works

`Stream.unwrap(effect)` takes an `Effect<Stream<A, E, R>>` and returns a `Stream<A, E, R>`. The effect runs when the stream is first consumed, producing the inner stream which then becomes the output. This defers service access to stream consumption time.

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

## Two Layer Variants Pattern

Always export two variants:
1. **Composable** -- requires dependencies (for production composition)
2. **Self-contained** (`*Live`) -- bundles dependencies (for tests)

## See Also

- `src/lib/iiot/realtime/websocket-server.ts` -- Implementation
- `src/lib/iiot/realtime/__tests__/websocket-server.test.ts` -- 10 tests
- `src/lib/iiot/realtime/__tests__/websocket-integration.test.ts` -- 8 tests
