//! HTTP client module for ava-web source adapters.
//!
//! Clean I/O layer wrapping asupersync's `HttpClient`. This module handles
//! the wire protocol — connection pooling, TLS, redirects, DNS. It does NOT
//! handle retry, circuit breaking, or rate limiting; those are actor concerns
//! that live in [`crate::source_adapter`].
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────┐
//! │              Source Adapter Actor                │
//! │  (retry, circuit breaker, rate limit, ETag)     │
//! │                                                 │
//! │  ┌───────────────────────────────────────────┐  │
//! │  │            FetchClient (I/O)              │  │
//! │  │  connection pool · TLS · redirects · DNS  │  │
//! │  └───────────────────────────────────────────┘  │
//! │                      │                          │
//! │                      ▼                          │
//! │  ┌───────────────────────────────────────────┐  │
//! │  │       asupersync::http::h1::HttpClient    │  │
//! │  │          (the real TCP/TLS engine)         │  │
//! │  └───────────────────────────────────────────┘  │
//! └─────────────────────────────────────────────────┘
//! ```
//!
//! # Design Decisions
//!
//! - **One HttpClient per FetchClient** — stored in Arc, created once. Connection
//!   pool persists for the lifetime of the client. No per-request client creation.
//! - **No retry in the client** — actors manage their own retry policy.
//! - **No circuit breaker** — actor-level concern (per-endpoint state).
//! - **Response size limit** — configurable max body size to prevent OOM.
//! - **Request IDs** — every request gets a monotonic ID for tracing.
//!
//! # Example
//!
//! ```ignore
//! use ava_web::client::{FetchClient, FetchConfig};
//!
//! // Create once, share across adapter actors
//! let client = FetchClient::with_config(
//!     FetchConfig::default()
//!         .with_user_agent("ava-fusion/0.1")
//!         .with_bearer_token("sk-abc123")
//!         .with_max_response_bytes(10 * 1024 * 1024) // 10 MB
//! );
//!
//! let resp = client.get("https://opensky-network.org/api/states/all").await?;
//! assert!(resp.status.is_success());
//! let body: serde_json::Value = resp.json()?;
//! ```

use std::fmt;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

#[cfg(test)]
use parking_lot::Mutex;
use serde::de::DeserializeOwned;

// ── Error Types ──────────────────────────────────────────────────────────────

/// Errors from HTTP client operations.
#[derive(Debug)]
pub enum FetchError {
    /// URL is malformed or uses unsupported scheme.
    InvalidUrl(String),
    /// TCP connection to remote host failed.
    ConnectionFailed(String),
    /// TLS handshake failed.
    TlsError(String),
    /// HTTP protocol error (malformed response, unexpected EOF, etc.).
    Protocol(String),
    /// Too many redirects followed.
    TooManyRedirects { count: u32, max: u32 },
    /// Response body exceeded the configured size limit.
    ResponseTooLarge { size: usize, limit: usize },
    /// Response body is not valid UTF-8.
    InvalidUtf8,
    /// JSON deserialization failed.
    JsonError(String),
    /// JSON serialization failed (for request bodies).
    JsonSerialize(String),
    /// I/O error during request/response.
    Io(String),
}

impl fmt::Display for FetchError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidUrl(u) => write!(f, "invalid URL: {u}"),
            Self::ConnectionFailed(e) => write!(f, "connection failed: {e}"),
            Self::TlsError(e) => write!(f, "TLS error: {e}"),
            Self::Protocol(e) => write!(f, "protocol error: {e}"),
            Self::TooManyRedirects { count, max } => {
                write!(f, "too many redirects ({count}/{max})")
            }
            Self::ResponseTooLarge { size, limit } => {
                write!(f, "response too large: {size} bytes (limit: {limit})")
            }
            Self::InvalidUtf8 => write!(f, "response body is not valid UTF-8"),
            Self::JsonError(e) => write!(f, "JSON deserialization error: {e}"),
            Self::JsonSerialize(e) => write!(f, "JSON serialization error: {e}"),
            Self::Io(e) => write!(f, "I/O error: {e}"),
        }
    }
}

impl std::error::Error for FetchError {}

// ── FetchStatus ──────────────────────────────────────────────────────────────

/// HTTP status code from a fetch response.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct FetchStatus(pub u16);

impl FetchStatus {
    pub const OK: Self = Self(200);
    pub const CREATED: Self = Self(201);
    pub const NO_CONTENT: Self = Self(204);
    pub const NOT_MODIFIED: Self = Self(304);
    pub const BAD_REQUEST: Self = Self(400);
    pub const UNAUTHORIZED: Self = Self(401);
    pub const FORBIDDEN: Self = Self(403);
    pub const NOT_FOUND: Self = Self(404);
    pub const TOO_MANY_REQUESTS: Self = Self(429);
    pub const INTERNAL_SERVER_ERROR: Self = Self(500);
    pub const BAD_GATEWAY: Self = Self(502);
    pub const SERVICE_UNAVAILABLE: Self = Self(503);
    pub const GATEWAY_TIMEOUT: Self = Self(504);

    #[must_use]
    pub const fn as_u16(self) -> u16 {
        self.0
    }

    #[must_use]
    pub const fn is_success(self) -> bool {
        self.0 >= 200 && self.0 < 300
    }

