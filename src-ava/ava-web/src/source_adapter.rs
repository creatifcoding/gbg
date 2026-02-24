//! Source adapter actor framework.
//!
//! Each source adapter is a **supervised GenServer actor** that:
//! 1. Owns per-actor resilience state (circuit breaker, retry, rate limit)
//! 2. Polls an external API on a timer
//! 3. Transforms responses into records
//! 4. Publishes to NATS subjects per RFC-001
//!
//! # Actor Power
//!
//! What makes this different from a cron job calling reqwest:
//!
//! | Feature | reqwest + cron | Source Adapter Actor |
//! |---------|---------------|---------------------|
//! | Circuit breaker | Global, shared | Per-actor, per-endpoint |
//! | Retry backoff | Per-request, memoryless | Per-actor, stateful |
//! | Conditional GET | Must implement manually | Built into actor state |
//! | Rate limit | Hope for the best | Per-actor, respects Retry-After |
//! | Supervision | None | Crash → restart → resume |
//! | Observability | Logs | `cx.trace()`, metrics counters |
//! | Backpressure | None | NATS publish backpressure |
//! | State | Stateless | ETag, cursor, page token |
//!
//! # Architecture
//!
//! ```text
//! ┌──────────────────────────────────────────────┐
//! │         Source Adapter Actor (GenServer)      │
//! │                                              │
//! │  ┌────────────┐  ┌───────────────────────┐   │
//! │  │ FetchClient│  │  Actor Resilience      │   │
//! │  │   (I/O)    │  │  ├─ CircuitBreaker     │   │
//! │  └─────┬──────┘  │  ├─ RetryState         │   │
//! │        │         │  ├─ RateLimitState      │   │
//! │        ▼         │  ├─ ConditionalCache    │   │
//! │  HTTP GET/POST   │  └─ AdapterMetrics      │   │
//! │        │         └───────────────────────┘   │
//! │        ▼                                     │
//! │  Transform → NATS publish                    │
//! │                                              │
//! │  Timer: ──── PollTick ──── PollTick ────▶    │
//! └──────────────────────────────────────────────┘
//! ```
//!
//! # Example
//!
//! ```ignore
//! use ava_web::source_adapter::*;
//! use ava_web::client::{FetchClient, FetchRequest, FetchResponse};
//!
//! struct OpenSkyAdapter;
//!
//! impl SourceAdapter for OpenSkyAdapter {
//!     fn name(&self) -> &str { "opensky" }
//!     fn signal_kind(&self) -> &str { "adsb" }
//!     fn source_id(&self) -> &str { "opensky" }
//!     fn default_format(&self) -> &str { "json" }
//!
//!     fn build_request(&self, _state: &AdapterState) -> FetchRequest {
//!         FetchRequest::get("https://opensky-network.org/api/states/all")
//!             .accept_json()
//!     }
//!
//!     fn parse_records(&self, resp: &FetchResponse) -> Result<Vec<Record>, AdapterError> {
//!         let data: serde_json::Value = resp.json()?;
//!         let states = data["states"].as_array().unwrap_or(&vec![]);
//!         Ok(states.iter().map(|s| Record {
//!             payload: serde_json::to_vec(s).unwrap(),
//!             subject_suffix: None,
//!         }).collect())
//!     }
//!
//!     fn poll_interval(&self) -> Duration { Duration::from_secs(10) }
//! }
//! ```

use std::fmt;
use std::time::{Duration, Instant};

use crate::client::{FetchClient, FetchError, FetchRequest, FetchResponse};
use crate::nats_bridge::{NatsBridgeError, NatsState};

// ── Record ───────────────────────────────────────────────────────────────────

/// A single data record extracted from an API response.
///
/// The adapter publishes each record to NATS independently. Records may
/// optionally specify a subject suffix for sub-routing (e.g., per-aircraft
/// ICAO code).
#[derive(Debug, Clone)]
pub struct Record {
    /// Serialized payload bytes (typically JSON).
    pub payload: Vec<u8>,
    /// Optional subject suffix appended after the base subject.
    /// E.g., "A12345" → `sensor.adsb.opensky.json.A12345`
    pub subject_suffix: Option<String>,
}

// ── AdapterError ─────────────────────────────────────────────────────────────

/// Errors from source adapter operations.
#[derive(Debug)]
pub enum AdapterError {
    /// HTTP fetch failed.
    Fetch(FetchError),
    /// Response parsing/transformation failed.
    Parse(String),
    /// NATS publish failed.
    Publish(NatsBridgeError),
    /// Adapter-specific error.
    Custom(String),
}

impl fmt::Display for AdapterError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Fetch(e) => write!(f, "fetch: {e}"),
            Self::Parse(e) => write!(f, "parse: {e}"),
            Self::Publish(e) => write!(f, "publish: {e}"),
            Self::Custom(e) => write!(f, "{e}"),
        }
    }
}

impl std::error::Error for AdapterError {}

impl From<FetchError> for AdapterError {
    fn from(e: FetchError) -> Self {
        Self::Fetch(e)
    }
}

impl From<NatsBridgeError> for AdapterError {
    fn from(e: NatsBridgeError) -> Self {
        Self::Publish(e)
    }
}

// ── SourceAdapter trait ──────────────────────────────────────────────────────

/// The user-facing trait for implementing a data source.
///
/// Implement this for each external API (OpenSky, MarineTraffic, NOAA, etc.).
/// The [`AdapterActor`] wraps any `SourceAdapter` with per-actor resilience.
pub trait SourceAdapter: Send + Sync + 'static {
    /// Human-readable name for logging and metrics (e.g., "opensky").
    fn name(&self) -> &str;

    /// Signal kind per RFC-001 taxonomy (e.g., "adsb", "ais", "weather").
    fn signal_kind(&self) -> &str;

    /// Source identifier (e.g., "opensky", "marinetraffic", "noaa").
    fn source_id(&self) -> &str;

    /// Default data format string (e.g., "json", "csv", "protobuf").
    fn default_format(&self) -> &str;

    /// Build the HTTP request for this poll cycle.
    ///
    /// The adapter state provides the current ETag, cursor, page token, etc.
    /// so the request can include conditional headers or pagination params.
    fn build_request(&self, state: &AdapterState) -> FetchRequest;

    /// Parse the HTTP response into publishable records.
    ///
    /// Called only when the response status is 2xx. For 304 Not Modified,
    /// the actor skips this method entirely.
    fn parse_records(&self, resp: &FetchResponse) -> Result<Vec<Record>, AdapterError>;

    /// Polling interval between successful fetches.
    fn poll_interval(&self) -> Duration;

    /// Maximum records to publish per poll cycle (backpressure).
    /// Default: no limit.
    fn max_records_per_poll(&self) -> Option<usize> {
        None
    }

    /// NATS subject for a record.
    ///
    /// Default: `sensor.{signal_kind}.{source_id}.{format}[.{suffix}]`
    fn nats_subject(&self, record: &Record) -> String {
        let base = format!(
            "sensor.{}.{}.{}",
            self.signal_kind(),
            self.source_id(),
            self.default_format(),
        );
        match &record.subject_suffix {
            Some(suffix) => format!("{base}.{suffix}"),
            None => base,
        }
    }
}

