# @tmnl/tsingou-flow — Architecture Document

> **System**: Tsingou — Signal-Driven Analysis & Visualization Platform
> **Package**: `@tmnl/tsingou-flow`
> **Author**: Val (Vigilant Architecture Layer)
> **Date**: 2026-02-18
> **Status**: Design — derived from questionnaire decisions
> **Feature**: #F353 / #F354

---

## 1. Purpose

`@tmnl/tsingou-flow` is the nervous system of Tsingou. It ingests signals from arbitrary sources, processes them incrementally via differential dataflow, and delivers derived state to rendering layers.

**It is not an audiovisual sequencer.** It is a SIGINT/OSINT analysis platform that uses audiovisual rendering as its output modality. The signal pipeline IS the product.

---

## 2. Foundational Decisions

Captured via structured questionnaires (`tsingou-d2ts-signal-pipeline`, `tsingou-source-adapters`):

| Decision | Choice | Rationale |
|----------|--------|-----------|
| d2ts role | Replace entire signal pipeline | d2ts IS the backbone, not a side-computation |
| Versioning | Multi-dim `[tick, source_id]` | Partial ordering; simultaneous transport-locked + real-time |
| MultiSet semantics | Event accumulation (+1 only) | Append-only. -1 for explicit retractions only. Derive via reduce/count/topK |
| Graph topology | Tiered: ingest → derived | Normalization separated from computation |
| Effect bridge | D2 operators as Effect.Stream combinators | Deep integration into Effect algebra |
| Package | d2ts full (not d2mini) | Need versioning, persistence, iterate, frontier control |
| Output | Effect.Queue → consumer fiber → Atom.set() | Backpressure-aware, fiber-managed |
| Adapter contract | Effect.Service with push(signal) | Built on existing src/lib/streams patterns |
| Signal schema | Base + extensions + runtime KV registry | Static types for known sources, dynamic for runtime |
| NATS role | ALL: source, bus, bridge, fan-out, replay | Universal signal fabric |
| Serial/hardware | Hybrid (in-process, sidecar→NATS, WebSerial, plugin) | Deployment-dependent |
| Lifecycle | Hot-plug (runtime add/remove) | Live analysis scenario |
| Custom operators | Full @tmnl/tsingou-operators library | RxJS-extrapolated: window, throttle, schemaValidate |
| Package name | `@tmnl/tsingou-flow` | The differential dataflow layer |

---

## 3. Signal Schema

### 3.1 BaseSignal (Effect.Schema)

Every signal in Tsingou, regardless of source, carries these common fields:

```typescript
import { Schema } from 'effect'

// Branded IDs
const SignalId = Schema.String.pipe(Schema.brand('SignalId'))
const SourceId = Schema.String.pipe(Schema.brand('SourceId'))

// Version tuple for d2ts multi-dimensional versioning
const SignalVersion = Schema.Tuple(
  Schema.Number,  // sequencer tick (or logical clock)
  Schema.Number   // source sequence number
)

const BaseSignal = Schema.Struct({
  id:        SignalId,
  sourceId:  SourceId,
  timestamp: Schema.DateFromSelf,
  version:   SignalVersion,
  kind:      Schema.String,           // discriminator for schema registry lookup
  payload:   Schema.Unknown,          // decoded by schema registry at ingest
  metadata:  Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  }))
})

type BaseSignal = typeof BaseSignal.Type
```

### 3.2 Source-Specific Extensions

Known source types get static Schema extensions:

