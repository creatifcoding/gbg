> **SUPERSEDED**: This document has been replaced by `rfc-section-observability-framework.md` and `rfc-section-monitoring-infrastructure.md`. All unique content (NATS monitoring subjects table, open questions) has been migrated to `rfc-section-monitoring-infrastructure.md`. This file is retained for reference only and MUST NOT be included in the final RFC assembly.

# RFC Section: Monitoring, Observability & Operations (SUPERSEDED)

```
Section:       18 — Monitoring, Observability & Operations
RFC:           001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        temporal-analyst (Val)
Created:       2026-02-09
Dependencies:  Section X (Two-Domain Consistency Model)
               Section Y (Multi-Tenant Network Architecture)
               Section Z (Security, Trust & Tenant Isolation)
Research Base: docs/specifications/research-consistency-models.md
               docs/specifications/rfc-section-two-domain-consistency.md
               docs/specifications/rfc-section-multi-tenant.md
```

---

## 18. Monitoring, Observability & Operations

### 18.1 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### 18.2 Observability Architecture

At 200,000 organizations, observability is itself a distributed systems
challenge. The observability architecture mirrors the two-domain consistency
model (Section X): sovereign metrics within each organization and federated
metrics aggregated at the platform level.

#### 18.2.1 Observability Domains

| Domain | Scope | Data Sovereignty | Retention |
|--------|-------|-----------------|-----------|
| **Sovereign** (per-org) | Entity counts, event rates, latency percentiles, alarm history | Organization-owned; MUST NOT cross org boundaries without explicit export | 90 days minimum on edge; 7 years on cloud per [FDA-CFR11] |
| **Platform** (aggregated) | Total throughput, shard utilization, health scores, SLA compliance | Platform-operated; anonymized where possible | 1 year |
| **Infrastructure** (internal) | NATS server metrics, runner CPU/memory, JetStream storage | Platform-internal; not exposed to organizations | 30 days |

**Requirement**: Sovereign metrics MUST be observable by the organization on
their local edge device even during cloud partition. An operator standing at
Earl's Machine Shop MUST be able to view their own health metrics without
cloud connectivity.

#### 18.2.2 Metric Collection Architecture

```
Edge Device                    Cloud Cluster                  Observability Stack
┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
│ Local Metrics    │           │ Platform Metrics │           │ OpenTelemetry   │
│ Collector        │           │ Aggregator       │           │ Collector       │
│                  │           │                  │           │                  │
│ • Entity counts  │    NATS   │ • Per-org health │   OTLP    │ • Spans         │
│ • Event rates    │──────────►│ • SLA compliance │──────────►│ • Metrics       │
│ • Latency P50/99 │ (account- │ • Shard balance  │           │ • Logs          │
│ • Alarm counts   │  scoped)  │ • CRDT converg.  │           │ • Traces        │
│ • Storage usage  │           │ • Marketplace    │           │                  │
└─────────────────┘           └─────────────────┘           └─────────────────┘
```

#### 18.2.3 NATS Monitoring Subjects

The platform MUST expose monitoring data via NATS subjects for real-time
consumption:

| Subject Pattern | Publisher | Content | Consumers |
|----------------|-----------|---------|-----------|
| `$SYS.REQ.SERVER.PING` | NATS server | Server liveness | Platform monitoring |
| `$SYS.REQ.SERVER.INFO` | NATS server | Server configuration | Capacity planning |
| `$JS.API.CONSUMER.INFO.{stream}.{consumer}` | JetStream | Consumer lag, pending count | SLA monitoring |
| `$JS.API.STREAM.INFO.{stream}` | JetStream | Stream size, message count | Storage forecasting |
| `tmnl.health.{orgId}.{deviceId}` | Edge device | Heartbeat + system metrics | Hub health monitoring |
| `tmnl.metrics.{orgId}.events` | Edge device | Event rate counters | Throughput monitoring |
| `tmnl.platform.shard.{shardGroup}.{shardId}` | Cloud runner | Shard entity count, throughput | Cluster health |
| `tmnl.platform.guarantee.{gN}` | Monitoring service | G-1 through G-8 compliance | SLA dashboards |

**Sovereignty requirement**: Subjects under `tmnl.health.{orgId}.*` and
`tmnl.metrics.{orgId}.*` MUST be scoped to the organization's NATS account
[NATS-ACCOUNTS]. The platform monitoring service accesses them via explicit
cross-account import, which the organization MAY revoke.

#### 18.2.4 OpenTelemetry Integration

The platform MUST emit OpenTelemetry [OTEL] spans and metrics for:

**Spans** (distributed tracing):

