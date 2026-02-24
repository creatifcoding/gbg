# ava-web Design Decisions

Architecture Decision Records (ADRs) for ava-web. Each records **context**, **decision**, **consequences**, and **status**.

---

## ADR-001: GenServer Actors Instead of Stateless Handlers

**Status**: Accepted
**Date**: 2026-02-20
**Context**: `src/state.rs`, `src/handler.rs`

### Context

All mainstream Rust web frameworks (axum, actix-web, warp, rocket) use stateless function handlers as the primary abstraction. State is shared via `Arc<T>` or `Arc<Mutex<T>>` injected into the handler's closure environment. This works for read-heavy workloads but creates three problems:

1. **Mutex contention**: Under high concurrency, `Mutex<T>` becomes a serialization bottleneck. Every request that mutates shared state takes and releases the same lock.
2. **No isolation**: All requests share the same `Arc<Mutex<T>>`, so a corrupted state affects every subsequent request.
3. **No supervision**: When a handler panics, the `JoinHandle` completes with an error but there's no automatic recovery — no restart, no fallback state, no supervisor notification.

### Decision

Implement `ActorHandler` as a first-class handler type alongside stateless `FnHandler`. Actors:
- Own their state across requests via `&self` receiver
- Are pooled via `ActorPool` for round-robin dispatch with independent state per actor
- Bridge to the `Handler` trait via `ActorHandlerWrapper` and `ActorPoolHandler`
- Run on asupersync's GenServer runtime, inheriting supervision, budgeting, and structured concurrency

Stateless handlers remain first-class. The framework doesn't force actors on anyone.

### Consequences

**Positive**:
- Per-actor state isolation without `Arc<Mutex<T>>` for the actor pool pattern
- Lock-free round-robin dispatch via `AtomicUsize`
- Actors compose identically with middleware, routing, and extractors
- Future: asupersync supervision can restart crashed actors with fresh state

**Negative**:
- Two handler types (function vs actor) increases API surface
- Actor handlers require `Pin<Box<dyn Future>>` return — slightly more verbose than bare `async fn`
- Pool sizing is manual (user chooses N actors). No work-stealing yet.

### Alternatives Considered

1. **Arc<Mutex<T>> only** (axum pattern): Rejected. Doesn't provide isolation or supervision.
2. **Actix-web actors**: Rejected. Tightly coupled to actix's own actor runtime. We needed asupersync's executor.
3. **State machine handlers**: Considered but deferred. Would require XState-like DSL integration.

---

## ADR-002: matchit Radix Tree Instead of Custom Router

**Status**: Accepted
**Date**: 2026-02-20
**Context**: `src/router.rs`

### Context

Path-based HTTP routing can be implemented as:
- Linear scan over registered routes: O(n) per request
- HashMap of exact paths: O(1) but no parameterized routes
- Trie (prefix tree): O(k) where k = path depth
- Compressed radix tree: O(k) with better memory layout

### Decision

Use the `matchit` crate (compressed radix tree) for route dispatch. Wrap it in our `Router` struct that adds method dispatch, nesting, middleware, state injection, and fallback handling.

### Consequences

**Positive**:
- O(log n) effective dispatch — 114 ns regardless of route count (10 or 1000)
- Built-in parameter extraction (`{param}` syntax, also supporting `:param` via normalization)
- Battle-tested crate used by axum
- We normalize `:param` → `{param}` at registration time only, not on every dispatch

**Negative**:
- External dependency (matchit)
- Route conflicts are silently resolved (last registration wins) instead of compile-time errors
- Nested router delegation requires `strip_prefix` string operations per nesting level

### Alternatives Considered

1. **Custom trie**: Rejected. matchit is correct, fast, and maintained. NIH would waste engineering time.
2. **regex-based routing** (actix-web): Rejected. Regex compilation is slow and regex matching is slower than radix tree.
3. **HashMap<String, Handler>**: Rejected. No parameterized routes. Static routes only.

