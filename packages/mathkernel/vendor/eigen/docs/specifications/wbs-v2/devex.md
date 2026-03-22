# WBS V2 — Developer Experience & Operations

**Domain**: Part VI (Sections 23-29)
**Author**: devex-architect
**Prefix**: DX
**Date**: 2026-02-13
**RFC Lines**: 22766-28403

---

## Summary

7 phases, 16 epics, ~324 SP total.

| Phase | Epics | SP | Sprints |
|-------|-------|----|---------|
| Phase A: SDK & Client Libraries | DX-01 to DX-04 | 55 SP | 3-4 |
| Phase B: CLI Tooling | DX-05, DX-06 | 34 SP | 2 |
| Phase C: Onboarding Protocol | DX-07, DX-08 | 110 SP | 5-7 |
| Phase D: Observability Framework | DX-09, DX-10 | 42 SP | 2-3 |
| Phase E: Monitoring Infrastructure | DX-11, DX-12 | 37 SP | 2 |
| Phase F: Operations & Migration | DX-13, DX-14 | 28 SP | 1-2 |
| Phase G: Conformance & Testing | DX-15 | -- SP (cross-cutting) | Parallel |

**What already exists** (from WBS V1 — 266 SP):
- All entity schemas, models, DDL, repositories, services (PL-01 to PL-06)
- Event sourcing infrastructure, handlers (PL-07 to PL-12)
- RPC groups, HTTP routes, streaming (PL-17 to PL-20)
- ISA-18.2 compliance tests, property-based tests, integration tests
- InstrumentationService with NATS persistence
- Existing `withApiTracing` / `withDsTracing` HOF patterns
- SparkplugPipelineLayer, IngestionServiceLive
- 68+ test files across unit/integration/compliance/property-based/spikes

**What does NOT exist yet**:
- `@tmnl/sdk`, `@tmnl/client`, `@tmnl/testing`, `@tmnl/types` packages
- `tmnl` CLI tool
- Onboarding wizard (React + Effect service)
- Edge agent binary packaging
- OPC UA / Modbus adapters
- IIoT-specific observability (withEntityTracing, withPipelineTracing)
- Monitoring dashboards (Grafana), alerting rules
- Operational runbooks as code
- Conformance certification harness

---

## Entity Tier Classification

### Machine-Backed Entities (Full 12-Layer Stack)

| Entity | States | RFC Section | Epic |
|--------|--------|-------------|------|
| **EdgeAgent** | BOOTSTRAP, CONNECTED, DISCOVERING, OPERATIONAL, AUTONOMOUS, RECONNECTING, DEGRADED (7 states) | S24.4.3 | DX-07 |
| **OnboardingSession** | CREATED, CREDENTIALS_PROVIDED, CONNECTED, DISCOVERING, DEVICES_CONFIRMED, DATA_FLOWING, COMPLETE, ABANDONED, TIMED_OUT (9 states) | S24.8 | DX-08 |

Both require: Schema, Model, DDL, Repository, Errors, L2 Service, Machine, ES Handler, Entity, Observer, RPC Group, HTTP Routes + Streaming RPC for real-time state subscriptions.

**Real-time backbone**: Both entities wire into `Machine.changes` → `makeEntityObserver()` → `iiot:entity-changes` EventDistribution channel. Observer is a scoped fiber registered at entity activation. Streaming RPCs consume the shared channel filtered by `entityType`. No custom streaming per entity.

### Lightweight Machine (Derived — No DDL/Repo)

| Entity | States | RFC Section | Epic |
|--------|--------|-------------|------|
| **EdgeDeviceHealth** | ONLINE, ACTIVE, STALE, LOST (4 states) | S26.3 | DX-11 |

Derived from Sparkplug BIRTH/DATA/DEATH timing on existing Device entity. NOT a persistent entity — monitoring projection only. Requires: Machine definition + L2 Service + RPC exposure. No separate DDL/Repo/ES Handler.

### CRUD Entities: None

The DevEx domain does not introduce new CRUD-only entities. SDK/CLI/Observability consume existing entities from other domains.

---

## E2E Stack Audit (12-Layer Verification)

### Layer Coverage Matrix

| # | Layer | EdgeAgent | OnboardingSession | EdgeDeviceHealth | Observability (non-entity) |
|---|-------|-----------|-------------------|------------------|---------------------------|
| 1 | Schema | DX-07.2.1 **NEW** | DX-08.2.1 **NEW** | DX-11.1.3 (existing) | — |
| 2 | Model | DX-07.2.2 **NEW** | DX-08.2.2 **NEW** | N/A (derived) | — |
| 3 | DDL | DX-07.2.3 **NEW** | DX-08.2.3 **NEW** | N/A (derived) | N/A |
| 4 | Repository | DX-07.2.4 **NEW** | DX-08.2.4 **NEW** | N/A (derived) | N/A |
| 5 | Errors | DX-07.2.5 **NEW** | DX-08.2.5 **NEW** | DX-11.1.3 (inline) | DX-09.1.7, DX-10.1.4 |
| 6 | L2 Service | DX-07.1.1 (existing) | DX-08.1.1 (existing) | DX-11.1.1 (existing) | DX-09.1.8, DX-10.1.2 |
| 7 | Machine | DX-07.2.6 **NEW** | DX-08.2.6 **NEW** | DX-11.2.1 **NEW** | N/A |
| 8 | ES Handler | DX-07.2.7 **NEW** | DX-08.2.7 **NEW** | N/A (derived) | N/A |
| 9 | Entity | DX-07.2.8 **NEW** | DX-08.2.8 **NEW** | N/A (derived) | N/A |
| 10 | Observer | DX-07.2.9 **NEW** | DX-08.2.9 **NEW** | N/A (derived) | N/A |
| 11 | RPC Group | DX-07.2.10 **NEW** | DX-08.2.10 **NEW** | DX-11.1.6 (existing) | — |
| 12 | HTTP Routes | DX-07.2.11 **NEW** | DX-08.2.11 **NEW** | DX-11.1.7 (existing) | — |
| +  | Streaming RPC | DX-07.2.12 **NEW** | DX-08.2.12 **NEW** | — | — |

### Non-Entity Layer Coverage (SDK/Observability)

| # | Layer | Applicable? | Coverage | Notes |
|---|-------|------------|----------|-------|
| 1 | Schema | YES | DX-01 (DX-01.1.2, DX-01.1.4) | Entity schemas exported as types + JSON Schema artifacts |
| 2 | Model Derivation | YES | DX-01 (DX-01.1.5) | @effect/sql Model types exported from `@tmnl/types/models` |
| 5 | Error Schemas | YES | DX-03 (DX-03.1.2) + DX-16 (DX-16.1.6) + DX-09 (DX-09.1.7) + DX-10 (DX-10.1.4) | Client error mapping, error code registry, observability errors, guarantee violation errors |
| 6 | L1/L2 Services | YES | DX-09 (DX-09.1.8 L1) + DX-10 (DX-10.1.2 L2) + DX-11 (DX-11.1.1 L2) | OtelCollectorService, GuaranteeMonitorService, HealthCheckService |
| 8 | RPC Groups | YES | DX-02 (DX-02.1.1) + DX-11 (DX-11.1.6) | SDK wraps IIoTRpcs; DiagnosticsRpcs for operational endpoints |
| 9 | HTTP Endpoints | YES | DX-11 (DX-11.1.2, DX-11.1.7) + DX-16 (DX-16.1.6) | Health, diagnostics, error code endpoints |
| 10 | Streaming RPCs | YES | DX-02 (DX-02.1.3) | 4 realtime stream RPCs in SDK |

---

## Phase A: SDK & Client Libraries (Sprints 1-4) — 55 SP

### DX-01: @tmnl/types — Shared Type Package — 11 SP

**RFC Section**: 23.4.1, 23.5.2

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-01.1.1 | 2 | Extract branded identifiers from `lib/iiot/schemas/identifiers.ts` into `@tmnl/types` package with barrel exports |
| ⏳ | DX-01.1.2 | 3 | Export all entity schemas (Asset, Alarm, SensorReading, WorkOrder, EquipmentState, 9 ISA-95 types) as TypeScript types + Effect Schema objects |
| ⏳ | DX-01.1.3 | 1 | Export RPC error schema taxonomy from `lib/iiot/rpc/errors.ts` — 10 tagged error types |
| ⏳ | DX-01.1.4 | 2 | Generate JSON Schema artifacts via `JSONSchema.make()` for all entity and RPC schemas; publish as `@tmnl/types/json-schemas` |
| ⏳ | DX-01.1.5 | 3 | **[E2E: Model Derivation]** Export @effect/sql `Model.Class` type derivations alongside schemas — `AlarmModel`, `WorkOrderModel`, `EquipmentStateModel`, asset models (9 ISA-95); consumers using `@effect/sql` get both schema + model types from `@tmnl/types/models` |

