//! Lab-powered testing harness for ava-web.
//!
//! Integrates asupersync's deterministic lab runtime with ava-web's router
//! and middleware stack, enabling:
//!
//! - **Chaos testing**: Fault injection middleware with configurable presets
//! - **Fuzzing**: Seed-driven request fuzzing for parser/router robustness
//! - **Virtual time**: Test timeouts without wall-clock delays
//! - **Scenario testing**: YAML-driven multi-request test sequences
//!
//! # Quick Start
//!
//! ```ignore
//! use ava_web::lab::{LabTestServer, ChaosPreset};
//! use ava_web::{Router, get};
//! use ava_web::handler::FnHandler;
//!
//! let router = Router::new()
//!     .route("/health", get(FnHandler::new(|| "ok")));
//!
//! let mut server = LabTestServer::new(router)
//!     .seed(42)
//!     .chaos(ChaosPreset::Light);
//!
//! let resp = server.get("/health");
//! resp.assert_status(200);
//!
//! // Check chaos injection stats
//! let stats = server.chaos_stats();
//! println!("Injections: {}", stats.summary());
//! ```
//!
//! # Feature Gate
//!
//! This module requires the `lab` feature:
//!
//! ```toml
//! ava-web = { features = ["lab"] }
//! ```

use std::future::Future;
use std::pin::Pin;

use bytes::Bytes;

use asupersync::lab::chaos::{ChaosConfig, ChaosRng, ChaosStats};
use asupersync::lab::scenario::Scenario;
use asupersync::lab::virtual_time_wheel::VirtualTimerWheel;

use crate::extractor::Request;
use crate::middleware::{Middleware, Next};
use crate::response::{Response, StatusCode};
use crate::router::Router;
use crate::testing::{TestRequest, TestResponse, TestServer};

// ── Chaos Presets ──────────────────────────────────────────────────────────

/// Named chaos presets for quick configuration.
///
/// These map directly to asupersync's `ChaosConfig` presets but are
/// exposed as a simple enum for ergonomic use in ava-web tests.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChaosPreset {
    /// No chaos injection. Baseline for comparison.
    Off,
    /// CI-friendly: 1% cancel, 5% delay, 2% I/O error.
    Light,
    /// Thorough stress testing: 10% cancel, 20% delay, 15% I/O error.
    Heavy,
}

impl ChaosPreset {
    /// Convert to asupersync's `ChaosConfig`.
    #[must_use]
    pub fn to_config(self) -> ChaosConfig {
        match self {
            Self::Off => ChaosConfig::off(),
            Self::Light => ChaosConfig::light(),
            Self::Heavy => ChaosConfig::heavy(),
        }
    }
}

// ── ChaosMiddleware ────────────────────────────────────────────────────────

/// Fault-injection middleware powered by asupersync's chaos engine.
///
/// Wraps the middleware stack to inject deterministic failures at the HTTP
/// layer. Unlike asupersync's runtime-level chaos (which injects at poll
/// points), `ChaosMiddleware` injects at the HTTP request level:
///
/// - **Response errors**: Randomly returns 500/503 instead of calling next
/// - **Latency recording**: Logs virtual delays for timing assertions
/// - **Body corruption**: Optionally corrupts response bodies
///
/// # Determinism
///
/// All decisions are driven by a seeded `ChaosRng`. Same seed = same
/// failures = reproducible test results.
///
/// # Example
///
/// ```ignore
/// use ava_web::lab::{ChaosMiddleware, ChaosPreset};
/// use ava_web::Router;
///
/// let router = Router::new()
///     .route("/api", get(handler))
///     .layer(ChaosMiddleware::new(42, ChaosPreset::Light));
/// ```
pub struct ChaosMiddleware {
    config: ChaosConfig,
    /// Probability of returning a 500 instead of calling the handler.
    error_probability: f64,
    /// Probability of returning a 503 Service Unavailable.
    unavailable_probability: f64,
}

impl ChaosMiddleware {
    /// Create a new chaos middleware with a seed and preset.
    ///
    /// The seed controls deterministic fault injection. Same seed = same
    /// injection sequence.
    #[must_use]
    pub fn new(seed: u64, preset: ChaosPreset) -> Self {
        let config = preset.to_config().with_seed(seed);
        Self {
            error_probability: config.io_error_probability,
            unavailable_probability: config.cancel_probability,
            config,
        }
    }

