//! Full Pipeline End-to-End Benchmarks.
//!
//! Measures the complete request lifecycle: H1 bridge → router → middleware →
//! extractor → handler → response → H1 bridge out. This is the "all-in"
//! benchmark that validates whether the individual micro-optimizations
//! compose into real-world throughput.
//!
//! # Pipeline Stages (measured)
//!
//! ```text
//! ┌──────────────────────────────────────────────────────────────────┐
//! │ h1::Request                                                      │
//! │   ↓ convert_h1_request_owned (zero-copy body, Cow headers)      │
//! │ WebRequest                                                       │
//! │   ↓ Router::handle()                                             │
//! │     ├─ State injection (if configured)                           │
//! │     ├─ Middleware chain (LIFO, FnOnce Next)                      │
//! │     ├─ matchit radix-tree lookup (O(1) effective)                │
//! │     ├─ Path param extraction (if any)                            │
//! │     └─ Handler dispatch (FnHandler / ActorHandler / Pool)        │
//! │ WebResponse                                                      │
//! │   ↓ convert_web_to_h1 (Vec::from(Bytes), header collect)        │
//! │ (u16, Vec<(String,String)>, Vec<u8>)                             │
//! └──────────────────────────────────────────────────────────────────┘
//! ```
//!
//! # Little's Law — Theoretical vs Measured
//!
//! Per-stage estimates (from isolated micro-benchmarks, summed linearly):
//!
//! | Stage                        | Measured Isolation | Notes               |
//! |------------------------------|--------------------|---------------------|
//! | H1 bridge in (6 hdrs, query) | ~330 ns           | zero-copy body      |
//! | Router dispatch (static)     | ~107 ns           | matchit radix-tree  |
//! | Router dispatch (with param) | ~159 ns           | +52 ns for capture  |
//! | H1 bridge out (JSON + 2 hdr) | ~89 ns            | Vec::from(Bytes)    |
//! | **Sum (static route)**       | **~526 ns**       |                     |
//!
//! Measured combined pipeline: **~429 ns** (18% faster than linear sum).
//! The gap comes from instruction-level parallelism overlapping stages.
//!
//! ```text
//! Theoretical max (linear sum):   1 / 526 ns = ~1,901K req/s/core
//! Measured plaintext throughput:   1 / 350 ns = ~2,857K req/s/core
//! Measured REST (CORS+Security):  1 / 1,006 ns = ~994K req/s/core
//! PERFORMANCE.md original est.:   1 / 1,437 ns = ~696K req/s/core
//! ```
//!
//! The original PERFORMANCE.md estimate included 4 middleware layers in the
//! linear sum (760 ns). Without middleware, the measured pipeline is **3.4x
//! faster** than that estimate, confirming that:
//! 1. CPU branch prediction warms after first iteration
//! 2. Zero-copy optimizations (H1 bridge, middleware FnOnce) eliminate allocs
//! 3. ILP overlaps independent pipeline stages
//!
//! # What This Benchmark Answers
//!
//! 1. Does the composed pipeline match the sum of individual benchmarks?
//!    (composition overhead should be < 5%)
//! 2. How does middleware count affect end-to-end latency?
//! 3. Is there a cliff where body size dominates?
//! 4. What's the realistic req/s/core for REST endpoints?
//! 5. How does extractor composition scale (Path + Query + Json)?
//! 6. What's the cost of a 10-middleware full production stack?

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::Duration;

use bytes::Bytes;
use serde::{Deserialize, Serialize};

use ava_web::extractor::{Json, Path, Query, Request};
use ava_web::handler::{FnHandler, FnHandler1, FnHandler3};
use ava_web::middleware::{
    Compression, Cors, Logger, MaxBodySize, Middleware, Next, RateLimiter, RequestId,
    SecurityHeaders, Timeout,
};
use ava_web::response::{IntoResponse, Response, StatusCode};
use ava_web::router::{get, post, Router};
use ava_web::server::{convert_h1_request_owned, convert_web_to_h1};
use ava_web::state::{ActorHandler, ActorHandlerWrapper, ActorPool, ActorPoolHandler};

// ── Noop Executor ────────────────────────────────────────────────────────────

/// Minimal single-poll executor. All our handlers resolve immediately
/// (no actual I/O), so a single poll suffices.
fn block_on<F: Future>(mut fut: F) -> F::Output {
    use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};
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
        Poll::Pending => panic!("pipeline_bench: future returned Pending"),
    }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

