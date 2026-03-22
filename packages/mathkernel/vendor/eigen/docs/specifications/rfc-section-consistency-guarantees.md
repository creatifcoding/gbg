# RFC Section: Consistency Guarantees — Implementation Mapping

```
Section:       Consistency Guarantees Implementation
RFC:           001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        consistency-theorist (Val)
Created:       2026-02-09
Research Base: docs/specifications/research-consistency-models.md (Sections 1-8)
Companion:     docs/specifications/rfc-section-two-domain-consistency.md (normative spec)
```

---

## Purpose

This section maps the normative ordering guarantees (G-1 through G-10, G-12) from
`rfc-section-two-domain-consistency.md` to their concrete implementations in the
TMNL codebase. It specifies which modules enforce which guarantees, identifies
consumer group constraints, and defines the recovery sequences for each failure mode.

Where the companion section says "MUST" or "SHOULD", this section says **how**.

---

## Y. Implementation Mapping

### Y.1 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

File paths are relative to `packages/tmnl/` and use the `src/` prefix.

### Y.2 Guarantee-to-Codebase Mapping Table

| Guarantee | Requirement Level | Primary Implementation | Secondary Implementation | Verification |
|-----------|------------------|----------------------|-------------------------|-------------|
| **G-1** Per-Entity Sequential | MUST | NATS JetStream per-subject ordering via `iiot-subjects.ts` subject specs | `@effect/cluster` entity-to-shard mapping | Monotonic sequence number check in consumer |
| **G-2** Per-Entity Causal | MUST | Subsumed by G-1 (single entity = single subject = sequential) | N/A | Same as G-1 |
| **G-3** Cross-Entity Causal | SHOULD | `causedBy` metadata in event schema (application-level) | Lamport clock in `EntityStateChanged` event | Consumer-side causal reconstruction |
| **G-4** Session Consistency | MUST | WebSocket connection state in `websocket-server.ts` | Per-client sequence tracking in `realtime-handlers.ts` | Client-side monotonic read assertion |
| **G-5** Bounded Staleness | MUST (L0-L2) | `EventDistribution` channel maxLag configuration | Staleness monitoring via metrics in `event-distribution.ts:267` | `EventLatencyExceeded` alert emission |
| **G-6** Partition Tolerance | MUST | NATS JetStream domain mirroring (edge → cloud) via `holonet-bridge.ts` | Local PubSub continues via `ChannelService` | Reconnection sync validation |
| **G-7** Idempotent Processing | MUST | JetStream dedup (`Nats-Msg-Id` header) via `iiot-subjects.ts` | Application-level dedup in entity handlers | Duplicate counter in metrics |
| **G-8** Cross-Org Eventual | MUST | NATS Accounts + system account imports | Cloud NATS cluster `networkTimestamp` assignment | 60s staleness monitoring |
| **G-9** Data Sovereignty | MUST | NATS Account isolation (default deny) + JWT exports | Audit log of export/import relationships | Export revocation propagation test |
| **G-10** Signal Trustworthiness | SHOULD | Attestation envelope in cross-org events | Trust score computation (singleton service) | Weighted aggregate validation |
| **G-12** Commons Governance | SHOULD | Singleton services in `@effect/cluster` | `manufacturing-commons` NATS system account | `OrgStale` / `NetworkCapacitySummary` emission |

### Y.2.1 Consistency Model per ISA-95 Level

Each ISA-95 automation level requires a different consistency model based on its
temporal requirements and failure tolerance:

| ISA-95 Level | Consistency Model | Guarantee | Justification | Latency Budget |
|-------------|-------------------|-----------|--------------|----------------|
| **L0** (Sensor/Actuator) | Sequential per-entity | G-1 MUST | Sensor state transitions are strictly ordered. A temperature reading of 35C MUST follow 34C, never reorder. | < 100ms |
| **L1** (PLC/DCS) | Sequential per-entity | G-1 MUST | Control module events (alarm trigger, threshold breach) are ordered per device. | < 500ms |
| **L2** (SCADA/HMI) | Causal | G-2, G-3 SHOULD | Operator sees machine fault BEFORE line degradation. Cross-entity causality matters for situational awareness. | < 1s |
| **L3** (MES/MOM) | Session + Bounded Staleness | G-4 MUST, G-5 MUST | Production manager's dashboard converges within SLA. All events in a session are monotonically ordered. Staleness bounded to `maxLag` per channel. | < 5s |
| **L4** (ERP/BI) | Eventual | G-8 SHOULD | Executive KPIs and cross-org aggregates tolerate minutes of lag. Consistency eventually converges. | < 60s |

