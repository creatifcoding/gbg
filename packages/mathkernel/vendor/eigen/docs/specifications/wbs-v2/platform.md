# WBS V2 — Core Platform Domain (PL)

**Author**: platform-architect
**Date**: 2026-02-13
**Domain Prefix**: **PL** (Platform)
**RFC Source**: `docs/specifications/rfc-entity-realtime-integration.md` (Sections 1-14, lines 193-5854)
**Baseline**: WBS V1 — 266/266 SP COMPLETE (26 epics, 7 phases)

---

## Methodology

### Gap Analysis

WBS V1 delivered: Schemas, Models, DDL, Repos, Errors, L1/L2 Services, ES Infrastructure,
Alarm/WorkOrder/EquipmentState domain ES, Regulatory (ISA-18.2), Entity definitions,
State services, Event/Entity handlers, 17 RPC groups (121+ RPCs), HTTP API, Ingestion
pipeline, Sparkplug-B, WebSocket realtime (4 streaming RPCs), SQL state adapters,
Architecture docs, Pattern docs, CLIs.

**This WBS covers ONLY new work** specified by RFC-001 Parts I-III that WBS V1 did NOT build.

### Verification

Key patterns verified via deepwiki (`Effect-TS/effect`):

| Pattern | Status | Correction |
|---------|--------|------------|
| `Machine.changes` returns Stream | VERIFIED | -- |
| `Entity.make` accepts Machine | REFUTED | Entity.make takes type name + Rpc.Any[], not Machine directly |
| `ClusterSchema.ShardGroup` for shard assignment | VERIFIED | -- |
| `Stream.pairwise` for [prev,curr] tuples | REFUTED | Use `Stream.zipWithPrevious` (returns `[Option<A>, A]`) |
| `RpcMiddleware.Tag` with `wrap: true` | VERIFIED | -- |
| `RpcGroup.make` composes Rpc definitions | VERIFIED | Also supports `.add()` and `.merge()` |

### SP Estimation Guide

| Size | SP | Examples |
|------|----|----------|
| Trivial | 1 | Single branded ID, barrel export |
| Small | 2-3 | Schema definition, simple repo method |
| Medium | 5 | Service with 3-5 methods, migration |
| Large | 8 | Complex service with dependencies, integration tests |
| XL | 13 | Full subsystem (e.g., observer factory + wiring) |

---

## E2E Stack Audit (Two-Tier)

### Entity Classification

This WBS introduces **no new Machine-backed entities**. All 12 existing Machine-backed entities
(Enterprise, Site, Area, Plant, Line, WorkCell, Machine, Device, Sensor, Alarm, WorkOrder,
EquipmentState) already have their full 12-layer stacks from WBS V1. This WBS adds **layer 10
(Observer)** to each via PL-08.

The one **new persistable data type** is `EntityStateChanged` — a CRUD event record (no lifecycle
states, no Machine). It gets the 8-layer CRUD stack.

### EntityStateChanged — CRUD (8 layers)

| # | Layer | Status | Epic(s) |
|---|-------|--------|---------|
| 1 | Schema | YES | PL-01 (EntityStateChanged TaggedClass, branded IDs, filters) |
| 2 | Model | YES | PL-05 (EntityStateChangedModel, EntityChangeViewModel) |
| 3 | DDL | YES | PL-05 (entity_state_changes + entity_change_sequences tables) |
| 4 | Repository | YES | PL-05 (EntityChangeRepository) |
| 5 | Errors | YES | PL-06 (entity-observer.ts, propagation.ts, tenant.ts) |
| 6 | L2 Service | YES | PL-10 (EntityChangeService — query, retention, statistics) |
| 7 | RPC Group | YES | PL-09 (SubscribeEntityChanges streaming RPC) |
| 8 | HTTP Routes | YES | PL-14 (REST API for entity changes) |

### Existing 12 Machine-Backed Entities — Layer 10 Addition

| # | Layer | Status | Epic(s) |
|---|-------|--------|---------|
| 10 | Observer | **NEW** | PL-07 (makeEntityObserver factory), PL-08 (wiring into all 12 handlers) |

N/A layers for platform cross-cutting: Machine (7), ES Handler (8), Entity (9) — these
already exist in WBS V1 for all 12 entities. This WBS does not modify them.

### Cross-Cutting Infrastructure (not entity-specific)

| Component | Type | Epic(s) |
|-----------|------|---------|
| EventDistribution 5th channel | Service extension | PL-02 |
| Feature flags + sequence tracking | Infrastructure | PL-03 |
| NATS subject hierarchy | Transport config | PL-04 |
| Consistency guarantees | Protocol implementation | PL-11 |
| ISA-95 propagation rules | Code utility (NOT a CRUD entity) | PL-12 |
| Worst-of aggregation + cascade | Service utility | PL-13 |
| Three-tier delivery model | Transport config | PL-16 |
| Shard groups + cluster config | Cluster infrastructure | PL-17 |
| TenantIsolation middleware | RPC middleware | PL-18 |
| Five-tier layer composition | Layer restructure | PL-19 |
| Per-org stream isolation | Stream infrastructure | PL-20 |
| Extended EventDistribution (7ch) | Service extension | PL-21 |
| PropagationService L2 | L2 service (for propagation rules, NOT entity CRUD) | PL-15 |
| Test infrastructure | Testing | PL-22, PL-23 |