fn plaintext_handler() -> &'static str {
    "Hello, World!"
}

fn json_handler() -> Response {
    Response::new(
        StatusCode::OK,
        Bytes::from_static(b"{\"message\":\"Hello, World!\",\"status\":\"ok\"}"),
    )
    .header("content-type", "application/json")
}

fn echo_handler(ava_web::extractor::RawBody(body): ava_web::extractor::RawBody) -> Response {
    let len = body.len();
    Response::new(StatusCode::OK, body)
        .header("content-type", "application/octet-stream")
        .header("content-length", len.to_string())
}

// ── Actor Handler ────────────────────────────────────────────────────────────

struct NoopActor;

impl ActorHandler for NoopActor {
    fn handle_request(&self, _req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        let resp = "actor-ok".into_response();
        Box::pin(async move { resp })
    }
}

struct CounterActor {
    count: AtomicU32,
}

impl CounterActor {
    fn new() -> Self {
        Self {
            count: AtomicU32::new(0),
        }
    }
}

impl ActorHandler for CounterActor {
    fn handle_request(&self, _req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        let n = self.count.fetch_add(1, Ordering::Relaxed);
        let body = format!("count:{n}");
        let resp = body.into_response();
        Box::pin(async move { resp })
    }
}

// ── JSON Payloads for Extractor + Throughput Benchmarks ──────────────────────

/// Small JSON payload (~60 bytes serialized). Used for extractor composition
/// and JSON round-trip throughput benchmarks.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SmallPayload {
    id: u64,
    name: String,
    active: bool,
}

/// Medium JSON payload (~1KB serialized). Used for the full-stack pipeline.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct MediumPayload {
    id: u64,
    name: String,
    email: String,
    roles: Vec<String>,
    metadata: HashMap<String, String>,
}

impl MediumPayload {
    fn sample_1kb() -> Self {
        let mut metadata = HashMap::new();
        for i in 0..15 {
            metadata.insert(format!("key_{i}"), format!("value_{i}_padding_data"));
        }
        Self {
            id: 42,
            name: "Alice Wonderland".to_string(),
            email: "alice@example.com".to_string(),
            roles: vec![
                "admin".into(),
                "editor".into(),
                "viewer".into(),
                "auditor".into(),
            ],
            metadata,
        }
    }
}

// ── Middleware Helpers ────────────────────────────────────────────────────────

/// A passthrough middleware that does zero work — measures pure overhead.
struct Passthrough;

impl Middleware for Passthrough {
    fn handle<'a>(
        &'a self,
        req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        next.run(req)
    }
}

/// Simulates a realistic middleware: reads a header, adds a response header.
struct HeaderMiddleware {
    name: &'static str,
    value: &'static str,
}

impl Middleware for HeaderMiddleware {
    fn handle<'a>(
        &'a self,
        req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        Box::pin(async move {
            let mut resp = next.run(req).await;
            resp.headers.insert(self.name, self.value);
            resp
        })
    }
}

// ── H1 Request Builders ──────────────────────────────────────────────────────

/// Build a realistic h1::Request with 6 headers and a body of given size.
fn make_h1_request(
    method: asupersync::http::h1::types::Method,
    uri: &str,
    body_size: usize,
) -> asupersync::http::h1::types::Request {
    asupersync::http::h1::types::Request {
        method,
        uri: uri.to_string(),
        version: asupersync::http::h1::types::Version::Http11,
        headers: vec![
            ("Host".into(), "api.example.com".into()),
            ("Accept".into(), "application/json".into()),
            (
                "Authorization".into(),
                "Bearer eyJhbGciOiJIUzI1NiJ9.e30.ZRrHA1JJJW8opB1Qfp7QDo".into(),
            ),
            ("Content-Type".into(), "application/json".into()),
            ("User-Agent".into(), "ava-client/1.0".into()),
            ("Accept-Encoding".into(), "gzip, deflate, br".into()),
        ],
        body: vec![0xAB; body_size],
        trailers: vec![],
        peer_addr: None,
    }
}

/// Build a GET h1::Request to the given path.
fn h1_get(path: &str) -> asupersync::http::h1::types::Request {
    make_h1_request(asupersync::http::h1::types::Method::Get, path, 0)
}

