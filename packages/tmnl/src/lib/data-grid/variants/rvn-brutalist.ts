/**
 * RVN Brutalist Variant
 *
 * High-contrast brutalist grid for RVN design system.
 * Binary black/white palette with invert selection.
 */

import type { GridVariant } from '../schemas'
import { DENSITY_PRESETS } from '../schemas/density'
import { BEHAVIOR_PRESETS } from '../schemas/behavior'

/**
 * RVN Brutalist
 *
 * Characteristics:
 * - Light theme with high contrast
 * - Binary black/white with gray muted states
 * - Invert selection (black bg, white text)
 * - Monospace data, Helvetica headers
 * - ALL CAPS headers with wide letter-spacing
 * - 12px font floor enforced
 */
export const rvnBrutalist: GridVariant = {
  id: 'rvn-brutalist' as GridVariant['id'],
  description: 'High-contrast brutalist grid for RVN design system',
  densityTier: 'rvn',
  density: DENSITY_PRESETS.rvn,
  colorScheme: 'light',

  colors: {
    background: {
      base: '#ffffff',
      alternateRow: '#f4f4f4',
      header: '#e6e6e6',
      hover: '#f0f0f0',
      selected: '#000000', // Invert: black background
      active: '#000000',
    },
    text: {
      primary: '#000000',
      secondary: '#666666',
      muted: '#999999',
      disabled: '#cccccc',
      numericEmphasis: '#000000',
      header: '#000000',
    },
    signal: {
      positive: '#000000', // RVN uses patterns, not colors
      negative: '#000000',
      alert: '#000000',
      warning: '#000000',
      neutral: '#666666',
      accent: '#000000',
    },
    border: {
      primary: '#000000',
      muted: '#dddddd',
      row: '#dddddd',
      column: '#dddddd',
      focus: '#000000',
    },
    flash: {
      up: 'rgba(0, 0, 0, 0.2)',
      down: 'rgba(0, 0, 0, 0.2)',
      change: 'rgba(0, 0, 0, 0.15)',
      durationMs: 200,
    },
  },

  behavior: {
    ...BEHAVIOR_PRESETS.rvnBrutalist,
  },

  typography: {
    fontFamily: "'Courier New', Courier, monospace",
    headerLetterSpacing: '0.15em', // Wide for ALL CAPS
    bodyLetterSpacing: '0',
    headerFontWeight: 700,
    tabularNums: true,
  },
}
