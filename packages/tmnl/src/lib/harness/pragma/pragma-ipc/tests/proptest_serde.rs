//! Property-based tests for pragma-ipc serde round-trip.
//!
//! TESTING.md Tier 1 — Protocol & IPC Tests
//!
//! Invariants:
//! - Any valid JsonRpcRequest survives JSON serialization round-trip
//! - Any valid JsonRpcResponse survives JSON serialization round-trip
//! - DomainResult<T> preserves variant tag and contents through serde
//! - All IntentType/ModelTier/DriftStatus enums are bijective under serde
//! - No panic on arbitrary string inputs to parse_request

use pragma_ipc::protocol::*;
use pragma_ipc::types::*;
use proptest::prelude::*;

// ─── Strategy Generators ────────────────────────────────────────────

fn arb_method() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("warmup".to_string()),
        Just("annotate".to_string()),
        Just("score".to_string()),
        Just("shutdown".to_string()),
        "[a-z_]{1,30}",  // random method strings for unknown dispatch
    ]
}

fn arb_params() -> impl Strategy<Value = Option<serde_json::Value>> {
    prop_oneof![
        Just(None),
        Just(Some(serde_json::json!({}))),
        Just(Some(serde_json::json!({"prompt": "test"}))),
        Just(Some(serde_json::json!({"reference": "a", "hypothesis": "b"}))),
        any::<String>().prop_map(|s| Some(serde_json::json!({"prompt": s}))),
    ]
}

fn arb_intent_type() -> impl Strategy<Value = IntentType> {
    prop_oneof![
        Just(IntentType::Data),
        Just(IntentType::Form),
        Just(IntentType::Layout),
        Just(IntentType::Feedback),
        Just(IntentType::Mixed),
        Just(IntentType::Idle),
    ]
}

fn arb_model_tier() -> impl Strategy<Value = ModelTier> {
    prop_oneof![Just(ModelTier::Minilm), Just(ModelTier::BertBase),]
}

fn arb_drift_status() -> impl Strategy<Value = DriftStatus> {
    prop_oneof![
        Just(DriftStatus::Ok),
        Just(DriftStatus::Warning),
        Just(DriftStatus::Alert),
        Just(DriftStatus::NoBaseline),
    ]
}

fn arb_confidence() -> impl Strategy<Value = f32> {
    0.0f32..=1.0f32
}

fn arb_bertscore() -> impl Strategy<Value = BertScoreResult> {
    (arb_confidence(), arb_confidence(), arb_confidence()).prop_map(|(p, r, f)| BertScoreResult {
        precision: p,
        recall: r,
        f1: f,
    })
}

// ─── Request Round-Trip ─────────────────────────────────────────────

proptest! {
    #[test]
    fn request_roundtrip(
        id in 0u64..1_000_000,
        method in arb_method(),
        params in arb_params()
    ) {
        let req = JsonRpcRequest::new(id, method, params);
        let json = serde_json::to_string(&req).unwrap();
        let parsed: JsonRpcRequest = serde_json::from_str(&json).unwrap();
        prop_assert_eq!(req, parsed);
    }

    #[test]
    fn request_always_has_jsonrpc_field(
        id in 0u64..1000,
        method in arb_method()
    ) {
        let req = JsonRpcRequest::new(id, method, None);
        prop_assert_eq!(&req.jsonrpc, JSONRPC_VERSION);
    }

    // ─── Response Round-Trip ────────────────────────────────────────

    #[test]
    fn response_success_roundtrip(
        id in 0u64..1_000_000,
    ) {
        let resp = JsonRpcResponse::success(id, serde_json::json!({"ok": true}));
        let json = serde_json::to_string(&resp).unwrap();
        let parsed: JsonRpcResponse = serde_json::from_str(&json).unwrap();
        let is_err = parsed.is_error();
        prop_assert_eq!(resp, parsed);
        prop_assert!(!is_err);
    }

    #[test]
    fn response_error_roundtrip(
        id in 0u64..1_000_000,
        code in -40099i32..=-32600,
        message in "[a-zA-Z ]{1,50}"
    ) {
        let resp = JsonRpcResponse::error(id, code, message);
        let json = serde_json::to_string(&resp).unwrap();
        let parsed: JsonRpcResponse = serde_json::from_str(&json).unwrap();
        let is_err = parsed.is_error();
        prop_assert_eq!(resp, parsed);
        prop_assert!(is_err);
    }

    // ─── DomainResult Round-Trip ────────────────────────────────────

    #[test]
    fn domain_result_ok_roundtrip(value in any::<u32>()) {
        let result: DomainResult<u32> = DomainResult::Ok { value };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: DomainResult<u32> = serde_json::from_str(&json).unwrap();
        prop_assert_eq!(&result, &parsed);
        prop_assert!(!parsed.is_error());
        prop_assert!(!parsed.is_degraded());
    }

    #[test]
    fn domain_result_degraded_roundtrip(
        value in any::<u32>(),
        warning in "[a-zA-Z ]{1,100}"
    ) {
        let result: DomainResult<u32> = DomainResult::Degraded {
            value,
            warnings: vec![warning],
        };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: DomainResult<u32> = serde_json::from_str(&json).unwrap();
        prop_assert_eq!(&result, &parsed);
        prop_assert!(parsed.is_degraded());
    }

    #[test]
    fn domain_result_error_roundtrip(
        code in "[A-Z_]{5,30}",
        detail in "[a-zA-Z ]{1,100}"
    ) {
        let result: DomainResult<u32> = DomainResult::Error { code, detail };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: DomainResult<u32> = serde_json::from_str(&json).unwrap();
        prop_assert_eq!(&result, &parsed);
        prop_assert!(result.is_error());
        prop_assert_eq!(result.value(), None);
    }

    // ─── Enum Bijectivity ───────────────────────────────────────────

    #[test]
    fn intent_type_bijective(intent in arb_intent_type()) {
        let json = serde_json::to_string(&intent).unwrap();
        let parsed: IntentType = serde_json::from_str(&json).unwrap();
        prop_assert_eq!(intent, parsed);
    }

    #[test]
    fn model_tier_bijective(tier in arb_model_tier()) {
        let json = serde_json::to_string(&tier).unwrap();
        let parsed: ModelTier = serde_json::from_str(&json).unwrap();
        prop_assert_eq!(tier, parsed);
    }

    #[test]
    fn drift_status_bijective(status in arb_drift_status()) {
        let json = serde_json::to_string(&status).unwrap();
        let parsed: DriftStatus = serde_json::from_str(&json).unwrap();
        prop_assert_eq!(status, parsed);
    }

    // ─── BERTScore Round-Trip ───────────────────────────────────────

    #[test]
    fn bertscore_roundtrip(bs in arb_bertscore()) {
        let json = serde_json::to_string(&bs).unwrap();
        let parsed: BertScoreResult = serde_json::from_str(&json).unwrap();
        prop_assert_eq!(bs, parsed);
    }

    // ─── Parse Robustness ───────────────────────────────────────────

    #[test]
    fn parse_request_never_panics(input in ".*") {
        // parse_request must never panic, only return Ok or Err
        let _ = parse_request(&input);
    }

    #[test]
    fn serialize_response_always_newline_terminated(id in 0u64..1000) {
        let resp = JsonRpcResponse::success(id, serde_json::json!(null));
        let s = serialize_response(&resp);
        prop_assert!(s.ends_with('\n'));
        prop_assert_eq!(s.matches('\n').count(), 1);
    }
}