**Implementation mapping**:

- **L0-L1**: Per-subject FIFO ordering in NATS JetStream [JETSTREAM] via
  `src/lib/iiot/realtime/iiot-subjects.ts` subject specs. One subject per entity
  instance ensures sequential ordering without application-level logic.
- **L2**: Causal ordering via `causedBy` metadata in event schemas + Machine
  state graph validation in `src/lib/iiot/machines/AlarmMachine.ts` and
  `src/lib/iiot/machines/EquipmentStateMachine.ts`. The Machine rejects
  transitions that violate the causal graph.
- **L3**: Session consistency via per-WebSocket ChannelService broadcast outlets
  in `src/lib/iiot/realtime/event-distribution.ts`. Bounded staleness via
  `maxLag` configuration (readings: 10K, alarms/equipment/invalidations: 1K).
- **L4**: Eventual consistency across org boundaries via NATS Account exports
  and imports through the `manufacturing-commons` system account.
  `networkTimestamp` assignment at cloud ingestion provides a cross-org ordering
  basis.

### Y.3 Per-Subject Ordering: The Foundation of G-1

G-1 (Per-Entity Sequential Ordering) is the most critical guarantee. It relies on
NATS JetStream's per-subject FIFO ordering, with subjects defined in:

**File**: `src/lib/iiot/realtime/iiot-subjects.ts`

```
Subject Pattern                          Entity Scope
─────────────────────────────────────────────────────────
iiot.readings.{deviceId}                 One sensor device
iiot.alarms.{deviceId}                   One alarming device
iiot.equipment.{equipmentId}             One equipment instance
iiot.invalidations.{cacheKey}            One cache entry
```

Each `createSubjectSpec` call (lines 39, 61, 83, 105) creates a subject with:
- `resolve()` — produces a concrete subject for one entity instance
- `wildcardPattern()` — produces `iiot.{type}.*` for subscription
- `streamMapping: { _tag: 'domain' }` — maps to a JetStream domain stream

**G-1 enforcement**: Because each entity instance maps to exactly one NATS subject,
and JetStream guarantees per-subject FIFO ordering [JETSTREAM], all events for a
single entity are delivered in production order. No application-level sequencing is
required for G-1 — NATS provides it natively.

**Consumer constraint**: To preserve G-1 at the consumer level, entity state
processors MUST use a **single consumer per entity type** (not consumer groups with
round-robin delivery). Consumer groups that distribute messages across consumers
would break per-entity ordering unless messages are routed by entity ID.

### Y.4 EventDistribution: The G-4 and G-5 Enforcement Layer

**File**: `src/lib/iiot/realtime/event-distribution.ts`

EventDistribution is the central event hub. It enforces:

**G-4 (Session Consistency)** via ChannelService broadcast outlets:
- Each WebSocket subscriber gets its own outlet stream (line 330-348)
- The outlet stream is scoped to the WebSocket connection's `Scope`
- Broadcast outlets ensure all subscribers see the same events in the same order
- `ChannelService.getOutletStream` (line 271-275) creates per-subscriber streams

**G-5 (Bounded Staleness)** via channel maxLag configuration:
- Readings channel: `maxLag: 10_000` (line 173) — drops events if subscriber is
  10,000 messages behind, preventing unbounded staleness
- Alarms/equipment/invalidations: `maxLag: 1_000` (lines 181, 189, 197) — tighter
  bound for safety-critical and operational events

**Metrics** (line 267): `Ref.make<DistributionMetrics>` tracks per-channel publish
counts and active subscriber counts for staleness monitoring.

**Channel architecture**:

```
PubSub.unbounded → connectStream → ChannelService inlet → broadcast outlet → subscriber Stream
     (inlet)         (line 217)       (4 channels)         (per-client)      (to WebSocket)
```

4 channels registered at lines 169-199:
- `iiot:readings` — high-throughput sensor data (10K maxLag)
- `iiot:alarms` — alarm lifecycle events (1K maxLag)
- `iiot:equipment` — equipment state transitions (1K maxLag)
- `iiot:invalidations` — cache coherence signals (1K maxLag)

### Y.5 HolonetBridge: The G-6 and G-8 Transport Layer

