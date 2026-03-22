# Overlay Reducer Pipeline Architecture (Fork/Join + Collector)

Date: 2026-02-11  
Owner: Val

## Problem

`chat:v2/provider_marker` gives us rich low-level signal, but current consumers (`PiProvider`, `agent-chat-stx`) still mostly do direct event-to-state mutation. That blocks:

- composable overlay registration,
- concurrent/forked specialized rendering,
- dual output lanes (state patches + render nodes),
- controlled coalescing/bucketing with deterministic reconciliation.

## Target model (aligned)

From alignment pass:

- **Shape:** hybrid plugin model (schema-backed overlay + optional renderer)
- **Composition:** fork/join semantics with collector
- **API:** dual output (`patches` + `render nodes`)
- **Partitioning:** adaptive multi-key buckets
- **Immediate bypass:** error/terminal/tool lifecycle/extension UI classes

---

## Transferable patterns from TipTap

1. **Priority-ordered extension pipeline**  
   TipTap sorts extensions by `priority` and composes plugin order explicitly, including reverse/sort behavior for dispatch order.  
   Evidence:
   - `packages/core/src/helpers/sortExtensions.ts` (priority descending)
   - `packages/core/src/ExtensionManager.ts` (`plugins`, `dispatchTransaction` composition)
   - `tests/cypress/integration/core/pluginOrder.spec.ts` (execution order verification)

2. **Middleware-style transaction chaining (`next`)**  
   Extensions can intercept transaction flow via `dispatchTransaction({ transaction, next })`. This is directly analogous to overlay reducers forwarding collector input.
   Evidence:
   - `packages/core/src/ExtensionManager.ts` lines around dispatch reducer
   - `packages/core/src/types.ts` `DispatchTransactionProps`

3. **Context-bound extension capabilities**  
   TipTap resolves extension fields via `getExtensionField` with context (options/storage/editor/type), enabling inheritance and override without leaking internals.
   Evidence:
   - `packages/core/src/helpers/getExtensionField.ts`
   - `packages/core/src/ExtensionManager.ts` context construction

4. **Event surface separation**  
   TipTap keeps transaction events (`beforeTransaction`, `transaction`, `selectionUpdate`, `update`) distinct. We should mirror this by separating marker ingest from collected render emissions.
   Evidence:
   - `packages/core/src/Editor.ts` dispatch flow

---

## Transferable patterns from Streamdown

1. **Streaming-specific mode + static mode split**  
   Streamdown explicitly separates streaming behavior from static rendering, avoiding one-path complexity.
   Evidence:
   - `packages/streamdown/index.tsx` `mode: "streaming" | "static"`

2. **Pre-parse repair for incomplete streams**  
   Streamdown applies `remend()` before block parse to stabilize partial markdown. Equivalent in TMNL: normalize/repair marker fragments before expensive transforms.
   Evidence:
   - `packages/streamdown/index.tsx` `processedChildren`

3. **Block partitioning before render**  
   Streamdown partitions markdown into blocks and renders block-by-block for lower incremental cost. Equivalent: bucket + lane segmentation before overlay execution.
   Evidence:
   - `packages/streamdown/lib/parse-blocks.tsx`
   - `packages/streamdown/index.tsx` block render map

4. **Ordered plugin merges with before/after hooks**  
   Streamdown merges plugin lists with explicit order constraints (e.g. CJK before/after GFM). Equivalent: overlay execution ordering per lane + collector precedence.
   Evidence:
   - `packages/streamdown/lib/plugin-types.ts`
   - `packages/streamdown/index.tsx` mergedRemarkPlugins

5. **Memoization + transition-aware updates**  
   `useMemo` and `useTransition` reduce churn in streaming mode. Equivalent: stage A ingest is minimal, stage B flush does bounded commits.
   Evidence:
   - `packages/streamdown/index.tsx`

---

## Proposed TMNL pipeline

## Stage graph

1. **Ingest** (`HarnessEvent` → `RenderReducerInput`)  
2. **Partition** (adaptive bucket key)  
3. **Classify bypass** (immediate classes)  
4. **Fork** (run matching overlays concurrently)  
5. **Join/Collect** (deterministic merge by priority)  
6. **Emit** (`RenderReducerEmission` with `patches` + `nodes`)

## Deterministic rules

- per-bucket ordering is preserved by seq
- collector merges overlays in priority-desc order
- immediate classes flush pending bucket before pass-through
- unknown marker class is never dropped (diagnostic + passthrough)

---

## New implementation scaffold (added)

### Files

- `src/lib/harness/rendering/schemas.ts`
- `src/lib/harness/rendering/OverlayReducerPipeline.ts`
- `src/lib/harness/rendering/index.ts`

### Contracts

- `RenderReducerInput` (schema class)
- `RenderPatch` + `RenderNode`
- `RenderOverlayOutput`
- `RenderReducerEmission`
- `RenderOverlayRegistration` (run function + priority + match lanes/classes)
- `OverlayReducerPipeline` service (`register`, `unregister`, `list`, `ingest`, `flushBucket`, `outputs`)

This is now phase-1.5 scaffolding: fork/join + collector is in place **with active `N/T`-style bucket coalescing controls** (`maxBatchSize`, `maxWaitMs`) and immediate bypass classes. Frame/rAF alignment and adaptive policies remain next.

---

## Integration status (current cut)

1. **PiProvider path (landed)**
   - maps `HarnessEvent` → `RenderReducerInput` for provider markers + key high-level events
   - feeds inputs into `OverlayReducerPipeline.ingest`
   - subscribes to `OverlayReducerPipeline.outputs`
   - emits reducer-derived metrics (`renderTransformBatchMs`, `renderBacklogDepth`) into provider-side harness metrics map

2. **agent-chat-stx path (landed)**
   - consumes `RenderReducerEmission` stream for testbed visualization
   - preserves existing message rendering as fallback lane

3. **Coalescing evolution (next)**
   - optional frame-aligned scheduler (`rAF` abstraction) for UI lanes
   - adaptive `N/T` policy by lane/workload
   - SLO gate wiring for p95/p99 latency + backlog

---

## Anti-patterns to avoid

- global one-queue reducer for all sessions/lanes
- deep transcript rebuild per delta
- overlay side-effects mutating shared state outside collector
- non-deterministic join order from concurrent overlays
- silent drop of unknown markers

---

## Open decisions for Prime

1. Canonical adaptive key fallback: `(sessionId,messageId,lane)` vs `(sessionId,lane)`?
2. Collector merge conflict policy: last-wins vs path-priority vs explicit conflict records?
3. Overlay runtime location: provider-only, STX-only, or shared core + dual consumers?
4. Whether `RenderReducerEmission` should be promoted into `src/lib/harness/schemas.ts` as public contract.

---

## Related docs

- `./custom-rendering-pipeline-architecture.md`
- `./delta-coalescing-research.md`
- `./delta-coalescing-rigorous-model.md`
- `./bibliography.md`
- `../benchmarks/overlay-reducer-pipeline-benchmark-report.md`
