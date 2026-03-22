# RFC Section TSG.4: Data Fusion Mathematics

```
Section:       TSG.4 — Data Fusion Mathematics
Parent RFC:    Tsingou System RFC
Status:        DRAFT
Author:        Val (data-fusion-mathematician)
Created:       2026-02-18
Research Base: research-data-fusion-math.md (470 lines, 12 sections, 9 frameworks)
```

> This section establishes the mathematical foundations for multi-source intelligence
> data fusion within the Tsingou platform. Every fusion algorithm, confidence metric,
> and track association method traces to peer-reviewed mathematical frameworks. The
> d2ts differential dataflow graph is the execution substrate; this section defines
> the mathematical operations that graph operators MUST implement. The key words
> "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" are to be interpreted as
> described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [Fusion Taxonomies](#1-fusion-taxonomies)
   1.1 [JDL Data Fusion Model](#11-jdl-data-fusion-model)
   1.2 [Dasarathy Input/Output Taxonomy](#12-dasarathy-inputoutput-taxonomy)
   1.3 [Taxonomy Mapping to d2ts Graph Tiers](#13-taxonomy-mapping-to-d2ts-graph-tiers)
2. [Bayesian Inference Foundations](#2-bayesian-inference-foundations)
   2.1 [Bayes' Theorem for Multi-Source Evidence](#21-bayes-theorem-for-multi-source-evidence)
   2.2 [Bayesian Networks for Causal Reasoning](#22-bayesian-networks-for-causal-reasoning)
   2.3 [Recursive Bayesian Estimation](#23-recursive-bayesian-estimation)
   2.4 [Particle Filters (Sequential Monte Carlo)](#24-particle-filters-sequential-monte-carlo)
3. [Dempster-Shafer Theory of Evidence](#3-dempster-shafer-theory-of-evidence)
   3.1 [Belief Functions and Plausibility](#31-belief-functions-and-plausibility)
   3.2 [Dempster's Rule of Combination](#32-dempsters-rule-of-combination)
   3.3 [The Conflict Problem and Resolution Methods](#33-the-conflict-problem-and-resolution-methods)
   3.4 [STIX Confidence as Belief Function](#34-stix-confidence-as-belief-function)
4. [Transferable Belief Model](#4-transferable-belief-model)
   4.1 [Open-World Assumption](#41-open-world-assumption)
   4.2 [Pignistic Probability Transform](#42-pignistic-probability-transform)
   4.3 [Two-Level Architecture: Credal and Pignistic](#43-two-level-architecture-credal-and-pignistic)
5. [Kalman Filtering](#5-kalman-filtering)
   5.1 [Linear Kalman Filter](#51-linear-kalman-filter)
   5.2 [Extended Kalman Filter (EKF)](#52-extended-kalman-filter-ekf)
   5.3 [Unscented Kalman Filter (UKF)](#53-unscented-kalman-filter-ukf)
   5.4 [Filter Selection Criteria](#54-filter-selection-criteria)
6. [Multi-Target Tracking](#6-multi-target-tracking)
   6.1 [The Data Association Problem](#61-the-data-association-problem)
   6.2 [Nearest Neighbor and Global Nearest Neighbor](#62-nearest-neighbor-and-global-nearest-neighbor)
   6.3 [Joint Probabilistic Data Association (JPDA)](#63-joint-probabilistic-data-association-jpda)
   6.4 [Multiple Hypothesis Tracking (MHT)](#64-multiple-hypothesis-tracking-mht)
   6.5 [Probability Hypothesis Density (PHD) Filter](#65-probability-hypothesis-density-phd-filter)
   6.6 [Random Finite Sets (RFS) Framework](#66-random-finite-sets-rfs-framework)
7. [Fuzzy Logic Fusion](#7-fuzzy-logic-fusion)
   7.1 [Membership Functions and Linguistic Variables](#71-membership-functions-and-linguistic-variables)
   7.2 [Mamdani Inference](#72-mamdani-inference)
   7.3 [Sugeno Inference](#73-sugeno-inference)
   7.4 [Fuzzy-Probabilistic Hybrid Methods](#74-fuzzy-probabilistic-hybrid-methods)
8. [Intelligence-Specific Fusion](#8-intelligence-specific-fusion)
   8.1 [Multi-INT Fusion Framework](#81-multi-int-fusion-framework)
   8.2 [Source Reliability and Confidence Calibration](#82-source-reliability-and-confidence-calibration)
   8.3 [Temporal Fusion](#83-temporal-fusion)
   8.4 [Spatial Fusion](#84-spatial-fusion)
9. [Fusion Quality and Performance](#9-fusion-quality-and-performance)
   9.1 [Accuracy Metrics](#91-accuracy-metrics)
   9.2 [Information-Theoretic Measures](#92-information-theoretic-measures)
   9.3 [Computational Complexity Constraints](#93-computational-complexity-constraints)
10. [Normative Constraints](#10-normative-constraints)
11. [Open Questions](#11-open-questions)
12. [References](#12-references)

---

## 1. Fusion Taxonomies

### 1.1 JDL Data Fusion Model

The Joint Directors of Laboratories (JDL) Data Fusion Model [STEINBERG-1999] provides the canonical
functional decomposition for multi-source data fusion. Originally developed under the U.S. Department
of Defense in 1986, the model was revised by Steinberg, Bowman, and White in 1999 to address
criticisms of implied sequential processing. The Data Fusion Information Group (DFIG) extended it
further to include Levels 5 and 6 [LLINAS-HALL-1997].

Implementations MUST support the following functional levels:

| Level | Designation | Function | Formal Definition |
|-------|-------------|----------|-------------------|
| **0** | Sub-Object Data Assessment | Signal-level estimation and prediction on the basis of observable pixel-level or waveform-level data | Given raw observations `z_1, ..., z_m` from sensors `s_1, ..., s_p`, produce aligned measurement vectors `y_1, ..., y_m` in a common reference frame |
| **1** | Object Assessment | Entity state estimation from associated measurements; track formation and maintenance | Given aligned measurements `Y = {y_1, ..., y_m}`, partition into tracks `T = {T_1, ..., T_n}` where each `T_j` represents a hypothesized entity, and estimate state `x_j` for each |
| **2** | Situation Assessment | Relationship analysis among entities; aggregation of entity states into relational structures | Given entity states `{x_1, ..., x_n}`, compute relational graph `G = (V, E)` where vertices are entities and edges encode relationships (co-occurrence, communication, proximity, causation) |
| **3** | Impact Assessment | Threat evaluation, vulnerability analysis, and consequence prediction based on situation model | Given situation graph `G` and a threat model `M`, compute threat scores `tau_i` for entities and aggregate risk `R(G, M)` |
| **4** | Process Refinement | Sensor management and adaptive collection tasking; optimization of fusion process itself | Given current information state `I_k` and sensor capabilities `C`, compute optimal sensor tasking `u*` that maximizes expected information gain `Delta H(I | u)` |
| **5** | User Refinement (DFIG) | Cognitive fusion; analyst-in-the-loop hypothesis testing and belief revision | Given analyst hypothesis `H_a` and system state `I_k`, present evidence pro/contra and accept analyst updates to belief state |

The JDL model MUST NOT be interpreted as prescribing sequential processing. Implementations
SHOULD support concurrent operation across all levels. Level 4 process refinement MUST feed back
to Levels 0-1 as a closed control loop: the fusion system refines its own collection strategy
based on current situation assessment.

**Criticisms and mitigations**: The JDL model has been criticized for (a) implying sequential
processing [BLASCH-2006], (b) underspecifying the human element [STEINBERG-1999], and
(c) vagueness at Level 4 [LLINAS-HALL-1997]. Tsingou addresses (a) via the d2ts dataflow graph
which inherently supports non-sequential, incremental processing. Tsingou addresses (b) via
the DOM rendering layer that provides Level 5 analyst interaction. Tsingou addresses (c) by
defining Level 4 as the hot-plug source adapter management system — adaptive collection tasking
is implemented as runtime source reconfiguration.

### 1.2 Dasarathy Input/Output Taxonomy

Dasarathy [DASARATHY-1997] classifies fusion processes by the abstraction level of their inputs
and outputs, providing an orthogonal taxonomy to JDL. Where JDL describes *what* is being fused,
Dasarathy describes *how* abstraction levels transform.

Implementations MUST classify each fusion operator according to the Dasarathy taxonomy:

| Category | Input Level | Output Level | Formal Description | Example |
|----------|-------------|--------------|-------------------|---------|
| **DAI-DAO** | Data (raw) | Data (raw) | `f: D^n -> D` where `D` is the raw data space | Combining redundant RSS feed entries; sensor data averaging |
| **DAI-FEO** | Data (raw) | Features | `f: D^n -> F` where `F` is a feature space | NLP entity extraction from HTTP API text; FFT spectral decomposition |
| **FEI-FEO** | Features | Features | `f: F^n -> F'` where `F, F'` are feature spaces | Merging named entity lists from multiple sources; feature concatenation |
| **FEI-DEO** | Features | Decisions | `f: F^n -> Delta` where `Delta` is a decision space | Anomaly classification from fused feature vectors; threat level assignment |
| **DEI-DEO** | Decisions | Decisions | `f: Delta^n -> Delta'` | Majority voting across classifiers; Dempster's combination of independent assessments |

The Dasarathy taxonomy is REQUIRED for documentation of all d2ts fusion operators. Each operator
specification MUST include its Dasarathy classification to enable systematic analysis of the
fusion pipeline's abstraction flow.

### 1.3 Taxonomy Mapping to d2ts Graph Tiers

The d2ts differential dataflow graph [TSG.26] provides the computational substrate for all
fusion operations. The following mapping establishes the correspondence between JDL levels,
Dasarathy categories, and d2ts graph tiers:

| d2ts Tier | JDL Level | Primary Dasarathy | Operators | Normative Requirement |
|-----------|-----------|-------------------|-----------|-----------------------|
| **Ingest** | Level 0 | DAI-DAO | Source adapters, normalization, alignment | MUST produce measurements in common reference frame with unified timestamp format |
| **Transform** | Level 0-1 | DAI-FEO | `map`, `filter`, feature extractors | MUST preserve provenance metadata through transformation |
| **Correlation** | Level 1-2 | FEI-FEO | `join`, cross-source matching | MUST implement association metrics (Section 6) with configurable thresholds |
| **Detection** | Level 2-3 | FEI-DEO | `iterate`, statistical operators, anomaly detectors | MUST produce confidence scores calibrated per Section 8.2 |
| **Alert** | Level 3 | DEI-DEO | Multi-detector consensus, decision fusion | MUST apply Dempster's rule or equivalent (Section 3.2) for combining independent assessments |
| **Refinement** | Level 4 | Process control | Adapter management, source reconfiguration | SHOULD optimize information gain as defined in Section 1.1, Level 4 |
| **Analyst** | Level 5 | Human-in-the-loop | DOM layer annotations, hypothesis tools | MUST support belief revision without requiring full re-computation |

Implementations MUST ensure that provenance metadata (source identifier, original timestamp,
Dasarathy classification of the producing operator) flows through every tier of the graph.
This provenance chain is REQUIRED for audit trail compliance [TSG.7] and for conflict
resolution in Dempster-Shafer combination (Section 3.3).

---

## 2. Bayesian Inference Foundations

### 2.1 Bayes' Theorem for Multi-Source Evidence

Bayesian inference provides the foundational probabilistic framework for combining evidence
from multiple intelligence sources [BERGER-1985]. Given a hypothesis `H` and evidence
`E_1, E_2, ..., E_n` from `n` independent sources, Bayes' theorem yields:

```
                    P(E_1, E_2, ..., E_n | H) * P(H)
P(H | E_1, ..., E_n) = ------------------------------------------
                         P(E_1, E_2, ..., E_n)
```

Under the assumption of conditional independence of sources given the hypothesis:

```
P(H | E_1, ..., E_n) proportional to P(H) * product_{i=1}^{n} P(E_i | H)
```

This factorization is critical for Tsingou: each source adapter produces evidence independently,
and the conditional independence assumption allows incremental updates as new evidence arrives.
The d2ts graph SHOULD implement Bayesian updating incrementally — when a new measurement arrives
from source `s_j`, only the likelihood term `P(E_j | H)` needs recomputation, not the entire
posterior.

**Prior specification**: The prior `P(H)` MUST be explicitly specified for each hypothesis class.
Implementations MUST NOT use improper priors (priors that do not integrate to 1) without
mathematical justification. For intelligence analysis, the prior SHOULD reflect base rates
derived from historical data or analyst assessment. When no historical data is available,
implementations SHOULD use maximum entropy priors (uniform over the hypothesis space) and
MUST document this choice.

**Likelihood models**: Each source adapter MUST define a likelihood model `P(E_i | H)` that
quantifies the probability of observing evidence `E_i` given hypothesis `H`. The likelihood
model MUST account for:

1. **Source reliability**: The probability that the source produces accurate evidence (Section 8.2)
2. **Measurement noise**: The statistical properties of sensor errors
3. **False positive rate**: The probability of observing evidence `E_i` when `H` is false

### 2.2 Bayesian Networks for Causal Reasoning

Bayesian networks (BNs) [PEARL-1988] encode conditional dependencies among variables as a
directed acyclic graph (DAG). For intelligence analysis, BNs enable causal reasoning about
the relationships between observable signals and latent threat states.

A Bayesian network `B = (G, Theta)` consists of:

- **Structure** `G = (V, E)`: A DAG where vertices `V = {X_1, ..., X_n}` represent random
  variables and edges `E` represent conditional dependencies
- **Parameters** `Theta = {P(X_i | Pa(X_i))}`: Conditional probability distributions for each
  variable given its parents `Pa(X_i)` in the graph

The joint distribution factorizes according to the graph structure:

```
P(X_1, ..., X_n) = product_{i=1}^{n} P(X_i | Pa(X_i))
```

**Inference algorithms**: Implementations MUST support at least one of:

| Algorithm | Complexity | Applicability |
|-----------|------------|---------------|
| Variable elimination | Exponential in treewidth | Exact; suitable for small networks |
| Junction tree | Exponential in treewidth | Exact; efficient for repeated queries |
| Loopy belief propagation | O(n * k^2) per iteration | Approximate; suitable for large networks |
| Gibbs sampling | O(n * N) for N samples | Approximate; handles arbitrary distributions |

For Tsingou's multi-source correlation, the BN structure SHOULD encode:

- **Signal source nodes**: Observable variables from source adapters (RSS items, HTTP responses,
  WebSocket messages)
- **Entity nodes**: Latent variables representing hypothesized entities (threat actors, campaigns,
  infrastructure)
- **Relationship nodes**: Variables encoding relationships between entities (communication links,
  co-occurrence, command-and-control)

The BN parameters SHOULD be learned from historical data where available, and MUST support
manual specification by analysts for novel threat categories where training data is insufficient.

**Conditional independence and d-separation**: Two variables `X_i` and `X_j` are conditionally
independent given a set `Z` if every path between them in the DAG is **blocked** by `Z`.
A path is blocked if it contains:

1. A **chain** `X_i -> Z_k -> X_j` where `Z_k in Z` (evidence blocks transmission)
2. A **fork** `X_i <- Z_k -> X_j` where `Z_k in Z` (common cause is observed)
3. A **collider** `X_i -> Z_k <- X_j` where `Z_k not in Z` and no descendant of `Z_k` is in `Z`

This property, called **d-separation** [PEARL-1988], is essential for determining which
source observations are informationally redundant given other observations. Implementations
SHOULD use d-separation to identify conditionally independent source streams and avoid
redundant computation during fusion.

**Markov blanket**: The Markov blanket `MB(X_i)` of a variable `X_i` comprises its parents,
children, and co-parents (other parents of its children):

```
MB(X_i) = Pa(X_i) union Children(X_i) union CoPa(X_i)
```

A variable is conditionally independent of all other variables given its Markov blanket:
`P(X_i | all others) = P(X_i | MB(X_i))`. This property enables local computation:
updating the belief about an entity requires only the variables in its Markov blanket,
not the entire network.

**Structure learning**: When the BN structure is not known a priori, it MUST be learned
from data or specified by analysts. Three approaches are available:

| Approach | Method | Complexity | Tsingou Use Case |
|----------|--------|------------|------------------|
| **Constraint-based** | PC algorithm, FCI | O(n^d) where d is max degree | Discovering causal structure from observational data |
| **Score-based** | BIC/MDL scoring + search | NP-hard (heuristic search) | Selecting among candidate structures |
| **Hybrid** | MMHC (max-min hill climbing) | O(n^2) to O(n^3) | Practical default for moderate-sized networks |

Implementations SHOULD use the MMHC algorithm [TSAMARDINOS-2006] for automated structure
learning when sufficient training data is available (RECOMMENDED minimum: 10x the number
of parameters in the model). When training data is insufficient, analyst-specified structures
MUST be used.

### 2.3 Recursive Bayesian Estimation

For time-evolving states, recursive Bayesian estimation [HO-LEE-1964] provides the sequential
update framework. The state `x_k` at time step `k` evolves according to a Markov process with
observations `z_k`:

**Prediction** (Chapman-Kolmogorov equation):

```
p(x_k | z_{1:k-1}) = integral p(x_k | x_{k-1}) * p(x_{k-1} | z_{1:k-1}) dx_{k-1}
```

**Update** (Bayes' rule):

```
                       p(z_k | x_k) * p(x_k | z_{1:k-1})
p(x_k | z_{1:k}) = -------------------------------------------
                              p(z_k | z_{1:k-1})
```

where the normalizing constant is:

```
p(z_k | z_{1:k-1}) = integral p(z_k | x_k) * p(x_k | z_{1:k-1}) dx_k
```

These recursions are analytically tractable only for special cases:

| System Class | Closed-Form Solution | Section |
|--------------|---------------------|---------|
| Linear-Gaussian | Kalman filter | 5.1 |
| Finite-state HMM | Forward algorithm | N/A |
| General nonlinear | Particle filter (approximate) | 2.4 |

Implementations MUST select the appropriate recursive estimator based on the system model class.
The Kalman filter MUST be used when the state-space model is linear-Gaussian. Particle filters
MUST be used when nonlinear dynamics or non-Gaussian noise preclude closed-form solutions.

### 2.4 Particle Filters (Sequential Monte Carlo)

Particle filters [GORDON-1993] [DOUCET-2001] approximate the posterior distribution using a
weighted set of samples (particles):

```
p(x_k | z_{1:k}) approximately equal to sum_{i=1}^{N} w_k^{(i)} * delta(x_k - x_k^{(i)})
```

where `{x_k^{(i)}, w_k^{(i)}}_{i=1}^{N}` are the particle states and normalized weights.

**Algorithm: Sequential Importance Resampling (SIR)**

```
INPUT:  Particles {x_{k-1}^{(i)}, w_{k-1}^{(i)}}_{i=1}^{N}, observation z_k
OUTPUT: Updated particles {x_k^{(i)}, w_k^{(i)}}_{i=1}^{N}

FOR i = 1 TO N:
  1. PREDICT: Sample x_k^{(i)} ~ p(x_k | x_{k-1}^{(i)})     [state transition]
  2. WEIGHT:  w_k^{(i)} = p(z_k | x_k^{(i)})                 [measurement likelihood]

3. NORMALIZE: w_k^{(i)} = w_k^{(i)} / sum_j w_k^{(j)}

4. RESAMPLE: If N_eff < N_threshold:                           [effective sample size]
     Resample N particles from {x_k^{(i)}} with probabilities {w_k^{(i)}}
     Set all weights to 1/N
```

The effective sample size `N_eff = 1 / sum_i (w_k^{(i)})^2` measures particle diversity.
Implementations MUST perform resampling when `N_eff < N/2` to prevent weight degeneracy
[DOUCET-2001].

**Resampling strategies**:

| Strategy | Variance | Complexity | Recommended |
|----------|----------|------------|-------------|
| Multinomial | O(N) | O(N log N) | Baseline |
| Systematic | O(1/N^2) | O(N) | RECOMMENDED for real-time |
| Stratified | O(1/N^2) | O(N) | Alternative to systematic |
| Residual | O(1/N^2) | O(N) | Low variance, slightly complex |

Implementations SHOULD use systematic resampling for real-time processing due to its low
variance and O(N) complexity.

**Tsingou application**: Particle filters track the evolving "threat state" of observed entities
across multiple intelligence sources. The state vector includes:

- Entity classification (threat actor, infrastructure, victim, neutral)
- Activity level (active, dormant, escalating, de-escalating)
- Confidence in classification (derived from source reliability weights)

The d2ts `iterate` operator SHOULD implement particle filter recursion for entities whose
state evolution is nonlinear or whose observation model is non-Gaussian.

---

## 3. Dempster-Shafer Theory of Evidence

### 3.1 Belief Functions and Plausibility

Dempster-Shafer theory (DST) [DEMPSTER-1967] [SHAFER-1976] provides a mathematical framework
for representing and combining uncertain evidence that generalizes both probability theory and
set-based logic.

**Frame of discernment**: Let `Theta = {theta_1, theta_2, ..., theta_n}` be a finite set of
mutually exclusive and exhaustive hypotheses. The power set `2^Theta` contains all `2^n` subsets
of `Theta`, including the empty set and `Theta` itself.

**Basic Probability Assignment (BPA)**: A function `m: 2^Theta -> [0, 1]` satisfying:

```
(C1) m(empty_set) = 0                              [under closed-world assumption]
(C2) sum_{A in 2^Theta} m(A) = 1                   [normalization]
```

Any subset `A` with `m(A) > 0` is called a **focal element**. The value `m(A)` represents the
degree of belief committed exactly to proposition `A` and to no more specific subset.

**Belief function**: The total belief committed to proposition `A` and all its subsets:

```
Bel(A) = sum_{B subseteq A, B != empty_set} m(B)
```

**Plausibility function**: The total evidence not contradicting `A`:

```
Pl(A) = sum_{B cap A != empty_set} m(B) = 1 - Bel(complement(A))
```

The interval `[Bel(A), Pl(A)]` quantifies the epistemic uncertainty about `A`:

- `Bel(A)` is the **lower bound** on the probability of `A`
- `Pl(A)` is the **upper bound** on the probability of `A`
- `Pl(A) - Bel(A)` is the **uncertainty interval** — the degree of ignorance about `A`

When `Bel(A) = Pl(A)` for all `A`, DST reduces to classical probability theory.

Implementations MUST represent evidence from each source adapter as a BPA over the relevant
frame of discernment. The frame MUST be defined per analysis domain (e.g., for threat
classification: `Theta = {malicious, benign, suspicious, unknown}`).

**Worked example**: Consider a three-hypothesis frame `Theta = {A, B, C}` with a source
providing the following BPA:

```
m({A}) = 0.3,  m({B}) = 0.2,  m({A,B}) = 0.1,  m(Theta) = 0.4
```

The belief and plausibility for hypothesis `A`:

```
Bel({A}) = m({A}) = 0.3
Pl({A})  = m({A}) + m({A,B}) + m({A,C}) + m(Theta)
         = 0.3 + 0.1 + 0 + 0.4 = 0.8
```

The interval `[0.3, 0.8]` means: at least 30% of evidence supports `A`, and at most 80%
is compatible with `A`. The gap of 0.5 represents epistemic uncertainty that could resolve
either way with additional evidence. This interval representation is strictly more expressive
than a single probability value, which is why DST is preferred over point-probability
methods for intelligence analysis under deep uncertainty.

### 3.2 Dempster's Rule of Combination

Given two independent BPAs `m_1` and `m_2` from sources `s_1` and `s_2`, Dempster's rule
of combination [DEMPSTER-1967] produces the combined BPA:

```
                    1
m_{1,2}(A) = --------- * sum_{B cap C = A} m_1(B) * m_2(C)    for A != empty_set
              1 - K

m_{1,2}(empty_set) = 0
```

where the **conflict** `K` measures the degree of disagreement between sources:

```
K = sum_{B cap C = empty_set} m_1(B) * m_2(C)
```

The normalization factor `1/(1-K)` redistributes the conflicting mass. The rule is:

- **Commutative**: `m_1 combine m_2 = m_2 combine m_1`
- **Associative**: `(m_1 combine m_2) combine m_3 = m_1 combine (m_2 combine m_3)`
- **Not idempotent**: `m combine m != m` in general

Implementations MUST compute `K` for every combination and MUST log it as a fusion quality
metric (Section 9). When `K > 0.9`, the implementation MUST flag the combination as
high-conflict and SHOULD defer to conflict resolution methods (Section 3.3).

### 3.3 The Conflict Problem and Resolution Methods

Zadeh's counterexample [ZADEH-1986] demonstrates that Dempster's rule can produce
counter-intuitive results when sources are highly conflicting. Consider two sources
assessing threat type over `Theta = {A, B, C}`:

```
Source 1: m_1({A}) = 0.99,  m_1({B}) = 0.01
Source 2: m_2({B}) = 0.99,  m_2({C}) = 0.01
```

Dempster's combination yields `m({B}) = 1.0` — complete certainty in `B` — despite neither
source strongly supporting it. The conflict `K = 0.9999` indicates near-total disagreement,
yet the normalization assigns all belief to the thin intersection.

Implementations MUST support at least two of the following conflict resolution methods:

#### 3.3.1 Yager's Modification [YAGER-1987]

Assign conflict mass to the universal set `Theta` (total ignorance) instead of normalizing:

```
m_{Y}(A) = sum_{B cap C = A} m_1(B) * m_2(C)          for A != empty_set, A != Theta
m_{Y}(Theta) = m_{Y}^{orig}(Theta) + K
m_{Y}(empty_set) = 0
```

**Properties**: Preserves commutativity and associativity. Conservative — inflates ignorance
rather than making strong claims from conflicting evidence.

**Use when**: Sources are suspected of systematic bias; conservative estimates preferred.

#### 3.3.2 Murphy's Averaging Method [MURPHY-2000]

Average all `n` BPAs into a single BPA, then self-combine `(n-1)` times:

```
m_avg(A) = (1/n) * sum_{i=1}^{n} m_i(A)

m_fused = m_avg combine m_avg combine ... combine m_avg    (n-1 times)
```

**Properties**: Simple to implement. Reduces conflict by averaging before combination.
Loses individual source identity — treats all sources as equally reliable.

**Use when**: Sources are approximately equally reliable; fast computation needed.

#### 3.3.3 Deng's Weighted Average [DENG-2004]

Weight BPAs by inter-source similarity before averaging:

```
d(m_i, m_j) = distance metric between BPAs (e.g., Jousselme distance)
sup_i = sum_{j != i} (1 - d(m_i, m_j))     [support for source i]
w_i = sup_i / sum_j sup_j                    [normalized weight]

m_weighted(A) = sum_{i=1}^{n} w_i * m_i(A)

m_fused = m_weighted combine m_weighted combine ... combine m_weighted    (n-1 times)
```

**Properties**: Sources consistent with the majority receive higher weight. More discriminating
than Murphy's method. Higher computational cost.

**Use when**: Sources have varying reliability; outlier detection desired.

#### 3.3.4 Zhang's Redistribution [ZHANG-1994]

Redistribute conflict mass proportionally to focal elements:

```
m_{Z}(A) = m_{D}(A) + m_{D}(A) * K / (1 - K)    for each focal element A
```

where `m_{D}(A)` is the unnormalized Dempster combination.

**Properties**: Equivalent to Dempster's rule in the non-conflicting case. Better
discrimination than Yager for moderate conflict. Loses associativity.

**Use when**: Moderate conflict; associativity not required.

#### 3.3.5 Selection Criteria

| Conflict Level | `K` Range | RECOMMENDED Method | Rationale |
|----------------|-----------|-------------------|-----------|
| Low | `K < 0.3` | Dempster's rule (unmodified) | Normalization is benign |
| Moderate | `0.3 <= K < 0.7` | Zhang or Deng | Better discrimination without over-normalization |
| High | `0.7 <= K < 0.9` | Deng's weighted average | Outlier source down-weighted |
| Very high | `K >= 0.9` | Yager or analyst escalation | Conservative; flag for human review |

Implementations SHOULD adaptively select the combination method based on computed `K` value.
The method selection MUST be logged alongside the conflict value for audit purposes.

### 3.4 STIX Confidence as Belief Function

STIX 2.1 [STIX-2.1] defines a `confidence` field as an integer in `[0, 100]` representing
the creator's confidence that the content is correct. This scalar confidence MUST be mapped
to a Dempster-Shafer belief function for mathematical fusion.

**Mapping from STIX confidence `c` to BPA**: For a binary frame `Theta = {true, false}`
(the indicator is or is not malicious):

```
m({true})  = c / 100
m({false}) = 0                                  [STIX does not express negative confidence]
m(Theta)   = 1 - c / 100                       [remaining mass assigned to ignorance]
```

This mapping preserves the semantic intent of STIX confidence: a confidence of 80 means
0.80 belief in the indicator being true with 0.20 ignorance (not 0.20 belief in false).

**Combining STIX indicators**: When multiple STIX sources report on the same indicator,
their BPAs are combined via Dempster's rule (with appropriate conflict resolution). The
resulting `Bel({true})` is the fused confidence.

The Admiralty/NATO system (Section 8.2) provides the source reliability weighting `r_i`
that scales the BPA:

```
m_weighted_i({true}) = r_i * m_i({true})
m_weighted_i(Theta)  = 1 - r_i * m_i({true})
```

where `r_i in [0, 1]` is derived from the source's Admiralty reliability grade (Section 8.2).

Implementations MUST apply source reliability weighting BEFORE Dempster combination.

---

## 4. Transferable Belief Model

### 4.1 Open-World Assumption

The Transferable Belief Model (TBM) [SMETS-KENNES-1994] extends classical Dempster-Shafer
theory by relaxing the closed-world assumption. In classical DST, the frame of discernment
`Theta` is assumed exhaustive — all possible hypotheses are enumerated. TBM introduces the
**open-world assumption**:

```
m(empty_set) >= 0                               [mass on empty set permitted]
```

The mass `m(empty_set)` represents belief that the true hypothesis lies OUTSIDE the frame
of discernment — an outcome not yet considered by the analyst. This is not the same as
ignorance (`m(Theta)`), which represents inability to discriminate among known hypotheses.

**Tsingou application**: In SIGINT analysis, the open-world assumption is critical. A signal
intercepted from an unknown source MAY belong to a threat category not in the current frame.
Forcing all mass onto known categories (closed world) produces overconfident assessments.
TBM allows the system to express "this evidence suggests something we haven't categorized yet."

Implementations MUST support both closed-world (`m(empty_set) = 0`, standard DST) and
open-world (`m(empty_set) >= 0`, TBM) modes. The choice MUST be configurable per analysis
domain. Open-world mode SHOULD be the default for novel threat analysis. Closed-world mode
MAY be used for well-characterized domains with exhaustive category lists.

### 4.2 Pignistic Probability Transform

When a decision is required (e.g., generating an alert, classifying a threat), the belief
function at the credal level must be transformed into a probability function at the pignistic
level [SMETS-1990]:

```
                      m(A)            1
BetP(theta_i) = sum  ------  *  ------------          for theta_i in Theta
               A containing theta_i  |A|     1 - m(empty_set)
```

This transform distributes the mass of composite hypotheses equally among their constituent
elements and normalizes by removing the open-world mass.

**Interpretation**: BetP is the probability an analyst SHOULD use when forced to bet on a
specific hypothesis. It is not a representation of belief (that is `Bel`) but a decision aid.

Implementations MUST compute pignistic probabilities only when a discrete decision is required
(alert generation, classification output). Internal fusion operations MUST operate on belief
functions, not pignistic probabilities. Premature pignistic transformation discards uncertainty
information that is valuable for downstream fusion.

### 4.3 Two-Level Architecture: Credal and Pignistic

TBM defines a strict two-level architecture:

| Level | Purpose | Representation | Operations |
|-------|---------|----------------|------------|
| **Credal** | Belief representation and combination | Belief functions `m, Bel, Pl` | Dempster combination, conditioning, marginalization |
| **Pignistic** | Decision making | Probability functions `BetP` | Expected utility maximization, threshold comparison |

The separation is REQUIRED: beliefs are held and combined at the credal level; decisions are
made at the pignistic level. Mixing the levels (e.g., converting to probability before
combining) produces mathematically inconsistent results.

Tsingou's d2ts graph MUST maintain the credal level throughout the correlation and detection
tiers. The pignistic transform SHOULD be applied only at the alert tier when discrete
decisions (alert/no-alert) are required.

---

## 5. Kalman Filtering

### 5.1 Linear Kalman Filter

The Kalman filter [KALMAN-1960] is the optimal recursive estimator for linear-Gaussian
state-space models. It provides the closed-form solution to the recursive Bayesian estimation
equations (Section 2.3) when the system is linear and noise is Gaussian.

**State-space model**:

```
State transition:   x_k = F_k * x_{k-1} + B_k * u_k + w_k
Measurement:        z_k = H_k * x_k + v_k
```

where:
- `x_k in R^n` is the state vector at time `k`
- `F_k in R^{n x n}` is the state transition matrix
- `B_k in R^{n x l}` is the control input matrix
- `u_k in R^l` is the control input vector
- `H_k in R^{m x n}` is the measurement matrix
- `w_k ~ N(0, Q_k)` is the process noise with covariance `Q_k`
- `v_k ~ N(0, R_k)` is the measurement noise with covariance `R_k`

**Predict step**:

```
x_hat_{k|k-1} = F_k * x_hat_{k-1|k-1} + B_k * u_k            [state prediction]
P_{k|k-1}     = F_k * P_{k-1|k-1} * F_k^T + Q_k              [covariance prediction]
```

**Update step**:

```
S_k           = H_k * P_{k|k-1} * H_k^T + R_k                 [innovation covariance]
K_k           = P_{k|k-1} * H_k^T * S_k^{-1}                  [Kalman gain]
y_k           = z_k - H_k * x_hat_{k|k-1}                     [innovation (residual)]
x_hat_{k|k}   = x_hat_{k|k-1} + K_k * y_k                    [state update]
P_{k|k}       = (I - K_k * H_k) * P_{k|k-1}                  [covariance update]
```

The Kalman gain `K_k` optimally balances the prediction uncertainty `P_{k|k-1}` against the
measurement noise `R_k`. When `R_k` is large (noisy measurements), `K_k` is small and the
filter trusts the prediction more. When `P_{k|k-1}` is large (uncertain prediction), `K_k`
is large and the filter trusts the measurement more.

**Optimality**: The Kalman filter minimizes the mean square error `E[||x_k - x_hat_k||^2]`
among all linear estimators. For Gaussian noise, it is the minimum variance unbiased estimator
(MVUE) among all estimators, linear or nonlinear.

Implementations MUST use the Kalman filter for linear-Gaussian tracking problems (e.g.,
tracking signal source transmission intervals, smoothing time-series telemetry).

### 5.2 Extended Kalman Filter (EKF)

For nonlinear state-space models, the Extended Kalman Filter [SMITH-1962] linearizes the
system about the current estimate using first-order Taylor expansion.

**Nonlinear model**:

```
x_k = f(x_{k-1}, u_k) + w_k
z_k = h(x_k) + v_k
```

**Linearization** via Jacobians evaluated at the current estimate:

```
F_k = partial f / partial x |_{x=x_hat_{k-1|k-1}}
H_k = partial h / partial x |_{x=x_hat_{k|k-1}}
```

The standard Kalman filter equations (Section 5.1) are then applied using these linearized
matrices.

**Limitations**:

1. First-order approximation only — fails for strongly nonlinear systems
2. Jacobian computation required — may be analytically intractable
3. Can diverge if linearization error accumulates
4. Not guaranteed optimal — loses the MVUE property of the linear Kalman filter

Implementations SHOULD prefer the UKF (Section 5.3) over the EKF unless the Jacobian is
analytically available and the nonlinearity is mild.

### 5.3 Unscented Kalman Filter (UKF)

The Unscented Kalman Filter [JULIER-UHLMANN-1997] propagates a deterministic set of
**sigma points** through the nonlinear functions, capturing mean and covariance to
second-order accuracy without requiring Jacobian computation.

**Sigma point generation**: For an `n`-dimensional state with mean `x_hat` and covariance `P`:

```
chi_0       = x_hat                                             [central point]
chi_i       = x_hat + (sqrt{(n + lambda) * P})_i               for i = 1, ..., n
chi_{n+i}   = x_hat - (sqrt{(n + lambda) * P})_i               for i = 1, ..., n
```

where `lambda = alpha^2 * (n + kappa) - n` is a scaling parameter, `alpha` controls the spread
of sigma points (typically `alpha = 10^{-3}`), and `kappa` is a secondary scaling parameter
(typically `kappa = 0` or `kappa = 3 - n`).

**Weights**:

```
W_0^m = lambda / (n + lambda)
W_0^c = lambda / (n + lambda) + (1 - alpha^2 + beta)
W_i^m = W_i^c = 1 / (2 * (n + lambda))                        for i = 1, ..., 2n
```

where `beta = 2` is optimal for Gaussian distributions.

**Predict step**: Propagate sigma points through state transition:

```
chi_{k|k-1}^{(i)} = f(chi_{k-1|k-1}^{(i)}, u_k)

x_hat_{k|k-1} = sum_{i=0}^{2n} W_i^m * chi_{k|k-1}^{(i)}

P_{k|k-1} = sum_{i=0}^{2n} W_i^c * (chi_{k|k-1}^{(i)} - x_hat_{k|k-1}) * (chi_{k|k-1}^{(i)} - x_hat_{k|k-1})^T + Q_k
```

**Update step**: Propagate sigma points through measurement function:

```
gamma_k^{(i)} = h(chi_{k|k-1}^{(i)})

z_hat_k = sum_{i=0}^{2n} W_i^m * gamma_k^{(i)}

S_k = sum_{i=0}^{2n} W_i^c * (gamma_k^{(i)} - z_hat_k) * (gamma_k^{(i)} - z_hat_k)^T + R_k

P_{xz} = sum_{i=0}^{2n} W_i^c * (chi_{k|k-1}^{(i)} - x_hat_{k|k-1}) * (gamma_k^{(i)} - z_hat_k)^T

K_k = P_{xz} * S_k^{-1}

x_hat_{k|k} = x_hat_{k|k-1} + K_k * (z_k - z_hat_k)
P_{k|k} = P_{k|k-1} - K_k * S_k * K_k^T
```

**Advantages over EKF**:

| Property | EKF | UKF |
|----------|-----|-----|
| Accuracy | First-order | Second-order |
| Jacobian required | Yes | No |
| Robustness to nonlinearity | Poor for strong nonlinearity | Good |
| Computational cost | O(n^3) + Jacobian | O(n^3) + 2n+1 function evaluations |
| Divergence risk | Higher | Lower |

Implementations SHOULD use the UKF as the default nonlinear filter. EKF MAY be used when
Jacobians are analytically available and nonlinearity is weak (as verified by filter
consistency checks — the normalized innovation squared SHOULD be chi-squared distributed).

### 5.4 Filter Selection Criteria

The following decision tree MUST guide filter selection for each tracking problem:

```
Is the system linear-Gaussian?
  |
  +-- YES --> Use Kalman filter (Section 5.1)
  |
  +-- NO --> Is the nonlinearity mild?
              |
              +-- YES --> Is the Jacobian analytically available?
              |            |
              |            +-- YES --> EKF acceptable; UKF preferred
              |            |
              |            +-- NO --> Use UKF (Section 5.3)
              |
              +-- NO --> Is the state space low-dimensional (n < 10)?
                          |
                          +-- YES --> Use UKF
                          |
                          +-- NO --> Use Particle filter (Section 2.4)
```

Implementations MUST document the filter selection rationale for each tracking application,
including the system model assumptions and the degree of nonlinearity.

---

## 6. Multi-Target Tracking

### 6.1 The Data Association Problem

Multi-target tracking (MTT) addresses the fundamental problem of determining which
measurements originate from which targets when multiple targets and measurements coexist.

**Formal statement**: At time step `k`, given:

- A set of `T_k` predicted tracks `{tau_1, ..., tau_{T_k}}`
- A set of `M_k` measurements `{z_1, ..., z_{M_k}}`
- Clutter (false alarms) with spatial density `lambda_c`

Determine the assignment `theta: {1, ..., M_k} -> {0, 1, ..., T_k}` where `theta(j) = i`
means measurement `j` is assigned to track `i`, and `theta(j) = 0` means measurement `j`
is clutter.

**Gating**: Before association, implementations MUST apply a gating procedure to reduce
the combinatorial space. A measurement `z_j` is within the gate of track `tau_i` if:

```
(z_j - z_hat_i)^T * S_i^{-1} * (z_j - z_hat_i) <= gamma
```

where `z_hat_i` is the predicted measurement for track `i`, `S_i` is the innovation covariance,
and `gamma` is the gate threshold (typically set for 99% probability under chi-squared
distribution with `m` degrees of freedom, where `m` is the measurement dimension).

### 6.2 Nearest Neighbor and Global Nearest Neighbor

**Nearest Neighbor (NN)**: For each track, select the gated measurement with minimum
Mahalanobis distance:

```
theta_NN(i) = argmin_j (z_j - z_hat_i)^T * S_i^{-1} * (z_j - z_hat_i)
```

Simple and fast but commits to a single hard assignment. Breaks down in clutter or with
closely-spaced targets.

**Global Nearest Neighbor (GNN)**: Formulate as a bipartite assignment problem. Minimize
total assignment cost:

```
theta_GNN = argmin_theta sum_{j: theta(j) > 0} c(j, theta(j))
```

where `c(j, i)` is the association cost (negative log-likelihood or Mahalanobis distance).
Solved optimally by the **Hungarian algorithm** [KUHN-1955] in `O(n^3)` time.

GNN provides the optimal single-scan assignment but still commits to hard assignments.
Implementations MUST use GNN (not NN) when multiple tracks compete for the same measurement.

### 6.3 Joint Probabilistic Data Association (JPDA)

JPDA [BAR-SHALOM-1988] computes the posterior probability of each track-measurement
association and updates track states using soft (probabilistic) assignments.

**Association probabilities**: For track `i` and measurement `j`:

```
beta_{ij} = P(theta(j) = i | z_{1:k})
```

computed by summing over all feasible joint association events that include the pairing
`(i, j)`.

**State update**: Each track is updated as a weighted sum over all associations:

```
x_hat_i^{updated} = sum_{j=0}^{M_k} beta_{ij} * x_hat_i^{(j)}
```

where `x_hat_i^{(j)}` is the state updated with measurement `j` (and `j=0` represents no
measurement, i.e., missed detection).

**Covariance update** (includes the spread of conditional means):

```
P_i^{updated} = beta_{i0} * P_i^{predicted} + (1 - beta_{i0}) * P_i^{normal}
                + sum_{j=1}^{M_k} beta_{ij} * (x_hat_i^{(j)} - x_hat_i^{updated}) * (...)^T
```

JPDA handles measurement uncertainty gracefully but assumes a known, fixed number of targets.
Implementations SHOULD use JPDA when targets are well-separated but measurements are noisy.

### 6.4 Multiple Hypothesis Tracking (MHT)

MHT [REID-1979] defers association decisions across multiple time scans by maintaining a
tree of association hypotheses.

**Core principle**: Instead of committing to a single association at time `k`, maintain all
feasible association hypotheses and evaluate them over a sliding window of `N` scans. Future
measurements disambiguate past associations.

**Hypothesis management**:

1. **Generation**: At each scan, expand each existing hypothesis with all feasible associations
2. **Evaluation**: Compute likelihood of each hypothesis given all measurements in the window
3. **Pruning**: Remove hypotheses with probability below threshold `P_min`
4. **Merging**: Combine hypotheses that agree on recent associations
5. **N-scan-back**: Commit to associations older than `N` scans; truncate history

**Types of MHT**:

| Type | Description | Complexity | Use Case |
|------|-------------|------------|----------|
| **HOMHT** | Hypothesis-oriented; global hypothesis tree | Exponential (mitigated by pruning) | Best accuracy; small-to-medium scenarios |
| **TOMHT** | Track-oriented; per-track hypothesis lists | Lower than HOMHT | Scalable; large-scale scenarios |

MHT is optimal in the Neyman-Pearson sense for track initiation and termination decisions.
Implementations SHOULD use MHT when:

- Detection probability is low (`P_D < 0.8`)
- Clutter density is high
- Targets are closely spaced (within gate of each other)
- Track initiation and termination must be handled explicitly

### 6.5 Probability Hypothesis Density (PHD) Filter

The PHD filter [MAHLER-2003] provides a computationally tractable alternative to the full
multi-target Bayes recursion by propagating the first-order moment (intensity function) of
the multi-target state distribution.

**PHD definition**: The Probability Hypothesis Density `D(x)` is a function on the state
space such that:

```
integral_S D(x) dx = E[|X intersection S|]
```

for any region `S` — the integral gives the expected number of targets in `S`.

**PHD prediction**:

```
D_{k|k-1}(x) = integral p_S(xi) * f_k(x | xi) * D_{k-1|k-1}(xi) dxi
                + gamma_k(x)
```

where:
- `p_S(xi)` is the survival probability of a target at state `xi`
- `f_k(x | xi)` is the single-target transition density
- `gamma_k(x)` is the birth intensity (new target appearance rate)

**PHD update**:

```
                                       p_D(x) * g_k(z | x)
D_{k|k}(x) = [1 - p_D(x)] * D_{k|k-1}(x) + sum_z ----------------------------------------- * D_{k|k-1}(x)
                                          kappa_k(z) + integral p_D(xi) * g_k(z | xi) * D_{k|k-1}(xi) dxi
```

where:
- `p_D(x)` is the detection probability at state `x`
- `g_k(z | x)` is the single-target measurement likelihood
- `kappa_k(z)` is the clutter intensity

**Gaussian Mixture (GM) implementation**: The PHD is approximated as a Gaussian mixture:

```
D(x) = sum_{j=1}^{J} w_j * N(x; mu_j, Sigma_j)
```

The GM-PHD filter maintains the mixture weights, means, and covariances through the
prediction and update equations. Pruning and merging of Gaussian components control
computational cost.

**Key advantage**: The PHD filter does NOT require explicit data association. The number of
targets is estimated as the integral of the PHD over the state space. Targets appear and
disappear naturally through the birth and survival terms.

**GM-PHD component management**: The Gaussian mixture representation requires active
management to prevent unbounded growth:

| Operation | Trigger | Action |
|-----------|---------|--------|
| **Pruning** | Component weight `w_j < T_prune` | Remove component (RECOMMENDED: `T_prune = 10^{-5}`) |
| **Merging** | Mahalanobis distance `d_M(j, k) < U_merge` | Merge into single component (RECOMMENDED: `U_merge = 4.0`) |
| **Capping** | Total components `J > J_max` | Retain top `J_max` by weight (RECOMMENDED: `J_max = 100`) |

**Cardinalized PHD (CPHD) filter**: The PHD filter propagates only the first-order moment,
losing cardinality distribution information. The CPHD filter [MAHLER-2007] jointly propagates
the PHD and the cardinality distribution `p(n) = P(|X| = n)`:

```
CPHD update jointly computes:
  D_{k|k}(x)  — updated PHD (intensity function)
  p_{k|k}(n)  — updated cardinality distribution

Expected target count: N_hat = sum_n n * p(n)
Cardinality variance:  Var(N) = sum_n (n - N_hat)^2 * p(n)
```

The CPHD filter produces significantly better cardinality estimates than the PHD filter,
especially in scenarios with high clutter or low detection probability. Implementations
SHOULD use CPHD over PHD when accurate entity count estimation is required (e.g., "how
many active threat actors are operating in this campaign?").

**Multi-Bernoulli filter**: An alternative RFS approximation that represents the multi-target
state as a multi-Bernoulli distribution — a union of independent Bernoulli processes, each
with existence probability `r_i` and state density `p_i(x)`:

```
pi = {(r_1, p_1), (r_2, p_2), ..., (r_M, p_M)}
```

The multi-Bernoulli filter maintains explicit track identities (unlike PHD/CPHD) while
remaining within the RFS framework. This is RECOMMENDED for Tsingou entity tracking where
entity identity persistence across time steps is required for analyst review.

### 6.6 Random Finite Sets (RFS) Framework

The PHD filter derives from the Random Finite Set (RFS) formalism [MAHLER-2007], which
provides a unified mathematical framework for multi-target tracking.

**RFS definition**: A Random Finite Set `X` is a random variable taking values in the space
of all finite subsets of the state space. The cardinality `|X|` is itself a random variable.

**Multi-target state**: `X_k = {x_k^1, x_k^2, ..., x_k^{N_k}}` where `N_k` is random.

**Multi-target measurement**: `Z_k = {z_k^1, z_k^2, ..., z_k^{M_k}}` where `M_k` is random.

**Multi-target Bayes recursion**:

```
f_{k|k}(X | Z_{1:k}) proportional to g_k(Z_k | X) * integral f_{k|k-1}(X | X') * f_{k-1|k-1}(X' | Z_{1:k-1}) delta X'
```

This recursion is computationally intractable for general distributions (the state space is
the power set of a continuous space). The PHD filter (Section 6.5) and its extensions
(Cardinalized PHD, Multi-Bernoulli) provide tractable approximations.

**Tsingou mapping**: In the SIGINT context, the RFS framework models:

- **State set**: The set of active entities (threat actors, infrastructure nodes, signal emitters)
  with each entity having a continuous state (location, activity level, communication pattern)
- **Measurement set**: The set of observations from all source adapters at each processing cycle
- **Birth model**: New entities appearing (newly discovered signal sources, emerging threats)
- **Death model**: Entities disappearing (signal sources going silent, threats neutralized)
- **Clutter model**: False detections (noise, benign signals misclassified as threats)

Implementations MUST use the RFS framework (via GM-PHD or Cardinalized PHD) for entity
tracking when the number of entities is unknown and variable. This is the expected condition
for Tsingou's multi-source intelligence analysis.

---

## 7. Fuzzy Logic Fusion

### 7.1 Membership Functions and Linguistic Variables

Fuzzy logic [ZADEH-1965] provides a framework for reasoning with imprecise linguistic
concepts. A **fuzzy set** `A` on a universe `X` is defined by a **membership function**
`mu_A: X -> [0, 1]` that assigns each element a degree of membership.

**Common membership function shapes**:

| Shape | Definition | Parameters | Use Case |
|-------|------------|------------|----------|
| **Triangular** | `mu(x) = max(0, 1 - |x - c| / w)` | Center `c`, width `w` | Simple, computationally cheap |
| **Trapezoidal** | Linear ramps with flat top | `[a, b, c, d]` endpoints | Ranges with tolerance band |
| **Gaussian** | `mu(x) = exp(-(x-c)^2 / (2*sigma^2))` | Center `c`, spread `sigma` | Smooth, differentiable |
| **Sigmoidal** | `mu(x) = 1 / (1 + exp(-a*(x-c)))` | Slope `a`, center `c` | One-sided boundaries |

**Linguistic variables**: A fuzzy variable takes linguistic values such as "low", "medium",
"high", each defined by a membership function. For signal strength:

```
mu_low(x) = trapezoidal(x; 0, 0, 20, 40)
mu_medium(x) = triangular(x; 30, 50, 70)
mu_high(x) = trapezoidal(x; 60, 80, 100, 100)
```

Implementations MUST define membership functions for each linguistic variable used in fuzzy
fusion rules. The membership functions MUST be specified in the analysis configuration and
SHOULD be adjustable by analysts.

### 7.2 Mamdani Inference

Mamdani inference [MAMDANI-1975] maps fuzzy inputs to fuzzy outputs via linguistic rules:

**Step 1 — Fuzzification**: Evaluate membership degree for each input:

```
mu_{A_j}(x_0) for each input x_0 and each fuzzy set A_j
```

**Step 2 — Rule evaluation**: For each rule `R_i`:

```
IF x_1 IS A_{i1} AND x_2 IS A_{i2} THEN y IS B_i

firing_strength_i = min(mu_{A_{i1}}(x_1), mu_{A_{i2}}(x_2))     [AND = min]
clipped_output_i(y) = min(firing_strength_i, mu_{B_i}(y))
```

**Step 3 — Aggregation**: Combine all rule outputs:

```
mu_aggregate(y) = max_i clipped_output_i(y)                       [OR = max]
```

**Step 4 — Defuzzification**: Convert fuzzy output to crisp value:

| Method | Formula | Properties |
|--------|---------|------------|
| **Centroid** | `y* = integral y * mu(y) dy / integral mu(y) dy` | Most common; smooth |
| **Bisector** | Divides area into two equal halves | Symmetric interpretation |
| **Mean of maxima** | Average of `y` values where `mu(y)` is maximum | Crisp when output has flat max |

Mamdani inference SHOULD be used for encoding analyst heuristics as linguistic rules, where
interpretability is valued over computational efficiency.

### 7.3 Sugeno Inference

Sugeno (Takagi-Sugeno-Kang) inference [SUGENO-1985] replaces fuzzy output sets with
polynomial functions of the inputs:

```
IF x_1 IS A_{i1} AND x_2 IS A_{i2} THEN y_i = a_i * x_1 + b_i * x_2 + c_i
```

**Defuzzification**: Weighted average of rule outputs:

```
y* = sum_i firing_strength_i * y_i / sum_i firing_strength_i
```

Sugeno inference is computationally more efficient than Mamdani (no centroid integration)
and is well-suited for adaptive systems where rule parameters are learned from data.

Implementations SHOULD use Sugeno inference when fusion rules are learned from training data
or when computational efficiency is critical (real-time processing in the d2ts graph).

### 7.4 Fuzzy-Probabilistic Hybrid Methods

Fuzzy logic and probabilistic methods address different types of uncertainty:

| Uncertainty Type | Appropriate Framework | Example |
|------------------|----------------------|---------|
| **Aleatory** (randomness) | Probability theory | Measurement noise in sensor data |
| **Epistemic** (ignorance) | Dempster-Shafer / TBM | Unknown source reliability |
| **Linguistic** (vagueness) | Fuzzy logic | "signal strength is high" |

Implementations MAY combine these frameworks in a layered architecture:

1. **Fuzzy preprocessing**: Fuzzify raw inputs into linguistic variables
2. **Probabilistic fusion**: Apply Bayesian or DS combination on fuzzified features
3. **Defuzzified output**: Convert fused results back to crisp decisions

This layered approach is RECOMMENDED when inputs include both numeric measurements (handled
probabilistically) and qualitative assessments (handled linguistically).

---

## 8. Intelligence-Specific Fusion

### 8.1 Multi-INT Fusion Framework

Multi-INT fusion combines intelligence from multiple collection disciplines to produce
assessments that no single discipline could achieve alone [WALTZ-LLINAS-1990]. The primary
disciplines relevant to Tsingou:

| Discipline | Abbreviation | Collection Method | Data Characteristics | Tsingou Source |
|------------|--------------|-------------------|---------------------|----------------|
| Signals Intelligence | SIGINT | Electronic interception | Structured metadata, waveforms, timing | WebSocket, NATS subjects |
| Geospatial Intelligence | GEOINT | Imagery, GIS | Coordinates, imagery, terrain models | HTTP APIs (geolocation) |
| Human Intelligence | HUMINT | Human sources | Unstructured reports, subjective assessments | Manual analyst input (DOM layer) |
| Open Source Intelligence | OSINT | Public data | Text, social media, news, documents | RSS feeds, HTTP APIs |
| Measurement & Signature | MASINT | Technical sensors | Spectral signatures, radar, acoustic | Serial (SDR), NATS (sensor networks) |
| Communications Intelligence | COMINT | Communications interception | Voice, data, messaging content | WebSocket streams |
| Electronic Intelligence | ELINT | Radar/emitter interception | Radar parameters, emitter characteristics | Serial (SDR hardware) |

Each discipline produces evidence with different characteristics (structured vs. unstructured,
real-time vs. batch, quantitative vs. qualitative). Implementations MUST normalize evidence
from different disciplines into a common representation before fusion. The BPA representation
(Section 3.1) provides this common basis: each source produces a BPA over the relevant frame
of discernment, regardless of the intelligence discipline.

### 8.2 Source Reliability and Confidence Calibration

The Admiralty Code (NATO STANAG 2511 [STANAG-2511]) provides the standard two-character grading
system for source reliability and information credibility used by NATO member nations and
Five Eyes partners.

**Source reliability grades**:

| Grade | Designation | Description | Numeric Weight `r` |
|-------|-------------|-------------|---------------------|
| **A** | Completely reliable | Historically verified; no significant errors | 1.00 |
| **B** | Usually reliable | Minor inaccuracies in past; generally trustworthy | 0.80 |
| **C** | Fairly reliable | Occasional inaccuracies; use with caution | 0.60 |
| **D** | Not usually reliable | Significant past inaccuracies; requires corroboration | 0.40 |
| **E** | Unreliable | History of invalid information | 0.20 |
| **F** | Cannot be judged | Insufficient history to evaluate | 0.50 (maximum entropy) |

**Information credibility grades**:

| Grade | Designation | Description | Credibility Factor `c` |
|-------|-------------|-------------|------------------------|
| **1** | Confirmed | Independently verified by other sources | 1.00 |
| **2** | Probably true | Consistent with known patterns; not contradicted | 0.80 |
| **3** | Possibly true | Consistent but not confirmed; no contradiction | 0.60 |
| **4** | Doubtful | Inconsistent with some known information | 0.40 |
| **5** | Improbable | Contradicts known information | 0.20 |
| **6** | Cannot be judged | No basis for evaluation | 0.50 (maximum entropy) |

**Composite confidence**: The combined reliability-credibility score:

```
confidence(s, i) = r_s * c_i
```

where `r_s` is the source reliability weight and `c_i` is the credibility factor.

**Mapping to STIX confidence**: The STIX 2.1 confidence field (0-100) is computed as:

```
stix_confidence = floor(confidence(s, i) * 100)
```

| Admiralty | Composite | STIX Range | Semantic |
|-----------|-----------|------------|----------|
| A1 | 1.00 | 95-100 | Confirmed from completely reliable source |
| A2, B1 | 0.80 | 75-89 | High confidence from strong source |
| B2, C1 | 0.60-0.64 | 55-69 | Moderate confidence |
| C2, B3 | 0.48-0.48 | 40-54 | Low-moderate confidence |
| C3, D2 | 0.36 | 30-39 | Low confidence; requires corroboration |
| D3-E5 | 0.08-0.24 | 5-29 | Very low confidence |
| F6 | 0.25 | 20-30 | Unknown — maximum entropy default |

Implementations MUST assign Admiralty grades to each source adapter. The grades MUST be
configurable and SHOULD be updated dynamically based on source track record (the fraction
of past assessments that were subsequently confirmed).

**Dynamic calibration**: Source reliability SHOULD be updated using a Bayesian approach:

```
r_s^{new} = (alpha * confirmed + beta) / (alpha * total + beta + gamma)
```

where `confirmed` is the count of confirmed assessments, `total` is the count of all
assessments, and `alpha, beta, gamma` are smoothing hyperparameters. This update MUST be
logged for audit purposes.

### 8.3 Temporal Fusion

Fusing evidence across time windows introduces temporal ordering, decay, and synchronization
challenges.

**Temporal decay**: Evidence loses relevance over time. The temporal weight for evidence
observed at time `t_obs` evaluated at time `t_now`:

```
w_temporal(t_obs, t_now) = exp(-lambda * (t_now - t_obs))
```

where `lambda > 0` is the decay rate constant. The half-life `t_{1/2} = ln(2) / lambda`
controls the effective memory window.

| Intelligence Domain | Recommended Half-Life | Rationale |
|--------------------|-----------------------|-----------|
| Network infrastructure (IPs, domains) | 24 hours | Infrastructure changes frequently |
| Threat actor TTPs | 30 days | Behavioral patterns evolve slowly |
| Vulnerability intelligence | 7 days | Patching cycles; exploit relevance |
| OSINT news signals | 6 hours | News cycle velocity |

Implementations MUST apply temporal decay to evidence BPAs before combination:

```
m_decayed(A) = w_temporal * m_original(A)
m_decayed(Theta) = m_original(Theta) + (1 - w_temporal) * m_original(A)
```

The decayed mass is redistributed to ignorance (`Theta`), reflecting the increasing
uncertainty about aging evidence.

**Temporal synchronization**: Evidence from different sources arrives with different latencies.
Implementations MUST align evidence to a common time reference before fusion. The d2ts
`window(duration)` operator provides the synchronization mechanism: evidence within the same
window is considered simultaneous for fusion purposes.

**Discounting operator**: An alternative to temporal decay is the discounting operator
[SHAFER-1976], which reduces the strength of a BPA without redistributing to specific
hypotheses:

```
m_discounted(A) = alpha * m_original(A)          for A != Theta
m_discounted(Theta) = 1 - alpha * (1 - m_original(Theta))
```

where `alpha in [0, 1]` is the discounting factor. When `alpha = 1`, no discounting
occurs. When `alpha = 0`, complete discounting reduces the BPA to total ignorance
(`m(Theta) = 1`). The discounting factor SHOULD be computed from temporal decay:

```
alpha(t) = w_temporal(t_obs, t_now) = exp(-lambda * (t_now - t_obs))
```

Discounting preserves the relative distribution of focal element masses while scaling
overall evidence strength, which is mathematically cleaner than the additive decay
formulation. Implementations SHOULD prefer discounting over additive decay for temporal
BPA degradation.

**Temporal ordering constraints**: When fusing evidence from sources with known causal
ordering (e.g., event A necessarily precedes event B), implementations MUST respect temporal
ordering in the fusion process. The d2ts graph's incremental computation model naturally
preserves insertion order; however, out-of-order arrivals (due to network latency) MUST be
handled via buffering within the `window` operator. Evidence that arrives outside the current
window MUST be either discarded or processed in a catch-up pass with appropriate discounting.

### 8.4 Spatial Fusion

Geospatial correlation enables fusion of intelligence based on physical proximity.

**Distance metrics**: For two geographic coordinates `(lat_1, lon_1)` and `(lat_2, lon_2)`:

**Haversine distance** (great-circle distance on a sphere):

```
d = 2 * R * arcsin(sqrt(sin^2((lat_2 - lat_1)/2) + cos(lat_1) * cos(lat_2) * sin^2((lon_2 - lon_1)/2)))
```

where `R = 6371` km is the Earth's mean radius.

**Mahalanobis distance** (accounting for uncertainty ellipses):

```
d_M = sqrt((x_1 - x_2)^T * Sigma^{-1} * (x_1 - x_2))
```

where `Sigma` is the combined covariance of the two position estimates.

**Spatial co-location test**: Two observations are considered co-located if:

```
d_M(x_1, x_2) <= gamma_spatial
```

where `gamma_spatial` is the spatial gate threshold (analogous to the tracking gate in
Section 6.1). The threshold SHOULD be set for 99% probability under the chi-squared
distribution with 2 degrees of freedom: `gamma_spatial = 9.21`.

**Spatial join in d2ts**: The `join` operator SHOULD support spatial predicates:

```
join(stream_A, stream_B, predicate: haversine(A.location, B.location) < threshold)
```

This enables cross-source correlation based on geographic proximity (e.g., correlating
SIGINT intercepts with GEOINT imagery of the same location).

**Covariance intersection**: When fusing position estimates from sources with unknown
correlation (which is the default in multi-INT fusion — the correlation between a SIGINT
and GEOINT estimate of the same entity's position is generally unknown), the covariance
intersection (CI) algorithm [JULIER-UHLMANN-CI-1997] provides a consistent estimate without
requiring knowledge of the cross-correlation:

```
P_fused^{-1} = omega * P_1^{-1} + (1 - omega) * P_2^{-1}
x_fused = P_fused * (omega * P_1^{-1} * x_1 + (1 - omega) * P_2^{-1} * x_2)
```

where `omega in [0, 1]` is chosen to minimize a criterion (typically trace or determinant
of `P_fused`). The optimization over `omega` is a scalar convex problem, solvable in O(1)
per fusion step.

**Properties of CI**:

| Property | Value |
|----------|-------|
| Consistency | Guaranteed (never underestimates covariance) |
| Optimality | Suboptimal (conservative by design) |
| Cross-correlation required | No (key advantage) |
| Computational cost | O(n^3) for n-dimensional state (matrix inversion) |

CI is RECOMMENDED as the default spatial fusion method for Tsingou because:

1. Cross-correlations between intelligence disciplines are rarely known
2. Conservatism (slight overestimation of uncertainty) is preferable to overconfidence
3. Computational cost is equivalent to a single Kalman update

Implementations MUST use covariance intersection (not naive covariance fusion) when the
cross-correlation between position estimates from different sources is unknown. Naive fusion
`P_fused = (P_1^{-1} + P_2^{-1})^{-1}` assumes zero cross-correlation and MUST NOT be
used without explicit justification.

---

## 9. Fusion Quality and Performance

### 9.1 Accuracy Metrics

Implementations MUST compute and report the following accuracy metrics for fusion outputs:

**Continuous state estimation**:

| Metric | Definition | Interpretation |
|--------|------------|----------------|
| **RMSE** | `sqrt(E[||x - x_hat||^2])` | Root mean square error; lower is better |
| **NEES** | `(x - x_hat)^T * P^{-1} * (x - x_hat)` | Normalized estimation error squared; SHOULD be chi-squared(n) |
| **NIS** | `y^T * S^{-1} * y` | Normalized innovation squared; filter consistency check |

**Discrete classification**:

| Metric | Definition | Interpretation |
|--------|------------|----------------|
| **Precision** | `TP / (TP + FP)` | Fraction of positive classifications that are correct |
| **Recall** | `TP / (TP + FN)` | Fraction of actual positives that are detected |
| **F1 score** | `2 * Precision * Recall / (Precision + Recall)` | Harmonic mean of precision and recall |

**Track metrics** (for multi-target tracking):

| Metric | Definition | Interpretation |
|--------|------------|----------------|
| **Track purity** | Fraction of track lifetime correctly associated | Higher is better |
| **Track fragmentation** | Number of track breaks per true target | Lower is better |
| **OSPA** | Optimal Sub-Pattern Assignment distance | Combined localization + cardinality error |

### 9.2 Information-Theoretic Measures

**Mutual information**: Quantifies the information gain from fusion:

```
I(X; Z_fused) = H(X) - H(X | Z_fused)
```

where `H(X)` is the prior entropy and `H(X | Z_fused)` is the posterior entropy after fusion.
Higher `I` means the fusion adds more information.

**Kullback-Leibler divergence**: Measures the "distance" between the fused distribution and
the true distribution:

```
D_KL(P_true || P_fused) = sum_x P_true(x) * log(P_true(x) / P_fused(x))
```

Lower `D_KL` indicates better calibration of the fused distribution.

**Dempster-Shafer specific metrics**:

| Metric | Definition | Use |
|--------|------------|-----|
| **Conflict mass** `K` | `sum_{B cap C = empty} m_1(B) * m_2(C)` | Source disagreement measure |
| **Jousselme distance** | `d_J(m_1, m_2) = sqrt(0.5 * (m_1 - m_2)^T * D * (m_1 - m_2))` | Distance between BPAs |
| **Non-specificity** | `N(m) = sum_{A: m(A)>0} m(A) * log_2(|A|)` | Degree of ignorance in BPA |
| **Strife** | `S(m) = sum_{A} m(A) * sum_{B} m(B) * (1 - |A cap B| / |A cup B|)` | Internal conflict within single BPA |

Implementations MUST log conflict mass `K` for every Dempster combination. Implementations
SHOULD compute Jousselme distance between source BPAs as a pre-combination diagnostic.

### 9.3 Computational Complexity Constraints

Real-time fusion within the d2ts graph imposes computational constraints. The following
complexity bounds MUST be satisfied for real-time operation:

| Algorithm | Time per Step | Space | Maximum Feasible Scale |
|-----------|---------------|-------|------------------------|
| Dempster's rule | `O(2^n)` per source pair | `O(2^n)` | `n <= 15` hypotheses |
| Kalman filter | `O(n^3)` | `O(n^2)` | `n <= 1000` state dimensions |
| UKF | `O(n^3)` | `O(n^2)` | `n <= 500` (more sigma points) |
| Particle filter | `O(N * n)` | `O(N * n)` | `N = 1000, n <= 100` |
| GM-PHD | `O(J * M)` | `O(J)` | `J <= 10000` Gaussians, `M <= 1000` measurements |
| GNN (Hungarian) | `O(k^3)` | `O(k^2)` | `k <= 5000` tracks/measurements |
| MHT | `O(exp)` with pruning | `O(exp)` | `T <= 100` tracks with aggressive pruning |

When the problem exceeds these bounds, implementations MUST either:

1. **Approximate**: Use a tractable approximation (e.g., PHD instead of MHT)
2. **Decompose**: Partition the problem into independent sub-problems
3. **Subsample**: Reduce the input size through gating or attention mechanisms

The choice MUST be documented and the approximation error SHOULD be bounded.

---

## 10. Normative Constraints

The following normative constraints are derived from the mathematical foundations established
in this section:

| ID | Constraint | Derived From | Enforcement |
|----|-----------|--------------|-------------|
| **TSG.4-N1** | All fusion operators MUST be classified by both JDL level and Dasarathy category | Section 1.1, 1.2 | Operator specification review |
| **TSG.4-N2** | Provenance metadata MUST flow through every graph tier | Section 1.3 | Runtime assertion |
| **TSG.4-N3** | Bayesian priors MUST be explicitly specified; no improper priors without justification | Section 2.1 | Configuration validation |
| **TSG.4-N4** | Source likelihood models MUST account for reliability, noise, and false positive rate | Section 2.1 | Source adapter interface contract |
| **TSG.4-N5** | Particle filter resampling MUST trigger when `N_eff < N/2` | Section 2.4 | Runtime monitoring |
| **TSG.4-N6** | Conflict mass `K` MUST be logged for every Dempster combination | Section 3.2 | Audit log requirement |
| **TSG.4-N7** | When `K > 0.9`, combination MUST be flagged and conflict resolution applied | Section 3.3 | Alert generation |
| **TSG.4-N8** | Source reliability weighting MUST be applied BEFORE Dempster combination | Section 3.4 | Operator ordering |
| **TSG.4-N9** | Open-world mode SHOULD be default for novel threat analysis | Section 4.1 | Configuration default |
| **TSG.4-N10** | Pignistic transform MUST be applied only at decision points, NOT during internal fusion | Section 4.2 | Architecture review |
| **TSG.4-N11** | Kalman filter MUST be used for linear-Gaussian; UKF for nonlinear; particle filter for non-Gaussian | Section 5.4 | Filter selection review |
| **TSG.4-N12** | Tracking gates MUST be applied before data association | Section 6.1 | Runtime assertion |
| **TSG.4-N13** | GNN (not NN) MUST be used when multiple tracks compete for measurements | Section 6.2 | Algorithm selection |
| **TSG.4-N14** | RFS framework MUST be used when entity count is unknown and variable | Section 6.6 | Architecture review |
| **TSG.4-N15** | Admiralty grades MUST be assigned to each source adapter | Section 8.2 | Configuration validation |
| **TSG.4-N16** | Temporal decay MUST be applied to evidence BPAs before combination | Section 8.3 | Operator ordering |
| **TSG.4-N17** | Fusion accuracy metrics (RMSE, F1, track purity) MUST be computed and reported | Section 9.1 | Monitoring requirement |
| **TSG.4-N18** | Real-time complexity bounds MUST be satisfied; approximations MUST be documented | Section 9.3 | Performance review |
| **TSG.4-N19** | Covariance intersection MUST be used for spatial fusion when cross-correlation is unknown | Section 8.4 | Algorithm selection |
| **TSG.4-N20** | BN structure learning SHOULD use MMHC with minimum 10x parameters in training data | Section 2.2 | Data quality validation |
| **TSG.4-N21** | GM-PHD component pruning MUST be applied with weight threshold `T_prune <= 10^{-5}` | Section 6.5 | Runtime performance |
| **TSG.4-N22** | Discounting SHOULD be preferred over additive decay for temporal BPA degradation | Section 8.3 | Operator implementation |

---

## 11. Open Questions

| ID | Question | Relevant Section | Impact |
|----|----------|-----------------|--------|
| **OQ-4.1** | Should Tsingou implement full MHT or rely solely on PHD for multi-entity tracking? MHT provides better accuracy for closely-spaced targets but has higher computational cost. | Section 6.4, 6.5 | Algorithm selection |
| **OQ-4.2** | What is the appropriate frame of discernment size limit for Dempster-Shafer fusion? The exponential complexity of `2^n` limits practical frame sizes to `n <= 15`. | Section 3.1, 9.3 | Scalability |
| **OQ-4.3** | Should Bayesian network structure be learned from data or specified by analysts? Data-driven learning requires training data; analyst specification requires domain expertise. | Section 2.2 | Training data requirements |
| **OQ-4.4** | How should temporal decay rates (`lambda`) be calibrated for each intelligence domain? The recommended half-lives in Section 8.3 are heuristic — empirical validation is needed. | Section 8.3 | Configuration tuning |
| **OQ-4.5** | Can fuzzy membership functions be learned from analyst feedback, or must they be manually specified? Adaptive fuzzy systems (ANFIS) could auto-tune from historical assessments. | Section 7.1 | Automation level |
| **OQ-4.6** | How should the TBM open-world mass `m(empty_set)` be initialized? Too high = excessive uncertainty; too low = overconfidence in exhaustive frame. | Section 4.1 | Calibration |

---

## 12. References

- [KALMAN-1960] R. E. Kalman. "A New Approach to Linear Filtering and Prediction Problems." Journal of Basic Engineering, ASME, 82(1):35-45, 1960.
- [SMITH-1962] G. L. Smith, S. F. Schmidt, L. A. McGee. "Application of Statistical Filter Theory to the Optimal Estimation of Position and Velocity on Board a Circumlunar Vehicle." NASA TR R-135, 1962.
- [ZADEH-1965] L. A. Zadeh. "Fuzzy Sets." Information and Control, 8(3):338-353, 1965.
- [DEMPSTER-1967] A. P. Dempster. "Upper and Lower Probabilities Induced by a Multivalued Mapping." Annals of Mathematical Statistics, 38(2):325-339, 1967.
- [MAMDANI-1975] E. H. Mamdani, S. Assilian. "An Experiment in Linguistic Synthesis with a Fuzzy Logic Controller." International Journal of Man-Machine Studies, 7(1):1-13, 1975.
- [SHAFER-1976] G. Shafer. A Mathematical Theory of Evidence. Princeton University Press, 1976.
- [KUHN-1955] H. W. Kuhn. "The Hungarian Method for the Assignment Problem." Naval Research Logistics Quarterly, 2(1-2):83-97, 1955.
- [REID-1979] D. B. Reid. "An Algorithm for Tracking Multiple Targets." IEEE Transactions on Automatic Control, 24(6):843-854, 1979.
- [RASMUSSEN-1983] J. Rasmussen. "Skills, Rules, and Knowledge; Signals, Signs, and Symbols, and Other Distinctions in Human Performance Models." IEEE Transactions on Systems, Man, and Cybernetics, SMC-13(3):257-266, 1983.
- [BERGER-1985] J. O. Berger. Statistical Decision Theory and Bayesian Analysis. Springer, 2nd ed., 1985.
- [SUGENO-1985] M. Sugeno. "An Introductory Survey of Fuzzy Control." Information Sciences, 36(1-2):59-83, 1985.
- [ZADEH-1986] L. A. Zadeh. "A Simple View of the Dempster-Shafer Theory of Evidence and Its Implication for the Rule of Combination." AI Magazine, 7(2):85-90, 1986.
- [YAGER-1987] R. R. Yager. "On the Dempster-Shafer Framework and New Combination Rules." Information Sciences, 41(2):93-137, 1987.
- [BAR-SHALOM-1988] Y. Bar-Shalom, T. E. Fortmann. Tracking and Data Association. Academic Press, 1988.
- [PEARL-1988] J. Pearl. Probabilistic Reasoning in Intelligent Systems: Networks of Plausible Inference. Morgan Kaufmann, 1988.
- [WALTZ-LLINAS-1990] E. Waltz, J. Llinas. Multisensor Data Fusion. Artech House, 1990.
- [SMETS-1990] P. Smets. "The Combination of Evidence in the Transferable Belief Model." IEEE Transactions on Pattern Analysis and Machine Intelligence, 12(5):447-458, 1990.
- [GORDON-1993] N. J. Gordon, D. J. Salmond, A. F. M. Smith. "Novel Approach to Nonlinear/Non-Gaussian Bayesian State Estimation." IEE Proceedings F, 140(2):107-113, 1993.
- [SMETS-KENNES-1994] P. Smets, R. Kennes. "The Transferable Belief Model." Artificial Intelligence, 66(2):191-234, 1994.
- [ZHANG-1994] L. Zhang. "Representation, Independence, and Combination of Evidence in the Dempster-Shafer Theory." Advances in the Dempster-Shafer Theory of Evidence, Wiley, 1994.
- [HO-LEE-1964] Y. C. Ho, R. C. K. Lee. "A Bayesian Approach to Problems in Stochastic Estimation and Control." IEEE Transactions on Automatic Control, 9(4):333-339, 1964.
- [LLINAS-HALL-1997] J. Llinas, D. L. Hall. "An Introduction to Multi-Sensor Data Fusion." Proceedings of IEEE International Symposium on Circuits and Systems, 6:537-540, 1997.
- [DASARATHY-1997] B. V. Dasarathy. "Sensor Fusion Potential Exploitation — Innovative Architectures and Illustrative Applications." Proceedings of IEEE, 85(1):24-38, 1997.
- [JULIER-UHLMANN-1997] S. J. Julier, J. K. Uhlmann. "A New Extension of the Kalman Filter to Nonlinear Systems." Proceedings of AeroSense: 11th International Symposium Aerospace/Defense Sensing, Simulation and Controls, SPIE, 1997.
- [STEINBERG-1999] A. N. Steinberg, C. L. Bowman, F. E. White. "Revisions to the JDL Data Fusion Model." Proceedings of SPIE 3719, Sensor Fusion: Architectures, Algorithms, and Applications III, 1999.
- [MURPHY-2000] C. K. Murphy. "Combining Belief Functions When Evidence Conflicts." Decision Support Systems, 29(1):1-9, 2000.
- [DOUCET-2001] A. Doucet, N. de Freitas, N. Gordon (eds.). Sequential Monte Carlo Methods in Practice. Springer, 2001.
- [MAHLER-2003] R. P. S. Mahler. "Multitarget Bayes Filtering via First-Order Multitarget Moments." IEEE Transactions on Aerospace and Electronic Systems, 39(4):1152-1178, 2003.
- [DENG-2004] Y. Deng, W. Shi, Z. Zhu, Q. Liu. "Combining Belief Functions Based on Distance of Evidence." Decision Support Systems, 38(3):489-493, 2004.
- [BLASCH-2006] E. P. Blasch, S. Plano. "JDL Level 5 Fusion Model: User Refinement Issues and Applications in Group Tracking." Proceedings of SPIE 6235, 2006.
- [MAHLER-2007] R. P. S. Mahler. Statistical Multisource-Multitarget Information Fusion. Artech House, 2007.
- [STANAG-2511] NATO. "Intelligence Procedures." STANAG 2511 (Allied Joint Doctrine for Intelligence Procedures AJP-2.1), Edition B.
- [STIX-2.1] OASIS. "STIX Version 2.1." OASIS Standard, June 2021.
- [CASTANEDO-2013] F. Castanedo. "A Review of Data Fusion Techniques." The Scientific World Journal, 2013, Article 704504.
- [TSAMARDINOS-2006] I. Tsamardinos, L. E. Brown, C. F. Aliferis. "The Max-Min Hill-Climbing Bayesian Network Structure Learning Algorithm." Machine Learning, 65(1):31-78, 2006.
- [JULIER-UHLMANN-CI-1997] S. J. Julier, J. K. Uhlmann. "A Non-Divergent Estimation Algorithm in the Presence of Unknown Correlations." Proceedings of the American Control Conference, 1997.
- [RFC2119] S. Bradner. "Key Words for Use in RFCs to Indicate Requirement Levels." RFC 2119, March 1997.
- [RFC8174] B. Leiba. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words." RFC 8174, May 2017.

---

*End of Section TSG.4*