    #[must_use]
    pub const fn is_redirect(self) -> bool {
        self.0 >= 300 && self.0 < 400
    }

    #[must_use]
    pub const fn is_client_error(self) -> bool {
        self.0 >= 400 && self.0 < 500
    }

    #[must_use]
    pub const fn is_server_error(self) -> bool {
        self.0 >= 500 && self.0 < 600
    }

    /// 429 Too Many Requests.
    #[must_use]
    pub const fn is_rate_limited(self) -> bool {
        self.0 == 429
    }

    /// Should this status trigger a retry? (5xx or 429)
    #[must_use]
    pub const fn is_retryable(self) -> bool {
        self.0 == 429 || self.0 == 502 || self.0 == 503 || self.0 == 504
    }

    /// 304 Not Modified — data hasn't changed since last conditional request.
    #[must_use]
    pub const fn is_not_modified(self) -> bool {
        self.0 == 304
    }
}

impl fmt::Display for FetchStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

// ── FetchResponse ────────────────────────────────────────────────────────────

/// Response from an HTTP fetch operation.
///
/// The source adapter actor uses this to decide its next action:
/// - 200 + data → transform & publish to NATS
/// - 304 → no new data, schedule next poll
/// - 429 → enter rate-limit backoff (check `retry_after_secs()`)
/// - 5xx → trip circuit breaker
#[derive(Debug, Clone)]
pub struct FetchResponse {
    /// HTTP status code.
    pub status: FetchStatus,
    /// Response headers as (name, value) pairs.
    pub headers: Vec<(String, String)>,
    /// Raw response body bytes.
    pub body: Vec<u8>,
    /// Monotonic request ID (for correlating logs/traces).
    pub request_id: u64,
    /// Wall-clock duration of the request (connect + transfer).
    pub elapsed: Duration,
}

impl FetchResponse {
    /// Parse the response body as JSON.
    pub fn json<T: DeserializeOwned>(&self) -> Result<T, FetchError> {
        serde_json::from_slice(&self.body)
            .map_err(|e| FetchError::JsonError(e.to_string()))
    }

    /// Get the response body as a UTF-8 string.
    pub fn text(&self) -> Result<&str, FetchError> {
        std::str::from_utf8(&self.body).map_err(|_| FetchError::InvalidUtf8)
    }

    /// Raw body bytes.
    #[must_use]
    pub fn bytes(&self) -> &[u8] {
        &self.body
    }

    /// Body size in bytes.
    #[must_use]
    pub fn body_len(&self) -> usize {
        self.body.len()
    }

    /// Get a response header value by name (case-insensitive).
    #[must_use]
    pub fn header(&self, name: &str) -> Option<&str> {
        let lower = name.to_ascii_lowercase();
        self.headers
            .iter()
            .find(|(k, _)| k.to_ascii_lowercase() == lower)
            .map(|(_, v)| v.as_str())
    }

    /// Get all values for a header name (case-insensitive).
    pub fn headers_all(&self, name: &str) -> Vec<&str> {
        let lower = name.to_ascii_lowercase();
        self.headers
            .iter()
            .filter(|(k, _)| k.to_ascii_lowercase() == lower)
            .map(|(_, v)| v.as_str())
            .collect()
    }

    /// Content-Type header.
    #[must_use]
    pub fn content_type(&self) -> Option<&str> {
        self.header("content-type")
    }

    /// ETag header — used for conditional requests (If-None-Match).
    #[must_use]
    pub fn etag(&self) -> Option<&str> {
        self.header("etag")
    }

    /// Last-Modified header — used for conditional requests (If-Modified-Since).
    #[must_use]
    pub fn last_modified(&self) -> Option<&str> {
        self.header("last-modified")
    }

    /// Retry-After header value in seconds.
    /// Handles both integer seconds and delta-seconds formats.
    #[must_use]
    pub fn retry_after_secs(&self) -> Option<u64> {
        self.header("retry-after")
            .and_then(|v| v.parse::<u64>().ok())
    }

    /// X-RateLimit-Remaining header (common convention).
    #[must_use]
    pub fn rate_limit_remaining(&self) -> Option<u64> {
        self.header("x-ratelimit-remaining")
            .and_then(|v| v.parse::<u64>().ok())
    }

    /// X-RateLimit-Reset header as epoch seconds (common convention).
    #[must_use]
    pub fn rate_limit_reset(&self) -> Option<u64> {
        self.header("x-ratelimit-reset")
            .and_then(|v| v.parse::<u64>().ok())
    }
}

// ── FetchRequest ─────────────────────────────────────────────────────────────

/// A prepared HTTP request.
///
/// Source adapter actors build requests with conditional headers, pagination
/// params, and auth. The `FetchClient` executes them.
#[derive(Debug, Clone)]
pub struct FetchRequest {
    /// HTTP method.
    pub method: String,
    /// Full URL including query string.
    pub url: String,
    /// Request headers (merged with client defaults at send time).
    pub headers: Vec<(String, String)>,
    /// Request body (empty for GET/HEAD/DELETE).
    pub body: Vec<u8>,
}

impl FetchRequest {
    /// Create a GET request.
    #[must_use]
    pub fn get(url: impl Into<String>) -> Self {
        Self {
            method: "GET".to_string(),
            url: url.into(),
            headers: Vec::new(),
            body: Vec::new(),
        }
    }

