# Service Spec — `NuCmdkSearchBroker`

**Status:** Partially implemented (slice-complete; runtime integration in progress)  
**Date:** 2026-02-13 (updated 2026-02-15)

---

## 1) Mission

Dedicated orchestration service that federates search across provider lanes:

- in-process
- RPC (Effect RPC-first design direction)
- HTTP API
- filesystem
- vector/semantic
- database

Shell stays presentation-focused; broker owns choreography.

---

## Implementation reality snapshot (2026-02-15)

- Implemented service: `src/lib/commands/nu-cmdk/slices/searchBroker.ts`
- Implemented adapter router: `src/lib/commands/nu-cmdk/slices/queryAdapterRouter.ts`
- Implemented tests: `src/lib/commands/nu-cmdk/slices/__tests__/searchBroker.slice.test.ts`
- Runtime usage: command overlay provider context now uses broker/session path (`src/lib/commands/shell/providers/command-provider-context.ts`)
- Remaining: multi-lane real transports, persistence runtime path, full host/e2e parity.

## 2) Core responsibilities

1. Query fan-out to lane adapters (concurrent).
2. Per-lane streaming ingestion (partial, non-blocking).
3. Schema decode + normalization via variant registry.
4. Hybrid ranking merge (provider + shell context signals).
5. Failure isolation (row -> lane -> query hierarchy).
6. Cache management (tiered memory + persisted warm cache).

---

## D18 addendum (2026-02-14)

Broker orchestration is now explicitly aligned to a LayerRouter + middleware model (parity with Effect `HttpLayerRouter`):

- dispatch router service for adapters,
- deterministic global + adapter-local middleware composition,
- parse-once artifacts shared across adapter lanes,
- bounded scheduling for N+1 adapter workloads.

See: `nu-cmdk-provider-adapter-layer-router-decision.md`.

## 3) High-level architecture

```text
NuCmdkShell (atoms consumer)
  -> NuCmdkSearchBroker
      -> LaneAdapterRegistry
          -> InProcessAdapter
          -> EffectRpcAdapter
          -> HttpAdapter
          -> FileSearchAdapter
          -> VectorAdapter
          -> DatabaseAdapter
      -> VariantSchemaRegistry
      -> RankingEngine
      -> CacheManager (L1/L2)
      -> TelemetrySink
```

---

## 4) Lane adapter contract

Each adapter returns a stream of provider chunks:

```ts
search(queryCtx): Stream<ProviderChunk>
```

`queryCtx` includes:

- query text + query mode
- active shell mode
- scope context (global/editor/grid/tldraw/modal)
- provider budget/timeouts
- auth context (scoped)

---

## 5) Transport policy

## RPC

- Platform approach: mixed adapters, **Effect RPC-first** for protocol definitions.
- Broker normalizes all RPC replies to provider chunk envelope.

## HTTP

- Policy: timeout + partial lane results.
- Lane can complete with `partial` status and diagnostics.

## Filesystem

- Hybrid index: warm incremental index + on-demand fallback scan.
- Capability set for v1:
  - filename/path
  - content text
  - regex
  - symbol-aware
  - git-aware relevance signals

---

## 6) Merge & ranking policy

Mode-dependent merge strategy with lane-ranked scoring.

Total score components:

- provider base score
- query relevance
- context/mode boost
- scope boost
- recency boost
- usage frequency boost
- provider quality/confidence penalty

Broker computes merged ranked rows and publishes atom-friendly deltas.

---

## 7) State model

Per your direction: **atoms + service-side cache**.

- Broker holds cache, lane metrics, and query session internals.
- Broker exposes atom-compatible stream updates for shell state.
- Providers return compatible row shapes + renderer tokens.

---

## 8) Cache strategy (tiered)

## L1 memory cache

- Fast query/session cache.
- short TTL, LRU eviction.

## L2 persisted warm cache

- survives app restart for instant-open behavior.
- keyed by mode + query prefix + lane profile.

## invalidation

- TTL + explicit lane invalidation events.
- stale entries can seed optimistic first paint, then stream refresh.

---

## 9) Failure isolation hierarchy

1. **Row-level**: malformed row dropped + diagnostic.
2. **Lane-level**: lane partial/error, other lanes continue.
3. **Query-level**: complete only when all active lanes done or timed out.

No single lane failure should blank the whole palette.

---

## 10) Auth/Security policy

- token-based auth
- per-provider credentials
- scope-restricted queries
- audit logging
- sensitive field redaction in logs/telemetry

---

## 11) Latency budget proposal (ambitious baseline)

Proposed initial targets (to tune with measurement):

- warm open paint: **<= 30ms**
- first visible result: **<= 120ms**
- first remote lane partial: **<= 220ms**
- stable merged interaction state: **<= 600ms** typical
- keyboard nav response: **<= 16ms/frame**

---

## 12) Open implementation details

1. Exact persisted cache backend per platform (web/tauri).
2. Query-mode operator precedence for mixed mode search.
3. Semantic lane fallback chain (deferred priority per your note).
