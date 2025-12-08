# Effect-Atom Pattern Registry

This registry documents the established patterns for integrating Effect-TS with React via `effect-atom` in the TMNL project.

**Grounded in canonical sources:**

- `submodules/effect/packages/effect/src/Context.ts` — Tag/Service definition
- `submodules/effect/packages/effect/src/Layer.ts` — Layer construction
- `submodules/effect/packages/effect/src/Ref.ts` — Mutable state in Effect
- `submodules/effect/packages/effect/src/Stream.ts` — Progressive data
- `submodules/effect-atom/packages/atom/src/Atom.ts` — React integration

---

## 0. Canonical Effect-TS Patterns (Foundation)

These are the **core Effect-TS patterns** that underpin all effect-atom usage. Master these first.

### 0.1 Context.Tag — Service Definition

**Canonical Source:** `Context.ts:507-524`
**Description:** Defines a service interface with a unique identifier. The Tag is both a type and a value.

```typescript
import { Context, Layer } from 'effect';

// Pattern: class extends Context.Tag<Self>()<Id, Shape>
class MyService extends Context.Tag('app/MyService')<
  MyService,
  {
    readonly doThing: (input: string) => Effect.Effect<number>;
  }
>() {
  // Static layer factory is idiomatic
  static Default = Layer.succeed(this, {
    doThing: (input) => Effect.succeed(input.length),
  });
}
```

**Key Insight:** The `Tag` itself is an `Effect<Service, never, Self>` — you can `yield* MyService` directly in `Effect.gen`.

### 0.2 Context.Reference — Service with Default

**Canonical Source:** `Context.ts:526-585`
**Description:** A Tag with a built-in default value. No provider required if default is acceptable.

```typescript
class SpecialNumber extends Context.Reference<SpecialNumber>()(
  'SpecialNumber',
  { defaultValue: () => 2048 }
) {}

// Usage: No need to provide — uses default
const program = Effect.gen(function* () {
  const num = yield* SpecialNumber;
  console.log(num); // 2048
});
```

### 0.3 Layer.succeed — Synchronous Service

**Canonical Source:** `Layer.ts:772-775`
**Description:** Creates a Layer from a synchronous value. Most common pattern.

```typescript
const MyServiceLive = Layer.succeed(MyService, {
  doThing: (input) => Effect.succeed(input.length),
});
```

### 0.4 Layer.effect — Effectful Service

**Canonical Source:** `Layer.ts:289-292`
**Description:** Creates a Layer from an Effect. Use when construction is effectful.

```typescript
const MyServiceLive = Layer.effect(
  MyService,
  Effect.gen(function* () {
    const config = yield* Config.string('API_URL');
    return {
      doThing: (input) => Effect.succeed(input.length),
    };
  })
);
```

### 0.5 Layer.scoped — Resource-Managed Service

**Canonical Source:** `Layer.ts:727-735`
**Description:** Creates a Layer from a scoped Effect. Resource is acquired on layer build, released on layer teardown.

```typescript
const ConnectionLive = Layer.scoped(
  Connection,
  Effect.acquireRelease(
    Effect.sync(() => createConnection()),
    (conn) => Effect.sync(() => conn.close())
  )
);
```

### 0.6 Ref — Mutable State in Effect

**Canonical Source:** `Ref.ts:27-32, 69-181`
**Description:** Thread-safe mutable reference within Effect. Use for service-internal state.

```typescript
Effect.gen(function* () {
  const ref = yield* Ref.make(0);
  yield* Ref.update(ref, (n) => n + 1);
  const value = yield* Ref.get(ref);
});
```

**Key Operations:**

- `Ref.make(initial)` — Create ref
- `Ref.get(ref)` — Read value
- `Ref.set(ref, value)` — Write value
- `Ref.update(ref, f)` — Transform value
- `Ref.modify(ref, f)` — Transform + return derived value

### 0.7 Stream — Progressive Data

**Canonical Source:** `Stream.ts:52-70`
**Description:** Pull-based stream of values. Emits chunks for efficiency.

**Key Constructors:**

```typescript
// From array
Stream.fromIterable([1, 2, 3]);

// From schedule (ticking)
Stream.fromSchedule(Schedule.spaced('1 second'));

// From async callback (push-based source)
Stream.async<string>((emit) => {
  socket.on('message', (msg) => emit.single(msg));
  return Effect.sync(() => socket.close());
});

// From Effect (single value)
Stream.fromEffect(Effect.succeed(42));
```

