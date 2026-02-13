# RFC Section: Multi-Tenant Manufacturing Network Architecture

```
Section:       Multi-Tenant Network Architecture
RFC:           001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        temporal-analyst (Val)
Created:       2026-02-09
Research Base: docs/specifications/research-consistency-models.md (Sections 4, 5, 8)
               docs/specifications/research-effect-architecture.md (Sections 1.3, 1.4)
               docs/specifications/research-cluster-patterns.md (Section 5)
```

---

## Y. Multi-Tenant Manufacturing Network Architecture

### Y.1 Scope

This section specifies the multi-tenant architecture that enables 200,000+
organizations — from solo machinists to large aerospace manufacturers — to
operate on a shared metropolitan manufacturing network with sovereign data
boundaries and federated event distribution.

This section covers the **operational architecture** (tenant isolation, edge
autonomy, reconciliation, shard assignment). For consistency guarantees, see
Section X (Two-Domain Consistency Model). For security and trust, see Section Z.

### Y.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### Y.3 Tenant Model

#### Y.3.1 One Organization = One NATS Account

Each organization in the manufacturing network maps to exactly one NATS Account
[NATS-ACCOUNTS]. The account is the **trust boundary, namespace boundary, and
resource limit boundary** for all of that organization's data.

Requirements:

1. **Subject isolation**: An organization's NATS subjects (e.g.,
   `iiot.entity.>`, `alarms.>`) MUST NOT be accessible from any other
   organization's account unless explicitly exported.

2. **JetStream domain isolation**: Each organization's edge device MUST operate
   its own JetStream domain, providing offline persistence independent of the
   cloud cluster. The domain name MUST be unique per organization.

3. **Resource limits**: Each account MUST have configurable limits for:
   - Maximum number of JetStream streams
   - Maximum total storage (bytes)
   - Maximum number of connections
   - Maximum message size

4. **Account provisioning**: Accounts are provisioned via signed JWTs from the
   platform operator's signing key [NATS-DECENTRALIZED]. The JWT encodes:
   - Organization ID
   - Account public key (NKey)
   - Resource limits
   - Authorized subject imports/exports
   - Expiration date (MUST be set; indefinite accounts are prohibited)

#### Y.3.2 Edge Device Architecture

Each organization connects to the network through one or more edge devices. The
minimum viable edge configuration:

```
┌─────────────────────────────────────┐
│  Edge Device ($50 SBC or existing)  │
│                                     │
│  ┌────────────┐  ┌───────────────┐  │
│  │ NATS Server│  │ TMNL Agent    │  │
│  │ + JetStream│  │ (sensor poll, │  │
│  │ (local     │  │  alarm detect,│  │
│  │  domain)   │  │  state mgmt)  │  │
│  └──────┬─────┘  └───────┬───────┘  │
│         │                │          │
│         └───── NATS ─────┘          │
│                │                    │
└────────────────┼────────────────────┘
                 │ Leaf Node connection
                 │ (TLS, JWT auth)
                 ▼
         Cloud NATS Cluster
```

Requirements:

1. **Self-contained operation**: The edge device MUST provide full L0-L2
   functionality (sensor polling, alarm detection, equipment state tracking)
   without cloud connectivity.

2. **Leaf node connection**: The edge device connects to the cloud NATS cluster
   as a leaf node [NATS-LEAFNODE]. The leaf node connection:
   - MUST use TLS for all communications
   - MUST authenticate via the organization's account JWT
   - MUST be bound to the organization's account (no cross-account access)
   - SHOULD reconnect automatically with exponential backoff

3. **Local persistence**: JetStream on the edge device MUST persist all events
   locally with tiered minimum retention: T1 devices: 1-day minimum. T2
   devices: 7-day minimum. T3 devices: 30-day minimum. This ensures that
   events generated during extended offline periods are not lost, with
   retention scaled to device storage capacity.

4. **Minimal configuration**: Edge device setup MUST require no more than:
   - Power + network cable
   - QR code scan (encodes JWT, cloud NATS URL, organization ID)
   - Sensor auto-discovery via protocol probing (Modbus, OPC-UA, MQTT)

### Y.4 Edge Autonomy Guarantee

When the edge device loses connectivity to the cloud NATS cluster, the
organization's operations MUST continue without degradation at ISA-95 levels
L0 through L2.