```typescript
const MidiSignal = Schema.extend(BaseSignal, Schema.Struct({
  kind:    Schema.Literal('midi'),
  payload: Schema.Struct({
    channel:  Schema.Number.pipe(Schema.int(), Schema.between(0, 15)),
    type:     Schema.Literal('note-on', 'note-off', 'cc', 'program-change', 'pitch-bend'),
    note:     Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 127))),
    velocity: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 127))),
    cc:       Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 127))),
    value:    Schema.optional(Schema.Number),
  })
}))

const OscSignal = Schema.extend(BaseSignal, Schema.Struct({
  kind:    Schema.Literal('osc'),
  payload: Schema.Struct({
    address: Schema.String,          // e.g. "/synth/filter/cutoff"
    args:    Schema.Array(Schema.Union(
      Schema.Number,
      Schema.String,
      Schema.Uint8ArrayFromSelf
    ))
  })
}))

const NatsSignal = Schema.extend(BaseSignal, Schema.Struct({
  kind:    Schema.Literal('nats'),
  payload: Schema.Struct({
    subject:  Schema.String,         // NATS subject
    data:     Schema.Unknown,        // decoded by schema registry
    headers:  Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
    sequence: Schema.optional(Schema.Number),  // JetStream sequence
  })
}))

const HttpSignal = Schema.extend(BaseSignal, Schema.Struct({
  kind:    Schema.Literal('http'),
  payload: Schema.Struct({
    url:        Schema.String,
    method:     Schema.Literal('GET', 'POST', 'PUT', 'DELETE'),
    statusCode: Schema.optional(Schema.Number),
    body:       Schema.Unknown,
    headers:    Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  })
}))

const SerialSignal = Schema.extend(BaseSignal, Schema.Struct({
  kind:    Schema.Literal('serial'),
  payload: Schema.Struct({
    port:     Schema.String,         // e.g. "/dev/ttyUSB0"
    baudRate: Schema.Number,
    raw:      Schema.Uint8ArrayFromSelf,
    parsed:   Schema.optional(Schema.Unknown), // user-defined parser output
  })
}))

const RssSignal = Schema.extend(BaseSignal, Schema.Struct({
  kind:    Schema.Literal('rss'),
  payload: Schema.Struct({
    feedUrl:   Schema.String,
    itemGuid:  Schema.String,
    title:     Schema.String,
    link:      Schema.optional(Schema.String),
    pubDate:   Schema.optional(Schema.DateFromSelf),
    content:   Schema.optional(Schema.String),
    categories: Schema.optional(Schema.Array(Schema.String)),
  })
}))

const WebSocketSignal = Schema.extend(BaseSignal, Schema.Struct({
  kind:    Schema.Literal('websocket'),
  payload: Schema.Struct({
    url:  Schema.String,
    data: Schema.Unknown,
    type: Schema.Literal('text', 'binary'),
  })
}))

const FileWatchSignal = Schema.extend(BaseSignal, Schema.Struct({
  kind:    Schema.Literal('file-watch'),
  payload: Schema.Struct({
    path:      Schema.String,
    event:     Schema.Literal('create', 'modify', 'delete'),
    content:   Schema.optional(Schema.Unknown),  // parsed file content
  })
}))

// Union of all known signal types
const Signal = Schema.Union(
  MidiSignal, OscSignal, NatsSignal, HttpSignal,
  SerialSignal, RssSignal, WebSocketSignal, FileWatchSignal
)
type Signal = typeof Signal.Type
```

### 3.3 Schema Registry (NATS KV Bucket)

For dynamic/runtime signal types that aren't known at compile time:

```typescript
// NATS KV Bucket: "tsingou-schemas"
// Key:   signal kind string (e.g., "custom-sensor-xyz")
// Value: JSON-serialized Effect.Schema AST + version metadata

const SchemaRegistryEntry = Schema.Struct({
  kind:       Schema.String,
  version:    Schema.Number,
  schema:     Schema.Unknown,         // Serialized Schema AST (JSONSchema output)
  createdAt:  Schema.DateFromSelf,
  createdBy:  Schema.String,
  deprecated: Schema.optional(Schema.Boolean),
})

// The registry is an Effect.Service that wraps NATS KV operations
class SchemaRegistry extends Effect.Service<SchemaRegistry>()('tsingou/SchemaRegistry', {
  effect: Effect.gen(function* () {
    const nats = yield* NatsConnection
    const kv = yield* Effect.promise(() => nats.kv('tsingou-schemas'))

    return {
      register: (entry: SchemaRegistryEntry) =>
        Effect.promise(() => kv.put(entry.kind, JSON.stringify(entry))),

      lookup: (kind: string) =>
        Effect.promise(() => kv.get(kind)).pipe(
          Effect.map(entry => entry ? JSON.parse(entry.string()) : null),
          Effect.flatMap(Effect.fromNullable),
        ),

      watch: () =>
        // NATS KV watch = real-time schema change notifications
        Effect.async<SchemaRegistryEntry>((emit) => {
          const watcher = kv.watch({ key: '>' })
          // ... emit changes
        }),

      list: () =>
        Effect.promise(() => kv.keys()).pipe(
          Effect.map(keys => Array.from(keys))
        ),
    }
  })
}) {}
```