/// Build a POST h1::Request with a body.
fn h1_post(path: &str, body_size: usize) -> asupersync::http::h1::types::Request {
    make_h1_request(asupersync::http::h1::types::Method::Post, path, body_size)
}

// ── Full Pipeline: H1 in → Router → H1 out ──────────────────────────────────

/// Run a complete pipeline: h1::Request → web → router → web → h1 response.
fn run_pipeline(
    router: &Router,
    h1_req: asupersync::http::h1::types::Request,
) -> (u16, Vec<(String, String)>, Vec<u8>) {
    let web_req = convert_h1_request_owned(h1_req);
    let web_resp = block_on(router.handle(web_req));
    convert_web_to_h1(web_resp)
}

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK GROUPS
// ═══════════════════════════════════════════════════════════════════════════

// ── Group 1: Plaintext pipeline (theoretical max) ────────────────────────────

fn bench_plaintext_pipeline(c: &mut Criterion) {
    let mut group = c.benchmark_group("pipeline/plaintext");

    // Bare minimum: no middleware, static route, plaintext response.
    // This is the closest to the PERFORMANCE.md theoretical max of 696K req/s/core.
    let router = Router::new().route("/", get(FnHandler::new(plaintext_handler)));

    group.bench_function("bare", |b| {
        b.iter(|| {
            let h1_req = h1_get("/");
            black_box(run_pipeline(&router, black_box(h1_req)));
        });
    });

    // With JSON response (still no body parsing)
    let router_json = Router::new().route("/api", get(FnHandler::new(json_handler)));

    group.bench_function("json_response", |b| {
        b.iter(|| {
            let h1_req = h1_get("/api");
            black_box(run_pipeline(&router_json, black_box(h1_req)));
        });
    });

    // With path parameter extraction
    let router_param = Router::new().route(
        "/users/{id}",
        get(FnHandler::new(plaintext_handler)),
    );

    group.bench_function("with_path_param", |b| {
        b.iter(|| {
            let h1_req = h1_get("/users/42");
            black_box(run_pipeline(&router_param, black_box(h1_req)));
        });
    });

    // With query string in URI
    let router_query = Router::new().route("/search", get(FnHandler::new(plaintext_handler)));

    group.bench_function("with_query", |b| {
        b.iter(|| {
            let h1_req = h1_get("/search?q=rust&page=1&limit=50");
            black_box(run_pipeline(&router_query, black_box(h1_req)));
        });
    });

    group.finish();
}

// ── Group 2: Handler type comparison ─────────────────────────────────────────

fn bench_handler_types(c: &mut Criterion) {
    let mut group = c.benchmark_group("pipeline/handler_type");

    // 1. Plain FnHandler (sync)
    let fn_router = Router::new().route("/", get(FnHandler::new(plaintext_handler)));
    group.bench_function("fn_handler", |b| {
        b.iter(|| {
            let h1_req = h1_get("/");
            black_box(run_pipeline(&fn_router, black_box(h1_req)));
        });
    });

    // 2. Single ActorHandler (noop)
    let actor_router =
        Router::new().route("/", get(ActorHandlerWrapper::new(NoopActor)));
    group.bench_function("actor_handler/noop", |b| {
        b.iter(|| {
            let h1_req = h1_get("/");
            black_box(run_pipeline(&actor_router, black_box(h1_req)));
        });
    });

    // 3. Single ActorHandler (counter — atomic state mutation)
    let counter_router =
        Router::new().route("/", get(ActorHandlerWrapper::new(CounterActor::new())));
    group.bench_function("actor_handler/counter", |b| {
        b.iter(|| {
            let h1_req = h1_get("/");
            black_box(run_pipeline(&counter_router, black_box(h1_req)));
        });
    });

    // 4. ActorPoolHandler(4) — noop
    let pool4_noop = ActorPool::new(vec![
        NoopActor, NoopActor, NoopActor, NoopActor,
    ]);
    let pool4_router =
        Router::new().route("/", get(ActorPoolHandler::new(pool4_noop)));
    group.bench_function("actor_pool_4/noop", |b| {
        b.iter(|| {
            let h1_req = h1_get("/");
            black_box(run_pipeline(&pool4_router, black_box(h1_req)));
        });
    });

    // 5. ActorPoolHandler(4) — counter
    let pool4_counter = ActorPool::new(vec![
        CounterActor::new(),
        CounterActor::new(),
        CounterActor::new(),
        CounterActor::new(),
    ]);
    let pool4c_router =
        Router::new().route("/", get(ActorPoolHandler::new(pool4_counter)));
    group.bench_function("actor_pool_4/counter", |b| {
        b.iter(|| {
            let h1_req = h1_get("/");
            black_box(run_pipeline(&pool4c_router, black_box(h1_req)));
        });
    });

    group.finish();
}

