/**
 * Animation Tokens
 *
 * Design system constants for the Animatable primitive and drag reticle system.
 * All timing values in milliseconds unless otherwise noted.
 */

// =============================================================================
// TIMING TOKENS
// =============================================================================

export const TIMING = {
  /** Sub-frame precision phases for corner emanation */
  emanation: {
    primary: { start: 0, duration: 15 },    // 0-15ms: Initial ring burst
    secondary: { start: 15, duration: 20 }, // 15-35ms: Follow-through ring
    tertiary: { start: 35, duration: 15 },  // 35-50ms: Decay ring
    total: 50,
  },

  /** Reticle handle animations */
  reticle: {
    expandDuration: 80,   // Crosshair expansion on grab
    pulsePeriod: 800,     // Ring pulse cycle
    collapseDuration: 120, // Collapse on release
  },

  /** Momentum trail animations */
  trail: {
    spawnInterval: 16,    // ~60fps ghost spawning
    fadeOutDuration: 200, // Ghost fade decay
    maxTrailLength: 8,    // Max ghost shapes in trail
  },

  /** Snap feedback animations */
  snap: {
    overshoot: 50,        // Elastic overshoot duration
    settle: 150,          // Settle to final position
    rippleDuration: 300,  // Snap ripple effect
  },
} as const

// =============================================================================
// EASING TOKENS
// =============================================================================

export const EASING = {
  /** GSAP easing strings */
  gsap: {
    emanationOut: 'power2.out',
    emanationIn: 'power1.in',
    reticleExpand: 'back.out(1.7)',
    reticleCollapse: 'power3.in',
    snapBounce: 'elastic.out(1, 0.3)',
    snapSettle: 'power2.out',
    trailFade: 'power1.out',
  },

  /** CSS easing for keyframe animations */
  css: {
    emanationOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
    snapBounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },

  /** Spring configurations for physics-based animations */
  spring: {
    snappy: { stiffness: 500, damping: 30 },
    bouncy: { stiffness: 300, damping: 15 },
    smooth: { stiffness: 150, damping: 25 },
  },
} as const

// =============================================================================
// COLOR TOKENS (TMNL Palette)
// =============================================================================

export const COLORS = {
  /** Reticle colors */
  reticle: {
    primary: '#00ff88',      // Bright green - primary ring
    secondary: '#44ffaa',    // Softer green - secondary ring
    tertiary: '#88ffcc',     // Pale green - tertiary ring
    glow: 'rgba(0, 255, 136, 0.4)', // Glow effect
  },

  /** Momentum trail colors */
  trail: {
    ghost: 'rgba(255, 255, 255, 0.15)',
    velocity: 'rgba(0, 255, 136, 0.3)', // Speed-based tint
  },

  /** Snap feedback colors */
  snap: {
    indicator: '#00a2ff',    // Cyan snap line
    ripple: 'rgba(0, 162, 255, 0.5)',
    particle: '#ffffff',
  },
} as const

// =============================================================================
// GEOMETRY TOKENS
// =============================================================================

export const GEOMETRY = {
  /** Corner emanation ring sizes */
  emanation: {
    primaryRadius: 24,      // Initial ring size (px)
    secondaryOffset: 4,     // Secondary ring offset from primary
    tertiaryScale: 1.2,     // Tertiary ring scale factor
    strokeWidth: {
      primary: 2,
      secondary: 1,
      tertiary: 0.5,
    },
  },

  /** Reticle handle dimensions */
  reticle: {
    crosshairLength: 12,    // Arm length from center
    crosshairGap: 4,        // Gap at center
    ringRadius: 16,         // Concentric ring radius
    ringCount: 3,           // Number of pulsing rings
  },

  /** Trail ghost dimensions */
  trail: {
    scaleDecay: 0.95,       // Each ghost slightly smaller
    opacityDecay: 0.85,     // Each ghost slightly more transparent
  },

  /** Snap indicator dimensions */
  snap: {
    lineThickness: 1,
    particleSize: 3,
    particleCount: 6,
  },
} as const

// =============================================================================
// ANIMATION STATE TYPES
// =============================================================================

export type AnimationState = 'idle' | 'animating' | 'paused' | 'completed'

export type EmanationPhase = 'primary' | 'secondary' | 'tertiary'

export type ReticleMode = 'dormant' | 'active' | 'locked'

export type SnapDirection = 'horizontal' | 'vertical' | 'both'

// =============================================================================
// CONFIGURATION INTERFACES
// =============================================================================

export interface AnimatableConfig<T> {
  /** Initial value */
  initial: T
  /** Animation duration in ms */
  duration?: number
  /** Easing function or string */
  ease?: string | ((t: number) => number)
  /** Spring configuration (overrides duration/ease) */
  spring?: {
    stiffness: number
    damping: number
    mass?: number
  }
  /** Callback on animation complete */
  onComplete?: () => void
  /** Callback on each animation frame */
  onUpdate?: (value: T) => void
}

export interface TimelinePhase<T> {
  /** Target values for this phase */
  to: Partial<T>
  /** Phase duration in ms */
  duration: number
  /** Delay before phase starts */
  delay?: number
  /** Easing for this phase */
  ease?: string
  /** Label for timeline positioning */
  label?: string
}

export interface EmanationConfig {
  /** Corner positions (0-3 for TL, TR, BR, BL) */
  corners: number[]
  /** Shape bounding box for corner calculation */
  bounds: { x: number; y: number; width: number; height: number }
  /** Override default timing */
  timing?: Partial<typeof TIMING.emanation>
  /** Override default colors */
  colors?: Partial<typeof COLORS.reticle>
}

export interface TrailConfig {
  /** Maximum number of ghost shapes */
  maxLength?: number
  /** Velocity threshold to spawn ghosts */
  velocityThreshold?: number
  /** Fade duration for each ghost */
  fadeDuration?: number
}

export interface SnapConfig {
  /** Grid size for snapping */
  gridSize?: number
  /** Snap threshold distance */
  threshold?: number
  /** Enable elastic bounce */
  bounce?: boolean
}