**Key Consumers:**

```typescript
// Collect all to array
Stream.runCollect(stream);

// For each (side effects)
Stream.runForEach(stream, (item) => Effect.log(item));

// Fold to single value
Stream.runFold(stream, 0, (acc, n) => acc + n);
```

---

## 1. Core State Primitives (effect-atom)

### 1.1 Primitive Atom (Writable)

**Tag:** `PATTERN:PRIMITIVE_ATOM`
**Canonical Source:** `Atom.ts:458-463` (state function)
**Description:** Basic mutable state wrapper. Returns `Writable<A>` — can be read and written.

```typescript
// Atom.make with non-Effect/Stream value → Writable
export const statusAtom = Atom.make<StreamStatus>('idle');

// Usage
const status = get(statusAtom);
ctx.set(statusAtom, 'streaming');
```

**Breadcrumb:** `src/lib/data-manager/v1/atoms/index.ts:51`

### 1.2 Readable Atom (Derived)

**Tag:** `PATTERN:DERIVED_ATOM`
**Canonical Source:** `Atom.ts:328-338` (readable function)
**Description:** Synchronous derivation from other atoms. Auto-tracks dependencies. Read-only.

```typescript
// Atom.make with (get) => value → Atom<A> (readonly)
export const isSearchingAtom = Atom.make((get) => {
  const status = get(statusAtom);
  return status === 'streaming';
});
```

**Breadcrumb:** `src/lib/data-manager/v1/atoms/index.ts:94`

### 1.3 Result Atom (Effect-backed)

**Tag:** `PATTERN:RESULT_ATOM`
**Canonical Source:** `Atom.ts:370-391` (make with Effect detection)
**Description:** Wraps an Effect execution. Returns `Atom<Result<A, E>>` with `Initial | Success | Failure` states.

```typescript
// Atom.make with Effect → Atom<Result<A, E>>
const dataAtom = Atom.make(
  Effect.gen(function* () {
    yield* Effect.sleep('100 millis');
    return 42;
  })
);

// Access in component
const result = useAtomValue(dataAtom);
if (Result.isSuccess(result)) {
  console.log(result.value); // 42
}
```

**Breadcrumb:** `src/components/testbed/EffectAtomTestbed.tsx:1016`

---

## 2. Service Architecture (effect-atom + Effect)

### 2.1 Runtime Atom

**Tag:** `PATTERN:RUNTIME_ATOM`
**Canonical Source:** `Atom.ts:643-697` (context function, factory)
**Description:** Creates an atom runtime with injected Layers. Spawns atoms with access to services.

```typescript
// Atom.runtime(Layer) → AtomRuntime<R, E>
export const runtimeAtom = Atom.runtime(
  Layer.mergeAll(IdGenerator.Default, SearchKernel.Default, DataManager.Default)
);
```

**Key Methods on AtomRuntime:**

- `runtime.atom(effect)` — Create Result atom with service access
- `runtime.fn<Arg>()((arg, ctx) => effect)` — Create operation atom
- `runtime.pull(stream)` — Create pull-based stream atom

**Breadcrumb:** `src/lib/data-manager/v1/atoms/index.ts:142`

### 2.2 Operation Atom (runtime.fn)

**Tag:** `PATTERN:OPERATION_ATOM`
**Canonical Source:** `Atom.ts:553-588` (fn method on AtomRuntime)
**Description:** Writable atom that executes an Effect when written to. For mutations/actions.

```typescript
// runtime.fn<Arg>()((arg, ctx) => Effect) → AtomResultFn<Arg, A, E>
const searchOp = runtimeAtom.fn<{ query: string; limit: number }>()(
  ({ query, limit }, ctx) =>
    Effect.gen(function* () {
      const kernel = yield* SearchKernel;
      const results = yield* kernel.search(query, limit);

      // Update state atoms
      ctx.set(resultsAtom, results);
      ctx.set(statusAtom, 'complete');

      return results;
    })
);

// Trigger in component
const doSearch = useSetAtom(searchOp);
doSearch({ query: 'hello', limit: 100 });
```

**Breadcrumb:** `src/lib/data-manager/v1/atoms/index.ts:166`

### 2.3 Materialized View Pattern

**Tag:** `PATTERN:MATERIALIZED_VIEW`
**Description:** Separate **State atoms** (readonly views) from **Operation atoms** (write-only actions). Operations update state via `ctx.set()`.

