//! Response types and the `IntoResponse` trait.
//!
//! Re-exports asupersync's web response types and extends them with
//! additional response helpers for ava-web.

use bytes::Bytes;

use crate::extractor::HeaderMap;

// ── Status Codes ────────────────────────────────────────────────────────────

/// HTTP status code.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct StatusCode(u16);

impl StatusCode {
    // 1xx Informational
    pub const SWITCHING_PROTOCOLS: Self = Self(101);

    // 2xx Success
    pub const OK: Self = Self(200);
    pub const CREATED: Self = Self(201);
    pub const ACCEPTED: Self = Self(202);
    pub const NO_CONTENT: Self = Self(204);

    // 3xx Redirection
    pub const MOVED_PERMANENTLY: Self = Self(301);
    pub const FOUND: Self = Self(302);
    pub const SEE_OTHER: Self = Self(303);
    pub const NOT_MODIFIED: Self = Self(304);
    pub const TEMPORARY_REDIRECT: Self = Self(307);
    pub const PERMANENT_REDIRECT: Self = Self(308);

    // 4xx Client Error
    pub const BAD_REQUEST: Self = Self(400);
    pub const UNAUTHORIZED: Self = Self(401);
    pub const FORBIDDEN: Self = Self(403);
    pub const NOT_FOUND: Self = Self(404);
    pub const METHOD_NOT_ALLOWED: Self = Self(405);
    pub const CONFLICT: Self = Self(409);
    pub const PAYLOAD_TOO_LARGE: Self = Self(413);
    pub const UNSUPPORTED_MEDIA_TYPE: Self = Self(415);
    pub const UNPROCESSABLE_ENTITY: Self = Self(422);
    pub const TOO_MANY_REQUESTS: Self = Self(429);

    // 5xx Server Error
    pub const INTERNAL_SERVER_ERROR: Self = Self(500);
    pub const NOT_IMPLEMENTED: Self = Self(501);
    pub const BAD_GATEWAY: Self = Self(502);
    pub const SERVICE_UNAVAILABLE: Self = Self(503);
    pub const GATEWAY_TIMEOUT: Self = Self(504);

    /// Create from raw u16.
    #[must_use]
    pub const fn from_u16(code: u16) -> Self {
        Self(code)
    }

    /// Get the numeric value.
    #[must_use]
    pub const fn as_u16(self) -> u16 {
        self.0
    }

    #[must_use]
    pub const fn is_success(self) -> bool {
        self.0 >= 200 && self.0 < 300
    }

    #[must_use]
    pub const fn is_client_error(self) -> bool {
        self.0 >= 400 && self.0 < 500
    }

    #[must_use]
    pub const fn is_server_error(self) -> bool {
        self.0 >= 500 && self.0 < 600
    }

    /// Standard reason phrase for this status code.
    #[must_use]
    pub fn reason_phrase(self) -> &'static str {
        match self.0 {
            101 => "Switching Protocols",
            200 => "OK",
            201 => "Created",
            202 => "Accepted",
            204 => "No Content",
            301 => "Moved Permanently",
            302 => "Found",
            304 => "Not Modified",
            307 => "Temporary Redirect",
            400 => "Bad Request",
            401 => "Unauthorized",
            403 => "Forbidden",
            404 => "Not Found",
            405 => "Method Not Allowed",
            409 => "Conflict",
            413 => "Payload Too Large",
            415 => "Unsupported Media Type",
            422 => "Unprocessable Entity",
            429 => "Too Many Requests",
            500 => "Internal Server Error",
            502 => "Bad Gateway",
            503 => "Service Unavailable",
            504 => "Gateway Timeout",
            _ => "Unknown",
        }
    }
}

impl std::fmt::Display for StatusCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

// ── Response ────────────────────────────────────────────────────────────────

/// An HTTP response.
#[derive(Debug, Clone)]
pub struct Response {
    /// HTTP status code.
    pub status: StatusCode,
    /// Response headers (Vec-backed for cache-friendly scan).
    pub headers: HeaderMap,
    /// Response body.
    pub body: Bytes,
}

impl Response {
    /// Create a new response.
    #[must_use]
    pub fn new(status: StatusCode, body: impl Into<Bytes>) -> Self {
        Self {
            status,
            headers: HeaderMap::with_capacity(4),
            body: body.into(),
        }
    }

    /// Empty response with status code.
    #[must_use]
    pub fn empty(status: StatusCode) -> Self {
        Self::new(status, Bytes::new())
    }

