# Differential-Dataflow Fusion Integration — Research Compendium

> Research conducted 2026-02-20, session context: FusionEngine + differential-dataflow Phase 2 planning.
> Sources: deepwiki (7 queries), exa (3 searches), ava-fusion source code (6 files).

---

## 1. Library Research (deepwiki-verified)

### 1.1 differential-dataflow v0.18.0

**Source**: `TimelyDataflow/differential-dataflow` via deepwiki

**Core Abstraction**: `Collection<S, D, R>` where:
- `S: Scope` — the timely dataflow scope
- `D: Ord + Clone + 'static` — the data type (MUST implement total ordering)
- `R: Semigroup` — the diff type (typically `isize` for insert/remove tracking)

**Fundamental Representation**: Every record is a `(data, time, diff)` triple:
- `diff = +1` → insertion
- `diff = -1` → retraction
- `consolidate()` merges identical `(data, time)` pairs by summing diffs

**API Surface**:
- `InputSession::new()` — creates an input handle for feeding data into the graph
- `.to_collection(scope)` — converts input into a `Collection`
- `.join(&other)` — binary equijoin producing `(key, (left_val, right_val))`
- `.reduce(|key, input, output|)` — incremental aggregation by key
- `.inspect(|record|)` — side-effect observation of output records
- `.probe_with(&mut probe)` — progress tracking handle
- `.map()`, `.flat_map()`, `.filter()` — standard collection transforms
- `.arrange_by_key()` — indexed trace structure, shareable between joins
- `.iterate(|scope| ...)` — fixed-point iterative computation
- `.consolidate()` — merge diffs for identical records (CRITICAL in iterate loops)
- `.threshold(|key, count| ...)` — filter records by accumulated count

**Dataflow Graph**: FIXED at construction time. Data flows dynamically via `insert()`/`remove()`. You cannot add new join paths after the graph is built.

**InputSession Constraints**: `InputSession` is **NOT Send**. Must be created inside the worker thread. Data must be sent to the worker via `mpsc::channel` or similar.

**Worker Model**: `worker.step()` drives computation synchronously. Single-worker mode (`-w 1` or `timely::execute_directly`) runs on the current thread. `worker.step_or_park(None)` blocks until work is available.

**Progress Tracking**: `ProbeHandle` tracks dataflow progress. `probe.less_than(input.time())` returns `false` when all computation for that time has completed.

**Version Matrix**:
```toml
differential-dataflow = "0.18.0"
timely = "0.25"
```

### 1.2 Incrementality Model (deepwiki-verified)

**Delta Queries**: Every operator in differential-dataflow is automatically incremental. When a single record changes, only the affected join matches, reduce groups, and downstream operators are recomputed.

**Key Operators for Incrementality**:

| Operator | Incremental Behavior |
|----------|---------------------|
| `join` | Only new matches involving the delta record are produced |
| `reduce` | Only affected key groups are recomputed |
| `arrange_by_key` | Maintains indexed trace; sharing between multiple consumers |
| `consolidate` | Merges diffs that cancel out (insert + remove = no-op) |
| `iterate` | Fixed-point via `Variable`/`SemigroupVariable`; must include `consolidate` |
| `threshold` | Filters by accumulated count; `distinct_total` reduces to one occurrence |
| `flat_map` | Emits multiple keyed records per input (for blocking/spatial expansion) |

**MultiwayJoin (WCOJ)**:
- `Plan::multiway_join(sources, equalities, results)` — worst-case optimal join
- Delta queries per relation: when relation R changes, join R's delta with other relations
- Complexity: `O~(|D| + |Q(D)|)` per Ngo et al. (PODS 2014)

### 1.3 asupersync Integration Points (deepwiki-verified)

**Source**: `Dicklesworthstone/asupersync` via deepwiki

**`spawn_blocking`**: Runs a `Send + 'static` closure on a blocking pool thread. Falls back to OS thread if no pool configured. The returned `Future` resolves when the closure returns.

**Why NOT spawn_blocking for the worker**: The dataflow worker runs indefinitely (step() loop). `spawn_blocking`'s Future would never resolve until shutdown. A raw `std::thread::spawn` with stored `JoinHandle` gives clean lifecycle control:
- `on_start()` → `thread::spawn(worker_fn)` → store `JoinHandle`
- `on_stop()` → send `Shutdown` command → `handle.join()`

**GenServer Lifetime Pattern**: `Pin<Box<dyn Future<Output = ()> + Send + '_>>` — the lifetime `'_` is tied to `&mut self`, not `&Cx`. Call `cx.trace()` before `Box::pin(async move { ... })`.

