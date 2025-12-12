# Effect Service Patterns — The Complete Landscape

**Research Date**: 2025-12-08
**Sources**: Effect-TS/effect official documentation, TMNL codebase analysis
**Status**: Canonical reference for Effect.Service architecture patterns

---

## Table of Contents

1. [Service Definition Approaches](#service-definition-approaches)
2. [Layer Construction Patterns](#layer-construction-patterns)
3. [State Management in Services](#state-management-in-services)
4. [Service Composition](#service-composition)
5. [Integration with effect-atom](#integration-with-effect-atom)
6. [Testing Patterns](#testing-patterns)
7. [Migration Patterns](#migration-patterns)

---

## Service Definition Approaches

Effect-TS provides **three primary patterns** for defining services. Each serves a distinct use case.

### 1. Context.Tag (Stateless Interface)

**Use when**: You need a stateless service contract with manual implementation.

**Pattern**:
```typescript
import { Context, Effect, Layer } from 'effect'

// Interface definition
export interface SliderBehaviorShape {
  readonly id: string
  readonly normalize: (value: number, min: number, max: number) => number
  readonly denormalize: (normalized: number, min: number, max: number) => number
}

// Tag definition
export class SliderBehavior extends Context.Tag('tmnl/slider/SliderBehavior')<
  SliderBehavior,
  SliderBehaviorShape
>() {}

// Implementation
const linearBehavior: SliderBehaviorShape = {
  id: 'linear',
  normalize(value, min, max) {
    return (value - min) / (max - min)
  },
  denormalize(normalized, min, max) {
    return min + normalized * (max - min)
  },
}

// Layer
export const LinearBehavior = {
  Default: Layer.succeed(SliderBehavior, linearBehavior),
  shape: linearBehavior,
}
```

**Characteristics**:
- Manually define interface
- Manually implement all methods
- Use `Layer.succeed()` to provide implementation
- Best for **strategy/behavior patterns** (swappable algorithms)
- No automatic Effect wrapping

**Examples in TMNL**:
- `SliderBehavior` — Swappable value transformation behaviors (linear, logarithmic, decibel)
- `IdGenerator` (legacy v1) — Configurable ID generation strategies

---

### 2. Effect.Service<>() (Stateful Service with Auto-Implementation)

**Use when**: You need a service with internal state and lifecycle management.

**Pattern**:
```typescript
import { Effect, Ref } from 'effect'

export class DataManager<T = unknown> extends Effect.Service<DataManager<T>>()('tmnl/data-manager/DataManager', {
  effect: Effect.gen(function* () {
    // Internal state (Effect.Ref)
    const stateRef = yield* Ref.make<DataManagerState<T>>(initialState<T>())
    const resultsRef = yield* Ref.make<readonly SearchResult<T>[]>([])
    const statusRef = yield* Ref.make<StreamStatus>('idle')

    // Service methods
    const registerKernel = (kernel: Kernel<unknown, unknown>): Effect.Effect<void> =>
      Ref.update(stateRef, (state) => ({
        ...state,
        kernels: new Map(state.kernels).set(kernel.type, kernel),
      }))

    const getKernel = (type: KernelType): Effect.Effect<Kernel<unknown, unknown> | undefined> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.kernels.get(type)
      })

    const dispatch = <R>(kernelType: KernelType, task: Task<R>): Effect.Effect<KernelResult<R>> =>
      Effect.gen(function* () {
        const kernel = yield* getKernel(kernelType)
        if (!kernel) {
          return yield* Effect.fail(new Error(`Kernel not found: ${kernelType}`))
        }
        const result = yield* kernel.execute(task)
        return result
      }).pipe(Effect.withSpan(`DataManager.dispatch.${kernelType}`))

    // Return service API
    return {
      registerKernel,
      getKernel,
      dispatch,
      // ... other methods
    } as const
  }),
}) {}
```

**Characteristics**:
- `Effect.Service<T>()` provides automatic `.Default` Layer
- Service implementation is an `Effect.gen` function
- Internal state via `Effect.Ref`, `PubSub`, etc.
- All methods return `Effect.Effect<>`
- **Supports constructor parameters** (as of Effect 3.16):
  ```typescript
  export class ConfigurableService extends Effect.Service<ConfigurableService>()(
    'app/ConfigurableService',
    {
      effect: (config: ServiceConfig) => Effect.gen(function* () {
        // Use config to initialize
        return { /* API */ }
      }),
    }
  ) {}

  // .Default layer automatically includes constructor params
  const layer = ConfigurableService.Default
  ```
- Best for **orchestrators, registries, stateful managers**

**Examples in TMNL**:
- `DataManager<T>` — Top-level data orchestrator with kernel dispatch
- `KernelRegistry` — Manages namespaced kernel instances

---

### 3. Hybrid: Context.Tag + Manual makeService()

**Use when**: You need finer control over service construction but want Tag ergonomics.

**Pattern**:
```typescript
export interface ChannelServiceShape {
  readonly build: (spec: ChannelSpec) => Effect.Effect<Channel>
  readonly send: (id: ChannelId, data: unknown) => Effect.Effect<void>
  readonly receive: (id: ChannelId) => Stream.Stream<unknown>
}

export class ChannelService extends Context.Tag('tmnl/streams/ChannelService')<
  ChannelService,
  ChannelServiceShape
>() {}

// Manual service factory
const makeChannelService = Effect.gen(function* () {
  const registry = yield* Ref.make<HashMap.HashMap<ChannelId, ChannelInstance>>(HashMap.empty())
  const commandPubSub = yield* PubSub.unbounded<ChannelCommand>()
  const eventPubSub = yield* PubSub.unbounded<ChannelEvent>()

  // ... implementation

  return {
    build,
    send,
    receive,
  } satisfies ChannelServiceShape
})

// Layer
export const ChannelServiceLive = Layer.effect(ChannelService, makeChannelService)
```

**Characteristics**:
- Define interface with `Context.Tag`
- Manually write `makeService()` Effect
- Use `Layer.effect()` to construct Layer
- Best for **complex initialization** requiring multiple steps
- Explicit about dependencies (can yield* other services)

**Examples in TMNL**:
- `ChannelService` — Complex stream channel orchestration
- `RecontextService` — Context file loading with file system access
- `OverlayRegistry` (legacy v1) — Before Atom-as-State migration

---

## Layer Construction Patterns

Layers are the **dependency injection mechanism** in Effect. They describe how to provide a service.

### Layer.succeed (Immediate Value)

**Use when**: Service has no dependencies and can be constructed synchronously.

```typescript
const linearBehavior: SliderBehaviorShape = { /* ... */ }

export const LinearBehavior = {
  Default: Layer.succeed(SliderBehavior, linearBehavior),
  shape: linearBehavior,
}
```

**Characteristics**:
- Synchronous construction
- Value is ready immediately
- No cleanup needed
- Perfect for **pure strategies, configurations**

---

### Layer.effect (Effectful Construction)

**Use when**: Service construction requires Effects (e.g., creating Refs, acquiring resources).

```typescript
const makeChannelService = Effect.gen(function* () {
  const registry = yield* Ref.make<HashMap.HashMap<ChannelId, ChannelInstance>>(HashMap.empty())
  const pubsub = yield* PubSub.unbounded<ChannelCommand>()

  return { build, send, receive }
})

export const ChannelServiceLive = Layer.effect(ChannelService, makeChannelService)
```

**Characteristics**:
- Asynchronous construction
- Can use Effect operations (Ref, PubSub, etc.)
- No automatic cleanup (use `Layer.scoped` for that)
- Perfect for **stateful services with initialization**

---

### Layer.scoped (Managed Resources)

**Use when**: Service needs cleanup (file handles, connections, subscriptions).

```typescript
const makeResourceManager = Effect.gen(function* () {
  // Acquire resource
  const connection = yield* acquireConnection()

  // Register cleanup
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => connection.close())
  )

  return { query, execute }
})

export const ResourceManagerLive = Layer.scoped(ResourceManager, makeResourceManager)
```

**Characteristics**:
- Automatic cleanup on Layer disposal
- Use `Effect.addFinalizer` for cleanup logic
- Cleanup runs in reverse order of acquisition
- Perfect for **databases, file handles, subscriptions**

**Example Use Case** (not yet in TMNL, but recommended):
```typescript
// WebSocket service with auto-cleanup
const makeWebSocketService = Effect.gen(function* () {
  const ws = yield* Effect.sync(() => new WebSocket('ws://...'))

  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    })
  )

  return { send, receive }
})

export const WebSocketServiceLive = Layer.scoped(WebSocketService, makeWebSocketService)
```

---

### Layer.mergeAll (Composition)

**Use when**: Multiple services need to be provided together.

```typescript
export const OverlayServicesLive = Layer.mergeAll(
  PortHubLive,
  EventDispatcherLive,
  OverlayRegistryLive
)
```

**Characteristics**:
- Combines multiple Layers into one
- Services can depend on each other
- Order matters if there are dependencies
- Memoized by default — each Layer instantiated only once

---

### Layer.provide (Dependency Injection)

**Use when**: A service depends on other services.

```typescript
// Service B depends on Service A
const makeServiceB = Effect.gen(function* () {
  const serviceA = yield* ServiceA  // Acquire dependency

  return {
    doSomething: () => serviceA.method()
  }
})

const ServiceBLive = Layer.effect(ServiceB, makeServiceB)

// Provide dependency
const AppLayer = ServiceBLive.pipe(Layer.provide(ServiceALive))
```

**Characteristics**:
- Automatically injects required services
- Type-safe — compiler ensures all dependencies provided
- Lazy — services only constructed when needed

---

## State Management in Services

### Pattern 1: Effect.Ref (Service-Internal State)

**Use when**: State is **internal to the service** and not directly consumed by React.

```typescript
export class DataManager<T> extends Effect.Service<DataManager<T>>()('...', {
  effect: Effect.gen(function* () {
    // Internal state — NOT directly exposed
    const stateRef = yield* Ref.make<DataManagerState<T>>(initialState<T>())
    const resultsRef = yield* Ref.make<readonly SearchResult<T>[]>([])

    // Operations mutate Refs
    const addResult = (result: SearchResult<T>) =>
      Ref.update(resultsRef, (results) => [...results, result])

    // Expose read-only getters
    const getResults = () => Ref.get(resultsRef)

    return { addResult, getResults }
  }),
}) {}
```

**Characteristics**:
- State lives in Effect runtime
- **Opaque to React** — requires polling or bridging to expose
- Use for: internal counters, queues, caches
- **Anti-pattern**: Using Effect.Ref for React-facing state (see Atom-as-State)

---

### Pattern 2: Atom-as-State (React-Facing State)

**Use when**: State needs to be **reactive in React** (renders on change).

**CRITICAL DOCTRINE (from CLAUDE.md)**:
> Atom-as-State Pattern: When React is the consumer via effect-atom, use `Atom.make()` as the primary state—NOT Effect.Ref inside services. Service methods mutate Atoms directly (`Atom.set`), React subscribes directly. This eliminates the Ref→Atom bridge: no polling, no SubscriptionRef, no streams-to-consume-streams.

```typescript
import { Atom } from '@effect-atom/atom'

// Atoms are the canonical state (NOT Effect.Ref)
export const resultsAtom = Atom.make<readonly SearchResult[]>([])
export const statusAtom = Atom.make<StreamStatus>('idle')

// Service operations mutate atoms DIRECTLY
export const searchActions = {
  addResult: (result: SearchResult) => {
    const current = Atom.get(resultsAtom)
    Atom.set(resultsAtom, [...current, result])
  },

  setStatus: (status: StreamStatus) => {
    Atom.set(statusAtom, status)
  },
}

// React hook (automatic re-render on atom change)
export const useSearchResults = () => {
  return useAtomValue(resultsAtom)
}
```

**Characteristics**:
- Atoms are **first-class state** (not a bridge)
- No Effect.Ref → Atom synchronization
- React components subscribe with `useAtomValue()`
- Service methods call `Atom.set()` directly
- **Pattern validated in**: `DataManagerTestbed.tsx` (EPOCH-0002)

---

### Pattern 3: Hybrid (Service Ref + Atom Sync)

**Use when**: **Migrating from Effect.Ref to Atom-as-State** or service must maintain internal Ref.

**WARNING**: This is a **transitional pattern**. Prefer pure Atom-as-State for new code.

```typescript
export class LayerManager extends Effect.Service<LayerManager>()('...', {
  effect: Effect.gen(function* () {
    // Internal Ref (legacy)
    const layersRef = yield* Ref.make<ReadonlyArray<LayerInstance>>([])

    // Methods that mutate Ref
    const addLayer = (layer: LayerInstance) =>
      Ref.update(layersRef, (layers) => [...layers, layer])

    return { addLayer, getAllLayers: () => Ref.get(layersRef) }
  }),
}) {}

// Atom that reads from service (polling required)
export const layersAtom = layerRuntimeAtom.atom(
  Effect.gen(function* () {
    const manager = yield* LayerManager
    return yield* manager.getAllLayers()
  })
)
```

**Characteristics**:
- Service owns state in Effect.Ref
- Atoms poll service for updates
- **NOT reactive by default** — requires manual subscription
- **Migration path**: Replace Effect.Ref with Atom.make() over time

---

## Service Composition

### Runtime Atoms (effect-atom Integration)

**Pattern**: Combine service Layers into an `Atom.runtime()` for Effect operations in React.

```typescript
import { Atom } from '@effect-atom/atom'
import { Layer } from 'effect'

// Combine service layers
const AppServicesLive = Layer.mergeAll(
  SearchKernelLive,
  DataManagerLive,
  ChannelServiceLive
)

// Create runtime atom
export const appRuntimeAtom = Atom.runtime(AppServicesLive)

// Define operation atoms
export const searchOps = {
  doSearch: appRuntimeAtom.fn(
    (query: string) => Effect.gen(function* () {
      const dm = yield* DataManager
      return yield* dm.dispatch('search', { type: 'search', query })
    })
  ),
}

// React usage
const SearchButton = () => {
  const doSearch = useAtomCallback(searchOps.doSearch)

  return <button onClick={() => doSearch('matrix')}>Search</button>
}
```

**Characteristics**:
- `Atom.runtime(Layer)` creates an Effect runtime scoped to atoms
- `.fn()` wraps Effects as async functions callable from React
- Services automatically provided to Effects
- Perfect for **bridging Effect services into React**

---

### Service Dependencies (yield* Pattern)

**Pattern**: Services acquire dependencies by `yield*` on the tag.

```typescript
const makeServiceB = Effect.gen(function* () {
  // Acquire ServiceA dependency
  const serviceA = yield* ServiceA

  const doWork = () =>
    Effect.gen(function* () {
      const result = yield* serviceA.someMethod()
      return result.toUpperCase()
    })

  return { doWork }
})

export const ServiceBLive = Layer.effect(ServiceB, makeServiceB)

// Provide dependencies
const AppLayer = ServiceBLive.pipe(Layer.provide(ServiceALive))
```

**Characteristics**:
- Type-safe dependency resolution
- Compiler enforces all dependencies provided
- Services lazily constructed (only when needed)

---

## Integration with effect-atom

### Pattern 1: Service Operations via runtimeAtom.fn()

**Use when**: React needs to call Effect-based service operations.

```typescript
// Define runtime
export const dataManagerRuntimeAtom = Atom.runtime(SearchKernel.Default)

// Define operation atoms
export const searchOps = {
  index: dataManagerRuntimeAtom.fn(
    <T>(items: readonly T[], fields: string[]) =>
      Effect.gen(function* () {
        const kernel = yield* SearchKernel
        return yield* kernel.index(items, fields)
      })
  ),

  search: dataManagerRuntimeAtom.fn(
    (query: string) =>
      Effect.gen(function* () {
        const kernel = yield* SearchKernel
        return yield* kernel.search(query)
      })
  ),
}

// React usage
const MyComponent = () => {
  const doIndex = useAtomCallback(searchOps.index)
  const doSearch = useAtomCallback(searchOps.search)

  const handleIndex = async () => {
    await doIndex(movies, ['title', 'cast'])
  }

  return <button onClick={handleIndex}>Index</button>
}
```

---

### Pattern 2: Reactive Queries via runtimeAtom.atom()

**Use when**: React needs reactive state derived from service operations.

```typescript
// Query atom (reactive)
export const currentResultsAtom = dataManagerRuntimeAtom.atom(
  Effect.gen(function* () {
    const dm = yield* DataManager
    return yield* dm.getResults()
  })
)

// React usage (auto re-renders on change)
const SearchResults = () => {
  const resultsResult = useAtomValue(currentResultsAtom)

  if (Result.isFailure(resultsResult)) {
    return <Error error={resultsResult.error} />
  }

  const results = resultsResult.value
  return <ResultsList items={results} />
}
```

---

### Pattern 3: Direct Atom Mutations (Preferred for React State)

**Use when**: State is purely for React consumption (no service logic).

```typescript
// Direct atoms (NO service)
export const resultsAtom = Atom.make<readonly SearchResult[]>([])
export const statusAtom = Atom.make<StreamStatus>('idle')

// Actions mutate atoms
export const searchActions = {
  addResult: (result: SearchResult) => {
    Atom.set(resultsAtom, [...Atom.get(resultsAtom), result])
  },

  setStatus: (status: StreamStatus) => {
    Atom.set(statusAtom, status)
  },
}

// React usage
const Results = () => {
  const results = useAtomValue(resultsAtom)
  return <div>{results.map(r => <Item key={r.id} {...r} />)}</div>
}
```

**Why this is preferred**:
- No Effect.Ref bridge
- No service boilerplate
- Direct reactivity (atoms ARE the state)
- Simpler mental model for React developers

---

## Testing Patterns

### Pattern 1: Unit Test Services with @effect/vitest

```typescript
import { describe, it, expect } from '@effect/vitest'
import { Effect, Layer } from 'effect'

describe('KernelRegistry Service', () => {
  const testLayer = KernelRegistry.Default

  it.effect('creates new search kernel for new namespace', () =>
    Effect.gen(function* () {
      const registry = yield* KernelRegistry
      const config = { instance: 'movies-test-1', driver: 'flex' }

      const kernel = yield* registry.getSearchKernel(config)

      expect(kernel).toBeDefined()
      expect(kernel.instance).toBe('movies-test-1')

      // Cleanup
      yield* registry.release(kernel.namespaceKey)
    }).pipe(Effect.provide(testLayer))
  )
})
```

**Characteristics**:
- `it.effect()` runs test inside Effect runtime
- `yield*` to acquire services
- `Effect.provide()` injects test layer
- Test returns `Effect.Effect<void>`

---

### Pattern 2: Test with Multiple Services

```typescript
it.effect('service B depends on service A', () =>
  Effect.gen(function* () {
    const serviceA = yield* ServiceA
    const serviceB = yield* ServiceB

    // Setup
    yield* serviceA.setValue(42)

    // Act
    const result = yield* serviceB.transform()

    // Assert
    expect(result).toBe('42!')
  }).pipe(
    Effect.provide(
      Layer.mergeAll(ServiceALive, ServiceBLive)
    )
  )
)
```

---

### Pattern 3: Test Atoms with Atom.get/Atom.set

```typescript
import { Atom } from '@effect-atom/atom'

it('atoms update correctly', () => {
  const resultsAtom = Atom.make<string[]>([])

  // Mutate
  Atom.set(resultsAtom, ['a', 'b'])

  // Read
  const results = Atom.get(resultsAtom)

  expect(results).toEqual(['a', 'b'])
})
```

---

## Migration Patterns

### From useState to Atom-as-State

**Before**:
```typescript
const [results, setResults] = useState<SearchResult[]>([])
const [status, setStatus] = useState<StreamStatus>('idle')

const handleSearch = async () => {
  setStatus('streaming')
  // ... search logic
  setResults(newResults)
}
```

**After**:
```typescript
// Define atoms
export const resultsAtom = Atom.make<readonly SearchResult[]>([])
export const statusAtom = Atom.make<StreamStatus>('idle')

// Actions
export const searchActions = {
  doSearch: async (query: string) => {
    Atom.set(statusAtom, 'streaming')
    // ... search logic
    Atom.set(resultsAtom, newResults)
  },
}

// Component
const SearchResults = () => {
  const results = useAtomValue(resultsAtom)
  const status = useAtomValue(statusAtom)

  return <ResultsList items={results} status={status} />
}
```

---

### From Effect.Ref to Atom-as-State

**Before (Effect.Ref in service)**:
```typescript
export class DataManager<T> extends Effect.Service<DataManager<T>>()('...', {
  effect: Effect.gen(function* () {
    const resultsRef = yield* Ref.make<readonly T[]>([])

    const getResults = () => Ref.get(resultsRef)

    return { getResults }
  }),
}) {}

// Atom polls service (NOT reactive)
const resultsAtom = runtimeAtom.atom(
  Effect.gen(function* () {
    const dm = yield* DataManager
    return yield* dm.getResults()
  })
)
```

**After (Atom-as-State)**:
```typescript
// Atom IS the state
export const resultsAtom = Atom.make<readonly T[]>([])

// Service methods mutate atom
export const dataManagerActions = {
  addResult: (result: T) => {
    Atom.set(resultsAtom, [...Atom.get(resultsAtom), result])
  },
}

// React (auto-reactive)
const Results = () => {
  const results = useAtomValue(resultsAtom)
  return <div>{results.map(...)}</div>
}
```

---

### From Context.Tag to Effect.Service<>()

**Before (manual implementation)**:
```typescript
export interface MyServiceOps {
  readonly doThing: () => Effect.Effect<void>
}

export class MyService extends Context.Tag('app/MyService')<MyService, MyServiceOps>() {}

const makeMyService = Effect.gen(function* () {
  const ref = yield* Ref.make(0)

  const doThing = () => Ref.update(ref, (n) => n + 1)

  return { doThing }
})

export const MyServiceLive = Layer.effect(MyService, makeMyService)
```

**After (Effect.Service<>())**:
```typescript
export class MyService extends Effect.Service<MyService>()('app/MyService', {
  effect: Effect.gen(function* () {
    const ref = yield* Ref.make(0)

    const doThing = () => Ref.update(ref, (n) => n + 1)

    return { doThing } as const
  }),
}) {}

// .Default layer auto-generated
const layer = MyService.Default
```

**Benefits**:
- Less boilerplate (no manual Layer.effect)
- `.Default` layer auto-generated
- Supports constructor parameters (Effect 3.16+)

---

## Decision Matrix

| Scenario | Pattern | Example |
|----------|---------|---------|
| **Swappable algorithm/strategy** | `Context.Tag` + `Layer.succeed` | `SliderBehavior` (linear, log, decibel) |
| **Stateful orchestrator** | `Effect.Service<>()` | `DataManager`, `KernelRegistry` |
| **Complex initialization** | `Context.Tag` + `Layer.effect` | `ChannelService`, `RecontextService` |
| **Resource with cleanup** | `Layer.scoped` | WebSocket, file handles, subscriptions |
| **React-facing state** | `Atom.make()` (NO service) | Search results, UI toggles, filters |
| **Effect operations from React** | `runtimeAtom.fn()` | Search, index, dispatch kernels |
| **Reactive queries** | `runtimeAtom.atom()` | Derived stats, filtered results |
| **Multiple services together** | `Layer.mergeAll` | `OverlayServicesLive` |
| **Service depends on service** | `yield*` in makeService | ServiceB depends on ServiceA |

---

## Anti-Patterns

### ❌ Using Effect.Ref for React-facing state

**Don't**:
```typescript
export class DataManager<T> extends Effect.Service<DataManager<T>>()('...', {
  effect: Effect.gen(function* () {
    const resultsRef = yield* Ref.make<T[]>([])  // ❌ React can't subscribe
    return { getResults: () => Ref.get(resultsRef) }
  }),
}) {}
```

**Do**:
```typescript
export const resultsAtom = Atom.make<T[]>([])  // ✅ React subscribes directly
```

---

### ❌ Polling atoms from services

**Don't**:
```typescript
const resultsAtom = runtimeAtom.atom(
  Effect.gen(function* () {
    const dm = yield* DataManager
    return yield* dm.getResults()  // ❌ Requires manual refresh
  })
)
```

**Do**:
```typescript
export const resultsAtom = Atom.make<T[]>([])
export const addResult = (r: T) => Atom.set(resultsAtom, [...Atom.get(resultsAtom), r])
```

---

### ❌ Creating services for simple state

**Don't**:
```typescript
export class CounterService extends Effect.Service<CounterService>()('app/Counter', {
  effect: Effect.gen(function* () {
    const ref = yield* Ref.make(0)
    return { increment: () => Ref.update(ref, n => n + 1) }
  }),
}) {}
```

**Do**:
```typescript
export const counterAtom = Atom.make(0)
export const increment = () => Atom.set(counterAtom, Atom.get(counterAtom) + 1)
```

---

### ❌ Not using Layer.scoped for cleanup

**Don't**:
```typescript
const makeWSService = Effect.gen(function* () {
  const ws = new WebSocket('ws://...')
  // ❌ No cleanup — WebSocket leaks
  return { send, receive }
})
```

**Do**:
```typescript
const makeWSService = Effect.gen(function* () {
  const ws = new WebSocket('ws://...')
  yield* Effect.addFinalizer(() => Effect.sync(() => ws.close()))  // ✅ Cleanup
  return { send, receive }
})
export const WSServiceLive = Layer.scoped(WSService, makeWSService)
```

---

## Quick Reference

### Service Creation

```typescript
// Stateless (Context.Tag)
export class MyService extends Context.Tag('app/MyService')<MyService, MyServiceShape>() {}
export const MyServiceLive = Layer.succeed(MyService, implementation)

// Stateful (Effect.Service<>())
export class MyService extends Effect.Service<MyService>()('app/MyService', {
  effect: Effect.gen(function* () {
    const ref = yield* Ref.make(initialState)
    return { /* API */ } as const
  }),
}) {}

// With cleanup (Layer.scoped)
export const MyServiceLive = Layer.scoped(MyService, makeMyService)
```

---

### Layer Composition

```typescript
// Combine services
const AppLayer = Layer.mergeAll(ServiceA.Default, ServiceB.Default)

// Provide dependencies
const ServiceBWithDeps = ServiceB.Default.pipe(Layer.provide(ServiceA.Default))
```

---

### effect-atom Integration

```typescript
// Runtime atom
export const runtimeAtom = Atom.runtime(Layer.mergeAll(/* services */))

// Operation
export const doThing = runtimeAtom.fn((arg: string) => Effect.gen(function* () {
  const svc = yield* MyService
  return yield* svc.method(arg)
}))

// Query
export const resultAtom = runtimeAtom.atom(Effect.gen(function* () {
  const svc = yield* MyService
  return yield* svc.getResult()
}))
```

---

### Testing

```typescript
import { describe, it, expect } from '@effect/vitest'

describe('MyService', () => {
  it.effect('does the thing', () =>
    Effect.gen(function* () {
      const svc = yield* MyService
      const result = yield* svc.doThing()
      expect(result).toBe('expected')
    }).pipe(Effect.provide(MyService.Default))
  )
})
```

---

## Sources

- [Managing Services | Effect Documentation](https://effect.website/docs/requirements-management/services/)
- [Managing Layers | Effect Documentation](https://effect.website/docs/requirements-management/layers/)
- [Layer Memoization | Effect Documentation](https://effect.website/docs/requirements-management/layer-memoization/)
- TMNL codebase examples:
  - `src/lib/data-manager/v1/DataManager.ts` — Effect.Service<>() with hybrid dispatch
  - `src/lib/slider/v1/services/SliderBehavior.ts` — Context.Tag with Layer.succeed
  - `src/lib/streams/constructs/ChannelService.ts` — Context.Tag + Layer.effect
  - `src/lib/overlays/atoms/index.ts` — Atom-as-State migration example
  - `src/lib/data-manager/v2/__tests__/KernelRegistry.test.ts` — @effect/vitest patterns

---

**Last Updated**: 2025-12-08
**Maintained By**: Val (AG-Grid integration architect)
**Status**: Living document — update as new patterns emerge