    /// Add a header.
    ///
    /// Accepts `&'static str` (zero-allocation) or `String` (owned).
    #[must_use]
    pub fn header(
        mut self,
        name: impl Into<std::borrow::Cow<'static, str>>,
        value: impl Into<std::borrow::Cow<'static, str>>,
    ) -> Self {
        self.headers.insert(name, value);
        self
    }
}

// ── IntoResponse ────────────────────────────────────────────────────────────

/// Convert a type into an HTTP response.
pub trait IntoResponse {
    fn into_response(self) -> Response;
}

impl IntoResponse for Response {
    fn into_response(self) -> Response {
        self
    }
}

impl IntoResponse for StatusCode {
    fn into_response(self) -> Response {
        Response::empty(self)
    }
}

impl IntoResponse for String {
    fn into_response(self) -> Response {
        Response::new(StatusCode::OK, Bytes::from(self))
            .header("content-type", "text/plain; charset=utf-8")
    }
}

impl IntoResponse for &'static str {
    fn into_response(self) -> Response {
        Response::new(StatusCode::OK, Bytes::from_static(self.as_bytes()))
            .header("content-type", "text/plain; charset=utf-8")
    }
}

impl IntoResponse for Bytes {
    fn into_response(self) -> Response {
        Response::new(StatusCode::OK, self)
            .header("content-type", "application/octet-stream")
    }
}

impl IntoResponse for Vec<u8> {
    fn into_response(self) -> Response {
        Response::new(StatusCode::OK, Bytes::from(self))
            .header("content-type", "application/octet-stream")
    }
}

impl IntoResponse for () {
    fn into_response(self) -> Response {
        Response::empty(StatusCode::OK)
    }
}

impl<T: IntoResponse> IntoResponse for (StatusCode, T) {
    fn into_response(self) -> Response {
        let mut resp = self.1.into_response();
        resp.status = self.0;
        resp
    }
}

impl<T: IntoResponse, E: IntoResponse> IntoResponse for Result<T, E> {
    fn into_response(self) -> Response {
        match self {
            Ok(ok) => ok.into_response(),
            Err(err) => err.into_response(),
        }
    }
}

// ── JSON Response ───────────────────────────────────────────────────────────

/// JSON response wrapper.
#[derive(Debug, Clone)]
pub struct Json<T>(pub T);

impl<T: serde::Serialize> IntoResponse for Json<T> {
    fn into_response(self) -> Response {
        json_serialize(&self.0).map_or_else(
            |_| Response::empty(StatusCode::INTERNAL_SERVER_ERROR),
            |body| {
                Response::new(StatusCode::OK, Bytes::from(body))
                    .header("content-type", "application/json")
            },
        )
    }
}

/// Serialize a value to a JSON byte vector.
///
/// When the `simd-json` feature is enabled, uses SIMD-accelerated serialization.
/// Falls back to `serde_json` otherwise.
#[cfg(feature = "simd-json")]
fn json_serialize<T: serde::Serialize>(value: &T) -> Result<Vec<u8>, String> {
    simd_json::to_vec(value).map_err(|e| e.to_string())
}

#[cfg(not(feature = "simd-json"))]
fn json_serialize<T: serde::Serialize>(value: &T) -> Result<Vec<u8>, String> {
    serde_json::to_vec(value).map_err(|e| e.to_string())
}

// ── HTML Response ───────────────────────────────────────────────────────────

/// HTML response wrapper.
#[derive(Debug, Clone)]
pub struct Html<T>(pub T);

impl IntoResponse for Html<String> {
    fn into_response(self) -> Response {
        Response::new(StatusCode::OK, Bytes::from(self.0))
            .header("content-type", "text/html; charset=utf-8")
    }
}

impl IntoResponse for Html<&'static str> {
    fn into_response(self) -> Response {
        Response::new(StatusCode::OK, Bytes::from_static(self.0.as_bytes()))
            .header("content-type", "text/html; charset=utf-8")
    }
}

// ── Redirect ────────────────────────────────────────────────────────────────

/// HTTP redirect response.
#[derive(Debug, Clone)]
pub struct Redirect {
    status: StatusCode,
    location: String,
}

impl Redirect {
    /// 302 Found redirect.
    #[must_use]
    pub fn to(uri: impl Into<String>) -> Self {
        Self {
            status: StatusCode::FOUND,
            location: uri.into(),
        }
    }

    /// 301 Moved Permanently.
    #[must_use]
    pub fn permanent(uri: impl Into<String>) -> Self {
        Self {
            status: StatusCode::MOVED_PERMANENTLY,
            location: uri.into(),
        }
    }

