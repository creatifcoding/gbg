# WBS Progress Tracker — V3 Service Architecture

**Date**: 2026-02-08 (revised)
**Total Story Points**: ~282 SP active (28 Epics, 21 SP banked in Epics 26+28)
**Estimated Duration**: 10-14 sprints (5-7 months)

---

## Progress Legend

| Symbol | Status |
|--------|--------|
| ✅ | Complete |
| 🔄 | In Progress |
| ⏸️ | Blocked |
| ⏳ | Not Started |
| 🎯 | **Next Up** |

---

## Phase 1: Foundation (Sprints 1-2) — 47 SP

### Epic 1: Schema Architecture — 8 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | 1.1.1-3 | Branded identifiers (AssetId, SiteId, DeviceId, PlantId, etc.) |
| ✅ | 1.2.1-3 | Asset schema with TaggedClass |
| ✅ | 1.3.1-3 | Alarm schema with ISA-18.2 states |
| ✅ | 1.4.1-2 | SensorReading with OPC-UA quality |
| ✅ | 1.5.1-2 | Schema barrel exports + JSDoc |

**Epic 1 Status**: ✅ **COMPLETE**

---

### Epic 2: Model Derivation — 13 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | 2.1.1-3 | Common model utilities |
| ✅ | 2.2.1-4 | Asset models (Plant, Line, Machine, Sensor) |
| ✅ | 2.3.1-2 | Alarm models (AlarmModel, AlarmContextModel) |
| ✅ | 2.4.1-2 | Reading models (SensorReading, Aggregated) |
| ✅ | 2.5.1-3 | WorkOrder, EquipmentState, DeviceConfig models |
| ✅ | 2.6.1 | Model barrel exports |

**Epic 2 Status**: ✅ **COMPLETE**

---

### Epic 3: DDL Infrastructure — 13 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | 3.1.1-4 | Infrastructure DDL (extensions: TimescaleDB, AGE) |
| ✅ | 3.2.1-4 | Asset table DDLs |
| ✅ | 3.3.1-3 | Alarm DDLs + graph trigger |
| ✅ | 3.4.1-5 | SensorReading hypertable + aggregates + compression |
| ✅ | 3.5.1-4 | WorkOrder, EquipmentState, DeviceConfig DDLs |
| ✅ | 3.6.1-3 | Migrations aggregation + runner |
| ✅ | 3.7.1 | Migration integration test |

**Epic 3 Status**: ✅ **COMPLETE**

---

### Epic 4: Repository Layer — 13 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | 4.1.1-2 | Decode utilities (decodeFirst, decodeRows, prepareUpdate) |
| ✅ | 4.2.1-4 | Asset repos (Plant, Line, Machine, Sensor) |
| ✅ | 4.3.1-2 | Alarm repos (AlarmRepo, AlarmContextRepo) |
| ✅ | 4.4.1-4 | Reading repos (batch insert, rollup routing) |
| ✅ | 4.5.1-3 | WorkOrder, EquipmentState, DeviceConfig repos |
| ✅ | 4.6.1-2 | AllRepositoriesLive layer + tests |

**Epic 4 Status**: ✅ **COMPLETE**

---

### Epic 5: Error Schemas — 5 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | 5.1.1-2 | Common errors (ValidationError, NotFoundError, ConflictError) |
| ✅ | 5.2.1-4 | Asset errors |
| ✅ | 5.3.1 | Alarm errors |
| ✅ | 5.4.1 | WorkOrder errors |
| ✅ | 5.5.1 | EquipmentState errors |
| ✅ | 5.6.1 | Error barrel exports |

**Epic 5 Status**: ✅ **COMPLETE**

---

### Epic 6: L1 Infrastructure Services — 5 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | 6.1.1-2 | IIoTPgClient configuration |
| ✅ | 6.2.1-2 | TimeSeriesClient (NOT ES) |
| ✅ | 6.3.1-3 | GraphClient (NOT ES) |
| ✅ | 6.4.1 | L1 layer composition |

**Epic 6 Status**: ✅ **COMPLETE**

---

## Phase 2: Event Sourcing Boundaries (Sprints 3-6) — 76 SP