#### Y.4.1 Autonomous Operations During Partition

| Capability | Offline Behavior | Requirement Level |
|-----------|-----------------|-------------------|
| Sensor data collection (L0) | Continues normally; data persists to local JetStream | MUST |
| Alarm detection and notification (L1-L2) | Local alarm rules continue to fire; alerts display on local HMI | MUST |
| Equipment state tracking (L1) | State machine transitions continue; states persisted locally | MUST |
| Work order management (L3) | Read existing work orders; create new ones in local queue | SHOULD |
| Cross-org marketplace (Domain 2) | Unavailable; last-known capacity displayed with staleness indicator | MAY |
| Network aggregates | Frozen at last-known values; staleness indicator shown | MAY |

#### Y.4.2 Partition Detection

The edge device MUST detect cloud connectivity loss within 30 seconds using
NATS leaf node health monitoring. Upon detection:

1. Set local `partitioned = true` flag
2. Continue all local operations
3. Buffer outbound events to local JetStream (already happening by design)
4. Display partition indicator on local HMI (if applicable)
5. Begin exponential backoff reconnection attempts (initial: 1s, max: 60s)

#### Y.4.3 Partition Duration Limits

The system MUST support the following partition durations without data loss:

| Partition Duration | Behavior |
|-------------------|----------|
| < 5 minutes | Transparent reconnection; buffered events delivered within G-8 staleness window |
| 5 minutes - 24 hours | Reconnection triggers bulk event replay; staleness alerts emitted for cross-org subscribers |
| 24 hours - 7 days | Reconnection triggers full replay of local JetStream retention window; sequence gaps logged |
| > 7 days | Events beyond retention window are lost; system emits `DataLossWarning`; org MUST be re-synchronized |

### Y.5 Reconciliation After Partition Healing

When the edge device reconnects to the cloud NATS cluster after a partition:

#### Y.5.1 Protocol

1. **Leaf node reconnection**: NATS leaf node re-establishes TLS connection to
   the cloud cluster. Account JWT is re-validated.

2. **JetStream domain synchronization**: The edge device's JetStream domain
   mirrors its streams to the corresponding cloud-side streams. Mirroring is
   sequential per stream — events are delivered in the order they were produced
   locally, preserving G-1 (per-entity sequential ordering).

3. **Deduplication**: Two layers prevent duplicate processing:
   - **Transport-level**: NATS JetStream `Nats-Msg-Id` deduplication with a
     configurable window [NATS-DEDUP-INF]. For reconnecting edge devices, the
     message ID MUST be content-addressed: `hash(orgId, entityType, entityId,
     sequenceNumber)` to handle dedup windows shorter than the partition
     duration.
   - **Application-level**: @effect/cluster `requestId` deduplication in
     MessageStorage [EFFECT-CLUSTER]. If a message was already processed before
     the partition, the cached reply is returned without re-execution.

4. **Burst absorption**: The cloud cluster MUST absorb the burst of late events
   without dropping messages or exceeding backpressure limits. The edge device
   SHOULD rate-limit its outbound replay to avoid overwhelming the cloud
   (RECOMMENDED: 1000 events/second maximum during replay).

5. **Cross-org staleness resolution**: After all buffered events are delivered,
   the organization's CRDT entries (capacity, capabilities) are refreshed. Any
   `OrgStale` advisories for this organization are cleared.

6. **Convergence**: Within 60 seconds of partition healing (per G-8), all
   cross-org subscribers MUST have received the organization's buffered events.

#### Y.5.2 Reconciliation Sequence Diagram

```
Edge Device                    Cloud NATS Cluster             Cross-Org Subscribers
    │                               │                               │
    │  [OFFLINE for T hours]        │                               │
    │  [Buffered N events locally]  │  [Emitted OrgStale(orgId)]   │
    │                               │                    ───────────►
    │                               │                               │
    ├──── Leaf node reconnect ─────►│                               │
    │     (TLS + JWT auth)          │                               │
    │                               │                               │
    ├──── Mirror sync: stream 1 ───►│                               │
    │     (events 1..K, ordered)    │                               │
    │                               ├── Dedup + persist ──────────►│
    │                               │   (content-addressed IDs)     │
    ├──── Mirror sync: stream 2 ───►│                               │
    │     (events 1..M, ordered)    │                               │
    │                               ├── Dedup + persist ──────────►│
    │                               │                               │
    ├──── CRDT refresh ────────────►│                               │
    │     (capacity, capabilities)  │                               │
    │                               ├── Clear OrgStale(orgId) ────►│
    │                               │                               │
    │  [ONLINE — normal operation]  │  [Convergence within 60s]    │
```