**Dependencies**: None (builds on existing schemas from WBS V1 PL-01, PL-02)
**RFC Sections**: 23.4.1, 23.5.2, 23.5.3
**E2E Stack**: Layer 1 (Schema) + Layer 2 (Model Derivation)

---

### DX-02: @tmnl/sdk — Effect-Native SDK — 13 SP

**RFC Section**: 23.4.2, 23.4.4, 23.4.5

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-02.1.1 | 3 | Create `@tmnl/sdk` package scaffolding; re-export `IIoTRpcs` from `lib/iiot/rpc/index.ts:91-112` as typed RPC client via `RpcClient.make(IIoTRpcs)` |
| ⏳ | DX-02.1.2 | 5 | Implement WebSocket transport layer with auto-reconnect (exponential backoff: initialDelay 1s, maxDelay 30s, jitter 0.2, multiplier 2.0); re-subscribe active streams on reconnect |
| ⏳ | DX-02.1.3 | 3 | Expose 4 realtime stream RPCs as `Stream<A, E>` — SubscribeReadings, SubscribeAlarms, SubscribeEquipmentState, SubscribeInvalidations |
| ⏳ | DX-02.1.4 | 2 | SDK configuration: endpoint, token, reconnect options, serialization (JSON default, future msgpack), timeout (30s default) |

**Dependencies**: DX-01 (@tmnl/types)
**RFC Sections**: 23.4.2, 23.4.4, 23.4.5
**Coordination**: PL (platform-architect, RPC group composition)

---

### DX-03: @tmnl/client — Promise-Based Wrapper — 13 SP

**RFC Section**: 23.4.3, 23.6.1

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-03.1.1 | 5 | Create `@tmnl/client` package wrapping `@tmnl/sdk` with `Effect.runPromise`; expose resource-oriented API: `client.plants.get()`, `client.alarms.acknowledge()`, `client.workOrders.create()` etc. |
| ⏳ | DX-03.1.2 | 3 | Convert `Schema.TaggedError` to structured JS Error subclasses with `code`, `_tag`, `details` properties; map to error code registry (TMNL-E-1xx through TMNL-E-9xx) |
| ⏳ | DX-03.1.3 | 3 | Convert all `stream: true` RPCs to `AsyncIterable<T>` via `Stream.toAsyncIterable`; handle WebSocket lifecycle transparently |
| ⏳ | DX-03.1.4 | 2 | Tree-shakeable package structure: unused RPC groups excluded by bundler; ESM + CJS dual output |

**Dependencies**: DX-02 (@tmnl/sdk)
**RFC Sections**: 23.4.3, 23.6.1
**Coordination**: PR (product-architect, Earl persona UX requirements)

---

### DX-04: @tmnl/testing — Test Harness Package — 18 SP

**RFC Section**: 23.10.1-23.10.5

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-04.1.1 | 5 | `TestRunner.make()` — mock entity lifecycle with in-memory storage, state machine validation; support `runner.send()` and `runner.getState()` |
| ⏳ | DX-04.1.2 | 3 | `MockEntities` — in-memory implementations for all 12 entity types (Alarm, WorkOrder, EquipmentState, 9 ISA-95 asset entities) |
| ⏳ | DX-04.1.3 | 3 | Entity test harness: validate state machine completeness (all transitions reachable), invalid transition rejection, concurrent access serialization |
| ⏳ | DX-04.1.4 | 3 | `EventReplay.fromFile()` — replay recorded JSONL event files at configurable speed; verify system behavior per event |
| ⏳ | DX-04.1.5 | 2 | Sandbox environment support: NATS account isolation per developer, ephemeral state, relaxed rate limits (10x production), 24h retention |
| ⏳ | DX-04.1.6 | 2 | `@tmnl/testing/vitest` — vitest helpers: `it.entity()` for entity lifecycle tests, `it.pipeline()` for ingestion pipeline tests |

**Dependencies**: DX-02 (@tmnl/sdk), existing entity definitions (WBS V1 PL-07 to PL-12)
**RFC Sections**: 23.10.1-23.10.5

---

## Phase B: CLI Tooling (Sprints 4-5) — 34 SP

### DX-05: tmnl CLI Core — 21 SP

**RFC Section**: 23.7.1-23.7.3

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-05.1.1 | 3 | CLI scaffolding with `@effect/cli`: `tmnl` command, global options (--json, --csv, --jsonl output formats), config file (~/.tmnl/config.json) |
| ⏳ | DX-05.1.2 | 3 | `tmnl init` — interactive connection wizard: endpoint URL, API token, organization selection; store in config |
| ⏳ | DX-05.1.3 | 2 | `tmnl status` — show connection health, current org, token expiry |
| ⏳ | DX-05.1.4 | 3 | `tmnl devices list/register/provision/show` — device management commands using `@tmnl/sdk` Device RPCs |
| ⏳ | DX-05.1.5 | 3 | `tmnl stream readings/equipment/alarms` — real-time tailing via WebSocket subscription; format as table/json/jsonl |
| ⏳ | DX-05.1.6 | 2 | `tmnl alarms list/ack/context` — alarm management commands with severity filtering, context window |
| ⏳ | DX-05.1.7 | 3 | `tmnl work-orders list/create/submit/approve/start/complete` — full work order lifecycle from CLI |
| ⏳ | DX-05.1.8 | 2 | `tmnl diagnostics connection-test/device-health/sparkplug-validate` — diagnostic commands |

**Dependencies**: DX-02 (@tmnl/sdk)
**RFC Sections**: 23.7.1-23.7.3
**Coordination**: IF (infra-architect, device provisioning, certificate management)

---

### DX-06: CLI Nix & Distribution — 13 SP

**RFC Section**: 23.7.1, 28.6.2

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-06.1.1 | 3 | `bun add -g @tmnl/cli` npm distribution: compile to standalone binary via bun build |
| ⏳ | DX-06.1.2 | 3 | `nix profile install github:gbg/tmnl#cli` Nix flake output for reproducible installation |
| ⏳ | DX-06.1.3 | 2 | Shell completions: bash, zsh, fish auto-completion for all commands and subcommands |
| ⏳ | DX-06.1.4 | 2 | Man pages: auto-generated from `@effect/cli` command definitions |
| ⏳ | DX-06.1.5 | 3 | CI pipeline: build, test, publish CLI on version tag; integration test against staging NATS cluster |

**Dependencies**: DX-05 (tmnl CLI Core)
**RFC Sections**: 23.7.1, 28.6.2

---

## Phase C: Onboarding Protocol (Sprints 5-7) — 110 SP

### DX-07: Edge Agent Bootstrap — 54 SP

**RFC Section**: 24.1-24.5
**Entity Tier**: Machine-Backed (EdgeAgent — 7-state machine, full 12-layer stack)

#### Business Logic Tasks

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-07.1.1 | 5 | Account provisioning service: NATS JWT signing via `nsc`, NATS account creation with tier limits (Starter/Professional/Enterprise), JetStream stream provisioning (4 streams per org) |
| ⏳ | DX-07.1.2 | 3 | QR code credential exchange: encode JWT + cloudUrl + orgId into QR; client-side scan via camera API; 1-hour expiry, single-use bootstrap JWT |
| ⏳ | DX-07.1.3 | 3 | Protocol discovery: mDNS + port scan for MQTT brokers and OPC UA servers; rate-limited (10 probes/s), local subnet only |
| ⏳ | DX-07.1.4 | 3 | Sparkplug-B auto-discovery flow: subscribe `spBv1.0/#`, process NBIRTH/DBIRTH -> entity hierarchy (Organization > Machine > Sensor); leverages existing `AliasRegistry` at `sparkplug-adapter.ts:79-111` |
| ⏳ | DX-07.1.5 | 2 | Offline-first guarantee: local JetStream 7-day buffer, local AlarmDetector, local entity processing, local web dashboard at `localhost:8080` |