### Epic 7: ES Infrastructure — 21 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | EL-1.1 | Pin `@effect/experimental` version |
| ✅ | EL-1.2 | `IIoTEventLogFacade` service |
| ✅ | EL-1.3-4 | `iiot_event_journal` + `iiot_event_remotes` DDL |
| ✅ | EL-1.5 | Migration `0021_event_journal_schema` |
| ✅ | EL-1.6 | `IIoTEventLogConfig` context tag |
| ✅ | EL-1.7 | `IIoTSqlEventJournalLayer` |
| ✅ | EL-1.8 | `IIoTEventLogTest` (in-memory) |
| ✅ | EL-1.9 | `IIoTIdentityLayer` (persisted via DB) |
| ✅ | EL-1.10 | `IIoTEventLogStackLayer` (combined) |
| ✅ | EL-1.11-12 | Event base schemas + `Event.make` wrapper |
| ✅ | EL-1.13 | Integration test: write/read events |
| ✅ | **CRDT Gaps** | Conflict indexes, identity persistence, simpleCompact |

**Epic 7 Status**: ✅ **COMPLETE** (14 tests pass)

---

### Epic 8: Alarm Domain ES Migration — 21 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | EL-2.1 | Feature flag `ES_ALARM_ENABLED` |
| ✅ | EL-2.2-7 | Define 10 alarm event schemas |
| ✅ | EL-2.8 | Create `AlarmEvents` EventGroup |
| ✅ | EL-2.9 | `AlarmEventHandlers` (EventLog.group) |
| ✅ | EL-2.10-13 | Handler for each event type |
| ✅ | EL-2.14-17 | Refactor AlarmService methods |
| ✅ | EL-2.18 | `AlarmReactivity` bindings |
| ✅ | EL-2.19 | `getAlarmAtTime` temporal query |
| ✅ | EL-2.20 | `getAlarmHistory` |
| ✅ | EL-2.21 | Integration tests |

**Epic 8 Status**: ✅ **COMPLETE** (23 integration tests pass)

---

### Epic 9: Work Order Domain — 34 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | EL-3.1-2 | WorkOrder lifecycle events (11) |
| ✅ | EL-3.3-4 | WorkOrderContext events (10) |
| ✅ | EL-3.5-6 | TaskInstance events (9) |
| ✅ | EL-3.7-8 | ApprovalRequest events (6) |
| ✅ | EL-3.9-10 | L3SyncOperation events (5) |
| ✅ | EL-3.11-12 | WorkflowDefinition events (5) |
| ✅ | EL-3.13 | Combined `IIoTEventLogSchema` |
| ✅ | EL-3.14-19 | Handlers for each aggregate |
| ✅ | EL-3.20-22 | Context snapshot/resolve/update |
| ✅ | EL-3.23-24 | Integration tests |

**Epic 9 Status**: ✅ **COMPLETE** (14 integration tests pass, 173 event schema tests pass)

**Work Order Event Aggregates (46 Events)**:
| Aggregate | Events |
|-----------|--------|
| WorkOrder Lifecycle | 11 events |
| WorkOrderContext | 10 events |
| TaskInstance | 9 events |
| ApprovalRequest | 6 events |
| L3SyncOperation | 5 events |
| WorkflowDefinition | 5 events |

---

### Epic 10: Equipment State Domain — 21 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | EL-4.1-4 | Define 6 equipment state events |
| ✅ | EL-4.5 | State machine validation |
| ✅ | EL-4.6-8 | Handlers + reactivity |
| ✅ | EL-4.9-11 | Temporal queries + OEE calculation |
| ✅ | EL-4.12 | Integration tests |

**Epic 10 Status**: ✅ **COMPLETE** (15 integration tests pass)

---

### Epic 11: Non-ES Domain Validation — 3 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | 11.1.1-4 | TimeSeriesClient audit (NOT ES) |
| ✅ | 11.2.1-4 | GraphClient audit (NOT ES) |
| ✅ | 11.3.1-8 | DeviceConfig CRUD + audit log |

**Epic 11 Status**: ✅ **COMPLETE**

---

