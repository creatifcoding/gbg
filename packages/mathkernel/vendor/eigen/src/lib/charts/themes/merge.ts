/**
 * Theme Merge Utilities
 *
 * Functions for merging partial theme overrides into base themes.
 * Enables progressive style application from streaming or atom updates.
 *
 * @module charts/themes/merge
 */

import type { G2ThemeConfig } from './vanta-theme';

// =============================================================================
// Types
// =============================================================================

/**
 * Partial theme overrides that can be merged into a base theme.
 * All fields are optional to support incremental updates.
 */
export interface ThemeOverrides {
  /** Override primary color */
  color?: string;
  /** Override categorical palette */
  category10?: string[];
  /** Override extended palette */
  category20?: string[];
  /** Override view backgrounds */
  view?: Partial<G2ThemeConfig['view']>;
  /** Override axis styling */
  axis?: Partial<G2ThemeConfig['axis']>;
  /** Override legend styling */
  legend?: Partial<G2ThemeConfig['legend']>;
  /** Override geometry defaults */
  geometry?: Partial<G2ThemeConfig['geometry']>;
  /** Override annotation styling */
  annotation?: Partial<G2ThemeConfig['annotation']>;
}

// =============================================================================
// Deep Merge Utilities
// =============================================================================

/**
 * Type guard for plain objects.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep merge two objects.
 * Arrays are replaced, not merged.
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (sourceValue === undefined) {
      continue;
    }

    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      // Recursively merge nested objects
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T];
    } else {
      // Replace value (including arrays)
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

// =============================================================================
// Theme Merge Functions
// =============================================================================

/**
 * Merge partial overrides into a base G2 theme.
 *
 * Supports incremental updates where only changed properties are provided.
 * Nested objects are deep-merged; arrays are replaced entirely.
 *
 * @param baseTheme - The base G2 theme configuration
 * @param overrides - Partial overrides to apply
 * @returns New theme with overrides applied
 *
 * @example
 * ```ts
 * const customTheme = mergeThemeOverrides(VANTA_G2_THEME_DARK, {
 *   color: '#ff00ff',
 *   category10: ['#ff00ff', '#00ffff', '#ffff00'],
 *   axis: { labelFontSize: 14 },
 * })
 * ```
 */
export function mergeThemeOverrides(
  baseTheme: G2ThemeConfig,
  overrides: ThemeOverrides
): G2ThemeConfig {
  // Start with a shallow copy
  const result: G2ThemeConfig = { ...baseTheme };

  // Merge top-level primitives
  if (overrides.color !== undefined) {
    result.color = overrides.color;
  }
  if (overrides.category10 !== undefined) {
    result.category10 = overrides.category10;
  }
  if (overrides.category20 !== undefined) {
    result.category20 = overrides.category20;
  }

  // Deep merge nested objects
  if (overrides.view !== undefined) {
    result.view = deepMerge(baseTheme.view, overrides.view);
  }
  if (overrides.axis !== undefined) {
    result.axis = deepMerge(baseTheme.axis, overrides.axis);
  }
  if (overrides.legend !== undefined) {
    result.legend = deepMerge(baseTheme.legend, overrides.legend);
  }
  if (overrides.geometry !== undefined) {
    result.geometry = deepMerge(baseTheme.geometry, overrides.geometry);
  }
  if (overrides.annotation !== undefined) {
    result.annotation = deepMerge(baseTheme.annotation, overrides.annotation);
  }

  return result;
}

/**
 * Apply a color palette to a theme.
 *
 * Convenience function that sets both primary color and categorical palettes.
 *
 * @param baseTheme - The base G2 theme configuration
 * @param palette - Color palette array
 * @returns New theme with palette applied
 *
 * @example
 * ```ts
 * import { INTENT_PALETTES } from './palettes'
 *
 * const cyberpunkTheme = applyPaletteToTheme(
 *   VANTA_G2_THEME_DARK,
 *   INTENT_PALETTES['cyberpunk']
 * )
 * ```
 */
export function applyPaletteToTheme(
  baseTheme: G2ThemeConfig,
  palette: string[]
): G2ThemeConfig {
  return mergeThemeOverrides(baseTheme, {
    color: palette[0],
    category10: palette.slice(0, 10),
    category20: extendTo20(palette),
  });
}

/**
 * Extend a palette to 20 colors by cycling and adding variations.
 */
function extendTo20(palette: string[]): string[] {
  if (palette.length >= 20) {
    return palette.slice(0, 20);
  }

  const result = [...palette];

  // Add 70% opacity variations
  for (const color of palette) {
    if (result.length >= 20) break;
    result.push(addOpacity(color, 0.7));
  }

  // Add 50% opacity variations
  for (const color of palette) {
    if (result.length >= 20) break;
    result.push(addOpacity(color, 0.5));
  }

  // Cycle original colors if still not enough
  let i = 0;
  while (result.length < 20) {
    result.push(palette[i % palette.length]);
    i++;
  }

  return result.slice(0, 20);
}

/**
 * Add opacity to a hex color.
 */
function addOpacity(color: string, opacity: number): string {
  // Handle existing rgba
  if (color.startsWith('rgba')) {
    return color.replace(/[\d.]+\)$/, `${opacity})`);
  }

  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    let r: number, g: number, b: number;

    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  // Return as-is if can't parse
  return color;
}

/**
 * Create a theme variant by applying multiple overrides in sequence.
 *
 * @param baseTheme - The base G2 theme configuration
 * @param overridesList - Array of override objects to apply in order
 * @returns New theme with all overrides applied
 */
export function composeThemeOverrides(
  baseTheme: G2ThemeConfig,
  overridesList: ThemeOverrides[]
): G2ThemeConfig {
  return overridesList.reduce<G2ThemeConfig>(
    (theme, overrides) => mergeThemeOverrides(theme, overrides),
    baseTheme
  );
}
