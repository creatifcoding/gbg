/**
 * FUI Design Tokens
 *
 * Vantablack aesthetic - no glows, no pulse, pure darkness.
 */

// =============================================================================
// TIMING
// =============================================================================

export const FUI_TIMING = {
  /** Backdrop fade duration (ms) */
  backdropFade: 200,
  /** Content elevation duration (ms) */
  elevation: 250,
  /** Stagger delay between rows (ms) */
  rowStagger: 25,
  /** Single row reveal duration (ms) */
  rowReveal: 80,
} as const

// =============================================================================
// EASING (Framer Motion array format: [x1, y1, x2, y2])
// =============================================================================

export const FUI_EASING = {
  /** Sharp entrance */
  enter: [0.16, 1, 0.3, 1] as const,
  /** Smooth exit */
  exit: [0.4, 0, 0.2, 1] as const,
  /** Linear for typewriter */
  linear: [0, 0, 1, 1] as const,
} as const

// =============================================================================
// COLORS - Vantablack palette
// =============================================================================

export const FUI_COLORS = {
  /** Deep black background */
  vantablack: '#000000',
  /** Subtle border */
  border: 'rgba(255, 255, 255, 0.08)',
  /** Slightly visible border on hover */
  borderHover: 'rgba(255, 255, 255, 0.15)',
  /** Backdrop overlay */
  backdrop: 'rgba(0, 0, 0, 0.92)',
  /** Text muted */
  textMuted: 'rgba(255, 255, 255, 0.4)',
} as const

// =============================================================================
// GEOMETRY
// =============================================================================

export const FUI_GEOMETRY = {
  /** Initial scale for elevation */
  scaleFrom: 0.96,
  /** Final scale for elevation */
  scaleTo: 1,
  /** Blur amount for backdrop */
  backdropBlur: 12,
} as const