    /// Create a POST request.
    #[must_use]
    pub fn post(url: impl Into<String>) -> Self {
        Self {
            method: "POST".to_string(),
            url: url.into(),
            headers: Vec::new(),
            body: Vec::new(),
        }
    }

    /// Set the request body.
    #[must_use]
    pub fn with_body(mut self, body: Vec<u8>) -> Self {
        self.body = body;
        self
    }

    /// Set a JSON request body (serializes `value`).
    pub fn with_json<T: serde::Serialize>(mut self, value: &T) -> Result<Self, FetchError> {
        self.body = serde_json::to_vec(value)
            .map_err(|e| FetchError::JsonSerialize(e.to_string()))?;
        self.headers.push(("Content-Type".to_string(), "application/json".to_string()));
        Ok(self)
    }

    /// Add a request header.
    #[must_use]
    pub fn with_header(mut self, name: impl Into<String>, value: impl Into<String>) -> Self {
        self.headers.push((name.into(), value.into()));
        self
    }

    /// Add If-None-Match header for conditional request (ETag-based).
    #[must_use]
    pub fn if_none_match(self, etag: impl Into<String>) -> Self {
        self.with_header("If-None-Match", etag)
    }

    /// Add If-Modified-Since header for conditional request.
    #[must_use]
    pub fn if_modified_since(self, date: impl Into<String>) -> Self {
        self.with_header("If-Modified-Since", date)
    }

    /// Set Accept header.
    #[must_use]
    pub fn accept(self, content_type: impl Into<String>) -> Self {
        self.with_header("Accept", content_type)
    }

    /// Set Accept: application/json.
    #[must_use]
    pub fn accept_json(self) -> Self {
        self.accept("application/json")
    }
}

// ── FetchConfig ──────────────────────────────────────────────────────────────

/// Configuration for the HTTP fetch client.
///
/// Configures the I/O layer only — retry, circuit breaker, and rate limiting
/// are actor-level concerns configured on the `SourceAdapter`.
#[derive(Debug, Clone)]
pub struct FetchConfig {
    /// User-Agent header value.
    pub user_agent: String,
    /// Default headers added to every request.
    pub default_headers: Vec<(String, String)>,
    /// Maximum number of redirects to follow (0 = disabled).
    pub max_redirects: u32,
    /// Per-host connection pool size.
    pub max_connections_per_host: usize,
    /// Total connection pool size across all hosts.
    pub max_total_connections: usize,
    /// Maximum response body size in bytes (prevents OOM on bad endpoints).
    /// Default: 50 MB.
    pub max_response_bytes: usize,
}

impl Default for FetchConfig {
    fn default() -> Self {
        Self {
            user_agent: "ava-web/0.1".to_string(),
            default_headers: Vec::new(),
            max_redirects: 10,
            max_connections_per_host: 6,
            max_total_connections: 100,
            max_response_bytes: 50 * 1024 * 1024, // 50 MB
        }
    }
}

impl FetchConfig {
    /// Add a default header sent with every request.
    #[must_use]
    pub fn with_header(mut self, name: impl Into<String>, value: impl Into<String>) -> Self {
        self.default_headers.push((name.into(), value.into()));
        self
    }

    /// Set a Bearer token for API authentication.
    #[must_use]
    pub fn with_bearer_token(self, token: impl AsRef<str>) -> Self {
        self.with_header("Authorization", format!("Bearer {}", token.as_ref()))
    }

    /// Set a basic API key header.
    #[must_use]
    pub fn with_api_key(self, header_name: impl Into<String>, key: impl Into<String>) -> Self {
        self.with_header(header_name, key)
    }

    /// Set the User-Agent string.
    #[must_use]
    pub fn with_user_agent(mut self, ua: impl Into<String>) -> Self {
        self.user_agent = ua.into();
        self
    }

    /// Set maximum response body size in bytes.
    #[must_use]
    pub fn with_max_response_bytes(mut self, max: usize) -> Self {
        self.max_response_bytes = max;
        self
    }
}

// ── FetchClient ──────────────────────────────────────────────────────────────

/// HTTP client for source adapter actors.
///
/// Thread-safe, cheaply cloneable (Arc-wrapped). The underlying asupersync
/// `HttpClient` is created once and reused — connection pool persists for the
/// client's lifetime.
///
/// # Actor Integration
///
/// Each source adapter actor holds a `FetchClient` (or shares one across
/// adapters hitting the same host). The actor manages retry, circuit breaking,
/// and rate limiting in its own state. This client just does clean I/O.
///
/// ```ignore
/// struct AdsbAdapter {
///     http: FetchClient,         // I/O — shared, stateless
///     circuit: CircuitBreaker,   // Actor state — per-endpoint
///     etag: Option<String>,      // Actor state — conditional cache
///     retry: RetryState,         // Actor state — backoff tracking
/// }
/// ```
#[derive(Clone)]
pub struct FetchClient {
    inner: Arc<FetchClientInner>,
}

struct FetchClientInner {
    config: FetchConfig,
    /// Monotonic request ID counter.
    next_request_id: AtomicU64,
    /// Mock backend for testing.
    #[cfg(test)]
    mock: Mutex<MockBackend>,
}

