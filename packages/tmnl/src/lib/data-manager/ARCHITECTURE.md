# TMNL DataManager Architecture

## Overview

DataManager is a top-level orchestration service for data operations in TMNL. It provides:

- **Hybrid Dispatch**: Effect fibers (default) + Web Workers (opt-in for CPU-heavy tasks)
- **Kernel Pooling**: Typed worker units (`search`, `index`, `transform`, `persist`)
- **Service-Scoped Atoms**: Reactive state tied to service lifecycle
- **Suspense Integration**: Effect-atom Result types for React Suspense
- **Tracing Strategy**: `Effect.fn` (traced) vs `Effect.fnUntraced` (hot path)

## Version Policy

```
v1/ - Experimental (API may change)
v2/ - Stable (when battle-tested)
```

Breaking changes documented in CHANGELOG.md. Deprecation warnings before removal.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           React Components                                   │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐       │
│  │ useDataManager   │◄───┤  useSearchAtoms  │    │   useSuspense    │       │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘       │
└───────────┼────────────────────────┼────────────────────────┼────────────────┘
            │                        │                        │
            ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       effect-atom (Reactive Layer)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ resultsAtom  │  │  statusAtom  │  │   statsAtom  │  │ driversAtom  │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
└─────────┼──────────────────┼──────────────────┼──────────────────┼──────────┘
          │                  │                  │                  │
          ▼                  ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DataManager Service (Effect Runtime)                      │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Effect.Ref<State>                              │  │
│  │   { kernels, tasksQueued, tasksCompleted, drivers, isIndexing }       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                            Dispatch Layer                               │ │
│  │                                                                         │ │
│  │   dispatch()        →  Effect fiber (traced, withSpan)                 │ │
│  │   dispatchHot()     →  Effect fiber (untraced, hot path)               │ │
│  │   dispatchInWorker()→  Web Worker (CPU-heavy, traced)                  │ │
│  │                                                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Kernel Pool                                     │
│                                                                              │
│   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐                │
│   │ SearchKernel  │   │  IndexKernel  │   │TransformKernel│                │
│   │               │   │               │   │               │                │
│   │ FlexSearch    │   │ Batch index   │   │ Schema xform  │                │
│   │ Linear search │   │ Worker pool   │   │ Pipelines     │                │
│   └───────────────┘   └───────────────┘   └───────────────┘                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Kernel System

Kernels are typed worker units with three execution modes:

```typescript
interface Kernel<T, P> {
  readonly type: KernelType  // "search" | "index" | "transform" | "persist"

  // Traced execution (adds Effect span)
  readonly execute: (task: Task<T, P>) => Effect<KernelResult<T>>

  // Hot path (no tracing overhead)
  readonly executeHot: (task: Task<T, P>) => Effect<KernelResult<T>>

  // Web Worker (CPU-heavy operations)
  readonly executeInWorker: (task: Task<T, P>) => Effect<KernelResult<T>>
}
```

**When to use each:**

| Method | Use Case | Overhead |
|--------|----------|----------|
| `execute` | Service methods, lifecycle ops, error paths | + span creation |
| `executeHot` | Search execution, stream processing | minimal |
| `executeInWorker` | Indexing 36K movies, batch transforms | + serialization |

### 2. Service-Scoped Atoms

Atoms owned by DataManager with lifecycle tied to service:

```typescript
interface DataManagerAtoms<T> {
  readonly results: Atom<readonly SearchResult<T>[]>   // Progressive results
  readonly status: Atom<StreamStatus>                  // idle | streaming | complete
  readonly stats: Atom<StreamStats>                    // chunks, items, ms
  readonly drivers: Atom<DriverState<T>>               // flex/linear instances
  readonly isIndexing: Atom<boolean>                   // Index in progress
  readonly query: Atom<string>                         // Current query
  readonly searchResult: Atom<Result<SearchResult[], Error>> // Suspense-enabled
}
```

**Benefits:**
- Created on service init, disposed on teardown
- Access via `DataManager.atoms.results`
- Testable: mock DataManager → mock atoms
- No global state pollution

### 3. Hybrid Dispatch Strategy

**Default: Effect Fibers**
- Simpler mental model
- No serialization overhead
- Cooperative scheduling via Effect runtime

**Opt-in: Web Workers**
- For CPU-heavy operations (indexing large datasets)
- Pattern: `kernel.executeInWorker()`
- Requires serializable payloads

```typescript
// Fiber execution (default)
yield* dm.dispatch("search", task)

// Worker execution (opt-in)
yield* dm.dispatchInWorker("index", {
  id: "index-movies",
  type: "index",
  payload: { items: movies, fields: ["title", "cast"] },
  priority: "normal",
})
```

### 4. Stream-First Search

Search returns `Stream.Stream<SearchResult<T>>` for:
- Progressive UI updates
- Backpressure handling
- Cancellation via fiber interruption
- Chunked emission for large result sets

```typescript
const search = (query: SearchQuery): Stream<SearchResult<T>> =>
  Stream.unwrap(
    Effect.gen(function*() {
      const driver = yield* getActiveDriver()
      return driver.search(query).pipe(
        Stream.tap((result) => updateAtoms(result)),
        Stream.onDone(() => setStatus("complete"))
      )
    })
  )
```

