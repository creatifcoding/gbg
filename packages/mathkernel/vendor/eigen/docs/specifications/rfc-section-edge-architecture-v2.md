# RFC-001 Section 15: Edge-First Architecture

```
Section:       Edge-First Architecture
Parent RFC:    RFC-001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        Val (effect-specialist)
Created:       2026-02-09
Research Base: research-effect-architecture.md (Sections 1, 6)
               research-cluster-patterns.md (Sections 5, 6)
               research-uns-metropolitan.md (Sections 2, 6, 7)
               research-manufacturing-commons.md (Sections 7, 8)
               rfc-section-security-trust.md (Sections Z.3, Z.4)
```

> This section specifies the edge-first design philosophy, capability tier model,
> resource constraints, edge security posture, and brownfield integration strategy
> for the TMNL metropolitan manufacturing network. The platform MUST operate
> without cloud connectivity. The edge device is the sovereign data authority for
> its organization. Cloud services enhance but never gate manufacturing operations.
>
> Deployment topology (NATS layout, cluster profiles, reconciliation protocol,
> upgrade paths) is specified in the companion Section 16: Deployment Topology.
>
> File paths are relative to `packages/tmnl/src/`.

---

## Table of Contents

1. [Conventions](#151-conventions)
2. [Design Philosophy: Edge-First, Cloud-Optional](#152-design-philosophy-edge-first-cloud-optional)
3. [Four-Tier Edge Capability Model](#153-four-tier-edge-capability-model)
4. [Resource Constraints per Tier](#154-resource-constraints-per-tier)
5. [Security at the Edge](#155-security-at-the-edge)
6. [Brownfield Integration](#156-brownfield-integration)
7. [Edge Observability](#157-edge-observability)
8. [Bandwidth Management](#158-bandwidth-management)
9. [Progressive Enhancement via Layer Composition](#159-progressive-enhancement-via-layer-composition)
10. [Codebase Reference Map](#1510-codebase-reference-map)
11. [References](#1511-references)

---

## 15.1 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

---

## 15.2 Design Philosophy: Edge-First, Cloud-Optional

### 15.2.1 The Sovereignty Principle

The metropolitan manufacturing network serves 200,000+ organizations ranging from
a 2-person machine shop with unreliable internet to a 500-employee aerospace
facility with redundant fiber. The architecture MUST NOT assume cloud
connectivity for any manufacturing operation.

This principle is not a preference — it is a hard constraint derived from the
manufacturing commons thesis [research-manufacturing-commons.md Section 7].
Small manufacturers are first-class citizens. A machinist with a $50 Raspberry
Pi, a CNC mill, and a lathe is as architecturally important as a large factory
with a $50,000 edge server. If the platform requires cloud for basic operations,
it excludes the very participants who make the network valuable.

### 15.2.2 Sovereignty Rules

Three rules govern the relationship between edge devices and cloud services.
These are non-negotiable architectural invariants.

**Edge Sovereignty Rule (E-1)**: An organization's edge device is the
authoritative source of truth for that organization's entity state, sensor
readings, alarm lifecycle, and work order history. The cloud cluster is a
mirror, not a primary. If the edge device and the cloud disagree on entity
state, the edge device is correct.

**Rationale**: Entity actors run on the edge device inside @effect/cluster.
The Machine state graph, the alarm ISA-18.2 lifecycle, and the work order
FDA 21 CFR Part 11 audit trail all execute locally. The cloud never processes
entity RPCs — it only receives event notifications via NATS leaf node mirroring.

**Cloud Enhancement Rule (E-2)**: Cloud services MUST only provide capabilities
that are inherently cross-organizational or require resources beyond edge
capacity:

| Cloud-Provided (E-2 allowed) | Edge-Provided (E-2 prohibited in cloud) |
|------------------------------|----------------------------------------|
| Cross-org marketplace aggregation | Entity state management |
| Network-level analytics | Alarm acknowledgment routing |
| Capability matching + reputation | Operator authentication |
| Long-term archival (beyond edge SSD) | Sensor data collection |
| Disaster recovery backup | Work order lifecycle |
| CRDT aggregate computation | Local dashboard rendering |

**Offline Continuity Rule (E-3)**: When the edge device loses cloud
connectivity, ALL intra-organization operations MUST continue without
degradation. The following table defines the expected behavior:

| Operation | Offline Behavior | Acceptable Degradation |
|-----------|-----------------|----------------------|
| Sensor reading ingestion | MUST continue normally | None |
| Alarm detection and routing | MUST continue normally | None |
| Entity state transitions | MUST continue normally | None |
| Work order lifecycle | MUST continue normally | None |
| Operator dashboard (T0 local) | MUST continue normally | None |
| Operator dashboard (T0 remote) | MUST degrade gracefully | Remote T0 devices lose access |
| Cross-org marketplace | MUST degrade gracefully | Org disappears from network views |
| Network capacity aggregates | MUST degrade gracefully | Stale data for this org (>5 min TTL) |
| Cloud analytics pipeline | MUST queue locally | Delayed until reconnection |
| JetStream domain mirror | MUST pause and resume | Events buffer locally |

### 15.2.3 The "Earl Test"

Every architectural decision MUST pass the "Earl Test": can Earl, a 63-year-old
machinist with a 2-person shop, one CNC mill, one lathe, and a $50 Raspberry Pi
on intermittent DSL, use this feature without calling IT support?

If the answer is no, one of three things MUST change:

1. The feature is cloud-only and is excluded from Earl's tier (acceptable)
2. The feature's edge implementation is simplified for low-resource tiers
3. The feature is redesigned to work within Earl's constraints

The Earl Test is not hypothetical. The manufacturing commons thesis identifies
that 80%+ of the 200K target organizations are small shops with 1-20 employees
[research-manufacturing-commons.md Section 1.1]. The platform's network value
scales with participant count, not participant size.

### 15.2.4 Implications for Protocol Selection

Edge-first architecture constrains protocol and transport choices:

| Constraint | Implication |
|-----------|------------|
| $50 hardware minimum | NATS server must run in <128 MB RAM |
| Intermittent internet | NATS leaf node (auto-reconnect, buffered delivery) |
| No IT department | JWT-based auth (no LDAP, no Active Directory) |
| Local-first operation | JetStream domain per-org (not cloud-hosted) |
| Sparkplug-B compatibility | MQTT broker bridge at edge (not cloud) |
| WebSocket for operators | T0 devices connect to local T1/T2/T3, not cloud |

**Codebase proof**: The existing NATS connection layer at
`lib/holonet/nats/connection.ts:40-60` [NatsConnectionService] uses
`Effect.acquireRelease` for scoped lifecycle management. This pattern supports
both persistent cloud connections (T2/T3) and intermittent connections (T1) via
NATS leaf node reconnection semantics.

---

## 15.3 Four-Tier Edge Capability Model

### 15.3.1 Tier Overview

Implementations MUST classify edge deployments into one of four capability tiers.
Each tier defines the MUST/SHOULD/MAY capabilities available to the organization.

| Tier | Name | Hardware | Cost | Role |
|------|------|----------|------|------|
| T0 | Client Device | Smartphone, tablet, laptop | $0 (existing) | Read-only consumer |
| T1 | Minimal Edge | $50-200 SBC (RPi, Orange Pi) | $50-200 | Protocol bridge, buffer |
| T2 | Industrial Gateway | Edge gateway, mini-PC | $500-2,000 | Full local processing |
| T3 | Edge Server | Rack server, VM cluster | $5,000-50,000+ | Multi-node cluster, ML |

### 15.3.2 Tier 0 (T0): Client Device — Read-Only Access

```
Hardware:    Smartphone, tablet, laptop browser
CPU:         Any (browser-based)
RAM:         N/A (browser tab)
Storage:     N/A (no local persistence required)
Connectivity: WiFi/cellular to T1/T2/T3 or cloud
Role:        Consumer of entity state, not producer
```

**MUST capabilities**:
- Display real-time entity state via WebSocket subscription to nearest
  T1/T2/T3 or cloud endpoint
- Acknowledge alarms via RPC call routed through WebSocket
- View sensor reading dashboards (read-only)
- Authenticate via NATS JWT (user-level, scoped to read operations)

**SHOULD capabilities**:
- Receive push notifications for critical alarms (ISA-95 L1-L2)
- Cache last-known entity state for offline viewing (Service Worker)
- Display historical trends from JetStream replay (when connected)
- Support progressive web app (PWA) installation for quick access

**MUST NOT capabilities**:
- Run @effect/cluster runners (no local entity processing)
- Persist events locally (no JetStream domain)
- Bridge Sparkplug-B or OPC-UA protocols
- Publish sensor readings or entity state changes

**Transport**: WebSocket to nearest available endpoint. The existing WebSocket
server at `lib/iiot/realtime/websocket-server.ts:68-137` serves T0 clients via
`RpcServer.layerProtocolWebsocketRouter`.

**Security model**: T0 devices authenticate with short-lived JWTs (1-hour
lifetime) obtained via OAuth2 token exchange. The JWT scopes the user to
read-only subjects within their organization's NATS account.

### 15.3.3 Tier 1 (T1): Minimal Edge — Sparkplug Bridge + Telemetry Buffer

```
Hardware:    $50-200 SBC (Raspberry Pi 4/5, Orange Pi 5, Radxa ROCK 5B)
CPU:         4-core ARM, 1.5-2.4 GHz
RAM:         2-8 GB (RECOMMENDED: 4 GB)
Storage:     32-128 GB microSD or eMMC
Connectivity: Ethernet/WiFi, intermittent internet acceptable
Role:        Protocol bridge, local telemetry buffer, NATS leaf node
```

**MUST capabilities**:
- Run Sparkplug-B adapter bridging local MQTT to NATS
  (`lib/iiot/adapters/sparkplug-adapter.ts:406-407` [SparkplugAdapterLive])
- Buffer sensor readings locally during cloud disconnection
- Run NATS server in leaf node mode (single-process, embedded)
- Persist events to local JetStream domain (file storage, 1-day retention)
- Authenticate to hub via signed JWT [NATS-DECENTRALIZED]
- Enforce intra-organization ordering guarantees G-1 and G-2
  [rfc-section-two-domain-consistency.md Section X.3]
- Start automatically on boot with no manual intervention
- Survive ungraceful power loss without data corruption
  (JetStream file storage with write-ahead log)

**SHOULD capabilities**:
- Run alarm detection logic locally (threshold-based, no ML)
  (`lib/iiot/adapters/ingestion-service.ts:297-322` [SparkplugPipelineLayer])
- Serve T0 clients on local network via WebSocket
- Buffer cross-org events for cloud delivery on reconnection
- Support report-by-exception filtering to reduce telemetry volume by 80-90%
  [research-uns-metropolitan.md Section 7.1]
- Provide mDNS discovery for T0 devices on local network
  (`_iiot-edge._tcp.local`)

**MAY capabilities**:
- Run @effect/cluster SingleRunner with minimal entity set (up to 50 entities)
- Execute simple state machines for equipment monitoring
- Cache NATS KV state for offline dashboard rendering
- Bridge OPC-UA DA endpoints via protocol adapter

**MUST NOT capabilities**:
- Run multi-node cluster (insufficient resources)
- Persist events beyond 1-day retention (storage constraints)
- Execute ML inference models (insufficient CPU/RAM)
- Run PostgreSQL or other relational database

**Failure mode**: If the T1 device loses power, it MUST recover to operational
state within 60 seconds of power restoration. NATS leaf node reconnects
automatically. JetStream replays from the last checkpoint.

### 15.3.4 Tier 2 (T2): Industrial Edge Gateway — Full Local Processing

```
Hardware:    Industrial edge gateway or mini-PC
Examples:    Dell Edge Gateway 5200, Siemens IPC127E, Intel NUC,
             Advantech UNO-2484G, Lenovo ThinkEdge SE50
CPU:         4-8 core x86/ARM, 2-3 GHz
RAM:         8-16 GB (RECOMMENDED: 8 GB)
Storage:     256 GB - 1 TB SSD (RECOMMENDED: 512 GB)
Connectivity: Dual Ethernet, WiFi, optional cellular failover
Role:        Full local entity processing, 30-day retention
```

**MUST capabilities**:
- Run @effect/cluster SingleRunner with SQL-backed RunnerStorage
  (`@effect/cluster/SingleRunner` — in-process, no network transport)
- Process all 12 entity types locally with full state machine validation
  (`lib/iiot/entity/EntityStack.ts:54-67` [EntityHandlersLayer])
- Persist events to local JetStream domain (file storage, 30-day retention)
- Run complete SparkplugPipelineLayer with TopicRouter, ReadingProcessor,
  AlarmDetector, and IngestionService
  (`lib/iiot/adapters/ingestion-service.ts:297-322`)
- Enforce intra-organization ordering guarantees G-1 through G-6
- Serve T0 clients via WebSocket on local network
- Operate indefinitely without cloud connectivity (E-3)
- Recover from ungraceful shutdown within 120 seconds
- Support NATS KV for entity current state
  (`lib/iiot/state/` — SiteState, DeviceState, PlantState, etc.)

**SHOULD capabilities**:
- Run EventDistribution with 4+ channels
  (`lib/iiot/realtime/event-distribution.ts` — ChannelService-based hub)
- Mirror local JetStream streams to cloud domain on reconnection
- Run entity observer fibers for real-time entity-change events
  (makeEntityObserver pattern per RFC Section 10)
- Run OPC-UA adapter alongside Sparkplug-B adapter
- Expose HTTP API for local MES/SCADA integration
- Support automatic firmware updates (signed binary packages)
- Provide SNMP or Prometheus metrics endpoint for facility monitoring

**MAY capabilities**:
- Run 2-node local cluster (SingleRunner + SocketRunner) for HA
- Execute lightweight ML inference for anomaly detection (TFLite, ONNX)
- Bridge to legacy SCADA historians via OPC-DA/HDA adapters
- Run scheduled backup of SQLite/JetStream to network storage

### 15.3.5 Tier 3 (T3): Edge Server — Enterprise-Grade Local Cluster

```
Hardware:    Rack-mount server, industrial PC cluster, or VM cluster
Examples:    Dell PowerEdge R660xs, HPE ProLiant DL360,
             Lenovo ThinkSystem SR630 V3, Kubernetes on-prem
CPU:         16-64 cores, 2.5-4 GHz
RAM:         32-256 GB (RECOMMENDED: 64 GB)
Storage:     2-20 TB NVMe/SSD (RAID 10 RECOMMENDED)
Connectivity: Redundant GbE/10GbE, dedicated internet circuit
Role:        Multi-runner cluster, full JetStream, ML inference,
             1-year+ regulatory retention
```

**MUST capabilities**:
- Run @effect/cluster with SocketRunner transport (multi-node)
  (`@effect/cluster/SocketRunner` — binary TCP, production-grade)
- Support 5 shard groups (`orgs`, `assets`, `equipment`, `telemetry`, `events`)
  with 300 shards per group (default `shardsPerGroup`)
- Process 5,000+ entities with full state machine validation
- Persist events to local JetStream domain (file storage, 1-year retention)
- Run 3-replica JetStream cluster for local high availability
- Enforce all intra-organization ordering guarantees G-1 through G-7
- Serve 50+ concurrent T0 clients via WebSocket
- Run HolonetBridge for NATS-distributed event delivery
  (`lib/iiot/realtime/holonet-bridge.ts`)
- Support rolling upgrades without service interruption
- Maintain entity lifecycle audit trail with regulatory retention
  (ISA-18.2 alarm records: 7 years; FDA 21 CFR Part 11 work orders: 7 years)

**SHOULD capabilities**:
- Run HttpRunner or WebSocket transport for inter-runner communication
  (`@effect/cluster/HttpRunner.layerHttp`, `HttpRunner.layerWebsocket`)
- Support horizontal scaling by adding runner nodes
- Run ML inference models for predictive maintenance
- Support JetStream domain mirroring to cloud (continuous, not batch)
- Run full EventDistribution with 7+ channels for metropolitan-scale routing
- Integrate with enterprise MES, ERP, and SCADA systems via HTTP API
- Run durable workflow engine (`@effect/cluster/ClusterWorkflowEngine`)
  for complex multi-step manufacturing processes
- Provide Kubernetes operator for automated cluster management

**MAY capabilities**:
- Run dedicated JetStream servers (separate from NATS core servers)
- Operate as a regional hub for multiple T1/T2 sites within the same org
- Deploy with GPU accelerator for real-time vision inspection
- Provide REST-to-NATS API gateway for legacy system integration

### 15.3.6 Tier Capability Summary Matrix

| Capability | T0 | T1 | T2 | T3 |
|---|---|---|---|---|
| Read entity state | MUST | MUST | MUST | MUST |
| Write entity state | -- | MAY | MUST | MUST |
| Sparkplug-B bridge | -- | MUST | MUST | MUST |
| Local NATS server | -- | MUST | MUST | MUST |
| JetStream persistence | -- | MUST (1d) | MUST (30d) | MUST (1yr) |
| @effect/cluster | -- | MAY (Single) | MUST (Single+SQL) | MUST (Socket) |
| Entity processing | -- | MAY (50) | MUST (500) | MUST (5000+) |
| Alarm detection | -- | SHOULD | MUST | MUST |
| EventDistribution | -- | -- | SHOULD | MUST |
| HolonetBridge | -- | -- | SHOULD | MUST |
| WebSocket server | -- | SHOULD | MUST | MUST |
| ML inference | -- | -- | MAY | SHOULD |
| Offline operation | -- | MUST | MUST | MUST |
| Cloud mirror | -- | SHOULD | SHOULD | MUST |
| Multi-node cluster | -- | -- | MAY (2) | MUST (3+) |
| HTTP API | -- | -- | SHOULD | MUST |
| Regulatory retention | -- | -- | SHOULD | MUST |
| HA (redundancy) | -- | -- | MAY | SHOULD |

---

## 15.4 Resource Constraints per Tier

### 15.4.1 Memory Budget

Each tier MUST operate within defined memory constraints. Implementations MUST
configure JetStream, @effect/cluster, and application services to respect these
budgets. Exceeding the memory budget on constrained hardware causes OOM kills,
which violates E-3 (offline continuity).

| Component | T1 (1 GB avail) | T2 (4 GB avail) | T3 (32 GB avail) |
|-----------|-----------------|-----------------|-------------------|
| OS + Bun runtime | 256 MB | 512 MB | 2 GB |
| NATS server | 128 MB | 512 MB | 4 GB |
| JetStream page cache | 64 MB | 1 GB | 8 GB |
| @effect/cluster | 64 MB | 512 MB | 4 GB |
| Entity state (in-memory) | 32 MB | 256 MB | 2 GB |
| Application services | 128 MB | 512 MB | 4 GB |
| Sparkplug adapter | 64 MB | 256 MB | 1 GB |
| WebSocket connections | 16 MB | 256 MB | 4 GB |
| Headroom (15-25%) | 248 MB | 696 MB | 3 GB |
| **Total** | **1 GB** | **4 GB** | **32 GB** |

**T1 memory discipline**: At 1 GB total, every byte matters. The NATS server
MUST be configured with `max_payload: 64KB` (vs default 1 MB) and
`max_connections: 20` (vs default 65K). JetStream page cache MUST be limited
to 64 MB via `jetstream { max_memory: 64MB }`.

### 15.4.2 Entity Limits

Entity limits MUST be enforced by @effect/cluster's `maxIdleTime` reaping and
application-level entity activation guards:

| Constraint | T1 | T2 | T3 |
|-----------|---|---|---|
| Max concurrent entities | 50 | 500 | 5,000+ |
| Max entity types registered | 5 | 12 | 12+ |
| Shard groups | 1 | 3 | 5 |
| Shards total | 10 | 150 | 1,500 |
| maxIdleTime | 5 min | 2 min | 1 min (default) |
| entityTerminationTimeout | 5 sec | 10 sec | 15 sec (default) |
| RunnerStorage refresh | 10 sec | 5 sec | 3 sec (default) |

**T1 entity selection**: At T1, only 5 of the 12 entity types SHOULD be
registered. The recommended subset is: Machine, Device, Sensor, Alarm,
EquipmentState. These cover the core monitoring loop. Site, Area, Plant, Line,
WorkCell, Enterprise, and WorkOrder can be deferred to T2.

### 15.4.3 Storage Budget

| Metric | T1 (32-128 GB) | T2 (256 GB-1 TB) | T3 (2-20 TB) |
|--------|----------------|-------------------|---------------|
| JetStream telemetry | 1 GB / 1 day | 50 GB / 30 days | 500 GB / 1 year |
| JetStream entity events | 100 MB / 30 days | 5 GB / 1 year | 50 GB / 7 years |
| SQLite/PostgreSQL | 50 MB | 2 GB | 50 GB |
| NATS KV state | 10 MB | 100 MB | 1 GB |
| Application logs | 100 MB | 1 GB | 10 GB |
| OS + runtime | 4 GB | 8 GB | 20 GB |
| **Total used** | **~5.3 GB** | **~67 GB** | **~631 GB** |
| **Headroom** | ~27-123 GB | ~189-933 GB | ~1.4-19.4 TB |

### 15.4.4 Stream Backpressure per Tier

Backpressure strategy MUST vary by tier to respect memory constraints. The
backpressure type determines behavior when the subscriber falls behind the
publisher:

| Channel | Backpressure | T1 maxLag | T2 maxLag | T3 maxLag |
|---------|-------------|-----------|-----------|-----------|
| readings | `PubSub.sliding` | 100 | 10,000 | 10,000 |
| alarms | `PubSub.bounded` | 50 | 1,000 | 1,000 |
| equipment | `PubSub.dropping` | 50 | 1,000 | 1,000 |
| entity-changes | `PubSub.dropping` | 50 | 2,000 | 2,000 |
| invalidations | `PubSub.dropping` | 50 | 1,000 | 1,000 |

**Strategy rationale**:

- **Sliding** (readings): Operator needs the latest value. Old readings are
  stale by definition. Drop the oldest, keep the newest.
- **Bounded** (alarms): ISA-18.2 [ISA-18.2] mandates no alarm loss. Bounded
  exerts backpressure on the publisher rather than dropping. If the alarm
  subscriber is too slow, the publisher blocks — this is correct because
  alarm processing is safety-critical.
- **Dropping** (entity-changes, equipment, invalidations): These events are
  replayable from JetStream or reconstructable from entity state. Dropping
  is acceptable because the subscriber can catch up from the durable store.

---

## 15.5 Security at the Edge

### 15.5.1 Transport Security

All NATS connections at every tier MUST use TLS 1.3
[rfc-section-security-trust.md Section Z.5]:

| Connection | TLS Requirement | Certificate Source |
|-----------|----------------|-------------------|
| T0 → local T1/T2/T3 | MUST (TLS 1.3) | Self-signed org CA |
| T1/T2/T3 → Regional Hub | MUST (TLS 1.3) | Platform CA |
| Hub → Supercluster | MUST (mutual TLS 1.3) | Platform CA |
| T0 → Cloud (direct) | MUST (TLS 1.3) | Public CA (Let's Encrypt) |

**Certificate auto-provisioning**: Edge devices SHOULD receive TLS certificates
during initial enrollment. The enrollment protocol:

1. Device boots with a one-time provisioning token (QR code or USB)
2. Device connects to provisioning endpoint (HTTPS)
3. Provisioning service validates token and issues:
   - NATS account JWT (signed by operator key)
   - NATS user JWT (signed by account key)
   - TLS certificate (signed by platform CA)
4. Device stores credentials in encrypted local storage
5. Subsequent boots use stored credentials (no provisioning service needed)

T1 devices with no display SHOULD support headless provisioning via:
- USB drive containing provisioning token
- Bluetooth Low Energy (BLE) pairing with operator's phone
- mDNS auto-discovery on local network with browser-based setup

### 15.5.2 JWT Authentication at Edge Tiers

Edge devices authenticate using NATS' decentralized JWT model
[NATS-DECENTRALIZED]:

| Context | JWT Lifetime | Rotation Method | Offline Duration |
|---------|-------------|----------------|-----------------|
| T1 edge device | 90 days | Auto-refresh on hub connection | Up to 90 days |
| T2 edge device | 90 days | Auto-refresh on hub connection | Up to 90 days |
| T3 edge device | 30 days | ACME-style continuous rotation | Up to 30 days |
| Cloud service | 24 hours | Automatic rotation | N/A (always connected) |
| T0 browser | 1 hour | OAuth2 token exchange | None (requires connection) |

**Offline JWT handling**: When the edge device is offline, its JWT remains valid
until expiry. T1/T2 devices MUST have JWTs with 90-day lifetime to cover
seasonal connectivity gaps (e.g., Earl's shop closes for holidays). T3 devices
with reliable connectivity use shorter lifetimes for tighter security.

**JWT revocation**: NATS supports JWT revocation via a revocation list published
to the cluster [NATS-JWT]. When a device is compromised:
1. Operator signs a revocation entry for the user JWT
2. Revocation list is published to the NATS cluster
3. All connected servers reject the revoked JWT on next connection attempt
4. Already-connected sessions are terminated within the server's check interval

### 15.5.3 Secure Boot and Binary Integrity

**T2+ devices** SHOULD implement signed binary verification:

1. Edge agent binaries MUST be signed with a platform code-signing key
2. On boot, the device SHOULD verify the binary signature before execution
3. Binary updates MUST be delivered via a signed manifest with SHA-256 checksums
4. Update manifests MUST specify minimum compatible firmware version

**T3 devices** with secure boot capability SHOULD enable UEFI Secure Boot with
platform-enrolled keys. The boot chain:

```
UEFI Firmware → Secure Boot shim → Platform boot key → Edge agent binary
```

### 15.5.4 Air-Gapped Operation (T3 Only)

For T3 deployments in classified or restricted environments (defense, nuclear,
critical infrastructure):

1. NATS server MUST operate in standalone mode (no leaf node connection)
2. Certificate rotation MUST be performed via USB media or local management console
3. Configuration updates MUST be applied via signed configuration packages
4. No cloud connectivity MUST be required for any operation (E-3 absolute)
5. Cross-org marketplace participation is not available (by definition)
6. All data remains on-premises — no mirror, no backup to cloud
7. Audit logs MUST be exportable to external media for regulatory review

### 15.5.5 Data-at-Rest Encryption

**T2+ devices** SHOULD encrypt JetStream data at rest:

| Tier | Encryption | Key Management |
|------|-----------|---------------|
| T1 | NOT RECOMMENDED (CPU cost) | N/A |
| T2 | SHOULD (LUKS/dm-crypt) | Auto-unlock via TPM 2.0 or passphrase |
| T3 | MUST (LUKS/dm-crypt or SED) | TPM 2.0 with sealed keys |

T1 devices lack the CPU budget for full-disk encryption. Physical security
(locked cabinet, tamper-evident enclosure) is the primary protection at T1.

---

## 15.6 Brownfield Integration

### 15.6.1 The Strangler Fig Pattern

For organizations with existing SCADA, PLC, or historian infrastructure, the
platform MUST support incremental adoption. The strangler fig pattern allows
the platform to wrap existing infrastructure without requiring replacement:

```
Phase 1: OBSERVE (Read-Only, 1-2 weeks)
════════════════════════════════════════

Existing SCADA/Historian ──► Sparkplug Adapter ──► NATS (readings only)
  (unchanged)                (passive subscriber)       │
                                                        ▼
                              T0 Dashboard ◄──── WebSocket
                              (read-only overlay on existing data)

Effort: Deploy T1/T2 device, configure Sparkplug adapter
Risk:   Zero — existing systems untouched
Value:  Immediate visibility into equipment telemetry
```

```
Phase 2: AUGMENT (Side-by-Side, 2-8 weeks)
═══════════════════════════════════════════

Existing SCADA ─────────────► Sparkplug Adapter ──► NATS ──► Entity System
  (still primary for control)                                  (shadow mode)
                                                               │
Operators use BOTH:                                           │
  - Legacy SCADA for control                                  │
  - T0/T2 dashboard for analytics + alarms ◄─────────────────┘

Effort: Enable entity processing on T2, configure alarm thresholds
Risk:   Low — entity system is read-only shadow, does not control equipment
Value:  ISA-18.2 alarm management, entity state tracking, OEE computation
```

```
Phase 3: REPLACE (Controlled Cutover, 4-12 weeks)
══════════════════════════════════════════════════

PLCs/Sensors ──► Sparkplug Adapter ──► NATS ──► Entity System ──► Operators
                                                (primary)
                 Legacy SCADA
                 (decommissioned or demoted to backup HMI)

Effort: Redirect operator workflows to new dashboard
Risk:   Medium — requires operator training and validation period
Value:  Full platform capabilities, marketplace participation
```

### 15.6.2 Key Constraints

- Phase 1 MUST NOT require any changes to existing PLC/SCADA configuration.
  The Sparkplug adapter passively subscribes to existing MQTT topics.
- Phase 2 MUST NOT interfere with existing control loops. Entity processing
  is read-only observation, not actuation.
- Phase 3 cutover is organization-controlled, not platform-enforced. The
  platform MUST NOT require organizations to decommission legacy systems.
- Organizations MAY remain in Phase 2 indefinitely (dual-system operation).

**Codebase proof**: The SparkplugAdapter at
`lib/iiot/adapters/sparkplug-adapter.ts:56-68` [SparkplugAdapterConfig]
accepts arbitrary `brokerUrl` and `groupIds`, enabling connection to existing
MQTT brokers without infrastructure changes. The adapter operates as a passive
consumer of existing Sparkplug telemetry — it does not publish commands or
modify device configuration.

### 15.6.3 Protocol Adapter Matrix

| Existing Protocol | Adapter | Edge Tier | Integration Path |
|------------------|---------|-----------|-----------------|
| Sparkplug B (MQTT) | SparkplugAdapterLive | T1+ | Direct MQTT subscription |
| OPC-UA | OpcUaAdapter (future) | T2+ | OPC-UA client subscription |
| Modbus TCP/RTU | ModbusAdapter (future) | T2+ | Polling with configurable interval |
| BACnet (building automation) | BacnetAdapter (future) | T2+ | BACnet/IP subscription |
| Proprietary PLC protocols | Custom adapter template | T2+ | Organization-specific development |

The SparkplugAdapter is the only adapter currently implemented. Additional
adapters follow the same `IngestionAdapter` service interface
(`lib/iiot/adapters/ingestion-service.ts:177`) and compose into the
pipeline via `Layer.provide`.

### 15.6.4 Data Mapping for Legacy Systems

Legacy systems often use non-standard naming conventions. The platform MUST
support configurable data mapping:

1. **Topic mapping**: Map legacy MQTT topics to ISA-95 entity hierarchy
   (e.g., `factory/cnc-1/temp` → `iiot.readings.SITE-EARL.TMP-001`)
2. **Unit conversion**: Convert legacy units to SI
   (e.g., Fahrenheit → Celsius, PSI → Bar)
3. **Threshold mapping**: Map existing alarm setpoints to entity alarm
   definitions
4. **Identity mapping**: Map legacy device IDs to platform entity IDs

Mapping configuration SHOULD be specified in a declarative JSON/YAML document
per organization, deployed alongside the SparkplugAdapter configuration.

---

## 15.7 Edge Observability

### 15.7.1 Health Metrics per Tier

Edge devices MUST expose health metrics for monitoring by the organization and
optionally by the platform (with consent):

| Metric | T1 | T2 | T3 | Collection |
|--------|---|---|---|-----------|
| NATS connection state | MUST | MUST | MUST | NATS stats endpoint |
| JetStream lag (msgs behind) | MUST | MUST | MUST | JetStream API |
| Entity count (active) | -- | MUST | MUST | Sharding.activeEntityCount |
| Memory usage (RSS) | SHOULD | MUST | MUST | /proc or OS API |
| CPU usage (%) | SHOULD | MUST | MUST | /proc or OS API |
| Disk usage (%) | SHOULD | MUST | MUST | Filesystem stats |
| Leaf node connection uptime | MUST | MUST | MUST | NATS stats |
| Last cloud sync timestamp | SHOULD | MUST | MUST | JetStream mirror lag |
| Sparkplug message rate | SHOULD | MUST | MUST | Adapter metrics |
| WebSocket client count | -- | SHOULD | MUST | Server stats |

### 15.7.2 Alerting at the Edge

Edge devices SHOULD generate local alerts for conditions that indicate
degradation:

| Condition | Severity | Action |
|-----------|---------|--------|
| JetStream disk > 90% | Critical | Reduce retention, alert operator |
| NATS memory > 85% | Warning | Log, increase reaping frequency |
| Leaf node disconnected > 1 hour | Warning | Local dashboard banner |
| Leaf node disconnected > 24 hours | Critical | Local audible/visual alert |
| Entity activation failure | Error | Log + retry with backoff |
| Sparkplug adapter disconnect | Warning | Reconnect with backoff |

### 15.7.3 Remote Monitoring (Opt-In)

Organizations MAY opt in to remote monitoring by the platform. This requires
exporting health metrics to the `manufacturing-commons` system account:

```
Export: health.{orgId}.metrics → manufacturing-commons
  Frequency: Every 60 seconds
  Payload: { cpu, memory, disk, natsState, entityCount, lastSync }
```

Remote monitoring MUST be opt-in (not default). Organizations that do not export
health metrics are invisible to platform monitoring — their edge devices operate
as black boxes. This is by design (data sovereignty, E-1).

---

## 15.8 Bandwidth Management

### 15.8.1 Event Priority Model

Edge-to-cloud bandwidth is a scarce resource, particularly for T1 devices on
intermittent DSL or cellular. Implementations MUST prioritize event transmission
based on the following priority classes:

| Priority | Event Type | Example | Preemption |
|----------|-----------|---------|-----------|
| P0 (Critical) | Safety alarms | Emergency stop, gas leak | MUST preempt all other traffic |
| P1 (High) | Alarm lifecycle | Alarm raised, acknowledged | MUST preempt P2-P3 |
| P2 (Normal) | Entity state changes | Machine state transition | MUST preempt P3 |
| P3 (Low) | Telemetry readings | Temperature, vibration | Lowest priority |
| P4 (Bulk) | Audit/analytics | Historical replay, aggregates | Best-effort only |

**Implementation**: NATS JetStream consumers on the leaf node outbound connection
SHOULD use separate delivery subjects per priority class. The NATS leaf node
protocol handles multiplexing, but application-level ordering within the leaf
node outbound buffer MUST respect priority ordering.

```
Leaf Node Outbound Buffer:

  Priority Queue:
    P0 ──────► [Emergency alarm]       ← Sent first
    P1 ──────► [Alarm ack, Alarm clear]
    P2 ──────► [Machine.Running]
    P3 ──────► [temp=72.3, temp=72.4]  ← Sent last
    P4 ──────► [audit log batch]       ← Only when idle
```

### 15.8.2 Report-by-Exception (RBE)

For T1 devices on constrained connections, report-by-exception SHOULD reduce
telemetry volume by 80-90% [research-uns-metropolitan.md Section 7.1]:

**RBE algorithm**: A reading is transmitted only if:
1. The value differs from the last transmitted value by more than a configured
   deadband (absolute or percentage), OR
2. A maximum reporting interval has elapsed (heartbeat), OR
3. The source quality changes (e.g., sensor goes offline)

```
Sensor: Temperature (setpoint: 72.0 F)
Deadband: 0.5 F absolute
Heartbeat: 60 seconds

72.0 → TRANSMIT (initial)
72.1 → suppress (within deadband)
72.3 → suppress (within deadband)
72.6 → TRANSMIT (exceeds deadband: |72.6 - 72.0| > 0.5)
72.7 → suppress
72.8 → suppress
... 60 seconds ...
72.8 → TRANSMIT (heartbeat interval)
```

**Sparkplug-B compatibility**: The Sparkplug-B specification [SPARKPLUG-B]
natively supports report-by-exception via the `is_historical` and `is_transient`
metric properties. The SparkplugAdapter at
`lib/iiot/adapters/sparkplug-adapter.ts:299-300` already processes DDATA messages
which contain only changed metrics — Sparkplug-B is inherently RBE at the
protocol level.

**Effect Schema for deadband configuration**:

```typescript
const DeadbandConfig = Schema.Struct({
  absolute: Schema.optional(Schema.Number),    // e.g., 0.5 degrees
  percentage: Schema.optional(Schema.Number),  // e.g., 1% of range
  heartbeatMs: Schema.Number,                  // e.g., 60000 ms
})
```

### 15.8.3 Delta Encoding for Sensor Readings

When transmitting sensor reading batches to the cloud mirror, implementations
SHOULD use delta encoding to reduce payload size:

```
Full encoding (baseline):
  [72.0, 72.1, 72.3, 72.6, 72.8, 73.1, 73.0, 72.9]
  Size: 8 × 8 bytes = 64 bytes (float64)

Delta encoding (after baseline):
  Baseline: 72.0
  Deltas:   [+0.1, +0.2, +0.3, +0.2, +0.3, -0.1, -0.1]
  Size: 8 bytes + 7 × 2 bytes = 22 bytes (baseline + int16 deltas)
  Compression ratio: 66% reduction
```

**When to use delta encoding**:
- T1 → Hub: SHOULD use delta encoding (bandwidth-constrained)
- T2 → Hub: MAY use delta encoding (moderate bandwidth)
- T3 → Hub: MAY use delta encoding (optional, bandwidth is less constrained)
- Intra-org (local NATS): MUST NOT use delta encoding (adds latency, no benefit)

### 15.8.4 Compression

NATS does not natively compress messages. For large payloads (batch readings,
audit logs), implementations MAY apply application-level compression:

| Payload Type | Compression | Rationale |
|-------------|------------|-----------|
| Single reading | MUST NOT compress | Overhead > savings for <100 bytes |
| Batch readings (50+) | SHOULD compress | 60-80% reduction on numeric arrays |
| Entity events | SHOULD NOT compress | Small payloads, latency-sensitive |
| Alarm events | MUST NOT compress | P0/P1 priority, latency-critical |
| Audit log batches | SHOULD compress | Large payloads, bulk priority |
| JetStream mirror | MAY compress | JetStream handles transport |

**Compression algorithm**: `lz4` is RECOMMENDED for edge devices due to its
low CPU overhead and fast decompression. `zstd` MAY be used on T2+ devices
for better compression ratios at the cost of higher CPU.

### 15.8.5 Bandwidth Budget per Tier

| Metric | T1 (DSL/Cellular) | T2 (Ethernet) | T3 (Dedicated) |
|--------|-------------------|---------------|----------------|
| Uplink available | 1-10 Mbps | 50-100 Mbps | 100 Mbps-1 Gbps |
| Platform allocation | 0.5-2 Mbps | 10-50 Mbps | Unlimited |
| Readings/sec (raw) | 5-50 | 50-500 | 500-5,000 |
| Readings/sec (RBE) | 1-10 | 10-100 | 100-1,000 |
| Cross-org overhead | <10 KB/min | <100 KB/min | <1 MB/min |
| Peak burst | 1 MB/sec | 10 MB/sec | 100 MB/sec |

---

## 15.9 Progressive Enhancement via Layer Composition

### 15.9.1 Same Codebase, Different Tiers

The platform MUST use a single codebase that scales from T1 to T3 via
Effect Layer composition [EFFECT-LAYER]. Tier-appropriate behavior is achieved
by providing different Layer stacks, not by maintaining separate codebases.

```
Single codebase: packages/tmnl/src/lib/iiot/

  T1 Layer Stack:
    SparkplugAdapterLive
    + ReadingProcessorLive
    + AlarmDetectorLive
    + IngestionServiceLive
    (= SparkplugPipelineLayer)

  T2 Layer Stack:
    SparkplugPipelineLayer
    + SingleRunner.layer
    + EntityHandlersLayer          ← Added at T2
    + EventDistributionLayer       ← Added at T2
    + WebSocketServerLayer         ← Added at T2

  T3 Layer Stack:
    SparkplugPipelineLayer
    + SocketRunner.layer            ← Upgraded at T3
    + EntityHandlersLayer
    + EventDistributionLayer
    + WebSocketServerLayer
    + HolonetBridgeLive            ← Added at T3
    + HttpApiLayer                 ← Added at T3
```

### 15.9.2 Tier Detection at Boot

The edge agent MUST detect its tier at boot and compose the appropriate Layer
stack. Tier detection is based on available resources:

```typescript
const detectTier = Effect.gen(function* () {
  const ram = yield* getAvailableRAM
  const cpuCores = yield* getCpuCoreCount
  const hasClusterDB = yield* fileExists("/data/cluster.db")

  if (ram < 2_000_000_000) return "T1" as const        // < 2 GB
  if (ram < 16_000_000_000 && cpuCores <= 8)
    return "T2" as const                                // < 16 GB, <= 8 cores
  return "T3" as const                                  // >= 16 GB or > 8 cores
})

const buildApplicationLayer = (tier: "T1" | "T2" | "T3") => {
  const base = SparkplugPipelineLayer({ sparkplug: config })

  switch (tier) {
    case "T1":
      return base

    case "T2":
      return base.pipe(
        Layer.provideMerge(SingleRunner.layer),
        Layer.provideMerge(EntityHandlersLayer),
        Layer.provideMerge(EventDistributionLayer),
        Layer.provideMerge(WebSocketServerLayer),
      )

    case "T3":
      return base.pipe(
        Layer.provideMerge(SocketRunner.layer({ host: "0.0.0.0", port: 34437 })),
        Layer.provideMerge(EntityHandlersLayer),
        Layer.provideMerge(EventDistributionLayer),
        Layer.provideMerge(WebSocketServerLayer),
        Layer.provideMerge(HolonetBridgeLive),
        Layer.provideMerge(HttpApiLayer),
      )
  }
}
```

### 15.9.3 Configuration-Driven Layer Selection

Alternatively, the tier MAY be explicitly configured in the edge device's
configuration file:

```json
{
  "tier": "T2",
  "nats": {
    "leafNode": {
      "hubUrl": "nats://hub-east.network.io:7422",
      "credentials": "/etc/tmnl/nats.creds"
    },
    "jetstream": {
      "maxAge": "30d",
      "maxBytes": "50GB"
    }
  },
  "cluster": {
    "runner": "SingleRunner",
    "shardGroups": ["assets", "equipment", "events"],
    "shardsPerGroup": 50,
    "storage": { "type": "sqlite", "path": "/data/cluster.db" }
  },
  "sparkplug": {
    "brokerUrl": "mqtt://localhost:1883",
    "groupIds": ["factory-floor"]
  },
  "websocket": {
    "port": 8080,
    "maxConnections": 20
  }
}
```

Explicit configuration SHOULD override auto-detection. This allows operators to
downgrade tier behavior on capable hardware (e.g., running T2 profile on T3
hardware to conserve resources for other applications).

### 15.9.4 Edge-to-Cloud Data Flow

The data flow from edge sensor to cloud mirror traverses 4 stages. Each stage
is tier-independent — the same Effect services are used, with different Layer
configurations:

```
Stage 1: INGEST (T1+)
════════════════════════
  PLC/Sensor ──► MQTT Broker ──► SparkplugAdapter ──► IngestedReading
  (hardware)     (local)          (Effect service)     (Schema type)

  Reference: lib/iiot/adapters/sparkplug-adapter.ts
  Transport: Local MQTT (TCP, no encryption needed for loopback)

Stage 2: PROCESS (T1 partial, T2+ full)
════════════════════════════════════════
  IngestedReading ──► TopicRouter ──► ReadingProcessor ──► AlarmDetector
                      (route by     (batch by time      (threshold check)
                       device)       + count)
                                         │
                                         ▼
                                    ProcessedBatch { readings, violations }

  Reference: lib/iiot/adapters/ingestion-service.ts
  T1: Basic pipeline (route + batch)
  T2+: Full pipeline (route + batch + alarm detection + entity creation)

Stage 3: DISTRIBUTE (T2+)
═════════════════════════
  ProcessedBatch ──► EventDistribution ──┬──► iiot:readings (maxLag 10K)
                     (ChannelService)    ├──► iiot:alarms (maxLag 1K)
                                         ├──► iiot:equipment (maxLag 1K)
                                         └──► iiot:invalidations (maxLag 1K)

  Reference: lib/iiot/realtime/event-distribution.ts
  Fan-out: ChannelService broadcast outlets
  Cross-node: HolonetBridge dual-writes to NATS (T3)

Stage 4: MIRROR (T1+ when connected)
══════════════════════════════════════
  Local JetStream domain ──► Leaf Node ──► Hub JetStream ──► Supercluster
  (per-entity ordered)       (outbound     (aggregated      (global
                              buffer)       mirror)          mirror)

  Transport: NATS leaf node protocol (TLS 1.3)
  Ordering: Per-entity sequential (G-1, G-6)
  Priority: P0 alarms preempt P3 telemetry in outbound buffer
```

---

## 15.10 Codebase Reference Map

| File | Purpose | Relevant Section |
|---|---|---|
| `lib/holonet/nats/connection.ts:40-60` | NatsConnectionService (scoped lifecycle) | 15.2.4 |
| `lib/iiot/adapters/sparkplug-adapter.ts:56-68` | SparkplugAdapterConfig (broker config) | 15.3.3, 15.6.2 |
| `lib/iiot/adapters/sparkplug-adapter.ts:299-300` | DDATA processing (inherent RBE) | 15.8.2 |
| `lib/iiot/adapters/sparkplug-adapter.ts:406-407` | SparkplugAdapterLive (Layer factory) | 15.3.3 |
| `lib/iiot/adapters/ingestion-service.ts:177` | IngestionAdapter service interface | 15.6.3 |
| `lib/iiot/adapters/ingestion-service.ts:297-322` | SparkplugPipelineLayer (full pipeline) | 15.3.3, 15.9.1 |
| `lib/iiot/realtime/event-distribution.ts` | EventDistribution (4-channel hub) | 15.3.4, 15.9.4 |
| `lib/iiot/realtime/holonet-bridge.ts` | HolonetBridge (NATS distributed) | 15.3.5, 15.9.1 |
| `lib/iiot/realtime/websocket-server.ts:68-137` | WebSocket server (T0 clients) | 15.3.2 |
| `lib/iiot/entity/EntityStack.ts:54-67` | EntityHandlersLayer (12 entity types) | 15.3.4, 15.9.1 |
| `lib/iiot/state/` | State services (NATS KV-backed) | 15.3.4 |

---

## 15.11 References

### Normative

- [RFC2119] — Bradner, S. "Key words for use in RFCs."
- [ISA-18.2] — ANSI/ISA-18.2-2016. Management of Alarm Systems.
- [FDA-CFR11] — U.S. FDA, 21 CFR Part 11. Electronic Records.
- [NATS-DECENTRALIZED] — Synadia. "NATS Decentralized JWT Authentication."
- [NATS-JWT] — Synadia. "In-Depth JWT Guide for NATS."

### Informative

- [TMNL-SECURITY] — "Security, Trust & Tenant Isolation." `rfc-section-security-trust.md`
- [TMNL-CONSISTENCY] — "Two-Domain Consistency Model." `rfc-section-two-domain-consistency.md`
- [research-uns-metropolitan.md] — UNS patterns, metropolitan routing
- [research-manufacturing-commons.md] — Platform economics, small manufacturer focus

---

*End of RFC-001 Section 15: Edge-First Architecture*
