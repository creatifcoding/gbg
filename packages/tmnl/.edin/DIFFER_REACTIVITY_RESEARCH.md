# Effect Differ + Reactivity Research for Durable Stream Patches Hook

Generated: 2026-01-19

## Executive Summary

This document presents authoritative research on Effect's `Differ<Value, Patch>` and `@effect/experimental/Reactivity` systems, sourced directly from the Effect codebase. The goal is to understand how to build an Effect-native durable stream patches hook that combines:

1. **Differ** - Compositional patch computation and application for tree structures
2. **Reactivity** - Invalidation-based dependency tracking for reactive queries
3. **Stream** - Integration with Effect streams for consuming external patches

---

## Part 1: Effect Differ System

### Core Interface

**Source**: `/submodules/effect/packages/effect/src/Differ.ts:52-61`

```typescript
export interface Differ<in out Value, in out Patch> extends Pipeable {
  readonly [TypeId]: {
    readonly _V: Types.Invariant<Value>
    readonly _P: Types.Invariant<Patch>
  }
  readonly empty: Patch
  diff(oldValue: Value, newValue: Value): Patch
  combine(first: Patch, second: Patch): Patch
  patch(patch: Patch, oldValue: Value): Value
}
```

### Key Methods

| Method | Purpose | Signature |
|--------|---------|-----------|
| `diff` | Compare old and new values to produce a patch | `(old: Value, new: Value) => Patch` |
| `combine` | Merge two patches (associative operation) | `(first: Patch, second: Patch) => Patch` |
| `patch` | Apply patch to old value to produce new value | `(patch: Patch, old: Value) => Value` |
| `empty` | Identity patch (no changes) | `Patch` |

### Laws & Invariants

**Source**: `/submodules/effect/packages/effect/test/Differ.test.ts:17-57`

1. **Associativity**: `combine(combine(p1, p2), p3) ≡ combine(p1, combine(p2, p3))`
2. **Empty Identity**: `combine(patch, empty) ≡ patch ≡ combine(empty, patch)`
3. **Self-Diff Empty**: `diff(value, value) ≡ empty`
4. **Diff-Patch Roundtrip**: `patch(diff(old, new), old) ≡ new`
5. **Empty Patch Identity**: `patch(empty, value) ≡ value`

These laws ensure compositional correctness and enable FiberRef-based patching.

---

## Part 2: Creating Custom Differs

### Factory Function

**Source**: `/submodules/effect/packages/effect/src/internal/differ.ts:33-47`

```typescript
export const make = <Value, Patch>(
  params: {
    readonly empty: Patch
    readonly diff: (oldValue: Value, newValue: Value) => Patch
    readonly combine: (first: Patch, second: Patch) => Patch
    readonly patch: (patch: Patch, oldValue: Value) => Value
  }
): Differ.Differ<Value, Patch> => {
  const differ = Object.create(DifferProto)
  differ.empty = params.empty
  differ.diff = params.diff
  differ.combine = params.combine
  differ.patch = params.patch
  return differ
}
```

### Pattern: Differ for Record<string, Element>

For a tree like `{ root: string, elements: Record<string, Element> }`, compose differs:

```typescript
import { Differ, HashMap, Schema } from "effect"

// Element differ (assuming simple value replacement)
const elementDiffer = Differ.update<Element>()

// Record → HashMap conversion
const recordDiffer = Differ.hashMap<string, Element, (e: Element) => Element>(
  elementDiffer
)

// Tree differ
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
        recordDiffer.patch(patch.elements, HashMap.fromIterable(Object.entries(oldTree.elements)))
      )
    )
  })
})
```

### Built-in Differ Constructors

**Source**: `/submodules/effect/packages/effect/src/Differ.ts:322-428`

| Constructor | Use Case | Signature |
|-------------|----------|-----------|
| `Differ.update<A>()` | Simple value replacement (non-compositional) | `() => Differ<A, (a: A) => A>` |
| `Differ.updateWith<A>(f)` | Value replacement with merge function | `(f: (x: A, y: A) => A) => Differ<A, (a: A) => A>` |
| `Differ.hashMap<K, V, P>(vDiffer)` | HashMap with nested value diffs | `(vDiffer: Differ<V, P>) => Differ<HashMap<K, V>, Patch<K, V, P>>` |
| `Differ.chunk<V, P>(vDiffer)` | Chunk (immutable array) diffs | `(vDiffer: Differ<V, P>) => Differ<Chunk<V>, Patch<V, P>>` |
| `Differ.readonlyArray<V, P>(vDiffer)` | ReadonlyArray diffs | `(vDiffer: Differ<V, P>) => Differ<ReadonlyArray<V>, Patch<V, P>>` |
| `Differ.zip(d1, d2)` | Combine two differs for tuples | `(d1, d2) => Differ<[V1, V2], [P1, P2]>` |
| `Differ.transform({ toNew, toOld })` | Map differ to new value type | `(opts) => (differ) => Differ<V2, P>` |

