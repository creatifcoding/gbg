//! Confidence scoring types for multi-source data fusion.
//!
//! Covers confidence model selection, predicate weighting, evidence
//! correlation discounting, spoofing-aware degradation, and
//! Dempster-Shafer configuration.
//!
//! Source: TSGC-001-v2 Sections 2-3 (R4.1-R4.4).

use serde::{Deserialize, Serialize};
use typeshare::typeshare;

// ---------------------------------------------------------------------------
// ConfidenceModel — combination strategy selector
// ---------------------------------------------------------------------------

/// Selects the confidence combination strategy for soft-key fusion.
///
/// - `WeightedAverage` (default): Simple, interpretable, calibratable.
/// - `LogOdds`: Better mathematical properties for extreme values.
/// - `DempsterShafer`: Expert mode with explicit ignorance representation.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConfidenceModel {
    WeightedAverage,
    LogOdds,
    DempsterShafer,
}

impl Default for ConfidenceModel {
    fn default() -> Self {
        Self::WeightedAverage
    }
}

// ---------------------------------------------------------------------------
// PredicateWeights — per-dimension fusion weights
// ---------------------------------------------------------------------------

/// Weights for the five predicate dimensions used in Tier 2 soft-key fusion.
///
/// Default weights: spatial=0.35, temporal=0.25, spectral=0.20,
/// behavioral=0.15, semantic=0.05.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PredicateWeights {
    pub spatial: f64,
    pub temporal: f64,
    pub spectral: f64,
    pub behavioral: f64,
    pub semantic: f64,
}

impl Default for PredicateWeights {
    fn default() -> Self {
        Self {
            spatial: 0.35,
            temporal: 0.25,
            spectral: 0.20,
            behavioral: 0.15,
            semantic: 0.05,
        }
    }
}

// ---------------------------------------------------------------------------
// CorrelationMatrix — evidence correlation discount
// ---------------------------------------------------------------------------

/// 5x5 symmetric matrix encoding pairwise correlation between predicate
/// dimensions. Used to discount double-counted evidence.
///
/// Index order: \[spatial, temporal, spectral, behavioral, semantic\].
/// Diagonal entries are 1.0 (self-correlation).
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrelationMatrix {
    pub entries: [[f64; 5]; 5],
}

impl Default for CorrelationMatrix {
    fn default() -> Self {
        Self {
            entries: [
                //  spa   tmp   spc   beh   sem
                [1.0, 0.6, 0.1, 0.4, 0.05],  // spatial
                [0.6, 1.0, 0.1, 0.3, 0.1],    // temporal
                [0.1, 0.1, 1.0, 0.05, 0.0],   // spectral
                [0.4, 0.3, 0.05, 1.0, 0.1],   // behavioral
                [0.05, 0.1, 0.0, 0.1, 1.0],   // semantic
            ],
        }
    }
}

// ---------------------------------------------------------------------------
// SpoofingDiscount — hard-key confidence degradation
// ---------------------------------------------------------------------------

/// Configures spoofing-aware confidence degradation for hard-key (Tier 1)
/// fusion. When RI-7 heuristics flag an identifier, confidence degrades
/// from 0.99 by up to `max_discount`.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpoofingDiscount {
    pub enabled: bool,
    pub max_discount: f64,
}

impl Default for SpoofingDiscount {
    fn default() -> Self {
        Self {
            enabled: true,
            max_discount: 0.49,
        }
    }
}

// ---------------------------------------------------------------------------
// ConfidenceClamp — output range bounds
// ---------------------------------------------------------------------------

/// Clamping bounds for computed confidence scores.
///
/// Default: \[0.01, 0.99\]. The lower bound prevents division by zero
/// in log-odds conversion; the upper bound prevents false certainty.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfidenceClamp {
    pub min: f64,
    pub max: f64,
}

impl Default for ConfidenceClamp {
    fn default() -> Self {
        Self {
            min: 0.01,
            max: 0.99,
        }
    }
}

// ---------------------------------------------------------------------------
// DempsterShaferConfig — D-S combination parameters
// ---------------------------------------------------------------------------

