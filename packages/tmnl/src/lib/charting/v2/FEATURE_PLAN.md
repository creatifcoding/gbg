# Charting v2 Library Split Plan

Scope: `src/lib/charting/v2/**`
Priority: critical
Feature ID: `#F303` (Charting v2 Library Boundary Split)

## Why

The primary risk is maintainability and correctness drift in library code (not just testbed composition).
Current concentration points:
- `adapters/echarts.ts` mixes projection, option-builders, data-apply, and instance lifecycle.
- `adapters/scichart.ts` mixes bootstrap (module/licensing/wasm), series mutation engine, and lifecycle.
- `theme.ts` mixes token source + ECharts mapping + SciChart mapping.
- `atoms.ts` combines state, families, ops, and cleanup internals.

## Target Structure

```text
src/lib/charting/v2/
  index.ts
  schemas.ts
  errors.ts
  types.ts

  theme/
    index.ts
    tokens.ts
    contracts.ts
    echarts.ts
    scichart.ts

  adapters/
    index.ts
    types.ts
    shared/
      projection.ts
      boundedSeries.ts
    echarts/
      index.ts
      lifecycle.ts
      data.ts
      options/
        base.ts
        line.ts
        area.ts
        bar.ts
        scatter.ts
        candlestick.ts
        index.ts
    scichart/
      index.ts
      lifecycle.ts
      bootstrap.ts
      seriesEngine.ts

  runtime/
    index.ts
    service.ts
    registry.ts
    instances.ts

  atoms/
    index.ts
    state.ts
    families.ts
    ops.ts
    internal.ts

  __tests__/
    runtime.test.ts
    atoms.test.ts
    hotpath.test.ts
    adapters-theme.test.ts
```

## Hard Boundaries

1. **Theme layer is pure mapping**
   - `tokens.ts` is canonical source.
   - renderer mappings never define new raw colors/sizes.

2. **Adapters consume shared projection utils**
   - no duplicated projection switches in each adapter.

3. **Lifecycle split from data mutation**
   - lifecycle modules own mount/unmount/dispose state machine.
   - data modules own set/append/clear/apply semantics.

4. **Atoms split by responsibility**
   - `state.ts`: Atom.make declarations only.
   - `families.ts`: selector families only.
   - `ops.ts`: operational mutations only.
   - `internal.ts`: map helpers, requireInstance, cleanupRegistration.

5. **Public API stability first**
   - keep root `index.ts` stable during migration via compatibility barrels.

## Execution Phases

### Phase 1 — Contract Freeze
- snapshot export surface and adapter/runtime invariants.

### Phase 2 — Theme Decomposition
- split `theme.ts` into `theme/*` modules with parity-preserving tests.

### Phase 3 — Adapter Modularization
- split ECharts and SciChart into lifecycle/data/bootstrap/options modules.
- isolate streaming hot-path mutations in `scichart/seriesEngine.ts`.

### Phase 4 — Runtime + Atoms Split
- split runtime internals and atom layers with no behavior change.

### Phase 5 — Validation + Docs
- add hot-path tests (`appendPointFast`, `appendBatchFast`, maxPoints trim).
- add adapter/theme snapshot checks.
- add `ARCHITECTURE.md` for extension guidance.

### Phase 6 — Cutover + Cleanup
- migrate imports to new module tree.
- remove transitional monolith files.

## Regression Matrix

```bash
bunx tsc --noEmit --pretty false
bunx vitest run src/lib/charting/v2/__tests__/runtime.test.ts src/lib/charting/v2/__tests__/atoms.test.ts
bunx vitest run src/lib/iiot/adapters/__tests__/integration/channel-ingestion.integration.test.ts src/lib/geoint/__tests__/integration/channel-flight-events.integration.test.ts src/lib/geoint/__tests__/integration/channel-trackstore-bridge.integration.test.ts
```

## Immediate Next Step

Start with **Phase 2 theme split** (lowest risk, highest structural gain), then adapter extraction.
