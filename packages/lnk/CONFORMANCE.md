# @tmnl/lnk — Conformance Tracker

> **Purpose**: Single source of truth for what `@tmnl/lnk` must satisfy and how
> close we are. Mirrors the 232-test
> [`@durable-streams/server-conformance-tests`](https://github.com/durable-streams/durable-streams/tree/main/packages/server-conformance-tests)
> categories, plus our internal error-discipline / type-safety concerns.
>
> **Status legend**:
> - ✅ **DONE** — implemented and tested
> - ⚠ **PARTIAL** — implemented but incomplete, or tested but with gaps
> - ❌ **TODO** — not implemented (with target phase)
> - 🚫 **HTTP-ONLY** — only meaningful in `HttpWire` (Phase 1.1+); skip for `InMemoryWire`
> - ⏸ **DEFERRED** — out of scope for current phase, queued for later
>
> **Last updated**: 2026-04-30 (Phase 1.3 — in-scope conformance closed; validation lifted to contracts)
> **Internal conformance tests** (Option B, transport-agnostic): **170 / 170 passing**
>   - 85 / 85 against `InMemoryWire` (lifecycle, offsets, raw + JSON framing, producer idempotency, stream closure, cursor, long-poll — SSE skipped: no HTTP transit)
>   - 85 / 85 against `HttpWire` over the `node:http` spec server (same suite, plus SSE)
> **Upstream conformance tests** (`@durable-streams/server-conformance-tests@0.3.0`): **241 / 299 passing**
>   - +141 tests vs Phase 1.2 baseline (100/299).
>   - **Zero in-scope failures remaining**. All 58 remaining failures are
>     in explicitly deferred categories (Fork = 30, TTL Expiration = 9,
>     Browser Security Headers = 8, Long-Poll Edge Cases = 4, Caching/ETag
>     = 3, Property-Based fuzzing = 2, Fork TTL = 2). See §16.

---

## How to read this file

Each obligation has:
- **Source**: PROTOCOL.md section / conformance category / our internal concern
- **Status**: emoji from legend
- **Where**: file path(s) where the obligation is satisfied (or will be)
- **Notes**: edge cases, gotchas, MAY-vs-MUST distinction

When implementing a new piece, **update this file in the same commit** that
adds the implementation. Drift between this checklist and reality is a bug.

---

## 1. Stream Lifecycle (PUT / DELETE)

### 1.1 PUT — Create stream
- ✅ Idempotent: PUT on existing stream with **matching** content-type → succeeds, returns `created: false`.
  - **Where**: `src/services/wire/in-memory/InMemoryInner.ts` → `create`
- ⚠ PUT with **conflicting** content-type → returns `StreamConfigMismatchError` from Inner (HTTP 409 in HttpWire).
  - **Where**: `src/services/wire/in-memory/InMemoryInner.ts` → `create` ✅
  - **Wire surfacing**: currently bridged via `Effect.die` in `InMemoryWire.put`. Phase 1.1 will surface as a discriminated error case in the wire shape (TODO).
  - **Error type**: `StreamConfigMismatchError` exists in `src/contracts/errors.ts` ✅
- ❌ PUT honoring `Stream-TTL` (seconds) — schedule a retention reaper.
  - **Where**: defer to Phase 2+ (background fiber)
  - **Spec**: MAY behavior, but conformance tests cover it
- ❌ PUT honoring `Stream-Expires-At` — same as TTL but absolute time.
  - **Where**: defer to Phase 2+

### 1.2 DELETE — Remove stream
- ✅ Removes the stream and all its data.
  - **Where**: `src/services/wire/in-memory/InMemoryInner.ts` → `delete`
- ✅ DELETE on non-existent stream → succeeds with `deleted: false` (no error).
- ✅ Isolation after DELETE+recreate — new stream starts at offset 0.

---

## 2. HTTP Protocol & Headers

Validated end-to-end via `HttpWire` (client) → `node:http` spec server (server) → `InMemoryWire` (storage).

- ✅ PUT response: `201 Created` (new) vs `200 OK` (idempotent match) vs `409 Conflict` (mismatch)
  - **Where (client)**: `src/services/wire/http/HttpInner.ts` → `sendChecked`
  - **Where (server)**: `test/services/wire/http/_spec-server.ts` → `buildPutResponse`
- ✅ POST response: `201 Created` (success) vs `204 No Content` (producer dup) vs `403 Forbidden` (stale epoch) vs `409 Conflict` (seq gap, stream closed)
  - 400 Bad Request for invalid payloads is **partial**: server emits 400, client surfaces as `FetchError` rather than discriminated `InvalidPayloadError` (Phase 1.2).
- ✅ GET response: `200 OK` (data) vs `204 No Content` (long-poll timeout) vs `404 Not Found`
  - 410 Gone (retention) is wired but untested (no retention impl yet — see §9.2)
- ✅ HEAD response: `200 OK` with metadata headers, no body
- ✅ DELETE response: `204 No Content` (deleted) or `404 Not Found` (translated to `deleted: false`)
- ✅ `Stream-Next-Offset` response header on every read response
- ✅ `Stream-Up-To-Date: true` header when caught up
- ✅ `Stream-Closed: true` header on closed-stream responses
- ✅ `Producer-Expected-Seq` + `Producer-Received-Seq` headers on 409 sequence-gap (allows client to distinguish from stream-closed)
- ✅ `Producer-Epoch` header on 403 stale-epoch (client can update its epoch)
- ✅ `Stream-Expected-Content-Type` header on 409 config-mismatch (client distinguishes from stream-closed)
- ⚠ `Stream-Cursor` response header in live mode — not yet generated (§10)
- ⚠ `Content-Type` echo on read responses — server has the data but doesn't echo yet
- 🚫 `Cache-Control: no-store` on dynamic responses (production server concern)
- 🚫 `X-Content-Type-Options: nosniff` (production server concern)
- 🚫 CORS headers (production server concern)
- 🚫 `ETag` headers (production server concern)

---

## 3. Offsets & Read Operations

### 3.1 Offset format
- ✅ Opaque, lex-sortable string.
  - **Where**: `src/contracts/Offset.ts` → branded `Schema.String` + `Order.String`
- ✅ Reference format `<read-seq>_<byte-offset>` zero-padded (20 digits each).
  - **Where**: `src/services/wire/in-memory/InMemoryInner.ts` → `makeOffset`
- ✅ Sentinel `-1` = beginning.
- ✅ Sentinel `now` = current tail.
- ✅ Lex compare matches chronological order.
  - **Verified**: `test/contracts/Offset.test.ts` (22 tests passing)

### 3.2 Read semantics
- ✅ Catch-up: reads from offset return all data up to current tail.
- ✅ Up-to-date signaling via `upToDate: true` flag in result.
- ✅ Empty stream → empty body, `upToDate: true`.
- ⚠ Server-defined chunk-size cap — currently uses `Number.MAX_SAFE_INTEGER`.
  - **Where**: `src/services/wire/in-memory/InMemoryInner.ts` → `readOnce`
  - **TODO**: choose a sensible default (1 MB? configurable?) and enforce per-call limit

---

## 4. JSON Framing (CRITICAL — Phase 1)

> Per spec: when stream is `Content-Type: application/json`, the server preserves
> message boundaries. POSTing a JSON array flattens **one level**. GET returns
> a JSON array of all messages from the offset.

### 4.1 POST JSON framing
- ✅ POST `application/json` body = single object → stored as 1 message.
  - **Where**: `src/services/wire/in-memory/InMemoryWire.ts` → `splitPostBody`
- ✅ POST `application/json` body = JSON array → flattens one level, each element is its own message.
- ✅ POST `application/json` body = invalid JSON → `InvalidPayloadError` (currently bridged via Effect.die; Phase 1.1 surfaces as discriminated error).
- ✅ POST `application/json` body = empty array `[]` → `InvalidPayloadError`.
- ✅ POST `application/json` body = JSON primitive (number, string, bool) → stored as 1 message.
- ✅ Nested arrays NOT flattened recursively — only one level.
  - **Where**: `splitPostBody` only flattens `Array.isArray(parsed)`; nested elements are re-encoded with `JSON.stringify` and stored as one message each.

### 4.2 GET JSON framing
- ✅ GET `application/json` response body = JSON array `[msg1, msg2, ...]`.
  - **Where**: `src/services/wire/in-memory/InMemoryWire.ts` → `assembleGetBody`
- ✅ Empty range → empty JSON array `[]`.
- ✅ Each message preserved as a JSON value in the array.
  - **Implementation**: `Stream.zipWithIndex` injects `,` between chunks; `[` and `]` wrap.
- ⚠ Long-poll **timeout** with JSON content-type: body is intentionally `Stream.empty` (NOT `[]`) so the wire-level translation can return HTTP 204 No Content. Distinguished via `ReadOutput.timedOut` flag from `InMemoryInner`.

### 4.3 Raw-bytes (non-JSON) framing
- ✅ POST raw-bytes → append concatenated to stream (no message boundaries).
- ✅ GET raw-bytes → response is concatenation of all bytes from offset.
  - **Where**: `src/services/wire/in-memory/InMemoryInner.ts` (current behavior — coincidentally correct for raw)

---

## 5. Long-Poll Mode (`?live=long-poll`)

- ✅ Block until data arrives or timeout reached.
  - **Where**: `src/services/wire/in-memory/InMemoryInner.ts` → `read` (polling-based)
- ✅ On timeout: empty body + `upToDate: true` + `nextOffset` = current tail.
  - **Implementation**: `ReadOutput.timedOut` flag distinguishes; body is `Stream.empty` on timeout; wire layer skips JSON-array wrapping when `timedOut: true`.
- ✅ On data arrival mid-poll: return immediately with new bytes.
- ✅ Cancellation via Effect interrupt (fiber kill).
  - **Verified by**: relying on Effect runtime semantics; needs explicit test
- ⏸ Polling interval / wakeup latch optimization — defer to Phase 2+ (current 25ms polling is fine for tests).

---

## 6. SSE Mode (`?live=sse`) — ⏸ deferred to Phase 1.2

HttpWire passes the `?live=sse` query param through to the server, but our
test spec server does NOT yet emit SSE-formatted responses. Real Durable
Streams servers do; we'll implement SSE serialization (server) +
deserialization (client) once we add a streaming-body assembler.

- ⏸ SSE event format: `data:` events containing message bytes.
- ⏸ For raw streams: data payload is base64-encoded.
- ⏸ For JSON streams: multiple messages may be batched into one `data:` event as a JSON array.
- ⏸ `control:` event after every `data:` event, JSON-encoded.
- ⏸ Control event fields: `streamNextOffset`, `streamCursor` (when open), `upToDate: true` (when caught up), `streamClosed: true` (when closed).
- ⏸ Offset lives in `control` event (not in SSE `id:` field).
- ⏸ Heartbeat / keep-alive (per server discretion).

---

## 7. Idempotent Producer Tests

### 7.1 Epoch fencing
- ✅ Higher epoch always accepted.
  - **Where**: `src/services/wire/in-memory/InMemoryInner.ts` → `append`
- ✅ Lower epoch (after higher seen) → `StaleEpochError` (HTTP 403).
- ✅ Equal epoch → seq dedup logic kicks in.

### 7.2 Sequence validation
- ✅ Sequential seqs accepted (`seq == lastSeq + 1`).
- ✅ Gap (`seq > lastSeq + 1`) → `SequenceGapError` (HTTP 409).
- ✅ Duplicate (`seq <= lastSeq`) → idempotent return (`duplicate: true`).

### 7.3 Duplicate response correctness — ✅ **FIXED**
- ✅ On duplicate, returns the offset of the **original batch's last message**.
  - **Where**: `src/services/wire/in-memory/InMemoryInner.ts` → `append`
  - **Implementation**: `ProducerHigh.lastBatchEndOffset` tracks the offset produced for each accepted `(producerId, epoch, lastSeq)` batch; dup branch returns it directly.

### 7.4 Zombie fencing
- ✅ Same as epoch fencing — once a higher epoch writes, all lower-epoch writes are 403'd.
- ⏸ Multi-writer race tests (property-based) — Phase 2+.

### 7.5 Producer header echo on response (🚫 HttpWire-only)
- 🚫 `Producer-Epoch` header on dup response = highest accepted epoch.
- 🚫 `Producer-Seq` header on dup response = highest accepted seq.
- 🚫 `Producer-Expected-Seq` + `Producer-Received-Seq` on seq-gap response.
  - We have these as fields on `SequenceGapError` ✅; HttpWire just maps to headers.

---

## 8. Stream Closure

- ✅ POST with `Stream-Closed: true` → mark stream closed.
  - **Where**: `src/services/wire/in-memory/InMemoryInner.ts` → `append`
- ✅ POST after closed → `StreamClosedError` (HTTP 409).
- ✅ GET after closed → still readable, `closed: true` flag.
- ✅ Idempotent close — re-issuing close on already-closed stream is a no-op.
- ⚠ Close-only POST (empty body + `Stream-Closed: true`) — **needs verification** once wire-level framing exists.
- 🚫 Close response carries `Stream-Closed: true` header (HttpWire concern).

---

## 9. TTL Expiration & Retention

### 9.1 TTL
- ❌ Stream with `Stream-TTL: N` expires after N seconds.
  - **Where**: defer to Phase 2+ (background reaper fiber)
  - **Spec**: MAY, but conformance suite tests it
- ❌ Post-expiry GET/POST/HEAD/DELETE → `404 Not Found`.
- ⏸ Concurrent TTL tests (multiple streams expiring at once) — Phase 2+.

### 9.2 Retention drop
- ❌ `RetentionDroppedError` (HTTP 410 Gone) when reading offset older than retention window.
  - **Where**: defer to Phase 2+ (requires retention-window state per stream)
  - **Spec**: MAY; not implemented in our reference yet

---

## 10. Stream-Cursor (CDN Collapsing) — 🚫 HttpWire-only

> Stream-Cursor is fundamentally about HTTP request collapsing in CDNs/proxies.
> InMemoryWire has no transit infrastructure that would benefit; HttpWire (Phase 1.1)
> implements cursor generation per spec.

- 🚫 Server generates interval-number cursor (time-window-based).
- 🚫 Cursor MUST never go backwards.
- 🚫 If client provides cursor ≥ current interval, server returns strictly greater cursor with random jitter.
- 🚫 Cursor present in live-mode responses when stream is open; absent when closed.
- 🚫 Client echoes cursor as `?cursor=...` query param on next live request.

---

## 11. Security Headers — 🚫 HttpWire-only

- 🚫 `X-Content-Type-Options: nosniff`
- 🚫 `Cache-Control: no-store` (or appropriate for live vs. catch-up)
- 🚫 CORS — configurable allowed origins
- 🚫 `Strict-Transport-Security` (HTTPS server concern)

---

## 12. Property-Based / Fuzzing — ⏸ Phase 2+

- ⏸ Byte-exactness with concurrent readers/writers (fast-check)
- ⏸ Random append/read sequences with verification
- ⏸ Malformed-input fuzzing (random bytes, partial JSON, etc.)
- ⏸ Unicode handling in stream IDs
- ⏸ Very large bodies (multi-MB)
- ⏸ Many concurrent streams

---

## 13. Internal type-discipline obligations (our own)

These are NOT in the upstream conformance suite; they're our own
correctness-by-types concerns.

- ✅ All wire offsets are branded `Schema.String` (no numeric drift).
  - **Where**: `src/contracts/Offset.ts`
- ✅ `OffsetSentinel` is a separate `Schema.Literals(["-1", "now"])`, not bleeding into `Offset`.
- ✅ `StreamId` validated via `isMinLength`/`isMaxLength`/`isPattern`.
  - **Where**: `src/contracts/StreamId.ts`
- ✅ `ProducerId`, `Epoch`, `Seq` branded with appropriate refinements.
- ✅ Trust/decode/parse triad on every contract type — zero-cost hot path + validated boundary.
- ✅ Errors are `Schema.TaggedErrorClass` (yieldable, schema-validated, tagged-union members).
- ✅ Drift guard between `Wire` RpcGroup and `WireShape`.
  - **Where**: `src/services/wire/Wire.ts` → `_DriftGuard` type
- ✅ `*Wire` impls compose internal `*Inner` services (per ARCHITECTURE.md §5).
- ✅ kebab-case directories, PascalCase files (matches `effect-smol/src/unstable/...`).

---

## 14. Conformance test integration plan

### 14.0 Upstream baseline (Phase 1.2 — LANDED)

```
@durable-streams/server-conformance-tests@0.3.0
baseUrl: node:http spec server (test/services/wire/http/_spec-server.ts)
backed by: InMemoryWire
paths:    v1Paths (/v1/stream/{id})

Result: 100 / 299 passing. Categorized failure backlog in §16.
```

Driver: `test/conformance/upstream.test.ts`. Run with `bun run test:run`
(included in the default suite) or in isolation:

```
bunx vitest run test/conformance/upstream.test.ts
```

### 14.1 Strategy for running upstream tests against our wire
- The upstream suite (`@durable-streams/server-conformance-tests`) drives
  `runConformanceTests({ baseUrl })` via raw `fetch()`.
- It expects an HTTP server. Our `InMemoryWire` is in-process.
- **Option A** (Phase 1.1+): Build a minimal `HttpServer` adapter that exposes
  `InMemoryWire` over HTTP, then run conformance against `http://localhost:N`.
  Most faithful, validates spec compliance end-to-end.
- **Option B** (Phase 1): Write our **own** transport-agnostic conformance
  suite that targets `Wire` directly. Faster to set up, less
  faithful (skips HTTP-specific concerns like status codes).
- **Plan**: do both. **Option B** first (Phase 1 — exercises the in-memory
  semantics across all spec-mandated behaviors). **Option A** in Phase 1.1
  (tests the HTTP-level translation).

### 14.2 Vendoring vs `npm install` of upstream tests
- TBD. The package depends on `@durable-streams/client` runtime — we don't
  want that as a runtime dep but it's fine as a dev/test dep.
- Decision deferred to Phase 1.1.

### 14.3 Subset / category running
- Upstream suite has no built-in tagging — uses Vitest `describe()` blocks.
- Our own conformance suite (Option B) WILL have category tagging from day 1
  so we can run subsets like `bun run test:conformance -- --category json-framing`.

---

## 16. Upstream conformance status (Phase 1.3 — closed)

Current: **241 / 299** passing. **Zero in-scope failures**. All 58 remaining
failures are deferred to a later phase, categorized below with phase
assignment and rationale.

### Phase 1.3 — in-scope work (CLOSED ✅)

The Phase 1.2 baseline had 199 failures across 22 categories. After Phase
1.3, every failure traceable to **wire-layer correctness or HTTP-adapter
protocol mapping** is fixed:

  - PUT-with-body atomic create-and-append
  - Stream-Closed lifecycle (close-only, idempotent close, dedup-before-
    closed-check, PUT-with-Stream-Closed)
  - Stream-Seq lex-monotonic header
  - Producer-tracked POST status (200 new / 204 dup / 204 generic)
  - Producer-Epoch / -Seq echo (highest-accepted on duplicates)
  - Epoch-bump-requires-seq-zero validation
  - Content-Type case-insensitive matching + mismatch on POST
  - Empty-body POST validation (400 unless close-only)
  - PUT-with-`[]` JSON empty-array creates empty stream
  - SSE encoding: text/* multi-data (CRLF-injection-safe), binary base64,
    JSON unchanged; `Stream-SSE-Data-Encoding: base64` response header
  - Long-poll with `offset=now` (capture initial msg count anchor)
  - Long-poll default timeout 5s
  - Lex-less canonical zero offset ("-") for empty streams
  - GET response: always Stream-Next-Offset, Cache-Control, Content-Type
  - PUT 201: Location header
  - HEAD: Stream-TTL / Stream-Expires-At echo
  - Idempotent PUT with different TTL/Expires-At → 409
  - Server-side input validation (lifted to contracts: TTL canonical
    decimal, Expires-At ISO-8601, Producer-Id non-empty, Producer-{Epoch,
    Seq} canonical decimal, Stream-Seq whitespace rejection, offset
    forbidden-character rejection)

### Deferred backlog (58 failures, by phase)

#### ⏸ Phase 4 — server runtime (TTL reaper, ETag, security middleware)

These require a real production HTTP server with background tasks,
caching middleware, and security-policy enforcement. The wire layer is
transport-agnostic; these are server-adapter concerns.

| # | Category | Phase 4 work |
|---|---|---|
| 9 | TTL Expiration Behavior | Background reaper that evicts streams past TTL/Expires-At; subsequent ops return 404 |
| 8 | Browser Security Headers | Server middleware: `X-Content-Type-Options: nosniff`, `Cross-Origin-Resource-Policy`, `Cache-Control: no-store` on HEAD, security headers on error responses |
| 3 | Caching and ETag | Server-side: generate ETag on GET, 304 on `If-None-Match`, regenerate on data change |
| 4 | Long-Poll Edge Cases | Concurrent timeouts, client cancellation race, abort handling — fiber-interruption / runtime concerns |

#### ⏸ Phase 5 — Fork (substantial server feature)

Fork is a spec extension: branching streams at a specific offset to create
independent sub-streams that share inherited bytes. Requires copy-on-fork
or refcount-based shared-data state, recursive lifecycle, soft-delete (410)
on sources with living forks, cascade GC, and propagation of TTL / closed /
JSON-framing across boundaries.

| # | Sub-category | Phase 5 work |
|---|---|---|
| 10 | Fork - Deletion and Lifecycle | Soft-delete sources with living forks (410), cascade GC, fork-from-deleted (409), content-type mismatch on fork (409) |
| 5 | Fork - Reading | Cross-boundary reads, inherited-portion reads, fork-only reads, post-fork-source-append isolation |
| 4 | Fork - Creation | PUT with `Source-Stream` + `Source-Offset` headers; fork-at-head / fork-mid-stream; 404 nonexistent source; 400 offset > length |
| 4 | Fork - TTL and Expiry | Source-with-living-forks → 410 (not 404); fork TTL releases refcount; TTL inheritance; fork outliving source via TTL renewal |
| 3 | Fork - Appending | Append to fork stays fork-local; idempotent producer scoped to fork; source-append after fork doesn't leak into fork |
| 3 | Fork - Recursive | Fork-of-fork at mid-point; three-level chain reads; independent appends at each level |
| 3 | Fork - Live Modes | Long-poll on fork returns inherited data immediately; SSE includes inherited bytes; long-poll handover at fork boundary |
| 3 | Fork - Edge Cases | Fork-then-immediately-delete source (ephemeral); 10-fork stress; fork-at-every-position |
| 2 | Fork - JSON Mode | JSON framing preserved across fork boundary in body assembly |
| **37** | **Fork total** | |

#### ⏸ Phase 1.4 (cheap, optional) — fuzz refinement

| # | Category | Notes |
|---|---|---|
| 1 | Property-Based Tests (fast-check) | Generative offset-character fuzzing; needs `Schema.check(isPattern(...))` refinement on `Offset` brand. Cheap one-line fix if revisited |

### How to revisit

When starting Phase 4 (server runtime) or Phase 5 (Fork):
  1. Re-run upstream: `bunx vitest run test/conformance/upstream.test.ts`
  2. Filter failures by category prefix to scope work:
     ```bash
     bunx vitest run test/conformance/upstream.test.ts -t "Fork - "
     bunx vitest run test/conformance/upstream.test.ts -t "TTL Expiration"
     ```
  3. Target one sub-category at a time; each is independent.
  4. **Phase 4** (TTL / ETag / security / long-poll edge): can be done in
     parallel with Phase 5 — they touch the spec-server adapter, not the
     Wire.
  5. **Phase 5** (Fork): touches `Wire.put` (new optional
     `sourceStream` / `sourceOffset` inputs), `InternalStream` (refcount +
     parent pointer), `inner.read` (cross-boundary slice assembly),
     `inner.delete` (soft-delete with living-fork detection).

---

## 15. Phase progression

- **Phase 0** (✅ DONE): Wire & type contracts, 90 unit tests
- **Phase 1** (✅ in-memory complete):
  - ✅ `Protocol` RpcGroup spec
  - ✅ `Wire` Context.Service shape
  - ✅ `InMemoryWire` + `InMemoryInner` with JSON framing, correct producer dedup, PUT mismatch detection, long-poll empty-on-timeout
  - ✅ Internal conformance suite (Option B from §14) — 32 tests across 7 categories, all passing
- **Phase 1.1** (✅ HttpWire + spec-server complete):
  - ✅ `HttpWire` + `HttpInner` (client-side, HttpClient + FetchHttpClient-based)
  - ✅ Spec status-code mapping (201/200/204/404/403/409/410)
  - ✅ Discriminator headers on 409 responses (Stream-Closed, Stream-Expected-Content-Type, Producer-Expected-Seq + Producer-Received-Seq)
  - ✅ Per-spec request headers (Producer-{Id,Epoch,Seq}, Stream-TTL, Stream-Closed)
  - ✅ `node:http` spec server adapter (test-only, in `test/services/wire/http/_spec-server.ts`)
  - ✅ Same parameterized conformance suite runs over HTTP — 64 / 64 across both wires
- **Phase 1.2** (✅ closed):
  - ✅ `InvalidPayloadError` + `StreamConfigMismatchError` surfaced as typed errors on `Wire.{put, post}` (no more `Effect.die`-bridging)
  - ✅ `Stream-Cursor` generation: interval-based (1s window, 12-digit zero-padded), monotonic, with random jitter when client-echoed cursor is at-or-ahead-of-current. Server emits in live-mode responses on open streams; absent on closed streams per spec.
  - ✅ SSE codec (`src/services/wire/Sse.ts`): server-side encode (`data:` + `control:` events, base64 for raw / JSON-array for JSON streams) + client-side decode (event-block parser; control metadata lifted into header surface for uniform downstream handling)
  - ✅ `PathResolver` DRY (`src/services/wire/Paths.ts`): single source of truth for URL-path templates. Built-ins: `defaultPaths` (`/streams/{id}`), `v1Paths` (`/v1/stream/{id}` for upstream conformance), `makePaths(template)` for custom deployments.
  - ✅ Upstream conformance integrated: `@durable-streams/server-conformance-tests@0.3.0` running against the spec server. Baseline: 100 / 299 passing; failure backlog categorized in §16.
  - ✅ Workspace install unblocked via `"!packages/codemode-pi"` workspace-negation pattern in root `package.json` (codemode-pi declares a `workspace:*` dep on a missing `@tmnl/codemode` package, blocking the whole monorepo install; negation is surgical — reversible when codemode is restored).
- **Phase 1.3** (✅ CLOSED — see §16): Wire-layer correctness + HTTP-adapter
  protocol mapping for all upstream conformance tests in scope. Lifted
  validation from spec-server into contracts. 241/299 passing, 0 in-scope
  failures.
- **Phase 2** (✅ functional, with deferred sub-phases): `Lnk` handle — user-
  facing reactive API as `Effect.YieldableClass<A, E, R>`.
  - **Phase 2.0** (✅ DONE): `Lnk` class with driver fiber, PubSub-backed
    `subscribe()`, one-shot `read()`, `append()`/`close()`/`head()`
    delegation, content-type-aware message decoding (raw vs JSON).
  - **Phase 2.1** (✅ DONE): `Lnks` factory — `RcMap`-cached multi-stream
    client. `Lnks.connect(streamId, contentType, opts)` reuses existing
    handles by id; refcount + scope-bound disposal; optional capacity +
    idle TTL eviction.
  - **Phase 2.2** (⏸ deferred): `IdempotentProducer` Sink — wraps the
    existing producer-tracked POST in a Sink for batching (`lingerMs` +
    `maxBatchBytes`) and auto-restart (`epoch++` on fence). Manual
    producer-tracked appends already work via `Lnk#append({ producer })`;
    the Sink layer is a high-throughput convenience.
  - **Phase 2.3** (✅ DONE): `@tmnl/stx` materializer integration —
    `lnkLatest(lnk, registry)` and `lnkFeed(lnk, registry, opts)` turn a
    Lnk into reactive atoms. Composes with stx's React hooks
    (`useStxLatest`, `useStxFeed`).
  - **Phase 2.4** (✅ covered by stx hooks): The stx React hooks
    (`useStxLatest`, `useStxFeed`) directly consume the materializer
    instances from Phase 2.3. No additional `@tmnl/lnk`-specific React
    surface needed; an opinionated `useLnk` could be added later if
    boilerplate-reduction is valuable.
  - **Tests at end of Phase 2**: 182/182 internal (170 wire + 12 lnks),
    241/299 upstream (unchanged — Phase 2 doesn't affect wire conformance).
- **Phase 3** (⏸ RFC-gated): MSH-backed NATS wire adapter — adapt
  `@tmnl/msh` (`../msh`) NATS/session primitives into the new `Wire` shape.
  Do not implement a bespoke raw JetStream substrate in `@tmnl/lnk` before
  the pending Lnk/PCT composition RFC lands.
- **Phase 4** (deferred from §16): Production HTTP server adapter — TTL
  reaper, ETag/304, browser security headers, long-poll edge cases. ~24
  upstream tests gated here.
- **Phase 5** (deferred from §16): Fork — server feature for branching
  streams at offset, with refcount/cascade GC. ~37 upstream tests gated
  here.

---

## How to update this file

When you implement an obligation:
1. Find its row above
2. Change ❌/⚠ to ✅
3. Fill in the **Where** field with the file path(s)
4. Add a note if there's an interesting gotcha
5. Commit the doc change in the same commit as the implementation

When you discover a NEW obligation (from spec, conformance tests, or
internal correctness concern):
1. Add a row in the appropriate section
2. Set status to ❌
3. Note the source (PROTOCOL.md section, conformance test file, or "internal")
4. Estimate target phase
