# Genifer Effect Fork — Product Requirements Document

## Overview

This is a fully effectual rewrite of the genifer library, replacing Zod with Effect Schema and leveraging the full breadth of Effect-TS primitives for a robust, type-safe, stream-based UI rendering system.

## Design Philosophy

**ALL functions return Effects.** No sync shortcuts. This ensures:
- Consistent error handling throughout
- Composable operations
- Proper resource management
- Cancellation support everywhere

## Architecture

### Core Modules

```
src/lib/genifer/core/
├── schemas.ts      # Effect Schema definitions, decoders, type guards
├── path.ts         # JSON Pointer utilities as Effects
├── visibility.ts   # Visibility evaluation with Effect.Match
├── actions.ts      # Action execution with Fiber/Ref/PubSub/Queue
├── validation.ts   # Field validation pipelines
├── streaming.ts    # Stream-based UI rendering
└── index.ts        # Barrel export
```

## Effect Patterns Employed

### 1. Effect Schema (schemas.ts)

**Replaces Zod with Effect Schema for:**
- Runtime validation
- Type inference
- Discriminated unions via `Schema.TaggedClass`
- Branded types where appropriate

```typescript
// Tagged class for discriminated unions
export class PathCondition extends Schema.TaggedClass<PathCondition>()("PathCondition", {
  path: Schema.String
}) {}

// Schema.Class with methods
export class UITree extends Schema.Class<UITree>("UITree")({
  root: Schema.String,
  elements: Schema.Record({ key: Schema.String, value: UIElement })
}) {
  static empty(): UITree { /* ... */ }
  getElement(key: string): UIElement | undefined { /* ... */ }
  setElement(key: string, element: UIElement): UITree { /* ... */ }
}

// Decoders for boundary validation
export const decodeJsonPatch = Schema.decodeUnknown(JsonPatch)
```

### 2. Data.TaggedError (path.ts, actions.ts)

**Typed errors for Effect's error channel:**

```typescript
export class PathNotFoundError extends Data.TaggedError("PathNotFoundError")<{
  readonly path: string
  readonly reason: string
}> {}

export class ActionExecutionError extends Data.TaggedError("ActionExecutionError")<{
  readonly name: string
  readonly cause: unknown
}> {}
```

### 3. Effect.Match (visibility.ts)

**Exhaustive pattern matching on tagged unions:**

```typescript
export const evaluateLogicExpression = (
  expr: LogicExpression,
  ctx: VisibilityContext
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    return yield* pipe(
      Match.value(expr),
      Match.when((e): e is PathCondition => e._tag === "PathCondition",
        (e) => /* ... */),
      Match.when((e): e is EqCondition => e._tag === "EqCondition",
        (e) => /* ... */),
      // ... all condition types
      Match.exhaustive
    )
  })
```

### 4. Deferred (actions.ts)

**Suspends execution for confirmation dialogs:**

```typescript
const requestConfirmation = (action: ResolvedAction): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const deferred = yield* Deferred.make<boolean>()
    yield* Ref.update(stateRef, (s) => ({
      ...s,
      pendingConfirmation: Option.some({ action, deferred })
    }))
    // Suspends fiber until user confirms/cancels
    const confirmed = yield* Deferred.await(deferred)
    return confirmed
  })
```

### 5. Fiber (actions.ts, streaming.ts)

**Cancellable action handlers and stream processing:**

```typescript
// Fork action for cancellation support
const fiber = yield* Effect.fork(handler(action.params))

// Track fiber for later cancellation
yield* Ref.update(stateRef, (s) => {
  const newFibers = new Map(s.runningFibers)
  newFibers.set(action.name, fiber)
  return { ...s, runningFibers: newFibers }
})

// Wait for completion
const exit = yield* Fiber.await(fiber)
```

### 6. Ref (actions.ts, streaming.ts)

**State management for action service:**