**Structure:**

```
atoms/
├── state/
│   ├── resultsAtom      ← Primitive, readonly from components
│   ├── statusAtom       ← Primitive, readonly from components
│   └── statsAtom        ← Derived from above
└── operations/
    ├── searchOp         ← runtime.fn, writes to state
    └── clearOp          ← runtime.fn, writes to state
```

**Mechanism:**

1. Define state atoms (primitives)
2. Define operation atoms via `runtime.fn`
3. Inside operations, use `ctx.set(stateAtom, value)` to update views

**Breadcrumb:** `src/lib/data-manager/v1/atoms/index.ts:34`

---

## 3. Data Flow Patterns

### 3.1 Stream-to-Atom

**Tag:** `PATTERN:STREAM_ATOM`
**Canonical Source:** `Atom.ts:732-809` (makeStream function)
**Description:** Binding a Stream to an atom. Updates progressively as stream emits.

```typescript
// Atom.make with Stream → Atom<Result<A, E>>
const tickerAtom = Atom.make(
  Stream.fromSchedule(Schedule.spaced('1 second')).pipe(
    Stream.scan(0, (n) => n + 1)
  )
);
```

**Breadcrumb:** `src/components/testbed/EffectAtomTestbed.tsx:1041`

### 3.2 Progressive Accumulation

**Tag:** `PATTERN:PROGRESSIVE_ACCUMULATION`
**Description:** Manually accumulating stream results into an atom for progressive UI.

```typescript
const searchOp = runtimeAtom.fn<string>()((query, ctx) =>
  Effect.gen(function* () {
    const stream = yield* SearchKernel.pipe(
      Effect.flatMap((k) => k.searchStream(query))
    );

    ctx.set(statusAtom, 'streaming');
    ctx.set(resultsAtom, []);

    yield* Stream.runForEach(stream, (item) =>
      Effect.sync(() => {
        const prev = ctx.get(resultsAtom);
        ctx.set(resultsAtom, [...prev, item]);
      })
    );

    ctx.set(statusAtom, 'complete');
  })
);
```

**Breadcrumb:** `src/lib/data-manager/v1/atoms/index.ts:206`

### 3.3 Atom Family

**Tag:** `PATTERN:ATOM_FAMILY`
**Canonical Source:** `Atom.ts:1316-1351` (family function)
**Description:** Dynamic atom creation keyed by argument. Stable references via WeakRef.

```typescript
// Atom.family((key) => Atom) → (key) => Atom
const itemAtom = Atom.family((id: string) =>
  Atom.make(
    Effect.gen(function* () {
      const api = yield* ApiClient;
      return yield* api.fetchItem(id);
    })
  )
);

// Usage — same id returns same atom instance
const item1 = itemAtom('abc');
const item2 = itemAtom('abc');
console.log(item1 === item2); // true
```

**Breadcrumb:** `src/components/testbed/EffectAtomTestbed.tsx:1026`

### 3.4 Pull-based Stream (runtime.pull)

**Tag:** `PATTERN:PULL_STREAM`
**Canonical Source:** `Atom.ts:1199-1212, 1214-1302` (pull function)
**Description:** Demand-driven stream consumption. Accumulates items, pulls on write.

```typescript
const paginatedAtom = runtimeAtom.pull(
  Stream.fromIterable(largeDataset).pipe(Stream.rechunk(50))
);

// Usage
const data = useAtomValue(paginatedAtom);
const pullMore = useSetAtom(paginatedAtom);

// Pull next chunk
pullMore();
```

---

## 4. Lifecycle Patterns

### 4.1 keepAlive

**Tag:** `PATTERN:KEEP_ALIVE`
**Canonical Source:** `Atom.ts:1405-1409`
**Description:** Prevents atom disposal when no subscribers. Use for long-lived services.

```typescript
export const runtimeAtom = Atom.keepAlive(Atom.runtime(ServiceLayer));
```

### 4.2 autoDispose (default)

**Tag:** `PATTERN:AUTO_DISPOSE`
**Canonical Source:** `Atom.ts:1420-1424`
**Description:** Atom disposes when no subscribers. Default behavior.

### 4.3 setIdleTTL

**Tag:** `PATTERN:IDLE_TTL`
**Canonical Source:** `Atom.ts:1459-1473`
**Description:** Dispose atom after idle duration (no subscribers).

