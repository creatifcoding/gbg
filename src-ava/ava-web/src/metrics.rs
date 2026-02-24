//! Request metrics collection with Prometheus-compatible export.
//!
//! Provides a `MetricsCollector` that stores per-route latency histograms,
//! a `MetricsMiddleware` that records request durations, and a
//! Prometheus text-format renderer.

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use crate::extractor::Request;
use crate::handler::Handler;
use crate::middleware::{Middleware, Next};
use crate::response::{Response, StatusCode};

/// Default histogram bucket upper bounds (in seconds).
const DEFAULT_BUCKETS: &[f64] = &[
    0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
];

// ── Histogram ─────────────────────────────────────────────────────────────

/// Simple histogram with fixed buckets.
///
/// Each bucket counts observations less than or equal to its upper bound.
#[derive(Debug, Clone)]
pub struct Histogram {
    /// (upper_bound, cumulative_count) pairs.
    buckets: Vec<(f64, u64)>,
    /// Sum of all observed values.
    sum: f64,
    /// Total number of observations.
    count: u64,
}

impl Histogram {
    /// Create a new histogram with the given bucket upper bounds.
    #[must_use]
    pub fn new(bucket_bounds: &[f64]) -> Self {
        let buckets = bucket_bounds.iter().map(|&b| (b, 0u64)).collect();
        Self {
            buckets,
            sum: 0.0,
            count: 0,
        }
    }

    /// Create a histogram with default buckets.
    #[must_use]
    pub fn with_defaults() -> Self {
        Self::new(DEFAULT_BUCKETS)
    }

    /// Record an observation.
    pub fn observe(&mut self, value: f64) {
        self.sum += value;
        self.count += 1;
        for bucket in &mut self.buckets {
            if value <= bucket.0 {
                bucket.1 += 1;
            }
        }
    }

    /// Get the total count of observations.
    #[must_use]
    pub fn count(&self) -> u64 {
        self.count
    }

    /// Get the sum of all observations.
    #[must_use]
    pub fn sum(&self) -> f64 {
        self.sum
    }

    /// Get bucket data as (upper_bound, cumulative_count) pairs.
    #[must_use]
    pub fn buckets(&self) -> &[(f64, u64)] {
        &self.buckets
    }
}

// ── MetricsCollector ──────────────────────────────────────────────────────

/// Thread-safe metrics collector storing per-route histograms.
///
/// # Example
///
/// ```ignore
/// use ava_web::metrics::MetricsCollector;
///
/// let collector = MetricsCollector::new();
/// collector.record("/api/users", 0.042);
/// println!("{}", collector.render_prometheus());
/// ```
#[derive(Debug)]
pub struct MetricsCollector {
    histograms: parking_lot::RwLock<HashMap<String, Histogram>>,
}

impl MetricsCollector {
    /// Create a new empty collector.
    #[must_use]
    pub fn new() -> Self {
        Self {
            histograms: parking_lot::RwLock::new(HashMap::new()),
        }
    }

    /// Record a request duration (seconds) for a given route.
    pub fn record(&self, route: &str, duration_secs: f64) {
        let mut map = self.histograms.write();
        map.entry(route.to_string())
            .or_insert_with(Histogram::with_defaults)
            .observe(duration_secs);
    }

    /// Get a snapshot of the histogram for a route.
    #[must_use]
    pub fn get(&self, route: &str) -> Option<Histogram> {
        self.histograms.read().get(route).cloned()
    }

    /// Render all metrics in Prometheus text exposition format.
    #[must_use]
    pub fn render_prometheus(&self) -> String {
        use std::fmt::Write;

        let map = self.histograms.read();

        // Pre-allocate: ~120 bytes per bucket line, 14 lines per route
        // (11 buckets + +Inf + sum + count), plus header.
        let estimated = 128 + map.len() * 14 * 120;
        let mut output = String::with_capacity(estimated);

        output.push_str("# HELP http_request_duration_seconds HTTP request latency histogram.\n");
        output.push_str("# TYPE http_request_duration_seconds histogram\n");

        // Sort routes for deterministic output
        let mut routes: Vec<&String> = map.keys().collect();
        routes.sort_unstable();

        // Reusable buffer for the sanitized route label (sanitized once per route
        // instead of 14 times — 11 buckets + Inf + sum + count).
        let mut sanitized_route = String::new();

        for route in routes {
            let hist = &map[route];

            // Sanitize route once, reuse for all 14 lines
            sanitized_route.clear();
            write_sanitized_label(&mut sanitized_route, route);

            // Pre-build the route prefix: {route="<sanitized>"}
            // This avoids rebuilding it per bucket line.
            for &(bound, count) in hist.buckets() {
                output.push_str("http_request_duration_seconds_bucket{route=\"");
                output.push_str(&sanitized_route);
                let _ = write!(output, "\",le=\"{bound}\"}} {count}\n");
            }
            // +Inf bucket = total count
            output.push_str("http_request_duration_seconds_bucket{route=\"");
            output.push_str(&sanitized_route);
            let _ = write!(output, "\",le=\"+Inf\"}} {}\n", hist.count());

            output.push_str("http_request_duration_seconds_sum{route=\"");
            output.push_str(&sanitized_route);
            let _ = write!(output, "\"}} {}\n", hist.sum());

            output.push_str("http_request_duration_seconds_count{route=\"");
            output.push_str(&sanitized_route);
            let _ = write!(output, "\"}} {}\n", hist.count());
        }

        output
    }
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}