    /// 307 Temporary Redirect (preserves method).
    #[must_use]
    pub fn temporary(uri: impl Into<String>) -> Self {
        Self {
            status: StatusCode::TEMPORARY_REDIRECT,
            location: uri.into(),
        }
    }
}

impl IntoResponse for Redirect {
    fn into_response(self) -> Response {
        Response::empty(self.status).header("location", self.location)
    }
}

// ── AppError IntoResponse ───────────────────────────────────────────────────

impl IntoResponse for crate::error::AppError {
    fn into_response(self) -> Response {
        use crate::error::AppError;
        let (status, message) = match &self {
            AppError::BadRequest(m) => (StatusCode::BAD_REQUEST, m.clone()),
            AppError::Unauthorized(m) => (StatusCode::UNAUTHORIZED, m.clone()),
            AppError::Forbidden(m) => (StatusCode::FORBIDDEN, m.clone()),
            AppError::NotFound(m) => (StatusCode::NOT_FOUND, m.clone()),
            AppError::MethodNotAllowed => (StatusCode::METHOD_NOT_ALLOWED, "method not allowed".into()),
            AppError::Conflict(m) => (StatusCode::CONFLICT, m.clone()),
            AppError::PayloadTooLarge { size, limit } => (
                StatusCode::PAYLOAD_TOO_LARGE,
                format!("payload too large: {size} bytes (limit {limit})"),
            ),
            AppError::UnsupportedMediaType(m) => (StatusCode::UNSUPPORTED_MEDIA_TYPE, m.clone()),
            AppError::Unprocessable(m) => (StatusCode::UNPROCESSABLE_ENTITY, m.clone()),
            AppError::TooManyRequests { retry_after_secs } => {
                let msg = retry_after_secs.map_or_else(
                    || "rate limited".to_string(),
                    |s| format!("rate limited, retry after {s}s"),
                );
                (StatusCode::TOO_MANY_REQUESTS, msg)
            }
            AppError::Internal(m) => (StatusCode::INTERNAL_SERVER_ERROR, m.clone()),
            AppError::ServiceUnavailable(m) => (StatusCode::SERVICE_UNAVAILABLE, m.clone()),
            AppError::GatewayTimeout => (StatusCode::GATEWAY_TIMEOUT, "gateway timeout".into()),
        };

        let problem = crate::error::ProblemDetails::new(status.as_u16(), status.reason_phrase())
            .detail(message);

        serde_json::to_vec(&problem).map_or_else(
            |_| Response::new(status, Bytes::from_static(b"internal error")),
            |body| {
                Response::new(status, Bytes::from(body))
                    .header("content-type", "application/problem+json")
            },
        )
    }
}

// ── ProblemDetails IntoResponse ─────────────────────────────────────────────

impl IntoResponse for crate::error::ProblemDetails {
    fn into_response(self) -> Response {
        let status = StatusCode::from_u16(self.status);
        serde_json::to_vec(&self).map_or_else(
            |_| Response::empty(status),
            |body| {
                Response::new(status, Bytes::from(body))
                    .header("content-type", "application/problem+json")
            },
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_code_into_response() {
        let resp = StatusCode::NOT_FOUND.into_response();
        assert_eq!(resp.status, StatusCode::NOT_FOUND);
        assert!(resp.body.is_empty());
    }

    #[test]
    fn string_into_response() {
        let resp = "hello".into_response();
        assert_eq!(resp.status, StatusCode::OK);
        assert_eq!(resp.headers.get("content-type").unwrap(), "text/plain; charset=utf-8");
    }

    #[test]
    fn json_into_response() {
        let resp = Json(serde_json::json!({"ok": true})).into_response();
        assert_eq!(resp.status, StatusCode::OK);
        assert_eq!(resp.headers.get("content-type").unwrap(), "application/json");
    }

    #[test]
    fn redirect_into_response() {
        let resp = Redirect::to("/login").into_response();
        assert_eq!(resp.status, StatusCode::FOUND);
        assert_eq!(resp.headers.get("location").unwrap(), "/login");
    }

    #[test]
    fn tuple_status_override() {
        let resp = (StatusCode::CREATED, "done").into_response();
        assert_eq!(resp.status, StatusCode::CREATED);
    }

    #[test]
    fn app_error_into_response() {
        let resp = crate::error::AppError::NotFound("user 42".into()).into_response();
        assert_eq!(resp.status, StatusCode::NOT_FOUND);
        assert_eq!(resp.headers.get("content-type").unwrap(), "application/problem+json");
    }
}