---

## ADR-003: Bytes Zero-Copy Pipeline Instead of Vec<u8>

**Status**: Accepted
**Date**: 2026-02-21
**Context**: `src/server.rs:366-436`

### Context

The H1 bridge converts between asupersync's `h1::Request { body: Vec<u8> }` and ava-web's `web::Request { body: Bytes }`. The original implementation used `Bytes::copy_from_slice(&vec)` — an O(n) memcpy on every request. For a 1MB POST body, this is ~300us of pure copying.

### Decision

Take `h1::Request` by value in `convert_h1_request_owned()` and transfer ownership of heap allocations:

- **Body**: `Bytes::from(vec)` — O(1), takes ownership of the Vec's allocation
- **Headers**: `String::make_ascii_lowercase()` in-place, then `Cow::Owned(String)` — no allocation
- **URI**: `String::find('?')` + `truncate()` — split in-place

Provide a borrowing variant `convert_h1_to_web()` for tests and benchmarks that don't need the optimization.

### Consequences

**Positive**:
- 1MB body: 0 bytes copied (was O(n) memcpy)
- Headers: 0 allocations (was N String::clone)
- URI: 0 allocations (was String::to_string)
- Total bridge overhead: 292 ns for request + response (was >300us for 1MB body alone)

**Negative**:
- Requires h1::Request fields to be moved (owned), not borrowed. Two bridge functions to maintain.
- Response path still requires `Vec::from(Bytes)` which may copy when Bytes is shared

### Alternatives Considered

1. **Shared Bytes throughout**: Would require asupersync's h1::Request to use `Bytes` natively. Possible but would require upstream changes.
2. **io_uring + registered buffers**: Maximum zero-copy but requires kernel 5.6+ and custom allocator. Deferred.

---

## ADR-004: FnOnce Next Instead of Fn

**Status**: Accepted
**Date**: 2026-02-21
**Context**: `src/middleware.rs:36-64`

### Context

The original middleware `Next` inner type was `Box<dyn Fn(Request) -> Pin<Box<...>>>`. This required:
1. The closure to be reusable (`Fn` not `FnOnce`)
2. `Arc<Mutex<Option<Next>>>` for ownership sharing
3. Atomic refcounting on every middleware layer invocation

But a middleware chain invokes `next` **exactly once** per request. The `Fn` constraint was unnecessarily restrictive.

### Decision

Change `Next` to an enum:

```rust
enum NextInner<'a> {
    Boxed(Box<dyn FnOnce(Request) -> Pin<Box<...>> + Send + Sync + 'a>),
    FnPtr(fn(Request) -> Pin<Box<...>>),
}
```

- `FnOnce` enables move semantics — the closure is consumed, no Arc needed
- `FnPtr` variant provides zero-allocation path for terminal dispatch
- `Next` is consumed via `self` (not `&self`) in `run(self, req)`

### Consequences

**Positive**:
- **42-51% latency reduction** across all middleware depths (5-20 layers)
- Per-layer cost: 36 ns → 23 ns (36% reduction)
- Eliminated `Arc<Mutex>` entirely from the middleware stack
- Compiler can optimize FnOnce closures more aggressively (no reusability requirement)

**Negative**:
- `Next` is now consumed on use — middleware that wants to retry must reconstruct the chain
- `FnPtr` variant is slightly unusual in the API surface

### Evidence

| Layers | Before (Fn) | After (FnOnce) | Reduction |
|--------|-------------|-----------------|-----------|
| 5 | 325 ns | 189 ns | 42% |
| 10 | 666 ns | 346 ns | 48% |
| 20 | 1303 ns | 641 ns | 51% |

---

## ADR-005: 4-Lane FNV-1a Instead of xxhash

**Status**: Accepted
**Date**: 2026-02-21
**Context**: `src/static_files.rs`

### Context

