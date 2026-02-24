//! Temporal decay application and indicator eviction.
//!
//! Applies `DecayModel` from `ava_fusion::risk` to indicator scores
//! and evicts indicators that fall below the minimum threshold.

use ava_fusion::risk::DecayModel;

// ---------------------------------------------------------------------------
// Apply decay to a single indicator
// ---------------------------------------------------------------------------

/// Apply temporal decay to an indicator score.
///
/// - `initial_score`: the score at creation time.
/// - `elapsed_ms`: time since the indicator was created.
/// - `model`: the decay model to apply.
///
/// Returns the decayed score in [0.0, 1.0].
pub fn apply_decay(initial_score: f64, elapsed_ms: f64, model: &DecayModel) -> f64 {
    let factor = model.factor(elapsed_ms);
    (initial_score * factor).clamp(0.0, 1.0)
}

// ---------------------------------------------------------------------------
// Batch decay + eviction
// ---------------------------------------------------------------------------

/// Indicator with its creation timestamp for batch decay processing.
#[derive(Debug, Clone)]
pub struct TimedScore {
    /// Original score at creation time.
    pub initial_score: f64,
    /// Absolute timestamp when the indicator was created (epoch ms).
    pub created_ms: f64,
}

/// Apply decay to a batch of indicators and evict those below threshold.
///
/// - `indicators`: initial scores with creation times.
/// - `now_ms`: current time (epoch ms).
/// - `model`: decay model to apply.
/// - `min_score`: eviction threshold — indicators below this are removed.
///
/// Returns surviving indicators with their decayed scores.
pub fn decay_and_evict(
    indicators: &[TimedScore],
    now_ms: f64,
    model: &DecayModel,
    min_score: f64,
) -> Vec<(usize, f64)> {
    indicators
        .iter()
        .enumerate()
        .filter_map(|(idx, ind)| {
            let elapsed = (now_ms - ind.created_ms).max(0.0);
            let decayed = apply_decay(ind.initial_score, elapsed, model);
            if decayed >= min_score {
                Some((idx, decayed))
            } else {
                None
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Per-category decay application
// ---------------------------------------------------------------------------

/// Apply category-specific decay models to a set of indicators.
///
/// Each indicator is `(score, created_ms, category_index)`. The `models`
/// array provides the decay model for each category (indexed by category).
///
/// Returns decayed scores for surviving indicators.
pub fn apply_category_decay(
    indicators: &[(f64, f64, usize)],
    now_ms: f64,
    models: &[DecayModel],
    min_score: f64,
) -> Vec<(usize, f64)> {
    indicators
        .iter()
        .enumerate()
        .filter_map(|(idx, &(score, created_ms, cat_idx))| {
            if cat_idx >= models.len() {
                return Some((idx, score)); // No model, keep as-is.
            }
            let elapsed = (now_ms - created_ms).max(0.0);
            let decayed = apply_decay(score, elapsed, &models[cat_idx]);
            if decayed >= min_score {
                Some((idx, decayed))
            } else {
                None
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn weibull(lambda_ms: f64, k: f64) -> DecayModel {
        DecayModel::Weibull { lambda_ms, k }
    }

    fn power_law(tau_ms: f64, alpha: f64) -> DecayModel {
        DecayModel::PowerLaw { tau_ms, alpha }
    }

    fn exponential(half_life_ms: f64) -> DecayModel {
        DecayModel::Exponential { half_life_ms }
    }

    fn step_with_grace(grace_ms: f64, half_life_ms: f64) -> DecayModel {
        DecayModel::StepWithGrace {
            grace_ms,
            half_life_ms,
        }
    }

    // -- apply_decay --

    #[test]
    fn decay_at_zero_elapsed_is_identity() {
        let models = [
            weibull(30_000.0, 1.0),
            power_law(3_600_000.0, 1.0),
            exponential(60_000.0),
            step_with_grace(10_000.0, 60_000.0),
        ];
        for model in &models {
            let result = apply_decay(0.8, 0.0, model);
            assert!((result - 0.8).abs() < 1e-10, "Model {model:?} at t=0 should be identity");
        }
    }

    #[test]
    fn decay_weibull_k07_fast_initial() {
        // k < 1: fast initial decay (kinematic-style).
        let model = weibull(5_000.0, 0.7);
        let at_1s = apply_decay(1.0, 1_000.0, &model);
        let at_5s = apply_decay(1.0, 5_000.0, &model);
        let at_30s = apply_decay(1.0, 30_000.0, &model);
        // Fast initial: significant drop in first second.
        assert!(at_1s < 0.75, "k=0.7 should decay fast initially, got {at_1s}");
        // But long tail: still non-trivial at 30s.
        assert!(at_30s > 0.001, "k=0.7 should have long tail, got {at_30s}");
        assert!(at_5s < at_1s);
        assert!(at_30s < at_5s);
    }

    #[test]
    fn decay_weibull_k15_abrupt_cutoff() {
        // k > 1: slow start, then abrupt cutoff (signal-style).
        let model = weibull(10_000.0, 1.5);
        let at_5s = apply_decay(1.0, 5_000.0, &model);
        let at_15s = apply_decay(1.0, 15_000.0, &model);
        // Slow start: retains most score at 50% of lambda.
        assert!(at_5s > 0.6, "k=1.5 should be slow to start, got {at_5s}");
        // Abrupt: at 1.5x lambda, mostly gone.
        // exp(-(1.5)^1.5) = exp(-1.837) ≈ 0.159
        assert!(at_15s < 0.20, "k=1.5 should cut off sharply, got {at_15s}");
    }

    #[test]
    fn decay_power_law_fat_tail() {
        // Association-style: tau=1hr, alpha=0.8. At 10 hours, still meaningful.
        let model = power_law(3_600_000.0, 0.8);
        let at_10h = apply_decay(1.0, 36_000_000.0, &model);
        // (1 + 10)^(-0.8) = 11^(-0.8) ≈ 0.125
        assert!(at_10h > 0.10, "Power-law should have fat tail at 10tau, got {at_10h}");
        assert!(at_10h < 0.20);
    }

    #[test]
    fn decay_exponential_half_life_correct() {
        let model = exponential(60_000.0);
        let at_half = apply_decay(1.0, 60_000.0, &model);
        assert!((at_half - 0.5).abs() < 1e-10, "At half-life should be 0.5, got {at_half}");
        let at_double = apply_decay(1.0, 120_000.0, &model);
        assert!((at_double - 0.25).abs() < 1e-10, "At 2x half-life should be 0.25, got {at_double}");
    }

    #[test]
    fn decay_step_with_grace_holds_then_decays() {
        let model = step_with_grace(10_000.0, 60_000.0);
        // During grace: full score.
        assert!((apply_decay(0.9, 5_000.0, &model) - 0.9).abs() < 1e-10);
        assert!((apply_decay(0.9, 10_000.0, &model) - 0.9).abs() < 1e-10);
        // After grace + half_life: half.
        let at_grace_plus_half = apply_decay(0.9, 70_000.0, &model);
        assert!((at_grace_plus_half - 0.45).abs() < 1e-6,
            "After grace+half_life should be 0.45, got {at_grace_plus_half}");
    }

    // -- decay_and_evict --

    #[test]
    fn evict_below_threshold() {
        let indicators = vec![
            TimedScore { initial_score: 0.8, created_ms: 0.0 },
            TimedScore { initial_score: 0.1, created_ms: 0.0 },
            TimedScore { initial_score: 0.5, created_ms: 0.0 },
        ];
        let model = exponential(60_000.0);
        // At t=120000 (2 half-lives): scores * 0.25 → 0.2, 0.025, 0.125
        // min_score = 0.05 → evict indicator 1 (0.025 < 0.05)
        let survivors = decay_and_evict(&indicators, 120_000.0, &model, 0.05);
        assert_eq!(survivors.len(), 2);
        assert_eq!(survivors[0].0, 0); // Index 0 survives
        assert_eq!(survivors[1].0, 2); // Index 2 survives
        assert!((survivors[0].1 - 0.2).abs() < 1e-6);
        assert!((survivors[1].1 - 0.125).abs() < 1e-6);
    }

    #[test]
    fn evict_all_when_too_old() {
        let indicators = vec![
            TimedScore { initial_score: 0.3, created_ms: 0.0 },
            TimedScore { initial_score: 0.2, created_ms: 0.0 },
        ];
        let model = exponential(1_000.0); // 1s half-life
        // At t=30s (30 half-lives): scores * 2^(-30) ≈ 0
        let survivors = decay_and_evict(&indicators, 30_000.0, &model, 0.01);
        assert!(survivors.is_empty(), "All indicators should be evicted");
    }

    #[test]
    fn evict_preserves_fresh_indicators() {
        let indicators = vec![
            TimedScore { initial_score: 0.5, created_ms: 9_000.0 },
            TimedScore { initial_score: 0.5, created_ms: 0.0 },
        ];
        let model = exponential(5_000.0);
        // At t=10000: indicator 0 elapsed=1000 → 0.5*0.87 ≈ 0.435
        //             indicator 1 elapsed=10000 → 0.5*0.25 = 0.125
        let survivors = decay_and_evict(&indicators, 10_000.0, &model, 0.20);
        assert_eq!(survivors.len(), 1);
        assert_eq!(survivors[0].0, 0);
        assert!(survivors[0].1 > 0.40);
    }

    // -- apply_category_decay --

    #[test]
    fn category_decay_different_models() {
        let models = vec![
            weibull(30_000.0, 1.0),     // Category 0: Identity
            weibull(5_000.0, 0.7),      // Category 1: Kinematic
            power_law(3_600_000.0, 0.8), // Category 2: Association
        ];
        let indicators = vec![
            (0.8, 0.0, 0),  // Identity, created at t=0
            (0.8, 0.0, 1),  // Kinematic, created at t=0
            (0.8, 0.0, 2),  // Association, created at t=0
        ];
        // At t=30s: each decays differently.
        let results = apply_category_decay(&indicators, 30_000.0, &models, 0.01);
        assert_eq!(results.len(), 3);

        let identity_score = results[0].1;
        let kinematic_score = results[1].1;
        let association_score = results[2].1;

        // Kinematic (k=0.7, fast decay) should be lowest.
        assert!(kinematic_score < identity_score, "Kinematic should decay faster");
        // Association (power-law, fat tail) should retain most.
        assert!(association_score > identity_score, "Association should retain more");
    }

    #[test]
    fn category_decay_missing_model_preserves_score() {
        let models = vec![exponential(60_000.0)]; // Only category 0.
        let indicators = vec![
            (0.8, 0.0, 0), // Has model → decays.
            (0.8, 0.0, 5), // No model → preserved.
        ];
        let results = apply_category_decay(&indicators, 60_000.0, &models, 0.01);
        assert_eq!(results.len(), 2);
        assert!((results[0].1 - 0.4).abs() < 1e-6, "Category 0 should be at half-life");
        assert!((results[1].1 - 0.8).abs() < 1e-10, "Category 5 should be preserved");
    }
}