---

## 4. Source Adapter Contract

### 4.1 Effect.Service Interface

Every source adapter implements this contract:

```typescript
// The universal adapter interface
interface SourceAdapterShape<Config = unknown> {
  // Identity
  readonly adapterId: string
  readonly kind: string          // signal kind this adapter produces

  // Lifecycle
  readonly connect: (config: Config) => Effect.Effect<void, AdapterError>
  readonly disconnect: Effect.Effect<void, AdapterError>
  readonly isConnected: Effect.Effect<boolean>

  // Signal production — push model
  // Adapter calls this when it has a new signal
  readonly onSignal: (handler: (signal: BaseSignal) => void) => Effect.Effect<void>

  // Health
  readonly health: Effect.Effect<AdapterHealth>
}

const AdapterHealth = Schema.Struct({
  status:       Schema.Literal('connected', 'disconnected', 'degraded', 'error'),
  lastSignalAt: Schema.optional(Schema.DateFromSelf),
  signalCount:  Schema.Number,
  errorCount:   Schema.Number,
  latencyMs:    Schema.optional(Schema.Number),
})

const AdapterError = Schema.TaggedStruct('AdapterError', {
  adapterId: Schema.String,
  message:   Schema.String,
  cause:     Schema.optional(Schema.Unknown),
  retryable: Schema.Boolean,
})
```

### 4.2 Adapter Manager (Hot-Plug Lifecycle)

```typescript
class AdapterManager extends Effect.Service<AdapterManager>()('tsingou/AdapterManager', {
  effect: Effect.gen(function* () {
    const adapters = yield* Atom.make(new Map<string, SourceAdapterShape>())
    const signalQueue = yield* Queue.unbounded<BaseSignal>()

    return {
      // Hot-plug: register adapter at runtime
      register: (adapter: SourceAdapterShape, config: unknown) =>
        Effect.gen(function* () {
          yield* adapter.connect(config)
          yield* adapter.onSignal((signal) => {
            Effect.runSync(Queue.offer(signalQueue, signal))
          })
          yield* Atom.update(adapters, m => new Map(m).set(adapter.adapterId, adapter))
          yield* Effect.log(`Adapter registered: ${adapter.adapterId} (${adapter.kind})`)
        }).pipe(Effect.withSpan('adapter.register')),

      // Hot-unplug: remove adapter at runtime
      unregister: (adapterId: string) =>
        Effect.gen(function* () {
          const map = yield* Atom.get(adapters)
          const adapter = map.get(adapterId)
          if (adapter) {
            yield* adapter.disconnect
            yield* Atom.update(adapters, m => { const n = new Map(m); n.delete(adapterId); return n })
          }
        }).pipe(Effect.withSpan('adapter.unregister')),

      // The queue that feeds the d2ts ingest graph
      signalQueue: Queue.Dequeue(signalQueue),

      // List active adapters
      list: Atom.get(adapters).pipe(Effect.map(m => Array.from(m.values()))),
    }
  })
}) {}
```

### 4.3 In-Process vs Sidecar

```
IN-PROCESS (low latency, dev/analysis):
  Source → SourceAdapter Effect.Service → push(signal) → Queue → d2ts

SIDECAR (production, isolation):
  Source → sidecar daemon → NATS publish → NatsAdapter subscribes → push(signal) → Queue → d2ts

NATS LEAF (edge/remote):
  Remote sensor → Pi sidecar → NATS leaf node → NATS cluster → NatsAdapter → push(signal) → Queue → d2ts
```

---

## 5. D2TS Graph Architecture

### 5.1 Tiered Topology

