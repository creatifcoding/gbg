//! Composable async middleware for ava-web.
//!
//! Middleware wraps handlers to add cross-cutting concerns like
//! timeouts, CORS, logging, rate limiting, etc.

use std::future::Future;
use std::pin::Pin;
use std::time::Duration;

use crate::extractor::Request;
use crate::response::{Response, StatusCode};

// ── Middleware Trait ─────────────────────────────────────────────────────────

/// Async middleware that wraps handler execution.
///
/// Middleware can inspect/modify requests before the handler,
/// and inspect/modify responses after.
pub trait Middleware: Send + Sync + 'static {
    /// Process the request, optionally delegating to `next`.
    fn handle<'a>(
        &'a self,
        req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>>;
}

/// The next handler/middleware in the chain.
///
/// Uses an enum internally to avoid heap allocation for function-pointer
/// terminal handlers (the most common case in router dispatch).
pub struct Next<'a> {
    inner: NextInner<'a>,
}

enum NextInner<'a> {
    /// Heap-allocated closure (used for middleware chain wiring).
    Boxed(Box<dyn FnOnce(Request) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> + Send + Sync + 'a>),
    /// Bare function pointer (no allocation).
    FnPtr(fn(Request) -> Pin<Box<dyn Future<Output = Response> + Send + 'static>>),
}

impl<'a> Next<'a> {
    /// Create a new Next from a handler function.
    pub fn new<F>(f: F) -> Self
    where
        F: FnOnce(Request) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> + Send + Sync + 'a,
    {
        Self { inner: NextInner::Boxed(Box::new(f)) }
    }

    /// Create a new Next from a function pointer (zero allocation).
    pub fn from_fn(f: fn(Request) -> Pin<Box<dyn Future<Output = Response> + Send + 'static>>) -> Self {
        Self { inner: NextInner::FnPtr(f) }
    }

    /// Call the next handler/middleware.
    pub fn run(self, req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        match self.inner {
            NextInner::Boxed(f) => f(req),
            NextInner::FnPtr(f) => f(req),
        }
    }
}

// ── Built-in Middleware ─────────────────────────────────────────────────────

/// Request timeout middleware.
pub struct Timeout {
    pub duration: Duration,
}

impl Timeout {
    pub fn new(duration: Duration) -> Self {
        Self { duration }
    }
}

impl Middleware for Timeout {
    fn handle<'a>(
        &'a self,
        req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        let duration = self.duration;
        Box::pin(async move {
            let start = std::time::Instant::now();
            let resp = next.run(req).await;
            if start.elapsed() > duration {
                Response::new(
                    StatusCode::GATEWAY_TIMEOUT,
                    format!("Request timed out after {duration:?}").into_bytes(),
                )
            } else {
                resp
            }
        })
    }
}

/// CORS middleware.
///
/// Uses `Cow<'static, str>` for zero-allocation when using default
/// (static) header values. Custom values use `Cow::Owned`.
#[derive(Debug, Clone)]
pub struct Cors {
    pub allow_origin: std::borrow::Cow<'static, str>,
    pub allow_methods: std::borrow::Cow<'static, str>,
    pub allow_headers: std::borrow::Cow<'static, str>,
    pub max_age: Option<u64>,
}

impl Default for Cors {
    fn default() -> Self {
        Self {
            allow_origin: std::borrow::Cow::Borrowed("*"),
            allow_methods: std::borrow::Cow::Borrowed("GET, POST, PUT, DELETE, PATCH, OPTIONS"),
            allow_headers: std::borrow::Cow::Borrowed("Content-Type, Authorization"),
            max_age: Some(86400),
        }
    }
}

impl Middleware for Cors {
    fn handle<'a>(
        &'a self,
        req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        let is_preflight = req.method == crate::extractor::Method::OPTIONS;
        Box::pin(async move {
            let mut resp = if is_preflight {
                Response::empty(StatusCode::NO_CONTENT)
            } else {
                next.run(req).await
            };
            resp.headers.insert("access-control-allow-origin", self.allow_origin.clone());
            resp.headers.insert("access-control-allow-methods", self.allow_methods.clone());
            resp.headers.insert("access-control-allow-headers", self.allow_headers.clone());
            if let Some(max_age) = self.max_age {
                resp.headers.insert("access-control-max-age", max_age.to_string());
            }
            resp
        })
    }
}

