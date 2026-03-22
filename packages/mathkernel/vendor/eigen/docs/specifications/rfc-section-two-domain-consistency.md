# RFC Section: Two-Domain Consistency Model

```
Section:       Consistency Guarantees & Ordering Semantics
RFC:           001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        temporal-analyst (Val)
Created:       2026-02-09
Research Base: docs/specifications/research-consistency-models.md (Sections 1-8)
```

---

## X. Consistency Guarantees and Ordering Semantics

### X.1 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### X.2 Two-Domain Temporal Model

The metropolitan manufacturing network operates in **two distinct temporal domains**
with fundamentally different consistency requirements. This bifurcation is the
governing architectural principle for all ordering and consistency decisions.

#### X.2.1 Domain 1: Intra-Organization (Sovereign)

Domain 1 encompasses all entity events within a single organization's boundary.
The organization controls all devices, clocks, and trust relationships.

Properties:

- **Scope**: One organization's entities (machines, sensors, alarms, work orders)
- **Trust model**: Fully trusted — the organization owns all edge devices
- **Clock authority**: Edge device's local clock is authoritative for ordering
- **Offline behavior**: MUST operate indefinitely without cloud connectivity
- **ISA-95 depth**: Adaptive (see X.5)
- **Applicable guarantees**: G-1 through G-7

#### X.2.2 Domain 2: Cross-Organization (Federated)

Domain 2 encompasses events that cross organization boundaries — network-level
aggregates, marketplace signals, and shared status information.

Properties:

- **Scope**: Network-level aggregates, marketplace events, cross-org status
- **Trust model**: Untrusted — other organizations' clocks and data integrity
  cannot be verified
- **Clock authority**: Network-assigned timestamp (cloud NATS cluster) is
  authoritative for ordering
- **Offline behavior**: MUST degrade gracefully — offline organizations disappear
  from network views but resume participation upon reconnection
- **ISA-95 depth**: Flattened — the organization is the atomic unit
- **Applicable guarantees**: G-8

### X.3 Intra-Organization Ordering Guarantees (G-1 through G-7)

The following guarantees apply within Domain 1 (a single organization). They are
enforced by the local NATS JetStream instance on the organization's edge device
and by @effect/cluster [EFFECT-CLUSTER] entity management on cloud nodes.

#### G-1: Per-Entity Sequential Ordering

For any single entity instance `e`, all state transition events MUST be observed
in the order they were produced. If transition `T1` occurs before `T2` on entity
`e`, then every consumer of `e`'s event stream MUST observe `T1` before `T2`.

**Implementation**: JetStream stream per entity type with subject filter
`iiot.{orgId}.entity.{entityType}.{entityId}`. Per-subject ordering within a
stream is guaranteed by JetStream [JETSTREAM].

**Verification**: Monotonically increasing sequence numbers per entity. Any gap
or reordering MUST be flagged as a `SequenceViolation` error.

#### G-2: Per-Entity Causal Ordering

For any single entity instance `e`, if event `A` causally precedes event `B`
(i.e., `B` was produced as a direct consequence of processing `A`), then `A`
MUST be observed before `B` by all consumers.

**Implementation**: Subsumed by G-1 — sequential ordering on a single entity
inherently preserves causality within that entity.

#### G-3: Cross-Entity Causal Ordering (Same Organization)

If a state transition on entity `A` causally triggers a state transition on
entity `B` within the same organization (e.g., `Machine.MarkFaulted` causes
`Line.MarkDegraded`), then the machine fault event SHOULD be observable before
the line degradation event.

**Implementation**: Causal metadata (`causedBy` field referencing source entity
and sequence number) in the `EntityStateChanged` event schema. Consumers that
require causal ordering MUST use the `causedBy` chain to reconstruct order.

**Note**: This is SHOULD, not MUST. Strict cross-entity causal ordering across
separate JetStream subjects would require a total ordering protocol. The causal
metadata enables consumers to reconstruct order when needed without imposing
global coordination.

