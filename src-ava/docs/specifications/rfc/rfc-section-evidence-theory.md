# AVA.10 Evidence Theory (DS/PCR5)

```
Section:       AVA.10 — Evidence Theory (DS/PCR5)
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          III — Algorithms (Normative)
Prerequisites: AVA.9 (Fusion Tiers)
Feeds:         AVA.11 (Tracking & State Estimation), AVA.13 (Output Pipeline)
```

> This section specifies the evidence-theoretic foundations underpinning
> multi-source data fusion in the ava-fusion pipeline. It defines the
> confidence model selection strategy, Basic Probability Assignment (BPA)
> representation, four Dempster-Shafer combination rules, the calibration
> lifecycle, and three risk accumulation models for weak-signal compounding.
> The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
> "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and
> "OPTIONAL" in this document are to be interpreted as described in
> [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava101-conventions-and-terminology)
2.  [Confidence Model Selection](#ava102-confidence-model-selection)
3.  [Predicate Weights & Correlation Discount](#ava103-predicate-weights--correlation-discount)
4.  [Basic Probability Assignment](#ava104-basic-probability-assignment)
5.  [Combination Rules](#ava105-combination-rules)
6.  [Spoofing-Aware Degradation](#ava106-spoofing-aware-degradation)
7.  [Calibration Lifecycle](#ava107-calibration-lifecycle)
8.  [Risk Accumulation Models](#ava108-risk-accumulation-models)
9.  [Temporal Decay Models](#ava109-temporal-decay-models)
10. [Normative Requirements Summary](#ava1010-normative-requirements-summary)
11. [References](#ava1011-references)

---

## AVA.10.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.10.1.1 Terminology

| Term | Definition |
|------|-----------|
| **BPA** | Basic Probability Assignment — a mass function over a frame of discernment |
| **Frame of discernment** | The set of mutually exclusive hypotheses theta |
| **Focal element** | A subset of theta with non-zero mass |
| **Belief** | Lower bound on probability: `Bel(A) = sum m(B) for B subset A` |
| **Plausibility** | Upper bound on probability: `Pl(A) = sum m(B) for B intersect A != empty` |
| **Pignistic probability** | Decision-theoretic transform from BPA to point probabilities (Smets 1990) |
| **Conflict mass** | The mass assigned to the empty set during combination |
| **ECE** | Expected Calibration Error — mean absolute gap between predicted and observed accuracy |
| **NoisyOr** | Probabilistic OR gate: `P = 1 - prod(1 - s_i)` |

---

## AVA.10.2 Confidence Model Selection

The pipeline provides three confidence combination strategies, selectable
per entity class via `ConfidenceModel` (`ava-fusion/src/confidence.rs:24-28`):

```rust
pub enum ConfidenceModel {
    WeightedAverage,   // Default: simple, interpretable, calibratable
    LogOdds,           // Better mathematical properties for extreme values
    DempsterShafer,    // Expert mode with explicit ignorance representation
}
```

**AVA.10-R1**: Implementations MUST default to `WeightedAverage` when no model
is explicitly configured (`confidence.rs:30-34`).

**AVA.10-R2**: When `DempsterShafer` is selected, the implementation MUST
consult `DempsterShaferConfig` for the combination rule and conflict threshold
(`confidence.rs:178-190`).

### AVA.10.2.1 Selection Guidance

| Model | Use When | Trade-off |
|-------|----------|-----------|
| WeightedAverage | Standard multi-source fusion, operator-tunable | No ignorance representation |
| LogOdds | Extreme confidence values, sensor reliability scoring | Unbounded intermediate values |
| DempsterShafer | Conflicting evidence, explicit "don't know" required | O(F^2) per combination for PCR5 |

---

## AVA.10.3 Predicate Weights & Correlation Discount

### AVA.10.3.1 Five-Dimensional Predicate Weights

Tier 2 soft-key fusion operates over five predicate dimensions
(`confidence.rs:40-65`):

| Dimension | Default Weight | Purpose |
|-----------|---------------|---------|
| Spatial | 0.35 | Geographic proximity |
| Temporal | 0.25 | Time-of-arrival correlation |
| Spectral | 0.20 | RF signature matching |
| Behavioral | 0.15 | Movement pattern correlation |
| Semantic | 0.05 | Named-entity and metadata overlap |

**AVA.10-R3**: Predicate weights MUST sum to 1.0 within epsilon (1e-10).
The default weights are validated by test `predicate_weights_default_sums_to_one`
(`confidence.rs:392-396`).

### AVA.10.3.2 Correlation Matrix

A 5x5 symmetric matrix discounts double-counted evidence between correlated
dimensions (`confidence.rs:79-96`):

```
         spa   tmp   spc   beh   sem
spa    [ 1.0   0.6   0.1   0.4   0.05 ]
tmp    [ 0.6   1.0   0.1   0.3   0.1  ]
spc    [ 0.1   0.1   1.0   0.05  0.0  ]
beh    [ 0.4   0.3   0.05  1.0   0.1  ]
sem    [ 0.05  0.1   0.0   0.1   1.0  ]
```

**AVA.10-R4**: The correlation matrix MUST be symmetric. Diagonal entries
MUST be 1.0. Validated by tests `correlation_matrix_default_is_symmetric`
and `correlation_matrix_diagonal_is_one` (`confidence.rs:423-441`).

---

## AVA.10.4 Basic Probability Assignment

### AVA.10.4.1 Representation

BPAs use a bitset encoding where each bit position corresponds to a hypothesis
in the frame of discernment theta (`confidence.rs:196-235`):

```rust
pub struct FocalElement {
    pub hypothesis_set: u64,  // Bitset: bit i = hypothesis H_i
    pub mass: f64,            // Mass assigned (0.0-1.0)
}

pub struct BasicProbabilityAssignment {
    pub frame_size: u8,                    // |theta| <= 64
    pub focal_elements: Vec<FocalElement>, // Ordered by hypothesis_set
}
```

**Bitset examples** (`confidence.rs:202-206`):
- `0b001` = {H0} (singleton)
- `0b011` = {H0, H1} (disjunction)
- `0b111` = {H0, H1, H2} = theta (full ignorance)
- `0b000` = empty set (only in TBM)

**AVA.10-R5**: BPAs MUST maintain the invariant that all masses sum to 1.0
within epsilon. The `total_mass()` method validates this (`confidence.rs:251-253`).

### AVA.10.4.2 Vacuous BPA

A vacuous BPA assigns all mass to theta, representing complete ignorance
(`confidence.rs:239-248`):

```rust
pub fn vacuous(frame_size: u8) -> Self {
    let theta = (1u64 << frame_size) - 1;
    Self {
        frame_size,
        focal_elements: vec![FocalElement {
            hypothesis_set: theta,
            mass: 1.0,
        }],
    }
}
```

### AVA.10.4.3 Belief and Plausibility

Two dual measures bracket the true probability (`confidence.rs:277-292`):

- **Belief**: `Bel(A) = sum m(B) for all B subset A`
- **Plausibility**: `Pl(A) = sum m(B) for all B where B intersect A != empty`

For any hypothesis A: `Bel(A) <= P(A) <= Pl(A)`.

### AVA.10.4.4 Pignistic Transform

The pignistic probability (Smets 1990) converts a BPA to point probabilities
for decision-making (`confidence.rs:294-328`):

```
BetP(H_i) = sum_{A: H_i in A} m(A)/|A| * 1/(1 - m(empty))
```

### AVA.10.4.5 Pruning and k-Additivity

Focal elements with mass below epsilon are pruned to bound computation.
Pruned mass is redistributed proportionally (`confidence.rs:257-274`).

**AVA.10-R6**: BPA pruning MUST redistribute mass to preserve the sum-to-one
invariant. Default epsilon is 1e-3 (`confidence.rs:337`).

The `max_additivity` parameter restricts focal elements to sets of size <= k,
providing O(n^2) instead of O(2^n) complexity. Default k=2 retains pairwise
hypotheses (`confidence.rs:339-342`).

---

## AVA.10.5 Combination Rules

Four combination rules are supported (`confidence.rs:152-169`):

```rust
pub enum DsCombinationRule {
    Standard,  // Dempster's original rule (normalised)
    Yager,     // Transfers conflict mass to theta (unknown)
    Tbm,       // Transferable Belief Model (un-normalised)
    Pcr5,      // Proportional Conflict Redistribution #5
}
```

### AVA.10.5.1 Standard Dempster's Rule

For two BPAs m1, m2:

```
m12(A) = [ sum_{B intersect C = A} m1(B)*m2(C) ] / (1 - K)
K = sum_{B intersect C = empty} m1(B)*m2(C)
```

Normalisation by `(1 - K)` redistributes conflict mass proportionally. Fails
when K approaches 1.0 (Zadeh's paradox).

### AVA.10.5.2 Yager's Rule

Transfers all conflict mass to theta instead of normalising:

```
m12(A) = sum_{B intersect C = A} m1(B)*m2(C)    for A != theta
m12(theta) += K
```

More conservative than Dempster: high conflict produces high ignorance rather
than distorted certainty.

### AVA.10.5.3 Transferable Belief Model (TBM)

Un-normalised combination that allows mass on the empty set:

```
m12(A) = sum_{B intersect C = A} m1(B)*m2(C)    for all A including empty
```

Empty set mass represents the degree of internal conflict. Used with the
pignistic transform for final decisions.

### AVA.10.5.4 PCR5 (Smarandache & Dezert 2006)

Proportional Conflict Redistribution #5: redistributes conflict mass
proportionally to each source's commitment to involved hypotheses
(`confidence.rs:166-168`):

```
Complexity: O(F^2) per pair where F = number of focal elements
```

**AVA.10-R7**: PCR5 is NOT associative for n>2 sources. Implementations
MUST use Murphy's average BPA first when combining more than two sources
(`confidence.rs:158`).

### AVA.10.5.5 Conflict Threshold

The `conflict_threshold` parameter controls operator alerting
(`confidence.rs:173-174`):

- At 0.7 (default): warn the operator of high conflict
- At 0.9: the system MUST refuse combination (Zadeh's paradox avoidance)

**AVA.10-R8**: When conflict mass K exceeds `conflict_threshold`, the
implementation MUST NOT proceed with combination under Standard Dempster's
rule. It SHOULD fall back to Yager or PCR5.

---

## AVA.10.6 Spoofing-Aware Degradation

Hard-key (Tier 1) confidence degrades when RI-7 spoofing heuristics flag
an identifier (`confidence.rs:102-120`):

```rust
pub struct SpoofingDiscount {
    pub enabled: bool,       // Default: true
    pub max_discount: f64,   // Default: 0.49
}
```

When enabled, a Tier 1 confidence of 0.99 degrades by up to `max_discount`,
yielding a minimum of 0.50 (forcing the entity into Tier 2 soft-key evaluation).

**AVA.10-R9**: Spoofing discount MUST be enabled by default. The maximum
discount MUST NOT exceed 0.49, preserving a floor above 0.50.

### AVA.10.6.1 Confidence Clamping

All computed confidence scores are clamped to `[min, max]`
(`confidence.rs:133-145`):

- Default min: 0.01 (prevents division by zero in log-odds conversion)
- Default max: 0.99 (prevents false certainty)

---

## AVA.10.7 Calibration Lifecycle

### AVA.10.7.1 Four-Phase Model

The calibration system follows a four-phase lifecycle per signal pair
(`calibration.rs:17-30`):

```
Warmup --> Active --> Degraded --> Failed
  |                     |
  |   (ECE recovers)    |
  +<--------------------+
```

| Phase | Condition | Behavior |
|-------|-----------|----------|
| **Warmup** | < warmup_samples verdicts | Collecting data; no calibration applied |
| **Active** | Sufficient data, ECE below drift_threshold | Calibration curve actively applied |
| **Degraded** | ECE exceeds drift_threshold (0.1) | Warn operator; recalibration recommended |
| **Failed** | ECE exceeds fail_threshold (0.25) | Scores unreliable; operator intervention required |

### AVA.10.7.2 Calibration Configuration

(`calibration.rs:98-116`):

```rust
pub struct CalibrationConfig {
    pub bin_count: u32,          // Default: 10 (deciles)
    pub warmup_samples: u64,     // Default: 500
    pub drift_threshold: f64,    // Default: 0.1
    pub fail_threshold: f64,     // Default: 0.25
}
```

### AVA.10.7.3 Operator Verdicts

Three verdict levels classify operator assessment (`calibration.rs:37-48`):

| Verdict | Meaning |
|---------|---------|
| `Calibrated` | Predicted confidence aligns with observed accuracy |
| `Drifting` | Moderate divergence detected |
| `Uncalibrated` | Large divergence; recalibration required |

### AVA.10.7.4 Calibration Histogram

Each bin in the calibration curve tracks (`calibration.rs:55-66`):

- `predicted`: Mean confidence for fusions in this bin
- `observed`: Fraction of correct fusions in this bin
- `count`: Number of verdicts

The Expected Calibration Error (ECE) is the weighted average of
`|predicted - observed|` across all bins.

**AVA.10-R10**: Calibration snapshots MUST be published to
`tsingou.meta.calibration.{pair}.{timestamp}` with the full histogram,
ECE, phase, and timestamp (`calibration.rs:73-85`).

---

## AVA.10.8 Risk Accumulation Models

### AVA.10.8.1 Risk Categories

Six categories classify risk indicators (`risk.rs:27-42`):

| Category | Code | Weight | Default TTL |
|----------|------|--------|-------------|
| Identity | ID | 0.20 | 24h |
| Kinematic | KIN | 0.20 | 2h |
| Behavioral | BEH | 0.20 | 8h |
| Association | ASSOC | 0.15 | 4h |
| Signal | SIG | 0.15 | 12h |
| Intelligence | INTEL | 0.10 | 72h |

**AVA.10-R11**: Category weights MUST sum to 1.0. Validated by test
`risk_category_default_weights_sum` (`risk.rs:417-419`).

### AVA.10.8.2 Risk Indicators

Each indicator carries (`risk.rs:88-104`):

- `category`: RiskCategory discriminant
- `name`: Human-readable label (e.g., "AIS position drift")
- `score`: Current score in [0.0, 1.0] after temporal decay
- `confidence`: Confidence in the assessment [0.0, 1.0]
- `source`: Producing subsystem (e.g., "absence-detector")
- `timestamp_ms`: Last update epoch

### AVA.10.8.3 Accumulation Methods

Three aggregation strategies are available (`risk.rs:141-161`):

| Method | Formula | Properties |
|--------|---------|------------|
| **NoisyOr** (default) | `1 - prod(1 - s_i)` | Bounded [0,1], commutative, diminishing returns |
| **WeightedSum** | `sum(w_i * s_i)`, clamped | Simple additive, may exceed 1.0 |
| **Max** | `max(s_i)` | Worst-case dominates |

### AVA.10.8.4 Leaky NoisyOr

The Leaky NoisyOr model adds a background leak probability for unmodeled
causes (`risk.rs:308-335`):

```
Standard: P = 1 - prod(1 - s_i)
Leaky:    P = 1 - q0 * prod(1 - s_i)
where q0 = 1 - p_leak
```

Default leak = 0.05 (5% background risk probability). This ensures the
composite risk never drops to exactly zero even with no active indicators.

### AVA.10.8.5 Risk Thresholds

Five classification boundaries for the composite score
(`risk.rs:113-134`):

| Level | Threshold |
|-------|-----------|
| Low | 0.2 |
| Elevated | 0.4 |
| High | 0.6 |
| Severe | 0.8 |
| Critical | 0.9 |

### AVA.10.8.6 Entity Risk Profile

The aggregated profile per entity (`risk.rs:358-373`):

```rust
pub struct EntityRiskProfile {
    pub entity_id: String,
    pub indicators: Vec<RiskIndicator>,
    pub aggregate_score: f64,
    pub last_updated_ms: u64,
    pub trend: RiskTrend,  // Rising | Stable | Falling
}
```

---

## AVA.10.9 Temporal Decay Models

Four decay models govern how indicator scores diminish over time
(`risk.rs:210-302`):

### AVA.10.9.1 Weibull Decay

```
s(t) = s0 * exp(-(t/lambda)^k)
```

- k < 1: Fast initial decay, long tail
- k = 1: Standard exponential
- k > 1: Slow start, abrupt cutoff

Recommended for Identity (k=1.0, lambda=30min), Kinematic (k=0.7, lambda=5min),
Behavioral (k=0.8, lambda=15min), Signal (k=1.5, lambda=10min).

### AVA.10.9.2 Power-Law Decay

```
s(t) = s0 * (1 + t/tau)^(-alpha)
```

Fat-tailed: at t = 10*tau, retains ~9% (for alpha=1). Suitable for
Association (tau=1hr, alpha=0.8) and Intelligence (tau=24hr, alpha=0.5).

Validated by test `decay_model_power_law_fat_tail` (`risk.rs:607-614`).

### AVA.10.9.3 Exponential Decay (Legacy)

```
s(t) = s0 * exp(-ln(2) * t / half_life)
```

Legacy backward-compatible model. At t = half_life, factor = 0.5 exactly.
Validated by test `decay_model_exponential_half_life` (`risk.rs:617-625`).

### AVA.10.9.4 Step-with-Grace Decay

```
s(t) = s0                                         for t <= grace_ms
s(t) = s0 * exp(-ln(2) * (t - grace_ms) / half_life)  for t > grace_ms
```

No decay during the grace period; exponential decay after. Useful for
indicators that should remain at full strength for a minimum observation
window. Validated by test `decay_model_step_with_grace` (`risk.rs:628-638`).

**AVA.10-R12**: Decay models MUST be serialised with an internally-tagged
`"type"` discriminator in camelCase (`risk.rs:226`). Validated by test
`decay_model_tagged_json` (`risk.rs:668-676`).

---

## AVA.10.10 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.10-R1 | Default confidence model MUST be WeightedAverage | MUST |
| AVA.10-R2 | DempsterShafer model MUST consult DempsterShaferConfig | MUST |
| AVA.10-R3 | Predicate weights MUST sum to 1.0 within epsilon | MUST |
| AVA.10-R4 | Correlation matrix MUST be symmetric with diagonal 1.0 | MUST |
| AVA.10-R5 | BPA masses MUST sum to 1.0 within epsilon | MUST |
| AVA.10-R6 | BPA pruning MUST redistribute mass to preserve invariant | MUST |
| AVA.10-R7 | PCR5 with n>2 sources MUST use Murphy's average BPA first | MUST |
| AVA.10-R8 | Combination MUST NOT proceed when conflict exceeds threshold (Standard rule) | MUST NOT |
| AVA.10-R9 | Spoofing discount MUST be enabled by default, max 0.49 | MUST |
| AVA.10-R10 | Calibration snapshots MUST be published to NATS subject | MUST |
| AVA.10-R11 | Risk category weights MUST sum to 1.0 | MUST |
| AVA.10-R12 | Decay models MUST use internally-tagged JSON serialisation | MUST |

---

## AVA.10.11 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [Dempster 1967] Dempster, A.P., "Upper and lower probabilities induced by a multivalued mapping", Ann. Math. Statist. 38(2), 1967.
- [Shafer 1976] Shafer, G., "A Mathematical Theory of Evidence", Princeton University Press, 1976.
- [Yager 1987] Yager, R.R., "On the Dempster-Shafer framework and new combination rules", Inf. Sci. 41(2), 1987.
- [Smets 1990] Smets, P., "The combination of evidence in the transferable belief model", IEEE PAMI, 1990.
- [Smarandache & Dezert 2006] Smarandache, F., Dezert, J., "Proportional conflict redistribution rules for information fusion", Proc. Fusion 2006.
- [Murphy 2000] Murphy, C.K., "Combining belief functions when evidence conflicts", Decision Support Systems 29, 2000.
- [ava-fusion confidence.rs] `ava-fusion/src/confidence.rs` — ConfidenceModel, BPA, DS combination rules
- [ava-fusion calibration.rs] `ava-fusion/src/calibration.rs` — Calibration lifecycle
- [ava-fusion risk.rs] `ava-fusion/src/risk.rs` — Risk accumulation, decay models

---

*End of section AVA.10*