### Epic 12: ES Integration & Testing — 13 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | 12.1.1-5 | Cross-domain integration tests |
| ✅ | 12.2.1-3 | Temporal query tests |
| ✅ | 12.3.1-3 | Compliance tests (ISA-18.2, immutability) |
| ✅ | 12.4.1-3 | Performance benchmarks |

**Epic 12 Status**: ✅ **COMPLETE** (60 compliance tests, 17 benchmarks pass)

---

## Phase 2.5: Regulatory Compliance (Sprint 7) — 13 SP

### Epic 25: Regulatory Compliance — 13 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | EL-5.1-5 | Batch Records events (FDA 21 CFR Part 11) |
| ✅ | EL-5.6-9 | Quality Events (ISO 9001) |
| ✅ | EL-5.10-13 | Operator Actions (audit trail) |
| ✅ | EL-5.14 | Add all groups to schema |
| ✅ | EL-5.15-16 | Compliance integration tests |

**Epic 25 Status**: ✅ **COMPLETE** (64 regulatory event tests pass)

**Regulatory Event Groups (13 Events)**:
| Group | Events | Compliance |
|-------|--------|------------|
| BatchEvents | 5 | FDA 21 CFR Part 11 |
| QualityEvents | 4 | ISO 9001 |
| OperatorEvents | 4 | Audit Trail |

---

## Phase 3: Entity & Service Layer (Sprints 8-9) — 42 SP

### Epic 13: Entity Definitions — 13 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | 13.1.1 | AssetEntity.ts |
| ✅ | 13.1.2 | AlarmEntity.ts |
| ✅ | 13.1.3 | SensorEntity.ts |
| ✅ | 13.2.1 | WorkOrderEntity.ts |
| ✅ | 13.2.2 | EquipmentStateEntity.ts |

**Epic 13 Status**: ✅ **COMPLETE**

---

### Epic 14: State Services (PORTS) — 13 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | 14.1.1-2 | StateShape.ts (port interfaces) |
| ✅ | 14.1.3-4 | AlarmState + InMemory + SQL factory |
| ✅ | 14.2.1-2 | WorkOrderState + InMemory + SQL factory |
| ✅ | 14.3.1-2 | EquipmentStateService + InMemory + SQL factory |
| ✅ | 14.4.1 | AllStateServicesInMemory layer |

**Epic 14 Status**: ✅ **COMPLETE**

---

### Epic 15: Event Handlers — 8 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | 15.1.1 | alarm-handlers.ts |
| ✅ | 15.1.2 | work-order-handlers.ts |
| ✅ | 15.1.3 | equipment-handlers.ts |
| ✅ | 15.2.1-2 | Reactivity bindings (alarm, work-order, equipment) |

**Epic 15 Status**: ✅ **COMPLETE**

---

### Epic 16: Entity Handlers (Hexagonal Architecture) — 8 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | 16.1.1 | WorkOrderEntityHandlers with port injection |
| ✅ | 16.1.2 | AlarmEntityHandlers with port injection |
| ✅ | 16.1.3 | EquipmentStateEntityHandlers with port injection |
| ✅ | 16.2.1 | EntityStack.ts layer composition |
| ✅ | 16.2.2 | _helpers.ts with maybeEmit functions |
| ✅ | 16.2.3 | entity/index.ts exports |
| ✅ | 16.2.4 | TypeScript verification |

**Epic 16 Status**: ✅ **COMPLETE**

**Architecture Summary**:
- Entity handlers inject state services via `yield* StateService`
- `EntityTestingStack` — InMemory adapters, events disabled
- `EntityProductionHandlersWithEvents` — Events enabled, requires SQL layers
- All handlers use `state.create()` for DB-generated IDs

---

## Phase 4: RPC & HTTP Layer (Sprints 10-11) — 26 SP

