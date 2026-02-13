# Effect Differ + Reactivity Patterns

> **Source**: `.edin/DIFFER_REACTIVITY_RESEARCH.md`
> **Last consolidated**: 2026-02-09

## Overview

Research document covering Effect's `Differ<Value, Patch>` system and `@effect/experimental/Reactivity` service. These provide compositional patch computation for tree structures and invalidation-based dependency tracking for reactive queries.

---

## Part 1: Effect Differ System

### Core Interface

**Source**: `effect/src/Differ.ts`

```typescript
export interface Differ<in out Value, in out Patch> {
  readonly empty: Patch
  diff(oldValue: Value, newValue: Value): Patch
  combine(first: Patch, second: Patch): Patch
  patch(patch: Patch, oldValue: Value): Value
}
```

| Method | Purpose | Signature |
|--------|---------|-----------|
| `diff` | Compare old and new values to produce a patch | `(old, new) => Patch` |
| `combine` | Merge two patches (associative) | `(first, second) => Patch` |
| `patch` | Apply patch to old value to produce new value | `(patch, old) => Value` |
| `empty` | Identity patch (no changes) | `Patch` |

### Laws & Invariants

1. **Associativity**: `combine(combine(p1, p2), p3) === combine(p1, combine(p2, p3))`
2. **Empty Identity**: `combine(patch, empty) === patch === combine(empty, patch)`
3. **Self-Diff Empty**: `diff(value, value) === empty`
4. **Diff-Patch Roundtrip**: `patch(diff(old, new), old) === new`
5. **Empty Patch Identity**: `patch(empty, value) === value`

---

## Part 2: Creating Custom Differs

### Factory Function

```typescript
import { Differ } from "effect"

const myDiffer = Differ.make({
  empty: /* identity patch */,
  diff: (oldValue, newValue) => /* compute patch */,
  combine: (first, second) => /* merge patches */,
  patch: (patch, oldValue) => /* apply patch */,
})
```

### Built-in Differ Constructors

| Constructor | Use Case |
|-------------|----------|
| `Differ.update<A>()` | Simple value replacement (non-compositional, leaf values only) |
| `Differ.updateWith<A>(f)` | Value replacement with merge function |
| `Differ.hashMap<K, V, P>(vDiffer)` | HashMap with nested value diffs |
| `Differ.chunk<V, P>(vDiffer)` | Chunk (immutable array) diffs |
| `Differ.readonlyArray<V, P>(vDiffer)` | ReadonlyArray diffs |
| `Differ.zip(d1, d2)` | Combine two differs for tuples |
| `Differ.transform({ toNew, toOld })` | Map differ to new value type |

### Pattern: Differ for Record<string, Element>

For a tree like `{ root: string, elements: Record<string, Element> }`, compose differs:

```typescript
import { Differ, HashMap } from "effect"

const elementDiffer = Differ.update<Element>()
const recordDiffer = Differ.hashMap<string, Element, (e: Element) => Element>(
  elementDiffer
)

const treeDiffer = Differ.make({
  empty: { root: identity, elements: HashMap.empty() },
  diff: (oldTree, newTree) => ({
    root: oldTree.root === newTree.root ? identity : constant(newTree.root),
    elements: recordDiffer.diff(
      HashMap.fromIterable(Object.entries(oldTree.elements)),
      HashMap.fromIterable(Object.entries(newTree.elements))
    )
  }),
  combine: (first, second) => ({
    root: second.root === identity ? first.root : second.root,
    elements: recordDiffer.combine(first.elements, second.elements)
  }),
  patch: (patch, oldTree) => ({
    root: patch.root(oldTree.root),
    elements: Object.fromEntries(
      HashMap.toEntries(
        recordDiffer.patch(patch.elements,
          HashMap.fromIterable(Object.entries(oldTree.elements)))
      )
    )
  })
})
```

---

## Part 3: HashMap Patch Structure

HashMap patches are algebraic data types:

