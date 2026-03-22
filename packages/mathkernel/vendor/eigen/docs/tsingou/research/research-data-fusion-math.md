# Research: Data Fusion Mathematics for Multi-INT Intelligence

```
Topic:          Data Fusion Mathematics
Platform:       Tsingou (SIGINT/OSINT analysis)
Author:         Val (data-fusion-mathematician)
Date:           2026-02-18
Status:         COMPLETE
Lines:          ~600
Sections:       12
Frameworks:     JDL, Dasarathy, Bayesian, Dempster-Shafer, Kalman, PHD, MHT, Fuzzy, TBM
Purpose:        Raw research feeding RFC section TSG.4
```

---

## 1. JDL Data Fusion Model

### 1.1 Historical Context

The Joint Directors of Laboratories (JDL) Data Fusion Group established the original fusion model in 1986 under the U.S. Department of Defense. The model was revised by Steinberg, Bowman, and White (1999) to address criticisms about implied sequential processing. The Data Fusion Information Group (DFIG) further extended it to include Level 5 (User Refinement) and Level 6 (Mission Management).

### 1.2 Level Definitions

| Level | Name | Function | Tsingou Mapping |
|-------|------|----------|-----------------|
| 0 | Sub-Object Data Assessment | Signal-level estimation, pixel/waveform processing, data alignment | Source adapters: RSS, HTTP, WebSocket, NATS ingest |
| 1 | Object Assessment | Entity state estimation from associated reports/tracks | d2ts `map`/`filter` operators — entity extraction |
| 2 | Situation Assessment | Relationship analysis among entities, aggregation into networks | d2ts `join` operator — cross-source correlation |
| 3 | Impact Assessment | Threat evaluation, vulnerability analysis, consequence prediction | Statistical operators — anomaly scoring, z-scores |
| 4 | Process Refinement | Sensor management, adaptive collection tasking | Adaptive source configuration — hot-plug adapters |
| 5 | User Refinement (DFIG) | Cognitive fusion, analyst-in-the-loop hypothesis testing | DOM layer — annotation, drill-down, manual tagging |

### 1.3 Key Properties

- **Non-sequential**: Levels can operate in parallel; Level 4 feeds back to Levels 0-1
- **Recursive**: Level 2 outputs may trigger Level 1 re-association
- **Continuous**: Processing is ongoing, not batch — matches d2ts incremental computation

### 1.4 Criticisms and Responses

1. **Implied ordering**: Addressed by 1999 revision — levels are functional, not sequential
2. **No human element**: Addressed by DFIG Level 5
3. **Vague process refinement**: Level 4 underspecified — active sensor management remains implementation-dependent

---

## 2. Dasarathy Input/Output Taxonomy

### 2.1 Classification Scheme

Dasarathy (1997) classifies fusion by abstraction level of inputs and outputs:

| Category | Input | Output | Description | Tsingou Example |
|----------|-------|--------|-------------|-----------------|
| DAI-DAO | Data | Data | Raw signal-level fusion, noise reduction | Combining redundant RSS feeds for reliability |
| DAI-FEO | Data | Features | Feature extraction from raw data | NLP entity extraction from HTTP API responses |
| FEI-FEO | Features | Features | Feature-level combination and refinement | Merging NER outputs from multiple text sources |
| FEI-DEO | Features | Decisions | Classification/detection from features | Anomaly detection from combined feature vectors |
| DEI-DEO | Decisions | Decisions | Decision-level fusion, voting, arbitration | Fusing multiple classifier outputs for final alert |

### 2.2 Mapping to d2ts Graph Tiers

- **Ingest tier** (source adapters): DAI-DAO — raw signal normalization
- **Transform tier** (`map`/`filter`): DAI-FEO — feature extraction
- **Correlation tier** (`join`): FEI-FEO — cross-source feature fusion
- **Detection tier** (`iterate`/statistical): FEI-DEO — anomaly/pattern classification
- **Alert tier** (output): DEI-DEO — multi-detector consensus

### 2.3 Complementarity with JDL

Dasarathy is orthogonal to JDL: JDL describes *what* is fused; Dasarathy describes *how* abstraction levels transform. A single JDL Level 1 operation could be DAI-FEO (extracting entity features from raw signals) or FEI-FEO (combining features from multiple sensors about the same entity).

---

## 3. Bayesian Inference

### 3.1 Bayes' Theorem for Evidence Combination

Given hypothesis H and evidence E from source i:

```
P(H | E_1, E_2, ..., E_n) = P(E_1, E_2, ..., E_n | H) * P(H) / P(E_1, E_2, ..., E_n)
```

Under conditional independence of sources:

```
P(H | E_1, ..., E_n) proportional to P(H) * product_{i=1}^{n} P(E_i | H)
```

### 3.2 Bayesian Networks

Directed acyclic graphs (DAGs) encoding conditional dependencies:

- **Nodes**: Random variables (signal source states, entity attributes, threat indicators)
- **Edges**: Causal/conditional dependencies
- **Inference**: Belief propagation (exact for trees, approximate for general graphs)

Tsingou application: A Bayesian network can model causal relationships between signal sources (e.g., "network traffic anomaly" -> "port scan" -> "intrusion attempt"), enabling probabilistic inference of higher-level threats from lower-level observations.

### 3.3 Recursive Bayesian Estimation

State estimation as sequential belief update:

```
Predict:  P(x_k | z_{1:k-1}) = integral P(x_k | x_{k-1}) P(x_{k-1} | z_{1:k-1}) dx_{k-1}
Update:   P(x_k | z_{1:k}) = P(z_k | x_k) P(x_k | z_{1:k-1}) / P(z_k | z_{1:k-1})
```

The Kalman filter (Section 5) is the closed-form solution when models are linear-Gaussian. Particle filters (Section 3.4) handle nonlinear/non-Gaussian cases.

### 3.4 Particle Filters (Sequential Monte Carlo)

Approximate the posterior with weighted samples (particles):

```
P(x_k | z_{1:k}) approximately sum_{i=1}^{N} w_k^{(i)} * delta(x_k - x_k^{(i)})
```

Key steps:
1. **Sampling**: Draw particles from proposal distribution
2. **Weighting**: Assign importance weights based on likelihood
3. **Resampling**: Eliminate low-weight particles, duplicate high-weight (systematic/stratified)

Tsingou application: Tracking the "state" of a signal source (active, intermittent, compromised, decoy) as a nonlinear hidden Markov model.

---

## 4. Dempster-Shafer Theory

### 4.1 Frame of Discernment

Let Theta = {theta_1, theta_2, ..., theta_n} be the set of mutually exclusive hypotheses. The power set 2^Theta contains all subsets (including empty set and Theta itself).

### 4.2 Basic Probability Assignment (BPA)

A function m: 2^Theta -> [0,1] where:
- m(empty set) = 0 (under closed-world assumption)
- sum over all A in 2^Theta of m(A) = 1

### 4.3 Belief and Plausibility

```
Belief:       Bel(A) = sum over all B subset of A, B != empty set, of m(B)
Plausibility: Pl(A) = sum over all B intersecting A != empty set, of m(B)
              Pl(A) = 1 - Bel(complement of A)
```

The interval [Bel(A), Pl(A)] represents the epistemic uncertainty about A.

### 4.4 Dempster's Rule of Combination

For independent sources with BPAs m_1 and m_2:

```
m_{1,2}(A) = (1/(1-K)) * sum over B intersect C = A, B,C != empty set, of m_1(B) * m_2(C)
```

where K is the conflict:
```
K = sum over B intersect C = empty set of m_1(B) * m_2(C)
```

### 4.5 The Conflict Problem

