//! Snapshot tests for pragma-ipc error code mapping.
//!
//! TESTING.md Tier 1 — error code exhaustiveness.
//!
//! These tests freeze the error code → message mapping so any
//! accidental change triggers a snapshot diff for review.

use pragma_ipc::errors;

#[test]
fn snapshot_all_error_codes() {
    // Build a stable representation of all error codes
    let codes: Vec<serde_json::Value> = errors::ALL_ERROR_CODES
        .iter()
        .map(|(code, name)| {
            serde_json::json!({
                "code": code,
                "name": name,
            })
        })
        .collect();

    insta::assert_json_snapshot!("all_error_codes", codes);
}

#[test]
fn snapshot_error_constructor_outputs() {
    let constructors = serde_json::json!({
        "parse_error": errors::parse_error("malformed JSON"),
        "method_not_found": errors::method_not_found("foobar"),
        "invalid_params": errors::invalid_params("missing 'prompt' field"),
        "internal_error": errors::internal_error("unexpected panic in handler"),
        "model_unavailable": errors::model_unavailable("all-MiniLM-L6-v2"),
        "model_corrupt": errors::model_corrupt("bert-base-uncased", "truncated at byte 50000"),
        "payload_too_large": errors::payload_too_large(2_000_000, 1_000_000),
    });

    insta::assert_json_snapshot!("error_constructor_outputs", constructors);
}

#[test]
fn error_code_count_is_stable() {
    // If someone adds a new error code, this test forces them to update
    // the snapshot above. Currently: 4 standard + 7 domain = 11 total.
    assert_eq!(
        errors::ALL_ERROR_CODES.len(),
        11,
        "Error code count changed! Update ALL_ERROR_CODES and regenerate snapshots."
    );
}
