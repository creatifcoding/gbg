/**
 * TMNL CEW Design Tokens
 *
 * Pure black aesthetic with minimal accent.
 * Command & Electronic Warfare inspired design system.
 */

// =============================================================================
// TMNL TOKENS (Tailwind Classes)
// =============================================================================

export const TMNL_TOKENS = {
  // Backgrounds (pure black spectrum)
  bg: {
    primary: 'bg-black',
    secondary: 'bg-neutral-950',
    elevated: 'bg-neutral-900',
    hover: 'hover:bg-neutral-900',
  },

  // Borders (hairline)
  border: {
    default: 'border-neutral-800',
    hover: 'hover:border-neutral-600',
    active: 'border-neutral-700',
  },

  // Text hierarchy
  text: {
    primary: 'text-white',
    secondary: 'text-neutral-400',
    tertiary: 'text-neutral-500',
    muted: 'text-neutral-600',
    hover: 'hover:text-white',
  },

  // Typography
  typography: {
    label: 'font-mono uppercase tracking-[0.15em]',
    body: 'font-mono',
    mono: 'font-mono',
  },

  // Animation (Framer Motion)
  animation: {
    spring: { type: 'spring' as const, stiffness: 400, damping: 40 },
    fade: { duration: 0.15 },
  },
} as const

// =============================================================================
// FONT SIZES (CSS Variables with fallbacks)
// THE 12px FLOOR - Nothing goes below 12px. Ever.
// =============================================================================

export const TMNL_FONT_SIZE = {
  xs: 'var(--tmnl-text-xs, 12px)',
  sm: 'var(--tmnl-text-sm, 14px)',
  base: 'var(--tmnl-text-base, 16px)',
  lg: 'var(--tmnl-text-lg, 18px)',
} as const

// =============================================================================
// RAW COLORS (For inline styles when needed)
// =============================================================================

export const TMNL_COLORS = {
  black: '#000000',
  neutral: {
    950: '#0a0a0a',
    900: '#171717',
    800: '#262626',
    700: '#404040',
    600: '#525252',
    500: '#737373',
    400: '#a3a3a3',
    300: '#d4d4d4',
    200: '#e5e5e5',
    100: '#f5f5f5',
  },
  white: '#ffffff',
} as const
