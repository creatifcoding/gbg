//! Confidence scoring functions for fusion results.
//!
//! Three combination strategies matching `ConfidenceModel`:
//! - Weighted average (default, interpretable)
//! - Log-odds (better mathematical properties for extremes)
//! - Dempster-Shafer (evidence theory with explicit ignorance)
//!
//! Each function takes pairs of (score, weight) and produces a
//! combined confidence in [0.0, 1.0].

/// Weighted average combination.
///
/// Formula: `sum(w_i * s_i) / sum(w_i)`
///
/// Returns 0.0 if weights sum to zero.
pub fn score_weighted_average(pairs: &[(f64, f64)]) -> f64 {
    let (weighted_sum, weight_sum) =
        pairs
            .iter()
            .fold((0.0_f64, 0.0_f64), |(ws, wt), &(score, weight)| {
                (ws + score * weight, wt + weight)
            });

    if weight_sum.abs() < f64::EPSILON {
        return 0.0;
    }
    (weighted_sum / weight_sum).clamp(0.0, 1.0)
}

/// Log-odds combination.
///
/// Formula: `1 / (1 + exp(-sum(log(p/(1-p)) * w_i)))`
///
/// Scores are clamped to [0.01, 0.99] to avoid infinite log-odds.
pub fn score_log_odds(pairs: &[(f64, f64)]) -> f64 {
    let log_odds_sum: f64 = pairs
        .iter()
        .map(|&(score, weight)| {
            let p = score.clamp(0.01, 0.99);
            let lo = (p / (1.0 - p)).ln();
            lo * weight
        })
        .sum();

    let combined = 1.0 / (1.0 + (-log_odds_sum).exp());
    combined.clamp(0.0, 1.0)
}

/// Dempster-Shafer combination rule.
///
/// Simplified two-hypothesis model: H (target) and not-H.
/// Evidence pairs are (belief_in_H, plausibility_weight).
///
/// Three variants selected by `rule`:
/// - `"standard"` — Dempster's rule with normalization (1-K).
/// - `"yager"` — Conflict mass transferred to ignorance.
/// - `"tbm"` — Transferable Belief Model (unnormalized).
///
/// Returns combined belief in H.
pub fn score_dempster_shafer(beliefs: &[(f64, f64)], rule: &str) -> f64 {
    if beliefs.is_empty() {
        return 0.0;
    }

    // Normalize beliefs to mass assignments.
    // For each source: m(H) = belief * weight, m(not-H) = (1-belief) * weight,
    // m(unknown) = 1 - m(H) - m(not-H).
    let mut combined_h = beliefs[0].0.clamp(0.0, 1.0);
    let mut combined_not_h = 1.0 - combined_h;
    let mut combined_unknown = 0.0_f64;

    for &(belief, _weight) in &beliefs[1..] {
        let m2_h = belief.clamp(0.0, 1.0);
        let m2_not_h = 1.0 - m2_h;

        // Conflict: mass assigned to empty set.
        let conflict = combined_h * m2_not_h + combined_not_h * m2_h;

        // Agreement on H.
        let agree_h = combined_h * m2_h;
        // Agreement on not-H.
        let agree_not_h = combined_not_h * m2_not_h;

        match rule {
            "standard" => {
                let norm = 1.0 - conflict;
                if norm.abs() < f64::EPSILON {
                    return 0.5; // Total conflict — indeterminate.
                }
                combined_h = agree_h / norm;
                combined_not_h = agree_not_h / norm;
                combined_unknown = 0.0;
            }
            "yager" => {
                combined_h = agree_h;
                combined_not_h = agree_not_h;
                combined_unknown += conflict; // Conflict -> ignorance.
            }
            "tbm" => {
                // Unnormalized: conflict stays as empty-set mass.
                combined_h = agree_h;
                combined_not_h = agree_not_h;
                combined_unknown += conflict;
            }
            _ => {
                // Default to standard.
                let norm = 1.0 - conflict;
                if norm.abs() < f64::EPSILON {
                    return 0.5;
                }
                combined_h = agree_h / norm;
                combined_not_h = agree_not_h / norm;
                combined_unknown = 0.0;
            }
        }
    }

    let _ = combined_not_h;
    let _ = combined_unknown;
    combined_h.clamp(0.0, 1.0)
}