#### G-4: Session Consistency

Within a single client session (e.g., one WebSocket connection), the client
MUST observe:

- **Read-your-writes**: Any state change initiated by the client is visible in
  subsequent reads within the same session.
- **Monotonic reads**: The client never observes an older state after having
  observed a newer state for the same entity.
- **Monotonic writes**: Commands issued by the client are applied in the order
  they were sent.

**Implementation**: WebSocket connections maintain per-client subscription state.
The RPC handler tracks the last-seen sequence number per entity per session and
filters duplicates.

#### G-5: Bounded Staleness (Intra-Organization)

For events within the same organization, staleness bounds are ISA-95 level
dependent:

| ISA-95 Level | Maximum Staleness | Rationale |
|--------------|-------------------|-----------|
| L0 (Physical Process) | 100ms | Sensor control loops |
| L1 (Basic Control) | 250ms | Safety interlock ordering |
| L2 (Supervisory Control) | 1 second | Alarm management [ISA-18.2] |
| L3 (Manufacturing Operations) | 5 seconds | Work order management |
| L4 (Business Planning) | 30 seconds | Cross-site analytics |

**Implementation**: Staleness monitoring via timestamp comparison. Events
exceeding their level's staleness threshold MUST emit an
`EventLatencyExceeded` alert.

#### G-6: Partition Tolerance (Edge-Cloud)

When the edge device loses connectivity to the cloud NATS cluster:

1. The edge JetStream domain MUST continue accepting and persisting events
   locally.
2. Intra-organization guarantees G-1 through G-5 MUST continue to be enforced
   locally.
3. Upon reconnection, buffered events MUST be delivered to the cloud cluster
   preserving per-entity sequential ordering (G-1).
4. The cloud cluster MUST NOT reject events based on wall-clock time gaps.

**Implementation**: JetStream domain mirroring. The edge domain is the primary;
the cloud domain is a mirror that catches up on reconnection.

#### G-7: Idempotent Processing

Every entity event MUST carry a deterministic message ID (content-addressed:
`hash(orgId, entityType, entityId, sequenceNumber)`). Consumers MUST deduplicate
based on this ID. JetStream deduplication [NATS-DEDUP-INF] provides the first
line of defense; application-level deduplication provides the second.

### X.4 Cross-Organization Ordering Guarantee (G-8)

G-8 governs Domain 2 — events that cross organization boundaries.

> **G-8 (Cross-Organization Eventual Consistency)**: Events crossing
> organization boundaries MUST be eventually consistent with bounded staleness
> of 60 seconds. Cross-organization events MUST carry network-authoritative
> timestamps. Cross-organization causal ordering is NOT REQUIRED.

#### X.4.1 Formal Properties

1. **Bounded Staleness**: For any event `e` published by Organization A at time
   `t_publish`, all subscribers in Organizations B, C, ... MUST observe `e` by
   time `t_publish + 60s`, assuming network connectivity between the publishing
   edge device and the cloud NATS cluster.

2. **Network-Authoritative Timestamp**: The authoritative ordering timestamp for
   cross-organization events is assigned by the cloud NATS cluster upon message
   ingestion (`networkTimestamp`), NOT by the originating edge device
   (`originTimestamp`).

3. **No Cross-Organization Causality**: If Organization A publishes event `e1`
   and Organization B publishes event `e2`, and `e1` happened-before `e2` in
   wall-clock time, the system provides NO guarantee that observers see `e1`
   before `e2`. Consumers requiring cross-org ordering MUST implement
   application-level ordering using `networkTimestamp`.

4. **Partition Recovery**: When an organization's edge device reconnects after a
   network partition, buffered events are delivered with their original
   `originTimestamp` but receive a new `networkTimestamp` reflecting actual cloud
   ingestion time. The `originTimestamp` is preserved for audit purposes.

#### X.4.2 Rationale

