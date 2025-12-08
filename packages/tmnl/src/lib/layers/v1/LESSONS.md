# Layer System v1 — Lessons Learned

**Status**: Archived for reference. v2 in development.
**Date**: 2025-12-03

---

## What Worked

### 1. Effect Service Pattern
The `Context.Tag` + `Layer.succeed` pattern is clean:
```typescript
class LayerManager extends Context.Tag("LayerManager")<LayerManager, LayerManagerOps>() {
  static Default = Layer.effect(LayerManager, ...)
}
```
**Verdict**: KEEP in v2.

### 2. Atom.runtime for Effect Integration
`layerRuntimeAtom` successfully bridges Effect services to React:
```typescript
export const layerRuntimeAtom = Atom.runtime(
  Layer.mergeAll(IdGenerator.Default, LayerFactory.Default, LayerManager.Default)
);
```
**Verdict**: KEEP. This is the canonical pattern.

### 3. Z-Index Gap Algorithm
Smart z-index allocation with ±10 gaps minimizes cascading updates:
```typescript
if (direction === "front") {
  return maxZ + 10;  // Gap for future insertions
}
```
**Verdict**: KEEP. Simple and effective.

### 4. Pointer Events Three-Tier Model
`auto | none | pass-through` covers 90% of use cases:
- `auto`: Layer captures clicks
- `none`: Layer invisible to clicks
- `pass-through`: Container ignores, children capture
**Verdict**: KEEP but refine. `captureClicks` hotfix is clunky.

---

## What Didn't Work

### 1. withLayering HOC Complexity
**Problem**: HOC creates wrapper div that interferes with layout.
**Symptoms**:
- `absolute` mode collapsed to 0×0 (missing `inset: 0`)
- Canvas toolbars invisible when wrapped
- Style composition awkward

**Root Cause**: HOC pattern fights against React's composition model. Wrapper div adds unexpected DOM node.

**Verdict**: REPLACE in v2. Consider:
- Context-based registration (no wrapper)
- Render props pattern
- CSS-only solution with `style` prop injection

### 2. XState Machine Underutilized
**Problem**: Machine exists but barely used. LayerManager handles state directly.
**Symptoms**:
- `machine.send()` rarely called
- State transitions not driving behavior
- Machine lifecycle not managed properly

**Root Cause**: Premature abstraction. Layer state is simpler than anticipated — XState overkill.

**Verdict**: REMOVE in v2. Replace with simple state object + Effect.Ref.

### 3. Effect.runPromise in useEffect
**Problem**: Each withLayering mount creates new Effect runtime.
**Symptoms**:
- Performance overhead
- No fiber management
- Cleanup relies on Promise, not Effect cancellation

**Root Cause**: Effect integration was bolted on, not designed in.

**Verdict**: REDESIGN in v2. Single runtime at provider level.

### 4. Dual State Problem
**Problem**: State lives in both Effect.Ref and atoms, sync is manual.
**Symptoms**:
- Race conditions possible
- Unclear source of truth
- Atoms don't auto-update when Ref changes

**Root Cause**: Misunderstanding of effect-atom's reactivity model.

**Verdict**: SIMPLIFY in v2. Single source of truth. Either:
- Atoms are derived from Ref (subscription pattern)
- OR atoms ARE the state (no Ref)

### 5. PositionMode Missing Defaults
**Problem**: `absolute` mode had no `inset: 0`, causing collapse.
**Fix Applied**: Added `inset: 0` to absolute case.

**Verdict**: Fixed but symptom of larger issue — position modes need explicit contracts.

---

## Design Flaws

### 1. Layer Registration Lifecycle
**Problem**: Layers register on mount, unregister on unmount. But:
- What if component remounts?
- What about SSR?
- What about lazy-loaded components?

**Verdict**: v2 needs explicit registration API, not HOC side-effect.

### 2. No Layer Persistence
**Problem**: All layers ephemeral. Page refresh = gone.

**Verdict**: v2 should support optional persistence layer.

### 3. No Layer Hierarchy
**Problem**: Flat list only. No groups, no parent-child.

**Verdict**: v2 should support optional hierarchy for complex UIs.

---

## API Surface Assessment

| API | Verdict | Notes |
|-----|---------|-------|
| `withLayering()` | REPLACE | HOC pattern problematic |
| `useLayer()` | KEEP | Hook pattern good |
| `layerRuntimeAtom` | KEEP | Core integration pattern |
| `layerOpsAtom` | KEEP | Operation atoms clean |
| `LayerManager` | SIMPLIFY | Remove XState coupling |
| `LayerFactory` | SIMPLIFY | Reduce ceremony |
| `IdGenerator` | KEEP | Useful abstraction |
| `layerMachine` | REMOVE | Overkill for use case |

---

## v2 Recommendations

### Core Changes
1. **Replace HOC with hook + context**
   - `useLayerStyle()` returns style object
   - `LayerProvider` manages registration
   - No wrapper div

2. **Remove XState**
   - Simple state object in Effect.Ref
   - Events via atom operations

3. **Single runtime at provider**
   - `<LayerProvider>` owns Effect runtime
   - Components subscribe, don't create

4. **Explicit registration**
   - `useRegisterLayer(config)` → returns id
   - `useUnregisterLayer(id)` on cleanup
   - No side-effect magic

### Optional Features (v2.1+)
- Layer persistence (localStorage)
- Layer hierarchy (groups)
- Animation integration (Animatable z-index)
- DevTools inspector

---

## Files Reference

```
v1/
├── atoms/index.ts        # Atom definitions — KEEP pattern
├── machines/             # XState machine — REMOVE
├── services/
│   ├── IdGenerator.ts    # ID generation — KEEP
│   ├── LayerFactory.ts   # Layer creation — SIMPLIFY
│   └── LayerManager.ts   # State management — SIMPLIFY
├── static-ui/            # ScaleProvider — KEEP separate
├── types.ts              # Type definitions — EVOLVE
├── useLayer.ts           # Hook — EVOLVE
└── withLayering.tsx      # HOC — REPLACE
```

---

Co-Authored-By: Val <val@maidens.ai>
