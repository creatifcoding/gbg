# Research: Multi-Target Tracking & Fuzzy Identity Resolution

```
Document:   TSGC-RI-1/2 — Tracking Algorithms & Identity Resolution
Status:     DRAFT
Created:    2026-02-19
Context:    Tsingou SIGINT Visualization Platform
Depends:    TSGC-001 (Fusion Ontology), RFC-002 (TSG.4 Data Fusion Mathematics)
```

> **Purpose**: Deep technical research into two foundational capabilities referenced
> in the Fusion Ontology (TSGC-001, Sections 5.2 and 5.3): multi-target tracking
> algorithms mapped to d2ts differential dataflow operators, and fuzzy identity
> resolution for dirty/ambiguous identifier namespaces at streaming scale.

---

## Table of Contents

- [Part I: RI-1 — Multi-Target Tracking Algorithms for d2ts](#part-i-ri-1--multi-target-tracking-algorithms-for-d2ts)
  - [1. Problem Statement](#1-problem-statement)
  - [2. Kalman Filter Foundations](#2-kalman-filter-foundations)
  - [3. The Data Association Problem](#3-the-data-association-problem)
  - [4. Gating Strategies](#4-gating-strategies)
  - [5. Global Nearest Neighbor (GNN)](#5-global-nearest-neighbor-gnn)
  - [6. Joint Probabilistic Data Association (JPDA)](#6-joint-probabilistic-data-association-jpda)
  - [7. Multiple Hypothesis Tracking (MHT)](#7-multiple-hypothesis-tracking-mht)
  - [8. Track Initiation and Termination](#8-track-initiation-and-termination)
  - [9. Track-to-Track Fusion](#9-track-to-track-fusion)
  - [10. Mapping to d2ts Operators](#10-mapping-to-d2ts-operators)
  - [11. Differential Dataflow Implications](#11-differential-dataflow-implications)
  - [12. RI-1 Decision Matrix](#12-ri-1-decision-matrix)
  - [13. RI-1 Performance Estimates](#13-ri-1-performance-estimates)
- [Part II: RI-2 — Fuzzy Identity Resolution at Scale](#part-ii-ri-2--fuzzy-identity-resolution-at-scale)
  - [14. Problem Statement](#14-problem-statement)
  - [15. String Similarity Metrics](#15-string-similarity-metrics)
  - [16. Phonetic Encoding](#16-phonetic-encoding)
  - [17. Embedding-Based Similarity](#17-embedding-based-similarity)
  - [18. Numeric ID Fuzzy Matching](#18-numeric-id-fuzzy-matching)
  - [19. Pre-Filtering and Blocking](#19-pre-filtering-and-blocking)
  - [20. Known Alias Management](#20-known-alias-management)
  - [21. Integration with d2ts](#21-integration-with-d2ts)
  - [22. RI-2 Decision Matrix](#22-ri-2-decision-matrix)
  - [23. RI-2 Performance Estimates](#23-ri-2-performance-estimates)
- [Part III: Effect Schema Types](#part-iii-effect-schema-types)
- [Part IV: References](#part-iv-references)

---

# Part I: RI-1 — Multi-Target Tracking Algorithms for d2ts

## 1. Problem Statement

The Fusion Ontology (TSGC-001, Section 5.2) identifies a critical challenge: when
two sensor systems observe the same entity class but assign independent track
identifiers, no shared key exists for a deterministic join. Radar A assigns track
#447 to an aircraft; Radar B assigns track #1203 to the same aircraft. The system
must determine that these tracks refer to the same physical object.

This is the **multi-target tracking (MTT) data association problem** — one of
the oldest and most studied problems in signal processing, with roots in Cold War
radar surveillance systems dating to the 1960s.

### 1.1 Why This Matters for Tsingou

In the Tsingou context, we face this problem across multiple signal domains:

| Scenario | Source A | Source B | Shared ID? |
|----------|----------|----------|------------|
| Multi-radar aircraft | Radar A track #447 | Radar B track #1203 | No |
| ADS-B + radar | ICAO A4F2B7 | Radar track #892 | No (different namespace) |
| Multi-SDR emitter | SDR-1 bearing cluster | SDR-2 bearing cluster | No |
| AIS + radar vessel | MMSI 211900000 | Radar track #56 | No (different namespace) |
| Multi-OSINT entity | Source A "APT-29" | Source B "Cozy Bear" | No (alias) |

Each scenario requires associating observations across independent sensor-local
identifier namespaces to maintain a unified track picture. The algorithms differ
in how they handle ambiguity, computational cost, and optimality guarantees.

### 1.2 Constraints from d2ts

Unlike traditional radar tracking systems that process measurements scan-by-scan
in a tight loop, Tsingou processes signals through d2ts differential dataflow.
This imposes specific constraints:

1. **Incremental computation** — When a new measurement arrives, only affected
   state should recompute, not the entire track picture
2. **Retraction semantics** — If a track association CHANGES (measurement
   reassigned from track A to track B), the old association must be retracted
   and the new one inserted. d2ts handles this via `(value, +1)` / `(value, -1)`
   difference pairs
3. **Partial ordering** — d2ts timestamps are partially ordered, not totally
   ordered. Track state must be indexed by these partial timestamps
4. **Deterministic replay** — The same input sequence must produce the same
   output, enabling auditability for SIGINT provenance

These constraints shape which algorithms are viable and how they must be adapted.

---

## 2. Kalman Filter Foundations

Every tracking algorithm in this research builds on the Kalman filter as its
state estimation engine. Understanding the predict/update cycle is prerequisite
to understanding data association.

### 2.1 State Vector

A tracked entity's state is a vector capturing kinematic properties:

```
x = [px, py, vx, vy, ax, ay]^T

Where:
  px, py  = position (latitude, longitude or local Cartesian)
  vx, vy  = velocity components
  ax, ay  = acceleration components (optional, for maneuvering targets)
```

For maritime/aviation tracking, altitude/depth may be added:

```
x = [px, py, pz, vx, vy, vz]^T
```

### 2.2 Prediction Step

Given state estimate x_hat(k|k) and covariance P(k|k) at time k, predict to
time k+1:

```
State prediction:
  x_hat(k+1|k) = F * x_hat(k|k) + B * u(k)

Covariance prediction:
  P(k+1|k) = F * P(k|k) * F^T + Q

Where:
  F = state transition matrix (constant velocity or constant acceleration model)
  B = control input matrix (usually zero for passive tracking)
  u = control input (usually zero)
  Q = process noise covariance (models uncertainty in motion model)
```

For a constant-velocity model with time step dt:

```
F = | 1  0  dt  0 |
    | 0  1  0  dt |
    | 0  0  1   0 |
    | 0  0  0   1 |
```

### 2.3 Innovation (Measurement Residual)

When measurement z(k+1) arrives:

```
Innovation:
  y(k+1) = z(k+1) - H * x_hat(k+1|k)

Innovation covariance:
  S(k+1) = H * P(k+1|k) * H^T + R

Where:
  H = measurement matrix (maps state to measurement space)
  R = measurement noise covariance
  y = innovation vector (difference between observed and predicted)
  S = innovation covariance (uncertainty in the innovation)
```

### 2.4 Update Step

```
Kalman gain:
  K(k+1) = P(k+1|k) * H^T * S(k+1)^(-1)

State update:
  x_hat(k+1|k+1) = x_hat(k+1|k) + K(k+1) * y(k+1)

Covariance update:
  P(k+1|k+1) = (I - K(k+1) * H) * P(k+1|k)
```

The Kalman gain K balances trust between the prediction and the measurement.
When measurement noise R is small relative to prediction uncertainty P, the
gain is large (trust the measurement). When R is large, the gain is small
(trust the prediction).

### 2.5 Why This Matters for Data Association

The data association problem asks: **which measurement z(k+1) belongs to which
track?** The innovation y and innovation covariance S from the Kalman filter
provide the statistical basis for answering this question. Measurements that
produce small innovations (relative to S) are likely from the tracked target.
Measurements with large innovations are likely clutter or from a different target.

This statistical distance is formalized as the **Mahalanobis distance**:

```
d^2 = y^T * S^(-1) * y
```

The Mahalanobis distance follows a chi-squared distribution with degrees of
freedom equal to the measurement dimension. This provides a principled threshold
for deciding whether a measurement "belongs" to a track.

---

## 3. The Data Association Problem

### 3.1 Formal Statement

Given:
- A set of **T** existing tracks, each with predicted state and covariance
- A set of **M** new measurements from the current scan
- Knowledge that some measurements may be clutter (false alarms)
- Knowledge that some tracks may not produce measurements (missed detections)

Find: The **assignment** of measurements to tracks that best explains the
observed data.

### 3.2 Assumptions

Standard assumptions in multi-target tracking:

1. **At-most-one**: Each measurement originates from at most one target
2. **At-most-one (reverse)**: Each target generates at most one measurement per scan
3. **Independence**: Clutter measurements are independent of target-generated
   measurements
4. **Known clutter model**: Clutter is Poisson-distributed with known spatial density

These assumptions define a **constraint satisfaction problem**: find a valid
assignment (respecting the at-most-one constraints) that maximizes some
likelihood function.

### 3.3 Assignment Matrix

The problem can be represented as a binary assignment matrix A where:

```
A[i][j] = 1  if measurement j is assigned to track i
A[i][j] = 0  otherwise

Subject to:
  SUM_j(A[i][j]) <= 1  for all i  (each track gets at most one measurement)
  SUM_i(A[i][j]) <= 1  for all j  (each measurement assigned to at most one track)
```

The cost of assigning measurement j to track i is typically the negative
log-likelihood derived from the Mahalanobis distance:

```
c[i][j] = d^2(i,j) / 2 + ln(2*pi*det(S_i)) / 2
```

Unassigned measurements are treated as clutter; unassigned tracks coast
(predict without update).

---

## 4. Gating Strategies

Before solving the full assignment problem, **gating** eliminates implausible
measurement-to-track pairings. This reduces the effective size of the assignment
matrix from T*M to a much smaller number of candidates.

### 4.1 Ellipsoidal Gating (Mahalanobis)

The most principled gating strategy uses the Mahalanobis distance:

```
Measurement z passes the gate of track i if:
  d^2(i, z) = y_i^T * S_i^(-1) * y_i < gamma

Where:
  y_i = z - H * x_hat_i(k+1|k)   (innovation)
  S_i = innovation covariance for track i
  gamma = gate threshold from chi-squared distribution
```

The gate threshold gamma is chosen based on a desired gate probability P_G:

| Measurement Dimension | P_G = 0.90 | P_G = 0.95 | P_G = 0.99 |
|-----------------------|------------|------------|------------|
| 1D (range only)       | 2.71       | 3.84       | 6.63       |
| 2D (range + bearing)  | 4.61       | 5.99       | 9.21       |
| 3D (range + az + el)  | 6.25       | 7.81       | 11.34      |

The gate shape is an **ellipsoid** in measurement space, centered on the
predicted measurement, with shape determined by the innovation covariance S.
This is optimal because it accounts for correlated uncertainties — a track
moving fast has a larger gate in the direction of motion.

**Computational cost**: O(M * T * d^2) where d = measurement dimension.
Dominated by the matrix multiplication y^T * S^(-1) * y.

### 4.2 Rectangular Gating

A computationally cheaper alternative checks each measurement dimension
independently:

```
Measurement z passes the gate of track i if:
  |z_d - h_d(x_hat_i)| < kappa * sigma_d   for ALL dimensions d

Where:
  sigma_d = sqrt(S_i[d,d])  (marginal standard deviation)
  kappa = gate multiplier (typically 3-4)
```

This defines a rectangular region rather than an ellipsoid. It is **less tight**
than ellipsoidal gating (admits more false candidates) but faster to compute
because it avoids matrix inversion.

**Computational cost**: O(M * T * d) — linear in measurement dimension.

### 4.3 Hybrid Gating

In practice, systems often use a two-stage approach:

1. **Rectangular pre-gate** — Fast exclusion of obviously distant measurements
2. **Ellipsoidal fine gate** — Precise filtering of remaining candidates

This reduces the number of expensive Mahalanobis distance computations while
maintaining the statistical optimality of ellipsoidal gating for close candidates.

### 4.4 Gating as d2ts Join Predicates

In the Tsingou d2ts context, gating translates directly to **join predicates**:

```typescript
// d2ts: Rectangular pre-gate as spatial index lookup
const gatedPairs = tracks
  .map(t => [t.id, predictedPosition(t)] as [string, Geo])
  .join(
    measurements.map(m => [spatialKey(m.geo), m] as [string, Measurement]),
    (trackGeo, measurement) =>
      Math.abs(trackGeo.lat - measurement.geo.lat) < latTolerance &&
      Math.abs(trackGeo.lon - measurement.geo.lon) < lonTolerance
  )

// d2ts: Ellipsoidal fine gate on gated pairs
const associationCandidates = gatedPairs
  .filter(([trackId, track, measurement]) => {
    const innovation = computeInnovation(track, measurement)
    const mahalanobis = computeMahalanobis(innovation, track.S)
    return mahalanobis < gateThreshold
  })
```

The rectangular pre-gate maps naturally to a d2ts spatial join (using H3 cell
keys or geohash prefixes). The ellipsoidal fine gate is a filter on the join
output.

---

## 5. Global Nearest Neighbor (GNN)

### 5.1 Algorithm Overview

GNN finds the single best (most likely) assignment of measurements to tracks
at each scan. It solves a global optimization problem — unlike the simpler
"nearest neighbor" approach that greedily assigns each track to its closest
measurement, GNN considers all assignments simultaneously.

**Core idea**: Construct a cost matrix C where C[i][j] is the cost of assigning
measurement j to track i. Find the assignment that minimizes the total cost
subject to the one-to-one constraint.

### 5.2 Cost Matrix Construction

```
For each (track_i, measurement_j) pair that passes gating:

  c[i][j] = d^2_Mahalanobis(i,j) / 2 + ln(det(S_i)) / 2 - ln(P_D)

For unassigned tracks (missed detection):
  c[i, null] = -ln(1 - P_D)  (cost of track not detecting)

For unassigned measurements (clutter):
  c[null, j] = -ln(lambda_c)  (cost of measurement being clutter)

Where:
  P_D = detection probability (typically 0.8-0.99)
  lambda_c = clutter spatial density
```

### 5.3 Solving with the Hungarian (Munkres) Algorithm

The Hungarian algorithm solves the linear assignment problem (LAP) in polynomial
time:

```
Input:  Cost matrix C of size (T+M) x (T+M)  (padded with dummy rows/columns)
Output: Optimal assignment minimizing total cost

Time complexity: O(n^3) where n = max(T, M)
Space complexity: O(n^2)
```

The algorithm works on the augmented cost matrix that includes dummy assignments
for missed detections and clutter. The Munkres variant handles rectangular
matrices (T != M) directly.

**Performance benchmarks** (from literature):
- 50x50 matrix: < 1ms on modern hardware
- 200x200 matrix: ~10ms
- 1000x1000 matrix: ~500ms

For Tsingou, with typical scenarios of 10-100 tracks and 10-200 measurements
per scan, GNN via Hungarian algorithm runs well under 10ms.

### 5.4 Strengths and Weaknesses

| Aspect | Assessment |
|--------|------------|
| Optimality | Optimal for single-scan assignment |
| Computational cost | O(n^3) — fast for moderate n |
| Multi-scan | No history — each scan independent |
| Ambiguity handling | Commits to single assignment — no uncertainty |
| Clutter rejection | Via cost function, not probabilistic |
| Track swap | Vulnerable to track swaps in dense scenarios |

### 5.5 GNN Failure Mode: Track Swap

GNN's critical weakness is **track swapping** in dense target scenarios:

```
Time k:     Track A at (10, 20), Track B at (12, 22)
Time k+1:   Measurement 1 at (11, 21), Measurement 2 at (11.5, 21.5)

GNN assigns M1 -> A, M2 -> B  (or M1 -> B, M2 -> A)
The WRONG assignment gets committed. No recovery mechanism.
Next scan compounds the error.
```

This is why JPDA and MHT exist — they maintain probabilistic alternatives.

### 5.6 d2ts Implementation Pattern

```typescript
// GNN as a d2ts reduce + join pattern
// State: map of track_id -> TrackState
// Input: stream of measurements

const trackAssignments = measurements
  .map(m => [scanId(m), m] as [string, Measurement])
  .reduce((scanMeasurements) => {
    // Collect all measurements for this scan
    // Build cost matrix against current tracks
    // Solve Hungarian assignment
    // Emit (track_id, measurement) pairs
    const tracks = getCurrentTracks()
    const costMatrix = buildCostMatrix(tracks, scanMeasurements)
    const assignment = hungarian(costMatrix)
    return assignment.map(([trackId, measurement]) =>
      [trackId, { type: 'assigned', measurement }]
    )
  })

// Join assignments back to track state for Kalman update
const updatedTracks = trackState
  .join(trackAssignments, (state, assignment) => {
    if (assignment.type === 'assigned') {
      return kalmanUpdate(state, assignment.measurement)
    }
    return kalmanPredict(state)  // coast
  })
```

**Differential dataflow implication**: If a measurement is retracted (corrected
sensor data), GNN must re-solve the entire assignment for that scan. The
retraction of one measurement can cascade to reassign other measurements,
producing a chain of `(old_assignment, -1), (new_assignment, +1)` differences.

---

## 6. Joint Probabilistic Data Association (JPDA)

### 6.1 Algorithm Overview

JPDA extends GNN by maintaining **probabilistic** assignments rather than
committing to a single best assignment. Each measurement contributes to each
track in proportion to the probability that it originated from that track.

**Core idea**: Instead of asking "which measurement belongs to track i?",
ask "what is the probability that measurement j belongs to track i?" Then
update the track state using a weighted combination of all gated measurements.

### 6.2 Association Probability Computation

For each track i and gated measurement j:

```
Step 1: Compute individual likelihoods
  L[i][j] = N(z_j; H*x_hat_i, S_i) * P_D / lambda_c

  Where N(z; mu, S) is the multivariate normal density

Step 2: Enumerate all feasible joint events
  A feasible joint event theta is an assignment matrix satisfying:
    - Each measurement assigned to at most one track (or clutter)
    - Each track assigned at most one measurement (or missed)

Step 3: Compute probability of each joint event
  P(theta | Z) proportional to PRODUCT over all assignments in theta

Step 4: Compute marginal association probabilities
  beta[i][j] = SUM over all theta where track i is assigned to measurement j
               of P(theta | Z)

  beta[i][0] = probability that track i has no measurement (missed detection)
```

### 6.3 JPDA State Update

The track state is updated using the **combined innovation**:

```
Combined innovation for track i:
  y_combined_i = SUM_j(beta[i][j] * y[i][j])

  Where y[i][j] = z_j - H * x_hat_i  (innovation for measurement j)

State update:
  x_hat_i(k+1|k+1) = x_hat_i(k+1|k) + K_i * y_combined_i

Covariance update (spread of innovations):
  P_i(k+1|k+1) = beta[i][0] * P_i(k+1|k)
                + (1 - beta[i][0]) * P_kalman_i
                + P_spread_i

  Where P_spread_i accounts for the uncertainty in which measurement
  was the "true" one — the spread of the individual innovations
  weighted by their association probabilities.
```

### 6.4 Computational Complexity

The critical bottleneck is **enumerating all feasible joint events** in Step 2.
For T tracks and M measurements in a cluster, the number of feasible events
grows combinatorially:

```
Worst case: O(M! / (M-T)!) for a fully connected cluster

With gating reducing to average g measurements per track:
  O(g^T) — exponential in the number of tracks in a cluster
```

**Mitigation strategies**:

1. **Aggressive gating** — Reduce g to 2-3 measurements per track on average
2. **Cluster decomposition** — Independent clusters solved separately. If tracks
   A and B share no gated measurements, they form separate clusters
3. **K-best approximation** — Only enumerate the K most likely joint events
   instead of all feasible ones (using Murty's algorithm)
4. **Loopy belief propagation** — Approximate marginal probabilities without
   explicit enumeration

### 6.5 JPDA vs. GNN Comparison

| Criterion | GNN | JPDA |
|-----------|-----|------|
| Output | Single assignment | Probability distribution |
| Track swap resistance | Poor | Good (probabilities diffuse) |
| Computational cost | O(n^3) | O(g^T) per cluster |
| Implementation complexity | Moderate | High |
| Covariance consistency | Exact | Approximate (spread term) |
| Multi-modal targets | Cannot handle | Limited (single mode per track) |
| Clutter robustness | Cost function | Probabilistic model |

### 6.6 d2ts Implementation Pattern

```typescript
// JPDA as a d2ts reduce pattern
// Key insight: JPDA produces WEIGHTED updates, not hard assignments

const jpdaUpdates = measurements
  .map(m => [scanId(m), m] as [string, Measurement])
  .reduce((scanMeasurements) => {
    const tracks = getCurrentTracks()
    const clusters = clusterByGating(tracks, scanMeasurements)

    const results: Array<[string, JPDAUpdate]> = []

    for (const cluster of clusters) {
      // Compute association probabilities for this cluster
      const betas = computeAssociationProbabilities(cluster)

      for (const track of cluster.tracks) {
        const combinedInnovation = computeCombinedInnovation(
          track, cluster.measurements, betas[track.id]
        )
        const spreadCovariance = computeSpreadCovariance(
          track, cluster.measurements, betas[track.id]
        )
        results.push([track.id, {
          combinedInnovation,
          spreadCovariance,
          missedProbability: betas[track.id][0],
        }])
      }
    }
    return results
  })

// Apply JPDA updates to track state
const updatedTracks = trackState
  .join(jpdaUpdates, (state, update) =>
    kalmanUpdateJPDA(state, update)
  )
```

**Differential dataflow implication**: JPDA's probabilistic nature makes
retractions more complex. Retracting a single measurement requires recomputing
ALL association probabilities in its cluster, because marginal probabilities
depend on the full joint event space. The retraction of measurement j affects
the update of EVERY track in j's cluster, not just the track j was most likely
associated with.

---

## 7. Multiple Hypothesis Tracking (MHT)

### 7.1 Algorithm Overview

MHT is the theoretically optimal Bayesian solution to multi-target data
association. Instead of committing to a single assignment (GNN) or averaging
over assignments (JPDA), MHT **maintains multiple hypotheses** about the full
assignment history across multiple scans.

**Core idea**: Defer the hard assignment decision. Maintain a tree of hypotheses
where each branch represents a different track-to-measurement assignment history.
As more data arrives, implausible hypotheses are pruned and the surviving
hypotheses converge toward the truth.

### 7.2 Hypothesis Tree Structure

```
Scan k:
  H1: {A->m1, B->m2, m3=clutter}        P(H1) = 0.45
  H2: {A->m2, B->m1, m3=clutter}        P(H2) = 0.30
  H3: {A->m1, B->m3, m2=new_track}      P(H3) = 0.15
  H4: {A->m3, B->m2, m1=new_track}      P(H4) = 0.10

Scan k+1: Each hypothesis spawns children for new measurement assignments
  H1 spawns H1.1, H1.2, H1.3, ...
  H2 spawns H2.1, H2.2, H2.3, ...
  ...

Total hypotheses grow EXPONENTIALLY: O(H_parent * M^T) per scan
```

### 7.3 Hypothesis Probability

Each hypothesis is scored by the product of its constituent assignment
likelihoods across all scans:

```
P(H) proportional to PRODUCT over scans of:
  PRODUCT over assigned pairs (i,j) of:
    N(z_j; H*x_hat_i, S_i) * P_D
  * PRODUCT over missed tracks of:
    (1 - P_D)
  * PRODUCT over clutter measurements of:
    lambda_c
```

### 7.4 Pruning Strategies

Without pruning, MHT is computationally intractable. Four pruning strategies
are standard:

**1. K-Best Pruning (Murty's Algorithm)**

Instead of enumerating ALL hypotheses, use Murty's algorithm to find only
the K most likely global hypotheses at each scan.

```
Murty's algorithm:
  Input: Cost matrix C, parameter K
  Output: K-best assignments in order of increasing cost

  1. Find optimal assignment A* using Hungarian algorithm
  2. Partition remaining solutions into mutually exclusive subproblems
  3. Solve each subproblem optimally
  4. Select next-best from solved subproblems
  5. Repeat until K assignments found

Time complexity: O(K * n^3) — K times the cost of Hungarian
```

Murty's algorithm is the key enabler for practical MHT. It replaces Reid's
original NP-hard exhaustive enumeration with polynomial-time K-best extraction.

**2. N-Scan Pruning**

Hypothesis tree is trimmed at depth N — all hypotheses are forced to agree
on assignments older than N scans:

```
N-scan pruning (N=3):
  At scan k, prune hypotheses that disagree on assignments from scan k-3.
  The "winning" assignment at scan k-3 is the one supported by the
  highest cumulative probability among surviving hypotheses at scan k.

Typical N: 3-5 scans
Trade-off: Smaller N = faster, less optimal. Larger N = slower, closer to optimal.
```

**3. Probability Threshold Pruning**

Remove any hypothesis whose probability falls below a threshold:

```
Prune H if P(H) / P(H_best) < threshold

Typical threshold: 0.01 (1% of best hypothesis)
```

**4. Maximum Hypothesis Count**

Hard cap on total hypotheses. When exceeded, remove lowest-probability
hypotheses until under the cap:

```
Typical caps: 100-1000 hypotheses per cluster
```

### 7.5 MHT vs. GNN vs. JPDA

| Criterion | GNN | JPDA | MHT |
|-----------|-----|------|-----|
| Theoretical basis | Single-scan optimal | Single-scan Bayesian | Multi-scan Bayesian optimal |
| Track swap | Vulnerable | Resistant | Immune (hypotheses cover both) |
| New track detection | Heuristic | Heuristic | Integral (hypothesis branch) |
| Computational cost | O(n^3) | O(g^T) | O(K*n^3) per scan |
| Memory | O(T) | O(T) | O(H*T) where H = num hypotheses |
| Implementation | Simple | Moderate | Complex |
| Latency | Low (1 scan) | Low (1 scan) | Higher (N-scan lookback) |
| Recommended for | Low density, real-time | Moderate density | High density, best accuracy |

### 7.6 d2ts Implementation Pattern

```typescript
// MHT as a d2ts reduce with versioned state
// Key insight: hypotheses are ALTERNATIVE STATES, each a complete track picture

const mhtHypotheses = measurements
  .map(m => [scanId(m), m] as [string, Measurement])
  .reduce((scanMeasurements) => {
    const currentHypotheses = getHypotheses()

    const newHypotheses: Hypothesis[] = []

    for (const parentHyp of currentHypotheses) {
      // Generate K-best child hypotheses using Murty's
      const costMatrix = buildCostMatrix(parentHyp.tracks, scanMeasurements)
      const kBest = murty(costMatrix, K_BEST_COUNT)

      for (const assignment of kBest) {
        const childHyp = applyAssignment(parentHyp, assignment, scanMeasurements)
        childHyp.probability = parentHyp.probability * assignmentLikelihood(assignment)
        newHypotheses.push(childHyp)
      }
    }

    // Normalize probabilities
    const totalProb = newHypotheses.reduce((s, h) => s + h.probability, 0)
    for (const h of newHypotheses) h.probability /= totalProb

    // Prune
    const pruned = newHypotheses
      .filter(h => h.probability > PROB_THRESHOLD)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, MAX_HYPOTHESES)

    // N-scan pruning: extract confirmed assignments
    const confirmed = nScanPrune(pruned, N_SCAN_DEPTH)

    return [
      ...confirmed.map(c => [c.trackId, { type: 'confirmed', state: c.state }]),
      ...pruned.map((h, i) => [`hyp_${i}`, { type: 'hypothesis', hypothesis: h }]),
    ]
  })
```

**Differential dataflow implication**: MHT is the most natural fit for d2ts
because its multi-hypothesis nature aligns with d2ts's ability to maintain
alternative states. When a measurement is retracted, only hypotheses that
included that measurement need updating. Hypotheses that assigned the
measurement to clutter are unaffected. This provides natural "undo" semantics.

---

## 8. Track Initiation and Termination

### 8.1 Track Initiation

When measurements cannot be assigned to any existing track, they may represent
new targets. Two standard approaches exist for promoting tentative tracks:

**M-of-N Logic (History-Based)**

```
A tentative track is CONFIRMED if:
  At least M measurements are associated in the last N scans

A tentative track is DELETED if:
  Fewer than M measurements in N scans

Typical values:
  M=3, N=5  (3 hits in 5 scans — moderate confidence)
  M=2, N=3  (2 hits in 3 scans — fast confirmation, higher false track rate)
  M=4, N=5  (4 hits in 5 scans — conservative, lower false track rate)
```

Properties:
- Simple to implement — binary counter
- No sensor model required
- Fixed latency: N scans to confirm
- No adaptation to environment (same threshold in clear and cluttered)

**Score-Based Logic (SPRT-Based)**

```
Track score S evolves with each scan:
  Hit:  S(k+1) = S(k) + ln(P_D * L / lambda_c)
  Miss: S(k+1) = S(k) + ln(1 - P_D)

Where:
  L = likelihood of assigned measurement
  lambda_c = clutter density
  P_D = detection probability

CONFIRM when: S > S_confirm
DELETE  when: S - S_max < S_delete

Typical thresholds:
  S_confirm = 20-40  (varies by application)
  S_delete  = -10    (relative to maximum score achieved)
```

Properties:
- Adapts to measurement quality (high-likelihood hits count more)
- Adapts to clutter density (denser clutter requires more evidence)
- Variable confirmation latency (fast in easy conditions, slow in hard)
- Requires sensor model (P_D, lambda_c)

### 8.2 Track Termination

Tracks are terminated when evidence suggests the target has left the
surveillance volume or is no longer detectable:

```
M-of-N deletion:
  Delete if fewer than M_del detections in last N_del scans
  Typical: M_del=0, N_del=5 (5 consecutive misses)

Score-based deletion:
  Delete when S - S_max < S_delete_threshold
  The track score drops relative to its historical maximum
```

### 8.3 MHT-Integrated Initiation

In MHT, track initiation is part of the hypothesis framework:

```
For each unassigned measurement:
  Create hypothesis branch where measurement starts a new track
  Create hypothesis branch where measurement is clutter

Both branches compete on probability over subsequent scans.
False tracks are naturally pruned when their hypothesis probability
drops below threshold.
```

This is MHT's key advantage for track initiation — there is no separate
initiation logic. New tracks and false alarms are handled by the same
Bayesian machinery.

### 8.4 d2ts Implementation Pattern

```typescript
// Track lifecycle management in d2ts

const TrackStatus = Schema.Literal('tentative', 'confirmed', 'coasting', 'deleted')

// M-of-N initiation as a reduce with sliding window
const trackLifecycle = trackUpdates
  .reduce((updates) => {
    const hitHistory = getHitHistory(updates, N_WINDOW)
    const hitCount = hitHistory.filter(h => h.detected).length

    const currentStatus = getTrackStatus(updates)
    let newStatus = currentStatus

    if (currentStatus === 'tentative') {
      if (hitCount >= M_CONFIRM) newStatus = 'confirmed'
      else if (hitHistory.length >= N_WINDOW && hitCount < M_DELETE)
        newStatus = 'deleted'
    } else if (currentStatus === 'confirmed') {
      const consecutiveMisses = countConsecutiveMisses(hitHistory)
      if (consecutiveMisses >= MAX_COAST) newStatus = 'deleted'
      else if (consecutiveMisses > 0) newStatus = 'coasting'
      else newStatus = 'confirmed'
    }

    return [[updates[0].trackId, { status: newStatus, hitCount, hitHistory }]]
  })
```

---

## 9. Track-to-Track Fusion

### 9.1 The Problem

When multiple tracking systems (each running their own Kalman filters and
data association) produce independent track lists, these must be fused into
a single unified track picture. This is **track-to-track fusion** — distinct
from measurement-to-track association.

### 9.2 Federated vs. Centralized Architecture

**Centralized Fusion**

All raw measurements from all sensors are sent to a single tracker that
performs data association and state estimation globally.

```
Sensor 1 --measurements--> |                    |
Sensor 2 --measurements--> | Central Tracker    | --> Global tracks
Sensor 3 --measurements--> |                    |
```

- Theoretically optimal (uses all available information)
- Requires high communication bandwidth (raw measurements)
- Single point of failure
- Computationally expensive at the center

**Federated (Track-Level) Fusion**

Each sensor runs its own tracker locally. Local tracks are sent to a fusion
center that associates and merges them.

```
Sensor 1 --> Local Tracker 1 --tracks--> |                  |
Sensor 2 --> Local Tracker 2 --tracks--> | Fusion Center    | --> Global tracks
Sensor 3 --> Local Tracker 3 --tracks--> |                  |
```

- Suboptimal (local trackers discard information)
- Lower bandwidth (tracks << measurements)
- Fault tolerant (local trackers continue independently)
- Scalable (add sensors without redesigning central tracker)

### 9.3 Cross-Covariance Problem

The critical challenge in track-to-track fusion: **local track estimates are
correlated** because they observe the same targets with correlated process noise.
Naive fusion (treating local tracks as independent) produces overconfident
estimates.

```
WRONG: Fused state = (P1^(-1) + P2^(-1))^(-1) * (P1^(-1)*x1 + P2^(-1)*x2)
  (Assumes independence — overconfident by a factor that grows with correlation)

CORRECT: Must account for cross-covariance P12 between local estimates
  Fused state uses:
    P_fused^(-1) = P1^(-1) + P2^(-1) - P12^(-1)  (information subtraction)
```

When cross-covariance is unknown (common in practice), conservative approaches
apply:

- **Covariance intersection** — Convex combination that guarantees consistency
  regardless of unknown correlation
- **Largest ellipsoid** — Use the larger of the two covariance estimates
- **Federated Kalman filter** — Partition process noise among local filters
  to ensure decorrelation

### 9.4 Relevance to Tsingou

In Tsingou's architecture, track-to-track fusion applies when:

- Multiple radar systems report independent track lists
- ADS-B and radar both track aircraft (different state estimation pipelines)
- Multiple SDR direction-finding arrays produce independent bearing tracks
- OSINT collectors produce independent entity lists from different sources

The fusion ontology (TSGC-001) routes these through appropriate join paths.
The federated architecture maps naturally to d2ts: each sensor pipeline is an
independent d2ts subgraph feeding into a fusion join.

---

## 10. Mapping to d2ts Operators

### 10.1 Operator Mapping Summary

| Tracking Concept | d2ts Operator | Notes |
|-----------------|---------------|-------|
| Measurement gating | `.join()` with spatial key + filter | H3 cell for spatial pre-gate |
| Cost matrix construction | `.map()` on join output | Mahalanobis distance per pair |
| GNN assignment | `.reduce()` with Hungarian solver | Per-scan batch operation |
| JPDA probabilities | `.reduce()` with enumeration/BP | Per-cluster computation |
| MHT hypothesis management | `.reduce()` with versioned state | Hypothesis tree as state |
| Kalman predict | `.map()` on track state | Pure function, no side effects |
| Kalman update | `.join()` of track state + assignment | State transition on matched pair |
| Track initiation | `.reduce()` on unassigned measurements | M-of-N or score accumulator |
| Track termination | `.reduce()` on track hit/miss history | Sliding window evaluator |
| Track-to-track fusion | `.join()` on spatial key across sources | Covariance intersection |

### 10.2 Complete d2ts Pipeline

```typescript
// ============================================================
// COMPLETE MULTI-TARGET TRACKING PIPELINE IN d2ts
// ============================================================

import { D2 } from '@electric-sql/d2ts'

// --- Types ---
interface TrackState {
  readonly id: string
  readonly x: Float64Array      // state vector [px, py, vx, vy]
  readonly P: Float64Array      // covariance (flattened 4x4)
  readonly status: 'tentative' | 'confirmed' | 'coasting' | 'deleted'
  readonly score: number
  readonly hitHistory: ReadonlyArray<boolean>
  readonly lastUpdate: number
}

interface Measurement {
  readonly id: string
  readonly sensorId: string
  readonly geo: { lat: number; lon: number }
  readonly timestamp: number
  readonly raw: Float64Array     // measurement vector
  readonly R: Float64Array       // measurement noise covariance
}

interface Assignment {
  readonly trackId: string
  readonly measurementId: string | null  // null = missed detection
  readonly cost: number
}

// --- Stage 1: Spatial Pre-Gating via H3 Join ---
function spatialPreGate(
  tracks: D2Collection<[string, TrackState]>,
  measurements: D2Collection<[string, Measurement]>,
  h3Resolution: number
): D2Collection<[string, { track: TrackState; measurement: Measurement }]> {
  const tracksByH3 = tracks.map(([id, t]) => {
    const predicted = kalmanPredict(t)
    const h3Key = geoToH3(predicted.x[0], predicted.x[1], h3Resolution)
    return [h3Key, { ...predicted, originalId: id }] as const
  })

  const measurementsByH3 = measurements.map(([id, m]) => {
    const h3Key = geoToH3(m.geo.lat, m.geo.lon, h3Resolution)
    return [h3Key, m] as const
  })

  // H3 cell match = spatial proximity within resolution
  return tracksByH3.join(measurementsByH3, (track, measurement) => ({
    track: track as TrackState,
    measurement,
  }))
}

// --- Stage 2: Ellipsoidal Fine Gating ---
function ellipsoidalGate(
  candidates: D2Collection<[string, { track: TrackState; measurement: Measurement }]>,
  gateThreshold: number
): D2Collection<[string, { track: TrackState; measurement: Measurement; mahalanobis: number }]> {
  return candidates
    .map(([key, { track, measurement }]) => {
      const innovation = computeInnovation(track, measurement)
      const S = computeInnovationCovariance(track, measurement)
      const d2 = mahalanobisDistance(innovation, S)
      return [key, { track, measurement, mahalanobis: d2 }] as const
    })
    .filter(([_, data]) => data.mahalanobis < gateThreshold)
}

// --- Stage 3: Data Association (GNN / JPDA / MHT) ---
function gnnAssociation(
  gatedPairs: D2Collection<[string, GatedPair]>,
  config: { algorithm: 'gnn' | 'jpda' | 'mht' }
): D2Collection<[string, Assignment]> {
  return gatedPairs
    .map(([scanKey, pair]) => [scanKey, pair] as const)
    .reduce((pairs) => {
      // Group by scan, build cost matrix, solve
      const costMatrix = buildCostMatrix(pairs)

      switch (config.algorithm) {
        case 'gnn':
          return solveHungarian(costMatrix)
        case 'jpda':
          return solveJPDA(costMatrix)
        case 'mht':
          return solveMHT(costMatrix)
      }
    })
}

// --- Stage 4: Track State Update ---
function updateTracks(
  trackState: D2Collection<[string, TrackState]>,
  assignments: D2Collection<[string, Assignment]>
): D2Collection<[string, TrackState]> {
  return trackState.join(
    assignments,
    (state, assignment) => {
      if (assignment.measurementId === null) {
        // Missed detection — coast
        return kalmanPredict(state)
      }
      // Assigned — Kalman update
      const measurement = getMeasurement(assignment.measurementId)
      return kalmanUpdate(state, measurement)
    },
    'left'  // Left join: all tracks, even unassigned
  )
}
```

---

## 11. Differential Dataflow Implications

### 11.1 Retraction Semantics for Track Association

The defining feature of differential dataflow is **retraction**: when input
data changes, the system computes the minimal set of output changes. For
tracking, this has profound implications:

**Scenario: Measurement correction**

```
Time T1: Sensor reports measurement m1 at position (10.0, 20.0)
  -> GNN assigns m1 to track A
  -> Track A updated with m1

Time T2: Sensor corrects m1 to position (10.5, 20.5)
  -> d2ts processes:
     1. Retract (m1_old, -1)
     2. Insert (m1_corrected, +1)
  -> GNN re-solves assignment for the affected scan
  -> If assignment changes (m1 now assigned to track B):
     3. Retract (track_A_updated_with_m1, -1)
     4. Insert (track_A_coasted, +1)
     5. Retract (track_B_coasted, -1)
     6. Insert (track_B_updated_with_m1, +1)
```

The cascade is bounded by the cluster scope — only tracks that shared gated
measurements with m1 are affected.

### 11.2 Incremental Cost Matrix Updates

When a single measurement changes, the cost matrix need not be rebuilt from
scratch:

```
Original cost matrix C:
  C[i][j] = mahalanobis(track_i, measurement_j)

If measurement j' changes:
  Only column j' of C needs recomputation
  The Hungarian algorithm must re-solve, but the other columns provide
  warm-start information
```

d2ts's `reduce` operator with keyed state tracks which inputs have changed,
enabling this selective recomputation.

### 11.3 State Accumulation and Versioning

Track state accumulates over time — each Kalman update depends on the previous
state. In d2ts, this is modeled as a `reduce` with state accumulation:

```
Track state at time k depends on:
  - Initial state (from track initiation)
  - All assigned measurements from time 0 to k
  - The ORDER of assignments (Kalman filter is not commutative over time)

d2ts maintains this as a versioned collection indexed by partially ordered
timestamps. Changes to early measurements cascade through all subsequent
state updates.
```

For large track histories, this cascade can be expensive. Mitigation:

1. **Checkpointing** — Periodically snapshot track state, only replay from
   last checkpoint
2. **Bounded lookback** — Only allow corrections within a time window
3. **Approximation** — For old corrections, apply a covariance inflation
   factor instead of exact replay

### 11.4 Summary of d2ts Fit

| Algorithm | d2ts Fit | Retraction Cost | Memory |
|-----------|----------|-----------------|--------|
| GNN | Good — `.reduce()` per scan | Moderate — rescan re-solve | Low |
| JPDA | Moderate — cluster recompute | High — full cluster recompute | Moderate |
| MHT | Natural — hypothesis = alternative state | Low — only affected hypotheses | High |

---

## 12. RI-1 Decision Matrix

### When to Use Which Algorithm

| Scenario | Recommended | Rationale |
|----------|-------------|-----------|
| < 20 tracks, low clutter | GNN | Fast, simple, sufficient |
| 20-100 tracks, moderate clutter | JPDA | Handles ambiguity without hypothesis explosion |
| > 100 tracks, high clutter | MHT (K-best) | Best accuracy, manageable with pruning |
| Real-time constraint < 5ms | GNN | Guaranteed O(n^3) |
| Real-time constraint < 50ms | JPDA or GNN | JPDA with aggressive gating |
| Offline/batch analysis | MHT | No real-time constraint, maximum accuracy |
| Dense target crossing | MHT or JPDA | GNN will swap tracks |
| Single sensor, cooperative targets | GNN | Targets have IDs, association is easy |
| Multi-sensor, non-cooperative | MHT | Maximum ambiguity, need full hypothesis space |

### Tsingou Recommendation

For Tsingou's initial implementation:

1. **Start with GNN** — Simplest to implement in d2ts, covers 80% of scenarios
2. **Add JPDA for dense scenarios** — When operator activates high-density mode
3. **MHT as research target** — For offline analysis and high-value tracks
4. **Algorithm selection per cluster** — Different clusters can use different
   algorithms based on density

---

## 13. RI-1 Performance Estimates

### Throughput at Scale

| Scale | Tracks | Measurements/scan | GNN Latency | JPDA Latency | MHT Latency |
|-------|--------|-------------------|-------------|--------------|-------------|
| Small | 10 | 20 | < 1ms | < 5ms | < 10ms |
| Medium | 50 | 100 | ~5ms | ~50ms | ~100ms |
| Large | 200 | 500 | ~50ms | ~500ms | ~1s |
| Very Large | 1000 | 2000 | ~500ms | Intractable* | ~5s (K=50) |

*JPDA at very large scale requires aggressive gating + cluster decomposition.
With clusters of average size 5-10 tracks, latency drops to ~100ms.

### Signals/Second Mapping

Assuming 1-second scan intervals:

| Rate | Tracks | Algorithm | Feasibility |
|------|--------|-----------|-------------|
| 1k signals/sec | ~50 tracks | GNN | Trivial |
| 10k signals/sec | ~200 tracks | GNN or JPDA | Feasible |
| 100k signals/sec | ~1000 tracks | GNN only, batched | Requires cluster decomposition |

At 100k signals/sec, the system must batch measurements into scan windows
(e.g., 100ms windows of 10k measurements each) and decompose into spatial
clusters before running association. This maps naturally to d2ts's windowed
reduce operators.

---

# Part II: RI-2 — Fuzzy Identity Resolution at Scale

## 14. Problem Statement

The Fusion Ontology (TSGC-001, Section 5.3) identifies a critical failure mode:
identifiers that SHOULD match but DON'T due to data quality issues. An AIS
transponder reports MMSI 211900000; an intelligence database records the same
vessel as MMSI 211900001. A single digit difference — typo, equipment error,
or deliberate spoofing.

Fuzzy identity resolution bridges this gap by determining that two similar-but-
not-identical identifiers likely refer to the same entity, with quantified
confidence.

### 14.1 Why This Matters for Tsingou

| Scenario | ID A | ID B | Discrepancy | Root Cause |
|----------|------|------|-------------|------------|
| MMSI typo | 211900000 | 211900001 | 1 digit | Data entry error |
| Vessel name variant | "MAERSK ALABAMA" | "MAERSK ALABAMA I" | Suffix | Vessel renamed |
| Callsign format | "D5BK7" | "D5-BK-7" | Punctuation | Format variation |
| ICAO alias | A4F2B7 | N/A | Missing | Not in database |
| IP address NAT | 10.0.0.1 | 192.168.1.1 | Different | NAT traversal |
| Person name | "Mohammed al-Rahman" | "Mohamed Al Rahman" | Transliteration | Romanization variant |
| Organization | "APT-29" | "Cozy Bear" | Alias | Different naming convention |

The system must handle ALL of these, at streaming speed, with quantified
confidence and without false merges.

### 14.2 Constraints

1. **Streaming** — Resolution must happen incrementally as signals arrive,
   not in batch
2. **Low latency** — < 10ms per resolution decision for Tier 1 augmentation
3. **Auditable** — Every fuzzy match must record the algorithm, score, and
   threshold used
4. **Configurable** — Operators tune thresholds per entity class and domain
5. **Reversible** — d2ts retraction semantics: if an alias table is corrected,
   all downstream fuzzy matches recompute

---

## 15. String Similarity Metrics

### 15.1 Levenshtein Distance

The **edit distance** — minimum number of single-character insertions, deletions,
or substitutions to transform string A into string B.

```
Algorithm: Dynamic programming on |A| x |B| matrix

levenshtein("MAERSK", "MAERKS") = 2
  MAERSK -> MAERKS (swap S and K = 2 operations)

levenshtein("211900000", "211900001") = 1
  Single substitution at last digit

Normalized similarity:
  sim(A, B) = 1 - levenshtein(A, B) / max(|A|, |B|)
```

**Properties**:
- Time complexity: O(m * n) where m, n = string lengths
- Space complexity: O(min(m, n)) with optimization
- Metric: Yes (satisfies triangle inequality)
- Good for: Fixed-length identifiers, short strings

**Performance at scale**:
- Single comparison: ~1 microsecond for 10-char strings
- Pairwise on 10k strings: 100M comparisons = ~100 seconds (too slow)
- Requires blocking/indexing to avoid O(n^2)

### 15.2 Damerau-Levenshtein Distance

Extends Levenshtein with **transposition** of adjacent characters as a single
operation. This matters because transposition is the most common human typing
error.

```
damerau_levenshtein("MAERSK", "MAERKS") = 1
  Single transposition (S,K -> K,S)

Compare: levenshtein("MAERSK", "MAERKS") = 2
  (substitute S->K, substitute K->S)
```

**Properties**:
- Time complexity: O(m * n) — same as Levenshtein
- Captures the most common error type (transposition ~80% of typos)
- Preferred over Levenshtein for human-entered data

### 15.3 Jaro-Winkler Similarity

Designed specifically for **name matching**. Emphasizes matching characters at
the beginning of strings (where names are least likely to have errors).

```
Step 1: Jaro similarity
  Match window: max(|A|, |B|) / 2 - 1
  m = number of matching characters (within window)
  t = number of transpositions / 2

  jaro(A, B) = (m/|A| + m/|B| + (m-t)/m) / 3

Step 2: Winkler bonus for common prefix
  p = length of common prefix (max 4)
  jaro_winkler(A, B) = jaro(A, B) + p * 0.1 * (1 - jaro(A, B))
```

**Examples**:

```
jaro_winkler("MOHAMMED", "MOHAMED") = 0.97
  Strong match — common prefix "MOHAM", minor variation

jaro_winkler("MARTHA", "MARHTA") = 0.96
  Transposition — still high similarity

jaro_winkler("SMITH", "JONES") = 0.0
  No match
```

**Properties**:
- Time complexity: O(m * n) but typically faster (early termination)
- Not a metric (does not satisfy triangle inequality)
- Biased toward prefix matches — ideal for names
- Range: 0.0 (no match) to 1.0 (exact match)

### 15.4 Hamming Distance

Only works on **equal-length strings**. Counts positions where characters differ.

```
hamming("211900000", "211900001") = 1
hamming("A4F2B7", "A4F2C7") = 1
hamming("ABCDEF", "ABCDEF") = 0
```

**Properties**:
- Time complexity: O(n) — the fastest metric
- Only for equal-length strings (common for structured identifiers)
- Ideal for: MMSI (9 digits), ICAO hex (6 chars), IP addresses

### 15.5 Comparison Matrix

| Metric | Time | Handles Transposition | Handles Length Diff | Best For |
|--------|------|----------------------|--------------------:|----------|
| Levenshtein | O(mn) | As 2 edits | Yes | General purpose |
| Damerau-Lev. | O(mn) | As 1 edit | Yes | Human-entered data |
| Jaro-Winkler | O(mn) | Weighted | Yes | Names, short strings |
| Hamming | O(n) | No (just differs) | No (equal length) | Fixed-format IDs |

### 15.6 Effect Schema Types

```typescript
import { Schema } from 'effect'

const StringSimilarityAlgorithm = Schema.Literal(
  'levenshtein',
  'damerau_levenshtein',
  'jaro_winkler',
  'hamming'
)

const StringSimilarityResult = Schema.TaggedStruct('StringSimilarityResult', {
  algorithm: StringSimilarityAlgorithm,
  stringA: Schema.String,
  stringB: Schema.String,
  rawDistance: Schema.Number,
  normalizedSimilarity: Schema.Number,  // 0.0 to 1.0
  threshold: Schema.Number,
  isMatch: Schema.Boolean,
  computeTimeUs: Schema.Number,  // microseconds
})
```

---

## 16. Phonetic Encoding

### 16.1 Why Phonetic Encoding?

String similarity metrics fail when names sound alike but are spelled
differently due to transliteration or language variation:

```
"Mohammed" vs "Muhammad" — Levenshtein = 3, but they're the SAME name
"Tchaikovsky" vs "Chaikovski" — Levenshtein = 4, same person
"Schmidt" vs "Smith" — Levenshtein = 4, same etymological origin
```

Phonetic encodings reduce names to their pronunciation, making sound-alike
names hash to the same code.

### 16.2 Soundex

The oldest phonetic algorithm (patented 1918, used by US Census).

```
Algorithm:
  1. Keep the first letter
  2. Replace consonants with digits:
     B,F,P,V -> 1    C,G,J,K,Q,S,X,Z -> 2
     D,T -> 3         L -> 4
     M,N -> 5         R -> 6
  3. Remove consecutive duplicates
  4. Remove vowels and H,W,Y
  5. Pad/truncate to first letter + 3 digits

soundex("Robert") = R163
soundex("Rupert") = R163  (match!)
soundex("Smith")  = S530
soundex("Schmidt") = S253  (no match — Soundex fails here)
```

**Limitations**:
- Fixed 4-character output — low discrimination
- English-centric consonant mapping
- Fails on non-English names
- High false positive rate for common codes

### 16.3 Metaphone

Improved phonetic encoding (Lawrence Philips, 1990) that considers letter
combinations and context:

```
Rules include:
  "GH" at end -> silent
  "KN" at start -> "N"
  "AE" -> "E"
  "PH" -> "F"
  "SCH" -> "SK"
  Context-dependent: "C" before "E","I" -> "S", otherwise "K"

metaphone("Schmidt") = "SXMTT"
metaphone("Smith")   = "SM0"    (still different, but closer)
```

**Properties**:
- Variable-length output — better discrimination than Soundex
- Handles more English phonetic rules
- Still English-centric

### 16.4 Double Metaphone

The state-of-the-art phonetic encoding (Lawrence Philips, 2000). Generates
TWO codes — primary and alternate — to handle names with multiple valid
pronunciations.

```
double_metaphone("Schmidt") = ("XMT", "SMT")
double_metaphone("Smith")   = ("SM0", "XMT")

Primary("Schmidt") != Primary("Smith")
BUT: Alternate("Schmidt") == Primary("Smith") -> MATCH!

double_metaphone("Tchaikovsky") = ("XKFSK", "TKFSK")
double_metaphone("Chaikovski")  = ("XKFSK", "KKFSK")

Primary matches! -> MATCH
```

**Properties**:
- Handles Slavic, Germanic, Celtic, Greek, French, Italian, Spanish, Chinese
  pronunciation rules
- Two codes capture pronunciation ambiguity
- Significantly fewer false positives than Soundex
- Recommended for general-purpose phonetic matching

### 16.5 NYSIIS (New York State Identification and Intelligence System)

Developed for law enforcement record matching (1970). Optimized for
multi-ethnic names common in New York.

```
Algorithm:
  1. Translate first characters: MAC -> MCC, KN -> NN, PH -> FF, etc.
  2. Translate last characters: EE -> Y, IE -> Y, DT/RT/RD/NT/ND -> D
  3. Core encoding preserves more vowel information than Soundex
  4. Variable-length output

nysiis("Mohammed") = "MANAD"
nysiis("Muhammad") = "MANAD"  (match!)
nysiis("Smith")    = "SNATH"
nysiis("Schmidt")  = "SNADT"  (close but not exact)
```

**Properties**:
- Better accuracy than Soundex for diverse names
- Preserves relative vowel positioning
- Variable-length output with good discrimination
- Recommended for: Street names, diverse ethnic names

### 16.6 Phonetic Encoding Comparison

| Algorithm | False Pos Rate | False Neg Rate | Multi-Language | Speed |
|-----------|---------------|---------------|----------------|-------|
| Soundex | High | Moderate | Poor | Very fast |
| Metaphone | Moderate | Moderate | Poor | Fast |
| Double Metaphone | Low | Low | Good | Moderate |
| NYSIIS | Moderate | Low | Moderate | Fast |

**Recommendation for Tsingou**: Use **Double Metaphone** as the primary phonetic
encoder, with NYSIIS as a secondary check for names that don't match on
Double Metaphone.

### 16.7 Effect Schema Types

```typescript
const PhoneticAlgorithm = Schema.Literal(
  'soundex',
  'metaphone',
  'double_metaphone',
  'nysiis'
)

const PhoneticEncoding = Schema.TaggedStruct('PhoneticEncoding', {
  algorithm: PhoneticAlgorithm,
  input: Schema.String,
  primaryCode: Schema.String,
  alternateCode: Schema.optionalWith(Schema.String, { default: () => '' }),
})

const PhoneticMatchResult = Schema.TaggedStruct('PhoneticMatchResult', {
  algorithm: PhoneticAlgorithm,
  nameA: Schema.String,
  nameB: Schema.String,
  encodingA: PhoneticEncoding,
  encodingB: PhoneticEncoding,
  matchType: Schema.Literal(
    'primary_primary',
    'primary_alternate',
    'alternate_primary',
    'alternate_alternate',
    'no_match'
  ),
  confidence: Schema.Number,
})
```

---

## 17. Embedding-Based Similarity

### 17.1 When String Metrics Fail

String similarity and phonetic encoding both operate on character-level
features. They fail when:

- Names are semantic aliases: "APT-29" vs "Cozy Bear" (Levenshtein = 11)
- Identifiers use different formats: "192.168.1.1" vs "c0a80101" (hex IP)
- Names are in different languages: "Moskva" vs "Moscow"

For these cases, **embedding-based similarity** maps identifiers to vector
space where semantic similarity is captured by geometric distance.

### 17.2 Locality-Sensitive Hashing (LSH)

LSH is not an embedding method itself but a technique for efficiently finding
similar items in a high-dimensional space. It hashes items such that similar
items collide with high probability and dissimilar items collide with low
probability.

**Core mechanism**:

```
For Jaccard similarity (set-based):
  1. Represent each item as a set of features (shingles/n-grams)
  2. Apply MinHash: k random permutations, take minimum hash per permutation
     -> Produces a signature of k values
     -> P(same MinHash) = Jaccard similarity of original sets
  3. Band the signature: divide k values into b bands of r rows each
     -> Two items are candidates if they agree on ALL r values in ANY band
     -> Probability of becoming candidates:
        P(candidate) = 1 - (1 - s^r)^b
        where s = true Jaccard similarity

Example tuning:
  k=100 signatures, b=20 bands, r=5 rows
  Similarity 0.5: P(candidate) = 1 - (1 - 0.5^5)^20 = 0.47
  Similarity 0.8: P(candidate) = 1 - (1 - 0.8^5)^20 = 1.00 (practically)
  Similarity 0.2: P(candidate) = 1 - (1 - 0.2^5)^20 = 0.006 (filtered out)
```

**Performance**:
- Signature computation: O(k * n) per item where n = number of features
- Candidate generation: O(items * b) hash lookups
- Comparison: Only candidate pairs are compared in detail
- At Uber's scale: Reduced fraud detection from 55 hours to 4 hours

### 17.3 MinHash for Identifier Sets

When entities have SETS of identifiers (a vessel has MMSI, name, callsign,
flag state), MinHash can match entities by the overlap of their identifier sets:

```
Entity A: {MMSI: 211900000, name: "MAERSK ALABAMA", callsign: "D5BK7", flag: "US"}
Entity B: {MMSI: 211900001, name: "MAERSK ALABAMA I", callsign: "D5BK7", flag: "US"}

As feature sets (with n-gram shingling on names):
  Set A: {mmsi:211900000, name:MAE, name:AER, name:ERS, ..., call:D5BK7, flag:US}
  Set B: {mmsi:211900001, name:MAE, name:AER, name:ERS, ..., call:D5BK7, flag:US}

Jaccard(A, B) = |A ∩ B| / |A ∪ B| ≈ 0.85
  (Most features overlap; only MMSI and a few name n-grams differ)
```

### 17.4 LSH for Streaming

In the Tsingou streaming context, LSH signatures can be maintained incrementally:

```
When a new signal arrives with identifier set F:
  1. Compute MinHash signature of F: O(k * |F|)
  2. Look up each band in hash tables: O(b) lookups
  3. For each candidate match, compute exact similarity: O(|F|)
  4. Report matches above threshold

Total per-signal: O(k * |F| + b + candidates * |F|)
Typical: < 1ms for k=100, |F|=10, b=20
```

### 17.5 Effect Schema Types

```typescript
const LSHConfig = Schema.TaggedStruct('LSHConfig', {
  numHashFunctions: Schema.Int.pipe(Schema.greaterThan(0)),  // k
  numBands: Schema.Int.pipe(Schema.greaterThan(0)),          // b
  rowsPerBand: Schema.Int.pipe(Schema.greaterThan(0)),       // r = k/b
  shingleSize: Schema.Int.pipe(Schema.greaterThan(0)),       // n-gram size
  similarityThreshold: Schema.Number.pipe(
    Schema.greaterThan(0), Schema.lessThanOrEqualTo(1)
  ),
})

const LSHSignature = Schema.TaggedStruct('LSHSignature', {
  entityId: Schema.String,
  signature: Schema.Array(Schema.Int),     // k hash values
  bands: Schema.Array(Schema.String),      // b band hashes
  featureCount: Schema.Int,
})

const LSHMatchResult = Schema.TaggedStruct('LSHMatchResult', {
  entityA: Schema.String,
  entityB: Schema.String,
  signatureSimilarity: Schema.Number,      // estimated Jaccard
  exactJaccard: Schema.Number,             // computed on candidate pair
  matchingBands: Schema.Int,
  isMatch: Schema.Boolean,
})
```

---

## 18. Numeric ID Fuzzy Matching

### 18.1 The Problem

Many identifiers in the SIGINT domain are numeric or alphanumeric with
structure: MMSI (9 digits), ICAO hex (6 hex chars), IP addresses (4 octets),
phone numbers (variable digits). These require specialized fuzzy matching that
understands their structure.

### 18.2 Modular Arithmetic Tolerance

For fixed-length numeric IDs, allow a tolerance of +/- delta:

```
MMSI fuzzy match:
  match(211900000, 211900001) = true   (|diff| = 1 <= delta)
  match(211900000, 211900010) = true   (|diff| = 10 <= delta)
  match(211900000, 212900000) = false  (|diff| = 1000000 > delta)

With delta = 10:
  Catches single-digit typos in any position
  False positive rate = (2*delta + 1) / 10^9 = 21 / 10^9 ≈ 0.000002%
```

**Structured tolerance**: Apply different tolerances to different parts of the ID:

```
MMSI = [MID (3 digits)] [Station ID (6 digits)]

MID (country code): delta = 0  (must match exactly)
Station ID: delta = 2  (allow minor typo)

This prevents matching vessels from different countries while
allowing station ID typos.
```

### 18.3 MMSI Validation

MMSI structure provides validation opportunities:

```
Format: MIDXXXXXX (9 digits)
  MID = Maritime Identification Digits (country code, range 201-775)
  XXXXXX = Station identifier (000000-999999)

Validation rules:
  1. Exactly 9 digits
  2. MID in range [201, 775] for ship stations
  3. Leading "00" = coast station
  4. Leading "0" (not "00") = group station
  5. Leading "111" = SAR aircraft
  6. Leading "970" = AIS SART
  7. Leading "972" = MOB device
  8. Leading "974" = EPIRB-AIS

Fuzzy match with validation:
  If both MMSIs have valid MIDs from the same country AND
  station IDs differ by <= delta AND
  no structural format mismatch ->
    High confidence fuzzy match
```

### 18.4 ICAO Hex Code Validation

```
Format: 6 hexadecimal characters (24-bit address)
  Range allocated by country block:
    US:   A00000 - AFFFFF
    UK:   400000 - 43FFFF
    DE:   3C0000 - 3FFFFF
    etc.

Validation:
  1. Exactly 6 hex characters
  2. Falls within allocated country block
  3. Not in reserved ranges (000000, FFFFFF)

Fuzzy match:
  Hamming distance on hex characters
  icao_fuzzy("A4F2B7", "A4F2C7") = 1 char differs
  Check both resolve to same country block
```

### 18.5 IP Address Fuzzy Matching

IP addresses have hierarchical structure that affects fuzzy matching:

```
Same /24 subnet:
  192.168.1.100 vs 192.168.1.101 -> very likely related
  (differ only in host portion)

Same /16 subnet:
  192.168.1.100 vs 192.168.2.100 -> possibly related
  (different subnet, same /16 block)

Different networks:
  192.168.1.100 vs 10.0.0.100 -> probably unrelated
  (different RFC1918 blocks)

Fuzzy match score:
  score = (32 - commonPrefixLength) / 32
  Weighted by whether the differing bits are in host or network portion
```

### 18.6 Effect Schema Types

```typescript
const NumericIdType = Schema.Literal('mmsi', 'icao_hex', 'ipv4', 'phone', 'generic_numeric')

const NumericFuzzyConfig = Schema.TaggedStruct('NumericFuzzyConfig', {
  idType: NumericIdType,
  maxHammingDistance: Schema.Int.pipe(Schema.greaterThanOrEqualTo(0)),
  maxAbsoluteDelta: Schema.Int.pipe(Schema.greaterThanOrEqualTo(0)),
  structuredTolerance: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Int }),
    { default: () => ({}) }
  ),
  requireSameCountry: Schema.Boolean,
  requireValidFormat: Schema.Boolean,
})

const NumericMatchResult = Schema.TaggedStruct('NumericMatchResult', {
  idType: NumericIdType,
  valueA: Schema.String,
  valueB: Schema.String,
  hammingDistance: Schema.Int,
  absoluteDelta: Schema.Number,
  structuralMatch: Schema.Boolean,
  countryMatch: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  formatValid: Schema.Struct({
    a: Schema.Boolean,
    b: Schema.Boolean,
  }),
  confidence: Schema.Number,
  assessment: Schema.Literal(
    'exact_match',
    'probable_typo',
    'format_variation',
    'possible_spoofing',
    'no_match'
  ),
})
```

---

## 19. Pre-Filtering and Blocking

### 19.1 The Quadratic Problem

Naive fuzzy matching is O(n^2) — every incoming identifier must be compared
against every known identifier. At 10k signals/second with 100k known
identifiers, that is 10^9 comparisons per second. Impossible.

**Blocking** reduces this to O(n * b) where b is the average block size,
typically 10-100.

### 19.2 Bloom Filter Pre-Filtering

Bloom filters provide space-efficient probabilistic set membership testing:

```
Structure:
  Bit array of size m
  k hash functions: h1, h2, ..., hk

Insert(x):
  Set bits h1(x), h2(x), ..., hk(x) to 1

Query(x):
  Return true if ALL bits h1(x), h2(x), ..., hk(x) are 1
  False positives possible; false negatives impossible

Optimal parameters:
  m = -n * ln(p) / (ln(2))^2    (bits needed for n items, FP rate p)
  k = (m/n) * ln(2)             (optimal hash functions)

Example for 100k identifiers, 1% FP rate:
  m = 958,506 bits ≈ 117 KB
  k = 7 hash functions
```

**Application to fuzzy matching**: Create bloom filters for character n-grams:

```
For identifier "211900000":
  2-grams: {21, 11, 19, 90, 00, 00, 00}
  Insert each into bloom filter

For query "211900001":
  2-grams: {21, 11, 19, 90, 00, 00, 01}
  Check each in bloom filter
  Match ratio: 6/7 = 0.86 -> CANDIDATE

For query "987654321":
  2-grams: {98, 87, 76, 65, 54, 43, 32, 21}
  Match ratio: 1/8 = 0.125 -> NOT CANDIDATE
```

### 19.3 Inverted Index Blocking

Map each identifier to blocking keys; only compare identifiers in the same block:

```
Standard Blocking:
  Key: first 3 characters of identifier
  "211900000" -> block "211"
  "211900001" -> block "211"  (same block -> compare)
  "212900000" -> block "212"  (different block -> skip)

Sorted Neighborhood:
  Sort all identifiers
  Slide window of size w
  Compare within window only
  "211900000", "211900001" are adjacent -> compare
  Window size w=10 covers up to 10 misorderings

Suffix Array Blocking:
  Generate all suffixes, sort, group by common prefix
  Catches matches regardless of where the typo occurs
```

### 19.4 Blocking Strategy Comparison

| Strategy | Recall | Precision | Space | Time |
|----------|--------|-----------|-------|------|
| Bloom filter n-gram | 0.95+ | 0.10-0.30 | O(m) fixed | O(k) per query |
| Standard blocking | 0.80-0.90 | 0.20-0.50 | O(n) | O(1) per query |
| Sorted neighborhood | 0.85-0.95 | 0.15-0.40 | O(n log n) | O(w) per query |
| Suffix array | 0.95+ | 0.10-0.20 | O(n * L) | O(log n) per query |
| Inverted index | 0.90-0.98 | 0.15-0.40 | O(n * tokens) | O(1) per query |

### 19.5 Combined Strategy for Tsingou

The recommended approach combines multiple blocking strategies:

```
Tier 1: Exact hash lookup (O(1))
  -> If exact match found, return with confidence 1.0

Tier 2: Structured blocking (O(1))
  -> For MMSI: block on MID (country code)
  -> For ICAO: block on country allocation range
  -> For names: block on Double Metaphone primary code
  -> For IPs: block on /24 prefix

Tier 3: Bloom filter n-gram (O(k))
  -> Only for candidates that pass Tier 2 blocking
  -> Pre-filter before expensive string comparison

Tier 4: Full comparison (O(mn))
  -> Levenshtein / Jaro-Winkler / Damerau-Levenshtein
  -> Only on candidates that pass Tier 3
  -> Return scored result
```

### 19.6 Effect Schema Types

```typescript
const BlockingStrategy = Schema.Literal(
  'exact_hash',
  'prefix_block',
  'phonetic_block',
  'bloom_ngram',
  'sorted_neighborhood',
  'suffix_array',
  'inverted_index'
)

const BlockingConfig = Schema.TaggedStruct('BlockingConfig', {
  strategies: Schema.Array(Schema.Struct({
    strategy: BlockingStrategy,
    tier: Schema.Int.pipe(Schema.greaterThan(0)),
    params: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  })),
  bloomFilterSize: Schema.Int,
  bloomHashFunctions: Schema.Int,
  sortedWindowSize: Schema.Int,
  ngramSize: Schema.Int,
})

const BlockingResult = Schema.TaggedStruct('BlockingResult', {
  queryId: Schema.String,
  candidateCount: Schema.Int,
  blockingTier: Schema.Int,
  strategyUsed: BlockingStrategy,
  candidates: Schema.Array(Schema.Struct({
    id: Schema.String,
    blockKey: Schema.String,
    preScore: Schema.Number,
  })),
  timeUs: Schema.Number,
})
```

---

## 20. Known Alias Management

### 20.1 The Alias Problem

Entities change identifiers over time. Vessels reflag (changing MMSI), aircraft
are re-registered (changing ICAO), organizations rebrand, people use multiple
names. An alias table maps these changes:

```
Alias Table Entry:
  entity_canonical_id: "vessel-001"
  identifier_type: "mmsi"
  identifier_value: "211900000"
  valid_from: 2020-01-01
  valid_to: 2024-06-15
  source: "ITU registry"
  confidence: 1.0

  entity_canonical_id: "vessel-001"
  identifier_type: "mmsi"
  identifier_value: "319900123"
  valid_from: 2024-06-16
  valid_to: null (current)
  source: "Cayman Islands registry"
  confidence: 1.0
  note: "Reflagged from Germany to Cayman Islands"
```

### 20.2 Temporal Validity

Aliases have time ranges. The system must consider WHEN a signal was generated
to know WHICH alias was active:

```
Signal at 2023-05-01 with MMSI 211900000 -> vessel-001 (German registration)
Signal at 2025-01-01 with MMSI 319900123 -> vessel-001 (Cayman registration)

Signal at 2025-01-01 with MMSI 211900000 -> ???
  Old MMSI, after reflagging. Possibilities:
  1. Equipment not updated (stale transponder)
  2. Spoofing (using old identity)
  3. Alias table is wrong (registration date error)

  -> Flag as ANOMALY with all three possibilities scored
```

### 20.3 Source Provenance

Different alias sources have different reliability:

```
Source Reliability Tiers:
  Tier 1 (confidence 0.95-1.0):
    - ITU registry (official MMSI assignments)
    - FAA N-number registry (official aircraft registration)
    - RIPE/ARIN (official IP allocation)

  Tier 2 (confidence 0.70-0.94):
    - Lloyd's Register (commercial maritime database)
    - FlightAware (crowd-sourced aviation data)
    - Shodan (internet-wide scanning)

  Tier 3 (confidence 0.40-0.69):
    - Open source intelligence (OSINT)
    - Social media mentions
    - Unverified tip reports

When aliases from different tiers conflict:
  Higher tier wins, unless lower tier has multiple corroborating sources
  Conflicting aliases are flagged for operator review
```

### 20.4 Effect Schema Types

```typescript
const AliasSource = Schema.TaggedStruct('AliasSource', {
  name: Schema.String,
  tier: Schema.Literal(1, 2, 3),
  baseConfidence: Schema.Number,
  lastUpdated: Schema.DateFromString,
})

const Alias = Schema.TaggedStruct('Alias', {
  canonicalEntityId: Schema.String,
  identifierType: Schema.String,
  identifierValue: Schema.String,
  validFrom: Schema.DateFromString,
  validTo: Schema.optionalWith(Schema.DateFromString, { default: () => undefined }),
  source: AliasSource,
  confidence: Schema.Number,
  notes: Schema.optionalWith(Schema.String, { default: () => '' }),
})

const AliasTable = Schema.TaggedStruct('AliasTable', {
  version: Schema.String,
  entries: Schema.Array(Alias),
  lastUpdated: Schema.DateFromString,
  sourceCount: Schema.Int,
  entityCount: Schema.Int,
})

const AliasLookupResult = Schema.TaggedStruct('AliasLookupResult', {
  queryIdentifier: Schema.String,
  queryTimestamp: Schema.DateFromString,
  matches: Schema.Array(Schema.Struct({
    alias: Alias,
    temporallyValid: Schema.Boolean,
    confidence: Schema.Number,
  })),
  anomalies: Schema.Array(Schema.Struct({
    type: Schema.Literal('stale_id', 'possible_spoofing', 'conflicting_sources'),
    description: Schema.String,
    severity: Schema.Literal('low', 'medium', 'high', 'critical'),
  })),
})
```

---

## 21. Integration with d2ts

### 21.1 Fuzzy Join as Custom Operator

The core integration pattern: a fuzzy join operator that combines blocking,
string similarity, and alias lookup into a single d2ts join:

```typescript
// ============================================================
// FUZZY IDENTITY JOIN — d2ts CUSTOM OPERATOR
// ============================================================

interface FuzzyJoinConfig {
  readonly blockingStrategy: BlockingConfig
  readonly stringMetric: StringSimilarityAlgorithm
  readonly stringThreshold: number
  readonly phoneticAlgorithm: PhoneticAlgorithm
  readonly numericTolerance: NumericFuzzyConfig
  readonly aliasTable: D2Collection<[string, Alias]>
  readonly outputConfidenceFloor: number
}

function fuzzyIdentityJoin<L, R>(
  left: D2Collection<[string, L]>,
  right: D2Collection<[string, R]>,
  leftKeyExtractor: (l: L) => string,
  rightKeyExtractor: (r: R) => string,
  config: FuzzyJoinConfig
): D2Collection<[string, FuzzyMatchResult<L, R>]> {

  // Stage 1: Exact join (Tier 1 — hard keys)
  const exactMatches = left
    .map(([id, l]) => [leftKeyExtractor(l), { id, value: l }] as const)
    .join(
      right.map(([id, r]) => [rightKeyExtractor(r), { id, value: r }] as const),
      (l, r) => ({
        left: l, right: r,
        confidence: 1.0,
        matchType: 'exact' as const
      })
    )

  // Stage 2: Alias-resolved join
  const aliasResolvedLeft = left
    .map(([id, l]) => [leftKeyExtractor(l), { id, value: l }] as const)
    .join(
      config.aliasTable,
      (l, alias) => ({
        originalId: l.id,
        originalKey: leftKeyExtractor(l.value as L),
        resolvedKey: alias.canonicalEntityId,
        value: l.value,
        aliasConfidence: alias.confidence,
      })
    )

  const aliasMatches = aliasResolvedLeft
    .map(item => [item.resolvedKey, item] as const)
    .join(
      right.map(([id, r]) => [rightKeyExtractor(r), { id, value: r }] as const)
        .join(config.aliasTable, (r, alias) => ({
          originalId: r.id,
          resolvedKey: alias.canonicalEntityId,
          value: r.value,
          aliasConfidence: alias.confidence,
        }))
        .map(item => [item.resolvedKey, item] as const),
      (l, r) => ({
        left: { id: l.originalId, value: l.value },
        right: { id: r.originalId, value: r.value },
        confidence: l.aliasConfidence * r.aliasConfidence,
        matchType: 'alias_resolved' as const
      })
    )

  // Stage 3: Fuzzy string join (blocked)
  const fuzzyMatches = left
    .map(([id, l]) => {
      const key = leftKeyExtractor(l)
      const blockKey = computeBlockKey(key, config.blockingStrategy)
      return [blockKey, { id, value: l, key }] as const
    })
    .join(
      right.map(([id, r]) => {
        const key = rightKeyExtractor(r)
        const blockKey = computeBlockKey(key, config.blockingStrategy)
        return [blockKey, { id, value: r, key }] as const
      }),
      (l, r) => {
        // Only reaches here if block keys match
        const similarity = computeStringSimilarity(
          l.key, r.key, config.stringMetric
        )
        if (similarity < config.stringThreshold) return null

        return {
          left: { id: l.id, value: l.value },
          right: { id: r.id, value: r.value },
          confidence: similarity,
          matchType: 'fuzzy_string' as const,
        }
      }
    )
    .filter((item): item is NonNullable<typeof item> => item !== null)

  // Combine all match types, deduplicate, take highest confidence
  return mergeMatchResults(exactMatches, aliasMatches, fuzzyMatches)
}
```

### 21.2 Incremental Recomputation on Alias Table Updates

When the alias table is updated (new alias added, existing alias corrected),
d2ts recomputes only the affected joins:

```
Alias table update:
  + (vessel-001, mmsi, 319900123, 2024-06-16, null, ITU, 1.0)

d2ts processing:
  1. New alias entry inserted into aliasTable collection
  2. All joins against aliasTable recompute for affected keys
  3. Signals that previously had NO alias match now gain one
  4. Signals that had a DIFFERENT alias match may get updated confidence

Retraction cascade:
  If a previous fuzzy match existed with confidence 0.72 (string similarity)
  and the new alias match has confidence 1.0:
    - Retract (fuzzy_match, confidence: 0.72, -1)
    - Insert (alias_match, confidence: 1.0, +1)
    - All downstream consumers see the confidence upgrade
```

### 21.3 Streaming Architecture

```
                   +-----------------+
                   | Incoming Signal |
                   |   (identifier)  |
                   +--------+--------+
                            |
                   +--------v--------+
                   | Tier 1: Exact   |
                   | Hash Lookup     |-----> MATCH (C=1.0)
                   +--------+--------+
                            | (no match)
                   +--------v--------+
                   | Tier 2: Alias   |
                   | Table Lookup    |-----> MATCH (C=alias.confidence)
                   +--------+--------+
                            | (no match)
                   +--------v--------+
                   | Tier 3: Block   |
                   | + Pre-filter    |
                   +--------+--------+
                            |
                   +--------v--------+
                   | Tier 4: Fuzzy   |
                   | Comparison      |
                   |  - String sim   |
                   |  - Phonetic     |
                   |  - Numeric tol  |
                   +--------+--------+
                            |
                   +--------v--------+
                   | Confidence      |
                   | Aggregation     |
                   | + Threshold     |
                   +--------+--------+
                            |
                +-----------+-----------+
                |                       |
         +------v------+       +-------v-------+
         | MATCH        |       | NO MATCH      |
         | (C > floor)  |       | -> New entity  |
         +--------------+       +---------------+
```

---

## 22. RI-2 Decision Matrix

### When to Use Which Algorithm

| Identifier Type | Primary Method | Secondary Method | Blocking |
|----------------|----------------|------------------|----------|
| MMSI (9 digits) | Hamming + structured tolerance | Alias lookup | MID prefix |
| ICAO hex (6 chars) | Hamming distance | Country block validation | Country prefix |
| Vessel name | Jaro-Winkler | Double Metaphone | Metaphone primary |
| Person name | Jaro-Winkler | Double Metaphone + NYSIIS | Metaphone primary |
| Organization name | Levenshtein (normalized) | Alias table | First-3-chars |
| IP address | Subnet masking | CIDR containment | /24 prefix |
| Callsign | Hamming | Damerau-Levenshtein | First-2-chars |
| Domain name | Levenshtein | Label-by-label comparison | TLD + SLD |
| Free text (OSINT) | LSH/MinHash on n-grams | Semantic embedding | Inverted index |

### Confidence Scoring by Method

| Method | Confidence Range | Notes |
|--------|-----------------|-------|
| Exact match | 1.0 | No uncertainty |
| Alias table (Tier 1 source) | 0.95-1.0 | Registry-grade |
| Alias table (Tier 2 source) | 0.70-0.94 | Commercial database |
| Alias table (Tier 3 source) | 0.40-0.69 | OSINT, unverified |
| String similarity > 0.95 | 0.85-0.95 | Very high similarity |
| String similarity 0.85-0.95 | 0.70-0.85 | Moderate similarity |
| Phonetic match (primary) | 0.70-0.85 | Sound-alike |
| Phonetic match (alternate) | 0.50-0.70 | Weaker sound-alike |
| Numeric tolerance (1 digit) | 0.80-0.90 | Likely typo |
| Numeric tolerance (2+ digits) | 0.50-0.80 | Less certain |
| LSH candidate | 0.40-0.70 | Approximate, needs confirmation |

---

## 23. RI-2 Performance Estimates

### Single-Signal Resolution Latency

| Tier | Operation | Latency | Notes |
|------|-----------|---------|-------|
| 1 | Exact hash lookup | < 0.01ms | O(1) hash table |
| 2 | Alias table lookup | < 0.1ms | Indexed by identifier value |
| 3 | Blocking + bloom filter | < 0.5ms | Pre-filter candidates |
| 4 | Full comparison (per candidate) | ~0.01ms | String similarity |
| 4 | Phonetic encoding + compare | ~0.05ms | Double Metaphone |
| **Total** | **Typical (Tier 1 hit)** | **< 0.1ms** | 80% of signals |
| **Total** | **Typical (Tier 4 needed)** | **< 1ms** | Remaining 20% |

### Throughput at Scale

| Signal Rate | Known Entities | Strategy | Throughput | CPU Usage |
|------------|----------------|----------|------------|-----------|
| 1k/sec | 10k | All tiers | 1k/sec (trivial) | < 5% |
| 10k/sec | 100k | All tiers | 10k/sec | ~30% |
| 100k/sec | 100k | Tiers 1-2 only | 100k/sec | ~50% |
| 100k/sec | 100k | All tiers | ~50k/sec* | ~100% |
| 100k/sec | 1M | All tiers | ~20k/sec* | Need sharding |

*At 100k/sec with all tiers, the bottleneck is Tier 4 fuzzy comparison on
candidates that pass blocking. Sharding by entity class (maritime, aviation,
cyber, OSINT) distributes the load across d2ts workers.

### Memory Requirements

| Component | Size Formula | Example (100k entities) |
|-----------|-------------|------------------------|
| Exact hash table | 100B * n | 10 MB |
| Alias table (indexed) | 200B * aliases | 20 MB (100k aliases) |
| Bloom filters | 117 KB per 100k items | 117 KB |
| Inverted index | 50B * n * avg_tokens | 50 MB |
| LSH signature store | k * 4B * n | 40 MB (k=100) |
| **Total** | | **~120 MB** |

This fits comfortably in memory for a single d2ts worker.

---

# Part III: Effect Schema Types

## Unified Track State Schema

```typescript
import { Schema } from 'effect'

// --- Tracking Schemas (RI-1) ---

const TrackId = Schema.String.pipe(Schema.brand('TrackId'))
const SensorId = Schema.String.pipe(Schema.brand('SensorId'))
const ScanId = Schema.String.pipe(Schema.brand('ScanId'))

const KinematicState = Schema.TaggedStruct('KinematicState', {
  position: Schema.Tuple(Schema.Number, Schema.Number),  // [lat, lon]
  velocity: Schema.Tuple(Schema.Number, Schema.Number),  // [vx, vy] m/s
  acceleration: Schema.optionalWith(
    Schema.Tuple(Schema.Number, Schema.Number),
    { default: () => [0, 0] as const }
  ),
  covariance: Schema.Array(Schema.Number),  // flattened covariance matrix
  timestamp: Schema.Number,  // epoch ms
})

const TrackStatus = Schema.Literal('tentative', 'confirmed', 'coasting', 'deleted')

const TrackLifecycle = Schema.TaggedStruct('TrackLifecycle', {
  status: TrackStatus,
  score: Schema.Number,
  hitHistory: Schema.Array(Schema.Boolean),
  confirmationMethod: Schema.Literal('m_of_n', 'score_based'),
  scansAlive: Schema.Int,
  consecutiveMisses: Schema.Int,
})

const AssociationAlgorithm = Schema.Literal('gnn', 'jpda', 'mht')

const AssociationHypothesis = Schema.TaggedStruct('AssociationHypothesis', {
  hypothesisId: Schema.String,
  assignments: Schema.Array(Schema.Struct({
    trackId: TrackId,
    measurementId: Schema.optionalWith(Schema.String, { default: () => undefined }),
    cost: Schema.Number,
    probability: Schema.Number,
  })),
  totalProbability: Schema.Number,
  parentHypothesisId: Schema.optionalWith(Schema.String, { default: () => undefined }),
  depth: Schema.Int,
})

const TrackAssociationResult = Schema.TaggedStruct('TrackAssociationResult', {
  scanId: ScanId,
  algorithm: AssociationAlgorithm,
  assignments: Schema.Array(Schema.Struct({
    trackId: TrackId,
    measurementId: Schema.optionalWith(Schema.String, { default: () => undefined }),
    confidence: Schema.Number,
  })),
  unassignedMeasurements: Schema.Array(Schema.String),
  newTrackCandidates: Schema.Array(Schema.String),
  clusterCount: Schema.Int,
  computeTimeMs: Schema.Number,
})

const FullTrackState = Schema.TaggedStruct('FullTrackState', {
  trackId: TrackId,
  sensorId: SensorId,
  kinematic: KinematicState,
  lifecycle: TrackLifecycle,
  associationAlgorithm: AssociationAlgorithm,
  lastAssociatedMeasurement: Schema.optionalWith(Schema.String, { default: () => undefined }),
  contributingSensors: Schema.Array(SensorId),
  fusionTier: Schema.Literal(1, 2, 3),
})

// --- Fuzzy Identity Schemas (RI-2) ---

const FuzzyMatchMethod = Schema.Literal(
  'exact',
  'alias_resolved',
  'string_levenshtein',
  'string_damerau',
  'string_jaro_winkler',
  'string_hamming',
  'phonetic_soundex',
  'phonetic_metaphone',
  'phonetic_double_metaphone',
  'phonetic_nysiis',
  'numeric_tolerance',
  'lsh_minhash',
  'embedding_cosine'
)

const IdentityResolutionResult = Schema.TaggedStruct('IdentityResolutionResult', {
  queryIdentifier: Schema.String,
  queryEntityClass: Schema.String,
  matchedIdentifier: Schema.optionalWith(Schema.String, { default: () => undefined }),
  matchedCanonicalId: Schema.optionalWith(Schema.String, { default: () => undefined }),
  method: FuzzyMatchMethod,
  confidence: Schema.Number,
  blockingTier: Schema.Int,
  assessment: Schema.Literal(
    'exact_match',
    'alias_match',
    'probable_typo',
    'format_variation',
    'phonetic_match',
    'possible_spoofing',
    'new_entity',
    'ambiguous'
  ),
  alternatives: Schema.Array(Schema.Struct({
    identifier: Schema.String,
    canonicalId: Schema.String,
    confidence: Schema.Number,
    method: FuzzyMatchMethod,
  })),
  computeTimeUs: Schema.Number,
  auditTrail: Schema.Array(Schema.Struct({
    tier: Schema.Int,
    method: Schema.String,
    candidatesEvaluated: Schema.Int,
    result: Schema.Literal('match', 'no_match', 'escalated'),
    timeUs: Schema.Number,
  })),
})
```

---

# Part IV: References

## Academic Papers

1. **Reid, D.** "An Algorithm for Tracking Multiple Targets." *IEEE Transactions
   on Automatic Control*, AC-24(6):843-854, December 1979.
   — The foundational MHT paper.

2. **Bar-Shalom, Y. and Fortmann, T.E.** *Tracking and Data Association.*
   Academic Press, 1988.
   — Definitive reference for JPDA and data association theory.

3. **Kuhn, H.W.** "The Hungarian Method for the Assignment Problem."
   *Naval Research Logistics Quarterly*, 2(1-2):83-97, 1955.
   — The Hungarian algorithm used in GNN.

4. **Murty, K.G.** "An Algorithm for Ranking All the Assignments in Order of
   Increasing Cost." *Operations Research*, 16(3):682-687, 1968.
   — K-best assignments for MHT pruning.

5. **Kalman, R.E.** "A New Approach to Linear Filtering and Prediction Problems."
   *Journal of Basic Engineering*, 82(1):35-45, 1960.
   — The Kalman filter.

6. **Jaro, M.A.** "Advances in Record-Linkage Methodology as Applied to
   Matching the 1985 Census of Tampa, Florida." *Journal of the American
   Statistical Association*, 84(406):414-420, 1989.
   — Jaro similarity metric.

7. **Winkler, W.E.** "String Comparator Metrics and Enhanced Decision Rules in
   the Fellegi-Sunter Model of Record Linkage." *Proceedings of the Section on
   Survey Research Methods*, American Statistical Association, 1990.
   — Winkler extension to Jaro similarity.

8. **Philips, L.** "The Double Metaphone Search Algorithm." *C/C++ Users
   Journal*, June 2000.
   — Double Metaphone phonetic encoding.

9. **Indyk, P. and Motwani, R.** "Approximate Nearest Neighbors: Towards
   Removing the Curse of Dimensionality." *Proceedings of the 30th Annual
   ACM Symposium on Theory of Computing*, 1998.
   — Locality-sensitive hashing foundations.

10. **Broder, A.Z.** "On the Resemblance and Containment of Documents."
    *Proceedings of the Compression and Complexity of Sequences*, 1997.
    — MinHash for set similarity.

11. **Christen, P.** *Data Matching: Concepts and Techniques for Record Linkage,
    Entity Resolution, and Duplicate Detection.* Springer, 2012.
    — Comprehensive reference for entity resolution techniques.

12. **Papadakis, G., Ioannou, E., Thanos, E., and Palpanas, T.** "A Survey of
    Blocking and Filtering Techniques for Entity Resolution." *ACM Computing
    Surveys*, 53(2):1-42, 2020.
    — State of the art in blocking strategies.

13. **Blackman, S.S.** "Multiple Hypothesis Tracking For Multiple Target
    Tracking." *IEEE Aerospace and Electronic Systems Magazine*, 19(1):5-18,
    2004.
    — MHT survey and practical implementation guidance.

14. **Cox, I.J. and Hingorani, S.L.** "An Efficient Implementation of Reid's
    Multiple Hypothesis Tracking Algorithm and Its Evaluation for the Purpose
    of Visual Tracking." *IEEE Transactions on Pattern Analysis and Machine
    Intelligence*, 18(2):138-150, 1996.
    — Efficient MHT implementation with Murty's algorithm.

## Software and Tools

15. **Stone Soup** — Open-source target tracking framework (Python).
    https://stonesoup.readthedocs.io/

16. **MATLAB Sensor Fusion and Tracking Toolbox** — Commercial tracking tools.
    https://www.mathworks.com/products/sensor-fusion-and-tracking.html

17. **d2ts** — Differential Dataflow in TypeScript.
    https://github.com/electric-sql/d2ts

18. **Splink** — Record linkage library with string comparators and blocking.
    https://moj-analytical-services.github.io/splink/

19. **Talisman** — JavaScript phonetic algorithm library.
    https://yomguithereal.github.io/talisman/phonetics/

20. **java-string-similarity** — Comprehensive string similarity implementations.
    https://github.com/tdebatty/java-string-similarity

## Tsingou Internal Documents

21. **TSGC-001** — Fusion Ontology: Determining What to Fuse (this document's parent)
22. **RFC-002** — TSG.4 Data Fusion Mathematics, TSG.8 BaseSignal Schema
23. **RFC-002** — TSG.26 Identity Resolution, TSG.28 Track Management

---

*End of TSGC-RI-1/2*