/// Combination rule variants for Dempster-Shafer evidence theory.
///
/// - `Standard`: Dempster's original rule (normalised).
/// - `Yager`: Transfers conflict mass to the unknown hypothesis.
/// - `Tbm`: Transferable Belief Model (un-normalised).
/// - `Pcr5`: Proportional Conflict Redistribution #5 (Smarandache & Dezert).
///   Redistributes conflict mass proportionally to each source's commitment.
///   NOT associative for n>2 sources — use Murphy's average BPA first.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DsCombinationRule {
    Standard,
    Yager,
    Tbm,
    /// PCR5 (Smarandache & Dezert 2006). Proportional conflict redistribution.
    /// O(F²) per pair where F = number of focal elements.
    Pcr5,
}

/// Configuration for the Dempster-Shafer confidence model.
///
/// `conflict_threshold` at 0.7 warns the operator; at 0.9 the system
/// refuses combination (Zadeh's paradox avoidance).
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DempsterShaferConfig {
    pub conflict_threshold: f64,
    pub combination_rule: DsCombinationRule,
}

impl Default for DempsterShaferConfig {
    fn default() -> Self {
        Self {
            conflict_threshold: 0.7,
            combination_rule: DsCombinationRule::Standard,
        }
    }
}

// ---------------------------------------------------------------------------
// BasicProbabilityAssignment — Dempster-Shafer mass function
// ---------------------------------------------------------------------------

/// A focal element in a Basic Probability Assignment (BPA).
///
/// Uses a bitset representation: each bit position corresponds to a hypothesis
/// in the frame of discernment Θ. For n hypotheses, bit i represents Hᵢ.
/// Supports up to 64 hypotheses (u64 bitset).
///
/// Examples:
///   - `0b001` = {H₀}              (singleton)
///   - `0b011` = {H₀, H₁}          (disjunction)
///   - `0b111` = {H₀, H₁, H₂} = Θ (full ignorance)
///   - `0b000` = ∅                  (empty set, only in TBM)
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocalElement {
    /// Bitset encoding the hypothesis set.
    pub hypothesis_set: u64,
    /// Mass assigned to this focal element (0.0-1.0).
    pub mass: f64,
}

/// A Basic Probability Assignment (mass function) over a frame of discernment.
///
/// Invariants:
///   - All masses >= 0
///   - Sum of masses = 1.0 (within epsilon)
///   - `frame_size` <= 64 (bitset limitation)
///
/// Focal elements with mass below `epsilon` are pruned to bound computation.
/// k-additive BPAs (k=2) restrict focal elements to sets of size <= k,
/// providing O(n²) instead of O(2ⁿ) complexity.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BasicProbabilityAssignment {
    /// Number of hypotheses in the frame of discernment Θ.
    pub frame_size: u8,
    /// Focal elements with non-zero mass, ordered by hypothesis_set.
    pub focal_elements: Vec<FocalElement>,
}

impl BasicProbabilityAssignment {
    /// Create an empty BPA (all mass on Θ = full ignorance).
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

    /// Total mass (should be ~1.0 for a valid BPA).
    pub fn total_mass(&self) -> f64 {
        self.focal_elements.iter().map(|fe| fe.mass).sum()
    }

    /// Prune focal elements with mass below epsilon, redistributing
    /// proportionally to remaining elements.
    pub fn prune(&mut self, epsilon: f64) {
        let pruned_mass: f64 = self
            .focal_elements
            .iter()
            .filter(|fe| fe.mass < epsilon)
            .map(|fe| fe.mass)
            .sum();
        self.focal_elements.retain(|fe| fe.mass >= epsilon);
        if pruned_mass > 0.0 && !self.focal_elements.is_empty() {
            let remaining: f64 = self.focal_elements.iter().map(|fe| fe.mass).sum();
            if remaining > 0.0 {
                let scale = (remaining + pruned_mass) / remaining;
                for fe in &mut self.focal_elements {
                    fe.mass *= scale;
                }
            }
        }
    }