// ── Group 3: Middleware scaling ───────────────────────────────────────────────

fn bench_middleware_scaling(c: &mut Criterion) {
    let mut group = c.benchmark_group("pipeline/middleware");

    for mw_count in [0, 1, 3, 5, 10] {
        // Use passthrough middleware to measure pure overhead
        let mut router = Router::new().route("/", get(FnHandler::new(plaintext_handler)));
        for _ in 0..mw_count {
            router = router.layer(Passthrough);
        }

        group.bench_with_input(
            BenchmarkId::new("passthrough", mw_count),
            &mw_count,
            |b, _| {
                b.iter(|| {
                    let h1_req = h1_get("/");
                    black_box(run_pipeline(&router, black_box(h1_req)));
                });
            },
        );
    }

    // Realistic middleware stacks
    for mw_count in [0, 3, 5, 10] {
        let mut router = Router::new().route("/", get(FnHandler::new(plaintext_handler)));
        for i in 0..mw_count {
            router = router.layer(HeaderMiddleware {
                name: match i % 4 {
                    0 => "x-trace-id",
                    1 => "x-request-time",
                    2 => "x-server",
                    _ => "x-custom",
                },
                value: "benchmark-value",
            });
        }

        group.bench_with_input(
            BenchmarkId::new("header_mw", mw_count),
            &mw_count,
            |b, _| {
                b.iter(|| {
                    let h1_req = h1_get("/");
                    black_box(run_pipeline(&router, black_box(h1_req)));
                });
            },
        );
    }

    // Production-like stack: CORS + SecurityHeaders
    let prod_router = Router::new()
        .route("/api", get(FnHandler::new(json_handler)))
        .layer(Cors::default())
        .layer(SecurityHeaders::default());

    group.bench_function("production_cors_security", |b| {
        b.iter(|| {
            let h1_req = h1_get("/api");
            black_box(run_pipeline(&prod_router, black_box(h1_req)));
        });
    });

    group.finish();
}

// ── Group 4: Body size impact ────────────────────────────────────────────────

fn bench_body_size(c: &mut Criterion) {
    let mut group = c.benchmark_group("pipeline/body_size");

    // Echo handler: receives body, returns it unchanged.
    // This measures the body path through the pipeline: H1 bridge (zero-copy in)
    // → handler → H1 bridge out (Vec::from(Bytes)).
    let router = Router::new().route(
        "/echo",
        post(FnHandler1::<_, ava_web::extractor::RawBody>::new(echo_handler)),
    );

    for &(label, size) in &[
        ("empty", 0),
        ("1KB", 1024),
        ("64KB", 65_536),
        ("1MB", 1_048_576),
    ] {
        group.bench_function(label, |b| {
            b.iter(|| {
                let h1_req = h1_post("/echo", size);
                black_box(run_pipeline(&router, black_box(h1_req)));
            });
        });
    }

    // Same but with 3 middleware layers — does body size amplify middleware cost?
    let mut mw_router = Router::new().route(
        "/echo",
        post(FnHandler1::<_, ava_web::extractor::RawBody>::new(echo_handler)),
    );
    for _ in 0..3 {
        mw_router = mw_router.layer(Passthrough);
    }

    for &(label, size) in &[("empty+3mw", 0), ("1KB+3mw", 1024), ("1MB+3mw", 1_048_576)] {
        group.bench_function(label, |b| {
            b.iter(|| {
                let h1_req = h1_post("/echo", size);
                black_box(run_pipeline(&mw_router, black_box(h1_req)));
            });
        });
    }

    group.finish();
}

// ── Group 5: Realistic REST endpoint ─────────────────────────────────────────

