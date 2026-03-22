//! assert_cmd integration tests for pragma-sidecar binary.
//!
//! TESTING.md Tier 1 — sidecar cold-start and shutdown smoke test.
//!
//! These tests spawn the actual binary, send JSON-RPC over stdin,
//! read JSON-RPC from stdout, and verify behavior.

use assert_cmd::Command;
use predicates::prelude::*;

fn sidecar_cmd() -> Command {
    Command::cargo_bin("pragma-sidecar").expect("pragma-sidecar binary must exist")
}

#[test]
fn clean_shutdown_on_shutdown_method() {
    let mut cmd = sidecar_cmd();
    cmd.write_stdin(r#"{"jsonrpc":"2.0","id":1,"method":"shutdown"}"#)
        .assert()
        .success()
        .stdout(predicate::str::contains(r#""shutdown":true"#));
}

#[test]
fn clean_exit_on_eof() {
    // Empty stdin → EOF → exit 0
    let mut cmd = sidecar_cmd();
    cmd.write_stdin("")
        .assert()
        .success()
        .stdout(predicate::str::is_empty());
}

#[test]
fn warmup_returns_ready_false_stub() {
    let input = concat!(
        r#"{"jsonrpc":"2.0","id":1,"method":"warmup"}"#,
        "\n",
        r#"{"jsonrpc":"2.0","id":99,"method":"shutdown"}"#,
    );
    let mut cmd = sidecar_cmd();
    cmd.write_stdin(input)
        .assert()
        .success()
        .stdout(predicate::str::contains(r#""ready":false"#));
}

#[test]
fn annotate_returns_domain_result() {
    let input = concat!(
        r#"{"jsonrpc":"2.0","id":1,"method":"annotate","params":{"prompt":"show dashboard"}}"#,
        "\n",
        r#"{"jsonrpc":"2.0","id":99,"method":"shutdown"}"#,
    );
    let mut cmd = sidecar_cmd();
    cmd.write_stdin(input)
        .assert()
        .success()
        .stdout(predicate::str::contains(r#""_tag":"Ok""#))
        .stdout(predicate::str::contains(r#""intent""#))
        .stdout(predicate::str::contains(r#""candidates""#))
        .stdout(predicate::str::contains(r#""sideband""#));
}

#[test]
fn score_returns_bertscore_fields() {
    let input = concat!(
        r#"{"jsonrpc":"2.0","id":1,"method":"score","params":{"reference":"hello","hypothesis":"world"}}"#,
        "\n",
        r#"{"jsonrpc":"2.0","id":99,"method":"shutdown"}"#,
    );
    let mut cmd = sidecar_cmd();
    cmd.write_stdin(input)
        .assert()
        .success()
        .stdout(predicate::str::contains(r#""bertscore""#))
        .stdout(predicate::str::contains(r#""precision""#))
        .stdout(predicate::str::contains(r#""recall""#))
        .stdout(predicate::str::contains(r#""f1""#))
        .stdout(predicate::str::contains(r#""drift_delta""#));
}

#[test]
fn unknown_method_returns_error() {
    let input = concat!(
        r#"{"jsonrpc":"2.0","id":1,"method":"nonexistent"}"#,
        "\n",
        r#"{"jsonrpc":"2.0","id":99,"method":"shutdown"}"#,
    );
    let mut cmd = sidecar_cmd();
    cmd.write_stdin(input)
        .assert()
        .success()
        .stdout(predicate::str::contains("-32601"))
        .stdout(predicate::str::contains("Method not found"));
}

#[test]
fn malformed_json_returns_parse_error() {
    let input = concat!(
        "not valid json at all\n",
        r#"{"jsonrpc":"2.0","id":99,"method":"shutdown"}"#,
    );
    let mut cmd = sidecar_cmd();
    cmd.write_stdin(input)
        .assert()
        .success()
        .stdout(predicate::str::contains("-32700"))
        .stdout(predicate::str::contains("Parse error"));
}

#[test]
fn annotate_missing_params_returns_invalid_params() {
    let input = concat!(
        r#"{"jsonrpc":"2.0","id":1,"method":"annotate"}"#,
        "\n",
        r#"{"jsonrpc":"2.0","id":99,"method":"shutdown"}"#,
    );
    let mut cmd = sidecar_cmd();
    cmd.write_stdin(input)
        .assert()
        .success()
        .stdout(predicate::str::contains("-32602"))
        .stdout(predicate::str::contains("Invalid params"));
}

#[test]
fn blank_lines_ignored() {
    let input = concat!(
        "\n",
        "  \n",
        "\t\n",
        r#"{"jsonrpc":"2.0","id":1,"method":"warmup"}"#,
        "\n",
        "\n",
        r#"{"jsonrpc":"2.0","id":99,"method":"shutdown"}"#,
    );
    let mut cmd = sidecar_cmd();
    let output = cmd.write_stdin(input).assert().success();
    // Should produce exactly 2 responses (warmup + shutdown), not errors for blanks
    let stdout = String::from_utf8(output.get_output().stdout.clone()).unwrap();
    let lines: Vec<&str> = stdout.lines().collect();
    assert_eq!(lines.len(), 2, "Expected 2 responses, got {}: {:?}", lines.len(), lines);
}

#[test]
fn multiple_requests_sequential() {
    let input = concat!(
        r#"{"jsonrpc":"2.0","id":1,"method":"warmup"}"#, "\n",
        r#"{"jsonrpc":"2.0","id":2,"method":"annotate","params":{"prompt":"test"}}"#, "\n",
        r#"{"jsonrpc":"2.0","id":3,"method":"score","params":{"reference":"a","hypothesis":"b"}}"#, "\n",
        r#"{"jsonrpc":"2.0","id":99,"method":"shutdown"}"#,
    );
    let mut cmd = sidecar_cmd();
    let output = cmd.write_stdin(input).assert().success();
    let stdout = String::from_utf8(output.get_output().stdout.clone()).unwrap();
    let lines: Vec<&str> = stdout.lines().collect();
    assert_eq!(lines.len(), 4, "Expected 4 responses");

    // Verify IDs are in order
    for (i, line) in lines.iter().enumerate() {
        let resp: serde_json::Value = serde_json::from_str(line).unwrap();
        let expected_id = if i == 3 { 99 } else { (i + 1) as u64 };
        assert_eq!(resp["id"], expected_id, "Response {i} has wrong id");
    }
}

#[test]
fn each_response_is_valid_json_and_newline_terminated() {
    let input = concat!(
        r#"{"jsonrpc":"2.0","id":1,"method":"warmup"}"#, "\n",
        r#"{"jsonrpc":"2.0","id":99,"method":"shutdown"}"#,
    );
    let mut cmd = sidecar_cmd();
    let output = cmd.write_stdin(input).assert().success();
    let stdout = String::from_utf8(output.get_output().stdout.clone()).unwrap();

    // Stdout should end with a newline
    assert!(stdout.ends_with('\n'), "stdout must end with newline");

    // Each line must be valid JSON
    for line in stdout.lines() {
        let parsed: Result<serde_json::Value, _> = serde_json::from_str(line);
        assert!(parsed.is_ok(), "Line is not valid JSON: {line}");

        // And must have jsonrpc field
        let val = parsed.unwrap();
        assert_eq!(val["jsonrpc"], "2.0");
    }
}
