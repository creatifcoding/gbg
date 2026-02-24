//! Risk accumulation types for weak-signal compounding (R3).
//!
//! Defines [`RiskCategory`], [`RiskIndicator`], [`EntityRiskProfile`],
//! and [`RiskAccumulator`] with noisy-OR aggregation and convergence bonus.
//!
//! Source: TSGC-001-v2 Section 10 (R3).

use serde::{Deserialize, Serialize};
use typeshare::typeshare;

// ---------------------------------------------------------------------------
// RiskCategory — indicator category taxonomy
// ---------------------------------------------------------------------------

/// Category of a risk indicator, determining its TTL and weight
/// in the composite risk calculation.
///
/// | Category | Code | Weight | Default TTL |
/// |----------|------|--------|-------------|
/// | Identity | ID   | 0.20   | 24h         |
/// | Kinematic| KIN  | 0.20   | 2h          |
/// | Behavioral| BEH | 0.20   | 8h          |
/// | Association| ASSOC| 0.15  | 4h          |
/// | Signal   | SIG  | 0.15   | 12h         |
/// | Intelligence| INTEL| 0.10 | 72h         |
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RiskCategory {
    /// Identity discrepancies (MMSI mismatch, ICAO anomaly).
    Identity,
    /// Kinematic anomalies (speed inconsistency, position drift).
    Kinematic,
    /// Behavioral anomalies (route deviation, dark period history).
    Behavioral,
    /// Association with flagged entities (proximity to sanctioned vessel).
    Association,
    /// Signal integrity issues (jamming indicators, equipment anomalies).
    Signal,
    /// External intelligence (OSINT, STIX, sanctions list matches).
    Intelligence,
}

impl RiskCategory {
    /// All variants in declaration order.
    pub const ALL: [RiskCategory; 6] = [
        RiskCategory::Identity,
        RiskCategory::Kinematic,
        RiskCategory::Behavioral,
        RiskCategory::Association,
        RiskCategory::Signal,
        RiskCategory::Intelligence,
    ];

    /// Default weight for this category in composite risk calculation.
    pub fn default_weight(&self) -> f64 {
        match self {
            RiskCategory::Identity => 0.20,
            RiskCategory::Kinematic => 0.20,
            RiskCategory::Behavioral => 0.20,
            RiskCategory::Association => 0.15,
            RiskCategory::Signal => 0.15,
            RiskCategory::Intelligence => 0.10,
        }
    }

    /// Default TTL in milliseconds.
    pub fn default_ttl_ms(&self) -> u64 {
        match self {
            RiskCategory::Identity => 86_400_000,   // 24h
            RiskCategory::Kinematic => 7_200_000,    // 2h
            RiskCategory::Behavioral => 28_800_000,  // 8h
            RiskCategory::Association => 14_400_000,  // 4h
            RiskCategory::Signal => 43_200_000,      // 12h
            RiskCategory::Intelligence => 259_200_000, // 72h
        }
    }
}

// ---------------------------------------------------------------------------
// RiskIndicator — a single weak signal
// ---------------------------------------------------------------------------

/// A single risk indicator contributing to an entity's risk profile.
///
/// Indicators are scored 0.0-1.0 and decay exponentially with a
/// category-specific half-life (R3 §10.3).
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskIndicator {
    /// Risk category this indicator belongs to.
    pub category: RiskCategory,
    /// Human-readable indicator name (e.g. "AIS position drift").
    pub name: String,
    /// Current score (0.0-1.0) after temporal decay.
    pub score: f64,
    /// Confidence in this indicator's assessment (0.0-1.0).
    pub confidence: f64,
    /// Source that produced this indicator (e.g. "absence-detector").
    pub source: String,
    /// Timestamp when this indicator was last updated (epoch ms).
    pub timestamp_ms: u64,
}

// ---------------------------------------------------------------------------
// RiskThreshold — classification boundaries
// ---------------------------------------------------------------------------

/// Risk classification thresholds for the composite risk score.
///
/// Default: low=0.2, elevated=0.4, high=0.6, severe=0.8, critical=0.9.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskThreshold {
    pub low: f64,
    pub elevated: f64,
    pub high: f64,
    pub severe: f64,
    pub critical: f64,
}

impl Default for RiskThreshold {
    fn default() -> Self {
        Self {
            low: 0.2,
            elevated: 0.4,
            high: 0.6,
            severe: 0.8,
            critical: 0.9,
        }
    }
}

