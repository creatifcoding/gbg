# @tmnl/lnk — Architecture

> **Status**: 🚧 Phase 0 in progress.
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
   NATS-bridge adapter for our internal infra).
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
NATS-bridge transport, and React reactivity on top — never the reverse.

---

## 3. Module Map: Effect v4 → Durable Streams

This is the source of truth for which Effect modules we lean on, and why. Any
deviation from this list requires updating this document.

### 3.1 Core Type Discipline

| Module | Role |
|---|---|
| `Context.Service<>()` | All services (`DurableStreamsClient`, `DurableStreamWire`, `DurableStreamCodec`). v4 unifies four v3 patterns into one. |
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
| `effect/unstable/httpapi/HttpApi*` (`HttpApi`, `HttpApiBuilder`) | **Server-side NATS-bridge adapter only** | Declarative endpoint schemas + auto-OpenAPI are valuable for the bridge. Streaming responses fall back to `HttpServerResponse.stream`. |

**Decision (locked-in)**: Client SDK = raw `HttpClient`; server bridge = `HttpApi`.

### 3.4 Resource & Scope Discipline

| Module | Use |
|---|---|
| `Effect.acquireRelease` + `Layer.scoped` | Connection lifecycle, SSE subscription cleanup. |
| `Scope.provide` (renamed from v3 `Scope.extend`) | Cross-fiber scope handoff. |
| `Resource` | Auto-refresh on auth-token rotation (calls `head` on schedule). |
| `Pool` (`Pool.makeWithTTL`) | Server-side NATS connection pool. |
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