**File**: `src/lib/iiot/realtime/holonet-bridge.ts`

The HolonetBridge provides the NATS transport layer that enables:

**G-6 (Partition Tolerance)**:
- Outbound publishing is fire-and-forget (`Effect.ignoreLogged`, lines 102-128)
- If the edge NATS connection is down, the local `PubSub.unbounded` in
  EventDistribution continues to buffer events
- On reconnection, the bridge's subscription (`remoteReadings`, etc.) resumes from
  the last acknowledged NATS message, replaying buffered events

**G-8 (Cross-Org Eventual Consistency)**:
- Each publish call resolves the entity-specific NATS subject via `IIoTSubjects`
  (e.g., `IIoTReadingsSubject.resolve({ deviceId })` at line 104)
- In the cross-org architecture, these subjects are within the org's NATS account
- Cross-account exports make selected subjects visible to the `manufacturing-commons`
  system account
- The `networkTimestamp` is assigned by the cloud NATS cluster on message ingestion

**Dual-write pattern** (EventDistribution lines 280-326):
```
publishReading(event) →
  1. PubSub.publish(readingsInlet, event)     // Local distribution (G-1, G-4, G-5)
  2. bridge.publishReading(event)             // NATS distribution (G-6, G-8)
  3. Ref.update(metrics, ...)                 // Metrics tracking
```

### Y.6 ReactivityBridge: The Handler Integration Point

**File**: `src/lib/iiot/realtime/reactivity-bridge.ts`

The ReactivityBridge is the adapter between entity event handlers and
EventDistribution. It is the point where domain events enter the distribution system.

**Architecture Decision**: Approach A (handler-level integration) was chosen over
Approach B (polling) and Approach C (event log tailing). See
`thoughts/shared/plans/phase5-websocket-architecture.md` Section 5.

**Rationale**:
- Lower latency than polling — events enter distribution immediately
- No additional fiber for polling loop
- Each entity handler calls the bridge inline after writing to EventLog

**Pattern** (lines 91-135):

```typescript
// Inside entity handler:
yield* EventLog.write(event)
yield* bridge.onAlarmEvent({
  eventType: 'triggered',
  alarmId: event.alarmId,
  ...
})
```

The bridge constructs the EventDistribution event type and publishes it. This is
where the domain event schema (entity handler types) maps to the distribution event
schema (EventDistribution types defined at lines 41-70 of `event-distribution.ts`).

### Y.7 WebSocket Server: The G-4 Delivery Layer

**File**: `src/lib/iiot/realtime/websocket-server.ts`

The WebSocket server provides the transport that delivers events to browser clients:

- **Mount point**: `/ws/iiot` on the HttpRouter
- **Serialization**: `RpcSerialization.layerJson` for browser compatibility
- **Transport**: `RpcServer.layerProtocolWebsocketRouter`
- **RPC Group**: `RealtimeRpcs` (4 streaming RPCs)

**G-4 (Session Consistency)** enforcement:
- Each WebSocket connection maintains its own subscription scope
- The `RealtimeRpcHandlers` service (in `realtime-handlers.ts`) creates per-request
  filtered and throttled streams
- Filters are applied per-request (deviceId, severity, entityType, patterns)
- The WebSocket connection scope ensures cleanup when the client disconnects

**Stream composition chain**:

```
EventDistribution.subscribeReadings
  → Stream.filter(deviceId match)
  → Stream.throttle(intervalMs)        // Readings only
  → Stream.map(DistEvent → RpcEvent)   // Type mapping
  → RpcServer (WebSocket transport)
  → Browser client
```

### Y.8 Consumer Group Ordering Constraints

For entity state processing (not real-time display), consumers MUST observe strict
per-entity ordering. This imposes constraints on consumer group topology:

| Consumer Type | Ordering Requirement | Consumer Group Constraint |
|---------------|---------------------|--------------------------|
| Entity state processor | Per-entity sequential (G-1) | Single consumer, OR partitioned by entityId |
| Alarm state manager | Per-device causal (G-2) | Single consumer per alarm entity |
| Real-time display | Session (G-4) | Per-WebSocket, no sharing |
| Analytics aggregator | Eventual | Consumer group OK (ordering relaxed) |
| Audit trail writer | Per-entity sequential (G-1) | Single consumer, append-only |
| Cross-org aggregator | Eventual (G-8) | Consumer group OK |

