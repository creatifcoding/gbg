/**
 * Chart Styler Atoms
 *
 * Per-chart style state management using effect-atom.
 * Provides isolated style state for each chart instance with
 * derived atoms for resolved G2 themes.
 *
 * Pattern: Atom.family + registry.set() + useAtomValue()
 *
 * @module charts/styler/atoms
 */

import { Atom } from '@effect-atom/atom-react';
import type {
  ChartStyleId,
  ChartStyleState,
  StylePatch,
} from './schemas';
import {
  DEFAULT_STYLE_STATE,
  applyStylePatch,
} from './schemas';
import {
  VANTA_G2_THEME_DARK,
  VANTA_G2_THEME_LIGHT,
  mergeThemeOverrides,
  type G2ThemeConfig,
  type ThemeOverrides,
} from '../themes';

// =============================================================================
// Per-Chart Style Atoms (Atom.family Pattern)
// =============================================================================

/**
 * Per-chart style state.
 *
 * Each chart gets its own style state, preventing style changes
 * from affecting other charts.
 *
 * @example
 * ```ts
 * const styleAtom = chartStyleFamily(chartId)
 * const style = registry.get(styleAtom)
 * registry.set(styleAtom, { ...style, colorPalette: ['#ff0000'] })
 * ```
 */
export const chartStyleFamily = Atom.family(
  (_chartId: ChartStyleId) => Atom.make<ChartStyleState>(DEFAULT_STYLE_STATE)
);

/**
 * Per-chart streaming flag.
 *
 * Indicates whether the chart is receiving streaming style updates.
 * Used to show loading indicators and debounce renders.
 */
export const chartIsStreamingFamily = Atom.family(
  (_chartId: ChartStyleId) => Atom.make<boolean>(false)
);

/**
 * Per-chart style confidence score.
 *
 * Separate atom for quick access to confidence without reading full state.
 * Updated alongside chartStyleFamily.
 */
export const chartConfidenceFamily = Atom.family(
  (_chartId: ChartStyleId) => Atom.make<number>(0)
);

// =============================================================================
// Derived Theme Atoms
// =============================================================================

/**
 * System theme preference.
 * Should be updated by a ThemeProvider that detects system/user preference.
 */
export const systemThemeAtom = Atom.make<'dark' | 'light'>('dark').pipe(
  Atom.keepAlive
);

/**
 * Resolved G2 theme for a chart.
 *
 * Computes the final G2ThemeConfig from:
 * 1. Style state baseTheme (or system theme if 'system')
 * 2. Color palette overrides
 * 3. Typography overrides
 * 4. Axis overrides
 *
 * @example
 * ```tsx
 * const resolvedTheme = useAtomValue(chartResolvedThemeFamily(chartId))
 * <Line theme={resolvedTheme} />
 * ```
 */
export const chartResolvedThemeFamily = Atom.family(
  (chartId: ChartStyleId) =>
    Atom.make((get): G2ThemeConfig => {
      const styleState = get(chartStyleFamily(chartId));
      const systemTheme = get(systemThemeAtom);

      // Determine base theme
      const baseThemeVariant =
        styleState.baseTheme === 'system' ? systemTheme : styleState.baseTheme;
      const baseTheme =
        baseThemeVariant === 'light' ? VANTA_G2_THEME_LIGHT : VANTA_G2_THEME_DARK;

      // No overrides? Return base theme directly
      if (
        !styleState.colorPalette &&
        !styleState.typography &&
        !styleState.axis
      ) {
        return baseTheme;
      }

      // Build overrides object
      const overrides: ThemeOverrides = {};

      if (styleState.colorPalette) {
        overrides.color = styleState.colorPalette[0];
        overrides.category10 = styleState.colorPalette.slice(0, 10);
        // Extend to 20 if needed
        if (styleState.colorPalette.length < 20) {
          const extended = [...styleState.colorPalette];
          while (extended.length < 20) {
            extended.push(styleState.colorPalette[extended.length % styleState.colorPalette.length]);
          }
          overrides.category20 = extended;
        } else {
          overrides.category20 = styleState.colorPalette.slice(0, 20);
        }
      }

      if (styleState.typography) {
        overrides.axis = {
          ...overrides.axis,
          labelFontFamily: styleState.typography.family,
          labelFontSize: styleState.typography.size,
        };
        overrides.legend = {
          labelFontFamily: styleState.typography.family,
          labelFontSize: styleState.typography.size,
        };
      }

      if (styleState.axis) {
        overrides.axis = {
          ...overrides.axis,
          ...styleState.axis,
        };
      }

      return mergeThemeOverrides(baseTheme, overrides);
    })
);