---

## File Structure

```
src/lib/data-manager/
├── v1/
│   ├── index.ts                    # Public exports
│   ├── types.ts                    # Core interfaces
│   ├── DataManager.ts              # Top-level service
│   ├── kernels/
│   │   ├── index.ts                # Kernel exports
│   │   ├── SearchKernel.ts         # FlexSearch/Linear wrapper
│   │   ├── IndexKernel.ts          # Indexing operations
│   │   └── types.ts                # Kernel-specific types
│   ├── atoms/
│   │   ├── index.ts                # Runtime atom + derived atoms
│   │   ├── search.ts               # Search-specific atoms
│   │   └── operations.ts           # Operation atoms (mutations)
│   └── hooks/
│       ├── useDataManager.ts       # Main hook
│       ├── useSearchAtoms.ts       # Search state hooks
│       └── useSuspense.ts          # Suspense integration
├── ARCHITECTURE.md                 # This document
└── CHANGELOG.md                    # Version history
```

---

## Migration from useState

### Before (SearchTestbed.tsx)

```typescript
const [results, setResults] = useState<SearchResult<MovieItem>[]>([])
const [stats, setStats] = useState<StreamStats>({ chunks: 0, items: 0, ms: 0 })
const [status, setStatus] = useState<StreamStatus>('idle')
const [isIndexing, setIsIndexing] = useState(false)
// ... 13 total useState calls
```

### After (effect-atom)

```typescript
import { useAtomValue } from "@effect-atom/atom-react"
import { DataManager } from "@/lib/data-manager/v1"

function SearchTestbed() {
  const dm = useDataManager()

  // Derived from service-scoped atoms
  const results = useAtomValue(dm.atoms.results)
  const status = useAtomValue(dm.atoms.status)
  const stats = useAtomValue(dm.atoms.stats)
  const isIndexing = useAtomValue(dm.atoms.isIndexing)

  // With Suspense
  const searchResult = useAtomSuspense(dm.atoms.searchResult)
}
```

---

## Effect Patterns

### Effect.Service<>() Pattern

```typescript
export class DataManager<T> extends Effect.Service<DataManager<T>>()(
  "tmnl/data-manager/DataManager",
  {
    effect: Effect.gen(function*() {
      // Create internal state
      const stateRef = yield* Ref.make<State>(initialState)

      // Define operations
      const dispatch = (task) => Effect.gen(function*() { ... })

      // Return interface
      return { dispatch, ... }
    }),
  }
) {}
```

### Atom.runtime Pattern

```typescript
export const dataManagerRuntimeAtom = Atom.runtime(
  Layer.mergeAll(
    DataManager.Default,
    SearchKernel.Default,
    IndexKernel.Default
  )
)

// Derived atoms
export const resultsAtom = dataManagerRuntimeAtom.atom(
  Effect.gen(function*() {
    const dm = yield* DataManager
    return Atom.get(dm.atoms.results)
  })
)

// Operation atoms
export const searchOpsAtom = {
  search: dataManagerRuntimeAtom.fn<SearchQuery>()((query) =>
    Effect.gen(function*() {
      const dm = yield* DataManager
      return yield* Stream.runCollect(dm.search(query))
    })
  ),
}
```

---

## Testing Strategy

### Unit: Effect Services

```typescript
import { describe, it } from "@effect/vitest"

describe("DataManager", () => {
  it.effect("dispatches to correct kernel", () =>
    Effect.gen(function*() {
      const dm = yield* DataManager

      // Register mock kernel
      yield* dm.registerKernel(mockSearchKernel)

      const result = yield* dm.dispatch("search", task)
      expect(result.executionMode).toBe("fiber")
    }).pipe(Effect.provide(DataManager.Default))
  )
})
```

### Integration: Atoms

```typescript
import { Registry } from "@effect-atom/atom"

it("atoms update on search", async () => {
  const registry = Registry.make()

  // Run search
  await registry.run(searchOpsAtom.search({ query: "matrix" }))

  // Check atoms updated
  const results = registry.get(resultsAtom)
  expect(results.length).toBeGreaterThan(0)
})
```

---

## Future Considerations

1. **Worker Pool Sizing**: Currently hardcoded. Add dynamic sizing based on navigator.hardwareConcurrency.

2. **Persistent Index**: Cache FlexSearch index in IndexedDB for cold start optimization.

3. **Kernel Hot Reload**: Live swap kernel implementations without service restart.

4. **OTel Integration**: Wire Effect spans to OpenTelemetry for production observability.

5. **Multi-Tenant**: Scope DataManager instances per-tenant for SaaS use cases.

---

## References

- [Effect Documentation](https://effect.website)
- [effect-atom Documentation](https://github.com/tim-smart/effect-atom)
- [FlexSearch Documentation](https://github.com/nextapps-de/flexsearch)
- [EPOCH-0001: Search Framework](../.edin/epochs/EPOCH-0001.md)
