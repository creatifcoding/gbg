/**
 * TMNL Dense Dark Muted Variant
 *
 * Reduced contrast version for extended monitoring sessions.
 * Gentler on the eyes during long shifts.
 */

import type { GridVariant } from '../schemas'
import { DENSITY_PRESETS } from '../schemas/density'
import { BEHAVIOR_PRESETS } from '../schemas/behavior'

/**
 * TMNL Dense Dark Muted
 *
 * Characteristics:
 * - Dense tier (20px rows, 10px font)
 * - Reduced contrast (softer whites, warmer blacks)
 * - Dimmed flash effects for less visual interruption
 * - Monitor behavior preset (read-only, fast flash)
 */
export const tmnlDenseDarkMuted: GridVariant = {
  id: 'tmnl-dense-dark-muted' as GridVariant['id'],
  description: 'Reduced contrast dark theme for extended monitoring',
  densityTier: 'dense',
  density: DENSITY_PRESETS.dense,
  colorScheme: 'dark',

  colors: {
    background: {
      base: '#0a0a0a',
      alternateRow: '#0f0f0f',
      header: '#121212',
      hover: '#1a1a1a',
      selected: '#1e1e21',
      active: '#262626',
    },
    text: {
      // Softer whites for reduced eye strain
      primary: '#d4d4d4',
      secondary: '#8a8a8a',
      muted: '#5a5a5a',
      disabled: '#404040',
      numericEmphasis: '#c8c8c8',
      header: '#5a5a5a',
    },
    signal: {
      // Desaturated signals for less visual noise
      positive: '#4ade80',
      negative: '#f87171',
      alert: '#f87171',
      warning: '#fcd34d',
      neutral: '#6b7280',
      accent: '#a3a3a3',
    },
    border: {
      primary: '#1f1f1f',
      muted: '#171717',
      row: '#171717',
      column: '#171717',
      focus: '#737373',
    },
    flash: {
      // Gentler flash for less distraction
      up: 'rgba(74, 222, 128, 0.25)',
      down: 'rgba(248, 113, 113, 0.25)',
      change: 'rgba(163, 163, 163, 0.15)',
      durationMs: 200,
    },
  },

  behavior: {
    ...BEHAVIOR_PRESETS.monitor,
    hover: 'row',
    microInteractions: {
      ...BEHAVIOR_PRESETS.monitor.microInteractions,
      hoverRow: 'subtleFill',
      flashDurationScale: 0.5,
    },
  },

  typography: {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    headerLetterSpacing: '0.05em',
    bodyLetterSpacing: '0.02em',
    headerFontWeight: 500,
    tabularNums: true,
  },

  intentOverrides: {
    primaryMetric: {
      intent: 'primaryMetric',
      progressBar: true,
      heatmap: false,
    },
  },
}