#### E2E Stack: EdgeAgent Entity (12 Layers)

| Status | Task | SP | Layer | Description |
|--------|------|----|-------|-------------|
| ⏳ | DX-07.2.1 | 2 | L1: Schema | `EdgeAgent` schema (Schema.TaggedClass) at `schemas/edge-agent/schema.ts`: `EdgeAgentId` (branded, EAG- prefix), state (7-value Schema.Literal), cloudUrl, orgId, leafNodeId, lastHeartbeat, discoveredDeviceCount, localJetstreamUsageBytes, firmwareVersion |
| ⏳ | DX-07.2.2 | 2 | L2: Model | `EdgeAgentModel` (Model.Class) at `models/edge-agent/EdgeAgentModel.ts`: SQL column mappings, Model.Generated for id, Model.FieldOption for nullable fields, Model.JsonFromString for discoveredDevices array |
| ⏳ | DX-07.2.3 | 2 | L3: DDL | `edge_agents` table: columns matching schema, indexes on (orgId, state), unique on (orgId, leafNodeId), FK to enterprises(id); migration `0040_edge_agent_schema` |
| ⏳ | DX-07.2.4 | 2 | L4: Repository | `EdgeAgentRepo`: CRUD + findByOrg, findByState, updateState, updateHeartbeat, findStale (heartbeat older than threshold) |
| ⏳ | DX-07.2.5 | 1 | L5: Errors | `EdgeAgentErrors` at `errors/edge-agent.ts`: `AgentBootstrapError`, `AgentConnectionError`, `AgentDiscoveryError`, `AgentReconnectionError`, `AgentDegradedError` as Data.TaggedError |
| ⏳ | DX-07.2.6 | 3 | L7: Machine | `EdgeAgentMachine` at `machines/EdgeAgentMachine.ts`: 7 states (BOOTSTRAP, CONNECTED, DISCOVERING, OPERATIONAL, AUTONOMOUS, RECONNECTING, DEGRADED) with state graph at `machines/graphs/edge-agent-graph.ts`; transitions: credentialProvisioned, discoveryComplete, devicesConfirmed, cloudLost, cloudRestored, syncComplete, degraded, recovered |
| ⏳ | DX-07.2.7 | 3 | L8: ES Handler | `EdgeAgentHandler` at `handlers/edge-agent/`: command handlers for Bootstrap, Connect, StartDiscovery, ConfirmDevices, GoAutonomous, Reconnect, Degrade, Recover; event schemas: EdgeAgentBootstrapped, EdgeAgentConnected, EdgeAgentDiscoveryStarted, EdgeAgentOperational, etc. |
| ⏳ | DX-07.2.8 | 2 | L9: Entity | `EdgeAgentEntity` at `entity/EdgeAgentEntity.ts`: `Entity.make('EdgeAgent')` composing EdgeAgentMachine + EdgeAgentHandler + EdgeAgentRepo; wire to @effect/cluster for distributed management; at entity activation, register `makeEdgeAgentObserver()` with `Machine.changes` stream as scoped fiber — observer auto-participates in real-time via EventDistribution |
| ⏳ | DX-07.2.9 | 2 | L10: Observer | `makeEdgeAgentObserver()` at `streaming/edge-agent-observer.ts`: subscribe to `Machine.changes` stream (scoped fiber at entity activation); pipe through `Stream.zipWithPrevious` (NOT `Stream.pairwise` — does not exist) to derive action from `Option.none()` → "initialized" or `(prev, current)` → transition action; emit `EntityStateChanged<EdgeAgent>` events into shared `iiot:entity-changes` EventDistribution channel (maxLag 1k); registered via `makeEntityObserver('EdgeAgent', machineChangesStream)` pattern from PL observer infrastructure (PL-07 to PL-11) |
| ⏳ | DX-07.2.10 | 2 | L11: RPC Group | `EdgeAgentRpcs` at `rpc/EdgeAgentRpcs.ts`: GetAgent, ListAgents, BootstrapAgent, GetAgentState, ForceReconnect, ForceDegrade, GetAgentMetrics; add to IIoTRpcs composition |
| ⏳ | DX-07.2.11 | 1 | L12: HTTP | HTTP routes: `GET /api/v1/edge-agents`, `GET /api/v1/edge-agents/{agentId}`, `POST /api/v1/edge-agents/{agentId}/reconnect`; add to IIoTApi |
| ⏳ | DX-07.2.12 | 2 | Streaming | `Realtime.SubscribeEdgeAgentState` streaming RPC: consumes `EntityStateChanged<EdgeAgent>` from shared `iiot:entity-changes` EventDistribution channel (filtered by entityType='EdgeAgent'); NO custom streaming — observer infrastructure handles emission, this RPC subscribes and relays via WebSocket; add to RealtimeRpcs |

#### Tests: EdgeAgent Entity (12+ test files)

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-07.3.1 | 1 | **Schema test** at `__tests__/unit/edge-agent-schema.test.ts`: decode/encode roundtrip for EdgeAgent, EdgeAgentId branded validation (EAG- prefix), state literal exhaustiveness, all 7 state values parseable |
| ⏳ | DX-07.3.2 | 1 | **Model + DDL test** at `__tests__/integration/edge-agent-model.test.ts`: Model derivation (computed fields, JSON transforms), DDL migration applies (table exists, indexes, constraints, FK to enterprises) |
| ⏳ | DX-07.3.3 | 1 | **Repo integration test** at `__tests__/integration/edge-agent-repo.test.ts`: full CRUD cycle (create -> findById -> updateState -> findByOrg -> findByState -> findStale -> delete); test unique constraint on (orgId, leafNodeId) |
| ⏳ | DX-07.3.4 | 1 | **Error schema test** at `__tests__/unit/edge-agent-errors.test.ts`: each error variant (AgentBootstrapError, AgentConnectionError, AgentDiscoveryError, AgentReconnectionError, AgentDegradedError) constructs and pattern-matches correctly |
| ⏳ | DX-07.3.5 | 2 | **Machine state transition test** at `__tests__/unit/edge-agent-machine.test.ts`: every valid transition (BOOTSTRAP->CONNECTED, CONNECTED->DISCOVERING, DISCOVERING->OPERATIONAL, OPERATIONAL->AUTONOMOUS, AUTONOMOUS->RECONNECTING, RECONNECTING->OPERATIONAL, any->DEGRADED, DEGRADED->RECONNECTING); every invalid transition rejected (BOOTSTRAP->OPERATIONAL, DISCOVERING->AUTONOMOUS, etc.) |
| ⏳ | DX-07.3.6 | 2 | **ES Handler test** at `__tests__/integration/edge-agent-handler.test.ts`: each command (Bootstrap, Connect, StartDiscovery, ConfirmDevices, GoAutonomous, Reconnect, Degrade, Recover) produces correct events and updates state; idempotent command handling |
| ⏳ | DX-07.3.7 | 1 | **Entity lifecycle test** at `__tests__/integration/edge-agent-entity.test.ts`: Entity.make integration — full bootstrap-to-operational lifecycle through @effect/cluster entity; concurrent command serialization |
| ⏳ | DX-07.3.8 | 2 | **Observer emission test** at `__tests__/integration/edge-agent-observer.test.ts`: (1) `Machine.changes` stream emits on state transition, (2) observer receives via `Stream.zipWithPrevious` — first emission has `Option.none()` previous → "initialized" action, subsequent emissions derive action from `(prev, current)`, (3) `EntityStateChanged<EdgeAgent>` published to `iiot:entity-changes` EventDistribution channel, (4) roundtrip: trigger transition → verify event arrives on channel subscriber. **NOTE**: Use `it()` + `Effect.runPromise` wrapper (NOT `it.effect()`/`it.scoped()`) per PubSub timeout issue |
| ⏳ | DX-07.3.9 | 1 | **RPC roundtrip test** at `__tests__/integration/edge-agent-rpc.test.ts`: GetAgent, ListAgents, BootstrapAgent, GetAgentState, ForceReconnect via RpcTest.makeClient; verify request/response typing |
| ⏳ | DX-07.3.10 | 1 | **HTTP endpoint test** at `__tests__/integration/edge-agent-http.test.ts`: GET /api/v1/edge-agents (list), GET /api/v1/edge-agents/{id} (detail), POST /api/v1/edge-agents/{id}/reconnect (action); verify status codes and response shapes |
| ⏳ | DX-07.3.11 | 1 | **Streaming RPC test** at `__tests__/integration/edge-agent-streaming.test.ts`: SubscribeEdgeAgentState stream receives state changes after transition commands; verify stream termination on entity cleanup. **NOTE**: Use `it()` + `Effect.runPromise` wrapper per PubSub timeout issue |

