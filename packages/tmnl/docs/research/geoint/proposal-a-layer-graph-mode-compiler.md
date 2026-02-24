# GEOINT Agent Track A — Declarative Layer Graph + Mode Compiler

## Intent
Build a deterministic conversational GEOINT runtime by compiling intent into a declarative layer graph, then executing that graph through existing deck.gl layer factories.

## Why this track
TMNL already has strong rendering primitives (`src/lib/geoint/layers/{tracks,features,heatmap,searchResults}.ts`) and orchestration hooks (`GeointHarnessService`, `sdk.geoint.*`). Track A keeps those assets and adds a thin compile/plan layer instead of a rewrite.

## Architecture
1. **LayerGraph Schema (Effect Schema)**
   - Node types: `Data`, `Filter`, `Style`, `Layer`, `Interaction`.
   - Edge semantics: dependency + z-order constraints.
2. **Mode Compiler service**
   - Converts conversational intents into `CompiledModePlan` + graph diff.
   - Presets: `Recon`, `Track`, `Threat`, `PatternOfLife`.
3. **Graph Executor adapters**
   - Adapts graph nodes to current factories (`createTrackLayers`, `createFeatureLayers`, etc.).
4. **Unified control plane**
   - Route both `geoint_*` tools and `sdk.geoint.*` through compiler → executor.

## Runtime flow
1. Operator/tool submits intent (`show flights in AOI with labels`).
2. Compiler resolves context (viewport, selected entities, visibility profile).
3. Compiler outputs deterministic layer graph + incremental diff.
4. Executor applies diff into deck.gl layer descriptors.
5. Pick/hover events feed back into stx + harness atoms; only affected subgraph re-evaluates.

## Risks
- Compiler complexity can drift if bypass paths remain.
- Over-recompute risk if graph invalidation is too coarse.

## Incremental migration
- **A0:** Wrap existing layer factories as executor adapters.
- **A1:** Build graph in shadow mode and parity-check against current map output.
- **A2:** Cut over `geoint_search/spawn/select/summary` to compiler pipeline.
- **A3:** Cut over `sdk.geoint.*`; remove manual layer assembly.

## Code anchors
- `src/lib/geoint/layers/index.ts`
- `src/lib/geoint/components/GeointMap.tsx`
- `src/lib/geoint/harness/GeointHarnessService.ts`
- `src/lib/genifer/code-mode/sandbox.ts`

## Research inputs used (DeepWiki / Exa / Context7)
- deck.gl reactive layer diffing + high-frequency update guidance (DeepWiki):
  - https://deepwiki.com/search/what-are-the-recommended-patte_c5be2967-aa3a-4774-8278-62e46bc08ad5
- deck.gl performance and update triggers (Exa + Context7):
  - https://deck.gl/docs/developer-guide/performance
  - https://github.com/visgl/deck.gl/discussions/6869
  - https://github.com/visgl/deck.gl/blob/master/docs/api-reference/core/layer.md
  - https://github.com/visgl/deck.gl/blob/master/docs/api-reference/core/composite-layer.md