---

## Phase A: Entity Event Foundation (Sprints 1-3) — 63 SP

### PL-01: EntityStateChanged Schema & Event Infrastructure — 13 SP

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-01.1.1 | Define `EntityStateChanged` TaggedClass schema with entityType discriminator (12 entity types), action, previousState, currentState, isaLevel (L0-L4, ES), changedAt (DateTimeUtc), changedBy, cascadeScope, parentEntityId/Type, originNodeId — 3 SP |
| :hourglass_flowing_sand: | PL-01.1.2 | Define branded identifiers: `OrgId` (pattern `org_[a-zA-Z0-9]{20}`), `CapabilityId` (pattern `cap_[a-zA-Z0-9]{20}`), `ReputationScore` (between 0-100) — 2 SP |
| :hourglass_flowing_sand: | PL-01.1.3 | Define `EntityType` and `IsaLevel` Schema.Literal unions for reuse across schemas — 1 SP |
| :hourglass_flowing_sand: | PL-01.1.4 | Define `EntityChangeFilter` schema for SubscribeEntityChanges RPC payload (entityTypes, isaLevels, entityIds, includeCascade) — 2 SP |
| :hourglass_flowing_sand: | PL-01.1.5 | Define transition-to-action derivation utility: given a graph definition (states + transitions), produce `Record<string, Record<string, string>>` mapping `[fromState][toState] -> actionName` — 3 SP |
| :hourglass_flowing_sand: | PL-01.2.1 | Unit tests for EntityStateChanged encode/decode, filter matching, action derivation — 2 SP |

**Dependencies**: None (foundational)
**RFC Sections**: S8, S12.3

---

### PL-02: 5th EventDistribution Channel — 8 SP

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-02.1.1 | Extend `EventDistributionShape` interface with `publishEntityChange(event: EntityStateChanged) => Effect<void>` and `subscribeEntityChanges => Effect<Stream<EntityStateChanged>>` — 3 SP |
| :hourglass_flowing_sand: | PL-02.1.2 | Add `entity-changes` channel to ChannelService with `PubSub.sliding({ capacity: 2_000 })` backpressure strategy — 2 SP |
| :hourglass_flowing_sand: | PL-02.1.3 | Extend `HolonetBridgeShape` with `remoteEntityChanges => Stream<EntityStateChanged>` for NATS-bridged entity events — 2 SP |
| :hourglass_flowing_sand: | PL-02.2.1 | Integration test: publish EntityStateChanged, subscribe, verify roundtrip (use plain `it()` + `Effect.runPromise`, NOT `it.effect()` due to PubSub incompatibility) — 1 SP |

**Dependencies**: PL-01
**RFC Sections**: S9.1, S11.5

---

### PL-03: Feature Flags & Observability Scaffolding — 5 SP

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-03.1.1 | Add `entityRealtimeEnabled` feature flag to existing feature flag system (default: false for gradual rollout) — 1 SP |
| :hourglass_flowing_sand: | PL-03.1.2 | Add per-entity sequence number tracking: `EntitySequenceTracker` service maintaining monotonic counters per `{entityType, entityId}` — 3 SP |
| :hourglass_flowing_sand: | PL-03.1.3 | Add `EventLatencyExceeded` alert type for monitoring entity event delivery latency — 1 SP |

**Dependencies**: PL-01
**RFC Sections**: S10.3, S12.1

---

### PL-04: NATS Subject Hierarchy for Entity Events — 8 SP

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-04.1.1 | Define NATS subject schema: `iiot.entities.{entityType}.{entityId}` — utility functions for subject construction and parsing — 2 SP |
| :hourglass_flowing_sand: | PL-04.1.2 | Define extended hierarchical subjects: `iiot.{orgId}.{site}.{area}.{line}.{cell}.{entityType}.{entityId}` for ISA-95 path encoding — 3 SP |
| :hourglass_flowing_sand: | PL-04.1.3 | JetStream stream configuration for entity events: `ENTITY_EVENTS` stream with subjects `iiot.entities.>`, max_age 24h, max_bytes per org quota — 2 SP |
| :hourglass_flowing_sand: | PL-04.2.1 | Unit tests for subject construction, parsing, wildcard matching — 1 SP |

**Dependencies**: PL-01
**RFC Sections**: S5.9, S9.2, S9.3

---

### PL-05: EntityStateChanged Model, DDL & Repository — 19 SP