### Epic 17: RPC Handler Layer — 13 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | 17.1.1-5 | RPC proxy definitions — all 16 groups, 121+ RPCs across 13 entities |
| ✅ | 17.2.1 | IIoTRpcs composition group (16 sub-groups combined) |
| ✅ | 17.2.1b | WorkOrder + EquipmentState + all 13 entity RPC group files |
| ✅ | 17.2.2 | Auth middleware (RPC-level) — HttpApiMiddleware.Tag + jose JWT |
| ✅ | 17.2.3 | Rate limiting middleware — token bucket via Effect.Ref |
| ✅ | 17.3.1 | RPC integration tests (50+ tests via RpcTest.makeClient + HTTP) |

**Epic 17 Status**: ✅ **COMPLETE**

---

### Epic 18: HTTP API Layer — 13 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | 18.1.1 | rpc-server.ts — RpcServer.layer(IIoTRpcs) + EntityRpcHandlers |
| ✅ | 18.1.2 | RpcServer.layerProtocolHttpRouter at /rpc |
| ✅ | 18.1.3 | RpcSerialization (ndjson + msgpack) |
| ✅ | 18.1.4 | HttpApiBuilder.serve() composition in server.ts |
| ✅ | 18.1.5 | BunHttpServer boot layer (IIoTHttpServerDev) |
| ✅ | 18.2.1 | OpenAPI generation via HttpApi annotations |
| ✅ | 18.2.2 | Swagger UI at /docs (HttpApiSwagger.layer) |
| ✅ | 18.3.1 | CORS middleware (HttpApiBuilder.middlewareCors) |
| ✅ | 18.3.2 | Request logging middleware (HttpMiddleware.logger) |
| ✅ | 18.3.3 | Auth middleware (HTTP-level) — IIoTAuthBearerLayer + IIoTAuthDisabledLayer |
| ✅ | 18.4.1 | IIoTHttpServerDev composition (REST + RPC + Swagger + CORS) |
| ✅ | 18.4.2 | HTTP integration tests (518 tests: unit, property, integration, contract, E2E) |

**Epic 18 Status**: ✅ **COMPLETE** (549 tests: 10 auth + 21 rate-limit + 518 existing, 17 test files)

---

## Phase 5: Stream Processing & Real-time (Sprints 12-15) — 36 SP (was 55, -19 SP via NATS-only)

### Epic 19: Stream Processing & Ingestion Pipeline — 13 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | 19.1.1 | IngestionAdapter service interface + IngestedReading schema + error types |
| ✅ | 19.1.2 | MockAdapter (synthetic readings for testing) |
| ✅ | 19.1.3 | SparkplugAdapter (uses @selfcharters/sparkplug-client) — STATE handling, dynamic routes, E2E tests |
| ✅ | 19.1.4 | OpcUaAdapter / ModbusAdapter stubs — completed (F27.6) |
| ✅ | 19.2.1 | TopicRouter service (UNS topic -> DeviceId routing) |
| ✅ | 19.2.2 | Quality code mapping (OPC-UA, Sparkplug, Modbus -> OpcUaQuality) |
| ✅ | 19.3.1 | ReadingProcessor (Stream.groupedWithin batch insert) |
| ✅ | 19.3.2 | AlarmDetector (threshold detection + deadband) |
| ✅ | 19.3.3 | IngestionService orchestrator (adapters + pipeline composition) |
| ✅ | 19.4.1 | Integration tests (MockAdapter -> pipeline -> verify) |

**Epic 19 Status**: ✅ **COMPLETE** — 10/10 tasks ✅ (212+ adapter pipeline tests)

---

### Epic 26: EMQX Broker Infrastructure — 13 SP 🏦 BANKED
| Status | Task | Description |
|--------|------|-------------|
| 🏦 | 26.1.1-26.5.3 | All 15 tasks banked — activate if third-party MQTT devices need MQTT 5.0 broker |

**Epic 26 Status**: 🏦 **BANKED** — Plans preserved, not needed for NATS-only path

**Architecture doc**: `thoughts/shared/plans/emqx-broker-infrastructure-plan.md`

**Activation trigger**: Third-party edge nodes requiring full MQTT 5.0 broker with retained messages

---

