# TSG-RFC-001 Section: State Management

```
Section:       State Management
Parent RFC:    TSG-RFC-001 (Tsingou Signal Analysis Platform)
Status:        DRAFT
Author:        Val (architecture-reviewer)
Created:       2026-02-18
Research Base: ADR-005 (Atom-as-State), SPEC.md (215 lines),
               TsingouFlow.ts (276 lines), AdapterManager.ts (411 lines),
               nw-wrld-reference/04_STATE_PERSISTENCE.md,
               nw-wrld-reference/ARCHITECTURE_ANALYSIS.md
```

> This section specifies the state management architecture for Tsingou. It covers the
> Atom-as-State doctrine, the complete atom inventory across services, the Effect.Ref
> boundary rules, the reactive subscription model, NATS KV state persistence, scoped
> lifecycle management, and error state propagation. The key words "MUST", "MUST NOT",
> "SHOULD", "SHOULD NOT", and "MAY" are to be interpreted as described in [RFC2119]
> and [RFC8174].

---

## Table of Contents

1. [TSG.4.1 Atom-as-State Doctrine](#tsg41-atom-as-state-doctrine)
2. [TSG.4.2 Atom Inventory](#tsg42-atom-inventory)
3. [TSG.4.3 Effect.Ref Boundaries](#tsg43-effectref-boundaries)
4. [TSG.4.4 Reactive Subscription Model](#tsg44-reactive-subscription-model)
5. [TSG.4.5 NATS KV Integration](#tsg45-nats-kv-integration)
6. [TSG.4.6 State Persistence](#tsg46-state-persistence)
7. [TSG.4.7 Scoped Lifecycle Management](#tsg47-scoped-lifecycle-management)
8. [TSG.4.8 Error State Management](#tsg48-error-state-management)
9. [TSG.4.9 Normative Requirements](#tsg49-normative-requirements)
10. [TSG.4.10 References](#tsg410-references)

---

## TSG.4.1 Atom-as-State Doctrine

### TSG.4.1.1 Design Rationale

The Atom-as-State pattern [ADR-005] establishes `Atom.make()` from effect-atom as the primary state primitive for all mutable state that React consumes. This is a deliberate departure from the default Effect-TS pattern of using `Effect.Ref<T>` inside services.

The problem with `Effect.Ref` for React-consumed state:

1. `Effect.Ref` lives inside the Effect runtime — React cannot subscribe to it directly.
2. Bridging `Effect.Ref` to React requires either polling, `SubscriptionRef`, or streams-to-consume-streams — all of which add complexity and latency.
3. The bridge code becomes a source of bugs: stale closures, missed updates, memory leaks from unsubscribed streams.

The Atom-as-State doctrine eliminates the bridge entirely:

```
TRADITIONAL (Effect.Ref + bridge):
  Service ──set──▶ Effect.Ref ──bridge──▶ React state ──render──▶ DOM

ATOM-AS-STATE (no bridge):
  Service ──Atom.set()──▶ Atom ◀──useAtomValue()── React ──render──▶ DOM
```

### TSG.4.1.2 Decision Rules

| State Type | Primitive | Rationale |
|-----------|-----------|-----------|
| React-visible pipeline status | `Atom.make()` | React subscribes via `useAtomValue()` |
| React-visible adapter health | `Atom.make()` | React subscribes via `useAtomValue()` |
| React-visible signal counts | `Atom.make()` | React subscribes via `useAtomValue()` |
| React-visible lifecycle events | `Atom.make()` | React subscribes via `useAtomValue()` |
| React-visible output signals | `Atom.make()` | React subscribes via `useAtomValue()` |
| Internal HTTP adapter ETag | `Effect.Ref` | React never sees this; purely internal cache |
| Internal RSS dedup HashSet | `Effect.Ref` | React never sees this; purely internal dedup state |
| Internal adapter sequence counter | `Effect.Ref` | React never sees this; monotonic counter for version tuple |

The rule is unambiguous: **If React will ever consume this state, use `Atom.make()`. If React will never see it, use `Effect.Ref` or local mutable state.**

### TSG.4.1.3 TMNL Precedent

The Atom-as-State pattern was established in TMNL's DataManager EPOCH-0002. The DataManager service uses atoms for all observable state (loading status, cached data, error state) and `Effect.Ref` only for internal cache management. This precedent directly informed ADR-005.

### TSG.4.1.4 Comparison with nw_wrld

nw_wrld uses a split-brain state model that Tsingou deliberately rejects:

| Aspect | nw_wrld | Tsingou |
|--------|---------|---------|
| **Primary state** | Jotai atoms (React) + mutable closures (services) + `UserData` (persistence) | `Atom.make()` for React-visible, `Effect.Ref` for internal-only |
| **Synchronization** | Manual sync between Jotai, closures, and UserData | No sync needed — atoms ARE the state |
| **God-object** | `UserData` contains all state (~2000 fields) | No god-object — state scoped to services |
| **Persistence** | `fs.writeFile` with `.backup` dance | NATS KV (transactional, distributed) |
| **Initialization** | Read JSON file → parse → set atoms → hope nothing races | Effect Layer composition provides state in order |
| **Cleanup** | Manual `clearState()` functions | `Effect.addFinalizer()` deterministic cleanup |

The fundamental insight: nw_wrld has THREE sources of truth (Jotai atoms, mutable closures, UserData JSON) that must be manually synchronized. Tsingou has ONE source of truth per concern (an atom), with persistence as a downstream projection (NATS KV snapshot of atom state).

### TSG.4.1.5 Prohibited Patterns

The following patterns MUST NOT be used in Tsingou:

```typescript
// PROHIBITED: useState for cross-component state
const [status, setStatus] = useState<'idle' | 'running'>('idle')
// This leaks setter props through the component tree ("setter soup")

// PROHIBITED: Effect.Ref for React-consumed state
const statusRef = yield* Effect.Ref.make<Status>('idle')
yield* Effect.Ref.set(statusRef, 'running')
// React cannot subscribe to this without a bridge

// PROHIBITED: SubscriptionRef bridge
const subRef = yield* SubscriptionRef.make<Status>('idle')
const stream = yield* SubscriptionRef.changes(subRef)
// Unnecessary complexity — atoms already provide subscription

// PROHIBITED: Atom.family() inside components
function MyComponent() {
  const atom = Atom.family(myKey)  // Creates new atom on every render!
  // Atom.family must be called at module level
}
```

---

## TSG.4.2 Atom Inventory

### TSG.4.2.1 TsingouFlow Service Atoms

Defined in `TsingouFlow.ts:47-64`, verified:

| Atom | Type | Initial Value | Purpose | Consumer |
|------|------|--------------|---------|----------|
| `tickAtom` | `number` | `0` | Global processing cycle counter | DOM metrics, visx timeline |
| `pipelineStatusAtom` | `'idle' \| 'running' \| 'paused' \| 'error' \| 'shutdown'` | `'idle'` | Pipeline lifecycle status | DOM status indicator |
| `tickSignalCountAtom` | `number` | `0` | Signals processed in current tick | DOM metrics |
| `cycleDurationMsAtom` | `number` | `0` | Processing cycle duration (ms) | DOM performance display |
| `totalProcessedAtom` | `number` | `0` | Total signals processed across all ticks | DOM counter |
| `throughputAtom` | `number` | `0` | Signals/sec (rolling 5-second window) | DOM throughput gauge |

### TSG.4.2.2 AdapterManager Service Atoms

Defined in `AdapterManager.ts:60-92`, verified:

| Atom | Type | Initial Value | Purpose | Consumer |
|------|------|--------------|---------|----------|
| `adapterRegistryAtom` | `Map<string, RegisteredAdapter>` | `new Map()` | Active adapter registry | DOM adapter list |
| `adapterHealthAtom` | `Map<string, AdapterHealth>` | `new Map()` | Per-adapter health status | DOM health cards |
| `totalSignalCountAtom` | `number` | `0` | Total signals ingested across all adapters | DOM counter |
| `lifecycleEventsAtom` | `Array<LifecycleEvent>` | `[]` | Adapter lifecycle event log (capped at 200) | DOM event log |

### TSG.4.2.3 OutputBridge Atoms

Defined in `OutputBridge.ts`, verified:

| Atom | Type | Initial Value | Purpose | Consumer |
|------|------|--------------|---------|----------|
| `activeSignalsAtom` | `BaseSignal[]` | `[]` | Most recent signals (capped at `maxAtomItems`) | All 4 rendering layers |
| `derivedSignalCountAtom` | `number` | `0` | Total derived signals produced | DOM counter |

### TSG.4.2.4 Planned Derived Atoms (design-only)

| Atom | Type | Purpose | Consumer |
|------|------|---------|----------|
| `topKSignalsAtom` | `BaseSignal[]` | Top-K most frequent signal kinds | visx ranking, DOM table |
| `crossCorrelationAtom` | `Correlation[]` | Cross-source correlation results | R3F graph, visx matrix |
| `anomalyAtom` | `Anomaly[]` | Detected anomalies | R3F markers, DOM alerts |
| `fftMagnitudesAtom` | `number[]` | SDR FFT output | p5 waterfall |
| `selectedSignalIdsAtom` | `Set<string>` | Cross-layer selection state | All layers |
| `hoveredSignalIdAtom` | `string \| null` | Cross-layer hover state | All layers |

### TSG.4.2.5 Atom Summary

| Service | Atom Count (built) | Atom Count (planned) | Total |
|---------|-------------------|---------------------|-------|
| TsingouFlow | 6 | 0 | 6 |
| AdapterManager | 4 | 0 | 4 |
| OutputBridge | 2 | 4 | 6 |
| Cross-layer | 0 | 2 | 2 |
| **Total** | **12** | **6** | **18** |

---

## TSG.4.3 Effect.Ref Boundaries

### TSG.4.3.1 When to Use Effect.Ref

`Effect.Ref` is the Effect-TS primitive for managed mutable references within the Effect runtime. It provides atomic read-modify-write operations and integrates with Effect's concurrency model.

`Effect.Ref` SHOULD be used when:

1. The state is internal to a service and React will NEVER consume it.
2. The state requires atomic compare-and-swap semantics.
3. The state is used only within `Effect.gen()` blocks, never in React components.

### TSG.4.3.2 Effect.Ref Use Cases in Tsingou

| Service | Ref Purpose | Type | Why Not Atom |
|---------|------------|------|-------------|
| `HttpAdapter` | HTTP ETag cache | `Ref<Map<string, string>>` | React never displays ETags; purely for conditional requests |
| `HttpAdapter` | Adaptive poll interval | `Ref<number>` | Internal timer adjustment; React doesn't need poll frequency |
| `RssAdapter` | Dedup hash set | `Ref<HashSet<string>>` | GUID dedup state; React doesn't need to see which GUIDs were seen |
| `RssAdapter` | Feed error count | `Ref<number>` | Internal retry logic; adapter health atom covers the observable status |
| `SerialAdapter` | Buffer accumulator | `Ref<Uint8Array>` | Partial frame reassembly; signals are emitted as complete frames |

### TSG.4.3.3 Decision Flowchart

```
Does React need to see this state?
│
├─ YES ──▶ Atom.make()
│          ├── Atom.set() in services
│          └── useAtomValue() in React
│
└─ NO ──▶ Is this state internal to a single Effect.gen block?
          │
          ├─ YES ──▶ Local mutable variable (let x = ...)
          │          Simplest option for loop counters, accumulators
          │
          └─ NO ──▶ Effect.Ref
                    ├── Shared between multiple Effect.gen blocks
                    ├── Needs atomic read-modify-write
                    └── Lives for the duration of the service scope
```

---

## TSG.4.4 Reactive Subscription Model

### TSG.4.4.1 Service-Side: Atom.set() and Atom.unsafeGet()

Services mutate atoms using `Atom.set()` for writes and `Atom.unsafeGet()` for synchronous reads within `Effect.gen()` blocks:

```typescript
// WRITE — set atom value (verified from TsingouFlow.ts:114-119)
const currentTick = Atom.unsafeGet(tickAtom) + 1
Atom.set(tickAtom, currentTick)
Atom.set(tickSignalCountAtom, signalArray.length)
Atom.set(
  totalProcessedAtom,
  Atom.unsafeGet(totalProcessedAtom) + signalArray.length,
)

// WRITE — lifecycle event append (verified from AdapterManager.ts:94-105)
const appendLifecycleEvent = (type: string, adapterId: string, detail?: string) => {
  const events = Atom.unsafeGet(lifecycleEventsAtom)
  const capped = events.length > 200 ? events.slice(-100) : events
  Atom.set(lifecycleEventsAtom, [
    ...capped,
    { type, adapterId, timestamp: new Date(), detail },
  ])
}
```

### TSG.4.4.2 React-Side: useAtomValue()

React components subscribe to atoms via `useAtomValue()` from effect-atom. This hook:

1. Subscribes to the atom on mount.
2. Triggers a React re-render when the atom value changes.
3. Unsubscribes on unmount (no memory leak).
4. Uses referential equality check to avoid unnecessary re-renders.

```typescript
function PipelineStatus() {
  const status = useAtomValue(pipelineStatusAtom)
  const throughput = useAtomValue(throughputAtom)
  const totalProcessed = useAtomValue(totalProcessedAtom)

  return (
    <div>
      <StatusBadge status={status} />
      <span>{throughput} signals/sec</span>
      <span>{totalProcessed.toLocaleString()} total</span>
    </div>
  )
}

function AdapterDashboard() {
  const registry = useAtomValue(adapterRegistryAtom)
  const health = useAtomValue(adapterHealthAtom)

  return (
    <div>
      {Array.from(registry.entries()).map(([id, adapter]) => (
        <AdapterCard
          key={id}
          adapter={adapter}
          health={health.get(id)}
        />
      ))}
    </div>
  )
}
```

### TSG.4.4.3 Atom Subscription Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                        EFFECT RUNTIME                              │
│                                                                    │
│  TsingouFlow                         AdapterManager                │
│  ┌────────────────────┐              ┌─────────────────────┐      │
│  │ Atom.set(tickAtom)  │              │ Atom.set(registryAtom)│      │
│  │ Atom.set(statusAtom)│              │ Atom.set(healthAtom) │      │
│  │ Atom.set(throughput)│              │ appendLifecycleEvent │      │
│  └────────┬───────────┘              └─────────┬───────────┘      │
│           │                                     │                  │
│           ▼                                     ▼                  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    ATOM STORE                                │  │
│  │                                                              │  │
│  │  tickAtom ─────────────────────────┐                        │  │
│  │  pipelineStatusAtom ───────────────┤                        │  │
│  │  throughputAtom ───────────────────┤                        │  │
│  │  totalProcessedAtom ───────────────┤── subscribers notified │  │
│  │  adapterRegistryAtom ──────────────┤                        │  │
│  │  adapterHealthAtom ────────────────┤                        │  │
│  │  activeSignalsAtom ────────────────┤                        │  │
│  │  lifecycleEventsAtom ──────────────┘                        │  │
│  └──────────────────────────┬──────────────────────────────────┘  │
│                              │                                     │
└──────────────────────────────┼─────────────────────────────────────┘
                               │
                               ▼ useAtomValue() subscriptions
┌──────────────────────────────────────────────────────────────────┐
│                        REACT TREE                                 │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ PipelineStatus│  │ AdapterDash  │  │ SignalTable / R3F / p5 │  │
│  │ statusAtom   │  │ registryAtom │  │ activeSignalsAtom      │  │
│  │ throughputAtom│  │ healthAtom   │  │ crossCorrelationAtom   │  │
│  └─────────────┘  └──────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## TSG.4.5 NATS KV Integration

### TSG.4.5.1 KV Buckets as State Stores

NATS KV provides persistent, distributed key-value storage for configuration and registry state. Three buckets are defined [TSG.1.4.4]:

| Bucket | Key Pattern | Value Schema | Purpose |
|--------|------------|-------------|---------|
| `tsingou-schemas` | Signal kind string | `SchemaRegistryEntry` | Signal type schemas for runtime validation |
| `tsingou-adapters` | Adapter ID | Adapter configuration JSON | Adapter configuration persistence |
| `tsingou-sessions` | Session ID | Session state JSON | Analysis session configuration and state |

### TSG.4.5.2 KV -> Atom Synchronization

For state that lives in NATS KV and also needs to be reactive in the UI, the synchronization pattern is:

```
NATS KV (persistent)
    │
    ├── kv.watch({ key: '>' })  ── real-time change notifications
    │
    ▼
SchemaRegistry service
    │
    ├── Updates internal cache
    ├── Atom.set(schemaRegistryAtom, updatedMap)
    │
    ▼
React (useAtomValue(schemaRegistryAtom))
```

The NATS KV is the source of truth for persistent state. The atom is a reactive projection of that state for the UI. On startup, the service reads from KV to initialize the atom. During operation, KV watches push changes to the atom.

### TSG.4.5.3 Key Format Constraints

NATS KV keys become NATS subjects internally (`$KV.bucket.key`). Therefore:

- Colons (`:`) MUST NOT be used in keys — they are invalid in NATS subjects.
- Dots (`.`) SHOULD be used as separators within keys.
- Keys MUST use lowercase alphanumeric characters, dots, and hyphens only.

Example: `host.sensor-1` (correct), NOT `host:sensor-1` (invalid).

---

## TSG.4.6 State Persistence

### TSG.4.6.1 Persistence Model

Tsingou uses a three-tier persistence model:

| Tier | Technology | Lifetime | Content |
|------|-----------|----------|---------|
| **Ephemeral** | Atoms (`Atom.make()`) | Process lifetime | Pipeline status, signal buffers, health snapshots |
| **Session** | NATS KV | Session lifetime | Adapter configs, graph configurations, schema registry |
| **Historical** | NATS JetStream | Configurable retention | Signal history, derived state, audit events |

### TSG.4.6.2 Persistence Guarantees

| Operation | Guarantee |
|-----------|-----------|
| Atom writes | Immediate (in-memory), lost on process exit |
| KV puts | Durable after `kv.put()` returns (NATS server acknowledged) |
| JetStream publish | Durable after `js.publish()` returns with `PubAck` |
| Session recovery | Read KV -> rebuild atoms -> resume pipeline |

### TSG.4.6.3 Session Recovery Protocol

When Tsingou restarts or recovers from a crash, the following recovery sequence MUST be executed:

```
1. Read HolonetConfig from tsingou.toml
2. Connect to NATS cluster
3. Read KV bucket: tsingou-schemas → initialize SchemaRegistry atoms
4. Read KV bucket: tsingou-adapters → reconstruct adapter configurations
5. Read KV bucket: tsingou-sessions → restore last session state
6. Create AdapterManager with recovered configurations
7. Re-register adapters from recovered configs (triggers connect)
8. Create TsingouFlow with recovered graph configuration
9. Start processing loop
10. Resume signal ingestion from JetStream at last known sequence
```

Step 10 is critical: NATS JetStream provides `DeliverByStartSequence` consumer delivery, allowing Tsingou to resume ingestion from the exact point where it stopped. This means no signal loss during restart, provided JetStream retention has not expired.

### TSG.4.6.4 State Snapshot Pattern

For diagnostic purposes, implementations MAY periodically snapshot all atom values to a state dump:

```typescript
const snapshotState = Effect.gen(function* () {
  return {
    timestamp: new Date(),
    pipeline: {
      status: Atom.unsafeGet(pipelineStatusAtom),
      tick: Atom.unsafeGet(tickAtom),
      throughput: Atom.unsafeGet(throughputAtom),
      totalProcessed: Atom.unsafeGet(totalProcessedAtom),
      cycleDurationMs: Atom.unsafeGet(cycleDurationMsAtom),
    },
    adapters: {
      count: Atom.unsafeGet(adapterRegistryAtom).size,
      health: Object.fromEntries(Atom.unsafeGet(adapterHealthAtom)),
      totalIngested: Atom.unsafeGet(totalSignalCountAtom),
    },
    output: {
      activeSignals: Atom.unsafeGet(activeSignalsAtom).length,
      derivedCount: Atom.unsafeGet(derivedSignalCountAtom),
    },
  }
})
```

This snapshot is published to `tsingou.internal.diagnostics.snapshot` for monitoring tools.

### TSG.4.6.5 nw_wrld Persistence Comparison

| Aspect | nw_wrld | Tsingou |
|--------|---------|---------|
| Write mechanism | `fs.writeFile(path, JSON.stringify(data))` | `kv.put(key, value)` |
| Backup strategy | Rename current to `.backup`, write new, delete `.backup` | NATS KV maintains version history |
| Transaction safety | None — power loss during write = corrupt file | NATS server handles atomicity |
| Distribution | Single-machine file | NATS cluster replication |
| Format | Raw JSON files | NATS KV (binary, schema-validated) |
| Recovery | Parse JSON, hope it's valid | KV.get() with version history |

---

## TSG.4.7 Scoped Lifecycle Management

### TSG.4.7.1 Effect.addFinalizer() for Cleanup

Tsingou services use `Effect.addFinalizer()` to register deterministic cleanup handlers that execute when the enclosing scope closes. This is the Effect equivalent of `try/finally` but composable and guaranteed.

**TsingouFlow cleanup** (verified from `TsingouFlow.ts:202`):

```typescript
// Cleanup on scope close — interrupts processing fiber, shuts down output bridge
yield* Effect.addFinalizer(() => shutdown)
```

Where `shutdown` (lines 191-199):

```typescript
const shutdown: Effect.Effect<void> = Effect.gen(function* () {
  if (processingFiber) {
    yield* Fiber.interrupt(processingFiber)
    processingFiber = null
  }
  yield* outputBridge.shutdown
  Atom.set(pipelineStatusAtom, 'shutdown')
  yield* Effect.log('[TsingouFlow] Shutdown complete')
}).pipe(Effect.withSpan('tsingou.flow.shutdown'))
```

### TSG.4.7.2 AdapterManager Scoped Lifecycle

Each adapter registration creates a dedicated scope (verified from `AdapterManager.ts:15-16` docstring):

```
register(layer) → Scope.fork → Layer.buildWithScope → adapter running
unregister(id)  → Scope.close → adapter finalizers run → cleanup
```

This means:
1. **Registration**: A new `Scope` is created via `Scope.make()`. The adapter's Effect.Service is built within this scope.
2. **Running**: The adapter pushes signals via the shared `SignalQueueTag`. Its finalizers are registered in its scope.
3. **Unregistration**: `Scope.close()` is called. All finalizers run — disconnecting from the source, releasing resources, cleaning up subscriptions.

### TSG.4.7.3 Scope Hierarchy

```
Application Scope (top-level Effect.runFork)
  │
  └── TsingouFlow Scope (scoped: true)
       │ Finalizer: interrupt processing fiber, shutdown output bridge
       │
       └── AdapterManager Scope (scoped: true)
            │ Finalizer: close all adapter scopes
            │
            ├── Adapter Scope: nats-source-1
            │   Finalizer: NATS unsubscribe, cleanup
            │
            ├── Adapter Scope: http-poll-bbc
            │   Finalizer: cancel poll timer, cleanup
            │
            └── Adapter Scope: serial-arduino-3
                Finalizer: serial port close, cleanup
```

When the application scope closes, cleanup propagates from TsingouFlow -> AdapterManager -> each adapter scope, in reverse registration order.

### TSG.4.7.4 Resource Leak Prevention

Implementations MUST ensure that every resource acquired within a scope has a corresponding `Effect.addFinalizer()`:

| Resource | Acquisition | Finalizer |
|----------|------------|-----------|
| NATS subscription | `nats.subscribe(subject)` | `subscription.drain()` |
| HTTP poll timer | `Effect.schedule(poll, Schedule.spaced(...))` | Fiber interrupt (automatic with scope) |
| WebSocket connection | `Socket.open(url)` | `Socket.close()` |
| Serial port | `serial.open(config)` | `serial.close()` |
| File watcher | `fs.watch(path)` | `watcher.close()` |
| Processing fiber | `Effect.fork(loop)` | `Fiber.interrupt(fiber)` |
| Output bridge queue | `Queue.bounded(1024)` | `Queue.shutdown(queue)` |

Scope closures MUST be treated as infallible. If a finalizer fails, the failure is logged but cleanup continues. Implementations MUST NOT allow a single finalizer failure to prevent other finalizers from running.

### TSG.4.7.5 Adapter Lifecycle State Machine

Each adapter transitions through a defined lifecycle managed by the AdapterManager:

```
            register()              connect()
UNREGISTERED ──────────▶ REGISTERED ──────────▶ CONNECTED
                              │                     │
                              │                     │ error
                              │                     ▼
                              │                 DEGRADED
                              │                     │
                              │                     │ reconnect / error
                              │                     ▼
                              │                  ERROR
                              │                     │
                         unregister()          unregister()
                              │                     │
                              ▼                     ▼
                         UNREGISTERED          UNREGISTERED
                         (scope closed)        (scope closed)
```

State transitions are recorded in `lifecycleEventsAtom` and published to `tsingou.adapter.{adapterId}.health`.

| State | healthAtom Status | Behavior |
|-------|-------------------|----------|
| REGISTERED | `'disconnected'` | Adapter created, scope allocated, not yet connected |
| CONNECTED | `'connected'` | Actively producing signals |
| DEGRADED | `'degraded'` | Experiencing intermittent errors, still producing some signals |
| ERROR | `'error'` | Failed, not producing signals, may auto-retry |
| UNREGISTERED | (atom removed) | Scope closed, all resources released |

### TSG.4.7.6 Concurrency Considerations

Tsingou uses structured concurrency via Effect fibers. Key concurrency patterns:

| Pattern | Usage | Effect Primitive |
|---------|-------|-----------------|
| Processing loop | TsingouFlow drain loop | `Effect.fork(Effect.forever(processCycle))` |
| Output bridge consumer | Batch Queue -> Atom writes | `Effect.fork(Effect.forever(drainOutput))` |
| Adapter health polling | Periodic health checks | `Effect.schedule(checkHealth, Schedule.spaced('5 seconds'))` |
| Throughput calculation | Rolling 5-second window | In-loop calculation (no separate fiber) |

All forked fibers are children of their service's scope. When the scope closes, all child fibers are interrupted automatically. This prevents orphaned fibers.

Implementations MUST NOT use raw `Promise` or `setTimeout` for concurrency. All concurrent operations MUST use Effect fibers so they participate in the structured concurrency hierarchy.

---

## TSG.4.8 Error State Management

### TSG.4.8.1 Error Atoms

Error state is propagated to the UI through atoms, following the Atom-as-State doctrine:

| Atom | Error Source | Content |
|------|-------------|---------|
| `pipelineStatusAtom` (value: `'error'`) | TsingouFlow processing loop crash | Pipeline-level error |
| `adapterHealthAtom` (status: `'error'`) | Individual adapter connection failure | Per-adapter error |
| `lifecycleEventsAtom` (type: `'error'`) | Adapter registration/unregistration failure | Event log entry |

### TSG.4.8.2 Health Status Propagation

```
Adapter error (Data.TaggedError)
    │
    ├── catchTag recovery attempt
    │   ├── Success → adapter continues, health: 'connected'
    │   └── Failure → health: 'degraded' or 'error'
    │
    ├── Atom.set(adapter.healthAtom, { status: 'error', ... })
    │
    ▼
AdapterManager
    │
    ├── Updates adapterHealthAtom map entry
    ├── Appends to lifecycleEventsAtom
    │
    ▼
React (useAtomValue(adapterHealthAtom))
    │
    └── Renders health card with error indicator
```

### TSG.4.8.3 Diagnostic State

For debugging and operational monitoring, Tsingou exposes diagnostic atoms:

| Atom | Type | Content |
|------|------|---------|
| `cycleDurationMsAtom` | `number` | How long each processing cycle takes |
| `throughputAtom` | `number` | Signals per second (rolling 5s window) |
| `totalProcessedAtom` | `number` | Cumulative signal count |
| `totalSignalCountAtom` | `number` | Cumulative ingestion count |
| `lifecycleEventsAtom` | `Array<LifecycleEvent>` | Timestamped event log |

These atoms enable the DOM layer to render a diagnostic dashboard showing pipeline health, adapter status, throughput trends, and lifecycle event history — without any direct coupling to the pipeline implementation.

---

## TSG.4.9 Atom Testing Patterns

### TSG.4.9.1 Registry-Based Testing

All atom tests use `Registry.make()` to create an isolated registry per test case. This prevents test pollution and eliminates the need for global state cleanup:

```typescript
import { Registry } from '@effect-rx/rx'
import { Atom } from '@effect-rx/rx'

describe('TsingouFlow atoms', () => {
  let registry: Registry.Registry

  beforeEach(() => {
    registry = Registry.make()
  })

  it('pipelineStatusAtom defaults to idle', () => {
    expect(registry.get(pipelineStatusAtom)).toBe('idle')
  })

  it('tickAtom increments', () => {
    registry.set(tickAtom, 1)
    expect(registry.get(tickAtom)).toBe(1)
    registry.set(tickAtom, 2)
    expect(registry.get(tickAtom)).toBe(2)
  })

  it('throughputAtom reflects processing rate', () => {
    registry.set(throughputAtom, 150.5)
    expect(registry.get(throughputAtom)).toBeCloseTo(150.5)
  })
})
```

### TSG.4.9.2 Effect Service + Atom Integration Testing

When testing services that mutate atoms, use `Effect.runPromise` with a provided layer. The test verifies both the Effect return value and the atom side-effects:

```typescript
import { Effect } from 'effect'
import { it } from '@effect/vitest'

describe('AdapterManager atom integration', () => {
  it.effect('register updates adapterRegistryAtom', () =>
    Effect.gen(function* () {
      const manager = yield* AdapterManager
      yield* manager.register(mockNatsAdapter)

      const registry = yield* AtomRegistry
      const adapters = registry.get(adapterRegistryAtom)
      expect(adapters.size).toBe(1)
    }).pipe(
      Effect.provide(AdapterManager.Default),
      Effect.provide(TestAtomRegistry)
    )
  )
})
```

### TSG.4.9.3 Derived Atom Testing

Derived atoms (atoms computed from other atoms) require setting the source atoms first, then reading the derived atom:

```typescript
// Example: derived atom that computes adapter health summary
const healthSummaryAtom = Atom.derive((get) => {
  const health = get(adapterHealthAtom)
  return {
    total: health.size,
    connected: [...health.values()].filter(h => h.status === 'connected').length,
    errored: [...health.values()].filter(h => h.status === 'error').length,
  }
})

describe('healthSummaryAtom', () => {
  it('computes from adapterHealthAtom', () => {
    const registry = Registry.make()
    registry.set(adapterHealthAtom, new Map([
      ['nats-1', { status: 'connected', lastSeen: Date.now() }],
      ['http-1', { status: 'error', lastSeen: Date.now(), error: 'timeout' }],
    ]))

    const summary = registry.get(healthSummaryAtom)
    expect(summary.total).toBe(2)
    expect(summary.connected).toBe(1)
    expect(summary.errored).toBe(1)
  })
})
```

### TSG.4.9.4 Test Classification Matrix

| Test Category | Tool | Registry | Effect Layer | Assertion Target |
|---------------|------|----------|-------------|------------------|
| Atom defaults | `describe()` | `Registry.make()` | None | Initial values |
| Atom mutations | `describe()` | `Registry.make()` | None | Values after `set()` |
| Derived atoms | `describe()` | `Registry.make()` | None | Computed values |
| Service → atom | `it.effect()` | `TestAtomRegistry` | Service.Default | Atom side-effects |
| KV → atom sync | `it()` + `runPromise` | `Registry.make()` | NatsTestLayer | KV watch → atom update |
| React → atom | `@testing-library/react` | `<RegistryProvider>` | None | DOM reflects atom state |

---

## TSG.4.10 Migration Checklist: useState to Atom

### TSG.4.10.1 Identification Criteria

During Tsingou development, existing `useState` patterns from nw_wrld MUST be migrated to atoms when they meet any of the following criteria:

| Criterion | Example | Migration Action |
|-----------|---------|-----------------|
| Cross-component consumption | Signal list used by both sidebar and main panel | Extract to module-level `Atom.make()` |
| Service mutation | Pipeline status set by TsingouFlow service | Replace with `Atom.set()` in Effect context |
| Async derivation | Adapter health derived from periodic NATS checks | Use `Atom.derive()` or operation atom |
| Multiple writers | Both user action and service update same state | Centralize in atom, use `ctx.set()` |
| Persistence requirement | Session config saved to NATS KV | Atom + KV sync pattern (TSG.4.5.2) |

### TSG.4.10.2 Migration Steps

For each identified `useState` pattern:

1. **Audit consumers** — `grep -rn "useStateName" src/` to find all read/write sites.
2. **Define atom** — Create `export const nameAtom = Atom.make<Type>(defaultValue)` at module level.
3. **Replace reads** — Change `const [value] = useState()` to `const value = useAtomValue(nameAtom)`.
4. **Replace writes** — Change `setValue(x)` to `registry.set(nameAtom, x)` (React) or `Atom.set(nameAtom, x)` (Effect).
5. **Remove useState** — Delete the `useState` declaration.
6. **Verify** — Run tests and confirm no `useState` references remain for this state.

### TSG.4.10.3 nw_wrld useState Inventory

The following nw_wrld patterns are candidates for atom migration during Tsingou reimplementation:

| nw_wrld Pattern | File(s) | State Shape | Migration Priority |
|----------------|---------|------------|-------------------|
| `useSelectedNode` | Graph views | `string \| null` | High — cross-layer |
| `useFilterState` | Filter panel | `FilterConfig` | High — multiple consumers |
| `useThemeMode` | Theme provider | `'light' \| 'dark'` | Medium — single writer |
| `useSignalBuffer` | Signal list | `BaseSignal[]` | Critical — service-mutated |
| `usePipelineStatus` | Status bar | `PipelineStatus` | Critical — service-mutated |
| `useAdapterList` | Adapter panel | `AdapterInfo[]` | Critical — service-mutated |

---

## TSG.4.11 Normative Requirements

### MUST Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.4-R1 | All mutable state consumed by React MUST use Atom.make() | TSG.4.1.1 |
| TSG.4-R2 | Services MUST NOT use Effect.Ref for state that React consumes | TSG.4.1.2 |
| TSG.4-R3 | Services MUST NOT use useState for cross-component state | TSG.4.1.5 |
| TSG.4-R4 | Services MUST NOT use SubscriptionRef bridges | TSG.4.1.5 |
| TSG.4-R5 | Atom.family() MUST NOT be called inside component render functions | TSG.4.1.5 |
| TSG.4-R6 | Colons MUST NOT be used in NATS KV keys | TSG.4.5.3 |
| TSG.4-R7 | Every resource acquired within a scope MUST have a corresponding Effect.addFinalizer() | TSG.4.7.4 |
| TSG.4-R8 | Scope closures MUST be treated as infallible | TSG.4.7.4 |
| TSG.4-R9 | Finalizer failures MUST NOT prevent other finalizers from running | TSG.4.7.4 |

### SHOULD Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.4-S1 | Effect.Ref SHOULD be used for internal-only service state that React never consumes | TSG.4.3.1 |
| TSG.4-S2 | Dots SHOULD be used as separators within NATS KV keys | TSG.4.5.3 |
| TSG.4-S3 | KV watches SHOULD be used to push persistent state changes to atoms | TSG.4.5.2 |

### MAY Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.4-M1 | Local mutable variables MAY be used for loop counters and accumulators within single Effect.gen blocks | TSG.4.3.3 |
| TSG.4-M2 | Lifecycle event atoms MAY cap their length to prevent unbounded memory growth | TSG.4.4.1 |

---

## TSG.4.12 References

| Key | Reference |
|-----|-----------|
| [RFC2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997 |
| [RFC8174] | Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017 |
| [ADR-005] | ADR-005: Atom-as-State Pattern. `docs/tsingou/adr/ADR-005-atom-as-state.md` |
| [EFFECT] | Effect-TS. "Effect: A TypeScript library for building production-grade applications." |
| [EFFECT-ATOM] | Tim Smart. "effect-atom — Reactive state management for Effect-TS." |
| [NATS-KV] | NATS.io. "NATS Key-Value Store." https://docs.nats.io/nats-concepts/jetstream/key-value-store |
| [04_STATE_PERSISTENCE] | nw_wrld State & Persistence Reference. `docs/tsingou/nw-wrld-reference/04_STATE_PERSISTENCE.md` |
| [ARCHITECTURE_ANALYSIS] | nw_wrld Architecture Analysis. `docs/tsingou/nw-wrld-reference/ARCHITECTURE_ANALYSIS.md` |