Covers layers 2-4 of the E2E stack for entity state change persistence.

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-05.1.1 | Define `EntityStateChangedModel` using `Model.Class` — derives from EntityStateChanged schema with Model-specific transforms: `Model.Generated` for ID, `Model.FieldOption` for optional fields (cascadeScope, parentEntityId, parentEntityType, originNodeId, causedBy), `CreatedAt` for changedAt — 3 SP |
| :hourglass_flowing_sand: | PL-05.1.2 | Define `EntityChangeViewModel` — list view model with computed fields: `durationSinceChange`, `isaLevelLabel`, `cascadeIndicator` — 2 SP |
| :hourglass_flowing_sand: | PL-05.2.1 | DDL: `iiot.entity_state_changes` table with columns matching model, indexes on `(entity_type, entity_id)`, `(isa_level)`, `(changed_at DESC)`, `(org_id)` — partition by `changed_at` for time-series queries — 3 SP |
| :hourglass_flowing_sand: | PL-05.2.2 | DDL: `iiot.entity_change_sequences` table for per-entity monotonic sequence tracking (entityType, entityId, lastSequence) with UPSERT on conflict — 1 SP |
| :hourglass_flowing_sand: | PL-05.3.1 | Define `EntityChangeRepository` with Effect SQL patterns: `insert`, `findById`, `findByEntity(entityType, entityId)`, `findByFilter(EntityChangeFilter)` with pagination, `getLatestByEntity` — 3 SP |
| :hourglass_flowing_sand: | PL-05.4.1 | **Model test**: EntityStateChangedModel encode/decode roundtrip, EntityChangeViewModel computed fields (durationSinceChange, isaLevelLabel, cascadeIndicator) — 2 SP |
| :hourglass_flowing_sand: | PL-05.4.2 | **DDL migration test**: verify entity_state_changes table exists with correct columns, constraints, indexes; entity_change_sequences UPSERT on conflict — 2 SP |
| :hourglass_flowing_sand: | PL-05.4.3 | **Repo integration test**: full CRUD roundtrip (insert -> findById -> findByEntity -> findByFilter with pagination -> getLatestByEntity), filter query correctness with edge cases — 3 SP |

**Dependencies**: PL-01, PL-11 (sequence tracking)
**RFC Sections**: S8, S10.3

---

### PL-06: Entity Observer & Propagation Error Schemas — 10 SP

Covers layer 5 of the E2E stack — dedicated error types per domain.

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-06.1.1 | Define `src/lib/iiot/errors/entity-observer.ts`: `ObserverInitializationError` (observer failed to start), `ObserverAlreadyActiveError` (duplicate observer for same entity), `TransitionMapMissingError` (no action mapping for state pair) — 2 SP |
| :hourglass_flowing_sand: | PL-06.1.2 | Define `src/lib/iiot/errors/propagation.ts`: `PropagationCycleDetectedError` (infinite cascade loop), `PropagationDepthExceededError` (cascade too deep), `HierarchyResolutionError` (cannot resolve children for cascade), `InvalidPropagationRuleError` (rule condition/action mismatch) — 3 SP |
| :hourglass_flowing_sand: | PL-06.1.3 | Define `src/lib/iiot/errors/tenant.ts`: `TenantNotAuthenticatedError` (no OrgId in request context), `TenantAccessDeniedError` (org not authorized for resource), `TenantSuspendedError` (org in suspended state) — 2 SP |
| :hourglass_flowing_sand: | PL-06.1.4 | Export union types per domain: `EntityObserverError`, `PropagationError`, `TenantError` — barrel exports in `errors/index.ts` — 1 SP |
| :hourglass_flowing_sand: | PL-06.2.1 | **Error schema tests**: each error variant constructs correctly, `_tag` discriminator works, union types exhaustive match via `Effect.catchTags`, Data.TaggedError equality — 2 SP |

**Dependencies**: PL-01
**RFC Sections**: S10, S12, S11.4

---

## Phase B: Entity Observer Wiring (Sprints 4-6) — 74 SP

### PL-07: makeEntityObserver Factory — 13 SP

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-07.1.1 | Implement `makeEntityObserver` factory function: accepts Machine actor, entityType, entityId, isaLevel, transitionMap, cascadeScope. Uses `actor.changes` piped through `Stream.zipWithPrevious` (NOT `Stream.pairwise` — does not exist), derives action from transitionMap, constructs EntityStateChanged, publishes via EventDistribution. Runs as `Effect.forkScoped` with finalizer. — 8 SP |
| :hourglass_flowing_sand: | PL-07.1.2 | Handle `Option.none()` first element from `Stream.zipWithPrevious` — emit "initialized" action for first state observation — 1 SP |
| :hourglass_flowing_sand: | PL-07.1.3 | Feature flag guard: observer no-ops when `entityRealtimeEnabled` is false — 1 SP |
| :hourglass_flowing_sand: | PL-07.2.1 | Unit tests for observer factory: state transition -> EntityStateChanged event emission, feature flag bypass, finalizer cleanup — 3 SP |

**Dependencies**: PL-01, PL-02, PL-03
**RFC Sections**: S12.1, S12.2

**IMPORTANT RFC CORRECTION**: The RFC specifies `Stream.pairwise` in Section 12.1. This API does NOT exist in Effect-TS. The correct API is `Stream.zipWithPrevious` which returns `[Option<A>, A]` tuples. The first element has `Option.none()` as previous, requiring special handling.

---

### PL-08: Entity Handler Observer Wiring (12 Handlers) — 34 SP

