# Effect Core Patterns

> Source: `.edin/EFFECT_PATTERNS.md`
> Last consolidated: 2026-02-09

## Overview

This is the foundational Effect-TS pattern document for the TMNL project. It covers the Atom-as-State doctrine, service definition patterns, Effect.gen pipelines, Layer construction, Stream primitives, and the effect-atom integration that bridges Effect services to React.

## Critical Doctrine: Atom-as-State

**NO EFFECT.REF. EVER.** (When React is the consumer.)

When React consumes state via effect-atom, `Atom.make()` is the primary state mechanism -- not `Effect.Ref` inside services. Service methods mutate Atoms directly (`ctx.set`), React subscribes directly. This eliminates the Ref-to-Atom bridge: no polling, no SubscriptionRef, no streams-to-consume-streams.

```typescript
const resultsAtom = Atom.make<SearchResult[]>([])
const statusAtom = Atom.make<'idle' | 'loading' | 'complete'>('idle')

const searchOp = runtimeAtom.fn<string>()((query, ctx) =>
  Effect.gen(function* () {
    ctx.set(statusAtom, 'loading')
    const results = yield* performSearch(query)
    ctx.set(resultsAtom, results)
    ctx.set(statusAtom, 'complete')
  })
)

function Results() {
  const results = useAtomValue(resultsAtom)
  return <List items={results} />
}
```

## Service Pattern Decision Tree

```
Need a service?
|
+-- Multiple swappable implementations (Strategy Pattern)?
|   -> Use: class extends Context.Tag
|      (e.g., SliderBehavior with 5 curve types)
|
+-- Effectful construction or service dependencies?
|   -> Use: class extends Effect.Service<>()
|      (Default choice for most services)
|
+-- Simple configuration tag?
    -> Use: class extends Context.Tag
       with Static Default + Custom factories
```

## Effect.Service<>() -- Recommended Default

Auto-generates `.Default` layer, supports effectful construction and `dependencies` array.

```typescript
class MyService extends Effect.Service<MyService>()("app/MyService", {
  effect: Effect.gen(function* () {
    const config = yield* ConfigService
    const doThing = (input: string): Effect.Effect<number> =>
      Effect.succeed(input.length)
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

## Context.Tag -- Strategy Pattern

For multiple swappable implementations of the same interface.

```typescript
interface BehaviorShape {
  readonly id: string
  readonly transform: (value: number) => number
}

class MyBehavior extends Context.Tag('app/MyBehavior')<
  MyBehavior,
  BehaviorShape
>() {}

const linearImpl: BehaviorShape = { id: 'linear', transform: (v) => v }
const logImpl: BehaviorShape = { id: 'logarithmic', transform: (v) => Math.log(v) }

// Export both .Default (Layer) AND .shape (direct access)
export const LinearBehavior = {
  Default: Layer.succeed(MyBehavior, linearImpl),
  shape: linearImpl,
}
```

## Context.Reference -- Service with Default Value

A Tag with a built-in default value. No provider required if default is acceptable.

```typescript
class SpecialNumber extends Context.Reference<SpecialNumber>()(
  'SpecialNumber',
  { defaultValue: () => 2048 }
) {}

const program = Effect.gen(function* () {
  const num = yield* SpecialNumber  // 2048, no provider needed
})
```

## Layer Construction Patterns

| Constructor | When | Cleanup? |
|-------------|------|----------|
| `Layer.succeed(Tag, value)` | Synchronous construction | No |
| `Layer.effect(Tag, Effect)` | Effectful construction (Refs, PubSub) | No |
| `Layer.scoped(Tag, Effect)` | Resource management | Yes (addFinalizer) |
| `Layer.mergeAll(A, B, C)` | Combine multiple layers | Per-layer |

```typescript
// Scoped: auto-cleanup on layer teardown
const ConnectionLive = Layer.scoped(
  Connection,
  Effect.acquireRelease(
    Effect.sync(() => createConnection()),
    (conn) => Effect.sync(() => conn.close())
  )
)
```

## Stream Primitives

```typescript
// Constructors
Stream.fromIterable([1, 2, 3])
Stream.fromSchedule(Schedule.spaced('1 second'))
Stream.async<string>((emit) => {
  socket.on('message', (msg) => emit.single(msg))
  return Effect.sync(() => socket.close())
})
Stream.fromEffect(Effect.succeed(42))

