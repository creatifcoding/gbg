//! Live GenServer wrapper for source adapter actors.
//!
//! [`AdapterServer`] wraps an [`AdapterActor`] as a supervised GenServer actor
//! with timer-driven polling and real NATS publishing. This is the production
//! entry point for running source adapters in the asupersync runtime.
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────┐     try_info(PollTick)     ┌──────────────────────────┐
//! │   Timer Task     │ ─────────────────────────▶ │    AdapterServer<A>      │
//! │                 │                             │    (GenServer)            │
//! │ loop {           │                             │                          │
//! │   sleep(interval)│                             │  handle_info(PollTick):  │
//! │   try_info(Tick) │                             │    poll_fetch_and_parse  │
//! │ }                │                             │    nats.publish(cx,...)  │
//! └─────────────────┘                             └──────────────────────────┘
//! ```
//!
//! # Timer Pattern
//!
//! asupersync has no `send_after`. Instead, a **sibling task** is spawned
//! alongside the GenServer. The timer fires `PollTick` at the base poll
//! interval. The server gates each tick with `next_eligible_at` — if the
//! adapter is in retry backoff or rate-limited, ticks are no-ops until
//! the delay expires.
//!
//! # Usage
//!
//! ```ignore
//! use ava_web::adapter_server::AdapterServerBuilder;
//! use ava_web::source_adapter::CircuitBreaker;
//! use std::time::Duration;
//!
//! let builder = AdapterServerBuilder::new(my_adapter, http_client, nats_state)
//!     .nats_client(real_nats)
//!     .circuit_breaker(CircuitBreaker::new(5, Duration::from_secs(30)))
//!     .mailbox_capacity(128);
//!
//! // Spawn server + timer as supervised siblings.
//! let handle = builder.spawn(&scope, &mut runtime_state, &cx)?;
//! ```

use std::future::Future;
use std::pin::Pin;
use std::time::{Duration, Instant};

use asupersync::gen_server::{GenServer, GenServerHandle, GenServerRef, Reply};
use asupersync::messaging::nats::NatsClient;
use asupersync::runtime::{RuntimeState, SpawnError};
use asupersync::time::{sleep, wall_now};
use asupersync::{Cx, Policy, Scope};

use crate::client::FetchClient;
use crate::nats_bridge::NatsState;
use crate::source_adapter::{
    AdapterActor, AdapterMetrics, AdapterState, CircuitBreaker, CircuitState, FetchResult,
    PollOutcome, RetryPolicy, SourceAdapter,
};

// ── Messages ────────────────────────────────────────────────────────────────

/// Info messages delivered to the adapter server via `try_info()`.
#[derive(Debug)]
pub enum AdapterInfo {
    /// Timer tick — execute one poll cycle.
    PollTick,
    /// Graceful shutdown (stop accepting polls, drain in-flight).
    Shutdown,
}

/// Synchronous call messages (request-response with linear Reply obligation).
#[derive(Debug)]
pub enum AdapterCall {
    /// Get the adapter's health summary.
    Health,
    /// Get a snapshot of all metrics.
    Metrics,
    /// Get the current circuit breaker state.
    CircuitState,
}

/// Reply payloads for [`AdapterCall`].
#[derive(Debug)]
pub enum AdapterReply {
    /// Health summary.
    Health(AdapterHealth),
    /// Full metrics snapshot.
    Metrics(AdapterMetrics),
    /// Current circuit state.
    CircuitState(CircuitState),
}

/// Health summary returned by [`AdapterCall::Health`].
#[derive(Debug, Clone)]
pub struct AdapterHealth {
    /// Adapter name.
    pub name: String,
    /// Current circuit breaker state.
    pub circuit: CircuitState,
    /// Lifetime successful polls.
    pub polls_success: u64,
    /// Lifetime failed polls.
    pub polls_failed: u64,
    /// Most recent error message (if any).
    pub last_error: Option<String>,
    /// Whether the adapter is currently rate-limited.
    pub is_rate_limited: bool,
}

// ── Server ──────────────────────────────────────────────────────────────────