Cross-organization causal ordering would require a global coordination protocol
(vector clocks or centralized sequencer across 200,000+ participants). This is:

- **Impractical**: Vector clock size grows linearly with participant count
- **Unnecessary**: Cross-org events represent marketplace-level decisions
  (capacity availability, work order bidding) where sub-second ordering
  precision has no operational value
- **Contradictory**: Global coordination violates the edge-first, offline-capable
  architecture that Domain 1 requires

The 60-second bounded staleness is a design choice balancing:
- **Freshness**: Capacity availability data older than 60 seconds has
  diminishing value for work order routing
- **Cost**: Tighter bounds require more aggressive synchronization
- **Failure tolerance**: 60 seconds provides ample buffer for transient network
  issues without triggering false staleness alerts

### X.5 Adaptive ISA-95 Depth

The ISA-95 hierarchy (Enterprise -> Site -> Area -> Line -> Work Cell -> Machine
-> Sensor) assumes a large, structured organization. The metropolitan
manufacturing network MUST support **adaptive hierarchy depth**:

| Organization Profile | Example | ISA-95 Levels | Guarantees | Latency Budget |
|---------------------|---------|---------------|------------|----------------|
| Solo machinist (2 machines) | Earl's Machine Shop | L0 + L1 | G-1, G-2 only | 30s acceptable |
| Small shop (5-20 machines) | Precision Parts Co. | L0 + L1 + L2 | G-1 through G-4 | 5s acceptable |
| Medium factory (50-200 machines) | MetroFab Industries | L0 through L3 | G-1 through G-6 | 1s target |
| Large facility (1000+ machines) | Boeing Everett | L0 through L4 | G-1 through G-7 | <1s required |
| All organizations (cross-org) | The network itself | N/A (org is unit) | G-8 | 60s bounded |

The **network itself serves as the enterprise level** of ISA-95. Individual
organizations map to sites (or areas, depending on size). This inversion —
where the metropolitan network is the enterprise, not any single company —
is a fundamental architectural distinction from single-enterprise IIoT platforms.

**Requirement**: The system MUST auto-detect organization complexity from the
entity count and topology, and MUST NOT impose higher-level consistency overhead
on organizations that do not require it.

#### X.5.1 Dynamic Latency Budgets

Latency budgets are **organization-complexity-dependent**, not fixed system-wide:

- **Earl's Machine Shop** (2 machines, L0+L1): Earl tolerates 30-second staleness
  on his dashboard because he's standing next to the machines. Session consistency
  (G-2) is sufficient — he sees his own writes. The system MUST NOT impose
  G-3 through G-7 overhead on Earl's 2-entity edge device.

- **Boeing Everett** (10,000+ machines, L0-L4): Boeing demands sub-second
  propagation for alarm cascades across production lines. G-1 through G-7 are
  all active, with ISA-18.2 compliance requiring L2 alarm latency under 1 second.
  Cross-entity causal ordering (G-3) is critical — a welding robot fault MUST
  propagate to the line status before the shift supervisor's dashboard refreshes.

**Implementation**: The edge device's configuration is generated at provisioning
time based on declared entity count. The consistency tier determines which
guarantees are active and their associated latency budgets. Organizations MAY
upgrade their consistency tier as they grow.

### X.6 Clock Model

#### X.6.1 Two-Timestamp Envelope

Every event that crosses organization boundaries MUST carry two timestamps:

```
EventEnvelope {
  originTimestamp:  ISO-8601    // Edge device clock (informational)
  networkTimestamp: ISO-8601    // Cloud NATS cluster (authoritative)
  orgId:           string      // Publishing organization
  entityType:      string      // Entity type tag
  entityId:        string      // Entity instance ID
  sequenceNumber:  uint64      // Per-entity monotonic sequence
  payload:         object      // Event-specific data
}
```

#### X.6.2 Timestamp Authority Rules

