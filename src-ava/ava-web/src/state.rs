//! Application state management and GenServer-backed actor handlers.
//!
//! State is shared across handlers via the `State<T>` extractor.
//! Actor handlers provide persistent, mutable state across requests
//! through the `ActorHandler` trait — the key differentiator from axum.
//!
//! # Actor Handlers
//!
//! Unlike stateless function handlers, an `ActorHandler` maintains its own
//! state across requests. Each actor instance is a long-lived object that
//! processes requests through its mailbox (here, via `handle_request`).
//!
//! ```ignore
//! use std::sync::atomic::{AtomicU32, Ordering};
//! use ava_web::state::{ActorHandler, ActorPool};
//!
//! struct CounterActor {
//!     count: AtomicU32,
//! }
//!
//! impl ActorHandler for CounterActor {
//!     fn handle_request(&self, req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
//!         Box::pin(async move {
//!             let n = self.count.fetch_add(1, Ordering::SeqCst);
//!             format!("count: {n}").into_response()
//!         })
//!     }
//! }
//!
//! // Pool of 4 counter actors, round-robin dispatch
//! let pool = ActorPool::new(vec![
//!     CounterActor { count: AtomicU32::new(0) },
//!     CounterActor { count: AtomicU32::new(0) },
//!     CounterActor { count: AtomicU32::new(0) },
//!     CounterActor { count: AtomicU32::new(0) },
//! ]);
//! ```

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use crate::extractor::Request;
use crate::handler::Handler;
use crate::response::Response;

// ── AppState ──────────────────────────────────────────────────────────────

/// Shared application state wrapper.
///
/// Wraps state in an Arc for cheap cloning across connections.
/// Injected into requests via `Router::with_state()`.
#[derive(Debug, Clone)]
pub struct AppState<T: Clone + Send + Sync + 'static> {
    inner: Arc<T>,
}

impl<T: Clone + Send + Sync + 'static> AppState<T> {
    /// Create a new shared state.
    pub fn new(state: T) -> Self {
        Self {
            inner: Arc::new(state),
        }
    }

    /// Get a reference to the inner state.
    pub fn get(&self) -> &T {
        &self.inner
    }
}

impl<T: Clone + Send + Sync + 'static> std::ops::Deref for AppState<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

// ── ActorHandler Trait ────────────────────────────────────────────────────

/// A GenServer actor that handles HTTP requests through persistent state.
///
/// Unlike stateless function handlers, an `ActorHandler` maintains its own
/// state across requests. The actor lives for the lifetime of the server,
/// processing requests sequentially through `handle_request`.
///
/// # Concurrency
///
/// The `&self` receiver means multiple requests can be handled concurrently
/// by a single actor instance. Use interior mutability (`AtomicU32`,
/// `Mutex`, `RwLock`) for mutable state.
///
/// For request isolation, use [`ActorPool`] to distribute requests across
/// multiple actor instances.
pub trait ActorHandler: Send + Sync + 'static {
    /// Handle an HTTP request, producing a response.
    ///
    /// The actor has persistent state across requests. Use interior
    /// mutability for state that changes per-request.
    fn handle_request(&self, req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>>;
}

// ── ActorPool ─────────────────────────────────────────────────────────────

/// Round-robin pool of actor handler instances.
///
/// Distributes incoming requests across `N` actor instances using a
/// lock-free atomic counter. Each actor maintains its own independent
/// state, providing request isolation.
///
/// # Example
///
/// ```ignore
/// let pool = ActorPool::new(vec![
///     MyActor::new(),
///     MyActor::new(),
///     MyActor::new(),
/// ]);
/// ```
pub struct ActorPool<A: ActorHandler> {
    actors: Vec<Arc<A>>,
    counter: AtomicUsize,
}

impl<A: ActorHandler> ActorPool<A> {
    /// Create a new actor pool from a list of actor instances.
    ///
    /// # Panics
    ///
    /// Panics if the actors list is empty.
    pub fn new(actors: Vec<A>) -> Self {
        assert!(!actors.is_empty(), "ActorPool requires at least one actor");
        Self {
            actors: actors.into_iter().map(Arc::new).collect(),
            counter: AtomicUsize::new(0),
        }
    }

