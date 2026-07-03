//! Integration tests for the score pipeline (BERTScore + BLEURT + drift).

use assert_cmd::Command;
use serde_json::Value;

/// Helper: send a JSON-RPC score request and parse the response.
fn score(reference: &str, hypothesis: &str) -> Value {
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "score",
        "params": {
            "reference": reference,
            "hypothesis": hypothesis
        }
    });

    let input = format!("{}\n", serde_json::to_string(&request).unwrap());

    let output = Command::cargo_bin("pragma-sidecar")
        .unwrap()
        .write_stdin(input)
        .output()
        .expect("failed to run sidecar");

    let stdout = String::from_utf8_lossy(&output.stdout);
    let first_line = stdout.lines().next().expect("no output");
    serde_json::from_str(first_line).expect("invalid JSON response")
}

fn extract_value(resp: &Value) -> &Value {
    &resp["result"]["value"]
}

// ─── BERTScore structure ────────────────────────────────────────────

#[test]
fn identical_text_high_f1() {
    let resp = score(
        "show me a dashboard with metrics",
        "show me a dashboard with metrics",
    );
    let v = extract_value(&resp);
    let f1 = v["bertscore"]["f1"].as_f64().unwrap();
    assert!(
        (f1 - 1.0).abs() < 1e-6,
        "Identical text should have F1=1.0, got {f1}"
    );
}

#[test]
fn different_text_lower_f1() {
    let resp = score(
        "show me a dashboard with metrics",
        "create a login form with email",
    );
    let v = extract_value(&resp);
    let f1 = v["bertscore"]["f1"].as_f64().unwrap();
    assert!(f1 < 1.0, "Different text should have F1 < 1.0, got {f1}");
}

#[test]
fn bertscore_has_precision_recall_f1() {
    let resp = score("hello world", "hello earth");
    let v = extract_value(&resp);
    assert!(v["bertscore"]["precision"].is_number());
    assert!(v["bertscore"]["recall"].is_number());
    assert!(v["bertscore"]["f1"].is_number());
}

#[test]
fn bertscore_values_in_range() {
    let resp = score("a chart of data metrics", "a graph showing values");
    let v = extract_value(&resp);
    let p = v["bertscore"]["precision"].as_f64().unwrap();
    let r = v["bertscore"]["recall"].as_f64().unwrap();
    let f1 = v["bertscore"]["f1"].as_f64().unwrap();
    assert!((0.0..=1.0).contains(&p), "Precision out of range: {p}");
    assert!((0.0..=1.0).contains(&r), "Recall out of range: {r}");
    assert!((0.0..=1.0).contains(&f1), "F1 out of range: {f1}");
}

// ─── Drift delta ────────────────────────────────────────────────────

#[test]
fn drift_delta_zero_for_identical() {
    let resp = score("show metrics dashboard", "show metrics dashboard");
    let v = extract_value(&resp);
    let drift = v["drift_delta"].as_f64().unwrap();
    assert!(
        drift.abs() < 1e-6,
        "Identical text should have drift ~0, got {drift}"
    );
}

#[test]
fn drift_delta_positive_for_different() {
    let resp = score("show metrics dashboard", "create login form");
    let v = extract_value(&resp);
    let drift = v["drift_delta"].as_f64().unwrap();
    assert!(
        drift > 0.0,
        "Different text should have positive drift, got {drift}"
    );
}

// ─── BLEURT ─────────────────────────────────────────────────────────

#[test]
fn bleurt_null_when_not_provisioned() {
    let resp = score("hello", "world");
    let v = extract_value(&resp);
    // BLEURT is None/null until ort session is wired
    assert!(
        v["bleurt"].is_null(),
        "BLEURT should be null when not provisioned"
    );
}

// ─── Sideband ───────────────────────────────────────────────────────

#[test]
fn sideband_latency_present() {
    let resp = score("test reference", "test hypothesis");
    let v = extract_value(&resp);
    let latency = v["sideband"]["latency_ms"].as_f64().unwrap();
    assert!(latency >= 0.0);
    assert!(
        latency < 50.0,
        "Token-overlap scoring should be <50ms, got {latency}"
    );
}

#[test]
fn sideband_models_used_present() {
    let resp = score("test", "test");
    let v = extract_value(&resp);
    let models = v["sideband"]["models_used"].as_array().unwrap();
    assert!(!models.is_empty());
}

// ─── DomainResult envelope ──────────────────────────────────────────

#[test]
fn response_is_ok() {
    let resp = score("hello", "hello");
    assert_eq!(resp["result"]["_tag"], "Ok");
}

// ─── Edge cases ─────────────────────────────────────────────────────

#[test]
fn empty_reference_zero_scores() {
    let resp = score("", "some hypothesis");
    let v = extract_value(&resp);
    let f1 = v["bertscore"]["f1"].as_f64().unwrap();
    assert!(f1.abs() < 1e-6, "Empty reference should give F1=0");
}

#[test]
fn empty_hypothesis_zero_scores() {
    let resp = score("some reference", "");
    let v = extract_value(&resp);
    let f1 = v["bertscore"]["f1"].as_f64().unwrap();
    assert!(f1.abs() < 1e-6, "Empty hypothesis should give F1=0");
}

#[test]
fn partial_overlap_intermediate_f1() {
    let resp = score(
        "show me a dashboard with data charts",
        "show me a form with data fields",
    );
    let v = extract_value(&resp);
    let f1 = v["bertscore"]["f1"].as_f64().unwrap();
    assert!(
        f1 > 0.0 && f1 < 1.0,
        "Partial overlap should give 0 < F1 < 1, got {f1}"
    );
}

#[test]
fn error_on_missing_params() {
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "score",
        "params": { "wrong": true }
    });
    let input = format!("{}\n", serde_json::to_string(&request).unwrap());
    let output = Command::cargo_bin("pragma-sidecar")
        .unwrap()
        .write_stdin(input)
        .output()
        .expect("failed");
    let stdout = String::from_utf8_lossy(&output.stdout);
    let resp: Value = serde_json::from_str(stdout.lines().next().unwrap()).unwrap();
    assert_eq!(resp["error"]["code"], -32602);
}