| Context | Authoritative Timestamp | Rationale |
|---------|------------------------|-----------|
| Intra-org ordering (G-1 - G-7) | `originTimestamp` + `sequenceNumber` | Edge device is trusted within its own org |
| Cross-org ordering (G-8) | `networkTimestamp` | Edge clocks are heterogeneous and untrusted |
| Regulatory audit [FDA-CFR11] | Both preserved | `originTimestamp` = time of event; `networkTimestamp` = time of record |
| Staleness calculation | `networkTimestamp` vs `now()` | Measures actual delivery latency, not clock skew |

#### X.6.3 Clock Quality Heterogeneity

The system MUST tolerate edge devices with clock skew up to 5 seconds without
degrading intra-organization guarantees. Organizations with clock skew exceeding
5 seconds SHOULD receive a `ClockSkewDetected` advisory.

For cross-organization ordering, clock quality is irrelevant — the
`networkTimestamp` assigned by the cloud cluster is the sole ordering authority.

### X.7 Multi-Tenant Isolation via NATS Accounts

Each organization maps to a NATS Account [NATS-ACCOUNTS] with an isolated
JetStream domain:

1. **Subject namespace isolation**: Each organization's subjects are invisible to
   other organizations by default. Subject `iiot.entity.>` in Organization A is
   completely separate from `iiot.entity.>` in Organization B.

2. **JetStream domain isolation**: Each edge device runs its own JetStream
   domain, providing offline persistence independent of the cloud cluster. Domain
   mirroring handles reconnection synchronization.

3. **Opt-in cross-account sharing**: Organizations that wish to participate in
   the manufacturing commons MUST explicitly export subjects (e.g.,
   `capacity.available`) into a shared system account. This export is auditable
   and revocable via JWT updates [NATS-JWT].

4. **Decentralized authentication**: Organization accounts are provisioned via
   signed JWTs [NATS-DECENTRALIZED]. No centralized authentication database.
   Edge devices carry their account JWT and can connect to any NATS server in
   the cluster.

**Ordering guarantee boundary**: JetStream provides per-subject sequential
ordering within an account's domain. G-1 (Per-Entity Sequential) is enforced
within each organization's account. Across accounts, only G-8 (eventual
consistency with bounded staleness) applies.

### X.8 Manufacturing Commons Events

The cross-organization domain introduces events not present in single-enterprise
IIoT. These represent the **manufacturing commons** — a shared, event-sourced
view of the network's collective state.

| Event | Publisher | Ordering Requirement | G-8 Applies |
|-------|-----------|---------------------|-------------|
| `OrgJoined` | Platform operator | Eventual | Yes |
| `CapabilityDeclared` | Organization (opt-in) | Eventual | Yes |
| `CapacityAvailable` | Organization (automated) | Bounded staleness (60s) | Yes |
| `WorkOrderPosted` | Requesting organization | Bounded staleness (60s) | Yes |
| `BidSubmitted` | Bidding organization | Per-org sequential | Yes (within org) |
| `WorkOrderAccepted` | Requesting organization | Causal (MUST follow bid) | Special case |
| `JobCompleted` | Executing organization | Eventual | Yes |
| `ReputationUpdated` | Platform (computed) | Eventual | Yes |

**Special case — `WorkOrderAccepted`**: This event requires causal consistency
with respect to `BidSubmitted`. This is achievable without global coordination
because both events route through the requesting organization's NATS account,
preserving per-subject ordering within that account.

#### X.8.1 Network-Level Replay (G-6 Extension)

The manufacturing commons is itself an event-sourced system. The complete
network state at any point in time can be reconstructed by replaying commons
events from the shared JetStream stream. This extends G-6 (Partition Tolerance)
to the network level:

- **Replay guarantee**: A new network observer (e.g., a analytics service joining
  the cloud cluster) MUST be able to reconstruct the current network state by
  replaying all commons events from stream offset 0.
- **Idempotent projection**: Commons event handlers MUST be idempotent — replaying
  the same `CapacityAvailable` event twice produces the same aggregate state.
