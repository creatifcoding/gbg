# Persisted Log Archive + Hydration — Implementation Details (Effect-Docs Locked)

Status: Draft v1 (API-locked, coding-ready)  
Parent research: `../../persisted-logs-research.md`  
Parent spec: `./persisted-log-archive-hydration-spec.md`  
Parent plan: `./persisted-log-archive-hydration-task-plan.md`

---

## 1) Purpose

This document translates architecture decisions into **exact implementation contracts** using validated Effect APIs from:

- `@effect/experimental/Persistence`
- `@effect/experimental/PersistedQueue`
- `effect/Stream`
- `effect/Layer`
- `effect/Effect`
- `@effect/platform-browser/BrowserKeyValueStore`

Goal: eliminate ambiguity before coding.

---

## 2) Effect API Lock (from effect-docs)

## 2.1 Persistence primitives

### `BackingPersistenceStore`

```ts
export interface BackingPersistenceStore {
  readonly get: (key: string) => Effect.Effect<Option.Option<unknown>, PersistenceError>
  readonly getMany: (key: Array<string>) => Effect.Effect<Array<Option.Option<unknown>>, PersistenceError>
  readonly set: (key: string, value: unknown, ttl: Option.Option<Duration.Duration>) => Effect.Effect<void, PersistenceError>
  readonly setMany: (entries: ReadonlyArray<readonly [key: string, value: unknown, ttl: Option.Option<Duration.Duration>]>) => Effect.Effect<void, PersistenceError>
  readonly remove: (key: string) => Effect.Effect<void, PersistenceError>
  readonly clear: Effect.Effect<void, PersistenceError>
}
```

### `ResultPersistenceStore`

```ts
export interface ResultPersistenceStore {
  readonly get: <...>(key: ResultPersistence.Key<...>) => Effect.Effect<Option.Option<Exit.Exit<A, E>>, PersistenceError, R>
  readonly getMany: <...>(key: ReadonlyArray<ResultPersistence.Key<...>>) => Effect.Effect<Array<Option.Option<Exit.Exit<A, E>>>, PersistenceError, R>
  readonly set: <...>(key: ResultPersistence.Key<...>, value: Exit.Exit<A, E>) => Effect.Effect<void, PersistenceError, R>
  readonly setMany: <...>(entries: Iterable<readonly [ResultPersistence.Key<...>, Exit.Exit<A, E>]>) => Effect.Effect<void, PersistenceError, R>
  readonly remove: <...>(key: ResultPersistence.Key<...>) => Effect.Effect<void, PersistenceError>
  readonly clear: Effect.Effect<void, PersistenceError>
}
```

### Layers

- `Persistence.layerMemory: Layer<BackingPersistence>`
- `Persistence.layerKeyValueStore: Layer<BackingPersistence, never, KeyValueStore>`
- `Persistence.layerResult: Layer<ResultPersistence, never, BackingPersistence>`
- `BrowserKeyValueStore.layerLocalStorage: Layer<KeyValueStore>`

**Implementation lock:** local archive for browser will be composed as:

```ts
Persistence.layerKeyValueStore.pipe(
  Layer.provide(BrowserKeyValueStore.layerLocalStorage)
)
```

and then used by a service that directly calls `BackingPersistence.make(storeId)`.

---

## 2.2 Persisted queue primitives

### `PersistedQueue` interface

```ts
interface PersistedQueue<A, R = never> {
  offer: (value: A, options?: { id: string | undefined }) => Effect.Effect<string, PersistedQueueError | ParseResult.ParseError, R>
  take: <XA, XE, XR>(f: (value: A, metadata: { id: string; attempts: number }) => Effect.Effect<XA, XE, XR>, options?: { maxAttempts?: number })
    => Effect.Effect<XA, XE | PersistedQueueError | ParseResult.ParseError, R | XR>
}
```

### Constructors/layers

- `PersistedQueue.make({ name, schema })`
- `PersistedQueue.layer`
- `PersistedQueue.layerStoreMemory`

**Implementation lock:** we do **not** replace existing hot-lane ingest with `PersistedQueue` in v1. We use PersistedQueue semantics as reference patterns (idempotent offer, retry metadata, ack/finalizer flow) for durability/archive services.