// ---------------------------------------------------------------------------
// RiskAccumulationMethod — aggregation strategy
// ---------------------------------------------------------------------------

/// Aggregation strategy for combining indicators within a category.
///
/// - `NoisyOr`: Default. Bounded [0,1], commutative, diminishing returns.
/// - `WeightedSum`: Simple additive (may exceed 1.0, clamped).
/// - `Max`: Worst-case indicator dominates.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RiskAccumulationMethod {
    /// 1 - PRODUCT(1 - s_i) per category.
    NoisyOr,
    /// SUM(w_i * s_i), clamped to [0, 1].
    WeightedSum,
    /// max(s_i) across indicators.
    Max,
}

impl Default for RiskAccumulationMethod {
    fn default() -> Self {
        Self::NoisyOr
    }
}

// ---------------------------------------------------------------------------
// RiskAccumulator — stateful accumulator
// ---------------------------------------------------------------------------

/// Accumulator for risk indicators using a configurable aggregation method.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskAccumulator {
    /// All active indicator scores (after decay, before aggregation).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub scores: Vec<f64>,
    /// Aggregation method.
    pub method: RiskAccumulationMethod,
}

// ---------------------------------------------------------------------------
// RiskDecay — exponential decay parameters
// ---------------------------------------------------------------------------

/// Exponential decay configuration for risk indicators.
///
/// After `half_life_ms`, an indicator's score is halved.
/// Below `min_score`, the indicator is evicted.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskDecay {
    /// Half-life in milliseconds.
    pub half_life_ms: u64,
    /// Minimum score before eviction.
    pub min_score: f64,
}

impl Default for RiskDecay {
    fn default() -> Self {
        Self {
            half_life_ms: 3_600_000, // 1 hour
            min_score: 0.01,
        }
    }
}

// ---------------------------------------------------------------------------
// DecayModel — per-category temporal decay model
// ---------------------------------------------------------------------------

/// Per-category temporal decay model for risk indicators.
///
/// Different indicator categories decay at different rates with different
/// shapes. Exponential is the legacy default; Weibull adds shape control;
/// PowerLaw provides fat-tailed persistence for intelligence/association data.
///
/// | Category     | Recommended Model | Parameters                   |
/// |--------------|-------------------|------------------------------|
/// | Identity     | Weibull           | k=1.0, λ=30 min             |
/// | Kinematic    | Weibull           | k=0.7, λ=5 min              |
/// | Behavioral   | Weibull           | k=0.8, λ=15 min             |
/// | Signal       | Weibull           | k=1.5, λ=10 min             |
/// | Association  | PowerLaw          | τ=1 hr, α=0.8               |
/// | Intelligence | PowerLaw          | τ=24 hr, α=0.5              |
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum DecayModel {
    /// s(t) = s₀ · exp(-(t/λ)^k)
    ///
    /// k < 1: fast initial decay, long tail.
    /// k = 1: standard exponential.
    /// k > 1: slow start, abrupt cutoff.
    #[serde(rename_all = "camelCase")]
    Weibull {
        /// Scale parameter in milliseconds.
        lambda_ms: f64,
        /// Shape parameter (k).
        k: f64,
    },
    /// s(t) = s₀ · (1 + t/τ)^(-α)
    ///
    /// Fat-tailed: at t = 10τ, still retains ~9% (for α=1).
    /// Suitable for association and intelligence indicators.
    #[serde(rename_all = "camelCase")]
    PowerLaw {
        /// Scale parameter in milliseconds.
        tau_ms: f64,
        /// Decay exponent (α > 0).
        alpha: f64,
    },
    /// s(t) = s₀ · exp(-ln(2) · t / half_life)
    ///
    /// Legacy exponential decay (backward compatible with `RiskDecay`).
    #[serde(rename_all = "camelCase")]
    Exponential {
        /// Half-life in milliseconds.
        half_life_ms: f64,
    },
    /// s(t) = s₀ for t ≤ grace_ms, then s₀ · exp(-ln(2) · (t - grace_ms) / half_life)
    ///
    /// Step function with grace period before decay begins.
    #[serde(rename_all = "camelCase")]
    StepWithGrace {
        /// Grace period in milliseconds (no decay during this window).
        grace_ms: f64,
        /// Half-life after grace period expires.
        half_life_ms: f64,
    },
}

