# @tmnl/lnk — Architecture

> **Status**: ✅ Phase 0 complete (90 tests passing) → Phase 1 next.
> **Author**: Val
> **Last updated**: 2026-04-30
> **Package**: `@tmnl/lnk` (workspace package, Effect v4 via `effect-v4` alias)
> **Supersedes**: `tmnl/src/lib/holonet/durable-streams/v1/` (deprecated; Effect v3, NATS-bridge prior)
>
> **Why a separate package?** Effect v4 lives alongside v3 in this monorepo via the `effect-v4` npm alias
> (same pattern as `@tmnl/stx`). Isolating v4 surface in its own package prevents accidental v3/v4 mixing
> in TS resolution and gives this library its own independent test runner and build.
>
> **Imports throughout this doc** use the `effect-v4` alias path (e.g. `from "effect-v4/Effect"`,
> `from "effect-v4/unstable/reactivity"`). When TMNL itself migrates to v4, these collapse to plain `effect/...`.

---

## 1. Mission

Build an **Effect-native Durable Streams library** that:

1. Faithfully implements the canonical Durable Streams wire protocol
   (https://github.com/durable-streams/durable-streams).
2. Composes natively with Effect v4 primitives (`Channel`, `Stream`, `Sink`,
   `Pull`, **`Effect.YieldableClass`**, `Context.Service`, `RcMap`,
   `PubSub`, `unstable/reactivity/Atom`).
3. Provides a flexible **shim** layer such that the same client API can be
   driven by multiple transports (real HTTP, in-memory test transport,
   and a future `@tmnl/msh`-backed NATS adapter for our internal infra).
4. Exposes a **reactive React surface** via `@tmnl/stx` streaming materializers
   (`stxLatest`, `stxPull`, `stxFeed`, `stxShared`, `stxDuplex`) — these
   already wrap `effect-v4/unstable/reactivity` atoms with the right semantics
   for Durable Streams, so this library does not reinvent them.

This is not a refactor of `v1/`. This is a rebuild against the actual spec.

---

## 2. Why We Rebuilt: Spec Mismatch in v1

The v1 implementation is a NATS bridge that **looks like** Durable Streams but
encodes a different wire model. Until this is corrected, our clients cannot
interoperate with reference servers, CDNs, or other Durable Streams
implementations.

| Spec Requires | v1 Did | Cost of Mismatch |
|---|---|---|
| Opaque lex-sortable **string** offsets (`<read-seq>_<byte-offset>`), with sentinels `"-1"`, `"now"` | `Schema.Number.pipe(Schema.int())` | Cannot resume against reference servers; offset arithmetic is broken |
| HTTP **response headers** carry metadata (`Stream-Next-Offset`, `Stream-Up-To-Date`, `Stream-Cursor`, `Stream-Closed`) | Custom JSON envelope `{ items, nextOffset, upToDate }` | Wire protocol incompatibility |
| Producer fencing: `Producer-Id` + **`Producer-Epoch`** + `Producer-Seq` | Only `producerId` + `producerSeq` | No epoch fencing — exactly-once across producer restarts impossible |
| `Stream-Cursor` for CDN request-collapsing in live modes | Absent | Cannot edge-scale fan-out |
| `Content-Type` drives framing (raw bytes vs JSON message boundaries) | `X-Schema-Id` header bolted on top | Schema validation is additive, but framing should be content-type driven |
| `Stream-Closed: true` for EOF; `410 Gone` for retention drops | No close/retention model | No graceful shutdown semantics |
| Live: `?live=long-poll` / `?live=sse`; client auto-transitions catch-up→live on `Stream-Up-To-Date` | Two separate code paths, custom `_tag: "data"\|"heartbeat"` event union | Doesn't interop with reference servers; reinvented SSE event shape |

**Lesson**: We model the wire spec first, then layer schema validation,
MSH-backed transport, and React reactivity on top — never the reverse.

---

## 3. Module Map: Effect v4 → Durable Streams

This is the source of truth for which Effect modules we lean on, and why. Any
deviation from this list requires updating this document.

### 3.1 Core Type Discipline

| Module | Role |
|---|---|
| `Context.Service<>()` | All services (`DurableStreamsClient`, `Wire`, `DurableStreamCodec`). v4 unifies four v3 patterns into one. |
| `Context.Reference<T>(id, opts)` | Service defaults (e.g. configurable backoff schedules, default timeouts). |
| **`Effect.YieldableClass<A, E, R>`** | Custom yieldable handles. `DurableStream` extends this — `yield*` on it runs the `Effect` returned by `asEffect()`. The handle retains its own type identity (no silent collapse to `Effect`). |
| `Effect.Yieldable<Self, A, E, R>` interface | Underlying contract: `asEffect(): Effect<A, E, R>` + `[Symbol.iterator]()`. `YieldableClass` provides the iterator boilerplate via internal `SingleShotGen`. |

**Why this is a *bigger* deal in v4 than v3.** v4 deliberately stripped automatic yieldability from `Ref`, `Deferred`, `Fiber`, and `SubscriptionRef` (see `MIGRATION.md` → "Effect Subtyping → Yieldable"). Those are now plain values; you must call `Ref.get(ref)` etc. explicitly. This makes `Effect.YieldableClass` an **explicit opt-in** for domain types that *should* be yieldable — alongside core types like `Option`, `Result`, `Config`, and `Cause.YieldableError`.

**Our `DurableStream` opts in deliberately.** When a user writes `yield* myStream`, the runtime:
  1. Calls `[Symbol.iterator]()` (provided by `YieldableClass`) → returns `SingleShotGen(this)`.
  2. The generator yields the instance once.
  3. The runtime calls `.asEffect()` to extract the `Effect<Message, E, R>` to actually run.
  4. The handle remains a `DurableStream<A>` everywhere else — domain methods (`read`, `append`, `close`) stay accessible.

**Reference recipe** (from `effect-v4/Effect` `YieldableClass`):

```ts
import * as Effect from "effect-v4/Effect"

class DurableStream<A, E = never, R = never>
  extends Effect.YieldableClass<A, E, R>
{
  // [Symbol.iterator] is provided by YieldableClass via SingleShotGen.
  asEffect(): Effect.Effect<A, E, R> {
    // Return the latest message — backed by stxLatest's value atom
    // or an internal Ref / SubscriptionRef.
    return /* ... */
  }

  // Domain methods called explicitly, never yielded:
  read(opts: ReadOpts): Stream.Stream<Message<A>, E, R> { /* ... */ }
  append(body: AppendBody): Effect.Effect<void, E, R> { /* ... */ }
  close(): Effect.Effect<void, E, R> { /* ... */ }
}
```

> **In-tree v4 examples of `Yieldable`**: `Effect` itself, `Option.Some`/`Option.None`, `Result`, `Config`, `Cause.YieldableError`. (`SubscriptionRef` is **no longer** yieldable in v4 — it's a plain value with `SubscriptionRef.get` etc.)

### 3.2 Streaming Primitives — Channel / Stream / Sink / Pull

| Primitive | Where We Use It |
|---|---|
| `Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, R>` | Foundation. We rarely write Channels directly. |
| `Stream<A, E, R>` | **Read side.** Server data arrives as `Stream<Message>` produced by our wire layer. Catch-up→live transition is `Stream` semantics driven by header parsing. |
| `Sink<A, In, L, E, R>` | **Producer side.** `IdempotentProducer` is a `Sink<CloseResult, AppMessage>` — it consumes app messages, internally batches via `Sink` aggregation combinators (`lingerMs`, `maxBatchBytes`), emits sequence-acked offsets. |
| **`Pull<A, E, Done, R>`** | **Manual offset-tracked iteration.** This is the principled replacement for v1's `unfoldChunkEffect` + `emptyPolls` polling hack. `Stream.toPull` gives us a pull effect; we drive it explicitly while tracking offset state. |

**Composition pattern**:

```
Producer:  app msgs ─► Sink (batch) ─► POST ─► server
Consumer:  server ─► GET ─► Channel ─► Stream<Message> ─► Pull (offset-tracked)
                                              │
                                              └─► PubSub (broadcast to N consumers)
                                              └─► SubscriptionRef<Option<Latest>> (yieldable)
```

### 3.3 HTTP Layer

We use **two different rungs of the HTTP ladder** for client vs. server.

| Component | What | Why |
|---|---|---|
| `effect/unstable/http/HttpClient` + `FetchHttpClient` | **Client SDK transport** | The wire protocol is header-driven, has SSE + long-poll auto-transition, and chunked bodies. `HttpApiClient`'s typed-derivation cannot capture SSE event types or header-driven control flow without escape hatches. We use raw `HttpClient` for full control. |
| `effect/unstable/httpapi/HttpApi*` (`HttpApi`, `HttpApiBuilder`) | **Server-side bridge adapter only** | Declarative endpoint schemas + auto-OpenAPI are valuable for future bridge work. The NATS path is RFC-gated and should adapt `@tmnl/msh` rather than own raw NATS directly. Streaming responses fall back to `HttpServerResponse.stream`. |

**Decision (locked-in)**: Client SDK = raw `HttpClient`; server bridge = `HttpApi`.

### 3.4 Resource & Scope Discipline

| Module | Use |
|---|---|
| `Effect.acquireRelease` + `Layer.scoped` | Connection lifecycle, SSE subscription cleanup. |
| `Scope.provide` (renamed from v3 `Scope.extend`) | Cross-fiber scope handoff. |
| `Resource` | Auto-refresh on auth-token rotation (calls `head` on schedule). |
| `Pool` (`Pool.makeWithTTL`) | Server-side bridge resource pooling when not delegated to `@tmnl/msh`. |
| **`RcMap<StreamId, DurableStream>`** | Multi-stream client cache. `DurableStreamsClient.connect("foo")` called twice returns the same handle, ref-counted; closes on last release. |
| `ScopedRef` / `ScopedCache` | SSE re-establishment (replace the connection without tearing down the handle). |

### 3.5 Concurrency Primitives — the "flexible data structure"

| Need | Module |
|---|---|
| Multi-consumer fan-out within one process | `PubSub` (sliding for live, unbounded for catch-up) |
| **Reactive latest-value** (used by `asEffect()`) | `Ref<Option<Message>>` *or* a `@tmnl/stx` `stxLatest` atom (see §3.7) |
| Producer batch buffer | `Queue` |
| One-shot signals (stream-closed, first-message-arrived) | `Deferred` (no longer subtypes Effect — use `Deferred.await`) |
| Catch-up barrier | `Latch` |
| Ref-counted resources | `RcRef` / `RcMap` |
| Cross-stream atomic operations (future) | `TxRef`, `TxQueue`, `TxPubSub`, `TxHashMap` |

**Locked-in choice**: Our `DurableStream` handle internally holds:
- `Ref<Option<Message>>` for `asEffect()` / latest-value reads (server-side / non-React contexts)
- `PubSub<Message>` for fan-out broadcast
- `Pull<Message, E, StreamClosed, R>` as the offset-driven driver fiber

React contexts swap the bare `Ref` for `@tmnl/stx`'s `stxLatest` materializer, which is a `Ref`-shaped atom plus reactivity wiring — covered in §3.7.

### 3.6 Schema Module

| Module | Use |
|---|---|
| `effect/Schema` | All payload schemas, branded IDs (`StreamId`, `ProducerId`, `Epoch`). |
| `effect/Schema` (branded string) | **`Offset` is `Schema.String.pipe(Schema.brand("Offset"))`** — opaque, lex-sortable. |
| `Schema.Literal("-1", "now")` | `OffsetSentinel` union for read-position references. |
| `Schema.TaggedError` | Error hierarchy (see §3.8). |
| `effect/unstable/schema/Model` | Optional persistence model annotations for the StreamDB layer (Phase 6). |

### 3.7 Reactivity / React — via `@tmnl/stx`

We do not reinvent reactive bindings. `@tmnl/stx` already provides exactly the streaming materializers we need, all backed by `effect-v4/unstable/reactivity/Atom`:

| `stx` materializer | Maps to in Durable Streams |
|---|---|
| **`stxLatest(stream)`** | Backs `DurableStream.asEffect()` in React contexts — atom holds the most recent message; component re-renders on each emit. |
| **`stxPull(stream, { mode: "append" })`** | Catch-up reads with cursor advancement. `paginated.pull()` advances the offset; `paginated.items` accumulates. |
| **`stxFeed(stream, { mode: "ring", capacity: N })`** | Recent-message ring buffer for live UIs (chat, log tails). |
| **`stxShared(stream)`** | PubSub multicast for multiple React subscribers off one wire connection. |
| **`stxDuplex({ inbound, outbound })`** | Producer + consumer combined for bidirectional protocols. |
| `watchFiberExit` + `StxDefect` | Typed error/defect propagation from the driver fiber to the UI. |

| Underlying v4 module | Use |
|---|---|
| `effect-v4/unstable/reactivity/Atom` | First-party atoms (consumed by `stx` internally). |
| `Atom.pull(stream)` → `Writable<PullResult<A, E>>` | Low-level pull-as-atom. `stxPull` wraps this with cursor + accumulation modes. |
| `AtomHttpApi` / `AtomRpc` | Optional: auto-derive atoms if we expose a control-plane API. |
| `Reactivity` service | Cross-atom invalidation. |
| `Hydration` | SSR (Tanstack Start integration, future). |

**Current stance**: Lnk already exposes stx materializers (`lnkLatest`, `lnkFeed`) rather than owning a separate React hook tier. Any future `useLnk` hook should be convenience-only and built on those materializers.

### 3.8 EventLog / Observability

> **Important clarification**: v4's `effect/unstable/eventlog` is for **CRDT-style multi-writer event sourcing**, semaphore-serialized. **It is NOT a Durable Streams backend.** We use it for the same purpose v1 did: observability logging of DS operations.

| Module | Use |
|---|---|
| `effect/unstable/eventlog` | Observability event log (port v1's `events/` directory here). |
| `effect/Metric` | Counters, histograms, gauges. Replaces v1's `metrics/tracing.ts`. |
| `Effect.withSpan` | Cross-layer-boundary spans, OTel-friendly. |

---

## 4. Layered Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  React surface (Atom, useAtom)                                   │
│  via effect/unstable/reactivity/AtomRuntime.pull                 │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│  DurableStreamsClient  (Context.Service)                          │
│  ─ public API; vends DurableStream handles via RcMap              │
│  ─ orchestrates connect / create / delete / head                  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│  DurableStream  (Effect.YieldableClass — yieldable handle)        │
│  ─ asEffect() → Ref<Option<Message>>.get  (or stxLatest atom)     │
│  ─ read(opts) → Stream<Message> driven by Pull                    │
│  ─ subscribe(opts) → PubSub-backed Stream<Message>                │
│  ─ append, appendStream, close → via Codec → Wire                 │
│  ─ producer(opts) → IdempotentProducer (Sink)                     │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│  DurableStreamCodec  (Context.Service)                            │
│  ─ Content-Type framing (raw bytes vs JSON-array boundaries)      │
│  ─ Optional schema validation (additive, X-Schema-Id header)      │
│  ─ SSE event parsing on read paths                                │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│  Wire  (Context.Service — pluggable transport)       │
│  ─ Methods mirror spec verbs: put/post/get/head/delete            │
│  ─ Returns parsed headers (Stream-Next-Offset, -Cursor, -Closed,  │
│    -Up-To-Date) + raw body Stream<Uint8Array>                     │
│  ─ Implementations:                                               │
│    • HttpWireLive       — real HTTP via HttpClient                │
│    • InMemoryWireLive   — for tests                               │
│    • MSH-backed NATS adapter — future Phase 3, RFC-gated          │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│  effect/unstable/http/HttpClient (built-in)                       │
│  ─ Backoff, retry, abort, request/response middleware             │
└──────────────────────────────────────────────────────────────────┘
```

### Why this layering works

- **Wire is swappable**: real HTTP, in-memory test, future MSH-backed NATS adapter — all the same shape.
- **Codec is orthogonal**: schema validation is opt-in and additive.
- **DurableStream is the user surface**: yieldable, has domain methods, hides the layered guts.
- **Client is the factory**: ref-counted handle cache via `RcMap`.

---

## 5. Phase Plan

Each phase ships independently with its own gate (compile, tests, integration check).

### Phase 0 — Wire & type contracts (`src/contracts/`, no I/O) ✅

**Goal**: Lock down the type discipline. Zero runtime, all schemas + brands + pure parsers.

Layout (flat — recursion-into-subdirs deferred until we have multiple subsystems):

```
src/contracts/
├── index.ts        — barrel
├── Offset.ts       — branded Schema.String + OffsetSentinel + Order
├── StreamId.ts     — branded stream id with pattern validation
├── Producer.ts     — ProducerId, Epoch, Seq brands
├── ContentType.ts  — MIME parsing + framing-mode detection (json vs raw)
├── Headers.ts      — wire header constants + Effect.fn parsers/serializers
└── errors.ts       — Schema.TaggedErrorClass hierarchy
```

- [x] `Offset` — branded `Schema.String`, opaque, lex-sortable, with `Order<Offset>`
- [x] `OffsetSentinel = Schema.Literals(["-1", "now"])` + `ReadPosition` union
- [x] `StreamId`, `ProducerId`, `Epoch`, `Seq` brands
- [x] `ContentType` — parse + `framingMode(ct): "json" | "raw"`
- [x] Header constants & parsers using `Effect.fn("...")` for tracing:
      `Stream-Next-Offset`, `Stream-Cursor`, `Stream-Up-To-Date`, `Stream-Closed`,
      `Stream-TTL`, `Stream-Expires-At`, `Producer-Id`, `Producer-Epoch`, `Producer-Seq`
- [x] Error hierarchy via `Schema.TaggedErrorClass`:
  - `InvalidOffsetError`, `InvalidStreamIdError`, `InvalidContentTypeError`, `InvalidHeaderError` (validation)
  - `StaleEpochError` (producer fenced)
  - `SequenceGapError`
  - `StreamClosedError`
  - `RetentionDroppedError` (HTTP 410 Gone)
  - `FetchError` (network/5xx — placeholder, Phase 1 fleshes out)
  - `DurableStreamError` (base union)
- [x] Unit tests under `test/contracts/`: 90 passed / 90 — lex comparison, sentinel handling, header roundtrip, error tagging

**Gate**: ✅ `bun run typecheck` clean; ✅ `bun run test:run` 90/90 green; ✅ `bun run build` produces dist.

### Phase 1 — Wire layer (`Wire`) ✅

- [x] `Wire` `Context.Service` shape
- [x] `InMemoryWire` + `InMemoryInner`
- [x] `HttpWire` + `HttpInner`
- [x] Methods: `put`, `post`, `get`, `head`, `delete`
- [x] Parsed protocol headers + raw body stream surface
- [x] Internal + upstream conformance coverage for in-scope wire behavior

### Phase 2 — Lnk handle + stx materialization ✅ / ⏸

- [x] `Lnk` class extending `Effect.YieldableClass<A, E, R>`
- [x] Driver fiber with catch-up → live transition
- [x] `read`, `subscribe`, `append`, `close`, `head`
- [x] `Lnks` factory with `RcMap`-cached multi-stream handles
- [x] `@tmnl/stx` materializers (`lnkLatest`, `lnkFeed`)
- [ ] `IdempotentProducer` Sink convenience layer — deferred; manual
      producer-tracked appends already work through `Lnk#append({ producer })`

### Phase 3 — MSH-backed NATS wire adapter ⏸ RFC-gated

Lnk's NATS substrate is **not** a bespoke JetStream implementation inside
`@tmnl/lnk`. It depends on `@tmnl/msh` (`../msh`) and the pending Lnk/PCT
composition RFC. Until that RFC lands, this phase is an adapter-design slot,
not an implementation slot.

Likely direction after RFC review:

- [ ] Adapt `@tmnl/msh` NATS/session primitives into Lnk's `Wire` contract
- [ ] Preserve opaque offset mapping without leaking JetStream sequence shape
- [ ] Implement producer epoch/fencing through the MSH-supported state plane
- [ ] Keep HTTP `/streams/*` semantics and PCT composition boundaries intact
- [ ] Reuse MSH auth/connection lifecycle rather than opening raw NATS directly

### Phase 4 — Production HTTP server runtime ⏸

- [ ] TTL reaper and retention-drop behavior
- [ ] ETag / 304 support
- [ ] Browser/security headers
- [ ] Long-poll edge cases: cancellation, concurrent timeout, abort handling

### Phase 5 — Fork / branching streams ⏸

- [ ] `Source-Stream` + `Source-Offset` inputs
- [ ] Parent pointers / shared-data state / refcounting
- [ ] Cross-boundary reads and fork-local appends
- [ ] Soft-delete / cascade-GC semantics
- [ ] SSE / long-poll behavior across inherited bytes

### Phase 6 — Observability

- [ ] Migrate operation logs to `effect/unstable/eventlog`
- [ ] Re-wire metrics on `effect/Metric`
- [ ] `Effect.withSpan` at every layer boundary

### Phase 7 — StreamDB / state management (optional)

- [ ] Stream-backed reactive collections (parity with `@durable-streams/state`)
- [ ] Optimistic action helpers
- [ ] Schema-driven dedupe/conflict resolution

---

## 5a. Architectural Posture — Native Rewrite, Library Reference-Only

**Decision**: We do NOT wrap `@durable-streams/client`. We rebuild natively on Effect v4 primitives.

**Why this matters**:
- The published TS client uses Promises + `ReadableStream` + callbacks. Wrapping it as Effects costs us native cancellation/tracing/`Cause` introspection at every layer boundary.
- `IdempotentProducer` in their world is a class with mutable epoch/seq; in ours it's a `Sink<CloseResult, AppMessage>` over `Ref<Epoch>` + `Ref<Seq>`. Different model, can't be wrapped.
- The server-side adapter has to be built either way — their package is client-only — but our NATS path is RFC-gated and should adapt `@tmnl/msh`, not open a raw JetStream substrate inside Lnk.
- Their conformance test suite IS the safety net (see §10 Interop).

**What `@durable-streams/client` is to us**:
- **Reference implementation** for behavior (visibility pause/resume, `live` auto-selection, header semantics).
- **Conformance fixtures source** — the upstream `conformance/` directory feeds our CI (Phase 1 deliverable).
- **NOT a dependency.** No npm install of `@durable-streams/client` in this package.

If this posture changes in the future (e.g. we want a `DsClientWireLive` adapter as a fallback), it's a **new** wire implementation behind the same `Wire` service interface — additive, not retroactive.

---

## 5b. Validation Duality — Three Constructors Per Contract Type

**Codified in Phase 0**. Each branded contract type (`Offset`, `StreamId`, `ProducerId`, `Epoch`, `Seq`, `ContentType`) ships **three constructors** that materialize the cost/safety tradeoff:

| Constructor | Runtime cost | Use at |
|---|---|---|
| `trust(value)` | **0ns** — `as` cast (brands are pure type-level in v4) | Server response headers, in-process counters, test fixtures |
| `decode(unknown)` | ~129–240ns — full `Schema.decodeUnknownEffect` (per `effect-smol/benchmark/schema/filter.ts`) | HTTP body parsing, untyped storage, JSON.parse output |
| `parse(string)` | ~10–50ns + `Effect.fn` span | Typed input needing a domain-specific error (e.g. wire header parsers fail with `InvalidHeaderError`, not generic `SchemaError`) |

**Rule**: validate ONCE at the trust boundary, then `trust` everywhere downstream. We do not pay schema overhead per message in tight loops.

**Why brands are free**: deepwiki + smol source confirmed `Schema.String.pipe(Schema.brand("X"))` produces a schema whose decode runs *only* the underlying `Schema.String`. The brand is a TypeScript intersection type with `Brand.Brand<"X">` — there is no runtime brand check to skip. `decode()` is genuinely just the underlying-schema cost; `trust()` is genuinely free.

---

## 5c. Verified v4 API Surface (Reference Card)

Learnings from Phase 0 implementation against `effect@4.0.0-beta.59`. Carry these forward to Phase 1+; the migration guide doesn't always spell them out.

| Concept | v3 idiom (wrong in v4) | v4 idiom |
|---|---|---|
| Service definition | `Effect.Service<Self>()(id, opts)` / `Context.Tag(id)<...>()` | `Context.Service<Self, Shape>()(id)` |
| Service constructor | `effect: Effect.gen(...)` + `dependencies: [...]` | `make: Effect.gen(...)`; layer wired via `Layer.effect(this, this.make).pipe(Layer.provide(...))` |
| Layer naming convention | `Service.Default` / `Service.Live` | `Service.layer` (variants: `layerTest`, `layerConfig`, ...) |
| Yieldable user type | extend `Effectable.Class` (now internal!) | extend **`Effect.YieldableClass<A, E, R>`**, implement `asEffect()` |
| Schema annotations | `Schema.annotations({...})` standalone | `.annotate({...})` method on the schema |
| Schema filter chains | `.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))` | `.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))` |
| Schema regex check | `Schema.pattern(regex)` / `Schema.matches(regex)` | `Schema.isPattern(regex)` |
| Schema literal multi-arg | `Schema.Literal("a", "b")` (rest args) | `Schema.Literals(["a", "b"])` (array) |
| Schema union | `Schema.Union(a, b)` (rest args) | `Schema.Union([a, b])` (array) |
| Tagged error | `Schema.TaggedError<Self>()(tag, fields)` | `Schema.TaggedErrorClass<Self>(identifier?)(tag, fields)` |
| Order instance | `Order.string` (lowercase) | `Order.String` (uppercase singleton) |
| Order combinators | `Order.lessThan(O)`, `Order.lessThanOrEqual(O)` | `Order.isLessThan(O)`, `Order.isLessThanOrEqualTo(O)` |
| Subscribing as Effect | `yield* myRef`, `yield* myDeferred` (both subtyped Effect) | `yield* Ref.get(myRef)`, `yield* Deferred.await(myDeferred)` (no longer Effect subtypes) |
| Reactivity package | `@effect-atom/atom` | `effect/unstable/reactivity` (in core) |
| EventLog package | `@effect/experimental` | `effect/unstable/eventlog` (in core) |
| HTTP packages | `@effect/platform` | `effect/unstable/http` and `effect/unstable/httpapi` (in core) |

**Decode helper variants** (all share the same pipeline; differ only in executor):

- `Schema.decodeUnknownEffect(S)` → `Effect<T, SchemaError, R>` (preferred for composition)
- `Schema.decodeUnknownSync(S)` → `T` or throws (hot-path, no Effect allocation)
- `Schema.decodeUnknownExit(S)` → `Exit<T, SchemaError>` (sync, returns Exit)
- `Schema.decodeUnknownOption(S)` → `Option<T>` (sync, errors collapse to None)
- `Schema.decodeUnknownResult(S)` → `Result<T, Issue>` (sync, structural error)

For in-stream validation where we want zero Effect overhead but typed errors, prefer `decodeUnknownExit`.

---

## 6. Modules NOT Brought Forward From v1

| Dropped | Replacement |
|---|---|
| `@effect/experimental` (EventLog, Reactivity, EventJournal) | `effect/unstable/{eventlog,reactivity}` (in core) |
| `@effect-atom/atom`, `@effect-atom/atom-react` | `effect/unstable/reactivity` + framework-specific `@effect/atom-*` bindings |
| Custom `unfoldChunkEffect` polling with `emptyPolls` counters | `Pull` + `Stream-Up-To-Date` header handling |
| Numeric `Offset` schema | Branded opaque-string `Offset` + `OffsetSentinel` literal union |
| Custom SSE `_tag: "data"\|"heartbeat"` event union | Raw SSE-formatted body; events = message bytes/JSON, heartbeats = SSE comments |
| `producerId` + `producerSeq` (no epoch) | `Producer-Id` + `Producer-Epoch` + `Producer-Seq` (full fencing) |

---

## 7. Open Questions / Decisions to Revisit

| # | Question | Owner | Phase to Revisit |
|---|---|---|---|
| Q1 | Do we want a `DurableStreamSpan` Effectable that captures a `[fromOffset, toOffset)` range as a separate yieldable handle? Useful for windowed reads. | Val | After Phase 2 |
| Q2 | How does auth-token refresh interact with `RcMap`-cached handles? `Resource.auto`? Or invalidate the handle on 401 and let RcMap reconstruct? | Val | Phase 1/2 boundary |
| Q3 | Conformance test suite — pull from `durable-streams/durable-streams` `conformance/` directory? Or write our own subset? | Val | Phase 1 |
| Q4 | Do we expose `pull` directly on `DurableStream` or keep it internal and force users through `read`/`subscribe`? | Val | Phase 2 |
| Q5 | StreamDB / `@durable-streams/state` parity — separate `latest/state/` package or in-tree? | Prime | Phase 7 |

---

## 8. Out of Scope (for this rebuild)

- Multi-region replication (server-side concern)
- Server-side compaction beyond what the spec describes
- Yjs collaborative-editing transport adapter (separate package)
- AI SDK transport adapters (separate package)

---

## 10. Interop With `@durable-streams/*` Ecosystem

Three explicit interop angles, none of which require us to depend on the upstream JS packages:

### 10.1 Conformance Test Suite (Phase 1 deliverable)

The `durable-streams/durable-streams` repo ships a conformance test suite (TOC §7.1: "Conformance Testing System" with both server and client conformance tests + a wire-level conformance protocol).

**Plan**:
- Vendor or fetch the conformance fixtures into `test/conformance/`
- Run them against our `HttpWireLive` (talking to the upstream reference server) in CI
- Failure = we've drifted from spec; this is the regression net

This is the *only* place `@durable-streams/*` enters our supply chain — and only as test fixtures, not as runtime deps.

### 10.2 Reference Implementation

The upstream TypeScript client is the de-facto reference for behaviors the spec doesn't fully nail:
- Visibility-based pause/resume in browsers
- `live` mode auto-selection (SSE vs long-poll based on content-type)
- `onError` recovery hooks (e.g. 401 → token refresh → retry)
- Backoff schedules, jitter strategies

When we implement Phase 1 `HttpWireLive`, we read their source as a sanity check on our behavior — but we re-encode in Effect v4 idioms (`Schedule`, `Effect.withSpan`, `Resource.auto`, etc.).

### 10.3 Optional Future: `DsClientWireLive` (NOT planned, stays open)

If a future need surfaces — e.g. users want our Effect-native React surface but the upstream TS client's exact battle-tested HTTP plumbing — we can add `DsClientWireLive` as a *fourth* `Wire` implementation. Same `DurableStream` handle, same React/atom surface, different transport.

This is purely additive (~150 lines of Promise→Effect bridge + AbortSignal↔Effect interruption) and does not require any architectural change. We mention it here so the door stays open; we do not pre-build it.

---

## 11. Decision Log

| When | Decision | Rationale |
|---|---|---|
| Initial design | Effect v4-native, not v3 | User directive; v4 retreats from auto-yieldability of `Ref`/`Deferred` etc., which makes `Effect.YieldableClass` opt-in for `DurableStream` *more* meaningful, not less. |
| Phase 0 verification | `Effect.YieldableClass`, NOT `Effectable.Class` | Deepwiki + smol source confirmed `Effectable.Class` is internal; `Effect.YieldableClass` is the public abstract base for user types. |
| Phase 0 verification | Native rewrite, library reference-only | User explicit choice ("Native rewrite"). Posture documented in §5a. |
| Phase 0 verification | Workspace package `@tmnl/lnk` (renamed from `durable-streams`) | User naming preference; isolates v4 alias surface; protocol name "Durable Streams" preserved in description and prose. |
| Phase 0 verification | Three-constructor duality (`trust` / `decode` / `parse`) per contract | Brands are pure type-level → `trust` is genuinely free → schema overhead lives at boundaries only (~129-240ns/op per upstream benchmark). |

---

## 9. References

- **Spec**: https://github.com/durable-streams/durable-streams (`PROTOCOL.md`)
- **Effect v4 (smol)**: https://github.com/Effect-TS/effect-smol (modules listed in §3)
- **Effect v3 → v4 migration**: `submodules/effect-smol/MIGRATION.md` (root-relative)
- **`Effect.YieldableClass` source**: `submodules/effect-smol/packages/effect/src/Effect.ts:222`
- **`@tmnl/stx`**: `packages/stx/` — streaming materializers (`stxLatest`, `stxPull`, `stxFeed`, `stxShared`, `stxDuplex`)
- **v1 prior** (deprecated): `packages/tmnl/src/lib/holonet/durable-streams/v1/`
- **Holonet architecture**: `packages/tmnl/src/lib/holonet/ARCHITECTURE.md`
- **TMNL re-export shim**: `packages/tmnl/src/lib/holonet/durable-streams/latest/index.ts` (re-exports from `@tmnl/lnk`)
