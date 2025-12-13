/**
 * TMNL Capability Design Tokens
 *
 * Centralized design system for capability rendering.
 * Matte aesthetic — stillness with potential, minimal cognitive load.
 *
 * Design principles:
 * - Desaturated accents (0.2-0.4 alpha borders, no harsh glows)
 * - Slow breathing animations (4-6s) for presence
 * - Quick bursts (0.15s) only on state transitions
 */

// =============================================================================
// COLOR PALETTE (Matte)
// =============================================================================

export const COLORS = {
  // Accent colors — desaturated for calm presence
  accent: {
    cyan: {
      base: '#00A2FF',      // TMNL cyan (from data-grid)
      solid: 'rgba(0, 162, 255, 0.9)',
      border: 'rgba(0, 162, 255, 0.35)',
      muted: 'rgba(0, 162, 255, 0.08)',
      glow: 'rgba(0, 162, 255, 0.15)',
    },
    orange: {
      base: '#f97316',      // orange-500 (warmer)
      solid: 'rgba(249, 115, 22, 0.9)',
      border: 'rgba(249, 115, 22, 0.4)',
      muted: 'rgba(249, 115, 22, 0.1)',
      glow: 'rgba(249, 115, 22, 0.2)',
    },
    violet: {
      base: '#8b5cf6',      // violet-500
      solid: 'rgba(139, 92, 246, 0.9)',
      border: 'rgba(139, 92, 246, 0.35)',
      muted: 'rgba(139, 92, 246, 0.08)',
      glow: 'rgba(139, 92, 246, 0.15)',
    },
    green: {
      base: '#22c55e',      // green-500 (from data-grid)
      solid: 'rgba(34, 197, 94, 0.9)',
      border: 'rgba(34, 197, 94, 0.35)',
      muted: 'rgba(34, 197, 94, 0.08)',
      glow: 'rgba(34, 197, 94, 0.15)',
    },
    red: {
      base: '#ef4444',      // red-500 (from data-grid)
      solid: 'rgba(239, 68, 68, 0.9)',
      border: 'rgba(239, 68, 68, 0.4)',
      muted: 'rgba(239, 68, 68, 0.1)',
      glow: 'rgba(239, 68, 68, 0.2)',
    },
    amber: {
      base: '#eab308',      // amber-500 (from data-grid)
      solid: 'rgba(234, 179, 8, 0.9)',
      border: 'rgba(234, 179, 8, 0.35)',
      muted: 'rgba(234, 179, 8, 0.08)',
      glow: 'rgba(234, 179, 8, 0.15)',
    },
    white: {
      base: '#ffffff',
      solid: 'rgba(255, 255, 255, 0.9)',
      border: 'rgba(255, 255, 255, 0.2)',
      muted: 'rgba(255, 255, 255, 0.05)',
      glow: 'rgba(255, 255, 255, 0.1)',
    },
  },

  // Neutral palette — aligned with TMNL_TOKENS from data-grid
  neutral: {
    black: '#000000',
    950: '#0a0a0a',      // backgroundPrimary
    925: '#0d0d0d',      // backgroundSecondary
    900: '#141414',      // backgroundTertiary
    850: '#1a1a1a',      // backgroundHover / borderMuted
    800: '#262626',      // borderDefault
    750: '#333333',      // borderSubtle
    700: '#404040',
    600: '#525252',      // textDisabled
    500: '#737373',      // textMuted
    400: '#a3a3a3',      // textSecondary
    300: '#d4d4d4',
    200: '#e5e5e5',
    100: '#ffffff',      // textPrimary
  },
} as const

export type AccentColor = keyof typeof COLORS.accent

// =============================================================================
// TIMING (Matte Animation Cadence)
// =============================================================================

export const TIMING = {
  // Duration in ms
  instant: 50,
  fast: 150,
  normal: 200,
  slow: 300,
  deliberate: 500,

  // Breathing animation — slow, meditative (from Dispositions)
  breathing: {
    period: 4000,           // Full breath cycle
    scale: [1, 1.02, 1],    // Subtle expansion
    opacity: [0.6, 0.85, 0.6], // Soft fade
  },

  // Active pulse — quicker for "active" states
  activePulse: {
    period: 1500,
    scale: [1, 1.04, 1],
    opacity: [0.7, 1, 0.7],
  },

  // State transition burst (from Dispositions TransitionFX)
  burst: {
    duration: 150,
    scale: [1, 1.08, 1],
  },

  // Tooltip
  tooltip: {
    showDelay: 300,         // Slightly quicker for responsiveness
    hideDelay: 100,
    duration: 150,          // Fade in duration
    offset: 4,              // Y translate
  },

  // Badge
  badge: {
    dotPeriod: 3000,        // Slow dot pulse
    dotScale: [1, 1.3, 1],
  },
} as const

// =============================================================================
// EASING
// =============================================================================

export const EASING = {
  // CSS cubic-bezier
  css: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',  // TMNL standard (from data-grid)
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // anime.js easing strings
  anime: {
    default: 'outQuad',
    in: 'inQuad',
    out: 'outQuad',
    inOut: 'inOutQuad',
    breathing: 'inOutSine',   // Smooth for slow breathing
    burst: 'outBack',         // Snappy for state transitions
  },
} as const

// =============================================================================
// GEOMETRY
// =============================================================================

export const GEOMETRY = {
  // Border radius
  radius: {
    none: '0',
    sm: '2px',
    md: '4px',
    lg: '8px',
    full: '9999px',
  },

  // Glow spread
  glow: {
    sm: { blur: 4, spread: 1 },
    md: { blur: 8, spread: 2 },
    lg: { blur: 12, spread: 4 },
  },

  // Tooltip
  tooltip: {
    offset: 6,
    arrowSize: 6,
    maxWidth: 200,
  },

  // Badge
  badge: {
    offsetX: -4,
    offsetY: -4,
    minWidth: 16,
  },
} as const

// =============================================================================
// Z-INDEX
// =============================================================================

export const Z_INDEX = {
  glow: 0,        // Behind content
  content: 1,     // Normal content
  badge: 10,      // Above content
  tooltip: 100,   // Floating
  floating: 5000, // Floating panels (between tooltip and modal)
  modal: 9999,    // Top level (matches BaseModal)
} as const

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const TYPOGRAPHY = {
  fontFamily: {
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
    sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },

  fontSize: {
    xxs: '9px',
    xs: '10px',
    sm: '12px',
    md: '14px',
    lg: '16px',
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    bold: 700,
  },
} as const
