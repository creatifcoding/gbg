/**
 * RVN Design Tokens: Colors
 *
 * Brutalist high-contrast color palette.
 * Binary black/white with gray for muted states.
 */

export const RVN_COLORS = {
  // Core palette
  black: '#000000',
  white: '#ffffff',

  // Surface colors
  bg: '#e6e6e6',
  surface: '#ffffff',
  surfaceHighlight: '#f0f0f0',
  surfaceMuted: '#f4f4f4',

  // Border
  border: '#000000',
  borderMuted: '#dddddd',

  // Text
  textMain: '#000000',
  textMuted: '#666666',
  textInverse: '#ffffff',
  textSubtle: '#999999',

  // Status colors (used sparingly)
  statusActive: '#000000',
  statusAlert: '#000000', // Uses stripe pattern, not color
  statusOffline: '#666666',

  // Interactive states
  hoverBg: '#f0f0f0',
  activeBg: '#000000',
  activeText: '#ffffff',
  disabledOpacity: 0.5,
} as const

export type RvnColor = keyof typeof RVN_COLORS

/**
 * CSS Custom Properties for runtime theming
 */
export const RVN_COLOR_VARS = {
  '--rvn-black': RVN_COLORS.black,
  '--rvn-white': RVN_COLORS.white,
  '--rvn-bg': RVN_COLORS.bg,
  '--rvn-surface': RVN_COLORS.surface,
  '--rvn-surface-highlight': RVN_COLORS.surfaceHighlight,
  '--rvn-surface-muted': RVN_COLORS.surfaceMuted,
  '--rvn-border': RVN_COLORS.border,
  '--rvn-border-muted': RVN_COLORS.borderMuted,
  '--rvn-text-main': RVN_COLORS.textMain,
  '--rvn-text-muted': RVN_COLORS.textMuted,
  '--rvn-text-inverse': RVN_COLORS.textInverse,
  '--rvn-text-subtle': RVN_COLORS.textSubtle,
} as const
