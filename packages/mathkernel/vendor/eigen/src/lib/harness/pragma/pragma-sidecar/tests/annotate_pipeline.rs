//! Integration tests for the full annotate pipeline (FSM → ambiguity → prefix).
//!
//! These tests exercise the sidecar binary end-to-end via stdin/stdout,
//! verifying that real FSM classification, ambiguity detection, and
//! prefix block generation are wired correctly.

use assert_cmd::Command;
use predicates::prelude::*;
use serde_json::Value;

/// Helper: send a JSON-RPC annotate request and parse the response.
fn annotate(prompt: &str) -> Value {
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "annotate",
        "params": {
            "prompt": prompt,
            "context": null
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

/// Extract the annotate response value from the JSON-RPC envelope.
fn extract_value(resp: &Value) -> &Value {
    &resp["result"]["value"]
}

// ─── Intent classification ──────────────────────────────────────────

#[test]
fn data_intent_for_chart_prompt() {
    let resp = annotate("show me a bar chart of monthly revenue data");
    let v = extract_value(&resp);
    assert_eq!(v["intent"]["type"], "DATA");
    assert_eq!(v["intent"]["tier_escalated"], false);
}

#[test]
fn form_intent_for_login_prompt() {
    let resp = annotate("create a login form with email and password input fields");
    let v = extract_value(&resp);
    assert_eq!(v["intent"]["type"], "FORM");
}

#[test]
fn layout_intent_for_dashboard_prompt() {
    let resp = annotate("build a dashboard with sidebar navigation and tabs");
    let v = extract_value(&resp);
    assert_eq!(v["intent"]["type"], "LAYOUT");
}

#[test]
fn feedback_intent_for_alert_prompt() {
    let resp = annotate("show an error alert with a warning banner notification");
    let v = extract_value(&resp);
    assert_eq!(v["intent"]["type"], "FEEDBACK");
}

#[test]
fn idle_for_non_ui_prompt() {
    let resp = annotate("explain the theory of relativity");
    let v = extract_value(&resp);
    assert_eq!(v["intent"]["type"], "IDLE");
    assert_eq!(v["intent"]["tier_escalated"], true);
}

#[test]
fn mixed_for_multi_intent_prompt() {
    let resp = annotate("create a dashboard with a login form and data chart visualization");
    let v = extract_value(&resp);
    assert_eq!(v["intent"]["type"], "MIXED");
    assert_eq!(v["intent"]["tier_escalated"], true);
}

// ─── Disambiguation ─────────────────────────────────────────────────

#[test]
fn mixed_produces_disambiguation_entries() {
    let resp = annotate("create a dashboard with a login form and data chart visualization");
    let v = extract_value(&resp);
    let disambiguation = v["disambiguation"].as_array().unwrap();
    assert!(!disambiguation.is_empty(), "Mixed intent should produce disambiguation entries");
}

#[test]
fn idle_may_produce_disambiguation() {
    // Idle with weak signals should produce ambiguity entries
    let resp = annotate("show me some information about the display");
    let v = extract_value(&resp);
    // May or may not have disambiguation depending on weak signals — just verify it's an array
    assert!(v["disambiguation"].is_array());
}

// ─── Prefix block ───────────────────────────────────────────────────

#[test]
fn prefix_block_is_fenced_json() {
    let resp = annotate("show me a table of metrics");
    let v = extract_value(&resp);
    let prefix = v["prefix_block"].as_str().unwrap();
    assert!(prefix.starts_with("```generation-context\n"), "prefix should start with fence");
    assert!(prefix.ends_with("\n```"), "prefix should end with fence");
}

#[test]
fn prefix_block_contains_intent() {
    let resp = annotate("show me a bar chart of data");
    let v = extract_value(&resp);
    let prefix = v["prefix_block"].as_str().unwrap();
    assert!(prefix.contains("\"Data\""), "prefix should contain intent type");
}

#[test]
fn prefix_block_contains_confidence() {
    let resp = annotate("create a form with input fields");
    let v = extract_value(&resp);
    let prefix = v["prefix_block"].as_str().unwrap();
    assert!(prefix.contains("confidence"), "prefix should contain confidence");
}

// ─── Hints ──────────────────────────────────────────────────────────

#[test]
fn hints_temperature_varies_with_confidence() {
    // High confidence → lower temperature
    let data_resp = annotate("show me a chart graph with data table and metrics visualization plot");
    let data_v = extract_value(&data_resp);
    let data_temp = data_v["hints"]["temperature"].as_f64().unwrap();

    // Low confidence (idle) → higher temperature
    let idle_resp = annotate("tell me about weather");
    let idle_v = extract_value(&idle_resp);
    let idle_temp = idle_v["hints"]["temperature"].as_f64().unwrap();

    assert!(
        idle_temp >= data_temp,
        "Idle temperature ({idle_temp}) should be >= Data temperature ({data_temp})"
    );
}

#[test]
fn hints_note_is_populated() {
    let resp = annotate("show me a chart");
    let v = extract_value(&resp);
    let note = v["hints"]["note"].as_str().unwrap();
    assert!(!note.is_empty(), "hints note should be populated");
}

// ─── Sideband telemetry ─────────────────────────────────────────────

#[test]
fn sideband_has_latency() {
    let resp = annotate("show me a chart");
    let v = extract_value(&resp);
    let latency = v["sideband"]["latency_ms"].as_f64().unwrap();
    assert!(latency >= 0.0, "latency should be non-negative");
    assert!(latency < 100.0, "FSM-only latency should be <100ms, got {latency}");
}

#[test]
fn sideband_models_used() {
    let resp = annotate("show me a chart");
    let v = extract_value(&resp);
    let models = v["sideband"]["models_used"].as_array().unwrap();
    assert!(!models.is_empty(), "should report at least one model used");
}

// ─── DomainResult envelope ──────────────────────────────────────────

#[test]
fn response_is_domain_result_ok() {
    let resp = annotate("show me a chart");
    assert_eq!(resp["result"]["_tag"], "Ok");
}

#[test]
fn error_params_returns_json_rpc_error() {
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "annotate",
        "params": { "wrong_field": true }
    });

    let input = format!("{}\n", serde_json::to_string(&request).unwrap());

    let output = Command::cargo_bin("pragma-sidecar")
        .unwrap()
        .write_stdin(input)
        .output()
        .expect("failed to run sidecar");

    let stdout = String::from_utf8_lossy(&output.stdout);
    let resp: Value = serde_json::from_str(stdout.lines().next().unwrap()).unwrap();
    assert!(resp["error"].is_object(), "should return JSON-RPC error for bad params");
    assert_eq!(resp["error"]["code"], -32602); // Invalid params
}

// ─── Edge cases ─────────────────────────────────────────────────────

#[test]
fn empty_prompt_returns_idle() {
    let resp = annotate("");
    let v = extract_value(&resp);
    assert_eq!(v["intent"]["type"], "IDLE");
}

#[test]
fn very_long_prompt_within_limit() {
    let long_prompt = "chart ".repeat(10_000); // ~60KB, under 1MB limit
    let resp = annotate(&long_prompt);
    let v = extract_value(&resp);
    // Should not error, should classify
    assert!(v["intent"]["type"].is_string());
}

#[test]
fn unicode_prompt_works() {
    let resp = annotate("表示するチャートとメトリクスのダッシュボード");
    let v = extract_value(&resp);
    // May be Idle (no English keywords) or detect something — just shouldn't crash
    assert!(v["intent"]["type"].is_string());
}