// ── CircuitBreaker ───────────────────────────────────────────────────────────

/// Per-actor circuit breaker state machine.
///
/// Prevents hammering a dead endpoint. Three states:
/// - **Closed**: Normal operation, requests flow through.
/// - **Open**: Endpoint is down, all requests short-circuit.
/// - **HalfOpen**: Probing — one request allowed to test recovery.
///
/// State transitions:
/// ```text
/// Closed ──(failures >= threshold)──▶ Open
///   ▲                                   │
///   │                        (recovery_timeout elapsed)
///   │                                   ▼
///   └──────(probe succeeds)───── HalfOpen
///                                       │
///                          (probe fails) │
///                                       ▼
///                                     Open
/// ```
#[derive(Debug, Clone)]
pub struct CircuitBreaker {
    state: CircuitState,
    /// Consecutive failure count (resets on success).
    consecutive_failures: u32,
    /// Number of failures before opening the circuit.
    failure_threshold: u32,
    /// How long the circuit stays open before half-opening.
    recovery_timeout: Duration,
    /// When the circuit was opened (for recovery timeout).
    opened_at: Option<Instant>,
    /// Total number of times the circuit has opened (lifetime metric).
    total_trips: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

impl fmt::Display for CircuitState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Closed => write!(f, "closed"),
            Self::Open => write!(f, "open"),
            Self::HalfOpen => write!(f, "half-open"),
        }
    }
}

impl CircuitBreaker {
    /// Create a new circuit breaker with the given thresholds.
    #[must_use]
    pub fn new(failure_threshold: u32, recovery_timeout: Duration) -> Self {
        Self {
            state: CircuitState::Closed,
            consecutive_failures: 0,
            failure_threshold,
            recovery_timeout,
            opened_at: None,
            total_trips: 0,
        }
    }

    /// Default circuit breaker: 5 failures, 30s recovery.
    #[must_use]
    pub fn default_config() -> Self {
        Self::new(5, Duration::from_secs(30))
    }

    /// Current circuit state.
    #[must_use]
    pub fn state(&self) -> CircuitState {
        self.state
    }

    /// Whether a request should be allowed through.
    ///
    /// Call this before making a fetch. If it returns false, the actor
    /// should skip this poll cycle and schedule the next one.
    #[must_use]
    pub fn allow_request(&mut self) -> bool {
        match self.state {
            CircuitState::Closed => true,
            CircuitState::Open => {
                // Check if recovery timeout has elapsed → transition to HalfOpen.
                if let Some(opened_at) = self.opened_at {
                    if opened_at.elapsed() >= self.recovery_timeout {
                        self.state = CircuitState::HalfOpen;
                        true // Allow one probe request
                    } else {
                        false // Still in cooldown
                    }
                } else {
                    // Shouldn't happen, but recover gracefully.
                    self.state = CircuitState::HalfOpen;
                    true
                }
            }
            CircuitState::HalfOpen => true, // Probe request allowed
        }
    }

    /// Record a successful request. Resets failure count, closes circuit.
    pub fn record_success(&mut self) {
        self.consecutive_failures = 0;
        self.state = CircuitState::Closed;
        self.opened_at = None;
    }

    /// Record a failed request. May trip the circuit to Open.
    pub fn record_failure(&mut self) {
        self.consecutive_failures += 1;

        match self.state {
            CircuitState::Closed => {
                if self.consecutive_failures >= self.failure_threshold {
                    self.state = CircuitState::Open;
                    self.opened_at = Some(Instant::now());
                    self.total_trips += 1;
                }
            }
            CircuitState::HalfOpen => {
                // Probe failed — back to open.
                self.state = CircuitState::Open;
                self.opened_at = Some(Instant::now());
                self.total_trips += 1;
            }
            CircuitState::Open => {
                // Already open — refresh the timeout.
                self.opened_at = Some(Instant::now());
            }
        }
    }

    /// Consecutive failures since last success.
    #[must_use]
    pub fn consecutive_failures(&self) -> u32 {
        self.consecutive_failures
    }

    /// Total lifetime circuit trips.
    #[must_use]
    pub fn total_trips(&self) -> u64 {
        self.total_trips
    }
}

// ── RetryPolicy ──────────────────────────────────────────────────────────────

/// Configurable retry policy with exponential backoff and jitter.
#[derive(Debug, Clone)]
pub struct RetryPolicy {
    /// Base delay for first retry.
    pub base_delay: Duration,
    /// Maximum delay cap.
    pub max_delay: Duration,
    /// Multiplier per retry (exponential growth).
    pub multiplier: f64,
    /// Maximum number of retries before giving up.
    pub max_retries: u32,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            base_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(60),
            multiplier: 2.0,
            max_retries: 5,
        }
    }
}

impl RetryPolicy {
    /// Calculate the delay for the Nth retry attempt (0-indexed).
    ///
    /// Uses exponential backoff: `base_delay * multiplier^attempt`, capped
    /// at `max_delay`. Jitter is NOT applied here — the actor adds it to
    /// avoid thundering herd across adapters polling the same endpoint.
    #[must_use]
    pub fn delay_for_attempt(&self, attempt: u32) -> Duration {
        if attempt >= self.max_retries {
            return self.max_delay;
        }
        let secs = self.base_delay.as_secs_f64() * self.multiplier.powi(attempt as i32);
        let capped = secs.min(self.max_delay.as_secs_f64());
        Duration::from_secs_f64(capped)
    }

    /// Whether another retry should be attempted.
    #[must_use]
    pub fn should_retry(&self, attempt: u32) -> bool {
        attempt < self.max_retries
    }
}

// ── RateLimitState ───────────────────────────────────────────────────────────

/// Per-actor rate limit tracking.
///
/// Respects the server's Retry-After header. When a 429 is received, the
/// actor enters a backoff period and skips poll cycles until the backoff
/// expires.
#[derive(Debug, Clone)]
pub struct RateLimitState {
    /// When the rate limit backoff expires (None = not rate-limited).
    backoff_until: Option<Instant>,
    /// How many times this adapter has been rate-limited (lifetime).
    total_rate_limits: u64,
}