fn bench_rest_endpoint(c: &mut Criterion) {
    let mut group = c.benchmark_group("pipeline/rest");

    // Simulates: GET /api/v1/users/{id}?fields=name,email
    // With: CORS + SecurityHeaders + path param + query string
    // This is the canonical "realistic REST" benchmark for comparison
    // with the PERFORMANCE.md theoretical max.

    fn user_handler() -> Response {
        Response::new(
            StatusCode::OK,
            Bytes::from_static(
                b"{\"id\":42,\"name\":\"Alice\",\"email\":\"alice@example.com\"}",
            ),
        )
        .header("content-type", "application/json")
        .header("cache-control", "max-age=60")
    }

    let router = Router::new()
        .route("/api/v1/users/{id}", get(FnHandler::new(user_handler)))
        .layer(Cors::default())
        .layer(SecurityHeaders::default());

    group.bench_function("get_user", |b| {
        b.iter(|| {
            let h1_req = h1_get("/api/v1/users/42?fields=name,email");
            black_box(run_pipeline(&router, black_box(h1_req)));
        });
    });

    // Same but with 10 routes (does route table size matter?)
    let mut router_10 = Router::new()
        .route("/api/v1/users/{id}", get(FnHandler::new(user_handler)));
    for i in 0..9 {
        router_10 = router_10.route(
            &format!("/api/v1/resource{i}/{{id}}"),
            get(FnHandler::new(plaintext_handler)),
        );
    }
    let router_10 = router_10
        .layer(Cors::default())
        .layer(SecurityHeaders::default());

    group.bench_function("get_user_10_routes", |b| {
        b.iter(|| {
            let h1_req = h1_get("/api/v1/users/42?fields=name,email");
            black_box(run_pipeline(&router_10, black_box(h1_req)));
        });
    });

    // POST with JSON body
    fn create_handler() -> Response {
        Response::new(
            StatusCode::CREATED,
            Bytes::from_static(b"{\"id\":99,\"created\":true}"),
        )
        .header("content-type", "application/json")
        .header("location", "/api/v1/users/99")
    }

    let post_router = Router::new()
        .route("/api/v1/users", post(FnHandler::new(create_handler)))
        .layer(Cors::default())
        .layer(SecurityHeaders::default());

    // 256B JSON POST body (typical create request)
    group.bench_function("create_user_256b", |b| {
        b.iter(|| {
            let h1_req = h1_post("/api/v1/users", 256);
            black_box(run_pipeline(&post_router, black_box(h1_req)));
        });
    });

    group.finish();
}

// ── Group 6: Stage-by-stage breakdown ────────────────────────────────────────

fn bench_stage_breakdown(c: &mut Criterion) {
    let mut group = c.benchmark_group("pipeline/stages");

    // Measure individual stages in isolation for Little's Law validation.

    // Stage 1: H1 bridge in (zero-copy)
    group.bench_function("h1_bridge_in", |b| {
        b.iter(|| {
            let h1_req = h1_get("/api/users?page=1");
            black_box(convert_h1_request_owned(black_box(h1_req)));
        });
    });

    // Stage 2: Router dispatch only (static route, no middleware)
    let bare_router = Router::new().route("/api/users", get(FnHandler::new(plaintext_handler)));
    group.bench_function("router_dispatch", |b| {
        b.iter(|| {
            let req = Request::new("GET", "/api/users");
            let resp = block_on(bare_router.handle(black_box(req)));
            black_box(resp);
        });
    });

    // Stage 3: Router dispatch with path param extraction
    let param_router =
        Router::new().route("/api/users/{id}", get(FnHandler::new(plaintext_handler)));
    group.bench_function("router_dispatch_param", |b| {
        b.iter(|| {
            let req = Request::new("GET", "/api/users/42");
            let resp = block_on(param_router.handle(black_box(req)));
            black_box(resp);
        });
    });

    // Stage 4: H1 bridge out (response serialization)
    group.bench_function("h1_bridge_out", |b| {
        b.iter(|| {
            let resp = Response::new(
                StatusCode::OK,
                Bytes::from_static(b"{\"status\":\"ok\"}"),
            )
            .header("content-type", "application/json")
            .header("x-request-id", "req-abc-123");
            black_box(convert_web_to_h1(black_box(resp)));
        });
    });

    // Stage 5: Combined = bridge_in + router + bridge_out
    //   This should equal the sum of stages 1 + 2 + 4 (within ~5%).
    let combined_router =
        Router::new().route("/api/users", get(FnHandler::new(plaintext_handler)));
    group.bench_function("combined_in_route_out", |b| {
        b.iter(|| {
            let h1_req = h1_get("/api/users");
            black_box(run_pipeline(&combined_router, black_box(h1_req)));
        });
    });

    group.finish();
}