/// Supervised GenServer wrapper for a source adapter.
///
/// Owns:
/// - [`AdapterActor<A>`] — HTTP client, resilience state, adapter logic
/// - `Option<NatsClient>` — real NATS for production, `None` for test/mock
/// - Server-side poll gating via `next_eligible_at`
///
/// On each `PollTick`:
/// 1. Gate by `next_eligible_at` (skip if too early)
/// 2. Call `inner.poll_fetch_and_parse()` for HTTP I/O + parsing
/// 3. Publish records via `NatsClient::publish(cx, ...)` (needs `&Cx`)
/// 4. Update metrics, schedule next eligible time
///
/// # Supervision
///
/// When the server crashes, asupersync's supervision tree restarts it
/// according to the configured [`RestartConfig`]. The timer sibling task
/// auto-stops when the server dies (`try_info` returns `Err`) and is
/// re-spawned alongside the new server instance.
pub struct AdapterServer<A: SourceAdapter> {
    /// The adapter actor with all resilience state.
    inner: AdapterActor<A>,
    /// Real NATS client (production). `None` = use mock `NatsState` path.
    nats_client: Option<NatsClient>,
    /// Server-side gating: skip ticks before this time.
    next_eligible_at: Option<Instant>,
    /// Base poll interval (cached from adapter at build time).
    poll_interval: Duration,
    /// Whether shutdown has been requested.
    shutting_down: bool,
}

// ── GenServer impl ──────────────────────────────────────────────────────────

impl<A: SourceAdapter> GenServer for AdapterServer<A> {
    type Call = AdapterCall;
    type Reply = AdapterReply;
    type Cast = ();
    type Info = AdapterInfo;

    fn handle_call(
        &mut self,
        _cx: &Cx,
        request: Self::Call,
        reply: Reply<Self::Reply>,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(async move {
            let response = match request {
                AdapterCall::Health => AdapterReply::Health(AdapterHealth {
                    name: self.inner.name().to_string(),
                    circuit: self.inner.circuit_state(),
                    polls_success: self.inner.metrics().polls_success,
                    polls_failed: self.inner.metrics().polls_failed,
                    last_error: self.inner.metrics().last_error.clone(),
                    is_rate_limited: self.inner.state.rate_limit.is_rate_limited(),
                }),
                AdapterCall::Metrics => {
                    AdapterReply::Metrics(self.inner.metrics().clone())
                }
                AdapterCall::CircuitState => {
                    AdapterReply::CircuitState(self.inner.circuit_state())
                }
            };
            let _ = reply.send(response);
        })
    }

    fn handle_info(
        &mut self,
        cx: &Cx,
        msg: Self::Info,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        // Clone Cx so the async block owns it (outlives the `&Cx` borrow).
        let cx_owned = cx.clone();
        Box::pin(async move {
            match msg {
                AdapterInfo::PollTick => {
                    if !self.shutting_down {
                        self.handle_poll_tick(&cx_owned).await;
                    }
                }
                AdapterInfo::Shutdown => {
                    self.shutting_down = true;
                    tracing::info!(
                        adapter = self.inner.name(),
                        "graceful shutdown requested"
                    );
                }
            }
        })
    }

    fn on_start(
        &mut self,
        _cx: &Cx,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(async move {
            tracing::info!(
                adapter = self.inner.name(),
                interval_ms = self.poll_interval.as_millis() as u64,
                has_nats = self.nats_client.is_some(),
                "adapter server started"
            );
        })
    }

    fn on_stop(
        &mut self,
        _cx: &Cx,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(async move {
            let m = self.inner.metrics();
            tracing::info!(
                adapter = self.inner.name(),
                polls_success = m.polls_success,
                polls_failed = m.polls_failed,
                records_published = m.records_published,
                bytes_fetched = m.bytes_fetched,
                circuit_trips = self.inner.state.circuit.total_trips(),
                "adapter server stopped"
            );
        })
    }
}

// ── Core logic ──────────────────────────────────────────────────────────────

