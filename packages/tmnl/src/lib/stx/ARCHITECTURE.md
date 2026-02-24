# stx Architecture

## The Tri-Library Composition

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               stx({}) API                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐          │
│   │    XState       │   │  Legend-State   │   │   effect-atom   │          │
│   │   (Shape)       │   │   (Hydration)   │   │    (Bridge)     │          │
│   ├─────────────────┤   ├─────────────────┤   ├─────────────────┤          │
│   │ • Machines      │   │ • observable()  │   │ • Atom.make()   │          │
│   │ • Actors        │   │ • .get()/.set() │   │ • Atom.runtime()│          │
│   │ • Transitions   │   │ • Fine-grained  │   │ • Result<A,E>   │          │
│   │ • Guards        │   │ • Persistence   │   │ • Effect.gen    │          │
│   │ • Actions       │   │ • syncObservable│   │ • ManagedRuntime│          │
│   └────────┬────────┘   └────────┬────────┘   └────────┬────────┘          │
│            │                     │                     │                    │
│            └──────────┬──────────┴──────────┬──────────┘                    │
│                       │                     │                               │
│                       ▼                     ▼                               │
│            ┌──────────────────────────────────────────┐                    │
│            │           Composition Layer              │                    │
│            │                                          │                    │
│            │  Machine ←──→ Observable ←──→ Effect     │                    │
│            │  (logic)      (data)         (async)     │                    │
│            └──────────────────────────────────────────┘                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Role Assignment

| Library | Role | Responsibility |
|---------|------|----------------|
| **XState** | Shape/Logic | Defines valid states, transitions, guards, actions. The "what can happen" and "when". Actors handle async decisions. |
| **Legend-State** | Hydration/Data | Stores actual data with proxy-based fine-grained reactivity. The "where data lives". No re-renders on unrelated changes. |
| **effect-atom** | Effect Bridge | Bridges Effect-TS computations into React. Handles async with `Result<A,E>`, service-scoped state, and Effect.gen programs. |

## File Structure

```
src/lib/stx/
├── index.ts                 # Public exports (all APIs)
├── ARCHITECTURE.md          # This document
├── types.ts                 # TypeScript types for unified API
├── primitives.ts            # Re-exports from all three libraries
├── stx.ts                   # The stx({}) factory
├── stream.ts                # stxStream({}) progressive state factory
├── hooks.ts                 # React hooks (useStxValue, useStxStream, etc.)
├── bindings.ts              # Cross-library bridges (Effect→RxJS, Legend↔XState)
└── __tests__/
    ├── stx.test.ts          # 67 tests: core, computed, snapshot, layer, persist
    ├── bindings.test.ts     # 31 tests: Effect streams, Legend-State, XState
    ├── hooks.test.ts        # 55 tests: React hook integration (14 env-blocked)
    └── stream.test.ts       # 11 tests: progressive state, buffer, pause/resume
```

## Core API: `stx(config)`

### Config Shape

```typescript
const instance = stx({
  // XState machine (optional)
  machine: counterMachine,

  // Legend-State observable data (required)
  data: { count: 0, name: 'hello' },

  // Effect-TS effects (optional) — executed via ManagedRuntime if layer provided
  effects: {
    save: Effect.gen(function* () { ... }),
    fetch: (id: string) => Effect.gen(function* () { ... }),
  },

  // Derived values as atoms (optional)
  computed: {
    doubled: (get) => get.data.count.get() * 2,
    isActive: (get) => get.state?.matches('active') ?? false,
  },

  // Bidirectional bindings (optional)
  bindings: {
    dataToMachine: { selector: (d) => ({ count: d.count.get() }), toEvent: (v) => ({ type: 'UPDATE', ...v }) },
    machineToData: { selector: (s) => ({ count: s.context.count }), fields: ['count'] },
  },

  // Effect Layer for service provision (optional)
  layer: Layer.mergeAll(HttpClientLive, LoggerLive),

  // Persistence (optional)
  persist: {
    name: 'my-counter',           // localStorage key
    plugin: 'localStorage',       // or 'indexedDB' or plugin instance
    include: ['count'],           // only persist these fields
    exclude: ['transient'],       // or exclude these
  },
})
```

### Instance API