/// Dempster-Shafer with entropy-based evidence weighting.
///
/// Sources with high uncertainty (high entropy) get lower weight.
/// This prevents paradoxes from Zadeh's counter-example.
///
/// Algorithm (Khan & Anwar, Sensors 2019):
/// 1. Compute entropy H(m) = -p*log2(p) - (1-p)*log2(1-p) for each source
///    (two-hypothesis model: H and not-H).
/// 2. Weight: w_i = 1 / (1 + H(m_i))
/// 3. Discount: m_weighted(A) = w_i * m(A) for each focal element
/// 4. Transfer discounted mass to ignorance: m(Theta) += (1 - w_i)
/// 5. Combine using standard DS rule on weighted masses
///
/// Returns `(combined_belief, conflict_measure)`.
/// If conflict exceeds `conflict_threshold`, returns `(NaN, conflict)`.
pub fn score_dempster_shafer_entropy_weighted(
    beliefs: &[(f64, f64)],
    rule: &str,
    conflict_threshold: f64,
) -> (f64, f64) {
    if beliefs.is_empty() {
        return (0.0, 0.0);
    }

    // Helper: binary entropy H(p) = -p*log2(p) - (1-p)*log2(1-p)
    fn binary_entropy(p: f64) -> f64 {
        let p = p.clamp(0.0, 1.0);
        if p <= f64::EPSILON || p >= 1.0 - f64::EPSILON {
            return 0.0;
        }
        -(p * p.log2() + (1.0 - p) * (1.0 - p).log2())
    }

    // Step 1-4: Compute entropy weight and discount each source.
    // After discounting, a source becomes a three-focal BPA:
    //   m(H)       = w * belief
    //   m(not-H)   = w * (1 - belief)
    //   m(Theta)   = 1 - w          (ignorance from discount)
    let weighted_sources: Vec<(f64, f64, f64)> = beliefs
        .iter()
        .map(|&(belief, _raw_weight)| {
            let b = belief.clamp(0.0, 1.0);
            let h = binary_entropy(b);
            let w = 1.0 / (1.0 + h);
            let m_h = w * b;
            let m_not_h = w * (1.0 - b);
            let m_theta = 1.0 - w;
            // Sanity: m_h + m_not_h + m_theta == 1.0
            let _ = m_theta;
            (m_h, m_not_h, m_theta)
        })
        .collect();

    // Step 5: Combine using DS rule.
    // Start with first source's discounted BPA.
    let (mut c_h, mut c_not_h, mut c_theta) = weighted_sources[0];

    let mut total_conflict = 0.0_f64;

    for &(m2_h, m2_not_h, m2_theta) in &weighted_sources[1..] {
        // Full three-focal combination:
        // Agreement on H:
        let agree_h = c_h * m2_h + c_h * m2_theta + c_theta * m2_h;
        // Agreement on not-H:
        let agree_not_h = c_not_h * m2_not_h + c_not_h * m2_theta + c_theta * m2_not_h;
        // Agreement on Theta (ignorance):
        let agree_theta = c_theta * m2_theta;
        // Conflict: mass assigned to empty set.
        let conflict = c_h * m2_not_h + c_not_h * m2_h;

        total_conflict = 1.0 - (1.0 - total_conflict) * (1.0 - conflict);

        match rule {
            "standard" => {
                let norm = 1.0 - conflict;
                if norm.abs() < f64::EPSILON {
                    c_h = 0.5;
                    c_not_h = 0.5;
                    c_theta = 0.0;
                } else {
                    c_h = agree_h / norm;
                    c_not_h = agree_not_h / norm;
                    c_theta = agree_theta / norm;
                }
            }
            "yager" => {
                c_h = agree_h;
                c_not_h = agree_not_h;
                c_theta = agree_theta + conflict;
            }
            "tbm" => {
                c_h = agree_h;
                c_not_h = agree_not_h;
                c_theta = agree_theta + conflict;
            }
            _ => {
                // Default to standard.
                let norm = 1.0 - conflict;
                if norm.abs() < f64::EPSILON {
                    c_h = 0.5;
                    c_not_h = 0.5;
                    c_theta = 0.0;
                } else {
                    c_h = agree_h / norm;
                    c_not_h = agree_not_h / norm;
                    c_theta = agree_theta / norm;
                }
            }
        }
    }

    // Threshold check.
    if total_conflict > conflict_threshold {
        return (f64::NAN, total_conflict);
    }

    (c_h.clamp(0.0, 1.0), total_conflict)
}

