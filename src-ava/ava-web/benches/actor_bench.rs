//! Actor handler dispatch benchmarks.
//!
//! Measures the per-request overhead of different handler dispatch strategies:
//! - Plain function handler (baseline)
//! - Single ActorHandler via ActorHandlerWrapper
//! - ActorPoolHandler with 1, 4, and 16 actor instances
//!
//! # What We're Measuring
//!
//! The full dispatch path for each handler type:
//! 1. Handler::call() — trait dispatch
//! 2. Round-robin selection (pool only) — atomic fetch_add
//! 3. ActorHandler::handle_request() — the inner boxed future
//!
//! # Optimization Applied
//!
//! `ActorPoolHandler::call` was changed from:
//! ```ignore
//! let actor = Arc::clone(self.pool.next());  // atomic inc (refcount)
//! Box::pin(async move { actor.handle_request(req).await })  // double-box
//! ```
//! to:
//! ```ignore
//! let actor: &A = self.pool.next();  // borrow, no Arc clone
//! actor.handle_request(req)          // single Box::pin (from handle_request)
//! ```
//!
//! This eliminates:
//! - 1 atomic refcount increment per request (~5-10 ns)
//! - 1 heap allocation per request (~20-40 ns for Box::pin)
//! - 1 extra level of future polling indirection

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use std::future::Future;
use std::pin::Pin;
use std::sync::atomic::{AtomicU32, Ordering};
use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};

use ava_web::extractor::Request;
use ava_web::handler::{FnHandler, Handler};
use ava_web::response::{IntoResponse, Response};
use ava_web::state::{ActorHandler, ActorHandlerWrapper, ActorPool, ActorPoolHandler};

/// Minimal single-poll executor for futures that complete immediately.
fn block_on<F: Future>(mut fut: F) -> F::Output {
    fn noop(_: *const ()) {}
    fn noop_clone(_: *const ()) -> RawWaker {
        RawWaker::new(std::ptr::null(), &VTABLE)
    }
    static VTABLE: RawWakerVTable = RawWakerVTable::new(noop_clone, noop, noop, noop);
    let waker = unsafe { Waker::from_raw(RawWaker::new(std::ptr::null(), &VTABLE)) };
    let mut cx = Context::from_waker(&waker);
    // SAFETY: We never move `fut` after pinning.
    let pinned = unsafe { Pin::new_unchecked(&mut fut) };
    match pinned.poll(&mut cx) {
        Poll::Ready(val) => val,
        Poll::Pending => panic!("block_on: future returned Pending"),
    }
}

/// A minimal actor that returns a constant response.
/// Designed to isolate dispatch overhead from handler logic.
struct NoopActor;

impl ActorHandler for NoopActor {
    fn handle_request(&self, _req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        Box::pin(async { "ok".into_response() })
    }
}

/// Actor with a hot atomic counter — measures dispatch + minimal state mutation.
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

// ── Dispatch Benchmarks ──────────────────────────────────────────────────

