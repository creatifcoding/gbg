/**
 * Status banner constants — stack geometry, swipe thresholds, animation curves.
 *
 * @module morphchat/components/status-banner/constants
 */

// ─── Card stack ──────────────────────────────────────────────────────────────

/** Negative margin for collapsed card overlap (px) */
export const CARD_OVERLAP = -18

/** Scale reduction per depth level in collapsed stack */
export const CARD_SCALE_STEP = 0.04

/** Opacity reduction per depth level in collapsed stack */
export const CARD_OPACITY_STEP = 0.15

/** Max visible cards in collapsed stack */
export const VISIBLE_CARDS = 3

/** Gap between cards when expanded (px) */
export const EXPANDED_GAP = 4

/** Stagger delay per card on expand/collapse (ms) */
export const STAGGER_MS = 30

// ─── Compact card sizing ─────────────────────────────────────────────────────

/** Icon size inside toast cards */
export const CARD_ICON_SIZE = 12

/** Icon stroke width */
export const CARD_ICON_STROKE = 1.5

/** Truncation threshold for status text (chars) */
export const STATUS_ROW_MAX = 180

/** Narrow container threshold (px) */
export const TOAST_NARROW_PX = 400

// ─── Swipe-to-dismiss ────────────────────────────────────────────────────────

/** Distance threshold for swipe dismiss (px) */
export const SWIPE_THRESHOLD = 45

/** Velocity threshold for momentum dismiss (px/ms) — Sonner uses 0.11 */
export const VELOCITY_THRESHOLD = 0.11

/** Damping factor when dragging in non-dismiss direction */
export const DRAG_DAMPING = 0.3

// ─── FM transition presets ───────────────────────────────────────────────────

/** Entry: fast start, smooth settle */
export const ENTER_CURVE = [0.32, 0.72, 0, 1] as const
export const ENTER_TRANSITION = { duration: 0.15, ease: ENTER_CURVE }

/** Exit: Sonner-matched 200ms launch curve */
export const EXIT_CURVE = [0.32, 0.72, 0, 1] as const
export const EXIT_TRANSITION = { duration: 0.2, ease: EXIT_CURVE }