/// Request ID middleware — generates a unique ID per request.
pub struct RequestId;

impl Middleware for RequestId {
    fn handle<'a>(
        &'a self,
        mut req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        Box::pin(async move {
            // Use a simple counter-based ID for now
            // In production, use UUID or similar
            let id = format!("req-{}", std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos());
            req.extensions.insert(RequestIdValue(id.clone()));
            let mut resp = next.run(req).await;
            resp.headers.insert("x-request-id", id);
            resp
        })
    }
}

/// Value type for the request ID extension.
#[derive(Debug, Clone)]
pub struct RequestIdValue(pub String);

/// Request logger middleware.
pub struct Logger;

impl Middleware for Logger {
    fn handle<'a>(
        &'a self,
        req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        let method = req.method.clone();
        let path = req.path.clone();
        // method is now a Method enum (cheap clone for standard methods)
        Box::pin(async move {
            let start = std::time::Instant::now();
            let resp = next.run(req).await;
            let elapsed = start.elapsed();
            tracing::info!(
                method = %method,
                path = %path,
                status = %resp.status,
                duration_ms = elapsed.as_millis() as u64,
                "request completed"
            );
            resp
        })
    }
}

// ── Rate Limiter ──────────────────────────────────────────────────────────

/// Actor-backed rate limiting middleware.
///
/// Tracks requests per client (keyed by `x-forwarded-for` header, falling
/// back to a default key). Returns 429 Too Many Requests when the limit
/// is exceeded within the time window.
///
/// Thread-safe via `parking_lot::Mutex`.
pub struct RateLimiter {
    max_requests: u32,
    window: Duration,
    requests: std::sync::Arc<parking_lot::Mutex<std::collections::HashMap<String, (u32, std::time::Instant)>>>,
}

impl RateLimiter {
    /// Create a new rate limiter.
    ///
    /// * `max_requests` — Maximum requests allowed per client per window.
    /// * `window` — Time window duration. After the window expires, the
    ///   counter resets.
    pub fn new(max_requests: u32, window: Duration) -> Self {
        Self {
            max_requests,
            window,
            requests: std::sync::Arc::new(parking_lot::Mutex::new(
                std::collections::HashMap::new(),
            )),
        }
    }
}

impl Middleware for RateLimiter {
    fn handle<'a>(
        &'a self,
        req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        let key = req
            .headers
            .get("x-forwarded-for")
            .unwrap_or("unknown")
            .to_owned();

        let mut map = self.requests.lock();
        let now = std::time::Instant::now();

        let allowed = match map.get_mut(&key) {
            Some((count, window_start)) => {
                if now.duration_since(*window_start) >= self.window {
                    // Window expired — reset
                    *count = 1;
                    *window_start = now;
                    true
                } else if *count < self.max_requests {
                    *count += 1;
                    true
                } else {
                    false
                }
            }
            None => {
                if self.max_requests == 0 {
                    false
                } else {
                    map.insert(key, (1, now));
                    true
                }
            }
        };

        drop(map);

        if allowed {
            next.run(req)
        } else {
            Box::pin(async move {
                Response::new(
                    StatusCode::TOO_MANY_REQUESTS,
                    "rate limit exceeded".as_bytes().to_vec(),
                )
            })
        }
    }
}

// ── Max Body Size ─────────────────────────────────────────────────────────

/// Reject requests whose `content-length` header exceeds a limit.
///
/// Returns 413 Payload Too Large if the declared content length is over
/// the configured maximum. Requests without a `content-length` header
/// pass through (streaming bodies are a separate concern).
pub struct MaxBodySize {
    pub limit: usize,
}

impl MaxBodySize {
    /// Create a new max body size middleware.
    pub fn new(limit: usize) -> Self {
        Self { limit }
    }
}