| Span Name | Start | End | Attributes |
|-----------|-------|-----|------------|
| `entity.state_transition` | Handler receives event | State machine reaches terminal state | `orgId`, `entityType`, `entityId`, `fromState`, `toState` |
| `entity.propagation` | Parent entity emits event | Last child entity processes event | `propagationRule` (U-1, L-2, D-1), `levels_traversed` |
| `saga.work_order` | `WorkOrderPosted` | `JobCompleted` or timeout | `requestingOrg`, `executingOrg`, `sagaId` |
| `reconciliation` | Edge reconnects | Convergence confirmed | `orgId`, `partitionDuration`, `bufferedEventCount` |

**Metrics** (time series):

| Metric Name | Type | Unit | Labels |
|-------------|------|------|--------|
| `tmnl.events.published` | Counter | events | `orgId`, `channel`, `level` |
| `tmnl.events.latency` | Histogram | milliseconds | `orgId`, `channel`, `level` |
| `tmnl.guarantee.violations` | Counter | violations | `guarantee` (G-1..G-8) |
| `tmnl.partition.duration` | Histogram | seconds | `orgId` |
| `tmnl.shard.entity_count` | Gauge | entities | `shardGroup`, `shardId`, `runnerId` |
| `tmnl.crdt.convergence_time` | Histogram | milliseconds | `aggregate_type` |
| `tmnl.marketplace.orders` | Counter | orders | `status` (posted, accepted, completed) |

### 18.3 Health Check Protocol for Edge Devices

#### 18.3.1 Heartbeat

Each edge device MUST publish a heartbeat message at a configurable interval:

| Organization Tier | Heartbeat Interval | Timeout Threshold | Rationale |
|-------------------|-------------------|-------------------|-----------|
| Tier 1 (1-10 machines) | 30 seconds | 90 seconds | Low overhead for small devices |
| Tier 2 (11-100 machines) | 10 seconds | 30 seconds | Faster fault detection |
| Tier 3 (101+ machines) | 5 seconds | 15 seconds | Critical infrastructure |

**Subject**: `tmnl.health.{orgId}.{deviceId}`

**Payload**:

```
HeartbeatMessage {
  orgId:          string      // Organization identifier
  deviceId:       string      // Edge device identifier
  timestamp:      ISO-8601    // Edge device clock
  uptime:         uint64      // Seconds since last restart
  entityCount:    uint32      // Active entities on this device
  eventRate:      float64     // Events per second (5-min average)
  version:        string      // TMNL agent version
  partitioned:    boolean     // Whether device considers itself partitioned
}
```

**Implementation**: The health endpoint (`src/lib/iiot/http/health.ts`) currently
returns a simple `{ status: 'ok', timestamp }` response. For the metropolitan
network, this MUST be extended to publish structured heartbeat messages to the
NATS health subject.

#### 18.3.2 Liveness

In addition to the heartbeat, the edge device MUST publish system metrics at
the heartbeat interval:

```
LivenessReport {
  cpuUsagePercent:   float64   // 0-100
  memoryUsageBytes:  uint64    // Used memory
  memoryTotalBytes:  uint64    // Total memory
  diskUsagePercent:  float64   // JetStream storage volume
  uplinkQuality:     enum      // 'excellent' | 'good' | 'degraded' | 'offline'
  uplinkLatencyMs:   uint32    // Round-trip to nearest NATS server
  jetstreamLag:      uint64    // Total pending messages across all streams
}
```

**Alert thresholds**:

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| CPU | > 80% sustained 5 min | > 95% sustained 1 min | Reduce sample rate |
| Memory | > 80% | > 95% | Trigger GC, alert operator |
| Disk | > 70% | > 85% | Increase retention pruning |
| Uplink quality | `degraded` | `offline` | Enter partition mode |
| JetStream lag | > 10,000 msgs | > 100,000 msgs | Alert: processing bottleneck |

#### 18.3.3 Readiness

The edge device MUST distinguish between **alive** (process running) and
**ready** (capable of processing entities):

| State | Meaning | Heartbeat Behavior |
|-------|---------|-------------------|
| `starting` | Agent initializing, loading entity config | Heartbeat includes `ready: false` |
| `ready` | All entity handlers active, sensors connected | Heartbeat includes `ready: true` |
| `degraded` | Some sensors disconnected, partial processing | Heartbeat includes `ready: 'partial'`, list of affected entities |
| `draining` | Shutting down gracefully, flushing buffers | Heartbeat includes `ready: false`, `draining: true` |

**Requirement**: The cloud cluster MUST NOT route new entity events to an edge
device that reports `ready: false`. Events for entities on a non-ready device
MUST be buffered in the cloud JetStream until the device reports `ready: true`.

#### 18.3.4 Timeout Detection and Escalation

When the hub monitoring service detects a heartbeat timeout:

1. **T + timeout**: Emit `DeviceUnresponsive(orgId, deviceId)` advisory
2. **T + 2x timeout**: Emit `OrgStale(orgId)` advisory (cross-org subscribers
   are notified that this organization's data is stale)
3. **T + 5 minutes**: Emit `AvailabilityChanged(orgId, status: 'offline')` to
   the manufacturing commons
4. **T + 7 days**: Emit `DataLossWarning(orgId)` — edge device's JetStream
   retention window is likely exhausted

**Implementation**: Timeout detection maps to the EventDistribution channel
pattern (`src/lib/iiot/realtime/event-distribution.ts`). The monitoring service
subscribes to the health subject wildcard (`tmnl.health.>`) and tracks
last-seen timestamps per device.

#### 18.3.5 Self-Healing

The edge agent MUST implement automatic recovery for common failure modes:

| Failure Mode | Detection | Recovery | Max Retries |
|-------------|-----------|----------|-------------|
| Agent process crash | systemd watchdog / process supervisor | Auto-restart with exponential backoff | 5 per hour |
| NATS server unresponsive | Health check to localhost NATS | Restart NATS server process | 3 per hour |
| JetStream storage corruption | Stream integrity check on startup | Delete and recreate stream from mirror | 1 per day |
| Sensor disconnect | Polling timeout > 3x sample interval | Re-probe sensor with protocol discovery | Continuous |
| TLS certificate expiry | Cert validity check on heartbeat | Request new cert via ACME or platform API | 3 attempts |

**Requirement**: Self-healing MUST be logged locally and reported to the cloud
upon reconnection. The platform MUST track self-healing events per device to
identify recurring hardware or software issues.

### 18.4 Consistency Guarantee Monitoring

For each formal guarantee defined in Section X, the platform MUST implement
continuous monitoring:

#### 18.4.1 G-1: Per-Entity Sequential Ordering

| Aspect | Specification |
|--------|--------------|
| **Metric** | Out-of-order event count per entity |
| **Detection** | Sequence number gap detection: if `seq(N+1) - seq(N) != 1`, increment counter |
| **Alert threshold** | > 0 violations per 5-minute window (any violation is critical) |
| **Implementation** | Per-entity sequence number tracking in JetStream consumer. The consumer maintains `lastSeq` per entity and flags any non-monotonic delivery. |
| **Codebase ref** | Entity handlers in `src/lib/iiot/entity/EntityStack.ts:54-67` — each handler layer can inject sequence validation middleware |

#### 18.4.2 G-2: Per-Entity Causal Ordering

| Aspect | Specification |
|--------|--------------|
| **Metric** | Causal violation count (effect observed before cause) |
| **Detection** | For events with `causedBy` metadata: verify that the referenced event has already been processed |
| **Alert threshold** | > 0 violations per 5-minute window |
| **Implementation** | Causal ordering is subsumed by G-1 for single-entity events. Cross-entity causal validation requires checking the `causedBy` chain, which is an extension point (see Section X.12.2) |

#### 18.4.3 G-3: Cross-Entity Causal Ordering (Same Org)

| Aspect | Specification |
|--------|--------------|
| **Metric** | Cross-entity causal delay (time between parent event and child event) |
| **Detection** | Compare timestamps of causally-linked events across entities (e.g., Machine FAULT → Line DEGRADE) |
| **Alert threshold** | Delay exceeding ISA-95 level staleness budget (see G-5) |
| **Note** | G-3 is SHOULD, not MUST — violations are advisory, not critical |

#### 18.4.4 G-4: Session Consistency

| Aspect | Specification |
|--------|--------------|
| **Metric** | Read-your-writes violation count per WebSocket session |
| **Detection** | Client sends write command, then read — if read returns stale state, increment counter |
| **Alert threshold** | > 0 per session |
| **Implementation** | WebSocket server (`src/lib/iiot/realtime/websocket-server.ts`) tracks per-session last-written sequence. Streaming RPCs (`src/lib/iiot/rpc/RealtimeRpcs.ts`) deliver events in sequence order. |

#### 18.4.5 G-5: Bounded Staleness (Intra-Org)

| Aspect | Specification |
|--------|--------------|
| **Metric** | P99 delivery latency per ISA-95 level |
| **Detection** | End-to-end: `networkTimestamp - originTimestamp` for each event. Bucket by ISA-95 level. |
| **Alert thresholds** | Per Section X, G-5: |

| ISA-95 Level | Max Staleness | SLA Target | Alert if P99 exceeds |
|--------------|---------------|------------|---------------------|
| L0 (Physical Process) | 100ms | 99.99% within 100ms | 150ms |
| L1 (Basic Control) | 250ms | 99.99% within 250ms | 400ms |
| L2 (Supervisory Control) | 1 second | 99.9% within 1s | 2 seconds |
| L3 (Manufacturing Operations) | 5 seconds | 99% within 5s | 10 seconds |
| L4 (Business Planning) | 30 seconds | 95% within 30s | 60 seconds |

| Aspect | Specification |
|--------|--------------|
| **Implementation** | Latency histograms per channel in EventDistribution (`src/lib/iiot/realtime/event-distribution.ts:136-157`). Each channel's maxLag provides the backpressure boundary; latency measurement provides the SLA boundary. |
| **Codebase ref** | Channel definitions: `iiot:readings` (maxLag 10,000), `iiot:alarms` (maxLag 1,000), `iiot:equipment` (maxLag 1,000), `iiot:invalidations` (maxLag 1,000) |

#### 18.4.6 G-6: Partition Tolerance

| Aspect | Specification |
|--------|--------------|
| **Metric** | Partition event count, partition duration histogram, replay gap count |
| **Detection** | Edge device reports `partitioned: true` in heartbeat. Duration measured from first `partitioned: true` to first `partitioned: false`. Replay gaps detected by sequence continuity audit after reconnection. |
| **Alert thresholds** | Partition > 5 min: Warning. Partition > 24 hours: Critical. Replay gap > 0: Critical (data loss). |
| **Implementation** | HolonetBridge (`src/lib/iiot/realtime/holonet-bridge.ts`) manages the NATS connection. Partition detection triggers dual-publish fallback to local-only mode in EventDistribution. |

#### 18.4.7 G-7: Idempotent Processing

| Aspect | Specification |
|--------|--------------|
| **Metric** | Duplicate delivery count, dedup cache hit rate |
| **Detection** | Track content-addressed message IDs (`hash(orgId, entityType, entityId, sequenceNumber)`). Count how often a previously-seen ID is re-delivered. |
| **Alert threshold** | Dedup rate > 1% of total volume (indicates replay storm or misconfiguration) |
| **Note** | Some dedup is expected during partition healing (G-6 reconnection). Dedup rate SHOULD be near 0% during normal operation. |

#### 18.4.8 G-8: Cross-Organization Bounded Staleness

| Aspect | Specification |
|--------|--------------|
| **Metric** | Cross-org P99 staleness latency |
| **Detection** | For events crossing org boundaries: `now() - networkTimestamp` at the receiving subscriber. Sample 1% of cross-org events per minute (exhaustive monitoring at 200K orgs is impractical). |
| **Alert thresholds** | P99 > 60 seconds: Warning. P99 > 120 seconds: Critical. > 1% of sampled events exceeding 60s: SLA violation. |
| **CRDT convergence** | Additionally monitor time from org KV update to aggregate recalculation. Target: < 30 seconds (P50). |

### 18.5 SLA Monitoring per ISA-95 Level

#### 18.5.1 SLA Budgets

The platform MUST track SLA compliance per ISA-95 level with the following
targets:

| ISA-95 Level | SLA Target | Measurement Window | Violation Severity |
|--------------|-----------|-------------------|-------------------|
| L0-L1 (Safety-Critical) | 99.99% within staleness budget | 5-minute rolling | CRITICAL — safety implications |
| L2 (Alarm Management) | 99.9% within 1 second | 5-minute rolling | HIGH — ISA-18.2 compliance [ISA-18.2] |
| L3 (Manufacturing Ops) | 99% within 5 seconds | 15-minute rolling | MEDIUM — operational impact |
| L4 (Business Planning) | 95% within 30 seconds | 1-hour rolling | LOW — informational |
| Cross-org (G-8) | 99% within 60 seconds | 1-hour rolling | MEDIUM — marketplace impact |

#### 18.5.2 SLA Violation Response

When an SLA violation is detected:

1. **Emit `SLAViolation` event** to the platform monitoring stream with:
   - Affected ISA-95 level
   - Affected organization(s)
   - Duration of violation
   - Measured P99 latency vs target
   - Suspected root cause (if determinable)

2. **Auto-escalation** based on severity:

| Severity | Initial Response | Escalation at 5 min | Escalation at 30 min |
|----------|-----------------|---------------------|---------------------|
| CRITICAL | Page on-call engineer | Page engineering manager | Page VP Engineering |
| HIGH | Alert on-call engineer | Page on-call engineer | Page engineering manager |
| MEDIUM | Create incident ticket | Alert on-call engineer | Page on-call engineer |
| LOW | Log for review | Create incident ticket | Alert on-call engineer |

3. **Automatic mitigation** (where possible):
   - L0-L1 violation → Check edge device health, trigger self-healing if needed
   - L2 violation → Check consumer lag on alarm channel, scale consumers
   - G-8 violation → Check cloud NATS cluster health, verify leaf node connectivity

#### 18.5.3 SLA Reporting

The platform MUST generate SLA compliance reports:

- **Real-time dashboard**: Per-level SLA gauges with 5-minute granularity
- **Daily summary**: Compliance percentage per level, top violating organizations
- **Monthly report**: Trend analysis, capacity projections, regulatory compliance
  evidence per [FDA-CFR11]

### 18.6 Cluster Health Aggregation

#### 18.6.1 Per-Runner Metrics

Each @effect/cluster runner MUST expose:

| Metric | Type | Collection Interval | Alert Threshold |
|--------|------|-------------------|----------------|
| Active entity count | Gauge | 3 seconds (per ShardingConfig default) | > 80% of capacity |
| Message throughput | Counter | 1 second | Sustained > 90% of rated capacity |
| CPU usage | Gauge | 5 seconds | > 80% sustained 5 min |
| Memory usage | Gauge | 5 seconds | > 80% of heap limit |
| Entity creation latency | Histogram | Per-event | P99 > 100ms |
| Shard count | Gauge | On change | Imbalanced (>2x median) |

#### 18.6.2 Shard Health

| Metric | Computation | Alert Condition |
|--------|------------|----------------|
| Shard distribution balance | `max(entities_per_shard) / mean(entities_per_shard)` | Ratio > 3.0 |
| Shard migration events | Counter per 5-min window | > 10 migrations (storm) |
| Orphaned shards | Shards with no assigned runner | > 0 for > 30 seconds |
| Cross-shard entity requests | Counter (entity routed to wrong shard) | > 0 (indicates stale routing) |

**Shard migration storm detection**: If more than 10 shard migrations occur
within a 5-minute window, the platform MUST:
1. Emit `ShardMigrationStorm` alert
2. Pause non-critical shard rebalancing for 5 minutes
3. Investigate root cause (runner failure, network partition, load spike)

#### 18.6.3 Runner Discovery Health

| Component | Health Check | Failure Impact |
|-----------|-------------|----------------|
| RunnerStorage | Read/write probe every 5s | No new runners can register |
| Leader election | Raft heartbeat monitoring | Split-brain risk |
| HashRing consistency | Cross-runner ring comparison | Shard routing divergence |

### 18.7 NATS Infrastructure Monitoring

#### 18.7.1 JetStream Monitoring

| Metric | Subject / API | Alert Threshold | Rationale |
|--------|--------------|----------------|-----------|
| Stream lag | `$JS.API.CONSUMER.INFO` → `num_pending` | > 10,000 messages | Processing bottleneck |
| Consumer pending count | `$JS.API.CONSUMER.INFO` → `num_ack_pending` | > 1,000 | Slow consumer |
| Stream storage size | `$JS.API.STREAM.INFO` → `state.bytes` | > 80% of limit | Data loss risk |
| Message rate | `$JS.API.STREAM.INFO` → delta of `state.messages` | Drop > 50% vs 5-min average | Sensor failure |
| Ack pending timeout | Consumer config → `ack_wait` exceeded | > 5% of messages | Consumer crash |

#### 18.7.2 NATS KV Monitoring

| Metric | Detection | Alert Threshold |
|--------|-----------|----------------|
| Watch latency | Round-trip time for KV watch subscription | P99 > 500ms |
| Revision rate | Delta of revision number per bucket per minute | Sustained > 1000/min (noisy writer) |
| Bucket size | `$JS.API.STREAM.INFO` on KV backing stream | > 80% of configured max |
| Stale entries | Entries not updated within expected TTL | > 5% of keys |

#### 18.7.3 Per-Account Monitoring

For each organization's NATS account [NATS-ACCOUNTS]:

| Metric | Alert Threshold | Remediation |
|--------|----------------|-------------|
| Message rate | > 90% of account limit | Warn org; increase limit with approval |
| Byte usage | > 80% of account limit | Warn org; prune old streams |
| Connection count | > 80% of account limit | Investigate (possible credential leak) |
| Export count | > 50 active exports | Review: excessive cross-org sharing |
| Import count | > 100 active imports | Review: excessive dependency on network |

#### 18.7.4 Supercluster Health

| Metric | Detection | Alert Threshold |
|--------|-----------|----------------|
| Gateway connectivity | Inter-cluster ping latency | > 100ms (cross-region) |
| Leaf node count | `$SYS` subject monitoring | Drop > 5% in 5 minutes |
| Cross-region latency | Gateway round-trip measurement | P99 > 200ms |
| Raft leader stability | Leader change event count | > 3 changes per hour |

### 18.8 Alerting & Escalation Framework

#### 18.8.1 Alert Tiers

| Tier | Meaning | Response Time | Notification Channel |
|------|---------|--------------|---------------------|
| **INFO** | Notable event, no action required | Next business day | Dashboard, daily digest |
| **WARNING** | Degradation detected, may self-resolve | 30 minutes | Slack/email alert |
| **CRITICAL** | Service degradation, customer impact | 5 minutes | PagerDuty, SMS |
| **EMERGENCY** | Safety system failure, data loss risk | Immediate | PagerDuty (high-urgency), phone call |

#### 18.8.2 Alert Routing by Domain

| Domain | Team | Examples |
|--------|------|---------|
| Entity consistency (G-1 through G-7) | Entity Platform Team | Sequence violations, causal ordering failure |
| Cross-org consistency (G-8) | Network Platform Team | Bounded staleness exceeded, CRDT divergence |
| Edge device health | Edge Infrastructure Team | Heartbeat timeout, self-healing failure |
| NATS infrastructure | Infrastructure Team | JetStream lag, cluster partition, leader instability |
| Marketplace operations | Marketplace Team | Saga timeout, bid processing delay |
| Shard management | Cluster Operations Team | Migration storm, orphaned shards, hot shards |

#### 18.8.3 Auto-Escalation Rules

```
Consistency violation (G-1, G-2, G-7) detected
  → IMMEDIATE: CRITICAL alert to Entity Platform Team
  → +5 min unresolved: Page engineering manager
  → +15 min unresolved: Page VP Engineering
  → Rationale: Any ordering or dedup violation is a data integrity issue

Latency degradation (G-5 SLA breach) detected
  → 5-MINUTE WINDOW: Aggregate violations
  → If > threshold: WARNING alert
  → If sustained > 15 min: CRITICAL escalation
  → Rationale: Transient spikes are acceptable; sustained degradation is not

Edge device offline detected
  → +90 seconds: INFO (DeviceUnresponsive)
  → +5 minutes: WARNING (OrgStale)
  → +24 hours: CRITICAL (extended partition)
  → +7 days: EMERGENCY (DataLossWarning)

Shard migration storm detected
  → IMMEDIATE: WARNING alert to Cluster Operations
  → Auto-action: Pause rebalancing for 5 minutes
  → +10 min unresolved: CRITICAL escalation
```

### 18.9 Capacity Planning

#### 18.9.1 Entity Growth Projections

Growth in the metropolitan manufacturing network is **bimodal**:

1. **Linear growth**: New organizations joining the network (~100/month projected)
2. **Exponential growth per org**: Existing organizations adding devices and
   sensors as they adopt more automation

| Growth Vector | Metric | Projection Method |
|---------------|--------|-------------------|
| New organizations | Accounts per month | Linear regression on signup rate |
| Entities per org | Entity count growth rate per org | Per-org exponential fit |
| Event volume | Events per second across all orgs | Entity count × average sample rate |
| Storage | JetStream bytes per day | Event volume × avg event size × retention |

#### 18.9.2 Shard Rebalancing Triggers

The @effect/cluster shard allocator SHOULD rebalance when:

| Condition | Action | Cooldown |
|-----------|--------|----------|
| Any runner exceeds 80% entity capacity | Rebalance shards from overloaded runner | 5 minutes |
| Runner added to cluster | Redistribute shards to include new runner | Immediate |
| Runner removed from cluster | Redistribute orphaned shards | Immediate |
| Shard group entity count doubles | Consider increasing `shardsPerGroup` | Manual approval required |

#### 18.9.3 JetStream Storage Forecasting

```
daily_storage = Σ_orgs (event_rate_per_org × avg_event_size × 86400)
retention_storage = daily_storage × retention_days
projected_30d = current_storage + (daily_storage × 30) × (1 + growth_rate)
```

**Alert**: When `projected_30d > 80% of provisioned storage`, emit a
`StorageCapacityWarning` with the projected exhaustion date.

#### 18.9.4 NATS Connection Limits

| Scope | Default Limit | Alert at | Hard Limit |
|-------|--------------|----------|------------|
| Per account (per org) | 10 connections | 8 | 20 (requires approval) |
| Per server | 50,000 connections | 40,000 | 65,536 (OS limit) |
| Cluster-wide | 200,000 connections | 160,000 | 250,000 |

**Scaling trigger**: When cluster-wide connections exceed 80% of limit, the
platform MUST provision additional NATS servers and add them to the supercluster.

### 18.10 Operational Runbooks

Each runbook follows the structure: **Detection → Diagnosis → Remediation →
Verification → Post-mortem**.

#### 18.10.1 Runbook: Edge Device Goes Offline

**Detection**: `DeviceUnresponsive(orgId, deviceId)` alert (heartbeat timeout).

**Diagnosis**:
1. Check last heartbeat payload — was `uplinkQuality` already `degraded`?
2. Check NATS leaf node connection status via `$SYS` subjects
3. Check whether other devices on the same network segment are affected
4. If device was healthy at last heartbeat → likely network issue
5. If device reported `degraded` → likely hardware issue

**Remediation**:
1. If network issue → wait for auto-reconnection (exponential backoff)
2. If hardware issue → alert organization operator via secondary channel (SMS/email)
3. If multiple devices affected → investigate upstream network equipment
4. Monitor for `partitioned: false` in next heartbeat

**Verification**: Device resumes heartbeat. Reconciliation protocol (Section Y.5)
completes. Sequence continuity audit passes. `OrgStale` advisory cleared.

**Post-mortem**: Log partition duration, event count during partition, replay
duration. Flag if partition > 24 hours for capacity review.

#### 18.10.2 Runbook: Consistency Guarantee Violation

**Detection**: `tmnl.platform.guarantee.{gN}` metric exceeds threshold.

**Diagnosis**:
1. Identify which guarantee (G-1 through G-8) is violated
2. Identify affected organization(s) and entity type(s)
3. Pull event stream around violation timestamp
4. For G-1: Check JetStream consumer sequence — is it a consumer bug or a
   JetStream delivery issue?
5. For G-5: Check end-to-end latency breakdown — is delay in edge, network,
   or cloud processing?
6. For G-8: Check cloud NATS cluster health — is Raft consensus stable?

**Remediation**:
- G-1 (sequence violation): Halt affected consumer. Replay from last known good
  sequence. File JetStream bug report if server-side.
- G-5 (latency): Scale consumers for affected channel. If edge-side, check
  device liveness. If cloud-side, add runners.
- G-7 (duplicate): Check dedup cache capacity. Increase cache if needed.
  If caused by partition healing, dedup rate should normalize within 60s.
- G-8 (staleness): Check leaf node connectivity. If cloud partition, wait for
  Raft recovery. Emit `SLAViolation` to affected marketplace consumers.

**Verification**: Guarantee metric returns below threshold. No violations in
next 15-minute window.

**Post-mortem**: Root cause analysis. If systemic (not transient), create
engineering ticket. Update runbook if new failure mode discovered.

#### 18.10.3 Runbook: Shard Migration Storm

**Detection**: > 10 shard migrations in 5-minute window.

**Diagnosis**:
1. Check for runner failures (sudden capacity loss triggers mass rebalancing)
2. Check for HashRing instability (flapping runner registration)
3. Check for entity count spike (new large organization onboarded)

**Remediation**:
1. **Auto-action**: Pause non-critical rebalancing for 5 minutes
2. If runner failure → verify runner is actually down, not just slow
3. If HashRing flap → stabilize runner registration (increase health check
   timeout)
4. If entity spike → ensure new entities are spread across shards (check
   hash distribution)

**Verification**: Migration rate returns to < 1 per minute. Shard distribution
balance ratio < 3.0. No orphaned shards.

#### 18.10.4 Runbook: NATS Leader Election During Peak Load

**Detection**: > 3 Raft leader changes per hour on any JetStream meta-group.

**Diagnosis**:
1. Check leader node resource usage (CPU, memory, network)
2. Check Raft heartbeat interval vs actual round-trip time
3. Check for clock skew between cluster nodes
4. Check for network micro-partitions (partial connectivity)

**Remediation**:
1. If resource exhaustion → scale up leader node or reduce load
2. If network latency → check inter-node connectivity, switch to lower-latency
   network path
3. If clock skew → synchronize clocks (NTP/PTP)
4. **Critical**: During leader instability, `networkTimestamp` assignment for
   G-8 may have gaps. Cross-org events during this period SHOULD be flagged
   with `timestampQuality: 'degraded'`

**Verification**: Leader stable for > 30 minutes. No `networkTimestamp` gaps.
G-8 staleness metric within bounds.

#### 18.10.5 Runbook: Cross-Org Saga Timeout

**Detection**: `saga.work_order` span duration exceeds timeout (default: 24 hours).

**Diagnosis**:
1. Identify stuck step: `WorkOrderPosted` → `BidSubmitted` → `WorkOrderAccepted`
   → `JobCompleted`
2. Check both organizations' connectivity
3. Check if executing org's edge device is offline
4. Check if marketplace events are being delivered (G-8 compliance)

**Remediation**:
1. If stuck at `BidSubmitted` (no bids) → no action (market behavior)
2. If stuck at `WorkOrderAccepted` (bid exists, no acceptance) → alert
   requesting org operator
3. If stuck at `JobCompleted` (accepted, not completed) → check executing
   org's device health
4. If executing org offline → saga remains in `executing` state until
   reconnection or timeout
5. On timeout → emit `SagaTimeout` event, release capacity reservation,
   allow re-posting

**Verification**: Saga reaches terminal state (completed or timed out).
Capacity reservations are released. Both orgs' CRDT entries are consistent.

#### 18.10.6 Runbook: JetStream Storage Approaching Capacity

**Detection**: `StorageCapacityWarning` — projected 30-day storage > 80% of limit.

**Diagnosis**:
1. Identify highest-volume streams (which orgs, which entity types)
2. Check if growth is organic (new devices) or anomalous (sensor flooding)
3. Review retention policies — is 7-day edge retention sufficient?

**Remediation**:
1. If organic → provision additional storage, update account limits
2. If anomalous → investigate flooding source, implement per-org rate limiting
3. If retention too long → negotiate shorter retention where regulatory
   requirements allow
4. Consider stream compaction for state-based entities (only latest state needed)

**Verification**: Storage growth rate stabilizes. Projected exhaustion date
moves beyond acceptable horizon (> 90 days).

#### 18.10.7 Runbook: New Organization Onboarding Failure

**Detection**: Onboarding protocol (Section Y.7.1) fails to complete within
15 minutes.

**Diagnosis**:
1. Check which step failed:
   - Account creation (JWT signing failure?)
   - Edge device provisioning (QR code scan failure? Network issue?)
   - Sensor discovery (no sensors found? Protocol mismatch?)
   - Marketplace opt-in (export configuration failure?)
2. Check platform operator signing key validity
3. Check edge device hardware compatibility

**Remediation**:
1. If JWT signing → verify operator signing key, regenerate if expired
2. If network → verify edge device can reach cloud NATS cluster (TLS, DNS)
3. If sensor discovery → manual sensor configuration as fallback
4. If marketplace → skip opt-in (organization can opt in later)

**Verification**: Edge device heartbeat received. At least one entity created.
Organization appears in platform dashboard.

### 18.11 Codebase Implementation Reference

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| Health endpoint | `src/lib/iiot/http/health.ts` | Currently minimal (`{ status: 'ok' }`); needs extension for structured heartbeat |
| EventDistribution channels | `src/lib/iiot/realtime/event-distribution.ts:136-157` | 4 channels with maxLag — provides backpressure monitoring substrate |
| Dual-publish (local + NATS) | `src/lib/iiot/realtime/event-distribution.ts:280-326` | Partition detection: if NATS publish fails, local-only mode |
| HolonetBridge | `src/lib/iiot/realtime/holonet-bridge.ts` | NATS connectivity — partition detection lives here |
| NATS subject specs | `src/lib/iiot/realtime/iiot-subjects.ts` | 4 subjects with parametric placeholders; monitoring subjects are an extension point |
| WebSocket server | `src/lib/iiot/realtime/websocket-server.ts` | Session tracking for G-4 monitoring |
| Streaming RPCs | `src/lib/iiot/rpc/RealtimeRpcs.ts` | 4 streaming RPCs — subscription health monitoring |
| Entity handlers | `src/lib/iiot/entity/EntityStack.ts:54-67` | 12 entity layers — sequence validation middleware injection point |
| State services | `src/lib/iiot/state/index.ts` | 12 state services — state read latency monitoring |
| Ingestion pipeline | `src/lib/iiot/adapters/ingestion-service.ts:297-322` | SparkplugPipelineLayer — end-to-end ingestion latency |
| ISA-95 identifiers | `src/lib/iiot/schemas/identifiers.ts` | Branded types for org/entity scoping in metrics labels |
| ChannelService | `src/lib/streams/constructs/ChannelService.ts` | Broadcast outlet lag metrics — per-subscriber consumer lag |

**Extension points**:
1. **Monitoring subject specs**: New NATS subjects for `tmnl.health.*`,
   `tmnl.metrics.*`, `tmnl.platform.*` (extend `iiot-subjects.ts` pattern)
2. **Heartbeat service**: Effect service that publishes structured heartbeat
   messages at configured intervals (new service)
3. **SLA monitoring service**: Effect service that samples event latencies and
   tracks G-1 through G-8 compliance (new service)
4. **OpenTelemetry exporter**: Effect layer that bridges EventDistribution
   channel events to OTLP spans and metrics (new layer)

---

## Open Questions

1. **Monitoring overhead at scale**: At 200K organizations, even 1% sampling of
   cross-org events is 2,000 event evaluations per minute. Is this sufficient
   for G-8 compliance detection, or does sampling miss edge cases?

2. **Sovereign metric export consent**: When should the platform be allowed to
   access an organization's sovereign metrics without explicit export? Emergency
   response to safety-critical SLA violations may require immediate access.

3. **Self-healing audit trail**: Self-healing events (auto-restart, stream
   recreation) should be logged immutably for regulatory compliance. Should
   they flow through the same EventLog as entity events, or through a
   separate operations log?

4. **NATS `$SYS` subject access**: NATS system subjects require system account
   access. How is this access controlled in the multi-tenant architecture?
   Platform monitoring needs `$SYS` access but organizations MUST NOT have it.

5. **Runbook automation scope**: Which runbook steps should be fully automated
   vs requiring human approval? Auto-healing edge devices is low-risk;
   auto-scaling cloud infrastructure has cost implications.

---

## References

All references use canonical keys from the project bibliography
(`docs/specifications/bibliography.md`).

### Normative

- [RFC2119] — Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
- [ISA-18.2] — ANSI/ISA-18.2-2016. Management of Alarm Systems.
- [FDA-CFR11] — U.S. FDA, 21 CFR Part 11. Electronic Records.

### NATS / JetStream

- [NATS-ACCOUNTS] — Synadia. "NATS Account-Based Security."
- [NATS-DEDUP-INF] — Synadia. "Infinite Message Deduplication in JetStream."

### Observability

- [OTEL] — OpenTelemetry Project. "OpenTelemetry Specification."

### Internal

- [TMNL-CONSISTENCY] — Section X: Two-Domain Consistency Model.
- [TMNL-MULTITENANT] — Section Y: Multi-Tenant Network Architecture.
