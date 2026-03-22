/**
 * TMNL Dense Dark Variant
 *
 * The canonical TMNL grid variant.
 * High-density dark theme for operator console aesthetics.
 */

import type { GridVariant } from '../schemas'
import { DENSITY_PRESETS } from '../schemas/density'
import { BEHAVIOR_PRESETS } from '../schemas/behavior'

/**
 * TMNL Dense Dark
 *
 * Characteristics:
 * - Dense tier (20px rows, 10px font)
 * - Pure black background with warm grays
 * - High contrast for extended viewing
 * - Full interactive behavior
 * - Monospace typography throughout
 */
export const tmnlDenseDark: GridVariant = {
  id: 'tmnl-dense-dark' as GridVariant['id'],
  description: 'High-density dark theme for operator consoles',
  densityTier: 'dense',
  density: DENSITY_PRESETS.dense,
  colorScheme: 'dark',

  colors: {
    background: {
      base: '#000000',
      alternateRow: '#0a0a0a',
      header: '#0d0d0d',
      hover: '#1a1a1a',
      selected: '#1e1e21',
      active: '#262626',
    },
    text: {
      primary: '#ffffff',
      secondary: '#a3a3a3',
      muted: '#737373',
      disabled: '#525252',
      numericEmphasis: '#ffffff',
      header: '#737373',
    },
    signal: {
      positive: '#22c55e',
      negative: '#ef4444',
      alert: '#ef4444',
      warning: '#eab308',
      neutral: '#6b7280',
      accent: '#ffffff',
    },
    border: {
      primary: '#262626',
      muted: '#1a1a1a',
      row: '#1a1a1a',
      column: '#1a1a1a',
      focus: '#ffffff',
    },
    flash: {
      up: 'rgba(34, 197, 94, 0.4)',
      down: 'rgba(239, 68, 68, 0.4)',
      change: 'rgba(255, 255, 255, 0.2)',
      durationMs: 300,
    },
  },

  behavior: BEHAVIOR_PRESETS.interactive,

  typography: {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    headerLetterSpacing: '0.05em',
    bodyLetterSpacing: '0.02em',
    headerFontWeight: 600,
    tabularNums: true,
  },

  intentOverrides: {
    identifier: {
      intent: 'identifier',
      flashOnChange: false,
    },
    primaryMetric: {
      intent: 'primaryMetric',
      progressBar: true,
      heatmap: true,
    },
    status: {
      intent: 'status',
      flashOnChange: true,
    },
  },
}