impl<A: SourceAdapter> AdapterServer<A> {
    /// Handle a poll tick: gate → fetch → parse → publish → schedule next.
    async fn handle_poll_tick(&mut self, cx: &Cx) {
        // Server-side gating: if the timer fires before we're eligible, skip.
        if let Some(eligible_at) = self.next_eligible_at {
            if Instant::now() < eligible_at {
                return;
            }
        }

        // Phase 1: fetch + parse (all HTTP I/O, no Cx needed).
        let result = self.inner.poll_fetch_and_parse().await;

        match result {
            FetchResult::Records {
                records,
                bytes_fetched,
                elapsed,
            } => {
                if let Some(ref mut nats) = self.nats_client {
                    // ── Production path: real NatsClient + Cx ──────────
                    let mut published = 0usize;
                    for record in &records {
                        let subject = self.inner.adapter.nats_subject(record);
                        match nats.publish(cx, &subject, &record.payload).await {
                            Ok(()) => {
                                published += 1;
                                self.inner.state.metrics.bytes_published +=
                                    record.payload.len() as u64;
                            }
                            Err(e) => {
                                tracing::error!(
                                    adapter = self.inner.name(),
                                    error = %e,
                                    subject = %subject,
                                    published_before_fail = published,
                                    "NATS publish failed"
                                );
                                self.inner.state.metrics.polls_failed += 1;
                                self.inner.state.metrics.last_error =
                                    Some(format!("nats: {e}"));
                                self.schedule_next_poll();
                                return;
                            }
                        }
                    }

                    // Success — update resilience + metrics.
                    self.inner.state.circuit.record_success();
                    self.inner.state.retry_attempt = 0;
                    self.inner.state.metrics.polls_success += 1;
                    self.inner.state.metrics.records_published += published as u64;
                    self.inner.state.metrics.bytes_fetched += bytes_fetched as u64;
                    self.inner.state.metrics.last_success_at = Some(Instant::now());

                    tracing::info!(
                        adapter = self.inner.name(),
                        records = published,
                        bytes = bytes_fetched,
                        elapsed_ms = elapsed.as_millis() as u64,
                        "poll success"
                    );
                } else {
                    // ── Mock/test path: synchronous NatsState publish ──
                    let outcome =
                        self.inner.finalize_publish(&records, bytes_fetched, elapsed);
                    if let PollOutcome::PublishFailed { ref error, .. } = outcome {
                        tracing::error!(
                            adapter = self.inner.name(),
                            error = %error,
                            "publish failed (mock)"
                        );
                    }
                }
            }
            FetchResult::NotModified => {
                tracing::debug!(adapter = self.inner.name(), "304 not modified");
            }
            FetchResult::CircuitOpen => {
                tracing::warn!(adapter = self.inner.name(), "circuit open, skipping");
            }
            FetchResult::RateLimited { remaining } => {
                tracing::warn!(
                    adapter = self.inner.name(),
                    remaining_ms = remaining.map(|d| d.as_millis() as u64),
                    "rate limited, skipping"
                );
            }
            FetchResult::FetchFailed {
                error,
                retry_attempt,
                will_retry,
            } => {
                tracing::error!(
                    adapter = self.inner.name(),
                    error = %error,
                    attempt = retry_attempt,
                    will_retry,
                    "fetch failed"
                );
            }
            FetchResult::ParseFailed { error } => {
                tracing::error!(
                    adapter = self.inner.name(),
                    error = %error,
                    "parse failed"
                );
            }
        }

        self.schedule_next_poll();
    }

    /// Compute and set the next eligible poll time.
    fn schedule_next_poll(&mut self) {
        let delay = self.inner.next_poll_delay();
        self.next_eligible_at = Some(Instant::now() + delay);
    }

    /// Read-only access to the inner adapter actor.
    #[must_use]
    pub fn inner(&self) -> &AdapterActor<A> {
        &self.inner
    }

    /// Mutable access to the inner adapter actor (testing).
    pub fn inner_mut(&mut self) -> &mut AdapterActor<A> {
        &mut self.inner
    }

    /// Current poll interval.
    #[must_use]
    pub fn poll_interval(&self) -> Duration {
        self.poll_interval
    }