```
                    ┌──────────────────────────────────────┐
                    │     AdapterManager.signalQueue        │
                    │     (Effect.Queue<BaseSignal>)        │
                    └──────────────────┬───────────────────┘
                                       │
                    ┌──────────────────▼───────────────────┐
                    │          INGEST GRAPH (D2)            │
                    │                                       │
                    │  Consumer fiber drains signalQueue    │
                    │  → input.sendData(version, multiset)  │
                    │                                       │
                    │  Operators:                           │
                    │    1. schemaValidate(SchemaRegistry)  │
                    │    2. map(normalize timestamps)       │
                    │    3. map(tag with source metadata)   │
                    │    4. consolidate()                   │
                    │                                       │
                    │  Output: normalized MultiSet<Signal>  │
                    └──────────────────┬───────────────────┘
                                       │
                    ┌──────────────────▼───────────────────┐
                    │          DERIVED GRAPH (D2)           │
                    │                                       │
                    │  Inputs:                              │
                    │    - Ingest output (normalized)       │
                    │    - Historical data (JetStream)      │
                    │    - Module state (feedback)          │
                    │                                       │
                    │  Operators (configurable per session):│
                    │    - join (cross-source correlation)  │
                    │    - reduce (aggregation)             │
                    │    - count / topK                     │
                    │    - window (sliding time window)     │
                    │    - throttle (rate limiting)         │
                    │    - iterate (convergence)            │
                    │                                       │
                    │  Output: derived state collections    │
                    └──────────────────┬───────────────────┘
                                       │
                    ┌──────────────────▼───────────────────┐
                    │       OUTPUT BRIDGE                    │
                    │                                       │
                    │  d2ts output() → Effect.Queue         │
                    │  Consumer fiber → Atom.set()          │
                    │  Atoms feed Tsingou rendering layers  │
                    │                                       │
                    │  ┌─────────┬──────┬───────┬────────┐ │
                    │  │  R3F    │  p5  │ visx  │  DOM   │ │
                    │  └─────────┴──────┴───────┴────────┘ │
                    └──────────────────────────────────────┘
```

### 5.2 Version Strategy

```typescript
import { v, Antichain } from '@electric-sql/d2ts'

// Multi-dimensional version: [sequencer_tick, source_sequence]
// Dimension 0: global logical clock (monotonic, incremented per processing cycle)
// Dimension 1: per-source sequence number (allows partial ordering)

const makeVersion = (tick: number, sourceSeq: number) => v([tick, sourceSeq])

// Frontier: "I will never send data for versions ≤ this"
// Each source advances its own dimension independently
const makeFrontier = (tick: number, sourceSeq: number) =>
  new Antichain([v([tick, sourceSeq])])
```

### 5.3 MultiSet Signal Encoding

```typescript
import { MultiSet } from '@electric-sql/d2ts'

// Event accumulation: +1 for new signals, -1 only for explicit retractions
const signalToMultiSet = (signal: BaseSignal): MultiSet<BaseSignal> =>
  new MultiSet([[signal, 1]])  // Always +1

const retractSignal = (signal: BaseSignal): MultiSet<BaseSignal> =>
  new MultiSet([[signal, -1]]) // Explicit retraction (e.g., source disconnected)

const batchToMultiSet = (signals: BaseSignal[]): MultiSet<BaseSignal> =>
  new MultiSet(signals.map(s => [s, 1] as [BaseSignal, number]))
```

### 5.4 TsingouFlow Effect.Service

