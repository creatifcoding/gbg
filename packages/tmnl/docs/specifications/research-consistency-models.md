# Research: Consistency Models for Metropolitan-Scale IIoT Entity Events

**Date**: 2026-02-09
**Author**: consistency-theorist (Val)
**Status**: RESEARCH — Normative input for TMNL-RFC-001
**Scope**: Consistency models, ordering guarantees, failure modes, system comparison, and cross-organization consistency for metropolitan-scale entity-realtime integration

---

## 1. Consistency Model Taxonomy

The following taxonomy defines six consistency models relevant to distributed IIoT systems, ordered from strongest to weakest.

### 1.1 Model Definitions

| Model | Formal Definition | Observable Behavior |
|-------|-------------------|---------------------|
| **Strong (Linearizable)** | Every read returns the value of the most recent completed write. All operations appear to execute atomically at some point between invocation and completion. | Any observer, at any time, sees the same value for a given entity. No stale reads. |
| **Sequential** | All operations appear to occur in some total order that is consistent with the per-process program order of each client. | Operations may not reflect real-time ordering, but each client's operations appear in the order they were issued. |
| **Causal** | If operation A *causally precedes* operation B (A happened-before B), then all processes observe A before B. Concurrent operations may be observed in any order. | If Machine.MarkFaulted causes Line.MarkDegraded, every observer sees the machine fault before the line degradation. |
| **Session** | Within a single session (e.g., WebSocket connection), the client observes read-your-writes, monotonic reads, and monotonic writes. | A dashboard that modifies an alarm acknowledgment and then reads the alarm list will see its own modification. |
| **Eventual** | All replicas converge to the same value eventually, given no new updates. No ordering guarantees during convergence. | Cross-site KPI aggregates may show temporarily inconsistent values but will converge. |
| **Bounded Staleness** | Eventual consistency with a time bound: all replicas converge within T seconds. | A reading from Site A is guaranteed to be visible at Site B within T seconds. |

### 1.2 ISA-95 Level Consistency Requirements

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC2119].

| ISA-95 Level | Description | Minimum Consistency | Latency Budget | Justification |
|--------------|-------------|---------------------|----------------|---------------|
| **L0** (Physical Process) | Sensors, actuators, field devices | **Sequential** (MUST) | < 100ms | Sensor readings MUST be ordered per-device. Out-of-order readings corrupt time-series analysis. Physical process control loops require deterministic ordering. |
| **L1** (Basic Control) | PLCs, DCS, safety systems | **Sequential** (MUST) | < 250ms | Control actions MUST be applied in order. A safety interlock that fires out of sequence can cause physical harm. |
| **L2** (Supervisory Control) | SCADA, HMI, alarm management | **Causal** (MUST), **Session** (SHOULD) | < 1s | Alarm events MUST preserve causal ordering [ISA-18.2]. An alarm triggered by a sensor fault MUST be observable after the sensor fault event. Operators SHOULD see their own acknowledgments immediately (session consistency). |
| **L3** (Manufacturing Operations) | MES, work order management, recipe control | **Causal** (SHOULD), **Session** (MUST) | < 5s | Work order state transitions SHOULD preserve causal ordering. Operators MUST see their own modifications within their session [FDA-CFR11]. |
| **L4** (Business Planning) | ERP, scheduling, cross-site analytics | **Bounded Staleness** (SHOULD), **Eventual** (MUST) | < 30s | Cross-site KPIs and business aggregates MAY lag behind operational reality. Bounded staleness of 30 seconds SHOULD be maintained. |
| **ES** (Event Sourcing Layer) | EntityManager, EventLog, audit trail | **Sequential** (MUST) per entity, **Causal** (SHOULD) cross-entity | N/A (storage) | Event log entries MUST be sequentially ordered per entity (monotonic sequence numbers). Cross-entity causal relationships SHOULD be preserved via causal metadata. Regulatory requirement: [FDA-CFR11] mandates "secure, computer-generated, time-stamped audit trails" with "permitted sequencing of steps and events." |

### 1.3 Consistency Model Decision Matrix

```
                    Consistency Strength
                    ───────────────────►

    Strong   Sequential   Causal   Session   Bounded   Eventual
    ┌────────┬──────────┬─────────┬─────────┬─────────┬──────────┐
L0  │        │ ██ MUST  │         │         │         │          │
L1  │        │ ██ MUST  │         │         │         │          │
L2  │        │          │ ██ MUST │ █ SHOULD│         │          │
L3  │        │          │ █ SHOULD│ ██ MUST │         │          │
L4  │        │          │         │         │ █ SHOULD│ ██ MUST  │
ES  │        │ ██ MUST* │ █ SHOULD│         │         │          │
    └────────┴──────────┴─────────┴─────────┴─────────┴──────────┘

    * ES: Sequential MUST is per-entity; causal SHOULD is cross-entity
```

### 1.4 Why Not Linearizable?

Strong (linearizable) consistency is NOT required at any ISA-95 level for the following reasons:

1. **Performance cost**: Linearizability requires synchronous coordination across all replicas for every operation. At metropolitan scale with 10,000+ sensors producing data at 1-10 Hz, this is prohibitively expensive.

2. **Network reality**: Metropolitan-scale deployments span multiple sites with WAN latency of 5-50ms. Linearizable reads across WAN are impractical for real-time dashboards.

3. **Sequential suffices for safety**: Safety-critical operations (emergency stops, interlocks) operate at L0-L1 with dedicated safety PLCs [IEC-61508]. These bypass the IIoT event system entirely. The IIoT system records the *observation* of safety events, not the *execution* of safety actions.

4. **Causal suffices for alarm management**: [ISA-18.2] requires that alarm events be traceable and auditable with correct causal ordering, not that they be globally linearizable. An alarm acknowledgment need not be visible to all observers simultaneously -- only that the causal chain (trigger -> acknowledge -> clear) is preserved.

**Exception**: NATS JetStream writes ARE linearizable (verified -- see Section 2). This means the *storage* layer provides linearizable writes, but we do not require linearizable *reads* at the application level.

---

## 2. NATS JetStream Consistency Guarantees

### 2.1 Verified Guarantees

The following guarantees have been verified against the NATS server source code (via DeepWiki analysis of `nats-io/nats-server`), official NATS documentation, and the NATS architecture decision records.

#### 2.1.1 Write-Side Consistency: Linearizable

**VERIFIED**: For writes (publications to a stream), the formal consistency model of NATS JetStream is **Linearizable**.

- All write operations go through the stream's Raft group leader.
- A write is committed only after replication to a quorum (majority) of replicas.
- The publish acknowledgment (`PubAck`) returns ONLY after quorum replication.
- `PubAck` includes the assigned sequence number, confirming the message's position in the stream's total order.

Source: [JETSTREAM], verified via `nats-io/nats-server` Raft implementation.

#### 2.1.2 Read-Side Consistency: Serializable (with caveats)

**VERIFIED**: On the read side, JetStream is **serializable** -- messages are added to a stream in one global order.

**Caveats**:
- **Read-your-writes NOT guaranteed** for direct-get requests. Reads through `direct get` may be served by followers or mirrors, which may lag the leader.
- **Monotonic reads and monotonic writes ARE guaranteed**.
- **Consumer-based reads** (push/pull consumers) are served from the committed log, providing sequential consistency.
- For stronger read consistency, route get requests to the stream leader.

Source: [JETSTREAM]

**Implication for our architecture**: Since our subscribers consume via JetStream consumers (not direct-get), they see sequential consistency. For KV lookups (entity state), we SHOULD route to the leader for read-your-writes within entity handlers.

#### 2.1.3 Per-Subject FIFO Ordering

**VERIFIED**: JetStream guarantees FIFO (First-In, First-Out) ordering within a single subject.

- Messages published to subject `entity.{id}` are stored and delivered in publication order.
- This holds even during leader elections (Raft [RAFT] ensures committed entries are never reordered).
- Consumer redelivery preserves original stream order for the redelivered message relative to other unacknowledged messages.

Source: `TestJetStreamConsumerPullConsumerFIFO` in nats-server test suite.

**Critical for G-1**: By mapping each entity ID to a unique NATS subject, we get per-entity FIFO ordering for free.

#### 2.1.4 Cross-Subject Ordering

**VERIFIED**: JetStream does **NOT** guarantee FIFO ordering across different subjects within a stream.

- Messages published to subjects `entity.A` and `entity.B` may be interleaved in any order in the stream.
- Within each subject, FIFO is maintained.
- Global ordering across subjects requires application-level sequencing (e.g., vector clocks, causal IDs).

Source: [NATS-DISCUSS-3908]

**Implication for G-2**: Cross-entity causal ordering requires additional metadata (causal_id / vector clock). JetStream alone does not provide this.

#### 2.1.5 Consumer Delivery Guarantees

**VERIFIED**: Three delivery modes available:

| Mode | AckPolicy | Guarantee | Use Case |
|------|-----------|-----------|----------|
| **At-most-once** | `AckNone` | Message delivered once, no retry | Ephemeral metrics, non-critical dashboards |
| **At-least-once** | `AckExplicit` or `AckAll` | Message redelivered if not acked within `AckWait` | Default for entity events, alarm events |
| **Exactly-once** | `AckExplicit` + dedup + `AckSync` | Dedup on publish + double-ack on consume | Alarm state transitions, regulatory events |

**Exactly-once implementation details**:

1. **Publisher side**: Set `Nats-Msg-Id` header. Server maintains dedup window (default 2 minutes, configurable via `--dupe-window`). Duplicate messages within window are rejected with `+DUP` response.

2. **Consumer side**: Use `AckSync()` (not `Ack()`) for double acknowledgment. `AckSync` sets a reply subject and waits for server confirmation. When the server responds `+ACK`, the message is guaranteed never to be redelivered.

3. **Infinite dedup** (NATS v2.9.0+): `DiscardNewPerSubject` with `MaxMsgsPerSubject: 1` provides time-independent deduplication using subject-based addressing. Message IDs are encoded in the subject name (e.g., `events.entity123.seq42`).

Source: [JETSTREAM-DEEPDIVE], [NATS-DEDUP-INF]

#### 2.1.6 KV Store Consistency

**VERIFIED**: NATS KV store provides **strong consistency** for writes (linearizable via Raft quorum).

**VERIFIED**: KV reads may be served by followers or mirrors. Read-your-writes is NOT guaranteed by default.

