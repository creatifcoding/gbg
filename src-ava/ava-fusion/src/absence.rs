//! Absence detection types for negative-space fusion (R2).
//!
//! Defines the Expected Signal Registry (ESR), absence event classification,
//! dead reckoning configuration, and absence confidence models.
//!
//! Source: TSGC-001-v2 Section 9 (R2), ESR table.

use serde::{Deserialize, Serialize};
use typeshare::typeshare;

use crate::GeoPoint;

// ---------------------------------------------------------------------------
// AbsenceClassification — what kind of absence is this?
// ---------------------------------------------------------------------------

/// Classification of an absence event by its probable cause.
///
/// Determined by the decision tree in TSGC-001-v2 §9.4:
/// sensor coverage -> multi-signal check -> onset pattern -> behavioral cues.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AbsenceClassification {
    /// Expected signal gap due to sensor coverage limitations.
    ExpectedSignalLoss,
    /// Anomalous gap — entity should be visible but is not.
    AnomalousGap,
    /// Entity has gone silent; position extrapolated via dead reckoning.
    DeadReckoning,
    /// Sensor hardware degradation or malfunction.
    SensorDegradation,
    /// Suspected RF jamming or electronic warfare.
    JammingDetected,
    /// Planned maintenance window — suppress alerting.
    MaintenanceScheduled,
    /// Entity appears to have intentionally stopped transmitting.
    DeliberateDark,
    /// Classification is ambiguous; multiple causes possible.
    Ambiguous,
}

// ---------------------------------------------------------------------------
// AbsenceSeverity — alert escalation level
// ---------------------------------------------------------------------------

/// Severity level for an absence event, driving alert escalation.
///
/// Maps to TSGC-001-v2 §9.2 ESR thresholds: warning -> critical -> dark.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AbsenceSeverity {
    Low,
    Medium,
    High,
    Critical,
}

// ---------------------------------------------------------------------------
// ExpectedSignalEntry — one row in the ESR
// ---------------------------------------------------------------------------

/// A single entry in the Expected Signal Registry (ESR).
///
/// Defines what signals SHOULD be observed for a given entity class
/// and signal kind, plus thresholds for warning/critical/dark transitions.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpectedSignalEntry {
    /// Signal source identifier (e.g. "ais-class-a").
    pub source_id: String,
    /// Expected signal interval in milliseconds (nominal rate).
    pub expected_interval_ms: u64,
    /// Tolerance around the expected interval before flagging absence.
    pub tolerance_ms: u64,
    /// Entity class this entry applies to (e.g. "Vessel", "Aircraft").
    pub entity_class: String,
    /// Signal kind this entry applies to.
    pub signal_kind: String,
}

// ---------------------------------------------------------------------------
// ESRConfig — Expected Signal Registry configuration
// ---------------------------------------------------------------------------

/// Configuration for the Expected Signal Registry (R2 §9.2).
///
/// Contains all expected signal entries and the evaluation window
/// used for absence detection timing.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ESRConfig {
    /// Expected signal entries defining nominal update rates.
    pub entries: Vec<ExpectedSignalEntry>,
    /// Evaluation window size in milliseconds.
    pub evaluation_window_ms: u64,
}

// ---------------------------------------------------------------------------
// AbsenceThresholds — warning/critical/dark timing
// ---------------------------------------------------------------------------

/// Timing thresholds for absence severity escalation.
///
/// When a signal gap exceeds these durations (milliseconds), the
/// absence severity escalates accordingly.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AbsenceThresholds {
    /// Gap duration triggering warning severity (ms).
    pub gap_warning_ms: u64,
    /// Gap duration triggering critical severity (ms).
    pub gap_critical_ms: u64,
    /// Gap duration triggering dark classification (ms).
    pub gap_dark_ms: u64,
}

impl Default for AbsenceThresholds {
    fn default() -> Self {
        Self {
            gap_warning_ms: 300_000,   // 5 minutes
            gap_critical_ms: 1_800_000, // 30 minutes
            gap_dark_ms: 7_200_000,    // 2 hours
        }
    }
}

// ---------------------------------------------------------------------------
// AbsenceConfidence — dual confidence scores
// ---------------------------------------------------------------------------