impl RateLimitState {
    #[must_use]
    pub fn new() -> Self {
        Self {
            backoff_until: None,
            total_rate_limits: 0,
        }
    }

    /// Record a 429 response. Uses Retry-After if available, otherwise
    /// falls back to the provided default.
    pub fn record_rate_limit(&mut self, retry_after_secs: Option<u64>, default_backoff: Duration) {
        let delay = retry_after_secs
            .map(Duration::from_secs)
            .unwrap_or(default_backoff);
        self.backoff_until = Some(Instant::now() + delay);
        self.total_rate_limits += 1;
    }

    /// Whether the adapter is currently in a rate-limit backoff.
    #[must_use]
    pub fn is_rate_limited(&self) -> bool {
        self.backoff_until
            .map_or(false, |until| Instant::now() < until)
    }

    /// Clear rate limit if the backoff period has expired.
    pub fn maybe_clear(&mut self) {
        if let Some(until) = self.backoff_until {
            if Instant::now() >= until {
                self.backoff_until = None;
            }
        }
    }

    /// Remaining backoff time (if rate-limited).
    #[must_use]
    pub fn remaining_backoff(&self) -> Option<Duration> {
        self.backoff_until.and_then(|until| {
            let now = Instant::now();
            if now < until {
                Some(until - now)
            } else {
                None
            }
        })
    }
}

impl Default for RateLimitState {
    fn default() -> Self {
        Self::new()
    }
}

// ── ConditionalCache ─────────────────────────────────────────────────────────

/// Per-actor conditional request cache.
///
/// Tracks ETag and Last-Modified from previous responses so the next request
/// can send If-None-Match / If-Modified-Since headers. When the server returns
/// 304 Not Modified, the adapter skips parsing — bandwidth and compute saved.
#[derive(Debug, Clone, Default)]
pub struct ConditionalCache {
    /// ETag from the last 2xx response.
    pub etag: Option<String>,
    /// Last-Modified from the last 2xx response.
    pub last_modified: Option<String>,
}

impl ConditionalCache {
    /// Update the cache from a successful response.
    pub fn update_from_response(&mut self, resp: &FetchResponse) {
        if let Some(etag) = resp.etag() {
            self.etag = Some(etag.to_string());
        }
        if let Some(lm) = resp.last_modified() {
            self.last_modified = Some(lm.to_string());
        }
    }

    /// Apply conditional headers to a request builder.
    #[must_use]
    pub fn apply_to_request(&self, req: FetchRequest) -> FetchRequest {
        let mut req = req;
        if let Some(ref etag) = self.etag {
            req = req.if_none_match(etag);
        }
        if let Some(ref lm) = self.last_modified {
            req = req.if_modified_since(lm);
        }
        req
    }
}

// ── AdapterMetrics ───────────────────────────────────────────────────────────

/// Per-actor metrics counters.
///
/// Updated by the [`AdapterActor`] on each poll cycle. Useful for
/// observability dashboards and health checks.
#[derive(Debug, Clone, Default)]
pub struct AdapterMetrics {
    /// Total successful poll cycles (2xx response + records published).
    pub polls_success: u64,
    /// Total failed poll cycles.
    pub polls_failed: u64,
    /// Total 304 Not Modified responses (no new data).
    pub polls_not_modified: u64,
    /// Total records published to NATS.
    pub records_published: u64,
    /// Total bytes fetched from the API.
    pub bytes_fetched: u64,
    /// Total bytes published to NATS.
    pub bytes_published: u64,
    /// Last successful poll time.
    pub last_success_at: Option<Instant>,
    /// Last error message (ring buffer of 1).
    pub last_error: Option<String>,
}

// ── AdapterState ─────────────────────────────────────────────────────────────

/// The combined per-actor state for a source adapter.
///
/// This is what makes actor-backed adapters powerful — each adapter has its
/// own circuit breaker, retry state, rate limit tracker, conditional cache,
/// and metrics. None of this is shared across adapters.
#[derive(Debug, Clone)]
pub struct AdapterState {
    pub circuit: CircuitBreaker,
    pub retry_policy: RetryPolicy,
    pub retry_attempt: u32,
    pub rate_limit: RateLimitState,
    pub cache: ConditionalCache,
    pub metrics: AdapterMetrics,
}

impl AdapterState {
    /// Create a new adapter state with default resilience settings.
    #[must_use]
    pub fn new() -> Self {
        Self {
            circuit: CircuitBreaker::default_config(),
            retry_policy: RetryPolicy::default(),
            retry_attempt: 0,
            rate_limit: RateLimitState::new(),
            cache: ConditionalCache::default(),
            metrics: AdapterMetrics::default(),
        }
    }

    /// Create with custom circuit breaker and retry policy.
    #[must_use]
    pub fn with_resilience(circuit: CircuitBreaker, retry_policy: RetryPolicy) -> Self {
        Self {
            circuit,
            retry_policy,
            retry_attempt: 0,
            rate_limit: RateLimitState::new(),
            cache: ConditionalCache::default(),
            metrics: AdapterMetrics::default(),
        }
    }
}

impl Default for AdapterState {
    fn default() -> Self {
        Self::new()
    }
}

// ── AdapterActor ─────────────────────────────────────────────────────────────

/// GenServer-style actor wrapping a [`SourceAdapter`].
///
/// Owns the HTTP client, NATS publisher, and all per-actor resilience state.
/// The `poll_once` method is the main loop body — called on each timer tick
/// by the runtime.
///
/// # State Machine (per poll cycle)
///
/// ```text
///                 ┌──────────────┐
///                 │  Poll Tick   │
///                 └──────┬───────┘
///                        │
///               ┌────────▼────────┐
///               │ Rate limited?   │──yes──▶ Skip, schedule next
///               └────────┬────────┘
///                        │ no
///               ┌────────▼────────┐
///               │ Circuit open?   │──yes──▶ Skip, schedule next
///               └────────┬────────┘
///                        │ no (or half-open)
///               ┌────────▼────────┐
///               │  Build request  │ (with conditional headers)
///               └────────┬────────┘
///                        │
///               ┌────────▼────────┐
///               │   HTTP fetch    │
///               └────────┬────────┘
///                        │
///         ┌──────────────┼──────────────┐
///         │              │              │
///    ┌────▼───┐    ┌─────▼────┐   ┌────▼─────┐
///    │  2xx   │    │   304    │   │ 429/5xx  │
///    │        │    │ not mod  │   │  error   │
///    └────┬───┘    └─────┬────┘   └────┬─────┘
///         │              │              │
///    parse records  skip parse    record failure
///    update cache   bump metric   update circuit
///    publish NATS                 update rate limit
///    reset retry
///    bump metrics
///         │              │              │
///         └──────────────┼──────────────┘
///                        │
///               ┌────────▼────────┐
///               │ Schedule next   │
///               │ poll tick       │
///               └─────────────────┘
/// ```
pub struct AdapterActor<A: SourceAdapter> {
    /// The user's adapter implementation.
    pub adapter: A,
    /// HTTP client (shared I/O layer).
    pub http: FetchClient,
    /// NATS publisher.
    pub nats: NatsState,
    /// Per-actor resilience + metrics state.
    pub state: AdapterState,
}

