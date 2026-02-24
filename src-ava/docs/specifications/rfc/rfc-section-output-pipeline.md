# AVA.13 Output & Alarm Pipeline

```
Section:       AVA.13 — Output & Alarm Pipeline
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          IV — Output (Normative)
Prerequisites: AVA.9 (Fusion Tiers), AVA.10 (Evidence Theory), AVA.11 (Tracking)
Feeds:         AVA.14 (Deployment Topology)
```

> This section specifies the output data types, severity lattice, risk
> accumulation pipeline, change-point detection, and alarm lifecycle for the
> ava-fusion pipeline. Every fused observation, correlated pair, and alarm
> notification produced by the pipeline flows through the structures defined
> here. The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
> "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and
> "OPTIONAL" in this document are to be interpreted as described in [RFC2119]
> and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava131-conventions-and-terminology)
2.  [Fusion Output Types](#ava132-fusion-output-types)
3.  [Severity Lattice](#ava133-severity-lattice)
4.  [Risk Accumulation](#ava134-risk-accumulation)
5.  [Temporal Decay Models](#ava135-temporal-decay-models)
6.  [CUSUM Change-Point Detection](#ava136-cusum-change-point-detection)
7.  [Alert Suppression](#ava137-alert-suppression)
8.  [Alarm Lifecycle](#ava138-alarm-lifecycle)
9.  [Absence Detection](#ava139-absence-detection)
10. [Normative Requirements Summary](#ava1310-normative-requirements-summary)
11. [References](#ava1311-references)

---

## AVA.13.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.13.1.1 Terminology

| Term | Definition |
|------|-----------|
| **FusedDatum** | A fused track output aggregating observations from multiple sources (`ava-fusion/src/output.rs:34`) |
| **CorrelatedPair** | Two related but distinct entities rendered as graph edges (`ava-fusion/src/output.rs:61`) |
| **FusionOutcome** | Four-valued severity lattice: Ok < Err < Cancelled < Panicked (`ava-fusion/src/output.rs:95`) |
| **NoisyOr** | Probabilistic risk accumulation: `P = 1 - PRODUCT(1 - s_i)` (`ava-fusion-runtime/src/risk/accumulation.rs:36`) |
| **CUSUM** | Cumulative Sum change-point detection (Page 1954) (`ava-fusion-runtime/src/risk/cusum.rs:41`) |
| **AlertSuppressor** | 4-layer filter preventing operator alert fatigue (`ava-fusion-runtime/src/risk/alert_suppression.rs:122`) |
| **AlarmEvaluator** | GenServer actor with obligation-tracked alarm lifecycle (`ava-fusion-runtime/src/actors/alarm_evaluator.rs:173`) |

---

## AVA.13.2 Fusion Output Types

### AVA.13.2.1 FusedDatum

The primary output of Tier 1 and Tier 2 fusion. Each `FusedDatum` represents
a single entity observation aggregated from multiple signal sources.

Source: `ava-fusion/src/output.rs:34-47`

```rust
pub struct FusedDatum {
    pub track_id: String,
    pub position: Option<GeoPoint>,
    pub timestamp_ms: u64,
    pub confidence: f64,              // 0.01-0.99
    pub contributing_sources: Vec<String>,
}
```

All fields MUST serialize to camelCase JSON. The `position` field MUST be
omitted from serialization when `None`. The `contributing_sources` field MUST
be omitted when empty (`ava-fusion/src/output.rs:45-46`).

**AVA.13-R1**: Every FusedDatum MUST include a `confidence` score in the range
[0.01, 0.99], computed from the contributing sources' individual confidence
values as specified in [AVA.10](rfc-section-evidence-theory.md).

### AVA.13.2.2 CorrelatedPair

Correlations between entities that are related but NOT the same. These
are rendered as edges in the visualization layer, distinct from merged
entities which share a single node.

Source: `ava-fusion/src/output.rs:61-70`

```rust
pub struct CorrelatedPair {
    pub left_source: String,
    pub right_source: String,
    pub correlation_score: f64,       // 0.0-1.0
    pub join_type: JoinType,
}
```

**AVA.13-R2**: CorrelatedPair MUST include the `JoinType` that produced the
correlation (Spatial, Temporal, Identity, or Behavioral), enabling downstream
consumers to filter by correlation mechanism.

---

## AVA.13.3 Severity Lattice

### AVA.13.3.1 FusionOutcome<T, E>

A serde-friendly mirror of `asupersync::Outcome<T, E>` providing a four-valued
severity lattice for all pipeline operations.

Source: `ava-fusion/src/output.rs:95-110`

```rust
pub enum FusionOutcome<T, E> {
    Ok(T),
    Err(E),
    Cancelled { reason: String },
    Panicked { message: String },
}
```

The ordering is monotone: `Ok(0) < Err(1) < Cancelled(2) < Panicked(3)`.
The worst outcome takes precedence in monotone aggregation
(`ava-fusion/src/output.rs:138-145`).

**AVA.13-R3**: FusionOutcome MUST serialize as internally tagged JSON using
`"status"` as the tag field and `"content"` as the content field. Example:
`{ "status": "cancelled", "content": { "reason": "timeout" } }`.

### AVA.13.3.2 FusionSeverity

Explicit severity ordering with derived `PartialOrd` and `Ord` implementations.

Source: `ava-fusion/src/output.rs:140-145`

```rust
pub enum FusionSeverity {
    Ok = 0,
    Err = 1,
    Cancelled = 2,
    Panicked = 3,
}
```

### AVA.13.3.3 Obligation Model

Resource obligations track lifecycle guarantees for pipeline operations.

Source: `ava-fusion/src/output.rs:158-201`

| Kind | Description |
|------|-----------|
| `SendPermit` | Channel send permit |
| `Ack` | Received message acknowledgment |
| `Lease` | Remote resource lease |
| `IoOp` | Pending I/O operation |

Lifecycle: `Reserved -> Committed | Aborted | Leaked`. The `Leaked` state
indicates an error where the obligation holder completed without resolution.

**AVA.13-R4**: All FusionObligationKind values MUST serialize in
`SCREAMING_SNAKE_CASE` (e.g., `"SEND_PERMIT"`, `"IO_OP"`).

---

## AVA.13.4 Risk Accumulation

### AVA.13.4.1 Risk Categories

Six risk categories with operator-tunable weights.

Source: `ava-fusion/src/risk.rs:29-78`

| Category | Code | Default Weight | Default TTL |
|----------|------|----------------|-------------|
| Identity | ID | 0.20 | 24h |
| Kinematic | KIN | 0.20 | 2h |
| Behavioral | BEH | 0.20 | 8h |
| Association | ASSOC | 0.15 | 4h |
| Signal | SIG | 0.15 | 12h |
| Intelligence | INTEL | 0.10 | 72h |

**AVA.13-R5**: Default category weights MUST sum to 1.0. This invariant is
verified by `risk_category_default_weights_sum` at `ava-fusion/src/risk.rs:417-419`.

### AVA.13.4.2 Leaky NoisyOr Accumulation

Risk indicators accumulate per-category using the Leaky NoisyOr model:

```
P(risk) = 1 - q0 * PRODUCT(1 - s_i)
```

Where `q0 = 1 - p_leak` is the background "no-cause" probability (default 0.95,
representing 5% background risk).

Source: `ava-fusion-runtime/src/risk/accumulation.rs:21-31`

```rust
pub fn leaky_noisy_or(scores: &[f64], q0: f64) -> f64 {
    if scores.is_empty() {
        return 1.0 - q0;
    }
    let product: f64 = scores.iter()
        .map(|&s| 1.0 - s.clamp(0.0, 1.0))
        .product();
    (1.0 - q0 * product).clamp(0.0, 1.0)
}
```

Properties: bounded [0, 1], commutative, diminishing returns.

### AVA.13.4.3 NoisyMAX Ordinal Classification

Applies Leaky NoisyOr independently at each severity threshold to classify
risk into ordinal levels: Low, Elevated, High, Severe, Critical.

Source: `ava-fusion-runtime/src/risk/accumulation.rs:74-94`

The classifier scans severity levels from highest to lowest. At each level,
only indicators whose severity floor is at or above the current level
contribute. The first level where `P(risk >= level) > decision_threshold`
is returned.

### AVA.13.4.4 Convergence Bonus

Multi-category corroboration is rewarded via a convergence bonus:

```
bonus = beta * (K/N)^gamma * (0.5 + 0.5 * H/H_max)
```

Where K = active categories, N = total categories (6), H = Shannon entropy
of normalized category scores, H_max = ln(K).

Source: `ava-fusion-runtime/src/risk/accumulation.rs:113-154`

Defaults: `beta = 0.3`, `gamma = 1.5`. A balanced 6-category alert yields
a full 0.3 bonus; a single category yields approximately 0.01.

### AVA.13.4.5 Composite Risk Score

The final composite risk combines weighted Leaky NoisyOr with convergence bonus:

Source: `ava-fusion-runtime/src/risk/accumulation.rs:169-191`

```rust
pub fn composite_risk(
    category_scores: &[(f64, f64)],  // (score, weight) per category
    q0: f64,
    beta: f64,
    gamma: f64,
) -> f64 {
    let weighted: Vec<f64> = category_scores.iter()
        .map(|&(score, weight)| (score * weight).clamp(0.0, 1.0))
        .collect();
    let base_risk = leaky_noisy_or(&weighted, q0);
    let bonus = convergence_bonus(&scores_only, 6, beta, gamma);
    (base_risk + bonus).clamp(0.0, 1.0)
}
```

**AVA.13-R6**: Composite risk MUST be clamped to [0.0, 1.0] after adding
the convergence bonus.

---

## AVA.13.5 Temporal Decay Models

### AVA.13.5.1 Decay Model Taxonomy

Four decay models are available, each suited to different indicator categories.

Source: `ava-fusion/src/risk.rs:227-302`

| Model | Formula | Use Case |
|-------|---------|----------|
| Weibull | `s(t) = s0 * exp(-(t/lambda)^k)` | Identity (k=1.0), Kinematic (k=0.7), Signal (k=1.5) |
| PowerLaw | `s(t) = s0 * (1 + t/tau)^(-alpha)` | Association, Intelligence (fat-tailed) |
| Exponential | `s(t) = s0 * exp(-ln(2) * t / half_life)` | Legacy backward-compatible |
| StepWithGrace | `s(t) = s0` for `t <= grace`, then exponential | Grace period before decay |

Recommended per-category models (`ava-fusion/src/risk.rs:217-223`):

| Category | Model | Parameters |
|----------|-------|-----------|
| Identity | Weibull | k=1.0, lambda=30 min |
| Kinematic | Weibull | k=0.7, lambda=5 min |
| Behavioral | Weibull | k=0.8, lambda=15 min |
| Signal | Weibull | k=1.5, lambda=10 min |
| Association | PowerLaw | tau=1 hr, alpha=0.8 |
| Intelligence | PowerLaw | tau=24 hr, alpha=0.5 |

### AVA.13.5.2 Decay and Eviction

Indicators below a minimum threshold are evicted after decay application.

Source: `ava-fusion-runtime/src/risk/decay.rs:45-64`

```rust
pub fn decay_and_evict(
    indicators: &[TimedScore],
    now_ms: f64,
    model: &DecayModel,
    min_score: f64,
) -> Vec<(usize, f64)>
```

**AVA.13-R7**: Indicators MUST be evicted when their decayed score falls below
`min_score` (default 0.01). Category-specific decay models MUST be applied
independently per category via `apply_category_decay`
(`ava-fusion-runtime/src/risk/decay.rs:76-98`).

---

## AVA.13.6 CUSUM Change-Point Detection

### AVA.13.6.1 Tabular CUSUM

Detects upward and downward shifts in risk score time series using
Page's (1954) tabular CUSUM algorithm.

Source: `ava-fusion-runtime/src/risk/cusum.rs:41-135`

```rust
pub struct CusumState {
    pub s_plus: f64,     // Upward cumulative sum
    pub s_minus: f64,    // Downward cumulative sum
    pub mu_0: f64,       // Baseline mean
    pub sigma: f64,      // Baseline std deviation
    pub k_factor: f64,   // Allowance factor (default 0.5)
    pub h_factor: f64,   // Decision threshold factor (default 5.0)
    pub count: u64,
}
```

Default ARL performance (k=0.5*sigma, h=5*sigma):
- ARL0 (false alarm interval): ~465 samples
- ARL1 (detect 1-sigma shift): ~13 samples

**AVA.13-R8**: CusumState MUST reset its cumulative sum to zero after each
detection event. Zero-sigma baselines MUST NOT trigger alarms.

### AVA.13.6.2 Welford Online Statistics

Baseline parameters for CUSUM are established via Welford's (1962) online
algorithm for numerically stable running mean and variance.

Source: `ava-fusion-runtime/src/risk/cusum.rs:146-197`

The `WelfordState::to_cusum()` bridge creates a CUSUM state initialized from
accumulated baseline statistics (`ava-fusion-runtime/src/risk/cusum.rs:188-191`).

---

## AVA.13.7 Alert Suppression

### AVA.13.7.1 Four-Layer Filter

Prevents operator alert fatigue via four sequential layers.

Source: `ava-fusion-runtime/src/risk/alert_suppression.rs:1-13`

| Layer | Mechanism | Default Config |
|-------|-----------|---------------|
| 1. Hysteresis | Deadband: enter at `score > threshold`, exit at `score < threshold - delta` | threshold=0.6, delta=0.09 |
| 2. Score-delta | Suppress unless `|score - last_alerted| > delta` | delta=0.15 |
| 3. Rate limiting | Token bucket: max N alerts per entity per window | capacity=3, window=1h |
| 4. Cooldown | Minimum interval between consecutive alerts | 30s |

### AVA.13.7.2 Suppression Verdicts

Source: `ava-fusion-runtime/src/risk/alert_suppression.rs:93-111`

```rust
pub enum SuppressionVerdict {
    Emit,
    SuppressedHysteresis,
    SuppressedScoreDelta,
    SuppressedRateLimit,
    SuppressedCooldown,
}
```

**AVA.13-R9**: The alert suppression filter MUST evaluate all four layers in
order. A verdict of `Emit` MUST consume one rate-limit token and update the
last-alert timestamp. Suppressed verdicts MUST NOT consume tokens. Each entity
MUST maintain independent suppression state.

### AVA.13.7.3 Configuration

Source: `ava-fusion-runtime/src/risk/alert_suppression.rs:23-54`

```rust
pub struct AlertSuppressionConfig {
    pub threshold: f64,         // 0.6
    pub hysteresis_delta: f64,  // 0.09
    pub score_delta: f64,       // 0.15
    pub bucket_capacity: u32,   // 3
    pub bucket_window_ms: u64,  // 3_600_000 (1h)
    pub cooldown_ms: u64,       // 30_000 (30s)
}
```

---

## AVA.13.8 Alarm Lifecycle

### AVA.13.8.1 AlarmEvaluator GenServer

The alarm lifecycle is modeled as an asupersync GenServer with
obligation-tracked acknowledgments.

Source: `ava-fusion-runtime/src/actors/alarm_evaluator.rs:173-385`

```
Alarm detected -> Reply<AlarmAck> issued (obligation reserved)
    |
    +-- Operator acknowledges -> reply.send(Ack)     (committed)
    +-- Operator shelves      -> reply.send(Shelved)  (committed)
    +-- Timeout/drop          -> PANIC (obligation leaked)
```

This maps alarm acknowledgments to asupersync's obligation model: dropping
a `Reply<AlarmAck>` token without sending constitutes an obligation leak,
caught by the Lab runtime's `ObligationLeakOracle`.

### AVA.13.8.2 Alarm Severity Levels (ISA/IEC 62682)

Source: `ava-fusion-runtime/src/actors/alarm_evaluator.rs:124-134`

| Level | Action Required |
|-------|----------------|
| Low | Informational, no operator action |
| Medium | Operator should investigate |
| High | Immediate operator action required |
| Critical | Safety-critical, auto-escalation |

### AVA.13.8.3 Alarm Conditions

Source: `ava-fusion-runtime/src/actors/alarm_evaluator.rs:112-121`

| Condition | Trigger |
|-----------|---------|
| ThresholdExceeded | `value > limit` |
| RateOfChange | Rate exceeds limit |
| SignalAbsent | Expected signal missing |
| AnomalyDetected | Statistical model detects anomaly |

**AVA.13-R10**: Every raised alarm MUST receive either an Acknowledge or
Shelve response. Alarms unresolved at actor shutdown MUST be logged as
obligation leaks with severity ERROR.

---

## AVA.13.9 Absence Detection

### AVA.13.9.1 AbsenceDetector GenServer

Timer-driven evaluation of expected signals. On each `EvaluationTick`, all
registered expectations are checked against their deadlines.

Source: `ava-fusion-runtime/src/actors/absence_detector.rs:138-402`

The detector maintains per-source state tracking:
- Source ID, signal kind, optional entity ID
- Deadline in milliseconds
- Last-seen timestamp
- Current absence state (boolean latch)

The `evaluate()` method (`absence_detector.rs:165-194`) transitions sources
to absent when `silence_duration > deadline`. Recovery is detected on the
subsequent tick when a fresh signal arrives.

**Virtual Time**: The detector uses `cx.timer_driver()` when available for
deterministic testing under LabRuntime, falling back to the message's
wall-clock timestamp (`absence_detector.rs:344-346`).

---

## AVA.13.10 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.13-R1 | FusedDatum MUST include confidence in [0.01, 0.99] | MUST |
| AVA.13-R2 | CorrelatedPair MUST include the producing JoinType | MUST |
| AVA.13-R3 | FusionOutcome MUST serialize as internally tagged JSON | MUST |
| AVA.13-R4 | FusionObligationKind MUST serialize in SCREAMING_SNAKE_CASE | MUST |
| AVA.13-R5 | Risk category default weights MUST sum to 1.0 | MUST |
| AVA.13-R6 | Composite risk score MUST be clamped to [0.0, 1.0] | MUST |
| AVA.13-R7 | Indicators MUST be evicted below min_score after decay | MUST |
| AVA.13-R8 | CUSUM MUST reset after detection; zero-sigma MUST NOT alarm | MUST |
| AVA.13-R9 | Alert suppression MUST evaluate 4 layers in order with independent per-entity state | MUST |
| AVA.13-R10 | Every raised alarm MUST be acknowledged or shelved; leaks MUST log ERROR | MUST |

---

## AVA.13.11 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [Page1954] Page, E.S., "Continuous Inspection Schemes", Biometrika, 41(1-2), 1954.
- [Welford1962] Welford, B.P., "Note on a method for calculating corrected sums of squares and products", Technometrics, 4(3), 1962.
- [ISA-18.2] ISA-18.2, "Management of Alarm Systems for the Process Industries", 2016.
- [IEC-62682] IEC 62682, "Management of alarm systems for the process industries", 2014.
- [TSGC-001] TSGC-001, "Fusion Ontology Types for Multi-Source Data Fusion", internal specification.
- [ava-fusion output.rs] `ava-fusion/src/output.rs` — FusedDatum, CorrelatedPair, FusionOutcome, severity lattice (422 lines, 16 tests)
- [ava-fusion risk.rs] `ava-fusion/src/risk.rs` — RiskCategory, DecayModel, EntityRiskProfile (703 lines, 25 tests)
- [ava-fusion-runtime accumulation.rs] `ava-fusion-runtime/src/risk/accumulation.rs` — Leaky NoisyOr, convergence bonus (375 lines, 19 tests)
- [ava-fusion-runtime cusum.rs] `ava-fusion-runtime/src/risk/cusum.rs` — CUSUM + Welford (382 lines, 14 tests)
- [ava-fusion-runtime decay.rs] `ava-fusion-runtime/src/risk/decay.rs` — Temporal decay application (289 lines, 11 tests)
- [ava-fusion-runtime alert_suppression.rs] `ava-fusion-runtime/src/risk/alert_suppression.rs` — 4-layer filter (506 lines, 17 tests)
- [ava-fusion-runtime alarm_evaluator.rs] `ava-fusion-runtime/src/actors/alarm_evaluator.rs` — GenServer alarm lifecycle (385 lines)
- [ava-fusion-runtime absence_detector.rs] `ava-fusion-runtime/src/actors/absence_detector.rs` — Timer-driven absence detection (402 lines)

---

*End of section AVA.13*
