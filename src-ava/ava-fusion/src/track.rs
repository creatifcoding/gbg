//! Track lifecycle types for the fusion ontology (R7).
//!
//! Defines [`TrackLifecycleState`] (5 states), [`LifecycleTransition`],
//! [`TrackLifecycleConfig`], [`ConfirmationMethod`], and [`CoastConfig`].
//!
//! The lifecycle state machine governs how fused tracks are created,
//! confirmed, maintained during sensor gaps (coasting), dropped, or
//! merged with other tracks.

use serde::{Deserialize, Serialize};

use crate::ids::TrackId;

// ---------------------------------------------------------------------------
// TrackLifecycleState — 5 states from TSGC-001-v2 §8
// ---------------------------------------------------------------------------

/// Lifecycle state of a fused track.
///
/// ```text
///              +----------+
///  signal ---> | TENTATIVE|
///              +----+-----+
///                   | confirmation
///              +----v-----+         +---------+
///              | CONFIRMED+-------->+ COASTING|
///              +----+-----+ missed  +----+----+
///                   |              recovery |
///              +----v-----+         +----v----+
///              | CONFIRMED+<--------+ COASTING|
///              +----+-----+         +----+----+
///                   |                    |
///              +----v-----+         +----v----+
///              |  MERGED  |         | DROPPED |
///              +----------+         +---------+
/// ```
#[typeshare::typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TrackLifecycleState {
    /// Initial state after first observation. Dimmed/dashed in UI.
    /// Joins participate at reduced confidence (x 0.5).
    Tentative,
    /// Confirmed by M-of-N observations or SPRT score threshold.
    /// Full confidence multiplier (x 1.0).
    Confirmed,
    /// Sensor contact lost; kinematic state is Kalman-predicted only.
    /// Confidence decays per scan. Displayed with amber warning.
    Coasting,
    /// Terminal state: max coast exceeded or score below delete threshold.
    /// Track archived; no further joins.
    Dropped,
    /// Absorbed into another track via Tier 1 hard key, Tier 2 high
    /// confidence (> 0.90), or operator command. Downstream outputs
    /// retracted and re-emitted with surviving track ID.
    Merged,
}

impl TrackLifecycleState {
    /// All lifecycle states in declaration order.
    pub const ALL: [TrackLifecycleState; 5] = [
        TrackLifecycleState::Tentative,
        TrackLifecycleState::Confirmed,
        TrackLifecycleState::Coasting,
        TrackLifecycleState::Dropped,
        TrackLifecycleState::Merged,
    ];

    /// Whether this state allows participation in fusion joins.
    pub fn allows_joins(self) -> bool {
        matches!(
            self,
            TrackLifecycleState::Tentative
                | TrackLifecycleState::Confirmed
                | TrackLifecycleState::Coasting
        )
    }

    /// Whether this state is terminal (no further transitions out).
    pub fn is_terminal(self) -> bool {
        matches!(
            self,
            TrackLifecycleState::Dropped | TrackLifecycleState::Merged
        )
    }

    /// Confidence multiplier applied to fusion scores in this state.
    pub fn confidence_multiplier(self) -> f64 {
        match self {
            TrackLifecycleState::Tentative => 0.5,
            TrackLifecycleState::Confirmed => 1.0,
            TrackLifecycleState::Coasting => 1.0, // decays externally per scan
            TrackLifecycleState::Dropped => 0.0,
            TrackLifecycleState::Merged => 1.0, // inherited from surviving track
        }
    }
}

impl std::fmt::Display for TrackLifecycleState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TrackLifecycleState::Tentative => f.write_str("Tentative"),
            TrackLifecycleState::Confirmed => f.write_str("Confirmed"),
            TrackLifecycleState::Coasting => f.write_str("Coasting"),
            TrackLifecycleState::Dropped => f.write_str("Dropped"),
            TrackLifecycleState::Merged => f.write_str("Merged"),
        }
    }
}

// ---------------------------------------------------------------------------
// Transition reason
// ---------------------------------------------------------------------------

