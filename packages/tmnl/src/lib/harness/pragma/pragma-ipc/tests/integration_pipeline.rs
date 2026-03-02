//! pragma-ipc: Integration tests — end-to-end protocol pipeline.
//! parse_request → process → serialize_response → parse again.

use pragma_ipc::protocol::*;
use pragma_ipc::types::*;

// All types re-exported from pragma_ipc::{protocol,types}

#[test]
fn request_to_response_roundtrip_annotate() {
    let req = JsonRpcRequest::annotate(42, "show me a chart");
    let json_str = serde_json::to_string(&req).unwrap();
    let parsed = parse_request(&json_str).unwrap();
    assert_eq!(parsed.id, 42);
    assert_eq!(parsed.method, "annotate");

    let result = DomainResult::Ok {
        value: AnnotateResponse {
            intent: IntentClassification {
                intent_type: IntentType::Data,
                confidence: 0.9,
                model_used: ModelTier::Minilm,
                tier_escalated: false,
            },
            candidates: vec![],
            disambiguation: vec![],
            hints: GenerationHints {
                temperature: 0.3,
                note: "high confidence".into(),
            },
            prefix_block: "```generation-context\n{}\n```".into(),
            sideband: Sideband {
                models_used: vec![ModelTier::Minilm],
                latency_ms: 1.5,
                catalog_recomputed: false,
            },
        },
    };

    let resp = JsonRpcResponse::success(parsed.id, serde_json::to_value(&result).unwrap());
    let serialized = serialize_response(&resp);
    assert!(serialized.ends_with('\n'));

    let deserialized: JsonRpcResponse = serde_json::from_str(serialized.trim()).unwrap();
    assert_eq!(deserialized.id, 42);
    assert!(!deserialized.is_error());
}

#[test]
fn request_to_response_roundtrip_score() {
    let req = JsonRpcRequest::score(7, "hello world", "hello earth");
    let json_str = serde_json::to_string(&req).unwrap();
    let parsed = parse_request(&json_str).unwrap();
    assert_eq!(parsed.method, "score");

    let result = DomainResult::Ok {
        value: ScoreResponse {
            bertscore: BertScoreResult {
                precision: 0.8,
                recall: 0.7,
                f1: 0.746,
            },
            bleurt: Some(0.65),
            drift_delta: 0.05,
            sideband: Sideband {
                models_used: vec![ModelTier::Minilm, ModelTier::BertBase],
                latency_ms: 12.0,
                catalog_recomputed: false,
            },
        },
    };

    let resp = JsonRpcResponse::success(parsed.id, serde_json::to_value(&result).unwrap());
    let serialized = serialize_response(&resp);
    let deserialized: JsonRpcResponse = serde_json::from_str(serialized.trim()).unwrap();
    assert!(!deserialized.is_error());
}

#[test]
fn request_to_error_roundtrip() {
    let req = JsonRpcRequest::new(99, "unknown_method", None);
    let json_str = serde_json::to_string(&req).unwrap();
    let parsed = parse_request(&json_str).unwrap();

    let resp = JsonRpcResponse::error(parsed.id, -32601, "Method not found");
    let serialized = serialize_response(&resp);
    let deserialized: JsonRpcResponse = serde_json::from_str(serialized.trim()).unwrap();
    assert!(deserialized.is_error());
    assert_eq!(deserialized.error.as_ref().unwrap().code, -32601);
}

#[test]
fn degraded_result_preserves_warnings() {
    let result: DomainResult<WarmupResponse> = DomainResult::Degraded {
        value: WarmupResponse {
            ready: true,
            models: vec![],
            catalog_embeddings_count: 0,
            drift_status: DriftStatus::Ok,
            warmup_ms: 100.0,
        },
        warnings: vec!["bert-base not available".into()],
    };

    let json = serde_json::to_value(&result).unwrap();
    let back: DomainResult<WarmupResponse> = serde_json::from_value(json).unwrap();
    assert!(back.is_degraded());
    assert!(back.value().is_some());
}

#[test]
fn all_factory_methods_produce_parseable_json() {
    for req in [
        JsonRpcRequest::warmup(1),
        JsonRpcRequest::annotate(2, "test"),
        JsonRpcRequest::score(3, "a", "b"),
        JsonRpcRequest::shutdown(4),
    ] {
        let json_str = serde_json::to_string(&req).unwrap();
        let parsed = parse_request(&json_str);
        assert!(parsed.is_ok(), "Failed to parse: {json_str}");
    }
}