- KV is implemented as a JetStream stream with `MaxMsgsPerSubject: 1` and `Replicas: N`.
- All writes go through the Raft leader and require quorum acknowledgment.
- `Create` and `Update` operations support optimistic concurrency control (compare-and-set via revision number).
- For read-your-writes, route get requests to the stream leader or use `watch` (consumer-based, sequentially consistent).

Source: [NATS-KV]

**Implication**: Entity state stored in NATS KV has linearizable writes but potentially stale reads. For entity handlers that need read-your-writes, use `watch` or leader-directed gets.

#### 2.1.7 Consumer Groups and Ordering Impact

**VERIFIED via DeepWiki**: Competing consumers (queue groups) can receive messages **out of order** at the individual consumer level.

| Configuration | Ordering Guarantee | Use Case |
|--------------|-------------------|----------|
| Single consumer, `MaxAckPending=1` | **Strict total order** | Safety-critical entity processing |
| Single consumer, `MaxAckPending>1` | Delivery order preserved; redelivery of older messages may interleave with newer | High-throughput with idempotent processing |
| Queue group, N consumers | Messages distributed round-robin; per-consumer order preserved but cross-consumer order NOT guaranteed | Stateless processing (metric aggregation, logging) |
| Pull consumer, single | FIFO per pull request (verified via `TestJetStreamConsumerPullConsumerFIFO`) | On-demand processing with backpressure control |

**Critical interaction -- `MaxAckPending` and ordering**: If consumer A is slow and reaches its `MaxAckPending` limit, it stops receiving new messages until it acknowledges pending ones. Consumer B in the same queue group can continue receiving newer messages, effectively "skipping ahead." This is acceptable for stateless processing but **violates G-1 for entity state processing**.

**Critical interaction -- `AckWait` and redelivery ordering**: If a message is not acknowledged within `AckWait`, it is redelivered. A redelivered message can arrive **after newer messages** have already been delivered and processed. This means: `seq=100` delivered, times out, `seq=101` delivered and acked, `seq=100` redelivered. The consumer sees `100, 101, 100` -- out of order.

**Design decision for our system**: For entity state processing, we MUST use **single consumer per entity** (`MaxAckPending=1`) or delegate to @effect/cluster EntityManager which enforces sequential processing per entity via its `activeRequests` map. Queue groups are acceptable only for stateless operations.

#### 2.1.8 Cluster Consensus During Failover

**VERIFIED**: During leader election:

- Publishing is **temporarily paused** (not silently dropped). Clients receive timeout errors.
- No messages are lost, duplicated, or reordered.
- The new leader ensures log consistency with the majority before accepting writes.
- Uncommitted messages on the old leader that were not replicated to quorum are NOT committed by the new leader.

**VERIFIED**: During network partition:

- The minority partition cannot elect a leader or commit writes (quorum requirement).
- Publishing to an isolated leader returns timeout (no quorum for commit).
- When partition heals, isolated nodes catch up from the majority's committed state.
- No split-brain: Raft's quorum requirement prevents divergent state.

Source: `TestJetStreamClusterConsistencyAfterLeaderChange`, `TestJetStreamClusterDesyncAfterPublishToLeaderWithoutQuorum` in nats-server test suite.

#### 2.1.8 Publish Acknowledgment Semantics

**VERIFIED**: When `PubAck` returns successfully:

| Property | Guarantee |
|----------|-----------|
| **Durability** | Message stored on leader AND replicated to quorum |
| **Sequence assigned** | `PubAck.Sequence` reflects position in total order |
| **Dedup status** | `PubAck.Duplicate` indicates if message was a dedup rejection |
| **Replication** | At least `ceil(Replicas/2)` nodes have the message |

**NOT guaranteed**: That the message has been delivered to any consumer. Publishing and consumption are decoupled.

#### 2.1.9 Consumer Replay Guarantees

**VERIFIED**: Replay maintains FIFO ordering regardless of replay policy:

| Replay Policy | Behavior | Ordering |
|---------------|----------|----------|
| `ReplayInstant` (default) | Replay as fast as consumer can process | FIFO preserved |
| `ReplayOriginal` | Replay at original publication rate (inter-message gaps preserved) | FIFO preserved |

Replay start points:
- `DeliverAll` — from first message
- `DeliverLast` — most recent message only
- `DeliverNew` — only messages published after consumer creation
- `DeliverByStartSequence` — from specific stream sequence number
- `DeliverByStartTime` — from specific timestamp

All replay modes preserve per-subject FIFO ordering.

### 2.2 Summary: What NATS JetStream Provides vs. What We Need

| Requirement | JetStream Provides | Gap? |
|-------------|-------------------|------|
| Per-entity ordered events | Per-subject FIFO (G-1) | **No gap** — map entity ID to subject |
| Cross-entity causal ordering | No cross-subject ordering | **Gap** — need causal metadata (G-2) |
| Exactly-once delivery | Dedup + double-ack | **No gap** — configure properly (G-4) |
| Bounded staleness | No built-in time guarantees | **Gap** — need application-level monitoring (G-5) |
| Replay from sequence/time | Built-in consumer replay | **No gap** (G-6) |
| Idempotent processing | Dedup window + AckSync | **No gap** — design idempotent handlers (G-7) |
| Linearizable writes | Raft consensus | **No gap** |
| Read-your-writes | NOT guaranteed for direct-get | **Partial gap** — use consumers or leader-directed reads |

---

## 3. Formal Event Ordering Guarantees (G-1 through G-7)

The following guarantees define the ordering and delivery semantics for entity events in the TMNL IIoT system. Each guarantee specifies the normative requirement (RFC 2119), justification, implementation strategy, and verification criteria.

### G-1: Per-Entity Causal Ordering (MUST)

**Statement**: All events for a given entity MUST arrive at any subscriber in the order they were produced by the entity's command handler.

**RFC 2119**: Conforming implementations MUST guarantee per-entity event ordering. Failure to satisfy this guarantee constitutes a protocol violation.

**Justification**:
- Entity state is the result of a sequential fold over events. Applying events out of order produces incorrect state.
- ISA-95 equipment state transitions are inherently sequential: a Machine cannot transition `idle -> faulted -> running` -- it MUST be `idle -> running -> faulted`.
- [ISA-18.2] alarm lifecycle requires ordered transitions: `triggered -> acknowledged -> cleared`. Observing `cleared` before `triggered` corrupts the alarm record.

**Implementation**:
```
Entity ID ──mapping──► NATS Subject: iiot.entity.{entityType}.{entityId}
```
- Each entity publishes events to a dedicated NATS subject keyed by entity ID.
- JetStream guarantees per-subject FIFO ordering.
- Events carry a monotonically increasing `sequenceNumber` (entity-scoped, not stream-scoped).
- Consumers validate sequence continuity: if `received.seq != expected.seq`, trigger gap recovery (see G-6).

**Verification**:
- Property test: For any sequence of commands applied to an entity, the resulting event stream when replayed produces identical state.
- Integration test: Concurrent publishers to the same entity subject produce a totally ordered event sequence.

### G-2: Intra-Site Cross-Entity Causal Ordering (SHOULD)

**Statement**: If entity A's state change causally triggers entity B's state change within the same site, subscribers SHOULD observe A's event before B's event.

**RFC 2119**: Conforming implementations SHOULD preserve intra-site cross-entity causal ordering. Violations MAY occur under high load or during failover but SHOULD be detected and logged.

**Justification**:
- ISA-95 hierarchy propagation: Machine.MarkFaulted triggers Line.MarkDegraded triggers WorkCell.MarkDegraded. Operators expect to see the root cause (machine fault) before the cascading effect (line degradation).
- Without causal ordering, a dashboard might show "Line Degraded" for several seconds before "Machine Faulted" appears, confusing the operator about the root cause.

**Causal Metadata Design**:
```typescript
interface CausalMetadata {
  // Unique ID for this causal chain
  readonly correlationId: string
  // The event that caused this event (if any)
  readonly causedBy?: {
    readonly entityId: string
    readonly entityType: string
    readonly sequenceNumber: number
  }
  // Logical timestamp (Lamport clock) for cross-entity ordering
  readonly logicalTimestamp: number
}
```

**Implementation**:
- Each entity handler that triggers a downstream entity change propagates a `correlationId` and `causedBy` reference.
- The `logicalTimestamp` is a Lamport clock [LAMPORT-1978]: incremented on each event, set to `max(local, received) + 1` when processing a causal trigger.
- Subscribers that need causal ordering buffer events briefly (configurable window, default 100ms) and sort by `logicalTimestamp` within each `correlationId` chain.
- This is a SHOULD because the buffering window introduces latency and adds complexity. Subscribers MAY choose to process events immediately without causal reordering.

**Verification**:
- Scenario test: Machine.MarkFaulted -> Line.MarkDegraded -> WorkCell.MarkDegraded. Subscriber receives all three events with `causedBy` chain intact and `logicalTimestamp` monotonically increasing.

### G-3: Cross-Site Ordering (MAY)

**Statement**: Events from different sites MAY arrive at a subscribing site out of causal order. Cross-site events SHOULD arrive within 30 seconds (bounded staleness).

**RFC 2119**: Conforming implementations MUST NOT assume cross-site causal ordering. Cross-site bounded staleness of 30 seconds SHOULD be maintained under normal network conditions.

**Justification**:
- Metropolitan-scale deployments connect sites over WAN links with variable latency (5-200ms typical, seconds during congestion).
- NATS leaf node / gateway architecture introduces additional latency for cross-cluster message propagation.
- Cross-site events are primarily consumed by L4 (ERP/analytics) systems that tolerate eventual consistency.
- Safety-critical cross-site coordination (e.g., shared utility shutdown) operates through dedicated OT networks, not the IIoT event system.

**Implementation**:
- Cross-site events carry `siteId` and `wallClockTimestamp` (NTP-synchronized, see G-5 note on clock skew).
- Receiving sites MAY reorder cross-site events by `wallClockTimestamp` within a configurable window (default 5 seconds).
- Cross-site event lag is monitored: if events from Site A are not received at Site B within 30 seconds, an `EventLagExceeded` alert is raised.

**Verification**:
- Integration test: Publish event at Site A, verify receipt at Site B within 30 seconds under simulated WAN latency.
- Chaos test: Introduce 10-second network partition between sites. Verify events are delivered after partition heals, within bounded staleness window.

### G-4: Exactly-Once Processing Semantics (SHOULD)

