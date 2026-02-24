# Experimental Features Survey: asupersync for ava-web

> Deep-dive into asupersync's advanced modules, adoption feasibility, and integration proposals for ava-web.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Module: obligation/ -- Session Types, Sagas, Graded Monads](#module-obligation)
3. [Module: lab/ -- Chaos Engineering, Testing, Oracles](#module-lab)
4. [Module: cx/ -- Capability-Based Context & Macaroons](#module-cx)
5. [Module: sync/ -- Pools, Semaphores, Barriers](#module-sync)
6. [Module: distributed/ -- Consistent Hashing, Recovery](#module-distributed)
7. [Module: raptorq/ -- Forward Error Correction](#module-raptorq)
8. [Module: stream/ -- Full Combinator Library](#module-stream)
9. [Top 3 Adoption Proposals](#top-3-adoption-proposals)
10. [Adoption Roadmap](#adoption-roadmap)
11. [Decision Log](#decision-log)

---

## Executive Summary

asupersync contains a rich set of experimental modules that go far beyond traditional async runtimes. These modules encode **formal methods from programming language theory** (session types, graded monads, CALM theorem, choreographic programming, separation logic) directly into Rust's type system. For ava-web, adopting the right subset of these provides guarantees that no other Rust HTTP framework can match.

**Top 3 picks for immediate adoption:**

| Rank | Module | Impact | Why |
|------|--------|--------|-----|
| 1 | **cx/ (Macaroon Capabilities)** | Revolutionary | Cryptographic capability attenuation for middleware auth -- replaces extension-based context with unforgeable, delegatable tokens |
| 2 | **lab/ (Chaos + Scenario Testing)** | High | Deterministic fault injection + scenario-based integration testing for ava-web handlers |
| 3 | **obligation/session_types + choreography** | Revolutionary | Compile-time protocol enforcement for request/response handlers -- invalid handler sequences become type errors |

---

## Module: obligation/ {#module-obligation}

### Overview

The obligation module implements six complementary approaches to obligation safety:

1. **Session types** (`session_types.rs`) -- Compile-time protocol enforcement via typestate encoding
2. **Saga execution** (`saga.rs`) -- CALM-theorem-optimized saga patterns with lattice-based monotonicity analysis
3. **Graded types** (`graded.rs`) -- Resource-annotated obligation tracking with drop bombs
4. **Choreography** (`choreography/`) -- Global protocol DSL with per-participant projection
5. **Separation logic** (`separation_logic.rs`) -- Formal frame rule for obligation isolation
6. **Dialectica interpretation** (`dialectica.rs`) -- Two-phase effects as Dialectica morphisms

### Sub-module: Session Types (`session_types.rs`)

**What it does:** Encodes binary communication protocols as zero-sized Rust types using the typestate pattern. A `Chan<Role, S>` endpoint is parameterized by participant role and current session type. Each transition method **consumes** `self` and returns the channel in the next state, making out-of-order operations a compile error. Channels have a drop bomb -- dropping mid-protocol panics.

**Key types:**
- `Chan<R, S>` -- Typestate channel endpoint (`#[must_use]`, panics on drop if not at `End`)
- `Send<T, S>` / `Recv<T, S>` -- Send/receive markers with continuation
- `Select<A, B>` / `Offer<A, B>` -- Choice (local/remote)
- `End` -- Protocol termination, produces `SessionProof`
- `Rec<F>` / `Var` -- Recursive protocol unfolding

**Pre-built protocols:**
- `send_permit::new_session<T>()` -- Two-phase send: Reserve -> {Send(T) | Abort}
- `lease::new_session()` -- Resource lifecycle: Acquire -> loop{Renew | Release}
- `two_phase::new_session()` -- Reserve -> {Commit | Abort}
- `delegation::new_delegation()` -- Channel delegation for work-stealing

**Adoption feasibility:** Medium
**Expected impact:** Revolutionary

**Integration sketch for ava-web:**

```rust
// Define handler protocol: Request -> {Response | Error}
type HandlerSession = Send<HttpRequest, Select<
    Send<HttpResponse, End>,    // Success path
    Send<ErrorResponse, End>,   // Error path
>>;

// Middleware composes as protocol prefix:
type AuthMiddleware<S> = Recv<HttpRequest, Send<AuthToken, S>>;

// Handler MUST produce a response -- dropping mid-protocol is a type error
fn typed_handler(chan: Chan<Initiator, HandlerSession>) -> SessionProof {
    let chan = chan.send(request);
    let chan = chan.select_left();  // Success
    let chan = chan.send(response);
    chan.close()  // Returns SessionProof -- proves protocol completed
}
```

**Why it matters for ava-web:** Every handler is guaranteed at compile time to produce exactly one response. Middleware that forgets to call `next()` is a **type error**. Response streaming protocols can be encoded as recursive session types. This is the kind of guarantee that makes ava-web fundamentally safer than any framework using `-> impl IntoResponse`.

---

### Sub-module: CALM-Optimized Sagas (`saga.rs`)

**What it does:** Applies the CALM theorem (Consistency As Logical Monotonicity -- Hellerstein & Alvaro 2020) to saga execution. Consecutive monotone operations are batched into coordination-free groups that can execute in any order with results merged via lattice join. Non-monotone operations trigger coordination barriers.

**Key types:**
- `SagaOpKind` -- 16 operation kinds, each classified as Monotone or NonMonotone
- `SagaPlan` / `SagaExecutionPlan` -- Step sequences partitioned into `CoordinationFree` and `Coordinated` batches
- `MonotoneSagaExecutor` -- Runs batches with post-hoc monotonicity validation
- `Lattice` trait -- Join-semilattice for merging batch results (commutativity, associativity, idempotence verified in tests)
- `StepExecutor` trait -- Provides business logic per step

**Order independence verified:** Tests generate all 24 permutations of 4 steps and verify identical merged state across orderings.

**Adoption feasibility:** Medium
**Expected impact:** High

**Integration sketch:** Saga patterns are directly applicable to multi-step request processing (e.g., validate -> authorize -> execute -> respond). Monotone steps (logging, metrics, cache writes) execute without coordination barriers, while non-monotone steps (database writes, external API calls) get proper barriers.

---

### Sub-module: Graded Obligations (`graded.rs`)

**What it does:** Approximates linear types in Rust's affine type system. `GradedObligation` and `ObligationToken<K>` are `#[must_use]` types that **panic on drop** if not resolved via `commit()` or `abort()`. The `GradedScope` tracks reservation/resolution counts and verifies zero-leak at scope exit.

**Key types:**
- `GradedObligation` -- Runtime-checked obligation with drop bomb
- `ObligationToken<K: TokenKind>` -- Type-level obligation with sealed trait for anti-forgery
- `GradedScope` -- Scope that tracks outstanding obligations (panics if dropped with leaks)
- `ResolvedProof` / `CommittedProof<K>` / `AbortedProof<K>` -- Zero-cost proof tokens
- `RawObligation` -- Escape hatch for FFI/tests

**Sealed trait pattern:** `TokenKind` is sealed -- external crates cannot implement it, preventing obligation forgery.

**Adoption feasibility:** Easy
**Expected impact:** High

**Integration sketch:**

```rust
// Connection pool uses graded obligations
fn acquire_connection(pool: &Pool) -> GradedObligation {
    GradedObligation::reserve(ObligationKind::IoOp, "db_connection")
}

// Handler MUST return the connection -- forgetting panics
async fn handle(req: Request, pool: &Pool) -> Response {
    let conn_obligation = acquire_connection(pool);
    let result = query(&conn_obligation).await;
    let _proof = conn_obligation.resolve(Resolution::Commit);
    // _proof is a ResolvedProof -- evidence the connection was returned
    Response::ok(result)
}
```

---

### Sub-module: Choreography (`choreography/`)

**What it does:** Implements choreographic programming (Montesi 2023) as a Rust DSL. A `GlobalProtocol` describes interactions between multiple participants as a single source of truth. The projection compiler generates per-participant session-typed code. Validation enforces the **knowledge-of-choice** condition (Honda-Yoshida-Carbone 2008) for deadlock freedom.

**Key types:**
- `GlobalProtocol` -- Protocol definition with builder pattern
- `Interaction` -- AST for communication (`Comm`, `Choice`, `Loop`, `Compensation`, `End`)
- `Participant` -- Named participant with typed role
- `MessageType` -- Message type with optional type parameters
- Validation: `protocol.validate()` returns errors, `protocol.is_deadlock_free()` checks KoC condition
- CALM integration: Each `Comm` carries optional monotonicity annotation

**Adoption feasibility:** Hard (requires code generation pipeline)
**Expected impact:** Revolutionary

**Integration sketch:**

```rust
let protocol = GlobalProtocol::builder("http_handler")
    .participant("client", "http-client")
    .participant("server", "http-server")
    .participant("db", "database")
    .interaction(
        Interaction::comm("client", "request", "HttpRequest", "server")
            .then(Interaction::comm("server", "query", "DbQuery", "db")
                .then(Interaction::comm("db", "result", "DbResult", "server")
                    .then(Interaction::comm("server", "response", "HttpResponse", "client")
                        .then(Interaction::end()))))
    )
    .build();

// Validates deadlock freedom and knowledge-of-choice
assert!(protocol.validate().is_empty());
```

---

## Module: lab/ {#module-lab}

### Overview

The lab module is a complete deterministic testing framework with the following sub-modules:

| Sub-module | Purpose |
|------------|---------|
| `chaos.rs` | Deterministic fault injection (cancellation, delay, I/O errors, wakeup storms) |
| `conformal.rs` | Distribution-free conformal prediction for test metric calibration |
| `fuzz.rs` | Seed-driven deterministic fuzzing with automatic seed minimization |
| `scenario.rs` | YAML-based scenario format with composable test definitions |
| `scenario_runner.rs` | Executes scenarios with network simulation and fault injection |
| `virtual_time_wheel.rs` | Virtual timer wheel for deterministic time testing |
| `oracle/` | Invariant verification (task leaks, obligation leaks, region quiescence) |
| `network/` | Network simulation with presets (LAN, WAN, satellite, lossy) |
| `snapshot_restore.rs` | Snapshot/restore for runtime state |
| `explorer.rs` | DPOR-style schedule exploration |

### Sub-module: Chaos Testing (`chaos.rs`)

**What it does:** Injects faults deterministically into the lab runtime using a seeded RNG. Same seed = same chaos sequence = reproducible failures. Supports five chaos types: cancellation at poll points, delays, I/O errors, wakeup storms, and budget exhaustion.

**Key types:**
- `ChaosConfig` -- Probability configuration per fault type
- Presets: `ChaosConfig::off()`, `ChaosConfig::light()` (1% cancel, 5% delay, 2% I/O), `ChaosConfig::heavy()` (10% cancel, 20% delay, 15% I/O)
- `ChaosStats` -- Injection statistics (decision points, delays, cancellations, injection rate)

**Adoption feasibility:** Easy
**Expected impact:** High

**Integration sketch:**

```rust
// In ava-web integration tests:
let config = LabConfig::new(42).with_light_chaos();
let mut runtime = LabRuntime::new(config);

// Register ava-web handler as an actor
let handler = AvaHandler::new(router);
let (task_id, _) = runtime.state.create_task(
    region, Budget::INFINITE,
    async move { handler.handle(test_request).await }
).unwrap();

runtime.run_until_quiescent();
let stats = runtime.chaos_stats();
assert!(stats.injection_rate() > 0.0, "Chaos was actually injected");
```

### Sub-module: Conformal Testing (`conformal.rs`)

**What it does:** Applies split conformal prediction (Vovk et al. 2005) to test oracle metrics, providing distribution-free coverage guarantees. Given a target miscoverage rate alpha (e.g., 0.05 for 95%), the conformal prediction set satisfies `P(Y in C(X)) >= 1 - alpha` for **any** joint distribution -- no parametric assumptions needed.

**Key types:**
- `ConformalConfig` -- Alpha (miscoverage rate) and minimum calibration samples
- `ConformalCalibrator` -- Accumulates conformity scores and computes prediction sets
- `ConformityScore` -- Nonconformity value per oracle observation
- `PredictionSet` / `CoverageTracker` -- Coverage tracking

**Adoption feasibility:** Medium
**Expected impact:** Medium

### Sub-module: Deterministic Fuzzing (`fuzz.rs`)

**What it does:** Seed-driven exploration that systematically fuzzes scheduling decisions. When a violation is found, the seed is minimized to produce a minimal reproducer.

**Key types:**
- `FuzzConfig` -- Base seed, iterations, max steps, worker count, minimization control
- `FuzzHarness` -- Runs test closures under many seeds, checks oracle invariants
- `FuzzFinding` -- Seed + steps + violations + minimized seed
- `FuzzReport` -- Campaign results with violation counts and unique schedule certificates

**Adoption feasibility:** Easy
**Expected impact:** High

**Integration sketch:**

```rust
let harness = FuzzHarness::new(FuzzConfig::new(0, 1000).worker_count(4));
let report = harness.run(|runtime| {
    // Set up ava-web handler under test
    let router = Router::new().route("/api/data", handler);
    let actor = ActorPoolHandler::new(router);
    // ... exercise the handler
});
assert!(!report.has_findings(), "Found {} violations", report.findings.len());
```

### Sub-module: Scenario Testing (`scenario.rs`)

**What it does:** YAML-based test scenario definitions with composable fault schedules, network presets, named participants, and oracle configurations. Scenarios are deterministic (same YAML + same binary = bit-identical execution).

**Key schema fields:**
- `lab` -- seed, worker_count, trace_capacity, max_steps
- `chaos` -- preset (off/light/heavy/custom)
- `network` -- preset (ideal/local/lan/wan/satellite/congested/lossy)
- `faults` -- Timed fault injection events (partition, heal, etc.)
- `participants` -- Named actors with typed roles
- `oracles` -- Which invariant oracles to enable
- `cancellation` -- Random sample cancellation injection strategy
- `include` -- Composable scenario includes

**Adoption feasibility:** Easy
**Expected impact:** High

### Sub-module: Virtual Time Wheel (`virtual_time_wheel.rs`)

**What it does:** Timer wheel operating on virtual ticks rather than wall-clock time. Enables deterministic timeout testing. Uses a min-heap with timer IDs for deterministic expiration ordering.

**Key types:**
- `VirtualTimerWheel` -- Min-heap-based timer wheel
- `VirtualTimerHandle` -- Handle for timer cancellation
- `ExpiredTimer` -- Expired timer info with waker

**Adoption feasibility:** Easy (already integrated via lab runtime)
**Expected impact:** Medium

---

## Module: cx/ {#module-cx}

### Overview

The capability context (`Cx`) is asupersync's security foundation. All effects flow through explicit capability tokens -- no ambient authority exists.

### Sub-module: Type-Level Capabilities (`cap.rs`)

**What it does:** Encodes capabilities as a fixed-width boolean vector `[SPAWN, TIME, RANDOM, IO, REMOTE]` using const generics. `CapSet` is a zero-sized type -- capabilities have zero runtime cost. The subset relation `SubsetOf` uses sealed traits with bit-level ordering to prevent capability widening at compile time.

**Key types:**
- `CapSet<SPAWN, TIME, RANDOM, IO, REMOTE>` -- ZST capability set
- `All = CapSet<true, true, true, true, true>` -- Full capabilities
- `None = CapSet<false, false, false, false, false>` -- No capabilities
- Marker traits: `HasSpawn`, `HasTime`, `HasRandom`, `HasIo`, `HasRemote` (all sealed)
- `SubsetOf<Super>` -- Compile-time subset check, prevents widening

**Anti-forgery:** `Sealed` supertrait prevents external crates from implementing capability markers. Attempting to forge a capability is a compile error (verified via `compile_fail` doctests).

**Adoption feasibility:** Easy
**Expected impact:** High

**Integration sketch:**

```rust
// ava-web handler context with restricted capabilities
type WebCaps = CapSet<false, true, false, true, false>; // TIME + IO only

fn handle_request(cx: &Cx<WebCaps>, req: Request) -> Response {
    // cx.spawn() -- COMPILE ERROR: WebCaps doesn't have HasSpawn
    // cx.timer() -- OK: WebCaps has HasTime
    // cx.io()    -- OK: WebCaps has HasIo
}

// Middleware can narrow but never widen:
fn rate_limit<C: SubsetOf<WebCaps>>(cx: &Cx<C>) { /* ... */ }
```

### Sub-module: Macaroon Capabilities (`macaroon.rs`)

**What it does:** Implements Macaroon bearer tokens (Birgisson et al. NDSS 2014) with chained HMAC-SHA256 caveats for decentralized capability attenuation. Any holder can ADD caveats (restrictions) without contacting the issuer, but nobody can REMOVE caveats without the root key.

**Key types:**
- `MacaroonToken` -- Bearer token with identifier, location, HMAC signature, and caveat chain
- `CaveatPredicate` -- Predicate DSL: `TimeBefore(ms)`, `TimeAfter(ms)`, `RegionScope(id)`, `TaskScope(id)`, `MaxUses(n)`, `ResourceScope(glob)`, `RateLimit{max_count, window_secs}`, `Custom(k, v)`
- `Caveat` -- First-party (verified by target) or third-party (delegated to external authority with discharge macaroons)
- `MacaroonSignature` -- 32-byte HMAC signature with constant-time equality
- `VerificationContext` -- Context for caveat verification (current time, region, task, use count)
- `VerificationError` -- Detailed error types for failed verification

**HMAC chain construction:**
```text
sig_0 = HMAC(root_key, identifier)
sig_i = HMAC(sig_{i-1}, caveat_i.predicate_bytes())
token.signature = sig_n
```

**Serialization format:** Binary, little-endian, with version byte and tagged predicate encoding.

**Adoption feasibility:** Medium
**Expected impact:** Revolutionary

**Integration sketch:**

```rust
// Issue a capability token for a specific API endpoint
let root_key = AuthKey::random();
let token = MacaroonToken::new("api:users:read", "ava-web/auth", &root_key);

// Attenuate: restrict to specific user, with rate limit and expiry
let restricted = token
    .add_caveat(CaveatPredicate::ResourceScope("users/123/*".into()))
    .add_caveat(CaveatPredicate::RateLimit { max_count: 100, window_secs: 60 })
    .add_caveat(CaveatPredicate::TimeBefore(now_ms + 3600_000));

// Verify in middleware
let ctx = VerificationContext {
    current_time_ms: now_ms,
    region_id: Some(region),
    task_id: Some(task),
    use_count: 42,
    window_use_count: Some(5),
    resource_path: Some("users/123/profile".into()),
};
match restricted.verify(&root_key, &ctx) {
    Ok(proof) => { /* proceed */ },
    Err(VerificationError::CaveatFailed { index, caveat, reason }) => {
        return Response::forbidden(reason);
    },
    Err(VerificationError::SignatureMismatch) => {
        return Response::unauthorized("invalid token");
    },
}
```

**Why this is revolutionary for ava-web:** Traditional middleware uses extension-based request context (`req.extensions().get::<AuthToken>()`) which is untyped and unforgeable only by convention. Macaroon-based middleware provides:
1. **Cryptographic unforgery** -- Tokens cannot be forged without the root key
2. **Decentralized attenuation** -- Any middleware can add restrictions without issuer contact
3. **Rich predicate DSL** -- Time bounds, resource scopes, rate limits, task scoping
4. **Third-party caveats** -- Delegate authorization decisions to external services
5. **Evidence logging** -- All verification events logged for audit

### Sub-module: Scope (`scope.rs`)

**What it does:** Provides the API for spawning work within a region, with clear execution tier separation (Fiber Tier for `!Send`, Task Tier for `Send`). Includes task combinators: `join`, `race`, `hedge` (hedged request pattern), `race_all`, `join_all`. The `spawn_local` method enables `Rc`/`RefCell` usage on the fiber tier.

**Key functions:**
- `scope.spawn()` -- Task Tier (Send + 'static)
- `scope.spawn_local()` -- Fiber Tier (!Send OK, thread-pinned)
- `scope.spawn_blocking()` -- Blocking thread pool
- `scope.hedge(delay, primary, backup)` -- Hedged request pattern
- `scope.defer_sync()` / `scope.defer_async()` -- Region finalizers

**Adoption feasibility:** Already integrated via GenServer
**Expected impact:** High

---

## Module: sync/ {#module-sync}

### Overview

Cancel-safe synchronization primitives with obligation-based contracts.

### Sub-module: Pool (`pool.rs`)

**What it does:** Generic resource pooling with obligation-based return semantics. `PooledResource<T>` has a `Drop` impl that returns the resource to the pool, preventing leaks even under cancellation. Supports `discard()` for broken resources.

**Key types:**
- `Pool` trait -- `acquire(cx)`, `try_acquire()`, `stats()`, `close()`
- `GenericPool<T>` -- Factory-based pool with config (min/max size, timeouts, lifetimes)
- `PooledResource<T>` -- RAII guard with `return_to_pool()` and `discard()`
- `PoolConfig` -- min_size (1), max_size (10), acquire_timeout (30s), idle_timeout (600s), max_lifetime (3600s)
- `PoolStats` -- active, idle, total, waiters

**Cancel safety at every phase:**
1. Cancellation during wait -- waiter removed from queue, no leak
2. Cancellation while holding -- Drop returns resource to pool
3. Broken resources -- `discard()` removes from pool

**Adoption feasibility:** Easy
**Expected impact:** High

**Integration sketch:** Directly replaces our manual `ActorPool` with a richer, cancel-safe implementation with proper lifecycle management.

```rust
let pool = GenericPool::new(
    || Box::pin(async { Ok(DbConnection::connect("postgres://...").await?) }),
    PoolConfig::with_max_size(20).min_size(5),
);

// In handler:
let conn = pool.acquire(&cx).await?;
let result = conn.query("SELECT * FROM users").await;
conn.return_to_pool(); // Or just drop -- both work
```

### Sub-module: Semaphore (`semaphore.rs`)

**What it does:** Two-phase semaphore with cancel-safe acquire. Phase 1 waits for permit availability (cancel-safe). Phase 2 creates the obligation (cannot fail). Uses `parking_lot::Mutex` with atomic shadows for lock-free read-heavy diagnostics.

**Adoption feasibility:** Easy
**Expected impact:** Medium

**Integration sketch:** Native connection limiting for the HTTP server -- replaces middleware-based rate limiting.

---

## Module: distributed/ {#module-distributed}

### Sub-module: Consistent Hashing (`consistent_hash.rs`)

**What it does:** Deterministic consistent hash ring with virtual nodes for stable key-to-replica assignment. Uses `DetHasher` for deterministic hashing (no HashMap randomization). Minimal remapping when nodes are added/removed.

**Key types:**
- `HashRing` -- Consistent hash ring with configurable vnodes_per_node
- `node_for_key(&key)` -- Returns the responsible node for any hashable key
- `add_node()` / `remove_node()` -- Dynamic membership changes

**Adoption feasibility:** Easy
**Expected impact:** Medium

**Integration sketch:** Powers intelligent dispatch in `ActorPoolHandler` -- consistent hashing ensures the same request ID always routes to the same actor, enabling actor-local caching without coordination.

```rust
let mut ring = HashRing::new(100); // 100 vnodes per actor
ring.add_node("actor-0");
ring.add_node("actor-1");
ring.add_node("actor-2");

// Route request to consistent actor
let actor = ring.node_for_key(&request.path()).unwrap();
```

### Other distributed sub-modules

- `assignment.rs` -- Distributed work assignment
- `recovery.rs` -- Actor restart recovery
- `bridge.rs` -- Cross-node communication bridge
- `snapshot.rs` -- Distributed snapshot

**Adoption feasibility:** Hard (requires multi-node setup)
**Expected impact:** Low (ava-web is single-node for now)

---

## Module: raptorq/ {#module-raptorq}

**What it does:** RFC 6330-compliant RaptorQ forward error correction with GF(256) algebra, systematic encoding, and a sender/receiver pipeline that integrates with `Cx` for cancellation-safe operation and `SecurityContext` for authenticated symbols.

**Key types:**
- `RaptorQSender<T>` -- encode -> sign -> transport pipeline
- `RaptorQReceiver<T>` -- transport -> verify -> decode pipeline
- `SendOutcome` / `ReceiveOutcome` -- Operation results with symbol counts
- `SymbolPool` -- Pooled symbol allocation for zero-copy operation

**When useful:** Lossy QUIC/UDP transport, unreliable network links, broadcast protocols where retransmission is expensive.

**Adoption feasibility:** Hard
**Expected impact:** Low (HTTP/TCP doesn't need FEC)

**Conditional adoption:** If ava-web adds QUIC or UDP-based protocols, RaptorQ becomes relevant for ensuring delivery over lossy links without retransmission overhead.

---

## Module: stream/ {#module-stream}

**What it does:** Complete async stream combinator library equivalent to `futures::Stream` + `tokio-stream`, but native to asupersync. Includes: `map`, `filter`, `filter_map`, `then` (async map), `enumerate`, `inspect`, `take`, `skip`, `chain`, `zip`, `merge`, `buffered`, `buffer_unordered`, `chunks`, `ready_chunks`, `collect`, `fold`, `for_each`, `count`, `any`, `all`, `try_collect`, `try_fold`, `try_for_each`, `fuse`, `forward`, `broadcast_stream`, `receiver_stream`, `watch_stream`.

**Key types:**
- `Stream` trait -- Core trait (poll-based, like `Iterator` but async)
- `StreamExt` -- Combinator extension trait
- `BroadcastStream` -- One-to-many streaming
- `WatchStream` -- Watch-style stream (latest value)

**Adoption feasibility:** Easy
**Expected impact:** High

**Integration sketch:** SSE events modeled as native asupersync streams:

```rust
async fn sse_handler(cx: &Cx) -> impl Stream<Item = SseEvent> {
    let events = database_changes().await;
    iter(events)
        .filter(|e| e.is_relevant())
        .map(|e| SseEvent::new(e.to_json()))
        .take(100)  // Limit to 100 events
}
```

---

## Top 3 Adoption Proposals {#top-3-adoption-proposals}

### Proposal 1: Macaroon-Authorized Middleware (cx/macaroon)

**Status:** ADOPT
**Effort:** ~3 days
**Impact:** Revolutionary -- Cryptographic capability attenuation for ava-web authorization

#### Problem

Current HTTP frameworks use extension-based context for auth tokens:
```rust
// Typical approach -- untyped, unforgeable only by convention
let user = req.extensions().get::<AuthUser>().unwrap();
```

This has no formal security properties. Any middleware can inject/modify auth context. There's no delegation, attenuation, or audit trail.

#### Solution

Replace extension-based auth with Macaroon bearer tokens:

```rust
use asupersync::cx::macaroon::*;

/// Middleware that issues Macaroon tokens
pub struct MacaroonAuthMiddleware {
    root_key: AuthKey,
}

impl MacaroonAuthMiddleware {
    /// Issue a token for authenticated users
    pub fn issue(&self, user_id: &str, permissions: &[&str]) -> MacaroonToken {
        let identifier = format!("user:{user_id}");
        let mut token = MacaroonToken::new(&identifier, "ava-web/auth", &self.root_key);

        // Add caveats for each permission
        for perm in permissions {
            token = token.add_caveat(CaveatPredicate::ResourceScope(perm.to_string()));
        }

        // Time-bound: 1 hour
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        token = token.add_caveat(CaveatPredicate::TimeBefore(now_ms + 3_600_000));

        // Rate limit: 1000 requests per minute
        token = token.add_caveat(CaveatPredicate::RateLimit {
            max_count: 1000,
            window_secs: 60,
        });

        token
    }

    /// Verify a token in request context
    pub fn verify(&self, token: &MacaroonToken, resource: &str) -> Result<(), VerificationError> {
        let now_ms = /* current time */;
        let ctx = VerificationContext {
            current_time_ms: now_ms,
            resource_path: Some(resource.to_string()),
            ..Default::default()
        };
        token.verify(&self.root_key, &ctx).map(|_| ())
    }
}

/// Attenuating middleware: restricts an existing token
/// Any middleware can narrow, but NONE can widen
pub fn attenuate_for_tenant(token: MacaroonToken, tenant_id: u64) -> MacaroonToken {
    token.add_caveat(CaveatPredicate::RegionScope(tenant_id))
}
```

#### Why this matters

1. **No framework does this.** Not Axum, not Actix, not Warp. This is genuinely novel.
2. **Delegation without coordination.** A user can attenuate their token and pass it to a sub-service without contacting the auth server.
3. **Third-party caveats.** External auth providers can be integrated without custom middleware.
4. **Formal security properties.** HMAC chain integrity, constant-time comparison, anti-forgery.

---

### Proposal 2: Lab Runtime + Scenario Testing for Handlers (lab/)

**Status:** ADOPT
**Effort:** ~2 days
**Impact:** High -- Deterministic fault injection for ava-web handler testing

#### Problem

HTTP handler testing is non-deterministic. Race conditions, timeout behavior, and error handling paths are exercised only by luck.

#### Solution

Integrate ava-web handlers with the lab runtime for deterministic, scenario-based testing:

```rust
use asupersync::lab::*;

#[test]
fn handler_resilient_to_chaos() {
    // Light chaos: 1% cancel, 5% delay, 2% I/O error
    let config = LabConfig::new(42).with_light_chaos();
    let mut runtime = LabRuntime::new(config);

    let region = runtime.state.create_root_region(Budget::INFINITE);

    // Run handler under deterministic chaos
    let (task_id, handle) = runtime.state.create_task(
        region,
        Budget::with_deadline_secs(5),
        async move {
            let app = Router::new().route("/api/data", get(my_handler));
            let response = app.handle(test_request()).await;
            assert!(response.status().is_success() || response.status().is_server_error());
            // Server errors are OK under chaos -- but panics are not
        }
    ).unwrap();

    runtime.run_until_quiescent();

    // Verify chaos was actually injected
    let stats = runtime.chaos_stats();
    assert!(stats.decision_points > 0);
}

#[test]
fn fuzz_handler_scheduling() {
    let harness = FuzzHarness::new(FuzzConfig::new(0, 500).worker_count(2));
    let report = harness.run(|runtime| {
        // Exercise handler under 500 different schedules
        setup_and_run_handler(runtime);
    });
    assert!(!report.has_findings(), "Violations: {:?}", report.findings);
}
```

**Scenario-based testing:**

```yaml
# tests/scenarios/rate-limiter-under-load.yaml
schema_version: 1
id: rate-limiter-burst
description: Verify rate limiter handles burst traffic correctly

lab:
  seed: 42
  worker_count: 4
  max_steps: 50000

chaos:
  preset: light

network:
  preset: lan

participants:
  - name: client-1
    role: http-client
  - name: client-2
    role: http-client
  - name: server
    role: http-server

faults:
  - at_ms: 100
    action: delay
    args: { target: server, duration_ms: 50 }

oracles:
  - all
```

---

### Proposal 3: Session-Typed Handler Protocols (obligation/session_types + choreography)

**Status:** ADOPT (Phase 2 -- after Proposals 1 & 2)
**Effort:** ~5 days
**Impact:** Revolutionary -- Compile-time handler protocol enforcement

#### Problem

Handler correctness is checked at runtime:
- A handler that forgets to send a response deadlocks
- Middleware that drops the chain silently -- no error
- Streaming handlers with incorrect frame sequences are only caught at test time

#### Solution

Encode handler protocols as session types:

```rust
use asupersync::obligation::session_types::*;

// Protocol: Handler receives request, sends exactly one response
type HttpHandlerProtocol = Recv<HttpRequest,
    Select<
        Send<HttpResponse, End>,       // 200 OK
        Send<ErrorResponse, End>,      // 4xx/5xx
    >
>;

// Middleware protocol: receives request, may transform, passes to next
type MiddlewareProtocol<Next> = Recv<HttpRequest,
    Select<
        Send<TransformedRequest, Next>,  // Pass through
        Send<ErrorResponse, End>,        // Short-circuit
    >
>;

// The handler MUST produce a response -- dropping the channel panics
fn my_handler(chan: Chan<Responder, HttpHandlerProtocol>) -> SessionProof {
    let (request, chan) = chan.recv(/* incoming request */);

    if request.is_valid() {
        let chan = chan.select_left();  // Success path
        let response = process(request);
        let chan = chan.send(response);
        chan.close()  // SessionProof: protocol completed correctly
    } else {
        let chan = chan.select_right();  // Error path
        let chan = chan.send(ErrorResponse::bad_request());
        chan.close()
    }
    // Forgetting to call close() -- DROP BOMB PANICS
}
```

**Choreography-level definition:**

```rust
// Global protocol defines the full request lifecycle
let http_lifecycle = GlobalProtocol::builder("http_request")
    .participant("client", "http-client")
    .participant("middleware", "auth-middleware")
    .participant("handler", "route-handler")
    .interaction(
        Interaction::comm("client", "request", "HttpRequest", "middleware")
            .then(Interaction::choice("middleware", "auth_check",
                // Auth pass: forward to handler
                Interaction::comm("middleware", "forward", "AuthenticatedRequest", "handler")
                    .then(Interaction::comm("handler", "respond", "HttpResponse", "client")
                        .then(Interaction::end())),
                // Auth fail: respond directly
                Interaction::comm("middleware", "reject", "HttpResponse", "client")
                    .then(Interaction::end()),
            ))
    )
    .build();

// Validates: knowledge-of-choice, deadlock freedom, participant coverage
assert!(http_lifecycle.validate().is_empty());
assert!(http_lifecycle.is_deadlock_free());
```

---

## Adoption Roadmap {#adoption-roadmap}

```
Phase 1 (Week 1): Foundation
  [x] Read and understand all modules (this document)
  [ ] Integrate cx/cap (type-level capabilities) into ava-web context
  [ ] Integrate sync/pool as connection pool replacement
  [ ] Integrate sync/semaphore for connection limiting

Phase 2 (Week 2): Security
  [ ] Integrate cx/macaroon for handler authorization
  [ ] Build MacaroonAuthMiddleware
  [ ] Add caveat verification to request pipeline
  [ ] Wire evidence logging

Phase 3 (Week 3): Testing
  [ ] Integrate lab runtime for handler tests
  [ ] Create scenario YAML templates for common patterns
  [ ] Add FuzzHarness to CI pipeline
  [ ] Set up chaos testing presets

Phase 4 (Week 4): Protocol Safety
  [ ] Define handler protocols as session types
  [ ] Integrate choreography for multi-service protocols
  [ ] Build code generation for session-typed middleware
  [ ] Add obligation tracking to request lifecycle

Phase 5 (Ongoing): Advanced
  [ ] Consistent hashing for ActorPool dispatch
  [ ] Stream combinators for SSE/WebSocket
  [ ] Conformal calibration for production metrics
  [ ] Saga execution for multi-step request processing
```

---

## Decision Log {#decision-log}

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-21 | ADOPT cx/macaroon | No competing framework offers cryptographic capability attenuation. Massive differentiation. |
| 2026-02-21 | ADOPT lab/chaos + lab/fuzz | Deterministic fault injection is the only reliable way to test error handling. Easy integration. |
| 2026-02-21 | ADOPT obligation/session_types (Phase 2) | Compile-time handler protocol enforcement is revolutionary but needs foundation first. |
| 2026-02-21 | DEFER raptorq | HTTP/TCP doesn't need FEC. Revisit if QUIC/UDP transport added. |
| 2026-02-21 | DEFER distributed (beyond consistent_hash) | Single-node architecture for now. Multi-node features parked. |
| 2026-02-21 | ADOPT sync/pool | Direct replacement for manual ActorPool with cancel-safety guarantees. |
| 2026-02-21 | ADOPT stream combinators | Native SSE/WebSocket support without external stream crate dependency. |
| 2026-02-21 | ADOPT distributed/consistent_hash | Simple, high-impact improvement for ActorPool request routing. |
