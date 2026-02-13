# Effect Service Patterns -- The Complete Landscape

> **Source**: `.edin/EFFECT_SERVICE_PATTERNS.md`
> **Last consolidated**: 2026-02-09

## Overview

Comprehensive reference for Effect-TS service architecture patterns in TMNL. Effect-TS provides three primary patterns for defining services, each suited to different use cases. This document covers all three patterns, Layer construction, state management strategies, and migration paths.

---

## Service Definition Approaches

### 1. Context.Tag (Stateless Interface)

**Use when**: Swappable algorithms/strategies (e.g., SliderBehavior with linear, log, decibel curves).

```typescript
interface SliderBehaviorShape {
  readonly id: string
  readonly transform: (value: number) => number
}

class SliderBehavior extends Context.Tag('tmnl/slider/SliderBehavior')<
  SliderBehavior, SliderBehaviorShape
>() {}

const linearImpl: SliderBehaviorShape = { id: 'linear', transform: (v) => v }
const logImpl: SliderBehaviorShape = { id: 'logarithmic', transform: (v) => Math.log(v) }

// Export both .Default (Layer) AND .shape (direct access)
const LinearBehavior = {
  Default: Layer.succeed(SliderBehavior, linearImpl),
  shape: linearImpl,
}
```

### 2. Effect.Service<>() (Stateful Service)

**Use when**: Service needs internal state, lifecycle management, or dependency injection. **RECOMMENDED DEFAULT.**

```typescript
class MyService extends Effect.Service<MyService>()(\"app/MyService\", {
  effect: Effect.gen(function* () {
    const config = yield* ConfigService
    const doThing = (input: string) => Effect.succeed(input.length)
    return { doThing } as const
  }),
  dependencies: [ConfigService.Default],
}) {}

// Auto-generated: MyService.Default layer
// Usage: yield* MyService in Effect.gen
```

**Key Features:**
- Double `()()` syntax: first parameterizes type, second configures service
- `dependencies: [...]` auto-provides required layers
- `as const` ensures readonly interface

### 3. Hybrid: Context.Tag + Manual makeService()

**Use when**: Complex initialization requiring fine control over construction.

```typescript
class ChannelService extends Context.Tag('tmnl/streams/ChannelService')<
  ChannelService, ChannelServiceShape
>() {}

const ChannelServiceLive = Layer.effect(ChannelService, makeChannelService)
```

---

## Decision Matrix

| Scenario | Pattern | Example |
|----------|---------|---------|
| Swappable algorithm | `Context.Tag` + `Layer.succeed` | `SliderBehavior` |
| Stateful orchestrator | `Effect.Service<>()` | `DataManager` |
| Complex initialization | `Context.Tag` + `Layer.effect` | `ChannelService` |
| Resource with cleanup | `Layer.scoped` | WebSocket, file handles |
| React-facing state | `Atom.make()` (NO service) | Search results, UI toggles |
| Effect operations from React | `runtimeAtom.fn()` | Search, dispatch kernels |
| Multiple services together | `Layer.mergeAll` | App service composition |

---

## Layer Construction Patterns

| Layer Function | Use Case | Construction |
|----------------|----------|-------------|
| `Layer.succeed` | Synchronous, no dependencies | Immediate value |
| `Layer.effect` | Effectful construction (Refs, PubSub) | Async, no cleanup |
| `Layer.scoped` | Resources needing cleanup | Auto-release on teardown |
| `Layer.mergeAll` | Multiple services composed | Parallel construction |
| `Layer.provide` | Dependency injection | Type-safe, lazy |
| `Layer.provideMerge` | Dependency injection + export both | For test layers |

```typescript
// Scoped: auto-cleanup on layer teardown
const ConnectionLive = Layer.scoped(
  Connection,
  Effect.acquireRelease(
    Effect.sync(() => createConnection()),
    (conn) => Effect.sync(() => conn.close())
  )
)

// Layer composition with dependencies
const AppLayer = Layer.mergeAll(
  ServiceA.Default,
  ServiceB.Default,
).pipe(
  Layer.provide(ConfigService.Default)
)
```

---

## State Management

| Pattern | Use When | Mechanism |
|---------|----------|-----------|
| Effect.Ref | Internal service state | Opaque to React |
| Atom-as-State | React-facing state | Direct subscription |
| Hybrid (transitional) | Migrating from Ref to Atom | Polling bridge |

**CRITICAL**: For new code, prefer **Atom-as-State** for any state consumed by React.

### Service + Atom Integration

```typescript
const runtimeAtom = Atom.runtime(MyService.Default)

// State atoms at module level
const resultsAtom = Atom.make<SearchResult[]>([])
const statusAtom = Atom.make<'idle' | 'loading'>('idle')

// Operations update atoms via ctx.set()
const searchOp = runtimeAtom.fn<string>()((query, ctx) =>
  Effect.gen(function* () {
    ctx.set(statusAtom, 'loading')
    const svc = yield* MyService
    const results = yield* svc.search(query)
    ctx.set(resultsAtom, results)
    ctx.set(statusAtom, 'idle')
  })
)

// React subscribes directly
function SearchResults() {
  const results = useAtomValue(resultsAtom)
  const status = useAtomValue(statusAtom)
  return status === 'loading' ? <Spinner /> : <List items={results} />
}
```

---

## Service Pattern Comparison

| Feature | `Effect.Service<>()` | `class extends Context.Tag` |
|---------|---------------------|---------------------------|
| Auto-generates Layer | Yes (`.Default`) | No (manual `Layer.succeed`) |
| Effectful construction | Yes (`Effect.gen`) | Needs `Layer.effect` |
| Dependencies array | Yes (`dependencies: [...]`) | Manual `Layer.provide` |
| Multiple implementations | Awkward | Idiomatic |
| Recommended for new code | Default choice | Strategy Pattern only |

---

## Testing Services

```typescript
import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'

// Mock via Layer.succeed
const MockDatabase = Layer.succeed(Database, {
  query: (sql) => Effect.succeed([{ id: 1, name: 'Test' }]),
})

it.effect('uses mock database', () =>
  Effect.gen(function* () {
    const db = yield* Database
    const result = yield* db.query('SELECT * FROM users')
    expect(result).toHaveLength(1)
  }).pipe(Effect.provide(MockDatabase))
)
```

---

## Agent Quick Reference

### Key Imports

```typescript
import { Effect, Layer, Context } from 'effect'
```

### Minimal Example

```typescript
// Recommended: Effect.Service<>()
class MySvc extends Effect.Service<MySvc>()(\"app/MySvc\", {
  effect: Effect.succeed({
    greet: (name: string) => Effect.succeed(`Hi ${name}`)
  }),
}) {}

// Use in tests
it.effect('greets', () =>
  Effect.gen(function* () {
    const svc = yield* MySvc
    const result = yield* svc.greet('Prime')
    expect(result).toBe('Hi Prime')
  }).pipe(Effect.provide(MySvc.Default))
)
```

### Common Pitfalls

- Missing double `()()` on `Effect.Service<T>()(id, config)` -- first call is type param, second is config
- Forgetting `as const` on service return objects -- methods lose Effect types
- Using `Effect.Ref` for React-facing state -- use `Atom.make()` instead
- Creating service layers inside components -- define at module level
- Not providing dependencies -- error channel will contain service type errors

### Cross-References

- [effect-core.md](./effect-core.md) -- foundational Effect patterns, Atom-as-State doctrine
- [effect-testing.md](./effect-testing.md) -- testing with @effect/vitest
- [entities.md](./entities.md) -- entity service patterns with Machine actors