---

## Part 3: HashMap Patch Structure

**Source**: `/submodules/effect/packages/effect/src/internal/differ/hashMapPatch.ts:27-107`

HashMap patches are algebraic data types:

```typescript
type HashMapPatch<K, V, P> =
  | { _tag: "Empty" }
  | { _tag: "Add", key: K, value: V }
  | { _tag: "Remove", key: K }
  | { _tag: "Update", key: K, patch: P }
  | { _tag: "AndThen", first: Patch, second: Patch }
```

**Diff algorithm** (lines 117-149):
1. Iterate through new map keys
2. For each key:
   - If in old map: compute value patch with nested differ
   - If not in old map: create `Add` patch
3. For remaining keys in old map: create `Remove` patches
4. Combine all patches with `AndThen`

This enables **compositional nested diffs** — the HashMap differ delegates to a value differ for updates.

---

## Part 4: Effect Reactivity System

### Service Interface

**Source**: `/submodules/effect/packages/experimental/src/Reactivity.ts:220-247`

```typescript
export interface Reactivity.Service {
  readonly unsafeInvalidate: (keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>) => void
  readonly unsafeRegister: (
    keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>,
    handler: () => void
  ) => () => void
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
}
```

### Key Methods

| Method | Purpose | Return Type |
|--------|---------|-------------|
| `mutation(keys, effect)` | Run effect, then invalidate keys | `Effect<A, E, R>` |
| `query(keys, effect)` | Create reactive query that re-runs on key invalidation | `Effect<Mailbox<A, E>>` |
| `stream(keys, effect)` | Stream of query results (emits on invalidation) | `Stream<A, E, R>` |
| `invalidate(keys)` | Manually invalidate keys | `Effect<void>` |
| `unsafeRegister(keys, handler)` | Low-level: register handler for key changes | `() => void` (cleanup) |

### Dependency Tracking

**Source**: `/submodules/effect/packages/experimental/src/Reactivity.ts:29-88`

Reactivity maintains a `Map<number | string, Set<() => void>>` of handlers keyed by:
- **Array keys**: Each element hashed via `Hash.hash()`
- **Record keys**: Object keys + scoped IDs (`"user:123"`, `"user:456"`)

**Key resolution**:
```typescript
// Array form
Reactivity.mutation(["user", "posts"], effect)
// → invalidates handlers registered to "user" and "posts"

// Record form (table-scoped IDs)
Reactivity.mutation({ user: ["123", "456"] }, effect)
// → invalidates "user", "user:123", "user:456"
```

### Query Pattern

**Source**: `/submodules/effect/packages/experimental/src/Reactivity.ts:90-129`

```typescript
const query = <A, E, R>(
  keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<Mailbox.ReadonlyMailbox<A, E>, never, R | Scope.Scope> =>
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
┌─────────────────────────────────────────────────────────────────┐
│                  External Patch Stream (NATS)                   │
│                     (UITreePatch events)                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Stream.fromPubSub    │
         │  (Effect Stream)      │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Stream.tap(patch =>  │
         │    Reactivity.mutation│
         │    (["uitree"], ...)  │
         │  )                    │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Atom (UITree state)  │
         │  Updated via ctx.set  │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Reactivity.stream    │
         │  (["uitree"], ...)    │
         │  → React component    │
         └───────────────────────┘
```

### Integration Steps

#### 1. Define Tree Differ

```typescript
import { Differ, HashMap } from "effect"

// Assume UITree = { root: string, elements: Record<string, Element> }
const elementDiffer = Differ.update<Element>()
const treeElementsDiffer = Differ.hashMap(elementDiffer)

const UITreeDiffer = Differ.make({
  empty: { root: (_: string) => _, elements: HashMap.empty() },
  diff: (oldTree, newTree) => ({
    root: oldTree.root === newTree.root ? identity : constant(newTree.root),
    elements: treeElementsDiffer.diff(
      recordToHashMap(oldTree.elements),
      recordToHashMap(newTree.elements)
    )
  }),
  combine: (p1, p2) => ({
    root: p2.root === identity ? p1.root : p2.root,
    elements: treeElementsDiffer.combine(p1.elements, p2.elements)
  }),
  patch: (patch, oldTree) => ({
    root: patch.root(oldTree.root),
    elements: hashMapToRecord(
      treeElementsDiffer.patch(patch.elements, recordToHashMap(oldTree.elements))
    )
  })
})
```

