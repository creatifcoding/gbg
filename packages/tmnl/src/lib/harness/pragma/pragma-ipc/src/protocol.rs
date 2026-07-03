//! JSON-RPC 2.0 protocol layer for PRAGMA sidecar communication.
//!
//! Newline-delimited JSON over stdin/stdout. Each line is one complete
//! JSON-RPC request or response. Tauri manages sidecar lifecycle.

use serde::{Deserialize, Serialize};

/// JSON-RPC 2.0 version constant.
pub const JSONRPC_VERSION: &str = "2.0";

// ─── Request ────────────────────────────────────────────────────────

/// A JSON-RPC 2.0 request from the harness to the sidecar.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: u64,
    pub method: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

impl JsonRpcRequest {
    /// Create a new request with the given method and params.
    pub fn new(id: u64, method: impl Into<String>, params: Option<serde_json::Value>) -> Self {
        Self {
            jsonrpc: JSONRPC_VERSION.to_string(),
            id,
            method: method.into(),
            params,
        }
    }

    /// Create a warmup request.
    pub fn warmup(id: u64) -> Self {
        Self::new(id, "warmup", None)
    }

    /// Create an annotate request with a prompt.
    pub fn annotate(id: u64, prompt: &str) -> Self {
        Self::new(
            id,
            "annotate",
            Some(serde_json::json!({ "prompt": prompt })),
        )
    }

    /// Create a score request with reference and hypothesis texts.
    pub fn score(id: u64, reference: &str, hypothesis: &str) -> Self {
        Self::new(
            id,
            "score",
            Some(serde_json::json!({
                "reference": reference,
                "hypothesis": hypothesis,
            })),
        )
    }

    /// Create a shutdown request.
    pub fn shutdown(id: u64) -> Self {
        Self::new(id, "shutdown", None)
    }
}

// ─── Response ───────────────────────────────────────────────────────

/// A JSON-RPC 2.0 response from the sidecar to the harness.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

impl JsonRpcResponse {
    /// Create a success response.
    pub fn success(id: u64, result: serde_json::Value) -> Self {
        Self {
            jsonrpc: JSONRPC_VERSION.to_string(),
            id,
            result: Some(result),
            error: None,
        }
    }

    /// Create an error response.
    pub fn error(id: u64, code: i32, message: impl Into<String>) -> Self {
        Self {
            jsonrpc: JSONRPC_VERSION.to_string(),
            id,
            result: None,
            error: Some(JsonRpcError {
                code,
                message: message.into(),
                data: None,
            }),
        }
    }

    /// Create an error response with additional data.
    pub fn error_with_data(
        id: u64,
        code: i32,
        message: impl Into<String>,
        data: serde_json::Value,
    ) -> Self {
        Self {
            jsonrpc: JSONRPC_VERSION.to_string(),
            id,
            result: None,
            error: Some(JsonRpcError {
                code,
                message: message.into(),
                data: Some(data),
            }),
        }
    }

    /// Whether this response is an error.
    pub fn is_error(&self) -> bool {
        self.error.is_some()
    }
}

/// A JSON-RPC 2.0 error object.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

// ─── Method Dispatch ────────────────────────────────────────────────

/// Methods available on the PRAGMA sidecar.
///
/// Each variant maps to a JSON-RPC method string.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Method {
    /// Initialize models, load embeddings, warm up inference. First call after spawn.
    Warmup,
    /// Annotate a prompt: classify intent, rank catalog candidates, emit prefix block.
    Annotate,
    /// Score a generation: BERTScore fidelity, BLEURT quality, drift delta.
    Score,
    /// Graceful shutdown. Sidecar exits after responding.
    Shutdown,
}

impl Method {
    /// Parse a method string into a Method enum.
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "warmup" => Some(Self::Warmup),
            "annotate" => Some(Self::Annotate),
            "score" => Some(Self::Score),
            "shutdown" => Some(Self::Shutdown),
            _ => None,
        }
    }

    /// Get the JSON-RPC method string.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Warmup => "warmup",
            Self::Annotate => "annotate",
            Self::Score => "score",
            Self::Shutdown => "shutdown",
        }
    }
}

// ─── Line Protocol ──────────────────────────────────────────────────