/// Reason for a lifecycle state transition.
///
/// Published as part of [`LifecycleTransition`] events on the NATS
/// subject `tsingou.track.lifecycle.<entity_class>.<track_id>`.
#[typeshare::typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TransitionReason {
    /// First observation created the tentative track.
    Initiated,
    /// M-of-N confirmation criteria met.
    MOfNConfirmed,
    /// Score-based confirmation threshold exceeded.
    ScoreConfirmed,
    /// SPRT log-likelihood ratio exceeded confirm threshold A.
    SprtConfirmed,
    /// Consecutive detection misses exceeded coast entry threshold.
    DetectionMissed,
    /// Re-acquired measurement during coasting.
    DetectionRecovered,
    /// Max coast scans exceeded — track dropped.
    MaxCoastExceeded,
    /// Score dropped below delete threshold — track dropped.
    ScoreBelowThreshold,
    /// Hard/soft key match caused merge into another track.
    MergedInto,
    /// Operator manually triggered the transition.
    OperatorAction,
}

impl std::fmt::Display for TransitionReason {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransitionReason::Initiated => f.write_str("initiated"),
            TransitionReason::MOfNConfirmed => f.write_str("m_of_n_confirmed"),
            TransitionReason::ScoreConfirmed => f.write_str("score_confirmed"),
            TransitionReason::SprtConfirmed => f.write_str("sprt_confirmed"),
            TransitionReason::DetectionMissed => f.write_str("detection_missed"),
            TransitionReason::DetectionRecovered => f.write_str("detection_recovered"),
            TransitionReason::MaxCoastExceeded => f.write_str("max_coast_exceeded"),
            TransitionReason::ScoreBelowThreshold => f.write_str("score_below_threshold"),
            TransitionReason::MergedInto => f.write_str("merged_into"),
            TransitionReason::OperatorAction => f.write_str("operator_action"),
        }
    }
}

// ---------------------------------------------------------------------------
// LifecycleTransition
// ---------------------------------------------------------------------------

/// A lifecycle transition event for a track.
///
/// Published to NATS subject: `tsingou.track.lifecycle.<entity_class>.<track_id>`.
/// Consumed by R2 absence detection (COASTING entry starts absence timer)
/// and R9 sequence patterns (lifecycle_transition signal kind).
#[typeshare::typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifecycleTransition {
    /// Track undergoing the transition.
    pub track_id: TrackId,
    /// State before the transition.
    pub from_state: TrackLifecycleState,
    /// State after the transition.
    pub to_state: TrackLifecycleState,
    /// What triggered the transition.
    pub reason: TransitionReason,
    /// Epoch milliseconds when the transition occurred.
    pub timestamp_ms: f64,
}

// ---------------------------------------------------------------------------
// ConfirmationMethod
// ---------------------------------------------------------------------------

/// Method used to promote a track from TENTATIVE to CONFIRMED.
#[typeshare::typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConfirmationMethod {
    /// M-of-N observation count within a sliding window.
    ObservationCount,
    /// Sequential Probability Ratio Test (SPRT) score threshold.
    ConfidenceThreshold,
    /// Both M-of-N and score must be satisfied.
    Combined,
    /// Wald's Sequential Probability Ratio Test (SPRT).
    ///
    /// Accumulates log-likelihood ratios per observation.
    /// Confirm when LLR > A = ln((1-β)/α).
    /// Reject when LLR < B = ln(β/(1-α)).
    /// Domain-specific α/β values in `SprtConfig`.
    Sprt,
}

impl std::fmt::Display for ConfirmationMethod {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConfirmationMethod::ObservationCount => f.write_str("observationCount"),
            ConfirmationMethod::ConfidenceThreshold => f.write_str("confidenceThreshold"),
            ConfirmationMethod::Combined => f.write_str("combined"),
            ConfirmationMethod::Sprt => f.write_str("sprt"),
        }
    }
}

// ---------------------------------------------------------------------------
// CoastConfig
// ---------------------------------------------------------------------------

