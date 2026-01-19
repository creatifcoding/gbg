/**
 * Chart Themes Module
 *
 * VANTA-styled G2 themes for Ant Design Charts.
 * Provides dark/light themes, color palettes, and merge utilities.
 *
 * @module charts/themes
 */

// =============================================================================
// Theme Configuration
// =============================================================================

export {
  // Factory function
  createVantaG2Theme,
  // Preset themes
  VANTA_G2_THEME_DARK,
  VANTA_G2_THEME_LIGHT,
  // Types
  type G2ThemeConfig,
  type G2ThemeVariant,
} from './vanta-theme';

// =============================================================================
// Color Palettes
// =============================================================================

export {
  // Intent-based palettes
  INTENT_PALETTES,
  getPaletteForIntent,
  AVAILABLE_INTENTS,
  // Category-based palettes
  CATEGORY_PALETTES,
  getPaletteForCategory,
  AVAILABLE_CATEGORIES,
  // Utilities
  extendPalette,
  // Types
  type ChartCategory,
} from './palettes';

// =============================================================================
// Theme Merge Utilities
// =============================================================================

export {
  // Merge functions
  mergeThemeOverrides,
  applyPaletteToTheme,
  composeThemeOverrides,
  // Types
  type ThemeOverrides,
} from './merge';
