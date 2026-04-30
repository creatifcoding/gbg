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
> **Last updated**: 2026-04-30 (Phase 1 in-memory complete)
> **Internal conformance tests** (Option B, transport-agnostic): **32 / 32 passing** for `InMemoryWire` (`test/services/wire/conformance.ts`)
> **Upstream conformance tests** (Option A, HTTP-driven): 0 / 232 (deferred to Phase 1.1 with `HttpWire` + HTTP server adapter)

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

## 2. HTTP Protocol & Headers (🚫 HttpWire-only)

These obligations are HTTP-specific and only apply to `HttpWire` (Phase 1.1+).
The `InMemoryWire` does not transit HTTP — it returns typed Effects directly.

- 🚫 PUT response: `201 Created` (new) vs `200 OK` (idempotent match) vs `409 Conflict` (mismatch)
- 🚫 POST response: `201 Created` (success) vs `204 No Content` (producer dup) vs `400 Bad Request` (bad JSON) vs `403 Forbidden` (stale epoch) vs `409 Conflict` (seq gap, stream closed)
- 🚫 GET response: `200 OK` (data) vs `204 No Content` (long-poll timeout) vs `404 Not Found` vs `410 Gone` (retention)
- 🚫 HEAD response: `200 OK` with metadata headers, no body
- 🚫 DELETE response: `200 OK` (deleted) or equivalent
- 🚫 `Stream-Next-Offset` response header on every read response
- 🚫 `Stream-Up-To-Date: true` header when caught up
- 🚫 `Stream-Closed: true` header on closed-stream responses
- 🚫 `Stream-Cursor` response header in live mode (when stream open)
- 🚫 `Content-Type` echo on read responses
- 🚫 `Cache-Control: no-store` on dynamic responses
- 🚫 `X-Content-Type-Options: nosniff` security header
- 🚫 CORS headers (configurable origins)
- 🚫 `ETag` headers (where applicable)

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

## 6. SSE Mode (`?live=sse`) — 🚫 HttpWire-only

> SSE format is HTTP-specific (text/event-stream content type). InMemoryWire
> does not implement SSE — there's no equivalent in-process abstraction.
> HttpWire (Phase 1.1) will format the underlying message stream as SSE.

- 🚫 SSE event format: `data:` events containing message bytes.
- 🚫 For raw streams: data payload is base64-encoded.
- 🚫 For JSON streams: multiple messages may be batched into one `data:` event as a JSON array.
- 🚫 `control:` event after every `data:` event, JSON-encoded.
- 🚫 Control event fields: `streamNextOffset`, `streamCursor` (when open), `upToDate: true` (when caught up), `streamClosed: true` (when closed).
- 🚫 Offset lives in `control` event (not in SSE `id:` field).
- 🚫 Heartbeat / keep-alive (per server discretion).

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
- ✅ Drift guard between `Wire` RpcGroup and `DurableStreamWireShape`.
  - **Where**: `src/services/wire/DurableStreamWire.ts` → `_DriftGuard` type
- ✅ `*Wire` impls compose internal `*Inner` services (per ARCHITECTURE.md §5).
- ✅ kebab-case directories, PascalCase files (matches `effect-smol/src/unstable/...`).

---

## 14. Conformance test integration plan

### 14.1 Strategy for running upstream tests against our wire
- The upstream suite (`@durable-streams/server-conformance-tests`) drives
  `runConformanceTests({ baseUrl })` via raw `fetch()`.
- It expects an HTTP server. Our `InMemoryWire` is in-process.
- **Option A** (Phase 1.1+): Build a minimal `HttpServer` adapter that exposes
  `InMemoryWire` over HTTP, then run conformance against `http://localhost:N`.
  Most faithful, validates spec compliance end-to-end.
- **Option B** (Phase 1): Write our **own** transport-agnostic conformance
  suite that targets `DurableStreamWire` directly. Faster to set up, less
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

## 15. Phase progression

- **Phase 0** (✅ DONE): Wire & type contracts, 90 unit tests
- **Phase 1** (✅ in-memory complete):
  - ✅ `Wire` RpcGroup spec
  - ✅ `DurableStreamWire` Context.Service shape
  - ✅ `InMemoryWire` + `InMemoryInner` with JSON framing, correct producer dedup, PUT mismatch detection, long-poll empty-on-timeout
  - ✅ Internal conformance suite (Option B from §14) — 32 tests across 7 categories, all passing
- **Phase 1.1**: `HttpWire` + minimal HTTP server adapter for upstream conformance suite (Option A)
- **Phase 2+**: TTL/retention reapers, property-based fuzzing, multi-stream concurrency tests
- **Phase 5**: NATS-bridge wire + server adapter (compatible with HttpWire's HTTP server adapter)

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