#### 2. Atom with Differ-Based Updates

```typescript
import { Atom, Reactivity } from "effect-atom"
import { Effect } from "effect"

const treeAtom = Atom.make<UITree>({ root: "", elements: {} })

// Operation: apply external patch
const applyPatch = Atom.runtimeFn<UITreePatch>()((patch, ctx) =>
  Effect.gen(function*() {
    const oldTree = ctx.get(treeAtom)
    const newTree = UITreeDiffer.patch(patch, oldTree)
    ctx.set(treeAtom, newTree)
    
    // Invalidate reactivity keys
    yield* Reactivity.invalidate(["uitree", patch.nodeId])
  })
)
```

#### 3. Stream Integration

```typescript
import { Stream } from "effect"

// Consume patches from external stream
const patchStream = Stream.fromPubSub(durableStreamPubSub).pipe(
  Stream.map(deserializePatch),
  Stream.tap((patch) =>
    // Apply patch and invalidate
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
  
  // Convert to React state via useStream or similar
  const tree = useEffectStream(reactiveTreeStream)
  return <div>{renderTree(tree)}</div>
}
```

#### 4. Scoped Invalidation (Per-Node)

```typescript
// Invalidate specific node
Reactivity.mutation({ uitree: [nodeId] }, updateEffect)

// Query specific node (reactive)
const nodeStream = Reactivity.stream({ uitree: [nodeId] }, 
  Effect.sync(() => getNode(nodeId))
)
```

---

## Part 6: Gotchas & Best Practices

### 1. Differ Composition

- **Don't mix update() with compositional differs** — `Differ.update()` is non-compositional (just replaces values). Use it only for leaf values.
- **Use HashMap.fromIterable** for Record conversion — built-in differs work on Effect collections, not plain objects.

### 2. Reactivity Keys

- **Use stable keys** — Hash.hash() is used for non-string keys, ensure objects have stable equality.
- **Record form for scoped invalidation** — `{ user: ["123"] }` invalidates both `"user"` (global) and `"user:123"` (scoped).

### 3. Stream Integration

- **provideLayer BEFORE toAsyncIterable** — Streams with service dependencies must have `Stream.provideLayer(ServiceLive)` applied before converting to async iterables.
- **Use Stream.tap for side effects** — Apply patches in `Stream.tap`, not `Stream.map`, to avoid blocking emission.

### 4. Atom Integration

- **Atoms are the state, not Refs** — Don't sync Effect.Ref to atoms. Atoms ARE the reactive state container.
- **Use ctx.set() in operations** — Atom operations use `ctx.set(atom, value)` to update, not manual mutation.

### 5. Performance

- **Batch invalidations** — Multiple key invalidations in one call are more efficient.
- **Scope queries narrowly** — Use record keys (`{ uitree: [nodeId] }`) to avoid re-running queries for unrelated nodes.

---

## Part 7: Reference Patterns from Codebase

### Pattern: HashMap Differ (Compositional Nested Diffs)

**Source**: `/submodules/effect/packages/effect/src/internal/differ.ts:70-78`

```typescript
export const hashMap = <Key, Value, Patch>(
  differ: Differ.Differ<Value, Patch>
): Differ.Differ<HashMap<Key, Value>, Differ.Differ.HashMap.Patch<Key, Value, Patch>> =>
  make({
    empty: HashMapPatch.empty(),
    combine: (first, second) => HashMapPatch.combine(second)(first),
    diff: (oldValue, newValue) => HashMapPatch.diff({ oldValue, newValue, differ }),
    patch: (patch, oldValue) => HashMapPatch.patch(oldValue, differ)(patch)
  })
```

### Pattern: Tuple Differ (Product Composition)

**Source**: `/submodules/effect/packages/effect/src/internal/differ.ts:177-200`

```typescript
export const zip = (self, that) =>
  make({
    empty: [self.empty, that.empty] as const,
    combine: (first, second) => [
      self.combine(first[0], second[0]),
      that.combine(first[1], second[1])
    ],
    diff: (oldValue, newValue) => [
      self.diff(oldValue[0], newValue[0]),
      that.diff(oldValue[1], newValue[1])
    ],
    patch: (patch, oldValue) => [
      self.patch(patch[0], oldValue[0]),
      that.patch(patch[1], oldValue[1])
    ]
  })
```