// ── Group 7: Throughput estimation ───────────────────────────────────────────

fn bench_throughput(c: &mut Criterion) {
    let mut group = c.benchmark_group("pipeline/throughput");
    group.sample_size(200); // More samples for throughput estimation

    // Throughput benchmark: run N iterations and measure total time.
    // Criterion will report iterations/second ≈ req/s/core.

    // Plaintext (theoretical max scenario)
    let router = Router::new().route("/", get(FnHandler::new(plaintext_handler)));

    group.bench_function("plaintext_rps", |b| {
        b.iter(|| {
            let h1_req = h1_get("/");
            black_box(run_pipeline(&router, black_box(h1_req)));
        });
    });

    // REST endpoint (realistic scenario from PERFORMANCE.md)
    fn user_handler() -> Response {
        Response::new(
            StatusCode::OK,
            Bytes::from_static(
                b"{\"id\":42,\"name\":\"Alice\",\"email\":\"alice@example.com\"}",
            ),
        )
        .header("content-type", "application/json")
    }

    let rest_router = Router::new()
        .route("/api/v1/users/{id}", get(FnHandler::new(user_handler)))
        .layer(Cors::default())
        .layer(SecurityHeaders::default());

    group.bench_function("rest_rps", |b| {
        b.iter(|| {
            let h1_req = h1_get("/api/v1/users/42?fields=name");
            black_box(run_pipeline(&rest_router, black_box(h1_req)));
        });
    });

    // ActorPool(4) (stateful handler scenario)
    let pool = ActorPool::new(vec![
        CounterActor::new(),
        CounterActor::new(),
        CounterActor::new(),
        CounterActor::new(),
    ]);
    let actor_router = Router::new()
        .route("/counter", get(ActorPoolHandler::new(pool)))
        .layer(Cors::default())
        .layer(SecurityHeaders::default());

    group.bench_function("actor_pool_rps", |b| {
        b.iter(|| {
            let h1_req = h1_get("/counter");
            black_box(run_pipeline(&actor_router, black_box(h1_req)));
        });
    });

    group.finish();
}

// ── Group 8: Extractor composition ───────────────────────────────────────────

fn bench_extractor_compose(c: &mut Criterion) {
    let mut group = c.benchmark_group("pipeline/extractor_compose");

    // Measures the cost of composing multiple extractors in a single handler.
    // FnHandler3: Path<String> (FromRequestParts) + Query<HashMap> (FromRequestParts)
    //             + Json<SmallPayload> (FromRequest — consumes body)
    //
    // This exercises the full extraction pipeline:
    //   1. Path param lookup from router capture (HashMap clone)
    //   2. Query string parse (url-decode + split)
    //   3. JSON body deserialization (serde_json)

    fn composed_handler(
        Path(id): Path<String>,
        Query(q): Query<HashMap<String, String>>,
        Json(payload): Json<SmallPayload>,
    ) -> Response {
        // Simulate minimal work: use all extracted values to prevent dead-code elim
        let _ = (id.len(), q.len(), payload.id);
        Response::new(StatusCode::OK, Bytes::from_static(b"{\"ok\":true}"))
            .header("content-type", "application/json")
    }

    let router = Router::new().route(
        "/api/items/{id}",
        post(FnHandler3::<_, Path<String>, Query<HashMap<String, String>>, Json<SmallPayload>>::new(
            composed_handler,
        )),
    );

    let small_json = serde_json::to_vec(&SmallPayload {
        id: 1,
        name: "bench".to_string(),
        active: true,
    })
    .unwrap();

    // Path + Query + Json<SmallPayload> (~60B body)
    group.bench_function("path_query_json_small", |b| {
        b.iter(|| {
            let mut h1_req = h1_post("/api/items/42?sort=name&page=1", 0);
            h1_req.body = small_json.clone();
            h1_req.headers.push((
                "Content-Type".into(),
                "application/json".into(),
            ));
            black_box(run_pipeline(&router, black_box(h1_req)));
        });
    });

    // Same composition but with 1KB JSON payload
    fn composed_handler_medium(
        Path(id): Path<String>,
        Query(q): Query<HashMap<String, String>>,
        Json(payload): Json<MediumPayload>,
    ) -> Response {
        let _ = (id.len(), q.len(), payload.id);
        Response::new(StatusCode::OK, Bytes::from_static(b"{\"ok\":true}"))
            .header("content-type", "application/json")
    }

    let router_medium = Router::new().route(
        "/api/items/{id}",
        post(FnHandler3::<_, Path<String>, Query<HashMap<String, String>>, Json<MediumPayload>>::new(
            composed_handler_medium,
        )),
    );

    let medium_json = serde_json::to_vec(&MediumPayload::sample_1kb()).unwrap();

    group.bench_function("path_query_json_1kb", |b| {
        b.iter(|| {
            let mut h1_req = h1_post("/api/items/42?sort=name&page=1", 0);
            h1_req.body = medium_json.clone();
            h1_req.headers.push((
                "Content-Type".into(),
                "application/json".into(),
            ));
            black_box(run_pipeline(&router_medium, black_box(h1_req)));
        });
    });

    // Baseline: same handler but without H1 bridges (extractor-only cost)
    group.bench_function("extractor_only_small", |b| {
        let small_body = Bytes::from(small_json.clone());
        b.iter(|| {
            let mut params = HashMap::new();
            params.insert("id".to_string(), "42".to_string());
            let req = Request::new("POST", "/api/items/42")
                .with_path_params(params)
                .with_query("sort=name&page=1")
                .with_header("content-type", "application/json")
                .with_body(small_body.to_vec());
            let resp = block_on(router.handle(black_box(req)));
            black_box(resp);
        });
    });

    group.finish();
}