### Y.6 Shard Assignment for Heterogeneous Organizations

The cloud cluster manages organization entities via @effect/cluster
[EFFECT-CLUSTER] with consistent hashing [EFFECT-HASHRING]. The key challenge:
organization sizes span 5 orders of magnitude (2 machines to 200,000+ machines).

#### Y.6.1 HashRing Operates at Runner Level

**Critical distinction**: The HashRing distributes **shards** across **runners**
(cloud nodes), NOT organizations across runners. An organization's entities are
distributed across shards based on `entityId` hash. A large organization's
entities naturally spread across many shards and therefore many runners.

```
Organization "AeroDynamics" (10,000 entities)
  → Entities hash to ~300 different shards
  → Shards assigned to ~15 different runners
  → Load is naturally distributed

Organization "Earl's Machine Shop" (4 entities)
  → Entities hash to 2-4 shards
  → Shards may all land on 1-2 runners
  → Minimal resource footprint
```

#### Y.6.2 Runner Tiers

Runners are organized into tiers with different weights in the HashRing:

| Tier | Hardware | Weight | Shard Count | Use Case |
|------|----------|--------|-------------|----------|
| Tier 1 | 64GB, 16 cores | 3 | ~900 shards | Co-located with NATS superclusters |
| Tier 2 | 32GB, 8 cores | 1 | ~300 shards | Regional deployments |
| Tier 3 | 16GB, 4 cores | 0.5 | ~150 shards | On-premise at large sites |

Weight formula:
```
runner_weight = (available_memory_GB / 32) * (cpu_cores / 8) * locality_bonus
```
Where `locality_bonus = 1.5` for runners co-located with NATS superclusters.

#### Y.6.3 Shard Group Separation

Different entity types SHOULD be assigned to different shard groups to isolate
resource contention:

| Shard Group | Entity Types | Rationale |
|-------------|-------------|-----------|
| `org-identity` | Organization | Low churn, heavy state, cross-org eventual consistency |
| `marketplace` | Listing, Template, SharedAsset | Cross-org, eventual consistency |
| `asset-hierarchy` | Enterprise, Site, Area, Plant, Line, WorkCell, Machine | Low-throughput, consistency-critical |
| `equipment` | Machine, Device, Sensor | High-throughput, latency-sensitive |
| `operational` | Alarm, WorkOrder, EquipmentState | Medium-throughput, ordering-critical |

Each shard group has its own `shardsPerGroup` configuration (default: 300
[EFFECT-CLUSTER]). The `telemetry` group MAY use more shards for finer-grained
distribution.

#### Y.6.4 Hot Shard Mitigation

If a single organization generates disproportionate load (e.g., a factory with
1000 sensors publishing at 10 Hz = 10,000 events/second):

1. **Detection**: Monitor per-shard event throughput. Alert if any shard exceeds
   2x the mean throughput for its shard group.
2. **Mitigation**: Increase the weight of the runner hosting the hot shard, or
   add runners to the tier, triggering HashRing rebalancing.
3. **Shard splitting**: NOT natively supported by @effect/cluster. If needed,
   increase `shardsPerGroup` for the affected shard group and rebalance.

### Y.7 Organization Lifecycle

#### Y.7.1 Onboarding

Onboarding a new organization to the network MUST complete in under 15 minutes:

1. **Account creation** (< 1 minute): Platform operator generates signed JWT
   with organization ID, NKey, and default resource limits.
2. **Edge device provisioning** (< 5 minutes): QR code scan loads JWT and
   cloud NATS URL. Edge device connects as leaf node.
3. **Sensor discovery** (< 5 minutes): TMNL agent probes connected devices via
   Modbus RTU/TCP, OPC-UA, or MQTT. Discovered sensors are auto-registered as
   entities in the organization's namespace.
4. **Marketplace opt-in** (< 1 minute): Organization configures which subjects
   to export to the manufacturing commons (default: `capacity.available`).

#### Y.7.2 Offboarding

When an organization leaves the network:

1. **Export revocation**: All cross-account exports are revoked. Per G-9 (Data
   Sovereignty), revocation MUST take effect within 60 seconds.
2. **CRDT cleanup**: The organization's entries in network KV buckets are deleted.
   OR-Set remove operations propagate to all replicas.
3. **Account deactivation**: JWT is revoked via NATS revocation list. Edge
   device connections are terminated.
4. **Data retention**: The organization's cloud-side JetStream streams are
   retained for the regulatory retention period (configurable, default: 7
   years per [FDA-CFR11]) before deletion.

#### Y.7.3 Organization Growth

As an organization grows, the system automatically adapts:

| Growth Event | System Response |
|-------------|----------------|
| Added 10th machine | Alarm management (L2) features activate |
| Added 50th machine | Work order management (L3) features activate |
| Added 2nd site | Cross-site analytics (L4) activate |
| Entity count > 1000 | Account resource limits auto-increased (operator approval required) |
| Event throughput > 10K/s | Dedicated shard group assignment (operator intervention) |

### Y.8 Cross-Organization Communication

#### Y.8.1 Manufacturing Commons System Account

A dedicated NATS system account (`manufacturing-commons`) aggregates cross-org
data. Organizations interact with it through explicit subject imports and
exports:

**Exported subjects** (org -> commons):
- `capacity.{orgId}.available` — machine availability count
- `capability.{orgId}.declared` — manufacturing capabilities
- `status.{orgId}.heartbeat` — organization online status

**Imported subjects** (commons -> org):
- `network.capacity.summary` — aggregate network capacity
- `network.marketplace.orders.>` — open work orders (filtered by capability match)

#### Y.8.2 Subject Routing Rules

1. **Intra-org subjects** (`iiot.{orgId}.>`) MUST NOT leave the organization's
   account. These are sovereign data.
2. **Cross-org subjects** (`capacity.>`, `capability.>`, `status.>`) flow
   through the manufacturing commons system account.
3. **Marketplace subjects** (`marketplace.orders.>`, `marketplace.bids.>`)
   flow through the requesting organization's account, with targeted exports
   to bidding organizations.

### Y.9 Monitoring and Observability

#### Y.9.1 Per-Organization Health

The platform MUST monitor the following per-organization metrics:

| Metric | Alert Threshold | Rationale |
|--------|----------------|-----------|
| Edge device connectivity | Offline > 2 minutes | Triggers `OrgStale` advisory |
| Event throughput | < 1 event/minute (if sensors configured) | Sensor failure detection |
| JetStream storage usage | > 80% of account limit | Prevents data loss |
| Clock skew (origin vs network) | > 5 seconds | Triggers `ClockSkewDetected` |
| Consumer lag | > 1000 messages behind | Processing bottleneck |

#### Y.9.2 Network-Level Health

| Metric | Computation | Alert Threshold |
|--------|------------|----------------|
| Active organizations | Count of accounts with heartbeat < 120s | Drop > 5% in 5 minutes |
| G-8 staleness compliance | Sample 1% of cross-org events per minute | > 1% exceeding 60s |
| Marketplace throughput | Orders posted per hour | Drop > 50% vs 7-day average |
| CRDT convergence time | Time from org KV update to aggregate recalculation | > 30 seconds (50th percentile) |

### Y.10 Codebase Implementation Reference

This section maps the multi-tenant architecture to the existing TMNL
implementation, identifying current artifacts and extension points.

#### Y.10.1 Tenant Isolation — NATS Infrastructure

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| NATS subject specifications | `src/lib/iiot/realtime/iiot-subjects.ts` | 4 subject specs with parametric placeholders: `iiot.readings.{deviceId}`, `iiot.alarms.{deviceId}`, `iiot.equipment.{equipmentId}`, `iiot.invalidations.{cacheKey}` |
| NATS PubSub service | `src/lib/holonet/nats/pubsub.ts` | `NatsPubSubService` — NATS pub/sub abstraction layer |
| HolonetBridge | `src/lib/iiot/realtime/holonet-bridge.ts` | 4 outbound publish methods (fire-and-forget to NATS), 4 inbound scoped Streams |
| Subject spec factory | `src/lib/holonet/subject/schemas.ts` | `createSubjectSpec()` — defines subject patterns with parameter types |