/// Confidence scores for an absence event.
///
/// `classification_confidence`: how sure we are about the WHY.
/// `detection_confidence`: how sure we are the absence is REAL
/// (not a sensor artefact). Uses P_miss_by_chance model from R2 §9.3.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AbsenceConfidence {
    /// Confidence in the absence classification (0.0-1.0).
    pub classification_confidence: f64,
    /// Confidence that the absence is genuine (0.0-1.0).
    pub detection_confidence: f64,
}

// ---------------------------------------------------------------------------
// DeadReckoningConfig — extrapolation parameters
// ---------------------------------------------------------------------------

/// Configuration for dead reckoning (position extrapolation under absence).
///
/// After the tracking system drops a track (R7 COASTING -> DROPPED),
/// the absence detector uses these parameters for its own projection.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeadReckoningConfig {
    /// Maximum duration for dead reckoning in milliseconds.
    pub max_duration_ms: u64,
    /// Velocity decay factor per second (0.0 = no decay, 1.0 = instant stop).
    pub velocity_decay: f64,
    /// Position uncertainty growth rate in metres per second squared.
    pub position_uncertainty_growth: f64,
}

impl Default for DeadReckoningConfig {
    fn default() -> Self {
        Self {
            max_duration_ms: 43_200_000, // 12 hours
            velocity_decay: 0.0,
            position_uncertainty_growth: 0.5,
        }
    }
}

// ---------------------------------------------------------------------------
// DeadReckoningState — current extrapolation state
// ---------------------------------------------------------------------------

/// Current state of dead reckoning for an absent entity.
///
/// Tracks the last known position, the Kalman-predicted position,
/// elapsed time, and the growing uncertainty radius (R_95).
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeadReckoningState {
    /// Last confirmed position before absence began.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_known_position: Option<GeoPoint>,
    /// Dead-reckoned predicted position.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub predicted_position: Option<GeoPoint>,
    /// Elapsed time since last observation (ms).
    pub elapsed_ms: u64,
    /// 95% confidence uncertainty radius in metres.
    pub uncertainty_radius_m: f64,
}

// ---------------------------------------------------------------------------
// AbsenceContributingEvidence — evidence supporting classification
// ---------------------------------------------------------------------------

/// A piece of evidence contributing to an absence classification.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AbsenceContributingEvidence {
    /// Type of evidence (e.g. "approach_sensitive_area", "course_change").
    pub evidence_type: String,
    /// Human-readable description.
    pub description: String,
    /// Weight contribution to the classification decision (0.0-1.0).
    pub weight: f64,
}

// ---------------------------------------------------------------------------
// AbsenceCoverageReport — sensor coverage assessment
// ---------------------------------------------------------------------------

/// Sensor coverage assessment for an absent entity.
///
/// Tracks which sensors SHOULD observe the entity and whether
/// they have line-of-sight / coverage at the entity's last known position.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AbsenceCoverageReport {
    /// Number of sensors with coverage at the entity's position.
    pub sensors_in_range: u32,
    /// Number of sensors that SHOULD have detected the entity.
    pub sensors_expected: u32,
    /// Whether the entity is in a known coverage gap.
    pub in_coverage_gap: bool,
}

// ---------------------------------------------------------------------------
// AbsenceEvent — the main absence output type
// ---------------------------------------------------------------------------

