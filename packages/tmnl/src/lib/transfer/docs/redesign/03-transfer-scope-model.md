# 03 — Transfer Scope Model

**Parent**: [Index](./00-transfer-redesign-index.md)  
**Prerequisite**: [01-transfer-algebra.md](./01-transfer-algebra.md)

---

## Why Surface-Scoped?

The current `transfer-stx.ts` is a **global mutable singleton**:

```typescript
// Current: one global atom for the entire app
let _transferStx: ReturnType<typeof stxData<TransferRuntimeState>> | null = null
```

Problems:
1. **No isolation** — two surfaces can't have independent transfer state
2. **No cleanup** — unmounting a surface doesn't clean up its transfer state
3. **No composition** — adding a new surface requires modifying global state shape
4. **Testing** — tests share global state, requiring manual reset

Questionnaire: *"Smart scoping — cross boundaries, each handles if it can or chooses to. Category/functional theory, curry-like pattern via Effect."*

---

## Use Effect `Scope` — Not a Hand-Rolled Lifecycle

Effect provides `Scope` as a first-class resource lifecycle primitive. The `effect-atom` `Registry` already uses `Layer.scoped` + `Scope.addFinalizer` as the canonical pattern for atom lifetime management. Transfer scope should follow the same pattern.

### The Pattern (from effect-atom Registry)

```typescript
// How effect-atom manages registry lifetime:
export const layerOptions = (options?: { ... }): Layer.Layer<AtomRegistry> =>
  Layer.scoped(
    AtomRegistry,
    Effect.gen(function*() {
      const scope = yield* Effect.scope
      const registry = internal.make({ ... })
      yield* Scope.addFinalizer(scope, Effect.sync(() => registry.dispose()))
      return registry
    })
  )
```

This is the shape we follow: `Layer.scoped` creates a resource whose lifetime is bound to the scope. Finalizers run on scope close. No manual mount/unmount tracking.

---

## TransferScope as Effect Service

```typescript
import { Context, Effect, Layer, Scope, Ref } from 'effect'
import { Atom } from '@effect-atom/atom'

// ── The TransferScope service ────────────────────────────────

class TransferScope extends Context.Tag('Transfer/Scope')<
  TransferScope,
  {
    /** Surface identity */
    readonly surfaceId: string

    /** What this scope can produce */
    readonly sourceKinds: ReadonlyArray<TransferKind>

    /** What this scope accepts */
    readonly acceptKinds: ReadonlyArray<TransferKind>

    /** Lift local selection → global tokens */
    readonly lift: (
      selection: ReadonlyArray<string>
    ) => Effect.Effect<ReadonlyArray<TransferToken>>

    /** Evaluate whether a token is acceptable */
    readonly evaluate: (
      token: TransferToken
    ) => Effect.Effect<TransferResult>

    /** Lower a global token → local insertion */
    readonly lower: (
      token: TransferToken,
      mode: TransferInsertMode
    ) => Effect.Effect<void, TransferReject>

    /** Active drag session originating from this scope */
    readonly session: Atom<TransferSession | null>

    /** Selection state within this scope */
    readonly selection: Atom<ReadonlySet<string>>

    /** Local clipboard (last copy from this scope) */
    readonly clipboard: Atom<TransferClipboardEntry | null>
  }
>() {}
```

### Scope Layer Factory (Curried)

This is where the curry happens. `makeTransferScopeLayer` partially applies the surface identity and capabilities, returning a `Layer` that provides the `TransferScope` service:

```typescript
interface TransferScopeConfig {
  surfaceId: string
  sourceKinds: ReadonlyArray<TransferKind>
  acceptKinds: ReadonlyArray<TransferKind>

  /** Produce tokens from a selection. Receives the scope's own state. */
  lift: (
    selection: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyArray<TransferToken>>

  /** Evaluate a candidate token for acceptance */
  evaluate: (token: TransferToken) => TransferResult

  /** Insert an accepted token */
  lower: (
    token: TransferToken,
    mode: TransferInsertMode
  ) => Effect.Effect<void, TransferReject>
}

const makeTransferScopeLayer = (
  config: TransferScopeConfig
): Layer.Layer<TransferScope> =>
  Layer.scoped(
    TransferScope,
    Effect.gen(function* () {
      const scope = yield* Effect.scope

      // Create scope-local atoms
      const sessionAtom    = Atom.make<TransferSession | null>(null)
      const selectionAtom  = Atom.make<ReadonlySet<string>>(new Set())
      const clipboardAtom  = Atom.make<TransferClipboardEntry | null>(null)

      // Register with the TransferBus (if available in context)
      const bus = yield* Effect.serviceOption(TransferBus)
      if (Option.isSome(bus)) {
        yield* bus.value.register(config.surfaceId)
        yield* Scope.addFinalizer(
          scope,
          bus.value.deregister(config.surfaceId)
        )
      }

      // Cleanup session on scope close
      yield* Scope.addFinalizer(
        scope,
        Effect.sync(() => {
          // If we own an active session, cancel it
          Atom.set(sessionAtom, null)
          Atom.set(selectionAtom, new Set())
        })
      )

      return TransferScope.of({
        surfaceId: config.surfaceId,
        sourceKinds: config.sourceKinds,
        acceptKinds: config.acceptKinds,
        lift: config.lift,
        evaluate: (token) => Effect.succeed(config.evaluate(token)),
        lower: config.lower,
        session: sessionAtom,
        selection: selectionAtom,
        clipboard: clipboardAtom,
      })
    })
  )
```

### The Curry Visualized