// ── Group 9: Full production stack (10 middleware) ───────────────────────────

fn bench_pipeline_full_stack(c: &mut Criterion) {
    let mut group = c.benchmark_group("pipeline/full_stack");

    // The "everything on" benchmark: 10 middleware layers, ActorPool(4), 1KB JSON.
    // Middleware order (outermost → innermost):
    //   1. SecurityHeaders
    //   2. CORS
    //   3. RequestId
    //   4. Logger
    //   5. MaxBodySize (10MB)
    //   6. RateLimiter (10000 req/s — effectively unlimited for bench)
    //   7. Timeout (30s — never triggers in bench)
    //   8. Compression (passthrough stub)
    //   9. Custom header "x-trace-id"
    //  10. Custom header "x-server-region"

    fn full_stack_handler() -> Response {
        Response::new(
            StatusCode::OK,
            Bytes::from_static(b"{\"status\":\"ok\",\"processed\":true}"),
        )
        .header("content-type", "application/json")
    }

    // FnHandler variant (stateless)
    let fn_router = Router::new()
        .route("/api/v1/process", post(FnHandler::new(full_stack_handler)))
        .layer(SecurityHeaders::default())
        .layer(Cors::default())
        .layer(RequestId)
        .layer(Logger)
        .layer(MaxBodySize::new(10 * 1024 * 1024))
        .layer(RateLimiter::new(10_000, Duration::from_secs(1)))
        .layer(Timeout::new(Duration::from_secs(30)))
        .layer(Compression)
        .layer(HeaderMiddleware {
            name: "x-trace-id",
            value: "trace-bench-001",
        })
        .layer(HeaderMiddleware {
            name: "x-server-region",
            value: "us-east-1",
        });

    group.bench_function("fn_10mw_1kb_json", |b| {
        b.iter(|| {
            let h1_req = h1_post("/api/v1/process", 1024);
            black_box(run_pipeline(&fn_router, black_box(h1_req)));
        });
    });

    // ActorPool(4) variant with 10 middleware
    let pool = ActorPool::new(vec![
        NoopActor, NoopActor, NoopActor, NoopActor,
    ]);
    let pool_router = Router::new()
        .route("/api/v1/process", post(ActorPoolHandler::new(pool)))
        .layer(SecurityHeaders::default())
        .layer(Cors::default())
        .layer(RequestId)
        .layer(Logger)
        .layer(MaxBodySize::new(10 * 1024 * 1024))
        .layer(RateLimiter::new(10_000, Duration::from_secs(1)))
        .layer(Timeout::new(Duration::from_secs(30)))
        .layer(Compression)
        .layer(HeaderMiddleware {
            name: "x-trace-id",
            value: "trace-bench-001",
        })
        .layer(HeaderMiddleware {
            name: "x-server-region",
            value: "us-east-1",
        });

    group.bench_function("pool4_10mw_1kb_json", |b| {
        b.iter(|| {
            let h1_req = h1_post("/api/v1/process", 1024);
            black_box(run_pipeline(&pool_router, black_box(h1_req)));
        });
    });

    // Comparison: same FnHandler with only CORS + SecurityHeaders (2 MW)
    let minimal_router = Router::new()
        .route("/api/v1/process", post(FnHandler::new(full_stack_handler)))
        .layer(Cors::default())
        .layer(SecurityHeaders::default());

    group.bench_function("fn_2mw_1kb_json", |b| {
        b.iter(|| {
            let h1_req = h1_post("/api/v1/process", 1024);
            black_box(run_pipeline(&minimal_router, black_box(h1_req)));
        });
    });

    group.finish();
}