### Epic 27: @selfcharters/sparkplug-client + SparkplugAdapter — 15 SP 🆕 REVISED
| Status | Task | Description |
|--------|------|-------------|
| | | **F27.0: @selfcharters/sparkplug-client NX Package** |
| ✅ | 27.0.1 | Fork @nortech/sparkplug-client@3.5.2 into `packages/sparkplug-client/` (NX scaffold, strip npm packaging) |
| ✅ | 27.0.2 | Verify existing mqtt@^5 + sparkplug-payload deps from Nortech fork |
| ✅ | 27.0.3 | `SparkplugConfig` Effect Schema (serverUrl, groupId, edgeNode, clientId, willQos, willRetain, clean) |
| ✅ | 27.0.4 | `TopicBuilder` — pure functions for `spBv1.0/{group}/{verb}/{edge}/{device}` |
| ✅ | 27.0.5 | `SeqCounter` + `BdSeqCounter` — `Effect.Ref<number>`, 0-255 wrap, bdSeq increment |
| ✅ | 27.0.6 | Unlock Omit<> on mqttOptions — remove TypeScript type restriction, expose will/clean/QoS |
| ✅ | 27.0.7 | Fix Will QoS: 0→1 (spec-compliant NDEATH), make configurable via SparkplugConfig |
| ✅ | 27.0.8 | Add Effect wrappers — `MqttTransport` (acquireRelease), Message→`Stream.async` bridge |
| ✅ | 27.0.9 | Add `SparkplugCodec` — thin pass-through to sparkplug-payload encode/decode |
| ✅ | 27.0.10 | Barrel exports + package tests (71 tests: Protocol, Codec, MqttTransport, config) |
| | | **F27.1: SparkplugAdapter (in tmnl, uses @selfcharters/sparkplug-client)** |
| ✅ | 27.1.1 | `SparkplugAdapterConfig` schema (brokerUrl, groupIds[], clientId, etc.) |
| ✅ | 27.1.2 | `SparkplugAdapterLive` — MqttTransport → Stream.async → IngestedReading |
| ✅ | 27.1.3 | Reconnection logic — `Effect.retry` + `Schedule.exponential` |
| ✅ | 27.1.4 | Health check — `Effect.Ref<IngestionHealth>` from MQTT connection state |
| | | **F27.2: Alias Registry + Metric Decoding** |
| ✅ | 27.2.1 | AliasRegistry — `Ref<HashMap<string, HashMap<number, string>>>` per-edge-node |
| ✅ | 27.2.2 | `registerBirth` — populate alias→name from NBIRTH/DBIRTH |
| ✅ | 27.2.3 | `resolveAlias` — lookup by numeric alias, `clearNode` on NDEATH |
| ✅ | 27.2.4 | `decodeMetricValue` — type coercion (Double/Int32→number, Boolean→0/1) |
| | | **F27.3: Multi-Group + STATE** |
| ✅ | 27.3.1 | Multi-group: one MqttTransport per groupId, merged via `Stream.mergeAll` |
| ✅ | 27.3.2 | Alias registry scoped per `groupId:edgeNodeId` |
| ✅ | 27.3.3 | STATE message handling — parseStateTopic + makeStateRegistry (24 tests) |
| ✅ | 27.3.4 | Dynamic route registration per DBIRTH (TopicRouter integration) |
| | | **F27.4: Broker Comparison Spike** |
| ✅ | 27.4.1 | NATS MQTT bridge spike — Will message firing on TCP disconnect |
| ✅ | 27.4.2 | NATS MQTT bridge spike — binary protobuf payload roundtrip |
| ✅ | 27.4.3 | NATS MQTT bridge spike — topic wildcard subscription matching |
| ✅ | 27.4.4 | NATS MQTT bridge spike — high-frequency DDATA throughput |
| ✅ | 27.4.5 | Decision gate: NATS-only CONFIRMED — all 4 spikes pass, no EMQX needed |
| | | **F27.5: Test Publisher + Stubs** |
| ✅ | 27.5.1 | `SparkplugPublisherConfig` schema + `createSparkplugPublisher` |
| ✅ | 27.5.2 | `scripts/sparkplug-publish.ts` CLI entry point |
| ✅ | 27.5.3 | E2E integration tests — NBIRTH→DDATA lifecycle, multi-group, alias (19 tests) |
| ✅ | 27.6.1 | `opcua-adapter-stub.ts` + `modbus-adapter-stub.ts` (Effect.die stubs) |
| ✅ | 27.6.2 | Export stubs from `adapters/index.ts` |
| | | **F27.7: Nix + Docker** |
| ✅ | 27.7.1 | Nix sparkplug module (sparkplug-publish/subscribe/test scripts) |
| ✅ | 27.7.2 | Add sparkplug module to `nix/default.nix` |