/// Parse a single newline-delimited JSON-RPC request from a line.
pub fn parse_request(line: &str) -> Result<JsonRpcRequest, JsonRpcError> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Err(JsonRpcError {
            code: super::errors::codes::PARSE_ERROR,
            message: "Empty line".to_string(),
            data: None,
        });
    }

    serde_json::from_str::<JsonRpcRequest>(trimmed).map_err(|e| JsonRpcError {
        code: super::errors::codes::PARSE_ERROR,
        message: format!("Parse error: {e}"),
        data: Some(serde_json::json!({
            "input_preview": &trimmed[..trimmed.len().min(200)]
        })),
    })
}

/// Serialize a JSON-RPC response to a newline-terminated string.
pub fn serialize_response(response: &JsonRpcResponse) -> String {
    let mut s = serde_json::to_string(response).expect("JsonRpcResponse is always serializable");
    s.push('\n');
    s
}

// ─── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_serde_roundtrip() {
        let req = JsonRpcRequest::annotate(42, "show me a dashboard");
        let json = serde_json::to_string(&req).unwrap();
        let parsed: JsonRpcRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(req, parsed);
    }

    #[test]
    fn response_success_roundtrip() {
        let resp = JsonRpcResponse::success(1, serde_json::json!({"ok": true}));
        let json = serde_json::to_string(&resp).unwrap();
        let parsed: JsonRpcResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(resp, parsed);
        assert!(!parsed.is_error());
    }

    #[test]
    fn response_error_roundtrip() {
        let resp = JsonRpcResponse::error(1, -32700, "Parse error");
        let json = serde_json::to_string(&resp).unwrap();
        let parsed: JsonRpcResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(resp, parsed);
        assert!(parsed.is_error());
    }

    #[test]
    fn method_parse_all_variants() {
        assert_eq!(Method::from_str("warmup"), Some(Method::Warmup));
        assert_eq!(Method::from_str("annotate"), Some(Method::Annotate));
        assert_eq!(Method::from_str("score"), Some(Method::Score));
        assert_eq!(Method::from_str("shutdown"), Some(Method::Shutdown));
        assert_eq!(Method::from_str("unknown"), None);
        assert_eq!(Method::from_str(""), None);
    }

    #[test]
    fn method_roundtrip_str() {
        for m in [
            Method::Warmup,
            Method::Annotate,
            Method::Score,
            Method::Shutdown,
        ] {
            assert_eq!(Method::from_str(m.as_str()), Some(m));
        }
    }

    #[test]
    fn parse_request_valid() {
        let line = r#"{"jsonrpc":"2.0","id":1,"method":"warmup"}"#;
        let req = parse_request(line).unwrap();
        assert_eq!(req.method, "warmup");
        assert_eq!(req.id, 1);
    }

    #[test]
    fn parse_request_empty_line() {
        let err = parse_request("").unwrap_err();
        assert_eq!(err.code, super::super::errors::codes::PARSE_ERROR);
    }

    #[test]
    fn parse_request_garbage() {
        let err = parse_request("not json at all").unwrap_err();
        assert_eq!(err.code, super::super::errors::codes::PARSE_ERROR);
        assert!(err.data.is_some()); // includes input_preview
    }

    #[test]
    fn serialize_response_newline_terminated() {
        let resp = JsonRpcResponse::success(1, serde_json::json!(null));
        let s = serialize_response(&resp);
        assert!(s.ends_with('\n'));
        assert_eq!(s.matches('\n').count(), 1); // exactly one newline at end
    }

    #[test]
    fn request_factory_methods() {
        let w = JsonRpcRequest::warmup(1);
        assert_eq!(w.method, "warmup");
        assert!(w.params.is_none());

        let a = JsonRpcRequest::annotate(2, "show dashboard");
        assert_eq!(a.method, "annotate");
        assert!(a.params.is_some());

        let s = JsonRpcRequest::score(3, "ref text", "hyp text");
        assert_eq!(s.method, "score");
        let params = s.params.unwrap();
        assert_eq!(params["reference"], "ref text");
        assert_eq!(params["hypothesis"], "hyp text");

        let sh = JsonRpcRequest::shutdown(4);
        assert_eq!(sh.method, "shutdown");
    }
}
