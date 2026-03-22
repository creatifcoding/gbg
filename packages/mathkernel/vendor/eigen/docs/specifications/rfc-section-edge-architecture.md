# RFC-001 Section 15: Edge-First Architecture & Deployment Topology

```
Section:       Edge-First Architecture & Deployment Topology
Parent RFC:    RFC-001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        Val (effect-specialist)
Created:       2026-02-09
Research Base: research-effect-architecture.md (Sections 1, 6)
               research-cluster-patterns.md (Sections 5, 6)
               research-uns-metropolitan.md (Sections 2, 6, 7)
               research-manufacturing-commons.md (Sections 7, 8)
               rfc-section-security-trust.md (Sections Z.3, Z.4)
               rfc-section-two-domain-consistency.md (Sections X.2, X.6, X.7)
```

> This section specifies the edge-first deployment architecture for the TMNL
> metropolitan manufacturing network. The platform MUST operate without cloud
> connectivity. The edge device is the sovereign data authority for its
> organization. Cloud services enhance but never gate manufacturing operations.
> File paths are relative to `packages/tmnl/src/`.

---

## Table of Contents

1. [Design Philosophy: Edge-First, Cloud-Optional](#151-design-philosophy-edge-first-cloud-optional)
2. [Four-Tier Edge Capability Model](#152-four-tier-edge-capability-model)
3. [NATS Topology for 200K Organizations](#153-nats-topology-for-200k-organizations)
4. [@effect/cluster Deployment Profiles](#154-effectcluster-deployment-profiles)
5. [Edge-Cloud Reconciliation Protocol](#155-edge-cloud-reconciliation-protocol)
6. [Resource Constraints per Tier](#156-resource-constraints-per-tier)
7. [Security at the Edge](#157-security-at-the-edge)
8. [Upgrade & Migration Paths](#158-upgrade--migration-paths)
9. [Edge Deployment Patterns](#159-edge-deployment-patterns)
10. [Bandwidth Optimization](#1510-bandwidth-optimization)
11. [Offline Autonomy — Extended Patterns](#1511-offline-autonomy--extended-patterns)
12. [Codebase Reference Map](#1512-codebase-reference-map)
13. [Open Questions](#1513-open-questions)
14. [References](#1514-references)

---

## 15.1 Design Philosophy: Edge-First, Cloud-Optional

### 15.1.1 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### 15.1.2 The Sovereignty Principle

The metropolitan manufacturing network serves 200,000+ organizations ranging from
a 2-person machine shop with unreliable internet to a 500-employee aerospace
facility with redundant fiber. The architecture MUST NOT assume cloud
connectivity for any manufacturing operation.

**Edge Sovereignty Rule (E-1)**: An organization's edge device is the
authoritative source of truth for that organization's entity state, sensor
readings, alarm lifecycle, and work order history. The cloud cluster is a
mirror, not a primary.

**Cloud Enhancement Rule (E-2)**: Cloud services MUST only provide:
- Cross-organization marketplace aggregation (G-8 events)
- Long-term archival beyond edge storage capacity
- Network-level analytics and capability matching
- Redundant backup for disaster recovery

Cloud services MUST NOT provide:
- Entity state management (that is the edge's responsibility)
- Alarm acknowledgment routing (must work offline)
- Operator authentication (JWT-based, offline-capable)
- Sensor data collection or buffering

**Offline Continuity Rule (E-3)**: When the edge device loses cloud
connectivity, ALL intra-organization operations MUST continue without
degradation. Specifically:

| Operation | Offline Behavior | Degradation |
|-----------|-----------------|-------------|
| Sensor reading ingestion | MUST continue | None |
| Alarm detection and routing | MUST continue | None |
| Entity state transitions | MUST continue | None |
| Work order lifecycle | MUST continue | None |
| Operator dashboard | MUST continue | None |
| Cross-org marketplace | MUST degrade gracefully | Org disappears from network views |
| Network capacity aggregates | MUST degrade gracefully | Stale data for this org |
| Cloud analytics | MUST queue locally | Delayed until reconnection |

### 15.1.3 Rationale

This philosophy is grounded in the manufacturing commons thesis
[research-manufacturing-commons.md Section 7]: small manufacturers are
first-class citizens. A machinist with a $50 Raspberry Pi, a CNC mill, and a
lathe is as architecturally important as a large factory with a $50,000 edge
server. The platform's value is in the network effect, not in forcing cloud
dependency.

**Codebase proof**: The existing NATS connection layer at
`lib/holonet/nats/connection.ts:40-60` [NatsConnectionService] uses
`Effect.acquireRelease` for scoped lifecycle management. This pattern supports
both persistent cloud connections (T2/T3 tiers) and intermittent connections
(T1 tier) via NATS leaf node reconnection semantics.

**Codebase proof**: The SparkplugAdapter at
`lib/iiot/adapters/sparkplug-adapter.ts:406-407` [SparkplugAdapterLive]
accepts configuration that operates against a local MQTT broker. The adapter
does not require cloud connectivity — it bridges local MQTT to local NATS.

---

## 15.2 Four-Tier Edge Capability Model

### 15.2.1 Tier Definitions

Implementations MUST classify edge deployments into one of four capability tiers.
Each tier defines the MUST/SHOULD/MAY capabilities available to the organization.

#### Tier 0 (T0): Client Device — Read-Only Access

```
Hardware:    Smartphone, tablet, laptop browser
Cost:        $0 (existing device)
Connectivity: WiFi/cellular to T1/T2/T3 or cloud
Role:        Consumer of entity state, not producer
```

**MUST capabilities**:
- Display real-time entity state via WebSocket subscription
- Acknowledge alarms via RPC call to T1/T2/T3 device
- View sensor reading dashboards (read-only)
- Authenticate via NATS JWT (user-level, scoped to read operations)

**SHOULD capabilities**:
- Receive push notifications for critical alarms (ISA-95 L1-L2)
- Cache last-known entity state for offline viewing
- Display historical trends from JetStream replay (when connected)

**MUST NOT capabilities**:
- Run @effect/cluster runners (no local entity processing)
- Persist events locally (no JetStream domain)
- Bridge Sparkplug-B or OPC-UA protocols

**Transport**: WebSocket to nearest T1/T2/T3 device or cloud endpoint. The
existing WebSocket server at `lib/iiot/realtime/websocket-server.ts:68-137`
serves T0 clients via `RpcServer.layerProtocolWebsocketRouter`.

#### Tier 1 (T1): Minimal Edge — Sparkplug Bridge + Telemetry Buffer

```
Hardware:    $50-200 SBC (Raspberry Pi 4/5, Orange Pi, Radxa)
CPU:         4-core ARM, 1-2 GHz
RAM:         1-4 GB
Storage:     32-128 GB microSD or eMMC
Cost:        $50-200
Connectivity: Ethernet/WiFi, intermittent internet acceptable
Role:        Protocol bridge, local telemetry buffer, NATS leaf node
```

**MUST capabilities**:
- Run Sparkplug-B adapter bridging local MQTT to NATS
  (`lib/iiot/adapters/sparkplug-adapter.ts:406-407` [SparkplugAdapterLive])
- Buffer sensor readings locally during cloud disconnection
- Run NATS server in leaf node mode (single-process, embedded)
- Persist events to local JetStream domain (file storage, 1-day retention)
- Authenticate to cloud hub via signed JWT [NATS-DECENTRALIZED]
- Enforce intra-organization ordering guarantees G-1 and G-2

**SHOULD capabilities**:
- Run alarm detection logic locally (threshold-based, no ML)
  (`lib/iiot/adapters/ingestion-service.ts:297-322` [SparkplugPipelineLayer])
- Serve T0 clients on local network via WebSocket
- Buffer cross-org events for cloud delivery on reconnection
- Support report-by-exception filtering to reduce telemetry volume by 80-90%
  [research-uns-metropolitan.md Section 7.1]

**MAY capabilities**:
- Run @effect/cluster SingleRunner with minimal entity set (up to 50 entities)
- Execute simple state machines for equipment monitoring
- Cache NATS KV state for offline dashboard rendering

**MUST NOT capabilities**:
- Run multi-node cluster (insufficient resources)
- Persist events beyond 1-day retention (storage constraints)
- Execute ML inference models

#### Tier 2 (T2): Industrial Edge Gateway — Full Local Processing

```
Hardware:    Industrial edge gateway or mini-PC
Examples:    Dell Edge Gateway 5200, Siemens IPC127E, Intel NUC,
             Advantech UNO-2484G
CPU:         4-8 core x86/ARM, 2-3 GHz
RAM:         4-16 GB
Storage:     128 GB - 1 TB SSD
Cost:        $500-2,000
Connectivity: Dual Ethernet, WiFi, optional cellular failover
Role:        Full local entity processing, 30-day retention
```

**MUST capabilities**:
- Run @effect/cluster SingleRunner with SQL-backed RunnerStorage
  (`@effect/cluster/SingleRunner` — in-process, no network transport)
- Process all 12 entity types locally with full state machine validation
- Persist events to local JetStream domain (file storage, 30-day retention)
- Run complete SparkplugPipelineLayer with TopicRouter, ReadingProcessor,
  AlarmDetector, and IngestionService
- Enforce intra-organization ordering guarantees G-1 through G-6
- Serve T0 clients via WebSocket on local network
- Operate indefinitely without cloud connectivity (E-3)

**SHOULD capabilities**:
- Run EventDistribution with 4+ channels
  (`lib/iiot/realtime/event-distribution.ts` — ChannelService-based hub)
- Mirror local JetStream streams to cloud domain on reconnection
- Support NATS KV for entity current state
  (`lib/iiot/state/` — SiteState, DeviceState, etc.)
- Run OPC-UA adapter alongside Sparkplug-B adapter
- Expose HTTP API for local MES/SCADA integration
- Run entity observer fibers for real-time entity-change events
  (makeEntityObserver pattern per RFC Section 10)

**MAY capabilities**:
- Run 2-node local cluster (SingleRunner + SocketRunner) for HA
- Execute lightweight ML inference for anomaly detection
- Bridge to legacy SCADA historians via OPC-DA/HDA adapters
- Run WebSocket server for local HMI panels

#### Tier 3 (T3): Edge Server — Enterprise-Grade Local Cluster

```
Hardware:    Rack-mount server, industrial PC cluster, or VM cluster
Examples:    Dell PowerEdge R660xs, HPE ProLiant DL360,
             Lenovo ThinkSystem SR630 V3, Kubernetes on-prem
CPU:         16-64 cores, 2.5-4 GHz
RAM:         32-256 GB
Storage:     2-20 TB NVMe/SSD (RAID)
Cost:        $5,000-50,000+
Connectivity: Redundant GbE/10GbE, dedicated internet circuit
Role:        Multi-runner cluster, full JetStream, ML inference,
             1-year+ retention
```

**MUST capabilities**:
- Run @effect/cluster with SocketRunner transport (multi-node)
  (`@effect/cluster/SocketRunner` — binary TCP, production-grade)
- Support 5 shard groups (`org-identity`, `asset-hierarchy`, `equipment`, `telemetry`, `operational`)
  with 300 shards per group (default `shardsPerGroup`)
- Process 5,000+ entities with full state machine validation
- Persist events to local JetStream domain (file storage, 1-year retention)
- Run 3-replica JetStream cluster for local HA
- Enforce all intra-organization ordering guarantees G-1 through G-7
- Serve 50+ concurrent T0 clients via WebSocket
- Run HolonetBridge for NATS-distributed event delivery
  (`lib/iiot/realtime/holonet-bridge.ts`)

**SHOULD capabilities**:
- Run HttpRunner or WebSocket transport for inter-runner communication
  (`@effect/cluster/HttpRunner.layerHttp`, `HttpRunner.layerWebsocket`)
- Support horizontal scaling by adding runner nodes
- Run ML inference models for predictive maintenance
- Support JetStream domain mirroring to cloud (continuous, not batch)
- Run full EventDistribution with 7+ channels for metropolitan-scale routing
- Integrate with enterprise MES, ERP, and SCADA systems via HTTP API
- Run entity lifecycle audit trail with 7-year regulatory retention
  (ISA-18.2 alarm records, FDA 21 CFR Part 11 work order records)

**MAY capabilities**:
- Run dedicated JetStream servers (separate from NATS core servers)
- Operate as a regional hub for multiple T1/T2 sites
- Run durable workflow engine (`@effect/cluster/ClusterWorkflowEngine`)
  for complex multi-step manufacturing processes
- Deploy Kubernetes-native with operator-managed cluster scaling

### 15.2.2 Tier Capability Matrix

| Capability | T0 | T1 | T2 | T3 |
|---|---|---|---|---|
| Read entity state | MUST | MUST | MUST | MUST |
| Write entity state | -- | MAY | MUST | MUST |
| Sparkplug-B bridge | -- | MUST | MUST | MUST |
| Local NATS server | -- | MUST | MUST | MUST |
| JetStream persistence | -- | MUST (1d) | MUST (30d) | MUST (1yr) |
| @effect/cluster | -- | MAY (Single) | MUST (Single+SQL) | MUST (Socket multi) |
| Entity processing | -- | MAY (50) | MUST (500) | MUST (5000+) |
| Alarm detection | -- | SHOULD | MUST | MUST |
| EventDistribution | -- | -- | SHOULD | MUST |
| HolonetBridge | -- | -- | SHOULD | MUST |
| WebSocket server | -- | SHOULD | MUST | MUST |
| ML inference | -- | -- | MAY | SHOULD |
| Offline operation | -- | MUST | MUST | MUST |
| Cloud mirror | -- | SHOULD | SHOULD | MUST |
| Multi-node cluster | -- | -- | MAY (2) | MUST |
| HTTP API | -- | -- | SHOULD | MUST |

---

## 15.3 NATS Topology for 200K Organizations

### 15.3.1 Three-Level Hub-and-Spoke Architecture

The NATS deployment for 200,000 organizations MUST use a three-level
hub-and-spoke topology based on NATS leaf nodes [NATS-LEAFNODE]:

```
                    ┌─────────────────────────┐
                    │    NATS Supercluster     │
                    │   (3-5 geographic DCs)   │
                    │                          │
                    │  ┌────────────────────┐  │
                    │  │ Gateway mesh:      │  │
                    │  │  DC-East ←→ DC-West│  │
                    │  │  DC-East ←→ DC-South│ │
                    │  │  DC-West ←→ DC-South│ │
                    │  └────────────────────┘  │
                    │                          │
                    │  System account:         │
                    │  manufacturing-commons   │
                    │  (marketplace, CRDTs)    │
                    └──────┬───────┬───────┬───┘
                           │       │       │
           ┌───────────────┘       │       └───────────────┐
           │                       │                       │
    ┌──────┴──────┐         ┌──────┴──────┐         ┌──────┴──────┐
    │  Hub East   │         │  Hub West   │         │  Hub South  │
    │  (Atlanta)  │         │  (Dallas)   │         │  (Miami)    │
    │  3-node     │         │  3-node     │         │  3-node     │
    │  cluster    │         │  cluster    │         │  cluster    │
    └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
           │                       │                       │
     ┌─────┼─────┐          ┌─────┼─────┐          ┌─────┼─────┐
     │     │     │          │     │     │          │     │     │
    Leaf  Leaf  Leaf       Leaf  Leaf  Leaf       Leaf  Leaf  Leaf
    (T1)  (T2)  (T3)      (T1)  (T2)  (T3)      (T1)  (T2)  (T3)
    Earl  MfgCo BigAero   ...   ...   ...        ...   ...   ...
```

**Level 1 — Supercluster**: 3-5 geographically distributed data centers connected
via NATS gateway mesh. Hosts the `manufacturing-commons` system account for
cross-organization events, CRDT aggregates, and marketplace data.

**Level 2 — Regional Hub**: 3-node NATS clusters serving a metropolitan area.
Each hub handles 10,000-50,000 organization leaf nodes. Hub clusters run
JetStream for cross-org stream aggregation and NATS KV for network-level state.

**Level 3 — Organization Leaf Node**: Each organization's edge device (T1/T2/T3)
runs a NATS leaf node that connects to its nearest regional hub. The leaf node
provides local NATS pub/sub and JetStream within the organization's account.

### 15.3.2 NATS Account-per-Organization

Each organization MUST map to a dedicated NATS Account [NATS-ACCOUNTS] as
specified in [rfc-section-security-trust.md Section Z.3]:

```
Operator Key (platform root of trust)
  ├── Account: earl-machine-shop (T1 edge)
  │     └── User: earl-edge-001 (CNC gateway)
  ├── Account: precision-machining-inc (T2 edge)
  │     ├── User: pm-edge-001 (factory gateway)
  │     └── User: pm-cloud-001 (cloud analytics)
  ├── Account: aero-dynamics-corp (T3 edge)
  │     ├── User: ad-edge-001 (plant-1 server)
  │     ├── User: ad-edge-002 (plant-2 server)
  │     └── User: ad-cloud-001 (analytics cluster)
  └── Account: manufacturing-commons (system)
        └── User: commons-aggregator
```

**Subject namespace isolation**: Within an account, subjects are invisible to other
accounts by default. `iiot.readings.*` in Earl's account is completely separate
from `iiot.readings.*` in Precision Machining's account. No collision, no
leakage.

**Implications for NATS subjects**: Because accounts provide implicit orgId
isolation, intra-organization subjects MUST NOT include the orgId prefix. The
orgId is the account itself:

```
# WITHIN an account (intra-org):
iiot.entity.{entityType}.{entityId}        ← No orgId needed
iiot.readings.{siteId}.{deviceId}          ← No orgId needed

# ACROSS accounts (cross-org, system account):
commons.capacity.{orgId}                   ← orgId explicit
commons.marketplace.workorder.{workOrderId} ← orgId in payload
```

This harmonizes the subject hierarchy inconsistency identified in
[review-effect-specialist-diff.md Section I-2].

### 15.3.3 Leaf Node Connection Flow

```
T1 Edge Device (Earl's shop):

1. Boot → Load NATS config + JWT from local storage
2. Start embedded NATS server in leaf node mode
3. Start local JetStream domain (earl-shop-edge-001)
4. Connect leaf node → Hub East (nats://hub-east.mfg-network.io:7422)
   - TLS 1.3 (auto-provisioned certificate)
   - JWT authentication (account: earl-machine-shop)
5. Leaf node auto-subscribes to:
   - System imports: commons.notifications.earl-machine-shop.>
   - Account exports: capacity.available → manufacturing-commons
6. Local services start:
   - SparkplugAdapterLive (MQTT → NATS bridge)
   - ReadingProcessor + AlarmDetector
   - Optional: SingleRunner entity cluster
7. Normal operation: all intra-org traffic stays local
8. Cross-org traffic routes through leaf → hub → supercluster
```

**Reconnection behavior**: When the leaf node loses connectivity to its hub:

1. Local NATS operations continue without interruption (E-3)
2. Local JetStream continues persisting events
3. Cross-org exports queue in the leaf node's outbound buffer
4. On reconnection, NATS leaf node protocol automatically:
   - Re-establishes the connection with TLS handshake
   - Re-subscribes to all imported subjects
   - Delivers queued outbound messages to the hub
   - JetStream domain mirror catches up (per G-6)

### 15.3.4 Hub Capacity Planning

Each regional hub cluster MUST be sized for its expected leaf node count:

| Hub Size | Leaf Nodes | Accounts | Cross-Org Events/sec | JetStream Storage |
|----------|-----------|----------|---------------------|------------------|
| Small (3-node) | 1,000-5,000 | 1,000-5,000 | ~50-250 | 500 GB |
| Medium (5-node) | 5,000-20,000 | 5,000-20,000 | ~250-1,000 | 2 TB |
| Large (7-node) | 20,000-50,000 | 20,000-50,000 | ~1,000-2,500 | 5 TB |

**Note**: These estimates are for CROSS-ORG traffic only. Intra-org traffic stays
within the leaf node and does not traverse the hub. At 200K organizations with
5 hubs, each hub serves ~40K leaf nodes (Large configuration).

### 15.3.5 JetStream Stream Configuration per Level

**Leaf Node (per-org) JetStream Streams**:

```
# Telemetry — high volume, short retention
Stream:     ORG_TELEMETRY
Subjects:   iiot.readings.>
MaxAge:     Tier-dependent (T1: 1 day, T2: 30 days, T3: 1 year)
MaxBytes:   Tier-dependent (T1: 1 GB, T2: 50 GB, T3: 500 GB)
Storage:    File
Replicas:   1 (T1/T2), 3 (T3)

# Entity Events — event-sourced, regulatory retention
Stream:     ORG_ENTITY_EVENTS
Subjects:   iiot.entity.>
MaxAge:     Tier-dependent (T1: 30 days, T2: 1 year, T3: 7 years)
MaxBytes:   Tier-dependent (T1: 100 MB, T2: 5 GB, T3: 50 GB)
Storage:    File
Replicas:   1 (T1/T2), 3 (T3)
DenyPurge:  true (T2+, regulatory compliance)
DenyDelete: true (T2+)
```

**Hub (regional) JetStream Streams**:

```
# Cross-org marketplace events
Stream:     COMMONS_MARKETPLACE
Subjects:   commons.marketplace.>
MaxAge:     90 days
MaxBytes:   100 GB
Storage:    File
Replicas:   3
Sources:    Aggregated from org account exports

# Network capacity CRDT
Bucket:     NETWORK_CAPACITY
Key Pattern: capacity.{orgId}
History:    5
TTL:        5 minutes (stale org detection)
```

**Supercluster JetStream Streams**:

```
# Global marketplace mirror
Stream:     GLOBAL_MARKETPLACE
Subjects:   commons.marketplace.>
MaxAge:     1 year
Storage:    File
Replicas:   5 (across DCs)
Sources:    Mirrored from all hub streams
```

---

## 15.4 @effect/cluster Deployment Profiles

### 15.4.1 Profile Matrix

Each edge tier maps to a specific @effect/cluster deployment profile. These
profiles are verified against the cluster transport options documented in
[research-cluster-patterns.md Section 5].

| Tier | Runner Mode | Shard Groups | Shards/Group | Transport | RunnerStorage |
|------|------------|-------------|-------------|-----------|--------------|
| T0 | None (client-only) | N/A | N/A | WebSocket (consumer) | N/A |
| T1 | SingleRunner (optional) | 1 | 10 | In-process | SQLite (local) |
| T2 | SingleRunner + SQL | 3 | 50 | In-process | SQLite or PostgreSQL |
| T3 | SocketRunner cluster | 5 | 300 (default) | TCP Socket | PostgreSQL |
| Cloud | HttpRunner cluster | 5+ | 300+ | HTTP + WebSocket | PostgreSQL |

### 15.4.2 T0 Profile: Client-Only

T0 devices MUST NOT run any cluster infrastructure. They connect as WebSocket
clients to the nearest available cluster endpoint:

```typescript
// T0 client connection (browser or mobile)
// Uses RpcClient via WebSocket — no cluster Layer needed
const client = yield* RpcClient.make(IIoTRpcs, {
  transport: RpcClientProtocolWebsocket({
    url: "wss://edge-gateway.local/ws/iiot"
  })
})

// Subscribe to entity changes (read-only)
yield* client.Realtime.SubscribeEntityChanges({
  entityTypes: ['Machine', 'Alarm'],
  isaLevels: ['L1', 'L2'],
})
```

### 15.4.3 T1 Profile: Minimal SingleRunner

T1 devices MAY run @effect/cluster in SingleRunner mode for basic entity
processing. SingleRunner operates in-process without network transport
[research-cluster-patterns.md Section 5.1]:

```typescript
// T1 deployment — SingleRunner with SQLite
import { SingleRunner } from "@effect/cluster"
import { SqliteClient } from "@effect/sql-sqlite-bun"

const T1ClusterLayer = Layer.mergeAll(
  SingleRunner.layer,
  SqliteClient.layer({ filename: "/data/cluster.db" }),
  ShardingConfig.layer({
    shardsPerGroup: 10,       // Minimal shard count
    maxIdleTime: Duration.minutes(5),  // Aggressive reaping
    entityTerminationTimeout: Duration.seconds(5),
  }),
)
```

**Entity budget**: T1 devices SHOULD limit active entities to 50 concurrent
instances. The `maxIdleTime` SHOULD be set to 5 minutes (vs default 1 minute)
to balance reaping frequency against re-activation cost on constrained hardware.

**Shard configuration**: SingleRunner with `shardsPerGroup: 10` and 1 shard
group yields 10 total shards. With up to 50 entities, this is ~5 entities/shard
-- well within the entity manager's capacity.

### 15.4.4 T2 Profile: SingleRunner with Full Entity Stack

T2 devices MUST run @effect/cluster SingleRunner with SQL-backed storage and
the full entity processing stack:

```typescript
// T2 deployment — SingleRunner with full EntityStack
const T2ClusterLayer = Layer.mergeAll(
  SingleRunner.layer,
  SqliteClient.layer({ filename: "/data/cluster.db" }),
  ShardingConfig.layer({
    shardsPerGroup: 50,
    maxIdleTime: Duration.minutes(2),
    entityTerminationTimeout: Duration.seconds(10),
  }),
)

// Full entity processing
const T2ApplicationLayer = T2ClusterLayer.pipe(
  Layer.provideMerge(EntityHandlersLayer),      // 12 entity types
  Layer.provideMerge(EventDistributionLayer),    // 4+ channels
  Layer.provideMerge(SparkplugPipelineLayer({    // Ingestion
    sparkplug: localSparkplugConfig
  })),
)
```

**Shard configuration**: 3 shard groups (`asset-hierarchy`, `equipment`, `operational`) with
50 shards each = 150 total shards. The `org-identity` and `telemetry` groups are
omitted at T2 because a single organization does not need an `org-identity` group, and
telemetry is handled by the ingestion pipeline, not entity actors.

**Entity budget**: T2 devices MUST support up to 500 concurrent entity instances.
With 150 shards, this is ~3.3 entities/shard.

### 15.4.5 T3 Profile: Multi-Runner Cluster

T3 deployments MUST run @effect/cluster with SocketRunner for multi-node
distribution:

```typescript
// T3 deployment — SocketRunner with full shard groups
import { SocketRunner } from "@effect/cluster"

const T3ClusterLayer = Layer.mergeAll(
  SocketRunner.layer({
    host: "0.0.0.0",
    port: 34437,
  }),
  PgClient.layer({
    host: "localhost",
    database: "cluster",
  }),
  ShardingConfig.layer({
    shardsPerGroup: 300,       // Default
    maxIdleTime: Duration.minutes(1),
    entityTerminationTimeout: Duration.seconds(15),
    runnerRefreshInterval: Duration.seconds(3),
  }),
)

// 5 shard groups with ClusterSchema annotations
const SensorEntity = Entity.make("Sensor", SensorRpcGroup)
  .annotate(ClusterSchema.ShardGroup, "telemetry")

const MachineEntity = Entity.make("Machine", MachineRpcGroup)
  .annotate(ClusterSchema.ShardGroup, "equipment")

const AlarmEntity = Entity.make("Alarm", AlarmRpcGroup)
  .annotate(ClusterSchema.ShardGroup, "operational")

const SiteEntity = Entity.make("Site", SiteRpcGroup)
  .annotate(ClusterSchema.ShardGroup, "asset-hierarchy")
```

**Shard configuration**: 5 shard groups with 300 shards each = 1,500 total
shards. With 5,000+ entities, this is ~3.3 entities/shard — consistent with
the T2 ratio.

**Runner topology**: T3 deployments SHOULD run 3+ runner nodes for HA.
The `weight` parameter controls shard distribution proportionality
[research-cluster-patterns.md Section 5.4]:

```
Runner 1 (primary):    weight=2, ~60% of shards
Runner 2 (secondary):  weight=1, ~20% of shards
Runner 3 (secondary):  weight=1, ~20% of shards
```

### 15.4.6 Cloud Profile: HTTP-Based Cluster

Cloud deployments serving organizations without local edge processing MUST use
HttpRunner for inter-runner communication:

```typescript
// Cloud deployment — HttpRunner with WebSocket option
import { HttpRunner } from "@effect/cluster"

const CloudClusterLayer = Layer.mergeAll(
  HttpRunner.layerHttp,           // HTTP POST inter-runner
  // OR: HttpRunner.layerWebsocket  // Persistent WS inter-runner
  PgClient.layer({
    host: "cluster-db.internal",
    database: "cluster",
    pool: { min: 5, max: 20 },
  }),
  ShardingConfig.layer({
    shardsPerGroup: 300,
    entityTerminationTimeout: Duration.seconds(15),
  }),
)
```

Cloud clusters SHOULD also expose the WebSocket server for T0 clients:

```typescript
// WebSocket server for T0 clients
const WebSocketLayer = RpcServer.layerProtocolWebsocketRouter.pipe(
  Layer.provide(RpcSerialization.layerJson),
  Layer.provide(IIoTRpcHandlersLayer),
)
```

---

## 15.5 Edge-Cloud Reconciliation Protocol

### 15.5.1 Offline Operation Model

When an edge device (T1/T2/T3) loses cloud connectivity, the following
reconciliation model applies:

```
Time ──────────────────────────────────────────────────►

   ONLINE          OFFLINE            RECONNECTING
   ═══════         ═══════════        ════════════════

   Events ──►Hub   Events ──►Local    Local events ──►Hub
                   JetStream          (ordered replay)
                   persists
                   locally            Hub events ──►Local
                                      (mirror catchup)

   Cross-org       Cross-org          Cross-org exports
   active          queued             delivered

   Cloud mirror    Cloud mirror       Cloud mirror
   in sync         paused             catching up
```

### 15.5.2 Reconnection Sequence

Upon detecting cloud connectivity restoration, the edge device MUST execute
the following sequence:

1. **NATS leaf node reconnection**: The leaf node protocol automatically
   re-establishes the TLS connection and re-subscribes to imported subjects.
   This is handled by the NATS client library, not application code.

2. **JetStream domain sync**: The local JetStream domain begins mirroring
   queued events to the cloud domain. Events MUST be delivered preserving
   per-entity sequential ordering (G-1) regardless of the duration of
   disconnection [rfc-section-two-domain-consistency.md Section X.3, G-6].

3. **Cross-org event delivery**: Queued cross-org exports (capacity updates,
   marketplace events) are delivered to the hub. These events carry their
   original `originTimestamp` but receive a new `networkTimestamp` reflecting
   actual cloud ingestion time [rfc-section-two-domain-consistency.md
   Section X.4.2].

4. **Stale org advisory clearance**: If the organization was marked as stale
   (after exceeding the CRDT TTL, RECOMMENDED: 5 minutes), the
   `OrgStale` advisory MUST be cleared upon successful reconnection.

5. **Sequence gap detection**: The cloud domain MUST detect sequence number
   gaps in the incoming event stream and log a `SequenceGapDetected` event.
   Gaps indicate lost events (possible JetStream overflow during extended
   offline). Implementations SHOULD NOT attempt automatic gap filling — the
   edge device's local JetStream is the authoritative source.

### 15.5.3 Conflict Resolution Rules

Conflicts between edge and cloud state are resolved by the following precedence
rules:

| Data Type | Authoritative Source | Rationale |
|-----------|---------------------|-----------|
| Sensor readings | Edge (originTimestamp) | Physical measurement happened at edge |
| Entity state | Edge (sequence number) | Entity actor runs on edge |
| Alarm lifecycle | Edge (ISA-18.2 timestamp) | Alarm management is safety-critical |
| Work order state | Edge (sequence number) | Work order processing is local |
| Cross-org capacity | Cloud (networkTimestamp) | Network view requires cloud authority |
| Marketplace events | Cloud (networkTimestamp) | Marketplace is a cloud service |
| Network aggregates | Cloud (CRDT merge) | CRDTs converge without conflict |

**No split-brain for entity state**: Because entity actors run exclusively on the
edge device, there is no cloud-side entity state to conflict with. The cloud is a
mirror, not a primary. Split-brain is architecturally impossible for intra-org
data.

### 15.5.4 Staleness Budget

The staleness budget is the maximum acceptable age of data before it is
considered stale. Implementations MUST configure staleness thresholds per data
path:

| Data Path | Staleness Budget | Configurable? |
|-----------|-----------------|---------------|
| Intra-org sensor readings | 0 (real-time via local NATS) | No |
| Intra-org entity events | 0 (real-time via local NATS) | No |
| Cross-org capacity | 60 seconds (G-8 bounded staleness) | Per-org |
| Cross-org marketplace | 60 seconds (G-8 bounded staleness) | Per-org |
| Cloud analytics mirror | No SLA (best-effort) | Per-org |
| Network CRDT aggregates | 60 seconds + CRDT convergence | No |

Intra-org staleness is always 0 because data never leaves the local NATS
cluster for intra-org operations. Cross-org staleness inherits the G-8 bounded
staleness of 60 seconds [rfc-section-two-domain-consistency.md Section X.4].

---

## 15.6 Resource Constraints per Tier

### 15.6.1 Memory Budget

Each tier MUST operate within defined memory constraints. Implementations MUST
configure JetStream, @effect/cluster, and application services to respect these
budgets:

| Component | T1 (1 GB total) | T2 (4 GB total) | T3 (32 GB total) |
|-----------|-----------------|-----------------|-------------------|
| OS + runtime | 256 MB | 512 MB | 2 GB |
| NATS server | 128 MB | 512 MB | 4 GB |
| JetStream cache | 64 MB | 1 GB | 8 GB |
| @effect/cluster | 64 MB | 512 MB | 4 GB |
| Entity state (in-memory) | 32 MB | 256 MB | 2 GB |
| Application services | 128 MB | 512 MB | 4 GB |
| Sparkplug adapter | 64 MB | 256 MB | 1 GB |
| WebSocket connections | 16 MB | 256 MB | 4 GB |
| Headroom | 248 MB | 696 MB | 3 GB |
| **Total** | **1 GB** | **4 GB** | **32 GB** |

### 15.6.2 Entity Limits

Entity limits MUST be enforced by @effect/cluster's `maxIdleTime` reaping and
application-level entity activation guards:

| Constraint | T1 | T2 | T3 |
|-----------|---|---|---|
| Max concurrent entities | 50 | 500 | 5,000+ |
| Max entity types | 5 | 12 | 12+ |
| Shard groups | 1 | 3 | 5 |
| Shards total | 10 | 150 | 1,500 |
| maxIdleTime | 5 min | 2 min | 1 min (default) |
| entityTerminationTimeout | 5 sec | 10 sec | 15 sec (default) |

### 15.6.3 Stream Backpressure per Tier

Backpressure strategy MUST vary by tier to respect resource constraints:

| Channel | T1 | T2 | T3 |
|---------|---|---|---|
| readings | `PubSub.sliding(100)` | `PubSub.sliding(10_000)` | `PubSub.sliding(10_000)` |
| alarms | `PubSub.bounded(50)` | `PubSub.bounded(1_000)` | `PubSub.bounded(1_000)` |
| equipment | `PubSub.dropping(50)` | `PubSub.dropping(1_000)` | `PubSub.dropping(1_000)` |
| entity-changes | `PubSub.dropping(50)` | `PubSub.dropping(2_000)` | `PubSub.dropping(2_000)` |
| invalidations | `PubSub.dropping(50)` | `PubSub.dropping(1_000)` | `PubSub.dropping(1_000)` |

**Rationale**: T1 uses drastically reduced buffer sizes to fit within the 1 GB
memory budget. Sliding is used for readings (operator needs latest value).
Bounded is used for alarms (ISA-18.2 mandates no loss — bounded exerts
backpressure rather than dropping). Dropping is used for entity-changes and
invalidations (replayable from JetStream).

### 15.6.4 JetStream Retention per Tier

| Stream | T1 | T2 | T3 |
|--------|---|---|---|
| Telemetry MaxAge | 1 day | 30 days | 1 year |
| Telemetry MaxBytes | 1 GB | 50 GB | 500 GB |
| Entity Events MaxAge | 30 days | 1 year | 7 years |
| Entity Events MaxBytes | 100 MB | 5 GB | 50 GB |
| Storage Type | File | File | File (RAID) |
| Replicas | 1 | 1 | 3 |

---

## 15.7 Security at the Edge

### 15.7.1 Transport Security

All NATS connections MUST use TLS 1.3 [rfc-section-security-trust.md
Section Z.5]:

| Connection | TLS Requirement | Certificate Management |
|-----------|----------------|----------------------|
| T0 → T1/T2/T3 (local) | MUST (TLS 1.3) | Self-signed CA, auto-provisioned |
| T1/T2/T3 → Hub | MUST (TLS 1.3) | Platform CA, auto-provisioned |
| Hub → Supercluster | MUST (TLS 1.3) | Platform CA, mutual TLS |
| T0 → Cloud (direct) | MUST (TLS 1.3) | Public CA (Let's Encrypt) |

**Auto-provisioning**: T1/T2 edge devices SHOULD receive TLS certificates during
initial provisioning via a secure enrollment protocol. T3 devices SHOULD use
ACME (Automated Certificate Management Environment) for certificate lifecycle.

### 15.7.2 JWT-Based Authentication

Edge devices MUST authenticate using NATS' decentralized JWT model
[NATS-DECENTRALIZED] as specified in [rfc-section-security-trust.md
Section Z.4]:

**JWT Lifetime per Context**:

| Context | JWT Lifetime | Rotation Method |
|---------|-------------|----------------|
| T1 edge device user key | 90 days | Auto-refresh on hub connection |
| T2 edge device user key | 90 days | Auto-refresh on hub connection |
| T3 edge device user key | 30 days | ACME-style rotation |
| Cloud service user key | 24 hours | Automatic rotation |
| T0 client (browser) | 1 hour | OAuth2 token exchange |

**Offline JWT handling**: When the edge device is offline, its JWT remains valid
until expiry. Implementations MUST provision JWTs with sufficient lifetime to
cover expected offline periods:

- T1 (unreliable internet): 90-day JWT lifetime covers seasonal connectivity gaps
- T2 (intermittent): 90-day JWT lifetime with auto-refresh when connected
- T3 (reliable): 30-day JWT lifetime with continuous rotation

### 15.7.3 Secure Boot and Binary Integrity

**T2+ devices** SHOULD implement signed binary verification:

1. Edge agent binaries MUST be signed with a platform code-signing key
2. On boot, the device SHOULD verify the binary signature before execution
3. Binary updates MUST be delivered via a signed manifest with SHA-256 hashes

**T3 devices** with secure boot capability SHOULD enable UEFI Secure Boot with
platform-enrolled keys.

### 15.7.4 Air-Gapped Operation

For T3 deployments in classified or restricted environments:

1. NATS server MUST operate in standalone mode (no leaf node connection)
2. Certificate rotation MUST be performed via USB media or local management console
3. Configuration updates MUST be applied via signed configuration packages
4. No cloud connectivity MUST be required for any operation
5. Cross-org marketplace participation MUST NOT be available (by definition)

---

## 15.8 Upgrade & Migration Paths

### 15.8.1 T1 to T2 Upgrade

When an organization outgrows T1 capabilities (>50 entities, needs entity
processing, or requires 30-day retention):

**Phase 1 — Hardware Migration**:
1. Provision T2 hardware alongside existing T1
2. Configure T2 with same NATS account credentials (same JWT)
3. Migrate NATS leaf node to T2 hardware
4. T1 device decommissioned or repurposed as backup

**Phase 2 — Capability Activation**:
1. Enable @effect/cluster SingleRunner with SQLite
2. Deploy EntityHandlersLayer with 3 shard groups (`asset-hierarchy`, `equipment`, `operational`) at 50 shards each
3. Enable EventDistribution with 4 channels
4. Migrate JetStream streams: increase MaxAge to 30 days, MaxBytes to 50 GB
5. Run integration tests to verify entity processing

**Phase 3 — Data Migration**:
1. JetStream streams from T1 are NOT migrated (too small to warrant)
2. Entity state is reconstructed from current NATS KV values
3. Historical data older than T1 retention (1 day) is lost — acceptable for
   small deployments

### 15.8.2 T2 to T3 Upgrade

When an organization outgrows T2 capabilities (>500 entities, needs HA, or
requires 1-year retention):

**Phase 1 — Infrastructure**:
1. Deploy T3 server hardware or VM cluster
2. Install PostgreSQL for RunnerStorage (replaces SQLite)
3. Deploy 3-node NATS cluster (replaces single-node)
4. Configure JetStream with 3 replicas

**Phase 2 — Cluster Migration**:
1. Deploy @effect/cluster with SocketRunner on first T3 node
2. Migrate entity types to 5 shard groups (`org-identity`, `marketplace`, `asset-hierarchy`, `equipment`, `operational`) with `ClusterSchema.ShardGroup`
3. Add runner nodes (Runner 2, Runner 3) to the cluster
4. Hash ring rebalances shards across runners automatically
   [research-cluster-patterns.md Section 5.4]

**Phase 3 — Data Migration**:
1. JetStream streams migrated via NATS stream export/import
2. Entity state migrated via SQL database backup/restore
3. Retention extended: Entity events to 7 years, telemetry to 1 year

### 15.8.3 Brownfield Integration: Strangler Fig Pattern

For organizations with existing SCADA, PLC, or historian infrastructure,
the platform MUST support incremental adoption via the strangler fig pattern:

```
Phase 1: OBSERVE (Read-Only)
════════════════════════════════

Existing SCADA/Historian ──► Sparkplug Adapter ──► NATS (readings only)
                                                       │
                              T0 Dashboard ◄───────────┘
                              (read-only overlay)

Phase 2: AUGMENT (Side-by-Side)
═══════════════════════════════

Existing SCADA ─────────────► Sparkplug Adapter ──► NATS ──► Entity System
  (still primary)                                              (shadow state)
                                                               │
Operators use BOTH:                                           │
  - Legacy SCADA for control                                  │
  - T0/T2 dashboard for analytics ◄──────────────────────────┘

Phase 3: REPLACE (Cutover)
══════════════════════════

PLCs/Sensors ──► Sparkplug Adapter ──► NATS ──► Entity System ──► Operators
                                                (primary)
                 Legacy SCADA
                 (decommissioned or demoted to backup)
```

**Key constraints**:
- Phase 1 MUST NOT require any changes to existing PLC/SCADA configuration
- The Sparkplug adapter passively subscribes to existing MQTT topics
- Phase 2 introduces entity processing alongside existing systems
- Phase 3 cutover is organization-controlled, not platform-enforced

**Codebase support**: The SparkplugAdapter at
`lib/iiot/adapters/sparkplug-adapter.ts:56-68` [SparkplugAdapterConfig]
accepts arbitrary `brokerUrl` and `groupIds`, enabling connection to existing
MQTT brokers without infrastructure changes. The adapter operates as a
passive consumer of existing Sparkplug telemetry.

### 15.8.4 Multi-Site Expansion (T3)

T3 organizations with multiple physical sites SHOULD deploy one T2/T3 edge
device per site, all sharing the same NATS account:

```
Organization: Aero Dynamics Corp (3 sites)

  Plant 1 (T3) ── Leaf Node ──┐
                               ├──► Hub East ──► Supercluster
  Plant 2 (T2) ── Leaf Node ──┤
                               │
  Plant 3 (T1) ── Leaf Node ──┘

All three leaf nodes share Account: aero-dynamics-corp
Subjects are shared within the account:
  iiot.entity.Machine.MCH-001  (Plant 1)
  iiot.entity.Machine.MCH-050  (Plant 2)
  iiot.readings.P1.* / iiot.readings.P2.* / iiot.readings.P3.*
```

Each site's leaf node operates independently during cloud disconnection.
Cross-site entity visibility is available when all sites are connected to the
hub. Entity processing SHOULD be distributed: each site processes its own
entities locally, with optional cross-site coordination via shared NATS subjects
within the account.

---

## 15.9 Edge Deployment Patterns

### 15.9.1 NixOS-Based Edge Image

Edge devices at T1, T2, and T3 SHOULD use NixOS for reproducible, declarative
system images. NixOS provides atomic upgrades, rollback on failure, and
binary-reproducible builds — properties essential for fleet management across
200,000+ heterogeneous edge deployments.

**Image Composition per Tier**:

```nix
# T1 Edge Image (Raspberry Pi 4/5)
{
  # Base: minimal NixOS with ARM64 kernel
  imports = [ ./hardware/rpi4.nix ];

  services.nats = {
    enable = true;
    settings = {
      leafnodes.remotes = [{
        url = "tls://hub-east.mfg-network.io:7422";
        credentials = "/etc/nats/edge.creds";
      }];
      jetstream = {
        store_dir = "/var/lib/nats/jetstream";
        max_mem = "64M";
        max_file = "1G";
      };
    };
  };

  # TMNL edge agent — Bun runtime + Effect-TS application
  systemd.services.tmnl-edge = {
    description = "TMNL Edge Agent (T1)";
    after = [ "network.target" "nats.service" ];
    wants = [ "nats.service" ];
    serviceConfig = {
      ExecStart = "${pkgs.bun}/bin/bun run /opt/tmnl/edge-agent.js";
      Restart = "always";
      RestartSec = "5s";
      WatchdogSec = "30s";         # Watchdog — restart if no heartbeat
      MemoryMax = "512M";          # Hard memory ceiling
      Environment = [
        "TMNL_TIER=T1"
        "NATS_URL=nats://localhost:4222"
      ];
    };
  };
}
```

```nix
# T2 Edge Image (Industrial Gateway)
{
  imports = [ ./hardware/x86-gateway.nix ];

  services.nats = {
    enable = true;
    settings = {
      # ... leaf node config same as T1 ...
      jetstream = {
        store_dir = "/var/lib/nats/jetstream";
        max_mem = "1G";
        max_file = "50G";
      };
    };
  };

  # SQLite for @effect/cluster RunnerStorage
  services.tmnl-cluster = {
    enable = true;
    runnerMode = "single";
    storage = "sqlite";
    dbPath = "/var/lib/tmnl/cluster.db";
  };

  # Full entity processing stack
  systemd.services.tmnl-edge = {
    serviceConfig = {
      MemoryMax = "3G";
      WatchdogSec = "60s";
      Environment = [
        "TMNL_TIER=T2"
        "TMNL_CLUSTER_SHARDS_PER_GROUP=50"
        "TMNL_ENTITY_MAX_IDLE=120"
      ];
    };
  };
}
```

```nix
# T3 Edge Image (Server / VM Cluster)
{
  imports = [ ./hardware/server.nix ];

  # 3-node NATS cluster
  services.nats-cluster = {
    enable = true;
    clusterSize = 3;
    jetstream = {
      store_dir = "/var/lib/nats/jetstream";
      max_mem = "8G";
      max_file = "500G";
      replicas = 3;
    };
  };

  # PostgreSQL for RunnerStorage
  services.postgresql = {
    enable = true;
    databases = [ "cluster" "audit" ];
  };

  # @effect/cluster with SocketRunner
  services.tmnl-cluster = {
    enable = true;
    runnerMode = "socket";
    port = 34437;
    storage = "postgresql";
  };
}
```

### 15.9.2 Over-the-Air (OTA) Update Mechanism

Edge devices MUST support atomic OTA updates with automatic rollback on failure.
The NixOS generations model provides this natively:

```
Update Lifecycle:
═══════════════════════════════════════════════════════════════

1. FETCH
   Hub signs update manifest (SHA-256 + Ed25519 signature)
   Edge device downloads NixOS closure (delta from current)
   Bandwidth: typically 50-200 MB for application updates

2. STAGE
   New system generation built on device (NixOS nix-build)
   No downtime — current generation continues running
   Disk: new generation stored alongside current

3. ACTIVATE
   systemctl switch-to-configuration switch
   NATS server gracefully drains connections (5s timeout)
   Edge agent restarts with new binary
   JetStream streams preserved across restart

4. VERIFY
   Watchdog timer starts (WatchdogSec=30s for T1, 60s for T2/T3)
   Agent MUST send heartbeat within watchdog interval
   Agent MUST verify:
     - NATS connection to leaf node hub
     - JetStream domain accessible
     - Sparkplug adapter receiving MQTT messages
     - Entity processing functional (if T2/T3)

5. COMMIT or ROLLBACK
   ├─ Heartbeat received + health checks pass → COMMIT
   │    New generation becomes default boot
   └─ Watchdog timeout or health check failure → ROLLBACK
        NixOS boots previous generation automatically
        Platform alerts: "Edge device {orgId} rolled back update {version}"
```

**Update Scheduling**:

| Tier | Update Window | Approval | Max Downtime |
|------|--------------|----------|-------------|
| T1 | Any time (2-5 sensor pause acceptable) | Auto-approve | 30 seconds |
| T2 | Scheduled maintenance window | Org admin approval | 60 seconds |
| T3 | Change management process (ITIL) | Multi-party approval | 15 seconds (rolling) |

T3 devices with multi-runner clusters MUST use rolling updates: one runner at a
time, with shard rebalancing between each runner restart. This ensures zero
entity processing downtime during updates.

### 15.9.3 Rollback on Failed Update

NixOS provides generation-based rollback. Implementations MUST configure the
following rollback chain:

```
Boot Order (GRUB / systemd-boot):
  1. Latest generation (new update)
  2. Previous generation (last known good)
  3. Factory image (last resort, read-only partition)

Rollback Triggers:
  - Watchdog timeout (WatchdogSec exceeded)
  - NATS leaf node fails to connect within 60 seconds
  - JetStream domain fails health check
  - Sparkplug adapter reports CONNECTION_FAILED 3 times
  - Kernel panic or OOM kill
```

Rollback MUST preserve:
- JetStream data files (separate partition from OS)
- NATS credentials and certificates
- Organization configuration
- Entity state database (SQLite at T1/T2, PostgreSQL at T3)

Rollback MUST NOT preserve:
- Application state in memory (reconstructed from JetStream + state DB)
- WebSocket connections (clients reconnect automatically)

### 15.9.4 Health Check and Watchdog

Each edge tier MUST implement a layered health check system:

**Layer 1 — Systemd Watchdog**:
- Edge agent sends `sd_notify("WATCHDOG=1")` at intervals < `WatchdogSec`
- Failure → systemd restarts the service
- 3 consecutive restarts → systemd triggers NixOS generation rollback

**Layer 2 — Application Health**:
```typescript
// Health check composition — all checks MUST pass
const edgeHealthCheck = Effect.all({
  nats: NatsConnectionService.healthCheck,     // NATS server reachable
  jetstream: JetStreamService.healthCheck,     // JetStream domain writable
  sparkplug: IngestionAdapter.healthCheck,     // MQTT adapter connected
  cluster: ClusterHealth.check,                // Entity processing functional (T2+)
  memory: SystemHealth.memoryBelow(0.85),      // Memory usage < 85%
  disk: SystemHealth.diskBelow(0.90),          // Disk usage < 90%
})
```

**Layer 3 — Fleet Monitoring (when connected)**:
- Edge device publishes heartbeat to hub every 30 seconds
- Hub detects missing heartbeat after 2 intervals (60 seconds)
- Hub publishes `OrgOffline` advisory to `commons.advisories.{orgId}`
- Fleet dashboard shows org connectivity status in real-time

---

## 15.10 Bandwidth Optimization

### 15.10.1 Problem Statement

A metropolitan network of 200,000 organizations generates massive telemetry
volume. Without optimization, upstream bandwidth from edge to hub would be
prohibitive — particularly for T1 devices on constrained connections (cellular,
satellite, rural broadband).

**Unoptimized volume estimate** (per T1 device, 5 sensors at 1 Hz):

```
5 sensors × 1 reading/sec × 100 bytes/reading = 500 bytes/sec
= 43 MB/day = 1.3 GB/month

At 200K organizations: 260 TB/month upstream to hubs
```

Bandwidth optimization MUST reduce upstream traffic by 80-95% while preserving
data fidelity for alarm detection and trend analysis.

### 15.10.2 Delta Compression for Sensor Readings

Implementations SHOULD apply delta encoding at the edge before upstream
publishing. Delta encoding transmits only the difference from the previous
reading for each sensor:

```typescript
// Delta encoding pipeline (edge-side, before NATS publish)
//
// Full reading:  { deviceId: "S-001", value: 72.345, ts: 1706000001 }
// Delta reading: { deviceId: "S-001", delta: +0.012, ts: 1706000002 }
//
// Savings: ~60% reduction for slowly-changing sensors (temperature, pressure)
// Breakeven: sensors with >50% change rate gain no benefit (vibration, current)

const deltaEncode = (
  current: ReadingEvent,
  previous: ReadingEvent | null,
): ReadingEvent | DeltaReadingEvent => {
  if (!previous) return current  // First reading: full value
  const delta = current.value - previous.value
  if (Math.abs(delta) < 0.001) return null  // Deadband: skip identical
  return new DeltaReadingEvent({
    deviceId: current.deviceId,
    delta,
    timestamp: current.timestamp,
  })
}
```

**Deadband filtering**: If the change from the previous reading is within a
configured deadband (e.g., 0.1% of range), the reading SHOULD be suppressed
entirely. This is the report-by-exception pattern referenced in
[research-uns-metropolitan.md Section 7.1].

| Sensor Type | Typical Change Rate | Deadband | Compression Ratio |
|------------|-------------------|----------|------------------|
| Temperature | 0.01-0.1 Hz effective | 0.5 deg F | 90-95% reduction |
| Pressure | 0.01-0.5 Hz effective | 0.1 PSI | 85-95% reduction |
| Flow rate | 0.1-1.0 Hz effective | 1% of range | 70-85% reduction |
| Vibration | 5-50 Hz effective | 0.5% of range | 20-40% reduction |
| Digital I/O | Event-driven | None | 95-99% reduction |

### 15.10.3 Aggregation at Edge Before Upstream Publish

T1 and T2 devices SHOULD aggregate readings locally before publishing to the hub.
Aggregation reduces message count while preserving statistical properties needed
for cloud analytics:

```
Local (1 Hz raw)          Upstream (1/min aggregate)
══════════════════        ═══════════════════════════

S-001: 72.3               S-001: { min: 72.1, max: 72.9,
S-001: 72.4                        avg: 72.45, count: 60,
S-001: 72.2                        first: 72.3, last: 72.5,
... (60 readings)                   stddev: 0.18 }

60 messages → 1 message   = 98.3% message reduction
6000 bytes → 200 bytes    = 96.7% byte reduction
```

**Aggregation windows per tier**:

| Tier | Local Rate | Upstream Rate | Window | Reduction |
|------|-----------|--------------|--------|-----------|
| T1 | 1 Hz | 1/min | 60 sec | ~98% messages |
| T2 | 1 Hz | 1/10sec | 10 sec | ~90% messages |
| T3 | 1 Hz | 1 Hz (full fidelity) | None | 0% (T3 has bandwidth) |

**Exception**: Readings that trigger alarm thresholds MUST be published at full
fidelity immediately, bypassing the aggregation window. The alarm detection
pipeline at `lib/iiot/adapters/alarm-detection.ts` runs locally before
aggregation, ensuring sub-second alarm latency regardless of aggregation window.

### 15.10.4 Priority Queuing

When bandwidth is constrained (cellular failover, satellite, degraded link),
implementations MUST use priority-based message queuing:

```
Priority Queue (highest first):
═══════════════════════════════════════════

P0 — CRITICAL:  Alarms, safety events, equipment faults
                 Delivery: MUST (bounded backpressure, never drop)
                 Latency: <1 second

P1 — HIGH:      Entity state transitions, work order updates
                 Delivery: MUST (queue during congestion, deliver in order)
                 Latency: <5 seconds

P2 — NORMAL:    Aggregated sensor readings, capacity updates
                 Delivery: SHOULD (drop oldest if queue exceeds 1000)
                 Latency: <60 seconds

P3 — LOW:       Analytics telemetry, diagnostic logs, heartbeats
                 Delivery: MAY (sliding window, latest-wins)
                 Latency: Best-effort
```

**NATS Subject Mapping for Priority**:

```
# NATS subject prefixes encode priority for leaf node traffic shaping:
#
# iiot.p0.alarms.{deviceId}           ← Critical alarms
# iiot.p1.entity.{entityType}.{id}    ← Entity events
# iiot.p2.readings.agg.{deviceId}     ← Aggregated readings
# iiot.p3.analytics.{metric}          ← Analytics telemetry
#
# Leaf node config uses NATS subject mapping to route priorities:
leafnodes {
  remotes [{
    url: "tls://hub-east.mfg-network.io:7422"
    # Export only high-priority subjects during congestion
    deny_exports: ["iiot.p3.>"]  # Drop analytics during bandwidth stress
  }]
}
```

### 15.10.5 Adaptive Sampling Rate Based on Bandwidth

T1 and T2 devices SHOULD implement adaptive sampling that adjusts the data
collection rate based on available upstream bandwidth:

```
Bandwidth Detection → Sampling Rate Adjustment
══════════════════════════════════════════════════

Normal (>1 Mbps):     Full rate (1 Hz), no aggregation
Degraded (100K-1M):   Reduce to 0.5 Hz, aggregate 30s windows
Constrained (10K-100K): Reduce to 0.1 Hz, aggregate 60s windows
Minimal (<10 Kbps):    Event-only (alarm + state changes), no telemetry

Detection Method:
  - NATS leaf node RTT to hub (measured every 30s)
  - JetStream outbound queue depth (if growing → congested)
  - System-level network throughput counter (/sys/class/net/*/statistics)
```

**Adaptive sampling MUST NOT affect**:
- Alarm detection sensitivity (local pipeline runs at full rate)
- Entity state transitions (always published immediately)
- JetStream local persistence (always at full rate)

Adaptive sampling ONLY affects the upstream publish rate to the hub. Local data
is always collected and persisted at full fidelity.

### 15.10.6 Bandwidth Budget per Tier

| Tier | Upstream Link | Budget (steady) | Budget (burst) | Savings Target |
|------|-------------|----------------|----------------|---------------|
| T1 | Cellular/WiFi (1-10 Mbps) | 10 KB/s | 100 KB/s | 95% reduction |
| T2 | Broadband (10-100 Mbps) | 100 KB/s | 1 MB/s | 90% reduction |
| T3 | Dedicated (100+ Mbps) | 10 MB/s | 100 MB/s | 0% (full fidelity) |

**Network-wide estimate with optimization**:

```
T1 (180K orgs × 10 KB/s):   1.8 GB/s aggregate → 155 TB/month
T2 (15K orgs × 100 KB/s):   1.5 GB/s aggregate → 130 TB/month
T3 (5K orgs × 10 MB/s):     50 GB/s aggregate  → 4.3 PB/month

Total hub ingestion: ~53 GB/s peak
Per hub (5 hubs):    ~10.6 GB/s — within 10GbE capacity
```

---

## 15.11 Offline Autonomy — Extended Patterns

### 15.11.1 T1 Offline: Buffer and Replay

When a T1 device loses hub connectivity:

1. **Local NATS continues**: All intra-org pub/sub operates normally
2. **JetStream buffers**: Readings persist to local file storage (1-day, 1 GB cap)
3. **Sparkplug adapter**: Continues bridging MQTT to local NATS without interruption
4. **Alarm detection**: Local AlarmDetector continues threshold evaluation
5. **No entity processing**: T1 does not run @effect/cluster (insufficient resources)

On reconnection:
- JetStream leaf node protocol replays buffered messages to hub
- Hub's JetStream mirror catches up with the org's stream
- Replay preserves per-subject ordering (G-1) automatically

### 15.11.2 T2 Offline: Full Local Operation

When a T2 device loses hub connectivity:

1. **All T1 capabilities** plus:
2. **Entity processing**: SingleRunner continues processing all 12 entity types
3. **EventDistribution**: 4-channel hub continues routing events locally
4. **WebSocket server**: T0 clients on local network continue receiving real-time data
5. **State persistence**: Entity state written to local SQLite, survives reboot
6. **Work order lifecycle**: Operators can create, approve, start, complete work orders

The T2 device is fully autonomous for all intra-org operations. The only
degradation is the absence of cross-org marketplace and network-level analytics.

### 15.11.3 T3 Offline: Autonomous Cluster with Peer-to-Peer

T3 deployments with multiple runner nodes operate as a fully autonomous cluster:

1. **All T2 capabilities** plus:
2. **Multi-runner HA**: If one runner node fails, shards rebalance to survivors
3. **3-replica JetStream**: Local HA for event persistence
4. **PostgreSQL HA**: Runner storage survives single-node failure
5. **Inter-site coordination**: T3 sites within the same org account can communicate
   directly via NATS gateway mesh (if sites have direct network connectivity)

**Peer-to-peer between T3 sites**:

```
Site A (T3) ←─── Direct NATS Gateway ───→ Site B (T3)
                 (WAN or VPN)

When hub is down but inter-site link is up:
  - Sites share entity state via account-scoped NATS subjects
  - Cross-site alarm routing continues
  - Cross-site work order coordination continues
  - Only marketplace and network analytics degrade
```

### 15.11.4 Reconciliation on Reconnect

The reconciliation protocol defined in Section 15.5 applies at all tiers.
Additional per-tier considerations:

**T1 Reconciliation**:
- Duration: typically <1 minute (small buffer, 1-day max)
- Conflict: none (no entity state to reconcile)
- Priority: readings first, then alarm events

**T2 Reconciliation**:
- Duration: 1-30 minutes depending on offline duration and buffer size
- Conflict: entity state reconciled via sequence numbers (edge wins)
- Priority: alarm events first, then entity state, then readings
- JetStream mirror catches up at network speed (not application-limited)

**T3 Reconciliation**:
- Duration: minutes to hours for extended offline (large JetStream backlog)
- Conflict: entity state reconciled via sequence numbers (edge wins)
- Priority: regulatory-critical events first (alarm audit trail, work order
  signatures), then entity state, then telemetry
- JetStream domain mirror uses consumer-based replay for ordered delivery
- Cloud MUST NOT reorder events during catch-up

---

## 15.12 Codebase Reference Map

| File | Key Lines | Purpose | Sections |
|---|---|---|---|
| `lib/holonet/nats/connection.ts` | 40-60 | NatsConnectionService — scoped lifecycle via `Effect.acquireRelease` | 15.1.2 |
| `lib/iiot/adapters/sparkplug-adapter.ts` | 56-68 | SparkplugAdapterConfig — broker URL, group IDs, auth credentials | 15.2.1 T1, 15.8.3 |
| `lib/iiot/adapters/sparkplug-adapter.ts` | 70-111 | AliasRegistry — metric alias resolution per edge node (F27.2) | 15.2.1 T1 |
| `lib/iiot/adapters/sparkplug-adapter.ts` | 125-132 | parseStateTopic — Sparkplug STATE topic parser (host app HA) | 15.2.1 T2 |
| `lib/iiot/adapters/sparkplug-adapter.ts` | 191-207 | makeStateRegistryKV — KV-backed host ONLINE/OFFLINE persistence | 15.2.1 T2/T3 |
| `lib/iiot/adapters/sparkplug-adapter.ts` | 358-371 | makeGroupConfigs — per-groupId SparkplugConfig derivation | 15.2.1 T1 |
| `lib/iiot/adapters/sparkplug-adapter.ts` | 383-386 | defaultRetrySchedule — exponential backoff, 10 retries (F27.1.3) | 15.9.4, 15.10 |
| `lib/iiot/adapters/sparkplug-adapter.ts` | 406-495 | SparkplugAdapterLive — Layer factory with per-group MQTT transport | 15.2.1, 15.4.3 |
| `lib/iiot/adapters/sparkplug-adapter.ts` | 512-595 | SparkplugAdapterKVLive — KV-backed state registry variant | 15.2.1 T2/T3 |
| `lib/iiot/adapters/ingestion-service.ts` | 124-167 | makeIngestionService — pipeline orchestration (subscribe → route → detect) | 15.2.1 T1/T2 |
| `lib/iiot/adapters/ingestion-service.ts` | 244-269 | IngestionPipelineDevLayer — dev/test convenience layer | 15.4.3 |
| `lib/iiot/adapters/ingestion-service.ts` | 297-322 | SparkplugPipelineLayer — production pipeline composition | 15.2.1, 15.4.4 |
| `lib/iiot/realtime/event-distribution.ts` | 41-70 | Event type schemas — ReadingEvent, AlarmEvent, EquipmentStateChange, CacheInvalidation | 15.6.3, 15.10.2 |
| `lib/iiot/realtime/event-distribution.ts` | 136-157 | CHANNELS constant — 4 channel definitions with IDs | 15.2.1 T2/T3 |
| `lib/iiot/realtime/event-distribution.ts` | 169-199 | Channel registration — ChannelBuilder with broadcast outlets and maxLag | 15.6.3 |
| `lib/iiot/realtime/event-distribution.ts` | 210-243 | PubSub → ChannelService inlet wiring | 15.6.3, 15.10.4 |
| `lib/iiot/realtime/event-distribution.ts` | 249-263 | Remote ingress daemons — NATS → local PubSub bridging | 15.3.3, 15.11 |
| `lib/iiot/realtime/event-distribution.ts` | 280-326 | Dual-write publish — local PubSub + HolonetBridge (fire-and-forget) | 15.5.1, 15.10.4 |
| `lib/iiot/realtime/holonet-bridge.ts` | 102-128 | Outbound publish — fire-and-forget to NATS with `Effect.ignoreLogged` | 15.2.1 T3, 15.10.4 |
| `lib/iiot/realtime/holonet-bridge.ts` | 136-182 | Inbound subscribe — wildcard NATS subscriptions yielding typed streams | 15.3.3 |
| `lib/iiot/realtime/iiot-subjects.ts` | 39-112 | 4 NATS subject specs — `iiot.readings.{deviceId}`, `iiot.alarms.{deviceId}`, etc. | 15.3.2, 15.10.4 |
| `lib/iiot/realtime/websocket-server.ts` | 68-92 | `Stream.unwrap` handler bridge for streaming RPCs | 15.4.2 T0 |
| `lib/iiot/realtime/websocket-server.ts` | 131-137 | IIoTRealtimeWsServer — WebSocket layer with JSON serialization | 15.2.1 T0, 15.4.6 |
| `lib/iiot/realtime/reactivity-bridge.ts` | 47-80 | ReactivityBridgeShape — handler-to-EventDistribution adapter | 15.11.2 |
| `lib/iiot/entity/EntityStack.ts` | 54-67 | EntityHandlersLayer — `Layer.mergeAll` of 12 entity handler layers | 15.4.4, 15.11.2 |
| `lib/iiot/entity/EntityStack.ts` | 90-93 | EntityTestingStack — in-memory state + disabled feature flags | 15.4.3 |
| `lib/iiot/entity/EntityStack.ts` | 113-115 | EntityProductionHandlersWithEvents — events enabled for production | 15.4.4 |
| `lib/iiot/entity/index.ts` | 1-161 | Entity barrel export — Alarm, Asset, Sensor, WorkOrder, EquipmentState | 15.4.4, 15.6.2 |
| `lib/iiot/state/` | (directory) | Per-entity state services — in-memory + SQL-backed dual implementations | 15.2.1 T2, 15.8.2 |
| `lib/iiot/adapters/alarm-detection.ts` | (module) | AlarmDetector — threshold-based violation detection | 15.10.3 |
| `lib/iiot/adapters/device-routing.ts` | (module) | TopicRouter — Sparkplug topic → device ID routing | 15.2.1 T1 |
| `lib/iiot/adapters/reading-processor.ts` | (module) | ReadingProcessor — route + batch via `groupedWithin` | 15.10.3 |

---

## 15.13 Open Questions

| ID | Question | Status | Impact | Recommendation |
|---|---|---|---|---|
| LO-E1 | NixOS ARM64 image size for T1 (RPi) | OPEN | MEDIUM | Minimal NixOS closure for ARM is ~200-400 MB. Verify that 32 GB microSD supports 3 NixOS generations + 1 GB JetStream. **Recommendation**: Target 8 GB for OS partitions, remaining for data. |
| LO-E2 | NATS leaf node buffer sizing during offline | OPEN | HIGH | When offline, leaf node buffers outbound messages in memory. If buffer exceeds available memory, messages are dropped. **Recommendation**: Configure `max_pending` per leaf node connection. T1: 32 MB. T2: 256 MB. T3: 2 GB. |
| LO-E3 | JetStream domain mirror catch-up rate | OPEN | MEDIUM | After extended offline (days), JetStream mirror catch-up may saturate upstream bandwidth. **Recommendation**: Implement rate-limited replay at 50% of available bandwidth, P0/P1 traffic unrestricted. |
| LO-E4 | Sparkplug adapter on ARM performance | OPEN | LOW | Protobuf decode + alias resolution on ARM64 at 1 MHz message rate untested. **Recommendation**: Benchmark on RPi 5 during Growth milestone. T1 target is 50-100 msg/sec, well within ARM capacity. |
| LO-E5 | Multi-site T3 NATS gateway mesh topology | OPEN | MEDIUM | Direct inter-site NATS gateways (peer-to-peer) vs hub-spoke (all via regional hub). **Recommendation**: Hub-spoke for MVP/Growth. Direct gateway for T3 orgs with >3 sites at Metro scale. |

---

## 15.14 References

### Normative

- [RFC2119] — Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels." BCP 14, RFC 2119, March 1997.
- [RFC8174] — Leiba, B. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words." BCP 14, RFC 8174, May 2017.
- [NATS-LEAFNODE] — Synadia Communications. "NATS Leaf Nodes." https://docs.nats.io/running-a-nats-service/configuration/leafnodes
- [NATS-ACCOUNTS] — Synadia Communications. "NATS Account-Based Security." https://docs.nats.io/running-a-nats-service/configuration/securing_nats/accounts
- [NATS-DECENTRALIZED] — Synadia Communications. "NATS Decentralized JWT Authentication." https://docs.nats.io/running-a-nats-service/configuration/securing_nats/auth_intro/jwt
- [NATS-JWT] — Synadia Communications. "In-Depth JWT Guide for NATS." https://docs.nats.io/running-a-nats-service/nats_admin/security/jwt
- [JETSTREAM] — Synadia Communications. "NATS JetStream." https://docs.nats.io/nats-concepts/jetstream
- [EFFECT-CLUSTER] — Effect Contributors. "@effect/cluster — Distributed Entity Management with Sharding."
- [ISA-18.2] — ANSI/ISA-18.2-2016 (IEC 62682). "Management of Alarm Systems for the Process Industries." ISA, 2016.

### Informative

- [NATS-ADAPTIVE-EDGE] — Synadia Communications. "Synadia Adaptive Edge Architecture — Scaling IoT with NATS Leaf Nodes."
- [NATS-EDGE-DEPLOY] — Synadia Communications. "NATS Adaptive Deployment Architectures — Hub-Spoke-Spoke for Edge."
- [NATS-RETAIL-EDGE] — Synadia Communications. "NATS for Retail: Manage Thousands of Nodes at the Edge."
- [NATS-IOT-SCALE] — Collison, B. "Rethinking Connectivity at the Edge: Scaling Fleets of Low-Powered Devices Using NATS.io."
- [OFFLINE-FIRST-IOT] — Ley, B. et al. "Offline-First IoT: Architectural Patterns for Intermittently Connected Edge Devices." IEEE IoT Journal, 2023.
- [IEC-62443] — IEC 62443. "Industrial Communication Networks — Network and System Security." IEC, 2018.
- [FDA-CFR11] — U.S. FDA, 21 CFR Part 11. "Electronic Records; Electronic Signatures."
- [SPARKPLUG-B] — Eclipse Foundation. "Eclipse Sparkplug Specification v3.0.0." 2023.
- [EFFECT-ENTITY] — Effect Contributors. "@effect/cluster/Entity — Cluster-Managed Entity Lifecycle."
- [EFFECT-LAYER] — Effect Contributors. "effect/Layer — Dependency Injection with Memoization and Scoping."
- [EFFECT-STREAM] — Effect Contributors. "effect/Stream — Pull-Based Reactive Stream with Backpressure."
- [EFFECT-PUBSUB] — Effect Contributors. "effect/PubSub — Bounded, Sliding, Dropping Broadcast Primitives."

### Internal Research & RFC Sections

- [TMNL-EFFECT-ARCH] — "Effect-TS Implementation Architecture." `rfc-section-effect-architecture.md`
- [TMNL-CONSISTENCY] — "Consistency Guarantees & Failure Modes." `rfc-section-consistency-guarantees.md`
- [TMNL-SECURITY] — "Security, Trust & Tenant Isolation." `rfc-section-security-trust.md`
- [TMNL-UNS] — "UNS Metropolitan Patterns." `research-uns-metropolitan.md`
- [TMNL-CLUSTER] — "@effect/cluster Distributed Entity Patterns." `research-cluster-patterns.md`
- [TMNL-MFG-COMMONS] — "Manufacturing Commons — Platform Economics." `research-manufacturing-commons.md`

---

*Section drafted 2026-02-09 by Val (edge-architect). Based on research-effect-architecture.md (Sections 1, 6), research-cluster-patterns.md (Sections 5, 6), research-uns-metropolitan.md (Sections 2, 6, 7), research-manufacturing-commons.md (Sections 7, 8), and 15+ codebase source files verified via Grep/Read.*

*End of RFC-001 Section 15: Edge-First Architecture*