**Epic 27 Status**: ✅ **COMPLETE** — F27.0-F27.7 all ✅ (71 pkg tests + 43 adapter tests = 114 total)

**Architecture docs**:
- `thoughts/shared/plans/sparkplug-b-plan.md` (full plan + fork appendix)
- `thoughts/shared/plans/sparkplug-b-reference-index.md` (research reference)
- `thoughts/shared/plans/nats-only-sparkplug-proposal.md` (NATS-only analysis)

**Key change**: No dependency on Epic 26 (EMQX). Uses NATS MQTT bridge for dev. EMQX activatable if spike fails.

---

### Epic 28: EMQX→NATS Bridge L2 Service — 8 SP 🏦 BANKED
| Status | Task | Description |
|--------|------|-------------|
| 🏦 | 28.1.1-28.4.3 | All 14 tasks banked — activate only if EMQX is deployed (Epic 26) |

**Epic 28 Status**: 🏦 **BANKED** — Only needed if EMQX is activated

**Decomposition doc**: `thoughts/shared/plans/broker-infra-decomposition.md`

---

### Epic 20: Real-time Subscriptions (WebSocket) — 8 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | 20.1.1 | RealtimeRpcs definitions (4 streaming RPCs: readings, alarms, equipment, invalidations) |
| ✅ | 20.1.2 | EventDistribution service (ChannelService PubSub hub, 4 channels, 11 tests) |
| ✅ | 20.2.1 | Realtime RPC handlers (filter + throttle + type mapping, 19 tests) |
| ✅ | 20.2.2 | WebSocket server layer (RpcServer + layerProtocolWebsocketRouter /ws/iiot, 10 tests) |
| ✅ | 20.3.1 | ReactivityBridge (handler-level Approach A, 5 tests) |
| ✅ | 20.3.2 | Entity handler integration (bridge.onX() methods for all 4 event types) |
| ✅ | 20.4.1 | Integration tests (RpcTest.makeClient roundtrip, concurrent subs, 8 tests) |

**Epic 20 Status**: ✅ **COMPLETE** — 53 realtime tests across 5 test files

**Architecture doc**: `thoughts/shared/plans/phase5-websocket-architecture.md`

---

## Phase 6: Migration & Layer Composition (Sprint 16) — 10 SP (revised from 26 SP)

**Scope Revision** (2026-02-09): Original Epic 21 (Migration, 13 SP) assessed as ~90% unnecessary —
existing integration tests already validate migration paths. Epic 22 (Layer Composition, 13 SP)
reduced to 10 SP after confirming AllStateServicesSql adapters + DeploymentMode config as actual gaps.

### Epic 21: Migration Path — 0 SP (DEFERRED)
| Status | Task | Description |
|--------|------|-------------|
| ⏸️ | 21.1-21.8 | Deferred — existing entity/state tests already validate migration |

**Epic 21 Status**: ⏸️ **DEFERRED** — Revisit when actual Tauri↔Cluster migration is needed

**Rationale**: Entity handlers use port-injected state services. `EntityTestingStack` (InMemory) and
`EntityProductionHandlersWithEvents` (SQL) already exercise the same handler code paths.
Migration testing only becomes relevant when SQLite (Tauri mode) state services are implemented.

---