This is a **breaking change** — each entity handler gains an `EventDistribution` dependency.

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-08.1.1 | Generate transition-to-action maps for all 12 entity types from existing graph definitions (Enterprise, Site, Area, Plant, Line, WorkCell, Machine, Device, Sensor, Alarm, WorkOrder, EquipmentState) — 5 SP |
| :hourglass_flowing_sand: | PL-08.2.1 | Wire observer into `AlarmHandler` — add EventDistribution dependency, call makeEntityObserver with Alarm machine, isaLevel='ES', cascadeScope='none' — 2 SP |
| :hourglass_flowing_sand: | PL-08.2.2 | Wire observer into `WorkOrderHandler` — isaLevel='ES', cascadeScope='none' — 2 SP |
| :hourglass_flowing_sand: | PL-08.2.3 | Wire observer into `EquipmentStateHandler` — isaLevel='L2', cascadeScope='direct_children' — 2 SP |
| :hourglass_flowing_sand: | PL-08.2.4 | Wire observer into `MachineHandler` — isaLevel='L2', cascadeScope='direct_children' — 2 SP |
| :hourglass_flowing_sand: | PL-08.2.5 | Wire observer into `DeviceHandler` — isaLevel='L1', cascadeScope='none' — 1 SP |
| :hourglass_flowing_sand: | PL-08.2.6 | Wire observer into `SensorHandler` — isaLevel='L0', cascadeScope='none' — 1 SP |
| :hourglass_flowing_sand: | PL-08.2.7 | Wire observer into `WorkCellHandler` — isaLevel='L2', cascadeScope='direct_children' — 2 SP |
| :hourglass_flowing_sand: | PL-08.2.8 | Wire observer into `LineHandler` — isaLevel='L3', cascadeScope='direct_children' — 2 SP |
| :hourglass_flowing_sand: | PL-08.2.9 | Wire observer into `AreaHandler` — isaLevel='L3', cascadeScope='all_descendants' — 2 SP |
| :hourglass_flowing_sand: | PL-08.2.10 | Wire observer into `PlantHandler` / `SiteHandler` / `EnterpriseHandler` — isaLevel='L4', cascadeScope='all_descendants' — 3 SP |
| :hourglass_flowing_sand: | PL-08.3.1 | Update EntityStack to include EventDistribution in its dependency graph — update test layers to provide mock EventDistribution — 2 SP |
| :hourglass_flowing_sand: | PL-08.4.1 | **Observer emission tests** (3 ES handlers): Trigger Alarm/WorkOrder/EquipmentState state transitions, verify EntityStateChanged emitted with correct entityType, isaLevel, action, cascadeScope. Use mock EventDistribution to capture events — 3 SP |
| :hourglass_flowing_sand: | PL-08.4.2 | **Observer emission tests** (6 hierarchy handlers): Trigger Machine/Device/Sensor + WorkCell/Line/Area state transitions, verify correct ISA levels and cascade scopes per handler — 3 SP |
| :hourglass_flowing_sand: | PL-08.4.3 | **Observer emission tests** (3 top-level handlers): Trigger Plant/Site/Enterprise state transitions, verify L4 level, all_descendants cascade scope, parent entity metadata — 2 SP |

**Dependencies**: PL-07, all existing entity handlers (WBS V1 Phase 3)
**RFC Sections**: S12.4, S12.5

---

### PL-09: SubscribeEntityChanges Streaming RPC — 8 SP

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-09.1.1 | Define `SubscribeEntityChanges` RPC with `stream: true`, payload `EntityChangeFilter`, success `EntityStateChanged`, error `RealtimeError` — 2 SP |
| :hourglass_flowing_sand: | PL-09.1.2 | Implement server-side handler: subscribe to entity-changes channel, apply filter (entityTypes, isaLevels, entityIds, includeCascade), return filtered Stream — 3 SP |
| :hourglass_flowing_sand: | PL-09.1.3 | Add to existing Realtime RpcGroup (merge with existing 4 streaming RPCs) — 1 SP |
| :hourglass_flowing_sand: | PL-09.2.1 | Integration test: publish multiple EntityStateChanged events with different types/levels, subscribe with filter, verify only matching events received — 2 SP |

**Dependencies**: PL-02, PL-07
**RFC Sections**: S13

---

### PL-10: EntityChangeService L2 — 8 SP

Covers layer 6 of the CRUD stack for EntityStateChanged — business logic wrapping the repository.

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-10.1.1 | Define `EntityChangeService` as `Effect.Service<>()` with methods: `record(event: EntityStateChanged) => Effect<void>` (assigns sequence, persists to repo), `query(filter: EntityChangeFilter, pagination) => Effect<Page<EntityStateChanged>>`, `getLatest(entityType, entityId) => Effect<Option<EntityStateChanged>>`, `getHistory(entityType, entityId, timeRange) => Effect<EntityStateChanged[]>` — 3 SP |
| :hourglass_flowing_sand: | PL-10.1.2 | Retention policy: `pruneOlderThan(duration: Duration) => Effect<number>` — deletes entity changes older than configured retention period, returns count deleted — 2 SP |
| :hourglass_flowing_sand: | PL-10.1.3 | Statistics: `getChangeRate(entityType, timeWindow) => Effect<number>` — computes events/sec for monitoring dashboards — 1 SP |
| :hourglass_flowing_sand: | PL-10.2.1 | Unit tests: record with sequence assignment, query with filter, retention pruning, change rate calculation — 2 SP |