- **Snapshot optimization**: For networks with extended history, periodic snapshots
  of the commons state MAY be stored in NATS KV to accelerate replay. Snapshots
  are advisory — the event stream remains the authoritative source.

**Implementation**: The manufacturing commons stream is a JetStream stream in the
`manufacturing-commons` system account. Subject pattern:
`commons.{eventType}.{orgId}`. Replay uses JetStream's `DeliverAll` consumer
policy. This mirrors the dual-publish pattern in EventDistribution
(`src/lib/iiot/realtime/event-distribution.ts:280-326`) — local projection for
reads, persistent stream for replay.

### X.9 Network-Level Aggregates (CRDT-Based)

Certain network-wide metrics are computed from individually-owned, per-organization
values. These aggregates use Conflict-free Replicated Data Types [CRDT-SHAPIRO]
to converge without ordering:

| Aggregate | CRDT Type | Substrate | Merge Operation |
|-----------|-----------|-----------|-----------------|
| Total available machines | G-Counter | NATS KV: `network.capacity` | Commutative increment per org |
| Jobs completed (monthly) | G-Counter | NATS KV: `network.stats` | Commutative increment per org |
| Capability registry | OR-Set | NATS KV: `network.capabilities` | Commutative add/remove per org |
| Per-org utilization | LWW-Register | NATS KV: `network.utilization` | Last-writer-wins per org key |
| Reputation scores | Bounded Counter | NATS KV: `network.reputation` | Commutative increment (capped 0-100) |

All merge operations are **commutative** — the order in which updates from
different organizations arrive does not affect the final aggregate value
[CRDT-SHAPIRO]. This is the fundamental property that makes network-level
aggregates partition-tolerant without coordination.

**Implementation**: Each organization updates only its own key in the shared NATS
KV bucket [NATS-KV]. Network views are computed by aggregating all keys. This is
conflict-free by construction — no two organizations write to the same key.

**Reputation scores**: Computed from `JobCompleted` and `ReputationUpdated`
events. Each organization's reputation is a bounded counter (0-100) stored at
`network.reputation.{orgId}`. The score increments on successful job completion
and decrements on disputes/timeouts. The bounded counter CRDT prevents scores
from exceeding the 0-100 range regardless of concurrent update ordering.

**Staleness**: CRDT aggregates inherit G-8's 60-second bounded staleness. The
aggregate view MAY be up to 60 seconds behind any individual organization's
actual state. This is acceptable for marketplace-level decisions.

### X.10 PACELC Position

The system's consistency-availability-latency position varies by data path,
following the PACELC framework [PACELC]:

| Data Path | If Partition | Else (Normal) | Position |
|-----------|-------------|---------------|----------|
| Intra-org readings (L0-L1) | Consistency (edge continues) | Consistency | PC/EC |
| Intra-org alarms (L2) | Consistency (local alerting) | Consistency | PC/EC |
| Intra-org work orders (L3) | Consistency (session) | Consistency | PC/EC |
| Cross-org capacity | Availability (stale OK) | Latency (60s OK) | PA/EL |
| Cross-org marketplace bids | Availability | Latency | PA/EL |
| Cross-org bid acceptance | Consistency (causal) | Consistency | PC/EC |
| Network aggregates (CRDTs) | Availability | Latency | PA/EL |

**Summary**: Intra-organization data paths are PC/EC (consistency is
non-negotiable for safety and regulatory compliance). Cross-organization data
paths are PA/EL (availability and low latency are preferred over strict
consistency).

#### X.10.1 Latency Sensitivity by Consumer

Even without partitions, the "Else Latency" tradeoff varies by consumer. The
same data path has different latency tolerance depending on the consuming
organization's complexity:

