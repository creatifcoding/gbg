# Fusion Ontology Amendment: R4 + R8 + R9

```
Document:   TSGC-001-A3 — Confidence, Tier 3, Event Ordering
Status:     DRAFT
Created:    2026-02-19
Amends:     TSGC-001 Sections 3.1, 3.2.2, 3.3, 9, 10 (RI-4)
Context:    Grounded theory findings (TSGC-GT-001)
```

> Three amendments to the Fusion Ontology, grounded in evidence from
> 20+ production systems surveyed in TSGC-GT-001.

---

## Amendment R4: Confidence Model Refinements

**Sections amended**: 3.1 (Tier 1 properties), 3.2.2 (Confidence Combination),
9 (Confidence Semantics), 10 (RI-4)

### R4.1: Hard Key Confidence — 0.99, Not 1.0

**Problem**: TSGC-001 Section 3.1 states Tier 1 hard key confidence is "1.0" with
false positive rate "0 (barring spoofing)." The parenthetical acknowledges the
issue but the model ignores it.

**Evidence**: AIS MMSI spoofing is documented in maritime domain awareness
operations — vessels routinely change or forge MMSI to avoid detection.
ADS-B ICAO hex spoofing is technically trivial (unencrypted broadcast protocol).
IP address spoofing is a foundational network attack. Even "authoritative" lookup
tables contain errors — FAA registry has known stale entries.
[TSGC-GT-001 Section 1.6.2, 3.4]

**Amendment**: Replace Section 3.1 properties:

```
CURRENT:
  Properties:
  - Confidence: **1.0** (no ambiguity)
  - Latency: **<1ms** per join
  - False positive rate: **0** (barring spoofing)

AMENDED:
  Properties:
  - Confidence: **0.99** (assumes authentic identifier — see spoofing discount)
  - Latency: **<1ms** per hash lookup (d2ts propagation latency additional)
  - False positive rate: **~0** (non-zero due to spoofing, typos, stale data)
  - Spoofing discount: When RI-7 spoofing heuristics flag an identifier,
    confidence degrades to f(spoofing_indicators):
      No flags:           C = 0.99
      Format anomaly:     C = 0.90
      Behavioral anomaly: C = 0.75
      Known spoofing:     C = 0.50
```

**Rationale**: A confidence model that claims 1.0 for hard keys and then has to
handle spoofing as a special case is structurally brittle. Starting at 0.99 with
degradation pathways is both more honest and more operationally useful. An operator
who sees C=0.75 on a "hard key" match immediately knows something is suspicious.

---

### R4.2: Evidence Correlation Discount

**Problem**: TSGC-001 Section 3.2.2 combines predicate scores via simple weighted
average: `C = SUM(w_i * score_i) / SUM(w_i)`. This assumes predicate scores are
independent. They are not.

**Evidence**: Spatial and temporal proximity are strongly correlated — entities that
are near each other geographically tend to also be near each other temporally
(because they are physically present in the same area at the same time). Treating
spatial and temporal as independent double-counts the same underlying evidence.
Bar-Shalom's track fusion literature explicitly warns that correlated inputs
produce overconfident fusion estimates.
[TSGC-GT-001 Section 1.7.2, 2.3]

**Amendment**: Replace Section 3.2.2:

```
CURRENT:
  C = SUM(w_i * score_i) / SUM(w_i)

AMENDED:
  Step 1: Compute raw weighted score
    C_raw = SUM(w_i * score_i) / SUM(w_i)

  Step 2: Apply correlation discount
    Identify correlated predicate pairs from the correlation matrix:

    CORRELATION MATRIX (default — operator-configurable):
    +------------+----------+----------+----------+------------+----------+
    |            | spatial  | temporal | spectral | behavioral | semantic |
    +------------+----------+----------+----------+------------+----------+
    | spatial    |   1.0    |   0.6    |   0.1    |    0.4     |   0.05   |
    | temporal   |   0.6    |   1.0    |   0.1    |    0.3     |   0.1    |
    | spectral   |   0.1    |   0.1    |   1.0    |    0.05    |   0.0    |
    | behavioral |   0.4    |   0.3    |   0.05   |    1.0     |   0.1    |
    | semantic   |   0.05   |   0.1    |   0.0    |    0.1     |   1.0    |
    +------------+----------+----------+----------+------------+----------+

    For each pair (i, j) where i < j:
      redundancy_ij = correlation_ij * min(score_i, score_j)
      total_redundancy = SUM(w_i * w_j * redundancy_ij) / SUM(w_i)^2

  Step 3: Discounted confidence
    C = C_raw * (1.0 - total_redundancy * discount_factor)
    discount_factor: 0.3 (default — how aggressively to penalize correlation)

  Step 4: Clamp
    C = clamp(C, 0.0, 0.99)
```

**Worked example**:

```
Signal pair: ADS-B at ground level + AIS nearby
  spatial_score  = 0.85  (380m apart, max 500m)
  temporal_score = 0.90  (12s apart, max 60s)
  spectral_score = N/A   (different bands — not applicable)
  behavioral_score = 0.70 (both stationary)
  semantic_score = N/A

CURRENT model:
  C = (0.35*0.85 + 0.25*0.90 + 0.15*0.70) / (0.35 + 0.25 + 0.15)
  C = (0.2975 + 0.225 + 0.105) / 0.75
  C = 0.837

AMENDED model:
  C_raw = 0.837

  Correlated pairs:
    spatial-temporal:   r=0.6, redundancy = 0.6 * min(0.85, 0.90) = 0.51
    spatial-behavioral: r=0.4, redundancy = 0.4 * min(0.85, 0.70) = 0.28
    temporal-behavioral: r=0.3, redundancy = 0.3 * min(0.90, 0.70) = 0.21

  total_redundancy = (0.35*0.25*0.51 + 0.35*0.15*0.28 + 0.25*0.15*0.21)
                   / (0.75)^2
                   = (0.0446 + 0.0147 + 0.0079) / 0.5625
                   = 0.1195

  C = 0.837 * (1.0 - 0.1195 * 0.3) = 0.837 * 0.964 = 0.807
```

