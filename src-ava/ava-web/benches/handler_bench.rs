//! Handler + extractor + actor dispatch benchmarks.
//!
//! Measures overhead of the extraction pipeline — how much does our
//! typed extractor system cost vs raw function dispatch?
//!
//! # Actor Dispatch Optimization
//!
//! The `actor/dispatch` group measures the optimized `ActorPoolHandler::call`
//! which eliminates per-request overhead:
//!
//! - **No Arc::clone**: Borrows the actor via `Deref` through the pool's
//!   `Vec<Arc<A>>`, avoiding an atomic refcount increment per request.
//!
//! - **No double Box::pin**: Forwards `handle_request`'s `Pin<Box<...>>`
//!   directly instead of wrapping in another `Box::pin(async move { ... })`.
//!
//! - **Relaxed ordering**: The round-robin counter uses `Ordering::Relaxed`
//!   — only atomicity needed, not cross-thread ordering guarantees.
//!
//! Theoretical minimum per-request overhead: one `fetch_add(Relaxed)` (~1-3ns)
//! + one modulo + one array index + the inner `handle_request` cost.

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::atomic::{AtomicU32, Ordering};

use bytes::Bytes;

use ava_web::extractor::{
    Extensions, FromRequest, FromRequestParts, Json, Path, Query, Request, State,
};
use ava_web::handler::{FnHandler, FnHandler1, FnHandler2, Handler};
use ava_web::response::{IntoResponse, Response, StatusCode};
use ava_web::state::{ActorHandler, ActorHandlerWrapper, ActorPool, ActorPoolHandler};

// ── Extraction benchmarks ──────────────────────────────────────────────────

fn bench_path_extraction(c: &mut Criterion) {
    let mut group = c.benchmark_group("extractor/path");

    group.bench_function("string", |b| {
        let mut params = HashMap::new();
        params.insert("id".to_string(), "user-42".to_string());

        b.iter(|| {
            let req = Request::new("GET", "/users/user-42").with_path_params(params.clone());
            let _ = black_box(Path::<String>::from_request_parts(&req));
        });
    });

    group.bench_function("u64", |b| {
        let mut params = HashMap::new();
        params.insert("id".to_string(), "12345".to_string());

        b.iter(|| {
            let req = Request::new("GET", "/users/12345").with_path_params(params.clone());
            let _ = black_box(Path::<u64>::from_request_parts(&req));
        });
    });

    group.bench_function("hashmap", |b| {
        let mut params = HashMap::new();
        params.insert("org".to_string(), "acme".to_string());
        params.insert("repo".to_string(), "widgets".to_string());
        params.insert("id".to_string(), "42".to_string());

        b.iter(|| {
            let req = Request::new("GET", "/org/acme/repo/widgets/42")
                .with_path_params(params.clone());
            let _ = black_box(Path::<HashMap<String, String>>::from_request_parts(&req));
        });
    });

    group.finish();
}

fn bench_query_extraction(c: &mut Criterion) {
    c.bench_function("extractor/query/parse", |b| {
        b.iter(|| {
            let req = Request::new("GET", "/search")
                .with_query("q=rust+http&page=3&limit=20&sort=stars&order=desc");
            let _ = black_box(Query::<HashMap<String, String>>::from_request_parts(&req));
        });
    });
}

fn bench_json_extraction(c: &mut Criterion) {
    let mut group = c.benchmark_group("extractor/json");

    // Small JSON
    group.bench_function("small", |b| {
        let body = br#"{"name":"alice","age":30}"#;
        b.iter(|| {
            let req = Request::new("POST", "/users")
                .with_header("content-type", "application/json")
                .with_body(Bytes::from_static(body));
            let _ = black_box(Json::<serde_json::Value>::from_request(req));
        });
    });

    // Medium JSON (~1KB)
    group.bench_function("medium_1kb", |b| {
        let obj: serde_json::Value = serde_json::json!({
            "users": (0..20).map(|i| serde_json::json!({
                "id": i,
                "name": format!("user_{i}"),
                "email": format!("user{i}@example.com"),
                "active": i % 2 == 0
            })).collect::<Vec<_>>()
        });
        let body = serde_json::to_vec(&obj).unwrap();

        b.iter(|| {
            let req = Request::new("POST", "/users")
                .with_header("content-type", "application/json")
                .with_body(Bytes::from(body.clone()));
            let _ = black_box(Json::<serde_json::Value>::from_request(req));
        });
    });

    // Large JSON (~100KB)
    group.bench_function("large_100kb", |b| {
        let obj: serde_json::Value = serde_json::json!({
            "records": (0..1000).map(|i| serde_json::json!({
                "id": i,
                "name": format!("record_{i}"),
                "description": "x".repeat(80),
                "tags": ["alpha", "beta", "gamma"]
            })).collect::<Vec<_>>()
        });
        let body = serde_json::to_vec(&obj).unwrap();

        b.iter(|| {
            let req = Request::new("POST", "/records")
                .with_header("content-type", "application/json")
                .with_body(Bytes::from(body.clone()));
            let _ = black_box(Json::<serde_json::Value>::from_request(req));
        });
    });

    group.finish();
}

