# RFC-001 Section: Failure Modes & Recovery

```
Section:       Failure Modes & Recovery
RFC:           001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        failure-runbook-writer (Val)
Created:       2026-02-09
Companion:     docs/specifications/rfc-section-consistency-guarantees.md
Bibliography:  docs/specifications/bibliography.md
```

---

## FM.1 Scope

This section classifies the failure modes that a metropolitan-scale IIoT event
distribution system MUST tolerate when serving 200K+ organizations across
federated NATS infrastructure, `@effect/cluster` entity sharding, and
heterogeneous edge devices. It specifies detection mechanisms, automatic
recovery sequences, operator escalation criteria, and chaos engineering
validation for each failure class.

This section is normative for failure detection and recovery requirements.
Implementations MAY choose alternative recovery strategies provided they meet
the Recovery SLOs defined in FM.8.4.

**Companion sections**:

- `rfc-section-consistency-guarantees.md` -- Guarantee-to-codebase mapping (Y.9
  failure sequences are expanded here)
- `rfc-section-two-domain-consistency.md` -- Normative ordering guarantees G-1
  through G-10
- `rfc-section-security-trust.md` -- Trust and tenant isolation failures

---

## FM.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119] and [RFC8174].

File paths are relative to `packages/tmnl/` and use the `src/` prefix.

Failure severities follow the incident response levels defined in RB.5 of the
companion Operational Runbooks section:

| Severity | Label    | Impact                                     |
|----------|----------|--------------------------------------------|
| **P1**   | Critical | Total event distribution failure            |
| **P2**   | High     | Single hub or cluster failure               |
| **P3**   | Medium   | Individual org or device connectivity issue  |
| **P4**   | Low      | Non-critical feature degradation            |

---

## FM.3 Failure Classification

### FM.3.1 Taxonomy

Failures are classified along two axes: **duration** (transient vs persistent)
and **trustworthiness** (honest vs Byzantine).

| Class | Duration | Trust | Examples |
|-------|----------|-------|----------|
| **Transient** | Seconds to minutes | Honest | Network blip, temporary overload, GC pause, DNS timeout |
| **Persistent** | Minutes to hours+ | Honest | Hardware failure, disk corruption, prolonged partition |
| **Byzantine** | Indeterminate | Malicious or faulty | Compromised edge device, malicious org, firmware bug producing invalid data |
| **Cascading** | Progressive | Honest | Backpressure propagation, resource exhaustion chain, thundering herd on reconnect |

### FM.3.2 Failure Domains

Each failure domain corresponds to a bounded failure zone:

```
                     ┌─────────────────────────────────────────────┐
                     │              CLOUD CLUSTER                  │
                     │  ┌─────────┐  ┌─────────┐  ┌────────────┐ │
                     │  │ NATS    │  │ @effect/ │  │ Database   │ │
                     │  │ Cluster │  │ cluster  │  │ (Postgres) │ │
                     │  │ (Raft)  │  │ Runners  │  │            │ │
                     │  └────┬────┘  └────┬─────┘  └─────┬──────┘ │
                     │       │            │              │        │
                     └───────┼────────────┼──────────────┼────────┘
                             │            │              │
              ┌──────────────┼────────────┼──────────────┘
              │              │            │
    ┌─────────┴───────┐  ┌──┴──────────┐
    │  HUB A          │  │  HUB B      │   ... (N hubs)
    │  ┌────────────┐ │  │  ┌────────┐ │
    │  │ NATS Leaf  │ │  │  │ NATS   │ │
    │  │ Node       │ │  │  │ Leaf   │ │
    │  └─────┬──────┘ │  │  └───┬────┘ │
    │        │        │  │      │      │
    │  ┌─────┴──────┐ │  │      │      │
    │  │ Edge       │ │  │      │      │
    │  │ Devices    │ │  │      │      │
    │  └────────────┘ │  │      │      │
    └─────────────────┘  └──────┘──────┘
```

| Domain | Blast Radius | Isolation Mechanism |
|--------|-------------|---------------------|
| Edge device | Single device, single org | Device scope finalizer |
| Hub NATS leaf | All orgs on that hub | NATS leaf node reconnection |
| Cloud NATS cluster | All hubs, all orgs | Raft consensus failover |
| `@effect/cluster` runner | Entities on that runner | Shard migration via HashRing [EFFECT-HASHRING] |
| Database (Postgres) | All persistent state | Connection pool + circuit breaker |
| Cross-org boundary | Multi-org operations | NATS Account isolation [NATS-ACCOUNTS] |

### FM.3.3 Failure Propagation Model

Failures propagate along dependency edges. The system MUST implement **bulkhead
isolation** [REACTIVE-MANIFESTO] to prevent cascading:

```
Edge Device Failure
  └─► Sparkplug disconnect
       └─► SparkplugAdapter detects (healthRef update)
            ├─► Local: EventDistribution continues (PubSub.unbounded)
            └─► Remote: HolonetBridge absorbs (Effect.ignoreLogged)

NATS Cluster Failure
  └─► Raft leader election timeout
       └─► Minority partition rejects writes
            ├─► Publishers buffer locally (JetStream client buffer)
            └─► Consumers pause (no new messages)
                 └─► EventDistribution outlets continue (local PubSub)

@effect/cluster Runner Crash
  └─► Shard orphaned
       └─► HashRing rebalance
            └─► New runner acquires shard lock
                 └─► Entity re-created on first message
                      └─► ReactivityBridge reconnected
```

---

## FM.4 NATS Infrastructure Failures

### FM.4.1 Hub Server Crash

**Classification**: Persistent (until restart) | P2

**Detection**:
- NATS cluster Raft heartbeat timeout (default 2s)
- `nats server report connections` shows server offline
- Client-side `StatusChangedEvent` callback fires

**Impact**:
- JetStream consumers on the crashed server lose their push subscriptions
- Messages in-flight to that server's consumers are unacknowledged
- Raft group may lose quorum if crash takes cluster below majority

**Recovery sequence**:

1. Raft elects new leader within remaining servers (< 5s typical)
2. JetStream consumers detect disconnection, reconnect to surviving servers
3. Unacknowledged messages are redelivered after `AckWait` expires
4. Consumer resumes from last acknowledged sequence number
5. `Nats-Msg-Id` dedup [NATS-DEDUP-INF] prevents duplicate processing

**Codebase grounding**:
- `src/lib/iiot/realtime/holonet-bridge.ts` lines 102-128: outbound publishes
  use `Effect.ignoreLogged` to absorb connection failures during crash
- `src/lib/iiot/adapters/sparkplug-adapter.ts` line 461: `Effect.retry(defaultRetrySchedule)`
  with exponential backoff (1s base, 10 retries max)

**G-1 impact**: Maintained -- JetStream per-subject ordering survives leader
failover. Messages may be redelivered but not reordered [JETSTREAM].

### FM.4.2 JetStream Storage Full

**Classification**: Persistent (until resolved) | P2

**Detection**:
- `nats server report jetstream` shows storage utilization > 90%
- Publish attempts receive `-ERR 'maximum bytes exceeded'`
- HolonetBridge publish failures spike in metrics

**Impact**:
- New messages cannot be stored in affected streams
- Depending on stream `discard` policy:
  - `DiscardOld`: oldest messages are evicted (data loss for old events)
  - `DiscardNew`: new publishes are rejected (data loss for new events)
- Backpressure propagates to publishers

**Recovery sequence**:

1. Alert fires on storage utilization threshold (> 85%)
2. Stream retention policy evicts expired messages automatically
3. If automatic eviction insufficient:
   a. Operator reviews stream configuration (`max_msgs`, `max_bytes`, `max_age`)
   b. Operator purges historical data beyond retention window
   c. Operator adds storage to NATS server
4. Publishers retry buffered messages once storage available

**Normative requirement**: Streams MUST configure `max_age` retention to
prevent unbounded growth. RECOMMENDED values:

| Stream | `max_age` | `max_bytes` | `discard` |
|--------|-----------|-------------|-----------|
| iiot-readings | 24h | 10 GB per hub | DiscardOld |
| iiot-alarms | 30d | 2 GB per hub | DiscardNew |
| iiot-equipment | 30d | 2 GB per hub | DiscardNew |
| iiot-invalidations | 1h | 500 MB per hub | DiscardOld |

**Rationale**: Alarm and equipment state events use `DiscardNew` because
losing historical alarm data violates [ISA-18.2] record-keeping requirements.
Reading data uses `DiscardOld` because the most recent sensor value is always
more operationally relevant than historical values for real-time display.

### FM.4.3 Cross-Hub Network Partition

**Classification**: Transient to Persistent | P2

**Detection**:
- NATS leaf node `stale connection` events
- Cross-hub subscription delivery stops
- `networkTimestamp` delta exceeds threshold (> 60s)

**Impact**:
- Partitioned hub operates autonomously (local events continue)
- Cross-hub event delivery pauses
- Cross-org consistency (G-8) temporarily violated
- Intra-org guarantees (G-1 through G-5) are maintained within each partition

**Recovery sequence**:

```
 Hub A (partitioned)              Cloud NATS              Hub B (connected)
 ────────────────────             ──────────              ─────────────────
 Local events continue            Detects stale           Normal operation
 HolonetBridge buffers            leaf conn               continues
       │                                │
       ▼                                │
 Partition heals ──────────────────────►│
       │                                │
       ▼                                ▼
 Leaf reconnects                  Buffered messages
 Resume from last ack            delivered in order
       │                                │
       ▼                                ▼
 G-1 maintained                  G-8 convergence
 (local ordering                 (cross-org events
  never broken)                   arrive, ordered
                                  by networkTimestamp)
```

1. Hub A's NATS leaf node detects disconnection
2. Local `PubSub.unbounded` in EventDistribution continues buffering events
3. HolonetBridge outbound publishes fail silently (`Effect.ignoreLogged`,
   `holonet-bridge.ts` line 107)
4. On partition heal, leaf node reconnects to cloud cluster
5. JetStream consumer resumes from last acknowledged sequence
6. Buffered events flow through, ordered by per-subject sequence numbers
7. `networkTimestamp` is assigned on cloud ingestion, providing cross-org
   ordering basis for late-arriving events

**G-6 status**: Maintained -- hub autonomy is the design intent [NATS-ADAPTIVE-EDGE].

### FM.4.4 Subject Space Exhaustion

**Classification**: Persistent | P3

**Detection**:
- NATS server `$SYS.SERVER.*.STATSZ` reports subject count near limits
- New subject creation fails with permission error
- Entity event publishing returns error for new entity IDs

**Impact**:
- New entities cannot be created (their subjects cannot be provisioned)
- Existing entities continue operating normally
- Primarily affects high-growth orgs onboarding many devices

**Recovery**:
1. Monitor subject count per NATS account (org)
2. Implement subject space quotas in NATS account JWTs [NATS-JWT]
3. Clean up subjects for decommissioned entities
4. Tier subject limits by org subscription level

---

## FM.5 @effect/cluster Failures

### FM.5.1 Runner Crash

**Classification**: Transient (auto-recovery) | P2

**Detection**:
- `RunnerStorage` heartbeat expires (configurable, default 10s)
- `HashRing` [EFFECT-HASHRING] detects runner removal
- Shard assignment table updated

**Impact**:
- All entities on the crashed runner are interrupted
- In-flight entity operations fail
- Entity state is preserved in the state service (database or in-memory)

**Recovery sequence**:

```
Runner A (crashed)          RunnerStorage           Runner B (healthy)
──────────────────          ──────────────          ──────────────────
 Entity instances
 interrupted               Heartbeat expires
       │                        │
       ▼                        ▼
 Scope finalizers          Shard lock released
 fire (cleanup)                 │
                                ▼
                           HashRing rebalance ──────► Shard lock acquired
                                                          │
                                                          ▼
                                                    First message arrives
                                                          │
                                                          ▼
                                                    Entity.build() runs
                                                    State loaded from DB
                                                    ReactivityBridge reconnects
                                                    Machine state restored
```

1. Crashed runner's `Scope` finalizers fire on surviving infrastructure
2. `RunnerStorage` detects heartbeat expiry, marks runner as dead
3. `HashRing` [EFFECT-HASHRING] recalculates shard assignments
4. Healthy runner(s) acquire orphaned shard locks via advisory locks
5. Entity instances are lazily re-created on first incoming message
6. `Entity.build()` runs: state loaded from database, Machine restored from
   persisted state, ReactivityBridge connection established
7. Forked observers (PubSub subscribers) re-created in new `Scope`

**Codebase grounding**:
- `src/lib/iiot/entity/EntityStack.ts` lines 54-67: `EntityHandlersLayer`
  composes all 12 entity types via `Layer.mergeAll`
- `src/lib/iiot/http/server.ts` line 70: request flow through
  `Sharding -> EntityManager -> Mailbox -> Entity behavior`

**G-1 status**: Maintained -- JetStream subject ordering is transport-level.
Entity recreation does not reorder events.

### FM.5.2 Shard Rebalancing During Scale Events

**Classification**: Transient | P3

**Detection**:
- Runner pool size change (scale-up or scale-down)
- `HashRing` rebalance triggered
- Entity migration events logged

**Impact**:
- Subset of entities are migrated between runners
- Brief interruption during entity `Scope` teardown and `build()` on new runner
- In-flight operations for migrating entities may fail and be retried

**Recovery sequence**:

1. New runner joins pool / existing runner drains
2. `HashRing` [EFFECT-HASHRING] recalculates consistent hash assignments
3. Affected shards: old runner receives interrupt signal
4. Entity `Scope` finalizers fire (ReactivityBridge disconnected, Machine stopped)
5. Shard lock transferred to new runner via `RunnerStorage`
6. Entities lazily re-created on next message delivery
7. Entity state intact in persistent store (no data loss)

