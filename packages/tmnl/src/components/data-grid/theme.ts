/**
 * Data Grid Theme
 *
 * TMNL-styled theming for AG-Grid.
 * Extracted from data-grid-shape.tsx for modularity.
 */

import { themeQuartz } from 'ag-grid-community'
import type { GridThemeConfig } from './types'

// =============================================================================
// TMNL DESIGN TOKENS
// =============================================================================

export const TMNL_TOKENS: GridThemeConfig = {
  colors: {
    background: '#000000',
    border: '#262626',
    text: '#e5e5e5',
    textMuted: '#737373',
    accent: '#ffffff',
    statusActive: '#22c55e',
    statusPending: '#eab308',
    statusInactive: '#6b7280',
  },
  // IMPORTANT: Sizes aligned with TYPOGRAPHY_BASE_SIZES (xs:12, sm:14, base:16)
  // DO NOT shrink these "to look clean" — readability > aesthetics
  typography: {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: 14,      // Base body text
    fontSizeXs: 12,    // Labels, IDs (MINIMUM readable)
    fontSizeSm: 12,    // Small labels — floor at 12px
    fontSizeLg: 16,    // Emphasized text
  },
  spacing: {
    rowHeight: 32,
    headerHeight: 28,
    cellPadding: 8,
  },
}

// =============================================================================
// STATUS COLORS
// =============================================================================

export const STATUS_COLORS = {
  active: TMNL_TOKENS.colors.statusActive,
  pending: TMNL_TOKENS.colors.statusPending,
  inactive: TMNL_TOKENS.colors.statusInactive,
  default: TMNL_TOKENS.colors.textMuted,
} as const

// =============================================================================
// AG-GRID THEME
// =============================================================================

export const tmnlDataGridTheme = themeQuartz.withParams({
  accentColor: TMNL_TOKENS.colors.accent,
  backgroundColor: TMNL_TOKENS.colors.background,
  borderColor: TMNL_TOKENS.colors.border,
  borderRadius: 0,
  browserColorScheme: 'dark',
  cellHorizontalPaddingScale: 0.7,
  cellTextColor: TMNL_TOKENS.colors.text,
  columnBorder: false,
  fontFamily: TMNL_TOKENS.typography.fontFamily,
  fontSize: TMNL_TOKENS.typography.fontSize,
  foregroundColor: TMNL_TOKENS.colors.text,
  headerBackgroundColor: '#0a0a0a',
  headerFontSize: 10,
  headerFontWeight: 600,
  headerRowBorder: { color: TMNL_TOKENS.colors.border },
  headerTextColor: TMNL_TOKENS.colors.textMuted,
  oddRowBackgroundColor: '#0a0a0a',
  rangeSelectionBackgroundColor: 'rgba(255, 255, 255, 0.05)',
  rangeSelectionBorderColor: TMNL_TOKENS.colors.accent,
  rangeSelectionBorderStyle: 'solid',
  rowBorder: { color: '#1a1a1a' },
  rowVerticalPaddingScale: 0.8,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
})