```typescript
const stateRef = yield* Ref.make<ActionState>({
  pendingConfirmation: Option.none(),
  runningFibers: new Map(),
  executionCount: 0
})

// Atomic updates
yield* Ref.update(stateRef, (s) => ({
  ...s,
  executionCount: s.executionCount + 1
}))
```

### 7. PubSub (actions.ts)

**Broadcasting action results:**

```typescript
const resultsPubSub = yield* PubSub.bounded<ActionResult>(16)

// Publish results
yield* PubSub.publish(resultsPubSub, {
  _tag: "Success",
  name: action.name,
  result: exit.value
})

// Subscribe (requires Scope)
const subscribe = (): Effect.Effect<Queue.Dequeue<ActionResult>, never, Scope.Scope> =>
  PubSub.subscribe(resultsPubSub)
```

### 8. Queue (actions.ts)

**Action request ordering:**

```typescript
const actionQueue = yield* Queue.bounded<ResolvedAction>(32)
```

### 9. Effect.Stream (streaming.ts)

**Progressive UI rendering with backpressure:**

```typescript
export const processPatches = (
  patchStream: Stream.Stream<JsonPatch, Error>,
  options: UIStreamOptions = {}
): Stream.Stream<UITree, Error> => {
  return pipe(
    patchStream,
    Stream.grouped(chunkSize),           // Batch updates
    Stream.throttle({                     // Rate limiting
      cost: () => 1,
      duration: Duration.millis(debounceMs),
      units: 1
    }),
    Stream.scan(UITree.empty(), (tree, patches) =>  // Accumulate
      Effect.runSync(applyPatches(tree, patches))
    )
  )
}
```

### 10. Stream.async (streaming.ts)

**Bridge from fetch to Effect.Stream:**

```typescript
export const streamFromFetch = (
  url: string,
  body: unknown,
  signal?: AbortSignal
): Stream.Stream<JsonPatch, Error> =>
  Stream.async<JsonPatch, Error>((emit) => {
    const run = async () => {
      const response = await fetch(url, { /* ... */ })
      const reader = response.body?.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // Parse NDJSON and emit patches
        emit(Effect.succeed(Chunk.of(patch)))
      }
      emit(Effect.fail(Option.none())) // Signal completion
    }
    run()
  }, { bufferSize: 32 })
```

## Type System

### Core Types

| Type | Description |
|------|-------------|
| `UIElement` | Single UI element with key, type, props, children |
| `UITree` | Root + element map with methods |
| `DataModel` | Nested data structure for path resolution |
| `Action` | Named action with params, confirm, handlers |
| `LogicExpression` | Tagged union for visibility conditions |
| `JsonPatch` | Patch operations (set, add, replace, remove) |

### Error Types

| Error | When |
|-------|------|
| `PathNotFoundError` | Path doesn't exist in data model |
| `InvalidPathError` | Malformed JSON Pointer |
| `ActionNotFoundError` | Unknown action name |
| `ActionExecutionError` | Action handler threw |
| `ActionCancelledError` | User cancelled confirmation |
| `ActionValidationError` | Invalid action input |

## Usage Examples

### Path Resolution

```typescript
import { getByPath, resolveDynamicValue, interpolateString } from "./core"

// Get value (can fail)
const value = yield* getByPath(dataModel, "/user/name")

// Get value or undefined (never fails)
const maybeValue = yield* resolveDynamicValue({ path: "/user/name" }, dataModel)

// Interpolate template
const message = yield* interpolateString("Hello ${user/name}!", dataModel)
```

### Visibility Evaluation

```typescript
import { evaluateVisibility, visibility } from "./core"

// Build condition
const condition = yield* visibility.and(
  yield* visibility.when("/user/isAdmin"),
  yield* visibility.eq({ path: "/settings/theme" }, "dark")
)

// Evaluate
const isVisible = yield* evaluateVisibility(condition, { dataModel })
```

### Action Execution