### Epic 22: Layer Composition — 10 SP
| Status | Task | Description |
|--------|------|-------------|
| ✅ | 22.1.1 | 12 SQL state adapter layers (AlarmStateSqlLayer through DeviceStateSqlLayer) |
| ✅ | 22.1.2 | AllStateServicesSql (Layer.mergeAll of all 12 adapters) |
| ✅ | 22.1.3 | IIoTClusterLayer (EntityProductionHandlersWithEvents + SQL state + repos) |
| ✅ | 22.1.4 | IIoTRuntimeLayer (Layer.unwrapEffect + DeploymentModeConfig switch) |
| ✅ | 22.2.1 | DeploymentMode config (Schema.Literal + Context.Tag + env layer) |
| ✅ | 22.3.1 | Barrel exports (layers/index.ts + infrastructure/index.ts) |
| ✅ | 22.3.2 | Integration tests (15 tests: state resolution, entity composition, config-driven selection) |

**Epic 22 Status**: ✅ **COMPLETE** — 7/7 tasks (15 integration tests pass)

---

## Phase 7: Documentation & DX

### Epic 23: Documentation (8 SP) 🎯

| Status | Task | Description |
|--------|------|-------------|
| ✅ | 23.1.1 | Architecture overview (docs/architecture/overview.md) |
| ✅ | 23.1.2 | HTTP transport design (docs/architecture/http-transport.md) |
| ✅ | 23.1.3 | WebSocket realtime design (docs/architecture/websocket-realtime.md) |
| ✅ | 23.1.4 | Stream processing design (docs/architecture/stream-processing.md) |
| ✅ | 23.1.5 | RPC inventory (docs/architecture/rpc-inventory.md) |
| ✅ | 23.1.6 | Concurrency model (docs/architecture/concurrency-model.md) |
| ✅ | 23.2.1 | Schema patterns (docs/patterns/schemas.md) |
| ✅ | 23.2.2 | Entity patterns (docs/patterns/entities.md) |
| ✅ | 23.2.3 | Repository patterns (docs/patterns/repositories.md) |
| ✅ | 23.2.4 | Event sourcing patterns (docs/patterns/event-sourcing.md) |
| ✅ | 23.2.5 | Effect-TS core patterns (9 pattern docs from .edin/) |
| ✅ | 23.2.6 | IIoT-specific patterns (rpc-handler-bridge, rpc-gotchas, property-testing) |
| ✅ | 23.3.1 | Quickstart guide (docs/quickstart.md) |
| ✅ | 23.3.2 | Migration guide v2→v3 (docs/migration.md) |
| ✅ | 23.3.3 | API reference (docs/api/README.md) |
| ✅ | 23.3.4 | JSDoc annotations (22 files enhanced) |
| ✅ | 23.4.1 | ADRs (4 architecture decision records) |
| ✅ | 23.4.2 | Specifications (entity-system, TLA+ invariants, v3-architecture) |
| ✅ | 23.4.3 | References (sparkplug-b, ISA-95, NATS, EMQX) |
| ✅ | 23.4.4 | Implementation digest (handoff-digest, alignment-sessions, WO-workflow) |
| ✅ | 23.4.5 | Skills catalog (79 skills, 16 categories) |
| ✅ | 23.4.6 | Master index (docs/README.md — navigable tree, 37+ docs) |

**Epic 23 Status**: ✅ **COMPLETE** — 22/22 tasks (37+ documentation files)

### Epic 24: Developer Experience (8 SP) 🎯

| Status | Task | Description |
|--------|------|-------------|
| ✅ | 24.1.1 | Entity generator CLI (tools/generate-entity.ts) |
| ✅ | 24.1.2 | Model generator CLI (tools/generate-model.ts) |
| ✅ | 24.1.3 | Migration generator CLI (tools/generate-migration.ts) |
| ✅ | 24.1.4 | Schema validator CLI (tools/validate-schema.ts) |
| ✅ | 24.2.1 | VS Code snippets (.vscode/iiot.code-snippets) |
| ✅ | 24.2.2 | VS Code extensions (.vscode/extensions.json) |
| ✅ | 24.3.1 | CLI reference doc (docs/tooling/cli-reference.md) |
| ✅ | 24.3.2 | Spike methodology doc (docs/tooling/spike-methodology.md) |
| ✅ | 24.3.3 | Pi Hypothesis Lab doc (docs/tooling/pi-hypothesis-lab.md) |
| ✅ | 24.3.4 | Features: COP chat panel index (docs/features/cop-chat-panel/) |