**Dependencies**: Existing SparkplugPipelineLayer (WBS V1), SC (security-architect, NATS JWT provisioning)
**RFC Sections**: 24.1-24.5
**Coordination**: SC (SC account provisioning), IF (infra-architect, edge device hardware)
**E2E Stack**: Full 12-layer Machine-backed entity

---

### DX-08: Onboarding Wizard & Progressive Complexity — 56 SP

**RFC Section**: 24.6-24.9
**Entity Tier**: Machine-Backed (OnboardingSession — 9-state machine, full 12-layer stack)
**Entity Ownership**: **DX owns OnboardingSession entity** (full 12-layer stack). PR (product-architect) consumes via `OnboardingRpcs` (DX-08.2.10) and `SubscribeOnboardingProgress` streaming RPC (DX-08.2.12) for wizard UI and SLA dashboards. PR-23 and PR-06 are consumer epics — no duplicate entity definition. Canonical state model: 9 states (CREATED, CREDENTIALS_PROVIDED, CONNECTED, DISCOVERING, DEVICES_CONFIRMED, DATA_FLOWING, COMPLETE, ABANDONED, TIMED_OUT).

#### Business Logic Tasks

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-08.1.1 | 5 | 5-screen onboarding wizard React component: Welcome/QR Scan -> Connection Status -> Device Discovery -> Live Data -> Dashboard Handoff; mobile-first, responsive |
| ⏳ | DX-08.1.2 | 3 | Default alarm threshold configuration: temperature 60/80C, vibration 4.5/7.1 mm/s (ISO 10816-3), humidity 70/85%; overridable per sensor |
| ⏳ | DX-08.1.3 | 3 | Telescoping hierarchy: 3-level onboarding (Org > Machine > Sensor) with expansion wizard for Tier 2 (insert Site/Area/Line levels without breaking entity IDs) |
| ⏳ | DX-08.1.4 | 2 | Progressive complexity tiers: Tier 1 (Earl, 1-5 machines) / Tier 2 (mid-market, 10-100) / Tier 3 (enterprise, 100+); feature gating by tier |
| ⏳ | DX-08.1.5 | 3 | Onboarding failure recovery: save progress to NATS KV on timeout, "Resume Later" QR code, preserve discovered devices on abandonment |
| ⏳ | DX-08.1.6 | 2 | OEE calculator: derive Availability * Performance * Quality from EquipmentState durations; display after 5-minute accumulation window |

#### E2E Stack: OnboardingSession Entity (12 Layers)

| Status | Task | SP | Layer | Description |
|--------|------|----|-------|-------------|
| ⏳ | DX-08.2.1 | 2 | L1: Schema | `OnboardingSession` schema (Schema.TaggedClass) at `schemas/onboarding/schema.ts`: `OnboardingSessionId` (branded, OBS- prefix), state (9-value Schema.Literal: CREATED, CREDENTIALS_PROVIDED, CONNECTED, DISCOVERING, DEVICES_CONFIRMED, DATA_FLOWING, COMPLETE, ABANDONED, TIMED_OUT), orgId, edgeAgentId, tier (1/2/3), screenIndex (0-4), discoveredDeviceIds[], startedAt, completedAt, abandonedReason, elapsedMs |
| ⏳ | DX-08.2.2 | 2 | L2: Model | `OnboardingSessionModel` (Model.Class) at `models/onboarding/OnboardingSessionModel.ts`: SQL column mappings, Model.Generated for id, Model.JsonFromString for discoveredDeviceIds array, Model.FieldOption for completedAt/abandonedReason |
| ⏳ | DX-08.2.3 | 2 | L3: DDL | `onboarding_sessions` table: columns matching schema, indexes on (orgId, state), (startedAt), (state) for finding incomplete sessions; migration `0041_onboarding_session_schema` |
| ⏳ | DX-08.2.4 | 2 | L4: Repository | `OnboardingSessionRepo`: CRUD + findByOrg, findIncomplete (state NOT IN COMPLETE/ABANDONED/TIMED_OUT), findByEdgeAgent, updateState, markAbandoned, getAverageCompletionTime (for 15-min SLA tracking) |
| ⏳ | DX-08.2.5 | 1 | L5: Errors | `OnboardingErrors` at `errors/onboarding.ts`: `OnboardingTimeoutError` (SLA breach), `OnboardingCredentialError`, `OnboardingDiscoveryError`, `OnboardingResumeError`, `OnboardingTierMismatchError` as Data.TaggedError |
| ⏳ | DX-08.2.6 | 3 | L7: Machine | `OnboardingSessionMachine` at `machines/OnboardingSessionMachine.ts`: 9 states with state graph at `machines/graphs/onboarding-session-graph.ts`; transitions: provideCredentials, connect, startDiscovery, confirmDevices, dataFlowing, complete, abandon, timeout; guards: 15-minute SLA timer, tier validation |
| ⏳ | DX-08.2.7 | 3 | L8: ES Handler | `OnboardingSessionHandler` at `handlers/onboarding/`: command handlers for Create, ProvideCredentials, Connect, StartDiscovery, ConfirmDevices, MarkDataFlowing, Complete, Abandon, Timeout; event schemas: OnboardingStarted, OnboardingCredentialsProvided, OnboardingConnected, OnboardingDevicesDiscovered, OnboardingDevicesConfirmed, OnboardingDataFlowing, OnboardingCompleted, OnboardingAbandoned, OnboardingTimedOut |
| ⏳ | DX-08.2.8 | 2 | L9: Entity | `OnboardingSessionEntity` at `entity/OnboardingSessionEntity.ts`: `Entity.make('OnboardingSession')` composing Machine + Handler + Repo; wire to @effect/cluster; 15-minute SLA timer via Effect.schedule; at entity activation, register `makeOnboardingSessionObserver()` with `Machine.changes` stream as scoped fiber — observer auto-participates in real-time via EventDistribution |
| ⏳ | DX-08.2.9 | 2 | L10: Observer | `makeOnboardingSessionObserver()` at `streaming/onboarding-observer.ts`: subscribe to `Machine.changes` stream (scoped fiber at entity activation); pipe through `Stream.zipWithPrevious` (NOT `Stream.pairwise` — does not exist) to derive action from state pairs; emit `EntityStateChanged<OnboardingSession>` events into shared `iiot:entity-changes` EventDistribution channel (maxLag 1k); registered via `makeEntityObserver('OnboardingSession', machineChangesStream)` pattern from PL observer infrastructure; enables real-time wizard progress tracking on admin dashboard |
| ⏳ | DX-08.2.10 | 2 | L11: RPC Group | `OnboardingRpcs` at `rpc/OnboardingRpcs.ts`: CreateSession, GetSession, ResumeSession, AbandonSession, GetSessionsByOrg, GetCompletionMetrics (avg time, success rate, tier distribution); add to IIoTRpcs composition |
| ⏳ | DX-08.2.11 | 1 | L12: HTTP | HTTP routes: `POST /api/v1/onboarding/sessions`, `GET /api/v1/onboarding/sessions/{sessionId}`, `POST /api/v1/onboarding/sessions/{sessionId}/resume`, `GET /api/v1/onboarding/metrics`; add to IIoTApi |
| ⏳ | DX-08.2.12 | 2 | Streaming | `Realtime.SubscribeOnboardingProgress` streaming RPC: consumes `EntityStateChanged<OnboardingSession>` from shared `iiot:entity-changes` EventDistribution channel (filtered by entityType='OnboardingSession'); NO custom streaming — observer infrastructure handles emission, this RPC subscribes and relays via WebSocket for admin monitoring; add to RealtimeRpcs |

