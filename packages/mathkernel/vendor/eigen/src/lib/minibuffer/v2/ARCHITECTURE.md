# Minibuffer v2 Architecture: State Integration Strategies

## Overview

This document compares two approaches for integrating the XState minibuffer machine with the rest of the TMNL codebase, which uses effect-atom for reactive state management.

---

## Approach A: Pure XState (createActorContext)

XState provides its own React integration via `@xstate/react`. This approach uses XState's built-in hooks exclusively.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Components                         │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │ useMinibufferActor│         │useMinibufferSelector│       │
│  └────────┬─────────┘         └────────┬─────────┘          │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│              createActorContext (XState)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                 MinibufferMachine                       │ │
│  │  context: { prompt, input, completions, result, ... }  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
            │
            ▼ actor.subscribe()
┌─────────────────────────────────────────────────────────────┐
│                    Effect Stream                             │
│         watches result changes, executes commands            │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// context.tsx - Already implemented
import { createActorContext } from "@xstate/react"
import { minibufferMachine } from "./machine"

export const MinibufferContext = createActorContext(minibufferMachine)
export const MinibufferProvider = MinibufferContext.Provider

// Hooks
export const useMinibufferActor = () => MinibufferContext.useActorRef()
export const useMinibufferSelector = <T>(selector: (s: Snapshot) => T) =>
  MinibufferContext.useSelector(selector)

// Effect integration via actor.subscribe()
const actor = createActor(minibufferMachine)
actor.subscribe((snapshot) => {
  if (snapshot.context.result) {
    // Execute command, clear result
  }
})
```

### Pros

1. **Simplicity** — No translation layer between XState and effect-atom
2. **Type safety** — XState's TypeScript integration is first-class
3. **Performance** — useSelector only re-renders on selected value changes
4. **Official pattern** — Follows XState documentation exactly

### Cons

1. **Inconsistency** — Rest of codebase uses effect-atom, this uses XState hooks
2. **Two mental models** — Developers must know both effect-atom AND XState patterns
3. **No Effect service integration** — Can't use `Atom.runtime` for DI
4. **Isolated state** — Minibuffer state not composable with other effect-atoms

---

## Approach B: Bridge Atoms (effect-atom wrapping XState)

Create effect-atom atoms that derive their values from the XState actor via subscription. Maintains consistency with the rest of the codebase.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Components                         │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │   useAtomValue   │         │    useAtomSet    │          │
│  └────────┬─────────┘         └────────┬─────────┘          │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   effect-atom Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ modeAtom     │  │ inputAtom    │  │ resultAtom   │      │
│  │ (derived)    │  │ (derived)    │  │ (derived)    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   actor.subscribe()                          │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           minibufferActorAtom (singleton)              │ │
│  │              XState Actor Reference                     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
            │
            ▼ Atom.runtime integration
┌─────────────────────────────────────────────────────────────┐
│              Effect Services (CommandService, etc.)          │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// atoms.ts
import { Atom } from "@effect-atom/atom"
import { createActor } from "xstate"
import { minibufferMachine, MinibufferSnapshot } from "./machine"

// Singleton actor (created once at module load)
const minibufferActor = createActor(minibufferMachine)
minibufferActor.start()

/**
 * Bridge atom: subscribes to XState actor, exposes snapshot.
 * Uses Atom.make with setSelf + addFinalizer for subscription lifecycle.
 */
export const minibufferSnapshotAtom = Atom.make<MinibufferSnapshot>((get) => {
  const subscription = minibufferActor.subscribe((snapshot) => {
    get.setSelf(snapshot)
  })
  get.addFinalizer(() => subscription.unsubscribe())
  return minibufferActor.getSnapshot()
})

// Derived atoms (selectors)
export const minibufferModeAtom = Atom.make((get) => {
  const snapshot = get(minibufferSnapshotAtom)
  return snapshot.value as string
})

export const minibufferInputAtom = Atom.make((get) => {
  const snapshot = get(minibufferSnapshotAtom)
  return snapshot.context.input
})

export const minibufferCompletionsAtom = Atom.make((get) => {
  const snapshot = get(minibufferSnapshotAtom)
  return snapshot.context.completions
})

export const minibufferResultAtom = Atom.make((get) => {
  const snapshot = get(minibufferSnapshotAtom)
  return snapshot.context.result
})

// Actor reference atom (for sending events)
export const minibufferActorAtom = Atom.make(() => minibufferActor)

// Operation atoms (send events to actor)
export const minibufferOps = {
  openCommand: Atom.fn((providerId: ProviderId) => {
    minibufferActor.send({ type: "OPEN_COMMAND", providerId })
  }),

  updateInput: Atom.fn((value: string) => {
    minibufferActor.send({ type: "INPUT_CHANGE", value })
  }),

  selectCompletion: Atom.fn((completion: Completion) => {
    minibufferActor.send({ type: "SELECT_COMPLETION", completion })
  }),

  cancel: Atom.fn(() => {
    minibufferActor.send({ type: "CANCEL" })
  }),
}
```

