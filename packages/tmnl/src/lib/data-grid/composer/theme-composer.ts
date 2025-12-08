/**
 * Theme Composer
 *
 * Converts a GridVariant to AG-Grid theme parameters.
 */

import { themeQuartz } from 'ag-grid-community'
import type { GridVariant } from '../schemas'

// =============================================================================
// COMPOSE AG-GRID THEME
// =============================================================================

/**
 * Convert a GridVariant to an AG-Grid theme.
 *
 * @param variant - The grid variant to compose
 * @returns AG-Grid theme object
 */
export function composeAgGridTheme(variant: GridVariant) {
  const { colors, density, typography } = variant

  return themeQuartz.withParams({
    // Core colors
    backgroundColor: colors.background.base,
    foregroundColor: colors.text.primary,
    accentColor: colors.signal.accent,

    // Chrome (headers, panels)
    chromeBackgroundColor: colors.background.header,

    // Borders
    borderColor: colors.border.primary,
    borderRadius: 0,
    wrapperBorder: false,
    wrapperBorderRadius: 0,

    // Typography
    fontFamily: typography.fontFamily,
    fontSize: density.fontSize,

    // Header styling
    headerBackgroundColor: colors.background.header,
    headerTextColor: colors.text.header,
    headerFontSize: density.fontSizeXs,
    headerFontWeight: typography.headerFontWeight ?? 600,
    headerHeight: density.headerHeight,
    headerVerticalPaddingScale: density.paddingY / 4,
    headerRowBorder: { color: colors.border.primary },
    headerColumnBorder: false,
    headerColumnResizeHandleColor: colors.border.muted,
    headerCellHoverBackgroundColor: colors.background.hover,

    // Cell styling
    cellTextColor: colors.text.secondary,
    cellHorizontalPaddingScale: density.paddingX / 8,

    // Row styling
    rowHeight: density.rowHeight,
    rowVerticalPaddingScale: density.paddingY / 4,
    rowBorder: { color: colors.border.row ?? colors.border.muted },
    oddRowBackgroundColor: colors.background.alternateRow ?? colors.background.base,
    rowHoverColor: colors.background.hover,
    selectedRowBackgroundColor: colors.background.selected,

    // Range selection
    rangeSelectionBackgroundColor: `${colors.signal.accent}15`,
    rangeSelectionBorderColor: colors.signal.accent,
    rangeSelectionBorderStyle: 'solid',

    // Column borders
    columnBorder: colors.border.column
      ? { color: colors.border.column }
      : false,

    // Icons
    iconSize: density.iconSize,

    // Spacing
    spacing: density.spacing,

    // Focus & interaction
    focusShadow: variant.behavior.microInteractions.focusOutline === 'none'
      ? 'none'
      : undefined,

    // Color scheme
    browserColorScheme: variant.colorScheme,

    // Cell editing
    cellEditingBorder: { color: colors.signal.accent },

    // Menu
    menuBackgroundColor: colors.background.header,
    menuBorder: { color: colors.border.primary },
    menuTextColor: colors.text.secondary,
  })
}

// =============================================================================
// STATUS COLORS MAP
// =============================================================================

/**
 * Extract status colors from a variant for cell renderers.
 */
export function extractStatusColors(variant: GridVariant) {
  return {
    active: variant.colors.signal.positive,
    pending: variant.colors.signal.warning ?? variant.colors.signal.neutral ?? '#eab308',
    inactive: variant.colors.signal.neutral ?? variant.colors.text.muted,
    default: variant.colors.text.muted,
  } as const
}

// =============================================================================
// FLASH COLORS
// =============================================================================

/**
 * Extract flash configuration from a variant.
 */
export function extractFlashConfig(variant: GridVariant) {
  const flash = variant.colors.flash
  if (!flash) {
    return {
      enabled: false,
      upColor: 'rgba(34, 197, 94, 0.4)',
      downColor: 'rgba(239, 68, 68, 0.4)',
      changeColor: 'rgba(255, 255, 255, 0.2)',
      durationMs: 300,
    }
  }

  const scale = variant.behavior.microInteractions.flashDurationScale ?? 1.0

  return {
    enabled: variant.behavior.microInteractions.enableCellFlash,
    upColor: flash.up,
    downColor: flash.down,
    changeColor: flash.change ?? flash.up,
    durationMs: Math.round(flash.durationMs * scale),
  }
}
