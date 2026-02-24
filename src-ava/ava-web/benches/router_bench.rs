//! Router dispatch benchmarks.
//!
//! Measures path matching performance at varying route table sizes.
//! Compares matchit radix-tree (O(log n)) vs baseline.

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};

use ava_web::handler::FnHandler;
use ava_web::router::{get, Router};
use ava_web::extractor::Request;

// ── Helpers ────────────────────────────────────────────────────────────────

fn ok_handler() -> &'static str {
    "ok"
}

/// Build a router with N routes: /r0, /r1, ..., /r{n-1}
fn build_flat_router(n: usize) -> Router {
    let mut router = Router::new();
    for i in 0..n {
        router = router.route(&format!("/r{i}"), get(FnHandler::new(ok_handler)));
    }
    router
}

/// Build a router with N parameterized routes: /a/{id}, /b/{id}, ...
fn build_param_router(n: usize) -> Router {
    let mut router = Router::new();
    let prefixes: Vec<String> = (0..n).map(|i| format!("/prefix{i}/{{id}}")).collect();
    for prefix in &prefixes {
        router = router.route(prefix, get(FnHandler::new(ok_handler)));
    }
    router
}

/// Build a deeply nested router: /a/b/c/d/e/.../{id}
fn build_deep_router(depth: usize) -> Router {
    let mut router = Router::new();
    let mut path = String::new();
    for i in 0..depth {
        path.push_str(&format!("/seg{i}"));
    }
    path.push_str("/{id}");
    router = router.route(&path, get(FnHandler::new(ok_handler)));
    router
}

// ── Benchmarks ─────────────────────────────────────────────────────────────

fn bench_flat_route_match(c: &mut Criterion) {
    let mut group = c.benchmark_group("router/flat_match");

    for route_count in [10, 50, 100, 500, 1000] {
        let router = build_flat_router(route_count);
        // Match the last route (worst case for linear scan)
        let target = format!("/r{}", route_count - 1);

        group.bench_with_input(
            BenchmarkId::new("routes", route_count),
            &route_count,
            |b, _| {
                b.iter(|| {
                    let req = Request::new("GET", black_box(&target));
                    let _ = black_box(router.handle(req));
                });
            },
        );
    }

    group.finish();
}

fn bench_param_route_match(c: &mut Criterion) {
    let mut group = c.benchmark_group("router/param_match");

    for route_count in [10, 50, 100, 500] {
        let router = build_param_router(route_count);
        // Match a middle route with a parameter
        let target = format!("/prefix{}/42", route_count / 2);

        group.bench_with_input(
            BenchmarkId::new("routes", route_count),
            &route_count,
            |b, _| {
                b.iter(|| {
                    let req = Request::new("GET", black_box(&target));
                    let _ = black_box(router.handle(req));
                });
            },
        );
    }

    group.finish();
}

fn bench_deep_path_match(c: &mut Criterion) {
    let mut group = c.benchmark_group("router/deep_path");

    for depth in [2, 5, 10, 20] {
        let router = build_deep_router(depth);
        let mut path = String::new();
        for i in 0..depth {
            path.push_str(&format!("/seg{i}"));
        }
        path.push_str("/42");

        group.bench_with_input(
            BenchmarkId::new("depth", depth),
            &depth,
            |b, _| {
                b.iter(|| {
                    let req = Request::new("GET", black_box(&path));
                    let _ = black_box(router.handle(req));
                });
            },
        );
    }

    group.finish();
}

fn bench_route_miss(c: &mut Criterion) {
    let mut group = c.benchmark_group("router/miss");

    for route_count in [10, 100, 1000] {
        let router = build_flat_router(route_count);

        group.bench_with_input(
            BenchmarkId::new("routes", route_count),
            &route_count,
            |b, _| {
                b.iter(|| {
                    let req = Request::new("GET", black_box("/nonexistent"));
                    let _ = black_box(router.handle(req));
                });
            },
        );
    }

    group.finish();
}

fn bench_method_dispatch(c: &mut Criterion) {
    let router = Router::new()
        .route("/api/users", get(FnHandler::new(ok_handler)).post(FnHandler::new(ok_handler)));

    c.bench_function("router/method_dispatch_get", |b| {
        b.iter(|| {
            let req = Request::new("GET", black_box("/api/users"));
            let _ = black_box(router.handle(req));
        });
    });

    c.bench_function("router/method_dispatch_post", |b| {
        b.iter(|| {
            let req = Request::new("POST", black_box("/api/users"));
            let _ = black_box(router.handle(req));
        });
    });

    // Method not allowed (405)
    c.bench_function("router/method_not_allowed", |b| {
        b.iter(|| {
            let req = Request::new("DELETE", black_box("/api/users"));
            let _ = black_box(router.handle(req));
        });
    });
}

fn bench_nested_router(c: &mut Criterion) {
    let api_v1 = Router::new()
        .route("/users", get(FnHandler::new(ok_handler)))
        .route("/users/{id}", get(FnHandler::new(ok_handler)))
        .route("/posts", get(FnHandler::new(ok_handler)))
        .route("/posts/{id}", get(FnHandler::new(ok_handler)));

    let api_v2 = Router::new()
        .route("/users", get(FnHandler::new(ok_handler)))
        .route("/users/{id}", get(FnHandler::new(ok_handler)));

    let router = Router::new()
        .nest("/api/v1", api_v1)
        .nest("/api/v2", api_v2);

    c.bench_function("router/nested_v1_users", |b| {
        b.iter(|| {
            let req = Request::new("GET", black_box("/api/v1/users"));
            let _ = black_box(router.handle(req));
        });
    });

    c.bench_function("router/nested_v2_users_id", |b| {
        b.iter(|| {
            let req = Request::new("GET", black_box("/api/v2/users/42"));
            let _ = black_box(router.handle(req));
        });
    });
}

criterion_group!(
    benches,
    bench_flat_route_match,
    bench_param_route_match,
    bench_deep_path_match,
    bench_route_miss,
    bench_method_dispatch,
    bench_nested_router,
);
criterion_main!(benches);
