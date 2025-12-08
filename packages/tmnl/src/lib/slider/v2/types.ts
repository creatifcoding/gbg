/**
 * Slider V2 Types
 *
 * CEW-grade slider with trait-based composition and Effect-ified animations.
 *
 * Design Philosophy:
 * - Precise but alive
 * - In bounds but breaking them for you (elastic overshoot + soft clamp glow)
 * - Static idle, instant response
 * - Trait-derived, slots-based blessing
 * - Full Effect-ification
 */

import type { CSSProperties } from 'react'

// =============================================================================
// CORE SLIDER TYPES
// =============================================================================

/**
 * Slider configuration - bounds and basic behavior
 */
export interface SliderConfig {
  /** Minimum value */
  min: number

  /** Maximum value */
  max: number

  /** Step size (0 for continuous) */
  step?: number

  /** Optional unit label */
  unit?: string

  /** Orientation */
  orientation?: 'horizontal' | 'vertical'

  /** Track length in pixels (for calculating position) */
  trackLength?: number
}

/**
 * Slider runtime state
 */
export interface SliderState {
  /** Current value */
  value: number

  /** Normalized value (0-1) */
  normalizedValue: number

  /** Is currently being dragged */
  isDragging: boolean

  /** Last modifier keys state */
  modifiers: ModifierKeys

  /** Visual position (can extend beyond bounds during overshoot) */
  visualPosition: number

  /** Is currently animating */
  isAnimating: boolean
}

/**
 * Modifier keys state for precision control
 */
export interface ModifierKeys {
  shift: boolean
  ctrl: boolean
  alt: boolean
  meta: boolean
}

// =============================================================================
// TRAIT SLOT TYPES
// =============================================================================

/**
 * GlowTrait slot - visual feedback at boundaries and snap points
 */
export interface GlowSlot {
  /** Glow color from palette */
  color: 'cyan' | 'amber' | 'green' | 'red' | 'violet'

  /** Glow intensity */
  intensity: 'subtle' | 'normal' | 'intense'

  /** Emanate glow burst on snap */
  emanateOnSnap?: boolean

  /** Emanate glow burst on boundary hit */
  emanateOnBoundary?: boolean
}

/**
 * SnapTrait slot - magnetism toward discrete values
 */
export interface SnapSlot {
  /** Snap points (array of values, or preset curves) */
  steps: number[] | 'linear' | 'logarithmic'

  /** Magnetism strength (0-1) */
  magnetism: number

  /** Show grid markers at snap points */
  showGrid?: boolean

  /** Enable haptic feedback (future) */
  hapticFeedback?: boolean
}

/**
 * CurveTrait slot - value transformation curve
 */
export interface CurveSlot {
  /** Curve type */
  type: 'linear' | 'logarithmic' | 'decibel' | 'exponential'

  /** Base for logarithmic curves */
  base?: number

  /** Exponent for exponential curves */
  exponent?: number
}

/**
 * OvershootTrait slot - elastic behavior at boundaries
 */
export interface OvershootSlot {
  /** Enable overshoot */
  enabled: boolean

  /** Visual extension beyond boundary (0.15 = 15%) */
  extent: number

  /** Rubber-band settle duration (ms) */
  settleMs: number

  /** Easing function for settle animation */
  easing: string
}

/**
 * PrecisionTrait slot - modifier key sensitivity
 */
export interface PrecisionSlot {
  /** Base sensitivity multiplier */
  baseSensitivity: number

  /** Shift-key multiplier (fine control) */
  shiftMultiplier: number

  /** Ctrl-key multiplier (ultra-fine control) */
  ctrlMultiplier: number

  /** Alt-key behavior */
  altBehavior: 'snap' | 'reset' | 'none'
}

// =============================================================================
// SLIDER EVENTS
// =============================================================================

/**
 * Slider events for state machine
 */
export type SliderEvent =
  | { type: 'DRAG_START'; position: number; modifiers: ModifierKeys }
  | { type: 'DRAG_MOVE'; position: number; modifiers: ModifierKeys }
  | { type: 'DRAG_END' }
  | { type: 'SET_VALUE'; value: number }
  | { type: 'ANIMATE_START' }
  | { type: 'ANIMATE_END' }
  | { type: 'RESET' }

// =============================================================================
// SLIDER DEFAULTS
// =============================================================================

export const DEFAULT_SLIDER_CONFIG: SliderConfig = {
  min: 0,
  max: 100,
  step: 0,
  orientation: 'horizontal',
}

export const DEFAULT_MODIFIERS: ModifierKeys = {
  shift: false,
  ctrl: false,
  alt: false,
  meta: false,
}

export const initialSliderState = (config: SliderConfig): SliderState => ({
  value: config.min,
  normalizedValue: 0,
  isDragging: false,
  modifiers: DEFAULT_MODIFIERS,
  visualPosition: 0,
  isAnimating: false,
})

// =============================================================================
// GLOW COLORS (Design Tokens)
// =============================================================================

export const GLOW_COLORS: Record<GlowSlot['color'], string> = {
  cyan: '#22d3ee',     // cyan-400
  amber: '#fbbf24',    // amber-400
  green: '#4ade80',    // green-400
  red: '#f87171',      // red-400
  violet: '#a78bfa',   // violet-400
}

// =============================================================================
// TIMING TOKENS (CEW-tactical)
// =============================================================================

export const TIMING = {
  /** Tactical follow-through on release */
  settle: 65,

  /** Overshoot extension phase */
  overshootExtend: 30,

  /** Glow emanation burst */
  emanation: 50,

  /** Hover response */
  hover: 100,
} as const

export const EASING = {
  /** Settle back from overshoot */
  settleBack: 'easeOutBack',

  /** Fast extension */
  extend: 'easeOutQuad',

  /** Glow fade */
  glow: 'easeOutExpo',
} as const
