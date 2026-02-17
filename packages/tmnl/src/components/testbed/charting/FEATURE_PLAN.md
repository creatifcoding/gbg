# Charting Testbed v2 — Granular Modularization Plan

Status: proposed
Owner: charting/runtime
Scope: `/src/components/testbed/ChartingTestbed.tsx` decomposition only (no route behavior change)

---

## 1) Objective

Split the current monolithic `ChartingTestbed.tsx` into bounded modules so stream behavior, chart lifecycle, and UI composition are independently testable and maintainable.

### Success Criteria

1. `ChartingTestbed.tsx` becomes a thin composition shell (`< 200 LOC`).
2. Streaming pipeline is isolated in dedicated stream/hook modules with explicit diagnostics contract.
3. Lifecycle/ops, gallery, and streaming cards are each in their own files.
4. No `v1` token imports remain in charting-v2 testbed path.
5. Existing stream/channel integration tests remain green.

---

## 2) Target Directory Structure

```text
src/components/testbed/charting/
  index.ts
  ChartingTestbedPage.tsx                 # thin page shell + section composition

  constants/
    styles.ts                              # chartSurfaceStyle, shared card/input styles
    nav.ts                                 # top-nav links/labels if needed

  runtime/
    ChartRuntimeMount.tsx                  # atom subscriptions required for runtime warm-up

  data/
    seriesFactories.ts                     # makeSignalSeries/makeBarSeries/makeScatterSeries/makeBurstSeries

  hooks/
    useExitRunner.ts                       # Exit -> ErrorState normalization/logging
    useChartActions.ts                     # create/mount/set/append/clear/dispose wrappers
    useAutoChart.ts                        # mount lifecycle automation
    useStreamingSciChart.ts                # stream start/stop, fps, diagnostics, cleanup

  stream/
    makePointStream.ts                     # Effect/Stream point source + buffer params
    applyStreamBatch.ts                    # appendBatchFast/appendPointFast/appendData strategy
    diagnostics.ts                         # stream stats state helpers

  components/
    ErrorPanel.tsx
    StreamDiagnosticsRow.tsx               # MODE/BATCHES/PTS/LAST_FLUSH

  cards/
    LifecycleOpsCard.tsx
    SignalGalleryCard.tsx
    StreamingSciChartCard.tsx

  sections/
    LifecycleSection.tsx
    SignalGallerySection.tsx
    StreamingSection.tsx
    ApiReferenceSection.tsx

  __tests__/
    useStreamingSciChart.test.ts           # start/stop + cleanup + counters
    applyStreamBatch.test.ts               # strategy selection + maxPoints trimming
    charting-page-smoke.test.tsx           # Start Stream button toggles active updates

  ARCHITECTURE.md                          # module contracts + ownership boundaries
```

Route compatibility:
- Keep `src/components/testbed/ChartingTestbed.tsx` as compatibility shim:
  - `export { ChartingTestbedPage as ChartingTestbed } from './charting/ChartingTestbedPage'`
  - `export default ChartingTestbedPage`

---

## 3) Module Contracts (Hard Boundaries)

### `hooks/useStreamingSciChart.ts`
Owns:
- stream fiber lifecycle
- fps computation
- stream diagnostics (`mode`, `batches`, `pointsApplied`, `lastFlushMs`)
- teardown (`Fiber.interrupt` + optional `clearData`)

Must NOT own:
- card layout/markup
- chart creation/mount/dispose lifecycle outside stream session

### `stream/applyStreamBatch.ts`
Owns strategy in strict order:
1. `appendBatchFast(points, maxPoints)`
2. `appendPointFast(point, maxPoints)` per point
3. `appendData(points)` fallback

Must return deterministic apply metadata:
- `mode: 'batch' | 'point' | 'effect'`
- `appliedCount`
- `flushMs`

### `hooks/useChartActions.ts`
Owns all chartOps wrappers and Exit error normalization.
Single place where `useAtomSet(chartOps.*)` lives for this testbed.

### `data/seriesFactories.ts`
Pure functions only. No React hooks, no atom access.

---

## 4) Execution Plan (Incremental, No Big-Bang)

### Phase A — Contract Inventory
- Extract types: `ErrorState`, stream diagnostics type, action return contracts.
- Freeze current behavior with smoke tests before moving files.

### Phase B — Pure Utility Extraction
- Move `resolveIndicator` + series factories + styles constants first.
- Zero runtime behavior change expected.

### Phase C — Hook Extraction
- Move `useExitRunner`, `useChartActions`, `useAutoChart`.
- Keep component signatures unchanged.

### Phase D — Stream Isolation
- Implement `makePointStream.ts` and `applyStreamBatch.ts`.
- Introduce `useStreamingSciChart` hook and wire it into `StreamingSciChartCard`.
- Keep same controls (`Start/Stop`, `POINTS`, `TARGET FPS`).

### Phase E — UI/Card Split
- Move each card into `cards/`.
- Introduce `sections/` wrappers.
- Reduce page to composition shell.

### Phase F — Validation + Docs
- Add architecture doc and per-module responsibilities.
- Run regression suite and typecheck.

---

## 5) Test & Validation Matrix

Required checks:

```bash
bunx tsc --noEmit --pretty false
bunx vitest run src/components/testbed/charting/__tests__/*.test.ts*
bunx vitest run \
  src/lib/iiot/adapters/__tests__/integration/channel-ingestion.integration.test.ts \
  src/lib/geoint/__tests__/integration/channel-flight-events.integration.test.ts \
  src/lib/geoint/__tests__/integration/channel-trackstore-bridge.integration.test.ts
```

Manual acceptance:
1. Open `/testbed/charting`
2. Click **START STREAM**
3. Confirm diagnostics increment (`BATCHES`, `PTS APPLIED`)
4. Confirm line visibly updates and stop/clear works

---

## 6) Risk Controls

1. **Behavior drift during extraction**
   - Mitigation: extract pure modules first; defer stream hook extraction until smoke tests exist.

2. **Hidden import cycles**
   - Mitigation: enforce one-way layering: `stream -> hooks -> cards -> sections -> page`.

3. **Token regression (v1 leakage)**
   - Mitigation: replace `CHART_TOKENS` import with v2 theme constants in `constants/styles.ts`.

4. **Streaming cleanup bugs**
   - Mitigation: single cleanup owner in `useStreamingSciChart`; test teardown with repeated start/stop.

---

## 7) Out of Scope

- Re-architecting charting runtime (`src/lib/charting/v2`) internals.
- Changing renderer selection semantics.
- Introducing new chart types.

---

## 8) Deliverables

1. New `src/components/testbed/charting/` module tree (above)
2. Compatibility shim at original file path
3. Stream diagnostics preserved and test-covered
4. Architecture note (`ARCHITECTURE.md`)