| Consumer Profile | Acceptable Staleness | Rationale |
|-----------------|---------------------|-----------|
| Earl (2 machines, L0+L1) | 30 seconds | Standing next to machines; HMI is supplementary |
| Small shop (L0-L2) | 5 seconds | Alarm response time is human-scale |
| Boeing (L0-L4) | < 1 second | Automated interlock cascades require real-time propagation |
| Network dashboard (cross-org) | 60 seconds | Marketplace decisions are not time-critical |

The system SHOULD expose per-subscription latency configuration, allowing
consumers to declare their staleness tolerance. This enables the EventDistribution
layer (`src/lib/iiot/realtime/event-distribution.ts`) to optimize delivery — Earl's
subscription can be batched, while Boeing's subscription requires immediate
push.

### X.11 Failure Modes

#### X.11.1 Edge Device Offline (Intra-Org)

- G-1 through G-5 continue to be enforced on the local JetStream domain.
- G-6 specifies the reconciliation protocol upon reconnection.
- Cloud consumers of this organization's events observe a gap until reconnection.

#### X.11.2 Edge Device Offline (Cross-Org)

- The organization disappears from network capacity aggregates.
- CRDT entries for this organization become stale.
- The system SHOULD emit an `OrgStale` event after the organization has been
  unreachable for longer than its CRDT entry's TTL (RECOMMENDED: 5 minutes).
- Upon reconnection, the organization's CRDT entries are refreshed and the
  `OrgStale` advisory is cleared.

#### X.11.3 Cloud NATS Cluster Partition

- Raft consensus may temporarily be unavailable.
- `networkTimestamp` assignment may have a brief gap.
- G-8 bounded staleness MAY be exceeded during the partition.
- Upon partition healing, Raft consensus resumes and `networkTimestamp`
  assignment continues. No data loss occurs because edge devices buffer locally.

#### X.11.4 Clock Drift > 5 Seconds

- Intra-org ordering (G-1 through G-5) degrades for time-based comparisons but
  sequence-number-based ordering remains valid.
- Cross-org ordering (G-8) is unaffected — `networkTimestamp` is authoritative.
- A `ClockSkewDetected` advisory SHOULD be emitted.

#### X.11.5 Malicious Organization

- G-8 consistency is maintained — the system orders events correctly regardless
  of content truthfulness.
- Data integrity (capacity, capability claims) is a trust layer concern, not a
  consistency layer concern.
- Anomaly detection is out of scope for this specification but is RECOMMENDED
  as a complementary mechanism. Reputation scoring is specified in X.9 as a
  CRDT-based network aggregate (Bounded Counter).

### X.12 Codebase Implementation Reference

This section maps each normative requirement to the existing TMNL implementation,
identifying both current artifacts and extension points required for the
metropolitan network architecture.

#### X.12.1 G-1 / G-2: Per-Entity Sequential and Causal Ordering

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| Entity handler orchestration | `src/lib/iiot/entity/EntityStack.ts:54-67` | 12 entity handler layers merged via `Layer.mergeAll` |
| Per-entity state machines | `src/lib/iiot/machines/graphs/{plant,line,workcell,machine-asset,device,sensor,enterprise,site,area}-graph.ts` | 12 state transition graphs enforce valid state progressions |
| Branded entity identifiers | `src/lib/iiot/schemas/identifiers.ts` | `PlantId`, `LineId`, `MachineId`, `SensorId`, `DeviceId`, etc. — branded strings ensuring type-safe entity references |
| Equipment hierarchy (ISA-95) | `src/lib/iiot/schemas/identifiers.ts` → `EquipmentLevel` | Schema.Literal with 9 ISA-95 levels |

**Extension point**: Per-entity sequence numbers are not yet implemented. G-1
enforcement requires adding a monotonic `sequenceNumber` field to the
`EntityStateChanged` event schema and tracking it per entity instance.

#### X.12.2 G-3: Cross-Entity Causal Ordering

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| Alarm → Machine causality | `src/lib/iiot/machines/graphs/alarm-state-graph.ts` | Alarm state transitions reference originating sensor/machine |
| Equipment state propagation | `src/lib/iiot/machines/graphs/equipment-state-graph.ts` | Equipment state changes propagate up the ISA-95 hierarchy |