**Normative requirement**: The system SHOULD implement **graceful drain** for
planned scale-down events. The draining runner MUST complete in-flight entity
operations before releasing shard locks.

### FM.5.3 Entity State Corruption

**Classification**: Persistent | P2

**Detection**:
- Machine state graph rejects a transition that should be valid
- State service read returns inconsistent data
- Entity handler throws `InvalidStateTransition` error

**Impact**:
- Affected entity instance cannot process new events
- Other entities on the same runner are unaffected (entity isolation)

**Recovery sequence**:

1. Detect corruption via Machine graph validation
   (`src/lib/iiot/machines/AlarmMachine.ts`, `EquipmentStateMachine.ts`)
2. Interrupt corrupt entity instance
3. Rebuild entity state from event journal:
   a. Read all events for entity ID from JetStream (full replay)
   b. Apply events sequentially through Machine state graph
   c. Validate reconstructed state against integrity invariants
4. If rebuild succeeds: entity resumes normal operation
5. If rebuild fails: entity enters quarantine (stops processing, alerts operator)

**Normative requirement**: Entity handlers MUST be idempotent (G-7) to support
replay-based state reconstruction. This is enforced by Machine state graph
validation and state service upsert semantics
(`src/lib/iiot/state/StateShape.ts` line 10).

### FM.5.4 Split-Brain: Dual Shard Ownership

**Classification**: Byzantine | P1

**Detection**:
- Two runners claim the same shard ID in `RunnerStorage`
- Fencing token mismatch on entity state writes
- Concurrent state mutations detected in audit log

**Impact**:
- Conflicting writes to the same entity from two runners
- Data consistency violations (two versions of entity state)

**Recovery sequence**:

1. `RunnerStorage` advisory locks [EFFECT-CLUSTER] detect concurrent claims
2. Fencing token comparison: runner with **older** token MUST yield
3. Yielding runner interrupts its entity instances for the contested shard
4. Winning runner continues with its state
5. Reconciliation: compare event journal sequence numbers to determine
   which runner's state is authoritative
6. Advisory: emit `SplitBrainDetected` event for operator review

**Normative requirement**: `RunnerStorage` MUST use database advisory locks
(PostgreSQL `pg_advisory_lock`) with fencing tokens to prevent dual ownership.
The fencing token MUST be checked on every state write operation.

---

## FM.6 Edge Device Failures

### FM.6.1 Power Loss

**Classification**: Transient | P3

**Detection**:
- Sparkplug `NDEATH` message published by MQTT broker (Last Will and Testament)
- Device heartbeat stops (configurable timeout, default 65s -- see
  `sparkplug-adapter.ts` line 367: `keepalive: 65`)

**Impact**:
- Device stops publishing sensor readings
- Alarms for the device cannot be generated
- Other devices in the same org are unaffected

**Recovery sequence**:

1. MQTT broker publishes `NDEATH` for the disconnected edge node
2. SparkplugAdapter detects death certificate:
   - `healthRef` updated (`connected: false`) at
     `sparkplug-adapter.ts` line 416
   - State registry marks device as offline
3. Device restarts, publishes `NBIRTH` with current metric aliases
4. SparkplugAdapter alias registry updated from `NBIRTH` payload
5. Device resumes publishing `DDATA` messages
6. Buffered readings (if device has local storage) are replayed

**Sparkplug recovery flow** [SPARKPLUG-B]:

```
Device (power cycle)     MQTT Broker          SparkplugAdapter
────────────────────     ───────────          ─────────────────
 Power lost
       │
       ▼
                         LWT fires:
                         NDEATH published ──► processMessage detects
                                              NDEATH → mark offline
                                                    │
 Power restored                                     │
       │                                            │
       ▼                                            │
 NBIRTH published ──────► Delivered ───────────────► processMessage:
                                                     alias registry
                                                     rebuilt from NBIRTH
       │                                                    │
       ▼                                                    ▼
 DDATA resumes ──────────► Delivered ───────────────► IngestedReading
                                                     emitted to pipeline
```

### FM.6.2 Network Disconnection (Intermittent)

**Classification**: Transient | P3

**Detection**:
- MQTT keepalive failure (65s timeout)
- SparkplugAdapter retry schedule activates
  (`defaultRetrySchedule`: exponential backoff, 1s base, 10 retries)

**Impact**:
- Sensor readings not delivered during disconnection
- Local device may buffer readings (device-specific capability)
- EventDistribution continues for other devices

**Recovery sequence**:

1. MQTT client detects TCP connection loss
2. Automatic reconnection via `reconnectPeriod: 1000`
   (`sparkplug-adapter.ts` line 367)
3. SparkplugAdapter retry fires: `Effect.retry(defaultRetrySchedule)`
   (`sparkplug-adapter.ts` line 461)