**Dependencies**: PL-05 (EntityChangeRepository), PL-11 (sequence tracking)
**RFC Sections**: S8, S10.3, S14

---

### PL-11: Consistency Guarantee Implementation — 11 SP

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-11.1.1 | Per-entity sequence numbers: EntitySequenceTracker assigns monotonic sequence to each EntityStateChanged before publish. Verify G-1 (per-entity sequential ordering) — 3 SP |
| :hourglass_flowing_sand: | PL-11.1.2 | `causedBy` metadata: extend EntityStateChanged with optional `causedBy: Schema.optional(Schema.String)` for causal chain tracking (G-2 causal ordering) — 1 SP |
| :hourglass_flowing_sand: | PL-11.1.3 | Content-addressed message IDs: compute deterministic ID from `{entityType, entityId, sequence, changedAt}` for idempotent processing (G-6) — 2 SP |
| :hourglass_flowing_sand: | PL-11.1.4 | Two-timestamp envelope: `domainTimestamp` (when state changed) + `publishTimestamp` (when event distributed) for bounded staleness (G-5) — 2 SP |
| :hourglass_flowing_sand: | PL-11.2.1 | **Consistency guarantee tests**: G-1 (sequence monotonically increases per entity), G-2 (causedBy chain preserved), G-5 (domainTimestamp <= publishTimestamp), G-6 (duplicate message ID rejected as idempotent) — 3 SP |

**Dependencies**: PL-01, PL-03
**RFC Sections**: S10.1, S10.2, S10.3

---

## Phase C: Cascade, Propagation & HTTP (Sprints 7-9) — 46 SP

### PL-12: ISA-95 Propagation Rules Engine — 13 SP

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-12.1.1 | Define `PropagationDirection` union: `'upward' | 'downward' | 'lateral' | 'outward'` and `PropagationRule` schema with direction, condition, and action — 2 SP |
| :hourglass_flowing_sand: | PL-12.1.2 | Implement upward propagation rules (U-1: worst-of aggregation for parent status, U-2: capacity reduction from child degradation, U-3: alarm escalation, U-4: maintenance window propagation) — 5 SP |
| :hourglass_flowing_sand: | PL-12.1.3 | Implement downward propagation rules (D-1: emergency stop cascade, D-2: configuration change distribution, D-3: schedule propagation) — 3 SP |
| :hourglass_flowing_sand: | PL-12.1.4 | Implement lateral propagation rules (L-1: upstream failure notification, L-2: demand change propagation, L-3: shared resource contention) — 3 SP |

**Dependencies**: PL-07, PL-08
**RFC Sections**: S5.4, S5.5, S5.6, S5.7

---

### PL-13: Worst-of Aggregation & Cascade Execution — 8 SP

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-13.1.1 | Implement `worstChildStatus` aggregator: given parent entity, query all direct children statuses, compute worst-of using ISA-95 severity ordering — 3 SP |
| :hourglass_flowing_sand: | PL-13.1.2 | Cascade executor: when EntityStateChanged has cascadeScope 'direct_children' or 'all_descendants', resolve children via equipment hierarchy, apply propagation rules — 3 SP |
| :hourglass_flowing_sand: | PL-13.2.1 | Integration tests: parent state change cascades to children, worst-of aggregation propagates upward, cycle detection prevents infinite loops — 2 SP |

**Dependencies**: PL-12, existing equipment hierarchy (WBS V1)
**RFC Sections**: S5.3, S5.4

---

### PL-14: Entity Changes HTTP Endpoints — 9 SP

Covers layer 8 of the E2E CRUD stack — REST API wrapping entity change RPCs.

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-14.1.1 | `GET /api/iiot/entity-changes` — list entity state changes with pagination, filter by entityType, isaLevel, entityId, date range. Wraps EntityChangeService.query — 3 SP |
| :hourglass_flowing_sand: | PL-14.1.2 | `GET /api/iiot/entity-changes/:id` — get single entity state change by ID. Wraps EntityChangeService — 1 SP |
| :hourglass_flowing_sand: | PL-14.1.3 | `GET /api/iiot/entity-changes/latest/:entityType/:entityId` — get latest state change for a specific entity. Wraps EntityChangeService.getLatest — 1 SP |
| :hourglass_flowing_sand: | PL-14.1.4 | `GET /api/iiot/entity-changes/stream` — SSE endpoint for entity change streaming (HTTP alternative to WebSocket RPC). Wraps SubscribeEntityChanges with SSE transport — 2 SP |
| :hourglass_flowing_sand: | PL-14.2.1 | **HTTP endpoint tests**: GET list with pagination + filters, GET by ID (found + not found), GET latest per entity, SSE streaming subscribe + receive + disconnect — 2 SP |

**Dependencies**: PL-09, PL-05
**RFC Sections**: S13, S14

---

### PL-15: PropagationService L2 — 8 SP