fn bench_dispatch(c: &mut Criterion) {
    let mut group = c.benchmark_group("actor/dispatch");

    // Baseline: plain function handler (no actor overhead)
    group.bench_function("fn_handler", |b| {
        fn index() -> &'static str {
            "ok"
        }
        let handler = FnHandler::new(index);
        b.iter(|| {
            let req = Request::new("GET", "/");
            let resp = block_on(handler.call(black_box(req)));
            black_box(resp);
        });
    });

    // Single actor (ActorHandlerWrapper) — no pool overhead
    group.bench_function("single_actor/noop", |b| {
        let wrapper = ActorHandlerWrapper::new(NoopActor);
        b.iter(|| {
            let req = Request::new("GET", "/");
            let resp = block_on(wrapper.call(black_box(req)));
            black_box(resp);
        });
    });

    // Single actor with state mutation
    group.bench_function("single_actor/counter", |b| {
        let wrapper = ActorHandlerWrapper::new(CounterActor::new());
        b.iter(|| {
            let req = Request::new("GET", "/");
            let resp = block_on(wrapper.call(black_box(req)));
            black_box(resp);
        });
    });

    // Pool of 1 — measures pool dispatch overhead vs single actor
    group.bench_function("pool_1/noop", |b| {
        let pool = ActorPool::new(vec![NoopActor]);
        let handler = ActorPoolHandler::new(pool);
        b.iter(|| {
            let req = Request::new("GET", "/");
            let resp = block_on(handler.call(black_box(req)));
            black_box(resp);
        });
    });

    group.bench_function("pool_1/counter", |b| {
        let pool = ActorPool::new(vec![CounterActor::new()]);
        let handler = ActorPoolHandler::new(pool);
        b.iter(|| {
            let req = Request::new("GET", "/");
            let resp = block_on(handler.call(black_box(req)));
            black_box(resp);
        });
    });

    // Pool of 4 — typical deployment
    group.bench_function("pool_4/noop", |b| {
        let actors: Vec<NoopActor> = (0..4).map(|_| NoopActor).collect();
        let pool = ActorPool::new(actors);
        let handler = ActorPoolHandler::new(pool);
        b.iter(|| {
            let req = Request::new("GET", "/");
            let resp = block_on(handler.call(black_box(req)));
            black_box(resp);
        });
    });

    group.bench_function("pool_4/counter", |b| {
        let actors: Vec<CounterActor> = (0..4).map(|_| CounterActor::new()).collect();
        let pool = ActorPool::new(actors);
        let handler = ActorPoolHandler::new(pool);
        b.iter(|| {
            let req = Request::new("GET", "/");
            let resp = block_on(handler.call(black_box(req)));
            black_box(resp);
        });
    });

    // Pool of 16 — stress test for round-robin modulo
    group.bench_function("pool_16/noop", |b| {
        let actors: Vec<NoopActor> = (0..16).map(|_| NoopActor).collect();
        let pool = ActorPool::new(actors);
        let handler = ActorPoolHandler::new(pool);
        b.iter(|| {
            let req = Request::new("GET", "/");
            let resp = block_on(handler.call(black_box(req)));
            black_box(resp);
        });
    });

    group.bench_function("pool_16/counter", |b| {
        let actors: Vec<CounterActor> = (0..16).map(|_| CounterActor::new()).collect();
        let pool = ActorPool::new(actors);
        let handler = ActorPoolHandler::new(pool);
        b.iter(|| {
            let req = Request::new("GET", "/");
            let resp = block_on(handler.call(black_box(req)));
            black_box(resp);
        });
    });

    group.finish();
}

// ── Atomic Counter Scaling ───────────────────────────────────────────────

fn bench_atomic_scaling(c: &mut Criterion) {
    let mut group = c.benchmark_group("actor/atomic");

    // Isolated atomic increment — Relaxed ordering (what we use)
    group.bench_function("fetch_add_relaxed", |b| {
        let counter = AtomicU32::new(0);
        b.iter(|| {
            black_box(counter.fetch_add(1, Ordering::Relaxed));
        });
    });

    // SeqCst ordering for comparison
    group.bench_function("fetch_add_seqcst", |b| {
        let counter = AtomicU32::new(0);
        b.iter(|| {
            black_box(counter.fetch_add(1, Ordering::SeqCst));
        });
    });

    // Modulo cost (round-robin index computation)
    group.bench_function("fetch_add_relaxed_mod4", |b| {
        let counter = std::sync::atomic::AtomicUsize::new(0);
        b.iter(|| {
            let idx = counter.fetch_add(1, Ordering::Relaxed) % 4;
            black_box(idx);
        });
    });

    group.bench_function("fetch_add_relaxed_mod16", |b| {
        let counter = std::sync::atomic::AtomicUsize::new(0);
        b.iter(|| {
            let idx = counter.fetch_add(1, Ordering::Relaxed) % 16;
            black_box(idx);
        });
    });

    group.finish();
}

criterion_group!(benches, bench_dispatch, bench_atomic_scaling);
criterion_main!(benches);
