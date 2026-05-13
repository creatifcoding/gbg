//! Integration tests for the full annotation pipeline via sidecar binary.
//!
//! Exercises: FSM classification → ambiguity analysis → prefix block generation
//! through the JSON-RPC interface.

use assert_cmd::Command;
use serde_json::Value;

fn sidecar() -> Command {
    Command::cargo_bin("pragma-sidecar").unwrap()
}

fn annot