/// A first-class absence event emitted when an expected signal fails to arrive.
///
/// Theoretical foundation: Koch (2007) — a failed detection attempt in a
/// sensor's field of view is itself useful sensor output.
///
/// Source: TSGC-001-v2 §9.1-§9.6 (R2).
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AbsenceEvent {
    /// Entity that has gone absent.
    pub entity_id: String,
    /// Classification of the absence cause.
    pub classification: AbsenceClassification,
    /// Alert severity level.
    pub severity: AbsenceSeverity,
    /// Absence start time (epoch milliseconds).
    pub start_ms: u64,
    /// Absence end time, if resolved (epoch milliseconds).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_ms: Option<u64>,
    /// Dual confidence scores.
    pub confidence: AbsenceConfidence,
    /// Dead reckoning state (projected position and uncertainty).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dead_reckoning: Option<DeadReckoningState>,
    /// Evidence supporting the classification.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub contributing_evidence: Vec<AbsenceContributingEvidence>,
    /// Sensor coverage report at the time of absence.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coverage: Option<AbsenceCoverageReport>,
    /// Spoofing discount applied to confidence (from R4.1).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spoofing_discount: Option<f64>,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -- AbsenceClassification --

    #[test]
    fn absence_classification_all_variants_roundtrip() {
        let variants = [
            AbsenceClassification::ExpectedSignalLoss,
            AbsenceClassification::AnomalousGap,
            AbsenceClassification::DeadReckoning,
            AbsenceClassification::SensorDegradation,
            AbsenceClassification::JammingDetected,
            AbsenceClassification::MaintenanceScheduled,
            AbsenceClassification::DeliberateDark,
            AbsenceClassification::Ambiguous,
        ];
        for ac in variants {
            let json = serde_json::to_string(&ac).unwrap();
            let parsed: AbsenceClassification = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, ac);
        }
    }

    #[test]
    fn absence_classification_json_shape() {
        let json = serde_json::to_string(&AbsenceClassification::DeliberateDark).unwrap();
        assert_eq!(json, "\"deliberateDark\"");
    }

    // -- AbsenceSeverity --

    #[test]
    fn absence_severity_all_variants_roundtrip() {
        let variants = [
            AbsenceSeverity::Low,
            AbsenceSeverity::Medium,
            AbsenceSeverity::High,
            AbsenceSeverity::Critical,
        ];
        for sev in variants {
            let json = serde_json::to_string(&sev).unwrap();
            let parsed: AbsenceSeverity = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, sev);
        }
    }

    #[test]
    fn absence_severity_ordering() {
        assert!(AbsenceSeverity::Low < AbsenceSeverity::Medium);
        assert!(AbsenceSeverity::Medium < AbsenceSeverity::High);
        assert!(AbsenceSeverity::High < AbsenceSeverity::Critical);
    }

    // -- ExpectedSignalEntry --

    #[test]
    fn expected_signal_entry_serde_roundtrip() {
        let entry = ExpectedSignalEntry {
            source_id: "ais-class-a".into(),
            expected_interval_ms: 10_000,
            tolerance_ms: 5_000,
            entity_class: "Vessel".into(),
            signal_kind: "ais".into(),
        };
        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("\"sourceId\""));
        assert!(json.contains("\"expectedIntervalMs\""));
        let parsed: ExpectedSignalEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, entry);
    }

    // -- ESRConfig --

    #[test]
    fn esr_config_serde_roundtrip() {
        let cfg = ESRConfig {
            entries: vec![ExpectedSignalEntry {
                source_id: "adsb".into(),
                expected_interval_ms: 1_000,
                tolerance_ms: 500,
                entity_class: "Aircraft".into(),
                signal_kind: "adsb".into(),
            }],
            evaluation_window_ms: 60_000,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let parsed: ESRConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.entries.len(), 1);
        assert_eq!(parsed.evaluation_window_ms, 60_000);
    }

    // -- AbsenceThresholds --

    #[test]
    fn absence_thresholds_serde_roundtrip() {
        let t = AbsenceThresholds {
            gap_warning_ms: 60_000,
            gap_critical_ms: 300_000,
            gap_dark_ms: 1_800_000,
        };
        let json = serde_json::to_string(&t).unwrap();
        assert!(json.contains("\"gapWarningMs\""));
        assert!(json.contains("\"gapCriticalMs\""));
        assert!(json.contains("\"gapDarkMs\""));
        let parsed: AbsenceThresholds = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, t);
    }

    #[test]
    fn absence_thresholds_default() {
        let t = AbsenceThresholds::default();
        assert_eq!(t.gap_warning_ms, 300_000);
        assert_eq!(t.gap_critical_ms, 1_800_000);
        assert_eq!(t.gap_dark_ms, 7_200_000);
    }

    // -- AbsenceConfidence --

    #[test]
    fn absence_confidence_serde_roundtrip() {
        let c = AbsenceConfidence {
            classification_confidence: 0.85,
            detection_confidence: 0.99,
        };
        let json = serde_json::to_string(&c).unwrap();
        let parsed: AbsenceConfidence = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, c);
    }

    // -- DeadReckoningConfig --

    #[test]
    fn dead_reckoning_config_serde_roundtrip() {
        let cfg = DeadReckoningConfig {
            max_duration_ms: 7_200_000,
            velocity_decay: 0.01,
            position_uncertainty_growth: 1.0,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("\"maxDurationMs\""));
        assert!(json.contains("\"velocityDecay\""));
        let parsed: DeadReckoningConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn dead_reckoning_config_default() {
        let cfg = DeadReckoningConfig::default();
        assert_eq!(cfg.max_duration_ms, 43_200_000);
    }

    // -- DeadReckoningState --

    #[test]
    fn dead_reckoning_state_serde_roundtrip() {
        let state = DeadReckoningState {
            last_known_position: Some(GeoPoint::new(33.748, -84.388)),
            predicted_position: Some(GeoPoint::new(33.750, -84.390)),
            elapsed_ms: 300_000,
            uncertainty_radius_m: 2_000.0,
        };
        let json = serde_json::to_string(&state).unwrap();
        let parsed: DeadReckoningState = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.elapsed_ms, 300_000);
    }

    #[test]
    fn dead_reckoning_state_null_positions() {
        let state = DeadReckoningState {
            last_known_position: None,
            predicted_position: None,
            elapsed_ms: 0,
            uncertainty_radius_m: 0.0,
        };
        let json = serde_json::to_string(&state).unwrap();
        assert!(!json.contains("lastKnownPosition"));
        assert!(!json.contains("predictedPosition"));
    }

    // -- AbsenceEvent --

    #[test]
    fn absence_event_serde_roundtrip() {
        let event = AbsenceEvent {
            entity_id: "vessel-211900000".into(),
            classification: AbsenceClassification::DeliberateDark,
            severity: AbsenceSeverity::Critical,
            start_ms: 1_700_000_000_000,
            end_ms: None,
            confidence: AbsenceConfidence {
                classification_confidence: 0.75,
                detection_confidence: 0.999,
            },
            dead_reckoning: Some(DeadReckoningState {
                last_known_position: Some(GeoPoint::new(51.5, -0.1)),
                predicted_position: Some(GeoPoint::new(51.52, -0.08)),
                elapsed_ms: 1_800_000,
                uncertainty_radius_m: 5_000.0,
            }),
            contributing_evidence: vec![AbsenceContributingEvidence {
                evidence_type: "approach_sensitive_area".into(),
                description: "Entity approaching restricted zone".into(),
                weight: 0.3,
            }],
            coverage: Some(AbsenceCoverageReport {
                sensors_in_range: 3,
                sensors_expected: 3,
                in_coverage_gap: false,
            }),
            spoofing_discount: Some(0.9),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"entityId\""));
        assert!(json.contains("\"classification\""));
        assert!(json.contains("\"deliberateDark\""));
        assert!(json.contains("\"contributingEvidence\""));
        let parsed: AbsenceEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.entity_id, event.entity_id);
        assert_eq!(parsed.classification, AbsenceClassification::DeliberateDark);
        assert_eq!(parsed.severity, AbsenceSeverity::Critical);
    }

    #[test]
    fn absence_event_minimal() {
        let event = AbsenceEvent {
            entity_id: "host-192-168-1-1".into(),
            classification: AbsenceClassification::AnomalousGap,
            severity: AbsenceSeverity::Low,
            start_ms: 1_700_000_000_000,
            end_ms: Some(1_700_000_060_000),
            confidence: AbsenceConfidence {
                classification_confidence: 0.5,
                detection_confidence: 0.8,
            },
            dead_reckoning: None,
            contributing_evidence: vec![],
            coverage: None,
            spoofing_discount: None,
        };
        let json = serde_json::to_string(&event).unwrap();
        // Optional fields omitted when None/empty
        assert!(!json.contains("\"deadReckoning\""));
        assert!(!json.contains("\"contributingEvidence\""));
        assert!(!json.contains("\"coverage\""));
        assert!(!json.contains("\"spoofingDiscount\""));
        // end_ms present
        assert!(json.contains("\"endMs\""));
        let parsed: AbsenceEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.end_ms, Some(1_700_000_060_000));
    }
}