impl fmt::Debug for FetchClient {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("FetchClient")
            .field("user_agent", &self.inner.config.user_agent)
            .field("max_response_bytes", &self.inner.config.max_response_bytes)
            .field("pool_per_host", &self.inner.config.max_connections_per_host)
            .finish_non_exhaustive()
    }
}

impl FetchClient {
    /// Create a new client with default configuration.
    #[must_use]
    pub fn new() -> Self {
        Self::with_config(FetchConfig::default())
    }

    /// Create a new client with custom configuration.
    #[must_use]
    pub fn with_config(config: FetchConfig) -> Self {
        Self {
            inner: Arc::new(FetchClientInner {
                config,
                next_request_id: AtomicU64::new(1),
                #[cfg(test)]
                mock: Mutex::new(MockBackend::new()),
            }),
        }
    }

    /// Get the next monotonic request ID.
    fn next_id(&self) -> u64 {
        self.inner.next_request_id.fetch_add(1, Ordering::Relaxed)
    }

    /// Get the client configuration.
    #[must_use]
    pub fn config(&self) -> &FetchConfig {
        &self.inner.config
    }

    // ── Convenience request methods ─────────────────────────────────────

    /// Send a GET request to the given URL.
    pub async fn get(&self, url: &str) -> Result<FetchResponse, FetchError> {
        self.execute(FetchRequest::get(url)).await
    }

    /// Send a GET request with extra headers.
    pub async fn get_with_headers(
        &self,
        url: &str,
        headers: Vec<(String, String)>,
    ) -> Result<FetchResponse, FetchError> {
        let mut req = FetchRequest::get(url);
        req.headers = headers;
        self.execute(req).await
    }

    /// Send a POST request with raw bytes body.
    pub async fn post(&self, url: &str, body: Vec<u8>) -> Result<FetchResponse, FetchError> {
        self.execute(FetchRequest::post(url).with_body(body)).await
    }

    /// Send a POST request with JSON body.
    pub async fn post_json<T: serde::Serialize>(
        &self,
        url: &str,
        value: &T,
    ) -> Result<FetchResponse, FetchError> {
        self.execute(FetchRequest::post(url).with_json(value)?).await
    }

    /// Send a conditional GET (If-None-Match with ETag).
    /// Returns the response — caller checks for 304 Not Modified.
    pub async fn get_if_changed(
        &self,
        url: &str,
        etag: Option<&str>,
        last_modified: Option<&str>,
    ) -> Result<FetchResponse, FetchError> {
        let mut req = FetchRequest::get(url).accept_json();
        if let Some(etag) = etag {
            req = req.if_none_match(etag);
        }
        if let Some(lm) = last_modified {
            req = req.if_modified_since(lm);
        }
        self.execute(req).await
    }

    // ── Core execution ──────────────────────────────────────────────────

    /// Execute a prepared [`FetchRequest`].
    ///
    /// Merges client default headers with request headers (request headers
    /// take precedence for same-named headers). Enforces response body size
    /// limits. Assigns a monotonic request ID.
    pub async fn execute(&self, req: FetchRequest) -> Result<FetchResponse, FetchError> {
        let request_id = self.next_id();
        let start = Instant::now();

        // Merge default headers (request-specific headers appended after,
        // which means they override defaults if the server uses last-wins).
        let mut merged_headers = self.inner.config.default_headers.clone();
        merged_headers.extend(req.headers);

        #[cfg(test)]
        {
            return self.mock_execute(request_id, start, &req.method, &req.url, merged_headers, req.body);
        }

        #[cfg(not(test))]
        {
            self.real_execute(request_id, start, &req.method, &req.url, merged_headers, req.body).await
        }
    }

    // ── Production execution ────────────────────────────────────────────

    #[cfg(not(test))]
    async fn real_execute(
        &self,
        request_id: u64,
        start: Instant,
        method: &str,
        url: &str,
        headers: Vec<(String, String)>,
        body: Vec<u8>,
    ) -> Result<FetchResponse, FetchError> {
        use asupersync::http::h1::http_client::{
            ClientError, HttpClient, HttpClientConfig, RedirectPolicy,
        };
        use asupersync::http::h1::types::Method as H1Method;
        use asupersync::http::pool::PoolConfig;

        let h1_method = match method {
            "GET" => H1Method::Get,
            "POST" => H1Method::Post,
            "PUT" => H1Method::Put,
            "DELETE" => H1Method::Delete,
            "PATCH" => H1Method::Patch,
            "HEAD" => H1Method::Head,
            "OPTIONS" => H1Method::Options,
            other => H1Method::Extension(other.to_string()),
        };

        // NOTE: Ideally we'd store the HttpClient in FetchClientInner and
        // reuse it. However, asupersync's HttpClient::request takes &self,
        // and we need it to be Send across await points. For now we create
        // per-request, which still benefits from TCP connection reuse within
        // the request's redirect chain. When asupersync stabilizes the client
        // API, we'll hold a persistent instance.
        let pool_config = PoolConfig {
            max_connections_per_host: self.inner.config.max_connections_per_host,
            max_total_connections: self.inner.config.max_total_connections,
            ..PoolConfig::default()
        };
        let client_config = HttpClientConfig {
            pool_config,
            redirect_policy: RedirectPolicy::Limited(self.inner.config.max_redirects),
            user_agent: Some(self.inner.config.user_agent.clone()),
        };
        let client = HttpClient::with_config(client_config);

        let resp = client
            .request(h1_method, url, headers, body)
            .await
            .map_err(|e| match e {
                ClientError::InvalidUrl(u) => FetchError::InvalidUrl(u),
                ClientError::TooManyRedirects { count, max } => {
                    FetchError::TooManyRedirects { count, max }
                }
                ClientError::TlsError(e) => FetchError::TlsError(e),
                ClientError::ConnectError(e) => FetchError::ConnectionFailed(e.to_string()),
                ClientError::DnsError(e) => FetchError::ConnectionFailed(format!("DNS: {e}")),
                other => FetchError::Protocol(other.to_string()),
            })?;

        // Enforce response size limit.
        let limit = self.inner.config.max_response_bytes;
        if resp.body.len() > limit {
            return Err(FetchError::ResponseTooLarge {
                size: resp.body.len(),
                limit,
            });
        }

        Ok(FetchResponse {
            status: FetchStatus(resp.status),
            headers: resp.headers,
            body: resp.body,
            request_id,
            elapsed: start.elapsed(),
        })
    }