    /// Get the next actor using round-robin selection.
    ///
    /// Returns `&A` (not `&Arc<A>`) — callers should borrow, not clone.
    /// The atomic counter uses `Relaxed` ordering: sufficient for round-robin
    /// distribution where strict ordering is unnecessary, and avoids the
    /// ~10ns overhead of `SeqCst` on x86 (mfence).
    pub fn next(&self) -> &A {
        let idx = self.counter.fetch_add(1, Ordering::Relaxed) % self.actors.len();
        &self.actors[idx]
    }

    /// Get the number of actors in the pool.
    #[must_use]
    pub fn len(&self) -> usize {
        self.actors.len()
    }

    /// Check if the pool is empty (always false after construction).
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.actors.is_empty()
    }
}

// ── ActorHandler → Handler bridge ─────────────────────────────────────────

/// Wraps an `ActorHandler` (or pool of them) as a `Handler` for router
/// integration.
///
/// This bridge allows actor handlers to be used anywhere a regular
/// `Handler` is expected, including in `MethodRouter` and `Router::route()`.
pub struct ActorHandlerWrapper<A: ActorHandler> {
    actor: Arc<A>,
}

impl<A: ActorHandler> ActorHandlerWrapper<A> {
    /// Wrap a single actor as a handler.
    pub fn new(actor: A) -> Self {
        Self {
            actor: Arc::new(actor),
        }
    }

    /// Wrap an Arc'd actor as a handler (used by ActorPool).
    pub fn from_arc(actor: Arc<A>) -> Self {
        Self { actor }
    }
}

impl<A: ActorHandler> Handler for ActorHandlerWrapper<A> {
    fn call(&self, req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        self.actor.handle_request(req)
    }
}

/// Wraps an `ActorPool` as a `Handler`, dispatching each request to
/// the next actor in round-robin order.
pub struct ActorPoolHandler<A: ActorHandler> {
    pool: Arc<ActorPool<A>>,
}

impl<A: ActorHandler> ActorPoolHandler<A> {
    /// Create a handler backed by an actor pool.
    pub fn new(pool: ActorPool<A>) -> Self {
        Self {
            pool: Arc::new(pool),
        }
    }
}

impl<A: ActorHandler> Handler for ActorPoolHandler<A> {
    fn call(&self, req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        // Zero-overhead dispatch: borrow the actor directly from the pool,
        // eliminating per-request Arc::clone and outer Box::pin.
        //
        // ## Why this is safe
        //
        // Lifetime chain: `&self` → `self.pool: Arc<ActorPool<A>>` →
        // `pool.actors: Vec<Arc<A>>` → `Arc<A>` → `A`. The Deref chain
        // `&Arc<A>` → `&A` gives us a borrow tied to `&self`'s lifetime.
        // The returned future borrows `&'_ A` (from `handle_request(&self)`),
        // which is valid for `'_` — the same lifetime as `&self`.
        //
        // ## What this eliminates
        //
        // 1. **Arc::clone** — atomic refcount increment (fetch_add + fence).
        //    At ~20ns per atomic CAS under no contention, this adds up at
        //    high RPS. Eliminated entirely.
        //
        // 2. **Outer Box::pin** — heap allocation for the wrapper future that
        //    just `.await`s the inner future. The inner `handle_request`
        //    already returns `Pin<Box<...>>`, so we forward it directly.
        //    Saves one `alloc::alloc` + `alloc::dealloc` per request.
        //
        // 3. **Double-await indirection** — the outer future's poll just
        //    delegated to the inner future's poll. Removing it eliminates
        //    one level of Future::poll dispatch.
        //
        // ## Atomic counter ordering
        //
        // The round-robin counter uses `Ordering::Relaxed`, which is correct:
        // we only need atomicity (no torn reads), not ordering relative to
        // other memory operations. Under contention, two threads may
        // occasionally select the same actor — this is acceptable for
        // round-robin load distribution.
        let actor: &A = self.pool.next();
        actor.handle_request(req)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::response::{IntoResponse, StatusCode};
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};

    /// Minimal single-poll executor for futures that complete immediately.
    fn block_on<F: Future>(mut fut: F) -> F::Output {
        fn noop(_: *const ()) {}
        fn noop_clone(_: *const ()) -> RawWaker {
            RawWaker::new(std::ptr::null(), &VTABLE)
        }
        static VTABLE: RawWakerVTable =
            RawWakerVTable::new(noop_clone, noop, noop, noop);
        let waker = unsafe { Waker::from_raw(RawWaker::new(std::ptr::null(), &VTABLE)) };
        let mut cx = Context::from_waker(&waker);
        let pinned = unsafe { Pin::new_unchecked(&mut fut) };
        match pinned.poll(&mut cx) {
            Poll::Ready(val) => val,
            Poll::Pending => panic!("block_on: future returned Pending"),
        }
    }

