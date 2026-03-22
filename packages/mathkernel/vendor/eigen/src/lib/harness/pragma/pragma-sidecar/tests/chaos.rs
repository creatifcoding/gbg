//! T6: Chaos tests — rapid-fire, fault injection, edge cases.

use assert_cmd::Command;
use serde_json::Value;

/// Send multiple JSON-RPC requests in a single stdin batch.
fn batch_requests(requests: &[Value]) -> Vec<Value> {
    let input: String = requests
        .iter()
        .map(|r| format!("{}\n", serde_json::to_string(r).unwrap()))
        .collect();

    let output = Command::cargo_bin("pragma-sidecar")
        .unwrap()
        .write_stdin(input)
        .output()
        .expect("failed to run sidecar");

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|l| serde_json::from_str(l).ok())
        .collect()
}

// ─── Rapid-fire requests ────────────────────────────────────────────

#[test]
fn rapid_fire_50_requests_all_responded() {
    let requests: Vec<Value> = (1..=50)
        .map(|id| {
            serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "method": "annotate",
                "params": { "prompt": format!("test prompt {}", id) }
            })
        })
        .collect();

    let responses = batch_requests(&requests);

    // Every request should get a response
    assert_eq!(responses.len(), 50, "Expected 50 responses, got {}", responses.len());

    // All IDs should match
    let response_ids: std::collections::HashSet<u64> = responses
        .iter()
        .map(|r| r["id"].as_u64().unwrap())
        .collect();
    for id in 1..=50u64 {
        assert!(response_ids.contains(&id), "Missing response for id={id}");
    }
}

#[test]
fn rapid_fire_mixed_methods() {
    let requests: Vec<Value> = vec![
        serde_json::json!({"jsonrpc":"2.0","id":1,"method":"warmup"}),
        serde_json::json!({"jsonrpc":"2.0","id":2,"method":"annotate","params":{"prompt":"chart"}}),
        serde_json::json!({"jsonrpc":"2.0","id":3,"method":"score","params":{"reference":"hello","hypothesis":"hello"}}),
        serde_json::json!({"jsonrpc":"2.0","id":4,"method":"annotate","params":{"prompt":"form"}}),
        serde_json::json!({"jsonrpc":"2.0","id":5,"method":"score","params":{"reference":"a","hypothesis":"b"}}),
    ];

    let responses = batch_requests(&requests);
    assert_eq!(responses.len(), 5);
}

// ─── Fault injection ────────────────────────────────────────────────

#[test]
fn malformed_json_between_valid_requests() {
    let input = concat!(
        r#"{"jsonrpc":"2.0","id":1,"method":"warmup"}"#, "\n",
        "this is not json\n",
        r#"{"jsonrpc":"2.0","id":2,"method":"annotate","params":{"prompt":"chart"}}"#, "\n",
        "{incomplete json\n",
        r#"{"jsonrpc":"2.0","id":3,"method":"warmup"}"#, "\n",
    );

    let output = Command::cargo_bin("pragma-sidecar")
        .unwrap()
        .write_stdin(input)
        .output()
        .expect("failed");

    let stdout = String::from_utf8_lossy(&output.stdout);
    let responses: Vec<Value> = stdout
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|l| serde_json::from_str(l).ok())
        .collect();

    // Valid requests get responses; malformed ones get error responses
    assert!(responses.len() >= 3, "Expected at least 3 responses");
}

#[test]
fn null_bytes_in_prompt_no_panic() {
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "annotate",
        "params": { "prompt": "chart\0data\0table" }
    });

    let responses = batch_requests(&[request]);
    assert_eq!(responses.len(), 1);
    assert!(responses[0]["error"].is_null() || responses[0]["result"].is_object());
}

#[test]
fn extremely_long_prompt_no_crash() {
    let long_prompt = "chart ".repeat(100_000); // ~600KB
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "annotate",
        "params": { "prompt": long_prompt }
    });

    let responses = batch_requests(&[request]);
    assert_eq!(responses.len(), 1);
}

#[test]
fn empty_params_object() {
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "annotate",
        "params": {}
    });

    let responses = batch_requests(&[request]);
    assert_eq!(responses.len(), 1);
    // Should be an error (missing prompt field)
    assert!(responses[0]["error"].is_object());
}

#[test]
fn wrong_param_types() {
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "annotate",
        "params": { "prompt": 12345 }
    });

    let responses = batch_requests(&[request]);
    assert_eq!(responses.len(), 1);
    assert!(responses[0]["error"].is_object());
}

#[test]
fn score_payload_too_large() {
    let huge = "x".repeat(3_000_000); // 3MB > 2MB limit
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "score",
        "params": { "reference": huge, "hypothesis": "short" }
    });

    let responses = batch_requests(&[request]);
    assert_eq!(responses.len(), 1);
    assert!(responses[0]["error"].is_object());
}

// ─── Tiered fallback (structural) ───────────────────────────────────

#[test]
fn annotate_without_models_returns_ok_not_error() {
    // Even without provisioned models, the FSM path works
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "annotate",
        "params": { "prompt": "show me a dashboard" }
    });

    let responses = batch_requests(&[request]);
    assert_eq!(responses.len(), 1);
    // Should be Ok (FSM doesn't need models)
    let tag = responses[0]["result"]["_tag"].as_str();
    assert_eq!(tag, Some("Ok"));
}
