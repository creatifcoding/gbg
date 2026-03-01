//! Error types and JSON-RPC error codes.
//!
//! Standard JSON-RPC codes + PRAGMA-specific domain codes.
//! Will be fully implemented in P1 task #3175.

/// Standard JSON-RPC 2.0 error codes.
pub mod codes {
    /// Invalid JSON received by the server.
    pub const PARSE_ERROR: i32 = -32700;
    /// The method does not exist / is not available.
    pub const METHOD_NOT_FOUND: i32 = -32601;
    /// Invalid method parameter(s).
    pub const INVALID_PARAMS: i32 = -32602;
    /// Internal JSON-RPC error.
    pub const INTERNAL_ERROR: i32 = -32603;
}

/// PRAGMA-specific domain error codes (application-level).
pub mod pragma_codes {
    /// Model not loaded or unavailable.
    pub const MODEL_UNAVAILABLE: i32 = -40001;
    /// Tokenization failed.
    pub const TOKENIZATION_FAILED: i32 = -40002;
    /// Inference timeout exceeded.
    pub const INFERENCE_TIMEOUT: i32 = -40003;
    /// Catalog embeddings stale / hash mismatch.
    pub const CATALOG_STALE: i32 = -40004;
}
