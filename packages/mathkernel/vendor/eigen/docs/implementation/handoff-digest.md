# Handoff Digest

> Consolidated reference of all kraken session handoffs. Each entry captures what was built, key decisions, and test coverage.

**Source:** `thoughts/shared/handoffs/*/current.md`
**Last Updated:** 2026-02-09

---

## Phase 1-3: Foundation (Schemas, Entities, State Machines)

### kraken-asset-entities
**Built:** Enterprise, Site, Area Machines + Entities following AlarmMachine/AlarmEntity patterns.
**Files:** 6 machine/entity files + `_helpers.ts` updates.
**Status:** COMPLETE (implementation done, verification pending)

### kraken-asset-machine-device-sensor
**Built:** Graph + Machine tests for MachineAsset, Device, SensorAsset entities (138 graph tests passing).
**Decision:** Machine tests blocked by `@effect/platform` dependency issue (environment, not code).
**Tests:** 138 graph tests PASS, 45 machine tests written but blocked.

### kraken-asset-machine-tests
**Built:** Graph + Machine tests for Plant, Line, WorkCell entities.
**Decision:** Same `@effect/platform` dependency blocker as above.
**Tests:** 136 graph tests PASS, machine tests blocked.

### kraken-asset-status-fix
**Built:** Fixed AssetStatus type mismatch for Enterprise, Site, Area -- replaced generic `AssetStatus` with domain-specific status literals per ISA-95 state graphs.
**Key Change:** Each entity now has its own `XxxStatus = Schema.Literal(...)` instead of sharing generic active/inactive.
**Tests:** 97 schema tests + 872 IIoT tests PASS.

### kraken-status-override
**Built:** Same pattern as asset-status-fix but for Plant, Line, WorkCell -- domain-specific status enums.
**Tests:** 67 tests PASS.

### kraken-entity-primarykey
**Built:** Added `primaryKey` to all 121 RPCs across 14 entity files. Mechanical edit verified by tsc.
**Tests:** tsc clean (121 RPCs verified).

### kraken-property-based-tests
**Built:** Property-based schema tests using `effect` bundled fast-check (`FastCheck` from `effect`).
**Key Discovery:** `Asset.getAutomationLevel()` doesn't handle plant/workcell/device levels -- returns undefined.
**Tests:** 137 property-based tests PASS.

---

## Phase 4: HTTP / RPC Layer

### kraken-auth-middleware
**Built:** IIoT auth middleware with `Redacted` handling for API tokens.
**Files:** `http/middleware/auth.ts`, wired into `api.ts` + `server.ts`.
**Tests:** 10 auth tests + 547 existing tests PASS (1 skipped).

### kraken-ratelimit
**Built:** Token-bucket rate limiting middleware for IIoT HTTP API.
**Files:** `http/middleware/rate-limit.ts`, `IIoTRateLimitDisabledLayer` in server.
**Tests:** 19 tests PASS.

### kraken-rpc-serialization
**Built:** Integration tests for RPC ndjson serialization over HTTP.
**Key Learning:** RPC server uses `HttpLayerRouter` (not `HttpApi`). ndjson protocol is streaming -- POST /rpc hangs by design, use AbortController.
**Tests:** 20 tests PASS, 518 existing PASS.

### kraken-wire-format-encoding
**Built:** Property-based wire format encoding tests for ndjson + Schema serialization.
**Tests:** 51 tests PASS.

### kraken-e2e-server-boot
**Built:** Server boot smoke tests -- health, CORS, OpenAPI, content-type.
**Tests:** 9 tests PASS, 447 suite total.

### kraken-e2e-lifecycle
**Built:** Full entity lifecycle e2e tests (create -> transition -> terminal state).
**Tests:** 6 lifecycle tests PASS.

---

## Phase 5: Sparkplug / Ingestion Pipeline

### kraken-ingestion-adapter
**Built:** MockAdapter for testing -- generates synthetic sensor readings with configurable rate and noise.
**Files:** `adapters/mock-adapter.ts`.
**Tests:** 16 tests PASS (129 total adapter tests).

### kraken-topic-router
**Built:** TopicRouter service mapping UNS topics to DeviceIds.
**Files:** `adapters/device-routing.ts`.
**Tests:** 16 tests PASS.

### kraken-quality-mapping
**Built:** Protocol quality code mapping (Sparkplug quality codes to internal quality enum).
**Files:** `adapters/quality-mapping.ts`.
**Tests:** 51 tests PASS.

### kraken-reading-processor
**Built:** ReadingProcessor batch insert pipeline for sensor readings.
**Files:** `adapters/reading-processor.ts`.
**Tests:** 14 tests PASS.

### kraken-alarm-detection
**Built:** AlarmDetector with threshold detection + deadband logic.
**Files:** `adapters/alarm-detection.ts`.
**Tests:** 18 tests PASS.

### kraken-reconnection-health
**Built:** Reconnection logic + health check for SparkplugAdapter.
**Tests:** 28 tests PASS (4 new + 24 existing).

