//! Middleware pipeline benchmarks.
//!
//! Measures overhead per middleware layer and common middleware costs.
//! Key question: what's the per-layer cost of our middleware chain?

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use std::future::Future;
use std::pin::Pin;
use std::time::Duration;

use ava_web::extractor::Request;
use ava_web::middleware::{Cors, Logger, Middleware, Next, RequestId, Timeout};
use ava_web::response::{IntoResponse, Response};

// ── Passthrough middleware for measuring pure overhead ──────────────────────

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

/// A middleware that reads and writes a header (simulates real work).
struct HeaderMiddleware {
    name: String,
    value: String,
}

impl HeaderMiddleware {
    fn new(name: &str, value: &str) -> Self {
        Self {
            name: name.to_string(),
            value: value.to_string(),
        }
    }
}

impl Middleware for HeaderMiddleware {
    fn handle<'a>(
        &'a self,
        req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        Box::pin(async move {
            let mut resp = next.run(req).await;
            resp.headers
                .insert(self.name.clone(), self.value.clone());
            resp
        })
    }
}

// ── Helper: Build a middleware chain ────────────────────────────────────────

fn terminal_handler(_req: Request) -> Pin<Box<dyn Future<Output = Response> + Send>> {
    Box::pin(async move { "ok".into_response() })
}

/// Chain N middlewares around a terminal handler and execute once.
fn run_middleware_chain(middlewares: &[Box<dyn Middleware>], req: Request) -> Response {
    // Build chain from inside out
    // The terminal handler is the innermost
    fn build_chain<'a>(
        middlewares: &'a [Box<dyn Middleware>],
        idx: usize,
        req: Request,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        if idx >= middlewares.len() {
            return terminal_handler(req);
        }

        let next = Next::new(move |r| build_chain(middlewares, idx + 1, r));
        middlewares[idx].handle(req, next)
    }

    // We need a runtime to poll futures. Use a minimal executor.
    // Since these are all sync-under-the-hood (no real I/O), we can
    // use a simple block_on.
    futures_block_on(build_chain(middlewares, 0, req))
}

/// Minimal block_on implementation for benchmarks (no async runtime needed).
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
            Poll::Pending => {
                // Our middleware futures should resolve immediately
                // (no real I/O), so Pending = infinite loop = bug
                panic!("middleware future returned Pending in benchmark");
            }
        }
    }
}

// ── Benchmarks ─────────────────────────────────────────────────────────────

fn bench_passthrough_chain(c: &mut Criterion) {
    let mut group = c.benchmark_group("middleware/passthrough_chain");

    for count in [0, 1, 2, 5, 10, 20] {
        let middlewares: Vec<Box<dyn Middleware>> =
            (0..count).map(|_| Box::new(Passthrough) as _).collect();

        group.bench_with_input(
            BenchmarkId::new("layers", count),
            &count,
            |b, _| {
                b.iter(|| {
                    let req = Request::new("GET", "/");
                    let _ = black_box(run_middleware_chain(&middlewares, req));
                });
            },
        );
    }

    group.finish();
}

fn bench_header_chain(c: &mut Criterion) {
    let mut group = c.benchmark_group("middleware/header_chain");

    for count in [1, 5, 10] {
        let middlewares: Vec<Box<dyn Middleware>> = (0..count)
            .map(|i| Box::new(HeaderMiddleware::new(&format!("x-custom-{i}"), "value")) as _)
            .collect();

        group.bench_with_input(
            BenchmarkId::new("layers", count),
            &count,
            |b, _| {
                b.iter(|| {
                    let req = Request::new("GET", "/");
                    let _ = black_box(run_middleware_chain(&middlewares, req));
                });
            },
        );
    }

    group.finish();
}

