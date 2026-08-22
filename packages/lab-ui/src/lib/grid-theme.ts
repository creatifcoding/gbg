import { themeQuartz } from 'ag-grid-community';
import { VANTA_BORDERS, VANTA_COLORS, VANTA_SPACING, VANTA_TYPOGRAPHY } from './vanta.js';

export function createVantaGridTheme() {
  return themeQuartz.withParams({
    backgroundColor: VANTA_COLORS.surface.void,
    foregroundColor: VANTA_COLORS.text.primary,
    accentColor: VANTA_COLORS.accent.cyan,
    chromeBackgroundColor: VANTA_COLORS.surface.elevated,
    borderColor: VANTA_COLORS.surface.border,
    borderRadius: VANTA_BORDERS.radius.none,
    wrapperBorder: false,
    wrapperBorderRadius: VANTA_BORDERS.radius.none,
    fontFamily: VANTA_TYPOGRAPHY.family.mono,
    fontSize: VANTA_TYPOGRAPHY.size.sm,
    headerBackgroundColor: VANTA_COLORS.surface.elevated,
    headerTextColor: VANTA_COLORS.text.muted,
    headerFontSize: VANTA_TYPOGRAPHY.size.sm,
    headerFontWeight: VANTA_TYPOGRAPHY.weight.medium,
    headerHeight: VANTA_SPACING['8'],
    headerRowBorder: { color: VANTA_COLORS.surface.border },
    headerColumnBorder: false,
    headerColumnResizeHandleColor: VANTA_COLORS.surface.border,
    headerCellHoverBackgroundColor: VANTA_COLORS.surface.raised,
    cellTextColor: VANTA_COLORS.text.primary,
    rowHeight: VANTA_SPACING['8'],
    rowBorder: { color: VANTA_COLORS.surface.border },
    oddRowBackgroundColor: VANTA_COLORS.surface.base,
    rowHoverColor: VANTA_COLORS.surface.raised,
    selectedRowBackgroundColor: VANTA_COLORS.surface.raised,
    rangeSelectionBackgroundColor: VANTA_COLORS.accent.cyanGlow,
    rangeSelectionBorderColor: VANTA_COLORS.accent.cyan,
    columnBorder: { color: VANTA_COLORS.surface.border },
    browserColorScheme: 'dark',
    focusShadow: 'none',
    cellEditingBorder: { color: VANTA_COLORS.accent.cyan },
    menuBackgroundColor: VANTA_COLORS.surface.elevated,
    menuBorder: { color: VANTA_COLORS.surface.border },
    menuTextColor: VANTA_COLORS.text.secondary,
  });
}

export const vantaGridTheme = createVantaGridTheme();
