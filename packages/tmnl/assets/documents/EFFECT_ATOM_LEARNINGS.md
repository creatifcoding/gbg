# Effect-Atom Learnings: Minibuffer & Hotkey Integration

> Documented from debugging session: Making Escape key work for minibuffer scope

## Critical API Understanding

### `Atom.runtime(Layer).fn()` Returns an ATOM, Not a Function

**The Misconception:**
```typescript
// WRONG - treating runtimeAtom.fn() result as callable
const minibufferOps = {
  cancel: minibufferRuntimeAtom.fn(() => Effect.gen(function* () {
    const svc = yield* MinibufferService
    yield* svc.cancel()
  }))
}

// Then trying to call it directly
minibufferOps.cancel() // TypeError: cancel is not a function
```

**The Reality:**
`runtimeAtom.fn()` returns a `Writable<T>` atom (specifically an `AtomResultFn`), NOT a callable function.

**Correct Usage:**

1. **In React components** - Use `useAtomSet` to get a callable:
```typescript
import { useAtomSet } from "@effect-atom/atom-react"
import { Exit } from "effect"

// Get callable function from atom
const doCancel = useAtomSet(minibufferAtoms.cancel, { mode: "promiseExit" })

// Now you can call it
const exit = await doCancel()
if (Exit.isSuccess(exit)) {
  // Handle success
}
```

2. **Outside React** - Use `registry.set()`:
```typescript
registry.set(minibufferAtoms.cancel, undefined)
```

### `Effect.fnUntraced` for Runtime Atoms

When wrapping Effects for `runtimeAtom.fn()`, use `Effect.fnUntraced`:

```typescript
// Correct pattern
cancel: minibufferRuntimeAtom.fn(
  Effect.fnUntraced(function* (_?: void) {
    const svc = yield* MinibufferService
    yield* svc.cancel()
  })
)

// With arguments
prompt: minibufferRuntimeAtom.fn(
  Effect.fnUntraced(function* (args: { message: string; options?: Options }) {
    const svc = yield* MinibufferService
    return yield* svc.prompt(args.message, args.options)
  })
)
```

### `useAtomSet` Mode Options

| Mode | Returns | Use Case |
|------|---------|----------|
| `"fire"` | `void` | Fire-and-forget, no result needed |
| `"promise"` | `Promise<T>` | Await the result value |
| `"promiseExit"` | `Promise<Exit<T, E>>` | Need to handle success/failure explicitly |

```typescript
// Fire and forget
const doCancel = useAtomSet(atom, { mode: "fire" })
doCancel() // Returns void

// Await result
const doPrompt = useAtomSet(atom, { mode: "promise" })
const result = await doPrompt({ message: "Enter name" })

// Handle Exit explicitly
const doPrompt = useAtomSet(atom, { mode: "promiseExit" })
const exit = await doPrompt({ message: "Enter name" })
if (Exit.isSuccess(exit)) {
  console.log("Got:", exit.value)
} else {
  console.log("Failed or cancelled")
}
```

## Shared Runtime Pattern

### Why Shared Runtime Matters

**Problem:** Deferreds are fiber-scoped. If you create a Deferred in one fiber and try to resolve it from another, it fails.

```typescript
// BROKEN - Different fibers, can't resolve Deferred
const open = async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const svc = yield* MinibufferService // Fresh instance!
      yield* svc.prompt("Enter name") // Creates Deferred
    }).pipe(Effect.provide(MinibufferService.Default))
  )
}

const cancel = async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const svc = yield* MinibufferService // DIFFERENT instance!
      yield* svc.cancel() // Can't find the Deferred!
    }).pipe(Effect.provide(MinibufferService.Default))
  )
}
```

**Solution:** Use `Atom.runtime()` for shared service context:

```typescript
// Create shared runtime
export const minibufferRuntimeAtom = Atom.runtime(MinibufferService.Default)

// All operations share the same service instance
export const minibufferAtoms = {
  cancel: minibufferRuntimeAtom.fn(
    Effect.fnUntraced(function* () {
      const svc = yield* MinibufferService // Same instance!
      yield* svc.cancel()
    })
  ),

  prompt: minibufferRuntimeAtom.fn(
    Effect.fnUntraced(function* (args) {
      const svc = yield* MinibufferService // Same instance!
      return yield* svc.prompt(args.message)
    })
  ),
}
```

### Circular Dependency Avoidance

Separate runtime atoms from service definitions to avoid cycles:

```
atoms/index.ts      <- defines state atoms
atoms/runtime.ts    <- defines runtime + operation atoms (imports Service)
services/Service.ts <- defines service (imports atoms/index.ts for state)
```

## Hotkey System Integration

### Key Normalization

DOM events use different key names than our normalized form:

| DOM Event | Normalized |
|-----------|------------|
| `"Escape"` | `"esc"` |
| `" "` (space) | `"space"` |
| `"ArrowUp"` | `"up"` |
| `"ArrowDown"` | `"down"` |

