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
│   │ • Guards        │   │ • No re-renders │   │ • Effect.gen    │          │
│   │ • Actions       │   │ • Persistence   │   │ • Services      │          │
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
| **XState** | Shape/Logic | Defines valid states, transitions, guards, actions. The "what can happen" and "when". Actors handle IR parsing, rendering decisions. |
| **Legend-State** | Hydration/Data | Stores actual data with proxy-based fine-grained reactivity. The "where data lives". No re-renders on unrelated changes. |
| **effect-atom** | Effect Bridge | Bridges Effect-TS computations into React. Handles async with `Result<A,E>`, service-scoped state, and Effect.gen programs. |

## The `stx({})` API Design

### Basic Shape

```typescript
import { stx } from '@/lib/atoms'

const counter = stx({
  // XState machine definition (shape/logic)
  machine: {
    initial: 'idle',
    states: {
      idle: { on: { INCREMENT: 'counting' } },
      counting: { on: { RESET: 'idle' } },
    },
  },

  // Legend-State observable (hydration/data)
  data: {
    count: 0,
    lastUpdated: null as Date | null,
  },

  // effect-atom effects (async bridge)
  effects: {
    fetchInitial: Effect.gen(function* () {
      const response = yield* HttpClient.get('/api/count')
      return response.json()
    }),
    persist: (data) => Effect.gen(function* () {
      yield* HttpClient.post('/api/count', { body: data })
    }),
  },

  // Computed derivations
  computed: {
    doubled: (get) => get.data.count * 2,
    isActive: (get) => get.machine.matches('counting'),
  },
})
```

### React Usage

```typescript
import { useStxValue, useStxSend, useStxActor } from '@/lib/atoms'

function Counter() {
  // Fine-grained data access (Legend-State)
  const count = useStxValue(counter, s => s.data.count)

  // Machine state (XState)
  const isIdle = useStxValue(counter, s => s.machine.matches('idle'))

  // Computed values
  const doubled = useStxValue(counter, s => s.computed.doubled)

  // Send events (XState)
  const send = useStxSend(counter)

  // Run effects (effect-atom)
  const runEffect = useStxEffect(counter)

  return (
    <div>
      <Memo>{() => counter.data.count.get()}</Memo>
      <button onClick={() => send('INCREMENT')}>+1</button>
      <button onClick={() => runEffect('fetchInitial')}>Refresh</button>
    </div>
  )
}
```

## AVA-Specific Architecture

For the AVA client, the machine handles IR parsing and rendering decisions:

```typescript
const avaView = stx({
  machine: {
    id: 'avaView',
    initial: 'disconnected',
    states: {
      disconnected: {
        on: { CONNECT: 'connecting' },
      },
      connecting: {
        invoke: {
          src: 'connectSession',
          onDone: 'connected',
          onError: 'error',
        },
      },
      connected: {
        initial: 'idle',
        states: {
          idle: {
            on: { SUBSCRIBE: 'subscribing' },
          },
          subscribing: {
            invoke: {
              src: 'subscribeToView',
              onDone: 'streaming',
              onError: 'error',
            },
          },
          streaming: {
            on: {
              ARTIFACT: { actions: 'hydrateArtifact' },
              DELTA: { actions: 'applyDelta' },
              UNSUBSCRIBE: 'idle',
            },
          },
        },
        on: { DISCONNECT: 'disconnected' },
      },
      error: {
        on: { RETRY: 'connecting', RESET: 'disconnected' },
      },
    },
  },

  // Fast, fine-grained data store
  data: {
    views: [] as ViewSummary[],
    selectedView: null as ViewSpec | null,
    artifact: null as ViewArtifact | null,
    messageLog: [] as MessageLogEntry[],
    config: {
      baseUrl: 'http://localhost:3000',
    },
  },

  // Effect-TS operations
  effects: {
    connectSession: Effect.gen(function* () {
      const client = yield* AvaSessionClient
      yield* client.waitForConnection
      return { status: 'connected' }
    }),
    fetchViews: Effect.gen(function* () {
      const client = yield* AvaHttpClient
      return yield* client.listViews()
    }),
    subscribeToView: (viewId: string) => Effect.gen(function* () {
      const client = yield* AvaSessionClient
      yield* client.subscribe(viewId)
    }),
  },

  // Derived state
  computed: {
    isConnected: (get) => get.machine.matches('connected'),
    viewCount: (get) => get.data.views.length,
    hasArtifact: (get) => get.data.artifact !== null,
  },
})
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. USER ACTION                                                         │
│     │                                                                   │
│     ▼                                                                   │
│  ┌──────────────┐                                                       │
│  │  XState      │  send('CONNECT')                                      │
│  │  Machine     │──────────────────┐                                    │
│  └──────────────┘                  │                                    │
│                                    ▼                                    │
│  2. MACHINE INVOKES EFFECT    ┌──────────────┐                         │
│                               │  effect-atom │                         │
│                               │  Effect.gen  │                         │
│                               └──────┬───────┘                         │
│                                      │                                  │
│                                      ▼                                  │
│  3. EFFECT RESOLVES           ┌──────────────┐                         │
│     Result<A, E>              │   HTTP/WS    │                         │
│                               │   Response   │                         │
│                               └──────┬───────┘                         │
│                                      │                                  │
│                                      ▼                                  │
│  4. MACHINE ACTION            ┌──────────────┐                         │
│     hydrateArtifact           │   XState     │                         │
│                               │   Action     │                         │
│                               └──────┬───────┘                         │
│                                      │                                  │
│                                      ▼                                  │
│  5. UPDATE OBSERVABLE         ┌──────────────┐                         │
│     data.artifact.set(...)    │ Legend-State │                         │
│                               │  .set()      │                         │
│                               └──────┬───────┘                         │
│                                      │                                  │
│                                      ▼                                  │
│  6. FINE-GRAINED RE-RENDER    ┌──────────────┐                         │
│     Only affected <Memo>      │    React     │                         │
│     components update         │  Components  │                         │
│                               └──────────────┘                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Implementation Layers

### Layer 1: Core Primitives (`primitives.ts`)

```typescript
// Re-exports with TMNL defaults
export { observable, computed, observe, batch } from '@legendapp/state'
export { observer, useObservable, Memo, Computed } from '@legendapp/state/react'
export { Atom, Result } from '@effect-atom/atom'
export { useAtomValue, useAtom } from '@effect-atom/atom-react'
export { createMachine, setup } from 'xstate'
export { useActor, useSelector, createActorContext } from '@xstate/react'
```

### Layer 2: Composition (`state.ts`)

```typescript
// The unified stx({}) factory
export function state<
  TMachine extends AnyStateMachine,
  TData extends object,
  TEffects extends Record<string, Effect.Effect<any, any>>,
  TComputed extends Record<string, (get: StxGetter<TData, TMachine>) => any>