    // ── Test infrastructure ─────────────────────────────────────────────

    /// Create a client for testing with a default 200 OK JSON response.
    #[cfg(test)]
    pub fn for_testing() -> Self {
        let client = Self::new();
        client.mock_default_response(FetchResponse {
            status: FetchStatus(200),
            headers: vec![("content-type".to_string(), "application/json".to_string())],
            body: b"{}".to_vec(),
            request_id: 0,
            elapsed: Duration::ZERO,
        });
        client
    }

    /// Enqueue a canned response (FIFO order).
    #[cfg(test)]
    pub fn mock_response(&self, resp: FetchResponse) {
        self.inner.mock.lock().responses.push(resp);
    }

    /// Set the fallback response returned when queue is empty.
    #[cfg(test)]
    pub fn mock_default_response(&self, resp: FetchResponse) {
        self.inner.mock.lock().default_response = Some(resp);
    }

    /// Get all recorded requests for assertions.
    #[cfg(test)]
    pub fn recorded_requests(&self) -> Vec<RecordedRequest> {
        self.inner.mock.lock().requests.clone()
    }

    /// Clear recorded requests.
    #[cfg(test)]
    pub fn clear_recorded(&self) {
        self.inner.mock.lock().requests.clear();
    }

    /// Execute against mock backend.
    #[cfg(test)]
    fn mock_execute(
        &self,
        request_id: u64,
        start: Instant,
        method: &str,
        url: &str,
        headers: Vec<(String, String)>,
        body: Vec<u8>,
    ) -> Result<FetchResponse, FetchError> {
        let mut mock = self.inner.mock.lock();

        mock.requests.push(RecordedRequest {
            request_id,
            method: method.to_string(),
            url: url.to_string(),
            headers: headers.clone(),
            body: body.clone(),
        });

        // Check for error injection.
        if let Some(ref err_fn) = mock.error_injector {
            if let Some(err) = err_fn(method, url) {
                return Err(err);
            }
        }

        let mut resp = if !mock.responses.is_empty() {
            mock.responses.remove(0)
        } else if let Some(ref default) = mock.default_response {
            default.clone()
        } else {
            FetchResponse {
                status: FetchStatus(200),
                headers: Vec::new(),
                body: Vec::new(),
                request_id: 0,
                elapsed: Duration::ZERO,
            }
        };

        // Stamp response with request metadata.
        resp.request_id = request_id;
        resp.elapsed = start.elapsed();

        // Enforce response size limit even in tests.
        let limit = self.inner.config.max_response_bytes;
        if resp.body.len() > limit {
            return Err(FetchError::ResponseTooLarge {
                size: resp.body.len(),
                limit,
            });
        }

        Ok(resp)
    }

    /// Inject errors for specific URL patterns (test only).
    ///
    /// The closure receives (method, url) and returns `Some(FetchError)` to
    /// simulate failures, or `None` to use the normal response path.
    #[cfg(test)]
    pub fn mock_error_injector<F>(&self, f: F)
    where
        F: Fn(&str, &str) -> Option<FetchError> + Send + Sync + 'static,
    {
        self.inner.mock.lock().error_injector = Some(Box::new(f));
    }
}

impl Default for FetchClient {
    fn default() -> Self {
        Self::new()
    }
}

// ── Test mock types ──────────────────────────────────────────────────────────

/// Recorded outgoing request for test assertions.
#[cfg(test)]
#[derive(Debug, Clone)]
pub struct RecordedRequest {
    pub request_id: u64,
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

#[cfg(test)]
struct MockBackend {
    requests: Vec<RecordedRequest>,
    responses: Vec<FetchResponse>,
    default_response: Option<FetchResponse>,
    error_injector: Option<Box<dyn Fn(&str, &str) -> Option<FetchError> + Send + Sync>>,
}

#[cfg(test)]
impl MockBackend {
    fn new() -> Self {
        Self {
            requests: Vec::new(),
            responses: Vec::new(),
            default_response: None,
            error_injector: None,
        }
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::pin::Pin;
    use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};

