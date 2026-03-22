/**
 * TMNL Analyst Light Variant
 *
 * Light theme for analyst workstations and presentations.
 * Comfortable readability with professional aesthetics.
 */

import type { GridVariant } from '../schemas'
import { DENSITY_PRESETS } from '../schemas/density'
import { BEHAVIOR_PRESETS } from '../schemas/behavior'

/**
 * TMNL Analyst Light
 *
 * Characteristics:
 * - Normal tier (24px rows, 12px font)
 * - Light background with warm neutrals
 * - Comfortable for extended reading
 * - Full interactive behavior
 * - Professional presentation-ready
 */
export const tmnlAnalystLight: GridVariant = {
  id: 'tmnl-analyst-light' as GridVariant['id'],
  description: 'Light theme for analyst workstations and presentations',
  densityTier: 'normal',
  density: DENSITY_PRESETS.normal,
  colorScheme: 'light',

  colors: {
    background: {
      base: '#ffffff',
      alternateRow: '#fafafa',
      header: '#f5f5f5',
      hover: '#f0f0f0',
      selected: '#e5e7eb',
      active: '#d1d5db',
    },
    text: {
      primary: '#171717',
      secondary: '#404040',
      muted: '#737373',
      disabled: '#a3a3a3',
      numericEmphasis: '#000000',
      header: '#525252',
    },
    signal: {
      positive: '#16a34a',
      negative: '#dc2626',
      alert: '#dc2626',
      warning: '#ca8a04',
      neutral: '#6b7280',
      accent: '#2563eb',
    },
    border: {
      primary: '#e5e5e5',
      muted: '#f0f0f0',
      row: '#f0f0f0',
      column: '#e5e5e5',
      focus: '#2563eb',
    },
    flash: {
      up: 'rgba(22, 163, 74, 0.3)',
      down: 'rgba(220, 38, 38, 0.3)',
      change: 'rgba(37, 99, 235, 0.2)',
      durationMs: 400,
    },
  },

  behavior: BEHAVIOR_PRESETS.interactive,

  typography: {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    headerLetterSpacing: '0.04em',
    bodyLetterSpacing: '0.01em',
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
