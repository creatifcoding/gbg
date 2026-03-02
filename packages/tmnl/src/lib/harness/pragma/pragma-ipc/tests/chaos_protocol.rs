//! pragma-ipc: Chaos tests — malformed input, boundary values, edge cases.

use pragma_ipc::protocol::*;
use pragma_ipc::types::*;

// ─── Malformed JSON ─────────────────────────────────────────────────

#[test]
fn parse_empty_string_is_err() {
    assert!(parse_request("").is_err());
}

#[test]
fn parse_bare_null_is_err() {
    assert!(parse_request("null").is_err());
}

#[test]
fn parse_bare_number_is_err() {
    assert!(parse_request("42").is_err());
}

#[test]
fn parse_bare_array_is_err() {
    assert!(parse_request("[1,2,3]").is_err());
}

#[test]
fn parse_missing_jsonrpc_field_is_err() {
    let json = r#"{"id":1,"method":"warmup"}"#;
    assert!(parse_request(json).is_err());
}

#[test]
fn parse_wrong_jsonrpc_version_still_parses() {
    // Parser is lenient on version field — validates structure, not protocol version.
    let json = r#"{"jsonrpc":"1.0","id":1,"method":"warmup"}"#;
    let result = parse_request(json);
    assert!(result.is_ok()); // Lenient: method/id present → ok
}

#[test]
fn parse_missing_method_is_err() {
    let json = r#"{"jsonrpc":"2.0","id":1}"#;
    assert!(parse_request(json).is_err());
}

#[test]
fn parse_null_method_is_err() {
    let json = r#"{"jsonrpc":"2.0","id":1,"method":null}"#;
    assert!(parse_request(json).is_err());
}

// ─── Boundary IDs ───────────────────────────────────────────────────

#[test]
fn request_with_zero_id() {
    let json = r#"{"jsonrpc":"2.0","id":0,"method":"warmup"}"#;
    let result = parse_request(json);
    assert!(result.is_ok());
    assert_eq!(result.unwrap().id, 0);
}

#[test]
fn request_with_max_u64_id() {
    let json = format!(r#"{{"jsonrpc":"2.0","id":{},"method":"warmup"}}"#, u64::MAX);
    let result = parse_request(&json);
    assert!(result.is_ok());
}

// ─── Unicode in payloads ────────────────────────────────────────────

#[test]
fn unicode_in_method() {
    let json = r#"{"jsonrpc":"2.0","id":1,"method":"annotate","params":{"prompt":"日本語テスト"}}"#;
    let result = parse_request(json);
    assert!(result.is_ok());
}

#[test]
fn emoji_in_params() {
    let json = r#"{"jsonrpc":"2.0","id":1,"method":"annotate","params":{"prompt":"🎨📊📈"}}"#;
    let result = parse_request(json);
    assert!(result.is_ok());
}

// ─── Serialization edge cases ───────────────────────────────────────

#[test]
fn response_with_null_result_and_null_error() {
    let resp = JsonRpcResponse {
        jsonrpc: "2.0".into(),
        id: 1,
        result: None,
        error: None,
    };
    let serialized = serialize_response(&resp);
    assert!(serialized.ends_with('\n'));
    // Should still be parseable
    let _: serde_json::Value = serde_json::from_str(serialized.trim()).unwrap();
}

#[test]
fn error_with_data_serializes_correctly() {
    let resp = JsonRpcResponse::error_with_data(
        5,
        -32000,
        "custom error",
        serde_json::json!({"detail": "something went wrong", "count": 42}),
    );
    let serialized = serialize_response(&resp);
    let parsed: serde_json::Value = serde_json::from_str(serialized.trim()).unwrap();
    assert_eq!(parsed["error"]["data"]["count"], 42);
}

// ─── DomainResult chaos ─────────────────────────────────────────────

#[test]
fn domain_result_error_has_no_value() {
    let result: DomainResult<String> = DomainResult::Error {
        code: "E_TEST".into(),
        detail: "fail".into(),
    };
    assert!(result.value().is_none());
    assert!(result.is_error());
    assert!(!result.is_degraded());
}

#[test]
fn domain_result_nested_serialization() {
    let inner = DomainResult::Ok {
        value: ScoreResponse {
            bertscore: BertScoreResult {
                precision: 0.0,
                recall: 0.0,
                f1: 0.0,
            },
            bleurt: None,
            drift_delta: 0.0,
            sideband: Sideband {
                models_used: vec![],
                latency_ms: 0.0,
                catalog_recomputed: false,
            },
        },
    };
    let json = serde_json::to_string(&inner).unwrap();
    let back: DomainResult<ScoreResponse> = serde_json::from_str(&json).unwrap();
    assert!(!back.is_error());
}