**Extension point**: Current subjects are flat (`iiot.readings.{deviceId}`).
Multi-tenant operation requires org-scoped subjects
(`iiot.{orgId}.readings.{deviceId}`). The `createSubjectSpec` function supports
this pattern — add `orgId` as a leading parameter.

#### Y.10.2 Edge Device — Local Processing Stack

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| Sensor reading ingestion | `src/lib/iiot/adapters/ingestion-service.ts:297-322` | `SparkplugPipelineLayer` — full pipeline from Sparkplug-B protocol to entity state |
| Alarm detection | Included in SparkplugPipelineLayer | `AlarmDetector` service triggered by threshold breaches |
| Topic routing | Included in SparkplugPipelineLayer | `TopicRouter` — routes Sparkplug topics to entity handlers |
| Reading processing | Included in SparkplugPipelineLayer | `ReadingProcessor` — transforms raw readings into entity events |

**Current state**: The SparkplugPipelineLayer implements the L0-L2 capabilities
required for edge autonomy. It currently assumes cloud-connected operation but
all processing is local — the pipeline writes to local EventDistribution first,
then publishes to NATS asynchronously.

#### Y.10.3 Entity State Management

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| 12 entity handler layers | `src/lib/iiot/entity/EntityStack.ts:54-67` | Merged via `Layer.mergeAll` — full ISA-95 entity hierarchy |
| Individual entity handlers | `src/lib/iiot/entity/{Area,Device,Enterprise,Line,MachineAsset,Plant,Sensor,Site,WorkCell}Entity.ts` | Plus `AlarmEntity.ts`, `EquipmentStateEntity.ts`, `WorkOrderEntity.ts` |
| State machines | `src/lib/iiot/machines/{Area,Device,Enterprise,Line,MachineAsset,Plant,SensorAsset,Site,WorkCell}Machine.ts` | 12 XState-style state machines |
| State graphs | `src/lib/iiot/machines/graphs/{area,device,enterprise,line,machine-asset,plant,sensor,site,workcell,alarm-state,work-order,equipment-state}-graph.ts` | 12 state transition graphs defining valid state progressions |
| State services | `src/lib/iiot/state/index.ts` | 12 state services with in-memory and SQL implementations |

**Extension point**: For multi-tenant operation, entity handlers need an
`orgId` context. Options:
1. Thread `orgId` through the `ReactivityBridge` (minimal change)
2. Add `orgId` to each entity schema (ISA-95 identifier scoping)
3. Use Effect `Context` to provide `orgId` per-request (cleanest)

#### Y.10.4 Event Distribution — Local + Remote Fan-Out

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| EventDistribution service | `src/lib/iiot/realtime/event-distribution.ts` | Routes events to 4 channels with defined backpressure limits |
| Channel definitions | `src/lib/iiot/realtime/event-distribution.ts:136-157` | `iiot:readings` (maxLag 10K), `iiot:alarms` (maxLag 1K), `iiot:equipment` (maxLag 1K), `iiot:invalidations` (maxLag 1K) |
| Dual-publish path | `src/lib/iiot/realtime/event-distribution.ts:280-326` | Local PubSub + HolonetBridge NATS — events go both local and remote |
| ChannelService broadcast | `src/lib/streams/constructs/ChannelService.ts` | Broadcast outlets for fan-out to multiple subscriber streams |
| ReactivityBridge | `src/lib/iiot/realtime/reactivity-bridge.ts` | Handler-level integration: entity handlers call bridge inline after state change |

**Current state**: The dual-publish path (local PubSub + NATS) is already the
architecture needed for edge autonomy. Local consumers continue receiving events
from ChannelService even when NATS connectivity is lost.

#### Y.10.5 Real-Time Subscriptions — WebSocket Layer

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| WebSocket server | `src/lib/iiot/realtime/websocket-server.ts` | Mounts at `/ws/iiot` via `RpcServer.layerProtocolWebsocketRouter` |
| Streaming RPCs | `src/lib/iiot/rpc/RealtimeRpcs.ts` | 4 streaming RPCs with `stream: true`: `SubscribeReadings`, `SubscribeAlarms`, `SubscribeEquipmentState`, `SubscribeInvalidations` |
| RPC handlers | `src/lib/iiot/realtime/websocket-server.ts` | `RealtimeRpcHandlersBridge` uses `Stream.unwrap` to bridge service effects to RPC streams |
| JSON serialization | `src/lib/iiot/realtime/websocket-server.ts` | `RpcSerialization.layerJson` for browser compatibility |

