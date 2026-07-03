/**
 * SIOS Design Tokens
 *
 * Dark-first. JCK brand-aligned. Three-font system.
 * Every visual decision traces to a token. No magic numbers.
 *
 * @module sios/components/tokens
 */

// =============================================================================
// Color
// =============================================================================

export const color = {
  // Surfaces (dark-first)
  bg:           '#0a0e14',
  surface:      '#121820',
  surfaceAlt:   '#181f2a',
  surfaceHover: '#1e2736',

  // Borders
  border:       'rgba(255,255,255,0.06)',
  borderBright: 'rgba(255,255,255,0.12)',

  // Text
  text:         '#d4dce8',
  textDim:      '#7a8599',
  textMuted:    '#3e4a5c',

  // JCK Brand (extracted from jckltd.com)
  jckBlue:      '#0d6efd',
  jckNavy:      '#032359',
  jckIce:       '#ecfeff',

  // Semantic
  green:        '#4ade80',
  cyan:         '#22d3ee',
  amber:        '#fbbf24',
  red:          '#f87171',
  gold:         '#c5a44a',

  // Semantic dim (8-10% opacity backgrounds)
  greenDim:     'rgba(74,222,128,0.08)',
  cyanDim:      'rgba(34,211,238,0.06)',
  amberDim:     'rgba(251,191,36,0.08)',
  redDim:       'rgba(248,113,113,0.06)',
  jckBlueDim:   'rgba(13,110,253,0.08)',
  goldDim:      'rgba(197,164,74,0.08)',
} as const

export type SemanticColor = 'green' | 'cyan' | 'amber' | 'red' | 'gold' | 'jckBlue' | 'muted'

export const semanticColorValue: Record<SemanticColor, string> = {
  green:   color.green,
  cyan:    color.cyan,
  amber:   color.amber,
  red:     color.red,
  gold:    color.gold,
  jckBlue: color.jckBlue,
  muted:   color.textMuted,
}

export const semanticColorDim: Record<SemanticColor, string> = {
  green:   color.greenDim,
  cyan:    color.cyanDim,
  amber:   color.amberDim,
  red:     color.redDim,
  gold:    color.goldDim,
  jckBlue: color.jckBlueDim,
  muted:   'rgba(255,255,255,0.03)',
}

// =============================================================================
// Status Intent
// =============================================================================

export type StatusIntent = 'initial' | 'active' | 'warning' | 'danger' | 'success' | 'terminal'

export const statusIntentColor: Record<StatusIntent, SemanticColor> = {
  initial:  'muted',
  active:   'cyan',
  warning:  'amber',
  danger:   'red',
  success:  'green',
  terminal: 'muted',
}

// =============================================================================
// Spacing
// =============================================================================

export const space = {
  0:  '0px',
  1:  '4px',
  2:  '8px',
  3:  '12px',
  4:  '16px',
  5:  '20px',
  6:  '24px',
  8:  '32px',
  10: '40px',
  12: '48px',
} as const

export type Space = keyof typeof space

// =============================================================================
// Typography
// =============================================================================

export const font = {
  display: "'Krona One', system-ui, sans-serif",
  sans:    "'Inter', 'Noto Sans', system-ui, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', monospace",
} as const

export const fontSize = {
  '2xs':  '10px',
  xs:     '11px',
  sm:     '12px',
  md:     '13px',
  base:   '14px',
  lg:     '16px',
  xl:     '18px',
  '2xl':  '20px',
  '3xl':  '24px',
  '4xl':  '30px',
  '5xl':  '36px',
} as const

export type FontSize = keyof typeof fontSize

export const fontWeight = {
  normal:   '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
} as const

export type FontWeight = keyof typeof fontWeight

export const lineHeight = {
  tight:   '1.1',
  snug:    '1.3',
  normal:  '1.5',
  relaxed: '1.7',
} as const

export const letterSpacing = {
  tight:  '-0.02em',
  normal: '0',
  wide:   '0.04em',
  wider:  '0.08em',
} as const

// =============================================================================
// Radius
// =============================================================================

export const radius = {
  sm:   '4px',
  md:   '6px',
  lg:   '8px',
  xl:   '10px',
  full: '9999px',
} as const

// =============================================================================
// Animation
// =============================================================================

export const duration = {
  fast:    '100ms',
  normal:  '200ms',
  slow:    '400ms',
  counter: '600ms',
  gauge:   '800ms',
} as const

export const easing = {
  default: 'cubic-bezier(0.4, 0, 0.2, 1)',
  spring:  'cubic-bezier(0.34, 1.56, 0.64, 1)',
  out:     'cubic-bezier(0, 0, 0.2, 1)',
} as const

// =============================================================================
// Text Variant Defaults
// =============================================================================

export type TextVariant = 'display' | 'heading' | 'label' | 'value' | 'body' | 'caption'

export const textVariantDefaults: Record<TextVariant, {
  fontFamily: string
  fontSize: string
  fontWeight: string
  color: string
  lineHeight: string
  letterSpacing: string
  textTransform?: string
}> = {
  display: {
    fontFamily: font.display,
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    color: color.text,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  heading: {
    fontFamily: font.sans,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: color.text,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.normal,
  },
  label: {
    fontFamily: font.mono,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: color.textMuted,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase',
  },
  value: {
    fontFamily: font.mono,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: color.text,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.normal,
  },
  body: {
    fontFamily: font.sans,
    fontSize: fontSize.base,
    fontWeight: fontWeight.normal,
    color: color.textDim,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  caption: {
    fontFamily: font.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.normal,
    color: color.textDim,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
}
