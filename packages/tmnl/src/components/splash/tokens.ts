/**
 * Splash Screen Tokens
 *
 * Design system constants for the Q-Branch Brutalist splash sequence.
 * Extends the base animation tokens with CRT-specific values.
 */

// =============================================================================
// TIMING TOKENS
// =============================================================================

export const SPLASH_TIMING = {
  /** Boot sequence phases */
  boot: {
    staticBurst: 300,      // Initial static noise duration
    lineInterval: 150,     // Gap between init lines (staccato)
    lineTypeDuration: 80,  // Per-character type speed for emphasis lines
    colorShiftDuration: 200, // Status color shift animation
    total: 2000,           // Total boot phase (~2s)
  },

  /** Logo reveal phases */
  logo: {
    letterStagger: 500,    // Gap between each letter→word reveal
    wordExpandDuration: 300, // How long each word expansion takes
    total: 2000,           // Total logo phase (~2s)
  },

  /** Transition phase */
  transition: {
    morphDuration: 600,    // Terminal→app morph
    fadeOverlap: 200,      // Overlap between splash fade and app reveal
  },

  /** CRT effects */
  crt: {
    flickerInterval: 100,  // Base flicker cycle
    moireSpeed: 2000,      // Moiré pattern cycle
    scanlineFade: 400,     // Scanline fade-out duration
  },
} as const

// =============================================================================
// COLOR TOKENS
// =============================================================================

export const SPLASH_COLORS = {
  /** Base palette - warm gray with cream undertones */
  text: {
    primary: '#e8e4de',      // Warm gray - main text
    secondary: '#b8b4ae',    // Muted - secondary info
    dim: '#78746e',          // Very muted - timestamps, brackets
    success: '#c8e4d8',      // Shifted warm green - completion
  },

  /** Background */
  bg: {
    primary: '#0a0a0a',      // Near-black
    scanline: 'rgba(255, 252, 245, 0.03)', // Warm white scanlines
  },

  /** Effects */
  fx: {
    static: '#f8f4ee',       // Static noise color
    glow: 'rgba(232, 228, 222, 0.15)', // Text glow
    flicker: 'rgba(255, 252, 245, 0.05)', // Flicker overlay
  },
} as const

// =============================================================================
// TYPOGRAPHY TOKENS
// =============================================================================

export const SPLASH_TYPOGRAPHY = {
  /** Font family - monospace stack */
  fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', monospace",

  /** Font weights */
  weight: {
    light: 300,
    regular: 400,
    medium: 500,
    bold: 700,
  },

  /** Font sizes */
  size: {
    xs: '0.65rem',    // Timestamps, brackets
    sm: '0.75rem',    // Status lines
    base: '0.875rem', // Main content
    lg: '1.125rem',   // Headers
    xl: '1.5rem',     // Logo letters
    '2xl': '2rem',    // Logo words
  },

  /** Line heights */
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const

// =============================================================================
// CRT EFFECT TOKENS
// =============================================================================

export const CRT_EFFECTS = {
  /** Scanline configuration */
  scanlines: {
    spacing: 2,           // Pixels between scanlines
    opacity: 0.08,        // Base opacity
    thickness: 1,         // Line thickness
  },

  /** Flicker/jitter */
  flicker: {
    intensity: 0.03,      // Max opacity variance
    frequency: 0.1,       // Probability per frame
  },

  /** Moiré interference */
  moire: {
    scale: 200,           // Pattern scale
    opacity: 0.02,        // Very subtle
    speed: 0.5,           // Animation speed multiplier
  },

  /** Static burst */
  static: {
    density: 0.3,         // Pixel density
    decay: 0.95,          // Per-frame decay
  },
} as const

// =============================================================================
// INIT LINE CONTENT
// =============================================================================

export interface InitLine {
  /** Bracket label */
  label: string
  /** Status text */
  status: string
  /** Entry mode: 'instant' | 'typed' */
  mode: 'instant' | 'typed'
  /** Delay before this line (ms) */
  delay: number
  /** Is this the wit line? */
  isWit?: boolean
}

export const INIT_LINES: InitLine[] = [
  { label: 'CORE', status: 'initializing runtime', mode: 'instant', delay: 0 },
  { label: 'RENDER', status: 'binding gpu context', mode: 'instant', delay: 150 },
  { label: 'STATE', status: 'hydrating atoms', mode: 'typed', delay: 300 },
  { label: 'NETWORK', status: 'establishing mesh', mode: 'instant', delay: 450 },
  { label: 'LAYER', status: 'compositing surfaces', mode: 'instant', delay: 600 },
  { label: 'READY', status: 'nominal', mode: 'typed', delay: 800, isWit: false },
]

// The subtle wit line (appears as a brief flash or in the log)
export const WIT_LINE: InitLine = {
  label: 'VIBE',
  status: 'immaculate',
  mode: 'instant',
  delay: 750,
  isWit: true,
}

// =============================================================================
// LOGO CONFIGURATION
// =============================================================================

export const LOGO_CONFIG = {
  letters: [
    { letter: 'T', word: 'Terminal' },
    { letter: 'M', word: 'Multi-Modal' },
    { letter: 'N', word: 'Navigation' },
    { letter: 'L', word: 'Layer' },
  ],
  /** Mechanical easing - linear with slight ease-out at end */
  easing: 'linear',
} as const

// =============================================================================
// EASING TOKENS
// =============================================================================

export const SPLASH_EASING = {
  /** Mechanical - robotic precision */
  mechanical: 'linear',

  /** Slight decel for natural stops */
  stop: 'easeOutQuad',

  /** For color shifts */
  colorShift: 'easeInOutQuad',
} as const