```typescript
const cachedAtom = Atom.setIdleTTL(Atom.make(expensiveFetch), '5 minutes');
```

---

## 5. Anti-Patterns (Avoid)

### 5.1 Unconditional Subscription

**Tag:** `ANTIPATTERN:UNCONDITIONAL_SUB`
**Description:** Calling `useAtomValue(streamAtom)` unconditionally in a component that re-renders frequently. Causes restart loops.
**Fix:** Guard subscription or move to stable parent.

### 5.2 Render Tracking via Atom

**Tag:** `ANTIPATTERN:ATOM_RENDER_TRACKING`
**Description:** Updating an atom inside `useEffect` to track render counts. Infinite loops.
**Fix:** Use `useRef` for metrics that don't drive UI.

### 5.3 Raw Promise in Atom

**Tag:** `ANTIPATTERN:RAW_PROMISE`
**Description:** Passing a raw Promise to `Atom.make`. No cancellation, no error typing.
**Fix:** Wrap in `Effect.promise(() => ...)`.

### 5.4 useState for Cross-Component State

**Tag:** `ANTIPATTERN:USESTATE_CROSSBOUND`
**Description:** Using `useState` for state shared across components or derived from Effects.
**Fix:** Use effect-atom primitives. See "useState → effect-atom Migration" in CLAUDE.md.

### 5.5 Atoms Inside Components

**Tag:** `ANTIPATTERN:ATOMS_IN_COMPONENT`
**Description:** Defining atoms inside a component body. Recreates on every render.
**Fix:** Define atoms at module level or use `useMemo` with empty deps.

```typescript
// WRONG
function MyComponent() {
  const atom = Atom.make(0); // New atom every render!
  return <div>{useAtomValue(atom)}</div>;
}

// CORRECT
const countAtom = Atom.make(0); // Module level
function MyComponent() {
  return <div>{useAtomValue(countAtom)}</div>;
}
```

---

## 6. Quick Reference

| Need               | Pattern                     | Example                                 |
| ------------------ | --------------------------- | --------------------------------------- |
| Simple UI state    | `Atom.make(value)`          | `Atom.make(false)`                      |
| Derived value      | `Atom.make((get) => ...)`   | `Atom.make((get) => get(a) + get(b))`   |
| Async data         | `Atom.make(Effect)`         | `Atom.make(Effect.promise(fetch))`      |
| Service access     | `Atom.runtime(Layer)`       | `Atom.runtime(MyService.Default)`       |
| Mutation/action    | `runtime.fn<Arg>()`         | `runtime.fn<string>()((q, ctx) => ...)` |
| Progressive stream | `runtime.pull(Stream)`      | `runtime.pull(largeStream)`             |
| Keyed atoms        | `Atom.family((key) => ...)` | `Atom.family((id) => Atom.make(...))`   |
| Long-lived         | `Atom.keepAlive(atom)`      | `Atom.keepAlive(runtimeAtom)`           |

---

## 7. Canonical Source Locations

| Concept           | File                      | Line Range |
| ----------------- | ------------------------- | ---------- |
| Context.Tag       | `effect/src/Context.ts`   | 507-524    |
| Context.Reference | `effect/src/Context.ts`   | 526-585    |
| Layer.succeed     | `effect/src/Layer.ts`     | 772-775    |
| Layer.effect      | `effect/src/Layer.ts`     | 289-292    |
| Layer.scoped      | `effect/src/Layer.ts`     | 727-735    |
| Layer.mergeAll    | `effect/src/Layer.ts`     | 583-589    |
| Ref.make          | `effect/src/Ref.ts`       | 69         |
| Ref operations    | `effect/src/Ref.ts`       | 75-174     |
| Stream (overview) | `effect/src/Stream.ts`    | 52-70      |
| Stream.async      | `effect/src/Stream.ts`    | 316-362    |
| Atom.make         | `effect-atom/src/Atom.ts` | 370-391    |
| Atom.readable     | `effect-atom/src/Atom.ts` | 328-338    |
| Atom.writable     | `effect-atom/src/Atom.ts` | 344-356    |
| Atom.runtime      | `effect-atom/src/Atom.ts` | 643-715    |
| AtomRuntime.fn    | `effect-atom/src/Atom.ts` | 553-588    |
| Atom.family       | `effect-atom/src/Atom.ts` | 1316-1351  |
| Atom.pull         | `effect-atom/src/Atom.ts` | 1199-1212  |