Covers layer 6 of the E2E stack — business logic service wrapping propagation rules engine.

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-15.1.1 | Define `PropagationService` as `Effect.Service<>()` with methods: `evaluateRules(event: EntityStateChanged) => Effect<PropagationAction[]>`, `executeCascade(event, actions) => Effect<void>`, `resolveChildren(entityType, entityId, scope) => Effect<EntityRef[]>` — 3 SP |
| :hourglass_flowing_sand: | PL-15.1.2 | Wire PropagationService into makeEntityObserver: after publishing EntityStateChanged, if cascadeScope !== 'none', call `propagationService.evaluateRules(event)` and execute resulting actions — 2 SP |
| :hourglass_flowing_sand: | PL-15.1.3 | Cycle detection: maintain in-flight cascade set per request, reject if same `{entityType, entityId}` appears twice in cascade chain — 1 SP |
| :hourglass_flowing_sand: | PL-15.2.1 | Unit tests: rule evaluation produces correct actions, cascade executes against children, cycle detection terminates infinite loops — 2 SP |

**Dependencies**: PL-12, PL-13, PL-06 (error types)
**RFC Sections**: S5.4, S5.5, S5.6

---

### PL-16: Three-Tier Delivery Model — 8 SP

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-16.1.1 | Hot Path configuration: Core NATS pub/sub for entity events, p99 < 3s target, fire-and-forget delivery — 2 SP |
| :hourglass_flowing_sand: | PL-16.1.2 | Warm Path configuration: JetStream with `max_deliver: 3`, `ack_wait: 10s`, `max_pending: 1000` for guaranteed delivery within 30s — 3 SP |
| :hourglass_flowing_sand: | PL-16.1.3 | Cold Path configuration: JetStream file storage with `max_age: 24h`, `max_bytes` per-org quota, replay capability for historical analysis — 2 SP |
| :hourglass_flowing_sand: | PL-16.1.4 | Cross-tier event promotion: events that fail Hot Path delivery are promoted to Warm Path automatically — 1 SP |

**Dependencies**: PL-04
**RFC Sections**: S5.8

---

## Phase D: Multi-Tenant & Cluster Architecture (Sprints 10-12) — 42 SP

### PL-17: Shard Group & Cluster Configuration — 8 SP

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-17.1.1 | Define 5 shard groups using `ClusterSchema.ShardGroup`: orgs, assets, equipment, telemetry, events — annotate existing entities with group assignment — 3 SP |
| :hourglass_flowing_sand: | PL-17.1.2 | Configure `ShardingConfig` with shard group to runner mapping — single-runner dev mode vs multi-runner production — 2 SP |
| :hourglass_flowing_sand: | PL-17.1.3 | Define runner topology types: SocketRunner, HttpRunner, SingleRunner, TestRunner — with Layer factories — 2 SP |
| :hourglass_flowing_sand: | PL-17.2.1 | Unit tests for shard group assignment, runner topology selection — 1 SP |

**Dependencies**: Existing entity definitions (WBS V1 Phase 3)
**RFC Sections**: S11.1, S11.2

---

### PL-18: TenantIsolation Middleware — 8 SP

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-18.1.1 | Define `TenantIsolation` using `RpcMiddleware.Tag` with `wrap: true` — extracts OrgId from JWT/request context, injects into handler scope — 3 SP |
| :hourglass_flowing_sand: | PL-18.1.2 | Define `CurrentTenant` Context.Tag for handlers to access the authenticated organization — 1 SP |
| :hourglass_flowing_sand: | PL-18.1.3 | Apply TenantIsolation middleware to all entity RPC groups — 2 SP |
| :hourglass_flowing_sand: | PL-18.2.1 | Unit tests: middleware extracts tenant, rejects unauthenticated requests, scopes data access — 2 SP |

**Dependencies**: PL-01 (OrgId branded type)
**RFC Sections**: S11.4

---

### PL-19: Five-Tier Layer Composition — 13 SP

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-19.1.1 | Define `InfraLayer`: mergeAll(NatsClientLive, PostgresPoolLive, TimescaleDBLive, RedisClientLive, AuthServiceLive) — restructure existing infra services into explicit tier — 3 SP |
| :hourglass_flowing_sand: | PL-19.1.2 | Define `DomainLayer`: mergeAll(OrgServiceLive, EquipmentServiceLive, ...) provided by InfraLayer — consolidate existing L2 services — 2 SP |
| :hourglass_flowing_sand: | PL-19.1.3 | Define `StreamLayer`: mergeAll(EventDistributionLive, ChannelServiceLive, HolonetBridgeLive, ReactivityBridgeLive) — promote event/stream services to explicit tier — 2 SP |
| :hourglass_flowing_sand: | PL-19.1.4 | Define `RpcLayer`: mergeAll(all RPC handler layers, TenantIsolationLive, RpcSerialization.layerJson, WebSocketServerLive) — consolidate transport tier — 2 SP |
| :hourglass_flowing_sand: | PL-19.1.5 | Define `ClusterLayer`: mergeAll(all Entity layers, Sharding.layer, runner layer, SqlRunnerStorage.layer, SqlMessageStorage.layer) — top-level cluster composition — 2 SP |
| :hourglass_flowing_sand: | PL-19.2.1 | Integration test: full 5-tier layer boots without missing dependencies — 2 SP |

**Dependencies**: PL-17, PL-18, all existing services (WBS V1)
**RFC Sections**: S11.6

