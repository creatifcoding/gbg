# JSON-Render Effect Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              JSON-RENDER EFFECT                              │
│                      Fully Effectual UI Rendering System                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                 DATA FLOW                                    │
│                                                                              │
│   ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐       │
│   │  Prompt  │─────▶│  Stream  │─────▶│  Patch   │─────▶│  UITree  │       │
│   │   API    │      │  Parser  │      │  Apply   │      │  State   │       │
│   └──────────┘      └──────────┘      └──────────┘      └──────────┘       │
│        │                 │                 │                 │              │
│        │           Effect.Stream     Effect.gen       Schema.Class          │
│        │           Stream.async      UITree.set*      with methods          │
│        │                                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Module Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CORE MODULE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         schemas.ts                                    │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │    │
│  │  │  UIElement  │ │   UITree    │ │   Action    │ │  JsonPatch  │   │    │
│  │  │ Schema.Class│ │Schema.Class │ │Schema.Class │ │Schema.Class │   │    │
│  │  │ +key,type,  │ │ +root       │ │ +name       │ │ +op,path    │   │    │
│  │  │  props,     │ │ +elements   │ │ +params     │ │ +value      │   │    │
│  │  │  children   │ │ +methods    │ │ +confirm    │ │             │   │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │    │
│  │                                                                      │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │              LogicExpression (Tagged Union)                    │  │    │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │  │    │
│  │  │  │  Path  │ │   Eq   │ │   Gt   │ │  And   │ │  Not   │ ... │  │    │
│  │  │  │Conditionn│ │Condition│ │Condition│ │Condition│ │Condition│      │  │    │
│  │  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘      │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                          path.ts                                      │    │
│  │                                                                       │    │
│  │   getByPath ───────────▶ Effect<unknown, PathNotFoundError>          │    │
│  │   getByPathOrUndefined ─▶ Effect<unknown, never>                     │    │
│  │   setByPath ───────────▶ Effect<T, never>                            │    │
│  │   resolveDynamicValue ──▶ Effect<T | undefined, never>               │    │
│  │   interpolateString ───▶ Effect<string, never>                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       visibility.ts                                   │    │
│  │                                                                       │    │
│  │   evaluateLogicExpression ──▶ Effect<boolean, never>                 │    │
│  │        │                                                              │    │
│  │        └─── Effect.Match.exhaustive ─┬─▶ PathCondition               │    │
│  │                                       ├─▶ EqCondition                │    │
│  │                                       ├─▶ AndCondition (recursive)   │    │
│  │                                       ├─▶ OrCondition (recursive)    │    │
│  │                                       └─▶ NotCondition (recursive)   │    │
│  │                                                                       │    │
│  │   visibility.when("/path") ───▶ Effect<PathCondition, never>         │    │
│  │   visibility.and(...) ────────▶ Effect<AndCondition, never>          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        validation.ts                                  │    │
│  │                                                                       │    │
│  │   builtInValidationFunctions: Record<string, SyncValidationFunction> │    │
│  │     ├── required, email, minLength, maxLength                        │    │
│  │     ├── pattern, min, max, numeric, url                              │    │
│  │     └── matches, oneOf, phone, alphanumeric                          │    │
│  │                                                                       │    │
│  │   runValidationCheck ─▶ Effect<ValidationCheckResult, never>         │    │
│  │   runValidation ──────▶ Effect<ValidationResult, never>              │    │
│  │   runAllValidations ──▶ Effect<Map<string, ValidationResult>, never> │    │
│  │                                                                       │    │
│  │   checkBuilder.required() ──▶ Effect<ValidationCheck, never>         │    │
│  │   checkBuilder.email() ─────▶ Effect<ValidationCheck, never>         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Action Execution Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ACTION SERVICE                                      │
│                         (actions.ts)                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  makeActionService(config) ─▶ Effect<ActionService, never>                  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        INTERNAL STATE                                   │  │
│  │                                                                         │  │
│  │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │  │
│  │   │   Ref<State>    │  │ PubSub<Result>  │  │Queue<Resolved>  │       │  │
│  │   │                 │  │                 │  │                 │       │  │
│  │   │ pendingConfirm  │  │ Success/Fail/  │  │ Action ordering │       │  │
│  │   │ runningFibers   │  │ Cancelled      │  │ and rate limit  │       │  │
│  │   │ executionCount  │  │                 │  │                 │       │  │
│  │   └─────────────────┘  └─────────────────┘  └─────────────────┘       │  │
│  │                                                                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      EXECUTION FLOW                                     │  │
│  │                                                                         │  │
│  │   execute(action, dataModel)                                           │  │
│  │       │                                                                 │  │
│  │       ▼                                                                 │  │
│  │   resolveAction ──────────▶ Resolve dynamic params via path.ts         │  │
│  │       │                                                                 │  │
│  │       ▼                                                                 │  │
│  │   [has confirm?] ──yes──▶ Deferred.make<boolean>                       │  │
│  │       │                       │                                         │  │
│  │       │                       ▼                                         │  │
│  │       │                   Ref.update(pendingConfirmation)              │  │
│  │       │                       │                                         │  │
│  │       │                       ▼                                         │  │
│  │       │                   Deferred.await ◀─── SUSPEND FIBER             │  │
│  │       │                       │                                         │  │
│  │       │                       │      ┌────────────────────────┐        │  │
│  │       │                       │◀─────│ UI calls confirm() or │        │  │
│  │       │                       │      │ cancel() to resume     │        │  │
│  │       │                       │      └────────────────────────┘        │  │
│  │       ▼                       ▼                                         │  │
│  │   [cancelled?] ──yes──▶ ActionCancelledError                           │  │
│  │       │                                                                 │  │
│  │       ▼                                                                 │  │
│  │   Effect.fork(handler) ──▶ Create cancellable Fiber                    │  │
│  │       │                                                                 │  │
│  │       ▼                                                                 │  │
│  │   Ref.update(runningFibers) ──▶ Track for cancellation                 │  │
│  │       │                                                                 │  │
│  │       ▼                                                                 │  │
│  │   Fiber.await ──────────▶ Wait for completion                          │  │
│  │       │                                                                 │  │
│  │       ▼                                                                 │  │
│  │   [Exit.isSuccess?]                                                    │  │
│  │       ├──yes──▶ PubSub.publish(Success) + handleSuccess                │  │
│  │       └──no───▶ PubSub.publish(Failure) + handleError                  │  │
│  │                                                                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        API METHODS                                      │  │
│  │                                                                         │  │
│  │   execute(action, data) ─────▶ Effect<void, ActionErrors>              │  │
│  │   executeUnknown(input, data)▶ + Schema.decode validation              │  │
│  │   confirm() ─────────────────▶ Effect<void, never>                     │  │
│  │   cancel() ──────────────────▶ Effect<void, never>                     │  │
│  │   cancelAction(name) ────────▶ Effect<boolean, never>                  │  │
│  │   cancelAll() ───────────────▶ Effect<void, never>                     │  │
│  │   subscribe() ───────────────▶ Effect<Dequeue<Result>, never, Scope>   │  │
│  │   getState() ────────────────▶ Effect<ActionState, never>              │  │
│  │   getPendingConfirmation() ──▶ Effect<Option<ResolvedAction>, never>   │  │
│  │                                                                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Streaming Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STREAMING SYSTEM                                     │
│                        (streaming.ts)                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                       STREAM SOURCES                                    │  │
│  │                                                                         │  │
│  │   streamFromFetch(url, body, signal)                                   │  │
│  │       │                                                                 │  │
│  │       ▼                                                                 │  │
│  │   Stream.async<JsonPatch, Error>((emit) => {...})                      │  │
│  │       │                                                                 │  │
│  │       │   ┌─────────────────────────────────────────┐                  │  │
│  │       │   │ fetch(url, {body, signal})              │                  │  │
│  │       │   │     │                                   │                  │  │
│  │       │   │     ▼                                   │                  │  │
│  │       │   │ response.body.getReader()              │                  │  │
│  │       │   │     │                                   │                  │  │
│  │       │   │     ▼                                   │                  │  │
│  │       │   │ while (true):                          │                  │  │
│  │       │   │   reader.read()                        │                  │  │
│  │       │   │     │                                   │                  │  │
│  │       │   │     ▼                                   │                  │  │
│  │       │   │   parse NDJSON lines                   │                  │  │
│  │       │   │     │                                   │                  │  │
│  │       │   │     ▼                                   │                  │  │
│  │       │   │   Schema.decodeSync(JsonPatch) ◀─ BOUNDARY VALIDATION     │  │
│  │       │   │     │                                   │                  │  │
│  │       │   │     ▼                                   │                  │  │
│  │       │   │   emit(Effect.succeed(Chunk.of(patch))) │                  │  │
│  │       │   │                                         │                  │  │
│  │       │   └─────────────────────────────────────────┘                  │  │
│  │       │                                                                 │  │
│  │       ▼                                                                 │  │
│  │   Stream.Stream<JsonPatch, Error>                                      │  │
│  │                                                                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     STREAM PROCESSING                                   │  │
│  │                                                                         │  │
│  │   processPatches(patchStream, options)                                 │  │
│  │       │                                                                 │  │
│  │       ▼                                                                 │  │
│  │   patchStream                                                          │  │
│  │       │                                                                 │  │
│  │       ├──▶ Stream.grouped(chunkSize)     Batch for efficiency          │  │
│  │       │                                                                 │  │
│  │       ├──▶ Stream.throttle({             Rate limit for UI             │  │
│  │       │      duration: 16ms,                                           │  │
│  │       │      units: 1                                                  │  │
│  │       │    })                                                          │  │
│  │       │                                                                 │  │
│  │       └──▶ Stream.scan(                  Accumulate tree               │  │
│  │              UITree.empty(),                                           │  │
│  │              (tree, patches) =>                                        │  │
│  │                applyPatches(tree, patches)                             │  │
│  │            )                                                           │  │
│  │       │                                                                 │  │
│  │       ▼                                                                 │  │
│  │   Stream.Stream<UITree, Error>                                         │  │
│  │                                                                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     MANAGED SERVICE                                     │  │
│  │                                                                         │  │
│  │   makeUIStream(url, options) ─▶ Effect<UIStreamService, never>         │  │
│  │                                                                         │  │
│  │   ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │   │  Refs:                                                           │  │  │
│  │   │    treeRef: Ref<UITree>                                         │  │  │
│  │   │    isStreamingRef: Ref<boolean>                                 │  │  │
│  │   │    errorRef: Ref<Option<Error>>                                 │  │  │
│  │   │                                                                  │  │  │
│  │   │  Current Fiber: RuntimeFiber<void, Error> | null                │  │  │
│  │   └─────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                         │  │
│  │   API:                                                                 │  │
│  │     send(prompt, context) ─▶ Effect<void, Error>                      │  │
│  │     clear() ──────────────▶ Effect<void, never>                       │  │
│  │     cancel() ─────────────▶ Effect<void, never>                       │  │
│  │     getTree() ────────────▶ Effect<UITree, never>                     │  │
│  │     isStreaming() ────────▶ Effect<boolean, never>                    │  │
│  │     getError() ───────────▶ Effect<Option<Error>, never>              │  │
│  │                                                                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Patch Application

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PATCH APPLICATION                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   applyPatch(tree, patch) ─▶ Effect<UITree, never>                          │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                       │   │
│   │   JsonPatch { op: "set"|"add"|"replace"|"remove", path, value }     │   │
│   │       │                                                               │   │
│   │       ▼                                                               │   │
│   │   switch (op):                                                        │   │
│   │                                                                       │   │
│   │     case "set/add/replace":                                          │   │
│   │       │                                                               │   │
│   │       ├── path === "/root" ────▶ tree.setRoot(value)                 │   │
│   │       │                                                               │   │
│   │       └── path.startsWith("/elements/")                              │   │
│   │             │                                                         │   │
│   │             ├── [elementKey only] ──▶ tree.setElement(key, new UI)   │   │
│   │             │                                                         │   │
│   │             └── [elementKey/prop] ──▶ setByPathSync + setElement     │   │
│   │                                                                       │   │
│   │     case "remove":                                                   │   │
│   │       │                                                               │   │
│   │       └── path.startsWith("/elements/")                              │   │
│   │             │                                                         │   │
│   │             └──▶ tree.removeElement(key)                             │   │
│   │                                                                       │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   UITree Methods (Immutable):                                                │
│     empty() ────────────▶ new UITree({ root: "", elements: {} })            │
│     getElement(key) ────▶ this.elements[key] | undefined                    │
│     setElement(key, el)─▶ new UITree({...this, elements: {..., [key]: el}}) │
│     removeElement(key) ─▶ new UITree({...this, elements without key })      │
│     setRoot(key) ───────▶ new UITree({...this, root: key })                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Effect Primitives Used

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EFFECT PRIMITIVES                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Schema    │ │    Ref      │ │  Deferred   │ │   Fiber     │           │
│  │             │ │             │ │             │ │             │           │
│  │ Runtime     │ │ Atomic      │ │ One-shot    │ │ Cancellable │           │
│  │ validation  │ │ state       │ │ promise     │ │ computation │           │
│  │ at boundary │ │ management  │ │ (confirm)   │ │             │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   PubSub    │ │   Queue     │ │   Stream    │ │   Match     │           │
│  │             │ │             │ │             │ │             │           │
│  │ Broadcast   │ │ FIFO with   │ │ Progressive │ │ Exhaustive  │           │
│  │ results to  │ │ ordering    │ │ rendering   │ │ pattern     │           │
│  │ subscribers │ │ + backpres. │ │ + backpres. │ │ matching    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                           │
│  │ Data.Tagged │ │   Option    │ │    Exit     │                           │
│  │   Error     │ │             │ │             │                           │
│  │             │ │ Safe null   │ │ Success or  │                           │
│  │ Typed      │ │ handling    │ │ Failure     │                           │
│  │ errors     │ │             │ │ + cause     │                           │
│  └─────────────┘ └─────────────┘ └─────────────┘                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Full System Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FULL SYSTEM FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. DEFINE CATALOG (Missing - To Implement)                                 │
│     ┌─────────────────────────────────────────────────────────────────────┐ │
│     │  createCatalog({                                                     │ │
│     │    components: {                                                     │ │
│     │      Button: { props: Schema.Struct({...}), description: "..." },   │ │
│     │      Card: { props: Schema.Struct({...}), hasChildren: true },      │ │
│     │    },                                                                │ │
│     │    actions: { saveForm: { params: Schema.Struct({...}) } },         │ │
│     │    functions: { isUnique: (v) => ... }                              │ │
│     │  })                                                                  │ │
│     └─────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  2. GENERATE UI (AI generates UITree via streaming)                         │
│     ┌─────────────────────────────────────────────────────────────────────┐ │
│     │  const stream = yield* makeUIStream("/api/render")                   │ │
│     │  yield* stream.send("Create login form", { catalog })                │ │
│     │                                                                       │ │
│     │  // Stream produces patches:                                         │ │
│     │  // {"op":"set","path":"/root","value":"form-1"}                     │ │
│     │  // {"op":"set","path":"/elements/form-1","value":{...}}             │ │
│     │  // {"op":"set","path":"/elements/email-1","value":{...}}            │ │
│     └─────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  3. RENDER TREE (React consumes UITree)                                     │
│     ┌─────────────────────────────────────────────────────────────────────┐ │
│     │  const tree = yield* stream.getTree()                                │ │
│     │                                                                       │ │
│     │  // For each element:                                                │ │
│     │  //   - Check visibility via evaluateVisibility                      │ │
│     │  //   - Validate via runValidation                                   │ │
│     │  //   - Render component from registry                               │ │
│     │  //   - Bind actions to execute via ActionService                    │ │
│     └─────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  4. HANDLE INTERACTIONS                                                     │
│     ┌─────────────────────────────────────────────────────────────────────┐ │
│     │  // User clicks button with action                                   │ │
│     │  yield* actionService.execute(                                       │ │
│     │    new Action({ name: "saveForm", params: {...} }),                  │ │
│     │    dataModel                                                         │ │
│     │  )                                                                    │ │
│     │                                                                       │ │
│     │  // If confirm required, UI shows dialog                             │ │
│     │  // User confirms: yield* actionService.confirm()                    │ │
│     │  // Action runs via Fiber, result broadcast via PubSub               │ │
│     └─────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Missing Components (To Implement)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REMAINING WORK                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CORE:                                                                       │
│    ☑ schemas.ts     - Effect Schema definitions                             │
│    ☑ path.ts        - JSON Pointer utilities                                │
│    ☑ visibility.ts  - Visibility evaluation                                 │
│    ☑ actions.ts     - Action execution                                      │
│    ☑ validation.ts  - Field validation                                      │
│    ☑ streaming.ts   - Stream-based rendering                                │
│    ☑ index.ts       - Barrel export                                         │
│    ☐ catalog.ts     - Component registry (NEXT)                             │
│                                                                              │
│  REACT (Future):                                                             │
│    ☐ hooks.ts       - useUIStream, useAction, useVisibility                 │
│    ☐ renderer.tsx   - <Renderer tree={...} registry={...} />                │
│    ☐ contexts/      - DataProvider, VisibilityProvider, etc.                │
│    ☐ atoms.ts       - Atom-based state for React integration                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```
