# Phase 2: Per-Chart Style Atoms

**Feature**: chart-styling
**Date**: 2026-01-18
**Status**: complete

## Files Touched

- src/lib/charts/styler/schemas.ts (created)
- src/lib/charts/styler/atoms.ts (created)
- src/lib/charts/styler/index.ts (created)
- src/lib/charts/index.ts (modified - added styler export)
- scripts/spike-chart-styling-phase-2.ts (created)

## Implementation Summary

Created per-chart style state management using effect-atom patterns:

1. **schemas.ts**: Effect Schema classes for `ChartStyleState`, `StylePatch`, `StylerInput/Output`, branded `ChartStyleId`, and utility functions `applyStylePatch()` and `resetStyleState()`.

2. **atoms.ts**: Atom.family pattern for per-chart isolation:
   - `chartStyleFamily(chartId)` - Primary style state atom
   - `chartIsStreamingFamily(chartId)` - Streaming flag atom
   - `chartConfidenceFamily(chartId)` - Confidence score atom
   - `chartResolvedThemeFamily(chartId)` - Derived G2 theme from state
   - `systemThemeAtom` - Global system theme (dark/light)
   - `getChartStyleAtoms()` - Bundle accessor
   - `createChartStyleOps()` - Registry operations factory

3. **index.ts**: Clean barrel exports for schemas, atoms, and types.

## Verification

### Type Safety
- [x] bunx tsc --noEmit passed (no errors)

### Runtime Smoke
- [x] Spike script executed successfully
- Script: scripts/spike-chart-styling-phase-2.ts
- Results: 4/4 hypotheses passed
  - H1: Atom Creation - default state correct
  - H2: State Mutations - registry.set() and applyStylePatch work
  - H3: Derived Theme - computes G2 theme from state
  - H4: Multi-Chart Isolation - independent state per chartId

### Export Resolution
- [x] Imports resolve from @/lib/charts/styler
- [x] Re-exported through src/lib/charts/index.ts

## Key Patterns Used

| Pattern | Implementation |
|---------|----------------|
| `Atom.family` | Per-chart isolation with stable references |
| `Atom.make((get) => derived)` | Derived atoms for resolved themes |
| `Atom.keepAlive` | System theme atom persists |
| `registry.set()` | Sync mutations in React callbacks |
| `Schema.brand()` | Branded ChartStyleId type |

## Learnings

1. Atom.family with branded IDs provides type-safe per-instance isolation
2. Derived atoms (using `get()` in Atom.make) auto-update when dependencies change
3. systemThemeAtom with Atom.keepAlive ensures global theme preference persists
4. Bundle accessors (getChartStyleAtoms) simplify multi-atom management

## Next

Phase 3: ChartRenderer Integration
- Create useChartWithStyle hook
- Modify ChartRenderer to accept theme/chartId props
- Test end-to-end rendering with VANTA themes