// Consumers
Stream.runCollect(stream)
Stream.runForEach(stream, (item) => Effect.log(item))
Stream.runFold(stream, 0, (acc, n) => acc + n)
```

## Atom Primitives (effect-atom)

| Need | Pattern | Example |
|------|---------|---------|
| Simple UI state | `Atom.make(value)` | `Atom.make(false)` |
| Derived value | `Atom.make((get) => ...)` | `Atom.make((get) => get(a) + get(b))` |
| Async data | `Atom.make(Effect)` | `Atom.make(Effect.promise(fetch))` |
| Service access | `Atom.runtime(Layer)` | `Atom.runtime(MyService.Default)` |
| Mutation/action | `runtime.fn<Arg>()` | `runtime.fn<string>()((q, ctx) => ...)` |
| Progressive stream | `runtime.pull(Stream)` | `runtime.pull(largeStream)` |
| Keyed atoms | `Atom.family((key) => ...)` | `Atom.family((id) => Atom.make(...))` |
| Long-lived | `Atom.keepAlive(atom)` | `Atom.keepAlive(runtimeAtom)` |

## Materialized View Pattern

Separate **State atoms** (readonly views) from **Operation atoms** (write-only actions). Operations update state via `ctx.set()`.

```
atoms/
+-- state/
|   +-- resultsAtom      <-- Primitive, readonly from components
|   +-- statusAtom       <-- Primitive, readonly from components
|   +-- statsAtom        <-- Derived from above
+-- operations/
    +-- searchOp         <-- runtime.fn, writes to state
    +-- clearOp          <-- runtime.fn, writes to state
```

## Parallel Atom Setup

```typescript
// DO: Parallel atom updates with Effect.all
yield* Effect.all([
  Effect.sync(() => registry.set(modeAtom, 'command')),
  Effect.sync(() => registry.set(promptAtom, 'M-x ')),
  Effect.sync(() => registry.set(inputAtom, '')),
  Effect.sync(() => registry.set(selectedIndexAtom, 0)),
], { concurrency: 'unbounded' })
```

## Anti-Patterns (Banned)

| Anti-Pattern | Fix |
|--------------|-----|
| `Effect.Ref` for React state | Use `Atom.make()` at module level |
| Unconditional stream subscription | Guard subscription or move to stable parent |
| Atom creation inside components | Define atoms at module level |
| Raw Promise in Atom | Wrap in `Effect.promise(() => ...)` |
| `useState` for cross-component state | Use effect-atom primitives |
| Sync `Atom.get/set` calls (not yielded) | `yield* Atom.get(...)` -- these return Effects! |
| Streams-to-consume-streams bridge | Just call `ctx.set(atom, value)` directly |

## Service Pattern Comparison

| Feature | `Effect.Service<>()` | `class extends Context.Tag` |
|---------|---------------------|---------------------------|
| Auto-generates Layer | Yes (`.Default`) | No (manual `Layer.succeed`) |
| Effectful construction | Yes (`Effect.gen`) | Needs `Layer.effect` |
| Dependencies array | Yes (`dependencies: [...]`) | Manual `Layer.provide` |
| Multiple implementations | Awkward | Idiomatic |
| Recommended for new code | Default choice | Strategy Pattern only |

## Agent Quick Reference

### Key Imports

```typescript
import { Effect, Layer, Context, Stream, Schedule } from 'effect'
import { Atom } from '@effect-atom/atom'
```

### Minimal Example

```typescript
class MySvc extends Effect.Service<MySvc>()("app/MySvc", {
  effect: Effect.succeed({ greet: (name: string) => Effect.succeed(`Hi ${name}`) }),
}) {}

const runtimeAtom = Atom.runtime(MySvc.Default)
const greetOp = runtimeAtom.fn<string>()((name, ctx) =>
  Effect.gen(function* () { return yield* (yield* MySvc).greet(name) })
)
```

### Common Pitfalls

- Missing double `()()` on `Effect.Service<T>()(id, config)`
- Config Tag defined AFTER the service that depends on it (circular dep)
- Forgetting `as const` on service return objects
- Using `Atom.get()` / `Atom.set()` without `yield*` (they return Effects)
- Creating atoms inside React components instead of at module level

### Cross-References

- [effect-services.md](./effect-services.md) -- detailed service patterns
- [effect-atom-result.md](./effect-atom-result.md) -- Result handling in React
- [effect-testing.md](./effect-testing.md) -- testing with @effect/vitest
