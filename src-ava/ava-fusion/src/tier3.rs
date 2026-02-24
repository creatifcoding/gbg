//! Tier 3 derived-key fusion types.
//!
//! Four specific statistical correlation methods that replace the
//! original TSGC-001 wildcard "PAIR 8: * x *" placeholder.
//! Each method is independently toggleable and configured.
//!
//! Source: TSGC-001-v2 Section 4 (R8.2-R8.5 Tier 3 decomposition).

use serde::{Deserialize, Serialize};
use typeshare::typeshare;

// ---------------------------------------------------------------------------
// Tier3Method — enumeration of statistical correlation methods
// ---------------------------------------------------------------------------

/// The four specific Tier 3 statistical correlation methods.
///
/// - `Periodicity`: Matching periodic cadence (C2 beaconing, schedules).
/// - `CoOccurrence`: Entities reliably appearing together across sources.
/// - `Community`: Graph community detection on entity relationship graph.
/// - `AnomalyCoincidence`: Independent anomalies in overlapping windows.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Tier3Method {
    Periodicity,
    CoOccurrence,
    Community,
    AnomalyCoincidence,
}

// ---------------------------------------------------------------------------
// PeriodicityConfig — Tier 3A configuration
// ---------------------------------------------------------------------------

/// Configuration for Tier 3A: Periodicity Correlation.
///
/// Detects signals with matching periodic cadence via FFT on
/// inter-arrival times and cross-spectral comparison.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeriodicityConfig {
    pub min_period_ms: u64,
    pub max_period_ms: u64,
    pub significance_threshold: f64,
}

impl Default for PeriodicityConfig {
    fn default() -> Self {
        Self {
            min_period_ms: 1_000,
            max_period_ms: 3_600_000,
            significance_threshold: 0.7,
        }
    }
}

// ---------------------------------------------------------------------------
// CoOccurrenceConfig — Tier 3B configuration
// ---------------------------------------------------------------------------

/// Configuration for Tier 3B: Co-Occurrence Mining.
///
/// Detects entities that reliably appear together across independent
/// sources using association rule thresholds (support, confidence, lift).
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoOccurrenceConfig {
    pub window_ms: u64,
    pub min_support: f64,
    pub min_confidence: f64,
}

impl Default for CoOccurrenceConfig {
    fn default() -> Self {
        Self {
            window_ms: 86_400_000, // 24h
            min_support: 0.001,
            min_confidence: 0.3,
        }
    }
}

// ---------------------------------------------------------------------------
// CommunityAlgorithm — graph clustering algorithm selector
// ---------------------------------------------------------------------------

/// Algorithm selector for Tier 3C graph community detection.
///
/// - `Louvain`: Fast unfolding of communities, O(n log n).
/// - `LabelPropagation`: Near-linear time, less stable.
/// - `Infomap`: Information-theoretic, good for overlapping communities.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CommunityAlgorithm {
    Louvain,
    LabelPropagation,
    Infomap,
}

impl Default for CommunityAlgorithm {
    fn default() -> Self {
        Self::Louvain
    }
}

// ---------------------------------------------------------------------------
// CommunityConfig — Tier 3C configuration
// ---------------------------------------------------------------------------

/// Configuration for Tier 3C: Graph Community Detection.
///
/// Detects clusters of entities more densely connected to each other
/// than to the rest of the entity relationship graph.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityConfig {
    pub algorithm: CommunityAlgorithm,
    pub resolution: f64,
    pub min_community_size: u32,
}

impl Default for CommunityConfig {
    fn default() -> Self {
        Self {
            algorithm: CommunityAlgorithm::default(),
            resolution: 1.0,
            min_community_size: 3,
        }
    }
}

// ---------------------------------------------------------------------------
// AnomalyCoincidenceConfig — Tier 3D configuration
// ---------------------------------------------------------------------------

/// Configuration for Tier 3D: Anomaly Coincidence Detection.
///
/// Detects independent signals flagging anomalies in overlapping
/// time windows. Uses z-score for baseline deviation.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnomalyCoincidenceConfig {
    pub baseline_window_ms: u64,
    pub sigma_threshold: f64,
}

impl Default for AnomalyCoincidenceConfig {
    fn default() -> Self {
        Self {
            baseline_window_ms: 86_400_000, // 24h
            sigma_threshold: 3.0,
        }
    }
}

// ---------------------------------------------------------------------------
// Tier3ConfigUnion — tagged union of method-specific configs
// ---------------------------------------------------------------------------

/// Tagged union carrying the configuration for whichever Tier 3 method
/// is active on a given join path.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "method", content = "config")]
pub enum Tier3ConfigUnion {
    Periodicity(PeriodicityConfig),
    CoOccurrence(CoOccurrenceConfig),
    Community(CommunityConfig),
    AnomalyCoincidence(AnomalyCoincidenceConfig),
}

// ---------------------------------------------------------------------------
// Tier3Promotion — promotion of derived findings to higher tiers
// ---------------------------------------------------------------------------