---

### PL-20: Per-Organization Stream Isolation — 5 SP

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-20.1.1 | Implement `Stream.groupByKey` partitioning for entity-changes channel by orgId — each organization gets isolated stream processing — 3 SP |
| :hourglass_flowing_sand: | PL-20.1.2 | Per-organization backpressure: org-specific sliding window prevents noisy neighbor degradation — 1 SP |
| :hourglass_flowing_sand: | PL-20.2.1 | Unit test: multi-org stream isolation, verify events don't cross organization boundaries — 1 SP |

**Dependencies**: PL-02, PL-18
**RFC Sections**: S11.5

---

### PL-21: Extended EventDistribution (7 Channels) — 8 SP

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-21.1.1 | Add `marketplace` channel (PubSub.bounded, capacity 500) for capability advertisements and market signals — 2 SP |
| :hourglass_flowing_sand: | PL-21.1.2 | Add `org-lifecycle` channel (PubSub.bounded, capacity 100) for organization state machine events (onboarding, suspension, deactivation) — 2 SP |
| :hourglass_flowing_sand: | PL-21.1.3 | Backpressure strategy configuration: `readings` sliding 10K, `alarms/equipment/invalidations` bounded 1K, `entity-changes` sliding 2K, `marketplace` bounded 500, `org-lifecycle` bounded 100 — 2 SP |
| :hourglass_flowing_sand: | PL-21.2.1 | Integration tests for all 7 channels: publish/subscribe roundtrip — 2 SP |

**Dependencies**: PL-02 (5th channel already added)
**RFC Sections**: S11.5

---

## Phase E: Testing Architecture (Sprints 13-14) — 18 SP

### PL-22: Cluster & Observer Test Infrastructure — 10 SP

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-22.1.1 | Define `TestRunner.layer` for in-process cluster testing without network — 3 SP |
| :hourglass_flowing_sand: | PL-22.1.2 | Define `Entity.makeTestClient` utility for testing entity RPC handlers in isolation — 2 SP |
| :hourglass_flowing_sand: | PL-22.1.3 | Mock `EventDistribution` layer for handler tests: captures published events without channel infrastructure — 2 SP |
| :hourglass_flowing_sand: | PL-22.1.4 | PubSub test constraints: document and enforce `it()` + `Effect.runPromise` pattern for PubSub roundtrip tests (NOT `it.effect()` — known timeout issue) — 1 SP |
| :hourglass_flowing_sand: | PL-22.1.5 | Property-based tests: generate random EntityStateChanged events, verify schema encode/decode roundtrip, filter matching — 2 SP |

**Dependencies**: PL-01, PL-02, PL-07
**RFC Sections**: S11.7

---

### PL-23: End-to-End Entity Realtime Tests — 8 SP

| Status | Task | Description |
|--------|------|-------------|
| :hourglass_flowing_sand: | PL-23.1.1 | E2E test: Machine state change -> observer -> EventDistribution -> SubscribeEntityChanges RPC -> client receives event — 3 SP |
| :hourglass_flowing_sand: | PL-23.1.2 | E2E test: cascade scenario — parent Equipment state change -> observer -> propagation engine -> child entities receive cascade events — 3 SP |
| :hourglass_flowing_sand: | PL-23.1.3 | Load test skeleton: generate N entity state changes/sec, measure p99 latency against NFR targets (p99 < 3s hot path, < 30s warm path) — 2 SP |

**Dependencies**: PL-08, PL-09, PL-12
**RFC Sections**: S14 (Phase A7, B15, B16)

---

## Summary

| Phase | Sprints | Epics | SP |
|-------|---------|-------|----|
| A: Entity Event Foundation | 1-3 | PL-01 to PL-06 | 63 |
| B: Entity Observer Wiring | 4-6 | PL-07 to PL-11 | 74 |
| C: Cascade, Propagation & HTTP | 7-9 | PL-12 to PL-16 | 46 |
| D: Multi-Tenant & Cluster | 10-12 | PL-17 to PL-21 | 42 |
| E: Testing Architecture | 13-14 | PL-22 to PL-23 | 18 |
| **TOTAL** | **14 sprints** | **23 epics** | **243 SP** |

### Test SP Breakdown

Per-layer test tasks are embedded in each epic, NOT deferred to Phase E. Phase E covers
test *infrastructure* and E2E integration tests only.

| Epic | Test Tasks | Test SP |
|------|-----------|---------|
| PL-01 | Schema encode/decode, filter matching, action derivation | 2 |
| PL-02 | EventDistribution channel roundtrip | 1 |
| PL-04 | NATS subject construction, parsing | 1 |
| PL-05 | Model roundtrip, DDL migration, Repo CRUD integration | 7 |
| PL-06 | Error schema variants + catchTags | 2 |
| PL-07 | Observer factory emission, feature flag, cleanup | 3 |
| PL-08 | Observer emission per handler (3 groups: ES, hierarchy, top-level) | 8 |
| PL-09 | RPC roundtrip with filters | 2 |
| PL-10 | L2 service record/query/retention/statistics | 2 |
| PL-11 | Consistency guarantees G-1, G-2, G-5, G-6 | 3 |
| PL-13 | Cascade + worst-of + cycle detection | 2 |
| PL-14 | HTTP CRUD + SSE streaming | 2 |
| PL-15 | Rule evaluation, cascade execution, cycle detection | 2 |
| PL-17 | Shard group + runner topology | 1 |
| PL-18 | Tenant middleware extraction + rejection | 2 |
| PL-19 | Five-tier layer boot | 2 |
| PL-20 | Multi-org stream isolation | 1 |
| PL-21 | 7-channel roundtrip | 2 |
| PL-22 | Test infrastructure (TestRunner, makeTestClient, mock EventDist, PubSub constraints, property-based) | 10 |
| PL-23 | E2E tests (full pipeline, cascade scenario, load skeleton) | 8 |
| **TOTAL TEST SP** | | **63 SP** (26% of total) |

