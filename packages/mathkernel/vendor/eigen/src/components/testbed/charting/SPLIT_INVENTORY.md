# ChartingTestbed Symbol Inventory

Source: `src/components/testbed/ChartingTestbed.tsx`

## Composition shell concerns
- `ChartingTestbed` (route page composition)
- section assembly (Lifecycle + Gallery + Streaming + API blocks)

## Runtime / data concerns
- `ChartRuntimeMount`
- `makeSignalSeries`
- `makeBarSeries`
- `makeScatterSeries`
- `makeBurstSeries`

## Error + operation concerns
- `useExitRunner`
- `ErrorPanel`
- `useChartActions`
- `useAutoChart`

## Card concerns
- `LifecycleOpsCard`
- `SignalGalleryCard`
- `StreamingSciChartCard`

## Shared style / state helpers
- `chartSurfaceStyle`
- `resolveIndicator`

## Candidate extraction ownership
- `runtime/`: `ChartRuntimeMount`
- `data/`: series factory functions
- `hooks/`: `useExitRunner`, `useChartActions`, `useAutoChart`, stream hook
- `components/`: `ErrorPanel`, stream diagnostics row
- `cards/`: lifecycle/gallery/stream cards
- `constants/`: `chartSurfaceStyle`, indicator helpers
- `page shell`: `ChartingTestbed` only