### Pattern: Reactive Stream from Mailbox

**Source**: `/submodules/effect/packages/experimental/src/Reactivity.ts:131-138`

```typescript
const stream = <A, E, R>(
  tables: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>,
  effect: Effect.Effect<A, E, R>
): Stream.Stream<A, E, Exclude<R, Scope.Scope>> =>
  query(tables, effect).pipe(
    Effect.map(Mailbox.toStream),
    Stream.unwrapScoped
  )
```

---

## Part 8: Proposed Hook Architecture

### Hook Signature

```typescript
interface UseDurableStreamPatchesOptions<Tree, Patch> {
  streamId: string
  initialTree: Tree
  differ: Differ.Differ<Tree, Patch>
  deserializePatch: (data: unknown) => Patch
}

function useDurableStreamPatches<Tree, Patch>(
  options: UseDurableStreamPatchesOptions<Tree, Patch>
): {
  tree: Tree
  applyPatch: (patch: Patch) => Promise<void>
  invalidate: (keys: string[]) => Promise<void>
}
```

### Implementation Outline

```typescript
import { Atom } from "effect-atom"
import { Effect, Stream, Reactivity } from "effect"
import { useSyncExternalStore } from "react"

function useDurableStreamPatches<Tree, Patch>(
  options: UseDurableStreamPatchesOptions<Tree, Patch>
) {
  const { streamId, initialTree, differ, deserializePatch } = options
  
  // 1. Create atom for tree state
  const treeAtom = useMemo(() => Atom.make<Tree>(initialTree), [])
  
  // 2. Create registry with Reactivity layer
  const registry = useMemo(() => Registry.make(), [])
  const reactivityLayer = useMemo(() => Reactivity.layer, [])
  
  // 3. Define patch application operation
  const applyPatchOp = useMemo(() => 
    Atom.runtimeFn<Patch>()((patch, ctx) =>
      Effect.gen(function*() {
        const oldTree = ctx.get(treeAtom)
        const newTree = differ.patch(patch, oldTree)
        ctx.set(treeAtom, newTree)
        yield* Reactivity.invalidate(["tree"])
      })
    ), [differ]
  )
  
  // 4. Subscribe to durable stream
  useEffect(() => {
    const patchStream = Stream.fromPubSub(getDurableStreamPubSub(streamId)).pipe(
      Stream.map(deserializePatch),
      Stream.tap((patch) =>
        applyPatchOp(patch).pipe(
          Effect.provideService(Atom.Runtime, registry),
          Effect.provideLayer(reactivityLayer)
        )
      ),
      Stream.provideLayer(durableStreamLayer)
    )
    
    const fiber = Effect.runFork(Stream.runDrain(patchStream))
    return () => Effect.runFork(Fiber.interrupt(fiber))
  }, [streamId])
  
  // 5. Expose reactive tree via useSyncExternalStore
  const tree = useSyncExternalStore(
    (callback) => {
      const reactiveStream = Reactivity.stream(["tree"], 
        Effect.sync(() => registry.get(treeAtom))
      ).pipe(Effect.provideLayer(reactivityLayer))
      
      const fiber = Effect.runFork(
        Stream.runForEach(reactiveStream, () => Effect.sync(callback))
      )
      return () => Effect.runFork(Fiber.interrupt(fiber))
    },
    () => registry.get(treeAtom)
  )
  
  return { tree, applyPatch: (p) => Effect.runPromise(applyPatchOp(p)), ... }
}
```

---

## Conclusion

This research establishes:

1. **Differ provides compositional patching** via `diff`, `combine`, `patch` operations with algebraic laws
2. **HashMap differ enables nested tree diffs** by delegating to value differs
3. **Reactivity provides invalidation-based reactive queries** with scoped key tracking
4. **Integration pattern**: Stream → Differ.patch → Atom update → Reactivity.invalidate → Reactive query

The canonical references are:
- **Differ**: `/submodules/effect/packages/effect/src/Differ.ts`
- **Reactivity**: `/submodules/effect/packages/experimental/src/Reactivity.ts`
- **HashMap Patch**: `/submodules/effect/packages/effect/src/internal/differ/hashMapPatch.ts`

All patterns verified against Effect source code as of 2026-01-19.