4. On successful reconnect, MQTT subscriptions re-established
5. Device publishes `NBIRTH` (alias registry rebuilt)
6. Buffered device readings flow through pipeline

**Retry schedule** (from `sparkplug-adapter.ts` lines 383-386):
```
Attempt  Delay
1        1s
2        2s
3        4s
4        8s
5        16s
6        32s
7        64s
8        128s
9        256s
10       512s (max, ~8.5 min)
```

### FM.6.3 Storage Full on Edge Device

**Classification**: Persistent | P4

**Detection**:
- Device reports storage metrics via Sparkplug `NBIRTH`/`NDATA`
- Write failures in device-local buffer

**Impact**:
- Device cannot buffer readings during disconnection
- Historical data may be lost during the storage-full period
- Real-time readings continue flowing if network is available

**Recovery**:
1. Device-side eviction policy: RECOMMENDED oldest-data-first
2. Alert operator via `StorageCapacityWarning` event when > 80% full
3. Operator actions: increase storage, adjust retention, reduce sampling rate
4. Device resumes buffering once storage freed

### FM.6.4 Firmware Corruption

**Classification**: Persistent (until reflash) | P3

**Detection**:
- Device publishes malformed Sparkplug payloads
- `processMessage` in SparkplugAdapter fails to decode metrics
- CRC/hash mismatch on device boot self-check

**Impact**:
- Device produces invalid or garbage readings
- Pipeline drops invalid messages (Schema validation in ReadingProcessor)
- Potential false alarms if partial data passes validation

**Recovery**:
1. SparkplugAdapter drops malformed messages with logged warning
2. `IngestionError` with `code: 'PROTOCOL_ERROR'` emitted
   (`sparkplug-adapter.ts` line 480)
3. Operator receives alert on sustained protocol errors from single device
4. Device firmware rollback via watchdog timer (device-specific)
5. If watchdog fails: manual reflash via OTA or physical access

---

## FM.7 Cross-Org Failure Scenarios

### FM.7.1 Org Goes Offline During Active Work Order

**Classification**: Transient | P3

**Context**: An organization has an active work order (e.g., shared equipment
maintenance) that spans two orgs. Org A goes offline mid-workflow.

**Impact**:
- Work order entity in `@effect/cluster` continues running on cloud runner
- Org B can still read work order state via cross-org RPC
- Org A's local operators lose real-time visibility
- Work order state transitions from Org A's operators are queued (not lost)

**Recovery sequence**:

1. Work order entity detects Org A offline via heartbeat
2. Workflow Saga [MSVC-SAGA] enters **compensation-pending** state
   (`src/lib/iiot/workflow/AlarmLifecycleWorkflow.ts` line 18:
   `Activity.make() wraps entity calls with retry semantics`)
