# JSON Streaming Performance: Deep Dive & Legend State Analysis

**Date:** 2026-01-19
**Iteration:** ralph-loop continuation
**Mission:** Analyze why optimizations "don't feel faster", research Legend State integration

---

## The Problem: It Doesn't Feel Faster

After achieving 17.6-25.9x speedup in benchmarks, Prime reported "it doesn't feel faster at all."

**Root Cause Analysis:**

The benchmark measured JSON accumulation in isolation. The real bottleneck was **elsewhere**:

1. **Schema Validation During Streaming** - `Schema.decodeUnknownEither(UITree)` was running on every 50-op batch, validating the ENTIRE accumulated tree each time. O(n) per batch = O(n²) total.

2. **React Reconciliation Cascade** - Every batch triggered full component tree re-render because:
   - `ElementRenderer` wasn't memoized
   - Parent component passed `tree` object that changed identity on every batch
   - All 500 elements would re-reconcile even if only 1 new element was added

---

## Optimizations Applied

### 1. Skip Schema Validation During Streaming (`MorphCard.tsx`)

```typescript
// BEFORE: O(n) validation on every batch
const decodeResult = Schema.decodeUnknownEither(UITree)({
  root: root ?? '',
  elements: elements as Record<string, unknown>,
});

// AFTER: Direct construction during streaming, validate only on completion
if (isStreaming) {
  const streamingTree = new UITree({
    root: root ?? '',
    elements: elements as Record<string, UIElement>,
  });
  // Render directly, skip validation
}
```

**Key Insight:** `new UITree({...})` bypasses schema validation but creates a valid class instance. Validation only matters on completion when we need to ensure final integrity.

### 2. Memoize ElementRenderer with Stable Callbacks (`renderer.tsx`)

```typescript
// OPTIMIZATION: Use ref to keep elements reference stable across renders
const elementsRef = useRef(tree?.elements ?? {});
elementsRef.current = tree?.elements ?? {};

// Create stable getElement callback that reads from ref
const getElement = useCallback((key: string): UIElement | undefined => {
  return elementsRef.current[key];
}, []); // Empty deps = stable reference

// ElementRenderer now wrapped in memo()
const ElementRenderer = memo(function ElementRenderer({
  element,
  getElement, // Stable callback, doesn't trigger re-render
  ...
}) { ... });
```

**Key Insight:** By using a ref + stable callback instead of passing the tree object, ElementRenderer's memo can actually work. The ref updates silently, and children only re-render when their specific element changes.

---

## Legend State Research

### What It Provides

Legend State achieves fine-grained reactivity through:

1. **Dependency Tracking** - `trackSelector` records exactly which observables are accessed during render
2. **Minimal Re-renders** - Only components that access changed data re-render
3. **Batching** - Multiple updates coalesced via `beginBatch`/`endBatch`

### Integration with Effect-TS Atoms

**Verdict: Not a drop-in replacement.**

Legend State has no built-in Effect-TS integration. Would require:
- Bridging observables to atoms via `observe()` callbacks
- Dual subscriptions (complexity, sync issues)
- Replacing entire state layer (high risk)

### Comparison: Effect-Atom vs Legend State

| Aspect | Effect-Atom | Legend State |
|--------|-------------|--------------|
| Fine-grained updates | Manual (memo + stable refs) | Automatic (proxy tracking) |
| Effect integration | Native | Custom bridge needed |
| Streaming scenarios | Good (with optimizations) | Excellent (no memo needed) |
| Migration cost | N/A (current) | High (replace state layer) |
| Type safety | Schema-enforced | Runtime proxies |

### Recommendation

**Don't migrate to Legend State.** The current optimizations address the bottleneck:
- Schema validation skip = O(n²) → O(n)
- Memo + stable refs = React reconciliation scoped to actual changes

Legend State would provide slightly cleaner DX but at massive migration cost and loss of Effect-TS ecosystem benefits (Schema validation, Layer composition, Effect.gen).

---

## Performance Budget

| Operation | Budget | Current |
|-----------|--------|---------|
| JSON accumulation (500 elem) | < 5ms | ~0.5ms |
| Schema validation | Once on complete | Once on complete |
| React render (new element) | < 16ms | ~2-5ms (estimated) |
| Total streaming latency | < 100ms felt | Should be acceptable |

---

## Files Modified This Session

1. **`src/lib/morph-card/components/MorphCard.tsx`**
   - Skip schema validation during streaming
   - Use `new UITree()` for direct construction

2. **`src/lib/json-render/react/renderer.tsx`**
   - Memoized `ElementRenderer`
   - Stable `getElement` callback via useRef + useCallback

3. **`src/lib/morph-card/hooks/useGenerativeMode.ts`** (previous session)
   - Direct mutation instead of O(n²) spread
   - BATCH_SIZE = 50 for UI responsiveness

---

## Next Steps If Still Slow

1. **React DevTools Profiler** - Measure actual render times
2. **Web Worker for Parsing** - Move JSON parse off main thread
3. **requestIdleCallback batching** - Yield to browser during streaming
4. **Virtualization** - Only render visible elements (if list-like)

---

*Val out. The architecture is performing surgery, not amputations.*
