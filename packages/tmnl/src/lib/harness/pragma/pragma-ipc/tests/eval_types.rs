//! pragma-ipc: Eval tests — validate type serialization against golden shapes.

use pragma_ipc::types::*;

#[test]
fn intent_type_all_six_variants_serialize() {
    let variants = [
        IntentType::Data,
        IntentType::Form,
        IntentType::Layout,
        IntentType::Feedback,
        IntentType::Mixed,
        IntentType::Idle,
    ];
    for v in &variants {
        let json = serde_json::to_string(v).unwrap();
        let back: IntentType = serde_json::from_str(&json).unwrap();
        assert_eq!(v, &back);
    }
}

#[test]
fn model_tier_both_variants_serialize() {
    for tier in [ModelTier::Minilm, ModelTier::BertBase] {
        let json = serde_json::to_string(&tier).unwrap();
        let back: ModelTier = serde_json::from_str(&json).unwrap();
        assert_eq!(tier, back);
    }
}

#[test]
fn annotate_response_full_shape_golden() {
    let resp = AnnotateResponse {
        intent: IntentClassification {
            intent_type: IntentType::Data,
            confidence: 0.92,
            model_used: ModelTier::Minilm,
            tier_escalated: false,
        },
        candidates: vec![Candidate {
            component_type: "BarChart".into(),
            similarity: 0.88,
            hint: "Use for categorical data".into(),
        }],
        disambiguation: vec![],
        hints: GenerationHints {
            temperature: 0.3,
            note: "High confidence DATA intent".into(),
        },
        prefix_block: "```generation-context\n{}\n```".into(),
        sideband: Sideband {
            models_used: vec![ModelTier::Minilm],
            latency_ms: 2.1,
            catalog_recomputed: false,
        },
    };

    let json = serde_json::to_value(&resp).unwrap();
    assert!(json["intent"]["type"].is_string());
    assert!(json["intent"]["confidence"].is_number());
    assert!(json["candidates"].is_array());
    assert!(json["hints"]["temperature"].is_number());
    assert!(json["sideband"]["models_used"].is_array());
}

#[test]
fn score_response_golden_with_bleurt() {
    let resp = ScoreResponse {
        bertscore: BertScoreResult {
            precision: 0.85,
            recall: 0.78,
            f1: 0.813,
        },
        bleurt: Some(0.72),
        drift_delta: 0.03,
        sideband: Sideband {
            models_used: vec![ModelTier::Minilm, ModelTier::BertBase],
            latency_ms: 12.0,
            catalog_recomputed: false,
        },
    };

    let json = serde_json::to_value(&resp).unwrap();
    assert!(json["bertscore"]["precision"].is_number());
    assert!(json["bleurt"].is_number());
    assert!(json["drift_delta"].is_number());
}

#[test]
fn score_response_golden_without_bleurt() {
    let resp = ScoreResponse {
        bertscore: BertScoreResult {
            precision: 0.5,
            recall: 0.5,
            f1: 0.5,
        },
        bleurt: None,
        drift_delta: 0.5,
        sideband: Sideband {
            models_used: vec![],
            latency_ms: 0.1,
            catalog_recomputed: false,
        },
    };

    let json = serde_json::to_value(&resp).unwrap();
    assert!(json.get("bleurt").is_none() || json["bleurt"].is_null());
}

#[test]
fn disambiguation_entry_variants_golden() {
    let clash = DisambiguationEntry::Clash {
        clash: vec!["DATA".into(), "FORM".into()],
        reason: "Multiple strong intents".into(),
    };
    let ambiguity = DisambiguationEntry::Ambiguity {
        ambiguity: "Weak signal".into(),
        note: "Add more context".into(),
    };

    let clash_json = serde_json::to_value(&clash).unwrap();
    let ambig_json = serde_json::to_value(&ambiguity).unwrap();
    assert!(clash_json["clash"].is_array());
    assert!(ambig_json["ambiguity"].is_string());

    let _: DisambiguationEntry = serde_json::from_value(clash_json).unwrap();
    let _: DisambiguationEntry = serde_json::from_value(ambig_json).unwrap();
}

#[test]
fn domain_result_error_shape() {
    let result: DomainResult<String> = DomainResult::Error {
        code: "E_TEST".into(),
        detail: "test failure".into(),
    };
    assert!(result.value().is_none());
    assert!(result.is_error());
    assert!(!result.is_degraded());
}
