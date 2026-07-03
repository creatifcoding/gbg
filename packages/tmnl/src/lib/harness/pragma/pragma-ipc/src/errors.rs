//! Error types and JSON-RPC error codes for PRAGMA sidecar.
//!
//! Two tiers:
//! - **Protocol errors**: Standard JSON-RPC 2.0 codes (-327xx).
//!   These indicate transport/framing failures.
//! - **Domain errors**: PRAGMA-specific codes (-400xx).
//!   These indicate application-level failures.
//!
//! See: TESTING.md Tier 1 (error code mapping completeness).

use crate::protocol::JsonRpcError;

// ─── Standard JSON-RPC 2.0 Error Codes ─────────────────────────────

pub mod codes {
    /// Invalid JSON received by the server.
    /// Triggered by: malformed JSON, partial writes, binary garbage.
    pub const PARSE_ERROR: i32 = -32700;

    /// The method does not exist / is not available.
    /// Triggered by: unknown method string in request.
    pub const METHOD_NOT_FOUND: i32 = -32601;

    /// Invalid method parameter(s).
    /// Triggered by: missing required params, wrong types.
    pub const INVALID_PARAMS: i32 = -32602;

    /// Internal JSON-RPC error.
    /// Triggered by: unexpected panics, unhandled error paths.
    pub const INTERNAL_ERROR: i32 = -32603;
}

// ─── PRAGMA Domain Error Codes ──────────────────────────────────────

pub mod pragma_codes {
    /// Primary model (MiniLM) not loaded or unavailable.
    /// Fatal — sidecar cannot function without the primary encoder.
    pub const MODEL_UNAVAILABLE: i32 = -40001;

    /// Tokenization failed (tokenizer.json corrupt, encoding error).
    pub const TOKENIZATION_FAILED: i32 = -40002;

    /// Inference timeout exceeded.
    /// Hard gate: annotation < 100ms, scoring < 50ms.
    pub const INFERENCE_TIMEOUT: i32 = -40003;

    /// Catalog embeddings stale (catalog hash mismatch).
    /// Sidecar should recompute, but reports this as a warning.
    pub const CATALOG_STALE: i32 = -40004;

    /// Model file corrupt or truncated.
    /// Detected during load: random bytes, truncated file, wrong format.
    pub const MODEL_CORRUPT: i32 = -40005;

    /// Embedding dimension mismatch.
    /// Expected 384 (MiniLM) or 768 (bert-base), got something else.
    pub const DIMENSION_MISMATCH: i32 = -40006;

    /// Request payload too large.
    /// Prompt or output text exceeds safe processing limit (>1MB).
    pub const PAYLOAD_TOO_LARGE: i32 = -40007;
}

// ─── Error Constructors ─────────────────────────────────────────────

/// Create a parse error (malformed JSON input).
pub fn parse_error(detail: impl Into<String>) -> JsonRpcError {
    JsonRpcError {
        code: codes::PARSE_ERROR,
        message: "Parse error".to_string(),
        data: Some(serde_json::json!({ "detail": detail.into() })),
    }
}

/// Create a method-not-found error.
pub fn method_not_found(method: &str) -> JsonRpcError {
    JsonRpcError {
        code: codes::METHOD_NOT_FOUND,
        message: format!("Method not found: {method}"),
        data: None,
    }
}

/// Create an invalid-params error.
pub fn invalid_params(detail: impl Into<String>) -> JsonRpcError {
    JsonRpcError {
        code: codes::INVALID_PARAMS,
        message: "Invalid params".to_string(),
        data: Some(serde_json::json!({ "detail": detail.into() })),
    }
}

/// Create an internal error.
pub fn internal_error(detail: impl Into<String>) -> JsonRpcError {
    JsonRpcError {
        code: codes::INTERNAL_ERROR,
        message: "Internal error".to_string(),
        data: Some(serde_json::json!({ "detail": detail.into() })),
    }
}

/// Create a model-unavailable domain error.
pub fn model_unavailable(model: &str) -> JsonRpcError {
    JsonRpcError {
        code: pragma_codes::MODEL_UNAVAILABLE,
        message: format!("Model unavailable: {model}"),
        data: None,
    }
}

