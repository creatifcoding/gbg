# RFC-001 Section: Effect-TS Implementation Architecture

```
Section:       Effect-TS Implementation Architecture
Parent RFC:    RFC-001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        Val (effect-specialist)
Created:       2026-02-09
Research Base: research-effect-architecture.md (1589 lines, 7 sections)
```

> This section specifies the normative Effect-TS architecture for scaling the TMNL
> IIoT platform from its current single-site deployment to a 200K-organization
> metropolitan manufacturing network. Every pattern references existing codebase
> implementations and proposes extensions, not replacements. File paths are relative
> to `packages/tmnl/src/`.

---

## Table of Contents

1. [Entity Distribution and Capacity Planning](#1-entity-distribution-and-capacity-planning)
2. [Machine-in-Entity Composition](#2-machine-in-entity-composition)
3. [Schema and Type System](#3-schema-and-type-system)
4. [RPC Architecture and Tenant Isolation](#4-rpc-architecture-and-tenant-isolation)
5. [Stream Architecture and Backpressure](#5-stream-architecture-and-backpressure)
6. [Layer Composition Architecture](#6-layer-composition-architecture)
7. [Testing Architecture](#7-testing-architecture)
8. [Open Questions and Recommendations](#8-open-questions-and-recommendations)

---

## 1. Entity Distribution and Capacity Planning

### 1.1 Entity Cardinality Model

The target deployment is a metropolitan manufacturing network of 200K organizations,
each with variable equipment depth following the ISA-95 hierarchy [ISA-95-1].

Implementations MUST plan for the following entity cardinality:

| Entity Type | Multiplier per Org | Total at 200K Orgs | Shard Group |
|---|---|---|---|
| Organization | 1 | 200,000 | `orgs` |
| Site/Plant | ~2 | 400,000 | `assets` |
| Line/WorkCell | ~5 | 1,000,000 | `assets` |
| Machine/Device | ~10 | 2,000,000 | `equipment` |
| Sensor | ~50 | 10,000,000 | `telemetry` |
| Alarm (active) | ~2 | 400,000 | `events` |
| WorkOrder (active) | ~1 | 200,000 | `events` |
| **Total** | | **~14,200,000** | |

The default `shardsPerGroup` is 300 [EFFECT-CLUSTER]. At 14.2M entities across
5 shard groups, this yields ~2.84M entities per group and ~9,400 entities per shard.

Entity instances are lazy-activated: created on first message, reaped after
`maxIdleTime` (default: 1 minute) [EFFECT-CLUSTER]. At any given moment, only
1--5% of entities are active in a manufacturing network where most sensors report
periodically. This means ~140K--710K concurrently active entity instances across
the cluster, not 14.2M.

**Codebase proof**: The current system manages 12 entity types composed via
`Layer.mergeAll` at `lib/iiot/entity/EntityStack.ts:54-67` [EFFECT-LAYER]. The
`EntityHandlersLayer` merges all handler layers into a single composable layer.
Adding Organization, Capability, and Marketplace entity types requires appending
to this same `Layer.mergeAll` call.

### 1.2 Shard Group Configuration

Implementations MUST use `ClusterSchema.ShardGroup` annotations [EFFECT-CLUSTER]
to separate entity types into domain-aligned shard groups. Different entity types
MUST NOT compete for the same shard space.

| Shard Group | Entity Types | Recommended Shards | Entities/Shard | Rationale |
|---|---|---|---|---|
| `org-identity` | Organization | 300 (default) | ~667 | Low churn, heavy state |
| `marketplace` | Listing, Template, SharedAsset | 300 (default) | ~1,000 | Cross-org, eventual consistency |
| `asset-hierarchy` | Site, Plant, Area, Line, WorkCell | 1,000 | ~1,400 | ISA-95 hierarchy, moderate churn |
| `equipment` | Machine, Device | 1,500 | ~1,333 | Equipment state machines, high churn |
| `telemetry` | Sensor | 3,000 | ~3,333 | Highest cardinality |
| `operational` | Alarm, WorkOrder, EquipmentState | 500 | ~1,200 | Event-sourced, bounded active count |

```typescript
// Shard group annotation pattern [EFFECT-CLUSTER]
const OrgEntity = Entity.make("Organization", OrgRpcGroup)
  .annotate(ClusterSchema.ShardGroup, "org-identity")

const SensorEntity = Entity.make("Sensor", SensorRpcGroup)
  .annotate(ClusterSchema.ShardGroup, "telemetry")
```

**LOOP OPEN (LO-1)**: The current `shardsPerGroup` configuration is global, not
per-group. To achieve the recommended per-group shard counts, implementations
SHOULD either: (a) deploy independent cluster instances per shard group,
(b) contribute a per-group shard count patch to `@effect/cluster`, or
(c) accept the 300-shard default and rely on entity-level distribution within
shards. **Recommendation**: Option (c) for MVP/Growth milestones, option (a) for
Metro scale.

### 1.3 Runner Topology

Implementations MUST select runner transport based on deployment profile:

| Profile | Runner Type | Protocol | When to Use |
|---|---|---|---|
| **Production cluster** | `SocketRunner` | TCP binary | Runner-to-runner backbone. REQUIRED for high-throughput shard groups. |
| **Edge gateway** | `HttpRunner.layerWebsocket` | WebSocket | On-premise nodes behind corporate firewalls. |
| **API gateway** | `HttpRunner.layerHttp` | HTTP POST | External clients. Does NOT support streaming. |
| **Development** | `SingleRunner` | In-process + SQL | Full durability without network overhead. |
| **Testing** | `TestRunner` | In-memory | Unit tests. No persistence, no network. |

Verified via `SocketRunner.ts`, `HttpRunner.ts`, `SingleRunner.ts`, `TestRunner.ts`
[EFFECT-CLUSTER].

The runner weight formula SHOULD be:

```
runner_weight = (available_memory_GB / 32) * (cpu_cores / 8) * locality_bonus
```

Where `locality_bonus = 1.5` for runners co-located with NATS superclusters.

### 1.4 EntityResource for Connection Pooling

Implementations MUST use `EntityResource.make` [EFFECT-CLUSTER] for per-organization
NATS connections. EntityResource provides reference-counted resources that survive
entity restarts during shard movements.

```typescript
const OrgNatsResource = EntityResource.make({
  acquire: Effect.gen(function* () {
    const orgId = yield* EntityAddress.entityId
    const connection = yield* NatsClient.connect({
      servers: (yield* NatsConfig).servers,
      user: `org-${orgId}`,
      pass: yield* OrgCredentialStore.getToken(orgId),
    })
    return connection
  }),
  idleTimeToLive: Duration.minutes(30),
})
```

Estimated peak NATS connections per Tier 2 runner (32GB):
- Runner control: 1
- Shard groups (5): 5
- Active org entities (~500 per runner): 500
- **Total: ~506 per runner**
- At 20 Tier 2 runners: **~10,120 total** — within NATS supercluster capacity [NATS-PROTO].

### 1.5 Node Discovery

Discovery uses `RunnerStorage` polling at 3-second intervals [EFFECT-CLUSTER].
At 50--80 runners this is acceptable. Implementations MUST use PostgreSQL-backed
`SqlRunnerStorage` (not SQLite) for production durability.

---

## 2. Machine-in-Entity Composition

### 2.1 Normative Pattern

Every stateful entity type MUST be implemented as a `@effect/experimental/Machine`
[EFFECT-MACHINE] booted inside a `@effect/cluster/Entity` [EFFECT-ENTITY] scope.
This composition is the normative architecture for organization and asset lifecycle
state management.

The pattern:

1. **Entity registration**: `Entity.make(name, rpcGroup)` — lazy activation on first message
2. **Machine boot**: `Machine.boot(definition, input)` inside `Entity.toLayerMailbox` build effect
3. **Observer fork**: `Machine.changes` piped to EventDistribution via `Effect.forkScoped`
4. **Mailbox handler**: Route incoming RPCs to Machine procedures via `Match.value`

**Codebase proof**: All 9 ISA-95 asset types use this pattern. The canonical
reference is `PlantMachine.ts` (634 lines) at `lib/iiot/machines/PlantMachine.ts`:

- `Machine.make` + `Machine.procedures.make(initialState)` at line 44
- Chained procedures via `.add<TaggedRequest>()()` through line 634
- Graph-validated transitions from `lib/iiot/machines/graphs/plant-graph.ts:84-123`
  using `Graph.directed<PlantStateNode, PlantTransitionAction>()`
- Transition validation via `Graph.hasEdge()` at `plant-graph.ts:146-155`

All 9 machine definitions follow this structure:
`PlantMachine.ts`, `LineMachine.ts`, `WorkCellMachine.ts`, `MachineAssetMachine.ts`,
`DeviceMachine.ts`, `SensorAssetMachine.ts`, `EnterpriseMachine.ts`, `SiteMachine.ts`,
`AreaMachine.ts` — each with a corresponding state graph at `lib/iiot/machines/graphs/`.

### 2.2 Organization State Machine

The proposed Organization entity MUST follow the PlantMachine pattern:

| State | Description | Transitions From | Transitions To |
|---|---|---|---|
| `Onboarding` | Initial setup, provisioning resources | (creation) | `Active`, `Deactivated` |
| `Active` | Normal operation, full access | `Onboarding` | `Suspended`, `Deactivated` |
| `Suspended` | Temporarily disabled (payment, compliance) | `Active` | `Active` (resume), `Deactivated` |
| `Deactivated` | Terminal state, data retention countdown | `Onboarding`, `Active`, `Suspended` | (none) |

The state graph MUST be implemented as `lib/iiot/machines/graphs/org-graph.ts`
following the `plant-graph.ts` pattern, using `Graph.directed()`, `Graph.addNode()`,
`Graph.addEdge()`, and `Graph.hasEdge()` for O(1) transition validation.

### 2.3 Machine.changes as Observation Source

`Machine.changes` emits a `Stream<State>` [EFFECT-MACHINE] starting with the
initial state, then all subsequent transitions. This is the zero-handler-modification
observation mechanism specified in RFC-001.

Key properties:
1. Emits initial state immediately — implementations MUST filter with `Stream.zipWithPrevious`
2. Only fires on actual change — referential inequality check internal to Machine
3. PubSub is unbounded — no backpressure risk within Machine internals
4. Stream completes when Machine scope closes — automatic cleanup on entity reap
5. Safe to fork inside entity — fiber tied to entity scope [EFFECT-ENTITY]

**Codebase proof**: The current ReactivityBridge at `lib/iiot/realtime/reactivity-bridge.ts:91-135`
is the downstream consumer. The _helpers.ts pattern at `lib/iiot/entity/_helpers.ts:28-42`
(`maybeEmitWorkOrder`, `maybeEmitAlarm`, etc.) is the precursor — feature-flag controlled
event emission that this observer pattern supersedes.

### 2.4 State Recovery on Shard Migration

Entity state does NOT survive shard migration [EFFECT-CLUSTER]. Implementations
MUST provide state recovery via one of:

- `Machine.makeSerializable` + `Machine.snapshot/restore` with NATS KV storage
- `ClusterSchema.Persisted` annotation for durable message replay
- External state service (SQL-backed, as in `lib/iiot/state/PlantState.ts:293-393`)

**LOOP OPEN (LO-2)**: The interaction between `Machine.makeSerializable` and
NATS KV for snapshot storage has not been verified in production. The current
codebase uses SQL-backed state services (`makePlantStateSql(repo)` factory at
`lib/iiot/state/PlantState.ts:293-393`). **Recommendation**: Continue SQL-backed
state for MVP. Evaluate Machine.snapshot + NATS KV for Growth milestone.

---

## 3. Schema and Type System

### 3.1 Branded Identifiers

All domain identifiers MUST use `Schema.brand` [EFFECT-SCHEMA] with
`Schema.pattern` validation. This prevents cross-entity ID assignment at both
compile time and runtime.

**Codebase proof**: `lib/iiot/schemas/identifiers.ts` defines 20 branded types:

- **ISA-95 hierarchy** (lines 46--79): `EnterpriseId`, `SiteId`, `AreaId`,
  `PlantId`, `LineId`, `WorkCellId`, `MachineId`, `SensorId`, `DeviceId`
- **Domain** (lines 89--131): `AlarmId`, `WorkOrderId`, `TaskInstanceId`,
  `TaskDefinitionId`, `ApprovalId`, `SyncId`, `WorkflowDefinitionId`, etc.
- **Event sourcing** (lines 141--146): `EventId`, `FactId`
- **Equipment level enum** (lines 28--38): `Schema.Literal('enterprise', 'site',
  'area', 'plant', 'line', 'workcell', 'machine', 'sensor', 'device')`

New identifiers for the 200K-org scale MUST follow this pattern:

```typescript
export const OrgId = Schema.String.pipe(
  Schema.pattern(/^org_[a-zA-Z0-9]{20}$/),
  Schema.brand('OrgId'),
)

export const CapabilityId = Schema.String.pipe(
  Schema.pattern(/^cap_[a-zA-Z0-9]{20}$/),
  Schema.brand('CapabilityId'),
)

export const ReputationScore = Schema.Number.pipe(
  Schema.between(0, 100),
  Schema.brand('ReputationScore'),
)
```

### 3.2 Entity Schema Pattern

All entity types MUST use `Schema.TaggedClass` [EFFECT-SCHEMA] with instance
methods for domain logic. This pattern enables runtime validation, JSON Schema
generation via `JSONSchema.make`, and compile-time type inference.

**Codebase proof**: The canonical Plant entity at `lib/iiot/schemas/assets/plant/schema.ts`:

- Pattern-validated ID: `PlantId` at line 28 with `Schema.pattern(/^PLT-[a-zA-Z0-9-]+$/)`
- Status literal: `PlantStatus` at line 54 — ISA-95 lifecycle states
- TaggedClass: `Plant extends Schema.TaggedClass<Plant>()('Plant', {...})` at line 99
  with instance methods (`getAutomationLevel()`, `isOperational()`, `isContainer()`)
- Create params: `CreatePlantParams = Schema.Struct({...})` at line 163
- Optional fields: `Schema.optionalWith(T, { as: 'Option' })` throughout

New Organization, Capability, and WorkOrder schemas MUST follow this pattern,
placed at `lib/iiot/schemas/assets/organization/schema.ts`, etc.

### 3.3 Cross-Organization Data Transformation

When Organization A shares data with Organization B (marketplace listing,
capability profile), implementations MUST use `Schema.transform` [EFFECT-SCHEMA]
to redact sensitive fields. The transform provides bidirectional encode/decode
with type safety.

```typescript
export const OrganizationToPublicView = Schema.transform(
  Organization,
  OrganizationPublicView,
  {
    decode: (org) => ({ ...org, displayName: org.name, capabilityCount: org.capabilities.length }),
    encode: (pub) => ({ ...pub, name: pub.displayName, tier: 'starter', capabilities: [], metadata: {} }),
  }
)
```

---

## 4. RPC Architecture and Tenant Isolation

### 4.1 Per-Domain RpcGroup Composition

Implementations MUST organize RPCs into one `RpcGroup` per bounded context
[EFFECT-RPCGROUP], composed into a single top-level group for server mounting.

**Codebase proof**: The existing `IIoTRpcs` at `lib/iiot/rpc/index.ts:91-112`
composes 17 `RpcGroup` definitions by spreading `group.requests.values()` into a
single `RpcGroup.make()` call. This pattern extends to include `OrgRpcs`,
`MarketplaceRpcs`, and `TelemetryRpcs`.

New RPC groups for the 200K-org scale:

| Group | Domain | Key RPCs | Stream RPCs |
|---|---|---|---|
| `OrgRpcs` | Organization management | Create, Get, Activate, Suspend, UpdateTier | -- |
| `MarketplaceRpcs` | Cross-org work orders | PostWorkOrder, SearchCapabilities, AcceptMatch | StreamListings |
| `TelemetryRpcs` | Sensor data (extended) | GetLatest, GetAggregated | StreamReadings, StreamAlarms |

### 4.2 Stream RPCs

`stream: true` RPCs return `Stream<A>` from handlers [EFFECT-RPCSERVER]. The
`RpcServer` sends `FromServer.Chunk` messages for each emitted value.

Implementations MUST use the `Stream.unwrap` bridge pattern when handler methods
return `Effect<Stream<A>>`:

```typescript
// Pattern from lib/iiot/realtime/websocket-server.ts:68-92
const HandlerBridge = {
  [SubscribeReadings._tag]: (request) =>
    Stream.unwrap(handlers.subscribeReadings(request)),
}
```

**Codebase proof**: The existing handler implementations at `lib/iiot/realtime/realtime-handlers.ts`
apply per-request filters (deviceId, severity at lines 86--192, glob patterns at
lines 254--285) and optional throttle (`Stream.throttle` at lines 129--135).

### 4.3 Tenant Isolation Middleware

Implementations MUST apply tenant isolation via `RpcMiddleware.Tag` with
`wrap: true` [EFFECT-RPCMIDDLEWARE]. The middleware:

1. Extracts organization ID from JWT in `authorization` header
2. Verifies the token via `AuthService`
3. Provides `TenantContext` to the handler via `Effect.provideService`
4. The `TenantContext` propagates through the Effect graph via fiber-local storage [EFFECT-FIBERREF]

```typescript
class TenantIsolation extends RpcMiddleware.Tag<TenantIsolation>()(
  'TenantIsolation',
  { wrap: true }
) {}
```

All RPC groups MUST have `TenantIsolation` applied:

```typescript
const SecureOrgRpcs = OrgRpcs.middleware(TenantIsolation)
const SecureEquipmentRpcs = EquipmentRpcs.middleware(TenantIsolation)
const SecureMarketplaceRpcs = MarketplaceRpcs.middleware(TenantIsolation)
```

Key design decisions:
- JWT-based extraction — no database lookup per RPC call
- FiberRef-scoped context — propagates automatically through Effect graph
- Group-level application — all RPCs in a group inherit isolation
- Marketplace RPCs SHOULD use a separate authorization middleware requiring
  consent from both participating organizations

### 4.4 Serialization

The WebSocket transport MUST use `RpcSerialization.layerJson` [EFFECT-RPCSERVER]
for browser compatibility.

**Codebase proof**: The existing WebSocket server at `lib/iiot/realtime/websocket-server.ts:131-137`:

```typescript
export const IIoTRealtimeWsServer = pipe(
  RealtimeRpcServerCore,
  Layer.provideMerge(RpcServer.layerProtocolWebsocketRouter({ path: '/ws/iiot' })),
  Layer.provide(RpcSerialization.layerJson),
)
```

Runner-to-runner communication MAY use `RpcSerialization.layerMsgpack` for
binary efficiency where browser compatibility is not required.

---

## 5. Stream Architecture and Backpressure

### 5.1 EventDistribution Channel Topology

The EventDistribution service MUST use ChannelService with broadcast outlets
for local event distribution [EFFECT-PUBSUB, EFFECT-STREAM].

**Codebase proof**: `lib/iiot/realtime/event-distribution.ts` (377 lines) implements
the current 4-channel hub:
- Channel registration at lines 169--199 via `ChannelBuilder.create()`
- PubSub.unbounded inlets at lines 210--213
- PubSub-to-channel wiring at lines 217--243 via `channels.connectStream()`
- Dual-write publish at lines 280--326 (local PubSub + HolonetBridge)
- Remote ingress daemons at lines 249--263 (NATS -> local PubSub)

For the 200K-org scale, implementations MUST expand to 7 channels:

| Channel | MaxLag | Peak Throughput | Content |
|---|---|---|---|
| `iiot:readings` | 10,000 | ~1.5M events/sec | Sensor telemetry (L0) |
| `iiot:alarms` | 1,000 | ~50K events/sec | ISA-18.2 alarm lifecycle |
| `iiot:equipment` | 1,000 | ~100K events/sec | Equipment state changes (L1--L2) |
| `iiot:entity-changes` | 5,000 | ~200K events/sec | ISA-95 entity state transitions |
| `iiot:marketplace` | 1,000 | ~10K events/sec | WorkOrder matching, listings |
| `iiot:org-lifecycle` | 500 | ~1K events/sec | Organization onboarding/suspension |
| `iiot:invalidations` | 1,000 | ~100K events/sec | Cache invalidation signals |

**Total peak: ~2M events/sec** across all channels.

### 5.2 Backpressure Strategy

Each channel MUST use an appropriate PubSub strategy [EFFECT-PUBSUB] based on
event criticality and idempotency:

| Channel | Strategy | Rationale |
|---|---|---|
| `iiot:readings` | `PubSub.sliding(10000)` | Telemetry is latest-value-wins. Dropping old readings is acceptable. |
| `iiot:alarms` | `PubSub.bounded(1000)` | Alarms MUST NOT be lost. Backpressure to producer is correct [ISA-18.2]. |
| `iiot:equipment` | `PubSub.bounded(1000)` | Equipment state changes are critical for OEE calculation. |
| `iiot:entity-changes` | `PubSub.dropping(5000)` | Entity changes can be replayed from EventLog. Drop under pressure. |
| `iiot:marketplace` | `PubSub.bounded(1000)` | Marketplace events are business-critical. |
| `iiot:org-lifecycle` | `PubSub.bounded(500)` | Low volume, high importance. |
| `iiot:invalidations` | `PubSub.sliding(1000)` | Cache invalidations are idempotent. Latest wins. |

### 5.3 Per-Organization Stream Isolation

For multi-tenant stream isolation, implementations SHOULD use `Stream.groupByKey`
[EFFECT-STREAM] to partition events by organization:

```typescript
const perOrgStreams = unifiedEntityStream.pipe(
  Stream.groupByKey(
    (event) => event.orgId,
    { bufferSize: 256 }
  ),
  GroupBy.evaluate((orgId, orgStream) =>
    orgStream.pipe(
      Stream.throttle({ units: 100, duration: Duration.seconds(1), strategy: 'shape' }),
      Stream.tap((event) => publishToOrgNats(orgId, event)),
    )
  ),
)
```

**Scaling concern**: With 200K orgs, `Stream.groupByKey` creates up to 200K
internal queues. At `bufferSize: 256` and ~100 bytes per event, peak memory is
~5GB. However, only 10--20% of orgs are active at any time (20--40K orgs),
reducing actual memory to ~1GB. Distributed across 20+ runners: ~50MB per runner.

**LOOP OPEN (LO-3)**: `Stream.groupByKey` at 200K orgs has not been load-tested.
Active-org-only filtering mitigates the theoretical worst case. **Recommendation**:
Implement active-org filtering at the groupBy input, benchmarked during Growth
milestone.

### 5.4 HolonetBridge for Cross-Node Fan-Out

**Codebase proof**: The HolonetBridge at `lib/iiot/realtime/holonet-bridge.ts`
(212 lines) bridges local EventDistribution to NATS:

- **Outbound** (lines 102--128): Fire-and-forget with `Effect.ignoreLogged` — errors
  logged but never block the caller
- **Inbound** (lines 136--182): Wildcard subscriptions yielding typed streams

NATS subjects at `lib/iiot/realtime/iiot-subjects.ts:39-112` use `createSubjectSpec()`
with parameterized patterns: `iiot.readings.{deviceId}`, `iiot.alarms.{deviceId}`,
`iiot.equipment.{equipmentId}`, `iiot.invalidations.{cacheKey}`.

For the 200K-org scale, additional subjects MUST be added:
- `iiot.org-lifecycle.{orgId}` — organization state transitions
- `iiot.marketplace.{region}` — marketplace events by region

---

## 6. Layer Composition Architecture

### 6.1 Five-Tier Service Graph

Implementations MUST organize services into 5 tiers with explicit dependency chains:

```
Tier 5: Cluster Layer        ← Entity registration, runner setup, sharding
    │  depends on
Tier 4: RPC & Transport      ← Handler layers, serialization, WebSocket
    │  depends on
Tier 3: Event & Stream       ← EventDistribution, ChannelService, HolonetBridge
    │  depends on
Tier 2: Domain Services      ← Org, Equipment, Sensor, Alarm, WorkOrder, Marketplace
    │  depends on
Tier 1: Infrastructure       ← NATS, PostgreSQL, TimescaleDB, Redis, Auth
```

Same-tier services MUST be composed with `Layer.mergeAll` [EFFECT-LAYER] for
concurrent initialization. Cross-tier dependencies MUST use `Layer.provide` for
sequential initialization.

**Codebase proof**: This pattern already exists at multiple levels:

- **Entity tier** (`lib/iiot/entity/EntityStack.ts:54-67`): `Layer.mergeAll` of 12
  handler layers
- **Testing tier** (`lib/iiot/entity/EntityStack.ts:90-93`): `EntityHandlersLayer.pipe(
  Layer.provideMerge(AllStateServicesInMemory), Layer.provideMerge(IIoTFeatureFlagsDisabledLayer))`
- **Pipeline tier** (`lib/iiot/adapters/ingestion-service.ts:297-322`):
  `SparkplugPipelineLayer` composing TopicRouter, AlarmDetector, ReadingProcessor,
  SparkplugAdapter, IngestionService
- **Realtime tier** (`lib/iiot/realtime/websocket-server.ts:112-137`):
  `RealtimeRpcServerCore` -> `RpcServer.layerProtocolWebsocketRouter` -> `RpcSerialization.layerJson`

### 6.2 Tier Specification

```typescript
// --- Tier 1: Infrastructure (no dependencies) ---
const InfraLayer = Layer.mergeAll(
  NatsClientLive,
  PostgresPoolLive,
  TimescaleDBLive,
  RedisClientLive,
  AuthServiceLive,
)

// --- Tier 2: Domain Services (depend on infra) ---
const DomainLayer = Layer.mergeAll(
  OrgServiceLive,
  EquipmentServiceLive,
  SensorServiceLive,
  AlarmServiceLive,
  WorkOrderServiceLive,
  MarketplaceServiceLive,
  ReputationServiceLive,
).pipe(Layer.provide(InfraLayer))

// --- Tier 3: Event & Stream Services (depend on infra + domain) ---
const StreamLayer = Layer.mergeAll(
  EventDistributionLive,
  ChannelServiceLive,
  HolonetBridgeLive,
  ReactivityBridgeLive,
).pipe(Layer.provide(Layer.merge(InfraLayer, DomainLayer)))

// --- Tier 4: RPC & Transport (depend on all lower tiers) ---
const RpcLayer = Layer.mergeAll(
  OrgRpcHandlersLive,
  EquipmentRpcHandlersLive,
  MarketplaceRpcHandlersLive,
  TelemetryRpcHandlersLive,
  TenantIsolationLive,
  RpcSerialization.layerJson,
  WebSocketServerLive,
).pipe(Layer.provide(Layer.mergeAll(InfraLayer, DomainLayer, StreamLayer)))

// --- Tier 5: Cluster (entity registration, runner setup) ---
const ClusterLayer = Layer.mergeAll(
  OrgEntityLayer,
  EquipmentEntityLayer,
  SensorEntityLayer,
  AlarmEntityLayer,
  WorkOrderEntityLayer,
  Sharding.layer,
  SocketRunner.layer({ port: 9000 }),
  SqlRunnerStorage.layer,
  SqlMessageStorage.layer,
).pipe(Layer.provide(Layer.mergeAll(InfraLayer, DomainLayer, StreamLayer, RpcLayer)))

export const ApplicationLayer = ClusterLayer
```

### 6.3 Memoization and Isolation

| Resource | Strategy | Rationale |
|---|---|---|
| NATS connection pool | `Layer.memoize` | Shared across all tenants; multiplexed via NATS accounts |
| PostgreSQL pool | `Layer.memoize` | Shared pool; tenant isolation via row-level security |
| Redis cache | `Layer.memoize` | Shared with key-prefix tenant isolation |
| Per-org crypto keys | `Layer.fresh` | MUST be per-tenant; key material isolation [IEC-62443] |
| Audit logger | `Layer.fresh` | Per-tenant audit trail; separate streams [FDA-CFR11] |
| Rate limiter | `Layer.fresh` | Per-tenant rate limits; noisy-neighbor prevention |

### 6.4 State Service Pattern

Each entity type MUST have a state service following the `PlantState` pattern
at `lib/iiot/state/PlantState.ts`:

- **Interface** (lines 65--86): `create`, `get`, `set`, `list`, `delete`, `exists`, `count`
- **Context.Tag** (lines 103--106): `PlantState extends Context.Tag('iiot/PlantState')`
- **In-memory** (lines 120--281): `Ref.make(new Map())` for testing
- **SQL-backed** (lines 293--393): `makePlantStateSql(repo)` factory for production

This dual-implementation pattern enables testing with `Layer.mergeAll(AllStateServicesInMemory)`
while deploying with SQL-backed layers in production.

### 6.5 Runtime Bootstrap Sequence

At 50--80 runners, the bootstrap sequence MUST be staggered to avoid thundering
herd on shard rebalancing:

```
T=0s    Runner starts, builds ApplicationLayer
T=0.5s  Layer.memoize acquires shared resources (NATS, Postgres, Redis)
T=1s    Sharding.layer registers runner in RunnerStorage
T=1.5s  HashRing recomputation assigns shards to this runner
T=2s    Entity.toLayer registers entity types (lazy instances)
T=3s    First RunnerStorage poll by other runners discovers new node
T=6s    Shard rebalancing begins (some shards migrate from existing runners)
T=15s   Shard migration complete (entityTerminationTimeout on old runners)
T=16s   Runner fully operational, serving entity RPCs
```

---

## 7. Testing Architecture

### 7.1 Cluster Testing

Tests MUST use `TestRunner.layer` [EFFECT-CLUSTER] for in-memory cluster testing.
This provides `MessageStorage`, `RunnerStorage`, `RunnerHealth`, and `Runners`
without network or persistence overhead.

```typescript
const TestClusterLayer = Layer.mergeAll(
  OrgEntityLayer,
  EquipmentEntityLayer,
  TestRunner.layer,
  Sharding.layer,
  ShardingConfig.layer({ shardsPerGroup: 10 }),
)
```

### 7.2 Handler Testing

Tests MUST use `Entity.makeTestClient` [EFFECT-ENTITY] for isolated handler
testing without full cluster infrastructure.

**Codebase proof**: The `EntityTestingStack` at `lib/iiot/entity/EntityStack.ts:90-93`
provides the test composition: `EntityHandlersLayer.pipe(Layer.provideMerge(AllStateServicesInMemory),
Layer.provideMerge(IIoTFeatureFlagsDisabledLayer))`.

### 7.3 PubSub Stream Testing

Tests involving `PubSub + Stream.fromPubSub + Effect.fork` MUST use plain vitest
`it()` + `Effect.runPromise`, NOT `it.effect()` or `it.scoped()` from `@effect/vitest`.

**Codebase proof**: The EventDistribution tests at `lib/iiot/realtime/__tests__/event-distribution.test.ts`
document this constraint. Fiber scheduling in the `it.effect()` wrapper conflicts
with forked PubSub subscribers, causing timeouts [EFFECT-VITEST].

### 7.4 Property-Based Testing

Schema-backed types MUST have roundtrip property tests using `it.prop` with
`Arbitrary.make(schema)` [EFFECT-VITEST, EFFECT-SCHEMA]. At minimum:

- Encode/decode roundtrip identity for all entity schemas
- Branded ID format compliance
- State transition monotonicity (no backwards transitions)

### 7.5 Load Testing

Shard distribution tests MUST verify that entities spread evenly across shards.
No shard SHOULD have more than 2x the average entity count across a sample of
10,000 entity IDs. This validates the HashRing distribution [EFFECT-HASHRING].

---

## 8. Open Questions and Recommendations

### 8.1 Resolved

| ID | Question | Resolution |
|---|---|---|
| LO-1 | Per-group `shardsPerGroup` | Accept 300 default for MVP/Growth. Deploy independent clusters per shard group at Metro scale. |
| LO-2 | Machine.snapshot + NATS KV | Continue SQL-backed state for MVP. Evaluate Machine.snapshot at Growth milestone. |
| LO-3 | Stream.groupByKey at 200K orgs | Implement active-org filtering at groupBy input. Benchmark at Growth milestone. |

### 8.2 Remaining Open

| ID | Question | Status | Impact | Recommendation |
|---|---|---|---|---|
| LO-4 | NATS as custom `RpcClientProtocol` transport | OPEN | MEDIUM | The `RpcClientProtocol` extension point at `Runners.ts:620-623` allows custom transports. A NATS transport would avoid HTTP/Socket for runner-to-runner. **Recommendation**: Defer — SocketRunner is sufficient through Metro scale. |
| LO-5 | `@effect/experimental/LayerMap` for dynamic per-tenant service resolution | OPEN | MEDIUM | LayerMap is experimental and may change. **Recommendation**: Use `FiberRef`-based tenant context (Section 4.3) for tenant isolation. Evaluate LayerMap when it stabilizes. |

### 8.3 Scaling Milestones

| Milestone | Orgs | Entities | Runners | Shards | Key Architecture Change |
|---|---|---|---|---|---|
| **MVP** | 100 | ~100K | 3 (SingleRunner) | 300/group | Monolithic, local PubSub |
| **Growth** | 5K | ~5M | 10 (SocketRunner) | 300/group | Cluster + NATS accounts |
| **Scale** | 50K | ~50M | 30 (SocketRunner) | 1,000/group | Shard groups, per-tier runners |
| **Metro** | 200K | ~200M | 50--80 (mixed) | 3,000/group (telemetry) | Full metropolitan, edge nodes |

### 8.4 Risk Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| 14.2M entity shard hotspots | HIGH | Shard groups separate telemetry from orgs; HashRing distributes within groups [EFFECT-HASHRING] |
| Shard rebalancing thundering herd | MEDIUM | Staggered runner startup; `entityTerminationTimeout` prevents cascade [EFFECT-CLUSTER] |
| NATS connection exhaustion | LOW | EntityResource with 30min idle TTL; per-org not per-entity connections |
| Stream memory pressure | MEDIUM | Active-org-only groupBy; sliding PubSub for telemetry; bounded for critical [EFFECT-PUBSUB] |
| Cross-org data leakage | HIGH | TenantIsolation middleware; FiberRef-scoped context; NATS account isolation [IEC-62443] |
| Entity state loss on migration | MEDIUM | SQL-backed state services; Persisted annotation for critical messages [EFFECT-CLUSTER] |

---

## Appendix: Codebase File Reference Map

| File | Key Lines | Pattern | Section |
|---|---|---|---|
| `lib/iiot/entity/EntityStack.ts` | 54--67 | `Layer.mergeAll` of 12 handler layers | 1.1, 6.1 |
| `lib/iiot/entity/EntityStack.ts` | 90--93 | `EntityTestingStack` composition | 6.1, 7.2 |
| `lib/iiot/entity/_helpers.ts` | 28--42 | `maybeEmitWorkOrder` feature-flag emission | 2.3 |
| `lib/iiot/entity/_helpers.ts` | 140--166 | `emitIfEnabled` domain-switched emission | 2.3 |
| `lib/iiot/schemas/identifiers.ts` | 28--38 | `EquipmentLevel = Schema.Literal(...)` | 3.1 |
| `lib/iiot/schemas/identifiers.ts` | 46--131 | 21 branded identifier types | 3.1 |
| `lib/iiot/schemas/assets/plant/schema.ts` | 28--35 | `PlantId` pattern + brand | 3.1, 3.2 |
| `lib/iiot/schemas/assets/plant/schema.ts` | 99--150 | `Plant extends Schema.TaggedClass` | 3.2 |
| `lib/iiot/machines/PlantMachine.ts` | 44--634 | `Machine.make` + chained procedures | 2.1 |
| `lib/iiot/machines/graphs/plant-graph.ts` | 84--123 | `Graph.directed` with 6 states, 9 edges | 2.1, 2.2 |
| `lib/iiot/machines/graphs/plant-graph.ts` | 146--155 | `Graph.hasEdge()` transition validation | 2.1 |
| `lib/iiot/rpc/index.ts` | 91--112 | `IIoTRpcs` composing 17 RPC groups | 4.1 |
| `lib/iiot/rpc/RealtimeRpcs.ts` | full | 4 streaming RPCs (`stream: true`) | 4.2 |
| `lib/iiot/realtime/event-distribution.ts` | 169--199 | 4 channel registrations | 5.1 |
| `lib/iiot/realtime/event-distribution.ts` | 210--243 | PubSub inlets + connectStream | 5.1 |
| `lib/iiot/realtime/event-distribution.ts` | 249--263 | Remote ingress daemons | 5.1, 5.4 |
| `lib/iiot/realtime/event-distribution.ts` | 280--326 | Dual-write publish | 5.1 |
| `lib/iiot/realtime/holonet-bridge.ts` | 102--128 | Fire-and-forget NATS publish | 5.4 |
| `lib/iiot/realtime/holonet-bridge.ts` | 136--182 | Wildcard NATS subscriptions | 5.4 |
| `lib/iiot/realtime/iiot-subjects.ts` | 39--112 | 4 NATS subject specs | 5.4 |
| `lib/iiot/realtime/realtime-handlers.ts` | 86--192 | Filter/throttle handlers | 4.2 |
| `lib/iiot/realtime/reactivity-bridge.ts` | 91--135 | Handler-to-EventDistribution adapter | 2.3, 6.1 |
| `lib/iiot/realtime/websocket-server.ts` | 68--92 | `Stream.unwrap` bridge | 4.2 |
| `lib/iiot/realtime/websocket-server.ts` | 131--137 | WebSocket server layer | 4.4 |
| `lib/iiot/state/PlantState.ts` | 65--86 | State service shape interface | 6.4 |
| `lib/iiot/state/PlantState.ts` | 103--106 | `Context.Tag` service definition | 6.4 |
| `lib/iiot/state/PlantState.ts` | 120--281 | In-memory implementation | 6.4, 7.2 |
| `lib/iiot/state/PlantState.ts` | 293--393 | SQL-backed implementation | 2.4, 6.4 |
| `lib/iiot/adapters/ingestion-service.ts` | 297--322 | `SparkplugPipelineLayer` | 6.1 |
| `lib/streams/constructs/ChannelService.ts` | full | BFO-ontology event bus | 5.1 |

---

## Normative References

- [RFC2119], [RFC8174] — Requirement level key words
- [ISA-95-1] — Equipment hierarchy model
- [ISA-18.2] — Alarm management (backpressure requirements)
- [IEC-62443] — Network and system security (tenant isolation)
- [FDA-CFR11] — Electronic records (audit trail requirements)
- [NATS-PROTO] — NATS protocol (connection capacity)

## Informative References

- [EFFECT-TS] — Effect-TS core library
- [EFFECT-CLUSTER] — Distributed entity management
- [EFFECT-ENTITY] — Cluster entity lifecycle
- [EFFECT-MACHINE] — State machine with actor semantics
- [EFFECT-SCHEMA] — Runtime validation
- [EFFECT-STREAM] — Pull-based reactive streams
- [EFFECT-PUBSUB] — Broadcast primitives
- [EFFECT-LAYER] — Dependency injection
- [EFFECT-RPCGROUP] — RPC composition
- [EFFECT-RPCMIDDLEWARE] — RPC cross-cutting concerns
- [EFFECT-RPCSERVER] — RPC server transport
- [EFFECT-FIBERREF] — Fiber-local storage
- [EFFECT-HASHRING] — Consistent hashing
- [EFFECT-VITEST] — Testing utilities
- [EFFECT-LAYERMAP] — Dynamic per-key layer resolution

---

*Section drafted 2026-02-09 by Val (effect-specialist). Based on research-effect-architecture.md (1589 lines) and 20+ codebase source files.*