#### Tests: OnboardingSession Entity (12+ test files)

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-08.3.1 | 1 | **Schema test** at `__tests__/unit/onboarding-session-schema.test.ts`: decode/encode roundtrip for OnboardingSession, OnboardingSessionId branded validation (OBS- prefix), state literal exhaustiveness (9 states), tier literal (1/2/3), screenIndex range (0-4) |
| ⏳ | DX-08.3.2 | 1 | **Model + DDL test** at `__tests__/integration/onboarding-session-model.test.ts`: Model derivation (JsonFromString for discoveredDeviceIds, FieldOption for completedAt), DDL migration (table exists, indexes on orgId+state, startedAt) |
| ⏳ | DX-08.3.3 | 1 | **Repo integration test** at `__tests__/integration/onboarding-session-repo.test.ts`: CRUD cycle, findIncomplete (excludes COMPLETE/ABANDONED/TIMED_OUT), findByEdgeAgent, getAverageCompletionTime (verifies SLA metric calculation) |
| ⏳ | DX-08.3.4 | 1 | **Error schema test** at `__tests__/unit/onboarding-errors.test.ts`: each error variant (OnboardingTimeoutError, OnboardingCredentialError, OnboardingDiscoveryError, OnboardingResumeError, OnboardingTierMismatchError) constructs and pattern-matches |
| ⏳ | DX-08.3.5 | 2 | **Machine state transition test** at `__tests__/unit/onboarding-session-machine.test.ts`: every valid transition across 9 states; every invalid transition rejected; **guard tests**: 15-minute SLA timer fires TIMED_OUT, tier validation blocks invalid tier assignment; ABANDONED reachable from any non-terminal state |
| ⏳ | DX-08.3.6 | 2 | **ES Handler test** at `__tests__/integration/onboarding-session-handler.test.ts`: each command (Create, ProvideCredentials, Connect, StartDiscovery, ConfirmDevices, MarkDataFlowing, Complete, Abandon, Timeout) produces correct events; verify all 9 event schemas; idempotent Complete/Abandon |
| ⏳ | DX-08.3.7 | 1 | **Entity lifecycle test** at `__tests__/integration/onboarding-session-entity.test.ts`: full CREATED->COMPLETE happy path; CREATED->ABANDONED early exit; SLA timeout fires after 15 minutes (use Effect.TestClock); concurrent command serialization |
| ⏳ | DX-08.3.8 | 2 | **Observer emission test** at `__tests__/integration/onboarding-session-observer.test.ts`: (1) `Machine.changes` stream emits on state transition, (2) observer receives via `Stream.zipWithPrevious` — first emission has `Option.none()` previous → "initialized" action, subsequent emissions derive action from `(prev, current)`, (3) `EntityStateChanged<OnboardingSession>` published to `iiot:entity-changes` EventDistribution channel, (4) roundtrip: trigger transition → verify event arrives on channel subscriber. **NOTE**: Use `it()` + `Effect.runPromise` wrapper per PubSub timeout issue |
| ⏳ | DX-08.3.9 | 1 | **RPC roundtrip test** at `__tests__/integration/onboarding-rpc.test.ts`: CreateSession, GetSession, ResumeSession, AbandonSession, GetSessionsByOrg, GetCompletionMetrics via RpcTest.makeClient |
| ⏳ | DX-08.3.10 | 1 | **HTTP endpoint test** at `__tests__/integration/onboarding-http.test.ts`: POST /api/v1/onboarding/sessions (create), GET /api/v1/onboarding/sessions/{id} (detail), POST /api/v1/onboarding/sessions/{id}/resume (action), GET /api/v1/onboarding/metrics (analytics) |
| ⏳ | DX-08.3.11 | 1 | **Streaming RPC test** at `__tests__/integration/onboarding-streaming.test.ts`: SubscribeOnboardingProgress stream receives state changes; verify admin can monitor multiple concurrent sessions. **NOTE**: Use `it()` + `Effect.runPromise` wrapper per PubSub timeout issue |

**Dependencies**: DX-07 (Edge Agent Bootstrap), PL (platform-architect, observer infrastructure PL-07 to PL-11)
**RFC Sections**: 24.6-24.9
**Coordination**: PR (product-architect — consumes OnboardingRpcs for wizard UI; PR-23 and PR-06 are consumer epics, not entity definitions)
**E2E Stack**: Full 12-layer Machine-backed entity
**Consumers**: PR-23 (wizard Machine integration via RPC), PR-06 (wizard UI component imports schema types), PR-18 (OnboardingRpcs consumer + product-specific stateless RPCs), PR-19 (HTTP routes wrapping DX RPCs), PR-20 (streaming RPC consumer for SLA dashboard)

---

## Phase D: Observability Framework (Sprints 7-8) — 42 SP

### DX-09: OpenTelemetry Integration & Tracing — 26 SP

**RFC Section**: 25.3-25.4

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-09.1.1 | 3 | `@effect/opentelemetry` Layer composition: `NodeSdk.layer` with `BatchSpanProcessor`, `OTLPTraceExporter`, `PeriodicExportingMetricReader` (15s interval) |
| ⏳ | DX-09.1.2 | 5 | `withEntityTracing` HOF: extends `withApiTracing` pattern from `lib/geoint/api/tracing.ts:152-181`; wraps entity handlers with span + counter + latency histogram + error counter |
| ⏳ | DX-09.1.3 | 5 | `withPipelineTracing` HOF: wraps SparkplugPipelineLayer stages (message_received -> topic_parse -> payload_decode -> reading_processor -> alarm_detector -> entity.dispatch) |
| ⏳ | DX-09.1.4 | 3 | Trace context propagation: W3C `traceparent` in NATS message headers, JetStream metadata, WebSocket frame envelope, HTTP headers |
| ⏳ | DX-09.1.5 | 3 | Cross-org trace isolation: terminate trace at anti-corruption layer, create new trace with `tmnl.saga.id` correlation; no raw span/trace IDs cross tenant boundary |
| ⏳ | DX-09.1.6 | 2 | Tiered sampling strategy: 100% for errors/sagas/reconciliation, 50% alarms, 10% state transitions, 1% telemetry readings |
| ⏳ | DX-09.1.7 | 3 | **[E2E: Error Schemas]** Observability-domain error types at `lib/iiot/observability/errors.ts`: `TracingConfigError`, `SpanExportError`, `MetricCollectionError`, `SamplingRuleError` as `Data.TaggedError` — extends existing error taxonomy pattern from `lib/iiot/errors/common.ts` |
| ⏳ | DX-09.1.8 | 2 | **[E2E: L1 Service]** `OtelCollectorService` (Effect.Service): L1 infrastructure service wrapping `@effect/opentelemetry` NodeSdk; manages collector lifecycle, span batching, metric export; dependency of withEntityTracing/withPipelineTracing HOFs |

**Dependencies**: Existing `Effect.withSpan` (137 occurrences in 28 files), InstrumentationService
**RFC Sections**: 25.3, 25.4
**Coordination**: PL (platform-architect, entity handler layer injection points)
**E2E Stack**: Layer 5 (Error Schemas) + Layer 6 (L1/L2 Services)

---

### DX-10: Metrics Architecture & Guarantee Monitor — 16 SP

**RFC Section**: 25.5-25.7

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-10.1.1 | 5 | IIoT metric definitions at `lib/iiot/observability/metrics.ts`: 22 metrics (entity delivery latency, events delivered, active count, state transitions, readings/s, DLQ depth, decode errors, alarm backlog, edge devices, cluster shards, NATS throughput, WS connections, etc.) |
| ⏳ | DX-10.1.2 | 5 | **[E2E: L2 Service]** `GuaranteeMonitorService` (Effect.Service): L2 business logic service for continuous verification of G-1 (sequential), G-4 (session), G-5 (bounded staleness), G-7 (idempotent), G-8 (cross-org staleness); violation counters + span annotations; depends on OtelCollectorService (L1) |
| ⏳ | DX-10.1.3 | 3 | Structured logging: log records correlated with `traceId`/`spanId` via `Effect.log` within `Effect.withSpan` scope; sovereignty-aware routing (per-org edge vs. central aggregation) |
| ⏳ | DX-10.1.4 | 3 | **[E2E: Error Schemas]** Guarantee violation error types: `GuaranteeViolationError<G extends 'G-1'|'G-4'|'G-5'|'G-7'|'G-8'>`, `MetricExportError`, `SloBreachError` as `Data.TaggedError` at `lib/iiot/observability/errors.ts` |

**Dependencies**: DX-09 (OTel Integration)
**RFC Sections**: 25.5, 25.6, 25.7
**E2E Stack**: Layer 5 (Error Schemas) + Layer 6 (L2 Service)