/// Create a model-corrupt domain error.
pub fn model_corrupt(model: &str, detail: impl Into<String>) -> JsonRpcError {
    JsonRpcError {
        code: pragma_codes::MODEL_CORRUPT,
        message: format!("Model corrupt: {model}"),
        data: Some(serde_json::json!({ "detail": detail.into() })),
    }
}

/// Create a payload-too-large domain error.
pub fn payload_too_large(size_bytes: usize, max_bytes: usize) -> JsonRpcError {
    JsonRpcError {
        code: pragma_codes::PAYLOAD_TOO_LARGE,
        message: format!("Payload too large: {size_bytes} bytes (max {max_bytes})"),
        data: None,
    }
}

// ─── All Codes (for snapshot testing) ───────────────────────────────

/// All standard + domain error codes for exhaustive snapshot testing.
pub const ALL_ERROR_CODES: &[(i32, &str)] = &[
    (codes::PARSE_ERROR, "Parse error"),
    (codes::METHOD_NOT_FOUND, "Method not found"),
    (codes::INVALID_PARAMS, "Invalid params"),
    (codes::INTERNAL_ERROR, "Internal error"),
    (pragma_codes::MODEL_UNAVAILABLE, "Model unavailable"),
    (pragma_codes::TOKENIZATION_FAILED, "Tokenization failed"),
    (pragma_codes::INFERENCE_TIMEOUT, "Inference timeout"),
    (pragma_codes::CATALOG_STALE, "Catalog stale"),
    (pragma_codes::MODEL_CORRUPT, "Model corrupt"),
    (pragma_codes::DIMENSION_MISMATCH, "Dimension mismatch"),
    (pragma_codes::PAYLOAD_TOO_LARGE, "Payload too large"),
];

// ─── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_error_codes_unique() {
        let codes: Vec<i32> = ALL_ERROR_CODES.iter().map(|(c, _)| *c).collect();
        let mut deduped = codes.clone();
        deduped.sort();
        deduped.dedup();
        assert_eq!(codes.len(), deduped.len(), "Duplicate error codes detected");
    }

    #[test]
    fn all_error_codes_in_correct_range() {
        for (code, name) in ALL_ERROR_CODES {
            assert!(
                *code < 0,
                "Error code for '{name}' should be negative, got {code}"
            );
        }
    }

    #[test]
    fn standard_codes_in_json_rpc_range() {
        // JSON-RPC standard: -32000 to -32099 server, -32600 to -32700 predefined
        for (code, name) in ALL_ERROR_CODES.iter().take(4) {
            assert!(
                (-32700..=-32600).contains(code),
                "Standard code for '{name}' = {code} not in JSON-RPC range"
            );
        }
    }

    #[test]
    fn domain_codes_in_pragma_range() {
        for (code, name) in ALL_ERROR_CODES.iter().skip(4) {
            assert!(
                (-40099..=-40001).contains(code),
                "Domain code for '{name}' = {code} not in PRAGMA range"
            );
        }
    }

    #[test]
    fn error_constructors_produce_correct_codes() {
        assert_eq!(parse_error("test").code, codes::PARSE_ERROR);
        assert_eq!(method_not_found("test").code, codes::METHOD_NOT_FOUND);
        assert_eq!(invalid_params("test").code, codes::INVALID_PARAMS);
        assert_eq!(internal_error("test").code, codes::INTERNAL_ERROR);
        assert_eq!(
            model_unavailable("test").code,
            pragma_codes::MODEL_UNAVAILABLE
        );
        assert_eq!(
            model_corrupt("test", "test").code,
            pragma_codes::MODEL_CORRUPT
        );
        assert_eq!(
            payload_too_large(100, 50).code,
            pragma_codes::PAYLOAD_TOO_LARGE
        );
    }

    #[test]
    fn error_constructors_include_detail_data() {
        let e = parse_error("bad json");
        assert!(e.data.is_some());
        assert!(e.data.unwrap().to_string().contains("bad json"));

        let e = model_corrupt("MiniLM", "truncated at 50%");
        assert!(e.data.is_some());
        assert!(e.data.unwrap().to_string().contains("truncated"));
    }

    #[test]
    fn method_not_found_includes_method_name() {
        let e = method_not_found("foobar");
        assert!(e.message.contains("foobar"));
        assert!(e.data.is_none()); // no extra data needed
    }
}
