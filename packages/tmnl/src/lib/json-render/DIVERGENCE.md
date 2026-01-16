# JSON-Render: Original vs Effect Fork — Divergence Analysis

## Core Mechanism Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ORIGINAL JSON-RENDER MECHANISM                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│   │    Zod      │────▶│   Sync      │────▶│  Plain JS   │                   │
│   │   Schema    │     │  Functions  │     │   Objects   │                   │
│   └─────────────┘     └─────────────┘     └─────────────┘                   │
│         │                   │                   │                            │
│         │                   │                   │                            │
│         ▼                   ▼                   ▼                            │
│   z.object({})       function foo()      { path: "/x" }                     │
│   z.union([])        return value        { and: [...] }                     │
│   z.lazy(() =>)      throw error         { eq: [a, b] }                     │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     REACT LAYER                                       │   │
│   │                                                                       │   │
│   │   DataProvider ──────▶ useState() + setByPath()                      │   │
│   │   ActionProvider ────▶ Promise<void> + resolve/reject callbacks     │   │
│   │   VisibilityProvider ▶ useContext() + sync evaluation               │   │
│   │   ValidationProvider ▶ useContext() + sync validation               │   │
│   │                                                                       │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Confirmation Flow:                                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  execute() → new Promise((resolve, reject) => {                      │   │
│   │    setPendingConfirmation({ resolve, reject })                       │   │
│   │  }).then(() => executeAction())                                      │   │
│   │                                                                       │   │
│   │  confirm() → pendingConfirmation.resolve()                          │   │
│   │  cancel()  → pendingConfirmation.reject()                           │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

                                    ▼ ▼ ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                      EFFECT FORK MECHANISM                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│   │   Effect    │────▶│   Effect    │────▶│   Tagged    │                   │
│   │   Schema    │     │   Returns   │     │   Classes   │                   │
│   └─────────────┘     └─────────────┘     └─────────────┘                   │
│         │                   │                   │                            │
│         │                   │                   │                            │
│         ▼                   ▼                   ▼                            │
│   Schema.Struct()    Effect.gen()        PathCondition                      │
│   Schema.Union()     yield* foo()        EqCondition                        │
│   Schema.suspend()   Effect.fail()       AndCondition                       │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     EFFECT PRIMITIVES                                 │   │
│   │                                                                       │   │
│   │   Ref<State> ────────▶ Atomic state management                       │   │
│   │   Deferred<bool> ────▶ Fiber suspension for confirm                  │   │
│   │   Fiber ─────────────▶ Cancellable computation                       │   │
│   │   PubSub<Result> ────▶ Multi-subscriber broadcasting                 │   │
│   │   Queue<Action> ─────▶ Ordered processing with backpressure          │   │
│   │   Stream<Patch> ─────▶ Progressive rendering                         │   │
│   │                                                                       │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Confirmation Flow:                                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  execute() → Effect.gen(function* () {                               │   │
│   │    const deferred = yield* Deferred.make<boolean>()                  │   │
│   │    yield* Ref.update(state, s => ({ ...s, pending: deferred }))      │   │
│   │    const confirmed = yield* Deferred.await(deferred)  ◀── SUSPEND    │   │
│   │    if (!confirmed) return yield* Effect.fail(CancelledError)         │   │
│   │    yield* Effect.fork(handler(params))                               │   │
│   │  })                                                                   │   │
│   │                                                                       │   │
│   │  confirm() → Deferred.succeed(deferred, true)                        │   │
│   │  cancel()  → Deferred.succeed(deferred, false)                       │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Divergence Matrix

| Aspect | Original | Effect Fork | Why Different |
|--------|----------|-------------|---------------|
| **Schema System** | Zod (`z.object`, `z.union`) | Effect Schema (`Schema.Struct`, `Schema.TaggedClass`) | Native Effect integration, `_tag` for exhaustive matching |
| **Return Types** | `T \| undefined`, `void` | `Effect<T, E, R>` | Explicit error channel, composability |
| **Error Handling** | `throw new Error()` | `Data.TaggedError` | Typed errors, recoverable |
| **Pattern Matching** | `if ("path" in expr)` | `Match.exhaustive` | Compile-time guarantee all cases handled |
| **State (React)** | `useState()` | `Ref.make()` | Atomic, works outside React |
| **State Updates** | `setState(prev => ...)` | `Ref.update()` | Transactional, Effect-native |
| **Confirmation** | `Promise + resolve/reject` | `Deferred.make() + await` | Fiber suspension, no callback nesting |
| **Cancellation** | `AbortController` (manual) | `Fiber.interrupt()` | Built-in, propagates through tree |
| **Broadcasting** | N/A (callbacks) | `PubSub.bounded()` | Multiple subscribers, backpressure |
| **Ordering** | N/A | `Queue.bounded()` | FIFO with backpressure |
| **Streaming** | Custom async/NDJSON | `Stream.async()` + operators | Chunking, throttling, scan built-in |
| **Visibility Eval** | Sync `boolean` | `Effect<boolean, never>` | Consistent with rest of system |
| **Validation** | Sync `ValidationResult` | `Effect<ValidationResult, never>` | Composable, async-ready |
| **Type Guards** | `"path" in expr` | `Schema.is(PathCondition)` | Schema-derived |

