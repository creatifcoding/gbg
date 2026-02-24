//! # Actor Counter — Stateful GenServer Handler
//!
//! Demonstrates the key differentiator of ava-web: **actor handlers** with
//! persistent, mutable state across requests — without `Arc<Mutex<T>>`.
//!
//! This example shows:
//! - Implementing `ActorHandler` with interior mutability (`AtomicU32`)
//! - Wrapping an actor as a route handler via `ActorHandlerWrapper`
//! - Creating an `ActorPool` for round-robin request distribution
//! - Combining stateless and stateful handlers in a single router
//!
//! # Architecture
//!
//! In ava-web, every actor is a supervised GenServer. If a handler panics,
//! the supervisor restarts the connection — the actor's state survives.
//!
//! # Run
//!
//! ```bash
//! cargo run --example actor_counter
//! # curl http://127.0.0.1:3002/count     # Returns 0, then 1, 2, 3...
//! # curl http://127.0.0.1:3002/pool      # Round-robins across 4 actors
//! # curl http://127.0.0.1:3002/pool/stats
//! ```

use std::future::Future;
use std::pin::Pin;
use std::sync::atomic::{AtomicU32, Ordering};

use ava_web::extractor::Request;
use ava_web::handler::FnHandler;
use ava_web::response::{IntoResponse, Response};
use ava_web::state::{ActorHandler, ActorHandlerWrapper, ActorPool, ActorPoolHandler};
use ava_web::{get, Router};

// ── CounterActor ──────────────────────────────────────────────────────────

/// A stateful counter actor.
///
/// Implements `ActorHandler` — the trait for handlers with persistent state.
/// Unlike stateless `FnHandler` functions, this struct lives for the
/// lifetime of the server and maintains its own state across requests.
///
/// Uses `AtomicU32` for interior mutability because `handle_request`
/// receives `&self` (shared reference), allowing concurrent access.
struct CounterActor {
    /// The counter value, persisted across requests.
    count: AtomicU32,
    /// A human-readable name for this actor instance.
    name: String,
}

impl CounterActor {
    fn new(name: impl Into<String>) -> Self {
        Self {
            count: AtomicU32::new(0),
            name: name.into(),
        }
    }
}

impl ActorHandler for CounterActor {
    /// Handle an HTTP request.
    ///
    /// The `&self` receiver means this actor can handle multiple requests
    /// concurrently. State mutations must use interior mutability.
    fn handle_request(&self, _req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        // Atomically increment the counter and return the previous value.
        // SeqCst ordering ensures visibility across all cores.
        let n = self.count.fetch_add(1, Ordering::SeqCst);

        // Build the response. IntoResponse is implemented for String.
        let body = format!(
            "{{\"actor\":\"{}\",\"count\":{n},\"message\":\"State persists across requests!\"}}",
            self.name
        );
        let resp = ava_web::response::Response::new(
            ava_web::response::StatusCode::OK,
            bytes::Bytes::from(body),
        )
        .header("content-type", "application/json");

        Box::pin(async move { resp })
    }
}

// ── Main ──────────────────────────────────────────────────────────────────

fn main() {
    // --- Single actor handler ---
    //
    // One CounterActor instance handles all requests to /count.
    // State accumulates: 0, 1, 2, 3, ...
    let single = ActorHandlerWrapper::new(CounterActor::new("singleton"));

    // --- Actor pool (round-robin) ---
    //
    // Four CounterActor instances in a pool. Requests are distributed
    // round-robin: actor-0, actor-1, actor-2, actor-3, actor-0, ...
    //
    // Each actor maintains its own independent counter. This provides
    // request isolation — useful when actors hold non-trivial state
    // like database connections or caches.
    let pool = ActorPool::new(vec![
        CounterActor::new("pool-0"),
        CounterActor::new("pool-1"),
        CounterActor::new("pool-2"),
        CounterActor::new("pool-3"),
    ]);
    let pool_handler = ActorPoolHandler::new(pool);

    // Build the router with both stateless and stateful handlers.
    let app = Router::new()
        // Stateless handler — no state, no actor, just a function.
        .route(
            "/",
            get(FnHandler::new(|| {
                "ava-web actor counter example. Try /count or /pool"
            })),
        )
        // Single actor — all requests go to one CounterActor instance.
        .route("/count", get(single))
        // Actor pool — requests round-robin across 4 actors.
        .route("/pool", get(pool_handler));

    println!("Actor counter on http://127.0.0.1:3002");
    println!("  /count — single actor, persistent counter");
    println!("  /pool  — round-robin across 4 actors");

    let rt = asupersync::runtime::RuntimeBuilder::current_thread()
        .build()
        .expect("failed to build runtime");
    let server = rt.block_on(async {
        ava_web::HttpServer::bind("127.0.0.1:3002")
            .await
            .expect("failed to bind")
    });
    drop(rt);
    let _ = server.serve(app);
}