```typescript
class TsingouFlow extends Effect.Service<TsingouFlow>()('tsingou/TsingouFlow', {
  effect: Effect.gen(function* () {
    const adapterManager = yield* AdapterManager
    const schemaRegistry = yield* SchemaRegistry

    // Create tiered D2 graphs
    const ingestGraph = new D2({ initialFrontier: v([0, 0]) })
    const derivedGraph = new D2({ initialFrontier: v([0, 0]) })

    // Ingest graph input
    const ingestInput = ingestGraph.newInput<BaseSignal>()

    // Ingest pipeline: validate → normalize → tag → consolidate
    const ingestOutput = ingestInput.pipe(
      filter((signal) => {
        // Schema validation via registry
        // (simplified — real impl uses schemaValidate operator)
        return signal.kind !== undefined && signal.sourceId !== undefined
      }),
      map((signal) => ({
        ...signal,
        timestamp: signal.timestamp ?? new Date(),
      })),
      consolidate(),
    )

    // Derived graph consumes ingest output
    const derivedInput = derivedGraph.newInput<BaseSignal>()

    // Wire ingest output → derived input
    ingestOutput.pipe(
      output((message) => {
        for (const [signal, mult] of message.collection.getInner()) {
          if (mult > 0) {
            derivedInput.sendData(message.version, new MultiSet([[signal, mult]]))
          }
        }
      })
    )

    // Output atoms for rendering layers
    const signalStateAtom = yield* Atom.make<BaseSignal[]>([])
    const outputQueue = yield* Queue.bounded<BaseSignal[]>(256)

    // Finalize graphs
    ingestGraph.finalize()
    derivedGraph.finalize()

    // Processing loop: drain adapter queue → feed ingest → run graphs → output
    let tick = 0
    const processingFiber = yield* Effect.fork(
      Effect.forever(
        Effect.gen(function* () {
          // Drain all available signals from adapter queue
          const signals = yield* Queue.takeAll(adapterManager.signalQueue)
          const signalArray = Array.from(signals)

          if (signalArray.length > 0) {
            tick++
            // Feed into ingest graph
            ingestInput.sendData(
              v([tick, 0]),
              batchToMultiSet(signalArray)
            )
            ingestInput.sendFrontier(v([tick + 1, 0]))

            // Run both graphs
            ingestGraph.run()
            derivedGraph.run()
          }

          // Small yield to prevent busy-wait
          yield* Effect.sleep('1 millis')
        }).pipe(Effect.withSpan('tsingou.flow.cycle'))
      )
    )

    return {
      // Access atoms for rendering
      signalState: signalStateAtom,

      // Manual graph run (for testing)
      step: Effect.sync(() => { ingestGraph.run(); derivedGraph.run() }),

      // Shutdown
      shutdown: Effect.gen(function* () {
        yield* Fiber.interrupt(processingFiber)
        yield* Effect.log('TsingouFlow shutdown')
      }),
    }
  }),
  dependencies: [AdapterManager.Default, SchemaRegistry.Default]
}) {}
```

---

## 6. NATS Integration

### 6.1 Subject Naming Convention

```
tsingou.signal.{kind}.{sourceId}          — raw signal subjects
tsingou.derived.{computationId}           — derived state subjects
tsingou.schema.{kind}                     — schema registry (KV bucket keys)
tsingou.adapter.{adapterId}.health        — adapter health subjects
tsingou.adapter.{adapterId}.control       — adapter control (start/stop/config)

Examples:
  tsingou.signal.midi.usb-controller-1
  tsingou.signal.rss.bbc-news
  tsingou.signal.serial.arduino-sensor-3
  tsingou.derived.cross-source-correlation
  tsingou.schema.custom-sensor-xyz
```

### 6.2 NATS KV Buckets

```
tsingou-schemas     — Schema registry (signal type → schema definition)
tsingou-adapters    — Adapter configs (adapterId → configuration)
tsingou-sessions    — Analysis session state (sessionId → graph config)
```

### 6.3 JetStream Streams

```
TSINGOU_SIGNALS     — All signal subjects, retention: limits (time + size)
TSINGOU_DERIVED     — Derived state, retention: limits
TSINGOU_AUDIT       — Adapter lifecycle events, retention: workqueue
```

---

## 7. Output Bridge

### 7.1 Effect.Queue → Atom.set()

```typescript
// d2ts output() operator → Effect.Queue<DerivedState>
const outputBridge = (
  outputQueue: Queue.Enqueue<DerivedState>,
  derivedAtom: Atom<DerivedState>
) =>
  // Consumer fiber: drain queue → batch → set atom
  Effect.forever(
    Effect.gen(function* () {
      const batch = yield* Queue.takeAll(outputQueue)
      if (batch.length > 0) {
        // Merge batch into single derived state update
        const merged = mergeDerivedState(Array.from(batch))
        yield* Atom.set(derivedAtom, merged)
      }
      yield* Effect.yieldNow()
    })
  ).pipe(Effect.withSpan('tsingou.output.bridge'))
```

### 7.2 Atom → Tsingou Rendering Layers

```typescript
// Atoms that rendering layers consume
const activeSignalsAtom = Atom.make<BaseSignal[]>([])        // R3F, p5, visx, DOM
const signalCountAtom = Atom.make<number>(0)                  // visx counters
const topKSignalsAtom = Atom.make<BaseSignal[]>([])           // visx top-K display
const crossCorrelationAtom = Atom.make<Correlation[]>([])     // visx network graph
const anomalyAtom = Atom.make<Anomaly[]>([])                  // R3F alert markers
```

