//! Error types and RFC 9457 Problem Details.

use std::fmt;

/// Application error type for ava-web handlers.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    /// 400 Bad Request
    #[error("bad request: {0}")]
    BadRequest(String),

    /// 401 Unauthorized
    #[error("unauthorized: {0}")]
    Unauthorized(String),

    /// 403 Forbidden
    #[error("forbidden: {0}")]
    Forbidden(String),

    /// 404 Not Found
    #[error("not found: {0}")]
    NotFound(String),

    /// 405 Method Not Allowed
    #[error("method not allowed")]
    MethodNotAllowed,

    /// 409 Conflict
    #[error("conflict: {0}")]
    Conflict(String),

    /// 413 Payload Too Large
    #[error("payload too large: {size} bytes (limit {limit})")]
    PayloadTooLarge { size: usize, limit: usize },

    /// 415 Unsupported Media Type
    #[error("unsupported media type: {0}")]
    UnsupportedMediaType(String),

    /// 422 Unprocessable Entity
    #[error("unprocessable: {0}")]
    Unprocessable(String),

    /// 429 Too Many Requests
    #[error("rate limited")]
    TooManyRequests {
        retry_after_secs: Option<u64>,
    },

    /// 500 Internal Server Error
    #[error("internal error: {0}")]
    Internal(String),

    /// 503 Service Unavailable
    #[error("service unavailable: {0}")]
    ServiceUnavailable(String),

    /// 504 Gateway Timeout
    #[error("gateway timeout")]
    GatewayTimeout,
}

/// RFC 9457 Problem Details for HTTP APIs.
///
/// Provides a standardized error response format.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProblemDetails {
    /// URI reference identifying the problem type.
    #[serde(rename = "type")]
    pub problem_type: String,

    /// Short human-readable summary.
    pub title: String,

    /// HTTP status code.
    pub status: u16,

    /// Human-readable explanation specific to this occurrence.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,

    /// URI reference identifying the specific occurrence.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instance: Option<String>,
}

impl ProblemDetails {
    /// Create a new ProblemDetails.
    pub fn new(status: u16, title: impl Into<String>) -> Self {
        Self {
            problem_type: "about:blank".to_string(),
            title: title.into(),
            status,
            detail: None,
            instance: None,
        }
    }

    /// Set the detail message.
    #[must_use]
    pub fn detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }

    /// Set the problem type URI.
    #[must_use]
    pub fn problem_type(mut self, uri: impl Into<String>) -> Self {
        self.problem_type = uri.into();
        self
    }

    /// Set the instance URI.
    #[must_use]
    pub fn instance(mut self, uri: impl Into<String>) -> Self {
        self.instance = Some(uri.into());
        self
    }
}

impl fmt::Display for ProblemDetails {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} {}", self.status, self.title)?;
        if let Some(ref detail) = self.detail {
            write!(f, ": {detail}")?;
        }
        Ok(())
    }
}
