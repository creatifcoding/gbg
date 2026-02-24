//! Sequence pattern types for temporal event ordering (R9).
//!
//! Defines [`SequencePattern`], [`SequenceStep`], [`Contiguity`],
//! [`SequenceMatch`], and supporting configuration types.
//!
//! Source: TSGC-001-v2 Section 16 (R9).

use serde::{Deserialize, Serialize};
use typeshare::typeshare;

// ---------------------------------------------------------------------------
// Contiguity — step adjacency mode
// ---------------------------------------------------------------------------

/// Contiguity mode for sequence step matching.
///
/// - `Strict`: No unmatched events between steps; resets on non-match.
/// - `Relaxed` (default): Unrelated events between steps are ignored.
/// - `NonDeterministic`: Any event order accepted; branching exploration.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Contiguity {
    /// No unmatched events between steps.
    Strict,
    /// Unrelated events ignored (default).
    Relaxed,
    /// Any event order accepted; branching exploration.
    NonDeterministic,
}

impl Default for Contiguity {
    fn default() -> Self {
        Self::Relaxed
    }
}

// ---------------------------------------------------------------------------
// TimeoutAction — what to do when a sequence times out
// ---------------------------------------------------------------------------

/// Action to take when a sequence pattern exceeds its timeout duration.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TimeoutAction {
    /// Discard the in-progress sequence entirely.
    Abort,
    /// Emit a partial match with the steps completed so far.
    Partial,
    /// Extend the timeout window and keep waiting.
    Extend,
}

// ---------------------------------------------------------------------------
// SequenceStep — one step in a sequence pattern
// ---------------------------------------------------------------------------

/// A single step in a temporal sequence pattern.
///
/// Each step matches a signal kind with optional filters and duration
/// constraints. Steps are connected by contiguity rules.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SequenceStep {
    /// Signal kind this step matches (e.g. "ais", "lifecycle_transition").
    pub signal_kind: String,
    /// Optional filter predicate expression (e.g. "speed < 1.0").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub predicate: Option<String>,
    /// Minimum duration at this step (ms) before transitioning.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_duration_ms: Option<u64>,
    /// Maximum duration at this step (ms) before step times out.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_duration_ms: Option<u64>,
    /// Contiguity mode for the transition FROM this step to the next.
    #[serde(default)]
    pub contiguity: Contiguity,
}

// ---------------------------------------------------------------------------
// CrossStepPredicate — predicate spanning two steps
// ---------------------------------------------------------------------------

/// A predicate that spans two steps in a sequence pattern.
///
/// Used for constraints like "same entity across steps" or
/// "spatial continuity between step 1 and step 3".
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrossStepPredicate {
    /// Index of the earlier step (0-based).
    pub from_step: u32,
    /// Index of the later step (0-based).
    pub to_step: u32,
    /// Predicate expression (e.g. "haversine(step_1.geo, step_3.geo) < 50km").
    pub predicate: String,
}

// ---------------------------------------------------------------------------
// SequenceTimeout — timeout configuration
// ---------------------------------------------------------------------------

/// Timeout configuration for a sequence pattern.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SequenceTimeout {
    /// Maximum duration for the entire sequence (ms).
    pub duration_ms: u64,
    /// Action to take on timeout.
    pub action: TimeoutAction,
}

// ---------------------------------------------------------------------------
// SequencePattern — the full pattern definition
// ---------------------------------------------------------------------------

/// A temporal sequence pattern definition (R9 §16.1).
///
/// Defines an ordered set of steps with contiguity rules, cross-step
/// predicates, and timeout constraints. Each enabled pattern compiles
/// to a d2ts stateful operator chain.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SequencePattern {
    /// Unique pattern identifier.
    pub id: String,
    /// Human-readable pattern name.
    pub name: String,
    /// Ordered sequence of steps.
    pub steps: Vec<SequenceStep>,
    /// Default contiguity for transitions (can be overridden per step).
    pub contiguity: Contiguity,
    /// Cross-step predicates that must hold for the match.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub cross_predicates: Vec<CrossStepPredicate>,
    /// Maximum duration for the entire sequence (ms).
    pub timeout_ms: u64,
    /// Whether this pattern is currently active.
    pub enabled: bool,
}

