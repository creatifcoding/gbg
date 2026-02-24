//! # Middleware Composition — Custom Middleware and Stacks
//!
//! Demonstrates the full power of ava-web's middleware system:
//! - Implementing a custom `Middleware` from scratch
//! - Using built-in middleware: CORS, SecurityHeaders, Logger, RateLimiter
//! - Composing middleware into a `MiddlewareStack`
//! - Short-circuit patterns (rejecting requests early)
//! - Testing middleware behavior with `TestServer`
//!
//! # Middleware Execution Order
//!
//! Middleware is applied in **LIFO order**: the last `.layer()` call is
//! the outermost middleware (runs first on request, last on response).
//!
//! ```text
//! Request:  CORS -> Security -> Logger -> Handler
//! Response: Handler -> Logger -> Security -> CORS
//! ```
//!
//! # Run
//!
//! ```bash
//! cargo run --example middleware_composition
//! ```

use std::future::Future;
use std::pin::Pin;
use std::time::Duration;

use ava_web::extractor::Request;
use ava_web::handler::FnHandler;
use ava_web::middleware::{
    Cors, MaxBodySize, Middleware, Next, RateLimiter,
    SecurityHeaders, stack,
};
use ava_web::response::{Response, StatusCode};
use ava_web::testing::TestServer;
use ava_web::{get, post, Router};

// ── Custom Middleware: API Key Guard ──────────────────────────────────────

/// A custom middleware that requires an `x-api-key` header.
///
/// Demonstrates the `Middleware` trait: inspect the request, optionally
/// short-circuit with an error response, or call `next.run()` to
/// continue the chain.
struct ApiKeyGuard {
    /// The expected API key.
    expected_key: String,
}

impl ApiKeyGuard {
    fn new(key: impl Into<String>) -> Self {
        Self {
            expected_key: key.into(),
        }
    }
}

impl Middleware for ApiKeyGuard {
    fn handle<'a>(
        &'a self,
        req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        Box::pin(async move {
            // Check for the API key header.
            match req.headers.get("x-api-key") {
                Some(key) if key == self.expected_key => {
                    // Key matches — continue to the next middleware/handler.
                    next.run(req).await
                }
                Some(_) => {
                    // Wrong key — short-circuit with 403.
                    Response::new(
                        StatusCode::FORBIDDEN,
                        "invalid API key".as_bytes().to_vec(),
                    )
                }
                None => {
                    // Missing key — short-circuit with 401.
                    Response::new(
                        StatusCode::UNAUTHORIZED,
                        "missing x-api-key header".as_bytes().to_vec(),
                    )
                }
            }
        })
    }
}

// ── Custom Middleware: Response Timer ─────────────────────────────────────

/// A middleware that adds a `server-timing` header with the handler duration.
///
/// This demonstrates the "before + after" pattern: measure time before
/// calling `next.run()`, then add the measurement to the response.
struct ServerTiming;

impl Middleware for ServerTiming {
    fn handle<'a>(
        &'a self,
        req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        Box::pin(async move {
            let start = std::time::Instant::now();
            let mut resp = next.run(req).await;
            let elapsed = start.elapsed();
            resp.headers.insert(
                "server-timing",
                format!("handler;dur={:.3}", elapsed.as_secs_f64() * 1000.0),
            );
            resp
        })
    }
}

// ── Main ──────────────────────────────────────────────────────────────────

