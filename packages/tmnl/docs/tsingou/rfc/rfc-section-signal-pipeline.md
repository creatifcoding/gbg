# TSG-RFC-001 Section: Signal Pipeline

```
Section:       Signal Pipeline
Parent RFC:    TSG-RFC-001 (Tsingou Signal Analysis Platform)
Status:        DRAFT
Author:        Val (architecture-reviewer)
Created:       2026-02-18
Research Base: FLOW_ARCHITECTURE.md (693 lines), ADR-001 (d2ts), ADR-002 (adapters),
               ADR-004 (@effect/platform), ADR-006 (tagged errors),
               base-signal.ts (159 lines), TsingouFlow.ts (276 lines),
               AdapterManager.ts (411 lines), errors.ts (188 lines)
```

> This section specifies the signal pipeline architecture for Tsingou — from source
> ingestion through differential dataflow processing to output delivery. It covers the
> BaseSignal schema, source adapter contract, schema registry, d2ts graph architecture,
> custom operators, error handling hierarchy, NATS subject topology, and the OutputBridge
> mechanism. The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" are
> to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [TSG.2.1 BaseSignal Schema](#tsg21-basesignal-schema)
2. [TSG.2.2 Source Adapters](#tsg22-source-adapters)
3. [TSG.2.3 Schema Registry](#tsg23-schema-registry)
4. [TSG.2.4 Differential Dataflow (d2ts)](#tsg24-differential-dataflow-d2ts)
5. [TSG.2.5 Custom Operators](#tsg25-custom-operators)
6. [TSG.2.6 Error Handling](#tsg26-error-handling)
7. [TSG.2.7 NATS Subject Topology](#tsg27-nats-subject-topology)
8. [TSG.2.8 OutputBridge](#tsg28-outputbridge)
9. [TSG.2.9 Normative Requirements](#tsg29-normative-requirements)
10. [TSG.2.10 References](#tsg210-references)

---

## TSG.2.1 BaseSignal Schema

### TSG.2.1.1 Core Schema Definition

Every signal in Tsingou, regardless of source, MUST conform to the `BaseSignal` schema. This schema is defined using `Effect.Schema` with branded identifiers and a multi-dimensional version tuple.

The canonical implementation resides at `src/lib/tsingou-flow/schemas/base-signal.ts` (159 lines). The following is the verified schema definition:

```typescript
import { Schema } from 'effect'

// ─── Branded Identifiers ──────────────────────────────────────────────
// Branded types prevent misuse at the type level. A SignalId cannot be
// used where a SourceId is expected, even though both are strings at runtime.

const SignalId = Schema.String.pipe(Schema.brand('SignalId'))
type SignalId = typeof SignalId.Type

const SourceId = Schema.String.pipe(Schema.brand('SourceId'))
type SourceId = typeof SourceId.Type

const SessionId = Schema.String.pipe(Schema.brand('SessionId'))
type SessionId = typeof SessionId.Type

// ─── Version Tuple ────────────────────────────────────────────────────
// Multi-dimensional versioning for d2ts differential dataflow.
// Dimension 0: global logical clock (tick) — monotonic, incremented per cycle
// Dimension 1: per-source sequence number — allows partial ordering

const SignalVersion = Schema.Tuple(
  Schema.Number,  // tick (global logical clock)
  Schema.Number   // source_seq (per-source sequence)
)
type SignalVersion = typeof SignalVersion.Type

// ─── Signal Kind ──────────────────────────────────────────────────────
// Discriminator for schema registry lookup and typed extensions.

const KnownSignalKind = Schema.Literal(
  'midi', 'osc', 'nats', 'http', 'serial', 'rss', 'websocket', 'file-watch'
)

const SignalKind = Schema.Union(KnownSignalKind, Schema.String)
type SignalKind = typeof SignalKind.Type

// ─── Signal Metadata ──────────────────────────────────────────────────
const SignalMetadata = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
})

// ─── BaseSignal ───────────────────────────────────────────────────────
const BaseSignal = Schema.Struct({
  id:        SignalId,
  sourceId:  SourceId,
  timestamp: Schema.DateFromSelf,
  version:   SignalVersion,
  kind:      SignalKind,
  payload:   Schema.Unknown,
  metadata:  Schema.optional(SignalMetadata),
})
type BaseSignal = typeof BaseSignal.Type
```

### TSG.2.1.2 Field Semantics

| Field | Type | Semantics | Constraints |
|-------|------|-----------|-------------|
| `id` | `SignalId` (branded string) | Unique signal identifier | MUST be generated via `nanoid()` for performance; UUID v4 acceptable but slower |
| `sourceId` | `SourceId` (branded string) | Identifies the source adapter that produced this signal | MUST match the `adapterId` of the producing adapter |
| `timestamp` | `Date` | When the signal was created or received | MUST be set at ingest time if not provided by the source |
| `version` | `[number, number]` | d2ts multi-dimensional version | Dimension 0: tick (global clock). Dimension 1: source sequence. See [TSG.2.4.2] |
| `kind` | `string` (discriminated) | Signal type discriminator | MUST be one of `KnownSignalKind` for typed extensions, or a custom string for dynamic schemas |
| `payload` | `unknown` | Source-specific data | MUST be decoded by the schema registry at ingest [TSG.2.3] |
| `metadata` | `Record<string, unknown>` (optional) | Arbitrary metadata | MAY contain enrichment data, provenance tags, or classification labels |

### TSG.2.1.3 Source-Specific Extensions

Each known signal source has a typed extension schema that refines `BaseSignal` with source-specific payload structure. Extensions use `Schema.extend()` to preserve all base fields while constraining `kind` to a literal and `payload` to a typed struct.

| Extension | Kind Literal | Payload Fields | Status |
|-----------|-------------|---------------|--------|
| `MidiSignal` | `'midi'` | `channel` (0-15), `type` (note-on/off/cc/etc), `note`, `velocity`, `cc`, `value` | Stub |
| `OscSignal` | `'osc'` | `address` (string), `args` (Array<number\|string\|Uint8Array>) | Stub |
| `NatsSignal` | `'nats'` | `subject`, `data`, `headers` (optional), `sequence` (optional JetStream) | Built |
| `HttpSignal` | `'http'` | `url`, `method`, `statusCode` (optional), `body`, `headers` (optional) | Built |
| `SerialSignal` | `'serial'` | `port`, `baudRate`, `raw` (Uint8Array), `parsed` (optional) | Built |
| `RssSignal` | `'rss'` | `feedUrl`, `itemGuid`, `title`, `link`, `pubDate`, `content`, `categories` | Built |
| `WebSocketSignal` | `'websocket'` | `url`, `data`, `type` ('text'\|'binary') | Built |
| `FileWatchSignal` | `'file-watch'` | `path`, `event` ('create'\|'modify'\|'delete'), `content` (optional) | Built |

The `Signal` union type combines all 8 extensions:

```typescript
const Signal = Schema.Union(
  MidiSignal, OscSignal, NatsSignal, HttpSignal,
  SerialSignal, RssSignal, WebSocketSignal, FileWatchSignal
)
type Signal = typeof Signal.Type
```

Implementations MUST add new extensions to this union when introducing new adapter types. The extension MUST use `Schema.extend(BaseSignal, ...)` to ensure all base fields are preserved.

### TSG.2.1.4 SDR Signal Extension

ADR-011 defines an additional extension for SDR (Software Defined Radio) signals that uses the SigMF (Signal Metadata Format) standard:

```typescript
const SdrSignal = Schema.extend(BaseSignal, Schema.Struct({
  kind:    Schema.Literal('sdr'),
  payload: Schema.Struct({
    centerFrequencyHz: Schema.Number,
    sampleRate:        Schema.Number,
    gain:              Schema.Number,
    antenna:           Schema.optional(Schema.String),
    device:            Schema.optional(Schema.String),
    iqData:            Schema.optional(Schema.Uint8ArrayFromSelf),
    fftMagnitudes:     Schema.optional(Schema.Array(Schema.Number)),
    demodulated:       Schema.optional(Schema.Unknown),
    sigmfAnnotation:   Schema.optional(Schema.Unknown),
  })
}))
```

This extension is design-only and will be implemented when the SDR sidecar integration is built [ADR-011].

---

## TSG.2.2 Source Adapters

### TSG.2.2.1 SourceAdapterShape Contract

Every source adapter MUST implement the `SourceAdapterShape` interface [ADR-002]. This is an `Effect.Service` contract with lifecycle management, signal production via push callback, and health monitoring:

```typescript
interface SourceAdapterShape<Config = unknown> {
  // ─── Identity ───────────────────────────────────────────────────
  readonly adapterId: string         // Unique adapter instance ID
  readonly sourceId: string          // SourceId for produced signals
  readonly kind: string              // Signal kind this adapter produces

  // ─── Lifecycle ──────────────────────────────────────────────────
  readonly connect: (config: Config) => Effect.Effect<void, AdapterError>
  readonly disconnect: Effect.Effect<void, AdapterError>
  readonly isConnected: Effect.Effect<boolean>

  // ─── Signal Production (push model) ─────────────────────────────
  readonly onSignal: (handler: (signal: BaseSignal) => void) => Effect.Effect<void>

  // ─── Health ─────────────────────────────────────────────────────
  readonly health: Effect.Effect<AdapterHealth>

  // ─── Reactive State ─────────────────────────────────────────────
  readonly healthAtom: Atom<AdapterHealth>
  readonly signalCountAtom: Atom<number>

  // ─── Control ────────────────────────────────────────────────────
  readonly pause: Effect.Effect<void>
  readonly resume: Effect.Effect<void>
}
```

The push model was chosen over `Effect.Stream<Signal>` because adapters push signals at their own rate — the pipeline controls consumption via `Queue.bounded(4096)` backpressure [ADR-002].

### TSG.2.2.2 AdapterHealth Schema

```typescript
const AdapterHealth = Schema.Struct({
  status:       Schema.Literal('connected', 'disconnected', 'degraded', 'error'),
  lastSignalAt: Schema.optional(Schema.DateFromSelf),
  signalCount:  Schema.Number,
  errorCount:   Schema.Number,
  latencyMs:    Schema.optional(Schema.Number),
})
```

### TSG.2.2.3 Adapter Implementations

| Adapter | I/O Primitive | Deployment | Key Feature |
|---------|--------------|------------|-------------|
| `NatsAdapter` | `@nats-io/nats.js` subscribe | In-process | JetStream replay, subject wildcards |
| `HttpAdapter` | `@effect/platform HttpClient` | In-process | 4 modes: poll, SSE, webhook, long-poll [ADR-004] |
| `WebSocketAdapter` | `@effect/platform Socket` | In-process | Bidirectional, pluggable decoders |
| `RssAdapter` | `@effect/platform HttpClient` + XML parser | In-process | Feed manager, GUID dedup, adaptive polling |
| `FileWatchAdapter` | Holonet bridge (NATS subscribe) | Sidecar -> NATS | Filesystem watcher in sidecar, signals via NATS |
| `SerialAdapter` | Holonet bridge (NATS subscribe) | Sidecar -> NATS | Serial port in sidecar, signals via NATS |
| `MidiAdapter` | Web MIDI API / node-midi | In-process (stub) | MIDI controller input |
| `OscAdapter` | UDP socket (sidecar) | Sidecar -> NATS (stub) | OSC protocol for sensor networks |

### TSG.2.2.4 HTTP Adapter Four Modes

The HTTP adapter supports 4 ingestion modes [ADR-004], selectable via configuration:

| Mode | Mechanism | Use Case | Polling Strategy |
|------|-----------|----------|-----------------|
| **Poll** | Periodic `GET` requests | REST APIs, threat intel feeds | Adaptive: hash response, speed up on change |
| **SSE** | Server-Sent Events via `HttpClientResponse.stream` | Real-time event streams | Persistent connection, auto-reconnect |
| **Webhook** | `HttpApi` + `HttpApiEndpoint.post` server | External push notifications | Schema-validated typed endpoint |
| **Long-poll** | Blocking `GET` with timeout | APIs with long-poll support | Immediate re-request after response |

### TSG.2.2.5 AdapterManager — Hot-Plug Lifecycle

The `AdapterManager` service (`services/AdapterManager.ts`, 411 lines) provides runtime adapter registration and removal [ADR-002]. Key implementation details verified against source code:

**Signal Queue:** `Queue.bounded<BaseSignal>(4096)` — confirmed at line 116. This bounded queue provides backpressure: if the pipeline cannot consume signals fast enough, adapters will block on `Queue.offer()`.

**Scoped Lifecycle:** Each adapter registration creates a dedicated `Scope` via `Scope.make()`. When an adapter is unregistered, its scope is closed via `Scope.close()`, which triggers all `Effect.addFinalizer()` cleanup handlers registered by the adapter.

**Reactive State Atoms:** The AdapterManager maintains several atoms for UI observability:

| Atom | Type | Purpose |
|------|------|---------|
| `adapterRegistryAtom` | `Map<string, SourceAdapterShape>` | Active adapter registry |
| `adapterHealthAtom` | `Map<string, AdapterHealth>` | Per-adapter health status |
| `totalSignalCountAtom` | `number` | Total signals received across all adapters |
| `lifecycleEventsAtom` | `Array<LifecycleEvent>` | Adapter registration/unregistration log |

**Note on error count:** `AdapterManager.ts` defines an 18th tagged error class (`AdapterManagerError`) beyond the 17 adapter error classes in `errors.ts`. ADR-006 and SPEC.md state "17 typed error classes" — this count refers to the adapter-specific errors only and SHOULD be clarified to "17 adapter errors + 1 structural error = 18 total." See [ADR INDEX — Consistency Note 6.2][INDEX-6.2].

### TSG.2.2.6 Deployment Patterns

Adapters deploy in one of three patterns depending on their I/O requirements:

```
IN-PROCESS (low latency, direct access):
  Source API ──▶ SourceAdapter (Effect.Service) ──push──▶ Queue ──▶ d2ts

SIDECAR (hardware/native access):
  Hardware ──▶ Sidecar daemon (Node/Bun) ──NATS publish──▶
  ──NATS subscribe──▶ HolonetBridgeAdapter ──push──▶ Queue ──▶ d2ts

NATS LEAF (edge/remote):
  Remote sensor ──▶ Pi sidecar ──▶ NATS leaf node ──▶ NATS cluster ──▶
  ──subscribe──▶ NatsAdapter ──push──▶ Queue ──▶ d2ts
```

Implementations MUST use the sidecar pattern for adapters that require native hardware access, UDP socket listeners, or CPU-intensive processing [TSG.1-R9].

---

## TSG.2.3 Schema Registry

### TSG.2.3.1 Registry Architecture

The Schema Registry provides runtime signal type discovery and validation. It is backed by a NATS KV bucket (`tsingou-schemas`) and exposed as an `Effect.Service`.

```typescript
const SchemaRegistryEntry = Schema.Struct({
  kind:       Schema.String,         // Signal kind (KV key)
  version:    Schema.Number,         // Schema version (monotonic)
  schema:     Schema.Unknown,        // Serialized Schema AST (JSONSchema.make output)
  createdAt:  Schema.DateFromSelf,
  createdBy:  Schema.String,
  deprecated: Schema.optional(Schema.Boolean),
})
```

### TSG.2.3.2 Operations

| Operation | NATS KV Primitive | Purpose |
|-----------|------------------|---------|
| `register(entry)` | `kv.put(kind, JSON.stringify(entry))` | Register a new signal schema |
| `lookup(kind)` | `kv.get(kind)` | Retrieve schema for validation at ingest |
| `watch()` | `kv.watch({ key: '>' })` | Real-time schema change notifications |
| `list()` | `kv.keys()` | Enumerate all registered schemas |

### TSG.2.3.3 Validation Pipeline Integration

At ingest, each signal's `kind` field is used to look up the corresponding schema from the registry. The `schemaValidate` custom operator [TSG.2.5.3] performs this validation within the d2ts ingest graph.

Signals with a `kind` matching a `KnownSignalKind` are validated against their static extension schema. Signals with a custom `kind` are validated against the dynamically registered schema from the NATS KV bucket.

Implementations MUST validate all signals at ingest. Signals that fail validation MUST be routed to a dead-letter queue or logged with a `SignalValidationError` [TSG.2.6].

---

## TSG.2.4 Differential Dataflow (d2ts)

### TSG.2.4.1 Pipeline Architecture

Tsingou uses d2ts (`@electric-sql/d2ts`) for incremental computation [ADR-001]. The pipeline uses a tiered graph topology:

```
┌──────────────────────────────────────────────────────┐
│                 AdapterManager.signalQueue             │
│                 (Queue.bounded<BaseSignal>(4096))      │
└─────────────────────────┬────────────────────────────┘
                          │
                          ▼ TsingouFlow drain loop
┌──────────────────────────────────────────────────────┐
│                   INGEST GRAPH (D2)                    │
│                                                        │
│  Consumer fiber drains Queue.takeAll(signalQueue)      │
│  → input.sendData(version, MultiSet(signals))          │
│                                                        │
│  Operators:                                            │
│    1. schemaValidate(SchemaRegistry) — validate kind   │
│    2. map(normalize timestamps)      — uniform times   │
│    3. map(tag with source metadata)  — enrichment      │
│    4. consolidate()                  — merge retracts   │
│                                                        │
│  Output: normalized MultiSet<BaseSignal>               │
└─────────────────────────┬────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────┐
│                  DERIVED GRAPH (D2)                     │
│                                                        │
│  Inputs:                                               │
│    - Ingest output (normalized signals)                │
│    - Historical data (JetStream replay)                │
│    - Module state (feedback loop)                      │
│                                                        │
│  Operators (configurable per analysis session):        │
│    - join    (cross-source correlation)                │
│    - reduce  (aggregation, counting)                   │
│    - count   (signal frequency)                        │
│    - topK    (most frequent signals)                   │
│    - window  (sliding time window) [TSG.2.5.1]        │
│    - throttle(rate limiting)       [TSG.2.5.2]        │
│    - iterate (convergence, anomaly detection)          │
│                                                        │
│  Output: derived state collections                     │
└─────────────────────────┬────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────┐
│                    OUTPUT BRIDGE                        │
│                                                        │
│  d2ts output() → Effect.Queue(1024)                    │
│  Consumer fiber → batch(8) → Atom.set()                │
│  Atoms feed rendering layers via useAtomValue()        │
└──────────────────────────────────────────────────────┘
```

### TSG.2.4.2 Version Strategy

d2ts uses multi-dimensional versioning for partial ordering [ADR-001]. Each version is a tuple `[tick, source_seq]`:

```typescript
import { v, Antichain } from '@electric-sql/d2ts'

// Create a version: v([tick, source_seq])
const makeVersion = (tick: number, sourceSeq: number) => v([tick, sourceSeq])

// Frontier: "I will never send data for versions <= this"
const makeFrontier = (tick: number, sourceSeq: number) =>
  new Antichain([v([tick, sourceSeq])])
```

| Dimension | Name | Semantics | Advancement |
|-----------|------|-----------|-------------|
| 0 | `tick` | Global logical clock | Incremented once per processing cycle by `TsingouFlow` |
| 1 | `source_seq` | Per-source sequence number | Incremented per signal by the producing adapter |

This two-dimensional versioning allows:
1. **Temporal ordering** — Signals from the same cycle share a tick.
2. **Causal ordering** — Signals from the same source have a total order via `source_seq`.
3. **Partial ordering** — Signals from different sources at the same tick are unordered (correct for concurrent sources).
4. **Frontier advancement** — Each source advances its own dimension independently, avoiding head-of-line blocking.

### TSG.2.4.3 MultiSet Semantics

d2ts operates on `MultiSet<T>` collections where each element has a multiplicity [ADR-001]:

```typescript
import { MultiSet } from '@electric-sql/d2ts'

// Event accumulation: +1 for new signals
const signalToMultiSet = (signal: BaseSignal): MultiSet<BaseSignal> =>
  new MultiSet([[signal, 1]])

// Explicit retraction: -1 (e.g., source disconnected, signal invalidated)
const retractSignal = (signal: BaseSignal): MultiSet<BaseSignal> =>
  new MultiSet([[signal, -1]])

// Batch conversion
const batchToMultiSet = (signals: BaseSignal[]): MultiSet<BaseSignal> =>
  new MultiSet(signals.map(s => [s, 1] as [BaseSignal, number]))
```

Tsingou uses append-only semantics by default: signals accumulate with multiplicity +1. Explicit retractions (-1) are only used for:
- Source disconnection (retract all pending signals from that source)
- Signal invalidation (analyst marks signal as false positive)
- Schema migration (retract signals with old schema version)

### TSG.2.4.4 Current Implementation Status

The d2ts graph processing is currently **stubbed** in `TsingouFlow.ts:122-135`:

```typescript
// =================================================================
// d2ts GRAPH PROCESSING (stubbed until @electric-sql/d2ts installed)
//
// When d2ts is available, this section will:
//   1. Create MultiSet from signalArray via fromBatch()
//   2. Feed into ingest D2 graph input
//   3. Send frontier advancement [tick, source_seq]
//   4. Run ingest graph
//   5. Ingest output feeds derived graph input
//   6. Run derived graph
//   7. Derived output() pushes to outputBridge.enqueue
//
// For now: pass-through (signals go directly to output bridge)
// =================================================================

for (const signal of signalArray) {
  yield* Queue.offer(outputBridge.enqueue, signal)
}
```

This pass-through stub preserves the full service contract and data flow. The d2ts integration will be activated when `@electric-sql/d2ts` stabilizes. The stub MUST NOT be removed until d2ts is fully wired.

### TSG.2.4.5 Processing Cycle

The `TsingouFlow` service runs a continuous processing loop (verified from `TsingouFlow.ts:100-153`):

1. **Drain** — `Queue.takeAll(adapterManager.signalQueue)` collects all available signals.
2. **Tick** — Global tick counter is incremented via `Atom.set(tickAtom, currentTick + 1)`.
3. **Process** — Signals are fed through the d2ts graph (currently: pass-through to output bridge).
4. **Measure** — Cycle duration is recorded in `cycleDurationMsAtom`. Throughput is computed over a rolling 5-second window and stored in `throughputAtom`.
5. **Yield** — If no signals are available, `Effect.sleep('1 millis')` prevents busy-waiting.

The loop runs as a forked fiber via `Effect.fork(Effect.forever(processCycle))` and is interrupted on shutdown via `Fiber.interrupt(processingFiber)`.

---

## TSG.2.5 Custom Operators

### TSG.2.5.1 window(durationMs)

A sliding time window operator that emits the collection of signals within the last N milliseconds.

```typescript
// Extends d2ts UnaryOperator
// Internal state: buffer keyed by timestamp
// Each run():
//   1. Evict entries where (now - entry.timestamp) > durationMs
//   2. Emit current window contents as MultiSet
//   3. Retract expired entries via -1 multiplicity
```

Use cases:
- "Show me all signals from the last 5 minutes"
- "Alert when signal rate exceeds threshold over 30-second window"
- Pattern-of-life detection over hourly/daily windows

### TSG.2.5.2 throttle(maxPerVersion)

A rate-limiting operator that passes at most N signals per version, dropping excess.

```typescript
// Extends d2ts UnaryOperator
// Internal state: count per version
// Each run():
//   1. Count signals at current version
//   2. Pass first maxPerVersion signals
//   3. Drop remainder (log as dropped)
```

Use cases:
- Protecting the derived graph from burst traffic
- Limiting rendering updates to a sustainable frame rate
- Prioritizing signals by source (lower throttle for high-priority sources)

### TSG.2.5.3 schemaValidate(registry)

A validation operator that validates incoming signals against the schema registry.

```typescript
// Extends d2ts UnaryOperator
// Dependencies: SchemaRegistry service
// Each run():
//   1. For each signal: lookup schema by signal.kind
//   2. If known kind: validate against static extension schema
//   3. If custom kind: validate against dynamic registry schema
//   4. Pass valid signals, retract invalid signals
//   5. Log validation errors via Effect.log
```

Implementations MUST place `schemaValidate` as the first operator in the ingest graph. Invalid signals MUST NOT propagate to the derived graph.

### TSG.2.5.4 Backpressure Strategy

The signal pipeline implements backpressure at multiple points to prevent resource exhaustion under burst traffic:

| Pressure Point | Mechanism | Capacity | Overflow Behavior |
|----------------|-----------|----------|-------------------|
| Adapter → SignalQueue | `Queue.bounded(1024)` | 1,024 signals | Back-pressures adapter fiber (blocks on `Queue.offer`) |
| d2ts ingest graph | Tick-driven pull | 1 tick per cycle | Signals accumulate in queue until next tick |
| OutputBridge | `Queue.bounded(4096)` | 4,096 signals | Back-pressures processing loop |
| OutputBridge → Atoms | `batch(8)` | 8 signals/write | Throttles React re-renders |

When all adapters produce signals simultaneously, the bounded queues ensure that no single adapter can monopolize memory. The processing loop drains `Queue.takeAll` each cycle, which collects all available signals up to the queue capacity, providing natural batching under load.

Under extreme burst conditions (e.g., an RSS adapter resolving thousands of historical entries at once), the following cascade occurs:

1. Adapter fiber blocks on `Queue.offer` when SignalQueue is full.
2. Processing loop drains queue on next tick, freeing capacity.
3. If OutputBridge queue fills, processing loop blocks on `outputBridge.enqueue`.
4. React rendering is decoupled — batch writes ensure at most 1 atom update per 8 signals.

This layered backpressure model ensures that the system degrades gracefully under load rather than consuming unbounded memory. The `throughputAtom` and `cycleDurationMsAtom` provide observability into pipeline pressure.

---

## TSG.2.6 Error Handling

### TSG.2.6.1 Error Hierarchy

Tsingou uses `Data.TaggedError` for all error types [ADR-006]. Each error has a `_tag` discriminator that enables `Effect.catchTag()` and `Effect.catchTags()` for precision recovery.

The adapter error hierarchy is defined in `adapters/errors.ts` (188 lines, verified). There are 17 adapter-specific error classes plus 1 structural error class:

### TSG.2.6.2 Adapter Error Classes (17)

| # | Error Class | Tag | Category | Retryable |
|---|------------|-----|----------|-----------|
| 1 | `AdapterConnectError` | `AdapterConnectError` | Connection | Yes |
| 2 | `AdapterDisconnectError` | `AdapterDisconnectError` | Connection | No |
| 3 | `HttpRequestError` | `HttpRequestError` | HTTP | Yes |
| 4 | `HttpParseError` | `HttpParseError` | HTTP | No |
| 5 | `HttpAuthError` | `HttpAuthError` | HTTP | No (config fix needed) |
| 6 | `HttpTimeoutError` | `HttpTimeoutError` | HTTP | Yes |
| 7 | `SseConnectionError` | `SseConnectionError` | HTTP/SSE | Yes |
| 8 | `WsConnectError` | `WsConnectError` | WebSocket | Yes |
| 9 | `WsMessageError` | `WsMessageError` | WebSocket | No |
| 10 | `NatsSubscribeError` | `NatsSubscribeError` | NATS | Yes |
| 11 | `FileWatchError` | `FileWatchError` | FileSystem | Yes |
| 12 | `FileParseError` | `FileParseError` | FileSystem | No |
| 13 | `RssFetchError` | `RssFetchError` | RSS | Yes |
| 14 | `RssParseError` | `RssParseError` | RSS | No |
| 15 | `SerialConnectError` | `SerialConnectError` | Serial | Yes |
| 16 | `SignalValidationError` | `SignalValidationError` | Validation | No |
| 17 | `SignalQueueFullError` | `SignalQueueFullError` | Backpressure | Yes (after drain) |

### TSG.2.6.3 Structural Error Class (1)

| # | Error Class | Tag | Location | Purpose |
|---|------------|-----|----------|---------|
| 18 | `AdapterManagerError` | `AdapterManagerError` | `AdapterManager.ts` | Adapter registration/unregistration failures |

### TSG.2.6.4 Union Type

```typescript
const AdapterError = Schema.Union(
  AdapterConnectError,
  AdapterDisconnectError,
  HttpRequestError,
  HttpParseError,
  HttpAuthError,
  HttpTimeoutError,
  SseConnectionError,
  WsConnectError,
  WsMessageError,
  NatsSubscribeError,
  FileWatchError,
  FileParseError,
  RssFetchError,
  RssParseError,
  SerialConnectError,
  SignalValidationError,
  SignalQueueFullError,
)
type AdapterError = typeof AdapterError.Type
```

### TSG.2.6.5 Recovery Patterns

Error recovery uses `Effect.catchTag` for single-error recovery and `Effect.catchTags` for multi-error matching:

```typescript
// Single-error recovery — retry on connect failure
adapter.connect(config).pipe(
  Effect.catchTag('AdapterConnectError', (err) =>
    Effect.retry(adapter.connect(config), { times: 3, schedule: Schedule.exponential('1 second') })
  )
)

// Multi-error recovery — handle HTTP error family
httpAdapter.fetch(url).pipe(
  Effect.catchTags({
    HttpRequestError: (err) => Effect.retry(/* ... */),
    HttpAuthError:    (err) => Effect.fail(new AdapterConnectError({ /* config error */ })),
    HttpTimeoutError: (err) => Effect.retry(/* ... */),
    HttpParseError:   (err) => Effect.log(`Parse error: ${err.message}`).pipe(Effect.zipRight(Effect.void)),
  })
)
```

### TSG.2.6.6 Error Propagation Through Pipeline

Errors propagate through the pipeline in typed channels:

```
Adapter ──AdapterError──▶ AdapterManager ──AdapterManagerError──▶ TsingouFlow
                                                                      │
Signal validation ──SignalValidationError──▶ Ingest graph (retract)  │
                                                                      │
Queue full ──SignalQueueFullError──▶ Adapter (backpressure signal)     │
```

Implementations MUST NOT use `Effect.catchAll` to swallow typed errors. Each error MUST be handled by its tag or explicitly propagated to the caller.

---

## TSG.2.7 NATS Subject Topology

### TSG.2.7.1 Subject Hierarchy

```
tsingou.
├── signal.                              # Raw signal subjects
│   ├── {kind}.{sourceId}               # Per-source signals
│   │   e.g., tsingou.signal.rss.bbc-news
│   │   e.g., tsingou.signal.serial.arduino-sensor-3
│   │   e.g., tsingou.signal.nats.external-telemetry
│   └── >                               # Wildcard: all signals
│
├── derived.                             # Derived state subjects
│   ├── {computationId}                 # Per-computation results
│   │   e.g., tsingou.derived.cross-source-correlation
│   │   e.g., tsingou.derived.anomaly-detection-1
│   └── >                               # Wildcard: all derived
│
├── schema.                              # Schema registry notifications
│   └── {kind}                          # Schema change for kind
│
├── adapter.                             # Adapter telemetry
│   ├── {adapterId}.health              # Health status updates
│   └── {adapterId}.control             # Control commands (start/stop)
│
└── internal.                            # Internal system events
    ├── {component}.{event}             # Component lifecycle events
    └── >                               # Wildcard: all internal
```

### TSG.2.7.2 JetStream Stream Configuration

| Stream | Subjects | Retention | Max Age | Max Bytes | Purpose |
|--------|---------|-----------|---------|-----------|---------|
| `TSINGOU_SIGNALS` | `tsingou.signal.>` | Limits | 24h | 1 GB | Signal replay for retrospective analysis |
| `TSINGOU_DERIVED` | `tsingou.derived.>` | Limits | 24h | 512 MB | Derived state history |
| `TSINGOU_AUDIT` | `tsingou.adapter.*.health`, `tsingou.internal.>` | Workqueue | 7d | 256 MB | Audit trail, lifecycle events |

### TSG.2.7.3 Consumer Patterns

| Consumer | Stream | Deliver Policy | Use Case |
|----------|--------|---------------|----------|
| Real-time analysis | `TSINGOU_SIGNALS` | `DeliverNew` | Live signal processing |
| Retrospective replay | `TSINGOU_SIGNALS` | `DeliverByStartTime` | Historical analysis from a specific timestamp |
| Audit review | `TSINGOU_AUDIT` | `DeliverAll` | Full lifecycle review |

---

## TSG.2.8 OutputBridge

### TSG.2.8.1 Architecture

The OutputBridge connects the d2ts pipeline output to Tsingou's rendering layers. It uses an `Effect.Queue` as a buffer and a consumer fiber that batches signals into atom updates.

The bridge is created by `TsingouFlow` with the following configuration (verified from `TsingouFlow.ts:77-81`):

```typescript
const outputBridge = yield* makeOutputBridge({
  queueCapacity: 1024,    // Output queue depth
  maxAtomItems: 10_000,   // Maximum signals in activeSignalsAtom
  batchSize: 8,           // Signals per atom update
})
```

### TSG.2.8.2 Data Flow

```
d2ts derived graph output()
    │
    ▼ Queue.offer(outputBridge.enqueue, signal)
┌────────────────────────────────┐
│  Effect.Queue(1024)             │  ◄── Bounded buffer
│  (backpressure if full)        │
└────────────┬───────────────────┘
             │
             ▼ Consumer fiber: Queue.takeAll → batch(8)
┌────────────────────────────────┐
│  Atom.set(activeSignalsAtom,   │  ◄── Reactive state update
│    [...existing, ...batch]     │
│    .slice(-maxAtomItems))      │      Capped at 10,000 items
│                                │
│  Atom.set(derivedSignalCountAtom, │  ◄── Counter update
│    count + batch.length)       │
└────────────────────────────────┘
             │
             ▼ React subscribes
┌────────────────────────────────┐
│  useAtomValue(activeSignalsAtom)│
│                                │
│  z:0 R3F ──▶ 3D signal graph  │
│  z:1 visx ──▶ timeline chart  │
│  z:2 p5   ──▶ spectrum viz    │
│  z:3 DOM  ──▶ signal table    │
└────────────────────────────────┘
```

### TSG.2.8.3 Output Atoms

| Atom | Type | Purpose | Consumer |
|------|------|---------|----------|
| `activeSignalsAtom` | `BaseSignal[]` | Most recent signals (capped at `maxAtomItems`) | All 4 rendering layers |
| `derivedSignalCountAtom` | `number` | Total derived signals produced | DOM status display |
| `signalCountAtom` | `number` | Total signals through the bridge | visx counters |
| `topKSignalsAtom` | `BaseSignal[]` | Top-K most frequent signal kinds | visx ranking display |
| `crossCorrelationAtom` | `Correlation[]` | Cross-source correlation results | R3F network graph |
| `anomalyAtom` | `Anomaly[]` | Detected anomalies | R3F alert markers, DOM alerts |

### TSG.2.8.4 Zero-Coupling Guarantee

The OutputBridge enforces zero coupling between the pipeline and rendering layers. Rendering layers subscribe to atoms via `useAtomValue()` and have no knowledge of the pipeline, d2ts, queues, or fibers. The pipeline has no knowledge of rendering layers.

This separation MUST be maintained. Rendering components MUST NOT import from `services/` or `graph/`. Pipeline services MUST NOT import from rendering components.

---

## TSG.2.9 Normative Requirements

### MUST Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.2-R1 | Every signal MUST conform to the BaseSignal schema | TSG.2.1.1 |
| TSG.2-R2 | Signal IDs MUST be generated via nanoid() or UUID v4 | TSG.2.1.2 |
| TSG.2-R3 | Timestamps MUST be set at ingest time if not provided by the source | TSG.2.1.2 |
| TSG.2-R4 | New adapter extensions MUST use Schema.extend(BaseSignal, ...) | TSG.2.1.3 |
| TSG.2-R5 | Every source adapter MUST implement the SourceAdapterShape interface | TSG.2.2.1 |
| TSG.2-R6 | All signals MUST be validated at ingest via the schemaValidate operator | TSG.2.3.3 |
| TSG.2-R7 | Invalid signals MUST NOT propagate to the derived graph | TSG.2.3.3 |
| TSG.2-R8 | The schemaValidate operator MUST be the first operator in the ingest graph | TSG.2.5.3 |
| TSG.2-R9 | Implementations MUST NOT use Effect.catchAll to swallow typed errors | TSG.2.6.6 |
| TSG.2-R10 | Rendering components MUST NOT import from services/ or graph/ | TSG.2.8.4 |
| TSG.2-R11 | Pipeline services MUST NOT import from rendering components | TSG.2.8.4 |
| TSG.2-R12 | The d2ts stub MUST NOT be removed until d2ts is fully wired | TSG.2.4.4 |

### SHOULD Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.2-S1 | ADR-006 and SPEC.md SHOULD clarify the error count as 17 adapter + 1 structural = 18 total | TSG.2.2.5 |
| TSG.2-S2 | Signals failing validation SHOULD be routed to a dead-letter queue | TSG.2.3.3 |

### MAY Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.2-M1 | Adapters MAY use adaptive polling strategies (hash-based, exponential backoff) | TSG.2.2.4 |
| TSG.2-M2 | The derived graph MAY accept additional inputs beyond ingest output (JetStream replay, feedback) | TSG.2.4.1 |

---

## TSG.2.10 References

| Key | Reference |
|-----|-----------|
| [RFC2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997 |
| [RFC8174] | Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017 |
| [ADR-001] | ADR-001: d2ts as Signal Pipeline Core. `docs/tsingou/adr/ADR-001-d2ts-as-signal-pipeline.md` |
| [ADR-002] | ADR-002: Source Adapter Contract. `docs/tsingou/adr/ADR-002-source-adapter-contract.md` |
| [ADR-004] | ADR-004: @effect/platform for HTTP, WebSocket, FileSystem. `docs/tsingou/adr/ADR-004-effect-platform-adapters.md` |
| [ADR-006] | ADR-006: Tagged Errors Everywhere. `docs/tsingou/adr/ADR-006-tagged-errors-everywhere.md` |
| [ADR-011] | ADR-011: SDR Integration. `docs/tsingou/adr/ADR-011-sdr-gnu-radio-bridge.md` |
| [INDEX-6.2] | ADR Index — Consistency Note 6.2. `docs/tsingou/adr/INDEX.md` |
| [D2TS] | Electric SQL. "@electric-sql/d2ts — Differential dataflow in TypeScript." |
| [EFFECT] | Effect-TS. "Effect: A TypeScript library for building production-grade applications." |
| [EFFECT-SCHEMA] | Effect-TS. "@effect/schema — Schema validation and transformation." |
| [NATS] | NATS.io. "NATS — Cloud Native Messaging System." https://nats.io |
| [SIGMF] | The SigMF Specification. "Signal Metadata Format." https://sigmf.org |