**Extension point**: The `causedBy` metadata field for cross-entity causal chains
is specified but not yet implemented in the event envelope schema.

#### X.12.3 G-4: Session Consistency

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| WebSocket transport | `src/lib/iiot/realtime/websocket-server.ts:1-60` | Mounts at `/ws/iiot` via `RpcServer.layerProtocolWebsocketRouter` |
| Streaming RPC definitions | `src/lib/iiot/rpc/RealtimeRpcs.ts` | 4 streaming RPCs: `SubscribeReadings`, `SubscribeAlarms`, `SubscribeEquipmentState`, `SubscribeInvalidations` |
| JSON serialization | `src/lib/iiot/realtime/websocket-server.ts` | `RpcSerialization.layerJson` for browser compatibility |

**Current state**: Session consistency is implicit — each WebSocket connection
receives its own subscription stream. Per-entity last-seen-sequence tracking is
an extension point.

#### X.12.4 G-5: Bounded Staleness (Intra-Org)

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| EventDistribution channels | `src/lib/iiot/realtime/event-distribution.ts:136-157` | 4 channels with defined maxLag: `iiot:readings` (10,000), `iiot:alarms` (1,000), `iiot:equipment` (1,000), `iiot:invalidations` (1,000) |
| ReactivityBridge inline publish | `src/lib/iiot/realtime/reactivity-bridge.ts` | Handler-level integration: entity handlers call bridge inline after state change |
| NATS subject specs | `src/lib/iiot/realtime/iiot-subjects.ts` | 4 subjects: `iiot.readings.{deviceId}`, `iiot.alarms.{deviceId}`, `iiot.equipment.{equipmentId}`, `iiot.invalidations.{cacheKey}` |

**Extension point**: Staleness monitoring (comparing `originTimestamp` to current
time) is not yet implemented. Requires an `EventLatencyExceeded` alert type.

#### X.12.5 G-6: Partition Tolerance

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| Dual-publish (local PubSub + NATS) | `src/lib/iiot/realtime/event-distribution.ts:280-326` | Events are published to both local ChannelService and HolonetBridge |
| NATS bridge service | `src/lib/iiot/realtime/holonet-bridge.ts` | HolonetBridge: 4 outbound publish (fire-and-forget), 4 inbound scoped Streams |
| NATS PubSub transport | `src/lib/holonet/nats/pubsub.ts` | `NatsPubSubService` — underlying NATS pub/sub abstraction |

**Current state**: Dual-publish ensures local consumers continue receiving events
even when NATS connectivity is lost. JetStream domain mirroring for edge-cloud
reconciliation is specified but not yet configured.

#### X.12.6 G-7: Idempotent Processing

**Extension point**: Content-addressed message IDs
(`hash(orgId, entityType, entityId, sequenceNumber)`) are specified but not yet
implemented. Currently, NATS JetStream's native message deduplication is the
primary defense.

#### X.12.7 G-8: Cross-Organization Eventual Consistency

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| Subject specs supporting wildcards | `src/lib/iiot/realtime/iiot-subjects.ts` | Subject patterns use parametric placeholders (`{deviceId}`) suitable for per-org namespacing |
| ChannelService broadcast | `src/lib/streams/constructs/ChannelService.ts` | Broadcast outlets enable fan-out to multiple subscriber streams |

**Extension point**: G-8 requires new infrastructure:
- `OrganizationId` branded type (extend `src/lib/iiot/schemas/identifiers.ts`)
- Account-aware HolonetBridge (extend `src/lib/iiot/realtime/holonet-bridge.ts`
  with per-account subject prefixing)
- Network-authoritative timestamp assignment (cloud NATS cluster configuration)
- Manufacturing commons subject exports (new NATS account configuration)