### Pros

1. **Consistency** — Same API as rest of codebase (useAtomValue, useAtomSet)
2. **Composability** — Minibuffer atoms can be derived with other atoms
3. **Effect integration** — Can use Atom.runtime for service DI
4. **Single mental model** — Developers only need to know effect-atom
5. **Derived state** — Can create computed atoms from minibuffer state

### Cons

1. **Translation layer** — Extra abstraction between XState and React
2. **Potential staleness** — Subscription timing could cause edge cases
3. **More code** — Bridge atoms add maintenance surface
4. **Double subscription** — Both effect-atom and XState track subscribers

---

## Approach C: Hybrid (Recommended)

Use XState for the machine, but expose state via effect-atom selectors. Best of both worlds.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Components                         │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              useAtomValue / useAtomSet                  │ │
│  │         (consistent with rest of codebase)              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   effect-atom Selectors                      │
│                                                               │
│  // Thin wrappers that delegate to XState selectors          │
│  const modeAtom = Atom.make((get) =>                         │
│    selectMode(get(snapshotAtom))                             │
│  )                                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              XState Actor (Source of Truth)                  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              minibufferMachine                          │ │
│  │  - Machine handles all state transitions                │ │
│  │  - Context is the canonical state                       │ │
│  │  - actor.subscribe() bridges to atoms                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Effect Services                           │
│                                                               │
│  // Effect stream watches resultAtom                         │
│  // Executes commands when result changes                    │
│  Stream.fromAtom(minibufferResultAtom).pipe(                 │
│    Stream.filter(r => r !== null),                           │
│    Stream.runForEach(executeCommand)                         │
│  )                                                           │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// atoms.ts - Hybrid approach
import { Atom } from "@effect-atom/atom"
import { createActor } from "xstate"
import { minibufferMachine } from "./machine"
import type { MinibufferSnapshot, Completion, ProviderId } from "./machine"

// ─────────────────────────────────────────────────────────────
// Actor Singleton
// ─────────────────────────────────────────────────────────────

const actor = createActor(minibufferMachine)
actor.start()

// ─────────────────────────────────────────────────────────────
// Bridge Atom (single subscription point)
// ─────────────────────────────────────────────────────────────

/**
 * Root snapshot atom. All other atoms derive from this.
 * Single subscription to XState actor.
 */
export const snapshotAtom = Atom.make<MinibufferSnapshot>((get) => {
  const sub = actor.subscribe((s) => get.setSelf(s))
  get.addFinalizer(() => sub.unsubscribe())
  return actor.getSnapshot()
})

// ─────────────────────────────────────────────────────────────
// Selector Atoms (derived, memoized)
// ─────────────────────────────────────────────────────────────

export const modeAtom = Atom.make((get) => get(snapshotAtom).value as string)
export const isActiveAtom = Atom.make((get) => get(modeAtom) !== "idle")
export const promptAtom = Atom.make((get) => get(snapshotAtom).context.prompt)
export const inputAtom = Atom.make((get) => get(snapshotAtom).context.input)
export const completionsAtom = Atom.make((get) => get(snapshotAtom).context.completions)
export const selectedIndexAtom = Atom.make((get) => get(snapshotAtom).context.selectedIndex)
export const resultAtom = Atom.make((get) => get(snapshotAtom).context.result)

