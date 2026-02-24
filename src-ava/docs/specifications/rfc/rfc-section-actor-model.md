# AVA.6 Actor Model

```
Section:       AVA.6 — Actor Model (asupersync)
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          II — Processing (Normative)
Prerequisites: AVA.1 (Pipeline Architecture), AVA.5 (JetStream Persistence)
Feeds:         AVA.7 (Supervision Tree), AVA.8 (Differential Dataflow Engine)
```

> This section specifies the GenServer actor model used by the ava-fusion pipeline.
> Six actors implement the processing stages, each with typed mailboxes, budget-bounded
> execution, cancel-masked mutations, and structured observability via the `asupersync`
> runtime. The actor model draws from Erlang/OTP GenServer semantics adapted for Rust's
> ownership system. The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
> "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in
> this document are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava61-conventions-and-terminology)
2.  [GenServer Trait Contract](#ava62-genserver-trait-contract)
3.  [Actor Catalog](#ava63-actor-catalog)
4.  [SensorIngestor](#ava64-sensoringestor)
5.  [EntityResolver](#ava65-entityresolver)
6.  [FusionEngine](#ava66-fusionengine)
7.  [TrackManager](#ava67-trackmanager)
8.  [AbsenceDetector](#ava68-absencedetector)
9.  [AlarmEvaluator](#ava69-alarmevaluator)
10. [Inter-Actor Message Flow](#ava610-inter-actor-message-flow)
11. [Normative Requirements Summary](#ava611-normative-requirements-summary)
12. [References](#ava612-references)

---

## AVA.6.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.6.1.1 Terminology

| Term | Definition |
|------|-----------|
| **GenServer** | The `asupersync::gen_server::GenServer` trait — typed mailbox protocol with `handle_call`, `handle_cast`, `handle_info`, `on_start`, `on_stop` |
| **Call** | Synchronous request with a `Reply<T>` obligation token; caller blocks until reply |
| **Cast** | Asynchronous fire-and-forget message; no reply expected |
| **Info** | External signal (NATS message, timer tick, system event) delivered to the actor |
| **Cx** | The `asupersync::cx::Cx` execution context providing `trace()`, `checkpoint()`, `masked()`, `budget()`, `timer_driver()` |
| **Budget** | `asupersync::types::Budget` — poll/cost quota that bounds computation per handler invocation |
| **Obligation** | A `Reply<T>` token that MUST be resolved (sent) before the actor stops; leaked obligations trigger `ObligationLeakOracle` failures in lab mode |
| **Cancel Mask** | `cx.masked(|| { ... })` — defers supervisor-initiated cancellation until the closure returns, ensuring atomic state mutations |
| **Checkpoint** | `cx.checkpoint_with(msg)` — records progress for stuck-task detection and work-stealing scheduler hints |
| **CastOverflowPolicy** | Mailbox overflow strategy: `DropOldest` sheds stale messages under backpressure |

---

## AVA.6.2 GenServer Trait Contract

All six pipeline actors implement the `GenServer` trait defined in
`asupersync::gen_server`. The trait requires four associated types and five
handler methods (`ava-fusion-runtime/src/actors/mod.rs`):

```rust
pub trait GenServer {
    type Call;                // Synchronous request type
    type Reply;               // Synchronous reply type
    type Cast;                // Async fire-and-forget type
    type Info;                // External signal type

    fn handle_call(&mut self, cx: &Cx, request: Self::Call, reply: Reply<Self::Reply>)
        -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
    fn handle_cast(&mut self, cx: &Cx, msg: Self::Cast)
        -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
    fn handle_info(&mut self, cx: &Cx, msg: Self::Info)
        -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
    fn on_start(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
    fn on_stop(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
}
```

### AVA.6.2.1 Budget and Obligation Model

Every handler invocation runs within a `Budget`. Actors MUST check `cx.budget()`
before expensive computation and yield when exhausted. The budget model enforces
cooperative scheduling across the actor pool:

- **`Budget::MINIMAL`** — used for `on_stop_budget()` across all actors; shutdown
  handlers run with minimal allocation to ensure rapid teardown.
- **`Budget::INFINITE`** — used for `on_start_budget()` where initialization
  (e.g., DataflowWorker creation) may be unbounded.

The obligation model applies specifically to `Reply<T>` tokens in `handle_call`:
- A `Reply<T>` token MUST be resolved via `reply.send(value)`.
- Dropping a `Reply<T>` without sending constitutes an **obligation leak**.
- In lab mode, the `ObligationLeakOracle` detects leaked obligations as test failures.

### AVA.6.2.2 Cancel-Masked Mutations

When a handler mutates shared state structures (e.g., `entity_tracks` in
FusionEngine), the mutation MUST be wrapped in `cx.masked(|| { ... })` to
prevent partial updates during supervisor-initiated cancellation
(`ava-fusion-runtime/src/actors/fusion_engine.rs:315-334`):

```rust
cx.masked(|| {
    match event {
        TrackEventKind::Dropped => {
            for tracks in self.entity_tracks.values_mut() {
                tracks.retain(|t| *t != track_id);
            }
        }
        // ...
    }
});
```

### AVA.6.2.3 Checkpoint Observability

Actors SHOULD call `cx.checkpoint_with(msg)` after processing batches to provide
structured diagnostics. The checkpoint message enables:
- Stuck-task detection by the supervisor
- Work-stealing scheduler hints for load balancing
- Audit trails for post-incident analysis

---

## AVA.6.3 Actor Catalog

The six actors are defined in `ava-fusion-runtime/src/actors/mod.rs`:

| Actor | Module | Pattern | Key Trait |
|-------|--------|---------|-----------|
| **SensorIngestor** | `sensor_ingestor.rs` | `handle_info` for NATS messages | `CastOverflowPolicy::DropOldest` backpressure |
| **EntityResolver** | `entity_resolver.rs` | Singleton via `NameRegistry` | `NameLease` obligation for registry entry |
| **FusionEngine** | `fusion_engine.rs` | Supervised tree + DataflowWorker | Region-scoped cancel propagation |
| **TrackManager** | `track_manager.rs` | Stateful GenServer | FSM: Tentative->Confirmed->Coasting->Dropped->Merged |
| **AbsenceDetector** | `absence_detector.rs` | Timer-driven `handle_info(Timeout)` | Budget-bounded detection deadline |
| **AlarmEvaluator** | `alarm_evaluator.rs` | `handle_call` with `Reply<AlarmAck>` | Obligation-tracked alarm lifecycle |

---

## AVA.6.4 SensorIngestor

**Source**: `ava-fusion-runtime/src/actors/sensor_ingestor.rs` (242 lines)

The SensorIngestor is the pipeline's entry point. Each instance handles a single
signal source (one per NATS subject/feed type). Under load, stale readings are
shed rather than buffered indefinitely.

### AVA.6.4.1 Message Types

| Channel | Type | Variants |
|---------|------|----------|
| Call | `IngestorCall` | `GetStats`, `GetSourceId` |
| Reply | `IngestorReply` | `Stats { buffered, total_ingested, total_dropped }`, `SourceId(SignalSourceId)` |
| Cast | `IngestorCast` | `BackpressureOn`, `BackpressureOff` |
| Info | `IngestorInfo` | `NatsMessage { subject, payload, timestamp_ms }`, `System(SystemMsg)` |

### AVA.6.4.2 Backpressure Strategy

The ingestor uses `CastOverflowPolicy::DropOldest` (line 240). When the
internal buffer reaches `max_buffer_size`, the oldest reading is evicted before
the new one is pushed (lines 187-200). This implements a **latest-value-wins**
semantic appropriate for sensor telemetry where recency dominates.

### AVA.6.4.3 State

```rust
pub struct SensorIngestor {
    source_id: SignalSourceId,
    signal_kind: SignalKind,
    buffer: Vec<BufferedReading>,
    max_buffer_size: usize,
    backpressure_active: bool,
    total_ingested: u64,
    total_dropped: u64,
}
```

Downstream consumers call `drain_buffer()` to atomically take all buffered
readings via `std::mem::take`.

---

## AVA.6.5 EntityResolver

**Source**: `ava-fusion-runtime/src/actors/entity_resolver.rs` (391 lines)

The EntityResolver is a **singleton** registered via `NameRegistry` under the
key `"entity-resolver"`. Other actors discover it via `Cx::whereis()`. The
`NameLease` obligation guarantees the registry entry is cleaned up on shutdown.

### AVA.6.5.1 Message Types

| Channel | Type | Key Variants |
|---------|------|-------------|
| Call | `ResolverCall` | `Resolve { source_id, identifier, entity_class }`, `Bind`, `Unbind`, `GetIdentifiers`, `ListEntities` |
| Reply | `ResolverReply` | `Resolved { entity_id, confidence }`, `Unresolved { suggested_entity_id }`, `Bound`, `Unbound`, `NotFound` |
| Cast | `ResolverCast` | `MergeHint { entity_a, entity_b, confidence }`, `InvalidateCache` |

### AVA.6.5.2 Resolution Algorithm

Resolution uses a dual-index structure:
- **Forward index**: `HashMap<EntityId, EntityRecord>` — entity to bindings
- **Reverse index**: `HashMap<(SignalSourceId, String), EntityId>` — fast lookup

A `Resolve` call checks the reverse index first. Direct matches return
confidence `1.0`. When no match exists, a new `EntityId` is generated via a
monotonic sequence counter with format `"{EntityClass}-{seq:06}"` (line 177-183).

### AVA.6.5.3 Singleton Guarantee

The EntityResolver MUST be started via `named_gen_server_start()` in `pipeline.rs`
(line 266). The `NameRegistrationPolicy::Register` with `NameCollisionPolicy::Fail`
ensures exactly one instance runs at any time. Supervised under
`Restart(max 5)` — after 5 crashes in 120s, it stops permanently to prevent
infinite restart loops from poisoning the registry.

---

## AVA.6.6 FusionEngine

**Source**: `ava-fusion-runtime/src/actors/fusion_engine.rs` (473 lines)

The FusionEngine is the computational core. Each instance handles one fusion tier
and delegates computation to a `DataflowWorker` on a dedicated OS thread.

### AVA.6.6.1 Fusion Tiers

| Tier | Name | Join Strategy |
|------|------|--------------|
| Tier 1 | `tier1-hard-key` | Deterministic identity joins (ICAO hex, MMSI, IP) |
| Tier 2 | `tier2-soft-key` | Probabilistic correlation (spatial, temporal, spectral) |
| Tier 3 | `tier3-derived` | Statistical/behavioral pattern detection |

### AVA.6.6.2 Message Types

| Channel | Type | Key Variants |
|---------|------|-------------|
| Call | `FusionCall` | `Correlate { source_a, source_b, ... }`, `GetEntityFusionState`, `ListActiveJoinPaths` |
| Reply | `FusionReply` | `CorrelationResult { confidence, track_id, join_path_id }`, `EntityState`, `ActiveJoinPaths` |
| Cast | `FusionCast` | `IngestReading { source_id, payload, timestamp_ms }`, `TrackEvent { track_id, event }` |
| Info | `FusionInfo` | `WindowFlush { window_id }`, `System(SystemMsg)` |

### AVA.6.6.3 DataflowWorker Integration

Communication with the DataflowWorker uses crossbeam channels:
- `handle_cast(IngestReading)` sends `DataflowCommand::Insert` via `cmd_tx` (line 295)
- `handle_info(WindowFlush)` sends `DataflowCommand::AdvanceTime` and drains results (lines 357-359)
- `on_start()` creates the worker from `join_path_configs` (line 420)
- `on_stop()` requests cooperative cancel then shuts down and joins the thread (lines 444-453)

### AVA.6.6.4 Cancel-Masked State Updates

The `process_results()` method and `TrackEvent` mutations are wrapped in
`cx.masked()` to guarantee `entity_tracks` consistency during supervisor
shutdown (lines 315-334, 381-383). The entity_tracks HashMap maintains
positive diffs (new matches) and removes tracks for negative diffs (retracted matches).

### AVA.6.6.5 Budget-Aware Window Processing

Before processing window results, the engine checks `cx.budget().is_exhausted()`
(line 366). If the budget is exhausted, processing is deferred to avoid starving
other actors in the cooperative scheduler:

```rust
let budget = cx.budget();
if budget.is_exhausted() {
    tracing::warn!("Window flush: budget exhausted, deferring processing");
    return Box::pin(async {});
}
```

---

## AVA.6.7 TrackManager

**Source**: `ava-fusion-runtime/src/actors/track_manager.rs` (399 lines)

The TrackManager maintains the lifecycle state machine for all fused tracks.

### AVA.6.7.1 Track Lifecycle FSM

```text
Tentative --> Confirmed --> Coasting --> Dropped
                 ^             |
                 +-------------+ (recovery)
         any non-terminal --> Merged
```

Transitions are validated via `ava_fusion::is_valid_transition(from, to)` (line 226).
Invalid transitions are rejected with diagnostic information including the current
state and requested state.

### AVA.6.7.2 Message Types

| Channel | Type | Key Variants |
|---------|------|-------------|
| Call | `TrackCall` | `CreateTrack`, `Transition { to_state, reason }`, `GetTrackState`, `ListEntityTracks`, `ActiveTrackCount` |
| Reply | `TrackReply` | `Created`, `Transitioned { transition }`, `TransitionRejected { current, requested }`, `NotFound` |
| Cast | `TrackCast` | `ObservationReceived { track_id, timestamp_ms }`, `PurgeTerminal { older_than_ms }` |
| Info | `TrackInfo` | `CoastCheck { tick_id }`, `System(SystemMsg)` |

### AVA.6.7.3 State Structure

The TrackManager maintains dual indexes:
- **Forward**: `HashMap<TrackId, TrackRecord>` — track state, entity binding, observation count
- **Reverse**: `HashMap<EntityId, Vec<TrackId>>` — entity to tracks

New tracks always start in `Tentative` state (line 203). The `PurgeTerminal` cast
removes all terminal tracks (Dropped/Merged) and cleans up the entity index (lines 319-336).

---

## AVA.6.8 AbsenceDetector

**Source**: `ava-fusion-runtime/src/actors/absence_detector.rs` (402 lines)

Timer-driven actor that monitors expected signal sources and raises absence events
when signals are not received within configured deadlines.

### AVA.6.8.1 Message Types

| Channel | Type | Key Variants |
|---------|------|-------------|
| Call | `AbsenceCall` | `RegisterExpected { source_id, deadline_ms }`, `Unregister`, `GetStatus`, `ListExpectations` |
| Reply | `AbsenceReply` | `Registered`, `Unregistered`, `Status { absent_sources }`, `Expectations` |
| Cast | `AbsenceCast` | `SignalReceived { source_id, timestamp_ms }`, `BulkSignalReceived { signals }` |
| Info | `AbsenceInfo` | `EvaluationTick { tick_id, current_time_ms }`, `System(SystemMsg)` |

### AVA.6.8.2 Evaluation Algorithm

On each `EvaluationTick`, all registered expectations are checked (lines 165-194):
1. Compute silence duration: `current_time_ms - last_seen_ms` (or `current_time_ms` if never seen)
2. If `silence > deadline_ms` and not already absent: transition to absent, emit `AbsentSource`
3. If `silence <= deadline_ms` and currently absent: transition to recovered, increment recovery counter

The evaluation uses virtual time from `cx.timer_driver()` when available (line 344),
falling back to the message's wall-clock timestamp. Virtual time enables
deterministic testing under the `LabRuntime`.

### AVA.6.8.3 Budget-Bounded Detection

Before each evaluation, the detector calls `cx.checkpoint_with()` (lines 330-339).
If the checkpoint fails (supervisor cancelled), the evaluation is aborted:

```rust
if cx.checkpoint_with(format!(
    "tick {} evaluating {} expectations",
    self.total_ticks, self.expectations.len()
)).is_err() {
    return Box::pin(async {});
}
```

---

## AVA.6.9 AlarmEvaluator

**Source**: `ava-fusion-runtime/src/actors/alarm_evaluator.rs` (385 lines)

The AlarmEvaluator manages alarm lifecycle with **obligation-tracked acknowledgments**.
This is the strongest application of asupersync's obligation model in the pipeline.

### AVA.6.9.1 Obligation Protocol

```text
Alarm detected --> Reply<AlarmAck> issued (obligation reserved)
    |
    +-- Operator acknowledges --> reply.send(Ack)      (obligation committed)
    +-- Operator shelves      --> reply.send(Shelved)   (obligation committed)
    +-- Timeout/drop          --> PANIC (obligation leaked = unhandled alarm)
```

This turns "forgotten alarm acknowledgments" from a runtime bug into a structural
guarantee. The `Reply<AlarmAck>` token MUST be resolved; dropping it triggers
`ObligationLeakOracle` in lab mode.

### AVA.6.9.2 Alarm Severity (ISA/IEC 62682)

| Level | Enum | Meaning |
|-------|------|---------|
| Low | `AlarmSeverity::Low` | Informational — no operator action required |
| Medium | `AlarmSeverity::Medium` | Warning — operator should investigate |
| High | `AlarmSeverity::High` | Critical — immediate operator action required |
| Critical | `AlarmSeverity::Critical` | Emergency — safety-critical, auto-escalation |

### AVA.6.9.3 Alarm Conditions

Four condition types trigger evaluation (`ava-fusion-runtime/src/actors/alarm_evaluator.rs:112-121`):

| Condition | Fields | Source |
|-----------|--------|--------|
| `ThresholdExceeded` | `metric`, `value`, `limit` | Sensor readings |
| `RateOfChange` | `metric`, `rate`, `limit` | Computed derivatives |
| `SignalAbsent` | `expected_source` | AbsenceDetector |
| `AnomalyDetected` | `model`, `score` | Statistical models |

### AVA.6.9.4 Shutdown Obligation Audit

On stop, the evaluator audits for unresolved obligations (lines 364-369):

```rust
if !self.active_alarms.is_empty() {
    tracing::error!(
        leaked_count = self.active_alarms.len(),
        "AlarmEvaluator stopped with unresolved alarm obligations!"
    );
}
```

---

## AVA.6.10 Inter-Actor Message Flow

```text
NATS Subscription
    |
    v
SensorIngestor  --[drain_buffer]--> FusionEngine  --[TrackEvent]--> FusionEngine
    |                                    |                              |
    |                                    v                              |
    |                              EntityResolver                       |
    |                              (Resolve/Bind)                       |
    |                                    |                              v
    |                                    v                         TrackManager
    |                              FusionResult                   (CreateTrack,
    |                             (entity_tracks)                  Transition)
    |                                    |                              |
    v                                    v                              v
AbsenceDetector  --[SignalAbsent]--> AlarmEvaluator <--[CoastCheck]-- TrackManager
(EvaluationTick)                    (Evaluate/Ack)
```

### AVA.6.10.1 Data Path

1. **Ingest**: NATS messages arrive as `IngestorInfo::NatsMessage` on SensorIngestor
2. **Buffer**: Readings are buffered; downstream calls `drain_buffer()` to consume
3. **Fusion**: FusionEngine receives readings via `FusionCast::IngestReading`, forwards to DataflowWorker
4. **Resolution**: FusionEngine queries EntityResolver via `ResolverCall::Resolve` for identity binding
5. **Tracking**: Fusion results create/update tracks via `TrackCall::CreateTrack` and `TrackCall::Transition`
6. **Absence**: AbsenceDetector receives `SignalReceived` casts and evaluates deadlines on tick
7. **Alarm**: AlarmEvaluator receives conditions from AbsenceDetector and FusionEngine

### AVA.6.10.2 Control Path

- **BackpressureOn/Off**: Downstream signals SensorIngestor to shed or resume (cast)
- **CoastCheck**: Periodic tick evaluates track coasting timeouts in TrackManager
- **TimeoutCheck**: Periodic tick evaluates alarm timeouts in AlarmEvaluator
- **EvaluationTick**: Periodic tick triggers absence evaluation in AbsenceDetector

---

## AVA.6.11 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.6-R1 | All pipeline actors MUST implement the `GenServer` trait with typed `Call`, `Reply`, `Cast`, `Info` associated types | MUST |
| AVA.6-R2 | `handle_call` handlers MUST resolve the `Reply<T>` obligation token before returning; dropping it constitutes an obligation leak | MUST |
| AVA.6-R3 | Actors MUST use `cx.masked(|| { ... })` for state mutations that span multiple data structure updates to prevent partial state on cancellation | MUST |
| AVA.6-R4 | Actors SHOULD call `cx.checkpoint_with(msg)` after processing batches for stuck-task detection | SHOULD |
| AVA.6-R5 | SensorIngestor MUST use `CastOverflowPolicy::DropOldest` for latest-value-wins backpressure | MUST |
| AVA.6-R6 | EntityResolver MUST be registered as a singleton via `NameRegistry` with `NameCollisionPolicy::Fail` | MUST |
| AVA.6-R7 | FusionEngine MUST check `cx.budget().is_exhausted()` before processing window results and defer if exhausted | MUST |
| AVA.6-R8 | TrackManager MUST validate state transitions via `is_valid_transition(from, to)` and reject invalid transitions | MUST |
| AVA.6-R9 | AbsenceDetector SHOULD use virtual time from `cx.timer_driver()` for deterministic evaluation under LabRuntime | SHOULD |
| AVA.6-R10 | AlarmEvaluator MUST audit for unresolved alarm obligations on shutdown and log leaked obligations at ERROR level | MUST |

---

## AVA.6.12 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [ISA/IEC 62682] "Management of Alarm Systems for the Process Industries", ISA, 2014.
- [AVA.1] [Pipeline Architecture](rfc-section-pipeline-architecture.md)
- [AVA.5] [JetStream Persistence](rfc-section-jetstream-persistence.md)
- [AVA.7] [Supervision Tree](rfc-section-supervision-tree.md)
- [AVA.8] [Differential Dataflow Engine](rfc-section-differential-dataflow.md)
- [asupersync GenServer] `asupersync::gen_server` — typed mailbox protocol
- [ava-fusion-runtime actors] `ava-fusion-runtime/src/actors/mod.rs` — 6 actor modules
- [ava-fusion-runtime pipeline] `ava-fusion-runtime/src/pipeline.rs` — supervision tree wiring

---

*End of section AVA.6*
