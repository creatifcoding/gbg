# Phase 1: G2 Theme Infrastructure

**Feature**: chart-styling
**Date**: 2026-01-18
**Status**: complete

## Files Touched

- src/lib/charts/themes/vanta-theme.ts (created)
- src/lib/charts/themes/palettes.ts (created)
- src/lib/charts/themes/merge.ts (created)
- src/lib/charts/themes/index.ts (created)
- src/lib/charts/index.ts (modified - added themes export)
- scripts/spike-chart-styling-phase-1.ts (created)

## Implementation Summary

Created G2-compatible theme infrastructure that maps VANTA design tokens to Ant Design Charts theming. The system provides:

1. **vanta-theme.ts**: Theme factory `createVantaG2Theme()` that creates dark/light themes with VANTA colors for surfaces, text, axes, legends, tooltips, annotations, and geometry defaults. Pre-built `VANTA_G2_THEME_DARK` and `VANTA_G2_THEME_LIGHT` exports.

2. **palettes.ts**: Intent-based palettes (emphasize-trend, compare-categories, cyberpunk, etc.) and category-based palettes (trend, comparison, part-to-whole, distribution, flow, etc.) derived from VANTA accent colors.

3. **merge.ts**: Theme merging utilities including `mergeThemeOverrides()` for partial updates, `applyPaletteToTheme()` for quick palette application, and `composeThemeOverrides()` for chaining multiple overrides.

## Verification

### Type Safety
- [x] bunx tsc --noEmit passed (no errors for themes files)

### Runtime Smoke
- [x] Spike script executed successfully
- Script: scripts/spike-chart-styling-phase-1.ts
- Results: 4/4 hypotheses passed
  - H1: Theme Factory - creates valid G2ThemeConfig
  - H2: Color Palettes - returns valid arrays for intents and categories
  - H3: Theme Merge - correctly applies partial overrides
  - H4: Type Safety - all types exported and usable

### Export Resolution
- [x] Imports resolve from @/lib/charts/themes
- [x] Re-exported through src/lib/charts/index.ts

## Learnings

1. G2ThemeConfig needs comprehensive structure for axis, legend, tooltip, annotation, and geometry styling
2. VANTA tokens map naturally to chart theming with surface colors for backgrounds and accent colors for data
3. The 10-color categorical palette uses VANTA accent colors in both full and muted variants
4. Deep merge utilities needed for partial theme updates without losing nested properties

## Next

Phase 2: Per-Chart Style Atoms
- Create Effect Schema classes for style state
- Implement Atom.family for per-chart isolation
- Create derived atoms for resolved themes
