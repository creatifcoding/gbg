//! Ambiguity detection and disambiguation hints.
//!
//! When the FSM produces Mixed or Idle results, this module provides:
//! - Disambiguation candidates (ordered by score)
//! - Confidence estimation for escalation decisions

use pragma_ipc::types::{DisambiguationEntry, IntentType};

use crate::fsm::FsmResult;

/// Ambiguity analysis result.
#[derive(Debug, Clone)]
pub struct AmbiguityReport {
    /// Whether escalation to the deep encoder is recommended.
    pub should_escalate: bool,
    /// Confidence of the FSM result (0.0 = no idea, 1.0 = certain).
    pub confidence: f32,
    /// Disambiguation entries for the AnnotateResponse.
    pub disambiguation: Vec<DisambiguationEntry>,
    /// Explanation of ambiguity (for sideband/debugging).
    pub reason: String,
}

/// Analyze an FSM result for ambiguity and produce escalation hints.
pub fn analyze(fsm: &FsmResult) -> AmbiguityReport {
    match fsm.intent {
        IntentType::Idle => analyze_idle(fsm),
        IntentType::Mixed => analyze_mixed(fsm),
        _ if fsm.ambiguous => analyze_weak_single(fsm),
        _ => analyze_confident(fsm),
    }
}

/// Idle: no categories activated. Escalate to embedding search.
fn analyze_idle(fsm: &FsmResult) -> AmbiguityReport {
    let weak_signals: Vec<_> = fsm
        .scores
        .iter()
        .filter(|(_, s)| *s > 0)
        .map(|(intent, _)| format!("{:?}", intent))
        .collect();

    AmbiguityReport {
        should_escalate: true,
        confidence: 0.0,
        disambiguation: if weak_signals.is_empty() {
            vec![]
        } else {
            vec![DisambiguationEntry::Ambiguity {
                ambiguity: "No clear UI intent".to_string(),
                note: format!("Weak signals from: {}", weak_signals.join(", ")),
            }]
        },
        reason: if weak_signals.is_empty() {
            "No UI keywords detected. May be non-UI prompt.".to_string()
        } else {
            format!(
                "Weak signals from {} categories but none reached activation threshold.",
                weak_signals.len()
            )
        },
    }
}

/// Mixed: multiple categories activated at similar levels.
fn analyze_mixed(fsm: &FsmResult) -> AmbiguityReport {
    let mut active: Vec<(IntentType, u32)> = fsm
        .scores
        .iter()
        .filter(|(_, s)| *s >= 2)
        .cloned()
        .collect();
    active.sort_by(|a, b| b.1.cmp(&a.1));

    let top_score = active.first().map(|(_, s)| *s).unwrap_or(0);
    let confidence = if active.len() >= 2 {
        let second = active[1].1;
        if second > 0 {
            (top_score as f32 - second as f32) / top_score as f32
        } else {
            0.8
        }
    } else {
        0.5
    };

    let clash_names: Vec<String> = active.iter().map(|(i, _)| format!("{:?}", i)).collect();

    AmbiguityReport {
        should_escalate: true,
        confidence,
        disambiguation: vec![DisambiguationEntry::Clash {
            clash: clash_names.clone(),
            reason: format!(
                "Multiple intent categories active at similar levels: {}",
                active
                    .iter()
                    .map(|(i, s)| format!("{:?}={}", i, s))
                    .collect::<Vec<_>>()
                    .join(", ")
            ),
        }],
        reason: format!(
            "Multiple intent categories active: {}",
            clash_names.join(", ")
        ),
    }
}

/// Weak single: only one category active but with low score.
fn analyze_weak_single(fsm: &FsmResult) -> AmbiguityReport {
    let winner = fsm
        .scores
        .iter()
        .max_by_key(|(_, s)| *s)
        .map(|(i, s)| (*i, *s))
        .unwrap_or((IntentType::Idle, 0));

    AmbiguityReport {
        should_escalate: winner.1 < 4,
        confidence: (winner.1 as f32 / 10.0).min(1.0),
        disambiguation: vec![],
        reason: format!("Single active category {:?} with score {}", winner.0, winner.1),
    }
}

/// Confident: clear winner, no ambiguity.
fn analyze_confident(fsm: &FsmResult) -> AmbiguityReport {
    let winner = fsm
        .scores
        .iter()
        .max_by_key(|(_, s)| *s)
        .map(|(i, s)| (*i, *s))
        .unwrap_or((IntentType::Idle, 0));

    let max_possible = 20u32;
    let confidence = (winner.1 as f32 / max_possible as f32).min(1.0).max(0.5);

    AmbiguityReport {
        should_escalate: false,
        confidence,
        disambiguation: vec![],
        reason: format!("Clear intent: {:?} (score {})", winner.0, winner.1),
    }
}

// ─── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fsm;

    #[test]
    fn idle_prompt_escalates() {
        let fsm_result = fsm::classify("tell me about philosophy");
        let report = analyze(&fsm_result);
        assert!(report.should_escalate);
        assert!(report.confidence < 0.3);
    }

    #[test]
    fn mixed_prompt_escalates() {
        let fsm_result =
            fsm::classify("create a dashboard with a form for data input and chart visualization");
        let report = analyze(&fsm_result);
        assert!(report.should_escalate);
        assert!(!report.disambiguation.is_empty());
    }

    #[test]
    fn confident_prompt_no_escalation() {
        let fsm_result = fsm::classify("show me a bar chart of monthly revenue data");
        let report = analyze(&fsm_result);
        assert!(!report.should_escalate);
        assert!(report.confidence > 0.3);
    }

    #[test]
    fn disambiguation_clash_for_mixed() {
        let fsm_result =
            fsm::classify("create a dashboard with a form for data input and chart visualization");
        let report = analyze(&fsm_result);
        let has_clash = report.disambiguation.iter().any(|d| {
            matches!(d, DisambiguationEntry::Clash { .. })
        });
        assert!(has_clash, "Mixed result should produce a Clash disambiguation");
    }

    #[test]
    fn reason_is_populated() {
        let fsm_result = fsm::classify("show a chart");
        let report = analyze(&fsm_result);
        assert!(!report.reason.is_empty());
    }
}