**Implementation**: `@effect/cluster` entity sharding naturally enforces single-consumer
semantics for entity state processing. Each entity instance is managed by exactly one
`EntityManager` on one runner node [EFFECT-CLUSTER]. Messages for that entity are routed
to the correct runner via `HashRing`, ensuring per-entity sequential processing without
explicit consumer group configuration.

#### Y.8.1 The AckWait Redelivery Interleaving Trap

When using JetStream push consumers with `AckWait` (the timeout after which
unacknowledged messages are redelivered), a subtle ordering violation can occur:

```
Timeline:
  t=0  Consumer receives msg-1 (starts processing)
  t=1  Consumer receives msg-2 (starts processing)
  t=2  AckWait expires for msg-1 → JetStream redelivers msg-1
  t=3  Consumer receives msg-1 (redelivery) while processing msg-2
  t=4  Consumer processes msg-1 AFTER msg-2 → ORDER VIOLATED
```

This trap breaks G-1 if the consumer processes redelivered messages interleaved
with newer messages for the same entity.

**Normative requirement**: Entity state processors MUST use one of:

1. **Single consumer with ordered delivery** (`deliver_policy: all`,
   `max_ack_pending: 1`): Only one message in-flight at a time. Simplest but
   lowest throughput.
2. **`@effect/cluster` EntityManager** (RECOMMENDED): Messages for each entity
   are routed to exactly one shard on one runner node. The entity processes
   messages sequentially via its mailbox. Redelivery is handled at the entity
   level, not the consumer level.
3. **Pull consumers with explicit flow control**: Consumer pulls one message at a
   time per entity, acknowledges before pulling the next.

Option 2 is the RECOMMENDED approach in TMNL. The `EntityManager` pattern
(implemented in `src/lib/iiot/entity/EntityStack.ts`, lines 54-67) provides
natural per-entity sequential processing without JetStream consumer group
configuration.

### Y.9 Failure Mode Recovery Sequences

#### Y.9.1 Observer Crash (WebSocket Client Disconnects)

**Detection**: WebSocket close event / TCP keepalive failure
**Impact**: One subscriber loses its stream
**Recovery sequence**:

1. WebSocket scope finalizer fires → subscriber outlet stream is closed
2. ChannelService outlet is deallocated (broadcast outlet reference count drops)
3. Client reconnects → new WebSocket connection → new scope → new outlet allocated
4. Client re-subscribes to desired event streams
5. **Gap**: Events between disconnect and reconnect are lost for this client
6. **Mitigation**: Client MAY request replay from a known sequence number (future: G-6 replay API)

**G-4 status**: Maintained — new session starts fresh. No stale state carried over.

#### Y.9.2 NATS Connection Loss (Edge ↔ Cloud)

**Detection**: NATS client reconnection callback / heartbeat failure
**Impact**: `HolonetBridge` outbound publishes are silently dropped; inbound remote streams pause
**Recovery sequence**:

1. `Effect.ignoreLogged` in HolonetBridge (line 107) absorbs publish failures
2. Local EventDistribution continues operating via PubSub.unbounded
3. Intra-org guarantees (G-1 through G-5) are maintained locally
4. On NATS reconnection, bridge subscriptions resume from last acknowledged message
5. Buffered events on the NATS server are delivered to bridge inbound streams
6. EventDistribution ingress daemons (lines 249-263) inject recovered events into local channels

**G-6 status**: Maintained — local operation continues; sync on reconnection.

#### Y.9.3 Entity Shard Migration

**Detection**: `@effect/cluster` `HashRing` recomputation
**Impact**: Entity instance destroyed on old node, recreated on new node
**Recovery sequence** (per `research-cluster-patterns.md` Section 1.2):

1. `EntityManager.interruptShard(shardId)` on old node
2. Entity's `Scope` finalizer fires → all forked fibers interrupted
3. ReactivityBridge operations for this entity are interrupted
4. Shard lock released in `RunnerStorage`
5. New node acquires shard lock
6. First message to entity ID triggers lazy recreation on new node
7. Entity `build` effect runs → new ReactivityBridge connection established
8. Forked observers (PubSub subscribers, Machine actors) are re-created in new scope

**G-1 status**: Maintained — JetStream subject ordering is transport-level, not entity-level.
**G-4 status**: WebSocket clients continue receiving from EventDistribution outlets (unaffected by entity migration — EventDistribution is a separate service).

#### Y.9.4 Split-Brain (Cloud NATS Cluster)