    /// Compute belief for a hypothesis set A: Bel(A) = Σ m(B) for all B ⊆ A.
    pub fn belief(&self, hypothesis_set: u64) -> f64 {
        self.focal_elements
            .iter()
            .filter(|fe| fe.hypothesis_set & hypothesis_set == fe.hypothesis_set)
            .map(|fe| fe.mass)
            .sum()
    }

    /// Compute plausibility for a hypothesis set A: Pl(A) = Σ m(B) for B ∩ A ≠ ∅.
    pub fn plausibility(&self, hypothesis_set: u64) -> f64 {
        self.focal_elements
            .iter()
            .filter(|fe| fe.hypothesis_set & hypothesis_set != 0)
            .map(|fe| fe.mass)
            .sum()
    }

    /// Compute the pignistic probability BetP(Hᵢ) (Smets 1990).
    ///
    /// BetP(Hᵢ) = Σ_{A: Hᵢ∈A} m(A)/|A| · 1/(1-m(∅))
    ///
    /// Returns a Vec of (hypothesis_index, probability) for all hypotheses.
    pub fn pignistic_transform(&self) -> Vec<(u8, f64)> {
        let empty_mass = self
            .focal_elements
            .iter()
            .find(|fe| fe.hypothesis_set == 0)
            .map(|fe| fe.mass)
            .unwrap_or(0.0);
        let normalizer = if (1.0 - empty_mass).abs() < 1e-15 {
            1.0
        } else {
            1.0 / (1.0 - empty_mass)
        };

        (0..self.frame_size)
            .map(|i| {
                let bit = 1u64 << i;
                let bet_p: f64 = self
                    .focal_elements
                    .iter()
                    .filter(|fe| fe.hypothesis_set & bit != 0)
                    .map(|fe| {
                        let cardinality = fe.hypothesis_set.count_ones() as f64;
                        fe.mass / cardinality
                    })
                    .sum::<f64>()
                    * normalizer;
                (i, bet_p)
            })
            .collect()
    }
}

/// Configuration for BPA operations.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BpaConfig {
    /// Epsilon threshold for focal element pruning (default: 1e-3).
    pub epsilon: f64,
    /// Maximum additivity level (k). Focal elements with |A| > k are pruned.
    /// k=2 is the sweet spot: O(n²) complexity, retains pairwise hypotheses.
    /// None = no restriction.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_additivity: Option<u8>,
}

impl Default for BpaConfig {
    fn default() -> Self {
        Self {
            epsilon: 1e-3,
            max_additivity: Some(2),
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -- ConfidenceModel --

    #[test]
    fn confidence_model_default_is_weighted_average() {
        assert_eq!(ConfidenceModel::default(), ConfidenceModel::WeightedAverage);
    }

    #[test]
    fn confidence_model_serde_roundtrip() {
        let variants = [
            ConfidenceModel::WeightedAverage,
            ConfidenceModel::LogOdds,
            ConfidenceModel::DempsterShafer,
        ];
        for model in variants {
            let json = serde_json::to_string(&model).unwrap();
            let parsed: ConfidenceModel = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, model);
        }
    }

    #[test]
    fn confidence_model_json_shape() {
        let json = serde_json::to_string(&ConfidenceModel::LogOdds).unwrap();
        assert_eq!(json, "\"logOdds\"");
    }

    // -- PredicateWeights --

    #[test]
    fn predicate_weights_default_sums_to_one() {
        let w = PredicateWeights::default();
        let sum = w.spatial + w.temporal + w.spectral + w.behavioral + w.semantic;
        assert!((sum - 1.0).abs() < 1e-10);
    }

    #[test]
    fn predicate_weights_serde_roundtrip() {
        let w = PredicateWeights {
            spatial: 0.4,
            temporal: 0.3,
            spectral: 0.15,
            behavioral: 0.1,
            semantic: 0.05,
        };
        let json = serde_json::to_string(&w).unwrap();
        let parsed: PredicateWeights = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, w);
    }

    #[test]
    fn predicate_weights_json_camel_case() {
        let json = serde_json::to_string(&PredicateWeights::default()).unwrap();
        assert!(json.contains("\"spatial\""));
        assert!(json.contains("\"temporal\""));
        assert!(json.contains("\"behavioral\""));
    }