// =============================================================================
// Bundle Accessor
// =============================================================================

/**
 * Bundle of all atoms for a specific chart instance.
 */
export interface ChartStyleAtoms {
  /** Primary style state atom */
  readonly style: ReturnType<typeof chartStyleFamily>;
  /** Streaming flag atom */
  readonly isStreaming: ReturnType<typeof chartIsStreamingFamily>;
  /** Confidence score atom */
  readonly confidence: ReturnType<typeof chartConfidenceFamily>;
  /** Resolved G2 theme (derived) */
  readonly resolvedTheme: ReturnType<typeof chartResolvedThemeFamily>;
}

/**
 * Get all style atoms for a specific chart instance.
 *
 * @example
 * ```ts
 * const atoms = getChartStyleAtoms(chartId)
 * registry.set(atoms.isStreaming, true)
 * const theme = registry.get(atoms.resolvedTheme)
 * ```
 */
export function getChartStyleAtoms(chartId: ChartStyleId): ChartStyleAtoms {
  return {
    style: chartStyleFamily(chartId),
    isStreaming: chartIsStreamingFamily(chartId),
    confidence: chartConfidenceFamily(chartId),
    resolvedTheme: chartResolvedThemeFamily(chartId),
  };
}

// =============================================================================
// Registry Operations
// =============================================================================

/**
 * Operations for modifying chart style state.
 *
 * These functions return operations that should be executed with a registry:
 * ```ts
 * const registry = Registry.make()
 * const ops = createChartStyleOps(chartId)
 * ops.setIntent('cyberpunk', registry)
 * ```
 */
export function createChartStyleOps(chartId: ChartStyleId) {
  const atoms = getChartStyleAtoms(chartId);

  return {
    /**
     * Apply a style patch to the chart.
     */
    applyPatch: (
      patch: StylePatch,
      registry: { get: <T>(atom: Atom.Atom<T>) => T; set: <T>(atom: Atom.Writable<T>, value: T) => void }
    ): void => {
      const current = registry.get(atoms.style);
      const updated = applyStylePatch(current, patch);
      registry.set(atoms.style, updated);
      if (patch.confidence !== undefined) {
        registry.set(atoms.confidence, patch.confidence);
      }
    },

    /**
     * Set streaming state.
     */
    setStreaming: (
      isStreaming: boolean,
      registry: { set: <T>(atom: Atom.Writable<T>, value: T) => void }
    ): void => {
      registry.set(atoms.isStreaming, isStreaming);
    },

    /**
     * Set base theme variant.
     */
    setBaseTheme: (
      theme: 'dark' | 'light' | 'system',
      registry: { get: <T>(atom: Atom.Atom<T>) => T; set: <T>(atom: Atom.Writable<T>, value: T) => void }
    ): void => {
      const current = registry.get(atoms.style);
      registry.set(atoms.style, { ...current, baseTheme: theme });
    },

    /**
     * Set color palette.
     */
    setPalette: (
      palette: string[] | null,
      registry: { get: <T>(atom: Atom.Atom<T>) => T; set: <T>(atom: Atom.Writable<T>, value: T) => void }
    ): void => {
      const current = registry.get(atoms.style);
      registry.set(atoms.style, { ...current, colorPalette: palette, updatedAt: Date.now() });
    },

    /**
     * Set styling intent.
     */
    setIntent: (
      intent: string | null,
      registry: { get: <T>(atom: Atom.Atom<T>) => T; set: <T>(atom: Atom.Writable<T>, value: T) => void }
    ): void => {
      const current = registry.get(atoms.style);
      registry.set(atoms.style, { ...current, intent, updatedAt: Date.now() });
    },

    /**
     * Reset to default state.
     */
    reset: (
      registry: { get: <T>(atom: Atom.Atom<T>) => T; set: <T>(atom: Atom.Writable<T>, value: T) => void }
    ): void => {
      const current = registry.get(atoms.style);
      registry.set(atoms.style, { ...DEFAULT_STYLE_STATE, baseTheme: current.baseTheme });
      registry.set(atoms.confidence, 0);
      registry.set(atoms.isStreaming, false);
    },
  };
}

// =============================================================================
// Type Exports
// =============================================================================

export type { ChartStyleId, ChartStyleState, StylePatch } from './schemas';