---

## Phase E: Monitoring Infrastructure (Sprints 8-9) — 37 SP

### DX-11: Health Checks & SLO Definitions — 24 SP

**RFC Section**: 26.3-26.4
**Entity Tier**: EdgeDeviceHealth — Lightweight Machine (derived from Sparkplug messages, no DDL/Repo)

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-11.1.1 | 3 | **[E2E: L2 Service]** `HealthCheckService` (Effect.Service): L2 service composing NATS cluster check (`$SYS.REQ.SERVER.PING`), @effect/cluster runner heartbeat, database pool status, JetStream storage; return structured health JSON with worst-of status aggregation |
| ⏳ | DX-11.1.2 | 2 | **[E2E: HTTP Endpoints]** Extend existing `lib/iiot/http/health.ts` liveness probe to full structured health response: `{status, timestamp, checks: {nats, cluster, database, jetstream}, version}` — route: `GET /health` (existing) + `GET /health/detailed` (new) |
| ⏳ | DX-11.1.3 | 3 | **[E2E: L7 Machine]** `EdgeDeviceHealthMachine` at `machines/EdgeDeviceHealthMachine.ts`: 4 states (ONLINE, ACTIVE, STALE, LOST) with state graph; transitions driven by Sparkplug BIRTH/DATA/DEATH message timing; ONLINE (BIRTH received), ACTIVE (DATA within threshold), STALE (no DATA > 2x expected interval), LOST (no DATA > 5x or DEATH received) |
| ⏳ | DX-11.1.4 | 2 | Per-org health indicators: data freshness, alarm backlog, entity staleness %, event delivery rate |
| ⏳ | DX-11.1.5 | 3 | SLO definitions: event delivery latency per ISA-95 level (L0: 100ms P99, L1: 250ms, L2: 500ms, L3: 1s, L4: 5s); alarm ack SLOs by priority; burn rate alerting (14.4x/6x/3x/1x) |
| ⏳ | DX-11.1.6 | 2 | **[E2E: RPC Groups]** `DiagnosticsRpcs` — RpcGroup.make() with: `ConnectionTest` (validate NATS+DB+JetStream connectivity), `DeviceHealth` (query EdgeDeviceHealthMachine state), `SparkplugValidate` (test Sparkplug-B topic + payload); add to IIoTRpcs composition |
| ⏳ | DX-11.1.7 | 2 | **[E2E: HTTP Endpoints]** `POST /diagnostics/connection-test` HTTP route wrapping DiagnosticsRpcs.ConnectionTest; `GET /diagnostics/error-codes` returns full TMNL-E-xxx error code registry as JSON; both added to IIoTApi composition at `lib/iiot/http/index.ts` |
| ⏳ | DX-11.2.1 | 3 | **[E2E: L2 Service]** `EdgeDeviceHealthService` (Effect.Service): L2 service managing EdgeDeviceHealthMachine instances per device; subscribes to Sparkplug BIRTH/DATA/DEATH topics, drives machine transitions, publishes health state changes to NATS `tmnl.health.{orgId}.device.*`; exposes `getDeviceHealth(deviceId)` and `listUnhealthyDevices(orgId)` |

#### Tests: EdgeDeviceHealth + HealthCheckService (4 test files)

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-11.3.1 | 1 | **Machine state transition test** at `__tests__/unit/edge-device-health-machine.test.ts`: all valid transitions (ONLINE->ACTIVE, ACTIVE->STALE, STALE->LOST, LOST->ONLINE); invalid transitions rejected; timing-based transitions (2x/5x expected interval) |
| ⏳ | DX-11.3.2 | 1 | **L2 Service test** at `__tests__/integration/edge-device-health-service.test.ts`: EdgeDeviceHealthService drives machine from Sparkplug messages; BIRTH->ONLINE, DATA->ACTIVE, timeout->STALE, DEATH->LOST; publishes to NATS health subject; getDeviceHealth/listUnhealthyDevices |
| ⏳ | DX-11.3.3 | 1 | **HealthCheckService test** at `__tests__/integration/health-check-service.test.ts`: compose all checks (NATS ping, cluster heartbeat, DB pool, JetStream); worst-of status aggregation; structured health JSON response shape |
| ⏳ | DX-11.3.4 | 1 | **DiagnosticsRpcs + HTTP test** at `__tests__/integration/diagnostics-rpc.test.ts`: ConnectionTest RPC roundtrip; DeviceHealth queries machine state; SparkplugValidate returns validation result; HTTP POST /diagnostics/connection-test; GET /diagnostics/error-codes returns TMNL-E-xxx registry |

**Dependencies**: DX-10 (Metrics), existing health endpoint
**RFC Sections**: 26.3, 26.4
**E2E Stack**: Layer 6 (L2 Service) + Layer 7 (Machine) + Layer 8 (RPC Groups) + Layer 9 (HTTP Endpoints)

---

### DX-12: Alerting & Anomaly Detection — 13 SP

**RFC Section**: 26.5-26.7

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-12.1.1 | 3 | Alert taxonomy: infrastructure / pipeline / tenant health / security / capacity categories; severity P1-P5 with response times and notification channels |
| ⏳ | DX-12.1.2 | 3 | Alert routing: deduplication (5-min window), correlation (shared root cause grouping), maintenance window suppression (P1 always dispatched, P2-P5 suppressible) |
| ⏳ | DX-12.1.3 | 2 | Metric-based alert rules: G-1 violation (rate > 0), G-5 P99 breach, DLQ growth (> 10/min), entity error spike (> 5%) |
| ⏳ | DX-12.1.4 | 3 | Anomaly detection: traffic spike (> 3 sigma), traffic cliff (> 90% drop in 5 min), DLQ depth monitoring (warn > 100, critical > 1000), clock skew detection (NATS < 50ms, edge < 2s) |
| ⏳ | DX-12.1.5 | 2 | NATS monitoring subjects: publish health/metrics/guarantee status to `tmnl.health.{orgId}.*`, `tmnl.platform.shard.*`, `tmnl.platform.guarantee.*` with sovereignty scoping |

**Dependencies**: DX-11 (Health Checks)
**RFC Sections**: 26.5, 26.6, 26.7
**Coordination**: SC (security-architect, security alert routing), IF (infra-architect, NATS $SYS access control)

---

## Phase F: Operations & Migration (Sprints 9-10) — 28 SP

### DX-13: Operational Runbooks — 13 SP

**RFC Section**: 27.3-27.9

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-13.1.1 | 3 | Day-1 runbooks: org onboarding (NATS account + JetStream streams + DB schema + user credentials), edge device provisioning (device JWT + firmware config + NBIRTH verification) |
| ⏳ | DX-13.1.2 | 3 | Incident response runbooks: P1 (total event failure — NATS/cluster/EventDistribution diagnosis), P2 (single hub failure), P3 (individual org connectivity), P4 (non-critical degradation) |
| ⏳ | DX-13.1.3 | 2 | Maintenance window procedures: NATS rolling upgrade (non-leader first, Raft sync, leader stepdown), @effect/cluster version upgrade, database migration (transactional with rollback), edge firmware canary rollout |
| ⏳ | DX-13.1.4 | 3 | Backup/recovery: daily pg_dump, continuous WAL archiving, JetStream stream snapshots, NATS KV backups; DR full metro rebuild (2.5h RTO) |
| ⏳ | DX-13.1.5 | 2 | Compliance operations: audit log review (ISA-18.2 alarm lifecycle, FDA 21 CFR Part 11 work orders), data retention enforcement, right-to-erasure execution (GDPR Art. 17) |

**Dependencies**: Existing entity definitions, existing infrastructure
**RFC Sections**: 27.3-27.9
**Coordination**: SC (security-architect, compliance operations), IF (infra-architect, NATS cluster ops)

---

### DX-14: Migration & Upgrade Strategy — 15 SP