The discount reduces C from 0.837 to 0.807 — a modest correction that prevents
the double-counting of correlated evidence from inflating confidence. The effect
is larger when many correlated predicates fire together.

**Rationale**: Simple weighted average is still the base model (production-validated,
operator-interpretable). The correlation discount adds rigor without abandoning
simplicity. The discount factor (0.3) is conservative — it partially corrects
rather than fully decorrelating, which is appropriate given that the correlation
matrix values are estimates.

---

### R4.3: Log-Odds for Extreme Values

**Problem**: Linear confidence scores behave poorly near 0 and 1. A spatial score
of 0.01 (barely within range) combined with temporal of 0.99 (exactly concurrent)
averages to 0.50 — which hides the fact that one dimension is very strong and the
other very weak. This conflation is especially problematic at decision boundaries.

**Amendment**: Add optional log-odds combination as an alternative mode:

```
LOG-ODDS MODE (operator-selectable alternative to weighted average):

  Step 1: Convert scores to log-odds
    lo_i = log(score_i / (1 - score_i))

  Step 2: Weighted combination in log-odds space
    lo_combined = SUM(w_i * lo_i) / SUM(w_i)

  Step 3: Convert back to probability
    C = 1 / (1 + exp(-lo_combined))

  Step 4: Apply correlation discount (same as R4.2)
  Step 5: Clamp to [0.01, 0.99]

  Properties:
    - Strong evidence in one dimension dominates weak evidence in another
    - Extreme scores (near 0 or 1) have outsized influence (intentional)
    - More mathematically rigorous but less intuitively interpretable
    - Undefined for score = 0.0 or 1.0 (clamp inputs to [0.01, 0.99])
```

**Operator interface**: A toggle in the ontology configuration:

```typescript
confidenceMode: Schema.Literal("weighted_average", "log_odds")
// Default: "weighted_average" (production-proven, interpretable)
// Alternative: "log_odds" (better mathematical properties)
```

**Rationale**: Offer the log-odds option for operators who want more rigorous
combination, while keeping weighted average as the default. This follows the
pattern of production systems that offer simple defaults with expert options.

---

### R4.4: Confidence Calibration Framework

**Problem**: TSGC-001 RI-4 asks "When a Tier 2 soft join produces C = 0.72, what
does that MEAN operationally?" The grounded theory found that almost no production
system can answer this with statistical rigor.
[TSGC-GT-001 Section 2.3, 2.7]

**Amendment**: Add a calibration feedback loop specification:

```
CALIBRATION FRAMEWORK:

  Phase 1: Ordinal Mode (Initial deployment)
    - Confidence scores are ORDINAL: higher is better
    - No claim that 0.72 = "correct 72% of the time"
    - Operator validates fusions: accept / reject / uncertain
    - System logs: (fusion_id, confidence, operator_verdict, timestamp)

  Phase 2: Calibration Data Collection
    - After N operator verdicts (minimum: 500 per signal pair type):
      - Bin confidences into deciles: [0.0-0.1), [0.1-0.2), ..., [0.9-1.0)
      - For each bin: actual_accuracy = accepted / (accepted + rejected)
    - Produce calibration curve: predicted_confidence → actual_accuracy

  Phase 3: Recalibration (if data supports it)
    - If calibration curve is monotonic but shifted:
      Apply isotonic regression to map raw scores → calibrated scores
    - If calibration curve is non-monotonic:
      Investigate — indicates a broken predicate or weight misconfiguration
    - Recalibrated scores replace raw scores in the display

  Phase 4: Continuous Monitoring
    - Track calibration drift over time (sliding window of last 1000 verdicts)
    - Alert operator when calibration degrades beyond threshold
    - Log calibration snapshots as NATS signals:
      tsingou.meta.calibration.{signalPairType}.{timestamp}

  SCHEMA:
    const CalibrationVerdict = Schema.Struct({
      fusionId:    Schema.String,
      confidence:  Schema.Number,
      tier:        Schema.Literal(1, 2, 3),
      signalPair:  Schema.String,       // e.g., "adsb_x_ais"
      verdict:     Schema.Literal("accept", "reject", "uncertain"),
      operatorId:  Schema.String,
      timestamp:   Schema.DateTimeUtc,
    })

    const CalibrationSnapshot = Schema.Struct({
      signalPair:  Schema.String,
      sampleSize:  Schema.Int,
      bins:        Schema.Array(Schema.Struct({
        lower:     Schema.Number,
        upper:     Schema.Number,
        count:     Schema.Int,
        accepted:  Schema.Int,
        rejected:  Schema.Int,
        accuracy:  Schema.Number,
      })),
      isMonotonic: Schema.Boolean,
      timestamp:   Schema.DateTimeUtc,
    })
```