ETag generation for static files requires hashing file contents. The original implementation used `std::collections::hash_map::DefaultHasher` (SipHash-1-3), which is cryptographically strong but slow for large inputs (~332us for 1MB).

ETag is a **cache validator**, not a security primitive. It doesn't need collision resistance — only reasonable distribution to detect file changes.

### Decision

Implement a 4-lane parallel FNV-1a hasher:
- 4 independent u64 FNV-1a accumulators
- Process 32 bytes per iteration (8 bytes per lane)
- Breaks the multiply dependency chain for CPU instruction-level parallelism
- ~60 lines of code, zero external dependencies
- Final XOR-fold of 4 lanes into single u64

### Consequences

**Positive**:
- **5.5x speedup** (1MB: 332us → 60us)
- Zero new dependencies
- ~17 GB/s throughput estimate on modern CPUs
- Exceeds the 100us target for 1MB files

**Negative**:
- FNV-1a has weaker distribution than SipHash or xxh3
- Not suitable for hash tables (use SipHash for HashMap keys)
- Manual SIMD-style parallelism, though not actual SIMD intrinsics

### Alternatives Considered

1. **xxhash-rust (xxh3)**: Would be ~30 GB/s but adds a crate dependency. This is the upgrade path if static file serving becomes the bottleneck.
2. **SHA-256 / BLAKE3**: Overkill for cache validators. BLAKE3 would be ~6 GB/s but adds dependency + is still slower than needed.
3. **File mtime only**: Fast but doesn't detect content changes when mtime is preserved (e.g., `cp -p`).

---

## ADR-006: Feature-Gated simd-json

**Status**: Accepted
**Date**: 2026-02-21
**Context**: `src/extractor.rs:511-522`, `src/response.rs:254-262`

### Context

JSON deserialization is often the dominant cost in API handler pipelines. simd-json uses SIMD instructions (SSE4.2/AVX2/NEON) for 1.3-2x faster parsing than serde_json. However, it requires specific CPU features that aren't available on all hardware.

### Decision

Feature-gate simd-json as an opt-in:

```toml
[features]
simd-json = ["dep:simd-json"]
```

The `json_deserialize()` and `json_serialize()` functions are implemented twice — one behind `#[cfg(feature = "simd-json")]`, one behind `#[cfg(not(...))]`. The API surface is identical regardless of which implementation is active.

### Consequences

**Positive**:
- **1.3-2x JSON speedup** when opted in
- Default path (`serde_json`) works everywhere, including WASM and older x86 CPUs
- Zero runtime cost when feature is disabled
- Drop-in — no API changes needed