// Derived: currently selected completion
export const selectedCompletionAtom = Atom.make((get) => {
  const completions = get(completionsAtom)
  const index = get(selectedIndexAtom)
  return completions[index] ?? null
})

// ─────────────────────────────────────────────────────────────
// Operation Atoms (send events)
// ─────────────────────────────────────────────────────────────

/** Send an event to the minibuffer actor */
export const send = (event: MinibufferEvent) => actor.send(event)

/** Operation atoms for use with useAtomSet */
export const ops = {
  openPrompt: (prompt: string, defaultValue?: string) =>
    send({ type: "OPEN_PROMPT", prompt, defaultValue }),

  openCommand: (providerId: ProviderId, prompt?: string) =>
    send({ type: "OPEN_COMMAND", providerId, prompt }),

  openYOrN: (prompt: string) =>
    send({ type: "OPEN_Y_OR_N", prompt }),

  updateInput: (value: string) =>
    send({ type: "INPUT_CHANGE", value }),

  loadCompletions: (completions: readonly Completion[]) =>
    send({ type: "COMPLETIONS_LOADED", completions }),

  selectNext: () => send({ type: "SELECT_NEXT" }),
  selectPrev: () => send({ type: "SELECT_PREV" }),

  submit: () => send({ type: "SUBMIT" }),
  cancel: () => send({ type: "CANCEL" }),

  selectCompletion: (completion: Completion) =>
    send({ type: "SELECT_COMPLETION", completion }),

  confirm: () => send({ type: "CONFIRM" }),
  deny: () => send({ type: "DENY" }),

  clearResult: () => send({ type: "CLEAR_RESULT" }),
}

// ─────────────────────────────────────────────────────────────
// Effect Integration
// ─────────────────────────────────────────────────────────────

/**
 * Get the actor reference (for advanced use cases).
 * Prefer using `ops` for standard operations.
 */
export const getActor = () => actor
```

### Pros

1. **Consistent API** — Components use `useAtomValue(modeAtom)` like everything else
2. **Single source of truth** — XState machine owns state, atoms are views
3. **Composable** — Can derive atoms that combine minibuffer + other state
4. **Effect-ready** — `resultAtom` can be watched by Effect streams
5. **Testable** — Can inject test atoms via Registry
6. **Minimal bridge** — Single `snapshotAtom` subscription, rest derived

### Cons

1. **Slight overhead** — One extra layer of indirection
2. **Subscription timing** — Must ensure actor starts before atoms accessed

---

## Recommendation: Approach C (Hybrid)

**Rationale:**

1. **Codebase consistency** — The rest of TMNL uses effect-atom. Minibuffer should too.
2. **XState for logic** — Machine handles complex state transitions cleanly.
3. **effect-atom for React** — Familiar API for component authors.
4. **Effect for execution** — Stream watches `resultAtom`, executes commands.
5. **Single bridge point** — `snapshotAtom` is the only XState↔effect-atom connection.

**Implementation order:**

1. ✅ XState machine (done)
2. ⏳ Bridge atoms (this task: `tmnl-qde8`)
3. ⏳ Effect execution stream (`tmnl-cuxy`)
4. ⏳ Service interface (`tmnl-ds3f`)

---

## API Comparison

| Task | Approach A (Pure XState) | Approach C (Hybrid) |
|------|--------------------------|---------------------|
| Read mode | `useMinibufferSelector(s => s.value)` | `useAtomValue(modeAtom)` |
| Read input | `useMinibufferSelector(s => s.context.input)` | `useAtomValue(inputAtom)` |
| Send event | `actor.send({ type: 'CANCEL' })` | `ops.cancel()` |
| Derive state | Create new selector function | `Atom.make((get) => ...)` |
| Effect watch | `actor.subscribe(...)` | `Stream.fromAtom(resultAtom)` |

---

## Next Steps

1. Implement `atoms.ts` following Approach C
2. Write tests for bridge atoms
3. Create Effect stream that watches `resultAtom`
4. Wire up to existing UI components
