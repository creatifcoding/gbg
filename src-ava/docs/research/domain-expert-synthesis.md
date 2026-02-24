# Domain Expert Research Synthesis — ava-fusion Extension Plan

> Research council: 6 oracle agents, 11 sub-tasks, 2026-02-20.
> Extends: `differential-dataflow-fusion-integration.md` (base research).
> Target: Custom Rust implementations within ava-fusion / ava-fusion-runtime.

---

## Table of Contents

1. [Cross-Domain Priority Matrix](#1-cross-domain-priority-matrix)
2. [Signal Processing](#2-signal-processing)
3. [Evidence Theory](#3-evidence-theory)
4. [Graph Algorithms](#4-graph-algorithms)
5. [Tracking & State Estimation](#5-tracking--state-estimation)
6. [Complex Event Processing](#6-complex-event-processing)
7. [Risk Modeling](#7-risk-modeling)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Crate Dependencies](#9-crate-dependencies)
10. [References](#10-references)

---

## 1. Cross-Domain Priority Matrix

### Priority Criteria

| Criterion | Weight | Meaning |
|-----------|--------|---------|
| Impact | 40% | How much new capability does this unlock? |
| Complexity | 30% | Implementation effort (inverse) |
| dd-nativity | 20% | How well does it fit differential-dataflow's model? |
| Dependency | 10% | Does other work block on this? |

### Master Priority Table

| # | Item | Domain | Priority | Effort | dd Fit | Blocks |
|---|------|--------|----------|--------|--------|--------|
| 1 | **PCR5 combination rule** | Evidence | P0-CRITICAL | M | Native reduce | DS scoring |
| 2 | **Leaky NoisyOr risk** | Risk | P0-CRITICAL | S | Native reduce | Risk accumulation |
| 3 | **EKF (CV/CT/CTRV)** | Tracking | P0-CRITICAL | L | External (nalgebra) | Coast prediction |
| 4 | **NFA-SASE CEP engine** | CEP | P0-CRITICAL | L | Hybrid (frontier-sealed) | Sequence detection |
| 5 | **Welford's online stats** | Signal | P1-HIGH | S | Native reduce | Anomaly detection |
| 6 | **CUSUM change-point** | Risk | P1-HIGH | S | Native map | Risk trend |
| 7 | **Triangle counting** | Graph | P1-HIGH | M | dogsdogsdogs WCOJ | Community detection |
| 8 | **Pignistic transform** | Evidence | P1-HIGH | S | Native map | Decision output |
| 9 | **IMM filter** | Tracking | P1-HIGH | L | External (nalgebra) | Maneuvering targets |
| 10 | **Alert fatigue suppression** | Risk | P1-HIGH | S | External (actor state) | Operator UX |
| 11 | **Jousselme distance** | Evidence | P2-MEDIUM | S | Native join | Source weighting |
| 12 | **PersonalizedPageRank** | Graph | P2-MEDIUM | M | Native iterate | Entity importance |
| 13 | **SPRT track confirmation** | Tracking | P2-MEDIUM | S | External (actor state) | Track lifecycle |
| 14 | **Covariance Intersection** | Tracking | P2-MEDIUM | M | Native reduce | Track-to-track fusion |
| 15 | **Spectral blocking (real H3)** | Signal | P2-MEDIUM | M | Native flat_map | Tier 2 accuracy |
| 16 | **Bel/Pl intervals** | Evidence | P1-HIGH | S | Native map | Uncertainty output |
| 17 | **OrderedFloat wrapper** | Signal | P1-HIGH | S | dd-critical | All dd closures |
| 18 | **Single-level Louvain** | Graph | P3-LOW | L | Native iterate | Community labels |
| 19 | **6-node Bayesian net** | Risk | P3-LOW | M | External (stack) | Risk causal model |
| 20 | **Lomb-Scargle periodicity** | Signal | P3-LOW | M | External + reduce | Tier 3 pattern |
| 21 | **Convergence bonus** | Risk | P3-LOW | S | Native map | Multi-category reward |
| 22 | **MHT (multi-hypothesis)** | Tracking | P4-DEFER | XL | Black-box operator | Research-grade |
| 23 | **Temporal community detection** | Graph | P4-DEFER | L | Native iterate | Research-grade |

**Effort key**: S = <200 LOC, M = 200-600 LOC, L = 600+ LOC, XL = 1000+ LOC.

---

## 2. Signal Processing

### 2.1 Welford's Online Algorithm (P1)

**Problem**: Computing running mean/variance for anomaly detection without storing all observations.

**Algorithm** (Welford 1962):
```rust
struct WelfordState {
    count: u64,
    mean: f64,
    m2: f64,  // sum of squared deviations
}

impl WelfordState {
    fn update(&mut self, x: f64) {
        self.count += 1;
        let delta = x - self.mean;
        self.mean += delta / self.count as f64;
        let delta2 = x - self.mean;
        self.m2 += delta * delta2;
    }

    fn variance(&self) -> f64 {
        if self.count < 2 { return 0.0; }
        self.m2 / (self.count - 1) as f64
    }

    fn std_dev(&self) -> f64 { self.variance().sqrt() }
}
```

**dd integration**: Inside `reduce` closure for `AnomalyCoincidence`. Each entity accumulates a `WelfordState`. The `reduce` output is `(mean, std_dev, count)`, downstream `filter` flags Z-score exceedances.

**Numerical stability**: Welford's is inherently stable (avoids catastrophic cancellation). For EWMA variant, use `ewma_new = alpha * x + (1 - alpha) * ewma_old` with alpha = 2/(span+1).

### 2.2 H3 Geospatial Indexing (P2)

**Crate**: `h3o` (pure Rust, MIT, maintained)

**API**:
```rust
use h3o::{CellIndex, LatLng, Resolution};

let ll = LatLng::new(51.5074, -0.1278)?;       // London
let cell = ll.to_cell(Resolution::Eight);        // 4.6 km² hexagon
let ring = cell.grid_disk::<Vec<_>>(1);          // base + 6 neighbors
// ring.len() == 7
```

**Replaces**: The current `hash_to_bucket` placeholder in `blocking.rs`. Real H3 gives true spatial locality — adjacent coordinates map to adjacent cells.

**Resolution guide** (maritime/aviation):

| Resolution | Hex area | Use case |
|------------|----------|----------|
| 5 | 252 km² | Wide-area surveillance |
| 7 | 5.16 km² | Coastal monitoring |
| 8 | 0.737 km² | Port/channel surveillance |
| 10 | 0.015 km² | Close-quarters |

**k_ring expansion**: Resolution 8, k=1 → 7 cells covering ~5.2 km². k=2 → 19 cells covering ~14.7 km². Use k_ring to catch entities near cell boundaries.

### 2.3 Lomb-Scargle Periodicity Detection (P3)

**Critical insight**: Sensor inter-arrival times are **irregularly sampled** — sensors report asynchronously. Standard FFT (Welch's method) requires uniform sampling. Resampling introduces spectral artifacts. **Lomb-Scargle** is purpose-built for irregular data.

**Algorithm** (normalized Lomb-Scargle):
```
P(ω) = (1/2σ²) · { [Σ (yₖ-ȳ)cos(ω(tₖ-τ))]² / Σ cos²(ω(tₖ-τ))
                   + [Σ (yₖ-ȳ)sin(ω(tₖ-τ))]² / Σ sin²(ω(tₖ-τ)) }

tan(2ωτ) = Σ sin(2ωtₖ) / Σ cos(2ωtₖ)     (orthogonalization)
```

**Peak significance**: Use bootstrap FAP (shuffle times, recompute, count exceedances). FAP < 0.01 for standard, < 0.001 for high-confidence. Do NOT use naive mean+3σ threshold.

**Cross-spectral correlation**: Coherence γ²(ω) = |C_xy(ω)|² / (P_x(ω)·P_y(ω)). Coherence > 0.7 at shared frequency = correlated periodicity.

**Complexity**: O(N·M) naive for N observations, M frequency bins. Custom implementation ~200 lines. No mature Rust crate exists.

**dd integration**: `reduce` by entity key accumulates inter-arrival times, computes Lomb-Scargle periodogram. Cross-spectral similarity between entity pairs via `join`. The `reduce` re-fires only when new arrivals change the entity's time series.

### 2.4 Seasonal EWMA for Non-Stationary Signals

For daily patterns in maritime traffic, use a seasonal ring buffer:

```rust
/// 24-bin seasonal EWMA — one bin per hour-of-day.
/// Each bin tracks its own baseline independently.
struct SeasonalEwma {
    bins: [EwmaBin; 24],
    alpha: f64,  // 0.02 for daily patterns
}
```

Z-scores are computed relative to the hour-of-day baseline, not the global mean. This naturally handles diurnal traffic patterns without STL decomposition.

### 2.4 Spectral Blocking for RF (P2)

**Current placeholder**: `extract_spectral_key` uses `payload_hash % 30000` as frequency proxy.

**Real implementation**: Extract center frequency from SDR observation metadata, bucket by band width:
```rust
fn extract_spectral_key(freq_mhz: f64, band_width_mhz: f64) -> String {
    let band = (freq_mhz / band_width_mhz).floor() as u64;
    format!("f_{}", band)
}
```

**Band allocation (ISM + maritime/aviation)**:

| Band | Frequency | Width |
|------|-----------|-------|
| VHF Maritime | 156-174 MHz | 2 MHz buckets |
| ADS-B | 1090 MHz | Single band |
| AIS | 161.975/162.025 MHz | 0.05 MHz |
| L-Band Radar | 1215-1400 MHz | 10 MHz buckets |
| S-Band Radar | 2700-3100 MHz | 20 MHz buckets |

### 2.6 OrderedFloat for dd Compatibility (P1)

**Problem**: `f64` does NOT implement `Ord` (NaN breaks total ordering). differential-dataflow requires `D: Ord` for all Collection data.

**Solution**: `ordered_float::OrderedFloat<f64>` from the `ordered-float` crate (100M+ downloads):
- Implements `Ord`, `Eq`, `Hash` (NaN sorts as greater than all values)
- Zero-cost ABI-transparent wrapper
- `Copy + Clone + Send + Sync + 'static`

```rust
use ordered_float::OrderedFloat;
type Score = OrderedFloat<f64>;

// In dd closures — Ord works naturally
collection.reduce(|_key, input, output| {
    let max = input.iter().map(|(&score, _)| score).max().unwrap();
    output.push((max, 1));
});
```

**Alternative for deterministic cross-platform reproducibility**: Integer-scaled fixed-point `FixedScore(i64)` with 6 decimal places. Use for final persisted scores only — intermediate computations use `OrderedFloat`.

Add to `ava-fusion-runtime/Cargo.toml`:
```toml
ordered-float = "5.1"
```

### 2.7 Numerical Stability in dd Closures (P1)

**Kahan summation** for any floating-point accumulation inside `reduce`:
```rust
struct KahanAccumulator {
    sum: f64,
    compensation: f64,
}

impl KahanAccumulator {
    fn add(&mut self, value: f64) {
        let y = value - self.compensation;
        let t = self.sum + y;
        self.compensation = (t - self.sum) - y;
        self.sum = t;
    }
}
```

**Where to apply**: `score_weighted_average`, `score_log_odds`, any `reduce` that sums floats. Current `scoring.rs` uses naive summation — should be upgraded.

**Log-space arithmetic**: For DS combination, multiply masses in log-space:
```rust
let log_product = log_m1 + log_m2;  // Instead of m1 * m2
let product = log_product.exp();     // Convert back only at the end
```

Prevents underflow when combining many low-mass focal elements.

---

## 3. Evidence Theory

### 3.1 PCR5 Combination Rule (P0)

**Context**: Current `DsCombinationRule` has Standard/Yager/TBM. PCR5 (Smarandache & Dezert) is the conflict-resilient alternative that avoids Zadeh's paradox without the distortion of global normalization.

**Formula for 2 sources over frame Θ**:
```
m_PCR5(X) = Σ_{A∩B=X} m₁(A)·m₂(B)                              // conjunctive
           + Σ_{Y: X∩Y=∅} [ m₁(X)²·m₂(Y) / (m₁(X)+m₂(Y))      // X gets its share
                           + m₂(X)²·m₁(Y) / (m₂(X)+m₁(Y)) ]    // symmetric
```

Fractions with zero denominators are discarded (l'Hôpital not needed; those mass products are zero).

**Key difference from Dempster**: Dempster inflates ALL masses by 1/(1-K). PCR5 traces each conflicting product `m₁(A)·m₂(B)` where `A∩B=∅` backwards, returning mass proportionally to A and B individually. No global redistribution.

**Trade-off**: PCR5 is NOT associative for n>2 sources. Must combine pairwise, then aggregate. For 6 sources: 15 pairwise combinations → Murphy's average.

**Rust implementation sketch**:
```rust
/// PCR5 combination of two BPAs.
/// BPA represented as HashMap<u64, f64> where u64 is a bitset over Θ.
fn pcr5_combine(m1: &BPA, m2: &BPA) -> BPA {
    let mut result = BPA::new();

    // Phase 1: Conjunctive mass (agreements)
    for (&a, &ma) in m1.iter() {
        for (&b, &mb) in m2.iter() {
            let intersection = a & b;
            if intersection != 0 {
                *result.entry(intersection).or_default() += ma * mb;
            }
        }
    }

    // Phase 2: Proportional conflict redistribution
    for (&a, &ma) in m1.iter() {
        for (&b, &mb) in m2.iter() {
            if a & b == 0 {  // Conflicting pair
                let conflict_mass = ma * mb;
                // Redistribute to A proportionally
                let denom_a = ma + mb;
                if denom_a > 0.0 {
                    *result.entry(a).or_default() += ma * ma * mb / denom_a;
                }
                // Redistribute to B proportionally
                let denom_b = mb + ma;
                if denom_b > 0.0 {
                    *result.entry(b).or_default() += mb * mb * ma / denom_b;
                }
            }
        }
    }

    result
}
```

**Complexity**: O(F²) per pair, where F = focal elements. With epsilon pruning (F ≤ 50), this is sub-millisecond.

**dd integration**: Replace the `DsCombinationRule::Standard` branch in `scoring.rs:score_dempster_shafer` with a PCR5 variant. Add `DsCombinationRule::Pcr5` to the enum in `confidence.rs`.

### 3.2 Murphy's Average BPA (P1)

**For n>2 sources** (since PCR5 is non-associative):
```
m_avg(A) = (1/n) · Σᵢ mᵢ(A)
m_Murphy = m_avg ⊕_Dempster m_avg ⊕ ... ⊕ m_avg   (n-1 times)
```

Averaging smooths extreme assignments → conflict K between copies is small → Dempster normalization is safe. Complexity: O(n·F²).

**When to use**: Any time more than 2 independent evidence sources contribute to the same entity. The `reduce` closure accumulates BPAs, computes Murphy average, then self-combines.

### 3.3 Pignistic Probability Transform (P1)

**Formula** (Smets 1990):
```
BetP(Hᵢ) = Σ_{A: Hᵢ∈A} m(A) / |A| · 1/(1 - m(∅))
```

Each focal element distributes mass equally among its members. Apply AFTER fusion, BEFORE decision. Never fuse pignistic probabilities — they lose the uncertainty structure.

**Implementation**: `map` operator on the output of `reduce` (DS combination). Convert BPA → probability vector for downstream consumers (track manager, alarm evaluator) that expect scalar confidence.

```rust
fn pignistic_transform(bpa: &BPA, frame_size: u32) -> Vec<(usize, f64)> {
    let empty_mass = bpa.get(&0).copied().unwrap_or(0.0);
    let normalizer = 1.0 / (1.0 - empty_mass);

    let mut probs = vec![0.0f64; frame_size as usize];
    for (&focal, &mass) in bpa.iter() {
        if focal == 0 { continue; }
        let card = focal.count_ones() as f64;
        for bit in 0..frame_size {
            if focal & (1u64 << bit) != 0 {
                probs[bit as usize] += mass / card * normalizer;
            }
        }
    }

    probs.into_iter().enumerate()
        .filter(|(_, p)| *p > 0.0)
        .collect()
}
```

### 3.4 Jousselme Distance (P2)

**Formula**:
```
d(m₁, m₂) = √(0.5 · (m₁ - m₂)ᵀ · D · (m₁ - m₂))

D(A, B) = |A ∩ B| / |A ∪ B|     (Jaccard index)
```

Range [0, 1]. True metric (Jaccard matrix is positive definite).

**Use case**: Pre-fusion source quality weighting. Compute pairwise Jousselme distances between all evidence sources for an entity. Sources far from consensus (d > 0.7) are discounted or excluded. This replaces the current entropy-only weighting with a consensus-aware metric.

**dd integration**: `join` of BPA pairs → `map` computing distance → `reduce` aggregating per-entity quality scores.

### 3.5 Epsilon Pruning & k-additive BPAs (P1)

**Problem**: Full BPA over |Θ|=20 has 1M focal elements. Infeasible.

**Solution 1 — Epsilon pruning**: After every combination, discard focal elements with m(A) < ε. Redistribute proportionally to remaining elements. Practical ε values:

| Application | ε |
|-------------|---|
| Classification | 1e-3 |
| Safety-critical | 1e-4 |
| Real-time fusion | 1e-2 |

**Solution 2 — k-additive restriction**: Only maintain focal elements of size ≤ k.

| |Θ| | k=2 focal elements | Full | Reduction |
|-----|---------------------|------|-----------|
| 10 | 55 | 1,024 | 19x |
| 15 | 120 | 32,768 | 273x |
| 20 | 210 | 1,048,576 | 4,993x |

k=2 is the practical sweet spot — captures singletons and pairs.

**Rust representation**: `HashMap<u64, f64>` where key is a bitset. `POPCNT` instruction (via `count_ones()`) for cardinality, `&` for intersection, `|` for union. Stack-allocatable for small frames.

### 3.6 Belief/Plausibility Intervals (P1)

**Formulas**:
```
Bel(H) = Σ_{A⊆H, A≠∅} m(A)      // all evidence strictly supporting H
Pl(H)  = Σ_{A∩H≠∅} m(A)          // all evidence not contradicting H
       = 1 - Bel(complement(H))
```

The interval [Bel(H), Pl(H)] conveys:
- **Bel(H)**: lower bound — guaranteed evidence
- **Pl(H)**: upper bound — evidence not against H
- **Pl(H) - Bel(H)**: degree of ignorance

| Interval | Meaning | Action |
|----------|---------|--------|
| [0.8, 0.9] | Strong, low ignorance | High-confidence alert |
| [0.3, 0.7] | Moderate, high ignorance | Need more data |
| [0.45, 0.55] | Balanced, low ignorance | Evidence is contradictory |
| [0.1, 0.9] | Minimal, high ignorance | Almost no information |

**Key insight**: Width matters as much as center. [0.45, 0.55] (width=0.1) means "we know it's uncertain" vs. [0.3, 0.7] (width=0.4) means "we don't know enough."

**dd integration**: `map` operator after DS/PCR5 `reduce`. Convert BPA → `(Bel, Pl)` interval for downstream consumers. Cheaper than pignistic transform when full probability vector isn't needed.

### 3.7 BPA Type for ava-fusion

New type to add to `ava-fusion/src/confidence.rs`:

```rust
/// Basic Probability Assignment over a frame of discernment.
/// Focal elements encoded as u64 bitsets (supports |Θ| ≤ 64).
#[derive(Debug, Clone, PartialEq)]
pub struct BasicProbabilityAssignment {
    /// Map from focal element (bitset) to mass value.
    pub masses: HashMap<u64, f64>,
    /// Size of the frame of discernment.
    pub frame_size: u8,
}

impl BasicProbabilityAssignment {
    /// Create a vacuous BPA (all mass on Θ).
    pub fn vacuous(frame_size: u8) -> Self {
        let theta = (1u64 << frame_size) - 1;
        let mut masses = HashMap::new();
        masses.insert(theta, 1.0);
        Self { masses, frame_size }
    }

    /// Epsilon-prune focal elements below threshold.
    pub fn prune(&mut self, epsilon: f64) {
        let pruned: f64 = self.masses.values()
            .filter(|&&m| m < epsilon)
            .sum();
        self.masses.retain(|_, m| *m >= epsilon);
        // Redistribute proportionally
        if pruned > 0.0 {
            let remaining: f64 = self.masses.values().sum();
            for m in self.masses.values_mut() {
                *m *= (remaining + pruned) / remaining;
            }
        }
    }

    /// Compute Shannon entropy of the BPA.
    pub fn entropy(&self) -> f64 {
        self.masses.values()
            .filter(|&&m| m > 0.0)
            .map(|&m| -m * m.ln())
            .sum()
    }
}
```

---

## 4. Graph Algorithms

### 4.1 Triangle Counting via dogsdogsdogs (P1)

**Crate**: `dogsdogsdogs` — Frank McSherry's WCOJ implementation for differential-dataflow.

**Why triangles matter**: Triangles in the entity correlation graph indicate strong mutual association. Three entities that are all pairwise correlated form a clique — much stronger evidence of common identity than any single edge.

**Implementation**:
```rust
use dogsdogsdogs::alg::intersect_and;
use differential_dataflow::operators::arrange::ArrangeByKey;

// edges: Collection<S, (Entity, Entity), isize>
// Ensure edges are bidirectional and self-loop free.
let forward = edges.arrange_by_key();
let reverse = edges.map(|(a, b)| (b, a)).arrange_by_key();

// Triangle enumeration via 3-way join: (a,b) ∧ (b,c) ∧ (a,c)
let triangles = intersect_and(
    &forward,
    &reverse,
    |&a, &b| (a, b),  // prefix: edge (a,b)
    |&key, &val| (key, val),  // extend to (a,b,c) where (b,c) exists
);
// O(|E|^{3/2}) batch complexity — truly incremental via dd
```

**Output**: Each triangle `(a, b, c)` with diff +1/-1 as edges appear/disappear. Feed into community confidence scoring — entities in triangles get a `triangle_boost` multiplier.

**Clustering coefficient** (implement alongside):
```
CC(v) = 2T(v) / (deg(v) · (deg(v) - 1))
```
Where T(v) = triangles containing v, deg(v) = degree of v. Computed as a `reduce` on the triangle output.

### 4.2 PersonalizedPageRank (P2)

**Algorithm**: Power iteration via dd `iterate`.

```rust
let alpha = 0.85;
let epsilon = 0.001;  // Convergence threshold
let discretize = |r: f64| (r * 1000.0).round() as i64;

// Seed: uniform over all entities
let seed = entities.map(|e| (e, discretize(1.0 / entity_count as f64)));

let ranks = seed.iterate(|ranks| {
    let edges = edges.enter(&ranks.scope());

    // Distribute rank along outgoing edges
    let contributions = ranks
        .join(&edges)  // (node, rank) × (node, neighbor) → (neighbor, rank/outdeg)
        .map(|(_, (rank, neighbor, outdeg))| {
            (neighbor, discretize(rank as f64 / outdeg as f64 * alpha))
        })
        .reduce(|_node, contribs, output| {
            let sum: i64 = contribs.iter().map(|(r, _)| **r).sum();
            output.push((sum + discretize((1.0 - alpha) / entity_count as f64), 1));
        });

    contributions.consolidate()
});
```

**Convergence**: Discretizing to integers (×1000) guarantees termination. Non-discretized floats may oscillate forever in dd's lattice model.

**Use case**: Entity importance scoring for prioritization. High-PPR entities are central to the correlation graph and warrant more attention from operators.

### 4.3 Single-Level Louvain (P3)

**Algorithm**: Modularity optimization via `iterate`.

Phase 1 only (no hierarchical coarsening):
1. Each node starts as its own community
2. For each node, evaluate modularity gain from moving to neighbor's community
3. Move to community with maximum gain (if positive)
4. Repeat until no beneficial moves

**dd pattern**: `iterate` with `reduce` computing modularity delta per node-community pair.

**Quality**: Single-level achieves 85-92% of full multi-level Louvain quality. The hierarchical phases add minimal improvement for the complexity cost.

**Implementation note**: The modularity function `Q = Σ_c [L_c/m - (k_c/2m)²]` requires global degree sums. Maintain a `reduce` over all edges to compute `m` (total edge weight) and per-node degrees. These feed into the modularity delta calculation.

### 4.4 Temporal Community Detection (P4-DEFER)

**Concept**: Communities that evolve over time windows. Each time epoch produces a community assignment; track community stability, splits, merges across epochs.

**Why defer**: Requires careful design of the temporal windowing interaction with dd's time model. Research-grade — no established dd implementation pattern. Revisit after basic community detection (Louvain) is proven.

---

## 5. Tracking & State Estimation

### 5.1 Extended Kalman Filter — Three Motion Models (P0)

**State vectors**:

| Model | State | Dimension | Linearity |
|-------|-------|-----------|-----------|
| CV (Constant Velocity) | `[x, y, vx, vy]` | 4 | Linear F |
| CT (Coordinated Turn) | `[x, y, vx, vy, ω]` | 5 | Nonlinear (Jacobian) |
| CTRV (Constant Turn Rate & Velocity) | `[x, y, v, θ, ω]` | 5 | Nonlinear (singularity at ω≈0) |

**CV Process Model** (piecewise white noise, σ_a = acceleration std dev):
```
F = | 1  0  dt  0  |     Q = σ_a² · | dt⁴/4    0       dt³/2    0      |
    | 0  1  0   dt |                  | 0        dt⁴/4  0        dt³/2  |
    | 0  0  1   0  |                  | dt³/2    0       dt²      0      |
    | 0  0  0   1  |                  | 0        dt³/2  0        dt²    |
```

**CTRV Prediction** (requires singularity guard):
```rust
fn predict_ctrv(state: &Vector5<f64>, dt: f64) -> Vector5<f64> {
    let (x, y, v, theta, omega) = (state[0], state[1], state[2], state[3], state[4]);

    if omega.abs() < 1e-6 {
        // Straight-line fallback (avoid division by zero)
        Vector5::new(
            x + v * theta.cos() * dt,
            y + v * theta.sin() * dt,
            v,
            theta,
            omega,
        )
    } else {
        let v_w = v / omega;
        Vector5::new(
            x + v_w * ((theta + omega * dt).sin() - theta.sin()),
            y + v_w * (theta.cos() - (theta + omega * dt).cos()),
            v,
            theta + omega * dt,
            omega,
        )
    }
}
```

**Joseph form** (numerically stable covariance update):
```
P_updated = (I - K·H) · P_predicted · (I - K·H)ᵀ + K · R · Kᵀ
```
Standard form `P = (I-KH)P` accumulates roundoff; Joseph form is symmetric-positive-definite by construction.

**Rust crate**: `nalgebra::SMatrix<f64, N, N>` for compile-time dimensions. The `adskalman` crate implements Joseph form on nalgebra — evaluate for direct use or as reference.

**Integration with ava-fusion**: New module `ava-fusion-runtime/src/tracking/ekf.rs`. The EKF runs per-track in the `TrackManager` actor, NOT in the dataflow graph. Kinematic state estimation is sequential per-track, not a join operation.

### 5.2 IMM Filter (P1)

**Four steps per cycle** across r=3 models (CV, CT, CTRV):

**Step 1 — Mixing probabilities**:
```
μ_{i|j} = π[i][j] · μᵢ / c_j
c_j = Σᵢ π[i][j] · μᵢ
```

**Step 2 — Mixed initial conditions**:
```
x̂⁰_j = Σᵢ μ_{i|j} · x̂ᵢ
P⁰_j = Σᵢ μ_{i|j} · [Pᵢ + (x̂ᵢ - x̂⁰_j)(x̂ᵢ - x̂⁰_j)ᵀ]
```

**Step 3 — Model-conditioned filtering**: Run each EKF independently with mixed initial conditions.

**Step 4 — Model probability update**:
```
Λⱼ = N(zₖ; ẑⱼ, Sⱼ)     // Gaussian likelihood from innovation
μⱼ(k) = Λⱼ · c_j / Σⱼ(Λⱼ · c_j)
```

**Transition matrix** (moderate maneuver rate):
```
π = | 0.95   0.025  0.025 |
    | 0.025  0.95   0.025 |
    | 0.025  0.025  0.95  |
```

**Memory**: ~93 f64 values per track (744 bytes) for 3 models padded to dim 5. Stack-allocatable.

**Integration**: `ava-fusion-runtime/src/tracking/imm.rs`. Wraps three EKF instances. Called per measurement update in `TrackManager`.

### 5.3 SPRT Track Confirmation (P2)

**Sequential Probability Ratio Test** replaces M-of-N for track lifecycle transitions.

**Log-likelihood ratio**:
```
Lₙ = Σ log(P(zᵢ|H₁) / P(zᵢ|H₀))
```

**Thresholds**:
- Confirm: A = ln((1-β)/α)
- Reject: B = ln(β/(1-α))

**Per-scan update**:
- Associated measurement: Gaussian likelihood vs. clutter density
- Missed detection: contributes `ln(1 - P_D)`

**Domain parameters**:

| Domain | α | β | A (confirm) | B (reject) |
|--------|---|---|-------------|------------|
| Maritime | 0.01 | 0.05 | 2.94 | -2.97 |
| Aviation | 0.05 | 0.10 | 2.56 | -2.89 |

**Integration**: Add `ConfirmationMethod::Sprt` to `track.rs`. The SPRT state (cumulative log-likelihood) is maintained per-track in `TrackManager`.

### 5.4 Covariance Intersection (P2)

**Formula**:
```
P_CI⁻¹ = ω · P_A⁻¹ + (1-ω) · P_B⁻¹
x_CI = P_CI · (ω · P_A⁻¹ · x_A + (1-ω) · P_B⁻¹ · x_B)
```

**Fast ω** (trace minimization, no cross-correlation needed):
```
ω = tr(P_B) / (tr(P_A) + tr(P_B))
```

**When to use**: Track-to-track fusion from different trackers where cross-correlations are unknown. This is the mathematically conservative approach — guaranteed consistent (never overconfident).

**dd integration**: `reduce` by entity key. When multiple tracks claim the same entity, CI fuses their state estimates. The `reduce` closure computes the fused state and covariance.

**Rust note**: Use Cholesky decomposition (`nalgebra::Cholesky`) for matrix inversion instead of direct `.try_inverse()`. Numerically more stable.

### 5.5 Coast Prediction & Uncertainty Growth (P0)

**Position uncertainty dominant term** at coast time T:
```
σ_x²(T) ≈ σ_a² · T³/3     (from process noise integration)
```

**Coast limits by domain**:

| Domain | Max coast time | Max position uncertainty |
|--------|---------------|------------------------|
| Maritime | 30 min | 5 km gate |
| Aviation | 5 min | 2 km gate |
| Ground vehicles | 10 min | 1 km gate |

**Track deletion**: When either time OR position uncertainty exceeds threshold, transition to Dropped state. The current `CoastConfig` in `track.rs` supports `max_duration_s` but needs `max_position_uncertainty_m` added.

---

## 6. Complex Event Processing

### 6.1 NFA-SASE Engine Architecture (P0)

**Core runtime unit**:
```rust
struct ComputationState {
    /// Current NFA state index
    current_state: usize,
    /// References to matched events (not clones)
    matched_events: SmallVec<[EventRef; 8]>,
    /// Pattern start time for window eviction
    start_time: u64,
    /// Dewey version for branch discrimination
    version: DeweyVersion,
}
```

**NFA construction** from `SequencePattern`:
Each `SequenceStep` becomes an NFA state. Transitions depend on contiguity:

| Contiguity | Transitions | Non-matching event |
|------------|------------|-------------------|
| Strict | TAKE only | Drop partial match |
| Relaxed | TAKE + IGNORE | Stay in current state (IGNORE) |
| NonDeterministic | TAKE (fork) + IGNORE (continue) | Fork: one branch takes, one skips |

**Processing loop** (per incoming event):
```rust
fn process_event(&mut self, event: &Event) -> Vec<SequenceMatch> {
    let mut next_states = Vec::new();
    let mut completed = Vec::new();

    for state in self.active_states.drain(..) {
        let step = &self.pattern.steps[state.current_state];

        // Check if event matches current step's predicate
        if self.evaluate_predicate(&step.predicate, event, &state) {
            // TAKE transition
            let mut new_state = state.clone();
            new_state.matched_events.push(EventRef::from(event));
            new_state.current_state += 1;

            if new_state.current_state == self.pattern.steps.len() {
                // Check cross-step predicates before accepting
                if self.evaluate_cross_predicates(&new_state) {
                    completed.push(self.to_sequence_match(&new_state));
                }
            } else {
                next_states.push(new_state);
            }

            // For NonDeterministic: also keep the old state (IGNORE)
            if step.contiguity == Contiguity::NonDeterministic {
                next_states.push(state);
            }
        } else {
            match step.contiguity {
                Contiguity::Strict => { /* drop partial match */ }
                Contiguity::Relaxed | Contiguity::NonDeterministic => {
                    next_states.push(state);  // IGNORE transition
                }
            }
        }
    }

    self.active_states = next_states;
    completed
}
```

### 6.2 Partial Match Management (P0)

NonDeterministic mode creates O(2ⁿ) partial matches. Three defenses:

**1. Window eviction** (mandatory):
```rust
self.active_states.retain(|s| now - s.start_time <= self.pattern.timeout_ms);
```

**2. Budget cap** (per-pattern limit, oldest-first eviction):
```rust
const MAX_PARTIAL_MATCHES: usize = 10_000;
if self.active_states.len() > MAX_PARTIAL_MATCHES {
    self.active_states.sort_by_key(|s| s.start_time);
    self.active_states.truncate(MAX_PARTIAL_MATCHES);
}
```

**3. SharedBuffer** (Flink's key insight): Events stored once with unique IDs. Partial matches hold `EventRef` (arena index), not event clones. Memory: N events × sizeof(Event) + M partial matches × ~64 bytes (refs only).

```rust
/// Arena-backed event storage. Events stored once, referenced by index.
struct SharedBuffer {
    events: SlotMap<EventKey, Arc<EventData>>,
}

/// Lightweight reference into the SharedBuffer.
#[derive(Clone, Copy)]
struct EventRef {
    key: EventKey,
    timestamp: u64,
}
```

### 6.3 Cross-Step Predicates (P0)

**Current type** (`sequence.rs`): `CrossStepPredicate { from_step, to_step, predicate }` with predicates like `"haversine(step_0.geo, step_2.geo) < 50000"`.

**Optimization — Predicate pushdown**: Evaluate cross-predicates at the earliest state where all referenced data is available, NOT at the ACCEPT state. If a cross-predicate references steps 0 and 2, evaluate it at state 3 (after step 2 is matched). This prunes branches early.

**Expression evaluation**: Compile `predicate` string to `Box<dyn Fn(&MatchContext) -> bool>` at pattern registration time. Five AST variants:

```rust
enum Expr {
    Field(StepRef, FieldPath),           // step_0.geo.lat
    Literal(f64),                         // 50000
    BinOp(Box<Expr>, Op, Box<Expr>),     // a < b, a + b
    FuncCall(String, Vec<Expr>),          // haversine(a, b)
    Not(Box<Expr>),                       // !predicate
}
```

~100 lines of code for the compiler.

**Alternative**: The `evalexpr` crate (3M+ downloads) provides boolean expression evaluation with custom function registration (`haversine`, `abs`, etc.), variable binding, and pre-compilation to trees. Trade-off: ~10-100x slower than native closures, but nanoseconds vs. tens of nanoseconds — negligible vs. event I/O cost. Good for rapid prototyping; migrate to compiled closures if profiling shows bottleneck.

### 6.4 Differential-Dataflow Integration (P0)

**Recommendation: Option C — Hybrid (frontier-sealed)**

dd handles retractions at the collection level. NFA runs separately, consuming dd output only after frontier advancement seals a time epoch (guaranteeing no future retractions for that epoch).

```
┌─────────────────────────────────┐     ┌──────────────────────────┐
│  Differential-Dataflow Graph    │     │  NFA-SASE Engine         │
│                                 │     │                          │
│  Collections → Joins → Output   │     │  Per-pattern NFA state   │
│                                 │     │  SharedBuffer            │
│  Frontier advancement seals     │────►│  Window eviction         │
│  time T (no more retractions)   │     │  Budget cap              │
│                                 │     │  Cross-step predicates   │
└─────────────────────────────────┘     └──────────────────────────┘
                                              ↓
                                        SequenceMatch results
```

**Why not pure dd**: NFA has no concept of "un-matching" a partial match that already advanced. Putting NFA inside dd operators requires retractable NFA — a research-level problem. Not worth the complexity.

**Latency cost**: One time-epoch (typically 60s window). Acceptable for behavioral pattern detection which operates on minutes-to-hours timescales.

**Implementation**: `unary_frontier` operator buffers events by time, handles +/-1 diffs. When frontier advances past time T, sealed events (net positive diff) feed into the NFA engine as append-only input.

### 6.5 Module Structure

```
ava-fusion-runtime/src/cep/
  mod.rs          — Public API: CepEngine, SequenceMatch, PatternRegistry
  nfa.rs          — NFA construction from SequencePattern, ComputationState
  evaluator.rs    — Predicate expression compiler and evaluator
  shared_buffer.rs — Arena-backed event storage with EventRef
```

---

## 7. Risk Modeling

### 7.1 Leaky NoisyOr (P0)

**Formula**:
```
P(risk) = 1 - q₀ · Π(1 - pᵢ · xᵢ)
```

Where `q₀ = 1 - p_leak` represents the probability that NO unmodeled cause triggers the risk.

**Current state**: `risk.rs` defines `RiskAccumulationMethod::NoisyOr` with formula `1 - Π(1-sᵢ)`. Adding the leak term is a one-line change:

```rust
// Current:
let product: f64 = scores.iter().map(|s| 1.0 - s).product();
1.0 - product

// With leak:
let product: f64 = scores.iter().map(|s| 1.0 - s).product();
1.0 - q0 * product
```

**Default q₀ = 0.95** (5% background risk from unmodeled causes).

**NoisyMAX extension** (ordinal severity): Apply NoisyOr independently at each severity threshold. For risk levels [Low, Elevated, High, Severe, Critical]:
```rust
fn noisy_max_ordinal(scores: &[(f64, RiskThreshold)], q0: f64) -> RiskThreshold {
    // P(risk >= level) = 1 - q0 * Π(1 - p_i) for indicators above that level
    for &level in &[Critical, Severe, High, Elevated, Low] {
        let relevant: Vec<f64> = scores.iter()
            .filter(|(_, t)| *t >= level)
            .map(|(s, _)| *s)
            .collect();
        let p = 1.0 - q0 * relevant.iter().map(|s| 1.0 - s).product::<f64>();
        if p > 0.5 { return level; }
    }
    RiskThreshold::Low
}
```

### 7.2 Temporal Decay — Weibull & Power-Law (P1)

**Current state**: `risk.rs` defines `RiskDecay { half_life_ms, min_score }` — pure exponential. Insufficient for different indicator behaviors.

**Weibull decay**: `s(t) = s₀ · exp(-(t/λ)^k)`

| Category | k | λ | Behavior |
|----------|---|---|----------|
| Identity | 1.0 | 30 min | Standard exponential |
| Kinematic | 0.7 | 5 min | Fast initial, long tail |
| Behavioral | 0.8 | 15 min | Moderate fade |
| Signal | 1.5 | 10 min | Slow start, abrupt cutoff |

**Power-law decay**: `s(t) = s₀ · (1 + t/τ)^(-α)`

| Category | τ | α | Behavior |
|----------|---|---|----------|
| Association | 1 hr | 0.8 | Fat-tailed (network links persist) |
| Intelligence | 24 hr | 0.5 | Very fat tail (reports retain value) |

**At t = 10τ**: Exponential → 0.005%. Power-law (α=1) → 9%. The fat tail is the point — intelligence reports from 24 hours ago still have 9% residual value.

**New type**:
```rust
/// Per-category temporal decay model.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DecayModel {
    /// s(t) = s₀ · exp(-(t/λ)^k)
    Weibull { lambda_ms: f64, k: f64 },
    /// s(t) = s₀ · (1 + t/τ)^(-α)
    PowerLaw { tau_ms: f64, alpha: f64 },
    /// s(t) = s₀ · exp(-ln(2) · t / half_life)  [current behavior]
    Exponential { half_life_ms: f64 },
}
```

### 7.3 CUSUM Change-Point Detection (P1)

**Tabular CUSUM** for risk trend detection:
```rust
struct CusumState {
    s_plus: f64,   // Upward cumulative sum
    s_minus: f64,  // Downward cumulative sum
    mu_0: f64,     // Baseline mean (from Welford)
    sigma: f64,    // Baseline std dev
}

impl CusumState {
    fn update(&mut self, x: f64) -> Option<TrendDirection> {
        let k = 0.5 * self.sigma;  // Allowance
        let h = 5.0 * self.sigma;  // Decision threshold

        self.s_plus = (self.s_plus + (x - self.mu_0 - k)).max(0.0);
        self.s_minus = (self.s_minus + (self.mu_0 - k - x)).max(0.0);

        if self.s_plus > h {
            self.s_plus = 0.0;  // Reset after alarm
            Some(TrendDirection::Rising)
        } else if self.s_minus > h {
            self.s_minus = 0.0;
            Some(TrendDirection::Falling)
        } else {
            None  // No change point detected
        }
    }
}
```

**ARL performance** (k=0.5σ, h=5σ):
- ARL₀ (false alarm interval) ≈ 465 samples
- ARL₁ (detect 1σ shift) ≈ 13 samples

**dd integration**: Inside `reduce` per entity. CUSUM state is accumulated alongside risk scores. When change point detected, emit `TrendDirection` change to trigger `EntityRiskProfile.trend` update.

### 7.4 Alert Fatigue Suppression (P1)

Four-layer suppression:

**Layer 1 — Hysteresis** (deadband):
```
Enter alert: score > threshold
Exit alert: score < threshold - delta     (delta = threshold * 0.10..0.15)
```

**Layer 2 — Score-delta**: Only alert when `|score_new - score_last_alerted| > Δ` (typical Δ = 0.15).

**Layer 3 — Rate limiting**: Token bucket, N=3 alerts per entity per hour.

**Layer 4 — Cooldown**: Minimum T_cool = 30-60s after any alert.

**Combined predicate**:
```rust
fn should_alert(&self, entity: &EntityId, score: f64) -> bool {
    let state = self.alert_states.entry(entity.clone()).or_default();

    // Hysteresis
    let in_zone = if state.alarmed {
        score > state.threshold - state.delta
    } else {
        score > state.threshold
    };

    // Score-delta significance
    let significant = (score - state.last_alerted_score).abs() > SCORE_DELTA;

    // Rate limit (token bucket)
    let rate_ok = state.bucket.try_consume();

    // Cooldown
    let cooled = state.last_alert_time.elapsed() > COOLDOWN;

    in_zone && significant && rate_ok && cooled
}
```

**Integration**: In `AlarmEvaluator` actor, BEFORE emitting alarms downstream. Not inside the dataflow graph — this is actor-level state management.

### 7.5 6-Node Bayesian Network (P3)

**DAG**:
```
Intelligence ──┬──► Identity
               ├──► Kinematic
               ├──► Behavioral ──► Association
               ├──► Association
               └──► Signal ──────► Identity
```

**Inference**: 2⁶ = 64 joint states. Variable elimination with treewidth ≤ 3 → O(48) operations. Sub-microsecond. Full stack-allocation in Rust.

**CPTs**: Each node uses Leaky NoisyOr as its conditional probability table. The BN structure captures directed causality (Signal quality affects Identity confidence) and conditional independence (given Intelligence, Signal and Behavioral are d-separated).

**When to implement**: After NoisyOr (P0) and Weibull decay (P1) are proven. The BN adds structural knowledge on top of the existing risk accumulation — it's an upgrade path, not a prerequisite.

### 7.6 Convergence Bonus (P3)

**Power-law base with entropy multiplier**:
```
bonus = β · (K/N)^γ · (0.5 + 0.5 · H/H_max)
```

Where K = active risk categories, N = 6 total, H = Shannon entropy of normalized active scores, β = 0.3, γ = 1.5.

**Table**:

| Active categories | K/N | Base bonus | With balanced entropy |
|-------------------|-----|------------|----------------------|
| 1 | 0.17 | 0.02 | 0.01-0.02 |
| 3 | 0.50 | 0.11 | 0.08-0.11 |
| 5 | 0.83 | 0.23 | 0.17-0.23 |
| 6 | 1.00 | 0.30 | 0.22-0.30 |

**Purpose**: Reward multi-domain corroboration. An entity flagged by 5 of 6 risk categories deserves a ~25% confidence boost over isolated indicators.

**Bayesian surprise** (advanced, Itti & Baldi 2005): `S = KL(posterior || prior)`. Measures how much the current activation pattern deviates from historical norms. Unusual convergence → extra attention. Defer to Phase 2.

---

## 8. Implementation Roadmap

### Phase A: Foundation Types (P0, ~1 day)

| Task | File | Lines |
|------|------|-------|
| Add `DsCombinationRule::Pcr5` variant | `ava-fusion/src/confidence.rs` | +10 |
| Add `BasicProbabilityAssignment` type | `ava-fusion/src/confidence.rs` | +60 |
| Add `DecayModel` enum (Weibull/PowerLaw/Exponential) | `ava-fusion/src/risk.rs` | +30 |
| Add `ConfirmationMethod::Sprt` variant | `ava-fusion/src/track.rs` | +15 |
| Add `max_position_uncertainty_m` to `CoastConfig` | `ava-fusion/src/track.rs` | +5 |
| Add leak parameter to `RiskAccumulationConfig` | `ava-fusion/src/risk.rs` | +10 |

### Phase B: Scoring & Evidence (P0-P1, ~2 days)

| Task | File | Lines |
|------|------|-------|
| Implement `pcr5_combine()` | `ava-fusion-runtime/src/dataflow/scoring.rs` | +80 |
| Implement `pignistic_transform()` | `ava-fusion-runtime/src/dataflow/scoring.rs` | +30 |
| Implement `murphy_average()` | `ava-fusion-runtime/src/dataflow/scoring.rs` | +25 |
| Implement `jousselme_distance()` | `ava-fusion-runtime/src/dataflow/scoring.rs` | +40 |
| Add epsilon pruning to BPA operations | `ava-fusion-runtime/src/dataflow/scoring.rs` | +20 |
| Add Kahan summation to existing scorers | `ava-fusion-runtime/src/dataflow/scoring.rs` | +30 |
| Integrate PCR5 into graph.rs `compute_confidence` | `ava-fusion-runtime/src/dataflow/graph.rs` | +20 |
| Implement Leaky NoisyOr + NoisyMAX | `ava-fusion-runtime/src/risk/accumulation.rs` | +60 |
| Implement Weibull/PowerLaw decay | `ava-fusion-runtime/src/risk/decay.rs` | +50 |

### Phase C: Tracking Module (P0-P1, ~3 days)

| Task | File | Lines |
|------|------|-------|
| EKF with CV model | `ava-fusion-runtime/src/tracking/ekf.rs` | +150 |
| EKF with CT model (Jacobian) | `ava-fusion-runtime/src/tracking/ekf.rs` | +100 |
| EKF with CTRV model (singularity guard) | `ava-fusion-runtime/src/tracking/ekf.rs` | +120 |
| IMM filter (3-model) | `ava-fusion-runtime/src/tracking/imm.rs` | +200 |
| SPRT track confirmation | `ava-fusion-runtime/src/tracking/sprt.rs` | +80 |
| Covariance Intersection | `ava-fusion-runtime/src/tracking/fusion.rs` | +60 |
| Coast uncertainty growth | `ava-fusion-runtime/src/tracking/coast.rs` | +40 |
| Wire into TrackManager actor | `ava-fusion-runtime/src/actors/track_manager.rs` | +50 |

### Phase D: CEP Engine (P0, ~2 days)

| Task | File | Lines |
|------|------|-------|
| NFA construction from SequencePattern | `ava-fusion-runtime/src/cep/nfa.rs` | +200 |
| ComputationState + SharedBuffer | `ava-fusion-runtime/src/cep/shared_buffer.rs` | +100 |
| Predicate expression compiler | `ava-fusion-runtime/src/cep/evaluator.rs` | +120 |
| Window eviction + budget cap | `ava-fusion-runtime/src/cep/nfa.rs` | +40 |
| Cross-step predicate pushdown | `ava-fusion-runtime/src/cep/nfa.rs` | +60 |
| Frontier-sealed dd integration | `ava-fusion-runtime/src/cep/mod.rs` | +80 |

### Phase E: Graph Algorithms (P1-P2, ~2 days)

| Task | File | Lines |
|------|------|-------|
| Triangle counting via dogsdogsdogs | `ava-fusion-runtime/src/graph/triangles.rs` | +80 |
| Clustering coefficient from triangles | `ava-fusion-runtime/src/graph/clustering.rs` | +40 |
| PersonalizedPageRank via iterate | `ava-fusion-runtime/src/graph/pagerank.rs` | +100 |
| Single-level Louvain | `ava-fusion-runtime/src/graph/louvain.rs` | +200 |

### Phase F: Risk & Alert (P1, ~1 day)

| Task | File | Lines |
|------|------|-------|
| CUSUM change-point detection | `ava-fusion-runtime/src/risk/cusum.rs` | +60 |
| Alert fatigue suppression (4-layer) | `ava-fusion-runtime/src/actors/alarm_evaluator.rs` | +80 |
| Convergence bonus | `ava-fusion-runtime/src/risk/convergence.rs` | +30 |

### Phase G: Signal Processing Upgrades (P2, ~1 day)

| Task | File | Lines |
|------|------|-------|
| Real H3 blocking (h3o crate) | `ava-fusion-runtime/src/dataflow/blocking.rs` | +40 |
| FFT periodicity detection | `ava-fusion-runtime/src/signal/periodicity.rs` | +100 |
| Real spectral key extraction | `ava-fusion-runtime/src/dataflow/blocking.rs` | +20 |

### Total Estimates

| Phase | Priority | LOC | Duration |
|-------|----------|-----|----------|
| A: Foundation Types | P0 | ~130 | 1 day |
| B: Scoring & Evidence | P0-P1 | ~355 | 2 days |
| C: Tracking Module | P0-P1 | ~800 | 3 days |
| D: CEP Engine | P0 | ~600 | 2 days |
| E: Graph Algorithms | P1-P2 | ~420 | 2 days |
| F: Risk & Alert | P1 | ~170 | 1 day |
| G: Signal Upgrades | P2 | ~160 | 1 day |
| **Total** | | **~2,635** | **~12 days** |

---

## 9. Crate Dependencies

### New dependencies for `ava-fusion-runtime/Cargo.toml`

```toml
[dependencies]
# Existing
differential-dataflow = "0.18.0"
timely = "0.25"
crossbeam-channel = "0.5"

# Phase C: Tracking
nalgebra = "0.33"              # Compile-time dimensioned matrices

# Phase D: CEP
smallvec = "1.13"              # Stack-allocated partial match vectors
slotmap = "1.0"                # Arena allocation for SharedBuffer

# Phase E: Graph Algorithms
dogsdogsdogs = { git = "https://github.com/TimelyDataflow/differential-dataflow", features = [] }

# Phase G: Signal Processing
h3o = "0.6"                    # H3 geospatial indexing (pure Rust)
rustfft = "6.2"                # FFT for periodicity detection
```

### Types-only changes for `ava-fusion/Cargo.toml`

No new dependencies. All new types (BPA, DecayModel, etc.) use only `std`, `serde`, and `HashMap`.

---

## 10. References

### Signal Processing
1. Welford, B.P. (1962). "Note on a Method for Calculating Corrected Sums of Squares and Products." Technometrics 4(3).
2. h3o crate: https://crates.io/crates/h3o
3. rustfft crate: https://crates.io/crates/rustfft

### Evidence Theory
4. Smarandache, F. & Dezert, J. (2004). "Proportional Conflict Redistribution Rules." arXiv:cs/0408064.
5. Smets, P. (1990). "The Combination of Evidence in the Transferable Belief Model." IEEE TPAMI.
6. Jousselme, A.L., Grenier, D., & Bossé, É. (2001). "A New Distance Between Two Bodies of Evidence." Information Fusion.
7. Murphy, C.K. (2000). "Combining Belief Functions When Evidence Conflicts." Decision Support Systems.
8. Khan, N. & Anwar, S. (2019). "Modified Dempster-Shafer with entropy-based paradox elimination." Sensors.

### Graph Algorithms
9. McSherry, F. (2013). "Differential Dataflow." CIDR.
10. dogsdogsdogs: https://github.com/TimelyDataflow/differential-dataflow/tree/master/dogsdogsdogs
11. Blondel, V.D. et al. (2008). "Fast unfolding of communities in large networks." JSTAT.

### Tracking & Estimation
12. Bar-Shalom, Y. et al. (2001). "Estimation with Applications to Tracking and Navigation." Wiley.
13. Blom, H.A.P. & Bar-Shalom, Y. (1988). "The Interacting Multiple Model Algorithm." IEEE TAC.
14. Wald, A. (1945). "Sequential Tests of Statistical Hypotheses." Annals of Mathematical Statistics.
15. Julier, S.J. & Uhlmann, J.K. (1997). "A Non-divergent Estimation Algorithm in the Presence of Unknown Correlations." ACC.
16. adskalman crate: https://github.com/strawlab/adskalman-rs

### Complex Event Processing
17. Agrawal, J. et al. (2008). "Efficient Pattern Matching over Event Streams." SIGMOD. (SASE)
18. Kolchinsky, I. et al. (2017). "Lazy Evaluation Methods for Detecting Complex Events." DEBS.
19. Apache Flink CEP: https://nightlies.apache.org/flink/flink-docs-master/docs/libs/cep/

### Risk Modeling
20. Srinivas, S. (1993). "A Generalization of the Noisy-Or Model." UAI.
21. Page, E.S. (1954). "Continuous Inspection Schemes." Biometrika. (CUSUM)
22. Itti, L. & Baldi, P. (2005). "Bayesian Surprise Attracts Human Attention." NIPS.
23. NIST CUSUM ARL Tables: https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc3231.htm
