# IIoT Kraken Handoffs

> **Canonical Source**: `thoughts/shared/handoffs/kraken-*/current.md`
> **Consolidated**: 2026-02-09
> **Count**: 29 IIoT implementation session handoffs

Each file is a resumable checkpoint from a kraken agent session, documenting completed work, test results, and next steps.

---

## By Domain Area

### Asset Entity System

| File | Description |
|------|-------------|
| [kraken-asset-entities.md](kraken-asset-entities.md) | Enterprise, Site, Area entity files (Machine + Entity) |
| [kraken-asset-machine-tests.md](kraken-asset-machine-tests.md) | Plant, Line, WorkCell graph + machine tests |
| [kraken-asset-machine-device-sensor.md](kraken-asset-machine-device-sensor.md) | MachineAsset, Device, SensorAsset entity tests |
| [kraken-asset-status-fix.md](kraken-asset-status-fix.md) | AssetStatus type mismatch fix (Enterprise, Site, Area) |
| [kraken-status-override.md](kraken-status-override.md) | AssetStatus type mismatch fix (Plant, Line, WorkCell) |
| [kraken-entity-primarykey.md](kraken-entity-primarykey.md) | primaryKey added to all 14 entity Rpc.make() calls |
| [kraken-property-based-tests.md](kraken-property-based-tests.md) | Property-based schema tests |
| [kraken-context-handlers.md](kraken-context-handlers.md) | WorkOrderContext event handlers (EL-3) |

### Ingestion Pipeline (Phase 5, Epic 19)

| File | Description |
|------|-------------|
| [kraken-ingestion-adapter.md](kraken-ingestion-adapter.md) | MockAdapter for testing (19.1.2) |
| [kraken-topic-router.md](kraken-topic-router.md) | TopicRouter service — UNS topic to DeviceId (19.2.1) |
| [kraken-quality-mapping.md](kraken-quality-mapping.md) | Quality code mapping (19.2.2) |
| [kraken-reading-processor.md](kraken-reading-processor.md) | ReadingProcessor batch insert pipeline (19.3.1) |
| [kraken-alarm-detection.md](kraken-alarm-detection.md) | AlarmDetector threshold + deadband (19.3.2) |
| [kraken-sparkplug-pipeline.md](kraken-sparkplug-pipeline.md) | SparkplugPipelineLayer composition (19.1.3) |

### Realtime / WebSocket (Phase 5, Epics 19-20)

| File | Description |
|------|-------------|
| [kraken-event-dist.md](kraken-event-dist.md) | EventDistribution service (ChannelService broadcast) |
| [kraken-realtime-rpcs.md](kraken-realtime-rpcs.md) | RealtimeRpcs definitions (Subscribe/Unsubscribe) |
| [kraken-realtime-handlers.md](kraken-realtime-handlers.md) | Realtime RPC handlers (filter + throttle) |
| [kraken-websocket-server.md](kraken-websocket-server.md) | WebSocket server layer |
| [kraken-reactivity-bridge.md](kraken-reactivity-bridge.md) | ReactivityBridge (handler-level integration) |

### Holonet / NATS Integration (F27)

| File | Description |
|------|-------------|
| [kraken-nats-decision-gate.md](kraken-nats-decision-gate.md) | Decision gate: NATS-Only vs EMQX (F27.4.5) |
| [kraken-reconnection-health.md](kraken-reconnection-health.md) | Reconnection + health check for SparkplugAdapter (F27.1.3-4) |
| [kraken-state-handling.md](kraken-state-handling.md) | STATE handling + dynamic route registration (F27.3.3-4) |
| [kraken-state-dynamic-route.md](kraken-state-dynamic-route.md) | STATE handling + dynamic route (alternate session) |

### HTTP/RPC Transport (Phase 4)

| File | Description |
|------|-------------|
| [kraken-auth-middleware.md](kraken-auth-middleware.md) | Auth middleware (WBS 17.2.2 + 18.3.3) |
| [kraken-ratelimit.md](kraken-ratelimit.md) | Rate limiting middleware (17.2.3) |
| [kraken-rpc-serialization.md](kraken-rpc-serialization.md) | RPC serialization tests (~20 tests) |
| [kraken-wire-format-encoding.md](kraken-wire-format-encoding.md) | Wire format encoding tests (~44 tests) |

### E2E / Integration

| File | Description |
|------|-------------|
| [kraken-e2e-lifecycle.md](kraken-e2e-lifecycle.md) | Full entity lifecycle E2E tests (6 tests) |
| [kraken-e2e-server-boot.md](kraken-e2e-server-boot.md) | Server boot E2E tests (~8 tests) |