**Epic 24 Status**: ✅ **COMPLETE** — 10/10 tasks (4 CLIs, VS Code config, 4 tooling docs)

---

## Progress Summary

| Phase | Epics | SP | Complete | Remaining |
|-------|-------|-----|----------|-----------|
| Phase 1: Foundation | 1-6 | 47 | ✅ 47 | 0 |
| Phase 2: ES Boundaries | 7-12 | 76 | ✅ 76 | 0 |
| Phase 2.5: Regulatory | 25 | 13 | ✅ 13 | 0 |
| Phase 3: Entity & Service | 13-16 | 42 | ✅ 42 | 0 |
| Phase 4: RPC & HTTP | 17-18 | 26 | ✅ 26 | 0 |
| Phase 5: Stream & RT | 19-20, 27 | 36 | ✅ 36 | 0 |
| Phase 5 Banked | 26, 28 | (21) | — | (banked) |
| Phase 6: Layers | 22 | 10 | ✅ 10 | 0 |
| Phase 6 Deferred | 21 | (13) | — | (deferred) |
| Phase 7: Docs & DX | 23-24 | 16 | ✅ 16 | 0 |
| **Total (active)** | **26** | **266** | **✅ 266** | **0** |

**Overall Progress**: 100% complete (266/266 active SP)
**Banked**: 21 SP (Epics 26+28) — activate if EMQX needed
**Deferred**: 13 SP (Epic 21) — activate when Tauri SQLite state needed
**Phase 5 completed**: 2026-02-09
**Phase 6 completed**: 2026-02-09
**Phase 7 completed**: 2026-02-09

---

## What's Next: Phase 6 — Migration & Integration (Epics 21-22)

**Phase 5 Status** (2026-02-09): ✅ **COMPLETE** — All 36 SP delivered.

**Phase 5 Deliverables** (completed 2026-02-07 through 2026-02-09):
- ✅ Epic 19: Ingestion pipeline (10/10 tasks, 325+ adapter tests)
- ✅ Epic 27: @selfcharters/sparkplug-client + SparkplugAdapter (all F27 subtasks)
- ✅ Epic 20: WebSocket real-time subscriptions (7/7 tasks, 53 realtime tests)
- 🏦 Epics 26+28: EMQX — banked (NATS-only confirmed)

**Wave 3 Session** (2026-02-09):
- kraken-sparkplug: STATE handling (24 tests) + E2E integration (19 tests) = 43 tests
- kraken-websocket: WS server layer (10 tests) + WS integration (8 tests) = 18 tests
- Prior waves: EventDistribution (11) + RPC handlers (19) + ReactivityBridge (5) = 35 tests
- **Total new realtime+adapter tests this session**: 96 tests

**Health** (as of 2026-02-09):
- Test suite: 2,900+ passed, 0 failed
- Adapter tests: 325 passed across 20 files
- Realtime tests: 53 passed across 5 files
- HTTP tests: 549 passed across 17 files
- Integration tests: 177 passed (PostgreSQL)
- TypeScript: 0 errors

**Next**: Phase 6 — Migration & Integration (Epics 21-22, 26 SP)

**Architecture Docs**:
- `thoughts/shared/plans/sparkplug-b-reference-index.md` (**START HERE** — research index)
- `thoughts/shared/plans/sparkplug-b-plan.md` (Epic 27 — includes fork appendix)
- `thoughts/shared/plans/nats-only-sparkplug-proposal.md` (NATS-only analysis)
- `thoughts/shared/plans/emqx-broker-infrastructure-plan.md` (Epic 26 — banked)
- `thoughts/shared/plans/broker-infra-decomposition.md` (V-model decomposition)

---

## Verification Commands

```bash
# Run all IIoT tests
bun test src/lib/iiot/

# Run adapter pipeline tests
bun test src/lib/iiot/adapters/

# Run HTTP tests
bun test src/lib/iiot/http/

# Run ES integration tests
bun test src/lib/iiot/__tests__/integration/

# Check TypeScript
bunx tsc --noEmit

# View test coverage
bun test --coverage
```

---

**Source WBS**: `thoughts/shared/plans/2026-01-26-v3-service-architecture-wbs.md`