---

## 2.3 Stream consumption primitives

### Pull and queue conversion

- `Stream.toPull(self)` -> scoped pull effect
- `Stream.toQueue(self, options)` -> scoped dequeue of `Take`

### Windowing

- `Stream.sliding(chunkSize)`
- `Stream.groupedWithin(chunkSize, duration)`

### Pagination

- `Stream.paginateEffect(seed, f)`

### Core loop usage in current codebase

- `Stream.runForEach(stream, f)` already used in `surface.ts` ingest loops.

**Implementation lock:** hydration fetch orchestration will use one of:

1. `paginateEffect` (cursor progression), or
2. `toPull` (manual pull windows),

with scope-managed cleanup.

---

## 2.4 Effect lifecycle primitives

### `Layer.effect`

```ts
Layer.effect(Tag, effect)
```

### `Layer.scoped`

```ts
Layer.scoped(Tag, scopedEffect)
```

### `Effect.uninterruptibleMask`

Use for critical take/ack/finalizer sections while restoring interruptibility in specific regions.

### `Effect.addFinalizer`

Use to ensure ack/nack-like cleanup or lock release semantics on scope close.

**Implementation lock:** durability and hydration long-lived operations that open resources will be delivered via `Layer.scoped` + finalizers.

---

## 3) V1 Architecture Commitments

## 3.1 Lane Separation

1. **Hot lane**: atom buffer and existing UI semantics.
2. **Durability lane**: JetStream authority.
3. **Archive lane**: local redacted chunk persistence.
4. **Hydration lane**: on-demand historical slice retrieval.

No lane collapses into another.

## 3.2 State Authority

- UI-consumed state remains atom/stx-based.
- Services may keep short-lived operational refs internally, but not as view truth.

## 3.3 Ack-gating

- Archive spill eligibility requires durability receipt.
- Non-acked entries can render hot but cannot archive.

---

## 4) File-Level Implementation Blueprint

## 4.1 New files (services)

1. `src/lib/agents/tasks/services/AgentTaskLogDurabilityService.ts`
2. `src/lib/agents/tasks/services/LogArchiveStoreService.ts`
3. `src/lib/agents/tasks/services/LogHydrationService.ts`

## 4.2 New files (schemas)

1. `src/lib/agents/tasks/schemas/log-archive.ts`
2. `src/lib/agents/tasks/schemas/durability-receipt.ts`
3. `src/lib/agents/tasks/schemas/hydration-window.ts`

## 4.3 Existing files to modify

1. `src/lib/agents/tasks/services/layers.ts`
2. `src/lib/agents/tasks/atoms/surface.ts`
3. `src/lib/agents/tasks/views/use-inline-task-log-controller.ts`
4. `src/lib/agents/tasks/views/log-tail-controls.tsx` (minimal)
5. `src/lib/agents/tasks/views/log-view.css` (scoped loader styles only)

---

## 5) Service Contract Details

## 5.1 `AgentTaskLogDurabilityService`

### Purpose

Wrap JetStream publish + ack and produce `DurabilityReceipt`.

### Shape

```ts
interface LogDurabilityServiceShape {
  publishAndAwaitAck: (
    taskId: string,
    entry: AgentTaskLogEntry,
  ) => Effect.Effect<DurabilityReceipt, LogDurabilityError>
}
```

### Required behavior

1. map publish errors to tagged error
2. timeout classification separate from generic publish failure
3. retry policy (bounded exponential + jitter)
4. spans:
   - `AgentTask.LogDurability.publish`
   - `AgentTask.LogDurability.ack`

### Notes

- If current NATS layer does not expose ack metadata directly, introduce an adapter method specifically for durability path.

---

## 5.2 `LogArchiveStoreService`

### Purpose

Persist redacted manifest/chunks to local storage via `BackingPersistenceStore`.

### Shape