```typescript
type HashMapPatch<K, V, P> =
  | { _tag: "Empty" }
  | { _tag: "Add", key: K, value: V }
  | { _tag: "Remove", key: K }
  | { _tag: "Update", key: K, patch: P }
  | { _tag: "AndThen", first: Patch, second: Patch }
```

**Diff algorithm**:
1. Iterate through new map keys
2. For each key: if in old map, compute value patch with nested differ; if not, create `Add` patch
3. For remaining keys in old map: create `Remove` patches
4. Combine all patches with `AndThen`

This enables **compositional nested diffs** -- the HashMap differ delegates to a value differ for updates.

---

## Part 4: Reactivity System

### Service Interface

**Source**: `@effect/experimental/Reactivity`

```typescript
export interface Reactivity.Service {
  readonly invalidate: (
    keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>
  ) => Effect.Effect<void>
  readonly mutation: <A, E, R>(
    keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>,
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>
  readonly query: <A, E, R>(
    keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>,
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<Mailbox.ReadonlyMailbox<A, E>, never, R | Scope.Scope>
  readonly stream: <A, E, R>(
    keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>,
    effect: Effect.Effect<A, E, R>
  ) => Stream.Stream<A, E, Exclude<R, Scope.Scope>>
  readonly unsafeInvalidate: (keys) => void
  readonly unsafeRegister: (keys, handler) => () => void
}
```

| Method | Purpose | Return Type |
|--------|---------|-------------|
| `mutation(keys, effect)` | Run effect, then invalidate keys | `Effect<A, E, R>` |
| `query(keys, effect)` | Reactive query that re-runs on invalidation | `Effect<Mailbox<A, E>>` |
| `stream(keys, effect)` | Stream of query results (emits on invalidation) | `Stream<A, E, R>` |
| `invalidate(keys)` | Manually invalidate keys | `Effect<void>` |

### Key Resolution

```typescript
// Array form -- invalidates handlers registered to each element
Reactivity.mutation(["user", "posts"], effect)

// Record form -- scoped IDs: invalidates "user", "user:123", "user:456"
Reactivity.mutation({ user: ["123", "456"] }, effect)
```

### Dependency Tracking

Reactivity maintains a `Map<number | string, Set<() => void>>` of handlers keyed by:
- **Array keys**: Each element hashed via `Hash.hash()`
- **Record keys**: Object keys + scoped IDs (`"user:123"`, `"user:456"`)

### Query Pattern

```typescript
const query = <A, E, R>(keys, effect) =>
  Effect.gen(function*() {
    const results = yield* Mailbox.make<A, E>()
    const runFork = yield* FiberHandle.makeRuntime<R>()

    function run() {
      if (running) { pending = true; return }
      running = true
      runFork(effect).addObserver(handleExit)
    }

    const cancel = unsafeRegister(keys, run)
    yield* Scope.addFinalizer(scope, Effect.sync(cancel))
    run()  // Run immediately

    return results as Mailbox.ReadonlyMailbox<A, E>
  })
```

**Flow**:
1. Create a Mailbox (async queue)
2. Register a handler that runs the query effect
3. Run immediately + on every invalidation
4. Push results to mailbox
5. Return mailbox (consumer reads via `Mailbox.toStream`)

---

## Part 5: Combining Differ + Reactivity + Stream

### Architecture Pattern

```
External Patch Stream (NATS)
         |
         v
  Stream.fromPubSub (Effect Stream)
         |
         v
  Stream.tap(patch =>
    Reactivity.mutation(["uitree"], ...)
  )
         |
         v
  Atom (UITree state) -- Updated via ctx.set
         |
         v
  Reactivity.stream(["uitree"], ...)
  -> React component subscribes
```

### Atom with Differ-Based Updates

```typescript
const treeAtom = Atom.make<UITree>({ root: "", elements: {} })

const applyPatch = Atom.runtimeFn<UITreePatch>()((patch, ctx) =>
  Effect.gen(function*() {
    const oldTree = ctx.get(treeAtom)
    const newTree = UITreeDiffer.patch(patch, oldTree)
    ctx.set(treeAtom, newTree)
    yield* Reactivity.invalidate(["uitree", patch.nodeId])
  })
)
```