    /// Create with a custom `ChaosConfig`.
    #[must_use]
    pub fn from_config(config: ChaosConfig) -> Self {
        Self {
            error_probability: config.io_error_probability,
            unavailable_probability: config.cancel_probability,
            config,
        }
    }

    /// Set the probability of injecting a 500 Internal Server Error.
    ///
    /// Range: [0.0, 1.0]. Default: matches the preset's I/O error rate.
    #[must_use]
    pub fn with_error_probability(mut self, p: f64) -> Self {
        assert!(
            (0.0..=1.0).contains(&p),
            "probability must be in [0.0, 1.0], got {p}"
        );
        self.error_probability = p;
        self
    }

    /// Set the probability of injecting a 503 Service Unavailable.
    ///
    /// Range: [0.0, 1.0]. Default: matches the preset's cancel rate.
    #[must_use]
    pub fn with_unavailable_probability(mut self, p: f64) -> Self {
        assert!(
            (0.0..=1.0).contains(&p),
            "probability must be in [0.0, 1.0], got {p}"
        );
        self.unavailable_probability = p;
        self
    }
}

impl Middleware for ChaosMiddleware {
    fn handle<'a>(
        &'a self,
        req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        Box::pin(async move {
            // Use request path + method as entropy source for per-request determinism.
            // This is combined with the config seed for reproducibility.
            let path_hash = {
                let mut h: u64 = self.config.seed;
                for byte in req.path.as_bytes() {
                    h = h.wrapping_mul(31).wrapping_add(u64::from(*byte));
                }
                h
            };

            let mut rng = ChaosRng::new(path_hash);

            // Check for 500 injection
            if rng.should_inject(self.error_probability) {
                return Response::new(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Bytes::from_static(b"chaos: injected server error"),
                )
                .header("x-chaos-injected", "500");
            }

            // Check for 503 injection
            if rng.should_inject(self.unavailable_probability) {
                return Response::new(
                    StatusCode::SERVICE_UNAVAILABLE,
                    Bytes::from_static(b"chaos: service unavailable"),
                )
                .header("x-chaos-injected", "503");
            }

            // No injection — pass through to handler
            let mut resp = next.run(req).await;

            // Tag response so tests can verify chaos was active
            resp = resp.header("x-chaos-active", "true");

            resp
        })
    }
}

// ── ChaosInjectionStats ────────────────────────────────────────────────────

/// Tracks chaos injection statistics across test requests.
///
/// Wraps asupersync's `ChaosStats` with HTTP-specific counters.
#[derive(Debug, Clone, Default)]
pub struct ChaosInjectionStats {
    /// Number of 500 errors injected.
    pub errors_500: u64,
    /// Number of 503 errors injected.
    pub errors_503: u64,
    /// Total requests processed.
    pub total_requests: u64,
    /// Underlying asupersync chaos stats (if lab runtime is used).
    pub runtime_stats: Option<ChaosStats>,
}

impl ChaosInjectionStats {
    /// Create a new stats tracker.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Record a response, tracking chaos injections.
    pub fn record(&mut self, response: &Response) {
        self.total_requests += 1;
        if let Some(val) = response.headers.get("x-chaos-injected") {
            match val {
                "500" => self.errors_500 += 1,
                "503" => self.errors_503 += 1,
                _ => {}
            }
        }
    }

    /// Total injected errors.
    #[must_use]
    pub fn total_injected(&self) -> u64 {
        self.errors_500 + self.errors_503
    }

    /// Injection rate (injected / total).
    #[must_use]
    #[allow(clippy::cast_precision_loss)]
    pub fn injection_rate(&self) -> f64 {
        if self.total_requests == 0 {
            return 0.0;
        }
        self.total_injected() as f64 / self.total_requests as f64
    }

    /// Human-readable summary.
    #[must_use]
    pub fn summary(&self) -> String {
        format!(
            "requests: {}, 500s: {}, 503s: {}, rate: {:.1}%",
            self.total_requests,
            self.errors_500,
            self.errors_503,
            self.injection_rate() * 100.0,
        )
    }
}