**Statement**: Each entity event SHOULD be processed exactly once by each subscriber. Implementations MUST provide at-least-once delivery with idempotent processing to achieve effective exactly-once semantics.

**RFC 2119**: At-least-once delivery MUST be provided. Exactly-once processing SHOULD be achieved through deduplication and idempotent event handlers. Implementations MAY relax to at-most-once for non-critical event channels (e.g., real-time dashboard metrics).

**Justification**:
- Duplicate alarm events corrupt [ISA-18.2] alarm metrics (alarm rate, standing alarm count).
- Duplicate work order state transitions violate [FDA-CFR11] audit trail integrity.
- Duplicate sensor readings, while not harmful to time-series storage (idempotent by timestamp), inflate ingestion metrics.

**Deduplication Strategy**:

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| **Publisher** | `Nats-Msg-Id` header = `{entityId}.{sequenceNumber}` | Prevents duplicate writes to JetStream (2-minute window) |
| **Stream** | `DiscardNewPerSubject` + `MaxMsgsPerSubject` (for compacted streams) | Infinite dedup for latest-value streams |
| **Consumer** | `AckExplicit` + `AckSync` (double acknowledgment) | Prevents redelivery after confirmed processing |
| **Application** | Idempotent event handlers check `(entityId, sequenceNumber)` before applying | Handles redelivery after consumer crash before ack |

**Composite Dedup Key**: `{entityId}:{sequenceNumber}`
- Globally unique within the entity's event stream.
- Monotonically increasing per entity (entity-scoped sequence, not stream-scoped).
- Stored in a dedup cache (in-memory LRU with configurable TTL, default 5 minutes).

**Verification**:
- Property test: Processing the same event N times produces the same observable state as processing it once.
- Integration test: Kill consumer mid-processing, restart. Verify the event is redelivered and processed exactly once (idempotency check prevents double application).

### G-5: Bounded Staleness (MUST for L0-L2)

**Statement**: Entity events MUST reach subscribers within defined time bounds based on ISA-95 level.

| ISA-95 Level | Max Event Latency | RFC 2119 |
|--------------|-------------------|----------|
| L0-L1 (Sensor/Control) | 1 second | MUST |
| L2 (SCADA/Alarm) | 5 seconds | MUST |
| L3 (MES/WorkOrder) | 30 seconds | SHOULD |
| L4 (ERP/Analytics) | 60 seconds | SHOULD |
| Cross-site (any level) | 30 seconds | SHOULD |

**Justification**:
- L0-L1: Operator HMI dashboards showing real-time sensor values become misleading if data is more than 1 second old. Alarm annunciation delayed beyond 1 second violates [ISA-18.2] "prompt presentation" requirement.
- L2: SCADA displays and alarm management systems require timely updates. 5 seconds is the maximum acceptable lag for supervisory control.
- L3-L4: Business systems tolerate higher latency. Work order status updates and KPI aggregates are consumed at human decision-making timescales.

**Implementation**:
- Each event carries `producedAt` (wall clock at entity handler) and `publishedAt` (wall clock at NATS publish).
- Subscribers compute `deliveryLatency = receivedAt - producedAt`.
- A monitoring fiber samples `deliveryLatency` and emits `EventLatencyExceeded` alerts when thresholds are violated.
- NATS JetStream does NOT provide built-in latency guarantees -- this is an application-level concern.

**Clock Skew Mitigation**:
- All nodes MUST synchronize clocks via NTP with `maxpoll 6` (64-second sync interval).
- Maximum acceptable clock skew: 50ms between nodes within a site, 500ms between sites.
- Events carry both `wallClockTimestamp` (for human display) and `logicalTimestamp` (Lamport clock, for ordering).
- Latency monitoring uses the Lamport clock delta (not wall clock) to avoid false alerts from clock skew.

**Verification**:
- Load test: 10,000 sensors at 1 Hz. Measure P99 event delivery latency. MUST be < 1 second for L0-L1 events.
- Chaos test: Introduce 500ms clock skew between two nodes. Verify Lamport clock ordering is preserved and latency alerts use logical timestamps.

### G-6: Replay Capability (MUST for Audit)

**Statement**: All entity events MUST be stored in durable storage with replay capability. Replay MUST support: from-timestamp, from-sequence-number, and from-event-ID.

**RFC 2119**: Event replay MUST be supported. Replay MUST preserve original per-entity ordering (G-1). Replay MAY be served at original rate or instant rate. Event retention period MUST be configurable and MUST NOT be less than the regulatory retention requirement for the entity type.

**Justification**:
- **[ISA-18.2]**: Alarm records MUST be retained for the period specified in the alarm management philosophy (typically 3-7 years). Replay is required for alarm system auditing and performance benchmarking.
- **[FDA-CFR11]**: Electronic records MUST be retained "for a period at least as long as that required for the subject electronic records" and MUST be "available for agency review and copying." Audit trails MUST record "the date and time of operator entries and actions that create, modify, or delete electronic records."
- **Root cause analysis**: When investigating an incident, engineers replay the event stream from a point before the incident to reconstruct the sequence of state changes.

**Implementation**:
- JetStream streams with `Retention: LimitsPolicy` and configurable `MaxAge`, `MaxBytes`, `MaxMsgs`.
- Default retention: 90 days for operational events, 7 years for regulatory events (alarms, work orders).
- Replay entry points:

| Entry Point | JetStream Mechanism | Use Case |
|-------------|---------------------|----------|
| From timestamp | `DeliverByStartTime` | "Show me all events from 2026-02-09T14:00:00Z" |
| From sequence | `DeliverByStartSequence` | "Resume from entity sequence 4523" |
| From event ID | Application-level: resolve event ID to sequence, then `DeliverByStartSequence` | "Replay from the event that triggered alarm AL-7892" |

- Regulatory streams use `Replicas: 3` for durability and `Storage: FileStorage` for persistence.
- Replay consumers are created as ephemeral (no durable name) to avoid polluting consumer state.

**Verification**:
- Integration test: Publish 1000 events. Create replay consumer from sequence 500. Verify events 500-1000 are delivered in order.
- Audit test: Verify alarm events are retained for 90+ days and can be replayed with original ordering.

### G-7: Idempotent Processing (MUST)

**Statement**: Processing the same entity event multiple times MUST produce the same observable result as processing it once.

**RFC 2119**: All entity event handlers MUST be idempotent. This is a hard requirement that enables safe retry, replay, and crash recovery.

**Justification**:
- Consumer crashes between event processing and acknowledgment result in redelivery (at-least-once).
- Replay for audit or debugging re-processes events that were already applied.
- Network retries from publisher dedup window expiration may produce duplicate publications.
- Without idempotency, any of these scenarios corrupt entity state.

**Idempotency Patterns**:

| Pattern | Mechanism | Example |
|---------|-----------|---------|
| **Dedup check** | Before applying event, check if `(entityId, sequenceNumber)` already processed | Entity state includes `lastProcessedSeq`; skip if `event.seq <= lastProcessedSeq` |
| **Upsert** | Use INSERT ... ON CONFLICT DO NOTHING for storage operations | Sensor reading INSERT uses `(deviceId, timestamp)` as unique key |
| **Conditional state transition** | Only apply state change if current state matches expected precondition | Machine.MarkFaulted only applies if current state is `running`, not if already `faulted` |
| **Tombstone** | Mark processed events in a dedup cache with TTL | In-memory LRU cache of `{entityId}:{seq}` with 5-minute TTL |

**Implementation**:
```typescript
// Entity handler idempotency check
const applyEvent = (state: EntityState, event: EntityEvent): EntityState => {
  // G-7: Skip if already processed
  if (event.sequenceNumber <= state.lastProcessedSeq) {
    return state // Idempotent: no-op for duplicate
  }

  // Apply event and advance sequence
  return {
    ...computeNewState(state, event),
    lastProcessedSeq: event.sequenceNumber,
  }
}
```

**Verification**:
- Property test: For any event E and state S, `apply(apply(S, E), E) === apply(S, E)`.
- Integration test: Deliver same event twice to handler. Verify entity state is identical to single delivery.

---

## 4. The CAP Theorem Applied to IIoT

### 4.1 The Fundamental Trade-off

The CAP theorem [CAP-BREWER] states: in the presence of a network partition (P), a distributed system must choose between consistency (C) and availability (A). Since network partitions are **inevitable** in metropolitan-scale IIoT (edge gateways lose connectivity, WAN links fail, NATS clusters split), we cannot avoid the choice.

**The IIoT-specific insight**: The correct C/A trade-off depends on the **data path**, not the system as a whole. Safety-critical paths choose CP; operational paths choose AP.

### 4.2 Network Partition Between Edge and Cloud

**Scenario**: A plant's edge gateway loses connectivity to the cloud NATS cluster.

**Correct behavior during partition**:

| Component | Behavior | Rationale |
|-----------|----------|-----------|
| Edge (L0-L2) | MUST continue autonomous operation | ISA-95 L0-L2 are self-contained; cloud is L3-L4 enhancement |
| Local NATS | Continues processing; events buffer in JetStream (disk-backed) | Edge JetStream operates independently from cloud cluster |
| Local HMI/SCADA | Fully operational with local event streams | Operators must maintain plant visibility during partition |
| Cloud dashboards | Show "Site Offline" badge with last-known timestamp | Stale data with staleness indicator is safer than blank screen |
| Cloud aggregates | Freeze at last-known values; staleness alarms fire | No automated actions based on stale edge data |

**Correct behavior on reconnection**:

1. Buffered events drain from edge JetStream to cloud in original sequence order
2. Cloud-side projections recompute with newly arrived "late" events
3. `Nats-Msg-Id` deduplication catches events partially published before partition
4. Late events marked with `lateArrival: true` flag for audit
5. Dashboard transitions from stale to current within bounded staleness window

### 4.3 Edge Autonomy

**Can a plant operate independently during cloud outage?** Absolutely yes. This is non-negotiable.

ISA-95 was designed with this assumption -- L0-L2 are self-contained. The cloud provides L3-L4 services (MES, ERP, analytics) that enhance operations but are NOT required for safe plant operation.

**What the edge retains during partition**:
- Full sensor data pipeline (Sparkplug adapter -> topic router -> reading processor -> alarm detection)
- Entity state machines (running, idle, faulted transitions)
- Alarm management lifecycle (raise, acknowledge, clear)
- Local operator HMI functionality
- Local event journal (JetStream persistence)