/// Configuration for the coasting phase of a track's lifecycle.
///
/// A track is dropped when EITHER `max_duration_s` OR
/// `max_position_uncertainty_m` is exceeded. Coast uncertainty grows
/// as σ²_x(T) ≈ σ²_a · T³/3 (from process noise integration).
///
/// Domain-specific limits:
/// | Domain    | max_duration_s | max_position_uncertainty_m |
/// |-----------|---------------|---------------------------|
/// | Maritime  | 1800          | 5000                      |
/// | Aviation  | 300           | 2000                      |
/// | Ground    | 600           | 1000                      |
#[typeshare::typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoastConfig {
    /// Maximum duration in seconds before a coasting track is dropped.
    pub max_duration_s: f64,
    /// Prediction model used during coasting (e.g. "kalman", "linear").
    pub prediction_model: String,
    /// Maximum allowed position uncertainty (meters) before track is dropped.
    /// When the predicted position covariance exceeds this gate, the track
    /// transitions to Dropped regardless of coast time remaining.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_position_uncertainty_m: Option<f64>,
}

// ---------------------------------------------------------------------------
// SprtConfig — Wald's Sequential Probability Ratio Test
// ---------------------------------------------------------------------------

/// Configuration for SPRT-based track confirmation (Wald 1947).
///
/// The SPRT accumulates log-likelihood ratios per observation:
///   LLR += ln(P(obs | target) / P(obs | false alarm))
///
/// Thresholds derived from desired error rates:
///   A (confirm) = ln((1-β)/α)
///   B (reject)  = ln(β/(1-α))
///
/// Domain-specific defaults:
/// | Domain    | α    | β    | A (confirm) | B (reject) |
/// |-----------|------|------|-------------|------------|
/// | Maritime  | 0.01 | 0.05 | 2.94        | -3.89      |
/// | Aviation  | 0.05 | 0.10 | 2.20        | -2.89      |
/// | Cyber     | 0.10 | 0.10 | 2.20        | -2.20      |
#[typeshare::typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SprtConfig {
    /// Type I error rate (false confirmation probability). Range: (0, 1).
    pub alpha: f64,
    /// Type II error rate (missed target probability). Range: (0, 1).
    pub beta: f64,
}

impl SprtConfig {
    /// Upper threshold A: confirm track when LLR > A.
    pub fn confirm_threshold(&self) -> f64 {
        ((1.0 - self.beta) / self.alpha).ln()
    }

    /// Lower threshold B: reject track when LLR < B.
    pub fn reject_threshold(&self) -> f64 {
        (self.beta / (1.0 - self.alpha)).ln()
    }
}

impl Default for SprtConfig {
    fn default() -> Self {
        Self {
            alpha: 0.01,
            beta: 0.05,
        }
    }
}

// ---------------------------------------------------------------------------
// TrackLifecycleConfig
// ---------------------------------------------------------------------------

/// Per-entity-class configuration for track lifecycle parameters.
///
/// Governs confirmation thresholds, coast entry/exit criteria, and
/// confidence decay rates. Each entity class has its own config
/// (TSGC-001-v2 §8.2 table).
#[typeshare::typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackLifecycleConfig {
    /// Entity class this config applies to.
    pub entity_class: String,
    /// Method for promoting tentative tracks.
    pub confirmation_method: ConfirmationMethod,
    /// Minimum observations required (M in M-of-N). Used when method
    /// is `ObservationCount` or `Combined`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_observations: Option<u32>,
    /// Minimum confidence score threshold. Used when method is
    /// `ConfidenceThreshold` or `Combined`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_confidence: Option<f64>,
    /// Coasting configuration.
    pub coast: CoastConfig,
    /// Confidence decay per missed scan during coasting.
    pub coast_confidence_decay_per_scan: f64,
}

// ---------------------------------------------------------------------------
// Valid transition checks
// ---------------------------------------------------------------------------