**Rationale**: This resolves RI-4 by acknowledging that calibration is an empirical
process, not a mathematical one. Start ordinal (honest about what we don't know),
collect data, calibrate when evidence supports it. This matches the grounded theory
finding that no production system starts with calibrated confidence — they earn
calibration through operational use.

---

### R4.5: Bayesian Confidence Refinement on Signal Arrival

**Problem**: TSGC-001 computes confidence once at join time. In practice, confidence
should INCREASE as more corroborating signals arrive and DECREASE when expected
signals are absent (negative-space detection).

**Amendment**: Add incremental confidence updating:

```
BAYESIAN REFINEMENT:

  On each new signal arrival that matches an existing fusion:

  Step 1: Compute the new signal's individual contribution
    new_score = predicate_evaluation(new_signal, existing_fusion)

  Step 2: Update via Bayesian-inspired rule
    prior_odds = C_current / (1 - C_current)
    likelihood_ratio = new_score / (1 - new_score)  // if corroborating
                     = (1 - new_score) / new_score   // if contradicting
    posterior_odds = prior_odds * likelihood_ratio
    C_updated = posterior_odds / (1 + posterior_odds)

  Step 3: Apply temporal decay
    If time since last corroborating signal > expected_interval * 2:
      C_updated = C_updated * decay_factor
      decay_factor = exp(-lambda * (t_now - t_last_signal))
      lambda = 1.0 / expected_interval  // half-life = expected update rate

  Step 4: Clamp and emit
    C_updated = clamp(C_updated, 0.01, 0.99)
    Emit updated fusion datum with new confidence

  Properties:
    - Corroborating signals increase confidence toward 0.99
    - Contradicting signals decrease confidence toward 0.01
    - Silence (no signals) causes gradual decay (temporal doubt)
    - Each update is O(1) — no recomputation of full predicate stack
    - Maintains the "ordinal" property even before calibration
```

**Rationale**: This bridges the gap between the static weighted average (current
TSGC-001) and full Bayesian networks (academically optimal but impractical). It
uses Bayesian updating for incremental refinement while keeping the initial
computation as a weighted average. The temporal decay addresses the negative-space
concern from R2 (handled by another agent).

---

### R4.6: Updated Section 9 — Confidence Semantics Table

**Amendment**: Replace Section 9 table:

```
CURRENT:
| Output Type | Meaning | Confidence Semantics |
|-------------|---------|----------------------|
| Merge       | Same entity | C = 1.0 (identity) or C > 0.9 |
| Correlate   | Related but distinct | C = 0.65-0.89 |
| Enrich      | Adds context | C = 1.0 (lookup) or variable |
| Flag        | Mismatch detected | C = severity score |

AMENDED:
| Output Type | Meaning | Confidence Semantics | Calibration |
|-------------|---------|----------------------|-------------|
| Merge       | Same entity, different source | C = 0.99 (hard key) or C > 0.90 (high-confidence soft) | Ordinal until calibrated |
| Correlate   | Related entities, not identity | C = 0.65-0.89 (proximity-based) | Ordinal until calibrated |
| Enrich      | Context added to existing entity | C = 0.99 (registry lookup) or variable (external source) | Source reliability rating |
| Absence     | Expected signal missing | C = f(elapsed_time, expected_rate) | Ordinal, domain-specific |
| Flag        | Identifier discrepancy detected | C = severity * (1 - spoofing_probability) | Requires RI-7 spoofing model |
```

Note: "Absence" output type is specified in Amendment R2 (separate agent).
Listed here for table completeness.

---

## Amendment R8: Tier 3 Decomposition into Specific Methods

**Sections amended**: 3.3 (Tier 3), 6.1 (Join Path Registry PAIR 8), 6.2 (Schema)

### R8.1: Problem Statement

TSGC-001 defines Tier 3 as a single catch-all:

```
PAIR 8: * x * (DISABLED by default -- Tier 3 statistical)
  Join type:  behavioral (periodicity correlation)
  Purpose:    Discover hidden correlations
  Warning:    Expensive. High false positive rate. Operator-activated.
```

This is a placeholder, not a design. The grounded theory found that every
production system using statistical correlation employs specific, well-defined
methods — not wildcard "find everything" operators.
[TSGC-GT-001 Section 3.3, V5]

Splunk uses RBA with explicit accumulation rules. Recorded Future uses NLP-powered
pattern mining on specific entity types. Flink CEP uses state-machine-based
pattern matching. None uses a "correlate everything with everything" approach.
[TSGC-GT-001 Section 1.2.3, 1.3.3, 1.5.1]

### R8.2: Decomposed Tier 3 Methods

Replace Section 3.3 and PAIR 8 with four specific Tier 3 methods:

---

#### Tier 3A: Periodicity Correlation

**What it detects**: Signals with matching periodic cadence, suggesting a common
controlling process (C2 beaconing, scheduled reporting, systematic behavior).

**How it works**:

```
PERIODICITY CORRELATION:

  Step 1: Extract inter-arrival times (IATs) per signal source
    For each signal stream S:
      IAT_S = [t_2 - t_1, t_3 - t_2, ..., t_n - t_(n-1)]

  Step 2: Spectral analysis on IATs
    FFT(IAT_S) → dominant_frequency_S, power_spectral_density_S

  Step 3: Cross-spectral comparison
    For each pair (S_i, S_j):
      freq_ratio = dominant_freq_i / dominant_freq_j
      If freq_ratio ∈ {1.0, 0.5, 2.0, 0.333, 3.0} ± tolerance:
        // Harmonic or subharmonic relationship
        periodicity_score = coherence(PSD_i, PSD_j)

  Step 4: Generate candidate correlation if score > threshold

  Configuration:
    min_observations: 20        // minimum IATs to compute FFT
    frequency_tolerance: 0.05   // ±5% frequency match
    coherence_threshold: 0.7    // minimum spectral coherence
    harmonic_orders: [1, 2, 3]  // check fundamental + 2nd/3rd harmonic
    window_size: 3600s          // IAT collection window

  Output:
    PeriodicityCorrelation {
      sources: [signal_id_i, signal_id_j],
      dominant_period_i: Duration,
      dominant_period_j: Duration,
      harmonic_relationship: "1:1" | "1:2" | "2:1" | "1:3" | "3:1",
      coherence: Number,        // 0.0-1.0
      confidence: Number,       // f(coherence, observation_count)
      tier: 3,
      method: "periodicity",
    }

  d2ts operator:
    .reduce(extractIATs)
    .map(computeFFT)
    .join(crossSpectral, within(window_size))
    .filter(coherence > threshold)
```

**Use case**: Detecting C2 beaconing (HTTP beacon every 300s correlated with DNS
queries every 300s), systematic surveillance patterns, automated reporting systems.

---

#### Tier 3B: Co-Occurrence Mining

**What it detects**: Entities that reliably appear together across independent
sources, suggesting an unreported relationship.

**How it works**:

```
CO-OCCURRENCE MINING:

  Step 1: Extract entity sets per signal
    For each signal S:
      entities_S = extract_entities(S)  // IPs, domains, names, locations, ...

  Step 2: Build co-occurrence matrix
    For each entity pair (e_i, e_j):
      co_count = |signals containing both e_i AND e_j|
      e_i_count = |signals containing e_i|
      e_j_count = |signals containing e_j|

  Step 3: Compute association metrics
    support(e_i, e_j) = co_count / total_signals
    confidence(e_i → e_j) = co_count / e_i_count
    lift(e_i, e_j) = support(e_i, e_j) / (support(e_i) * support(e_j))
    // lift > 1.0 means co-occurrence more frequent than chance

  Step 4: Filter by thresholds
    Keep pairs where:
      support > min_support AND
      confidence > min_confidence AND
      lift > min_lift AND
      co_count >= min_observations

  Configuration:
    min_support: 0.001         // appear together in 0.1% of signals
    min_confidence: 0.3        // when e_i appears, e_j appears 30% of time
    min_lift: 2.0              // at least 2x more than random chance
    min_observations: 5        // minimum co-occurrence count
    entity_types: ["ip", "domain", "hash", "name", "geo_cell"]
    time_window: 86400s        // mining window (default: 24h)
    update_interval: 3600s     // recompute every hour

  Output:
    CoOccurrenceCorrelation {
      entity_a: { type: String, value: String },
      entity_b: { type: String, value: String },
      support: Number,
      confidence_ab: Number,   // P(b|a)
      confidence_ba: Number,   // P(a|b)
      lift: Number,
      observation_count: Int,
      sources: [signal_id...], // contributing signals
      confidence: Number,      // f(lift, observation_count)
      tier: 3,
      method: "co_occurrence",
    }

  d2ts operator:
    .map(extractEntities)
    .reduce(buildCoOccurrenceMatrix, within(time_window))
    .filter(meetsThresholds)
```

**Use case**: Discovering that IP 185.220.101.x and domain evil.example.com always
appear in the same threat reports. Detecting that certain vessel MMSIs always
transit the same route together (convoy detection). Finding unreported
infrastructure relationships.

---

#### Tier 3C: Graph Community Detection

**What it detects**: Clusters of entities that are more densely connected to each
other than to the rest of the entity graph. Communities may represent campaigns,
organizations, infrastructure groups, or operational networks.

**How it works**:

```
GRAPH COMMUNITY DETECTION:

  Step 1: Build entity relationship graph from Tier 1 and Tier 2 fusions
    Nodes = all known entities
    Edges = all merge, correlate, and enrich relationships
    Edge weights = confidence scores

  Step 2: Apply community detection algorithm
    Algorithm: Louvain method (default) or Leiden (configurable)
    Resolution parameter: operator-tunable (higher = smaller communities)

  Step 3: Evaluate community quality
    Modularity score: Q > 0.3 indicates meaningful community structure
    Community size filter: min_size <= |community| <= max_size

  Step 4: For each detected community, generate correlation
    Link all community members as "community co-members"
    Confidence = f(modularity_contribution, community_cohesion)

  Configuration:
    algorithm: "louvain" | "leiden"
    resolution: 1.0            // default Louvain resolution
    min_community_size: 3      // minimum entities in a community
    max_community_size: 100    // ignore giant components
    modularity_threshold: 0.3  // minimum Q for meaningful structure
    update_interval: 3600s     // recompute hourly
    edge_weight_minimum: 0.5   // ignore low-confidence edges

  Output:
    CommunityCorrelation {
      community_id: String,
      members: [entity_id...],
      modularity_contribution: Number,
      cohesion: Number,         // internal edge density
      separation: Number,       // ratio of internal to external edges
      confidence: Number,       // f(cohesion, separation, size)
      tier: 3,
      method: "community",
    }

  d2ts operator:
    .reduce(buildGraph)         // accumulate entities and edges
    .map(detectCommunities)     // periodic Louvain/Leiden
    .flatMap(emitMemberships)   // one output per community
```

**Use case**: Discovering that a set of IPs, domains, and email addresses form a
tightly connected cluster — likely belonging to the same campaign or threat actor.
Detecting that a group of vessels consistently correlate spatially — possible fleet
or convoy. Identifying organizational structures in OSINT data.

**Important constraint**: Community detection is computationally expensive (O(n log n)
for Louvain). It should run periodically (hourly), not on every new signal.

---

#### Tier 3D: Anomaly Coincidence

**What it detects**: Independent signals that flag anomalies in overlapping time
windows, suggesting a common causal event.

**How it works**:

```
ANOMALY COINCIDENCE:

  Step 1: Per-source anomaly detection
    For each signal stream, maintain a baseline model:
      - Rate anomaly: signal rate deviates from historical norm (z-score > 3)
      - Value anomaly: signal value exceeds learned bounds
      - Pattern anomaly: signal breaks established periodicity
      - Absence anomaly: expected signal missing (see R2)

  Step 2: Temporal windowing of anomalies
    Collect all anomalies within a coincidence window

  Step 3: Coincidence scoring
    For each time window containing anomalies from 2+ independent sources:
      coincidence_score = |anomalous_sources| / |monitored_sources|
      independence_check: Ensure sources are truly independent
        (not: two ADS-B receivers seeing the same aircraft — that's redundancy)
      rarity_score = product(1 - P(anomaly_i))  // how unlikely is this combo

  Step 4: Generate alert if coincidence exceeds threshold

  Configuration:
    coincidence_window: 60s         // temporal window for grouping anomalies
    min_anomalous_sources: 2        // minimum independent anomalous sources
    coincidence_threshold: 0.3      // minimum coincidence score
    baseline_training_window: 86400s // 24h baseline for anomaly detection
    z_score_threshold: 3.0          // standard deviations for rate anomaly
    independence_groups: {           // sources within a group are NOT independent
      "adsb": ["adsb_receiver_1", "adsb_receiver_2"],
      "ais": ["ais_receiver_1", "ais_receiver_2"],
    }

  Output:
    AnomalyCoincidence {
      window_start: DateTimeUtc,
      window_end: DateTimeUtc,
      anomalies: [{
        source: String,
        type: "rate" | "value" | "pattern" | "absence",
        z_score: Number,
        description: String,
      }],
      coincidence_score: Number,
      rarity_score: Number,
      confidence: Number,           // f(coincidence_score, rarity_score)
      tier: 3,
      method: "anomaly_coincidence",
    }

  d2ts operator:
    .map(detectAnomaly)            // per-source anomaly detection
    .reduce(groupByWindow)         // collect anomalies in coincidence window
    .filter(meetsCoincidenceThreshold)
```

**Use case**: ADS-B signal from an aircraft goes dark (absence anomaly) at the
same time radar detects a track without transponder (pattern anomaly) and RF
direction finder detects an unusual emission (value anomaly). Three independent
anomalies in one time window suggest a deliberate event (transponder shutdown,
jamming, or military activity).

---

### R8.3: Updated Join Path Registry (Replace PAIR 8)

Replace PAIR 8 in Section 6.1:

```
CURRENT:
PAIR 8: * x * (DISABLED by default -- Tier 3 statistical)
  Join type:  behavioral (periodicity correlation)
  Purpose:    Discover hidden correlations
  Warning:    Expensive. High false positive rate. Operator-activated.

REPLACED BY:

PAIR 8A: Periodicity Correlation (Tier 3A — DISABLED by default)
  Left:       Any signal stream with ≥20 observations
  Right:      Any signal stream with ≥20 observations
  Join type:  statistical (spectral cross-correlation)
  Predicates:
    - coherence(FFT(IAT_left), FFT(IAT_right)) > 0.7
    - freq_ratio ∈ harmonic_set ± 5%
  Purpose:    Detect C2 beaconing, systematic behavior
  Confidence: f(coherence, observation_count)
  Cost:       O(n log n) per FFT, periodic recomputation
  Warning:    Requires sufficient observations. Enable per-scenario.

PAIR 8B: Co-Occurrence Mining (Tier 3B — DISABLED by default)
  Left:       Extracted entities from any signal
  Right:      Extracted entities from any signal
  Join type:  statistical (association rule mining)
  Predicates:
    - lift(entity_a, entity_b) > 2.0
    - support > 0.001
    - observations ≥ 5
  Purpose:    Discover unreported infrastructure relationships
  Confidence: f(lift, observation_count)
  Cost:       O(n * |entities|^2), hourly batch
  Warning:    Entity extraction quality directly affects results.

PAIR 8C: Graph Community Detection (Tier 3C — DISABLED by default)
  Left:       Entity relationship graph (from Tier 1 + Tier 2 outputs)
  Right:      N/A (graph-internal operation)
  Join type:  structural (Louvain/Leiden clustering)
  Predicates:
    - modularity_contribution > threshold
    - 3 ≤ community_size ≤ 100
  Purpose:    Discover campaigns, organizational clusters, fleet groups
  Confidence: f(cohesion, separation, size)
  Cost:       O(n log n) Louvain, hourly batch
  Warning:    Results change with resolution parameter. Operator must validate.

PAIR 8D: Anomaly Coincidence (Tier 3D — DISABLED by default)
  Left:       Anomaly events from any source
  Right:      Anomaly events from any independent source
  Join type:  temporal (coincidence within window)
  Predicates:
    - ≥2 independent anomalous sources in window
    - coincidence_score > 0.3
  Purpose:    Detect coordinated events, jamming, multi-domain incidents
  Confidence: f(coincidence_score, rarity_score)
  Cost:       O(n) per anomaly, real-time capable
  Warning:    Anomaly baselines require training period.
```

---

### R8.4: Updated Schema (Section 6.2)

Add to the `joinType` literal and `tier` to support Tier 3 subtypes:

```typescript
// AMENDED joinType — add "statistical" for Tier 3 methods
joinType: Schema.Literal(
  "identity", "spatial", "temporal",
  "spectral", "semantic", "behavioral",
  "statistical"  // NEW — Tier 3 methods
),

// AMENDED tier — add sub-tier for Tier 3 methods
tier: Schema.Literal(1, 2, 3),

// NEW — Tier 3 method specification (only for tier: 3)
tier3Method: Schema.optional(Schema.Literal(
  "periodicity", "co_occurrence", "community", "anomaly_coincidence"
)),

// NEW — Tier 3 method-specific configuration
tier3Config: Schema.optional(Schema.Union(
  Schema.TaggedStruct("PeriodicityConfig", {
    minObservations:     Schema.Int.pipe(Schema.greaterThan(0)),
    frequencyTolerance:  Schema.Number,
    coherenceThreshold:  Schema.Number,
    harmonicOrders:      Schema.Array(Schema.Int),
    windowSize:          Schema.Duration,
  }),
  Schema.TaggedStruct("CoOccurrenceConfig", {
    minSupport:          Schema.Number,
    minConfidence:       Schema.Number,
    minLift:             Schema.Number,
    minObservations:     Schema.Int.pipe(Schema.greaterThan(0)),
    entityTypes:         Schema.Array(Schema.String),
    timeWindow:          Schema.Duration,
    updateInterval:      Schema.Duration,
  }),
  Schema.TaggedStruct("CommunityConfig", {
    algorithm:           Schema.Literal("louvain", "leiden"),
    resolution:          Schema.Number,
    minCommunitySize:    Schema.Int.pipe(Schema.greaterThan(0)),
    maxCommunitySize:    Schema.Int.pipe(Schema.greaterThan(0)),
    modularityThreshold: Schema.Number,
    updateInterval:      Schema.Duration,
    edgeWeightMinimum:   Schema.Number,
  }),
  Schema.TaggedStruct("AnomalyCoincidenceConfig", {
    coincidenceWindow:      Schema.Duration,
    minAnomalousSources:    Schema.Int.pipe(Schema.greaterThan(1)),
    coincidenceThreshold:   Schema.Number,
    baselineTrainingWindow: Schema.Duration,
    zScoreThreshold:        Schema.Number,
    independenceGroups:     Schema.Record(Schema.String, Schema.Array(Schema.String)),
  }),
)),
```

---

### R8.5: Updated Operator Interface (Section 8)

Amend the Tier 3 activation bullet in Section 8:

```
CURRENT:
- **Tier 3 activation** — explicitly enable statistical correlation mining

AMENDED:
- **Tier 3 method control** — individually enable/disable each Tier 3 method:
  - Periodicity Correlation (3A): toggle + min_observations, coherence threshold
  - Co-Occurrence Mining (3B): toggle + support/confidence/lift thresholds
  - Graph Community Detection (3C): toggle + algorithm, resolution parameter
  - Anomaly Coincidence (3D): toggle + coincidence window, z-score threshold
- **Tier 3 results review** — dedicated panel showing Tier 3 findings with
  provenance, method, and confidence. Operator accepts/rejects each finding.
  Accepted findings promote to Tier 2 correlations with method attribution.
```

---

## Amendment R9: Event Ordering Support

**Sections amended**: 3.2.1 (add sequence predicate), 6.1 (add sequence join paths),
6.2 (schema update)

### R9.1: Problem Statement

TSGC-001's predicate stack supports spatial proximity, temporal proximity, spectral
proximity, behavioral similarity, and semantic overlap. All are *co-occurrence*
predicates — they ask "are these signals close together?" None asks "did A happen
before B?"

**Evidence**: Elastic SIEM's EQL sequences ("event A followed by event B within 10
minutes"), Apache Flink CEP's pattern matching ("event A then event B then event C
with non-strict contiguity"), and Esper's EPL temporal patterns all demonstrate
that ordered event sequences are a critical fusion dimension for detecting multi-
stage activity.
[TSGC-GT-001 Section 1.2.4, 1.5.1, 1.5.4]

**Use cases**:
- **AIS dark period**: AIS transmission stops → radar-only track continues → AIS
  resumes. The ORDER matters: stop-then-resume is interesting; simultaneous isn't.
- **C2 staging**: DNS resolution → HTTP connection → data exfiltration. The
  temporal chain indicates command-and-control, not coincidence.
- **Maritime approach**: Vessel decelerates → enters anchorage → small craft
  departs. The sequence reveals transshipment behavior.

### R9.2: Sequence Predicate

Add to Section 3.2.1 Predicate Stack:

```
**Temporal Sequence** (event ordering predicate)

A sequence predicate defines an ORDERED pattern of events across one or
more signal streams.

Syntax:
  SEQUENCE step_1 FOLLOWED_BY step_2 [FOLLOWED_BY step_3 ...]
    WITHIN max_duration
    [WHERE cross_step_predicate]

Each step:
  - Matches a specific signal kind or entity class
  - Has local filter conditions (per-event predicates)
  - Has contiguity mode:
    - STRICT: next event must be the immediate next from that source
    - RELAXED: other events may intervene (default)
    - NON_DETERMINISTIC: any qualifying event in the window

Cross-step predicates:
  - Same entity: step_1.entity_id == step_2.entity_id
  - Spatial continuity: haversine(step_1.geo, step_2.geo) < threshold
  - Temporal gap: step_2.time - step_1.time BETWEEN min AND max

Score:
  sequence_score = completeness * timeliness * specificity

  completeness: fraction of steps matched (1.0 if all matched)
  timeliness: 1.0 - (total_duration / max_duration)
  specificity: product of per-step filter selectivities
```

### R9.3: Sequence Examples

```
SEQUENCE 1: AIS Dark Period Detection
  STEP 1: AIS signal for entity MMSI=X
    Filter: message_type IN (1, 2, 3)  // position reports
  FOLLOWED_BY (RELAXED)
  STEP 2: Absence of AIS for entity MMSI=X
    Filter: elapsed_since_last > expected_interval * 3
  FOLLOWED_BY (RELAXED)
  STEP 3: AIS signal for entity MMSI=X resumes
    Filter: message_type IN (1, 2, 3)
  WITHIN 21600s  // 6 hours
  WHERE:
    haversine(step_1.geo, step_3.geo) < 50km  // didn't teleport
    step_2.duration > 300s                      // gap > 5 minutes

  Output:
    SequenceCorrelation {
      pattern: "ais_dark_period",
      entity: MMSI=X,
      steps: [step_1_signal, step_2_absence, step_3_signal],
      gap_duration: Duration,
      gap_distance: Meters,
      confidence: f(gap_duration, gap_distance, entity_history),
      assessment: "intentional_ais_shutoff" | "equipment_failure" | "coverage_gap",
    }


SEQUENCE 2: C2 Beacon Chain
  STEP 1: DNS query for domain D
    Filter: query_type = "A"
  FOLLOWED_BY (RELAXED, within 30s)
  STEP 2: HTTP connection to IP resolved from D
    Filter: method = "GET" | "POST"
  FOLLOWED_BY (RELAXED, within 60s)
  STEP 3: DNS query for domain D again
    Filter: query_type = "A"
    // Repetition indicates beaconing, not one-off browsing
  WITHIN 600s
  WHERE:
    step_1.source_ip == step_2.source_ip == step_3.source_ip
    step_2.dest_ip IN resolve(step_1.query_name)

  Output:
    SequenceCorrelation {
      pattern: "c2_beacon_chain",
      entity: source_ip,
      steps: [dns_1, http, dns_2],
      beacon_interval: step_3.time - step_1.time,
      confidence: f(interval_regularity, domain_reputation),
    }


SEQUENCE 3: Maritime Transshipment
  STEP 1: Vessel A decelerates
    Filter: entity_class = "Vessel", delta_speed < -3kn
  FOLLOWED_BY (RELAXED, within 1800s)
  STEP 2: Vessel A is stationary in open water
    Filter: speed < 1kn, NOT in_port(geo), NOT in_anchorage(geo)
  FOLLOWED_BY (RELAXED, within 7200s)
  STEP 3: New AIS contact B appears near Vessel A
    Filter: entity_class = "Vessel", first_seen_in_area = true
  WITHIN 14400s  // 4 hours
  WHERE:
    haversine(step_2.geo, step_3.geo) < 1km
    step_3.vessel_type IN ("fishing", "cargo", "unknown")

  Output:
    SequenceCorrelation {
      pattern: "possible_transshipment",
      entities: [vessel_A, vessel_B],
      steps: [deceleration, stationary, contact_appears],
      rendezvous_location: Geo,
      confidence: f(isolation, vessel_types, historical_patterns),
    }
```

### R9.4: Schema Addition

Add to Section 6.2:

```typescript
// NEW — Sequence pattern definition
const SequenceStep = Schema.Struct({
  id:           Schema.String,
  signalKind:   Schema.String,
  entityClass:  Schema.optional(Schema.String),
  filters:      Schema.Array(Schema.Struct({
    field:      Schema.String,
    operator:   Schema.Literal("eq", "neq", "gt", "lt", "gte", "lte", "in", "not_in", "between"),
    value:      Schema.Unknown,  // type depends on field
  })),
  contiguity:   Schema.Literal("strict", "relaxed", "non_deterministic"),
  maxGap:       Schema.optional(Schema.Duration),  // max time to next step
})

const SequencePattern = Schema.Struct({
  id:              Schema.String,
  name:            Schema.String,
  description:     Schema.String,
  steps:           Schema.Array(SequenceStep).pipe(Schema.minItems(2)),
  maxDuration:     Schema.Duration,
  crossPredicates: Schema.Array(Schema.Struct({
    type:          Schema.Literal("same_entity", "spatial_continuity", "temporal_gap"),
    leftStep:      Schema.String,   // step ID
    rightStep:     Schema.String,   // step ID
    parameters:    Schema.Record(Schema.String, Schema.Unknown),
  })),
  outputPattern:   Schema.String,   // pattern name for output
  enabled:         Schema.Boolean,
  tier:            Schema.Literal(2, 3),  // sequences can be Tier 2 or 3
})

// Amend FusionOntology to include sequences
const FusionOntology = Schema.Struct({
  version:          Schema.String,
  scenario:         Schema.String,
  entityClasses:    Schema.Array(EntityClassDef),
  joinPaths:        Schema.Array(JoinPathEntry),
  sequencePatterns: Schema.Array(SequencePattern),  // NEW
  resolvers:        Schema.Array(IdentityResolverDef),
  thresholds:       Schema.Struct({
    fusionConfidence:        Schema.Number,
    spatialWeightDefault:    Schema.Number,
    temporalWeightDefault:   Schema.Number,
    spectralWeightDefault:   Schema.Number,
    behavioralWeightDefault: Schema.Number,
    semanticWeightDefault:   Schema.Number,
  }),
  confidenceMode:   Schema.Literal("weighted_average", "log_odds"),  // NEW (R4.3)
  correlationMatrix: Schema.optional(  // NEW (R4.2)
    Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Number))
  ),
})
```

### R9.5: d2ts Compilation for Sequences

Add to Section 7 (d2ts Compilation):

```
SEQUENCE COMPILATION:

  Each SequencePattern compiles to a d2ts stateful operator chain:

  +------------------+     +------------------+     +------------------+
  | Step 1 Filter    | --> | Step 2 Filter    | --> | Step 3 Filter    |
  | (signal match)   |     | (signal match)   |     | (signal match)   |
  +--------+---------+     +--------+---------+     +--------+---------+
           |                        |                        |
           v                        v                        v
  +--------+---------+     +--------+---------+     +--------+---------+
  | State: Pending   | --> | State: Step1     | --> | State: Step1+2   |
  | (waiting for     |     | (waiting for     |     | (waiting for     |
  |  step 1)         |     |  step 2)         |     |  step 3)         |
  +--------+---------+     +--------+---------+     +--------+---------+
                                                             |
                                                             v
                                                    +--------+---------+
                                                    | SEQUENCE MATCHED |
                                                    | Emit correlation |
                                                    +------------------+

  State management:
    - Each in-progress sequence has a state accumulator in d2ts
    - State includes: matched steps, timestamps, entity bindings
    - Timeout: if maxDuration exceeded, drop the in-progress state
    - Memory bound: max_concurrent_sequences per pattern (configurable)

  Contiguity enforcement:
    - STRICT: state machine resets if non-matching event from same source arrives
    - RELAXED: non-matching events are ignored (state persists)
    - NON_DETERMINISTIC: any qualifying event advances the state

  Incremental maintenance:
    - d2ts differential dataflow naturally handles:
      - New signals arriving (advance state machines)
      - Signal retractions (roll back state machines)
      - Late signals (recompute affected sequences)
```

### R9.6: Updated Operator Interface

Add to Section 8:

```
- **Sequence pattern editor** — visual editor for defining temporal event sequences:
  - Step-by-step construction with signal kind selection
  - Per-step filter conditions with field autocompletion
  - Cross-step predicate definition (same entity, spatial continuity)
  - Duration constraint visualization (timeline view)
  - Test against historical data before enabling in real-time
- **Sequence match viewer** — timeline visualization of matched sequences:
  - Each step shown on timeline with contributing signal
  - Gaps between steps highlighted (especially for absence detection)
  - Confidence breakdown showing completeness, timeliness, specificity
```

---

## Summary of All Changes

| Amendment | Section | Change | Priority |
|-----------|---------|--------|----------|
| R4.1 | 3.1 | Hard key confidence 1.0 → 0.99 with spoofing degradation | MEDIUM |
| R4.2 | 3.2.2 | Evidence correlation discount on weighted average | MEDIUM |
| R4.3 | 3.2.2 | Optional log-odds combination mode | LOW |
| R4.4 | 10 (RI-4) | Confidence calibration framework (4 phases) | MEDIUM |
| R4.5 | 3.2.2 | Bayesian confidence refinement on signal arrival | MEDIUM |
| R4.6 | 9 | Updated confidence semantics table | MEDIUM |
| R8.1 | 3.3 | Problem: Tier 3 is a placeholder | — |
| R8.2 | 3.3 | Four specific Tier 3 methods (3A-3D) | LOW |
| R8.3 | 6.1 | Replace PAIR 8 with PAIRs 8A-8D | LOW |
| R8.4 | 6.2 | Schema additions for Tier 3 configuration | LOW |
| R8.5 | 8 | Operator interface for Tier 3 method control | LOW |
| R9.1 | 3.2.1 | Problem: no event ordering support | — |
| R9.2 | 3.2.1 | Sequence predicate definition | LOW |
| R9.3 | — | Three concrete sequence examples | LOW |
| R9.4 | 6.2 | SequencePattern schema + FusionOntology amendments | LOW |
| R9.5 | 7 | d2ts compilation for sequence patterns | LOW |
| R9.6 | 8 | Operator interface for sequence editing/viewing | LOW |

---

## References

- [TSGC-001] Fusion Ontology Design — `docs/tsingou/concepts/fusion-ontology.md`
- [TSGC-GT-001] Grounded Theory: Data Fusion — `docs/tsingou/concepts/grounded-theory-data-fusion.md`
- [BAR-SHALOM] Bar-Shalom, Y. "Tracking and Data Association." Academic Press, 1988.
- [EQL] Elastic. "Event Query Language." https://www.elastic.co/docs/solutions/security/detect-and-alert/about-detection-rules
- [FLINK-CEP] Apache Flink. "FlinkCEP." https://nightlies.apache.org/flink/flink-docs-master/docs/libs/cep/
- [ESPER] Espertech. "Esper EPL." https://www.espertech.com/esper/
- [LOUVAIN] Blondel et al. "Fast unfolding of communities in large networks." 2008.
- [SPLUNK-RBA] Splunk. "Risk-Based Alerting." https://www.fbcinc.com/source/virtualhall_images/2024_Virtual_Events/CMS_Industry/Splunk/the-splunk-guide-to-risk-based-alerting.pdf
- [MATLAB-T2T] MathWorks. "Track-to-Track Fusion." https://www.mathworks.com/help/fusion/ug/introduction-to-track-to-track-fusion.html
- [OPENCTI] OpenCTI. "Deduplication." https://docs.opencti.io/latest/usage/deduplication/

---

*End of TSGC-001-A3*