**Always use normalized form in bindings:**
```typescript
const binding = {
  keys: [{ ctrl: false, alt: false, shift: false, meta: false, key: 'esc' }], // NOT 'Escape'
  commandId: 'minibuffer.cancel',
  scope: Scopes.MINIBUFFER,
}
```

### Input Element Handling

Global hotkey handlers typically ignore events from input elements:

```typescript
if (isInputElement(e.target)) {
  return // Ignore all keys in inputs
}
```

**Problem:** Minibuffer has an input field, so escape gets ignored!

**Solution:** Allow escape through even in input elements:

```typescript
if (isInputElement(e.target)) {
  if (e.key !== "Escape") {
    return // Only ignore non-escape keys
  }
  // Escape passes through for minibuffer cancel
}
```

### Event Propagation Architecture

When minibuffer is open:

1. **Window listener (capture phase)** - `useGlobalHotkeys` sees event first
2. **React event handlers** - `MinibufferContent.onKeyDown`
3. **cmdk internal handlers** - Command palette's own keyboard handling

**Key insight:** Don't handle escape in the component if you want the global system to handle it:

```typescript
// MinibufferContent.tsx
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  if (e.key === "Escape") {
    // DON'T preventDefault! Let it bubble to global handler
    return
  }
}, [])
```

### Scope-Based Binding Architecture

```
┌─────────────────────────────────────────┐
│         Global Scope (always)           │
│  Alt+X → system.commandPalette          │
├─────────────────────────────────────────┤
│    Minibuffer Scope (when open)         │
│  Esc → minibuffer.cancel                │
│  (Higher priority, pushed on open)      │
└─────────────────────────────────────────┘
```

When minibuffer opens:
1. Push minibuffer scope
2. Add esc binding in minibuffer scope
3. Global handler now sees esc binding with higher priority

When minibuffer closes:
1. Remove esc binding
2. Pop minibuffer scope

## Component vs Hook Responsibility

### Wrong: Component handles everything
```typescript
// MinibufferContent.tsx - WRONG
const handleKeyDown = (e) => {
  if (e.key === "Escape") {
    doCancel() // Resolves Deferred
    // But doesn't close drawer!
  }
}
```

### Right: Hook orchestrates, component renders
```typescript
// useMinibuffer.tsx - Orchestration
const cancel = useCallback(async () => {
  const exit = await doCancel() // Resolve Deferred
  closeDrawer()                 // Close UI
}, [doCancel, closeDrawer])

// MinibufferContent.tsx - Just renders, delegates escape
const handleKeyDown = (e) => {
  if (e.key === "Escape") {
    return // Let global handler call useMinibuffer.cancel()
  }
}
```

## Debugging Tips

### Console Logging Points

Add logs at key decision points:
```typescript
console.log('[useGlobalHotkeys] Processing key:', chord.key)
console.log('[useGlobalHotkeys] scopedBindings:', scopedBindings.length)
console.log('[useGlobalHotkeys] Result:', result.type)
console.log('[minibuffer] Pushing scope:', Scopes.MINIBUFFER)
console.log('[minibuffer] cancel() called')
```

### Playwriter MCP for Browser Testing

```typescript
// Take screenshot
await state.page.screenshot({ path: '/tmp/state.png' })

// Get console logs
const logs = await getLatestLogs({ page: state.page, count: 50 })

// Test keyboard
await state.page.keyboard.press('Alt+x')
await state.page.keyboard.press('Escape')
```

## Exit Semantics: Success vs Failure

### Cancel Returns `Exit.Failure` — This is Correct!

```
[minibuffer] cancel() completed, exit: failure
```

This is **intended behavior**. When user cancels:
- `Exit.isSuccess(exit)` → `false` (no value selected)
- `Exit.isFailure(exit)` → `true` (operation was cancelled)

**Why?** The Deferred is resolved with an interruption/failure, not a success value. This allows consumers to distinguish:

```typescript
const promptText = useCallback(async (msg, options) => {
  openDrawer()
  const exit = await doPrompt({ message: msg, options })
  closeDrawer()

  if (Exit.isSuccess(exit)) {
    return exit.value  // User entered text
  }
  return ''  // User cancelled - return empty string
}, [openDrawer, closeDrawer, doPrompt])
```

**Key insight:** Cancel is not an error, it's a valid outcome. The Exit type lets us handle both cases explicitly without exceptions.

## Summary: The Fix Chain

1. **Key normalization** - `'Escape'` → `'esc'` in binding registration
2. **Atom API** - `useAtomSet(atom, { mode })` instead of direct call
3. **Shared runtime** - `Atom.runtime()` for Deferred resolution across call sites
4. **Input passthrough** - Allow escape through `isInputElement` check
5. **Event delegation** - Component doesn't handle escape, global handler does
6. **Orchestration** - Hook calls both `doCancel()` AND `closeDrawer()`