**RuntimeBuilder Configuration**: `RuntimeBuilder::blocking_threads(min, max)` configures the blocking pool size.

---

## 2. Academic Research (exa-verified)

### 2.1 Differential Computation Foundation

**McSherry, F. (CIDR 2013)** — "Differential Dataflow"
- Introduced the `(data, time, diff)` tuple representation
- Demonstrated that all relational operators can be made incremental via differentiation/integration
- Key insight: `consolidation` — summing diffs for identical records eliminates no-ops
- Application to our system: Every fusion update produces ONLY delta outputs. Zero full re-evaluation.

### 2.2 Worst-Case Optimal Joins

**Ngo, H.Q. et al. (PODS 2014)** — "Worst-Case Optimal Join Algorithms"
- Proved that traditional binary joins are suboptimal for cyclic queries
- The Minesweeper/LeapFrog TrieJoin achieves `O~(|D| + |Q(D)|)` — output-sensitive
- Application: Multi-source fusion (3+ sources) in Tier 2/3 benefits from WCOJ over cascaded binary joins
- differential-dataflow implements this via `Plan::multiway_join` with delta queries per relation

**Ngo, H.Q. (SIGMOD Record 2018)** — "Worst-Case Optimal Join Algorithms: Techniques, Results, and Open Problems"
- Survey of WCOJ landscape post-2014
- Covers extensions to inequality joins and beyond
- Confirms leapfrog trie join as the practical champion

### 2.3 Dempster-Shafer Evidence Combination