## Data Flow Divergence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ORIGINAL DATA FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   User Input                                                                 │
│       │                                                                      │
│       ▼                                                                      │
│   onChange(value)                                                           │
│       │                                                                      │
│       ▼                                                                      │
│   DataProvider.set(path, value) ─────▶ useState setter                      │
│       │                                ┌─────────────────┐                  │
│       │                                │ React re-render │                  │
│       │                                └─────────────────┘                  │
│       ▼                                        │                            │
│   Visibility re-evaluated (sync) ◀─────────────┘                            │
│       │                                                                      │
│       ▼                                                                      │
│   Validation re-run (sync)                                                  │
│       │                                                                      │
│       ▼                                                                      │
│   UI Updated                                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          EFFECT FORK DATA FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   User Input                                                                 │
│       │                                                                      │
│       ▼                                                                      │
│   onChange(value)                                                           │
│       │                                                                      │
│       ▼                                                                      │
│   yield* Ref.update(dataRef, setByPath(...))                                │
│       │                                                                      │
│       ├──────────────────────────────────────────┐                          │
│       │                                          │                          │
│       ▼                                          ▼                          │
│   yield* evaluateVisibility(...)          yield* runValidation(...)         │
│       │                                          │                          │
│       │    ┌─────────────────────────────────────┤                          │
│       │    │                                     │                          │
│       ▼    ▼                                     ▼                          │
│   PubSub.publish(visibilityChanged)    PubSub.publish(validationResult)     │
│       │                                          │                          │
│       └──────────────┬───────────────────────────┘                          │
│                      │                                                       │
│                      ▼                                                       │
│              Atom subscribers notified                                       │
│                      │                                                       │
│                      ▼                                                       │
│              React re-render (via useAtomValue)                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Streaming Divergence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ORIGINAL STREAMING (useUIStream hook)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   send(prompt)                                                              │
│       │                                                                      │
│       ▼                                                                      │
│   fetch(url, { body, signal })                                              │
│       │                                                                      │
│       ▼                                                                      │
│   reader.read() in while(true) loop                                         │
│       │                                                                      │
│       ▼                                                                      │
│   parsePatchLine(line)  ─────▶ JSON.parse (no schema validation)            │
│       │                                                                      │
│       ▼                                                                      │
│   applyPatch(tree, patch) ───▶ Mutable: tree.elements[key] = ...            │
│       │                                                                      │
│       ▼                                                                      │
│   setTree({ ...currentTree }) ─▶ useState setter                            │
│                                                                              │
│   Cancellation: abortControllerRef.current?.abort()                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    EFFECT FORK STREAMING                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   yield* stream.send(prompt)                                                │
│       │                                                                      │
│       ▼                                                                      │
│   Stream.async<JsonPatch, Error>((emit) => { fetch... })                    │
│       │                                                                      │
│       ▼                                                                      │
│   Schema.decodeSync(JsonPatch)(raw) ◀─── BOUNDARY VALIDATION                │
│       │                                                                      │
│       ▼                                                                      │
│   Stream.grouped(chunkSize) ──────────▶ Batch updates                       │
│       │                                                                      │
│       ▼                                                                      │
│   Stream.throttle({ duration: 16ms }) ▶ Rate limit for 60fps                │
│       │                                                                      │
│       ▼                                                                      │
│   Stream.scan(UITree.empty(), applyPatches)                                 │
│       │                                                                      │
│       │   applyPatch returns: new UITree({ ...tree, elements: {...} })      │
│       │                       ▲                                              │
│       │                       └── IMMUTABLE via Schema.Class methods        │
│       ▼                                                                      │
│   yield* Ref.set(treeRef, newTree)                                          │
│                                                                              │
│   Cancellation: yield* Fiber.interrupt(currentFiber)                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Visibility Evaluation Divergence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ORIGINAL VISIBILITY                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   evaluateLogicExpression(expr, ctx): boolean                               │
│       │                                                                      │
│       ▼                                                                      │
│   if ("and" in expr) {                                                      │
│     return expr.and.every(e => evaluateLogicExpression(e, ctx))             │
│   }                                                                          │
│   if ("or" in expr) { ... }                                                 │
│   if ("not" in expr) { ... }                                                │
│   if ("path" in expr) { ... }                                               │
│   if ("eq" in expr) { ... }                                                 │
│   // etc...                                                                  │
│   return false  ◀─── DEFAULT FALLTHROUGH (not exhaustive)                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    EFFECT FORK VISIBILITY                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   evaluateLogicExpression(expr, ctx): Effect<boolean, never>                │
│       │                                                                      │
│       ▼                                                                      │
│   pipe(                                                                      │
│     Match.value(expr),                                                      │
│     Match.when((e): e is PathCondition => e._tag === "PathCondition",       │
│       (e) => Effect.gen(function* () {                                      │
│         const value = yield* getByPathOrUndefined(data, e.path)             │
│         return Boolean(value)                                               │
│       })                                                                     │
│     ),                                                                       │
│     Match.when((e): e is EqCondition => e._tag === "EqCondition", ...),     │
│     Match.when((e): e is AndCondition => e._tag === "AndCondition", ...),   │
│     // ... all variants                                                      │
│     Match.exhaustive  ◀─── COMPILE-TIME GUARANTEE                           │
│   )                                                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Action Execution Divergence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ORIGINAL ACTION EXECUTION                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ActionProvider (React Context):                                            │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  const [pendingConfirmation, setPendingConfirmation] = useState()    │   │
│   │  const [loadingActions, setLoadingActions] = useState(new Set())     │   │
│   │  const [handlers, setHandlers] = useState({})                        │   │
│   │                                                                       │   │
│   │  execute = async (action) => {                                       │   │
│   │    if (resolved.confirm) {                                           │   │
│   │      return new Promise((resolve, reject) => {                       │   │
│   │        setPendingConfirmation({                                      │   │
│   │          action: resolved,                                           │   │
│   │          resolve: () => { setPending(null); resolve() },             │   │
│   │          reject: () => { setPending(null); reject() }                │   │
│   │        })                                                             │   │
│   │      }).then(() => executeAction(ctx))                               │   │
│   │    }                                                                  │   │
│   │    await executeAction(ctx)                                          │   │
│   │  }                                                                    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Problems:                                                                  │
│   - No cancellation of in-flight actions                                    │
│   - No broadcasting (only caller knows result)                              │
│   - No backpressure (can spam actions)                                      │
│   - Promise chain for confirmation (callback hell adjacent)                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    EFFECT FORK ACTION EXECUTION                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   makeActionService(config): Effect<ActionService, never>                   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  const stateRef = yield* Ref.make<ActionState>({                     │   │
│   │    pendingConfirmation: Option.none(),                               │   │
│   │    runningFibers: new Map(),                                         │   │
│   │    executionCount: 0                                                 │   │
│   │  })                                                                   │   │
│   │  const resultsPubSub = yield* PubSub.bounded<ActionResult>(16)       │   │
│   │  const actionQueue = yield* Queue.bounded<ResolvedAction>(32)        │   │
│   │                                                                       │   │
│   │  executeResolved = (action) => Effect.gen(function* () {             │   │
│   │    if (action.confirm) {                                             │   │
│   │      const deferred = yield* Deferred.make<boolean>()                │   │
│   │      yield* Ref.update(state, s => ({ ...s, pending: deferred }))    │   │
│   │      const confirmed = yield* Deferred.await(deferred) // SUSPEND    │   │
│   │      if (!confirmed) {                                                │   │
│   │        yield* PubSub.publish(pubsub, { _tag: "Cancelled", ... })     │   │
│   │        return yield* Effect.fail(ActionCancelledError)               │   │
│   │      }                                                                │   │
│   │    }                                                                  │   │
│   │    const fiber = yield* Effect.fork(handler(params))                 │   │
│   │    yield* Ref.update(state, s => ({ fibers: s.fibers.set(name, f) }))│   │
│   │    const exit = yield* Fiber.await(fiber)                            │   │
│   │    yield* PubSub.publish(pubsub, exitToResult(exit))                 │   │
│   │  })                                                                   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Benefits:                                                                  │
│   ✓ Cancellation via Fiber.interrupt()                                      │
│   ✓ Broadcasting via PubSub (UI + logging + analytics)                      │
│   ✓ Backpressure via Queue.bounded()                                        │
│   ✓ Clean suspension via Deferred (no callback nesting)                     │
│   ✓ Typed errors via Data.TaggedError                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Summary Table