/// Write a sanitized label value directly to a String buffer (zero intermediate allocation).
/// Fast path: if no escaping needed (common for URL paths), uses a single `push_str`.
fn write_sanitized_label(out: &mut String, s: &str) {
    // Fast path: most route strings contain no characters needing escape
    if !s.bytes().any(|b| b == b'\\' || b == b'"' || b == b'\n') {
        out.push_str(s);
        return;
    }
    // Slow path: escape character by character
    for ch in s.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            c => out.push(c),
        }
    }
}

// ── MetricsMiddleware ─────────────────────────────────────────────────────

/// Middleware that records per-route request duration into a `MetricsCollector`.
pub struct MetricsMiddleware {
    collector: Arc<MetricsCollector>,
}

impl MetricsMiddleware {
    /// Create new metrics middleware backed by the given collector.
    pub fn new(collector: Arc<MetricsCollector>) -> Self {
        Self { collector }
    }
}

impl Middleware for MetricsMiddleware {
    fn handle<'a>(
        &'a self,
        req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        Box::pin(async move {
            let start = std::time::Instant::now();
            let path = req.path.clone();
            let resp = next.run(req).await;
            let duration = start.elapsed().as_secs_f64();
            self.collector.record(&path, duration);
            resp
        })
    }
}

// ── MetricsHandler ────────────────────────────────────────────────────────

/// A handler that serves Prometheus metrics from a collector.
pub struct MetricsHandler {
    collector: Arc<MetricsCollector>,
}

impl MetricsHandler {
    /// Create a new metrics endpoint handler.
    pub fn new(collector: Arc<MetricsCollector>) -> Self {
        Self { collector }
    }
}

