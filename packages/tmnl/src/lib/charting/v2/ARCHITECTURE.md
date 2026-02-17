# Charting v2 Architecture

## Public Consumption Contract

Consume from:
- `@/lib/charting/v2`

Primary React surface:
- `chartOps`
- `chartStateFamily`
- `chartInstanceFamily`
- `ChartSpec`, `ChartSeries`

Runtime/service surface:
- `ChartRuntime`

Do **not** consume internal modules directly (`adapters/*`, `atoms/internal`, `runtime/*`) unless extending library internals.

---

## Module Topology

- `schemas.ts` / `errors.ts` / `types.ts`: domain contracts
- `keys.ts`: typed internal map key (`ChartMapKey`)
- `theme/*`: tokens + renderer projections
- `adapters/*`: renderer-specific construction and data mutation
- `runtime.ts` + `runtime/*`: adapter registry + instance cache + lifecycle acquisition
- `atoms/*`: atom state/families/ops/internal helpers

### Directionality (allowed)

- `schemas|errors|types|keys` → foundation
- `theme` depends on foundation only
- `adapters` depends on foundation + theme
- `runtime` depends on foundation + adapters
- `atoms` depends on foundation + runtime
- `index.ts` re-exports public boundary

No reverse imports.

---

## Invariants

1. `create` must register spec + instance + state atom entries together.
2. `dispose` must clear instance/spec/state/release/subscription entries together.
3. `runtime.acquire` returns `{ instance, release }`; `release` must dispose adapter instance.
4. Hot-path append methods (`appendPointFast`, `appendBatchFast`) must enforce `maxPoints` trim.
5. Theme parity is shared by common `CHARTING_V2_THEME` contracts.

---

## Chart-type isolation

ECharts options are split by kind:
- `options/line`, `options/area`, `options/bar`, `options/scatter`, `options/candlestick`

SciChart series constructors are split by kind:
- `series/line`, `series/area`, `series/scatter`

Dispatch is table-driven (`OPTION_BUILDERS`) for ECharts and dispatcher-driven for SciChart (`createRenderableSeriesForKind`).