impl Middleware for MaxBodySize {
    fn handle<'a>(
        &'a self,
        req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        if let Some(cl) = req.headers.get("content-length") {
            if let Ok(size) = cl.parse::<usize>() {
                if size > self.limit {
                    return Box::pin(async move {
                        Response::new(
                            StatusCode::PAYLOAD_TOO_LARGE,
                            format!("payload too large: {size} bytes (limit {})", self.limit)
                                .into_bytes(),
                        )
                    });
                }
            }
        }
        next.run(req)
    }
}

// ── Security Headers ──────────────────────────────────────────────────────

/// Adds common security headers to every response.
///
/// Default values:
/// - `X-Content-Type-Options: nosniff`
/// - `X-Frame-Options: DENY`
/// - `X-XSS-Protection: 1; mode=block`
/// - `Content-Security-Policy: default-src 'self'`
#[derive(Debug, Clone)]
pub struct SecurityHeaders {
    pub x_content_type_options: std::borrow::Cow<'static, str>,
    pub x_frame_options: std::borrow::Cow<'static, str>,
    pub x_xss_protection: std::borrow::Cow<'static, str>,
    pub content_security_policy: std::borrow::Cow<'static, str>,
}

impl Default for SecurityHeaders {
    fn default() -> Self {
        Self {
            x_content_type_options: std::borrow::Cow::Borrowed("nosniff"),
            x_frame_options: std::borrow::Cow::Borrowed("DENY"),
            x_xss_protection: std::borrow::Cow::Borrowed("1; mode=block"),
            content_security_policy: std::borrow::Cow::Borrowed("default-src 'self'"),
        }
    }
}

impl Middleware for SecurityHeaders {
    fn handle<'a>(
        &'a self,
        req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        Box::pin(async move {
            let mut resp = next.run(req).await;
            resp.headers.insert(
                "x-content-type-options",
                self.x_content_type_options.clone(),
            );
            resp.headers.insert(
                "x-frame-options",
                self.x_frame_options.clone(),
            );
            resp.headers.insert(
                "x-xss-protection",
                self.x_xss_protection.clone(),
            );
            resp.headers.insert(
                "content-security-policy",
                self.content_security_policy.clone(),
            );
            resp
        })
    }
}

// ── Middleware Stack ──────────────────────────────────────────────────────

/// A composed stack of middlewares applied as a single unit.
///
/// Created via the [`stack`] helper function.
pub struct MiddlewareStack {
    layers: Vec<Box<dyn Middleware>>,
}

impl Middleware for MiddlewareStack {
    fn handle<'a>(
        &'a self,
        req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        if self.layers.is_empty() {
            return next.run(req);
        }

        // Build chain from inside out using recursive helper.
        // Each layer creates a Next that captures the remaining layers
        // and the terminal by reference, avoiding Arc/Mutex overhead.
        fn build<'a>(
            layers: &'a [Box<dyn Middleware>],
            idx: usize,
            req: Request,
            terminal: Next<'a>,
        ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
            if idx >= layers.len() {
                return terminal.run(req);
            }
            let next = Next::new(move |r| build(layers, idx + 1, r, terminal));
            layers[idx].handle(req, next)
        }

        build(&self.layers, 0, req, next)
    }
}

/// Apply multiple middlewares as a single composed unit.
///
/// Middlewares are applied in order: the first in the vec is the outermost
/// (runs first on request, last on response).
pub fn stack(middlewares: Vec<Box<dyn Middleware>>) -> MiddlewareStack {
    MiddlewareStack {
        layers: middlewares,
    }
}

/// Compression middleware (gzip/deflate).
pub struct Compression;

