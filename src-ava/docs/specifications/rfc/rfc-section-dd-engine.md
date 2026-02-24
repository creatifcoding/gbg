# AVA.8 Differential Dataflow Engine

```
Section:       AVA.8 — Differential Dataflow Engine
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          II — Processing (Normative)
Prerequisites: AVA.6 (Actor Model), AVA.7 (Supervision Tree)
Feeds:         AVA.9 (Fusion Tiers & Join Paths), AVA.13 (Output Pipeline)
```

> This section specifies the differential-dataflow integration that provides
> incremental fusion computation. The engine bridges the async actor world
> (GenServer / asupersync) to a synchronous dataflow worker running on a
> dedicated OS thread. The graph is constructed once from `JoinPathEntryV2`
> configurations and receives data dynamically via crossbeam channels. The
> key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
> "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in
> this document are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava81-conventions-and-terminology)
2.  [Architecture Overview](#ava82-architecture-overview)
3.  [Collection Abstraction](#ava83-collection-abstraction)
4.  [Observation Type](#ava84-observation-type)
5.  [Command and Result Protocol](#ava85-command-and-result-protocol)
6.  [Worker Lifecycle](#ava86-worker-lifecycle)
7.  [Worker Step Loop](#ava87-worker-step-loop)
8.  [Channel Bridge Design](#ava88-channel-bridge-design)
9.  [Time Model and Progress Tracking](#ava89-time-model-and-progress-tracking)
10. [Graph Construction](#ava810-graph-construction)
11. [Trace Sharing via Arrangement](#ava811-trace-sharing-via-arrangement)
12. [Late Arrival Policy](#ava812-late-arrival-policy)
13. [Cooperative Cancellation](#ava813-cooperative-cancellation)
14. [Normative Requirements Summary](#ava814-normative-requirements-summary)
15. [References](#ava815-references)

---

## AVA.8.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.8.1.1 Terminology

| Term | Definition |
|------|-----------|
| **Collection** | `Collection<S, D, R>` — the fundamental differential-dataflow abstraction holding `(data, time, diff)` triples |
| **InputSession** | A handle for feeding data into a Collection; NOT Send — must live on the worker thread |
| **Observation** | A keyed, deduplicated record inside the dataflow graph (`ava-fusion-runtime/src/dataflow/mod.rs:79`) |
| **FusionResult** | A delta output from the dataflow graph: `diff = +1` for new match, `diff = -1` for retraction (`mod.rs:101`) |
| **DataflowCommand** | An enum sent from the GenServer to the worker thread (`mod.rs:43`) |
| **ProbeHandle** | A timely dataflow progress tracker that reports when computation for a given time is complete |
| **DataflowWorker** | The lifecycle handle owning command sender, result receiver, and thread join handle (`worker.rs:82`) |
| **Arrangement** | An indexed trace structure produced by `arrange_by_key()`, shareable between multiple join operators |

---

## AVA.8.2 Architecture Overview

The differential dataflow engine bridges two execution domains via crossbeam
channels. The async GenServer world runs on the tokio/asupersync runtime; the
synchronous dataflow worker runs on a dedicated OS thread.

```
GenServer (async)              DataflowWorker (sync OS thread)
  cmd_tx ───────────────────►  cmd_rx → InputSession::insert/remove
  result_rx ◄─────────────── result_tx ← inspect() callback
```

Source: `ava-fusion-runtime/src/dataflow/mod.rs:8-14`

The GenServer sends `DataflowCommand` messages via a bounded crossbeam channel.
The worker thread processes commands, drives computation via `worker.step()`,
and emits `FusionResult` deltas via an unbounded result channel. The dataflow
graph is constructed ONCE from `Vec<JoinPathEntryV2>` at worker startup and
MUST NOT be modified after construction.

---

## AVA.8.3 Collection Abstraction

The differential-dataflow `Collection<S, D, R>` is parameterized by:

- `S: Scope` — the timely dataflow scope (timestamp type `u64`)
- `D: Ord + Clone + 'static` — the data type (MUST implement total ordering)
- `R: Semigroup` — the diff type (`isize` for insert/remove tracking)

Every record is represented as a `(data, time, diff)` triple where `diff = +1`
denotes insertion and `diff = -1` denotes retraction. The `consolidate()`
operator merges identical `(data, time)` pairs by summing their diffs,
eliminating no-ops where an insertion and retraction cancel.

Source: [McSherry 2013], verified via `docs/research/differential-dataflow-fusion-integration.md:14-18`

All operators — `join`, `reduce`, `map`, `flat_map`, `filter`, `iterate`,
`threshold` — are automatically incremental. When a single record changes,
only affected join matches, reduce groups, and downstream operators are
recomputed.

---

## AVA.8.4 Observation Type

The `Observation` struct is the element type (`D`) for all Collections inside
the dataflow graph.

```rust
// ava-fusion-runtime/src/dataflow/mod.rs:79-91
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash,
         serde::Serialize, serde::Deserialize)]
pub struct Observation {
    pub key: String,
    pub source_id: String,
    pub payload_hash: u64,
    pub lat_microdeg: Option<i64>,
    pub lon_microdeg: Option<i64>,
}
```

**Design decisions**:

1. `Ord` is REQUIRED by `Collection<S, D, R>` where `D: Ord`. Coordinates
   are stored as micro-degrees (`i64`, precision ~0.11 m) instead of `f64`
   because `f64` does not implement `Ord` (`mod.rs:76-78`).

2. Full payloads are too large for Collection storage. The `payload_hash`
   field (computed via `DefaultHasher`) provides deduplication and serves
   as a proxy for derived computations (temporal bucketing, anomaly
   statistics) (`mod.rs:74-75`).

3. The `source_id` field tracks provenance — which signal source produced
   this observation. Multiple sources of the same `SignalKind` share one
   InputSession; `source_id` distinguishes them within the Collection.

---

## AVA.8.5 Command and Result Protocol

### AVA.8.5.1 DataflowCommand (GenServer → Worker)

```rust
// ava-fusion-runtime/src/dataflow/mod.rs:43-65
pub enum DataflowCommand {
    Insert {
        source_id: String,
        key: String,
        value: Vec<u8>,
        timestamp_ms: f64,
        lat_deg: Option<f64>,
        lon_deg: Option<f64>,
    },
    Remove { source_id: String, key: String, value: Vec<u8> },
    AdvanceTime(u64),
    Shutdown,
}
```

- **Insert**: Creates an `Observation` (hashing `value`, converting
  `lat_deg`/`lon_deg` to micro-degrees) and inserts into the appropriate
  InputSession. The `source_id` is resolved to a `SignalKind` key via the
  routing table (`worker.rs:35-52`).

- **Remove**: Retracts a previously inserted observation. The same
  `Observation` struct MUST be reconstructed from the same inputs to ensure
  the diff cancellation works correctly.

- **AdvanceTime(n)**: Advances all InputSessions to epoch `n`, flushes
  buffers, and steps the worker until the probe confirms all computation
  for times `< n` is complete (`worker.rs:296-307`).

- **Shutdown**: Terminates the worker loop and exits the timely closure.

### AVA.8.5.2 FusionResult (Worker → GenServer)

```rust
// ava-fusion-runtime/src/dataflow/mod.rs:101-117
pub struct FusionResult {
    pub join_path_id: String,
    pub left_key: String,
    pub right_key: String,
    pub confidence: f64,
    pub output_type: OutputType,
    pub time: u64,
    pub diff: i64,  // +1 = new match, -1 = retracted match
}
```

Results are emitted by `inspect()` callbacks attached to each join path's
terminal operator. Each result is a delta: `diff = +1` for a new match,
`diff = -1` for a retracted match. Downstream consumers MUST handle
retractions to maintain accurate state.

---

## AVA.8.6 Worker Lifecycle

The `DataflowWorker` struct manages the lifecycle of the OS thread:

```rust
// ava-fusion-runtime/src/dataflow/worker.rs:82-88
pub struct DataflowWorker {
    cmd_tx: Sender<DataflowCommand>,
    result_rx: Receiver<FusionResult>,
    thread: Option<thread::JoinHandle<()>>,
    cancel_flag: Arc<AtomicBool>,
}
```

**Construction** (`DataflowWorker::new`, `worker.rs:96-117`):

1. Creates a bounded command channel (capacity 4096).
2. Creates an unbounded result channel.
3. Initializes a shared `AtomicBool` cancel flag.
4. Spawns a dedicated OS thread via `std::thread::spawn`.

The worker uses `std::thread::spawn` rather than `spawn_blocking` because
the timely worker runs an indefinite event loop. `spawn_blocking` is
designed for bounded blocking work; its Future would never resolve until
shutdown (`worker.rs:102-106`).

**Shutdown** (`worker.rs:183-191`):

1. Sends `DataflowCommand::Shutdown` via the command channel.
2. Calls `handle.join()` to wait for the thread to exit.
3. The `Drop` implementation calls `shutdown()` as a safety net.

---

## AVA.8.7 Worker Step Loop

The core worker function `run_worker` (`worker.rs:211-331`) executes inside
`timely::execute_directly`, which runs a single-worker dataflow on the
current thread.

```
loop {
    1. Check cancel_flag (cooperative shutdown)
    2. try_recv() all pending commands
       - Insert → resolve_source() → input.insert((key, obs))
       - Remove → resolve_source() → input.remove((key, obs))
       - AdvanceTime → advance all inputs, flush, step until probe catches up
       - Shutdown → return
    3. worker.step() — drive any pending computation
    4. thread::yield_now() — avoid busy spinning
}
```

Source: `worker.rs:230-331`

**Source routing** (`worker.rs:35-71`): A `HashMap<String, String>` maps
source ID strings to their `SignalKind` graph key. Built at startup from
the join path configurations. Supports exact match, case-insensitive match,
and partial substring match for flexibility.

**Command processing** is non-blocking (`try_recv`). All pending commands
are drained in a tight inner loop before stepping the worker. This batches
multiple insertions before a single `step()`, improving throughput.

---

## AVA.8.8 Channel Bridge Design

### AVA.8.8.1 Command Channel

**Type**: `crossbeam_channel::bounded::<DataflowCommand>(4096)`

Bounded to prevent unbounded memory growth from fast producers. If the buffer
is full, `send()` blocks the GenServer's handler, providing natural
backpressure. The capacity of 4096 accommodates approximately one window's
worth of sensor readings (`worker.rs:97`).

### AVA.8.8.2 Result Channel

**Type**: `crossbeam_channel::unbounded::<FusionResult>()`

Unbounded because results MUST NOT be lost. The GenServer drains results
on each window flush cycle. The `drain_results()` method is non-blocking;
`drain_results_timeout()` spins with short sleeps until results arrive or
a timeout expires, then collects stragglers during a 50 ms settling period
(`worker.rs:132-177`).

---

## AVA.8.9 Time Model and Progress Tracking

The dataflow uses **monotonic epoch windows** — NOT wall-clock time:

```
Window 0: observations with timestamp_ms in [0, 60000)
Window 1: observations with timestamp_ms in [60000, 120000)
...
```

The window index for an observation is computed as:
`obs_window = (timestamp_ms as u64) / 60000` (`worker.rs:250`)

**AdvanceTime(n)** tells the dataflow that no more data will arrive for
windows `< n`. The worker advances all InputSessions to `n`, flushes their
buffers, then steps until `probe.less_than(&current_time)` returns `false`
— confirming all computation for times `< n` is complete (`worker.rs:296-307`).

**ProbeHandle** (`graph.rs:60`): Attached to the terminal operator of each
join path via `.probe_with(&mut probe)`. The single shared probe tracks
progress across all join paths simultaneously.

---

## AVA.8.10 Graph Construction

The `build_dataflow_graph` function (`graph.rs:147-793`) constructs the
entire dataflow graph in two phases:

**Phase 1 — InputSession creation** (`graph.rs:166-182`):

1. Collect all unique `SignalKind` values from enabled join paths.
2. For each kind, create one `InputSession` and convert it to a `Collection`.
3. Multiple join paths reading from the same signal kind SHARE the same
   InputSession. InputSessions are keyed by `SignalKind`, not by source ID.

**Phase 2 — Join path wiring** (`graph.rs:212-790`):

For each enabled `JoinPathEntryV2`, the graph wires the appropriate pipeline
based on `join_type` and `tier`:

| JoinType | Pipeline | Source |
|----------|----------|--------|
| Identity | `left.join(&right)` → `inspect` | `graph.rs:235-279` |
| Spatial/Temporal/Spectral | `flat_map` (blocking) → `join` → `consolidate` → `inspect` | `graph.rs:293-343` |
| Semantic/Behavioral/Statistical | Per-method pipeline (see [AVA.9]) | `graph.rs:351-788` |

The graph is constructed ONCE and MUST NOT be modified after startup. Data
flows dynamically through `InputSession::insert/remove`.

**DataflowHandles** returned to the worker loop:

```rust
// ava-fusion-runtime/src/dataflow/graph.rs:56-61
pub struct DataflowHandles {
    pub inputs: HashMap<String, InputSession<u64, (String, Observation), isize>>,
    pub probe: ProbeHandle<u64>,
}
```

---

## AVA.8.11 Trace Sharing via Arrangement

When a `Collection` is referenced by two or more join paths, it is
pre-arranged via `arrange_by_key()` during Phase 1.5 of graph construction
(`graph.rs:184-209`).

**Algorithm**:

1. Count references per `SignalKind` across all enabled join paths.
2. Collections with `ref_count >= 2` are arranged once.
3. Join paths use `join_core()` on the shared `Arranged` traces instead of
   `join()` which would independently re-arrange the data.

```rust
// graph.rs:240-258 — Tier 1 Identity with shared arrangement
left_arr.join_core(right_arr, |key, left_obs, right_obs| {
    Some((key.clone(), (left_obs.clone(), right_obs.clone())))
})
```

The `TraceAgent` internal reference counting ensures the indexing cost is
paid once. For a signal kind referenced by N join paths, this saves N-1
redundant arrangement operations.

Collections referenced by only one join path fall back to regular `.join()`
which arranges internally (`graph.rs:260-278`).

---

## AVA.8.12 Late Arrival Policy

Observations whose computed window index falls behind the current time
frontier are considered late arrivals.

**Detection** (`worker.rs:249-260`):

```rust
let obs_window = (timestamp_ms as u64) / 60000;
if current_time > 0 && obs_window < current_time {
    late_arrivals_dropped += 1;
    continue;
}
```

Late arrivals are dropped and counted. The counter is logged at shutdown
for operational visibility. The `late_arrival_policy` field on
`JoinPathEntryV2` (`join_path.rs:235`) supports future policy variants
(reprocess, side-channel) but the current implementation enforces drop-only.

---

## AVA.8.13 Cooperative Cancellation

The worker thread supports cooperative cancellation via an `AtomicBool` flag
shared between the `DataflowWorker` handle and the worker thread.

**Mechanism** (`worker.rs:87,99-100,120-122`):

1. `DataflowWorker::request_cancel()` sets the flag via `Ordering::Release`.
2. The worker loop checks the flag at the top of each iteration via
   `Ordering::Acquire` (`worker.rs:232-235`).
3. On detection, the worker logs and returns immediately.

This provides a belt-and-suspenders approach alongside the `Shutdown` command:
the cancel flag works even if the command channel is full or disconnected.

---

## AVA.8.14 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.8-R1 | The dataflow graph MUST be constructed once from `Vec<JoinPathEntryV2>` and MUST NOT be modified after startup | MUST |
| AVA.8-R2 | InputSessions MUST be keyed by `SignalKind`, not by source ID; multiple sources of the same kind MUST share one InputSession | MUST |
| AVA.8-R3 | All types used as `D` in `Collection<S, D, R>` MUST implement `Ord + Clone + 'static` | MUST |
| AVA.8-R4 | The worker MUST run on a dedicated OS thread via `std::thread::spawn`, NOT via `spawn_blocking` | MUST |
| AVA.8-R5 | The command channel MUST be bounded; the result channel SHOULD be unbounded | MUST/SHOULD |
| AVA.8-R6 | `AdvanceTime(n)` MUST advance all InputSessions, flush, and step until the probe confirms completion for times `< n` | MUST |
| AVA.8-R7 | FusionResult consumers MUST handle retraction deltas (`diff = -1`) to maintain accurate state | MUST |
| AVA.8-R8 | Collections referenced by 2+ join paths SHOULD be pre-arranged via `arrange_by_key()` for trace sharing | SHOULD |
| AVA.8-R9 | Late arrivals (observations with window index below the current time frontier) MUST be dropped and counted | MUST |
| AVA.8-R10 | The worker MUST support cooperative cancellation via `AtomicBool` in addition to the `Shutdown` command | MUST |

---

## AVA.8.15 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [McSherry 2013] McSherry, F., "Differential Dataflow", CIDR 2013.
- [Ngo et al. 2014] Ngo, H.Q., Porat, E., Re, C., & Rudra, A., "Worst-Case Optimal Join Algorithms", PODS 2014.
- [differential-dataflow] `TimelyDataflow/differential-dataflow` v0.18.0 — `Collection<S,D,R>`, `InputSession`, `arrange_by_key`, `join_core`
- [timely] `TimelyDataflow/timely-dataflow` v0.25 — `execute_directly`, `ProbeHandle`, `worker.step()`
- [crossbeam-channel] `crossbeam-rs/crossbeam` — bounded/unbounded MPMC channels
- [ava-fusion-runtime dataflow module] `ava-fusion-runtime/src/dataflow/` — `mod.rs`, `worker.rs`, `graph.rs`, `blocking.rs`, `scoring.rs`
- [ava-fusion JoinPathEntryV2] `ava-fusion/src/join_path.rs` — Join path ontology types
- [Research Compendium] `docs/research/differential-dataflow-fusion-integration.md` — Theoretical grounding and operator mapping

---

*End of section AVA.8*