---

## 8. Custom Operators (@tmnl/tsingou-operators)

### 8.1 window(durationMs)

Sliding time window. Emits the collection of signals within the last N milliseconds.

```typescript
// Extends d2ts UnaryOperator
// Maintains internal buffer keyed by timestamp
// Each run(): evict expired entries, emit current window as MultiSet
```

### 8.2 throttle(maxPerVersion)

Rate-limits signals to max N per version. Drops excess.

```typescript
// Extends d2ts UnaryOperator
// Counts signals per version
// Passes first N, drops rest
```

### 8.3 schemaValidate(registry)

Validates MultiSet entries against the schema registry.

```typescript
// Extends d2ts UnaryOperator
// For each entry: lookup schema by signal.kind → decode → pass or drop
// Logs validation errors via Effect.log
```

---

## 9. Dependencies

```json
{
  "@electric-sql/d2ts": "^0.x",
  "@nats-io/nats.js": "^3.x",
  "@nats-io/jetstream": "^3.x",
  "@nats-io/kv": "^3.x",
  "effect": "^3.x",
  "@effect/platform": "^0.x",
  "@effect/schema": "^0.x"
}
```

---

## 10. File Structure

```
packages/tmnl/src/lib/tsingou-flow/
├── index.ts                        # Public exports
├── schemas/
│   ├── base-signal.ts              # BaseSignal + branded IDs
│   ├── midi-signal.ts              # MidiSignal extension
│   ├── osc-signal.ts               # OscSignal extension
│   ├── nats-signal.ts              # NatsSignal extension
│   ├── http-signal.ts              # HttpSignal extension
│   ├── serial-signal.ts            # SerialSignal extension
│   ├── rss-signal.ts               # RssSignal extension
│   ├── websocket-signal.ts         # WebSocketSignal extension
│   ├── file-watch-signal.ts        # FileWatchSignal extension
│   └── signal-union.ts             # Signal union type
├── services/
│   ├── TsingouFlow.ts              # Main graph lifecycle service
│   ├── AdapterManager.ts           # Hot-plug adapter registry
│   ├── SchemaRegistry.ts           # NATS KV schema registry
│   └── OutputBridge.ts             # Queue → Atom bridge
├── adapters/
│   ├── types.ts                    # SourceAdapterShape interface
│   ├── NatsAdapter.ts              # NATS JetStream adapter
│   ├── FileWatchAdapter.ts         # File system watcher
│   ├── HttpAdapter.ts              # HTTP poll / SSE
│   ├── SerialAdapter.ts            # Serial port (USB/UART)
│   ├── WebSocketAdapter.ts         # WebSocket client
│   ├── MidiAdapter.ts              # Web MIDI / node-midi
│   ├── OscAdapter.ts               # OSC UDP listener
│   └── RssAdapter.ts               # RSS/Atom feed poller
├── graph/
│   ├── ingest.ts                   # Ingest D2 graph factory
│   ├── derived.ts                  # Derived D2 graph factory
│   ├── version.ts                  # Version/Antichain helpers
│   └── multiset-helpers.ts         # MultiSet<Signal> constructors
├── operators/
│   ├── index.ts                    # Operator exports
│   ├── window.ts                   # Sliding time window
│   ├── throttle.ts                 # Rate limiter
│   └── schema-validate.ts          # Schema validation operator
└── atoms/
    └── index.ts                    # Output atoms for rendering
```

---

*This is the blueprint, Prime. Every signal — NATS, serial, MIDI, RSS, HTTP, OSC, WebSocket, file watch — enters through the same adapter contract, flows through the same d2ts differential dataflow graphs, and exits through the same Effect.Queue → Atom bridge into Tsingou's four rendering layers.*

*The schema registry in NATS KV means new signal types are discovered at runtime. The hot-plug adapter manager means new sources appear mid-analysis. The tiered graph topology means normalization is separate from computation. The multi-dimensional versioning means signals from different sources maintain causal ordering without blocking each other.*

*Task #1311 complete. Ready for schema implementation (#1312).*
