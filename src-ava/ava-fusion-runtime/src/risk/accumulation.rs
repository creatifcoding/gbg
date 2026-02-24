//! Risk accumulation functions: Leaky NoisyOr, NoisyMAX, convergence bonus.
//!
//! These are pure functions suitable for use in differential-dataflow
//! `reduce` closures or standalone in actor logic.

// ---------------------------------------------------------------------------
// Leaky NoisyOr
// ---------------------------------------------------------------------------

/// Leaky NoisyOr risk accumulation.
///
/// Formula: `P(risk) = 1 - q₀ · Π(1 - pᵢ · xᵢ)`
///
/// Where `q₀ = 1 - p_leak` represents the probability that NO unmodeled
/// cause triggers the risk.
///
/// - `scores`: individual indicator scores, each in [0.0, 1.0].
/// - `q0`: background "no-cause" probability (typically 0.95).
///
/// Returns combined risk score in [0.0, 1.0].
pub fn leaky_noisy_or(scores: &[f64], q0: f64) -> f64 {
    if scores.is_empty() {
        // With no indicators, only background risk applies.
        return 1.0 - q0;
    }
    let product: f64 = scores
        .iter()
        .map(|&s| 1.0 - s.clamp(0.0, 1.0))
        .product();
    (1.0 - q0 * product).clamp(0.0, 1.0)
}

/// Standard NoisyOr (q₀ = 1.0, no leak).
///
/// Formula: `P(risk) = 1 - Π(1 - sᵢ)`
pub fn noisy_or(scores: &[f64]) -> f64 {
    leaky_noisy_or(scores, 1.0)
}

// ---------------------------------------------------------------------------
// NoisyMAX ordinal severity
// ---------------------------------------------------------------------------

/// Ordinal severity levels, ordered from least to most severe.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum SeverityLevel {
    Low,
    Elevated,
    High,
    Severe,
    Critical,
}

impl SeverityLevel {
    /// All levels from highest to lowest (for threshold scanning).
    pub const DESCENDING: [SeverityLevel; 5] = [
        SeverityLevel::Critical,
        SeverityLevel::Severe,
        SeverityLevel::High,
        SeverityLevel::Elevated,
        SeverityLevel::Low,
    ];
}

/// NoisyMAX ordinal risk classification.
///
/// Applies Leaky NoisyOr independently at each severity threshold.
/// Returns the highest severity level where `P(risk >= level) > decision_threshold`.
///
/// - `indicators`: `(score, severity_floor)` — each indicator's score and the
///   minimum severity it contributes to.
/// - `q0`: background no-cause probability.
/// - `decision_threshold`: probability cutoff (typically 0.5).
pub fn noisy_max_ordinal(
    indicators: &[(f64, SeverityLevel)],
    q0: f64,
    decision_threshold: f64,
) -> SeverityLevel {
    for &level in &SeverityLevel::DESCENDING {
        let relevant: Vec<f64> = indicators
            .iter()
            .filter(|&&(_, sev)| sev >= level)
            .map(|&(score, _)| score)
            .collect();
        if relevant.is_empty() {
            continue;
        }
        let p = leaky_noisy_or(&relevant, q0);
        if p > decision_threshold {
            return level;
        }
    }
    SeverityLevel::Low
}

// ---------------------------------------------------------------------------
// Convergence bonus
// ---------------------------------------------------------------------------

/// Convergence bonus rewarding multi-category corroboration.
///
/// Formula: `bonus = beta * (K/N)^gamma * (0.5 + 0.5 * H/H_max)`
///
/// Where:
/// - K = number of active risk categories
/// - N = total risk categories (6)
/// - H = Shannon entropy of normalized category scores
/// - H_max = ln(K) (maximum entropy for K categories)
/// - beta = base bonus coefficient (default 0.3)
/// - gamma = power exponent (default 1.5)
///
/// Returns a bonus in [0.0, beta].
pub fn convergence_bonus(
    category_scores: &[f64],
    total_categories: usize,
    beta: f64,
    gamma: f64,
) -> f64 {
    // Filter active categories (score > 0).
    let active: Vec<f64> = category_scores
        .iter()
        .copied()
        .filter(|&s| s > 1e-10)
        .collect();
    let k = active.len();
    if k == 0 || total_categories == 0 {
        return 0.0;
    }

    let n = total_categories as f64;
    let base = (k as f64 / n).powf(gamma);

    // Shannon entropy of normalized scores.
    let total: f64 = active.iter().sum();
    let entropy_factor = if total > 1e-10 && k > 1 {
        let h: f64 = active
            .iter()
            .map(|&s| {
                let p = s / total;
                if p > 1e-15 { -p * p.ln() } else { 0.0 }
            })
            .sum();
        let h_max = (k as f64).ln();
        if h_max > 1e-15 {
            0.5 + 0.5 * (h / h_max)
        } else {
            0.5
        }
    } else {
        0.5 // Single active category: no entropy component.
    };

    (beta * base * entropy_factor).clamp(0.0, beta)
}