**RFC Section**: 28.3-28.7

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-14.1.1 | 3 | Brownfield integration: strangler fig pattern (Observe -> Augment -> Replace); SparkplugAdapterLive passive subscription to existing MQTT; OPC UA adapter (planned), Modbus adapter (planned) |
| ⏳ | DX-14.1.2 | 3 | Tier promotion paths: T0->T1 (add SparkplugPipelineLayer), T1->T2 (add SingleRunner + EntityHandlers + EventDistribution + WebSocket), T2->T3 (add SocketRunner + HolonetBridge + HttpApi) |
| ⏳ | DX-14.1.3 | 3 | Schema evolution: event `schemaVersion` field, Effect Schema `Union` for multi-version decode, additive-only changes within major version, JetStream stream migration for structural changes |
| ⏳ | DX-14.1.4 | 3 | Zero-downtime edge agent upgrades: rolling upgrade with health gate, NATS leaf node reconnect during binary swap, Nix atomic profile switching + instant rollback |
| ⏳ | DX-14.1.5 | 3 | Canary deployment: 1% -> 10% -> 100% ring progression with gate criteria (error rate, SLO budget, entity state integrity); rollback triggers (error > 2x baseline, G-1 violation, health failure > 5%) |

**Dependencies**: Existing SparkplugPipelineLayer, existing entity Layer composition
**RFC Sections**: 28.3-28.7
**Coordination**: IF (infra-architect, edge device firmware), PL (platform-architect, Layer composition)

---

## Phase G: Conformance & Testing (Cross-Cutting) — See Note

### DX-15: Conformance & Certification Harness — Cross-Cutting

**RFC Section**: 29.2-29.8

This epic is cross-cutting — tasks are executed in parallel with Phases A-F as the underlying features are built. SP are not counted separately; testing is bundled into each epic's implementation tasks.

| Status | Task | Description |
|--------|------|-------------|
| ⏳ | DX-15.1.1 | Conformance level definitions: Level 1 (single-org, G-1 through G-7), Level 2 (manufacturing commons, G-1 through G-8 + NATS isolation + anti-corruption); partial conformance matrix |
| ⏳ | DX-15.1.2 | Tier 1 unit tests: Schema decode/encode roundtrips for all `Schema.TaggedStruct`/`Schema.TaggedClass` entities; state machine exhaustive transition tests; ISA-95 hierarchy validation |
| ⏳ | DX-15.1.3 | Tier 2 property-based tests: hierarchy invariants (fast-check), state machine reachability + determinism, OEE calculation bounds (0 <= OEE <= 1), schema roundtrip invariants |
| ⏳ | DX-15.1.4 | Tier 3 integration tests: EventJournal roundtrip, repository CRUD against Pg+AGE+TimescaleDB, SparkplugPipelineLayer end-to-end, state machine full lifecycle |
| ⏳ | DX-15.1.5 | Tier 4 compliance tests: ISA-18.2 alarm lifecycle (6 states, valid transitions, shelve limits), ISA-95 hierarchy depth 1-9, Sparkplug-B message decode (NBIRTH/DBIRTH/DDATA/DDEATH/STATE) |
| ⏳ | DX-15.1.6 | Tier 5 E2E tests: onboarding flow (org creation -> first OEE in 15 min), partition tolerance (24h offline + replay), multi-tenant isolation (wildcard subject cross-account), alarm lifecycle (threshold -> ack -> clear within SLO) |
| ⏳ | DX-15.1.7 | Performance benchmarks: event throughput (1K readings/s, 100 alarms/s, 200 equipment/s per org; 2M/s aggregate), latency per ISA-95 level (L0 < 100ms P99 through L4 < 5s P99), entity scale (1K per org, 100K per hub), edge (100 sensors@1Hz on RPi4) |
| ⏳ | DX-15.1.8 | Interoperability tests: Sparkplug-B (8 test cases: NBIRTH decode, alias resolution, DDEATH handling, rebirth sequence, unknown alias), OPC UA (browse, read, subscribe, historical access — gated on adapter completion), NATS (subject mapping, JetStream consumer, KV watch, account isolation) |
| ⏳ | DX-15.1.9 | Schema evolution regression: forward compatibility (v(n+1) producer -> v(n) consumer), backward compatibility (v(n) events -> v(n+1) consumer), regression matrix (4 producer/consumer version combinations) |
| ⏳ | DX-15.1.10 | Coverage enforcement: line >= 85%, function >= 85%, branch >= 80%, statement >= 85% for `src/lib/iiot/`; requirement traceability matrix (G-1..G-8, P1..P12 -> test file paths) |
| ⏳ | DX-15.1.11 | Certification process: self-assessment harness, interoperability verification script (2+ certified orgs), performance validation runner, certification report generator |

**Dependencies**: All Phases A-F
**RFC Sections**: 29.2-29.8

---

## Documentation (Bundled with Phases A-C) — 18 SP

### DX-16: Documentation & Examples — 18 SP

**RFC Section**: 23.8.1-23.8.5

| Status | Task | SP | Description |
|--------|------|----|-------------|
| ⏳ | DX-16.1.1 | 3 | "Zero to First Data" getting started guide: CLI install -> `tmnl init` -> device register -> publish reading -> stream tail -> alarm ack; copy-pasteable, < 15 min |
| ⏳ | DX-16.1.2 | 3 | API reference auto-generation pipeline: `Effect Schema -> JSONSchema.make() -> OpenAPI 3.1 -> rendered docs`; includes request/response/error schemas per RPC with TypeScript + curl examples |
| ⏳ | DX-16.1.3 | 5 | Persona tutorials (7 total): Operator ("Your First Dashboard"), Integration Dev ("Connect Your MES", "Build an Alerting Bot"), Platform Dev ("Custom Entity Type", "Stream Processing Pipeline"), Hardware Dev ("Sparkplug-B Device", "Edge Gateway") |
| ⏳ | DX-16.1.4 | 3 | Interactive playground: browser-based WebSocket test panel, subscription builder, JSON syntax-highlighted event stream, form-based RPC payload editor, request/response timing |
| ⏳ | DX-16.1.5 | 2 | Example applications (5): `examples/dashboard` (TS+React), `examples/alerting-bot` (TS), `examples/capacity-monitor` (Python), `examples/edge-gateway` (Rust), `examples/oee-calculator` (TS) |
| ⏳ | DX-16.1.6 | 2 | Error message quality: TMNL-E-1xx through TMNL-E-9xx error code registry; every error includes what/why/suggestion; diagnostic endpoint `POST /diagnostics/connection-test` |

**Dependencies**: DX-01 to DX-06 (SDK, CLI)
**RFC Sections**: 23.8.1-23.8.5, 23.9.1-23.9.4
**Coordination**: PR (product-architect, persona documentation alignment)

---

## Cross-Domain Dependencies

### Inbound (DevEx depends on)

| Dependency | Source Domain | Required For |
|-----------|-------------|--------------|
| NATS account provisioning hierarchy | SC (security-architect) | DX-07 (account provisioning service) |
| Edge sovereignty rules (E-1, E-2, E-3) | IF (infra-architect) | DX-07 (offline-first guarantee) |
| NATS $SYS access control model | IF (infra-architect) | DX-12 (monitoring subjects) |
| Entity handler layer injection points | PL (platform-architect) | DX-09 (withEntityTracing HOF) |
| RPC group composition (IIoTRpcs) | PL (platform-architect) | DX-02 (SDK client generation) |
| Observer infrastructure (makeEntityObserver) | PL (platform-architect, PL-07 to PL-11) | DX-07, DX-08 (Machine.changes wiring) |

### Outbound (Other domains depend on DevEx)

| Dependency | Target Domain | Provided By |
|-----------|-------------|-------------|
| CLI device provisioning commands | IF (infra-architect) | DX-05 (tmnl devices provision) |
| SDK client for marketplace integration | NW (network-architect) | DX-02/DX-03 (@tmnl/sdk, @tmnl/client) |
| Testing harness for security compliance | SC (security-architect) | DX-04 (@tmnl/testing) |
| Observability layer for trust scoring | SC (security-architect) | DX-09 (withEntityTracing) |
| Error code registry | all domains | DX-16 (TMNL-E-xxx codes) |
| **OnboardingSession entity (full 12-layer stack)** | **PR (product-architect)** | **DX-08 (Schema, Machine, Entity, RPCs, Streaming)** |
| OnboardingSession schema types | PR (product-architect) | DX-08.2.1 (imported by PR-06 wizard UI) |
| OnboardingRpcs (CRUD + metrics) | PR (product-architect) | DX-08.2.10 (consumed by PR-18, PR-23) |
| SubscribeOnboardingProgress streaming RPC | PR (product-architect) | DX-08.2.12 (consumed by PR-20 SLA dashboard) |

