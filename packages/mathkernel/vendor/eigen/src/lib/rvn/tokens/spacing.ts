/**
 * RVN Design Tokens: Spacing
 *
 * Brutalist spacing scale: 4/10/20/30/60px
 * Deliberately non-standard to create visual tension.
 */

export const RVN_SPACING = {
  // Core scale
  xs: '4px',
  s: '10px',
  m: '20px',
  l: '30px',
  xl: '60px',

  // Component-specific
  panelPadding: '20px',
  cardPadding: '15px',
  buttonPadding: '10px 20px',
  inputPadding: '8px 12px',
  cellPadding: '10px',

  // Gaps
  stackGap: '10px',
  gridGap: '20px',
  sectionGap: '30px',

  // Layout
  sidebarWidth: '260px',
  sidebarWidthLg: '380px',
  actionRailWidth: '80px',
  headerHeight: '60px',
  footerHeight: '40px',
} as const

export type RvnSpacing = keyof typeof RVN_SPACING

/**
 * Numeric values for calculations
 */
export const RVN_SPACING_VALUES = {
  xs: 4,
  s: 10,
  m: 20,
  l: 30,
  xl: 60,
} as const

/**
 * CSS Custom Properties
 */
export const RVN_SPACING_VARS = {
  '--rvn-space-xs': RVN_SPACING.xs,
  '--rvn-space-s': RVN_SPACING.s,
  '--rvn-space-m': RVN_SPACING.m,
  '--rvn-space-l': RVN_SPACING.l,
  '--rvn-space-xl': RVN_SPACING.xl,
  '--rvn-sidebar-width': RVN_SPACING.sidebarWidth,
  '--rvn-sidebar-width-lg': RVN_SPACING.sidebarWidthLg,
  '--rvn-action-rail-width': RVN_SPACING.actionRailWidth,
  '--rvn-header-height': RVN_SPACING.headerHeight,
  '--rvn-footer-height': RVN_SPACING.footerHeight,
} as const
