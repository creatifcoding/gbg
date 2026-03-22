# Charting v2 Library Boundary Split — Completion Record

Feature: `#F303`
Status: **closed**
Completion: **100% (6/6 sub-features)**
Scope: `src/lib/charting/v2/**`

---

## What was delivered

### 1) Theme system decomposition
Split theme concerns into dedicated v2-native modules:

- `theme/tokens.ts`
- `theme/contracts.ts`
- `theme/echarts.ts`
- `theme/scichart.ts`
- `theme/index.ts`

Removed legacy compatibility path (`theme.ts` shim) and moved consumers to modular theme exports.

### 2) Adapter modularization (ECharts + SciChart)
Refactored adapters into thin orchestration shells with internal modules for lifecycle and rendering logic.

**ECharts:**
- `adapters/echarts/lifecycle.ts`
- `adapters/echarts/data.ts`
- `adapters/echarts/options/{base,line,area,bar,scatter,candlestick}/index.ts`
- table-driven option builder dispatch (`OPTION_BUILDERS`)

**SciChart:**
- `adapters/scichart/bootstrap.ts`
- `adapters/scichart/lifecycle.ts`
- `adapters/scichart/series/*`
- isolated series engine + streaming hot-path behavior

### 3) Runtime and atoms split
Modularized runtime/atoms internals and removed compatibility shims.

- runtime internals: `runtime/registry.ts`, `runtime/instances.ts`
- atoms modules: `atoms/state.ts`, `atoms/families.ts`, `atoms/internal.ts`, `atoms/ops.ts`, `atoms/index.ts`
- removed `atoms.ts` shim

### 4) Typed key discipline with Effect HashMap
Adopted typed map keys for runtime/atom maps:

- `keys.ts` (`ChartMapKey`, `toChartMapKey`)
- map state migrated to Effect `HashMap` with typed keying

### 5) SciChart React/Vite resolution fix + streaming path hardening
Resolved critical mount failure and stabilized high-frequency update behavior.

- fixed invalid dynamic import pattern causing
  `ChartMountError: Module name, 'scichart' does not resolve to a valid URL`
- added wasm bootstrap flow
- preserved fast append strategies (`appendPointFast`, `appendBatchFast`) with bounded trimming

### 6) Architecture and verification artifacts
Added explicit library boundary documentation and tests:

- `ARCHITECTURE.md`
- `__tests__/hotpath.test.ts`
- `__tests__/options-theme.test.ts`
- strengthened `__tests__/atoms.test.ts`

---

## Validation evidence

Executed and passing during closeout:

```bash
bunx tsc --noEmit --pretty false
bunx vitest run \
  src/lib/charting/v2/__tests__/runtime.test.ts \
  src/lib/charting/v2/__tests__/atoms.test.ts \
  src/lib/charting/v2/__tests__/hotpath.test.ts \
  src/lib/charting/v2/__tests__/options-theme.test.ts
```

Result at close: charting-v2 regression matrix green.

---

## Sub-feature closure

- `#F304` Phase 1 — Contract freeze + import surface audit ✅
- `#F305` Phase 2 — Theme system decomposition ✅
- `#F306` Phase 3 — Adapter modularization ✅
- `#F307` Phase 4 — Runtime and atoms split ✅
- `#F308` Phase 5 — Validation and docs ✅
- `#F309` Phase 6 — Controlled cutover + cleanup ✅

---

## Implementation commits (key)

- `cb8a50c` fix(charting-v2): resolve SciChart vite import failure
- `d01b4e3` perf(charting-v2): improve streaming hot path + diagnostics
- `77018c6` docs(charting-v2): library boundary split plan (superseded by this completion record)
- `74f79ac` refactor(charting-v2): theme modularization
- `ba6e114` refactor(charting-v2): atoms/runtime modular split + typed maps
- `c924145` refactor(charting-v2): adapter lifecycle/series modularization
- `9978a9d` test(charting-v2): add hotpath/theme-option coverage
- `d272f0d` docs(charting-v2): architecture boundary document

---

## Notes

This file now serves as a completion artifact (not an active plan). Feature `#F303` is fully closed and library boundary refactor is complete.