// ---------------------------------------------------------------------------
// SequenceMatch — a matched instance
// ---------------------------------------------------------------------------

/// A matched instance of a sequence pattern (R9 output).
///
/// Contains which pattern matched, for which entity, which steps
/// were completed, and the time span and confidence of the match.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SequenceMatch {
    /// ID of the matched pattern.
    pub pattern_id: String,
    /// Entity ID the match applies to.
    pub entity_id: String,
    /// Indices of matched steps (0-based).
    pub matched_steps: Vec<u32>,
    /// Match start time (epoch ms).
    pub start_ms: u64,
    /// Match end time (epoch ms).
    pub end_ms: u64,
    /// Match confidence (completeness * timeliness * specificity).
    pub confidence: f64,
}

// ---------------------------------------------------------------------------
// CanonicalSequence — named pre-built pattern
// ---------------------------------------------------------------------------

/// A canonical (pre-built) sequence pattern shipped with the system.
///
/// Examples: AIS dark period detection, C2 beacon chain, maritime
/// transshipment (R9 §16.2).
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalSequence {
    /// Unique canonical sequence identifier.
    pub id: String,
    /// Human-readable name.
    pub name: String,
    /// Description of what this sequence detects.
    pub description: String,
    /// The underlying pattern definition.
    pub pattern: SequencePattern,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_step(kind: &str) -> SequenceStep {
        SequenceStep {
            signal_kind: kind.into(),
            predicate: None,
            min_duration_ms: None,
            max_duration_ms: None,
            contiguity: Contiguity::default(),
        }
    }

    // -- Contiguity --

    #[test]
    fn contiguity_all_variants_roundtrip() {
        let variants = [
            Contiguity::Strict,
            Contiguity::Relaxed,
            Contiguity::NonDeterministic,
        ];
        for c in variants {
            let json = serde_json::to_string(&c).unwrap();
            let parsed: Contiguity = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, c);
        }
    }

    #[test]
    fn contiguity_json_shape() {
        let json = serde_json::to_string(&Contiguity::NonDeterministic).unwrap();
        assert_eq!(json, "\"nonDeterministic\"");
    }

    #[test]
    fn contiguity_default_is_relaxed() {
        assert_eq!(Contiguity::default(), Contiguity::Relaxed);
    }

    // -- TimeoutAction --

    #[test]
    fn timeout_action_all_variants_roundtrip() {
        let variants = [
            TimeoutAction::Abort,
            TimeoutAction::Partial,
            TimeoutAction::Extend,
        ];
        for ta in variants {
            let json = serde_json::to_string(&ta).unwrap();
            let parsed: TimeoutAction = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, ta);
        }
    }

    // -- SequenceStep --

    #[test]
    fn sequence_step_serde_roundtrip() {
        let step = SequenceStep {
            signal_kind: "ais".into(),
            predicate: Some("speed < 1.0".into()),
            min_duration_ms: Some(1_000),
            max_duration_ms: Some(60_000),
            contiguity: Contiguity::Strict,
        };
        let json = serde_json::to_string(&step).unwrap();
        assert!(json.contains("\"signalKind\""));
        assert!(json.contains("\"predicate\""));
        assert!(json.contains("\"minDurationMs\""));
        let parsed: SequenceStep = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, step);
    }

    #[test]
    fn sequence_step_optional_fields_omitted() {
        let step = make_test_step("adsb");
        let json = serde_json::to_string(&step).unwrap();
        assert!(!json.contains("\"predicate\""));
        assert!(!json.contains("\"minDurationMs\""));
        assert!(!json.contains("\"maxDurationMs\""));
    }

    // -- CrossStepPredicate --

    #[test]
    fn cross_step_predicate_serde_roundtrip() {
        let csp = CrossStepPredicate {
            from_step: 0,
            to_step: 2,
            predicate: "haversine(step_0.geo, step_2.geo) < 50000".into(),
        };
        let json = serde_json::to_string(&csp).unwrap();
        assert!(json.contains("\"fromStep\""));
        assert!(json.contains("\"toStep\""));
        let parsed: CrossStepPredicate = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, csp);
    }

    // -- SequenceTimeout --

    #[test]
    fn sequence_timeout_serde_roundtrip() {
        let timeout = SequenceTimeout {
            duration_ms: 21_600_000,
            action: TimeoutAction::Partial,
        };
        let json = serde_json::to_string(&timeout).unwrap();
        let parsed: SequenceTimeout = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, timeout);
    }

    // -- SequencePattern --

    #[test]
    fn sequence_pattern_serde_roundtrip() {
        let pattern = SequencePattern {
            id: "ais-dark-period".into(),
            name: "AIS Dark Period Detection".into(),
            steps: vec![
                SequenceStep {
                    signal_kind: "ais".into(),
                    predicate: None,
                    min_duration_ms: None,
                    max_duration_ms: None,
                    contiguity: Contiguity::Relaxed,
                },
                SequenceStep {
                    signal_kind: "absence_event".into(),
                    predicate: Some("elapsed > 300000".into()),
                    min_duration_ms: Some(300_000),
                    max_duration_ms: None,
                    contiguity: Contiguity::Relaxed,
                },
                SequenceStep {
                    signal_kind: "ais".into(),
                    predicate: None,
                    min_duration_ms: None,
                    max_duration_ms: None,
                    contiguity: Contiguity::Relaxed,
                },
            ],
            contiguity: Contiguity::Relaxed,
            cross_predicates: vec![CrossStepPredicate {
                from_step: 0,
                to_step: 2,
                predicate: "haversine(step_0.geo, step_2.geo) < 50000".into(),
            }],
            timeout_ms: 21_600_000,
            enabled: true,
        };
        let json = serde_json::to_string(&pattern).unwrap();
        assert!(json.contains("\"ais-dark-period\""));
        assert!(json.contains("\"crossPredicates\""));
        assert!(json.contains("\"timeoutMs\""));
        let parsed: SequencePattern = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, pattern.id);
        assert_eq!(parsed.steps.len(), 3);
        assert_eq!(parsed.cross_predicates.len(), 1);
    }

    #[test]
    fn sequence_pattern_empty_cross_predicates_omitted() {
        let pattern = SequencePattern {
            id: "simple".into(),
            name: "Simple".into(),
            steps: vec![make_test_step("ais"), make_test_step("ais")],
            contiguity: Contiguity::Relaxed,
            cross_predicates: vec![],
            timeout_ms: 60_000,
            enabled: false,
        };
        let json = serde_json::to_string(&pattern).unwrap();
        assert!(!json.contains("\"crossPredicates\""));
    }

    // -- SequenceMatch --

    #[test]
    fn sequence_match_serde_roundtrip() {
        let m = SequenceMatch {
            pattern_id: "ais-dark-period".into(),
            entity_id: "vessel-211900000".into(),
            matched_steps: vec![0, 1, 2],
            start_ms: 1_700_000_000_000,
            end_ms: 1_700_000_060_000,
            confidence: 0.92,
        };
        let json = serde_json::to_string(&m).unwrap();
        assert!(json.contains("\"patternId\""));
        assert!(json.contains("\"matchedSteps\""));
        let parsed: SequenceMatch = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, m);
    }

    // -- CanonicalSequence --

    #[test]
    fn canonical_sequence_serde_roundtrip() {
        let cs = CanonicalSequence {
            id: "canonical-ais-dark".into(),
            name: "AIS Dark Period".into(),
            description: "Detects vessels that stop transmitting AIS then resume".into(),
            pattern: SequencePattern {
                id: "ais-dark-period".into(),
                name: "AIS Dark Period Detection".into(),
                steps: vec![make_test_step("ais"), make_test_step("absence_event")],
                contiguity: Contiguity::Relaxed,
                cross_predicates: vec![],
                timeout_ms: 21_600_000,
                enabled: true,
            },
        };
        let json = serde_json::to_string(&cs).unwrap();
        assert!(json.contains("\"description\""));
        assert!(json.contains("\"pattern\""));
        let parsed: CanonicalSequence = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, cs.id);
    }
}
