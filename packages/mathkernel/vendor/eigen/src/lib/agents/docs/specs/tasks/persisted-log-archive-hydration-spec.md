# Persisted Log Archive + Hydration Spec (NATS-First, Strict)

Status: Draft v2 (substantial / implementation-authoritative)  
Scope: `src/lib/agents/tasks/**`  
Owner: Agent Task surface  
Audience: runtime, atom-surface, view-controller, test, observability owners  
Companion implementation contract: `./persisted-log-archive-hydration-implementation-details.md`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Context and Existing State](#2-context-and-existing-state)
3. [Locked Decisions (Non-negotiable)](#3-locked-decisions-non-negotiable)
4. [Goals / Non-Goals](#4-goals--non-goals)
5. [Canonical Architecture](#5-canonical-architecture)
6. [Data and Schema Contracts (Effect Schema)](#6-data-and-schema-contracts-effect-schema)
7. [Durability Semantics (NATS JetStream Authority)](#7-durability-semantics-nats-jetstream-authority)
8. [Local Archive Storage Model](#8-local-archive-storage-model)
9. [Hydration Window Model](#9-hydration-window-model)
10. [Merge, Ordering, and Deduplication](#10-merge-ordering-and-deduplication)
11. [Cache and Eviction Strategy](#11-cache-and-eviction-strategy)
12. [Redaction Policy](#12-redaction-policy)
13. [Failure Semantics and Recovery](#13-failure-semantics-and-recovery)
14. [Service API Contracts](#14-service-api-contracts)
15. [Atom / STX State Surface](#15-atom--stx-state-surface)
16. [UI Controller Integration](#16-ui-controller-integration)
17. [Observability Contract](#17-observability-contract)
18. [Performance Budgets and Complexity](#18-performance-budgets-and-complexity)
19. [Rollout and Compatibility](#19-rollout-and-compatibility)
20. [Acceptance Gates (Strict)](#20-acceptance-gates-strict)
21. [Implementation Map (File-Level)](#21-implementation-map-file-level)
22. [Appendix A: Pseudocode](#22-appendix-a-pseudocode)
23. [Appendix B: Test Matrix](#23-appendix-b-test-matrix)
24. [Appendix C: References](#24-appendix-c-references)

---

## 1) Executive Summary

We are extending the current inline task log system from **bounded-hot-memory-only** to **durable + lazily hydrated history**, without regressing existing tail/inspect UX semantics.

The architecture is intentionally split:

- **Hot lane** (fast path): in-memory atom buffers for immediate UI.
- **Durability lane** (authority): NATS JetStream ack-gated persistence.
- **Archive lane** (local convenience): localStorage chunk archive for low-latency back-scroll and offline-like continuity.
- **Hydration lane** (on-demand): lazy loading of historical slices around a scroll anchor using cache -> local archive -> NATS fallback.

The key guardrail, per direction:  
> local archival never outranks durability authority. We persist to and from NATS first; local archive is downstream and opportunistic.

---

## 2) Context and Existing State

Current code already provides:

- bounded per-task buffer and cross-task caps in `src/lib/agents/tasks/atoms/surface.ts`
  - `maxEntriesPerTask = 1000`
  - `maxTaskBuffers = 64`
  - `idleTtlMs = 15m`
- log ingestion from `AgentTaskService.subscribeLogs` wired through `LogService` + `TransportService`
- UI control loop in `use-inline-task-log-controller.ts`
  - tail/inspect mode
  - unread tracking
  - scroll threshold handling

Current limitation:

- once an entry leaves hot memory (cap/eviction), it is no longer recoverable in UI without external replay path.

This spec introduces a formal replay/hydration plane while preserving existing interaction contracts.

---

## 3) Locked Decisions (Non-negotiable)

### 3.1 Durability Authority

1. **NATS JetStream ack is the durability truth.**
2. Local archive writes are **post-ack only**.
3. If local archive is unavailable, ingest remains functional; durability lane continues.

### 3.2 Existing Runtime Bounds

- `maxEntriesPerTask = 1000`
- `maxTaskBuffers = 64`
- `idleTtlMs = 15 * 60 * 1000`

No regression allowed.

### 3.3 Spill and Hydration

- spill checkpoint every `100` eligible entries
- hydration window `±500`
- anchor: `newest-first` (tail-biased)
- hydration cache TTL: `5m`

### 3.4 Quota + Dedupe + Redaction

- quota pressure response: evict oldest archive chunks and continue
- merge dedupe identity: `entry.id + timestamp`
- local archive redacts sensitive metadata/payload fields

### 3.5 Delivery Mode

- enabled by default (`full-on`) with strict acceptance.

---

## 4) Goals / Non-Goals

### 4.1 Goals

1. Preserve current tail UX smoothness.
2. Add deterministic historical hydration with bounded memory.
3. Keep architecture DI-first (Effect services + layers).
4. Keep state consumer-first (atoms/stx for UI state).
5. Preserve type/runtime safety via Effect Schema contracts.
6. Produce strict observability and evidence-friendly behavior.

### 4.2 Non-Goals (v1)

1. IndexedDB backend.
2. Cross-tab hydration cache coherence.
3. Full timeline virtualization redesign.
4. Replacing existing log row rendering contract.
5. Altering severity/filter semantics.

---

## 5) Canonical Architecture

```text
                                  ┌─────────────────────────────────────────┐
                                  │          AgentTaskService              │
                                  │    (LogService + TransportService)     │
                                  └──────────────────┬──────────────────────┘
                                                     │ subscribeLogs(taskId)
                                                     ▼
                                           assemble + normalize
                                                     │
                           ┌─────────────────────────┴─────────────────────────┐
                           │                                                   │
                           ▼                                                   ▼
              Hot Atom Buffer Lane                                   Durability Lane
           (surface.ts state authority)                              (NATS JetStream)
           - bounded per-task 1000                                   - publish + ack
           - lru + idle ttl                                           - receipt emitted
                           │                                                   │
                           │                                                   ▼
                           │                                         Archive Spill Lane
                           │                                        (localStorage chunks)
                           │                                         - redacted payloads
                           │                                         - quota-aware evict
                           │
                           ▼
                  UI Controller Lane
      (use-inline-task-log-controller.ts)
      - tail/inspect semantics
      - scroll threshold
      - hydration trigger
                           │
                           ▼
                 Hydration Planner Lane
                 - newest-first anchor
                 - ±500 window
                 - cache -> local -> NATS
                           │
                           ▼
                Merge + Dedupe + Reorder
                   id+timestamp identity
```

Boundary posture:

- services own IO orchestration
- atoms own observable UI state
- views own composition, not data authority

---

## 6) Data and Schema Contracts (Effect Schema)

> No raw domain interfaces for persisted payloads.

### 6.1 Branded Primitives

```ts
import { Schema } from 'effect'

export const TaskId = Schema.String.pipe(Schema.brand('TaskId'), Schema.minLength(1))
export const ChunkIndex = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand('ChunkIndex'))
export const Offset = Schema.String.pipe(Schema.minLength(1), Schema.brand('ArchiveOffset'))
export const SchemaVersion = Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.brand('SchemaVersion'))
```

### 6.2 Redaction Profile

```ts
export const RedactionMode = Schema.Literal('none', 'metadata-payload-redact', 'allowlist-only')

export const RedactionProfile = Schema.TaggedStruct('RedactionProfile', {
  mode: RedactionMode,
  redactedKeys: Schema.Array(Schema.String),
  allowlistKeys: Schema.Array(Schema.String),
})
```

### 6.3 Archive Manifest

```ts
export const LogArchiveManifest = Schema.TaggedStruct('LogArchiveManifest', {
  version: SchemaVersion,
  taskId: TaskId,
  chunkSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
  chunkCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  oldestOffset: Schema.NullOr(Offset),
  newestOffset: Schema.NullOr(Offset),
  updatedAtEpochMs: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  redactionProfile: RedactionProfile,
})
```

### 6.4 Archive Chunk

```ts
export const RedactedLogEntry = Schema.TaggedStruct('RedactedLogEntry', {
  id: Schema.String,
  timestampEpochMs: Schema.Number.pipe(Schema.int()),
  level: Schema.String,
  source: Schema.String,
  message: Schema.String,
  metadata: Schema.Unknown,
  payload: Schema.Unknown,
})

export const LogArchiveChunk = Schema.TaggedStruct('LogArchiveChunk', {
  version: SchemaVersion,
  taskId: TaskId,
  chunkIndex: ChunkIndex,
  fromOffset: Offset,
  toOffset: Offset,
  entries: Schema.Array(RedactedLogEntry),
  createdAtEpochMs: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
```

### 6.5 Durability Receipt

```ts
export const DurabilityReceipt = Schema.TaggedStruct('DurabilityReceipt', {
  taskId: TaskId,
  entryId: Schema.String,
  timestampEpochMs: Schema.Number.pipe(Schema.int()),
  jetStreamSequence: Schema.Number.pipe(Schema.int(), Schema.positive()),
  ackedAtEpochMs: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
```

### 6.6 Hydration Window + Result

```ts
export const HydrationAnchor = Schema.Literal('newest-first')

export const HydrationWindow = Schema.TaggedStruct('HydrationWindow', {
  taskId: TaskId,
  anchor: HydrationAnchor,
  centerOffset: Offset,
  back: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  forward: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})

export const HydrationSource = Schema.Literal('cache', 'local-archive', 'nats-fallback')

export const HydrationSlice = Schema.TaggedStruct('HydrationSlice', {
  taskId: TaskId,
  fromOffset: Offset,
  toOffset: Offset,
  source: HydrationSource,
  fetchedAtEpochMs: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  entries: Schema.Array(RedactedLogEntry),
})
```

---

## 7) Durability Semantics (NATS JetStream Authority)

### 7.1 Invariant

A log entry may be displayed immediately from hot lane, but it is **durable** only when we receive JetStream ack metadata.

### 7.2 Canonical Write Contract

1. Ingest entry to hot lane.
2. Publish to JetStream.
3. Await ack.
4. Emit `DurabilityReceipt`.
5. Only then enqueue for local archive spill.

### 7.3 Exactly-Once vs At-Least-Once

- durability lane is effectively **at-least-once publish** with idempotent merge at read path.
- UI merge dedupe (`id+timestamp`) neutralizes duplicates from retries/replay overlap.

### 7.4 Retry Policy

- bounded exponential backoff
- jittered intervals
- finite retries for immediate path, then background retry lane
- failed durability is observable and not silent

---

## 8) Local Archive Storage Model

### 8.1 Key Namespace

- `task:{taskId}:manifest`
- `task:{taskId}:chunk:{chunkIndex}`

No wildcard scans beyond this prefix.

### 8.2 Chunking

- chunk checkpoint target: 100 entries
- chunk ordering: ascending offsets
- manifest update required only after chunk write success

### 8.3 Versioning

- every manifest/chunk includes `version`
- decode failure due to version mismatch -> chunk ignored + diagnostic emitted
- manifest corruption -> soft-reset task archive lane only (no app crash)

### 8.4 Quota Behavior

1. local write fails with quota
2. evict oldest chunk
3. retry once
4. if still failing -> archive degraded flag, continue durable lane

### 8.5 Redaction-at-Write

- redaction applied before local storage serialization
- canonical entry in hot/durable lanes remains unredacted

---

## 9) Hydration Window Model

### 9.1 Anchor

Anchor is always newest-first (tail-biased). In practical terms:

- when user scrolls upward near threshold, planner asks for window ending near current visible oldest point but biased to latest-known contiguous offsets.

### 9.2 Window Dimensions

- `back = 500`
- `forward = 500`

Planner may clamp by known archive boundaries.

### 9.3 Read Pipeline

1. check hydration cache for exact or overlapping window
2. read local archive chunk range
3. identify gaps
4. fill gaps via NATS fallback query
5. normalize + merge

### 9.4 Trigger Policy

- auto-prefetch when scroll container nears top threshold in inspect mode
- one in-flight window per task (coalesced requests)

---

## 10) Merge, Ordering, and Deduplication

### 10.1 Identity

`dedupeKey = `${entry.id}:${timestampEpochMs}``

### 10.2 Ordering

Primary: timestamp ascending  
Secondary: dedupe key lexical (deterministic tie-break)

### 10.3 Merge Layers

- hot buffer entries
- hydrated slices
- optional fallback entries

Final render set is stable-sorted and deduped.

### 10.4 Duplicate Sources

Duplicates may occur via:

- durability retries
- chunk overlaps
- fallback overlap with local archive

All expected; all neutralized at merge stage.

---

## 11) Cache and Eviction Strategy

### 11.1 Hydration TTL Cache

- per task, window-keyed cache
- TTL = 5 minutes
- stale entries lazily evicted on read/write touch

### 11.2 Window Key

`windowKey = taskId + ':' + fromOffset + ':' + toOffset`

### 11.3 Capacity Posture

- keep cache bounded by TTL and max window count per task (implementation default: 16 windows/task)
- LRU within task when window cap exceeded

### 11.4 Interaction with Hot Caps

Hydration cache does not mutate hot cap constants.  
Hot buffer remains `1000`, independent of hydration cache retention.

---

## 12) Redaction Policy

### 12.1 Sensitive Key Matchers (default)

- `token`
- `authorization`
- `apikey`
- `secret`
- `password`
- `cookie`
- `set-cookie`
- `session`

(case-insensitive match)

### 12.2 Behavior

- preserve object shape
- replace matched values with `"[REDACTED]"`
- recursively process nested objects/arrays

### 12.3 Provenance

Persist redaction profile in manifest (`redactionProfile`) to avoid ambiguity in forensic reads.

---

## 13) Failure Semantics and Recovery

### 13.1 Error Classes

Use tagged schema-backed error shapes for:

- durability publish failure
- durability ack timeout
- archive encode/decode failure
- archive quota failure
- hydration miss/fallback failure

### 13.2 Recovery Posture

- **durability failure**: retry lane, hot lane alive
- **archive failure**: degrade archive only
- **hydration failure**: show non-blocking loader error row, keep existing logs visible

### 13.3 Degraded Modes

1. `DurabilityDegraded`
2. `ArchiveDegraded`
3. `HydrationDegraded`

Mode state must be exposed for diagnostics and tests.

---

## 14) Service API Contracts

### 14.1 `AgentTaskLogDurabilityService`

```ts
interface AgentTaskLogDurabilityServiceShape {
  publishAndAwaitAck: (
    taskId: string,
    entry: AgentTaskLogEntry,
  ) => Effect.Effect<DurabilityReceipt, AgentTaskLogDurabilityError>
}
```

Requirements:

- span wrapping for publish + ack
- retry policy configurable by layer
- deterministic timeout behavior

### 14.2 `LogArchiveStoreService`

```ts
interface LogArchiveStoreServiceShape {
  readManifest: (taskId: string) => Effect.Effect<Option<LogArchiveManifest>, LogArchiveStoreError>
  writeManifest: (manifest: LogArchiveManifest) => Effect.Effect<void, LogArchiveStoreError>
  readChunk: (taskId: string, chunkIndex: number) => Effect.Effect<Option<LogArchiveChunk>, LogArchiveStoreError>
  writeChunk: (chunk: LogArchiveChunk) => Effect.Effect<void, LogArchiveStoreError>
  evictOldestChunk: (taskId: string) => Effect.Effect<boolean, LogArchiveStoreError>
}
```

### 14.3 `LogHydrationService`

```ts
interface LogHydrationServiceShape {
  planWindow: (taskId: string, centerOffset: string) => Effect.Effect<HydrationWindow>
  hydrateWindow: (window: HydrationWindow) => Effect.Effect<HydrationSlice, LogHydrationError>
}
```

---

## 15) Atom / STX State Surface

### 15.1 Existing Atoms (must remain)

- `logBufferFamily`
- `tailModeFamily`
- `unreadCountFamily`
- filter/querydsl atoms

### 15.2 New Atoms

1. `durabilityPendingFamily(taskId)`
   - entries awaiting ack
2. `durabilityErrorFamily(taskId)`
   - latest durability failure state
3. `archiveManifestFamily(taskId)`
   - last known manifest snapshot
4. `hydrationCacheFamily(taskId)`
   - TTL windows
5. `hydrationLoadingFamily(taskId)`
   - in-flight status
6. `hydrationErrorFamily(taskId)`
   - latest hydration failure

### 15.3 Rule

All view-consumed state is atom-backed.  
No hidden mutable service refs as view truth.

---

## 16) UI Controller Integration

Primary integration target:  
`src/lib/agents/tasks/views/use-inline-task-log-controller.ts`

### 16.1 New Behaviors

- detect top-threshold in inspect mode
- dispatch hydration request (coalesced)
- merge hydrated entries into render model (without breaking scroll anchors)
- display loader / loader-error rows

### 16.2 Invariants

1. `tail` mode auto-follow remains unchanged.
2. unread count behavior remains unchanged.
3. jump-to-latest clears unread and restores tail.
4. hydration cannot force tail mode unexpectedly.

---

## 17) Observability Contract

### 17.1 Spans

- `AgentTask.LogDurability.publish`
- `AgentTask.LogDurability.ack`
- `AgentTask.LogArchive.spill`
- `AgentTask.LogArchive.evict`
- `AgentTask.LogHydration.plan`
- `AgentTask.LogHydration.fetch`
- `AgentTask.LogHydration.merge`

### 17.2 Metrics

Counters:

- `log_durability_publish_total`
- `log_durability_ack_failures_total`
- `log_archive_spill_chunks_total`
- `log_archive_quota_evictions_total`
- `log_hydration_requests_total`
- `log_hydration_cache_hits_total`
- `log_hydration_cache_misses_total`
- `log_hydration_failures_total`

Histograms:

- `log_durability_ack_latency_ms`
- `log_archive_spill_latency_ms`
- `log_hydration_fetch_latency_ms`

### 17.3 Structured Log Fields

- `taskId`
- `window.fromOffset`
- `window.toOffset`
- `cacheHit`
- `chunkCount`
- `fallbackUsed`

---

## 18) Performance Budgets and Complexity

### 18.1 Budgets

- append path overhead target: `< 2ms` median (excluding network ack)
- hydration trigger-to-render target: `< 120ms` cache hit, `< 500ms` local archive, `< 1200ms` fallback path
- no dropped frames during ordinary tail append under expected throughput

### 18.2 Complexity Notes

- merge complexity: `O((h + w) log(h + w))` with sort; dedupe `O(h + w)` hash map
- chunk write complexity: `O(k)` for chunk size `k = 100`
- hydration planner complexity: `O(1)` + boundary lookup

### 18.3 Memory Envelope

- hot buffer bounded (existing)
- hydration cache bounded by TTL + per-task window cap
- archive persisted in localStorage (quota-bounded)

---

## 19) Rollout and Compatibility

### 19.1 Rollout Mode

Enabled by default.

### 19.2 Backward Compatibility

- existing component API surface remains stable
- `InlineTaskLogView` default layout unchanged
- no filter schema breaking changes

### 19.3 Recovery from Old Data

- missing manifest: initialize empty archive state
- malformed chunk: skip + warn
- incompatible version: ignore chunk/manifest and continue live path

---

## 20) Acceptance Gates (Strict)

### Gate A — Correctness

- no duplicate rows after hot/hydrated merges
- deterministic row ordering
- stable scroll experience during hydration inserts

### Gate B — Durability

- archive writes are ack-gated
- failure to ack prevents archive spill for that entry

### Gate C — Resource Bounds

- `1000/task`, `64 tasks`, `15m` unchanged
- hydration cache TTL 5m verified

### Gate D — Failure Semantics

- quota eviction path proven
- degraded modes observable
- UI remains operational during archive/hydration failures

### Gate E — Schema + Type Discipline

- all persisted/hydration payloads schema-backed
- decode failures handled without crashes

### Gate F — Observability

- required spans emitted
- required counters/histograms increment correctly

---

## 21) Implementation Map (File-Level)

### 21.1 Services

- add `src/lib/agents/tasks/services/AgentTaskLogDurabilityService.ts`
- add `src/lib/agents/tasks/services/LogArchiveStoreService.ts`
- add `src/lib/agents/tasks/services/LogHydrationService.ts`
- update `src/lib/agents/tasks/services/layers.ts`

### 21.2 Schemas

- add `src/lib/agents/tasks/schemas/log-archive.ts`
- add `src/lib/agents/tasks/schemas/durability-receipt.ts`
- add `src/lib/agents/tasks/schemas/hydration-window.ts`

### 21.3 Atoms

- extend `src/lib/agents/tasks/atoms/surface.ts`
- add tests under `src/lib/agents/tasks/atoms/__tests__/`

### 21.4 Views

- update `src/lib/agents/tasks/views/use-inline-task-log-controller.ts`
- scoped css additions in `src/lib/agents/tasks/views/log-view.css`
- optional status chip additions in `log-tail-controls.tsx`

### 21.5 Docs + Evidence

- publish gate evidence under `docs/specifications/` per feature governance

---

## 22) Appendix A: Pseudocode

### A1 Ingest + Durability + Spill

```ts
onLiveEntry(entry): Effect<void> = Effect.gen(function*() {
  // 1) hot lane
  yield* Atom.set(logBufferFamily(taskId), capAndMerge(entry))

  // 2) durability lane
  const receipt = yield* AgentTaskLogDurabilityService.publishAndAwaitAck(taskId, entry)

  // 3) pending lane update
  yield* Atom.update(durabilityPendingFamily(taskId), remove(entry.id))

  // 4) archive lane (post-ack only)
  yield* ArchiveSpillPlanner.enqueue(taskId, entry, receipt)
})
```

### A2 Spill Planner

```ts
spillIfCheckpoint(taskId): Effect<void> = Effect.gen(function*() {
  const pending = yield* Atom.get(archivePendingFamily(taskId))
  if (pending.length < 100) return

  const batch = pending.slice(0, 100)
  const redacted = batch.map(redactEntry)

  const manifest = yield* LogArchiveStoreService.readManifest(taskId)
  const nextChunk = buildChunk(manifest, redacted)

  yield* LogArchiveStoreService.writeChunk(nextChunk).pipe(
    Effect.catchTag('QuotaExceeded', () =>
      Effect.gen(function*() {
        const evicted = yield* LogArchiveStoreService.evictOldestChunk(taskId)
        if (!evicted) return yield* Effect.fail(new Error('Archive quota unrecoverable'))
        yield* LogArchiveStoreService.writeChunk(nextChunk)
      })
    )
  )

  yield* LogArchiveStoreService.writeManifest(advanceManifest(manifest, nextChunk))
  yield* Atom.update(archivePendingFamily(taskId), drop(100))
})
```

### A3 Hydration Request

```ts
hydrateNearTop(taskId, centerOffset): Effect<void> = Effect.gen(function*() {
  const window = yield* LogHydrationService.planWindow(taskId, centerOffset)
  const slice = yield* LogHydrationService.hydrateWindow(window)

  const hot = yield* Atom.get(logBufferFamily(taskId))
  const merged = dedupeSort([...slice.entries, ...hot])

  yield* Atom.set(logBufferFamily(taskId), applyPerTaskEntryCap(merged, 1000))
})
```

### A4 Dedupe

```ts
const key = (e: LogLike) => `${e.id}:${e.timestampEpochMs}`
```

### A5 Redaction

```ts
const SENSITIVE = [/token/i, /authorization/i, /api.?key/i, /secret/i, /password/i, /cookie/i, /session/i]

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (isObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE.some((re) => re.test(k)) ? '[REDACTED]' : redact(v)
    }
    return out
  }
  return value
}
```

---

## 23) Appendix B: Test Matrix

| Area | Scenario | Expected |
|---|---|---|
| Durability | publish ack success | receipt emitted; entry eligible for spill |
| Durability | publish transient failure | retry path invoked; no crash |
| Durability | ack timeout | degraded flag + retry lane |
| Archive | first chunk write | manifest initialized and persisted |
| Archive | sequential chunks | chunkCount increments, offsets monotonic |
| Archive | quota hit | oldest chunk evicted then retry succeeds |
| Archive | decode corruption | chunk skipped, warning surfaced |
| Hydration | cache hit | no local/fallback call, quick render |
| Hydration | cache miss local hit | chunk read path used |
| Hydration | local gap fallback | fallback fetch fills uncovered offsets |
| Merge | overlap hot+hydrated | duplicates removed (`id+timestamp`) |
| UI | inspect near-top | hydration auto-triggered |
| UI | jump-to-latest | tail restored, unread reset |
| UI | hydration error | loader error row, existing logs intact |
| Bounds | per-task cap | never exceeds 1000 in hot lane |
| Bounds | task cap + idle ttl | LRU + TTL still enforced |

---

## 24) Appendix C: References

Primary research source:

- `src/lib/agents/docs/persisted-logs-research.md`

Key Effect references used in this spec:

1. `@effect/experimental/Persistence`
   - `BackingPersistence`, `ResultPersistence`, TTL handling
2. `@effect/experimental/PersistedQueue`
   - `offer`, `take`, memory/redis/sql store patterns
3. `effect/Stream`
   - `sliding`, `groupedWithin`, `toPull`, `toQueue`
4. `@effect/platform-browser/BrowserKeyValueStore`
   - `layerLocalStorage`

Repository baseline:

- canonical string used for research: `Effect-TS/effect`

---

End of spec.