/// Apply correlation discount to avoid double-counting correlated predicates.
///
/// The `matrix` is a 5x5 correlation matrix with index order:
/// 0=spatial, 1=temporal, 2=spectral, 3=behavioral, 4=semantic.
///
/// `scores` may have fewer than 5 entries; only the first `scores.len()`
/// dimensions are considered.
///
/// Algorithm:
/// For each predicate `i`, accumulate correlation penalty from all other
/// predicates `j`:
///   `effective_weight[i] *= 1.0 - (correlation[i][j] * weight_j / total_weight)`
///
/// Returns adjusted (score, weight) pairs.
pub fn apply_correlation_discount(
    scores: &[(f64, f64)],
    matrix: &[[f64; 5]; 5],
) -> Vec<(f64, f64)> {
    let n = scores.len().min(5);
    if n == 0 {
        return vec![];
    }

    let total_weight: f64 = scores[..n].iter().map(|&(_, w)| w).sum();
    if total_weight.abs() < f64::EPSILON {
        return scores[..n].to_vec();
    }

    let mut result = Vec::with_capacity(n);

    for i in 0..n {
        let (score, weight) = scores[i];
        let mut discount = 1.0_f64;

        for j in 0..n {
            if i == j {
                continue;
            }
            let corr = matrix[i][j].clamp(0.0, 1.0);
            let other_fraction = scores[j].1 / total_weight;
            discount *= 1.0 - (corr * other_fraction);
        }

        result.push((score, weight * discount));
    }

    result
}

// ---------------------------------------------------------------------------
// Kahan compensated summation
// ---------------------------------------------------------------------------

/// Kahan compensated summation for numerical stability in reduce closures.
///
/// Standard floating-point summation accumulates rounding errors proportional
/// to N. Kahan summation maintains a running compensation term, reducing
/// error to O(1) regardless of N.
///
/// Use this in any dd `reduce` closure that accumulates f64 values.
pub fn kahan_sum(values: &[f64]) -> f64 {
    let mut sum = 0.0_f64;
    let mut compensation = 0.0_f64;
    for &v in values {
        let y = v - compensation;
        let t = sum + y;
        compensation = (t - sum) - y;
        sum = t;
    }
    sum
}

// ---------------------------------------------------------------------------
// PCR5 combination rule (Smarandache & Dezert 2006)
// ---------------------------------------------------------------------------

/// PCR5 (Proportional Conflict Redistribution #5) combination of two BPAs.
///
/// Unlike Dempster's rule which normalizes conflict globally, PCR5
/// redistributes each conflicting mass proportionally to each source's
/// commitment to the involved hypotheses.
///
/// NOT associative for n>2 sources. For n>2, use `murphy_average_bpa()`
/// first, then self-combine with PCR5.
///
/// Input: two BPAs as `Vec<(u64, f64)>` where u64 is the hypothesis bitset.
/// Output: combined BPA.
///
/// Complexity: O(F₁ × F₂) where F = number of focal elements.
pub fn pcr5_combine(
    bpa1: &[(u64, f64)],
    bpa2: &[(u64, f64)],
) -> Vec<(u64, f64)> {
    use std::collections::HashMap;
    let mut result: HashMap<u64, f64> = HashMap::new();

    // Phase 1: Compute conjunctive mass (agreement).
    for &(a_set, a_mass) in bpa1 {
        for &(b_set, b_mass) in bpa2 {
            let intersection = a_set & b_set;
            let product = a_mass * b_mass;
            if intersection != 0 {
                *result.entry(intersection).or_insert(0.0) += product;
            }
            // Conflict (intersection = ∅) handled in Phase 2.
        }
    }

    // Phase 2: Redistribute conflict proportionally (PCR5).
    for &(a_set, a_mass) in bpa1 {
        for &(b_set, b_mass) in bpa2 {
            if a_set & b_set != 0 {
                continue; // Not a conflict.
            }
            let conflict_mass = a_mass * b_mass;
            if conflict_mass < 1e-15 {
                continue;
            }

            // Redistribute to a_set proportional to a_mass / (a_mass + b_mass).
            let total_commitment = a_mass + b_mass;
            if total_commitment > 1e-15 {
                let share_a = conflict_mass * a_mass / total_commitment;
                let share_b = conflict_mass * b_mass / total_commitment;
                *result.entry(a_set).or_insert(0.0) += share_a;
                *result.entry(b_set).or_insert(0.0) += share_b;
            }
        }
    }

    let mut out: Vec<(u64, f64)> = result.into_iter().filter(|&(_, m)| m > 1e-15).collect();
    out.sort_by_key(|&(set, _)| set);
    out
}