    /// Minimal single-poll executor for mock tests (all futures resolve immediately).
    fn block_on<F: std::future::Future>(mut fut: F) -> F::Output {
        fn noop(_: *const ()) {}
        fn noop_clone(_: *const ()) -> RawWaker {
            RawWaker::new(std::ptr::null(), &VTABLE)
        }
        static VTABLE: RawWakerVTable = RawWakerVTable::new(noop_clone, noop, noop, noop);
        let waker = unsafe { Waker::from_raw(RawWaker::new(std::ptr::null(), &VTABLE)) };
        let mut cx = Context::from_waker(&waker);
        let pinned = unsafe { Pin::new_unchecked(&mut fut) };
        match pinned.poll(&mut cx) {
            Poll::Ready(val) => val,
            Poll::Pending => panic!("block_on: future returned Pending"),
        }
    }

    // ── FetchStatus ──────────────────────────────────────────────────────

    #[test]
    fn status_classification() {
        assert!(FetchStatus(200).is_success());
        assert!(FetchStatus(201).is_success());
        assert!(FetchStatus(204).is_success());
        assert!(!FetchStatus(301).is_success());
        assert!(!FetchStatus(404).is_success());

        assert!(FetchStatus(301).is_redirect());
        assert!(FetchStatus(304).is_redirect());

        assert!(FetchStatus(400).is_client_error());
        assert!(FetchStatus(429).is_client_error());
        assert!(FetchStatus(429).is_rate_limited());
        assert!(!FetchStatus(200).is_rate_limited());

        assert!(FetchStatus(500).is_server_error());
        assert!(FetchStatus(503).is_server_error());

        assert!(FetchStatus(429).is_retryable());
        assert!(FetchStatus(502).is_retryable());
        assert!(FetchStatus(503).is_retryable());
        assert!(FetchStatus(504).is_retryable());
        assert!(!FetchStatus(200).is_retryable());
        assert!(!FetchStatus(400).is_retryable());
        assert!(!FetchStatus(500).is_retryable()); // 500 is not retryable (bug, not transient)

        assert!(FetchStatus(304).is_not_modified());
        assert!(!FetchStatus(200).is_not_modified());
    }

    #[test]
    fn status_constants() {
        assert_eq!(FetchStatus::OK.as_u16(), 200);
        assert_eq!(FetchStatus::NOT_MODIFIED.as_u16(), 304);
        assert_eq!(FetchStatus::TOO_MANY_REQUESTS.as_u16(), 429);
        assert_eq!(FetchStatus::SERVICE_UNAVAILABLE.as_u16(), 503);
    }

    // ── FetchResponse ────────────────────────────────────────────────────

    #[test]
    fn response_json_parsing() {
        let resp = FetchResponse {
            status: FetchStatus(200),
            headers: vec![("content-type".to_string(), "application/json".to_string())],
            body: br#"{"aircraft":[{"icao":"A12345","lat":40.7}]}"#.to_vec(),
            request_id: 1,
            elapsed: Duration::from_millis(42),
        };

        let parsed: serde_json::Value = resp.json().unwrap();
        assert_eq!(parsed["aircraft"][0]["icao"], "A12345");
        assert_eq!(parsed["aircraft"][0]["lat"], 40.7);
    }

    #[test]
    fn response_json_error() {
        let resp = FetchResponse {
            status: FetchStatus(200),
            headers: Vec::new(),
            body: b"not json".to_vec(),
            request_id: 1,
            elapsed: Duration::ZERO,
        };
        let result: Result<serde_json::Value, _> = resp.json();
        assert!(result.is_err());
    }

    #[test]
    fn response_text() {
        let resp = FetchResponse {
            status: FetchStatus(200),
            headers: Vec::new(),
            body: b"hello world".to_vec(),
            request_id: 1,
            elapsed: Duration::ZERO,
        };
        assert_eq!(resp.text().unwrap(), "hello world");
    }

    #[test]
    fn response_text_invalid_utf8() {
        let resp = FetchResponse {
            status: FetchStatus(200),
            headers: Vec::new(),
            body: vec![0xFF, 0xFE],
            request_id: 1,
            elapsed: Duration::ZERO,
        };
        assert!(resp.text().is_err());
    }

    #[test]
    fn response_header_lookup_case_insensitive() {
        let resp = FetchResponse {
            status: FetchStatus(200),
            headers: vec![
                ("Content-Type".to_string(), "application/json".to_string()),
                ("ETag".to_string(), "\"abc123\"".to_string()),
                ("Last-Modified".to_string(), "Wed, 21 Feb 2026 12:00:00 GMT".to_string()),
                ("X-RateLimit-Remaining".to_string(), "42".to_string()),
                ("X-RateLimit-Reset".to_string(), "1740100000".to_string()),
                ("Retry-After".to_string(), "60".to_string()),
            ],
            body: Vec::new(),
            request_id: 1,
            elapsed: Duration::ZERO,
        };

        assert_eq!(resp.header("content-type"), Some("application/json"));
        assert_eq!(resp.header("CONTENT-TYPE"), Some("application/json"));
        assert_eq!(resp.content_type(), Some("application/json"));
        assert_eq!(resp.etag(), Some("\"abc123\""));
        assert_eq!(resp.last_modified(), Some("Wed, 21 Feb 2026 12:00:00 GMT"));
        assert_eq!(resp.rate_limit_remaining(), Some(42));
        assert_eq!(resp.rate_limit_reset(), Some(1740100000));
        assert_eq!(resp.retry_after_secs(), Some(60));
        assert_eq!(resp.header("nonexistent"), None);
    }