When K approaches 1, sources are highly conflicting. Normalization by (1-K) can produce counter-intuitive results (Zadeh's counterexample).

### 4.6 Conflict Resolution Modifications

| Method | Approach | Trade-off |
|--------|----------|-----------|
| **Yager (1987)** | Assign conflict mass to Theta (total ignorance) | Preserves commutativity; inflates ignorance |
| **Zhang (1994)** | Redistribute conflict proportionally to focal elements | Better discrimination; loses associativity |
| **Murphy (2000)** | Average all BPAs first, then combine averaged BPA n-1 times | Simple; loses individual source identity |
| **Deng (2004)** | Weighted average based on inter-source distance | Preserves source weighting; computationally heavier |

### 4.7 Connection to STIX Confidence

STIX confidence scores (0-100) can be mapped to Dempster-Shafer belief functions:
- STIX confidence = Bel(indicator_is_malicious) * 100
- Uncertainty = Pl(A) - Bel(A) captures the analyst's epistemic gap
- Multiple STIX sources combined via Dempster's rule (with appropriate conflict resolution)

---

## 5. Kalman Filtering

### 5.1 Linear Kalman Filter

State-space model:
```
State:       x_k = F_k * x_{k-1} + B_k * u_k + w_k       (w_k ~ N(0, Q_k))
Measurement: z_k = H_k * x_k + v_k                         (v_k ~ N(0, R_k))
```

Predict:
```
x_hat_k|k-1 = F_k * x_hat_{k-1|k-1} + B_k * u_k
P_k|k-1     = F_k * P_{k-1|k-1} * F_k^T + Q_k
```

Update:
```
K_k        = P_k|k-1 * H_k^T * (H_k * P_k|k-1 * H_k^T + R_k)^{-1}
x_hat_k|k  = x_hat_k|k-1 + K_k * (z_k - H_k * x_hat_k|k-1)
P_k|k      = (I - K_k * H_k) * P_k|k-1
```

### 5.2 Extended Kalman Filter (EKF)

For nonlinear systems f(x), h(x):
- Linearize via Jacobians: F_k = partial f / partial x, H_k = partial h / partial x
- Apply standard Kalman equations to linearized system
- First-order approximation; diverges for highly nonlinear systems

### 5.3 Unscented Kalman Filter (UKF)

Uses deterministic sigma points (2n+1 for n-dimensional state):
```
chi_0 = x_hat
chi_i = x_hat + (sqrt((n + lambda) * P))_i      for i = 1,...,n
chi_{n+i} = x_hat - (sqrt((n + lambda) * P))_i   for i = 1,...,n
```

Where lambda = alpha^2 * (n + kappa) - n is a scaling parameter.

Sigma points are propagated through the actual nonlinear function (no Jacobian needed). Mean and covariance reconstructed from propagated points using weights.

Advantage: Second-order accuracy vs. EKF's first-order.

### 5.4 Tsingou Application

- Tracking signal source positions (GEOINT) with Kalman filtering
- Fusing noisy telemetry from multiple adapters (RSS timestamps, HTTP response times)
- Smoothing time-series data in d2ts `window` operators

---

## 6. Multi-Target Tracking

### 6.1 Data Association Problem

Given M measurements and T tracks at time k, determine which measurements originate from which targets (or clutter).

### 6.2 Nearest Neighbor (NN)

Simplest: assign each measurement to the nearest predicted track. Breaks in clutter or closely-spaced targets.

### 6.3 Global Nearest Neighbor (GNN)

Formulate as assignment problem: minimize total association cost. Solved by Hungarian algorithm in O(n^3). Optimal for single-scan association but commits to hard assignments.

### 6.4 Joint Probabilistic Data Association (JPDA)

Soft association: compute probability that each measurement originated from each track. Track state updated as weighted sum over all feasible associations. Handles measurement uncertainty but assumes known number of targets.

### 6.5 Multiple Hypothesis Tracking (MHT)

Defer association decisions across multiple scans. Maintain a tree of association hypotheses; prune low-probability branches. Optimal for complex environments with missed detections and closely-spaced targets. Exponential complexity mitigated by hypothesis pruning, merging, and N-scan-back truncation.

Types:
- **HOMHT** (hypothesis-oriented): Maintains global hypothesis tree
- **TOMHT** (track-oriented): Maintains per-track hypothesis lists

### 6.6 Probability Hypothesis Density (PHD) Filter

Random Finite Set (RFS) approach: model multi-target state as a set-valued random variable.

PHD is the first-order moment (intensity function) of the RFS:
```
D(x) = E[sum over targets of delta(x - x_i)]
```

PHD recursion:
```
Predict: D_{k|k-1}(x) = integral p_S(xi) * f(x|xi) * D_{k-1|k-1}(xi) dxi + gamma_k(x)
Update:  D_{k|k}(x) = [1 - p_D(x) + sum_z p_D(x) * g(z|x) / (kappa(z) + integral p_D(xi) * g(z|xi) * D_{k|k-1}(xi) dxi)] * D_{k|k-1}(x)
```

Avoids explicit data association; handles unknown/varying number of targets.

### 6.7 Tsingou Application

Multi-target tracking maps to tracking multiple entities (IP addresses, domain names, signal emitters) across fused intelligence sources. The PHD filter is especially relevant for scenarios where entities appear and disappear (new signal sources discovered, old ones going silent).

---

## 7. Fuzzy Logic Fusion

### 7.1 Membership Functions

Map crisp input x to degree of membership mu_A(x) in [0,1]:
- **Triangular**: mu(x) = max(0, 1 - |x - c| / w)
- **Trapezoidal**: Flat top with linear ramps
- **Gaussian**: mu(x) = exp(-(x-c)^2 / (2*sigma^2))

### 7.2 Fuzzy Rules

IF-THEN rules with linguistic variables:
```
IF signal_strength IS high AND frequency_stability IS low THEN threat_level IS elevated
```

### 7.3 Mamdani Inference

1. Fuzzify inputs via membership functions
2. Evaluate rules (min for AND, max for OR)
3. Aggregate rule outputs (max over rules)
4. Defuzzify via centroid, bisector, or mean-of-maxima

Output: fuzzy set -> crisp value. Intuitive; maps well to expert knowledge.

### 7.4 Sugeno Inference

Rules produce polynomial outputs instead of fuzzy sets:
```
IF x IS A AND y IS B THEN z = ax + by + c
```

Defuzzify via weighted average. Computationally efficient; suited for adaptive control.

### 7.5 Tsingou Application

Fuzzy rules encode analyst heuristics for signal quality assessment. "IF source_reliability IS high AND signal_consistency IS medium THEN confidence IS moderately_high." Enables linguistic reasoning about uncertainty that complements probabilistic methods.

---

## 8. Transferable Belief Model (TBM)

### 8.1 Distinction from Classical DS Theory

Smets and Kennes (1994) proposed TBM as a non-probabilistic interpretation of belief functions:
- **Open-world assumption**: m(empty set) >= 0 (unknown hypotheses possible)
- **Two-level model**: Credal level (belief representation) + Pignistic level (decision making)

### 8.2 Pignistic Probability

When forced to decide, transform belief to probability:
```
BetP(theta) = sum over A containing theta of m(A) / |A| * 1 / (1 - m(empty set))
```

This distributes mass of composite hypotheses equally among their elements.

### 8.3 Tsingou Application

TBM's open-world assumption is critical for SIGINT: the frame of discernment (set of possible threat categories) may be incomplete. A signal may belong to a category not yet hypothesized. TBM allows m(empty set) > 0 to represent this possibility, rather than forcing normalization as in classical DS theory.

---

## 9. Intelligence-Specific Fusion

### 9.1 Multi-INT Disciplines

| INT | Full Name | Collection Method | Data Type |
|-----|-----------|-------------------|-----------|
| SIGINT | Signals Intelligence | Electronic interception | Waveforms, metadata, intercepts |
| GEOINT | Geospatial Intelligence | Imagery, GIS | Coordinates, imagery, terrain |
| HUMINT | Human Intelligence | Human sources | Reports, assessments (unstructured) |
| OSINT | Open Source Intelligence | Public data | Text, social media, news |
| MASINT | Measurement & Signature | Technical sensors | Spectral, radar, nuclear signatures |
| ELINT | Electronic Intelligence | Radar interception | Radar parameters, waveforms |
| COMINT | Communications Intelligence | Comms interception | Voice, data, messaging content |

### 9.2 Source Reliability: Admiralty/NATO System (STANAG 2511)

Two-character grading:

**Source reliability (A-F)**:
- A: Completely reliable (history of verified accuracy)
- B: Usually reliable (minor inaccuracies)
- C: Fairly reliable (occasional inaccuracies)
- D: Not usually reliable (significant inaccuracies)
- E: Unreliable (history of invalid information)
- F: Cannot be judged (insufficient history)

**Information credibility (1-6)**:
- 1: Confirmed by other independent sources
- 2: Probably true (consistent with known patterns)
- 3: Possibly true (consistent but unconfirmed)
- 4: Doubtful (inconsistent with known patterns)
- 5: Improbable (contradicts known information)
- 6: Cannot be judged (no basis for evaluation)

### 9.3 Mapping to STIX Confidence

STIX 2.1 uses a 0-100 integer confidence scale. The Admiralty system maps:

| Admiralty | STIX Confidence Range | Semantic |
|-----------|----------------------|----------|
| A1 | 90-100 | Confirmed from reliable source |
| B2 | 70-89 | Probably true from usually reliable source |
| C3 | 40-69 | Possibly true from fairly reliable source |
| D4 | 20-39 | Doubtful from unreliable source |
| E5 | 1-19 | Improbable from unreliable source |
| F6 | 0 | Unknown reliability and credibility |

### 9.4 Temporal Fusion

Fusing data across time windows:
- **Synchronization**: Aligning timestamps from different sources (different clocks, latencies)
- **Decay functions**: Older evidence weighted less: w(t) = exp(-lambda * (t_now - t_evidence))
- **Sliding windows**: d2ts `window(duration)` operator maintains temporal context

### 9.5 Spatial Fusion

Geospatial correlation:
- **Co-location**: Entities observed at same location by different INTs
- **Proximity metrics**: Haversine distance for lat/lon, Mahalanobis distance for uncertainty ellipses
- **Spatial join**: d2ts `join` with geospatial predicate (distance < threshold)

---

## 10. Fusion Quality Metrics

### 10.1 Accuracy Metrics

- **RMSE** (Root Mean Square Error): For continuous state estimates
- **Classification accuracy**: For discrete decision fusion
- **Track purity**: Fraction of track lifetime correctly associated

### 10.2 Information-Theoretic Metrics

- **Mutual information**: I(X;Y) between fused output and ground truth
- **Entropy reduction**: H(X) - H(X|fused evidence)
- **Kullback-Leibler divergence**: D_KL(P_fused || P_true) for distribution comparison

### 10.3 Fusion-Specific Metrics

- **Conflict mass**: K from Dempster's rule — high K indicates source disagreement
- **Jousselme distance**: Distance between BPAs for measuring evidence compatibility
- **Normalized evidence distance**: For comparing Murphy/Deng weighted averages

---

## 11. Computational Complexity

| Algorithm | Time Complexity | Space Complexity | Scalability |
|-----------|----------------|------------------|-------------|
| Dempster's rule | O(2^n * 2^n) per combination | O(2^n) | Exponential in frame size |
| Kalman filter | O(n^3) per step (matrix inversion) | O(n^2) | Cubic in state dimension |
| EKF | O(n^3) + Jacobian cost | O(n^2) | Same as Kalman + linearization |
| UKF | O(n^3) for sigma points | O(n^2) | Better accuracy, same complexity |
| Particle filter | O(N * n) per step | O(N * n) | Linear in particles, controllable |
| PHD (GM) | O(J * M) per step | O(J) | J Gaussian components, M measurements |
| GNN (Hungarian) | O(n^3) | O(n^2) | Cubic in tracks/measurements |
| MHT | O(exponential) without pruning | O(exponential) | Requires aggressive pruning |

---

## 12. Sources and Citations

- [STEINBERG-1999] Steinberg, Bowman, White. "Revisions to the JDL Data Fusion Model." SPIE 1999.
- [DASARATHY-1997] Dasarathy. "Sensor Fusion Potential Exploitation." Proceedings of IEEE 1997.
- [DEMPSTER-1967] Dempster. "Upper and Lower Probabilities Induced by a Multivalued Mapping." Annals of Mathematical Statistics 1967.
- [SHAFER-1976] Shafer. "A Mathematical Theory of Evidence." Princeton University Press 1976.
- [YAGER-1987] Yager. "On the Dempster-Shafer Framework and New Combination Rules." Information Sciences 1987.
- [MURPHY-2000] Murphy. "Combining Belief Functions When Evidence Conflicts." Decision Support Systems 2000.
- [KALMAN-1960] Kalman. "A New Approach to Linear Filtering and Prediction Problems." ASME Journal 1960.
- [JULIER-UHLMAN-1997] Julier, Uhlmann. "A New Extension of the Kalman Filter to Nonlinear Systems." SPIE 1997.
- [MAHLER-2003] Mahler. "Multitarget Bayes Filtering via First-Order Multitarget Moments." IEEE Trans. Aerospace 2003.
- [REID-1979] Reid. "An Algorithm for Tracking Multiple Targets." IEEE Trans. Automatic Control 1979.
- [BAR-SHALOM-1988] Bar-Shalom, Fortmann. "Tracking and Data Association." Academic Press 1988.
- [SMETS-KENNES-1994] Smets, Kennes. "The Transferable Belief Model." Artificial Intelligence 1994.
- [ZADEH-1965] Zadeh. "Fuzzy Sets." Information and Control 1965.
- [MAMDANI-1975] Mamdani, Assilian. "An Experiment in Linguistic Synthesis." Int. Journal Man-Machine Studies 1975.
- [STANAG-2511] NATO. "Intelligence Procedures." STANAG 2511 (AJP-2.1).
- [STIX-2.1] OASIS. "STIX Version 2.1." OASIS Standard 2021.
- [CASTANEDO-2013] Castanedo. "A Review of Data Fusion Techniques." Scientific World Journal 2013.