impl DecayModel {
    /// Compute the decay factor at time `elapsed_ms` since indicator creation.
    ///
    /// Returns a value in [0.0, 1.0] to multiply against the original score.
    pub fn factor(&self, elapsed_ms: f64) -> f64 {
        if elapsed_ms <= 0.0 {
            return 1.0;
        }
        match self {
            DecayModel::Weibull { lambda_ms, k } => {
                (-(elapsed_ms / lambda_ms).powf(*k)).exp()
            }
            DecayModel::PowerLaw { tau_ms, alpha } => {
                (1.0 + elapsed_ms / tau_ms).powf(-alpha)
            }
            DecayModel::Exponential { half_life_ms } => {
                (-(elapsed_ms / half_life_ms) * 2.0f64.ln()).exp()
            }
            DecayModel::StepWithGrace {
                grace_ms,
                half_life_ms,
            } => {
                if elapsed_ms <= *grace_ms {
                    1.0
                } else {
                    let t = elapsed_ms - grace_ms;
                    (-(t / half_life_ms) * 2.0f64.ln()).exp()
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// LeakyNoisyOrConfig — background risk parameter
// ---------------------------------------------------------------------------

/// Configuration for the Leaky NoisyOr risk accumulation model.
///
/// Standard NoisyOr: `P = 1 - Π(1 - sᵢ)`
/// Leaky NoisyOr:    `P = 1 - q₀ · Π(1 - sᵢ)`
///
/// Where `q₀ = 1 - p_leak` represents the probability that NO unmodeled
/// cause triggers the risk. Default q₀ = 0.95 (5% background risk).
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeakyNoisyOrConfig {
    /// Background leak probability (0.0-1.0). Default: 0.05.
    /// The probability that an unmodeled cause triggers the risk.
    pub leak: f64,
}

impl Default for LeakyNoisyOrConfig {
    fn default() -> Self {
        Self { leak: 0.05 }
    }
}

impl LeakyNoisyOrConfig {
    /// q₀ = 1 - leak. Used in the NoisyOr formula.
    pub fn q0(&self) -> f64 {
        1.0 - self.leak
    }
}

// ---------------------------------------------------------------------------
// CategoryWeight — operator-tunable per-category weight
// ---------------------------------------------------------------------------

/// Operator-tunable weight for a risk category.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryWeight {
    pub category: RiskCategory,
    pub weight: f64,
}

// ---------------------------------------------------------------------------
// EntityRiskProfile — aggregated risk for one entity
// ---------------------------------------------------------------------------

/// Aggregated risk profile for a single entity (R3 §10.4).
///
/// Contains per-category scores (noisy-OR), active indicators,
/// the composite risk score with convergence bonus, and trend.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityRiskProfile {
    /// Entity this profile belongs to.
    pub entity_id: String,
    /// Active risk indicators contributing to this profile.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub indicators: Vec<RiskIndicator>,
    /// Aggregate composite risk score (0.0-1.0), with convergence bonus.
    pub aggregate_score: f64,
    /// Timestamp of the last indicator update (epoch ms).
    pub last_updated_ms: u64,
    /// Risk trend direction.
    pub trend: RiskTrend,
}

// ---------------------------------------------------------------------------
// RiskTrend — direction indicator
// ---------------------------------------------------------------------------

/// Direction of risk score movement over the recent evaluation window.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RiskTrend {
    Rising,
    Stable,
    Falling,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -- RiskCategory --

    #[test]
    fn risk_category_all_variants_roundtrip() {
        for cat in RiskCategory::ALL {
            let json = serde_json::to_string(&cat).unwrap();
            let parsed: RiskCategory = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, cat);
        }
    }

    #[test]
    fn risk_category_screaming_snake_case() {
        let json = serde_json::to_string(&RiskCategory::Intelligence).unwrap();
        assert_eq!(json, "\"INTELLIGENCE\"");
        let json = serde_json::to_string(&RiskCategory::Kinematic).unwrap();
        assert_eq!(json, "\"KINEMATIC\"");
    }

    #[test]
    fn risk_category_default_weights_sum() {
        let sum: f64 = RiskCategory::ALL.iter().map(|c| c.default_weight()).sum();
        assert!((sum - 1.0).abs() < 1e-10);
    }

    // -- RiskIndicator --

    #[test]
    fn risk_indicator_serde_roundtrip() {
        let indicator = RiskIndicator {
            category: RiskCategory::Signal,
            name: "AIS position drift".into(),
            score: 0.3,
            confidence: 0.85,
            source: "absence-detector".into(),
            timestamp_ms: 1_700_000_000_000,
        };
        let json = serde_json::to_string(&indicator).unwrap();
        assert!(json.contains("\"SIGNAL\""));
        assert!(json.contains("\"score\""));
        let parsed: RiskIndicator = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, indicator);
    }