3. Pending transitions buffered in JetStream (Org A's account)
4. On Org A reconnection:
   a. Buffered messages delivered to work order entity
   b. Entity Machine validates transition sequence
   c. Saga resumes from last committed step

**FDA 21 CFR Part 11 compliance** [FDA-CFR11]: Work order state transitions
MUST be audit-logged regardless of org connectivity state. The cloud-side
entity handler writes to the audit trail even when the originating org is
offline.

### FM.7.2 Trust Score Manipulation Attempt

**Classification**: Byzantine | P2

**Detection**:
- Anomalous trust score change rate (> 2 sigma from historical norm)
- Cross-org attestation envelope validation failure
- Trust score audit log review flags inconsistency

**Impact**:
- Manipulated trust scores could grant unearned marketplace privileges
- Cross-org data sharing decisions based on fraudulent trust

**Recovery**:
1. Trust score computation service freezes score for flagged org
2. All cross-org exports from flagged org are suspended [NATS-ACCOUNTS]
3. Attestation envelopes from flagged org require manual verification
4. Operator investigation via audit trail
5. If confirmed: org account revoked, trust score reset to zero

**Codebase grounding**: Trust score is a singleton service in
`@effect/cluster` [EFFECT-CLUSTER]. Score freezing is an atomic operation
on the entity state.

### FM.7.3 Marketplace Listing Fraud

**Classification**: Byzantine | P3

**Detection**:
- Equipment capability claims not corroborated by telemetry
- Peer org reports discrepancy between listed and actual capabilities
- Automated capability verification via historical sensor data

**Impact**:
- Orgs may contract for capabilities that don't exist
- Manufacturing commons integrity degraded

**Recovery**:
1. Listing suspended pending verification
2. Historical telemetry audit for claimed equipment
3. If fraud confirmed: listing removed, org trust score penalty
4. Affected counterparties notified
5. Manufacturing commons governance event emitted (G-12)

### FM.7.4 Data Sovereignty Violation Attempt

**Classification**: Byzantine | P1

**Detection**:
- NATS Account export attempted to unauthorized region
- JWT token with geographic restrictions violated
- Audit log shows data flow to disallowed jurisdiction

**Impact**:
- Potential regulatory violation (GDPR, CCPA, etc.)
- Org data exposed to unauthorized parties

**Recovery**:
1. NATS Account revocation: immediate export revocation [NATS-JWT]
2. All active subscriptions from unauthorized consumers terminated
3. Incident logged with full audit trail
4. Regulatory notification procedure activated (per org's jurisdiction)
5. Post-incident: review and tighten Account JWT geographic constraints

**G-9 enforcement**: NATS Account isolation provides the first line of
defense. The system MUST validate geographic constraints at the Account
JWT level before any cross-org data sharing is permitted.

---

## FM.8 Recovery Procedures

### FM.8.1 Automatic Recovery (No Human Intervention)

These failures recover without operator involvement:

| Failure | Recovery Mechanism | Max Recovery Time |
|---------|--------------------|-------------------|
| Transient network blip | MQTT `reconnectPeriod: 1000` | < 5s |
| Single NATS server crash | Raft leader election | < 10s |
| JetStream consumer disconnect | Auto-reconnect + resume | < 30s |
| `@effect/cluster` runner crash | HashRing rebalance | < 60s |
| Edge device power cycle | Sparkplug NBIRTH rebirth | < 120s |
| Clock skew < 5s | NTP correction | < 300s |

**Implementation pattern**: All automatic recovery uses the Effect retry
combinator with bounded schedules:

```
Effect.retry(Schedule.compose(
  Schedule.exponential('1 second'),   // Exponential backoff
  Schedule.recurs(10),                // Bounded retry count
))
```

Ref: `src/lib/iiot/adapters/sparkplug-adapter.ts` lines 383-386.

### FM.8.2 Semi-Automatic Recovery (Alert + Confirm)

These failures require operator awareness but minimal intervention:

| Failure | Alert Trigger | Operator Action |
|---------|--------------|-----------------|
| JetStream storage > 85% | Metrics threshold | Confirm purge or expand storage |
| Entity state corruption | Machine graph rejection | Confirm replay from event journal |
| Trust score anomaly | Statistical deviation | Review and confirm freeze/unfreeze |
| Sustained protocol errors | Error rate threshold | Confirm device firmware update |

### FM.8.3 Manual Recovery (Operator Intervention Required)

These failures require hands-on operator work:

| Failure | Operator Procedure | Estimated Duration |
|---------|--------------------|--------------------|
| Split-brain resolution | Compare fencing tokens, select winner | 15-30 min |
| Data sovereignty violation | Revoke accounts, notify regulators | 1-4 hours |
| Full hub NATS cluster loss | Restore from JetStream snapshot | 30-60 min |
| Database corruption | Restore from backup, replay events | 1-2 hours |
| Edge firmware corruption (no OTA) | Physical device access | Site-dependent |

### FM.8.4 Recovery SLOs by Failure Class

| Failure Class | Detection SLO | Recovery SLO | Data Loss SLO |
|---------------|---------------|--------------|---------------|
| Transient | < 10s | < 60s | Zero (buffered) |
| Persistent (infrastructure) | < 60s | < 15 min | < 60s of data |
| Persistent (device) | < 120s | < 30 min | Device buffer window |
| Byzantine (single org) | < 300s | < 1 hour | Zero (audit trail) |
| Byzantine (cross-org) | < 600s | < 4 hours | Zero (revocation) |
| Cascading | < 30s (first symptom) | < 5 min (bulkhead) | Per upstream failure |

---

## FM.9 Chaos Engineering

### FM.9.1 Recommended Failure Injection Tests

The following chaos engineering tests SHOULD be run against staging
environments. They MUST NOT be run against production without explicit
authorization and a rollback plan.

#### FM.9.1.1 NATS Server Kill/Restart

**Objective**: Validate Raft failover and consumer recovery.

**Procedure**:
1. Identify the current Raft leader: `nats server report jetstream`
2. Kill the leader process (SIGKILL, not SIGTERM -- test unclean shutdown)
3. Observe: new leader elected within 5s
4. Verify: all JetStream consumers reconnect and resume
5. Verify: no message reordering (G-1 maintained)
6. Restart killed server
7. Verify: server rejoins cluster, catches up

**Success criteria**:
- Leader election < 5s
- Zero message loss for acknowledged messages
- Zero reordering on any subject
- All consumers resume within 30s

#### FM.9.1.2 Network Partition Simulation Between Hubs

**Objective**: Validate hub autonomy and eventual reconciliation.

**Procedure**:
1. Select two hubs with active cross-hub subscriptions
2. Inject network partition (iptables, tc netem, or NATS testing framework)
3. Observe: both hubs continue local event delivery
4. Generate events on both sides during partition
5. Remove partition
6. Verify: cross-hub events delivered in order (by `networkTimestamp`)
7. Verify: no duplicate events (G-7 dedup)

**Success criteria**:
- Local event delivery uninterrupted during partition
- Cross-hub events converge within 60s of partition heal
- Zero duplicates after reconciliation

#### FM.9.1.3 Entity Shard Migration Under Load

**Objective**: Validate entity state preservation during rebalancing.

**Procedure**:
1. Generate sustained load: 1000 events/sec across 100 entities
2. Add a new `@effect/cluster` runner node
3. Observe: `HashRing` rebalance migrates subset of entities
4. Verify: no events lost during migration
5. Verify: entity state consistent after migration (compare pre/post)
6. Remove the added runner
7. Verify: entities migrate back, state preserved

**Success criteria**:
- Zero event loss during migration
- Entity state bitwise identical pre/post migration
- Migration completes within 60s
- No G-1 ordering violations

#### FM.9.1.4 Edge Disconnect/Reconnect Cycles

**Objective**: Validate Sparkplug rebirth protocol and pipeline resilience.

**Procedure**:
1. Connect 50 simulated edge devices via SparkplugAdapter
2. Disconnect all devices simultaneously (thundering herd)
3. Wait for `NDEATH` certificates
4. Reconnect all devices within 5s window
5. Verify: all `NBIRTH` processed, alias registries rebuilt
6. Verify: reading pipeline resumes for all devices
7. Verify: SparkplugAdapter `healthRef` reflects correct state

**Success criteria**:
- All 50 devices reconnect within 30s
- Alias registry correctly rebuilt for each device
- No stale aliases from previous connections
- Pipeline throughput returns to baseline within 60s

#### FM.9.1.5 Database Failover

**Objective**: Validate state service resilience during Postgres failover.

**Procedure**:
1. Run sustained entity operations (create, update, read)
2. Trigger Postgres primary failover to replica
3. Observe: connection pool detects failure, reconnects
4. Verify: entity operations resume after brief pause
5. Verify: no state corruption or partial writes

**Success criteria**:
- Failover detected within 10s
- Operations resume within 30s
- Zero state corruption
- All in-flight transactions either committed or rolled back cleanly

#### FM.9.1.6 Cascading Backpressure Test

**Objective**: Validate bulkhead isolation under sustained overload.

**Procedure**:
1. Generate 10x normal reading volume on one org's devices
2. Observe: EventDistribution `maxLag` triggers for that org's channels
   (`event-distribution.ts` line 173: readings `maxLag: 10_000`)
3. Verify: other orgs' channels unaffected
4. Verify: alarm/equipment channels (lower `maxLag: 1_000`) drop excess
   readings before affecting safety-critical event streams
5. Reduce load to normal
6. Verify: all channels recover, metrics return to baseline

**Success criteria**:
- Overloaded org's readings drop as expected (maxLag behavior)
- Other orgs' latency increase < 10%
- Alarm/equipment channels maintain < 1s delivery latency
- Full recovery within 30s of load reduction

---

## FM.10 Codebase Grounding

### FM.10.1 Key Files for Failure Handling

| File | Failure Domain | Error Handling Pattern | Lines of Interest |
|------|---------------|----------------------|-------------------|
| `src/lib/iiot/realtime/event-distribution.ts` | Channel backpressure, subscriber isolation | `maxLag` per channel, broadcast outlet scoping | 169-199 (channels), 267 (metrics), 330-348 (subscribe) |
| `src/lib/iiot/adapters/sparkplug-adapter.ts` | Edge device connectivity | `Effect.retry(defaultRetrySchedule)`, `Stream.catchAll`, reconnection | 383-386 (retry schedule), 461 (retry), 471-484 (catchAll) |
| `src/lib/iiot/adapters/sparkplug-publisher.ts` | Edge publishing failures | `reconnectPeriod: 1000`, keepalive: 65 | 106 (MQTT config) |
| `src/lib/streams/constructs/ChannelService.ts` | Stream backpressure | `maximumLag`, broadcast outlet lifecycle | Channel registration, outlet allocation |
| `src/lib/iiot/entity/_helpers.ts` | Non-blocking event emission | `Effect.catchAll` absorbs failures | 28-42 (WorkOrder), 55-69 (Alarm), 82-95 (Equipment) |
| `src/lib/iiot/entity/EntityStack.ts` | Entity composition, shard management | `Layer.mergeAll` for 12 entity types | 54-67 (EntityHandlersLayer) |
| `src/lib/iiot/realtime/holonet-bridge.ts` | NATS transport, partition tolerance | `Effect.ignoreLogged` for publish failures | 102-128 (outbound) |
| `src/lib/iiot/workflow/AlarmLifecycleWorkflow.ts` | Workflow retry, compensation | `Activity.retry`, `tapError` for observability | 201-236 (error handling pipeline) |
| `src/lib/iiot/services/l1/IIoTPgClient.ts` | Database connectivity | `Effect.catchAll` for graceful degradation | 133-206 (multiple catchAll) |
| `src/lib/iiot/services/l1/TimeSeriesClient.ts` | Time-series query failures | `Effect.catchAll` per query method | 171-476 (8 catchAll handlers) |
| `src/lib/iiot/services/l1/GraphClient.ts` | Graph query failures | `Effect.catchAll` for topology queries | 178, 553 |
| `src/lib/iiot/errors/alarm.ts` | Domain error taxonomy | Tagged error types for `Effect.catchTags` | 94 (exhaustive handling) |
| `src/lib/iiot/errors/work-order.ts` | Domain error taxonomy | Tagged error types for `Effect.catchTags` | 87 (exhaustive handling) |
| `src/lib/iiot/errors/equipment-state.ts` | Domain error taxonomy | Tagged error types for `Effect.catchTags` | 147 (exhaustive handling) |
| `src/lib/iiot/adapters/ingestion.ts` | Ingestion error classification | `retryable` boolean in IngestionError schema | 70 |

### FM.10.2 Error Handling Patterns in the Codebase

The codebase uses three primary error handling patterns:

**Pattern 1: Non-Blocking Emission** (`_helpers.ts`)
```
Effect.catchAll((err) =>
  Effect.logWarning(`Event emission failed (non-blocking): ${String(err)}`)
)
```
Used by: entity event emission helpers. Failures never propagate to parent
operation. Ensures G-7 idempotency -- a failed emission does not cause
redelivery of the parent command.

**Pattern 2: Retry with Exponential Backoff** (`sparkplug-adapter.ts`)
```
Effect.retry(Schedule.compose(
  Schedule.exponential('1 second'),
  Schedule.recurs(10),
))
```
Used by: SparkplugAdapter connection and subscription. Bounded retry prevents
infinite reconnection loops. Exposed on adapter shape for testing introspection.

**Pattern 3: Stream Error Recovery** (`sparkplug-adapter.ts`)
```
Stream.catchAll((err) =>
  Stream.fail(new IngestionError({ ..., retryable: true }))
)
```
Used by: per-group Sparkplug streams after merge. Converts heterogeneous
errors into typed `IngestionError` with `retryable` classification for
upstream decision-making.

---

## References

### Normative

- [RFC2119] -- Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
- [RFC8174] -- Leiba, B. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words."
- [ISA-18.2] -- ANSI/ISA-18.2-2016 (IEC 62682). "Management of Alarm Systems for the Process Industries."
- [FDA-CFR11] -- U.S. FDA, 21 CFR Part 11. "Electronic Records; Electronic Signatures."

### NATS / JetStream

- [JETSTREAM] -- Synadia. "NATS JetStream."
- [NATS-DEDUP-INF] -- Synadia. "Infinite Message Deduplication in JetStream."
- [NATS-ACCOUNTS] -- Synadia. "NATS Account-Based Security."
- [NATS-JWT] -- Synadia. "In-Depth JWT Guide for NATS."
- [NATS-ADAPTIVE-EDGE] -- Synadia. "Synadia Adaptive Edge Architecture."

### Effect-TS

- [EFFECT-CLUSTER] -- Effect Contributors. "@effect/cluster -- Distributed Entity Management."
- [EFFECT-HASHRING] -- Effect Contributors. "effect/HashRing -- Consistent Hashing."

### Patterns

- [REACTIVE-MANIFESTO] -- "The Reactive Manifesto." v2.0, 2014.
- [MSVC-SAGA] -- Richardson, C. "Saga Pattern."
- [SPARKPLUG-B] -- Eclipse Foundation. "Eclipse Sparkplug Specification v3.0.0."

### Internal

- [TMNL-CONSISTENCY] -- "Research: Consistency Models for Metropolitan-Scale IIoT."
- [TMNL-CLUSTER] -- "Research: @effect/cluster Distributed Entity Patterns."

### Companion Sections

- `rfc-section-consistency-guarantees.md` -- Guarantee implementation mapping
- `rfc-section-two-domain-consistency.md` -- Normative ordering guarantees
- `rfc-section-security-trust.md` -- Security, trust, and tenant isolation
- `rfc-section-operational-runbooks.md` -- Operational procedures