```ts
interface LogArchiveStoreServiceShape {
  readManifest(taskId: string): Effect.Effect<Option.Option<LogArchiveManifest>, LogArchiveStoreError>
  writeManifest(manifest: LogArchiveManifest): Effect.Effect<void, LogArchiveStoreError>

  readChunk(taskId: string, chunkIndex: number): Effect.Effect<Option.Option<LogArchiveChunk>, LogArchiveStoreError>
  writeChunk(chunk: LogArchiveChunk): Effect.Effect<void, LogArchiveStoreError>

  readChunkRange(taskId: string, fromChunkIndex: number, toChunkIndex: number): Effect.Effect<ReadonlyArray<LogArchiveChunk>, LogArchiveStoreError>

  evictOldestChunk(taskId: string): Effect.Effect<boolean, LogArchiveStoreError>
}
```

### Keying

- manifest key: `task:{taskId}:manifest`
- chunk key: `task:{taskId}:chunk:{chunkIndex}`

### Storage binding

Use `BackingPersistence.make("agent-task-logs")` and explicit typed encode/decode with Effect Schema around unknown store payloads.

### Quota path

On `set`/`setMany` failure interpreted as quota:

1. evict oldest
2. retry once
3. fail with `ArchiveDegraded` marker if still failing

---

## 5.3 `LogHydrationService`

### Purpose

Given window request, return hydrated slice from:

1. in-memory hydration cache
2. local archive
3. NATS fallback

### Shape

```ts
interface LogHydrationServiceShape {
  planWindow(taskId: string, centerOffset: string): Effect.Effect<HydrationWindow>
  hydrate(window: HydrationWindow): Effect.Effect<HydrationSlice, LogHydrationError>
}
```

### Window defaults

- back = 500
- forward = 500
- anchor = newest-first

### Cache

- TTL 5m
- per-task cap default 16 windows

### Spans

- `AgentTask.LogHydration.plan`
- `AgentTask.LogHydration.fetch`
- `AgentTask.LogHydration.merge`

---

## 6) Atom/Controller Wiring Details

## 6.1 Atom Additions in `surface.ts`

Add families (names illustrative):

1. `durabilityPendingFamily(taskId)`
2. `durabilityErrorFamily(taskId)`
3. `archiveManifestFamily(taskId)`
4. `hydrationCacheFamily(taskId)`
5. `hydrationLoadingFamily(taskId)`
6. `hydrationErrorFamily(taskId)`

All should be created with `Atom.make` / `Atom.family` and manipulated via runtime fn pipelines.

## 6.2 Ingest Trigger Path Extension

Current `logStreamTrigger` loop (`Stream.runForEach`) should be extended in sequence:

1. merge into hot buffer (existing behavior)
2. enqueue pending durability marker
3. run durability publish/ack effect
4. on success:
   - clear pending marker
   - append to spill queue atom
5. checkpoint spill every 100 entries

## 6.3 Controller Trigger in `use-inline-task-log-controller.ts`

Add top-threshold hydration call when:

- `tailMode === 'inspect'`
- near top threshold
- no in-flight hydration for same window key

No behavior changes to existing unread/tail follow contracts.

---

## 7) Merge Algorithm (Locked)

## 7.1 Dedupe Key

```ts
const dedupeKey = (entry: { id: string; timestampEpochMs: number }) =>
  `${entry.id}:${entry.timestampEpochMs}`
```

## 7.2 Merge Steps

1. concatenate candidate arrays (hot + hydrated)
2. hash-map dedupe by key
3. stable sort by:
   1. timestamp ascending
   2. dedupe key lexical

## 7.3 Deterministic Tie-break

Required to avoid flaky tests and render churn.

---

## 8) Redaction Transform (Locked)

## 8.1 Rule Set

case-insensitive sensitive keys:

- token
- authorization
- apiKey/apikey
- secret
- password
- cookie / set-cookie
- session

## 8.2 Transform Semantics

- recursive
- structure-preserving
- value replacement: `"[REDACTED]"`

## 8.3 Application Point

Apply redaction **only before local archive write**.

---

## 9) Failure-Mode Implementation Details

## 9.1 Durability failure

- keep hot entry visible
- mark pending/error atoms
- schedule retry

## 9.2 Archive failure

- attempt eviction recovery
- set archive degraded status if unrecoverable
- do not break live ingest

## 9.3 Hydration failure

- set hydration error state
- show loader error row
- keep current rendered entries intact