```typescript
interface Stx<TMachine, TData, TEffects, TComputed> {
  // Data (Legend-State observable — fine-grained reactivity)
  data: ObservableObject<TData>

  // Machine (XState v5)
  actor?: ActorRefFrom<TMachine>
  send?: (event: EventFromLogic<TMachine>) => void
  state?: SnapshotFrom<TMachine>

  // Effects (wrapped in Result<A, E>)
  effects: { [K in keyof TEffects]: (...args) => Promise<Result<A, E>> }

  // Computed (effect-atom atoms)
  computed: { [K in keyof TComputed]: Atom<ReturnType<TComputed[K]>> }

  // Effect runtime (if layer provided)
  runtime?: ManagedRuntime<any, any>

  // Internal registry for reading atoms outside React
  registry: Registry

  // Snapshot — captures all three layers as plain JSON
  snapshot(): StxSnapshot<TData, TMachine, TComputed>

  // Reset — restores initial data, machine context, and actor
  reset(): void

  // Dispose — stops actor, cleans up subscriptions, disposes runtime
  dispose(): void | Promise<void>
}
```

## Snapshot: Three-Layer Capture

`snapshot()` returns a JSON-serializable object with all three layers:

```typescript
interface StxSnapshot<TData, TMachine, TComputed> {
  data: TData                           // Legend-State deep resolve via data$.get()
  machine?: {
    value: string                       // Current state name
    context: Record<string, unknown>    // XState context
    persisted: unknown                  // Full getPersistedSnapshot() for restore
  }
  computed: Record<string, unknown>     // Re-evaluated from factories (not cached atoms)
}
```

**Key design decision**: Computed values are re-evaluated from their factory functions at snapshot time, not read from atom cache. This ensures the snapshot always reflects the current data, regardless of React subscription state.

## Effect Layer Provision

When `config.layer` is provided, a `ManagedRuntime` is created and used to execute all effects:

```typescript
const instance = stx({
  data: {},
  layer: Layer.mergeAll(HttpClientLive, LoggerLive),
  effects: {
    fetch: (id: string) =>
      Effect.gen(function* () {
        const http = yield* HttpClient    // ← Resolved from layer
        return yield* http.get(`/api/${id}`)
      }),
  },
})
```

Both standalone effect runners (section 7 in factory) AND `fromPromise` actors (section 2, invoked by XState) route through the ManagedRuntime when available.

## Persistence

Persistence wires `syncObservable` from Legend-State sync:

```typescript
const instance = stx({
  data: { settings: { theme: 'dark' }, transient: null },
  persist: {
    name: 'app-settings',
    plugin: 'localStorage',    // async-loads ObservablePersistLocalStorage
    include: ['settings'],     // only persist these fields
  },
})
```

Plugin resolution:
1. **Direct instance/class** — wired synchronously
2. **`'localStorage'`** — async import `@legendapp/state/persist-plugins/local-storage`
3. **`'indexedDB'`** — async import `@legendapp/state/persist-plugins/indexeddb`

Include/exclude filtering is applied via `transform.save`.

## Reset

`reset()` restores the full initial state:

1. **Data**: `structuredClone(initialData)` → batch-set all fields
2. **Machine**: `createActor(machine, { snapshot: initialMachineSnapshot })` → `actor.start()`
3. **Subscriptions**: Machine→Data subscriptions re-established

The initial machine snapshot is captured via `actor.getPersistedSnapshot()` immediately after the first `actor.start()`.

**Object.defineProperty pattern**: `state.actor` and `state.send` are defined as getters (`Object.defineProperty`) to prevent stale reference bugs when `reset()` reassigns the internal `let actor` variable.

## StxStream: Progressive State from Effect Streams

```typescript
const counter = stxStream({
  stream: Stream.fromSchedule(Schedule.spaced('100 millis')).pipe(
    Stream.scan(0, (n) => n + 1),
  ),
  initial: 0,
  buffer: 'all',     // or 'latest' | { size: N }
})
```

Architecture: `Stream → Fiber (consumer) → Legend-State observable → derived Atom (React)`

```typescript
interface StxStream<A, E> {
  value: Atom<Result<A, E>>           // For React via useAtomValue
  buffer: Atom<readonly A[]>          // Accumulated values
  status: Atom<StreamStatus>          // 'idle' | 'streaming' | 'complete' | 'error'
  state$: Observable<StreamState>     // For direct reads outside React
  pause(): void                       // Interrupts consumer fiber
  resume(): void                      // Restarts consumer
  reset(): void                       // Clears buffer, restores initial
  dispose(): void                     // Stops consumer
}
```