**Negative**:
- simd-json requires `mut` buffer for in-place string unescaping (O(n) copy)
- Two code paths to maintain (though they're identical in signature)
- Feature interaction: simd-json's `Value` type is not `serde_json::Value` — users must be aware when using `Value` directly

### Benchmark Data

| Payload | serde_json | simd-json | Speedup |
|---------|-----------|-----------|---------|
| 24B | 436 ns | 327 ns | 1.33x |
| 1KB | 15.5 us | 8.13 us | 1.91x |
| 100KB | 1.134 ms | 602 us | 1.88x |

---

## ADR-007: ActorPool Round-Robin vs Work-Stealing

**Status**: Accepted (Round-Robin), Work-Stealing Deferred
**Date**: 2026-02-21
**Context**: `src/state.rs:122-158`

### Context

`ActorPool` distributes incoming requests across N actor instances. Two dispatch strategies were considered:

1. **Round-robin**: Lock-free `AtomicUsize` counter, modulo pool size. O(1), predictable, but can create hot spots if request processing times vary.
2. **Work-stealing**: Idle actors steal work from busy actors' queues. Better load balancing but requires per-actor work queues and more complex synchronization.

### Decision

Implement round-robin first. It's simple, correct, and lock-free:

```rust
pub fn next(&self) -> &Arc<A> {
    let idx = self.counter.fetch_add(1, Ordering::Relaxed) % self.actors.len();
    &self.actors[idx]
}
```

### Consequences

**Positive**:
- Zero contention: `fetch_add(Relaxed)` is a single atomic operation
- Predictable dispatch: actor N always gets request N (mod pool_size)
- Simple to reason about for testing and debugging
- State isolation is guaranteed — each actor has independent state

**Negative**:
- **No load balancing**: If actor 2 is processing a slow request, requests keep dispatching to it anyway
- **Pool sizing is manual**: User must choose N upfront. No auto-scaling.

### Future Work

Work-stealing is planned as `ActorPoolWithStealing`. Requires:
- Per-actor `crossbeam-deque` or similar work queue
- Idle detection via atomic flag
- Steal policy (random victim vs neighbor)

asupersync's `sync/pool.rs` (cancel-safe pool with obligation tracking) is a candidate foundation — see `docs/EXPERIMENTAL_FEATURES.md`, adoption proposal #3.

---

## ADR-008: Experimental Features Adoption

**Status**: Proposed
**Date**: 2026-02-21
**Context**: `docs/EXPERIMENTAL_FEATURES.md`

### Context

asupersync's experimental modules offer capabilities beyond any existing Rust HTTP framework: session types, CALM-optimized sagas, macaroon capabilities, chaos testing, and more. A comprehensive survey identified 15 modules across 7 directories. See `docs/EXPERIMENTAL_FEATURES.md` for the full analysis.

### Decision

Adopt the top 3 modules in priority order:

#### Phase 1: Macaroon-Authorized Middleware (cx/macaroon)

**Feasibility**: Easy | **Impact**: High

Replace extension-based request context with HMAC-SHA256 chained bearer tokens. Macaroons support delegation through caveat attenuation — a parent token can be restricted (time-limited, region-scoped, rate-limited) without re-signing.

```rust
// Middleware that validates and attenuates macaroons
struct MacaroonAuth { root_key: [u8; 32] }
impl Middleware for MacaroonAuth { ... }
```

#### Phase 2: Lab Runtime + Scenario Testing (lab/)

**Feasibility**: Easy | **Impact**: High

Integrate chaos testing (deterministic fault injection), deterministic fuzzing (seed-driven scheduling), and conformal prediction (distribution-free test oracles) into the CI pipeline. YAML-based scenario files compose network presets, fault schedules, and assertion oracles.

#### Phase 3: Session-Typed Handler Protocols (obligation/session_types + choreography)

**Feasibility**: Medium | **Impact**: Revolutionary

Enforce handler protocol correctness at compile time using typestate `Chan<R, S>` channels. A WebSocket session that must send a greeting before receiving messages would fail to compile if the greeting step is skipped.

### Consequences

**Positive**:
- Macaroons: Delegatable authorization without centralized token store
- Lab: Catches concurrency bugs that unit tests miss
- Session types: Eliminates an entire class of protocol violation bugs at compile time

**Negative**:
- Macaroons: Requires HMAC key management infrastructure
- Lab: CI pipeline complexity increases
- Session types: Steep learning curve, limited Rust ecosystem precedent

### Adoption Roadmap

1. **Week 1-2**: Macaroon middleware integration
2. **Week 3-4**: Lab runtime CI pipeline
3. **Week 5-8**: Session-typed handler protocols (research spike first)
4. **Week 9-10**: Chaos testing for existing middleware + actor pool
5. **Week 11-12**: Performance validation and documentation

See `docs/EXPERIMENTAL_FEATURES.md` for detailed code sketches and integration proposals.

---

## ADR-009: Vec-Backed HeaderMap Instead of HashMap

**Status**: Accepted
**Date**: 2026-02-20
**Context**: `src/extractor.rs:237-347`

### Context

HTTP requests typically have 5-20 headers. Two storage strategies:

1. **HashMap<String, String>**: O(1) lookup but high constant factor (hashing, bucket allocation, cache-unfriendly)
2. **Vec<(K, V)>**: O(n) linear scan but cache-friendly and low constant factor for small n

### Decision

Use `Vec<(Cow<'static, str>, Cow<'static, str>)>`:
- Linear scan is faster than HashMap for n < ~20 headers (cache locality wins)
- `Cow<'static, str>` avoids allocation for static header names/values (the common case in middleware)
- Case-sensitive matching — callers normalize to lowercase at ingestion

### Consequences

**Positive**:
- Faster than HashMap for typical request/response header counts
- Zero-allocation for middleware that adds static headers (`"content-type"`, `"x-request-id"`)
- Simple implementation (no hash function, no bucket resizing)
- `IntoIterator` yields `(String, String)` for protocol conversion

**Negative**:
- O(n) lookup degrades for large header counts (>50)
- Case-sensitive: requires explicit lowercasing at ingestion (done in H1 bridge)
- No multi-value support (no `Vec<String>` per key)

---

## ADR-010: Vec-Backed Extensions Instead of HashMap

**Status**: Accepted
**Date**: 2026-02-20
**Context**: `src/extractor.rs:160-225`

### Context

Request extensions store typed values (state, request ID, connect info) keyed by `TypeId`. Similar to `http::Extensions` in the http crate.

### Decision

Use `Vec<(TypeId, Box<dyn Any + Send + Sync>)>` with linear scan:
- Typical requests have < 15 extension types
- TypeId comparison is a u128 equality check (fast)
- Linear scan over a small Vec is cache-friendly

### Consequences

**Positive**:
- Faster than HashMap for typical extension counts
- No hashing overhead
- `swap_remove` for O(1) removal (order doesn't matter for TypeId lookup)

**Negative**:
- O(n) lookup. Would need HashMap upgrade if extensions count grows past ~20-30.
- Box<dyn Any> requires dynamic downcasting

---

## ADR-011: RFC 9457 Problem Details for Error Responses

**Status**: Accepted
**Date**: 2026-02-20
**Context**: `src/error.rs`, `src/response.rs:330-384`

### Context

Error responses need a consistent, machine-readable format. Options:
1. Plain text error messages
2. Ad-hoc JSON error objects
3. RFC 9457 Problem Details (`application/problem+json`)

### Decision

Implement `ProblemDetails` struct with `type`, `title`, `status`, `detail`, and `instance` fields. `AppError` variants automatically convert to Problem Details via `IntoResponse`.

### Consequences

**Positive**:
- Standards-compliant error format recognized by API clients
- Machine-parseable: clients can switch on `status` and `type`
- Extensible: additional fields can be added via serde
- Content-Type: `application/problem+json` signals structured error

**Negative**:
- Slightly heavier than plain text (JSON serialization overhead)
- Requires serde for `AppError` → `ProblemDetails` → JSON conversion

---

## Decision Index

| ADR | Title | Status |
|-----|-------|--------|
| 001 | GenServer Actors Instead of Stateless Handlers | Accepted |
| 002 | matchit Radix Tree Instead of Custom Router | Accepted |
| 003 | Bytes Zero-Copy Pipeline Instead of Vec<u8> | Accepted |
| 004 | FnOnce Next Instead of Fn | Accepted |
| 005 | 4-Lane FNV-1a Instead of xxhash | Accepted |
| 006 | Feature-Gated simd-json | Accepted |
| 007 | ActorPool Round-Robin vs Work-Stealing | Accepted (RR), WS Deferred |
| 008 | Experimental Features Adoption | Proposed |
| 009 | Vec-Backed HeaderMap Instead of HashMap | Accepted |
| 010 | Vec-Backed Extensions Instead of HashMap | Accepted |
| 011 | RFC 9457 Problem Details for Error Responses | Accepted |