    // -- CorrelationMatrix --

    #[test]
    fn correlation_matrix_default_is_symmetric() {
        let m = CorrelationMatrix::default();
        for i in 0..5 {
            for j in 0..5 {
                assert!(
                    (m.entries[i][j] - m.entries[j][i]).abs() < 1e-10,
                    "Matrix not symmetric at [{i}][{j}]"
                );
            }
        }
    }

    #[test]
    fn correlation_matrix_diagonal_is_one() {
        let m = CorrelationMatrix::default();
        for i in 0..5 {
            assert!((m.entries[i][i] - 1.0).abs() < 1e-10);
        }
    }

    #[test]
    fn correlation_matrix_serde_roundtrip() {
        let m = CorrelationMatrix::default();
        let json = serde_json::to_string(&m).unwrap();
        let parsed: CorrelationMatrix = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, m);
    }

    // -- SpoofingDiscount --

    #[test]
    fn spoofing_discount_serde_roundtrip() {
        let sd = SpoofingDiscount {
            enabled: false,
            max_discount: 0.3,
        };
        let json = serde_json::to_string(&sd).unwrap();
        let parsed: SpoofingDiscount = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, sd);
    }

    #[test]
    fn spoofing_discount_default_enabled() {
        let sd = SpoofingDiscount::default();
        assert!(sd.enabled);
    }

    // -- ConfidenceClamp --

    #[test]
    fn confidence_clamp_serde_roundtrip() {
        let clamp = ConfidenceClamp {
            min: 0.05,
            max: 0.95,
        };
        let json = serde_json::to_string(&clamp).unwrap();
        let parsed: ConfidenceClamp = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, clamp);
    }

    #[test]
    fn confidence_clamp_default_range() {
        let c = ConfidenceClamp::default();
        assert!((c.min - 0.01).abs() < 1e-10);
        assert!((c.max - 0.99).abs() < 1e-10);
    }

    // -- DsCombinationRule --

    #[test]
    fn ds_combination_rule_serde_roundtrip() {
        let variants = [
            DsCombinationRule::Standard,
            DsCombinationRule::Yager,
            DsCombinationRule::Tbm,
            DsCombinationRule::Pcr5,
        ];
        for rule in variants {
            let json = serde_json::to_string(&rule).unwrap();
            let parsed: DsCombinationRule = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, rule);
        }
    }

    #[test]
    fn pcr5_json_shape() {
        let json = serde_json::to_string(&DsCombinationRule::Pcr5).unwrap();
        assert_eq!(json, "\"pcr5\"");
    }

    // -- DempsterShaferConfig --

    #[test]
    fn dempster_shafer_config_serde_roundtrip() {
        let cfg = DempsterShaferConfig {
            conflict_threshold: 0.85,
            combination_rule: DsCombinationRule::Yager,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let parsed: DempsterShaferConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn dempster_shafer_config_json_shape() {
        let cfg = DempsterShaferConfig::default();
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("\"conflictThreshold\""));
        assert!(json.contains("\"combinationRule\""));
    }

    // -- BasicProbabilityAssignment --

    #[test]
    fn bpa_vacuous_has_full_mass_on_theta() {
        let bpa = BasicProbabilityAssignment::vacuous(3);
        assert_eq!(bpa.frame_size, 3);
        assert_eq!(bpa.focal_elements.len(), 1);
        assert_eq!(bpa.focal_elements[0].hypothesis_set, 0b111);
        assert!((bpa.focal_elements[0].mass - 1.0).abs() < 1e-10);
    }

    #[test]
    fn bpa_total_mass() {
        let bpa = BasicProbabilityAssignment {
            frame_size: 3,
            focal_elements: vec![
                FocalElement { hypothesis_set: 0b001, mass: 0.6 },
                FocalElement { hypothesis_set: 0b010, mass: 0.3 },
                FocalElement { hypothesis_set: 0b111, mass: 0.1 },
            ],
        };
        assert!((bpa.total_mass() - 1.0).abs() < 1e-10);
    }

    #[test]
    fn bpa_belief_and_plausibility() {
        // Frame: {H0, H1, H2}. Masses: m({H0})=0.4, m({H0,H1})=0.3, m(Θ)=0.3.
        let bpa = BasicProbabilityAssignment {
            frame_size: 3,
            focal_elements: vec![
                FocalElement { hypothesis_set: 0b001, mass: 0.4 },
                FocalElement { hypothesis_set: 0b011, mass: 0.3 },
                FocalElement { hypothesis_set: 0b111, mass: 0.3 },
            ],
        };
        // Bel({H0}) = m({H0}) = 0.4 (only {H0} ⊆ {H0})
        assert!((bpa.belief(0b001) - 0.4).abs() < 1e-10);
        // Bel({H0,H1}) = m({H0}) + m({H0,H1}) = 0.7
        assert!((bpa.belief(0b011) - 0.7).abs() < 1e-10);
        // Pl({H0}) = m({H0}) + m({H0,H1}) + m(Θ) = 1.0
        assert!((bpa.plausibility(0b001) - 1.0).abs() < 1e-10);
        // Pl({H2}) = m(Θ) = 0.3 (only Θ intersects {H2})
        assert!((bpa.plausibility(0b100) - 0.3).abs() < 1e-10);
    }

    #[test]
    fn bpa_pignistic_transform() {
        // Frame: {H0, H1}. Masses: m({H0})=0.6, m(Θ)=0.4.
        let bpa = BasicProbabilityAssignment {
            frame_size: 2,
            focal_elements: vec![
                FocalElement { hypothesis_set: 0b01, mass: 0.6 },
                FocalElement { hypothesis_set: 0b11, mass: 0.4 },
            ],
        };
        let betp = bpa.pignistic_transform();
        // BetP(H0) = 0.6/1 + 0.4/2 = 0.8
        assert!((betp[0].1 - 0.8).abs() < 1e-10);
        // BetP(H1) = 0.4/2 = 0.2
        assert!((betp[1].1 - 0.2).abs() < 1e-10);
        // Sum = 1.0
        let sum: f64 = betp.iter().map(|(_, p)| p).sum();
        assert!((sum - 1.0).abs() < 1e-10);
    }

    #[test]
    fn bpa_prune_removes_tiny_mass() {
        let mut bpa = BasicProbabilityAssignment {
            frame_size: 3,
            focal_elements: vec![
                FocalElement { hypothesis_set: 0b001, mass: 0.7 },
                FocalElement { hypothesis_set: 0b010, mass: 0.0005 },
                FocalElement { hypothesis_set: 0b111, mass: 0.2995 },
            ],
        };
        bpa.prune(1e-3);
        assert_eq!(bpa.focal_elements.len(), 2);
        // Total mass should still be ~1.0 after redistribution.
        assert!((bpa.total_mass() - 1.0).abs() < 1e-10);
    }

    #[test]
    fn bpa_serde_roundtrip() {
        let bpa = BasicProbabilityAssignment {
            frame_size: 3,
            focal_elements: vec![
                FocalElement { hypothesis_set: 0b001, mass: 0.6 },
                FocalElement { hypothesis_set: 0b111, mass: 0.4 },
            ],
        };
        let json = serde_json::to_string(&bpa).unwrap();
        assert!(json.contains("\"frameSize\""));
        assert!(json.contains("\"focalElements\""));
        assert!(json.contains("\"hypothesisSet\""));
        let parsed: BasicProbabilityAssignment = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, bpa);
    }

    // -- BpaConfig --

    #[test]
    fn bpa_config_default() {
        let cfg = BpaConfig::default();
        assert!((cfg.epsilon - 1e-3).abs() < 1e-10);
        assert_eq!(cfg.max_additivity, Some(2));
    }

    #[test]
    fn bpa_config_serde_roundtrip() {
        let cfg = BpaConfig {
            epsilon: 1e-4,
            max_additivity: None,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(!json.contains("\"maxAdditivity\""));
        let parsed: BpaConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }
}