---

## Existing Codebase Assets (Leveraged, Not Re-Built)

| Asset | Path | Leveraged By |
|-------|------|-------------|
| IIoTRpcs group (16 sub-groups) | `lib/iiot/rpc/index.ts:91-112` | DX-02 (SDK client) |
| RPC error taxonomy (10 types) | `lib/iiot/rpc/errors.ts` | DX-03 (error mapping) |
| RealtimeRpcs (4 stream RPCs) | `lib/iiot/rpc/RealtimeRpcs.ts:183-188` | DX-02 (stream API) |
| SparkplugAdapter + AliasRegistry | `lib/iiot/adapters/sparkplug-adapter.ts` | DX-07 (auto-discovery) |
| SparkplugPipelineLayer | `lib/iiot/adapters/ingestion-service.ts:297-322` | DX-07 (edge agent) |
| IngestionAdapter interface | `lib/iiot/adapters/ingestion.ts:25-36` | DX-14 (brownfield) |
| InstrumentationService | `lib/instrumentation/v1/services/InstrumentationService.ts` | DX-09 (OTel bridge) |
| withApiTracing HOF | `lib/geoint/api/tracing.ts:152-181` | DX-09 (withEntityTracing) |
| snapshotToPrometheus | `lib/geoint/api/metrics-export.ts:328-359` | DX-10 (metric export) |
| Effect.withSpan (137 occurrences) | 28 files across codebase | DX-09 (tracing) |
| 68+ existing test files | `lib/iiot/__tests__/` | DX-15 (conformance) |
| Entity schemas (9 ISA-95 types) | `lib/iiot/schemas/assets/*/schema.ts` | DX-01 (@tmnl/types) |
| HTTP health endpoint | `lib/iiot/http/health.ts` | DX-11 (health checks) |
| EntityStack (12 entity handlers) | `lib/iiot/entity/EntityStack.ts:54-67` | DX-09 (tracing injection) |
| 4 event channels | `lib/iiot/realtime/event-distribution.ts:136-157` | DX-11 (monitoring) |
| AlarmMachine (ISA-18.2) | `lib/iiot/machines/AlarmMachine.ts` | DX-13 (compliance) |
| WorkOrderEntity (FDA 21 CFR 11) | `lib/iiot/entity/WorkOrderEntity.ts` | DX-13 (compliance) |
| Nix modules | `nix/modules/core.nix`, `sparkplug.nix` | DX-06 (CLI distribution) |

---

## SP Summary

| Phase | Epics | SP | Notes |
|-------|-------|----|-------|
| Phase A: SDK & Client Libraries | DX-01, DX-02, DX-03, DX-04 | 55 | +Layer 2 (Model Derivation): DX-01.1.5 |
| Phase B: CLI Tooling | DX-05, DX-06 | 34 | — |
| Phase C: Onboarding Protocol | DX-07, DX-08 | 110 | 2 Machine-backed entities (12-layer each) + 26 test tasks + Machine.changes observer wiring |
| Phase D: Observability Framework | DX-09, DX-10 | 42 | Error Schemas + L1/L2 Services |
| Phase E: Monitoring Infrastructure | DX-11, DX-12 | 37 | Lightweight Machine + 4 test tasks |
| Phase F: Operations & Migration | DX-13, DX-14 | 28 | — |
| Phase G: Conformance & Testing | DX-15 | (cross-cutting) | — |
| Documentation | DX-16 | 18 | — |
| **Total** | **16 epics** | **324 SP** | **+93 SP from original 231 SP** |

### Audit History

| Audit Round | Delta | Running Total |
|-------------|-------|---------------|
| Original WBS | — | 231 SP |
| E2E 10-Layer Audit | +15 SP (6 tasks) | 246 SP |
| Entity Tier Classification | +44 SP (24 entity layer tasks) | 290 SP |
| Per-Entity Test Tasks | +30 SP (26 test tasks) | 320 SP |
| Machine.changes Observer Wiring (Rev 5) | +4 SP (observer + test SP bumps) | 324 SP |
| Auto-Sort Renumbering (Rev 6) | 0 SP (renumber only) | 324 SP |
| OnboardingSession Ownership Resolution (Rev 7) | 0 SP (ownership clarification only) | 324 SP |
| Stale PL Cross-Domain Reference Fix (Rev 8) | 0 SP (PL-34..37 → PL-07..11) | **324 SP** |

### Per-Entity Test Budget

| Entity | Tier | Test Tasks | Test SP | Test Files |
|--------|------|------------|---------|------------|
| EdgeAgent | Machine-Backed (7 states) | DX-07.3.1 to DX-07.3.11 | 14 SP | 11 files |
| OnboardingSession | Machine-Backed (9 states) | DX-08.3.1 to DX-08.3.11 | 14 SP | 11 files |
| EdgeDeviceHealth | Lightweight Machine (4 states) | DX-11.3.1 to DX-11.3.4 | 4 SP | 4 files |
| **Total test tasks** | | **26 tasks** | **32 SP** | **26 files** |

### Machine.changes Architecture Notes

All Machine-backed entities participate in real-time via the same pipeline:

```
Machine.changes (Stream<State>)
  → makeEntityObserver() (scoped fiber per entity instance, registered at entity activation)
    → Stream.zipWithPrevious (NOT Stream.pairwise — does not exist)
      → Option.none() for first emission → "initialized" action
      → (prev, current) for subsequent → derive transition action
    → EntityStateChanged event
      → iiot:entity-changes EventDistribution channel (shared, maxLag 1k)
        → Streaming RPCs → WebSocket clients (filtered by entityType)
        → HolonetBridge → NATS → distributed fan-out
```

**Key constraints**:
- Do NOT build custom streaming per entity — wire into `makeEntityObserver()` pattern from PL (platform-architect, PL-07 to PL-11)
- Observer infrastructure is shared — your entities REGISTER with it, they don't rebuild it
- `Stream.pairwise` does NOT exist in Effect — use `Stream.zipWithPrevious`
- First `Machine.changes` emission has `Option.none()` for previous state — handle as "initialized" action

**PubSub test pattern reminder**: Observer emission tests (DX-07.3.8, DX-08.3.8) and streaming RPC tests (DX-07.3.11, DX-08.3.11) MUST use `it()` + `Effect.runPromise` wrapper, NOT `it.effect()` or `it.scoped()` — they timeout with PubSub + Stream.fromPubSub + Effect.fork.

---

## Renumbering Map

| Old Epic | New Epic | Name |
|----------|----------|------|
| Epic 30 | DX-01 | @tmnl/types — Shared Type Package |
| Epic 31 | DX-02 | @tmnl/sdk — Effect-Native SDK |
| Epic 32 | DX-03 | @tmnl/client — Promise-Based Wrapper |
| Epic 33 | DX-04 | @tmnl/testing — Test Harness Package |
| Epic 34 | DX-05 | tmnl CLI Core |
| Epic 35 | DX-06 | CLI Nix & Distribution |
| Epic 36 | DX-07 | Edge Agent Bootstrap |
| Epic 37 | DX-08 | Onboarding Wizard & Progressive Complexity |
| Epic 38 | DX-09 | OpenTelemetry Integration & Tracing |
| Epic 39 | DX-10 | Metrics Architecture & Guarantee Monitor |
| Epic 40 | DX-11 | Health Checks & SLO Definitions |
| Epic 41 | DX-12 | Alerting & Anomaly Detection |
| Epic 42 | DX-13 | Operational Runbooks |
| Epic 43 | DX-14 | Migration & Upgrade Strategy |
| Epic 44 | DX-15 | Conformance & Certification Harness |
| Epic 45 | DX-16 | Documentation & Examples |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| @effect/opentelemetry API drift | DX-09 rework | Pin version, test in submodule |
| OPC UA adapter complexity underestimated | DX-14 delays | Defer to separate epic if > 13 SP |
| Edge agent binary size > 100MB | Onboarding SLA miss (slow download) | Tree-shake, compress, offer USB sideload |
| 200K org cardinality explosion | Metric storage costs | Sovereign metrics on edge, pre-aggregated rollups to cloud |
| Python/Rust SDK scope creep | Phase A overrun | Defer tmnl-py and tmnl-rs to separate WBS; TypeScript-first |
| Canary deployment infra not ready | DX-14 blocked | Use manual ring progression initially |
