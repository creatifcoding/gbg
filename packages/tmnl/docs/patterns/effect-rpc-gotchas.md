# Pattern: Effect RPC Gotchas

> Derived from `thoughts/shared/handoffs/kraken-rpc-serialization/current.md`
> Original date: 2026-02-06

## Key Learnings

### 1. RPC Server Uses HttpLayerRouter, Not HttpApi

The RPC server uses `HttpLayerRouter` (not `HttpApi`). For testing, you must use `HttpLayerRouter.toWebHandler`:

```typescript
const handler = await Effect.runPromise(
  HttpLayerRouter.toWebHandler(myRpcServerLayer)
)
```

### 2. Layer.mergeAll Does NOT Auto-Wire Siblings

`Layer.mergeAll` does NOT automatically wire sibling layer dependencies. You need explicit `Layer.provide`:

```typescript
// WRONG -- siblings don't see each other
const combined = Layer.mergeAll(ServiceA, ServiceB)

// RIGHT -- explicitly provide dependencies
const combined = Layer.mergeAll(ServiceA, ServiceB).pipe(
  Layer.provide(SharedDependency)
)
```

### 3. @effect/rpc NDJSON Protocol Is Streaming

The RPC protocol uses NDJSON (newline-delimited JSON). `POST /rpc` hangs by design because the response stream stays open. For testing, use `AbortController` to terminate requests:

```typescript
const controller = new AbortController()
const response = await fetch('/rpc', {
  method: 'POST',
  body: JSON.stringify(request),
  signal: controller.signal,
})

// Read first response line
const reader = response.body!.getReader()
const { value } = await reader.read()
controller.abort()
```

### 4. RpcTest.makeClient Creates Nested Objects for Dotted Tags

`RpcTest.makeClient(RpcGroup)` creates **nested** property structures for dotted RPC tag names:

```typescript
// Given: Rpc.make("Realtime.SubscribeReadings", { ... })
const client = yield* RpcTest.makeClient(RealtimeRpcs)

// CORRECT -- dot notation (nested object)
client.Realtime.SubscribeReadings(request)

// WRONG -- bracket with full key (single property key)
client['Realtime.SubscribeReadings'](request)
```

### 5. RpcSerialization.layerJson Required for RpcTest

`RpcSerialization.layerJson` must be in the layer composition for `RpcTest.makeClient` to work:

```typescript
const TestLayer = pipe(
  RpcServer.layer(MyRpcs),
  Layer.provide(MyHandlers),
  Layer.provide(RpcSerialization.layerJson),  // Required!
)
```

### 6. Effect.scoped Before Effect.provide for RpcTest

Tests using `RpcTest.makeClient` need `Effect.scoped` before `Effect.provide`:

```typescript
it('works', () =>
  Effect.gen(function* () {
    const client = yield* RpcTest.makeClient(MyRpcs)
    // ... use client
  }).pipe(
    Effect.scoped,          // Before provide!
    Effect.provide(TestLayer),
  )
)
```

## See Also

- `src/lib/iiot/http/__tests__/integration/rpc-serialization.test.ts` -- 20 tests
- `src/lib/iiot/realtime/__tests__/websocket-integration.test.ts` -- 8 tests