```
makeTransferScopeLayer(config)         → Layer<TransferScope>     [1st application: bind surface]
  ↳ scope.lift(selection)              → TransferToken[]          [2nd application: bind selection]
    ↳ targetScope.lower(token, mode)   → Effect<void, Reject>    [3rd application: bind target]
```

Each application narrows the domain. The Layer composition handles lifetime.

---

## TransferBus: Cross-Boundary Mediator

The bus is an **optional** service that enables cross-surface transfer. Surfaces can operate independently (source-only or target-only) without a bus — the bus adds cross-surface discovery.

```typescript
class TransferBus extends Context.Tag('Transfer/Bus')<
  TransferBus,
  {
    /** Register a surface scope */
    readonly register: (surfaceId: string) => Effect.Effect<void>

    /** Deregister on unmount */
    readonly deregister: (surfaceId: string) => Effect.Effect<void>

    /** Active drag broadcast — so targets can prepare feedback */
    readonly activeDrag: Atom<TransferSession | null>

    /** Registered surface IDs (for cross-surface discovery) */
    readonly surfaces: Atom<ReadonlySet<string>>
  }
>() {}

const TransferBusLive: Layer.Layer<TransferBus> = Layer.scoped(
  TransferBus,
  Effect.gen(function* () {
    const scope = yield* Effect.scope
    const surfacesAtom = Atom.make<ReadonlySet<string>>(new Set())
    const activeDragAtom = Atom.make<TransferSession | null>(null)

    yield* Scope.addFinalizer(scope, Effect.sync(() => {
      Atom.set(surfacesAtom, new Set())
      Atom.set(activeDragAtom, null)
    }))

    return TransferBus.of({
      register: (id) => Effect.sync(() => {
        Atom.set(surfacesAtom, new Set([...Atom.get(surfacesAtom), id]))
      }),
      deregister: (id) => Effect.sync(() => {
        const next = new Set(Atom.get(surfacesAtom))
        next.delete(id)
        Atom.set(surfacesAtom, next)
      }),
      activeDrag: activeDragAtom,
      surfaces: surfacesAtom,
    })
  })
)
```

### Bus is Optional

A surface can operate without a bus:
- Source-only (e.g., inline tasks produce tokens, no drop target)
- Self-contained (e.g., reorder within same list)
- Test environments (no bus, scope works in isolation)

The `Effect.serviceOption(TransferBus)` pattern makes the bus dependency optional — if present, register; if absent, skip. No runtime error.

---

## Cross-Boundary Drag Flow (with Effect Scope)

```
1. Drag starts in ScopeA
   ├── Atom.set(scopeA.session, newSession)
   ├── bus.activeDrag ← session (broadcast)
   └── Scope.addFinalizer → cleanup if ScopeA unmounts mid-drag

2. Pointer enters ScopeB's DOM region
   ├── ScopeB reads bus.activeDrag → session exists
   ├── ScopeB.evaluate(session.tokens[0]) → Accept | Reject
   └── Trait feedback renders accept/reject visual

3. Drop on ScopeB
   ├── ScopeB.lower(token, insertMode) → Effect<void, Reject>
   ├── Atom.set(scopeA.session, null)
   └── bus.activeDrag ← null

4. If ScopeA unmounts before drop completes
   ├── Scope finalizer fires → session ← null
   └── bus.activeDrag ← null (clean state)
```

The critical improvement: **Effect Scope finalizers guarantee cleanup**. The current stx singleton has no cleanup mechanism — if a surface unmounts mid-drag, the global state is poisoned.

---

## Cross-Boundary Clipboard Flow

Clipboard is **per-scope with system clipboard as cross-scope transport**:

```
1. Copy in ScopeA (Ctrl+C)
   ├── scopeA.lift(selectedIds) → tokens
   ├── Atom.set(scopeA.clipboard, { tokens, copiedAt })
   └── navigator.clipboard.writeText(encode(tokens))

2. Paste in ScopeB (Ctrl+V)
   ├── Read navigator.clipboard.readText()
   ├── Decode tokens from clipboard text
   ├── For each: scopeB.evaluate(token)
   └── Accepted: scopeB.lower(token, insertMode)
```

The system clipboard is the **natural cross-scope transport** — no shared atom needed. Each scope writes to/reads from it independently. The scope-local `clipboardAtom` is a **fallback** for when clipboard API permissions are denied (Firefox restrictive mode, etc.).

---

## React Bridge: `useTransferScope`

The React hook creates a scope layer, runs it in the component's lifecycle, and provides the scope to children:

```typescript
function useTransferScope(config: TransferScopeConfig): TransferScopeHandle {
  // Uses Atom.runtime() pattern from effect-atom
  // The layer is created once (stable config ref)
  // Scope.close fires on unmount via useEffect cleanup
  // Returns: { session, selection, clipboard, lift, startDrag, copySelection }
}
```

This is the **single compound hook** that replaces 80 lines of VirtualizedList boilerplate. Details in [05-transfer-hook-consolidation.md](./05-transfer-hook-consolidation.md).

---

## Scope Hierarchy

Effect Scope supports hierarchical scoping via `Scope.fork` and `Scope.extend`:

```
AppScope (TransferBus lives here)
├── ShellScope (InlineTaskShell — source capability)
│   └── forked per ThreadBand if needed
└── ComposerScope (Composer — target capability)
```

If the app scope closes, all child scopes close. If a shell scope closes (component unmounts), only that scope's resources are cleaned up. The bus automatically deregisters the surface.

This maps directly to React component tree lifetime:
- `<TransferBusProvider>` → AppScope
- `<InlineTaskShell>` → ShellScope (child of AppScope)
- `<Composer>` → ComposerScope (child of AppScope)

No manual lifecycle management. Effect Scope handles it.
