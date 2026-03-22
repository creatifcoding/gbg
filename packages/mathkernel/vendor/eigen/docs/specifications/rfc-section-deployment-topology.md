# RFC-001 Section 16: Deployment Topology

```
Section:       Deployment Topology
Parent RFC:    RFC-001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        Val (effect-specialist)
Created:       2026-02-09
Research Base: research-cluster-patterns.md (Sections 5, 6)
               research-effect-architecture.md (Sections 1, 6)
               research-uns-metropolitan.md (Sections 2, 6)
               rfc-section-edge-architecture-v2.md (Section 15)
               rfc-section-two-domain-consistency.md (Sections X.2-X.7)
               rfc-section-security-trust.md (Sections Z.3, Z.4)
```

> This section specifies the physical and logical deployment topology for the
> TMNL metropolitan manufacturing network: NATS cluster layout, @effect/cluster
> runner profiles, edge-cloud reconciliation protocol, upgrade paths between
> tiers, and multi-site expansion patterns.
>
> The edge-first design philosophy, capability tier model, and resource
> constraints are specified in the companion Section 15: Edge-First Architecture.
>
> File paths are relative to `packages/tmnl/src/`.

---

## Table of Contents

1. [Conventions](#161-conventions)
2. [NATS Topology for 200K Organizations](#162-nats-topology-for-200k-organizations)
3. [@effect/cluster Deployment Profiles](#163-effectcluster-deployment-profiles)
4. [Edge-Cloud Reconciliation Protocol](#164-edge-cloud-reconciliation-protocol)
5. [Upgrade and Migration Paths](#165-upgrade-and-migration-paths)
6. [Multi-Site Expansion](#166-multi-site-expansion)
7. [Capacity Planning](#167-capacity-planning)
8. [Database Architecture](#168-database-architecture)
9. [CDN and API Gateway](#169-cdn-and-api-gateway)
10. [Disaster Recovery](#1610-disaster-recovery)
11. [Codebase Reference Map](#1611-codebase-reference-map)
12. [References](#1612-references)

---

## 16.1 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

---

## 16.2 NATS Topology for 200K Organizations

### 16.2.1 Three-Level Hub-and-Spoke Architecture

The NATS deployment for 200,000 organizations MUST use a three-level
hub-and-spoke topology based on NATS leaf nodes [NATS-LEAFNODE]:

```
                    ┌─────────────────────────────┐
                    │      NATS Supercluster       │
                    │    (3-5 geographic DCs)       │
                    │                               │
                    │  ┌──────────────────────────┐ │
                    │  │ Gateway mesh:            │ │
                    │  │   DC-East ←──→ DC-West   │ │
                    │  │   DC-East ←──→ DC-South  │ │
                    │  │   DC-West ←──→ DC-South  │ │
                    │  └──────────────────────────┘ │
                    │                               │
                    │  System account:              │
                    │    manufacturing-commons       │
                    │    (marketplace, CRDTs,        │
                    │     network aggregates)        │
                    └────┬──────────┬──────────┬────┘
                         │          │          │
          ┌──────────────┘          │          └──────────────┐
          │                         │                         │
   ┌──────┴───────┐          ┌──────┴───────┐          ┌──────┴───────┐
   │  Hub: East    │          │  Hub: West    │          │  Hub: South   │
   │  (Atlanta)    │          │  (Dallas)     │          │  (Miami)      │
   │  3-node NATS  │          │  3-node NATS  │          │  3-node NATS  │
   │  cluster      │          │  cluster      │          │  cluster      │
   └──────┬───────┘          └──────┬───────┘          └──────┬───────┘
          │                         │                         │
    ┌─────┼─────┐             ┌─────┼─────┐             ┌─────┼─────┐
    │     │     │             │     │     │             │     │     │
   Leaf  Leaf  Leaf          Leaf  Leaf  Leaf          Leaf  Leaf  Leaf
   (T1)  (T2)  (T3)         (T1)  (T2)  (T3)         (T1)  (T2)  (T3)
   Earl  MfgCo BigAero      ...   ...   ...           ...   ...   ...
```

**Level 1 — Supercluster**: 3-5 geographically distributed data centers
connected via NATS gateway mesh [NATS-GATEWAY]. Hosts the `manufacturing-commons`
system account for cross-organization events, CRDT aggregates (G-Counter,
OR-Set, LWW-Register per [rfc-section-two-domain-consistency.md Section X.9]),
and marketplace data. Gateway routes are configured to propagate system account
subjects across all DCs.

**Level 2 — Regional Hub**: 3-node NATS clusters serving a metropolitan area
or geographic region. Each hub handles 10,000-50,000 organization leaf nodes.
Hub clusters run JetStream for cross-org stream aggregation and NATS KV for
network-level state. Hubs connect to the supercluster via gateway protocol.

**Level 3 — Organization Leaf Node**: Each organization's edge device
(T1/T2/T3) runs a NATS leaf node that connects to its nearest regional hub.
The leaf node provides local NATS pub/sub and JetStream within the
organization's account. Leaf nodes are transparent to the application layer —
services publish and subscribe to subjects as if connected to the hub directly.

### 16.2.2 NATS Account-per-Organization

Each organization MUST map to a dedicated NATS Account [NATS-ACCOUNTS] as
specified in [rfc-section-security-trust.md Section Z.3]. This is the primary
isolation and routing boundary.

```
Operator Key (platform root of trust, HSM-stored)
  │
  ├── Account: earl-machine-shop
  │     ├── User: earl-edge-001 (CNC gateway, T1)
  │     │     Permissions:
  │     │       Publish: iiot.readings.>, iiot.entity.>
  │     │       Subscribe: iiot.>, commons.notifications.earl-machine-shop.>
  │     └── User: earl-phone-001 (operator T0 device)
  │           Permissions:
  │             Publish: iiot.rpc.>
  │             Subscribe: iiot.entity.>, iiot.alarms.>
  │
  ├── Account: precision-machining-inc
  │     ├── User: pm-edge-001 (factory gateway, T2)
  │     ├── User: pm-edge-002 (secondary line, T2)
  │     └── User: pm-cloud-001 (cloud analytics)
  │
  ├── Account: aero-dynamics-corp
  │     ├── User: ad-edge-001 (plant-1 server, T3)
  │     ├── User: ad-edge-002 (plant-2 server, T3)
  │     └── User: ad-cloud-001 (analytics cluster)
  │
  └── Account: manufacturing-commons (system)
        ├── User: commons-aggregator
        └── User: commons-monitor
```

**Subject namespace isolation**: Within an account, subjects are invisible to
other accounts. `iiot.readings.*` in Earl's account is separate from
`iiot.readings.*` in Precision Machining's account. No collision, no leakage.

**Intra-org subjects do NOT include orgId**: Because accounts provide implicit
isolation, subjects within an account MUST NOT include the orgId prefix:

```
# WITHIN an org account (intra-org):
iiot.entity.{entityType}.{entityId}
iiot.readings.{siteId}.{deviceId}
iiot.alarms.{siteId}.{deviceId}

# ACROSS accounts (system account, cross-org):
commons.capacity.{orgId}
commons.marketplace.workorder.{workOrderId}
commons.reputation.{orgId}
```

This resolves the NATS subject inconsistency identified in
[review-effect-specialist-diff.md Section I-2]: intra-org subjects use the
two-domain consistency format (no orgId), cross-org subjects use explicit orgId.

### 16.2.3 Leaf Node Connection Protocol

The leaf node connection sequence for an edge device:

```
Step 1: Boot
  └─ Load NATS config + JWT from encrypted local storage
  └─ Validate JWT expiry (if expired: enter degraded mode, local-only)

Step 2: Start Local NATS
  └─ Start embedded NATS server in leaf node mode
  └─ Start local JetStream domain ({orgId}-edge-{deviceId})
  └─ Local pub/sub available immediately (no hub needed)

Step 3: Connect to Hub (async, non-blocking)
  └─ TLS 1.3 handshake to hub (nats://hub-east.network.io:7422)
  └─ JWT authentication (account + user)
  └─ Leaf node auto-subscribes to system imports:
       commons.notifications.{orgId}.>
  └─ Leaf node auto-exports per account config:
       capacity.available → manufacturing-commons
       health.{orgId}.metrics → manufacturing-commons (opt-in)

Step 4: Start Application Services
  └─ SparkplugAdapterLive (MQTT → NATS bridge)
  └─ ReadingProcessor + AlarmDetector
  └─ @effect/cluster SingleRunner (T2+) or SocketRunner (T3)
  └─ WebSocket server for T0 clients

Step 5: Normal Operation
  └─ Intra-org traffic stays local (leaf node ↔ local NATS)
  └─ Cross-org traffic routes: leaf → hub → supercluster
  └─ JetStream mirrors to cloud domain (continuous)
```

**Critical property**: Steps 1-2 and 4 do NOT depend on Step 3. If the hub is
unreachable, the edge device enters fully operational local mode. Step 3
completes asynchronously when connectivity is restored.

### 16.2.4 Hub Capacity Planning

Each regional hub cluster MUST be sized for its expected leaf node count:

| Hub Size | Nodes | Leaf Nodes | Accounts | Cross-Org Events/sec | JetStream |
|----------|-------|-----------|----------|---------------------|-----------|
| Small | 3 | 1,000-5,000 | 1,000-5,000 | ~50-250 | 500 GB |
| Medium | 5 | 5,000-20,000 | 5,000-20,000 | ~250-1,000 | 2 TB |
| Large | 7 | 20,000-50,000 | 20,000-50,000 | ~1,000-2,500 | 5 TB |
| XLarge | 9 | 50,000-100,000 | 50,000-100,000 | ~2,500-5,000 | 10 TB |

At 200K organizations with 3-5 hubs, each hub serves 40K-67K leaf nodes
(Large to XLarge configuration).

**Hub resource requirements** (per node in a 7-node Large cluster):

| Resource | Value | Rationale |
|----------|-------|-----------|
| CPU | 16 cores | NATS is CPU-bound for message routing |
| RAM | 64 GB | JetStream page cache + connection state |
| Storage | 2 TB NVMe | JetStream file storage |
| Network | 10 GbE | Leaf node fan-in + gateway traffic |

### 16.2.5 JetStream Stream Configuration per Level

**Leaf Node (per-org) Streams**:

```
# Telemetry — high volume, short retention
Stream:     ORG_TELEMETRY
Subjects:   iiot.readings.>
MaxAge:     Tier-dependent (T1: 1d, T2: 30d, T3: 1yr)
MaxBytes:   Tier-dependent (T1: 1GB, T2: 50GB, T3: 500GB)
Storage:    File
Replicas:   1 (T1/T2), 3 (T3 cluster)
Discard:    Old (drop oldest when MaxBytes reached)

# Entity Events — regulatory retention
Stream:     ORG_ENTITY_EVENTS
Subjects:   iiot.entity.>
MaxAge:     Tier-dependent (T1: 30d, T2: 1yr, T3: 7yr)
MaxBytes:   Tier-dependent (T1: 100MB, T2: 5GB, T3: 50GB)
Storage:    File
Replicas:   1 (T1/T2), 3 (T3 cluster)
DenyPurge:  true (T2+, regulatory compliance)
DenyDelete: true (T2+, regulatory compliance)

# Alarms — ISA-18.2 retention
Stream:     ORG_ALARMS
Subjects:   iiot.alarms.>
MaxAge:     Tier-dependent (T1: 30d, T2: 1yr, T3: 7yr)
MaxBytes:   Tier-dependent (T1: 50MB, T2: 2GB, T3: 20GB)
Storage:    File
DenyPurge:  true (all tiers — alarm records are always regulatory)
DenyDelete: true
```

**Hub (regional) Streams**:

```
# Cross-org marketplace events
Stream:     COMMONS_MARKETPLACE
Subjects:   commons.marketplace.>
MaxAge:     90 days
MaxBytes:   100 GB
Storage:    File
Replicas:   3

# Organization health metrics (opt-in)
Stream:     COMMONS_HEALTH
Subjects:   commons.health.>
MaxAge:     30 days
MaxBytes:   50 GB
Storage:    File
Replicas:   3

# KV: Network capacity (CRDT substrate)
Bucket:     NETWORK_CAPACITY
Key Pattern: capacity.{orgId}
History:    5
TTL:        5 minutes (stale org detection)

# KV: Capability registry (CRDT substrate)
Bucket:     NETWORK_CAPABILITIES
Key Pattern: capabilities.{orgId}
History:    3
TTL:        1 hour
```

**Supercluster Streams**:

```
# Global marketplace mirror (aggregated from all hubs)
Stream:     GLOBAL_MARKETPLACE
Subjects:   commons.marketplace.>
MaxAge:     1 year
Storage:    File
Replicas:   5 (across DCs)
Sources:    Mirrored from all hub COMMONS_MARKETPLACE streams

# Global health (aggregated, for platform operations)
Stream:     GLOBAL_HEALTH
Subjects:   commons.health.>
MaxAge:     90 days
Storage:    File
Replicas:   3
```

---

## 16.3 @effect/cluster Deployment Profiles

### 16.3.1 Profile Matrix

Each edge tier maps to a specific @effect/cluster deployment profile. These
profiles are verified against the transport options documented in
[research-cluster-patterns.md Section 5].

| Tier | Runner Module | Transport | RunnerStorage | Health Check |
|------|-------------|-----------|--------------|-------------|
| T0 | None (client-only) | WebSocket (RpcClient) | N/A | N/A |
| T1 | SingleRunner (optional) | In-process | SQLite (local) | Local only |
| T2 | SingleRunner + SQL | In-process | SQLite or PostgreSQL | Local + hub |
| T3 | SocketRunner cluster | TCP Socket binary | PostgreSQL | Full cluster |
| Cloud | HttpRunner cluster | HTTP + WebSocket | PostgreSQL | Full cluster |

### 16.3.2 T0 Profile: Client-Only (No Cluster)

T0 devices connect as WebSocket RPC clients. No cluster Layer is needed:

```typescript
// T0: Browser or mobile app
import { RpcClient } from "@effect/rpc"

const client = yield* RpcClient.make(IIoTRpcs, {
  transport: RpcClientProtocolWebsocket({
    url: "wss://edge-gateway.local/ws/iiot"
    // OR: "wss://cloud.mfg-network.io/ws/iiot"
  })
})

// Read-only operations
const stream = yield* client.Realtime.SubscribeEntityChanges({
  entityTypes: ['Machine', 'Alarm'],
  isaLevels: ['L1', 'L2'],
})

// Alarm acknowledgment (write via RPC)
yield* client.Alarm.Acknowledge({
  alarmId: 'ALM-001',
  operatorId: 'earl',
})
```

### 16.3.3 T1 Profile: Minimal SingleRunner

T1 devices MAY run SingleRunner for basic entity processing:

```typescript
// T1: Raspberry Pi with SQLite
import { SingleRunner } from "@effect/cluster"
import { SqliteClient } from "@effect/sql-sqlite-bun"

const T1ClusterLayer = Layer.mergeAll(
  SingleRunner.layer,
  SqliteClient.layer({ filename: "/data/cluster.db" }),
  ShardingConfig.layer({
    shardsPerGroup: 10,
    maxIdleTime: Duration.minutes(5),  // Aggressive reaping for low RAM
    entityTerminationTimeout: Duration.seconds(5),
  }),
)

// Register only essential entity types (5 of 12)
const T1EntityLayer = Layer.mergeAll(
  MachineEntity.toLayer(makeMachineHandlers),
  DeviceEntity.toLayer(makeDeviceHandlers),
  SensorEntity.toLayer(makeSensorHandlers),
  AlarmEntity.toLayer(makeAlarmHandlers),
  EquipmentStateEntity.toLayer(makeEquipmentStateHandlers),
)
```

**Shard math**: 1 shard group x 10 shards = 10 total shards. With max 50
entities, ~5 entities/shard. SingleRunner processes all shards in-process —
no network transport.

### 16.3.4 T2 Profile: Full SingleRunner with Entity Stack

T2 devices MUST run SingleRunner with the complete entity processing stack:

```typescript
// T2: Industrial gateway with SQLite/PostgreSQL
const T2ClusterLayer = Layer.mergeAll(
  SingleRunner.layer,
  SqliteClient.layer({ filename: "/data/cluster.db" }),
  ShardingConfig.layer({
    shardsPerGroup: 50,
    maxIdleTime: Duration.minutes(2),
    entityTerminationTimeout: Duration.seconds(10),
  }),
)

// Full entity processing — all 12 types
const T2ApplicationLayer = T2ClusterLayer.pipe(
  Layer.provideMerge(EntityHandlersLayer),   // 12 entity types
  Layer.provideMerge(EventDistributionLayer), // 4+ channels
  Layer.provideMerge(SparkplugPipelineLayer({ sparkplug: config })),
  Layer.provideMerge(WebSocketServerLayer),   // T0 client serving
)
```

**Shard math**: 3 shard groups x 50 shards = 150 total shards. With max 500
entities, ~3.3 entities/shard.

**Shard group selection**: T2 uses 3 of the 5 shard groups:
- `asset-hierarchy` (Site, Plant, Area, Line, WorkCell) — moderate churn
- `equipment` (Machine, Device, Sensor) — high churn
- `operational` (Alarm, WorkOrder, EquipmentState) — event-sourced

The `org-identity` group is omitted (single org, no need). The `telemetry` group is
omitted (sensor readings handled by ingestion pipeline, not entity actors).

### 16.3.5 T3 Profile: Multi-Runner SocketRunner Cluster

T3 deployments MUST use SocketRunner for multi-node distribution:

```typescript
// T3: Multi-node cluster with PostgreSQL
import { SocketRunner } from "@effect/cluster"

const T3ClusterLayer = Layer.mergeAll(
  SocketRunner.layer({ host: "0.0.0.0", port: 34437 }),
  PgClient.layer({
    host: "cluster-db.local",
    database: "cluster",
    pool: { min: 5, max: 20 },
  }),
  ShardingConfig.layer({
    shardsPerGroup: 300,
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

**Runner topology**: T3 deployments SHOULD run 3+ runner nodes. The runner
`weight` parameter controls shard proportionality
[research-cluster-patterns.md Section 5.4]:

```
Runner 1 (primary):    weight=2 → ~60% of shards (900 of 1,500)
Runner 2 (secondary):  weight=1 → ~20% of shards (300 of 1,500)
Runner 3 (secondary):  weight=1 → ~20% of shards (300 of 1,500)
```

When a runner joins or leaves, `HashRing` recomputes shard assignments.
Shard migration causes a ~15-second silence window per affected entity
[research-cluster-patterns.md Section 1.3].

### 16.3.6 Cloud Profile: HttpRunner Cluster

Cloud deployments serving organizations without local edge processing use
HttpRunner:

```typescript
// Cloud: HTTP-based inter-runner communication
import { HttpRunner } from "@effect/cluster"

const CloudClusterLayer = Layer.mergeAll(
  HttpRunner.layerHttp,
  PgClient.layer({
    host: "cluster-db.internal",
    database: "cluster",
    pool: { min: 10, max: 50 },
  }),
  ShardingConfig.layer({
    shardsPerGroup: 300,
    entityTerminationTimeout: Duration.seconds(15),
  }),
)
```

Cloud clusters MUST also expose the WebSocket server for T0 clients and
the HTTP API for MES/ERP integration.

---

## 16.4 Edge-Cloud Reconciliation Protocol

### 16.4.1 Offline Operation Model

When an edge device loses cloud connectivity, the system enters a two-phase
model:

```
PHASE 1: ONLINE (Normal)
═════════════════════════
  Events ──► Local NATS ──► Leaf Node ──► Hub ──► Supercluster
  JetStream mirror: continuous
  Cross-org exports: real-time
  CRDT updates: live

PHASE 2: OFFLINE
════════════════
  Events ──► Local NATS ──► Local JetStream (persisted)
  Leaf Node: disconnected (outbound buffer accumulates)
  Cross-org exports: queued in leaf outbound buffer
  CRDT updates: stale (org entry ages toward TTL)

PHASE 3: RECONNECTING
═════════════════════
  Leaf Node: re-establishes TLS + JWT auth
  Subscriptions: auto-restored
  Outbound buffer: drained (queued messages delivered to hub)
  JetStream mirror: catches up (per-entity ordered)
  CRDT updates: refreshed (org entry updated, OrgStale cleared)
```

### 16.4.2 Reconnection Sequence (Detailed)

Upon detecting connectivity restoration, the following sequence executes:

**Step 1 — Transport reconnection** (automatic, NATS library):
- Leaf node protocol re-establishes TLS 1.3 handshake
- JWT re-validated by hub server
- If JWT expired: connection rejected → device operates in degraded local mode
  until new JWT provisioned

**Step 2 — Subscription restoration** (automatic, NATS library):
- All imported subjects re-subscribed
- All exported subjects re-advertised
- Queued outbound messages begin draining

**Step 3 — JetStream domain sync** (automatic, JetStream mirror):
- Local domain begins streaming queued messages to cloud mirror
- Messages delivered in per-entity sequential order (G-1 preserved)
- Cloud domain receives events with original `originTimestamp` plus new
  `networkTimestamp` reflecting actual ingestion time
- Mirror lag metric tracks catchup progress

**Step 4 — Cross-org event delivery** (automatic, via export):
- Capacity updates, marketplace events delivered from outbound buffer
- Events that aged beyond the 60-second G-8 staleness window are still
  delivered but carry stale `originTimestamp`
- Consumers SHOULD use `networkTimestamp` for cross-org ordering

**Step 5 — Stale org advisory clearance**:
- If org was offline > 5 minutes (CRDT TTL), hub emitted `OrgStale` advisory
- On reconnection: CRDT entry refreshed, `OrgStale` advisory cleared
- Network aggregates converge to include the org's current values

**Step 6 — Sequence gap detection** (application layer):
- Cloud domain compares expected vs received sequence numbers per entity
- Gaps indicate events lost during offline (JetStream overflow on edge)
- `SequenceGapDetected` event logged with gap range
- No automatic gap filling — edge JetStream is authoritative (E-1)

### 16.4.3 Conflict Resolution Rules

| Data Type | Authority | Mechanism |
|-----------|----------|-----------|
| Sensor readings | Edge (`originTimestamp`) | Physical measurement at edge |
| Entity state | Edge (sequence number) | Entity actor runs on edge |
| Alarm lifecycle | Edge (ISA-18.2 timestamp) | Safety-critical, local authority |
| Work order state | Edge (sequence number) | Local processing authority |
| Cross-org capacity | Cloud (`networkTimestamp`) | Network view = cloud authority |
| Marketplace events | Cloud (`networkTimestamp`) | Marketplace is cloud service |
| Network aggregates | Cloud (CRDT merge) | CRDTs converge without conflict |

**No split-brain**: Entity actors run exclusively on the edge device. The cloud
receives event notifications, not entity RPCs. There is no cloud-side entity
state to conflict with. Split-brain is architecturally impossible for
intra-org data. This is a direct consequence of E-1 (Edge Sovereignty).

---

## 16.5 Upgrade and Migration Paths

### 16.5.1 T1 to T2 Upgrade

**When**: Organization outgrows T1 (>50 entities, needs entity processing,
requires 30-day retention, wants full alarm management).

**Phase 1 — Hardware Migration** (1 day):
1. Provision T2 hardware alongside existing T1 (parallel operation)
2. Configure T2 with same NATS account credentials (same JWT)
3. Stop services on T1
4. Start NATS leaf node on T2 (same account, different user JWT)
5. Migrate Sparkplug adapter configuration from T1 to T2
6. T1 decommissioned or repurposed as backup

**Phase 2 — Capability Activation** (1-2 days):
1. Enable @effect/cluster SingleRunner with SQLite
2. Deploy EntityHandlersLayer with 3 shard groups (`asset-hierarchy`, `equipment`, `operational`)
3. Enable EventDistribution with 4 channels
4. Expand JetStream retention: MaxAge → 30 days, MaxBytes → 50 GB
5. Enable WebSocket server for T0 clients

**Phase 3 — Validation** (1 week):
1. Verify entity state processing (all 12 types)
2. Verify alarm detection and lifecycle management
3. Verify T0 dashboard connectivity
4. Verify cloud mirror (if connected)

**Data migration**: JetStream streams from T1 are NOT migrated. Entity state
is reconstructed from current NATS KV values or from first incoming messages.
Historical data older than T1 retention (1 day) is lost — acceptable for
small deployments transitioning to longer retention.

### 16.5.2 T2 to T3 Upgrade

**When**: Organization outgrows T2 (>500 entities, needs HA, requires 1-year
retention, wants ML inference).

**Phase 1 — Infrastructure** (1-2 weeks):
1. Deploy T3 server hardware or VM cluster (3+ nodes)
2. Install PostgreSQL for RunnerStorage (replaces SQLite)
3. Deploy 3-node NATS cluster (replaces single-node NATS)
4. Configure JetStream with 3 replicas
5. Migrate NATS leaf node config to cluster mode

**Phase 2 — Cluster Migration** (2-3 days):
1. Deploy @effect/cluster SocketRunner on first T3 node
2. Configure 5 shard groups (`org-identity`, `marketplace`, `asset-hierarchy`, `equipment`, `operational`) with `ClusterSchema.ShardGroup` annotations
3. Start runner on node 1 — all shards assigned to this runner
4. Start runner on node 2 — HashRing rebalances ~33% of shards
5. Start runner on node 3 — HashRing rebalances to ~33% each
6. Verify entity processing continues during rebalance

**Phase 3 — Data Migration** (1-3 days):
1. JetStream streams migrated via NATS stream export/import
2. RunnerStorage migrated from SQLite to PostgreSQL via dump/restore
3. Retention extended: Entity events → 7 years, telemetry → 1 year
4. DenyPurge and DenyDelete enabled for regulatory streams

### 16.5.3 Growth Timeline

Typical organization growth path:

| Stage | Duration | Tier | Entities | Monthly Cost |
|-------|---------|------|----------|-------------|
| Pilot | Month 1-3 | T1 | 5-20 | $5-15 (hardware amortized) |
| Adoption | Month 3-12 | T1/T2 | 20-100 | $50-150 |
| Production | Year 1-3 | T2 | 100-500 | $150-500 |
| Enterprise | Year 3+ | T3 | 500-5,000+ | $500-5,000+ |

The platform MUST NOT require organizations to start at T2 or T3. The T1
entry point at $50-200 hardware cost is essential for manufacturing commons
participation (the Earl Test).

---

## 16.6 Multi-Site Expansion

### 16.6.1 Single-Account Multi-Site Pattern

Organizations with multiple physical sites SHOULD deploy one edge device per
site, all sharing the same NATS account:

```
Organization: Aero Dynamics Corp (Account: aero-dynamics-corp)

  Plant 1 (T3 server) ── Leaf Node ──┐
                                      ├──► Hub East ──► Supercluster
  Plant 2 (T2 gateway) ── Leaf Node ──┤
                                      │
  Plant 3 (T1 RPi)    ── Leaf Node ──┘

Shared account subjects:
  iiot.entity.Machine.MCH-001    (Plant 1)
  iiot.entity.Machine.MCH-050    (Plant 2)
  iiot.readings.P1.*             (Plant 1 telemetry)
  iiot.readings.P2.*             (Plant 2 telemetry)
  iiot.readings.P3.*             (Plant 3 telemetry)
```

### 16.6.2 Cross-Site Visibility

Within a single account, all leaf nodes receive each other's subjects
(after hub routing). This enables:

- **Corporate dashboard**: T0 device subscribes to `iiot.entity.>` across
  all sites
- **Cross-site alarm aggregation**: Subscribe to `iiot.alarms.>` for
  enterprise-wide alarm management
- **OEE comparison**: Subscribe to OEE events from all production lines

### 16.6.3 Cross-Site Entity Distribution

For organizations with T3 at one site and T2/T1 at others, entity processing
can be centralized:

```
Pattern: Hub-and-Spoke Entity Processing

  Plant 1 (T3) ── Runs @effect/cluster for ALL sites
    ├── Processes entities for Plant 1 (local)
    ├── Processes entities for Plant 2 (via NATS subjects)
    └── Processes entities for Plant 3 (via NATS subjects)

  Plant 2 (T2) ── Runs ingestion only, no entity cluster
    └── SparkplugAdapter → publishes to shared account subjects

  Plant 3 (T1) ── Runs ingestion only
    └── SparkplugAdapter → publishes to shared account subjects
```

**Trade-off**: Centralizing entity processing at one T3 site means Plants 2
and 3 lose entity processing during Plant 1's downtime. For HA-critical
organizations, each site SHOULD run its own entity cluster.

### 16.6.4 Hierarchical Site Subjects

Multi-site organizations SHOULD use site-scoped subjects for efficient
filtering:

```
# Site-scoped subject pattern
iiot.readings.{siteId}.{areaId}.{deviceId}
iiot.entity.{siteId}.{entityType}.{entityId}
iiot.alarms.{siteId}.{areaId}.{deviceId}

# Wildcard subscriptions
iiot.readings.PLANT-1.>          ← All telemetry from Plant 1
iiot.entity.PLANT-2.Machine.*    ← All machine events from Plant 2
iiot.alarms.>                    ← All alarms across all sites
```

---

## 16.7 Capacity Planning

### 16.7.1 Network-Wide Estimates

| Metric | Per-Org Average | 200K Orgs Total |
|--------|----------------|-----------------|
| Active entities | ~71 | ~14.2M |
| Concurrent entities (1-5%) | ~1-4 | ~140K-710K |
| Sensor readings/sec | ~5-50 | ~1M-10M |
| Entity events/day | ~43 | ~8.6M |
| Cross-org events/day | ~0.5 | ~100K |
| JetStream per-org | ~2 GB | ~400 TB (cloud mirrors) |
| WebSocket connections/org | ~2-5 | ~400K-1M |

### 16.7.2 Scaling Triggers

| Trigger | Current | Action |
|---------|---------|--------|
| Hub leaf nodes > 50K | Large hub | Deploy additional hub, rebalance |
| Entity events/sec > 1K/hub | Large hub | Scale JetStream nodes |
| Supercluster latency > 100ms | 3 DCs | Add DC in affected region |
| WebSocket connections > 100K/hub | Cloud tier | Add WebSocket server nodes |
| RunnerStorage queries > 10K/sec | PostgreSQL | Read replicas |

---

## 16.8 Database Architecture

The manufacturing commons relies on a dual-engine PostgreSQL deployment that serves
both time-series telemetry and graph-structured asset relationships from a single
database instance per organization. This section specifies the storage engine
selection, schema isolation model, data lifecycle policies, and per-tier deployment
profiles for the TMNL data layer.

### 16.8.1 Dual-Engine Design

The TMNL database image extends TimescaleDB HA (PostgreSQL 16, TimescaleDB 2.17)
with two critical extensions:

```
┌─────────────────────────────────────────────────────┐
│                PostgreSQL 16                        │
│                                                     │
│  ┌─────────────────┐   ┌─────────────────────────┐  │
│  │   TimescaleDB    │   │     Apache AGE 1.5      │  │
│  │                  │   │                         │  │
│  │ - Hypertables    │   │ - iiot_graph            │  │
│  │ - Continuous     │   │ - Cypher queries        │  │
│  │   aggregates     │   │ - Asset hierarchy       │  │
│  │ - Compression    │   │ - Event causality       │  │
│  │ - Retention      │   │ - [:contains]           │  │
│  │   policies       │   │ - [:monitors]           │  │
│  └─────────────────┘   └─────────────────────────┘  │
│                                                     │
│  ┌─────────────────┐   ┌─────────────────────────┐  │
│  │    pg_lake       │   │  pg_stat_statements     │  │
│  │  (optional)      │   │  btree_gist             │  │
│  │ DuckDB/Iceberg   │   │  Query monitoring       │  │
│  └─────────────────┘   └─────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Time-series engine (TimescaleDB)**. Implementations MUST use TimescaleDB
hypertables for all sensor reading storage. Raw sensor data is chunked by 7-day
intervals with 4-way hash partitioning on `device_id` for high-cardinality
workloads [KLEPPMANN, Ch. 6]. Continuous aggregates at 1-minute, 1-hour, and
1-day granularity provide pre-computed roll-ups without scan overhead.

**Graph engine (Apache AGE)**. Implementations MUST use Apache AGE for the
ISA-95 asset hierarchy and event causality chains. The graph `iiot_graph`
stores plant, line, machine, and sensor nodes connected by `[:contains]` and
`[:monitors]` relationships [ISA-95-1]. Cypher queries enable recursive
traversal: "find all sensors on machines in Plant A" without N+1 joins.

**Analytics engine (pg_lake, OPTIONAL)**. When available, pg_lake enables
Iceberg table format access via DuckDB, allowing cold analytical queries against
S3/MinIO-stored historical data without loading into hot storage.

### 16.8.2 Schema Isolation Model

The manufacturing commons supports 200,000+ organizations. The database
architecture uses a **single-schema, account-scoped** model rather than
schema-per-tenant:

```
Approach: Single schema with account scoping
─────────────────────────────────────────────

  iiot.sensor_readings
  ┌──────────────────────────────────────────────┐
  │ time     │ device_id     │ value  │ quality  │
  ├──────────┼───────────────┼────────┼──────────┤
  │ 12:00:01 │ TMP-001       │ 24.3   │ 100      │  ← Org A
  │ 12:00:01 │ TMP-001       │ 31.2   │ 100      │  ← Org B (different NATS account)
  └──────────┴───────────────┴────────┴──────────┘

  Isolation enforcement:
  ┌───────────────────────────────────────────────┐
  │ L1: NATS account-per-org        (network)     │
  │ L2: JetStream domain-per-org    (stream)      │
  │ L3: PostgreSQL per-org instance (T2+) or      │
  │     embedded SQLite (T1)         (storage)     │
  │ L4: RLS policies on cloud-tier  (query)       │
  └───────────────────────────────────────────────┘
```

**T0 (Phone) and T1 (SBC)**. No local PostgreSQL instance. Sensor data is
buffered in NATS JetStream (T1) or device memory (T0) and mirrored to the
cloud-tier database upon connectivity. T1 devices MAY use embedded SQLite for
local retention when JetStream storage is insufficient.

**T2 (Gateway) and T3 (Server)**. Each organization runs its own PostgreSQL
instance with TimescaleDB. The `iiot` schema namespace is private to that org.
No cross-org queries are possible at the database level — isolation is
structural, not policy-based.

**Cloud tier (Hub)**. Hub databases serve organizations that lack edge
PostgreSQL (T0/T1 orgs). Cloud instances MUST use PostgreSQL Row-Level Security
(RLS) policies scoped to `org_id` for any shared-database deployments.
Implementations SHOULD prefer per-org database instances where
operationally feasible.

### 16.8.3 Time-Series Data Lifecycle

Sensor readings follow a tiered lifecycle from hot to cold storage:

```
INGEST (real-time)                    AGGREGATE            COMPRESS        ARCHIVE
─────────────────                     ─────────            ────────        ───────
sensor_readings                       readings_1min        (compressed)    pg_lake
(hypertable)                          readings_1hour       chunks          Iceberg
                                      readings_1day

 ┌────────┐  7-day    ┌──────────┐  1-min    ┌──────────┐  30-day   ┌──────────┐
 │  RAW   │──chunks──▶│ 1-MIN    │──refresh─▶│ 1-HOUR   │──compress▶│ ARCHIVE  │
 │ data   │           │ cagg     │           │ cagg     │           │ (cold)   │
 └────────┘           └──────────┘           └──────────┘           └──────────┘
      │                     │                     │
      │ 2yr retention       │ 1yr retention       │ 5yr retention
      ▼                     ▼                     ▼
   [DROP]               [DROP]                 [DROP]

 readings_1day: RETAINED FOREVER (no drop policy)
```

| Data Layer | Chunk Interval | Compression | Retention | Tier Availability |
|------------|---------------|-------------|-----------|-------------------|
| `sensor_readings` | 7 days | After 30 days (segmentby=device_id) | 2 years | T2, T3, Cloud |
| `readings_1min` | Auto | After 90 days | 1 year | T2, T3, Cloud |
| `readings_1hour` | Auto | None | 5 years | T3, Cloud |
| `readings_1day` | Auto | None | Forever | Cloud |
| Iceberg (pg_lake) | N/A | Columnar | 7+ years [FDA-CFR11] | Cloud |

**Regulatory compliance**. For organizations subject to FDA 21 CFR Part 11 or
equivalent GxP regulations, the 1-day aggregate layer MUST be retained for a
minimum of 7 years. Implementations MUST support immutable audit trails via
the EventJournal (append-only event log) for regulatory inspection
[FDA-CFR11].

### 16.8.4 Graph Database Schema

The Apache AGE graph models the ISA-95 equipment hierarchy as a property graph:

```
Node Labels                      Edge Labels
──────────                       ───────────
:enterprise                      [:contains]    — Hierarchical ownership
:site                            [:monitors]    — Sensor→Machine observation
:area                            [:triggered_by] — Alarm→Sensor causality
:plant                           [:caused]      — Alarm→Alarm cascade chain
:line
:machine
:sensor
```

**Hierarchy traversal**. Cypher queries on `iiot_graph` enable efficient
multi-hop traversal for operations like "find all sensors in alarm state
within Plant A":

```sql
SELECT * FROM cypher('iiot_graph', $$
    MATCH (p:plant {id: 'PLANT-A'})-[:contains*]->(asset)
    RETURN labels(asset)[0] AS type, asset.id AS id, asset.name AS name
$$) AS (type agtype, id agtype, name agtype);
```

**Per-tier graph deployment**:

| Tier | Graph Engine | Scope |
|------|-------------|-------|
| T0 | None | No local graph — uses cloud mirror |
| T1 | NATS KV flat keys | `host.{id}` keys for asset registry, no traversal |
| T2 | Apache AGE (local PG) | Full ISA-95 graph, org-scoped |
| T3 | Apache AGE (local PG) | Full graph + cross-org references via marketplace |
| Cloud | Apache AGE (hub PG) | Supergraph for network-wide analytics |

### 16.8.5 Per-Tier Database Profiles

| Characteristic | T1 (SBC) | T2 (Gateway) | T3 (Server) | Cloud (Hub) |
|----------------|----------|-------------|------------|------------|
| **Engine** | SQLite / NATS KV | PostgreSQL 16 + TS + AGE | PostgreSQL 16 + TS + AGE + pg_lake | PostgreSQL 16 + TS + AGE + pg_lake |
| **RAM budget** | 64-128 MB | 512 MB-2 GB | 4-16 GB | 32-128 GB |
| **Disk budget** | 2-8 GB (SD card) | 50-200 GB (SSD) | 500 GB-4 TB (NVMe) | 10+ TB (EBS/NVMe) |
| **Max sensors** | 1-10 | 10-200 | 200-5,000 | 50,000+ (per hub) |
| **Raw retention** | 1 day (NATS buffer) | 30 days | 2 years | 2 years + cold archive |
| **Cagg layers** | None | 1-min only | 1-min, 1-hour | 1-min, 1-hour, 1-day |
| **Graph** | NATS KV flat | AGE local | AGE local | AGE hub supergraph |
| **Backup** | NATS mirror to cloud | pg_basebackup to NFS/S3 | Streaming replication + pg_basebackup | Multi-AZ replication |

### 16.8.6 Schema Migration Strategy

All schema DDL is managed by Effect SQL Migrator [EFFECT-TS], NOT by
Docker init scripts. The migration registry at
`lib/iiot/models/_migrations.ts` defines the ordered migration sequence:

```
Migration Order:
  1. _infrastructure.ddl.ts    — Extensions, schema, graph creation
  2. _functions.ddl.ts         — Helper functions (generate_ulid, etc.)
  3. _graph-seed.ddl.ts        — Seed asset hierarchy nodes + edges
  4. assets/*.ddl.ts           — Asset relational tables
  5. readings/*.ddl.ts         — Hypertables + continuous aggregates
  6. alarms/*.ddl.ts           — Alarm context tables
  7. equipment-state/*.ddl.ts  — Equipment state tracking
  8. work-orders/*.ddl.ts      — Work order lifecycle
  9. _event-journal.ddl.ts     — Append-only event journal
```

Implementations MUST run migrations via `PgMigrator.layer` from `@effect/sql-pg`.
Init.sql is intentionally minimal — it only verifies user context. This
separation ensures identical schema across all PostgreSQL tiers (T2, T3, Cloud)
regardless of how the database instance is provisioned.

---

## 16.9 CDN and API Gateway

The manufacturing commons requires a multi-layer ingress architecture that
handles both traditional HTTP/REST traffic and persistent WebSocket connections
for realtime event streams. This section specifies the gateway topology,
connection management, and geographic load balancing for the Atlanta
metropolitan deployment.

### 16.9.1 Gateway Architecture

```
                     ┌──────────────────────────────┐
                     │        Cloudflare CDN         │
                     │   (static assets, WAF, DDoS)  │
                     └──────────────┬───────────────┘
                                    │
                     ┌──────────────▼───────────────┐
                     │     Geographic DNS (Route 53)  │
                     │  atl-east.tmnl.io              │
                     │  atl-west.tmnl.io              │
                     │  atl-central.tmnl.io           │
                     └──────────────┬───────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
     ┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
     │  L7 Gateway      │  │  L7 Gateway      │  │  L7 Gateway      │
     │  (Envoy/Traefik) │  │  (Envoy/Traefik) │  │  (Envoy/Traefik) │
     │  ATL-EAST        │  │  ATL-WEST        │  │  ATL-CENTRAL     │
     └───────┬──────────┘  └────────┬─────────┘  └────────┬─────────┘
             │                      │                      │
      ┌──────┴──────┐       ┌──────┴──────┐       ┌──────┴──────┐
      │ HTTP  │ WS  │       │ HTTP  │ WS  │       │ HTTP  │ WS  │
      │ pool  │ pool│       │ pool  │ pool│       │ pool  │ pool│
      └───────┴─────┘       └──────┴──────┘       └──────┴──────┘
```

**Layer decomposition**:

| Layer | Technology | Responsibility |
|-------|-----------|---------------|
| L1: Edge CDN | Cloudflare | Static assets, WAF, DDoS mitigation, TLS termination |
| L2: DNS routing | Route 53 (weighted) | Geographic proximity, health-based failover |
| L3: L7 gateway | Envoy or Traefik | Path routing, rate limiting, auth token validation |
| L4: Protocol split | Gateway config | HTTP → REST pool; Upgrade → WebSocket pool |
| L5: Service mesh | NATS (internal) | Service-to-service communication bypasses gateway |

### 16.9.2 WebSocket Connection Management

WebSocket connections for realtime IIoT data delivery MUST be handled
differently from stateless HTTP requests:

**Connection lifecycle**:

```
Client                    Gateway                   WS Server
  │                         │                         │
  │─── HTTPS GET /ws/iiot ─▶│                         │
  │    Upgrade: websocket   │                         │
  │    Auth: Bearer <JWT>   │                         │
  │                         │── Validate JWT ────────▶│
  │                         │   (NATS account check)  │
  │                         │                         │
  │                         │── Upgrade ─────────────▶│
  │◀── 101 Switching ───────│                         │
  │                         │                         │
  │◀═══ Binary frames ═════════════════════════════▶│
  │    (msgpack/JSON RPC)   │  (L7 passthrough)      │
  │                         │                         │
  │─── Ping/Pong ──────────▶│── Ping/Pong ──────────▶│
  │    (30s interval)       │                         │
  │                         │                         │
```

**Gateway requirements**:

- Gateway MUST NOT buffer WebSocket frames — stream-through only
- Gateway MUST support HTTP/1.1 Upgrade and HTTP/2 CONNECT for WS
- Gateway MUST forward `X-Forwarded-For` and `X-Real-IP` headers
- Gateway SHOULD set idle timeout to 300s (5 minutes) for WS connections
- Gateway MUST support sticky sessions (session affinity) per WebSocket
  connection to the same upstream server

**Connection limits per gateway node**:

| Resource | Limit | Rationale |
|----------|-------|-----------|
| Max concurrent WS connections | 50,000 | Kernel socket limit per process |
| Max WS connections per org | 100 | Fair-share across 200K orgs |
| WS frame max size | 1 MB | Prevents memory exhaustion |
| WS idle timeout | 300s | Reclaim stale connections |
| Rate limit (frames/sec/conn) | 100 | Prevents runaway clients |

### 16.9.3 Geographic Load Balancing (Atlanta Metro)

The Atlanta metropolitan area deployment spans three availability zones
to minimize latency for manufacturing organizations distributed across
the metro region:

```
                  ATL Metro (200K+ organizations)
    ┌──────────────────────────────────────────────────┐
    │                                                  │
    │   ┌──────────────┐                               │
    │   │  ATL-EAST    │  Midtown/Downtown             │
    │   │  (Zone A)    │  3× hub servers               │
    │   │              │  PostgreSQL primary            │
    │   └──────────────┘                               │
    │                                                  │
    │   ┌──────────────┐      ┌──────────────┐         │
    │   │  ATL-WEST    │      │  ATL-CENTRAL │         │
    │   │  (Zone B)    │      │  (Zone C)    │         │
    │   │  Marietta    │      │  Decatur     │         │
    │   │  3× hub      │      │  3× hub      │         │
    │   │  PG replica  │      │  PG replica  │         │
    │   └──────────────┘      └──────────────┘         │
    │                                                  │
    │   Round-trip latency between zones: < 5ms        │
    └──────────────────────────────────────────────────┘
```

**Routing policy**:

- DNS weighted routing: 40% ATL-EAST, 30% ATL-WEST, 30% ATL-CENTRAL
- Health check failover: If a zone fails health checks for 30s, traffic
  redistributes to remaining zones within 60s
- WebSocket connections MUST NOT be rebalanced mid-session — only new
  connections follow updated routing weights

### 16.9.4 CDN Configuration

Static assets (UI bundles, documentation, firmware images) MUST be served
through CDN edge nodes. Dynamic API traffic MUST bypass CDN and route
directly to L7 gateways.

| Asset Type | Cache TTL | CDN Edge | Purge Strategy |
|------------|----------|----------|---------------|
| UI bundles (JS/CSS) | 1 year | Yes | Content-hash in filename |
| Firmware images | 30 days | Yes | Version-tagged path |
| API responses | No cache | Bypass | N/A |
| WebSocket | No cache | Bypass | N/A |
| Documentation | 1 hour | Yes | On-deploy purge |

**WAF rules**. The CDN WAF MUST block:
- Requests exceeding 10 MB body size (except firmware upload endpoints)
- Known vulnerability scanning patterns (SQLi, XSS, path traversal)
- IP addresses exceeding 1,000 requests/minute to API endpoints
- Non-TLS connections (HTTP MUST redirect to HTTPS)

---

## 16.10 Disaster Recovery

The manufacturing commons implements a tiered disaster recovery strategy
aligned with the edge-first sovereignty principle: edge devices MUST continue
operating during any cloud or hub failure. Recovery targets differ by data
class and organizational tier.

### 16.10.1 Recovery Targets by Data Class

| Data Class | RPO | RTO | Justification |
|------------|-----|-----|--------------|
| Sensor readings (hot) | 0 (edge-local) | 0 (edge-local) | Edge sovereignty — no cloud dependency |
| Sensor readings (cloud mirror) | 5 minutes | 30 minutes | Async mirror via NATS JetStream |
| Entity state (edge) | 0 | 0 | @effect/cluster local persistence |
| Entity state (cloud mirror) | 1 minute | 15 minutes | JetStream R3 replication |
| Alarm events | 0 (edge) / 30s (cloud) | 0 / 5 minutes | Safety-critical data, dual-write |
| Asset hierarchy (graph) | 1 hour | 4 hours | Infrequent changes, pg_basebackup |
| Event journal (audit) | 0 (append-only) | 1 hour | Regulatory — never lose, slow restore OK |
| Cross-org marketplace data | 15 minutes | 1 hour | Eventually consistent by design |
| Configuration / credentials | Real-time | 15 minutes | NATS KV with R3 replication |

**RPO = 0 at the edge** is structural, not aspirational. Because the edge device
is the sovereign authority for its organization's data, a cloud outage does NOT
cause data loss — the data never left the edge. Cloud mirrors exist for
analytics, not for authority [TMNL-EDGE, Section 15.2].

### 16.10.2 NATS Supercluster Cross-DC Replication

The NATS supercluster provides the primary replication mechanism for all
event data across the three Atlanta metro zones:

```
         ┌─────────────────────────────────────────────┐
         │            NATS Supercluster                 │
         │                                             │
         │  ATL-EAST ◄──── gateway ────► ATL-WEST     │
         │     │                            │          │
         │     └──── gateway ──── gateway ──┘          │
         │                  │                          │
         │             ATL-CENTRAL                     │
         │                                             │
         │  JetStream R3: Every stream replicated      │
         │  across all 3 zones                         │
         └─────────────────────────────────────────────┘
```

**Replication guarantees**:

- JetStream streams MUST use `R3` (3 replicas, one per zone) for all
  organization data at the hub tier
- NATS gateway protocol synchronizes subject interest across zones
  with sub-second propagation [NATS-GATEWAY]
- Raft consensus within each JetStream cluster ensures leader
  election completes within 2 seconds of node failure [RAFT]
- Leaf node connections from edge devices reconnect automatically
  to the nearest healthy hub (NATS client retry with backoff)

### 16.10.3 PostgreSQL Disaster Recovery

**Hub-tier PostgreSQL** (cloud databases serving T0/T1 orgs and analytics):

```
                   ATL-EAST (Primary)
                   ┌───────────────────┐
                   │  PostgreSQL 16    │
                   │  TimescaleDB HA   │
                   │  Write primary    │
                   └────────┬──────────┘
                            │ Streaming replication
               ┌────────────┼────────────┐
               │                         │
    ATL-WEST (Replica)        ATL-CENTRAL (Replica)
    ┌───────────────────┐     ┌───────────────────┐
    │  Hot standby       │     │  Hot standby       │
    │  Read replica      │     │  Read replica      │
    │  Async (< 1s lag)  │     │  Async (< 1s lag)  │
    └───────────────────┘     └───────────────────┘
```

| Component | Strategy | RPO | RTO | Mechanism |
|-----------|----------|-----|-----|-----------|
| PG primary | Multi-AZ standby | < 1 minute | 5 minutes | Streaming replication + auto-failover |
| PG replicas | 2 read replicas | N/A (reads) | 2 minutes | Hot standby in separate zones |
| TimescaleDB hypertables | Continuous backup | 5 minutes | 30 minutes | pgBackRest to S3 + WAL archiving |
| Apache AGE graph | Included in PG backup | Same as PG | Same as PG | Replicated with base tables |
| pg_lake / Iceberg | Object storage native | 0 (S3) | 0 (S3) | S3 cross-region replication |

**Edge-tier PostgreSQL** (T2/T3 org-local databases):

Edge PostgreSQL instances are NOT replicated to the cloud by default. They
are the source of truth. Recovery strategy:

- T2: `pg_basebackup` to local NFS or USB storage, nightly
- T3: Streaming replication to a local standby + `pg_basebackup` to S3
- Both tiers: NATS JetStream mirrors critical event data to cloud,
  providing a secondary recovery path for event-sourced entities

### 16.10.4 Failure Scenarios and Response

| Scenario | Impact | Detection | Response | Recovery Time |
|----------|--------|-----------|----------|--------------|
| Single hub node failure | Reduced capacity | NATS health check (2s) | Raft leader election, traffic redistribution | 2-5 seconds |
| Single AZ failure | 1/3 hub capacity lost | DNS health check (30s) | Traffic routes to remaining zones | 30-60 seconds |
| All hub failure (metro-wide) | Cloud services unavailable | Edge detects NATS disconnect | Edge continues locally; cloud recovers from backup | 30 min (cloud) / 0 (edge) |
| Edge device failure (T2/T3) | Single org offline | Org detects locally | Replace hardware, restore from backup | 1-4 hours |
| Edge device failure (T1) | Single org offline | Org detects locally | Replace SBC, NATS re-mirrors from cloud | 15-30 minutes |
| Database corruption (hub) | Analytics degraded | Checksum monitoring | Point-in-time recovery from WAL archive | 30-60 minutes |
| Database corruption (edge) | Single org read-only | PG checksum alerts | Restore from pg_basebackup + replay events from JetStream | 1-4 hours |
| NATS partition (edge ↔ hub) | No cloud sync | Leaf node heartbeat timeout | Edge buffers locally; reconciliation on reconnect | 0 (edge) / variable (sync) |

### 16.10.5 Backup Schedule

| Data | Frequency | Destination | Retention |
|------|-----------|-------------|-----------|
| Hub PG full backup | Daily 02:00 UTC | S3 (cross-region) | 30 days |
| Hub PG WAL archive | Continuous | S3 (same region) | 7 days |
| Hub NATS snapshots | Every 6 hours | S3 | 7 days |
| Edge T3 PG backup | Daily (org-configured) | Local NFS + optional S3 | 14 days |
| Edge T2 PG backup | Weekly (org-configured) | Local USB / NFS | 4 weeks |
| Edge T1 NATS KV | Continuous mirror to hub | Hub JetStream | Per org retention |
| Event journal | Append-only, never deleted | PG + JetStream mirror | 7+ years [FDA-CFR11] |

### 16.10.6 Cost Projections by Organization Size

Disaster recovery infrastructure cost scales with organizational complexity
and regulatory requirements:

| Org Profile | Tier | Monthly DR Cost | Components |
|-------------|------|----------------|------------|
| Solo machinist (1-5 sensors) | T1 | $0-5 | NATS cloud mirror (included in platform fee) |
| Small shop (5-50 sensors) | T2 | $15-40 | Local backup + cloud mirror |
| Mid-size manufacturer (50-500 sensors) | T2/T3 | $80-250 | PG standby + S3 backup + cloud mirror |
| Large facility (500-5,000 sensors) | T3 | $400-1,200 | Streaming replication + S3 + pg_lake archive |
| Enterprise (5,000+ sensors) | T3+Cloud | $2,000-8,000 | Multi-site replication + cold archive + compliance |

**Platform-included DR**. All organizations on the manufacturing commons
receive NATS JetStream cloud mirroring at no additional cost. This ensures
basic event recovery (RPO ≤ 5 minutes) for every participant regardless of
tier. Enhanced DR (streaming replication, point-in-time recovery, compliance
archival) is available as a tiered add-on.

---

## 16.11 Codebase Reference Map

| File | Purpose | Section |
|---|---|---|
| `lib/holonet/nats/connection.ts:40-60` | NatsConnectionService | 16.2.3 |
| `lib/iiot/adapters/sparkplug-adapter.ts:406-407` | SparkplugAdapterLive | 16.3.3 |
| `lib/iiot/adapters/ingestion-service.ts:297-322` | SparkplugPipelineLayer | 16.3.4 |
| `lib/iiot/entity/EntityStack.ts:54-67` | EntityHandlersLayer | 16.3.4 |
| `lib/iiot/realtime/event-distribution.ts` | EventDistribution | 16.3.4 |
| `lib/iiot/realtime/holonet-bridge.ts` | HolonetBridge | 16.3.5 |
| `lib/iiot/realtime/websocket-server.ts:68-137` | WebSocket server | 16.3.2, 16.3.6 |
| `lib/iiot/models/_infrastructure.ddl.ts` | Extension + schema + graph DDL | 16.8.1 |
| `lib/iiot/models/readings/SensorReadingModel.ddl.ts` | Hypertable + caggs | 16.8.3 |
| `lib/iiot/models/_graph-seed.ddl.ts` | Graph node + edge seed | 16.8.4 |
| `lib/iiot/models/_migrations.ts` | Migration registry | 16.8.6 |
| `docker/iiot-db/Dockerfile` | TimescaleDB + AGE + pg_lake image | 16.8.1 |
| `docker/docker-compose.iiot.yml` | IIoT database stack | 16.8.1 |

---

## 16.12 References

### Normative

- [RFC2119] — Bradner, S. "Key words for use in RFCs."
- [NATS-LEAFNODE] — Synadia. "NATS Leaf Nodes."
- [NATS-GATEWAY] — Synadia. "NATS Gateways (Supercluster)."
- [NATS-ACCOUNTS] — Synadia. "NATS Account-Based Security."
- [NATS-DECENTRALIZED] — Synadia. "NATS Decentralized JWT Authentication."
- [JETSTREAM] — Synadia. "NATS JetStream."
- [EFFECT-CLUSTER] — Effect Contributors. "@effect/cluster."

### Normative (Database & Recovery)

- [KLEPPMANN] — Kleppmann, M. *Designing Data-Intensive Applications.* O'Reilly, 2017.
- [FDA-CFR11] — U.S. FDA, 21 CFR Part 11. "Electronic Records; Electronic Signatures."
- [ISA-95-1] — ANSI/ISA-95.00.01-2010. "Enterprise-Control System Integration — Part 1."
- [RAFT] — Ongaro, D. and Ousterhout, J. "In Search of an Understandable Consensus Algorithm." USENIX ATC 2014.
- [NATS-GATEWAY] — Synadia. "NATS Gateways (Supercluster)."
- [EFFECT-TS] — Effect Contributors. "Effect-TS: Functional Effect System for TypeScript."

### Informative

- [TMNL-EDGE] — "Edge-First Architecture." `rfc-section-edge-architecture-v2.md`
- [TMNL-CONSISTENCY] — "Two-Domain Consistency Model." `rfc-section-two-domain-consistency.md`
- [TMNL-SECURITY] — "Security, Trust & Tenant Isolation." `rfc-section-security-trust.md`
- [research-cluster-patterns.md] — @effect/cluster transport options and shard algorithm
- [research-uns-metropolitan.md] — NATS-specific architecture recommendations
- [research-effect-architecture.md] — Effect-TS scaling architecture

---

*End of RFC-001 Section 16: Deployment Topology*
