# Kraken WebSocket Server Handoff

## Task
20.2.2 — WebSocket server layer (RpcServer + transport)

## Checkpoints
**Task:** Implement WebSocket server layer using @effect/rpc
**Started:** 2026-02-09T04:00:00Z
**Last Updated:** 2026-02-09T04:02:00Z

### Phase Status
- Phase 1 (Research @effect/rpc API): VALIDATED (API confirmed via runtime inspection + codebase grep)
- Phase 2 (Tests Written): VALIDATED (10 tests, all passing)
- Phase 3 (Implementation): VALIDATED (websocket-server.ts, all tests green)
- Phase 4 (Regression + tsc): VALIDATED (45/45 realtime tests pass, tsc clean)

### Validation State
```json
{
  "test_count": 10,
  "tests_passing": 10,
  "regression_test_count": 45,
  "regression_tests_passing": 45,
  "files_created": [
    "src/lib/iiot/realtime/websocket-server.ts",
    "src/lib/iiot/realtime/__tests__/websocket-server.test.ts"
  ],
  "last_test_command": "bunx vitest run src/lib/iiot/realtime/__tests__/",
  "last_test_exit_code": 0,
  "tsc_exit_code": 0
}
```

## Architecture Decisions

1. **Handler Bridge Pattern**: Created `RealtimeRpcHandlersBridge` Effect that maps the existing `RealtimeRpcHandlers` service methods to the tag-keyed object format expected by `RpcGroup.toLayer()`. This avoids duplicating handler logic.

2. **Stream.unwrap**: Each handler in the bridge uses `Stream.unwrap(handlers.method(request))` to convert `Effect<Stream<A>>` (from the handler service) to `Stream<A>` (expected by RpcGroup for `stream: true` RPCs).

3. **Composition follows SearchRpcServer pattern**: The exact same `pipe(RpcServer.layer(), Layer.provide(handlers), Layer.provideMerge(layerProtocolWebsocketRouter), Layer.provide(RpcSerialization.layerJson))` pattern proven in `/geoint/search`.

4. **Two layer variants**: `IIoTRealtimeWsServer` (composable, requires EventDistribution) and `IIoTRealtimeWsServerLive` (self-contained, bundles EventDistribution for tests).

## Task #4 (20.4.1): WebSocket Integration Tests — COMPLETE

### Phase Status
- Phase 5 (Integration Tests): VALIDATED (8 tests, all passing)
- Phase 6 (Full Regression): VALIDATED (53/53 realtime tests pass, tsc clean)

### Validation State (Final)
```json
{
  "task3_tests": 10,
  "task4_tests": 8,
  "total_realtime_tests": 53,
  "all_passing": true,
  "tsc_exit_code": 0,
  "files_created": [
    "src/lib/iiot/realtime/websocket-server.ts",
    "src/lib/iiot/realtime/__tests__/websocket-server.test.ts",
    "src/lib/iiot/realtime/__tests__/websocket-integration.test.ts"
  ]
}
```

### Key Learnings
- `RpcTest.makeClient(RpcGroup)` creates nested client objects for dotted RPC tag names
  - e.g. `"Realtime.SubscribeReadings"` -> `client.Realtime.SubscribeReadings()`
  - NOT `client['Realtime.SubscribeReadings']()` (this is a single property key)
- `RpcSerialization.layerJson` must be provided for RpcTest to work (encode/decode)
- Tests need `Effect.scoped` before `Effect.provide` when using RpcTest.makeClient