    // ── Test Actor ────────────────────────────────────────────────────────

    /// A simple counter actor that increments on each request.
    struct CounterActor {
        count: AtomicU32,
        id: u32,
    }

    impl CounterActor {
        fn new(id: u32) -> Self {
            Self {
                count: AtomicU32::new(0),
                id,
            }
        }
    }

    impl ActorHandler for CounterActor {
        fn handle_request(&self, _req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
            let n = self.count.fetch_add(1, Ordering::SeqCst);
            let body = format!("actor:{},count:{}", self.id, n);
            let resp = body.into_response();
            Box::pin(async move { resp })
        }
    }

    // ── Test: Actor handles a single request ──────────────────────────────

    #[test]
    fn actor_handler_single_request() {
        let actor = CounterActor::new(1);
        let req = Request::new("GET", "/counter");
        let resp = block_on(actor.handle_request(req));
        assert_eq!(resp.status, StatusCode::OK);
        assert_eq!(String::from_utf8_lossy(&resp.body), "actor:1,count:0");
    }

    // ── Test: Actor state persists across multiple calls ──────────────────

    #[test]
    fn actor_handler_persists_state() {
        let actor = CounterActor::new(1);

        // First request
        let req1 = Request::new("GET", "/counter");
        let resp1 = block_on(actor.handle_request(req1));
        assert_eq!(String::from_utf8_lossy(&resp1.body), "actor:1,count:0");

        // Second request — state should have incremented
        let req2 = Request::new("GET", "/counter");
        let resp2 = block_on(actor.handle_request(req2));
        assert_eq!(String::from_utf8_lossy(&resp2.body), "actor:1,count:1");

        // Third request
        let req3 = Request::new("GET", "/counter");
        let resp3 = block_on(actor.handle_request(req3));
        assert_eq!(String::from_utf8_lossy(&resp3.body), "actor:1,count:2");
    }

    // ── Test: ActorPool round-robin distribution ──────────────────────────

    #[test]
    fn actor_pool_round_robin() {
        let pool = ActorPool::new(vec![
            CounterActor::new(0),
            CounterActor::new(1),
            CounterActor::new(2),
        ]);
        assert_eq!(pool.len(), 3);
        assert!(!pool.is_empty());

        // Requests should round-robin: 0, 1, 2, 0, 1, 2
        for round in 0..2 {
            for actor_idx in 0..3u32 {
                let actor = pool.next();
                let req = Request::new("GET", "/counter");
                let resp = block_on(actor.handle_request(req));
                let body = String::from_utf8_lossy(&resp.body);
                // Each actor gets hit once per round, so count equals the round number
                let expected = format!("actor:{actor_idx},count:{round}");
                assert_eq!(body, expected, "round={round}, actor_idx={actor_idx}");
            }
        }
    }

    // ── Test: ActorPool state isolation ────────────────────────────────────

    #[test]
    fn actor_pool_state_isolation() {
        let pool = ActorPool::new(vec![
            CounterActor::new(0),
            CounterActor::new(1),
        ]);

        // Hit actor 0 three times, actor 1 three times
        // Round-robin: 0, 1, 0, 1, 0, 1
        let mut results = Vec::new();
        for _ in 0..6 {
            let actor = pool.next();
            let req = Request::new("GET", "/counter");
            let resp = block_on(actor.handle_request(req));
            results.push(String::from_utf8_lossy(&resp.body).to_string());
        }

        // Actor 0 should have counts 0, 1, 2
        // Actor 1 should have counts 0, 1, 2
        assert_eq!(results[0], "actor:0,count:0");
        assert_eq!(results[1], "actor:1,count:0");
        assert_eq!(results[2], "actor:0,count:1");
        assert_eq!(results[3], "actor:1,count:1");
        assert_eq!(results[4], "actor:0,count:2");
        assert_eq!(results[5], "actor:1,count:2");
    }

    // ── Test: ActorHandler can be used as Handler trait ────────────────────