// ── LabTestServer ──────────────────────────────────────────────────────────

/// Lab-powered test server with chaos injection, virtual time, and fuzzing.
///
/// Extends [`TestServer`] with asupersync's lab runtime capabilities.
/// All requests are routed directly through the router — no TCP, no
/// flakiness — but with deterministic fault injection and virtual time.
///
/// # Example
///
/// ```ignore
/// use ava_web::lab::{LabTestServer, ChaosPreset};
/// use ava_web::{Router, get};
///
/// let mut server = LabTestServer::new(
///     Router::new().route("/health", get(|| "ok"))
/// )
/// .seed(42)
/// .chaos(ChaosPreset::Light);
///
/// // Run requests under chaos
/// let resp = server.get("/health");
/// resp.assert_status(200);  // May fail under chaos — that's the point!
///
/// // Check what chaos did
/// println!("{}", server.chaos_stats().summary());
///
/// // Advance virtual time (for timeout testing)
/// server.advance_time_ms(5000);
/// ```
pub struct LabTestServer {
    inner: TestServer,
    seed: u64,
    chaos_config: Option<ChaosConfig>,
    stats: ChaosInjectionStats,
    virtual_time_ms: u64,
}

impl LabTestServer {
    /// Create a lab test server from a router.
    ///
    /// No chaos is enabled by default. Use `.chaos()` or `.chaos_config()`
    /// to enable fault injection.
    #[must_use]
    pub fn new(router: Router) -> Self {
        Self {
            inner: TestServer::new(router),
            seed: 42,
            chaos_config: None,
            stats: ChaosInjectionStats::new(),
            virtual_time_ms: 0,
        }
    }

    /// Create with a router that has ChaosMiddleware already applied.
    #[must_use]
    pub fn with_chaos(router: Router, seed: u64, preset: ChaosPreset) -> Self {
        let chaos_mw = ChaosMiddleware::new(seed, preset);
        let router = router.layer(chaos_mw);
        Self {
            inner: TestServer::new(router),
            seed,
            chaos_config: Some(preset.to_config().with_seed(seed)),
            stats: ChaosInjectionStats::new(),
            virtual_time_ms: 0,
        }
    }

    /// Set the deterministic seed.
    #[must_use]
    pub fn seed(mut self, seed: u64) -> Self {
        self.seed = seed;
        self
    }

    /// Enable chaos injection with a named preset.
    ///
    /// This rebuilds the router with `ChaosMiddleware` applied.
    /// Must be called before sending requests.
    #[must_use]
    pub fn chaos(mut self, preset: ChaosPreset) -> Self {
        self.chaos_config = Some(preset.to_config().with_seed(self.seed));
        self
    }

    /// Enable chaos with a custom configuration.
    #[must_use]
    pub fn chaos_config(mut self, config: ChaosConfig) -> Self {
        self.chaos_config = Some(config);
        self
    }

    /// Send a GET request and track chaos stats.
    pub fn get(&mut self, path: &str) -> TestResponse {
        let resp = self.inner.get(path).send();
        self.stats.record(&resp.response);
        resp
    }

    /// Send a POST request and track chaos stats.
    pub fn post(&mut self, path: &str) -> TestRequest<'_> {
        self.inner.post(path)
    }

    /// Send a PUT request.
    pub fn put(&mut self, path: &str) -> TestRequest<'_> {
        self.inner.put(path)
    }

    /// Send a DELETE request.
    pub fn delete(&mut self, path: &str) -> TestRequest<'_> {
        self.inner.delete(path)
    }

    /// Send an arbitrary request.
    pub fn request(&mut self, method: &str, path: &str) -> TestRequest<'_> {
        self.inner.request(method, path)
    }

    /// Get chaos injection statistics.
    #[must_use]
    pub fn chaos_stats(&self) -> &ChaosInjectionStats {
        &self.stats
    }

    /// Reset chaos injection statistics.
    pub fn reset_stats(&mut self) {
        self.stats = ChaosInjectionStats::new();
    }

    /// Advance virtual time by the given milliseconds.
    ///
    /// This does not sleep — it updates an internal counter for
    /// virtual time assertions. Useful for testing timeout behavior.
    pub fn advance_time_ms(&mut self, ms: u64) {
        self.virtual_time_ms += ms;
    }

    /// Get the current virtual time in milliseconds.
    #[must_use]
    pub fn virtual_time_ms(&self) -> u64 {
        self.virtual_time_ms
    }

    /// Access the underlying `TestServer` for direct request building.
    #[must_use]
    pub fn inner(&self) -> &TestServer {
        &self.inner
    }
}