impl Middleware for Compression {
    fn handle<'a>(
        &'a self,
        req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        Box::pin(async move {
            // TODO: Implement actual compression
            // For now, pass through
            next.run(req).await
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::response::IntoResponse;

    // ── Test helpers ──────────────────────────────────────────────────────

    /// Minimal block_on for synchronous futures (no async runtime needed).
    fn futures_block_on<F: Future>(f: F) -> F::Output {
        use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};

        let mut f = Box::pin(f);

        fn raw_waker() -> RawWaker {
            fn no_op(_: *const ()) {}
            fn clone(_: *const ()) -> RawWaker {
                raw_waker()
            }
            RawWaker::new(
                std::ptr::null(),
                &RawWakerVTable::new(clone, no_op, no_op, no_op),
            )
        }

        let waker = unsafe { Waker::from_raw(raw_waker()) };
        let mut cx = Context::from_waker(&waker);

        loop {
            match f.as_mut().poll(&mut cx) {
                Poll::Ready(val) => return val,
                Poll::Pending => panic!("middleware future returned Pending in test"),
            }
        }
    }

    /// Run a single middleware around a terminal handler that returns "ok".
    fn run_one(mw: &dyn Middleware, req: Request) -> Response {
        let fut = {
            let next = Next::new(|_r| -> Pin<Box<dyn Future<Output = Response> + Send>> {
                Box::pin(async move { "ok".into_response() })
            });
            mw.handle(req, next)
        };
        futures_block_on(fut)
    }

    // ── Existing test ─────────────────────────────────────────────────────

    #[test]
    fn cors_default() {
        let cors = Cors::default();
        assert_eq!(cors.allow_origin, "*");
    }

    // ── RateLimiter tests ─────────────────────────────────────────────────

    #[test]
    fn rate_limiter_allows_under_limit() {
        let rl = RateLimiter::new(5, Duration::from_secs(60));

        // 5 requests should all pass
        for _ in 0..5 {
            let req = Request::new("GET", "/api/data")
                .with_header("x-forwarded-for", "10.0.0.1");
            let resp = run_one(&rl, req);
            assert_eq!(resp.status, StatusCode::OK);
        }
    }

    #[test]
    fn rate_limiter_blocks_over_limit() {
        let rl = RateLimiter::new(3, Duration::from_secs(60));

        // First 3 pass
        for _ in 0..3 {
            let req = Request::new("GET", "/")
                .with_header("x-forwarded-for", "10.0.0.1");
            let resp = run_one(&rl, req);
            assert_eq!(resp.status, StatusCode::OK);
        }

        // 4th should be 429
        let req = Request::new("GET", "/")
            .with_header("x-forwarded-for", "10.0.0.1");
        let resp = run_one(&rl, req);
        assert_eq!(resp.status, StatusCode::TOO_MANY_REQUESTS);
    }

    #[test]
    fn rate_limiter_window_resets() {
        // Use a tiny window so it "expires" immediately
        let rl = RateLimiter::new(1, Duration::from_millis(0));

        let req = Request::new("GET", "/")
            .with_header("x-forwarded-for", "10.0.0.1");
        let resp = run_one(&rl, req);
        assert_eq!(resp.status, StatusCode::OK);

        // Even though we used the 1 request, the window has expired (0ms),
        // so the next request should reset and pass
        std::thread::sleep(Duration::from_millis(1));
        let req = Request::new("GET", "/")
            .with_header("x-forwarded-for", "10.0.0.1");
        let resp = run_one(&rl, req);
        assert_eq!(resp.status, StatusCode::OK);
    }

    #[test]
    fn rate_limiter_separate_clients() {
        let rl = RateLimiter::new(1, Duration::from_secs(60));

        // Client A uses their 1 request
        let req = Request::new("GET", "/")
            .with_header("x-forwarded-for", "10.0.0.1");
        let resp = run_one(&rl, req);
        assert_eq!(resp.status, StatusCode::OK);

        // Client B should still have their own quota
        let req = Request::new("GET", "/")
            .with_header("x-forwarded-for", "10.0.0.2");
        let resp = run_one(&rl, req);
        assert_eq!(resp.status, StatusCode::OK);

        // Client A is now blocked
        let req = Request::new("GET", "/")
            .with_header("x-forwarded-for", "10.0.0.1");
        let resp = run_one(&rl, req);
        assert_eq!(resp.status, StatusCode::TOO_MANY_REQUESTS);
    }

    // ── MaxBodySize tests ─────────────────────────────────────────────────

    #[test]
    fn max_body_size_allows_small() {
        let mw = MaxBodySize::new(1024);
        let req = Request::new("POST", "/upload")
            .with_header("content-length", "100")
            .with_body(vec![0u8; 100]);
        let resp = run_one(&mw, req);
        assert_eq!(resp.status, StatusCode::OK);
    }

    #[test]
    fn max_body_size_rejects_large() {
        let mw = MaxBodySize::new(1024);
        let req = Request::new("POST", "/upload")
            .with_header("content-length", "2048");
        let resp = run_one(&mw, req);
        assert_eq!(resp.status, StatusCode::PAYLOAD_TOO_LARGE);
    }

    #[test]
    fn max_body_size_no_header_passes() {
        // No content-length header — pass through (can't check body size
        // from header alone; actual body validation is separate concern)
        let mw = MaxBodySize::new(1024);
        let req = Request::new("GET", "/");
        let resp = run_one(&mw, req);
        assert_eq!(resp.status, StatusCode::OK);
    }

    #[test]
    fn max_body_size_exact_limit_passes() {
        let mw = MaxBodySize::new(1024);
        let req = Request::new("POST", "/upload")
            .with_header("content-length", "1024");
        let resp = run_one(&mw, req);
        assert_eq!(resp.status, StatusCode::OK);
    }

    // ── SecurityHeaders tests ─────────────────────────────────────────────

    #[test]
    fn security_headers_added() {
        let mw = SecurityHeaders::default();
        let req = Request::new("GET", "/");
        let resp = run_one(&mw, req);

        assert_eq!(resp.status, StatusCode::OK);
        assert_eq!(
            resp.headers.get("x-content-type-options").unwrap(),
            "nosniff"
        );
        assert_eq!(resp.headers.get("x-frame-options").unwrap(), "DENY");
        assert_eq!(
            resp.headers.get("x-xss-protection").unwrap(),
            "1; mode=block"
        );
        assert_eq!(
            resp.headers.get("content-security-policy").unwrap(),
            "default-src 'self'"
        );
    }

    #[test]
    fn security_headers_custom() {
        let mw = SecurityHeaders {
            content_security_policy: std::borrow::Cow::Borrowed("default-src 'self'; script-src 'unsafe-inline'"),
            x_frame_options: std::borrow::Cow::Borrowed("SAMEORIGIN"),
            ..Default::default()
        };
        let req = Request::new("GET", "/");
        let resp = run_one(&mw, req);

        assert_eq!(resp.headers.get("x-frame-options").unwrap(), "SAMEORIGIN");
        assert_eq!(
            resp.headers.get("content-security-policy").unwrap(),
            "default-src 'self'; script-src 'unsafe-inline'"
        );
    }

    // ── MiddlewareStack tests ─────────────────────────────────────────────

    #[test]
    fn middleware_stack_applies_all() {
        let mw_stack = stack(vec![
            Box::new(SecurityHeaders::default()),
            Box::new(RequestId),
        ]);

        let req = Request::new("GET", "/");
        let resp = run_one(&mw_stack, req);

        // SecurityHeaders should have added its headers
        assert_eq!(
            resp.headers.get("x-content-type-options").unwrap(),
            "nosniff"
        );
        // RequestId should have added x-request-id
        assert!(resp.headers.contains_key("x-request-id"));
    }

    #[test]
    fn middleware_stack_empty_passes_through() {
        let mw_stack = stack(vec![]);
        let req = Request::new("GET", "/");
        let resp = run_one(&mw_stack, req);
        assert_eq!(resp.status, StatusCode::OK);
    }

    #[test]
    fn middleware_stack_short_circuit() {
        // RateLimiter with 0 requests allowed should block immediately
        let mw_stack = stack(vec![
            Box::new(RateLimiter::new(0, Duration::from_secs(60))),
            Box::new(SecurityHeaders::default()),
        ]);

        let req = Request::new("GET", "/")
            .with_header("x-forwarded-for", "10.0.0.1");
        let resp = run_one(&mw_stack, req);

        // Should get 429 — SecurityHeaders should NOT have run
        assert_eq!(resp.status, StatusCode::TOO_MANY_REQUESTS);
        assert!(!resp.headers.contains_key("x-content-type-options"));
    }
}