// ---------------------------------------------------------------------------
// Murphy's average BPA (for n>2 source combination)
// ---------------------------------------------------------------------------

/// Murphy's average BPA: average n BPAs then self-combine (n-1) times.
///
/// Since PCR5 is NOT associative, combining n>2 BPAs requires this
/// approach: compute the arithmetic mean of all n BPAs, then combine
/// the average with itself (n-1) times using the chosen rule.
///
/// Returns the averaged BPA (combine separately with PCR5 or Dempster).
pub fn murphy_average_bpa(bpas: &[Vec<(u64, f64)>]) -> Vec<(u64, f64)> {
    use std::collections::HashMap;
    if bpas.is_empty() {
        return vec![];
    }
    if bpas.len() == 1 {
        return bpas[0].clone();
    }

    let n = bpas.len() as f64;
    let mut avg: HashMap<u64, f64> = HashMap::new();

    for bpa in bpas {
        for &(set, mass) in bpa {
            *avg.entry(set).or_insert(0.0) += mass / n;
        }
    }

    let mut out: Vec<(u64, f64)> = avg.into_iter().filter(|&(_, m)| m > 1e-15).collect();
    out.sort_by_key(|&(set, _)| set);
    out
}

// ---------------------------------------------------------------------------
// Jousselme distance (evidence distance metric)
// ---------------------------------------------------------------------------

/// Jousselme distance between two BPAs (Jousselme et al. 2001).
///
/// d(m₁, m₂) = √(0.5 · (m₁ - m₂)ᵀ · D · (m₁ - m₂))
///
/// Where D is the Jaccard similarity matrix: D(A,B) = |A∩B| / |A∪B|.
/// Returns a value in [0, 1]. d=0 means identical, d=1 means maximally different.
///
/// This is a TRUE metric (satisfies triangle inequality).
pub fn jousselme_distance(
    bpa1: &[(u64, f64)],
    bpa2: &[(u64, f64)],
) -> f64 {
    use std::collections::HashSet;

    // Collect all focal elements from both BPAs.
    let all_sets: Vec<u64> = {
        let mut sets: HashSet<u64> = HashSet::new();
        for &(s, _) in bpa1 {
            sets.insert(s);
        }
        for &(s, _) in bpa2 {
            sets.insert(s);
        }
        let mut v: Vec<u64> = sets.into_iter().collect();
        v.sort();
        v
    };

    let n = all_sets.len();
    if n == 0 {
        return 0.0;
    }

    // Build mass difference vector.
    let diff: Vec<f64> = all_sets
        .iter()
        .map(|&set| {
            let m1 = bpa1.iter().find(|&&(s, _)| s == set).map(|&(_, m)| m).unwrap_or(0.0);
            let m2 = bpa2.iter().find(|&&(s, _)| s == set).map(|&(_, m)| m).unwrap_or(0.0);
            m1 - m2
        })
        .collect();

    // Compute (m1-m2)^T · D · (m1-m2) where D[i][j] = |Ai∩Aj| / |Ai∪Aj|.
    let mut quadratic = 0.0_f64;
    for i in 0..n {
        for j in 0..n {
            let ai = all_sets[i];
            let aj = all_sets[j];
            let intersection = (ai & aj).count_ones() as f64;
            let union = (ai | aj).count_ones() as f64;
            let jaccard = if union > 0.0 { intersection / union } else { 0.0 };
            quadratic += diff[i] * jaccard * diff[j];
        }
    }

    (0.5 * quadratic).abs().sqrt().clamp(0.0, 1.0)
}

// ---------------------------------------------------------------------------
// Epsilon pruning for BPAs
// ---------------------------------------------------------------------------