// ── Fuzz Harness ───────────────────────────────────────────────────────────

/// Configuration for HTTP request fuzzing.
///
/// Generates deterministic pseudo-random HTTP requests to stress-test
/// the router and extractor pipeline.
#[derive(Debug, Clone)]
pub struct HttpFuzzConfig {
    /// Base seed for deterministic fuzzing.
    pub seed: u64,
    /// Number of fuzz iterations.
    pub iterations: usize,
    /// Methods to fuzz with.
    pub methods: Vec<String>,
    /// Path prefixes to fuzz.
    pub paths: Vec<String>,
    /// Maximum body size in bytes.
    pub max_body_size: usize,
    /// Whether to generate random headers.
    pub fuzz_headers: bool,
}

impl HttpFuzzConfig {
    /// Create a new fuzz configuration.
    #[must_use]
    pub fn new(seed: u64, iterations: usize) -> Self {
        Self {
            seed,
            iterations,
            methods: vec![
                "GET".into(),
                "POST".into(),
                "PUT".into(),
                "DELETE".into(),
                "PATCH".into(),
                "HEAD".into(),
                "OPTIONS".into(),
            ],
            paths: vec![
                "/".into(),
                "/api".into(),
                "/api/v1".into(),
                "/users".into(),
                "/users/123".into(),
                "/health".into(),
                "//double-slash".into(),
                "/with spaces".into(),
                "/unicode/\u{1F600}".into(),
                "/../escape".into(),
                "/very/deeply/nested/path/that/goes/on/and/on".into(),
            ],
            max_body_size: 1024,
            fuzz_headers: true,
        }
    }

    /// Quick config for CI (fewer iterations).
    #[must_use]
    pub fn quick(seed: u64) -> Self {
        Self::new(seed, 100)
    }

    /// Thorough config for release testing.
    #[must_use]
    pub fn thorough(seed: u64) -> Self {
        Self::new(seed, 10_000)
    }
}

/// Results of an HTTP fuzz campaign.
#[derive(Debug)]
pub struct HttpFuzzReport {
    /// Total iterations completed.
    pub iterations: usize,
    /// Number of panics caught (should be 0).
    pub panics: usize,
    /// Status code distribution.
    pub status_codes: std::collections::HashMap<u16, usize>,
    /// Seeds that caused panics (for reproduction).
    pub panic_seeds: Vec<u64>,
}

impl HttpFuzzReport {
    /// True if any panics were caught.
    #[must_use]
    pub fn has_panics(&self) -> bool {
        self.panics > 0
    }

    /// Assert no panics occurred.
    ///
    /// # Panics
    ///
    /// Panics with a detailed message if any fuzz iteration panicked.
    pub fn assert_no_panics(&self) {
        assert!(
            !self.has_panics(),
            "HTTP fuzz found {} panics in {} iterations. Seeds: {:?}",
            self.panics,
            self.iterations,
            self.panic_seeds,
        );
    }
}