>(config: StxConfig<TMachine, TData, TEffects, TComputed>): Stx<...>
```

### Layer 3: React Bindings (`hooks.ts`)

```typescript
// Hooks that compose all three
export function useStxValue<S, T>(state: S, selector: (s: S) => T): T
export function useStxSend<S>(state: S): (event: EventOf<S>) => void
export function useStxEffect<S>(state: S): (name: keyof EffectsOf<S>) => Promise<void>
export function useStxMachine<S>(state: S): [SnapshotOf<S>, SendOf<S>]
```

### Layer 4: Utilities (`utils.ts`)

```typescript
// Schema validation for data
export function withSchema<T>(schema: Schema.Schema<T>): DataValidator<T>

// Match-based reducers
export function reducer<S, E>(match: Match.Match<E, S>): Reducer<S, E>

// Stream atoms for progressive updates
export function streamAtom<A, E>(stream: Stream.Stream<A, E>): Atom<Result<A, E>>

// Persistence adapter
export function withPersistence<T>(config: PersistConfig): Observable<T>
```

## File Structure

```
src/lib/atoms/
├── index.ts                 # Public exports
├── ARCHITECTURE.md          # This document
├── types.ts                 # TypeScript types for unified API
├── primitives.ts            # Re-exports from all three libraries
├── state.ts                 # The stx({}) factory
├── hooks.ts                 # React hooks (useStxValue, etc.)
├── utils/
│   ├── schema.ts            # Schema validation utilities
│   ├── reducers.ts          # Match-based reducers
│   ├── streams.ts           # Stream atom utilities
│   ├── persistence.ts       # Persistence adapters
│   └── result.ts            # Result type helpers
└── providers/
    ├── StateProvider.tsx    # Combined provider
    └── context.ts           # React contexts
```

## Key Design Decisions

### 1. Machine as Shape, Observable as Store

The XState machine defines *what states are valid* and *what transitions are allowed*. The Legend-State observable *stores the actual data*. This separation means:
- Machine logic is testable in isolation
- Data updates are fine-grained (no full tree re-renders)
- Effect computations are properly typed and traceable

### 2. Effect Bridge via Actors

XState actors invoke effect-atom Effects. This gives us:
- Fiber-based cancellation
- Proper error handling via `Result<A, E>`
- Service injection via `Atom.runtime()`
- Observability via Effect spans

### 3. Fine-Grained Reactivity Default

Legend-State's proxy-based observables are the default for all data. This means:
- Components only re-render when their specific data changes
- `<Memo>` components update text without parent re-renders
- Batch updates are automatic within a frame

### 4. Schema-Validated Data

All data flowing through `stx({})` can optionally be Schema-validated:
- Runtime validation before state updates
- Automatic TypeScript type inference
- JSON Schema generation for debugging

## Migration Path

### From useState

```typescript
// Before
const [count, setCount] = useState(0)
const [loading, setLoading] = useState(false)

// After
const counter = stx({
  machine: { initial: 'idle', states: { idle: {}, loading: {} } },
  data: { count: 0 },
})
const count = useStxValue(counter, s => s.data.count)
```

### From effect-atom Only

```typescript
// Before
const countAtom = Atom.make(0)
const doubled = Atom.make((get) => get(countAtom) * 2)

// After
const counter = stx({
  data: { count: 0 },
  computed: { doubled: (get) => get.data.count * 2 },
})
```

### From XState Only

```typescript
// Before
const [state, send] = useMachine(toggleMachine)

// After
const toggle = stx({
  machine: toggleMachine,
  data: {},  // Legend-State for any extra data
})
const [machineState, send] = useStxMachine(toggle)
```

## Next Steps

1. Install dependencies: `@legendapp/state`, `xstate`, `@xstate/react`
2. Implement `primitives.ts` with re-exports
3. Implement `state.ts` factory
4. Implement React hooks
5. Build AVA testbed with new patterns
6. Document patterns in CLAUDE.md