### kraken-nats-decision-gate
**Built:** Architecture decision document: NATS-Only vs EMQX. **Decision: NATS-Only confirmed.**
**Key Artifacts:** `thoughts/shared/plans/nats-decision-gate-result.md`.
**Status:** Decision complete, spike execution pending NATS MQTT bridge enablement.

### kraken-state-handling
**Built:** STATE message handling (F27.3.3), dynamic route registration per DBIRTH (F27.3.4), E2E Sparkplug tests (F27.5.3).
**Files:** `adapters/sparkplug-adapter.ts` (state-handling + dynamic routing).
**Tests:** 59 tests PASS (24 state + 16 pipeline regression + 19 e2e).

---

## Phase 5: Realtime / WebSocket

### kraken-realtime-rpcs
**Built:** RealtimeRpcs definitions (4 streaming RPCs: SubscribeReadings, SubscribeAlarms, SubscribeEquipmentState, SubscribeInvalidations).
**Tests:** 28 tests written, all PASS.

### kraken-event-dist
**Built:** EventDistribution Service -- PubSub hub with 4 bounded channels via ChannelService.
**Key Pattern:** PubSub.unbounded -> connectStream -> ChannelService inlet -> broadcast outlet -> subscriber streams.
**Tests:** 11 tests PASS.

### kraken-realtime-handlers
**Built:** Realtime RPC handlers with filter + throttle logic.
**Tests:** 19 tests PASS (35 regression).

### kraken-reactivity-bridge
**Built:** ReactivityBridge -- EventLog to EventDistribution adapter.
**Files:** `realtime/reactivity-bridge.ts`.
**Tests:** 5 tests PASS.

### kraken-websocket-server
**Built:** WebSocket server layer using `@effect/rpc` RpcServer + WebSocket transport at `/ws/iiot`.
**Key Pattern:** `RealtimeRpcHandlersBridge` uses `Stream.unwrap()` to convert `Effect<Stream<A>>` to `Stream<A>`.
**Architecture:** Two layer variants -- composable (`IIoTRealtimeWsServer`) and self-contained (`IIoTRealtimeWsServerLive`).
**Tests:** 10 server + 8 integration = 18 tests PASS (53 total realtime).

---

## Phase 5: Holonet Integration

### kraken-holonet tasks (25-30)
**Built:** Complete NATS integration layer:
- IIoT Subjects (typed NATS subject patterns)
- HolonetBridge (NatsPubSubService adapter)
- Dual-publish EventDistribution (local channels + NATS)
- KV STATE registry (JetStream KV for Sparkplug host state)
- Deployment layers (IIoTRealtimeDistributed, IIoTAdapterDistributed)
- Integration tests (full stack verification)
**Tests:** 68 total tests PASS across all Holonet tasks.

---

## UI / Component Library

### kraken-rvn-baseui-migration
**Built:** Migrated 6 RVN primitive components to Base UI wrappers (Button, IconButton, Input, Textarea, Checkbox, Dropdown).
**Tests:** 124 tests PASS.

### kraken-rvn-forms-migration
**Built:** Migrated 4 RVN form components to Base UI (Select, Radio, Switch, Slider).
**Styling:** Preserved brutalist design -- 3px borders, monospace, high contrast.
**Tests:** 66 tests PASS.

### kraken-rvn-layout-migration
**Built:** Migrated Modal + Drawer to Base UI dialog wrappers with compound pattern.
**Tests:** 30 tests PASS.

### kraken-feedback-migration
**Built:** Migrated 5 feedback components to Base UI (Toast, Tooltip, Popover, Alert, ProgressBar).
**Tests:** 41 tests PASS.

### kraken-design-tools
**Built:** Design manipulation tools for Cursor Server (updateStyles, setToken, toggleVariant, setProp, resetProps, getTree, listProps, exportCode, editFile).
**Tests:** 60 tests PASS.

### kraken-jsonrender-block
**Built:** JsonRenderBlock for Terminal v3 -- compound component with schema validation.
**Tests:** 29 tests PASS.

---

## Workflow / Event Sourcing

### kraken-context-handlers
**Task:** WorkOrderContext event handlers (10 events: ContextCreated, ContextUpdated, ContextSnapshotted, AssetAttached, AssetDetached, ResourceAllocated, ResourceReleased, ExternalRefLinked, ExternalRefUnlinked, ChildWorkOrderSpawned).
**Status:** Tests written (12), EventGroup definition in progress.

---

## Test Count Summary

| Phase | Handoffs | Total Tests |
|-------|----------|-------------|
| Foundation (Schemas/Entities) | 7 | ~575 |
| HTTP/RPC | 6 | ~653 |
| Sparkplug/Ingestion | 8 | ~202 |
| Realtime/WebSocket | 5 | ~97 |
| Holonet Integration | 6 | ~68 |
| UI/Components | 6 | ~350 |
| Workflow/ES | 1 | 12 (in progress) |
| **Total** | **39 completed + 1 active** | **~1,957+** |