fn bench_builtin_middleware(c: &mut Criterion) {
    let mut group = c.benchmark_group("middleware/builtin");

    // RequestId only
    group.bench_function("request_id", |b| {
        let middlewares: Vec<Box<dyn Middleware>> = vec![Box::new(RequestId)];
        b.iter(|| {
            let req = Request::new("GET", "/");
            let _ = black_box(run_middleware_chain(&middlewares, req));
        });
    });

    // CORS only
    group.bench_function("cors", |b| {
        let middlewares: Vec<Box<dyn Middleware>> = vec![Box::new(Cors::default())];
        b.iter(|| {
            let req = Request::new("GET", "/api/data");
            let _ = black_box(run_middleware_chain(&middlewares, req));
        });
    });

    // CORS preflight
    group.bench_function("cors_preflight", |b| {
        let middlewares: Vec<Box<dyn Middleware>> = vec![Box::new(Cors::default())];
        b.iter(|| {
            let req = Request::new("OPTIONS", "/api/data");
            let _ = black_box(run_middleware_chain(&middlewares, req));
        });
    });

    // Timeout only (won't actually timeout since no I/O)
    group.bench_function("timeout", |b| {
        let middlewares: Vec<Box<dyn Middleware>> =
            vec![Box::new(Timeout::new(Duration::from_secs(30)))];
        b.iter(|| {
            let req = Request::new("GET", "/");
            let _ = black_box(run_middleware_chain(&middlewares, req));
        });
    });

    // Realistic stack: RequestId + CORS + Timeout + Logger
    group.bench_function("full_stack", |b| {
        let middlewares: Vec<Box<dyn Middleware>> = vec![
            Box::new(RequestId),
            Box::new(Cors::default()),
            Box::new(Timeout::new(Duration::from_secs(30))),
            // Logger uses tracing — include for realistic overhead
            Box::new(Logger),
        ];
        b.iter(|| {
            let req = Request::new("GET", "/api/data");
            let _ = black_box(run_middleware_chain(&middlewares, req));
        });
    });

    group.finish();
}

fn bench_request_construction(c: &mut Criterion) {
    // Baseline: how much does building a Request cost?
    c.bench_function("baseline/request_new", |b| {
        b.iter(|| {
            let _ = black_box(Request::new("GET", "/api/v1/users/42"));
        });
    });

    c.bench_function("baseline/request_with_headers", |b| {
        b.iter(|| {
            let _ = black_box(
                Request::new("POST", "/api/v1/users")
                    .with_header("content-type", "application/json")
                    .with_header("authorization", "Bearer token123")
                    .with_header("accept", "application/json")
                    .with_header("x-request-id", "req-abc-123"),
            );
        });
    });
}

// ── Next allocation isolation ─────────────────────────────────────────────

fn bench_next_allocation(c: &mut Criterion) {
    let mut group = c.benchmark_group("middleware/next_alloc");

    // Cost of Next::new() — the Box<dyn FnOnce> allocation
    group.bench_function("boxed_closure", |b| {
        b.iter(|| {
            let next = Next::new(move |req: Request| -> Pin<Box<dyn Future<Output = Response> + Send>> {
                terminal_handler(req)
            });
            let _ = black_box(next);
        });
    });

    // Cost of Next::from_fn() — zero allocation
    group.bench_function("fn_ptr", |b| {
        b.iter(|| {
            let next = Next::from_fn(terminal_handler);
            let _ = black_box(next);
        });
    });

    group.finish();
}

// ── MiddlewareStack (production path) ────────────────────────────────────

fn bench_middleware_stack(c: &mut Criterion) {
    let mut group = c.benchmark_group("middleware/stack");

    for count in [1, 5, 10] {
        let mw_stack = ava_web::middleware::stack(
            (0..count).map(|_| Box::new(Passthrough) as Box<dyn Middleware>).collect(),
        );

        group.bench_with_input(
            BenchmarkId::new("passthrough", count),
            &count,
            |b, _| {
                b.iter(|| {
                    let req = Request::new("GET", "/");
                    let next = Next::new(move |r: Request| -> Pin<Box<dyn Future<Output = Response> + Send>> {
                        terminal_handler(r)
                    });
                    let fut = mw_stack.handle(req, next);
                    let _ = black_box(futures_block_on(fut));
                });
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_passthrough_chain,
    bench_header_chain,
    bench_builtin_middleware,
    bench_request_construction,
    bench_next_allocation,
    bench_middleware_stack,
);
criterion_main!(benches);
