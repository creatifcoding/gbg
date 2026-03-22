# Research: Microservices Architecture & Latent Pattern Formalization for Metropolitan-Scale IIoT

**Date**: 2026-02-09
**Author**: microservices-architect (Val)
**Status**: RESEARCH -- Normative input for TMNL-RFC-001
**Scope**: Service decomposition, latent codebase patterns, data management, communication patterns, multi-tenancy at 200K-org scale, edge-first deployment, and novel manufacturing commons patterns

---

## Table of Contents

1. [Architectural Premise: Why This Is NOT Traditional Microservices](#1-architectural-premise)
2. [Latent Pattern #1: The Entity Pipeline](#2-latent-pattern-1-the-entity-pipeline)
3. [Latent Pattern #2: State Graph Meta-Schema](#3-latent-pattern-2-state-graph-meta-schema)
4. [Latent Pattern #3: Dual-Publish Event Distribution](#4-latent-pattern-3-dual-publish-event-distribution)
5. [Latent Pattern #4: Hexagonal State Service Swapping](#5-latent-pattern-4-hexagonal-state-service-swapping)
6. [Latent Pattern #5: RPC Group Derivation from Entity Definitions](#6-latent-pattern-5-rpc-group-derivation)
7. [Service Decomposition: Effect Layers as Bounded Contexts](#7-service-decomposition)
8. [Data Management Patterns](#8-data-management-patterns)
9. [Communication Patterns: NATS as Service Mesh](#9-communication-patterns)
10. [Multi-Tenancy Architecture at 200K Scale](#10-multi-tenancy-architecture)
11. [Edge-First Deployment: The Deployment Spectrum](#11-edge-first-deployment)
12. [Cross-Organization Saga Patterns](#12-cross-org-saga-patterns)
13. [Novel Manufacturing Commons Patterns](#13-novel-manufacturing-commons-patterns)
14. [Formalization Recommendations](#14-formalization-recommendations)
15. [Risk Analysis](#15-risk-analysis)

---

## 1. Architectural Premise: Why This Is NOT Traditional Microservices {#1-architectural-premise}

### 1.1 The Fundamental Reframe

Traditional microservices architecture [RICHARDSON-MSVC] decomposes a system into independently deployable services, each running in its own process (typically a Docker container), communicating via HTTP/gRPC, discovered via a service registry, and scaled by running multiple container instances behind a load balancer.

**TMNL uses none of these mechanisms.** The architecture is fundamentally different:

| Traditional Microservice | TMNL Implementation | Codebase Reference |
|---|---|---|
| Service = Docker container | Service = `@effect/cluster` Entity type [EFFECT-CLUSTER] | `src/lib/iiot/entity/EntityStack.ts:54-67` |
| Service Discovery = Consul/Eureka [MSVC-SVCDISC] | Service Discovery = NATS subject hierarchy + HashRing shard assignment | `src/lib/iiot/realtime/iiot-subjects.ts` |
| Inter-service Communication = HTTP/gRPC | Communication = NATS pub/sub + Effect RPC [EFFECT-TS] | `src/lib/iiot/rpc/index.ts:91-112` |
| API Gateway = Kong/Nginx | API Gateway = `RpcRouter` + WebSocket server | `src/lib/iiot/realtime/websocket-server.ts` |
| Database per Service [MSVC-DB-PER-SVC] | State service per entity type (in-memory or SQL) | `src/lib/iiot/state/SiteState.ts:93-96` |
| Saga Orchestrator [MSVC-SAGA] | Effect Workflow (ClusterWorkflowEngine) | Proposed -- not yet implemented |
| Event Sourcing [MSVC-EVENTSRC] | EventLog + Entity handlers | `src/lib/iiot/entity/AlarmEntity.ts`, `WorkOrderEntity.ts` |
| CQRS [MSVC-CQRS] | RPC read handlers vs. entity command handlers | `src/lib/iiot/rpc/SensorRpcs.ts` (read) vs. `rpc/PlantRpcs.ts` (command) |
| Circuit Breaker [MSVC-CIRCUITBREAKER] | Effect retry/timeout policies + NATS request timeout | Built into Effect.retry, Effect.timeout |
| Sidecar [MSVC-SIDECAR] | NATS leaf node at edge [NATS-LEAFNODE] | Proposed -- edge deployment model |
| Transactional Outbox [MSVC-OUTBOX] | EventDistribution dual-publish (ChannelService + NATS) | `src/lib/iiot/realtime/event-distribution.ts:1-24` |
| Externalized Configuration [MSVC-EXTCONFIG] | IIoTFeatureFlags + NATS KV [NATS-KV] | `src/lib/iiot/infrastructure/feature-flags.ts` |

### 1.2 The Single-Binary Monolith That Scales Like Microservices

The EntityStack (`src/lib/iiot/entity/EntityStack.ts:54-67`) composes ALL 12 entity handler layers into a single `Layer.mergeAll`:

```typescript
export const EntityHandlersLayer = Layer.mergeAll(
  AlarmEntityHandlers,
  WorkOrderEntityHandlers,
  EquipmentStateEntityHandlers,
  EnterpriseEntityHandlers,
  SiteEntityHandlers,
  AreaEntityHandlers,
  PlantEntityHandlers,
  LineEntityHandlers,
  WorkCellEntityHandlers,
  MachineAssetEntityHandlers,
  DeviceEntityHandlers,
  SensorAssetEntityHandlers,
)
```

This is a **single deployment unit** that contains all entity types. It is NOT 12 separate microservices. Yet it achieves the key benefits of microservices [NEWMAN-MSVC]:

- **Independent scaling**: `@effect/cluster` distributes entity instances across runners via consistent hashing [EFFECT-CLUSTER]. Adding a runner automatically redistributes shards. No per-service container orchestration.
- **Fault isolation**: Each entity instance runs in its own `Scope` with dedicated fibers [EFFECT-ENTITY]. A crash in a Site entity does not affect Plant entities on the same runner.
- **Independent deployment**: Feature flags (`IIoTFeatureFlags`) enable per-entity-type feature gates without redeploying. The `EntityProductionHandlersWithEvents` layer (`EntityStack.ts:113-115`) toggles event sourcing independently.

**This is the "modular monolith" pattern** [NEWMAN-MONOLITH] implemented via Effect's type system rather than process boundaries. Service isolation is enforced by `Context.Tag` (compile-time), not network boundaries (runtime).

### 1.3 Why This Matters for a Manufacturing Commons

For a 200K-organization network where organizations range from 2-person machine shops to aerospace manufacturers [PARKER-PLATFORM]:

- **Earl's machine shop** (2 CNC machines) cannot operate 12 Docker containers. He needs ONE binary on ONE device.
- **Boeing's factory floor** (10,000 sensors) needs distributed scaling across multiple runners.
- **Both use the same codebase.** The deployment topology changes; the service architecture does not.

This is the **Deployment Spectrum** pattern (Section 11): one architecture, multiple deployment profiles, zero code changes.

---

## 2. Latent Pattern #1: The Entity Pipeline {#2-latent-pattern-1-the-entity-pipeline}

### 2.1 Pattern Description

Every ISA-95 asset entity in the codebase follows an identical 6-stage pipeline:

```
Schema (Effect Schema) → State Graph (Graph.directed) → Machine (Machine.boot)
  → Entity Handler (Entity.make + toLayer) → RPC Group (RpcGroup.make) → State Service (Context.Tag)
```

This pipeline is present in 12 ISA-95 asset types and 3 operational entity types (Alarm, WorkOrder, EquipmentState). It is the most pervasive structural pattern in the IIoT codebase.

### 2.2 Evidence: File-Level Inventory

| ISA-95 Level | Schema | Graph | Machine | Entity | RPC Group | State |
|---|---|---|---|---|---|---|
| Enterprise | `schemas/assets/enterprise/schema.ts` | `machines/graphs/enterprise-graph.ts` | `machines/EnterpriseMachine.ts` | `entity/EnterpriseEntity.ts` | `rpc/EnterpriseRpcs.ts` | `state/EnterpriseState.ts` (implied) |
| Site | `schemas/assets/site/schema.ts` | `machines/graphs/site-graph.ts` | `machines/SiteMachine.ts` | `entity/SiteEntity.ts` | `rpc/SiteRpcs.ts` | `state/SiteState.ts` |
| Area | `schemas/assets/area/schema.ts` | `machines/graphs/area-graph.ts` | `machines/AreaMachine.ts` (implied) | `entity/AreaEntity.ts` | `rpc/AreaRpcs.ts` | `state/AreaState.ts` |
| Plant | `schemas/assets/plant/schema.ts` | `machines/graphs/plant-graph.ts` | `machines/PlantMachine.ts` | `entity/PlantEntity.ts` | `rpc/PlantRpcs.ts` | `state/PlantState.ts` |
| Line | `schemas/assets/line/schema.ts` | `machines/graphs/line-graph.ts` | `machines/LineMachine.ts` | `entity/LineEntity.ts` | `rpc/LineRpcs.ts` | `state/LineState.ts` |
| WorkCell | `schemas/assets/workcell/schema.ts` | `machines/graphs/workcell-graph.ts` | `machines/WorkCellMachine.ts` | `entity/WorkCellEntity.ts` | `rpc/WorkCellRpcs.ts` | `state/WorkCellState.ts` |
| Machine | `schemas/assets/machine/schema.ts` | `machines/graphs/machine-asset-graph.ts` | `machines/MachineAssetMachine.ts` | `entity/MachineAssetEntity.ts` | `rpc/MachineAssetRpcs.ts` | `state/MachineState.ts` |
| Device | `schemas/assets/device/schema.ts` | `machines/graphs/device-graph.ts` | `machines/DeviceMachine.ts` | `entity/DeviceEntity.ts` | `rpc/DeviceRpcs.ts` | `state/DeviceState.ts` |
| Sensor | `schemas/assets/sensor/schema.ts` | `machines/graphs/sensor-graph.ts` | `machines/SensorAssetMachine.ts` | `entity/SensorAssetEntity.ts` | `rpc/SensorAssetRpcs.ts` | `state/SensorAssetState.ts` |

All paths relative to `src/lib/iiot/`.

### 2.3 Structural Analysis: SiteEntity as Canonical Example

The pipeline for `SiteEntity` (`src/lib/iiot/entity/SiteEntity.ts`) demonstrates the pattern:

**Stage 1 -- Schema**: `Site` is defined as a `Schema.TaggedClass` in `schemas/assets/site/schema.ts`, with branded identifiers (`SiteId`), optional fields via `Option`, and ISA-95 hierarchy path.

**Stage 2 -- State Graph**: `siteStateGraph` in `machines/graphs/site-graph.ts:76-113` uses `Graph.directed<SiteStateNode, SiteTransitionAction>` to define 6 states and 7 transitions. The graph validates transitions via `isValidStateTransition()` and provides `getValidNextStates()` for discoverability.

**Stage 3 -- Machine**: `makeSiteMachine` in `machines/SiteMachine.ts` boots an `@effect/experimental/Machine` that wraps the state graph. The machine accepts internal message types (`InternalCreateSite`, `InternalBeginConstruction`, etc.) and delegates to graph-validated state transitions.

**Stage 4 -- Entity Handler**: `SiteEntity.toLayer()` in `entity/SiteEntity.ts:211-337` boots the machine at initialization, then maps each external RPC to an internal machine message via `actor.send()`. Error mapping converts machine errors (`MachineEntityNotFoundError`, `MachineInvalidTransitionError`) to RPC errors (`RpcNotFoundError`, `RpcTransitionError`).

**Stage 5 -- RPC Group**: `SiteRpcs` in `rpc/SiteRpcs.ts` defines the external API. Each RPC is defined via `Rpc.make()` with:
- A tagged name (`Site.Create`, `Site.BeginConstruction`)
- A typed payload (Effect Schema)
- A `primaryKey` function for entity routing
- Typed success/error responses

**Stage 6 -- State Service**: `SiteState` in `state/SiteState.ts:93-96` is a `Context.Tag` with a `SiteStateShape` interface. It has two implementations: `SiteStateInMemory` (for testing, `state/SiteState.ts:110-238`) and `makeSiteStateSql` (for production, `state/SiteState.ts:251-352`).

### 2.4 The Copy-Paste Problem

This pipeline is **not formalized**. Each of the 12 asset entity types re-implements the same 6-stage structure by hand. The repetition is evident in the handler pattern -- every entity handler in `entity/*.ts` follows the same structure:

```typescript
export const XxxEntityHandlers = XxxEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* XxxState          // Port: state persistence
    const flags = yield* IIoTFeatureFlags  // Port: feature flags
    const xxxMachine = makeXxxMachine({ state, flags })
    const actor = yield* Machine.boot(xxxMachine)

    const handleCreate = (envelope) => actor.send(new InternalCreateXxx({...})).pipe(
      Effect.catchTag('MachineCreateError', ...)
    )
    const handleGet = (envelope) => actor.send(new InternalGetXxx({...})).pipe(
      Effect.catchTag('MachineEntityNotFoundError', ...)
    )
    // ... N transition handlers, each identical in structure ...

    return XxxEntity.of({ ... })
  })
)
```

VERIFIED: This exact pattern is present in `SiteEntity.ts:211-337`, and by inspection the same architectural structure is replicated across all entity files.

### 2.5 Formalization Proposal: EntityPipelineFactory

The pipeline SHOULD be formalized as a higher-order factory:

```typescript
// Proposed formalization
const makeEntityPipeline = <Schema, StateNode, Action, State>(config: {
  schema: Schema.Schema<Schema>
  graph: Graph.Graph<StateNode, Action>
  stateService: Context.Tag<State, StateShape<Schema>>
  entityType: string
  transitions: Record<Action, InternalMessage>
}) => ({
  entity: Entity.make(config.entityType, derivedRpcs(config)),
  handlers: deriveHandlers(config),
  rpcGroup: deriveRpcGroup(config),
  stateInMemory: deriveInMemoryState(config),
})
```

**Why formalization matters for 200K orgs**: When organizations onboard to the manufacturing commons, they may define custom asset types beyond ISA-95 (e.g., a paint booth, a 3D printer, a clean room). A formalized pipeline would enable schema-driven entity generation -- define a Schema and a state graph, and the factory generates the Entity, Machine, RPC group, and state service automatically.

---

## 3. Latent Pattern #2: State Graph Meta-Schema {#3-latent-pattern-2-state-graph-meta-schema}

### 3.1 Pattern Description

Every state graph in `machines/graphs/*.ts` shares a common structure:

1. **State type**: A string literal union (e.g., `type SiteStateNode = 'planned' | 'under_construction' | ...`)
2. **Action type**: A string literal union (e.g., `type SiteTransitionAction = 'BeginConstruction' | 'Commission' | ...`)
3. **Graph construction**: `Graph.directed<StateNode, Action>((mutable) => { ... })` with `Graph.addNode` and `Graph.addEdge`
4. **Validation functions**: `isValidStateTransition()`, `getValidNextStates()`, `getValidPreviousStates()`
5. **Action-specific validators**: `canBeginConstruction()`, `canCommission()`, etc.
6. **Metadata**: `STATE_COUNT`, `TRANSITION_COUNT`, `ALL_STATES`, `TERMINAL_STATES`

### 3.2 Structural Invariants Across 12 Graphs

VERIFIED from `machines/graphs/site-graph.ts`:

| Invariant | Description | Evidence |
|---|---|---|
| **Single initial state** | Every graph has exactly one state with no incoming edges | `planned` in site-graph (no node transitions TO planned) |
| **At least one terminal state** | Every graph has at least one state with no outgoing edges | `decommissioned` in site-graph (`TERMINAL_STATES = ['decommissioned']`, line 309) |
| **Deterministic transitions** | Each (from, action) pair maps to exactly one target state | Graph.addEdge is called once per (source, action) pair |
| **No self-loops** | No state transitions to itself | No `Graph.addEdge(mutable, idx, idx, ...)` calls observed |
| **Named actions** | Every edge carries a human-readable action name | Edge data is always a string like `'BeginConstruction'` |
| **O(1) validation** | `isValidStateTransition` uses `Graph.hasEdge` for constant-time lookup | `site-graph.ts:148-157` |

### 3.3 Graph Complexity by Entity Type

| Entity Type | States | Transitions | Terminal States | Cycles? |
|---|---|---|---|---|
| Site | 6 | 7 | 1 (decommissioned) | Yes (Reopen loops) |
| Plant | ~8 | ~10 | 1 (decommissioned) | Yes (restart cycles) |
| Line | ~10 | ~14 | 1 (decommissioned) | Yes (changeover/starved cycles) |
| WorkCell | ~8 | ~10 | 1 (decommissioned) | Yes (setup/blocked cycles) |
| Machine | ~10 | ~14 | 1 (decommissioned) | Yes (fault/repair cycles) |
| Device | ~6 | ~8 | 1 (decommissioned) | Yes (online/offline cycles) |
| Sensor | ~7 | ~9 | 1 (decommissioned) | Yes (calibration cycles) |
| Alarm | ~5 | ~6 | 1 (cleared) | No (linear lifecycle) |
| WorkOrder | ~10 | ~14 | 2 (completed, cancelled) | Yes (suspend/resume cycles) |
| EquipmentState | ~6 | ~8 | 0 (all states recoverable) | Yes |

### 3.4 Formalization Proposal: Graph Meta-Schema

A meta-schema for state graphs would enable:

1. **Compile-time validation**: Ensure every graph has an initial state, at least one terminal state, and no unreachable states.
2. **Codegen**: Generate RPC definitions, Machine message types, and handler skeletons from the graph definition.
3. **Runtime introspection**: Expose graph structure via RPC for UI rendering (state machine visualizations on dashboards).
4. **Cross-entity cascade rules**: Define how a child entity's terminal state affects the parent (e.g., all Machines in FAULTED state implies Line in DEGRADED state).

```typescript
// Proposed meta-schema
const GraphMetaSchema = Schema.Struct({
  entityType: Schema.String,
  states: Schema.Array(Schema.Struct({
    name: Schema.String,
    isInitial: Schema.Boolean,
    isTerminal: Schema.Boolean,
  })),
  transitions: Schema.Array(Schema.Struct({
    from: Schema.String,
    to: Schema.String,
    action: Schema.String,
    guard: Schema.optional(Schema.String), // optional guard condition name
  })),
  cascadeRules: Schema.optional(Schema.Array(Schema.Struct({
    childState: Schema.String,
    parentEffect: Schema.String, // e.g., "DEGRADE", "ALARM"
    threshold: Schema.optional(Schema.Number), // e.g., 0.5 = 50% of children
  }))),
})
```

---

## 4. Latent Pattern #3: Dual-Publish Event Distribution {#4-latent-pattern-3-dual-publish-event-distribution}

### 4.1 Pattern Description

The EventDistribution service (`src/lib/iiot/realtime/event-distribution.ts`) implements a **dual-publish** pattern: every event is published to BOTH a local in-process channel (ChannelService) AND an external NATS subject (via HolonetBridge).

From the module docstring (`event-distribution.ts:1-24`):

```
Architecture:
  4 ChannelService channels for different event types:
  - iiot:readings   -- high-throughput sensor data
  - iiot:alarms     -- alarm lifecycle events
  - iiot:equipment  -- equipment state transitions
  - iiot:invalidations -- cache invalidation signals

  NATS integration (via HolonetBridge):
  - Outbound: Every publish dual-writes to local PubSub AND NATS (fire-and-forget)
  - Inbound: Remote ingress daemons subscribe to NATS wildcards and inject
    into local PubSub inlets for cross-node event distribution.
```

### 4.2 Why Dual-Publish Matters

This pattern implements the **Transactional Outbox** concept [MSVC-OUTBOX] without requiring a database-backed outbox table. The architecture:

1. **Local channel** (ChannelService): Zero-latency, in-process fan-out to all local subscribers. Used by WebSocket server, local dashboards, and co-located services.
2. **NATS channel** (HolonetBridge): Fire-and-forget publish to NATS subjects [NATS-PROTO]. Used for cross-node distribution, edge-to-cloud sync, and cross-org federation.

The HolonetBridge (`src/lib/iiot/realtime/holonet-bridge.ts:34-57`) defines 4 outbound publish methods (one per channel) and 4 inbound stream methods:

```typescript
interface HolonetBridgeShape {
  readonly publishReading: (event: ReadingEvent) => Effect.Effect<void>
  readonly publishAlarm: (event: AlarmEvent) => Effect.Effect<void>
  readonly publishEquipment: (event: EquipmentStateChange) => Effect.Effect<void>
  readonly publishInvalidation: (event: CacheInvalidation) => Effect.Effect<void>

  readonly remoteReadings: Effect.Effect<Stream.Stream<ReadingEvent>, never, Scope.Scope>
  readonly remoteAlarms: Effect.Effect<Stream.Stream<AlarmEvent>, never, Scope.Scope>
  readonly remoteEquipment: Effect.Effect<Stream.Stream<EquipmentStateChange>, never, Scope.Scope>
  readonly remoteInvalidations: Effect.Effect<Stream.Stream<CacheInvalidation>, never, Scope.Scope>
}
```

### 4.3 Relationship to CQRS

The dual-publish pattern creates a natural CQRS boundary [MSVC-CQRS] [CQRS]:

- **Command side**: Entity handlers receive RPCs, validate via state machine, update state, publish to local ChannelService AND NATS.
- **Query side**: RPC read handlers (`SensorRpcs.ts`, `AssetRpcs.ts`) query state services directly. Real-time subscriptions (`RealtimeRpcs.ts`) consume from ChannelService broadcast outlets.

The ChannelService provides **read-your-writes consistency** within a single runner: after a command handler publishes an event, a subscriber on the same runner sees it immediately. Cross-runner consistency depends on NATS JetStream ordering guarantees [JETSTREAM], which provide linearizable writes and sequential reads (verified in [TMNL-CONSISTENCY]).

### 4.4 Event Schema Discipline

Each event type is a `Schema.TaggedClass` (lines 41-70 of `event-distribution.ts`):

```typescript
export class ReadingEvent extends Schema.TaggedClass<ReadingEvent>()('ReadingEvent', {
  topic: Schema.String,
  value: Schema.Number,
  timestamp: Schema.String,
  deviceId: Schema.String,
}) {}

export class AlarmEvent extends Schema.TaggedClass<AlarmEvent>()('AlarmEvent', {
  alarmId: Schema.String,
  severity: Schema.String,
  deviceId: Schema.String,
  message: Schema.String,
  timestamp: Schema.String,
}) {}
```

This ensures runtime validation at channel boundaries. Events that fail schema validation are rejected before entering the distribution pipeline, preventing corrupt data from propagating across the network.

### 4.5 Formalization: Triple-Publish for Federation

For a 200K-org manufacturing commons, the dual-publish pattern SHOULD be extended to **triple-publish**:

1. **Local ChannelService** -- unchanged, in-process subscribers
2. **Org-scoped NATS** -- current HolonetBridge, within the organization's NATS account
3. **Network-scoped NATS** -- NEW, opt-in export stream that publishes to the manufacturing commons NATS account

The third channel would use `Schema.transform` to strip sensitive fields before export.

**CRITICAL: Schema.transform timing** (confirmed with consistency-theorist, see [Z.3.1]):

The `Schema.omit` / `Schema.transform` MUST be applied **BEFORE** the NATS publish call, **inside** the EventDistribution service -- NEVER after wire transit. Sensitive fields (deviceId, internal machine identifiers, proprietary process parameters) must never transit the wire, even encrypted. The transform is an export policy, not a consumer filter.

```typescript
// ExportPolicy: per-org configuration stored in NATS KV
const ExportPolicy = Schema.Struct({
  orgId: OrgId,
  readings: Schema.Struct({
    enabled: Schema.Boolean,
    excludeFields: Schema.Array(Schema.String),  // e.g., ["deviceId", "internalBatchId"]
    anonymize: Schema.Boolean,                    // replace orgId with pseudonym
  }),
  alarms: Schema.Struct({
    enabled: Schema.Boolean,
    minSeverity: Schema.optional(Schema.String),  // only export above threshold
  }),
})

// Inside EventDistribution.publishReading (BEFORE NATS publish):
const exportedReading = Schema.decodeSync(
  ReadingEvent.pipe(Schema.omit('deviceId', 'internalBatchId'))
)(event)
// Then: holonetBridge.publishToNetwork(exportedReading)
```

The per-org ExportPolicy is stored in NATS KV (`export-policies` bucket) and loaded at EventDistribution initialization. Changes to the export policy take effect on the next publish cycle -- no restart required.

---

## 5. Latent Pattern #4: Hexagonal State Service Swapping {#5-latent-pattern-4-hexagonal-state-service-swapping}

### 5.1 Pattern Description

Every state service in `state/*.ts` follows a hexagonal architecture (ports and adapters) pattern [VERNON-IDDD]:

1. **Port**: A `Context.Tag` defining the service contract (e.g., `SiteState extends Context.Tag('iiot/SiteState')<SiteState, SiteStateShape>()`)
2. **Adapter 1 (In-Memory)**: `SiteStateInMemory` -- `Layer.effect` using `Ref.make(new Map<...>)` for testing
3. **Adapter 2 (SQL)**: `makeSiteStateSql(repo)` -- factory that bridges the state interface to a SQL repository
4. **Composition**: `EntityTestingStack` uses `AllStateServicesInMemory` (`state/index.ts`); production uses SQL-backed layers

### 5.2 The StateShape Contract

From `state/SiteState.ts:55-76`:

```typescript
export interface SiteStateShape {
  readonly create: (params: CreateSiteParams) => Effect.Effect<Site>
  readonly get: (id: SiteId) => Effect.Effect<Site, SiteStateNotFoundError>
  readonly set: (site: Site) => Effect.Effect<void>
  readonly list: (filter: SiteFilter) => Effect.Effect<readonly Site[]>
  readonly delete: (id: SiteId) => Effect.Effect<boolean>
  readonly exists: (id: SiteId) => Effect.Effect<boolean>
  readonly count: (filter: SiteFilter) => Effect.Effect<number>
}
```

This 7-method contract is structurally identical across all 13 state services. The only variations are:
- The entity type (`Site`, `Plant`, `Line`, etc.)
- The ID type (`SiteId`, `PlantId`, `LineId`, etc.)
- The filter type (`SiteFilter`, `PlantFilter`, etc.)
- The not-found error type (`SiteStateNotFoundError`, etc.)

### 5.3 The Swapping Mechanism

From `EntityStack.ts:90-93`:

```typescript
export const EntityTestingStack = EntityHandlersLayer.pipe(
  Layer.provide(AllStateServicesInMemory),
  Layer.provide(IIoTFeatureFlagsDisabledLayer),
)
```

And for production (`EntityStack.ts:113-115`):

```typescript
export const EntityProductionHandlersWithEvents = EntityHandlersLayer.pipe(
  Layer.provide(IIoTFeatureFlagsEnabledLayer),
  // Still requires SQL-backed state services to be provided
)
```

This is the **Database per Service** pattern [MSVC-DB-PER-SVC] implemented via Effect's dependency injection. Each entity type has its own state service (logical database isolation) even when they share the same physical database.

### 5.4 Implications for Multi-Tenancy

For 200K organizations, the hexagonal state service pattern enables:

- **Edge deployments**: Use `SiteStateInMemory` on Earl's $50 device. No PostgreSQL required.
- **Cloud deployments**: Use SQL-backed implementations with per-org schema isolation.
- **Hybrid**: Start with in-memory, graduate to SQL when the org grows. Zero code changes.
- **NATS KV**: A third adapter using `NATS KV` [NATS-KV] for state that needs cross-node replication without a relational database.

### 5.5 Formalization Proposal: Generic State Service Factory

```typescript
// Proposed: derive StateService from Schema
const makeStateService = <S extends Schema.Schema.Any, Id extends string>(
  entitySchema: S,
  idField: Id,
  tagName: string,
) => ({
  Tag: Context.Tag(tagName)<typeof Tag, StateShape<Schema.Schema.Type<S>, ...>>,
  InMemory: Layer.effect(Tag, deriveInMemoryImpl(entitySchema, idField)),
  Sql: (repo: Repository<S>) => Layer.effect(Tag, deriveSqlImpl(repo)),
  NatsKV: (kv: NatsKV) => Layer.effect(Tag, deriveKVImpl(entitySchema, kv)),
})
```

---

## 6. Latent Pattern #5: RPC Group Derivation from Entity Definitions {#6-latent-pattern-5-rpc-group-derivation}

### 6.1 Pattern Description

Every entity-derived RPC group follows an identical structure:

1. **Create RPC**: `Rpc.make('Xxx.Create', { payload: CreateXxxParams, success: Xxx, error: RpcQueryError })`
2. **Get RPC**: `Rpc.make('Xxx.Get', { payload: { xxxId: XxxId }, success: Xxx, error: RpcNotFoundError })`
3. **N transition RPCs**: One per edge in the state graph, each with the same signature: `payload: { xxxId: XxxId }, success: Xxx, error: Union(RpcNotFoundError, RpcTransitionError)`

### 6.2 Evidence from SiteEntity

From `entity/SiteEntity.ts:79-87`:

```typescript
export const SiteEntityType = 'Site' as const
export const SiteCreateTag = `${SiteEntityType}.Create` as const
export const SiteGetTag = `${SiteEntityType}.Get` as const
export const SiteBeginConstructionTag = `${SiteEntityType}.BeginConstruction` as const
export const SiteCommissionTag = `${SiteEntityType}.Commission` as const
// ... one tag per graph transition
```

Each RPC tag is derived from the entity type name and the transition action name. The primaryKey function is always `({ xxxId }) => xxxId` for Get/transition RPCs, and `({ slug }) => slug` for Create.

### 6.3 The IIoTRpcs Composition

The barrel at `rpc/index.ts:91-112` composes all 17 RPC groups into a single `IIoTRpcs`:

```typescript
export const IIoTRpcs = RpcGroup.make(
  ...Array.from(SensorRpcs.requests.values()),
  ...Array.from(AssetRpcs.requests.values()),
  ...Array.from(AlarmRpcs.requests.values()),
  // ... 14 more groups ...
  ...Array.from(RealtimeRpcs.requests.values()),
)
```

This flat composition means all RPCs share a single transport (WebSocket or NATS). There is no per-service routing -- the `RpcRouter` dispatches to the correct handler based on the RPC tag.

### 6.4 Formalization Proposal: Graph-Derived RPC Generation

Since every transition RPC has the same shape, they can be generated from the state graph:

```typescript
// Proposed: derive RPCs from graph
const deriveRpcsFromGraph = <Schema, StateNode, Action>(config: {
  entityType: string,
  schema: Schema.Schema<Schema>,
  idField: string,
  graph: Graph.Graph<StateNode, Action>,
}) => {
  const createRpc = Rpc.make(`${config.entityType}.Create`, { ... })
  const getRpc = Rpc.make(`${config.entityType}.Get`, { ... })
  const transitionRpcs = getEdges(config.graph).map(edge =>
    Rpc.make(`${config.entityType}.${edge.action}`, {
      payload: Schema.Struct({ [config.idField]: idSchema }),
      success: config.schema,
      error: Schema.Union(NotFoundError, TransitionError),
    })
  )
  return RpcGroup.make(createRpc, getRpc, ...transitionRpcs)
}
```

**Impact at 200K orgs**: Custom entity types defined by organizations could have their RPCs auto-generated from their state graphs, eliminating boilerplate and ensuring consistent error handling.

---

## 7. Service Decomposition: Effect Layers as Bounded Contexts {#7-service-decomposition}

### 7.1 Bounded Contexts Mapped to DDD Subdomains

Following [MSVC-DECOMP-SUB] and [EVANS-DDD], the manufacturing commons decomposes into:

| DDD Subdomain | Type | Bounded Context | Effect Layer Tier | Codebase Location |
|---|---|---|---|---|
| **Manufacturing Operations** | Core | Equipment lifecycle, state machines, entity management | Tier 5 (Cluster) + Tier 2 (Domain) | `entity/*.ts`, `machines/*.ts`, `state/*.ts` |
| **Telemetry Ingestion** | Supporting | Sensor data pipeline, reading processing, quality mapping | Tier 3 (Stream) | `adapters/ingestion-service.ts`, `adapters/reading-processor.ts` |
| **Alarm Management** | Supporting | Alarm detection, ISA-18.2 lifecycle, escalation | Tier 2 (Domain) + Tier 5 (Cluster) | `entity/AlarmEntity.ts`, `adapters/alarm-detection.ts` |
| **Work Order Management** | Supporting | Work order lifecycle, cross-org sagas | Tier 2 (Domain) + Tier 5 (Cluster) | `entity/WorkOrderEntity.ts` |
| **Real-time Distribution** | Generic | Event routing, channel management, WebSocket transport | Tier 3 (Stream) + Tier 4 (RPC/Transport) | `realtime/event-distribution.ts`, `realtime/websocket-server.ts` |
| **Organization Management** | Core (Network) | Org identity, onboarding, capability registry | Tier 2 (Domain) | Proposed -- not yet implemented |
| **Capacity Marketplace** | Core (Network) | Job posting, bid matching, cross-org routing | Tier 2 (Domain) | Proposed -- not yet implemented |
| **Compliance & Audit** | Generic | FDA 21 CFR Part 11 audit trails, ISA-18.2 records | Tier 2 (Domain) | Proposed -- event sourcing entities |
| **Authentication & Identity** | Generic | NATS JWT auth, org identity, user management | Tier 1 (Infrastructure) | Proposed -- NATS account resolver |
| **Analytics & Reporting** | Generic | KPI aggregation, OEE calculation, cross-site rollups | Tier 2 (Domain) | `entity/EquipmentStateEntity.ts` (partial) |

### 7.2 Context Map

Following [CONTEXT-MAP] and [BOUNDED-CONTEXT]:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MANUFACTURING COMMONS                            │
│                                                                     │
│  ┌───────────────────┐  Published    ┌───────────────────────┐     │
│  │  Organization      │  Language    │  Capacity Marketplace  │     │
│  │  Management        ├─────────────>│  (Job, Bid, Match)     │     │
│  │  (Org, Identity)   │             │                        │     │
│  └────────┬──────────┘              └──────────┬────────────┘     │
│           │ Shared Kernel                      │ ACL                │
│           │ (OrgId, NATS Account)              │ (cross-org Schema) │
│  ┌────────▼──────────┐              ┌──────────▼────────────┐     │
│  │  Manufacturing     │  Conformist │  Compliance & Audit    │     │
│  │  Operations        ├────────────>│  (EventLog, 21CFR11)   │     │
│  │  (14 Entities)     │             │                        │     │
│  └────────┬──────────┘              └───────────────────────┘     │
│           │ Customer/Supplier                                       │
│  ┌────────▼──────────┐    ┌──────────────────┐                    │
│  │  Telemetry         │    │  Alarm Management │                    │
│  │  Ingestion         │◄───┤  (ISA-18.2)       │                    │
│  │  (Pipeline)        │    │                    │                    │
│  └────────┬──────────┘    └──────────────────┘                    │
│           │ Open Host Service                                       │
│  ┌────────▼──────────┐                                             │
│  │  Real-time         │                                             │
│  │  Distribution      │                                             │
│  │  (4 Channels)      │                                             │
│  └───────────────────┘                                             │
└─────────────────────────────────────────────────────────────────────┘
```

**Architectural note — federation is NATS topology, not a service**: Cross-org coordination does NOT require a dedicated "FederationService" or "FederationGateway." The `manufacturing-commons` NATS system account IS the federation layer. Per-subject ordering within a single NATS account provides causal consistency for cross-org sagas (X.8 in [Z.3.1]). Marketplace events route through `commons.marketplace.*` subjects in the system account (M.6.2). Bilateral data sharing uses scoped, temporary NATS exports between org accounts (ISO-11 in TI.4.4). The only services running in the manufacturing-commons account are lightweight @effect/cluster singletons (SLA monitor, reputation aggregator, subject routing config) — infrastructure observers, not application mediators.

### 7.3 Anti-Corruption Layers Between Contexts

Following [ANTI-CORRUPTION], context boundaries are enforced by `Schema.transform`:

- **Telemetry -> Alarm**: `ReadingProcessor` output feeds `AlarmDetector.checkReading`. The boundary is the `RoutedReading` type -- alarm detection receives typed, routed readings, not raw Sparkplug payloads.
- **Entity -> Distribution**: Entity state changes are mapped to distribution events via `ReactivityBridge`. The bridge transforms `Machine.State<M>` to `EquipmentStateChange` (a simpler, transport-safe schema).
- **Intra-org -> Cross-org**: The ExportPolicy `Schema.transform` inside EventDistribution (Section 4.5) strips sensitive fields BEFORE publishing to the `manufacturing-commons` NATS account. This is NOT a separate gateway — it is a configuration-driven transform within the existing HolonetBridge triple-publish path.

### 7.4 Layer Composition as Service Architecture

Per effect-specialist's 5-Tier Layer Composition Model:

```
Tier 5: Cluster Layer        -- Entity registration, runner setup, sharding
    |  depends on
Tier 4: RPC & Transport      -- Handler layers, serialization, WebSocket
    |  depends on
Tier 3: Event & Stream       -- EventDistribution, ChannelService, HolonetBridge
    |  depends on
Tier 2: Domain Services      -- Org, Equipment, Sensor, Alarm, WorkOrder, Marketplace
    |  depends on
Tier 1: Infrastructure       -- NATS, PostgreSQL, TimescaleDB, Redis, Auth
```

**Each tier is a bounded context boundary.** Same-tier services compose with `Layer.mergeAll` (concurrent initialization). Cross-tier dependencies use `Layer.provide` (sequential initialization). Shared resources use `Layer.memoize`; per-tenant resources use `LayerMap` (see Section 10.4.1 -- NOT `Layer.fresh` which is for test isolation).

**Tier-invariance principle**: The same `EntityHandlersLayer` (`EntityStack.ts:54-67`) runs identically at every deployment tier. What changes beneath it:

| Deployment Tier | Runner | State Services | MessageStorage |
|---|---|---|---|
| Tests | `TestRunner.layer` | `AllStateServicesInMemory` | In-memory |
| T1 Edge ($50) | No runner (ingestion only) | N/A | N/A |
| T2 Edge ($500) | `SingleRunner.layer({ runnerStorage: "memory" })` | `AllStateServicesInMemory` | SQLite |
| T3 Site ($5K+) | `SocketRunner.layer` (multi-process) | PostgreSQL adapters | PostgreSQL |
| Cloud | `SocketRunner.layer` (multi-node) | PostgreSQL + TimescaleDB | PostgreSQL |

This is the essence of Effect's Layer system applied to deployment topology: business logic is decoupled from infrastructure via service tags.

---

## 8. Data Management Patterns {#8-data-management-patterns}

### 8.1 Database per Service via State Service Abstraction

The **Database per Service** pattern [MSVC-DB-PER-SVC] is implemented via per-entity-type state services. Each entity type has its own `Context.Tag<XxxState, XxxStateShape>`, providing logical isolation even when the physical database is shared.

For 200K tenants, the data isolation model is:

| Isolation Level | Mechanism | Use Case |
|---|---|---|
| **Entity-type isolation** | Separate `Context.Tag` per entity type | Always -- structural |
| **Tenant isolation** | NATS accounts [NATS-ACCOUNTS] + schema-prefixed tables | 200K orgs |
| **Site isolation** | `@effect/cluster` ShardGroup per site [EFFECT-CLUSTER] | Large orgs with multiple sites |
| **Physical isolation** | Separate database per tenant | Premium tier (Boeing-scale) |

### 8.2 Event Sourcing for Operational Entities

Three entity types use event sourcing [MSVC-EVENTSRC] [EVENT-SOURCING]:

- **AlarmEntity** (`entity/AlarmEntity.ts`) -- ISA-18.2 alarm lifecycle [ISA-18.2]
- **WorkOrderEntity** (`entity/WorkOrderEntity.ts`) -- FDA 21 CFR Part 11 audit trail [FDA-CFR11]
- **EquipmentStateEntity** (`entity/EquipmentStateEntity.ts`) -- OEE calculation history

Event sourcing is gated by `IIoTFeatureFlags` (`infrastructure/feature-flags.ts`), enabling gradual rollout:
- `EntityTestingStack` (line 90): flags disabled, no event sourcing
- `EntityProductionHandlersWithEvents` (line 113): flags enabled, full event sourcing

The EventLog uses `SqlEventJournal` with per-entity sequential ordering. Per [TMNL-CONSISTENCY], this provides sequential consistency per entity (MUST) and causal consistency cross-entity (SHOULD).

### 8.3 CQRS: Read vs. Command Separation

The RPC barrel (`rpc/index.ts`) naturally separates:

**Stateless query RPCs** (read side):
- `SensorRpcs` -- `GetLatest`, `Query`, `QueryAggregated`, `Subscribe`
- `AssetRpcs` -- `GetSensorHierarchy`, `GetPlantHierarchy`, `GetMachineWithSensors`

**Entity-derived RPCs** (command side):
- `PlantRpcs` -- `Create`, `CompleteCommissioning`, `ScheduledShutdown`, `Restart`, `EmergencyShutdown`
- `WorkOrderRpcs` -- `Create`, `Submit`, `Approve`, `Reject`, `Start`, `Suspend`, `Resume`, `Complete`, `Fail`, `Cancel`, `Close`

Read-side RPCs query state services directly (fast, local). Command-side RPCs go through entity handlers -> machine validation -> state update -> event publish (consistent, validated). This separation enables independent scaling: read-side can be cached/replicated; command-side requires entity routing.

### 8.4 Transactional Outbox via Dual-Publish

The traditional Transactional Outbox [MSVC-OUTBOX] uses a database table to atomically persist state changes and outbound events in the same transaction. TMNL replaces this with the dual-publish pattern (Section 4):

1. Entity handler updates state service (in-memory or SQL)
2. Entity handler publishes to ChannelService (local, synchronous)
3. EventDistribution publishes to NATS via HolonetBridge (fire-and-forget)

**Failure modes**:
- If step 2 fails: the state change is committed but local subscribers miss the event. Recovery: subscriber reconnects and replays from state service.
- If step 3 fails: local subscribers see the event but remote nodes miss it. Recovery: NATS JetStream replay from stream position.
- If step 1 fails: no state change, no events published. Correct behavior.

For event-sourced entities, `SqlEventJournal` provides true transactional atomicity: the event is appended to the journal AND the state is updated in a single SQL transaction. The outbox is the journal itself.

### 8.5 Saga Pattern for Cross-Service Transactions

Cross-entity operations (e.g., "Commission a Plant and all its Lines") require the Saga pattern [MSVC-SAGA] [SAGA-GARCIA]. Two approaches are viable:

**Choreography-based Saga** (current implementation path):
```
PlantEntity.Commission
  -> publishes EquipmentStateChange{plant, operational}
    -> EventDistribution broadcasts to iiot:equipment channel
      -> LineEntity subscribers detect parent state change
        -> Each LineEntity.AutoStart (if configured)
```

**Orchestration-based Saga** (proposed for complex cross-org flows):
```
WorkOrderSaga:
  1. Create WorkOrder in Org A (compensatable)
  2. Reserve capacity in Org B (compensatable)
  3. Confirm reservation (pivot point)
  4. Execute job in Org B (non-compensatable after start)
  5. Report completion to Org A
```

The choreography approach is sufficient for intra-org cascades. Cross-org sagas (Section 12) also use choreography -- NOT orchestration -- for trust governance reasons. See Section 12.4 for the full rationale. Each org publishes state changes to its own NATS subjects; the counterparty subscribes and reacts. No central `ClusterWorkflowEngine` is needed for cross-org coordination.

---

## 9. Communication Patterns: NATS as Service Mesh {#9-communication-patterns}

### 9.1 NATS Replaces Three Traditional Patterns

In a traditional microservices architecture, three separate systems handle communication [RICHARDSON-MSVC]:

1. **Service discovery** (Consul, Eureka) -- finding service instances
2. **Load balancing** (Nginx, HAProxy) -- distributing requests
3. **Message broker** (Kafka, RabbitMQ) -- async communication

NATS replaces all three [NATS-PROTO] [NATS-COMPARE]:

| Function | Traditional | NATS Implementation |
|---|---|---|
| Service discovery | Registry + health checks [MSVC-SVCDISC] | Subject-based addressing. Services subscribe to subjects; clients publish to subjects. No registry needed. |
| Load balancing | L7 proxy | NATS queue groups. Multiple subscribers on the same subject automatically load-balance. |
| Async messaging | Kafka/RabbitMQ | JetStream streams [JETSTREAM] with per-subject ordering, replay, and persistence. |
| Request/reply | HTTP/gRPC | NATS request/reply with automatic inbox routing. |
| Pub/sub broadcast | Fan-out exchange | NATS subject wildcards (`iiot.readings.>`) with zero configuration. |

### 9.2 Subject Hierarchy as Service Registry

The NATS subject hierarchy (`realtime/iiot-subjects.ts`) defines the service topology:

```
iiot.readings.*     -- Sensor telemetry (high throughput)
iiot.alarms.*       -- Alarm lifecycle events
iiot.equipment.*    -- Equipment state transitions
iiot.invalidations.*-- Cache invalidation signals
```

For 200K organizations, subjects are scoped by NATS account:

```
Account: org-001
  iiot.readings.{deviceId}    -- Org 001's readings
  iiot.alarms.{alarmId}       -- Org 001's alarms

Account: org-002
  iiot.readings.{deviceId}    -- Org 002's readings (COMPLETELY ISOLATED)
```

No subject-level ACL management. NATS accounts provide namespace isolation by default [NATS-ACCOUNTS].

### 9.3 Effect RPC Over NATS

Effect RPC [EFFECT-TS] provides typed request/reply over NATS transport:

- Each `Rpc.make()` definition generates a typed request and response schema.
- `RpcRouter` dispatches incoming messages to the correct handler based on the RPC tag.
- `RpcSerialization.layerJson` handles encode/decode.
- `RpcServer.layerProtocolWebsocketRouter` exposes RPCs over WebSocket for browser clients.

From `rpc/index.ts`, the 17 RPC groups compose into a single `IIoTRpcs` group:
- 3 stateless query groups (Sensor, Asset, Alarm queries)
- 12 entity-derived groups (one per ISA-95 asset type + WorkOrder + EquipmentState)
- 1 realtime streaming group (RealtimeRpcs for WebSocket subscriptions)
- 1 entity management group (AssetEntityRpcs + SensorEntityRpcs)

### 9.4 Circuit Breaker via Effect Policies

The Circuit Breaker pattern [MSVC-CIRCUITBREAKER] is implemented at the Effect level, not the network level:

```typescript
// Retry with exponential backoff + circuit breaker
const resilientCall = pipe(
  rpcCall,
  Effect.retry(
    Schedule.exponential('100 millis').pipe(
      Schedule.compose(Schedule.recurs(3)),
      Schedule.union(Schedule.spaced('5 seconds')),
    )
  ),
  Effect.timeout('30 seconds'),
)
```

NATS itself provides additional resilience:
- Automatic reconnection on connection loss
- Request timeouts with configurable deadlines
- JetStream acknowledgment for guaranteed delivery [JETSTREAM]

### 9.5 API Composition for Cross-Entity Queries

The API Composition pattern [MSVC-APICOMP] is needed for queries that span multiple entity types:

```
"Show me Plant P1 with all its Lines, their current states, and active alarms"
```

This requires data from PlantState, LineState (multiple), EquipmentStateEntity, and AlarmEntity. The composition happens at the RPC handler level:

- `AssetRpcs.GetPlantHierarchy` aggregates data from multiple state services in a single Effect.gen pipeline.
- No HTTP service-to-service calls. All state services are local Effect services resolved via `Context.Tag`.
- Cross-runner entity queries go through `@effect/cluster` sharding -- the cluster routes the request to the runner hosting that entity instance.

---

## 10. Multi-Tenancy Architecture at 200K Scale {#10-multi-tenancy-architecture}

### 10.1 The Organizational Unit

Each organization in the manufacturing commons is a **first-class tenant** with:

| Resource | Isolation Mechanism | Evidence |
|---|---|---|
| **Identity** | NATS JWT with org-scoped claims [NATS-DECENTRALIZED] | Proposed |
| **Subject namespace** | NATS account per org [NATS-ACCOUNTS] | Proposed (see Section 9.2) |
| **Entity state** | Schema-prefixed tables OR dedicated database | State services already abstract this (`state/*.ts`) |
| **JetStream resources** | Per-account limits (streams, consumers, storage) | NATS built-in |
| **Event distribution** | Per-org ChannelService instance | `event-distribution.ts` channels are scoped |
| **Configuration** | NATS KV bucket per org [NATS-KV] | Proposed |

### 10.2 NATS Account Architecture

VERIFIED via DeepWiki (nats-io/nats-server): NATS accounts support dynamic creation via `AccountResolver` without server restart. JWT-based auth enables:

1. **Operator JWT**: TMNL network operator (signs account JWTs)
2. **Account JWT**: One per organization (200K accounts). Defines permissions, JetStream limits, and import/export rules.
3. **User JWT**: One per user within an org. Scoped to the org's account.

Per-account JetStream resource limits:

```json
{
  "mem_storage": 1073741824,    // 1 GB memory per org
  "disk_storage": 10737418240,  // 10 GB disk per org (Earl)
  "streams": 20,                 // Max 20 JetStream streams
  "consumer": 100                // Max 100 consumers
}
```

Large orgs can have higher limits. The operator can update limits by reissuing the account JWT -- no server restart required.

**Cross-reference**: See consistency-theorist's [Z.3.1] for formal analysis of NATS account resource limits at 200K scale, including memory-per-account bounds and JetStream stream count scaling.

### 10.3 Cross-Org Communication via Service Imports/Exports

NATS service imports/exports [NATS-ACCOUNTS] enable consent-based cross-org data sharing:

```
Account: org-001 (Earl's Machine Shop)
  exports:
    service: capacity.cnc.availability  // "I have CNC machines available"
    accounts: [network-marketplace]     // Only the marketplace can see this

Account: org-002 (Boeing Subcontractor)
  imports:
    service: capacity.cnc.availability  // "I want to find CNC capacity"
    from: network-marketplace           // Routed through marketplace, not direct
```

This enables the marketplace (Section 13) without exposing Earl's internal subjects to Boeing or vice versa. The marketplace account acts as a broker -- it can see availability signals but NOT internal telemetry, alarms, or entity state.

**Key principle**: This is the federation layer. There is no "FederationGateway" or dedicated federation service. NATS account topology (exports, imports, leaf nodes) provides all cross-org communication primitives. The `manufacturing-commons` system account hosts lightweight infrastructure singletons (SLA monitoring per G-8, reputation CRDT aggregation per X.9), but these observe and aggregate — they do not mediate or orchestrate cross-org flows. See Section 12.4 for why choreography (not orchestration) is mandatory for cross-org sagas.

### 10.4 @effect/cluster Sharding for Multi-Tenancy

`@effect/cluster` supports tenant partitioning via ShardGroups [EFFECT-CLUSTER]:

```typescript
const SiteEntity = Entity.make('Site', [ /* RPCs */ ])
  .annotate(ClusterSchema.ShardGroup, (entityId) => {
    // Entity IDs are formatted as "orgId.entityId"
    const orgId = entityId.split('.')[0]
    return orgId  // Each org is a ShardGroup
  })
```

This ensures that all entities for a given org are sharded together. Benefits:

- **Data locality**: All of Earl's entities are on the same runner (or nearby runners)
- **Resource isolation**: A misbehaving org's entities don't exhaust resources on runners hosting other orgs
- **Migration granularity**: An org can be migrated to a new runner without affecting other orgs

With `shardsPerGroup: 300` (default), 200K orgs would create 60M shards. This is operationally feasible because:
- Shard metadata is lightweight (runner assignment only, stored in `RunnerStorage`)
- Entity instances are created lazily -- only when the first message arrives
- The `EntityReaper` destroys idle entities after `maxIdleTime` (default 1 minute)

For small orgs (Earl: 2 machines, ~10 entities), most shards will be empty.

#### 10.4.1 Layer Pooling via LayerMap (NOT Layer.fresh per Tenant)

A naive approach would instantiate `Layer.fresh` for each of 200K orgs at startup. This is incorrect -- 200K concurrent layer instances would exhaust memory. The correct mechanism is `LayerMap` [EFFECT-LAYERMAP] -- an Effect-native keyed layer cache with idle eviction:

| Mechanism | Use In This Architecture | 200K Tenant Context |
|-----------|--------------------------|---------------------|
| `Layer.memoize` | Singleton services shared across all requests within one runner | NATS client, Sharding service, ChannelService -- shared infrastructure |
| `Layer.fresh` | Test isolation -- each test gets fresh EventJournal (see `Layer.fresh(EventJournal.layerMemory)` in 7 test files) | NOT for per-tenant isolation (200K instantiations = OOM) |
| `LayerMap` | **Correct answer** -- keyed layer cache with `idleTimeToLive` | Per-org entity layers cached by `orgId`, idle ones evicted |

The three-layer strategy:

1. **Shared (memoized)**: NATS, ChannelService, WebSocket -- one instance per runner process
2. **Pooled (LayerMap)**: Entity handlers + state services -- keyed by `orgId`, cached with TTL, evicted when idle. At peak, ~5K-10K active org layers warm (not 200K)
3. **Per-request (FiberRef)**: `CurrentOrgId` propagated through fiber scope for authorization, audit logging, NATS subject routing

```typescript
// Shared infrastructure (memoized, singleton)
const SharedInfra = Layer.mergeAll(
  NatsClientLive,
  EventDistributionLayer,
  WebSocketServerLayer,
)

// Per-organization entity layer (cached via LayerMap)
const OrgEntityLayerMap = LayerMap.make({
  lookup: (orgId: OrgId) =>
    EntityHandlersLayer.pipe(
      Layer.provide(makeOrgStateServices(orgId)),  // tenant-specific DB connection
      Layer.provide(makeOrgFeatureFlags(orgId)),
    ),
  idleTimeToLive: Duration.minutes(30),  // evict idle tenants after 30 min
})

// Per-request: FiberRef carries current org context
const CurrentOrgId = FiberRef.unsafeMake<OrgId>("" as OrgId)

// Request handler: resolve org-scoped layer from pool
const handleRequest = (orgId: OrgId) =>
  Effect.gen(function* () {
    const orgLayer = yield* OrgEntityLayerMap.lookup(orgId)
    // ... execute within org-scoped context
  }).pipe(
    Effect.locally(CurrentOrgId, orgId),
  )
```

**TTL tuning by deployment tier**: Edge devices (T2) should use short TTL (5 minutes, typically 1 active org). Cloud runners (T3) use longer TTL (30 minutes, thousands of orgs). The `idleTimeToLive` is the memory control valve.

**Codebase grounding**: `LayerMap` is exported from `effect/src/LayerMap.ts`. The `AllStateServicesInMemory` pattern (`src/lib/iiot/layers/index.ts:462`) demonstrates the per-org state service composition that would become `makeOrgStateServices(orgId)` in production.

### 10.5 Zero-Trust Between Organizations

Following [ZERO-TRUST]:

1. **No implicit trust**: Org A cannot access Org B's entities, state, or events without explicit import/export rules.
2. **Verify explicitly**: Every cross-org request carries a signed JWT. The receiving org validates the JWT before processing.
3. **Least privilege**: Import/export rules specify exactly which subjects are shared. No wildcard cross-account access.
4. **Assume breach**: If one org's NATS credentials are compromised, the blast radius is limited to that org's account. Other accounts are unaffected.

NATS accounts enforce these principles at the protocol level -- no application-level enforcement needed.

---

## 11. Edge-First Deployment: The Deployment Spectrum {#11-edge-first-deployment}

### 11.1 The Deployment Spectrum

The same codebase (`EntityStack`, `machines`, `rpc`) runs at every scale. The deployment topology varies:

| Profile | Hardware | NATS | Cluster | State | Use Case |
|---|---|---|---|---|---|
| **Edge Micro** | Raspberry Pi / $50 device | Leaf node | No cluster (standalone) | In-memory (`XxxStateInMemory`) | Earl's 2-machine shop |
| **Edge Standard** | Industrial PC | Leaf node | Single runner | In-memory + SQLite | 10-50 machines |
| **Site** | Server rack | Full NATS server | Multi-runner cluster | PostgreSQL + TimescaleDB | Factory floor |
| **Regional** | Cloud region | NATS supercluster node | Multi-site cluster | Distributed PostgreSQL | Metro area hub |
| **Network** | Multi-region cloud | NATS supercluster | Global cluster | CockroachDB [COCKROACHDB] | Manufacturing commons backbone |

### 11.2 Edge Micro: Earl's Machine Shop

Earl runs a single binary on a $50 device:

```
┌─────────────────────────────────────────────┐
│  Earl's Edge Device ($50)                    │
│                                              │
│  ┌──────────┐  ┌────────────────────────┐   │
│  │ NATS     │  │ TMNL Runtime           │   │
│  │ Leaf     │  │                         │   │
│  │ Node     │◄─┤ Tier 1: NATS client    │   │
│  └────┬─────┘  │ Tier 2: 2 Machine      │   │
│       │        │         entities        │   │
│       │        │ Tier 3: ChannelService  │   │
│       │        │         (local only)    │   │
│       │        │ No Tier 4/5 (no WS,    │   │
│       │        │ no cluster sharding)    │   │
│       │        └────────────────────────┘   │
│       │                                      │
│       │    NATS Leaf Node Connection         │
└───────┼──────────────────────────────────────┘
        │
        ▼  (WAN, intermittent)
┌───────────────┐
│ Regional Hub  │
│ (NATS Server) │
└───────────────┘
```

The key architectural decisions for Edge Micro depend on the deployment tier (see `rfc-section-edge-architecture-v2.md:853-878`):

**T1 profile ($50 Raspberry Pi -- Earl's starting point)**:
1. **SparkplugPipelineLayer ONLY**: SparkplugAdapterLive + ReadingProcessorLive + AlarmDetectorLive + IngestionServiceLive -- 4 services total.
2. **NO entities, NO EventDistribution, NO WebSocket server**: Sensor readings flow to NATS via leaf node. Entity management is handled by the cloud runner.
3. **NATS leaf node**: Connects to regional hub for outbound telemetry and inbound commands. Buffers messages during disconnection.

**T2 profile ($500 mini-PC -- Earl graduates)**:
1. **`SingleRunner.layer({ runnerStorage: "memory" })`**: Full entity runtime without PostgreSQL. Entities run locally with a single runner that doesn't coordinate with any cluster.
2. **In-memory state + SQLite MessageStorage**: Uses `AllStateServicesInMemory` (`src/lib/iiot/layers/index.ts:462`) for state. `MessageStorage` backed by SQLite for entity replay across restarts.
3. **Local-only ChannelService**: EventDistribution publishes to local channels. HolonetBridge publishes to NATS when connectivity is available.
4. **Offline operation**: Entity state machines continue to function without network. State transitions are validated locally against the graph. Events are queued and synced when connectivity resumes.

The critical insight: **the same `EntityHandlersLayer` from `EntityStack.ts:54-67` runs at T2, T3, and cloud.** What changes is the runner hosting it (SingleRunner at T2, SocketRunner at T3+) and the state service adapters wired beneath it (InMemory for T1/T2 edge, SQLite for T2 persistent, PostgreSQL for T3/cloud).

### 11.3 NATS Leaf Nodes as Tenant Gateways

NATS leaf nodes [NATS-LEAFNODE] serve as the edge-to-cloud bridge:

- Each edge device runs a NATS leaf node that connects to the regional NATS cluster.
- The leaf node authenticates with the org's account JWT.
- Subject routing is automatic: messages published locally flow to the hub; messages published at the hub flow to the leaf.
- Connection loss is handled gracefully: the leaf node buffers and retransmits when reconnected.
- JetStream consumers on the hub resume from the last acknowledged position.

For 200K orgs, the topology is:

```
                ┌───────────────────┐
                │  NATS Supercluster │
                │  (3-5 nodes)       │
                └───────┬───────────┘
                        │
            ┌───────────┼───────────┐
            │           │           │
      ┌─────▼─────┐ ┌──▼──────┐ ┌─▼────────┐
      │ Regional   │ │ Regional│ │ Regional  │
      │ Hub (ATL)  │ │ Hub (DFW)│ │ Hub (SEA) │
      └─────┬──────┘ └──┬──────┘ └─┬────────┘
            │           │           │
   ┌────────┼────┐   ┌──┼──┐   ┌───┼───┐
   │  │  │  │    │   │  │  │   │   │   │
   L  L  L  L    L   L  L  L   L   L   L    (L = Leaf Node = Org Edge Device)
```

Each leaf node IS a tenant gateway [MSVC-SIDECAR]. The sidecar pattern is implemented at the infrastructure level (NATS), not the application level.

**Cross-reference**: See consistency-theorist's [Z.12.1] for RBAC scaling analysis across the deployment spectrum -- how authorization policies compose differently at Edge Micro (local-only, implicit trust) vs. Regional (multi-org, JWT-scoped) vs. Network (cross-org, bilateral exports).

### 11.4 Nex (NATS Execution Engine) for Edge Workloads

NATS Nex runs workloads at the edge. Each edge site could run a Nex workload that:

1. Hosts a subset of entity instances (local shards for that org's assets)
2. Connects to hub via NATS leaf nodes
3. Runs the ingestion pipeline locally (Sparkplug -> NATS -> local `ReadingProcessor` -> `AlarmDetector`)
4. Publishes processed readings and alarm violations to the hub

The Nex workload model maps to our Layer composition:

```typescript
// Edge Nex Workload Layer (proposed)
const EdgeWorkloadLayer = Layer.mergeAll(
  // Only the entity types this site needs
  MachineAssetEntityHandlers,
  DeviceEntityHandlers,
  SensorAssetEntityHandlers,
  // Local ingestion pipeline
  SparkplugPipelineLayer,
  // Local event distribution (no HolonetBridge on edge)
  EventDistributionLocalOnly,
).pipe(
  Layer.provide(AllStateServicesInMemory),
  Layer.provide(NatsLeafNodeClient),
)
```

### 11.5 Strangler Fig Migration

The Strangler Fig pattern [MSVC-STRANGLER] applies when organizations migrate from existing systems:

1. **Phase 1**: Install NATS leaf node alongside existing SCADA/MES. Sparkplug adapter ingests data from existing PLCs.
2. **Phase 2**: TMNL entity state machines mirror existing system state. Both systems run in parallel. Operators use TMNL dashboard alongside existing HMI.
3. **Phase 3**: TMNL becomes primary. Existing system becomes read-only backup.
4. **Phase 4**: Existing system decommissioned.

Each phase is a deployment profile change -- same codebase, different Layer composition.

---

## 12. Cross-Organization Saga Patterns {#12-cross-org-saga-patterns}

### 12.1 The Cross-Org Work Order Lifecycle

When Org A routes a manufacturing job to Org B, the work order lifecycle spans two NATS accounts:

```
Org A (Requester)           Network Marketplace         Org B (Provider)
     │                            │                          │
     │  1. PostWorkOrder          │                          │
     ├───────────────────────────>│                          │
     │                            │  2. MatchCapability      │
     │                            ├─────────────────────────>│
     │                            │  3. SubmitBid            │
     │                            │<─────────────────────────┤
     │  4. ReviewBid              │                          │
     │<───────────────────────────┤                          │
     │  5. AcceptBid              │                          │
     ├───────────────────────────>│                          │
     │                            │  6. ConfirmAcceptance    │
     │                            ├─────────────────────────>│
     │                            │  7. StartJob             │
     │                            │<─────────────────────────┤
     │                            │  8. ReportCompletion     │
     │                            │<─────────────────────────┤
     │  9. ConfirmDelivery        │                          │
     │<───────────────────────────┤                          │
     │  10. UpdateReputation      │                          │
     ├───────────────────────────>│                          │
```

### 12.2 Saga Classification

Following [SAGA-GARCIA] and [MSVC-SAGA]:

| Step | Action | Compensating Action | Type |
|---|---|---|---|
| 1. PostWorkOrder | Create WO in Org A | Cancel WO | Compensatable |
| 2. MatchCapability | Find matching providers | N/A (query) | Read-only |
| 3. SubmitBid | Create Bid in Org B | Withdraw Bid | Compensatable |
| 4. ReviewBid | Read-only review | N/A | Read-only |
| 5. AcceptBid | Lock WO to Bid | Release WO, Reject Bid | **Pivot point** |
| 6. ConfirmAcceptance | Notify Org B | Timeout -> auto-cancel | Compensatable |
| 7. StartJob | Begin execution | Suspend + notify | Retriable |
| 8. ReportCompletion | Mark complete | Dispute process | Retriable |
| 9. ConfirmDelivery | Accept delivery | Dispute process | **Pivot point** |
| 10. UpdateReputation | Append to event log | N/A (append-only) | Non-compensatable |

The saga has two pivot points:
- **AcceptBid** (step 5): Before this, both parties can withdraw freely. After this, compensation involves financial/contractual implications.
- **ConfirmDelivery** (step 9): After this, the job is closed and reputation is updated. No undo.

### 12.3 NATS Implementation

The saga coordination uses NATS subjects across three accounts:

```
Account: org-001 (Requester)
  marketplace.workorder.org-001.{woId}      -- WO lifecycle events
  marketplace.workorder.org-001.{woId}.bids -- Incoming bids

Account: network-marketplace (Broker)
  marketplace.capabilities.>                 -- Capability index
  marketplace.matches.{woId}                 -- Match results

Account: org-002 (Provider)
  marketplace.jobs.org-002.{jobId}           -- Job execution events
  marketplace.bids.org-002.{bidId}           -- Outgoing bids
```

Cross-account communication uses NATS service imports/exports:

```
org-001 exports: marketplace.workorder.org-001.> to network-marketplace
org-002 exports: marketplace.bids.org-002.> to network-marketplace
network-marketplace exports: marketplace.matches.{woId} to org-001
network-marketplace exports: marketplace.jobs.> to org-002 (filtered)
```

### 12.4 Choreography Over Orchestration: A Trust-Based Recommendation

**Recommendation: Choreography-based sagas for ALL cross-org flows.** Orchestration-based sagas SHOULD NOT be used for cross-organization coordination.

The rationale is fundamentally about **trust governance**, not technical capability (per consistency-theorist's analysis in [Z.11.3]):

1. **Governance asymmetry**: A central orchestrator (even if operated by the "neutral" marketplace account) creates a governance chokepoint. Whoever controls the orchestrator controls the saga -- they can reorder steps, inject delays, or selectively compensate. This is unacceptable for a commons-based network [OSTROM-COMMONS].

2. **Small-shop adoption**: Earl's machine shop will NOT adopt a system where Boeing's orchestrator can unilaterally cancel his bids or impose step ordering. Choreography ensures bilateral control: each org reacts to events from the other, and either party can exit at any compensatable step.

3. **NATS-native**: Choreography maps naturally to NATS pub/sub: each org publishes state changes to its own subjects, and the other org subscribes to relevant subjects. No central state machine is needed. The JetStream stream per work order provides causal ordering without a coordinator.

4. **Failure isolation**: If the marketplace account goes down, in-flight sagas continue because each org holds its own state. With orchestration, a coordinator failure stalls ALL active sagas.

The cross-org saga lifecycle (Section 12.1) operates as follows under choreography:
- Steps 1-4 are bilateral events: Org A publishes WO, marketplace broadcasts match, Org B publishes bid.
- Step 5 (AcceptBid) is a bilateral handshake: Org A publishes acceptance, Org B ACKs.
- Steps 6-9 are bilateral progress events: each org publishes its own state transitions.
- Step 10 (UpdateReputation) is append-only, non-compensatable.

No step requires a central orchestrator. The marketplace account serves as a **projection** (event consumer) that builds aggregate views (search indices, reputation), NOT as a coordinator that drives saga flow.

### 12.5 Consistency Guarantees for Cross-Org Sagas

Per the two-domain consistency model (from temporal-analyst):

- **Intra-org events**: Sequential per-entity, causal cross-entity [TMNL-CONSISTENCY, G-1 through G-7]
- **Cross-org events**: Bounded staleness at 60 seconds (G-8 proposed)
- **Saga coordination**: NATS bilateral exports between org accounts. Each org's JetStream stream provides causal ordering for its own events. Cross-org causal ordering is ensured by the request-response pattern at pivot points (steps 5 and 9).

**Cross-reference**: See consistency-theorist's [Z.11.3] for formal analysis of choreography vs. orchestration in commons-based manufacturing networks, including the trust governance argument and Ostrom alignment.

**Failure recovery**: If Org B's edge device goes offline during step 7 (StartJob):
1. NATS leaf node buffers outbound messages.
2. Org A observes timeout on expected progress events (no central coordinator needed).
3. After configurable timeout (e.g., 5 minutes), Org A's local saga state transitions to "pending-confirmation".
4. When Org B reconnects, buffered messages flow. Job status updates resume.
5. If timeout exceeds SLA (e.g., 24 hours), compensation triggers: Org A re-opens work order for rebidding. Org B receives a compensation event on reconnect.

---

## 13. Novel Manufacturing Commons Patterns {#13-novel-manufacturing-commons-patterns}

### 13.1 Capacity as an Event Stream

Organizations publish available machine-hours as real-time events:

```typescript
export class CapacityAvailability extends Schema.TaggedClass<CapacityAvailability>()(
  'CapacityAvailability', {
    orgId: OrgId,
    machineType: Schema.String,        // e.g., "CNC-5axis", "Lathe"
    material: Schema.Array(Schema.String), // e.g., ["aluminum", "steel"]
    availableHours: Schema.Number,
    pricePerHour: Schema.optional(Schema.Number),
    qualityCertifications: Schema.Array(Schema.String), // e.g., ["AS9100", "ISO9001"]
    validUntil: Schema.DateTimeUtc,
  }
) {}
```

Published to `marketplace.capacity.{orgId}.{machineType}` subject. The marketplace aggregates these into a searchable capability index.

This is **Capacity as a Microservice** -- each organization IS a service that publishes its availability. No central registry manages capacity; the network is self-describing via event streams [REACTIVE-MANIFESTO].

### 13.2 Capability Discovery as a Search Service

The manufacturing commons needs a "find me someone who can do X" search:

```
Query: "5-axis CNC machining of aluminum, AS9100 certified, within 50 miles of ATL, available next week"
```

This maps to a **materialized view** built from `CapacityAvailability` events:

1. Events flow into a JetStream stream (`marketplace.capacity.>`)
2. A consumer builds a search index (ElasticSearch, Meilisearch, or NATS KV with secondary indices)
3. Query RPCs search the index: `MarketplaceRpcs.SearchCapability(query) -> Stream<CapabilityMatch>`

The search service is a read-model in the CQRS sense [MSVC-CQRS] -- it consumes events and builds a queryable projection. It does NOT modify entity state.

### 13.3 Reputation as an Event-Sourced Aggregate

Organization reputation is built from completed work orders:

```typescript
export class ReputationEvent extends Schema.TaggedClass<ReputationEvent>()(
  'ReputationEvent', {
    orgId: OrgId,
    workOrderId: WorkOrderId,
    rating: Schema.Number,           // 1-5
    onTimeDelivery: Schema.Boolean,
    qualityAccepted: Schema.Boolean,
    timestamp: Schema.DateTimeUtc,
  }
) {}
```

Reputation is event-sourced [EVENT-SOURCING] because:
- Historical record matters (an org's reputation over time, not just current score)
- Append-only (ratings cannot be retroactively modified -- regulatory integrity)
- Audit trail for dispute resolution [FDA-CFR11]

The aggregate calculates:
- Rolling average rating (last 100 jobs)
- On-time delivery percentage
- Quality acceptance rate
- Response time to bids

### 13.4 Federated Compliance

Manufacturing certifications (AS9100, ISO 9001, ITAR) are verified and published as events:

```
marketplace.compliance.{orgId}.certifications  -- Current certifications
marketplace.compliance.{orgId}.audits          -- Audit history
```

The compliance service is **federated** [OSTROM-COMMONS]:
- Organizations self-report certifications
- Auditors (third-party accounts) verify and countersign
- The network tracks certification status but does NOT enforce -- enforcement is the auditor's responsibility
- Expired certifications are automatically flagged but not removed (the org may be in renewal)

This follows Ostrom's principles for governing commons resources [OSTROM-COMMONS]: the network provides transparency and coordination infrastructure, but governance is participatory, not centralized.

### 13.5 Twelve-Factor Compliance

Per [TWELVE-FACTOR], the TMNL runtime at any deployment profile:

| Factor | Implementation |
|---|---|
| I. Codebase | Single monorepo, same binary for edge and cloud |
| II. Dependencies | Bun lockfile, Effect `Layer.provide` for DI |
| III. Config | `IIoTFeatureFlags` + NATS KV [NATS-KV] |
| IV. Backing services | NATS, PostgreSQL, TimescaleDB -- all via `Context.Tag` |
| V. Build, release, run | Nix flake for reproducible builds |
| VI. Processes | Stateless runners; entity state in state services |
| VII. Port binding | WebSocket server self-contained in Layer |
| VIII. Concurrency | `@effect/cluster` runners for horizontal scale |
| IX. Disposability | Scope finalizers + EntityReaper for graceful shutdown |
| X. Dev/prod parity | `EntityTestingStack` mirrors production architecture |
| XI. Logs | Effect.log structured logging |
| XII. Admin processes | Effect-based scripts, same Layer composition |

---

## 14. Formalization Recommendations {#14-formalization-recommendations}

### 14.1 Priority-Ordered Formalization Backlog

| Priority | Pattern | Current State | Proposed Formalization | Impact |
|---|---|---|---|---|
| **P0** | Entity Pipeline Factory | Copy-pasted 12x | Higher-order factory from Schema + Graph | Enables custom entity types for 200K orgs |
| **P0** | Graph Meta-Schema | Implicit structural invariants | `Schema.Struct` for graph definitions | Enables codegen, runtime introspection, UI visualization |
| **P1** | Triple-Publish EventDistribution | Dual-publish (local + NATS) | Add network-scoped export channel | Enables cross-org marketplace |
| **P1** | State Service Factory | Copy-pasted 13x | Generic factory from Schema + Id type | Eliminates boilerplate, enables NATS KV adapter |
| **P2** | RPC Derivation from Graph | Hand-written per entity | Auto-generate from graph edges | Consistency guarantee: every graph edge has an RPC |
| **P2** | Cross-Entity Cascade Rules | Implicit in handler logic | Declarative cascade configuration | Enables ISA-95 hierarchy propagation |
| **P3** | Deployment Profile Layers | Manual Layer composition per profile | Profile-based factory (`EdgeMicro`, `Site`, `Regional`) | 15-minute onboarding for new orgs |

### 14.2 Implementation Order

```
Phase 1: Graph Meta-Schema + Entity Pipeline Factory
  -> Validates the pattern, enables codegen spike

Phase 2: State Service Factory + NATS KV adapter
  -> Enables edge deployment without PostgreSQL

Phase 3: Triple-Publish + Cross-Org Export
  -> Enables marketplace MVP

Phase 4: RPC Derivation + Cascade Rules
  -> Completes the formalization for custom entity types

Phase 5: Deployment Profile Layers + Nex Integration
  -> Production edge deployment
```

---

## 15. Risk Analysis {#15-risk-analysis}

### 15.1 Pattern Formalization Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Entity Pipeline Factory is too rigid for custom entity types | 30% | High | Design with escape hatches: factory generates 80% of boilerplate, remaining 20% is hand-written |
| Graph Meta-Schema doesn't capture all invariants (guards, side effects) | 40% | Medium | Start with structural invariants only; add behavioral invariants incrementally |
| Triple-publish adds latency to event distribution | 20% | Medium | Network publish is fire-and-forget (non-blocking); measure before optimizing |
| 200K NATS accounts exceed operational capacity | 15% | High | NATS accounts are lightweight (JWT-only, lazy loading per DeepWiki verification). Monitor memory per account. |
| Cross-org saga coordination is too complex for small orgs | 50% | Medium | Small orgs participate in marketplace via simple request/response, not full saga. Saga complexity is hidden by the marketplace service. |

### 15.2 Architectural Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Single-binary deployment limits independent scaling | 25% | Medium | `@effect/cluster` ShardGroups enable per-entity-type scaling within the binary. If needed, split into multiple binaries at the Layer tier boundary. |
| In-memory state loss on edge device restart | 60% | High | Implement NATS KV state adapter (P1) for durable edge state. JetStream replay recovers in-flight events. |
| NATS leaf node reconnection causes event duplication | 45% | Medium | JetStream deduplication [NATS-DEDUP-INF] with per-subject `Nats-Msg-Id` headers. Entity handlers are idempotent by design (state machine transitions are idempotent). |
| Cross-org trust establishment is a cold-start problem | 70% | High | Bootstrap with existing industry relationships (Atlanta manufacturing associations). Implement graduated trust: new orgs start with low reputation but can accept small jobs. |

---

## Sources

### Normative
- [ISA-95-1], [ISA-95-2], [ISA-95-5], [ISA-18.2], [FDA-CFR11], [IEC-62443]
- [RFC2119], [RFC8174]

### Microservices Patterns
- [RICHARDSON-MSVC], [MSVC-IO], [NEWMAN-MSVC], [NEWMAN-MONOLITH]
- [MSVC-DECOMP-BIZ], [MSVC-DECOMP-SUB], [MSVC-DB-PER-SVC]
- [MSVC-SAGA], [SAGA-GARCIA], [MSVC-OUTBOX], [MSVC-EVENTSRC], [MSVC-CQRS]
- [MSVC-APICOMP], [MSVC-CIRCUITBREAKER], [MSVC-SVCDISC], [MSVC-SIDECAR]
- [MSVC-EXTCONFIG], [MSVC-STRANGLER]

### Domain-Driven Design
- [EVANS-DDD], [VERNON-IDDD], [BOUNDED-CONTEXT], [CONTEXT-MAP], [ANTI-CORRUPTION]

### Effect-TS & Cluster
- [EFFECT-TS], [EFFECT-CLUSTER], [EFFECT-ENTITY], [EFFECT-MACHINE]

### NATS
- [NATS-PROTO], [JETSTREAM], [NATS-KV], [NATS-LEAFNODE], [NATS-ACCOUNTS], [NATS-DECENTRALIZED]
- [NATS-COMPARE], [NATS-DEDUP-INF]

### Distributed Systems
- [CAP-BREWER], [LAMPORT-1978], [EVENT-SOURCING], [CQRS], [LOG-KREPS]
- [COCKROACHDB]

### Platform Economics & Commons
- [PARKER-PLATFORM], [OSTROM-COMMONS], [COASE-FIRM]

### Internal Research
- [TMNL-CLUSTER], [TMNL-CONSISTENCY], [TMNL-UNS], [TMNL-ARCH-OPT]

### Additional
- [TWELVE-FACTOR], [REACTIVE-MANIFESTO], [ZERO-TRUST], [KLEPPMANN]
- [MULTI-TENANT-SAAS]
