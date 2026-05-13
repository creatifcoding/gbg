# Effect v4 Atom API — Canonical Reference

> Source of truth: `submodules/effect-smol/packages/effect/src/unstable/reactivity/Atom.ts`
> React hooks: `submodules/effect-smol/packages/atom/react/src/Hooks.ts`

## Import Path (v4)

```ts
import { Atom, AsyncResult, AtomRegistry, AtomRef, Reactivity } from "effect/unstable/reactivity"
```

React hooks (separate package):
```ts
import { useAtomValue, useAtomSet, useAtom, useAtomSuspense, useAtomMount, useAtomRefresh, useAtomSubscribe } from "@effect/atom-react"
```

## Core Types

```ts
// Read-only atom
interface Atom<A> {
  readonly keepAlive: boolean
  readonly lazy: boolean
  readonly read: (get: Context) => A
  readonly refresh?: (f: <A>(atom: Atom<A>) => void) => void
  readonly label?: readonly [name: string, stack: string]
  readonly idleTTL?: number
}

// Read-write atom
interface Writable<R, W = R> extends Atom<R> {
  readonly write: (ctx: WriteContext<R>, value: W) => void
}
```

## Constructors

### `Atom.make` — Universal constructor

```ts
// Simple writable state
const count = Atom.make(0)                    // Writable<number>

// Derived/computed (read-only)
const doubled = Atom.make((get) => get(count) * 2)  // Atom<number>

// Effect-backed (async)
const user = Atom.make(
  Effect.gen(function*() {
    const api = yield* UserApi
    return yield* api.fetchUser("u1")
  })
)  // Atom<AsyncResult<User, ApiError>>

// Stream-backed
const feed = Atom.make(
  Stream.fromPubSub(pubsub)
)  // Atom<AsyncResult<Message, NoSuchElementError>>

// With initial value (avoids Initial state)
const data = Atom.make(fetchEffect, { initialValue: [] })
```

### `Atom.readable` / `Atom.writable` — Low-level constructors

```ts
const custom = Atom.readable((get) => {
  const a = get(atomA)
  const b = get(atomB)
  return a + b
})

const customWritable = Atom.writable(
  (get) => get(source),                    // read
  (ctx, value) => ctx.setSelf(value)        // write
)
```

### `Atom.family` — Memoized parameterized atoms

```ts
const userAtom = Atom.family((id: string) =>
  Atom.make(Effect.gen(function*() {
    const api = yield* UserApi
    return yield* api.fetchUser(id)
  }))
)

// Usage: userAtom("u1") always returns same atom instance for "u1"
```

Uses `WeakRef` + `FinalizationRegistry` for automatic cleanup when atoms are no longer referenced.

### `Atom.runtime` — Service-backed atoms (Layer integration)

```ts
const appRuntime = Atom.runtime(
  Layer.mergeAll(UserApi.layer, HttpClient.layer)
)

// Create atoms that have access to runtime services
const usersAtom = appRuntime.atom(
  Effect.gen(function*() {
    const api = yield* UserApi
    return yield* api.listUsers()
  })
)

// Create callable atom functions
const createUser = appRuntime.fn(
  (input: CreateUserInput, get) =>
    Effect.gen(function*() {
      const api = yield* UserApi
      return yield* api.create(input)
    })
)
```

`AtomRuntime` provides:
- `.atom(effect)` — derived atom with services
- `.fn(fn)` — callable atom function with services
- `.pull(stream)` — pull-based stream consumption
- `.subscriptionRef(ref)` — reactive subscription ref

### `Atom.context` — Custom RuntimeFactory

```ts
const factory = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() })
const runtime = factory(MyLayer)
```

## Context API (inside `read` functions)

```ts
Atom.make((get) => {
  get(otherAtom)                    // read dependency (auto-tracked)
  get.get(otherAtom)                // same, explicit
  get.once(otherAtom)               // read WITHOUT tracking dependency
  get.set(writableAtom, newValue)   // write to another atom
  get.setSelf(value)                // write to self
  get.self()                        // Option of current value
  get.refresh(atom)                 // force recompute
  get.refreshSelf()                 // force self recompute
  get.mount(atom)                   // ensure atom is mounted
  get.addFinalizer(() => cleanup()) // cleanup when atom unmounts
  get.subscribe(atom, (v) => {})    // subscribe to changes
  get.stream(atom)                  // Stream<A> of atom values
  get.result(asyncAtom)             // Effect<A, E> from AsyncResult atom
  get.registry                      // AtomRegistry instance
})
```

## Combinators

```ts
Atom.map(atom, (a) => transform(a))         // derive with transform
Atom.setIdleTTL(atom, Duration.minutes(5))  // auto-dispose after idle
Atom.keepAlive(atom)                        // never auto-dispose
Atom.withFallback(atom, fallbackAtom)       // fallback for async
Atom.transform(atom, (get) => ...)          // wrap read function
Atom.batch(registry, () => { ... })         // batch updates
```

## React Hooks

```ts
// Read value
const value = useAtomValue(atom)
const mapped = useAtomValue(atom, (a) => a.name)

// Read + write
const [value, setValue] = useAtom(writableAtom)

// Write only
const set = useAtomSet(writableAtom)

// Async with Suspense
const result = useAtomSuspense(asyncAtom)
// throws promise if Initial/Waiting → React Suspense catches it

// Lifecycle
useAtomMount(atom)           // ensure mounted during component life
const refresh = useAtomRefresh(atom)  // force recompute
useAtomSubscribe(atom, (v) => console.log(v))  // side-effect on change

// AtomRef (mutable ref with subscriptions)
const refValue = useAtomRef(ref)
const propRef = useAtomRefProp(ref, "name")
```

## Registry

```ts
import { AtomRegistry } from "effect/unstable/reactivity"

// AtomRegistry is an Effect service tag
const registry = AtomRegistry  // use in ServiceMap

// Operations
registry.get(atom)                      // read current value
registry.set(writableAtom, value)       // write value
registry.subscribe(atom, callback)      // subscribe to changes
registry.mount(atom)                    // mount (keep alive while mounted)
registry.refresh(atom)                  // force recompute
```

## AsyncResult (replaces old Result from effect-atom)

```ts
import { AsyncResult } from "effect/unstable/reactivity"

type AsyncResult<A, E> =
  | { _tag: "Initial"; waiting: boolean }
  | { _tag: "Success"; value: A; waiting: boolean }
  | { _tag: "Failure"; cause: Cause<E>; waiting: boolean }

// Constructors
AsyncResult.initial()
AsyncResult.success(value)
AsyncResult.fail(error)
AsyncResult.fromExit(exit)

// Pattern matching
if (result._tag === "Success") { result.value }
if (result._tag === "Failure") { Cause.squash(result.cause) }
```

## Key Differences from effect-atom v3

| v3 (`@effect-atom/atom`) | v4 (`effect/unstable/reactivity`) |
|---|---|
| `import { Atom } from '@effect-atom/atom'` | `import { Atom } from 'effect/unstable/reactivity'` |
| `import * as Result from '@effect-atom/atom/Result'` | `import { AsyncResult } from 'effect/unstable/reactivity'` |
| `import * as Registry from '@effect-atom/atom/Registry'` | `import { AtomRegistry } from 'effect/unstable/reactivity'` |
| `Result.isSuccess(r)` | `r._tag === "Success"` |
| `Atom.runtime(Layer)` | `Atom.runtime(Layer)` (same API, diff import) |
| `Registry.make()` | `AtomRegistry` service tag |
| Separate package | Part of core `effect` (unstable) |