**Extension point**: For multi-tenant WebSocket, each connection must be
authenticated to an organization's account. The WebSocket handshake should
validate a JWT and scope the subscription to the organization's event namespace.

#### Y.10.6 ISA-95 Hierarchy — Adaptive Depth

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| Branded identifiers | `src/lib/iiot/schemas/identifiers.ts` | `EnterpriseId`, `SiteId`, `AreaId`, `PlantId`, `LineId`, `WorkCellId`, `MachineId`, `SensorId`, `DeviceId` |
| Equipment level enum | `src/lib/iiot/schemas/identifiers.ts` → `EquipmentLevel` | Schema.Literal with 9 levels — full ISA-95 depth |
| Asset schemas | `src/lib/iiot/schemas/assets/{enterprise,site,area,plant,line,workcell,machine,sensor,device}/schema.ts` | Full schema definitions for each hierarchy level |

**Current state**: The full ISA-95 hierarchy is modeled. Adaptive depth (where
smaller organizations use fewer levels) requires conditional activation of
entity handlers and state machines based on the organization's complexity tier.
The `EntityStack.ts` merge-all approach supports this — omit layers for unused
hierarchy levels.

#### Y.10.7 Shard Assignment — Effect Cluster

| Requirement | Current State | Notes |
|-------------|--------------|-------|
| @effect/cluster integration | Not yet implemented | HashRing and shard allocation are architecture-plan items; the EntityStack currently runs in-process |
| Shard group separation | Entity types already separated | 12 distinct entity handler layers in EntityStack — each could be assigned to a different shard group |
| Runner tier weighting | Not yet implemented | Requires @effect/cluster deployment with weighted runners |

**Extension point**: The `EntityStack.ts` architecture (separate entity layers
merged) maps directly to @effect/cluster shard groups. Each entity type layer
can be deployed as a separate shard group with its own runner allocation.

#### Y.10.8 Monitoring Infrastructure

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| Channel backpressure limits | `src/lib/iiot/realtime/event-distribution.ts:136-157` | `maxLag` per channel provides the substrate for consumer lag monitoring |
| Streaming diagnostics | `src/lib/streams/constructs/ChannelService.ts` | ChannelService can expose per-outlet lag metrics |

**Extension point**: Comprehensive monitoring (per-org health, G-8 staleness,
marketplace throughput) requires a dedicated metrics service. The ChannelService
maxLag values provide natural alert thresholds.

---

## Open Questions

1. **Account JWT rotation**: When an organization's JWT expires, how is renewal
   coordinated with the edge device? The edge device may be offline when the JWT
   expires, preventing reconnection until the operator intervenes.

2. **Multi-edge organizations**: Large organizations may have multiple edge
   devices (one per site). How are their JetStream domains coordinated? Mirror
   chains (edge -> site hub -> cloud) introduce additional reconciliation
   complexity.

3. **Network partitions between cloud NATS nodes**: If the cloud cluster itself
   partitions (e.g., Atlanta data center A loses connectivity to data center B),
   how do cross-org events from organizations connected to different partitions
   maintain G-8 bounded staleness?

4. **Rate limiting fairness**: How should the cloud cluster fairly allocate
   inbound event processing bandwidth across 200K organizations during peak
   load? Per-account rate limits may penalize organizations with legitimate
   high-throughput needs.

---

## References

All references use canonical keys from the project bibliography
(`docs/specifications/bibliography.md`).

- [RFC2119] — Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
- [FDA-CFR11] — U.S. FDA, 21 CFR Part 11. Electronic Records.
- [NATS-ACCOUNTS] — Synadia. "NATS Account-Based Security."
- [NATS-DECENTRALIZED] — Synadia. "NATS Decentralized JWT Authentication."
- [NATS-LEAFNODE] — Synadia. "NATS Leaf Nodes."
- [NATS-DEDUP-INF] — Synadia. "Infinite Message Deduplication in JetStream."
- [EFFECT-CLUSTER] — Effect Contributors. "@effect/cluster — Distributed Entity Management."
- [EFFECT-HASHRING] — Effect Contributors. "effect/HashRing — Consistent Hashing Implementation."
- [TMNL-CONSISTENCY] — "Research: Consistency Models for Metropolitan-Scale IIoT."