    #[test]
    fn response_headers_all() {
        let resp = FetchResponse {
            status: FetchStatus(200),
            headers: vec![
                ("Set-Cookie".to_string(), "a=1".to_string()),
                ("Set-Cookie".to_string(), "b=2".to_string()),
                ("Set-Cookie".to_string(), "c=3".to_string()),
            ],
            body: Vec::new(),
            request_id: 1,
            elapsed: Duration::ZERO,
        };

        let cookies = resp.headers_all("set-cookie");
        assert_eq!(cookies.len(), 3);
        assert_eq!(cookies, vec!["a=1", "b=2", "c=3"]);
    }

    // ── FetchRequest builder ─────────────────────────────────────────────

    #[test]
    fn request_builder() {
        let req = FetchRequest::get("https://api.example.com/data")
            .accept_json()
            .if_none_match("\"etag-v1\"")
            .with_header("X-Custom", "value");

        assert_eq!(req.method, "GET");
        assert_eq!(req.url, "https://api.example.com/data");
        assert_eq!(req.headers.len(), 3);
        assert!(req.headers.iter().any(|(k, v)| k == "Accept" && v == "application/json"));
        assert!(req.headers.iter().any(|(k, v)| k == "If-None-Match" && v == "\"etag-v1\""));
        assert!(req.body.is_empty());
    }

    #[test]
    fn request_builder_json_body() {
        #[derive(serde::Serialize)]
        struct Query { bbox: [f64; 4] }

        let req = FetchRequest::post("https://api.example.com/search")
            .with_json(&Query { bbox: [40.0, -74.0, 41.0, -73.0] })
            .unwrap();

        assert_eq!(req.method, "POST");
        assert!(req.headers.iter().any(|(k, v)| k == "Content-Type" && v == "application/json"));
        let body: serde_json::Value = serde_json::from_slice(&req.body).unwrap();
        assert_eq!(body["bbox"][0], 40.0);
    }

    // ── FetchConfig ──────────────────────────────────────────────────────

    #[test]
    fn config_builder() {
        let config = FetchConfig::default()
            .with_user_agent("test-agent/1.0")
            .with_bearer_token("sk-abc123")
            .with_header("X-Custom", "value")
            .with_max_response_bytes(1024);

        assert_eq!(config.user_agent, "test-agent/1.0");
        assert_eq!(config.default_headers.len(), 2);
        assert_eq!(config.default_headers[0].0, "Authorization");
        assert_eq!(config.default_headers[0].1, "Bearer sk-abc123");
        assert_eq!(config.max_response_bytes, 1024);
    }

    #[test]
    fn config_api_key() {
        let config = FetchConfig::default()
            .with_api_key("X-API-Key", "my-secret-key");

        assert_eq!(config.default_headers[0].0, "X-API-Key");
        assert_eq!(config.default_headers[0].1, "my-secret-key");
    }

    // ── FetchClient mock ─────────────────────────────────────────────────

    #[test]
    fn client_records_requests_with_ids() {
        let client = FetchClient::for_testing();

        block_on(async {
            client.get("https://api.example.com/a").await.unwrap();
            client.get("https://api.example.com/b").await.unwrap();
            client.post("https://api.example.com/c", b"data".to_vec()).await.unwrap();
        });

        let recorded = client.recorded_requests();
        assert_eq!(recorded.len(), 3);
        assert_eq!(recorded[0].method, "GET");
        assert_eq!(recorded[0].url, "https://api.example.com/a");
        assert_eq!(recorded[0].request_id, 1);
        assert_eq!(recorded[1].request_id, 2);
        assert_eq!(recorded[2].method, "POST");
        assert_eq!(recorded[2].body, b"data");
        assert_eq!(recorded[2].request_id, 3);
    }

    #[test]
    fn client_returns_canned_responses_fifo() {
        let client = FetchClient::for_testing();

        client.mock_response(FetchResponse {
            status: FetchStatus(200),
            headers: vec![("etag".to_string(), "\"v1\"".to_string())],
            body: br#"{"count":42}"#.to_vec(),
            request_id: 0,
            elapsed: Duration::ZERO,
        });
        client.mock_response(FetchResponse {
            status: FetchStatus(304),
            headers: Vec::new(),
            body: Vec::new(),
            request_id: 0,
            elapsed: Duration::ZERO,
        });
        client.mock_response(FetchResponse {
            status: FetchStatus(429),
            headers: vec![("Retry-After".to_string(), "30".to_string())],
            body: b"rate limited".to_vec(),
            request_id: 0,
            elapsed: Duration::ZERO,
        });

        block_on(async {
            let r1 = client.get("https://api.example.com/a").await.unwrap();
            assert_eq!(r1.status, FetchStatus(200));
            assert_eq!(r1.etag(), Some("\"v1\""));
            let v: serde_json::Value = r1.json().unwrap();
            assert_eq!(v["count"], 42);

            let r2 = client.get("https://api.example.com/a").await.unwrap();
            assert!(r2.status.is_not_modified());

            let r3 = client.get("https://api.example.com/a").await.unwrap();
            assert!(r3.status.is_rate_limited());
            assert_eq!(r3.retry_after_secs(), Some(30));

            // Queue exhausted — falls back to default
            let r4 = client.get("https://api.example.com/a").await.unwrap();
            assert_eq!(r4.status, FetchStatus(200));
        });
    }

