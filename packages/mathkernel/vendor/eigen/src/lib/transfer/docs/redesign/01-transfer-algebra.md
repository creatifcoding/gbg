# 01 — Transfer Algebra

**Parent**: [Index](./00-transfer-redesign-index.md)

---

## The Problem in Algebraic Terms

The current transfer library is a **flat procedure collection** — a bag of functions and hooks that consumers must manually orchestrate. There's no composition law, no abstraction boundary, and no way to specialize behavior without reimplementing the wiring.

The VirtualizedList has 80+ lines of transfer boilerplate because the library offers primitives without composition. It's the equivalent of giving someone `add`, `multiply`, and `subtract` without arithmetic — every consumer reinvents the expression evaluator.

---

## Category Theory Lens

Transfer is a **morphism between surfaces**.

```
Surface_A ──── transfer ────→ Surface_B
  (source)                      (target)
```

**Objects**: Surfaces — any UI region that can produce or accept references.
- InlineTaskShell (produces task refs)
- Composer (accepts refs, inserts chips)
- Future: AG-Grid cells, tldraw shapes, COP panels

**Morphisms**: Transfer capabilities — the ability to move a reference from one surface to another.
- `drag: Source → Token → Target → InsertResult`
- `copy: Source → Token → Clipboard`
- `paste: Clipboard → Target → InsertResult`

**Composition Law**: If `f: A → B` and `g: B → C`, then `g ∘ f: A → C`.
- If InlineTask can transfer to Composer, and Composer can transfer to AgGrid, then InlineTask can transfer to AgGrid (transitively, via Composer as intermediary).

**Identity**: A surface can transfer to itself (e.g., reorder within the same list).

---

## The Curried Capability Model

Instead of a monolithic "transfer system," we define transfer as a **curried function** — partially applied at each boundary:

```
TransferCapability = Surface → TransferSource
TransferSource     = Reference → TransferToken
TransferToken      = Target → TransferResult
```

### Stage 1: Surface Registration (compile-time / mount-time)

A surface declares what it can **produce** and **accept**:

```typescript
// A source surface declares its production capability
const inlineTaskSource = Transfer.source({
  surfaceId: 'inline-task-shell',
  kinds: ['task', 'task-cluster'] as const,
  produce: (selection) => /* selection → token(s) */,
})

// A target surface declares its acceptance capability
const composerTarget = Transfer.target({
  surfaceId: 'rvn-composer',
  accepts: ['task', 'task-cluster'] as const,
  insert: (token, mode) => /* token → inserted chip */,
})
```

This is the **first application** of the curry — binding the surface identity.

### Stage 2: Token Production (drag-start / copy)

When a transfer begins, the source produces token(s):

```typescript
// Second application — binding the reference
const token = inlineTaskSource.produce({
  taskId: 'ac-001',
  title: 'Layout schema',
  status: 'running',
})
```

### Stage 3: Token Resolution (drop / paste)

When a transfer completes, the target resolves the token:

```typescript
// Third application — binding the target
const result = composerTarget.insert(token, 'inline-chip')
```

### The Composition

The full transfer is the composition of all three stages:

```
Surface.source(config) → Reference.produce(data) → Target.insert(token) → Result
```

Each stage is independently testable, independently replaceable, and independently scopeable.

---

## Effect Service Shape

The curried model maps naturally to Effect's `Context.Tag` + `Layer` pattern:

```typescript
// ── The Transfer Algebra Service ─────────────────────────────
class TransferAlgebra extends Context.Tag('Transfer/Algebra')<
  TransferAlgebra,
  {
    /** Register a source capability for a surface */
    readonly registerSource: (
      config: TransferSourceConfig
    ) => Effect.Effect<TransferSourceHandle>

    /** Register a target capability for a surface */
    readonly registerTarget: (
      config: TransferTargetConfig
    ) => Effect.Effect<TransferTargetHandle>

    /** Resolve a transfer between registered source and target */
    readonly resolve: (
      token: TransferToken,
      targetId: string
    ) => Effect.Effect<TransferResult, TransferRejectError>

    /** Query registered capabilities */
    readonly capabilities: Effect.Effect<TransferCapabilityMap>
  }
>() {}
```

### Layer Composition = Surface Composition

Each surface provides its capabilities as a Layer:

```typescript
// InlineTaskShell contributes source capability
const InlineTaskTransferLayer = Layer.effect(
  TransferAlgebra,
  Effect.gen(function* () {
    // ... register inline task source
  })
)

// Composer contributes target capability  
const ComposerTransferLayer = Layer.effect(
  TransferAlgebra,
  Effect.gen(function* () {
    // ... register composer target
  })
)

// Composition: both surfaces participate
const AppTransferLayer = Layer.merge(
  InlineTaskTransferLayer,
  ComposerTransferLayer,
)
```

This is the **categorical composition** — `Layer.merge` is the monoidal product that combines surface capabilities.

---

## The Functor: TransferScope

A `TransferScope` is a **functor** that maps surface-local operations into the global transfer algebra:

```
TransferScope<S> : LocalOp<S> → GlobalOp
```

Concretely:

```typescript
// TransferScope is parameterized by surface identity
interface TransferScope<S extends string> {
  /** Surface identity */
  readonly surfaceId: S

  /** Lift a local selection into a global token */
  readonly lift: (selection: SurfaceSelection) => TransferToken[]

  /** Lower a global token into a local insertion */
  readonly lower: (token: TransferToken) => InsertResult | null

  /** The scope's active session (local to this surface) */
  readonly session: Atom<TransferSession | null>

  /** The scope's clipboard (can read global, writes local-first) */
  readonly clipboard: Atom<TransferClipboardEntry | null>
}
```

The functor laws hold:
- **Identity**: `scope.lift(scope.lower(token)) ≅ token` (round-trip preserves reference identity)
- **Composition**: `scope_B.lower(scope_A.lift(selection))` = cross-surface transfer

---

## Why This Kills the Sprawl

| Current | Redesigned |
|---|---|
| 15 Schema types in `types.ts` | ~8 types (see Schema Redesign doc) |
| Global mutable stx singleton | Surface-scoped `TransferScope` atoms |
| 3 separate hooks + manual wiring | 1 compound hook per surface type |
| 80 lines of consumer boilerplate | `useInlineTaskTransfer(tasks, config)` — one call |
| Traits render `null` | Traits produce real feedback via scope observation |
| Factory functions generate tokens imperatively | `scope.lift(selection)` — declarative token production |
| Codec manually called by hooks | Codec internal to scope — consumer never sees it |

---

## Open Questions for Implementation

1. **Atom.family vs Context.Tag for scope registry** — Should scopes register themselves in an atom family (keyed by surfaceId) or via Effect service layer?

2. **Cross-surface drag resolution** — When a drag leaves Surface A and enters Surface B, who resolves the compatibility? Options:
   - A: The target scope calls `lower()` and returns accept/reject
   - B: A mediator service evaluates both scopes
   - C: The algebra service handles it (centralized)

3. **Session ownership during cross-surface drag** — The drag session starts in scope A but the pointer may be over scope B. Who owns the session state?

4. **Clipboard scope** — Is clipboard truly surface-local, or is it a shared bus that surfaces subscribe to?

These questions are addressed in [03-transfer-scope-model.md](./03-transfer-scope-model.md).