/// Result of the fetch+parse phase, before NATS publishing.
///
/// Used by [`AdapterServer`](crate::adapter_server::AdapterServer) to separate
/// HTTP I/O from NATS publishing. The GenServer wrapper needs `&Cx` for real
/// NATS publish, so we split the pipeline:
///
/// 1. `poll_fetch_and_parse()` → handles rate limit, circuit, HTTP, parse
/// 2. GenServer `handle_info` → publishes records via `NatsClient` with `&Cx`
///
/// The existing [`AdapterActor::poll_once()`] still works for tests and
/// mock-based usage — it wraps this + synchronous NatsState publish.
#[derive(Debug)]
pub enum FetchResult {
    /// Records successfully fetched and parsed, ready for NATS publishing.
    Records {
        records: Vec<Record>,
        bytes_fetched: usize,
        elapsed: Duration,
    },
    /// Server returned 304 Not Modified (no new data).
    NotModified,
    /// Request was skipped because the circuit breaker is open.
    CircuitOpen,
    /// Request was skipped because the adapter is rate-limited.
    RateLimited {
        remaining: Option<Duration>,
    },
    /// HTTP fetch failed.
    FetchFailed {
        error: FetchError,
        retry_attempt: u32,
        will_retry: bool,
    },
    /// Response parsing failed.
    ParseFailed {
        error: String,
    },
}

/// Result of a single poll cycle.
#[derive(Debug)]
pub enum PollOutcome {
    /// Successfully fetched and published records.
    Success {
        records_published: usize,
        bytes_fetched: usize,
        elapsed: Duration,
    },
    /// Server returned 304 Not Modified (no new data).
    NotModified,
    /// Request was skipped because the circuit breaker is open.
    CircuitOpen,
    /// Request was skipped because the adapter is rate-limited.
    RateLimited {
        remaining: Option<Duration>,
    },
    /// Fetch failed (HTTP error, connection error, etc.).
    FetchFailed {
        error: FetchError,
        retry_attempt: u32,
        will_retry: bool,
    },
    /// Response parsing failed.
    ParseFailed {
        error: String,
    },
    /// NATS publish failed.
    PublishFailed {
        error: NatsBridgeError,
        records_attempted: usize,
    },
}

impl<A: SourceAdapter> AdapterActor<A> {
    /// Create a new adapter actor.
    pub fn new(adapter: A, http: FetchClient, nats: NatsState) -> Self {
        Self {
            adapter,
            http,
            nats,
            state: AdapterState::new(),
        }
    }

    /// Create with custom resilience settings.
    pub fn with_state(adapter: A, http: FetchClient, nats: NatsState, state: AdapterState) -> Self {
        Self {
            adapter,
            http,
            nats,
            state,
        }
    }

    /// Execute the fetch+parse phase of a poll cycle.
    ///
    /// This does everything [`poll_once`] does **except** NATS publishing and
    /// final success-path metrics. Returns [`FetchResult`] so the caller can
    /// handle NATS publishing separately (e.g., with a real `NatsClient` + `&Cx`
    /// in the GenServer wrapper).
    ///
    /// For tests and mock usage, prefer [`poll_once`] which wraps this + publish.
    pub async fn poll_fetch_and_parse(&mut self) -> FetchResult {
        // 1. Check rate limit.
        self.state.rate_limit.maybe_clear();
        if self.state.rate_limit.is_rate_limited() {
            return FetchResult::RateLimited {
                remaining: self.state.rate_limit.remaining_backoff(),
            };
        }

        // 2. Check circuit breaker.
        if !self.state.circuit.allow_request() {
            return FetchResult::CircuitOpen;
        }

        // 3. Build request (with conditional headers from cache).
        let base_request = self.adapter.build_request(&self.state);
        let request = self.state.cache.apply_to_request(base_request);

        // 4. Execute HTTP fetch.
        let resp = match self.http.execute(request).await {
            Ok(resp) => resp,
            Err(error) => {
                self.state.circuit.record_failure();
                self.state.retry_attempt += 1;
                let will_retry = self.state.retry_policy.should_retry(self.state.retry_attempt);
                self.state.metrics.polls_failed += 1;
                self.state.metrics.last_error = Some(error.to_string());
                return FetchResult::FetchFailed {
                    error,
                    retry_attempt: self.state.retry_attempt,
                    will_retry,
                };
            }
        };

        // 5. Handle response status.
        let status = resp.status;

        // 5a. 304 Not Modified.
        if status.is_not_modified() {
            self.state.circuit.record_success();
            self.state.retry_attempt = 0;
            self.state.metrics.polls_not_modified += 1;
            return FetchResult::NotModified;
        }

        // 5b. 429 Too Many Requests.
        if status.is_rate_limited() {
            let retry_after = resp.retry_after_secs();
            self.state.rate_limit.record_rate_limit(
                retry_after,
                Duration::from_secs(60),
            );
            self.state.circuit.record_failure();
            self.state.metrics.polls_failed += 1;
            self.state.metrics.last_error = Some("429 Too Many Requests".to_string());
            return FetchResult::RateLimited {
                remaining: self.state.rate_limit.remaining_backoff(),
            };
        }

        // 5c. Other server/client errors.
        if !status.is_success() {
            self.state.circuit.record_failure();
            self.state.retry_attempt += 1;
            let will_retry = status.is_retryable()
                && self.state.retry_policy.should_retry(self.state.retry_attempt);
            self.state.metrics.polls_failed += 1;
            self.state.metrics.last_error = Some(format!("HTTP {}", status));
            return FetchResult::FetchFailed {
                error: FetchError::Protocol(format!("HTTP {status}")),
                retry_attempt: self.state.retry_attempt,
                will_retry,
            };
        }

        // 5d. 2xx Success — parse records.
        let bytes_fetched = resp.body_len();
        self.state.cache.update_from_response(&resp);

        let records = match self.adapter.parse_records(&resp) {
            Ok(records) => records,
            Err(e) => {
                self.state.metrics.polls_failed += 1;
                self.state.metrics.last_error = Some(e.to_string());
                return FetchResult::ParseFailed {
                    error: e.to_string(),
                };
            }
        };

        // Apply max_records_per_poll limit.
        let records = match self.adapter.max_records_per_poll() {
            Some(max) if records.len() > max => records[..max].to_vec(),
            _ => records,
        };

        let elapsed = resp.elapsed;
        FetchResult::Records {
            records,
            bytes_fetched,
            elapsed,
        }
    }

