/**
 * RVN Dark Contrast Island Tokens
 *
 * Design tokens for dark-themed "contrast islands" within the light RVN theme.
 * Used for tool calls, thinking sections, and other system/internal UI elements.
 *
 * These create visual separation between user-facing content (light) and
 * system/AI-internal content (dark).
 */

import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_LETTER_SPACING,
  RVN_SPACING,
  RVN_BORDERS,
} from '@/lib/rvn/tokens'

// =============================================================================
// Dark Contrast Tokens
// =============================================================================

/**
 * Dark contrast island color tokens
 */
export const RVN_DARK = {
  /** Primary background - near black */
  bg: '#0d0d0d',
  /** Secondary background - slightly lighter */
  bgSecondary: '#0a0a0a',
  /** Header/section background */
  bgHeader: '#111',
  /** Primary border */
  border: '#333',
  /** Secondary border */
  borderLight: '#222',
  /** Subtle border */
  borderSubtle: '#1a1a1a',
  /** Primary text */
  text: '#bbb',
  /** Bright text */
  textBright: '#aaa',
  /** Muted text */
  textMuted: '#888',
  /** Subtle text */
  textSubtle: '#666',
  /** Very subtle text */
  textFaint: '#555',
  /** Success color */
  success: '#4a4',
  /** Success bright */
  successBright: '#4ade80',
  /** Error color */
  error: '#f44',
  /** Error bright */
  errorBright: '#f87171',
  /** Warning color */
  warning: '#f90',
  /** Diff added background */
  diffAddedBg: 'rgba(34, 197, 94, 0.2)',
  /** Diff removed background */
  diffRemovedBg: 'rgba(239, 68, 68, 0.2)',
  /** Error background */
  errorBg: '#1a0a0a',
  /** Error border */
  errorBorder: '#300',
} as const

// =============================================================================
// Shared Dark Theme Styles
// =============================================================================

/**
 * Base container style for dark contrast islands
 */
export const darkContainerStyle = {
  background: RVN_DARK.bg,
  border: `1px solid ${RVN_DARK.border}`,
  borderRadius: RVN_BORDERS.radius,
} as const

/**
 * Header style for dark sections
 */
export const darkHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  background: RVN_DARK.bgHeader,
  borderBottom: `1px solid ${RVN_DARK.borderLight}`,
  cursor: 'pointer',
  userSelect: 'none' as const,
} as const

/**
 * Label style for dark sections
 */
export const darkLabelStyle = {
  fontSize: RVN_FONT_SIZES.label,
  fontFamily: RVN_FONTS.mono,
  fontWeight: RVN_FONT_WEIGHTS.semibold,
  textTransform: 'uppercase' as const,
  letterSpacing: RVN_LETTER_SPACING.wide,
  color: RVN_DARK.textMuted,
} as const

/**
 * Content/code block style
 */
export const darkCodeBlockStyle = {
  background: RVN_DARK.bgSecondary,
  padding: '8px',
  border: `1px solid ${RVN_DARK.borderSubtle}`,
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-all' as const,
  color: RVN_DARK.text,
  maxHeight: '150px',
  overflow: 'auto',
} as const

/**
 * Chevron/toggle icon style
 */
export const darkChevronStyle = {
  color: RVN_DARK.textSubtle,
  fontSize: RVN_FONT_SIZES.label,
  transition: 'transform 0.15s ease',
} as const

/**
 * Button base style for dark theme
 */
export const darkButtonStyle = {
  background: 'transparent',
  border: `1px solid ${RVN_DARK.border}`,
  padding: '4px 10px',
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.semibold,
  fontFamily: RVN_FONTS.mono,
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
  borderRadius: RVN_BORDERS.radius,
  transition: 'all 0.15s',
  color: RVN_DARK.textMuted,
} as const

/**
 * Apply button style (success variant)
 */
export const darkApplyButtonStyle = {
  ...darkButtonStyle,
  background: RVN_DARK.bgHeader,
  color: RVN_DARK.success,
  borderColor: RVN_DARK.success,
} as const

/**
 * Status indicator styles
 */
export const darkStatusStyles = {
  base: {
    fontSize: RVN_FONT_SIZES.label,
    fontFamily: RVN_FONTS.mono,
    textTransform: 'uppercase' as const,
  },
  pending: { color: RVN_DARK.textMuted },
  running: { color: RVN_DARK.textMuted },
  complete: { color: RVN_DARK.success },
  error: { color: RVN_DARK.error },
} as const

// Re-export base tokens for convenience
export {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_LETTER_SPACING,
  RVN_SPACING,
  RVN_BORDERS,
}