### Stream Integration

```typescript
// Consume patches from external stream
const patchStream = Stream.fromPubSub(durableStreamPubSub).pipe(
  Stream.map(deserializePatch),
  Stream.tap((patch) =>
    applyPatch(patch).pipe(
      Effect.provideLayer(Atom.runtime(registry)),
      Effect.provideLayer(Reactivity.layer)
    )
  )
)

// Subscribe to tree changes in React
const TreeComponent = () => {
  const reactiveTreeStream = Reactivity.stream(["uitree"],
    Effect.sync(() => registry.get(treeAtom))
  )
  const tree = useEffectStream(reactiveTreeStream)
  return <div>{renderTree(tree)}</div>
}
```

### Scoped Invalidation (Per-Node)

```typescript
// Invalidate specific node
Reactivity.mutation({ uitree: [nodeId] }, updateEffect)

// Query specific node (reactive)
const nodeStream = Reactivity.stream({ uitree: [nodeId] },
  Effect.sync(() => getNode(nodeId))
)
```

---

## Gotchas & Best Practices

### Differ Composition
- **Don't mix `update()` with compositional differs** -- `Differ.update()` is non-compositional (just replaces values). Use only for leaf values.
- **Use `HashMap.fromIterable`** for Record conversion -- built-in differs work on Effect collections, not plain objects.

### Reactivity Keys
- **Use stable keys** -- `Hash.hash()` is used for non-string keys, ensure objects have stable equality.
- **Record form for scoped invalidation** -- `{ user: ["123"] }` invalidates both `"user"` (global) and `"user:123"` (scoped).

### Stream Integration
- **`provideLayer` BEFORE `toAsyncIterable`** -- Streams with service dependencies must have `Stream.provideLayer` applied before converting.
- **Use `Stream.tap` for side effects** -- Apply patches in `Stream.tap`, not `Stream.map`, to avoid blocking emission.

### Atom Integration
- **Atoms are the state, not Refs** -- Don't sync Effect.Ref to atoms. Atoms ARE the reactive state container.
- **Use `ctx.set()` in operations** -- Atom operations use `ctx.set(atom, value)` to update, not manual mutation.

### Performance
- **Batch invalidations** -- Multiple key invalidations in one call are more efficient.
- **Scope queries narrowly** -- Use record keys to avoid re-running queries for unrelated nodes.

---

## Agent Quick Reference

### Key Imports

```typescript
import { Differ, HashMap, Stream } from "effect"
import { Reactivity } from "@effect/experimental"
import { Atom } from "@effect-atom/atom"
```

### Minimal Example

```typescript
// Simple value differ
const numberDiffer = Differ.update<number>()

const p = numberDiffer.diff(1, 2)     // Patch
const v = numberDiffer.patch(p, 1)    // 2
const e = numberDiffer.empty          // Identity patch
const c = numberDiffer.combine(p, e)  // Same as p

// Reactive stream
const stream = Reactivity.stream(["items"],
  Effect.sync(() => getAllItems())
)
// Emits new value whenever "items" key is invalidated
```

### Common Pitfalls

- Using `Differ.update()` for collections -- it replaces the entire value, use `Differ.hashMap` or `Differ.chunk` instead
- Forgetting `HashMap.fromIterable` conversion when diffing plain objects -- differs work on Effect collections
- Unstable keys in Reactivity -- objects without stable `Hash.hash()` cause phantom invalidations
- Not using record-form keys for scoped invalidation -- `["user"]` invalidates everything, `{ user: ["123"] }` is targeted
- Creating reactive streams without `Scope` -- `Reactivity.query` requires `Scope.Scope` in context

### Cross-References

- [effect-core.md](./effect-core.md) -- Stream primitives, Atom-as-State doctrine
- [effect-services.md](./effect-services.md) -- Layer.scoped for Reactivity lifecycle
- [effect-atom-result.md](./effect-atom-result.md) -- Result handling for reactive atoms