**Khan, N. & Anwar, S. (Sensors 2019)** — "Modified Dempster-Shafer with entropy-based paradox elimination"
- Problem: Standard DS combination produces counterintuitive results under high conflict (Zadeh's paradox)
- Solution: Compute evidence entropy `H(m) = -Σ m(A)·log₂(m(A))` for each source
- Weight by inverse entropy: `w_i = 1 / (1 + H(m_i))`
- Discount conflicting evidence before combination
- Result: Eliminates paradoxical conclusions while preserving combination benefits
- Application: Maps to a `map` operator before the `reduce` in our dataflow:
  ```rust
  .map(|(entity, evidence)| {
      let entropy = evidence.entropy();
      let weight = 1.0 / (1.0 + entropy);
      (entity, evidence.weighted(weight))
  })
  ```

**Xiao, F. & Qin, Z. (Sensors 2018)** — "Weighted DS combination using cosine similarity of BPAs"
- Uses cosine similarity between Basic Probability Assignments (BPAs) to assign weights
- Sources with BPAs similar to the majority get higher weights
- Application: Incremental re-weighting when source credibility changes — single-source update triggers re-weighting only for that source's entity

**Combination Rule Variants**:

| Rule | Formula | Conflict Handling |
|------|---------|-------------------|
| **Standard (Dempster)** | `m₁₂(A) = Σ_{B∩C=A} m₁(B)·m₂(C) / (1 - K)` | Normalize away conflict |
| **Yager** | `m₁₂(A) = Σ_{B∩C=A} m₁(B)·m₂(C); m₁₂(Θ) += K` | Transfer to unknown |
| **TBM (Smets)** | `m₁₂(A) = Σ_{B∩C=A} m₁(B)·m₂(C); m₁₂(∅) = K` | Allow empty set mass |

Where `K = Σ_{B∩C=∅} m₁(B)·m₂(C)` is the conflict measure.

**Incremental DS in differential-dataflow**:
1. Retract old evidence: `input.remove((entity, old_bpa))` → diff = -1
2. Insert new evidence: `input.insert((entity, new_bpa))` → diff = +1
3. `reduce` recomputes DS combination ONLY for that entity
4. Only changed outputs propagate downstream (consolidation eliminates no-ops)

### 2.4 Multi-Level Fusion Taxonomy

**Jiang, B. et al. (Sensors 2009)** — "A Multi-Level Fusion Approach for Remote Sensing"
- Three fusion levels: pixel-level, feature-level, decision-level
- Our architecture operates at **decision-level fusion**: each sensor produces semantic outputs (entity identifiers, tracks, states), and the fusion engine correlates these decisions
- Validates our tiered approach: Tier 1 (identity decisions), Tier 2 (correlation decisions), Tier 3 (pattern decisions)

---

## 3. Type System Requirements

### 3.1 Missing Derives for differential-dataflow Compatibility

`Collection<S, D, R>` requires `D: Ord + Clone + 'static`. The following ava-fusion types participate in Collections but lack `Ord, PartialOrd`:

**`ava-fusion/src/ids.rs`** — `branded_id!` macro (line ~26):
```rust
// Current:
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
// Required:
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
```
Affects: `EntityId`, `TrackId`, `JoinPathId`, `SignalSourceId`, `SequencePatternId`, `RiskProfileId`, `FusionObligationId`

**`ava-fusion/src/signal.rs`** — `SignalKind` enum (line ~18):
```rust
// Current:
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
// Required:
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
```

**`ava-fusion/src/join_path.rs`** — `JoinType`, `FusionTier`, `OutputType`:
```rust
// Same pattern — add PartialOrd, Ord to each derive
```

### 3.2 Types That DO NOT Need Ord

Complex aggregate types (`JoinPathEntryV2`, `SpatialBlockConfig`, etc.) do NOT need `Ord` — they serve as configuration, not collection data. Only types that appear as `D` in a `Collection<S, D, R>` need the derive.

---

## 4. Architecture: GenServer ↔ Dataflow Worker Bridge

### 4.1 Threading Model

```
┌─────────────────────────────────────┐     ┌────────────────────────────────────┐
│  async (GenServer / asupersync)     │     │  sync (OS thread)                  │
│                                     │     │                                    │
│  FusionEngine                       │     │  DataflowWorker                    │
│    ├─ cmd_tx: Sender<Command>  ─────┼────►│    ├─ cmd_rx: Receiver<Command>    │
│    ├─ result_rx: Receiver<Result> ◄─┼─────│    ├─ result_tx: Sender<Result>    │
│    └─ thread: JoinHandle<()>        │     │    ├─ inputs: HashMap<InputSession> │
│                                     │     │    ├─ probe: ProbeHandle            │
│  Lifecycle:                         │     │    └─ graph: (fixed at startup)     │
│    on_start() → thread::spawn       │     │                                    │
│    on_stop()  → cmd.Shutdown + join  │     │  Loop:                             │
│                                     │     │    try_recv() → process commands    │
│  Data flow:                         │     │    worker.step()                    │
│    handle_cast → cmd_tx.send()      │     │    inspect() → result_tx.send()    │
│    handle_info → result_rx.drain()  │     │                                    │
└─────────────────────────────────────┘     └────────────────────────────────────┘
```

### 4.2 Channel Design

**Command channel** (`crossbeam_channel::bounded`):
- Bounded to prevent unbounded memory growth from fast producers
- Backpressure: if buffer full, `send()` blocks the GenServer's handler
- Size: configurable, default 4096 (one window's worth of readings)

**Result channel** (`crossbeam_channel::unbounded`):
- Unbounded: results must not be lost; the GenServer drains on each WindowFlush
- Alternative: bounded with overflow → log warning

### 4.3 Dataflow Graph Construction

The graph is built ONCE from `Vec<JoinPathEntryV2>` at worker startup:

```
For each enabled join path:
  1. Get/create InputSession for left.signal_kind
  2. Get/create InputSession for right.signal_kind
  3. Apply key extraction (identity, spatial, temporal, spectral)
  4. left_keyed.join(&right_keyed)
  5. Apply scoring (confidence model from config)
  6. joined.inspect(|record| result_tx.send(to_fusion_result(record)))
```

InputSessions are keyed by `SignalKind` (not source ID), because multiple sources of the same kind share the same collection. The `source_id` is included in the `Observation` struct for provenance.

### 4.4 Time Model

**Monotonic epoch windows** — NOT wall-clock:
```
Window 0: [0ms, 60000ms)     ← advance_to(1) closes window 0
Window 1: [60000ms, 120000ms) ← advance_to(2) closes window 1
...
```

- `advance_to(n)` tells the dataflow that no more data will arrive for windows < n
- ProbeHandle tracks progress: `probe.less_than(input.time())` → false when caught up
- Late arrivals: controlled by `LateArrivalPolicy`:
  - `Drop` — ignore late data (default)
  - `Reprocess` — re-open window (requires careful time management)
  - `SideChannel` — emit to separate output for manual handling

---

## 5. Per-Tier Algorithm Mapping

### 5.1 Tier 1: Hard Key (Deterministic Identity)

**Algorithm**: Exact-match equijoin on identifier (ICAO hex, MMSI, IP address)
**dd Operator**: `left.join(&right)` on extracted key
**Incrementality**: O(1) per new observation matching an existing key
**Confidence**: 0.99 fixed (identity match), degraded by `SpoofingDiscount`
**Blocking**: None — join key IS the identity

```rust
let left_keyed = left_input.to_collection(scope)
    .map(|obs| (extract_key(&obs, &left_key_path), obs));
let right_keyed = right_input.to_collection(scope)
    .map(|obs| (extract_key(&obs, &right_key_path), obs));

left_keyed.join(&right_keyed)
    .map(|(key, (l, r))| score_tier1(key, l, r))
    .inspect(|result| result_tx.send(result.clone()));
```

### 5.2 Tier 2: Soft Key (Probabilistic Correlation)

**Algorithm**: Spatial/temporal/spectral blocking → candidate join → confidence reduce
**dd Operators**: `flat_map` (blocking) → `join` → `reduce` (scoring)
**Blocking**: H3 cell index + k_ring neighbors (spatial), time buckets (temporal), freq bands (spectral)
**Incrementality**: Only affected blocks re-evaluated on new data

**Blocking Strategy** (maps `SpatialBlockConfig` + `TemporalBlockConfig` → `flat_map`):

| Config Type | Block Key Generation | dd Operator |
|-------------|---------------------|-------------|
| `SpatialBlockConfig { h3_res, k_ring }` | `h3_index(lat, lon, h3_res)` + `h3_k_ring(cell, k_ring)` | `flat_map` (1:N) |
| `TemporalBlockConfig { window_seconds }` | `timestamp_ms / (window_seconds * 1000)` | `map` (1:1) |
| `SpectralBlockConfig { band_width_mhz }` | `floor(freq_mhz / band_width_mhz)` | `map` (1:1) |
| Composite | `format!("{}:{}:{}", h3, time, freq)` | `flat_map` (cross-product) |

Reduction factor: ~1000-7000x for resolution 8 H3 cells (4.6 km²) + 60s windows.

**Confidence Scoring** (maps `ConfidenceModel` + `PredicateWeights` → `reduce`):

| Model | Formula | dd Pattern |
|-------|---------|------------|
| `WeightedAverage` | `Σ(w_i × score_i) / Σ(w_i)` | `reduce` with weighted sum |
| `LogOdds` | `1/(1+exp(-Σ log(p/(1-p))))` | `reduce` with log-odds accumulation |
| `DempsterShafer` | DS combination rule (see §2.3) | `reduce` with DS closure |

**Trace Sharing** via `arrange_by_key`:
```rust
// Single arrangement, shared by multiple join paths
let adsb_arranged = adsb_collection
    .map(|obs| (extract_key(&obs, &key_path), obs))
    .arrange_by_key();

// Join path 1: ADS-B × AIS
adsb_arranged.join_core(&ais_arranged, |k, l, r| { ... });
// Join path 2: ADS-B × Radar
adsb_arranged.join_core(&radar_arranged, |k, l, r| { ... });
// Indexing cost paid ONCE
```

### 5.3 Tier 3: Derived Key (Statistical Patterns)

Each `Tier3Method` maps to a distinct differential-dataflow pattern:

**3A: Periodicity Detection**
- Algorithm: FFT on inter-arrival times → cross-spectral comparison
- dd Pattern: `reduce` (periodogram) → `join` (cross-correlation)
- Config: `PeriodicityConfig { min_period_ms, max_period_ms, significance_threshold }`

**3B: Co-Occurrence Mining**
- Algorithm: Association rules (support, confidence, lift thresholds)
- dd Pattern: `join` on temporal buckets → `reduce` for counts → `threshold` for significance
- Config: `CoOccurrenceConfig { window_ms, min_support, min_confidence }`

**3C: Community Detection**
- Algorithm: Label propagation via `iterate` (converges to community labels)
- dd Pattern: `iterate` over entity-edge graph → `reduce` (majority vote) → `consolidate`
- CRITICAL: `consolidate()` inside iterate loop prevents infinite diff circulation
- Config: `CommunityConfig { algorithm, resolution, min_community_size }`
- Algorithms: `LabelPropagation` (iterate + majority vote), `Louvain` (iterate + modularity)

**3D: Anomaly Coincidence**
- Algorithm: Z-score baseline deviation → join anomaly events across sources
- dd Pattern: `reduce` (running stats) → `filter` (sigma threshold) → `join` (coincidence)
- Config: `AnomalyCoincidenceConfig { baseline_window_ms, sigma_threshold }`

---

## 6. Complete Operator Mapping

| ava-fusion Type | dd Operator | Purpose |
|-----------------|-------------|---------|
| `JoinPathEntryV2` | Graph construction | One join path = one binary `join` in the graph |
| `JoinType::Identity` | `join` on extracted identifier | Tier 1 exact match |
| `JoinType::Spatial` | `flat_map` (H3 blocking) → `join` | Tier 2 proximity |
| `JoinType::Temporal` | `map` (time bucket) → `join` | Tier 2 temporal |
| `JoinType::Spectral` | `map` (freq bucket) → `join` | Tier 2 RF proximity |
| `JoinType::Behavioral` | `reduce` + `iterate` | Tier 3 pattern |
| `JoinType::Statistical` | `iterate` + `reduce` | Tier 3 convergence |
| `ConfidenceModel::WeightedAverage` | `reduce` with weighted sum | Scoring |
| `ConfidenceModel::LogOdds` | `reduce` with log-odds accumulation | Scoring |
| `ConfidenceModel::DempsterShafer` | `reduce` with DS combination rule | Evidence fusion |
| `SpatialBlockConfig` | `flat_map` → H3 cell + k_ring | Candidate reduction |
| `TemporalBlockConfig` | `map` → time bucket | Candidate reduction |
| `SpectralBlockConfig` | `map` → frequency bucket | Candidate reduction |
| `DsCombinationRule::Standard` | `reduce` with normalization | Evidence combination |
| `DsCombinationRule::Yager` | `reduce` with ignorance transfer | Conflict-tolerant combination |
| `DsCombinationRule::Tbm` | `reduce` unnormalized | Belief-function combination |
| `Tier3Method::Periodicity` | `reduce` (FFT) + `join` (cross-spectral) | Pattern 3A |
| `Tier3Method::CoOccurrence` | `join` (temporal) + `reduce` + `threshold` | Pattern 3B |
| `Tier3Method::Community` | `iterate` (label propagation) + `consolidate` | Pattern 3C |
| `Tier3Method::AnomalyCoincidence` | `reduce` (stats) + `filter` + `join` | Pattern 3D |
| `CommunityAlgorithm::LabelPropagation` | `iterate` + `reduce` (majority vote) | Community 3C |
| `CommunityAlgorithm::Louvain` | `iterate` + `reduce` (modularity optimization) | Community 3C |
| `CorrelationMatrix` | Post-`reduce` discount | Avoids double-counting correlated predicates |
| `PredicateWeights` | Coefficients inside `reduce` closure | Spatial=0.35, temporal=0.25, spectral=0.20, behavioral=0.15, semantic=0.05 |

---

## 7. Key Implementation Types

### 7.1 DataflowCommand (GenServer → Worker)

```rust
#[derive(Debug, Clone)]
pub enum DataflowCommand {
    Insert { source_id: String, key: String, value: Vec<u8>, timestamp_ms: f64 },
    Remove { source_id: String, key: String, value: Vec<u8> },
    AdvanceTime(u64),
    Shutdown,
}
```

### 7.2 FusionResult (Worker → GenServer)

```rust
#[derive(Debug, Clone)]
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

### 7.3 Observation (internal to worker thread)

```rust
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Observation {
    pub key: String,
    pub source_id: String,
    pub payload_hash: u64,  // Full payload too large for Collection
}
```

### 7.4 DataflowWorker (lifecycle handle)

```rust
pub struct DataflowWorker {
    cmd_tx: crossbeam_channel::Sender<DataflowCommand>,
    result_rx: crossbeam_channel::Receiver<FusionResult>,
    thread: Option<std::thread::JoinHandle<()>>,
}
```

---

## 8. Dataflow Module Structure

```
src/dataflow/
  mod.rs            — Public API: DataflowCommand, FusionResult, DataflowWorker
  worker.rs         — run_worker(), worker.step() loop, channel bridging
  graph.rs          — build_dataflow_graph() from Vec<JoinPathEntryV2>
  blocking.rs       — Key extraction: H3 spatial, temporal buckets, spectral bands
  scoring.rs        — Confidence reduce closures: WeightedAverage, LogOdds, DempsterShafer
```

Estimated: ~600-800 lines across 5 files.

---

## 9. References

1. McSherry, F. (2013). "Differential Dataflow." CIDR.
2. Ngo, H.Q., Porat, E., Ré, C., & Rudra, A. (2014). "Worst-Case Optimal Join Algorithms." PODS.
3. Ngo, H.Q. (2018). "Worst-Case Optimal Join Algorithms: Techniques, Results, and Open Problems." SIGMOD Record 47(3).
4. Khan, N., & Anwar, S. (2019). "Modified Dempster-Shafer with entropy-based paradox elimination." Sensors.
5. Xiao, F., & Qin, Z. (2018). "Weighted Dempster-Shafer combination using cosine similarity of BPAs." Sensors.
6. Jiang, B., et al. (2009). "A Multi-Level Fusion Approach for Remote Sensing." Sensors.
7. differential-dataflow repository: `TimelyDataflow/differential-dataflow` (v0.18.0)
8. asupersync repository: `Dicklesworthstone/asupersync` (v0.2.5)
