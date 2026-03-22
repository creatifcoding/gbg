/**
 * TMNL Ultra Ops Variant
 *
 * Maximum density operator console variant.
 * For keyboard-driven workflows with maximum information density.
 */

import type { GridVariant } from '../schemas'
import { DENSITY_PRESETS } from '../schemas/density'
import { BEHAVIOR_PRESETS } from '../schemas/behavior'

/**
 * TMNL Ultra Ops
 *
 * Characteristics:
 * - Ultra tier (16px rows, 8px font — the floor)
 * - Maximum information density
 * - Keyboard-focused navigation (vim-style)
 * - No hover effects (mouse is secondary)
 * - Strong focus indicators
 */
export const tmnlUltraOps: GridVariant = {
  id: 'tmnl-ultra-ops' as GridVariant['id'],
  description: 'Maximum density operator console for keyboard workflows',
  densityTier: 'ultra',
  density: DENSITY_PRESETS.ultra,
  colorScheme: 'dark',

  colors: {
    background: {
      base: '#000000',
      alternateRow: '#050505',
      header: '#0a0a0a',
      hover: '#0a0a0a', // Subtle — mouse is secondary
      selected: '#1a1a1a',
      active: '#262626',
    },
    text: {
      primary: '#e5e5e5',
      secondary: '#a3a3a3',
      muted: '#6b6b6b',
      disabled: '#404040',
      numericEmphasis: '#ffffff',
      header: '#6b6b6b',
    },
    signal: {
      positive: '#22c55e',
      negative: '#ef4444',
      alert: '#dc2626',
      warning: '#eab308',
      neutral: '#525252',
      accent: '#00ff88', // Bright accent for keyboard focus
    },
    border: {
      primary: '#1a1a1a',
      muted: '#0f0f0f',
      row: '#0f0f0f',
      column: '#0f0f0f',
      focus: '#00ff88', // Matches accent
    },
    flash: {
      up: 'rgba(34, 197, 94, 0.5)',
      down: 'rgba(239, 68, 68, 0.5)',
      change: 'rgba(255, 255, 255, 0.3)',
      durationMs: 150, // Fast flash for rapid updates
    },
  },

  behavior: {
    ...BEHAVIOR_PRESETS.operator,
    microInteractions: {
      hoverRow: 'none',
      selectedRow: 'fill',
      focusOutline: 'strong',
      animateRows: false,
      enableCellFlash: true,
      flashDurationScale: 0.5,
    },
  },

  typography: {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    headerLetterSpacing: '0.08em',
    bodyLetterSpacing: '0.02em',
    headerFontWeight: 700,
    tabularNums: true,
  },

  intentOverrides: {
    identifier: {
      intent: 'identifier',
      width: 40, // Tighter for ultra density
    },
    metric: {
      intent: 'metric',
      width: 60,
    },
    primaryMetric: {
      intent: 'primaryMetric',
      width: 70,
      progressBar: false, // Too cramped
      heatmap: true,
    },
    status: {
      intent: 'status',
      width: 60,
    },
  },
}