**What the edge loses during partition**:
- Cross-site visibility (cannot see other plants)
- Enterprise-level analytics and KPIs
- Cloud-based ML/AI inference (unless cached at edge)
- Remote operator access

### 4.4 Stale Data vs. No Data

**Which is more dangerous?** It depends on the ISA-95 level:

| Level | More Dangerous | Correct Behavior | Rationale |
|-------|---------------|------------------|-----------|
| L0-L1 (Sensors) | **Stale data** | Drop stale readings; sensor gaps trigger alarm | A reading showing "safe" when reality is "unsafe" is worse than no reading at all |
| L2 (SCADA/HMI) | **No data** | Show stale data with visual "STALE" badge and timestamp | Operator with a blank screen cannot make decisions; stale data with indicator is preferable |
| L3 (MES) | **Stale data** | Freeze operations on stale MES data; queue work orders until fresh | Executing work order based on outdated quality data causes defective product |
| L4 (ERP/BI) | **No data** | Show stale aggregates with "as of [timestamp]" disclaimer | Executive decisions tolerate approximate data; blank dashboards cause unnecessary escalation |

### 4.5 Reconciliation After Partition Healing

When connectivity restores, event streams must merge without data loss or ordering corruption.

**Protocol**:
1. **Edge replays buffered events**: JetStream on edge has been persisting during partition. Events flow to cloud via HolonetBridge NATS publish path with original `originTimestamp` and edge-local sequence numbers.
2. **Cloud ingests late events**: EventDistribution receives burst of late events. Inserted into cloud JetStream with new cloud-side `ingestTimestamp`. Cloud sequence reflects arrival order (late), not original event order.
3. **Deduplication**: Transport-level via `Nats-Msg-Id` (5-minute window). Application-level via @effect/cluster `requestId` deduplication in MessageStorage.
4. **Projection recomputation**: Event-sourced projections dependent on `originTimestamp` re-process the affected time window.
5. **Convergence**: Within 60 seconds of full partition healing, all sites converge to consistent state (per G-5).

### 4.6 CAP Position Summary

| Data Path | CAP Choice | Implementation | Justification |
|-----------|-----------|----------------|---------------|
| Sensor readings (real-time) | **AP** | Fire-and-forget publish, maxLag eviction, at-most-once | Stale readings worse than no readings; drop and refresh |
| Alarm lifecycle | **CP** | Durable JetStream consumer, explicit ack, sequential processing | Missed alarm ack is safety violation |
| Equipment state transitions | **CP** | EntityManager sequential, durable consumer, CAS on KV | Incorrect state could trigger wrong control action |
| Dashboard aggregates | **AP** | Eventual consistency, best-effort refresh, staleness indicator | Brief inconsistency acceptable for visualization |
| Cross-site entity mirror | **AP** | Mirror streams, bounded staleness, no cross-site writes | Availability between sites is paramount |
| Work order management | **CP** | Event sourcing, causal consistency, idempotent handlers | Regulatory audit trail must be correct |
| Cache invalidation | **AP** | Best-effort broadcast, periodic full-refresh fallback | Stale cache degrades performance, not correctness |

---

## 5. Failure Modes and Recovery Strategies

### 5.1 Observer Fiber Crash

**Scenario**: A subscriber fiber (e.g., WebSocket connection handler) crashes while processing events from a JetStream consumer.

**Detection**:
- JetStream `AckWait` timer expires (default: 30 seconds).
- Entity-scoped sequence number gap detected by monitoring fiber.
- Consumer `NumPending` metric increases (events accumulating without ack).

**Recovery**:
1. JetStream automatically redelivers unacknowledged messages to the same or another consumer in the consumer group.
2. The restarted fiber receives events from the last unacknowledged sequence.
3. Idempotency check (G-7) prevents double-processing of events that were processed but not acknowledged before the crash.

**Configuration**:
```
AckWait: 30s         # Time before redelivery
MaxDeliver: 5        # Max redelivery attempts before terminal
MaxAckPending: 1000  # Max unacked messages (backpressure)
```

**Risk**: If `AckWait` is too short, slow consumers receive unnecessary redeliveries. If too long, recovery latency increases.

### 5.2 NATS Connection Loss

**Scenario**: The connection between an application node and the NATS cluster is interrupted.

**Detection**:
- NATS client library detects connection loss via heartbeat failure.
- Application receives `disconnect` event.

**Recovery**:
1. **NATS client auto-reconnect**: The `nats.js` client automatically reconnects with configurable backoff (default: 2 seconds, jitter-based).
2. **Message buffer**: During disconnection, published messages are buffered in the client's pending queue (configurable size, default: 8MB).
3. **Consumer resume**: Upon reconnection, JetStream consumers resume from the last acknowledged sequence. No gap in event delivery.
4. **If buffer overflow**: Messages published during extended outage are lost (at-most-once for buffered publishes). For critical events, use `publishSync` with timeout to detect publish failures.

**Buffer Strategy**:
```
PendingMsgsLimit: 65536    # Max buffered messages during disconnect
PendingBytesLimit: 8MB     # Max buffered bytes
ReconnectWait: 2s          # Base reconnect interval
MaxReconnects: -1          # Unlimited reconnect attempts
```

**Risk**: Extended disconnection (> buffer capacity) causes message loss for non-acked publishes. Mitigation: Use JetStream publish with explicit `PubAck` confirmation; retry failed publishes from application-level outbox.

### 5.3 Shard Migration (@effect/cluster)

**Scenario**: An entity shard (managed by `@effect/cluster`) migrates from Node A to Node B due to node failure or rebalancing.

**VERIFIED via DeepWiki**: @effect/cluster [EFFECT-CLUSTER] handles migration through MessageStorage persistence and advisory lock-based ownership.

**Detection**:
- Sharding service monitors cluster topology via RunnerStorage, detecting changes in healthy runners.
- Shard assignments recomputed using consistent hash ring when topology changes.
- If shard no longer assigned to current runner, added to `releasingShards`.
- Advisory locks refreshed at configurable intervals (`shardLockRefreshInterval`); lost lock triggers release.
- Old shard on Node A receives `interruptShard` signal via EntityManager.

**Recovery**:
1. **Old node releases entity**: EntityManager's `interruptShard` removes entity from `entities` resource map. For durable messages, interrupts during shutdown are ignored -- these messages are retried when entity restarts on new node.
2. **Messages persist to MessageStorage**: All entity requests and replies are persisted to SQL (when MessageStorage enabled). Old node does NOT buffer in memory; unprocessed messages remain in SQL storage.
3. **New node acquires shard**: Node B acquires advisory lock. `resetShards` resets mailbox state for acquired shards, marking all messages for reprocessing.
4. **New node polls MessageStorage**: Sharding service's storage read loop reads unprocessed messages and sends them to new EntityManager. Entity registration performed while storage is idle to preserve message order.
5. **Deduplication**: MessageStorage detects duplicates by `requestId`. If same message processed again, system retrieves cached reply without re-execution (at-least-once with idempotency = effectively-once).

**Sequence Diagram**:
```
Time ─────────────────────────────────────────────────────►

Node A:  [Processing events seq 100-105] [INTERRUPTED]
                                              │
                                    ┌─────────┘
                                    ▼
Node B:                    [Acquires shard] [Resumes from seq 103]
                                            [Redelivers 103-105]
                                            [Dedup: 103-105 skipped]
                                            [Continues from 106]
```

**Risk**: If Node A's observer was mid-side-effect (e.g., writing to an external system) when interrupted, the side effect may be partially applied. Mitigation: Side effects MUST be idempotent (G-7) or use an outbox pattern.

### 5.4 Split-Brain Prevention

**Scenario**: Two nodes believe they own the same entity shard simultaneously.

**Analysis**: This scenario is prevented by multiple layers:

1. **@effect/cluster RunnerStorage**: Uses advisory locks (backed by a distributed store) to enforce single-owner semantics. Only one node can hold the lock for a given entity at any time.

2. **NATS Raft**: JetStream's Raft consensus prevents split-brain at the messaging layer. A minority partition cannot elect a leader or commit writes.

3. **Residual risk**: A race window exists between lock check and lock acquisition. If two nodes attempt to acquire the same entity lock simultaneously, the distributed store's compare-and-swap operation ensures only one succeeds.

**If split-brain occurs despite safeguards**:
- **Detection**: Two event streams with the same `entityId` but divergent `sequenceNumber` sequences.
- **Resolution**: The entity with the higher Lamport timestamp wins. Events from the losing branch are marked as `ConflictResolved` and archived (not deleted, for audit trail).
- **Prevention**: Use NATS KV with revision-based optimistic concurrency for entity state. CAS failures indicate concurrent modification.

**Risk**: Extremely low probability given multiple safeguard layers. The resolution strategy (last-writer-wins with Lamport timestamp) may discard legitimate events in pathological cases. Mitigation: Human review of `ConflictResolved` events.

### 5.5 Clock Skew

**Scenario**: Nodes within or across sites have different wall clock values.

**Impact**:
- `changedAt` timestamps in entity events are skewed.
- Bounded staleness calculations (G-5) produce false positives or false negatives.
- Cross-site event reordering by wall clock produces incorrect ordering.

**Mitigation**:

| Layer | Strategy |
|-------|----------|
| **Intra-site** | NTP synchronization with `maxpoll 6` (64s sync). Maximum acceptable skew: 50ms. |
| **Cross-site** | NTP synchronization with stratum-2 or better. Maximum acceptable skew: 500ms. |
| **Ordering** | Use Lamport clocks (logical timestamps) for event ordering, NOT wall clocks. Wall clocks are for human display only. |
| **Staleness** | Latency monitoring computes `logicalTimestamp` deltas. Wall clock latency is informational only. |
| **Detection** | Periodic clock skew check: each node publishes `{nodeId, wallClock, logicalClock}` to a monitoring subject. Skew exceeding threshold triggers `ClockSkewDetected` alert. |

**Lamport Clock Protocol**:
```
On entity event emission:
  localClock = localClock + 1
  event.logicalTimestamp = localClock

On causal event reception:
  localClock = max(localClock, event.logicalTimestamp) + 1
```

**Risk**: NTP failure or misconfiguration can cause unbounded clock skew. Mitigation: `ClockSkewDetected` alert triggers operator notification. System continues operating using logical timestamps; wall clock timestamps are flagged as unreliable.

### 5.6 Failure Mode Summary

