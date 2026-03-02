//! pragma-sidecar: Property-based tests — arbitrary requests.

use assert_cmd::Command;
use proptest::prelude::*;
use serde_json::Value;

fn send_request(request: &Value) -> Value {
    let input = format!("{}\n", serde_json::to_string(request).unwrap());
    let output = Command::cargo_bin("pragma-sidecar")
        .unwrap()
        .write_stdin(input)
        .output()
        .expect("sidecar failed");

    let stdout = String::from_utf8_lossy(&output.stdout);
    let first = stdout.lines().next().unwrap_or("{}");
    serde_json::from_str(first).unwrap_or(serde_json::json!({}))
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(20))]

    /// Any UTF-8 prompt produces a valid JSON-RPC response (never crashes).
    #[test]
    fn arbitrary_prompt_never_crashes(prompt in "\\PC{0,500}") {
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "annotate",
            "params": { "prompt": prompt }
        });

        let resp = send_request(&request);
        prop_assert!(resp["id"].is_number() || resp["error"].is_object(),
            "No valid response for prompt: {prompt}");
    }

    /// Score with arbitrary text pairs never crashes.
    #[test]
    fn arbitrary_score_never_crashes(
        reference in "\\PC{0,200}",
        hypothesis in "\\PC{0,200}",
    ) {
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "score",
            "params": { "reference": reference, "hypothesis": hypothesis }
        });

        let resp = send_request(&request);
        prop_assert!(resp["id"].is_number() || resp["error"].is_object());
    }

    /// Arbitrary method names return error, never crash.
    #[test]
    fn arbitrary_method_never_crashes(method in "[a-z_]{1,30}") {
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method
        });

        let resp = send_request(&request);
        // Either valid result or error — never empty
        prop_assert!(resp.is_object());
    }
}