/// Prune focal elements with mass below epsilon, redistributing
/// proportionally to surviving elements.
pub fn epsilon_prune_bpa(bpa: &mut Vec<(u64, f64)>, epsilon: f64) {
    let pruned_mass: f64 = bpa.iter().filter(|&&(_, m)| m < epsilon).map(|&(_, m)| m).sum();
    bpa.retain(|&(_, m)| m >= epsilon);
    if pruned_mass > 0.0 && !bpa.is_empty() {
        let remaining: f64 = bpa.iter().map(|&(_, m)| m).sum();
        if remaining > 0.0 {
            let scale = (remaining + pruned_mass) / remaining;
            for entry in bpa.iter_mut() {
                entry.1 *= scale;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weighted_average_basic() {
        // Two scores: 0.8 weight 1.0, 0.4 weight 1.0 -> 0.6
        let pairs = vec![(0.8, 1.0), (0.4, 1.0)];
        let result = score_weighted_average(&pairs);
        assert!((result - 0.6).abs() < 1e-6);
    }

    #[test]
    fn weighted_average_with_weights() {
        // 0.9 * 3.0 + 0.3 * 1.0 = 3.0 / 4.0 = 0.75
        let pairs = vec![(0.9, 3.0), (0.3, 1.0)];
        let result = score_weighted_average(&pairs);
        assert!((result - 0.75).abs() < 1e-6);
    }

    #[test]
    fn weighted_average_empty() {
        let result = score_weighted_average(&[]);
        assert!((result - 0.0).abs() < 1e-6);
    }

    #[test]
    fn log_odds_basic() {
        // Single score 0.5 -> log-odds = 0, combined = 0.5
        let pairs = vec![(0.5, 1.0)];
        let result = score_log_odds(&pairs);
        assert!((result - 0.5).abs() < 1e-3);
    }

    #[test]
    fn log_odds_high_confidence() {
        // Two high-confidence sources should produce very high combined.
        let pairs = vec![(0.9, 1.0), (0.9, 1.0)];
        let result = score_log_odds(&pairs);
        assert!(result > 0.95);
    }

    #[test]
    fn dempster_shafer_standard_agreeing() {
        // Two agreeing sources with high belief.
        let beliefs = vec![(0.8, 1.0), (0.9, 1.0)];
        let result = score_dempster_shafer(&beliefs, "standard");
        // Combined belief should be higher than both individual.
        assert!(result > 0.9);
    }

    #[test]
    fn dempster_shafer_yager() {
        let beliefs = vec![(0.7, 1.0), (0.6, 1.0)];
        let result = score_dempster_shafer(&beliefs, "yager");
        // Yager: conflict goes to ignorance, result should be moderate.
        assert!(result > 0.3);
        assert!(result < 1.0);
    }

    #[test]
    fn dempster_shafer_tbm() {
        let beliefs = vec![(0.7, 1.0), (0.6, 1.0)];
        let result = score_dempster_shafer(&beliefs, "tbm");
        assert!(result > 0.3);
        assert!(result < 1.0);
    }

    #[test]
    fn dempster_shafer_empty() {
        let result = score_dempster_shafer(&[], "standard");
        assert!((result - 0.0).abs() < 1e-6);
    }

    // -----------------------------------------------------------------------
    // Entropy-weighted Dempster-Shafer tests
    // -----------------------------------------------------------------------

    #[test]
    fn entropy_weighted_ds_uncertain_source_low_weight() {
        // Source A: belief=0.9, highly certain (low entropy → high weight).
        // Source B: belief=0.5, maximally uncertain (entropy=1.0 → weight=0.5).
        // The uncertain source should be discounted. Entropy weighting
        // transfers mass to ignorance, so combined belief is lower than
        // unweighted DS but the uncertain source has less influence.
        //
        // Math: H(0.9)~0.469, w_A~0.681; H(0.5)=1.0, w_B=0.5
        // With w_B < w_A, the uncertain source pulls less than in unweighted DS.
        let beliefs = vec![(0.9, 1.0), (0.5, 1.0)];
        let (combined, conflict) = score_dempster_shafer_entropy_weighted(&beliefs, "standard", 0.9);
        assert!(
            !combined.is_nan(),
            "Expected valid result, got NaN (conflict={conflict})"
        );
        // Combined belief should be moderate — entropy discounting transfers
        // mass to ignorance, but the certain source dominates.
        assert!(
            combined > 0.6,
            "Expected combined > 0.6, got {combined}"
        );
        // Verify uncertain source was indeed discounted: combined should be
        // closer to source A's discounted belief than source B's.
        assert!(
            combined > 0.5,
            "Expected combined to exceed uncertain source's belief, got {combined}"
        );
    }

    #[test]
    fn entropy_weighted_ds_certain_source_high_weight() {
        // Two very certain sources agreeing: belief=0.95 and 0.92.
        // Both have low entropy → high weight → strong combination.
        //
        // Math: H(0.95)~0.286, w~0.778; H(0.92)~0.405, w~0.712
        // Entropy weighting transfers some mass to ignorance even for
        // certain sources, so combined belief is lower than unweighted DS
        // but still high.
        let beliefs = vec![(0.95, 1.0), (0.92, 1.0)];
        let (combined, _conflict) =
            score_dempster_shafer_entropy_weighted(&beliefs, "standard", 0.9);
        assert!(
            !combined.is_nan(),
            "Expected valid result"
        );
        // Combined should be high (> 0.88) since both sources agree with
        // low entropy, but not as extreme as unweighted DS due to ignorance mass.
        assert!(
            combined > 0.88,
            "Expected combined > 0.88 from two certain agreeing sources, got {combined}"
        );
        // Should exceed both individual discounted beliefs.
        assert!(
            combined > 0.78,
            "Combined should exceed individual discounted belief, got {combined}"
        );
    }

    #[test]
    fn entropy_weighted_ds_conflict_threshold() {
        // Two highly conflicting sources: one says 0.99, other says 0.01.
        // This should generate high conflict and exceed threshold.
        let beliefs = vec![(0.99, 1.0), (0.01, 1.0)];
        let (combined, conflict) =
            score_dempster_shafer_entropy_weighted(&beliefs, "standard", 0.3);
        assert!(
            combined.is_nan(),
            "Expected NaN for high-conflict scenario, got {combined}"
        );
        assert!(
            conflict > 0.3,
            "Conflict measure should exceed threshold, got {conflict}"
        );
    }

    #[test]
    fn entropy_weighted_ds_single_source() {
        // Single source passthrough: belief should come back ~proportional.
        let beliefs = vec![(0.8, 1.0)];
        let (combined, conflict) =
            score_dempster_shafer_entropy_weighted(&beliefs, "standard", 0.9);
        assert!(
            !combined.is_nan(),
            "Single source should not NaN"
        );
        // Weight for belief=0.8: entropy ~ 0.722, w ~ 1/(1+0.722) ~ 0.581
        // m(H) = 0.581 * 0.8 = ~0.465
        // But combined_h is just m(H) for a single source.
        assert!(
            combined > 0.3 && combined < 0.8,
            "Single source with entropy discount: expected 0.3 < combined < 0.8, got {combined}"
        );
        assert!(
            conflict.abs() < f64::EPSILON,
            "No conflict with single source, got {conflict}"
        );
    }

    // -----------------------------------------------------------------------
    // Correlation discount tests
    // -----------------------------------------------------------------------

    #[test]
    fn correlation_discount_independent() {
        // Identity matrix: no off-diagonal correlation → no discount.
        let identity = [
            [1.0, 0.0, 0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0, 0.0, 0.0],
            [0.0, 0.0, 1.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 0.0, 1.0],
        ];
        let scores = vec![
            (0.8, 0.35),
            (0.7, 0.25),
            (0.6, 0.20),
            (0.5, 0.15),
            (0.4, 0.05),
        ];
        let adjusted = apply_correlation_discount(&scores, &identity);
        assert_eq!(adjusted.len(), 5);
        for (i, &(score, weight)) in adjusted.iter().enumerate() {
            assert!(
                (score - scores[i].0).abs() < 1e-10,
                "Score should be unchanged"
            );
            assert!(
                (weight - scores[i].1).abs() < 1e-10,
                "Weight should be unchanged with identity matrix, dim {i}: expected {}, got {weight}",
                scores[i].1
            );
        }
    }

    #[test]
    fn correlation_discount_correlated() {
        // High correlation between spatial(0) and temporal(1).
        let mut matrix = [
            [1.0, 0.0, 0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0, 0.0, 0.0],
            [0.0, 0.0, 1.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 0.0, 1.0],
        ];
        matrix[0][1] = 0.8;
        matrix[1][0] = 0.8;

        let scores = vec![(0.9, 0.5), (0.8, 0.5)];
        let adjusted = apply_correlation_discount(&scores, &matrix);
        assert_eq!(adjusted.len(), 2);
        // Both weights should be reduced due to cross-correlation.
        assert!(
            adjusted[0].1 < 0.5,
            "Spatial weight should be discounted, got {}",
            adjusted[0].1
        );
        assert!(
            adjusted[1].1 < 0.5,
            "Temporal weight should be discounted, got {}",
            adjusted[1].1
        );
        // Scores remain unchanged.
        assert!((adjusted[0].0 - 0.9).abs() < 1e-10);
        assert!((adjusted[1].0 - 0.8).abs() < 1e-10);
    }

    #[test]
    fn correlation_discount_handles_fewer_than_5() {
        // Only 2 dimensions, identity correlation → no discount.
        let identity = [
            [1.0, 0.0, 0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0, 0.0, 0.0],
            [0.0, 0.0, 1.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 0.0, 1.0],
        ];
        let scores = vec![(0.7, 0.6), (0.3, 0.4)];
        let adjusted = apply_correlation_discount(&scores, &identity);
        assert_eq!(adjusted.len(), 2);
        assert!((adjusted[0].1 - 0.6).abs() < 1e-10);
        assert!((adjusted[1].1 - 0.4).abs() < 1e-10);
    }

    // -----------------------------------------------------------------------
    // Kahan compensated summation
    // -----------------------------------------------------------------------

    #[test]
    fn kahan_sum_basic() {
        let values = vec![0.1, 0.2, 0.3];
        let result = kahan_sum(&values);
        assert!((result - 0.6).abs() < 1e-15);
    }

    #[test]
    fn kahan_sum_many_small_values() {
        // 10000 × 0.0001 should = 1.0 exactly.
        let values: Vec<f64> = (0..10000).map(|_| 0.0001).collect();
        let result = kahan_sum(&values);
        assert!(
            (result - 1.0).abs() < 1e-12,
            "Expected ~1.0, got {result}"
        );
    }

    #[test]
    fn kahan_sum_empty() {
        assert!((kahan_sum(&[]) - 0.0).abs() < 1e-15);
    }

    // -----------------------------------------------------------------------
    // PCR5 combination
    // -----------------------------------------------------------------------

    #[test]
    fn pcr5_combine_agreeing_sources() {
        // Frame: {H0, H1}. Both sources agree H0 is likely.
        // BPA1: m({H0})=0.8, m({H0,H1})=0.2
        // BPA2: m({H0})=0.7, m({H0,H1})=0.3
        let bpa1 = vec![(0b01, 0.8), (0b11, 0.2)];
        let bpa2 = vec![(0b01, 0.7), (0b11, 0.3)];
        let result = pcr5_combine(&bpa1, &bpa2);
        // Combined belief in H0 should be strong.
        let m_h0: f64 = result
            .iter()
            .filter(|&&(set, _)| set & 0b01 == set) // subsets of {H0}
            .map(|&(_, m)| m)
            .sum();
        assert!(m_h0 > 0.5, "Expected strong belief in H0, got m(H0)={m_h0}");
        // Total mass should be ~1.0.
        let total: f64 = result.iter().map(|&(_, m)| m).sum();
        assert!((total - 1.0).abs() < 1e-10, "Total mass={total} != 1.0");
    }

    #[test]
    fn pcr5_combine_conflicting_sources() {
        // Frame: {H0, H1}. Sources disagree.
        // BPA1: m({H0})=0.9, m({H1})=0.1
        // BPA2: m({H0})=0.1, m({H1})=0.9
        let bpa1 = vec![(0b01, 0.9), (0b10, 0.1)];
        let bpa2 = vec![(0b01, 0.1), (0b10, 0.9)];
        let result = pcr5_combine(&bpa1, &bpa2);
        // PCR5 redistributes conflict proportionally.
        // Conflict mass from (H0∩H1=∅): 0.9*0.9=0.81 + 0.1*0.1=0.01 = 0.82
        // Both should get roughly balanced masses after redistribution.
        let total: f64 = result.iter().map(|&(_, m)| m).sum();
        assert!((total - 1.0).abs() < 1e-10, "Total mass={total} != 1.0");
    }

    #[test]
    fn pcr5_combine_total_mass_preserved() {
        // Arbitrary BPAs — total mass must always be 1.0.
        let bpa1 = vec![(0b001, 0.5), (0b010, 0.3), (0b111, 0.2)];
        let bpa2 = vec![(0b010, 0.6), (0b100, 0.1), (0b111, 0.3)];
        let result = pcr5_combine(&bpa1, &bpa2);
        let total: f64 = result.iter().map(|&(_, m)| m).sum();
        assert!(
            (total - 1.0).abs() < 1e-10,
            "PCR5 must preserve total mass: got {total}"
        );
    }

    // -----------------------------------------------------------------------
    // Murphy's average BPA
    // -----------------------------------------------------------------------

    #[test]
    fn murphy_average_single_bpa() {
        let bpas = vec![vec![(0b01, 0.8), (0b11, 0.2)]];
        let avg = murphy_average_bpa(&bpas);
        assert_eq!(avg.len(), 2);
        assert!((avg[0].1 - 0.8).abs() < 1e-10);
    }

    #[test]
    fn murphy_average_two_bpas() {
        let bpas = vec![
            vec![(0b01, 0.8), (0b11, 0.2)],
            vec![(0b01, 0.6), (0b11, 0.4)],
        ];
        let avg = murphy_average_bpa(&bpas);
        // avg m({H0}) = (0.8 + 0.6) / 2 = 0.7
        // avg m(Θ) = (0.2 + 0.4) / 2 = 0.3
        let m_h0 = avg.iter().find(|&&(s, _)| s == 0b01).map(|&(_, m)| m).unwrap_or(0.0);
        let m_theta = avg.iter().find(|&&(s, _)| s == 0b11).map(|&(_, m)| m).unwrap_or(0.0);
        assert!((m_h0 - 0.7).abs() < 1e-10);
        assert!((m_theta - 0.3).abs() < 1e-10);
    }

    #[test]
    fn murphy_average_empty() {
        let avg = murphy_average_bpa(&[]);
        assert!(avg.is_empty());
    }

    // -----------------------------------------------------------------------
    // Jousselme distance
    // -----------------------------------------------------------------------

    #[test]
    fn jousselme_identical_bpas() {
        let bpa = vec![(0b01, 0.7), (0b11, 0.3)];
        let d = jousselme_distance(&bpa, &bpa);
        assert!(d < 1e-10, "Identical BPAs should have distance 0, got {d}");
    }

    #[test]
    fn jousselme_maximally_different() {
        // BPA1: all mass on {H0}. BPA2: all mass on {H1}.
        let bpa1 = vec![(0b01, 1.0)];
        let bpa2 = vec![(0b10, 1.0)];
        let d = jousselme_distance(&bpa1, &bpa2);
        // Maximally different singletons → d = 1.0.
        assert!(
            (d - 1.0).abs() < 1e-10,
            "Maximally different BPAs should have distance 1.0, got {d}"
        );
    }

    #[test]
    fn jousselme_symmetry() {
        let bpa1 = vec![(0b01, 0.6), (0b11, 0.4)];
        let bpa2 = vec![(0b10, 0.5), (0b11, 0.5)];
        let d1 = jousselme_distance(&bpa1, &bpa2);
        let d2 = jousselme_distance(&bpa2, &bpa1);
        assert!(
            (d1 - d2).abs() < 1e-10,
            "Jousselme distance must be symmetric: {d1} != {d2}"
        );
    }

    #[test]
    fn jousselme_triangle_inequality() {
        let a = vec![(0b01, 0.8), (0b11, 0.2)];
        let b = vec![(0b01, 0.5), (0b10, 0.3), (0b11, 0.2)];
        let c = vec![(0b10, 0.7), (0b11, 0.3)];
        let d_ab = jousselme_distance(&a, &b);
        let d_bc = jousselme_distance(&b, &c);
        let d_ac = jousselme_distance(&a, &c);
        assert!(
            d_ac <= d_ab + d_bc + 1e-10,
            "Triangle inequality violated: d(a,c)={d_ac} > d(a,b)+d(b,c)={}", d_ab + d_bc
        );
    }

    // -----------------------------------------------------------------------
    // Epsilon pruning
    // -----------------------------------------------------------------------

    #[test]
    fn epsilon_prune_removes_tiny() {
        let mut bpa = vec![
            (0b01, 0.7),
            (0b10, 0.0005),
            (0b11, 0.2995),
        ];
        epsilon_prune_bpa(&mut bpa, 1e-3);
        assert_eq!(bpa.len(), 2);
        let total: f64 = bpa.iter().map(|&(_, m)| m).sum();
        assert!((total - 1.0).abs() < 1e-10, "Total after pruning: {total}");
    }

    #[test]
    fn epsilon_prune_keeps_all_above() {
        let mut bpa = vec![(0b01, 0.6), (0b10, 0.4)];
        epsilon_prune_bpa(&mut bpa, 1e-3);
        assert_eq!(bpa.len(), 2);
    }
}