**Phase 4 deliverable** is just a thin React surface: `useDurableStream(streamId, opts)` that internally calls `stxLatest` / `stxPull` / `stxShared` against the `DurableStream`'s underlying `Stream<Message>`.

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
│  DurableStream  (Effectable.Class — yieldable handle)             │
│  ─ commit() → SubscriptionRef<Option<Message>>.get                │
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
│  DurableStreamWire  (Context.Service — pluggable transport)       │
│  ─ Methods mirror spec verbs: put/post/get/head/delete            │
│  ─ Returns parsed headers (Stream-Next-Offset, -Cursor, -Closed,  │
│    -Up-To-Date) + raw body Stream<Uint8Array>                     │
│  ─ Implementations:                                               │
│    • HttpWireLive       — real HTTP via HttpClient                │
│    • InMemoryWireLive   — for tests                               │
│    • NatsBridgeWireLive — server-side adapter (future, Phase 5)   │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│  effect/unstable/http/HttpClient (built-in)                       │
│  ─ Backoff, retry, abort, request/response middleware             │
└──────────────────────────────────────────────────────────────────┘
```

### Why this layering works

- **Wire is swappable**: real HTTP, in-memory test, NATS-bridge — all the same shape.
- **Codec is orthogonal**: schema validation is opt-in and additive.
- **DurableStream is the user surface**: yieldable, has domain methods, hides the layered guts.
- **Client is the factory**: ref-counted handle cache via `RcMap`.

---

## 5. Phase Plan

Each phase ships independently with its own gate (compile, tests, integration check).

### Phase 0 — Wire & type contracts (`src/contracts/`, no I/O)

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

- [ ] `Offset` — branded `Schema.String`, opaque, lex-sortable, with `Order<Offset>`
- [ ] `OffsetSentinel = Schema.Literal("-1", "now")` + `ReadPosition` union
- [ ] `StreamId`, `ProducerId`, `Epoch`, `Seq` brands
- [ ] `ContentType` — parse + `framingMode(ct): "json" | "raw"`
- [ ] Header constants & parsers using `Effect.fn("...")` for tracing:
      `Stream-Next-Offset`, `Stream-Cursor`, `Stream-Up-To-Date`, `Stream-Closed`,
      `Stream-TTL`, `Stream-Expires-At`, `Producer-Id`, `Producer-Epoch`, `Producer-Seq`
- [ ] Error hierarchy via `Schema.TaggedErrorClass`:
  - `InvalidOffsetError`, `InvalidStreamIdError`, `InvalidHeaderError` (validation)
  - `StaleEpochError` (producer fenced)
  - `SequenceGapError`
  - `StreamClosedError`
  - `RetentionDroppedError` (HTTP 410 Gone)
  - `FetchError` (network/5xx — placeholder, Phase 1 fleshes out)
  - `DurableStreamError` (base union)
- [ ] Unit tests under `test/contracts/`: lex comparison, sentinel handling, header roundtrip, error tagging

**Gate**: `bun run typecheck` clean; `bun run test:run` green for `test/contracts/`.

### Phase 1 — Wire layer (`DurableStreamWire`)

- [ ] `Context.Service` over `HttpClient`
- [ ] Methods: `put(streamId, config)`, `post(streamId, body, headers)`, `get(streamId, opts)`, `head(streamId)`, `delete(streamId)`
- [ ] Returns parsed headers + raw body `Stream<Uint8Array>`
- [ ] Backoff/retry as `HttpClient` middleware (exponential w/ jitter)
- [ ] `HttpWireLive` + `InMemoryWireLive` implementations
- [ ] Conformance test against in-memory wire

### Phase 2 — Stream handle (`DurableStream` extends `Effectable.Class`)

- [ ] `DurableStream` class extending `Effectable.Class`
- [ ] Internal `SubscriptionRef<Option<Message>>` for `commit()`
- [ ] Internal `PubSub<Message>` for fan-out
- [ ] Driver fiber: `Pull`-driven loop with auto catch-up→live transition on `Stream-Up-To-Date`
- [ ] `read`, `subscribe`, `append`, `appendStream`, `close`, `head`
- [ ] `DurableStreamsClient` factory with `RcMap`-cached handles

### Phase 3 — Idempotent Producer (as a `Sink`)

- [ ] `IdempotentProducer` modeled as `Sink<CloseResult, AppMessage, never, ProducerError, R>`
- [ ] Internal state: `epoch`, `nextSeq`, in-flight batch queue
- [ ] `lingerMs` + `maxBatchBytes` via Sink aggregation combinators
- [ ] `restart()` → epoch++, reset seq
- [ ] `autoClaim` mode (on 403, retry with epoch+1)
- [ ] Conformance against the wire

### Phase 4 — React/Atom surface

- [ ] `AtomRuntime.pull(stream.subscribe)` integration
- [ ] `useDurableStream(streamId, opts)` hook
- [ ] Optional: AtomHttpApi-style auto-derivation for control-plane API

### Phase 5 — Server adapter (`NatsBridgeWireLive`)

This is where v1's `StreamBridgeService` / `LiveStreamService` / `ConsumerStateService` (currently at `tmnl/src/lib/holonet/durable-streams/v1/`) get **repurposed and corrected**:

- [ ] `HttpApi` + `HttpApiBuilder` for server endpoints (PUT/POST/GET/HEAD/DELETE)
- [ ] Implements the wire protocol over NATS JetStream
- [ ] Maps NATS sequence → opaque offset string
- [ ] Implements `Stream-Closed`, `Stream-Cursor`, retention-drop → 410 Gone
- [ ] Producer-Epoch fencing via NATS KV consumer state
- [ ] SSE / long-poll modes via `HttpServerResponse.stream`

### Phase 6 — Observability

- [ ] Migrate `events/` → `effect/unstable/eventlog`
- [ ] Re-wire metrics on `effect/Metric`
- [ ] `Effect.withSpan` at every layer boundary

### Phase 7 — StreamDB / state management (optional)

- [ ] Stream-backed reactive collections (parity with `@durable-streams/state`)
- [ ] Optimistic action helpers
- [ ] Schema-driven dedupe/conflict resolution

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

## 9. References

- **Spec**: https://github.com/durable-streams/durable-streams (`PROTOCOL.md`)
- **Effect v4 (smol)**: https://github.com/Effect-TS/effect-smol (modules listed in §3)
- **Effect v3 → v4 migration**: `submodules/effect-smol/MIGRATION.md` (root-relative)
- **`Effect.YieldableClass` source**: `submodules/effect-smol/packages/effect/src/Effect.ts:222`
- **`@tmnl/stx`**: `packages/stx/` — streaming materializers (`stxLatest`, `stxPull`, `stxFeed`, `stxShared`, `stxDuplex`)
- **v1 prior** (deprecated): `packages/tmnl/src/lib/holonet/durable-streams/v1/`
- **Holonet architecture**: `packages/tmnl/src/lib/holonet/ARCHITECTURE.md`
- **TMNL re-export shim**: `packages/tmnl/src/lib/holonet/durable-streams/latest/index.ts` (re-exports from `@tmnl/lnk`)