fn bench_state_extraction(c: &mut Criterion) {
    #[derive(Debug, Clone)]
    struct AppConfig {
        db_url: String,
        _max_connections: u32,
    }

    c.bench_function("extractor/state/typeid_lookup", |b| {
        let config = AppConfig {
            db_url: "postgres://localhost/db".into(),
            _max_connections: 100,
        };

        b.iter(|| {
            let mut req = Request::new("GET", "/");
            req.extensions.insert(config.clone());
            let _ = black_box(State::<AppConfig>::from_request_parts(&req));
        });
    });
}

fn bench_extensions(c: &mut Criterion) {
    let mut group = c.benchmark_group("extensions");

    group.bench_function("insert_get_1_type", |b| {
        b.iter(|| {
            let mut ext = Extensions::new();
            ext.insert(42u32);
            let _ = black_box(ext.get::<u32>());
        });
    });

    group.bench_function("insert_get_5_types", |b| {
        b.iter(|| {
            let mut ext = Extensions::new();
            ext.insert(42u32);
            ext.insert("hello".to_string());
            ext.insert(3.14f64);
            ext.insert(true);
            ext.insert(vec![1u8, 2, 3]);
            let _ = black_box(ext.get::<f64>());
        });
    });

    group.bench_function("insert_get_10_types", |b| {
        b.iter(|| {
            let mut ext = Extensions::new();
            ext.insert(1u8);
            ext.insert(2u16);
            ext.insert(3u32);
            ext.insert(4u64);
            ext.insert(5i8);
            ext.insert(6i16);
            ext.insert(7i32);
            ext.insert(8i64);
            ext.insert(9.0f32);
            ext.insert(10.0f64);
            let _ = black_box(ext.get::<i32>());
        });
    });

    group.finish();
}

// ── Handler dispatch benchmarks ────────────────────────────────────────────

fn bench_handler_dispatch(c: &mut Criterion) {
    let mut group = c.benchmark_group("handler/dispatch");

    // Zero-extractor sync handler
    group.bench_function("sync_0_extractors", |b| {
        fn index() -> &'static str {
            "hello"
        }
        let handler = FnHandler::new(index);

        b.iter(|| {
            let req = Request::new("GET", "/");
            let _ = black_box(handler.call(req));
        });
    });

    // One-extractor sync handler
    group.bench_function("sync_1_extractor_path", |b| {
        fn get_user(Path(id): Path<String>) -> String {
            format!("user:{id}")
        }
        let handler = FnHandler1::<_, Path<String>>::new(get_user);

        b.iter(|| {
            let mut params = HashMap::new();
            params.insert("id".to_string(), "42".to_string());
            let req = Request::new("GET", "/users/42").with_path_params(params);
            let _ = black_box(handler.call(req));
        });
    });

    // Two-extractor sync handler
    group.bench_function("sync_2_extractors", |b| {
        fn search(Path(id): Path<String>, Query(q): Query<HashMap<String, String>>) -> String {
            format!("search:{id}:{}", q.len())
        }
        let handler = FnHandler2::<_, Path<String>, Query<HashMap<String, String>>>::new(search);

        b.iter(|| {
            let mut params = HashMap::new();
            params.insert("id".to_string(), "42".to_string());
            let req = Request::new("GET", "/users/42")
                .with_path_params(params)
                .with_query("page=1&limit=20");
            let _ = black_box(handler.call(req));
        });
    });

    group.finish();
}

// ── Response serialization benchmarks ──────────────────────────────────────