Buffer strategies:
- **`'latest'`** (default): Only `value` atom updates, no buffer accumulation
- **`'all'`**: All received values accumulated in buffer
- **`{ size: N }`**: Ring buffer, keeps last N values

**Key design decision**: Legend-State observables (not effect-atom atoms) are used as the mutable core inside the fiber consumer. Effect fibers writing to Legend-State observables propagate correctly across execution contexts, whereas `Registry.set` inside a fiber does not propagate reads back to the outer context.

## React Hooks

| Hook | Purpose | Reactive Source |
|------|---------|-----------------|
| `useStxValue(stx, selector)` | Read observable field | Legend-State `useSelector` |
| `useStxData(stx)` | Read entire data tree | Legend-State `useSelector` |
| `useStxSend(stx)` | Get send function | Stable reference |
| `useStxMachine(stx)` | Machine state + send | XState `useActorSelector` |
| `useStxMatches(stx, state)` | Check machine state | XState `useActorSelector` |
| `useStxEffect(stx)` | Run named effect | Effect.runPromiseExit |
| `useStxComputed(stx, key)` | Read computed atom | effect-atom `useAtomValue` |
| `useStxStream(stream)` | Subscribe to stream | Legend-State `useSelector` |
| `useStx(stx)` | All-in-one (convenience) | All three |

### useStxStream Example

```tsx
function StreamView() {
  const { value, buffer, status, pause, resume, reset } = useStxStream(myStream)

  return (
    <div>
      <p>Status: {status}</p>
      <p>Current: {value}</p>
      <p>History: {buffer.join(', ')}</p>
      <button onClick={pause}>⏸</button>
      <button onClick={resume}>▶</button>
      <button onClick={reset}>⏹</button>
    </div>
  )
}
```

## Bindings: Cross-Library Bridges

| Binding | Direction | Purpose |
|---------|-----------|---------|
| `fromEffectStream(stream)` | Effect → RxJS | Convert Effect Stream to Observable (fiber-based) |
| `fromLegendState(obs$)` | Legend → RxJS | Legend-State → RxJS Observable |
| `bridgeToActor(obs$, actor)` | Legend → XState | Sync observable changes to machine events |
| `createTwoWayBridge(obs$, actor)` | Legend ↔ XState | Bidirectional sync with loop prevention |

## Testing

| Suite | Tests | Coverage |
|-------|-------|----------|
| `stx.test.ts` | 67 | Core, computed, snapshot, layer, persistence |
| `bindings.test.ts` | 31 | Effect streams, Legend-State, XState bridges |
| `hooks.test.ts` | 41/55 | React hooks (14 blocked by Legend-State test env) |
| `stream.test.ts` | 11 | Progressive state, buffers, pause/resume/reset |

### Testing Computed Atoms

effect-atom atoms can't track Legend-State observables (different reactive systems). In tests:
- Use `Registry.get(computedAtom)` for first-computation value
- Use factory re-evaluation for current values (snapshot does this)
- React hooks (`useAtomValue`) work via re-render triggers

### Testing Streams

Stream tests use `state$.get()` (Legend-State direct read) instead of Registry, because Effect fibers writing to atoms via Registry don't propagate back to outer-context reads.

## Key Design Decisions

### 1. Atom-as-State Pattern

When React is the consumer via effect-atom, use `Atom.make()` as the primary state — not `Effect.Ref` inside services. Service methods mutate Atoms directly (`Atom.set`), React subscribes directly. This eliminates the Ref→Atom bridge.

### 2. Object.defineProperty for Live References

XState actor and send are exposed via property getters to prevent stale references after `reset()`:

```typescript
Object.defineProperty(instance, 'actor', { get: () => actor, enumerable: true })
Object.defineProperty(instance, 'send', { get: () => (e) => actor?.send(e), enumerable: true })
```

### 3. Legend-State Inside Effect Fibers

Legend-State observables work inside Effect fibers (`.set()` propagates correctly). effect-atom `Registry.set` inside fibers does NOT propagate to outer-context reads. Always use Legend-State for mutable state that Effect fibers write to.

### 4. getPersistedSnapshot for Reset

XState v5's `actor.getPersistedSnapshot()` captures full serializable state (value + context). Used at initialization, then passed back via `createActor(machine, { snapshot })` during reset.

### 5. Computed Re-evaluation at Snapshot Time

Snapshot doesn't read from atom cache (which may be stale in non-React contexts). Instead, it re-invokes each computed factory function with a fresh getter, ensuring values always reflect current data.