| Failure | Detection Time | Recovery Time | Data Loss Risk | Ordering Impact |
|---------|---------------|---------------|----------------|-----------------|
| Observer fiber crash | `AckWait` (30s) | Seconds (redelivery) | None (at-least-once) | None (G-1 preserved) |
| NATS connection loss | Heartbeat (5s) | Seconds (auto-reconnect) | Low (buffer overflow risk) | None (consumer resume) |
| Shard migration | Lock handoff (ms) | Seconds (new observer) | None (redelivery + dedup) | Brief overlap (deduped) |
| Split-brain | Event divergence detection | Manual review | Very low (safeguard layers) | Potential (resolution strategy) |
| Clock skew | Periodic check (60s) | Configuration fix | None (logical timestamps) | None (Lamport ordering) |
| NATS cluster leader election | Publish timeout | Seconds (Raft election) | None (Raft guarantees) | None (log consistency) |

---

## 6. Comparison with Other Event Systems

### 6.1 Feature Comparison Matrix

Sources: [JETSTREAM], [KAFKA], [RABBITMQ-STREAMS], [AWS-IOT-EVENTS], [AZURE-DT]. See also [NATS-VS-KAFKA], [NATS-VS-KAFKA-UNS], [NATS-COMPARE].

| Feature | NATS JetStream | Apache Kafka | RabbitMQ Streams | AWS IoT Events | Azure Digital Twins |
|---------|---------------|--------------|------------------|----------------|---------------------|
| **Ordering Model** | Per-subject FIFO | Per-partition FIFO | Per-stream FIFO | No ordering guarantee | Per-twin eventual |
| **Write Consistency** | Linearizable (Raft) | Linearizable (ISR) | Quorum-based | Eventual | Eventual |
| **Read Consistency** | Serializable (consumer) | Serializable (consumer) | Serializable (consumer) | Eventual | Eventual |
| **Delivery Guarantee** | At-most/least/exactly-once | At-most/least/exactly-once | At-most/least-once | At-least-once | At-least-once |
| **Exactly-Once Mechanism** | Dedup header + AckSync | Transactional producer + consumer | Not built-in | Not built-in | Not built-in |
| **Replay** | Sequence, timestamp, subject | Offset-based | Offset-based | Limited | Via Event Grid (limited) |
| **Partitioning** | Subject hierarchy (natural) | Topic partitions (explicit) | Streams (explicit) | Per-detector model | Per-twin |
| **KV Store** | Built-in (stream-backed) | Kafka Streams state stores | Not built-in | DynamoDB (external) | Built-in twin graph |
| **Latency (P99)** | < 1ms (in-memory), 1-5ms (persist) | 5-20ms (persist) | 1-5ms | 50-500ms | 100-1000ms |
| **Edge Deployment** | NATS leaf nodes (lightweight) | Kafka MirrorMaker (heavy) | Shovel/Federation | Greengrass (limited) | IoT Edge (limited) |
| **ISA-95 Fitness** | Excellent (UNS + subject hierarchy) | Good (topic naming) | Fair (queue-centric) | Fair (detector model) | Good (twin graph) |
| **Operational Complexity** | Low (single binary) | High (ZooKeeper/KRaft + brokers) | Medium (Erlang runtime) | Low (managed) | Low (managed) |

### 6.2 Detailed Analysis

#### 6.2.1 NATS JetStream Strengths for IIoT

1. **Subject hierarchy maps to ISA-95**: NATS subjects like `iiot.entity.Machine.machine-001` naturally mirror the ISA-95 hierarchy. Kafka topic naming can achieve similar structure but lacks subject-level FIFO guarantees (only partition-level).

2. **Sub-millisecond latency**: Critical for L0-L1 bounded staleness requirements (G-5). Kafka's persist latency (5-20ms P99) is acceptable but higher.

3. **Lightweight edge deployment**: NATS leaf nodes [NATS-LEAFNODE] are single-binary, < 20MB, suitable for edge gateways. Kafka requires JVM + ZooKeeper/KRaft, making edge deployment impractical.

4. **Built-in KV store**: Entity state can be stored in NATS KV without an external database dependency, simplifying the architecture for small-to-medium deployments.

5. **Natural subject-level dedup**: `DiscardNewPerSubject` provides infinite deduplication tied to the subject hierarchy, not a time window. This is architecturally cleaner than Kafka's idempotent producer (connection-scoped).

#### 6.2.2 NATS JetStream Gaps We Must Compensate For

1. **No cross-subject ordering**: Kafka's transaction API can atomically publish to multiple partitions with ordering guarantees. JetStream requires application-level causal metadata (G-2).

2. **No built-in consumer group rebalancing**: Kafka's consumer group protocol automatically redistributes partitions when consumers join/leave. JetStream requires application-level partition assignment or use of `@effect/cluster` [EFFECT-CLUSTER] for entity distribution.

3. **Weaker exactly-once story**: Kafka's exactly-once is a first-class, well-documented feature (transactional producer + read-committed consumer). JetStream's exactly-once requires careful composition of dedup + AckSync + idempotent handlers.

4. **No stream-level transactions**: Cannot atomically publish an entity event AND update entity state in NATS KV within a single transaction. Requires saga pattern or outbox.

5. **Smaller ecosystem**: Kafka has Kafka Streams, ksqlDB, Kafka Connect. JetStream has fewer built-in stream processing primitives. Compensated by Effect Stream's rich combinators.

#### 6.2.3 Why Not Kafka?

Despite Kafka's stronger exactly-once guarantees, NATS JetStream is preferred for this system because:

1. **Latency**: IIoT L0-L1 requires < 1s event delivery. NATS's sub-millisecond latency provides 1000x margin. Kafka's 5-20ms is acceptable but offers less headroom.

2. **Operational complexity**: Metropolitan-scale IIoT deploys to factory floors, edge gateways, and cloud. NATS's single-binary deployment dramatically reduces operational burden.

3. **Subject model**: NATS's fine-grained subject hierarchy (one subject per entity) is architecturally cleaner than Kafka's partition model for entity-centric event sourcing. Kafka would require either one partition per entity (impractical at scale) or application-level routing within partitions.

4. **Edge-to-cloud**: NATS leaf nodes provide seamless edge-to-cloud connectivity. Kafka MirrorMaker is a separate operational concern.

5. **Existing infrastructure**: The TMNL system already uses NATS extensively (ChannelService, PubSub, event distribution). Adding Kafka would introduce a second messaging system.

#### 6.2.4 Why Not Cloud-Managed (AWS IoT Events / Azure Digital Twins)?

1. **Vendor lock-in**: Metropolitan IIoT must operate across hybrid environments (on-premises + cloud + edge). Cloud-managed services lock the architecture to a single cloud provider.

2. **Latency**: Cloud services introduce WAN latency (50-1000ms) for every event. On-premises NATS clusters provide < 1ms latency for intra-site events.

3. **Ordering guarantees**: Neither AWS IoT Events nor Azure Digital Twins provide per-entity ordered event delivery. Events are eventually consistent with no ordering guarantees.

4. **Cost at scale**: 10,000+ sensors at 1-10 Hz generate 10,000-100,000 events/second. Cloud event processing at this scale incurs significant per-event costs.

---

## 7. Appendix: Configuration Reference

### 7.1 NATS JetStream Stream Configuration

```json
{
  "name": "IIOT_ENTITY_EVENTS",
  "subjects": ["iiot.entity.>"],
  "retention": "limits",
  "max_age": "7776000000000000",
  "max_bytes": -1,
  "max_msg_size": 1048576,
  "storage": "file",
  "num_replicas": 3,
  "duplicate_window": "120000000000",
  "discard": "old",
  "allow_rollup_hdrs": false,
  "deny_delete": true,
  "deny_purge": true
}
```

Notes:
- `max_age`: 90 days (nanoseconds). Regulatory streams use 7 years.
- `num_replicas`: 3 for production (quorum = 2).
- `duplicate_window`: 2 minutes (nanoseconds). Sufficient for publisher retry scenarios.
- `deny_delete` / `deny_purge`: Prevent accidental data loss. Regulatory compliance.

### 7.2 NATS JetStream Consumer Configuration

```json
{
  "durable_name": "iiot-entity-handler",
  "deliver_policy": "all",
  "ack_policy": "explicit",
  "ack_wait": "30000000000",
  "max_deliver": 5,
  "max_ack_pending": 1000,
  "replay_policy": "instant",
  "filter_subject": "iiot.entity.>"
}
```

Notes:
- `ack_wait`: 30 seconds. Balances recovery time vs. false redelivery.
- `max_deliver`: 5 attempts before terminal (dead letter). Prevents infinite redelivery loops.
- `max_ack_pending`: 1000 messages. Provides backpressure if consumer is slow.

### 7.3 Bounded Staleness Monitoring Configuration

```yaml
staleness_thresholds:
  l0_l1_max_latency_ms: 1000
  l2_max_latency_ms: 5000
  l3_max_latency_ms: 30000
  l4_max_latency_ms: 60000
  cross_site_max_latency_ms: 30000

clock_sync:
  ntp_maxpoll: 6
  intra_site_max_skew_ms: 50
  cross_site_max_skew_ms: 500
  skew_check_interval_ms: 60000

alerts:
  latency_exceeded: "EventLatencyExceeded"
  clock_skew_detected: "ClockSkewDetected"
  consumer_lag_exceeded: "ConsumerLagExceeded"
```

---

## 8. Cross-Organization Consistency (200K-Org Manufacturing Network)

The preceding sections (1-7) assume a **single-enterprise** or **single-site** IIoT deployment where one organization controls all entities, clocks, and trust boundaries. This section extends the consistency model to a **metropolitan manufacturing network** — 200,000+ organizations ranging from solo machinists (2 CNC machines, no IT staff) to large aerospace manufacturers (10,000+ sensors, dedicated OT teams).

This reframe introduces a fundamental architectural insight: the system operates in **two distinct temporal domains** with fundamentally different consistency requirements.

### 8.1 Two-Domain Temporal Model

