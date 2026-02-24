# ava-web Architecture

> GenServer-native HTTP framework built entirely on asupersync. Zero tokio. Zero hyper.

## Table of Contents

- [Design Philosophy](#design-philosophy)
- [Layer Diagram](#layer-diagram)
- [Module Map](#module-map)
- [Request Lifecycle](#request-lifecycle)
- [GenServer-Native Design](#genserver-native-design)
- [Actor Handler Lifecycle](#actor-handler-lifecycle)
- [Router: matchit Radix Tree](#router-matchit-radix-tree)
- [Middleware Composition](#middleware-composition)
- [Extractor Pattern](#extractor-pattern)
- [Response Pipeline](#response-pipeline)
- [Protocol Transparency](#protocol-transparency)
- [H1 Bridge: Zero-Copy Pipeline](#h1-bridge-zero-copy-pipeline)
- [WebSocket Support](#websocket-support)
- [Server-Sent Events](#server-sent-events)
- [Advanced Features](#advanced-features)
- [Formal Verification](#formal-verification)
- [Zero-Tokio Justification](#zero-tokio-justification)
- [Testing Infrastructure](#testing-infrastructure)
- [Performance Summary](#performance-summary)

---

## Design Philosophy

ava-web exists because no existing Rust web framework gives you **stateful, supervised actors as first-class HTTP handlers**. Axum, Actix-web, and Warp all treat handlers as stateless functions. State is shared via `Arc<Mutex<T>>` bolted on after the fact.

ava-web inverts this. The framework is built on asupersync's GenServer runtime, where:

1. **Every long-lived concern is a supervised actor** — connection handlers, WebSocket sessions, rate limiters, metrics collectors.
2. **Stateless handlers are still first-class** — `async fn` with extractors works exactly like axum.
3. **Actor handlers are the differentiator** — persistent, mutable state across requests without `Arc<Mutex>`.
4. **Zero tokio, zero hyper** — the entire stack runs on asupersync's executor, reactor, and I/O primitives.

This is not a wrapper around hyper. This is a ground-up HTTP framework where the runtime and the web layer share a single supervision tree.

---

## Layer Diagram

```
                    ┌─────────────────────────────────┐
                    │          TCP Listener            │
                    │   asupersync::net::tcp::listener │
                    └────────────┬────────────────────┘
                                 │
                    ┌────────────▼────────────────────┐
                    │        Http1Listener             │
                    │   asupersync::http::h1::listener │
                    │   (per-connection task spawning)  │
                    └────────────┬────────────────────┘
                                 │  h1::Request (owned)
                    ┌────────────▼────────────────────┐
                    │     H1 Bridge (Zero-Copy)        │
                    │   convert_h1_request_owned()     │
                    │   Vec<u8> → Bytes: O(1)          │
                    │   String headers: in-place lower  │
                    └────────────┬────────────────────┘
                                 │  web::Request
                    ┌────────────▼────────────────────┐
                    │      State Injection             │
                    │   TypedStateInjector.inject()    │
                    │   (into request.extensions)      │
                    └────────────┬────────────────────┘
                                 │
                    ┌────────────▼────────────────────┐
                    │     Middleware Chain (LIFO)       │
                    │   Timeout → CORS → Logger → ...  │
                    │   Each: fn(&self, req, Next) →   │
                    │         Pin<Box<dyn Future>>      │
                    └────────────┬────────────────────┘
                                 │
                    ┌────────────▼────────────────────┐
                    │      Router Dispatch             │
                    │   matchit radix tree: O(log n)   │
                    │   path params → HashMap          │
                    └──┬─────────┬──────────┬─────────┘
                       │         │          │
              ┌────────▼──┐ ┌───▼────┐ ┌───▼──────────┐
              │  Route     │ │ Nested │ │  Fallback    │
              │  dispatch  │ │ Router │ │  Handler     │
              └────┬───────┘ └───┬────┘ └───┬──────────┘
                   │             │           │
              ┌────▼─────────────▼───────────▼─────────┐
              │          Handler Dispatch                │
              │  FnHandler (sync) / AsyncFnHandler      │
              │  FnHandler1..8 / AsyncFnHandler1..8     │
              │  ActorHandlerWrapper / ActorPoolHandler  │
              └────────────┬───────────────────────────┘
                           │
              ┌────────────▼────────────────────┐
              │    Extractor Pipeline            │
              │  T1..T(N-1): FromRequestParts    │
              │  TN: FromRequest (body consumer) │
              │  Error → short-circuit response  │
              └────────────┬────────────────────┘
                           │
              ┌────────────▼────────────────────┐
              │    IntoResponse                  │
              │  &str / String / Json<T> / Html  │
              │  StatusCode / (Status, T) / Bytes│
              │  Result<T, E> / Redirect         │
              │  AppError → ProblemDetails (9457) │
              └────────────┬────────────────────┘
                           │  web::Response
              ┌────────────▼────────────────────┐
              │     H1 Bridge (Response)         │
              │   convert_web_to_h1()            │
              │   Cow::into_owned() headers      │
              │   Vec::from(Bytes) body           │
              └────────────┬────────────────────┘
                           │  h1::Response
              ┌────────────▼────────────────────┐
              │        Http1Server               │
              │   asupersync::http::h1::server   │
              │   (write response to TCP)        │
              └─────────────────────────────────┘
```

---

## Module Map

| Module | File | Lines | Purpose |
|--------|------|-------|---------|
| `lib` | `src/lib.rs` | 78 | Crate root, re-exports, feature gates |
| `server` | `src/server.rs` | 590 | HttpServer, ServerConfig, H1 bridge functions |
| `router` | `src/router.rs` | 754 | Router, MethodRouter, matchit dispatch, nesting |
| `handler` | `src/handler.rs` | 692 | Handler trait, macro-generated arities 0-8 |
| `extractor` | `src/extractor.rs` | 642 | Request, Method, HeaderMap, Extensions, extractors |
| `middleware` | `src/middleware.rs` | 711 | Middleware trait, Next, built-in middlewares |
| `response` | `src/response.rs` | 431 | Response, StatusCode, IntoResponse, Json, Html |
| `state` | `src/state.rs` | 477 | AppState, ActorHandler, ActorPool, bridges |
| `error` | `src/error.rs` | 130 | AppError, ProblemDetails (RFC 9457) |
| `ws` | `src/ws.rs` | ~900 | WebSocket upgrade, WsMessage, zero-copy frames |
| `sse` | `src/sse.rs` | ~550 | Server-Sent Events, Event, SseStream |
| `metrics` | `src/metrics.rs` | ~500 | Histogram, MetricsCollector, Prometheus export |
| `multipart` | `src/multipart.rs` | ~750 | Multipart parser, memchr scanning, zero-copy |
| `static_files` | `src/static_files.rs` | ~560 | Static file serving, ETag, content-type |
| `openapi` | `src/openapi.rs` | ~470 | OpenAPI 3.1 document builder |
| `testing` | `src/testing.rs` | ~1000 | TestServer, TestRequest, assertion helpers |
| `h2` | `src/h2.rs` | ~1000 | HTTP/2 support (feature-gated) |
| `h3` | `src/h3.rs` | ~350 | HTTP/3 support (feature-gated) |

**Total**: ~10,000 lines of framework code across 18 modules.

---

## Request Lifecycle

A request traverses the following stages, each corresponding to a distinct code path:

### 1. Accept (asupersync)

`Http1Listener::run()` accepts TCP connections and spawns per-connection tasks on the `RuntimeHandle`. Connection count is bounded by `ServerConfig::max_connections` (default: 10,000).

**File**: `server.rs:260-266`

### 2. H1 Parse (asupersync)

asupersync's `Http1Server` parses the raw TCP stream into an `h1::Request { method: String, uri: String, headers: Vec<(String, String)>, body: Vec<u8> }`.

### 3. Bridge: h1 → web (zero-copy)

`convert_h1_request_owned()` transfers ownership from h1 types to web types:

- **Body**: `Bytes::from(Vec<u8>)` — O(1) pointer move, no memcpy
- **Headers**: `String::make_ascii_lowercase()` in-place, then `Cow::Owned(String)` — no allocation
- **URI**: `String::find('?')` + `truncate()` — split in-place, no new allocation
- **Method**: Enum match — O(1)

**File**: `server.rs:366-410`

### 4. State Injection

If `Router::with_state(T)` was called, `TypedStateInjector::inject()` clones `T` into `request.extensions` before any middleware runs.

**File**: `router.rs:316-318`

### 5. Middleware Chain

Middleware executes in LIFO order (last added = outermost = runs first). Each middleware receives `(Request, Next)` and may:
- **Pass through**: call `next.run(req).await`, optionally modifying the response
- **Short-circuit**: return a response without calling `next`

**File**: `router.rs:326-345`

### 6. Route Dispatch

`matchit::Router::at(&path)` performs O(log n) radix tree lookup. On match:
- Path params are extracted into `req.path_params`
- `Route::dispatch()` matches the HTTP method against registered handlers
- **Method match**: handler executes
- **Method mismatch**: 405 with `Allow` header
- **Route miss**: check nested routers, then fallback, then 404

**File**: `router.rs:348-381`

### 7. Extraction

Handler wrappers (`FnHandler1..8`, `AsyncFnHandler1..8`) run the extractor pipeline:
- `T1..T(N-1)` implement `FromRequestParts` — borrow `&Request`
- `TN` implements `FromRequest` — takes `Request` by value (may consume body)
- Any extraction failure returns the error as a response (short-circuit)

**File**: `handler.rs:88-232`

### 8. Handler Execution

The user's handler function runs, producing a type that implements `IntoResponse`.

### 9. Response Conversion

`IntoResponse` converts the return type into `Response { status, headers, body: Bytes }`. Implementations exist for: `&str`, `String`, `Json<T>`, `Html<T>`, `Bytes`, `Vec<u8>`, `()`, `StatusCode`, `(StatusCode, T)`, `Result<T, E>`, `Redirect`, `AppError`, `ProblemDetails`.

**File**: `response.rs:165-384`

### 10. Bridge: web → h1

`convert_web_to_h1()` converts back:
- **Headers**: `Cow::into_owned()` — no-op for owned Cows (common case)
- **Body**: `Vec::from(Bytes)` — O(1) when Bytes uniquely owns the backing allocation

**File**: `server.rs:427-436`

---

## GenServer-Native Design

### Why It Matters

Traditional web frameworks (axum, actix-web, warp) treat every request handler as a stateless function. To maintain state across requests, you must:

```rust
// axum pattern: shared state via Arc
let shared = Arc::new(Mutex::new(MyState::new()));
let app = Router::new().route("/", get(move || {
    let state = shared.lock().unwrap(); // Mutex on every request
    // ...
}));
```

This has three problems:
1. **Mutex contention** under high concurrency
2. **No isolation** — all requests share the same mutable state
3. **No supervision** — if state corruption occurs, there's no recovery mechanism

### ava-web's Actor Model

```rust
// ava-web pattern: actor handler with persistent state
struct CounterActor {
    count: AtomicU32,
}

impl ActorHandler for CounterActor {
    fn handle_request(&self, req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        let n = self.count.fetch_add(1, Ordering::SeqCst);
        Box::pin(async move { format!("count: {n}").into_response() })
    }
}

// Pool of 4 independent actors — round-robin dispatch
let pool = ActorPool::new(vec![
    CounterActor::new(), CounterActor::new(),
    CounterActor::new(), CounterActor::new(),
]);
let app = Router::new()
    .route("/counter", get(ActorPoolHandler::new(pool)));
```

**Benefits**:
- **No Mutex**: Interior mutability (`AtomicU32`, `RwLock`) is per-actor
- **Isolation**: Each actor in the pool maintains independent state
- **Round-robin dispatch**: Lock-free `AtomicUsize` counter, O(1)
- **Composable**: `ActorHandlerWrapper` and `ActorPoolHandler` implement `Handler`, so they compose with middleware, routing, and extractors identically to stateless handlers

---

## Actor Handler Lifecycle

```
Creation                     Dispatch                      Shutdown
────────                     ────────                      ────────
ActorPool::new(vec![         pool.next() → &Arc<A>         Server shutdown
  A1, A2, A3, A4             A.handle_request(req)         → drain timeout
])                           → Response                    → actors dropped
↓                            ↓
actors: Vec<Arc<A>>          counter.fetch_add(1, Relaxed)
counter: AtomicUsize(0)      % actors.len() = idx
```

1. **Creation**: `ActorPool::new()` wraps each actor in `Arc<A>` for shared ownership. Panics if empty.
2. **Dispatch**: `pool.next()` increments an atomic counter modulo pool size. Returns `&Arc<A>`. No lock, no contention.
3. **State**: Actors own their state. `&self` receiver means concurrent access via interior mutability. Use `AtomicU32`, `parking_lot::Mutex`, or `RwLock` for mutable fields.
4. **Bridge**: `ActorHandlerWrapper<A>` adapts a single actor to the `Handler` trait. `ActorPoolHandler<A>` adapts a pool.
5. **Shutdown**: Actors are dropped when the server shuts down and all `Arc` references are released.

**File**: `state.rs:97-211`

---

## Router: matchit Radix Tree

### Structure

```rust
pub struct Router {
    tree: matchit::Router<RouteId>,   // Compressed radix tree
    routes: Vec<Route>,               // RouteId → Route (method → handler map)
    nested: Vec<(String, Router)>,    // Prefix-based sub-routers
    fallback: Option<Box<dyn ErasedHandler>>,
    middlewares: Vec<Box<dyn Middleware>>,
    state: Option<Box<dyn StateInjector>>,
}
```

### Dispatch Decision Tree

```
Request arrives
│
├─ matchit::Router::at(path) → Ok(matched)?
│  ├─ YES: extract path params, lookup Route
│  │  ├─ Method match → handler response
│  │  └─ Method mismatch → 405 + Allow header
│  │
│  └─ NO: try nested routers
│     ├─ strip_prefix(path, prefix) → Some(sub_path)?
│     │  └─ YES: delegate to nested_router.handle(req)
│     └─ NO: fallback or 404
│
└─ Note: normalize_path() only runs at registration time (`:param` → `{param}`)
   Dispatch path never contains `:`, so we skip the normalization scan.
```

### Performance

- **Static route**: 114 ns (O(1) effective via radix tree)
- **Parameterized route**: 178 ns (includes HashMap insertion for params)
- **Route miss**: 50 ns
- **Scaling**: 10 routes = 114 ns, 1000 routes = 114 ns (radix tree, not linear scan)

**File**: `router.rs:169-388`

---

## Middleware Composition

### The Next Pattern

```rust
pub trait Middleware: Send + Sync + 'static {
    fn handle<'a>(&'a self, req: Request, next: Next<'a>)
        -> Pin<Box<dyn Future<Output = Response> + Send + 'a>>;
}
```

`Next` is an enum that avoids heap allocation for terminal dispatch:

```rust
enum NextInner<'a> {
    Boxed(Box<dyn FnOnce(Request) -> Pin<Box<...>> + Send + Sync + 'a>),
    FnPtr(fn(Request) -> Pin<Box<...>>),  // Zero-alloc terminal path
}
```

### Why FnOnce, Not Fn

A middleware chain invokes `next` **exactly once** per request. `Box<dyn Fn>` requires the closure to be reusable, forcing `Arc<Mutex>` for shared ownership. `Box<dyn FnOnce>` enables move semantics — the closure is consumed, allowing the compiler to elide allocations and eliminating atomic refcounting.

### LIFO Ordering

```
.layer(A)        ← added first (innermost)
.layer(B)        ← added second (outermost)

Execution: B → A → handler → A → B
                  (request)  (response)
```

The router chains middleware via `run_middleware(req, idx)` starting from `idx = mw_count - 1` (outermost) down to 0 (innermost). Each level creates a `Next` that chains to the next-inner middleware or to `dispatch_inner`.

### Built-in Middlewares

| Middleware | Purpose | Key Design |
|-----------|---------|------------|
| `Timeout` | Request timeout | Elapsed check after handler |
| `Cors` | CORS headers | `Cow<'static, str>` for zero-alloc defaults |
| `RequestId` | Unique request ID | Nanos-based, injected into extensions |
| `Logger` | Request logging | tracing integration |
| `RateLimiter` | Per-client rate limiting | `parking_lot::Mutex<HashMap<String, (u32, Instant)>>` |
| `MaxBodySize` | Body size guard | Content-Length header check |
| `SecurityHeaders` | X-Content-Type-Options, etc. | `Cow<'static, str>` defaults |
| `Compression` | gzip/deflate | TODO (pass-through) |
| `MiddlewareStack` | N-ary composition | Recursive `build()` function |

### Performance

- **Per-layer cost**: ~23 ns
- **5 layers**: 189 ns
- **20 layers**: 641 ns
- **Scaling**: Linear O(n) in layer count

**File**: `middleware.rs:1-435`

---

## Extractor Pattern

### Two Traits

```rust
// Non-consuming: borrows &Request (headers, path, query)
pub trait FromRequestParts: Sized {
    fn from_request_parts(req: &Request) -> Result<Self, ExtractionError>;
}

// Consuming: takes Request by value (may read body)
pub trait FromRequest: Sized {
    fn from_request(req: Request) -> Result<Self, ExtractionError>;
}

// Blanket impl: FromRequestParts → FromRequest
impl<T: FromRequestParts> FromRequest for T { ... }
```

### Built-in Extractors

| Extractor | Trait | Source |
|-----------|-------|--------|
| `Path<String>` | `FromRequestParts` | First path param value |
| `Path<u64>` | `FromRequestParts` | First path param, parsed |
| `Path<HashMap>` | `FromRequestParts` | All path params |
| `Query<HashMap>` | `FromRequestParts` | URL query string parsed |
| `State<T>` | `FromRequestParts` | From extensions (via `with_state`) |
| `HashMap<String, String>` | `FromRequestParts` | All headers as owned map |
| `Json<T>` | `FromRequest` | JSON body deserialization |
| `Form<HashMap>` | `FromRequest` | URL-encoded body |
| `RawBody` | `FromRequest` | Raw body bytes |

### Handler Arity Macros

Handler wrappers are generated via macros for arities 0 through 8:
- For N extractors: T1..T(N-1) use `FromRequestParts`, TN uses `FromRequest`
- Extraction is sequential: first failure short-circuits with error response
- Both sync (`FnHandler0..8`) and async (`AsyncFnHandler0..8`) variants

### JSON: simd-json Feature Gate

```toml
ava-web = { features = ["simd-json"] }
```

When enabled, `json_deserialize()` uses SIMD-accelerated parsing (SSE4.2/AVX2/NEON). 1.3-2x speedup for small payloads, up to 1.9x for large payloads. Default path uses `serde_json` for universal portability.

**File**: `extractor.rs:1-577`, `handler.rs:1-271`

---

## Response Pipeline

### IntoResponse Implementations

```rust
impl IntoResponse for &'static str       // → 200, text/plain, Bytes::from_static
impl IntoResponse for String              // → 200, text/plain, Bytes::from
impl IntoResponse for Bytes               // → 200, application/octet-stream
impl IntoResponse for Vec<u8>             // → 200, application/octet-stream
impl IntoResponse for ()                  // → 200, empty body
impl IntoResponse for StatusCode          // → status, empty body
impl IntoResponse for (StatusCode, T)     // → status override + T's body
impl IntoResponse for Result<T, E>        // → Ok(T) or Err(E), both IntoResponse
impl IntoResponse for Json<T>             // → 200, application/json, serialized
impl IntoResponse for Html<T>             // → 200, text/html
impl IntoResponse for Redirect            // → 301/302/307, Location header
impl IntoResponse for AppError            // → RFC 9457 ProblemDetails JSON
impl IntoResponse for ExtractionError     // → status, text/plain error message
```

### Error Responses: RFC 9457

`AppError` variants map to HTTP status codes and produce RFC 9457 Problem Details JSON:

```json
{
    "type": "about:blank",
    "title": "Not Found",
    "status": 404,
    "detail": "user 42"
}
```

**File**: `response.rs:1-384`, `error.rs:1-130`

---

## Protocol Transparency

### Same Stack Across H1/H2/H3

ava-web presents a unified `Request` → `Router` → `Response` pipeline regardless of the underlying HTTP protocol version. The bridge layer translates protocol-specific types to framework types.

| Protocol | Feature Gate | Bridge Module | Transport |
|----------|-------------|---------------|-----------|
| HTTP/1.1 | Always on | `server.rs` | `asupersync::http::h1` |
| HTTP/2 | `h2` | `h2.rs` | `asupersync::http::h2` |
| HTTP/3 | `h3` | `h3.rs` | `asupersync::http::h3` (QUIC) |

All three protocols bridge to the same `web::Request` type and dispatch through the same `Router`. Handlers, extractors, and middleware are protocol-agnostic.

**Note**: H2 and H3 are feature-gated due to API drift with asupersync's protocol implementations.

---

## H1 Bridge: Zero-Copy Pipeline

The H1 bridge is the hot path — every HTTP/1.1 request and response passes through it.

### Request Bridge (h1 → web)

```rust
pub fn convert_h1_request_owned(h1_req: h1::Request) -> WebRequest {
    // URI: split in-place via find('?') + truncate — no new allocation
    // Headers: make_ascii_lowercase() in-place, Cow::Owned — no allocation
    // Body: Bytes::from(Vec<u8>) — O(1) ownership transfer
    // Method: enum match — O(1)
}
```

**Key optimization**: Takes `h1::Request` by value (not by reference). This enables ownership transfer of heap allocations instead of copying them.

| Field | Copy Cost (borrowing) | Transfer Cost (owning) |
|-------|----------------------|----------------------|
| Body (1MB) | O(n) memcpy | O(1) pointer move |
| Headers (20) | 20x String::clone | 20x discriminant write |
| URI | String::clone | 0 (truncate in-place) |

### Response Bridge (web → h1)

```rust
pub fn convert_web_to_h1(resp: WebResponse) -> (u16, Vec<(String, String)>, Vec<u8>) {
    // Headers: Cow::into_owned() — no-op for Owned variant (common case)
    // Body: Vec::from(Bytes) — O(1) when Bytes uniquely owns backing
}
```

**File**: `server.rs:303-436`

---

## WebSocket Support

### Upgrade Flow

1. `WebSocketUpgrade::from_request()` validates upgrade headers (`Connection: Upgrade`, `Upgrade: websocket`, `Sec-WebSocket-Key`, `Sec-WebSocket-Version: 13`)
2. Handler returns `WebSocketUpgrade` which implements `IntoResponse` (101 Switching Protocols)
3. After upgrade, `WebSocket` wraps asupersync's `ServerWebSocket`

### Zero-Copy Frames

`WsMessage::Binary`, `::Ping`, and `::Pong` use `asupersync::bytes::Bytes`. Since asupersync's internal `Message` also holds `Bytes`, conversion is a refcount bump — O(1), no memcpy.

```rust
pub enum WsMessage {
    Text(String),           // UTF-8 text
    Binary(AsBytes),        // Zero-copy from frame codec
    Ping(AsBytes),          // Zero-copy
    Pong(AsBytes),          // Zero-copy
    Close(Option<CloseFrame>),
}
```

**File**: `ws.rs`

---

## Server-Sent Events

Two modes:

- **Batch** (`Sse`): All events serialized into a single response body
- **Streaming** (`SseStream<I>`): Events from an iterator, rendered per W3C spec

Events follow the `text/event-stream` format with `event`, `id`, `data`, `retry`, and `comment` fields. Comment-only events (`:keepalive`) are supported for connection liveness.

**File**: `sse.rs`

---

## Advanced Features

### Multipart Parser

memchr-accelerated boundary scanning with zero-copy part extraction via `Bytes::slice()`. 52x faster than the original naive implementation for 1MB uploads.

### Static File Serving

4-lane parallel FNV-1a ETag computation. Content-type detection from extension. `If-None-Match` support (304). Directory traversal prevention. Optional `index.html` fallback.

### Metrics (Prometheus)

Per-route latency histograms with Prometheus text-format export. `MetricsMiddleware` records request durations. Route label sanitized once per route (not per metric line).

### OpenAPI 3.1

Document builder with path items, operations, parameters, and request/response bodies. Served as JSON via a dedicated handler.

### Test Harness

`TestServer` wraps a Router for integration testing with no TCP sockets. Fluent request builder with assertion helpers (`assert_status`, `assert_body_text`, `assert_json`, `assert_header`).

---

## Formal Verification

### Lean 4 Proofs (28 theorems, 0 sorry)

| Module | Key Results |
|--------|------------|
| **Types** (`AvaWeb/Types.lean`) | HTTP primitives: Method, Request, Response, StatusCode, HeaderMap |
| **Middleware/Monoid** (`AvaWeb/Middleware/Monoid.lean`) | Monoid laws (associativity + identity), status/header/body preservation under composition, short-circuit isolation, N-ary stack preservation |
| **Router/Trie** (`AvaWeb/Router/Trie.lean`) | Lookup totality (every path resolves), determinism, insert-lookup roundtrip, disjoint uniqueness, idempotent insert, dispatch correctness (found/missing/wrong method → correct status) |
| **Extractors/Safety** (`AvaWeb/Extractors/Safety.lean`) | Pair/triple/N-ary composition preserves success, error short-circuit (first failure determines response), total extractors never hit fallback, concrete totality (Path + Query) |

```bash
cd proofs/lean && lake build   # All 28 theorems check in ~3s
```

### TLA+ Specifications (5 specs, 194,149 distinct states, 0 violations)

| Spec | Invariants | Temporal | Max States |
|------|------------|----------|------------|
| **HTTPServer** | Type + connection bound + drain progress + no leak | Termination + drain completion + no stale | 173,664 |
| **HTTPConnection** | Type + state machine + body-once + header-before-body | Response delivery + clean close + error handling | 265 |
| **MiddlewareChain** | Type + ordering + handler-at-most-once + short-circuit valid + onion symmetry + monotone progress | Termination | 41 |
| **RouterDispatch** | Type + exactly-one-response + state-before-middleware + phase ordering + status correctness + no double dispatch | Completion | 17 |
| **ExtractorPipeline** | Type + sequential + short-circuit + body-consumed-once + total-success + error-propagation + no-skip + method-check + phase ordering | Pipeline completion + body-at-most-once + short-circuit | 36 |

Key properties verified:
- Every request eventually produces exactly one response (liveness)
- First extractor failure short-circuits the pipeline (safety)
- Request body consumed at most once (safety)
- No connection leak on error paths (safety)
- Middleware composition preserves handler reachability (safety)
- Graceful shutdown drains all connections (termination)

```bash
cd proofs/tlaplus
java -jar ~/.local/lib/tla2tools.jar -config HTTPServer-xlarge.cfg HTTPServer.tla
```

---

## Zero-Tokio Justification

ava-web uses asupersync's executor, reactor, and I/O primitives instead of tokio. This is a deliberate architectural decision, not a limitation.

### Why Not Tokio

1. **Supervision**: asupersync provides GenServer-style supervision trees. Tokio's `JoinHandle` is fire-and-forget — no automatic restart, no child-parent relationship, no supervision hierarchy.

2. **Structured Concurrency**: asupersync's `Scope` ensures all child tasks complete before the parent exits. Tokio tasks are unstructured — spawned tasks outlive their parent, leading to resource leaks.

3. **Budget Awareness**: asupersync's executor tracks per-task CPU budgets. When a task exceeds its budget, the executor can preempt it. Tokio's cooperative scheduling relies on `yield_now()` hints that handlers can (and do) forget.

4. **Single Runtime**: The HTTP server, WebSocket sessions, actors, and user code all run on the same runtime with the same supervision tree. With tokio, you'd need a separate supervision layer (e.g., bastion) bolted on top — another dependency, another abstraction mismatch.

5. **Cancel Safety**: asupersync's I/O primitives are designed for cancel safety from the ground up. Tokio's cancel safety is opt-in and frequently violated by library code.

### What We Give Up

- **Ecosystem**: Cannot use tokio-dependent libraries (reqwest, tonic, etc.) directly. asupersync provides its own TCP, UDP, HTTP, and WebSocket primitives.
- **Maturity**: tokio has years of production hardening. asupersync is newer but rigorously tested (including chaos testing and formal verification).

---

## Testing Infrastructure

### Unit Tests

Each module has comprehensive unit tests using a minimal `block_on` executor that polls futures exactly once. This works because all ava-web handlers are sync or immediately-ready async.

### Integration Tests (`TestServer`)

```rust
let server = TestServer::new(Router::new().route("/", get(hello)));
let resp = server.get("/").send();
resp.assert_status(200);
resp.assert_body_text("hello");
```

No TCP sockets, no ports, no flakiness. Requests dispatch directly through the Router.

### Lab Testing (`src/lab.rs`, feature-gated: `lab`)

Deterministic testing harness integrating asupersync's lab runtime with ava-web. Feature-gated behind `lab` to keep default builds lean.

#### Chaos Testing

`ChaosMiddleware` injects deterministic HTTP-level failures using asupersync's seeded `ChaosRng`:

```rust
use ava_web::lab::{ChaosMiddleware, ChaosPreset};

let router = Router::new()
    .route("/api", get(handler))
    .layer(ChaosMiddleware::new(42, ChaosPreset::Light));
// Same seed = same injection sequence = reproducible CI
```

Three presets: `Off` (0%), `Light` (CI-friendly: ~1% cancel, ~5% delay, ~2% I/O), `Heavy` (stress: ~10/20/15%). Custom probabilities via `.with_error_probability()` / `.with_unavailable_probability()`.

`ChaosInjectionStats` tracks 500/503 injection counts and rate.

#### Lab Test Server

`LabTestServer` wraps `TestServer` with chaos + virtual time:

```rust
let mut server = LabTestServer::with_chaos(router, 42, ChaosPreset::Light);
let resp = server.get("/health");
println!("{}", server.chaos_stats().summary());
server.advance_time_ms(5000); // Virtual time, no wall-clock
```

#### Fuzz Harness

`fuzz_router()` generates deterministic pseudo-random HTTP requests (method, path, headers, body) and catches panics:

```rust
let report = fuzz_router(router, HttpFuzzConfig::quick(42));
report.assert_no_panics();
```

Router is consumed (not Clone). Supports `quick(100)` and `thorough(10_000)` presets.

#### Virtual Time

`VirtualTimeController` wraps asupersync's `VirtualTimerWheel` for timeout testing:

```rust
let mut vtc = VirtualTimeController::new();
vtc.set_timeout_ms(5000);
assert_eq!(vtc.advance_ms(4999), 0); // Not yet
assert_eq!(vtc.advance_ms(2), 1);    // Fired
```

#### Scenario Runner

`ScenarioTestRunner` loads JSON scenarios (matching asupersync's `Scenario` format) and executes them against a router:

```rust
let runner = ScenarioTestRunner::from_json(router, json)?;
let report = runner.run();
assert!(report.all_responded());
```

**Design constraint**: Router is not `Clone` (contains `Box<dyn ErasedHandler>`), so APIs take ownership. Build fresh routers per test run.

### Benchmarks (Criterion)

7 benchmark suites covering every hot path:

| Suite | Module |
|-------|--------|
| `router_bench` | Route dispatch (static, param, miss, scaling) |
| `handler_bench` | Handler arities (0-8, sync, async) |
| `middleware_bench` | Middleware stack (0-20 layers) |
| `bridge_bench` | H1 bridge (request + response conversion) |
| `multipart_bench` | Multipart parsing (1KB-1MB) |
| `module_bench` | SSE, WS, static files, extractors, metrics |
| `ws_bench` | WebSocket message bridging |

### Formal Verification

See [Formal Verification](#formal-verification) section above.

---

## Performance Summary

### Per-Stage Latencies

| Stage | Latency |
|-------|---------|
| Middleware stack (4 layers) | 760 ns |
| Router dispatch (static) | 114 ns |
| Path extraction | 179 ns |
| JSON response serialize (small) | 92 ns |
| H1 bridge (in + out) | 292 ns |
| **Total pipeline** | **1.437 us** |

### Theoretical Throughput

```
Plaintext-like: 1 / 1.437us = ~696,000 req/s/core
With JSON body:  1 / 1.764us = ~567,000 req/s/core
```

Competitive with Actix-web (300-500K req/s/core on TechEmpower plaintext).

### Key Optimizations

| Optimization | Speedup |
|-------------|---------|
| Multipart memchr + zero-copy | 52x |
| SSE pre-alloc + direct write | 7.4x |
| ETag 4-lane FNV-1a | 5.5x |
| Middleware FnOnce + Arc removal | 2x |
| Router zero-alloc static | 2x |
| simd-json (opt-in) | 1.3-2x |
| Prometheus sanitize-once | 2.5x |

[PENDING: Pipeline Benchmark Results — full end-to-end measurement from Task #4]

---

## File Index

```
src-ava/ava-web/
├── src/
│   ├── lib.rs              # Crate root, re-exports
│   ├── server.rs           # HttpServer, H1 bridge
│   ├── router.rs           # Router, matchit dispatch
│   ├── handler.rs          # Handler trait, arity macros
│   ├── extractor.rs        # Request, extractors
│   ├── middleware.rs        # Middleware trait, built-ins
│   ├── response.rs         # Response, IntoResponse
│   ├── state.rs            # ActorHandler, ActorPool
│   ├── error.rs            # AppError, ProblemDetails
│   ├── ws.rs               # WebSocket
│   ├── sse.rs              # Server-Sent Events
│   ├── metrics.rs          # Prometheus metrics
│   ├── multipart.rs        # Multipart parser
│   ├── static_files.rs     # Static file serving
│   ├── openapi.rs          # OpenAPI 3.1
│   ├── testing.rs          # TestServer
│   ├── lab.rs              # Lab testing harness (feature-gated: lab)
│   ├── h2.rs               # HTTP/2 (feature-gated)
│   └── h3.rs               # HTTP/3 (feature-gated)
├── benches/                # Criterion benchmarks
├── proofs/
│   ├── lean/               # Lean 4 proofs (28 theorems)
│   │   ├── AvaWeb.lean
│   │   └── AvaWeb/
│   │       ├── Types.lean
│   │       ├── Middleware/Monoid.lean
│   │       ├── Router/Trie.lean
│   │       └── Extractors/Safety.lean
│   └── tlaplus/            # TLA+ specs (5 specs, 194K states)
│       ├── HTTPTypes.tla
│       ├── HTTPServer.tla
│       ├── HTTPConnection.tla
│       ├── MiddlewareChain.tla
│       ├── RouterDispatch.tla
│       └── ExtractorPipeline.tla
├── docs/
│   ├── ARCHITECTURE.md     # This file
│   ├── DESIGN_DECISIONS.md # ADR decision log
│   └── EXPERIMENTAL_FEATURES.md  # asupersync module survey
└── PERFORMANCE.md          # Optimization catalog + benchmarks
```
