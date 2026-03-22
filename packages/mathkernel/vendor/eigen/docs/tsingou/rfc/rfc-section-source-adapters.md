# RFC-002 Section TSG.9: Source Adapter Contract

```
Section:       TSG.9 — Source Adapter Contract
Parent RFC:    RFC-002 (Tsingou — Signal Intelligence Visualization Platform)
Status:        DRAFT
Author:        graph-theory-specialist (Val)
Created:       2026-02-18
Dependencies:  TSG.7 (Signal Pipeline), TSG.8 (BaseSignal Schema), TSG.11 (NATS Fabric)
ADR:           ADR-002 (Source Adapter Contract — Effect.Service with Push API)
```

> This section specifies the universal source adapter contract for the Tsingou signal
> intelligence visualization platform. Every signal source — network feeds, messaging
> fabrics, hardware interfaces, file watchers — is normalized into the `BaseSignal`
> schema and delivered to the d2ts pipeline through a uniform `Effect.Service`-based
> contract. The contract defines scoped lifecycle management, hot-plug registration,
> health monitoring via atoms, backpressure via bounded queues, and a typed error
> hierarchy with 17 tagged error classes. The key words "MUST", "MUST NOT",
> "SHOULD", "SHOULD NOT", and "MAY" are to be interpreted as described in [RFC2119]
> and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#tsg91-conventions-and-terminology)
2.  [Architectural Overview](#tsg92-architectural-overview)
3.  [BaseSignal Schema](#tsg93-basesignal-schema)
4.  [SourceAdapterShape Interface](#tsg94-sourceadaptershape-interface)
5.  [Adapter Internals Factory](#tsg95-adapter-internals-factory)
6.  [SignalQueue and Backpressure](#tsg96-signalqueue-and-backpressure)
7.  [Scoped Lifecycle Contract](#tsg97-scoped-lifecycle-contract)
8.  [AdapterManager Service](#tsg98-adaptermanager-service)
9.  [Hot-Plug Registration Protocol](#tsg99-hot-plug-registration-protocol)
10. [Health Monitoring and Telemetry](#tsg910-health-monitoring-and-telemetry)
11. [Tagged Error Hierarchy](#tsg911-tagged-error-hierarchy)
12. [Adapter Catalog](#tsg912-adapter-catalog)
13. [Configuration Schema Patterns](#tsg913-configuration-schema-patterns)
14. [Sidecar Bridge Pattern](#tsg914-sidecar-bridge-pattern)
15. [Signal Kind Extensibility](#tsg915-signal-kind-extensibility)
16. [Pause and Resume Semantics](#tsg916-pause-and-resume-semantics)
17. [Integration with d2ts Pipeline](#tsg917-integration-with-d2ts-pipeline)
18. [Normative Constraints](#tsg918-normative-constraints)
19. [Worked Examples](#tsg919-worked-examples)
20. [Cross-References](#tsg920-cross-references-to-other-rfc-sections)
21. [Open Questions](#tsg921-open-questions)
22. [References](#tsg922-references)

---

## TSG.9.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### TSG.9.1.1 Terminology

| Term | Definition |
|------|-----------|
| **BaseSignal** | The universal signal schema carried by every signal in the pipeline [TSG.8] |
| **Source Adapter** | An `Effect.Service` instance that connects to an external signal source and normalizes data into `BaseSignal` |
| **SourceAdapterShape** | The TypeScript interface that all source adapter services MUST implement |
| **AdapterManager** | The `Effect.Service` that orchestrates adapter lifecycle (registration, health, shutdown) |
| **SignalQueue** | A bounded `Effect.Queue<BaseSignal>` shared across all adapters for backpressure-controlled signal delivery |
| **SignalQueueTag** | The `Context.Tag` that provides the shared signal queue to all adapters |
| **Hot-Plug** | Runtime addition or removal of adapters without pipeline restart |
| **Sidecar** | An out-of-process daemon (Node/Bun/Rust) that reads hardware/OS sources and publishes to NATS |
| **Holonet Bridge** | The generic adapter that subscribes to sidecar-published NATS subjects |
| **Signal Kind** | Discriminator string identifying the signal type (`"nats"`, `"http"`, `"websocket"`, etc.) |
| **Adapter Health** | A structured snapshot of adapter operational status (status, counts, latency) |
| **Scope** | An Effect resource boundary; closing a scope triggers all registered finalizers |
| **Atom-as-State** | The pattern where `Atom.make()` is the primary state primitive, with React subscribing via `useAtomValue()` |
| **d2ts** | Differential dataflow engine for incremental stream computation [TSG.26] |
| **Tick** | A global logical clock increment in the d2ts processing cycle |
| **Source Sequence** | A per-adapter monotonic counter for ordering signals within a single source |

### TSG.9.1.2 Architectural Position

The source adapter layer sits between external signal sources and the d2ts ingest
graph. It is Part II of the Tsingou architecture (Architecture, §TSG.6) and is a
prerequisite for all downstream processing:

```
External Sources          Adapter Layer                d2ts Pipeline
───────────────     ─────────────────────────     ─────────────────
  NATS server    →  NatsSourceAdapter            →
  HTTP APIs      →  HttpSourceAdapter            →  SignalQueue
  WebSocket      →  WebSocketSourceAdapter       →  (bounded 4096)  → Ingest Graph
  RSS feeds      →  RssSourceAdapter             →
  File watch     →  HolonetBridgeAdapter         →
  Serial/MIDI    →  HolonetBridgeAdapter         →
                    (managed by AdapterManager)
```

Every adapter implementation MUST conform to the `SourceAdapterShape` interface
(TSG.9.4) and register through the `AdapterManager` service (TSG.9.8).

### TSG.9.1.3 Design Lineage

The adapter contract derives from three architectural precedents:

1. **Holonet NatsConnectionService** — Scoped `Effect.acquireRelease` for connection
   lifecycle, where constructing the service opens the connection and scope closure
   triggers cleanup [ADR-003].

2. **TMNL Feed construct** — The `src/lib/streams` library's Feed pattern with
   lifecycle states (connecting, connected, degraded, error, disconnected) and
   health monitoring atoms.

3. **effect-atom Atom-as-State** — All operational state is stored in atoms, enabling
   direct React subscription without intermediate state management layers [ADR-002].

---

## TSG.9.2 Architectural Overview

### TSG.9.2.1 Push vs. Pull Design Decision

The adapter contract uses a **push-based** model rather than a pull-based (Stream
return) model. ADR-002 evaluated four options:

| Option | Model | Verdict | Rationale |
|--------|-------|---------|-----------|
| `Effect.Stream<BaseSignal>` | Pull | Rejected | Stream producers must be lazy; protocol-specific adapters are inherently imperative (event callbacks, message handlers) |
| `Effect.Service` with `push()` callback | Push | **Selected** | Natural fit for protocol event handlers; backpressure delegated to bounded Queue |
| `Effect.Channel<BaseSignal>` | Bidirectional | Rejected | Channel API is more complex than needed for unidirectional signal ingestion |
| `@effect/platform` native adapters | Pull | Rejected | Not all sources have platform-native abstractions (serial, MIDI, OSC) |

The push model works as follows:

1. Each adapter receives a reference to the shared `SignalQueue` via `Context.Tag`.
2. The adapter's internal event loop (NATS subscription, HTTP poll, WebSocket frames)
   invokes `Queue.offer(signalQueue, signal)` for each normalized signal.
3. The `Queue.offer` operation SUSPENDS if the queue is at capacity (backpressure).
4. The d2ts pipeline drains the queue from the other end.

### TSG.9.2.2 Service-Per-Adapter Pattern

Each adapter type is an `Effect.Service` with a `scoped` constructor:

```
class NatsSourceAdapter extends Effect.Service<NatsSourceAdapter>()(
  'tsingou/adapter/Nats',
  { scoped: Effect.gen(function* () { ... }) }
)
```

The `scoped` keyword means:
- Construction runs as a scoped effect (may acquire resources).
- Closing the scope triggers all `Effect.addFinalizer` callbacks.
- The service instance lives exactly as long as its scope.

### TSG.9.2.3 Adapter Classification

Adapters are classified by their ingestion model:

| Class | Adapters | Pattern | Push Mechanism |
|-------|----------|---------|----------------|
| **Subscription** | NATS, WebSocket | Persistent connection, server pushes data | Stream.runForEach → internals.push |
| **Polling** | HTTP (poll), RSS | Periodic request/response | Schedule.fixed → fetch → internals.push |
| **Server-Sent** | HTTP (SSE) | Persistent connection, server pushes events | Sse.makeChannel → Stream.mapEffect → internals.push |
| **Receiver** | HTTP (webhook) | Adapter hosts an endpoint, source sends data | HttpApi endpoint → internals.push |
| **Bridge** | HolonetBridge (file, serial, OSC) | Sidecar process publishes to NATS; adapter subscribes | NatsPubSubService.subscribe → internals.push |

Despite these differences, all adapters return the same `SourceAdapterShape` interface.

---

## TSG.9.3 BaseSignal Schema

The `BaseSignal` schema is the universal contract for all signals entering the pipeline.
It is defined in `tsingou-flow/schemas/base-signal.ts` and specified fully in [TSG.8].
This section provides the normative summary relevant to adapter implementations.

### TSG.9.3.1 Schema Definition

```typescript
const BaseSignal = Schema.Struct({
  id:        SignalId,          // Branded string, unique per ingestion event
  sourceId:  SourceId,          // Branded string, stable across reconnections
  timestamp: Schema.DateFromSelf, // Source-side timestamp when available
  version:   SignalVersion,      // [tick, source_seq] for d2ts partial ordering
  kind:      SignalKind,         // Discriminator: "nats" | "http" | "websocket" | ... | string
  payload:   Schema.Unknown,     // Typed by source-specific extensions
  metadata:  Schema.optional(SignalMetadata), // Adapter-specific context bag
})
```

### TSG.9.3.2 Field Semantics

**Table TSG.9-1: BaseSignal Field Semantics**

| Field | Type | Constraint | Adapter Responsibility |
|-------|------|-----------|----------------------|
| `id` | `SignalId` (branded string) | MUST be unique across the pipeline | Generated via `generateSignalId(prefix)` |
| `sourceId` | `SourceId` (branded string) | MUST be stable across reconnections | Set from adapter configuration |
| `timestamp` | `Date` | SHOULD reflect source-side time | Use source timestamp when available; fall back to `new Date()` |
| `version` | `[tick, source_seq]` | MUST be non-negative integers | Tick = 0 at ingestion (set by pipeline); source_seq = adapter-generated monotonic counter |
| `kind` | `SignalKind` | MUST match a known kind or registered extension | Set to adapter's kind string |
| `payload` | `unknown` | MUST contain source-specific data | Adapter-defined; typed by extension schemas |
| `metadata` | `Record<string, unknown>` | MAY contain adapter context | Optional; used for routing hints, provenance tags |

### TSG.9.3.3 Branded Identity Types

Signal identifiers use Schema-branded strings for type safety:

```typescript
const SignalId = Schema.String.pipe(Schema.brand('SignalId'), Schema.minLength(1))
const SourceId = Schema.String.pipe(Schema.brand('SourceId'), Schema.minLength(1))
```

An adapter MUST NOT create `SignalId` values through plain string casting. The
`generateSignalId(prefix)` utility function MUST be used:

```typescript
const generateSignalId = (prefix: string): SignalId =>
  `${prefix}_${Date.now()}_${_globalSeq++}` as SignalId
```

The `SourceId` is drawn from adapter configuration and remains constant across
reconnections. This enables the d2ts pipeline to maintain per-source state
(sequence numbers, frontier advancement) independently of connection lifecycle.

### TSG.9.3.4 Version Tuple

The `SignalVersion` is a two-dimensional tuple for d2ts partial ordering:

```typescript
const SignalVersion = Schema.Tuple(
  Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),  // dim 0: tick
  Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),  // dim 1: source_seq
)
```

- **Dimension 0 (tick)**: Global logical clock. Set to 0 by adapters at ingestion
  time; updated by the d2ts ingest graph during processing. This enables
  transport-locked processing (all sources advance together).

- **Dimension 1 (source_seq)**: Per-source sequence number. Set by adapters when
  available (e.g., NATS JetStream sequence). Enables independent source ordering
  without blocking on other sources.

### TSG.9.3.5 Signal Kind Discriminator

Known signal kinds are compile-time constants:

```typescript
const KnownSignalKind = Schema.Literal(
  'midi', 'osc', 'nats', 'http', 'serial', 'rss', 'websocket', 'file-watch'
)
const SignalKind = Schema.Union(KnownSignalKind, Schema.String)
```

The union with `Schema.String` enables runtime-registered signal kinds without
requiring code changes. Custom kinds are registered via the NATS KV schema registry
(see TSG.9.15).

### TSG.9.3.6 Source-Specific Extensions

Each adapter MAY define a typed extension schema via `Schema.extend`:

```typescript
const NatsSignal = Schema.extend(BaseSignal, Schema.Struct({
  kind: Schema.Literal('nats'),
  payload: Schema.Struct({
    subject: Schema.String,
    data: Schema.Unknown,
    sequence: Schema.optional(Schema.Number),
    replyTo: Schema.optional(Schema.String),
  }),
}))
```

Extension schemas refine the `payload` field with source-specific types while
preserving all `BaseSignal` fields. The d2ts ingest graph uses the `kind`
discriminator to route signals to the appropriate processing operators.

---

## TSG.9.4 SourceAdapterShape Interface

### TSG.9.4.1 Interface Definition

Every source adapter `Effect.Service` MUST return an object conforming to this
interface:

```typescript
interface SourceAdapterShape {
  /** Unique adapter instance ID (e.g., "nats-threat-intel-feed-1") */
  readonly adapterId: string

  /** Logical source ID (stable across reconnections) */
  readonly sourceId: string

  /** Signal kind this adapter produces (e.g., "nats", "http", "websocket") */
  readonly kind: string

  /** Health atom — React subscribes directly via useAtomValue() */
  readonly healthAtom: Atom.Atom<AdapterHealth>

  /** Signal count atom — total signals pushed since last connect */
  readonly signalCountAtom: Atom.Atom<number>

  /** Pause signal production (adapter stays connected but stops pushing) */
  readonly pause: Effect.Effect<void>

  /** Resume signal production after pause */
  readonly resume: Effect.Effect<void>
}
```

### TSG.9.4.2 Contract Invariants

The following invariants MUST hold for all implementations:

**SA-INV-1**: `adapterId` MUST be unique across all registered adapters. The
`AdapterManager` MUST reject registration of an adapter with a duplicate ID.

**SA-INV-2**: `sourceId` MUST be stable across reconnections. If an adapter
disconnects and reconnects (e.g., WebSocket reconnect), the `sourceId` MUST
remain the same. This is critical for d2ts frontier tracking.

**SA-INV-3**: `kind` MUST be a non-empty string matching either a known signal
kind or a runtime-registered extension kind.

**SA-INV-4**: `healthAtom` MUST reflect the current operational state of the
adapter. Health updates SHOULD occur within 500ms of a state change.

**SA-INV-5**: `signalCountAtom` MUST be monotonically non-decreasing during a
single connection session. It MAY reset to 0 on reconnection.

**SA-INV-6**: Calling `pause` followed by `resume` MUST restore signal production
without data loss (signals generated during the pause period MAY be discarded
by the source, but the adapter MUST NOT buffer unbounded data during pause).

**SA-INV-7**: The adapter MUST NOT push signals to the `SignalQueue` after its
scope has been closed. Scope closure triggers `Effect.addFinalizer` callbacks
that MUST interrupt all internal fibers before the adapter is unregistered.

### TSG.9.4.3 Extended Shapes

Adapters MAY extend `SourceAdapterShape` with additional capabilities:

```typescript
// WebSocket extends with bidirectional send + reconnect count
interface WsSourceAdapterShape extends SourceAdapterShape {
  readonly send: (data: string | Uint8Array) => Effect.Effect<void, Socket.SocketError>
  readonly reconnectCountAtom: Atom.Atom<number>
}

// RSS extends with feed metadata
interface RssFeedAdapterShape extends SourceAdapterShape {
  readonly feedTitle: string
  readonly lastETag: Atom.Atom<string | null>
}
```

Extended shapes MUST be type-safe supersets of `SourceAdapterShape`. The
`AdapterManager` operates on the base shape; extended capabilities are accessed
by consumers who know the specific adapter type.

---

## TSG.9.5 Adapter Internals Factory

### TSG.9.5.1 Purpose

The `makeAdapterInternals` factory function provides shared primitives that every
adapter implementation needs. It eliminates boilerplate and ensures consistent
behavior across all adapter types.

### TSG.9.5.2 Factory Definition

```typescript
const makeAdapterInternals = (
  adapterId: string,
  sourceId: string,
  kind: string,
): Effect.Effect<AdapterInternals, never, SignalQueueTag> =>
  Effect.gen(function* () {
    const queue = yield* SignalQueueTag

    const healthAtom = Atom.make<AdapterHealth>({
      status: 'connecting' as AdapterStatus,
      signalCount: 0,
      errorCount: 0,
    })

    const signalCountAtom = Atom.make(0)

    const updateHealth = (update: Partial<AdapterHealth>) => {
      const current = Atom.unsafeGet(healthAtom)
      Atom.set(healthAtom, { ...current, ...update })
    }

    const push = (signal: BaseSignal): Effect.Effect<void> =>
      Queue.offer(queue, signal).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            const count = Atom.unsafeGet(signalCountAtom) + 1
            Atom.set(signalCountAtom, count)
            updateHealth({
              signalCount: count,
              lastSignalAt: new Date(),
              status: 'connected',
            })
          }),
        ),
        Effect.catchAll((err) =>
          Effect.sync(() => {
            const current = Atom.unsafeGet(healthAtom)
            updateHealth({
              errorCount: current.errorCount + 1,
              status: 'degraded',
            })
          }),
        ),
        Effect.asVoid,
      )

    return { healthAtom, signalCountAtom, push, updateHealth }
  })
```

### TSG.9.5.3 Internals Interface

```typescript
interface AdapterInternals {
  readonly healthAtom: Atom.Atom<AdapterHealth>
  readonly signalCountAtom: Atom.Atom<number>
  readonly push: (signal: BaseSignal) => Effect.Effect<void>
  readonly updateHealth: (update: Partial<AdapterHealth>) => void
}
```

### TSG.9.5.4 Behavioral Guarantees

| Aspect | Behavior |
|--------|----------|
| Initial health | `{ status: 'connecting', signalCount: 0, errorCount: 0 }` |
| After first push | Status transitions to `'connected'`; `signalCount` incremented |
| Queue at capacity | `Queue.offer` suspends the calling fiber (backpressure) |
| Queue offer failure | `errorCount` incremented; status transitions to `'degraded'` |
| Health update atomicity | `Atom.unsafeGet` + `Atom.set` are synchronous; no Effect context required |

Every adapter implementation MUST call `makeAdapterInternals` at the beginning of
its `scoped` constructor. Adapters MUST NOT create their own health atoms or push
functions.

---

## TSG.9.6 SignalQueue and Backpressure

### TSG.9.6.1 Queue Architecture

All adapters share a single bounded `Effect.Queue<BaseSignal>`:

```typescript
const signalQueue = yield* Queue.bounded<BaseSignal>(4096)
```

The queue is created by the `AdapterManager` service and provided to all adapters
via the `SignalQueueTag` context tag:

```typescript
class SignalQueueTag extends Context.Tag('tsingou/SignalQueue')<
  SignalQueueTag,
  Queue.Queue<BaseSignal>
>() {}
```

### TSG.9.6.2 Backpressure Model

The Tsingou backpressure model uses **suspension-based flow control**:

```
Source → Adapter → Queue.offer ──┐
                                  │ suspends if capacity reached
                                  ▼
Pipeline ← Queue.take ──────────┘
```

**Table TSG.9-2: Backpressure Behavior**

| Condition | Behavior | Impact |
|-----------|----------|--------|
| Queue below capacity | `Queue.offer` completes immediately | Adapter continues at source rate |
| Queue at capacity (4096) | `Queue.offer` suspends the fiber | Adapter pauses until pipeline drains |
| Pipeline drains one slot | Suspended `Queue.offer` resumes | Adapter resumes pushing |
| Queue shutdown | `Queue.offer` fails | Adapter error handler invoked |

This model prevents unbounded memory growth without requiring explicit rate limiting
or dropping strategies. The 4096 capacity provides ~10 seconds of buffering at
~400 signals/second sustained throughput.

### TSG.9.6.3 Capacity Tuning

The queue capacity of 4096 is a fixed default selected by ADR-002. Implementations
SHOULD provide a configuration parameter for capacity tuning:

| Deployment | Recommended Capacity | Rationale |
|-----------|---------------------|-----------|
| Desktop analysis (Tauri) | 4096 (default) | Balanced memory vs. latency |
| High-throughput server | 16384 | Higher burst absorption |
| Constrained embedded | 1024 | Lower memory footprint |
| Development/testing | 256 | Surface backpressure issues early |

### TSG.9.6.4 Multi-Adapter Queue Sharing

All registered adapters push to the **same** queue. This design ensures:

1. **Single drain point**: The d2ts ingest graph has one input stream.
2. **Fair scheduling**: Effect's bounded queue provides FIFO ordering across adapters.
3. **Global backpressure**: If the pipeline stalls, ALL adapters suspend (correct
   behavior — pipeline cannot process, so no adapter should produce).

The alternative (one queue per adapter) was rejected because it would require a
merge operator before the ingest graph, adding complexity without benefit.

---

## TSG.9.7 Scoped Lifecycle Contract

### TSG.9.7.1 Lifecycle State Machine

Every source adapter follows this lifecycle state machine:

```
                     ┌──────────────────────────┐
                     │                          │
                     ▼                          │
  ┌──────────┐  construct   ┌──────────────┐   │  reconnect
  │          │ ─────────── →│              │───┘
  │ CREATED  │              │  CONNECTING  │
  │          │              │              │──── success ───→ CONNECTED
  └──────────┘              └──────────────┘
                                   │
                                   │ failure
                                   ▼
                            ┌──────────────┐
                            │              │
                            │    ERROR     │──── retry ───→ RECONNECTING
                            │              │
                            └──────────────┘
                                   │
                                   │ fatal / scope.close
                                   ▼
                            ┌──────────────┐
                            │              │
                            │ DISCONNECTED │
                            │              │
                            └──────────────┘
```

**Table TSG.9-3: Adapter Status Values**

| Status | Meaning | Transitions To |
|--------|---------|---------------|
| `disconnected` | Not connected, not attempting | `connecting` (on register) |
| `connecting` | Connection in progress | `connected`, `error` |
| `connected` | Active and receiving signals | `degraded`, `reconnecting`, `disconnected` |
| `degraded` | Connected but experiencing errors | `connected`, `error` |
| `reconnecting` | Lost connection, attempting recovery | `connected`, `error` |
| `error` | Fatal error, needs manual intervention | `disconnected` (on unregister) |

### TSG.9.7.2 Scoped Construction

Adapter services use the `scoped` constructor pattern:

```typescript
class NatsSourceAdapter extends Effect.Service<NatsSourceAdapter>()(
  'tsingou/adapter/Nats',
  {
    scoped: Effect.gen(function* () {
      // 1. Read configuration from Context
      const config = yield* NatsAdapterConfigTag

      // 2. Create internals (health atom, push function)
      const internals = yield* makeAdapterInternals(
        config.adapterId, config.sourceId, 'nats'
      )

      // 3. Acquire resources (subscribe to NATS subjects)
      const subscription = yield* pubsub.subscribe(subject, schema)

      // 4. Fork consumer fibers
      const fiber = yield* Effect.fork(
        Stream.runForEach(subscription, (msg) => internals.push(normalize(msg)))
      )

      // 5. Register cleanup (runs when scope closes)
      yield* Effect.addFinalizer(() =>
        Effect.gen(function* () {
          yield* Fiber.interrupt(fiber)
          internals.updateHealth({ status: 'disconnected' })
        })
      )

      // 6. Return the shape
      return { adapterId, sourceId, kind, healthAtom, signalCountAtom, pause, resume }
        satisfies SourceAdapterShape
    }),
  }
)
```

### TSG.9.7.3 Cleanup Guarantees

The scoped lifecycle provides these cleanup guarantees:

| Guarantee | Mechanism |
|-----------|-----------|
| All consumer fibers are interrupted | `Effect.addFinalizer → Fiber.interrupt(fiber)` |
| Network connections are closed | Protocol-specific cleanup in finalizer |
| Health status reflects disconnection | `updateHealth({ status: 'disconnected' })` in finalizer |
| Lifecycle event is emitted | `AdapterManager` logs `'unregistered'` event |
| Scope is non-reentrant | Once closed, scope cannot be reopened |

Finalizers run in `Effect.uninterruptibleMask` to prevent partial cleanup:

```typescript
yield* Effect.addFinalizer(() =>
  Effect.uninterruptibleMask((_restore) =>
    Effect.gen(function* () {
      for (const fiber of consumerFibers) {
        yield* Fiber.interrupt(fiber)
      }
      internals.updateHealth({ status: 'disconnected' })
    })
  )
)
```

### TSG.9.7.4 Reconnection Strategies

Adapters that support reconnection SHOULD use `Effect.retry` with a bounded schedule:

```typescript
// WebSocket exponential backoff: 500ms, 1s, 2s, 4s, ... up to 10 attempts
const reconnectSchedule = Schedule.exponential(Duration.millis(500)).pipe(
  Schedule.either(Schedule.recurs(10)),
  Schedule.tapOutput(() =>
    Effect.sync(() => {
      internals.updateHealth({ status: 'reconnecting' })
      Atom.set(reconnectCountAtom, Atom.unsafeGet(reconnectCountAtom) + 1)
    })
  ),
)
```

Reconnection MUST NOT change the `sourceId`. The d2ts pipeline relies on stable
source identity for frontier tracking and per-source state management.

**Table TSG.9-4: Reconnection Strategies by Adapter**

| Adapter | Strategy | Max Attempts | Backoff |
|---------|----------|-------------|---------|
| NATS | Handled by nats.js client | Configurable | Jitter + exponential |
| WebSocket | `Effect.retry(Schedule.exponential)` | 10 (default) | 500ms base, exponential |
| HTTP (poll) | Built into schedule loop | Unlimited (inherent) | Fixed poll interval |
| HTTP (SSE) | `Effect.retry` on stream error | 5 (transient) | 500ms base, exponential |
| RSS | Built into schedule loop | Unlimited (inherent) | Fixed poll interval + ETag |
| HolonetBridge | Delegated to NATS subscription | See NATS | See NATS |

---

## TSG.9.8 AdapterManager Service

### TSG.9.8.1 Service Definition

The `AdapterManager` is the central orchestrator for all source adapter instances:

```typescript
class AdapterManager extends Effect.Service<AdapterManager>()(
  'tsingou/AdapterManager',
  {
    scoped: Effect.gen(function* () {
      const signalQueue = yield* Queue.bounded<BaseSignal>(4096)
      const queueLayer = Layer.succeed(SignalQueueTag, signalQueue)

      // Counter fiber: polls adapter atoms every 500ms
      const counterFiber = yield* Effect.fork(
        Effect.forever(/* aggregate health + signal counts */)
      )

      yield* Effect.addFinalizer(() => shutdownAll)

      return {
        register,         // Hot-plug a new adapter
        registerSimple,   // Simplified registration API
        unregister,       // Remove and cleanup an adapter
        pauseAdapter,     // Pause a specific adapter
        resumeAdapter,    // Resume a specific adapter
        list,             // List all registered adapters
        getHealth,        // Get health for a specific adapter
        getAdapter,       // Get adapter shape by ID
        shutdownAll,      // Graceful shutdown of all adapters
        signalQueue,      // The shared signal queue (for pipeline drain)
      }
    }),
  }
)
```

### TSG.9.8.2 State Atoms

The `AdapterManager` maintains its state in module-level atoms:

```typescript
// Live registry: adapterId → { shape, scope, registeredAt }
const adapterRegistryAtom = Atom.make(new Map<string, RegisteredAdapter>())

// Aggregated health: adapterId → AdapterHealth
const adapterHealthAtom = Atom.make(new Map<string, AdapterHealth>())

// Global signal count (sum of all adapter counts)
const totalSignalCountAtom = Atom.make(0)

// Lifecycle event log (capped at 200 entries, trimmed to 100)
const lifecycleEventsAtom = Atom.make<ReadonlyArray<LifecycleEvent>>([])
```

React components subscribe to these atoms directly:

- **DOM layer**: Adapter status panel → `adapterRegistryAtom`, `adapterHealthAtom`
- **visx layer**: Signal throughput chart → `totalSignalCountAtom`
- **DOM layer**: Lifecycle event log → `lifecycleEventsAtom`

### TSG.9.8.3 Health Aggregation

The `AdapterManager` runs a background fiber that aggregates health data every 500ms:

```typescript
const counterFiber = yield* Effect.fork(
  Effect.forever(
    Effect.gen(function* () {
      const registry = Atom.unsafeGet(adapterRegistryAtom)
      let total = 0
      const healthMap = new Map<string, AdapterHealth>()
      for (const [id, entry] of registry) {
        const count = Atom.unsafeGet(entry.shape.signalCountAtom)
        total += count
        const health = Atom.unsafeGet(entry.shape.healthAtom)
        healthMap.set(id, health)
      }
      Atom.set(totalSignalCountAtom, total)
      Atom.set(adapterHealthAtom, healthMap)
      yield* Effect.sleep('500 millis')
    })
  )
)
```

The 500ms polling interval provides a balance between UI responsiveness and
computational overhead. Implementations MAY adjust this interval.

### TSG.9.8.4 Shutdown Protocol

Graceful shutdown proceeds in order:

1. Unregister all adapters (closes their scopes, triggers finalizers).
2. Shutdown the signal queue (`Queue.shutdown`).
3. Interrupt the counter fiber (`Fiber.interrupt`).
4. Emit lifecycle event (`'shutdown'`).

```typescript
const shutdownAll: Effect.Effect<void> = Effect.gen(function* () {
  const registry = Atom.unsafeGet(adapterRegistryAtom)
  const ids = Array.from(registry.keys())

  yield* Effect.forEach(ids, (id) =>
    unregister(id).pipe(
      Effect.catchAll((err) =>
        Effect.log(`Shutdown error for ${id}: ${err.message}`)
      ),
    ),
  )

  yield* Queue.shutdown(signalQueue)
  yield* Fiber.interrupt(counterFiber)
})
```

The `AdapterManager` scope finalizer calls `shutdownAll` automatically when the
parent scope (the `TsingouFlow` service or application root) closes.

---

## TSG.9.9 Hot-Plug Registration Protocol

### TSG.9.9.1 Registration API

The `AdapterManager` provides two registration methods:

**Method 1: Layer-based registration** (full control)

```typescript
const register = <S extends SourceAdapterShape>(
  adapterLayer: Layer.Layer<any, any, any>,
  extract: (ctx: Context.Context<any>) => S,
  baseLayer?: Layer.Layer<any, any, never>,
): Effect.Effect<S, AdapterManagerError>
```

This method is used when the adapter has complex layer dependencies (e.g., Holonet
services). The `extract` function pulls the `SourceAdapterShape` from the built
context.

**Method 2: Simple registration** (common case)

```typescript
const registerSimple = (
  make: Effect.Effect<SourceAdapterShape, any, any>,
  deps?: Layer.Layer<any, any, never>,
): Effect.Effect<SourceAdapterShape, AdapterManagerError>
```

This method accepts a scoped effect that directly produces a `SourceAdapterShape`.
The `AdapterManager` manages the scope and provides the `SignalQueueTag` automatically.

### TSG.9.9.2 Registration Protocol

The registration protocol follows these steps:

```
1. Fork a dedicated Scope for the new adapter
2. Build the adapter layer within the scope (compose SignalQueue + deps)
3. Extract the SourceAdapterShape from the built context
4. Check for duplicate adapterId
   ├─ Duplicate: Close the new scope, return AdapterManagerError
   └─ Unique: Continue
5. Add to adapterRegistryAtom
6. Emit 'registered' lifecycle event
7. Return the SourceAdapterShape
```

### TSG.9.9.3 Unregistration Protocol

```
1. Look up adapter by ID in adapterRegistryAtom
   ├─ Not found: Return AdapterManagerError
   └─ Found: Continue
2. Close the adapter's scope (triggers all finalizers)
   ├─ Runs inside Effect.uninterruptibleMask (no partial cleanup)
   └─ Scope close errors are logged, not propagated
3. Remove from adapterRegistryAtom
4. Remove from adapterHealthAtom
5. Emit 'unregistered' lifecycle event
```

### TSG.9.9.4 Duplicate Detection

The `AdapterManager` MUST reject registration of an adapter whose `adapterId`
already exists in the registry:

```typescript
const existing = Atom.unsafeGet(adapterRegistryAtom)
if (existing.has(shape.adapterId)) {
  yield* Scope.close(adapterScope, { _tag: 'Success', value: undefined })
  return yield* new AdapterManagerError({
    message: `Adapter already registered: ${shape.adapterId}`,
    adapterId: shape.adapterId,
  })
}
```

The newly created scope is closed immediately to prevent resource leaks when
rejecting a duplicate.

---

## TSG.9.10 Health Monitoring and Telemetry

### TSG.9.10.1 AdapterHealth Schema

```typescript
const AdapterHealth = Schema.Struct({
  status: AdapterStatus,
  lastSignalAt: Schema.optional(Schema.DateFromSelf),
  signalCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  errorCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  latencyMs: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
  details: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
```

### TSG.9.10.2 Health Fields

**Table TSG.9-5: AdapterHealth Field Semantics**

| Field | Type | Update Frequency | Source |
|-------|------|-----------------|--------|
| `status` | `AdapterStatus` | On state change | `internals.updateHealth` |
| `lastSignalAt` | `Date?` | On every signal push | `internals.push` (automatic) |
| `signalCount` | `int >= 0` | On every signal push | `internals.push` (automatic) |
| `errorCount` | `int >= 0` | On push failure or source error | `internals.push` catchAll / manual |
| `latencyMs` | `number >= 0?` | Adapter-specific | Manual measurement by adapter |
| `details` | `Record<string, unknown>?` | Adapter-specific | Source-specific diagnostics |

### TSG.9.10.3 Lifecycle Events

The `AdapterManager` emits structured lifecycle events:

```typescript
const AdapterLifecycleEvent = Schema.Union(
  Schema.TaggedStruct('AdapterRegistered', {
    adapterId: Schema.String,
    sourceId: SourceId,
    kind: Schema.String,
    timestamp: Schema.DateFromSelf,
  }),
  Schema.TaggedStruct('AdapterConnected', {
    adapterId: Schema.String,
    sourceId: SourceId,
    timestamp: Schema.DateFromSelf,
  }),
  Schema.TaggedStruct('AdapterDisconnected', {
    adapterId: Schema.String,
    sourceId: SourceId,
    reason: Schema.optional(Schema.String),
    timestamp: Schema.DateFromSelf,
  }),
  Schema.TaggedStruct('AdapterError', {
    adapterId: Schema.String,
    sourceId: SourceId,
    message: Schema.String,
    retryable: Schema.Boolean,
    timestamp: Schema.DateFromSelf,
  }),
  Schema.TaggedStruct('AdapterUnregistered', {
    adapterId: Schema.String,
    sourceId: SourceId,
    timestamp: Schema.DateFromSelf,
  }),
)
```

Events are stored in `lifecycleEventsAtom` with a rolling cap of 200 entries
(trimmed to 100 when exceeded). This prevents unbounded memory growth while
maintaining enough history for UI rendering.

### TSG.9.10.4 Telemetry Atoms

**Table TSG.9-6: Manager-Level Telemetry Atoms**

| Atom | Type | UI Consumer | Update Source |
|------|------|------------|---------------|
| `adapterRegistryAtom` | `Map<string, RegisteredAdapter>` | Adapter list panel | register/unregister |
| `adapterHealthAtom` | `Map<string, AdapterHealth>` | Health dashboard | 500ms aggregation fiber |
| `totalSignalCountAtom` | `number` | Throughput indicator | 500ms aggregation fiber |
| `lifecycleEventsAtom` | `ReadonlyArray<LifecycleEvent>` | Event log panel | register/unregister/error |
| `tickAtom` | `number` | Pipeline cycle counter | TsingouFlow drain loop |
| `pipelineStatusAtom` | `PipelineStatus` | Pipeline status badge | TsingouFlow lifecycle |
| `throughputAtom` | `number` | Signals/sec gauge | TsingouFlow 5s window |

---

## TSG.9.11 Tagged Error Hierarchy

### TSG.9.11.1 Error Design Philosophy

All adapter errors use `Data.TaggedError` from Effect-TS. This provides:

- **Type-safe error channels**: Errors appear in the Effect `E` type parameter.
- **Pattern matching**: `Effect.catchTag('HttpRequestError', handler)` for precise
  recovery strategies.
- **Yieldable errors**: `yield* new HttpRequestError({...})` in Effect.gen.
- **No unknown escapes**: Every error has a defined structure.

### TSG.9.11.2 Error Catalog

**Table TSG.9-7: Complete Tagged Error Hierarchy (17 classes)**

| Error Class | `_tag` | Category | Fields | Recovery |
|-------------|--------|----------|--------|----------|
| `AdapterConnectError` | `AdapterConnectError` | Connection | adapterId, kind, message, cause? | Retry with backoff |
| `AdapterDisconnectError` | `AdapterDisconnectError` | Connection | adapterId, message, cause? | Log and cleanup |
| `HttpRequestError` | `HttpRequestError` | HTTP | adapterId, url, method, statusCode?, message, cause? | Retry transient; fail permanent |
| `HttpParseError` | `HttpParseError` | HTTP | adapterId, url, message, rawBody?, cause? | Log and skip item |
| `HttpAuthError` | `HttpAuthError` | HTTP | adapterId, url, statusCode, message | Fail; refresh credentials |
| `HttpTimeoutError` | `HttpTimeoutError` | HTTP | adapterId, url, timeoutMs | Retry (expected for long-poll) |
| `SseConnectionError` | `SseConnectionError` | HTTP | adapterId, url, message, cause? | Retry with backoff |
| `WsConnectError` | `WsConnectError` | WebSocket | adapterId, url, message, cause? | Retry with exponential backoff |
| `WsMessageError` | `WsMessageError` | WebSocket | adapterId, message, cause? | Log and skip frame |
| `NatsSubscribeError` | `NatsSubscribeError` | NATS | adapterId, subject, message, cause? | Retry or fail |
| `FileWatchError` | `FileWatchError` | File | adapterId, path, message, cause? | Log and continue |
| `FileParseError` | `FileParseError` | File | adapterId, path, format, message, cause? | Log and skip file |
| `RssFetchError` | `RssFetchError` | RSS | adapterId, feedUrl, message, cause? | Retry on next poll |
| `RssParseError` | `RssParseError` | RSS | adapterId, feedUrl, message, cause? | Log and skip feed |
| `SerialConnectError` | `SerialConnectError` | Serial | adapterId, port, baudRate, message, cause? | Retry or notify |
| `SignalValidationError` | `SignalValidationError` | Signal | adapterId, kind, message, rawPayload? | Log and drop signal |
| `SignalQueueFullError` | `SignalQueueFullError` | Signal | adapterId, queueCapacity | Backpressure (suspend) |
| `AdapterManagerError` | `AdapterManagerError` | Manager | message, adapterId?, cause? | Fail operation |

### TSG.9.11.3 Error Recovery Strategies

Each error category has a prescribed recovery strategy:

**Connection errors** (AdapterConnectError, WsConnectError, SerialConnectError):
```typescript
Effect.retry(reconnectSchedule)
// Exponential backoff with bounded attempts
```

**Transient HTTP errors** (HttpRequestError with 5xx):
```typescript
HttpClient.retryTransient({
  schedule: Schedule.exponential(Duration.millis(500)).pipe(
    Schedule.intersect(Schedule.recurs(5))
  )
})
```

**Parse errors** (HttpParseError, WsMessageError, FileParseError, RssParseError):
```typescript
Stream.catchTag('WsMessageError', (err) =>
  Stream.fromEffect(Effect.log(`${err.message}`)).pipe(Stream.drain)
)
// Log and continue — do not crash the adapter for one bad message
```

**Auth errors** (HttpAuthError):
```typescript
// Fatal — requires credential refresh. Transition to 'error' status.
internals.updateHealth({ status: 'error' })
```

**Timeout errors** (HttpTimeoutError):
```typescript
// Expected for long-poll. Retry immediately.
Schedule.recurWhile((err) => err._tag === 'HttpTimeoutError')
```

### TSG.9.11.4 Error Propagation Contract

Adapter errors MUST NOT propagate to the `AdapterManager` or pipeline. Each adapter
is responsible for handling its own errors using `Effect.catchTag`, `Effect.catchTags`,
or `Effect.retry`. Unhandled errors cause the adapter's consumer fiber to terminate,
which transitions the adapter to `'error'` status.

The only error that propagates to the `AdapterManager` is `AdapterManagerError`,
which is returned from `register`, `unregister`, `pauseAdapter`, and `resumeAdapter`
operations.

---

## TSG.9.12 Adapter Catalog

### TSG.9.12.1 NATS Source Adapter

**Service Tag**: `tsingou/adapter/Nats`
**Kind**: `"nats"`
**Dependencies**: `NatsPubSubService`, `NatsStreamService` (optional), `SignalQueueTag`, `NatsAdapterConfigTag`

The NATS adapter is the primary adapter for Tsingou. NATS serves five roles in the
Tsingou architecture [TSG.11]:

1. **Direct source** — Subscribe to external NATS subjects
2. **Message bus** — Inter-adapter and inter-service communication
3. **Bridge** — Sidecar-to-WebView signal transport
4. **Fan-out** — Broadcast signals to multiple consumers
5. **JetStream replay** — Historical signal replay

**Configuration Schema**:

```typescript
const NatsAdapterConfig = Schema.Struct({
  adapterId: Schema.String.pipe(Schema.minLength(1)),
  sourceId: Schema.String.pipe(Schema.minLength(1)),
  subjects: Schema.Array(Schema.String.pipe(Schema.minLength(1))),
  jetstream: Schema.optional(Schema.Boolean),
  streamName: Schema.optional(Schema.String),
  durableName: Schema.optional(Schema.String),
  deliverPolicy: Schema.optional(Schema.Literal(
    'all', 'last', 'new', 'by_start_sequence', 'by_start_time', 'last_per_subject'
  )),
})
```

**Ingestion Modes**:

| Mode | Trigger | Version Dimension 1 | Acknowledgement |
|------|---------|---------------------|-----------------|
| Core NATS pub/sub | `pubsub.subscribe(subject, schema)` | 0 (no ordering) | None (fire-and-forget) |
| JetStream durable | `streamSvc.subscribe(stream, schema, opts)` | `msg.seq` (ordered) | `msg.ack()` after push |

**Signal Payload Schema**:

```typescript
payload: {
  subject: string,      // NATS subject the message arrived on
  data: unknown,        // Decoded message body
  sequence?: number,    // JetStream sequence (if applicable)
  replyTo?: string,     // Reply-to subject (for request/reply patterns)
}
```

### TSG.9.12.2 HTTP Source Adapter

**Service Tag**: `tsingou/adapter/Http`
**Kind**: `"http"`
**Dependencies**: `HttpClient.HttpClient`, `SignalQueueTag`, `HttpAdapterConfigTag`

Supports four ingestion modes via a discriminated union configuration:

**Table TSG.9-8: HTTP Ingestion Modes**

| Mode | Transport | Pattern | Use Case |
|------|-----------|---------|----------|
| `poll` | GET/POST + Schedule.fixed | Periodic fetch, adaptive interval | REST APIs, threat intel feeds |
| `sse` | GET + Sse.makeChannel | Persistent stream, server push | Real-time event feeds |
| `webhook` | POST receiver (HttpApi) | Reverse HTTP, source pushes | Alert endpoints, notification callbacks |
| `longPoll` | GET + timeout + immediate retry | Held connection, server replies when data ready | Comet-style APIs |

**Auth Middleware** (composable HttpClient transforms):

```typescript
const HttpAuthConfig = Schema.Union(
  Schema.TaggedStruct('bearer', { token: Schema.String }),
  Schema.TaggedStruct('basic', { username: Schema.String, password: Schema.String }),
  Schema.TaggedStruct('apiKey', { header?, queryParam?, value }),
  Schema.TaggedStruct('custom', { headers: Record<string, string> }),
  Schema.TaggedStruct('none', {}),
)
```

Auth is applied as a composable `HttpClient` transform — not as request-level
configuration. This enables middleware stacking (auth → retryTransient → filterStatusOk).

**Adaptive Polling**: When `adaptive: true`, the poll interval adjusts based on
data freshness:

- Data changed → interval *= 0.7 (speed up, clamped to `minIntervalMs`)
- Data unchanged → interval *= 1.3 (slow down, clamped to `maxIntervalMs`)

### TSG.9.12.3 WebSocket Source Adapter

**Service Tag**: `tsingou/adapter/WebSocket`
**Kind**: `"websocket"`
**Dependencies**: `Socket.layerWebSocketConstructorGlobal`, `SignalQueueTag`, `WsAdapterConfigTag`

Built entirely on `@effect/platform` Socket primitives:

| Effect Primitive | Usage |
|-----------------|-------|
| `Socket.makeWebSocket(url, opts)` | Scoped WebSocket connection |
| `Socket.toChannelString(socket)` | Bidirectional text channel |
| `Stream.fromChannel(ch)` | Channel → Stream conversion |
| `socket.writer` | Scoped write function |
| `Socket.layerWebSocketConstructorGlobal` | Browser WebSocket provider |

**Bidirectional Support**: The WebSocket adapter extends `SourceAdapterShape` with
a `send` method for bidirectional communication:

```typescript
interface WsSourceAdapterShape extends SourceAdapterShape {
  readonly send: (data: string | Uint8Array) => Effect.Effect<void, Socket.SocketError>
  readonly reconnectCountAtom: Atom.Atom<number>
}
```

**Frame Decoders**: Pluggable frame decoding with four built-in decoders:

| Format | Decoder | Input | Output |
|--------|---------|-------|--------|
| `json` | JSON.parse | String | Single object or array |
| `ndjson` | Line-split + JSON.parse | String | Array of objects |
| `binary` | Passthrough | Uint8Array | Single Uint8Array |
| `msgpack` | Pluggable via `customDecoder` | Uint8Array | Decoded object |

**Reconnection**: Automatic exponential backoff via `Effect.retry(reconnectSchedule)`.
Socket errors (`SocketGenericError`, `SocketCloseError`) trigger retry; other
errors propagate.

### TSG.9.12.4 RSS Source Adapter

**Service Tag**: `tsingou/adapter/Rss`
**Kind**: `"rss"`
**Dependencies**: `HttpClient.HttpClient`, `SignalQueueTag`, `RssAdapterConfigTag`

**Architecture**: Two-tier — `RssFeedManagerService` manages N individual
`RssSourceAdapter` instances.

Key features:

- **Conditional GET**: ETag / If-Modified-Since headers reduce redundant downloads.
- **Deduplication**: In-memory `HashSet<string>` tracks seen item IDs.
- **XML parsing**: Effectual wrapper around `fast-xml-parser` with tagged error
  channel (`XmlParseError`, `XmlValidationError`).
- **Format support**: RSS 2.0 and Atom 1.0 with schema-validated items.

**Feed Manager API**:

```typescript
interface RssFeedManagerShape {
  addFeed: (config: RssAdapterConfig) => Effect.Effect<SourceAdapterShape, AdapterManagerError>
  removeFeed: (adapterId: string) => Effect.Effect<void, AdapterManagerError>
  listFeeds: Effect.Effect<ReadonlyArray<SourceAdapterShape>>
  getState: Effect.Effect<RssFeedManagerState>
}
```

### TSG.9.12.5 Holonet Bridge Adapter

**Service Tag**: `tsingou/adapter/HolonetBridge`
**Kind**: Configurable (`"file-watch"`, `"serial"`, `"osc"`, etc.)
**Dependencies**: `NatsPubSubService`, `SignalQueueTag`, `HolonetBridgeConfigTag`

The Holonet Bridge is the generic adapter for sidecar-bridged sources. The sidecar
process (running outside the Tauri WebView) reads the actual hardware or OS source
and publishes normalized data to NATS. The bridge adapter subscribes to the NATS
subject and pushes signals to the queue.

**Configuration Factory Functions**:

```typescript
// File watch: sidecar monitors filesystem via @effect/platform FileSystem.watch
const makeFileWatchBridgeConfig = (paths: string[], opts?) => HolonetBridgeConfig

// Serial: sidecar reads USB/UART via serialport npm or tauri-plugin-serialplugin
const makeSerialBridgeConfig = (port: string, baudRate: number, opts?) => HolonetBridgeConfig

// OSC: sidecar listens on UDP via osc.js
const makeOscBridgeConfig = (listenPort: number, opts?) => HolonetBridgeConfig
```

**Payload Validation**: Optional `payloadSchema` field enables Schema-based
validation of sidecar messages. Messages that fail validation are sent to the
error channel (not silently dropped).

### TSG.9.12.6 Stub Adapters

MIDI and OSC have stub implementations that conform to `SourceAdapterShape` but
do not connect to real hardware. They serve as architectural placeholders:

```typescript
// MidiSourceAdapter: produces kind "midi", accepts MidiAdapterConfig
// OscSourceAdapter: produces kind "osc", accepts OscAdapterConfig
```

Stubs SHOULD be replaced with real implementations when the target hardware
libraries are available. The stub's `SourceAdapterShape` contract ensures that
downstream consumers (d2ts graph, UI panels) work without modification.

### TSG.9.12.7 Adapter Summary Table

**Table TSG.9-9: Complete Adapter Catalog**

| Adapter | Kind | Status | Dependencies | Ingestion Model | Bidirectional |
|---------|------|--------|-------------|-----------------|---------------|
| `NatsSourceAdapter` | `nats` | Production | Holonet NatsPubSub + NatsStream | Subscription | No |
| `HttpSourceAdapter` | `http` | Production | @effect/platform HttpClient | Poll / SSE / Webhook / Long-poll | No |
| `WebSocketSourceAdapter` | `websocket` | Production | @effect/platform Socket | Subscription | Yes (send) |
| `RssSourceAdapter` | `rss` | Production | @effect/platform HttpClient + fast-xml-parser | Polling | No |
| `HolonetBridgeAdapter` | configurable | Production | Holonet NatsPubSub | Subscription (via sidecar) | No |
| `MidiSourceAdapter` | `midi` | Stub | None | — | — |
| `OscSourceAdapter` | `osc` | Stub | None | — | — |

---

## TSG.9.13 Configuration Schema Patterns

### TSG.9.13.1 Configuration via Context.Tag

Every adapter defines a configuration schema and a corresponding `Context.Tag`:

```typescript
// 1. Schema definition
const NatsAdapterConfig = Schema.Struct({
  adapterId: Schema.String.pipe(Schema.minLength(1)),
  sourceId: Schema.String.pipe(Schema.minLength(1)),
  subjects: Schema.Array(Schema.String.pipe(Schema.minLength(1))),
  // ... adapter-specific fields
})

// 2. Context.Tag for dependency injection
class NatsAdapterConfigTag extends Context.Tag('tsingou/adapter/NatsConfig')<
  NatsAdapterConfigTag,
  NatsAdapterConfig
>() {}

// 3. Consumed in scoped constructor
scoped: Effect.gen(function* () {
  const config = yield* NatsAdapterConfigTag
  // ... use config
})
```

### TSG.9.13.2 Common Configuration Fields

All adapter configurations MUST include these fields:

| Field | Type | Purpose |
|-------|------|---------|
| `adapterId` | `Schema.String.pipe(Schema.minLength(1))` | Unique instance identifier |
| `sourceId` | `Schema.String.pipe(Schema.minLength(1))` | Stable logical source identity |

### TSG.9.13.3 Configuration Composition

Adapter layers are composed with configuration via `Layer.succeed`:

```typescript
const natsConfig: NatsAdapterConfig = {
  adapterId: 'nats-threat-feed-1',
  sourceId: 'threat-intel-primary',
  subjects: ['tsingou.signal.threat.>'],
  jetstream: true,
  streamName: 'SIGNALS',
  durableName: 'tsingou-ingest',
  deliverPolicy: 'new',
}

const configLayer = Layer.succeed(NatsAdapterConfigTag, natsConfig)
const adapterLayer = NatsSourceAdapter.Default.pipe(Layer.provide(configLayer))

yield* adapterManager.register(adapterLayer, (ctx) => Context.get(ctx, NatsSourceAdapter))
```

### TSG.9.13.4 Runtime Configuration Updates

Adapter configurations are immutable after registration. To change configuration:

1. Unregister the existing adapter (`adapterManager.unregister(id)`)
2. Register a new adapter with updated configuration
3. The `sourceId` SHOULD remain the same to maintain d2ts continuity

This explicit lifecycle prevents subtle bugs from mid-flight configuration changes.

---

## TSG.9.14 Sidecar Bridge Pattern

### TSG.9.14.1 Motivation

Tauri WebView (WKWebView on macOS, WebView2 on Windows) cannot directly access:

- Serial ports (USB/UART)
- Raw UDP sockets (OSC)
- Filesystem inotify/FSEvents
- Low-level hardware interfaces (SDR, GPIO)

The sidecar pattern delegates hardware access to an out-of-process daemon that
communicates via NATS:

```
┌─────────────────────┐     NATS      ┌─────────────────────┐
│  Tauri WebView      │ ◄──────────── │  Sidecar Process    │
│                     │               │                     │
│  HolonetBridge      │               │  Serial Reader      │
│  Adapter            │               │  File Watcher       │
│  (subscriber)       │               │  OSC Listener       │
│                     │               │  SDR Decoder        │
└─────────────────────┘               └─────────────────────┘
```

### TSG.9.14.2 Sidecar Subject Namespace

Sidecars publish to a well-defined NATS subject namespace:

```
tsingou.signal.<kind>.<source-detail>
```

**Table TSG.9-10: Sidecar Subject Patterns**

| Kind | Subject Pattern | Example |
|------|----------------|---------|
| `file-watch` | `tsingou.signal.file-watch.<path-hash>` | `tsingou.signal.file-watch.a3f7b2` |
| `serial` | `tsingou.signal.serial.<port>` | `tsingou.signal.serial.COM3` |
| `osc` | `tsingou.signal.osc.<port>` | `tsingou.signal.osc.9000` |
| `sdr` | `tsingou.signal.sdr.<device-id>` | `tsingou.signal.sdr.rtlsdr-0` |

### TSG.9.14.3 Sidecar Message Format

Sidecar messages SHOULD conform to the following schema:

```typescript
const SidecarMessage = Schema.Struct({
  kind: Schema.String,
  sourceId: Schema.String,
  timestamp: Schema.String,  // ISO 8601
  data: Schema.Unknown,
  metadata: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  })),
})
```

The `HolonetBridgeAdapter` normalizes sidecar messages into `BaseSignal` format.

### TSG.9.14.4 Deployment Modes

| Mode | Sidecar Runtime | When |
|------|----------------|------|
| Development | In-process (same Bun/Node runtime) | Local dev, near-realtime debugging |
| Desktop (Tauri) | Tauri sidecar (Rust or Node binary) | Production desktop deployment |
| Server | Separate container/process | Headless server deployment |

---

## TSG.9.15 Signal Kind Extensibility

### TSG.9.15.1 Known vs. Runtime-Registered Kinds

The `SignalKind` type is a union of compile-time known kinds and arbitrary strings:

```typescript
const KnownSignalKind = Schema.Literal(
  'midi', 'osc', 'nats', 'http', 'serial', 'rss', 'websocket', 'file-watch'
)
const SignalKind = Schema.Union(KnownSignalKind, Schema.String)
```

### TSG.9.15.2 Schema Registry

Custom signal kinds are registered at runtime via the NATS KV schema registry
[TSG.11]. The registry stores:

1. **Kind name**: String identifier (e.g., `"sdr-iq"`, `"stix-bundle"`)
2. **Payload schema**: JSON Schema for the payload field
3. **Metadata schema**: Optional JSON Schema for expected metadata

The d2ts ingest graph uses the registry to dispatch signals to the appropriate
processing operators based on their `kind`.

### TSG.9.15.3 Custom Adapter Development

To create a custom adapter for a new signal kind:

1. Define a payload schema using `Schema.extend(BaseSignal, ...)`:
   ```typescript
   const SdrIqSignal = Schema.extend(BaseSignal, Schema.Struct({
     kind: Schema.Literal('sdr-iq'),
     payload: Schema.Struct({
       centerFrequency: Schema.Number,
       sampleRate: Schema.Number,
       samples: Schema.Array(Schema.Tuple(Schema.Number, Schema.Number)),
     }),
   }))
   ```

2. Define configuration schema and `Context.Tag`.

3. Implement `Effect.Service` with `scoped` constructor that:
   - Calls `makeAdapterInternals`
   - Connects to source
   - Forks consumer fiber(s)
   - Registers finalizer
   - Returns `SourceAdapterShape`

4. Register the payload schema in the KV registry.

5. Register the adapter via `AdapterManager.register` or `registerSimple`.

---

## TSG.9.16 Pause and Resume Semantics

### TSG.9.16.1 Pause Behavior

When `adapter.pause` is invoked:

1. A local `paused` flag is set to `true`.
2. Consumer fibers check `if (paused) return` before pushing each signal.
3. The adapter remains connected to the source (no disconnect).
4. Signals arriving during pause are silently discarded at the adapter level.
5. Health status is NOT changed (adapter is still `connected`).

```typescript
let paused = false

// In consumer fiber:
Stream.mapEffect((item) =>
  Effect.gen(function* () {
    if (paused) return  // Skip signal
    yield* internals.push(normalize(item))
  })
)

// Exposed on shape:
pause: Effect.sync(() => { paused = true }),
resume: Effect.sync(() => { paused = false }),
```

### TSG.9.16.2 Resume Behavior

When `adapter.resume` is invoked:

1. The `paused` flag is set to `false`.
2. The next signal from the source is processed normally.
3. Signals discarded during the pause period are NOT replayed (they are lost).

### TSG.9.16.3 Pause vs. Unregister

| Action | Connection | Signals | Resumable | Scope |
|--------|-----------|---------|-----------|-------|
| Pause | Maintained | Discarded | Yes | Alive |
| Unregister | Closed | Stopped | No (re-register required) | Closed |

Pause is designed for temporary analysis pauses (e.g., user is reviewing a snapshot).
Unregister is for removing a source from the pipeline.

---

## TSG.9.17 Integration with d2ts Pipeline

### TSG.9.17.1 Queue Drain Pattern

The `TsingouFlow` service drains the signal queue and feeds signals into the d2ts
ingest graph:

```typescript
// In TsingouFlow.scoped:
const adapterManager = yield* AdapterManager

// Drain loop: take signals from queue, feed to d2ts
yield* Effect.fork(
  Effect.forever(
    Effect.gen(function* () {
      const signal = yield* Queue.take(adapterManager.signalQueue)

      // Update tick and process
      const tick = Atom.unsafeGet(tickAtom) + 1
      Atom.set(tickAtom, tick)

      // Feed to d2ts ingest graph (stub until d2ts installed)
      yield* processSignal(signal, tick)

      // Update telemetry
      Atom.set(totalProcessedAtom, Atom.unsafeGet(totalProcessedAtom) + 1)
    })
  )
)
```

### TSG.9.17.2 Signal Ordering

Signals arrive at the queue in FIFO order across all adapters. The d2ts pipeline
uses the two-dimensional `SignalVersion` to establish partial order:

1. **Within a source**: `version[1]` (source_seq) provides total order.
2. **Across sources**: `version[0]` (tick) is set by the pipeline during processing,
   enabling transport-locked or independent advancement.

### TSG.9.17.3 Output Bridge

Processed signals (d2ts output) are routed to the rendering layers via the
`OutputBridge`:

```
Adapters → SignalQueue → d2ts Ingest → d2ts Derived → OutputBridge → Rendering
                                                           │
                                                           ├─ activeSignalsAtom (R3F)
                                                           ├─ derivedSignalCountAtom (visx)
                                                           └─ (future: NATS publish for distributed)
```

---

## TSG.9.18 Normative Constraints

### TSG.9.18.1 Adapter Contract Constraints

**AC-1**: Every source adapter MUST implement the `SourceAdapterShape` interface
as defined in TSG.9.4.1.

**AC-2**: Every source adapter MUST use a `scoped` constructor with
`Effect.addFinalizer` for resource cleanup.

**AC-3**: Every source adapter MUST call `makeAdapterInternals` to create shared
health and push primitives. Adapters MUST NOT create custom push functions.

**AC-4**: Every source adapter MUST obtain the signal queue from the `SignalQueueTag`
context. Adapters MUST NOT create their own queues.

**AC-5**: Adapter `adapterId` values MUST be unique across all registered adapters.
The `AdapterManager` MUST enforce uniqueness at registration time.

**AC-6**: Adapter `sourceId` values MUST be stable across reconnections for the
same logical source.

**AC-7**: All signals MUST conform to the `BaseSignal` schema defined in [TSG.8].

**AC-8**: Signal `id` values MUST be generated via `generateSignalId(prefix)`.
Adapters MUST NOT construct signal IDs through other means.

### TSG.9.18.2 Lifecycle Constraints

**AC-9**: Scope closure MUST trigger all registered finalizers within
`Effect.uninterruptibleMask` to prevent partial cleanup.

**AC-10**: Finalizers MUST interrupt all forked consumer fibers before returning.

**AC-11**: Health status MUST transition to `'disconnected'` in the finalizer.

**AC-12**: The `AdapterManager` MUST close the adapter's scope during unregistration,
even if scope closure raises errors (errors are logged, not propagated).

### TSG.9.18.3 Error Constraints

**AC-13**: All adapter errors MUST use `Data.TaggedError` with a unique `_tag` string.

**AC-14**: Adapter errors MUST NOT propagate to the `AdapterManager` or pipeline.
Each adapter is responsible for its own error recovery.

**AC-15**: Parse/decode errors MUST be logged and the offending message skipped,
not cause adapter termination.

### TSG.9.18.4 Queue Constraints

**AC-16**: The signal queue MUST be bounded. The default capacity is 4096.

**AC-17**: When the queue is at capacity, `Queue.offer` MUST suspend the calling
fiber (backpressure). Signals MUST NOT be dropped without explicit configuration.

**AC-18**: The signal queue MUST be shared across all registered adapters.

### TSG.9.18.5 Configuration Constraints

**AC-19**: All adapter configurations MUST be defined as `Effect.Schema` structs.

**AC-20**: Configurations MUST include `adapterId` and `sourceId` fields.

**AC-21**: Configurations MUST be immutable after registration. Changes require
unregister + re-register.

---

## TSG.9.19 Worked Examples

### TSG.9.19.1 Example 1: NATS Threat Intelligence Feed

**Scenario**: A SIGINT analyst subscribes to a threat intelligence feed published
by a partner organization via NATS JetStream.

**Configuration**:

```typescript
const threatFeedConfig: NatsAdapterConfig = {
  adapterId: 'nats-threat-intel-primary',
  sourceId: 'partner-alpha-threat-feed',
  subjects: ['intel.threat.stix.>'],
  jetstream: true,
  streamName: 'THREAT_INTEL',
  durableName: 'tsingou-threat-consumer',
  deliverPolicy: 'new',
}
```

**Registration**:

```typescript
const adapterManager = yield* AdapterManager

const configLayer = Layer.succeed(NatsAdapterConfigTag, threatFeedConfig)
const adapterLayer = NatsSourceAdapter.Default.pipe(Layer.provide(configLayer))

const adapter = yield* adapterManager.register(
  adapterLayer,
  (ctx) => Context.get(ctx, NatsSourceAdapter)
)
```

**Signal Flow**:

```
Partner NATS → subject: intel.threat.stix.indicator.new
                ↓
NatsSourceAdapter (JetStream durable consumer)
  → msg.data = { type: "indicator", pattern: "...", valid_from: "..." }
  → msg.seq = 42
                ↓
BaseSignal {
  id: "nats_1708300800000_0",
  sourceId: "partner-alpha-threat-feed",
  timestamp: msg.time,
  version: [0, 42],     // tick=0 (set by pipeline), source_seq=42 (JetStream)
  kind: "nats",
  payload: { subject: "intel.threat.stix.indicator.new", data: {...}, sequence: 42 },
}
                ↓
SignalQueue → d2ts ingest → STIX codec → graph analysis
```

### TSG.9.19.2 Example 2: Multi-Source OSINT Monitoring

**Scenario**: An analyst monitors three RSS feeds, two WebSocket streams, and one
HTTP API simultaneously for open-source intelligence gathering.

**Registration (parallel)**:

```typescript
const adapterManager = yield* AdapterManager

// RSS feeds (via RssFeedManagerService)
const feedManager = yield* RssFeedManagerService
yield* feedManager.addFeed({
  adapterId: 'rss-reuters-world',
  sourceId: 'reuters-world-news',
  feedUrl: 'https://feeds.reuters.com/reuters/worldNews',
  intervalMs: 60_000,
})
yield* feedManager.addFeed({
  adapterId: 'rss-hackernews',
  sourceId: 'ycombinator-hackernews',
  feedUrl: 'https://hnrss.org/newest',
  intervalMs: 30_000,
})
yield* feedManager.addFeed({
  adapterId: 'rss-cve-nist',
  sourceId: 'nist-cve-feed',
  feedUrl: 'https://nvd.nist.gov/feeds/json/cve/1.1/nvdcve-1.1-recent.json',
  intervalMs: 300_000,
})

// WebSocket streams
yield* adapterManager.registerSimple(
  WebSocketSourceAdapter.scoped.pipe(
    Effect.provide(Layer.succeed(WsAdapterConfigTag, {
      adapterId: 'ws-crypto-prices',
      sourceId: 'binance-trade-stream',
      url: 'wss://stream.binance.com:9443/ws/btcusdt@trade',
      frameFormat: 'json',
    }))
  )
)

// HTTP API (polling)
yield* adapterManager.registerSimple(
  HttpSourceAdapter.scoped.pipe(
    Effect.provide(Layer.succeed(HttpAdapterConfigTag, {
      adapterId: 'http-shodan-monitor',
      sourceId: 'shodan-internet-monitor',
      mode: {
        _tag: 'poll',
        url: 'https://api.shodan.io/shodan/alert/triggers',
        intervalMs: 120_000,
        adaptive: true,
      },
      auth: { _tag: 'apiKey', header: 'Authorization', value: 'Bearer sk-...' },
    }))
  )
)
```

**Health Dashboard** (React):

```typescript
function AdapterHealthPanel() {
  const healthMap = useAtomValue(adapterHealthAtom)
  const totalSignals = useAtomValue(totalSignalCountAtom)

  return (
    <div>
      <h3>Adapters ({healthMap.size} active)</h3>
      <p>Total signals: {totalSignals.toLocaleString()}</p>
      {[...healthMap.entries()].map(([id, health]) => (
        <AdapterRow key={id} adapterId={id} health={health} />
      ))}
    </div>
  )
}
```

### TSG.9.19.3 Example 3: Serial SDR Sidecar Integration

**Scenario**: A field-deployed Tsingou instance reads IQ data from an RTL-SDR
dongle connected via USB. A Rust sidecar process reads the device and publishes
to NATS.

**Sidecar** (Rust, out of scope for this RFC):

```
rtl_sdr → read IQ samples → encode as NATS message → publish to tsingou.signal.sdr.rtlsdr-0
```

**Bridge Configuration**:

```typescript
const sdrBridgeConfig: HolonetBridgeConfig = {
  adapterId: 'bridge-sdr-rtlsdr-0',
  sourceId: 'rtlsdr-field-unit-alpha',
  kind: 'sdr',
  subjects: ['tsingou.signal.sdr.rtlsdr-0'],
  payloadSchema: SdrIqPayloadSchema,  // Optional validation
  queueGroup: 'tsingou-sdr-consumers',
}

yield* adapterManager.registerSimple(
  HolonetBridgeAdapter.scoped.pipe(
    Effect.provide(Layer.succeed(HolonetBridgeConfigTag, sdrBridgeConfig))
  ),
  NatsPubSubService.Default, // Bridge needs Holonet
)
```

**Signal Flow**:

```
RTL-SDR USB → Rust sidecar → NATS subject → HolonetBridgeAdapter
                                                     ↓
                                              Schema validation
                                                     ↓
                                              BaseSignal {
                                                kind: "sdr",
                                                payload: { centerFreq, sampleRate, samples: [...] },
                                              }
                                                     ↓
                                              SignalQueue → d2ts → DSP operators [TSG.25]
```

---

## TSG.9.20 Cross-References to Other RFC Sections

**Table TSG.9-11: Cross-Reference Matrix**

| Referenced Section | Relationship | Nature |
|-------------------|-------------|--------|
| [TSG.7] Signal Pipeline & d2ts | Adapters feed signals into the d2ts ingest graph | Upstream dependency |
| [TSG.8] BaseSignal Schema | Defines the signal schema that adapters produce | Schema dependency |
| [TSG.9] (this section) | Self-reference | — |
| [TSG.10] State Management | Atom-as-State pattern used for health and telemetry atoms | Pattern dependency |
| [TSG.11] NATS Messaging Fabric | NATS is both a signal source and the sidecar bridge transport | Transport dependency |
| [TSG.12] STIX 2.1 Data Model | STIX objects may arrive as signals via NATS or HTTP adapters | Data format |
| [TSG.16] SDR Hardware | SDR sources use the sidecar bridge pattern (TSG.9.14) | Hardware integration |
| [TSG.17] GNU Radio Bridge | GNU Radio flowgraphs publish to NATS for sidecar ingestion | Sidecar integration |
| [TSG.20] 4-Layer Rendering | Health atoms are consumed by DOM layer panels | UI integration |
| [TSG.25] DSP Foundations | DSP operators process SDR/serial signals downstream | Processing dependency |
| [TSG.26] Differential Dataflow | d2ts operators consume signals from the SignalQueue | Processing dependency |
| [TSG.32] Effect-TS Architecture | Service, Layer, Scope patterns used throughout | Implementation framework |
| [TSG.34] Deployment Topology | Sidecar pattern is deployment-topology dependent | Deployment dependency |
| [TSG.35] Error Handling | Tagged error hierarchy defined in TSG.9.11 follows the global error strategy | Error pattern |

---

## TSG.9.21 Open Questions

1. **Queue capacity auto-tuning**: Should the `SignalQueue` capacity be dynamically
   adjusted based on pipeline throughput? A static 4096 may be suboptimal for both
   low-throughput desktop and high-throughput server deployments.

2. **Priority queuing**: Should some adapters have priority over others? Critical
   threat intelligence signals may need to bypass backpressure from high-volume
   sensor data. A priority queue or separate fast-track queue could address this.

3. **Signal deduplication**: Should deduplication be an adapter-level concern (as
   in RSS) or a pipeline-level concern (d2ts operator)? The current design is
   adapter-specific, which may lead to inconsistent dedup behavior.

4. **Adapter versioning**: When adapter implementations change (new config fields,
   different payload schemas), how should running adapters be upgraded? Hot-swap
   (unregister + re-register) works but loses transient state.

5. **Backpressure signaling**: Should adapters be notified when backpressure is
   active? Currently they suspend silently. A notification mechanism could enable
   adapters to shed load proactively (e.g., reduce poll frequency).

6. **Distributed adapter registry**: For multi-node deployments, should the adapter
   registry be replicated via NATS KV? This would enable centralized monitoring of
   adapters running across multiple Tsingou instances.

7. **Adapter discovery**: Should adapters auto-discover available sources? For NATS,
   this could use subject listing. For serial, USB device enumeration. This would
   enable a "scan and connect" workflow for field deployment.

---

## TSG.9.22 References

### Architecture Decision Records

- [ADR-002] Prime, Val. "Source Adapter Contract — Effect.Service with Push API."
  ADR-002, 2026-02-18.
  `docs/tsingou/adr/ADR-002-source-adapter-contract.md`

- [ADR-003] Prime, Val. "NATS as Universal Fabric."
  ADR-003, 2026-02-18.
  `docs/tsingou/adr/ADR-003-nats-as-universal-fabric.md`

### Effect-TS

- [EFFECT-SERVICE] Effect-TS. "Effect.Service API."
  https://effect.website/docs/guides/context-management/services

- [EFFECT-SCOPE] Effect-TS. "Scope and Resource Management."
  https://effect.website/docs/guides/resource-management/scope

- [EFFECT-QUEUE] Effect-TS. "Queue — Bounded and Unbounded."
  https://effect.website/docs/guides/concurrency/queues

- [EFFECT-SCHEMA] Effect-TS. "Schema — Runtime Validation."
  https://effect.website/docs/guides/schema/introduction

- [EFFECT-TAGGED-ERROR] Effect-TS. "Data.TaggedError."
  https://effect.website/docs/guides/error-management/expected-errors

- [EFFECT-SCHEDULE] Effect-TS. "Schedule — Retry and Repetition."
  https://effect.website/docs/guides/scheduling/introduction

### @effect/platform

- [EFFECT-HTTP-CLIENT] Effect-TS. "@effect/platform HttpClient."
  https://effect.website/docs/guides/platform/http-client

- [EFFECT-SOCKET] Effect-TS. "@effect/platform Socket."
  https://effect.website/docs/guides/platform/socket

### effect-atom

- [EFFECT-ATOM] Tim Smart. "effect-atom — Reactive State for Effect."
  https://github.com/tim-smart/effect-atom

### NATS

- [NATS-PUBSUB] Synadia. "NATS Core Publish/Subscribe."
  https://docs.nats.io/nats-concepts/core-nats/pubsub

- [NATS-JETSTREAM] Synadia. "NATS JetStream."
  https://docs.nats.io/nats-concepts/jetstream

### Standards

- [STIX-2.1] OASIS. "STIX Version 2.1." Committee Specification 01, 2021.
  https://docs.oasis-open.org/cti/stix/v2.1/stix-v2.1.html

### Normative References

- [RFC2119] Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
  BCP 14, RFC 2119, March 1997.

- [RFC8174] Leiba, B. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words."
  BCP 14, RFC 8174, May 2017.

### Cross-Referenced RFC Sections

- [TSG.7] Signal Pipeline & d2ts — `rfc-section-signal-pipeline.md`
- [TSG.8] BaseSignal Schema — `rfc-section-base-signal-schema.md`
- [TSG.10] State Management — `rfc-section-state-management.md`
- [TSG.11] NATS Messaging Fabric — `rfc-section-nats-fabric.md`
- [TSG.12] STIX 2.1 Data Model — `rfc-section-stix-data-model.md`
- [TSG.16] SDR Hardware — `rfc-section-sdr-hardware.md`
- [TSG.17] GNU Radio Bridge — `rfc-section-gnu-radio-bridge.md`
- [TSG.20] 4-Layer Rendering Surface — `rfc-section-rendering-surface.md`
- [TSG.25] DSP Foundations — `rfc-section-dsp-foundations.md`
- [TSG.26] Differential Dataflow — `rfc-section-differential-dataflow.md`
- [TSG.32] Effect-TS Architecture — `rfc-section-effect-architecture.md`
- [TSG.34] Deployment Topology — `rfc-section-deployment-topology.md`
- [TSG.35] Error Handling — `rfc-section-error-handling.md`