    // -- RiskThreshold --

    #[test]
    fn risk_threshold_serde_roundtrip() {
        let t = RiskThreshold::default();
        let json = serde_json::to_string(&t).unwrap();
        let parsed: RiskThreshold = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, t);
    }

    #[test]
    fn risk_threshold_default_ordering() {
        let t = RiskThreshold::default();
        assert!(t.low < t.elevated);
        assert!(t.elevated < t.high);
        assert!(t.high < t.severe);
        assert!(t.severe < t.critical);
    }

    // -- RiskAccumulationMethod --

    #[test]
    fn risk_accumulation_method_roundtrip() {
        let variants = [
            RiskAccumulationMethod::NoisyOr,
            RiskAccumulationMethod::WeightedSum,
            RiskAccumulationMethod::Max,
        ];
        for method in variants {
            let json = serde_json::to_string(&method).unwrap();
            let parsed: RiskAccumulationMethod = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, method);
        }
    }

    #[test]
    fn risk_accumulation_method_json_shape() {
        let json = serde_json::to_string(&RiskAccumulationMethod::NoisyOr).unwrap();
        assert_eq!(json, "\"noisyOr\"");
    }

    // -- RiskAccumulator --

    #[test]
    fn risk_accumulator_serde_roundtrip() {
        let acc = RiskAccumulator {
            scores: vec![0.3, 0.5, 0.1],
            method: RiskAccumulationMethod::NoisyOr,
        };
        let json = serde_json::to_string(&acc).unwrap();
        let parsed: RiskAccumulator = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, acc);
    }

    #[test]
    fn risk_accumulator_empty_scores_omitted() {
        let acc = RiskAccumulator {
            scores: vec![],
            method: RiskAccumulationMethod::Max,
        };
        let json = serde_json::to_string(&acc).unwrap();
        assert!(!json.contains("\"scores\""));
    }

    // -- RiskDecay --

    #[test]
    fn risk_decay_serde_roundtrip() {
        let decay = RiskDecay {
            half_life_ms: 7_200_000,
            min_score: 0.05,
        };
        let json = serde_json::to_string(&decay).unwrap();
        assert!(json.contains("\"halfLifeMs\""));
        let parsed: RiskDecay = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, decay);
    }

    // -- CategoryWeight --

    #[test]
    fn category_weight_serde_roundtrip() {
        let cw = CategoryWeight {
            category: RiskCategory::Association,
            weight: 0.25,
        };
        let json = serde_json::to_string(&cw).unwrap();
        assert!(json.contains("\"ASSOCIATION\""));
        let parsed: CategoryWeight = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cw);
    }

    // -- EntityRiskProfile --

    #[test]
    fn entity_risk_profile_serde_roundtrip() {
        let profile = EntityRiskProfile {
            entity_id: "vessel-211900000".into(),
            indicators: vec![RiskIndicator {
                category: RiskCategory::Behavioral,
                name: "route deviation".into(),
                score: 0.35,
                confidence: 0.7,
                source: "behavioral-analysis".into(),
                timestamp_ms: 1_700_000_000_000,
            }],
            aggregate_score: 0.42,
            last_updated_ms: 1_700_000_000_000,
            trend: RiskTrend::Rising,
        };
        let json = serde_json::to_string(&profile).unwrap();
        assert!(json.contains("\"entityId\""));
        assert!(json.contains("\"aggregateScore\""));
        assert!(json.contains("\"rising\""));
        let parsed: EntityRiskProfile = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.entity_id, profile.entity_id);
        assert_eq!(parsed.aggregate_score, 0.42);
    }

    #[test]
    fn entity_risk_profile_empty_indicators() {
        let profile = EntityRiskProfile {
            entity_id: "host-10-0-0-1".into(),
            indicators: vec![],
            aggregate_score: 0.0,
            last_updated_ms: 0,
            trend: RiskTrend::Stable,
        };
        let json = serde_json::to_string(&profile).unwrap();
        assert!(!json.contains("\"indicators\""));
    }

    // -- RiskTrend --

    #[test]
    fn risk_trend_all_variants_roundtrip() {
        for trend in [RiskTrend::Rising, RiskTrend::Stable, RiskTrend::Falling] {
            let json = serde_json::to_string(&trend).unwrap();
            let parsed: RiskTrend = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, trend);
        }
    }

    // -- DecayModel --

    #[test]
    fn decay_model_weibull_at_zero() {
        let model = DecayModel::Weibull {
            lambda_ms: 30_000.0,
            k: 1.0,
        };
        assert!((model.factor(0.0) - 1.0).abs() < 1e-10);
    }

    #[test]
    fn decay_model_weibull_k1_is_exponential() {
        let weibull = DecayModel::Weibull {
            lambda_ms: 1000.0,
            k: 1.0,
        };
        // At t = lambda, Weibull with k=1 gives exp(-1) ≈ 0.368
        let factor = weibull.factor(1000.0);
        assert!((factor - (-1.0f64).exp()).abs() < 1e-10);
    }

    #[test]
    fn decay_model_power_law_fat_tail() {
        let model = DecayModel::PowerLaw {
            tau_ms: 3_600_000.0, // 1 hour
            alpha: 1.0,
        };
        // At t = 10τ: (1 + 10)^(-1) ≈ 0.0909
        let factor = model.factor(36_000_000.0);
        assert!((factor - 1.0 / 11.0).abs() < 1e-6);
    }

    #[test]
    fn decay_model_exponential_half_life() {
        let model = DecayModel::Exponential {
            half_life_ms: 60_000.0,
        };
        // At t = half_life, factor should be 0.5.
        let factor = model.factor(60_000.0);
        assert!((factor - 0.5).abs() < 1e-10);
    }

    #[test]
    fn decay_model_step_with_grace() {
        let model = DecayModel::StepWithGrace {
            grace_ms: 10_000.0,
            half_life_ms: 60_000.0,
        };
        // During grace period: factor = 1.0.
        assert!((model.factor(5_000.0) - 1.0).abs() < 1e-10);
        // At grace boundary: factor = 1.0.
        assert!((model.factor(10_000.0) - 1.0).abs() < 1e-10);
        // At grace + half_life: factor = 0.5.
        assert!((model.factor(70_000.0) - 0.5).abs() < 1e-10);
    }

    #[test]
    fn decay_model_serde_roundtrip() {
        let models = [
            DecayModel::Weibull {
                lambda_ms: 30000.0,
                k: 0.7,
            },
            DecayModel::PowerLaw {
                tau_ms: 3600000.0,
                alpha: 0.8,
            },
            DecayModel::Exponential {
                half_life_ms: 60000.0,
            },
            DecayModel::StepWithGrace {
                grace_ms: 5000.0,
                half_life_ms: 30000.0,
            },
        ];
        for model in &models {
            let json = serde_json::to_string(model).unwrap();
            let parsed: DecayModel = serde_json::from_str(&json).unwrap();
            assert_eq!(&parsed, model);
        }
    }

    #[test]
    fn decay_model_tagged_json() {
        let model = DecayModel::Weibull {
            lambda_ms: 30000.0,
            k: 0.7,
        };
        let json = serde_json::to_string(&model).unwrap();
        assert!(json.contains("\"type\":\"weibull\""));
        assert!(json.contains("\"lambdaMs\""));
    }

    // -- LeakyNoisyOrConfig --

    #[test]
    fn leaky_noisy_or_default() {
        let cfg = LeakyNoisyOrConfig::default();
        assert!((cfg.leak - 0.05).abs() < 1e-10);
        assert!((cfg.q0() - 0.95).abs() < 1e-10);
    }

    #[test]
    fn leaky_noisy_or_serde_roundtrip() {
        let cfg = LeakyNoisyOrConfig { leak: 0.10 };
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("\"leak\""));
        let parsed: LeakyNoisyOrConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn leaky_noisy_or_q0() {
        let cfg = LeakyNoisyOrConfig { leak: 0.0 };
        assert!((cfg.q0() - 1.0).abs() < 1e-10);
        let cfg = LeakyNoisyOrConfig { leak: 1.0 };
        assert!((cfg.q0() - 0.0).abs() < 1e-10);
    }
}