**Detection**: Raft consensus failure / leader election timeout
**Impact**: Multiple Raft leaders temporarily → conflicting write acknowledgments
**Recovery sequence**:

1. JetStream Raft detects split and elects new leader within minority partition
2. Minority partition rejects writes (quorum not met)
3. Majority partition continues serving reads and writes
4. On partition heal, Raft reconciles state
5. Any events written to minority partition during split are lost (they were not committed to quorum)
6. `Nats-Msg-Id` dedup prevents duplicate delivery of events that were in-flight during split

**G-1 status**: Maintained within majority partition. Events in minority partition MUST be retried by publishers.
**G-7 status**: `Nats-Msg-Id` dedup handles duplicate attempts across split boundary.

#### Y.9.5 Clock Skew > 5 Seconds (Intra-Org)

**Detection**: `originTimestamp` vs `networkTimestamp` delta exceeds threshold
**Impact**: Time-based staleness calculations (G-5) become unreliable
**Recovery sequence**:

1. HolonetBridge detects delta on message ingestion (cloud-side)
2. `ClockSkewDetected` advisory emitted as an alarm event via EventDistribution
3. Intra-org sequence-number-based ordering (G-1) is unaffected
4. Cross-org ordering (G-8) is unaffected — uses `networkTimestamp`
5. Operator notification for manual clock correction on edge device

**G-1 status**: Unaffected — sequence numbers, not timestamps, provide ordering.
**G-5 status**: Degraded — staleness calculations using `originTimestamp` are unreliable until clock is corrected. System SHOULD fall back to sequence-number gap detection for staleness monitoring.

### Y.10 Codebase File Reference

| File | Guarantees Enforced | Lines of Interest |
|------|--------------------|--------------------|
| `src/lib/iiot/realtime/iiot-subjects.ts` | G-1 (per-subject ordering), G-7 (dedup via subject) | 39-112 (subject specs) |
| `src/lib/iiot/realtime/event-distribution.ts` | G-4 (broadcast outlets), G-5 (maxLag), G-6 (dual-write) | 169-199 (channels), 280-326 (publish), 330-348 (subscribe) |
| `src/lib/iiot/realtime/holonet-bridge.ts` | G-6 (NATS transport), G-8 (cross-org via NATS accounts) | 102-128 (outbound), 136-182 (inbound) |
| `src/lib/iiot/realtime/reactivity-bridge.ts` | Entry point for G-1 chain | 91-135 (handler-to-distribution mapping) |
| `src/lib/iiot/realtime/websocket-server.ts` | G-4 (session delivery) | 1-30 (architecture), mount at `/ws/iiot` |
| `src/lib/iiot/realtime/realtime-handlers.ts` | G-4 (filtering/throttle), G-5 (delivery tier) | 47-52 (severity ordering) |
| `src/lib/iiot/realtime/layers.ts` | Layer composition for all guarantees | Full file |
| `src/lib/streams/constructs/ChannelService.ts` | G-4 (broadcast), G-5 (maxLag backpressure) | Channel registration, outlet allocation |
| `src/lib/iiot/entity/EntityStack.ts` | G-1 (single-consumer via EntityManager), G-7 (idempotent handlers) | 54-67 (`EntityHandlersLayer = Layer.mergeAll(...)`, 12 entities) |
| `src/lib/iiot/entity/AlarmEntity.ts` | G-1 (per-entity ordering), G-7 (idempotent via Machine) | ISA-18.2 lifecycle, Machine state graph validation |
| `src/lib/iiot/entity/WorkOrderEntity.ts` | G-1 (per-entity ordering), G-7 (idempotent via Machine) | FDA 21 CFR Part 11 compliant, dual-write audit trail |
| `src/lib/iiot/entity/EquipmentStateEntity.ts` | G-1 (per-entity ordering), G-7 (idempotent via Machine) | ISA-95/OEE state transitions, Machine graph validation |
| `src/lib/iiot/entity/_helpers.ts` | G-7 (non-blocking event emission) | Feature-flag controlled, `Effect.catchAll` absorbs failures |
| `src/lib/iiot/state/StateShape.ts` | G-7 (idempotent writes) | `set()` is upsert by contract; write methods are "idempotent where possible" (line 10) |
| `src/lib/iiot/state/index.ts` | Layer composition for state services | `AllStateServicesInMemory` (lines 132-147): 12 state services composed via `Layer.mergeAll` |

