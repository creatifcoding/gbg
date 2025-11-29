import { themeQuartz } from 'ag-grid-community';

// ============================================
// TMNL DESIGN TOKENS
// Parameterized for animation & theming
// ============================================

export const TMNL_TOKENS = {
  // Core palette
  colors: {
    black: '#000000',
    backgroundPrimary: '#0a0a0a',
    backgroundSecondary: '#0d0d0d',
    backgroundTertiary: '#141414',
    backgroundHover: '#1a1a1a',
    backgroundSelected: '#1e1e21',

    // Borders
    borderMuted: '#1a1a1a',
    borderDefault: '#262626',
    borderSubtle: '#333333',

    // Text hierarchy
    textPrimary: '#ffffff',
    textSecondary: '#a3a3a3',
    textMuted: '#737373',
    textDisabled: '#525252',

    // Accents
    accentPrimary: '#ffffff',
    accentCyan: '#00A2FF',
    accentGreen: '#22c55e',
    accentYellow: '#eab308',
    accentRed: '#ef4444',

    // Range selection
    rangeBackground: 'rgba(255, 255, 255, 0.08)',
    rangeBorder: '#ffffff',
  },

  // Typography
  typography: {
    fontFamily: [
      'ui-monospace',
      'SFMono-Regular',
      '"SF Mono"',
      'Menlo',
      'Consolas',
      '"Liberation Mono"',
      'monospace',
    ],
    fontSizeXs: 9,
    fontSizeSm: 10,
    fontSizeMd: 11,
    fontSizeLg: 12,
  },

  // Spacing
  spacing: {
    unit: 4,
    cellPadding: 0.7,
    rowPadding: 0.9,
    headerPadding: 1.0,
  },

  // Dimensions
  dimensions: {
    rowHeight: 24,
    headerHeight: 28,
    borderRadius: 0,
    borderWidth: 1,
    iconSize: 12,
  },

  // Animation (for future use)
  animation: {
    durationFast: 0.1,
    durationNormal: 0.2,
    durationSlow: 0.3,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// ============================================
// TMNL DATA GRID THEME
// Built on themeQuartz with TMNL parameters
// ============================================

export const tmnlDataGridTheme = themeQuartz.withParams({
  // Core colors
  backgroundColor: TMNL_TOKENS.colors.backgroundPrimary,
  foregroundColor: TMNL_TOKENS.colors.textPrimary,
  accentColor: TMNL_TOKENS.colors.accentPrimary,

  // Chrome (headers, panels)
  chromeBackgroundColor: TMNL_TOKENS.colors.backgroundTertiary,

  // Borders
  borderColor: TMNL_TOKENS.colors.borderDefault,
  borderRadius: TMNL_TOKENS.dimensions.borderRadius,
  wrapperBorder: false,
  wrapperBorderRadius: 0,

  // Typography
  fontFamily: TMNL_TOKENS.typography.fontFamily,
  fontSize: TMNL_TOKENS.typography.fontSizeMd,

  // Header styling
  headerBackgroundColor: TMNL_TOKENS.colors.backgroundTertiary,
  headerTextColor: TMNL_TOKENS.colors.textMuted,
  headerFontSize: TMNL_TOKENS.typography.fontSizeXs,
  headerFontWeight: 600,
  headerHeight: TMNL_TOKENS.dimensions.headerHeight,
  headerVerticalPaddingScale: TMNL_TOKENS.spacing.headerPadding,
  headerRowBorder: { color: TMNL_TOKENS.colors.borderDefault },
  headerColumnBorder: false,
  headerColumnResizeHandleColor: TMNL_TOKENS.colors.borderSubtle,
  headerCellHoverBackgroundColor: TMNL_TOKENS.colors.backgroundHover,

  // Cell styling
  cellTextColor: TMNL_TOKENS.colors.textSecondary,
  cellHorizontalPaddingScale: TMNL_TOKENS.spacing.cellPadding,

  // Row styling
  rowHeight: TMNL_TOKENS.dimensions.rowHeight,
  rowVerticalPaddingScale: TMNL_TOKENS.spacing.rowPadding,
  rowBorder: { color: TMNL_TOKENS.colors.borderMuted },
  oddRowBackgroundColor: TMNL_TOKENS.colors.backgroundSecondary,
  rowHoverColor: TMNL_TOKENS.colors.backgroundHover,
  selectedRowBackgroundColor: TMNL_TOKENS.colors.backgroundSelected,

  // Range selection
  rangeSelectionBackgroundColor: TMNL_TOKENS.colors.rangeBackground,
  rangeSelectionBorderColor: TMNL_TOKENS.colors.rangeBorder,
  rangeSelectionBorderStyle: 'solid',

  // Column borders
  columnBorder: { color: TMNL_TOKENS.colors.borderMuted },

  // Icons
  iconSize: TMNL_TOKENS.dimensions.iconSize,

  // Spacing
  spacing: TMNL_TOKENS.spacing.unit,

  // Focus & interaction
  focusShadow: 'none',

  // Color scheme
  browserColorScheme: 'dark',

  // Cell editing
  cellEditingBorder: { color: TMNL_TOKENS.colors.accentCyan },

  // Menu
  menuBackgroundColor: TMNL_TOKENS.colors.backgroundTertiary,
  menuBorder: { color: TMNL_TOKENS.colors.borderDefault },
  menuTextColor: TMNL_TOKENS.colors.textSecondary,
});

// ============================================
// STATUS CELL COLORS
// For use in cellStyle callbacks
// ============================================

export const STATUS_COLORS = {
  active: TMNL_TOKENS.colors.accentGreen,
  pending: TMNL_TOKENS.colors.accentYellow,
  inactive: TMNL_TOKENS.colors.accentRed,
  default: TMNL_TOKENS.colors.textMuted,
} as const;

// ============================================
// UTILITY: Create animated theme variant
// For future animation support
// ============================================

export function createAnimatedTheme(overrides: Partial<typeof TMNL_TOKENS.colors>) {
  const mergedColors = { ...TMNL_TOKENS.colors, ...overrides };

  return themeQuartz.withParams({
    backgroundColor: mergedColors.backgroundPrimary,
    foregroundColor: mergedColors.textPrimary,
    accentColor: mergedColors.accentPrimary,
    chromeBackgroundColor: mergedColors.backgroundTertiary,
    borderColor: mergedColors.borderDefault,
    headerBackgroundColor: mergedColors.backgroundTertiary,
    headerTextColor: mergedColors.textMuted,
    cellTextColor: mergedColors.textSecondary,
    oddRowBackgroundColor: mergedColors.backgroundSecondary,
    rowHoverColor: mergedColors.backgroundHover,
    selectedRowBackgroundColor: mergedColors.backgroundSelected,
    rangeSelectionBackgroundColor: mergedColors.rangeBackground,
    rangeSelectionBorderColor: mergedColors.rangeBorder,
    // Inherit all other settings
    fontFamily: TMNL_TOKENS.typography.fontFamily,
    fontSize: TMNL_TOKENS.typography.fontSizeMd,
    headerFontSize: TMNL_TOKENS.typography.fontSizeXs,
    headerFontWeight: 600,
    headerHeight: TMNL_TOKENS.dimensions.headerHeight,
    rowHeight: TMNL_TOKENS.dimensions.rowHeight,
    spacing: TMNL_TOKENS.spacing.unit,
    borderRadius: 0,
    wrapperBorder: false,
    focusShadow: 'none',
    browserColorScheme: 'dark',
  });
}
