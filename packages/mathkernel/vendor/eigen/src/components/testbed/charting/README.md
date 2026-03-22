# Charting Testbed Modular Architecture

Route surface:
- `src/components/testbed/ChartingTestbed.tsx` (compat export shell)
- `src/components/testbed/charting/ChartingTestbedPage.tsx` (page composition)

## Modules

- `constants/` — style + indicator helpers
- `data/` — deterministic chart sample data factories
- `runtime/` — runtime atom mount bridge
- `hooks/` — chart operations + auto lifecycle + streaming orchestration
- `stream/` — stream generator + batch apply strategy + diagnostics types
- `components/` — reusable subcomponents (`ErrorPanel`)
- `cards/` — lifecycle/gallery/streaming cards

## Streaming contract

`useStreamingSciChart` owns stream lifecycle:
- starts only when `state === READY && isStreaming`
- applies points by precedence:
  1. `appendBatchFast`
  2. `appendPointFast`
  3. `appendData` fallback
- interrupts fiber on cleanup
- exposes `fps` and diagnostics (`mode`, `batches`, `pointsApplied`, `lastFlushMs`)

## Troubleshooting

If stream looks idle:
1. verify card state is `READY`
2. verify instance has `appendBatchFast`/`appendPointFast` or `appendData` fallback path
3. verify diagnostics counters increment (`BATCHES`, `PTS APPLIED`)
4. confirm cleanup resets counters on stop/unmount