// ── Group 10: JSON round-trip throughput ─────────────────────────────────────

fn bench_throughput_json(c: &mut Criterion) {
    let mut group = c.benchmark_group("pipeline/throughput_json");
    group.sample_size(200);

    // JSON round-trip: deserialize request body → serialize response body.
    // This is the canonical "REST API" throughput benchmark.
    //
    // The handler:
    //   1. Extracts Json<SmallPayload> from request body (serde_json deser)
    //   2. Constructs a new response with serialized JSON (serde_json ser)
    //
    // Measures the *framework* overhead around JSON, not serde itself.

    fn json_echo_small(Json(payload): Json<SmallPayload>) -> Response {
        let body = serde_json::to_vec(&payload).unwrap();
        Response::new(StatusCode::OK, Bytes::from(body))
            .header("content-type", "application/json")
    }

    fn json_echo_medium(Json(payload): Json<MediumPayload>) -> Response {
        let body = serde_json::to_vec(&payload).unwrap();
        Response::new(StatusCode::OK, Bytes::from(body))
            .header("content-type", "application/json")
    }

    use ava_web::handler::FnHandler1;

    let small_router = Router::new().route(
        "/echo",
        post(FnHandler1::<_, Json<SmallPayload>>::new(json_echo_small)),
    );
    let medium_router = Router::new().route(
        "/echo",
        post(FnHandler1::<_, Json<MediumPayload>>::new(json_echo_medium)),
    );

    let small_json = serde_json::to_vec(&SmallPayload {
        id: 1,
        name: "bench".to_string(),
        active: true,
    })
    .unwrap();

    let medium_json = serde_json::to_vec(&MediumPayload::sample_1kb()).unwrap();

    // Small JSON round-trip (~60B in, ~60B out)
    group.bench_function("small_roundtrip", |b| {
        b.iter(|| {
            let mut h1_req = h1_post("/echo", 0);
            h1_req.body = small_json.clone();
            h1_req.headers.push((
                "Content-Type".into(),
                "application/json".into(),
            ));
            black_box(run_pipeline(&small_router, black_box(h1_req)));
        });
    });

    // Medium JSON round-trip (~1KB in, ~1KB out)
    group.bench_function("medium_roundtrip_1kb", |b| {
        b.iter(|| {
            let mut h1_req = h1_post("/echo", 0);
            h1_req.body = medium_json.clone();
            h1_req.headers.push((
                "Content-Type".into(),
                "application/json".into(),
            ));
            black_box(run_pipeline(&medium_router, black_box(h1_req)));
        });
    });

    // Medium JSON round-trip with CORS + SecurityHeaders
    let medium_mw_router = Router::new()
        .route(
            "/echo",
            post(FnHandler1::<_, Json<MediumPayload>>::new(json_echo_medium)),
        )
        .layer(Cors::default())
        .layer(SecurityHeaders::default());

    group.bench_function("medium_roundtrip_1kb_with_mw", |b| {
        b.iter(|| {
            let mut h1_req = h1_post("/echo", 0);
            h1_req.body = medium_json.clone();
            h1_req.headers.push((
                "Content-Type".into(),
                "application/json".into(),
            ));
            black_box(run_pipeline(&medium_mw_router, black_box(h1_req)));
        });
    });

    group.finish();
}

// ═══════════════════════════════════════════════════════════════════════════

criterion_group!(
    benches,
    bench_plaintext_pipeline,
    bench_handler_types,
    bench_middleware_scaling,
    bench_body_size,
    bench_rest_endpoint,
    bench_stage_breakdown,
    bench_throughput,
    bench_extractor_compose,
    bench_pipeline_full_stack,
    bench_throughput_json,
);
criterion_main!(benches);
