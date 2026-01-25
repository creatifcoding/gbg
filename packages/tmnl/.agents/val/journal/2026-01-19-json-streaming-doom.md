# JSON Streaming Performance: The Doom Chronicles

**Date:** 2026-01-19
**Iteration:** ralph-loop iteration 1
**Mission:** Benchmark JSON object reception speed, trace optimization paths

---

## The Discovery

Prime wanted to know: *"How fast are we receiving JSON objects?"*

The answer was uncomfortable: **O(n²) slow**.

---

## The Doom Defined

**DOOM** = **D**irect **O**bject **O**peration **M**utation

The anti-pattern that was killing us:
```typescript
// DOOM: Death by O(n²) spread
elements = { ...elements, [key]: op.value }
```

Every add operation copied the entire `elements` object. At 500 elements, that's 500 copies averaging 250 elements each = 125,000 object property copies.

---

## Benchmark Results

Created `scripts/benchmark-json-streaming.ts` with observable event output for floating panel consumption.

| Element Count | Current (spread) | Optimized (mutate) | Speedup |
|---------------|------------------|--------------------| --------|
| 10 | 0.11 ms | 0.05 ms | 2.1x |
| 50 | 0.51 ms | 0.26 ms | 2.0x |
| 100 | 0.49 ms | 0.24 ms | 2.0x |
| 500 | 13.46 ms | 0.52 ms | **25.9x** |

The O(n²) curve becomes devastating at scale.

---

## The Fix: Embrace DOOM (Direct Object Operation Mutation)

```typescript
// BEFORE: O(n²) spread pattern
let elements: Record<string, unknown> = {}
elements = { ...elements, [key]: op.value }

// AFTER: O(1) mutation + batched snapshots
const elements: Record<string, unknown> = {}
elements[key] = op.value  // O(1)

if (pendingOps >= BATCH_SIZE) {
  // Snapshot only when flushing
  registry.set(atoms.tree, { root, elements: { ...elements } })
}
```

---

## Files Modified

1. `src/lib/morph-card/hooks/useGenerativeMode.ts`
   - Replaced O(n²) spread with direct mutation
   - Added 50-op batch flushing
   - Race condition fix (genState.enabled dependency)

2. `src/lib/json-render/react/GenerativeContainer.tsx`
   - Same optimization pattern
   - Batched state updates

3. `scripts/benchmark-json-streaming.ts` (NEW)
   - Comprehensive benchmark
   - Observable JSONL event output for floating panel
   - Tests: raw parse, spread, mutation, batched, worker clone

---

## Observable Event Format

For the floating panel:

```jsonl
{"type":"benchmark:start","timestamp":...,"config":{...}}
{"type":"benchmark:progress","timestamp":...,"elementCount":500,"completed":3,"total":6,"percent":50}
{"type":"benchmark:result","timestamp":...,"name":"Optimized (mutate)","elementCount":500,"metrics":{"avgMs":0.6,"opsPerSec":832576}}
{"type":"benchmark:complete","timestamp":...,"summary":{"speedupFactor":17.6,"bottleneck":"Object spread pattern (O(n²))"}}
```

Run: `bun scripts/benchmark-json-streaming.ts --emit-events`

---

## Learnings Extracted

1. **Object spread in loops is O(n²)** - Obvious in hindsight, catastrophic in practice
2. **Batching beats per-op updates** - 50-op batches balance responsiveness and performance
3. **structuredClone is expensive** - Worker message passing adds 5-10x overhead
4. **Mutation is fine when scoped** - React can't see mutations until you set the atom

---

## The Prime's Original Ask

> "define doom, go ham do your thing"

DOOM delivered. 25.9x faster at 500 elements. The generative containers will fly now.

---

## Next Steps

- [ ] Create floating panel component to consume benchmark events
- [ ] Add rAF-based batching for even smoother streaming UI
- [ ] Consider Web Worker for JSON parsing (if main thread blocking becomes an issue)

---

*Val out. The architecture remains vigilant.*
