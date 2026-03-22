# Target Directory Tree (Charting Testbed)

```text
src/components/testbed/charting/
  ChartingTestbedPage.tsx
  index.ts

  constants/
    styles.ts

  runtime/
    ChartRuntimeMount.tsx

  data/
    seriesFactories.ts

  hooks/
    useExitRunner.ts
    useChartActions.ts
    useAutoChart.ts
    useStreamingSciChart.ts

  stream/
    makePointStream.ts
    applyStreamBatch.ts
    diagnostics.ts

  components/
    ErrorPanel.tsx
    StreamDiagnosticsRow.tsx

  cards/
    LifecycleOpsCard.tsx
    SignalGalleryCard.tsx
    StreamingSciChartCard.tsx

  sections/
    LifecycleSection.tsx
    SignalGallerySection.tsx
    StreamingSection.tsx
    ApiReferenceSection.tsx
```

## Anti-cycle rules
- cards must not import page shell
- hooks must not import cards/sections
- stream modules are pure (no React)
- `ChartingTestbed.tsx` (legacy route file) becomes compatibility re-export only
