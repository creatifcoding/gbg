# AVA.9 Fusion Tiers & Join Paths

```
Section:       AVA.9 — Fusion Tiers & Join Paths
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          II — Processing (Normative)
Prerequisites: AVA.2 (Signal Schema), AVA.8 (Differential Dataflow Engine)
Feeds:         AVA.10 (Evidence Theory), AVA.13 (Output Pipeline)
```

> This section specifies the three fusion tiers, seven join types, the
> `JoinPathEntryV2` ontology, blocking strategies, confidence scoring
> models, Tier 3 statistical methods, graph analytics, and CEP sequence
> patterns. Every join path is a declarative configuration entry that
> compiles to a differential-dataflow operator pipeline as specified in
> [AVA.8](rfc-section-dd-engine.md). The key words "MUST", "MUST NOT",
> "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED",
> "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
> interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava91-conventions-and-terminology)
2.  [Fusion Tier Classification](#ava92-fusion-tier-classification)
3.  [JoinPathEntryV2 Ontology](#ava93-joinpathentryv2-ontology)
4.  [Seven Join Types](#ava94-seven-join-types)
5.  [Tier 1: Hard-Key Identity Joins](#ava95-tier-1-hard-key-identity-joins)
6.  [Tier 2: Soft-Key Blocking & Correlation](#ava96-tier-2-soft-key-blocking--correlation)
7.  [Tier 3: Derived-Key Statistical Methods](#ava97-tier-3-derived-key-statistical-methods)
8.  [Confidence Scoring Models](#ava98-confidence-scoring-models)
9.  [Graph Analytics](#ava99-graph-analytics)
10. [CEP Sequence Patterns](#ava910-cep-sequence-patterns)
11. [Normative Requirements Summary](#ava911-normative-requirements-summary)
12. [References](#ava912-references)

---

## AVA.9.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.9.1.1 Terminology

| Term | Definition |
|------|-----------|
| **FusionTier** | One of three confidence classifications: Tier 1 (hard key), Tier 2 (soft key), Tier 3 (derived key) (`join_path.rs:53-60`) |
| **JoinType** | One of seven predicate dimensions: Identity, Spatial, Temporal, Spectral, Semantic, Behavioral, Statistical (`join_path.rs:24-39`) |
| **JoinPathEntryV2** | A declarative join path configuration with R1-R8 extension fields (`join_path.rs:209-245`) |
| **Blocking** | Candidate space partitioning that reduces Event x Event cartesian products by 1000-7000x (`blocking.rs:1-8`) |
| **Tier3Method** | One of four statistical correlation methods: Periodicity, CoOccurrence, Community, AnomalyCoincidence (`tier3.rs:25-30`) |
| **OutputType** | Fusion result classification: FusedTrack, CorrelatedPair, AbsenceEvent, SequenceMatch, Enrichment, Flag (`join_path.rs:73-86`) |
| **SequencePattern** | A temporal CEP pattern definition with ordered steps, contiguity rules, and cross-step predicates (`sequence.rs:130-146`) |

---

## AVA.9.2 Fusion Tier Classification

Three tiers classify fusion correlations by confidence semantics and
computational cost:

```rust
// ava-fusion/src/join_path.rs:53-60
pub enum FusionTier {
    Tier1Kinematic,   // Hard keys — shared identifier, C ~ 0.99
    Tier2Attribute,   // Soft keys — proximity predicates, C < 0.99
    Tier3Behavioral,  // Derived keys — statistical patterns, C = variable
}
```

| Tier | Key Type | Confidence | Computational Model | dd Pipeline |
|------|----------|------------|---------------------|-------------|
| **Tier 1** | Deterministic identity (ICAO, MMSI, IP) | ~0.99 fixed | Equijoin on extracted identifier | `join` or `join_core` |
| **Tier 2** | Probabilistic proximity (spatial, temporal, spectral) | 0.0 – 0.99 | Blocking → join → scoring | `flat_map` → `join` → `consolidate` → `inspect` |
| **Tier 3** | Emergent statistical pattern | Variable | Per-method: reduce, iterate, filter | Method-specific (see [AVA.9.7](#ava97-tier-3-derived-key-statistical-methods)) |

Source: `join_path.rs:45-60`

---

## AVA.9.3 JoinPathEntryV2 Ontology

Each join path is a declarative entry telling the dataflow engine which
Collection pair to join, what predicates to evaluate, and how to score
the result.

```rust
// ava-fusion/src/join_path.rs:209-245
pub struct JoinPathEntryV2 {
    pub id: String,
    pub left: JoinPathSide,
    pub right: JoinPathSide,
    pub join_type: JoinType,
    pub tier: FusionTier,
    pub output: OutputType,
    pub enabled: EnabledState,
    pub resolver: Option<String>,
    pub blocking: Option<PairBlocking>,
    pub temporal_window_ms: Option<u64>,
    pub late_arrival_policy: Option<String>,
    pub confidence_model: Option<String>,
    pub tier3_method: Option<String>,
    pub join_mode: Option<JoinMode>,
}
```

### AVA.9.3.1 JoinPathSide

Each side of a join path specifies its signal kind, key extraction path,
and data type:

```rust
// join_path.rs:156-164
pub struct JoinPathSide {
    pub signal_kind: SignalKind,
    pub key_path: String,
    pub data_type: DataType,
}
```

The `data_type` distinguishes event streams (`DataType::Event`) from
reference tables (`DataType::Reference`), enabling `JoinMode::EventTable`
for enrichment lookups (`join_path.rs:112-117`).

### AVA.9.3.2 PairBlocking

Per-dimension blocking flags control which axes are used for candidate
partitioning:

```rust
// join_path.rs:143-147
pub struct PairBlocking {
    pub spatial: bool,
    pub temporal: bool,
    pub spectral: bool,
}
```

### AVA.9.3.3 OutputType

Six output classifications determine how downstream consumers render
and route fusion results:

| Variant | Meaning | Typical Tier |
|---------|---------|--------------|
| `FusedTrack` | Two signals describe the same entity (identity merge) | Tier 1 |
| `CorrelatedPair` | Two signals are related but describe distinct entities | Tier 2, 3 |
| `AbsenceEvent` | Expected signal missing — negative-space detection | Tier 2 |
| `SequenceMatch` | Ordered temporal pattern matched | Tier 3 |
| `Enrichment` | One signal enriches another with context | Tier 1 |
| `Flag` | Identifier discrepancy flagged | Tier 1 |

Source: `join_path.rs:73-86`

---

## AVA.9.4 Seven Join Types

```rust
// ava-fusion/src/join_path.rs:24-39
pub enum JoinType {
    Identity,     // Shared identifier (ICAO hex, MMSI, IP, domain, STIX ID)
    Spatial,      // Geographic proximity (haversine distance)
    Temporal,     // Temporal proximity (time window overlap)
    Spectral,     // RF spectral proximity (frequency band matching)
    Semantic,     // Named entity / IOC overlap (Jaccard coefficient)
    Behavioral,   // Velocity/maneuver pattern similarity (DTW, cosine)
    Statistical,  // Tier 3 statistical correlation
}
```

Each join type maps to a specific differential-dataflow pipeline pattern
as specified in [AVA.8](rfc-section-dd-engine.md) and detailed in the
tier-specific sections below.

---

## AVA.9.5 Tier 1: Hard-Key Identity Joins

### AVA.9.5.1 Algorithm

Direct equijoin on extracted identifier key. Confidence is fixed at 0.99
(identity match). The join key IS the identity — no blocking required.

### AVA.9.5.2 dd Pipeline

```rust
// ava-fusion-runtime/src/dataflow/graph.rs:235-279
// With shared arrangement (ref_count >= 2):
left_arr.join_core(right_arr, |key, left_obs, right_obs| {
    Some((key.clone(), (left_obs.clone(), right_obs.clone())))
})
.inspect(move |&(_, time, diff)| {
    let result = FusionResult {
        confidence: 0.99,
        diff: diff as i64,
        // ...
    };
    let _ = tx.send(result);
})
.probe_with(&mut probe);

// Without shared arrangement (ref_count == 1):
left_collection.join(&right_collection)
    .inspect(/* same pattern */)
    .probe_with(&mut probe);
```

### AVA.9.5.3 Incrementality

O(1) per new observation matching an existing key. Only new matches
involving the delta record are produced.

---

## AVA.9.6 Tier 2: Soft-Key Blocking & Correlation

### AVA.9.6.1 Three-Dimensional Blocking

Blocking partitions the candidate space before evaluating predicates,
reducing Event x Event cartesian products by 1000-7000x in typical
deployments (`ava-fusion/src/blocking.rs:1-8`).

| Dimension | Config Type | Key Generation | dd Operator |
|-----------|------------|----------------|-------------|
| **Spatial** | `SpatialBlockConfig { h3_resolution, k_ring }` | H3 cell index + k-ring neighbors | `flat_map` (1:N) |
| **Temporal** | `TemporalBlockConfig { window_seconds }` | `timestamp / (window_seconds * 1000)` | `map` (1:1) |
| **Spectral** | `SpectralBlockConfig { band_width_mhz }` | `floor(freq_mhz / band_width_mhz)` | `map` (1:1) |
| **Composite** | Cross-product of active dimensions | `"h3_key:t_key:f_key"` | `flat_map` (N from spatial) |

Source: `ava-fusion-runtime/src/dataflow/blocking.rs:196-233`

### AVA.9.6.2 H3 Spatial Blocking

The spatial blocking function uses the `h3o` crate for real geospatial
indexing when WGS84 coordinates are present on the Observation. Falls back
to deterministic hash-based bucketing for observations without spatial
metadata (`blocking.rs:116-144`).

```rust
// blocking.rs:51-65 — H3 cell + k-ring expansion
pub fn spatial_keys_from_coords(
    lat_deg: f64, lon_deg: f64,
    resolution: u8, k_ring: u32,
) -> Vec<String> {
    let cell = lat_lon_to_cell(lat_deg, lon_deg, resolution)?;
    h3_grid_disk(cell, k_ring)
        .into_iter()
        .map(|c| c.to_string())
        .collect()
}
```

Resolution 8 produces cells of approximately 4.6 km edge length.
`k_ring = 1` expands to the base cell plus 6 immediate neighbors (7 cells
total), ensuring boundary-crossing entities land in overlapping blocks
(`blocking.rs:47-48`).

### AVA.9.6.3 Composite Key Cross-Product

When multiple blocking dimensions are enabled on a join path, the
`extract_composite_key` function produces the cross-product of all
dimension keys:

```rust
// blocking.rs:212-233
pub fn extract_composite_key(obs: &Observation, config: &CompositeKeyConfig)
    -> Vec<String>
{
    // spatial_keys: N, temporal_key: 1, spectral_key: 1
    // cross-product: "h3_cell:t_bucket:f_band"
    spatial_keys.into_iter()
        .map(|sk| format!("{}:{}:{}", sk, temporal_key, spectral_key))
        .collect()
}
```

### AVA.9.6.4 Tier 2 dd Pipeline

```rust
// graph.rs:293-343
// Step 1: flat_map each collection to (block_key, Observation)
let left_blocked = left_collection.flat_map(move |(_key, obs)| {
    extract_composite_key(&obs, &config)
        .into_iter()
        .map(move |bk| (bk, obs.clone()))
        .collect::<Vec<_>>()
});

// Step 2: Join on block keys
// Step 3: Consolidate (merge cancelling diffs from flat_map expansion)
let joined = left_blocked.join(&right_blocked).consolidate();

// Step 4: Score and emit
joined.inspect(move |&((_, (ref l, ref r)), time, diff)| {
    let base = tier2_base_score(l, r);
    let confidence = compute_confidence(&model, &[(base, 1.0)]);
    // ... emit FusionResult
});
```

The `consolidate()` after `join` is REQUIRED to merge cancelling diffs
produced by the k-ring expansion — when observations are retracted, the
N block keys each produce a -1 diff that must be consolidated.

### AVA.9.6.5 Confidence Scoring

Tier 2 confidence is computed by a pluggable scoring model selected via
the `confidence_model` field on `JoinPathEntryV2`:

```rust
// graph.rs:72-78
fn compute_confidence(model: &Option<String>, pairs: &[(f64, f64)]) -> f64 {
    match model.as_deref() {
        Some("logOdds") => score_log_odds(pairs),
        Some("dempsterShafer") => score_dempster_shafer(pairs, "standard"),
        _ => score_weighted_average(pairs),
    }
}
```

See [AVA.9.8](#ava98-confidence-scoring-models) for details on each model.

---

## AVA.9.7 Tier 3: Derived-Key Statistical Methods

Four specific methods replace the original TSGC-001 wildcard placeholder.
Each is independently toggleable via the `tier3_method` field on
`JoinPathEntryV2` (`tier3.rs:1-7`).

```rust
// ava-fusion/src/tier3.rs:25-30
pub enum Tier3Method {
    Periodicity,         // 3A: Matching periodic cadence (C2 beaconing)
    CoOccurrence,        // 3B: Entities appearing together across sources
    Community,           // 3C: Graph community detection
    AnomalyCoincidence,  // 3D: Independent anomalies in overlapping windows
}
```

### AVA.9.7.1 Tier 3A: Periodicity Detection

**Config**: `PeriodicityConfig { min_period_ms, max_period_ms, significance_threshold }` (`tier3.rs:43-57`)

**dd Pipeline** (`graph.rs:361-453`):

1. **reduce** per entity: Compute payload_hash variance as a proxy for
   inter-arrival regularity. Low variance implies high periodicity.
2. **Map** to periodicity bucket: `period_score = 1.0 / (1.0 + sqrt(variance / 1e12))`,
   discretized to `bucket = (period_score * 10.0) as u32`.
3. **Re-key** reduce output from `(entity, (bucket, key))` to `(bucket, (entity, key))`.
4. **Join** left and right on periodicity bucket.
5. **Inspect**: Emit `FusionResult` with confidence 0.55 (periodicity match).

**Production path**: The `ava-fusion-runtime/src/signal/periodicity.rs` module
provides FFT-based (`realfft`) and Lomb-Scargle periodogram computation with
prominence-based peak detection (`find_peaks`) for real signal data
(`periodicity.rs:91-156`, `periodicity.rs:171-268`). Cross-spectral similarity
uses cosine similarity of power spectra (`periodicity.rs:342-363`).

### AVA.9.7.2 Tier 3B: Co-Occurrence Mining

**Config**: `CoOccurrenceConfig { window_ms, min_support, min_confidence }` (`tier3.rs:70-84`)

**dd Pipeline** (`graph.rs:462-523`):

1. **Map** each collection to temporal buckets: `bucket = payload_hash / (300 * 1000)` (5-minute windows).
2. **Join** on temporal bucket to find co-occurring pairs.
3. **Re-key** by entity pair: `format!("{}|{}", left_key, right_key)` with canonical ordering.
4. **Reduce** to count co-occurrences per entity pair.
5. **Inspect**: Confidence from count: `C = min(1 - 1/(1 + count * 0.1), 0.95)`.

### AVA.9.7.3 Tier 3C: Community Detection

**Config**: `CommunityConfig { algorithm, resolution, min_community_size }` (`tier3.rs:121-135`)

**Algorithms**: Louvain (default), LabelPropagation, Infomap (`tier3.rs:98-108`)

**dd Pipeline** (`graph.rs:531-617`):

1. **Build edge collection** from equijoin (uses `join_core` with shared arrangements when available).
2. **Initialize labels**: Each node labeled with itself via `flat_map`.
3. **Iterate** (label propagation):
   a. Propagate labels along edges via `join`.
   b. Combine with existing labels via `concat`.
   c. **Reduce**: Pick minimum label per node (input sorted by String ord).
   d. **Consolidate** inside the iterate loop — REQUIRED to prevent infinite
      diff circulation and ensure convergence (`graph.rs:567-577`).
4. **Re-key** by label, reduce to collect community members.
5. **Emit pairs**: For nodes `i < j` within the same community, emit
   `FusionResult` with confidence 0.6.

**Standalone Louvain** (`ava-fusion-runtime/src/graph/louvain.rs:43-174`):

Single-level Louvain community detection via greedy modularity optimization.
Each node starts as its own community; for each node, evaluate modularity
gain from moving to each neighbor's community using the canonical formula:

```
DeltaQ = k_{i,in}/m - Sigma_tot * k_i / (2m^2)
```

Source: Blondel et al. (2008). Achieves 85-92% of full multi-level quality
(`louvain.rs:7-8`). Converges within a configurable maximum number of passes
(`louvain.rs:48`).

### AVA.9.7.4 Tier 3D: Anomaly Coincidence

**Config**: `AnomalyCoincidenceConfig { baseline_window_ms, sigma_threshold }` (`tier3.rs:148-160`)

**dd Pipeline** (`graph.rs:626-731`):

1. **Re-key** by entity key for per-entity reduction.
2. **Reduce**: Compute running statistics (mean, variance, std_dev) from
   payload_hash values. Flag observations with z-score >= 3.0 as anomalies.
3. **Re-key** anomalies by time bucket: `bucket = payload_hash / 60000`.
4. **Join** left and right anomalies on time bucket for coincidence detection.
5. **Inspect**: Emit `FusionResult` with confidence 0.45 (anomaly coincidence base).

### AVA.9.7.5 Tier 3 Fallback

Unrecognized `tier3_method` values and `JoinType::Semantic` fall through to
a simple scored join using the same pipeline as Tier 1 but with confidence
computed via the pluggable scoring model rather than fixed at 0.99
(`graph.rs:739-786`).

### AVA.9.7.6 Tier 3 Promotion

Tier 3 findings MAY be promoted to a higher tier via `Tier3Promotion`:

```rust
// tier3.rs:188-194
pub struct Tier3Promotion {
    pub source_tier: u8,    // Always 3
    pub target_tier: u8,    // Usually 2
    pub confidence_boost: f64,
}
```

---

## AVA.9.8 Confidence Scoring Models

Three combination strategies are implemented in
`ava-fusion-runtime/src/dataflow/scoring.rs`:

### AVA.9.8.1 Weighted Average (Default)

```
C = sum(w_i * s_i) / sum(w_i)
```

Returns 0.0 if weights sum to zero. Clamped to [0.0, 1.0].
Source: `scoring.rs:16-28`

### AVA.9.8.2 Log-Odds

```
C = 1 / (1 + exp(-sum(log(p/(1-p)) * w_i)))
```

Scores clamped to [0.01, 0.99] to avoid infinite log-odds. Better
mathematical properties for extreme values than weighted average.
Source: `scoring.rs:35-47`

### AVA.9.8.3 Dempster-Shafer Evidence Theory

Simplified two-hypothesis model: H (target) and not-H. Three combination
rule variants:

| Rule | Conflict Handling | Source |
|------|-------------------|--------|
| **Standard (Dempster)** | Normalize: `m_12(A) = agree(A) / (1 - K)` | `scoring.rs:86-93` |
| **Yager** | Transfer conflict to ignorance: `m(Theta) += K` | `scoring.rs:95-98` |
| **TBM (Smets)** | Allow empty-set mass (unnormalized) | `scoring.rs:99-104` |

Where `K = sum(m1(B) * m2(C))` for `B intersection C = empty set`.

**Entropy-weighted variant** (Khan & Anwar, Sensors 2019): Sources with high
uncertainty get lower weight via `w = 1 / (1 + H(m))` where `H` is binary
entropy. Returns `(combined_belief, conflict_measure)` and signals NaN when
conflict exceeds a configurable threshold (`scoring.rs:138-240`).

### AVA.9.8.4 Correlation Discount

The `apply_correlation_discount` function prevents double-counting correlated
predicates using a 5x5 correlation matrix (spatial, temporal, spectral,
behavioral, semantic):

```rust
// scoring.rs:256-289
effective_weight[i] *= 1.0 - (correlation[i][j] * weight_j / total_weight)
```

### AVA.9.8.5 Advanced Evidence Functions

| Function | Purpose | Source |
|----------|---------|--------|
| `pcr5_combine` | PCR5 proportional conflict redistribution (NOT associative for n>2) | `scoring.rs:331-375` |
| `murphy_average_bpa` | Average n BPAs for PCR5 n>2 combination | `scoring.rs:388-409` |
| `jousselme_distance` | True metric distance between BPAs (triangle inequality) | `scoring.rs:423-472` |
| `epsilon_prune_bpa` | Remove focal elements below threshold, redistribute mass | `scoring.rs:480-492` |
| `kahan_sum` | Compensated summation for O(1) rounding error in reduce closures | `scoring.rs:302-312` |

---

## AVA.9.9 Graph Analytics

The `ava-fusion-runtime/src/graph/` module provides three graph analytics
algorithms operating on the `UndirectedGraph` representation:

### AVA.9.9.1 Triangle Counting

Triangles indicate strong mutual association — three entities that are all
pairwise correlated form a clique (`triangle.rs:1-8`).

- **Algorithm**: Edge-iterator with set intersection. O(|E|^{3/2}).
- **`count_triangles`**: Total triangle count (`triangle.rs:108-154`).
- **`triangles_per_node`**: Per-node triangle count (`triangle.rs:159-198`).
- **`clustering_coefficient`**: `CC(v) = 2T(v) / (deg(v) * (deg(v) - 1))` (`triangle.rs:204-228`).
- **`average_clustering_coefficient`**: Graph-wide average CC (`triangle.rs:231-238`).

### AVA.9.9.2 PageRank & Personalized PageRank

Computes importance scores via power iteration with damping factor alpha
(`pagerank.rs:1-10`).

```
rank[v] = (1-alpha)/N + alpha * sum_{u->v} rank[u] / outdeg(u)
```

- **`pagerank`**: Uniform teleportation, default alpha=0.85, epsilon=1e-6 (`pagerank.rs:63-128`).
- **`personalized_pagerank`**: Teleport only to seed nodes (`pagerank.rs:137-210`).
- Dangling node handling: distribute rank to all nodes (uniform) or to seeds (personalized).
- Convergence: L1 norm of rank difference < epsilon.

### AVA.9.9.3 Louvain Community Detection

Single-level modularity optimization via greedy local moves (`louvain.rs:43-174`).

```
Q = (1/2m) * sum_ij [A_ij - k_i*k_j/(2m)] * delta(c_i, c_j)
```

- Each node starts as its own community.
- For each node, evaluate modularity gain from moving to each neighbor's community.
- Move to maximum-gain community if gain is positive.
- Repeat until convergence or max passes reached.
- Returns `LouvainResult { communities, modularity, passes, community_count }`.

---

## AVA.9.10 CEP Sequence Patterns

Complex Event Processing patterns detect ordered temporal sequences of
signals across entity lifecycles (R9, `sequence.rs:1-7`).

### AVA.9.10.1 SequencePattern

```rust
// ava-fusion/src/sequence.rs:130-146
pub struct SequencePattern {
    pub id: String,
    pub name: String,
    pub steps: Vec<SequenceStep>,
    pub contiguity: Contiguity,
    pub cross_predicates: Vec<CrossStepPredicate>,
    pub timeout_ms: u64,
    pub enabled: bool,
}
```

### AVA.9.10.2 SequenceStep

Each step matches a signal kind with optional filter predicates and
duration constraints:

```rust
// sequence.rs:66-81
pub struct SequenceStep {
    pub signal_kind: String,
    pub predicate: Option<String>,
    pub min_duration_ms: Option<u64>,
    pub max_duration_ms: Option<u64>,
    pub contiguity: Contiguity,
}
```

### AVA.9.10.3 Contiguity Modes

| Mode | Behavior | Source |
|------|----------|--------|
| `Strict` | No unmatched events between steps; resets on non-match | `sequence.rs:25` |
| `Relaxed` (default) | Unrelated events between steps are ignored | `sequence.rs:27` |
| `NonDeterministic` | Any event order accepted; branching exploration | `sequence.rs:29` |

### AVA.9.10.4 Cross-Step Predicates

Predicates spanning two steps enforce constraints like entity continuity
or spatial proximity across non-adjacent steps:

```rust
// sequence.rs:94-101
pub struct CrossStepPredicate {
    pub from_step: u32,
    pub to_step: u32,
    pub predicate: String,  // e.g., "haversine(step_0.geo, step_2.geo) < 50000"
}
```

### AVA.9.10.5 SequenceMatch Output

```rust
// sequence.rs:159-172
pub struct SequenceMatch {
    pub pattern_id: String,
    pub entity_id: String,
    pub matched_steps: Vec<u32>,
    pub start_ms: u64,
    pub end_ms: u64,
    pub confidence: f64,  // completeness * timeliness * specificity
}
```

### AVA.9.10.6 Canonical Sequences

Pre-built patterns shipped with the system include AIS dark period detection,
C2 beacon chain detection, and maritime transshipment patterns
(`sequence.rs:183-194`).

---

## AVA.9.11 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.9-R1 | Each join path MUST be represented as a `JoinPathEntryV2` with all required fields populated | MUST |
| AVA.9-R2 | Tier 1 joins MUST use equijoin on the extracted identifier key and MUST produce confidence ~0.99 | MUST |
| AVA.9-R3 | Tier 2 joins MUST apply blocking before the equijoin to reduce candidate pairs | MUST |
| AVA.9-R4 | Spatial blocking MUST use H3 cell indexing with configurable resolution and k-ring expansion when WGS84 coordinates are available | MUST |
| AVA.9-R5 | The `consolidate()` operator MUST be applied after Tier 2 blocking joins to merge cancelling diffs from k-ring expansion | MUST |
| AVA.9-R6 | Tier 3 community detection via `iterate` MUST include `consolidate()` inside the loop to ensure convergence | MUST |
| AVA.9-R7 | Each `Tier3Method` MUST map to a distinct differential-dataflow pipeline pattern as specified in AVA.9.7 | MUST |
| AVA.9-R8 | Confidence scoring MUST support at minimum WeightedAverage, LogOdds, and DempsterShafer combination models | MUST |
| AVA.9-R9 | Sequence patterns MUST support Strict, Relaxed, and NonDeterministic contiguity modes and cross-step predicates | MUST |
| AVA.9-R10 | Disabled join paths (`EnabledState::Disabled`) MUST be excluded from the dataflow graph at construction time | MUST |

---

## AVA.9.12 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [McSherry 2013] McSherry, F., "Differential Dataflow", CIDR 2013.
- [Blondel et al. 2008] Blondel, V.D., Guillaume, J.-L., Lambiotte, R., & Lefebvre, E., "Fast unfolding of communities in large networks", J. Stat. Mech., 2008.
- [Khan & Anwar 2019] Khan, N., & Anwar, S., "Modified Dempster-Shafer with entropy-based paradox elimination", Sensors, 2019.
- [Ngo et al. 2014] Ngo, H.Q., Porat, E., Re, C., & Rudra, A., "Worst-Case Optimal Join Algorithms", PODS 2014.
- [h3o] Uber H3 hierarchical geospatial indexing — Rust crate `h3o`
- [realfft] Real-valued FFT via Hermitian symmetry — Rust crate `realfft`
- [find_peaks] Prominence-based peak detection — Rust crate `find_peaks`
- [ava-fusion join_path] `ava-fusion/src/join_path.rs` — JoinType, FusionTier, JoinPathEntryV2
- [ava-fusion tier3] `ava-fusion/src/tier3.rs` — Tier3Method, configs, promotion
- [ava-fusion sequence] `ava-fusion/src/sequence.rs` — SequencePattern, SequenceStep, Contiguity
- [ava-fusion blocking] `ava-fusion/src/blocking.rs` — SpatialBlockConfig, TemporalBlockConfig, SpectralBlockConfig
- [ava-fusion-runtime dataflow] `ava-fusion-runtime/src/dataflow/` — graph.rs, blocking.rs, scoring.rs
- [ava-fusion-runtime graph] `ava-fusion-runtime/src/graph/` — louvain.rs, pagerank.rs, triangle.rs
- [ava-fusion-runtime periodicity] `ava-fusion-runtime/src/signal/periodicity.rs` — FFT, Lomb-Scargle, cross-spectral
- [Research Compendium] `docs/research/differential-dataflow-fusion-integration.md`

---

*End of section AVA.9*
