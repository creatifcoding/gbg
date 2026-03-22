/**
 * RVN Design Tokens: Typography
 *
 * Brutalist typography system:
 * - Helvetica Neue for headings
 * - Monospace for data/technical
 * - ALL CAPS for labels
 * - 12px minimum (THE FLOOR)
 */

export const RVN_FONTS = {
  sans: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  mono: "'Courier New', Courier, monospace",
} as const

export const RVN_FONT_SIZES = {
  // Titles
  titleXl: '80px',
  titleLg: '48px',
  titleMd: '32px',
  titleSm: '24px',

  // Headings
  heading: '14px',
  subheading: '13px',

  // Body
  body: '13px',
  bodyLg: '16px',

  // Labels & Captions
  label: '12px', // THE FLOOR - nothing below this
  caption: '10px', // Exception: only for timestamps/coordinates

  // Data
  dataLg: '24px',
  dataMd: '18px',
  dataSm: '14px',
} as const

export const RVN_FONT_WEIGHTS = {
  black: 900,
  bold: 700,
  semibold: 600,
  medium: 500,
  regular: 400,
} as const

export const RVN_LINE_HEIGHTS = {
  tight: 1.1,
  normal: 1.4,
  relaxed: 1.6,
} as const

export const RVN_LETTER_SPACING = {
  tight: '-0.02em',
  normal: '0',
  wide: '0.05em',
  wider: '0.1em',
  label: '0.15em', // For ALL CAPS labels
} as const

/**
 * Typography presets for common patterns
 */
export const RVN_TEXT_PRESETS = {
  // Titles
  titleXl: {
    fontFamily: RVN_FONTS.sans,
    fontSize: RVN_FONT_SIZES.titleXl,
    fontWeight: RVN_FONT_WEIGHTS.black,
    lineHeight: RVN_LINE_HEIGHTS.tight,
    letterSpacing: RVN_LETTER_SPACING.tight,
  },
  titleLg: {
    fontFamily: RVN_FONTS.sans,
    fontSize: RVN_FONT_SIZES.titleLg,
    fontWeight: RVN_FONT_WEIGHTS.black,
    lineHeight: RVN_LINE_HEIGHTS.tight,
    letterSpacing: RVN_LETTER_SPACING.tight,
  },
  titleMd: {
    fontFamily: RVN_FONTS.sans,
    fontSize: RVN_FONT_SIZES.titleMd,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    lineHeight: RVN_LINE_HEIGHTS.tight,
  },

  // Panel headers
  panelHeader: {
    fontFamily: RVN_FONTS.sans,
    fontSize: RVN_FONT_SIZES.heading,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    letterSpacing: RVN_LETTER_SPACING.wide,
  },

  // Labels (ALL CAPS)
  label: {
    fontFamily: RVN_FONTS.sans,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.semibold,
    textTransform: 'uppercase' as const,
    letterSpacing: RVN_LETTER_SPACING.label,
  },

  // Monospace data
  mono: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.body,
    fontWeight: RVN_FONT_WEIGHTS.regular,
  },
  monoSmall: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.regular,
  },
  monoLarge: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.dataLg,
    fontWeight: RVN_FONT_WEIGHTS.bold,
  },

  // Body text
  body: {
    fontFamily: RVN_FONTS.sans,
    fontSize: RVN_FONT_SIZES.body,
    fontWeight: RVN_FONT_WEIGHTS.regular,
    lineHeight: RVN_LINE_HEIGHTS.normal,
  },

  // Caption (coordinates, timestamps)
  caption: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.caption,
    fontWeight: RVN_FONT_WEIGHTS.regular,
  },
} as const

/**
 * CSS Custom Properties
 */
export const RVN_TYPOGRAPHY_VARS = {
  '--rvn-font-sans': RVN_FONTS.sans,
  '--rvn-font-mono': RVN_FONTS.mono,
  '--rvn-text-xs': RVN_FONT_SIZES.label, // 12px - THE FLOOR
  '--rvn-text-sm': RVN_FONT_SIZES.body,
  '--rvn-text-base': RVN_FONT_SIZES.bodyLg,
  '--rvn-text-lg': RVN_FONT_SIZES.titleSm,
  '--rvn-text-xl': RVN_FONT_SIZES.titleMd,
  '--rvn-text-2xl': RVN_FONT_SIZES.titleLg,
  '--rvn-text-3xl': RVN_FONT_SIZES.titleXl,
} as const
