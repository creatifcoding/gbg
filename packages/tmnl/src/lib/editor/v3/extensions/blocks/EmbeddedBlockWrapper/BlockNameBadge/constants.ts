/**
 * BlockNameBadge Constants
 *
 * Animation timing, easing, and color tokens.
 * Based on STORYBOARD.md specification.
 *
 * @module editor/v3/extensions/blocks/BlockNameBadge/constants
 */

// =============================================================================
// Timing Tokens (milliseconds)
// =============================================================================

export const TIMING = {
  // State transition durations
  displayToEditing: 150,
  editingToSubmitting: 100,
  submittingToSuccess: 150,
  successHold: 400, // Checkmark visible before auto-transition
  successToDisplay: 150,
  errorEntry: 300,
  errorToEditing: 200,

  // Micro-animation durations
  prefixFadeOut: 80,
  caretFadeIn: 80,
  caretFadeInDelay: 40, // Crossfade overlap with prefix

  // Continuous animation periods
  caretPulse: 800,
  shimmerCycle: 1200,

  // Error animation
  errorShake: 300,

  // Checkmark animation phases
  checkmarkScaleIn: 150,
  checkmarkScaleInDelay: 100,
  checkmarkSlideOut: 150,

  // Text slide animations
  slideInDuration: 150,
  slideInDelay: 100,
} as const;

// =============================================================================
// Easing Tokens
// =============================================================================

export const EASING = {
  // Standard curves
  default: 'easeOutCubic',
  in: 'easeInQuad',
  out: 'easeOutQuad',
  inOut: 'easeInOutCubic',

  // Spring for bouncy effects (checkmark)
  // anime.js spring format: spring(mass, stiffness, damping, velocity)
  spring: 'spring(1, 80, 10, 0)',

  // Continuous animations
  breathing: 'easeInOutSine',

  // CSS equivalents (for style definitions)
  css: {
    out: 'cubic-bezier(0.16, 1, 0.3, 1)',
    inOut: 'cubic-bezier(0.45, 0, 0.55, 1)',
  },
} as const;

// =============================================================================
// Color Tokens
// =============================================================================

export const COLORS = {
  // Underline states
  underlineMuted: 'rgba(255, 255, 255, 0.1)',
  underlineCyan: '#22d3ee', // Editing/active
  underlineEmerald: '#34d399', // Success
  underlineRose: '#f43f5e', // Error

  // Text
  textPrimary: 'rgba(255, 255, 255, 0.95)',
  textMuted: 'rgba(255, 255, 255, 0.5)',
  textDimmed: 'rgba(255, 255, 255, 0.8)', // During submitting

  // Accent glows
  emeraldGlow: 'rgba(52, 211, 153, 0.4)',
  cyanGlow: 'rgba(34, 211, 238, 0.3)',
  roseGlow: 'rgba(244, 63, 94, 0.3)',

  // Soft variant backgrounds (10-15% opacity fills)
  roseSoftBg: 'rgba(244, 63, 94, 0.12)',
  roseSoftBorder: 'rgba(244, 63, 94, 0.3)',

  // Prefix "@" symbol
  prefixOpacity: 0.6,
} as const;

// =============================================================================
// Geometry Tokens
// =============================================================================

export const GEOMETRY = {
  // Underline
  underlineHeight: 1,

  // Caret
  caretWidth: 1,
  caretHeight: 16,

  // Checkmark
  checkmarkSize: 14,

  // Slide distances
  slideDistance: 20,

  // Shake amplitude
  shakeAmplitude: 4,
} as const;

// =============================================================================
// Typography Tokens
// =============================================================================

export const TYPOGRAPHY = {
  name: {
    fontFamily: 'var(--font-geist-sans), system-ui',
    fontSize: 13,
    fontWeight: 450,
    letterSpacing: '-0.01em',
  },
  blockId: {
    fontFamily: 'var(--font-geist-mono), monospace',
    fontSize: 10,
    fontWeight: 400,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
  placeholder: {
    opacity: 0.3,
  },
  untitled: {
    fontStyle: 'italic' as const,
    opacity: 0.5,
  },
} as const;