impl Handler for MetricsHandler {
    fn call(&self, _req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        let body = self.collector.render_prometheus();
        Box::pin(async move {
            Response::new(StatusCode::OK, body.into_bytes())
                .header("content-type", "text/plain; version=0.0.4; charset=utf-8")
        })
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn histogram_observe_single() {
        let mut hist = Histogram::with_defaults();
        hist.observe(0.042);
        assert_eq!(hist.count(), 1);
        assert!((hist.sum() - 0.042).abs() < f64::EPSILON);
    }

    #[test]
    fn histogram_buckets_cumulative() {
        let mut hist = Histogram::new(&[0.1, 0.5, 1.0]);
        hist.observe(0.05); // <= 0.1, <= 0.5, <= 1.0
        hist.observe(0.3);  // <= 0.5, <= 1.0
        hist.observe(0.8);  // <= 1.0
        hist.observe(1.5);  // none

        let buckets = hist.buckets();
        assert_eq!(buckets[0], (0.1, 1));  // 0.05
        assert_eq!(buckets[1], (0.5, 2));  // 0.05 + 0.3
        assert_eq!(buckets[2], (1.0, 3));  // 0.05 + 0.3 + 0.8
        assert_eq!(hist.count(), 4);
    }

    #[test]
    fn histogram_sum_accumulates() {
        let mut hist = Histogram::with_defaults();
        hist.observe(1.0);
        hist.observe(2.0);
        hist.observe(3.0);
        assert!((hist.sum() - 6.0).abs() < f64::EPSILON);
        assert_eq!(hist.count(), 3);
    }

    #[test]
    fn collector_record_and_get() {
        let collector = MetricsCollector::new();
        collector.record("/api/users", 0.1);
        collector.record("/api/users", 0.2);
        collector.record("/api/orders", 0.5);

        let users_hist = collector.get("/api/users").unwrap();
        assert_eq!(users_hist.count(), 2);

        let orders_hist = collector.get("/api/orders").unwrap();
        assert_eq!(orders_hist.count(), 1);

        assert!(collector.get("/nonexistent").is_none());
    }

    #[test]
    fn prometheus_rendering_format() {
        let collector = MetricsCollector::new();
        collector.record("/api/test", 0.042);

        let output = collector.render_prometheus();

        assert!(output.contains("# HELP http_request_duration_seconds"));
        assert!(output.contains("# TYPE http_request_duration_seconds histogram"));
        assert!(output.contains("http_request_duration_seconds_bucket{route=\"/api/test\",le=\"0.05\"} 1"));
        assert!(output.contains("http_request_duration_seconds_bucket{route=\"/api/test\",le=\"0.01\"} 0"));
        assert!(output.contains("http_request_duration_seconds_bucket{route=\"/api/test\",le=\"+Inf\"} 1"));
        assert!(output.contains("http_request_duration_seconds_sum{route=\"/api/test\"}"));
        assert!(output.contains("http_request_duration_seconds_count{route=\"/api/test\"} 1"));
    }

    #[test]
    fn prometheus_sorted_routes() {
        let collector = MetricsCollector::new();
        collector.record("/z-route", 0.1);
        collector.record("/a-route", 0.1);

        let output = collector.render_prometheus();
        let a_pos = output.find("/a-route").unwrap();
        let z_pos = output.find("/z-route").unwrap();
        assert!(a_pos < z_pos, "routes should be sorted alphabetically");
    }

    #[test]
    fn prometheus_label_sanitization() {
        let collector = MetricsCollector::new();
        collector.record("/path\"with\"quotes", 0.1);

        let output = collector.render_prometheus();
        assert!(output.contains("/path\\\"with\\\"quotes"));
    }

    #[test]
    fn metrics_middleware_records_duration() {
        let collector = Arc::new(MetricsCollector::new());
        let mw = MetricsMiddleware::new(Arc::clone(&collector));

        // Simulate a request through the middleware
        let req = Request::new("GET", "/api/health");
        let next = Next::new(|_req| {
            Box::pin(async { Response::new(StatusCode::OK, bytes::Bytes::from_static(b"ok")) })
                as Pin<Box<dyn Future<Output = Response> + Send>>
        });

        // Run it synchronously via a simple block_on
        let fut = mw.handle(req, next);
        let resp = futures_lite_block_on(fut);
        assert_eq!(resp.status, StatusCode::OK);

        let hist = collector.get("/api/health").unwrap();
        assert_eq!(hist.count(), 1);
        assert!(hist.sum() >= 0.0);
    }

    #[test]
    fn metrics_handler_serves_prometheus() {
        let collector = Arc::new(MetricsCollector::new());
        collector.record("/test", 0.05);

        let handler = MetricsHandler::new(Arc::clone(&collector));
        let req = Request::new("GET", "/metrics");
        let fut = handler.call(req);
        let resp = futures_lite_block_on(fut);

        assert_eq!(resp.status, StatusCode::OK);
        assert_eq!(
            resp.headers.get("content-type").unwrap(),
            "text/plain; version=0.0.4; charset=utf-8"
        );
        let body = std::str::from_utf8(&resp.body).unwrap();
        assert!(body.contains("http_request_duration_seconds"));
    }

    #[test]
    fn empty_collector_renders_header_only() {
        let collector = MetricsCollector::new();
        let output = collector.render_prometheus();
        assert!(output.contains("# HELP"));
        assert!(output.contains("# TYPE"));
        // No bucket lines
        assert!(!output.contains("_bucket{"));
    }

    #[test]
    fn histogram_boundary_values() {
        let mut hist = Histogram::new(&[1.0, 2.0]);
        hist.observe(1.0);  // exactly on boundary: should be counted
        hist.observe(2.0);  // exactly on boundary: should be counted

        assert_eq!(hist.buckets()[0], (1.0, 1));
        assert_eq!(hist.buckets()[1], (2.0, 2));
    }

    /// Minimal single-threaded block_on for tests (no async runtime needed).
    fn futures_lite_block_on<T>(fut: impl Future<Output = T>) -> T {
        use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};

        fn raw_waker() -> RawWaker {
            fn no_op(_: *const ()) {}
            fn clone(_: *const ()) -> RawWaker { raw_waker() }
            static VTABLE: RawWakerVTable = RawWakerVTable::new(clone, no_op, no_op, no_op);
            RawWaker::new(std::ptr::null(), &VTABLE)
        }

        let waker = unsafe { Waker::from_raw(raw_waker()) };
        let mut cx = Context::from_waker(&waker);
        let mut fut = std::pin::pin!(fut);

        loop {
            match fut.as_mut().poll(&mut cx) {
                Poll::Ready(val) => return val,
                Poll::Pending => {
                    // For our simple futures this shouldn't happen,
                    // but yield once to be safe.
                    std::thread::yield_now();
                }
            }
        }
    }
}