| Feature | Original | Effect Fork | Improvement |
|---------|----------|-------------|-------------|
| Schema validation | Runtime (Zod) | Runtime (Effect Schema) | Native Effect integration |
| Error typing | `throw Error` | `Data.TaggedError` | Recoverable, typed |
| Pattern matching | if/else chains | `Match.exhaustive` | Compile-time safety |
| State management | React useState | Effect Ref | Works outside React |
| Async coordination | Promise callbacks | Deferred | Fiber suspension |
| Cancellation | Manual AbortController | Fiber.interrupt | Automatic propagation |
| Result broadcasting | None | PubSub | Multi-subscriber |
| Action ordering | None | Queue | Backpressure |
| Stream processing | Manual while loop | Stream operators | Chunking, throttling |
| Immutability | Partial (spread) | Schema.Class methods | Enforced |

## What's NOT in the Fork (React Layer)

The Effect fork covers the **core** package. The **React** integration would need:

```typescript
// Future: src/lib/json-render/react/
├── atoms.ts          // Atom-based state (replaces DataProvider)
├── hooks.ts          // useUIStream, useVisibility, useValidation
├── renderer.tsx      // <Renderer tree={...} registry={...} />
└── contexts/         // Optional: context wrappers for atoms
```

The React layer would use `effect-atom` to bridge Effect → React:
- `Atom.make<UITree>()` instead of `useState<UITree>()`
- `useAtomValue(treeAtom)` for subscriptions
- `runtimeAtom.fn()` for Effect-returning operations