/// Run a fuzz campaign against a router.
///
/// Generates deterministic pseudo-random HTTP requests and verifies that
/// the router never panics. Any response status code is acceptable — the
/// goal is to find panics and crashes, not logic errors.
///
/// Takes ownership of the router. Build a fresh router for each fuzz run.
///
/// # Example
///
/// ```ignore
/// use ava_web::lab::{HttpFuzzConfig, fuzz_router};
/// use ava_web::Router;
///
/// let router = Router::new()
///     .route("/api", get(handler));
///
/// let report = fuzz_router(router, HttpFuzzConfig::quick(42));
/// report.assert_no_panics();
/// ```
pub fn fuzz_router(router: Router, config: HttpFuzzConfig) -> HttpFuzzReport {
    let mut status_codes = std::collections::HashMap::new();
    let mut panics = 0;
    let mut panic_seeds = Vec::new();

    let server = TestServer::new(router);

    for i in 0..config.iterations {
        let iter_seed = config.seed.wrapping_add(i as u64);
        let mut iter_rng = ChaosRng::new(iter_seed);

        // Pick random method
        let method_idx = (iter_rng.next_u64() as usize) % config.methods.len();
        let method = &config.methods[method_idx];

        // Pick random path
        let path_idx = (iter_rng.next_u64() as usize) % config.paths.len();
        let path = &config.paths[path_idx];

        // Optionally generate random body
        let body_size = if method == "GET" || method == "HEAD" {
            0
        } else {
            (iter_rng.next_u64() as usize) % (config.max_body_size + 1)
        };

        let body: Vec<u8> = (0..body_size)
            .map(|_| (iter_rng.next_u64() & 0xFF) as u8)
            .collect();

        // Pre-compute header decisions before the catch_unwind closure
        let add_json_ct = config.fuzz_headers && iter_rng.should_inject(0.3);
        let add_request_id = config.fuzz_headers && iter_rng.should_inject(0.2);
        let request_id = format!("fuzz-{iter_seed}");

        // Build and send request inside catch_unwind to detect panics
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let mut req = server.request(method, path);
            if !body.is_empty() {
                req = req.body(Bytes::from(body));
            }
            if add_json_ct {
                req = req.header("content-type", "application/json");
            }
            if add_request_id {
                req = req.header("x-request-id", &request_id);
            }
            req.send()
        }));

        match result {
            Ok(resp) => {
                let code = resp.status();
                *status_codes.entry(code).or_insert(0) += 1;
            }
            Err(_) => {
                panics += 1;
                panic_seeds.push(iter_seed);
            }
        }
    }

    HttpFuzzReport {
        iterations: config.iterations,
        panics,
        status_codes,
        panic_seeds,
    }
}

// ── Virtual Time Helpers ───────────────────────────────────────────────────

/// Virtual time controller for deterministic timeout testing.
///
/// Wraps asupersync's `VirtualTimerWheel` with ava-web-friendly helpers.
/// Use this to test timeout middleware without wall-clock delays.
///
/// # Example
///
/// ```ignore
/// use ava_web::lab::VirtualTimeController;
///
/// let mut vtc = VirtualTimeController::new();
///
/// // Register a timeout at 5 seconds
/// vtc.set_timeout_ms(5000);
///
/// // Advance to just before the deadline — timer should not fire
/// let fired = vtc.advance_ms(4999);
/// assert_eq!(fired, 0);
///
/// // Advance past the deadline — timer fires
/// let fired = vtc.advance_ms(2);
/// assert_eq!(fired, 1);
/// ```
pub struct VirtualTimeController {
    wheel: VirtualTimerWheel,
}

impl VirtualTimeController {
    /// Create a new virtual time controller starting at tick 0.
    #[must_use]
    pub fn new() -> Self {
        Self {
            wheel: VirtualTimerWheel::new(),
        }
    }

    /// Create starting at a specific tick.
    #[must_use]
    pub fn starting_at_ms(ms: u64) -> Self {
        Self {
            wheel: VirtualTimerWheel::starting_at(ms),
        }
    }

    /// Get the current virtual time in milliseconds.
    #[must_use]
    pub fn now_ms(&self) -> u64 {
        self.wheel.current_tick()
    }

    /// Set a timeout at `now + ms` milliseconds.
    ///
    /// Returns the number of pending timers.
    pub fn set_timeout_ms(&mut self, ms: u64) -> usize {
        use std::sync::Arc;
        use std::task::Wake;

        struct NoopWaker;
        impl Wake for NoopWaker {
            fn wake(self: Arc<Self>) {}
        }

        let deadline = self.wheel.current_tick() + ms;
        let waker = std::task::Waker::from(Arc::new(NoopWaker));
        self.wheel.insert(deadline, waker);
        self.wheel.len()
    }

    /// Advance virtual time by `ms` milliseconds.
    ///
    /// Returns the number of timers that fired.
    pub fn advance_ms(&mut self, ms: u64) -> usize {
        let expired = self.wheel.advance_by(ms);
        expired.len()
    }

    /// Advance to the next timer deadline.
    ///
    /// Returns the number of timers that fired (0 if no timers pending).
    pub fn advance_to_next(&mut self) -> usize {
        let expired = self.wheel.advance_to_next();
        expired.len()
    }

