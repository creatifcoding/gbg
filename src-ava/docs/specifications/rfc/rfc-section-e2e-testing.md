# AVA.15 E2E Testing Strategy

```
Section:       AVA.15 — E2E Testing Strategy
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          V — Validation (Informative)
Prerequisites: AVA.1 through AVA.14
Feeds:         None (terminal section)
```

> This section describes the end-to-end testing strategy for the ava-fusion
> pipeline. As an **Informative** section (Part V — Validation), it documents
> testing patterns, coverage goals, and verification approaches without
> imposing normative requirements. Implementations SHOULD follow these
> guidelines to ensure system correctness. The key words "SHOULD",
> "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", and "MAY" in this document
> are to be interpreted as described in [RFC2119] and [RFC8174]. Normative
> "MUST" requirements are not used in this section.

---

## Table of Contents

1.  [Conventions and Terminology](#ava151-conventions-and-terminology)
2.  [Test Inventory](#ava152-test-inventory)
3.  [Unit Test Patterns](#ava153-unit-test-patterns)
4.  [Integration Test Patterns](#ava154-integration-test-patterns)
5.  [Property-Based Testing](#ava155-property-based-testing)
6.  [Deterministic Replay via Virtual Time](#ava156-deterministic-replay-via-virtual-time)
7.  [Test Fixtures and Data Generation](#ava157-test-fixtures-and-data-generation)
8.  [Coverage Strategy](#ava158-coverage-strategy)
9.  [Regression Testing](#ava159-regression-testing)
10. [Normative Requirements Summary](#ava1510-normative-requirements-summary)
11. [References](#ava1511-references)

---

## AVA.15.1 Conventions and Terminology

As an Informative section, this document uses SHOULD and RECOMMENDED rather
than MUST and REQUIRED. Implementations that deviate from these guidelines
SHOULD document the rationale for deviation.

### AVA.15.1.1 Terminology

| Term | Definition |
|------|-----------|
| **Unit Test** | Tests a single function or type in isolation, no I/O |
| **Integration Test** | Tests actor interaction or dataflow pipeline with mock infrastructure |
| **Property Test** | Randomized testing verifying algebraic invariants |
| **Virtual Time** | Deterministic time source from asupersync's LabRuntime |
| **Serde Roundtrip** | Serialize then deserialize, asserting equality |
| **ARL** | Average Run Length — number of samples between CUSUM alarms |
| **LabRuntime** | asupersync's deterministic testing runtime |
| **ObligationLeakOracle** | LabRuntime component that detects unresolved obligations |

---

## AVA.15.2 Test Inventory

### AVA.15.2.1 Test Counts by Module

The pipeline currently contains **550 unit tests** across two crates.

**ava-fusion** (types crate):

| Module | Tests | Description |
|--------|-------|-------------|
| `risk.rs` | 25 | Risk categories, decay models, entity risk profiles |
| `confidence.rs` | 25 | Confidence scoring and Bayesian fusion |
| `track.rs` | 22 | Track state, coasting, merge operations |
| `temporal.rs` | 19 | Temporal alignment and windowing |
| `tier3.rs` | 18 | Tier 3 analytical constructs |
| `output.rs` | 16 | FusedDatum, CorrelatedPair, FusionOutcome, severity |
| `absence.rs` | 15 | Absence schema types |
| `blocking.rs` | 15 | Blocking/deny-list schemas |
| `join_path.rs` | 13 | Join path definitions and versioning |
| `sequence.rs` | 12 | Sequence number handling |
| `calibration.rs` | 10 | Sensor calibration parameters |
| `entity.rs` | 10 | EntityClass variants and serde |
| `signal.rs` | 9 | SignalKind (20 variants) serde |
| `ids.rs` | 8 | Branded identifier types |
| `geo.rs` | 6 | GeoPoint and spatial primitives |
| `ontology.rs` | 6 | Ontology root types |
| **Subtotal** | **229** | |

**ava-fusion-runtime** (runtime crate):

| Module | Tests | Description |
|--------|-------|-------------|
| `dataflow/scoring.rs` | 31 | Differential dataflow scoring |
| `dataflow/blocking.rs` | 27 | Blocking/filtering in dataflow |
| `risk/accumulation.rs` | 19 | Leaky NoisyOr, convergence bonus |
| `cep/evaluator.rs` | 19 | Complex event processing evaluator |
| `signal/periodicity.rs` | 18 | FFT-based periodicity detection |
| `graph/triangle.rs` | 17 | Triangle counting in entity graphs |
| `risk/alert_suppression.rs` | 17 | 4-layer alert fatigue filter |
| `cep/nfa.rs` | 16 | NFA pattern matching |
| `tracking/ekf.rs` | 15 | Extended Kalman Filter |
| `dataflow/mod.rs` | 14 | Dataflow orchestration |
| `risk/cusum.rs` | 14 | CUSUM change-point detection |
| `nats_object.rs` | 13 | NATS Object Store |
| `risk/decay.rs` | 11 | Temporal decay application |
| `nats_kv.rs` | 11 | NATS KV Store |
| `tracking/sprt.rs` | 11 | Sequential Probability Ratio Test |
| `cep/shared_buffer.rs` | 9 | CEP shared buffer |
| `graph/louvain.rs` | 9 | Louvain community detection |
| `graph/pagerank.rs` | 9 | PageRank computation |
| `tracking/imm.rs` | 8 | Interacting Multiple Model filter |
| `tracking/fusion.rs` | 8 | Track fusion and merge |
| `convert.rs` | 20 | Type conversion mappings |
| `cep/mod.rs` | 5 | CEP module integration |
| **Subtotal** | **321** | |

### AVA.15.2.2 Test Distribution

```
Types crate (ava-fusion):      229 tests  (41.6%)
Runtime crate (ava-fusion-runtime): 321 tests  (58.4%)
─────────────────────────────────────────────────
Total:                          550 tests  (100%)
```

**AVA.15-R1**: Each module SHOULD maintain a minimum of 5 unit tests. Modules
with 0 tests (actor implementations, mod.rs re-exports) SHOULD be covered
by integration tests at the actor level.

---

## AVA.15.3 Unit Test Patterns

### AVA.15.3.1 Serde Roundtrip Tests

The most common pattern across both crates. Every type that crosses a
serialization boundary SHOULD have a roundtrip test.

Pattern:

```rust
#[test]
fn type_serde_roundtrip() {
    let value = MyType { /* ... */ };
    let json = serde_json::to_string(&value).unwrap();
    let parsed: MyType = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed, value);
}
```

Example: `ava-fusion/src/output.rs:216-229` (FusedDatum roundtrip)

These tests verify:
- JSON field naming conventions (camelCase via `serde(rename_all)`)
- Optional field omission (`skip_serializing_if = "Option::is_none"`)
- Empty collection omission (`skip_serializing_if = "Vec::is_empty"`)
- Tagged enum serialization (internally tagged via `serde(tag, content)`)

### AVA.15.3.2 JSON Shape Tests

Verify specific JSON output format for TypeScript consumers.

```rust
#[test]
fn fusion_severity_json_shape() {
    let json = serde_json::to_string(&FusionSeverity::Panicked).unwrap();
    assert_eq!(json, "\"panicked\"");
}
```

Source: `ava-fusion/src/output.rs:370-373`

**AVA.15-R2**: All enum types consumed by TypeScript SHOULD have JSON shape
tests asserting the exact string representation.

### AVA.15.3.3 Invariant Tests

Verify algebraic properties that the domain model guarantees.

```rust
#[test]
fn risk_category_default_weights_sum() {
    let sum: f64 = RiskCategory::ALL.iter().map(|c| c.default_weight()).sum();
    assert!((sum - 1.0).abs() < 1e-10);
}
```

Source: `ava-fusion/src/risk.rs:417-419`

```rust
#[test]
fn fusion_severity_ordering() {
    assert!(FusionSeverity::Ok < FusionSeverity::Err);
    assert!(FusionSeverity::Err < FusionSeverity::Cancelled);
    assert!(FusionSeverity::Cancelled < FusionSeverity::Panicked);
}
```

Source: `ava-fusion/src/output.rs:348-352`

### AVA.15.3.4 Mathematical Correctness Tests

Numerical algorithms are verified against known analytical results.

```rust
#[test]
fn decay_model_exponential_half_life() {
    let model = DecayModel::Exponential { half_life_ms: 60_000.0 };
    let factor = model.factor(60_000.0);
    assert!((factor - 0.5).abs() < 1e-10);
}
```

Source: `ava-fusion/src/risk.rs:618-625`

```rust
#[test]
fn leaky_noisy_or_two_indicators() {
    // P = 1 - 0.95 * (1-0.5) * (1-0.3) = 0.6675
    let result = leaky_noisy_or(&[0.5, 0.3], 0.95);
    assert!((result - 0.6675).abs() < 1e-10);
}
```

Source: `ava-fusion-runtime/src/risk/accumulation.rs:218-222`

**AVA.15-R3**: Every mathematical function SHOULD have at least one test
with a hand-computed expected value, verified to at least 10 significant
digits (`1e-10` tolerance).

---

## AVA.15.4 Integration Test Patterns

### AVA.15.4.1 Alert Suppression Lifecycle

The `full_lifecycle` test verifies the complete 4-layer suppression pipeline
across multiple evaluation cycles.

Source: `ava-fusion-runtime/src/risk/alert_suppression.rs:411-463`

This test exercises:
1. First alert passing all layers (Emit)
2. Small score change suppressed by score-delta
3. Significant rise emitting second alert
4. Cooldown suppressing rapid follow-up
5. Post-cooldown emission
6. Token exhaustion triggering rate-limit suppression
7. Score drop below hysteresis exit threshold
8. Re-entry after token refill window

**AVA.15-R4**: Each multi-layer system SHOULD have at least one lifecycle
test that exercises every suppression verdict in a single test case.

### AVA.15.4.2 CUSUM Shift Detection

Tests verify that CUSUM detects shifts within expected sample bounds.

Source: `ava-fusion-runtime/src/risk/cusum.rs:272-289`

```rust
#[test]
fn cusum_detects_upward_shift() {
    let mut c = CusumState::new(0.5, 0.1);  // mu_0=0.5, sigma=0.1
    let mut detected = false;
    for i in 0..50 {
        if let Some(dir) = c.update(0.7) {   // 2-sigma shift
            assert_eq!(dir, TrendDirection::Rising);
            assert!(i < 10, "Should detect quickly");
            detected = true;
            break;
        }
    }
    assert!(detected);
}
```

### AVA.15.4.3 Category Decay Cross-Model Comparison

Verifies that different decay models produce the expected relative ordering.

Source: `ava-fusion-runtime/src/risk/decay.rs:252-275`

```rust
#[test]
fn category_decay_different_models() {
    let models = vec![
        weibull(30_000.0, 1.0),      // Identity
        weibull(5_000.0, 0.7),       // Kinematic (fast initial decay)
        power_law(3_600_000.0, 0.8), // Association (fat tail)
    ];
    // At t=30s: kinematic < identity < association
    assert!(kinematic_score < identity_score);
    assert!(association_score > identity_score);
}
```

---

## AVA.15.5 Property-Based Testing

### AVA.15.5.1 NoisyOr Properties

The NoisyOr accumulation has algebraic properties that are verifiable
via property-based tests:

| Property | Assertion |
|----------|-----------|
| Bounded | `0.0 <= noisy_or(scores) <= 1.0` for any scores in [0,1] |
| Monotone | Adding an indicator never decreases the result |
| Commutative | Order of indicators does not affect the result |
| Diminishing returns | Marginal increase decreases with additional indicators |
| Identity | `noisy_or([]) == 0.0` (standard) or `1 - q0` (leaky) |

Source: `ava-fusion-runtime/src/risk/accumulation.rs:240-249` (diminishing
returns test)

**AVA.15-R5**: Implementations SHOULD add property-based tests (e.g.,
`proptest` or `quickcheck`) for accumulation functions, verifying boundedness,
monotonicity, and commutativity across random inputs.

### AVA.15.5.2 DecayModel Properties

| Property | Assertion |
|----------|-----------|
| Identity at t=0 | `model.factor(0.0) == 1.0` for all models |
| Monotone decreasing | `factor(t1) >= factor(t2)` when `t1 < t2` |
| Bounded | `0.0 <= factor(t) <= 1.0` for all `t >= 0` |
| Exponential at k=1 | `Weibull(lambda, k=1) == Exponential(lambda)` |

Source: `ava-fusion-runtime/src/risk/decay.rs:129-141` (identity at t=0 for
all 4 models)

### AVA.15.5.3 FusionSeverity Properties

| Property | Assertion |
|----------|-----------|
| Total order | Transitivity: `Ok < Err < Cancelled < Panicked` |
| Exhaustive | 4 variants cover all possible outcomes |
| Deterministic | `outcome.severity()` is pure (no side effects) |

---

## AVA.15.6 Deterministic Replay via Virtual Time

### AVA.15.6.1 asupersync LabRuntime

The asupersync runtime provides a LabRuntime mode for deterministic testing:

- **Virtual time**: `cx.timer_driver()` returns a controllable time source
- **Deterministic randomness**: `cx.random_u64()` is seeded for reproducibility
- **Budget-bounded computation**: `Budget::MINIMAL` / `Budget::INFINITE`
- **ObligationLeakOracle**: Detects unresolved Reply tokens at shutdown

Source: `ava-fusion-runtime/src/actors/absence_detector.rs:344-346`

```rust
let eval_time_ms = cx.timer_driver()
    .map(|d| d.now().as_millis() as f64)
    .unwrap_or(current_time_ms);
```

**AVA.15-R6**: Actor tests SHOULD use LabRuntime with virtual time for
deterministic behavior. Tests SHOULD NOT depend on wall-clock timing.

### AVA.15.6.2 Obligation Leak Detection

The AlarmEvaluator's obligation model ensures that every raised alarm
receives a response. Under LabRuntime, the ObligationLeakOracle detects
any test scenario where an alarm obligation leaks.

Source: `ava-fusion-runtime/src/actors/alarm_evaluator.rs:362-370`

```rust
fn on_stop(&mut self, cx: &Cx) -> ... {
    if !self.active_alarms.is_empty() {
        tracing::error!(
            leaked_count = self.active_alarms.len(),
            "AlarmEvaluator stopped with unresolved alarm obligations!"
        );
    }
}
```

### AVA.15.6.3 Budget-Bounded Evaluation

The AbsenceDetector uses `cx.checkpoint_with()` to allow the supervisor
to cancel evaluation between ticks.

Source: `ava-fusion-runtime/src/actors/absence_detector.rs:330-339`

```rust
if cx.checkpoint_with(format!(
    "tick {} evaluating {} expectations",
    self.total_ticks, self.expectations.len()
)).is_err() {
    return Box::pin(async {});  // Cancelled by supervisor
}
```

**AVA.15-R7**: Actor evaluation loops SHOULD include checkpoint calls to
support budget-bounded cancellation. Tests SHOULD verify that cancellation
produces clean state (no partial updates).

---

## AVA.15.7 Test Fixtures and Data Generation

### AVA.15.7.1 Standard Test Values

Tests use consistent reference values for reproducibility:

| Value | Constant | Usage |
|-------|----------|-------|
| Timestamp | `1_700_000_000_000` (epoch ms) | All temporal tests |
| Position | `GeoPoint::new(33.748, -84.388)` | Atlanta, GA |
| Confidence | `0.85` | High-confidence reference |
| Baseline mu_0 | `0.5` | CUSUM baseline mean |
| Baseline sigma | `0.1` | CUSUM baseline std dev |
| Background leak | `0.05` (q0=0.95) | NoisyOr background risk |

### AVA.15.7.2 Helper Functions

Test modules define reusable helpers for constructing decay models:

Source: `ava-fusion-runtime/src/risk/decay.rs:108-125`

```rust
fn weibull(lambda_ms: f64, k: f64) -> DecayModel { ... }
fn power_law(tau_ms: f64, alpha: f64) -> DecayModel { ... }
fn exponential(half_life_ms: f64) -> DecayModel { ... }
fn step_with_grace(grace_ms: f64, half_life_ms: f64) -> DecayModel { ... }
```

**AVA.15-R8**: Test helper functions SHOULD be defined in `#[cfg(test)] mod tests`
blocks, not in production code. Helpers SHOULD have descriptive names matching
the domain vocabulary.

---

## AVA.15.8 Coverage Strategy

### AVA.15.8.1 Coverage by Module Category

| Category | Target | Current Approach |
|----------|--------|-----------------|
| Domain types (ava-fusion) | >90% line coverage | Serde roundtrip + JSON shape + invariant tests |
| Mathematical functions | 100% branch coverage | Analytical verification + boundary conditions |
| Risk pipeline | >85% line coverage | Lifecycle tests + edge cases |
| Actor GenServer handlers | >70% line coverage | LabRuntime integration tests |
| NATS infrastructure | >60% line coverage | Key validation + naming convention tests |
| Dataflow operators | >80% line coverage | Differential dataflow scoring + blocking tests |

### AVA.15.8.2 Boundary Conditions

Every numerical function SHOULD be tested at these boundaries:

| Boundary | Example |
|----------|---------|
| Empty input | `noisy_or(&[])`, `decay_and_evict(&[], ...)` |
| Single element | `noisy_or(&[0.5])`, `convergence_bonus(&[0.5], ...)` |
| Maximum | All categories active, all scores at 1.0 |
| Minimum | All scores at 0.0 or below eviction threshold |
| Zero parameters | `CusumState::new(0.5, 0.0)` (zero sigma) |
| Negative elapsed time | `model.factor(-100.0)` returns 1.0 |

Source: `ava-fusion-runtime/src/risk/cusum.rs:339-344` (zero sigma guard)

### AVA.15.8.3 Error Path Coverage

| Error Type | Test Pattern |
|-----------|-------------|
| `KvError::InvalidKey` | `validate_key("entity:pump001")` — colon rejected |
| `KvError::RevisionConflict` | Display formatting verification |
| `ObjectError::InvalidName` | Whitespace and wildcard rejection |
| `ObjectError::IntegrityError` | Size mismatch detection |

Source: `ava-fusion-runtime/src/nats_kv.rs:494-498` (colon rejection test)

**AVA.15-R9**: Every error variant SHOULD have at least one test that
triggers it, verifying both the error type and its `Display` output.

---

## AVA.15.9 Regression Testing

### AVA.15.9.1 Known Regression Guards

| Regression | Guard Test | Source |
|-----------|-----------|--------|
| NoisyOr diminishing returns violated | `noisy_or_diminishing_returns` | `accumulation.rs:240-249` |
| CUSUM false alarm on zero sigma | `cusum_zero_sigma_no_panic` | `cusum.rs:339-344` |
| Hysteresis deadband bypass | `hysteresis_stays_alarmed_in_deadband` | `alert_suppression.rs:287-298` |
| KV key with colons accepted | `validate_key_rejects_colons` | `nats_kv.rs:494-498` |
| Obligation state leaked silently | `on_stop` error log | `alarm_evaluator.rs:362-370` |
| Weibull k=1 diverges from exponential | `decay_model_weibull_k1_is_exponential` | `risk.rs:596-604` |

### AVA.15.9.2 Test Execution

All tests are runnable via standard Cargo:

```bash
# Run all workspace tests
cargo test --workspace

# Run tests for a specific crate
cargo test -p ava-fusion
cargo test -p ava-fusion-runtime

# Run tests for a specific module
cargo test -p ava-fusion-runtime risk::accumulation

# Run with output for debugging
cargo test -p ava-fusion-runtime -- --nocapture
```

**AVA.15-R10**: The complete test suite SHOULD execute in under 30 seconds
on a development workstation. Tests that require external services (NATS
server) SHOULD be gated behind a feature flag or `#[ignore]` attribute.

---

## AVA.15.10 Normative Requirements Summary

As an Informative section, these are RECOMMENDED practices, not mandatory
requirements.

| ID | Recommendation | Level |
|----|---------------|-------|
| AVA.15-R1 | Each module SHOULD maintain minimum 5 unit tests | SHOULD |
| AVA.15-R2 | Enum types consumed by TypeScript SHOULD have JSON shape tests | SHOULD |
| AVA.15-R3 | Mathematical functions SHOULD have hand-computed expected values | SHOULD |
| AVA.15-R4 | Multi-layer systems SHOULD have lifecycle tests covering all paths | SHOULD |
| AVA.15-R5 | Accumulation functions SHOULD have property-based tests | SHOULD |
| AVA.15-R6 | Actor tests SHOULD use LabRuntime with virtual time | SHOULD |
| AVA.15-R7 | Actor loops SHOULD include checkpoint calls for cancellation | SHOULD |
| AVA.15-R8 | Test helpers SHOULD be in `#[cfg(test)]` blocks only | SHOULD |
| AVA.15-R9 | Every error variant SHOULD have a triggering test | SHOULD |
| AVA.15-R10 | Full test suite SHOULD execute in under 30 seconds | SHOULD |

---

## AVA.15.11 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [proptest] https://github.com/proptest-rs/proptest — Property-based testing for Rust
- [quickcheck] https://github.com/BurntSushi/quickcheck — QuickCheck for Rust
- [cargo-tarpaulin] https://github.com/xd009642/tarpaulin — Code coverage for Cargo
- [asupersync LabRuntime] https://github.com/Dicklesworthstone/asupersync — Deterministic testing runtime
- [ava-fusion tests] `ava-fusion/src/` — 229 unit tests across 16 modules
- [ava-fusion-runtime tests] `ava-fusion-runtime/src/` — 321 unit tests across 22 modules

---

*End of section AVA.15*