    /// Whether shutdown has been requested.
    #[must_use]
    pub fn is_shutting_down(&self) -> bool {
        self.shutting_down
    }
}

// ── Builder ─────────────────────────────────────────────────────────────────

/// Builder for constructing and spawning an [`AdapterServer`].
///
/// Accumulates configuration, then either:
/// - `.build()` for the raw server instance (testing)
/// - `.spawn()` to spawn server + timer as supervised siblings (production)
///
/// # Example
///
/// ```ignore
/// let handle = AdapterServerBuilder::new(adapter, http, nats_state)
///     .nats_client(real_nats)
///     .circuit_breaker(CircuitBreaker::new(5, Duration::from_secs(30)))
///     .retry_policy(RetryPolicy { max_retries: 10, ..Default::default() })
///     .mailbox_capacity(128)
///     .spawn(&scope, &mut state, &cx)?;
/// ```
pub struct AdapterServerBuilder<A: SourceAdapter> {
    adapter: A,
    http: FetchClient,
    nats_state: NatsState,
    nats_client: Option<NatsClient>,
    circuit: Option<CircuitBreaker>,
    retry_policy: Option<RetryPolicy>,
    poll_interval_override: Option<Duration>,
    mailbox_capacity: usize,
}

impl<A: SourceAdapter> AdapterServerBuilder<A> {
    /// Create a builder with required components.
    ///
    /// The `nats_state` provides the mock/synchronous NATS path.
    /// For production, also call `.nats_client()` with a real client.
    pub fn new(adapter: A, http: FetchClient, nats_state: NatsState) -> Self {
        Self {
            adapter,
            http,
            nats_state,
            nats_client: None,
            circuit: None,
            retry_policy: None,
            poll_interval_override: None,
            mailbox_capacity: 64,
        }
    }

    /// Set the real NATS client for production publishing.
    ///
    /// Without this, the server falls back to the mock `NatsState` path.
    pub fn nats_client(mut self, client: NatsClient) -> Self {
        self.nats_client = Some(client);
        self
    }

    /// Override the default circuit breaker configuration.
    pub fn circuit_breaker(mut self, cb: CircuitBreaker) -> Self {
        self.circuit = Some(cb);
        self
    }

    /// Override the default retry policy.
    pub fn retry_policy(mut self, rp: RetryPolicy) -> Self {
        self.retry_policy = Some(rp);
        self
    }

    /// Override the adapter's default poll interval.
    pub fn poll_interval(mut self, interval: Duration) -> Self {
        self.poll_interval_override = Some(interval);
        self
    }

    /// Set the GenServer mailbox capacity (default: 64).
    pub fn mailbox_capacity(mut self, capacity: usize) -> Self {
        self.mailbox_capacity = capacity;
        self
    }

    /// Build the server instance without spawning.
    ///
    /// Useful for testing or when manual spawning is needed.
    pub fn build(self) -> AdapterServer<A> {
        let poll_interval = self
            .poll_interval_override
            .unwrap_or_else(|| self.adapter.poll_interval());

        let adapter_state = match (self.circuit, self.retry_policy) {
            (Some(cb), Some(rp)) => AdapterState::with_resilience(cb, rp),
            (Some(cb), None) => AdapterState::with_resilience(cb, RetryPolicy::default()),
            (None, Some(rp)) => {
                AdapterState::with_resilience(CircuitBreaker::default_config(), rp)
            }
            (None, None) => AdapterState::new(),
        };

        let inner =
            AdapterActor::with_state(self.adapter, self.http, self.nats_state, adapter_state);

        AdapterServer {
            inner,
            nats_client: self.nats_client,
            next_eligible_at: None,
            poll_interval,
            shutting_down: false,
        }
    }

