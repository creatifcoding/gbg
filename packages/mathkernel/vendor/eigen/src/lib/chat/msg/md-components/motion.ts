/**
 * TMNL Markdown Motion — shared animation constants.
 *
 * Design rules (Emil Kowalski):
 *   - ease-out default, custom cubic-bezier for character
 *   - 200ms for micro, 250ms max for entrances
 *   - transform + opacity only (composite layer, GPU)
 *   - Respect prefers-reduced-motion: opacity-only fallback
 *
 * @module chat/msg/md-components/motion
 */

// ─── Easing ─────────────────────────────────────────────────────────────────

/** Custom ease-out with more energy than CSS ease-out */
export const EASE_OUT: [number, number, number, number] = [0.32, 0.72, 0, 1]

/** Gentle ease for subtle entrances */
export const EASE_GENTLE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

// ─── Durations (seconds) ────────────────────────────────────────────────────

/** Micro interaction — hover, toggle */
export const DURATION_MICRO = 0.15

/** Standard entrance — element appearing */
export const DURATION_ENTER = 0.2

/** Slightly longer entrance for heavier elements */
export const DURATION_ENTER_HEAVY = 0.25

// ─── Reduced motion variants ────────────────────────────────────────────────
// When prefers-reduced-motion, we still show opacity transitions (safe)
// but strip all transform motion (slide, scale, etc.)

export const REDUCED_ENTER = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: DURATION_ENTER, ease: EASE_GENTLE },
}
