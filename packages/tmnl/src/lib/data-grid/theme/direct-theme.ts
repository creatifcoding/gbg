/**
 * Direct Theme Builder
 *
 * Creates AG-Grid themes directly from tokens.
 * Use this for cases that bypass the variant system.
 *
 * PREFER: composeAgGridTheme(variant) for most use cases.
 * USE THIS: For animation overlays, testing, or standalone grids.
 *
 * @module
 */

import { themeQuartz } from 'ag-grid-community'
import { TMNL_TOKENS, COLORS, TYPOGRAPHY, DIMENSIONS, SPACING } from './tokens'

// =============================================================================
// DIRECT THEME BUILDER
// =============================================================================

/**
 * Create an AG-Grid theme directly from tokens.
 *
 * @param overrides - Optional color overrides for animation
 * @returns AG-Grid theme
 *
 * @example
 * ```tsx
 * // Default theme
 * const theme = createDirectTheme()
 *
 * // With animation overlay (color shift)
 * const animatedTheme = createDirectTheme({
 *   accentPrimary: '#ff0000',
 * })
 * ```
 */
export function createDirectTheme(
  overrides: Partial<typeof COLORS> = {}
) {
  const colors = { ...COLORS, ...overrides }

  return themeQuartz.withParams({
    // Core colors
    backgroundColor: colors.backgroundPrimary,
    foregroundColor: colors.textPrimary,
    accentColor: colors.accentPrimary,

    // Chrome (headers, panels)
    chromeBackgroundColor: colors.backgroundTertiary,

    // Borders
    borderColor: colors.borderDefault,
    borderRadius: DIMENSIONS.borderRadius,
    wrapperBorder: false,
    wrapperBorderRadius: 0,

    // Typography
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.fontSizeMd,

    // Header styling
    headerBackgroundColor: colors.backgroundTertiary,
    headerTextColor: colors.textMuted,
    headerFontSize: TYPOGRAPHY.fontSizeXs,
    headerFontWeight: 600,
    headerHeight: DIMENSIONS.headerHeightNormal,
    headerVerticalPaddingScale: SPACING.headerPadding,
    headerRowBorder: { color: colors.borderDefault },
    headerColumnBorder: false,
    headerColumnResizeHandleColor: colors.borderSubtle,
    headerCellHoverBackgroundColor: colors.backgroundHover,

    // Cell styling
    cellTextColor: colors.textSecondary,
    cellHorizontalPaddingScale: SPACING.cellPadding,

    // Row styling
    rowHeight: DIMENSIONS.rowHeightNormal,
    rowVerticalPaddingScale: SPACING.rowPadding,
    rowBorder: { color: colors.borderMuted },
    oddRowBackgroundColor: colors.backgroundSecondary,
    rowHoverColor: colors.backgroundHover,
    selectedRowBackgroundColor: colors.backgroundSelected,

    // Range selection
    rangeSelectionBackgroundColor: colors.rangeBackground,
    rangeSelectionBorderColor: colors.rangeBorder,
    rangeSelectionBorderStyle: 'solid',

    // Column borders
    columnBorder: { color: colors.borderMuted },

    // Icons
    iconSize: DIMENSIONS.iconSize,

    // Spacing
    spacing: SPACING.unit,

    // Focus & interaction
    focusShadow: 'none',

    // Color scheme
    browserColorScheme: 'dark',

    // Cell editing
    cellEditingBorder: { color: colors.accentCyan },

    // Menu
    menuBackgroundColor: colors.backgroundTertiary,
    menuBorder: { color: colors.borderDefault },
    menuTextColor: colors.textSecondary,
  })
}