#### X.12.8 Two-Timestamp Envelope

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| Sensor reading schema | `src/lib/iiot/schemas/assets/sensor/schema.ts` | Current reading schema includes `timestamp` — needs bifurcation into `originTimestamp` + `networkTimestamp` |
| Alarm event schema | `src/lib/iiot/rpc/RealtimeRpcs.ts` | `AlarmEvent` carries `triggeredAt` — maps to `originTimestamp` |

**Extension point**: The two-timestamp envelope requires modifying all event
schemas to carry both `originTimestamp` and `networkTimestamp`. The `networkTimestamp`
is assigned at cloud ingestion, not at edge publication.

#### X.12.9 State Services (Consistency Substrate)

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| 12 state services | `src/lib/iiot/state/index.ts` | `PlantState`, `LineState`, `WorkCellState`, `MachineState`, `SensorAssetState`, `DeviceState`, `SiteState`, `AreaState`, `EnterpriseState`, `AlarmState`, `WorkOrderState`, `EquipmentStateService` |
| In-memory implementations | `src/lib/iiot/state/index.ts` → `AllStateServicesInMemory` | Used for testing; production uses SQL-backed implementations |
| Ingestion pipeline | `src/lib/iiot/adapters/ingestion-service.ts:297-322` | `SparkplugPipelineLayer` composes: SparkplugAdapterLive → TopicRouter → ReadingProcessor → AlarmDetector → IngestionService |

**Note**: State services are currently single-instance. For multi-tenant operation,
each organization's state would be isolated either via separate service instances
per account or via per-org partitioning within shared services.

---

## Open Questions

1. **Deduplication window for extended offline**: NATS JetStream default dedup
   window is 2 minutes [NATS-DEDUP-INF]. For organizations offline for days,
   message IDs MUST be content-addressed (`hash(orgId, entityType, entityId,
   sequenceNumber)`) rather than time-windowed. This requires validation.

2. **CRDT garbage collection**: OR-Set entries for capabilities of defunct
   organizations accumulate indefinitely. A tombstone GC protocol is needed.

3. **Cross-org causal chains spanning 3+ organizations**: The current design
   handles requester-bidder causality via single-account routing. If a work
   order chain spans requester -> bidder -> subcontractor, an additional
   coordination mechanism may be needed.

4. **Monitoring G-8 at 200K-account scale**: Exhaustive monitoring of bounded
   staleness across all accounts is impractical. Sampling-based monitoring
   strategies need specification.

---

## References

All references use canonical keys from the project bibliography
(`docs/specifications/bibliography.md`).

### Normative

- [RFC2119] — Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
- [ISA-18.2] — ANSI/ISA-18.2-2016. Management of Alarm Systems.
- [FDA-CFR11] — U.S. FDA, 21 CFR Part 11. Electronic Records.

### NATS / JetStream

- [JETSTREAM] — Synadia. "NATS JetStream."
- [NATS-KV] — Synadia. "NATS Key-Value Store."
- [NATS-DEDUP-INF] — Synadia. "Infinite Message Deduplication in JetStream."
- [NATS-ACCOUNTS] — Synadia. "NATS Account-Based Security."
- [NATS-JWT] — Synadia. "In-Depth JWT Guide for NATS."
- [NATS-DECENTRALIZED] — Synadia. "NATS Decentralized JWT Authentication."
- [NATS-LEAFNODE] — Synadia. "NATS Leaf Nodes."

### Distributed Systems

- [PACELC] — Abadi, D. "Consistency Tradeoffs in Modern Distributed Database System Design." 2012.
- [CRDT-SHAPIRO] — Shapiro, M. et al. "Conflict-Free Replicated Data Types." 2011.

### Effect-TS

- [EFFECT-CLUSTER] — Effect Contributors. "@effect/cluster — Distributed Entity Management with Sharding."

### Internal Research

- [TMNL-CONSISTENCY] — "Research: Consistency Models for Metropolitan-Scale IIoT." `docs/specifications/research-consistency-models.md`