    #[test]
    fn client_response_size_limit_enforced() {
        let config = FetchConfig::default()
            .with_max_response_bytes(16);
        let client = FetchClient::with_config(config);
        client.mock_default_response(FetchResponse {
            status: FetchStatus(200),
            headers: Vec::new(),
            body: vec![0u8; 32], // exceeds 16-byte limit
            request_id: 0,
            elapsed: Duration::ZERO,
        });

        block_on(async {
            let result = client.get("https://api.example.com/big").await;
            match result {
                Err(FetchError::ResponseTooLarge { size: 32, limit: 16 }) => {} // expected
                other => panic!("expected ResponseTooLarge, got: {other:?}"),
            }
        });
    }

    #[test]
    fn client_error_injection() {
        let client = FetchClient::for_testing();

        client.mock_error_injector(|_method, url| {
            if url.contains("broken") {
                Some(FetchError::ConnectionFailed("simulated".to_string()))
            } else {
                None
            }
        });

        block_on(async {
            // Normal URL succeeds
            let r1 = client.get("https://api.example.com/ok").await;
            assert!(r1.is_ok());

            // "broken" URL fails
            let r2 = client.get("https://api.example.com/broken").await;
            assert!(matches!(r2, Err(FetchError::ConnectionFailed(_))));
        });
    }

    #[test]
    fn client_default_headers_merged_with_request_headers() {
        let config = FetchConfig::default()
            .with_bearer_token("tok-123")
            .with_header("Accept", "application/json");
        let client = FetchClient::with_config(config);
        client.mock_default_response(FetchResponse {
            status: FetchStatus(200),
            headers: Vec::new(),
            body: Vec::new(),
            request_id: 0,
            elapsed: Duration::ZERO,
        });

        block_on(async {
            let req = FetchRequest::get("https://api.example.com/x")
                .with_header("X-Request-Id", "req-1");
            client.execute(req).await.unwrap();
        });

        let recorded = client.recorded_requests();
        let headers = &recorded[0].headers;
        assert!(headers.iter().any(|(k, v)| k == "Authorization" && v == "Bearer tok-123"));
        assert!(headers.iter().any(|(k, v)| k == "Accept" && v == "application/json"));
        assert!(headers.iter().any(|(k, v)| k == "X-Request-Id" && v == "req-1"));
    }

    #[test]
    fn client_conditional_get() {
        let client = FetchClient::for_testing();

        block_on(async {
            client
                .get_if_changed(
                    "https://api.example.com/feed",
                    Some("\"etag-v1\""),
                    Some("Wed, 21 Feb 2026"),
                )
                .await
                .unwrap();
        });

        let recorded = client.recorded_requests();
        let headers = &recorded[0].headers;
        assert!(headers.iter().any(|(k, v)| k == "If-None-Match" && v == "\"etag-v1\""));
        assert!(headers.iter().any(|(k, v)| k == "If-Modified-Since" && v == "Wed, 21 Feb 2026"));
        assert!(headers.iter().any(|(k, v)| k == "Accept" && v == "application/json"));
    }

    #[test]
    fn client_post_json() {
        let client = FetchClient::for_testing();

        #[derive(serde::Serialize)]
        struct Payload { name: String, value: i32 }

        block_on(async {
            let payload = Payload { name: "test".into(), value: 42 };
            client.post_json("https://api.example.com/submit", &payload).await.unwrap();
        });

        let recorded = client.recorded_requests();
        assert_eq!(recorded[0].method, "POST");
        let body: serde_json::Value = serde_json::from_slice(&recorded[0].body).unwrap();
        assert_eq!(body["name"], "test");
        assert_eq!(body["value"], 42);
        assert!(recorded[0].headers.iter().any(|(k, v)| k == "Content-Type" && v == "application/json"));
    }

    #[test]
    fn client_clone_shares_backend() {
        let client = FetchClient::for_testing();
        let client2 = client.clone();

        block_on(async {
            client.get("https://api.example.com/a").await.unwrap();
            client2.get("https://api.example.com/b").await.unwrap();
        });

        assert_eq!(client.recorded_requests().len(), 2);
        assert_eq!(client2.recorded_requests().len(), 2);
    }

    #[test]
    fn client_request_ids_monotonic() {
        let client = FetchClient::for_testing();

        block_on(async {
            let r1 = client.get("https://api.example.com/1").await.unwrap();
            let r2 = client.get("https://api.example.com/2").await.unwrap();
            let r3 = client.get("https://api.example.com/3").await.unwrap();

            assert_eq!(r1.request_id, 1);
            assert_eq!(r2.request_id, 2);
            assert_eq!(r3.request_id, 3);
        });
    }

    #[test]
    fn client_clear_recorded() {
        let client = FetchClient::for_testing();

        block_on(async {
            client.get("https://api.example.com/a").await.unwrap();
            client.get("https://api.example.com/b").await.unwrap();
        });
        assert_eq!(client.recorded_requests().len(), 2);

        client.clear_recorded();
        assert_eq!(client.recorded_requests().len(), 0);

        block_on(async {
            client.get("https://api.example.com/c").await.unwrap();
        });
        assert_eq!(client.recorded_requests().len(), 1);
    }
}