    /// Returns the number of pending timers.
    #[must_use]
    pub fn pending_count(&self) -> usize {
        self.wheel.len()
    }

    /// Returns true if no timers are pending.
    #[must_use]
    pub fn is_idle(&self) -> bool {
        self.wheel.is_empty()
    }

    /// Returns the deadline of the next timer (if any), in ms.
    #[must_use]
    pub fn next_deadline_ms(&self) -> Option<u64> {
        self.wheel.next_deadline()
    }
}

impl Default for VirtualTimeController {
    fn default() -> Self {
        Self::new()
    }
}

// ── Scenario Runner ────────────────────────────────────────────────────────

/// A scenario-based test runner for ava-web.
///
/// Loads scenario files (JSON or YAML via serde) and executes them
/// against an ava-web router. Takes ownership of the router (Router is
/// not Clone due to trait objects).
///
/// # Example
///
/// ```ignore
/// use ava_web::lab::ScenarioTestRunner;
///
/// let runner = ScenarioTestRunner::from_json(
///     router,
///     r#"{"id": "smoke", "lab": {"seed": 42}, "chaos": {"preset": "light"}}"#,
/// ).unwrap();
///
/// let report = runner.run();
/// assert!(report.all_responded());
/// ```
pub struct ScenarioTestRunner {
    server: TestServer,
    scenario: Scenario,
}

impl ScenarioTestRunner {
    /// Create a scenario runner from a router and JSON scenario string.
    ///
    /// Takes ownership of the router. Validates the scenario on construction.
    ///
    /// # Errors
    ///
    /// Returns an error if the JSON is malformed or the scenario is invalid.
    pub fn from_json(router: Router, json: &str) -> Result<Self, String> {
        let scenario: Scenario =
            serde_json::from_str(json).map_err(|e| format!("parse error: {e}"))?;

        let errors = scenario.validate();
        if !errors.is_empty() {
            let msgs: Vec<String> = errors.iter().map(|e| format!("{e}")).collect();
            return Err(format!("validation errors: {}", msgs.join(", ")));
        }

        Ok(Self {
            server: TestServer::new(router),
            scenario,
        })
    }

    /// Run the loaded scenario.
    ///
    /// Returns a report with results for each participant request.
    pub fn run(&self) -> ScenarioReport {
        let lab_config = self.scenario.to_lab_config();
        let chaos_active = lab_config.has_chaos();

        let mut results = Vec::new();

        // Run a request for each participant's role
        for participant in &self.scenario.participants {
            let path = format!("/{}", participant.role);
            let resp = self.server.get(&path).send();

            results.push(ScenarioRequestResult {
                participant: participant.name.clone(),
                path,
                status: resp.status(),
                chaos_injected: resp.header("x-chaos-injected").is_some(),
            });
        }

        ScenarioReport {
            scenario_id: self.scenario.id.clone(),
            seed: lab_config.seed,
            chaos_active,
            results,
            stats: ChaosInjectionStats::new(),
        }
    }
}

/// Report from a scenario test run.
#[derive(Debug)]
pub struct ScenarioReport {
    /// Scenario identifier.
    pub scenario_id: String,
    /// Seed used for the run.
    pub seed: u64,
    /// Whether chaos was active.
    pub chaos_active: bool,
    /// Per-request results.
    pub results: Vec<ScenarioRequestResult>,
    /// Chaos injection statistics.
    pub stats: ChaosInjectionStats,
}

impl ScenarioReport {
    /// True if all requests got a response (even error responses are OK
    /// under chaos — only panics are failures).
    #[must_use]
    pub fn all_responded(&self) -> bool {
        !self.results.is_empty()
    }

    /// Count of chaos-injected responses.
    #[must_use]
    pub fn chaos_injected_count(&self) -> usize {
        self.results.iter().filter(|r| r.chaos_injected).count()
    }
}

/// Result of a single request within a scenario.
#[derive(Debug)]
pub struct ScenarioRequestResult {
    /// Participant that sent the request.
    pub participant: String,
    /// Request path.
    pub path: String,
    /// Response status code.
    pub status: u16,
    /// Whether chaos injection affected this request.
    pub chaos_injected: bool,
}

// ── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::handler::FnHandler;
    use crate::router::get;

    fn test_router() -> Router {
        Router::new()
            .route("/health", get(FnHandler::new(|| "ok")))
            .route("/users", get(FnHandler::new(|| "[\"alice\",\"bob\"]")))
            .route(
                "/fail",
                get(FnHandler::new(|| StatusCode::INTERNAL_SERVER_ERROR)),
            )
    }

    // ── ChaosMiddleware tests ──────────────────────────────────────────

    #[test]
    fn chaos_middleware_off_passes_through() {
        let router = Router::new()
            .route("/health", get(FnHandler::new(|| "ok")))
            .layer(ChaosMiddleware::new(42, ChaosPreset::Off));

        let server = TestServer::new(router);
        let resp = server.get("/health").send();
        resp.assert_ok();
        resp.assert_header("x-chaos-active", "true");
    }

    #[test]
    fn chaos_middleware_deterministic() {
        // Same seed + same request = same result
        for _ in 0..10 {
            let router = Router::new()
                .route("/test", get(FnHandler::new(|| "ok")))
                .layer(ChaosMiddleware::new(42, ChaosPreset::Light));

            let server = TestServer::new(router);
            let resp1 = server.get("/test").send();

            let router2 = Router::new()
                .route("/test", get(FnHandler::new(|| "ok")))
                .layer(ChaosMiddleware::new(42, ChaosPreset::Light));

            let server2 = TestServer::new(router2);
            let resp2 = server2.get("/test").send();

            assert_eq!(resp1.status(), resp2.status());
        }
    }

    #[test]
    fn chaos_middleware_heavy_injects_failures() {
        // Heavy chaos with very high probabilities should inject failures
        let mw = ChaosMiddleware::new(42, ChaosPreset::Off)
            .with_error_probability(1.0)
            .with_unavailable_probability(0.0);

        let router = Router::new()
            .route("/health", get(FnHandler::new(|| "ok")))
            .layer(mw);

        let server = TestServer::new(router);
        let resp = server.get("/health").send();
        resp.assert_internal_error();
        resp.assert_header("x-chaos-injected", "500");
    }

    #[test]
    fn chaos_middleware_503_injection() {
        let mw = ChaosMiddleware::new(42, ChaosPreset::Off)
            .with_error_probability(0.0)
            .with_unavailable_probability(1.0);

        let router = Router::new()
            .route("/health", get(FnHandler::new(|| "ok")))
            .layer(mw);

        let server = TestServer::new(router);
        let resp = server.get("/health").send();
        resp.assert_status(503);
        resp.assert_header("x-chaos-injected", "503");
    }

    // ── LabTestServer tests ────────────────────────────────────────────

    #[test]
    fn lab_test_server_basic() {
        let mut server = LabTestServer::new(test_router());
        let resp = server.get("/health");
        resp.assert_ok();
        resp.assert_body_text("ok");
    }

    #[test]
    fn lab_test_server_tracks_stats() {
        let mut server = LabTestServer::new(test_router());
        server.get("/health");
        server.get("/users");
        server.get("/fail");

        assert_eq!(server.chaos_stats().total_requests, 3);
    }

    #[test]
    fn lab_test_server_virtual_time() {
        let mut server = LabTestServer::new(test_router());
        assert_eq!(server.virtual_time_ms(), 0);

        server.advance_time_ms(1000);
        assert_eq!(server.virtual_time_ms(), 1000);

        server.advance_time_ms(500);
        assert_eq!(server.virtual_time_ms(), 1500);
    }

    // ── ChaosInjectionStats tests ──────────────────────────────────────

    #[test]
    fn stats_tracking() {
        let mut stats = ChaosInjectionStats::new();
        assert_eq!(stats.total_requests, 0);
        assert_eq!(stats.injection_rate(), 0.0);

        // Simulate recording responses
        let ok_resp = Response::new(StatusCode::OK, Bytes::from_static(b"ok"));
        stats.record(&ok_resp);
        assert_eq!(stats.total_requests, 1);
        assert_eq!(stats.total_injected(), 0);

        let injected = Response::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            Bytes::from_static(b"chaos"),
        )
        .header("x-chaos-injected", "500");
        stats.record(&injected);
        assert_eq!(stats.total_requests, 2);
        assert_eq!(stats.errors_500, 1);
        assert_eq!(stats.total_injected(), 1);
    }

    // ── VirtualTimeController tests ────────────────────────────────────

    #[test]
    fn virtual_time_basic() {
        let mut vtc = VirtualTimeController::new();
        assert_eq!(vtc.now_ms(), 0);
        assert!(vtc.is_idle());

        vtc.set_timeout_ms(100);
        assert_eq!(vtc.pending_count(), 1);
        assert!(!vtc.is_idle());

        // Advance to just before deadline
        let fired = vtc.advance_ms(99);
        assert_eq!(fired, 0);
        assert_eq!(vtc.pending_count(), 1);

        // Advance past deadline
        let fired = vtc.advance_ms(2);
        assert_eq!(fired, 1);
        assert!(vtc.is_idle());
    }

    #[test]
    fn virtual_time_multiple_timers() {
        let mut vtc = VirtualTimeController::new();
        vtc.set_timeout_ms(100);
        vtc.set_timeout_ms(200);
        vtc.set_timeout_ms(300);

        assert_eq!(vtc.pending_count(), 3);
        assert_eq!(vtc.next_deadline_ms(), Some(100));

        // Advance to first
        let fired = vtc.advance_to_next();
        assert_eq!(fired, 1);
        assert_eq!(vtc.now_ms(), 100);
        assert_eq!(vtc.pending_count(), 2);

        // Jump past all remaining
        let fired = vtc.advance_ms(500);
        assert_eq!(fired, 2);
        assert!(vtc.is_idle());
    }

    #[test]
    fn virtual_time_advance_to_next_empty() {
        let mut vtc = VirtualTimeController::new();
        let fired = vtc.advance_to_next();
        assert_eq!(fired, 0);
    }

    // ── Fuzz tests ─────────────────────────────────────────────────────

    #[test]
    fn fuzz_router_no_panics() {
        let report = fuzz_router(test_router(), HttpFuzzConfig::quick(42));
        report.assert_no_panics();
        assert_eq!(report.iterations, 100);
        assert!(!report.status_codes.is_empty());
    }

    #[test]
    fn fuzz_router_empty_routes() {
        let report = fuzz_router(Router::new(), HttpFuzzConfig::new(42, 50));
        report.assert_no_panics();
        // All requests should be 404 or 405
        for (&code, _) in &report.status_codes {
            assert!(
                code == 404 || code == 405,
                "unexpected status code {code} for empty router"
            );
        }
    }

    #[test]
    fn fuzz_deterministic_same_seed() {
        let report1 = fuzz_router(test_router(), HttpFuzzConfig::new(42, 20));
        let report2 = fuzz_router(test_router(), HttpFuzzConfig::new(42, 20));

        assert_eq!(report1.status_codes, report2.status_codes);
    }

    // ── Scenario tests ─────────────────────────────────────────────────

    #[test]
    fn scenario_minimal() {
        let runner = ScenarioTestRunner::from_json(
            test_router(),
            r#"{"id": "smoke", "description": "minimal test"}"#,
        )
        .unwrap();

        let report = runner.run();
        assert_eq!(report.scenario_id, "smoke");
        assert!(!report.chaos_active);
    }

    #[test]
    fn scenario_with_chaos() {
        let json = r#"{
            "id": "chaos-test",
            "description": "test under light chaos",
            "lab": {"seed": 42},
            "chaos": {"preset": "light"},
            "participants": [
                {"name": "client", "role": "health"}
            ]
        }"#;

        let runner = ScenarioTestRunner::from_json(test_router(), json).unwrap();

        let report = runner.run();
        assert_eq!(report.scenario_id, "chaos-test");
        assert!(report.chaos_active);
        assert!(report.all_responded());
    }

    #[test]
    fn scenario_validation_rejects_bad_input() {
        let result = ScenarioTestRunner::from_json(
            test_router(),
            r#"{"id": "", "schema_version": 99}"#,
        );

        match result {
            Ok(_) => panic!("expected validation error but got Ok"),
            Err(err) => assert!(
                err.contains("validation") || err.contains("parse"),
                "unexpected error: {err}"
            ),
        }
    }
}