| Property | Domain 1: Intra-Org (Sovereign) | Domain 2: Cross-Org (Federated) |
|----------|--------------------------------|----------------------------------|
| **Scope** | Single organization's entities | Network-level aggregates, marketplace events |
| **Trust** | Fully trusted (org controls all devices) | Untrusted (other orgs' clocks, data integrity) |
| **Ordering** | Per-entity sequential (G-1), causal cross-entity (G-3) | Eventual with bounded staleness |
| **Staleness** | Sub-second (L0-L2) to 30s (L4) | 60 seconds maximum |
| **Offline** | MUST work indefinitely — edge device is self-contained | MUST degrade gracefully — org disappears from network view |
| **Clock authority** | Edge device's local clock is authoritative | Network-assigned timestamp is authoritative |
| **ISA-95 depth** | Adaptive: 1-2 levels (Earl) to 7 levels (Boeing) | Flattened: org is the atomic unit |

**Key insight**: Guarantees G-1 through G-7 (Section 3) apply **within** Domain 1. A new guarantee, **G-8**, governs Domain 2.

### 8.2 G-8: Cross-Organization Eventual Consistency

> **G-8 (Cross-Organization Eventual Consistency)**: Events crossing organization boundaries MUST be eventually consistent with bounded staleness of 60 seconds. Cross-organization events MUST carry network-authoritative timestamps. Cross-organization causal ordering is NOT REQUIRED.

Formal properties:

1. **Bounded Staleness**: For any event `e` published by Organization A at time `t_publish`, all subscribers in Organizations B, C, ... MUST observe `e` by time `t_publish + 60s`, assuming network connectivity.
2. **Network-Authoritative Timestamp**: The authoritative ordering timestamp for cross-org events is assigned by the cloud NATS cluster upon message ingestion, NOT by the originating edge device.
3. **No Cross-Org Causality**: If Organization A publishes event `e1` and Organization B publishes event `e2`, and `e1` happened-before `e2` in wall-clock time, the system provides NO guarantee that observers see `e1` before `e2`.
4. **Partition Tolerance**: When an organization's edge device loses network connectivity, its events are buffered locally. Upon reconnection, buffered events are delivered with their original `originTimestamp` but receive a new `networkTimestamp` reflecting actual ingestion time.

**Rationale**: Cross-org causal ordering would require a global coordination protocol (vector clocks or centralized sequencer across 200K+ participants), which is impractical at this scale. Bounded staleness of 60 seconds is sufficient for marketplace-level decisions (capacity availability, work order bidding) where sub-second precision has no operational value.

### 8.3 Clock Model: Sovereign vs Network Timestamps

Edge devices in a metropolitan manufacturing network have **heterogeneous clock quality**:

| Org Profile | Clock Source | Typical Skew | Trust Level |
|-------------|-------------|--------------|-------------|
| Solo machinist (Earl) | Consumer NTP, no UPS | 0.5-2 seconds | LOW — may drift during power cycles |
| Small shop (5-20 machines) | NTP, basic infrastructure | 50-500ms | MEDIUM — reasonable but unverifiable |
| Medium factory | Enterprise NTP, redundant | 10-50ms | HIGH — managed IT infrastructure |
| Large facility | PTP/GPS-synchronized | < 1ms | VERIFIED — traceable time source |

**Two-timestamp model**:

```
┌─────────────────────────────────────────────────────────────┐
│  Event Envelope (cross-org)                                 │
│                                                             │
│  originTimestamp:  2026-02-09T14:23:07.123Z  ← Edge clock   │
│                   (informational, untrusted for ordering)   │
│                                                             │
│  networkTimestamp: 2026-02-09T14:23:07.891Z  ← Cloud NATS   │
│                   (authoritative for cross-org ordering)    │
│                                                             │
│  orgId:           "earl-machine-shop-atlanta"                │
│  entityId:        "cnc-haas-001"                            │
│  payload:         { state: "idle", ... }                    │
└─────────────────────────────────────────────────────────────┘
```

**Rules**:
- **Intra-org ordering** (G-1 through G-7): Uses `originTimestamp` and per-stream sequence numbers. The edge device is authoritative for its own entity ordering.
- **Cross-org ordering** (G-8): Uses `networkTimestamp`. The cloud NATS cluster is authoritative. Edge clocks are untrusted for cross-org ordering.
- **Regulatory audit** ([FDA-CFR11]): Both timestamps MUST be preserved. The `originTimestamp` is the "time of event" for audit purposes. The `networkTimestamp` is the "time of record" for system-level ordering.

### 8.4 NATS Account-Based Multi-Tenancy

Each organization in the network maps to a **NATS Account** [NATS-ACCOUNTS] with isolated JetStream domains:

```
┌──────────────────────────────────────────────────────────┐
│  NATS Cloud Cluster (3+ nodes, Raft consensus)           │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Account:     │  │ Account:     │  │ Account:     │   │
│  │ earl-shop    │  │ precision-   │  │ aero-        │   │
│  │              │  │ machining    │  │ dynamics     │   │
│  │ JS Domain:   │  │ JS Domain:   │  │ JS Domain:   │   │
│  │ earl-shop    │  │ pm-inc       │  │ aero-dyn     │   │
│  │              │  │              │  │              │   │
│  │ Streams:     │  │ Streams:     │  │ Streams:     │   │
│  │  iiot.>      │  │  iiot.>      │  │  iiot.>      │   │
│  │  alarms.>    │  │  alarms.>    │  │  alarms.>    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │            │
│  ┌──────┴─────────────────┴─────────────────┴──────┐     │
│  │  System Account: manufacturing-commons           │     │
│  │  Cross-account imports: capacity.>, status.>     │     │
│  │  Aggregate streams: network.capacity.*           │     │
│  └──────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
         │              │              │
    Leaf Node      Leaf Node      Leaf Node
    (Earl's        (PM Inc.       (AeroDyn
     $50 edge)      server)        cluster)
```

**Key NATS mechanisms** ([JETSTREAM], [NATS-LEAFNODE]):

1. **Account isolation**: Each org's subjects are invisible to other orgs by default. No subject namespace collision.
2. **JetStream domains**: Each leaf node (edge device) runs its own JetStream domain, providing offline persistence. Streams are mirrored to the cloud domain on reconnection.
3. **Cross-account exports/imports**: Orgs explicitly export subjects they want to share (e.g., `capacity.available`) into the `manufacturing-commons` system account. This is opt-in, auditable, and revocable.
4. **Decentralized JWT authentication**: Org accounts are provisioned via signed JWTs from an operator key. No centralized auth database. Edge devices carry their account JWT and can connect to any NATS endpoint.

**Ordering guarantee within accounts**: JetStream provides per-subject sequential ordering within an account's domain. G-1 (Per-Entity Sequential) is upheld within each org's account. Across accounts, only G-8 (eventual, bounded staleness) applies.

### 8.5 Adaptive ISA-95 Depth

The standard ISA-95 hierarchy (Enterprise → Site → Area → Line → Work Cell → Machine → Sensor) assumes a large, structured organization. For a metropolitan manufacturing network, hierarchy depth is **adaptive**:

| Org Profile | ISA-95 Levels Used | Mapping |
|-------------|-------------------|---------|
| **Solo machinist** (Earl, 2 CNC machines) | L0 + L1 only | Enterprise=Site=Area=Line=WorkCell=Earl. Two machines, each with sensors. No hierarchy traversal needed. |
| **Small shop** (5-20 machines, 1-3 employees) | L0 + L1 + L2 | One implicit "line" per shop. Alarm management (L2) activates when sensor count > threshold. |
| **Medium factory** (50-200 machines, shifts) | L0 through L3 | Full production lines, work cells, MES-level work orders. |
| **Large facility** (1000+ machines, multiple sites) | L0 through L4 | Full hierarchy. Cross-site analytics, ERP integration. |

**Consistency implications**: The guarantees table from Section 1.2 MUST be applied **adaptively**:

- **Earl's shop**: Only G-1 (per-entity sequential) and G-2 (per-entity causal) are required. The system SHOULD NOT impose G-3 (cross-entity causal) overhead for a 2-machine shop where cross-entity causality is trivially observable by Earl standing next to both machines.
- **Large facility**: Full G-1 through G-7 apply per Section 3.
- **Cross-org (all)**: G-8 applies uniformly regardless of org size.

### 8.6 CRDTs for Network-Level Aggregate State

Certain network-wide aggregates are **commutative** — the order of updates does not affect the final value. These are candidates for Conflict-free Replicated Data Types (CRDTs) [CRDT-SHAPIRO], [BAILIS-EC]:

| Aggregate | CRDT Type | Example |
|-----------|-----------|---------|
| **Total network capacity** (machines available) | G-Counter | Earl's 2 idle machines + PM Inc.'s 8 idle machines = 10 available |
| **Jobs completed this month** | G-Counter | Monotonically increasing across all orgs |
| **Capability registry** (what the network can make) | OR-Set | Earl adds "3-axis CNC milling"; PM Inc. adds "5-axis CNC + turning" |
| **Aggregate utilization** | LWW-Register per org | Each org publishes its own utilization %; network aggregates |

**Why CRDTs, not event sourcing, for network aggregates**: Event-sourcing individual org state into a global stream would require a total ordering across 200K+ publishers — violating G-8's relaxed ordering. CRDTs converge without ordering, making them ideal for network-level aggregates where precision matters less than availability.

**Implementation sketch** (NATS KV as CRDT substrate, [NATS-KV]):

```
NATS KV Bucket: network.capacity
Key: "earl-machine-shop.available"    → Value: 2
Key: "precision-machining.available"  → Value: 8
Key: "aero-dynamics.available"        → Value: 47

Aggregate: SUM(values) → 57 machines available in network
```

Each org updates only its own key (conflict-free by construction). Network views are computed by aggregating all keys. NATS KV provides last-writer-wins per key with revision tracking.

### 8.7 Manufacturing Commons Event Types

The cross-org domain introduces a new category of events not present in single-enterprise IIoT. These represent the **manufacturing commons** — a shared event-sourced view of the network:

| Event Type | Publisher | Consumers | Ordering Requirement |
|------------|-----------|-----------|---------------------|
| `OrgJoined` | Platform operator | All participants | Eventual |
| `CapabilityDeclared` | Org (opt-in) | Marketplace, search | Eventual |
| `CapacityAvailable` | Org (automated) | Work order routing | Bounded staleness (60s) |
| `WorkOrderPosted` | Requesting org | Capable orgs | Bounded staleness (60s) |
| `BidSubmitted` | Bidding org | Requesting org | Per-org sequential |
| `WorkOrderAccepted` | Requesting org | Winning bidder | Causal (MUST follow bid) |
| `JobCompleted` | Executing org | Requesting org, network stats | Eventual |
| `ReputationUpdated` | Platform (computed) | All participants | Eventual |

**Note**: `WorkOrderAccepted` requires **causal consistency** — it MUST be observed after the corresponding `BidSubmitted`. This is the only cross-org event with a causal constraint, and it is achievable because both events flow through the same NATS account (the requesting org's), preserving per-subject ordering.

### 8.8 PACELC Analysis for Cross-Org Domain

The PACELC theorem [PACELC] extends CAP to include the latency-consistency tradeoff even when the network is healthy:

```
If Partition:
  Choose Availability (AP) — Orgs continue operating independently

Else (no partition):
  Choose Latency over Consistency (EL) — 60s staleness is acceptable
  for cross-org data; sub-second consistency is not worth the
  coordination overhead across 200K accounts
```

| Data Path | CAP Position | PACELC | Rationale |
|-----------|-------------|--------|-----------|
| **Intra-org readings** (L0-L1) | CP (per-entity) | PC/EC | Consistency is critical; single partition domain |
| **Intra-org alarms** (L2) | CP (causal) | PC/EC | Alarm ordering is safety-critical [ISA-18.2] |
| **Intra-org work orders** (L3) | CP (session) | PC/EC | Operator session guarantees required [FDA-CFR11] |
| **Cross-org capacity** | AP | PA/EL | Availability > consistency; stale capacity is tolerable |
| **Cross-org marketplace** | AP (bids), CP (acceptance) | PA/EL (bids), PC/EC (acceptance) | Bids are fire-and-forget; acceptance is causal |
| **Network aggregates** | AP | PA/EL | CRDTs converge without coordination |

### 8.9 Failure Modes Specific to Cross-Org Domain

| Failure | Impact | Recovery | G-8 Compliance |
|---------|--------|----------|----------------|
| **Org edge device offline** | Org disappears from network capacity view | CRDT eventually removes stale capacity entries (TTL-based) | Bounded staleness violated until TTL expiry; SHOULD emit `OrgStale` event |
| **Org clock drift > 5s** | `originTimestamp` unreliable | `networkTimestamp` remains authoritative; intra-org ordering may degrade | G-8 unaffected (uses network timestamps); G-1 through G-5 degrade within org |
| **Cross-account import revoked** | Org no longer visible in marketplace | Immediate removal from capability registry (OR-Set remove) | N/A — intentional withdrawal |
| **Cloud NATS partition** | Multiple NATS clusters temporarily diverge | Raft consensus resolves; `networkTimestamp` may have brief gap | G-8 bounded staleness may be exceeded during partition; recover on heal |
| **Malicious org publishes false capacity** | Network aggregates corrupted | Reputation system, anomaly detection flag org; manual review | G-8 itself is unaffected (consistency is maintained); data integrity is a trust layer concern |

### 8.10 Research Gaps and Open Questions

1. **Deduplication window for reconnecting orgs**: When an edge device reconnects after extended offline, how large must the dedup window be? NATS JetStream default is 2 minutes [NATS-DEDUP-INF]. For orgs offline for days, message IDs MUST be deterministic (content-addressed) rather than time-windowed.

2. **Shard migration for org entities**: If @effect/cluster [EFFECT-CLUSTER] manages org-level entities (one entity per org), shard migration means an org's entity moves between cloud nodes. State reconstruction from JetStream MUST be bounded — replaying days of events for a large org could take minutes.

3. **Cross-org causal chains**: The manufacturing commons introduces limited causal chains (PostWorkOrder → SubmitBid → AcceptBid → CompleteJob). These are currently handled by routing through a single org's account. If the chain spans three orgs (requester → bidder → subcontractor), a coordination protocol may be needed.

4. **Network-level consistency monitoring**: How do we detect when G-8's 60-second bounded staleness is violated across 200K accounts? Sampling-based monitoring (not exhaustive) is likely necessary.

5. **CRDT garbage collection**: OR-Set entries for capabilities of defunct orgs accumulate. A tombstone garbage collection protocol is needed, respecting the eventual consistency model.

### 8.11 Codebase Grounding — How Cross-Org Maps to Implementation

The cross-org consistency model (this section) is grounded in the following implementation files. Each guarantee maps to specific code paths.

#### Event Distribution (4-channel hub)

The current EventDistribution service (`src/lib/iiot/realtime/event-distribution.ts`) implements the intra-org event flow. The 4 channels map to cross-org domain extensions:

| Channel (line 136-157) | Current Scope | Cross-Org Extension |
|------------------------|---------------|---------------------|
| `iiot:readings` (maxLag: 10,000) | Intra-org sensor telemetry | Org publishes summary to `capacity.{orgId}.available` via HolonetBridge |
| `iiot:alarms` (maxLag: 1,000) | Intra-org alarm lifecycle | No cross-org exposure (sovereign per G-9) |
| `iiot:equipment` (maxLag: 1,000) | Intra-org state transitions | Org publishes aggregate equipment status to commons |
| `iiot:invalidations` (maxLag: 1,000) | Intra-org cache coherence | No cross-org exposure |

**Dual-publish path** (event-distribution.ts:280-326): Every `publishReading` call writes to local PubSub AND fires `bridge.publishReading()` to NATS via HolonetBridge. This is the mechanism that would carry events from intra-org (Domain 1) to cross-org (Domain 2) when account exports are configured.

#### NATS Subject Hierarchy

The NATS subjects (`src/lib/iiot/realtime/iiot-subjects.ts`) define the current per-device subject patterns:

| Subject Spec | Pattern | Cross-Org Subject (new) |
|-------------|---------|------------------------|
| `IIoTReadingsSubject` (line 39-46) | `iiot.readings.{deviceId}` | `capacity.{orgId}.available` |
| `IIoTAlarmsSubject` (line 61-68) | `iiot.alarms.{deviceId}` | N/A (sovereign) |
| `IIoTEquipmentSubject` (line 83-90) | `iiot.equipment.{equipmentId}` | `status.{orgId}.equipment` |
| `IIoTInvalidationsSubject` (line 105-112) | `iiot.invalidations.{cacheKey}` | N/A (sovereign) |

Cross-org subjects would be defined as new subject specs following the same `createSubjectSpec()` pattern (`src/lib/holonet/subject/schemas.ts`), published via the HolonetBridge (`src/lib/iiot/realtime/holonet-bridge.ts`).

#### HolonetBridge (NATS transport)

The HolonetBridge (`src/lib/iiot/realtime/holonet-bridge.ts`) provides the NATS bridge for cross-node event distribution:

- **Outbound** (lines 35-57): `publishReading`, `publishAlarm`, `publishEquipment`, `publishInvalidation` — fire-and-forget to NATS via `NatsPubSubService` (`src/lib/holonet/nats/pubsub.ts`).
- **Inbound** (lines 59-80): `remoteReadings`, `remoteAlarms`, `remoteEquipment`, `remoteInvalidations` — scoped Streams subscribing to NATS wildcard subjects.

For multi-org, the HolonetBridge would need to be account-aware: outbound publishes route to the org's account, inbound subscriptions are scoped to the org's account subjects.

#### ReactivityBridge (handler-level integration)

The ReactivityBridge (`src/lib/iiot/realtime/reactivity-bridge.ts`) is the adapter between entity handlers and EventDistribution:

- Lines 49-55: `onAlarmEvent` — called by alarm entity handlers after state transitions
- Lines 58-62: `onEquipmentStateChange` — called by equipment entity handlers
- Lines 65-69: `onReading` — called by ingestion pipeline
- Lines 72-75: `onCacheInvalidation` — called for cache coherence

This handler-level integration pattern (Approach A, line 9) means cross-org events would be emitted at the handler call site, not by polling. Each entity handler decides what to publish to the commons.

#### Entity Stack (12 entity handlers)

The EntityStack (`src/lib/iiot/entity/EntityStack.ts`, line 54-67) composes all 12 entity handler layers:

```
EntityHandlersLayer = Layer.mergeAll(
  AlarmEntityHandlers, WorkOrderEntityHandlers, EquipmentStateEntityHandlers,
  EnterpriseEntityHandlers, SiteEntityHandlers, AreaEntityHandlers,
  PlantEntityHandlers, LineEntityHandlers, WorkCellEntityHandlers,
  MachineAssetEntityHandlers, DeviceEntityHandlers, SensorAssetEntityHandlers
)
```

Each entity's state machine is defined in its graph (`src/lib/iiot/machines/graphs/`). The 12 graphs define the valid state transitions that generate the events flowing through EventDistribution:

- `plant-graph.ts`, `line-graph.ts`, `workcell-graph.ts` — ISA-95 hierarchy state machines
- `machine-asset-graph.ts`, `device-graph.ts`, `sensor-graph.ts` — equipment state machines
- `alarm-state-graph.ts`, `work-order-graph.ts`, `equipment-state-graph.ts` — operational state machines
- `enterprise-graph.ts`, `site-graph.ts`, `area-graph.ts` — organizational state machines

#### State Services (12 services, KV-replaceable)

The state services (`src/lib/iiot/state/index.ts`, lines 15-27) provide swappable persistence. The 12 in-memory implementations are used for testing:

`AlarmState`, `WorkOrderState`, `EquipmentStateService`, `MachineState`, `AreaState`, `SensorAssetState`, `PlantState`, `EnterpriseState`, `SiteState`, `WorkCellState`, `LineState`, `DeviceState`

For cross-org, the state services would need a NATS KV-backed implementation replacing the in-memory maps. NATS KV provides per-key revision tracking that maps to the CRDT substrate described in Section 8.6.

#### WebSocket Transport

The WebSocket server (`src/lib/iiot/realtime/websocket-server.ts`) mounts at `/ws/iiot` and routes 4 streaming RPCs defined in `src/lib/iiot/rpc/RealtimeRpcs.ts`:

- `Realtime.SubscribeReadings` (line 107-121) — `stream: true`, filters by `deviceId` or `plantId`
- `Realtime.SubscribeAlarms` (line 129-141) — `stream: true`, filters by `deviceId`, `minSeverity`
- `Realtime.SubscribeEquipmentState` (line 149-161) — `stream: true`, filters by `entityType`, `plantId`
- `Realtime.SubscribeInvalidations` (line 169-177) — `stream: true`, filters by `patterns`

For cross-org subscriptions, new RPC definitions would follow the same pattern but filter by `orgId` instead of `deviceId`, consuming from the manufacturing commons system account.

#### Ingestion Pipeline

The SparkplugPipelineLayer (`src/lib/iiot/adapters/ingestion-service.ts`, lines 297-322) composes:

`SparkplugAdapterLive → TopicRouter → ReadingProcessor → AlarmDetector → IngestionService`

This pipeline is the L0-L1 data path. In a multi-org deployment, each edge device runs its own pipeline instance. The pipeline's output feeds into EventDistribution, which feeds into HolonetBridge for cross-node (and cross-org) distribution.

#### Branded Identifiers (Effect Schema)

The identifier system (`src/lib/iiot/schemas/identifiers.ts`) defines the ISA-95 hierarchy as branded types:

- `EnterpriseId` (line 46), `SiteId` (line 50), `AreaId` (line 54), `PlantId` (line 58)
- `LineId`, `WorkCellId`, `MachineId`, `DeviceId`, `SensorId` (further in file)

For cross-org, a new `OrganizationId` branded type would be needed at the top of the hierarchy, representing the NATS account boundary.

### 8.12 Additional Cross-Organization Guarantees (G-9, G-10, G-12)

G-8 (Section 8.2) defines the baseline cross-org consistency model. Three additional guarantees formalize properties implicit in Sections 8.4, 8.7, and 8.9 but not previously stated with RFC 2119 [RFC2119] language.

#### G-9: Data Sovereignty at the Consistency Boundary (MUST)

> **G-9 (Data Sovereignty)**: Each organization's event data MUST remain within its NATS account boundary by default. Cross-organization data sharing MUST be explicitly opted-in via account export declarations. An organization MUST be able to revoke exports at any time, with revocation taking effect within one G-8 staleness window (60 seconds).

Formal properties:

1. **Default isolation**: No event published within an org's account is observable by any other org's account unless an explicit export exists.
2. **Opt-in sharing**: Cross-account exports are declared via NATS account JWT configuration [NATS-JWT]. Each export specifies the subject pattern, target account(s), and whether the export is public or private.
3. **Revocable**: Export revocation MUST propagate within 60 seconds. Cached cross-org data beyond the revocation point MUST be purged from subscriber views.
4. **Audit trail**: Every export/import relationship MUST be logged with timestamps for regulatory compliance [FDA-CFR11].

**Relationship to IDS**: This guarantee maps to the International Data Spaces [IDS-RAM] principle of data sovereignty — the data owner retains control over who can access their data and under what conditions, even after sharing.

#### G-10: Signal Trustworthiness (SHOULD)

> **G-10 (Signal Trustworthiness)**: Cross-organization events SHOULD carry attestation metadata enabling consumers to assess signal reliability. The platform SHOULD maintain per-organization trust scores derived from historical signal accuracy. Consumers MAY weight signals by trust score when computing network aggregates.

This guarantee addresses the "malicious org publishes false capacity" failure mode (Section 8.9) at the protocol level rather than relying solely on manual review.

Formal properties:

1. **Attestation envelope**: Cross-org events SHOULD include:
   - `clockQuality`: Self-reported clock source (`ntp-consumer`, `ntp-enterprise`, `ptp-gps`, `unknown`)
   - `dataSource`: How the value was obtained (`sensor-direct`, `manual-entry`, `derived-calculation`, `third-party`)
   - `certifications`: Optional array of org certifications relevant to the signal (`iso-9001`, `as9100`, `nadcap`)

2. **Trust score model**: The platform SHOULD compute per-org trust scores based on:
   - **Signal consistency**: Does the org's reported capacity correlate with actual job completions? (e.g., org claims 10 idle machines but never completes jobs)
   - **Clock accuracy**: Measured delta between `originTimestamp` and `networkTimestamp` over time. Persistent large deltas reduce trust.
   - **Uptime reliability**: Ratio of online time to total time. Intermittent orgs are less reliable for capacity planning.
   - **Peer validation**: Cross-referencing with other orgs that interact with this org (delivered parts on time, quality reports).

3. **Weighted aggregation**: Network-level aggregates (Section 8.6) MAY apply trust-weighted computation:
   ```
   weighted_capacity = SUM(org_capacity[i] * trust_score[i]) / SUM(trust_score[i])
   ```
   This prevents a single malicious or misconfigured org from corrupting network views.

4. **Trust score is NOT a consistency property**: Trust scores are eventually consistent, computed asynchronously, and informational. They do NOT affect G-8 delivery guarantees — all events are delivered regardless of trust score. Consumers decide how to weight signals.

**Precedent**: Financial market microstructure [MARKET-MICROSTRUCTURE] uses similar concepts — order book entries from different market makers carry different levels of trust based on fill rates and historical accuracy. Manufacturing capacity signals are analogous to limit orders: stated availability that may or may not be honored.

#### G-12: Commons Governance Signals (SHOULD)

> **G-12 (Commons Governance)**: The manufacturing commons SHOULD emit governance events that enable participants to observe and reason about the network's operational state. Governance events SHOULD be eventually consistent with no ordering guarantees beyond G-8.

This guarantee formalizes the "manufacturing commons event types" from Section 8.7 as a protocol obligation rather than an implementation detail.

Formal properties:

1. **Network health signals**: The platform SHOULD emit periodic network-level health events:
   - `NetworkCapacitySummary`: Aggregate available capacity by capability type (every 60s)
   - `NetworkUtilization`: Aggregate utilization percentage across all reporting orgs (every 60s)
   - `OrgStale`: Emitted when an org's last heartbeat exceeds 2x the G-8 staleness window (120s)
   - `OrgReconnected`: Emitted when a previously stale org reconnects

2. **Marketplace lifecycle signals**: Work order lifecycle events (Section 8.7) SHOULD follow causal ordering within the requesting org's account:
   ```
   WorkOrderPosted → BidSubmitted* → BidAccepted → JobStarted → JobCompleted
   ```
   Where `BidSubmitted*` events from multiple bidding orgs have no ordering relative to each other (only bounded staleness).

3. **Governance as commons resource**: Following Ostrom's principles [OSTROM-COMMONS], governance signals enable self-monitoring by participants without centralized enforcement. An org can observe `NetworkCapacitySummary` to decide whether to post work orders, without a centralized scheduler dictating allocation.

4. **No single point of governance failure**: Governance events are computed and published by singleton services in the cloud NATS cluster. If the singleton fails, governance events pause but org-level operations (G-1 through G-7) are unaffected. Recovery is automatic via @effect/cluster [EFFECT-CLUSTER] singleton failover.

---

## 9. References

All references use canonical keys from the project bibliography (`docs/specifications/bibliography.md`).

### Normative

- [RFC2119] — Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
- [ISA-95-1] — ANSI/ISA-95.00.01-2010. Enterprise-Control System Integration, Part 1.
- [ISA-18.2] — ANSI/ISA-18.2-2016. Management of Alarm Systems for the Process Industries.
- [FDA-CFR11] — U.S. FDA, 21 CFR Part 11. Electronic Records; Electronic Signatures.
- [IEC-61508] — IEC 61508. Functional Safety of E/E/PE Safety-related Systems.

### NATS / JetStream

- [JETSTREAM] — Synadia. "NATS JetStream."
- [JETSTREAM-DEEPDIVE] — Synadia. "JetStream Model Deep Dive."
- [JETSTREAM-CONSUMERS] — Synadia. "JetStream Consumers."
- [NATS-KV] — Synadia. "NATS Key-Value Store."
- [NATS-DEDUP-INF] — Synadia. "Infinite Message Deduplication in JetStream."
- [NATS-DISCUSS-3908] — nats-io/nats-server. "Discussion #3908: Ordering Guarantees Per Entity."
- [NATS-COMPARE] — Synadia. "Compare NATS."
- [NATS-LEAFNODE] — Synadia. "NATS Leaf Nodes."
- [NATS-ACCOUNTS] — Synadia. "NATS Account-Based Security."
- [NATS-JWT] — Synadia. "In-Depth JWT Guide for NATS."
- [NATS-DECENTRALIZED] — Synadia. "NATS Decentralized JWT Authentication."

### Distributed Systems Theory

- [LAMPORT-1978] — Lamport, L. "Time, Clocks, and the Ordering of Events in a Distributed System." 1978.
- [RAFT] — Ongaro, D. and Ousterhout, J. "In Search of an Understandable Consensus Algorithm." 2014.
- [CAP-BREWER] — Brewer, E.A. "CAP Twelve Years Later: How the 'Rules' Have Changed." 2012.
- [PACELC] — Abadi, D. "Consistency Tradeoffs in Modern Distributed Database System Design." 2012.
- [BAILIS-EC] — Bailis, P. and Ghodsi, A. "Eventual Consistency Today: Limitations, Extensions, and Beyond." 2013.
- [CRDT-SHAPIRO] — Shapiro, M. et al. "Conflict-Free Replicated Data Types." 2011.
- [VECTOR-CLOCKS] — Fidge, C.J. "Timestamps in Message-Passing Systems That Preserve the Partial Ordering." 1988.
- [EVENT-SOURCING] — Fowler, M. "Event Sourcing." 2005.

### Effect-TS

- [EFFECT-CLUSTER] — Effect Contributors. "@effect/cluster — Distributed Entity Management with Sharding."
- [EFFECT-ENTITY] — Effect Contributors. "@effect/cluster/Entity — Cluster-Managed Entity Lifecycle."

### Comparison Sources

- [KAFKA] — Apache Software Foundation. "Apache Kafka Documentation."
- [RABBITMQ-STREAMS] — VMware/Broadcom. "RabbitMQ Streams."
- [AWS-IOT-EVENTS] — Amazon Web Services. "AWS IoT Events Developer Guide."
- [AZURE-DT] — Microsoft. "Azure Digital Twins Documentation."
- [NATS-VS-KAFKA] — Synadia. "NATS and Kafka Compared."
- [NATS-VS-KAFKA-UNS] — i-flow GmbH. "NATS vs. Kafka: Comparison for the Unified Namespace (UNS)."

### Manufacturing Network & Federation

- [IDS-RAM] — International Data Spaces Association. "IDS Reference Architecture Model (IDS-RAM) 4.0." IDSA, 2023.
- [OSTROM-COMMONS] — Ostrom, E. *Governing the Commons: The Evolution of Institutions for Collective Action.* Cambridge University Press, 1990.
- [MARKET-MICROSTRUCTURE] — Cont, R., Stoikov, S., and Talreja, R. "A Stochastic Model for Order Book Dynamics." *Operations Research*, 58(3), 2010.

### Internal Research

- [TMNL-CONSISTENCY] — "Research: Consistency Models for Metropolitan-Scale IIoT." This document.
