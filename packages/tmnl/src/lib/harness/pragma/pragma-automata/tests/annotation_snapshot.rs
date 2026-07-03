//! T4: Snapshot regression for annotation pipeline output.

use pragma_automata::{ambiguity, fsm, prefix};
use pragma_ipc::types::*;

/// Compute a pseudo-confidence from FSM scores for test purposes.
fn fsm_confidence(result: &fsm::FsmResult) -> f32 {
    let max_score = result.scores.iter().map(|(_, s)| *s).max().unwrap_or(0);
    let total: u32 = result.scores.iter().map(|(_, s)| *s).sum();
    if total == 0 {
        0.0
    } else {
        max_score as f32 / total as f32
    }
}

fn mock_annotate(prompt: &str) -> AnnotateResponse {
    let fsm_result = fsm::classify(prompt);
    let confidence = fsm_confidence(&fsm_result);
    let intent = IntentClassification {
        intent_type: fsm_result.intent,
        confidence,
        model_used: ModelTier::Minilm,
        tier_escalated: false,
    };
    let ambiguity_report = ambiguity::analyze(&fsm_result);
    let temperature = if confidence > 0.8 {
        0.3
    } else if confidence > 0.5 {
        0.5
    } else {
        0.7
    };

    let resp = AnnotateResponse {
        intent,
        candidates: vec![],
        disambiguation: ambiguity_report.disambiguation,
        hints: GenerationHints {
            temperature,
            note: format!("{:?} intent, conf={:.2}", fsm_result.intent, confidence),
        },
        prefix_block: String::new(),
        sideband: Sideband {
            models_used: vec![ModelTier::Minilm],
            latency_ms: 0.0,
            catalog_recomputed: false,
        },
    };

    let mut final_resp = resp.clone();
    final_resp.prefix_block = prefix::build_prefix_block(&resp);
    final_resp
}

#[test]
fn annotation_data_snapshot() {
    let resp = mock_annotate("show me a bar chart of monthly revenue");
    insta::assert_json_snapshot!("annotation_data_intent", {
        ".sideband.latency_ms" => "[latency]",
    }, resp);
}

#[test]
fn annotation_mixed_snapshot() {
    let resp = mock_annotate("dashboard with charts and forms");
    insta::assert_json_snapshot!("annotation_mixed_intent", {
        ".sideband.latency_ms" => "[latency]",
    }, resp);
}

#[test]
fn annotation_idle_snapshot() {
    let resp = mock_annotate("what is the meaning of life?");
    insta::assert_json_snapshot!("annotation_idle_intent", {
        ".sideband.latency_ms" => "[latency]",
    }, resp);
}