    /// Spawn the adapter server + timer task as supervised siblings.
    ///
    /// Returns the [`GenServerHandle`] for the adapter server. The timer
    /// auto-stops when the server dies (`try_info` returns `Err`).
    ///
    /// # Timer Pattern
    ///
    /// ```text
    /// scope.spawn_gen_server(server)       ← GenServer actor
    /// scope.spawn_task(timer_loop)          ← sibling task
    ///   └─ loop { sleep(interval) → try_info(PollTick) }
    /// ```
    ///
    /// The timer fires at the base poll interval. The server gates each tick
    /// with `next_eligible_at` — retry backoff and rate limits are respected
    /// without changing the timer frequency.
    pub fn spawn<P: Policy>(
        self,
        scope: &Scope<'_, P>,
        state: &mut RuntimeState,
        cx: &Cx,
    ) -> Result<GenServerHandle<AdapterServer<A>>, SpawnError> {
        let poll_interval = self
            .poll_interval_override
            .unwrap_or_else(|| self.adapter.poll_interval());
        let mailbox_capacity = self.mailbox_capacity;

        let server = self.build();

        // 1. Spawn the GenServer actor.
        let (handle, _stored) =
            scope.spawn_gen_server(state, cx, server, mailbox_capacity)?;
        let server_ref: GenServerRef<AdapterServer<A>> = handle.server_ref();

        // 2. Spawn the timer sibling task.
        //    Fires PollTick at fixed interval. Self-terminates when server dies.
        let (_timer_handle, _timer_stored) =
            scope.spawn_task(state, cx, move |_cx| async move {
                loop {
                    let now = wall_now();
                    sleep(now, poll_interval).await;
                    if server_ref.try_info(AdapterInfo::PollTick).is_err() {
                        // Server stopped — exit timer loop.
                        break;
                    }
                }
            })?;

        Ok(handle)
    }
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::client::{FetchClient, FetchRequest, FetchResponse, FetchStatus};
    use crate::nats_bridge::{NatsClientWrapper, NatsState};
    use crate::source_adapter::{AdapterError, Record, SourceAdapter};

    /// Minimal adapter for builder tests.
    struct TestAdapter;

    impl SourceAdapter for TestAdapter {
        fn name(&self) -> &str {
            "test-server"
        }
        fn signal_kind(&self) -> &str {
            "test"
        }
        fn source_id(&self) -> &str {
            "test"
        }
        fn default_format(&self) -> &str {
            "json"
        }
        fn build_request(
            &self,
            _state: &crate::source_adapter::AdapterState,
        ) -> FetchRequest {
            FetchRequest::get("https://api.example.com/data")
        }
        fn parse_records(
            &self,
            resp: &FetchResponse,
        ) -> Result<Vec<Record>, AdapterError> {
            Ok(vec![Record {
                payload: resp.body.clone(),
                subject_suffix: None,
            }])
        }
        fn poll_interval(&self) -> Duration {
            Duration::from_secs(10)
        }
    }

    #[test]
    fn builder_default_config() {
        let http = FetchClient::for_testing();
        let nats = NatsState::new(NatsClientWrapper::for_testing());

        let server = AdapterServerBuilder::new(TestAdapter, http, nats).build();

        assert_eq!(server.poll_interval(), Duration::from_secs(10));
        assert!(!server.is_shutting_down());
        assert!(server.nats_client.is_none());
        assert_eq!(server.inner().circuit_state(), CircuitState::Closed);
    }

    #[test]
    fn builder_custom_config() {
        let http = FetchClient::for_testing();
        let nats = NatsState::new(NatsClientWrapper::for_testing());

        let server = AdapterServerBuilder::new(TestAdapter, http, nats)
            .circuit_breaker(CircuitBreaker::new(3, Duration::from_secs(15)))
            .retry_policy(RetryPolicy {
                max_retries: 10,
                ..Default::default()
            })
            .poll_interval(Duration::from_secs(5))
            .mailbox_capacity(128)
            .build();

        assert_eq!(server.poll_interval(), Duration::from_secs(5));
        assert_eq!(server.inner().state.retry_policy.max_retries, 10);
    }

    #[test]
    fn builder_preserves_adapter_name() {
        let http = FetchClient::for_testing();
        let nats = NatsState::new(NatsClientWrapper::for_testing());

        let server = AdapterServerBuilder::new(TestAdapter, http, nats).build();

        assert_eq!(server.inner().name(), "test-server");
    }
}