fn main() {
    println!("=== ava-web Middleware Composition ===\n");

    // ── 1. Custom middleware demo ─────────────────────────────────────────

    println!("1. Custom ApiKeyGuard Middleware");

    let app = Router::new()
        .route("/api/data", get(FnHandler::new(|| "sensitive data")))
        .layer(ApiKeyGuard::new("secret-123"));

    let server = TestServer::new(app);

    // No key -> 401
    let resp = server.get("/api/data").send();
    println!("   No key:      {} ({})", resp.status(), resp.text());
    assert_eq!(resp.status(), 401);

    // Wrong key -> 403
    let resp = server.get("/api/data").header("x-api-key", "wrong").send();
    println!("   Wrong key:   {} ({})", resp.status(), resp.text());
    assert_eq!(resp.status(), 403);

    // Correct key -> 200
    let resp = server.get("/api/data").header("x-api-key", "secret-123").send();
    println!("   Correct key: {} ({})", resp.status(), resp.text());
    assert_eq!(resp.status(), 200);

    println!();

    // ── 2. MiddlewareStack composition ───────────────────────────────────

    println!("2. MiddlewareStack — Compose Multiple Middleware as One Unit");

    // The `stack()` helper creates a MiddlewareStack from a Vec.
    // Middleware applies in order: first = outermost.
    let production_stack = stack(vec![
        Box::new(Cors::default()),
        Box::new(SecurityHeaders::default()),
        Box::new(ServerTiming),
    ]);

    let app = Router::new()
        .route("/api/data", get(FnHandler::new(|| "data")))
        .layer(production_stack);

    let server = TestServer::new(app);
    let resp = server.get("/api/data").send();
    println!("   Status: {}", resp.status());
    println!("   CORS origin: {:?}", resp.header("access-control-allow-origin"));
    println!("   Security: {:?}", resp.header("x-content-type-options"));
    println!("   Timing: {:?}", resp.header("server-timing"));
    assert_eq!(resp.status(), 200);
    assert!(resp.header("access-control-allow-origin").is_some());
    assert!(resp.header("x-content-type-options").is_some());

    println!();

    // ── 3. LIFO ordering demonstration ───────────────────────────────────

    println!("3. LIFO Ordering — Last .layer() = Outermost = Runs First");

    // layer(A) then layer(B) means: B wraps A wraps handler.
    // Request: B -> A -> handler. Response: handler -> A -> B.
    let app = Router::new()
        .route("/test", get(FnHandler::new(|| "handler")))
        .layer(ApiKeyGuard::new("key")) // Inner: runs second
        .layer(ServerTiming);           // Outer: runs first

    let server = TestServer::new(app);

    // ServerTiming runs FIRST (outer) — adds header even on 401.
    let resp = server.get("/test").send();
    println!("   401 response still gets server-timing: {:?}", resp.header("server-timing"));
    // ApiKeyGuard short-circuits before handler, but ServerTiming
    // already wrapped the future, so its "after" runs.
    assert_eq!(resp.status(), 401);

    println!();

    // ── 4. Short-circuit pattern ─────────────────────────────────────────

    println!("4. Short-Circuit — RateLimiter + MaxBodySize");

    let app = Router::new()
        .route("/upload", post(FnHandler::new(|| "uploaded")))
        .layer(MaxBodySize::new(1024))
        .layer(RateLimiter::new(2, Duration::from_secs(60)));

    let server = TestServer::new(app);

    // First 2 requests pass.
    let resp = server.post("/upload").header("content-length", "100").send();
    println!("   Request 1: {}", resp.status());
    assert_eq!(resp.status(), 200);

    let resp = server.post("/upload").header("content-length", "100").send();
    println!("   Request 2: {}", resp.status());
    assert_eq!(resp.status(), 200);

    // 3rd request -> rate limited (429).
    let resp = server.post("/upload").header("content-length", "100").send();
    println!("   Request 3: {} (rate limited)", resp.status());
    assert_eq!(resp.status(), 429);

    // Large body -> 413 Payload Too Large (even if within rate limit).
    // Note: using a fresh server since the rate limiter in this one is exhausted.
    let app2 = Router::new()
        .route("/upload", post(FnHandler::new(|| "uploaded")))
        .layer(MaxBodySize::new(1024));

    let server2 = TestServer::new(app2);
    let resp = server2.post("/upload").header("content-length", "999999").send();
    println!("   Large body: {} (rejected by MaxBodySize)", resp.status());
    assert_eq!(resp.status(), 413);

    println!("\n=== All middleware tests passed. ===");
}