```typescript
import { makeActionService, Action } from "./core"

const service = yield* makeActionService({
  handlers: {
    saveUser: (params) => Effect.gen(function* () {
      // Save logic...
      return { success: true }
    })
  },
  setData: (path, value) => Effect.succeed(void 0)
})

// Execute action
yield* service.execute(
  new Action({
    name: "saveUser",
    params: { id: "123" },
    confirm: { title: "Confirm", message: "Save user?" }
  }),
  dataModel
)

// UI calls these when user responds to confirmation
yield* service.confirm()  // or
yield* service.cancel()
```

### Streaming UI

```typescript
import { makeUIStream } from "./core"

const stream = yield* makeUIStream("/api/render")

// Send prompt and stream updates
yield* stream.send("Create a form with name and email fields")

// React subscribes to tree changes
const tree = yield* stream.getTree()
const isStreaming = yield* stream.isStreaming()

// Cancel if needed
yield* stream.cancel()
```

### Validation

```typescript
import { runValidation, checkBuilder, ValidationConfig, ValidationCheck } from "./core"

const config = new ValidationConfig({
  checks: [
    yield* checkBuilder.required("Name is required"),
    yield* checkBuilder.minLength(2, "Name must be at least 2 characters")
  ],
  validateOn: "blur"
})

const result = yield* runValidation(config, {
  value: "Jo",
  dataModel,
  customFunctions: {
    isUnique: (value) => /* async check... */ true
  }
})
// { valid: true, errors: [], checks: [...] }
```

## Design Decisions

### Why Schema.Class over interfaces?

Schema.Class provides:
1. Runtime validation via `Schema.decodeUnknown`
2. Methods on schema types (e.g., `UITree.empty()`)
3. Proper branded types for type safety
4. Integration with EventLog for observability

### Why TaggedClass for conditions?

Enables exhaustive pattern matching with `Effect.Match`:
- Compile-time guarantee all cases handled
- Clear discriminator (`_tag`) for each variant
- Type narrowing within each branch

### Why recursive Schema.suspend?

`LogicExpression` is recursive (AND/OR contain LogicExpression[]):
```typescript
const LogicExpression = Schema.suspend((): Schema.Schema<LogicExpression> =>
  Schema.Union(
    PathCondition,
    AndCondition,  // contains LogicExpression[]
    OrCondition,   // contains LogicExpression[]
    // ...
  )
)
```

### Why Deferred for confirmations?

Deferred allows suspending the action fiber until the user responds, without polling or callbacks. The fiber simply awaits the Deferred and resumes when `confirm()` or `cancel()` is called.

### Why PubSub over callbacks?

PubSub provides:
- Multiple subscribers (UI + logging + analytics)
- Backpressure with bounded buffer
- Proper resource cleanup via Scope
- Decoupled producers and consumers

## Migration from Zod Version

| Zod Pattern | Effect Pattern |
|-------------|----------------|
| `z.object({})` | `Schema.Struct({})` or `Schema.Class` |
| `z.string()` | `Schema.String` |
| `z.parse()` | `Schema.decodeUnknown()` |
| `z.infer<typeof schema>` | `Schema.Schema.Type<typeof schema>` |
| `z.discriminatedUnion()` | `Schema.Union` + `Schema.TaggedClass` |

## Future Enhancements

1. **React Integration** — Hooks that subscribe to atoms/streams
2. **Catalog System** — Component registry with Schema validation
3. **EventLog Integration** — Structured logging via Schema
4. **Effect Layer** — Service composition for DI
5. **Test Utilities** — Effect.gen-based test helpers

## File Reference

- `schemas.ts:1-390` — All schema definitions
- `path.ts:1-211` — Path utilities
- `visibility.ts:1-271` — Visibility evaluation
- `actions.ts:1-484` — Action system
- `validation.ts:1-390` — Validation system
- `streaming.ts:1-447` — Streaming renderer
