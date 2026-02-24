# AVA.11 Tracking & State Estimation

```
Section:       AVA.11 — Tracking & State Estimation
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          III — Algorithms (Normative)
Prerequisites: AVA.10 (Evidence Theory)
Feeds:         AVA.12 (Complex Event Processing), AVA.13 (Output Pipeline)
```

> This section specifies the tracking and state estimation subsystem of the
> ava-fusion pipeline. It covers the 5-state track lifecycle finite state
> machine, the Extended Kalman Filter with three motion models, the
> Interacting Multiple Model filter, Covariance Intersection for
> track-to-track fusion, and the Sequential Probability Ratio Test for
> statistically rigorous track confirmation. The key words "MUST", "MUST
> NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT",
> "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document
> are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava111-conventions-and-terminology)
2.  [Track Lifecycle State Machine](#ava112-track-lifecycle-state-machine)
3.  [Extended Kalman Filter](#ava113-extended-kalman-filter)
4.  [Interacting Multiple Model Filter](#ava114-interacting-multiple-model-filter)
5.  [Covariance Intersection](#ava115-covariance-intersection)
6.  [Sequential Probability Ratio Test](#ava116-sequential-probability-ratio-test)
7.  [Coasting and Dead Reckoning](#ava117-coasting-and-dead-reckoning)
8.  [Lifecycle Configuration](#ava118-lifecycle-configuration)
9.  [Normative Requirements Summary](#ava119-normative-requirements-summary)
10. [References](#ava1110-references)

---

## AVA.11.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.11.1.1 Terminology

| Term | Definition |
|------|-----------|
| **Track** | A fused state estimate representing one real-world entity |
| **EKF** | Extended Kalman Filter — linearised Bayesian state estimator |
| **IMM** | Interacting Multiple Model — bank of EKFs with model switching |
| **CI** | Covariance Intersection — conservative track-to-track fusion |
| **SPRT** | Sequential Probability Ratio Test (Wald 1947) |
| **NIS** | Normalised Innovation Squared — chi-squared gating statistic |
| **Coast** | Prediction-only operation when no measurement is available |
| **M-of-N** | Confirmation by observing M detections in N consecutive scans |

---

## AVA.11.2 Track Lifecycle State Machine

### AVA.11.2.1 Five States

The track lifecycle is governed by a 5-state FSM
(`ava-fusion/src/track.rs:20-57`):

```
             +----------+
 signal ---> | TENTATIVE|
             +----+-----+
                  | confirmation (M-of-N / SPRT / score)
             +----v-----+         +---------+
             | CONFIRMED+-------->+ COASTING|
             +----+-----+ missed  +----+----+
                  |              recovery |
             +----v-----+         +----v----+
             | CONFIRMED+<--------+ COASTING|
             +----+-----+         +----+----+
                  |                    |
             +----v-----+         +----v----+
             |  MERGED  |         | DROPPED |
             +----------+         +---------+
```

| State | Join Participation | Confidence Multiplier | Terminal |
|-------|-------------------|----------------------|----------|
| **Tentative** | Yes (reduced x0.5) | 0.5 | No |
| **Confirmed** | Yes (full) | 1.0 | No |
| **Coasting** | Yes (decaying) | 1.0 (decays externally per scan) | No |
| **Dropped** | No | 0.0 | Yes |
| **Merged** | No | 1.0 (inherited from survivor) | Yes |

Source: `TrackLifecycleState::confidence_multiplier()` (`track.rs:88-96`),
`allows_joins()` (`track.rs:70-77`), `is_terminal()` (`track.rs:80-85`).

### AVA.11.2.2 Valid Transitions

**AVA.11-R1**: Implementations MUST enforce the following transition table.
All other transitions are INVALID (`track.rs:340-358`):

| From | To | Trigger |
|------|----|---------|
| Tentative | Confirmed | M-of-N, score threshold, or SPRT confirmed |
| Tentative | Dropped | False alarm rejection |
| Tentative | Merged | Hard/soft key match |
| Confirmed | Coasting | Consecutive detection misses |
| Confirmed | Merged | Hard/soft key match or operator action |
| Coasting | Confirmed | Measurement re-acquired |
| Coasting | Dropped | Max coast exceeded or score below threshold |
| Coasting | Merged | Hard/soft key match |

### AVA.11.2.3 Transition Reasons

Ten discriminated reasons are published with each transition event
(`track.rs:122-143`):

```rust
pub enum TransitionReason {
    Initiated,          // First observation
    MOfNConfirmed,      // M-of-N criteria met
    ScoreConfirmed,     // Score threshold exceeded
    SprtConfirmed,      // SPRT log-likelihood ratio exceeded A
    DetectionMissed,    // Consecutive misses
    DetectionRecovered, // Re-acquired during coast
    MaxCoastExceeded,   // Coast timeout
    ScoreBelowThreshold,// Score dropped below delete threshold
    MergedInto,         // Identity resolution merge
    OperatorAction,     // Manual override
}
```

**AVA.11-R2**: Lifecycle transitions MUST be published to NATS subject
`tsingou.track.lifecycle.<entity_class>.<track_id>` as `LifecycleTransition`
events (`track.rs:167-185`).

---

## AVA.11.3 Extended Kalman Filter

### AVA.11.3.1 Three Motion Models

The EKF supports three motion models, all using nalgebra compile-time
5-dimensional state vectors (`ava-fusion-runtime/src/tracking/ekf.rs:11-44`):

| Model | State Vector | Active Dims | Use Case |
|-------|-------------|-------------|----------|
| **CV** (Constant Velocity) | `[x, y, vx, vy, 0]` | 4 | Straight-line motion |
| **CT** (Coordinated Turn) | `[x, y, vx, vy, omega]` | 5 | Turning with velocity components |
| **CTRV** (Constant Turn Rate & Velocity) | `[x, y, v, theta, omega]` | 5 | Turning with scalar speed + heading |

**AVA.11-R3**: All models MUST share a common 5-dimensional state vector
(MAX_DIM=5) to enable IMM mixing without dimension conversion (`ekf.rs:14`).

### AVA.11.3.2 CV Prediction

Linear state transition (`ekf.rs:190-220`):

```
F = | 1  0  dt  0  0 |    Q = sigma_a^2 * | dt^4/4   0       dt^3/2  0       0 |
    | 0  1  0   dt 0 |                     | 0        dt^4/4  0       dt^3/2  0 |
    | 0  0  1   0  0 |                     | dt^3/2   0       dt^2    0       0 |
    | 0  0  0   1  0 |                     | 0        dt^3/2  0       dt^2    0 |
    | 0  0  0   0  0 |                     | 0        0       0       0       0 |

x_pred = F * x
P_pred = F * P * F^T + Q
```

Piecewise white noise acceleration model with `sigma_a` (m/s^2).

### AVA.11.3.3 CT Prediction (Nonlinear)

Coordinated turn with singularity guard for omega near zero
(`ekf.rs:226-261`):

```
When |omega| >= 1e-6:
  x' = x + (vx*sin(w*dt) - vy*(1-cos(w*dt))) / w
  y' = y + (vx*(1-cos(w*dt)) + vy*sin(w*dt)) / w
  vx' = vx*cos(w*dt) - vy*sin(w*dt)
  vy' = vx*sin(w*dt) + vy*cos(w*dt)

When |omega| < 1e-6 (straight-line fallback):
  x' = x + vx*dt
  y' = y + vy*dt
```

The Jacobian is computed analytically (`ekf.rs:263-286`).

### AVA.11.3.4 CTRV Prediction (Nonlinear)

Constant turn rate and velocity with heading-based state
(`ekf.rs:292-325`):

```
When |omega| >= 1e-6:
  x' = x + (v/w) * (sin(theta+w*dt) - sin(theta))
  y' = y + (v/w) * (cos(theta) - cos(theta+w*dt))
  theta' = theta + w*dt

When |omega| < 1e-6 (straight-line fallback):
  x' = x + v*cos(theta)*dt
  y' = y + v*sin(theta)*dt
```

**AVA.11-R4**: Both CT and CTRV models MUST implement a singularity guard
for `|omega| < 1e-6`, falling back to linear prediction (`ekf.rs:230,296`).

### AVA.11.3.5 Joseph-Form Covariance Update

The measurement update uses the Joseph form for numerical stability
(`ekf.rs:112-146`):

```
K = P * H^T * S^(-1)                    // Kalman gain
P_updated = (I - K*H) * P * (I - K*H)^T + K * R * K^T   // Joseph form
```

**AVA.11-R5**: Implementations MUST use the Joseph-form covariance update
(not the simplified `P = (I-KH)*P`). This guarantees positive semi-definiteness
even under finite-precision arithmetic. Validated by test
`joseph_form_covariance_stays_positive` (`ekf.rs:545-561`).

### AVA.11.3.6 Innovation and Gating

The Normalised Innovation Squared (NIS) serves as a gating statistic
(`ekf.rs:170-179`):

```
NIS = y^T * S^(-1) * y
```

Under H0 (correct association), NIS follows Chi-squared(2) for 2D position
measurements. A gate threshold of 9.21 (99% Chi-squared with 2 DOF) is
typical.

---

## AVA.11.4 Interacting Multiple Model Filter

### AVA.11.4.1 Architecture

The IMM wraps three EKF instances (CV, CT, CTRV) and combines their
estimates using model-probability mixing
(`ava-fusion-runtime/src/tracking/imm.rs:1-11`):

```
Memory: ~93 f64 values per track (744 bytes) for 3 models padded to dim 5
```

### AVA.11.4.2 Four-Step Cycle

Each IMM cycle follows four steps (`imm.rs:73-88`):

**Step 1 — Mixing Probabilities** (`imm.rs:138-164`):

```
c_j = sum_i pi[i][j] * mu[i]
mu_{i|j} = pi[i][j] * mu[i] / c_j
```

Where `pi` is the Markov transition matrix and `mu` are model probabilities.

**Step 2 — Mixed Initial Conditions** (`imm.rs:170-192`):

```
x0_j = sum_i mu_{i|j} * x_i
P0_j = sum_i mu_{i|j} * [P_i + (x_i - x0_j)(x_i - x0_j)^T]
```

**Step 3 — Model-Conditioned Filtering**:

Each EKF runs predict + update independently with its own motion model.

**Step 4 — Model Probability Update** (`imm.rs:198-235`):

```
L_j = N(y_j; 0, S_j)              // Gaussian innovation likelihood
mu_j(k) = L_j * c_j / sum(L_i * c_i)
```

**AVA.11-R6**: Model probabilities MUST sum to 1.0 after each step.
Validated by test `imm_model_probabilities_sum_to_one` (`imm.rs:255-270`).

### AVA.11.4.3 Default Transition Matrix

High self-transition probability with equal switching (`imm.rs:49-54`):

```
pi = | 0.950  0.025  0.025 |
     | 0.025  0.950  0.025 |
     | 0.025  0.025  0.950 |
```

**AVA.11-R7**: Transition matrix rows MUST sum to 1.0. Validated by test
`imm_transition_matrix_rows_sum_to_one` (`imm.rs:331-339`).

### AVA.11.4.4 Combined State Estimate

The combined state is a probability-weighted mixture (`imm.rs:100-106`):

```
x_combined = sum_j mu_j * x_j
```

Combined covariance includes the cross-term (`imm.rs:109-117`):

```
P_combined = sum_j mu_j * [P_j + (x_j - x_combined)(x_j - x_combined)^T]
```

### AVA.11.4.5 Coast Mode

When no measurement is available, `predict()` runs Steps 1-2-3 without
the update or probability re-estimation (`imm.rs:91-97`). Model
probabilities are frozen during coast.

---

## AVA.11.5 Covariance Intersection

### AVA.11.5.1 Track-to-Track Fusion

CI fuses state estimates from different trackers when cross-correlations
are unknown (`ava-fusion-runtime/src/tracking/fusion.rs:1-12`):

```
P_CI^(-1) = omega * P_A^(-1) + (1-omega) * P_B^(-1)
x_CI = P_CI * (omega * P_A^(-1) * x_A + (1-omega) * P_B^(-1) * x_B)
```

**AVA.11-R8**: CI MUST guarantee consistency — the fused covariance is
never smaller than the true (unknown) covariance. Validated by test
`ci_covariance_stays_positive_definite` (`fusion.rs:239-253`).

### AVA.11.5.2 Fast Omega via Trace Minimisation

Omega is computed without an optimisation loop (`fusion.rs:37-48`):

```
omega = tr(P_B) / (tr(P_A) + tr(P_B))
```

This minimises the trace of the fused covariance. The result is clamped
to [0.01, 0.99] to avoid singularity (`fusion.rs:60`).

### AVA.11.5.3 Sequential N-Track Fusion

Multiple tracks are fused pairwise in sequence (`fusion.rs:83-108`):

```
(A, B) -> AB, (AB, C) -> ABC, ...
```

Order-dependent but consistent. Returns `None` for empty inputs and
identity for single-track inputs.

**AVA.11-R9**: CI fusion MUST return `None` if either input covariance
is singular (not invertible) (`fusion.rs:62-63`).

---

## AVA.11.6 Sequential Probability Ratio Test

### AVA.11.6.1 SPRT for Track Confirmation

SPRT replaces M-of-N heuristics with a statistically rigorous method
(Wald 1947) (`ava-fusion-runtime/src/tracking/sprt.rs:1-12`):

```
LLR accumulates evidence: positive for detections, negative for misses
```

Three decisions (`sprt.rs:20-28`):

| Decision | Condition |
|----------|-----------|
| **Continue** | `B < LLR < A` |
| **Confirm** | `LLR >= A = ln((1-beta)/alpha)` |
| **Reject** | `LLR <= B = ln(beta/(1-alpha))` |

### AVA.11.6.2 Likelihood Updates

**Associated measurement** (`sprt.rs:80-91`):

```
LLR += ln(P_D * L(z) / clutter_density)
```

Where `L(z)` is the Gaussian measurement likelihood and `clutter_density`
is the expected false alarm density.

**Missed detection** (`sprt.rs:94-103`):

```
LLR += ln(1 - P_D)
```

Always negative — pushes toward rejection.

### AVA.11.6.3 Domain-Specific Parameters

(`ava-fusion/src/track.rs:267-271`):

| Domain | alpha | beta | A (confirm) | B (reject) |
|--------|-------|------|-------------|------------|
| Maritime | 0.01 | 0.05 | ~4.55 | ~-2.99 |
| Aviation | 0.05 | 0.10 | ~2.89 | ~-2.25 |
| Cyber | 0.10 | 0.10 | ~2.20 | ~-2.20 |

**AVA.11-R10**: The `SprtConfig` MUST derive confirmation/rejection thresholds
from `alpha` and `beta` via `confirm_threshold()` and `reject_threshold()`
(`track.rs:283-291`).

---

## AVA.11.7 Coasting and Dead Reckoning

### AVA.11.7.1 Coast Configuration

Coasting is governed by per-entity-class parameters (`track.rs:226-251`):

```rust
pub struct CoastConfig {
    pub max_duration_s: f64,               // Drop when exceeded
    pub prediction_model: String,          // "kalman" or "linear"
    pub max_position_uncertainty_m: Option<f64>, // Drop when exceeded
}
```

Domain-specific limits (`track.rs:233-237`):

| Domain | max_duration_s | max_position_uncertainty_m |
|--------|---------------|---------------------------|
| Maritime | 1800 | 5000 |
| Aviation | 300 | 2000 |
| Ground | 600 | 1000 |

**AVA.11-R11**: A coasting track MUST be dropped when EITHER `max_duration_s`
OR `max_position_uncertainty_m` is exceeded. Uncertainty grows as
`sigma^2_x(T) ~ sigma^2_a * T^3/3` from process noise integration.

### AVA.11.7.2 Confidence Decay During Coast

Confidence decays by `coast_confidence_decay_per_scan` per missed scan
(`track.rs:331`). This is an external linear decay applied on top of
the Kalman-predicted covariance growth.

---

## AVA.11.8 Lifecycle Configuration

Per-entity-class lifecycle parameters are specified in
`TrackLifecycleConfig` (`track.rs:312-332`):

```rust
pub struct TrackLifecycleConfig {
    pub entity_class: String,
    pub confirmation_method: ConfirmationMethod,
    pub min_observations: Option<u32>,       // M in M-of-N
    pub min_confidence: Option<f64>,         // Score threshold
    pub coast: CoastConfig,
    pub coast_confidence_decay_per_scan: f64,
}
```

Four confirmation methods (`track.rs:193-209`):

| Method | Mechanism |
|--------|-----------|
| **ObservationCount** | M-of-N sliding window |
| **ConfidenceThreshold** | Score exceeds min_confidence |
| **Combined** | Both M-of-N AND score must be satisfied |
| **Sprt** | Wald's SPRT (consults SprtConfig) |

---

## AVA.11.9 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.11-R1 | Implementations MUST enforce the valid transition table | MUST |
| AVA.11-R2 | Lifecycle transitions MUST be published to NATS | MUST |
| AVA.11-R3 | All EKF models MUST share MAX_DIM=5 state vector | MUST |
| AVA.11-R4 | CT/CTRV MUST implement singularity guard for omega near zero | MUST |
| AVA.11-R5 | Joseph-form covariance update MUST be used (not simplified) | MUST |
| AVA.11-R6 | IMM model probabilities MUST sum to 1.0 after each step | MUST |
| AVA.11-R7 | Transition matrix rows MUST sum to 1.0 | MUST |
| AVA.11-R8 | CI MUST guarantee consistency (never overconfident) | MUST |
| AVA.11-R9 | CI MUST return None for singular covariance input | MUST |
| AVA.11-R10 | SPRT thresholds MUST be derived from alpha/beta parameters | MUST |
| AVA.11-R11 | Coasting track MUST be dropped when duration OR uncertainty exceeds limits | MUST |

---

## AVA.11.10 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [Wald 1947] Wald, A., "Sequential Analysis", John Wiley & Sons, 1947.
- [Bar-Shalom 2001] Bar-Shalom, Y., Li, X.R., Kirubarajan, T., "Estimation with Applications to Tracking and Navigation", Wiley, 2001.
- [Julier & Uhlmann 1997] Julier, S.J., Uhlmann, J.K., "A Non-divergent Estimation Algorithm in the Presence of Unknown Correlations", Proc. ACC, 1997.
- [Blom & Bar-Shalom 1988] Blom, H.A., Bar-Shalom, Y., "The Interacting Multiple Model Algorithm for Systems with Markovian Switching Coefficients", IEEE TAC, 1988.
- [ava-fusion track.rs] `ava-fusion/src/track.rs` — 5-state FSM, lifecycle types
- [ava-fusion-runtime ekf.rs] `ava-fusion-runtime/src/tracking/ekf.rs` — EKF with 3 motion models
- [ava-fusion-runtime imm.rs] `ava-fusion-runtime/src/tracking/imm.rs` — IMM 4-step cycle
- [ava-fusion-runtime fusion.rs] `ava-fusion-runtime/src/tracking/fusion.rs` — Covariance Intersection
- [ava-fusion-runtime sprt.rs] `ava-fusion-runtime/src/tracking/sprt.rs` — SPRT track confirmation

---

*End of section AVA.11*
