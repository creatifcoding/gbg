//! Confidence calibration types for multi-source data fusion.
//!
//! Four-phase calibration framework: Warmup -> Active -> Degraded -> Failed.
//! Operators validate fusions, the system bins predictions against actual
//! outcomes, and recalibration corrects drift.
//!
//! Source: TSGC-001-v2 Section 18 (R4.5 calibration framework).

use serde::{Deserialize, Serialize};
use typeshare::typeshare;

// ---------------------------------------------------------------------------
// CalibrationPhase — lifecycle state of the calibration system
// ---------------------------------------------------------------------------

/// Lifecycle phase of the calibration system for a given signal pair.
///
/// - `Warmup`: Collecting initial verdicts (< warmup_samples).
/// - `Active`: Sufficient data; calibration curve is being computed.
/// - `Degraded`: Calibration drift detected beyond drift_threshold.
/// - `Failed`: Drift exceeded fail_threshold; scores are unreliable.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CalibrationPhase {
    Warmup,
    Active,
    Degraded,
    Failed,
}

// ---------------------------------------------------------------------------
// CalibrationVerdict — operator assessment of a fusion result
// ---------------------------------------------------------------------------

/// Operator verdict on a fusion result's calibration quality.
///
/// - `Calibrated`: Predicted confidence aligns with observed accuracy.
/// - `Drifting`: Moderate divergence detected.
/// - `Uncalibrated`: Large divergence; recalibration required.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CalibrationVerdict {
    Calibrated,
    Drifting,
    Uncalibrated,
}

// ---------------------------------------------------------------------------
// CalibrationBin — one decile of the calibration curve
// ---------------------------------------------------------------------------

/// A single bin in the calibration histogram.
///
/// `predicted` is the mean confidence for fusions in this bin.
/// `observed` is the fraction of those fusions that were correct.
/// `count` is the number of verdicts in this bin.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationBin {
    pub predicted: f64,
    pub observed: f64,
    pub count: u64,
}

// ---------------------------------------------------------------------------
// CalibrationSnapshot — point-in-time calibration state
// ---------------------------------------------------------------------------

/// Snapshot of calibration state published to
/// `tsingou.meta.calibration.{pair}.{timestamp}`.
///
/// Contains the full histogram, the expected calibration error (ECE),
/// the current phase, and the snapshot timestamp.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationSnapshot {
    pub bins: Vec<CalibrationBin>,
    pub ece: f64,
    pub phase: CalibrationPhase,
    pub timestamp_ms: u64,
}

// ---------------------------------------------------------------------------
// CalibrationConfig — tuning parameters
// ---------------------------------------------------------------------------

/// Configuration for the confidence calibration framework.
///
/// - `bin_count`: Number of histogram bins (default 10 for deciles).
/// - `warmup_samples`: Verdicts required before leaving Warmup phase.
/// - `drift_threshold`: ECE above which phase transitions to Degraded.
/// - `fail_threshold`: ECE above which phase transitions to Failed.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationConfig {
    pub bin_count: u32,
    pub warmup_samples: u64,
    pub drift_threshold: f64,
    pub fail_threshold: f64,
}

impl Default for CalibrationConfig {
    fn default() -> Self {
        Self {
            bin_count: 10,
            warmup_samples: 500,
            drift_threshold: 0.1,
            fail_threshold: 0.25,
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -- CalibrationPhase --

    #[test]
    fn calibration_phase_serde_roundtrip() {
        let variants = [
            CalibrationPhase::Warmup,
            CalibrationPhase::Active,
            CalibrationPhase::Degraded,
            CalibrationPhase::Failed,
        ];
        for phase in variants {
            let json = serde_json::to_string(&phase).unwrap();
            let parsed: CalibrationPhase = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, phase);
        }
    }

    #[test]
    fn calibration_phase_json_shape() {
        let json = serde_json::to_string(&CalibrationPhase::Warmup).unwrap();
        assert_eq!(json, "\"warmup\"");
        let json = serde_json::to_string(&CalibrationPhase::Active).unwrap();
        assert_eq!(json, "\"active\"");
    }

    // -- CalibrationVerdict --

    #[test]
    fn calibration_verdict_serde_roundtrip() {
        let variants = [
            CalibrationVerdict::Calibrated,
            CalibrationVerdict::Drifting,
            CalibrationVerdict::Uncalibrated,
        ];
        for verdict in variants {
            let json = serde_json::to_string(&verdict).unwrap();
            let parsed: CalibrationVerdict = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, verdict);
        }
    }

    // -- CalibrationBin --

    #[test]
    fn calibration_bin_serde_roundtrip() {
        let bin = CalibrationBin {
            predicted: 0.75,
            observed: 0.72,
            count: 150,
        };
        let json = serde_json::to_string(&bin).unwrap();
        let parsed: CalibrationBin = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, bin);
    }

    #[test]
    fn calibration_bin_json_camel_case() {
        let bin = CalibrationBin {
            predicted: 0.5,
            observed: 0.48,
            count: 100,
        };
        let json = serde_json::to_string(&bin).unwrap();
        assert!(json.contains("\"predicted\""));
        assert!(json.contains("\"observed\""));
        assert!(json.contains("\"count\""));
    }

    // -- CalibrationSnapshot --

    #[test]
    fn calibration_snapshot_serde_roundtrip() {
        let snap = CalibrationSnapshot {
            bins: vec![
                CalibrationBin {
                    predicted: 0.1,
                    observed: 0.08,
                    count: 50,
                },
                CalibrationBin {
                    predicted: 0.5,
                    observed: 0.52,
                    count: 200,
                },
            ],
            ece: 0.03,
            phase: CalibrationPhase::Active,
            timestamp_ms: 1_700_000_000_000,
        };
        let json = serde_json::to_string(&snap).unwrap();
        let parsed: CalibrationSnapshot = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, snap);
    }

    #[test]
    fn calibration_snapshot_empty_bins() {
        let snap = CalibrationSnapshot {
            bins: vec![],
            ece: 0.0,
            phase: CalibrationPhase::Warmup,
            timestamp_ms: 0,
        };
        let json = serde_json::to_string(&snap).unwrap();
        let parsed: CalibrationSnapshot = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, snap);
    }

    // -- CalibrationConfig --

    #[test]
    fn calibration_config_serde_roundtrip() {
        let cfg = CalibrationConfig {
            bin_count: 20,
            warmup_samples: 1000,
            drift_threshold: 0.15,
            fail_threshold: 0.3,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let parsed: CalibrationConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn calibration_config_default_values() {
        let cfg = CalibrationConfig::default();
        assert_eq!(cfg.bin_count, 10);
        assert_eq!(cfg.warmup_samples, 500);
        assert!((cfg.drift_threshold - 0.1).abs() < 1e-10);
        assert!((cfg.fail_threshold - 0.25).abs() < 1e-10);
    }

    #[test]
    fn calibration_config_json_camel_case() {
        let json = serde_json::to_string(&CalibrationConfig::default()).unwrap();
        assert!(json.contains("\"binCount\""));
        assert!(json.contains("\"warmupSamples\""));
        assert!(json.contains("\"driftThreshold\""));
        assert!(json.contains("\"failThreshold\""));
    }
}