fn bench_response_serialization(c: &mut Criterion) {
    let mut group = c.benchmark_group("response/serialize");

    group.bench_function("plaintext", |b| {
        b.iter(|| {
            let _ = black_box("Hello, World!".into_response());
        });
    });

    group.bench_function("json_small", |b| {
        b.iter(|| {
            let _ = black_box(
                ava_web::response::Json(serde_json::json!({"message": "Hello, World!"}))
                    .into_response(),
            );
        });
    });

    group.bench_function("json_medium", |b| {
        let data: Vec<serde_json::Value> = (0..50)
            .map(|i| {
                serde_json::json!({
                    "id": i,
                    "name": format!("item_{i}"),
                    "value": i * 100
                })
            })
            .collect();

        b.iter(|| {
            let _ = black_box(ava_web::response::Json(data.clone()).into_response());
        });
    });

    group.bench_function("status_code_only", |b| {
        b.iter(|| {
            let _ = black_box(ava_web::response::StatusCode::NO_CONTENT.into_response());
        });
    });

    group.bench_function("html", |b| {
        let html = "<html><body><h1>Hello</h1><p>World</p></body></html>";
        b.iter(|| {
            let _ = black_box(ava_web::response::Html(html).into_response());
        });
    });

    group.finish();
}

// ── Actor dispatch benchmarks ──────────────────────────────────────────────
//
// Measures the per-request overhead of actor-based handlers compared to
// plain function handlers. The key metric is dispatch overhead — the cost
// of selecting an actor from the pool and forwarding the request.

/// Test actor: increments a counter per request. Minimal work to isolate
/// dispatch overhead from actual handler logic.
struct BenchActor {
    count: AtomicU32,
    id: u32,
}

impl BenchActor {
    fn new(id: u32) -> Self {
        Self {
            count: AtomicU32::new(0),
            id,
        }
    }
}

impl ActorHandler for BenchActor {
    fn handle_request(&self, _req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        let n = self.count.fetch_add(1, Ordering::Relaxed);
        let body = format!("{}:{n}", self.id);
        let resp = body.into_response();
        Box::pin(async move { resp })
    }
}

fn bench_actor_dispatch(c: &mut Criterion) {
    let mut group = c.benchmark_group("actor/dispatch");

    // Baseline: plain FnHandler (no actor, no pool)
    group.bench_function("fn_handler_baseline", |b| {
        fn index() -> &'static str { "hello" }
        let handler = FnHandler::new(index);
        b.iter(|| {
            let req = Request::new("GET", "/");
            let _ = black_box(handler.call(req));
        });
    });

    // Single actor via ActorHandlerWrapper (no pool, no round-robin)
    group.bench_function("single_actor", |b| {
        let actor = BenchActor::new(0);
        let wrapper = ActorHandlerWrapper::new(actor);
        b.iter(|| {
            let req = Request::new("GET", "/");
            let _ = black_box(wrapper.call(req));
        });
    });

    // Pool of 1 actor (round-robin counter + array index, but no contention)
    group.bench_function("pool_1_actor", |b| {
        let pool = ActorPool::new(vec![BenchActor::new(0)]);
        let handler = ActorPoolHandler::new(pool);
        b.iter(|| {
            let req = Request::new("GET", "/");
            let _ = black_box(handler.call(req));
        });
    });

    // Pool of 4 actors (typical multi-core pool size)
    group.bench_function("pool_4_actors", |b| {
        let pool = ActorPool::new(
            (0..4).map(BenchActor::new).collect()
        );
        let handler = ActorPoolHandler::new(pool);
        b.iter(|| {
            let req = Request::new("GET", "/");
            let _ = black_box(handler.call(req));
        });
    });

    // Pool of 16 actors (large pool — tests modulo cost with non-power-of-2)
    group.bench_function("pool_16_actors", |b| {
        let pool = ActorPool::new(
            (0..16).map(BenchActor::new).collect()
        );
        let handler = ActorPoolHandler::new(pool);
        b.iter(|| {
            let req = Request::new("GET", "/");
            let _ = black_box(handler.call(req));
        });
    });

    // Pool of 17 actors (prime — worst case for modulo, no power-of-2 optimization)
    group.bench_function("pool_17_actors", |b| {
        let pool = ActorPool::new(
            (0..17).map(BenchActor::new).collect()
        );
        let handler = ActorPoolHandler::new(pool);
        b.iter(|| {
            let req = Request::new("GET", "/");
            let _ = black_box(handler.call(req));
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_path_extraction,
    bench_query_extraction,
    bench_json_extraction,
    bench_state_extraction,
    bench_extensions,
    bench_handler_dispatch,
    bench_actor_dispatch,
    bench_response_serialization,
);
criterion_main!(benches);