    /// Finalize a successful fetch by publishing records and updating metrics.
    ///
    /// Called after [`poll_fetch_and_parse`] returns `FetchResult::Records`.
    /// This handles the NATS publish via the synchronous `NatsState` + metrics.
    /// The GenServer wrapper uses its own publish path with real `NatsClient`.
    pub fn finalize_publish(
        &mut self,
        records: &[Record],
        bytes_fetched: usize,
        elapsed: Duration,
    ) -> PollOutcome {
        let mut published = 0;
        for record in records {
            let subject = self.adapter.nats_subject(record);
            match self.nats.publish(&subject, &record.payload) {
                Ok(()) => {
                    published += 1;
                    self.state.metrics.bytes_published += record.payload.len() as u64;
                }
                Err(e) => {
                    self.state.metrics.polls_failed += 1;
                    self.state.metrics.last_error = Some(e.to_string());
                    return PollOutcome::PublishFailed {
                        error: e,
                        records_attempted: records.len(),
                    };
                }
            }
        }

        // Success — reset resilience state.
        self.state.circuit.record_success();
        self.state.retry_attempt = 0;
        self.state.metrics.polls_success += 1;
        self.state.metrics.records_published += published as u64;
        self.state.metrics.bytes_fetched += bytes_fetched as u64;
        self.state.metrics.last_success_at = Some(Instant::now());

        PollOutcome::Success {
            records_published: published,
            bytes_fetched,
            elapsed,
        }
    }

    /// Execute one poll cycle. Returns the outcome for logging/metrics.
    ///
    /// This is the **heart of the actor**. The runtime calls this on each
    /// timer tick. All resilience logic is encapsulated here.
    ///
    /// Internally calls [`poll_fetch_and_parse`] + [`finalize_publish`].
    /// For the GenServer wrapper, see [`AdapterServer`](crate::adapter_server::AdapterServer)
    /// which calls `poll_fetch_and_parse` then publishes via real `NatsClient`.
    pub async fn poll_once(&mut self) -> PollOutcome {
        match self.poll_fetch_and_parse().await {
            FetchResult::Records { records, bytes_fetched, elapsed } => {
                self.finalize_publish(&records, bytes_fetched, elapsed)
            }
            FetchResult::NotModified => PollOutcome::NotModified,
            FetchResult::CircuitOpen => PollOutcome::CircuitOpen,
            FetchResult::RateLimited { remaining } => PollOutcome::RateLimited { remaining },
            FetchResult::FetchFailed { error, retry_attempt, will_retry } => {
                PollOutcome::FetchFailed { error, retry_attempt, will_retry }
            }
            FetchResult::ParseFailed { error } => PollOutcome::ParseFailed { error },
        }
    }

    /// Get the delay before the next poll, accounting for retry backoff.
    ///
    /// - Normal: use the adapter's `poll_interval()`
    /// - Retry: use the retry policy's exponential backoff
    /// - Rate-limited: use the remaining backoff time
    #[must_use]
    pub fn next_poll_delay(&self) -> Duration {
        // If rate-limited, wait for the backoff to expire.
        if let Some(remaining) = self.state.rate_limit.remaining_backoff() {
            return remaining;
        }

        // If retrying, use exponential backoff.
        if self.state.retry_attempt > 0
            && self.state.retry_policy.should_retry(self.state.retry_attempt)
        {
            return self.state.retry_policy.delay_for_attempt(self.state.retry_attempt);
        }

        // Normal interval.
        self.adapter.poll_interval()
    }

    /// Adapter name (delegates to the inner adapter).
    #[must_use]
    pub fn name(&self) -> &str {
        self.adapter.name()
    }

    /// Current circuit state.
    #[must_use]
    pub fn circuit_state(&self) -> CircuitState {
        self.state.circuit.state()
    }