/// Returns `true` if the transition from `from` to `to` is structurally
/// valid according to the lifecycle state machine.
pub fn is_valid_transition(from: TrackLifecycleState, to: TrackLifecycleState) -> bool {
    use TrackLifecycleState::*;
    matches!(
        (from, to),
        // Initial creation
        (Tentative, Confirmed)
            // Confirmed loses contact
            | (Confirmed, Coasting)
            // Coasting recovers
            | (Coasting, Confirmed)
            // Coasting times out
            | (Coasting, Dropped)
            // Any non-terminal state can be merged
            | (Tentative, Merged)
            | (Confirmed, Merged)
            | (Coasting, Merged)
            // Tentative can be dropped (e.g. false alarm)
            | (Tentative, Dropped)
    )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------------
    // TrackLifecycleState
    // -----------------------------------------------------------------------

    #[test]
    fn lifecycle_state_all_variants_roundtrip() {
        for state in TrackLifecycleState::ALL {
            let json = serde_json::to_string(&state).unwrap();
            let parsed: TrackLifecycleState = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, state, "roundtrip failed for {state:?}");
        }
    }

    #[test]
    fn lifecycle_state_count() {
        assert_eq!(TrackLifecycleState::ALL.len(), 5);
    }

    #[test]
    fn lifecycle_state_camel_case() {
        let json = serde_json::to_string(&TrackLifecycleState::Tentative).unwrap();
        assert_eq!(json, "\"tentative\"");
        let json = serde_json::to_string(&TrackLifecycleState::Coasting).unwrap();
        assert_eq!(json, "\"coasting\"");
    }

    #[test]
    fn lifecycle_state_allows_joins() {
        assert!(TrackLifecycleState::Tentative.allows_joins());
        assert!(TrackLifecycleState::Confirmed.allows_joins());
        assert!(TrackLifecycleState::Coasting.allows_joins());
        assert!(!TrackLifecycleState::Dropped.allows_joins());
        assert!(!TrackLifecycleState::Merged.allows_joins());
    }

    #[test]
    fn lifecycle_state_is_terminal() {
        assert!(!TrackLifecycleState::Tentative.is_terminal());
        assert!(!TrackLifecycleState::Confirmed.is_terminal());
        assert!(!TrackLifecycleState::Coasting.is_terminal());
        assert!(TrackLifecycleState::Dropped.is_terminal());
        assert!(TrackLifecycleState::Merged.is_terminal());
    }

    #[test]
    fn lifecycle_state_confidence_multiplier() {
        assert_eq!(TrackLifecycleState::Tentative.confidence_multiplier(), 0.5);
        assert_eq!(TrackLifecycleState::Confirmed.confidence_multiplier(), 1.0);
        assert_eq!(TrackLifecycleState::Dropped.confidence_multiplier(), 0.0);
    }

    #[test]
    fn lifecycle_state_copy() {
        let a = TrackLifecycleState::Confirmed;
        let b = a;
        assert_eq!(a, b);
    }

    // -----------------------------------------------------------------------
    // TransitionReason
    // -----------------------------------------------------------------------

    #[test]
    fn transition_reason_roundtrip() {
        let reasons = [
            TransitionReason::Initiated,
            TransitionReason::MOfNConfirmed,
            TransitionReason::ScoreConfirmed,
            TransitionReason::SprtConfirmed,
            TransitionReason::DetectionMissed,
            TransitionReason::DetectionRecovered,
            TransitionReason::MaxCoastExceeded,
            TransitionReason::ScoreBelowThreshold,
            TransitionReason::MergedInto,
            TransitionReason::OperatorAction,
        ];
        for reason in reasons {
            let json = serde_json::to_string(&reason).unwrap();
            let parsed: TransitionReason = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, reason, "roundtrip failed for {reason:?}");
        }
    }

    #[test]
    fn transition_reason_camel_case() {
        let json = serde_json::to_string(&TransitionReason::MOfNConfirmed).unwrap();
        assert_eq!(json, "\"mOfNConfirmed\"");
    }

    // -----------------------------------------------------------------------
    // LifecycleTransition
    // -----------------------------------------------------------------------

    #[test]
    fn lifecycle_transition_serde_roundtrip() {
        let t = LifecycleTransition {
            track_id: TrackId::new("track-001"),
            from_state: TrackLifecycleState::Tentative,
            to_state: TrackLifecycleState::Confirmed,
            reason: TransitionReason::MOfNConfirmed,
            timestamp_ms: 1700000000000.0,
        };
        let json = serde_json::to_string(&t).unwrap();
        assert!(json.contains("\"trackId\":"));
        assert!(json.contains("\"fromState\":"));
        assert!(json.contains("\"toState\":"));
        assert!(json.contains("\"reason\":"));
        assert!(json.contains("\"timestampMs\":"));
        let parsed: LifecycleTransition = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.track_id, t.track_id);
        assert_eq!(parsed.from_state, TrackLifecycleState::Tentative);
        assert_eq!(parsed.to_state, TrackLifecycleState::Confirmed);
        assert_eq!(parsed.reason, TransitionReason::MOfNConfirmed);
    }

    // -----------------------------------------------------------------------
    // ConfirmationMethod
    // -----------------------------------------------------------------------

    #[test]
    fn confirmation_method_roundtrip() {
        let methods = [
            ConfirmationMethod::ObservationCount,
            ConfirmationMethod::ConfidenceThreshold,
            ConfirmationMethod::Combined,
            ConfirmationMethod::Sprt,
        ];
        for m in methods {
            let json = serde_json::to_string(&m).unwrap();
            let parsed: ConfirmationMethod = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, m);
        }
    }

    #[test]
    fn sprt_json_shape() {
        let json = serde_json::to_string(&ConfirmationMethod::Sprt).unwrap();
        assert_eq!(json, "\"sprt\"");
    }

    // -----------------------------------------------------------------------
    // CoastConfig
    // -----------------------------------------------------------------------

    #[test]
    fn coast_config_serde_roundtrip() {
        let cfg = CoastConfig {
            max_duration_s: 300.0,
            prediction_model: "kalman".into(),
            max_position_uncertainty_m: Some(5000.0),
        };
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("\"maxDurationS\":"));
        assert!(json.contains("\"predictionModel\":"));
        assert!(json.contains("\"maxPositionUncertaintyM\":"));
        let parsed: CoastConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.max_duration_s, 300.0);
        assert_eq!(parsed.prediction_model, "kalman");
        assert_eq!(parsed.max_position_uncertainty_m, Some(5000.0));
    }

    #[test]
    fn coast_config_no_uncertainty_omitted() {
        let cfg = CoastConfig {
            max_duration_s: 300.0,
            prediction_model: "kalman".into(),
            max_position_uncertainty_m: None,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(!json.contains("\"maxPositionUncertaintyM\""));
    }

    // -----------------------------------------------------------------------
    // TrackLifecycleConfig
    // -----------------------------------------------------------------------

    #[test]
    fn track_lifecycle_config_serde_roundtrip() {
        let cfg = TrackLifecycleConfig {
            entity_class: "Aircraft".into(),
            confirmation_method: ConfirmationMethod::ObservationCount,
            min_observations: Some(2),
            min_confidence: None,
            coast: CoastConfig {
                max_duration_s: 60.0,
                prediction_model: "kalman".into(),
                max_position_uncertainty_m: None,
            },
            coast_confidence_decay_per_scan: 0.05,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("\"entityClass\":"));
        assert!(json.contains("\"confirmationMethod\":"));
        assert!(json.contains("\"minObservations\":"));
        // minConfidence should be omitted when None
        assert!(!json.contains("\"minConfidence\""));
        assert!(json.contains("\"coast\":"));
        assert!(json.contains("\"coastConfidenceDecayPerScan\":"));
        let parsed: TrackLifecycleConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.entity_class, "Aircraft");
        assert_eq!(
            parsed.confirmation_method,
            ConfirmationMethod::ObservationCount
        );
        assert_eq!(parsed.min_observations, Some(2));
        assert_eq!(parsed.min_confidence, None);
    }

    #[test]
    fn track_lifecycle_config_confidence_threshold_method() {
        let cfg = TrackLifecycleConfig {
            entity_class: "RfEmitter".into(),
            confirmation_method: ConfirmationMethod::ConfidenceThreshold,
            min_observations: None,
            min_confidence: Some(0.8),
            coast: CoastConfig {
                max_duration_s: 180.0,
                prediction_model: "linear".into(),
                max_position_uncertainty_m: Some(2000.0),
            },
            coast_confidence_decay_per_scan: 0.03,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(!json.contains("\"minObservations\""));
        assert!(json.contains("\"minConfidence\":"));
        let parsed: TrackLifecycleConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.min_confidence, Some(0.8));
    }

    // -----------------------------------------------------------------------
    // Valid transitions
    // -----------------------------------------------------------------------

    #[test]
    fn valid_transitions() {
        use TrackLifecycleState::*;
        // Forward path
        assert!(is_valid_transition(Tentative, Confirmed));
        assert!(is_valid_transition(Confirmed, Coasting));
        assert!(is_valid_transition(Coasting, Confirmed));
        assert!(is_valid_transition(Coasting, Dropped));
        // Merge from any non-terminal
        assert!(is_valid_transition(Tentative, Merged));
        assert!(is_valid_transition(Confirmed, Merged));
        assert!(is_valid_transition(Coasting, Merged));
        // Early drop
        assert!(is_valid_transition(Tentative, Dropped));
    }

    #[test]
    fn invalid_transitions() {
        use TrackLifecycleState::*;
        // Terminal states cannot transition out
        assert!(!is_valid_transition(Dropped, Confirmed));
        assert!(!is_valid_transition(Dropped, Tentative));
        assert!(!is_valid_transition(Merged, Confirmed));
        assert!(!is_valid_transition(Merged, Coasting));
        // Cannot go backwards to tentative
        assert!(!is_valid_transition(Confirmed, Tentative));
        assert!(!is_valid_transition(Coasting, Tentative));
        // Self-transitions not modelled
        assert!(!is_valid_transition(Confirmed, Confirmed));
        assert!(!is_valid_transition(Tentative, Tentative));
    }

    // -----------------------------------------------------------------------
    // SprtConfig
    // -----------------------------------------------------------------------

    #[test]
    fn sprt_config_default() {
        let cfg = SprtConfig::default();
        assert!((cfg.alpha - 0.01).abs() < 1e-10);
        assert!((cfg.beta - 0.05).abs() < 1e-10);
    }

    #[test]
    fn sprt_config_thresholds_maritime() {
        // Maritime: α=0.01, β=0.05
        // A = ln((1-0.05)/0.01) = ln(95) ≈ 4.554
        // B = ln(0.05/(1-0.01)) = ln(0.0505...) ≈ -2.986
        let cfg = SprtConfig {
            alpha: 0.01,
            beta: 0.05,
        };
        let a = cfg.confirm_threshold();
        let b = cfg.reject_threshold();
        assert!(a > 4.0 && a < 5.0, "A={a} expected ~4.55");
        assert!(b < -2.5 && b > -3.5, "B={b} expected ~-2.99");
        assert!(a > 0.0, "Confirm threshold must be positive");
        assert!(b < 0.0, "Reject threshold must be negative");
    }

    #[test]
    fn sprt_config_serde_roundtrip() {
        let cfg = SprtConfig {
            alpha: 0.05,
            beta: 0.10,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("\"alpha\""));
        assert!(json.contains("\"beta\""));
        let parsed: SprtConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn sprt_confirmed_transition_reason() {
        let json = serde_json::to_string(&TransitionReason::SprtConfirmed).unwrap();
        assert_eq!(json, "\"sprtConfirmed\"");
        let parsed: TransitionReason = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, TransitionReason::SprtConfirmed);
    }
}