// ---------------------------------------------------------------------------
// Composite risk score
// ---------------------------------------------------------------------------

/// Compute composite risk score from per-category scores using weighted
/// Leaky NoisyOr with convergence bonus.
///
/// - `category_scores`: `(score, weight)` per active category.
/// - `q0`: background leak probability.
/// - `beta`: convergence bonus coefficient.
/// - `gamma`: convergence bonus exponent.
///
/// Returns composite risk in [0.0, 1.0].
pub fn composite_risk(
    category_scores: &[(f64, f64)],
    q0: f64,
    beta: f64,
    gamma: f64,
) -> f64 {
    if category_scores.is_empty() {
        return 1.0 - q0; // Background risk only.
    }

    // Weighted scores: each category contributes score * weight.
    let weighted: Vec<f64> = category_scores
        .iter()
        .map(|&(score, weight)| (score * weight).clamp(0.0, 1.0))
        .collect();

    let base_risk = leaky_noisy_or(&weighted, q0);

    let scores_only: Vec<f64> = category_scores.iter().map(|&(s, _)| s).collect();
    let bonus = convergence_bonus(&scores_only, 6, beta, gamma);

    (base_risk + bonus).clamp(0.0, 1.0)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -- Leaky NoisyOr --

    #[test]
    fn leaky_noisy_or_empty_scores() {
        // No indicators, only background risk.
        let result = leaky_noisy_or(&[], 0.95);
        assert!((result - 0.05).abs() < 1e-10, "Background risk should be 5%, got {result}");
    }

    #[test]
    fn leaky_noisy_or_single_indicator() {
        // P = 1 - 0.95 * (1 - 0.8) = 1 - 0.95 * 0.2 = 1 - 0.19 = 0.81
        let result = leaky_noisy_or(&[0.8], 0.95);
        assert!((result - 0.81).abs() < 1e-10, "Expected 0.81, got {result}");
    }

    #[test]
    fn leaky_noisy_or_two_indicators() {
        // P = 1 - 0.95 * (1-0.5) * (1-0.3) = 1 - 0.95 * 0.5 * 0.7 = 1 - 0.3325 = 0.6675
        let result = leaky_noisy_or(&[0.5, 0.3], 0.95);
        assert!((result - 0.6675).abs() < 1e-10, "Expected 0.6675, got {result}");
    }

    #[test]
    fn leaky_noisy_or_q0_one_is_standard() {
        // With q0=1.0, leaky NoisyOr degenerates to standard NoisyOr.
        let scores = [0.3, 0.5, 0.2];
        let leaky = leaky_noisy_or(&scores, 1.0);
        let standard = noisy_or(&scores);
        assert!((leaky - standard).abs() < 1e-15);
    }

    #[test]
    fn noisy_or_basic() {
        // P = 1 - (1-0.3)(1-0.5)(1-0.2) = 1 - 0.7*0.5*0.8 = 1 - 0.28 = 0.72
        let result = noisy_or(&[0.3, 0.5, 0.2]);
        assert!((result - 0.72).abs() < 1e-10, "Expected 0.72, got {result}");
    }

    #[test]
    fn noisy_or_diminishing_returns() {
        // Adding indicators always increases but with diminishing returns.
        let one = noisy_or(&[0.3]);
        let two = noisy_or(&[0.3, 0.3]);
        let three = noisy_or(&[0.3, 0.3, 0.3]);
        assert!(two > one);
        assert!(three > two);
        assert!(two - one > three - two, "Diminishing returns");
    }

    #[test]
    fn leaky_noisy_or_zero_leak_is_standard() {
        let scores = [0.4, 0.6];
        let result = leaky_noisy_or(&scores, 1.0);
        let expected = 1.0 - (1.0 - 0.4) * (1.0 - 0.6);
        assert!((result - expected).abs() < 1e-15);
    }

    #[test]
    fn leaky_noisy_or_full_leak() {
        // q0 = 0 means background alone triggers risk = 1.0
        let result = leaky_noisy_or(&[0.5], 0.0);
        assert!((result - 1.0).abs() < 1e-10);
    }

    // -- NoisyMAX --

    #[test]
    fn noisy_max_no_indicators_is_low() {
        let result = noisy_max_ordinal(&[], 0.95, 0.5);
        assert_eq!(result, SeverityLevel::Low);
    }

    #[test]
    fn noisy_max_single_critical() {
        let indicators = vec![(0.9, SeverityLevel::Critical)];
        let result = noisy_max_ordinal(&indicators, 0.95, 0.5);
        assert_eq!(result, SeverityLevel::Critical);
    }

    #[test]
    fn noisy_max_mixed_severity() {
        let indicators = vec![
            (0.3, SeverityLevel::Low),
            (0.4, SeverityLevel::Elevated),
            (0.6, SeverityLevel::High),
        ];
        // The highest level with P > 0.5:
        // Critical: no indicators → Low
        // Severe: no indicators → Low
        // High: [0.6] → P = 1 - 0.95*(1-0.6) = 1 - 0.38 = 0.62 > 0.5 → High
        let result = noisy_max_ordinal(&indicators, 0.95, 0.5);
        assert_eq!(result, SeverityLevel::High);
    }

    #[test]
    fn noisy_max_weak_indicators_stay_low() {
        let indicators = vec![
            (0.1, SeverityLevel::Elevated),
            (0.05, SeverityLevel::High),
        ];
        // High: [0.05] → P = 1 - 0.95*0.95 = ~0.0975 < 0.5
        // Elevated: [0.1, 0.05] → P = 1 - 0.95*0.9*0.95 = ~0.1878 < 0.5
        // Low: all → P = 1 - 0.95*0.9*0.95 = ~0.1878 < 0.5
        // Still Low.
        let result = noisy_max_ordinal(&indicators, 0.95, 0.5);
        assert_eq!(result, SeverityLevel::Low);
    }

    // -- Convergence bonus --

    #[test]
    fn convergence_bonus_no_active_categories() {
        let result = convergence_bonus(&[0.0, 0.0, 0.0], 6, 0.3, 1.5);
        assert!((result - 0.0).abs() < 1e-15);
    }

    #[test]
    fn convergence_bonus_single_category() {
        // K=1, N=6. base = (1/6)^1.5 ≈ 0.068. entropy_factor = 0.5 (single).
        // bonus = 0.3 * 0.068 * 0.5 ≈ 0.010
        let result = convergence_bonus(&[0.5], 6, 0.3, 1.5);
        assert!(result > 0.0);
        assert!(result < 0.02, "Single category bonus should be tiny, got {result}");
    }

    #[test]
    fn convergence_bonus_all_categories_balanced() {
        // K=6, N=6. base = 1.0. entropy_factor = 0.5 + 0.5*1.0 = 1.0.
        // bonus = 0.3 * 1.0 * 1.0 = 0.3
        let balanced = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
        let result = convergence_bonus(&balanced, 6, 0.3, 1.5);
        assert!((result - 0.3).abs() < 1e-6, "Full balanced convergence should be ~0.3, got {result}");
    }

    #[test]
    fn convergence_bonus_increases_with_categories() {
        let one = convergence_bonus(&[0.5, 0.0, 0.0, 0.0, 0.0, 0.0], 6, 0.3, 1.5);
        let three = convergence_bonus(&[0.5, 0.5, 0.5, 0.0, 0.0, 0.0], 6, 0.3, 1.5);
        let five = convergence_bonus(&[0.5, 0.5, 0.5, 0.5, 0.5, 0.0], 6, 0.3, 1.5);
        assert!(three > one, "3 categories should get more bonus than 1");
        assert!(five > three, "5 categories should get more bonus than 3");
    }

    // -- Composite risk --

    #[test]
    fn composite_risk_empty_is_background() {
        let result = composite_risk(&[], 0.95, 0.3, 1.5);
        assert!((result - 0.05).abs() < 1e-10, "Expected background risk 0.05, got {result}");
    }

    #[test]
    fn composite_risk_single_category() {
        let scores = vec![(0.6, 0.20)];
        let result = composite_risk(&scores, 0.95, 0.3, 1.5);
        // Weighted score: 0.6 * 0.20 = 0.12
        // NoisyOr: 1 - 0.95 * (1 - 0.12) = 1 - 0.836 = 0.164
        // Convergence bonus: tiny for 1 category.
        assert!(result > 0.15);
        assert!(result < 0.20);
    }

    #[test]
    fn composite_risk_multiple_categories() {
        let scores = vec![
            (0.6, 0.20), // Identity
            (0.4, 0.20), // Kinematic
            (0.5, 0.20), // Behavioral
        ];
        let result = composite_risk(&scores, 0.95, 0.3, 1.5);
        // Three categories → moderate convergence bonus.
        assert!(result > 0.2, "Multi-category should exceed single, got {result}");
    }
}
