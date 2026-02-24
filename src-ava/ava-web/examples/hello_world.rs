//! # Hello World — Minimal ava-web Server
//!
//! The 30-second intro to ava-web. Demonstrates:
//! - Creating a `Router` with a single GET route
//! - Using `FnHandler` to wrap a sync function
//! - Binding and serving with `HttpServer`
//!
//! # Run
//!
//! ```bash
//! cargo run --example hello_world
//! # Then: curl http://127.0.0.1:3000/
//! ```

use ava_web::handler::FnHandler;
use ava_web::response::Json;
use ava_web::{get, HttpServer, Router};

// ── Handlers ──────────────────────────────────────────────────────────────

/// A handler is any function that returns a type implementing `IntoResponse`.
/// Strings, &str, StatusCode, Json<T>, Html<T>, and (StatusCode, T) all work.
fn hello() -> &'static str {
    "Hello from ava-web!"
}

/// JSON responses are automatic via `response::Json<T>`.
/// T must implement `serde::Serialize`.
fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "framework": "ava-web",
        "runtime": "asupersync"
    }))
}

// ── Main ──────────────────────────────────────────────────────────────────

fn main() {
    // Build the application router.
    // Routes are matched via a matchit radix tree — O(log n) lookup.
    let app = Router::new()
        .route("/", get(FnHandler::new(hello)))
        .route("/health", get(FnHandler::new(health)));

    println!("Listening on http://127.0.0.1:3000");
    println!("Try: curl http://127.0.0.1:3000/");
    println!("Try: curl http://127.0.0.1:3000/health");

    // HttpServer::bind() is async — it needs an asupersync runtime to drive.
    // We create a minimal runtime just for binding, then .serve(app) blocks
    // the calling thread with its own runtime.
    //
    // Under the hood: every connection is a supervised GenServer actor.
    // If a connection handler panics, the supervisor restarts it.
    // No tokio. No hyper. Just asupersync.
    let rt = asupersync::runtime::RuntimeBuilder::current_thread()
        .build()
        .expect("failed to build runtime");
    let server = rt.block_on(async {
        HttpServer::bind("127.0.0.1:3000")
            .await
            .expect("failed to bind")
    });
    drop(rt);
    let _ = server.serve(app);
}