    #[test]
    fn actor_as_handler_trait() {
        let actor = CounterActor::new(42);
        let wrapper = ActorHandlerWrapper::new(actor);

        // Use through the Handler trait
        let handler: Box<dyn Handler> = Box::new(wrapper);

        let req1 = Request::new("GET", "/test");
        let resp1 = block_on(handler.call(req1));
        assert_eq!(String::from_utf8_lossy(&resp1.body), "actor:42,count:0");

        let req2 = Request::new("GET", "/test");
        let resp2 = block_on(handler.call(req2));
        assert_eq!(String::from_utf8_lossy(&resp2.body), "actor:42,count:1");
    }

    // ── Test: ActorPoolHandler as Handler ──────────────────────────────────

    #[test]
    fn actor_pool_handler_as_handler_trait() {
        let pool = ActorPool::new(vec![
            CounterActor::new(0),
            CounterActor::new(1),
        ]);
        let pool_handler = ActorPoolHandler::new(pool);

        // Use through the Handler trait
        let handler: Box<dyn Handler> = Box::new(pool_handler);

        let req1 = Request::new("GET", "/test");
        let resp1 = block_on(handler.call(req1));
        assert_eq!(String::from_utf8_lossy(&resp1.body), "actor:0,count:0");

        let req2 = Request::new("GET", "/test");
        let resp2 = block_on(handler.call(req2));
        assert_eq!(String::from_utf8_lossy(&resp2.body), "actor:1,count:0");

        // Round back to actor 0
        let req3 = Request::new("GET", "/test");
        let resp3 = block_on(handler.call(req3));
        assert_eq!(String::from_utf8_lossy(&resp3.body), "actor:0,count:1");
    }

    // ── Test: ActorPool panics on empty ────────────────────────────────────

    #[test]
    #[should_panic(expected = "ActorPool requires at least one actor")]
    fn actor_pool_panics_on_empty() {
        let _pool = ActorPool::<CounterActor>::new(vec![]);
    }

    // ── Test: ActorHandler with Router integration ─────────────────────────

    #[test]
    fn actor_handler_router_integration() {
        use crate::router::{Router, get};

        let actor = CounterActor::new(7);
        let wrapper = ActorHandlerWrapper::new(actor);

        let router = Router::new()
            .route("/counter", get(wrapper));

        // First request
        let req1 = Request::new("GET", "/counter");
        let resp1 = block_on(router.handle(req1));
        assert_eq!(resp1.status, StatusCode::OK);
        assert_eq!(String::from_utf8_lossy(&resp1.body), "actor:7,count:0");

        // Second request — state persists
        let req2 = Request::new("GET", "/counter");
        let resp2 = block_on(router.handle(req2));
        assert_eq!(String::from_utf8_lossy(&resp2.body), "actor:7,count:1");
    }

    // ── Test: ActorPoolHandler with Router integration ─────────────────────

    #[test]
    fn actor_pool_handler_router_integration() {
        use crate::router::{Router, get};

        let pool = ActorPool::new(vec![
            CounterActor::new(0),
            CounterActor::new(1),
        ]);
        let pool_handler = ActorPoolHandler::new(pool);

        let router = Router::new()
            .route("/counter", get(pool_handler));

        // Round-robin across pool
        let req1 = Request::new("GET", "/counter");
        let resp1 = block_on(router.handle(req1));
        assert_eq!(String::from_utf8_lossy(&resp1.body), "actor:0,count:0");

        let req2 = Request::new("GET", "/counter");
        let resp2 = block_on(router.handle(req2));
        assert_eq!(String::from_utf8_lossy(&resp2.body), "actor:1,count:0");

        let req3 = Request::new("GET", "/counter");
        let resp3 = block_on(router.handle(req3));
        assert_eq!(String::from_utf8_lossy(&resp3.body), "actor:0,count:1");
    }

    // ── Test: ActorHandlerWrapper from_arc ─────────────────────────────────

    #[test]
    fn actor_handler_wrapper_from_arc() {
        let actor = Arc::new(CounterActor::new(99));
        let wrapper = ActorHandlerWrapper::from_arc(Arc::clone(&actor));

        let req = Request::new("GET", "/test");
        let resp = block_on(wrapper.call(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "actor:99,count:0");

        // Original arc still accessible — same actor, state shared
        let req2 = Request::new("GET", "/test");
        let resp2 = block_on(actor.handle_request(req2));
        assert_eq!(String::from_utf8_lossy(&resp2.body), "actor:99,count:1");
    }
}