---

## Cross-Domain Dependencies

### Depends ON (from other domains):

| Domain | What We Need | Why |
|--------|-------------|-----|
| NW (network-architect) | Organization entity type (S15) | PL-18, PL-20, PL-21 need OrgId-scoped isolation |
| NW (network-architect) | Edge device architecture (S16) | Three-tier delivery model needs edge node awareness |
| DD (data-architect) | Operational data domain schemas (S36) | Additional entity types for observer wiring |

### Provides TO (other domains):

| What We Provide | Who Needs It | Epic |
|-----------------|-------------|------|
| EntityStateChanged schema | NW, DD | PL-01 |
| EntityStateChanged Model & Repository | DD (queries), DX (tooling) | PL-05 |
| EntityChangeService L2 | RPC handlers, HTTP routes, monitoring dashboards | PL-10 |
| EventDistribution entity-changes channel | All real-time consumers | PL-02 |
| makeEntityObserver factory | Any new entity handler (NW, DD, DP) | PL-07 |
| SubscribeEntityChanges RPC | Frontend, NW | PL-09 |
| Entity Changes REST API | Frontend (polling), external integrations | PL-14 |
| PropagationService L2 | cascade consumers, DD | PL-15 |
| Error schemas (Observer, Propagation, Tenant) | All domains using entity events | PL-06 |
| TenantIsolation middleware | All RPC groups across domains | PL-18 |
| Five-tier Layer composition | Deployment architecture | PL-19 |

---

## RFC Corrections

These corrections should be applied to the RFC or accounted for in implementation:

| RFC Claim | Correction | Source |
|-----------|-----------|--------|
| `Stream.pairwise` (S12.1) | Does NOT exist. Use `Stream.zipWithPrevious` which returns `[Option<A>, A]` | deepwiki: Effect-TS/effect |
| `Entity.make` accepts Machine (S11.2) | Entity.make takes `(typeName, rpcs: Rpc.Any[])`, NOT a Machine. Machine is used internally in RPC handlers | deepwiki: Effect-TS/effect |
| Implicit [prev, curr] destructuring | First emission has `Option.none()` as previous — requires explicit "initialized" action handling | deepwiki: Stream.zipWithPrevious docs |

---

## Notes for Implementation

1. **Breaking change in Phase B**: PL-08 adds EventDistribution dependency to ALL 12 entity handlers. This touches every handler file and every handler test. Coordinate carefully — consider a single PR with mechanical changes.

2. **PubSub test pattern**: All PubSub roundtrip tests MUST use plain `it()` + `Effect.runPromise`, NOT `it.effect()` or `it.scoped()` which are known to timeout with PubSub + Stream.fromPubSub + Effect.fork (see MEMORY.md learning from 2026-02-09).

3. **Epic numbering**: Uses PL-01 through PL-23 domain prefix scheme to avoid cross-domain collisions. Sequential within domain, ordered by phase.

4. **NATS KV keys**: If any entity observer state is persisted to NATS KV, use dots (`.`) as separators, NOT colons (`:`). Colons are invalid in NATS subjects (see MEMORY.md learning from 2026-02-09).

5. **Phase ordering is strict**: A before B (schemas before observers), B before C (observers before cascade), D can partially overlap with C (cluster config is independent of cascade logic).

6. **Two-tier entity classification**: This WBS introduces NO new Machine-backed entities. The 12 existing entities (WBS V1) already have full 12-layer stacks. This WBS adds layer 10 (Observer) to each. The one new persistable type (`EntityStateChanged`) is CRUD — 8 layers, no Machine/Handler/Entity/Observer. `PropagationRule` is static code, not a CRUD entity.

7. **EntityChangeService L2** (PL-10) is the business logic layer between the RPC handler (PL-09) and the repository (PL-05). The RPC handler should call `EntityChangeService.query()`, not `EntityChangeRepository.findByFilter()` directly — this keeps the L2 service as the single owner of query logic, retention policy, and statistics.

8. **Test tasks are per-layer, not afterthoughts.** 63 SP (26% of total) is dedicated to tests, embedded in each epic at the layer they cover. Phase E (PL-22, PL-23) covers test *infrastructure* and E2E integration only — not per-layer unit/integration tests. Observer emission tests for the 12 handlers are split into 3 groups by ISA level similarity (ES handlers, hierarchy handlers, top-level handlers) at 3+3+2 SP.