    /// Snapshot of current metrics.
    #[must_use]
    pub fn metrics(&self) -> &AdapterMetrics {
        &self.state.metrics
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::client::{FetchClient, FetchRequest, FetchResponse, FetchStatus};
    use crate::nats_bridge::{NatsClientWrapper, NatsState};
    use std::pin::Pin;
    use std::task::{Context as TaskContext, Poll, RawWaker, RawWakerVTable, Waker};

    fn block_on<F: std::future::Future>(mut fut: F) -> F::Output {
        fn noop(_: *const ()) {}
        fn noop_clone(_: *const ()) -> RawWaker {
            RawWaker::new(std::ptr::null(), &VTABLE)
        }
        static VTABLE: RawWakerVTable = RawWakerVTable::new(noop_clone, noop, noop, noop);
        let waker = unsafe { Waker::from_raw(RawWaker::new(std::ptr::null(), &VTABLE)) };
        let mut cx = TaskContext::from_waker(&waker);
        let pinned = unsafe { Pin::new_unchecked(&mut fut) };
        match pinned.poll(&mut cx) {
            Poll::Ready(val) => val,
            Poll::Pending => panic!("block_on: future returned Pending"),
        }
    }

    // ── Test adapter ─────────────────────────────────────────────────────

    struct TestAdapter {
        url: String,
        interval: Duration,
    }

    impl TestAdapter {
        fn new() -> Self {
            Self {
                url: "https://api.example.com/data".to_string(),
                interval: Duration::from_secs(10),
            }
        }
    }

    impl SourceAdapter for TestAdapter {
        fn name(&self) -> &str { "test" }
        fn signal_kind(&self) -> &str { "adsb" }
        fn source_id(&self) -> &str { "testfeed" }
        fn default_format(&self) -> &str { "json" }

        fn build_request(&self, _state: &AdapterState) -> FetchRequest {
            FetchRequest::get(&self.url).accept_json()
        }

        fn parse_records(&self, resp: &FetchResponse) -> Result<Vec<Record>, AdapterError> {
            // Parse as JSON array, each element becomes a record.
            let data: serde_json::Value = resp.json()
                .map_err(|e| AdapterError::Parse(e.to_string()))?;

            match data.as_array() {
                Some(arr) => Ok(arr.iter().map(|v| Record {
                    payload: serde_json::to_vec(v).unwrap_or_default(),
                    subject_suffix: v["id"].as_str().map(String::from),
                }).collect()),
                None => Ok(vec![Record {
                    payload: resp.body.clone(),
                    subject_suffix: None,
                }]),
            }
        }

        fn poll_interval(&self) -> Duration { self.interval }
    }

    fn make_test_actor() -> AdapterActor<TestAdapter> {
        let http = FetchClient::for_testing();
        let nats = NatsState::new(NatsClientWrapper::for_testing());
        AdapterActor::new(TestAdapter::new(), http, nats)
    }

    // ── CircuitBreaker ───────────────────────────────────────────────────

    #[test]
    fn circuit_breaker_closed_to_open() {
        let mut cb = CircuitBreaker::new(3, Duration::from_secs(30));
        assert_eq!(cb.state(), CircuitState::Closed);
        assert!(cb.allow_request());

        cb.record_failure();
        assert_eq!(cb.state(), CircuitState::Closed); // 1/3
        cb.record_failure();
        assert_eq!(cb.state(), CircuitState::Closed); // 2/3
        cb.record_failure();
        assert_eq!(cb.state(), CircuitState::Open); // 3/3 → tripped
        assert_eq!(cb.total_trips(), 1);

        assert!(!cb.allow_request()); // circuit is open
    }

    #[test]
    fn circuit_breaker_success_resets() {
        let mut cb = CircuitBreaker::new(3, Duration::from_secs(30));
        cb.record_failure();
        cb.record_failure();
        assert_eq!(cb.consecutive_failures(), 2);

        cb.record_success();
        assert_eq!(cb.consecutive_failures(), 0);
        assert_eq!(cb.state(), CircuitState::Closed);

        // Need 3 fresh failures to trip again.
        cb.record_failure();
        cb.record_failure();
        assert_eq!(cb.state(), CircuitState::Closed);
    }

    #[test]
    fn circuit_breaker_half_open_probe() {
        let mut cb = CircuitBreaker::new(2, Duration::from_millis(1));

        // Trip it.
        cb.record_failure();
        cb.record_failure();
        assert_eq!(cb.state(), CircuitState::Open);

        // Wait for recovery timeout.
        std::thread::sleep(Duration::from_millis(5));

        // Should transition to HalfOpen and allow one request.
        assert!(cb.allow_request());
        assert_eq!(cb.state(), CircuitState::HalfOpen);

        // Probe succeeds → back to Closed.
        cb.record_success();
        assert_eq!(cb.state(), CircuitState::Closed);
    }

    #[test]
    fn circuit_breaker_half_open_probe_fails() {
        let mut cb = CircuitBreaker::new(2, Duration::from_millis(1));

        cb.record_failure();
        cb.record_failure();
        std::thread::sleep(Duration::from_millis(5));

        assert!(cb.allow_request()); // HalfOpen
        cb.record_failure(); // Probe fails → back to Open
        assert_eq!(cb.state(), CircuitState::Open);
        assert_eq!(cb.total_trips(), 2);
    }

    // ── RetryPolicy ──────────────────────────────────────────────────────

    #[test]
    fn retry_policy_exponential_backoff() {
        let policy = RetryPolicy {
            base_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(30),
            multiplier: 2.0,
            max_retries: 5,
        };

        assert_eq!(policy.delay_for_attempt(0), Duration::from_secs(1)); // 1 * 2^0
        assert_eq!(policy.delay_for_attempt(1), Duration::from_secs(2)); // 1 * 2^1
        assert_eq!(policy.delay_for_attempt(2), Duration::from_secs(4)); // 1 * 2^2
        assert_eq!(policy.delay_for_attempt(3), Duration::from_secs(8)); // 1 * 2^3
        assert_eq!(policy.delay_for_attempt(4), Duration::from_secs(16)); // 1 * 2^4
        assert_eq!(policy.delay_for_attempt(5), Duration::from_secs(30)); // capped at max_delay

        assert!(policy.should_retry(0));
        assert!(policy.should_retry(4));
        assert!(!policy.should_retry(5));
    }

    // ── RateLimitState ───────────────────────────────────────────────────

    #[test]
    fn rate_limit_state() {
        let mut rl = RateLimitState::new();
        assert!(!rl.is_rate_limited());

        // Record a rate limit with a very short backoff.
        rl.record_rate_limit(Some(0), Duration::from_secs(60));
        assert_eq!(rl.total_rate_limits, 1);

        // After clearing (immediate since retry_after was 0).
        std::thread::sleep(Duration::from_millis(5));
        rl.maybe_clear();
        assert!(!rl.is_rate_limited());
    }

    // ── ConditionalCache ─────────────────────────────────────────────────

    #[test]
    fn conditional_cache_update_and_apply() {
        let mut cache = ConditionalCache::default();
        assert!(cache.etag.is_none());
        assert!(cache.last_modified.is_none());

        let resp = FetchResponse {
            status: FetchStatus(200),
            headers: vec![
                ("ETag".to_string(), "\"v2\"".to_string()),
                ("Last-Modified".to_string(), "Thu, 20 Feb 2026".to_string()),
            ],
            body: Vec::new(),
            request_id: 1,
            elapsed: Duration::ZERO,
        };

        cache.update_from_response(&resp);
        assert_eq!(cache.etag.as_deref(), Some("\"v2\""));
        assert_eq!(cache.last_modified.as_deref(), Some("Thu, 20 Feb 2026"));

        // Apply to a request.
        let req = cache.apply_to_request(FetchRequest::get("https://api.example.com"));
        assert!(req.headers.iter().any(|(k, v)| k == "If-None-Match" && v == "\"v2\""));
        assert!(req.headers.iter().any(|(k, v)| k == "If-Modified-Since" && v == "Thu, 20 Feb 2026"));
    }

    // ── AdapterActor::poll_once ──────────────────────────────────────────

    #[test]
    fn poll_once_success() {
        let mut actor = make_test_actor();

        // Mock: API returns 3 aircraft records.
        actor.http.mock_response(FetchResponse {
            status: FetchStatus(200),
            headers: vec![("etag".to_string(), "\"abc\"".to_string())],
            body: br#"[{"id":"A1","lat":40.0},{"id":"A2","lat":41.0},{"id":"A3","lat":42.0}]"#.to_vec(),
            request_id: 0,
            elapsed: Duration::from_millis(50),
        });

        let outcome = block_on(actor.poll_once());
        match outcome {
            PollOutcome::Success { records_published: 3, bytes_fetched, .. } => {
                assert!(bytes_fetched > 0);
            }
            other => panic!("expected Success, got: {other:?}"),
        }

        // Verify actor state was updated.
        assert_eq!(actor.state.metrics.polls_success, 1);
        assert_eq!(actor.state.metrics.records_published, 3);
        assert_eq!(actor.state.cache.etag.as_deref(), Some("\"abc\""));
        assert_eq!(actor.state.circuit.state(), CircuitState::Closed);

        // Verify NATS publishes.
        let nats_guard = actor.nats.client.lock();
        assert_eq!(nats_guard.publishes.len(), 3);
        assert_eq!(nats_guard.publishes[0].0, "sensor.adsb.testfeed.json.A1");
        assert_eq!(nats_guard.publishes[1].0, "sensor.adsb.testfeed.json.A2");
        assert_eq!(nats_guard.publishes[2].0, "sensor.adsb.testfeed.json.A3");
    }

    #[test]
    fn poll_once_not_modified() {
        let mut actor = make_test_actor();
        actor.state.cache.etag = Some("\"v1\"".to_string());

        // Mock: 304 Not Modified.
        actor.http.mock_response(FetchResponse {
            status: FetchStatus(304),
            headers: Vec::new(),
            body: Vec::new(),
            request_id: 0,
            elapsed: Duration::from_millis(10),
        });

        let outcome = block_on(actor.poll_once());
        assert!(matches!(outcome, PollOutcome::NotModified));
        assert_eq!(actor.state.metrics.polls_not_modified, 1);
        assert_eq!(actor.state.circuit.state(), CircuitState::Closed);

        // Verify conditional header was sent.
        let recorded = actor.http.recorded_requests();
        assert!(recorded[0].headers.iter().any(|(k, v)| k == "If-None-Match" && v == "\"v1\""));
    }

    #[test]
    fn poll_once_rate_limited() {
        let mut actor = make_test_actor();

        // Mock: 429 with Retry-After.
        actor.http.mock_response(FetchResponse {
            status: FetchStatus(429),
            headers: vec![("Retry-After".to_string(), "30".to_string())],
            body: b"rate limited".to_vec(),
            request_id: 0,
            elapsed: Duration::from_millis(5),
        });

        let outcome = block_on(actor.poll_once());
        match outcome {
            PollOutcome::RateLimited { remaining } => {
                // Should be close to 30 seconds.
                assert!(remaining.unwrap() > Duration::from_secs(29));
            }
            other => panic!("expected RateLimited, got: {other:?}"),
        }

        assert!(actor.state.rate_limit.is_rate_limited());
        assert_eq!(actor.state.rate_limit.total_rate_limits, 1);

        // Next poll should be skipped (rate-limited).
        let outcome2 = block_on(actor.poll_once());
        assert!(matches!(outcome2, PollOutcome::RateLimited { .. }));
    }

    #[test]
    fn poll_once_server_error_trips_circuit() {
        let mut actor = make_test_actor();
        actor.state.circuit = CircuitBreaker::new(2, Duration::from_secs(30));

        // Two 503 errors → should trip circuit.
        for _ in 0..2 {
            actor.http.mock_response(FetchResponse {
                status: FetchStatus(503),
                headers: Vec::new(),
                body: b"unavailable".to_vec(),
                request_id: 0,
                elapsed: Duration::ZERO,
            });
        }

        let outcome1 = block_on(actor.poll_once());
        assert!(matches!(outcome1, PollOutcome::FetchFailed { will_retry: true, .. }));
        assert_eq!(actor.state.circuit.state(), CircuitState::Closed); // 1/2

        let outcome2 = block_on(actor.poll_once());
        assert!(matches!(outcome2, PollOutcome::FetchFailed { .. }));
        assert_eq!(actor.state.circuit.state(), CircuitState::Open); // 2/2 → tripped

        // Next poll should short-circuit.
        let outcome3 = block_on(actor.poll_once());
        assert!(matches!(outcome3, PollOutcome::CircuitOpen));
    }

    #[test]
    fn poll_once_connection_error() {
        let mut actor = make_test_actor();

        // Inject a connection error.
        actor.http.mock_error_injector(|_m, _u| {
            Some(FetchError::ConnectionFailed("refused".to_string()))
        });

        let outcome = block_on(actor.poll_once());
        match outcome {
            PollOutcome::FetchFailed { error, retry_attempt: 1, will_retry: true } => {
                assert!(error.to_string().contains("refused"));
            }
            other => panic!("expected FetchFailed, got: {other:?}"),
        }
        assert_eq!(actor.state.circuit.consecutive_failures(), 1);
    }

    #[test]
    fn poll_once_parse_error() {
        let mut actor = make_test_actor();

        // Mock: 200 but invalid body.
        actor.http.mock_response(FetchResponse {
            status: FetchStatus(200),
            headers: Vec::new(),
            body: b"not json at all".to_vec(),
            request_id: 0,
            elapsed: Duration::ZERO,
        });

        let outcome = block_on(actor.poll_once());
        assert!(matches!(outcome, PollOutcome::ParseFailed { .. }));
        assert_eq!(actor.state.metrics.polls_failed, 1);
    }

    #[test]
    fn next_poll_delay_normal() {
        let actor = make_test_actor();
        assert_eq!(actor.next_poll_delay(), Duration::from_secs(10));
    }

    #[test]
    fn next_poll_delay_retry_backoff() {
        let mut actor = make_test_actor();
        actor.state.retry_attempt = 3;
        // 1s * 2^3 = 8s
        assert_eq!(actor.next_poll_delay(), Duration::from_secs(8));
    }

    #[test]
    fn nats_subject_with_suffix() {
        let adapter = TestAdapter::new();
        let record_with = Record {
            payload: Vec::new(),
            subject_suffix: Some("A12345".to_string()),
        };
        let record_without = Record {
            payload: Vec::new(),
            subject_suffix: None,
        };
        assert_eq!(adapter.nats_subject(&record_with), "sensor.adsb.testfeed.json.A12345");
        assert_eq!(adapter.nats_subject(&record_without), "sensor.adsb.testfeed.json");
    }

    // ── OpenSky-style adapter (realistic integration tests) ─────────────

    struct OpenSkyAdapter {
        bbox: [f64; 4],
        authenticated: bool,
    }

    impl OpenSkyAdapter {
        fn new() -> Self {
            Self {
                bbox: [40.0, 42.0, -74.5, -71.5],
                authenticated: false,
            }
        }
    }

    impl SourceAdapter for OpenSkyAdapter {
        fn name(&self) -> &str { "opensky" }
        fn signal_kind(&self) -> &str { "adsb" }
        fn source_id(&self) -> &str { "opensky" }
        fn default_format(&self) -> &str { "json" }

        fn build_request(&self, _state: &AdapterState) -> FetchRequest {
            let [lamin, lamax, lomin, lomax] = self.bbox;
            FetchRequest::get(format!(
                "https://opensky-network.org/api/states/all?lamin={lamin}&lamax={lamax}&lomin={lomin}&lomax={lomax}"
            )).accept_json()
        }

        fn parse_records(&self, resp: &FetchResponse) -> Result<Vec<Record>, AdapterError> {
            let data: serde_json::Value = resp.json()
                .map_err(|e| AdapterError::Parse(e.to_string()))?;
            let states = data["states"]
                .as_array()
                .ok_or_else(|| AdapterError::Parse("missing 'states' array".into()))?;

            Ok(states.iter().map(|s| {
                let arr = s.as_array().unwrap();
                let icao = arr[0].as_str().unwrap_or("unknown").trim().to_lowercase();
                let aircraft = serde_json::json!({
                    "icao24": icao,
                    "callsign": arr.get(1).and_then(|v| v.as_str()).map(str::trim),
                    "longitude": arr.get(5),
                    "latitude": arr.get(6),
                    "baro_altitude": arr.get(7),
                    "velocity": arr.get(9),
                });
                Record {
                    payload: serde_json::to_vec(&aircraft).unwrap(),
                    subject_suffix: Some(icao),
                }
            }).collect())
        }

        fn poll_interval(&self) -> Duration {
            if self.authenticated { Duration::from_secs(5) } else { Duration::from_secs(10) }
        }

        fn max_records_per_poll(&self) -> Option<usize> { Some(500) }
    }

    fn opensky_response_body() -> Vec<u8> {
        serde_json::to_vec(&serde_json::json!({
            "time": 1740100000,
            "states": [
                ["a12345", "UAL123  ", "US", 0, 0, -73.8, 40.6, 10668.0, false, 250.0, 45.0, 0.0, null, 10706.0, "1234", false, 0],
                ["a67890", "DAL456  ", "US", 0, 0, -74.0, 40.7, 8534.0, false, 200.0, 90.0, -5.0, null, 8600.0, "5678", false, 0],
                ["abc123", "  ", "CA", 0, 0, -73.5, 41.0, 12000.0, false, 300.0, 180.0, 0.0, null, 12100.0, null, false, 0],
            ]
        })).unwrap()
    }

    fn make_opensky_actor() -> AdapterActor<OpenSkyAdapter> {
        let http = FetchClient::for_testing();
        let nats = NatsState::new(NatsClientWrapper::for_testing());
        AdapterActor::new(OpenSkyAdapter::new(), http, nats)
    }

    #[test]
    fn opensky_full_pipeline() {
        let mut actor = make_opensky_actor();
        actor.http.mock_response(FetchResponse {
            status: FetchStatus(200),
            headers: vec![
                ("content-type".to_string(), "application/json".to_string()),
                ("etag".to_string(), "\"v42\"".to_string()),
            ],
            body: opensky_response_body(),
            request_id: 0,
            elapsed: Duration::from_millis(200),
        });

        let outcome = block_on(actor.poll_once());
        match outcome {
            PollOutcome::Success { records_published: 3, .. } => {}
            other => panic!("expected Success(3), got: {other:?}"),
        }

        assert_eq!(actor.state.metrics.polls_success, 1);
        assert_eq!(actor.state.metrics.records_published, 3);
        assert_eq!(actor.state.cache.etag.as_deref(), Some("\"v42\""));

        // Verify per-aircraft NATS subjects.
        let nats = actor.nats.client.lock();
        assert_eq!(nats.publishes.len(), 3);
        assert_eq!(nats.publishes[0].0, "sensor.adsb.opensky.json.a12345");
        assert_eq!(nats.publishes[1].0, "sensor.adsb.opensky.json.a67890");
        assert_eq!(nats.publishes[2].0, "sensor.adsb.opensky.json.abc123");

        // Verify parsed payload.
        let a1: serde_json::Value = serde_json::from_slice(&nats.publishes[0].1).unwrap();
        assert_eq!(a1["icao24"], "a12345");
        assert_eq!(a1["callsign"], "UAL123");
        assert_eq!(a1["longitude"], -73.8);
    }

    #[test]
    fn opensky_conditional_get_304() {
        let mut actor = make_opensky_actor();
        actor.state.cache.etag = Some("\"v42\"".to_string());

        actor.http.mock_response(FetchResponse {
            status: FetchStatus(304),
            headers: Vec::new(),
            body: Vec::new(),
            request_id: 0,
            elapsed: Duration::from_millis(30),
        });

        let outcome = block_on(actor.poll_once());
        assert!(matches!(outcome, PollOutcome::NotModified));
        assert_eq!(actor.state.metrics.polls_not_modified, 1);

        let recorded = actor.http.recorded_requests();
        assert!(recorded[0].headers.iter().any(|(k, v)| k == "If-None-Match" && v == "\"v42\""));
    }

    #[test]
    fn opensky_rate_limit_429() {
        let mut actor = make_opensky_actor();

        actor.http.mock_response(FetchResponse {
            status: FetchStatus(429),
            headers: vec![("Retry-After".to_string(), "60".to_string())],
            body: b"rate limit exceeded".to_vec(),
            request_id: 0,
            elapsed: Duration::from_millis(10),
        });

        let outcome = block_on(actor.poll_once());
        match outcome {
            PollOutcome::RateLimited { remaining } => {
                assert!(remaining.unwrap() > Duration::from_secs(59));
            }
            other => panic!("expected RateLimited, got: {other:?}"),
        }

        // Subsequent poll skipped.
        assert!(matches!(block_on(actor.poll_once()), PollOutcome::RateLimited { .. }));
    }

    #[test]
    fn opensky_circuit_trips() {
        let mut actor = make_opensky_actor();
        actor.state.circuit = CircuitBreaker::new(2, Duration::from_secs(30));

        for _ in 0..2 {
            actor.http.mock_response(FetchResponse {
                status: FetchStatus(503),
                headers: Vec::new(),
                body: b"unavailable".to_vec(),
                request_id: 0,
                elapsed: Duration::ZERO,
            });
        }

        block_on(actor.poll_once());
        block_on(actor.poll_once());
        assert_eq!(actor.circuit_state(), CircuitState::Open);
        assert!(matches!(block_on(actor.poll_once()), PollOutcome::CircuitOpen));
    }
}