---

## 10) Concrete Layer Wiring Plan

## 10.1 Browser local archive layer

```ts
const LocalArchiveBacking = Persistence.layerKeyValueStore.pipe(
  Layer.provide(BrowserKeyValueStore.layerLocalStorage),
)
```

## 10.2 Service composition

```ts
const AgentTaskLogsArchiveHydrationLive = Layer.mergeAll(
  LogDurabilityServiceLive,
  LogArchiveStoreServiceLive,
  LogHydrationServiceLive,
  // existing service stack
)
```

Use `Layer.scoped` for services that allocate long-lived handles/scopes.

---

## 11) Test Implementation Details

## 11.1 Unit suites

- `AgentTaskLogDurabilityService.test.ts`
  - success, timeout, retry, receipt fields

- `LogArchiveStoreService.test.ts`
  - write/read manifest/chunk
  - quota eviction path
  - corruption handling

- `LogHydrationService.test.ts`
  - planner window
  - cache hit/miss
  - fallback gap fill

## 11.2 Atom suite

- `surface.archive-hydration.test.ts`
  - ack-gated spill
  - pending markers
  - cache TTL expiry

## 11.3 View/controller suite

- `inline-task-log-view.hydration.test.tsx`
  - near-top trigger
  - loader behavior
  - tail semantics preserved

---

## 12) Sequencing (Implementation Order)

1. Schema contracts
2. Durability service
3. Archive store service
4. Hydration service
5. Atom wiring
6. Controller/UI trigger + loader
7. Observability
8. Gate evidence

---

## 13) ADR Seeds (to be promoted)

- ADR-001: JetStream Ack as Durability Authority
- ADR-002: localStorage archive via BackingPersistence + BrowserKeyValueStore
- ADR-003: newest-first ±500 hydration window with TTL cache

---

## 14) Anti-Patterns (Do Not Implement)

1. archive writes before durability ack
2. unbounded hydration caches
3. mutable service refs as UI truth
4. non-schema persistence payloads
5. style changes that clobber shared RVN styles

---

## 15) Traceability to Research

Mapped from:

- Q1 persistence provider layering and TTL
- Q2 persisted queue semantics
- Q3 NATS custom store feasibility
- Q4 rolling windows (`sliding`, `groupedWithin`)
- Q5 scroll-interactive pulls (`toPull`, `toQueue`, `paginateEffect`)

in `../../persisted-logs-research.md`.

---

## 16) Final Lock Statement

Implementation is now locked to:

- Effect docs API signatures listed in Section 2,
- NATS-first durability authority,
- ack-gated local archival,
- bounded atom/state constraints,
- strict acceptance matrix.

Any deviation must be recorded as ADR delta before merge.

---

## 17) Effect-Docs Lookup Index (Audit Trail)

These lookups were used to freeze API contracts in this document:

### Persistence / Experimental

- `Persistence.BackingPersistenceStore` (docId: 1886)
- `Persistence.ResultPersistenceStore` (docId: 1888)
- `Persistence.layerResult` (docId: 1879)
- `Persistence.layerKeyValueStore` (docId: 1881)
- `Persistence.layerMemory` (docId: 1880)
- `PersistedQueue.layer` (docId: 1862)
- `PersistedQueue.layerStoreMemory` (docId: 1864)
- `PersistedQueue.make` (docId: 1865)
- `RequestResolver.persisted` (docId: 1934)

### Platform Browser

- `BrowserKeyValueStore.layerLocalStorage` (docId: 2053)

### Stream

- `Stream.sliding` (docId: 10179)
- `Stream.groupedWithin` (docId: 10057)
- `Stream.toPull` (docId: 10208)
- `Stream.toQueue` (docId: 10209)
- `Stream.paginateEffect` (docId: 10109)
- `Stream.repeatEffect` (docId: 10132)
- `Stream.runForEach` (docId: 10156)

### Layer / Effect lifecycle

- `Layer.scoped` (docId: 7285)
- `Layer.effect` (docId: 7253)
- `Effect.uninterruptibleMask` (docId: 6056)
- `Effect.addFinalizer` (docId: 6074)

---

End of implementation details.