#### Y.10.1 Entity Handler Idempotency (G-7)

Entity handlers in `src/lib/iiot/entity/` enforce G-7 (Idempotent Processing)
through three mechanisms:

1. **Machine state graph validation**: Each entity uses `@effect/experimental`
   Machine with a state graph that rejects invalid transitions. If a duplicate
   message attempts the same transition, the Machine rejects it at the graph
   level (transition already taken). This is implemented in:
   - `src/lib/iiot/machines/AlarmMachine.ts` — ISA-18.2 alarm state graph
   - `src/lib/iiot/machines/EquipmentStateMachine.ts` — ISA-95/OEE state graph
   - `src/lib/iiot/machines/WorkOrderMachine.ts` — FDA 21 CFR Part 11 workflow

2. **State service upsert semantics**: State services in `src/lib/iiot/state/`
   define `set()` as upsert (per `StateShape.ts` line 10: "Write methods are
   idempotent where possible"). Applying the same state twice produces the same
   result.

3. **Non-blocking event emission**: The `_helpers.ts` event emission helpers
   (lines 28-42, 55-69) use `Effect.catchAll` to absorb failures. Even if a
   duplicate event emission fails, the parent operation succeeds. This prevents
   redelivery from causing cascading failures.

#### Y.10.2 State Service Swappability

**Directory**: `src/lib/iiot/state/`

State services provide a swappable persistence layer (line 4 of `index.ts`:
"Each domain aggregate has a state service with two implementations"):

| Implementation | Purpose | Consistency Guarantee |
|---------------|---------|----------------------|
| `*InMemory` (Map-backed) | Unit/integration tests | Sequential within process (G-1 trivially satisfied) |
| `make*Sql()` (Repository-backed) | Production | Depends on database isolation level; G-1 enforced by entity sharding |

12 state services are composed via `AllStateServicesInMemory` (line 132-147):
AlarmState, WorkOrderState, EquipmentStateService, MachineState, AreaState,
SensorAssetState, PlantState, EnterpriseState, SiteState, WorkCellState,
LineState, DeviceState.

The in-memory / SQL swap ensures that consistency guarantees tested in-memory
transfer to production. The `@effect/cluster` EntityManager provides the
single-consumer constraint (Y.8) regardless of which state service
implementation is used.

### Y.11 Testing Strategy

| Guarantee | Test Type | Test Location |
|-----------|-----------|---------------|
| G-1 | Unit: sequence number monotonicity | `src/lib/iiot/realtime/__tests__/event-distribution.test.ts` |
| G-4 | Integration: WebSocket session ordering | `src/lib/iiot/realtime/__tests__/websocket-integration.test.ts` |
| G-5 | Unit: maxLag configuration verification | `src/lib/iiot/realtime/__tests__/event-distribution.test.ts` |
| G-6 | Integration: bridge disconnect/reconnect | `src/lib/iiot/realtime/__tests__/holonet-bridge.test.ts` |
| G-7 | Unit: dedup via `Nats-Msg-Id` | `src/lib/iiot/realtime/__tests__/event-distribution-distributed.test.ts` |
| G-8 | Integration: cross-account event delivery | Future: metropolitan-scale integration tests |
| G-9 | Integration: account isolation verification | Future: NATS account provisioning tests |
| G-10 | Unit: attestation envelope validation | Future: trust score model tests |

---

## References

All references use canonical keys from the project bibliography
(`docs/specifications/bibliography.md`).

### Normative

- [RFC2119] — Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."

### NATS / JetStream

- [JETSTREAM] — Synadia. "NATS JetStream."
- [NATS-DEDUP-INF] — Synadia. "Infinite Message Deduplication in JetStream."
- [NATS-ACCOUNTS] — Synadia. "NATS Account-Based Security."
- [NATS-JWT] — Synadia. "In-Depth JWT Guide for NATS."

### Effect-TS

- [EFFECT-CLUSTER] — Effect Contributors. "@effect/cluster — Distributed Entity Management with Sharding."

### Internal Research

- [TMNL-CONSISTENCY] — "Research: Consistency Models for Metropolitan-Scale IIoT." `docs/specifications/research-consistency-models.md`

### Companion Sections

- `rfc-section-two-domain-consistency.md` — Normative specification of G-1 through G-8 ordering guarantees
- `rfc-section-security-trust.md` — Security, trust, and tenant isolation (G-9, G-10 trust layer)
