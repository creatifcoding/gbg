//! pragma-sidecar: Snapshot regression for response format.

use assert_cmd::Command;
use serde_json::Value;

fn send(method: &str, params: Option<Value>) -> Value {
    let mut request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
    });
    if let Some(p) = params {
        request["params"] = p;
    }

    let input = format!("{}\n", serde_json::to_string(&request).unwrap());
    let output = Command::cargo_bin("pragma-sidecar")
        .unwrap()
        .write_stdin(input)
        .output()
        .expect("sidecar failed");

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.lines().next().unwrap()).unwrap()
}

#[test]
fn warmup_response_shape_snapshot() {
    let resp = send("warmup", None);
    // Redact variable fields
    let mut result = resp["result"].clone();
    if let Some(obj) = result.as_object_mut() {
        if let Some(val) = obj.get_mut("value") {
            if let Some(inner) = val.as_object_mut() {
                inner.remove("warnings");
            }
        }
    }
    insta::assert_json_snapshot!("sidecar_warmup_shape", result);
}

#[test]
fn annotate_data_response_shape_snapshot() {
    let resp = send("annotate", Some(serde_json::json!({"prompt": "show me a bar chart"})));
    let mut result = resp["result"]["value"].clone();
    if let Some(obj) = result.as_object_mut() {
        if let Some(sb) = obj.get_mut("sideband") {
            if let Some(inner) = sb.as_object_mut() {
                inner.insert("latency_ms".into(), "[redacted]".into());
            }
        }
    }
    insta::assert_json_snapshot!("sidecar_annotate_data_shape", {
        ".sideband.latency_ms" => "[latency]",
        ".prefix_block" => "[prefix]",
    }, result);
}

#[test]
fn annotate_idle_response_shape_snapshot() {
    let resp = send("annotate", Some(serde_json::json!({"prompt": "what is 2+2?"})));
    let result = resp["result"]["value"].clone();
    insta::assert_json_snapshot!("sidecar_annotate_idle_shape", {
        ".sideband.latency_ms" => "[latency]",
        ".prefix_block" => "[prefix]",
    }, result);
}

#[test]
fn score_response_shape_snapshot() {
    let resp = send("score", Some(serde_json::json!({
        "reference": "show me a chart",
        "hypothesis": "show me a chart"
    })));
    let result = resp["result"]["value"].clone();
    insta::assert_json_snapshot!("sidecar_score_identical_shape", {
        ".sideband.latency_ms" => "[latency]",
    }, result);
}

#[test]
fn error_response_shape_snapshot() {
    let resp = send("nonexistent_method", None);
    insta::assert_json_snapshot!("sidecar_error_unknown_method", {
        ".error.data" => "[data]",
    }, resp["error"].clone());
}