/// Records the promotion of a Tier 3 finding to a higher fusion tier.
///
/// - `source_tier`: Original tier (always 3).
/// - `target_tier`: Promotion target (usually 2).
/// - `confidence_boost`: Additive confidence bonus from the promotion.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tier3Promotion {
    pub source_tier: u8,
    pub target_tier: u8,
    pub confidence_boost: f64,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -- Tier3Method --

    #[test]
    fn tier3_method_serde_roundtrip() {
        let variants = [
            Tier3Method::Periodicity,
            Tier3Method::CoOccurrence,
            Tier3Method::Community,
            Tier3Method::AnomalyCoincidence,
        ];
        for method in variants {
            let json = serde_json::to_string(&method).unwrap();
            let parsed: Tier3Method = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, method);
        }
    }

    #[test]
    fn tier3_method_json_shape() {
        let json = serde_json::to_string(&Tier3Method::AnomalyCoincidence).unwrap();
        assert_eq!(json, "\"anomalyCoincidence\"");
        let json = serde_json::to_string(&Tier3Method::CoOccurrence).unwrap();
        assert_eq!(json, "\"coOccurrence\"");
    }

    // -- PeriodicityConfig --

    #[test]
    fn periodicity_config_serde_roundtrip() {
        let cfg = PeriodicityConfig {
            min_period_ms: 500,
            max_period_ms: 600_000,
            significance_threshold: 0.8,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let parsed: PeriodicityConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn periodicity_config_json_camel_case() {
        let json = serde_json::to_string(&PeriodicityConfig::default()).unwrap();
        assert!(json.contains("\"minPeriodMs\""));
        assert!(json.contains("\"maxPeriodMs\""));
        assert!(json.contains("\"significanceThreshold\""));
    }

    // -- CoOccurrenceConfig --

    #[test]
    fn co_occurrence_config_serde_roundtrip() {
        let cfg = CoOccurrenceConfig {
            window_ms: 43_200_000,
            min_support: 0.01,
            min_confidence: 0.5,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let parsed: CoOccurrenceConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn co_occurrence_config_json_camel_case() {
        let json = serde_json::to_string(&CoOccurrenceConfig::default()).unwrap();
        assert!(json.contains("\"windowMs\""));
        assert!(json.contains("\"minSupport\""));
        assert!(json.contains("\"minConfidence\""));
    }

    // -- CommunityAlgorithm --

    #[test]
    fn community_algorithm_serde_roundtrip() {
        let variants = [
            CommunityAlgorithm::Louvain,
            CommunityAlgorithm::LabelPropagation,
            CommunityAlgorithm::Infomap,
        ];
        for algo in variants {
            let json = serde_json::to_string(&algo).unwrap();
            let parsed: CommunityAlgorithm = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, algo);
        }
    }

    #[test]
    fn community_algorithm_json_shape() {
        let json = serde_json::to_string(&CommunityAlgorithm::LabelPropagation).unwrap();
        assert_eq!(json, "\"labelPropagation\"");
    }

    // -- CommunityConfig --

    #[test]
    fn community_config_serde_roundtrip() {
        let cfg = CommunityConfig {
            algorithm: CommunityAlgorithm::Infomap,
            resolution: 1.5,
            min_community_size: 5,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let parsed: CommunityConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn community_config_default() {
        let cfg = CommunityConfig::default();
        assert_eq!(cfg.algorithm, CommunityAlgorithm::Louvain);
        assert!((cfg.resolution - 1.0).abs() < 1e-10);
        assert_eq!(cfg.min_community_size, 3);
    }

    // -- AnomalyCoincidenceConfig --

    #[test]
    fn anomaly_coincidence_config_serde_roundtrip() {
        let cfg = AnomalyCoincidenceConfig {
            baseline_window_ms: 7_200_000,
            sigma_threshold: 2.5,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let parsed: AnomalyCoincidenceConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn anomaly_coincidence_config_json_camel_case() {
        let json = serde_json::to_string(&AnomalyCoincidenceConfig::default()).unwrap();
        assert!(json.contains("\"baselineWindowMs\""));
        assert!(json.contains("\"sigmaThreshold\""));
    }

    // -- Tier3ConfigUnion --

    #[test]
    fn tier3_config_union_periodicity_serde_roundtrip() {
        let cfg = Tier3ConfigUnion::Periodicity(PeriodicityConfig::default());
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("\"method\":\"periodicity\""));
        let parsed: Tier3ConfigUnion = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn tier3_config_union_co_occurrence_serde_roundtrip() {
        let cfg = Tier3ConfigUnion::CoOccurrence(CoOccurrenceConfig::default());
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("\"method\":\"coOccurrence\""));
        let parsed: Tier3ConfigUnion = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn tier3_config_union_community_serde_roundtrip() {
        let cfg = Tier3ConfigUnion::Community(CommunityConfig::default());
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("\"method\":\"community\""));
        let parsed: Tier3ConfigUnion = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn tier3_config_union_anomaly_serde_roundtrip() {
        let cfg = Tier3ConfigUnion::AnomalyCoincidence(AnomalyCoincidenceConfig::default());
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("\"method\":\"anomalyCoincidence\""));
        let parsed: Tier3ConfigUnion = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    // -- Tier3Promotion --

    #[test]
    fn tier3_promotion_serde_roundtrip() {
        let promo = Tier3Promotion {
            source_tier: 3,
            target_tier: 2,
            confidence_boost: 0.15,
        };
        let json = serde_json::to_string(&promo).unwrap();
        let parsed: Tier3Promotion = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, promo);
    }

    #[test]
    fn tier3_promotion_json_camel_case() {
        let promo = Tier3Promotion {
            source_tier: 3,
            target_tier: 2,
            confidence_boost: 0.1,
        };
        let json = serde_json::to_string(&promo).unwrap();
        assert!(json.contains("\"sourceTier\""));
        assert!(json.contains("\"targetTier\""));
        assert!(json.contains("\"confidenceBoost\""));
    }
}
