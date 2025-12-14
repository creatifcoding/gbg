/**
 * Visual Overlay Constants
 *
 * Canonical z-index hierarchy and animation defaults.
 * These values enforce the visual stacking order across all overlay types.
 *
 * @module
 */

import type { VisualOverlayType, SlotId } from "../schemas/visual"

// ─────────────────────────────────────────────────────────────
// Z-Index Tiers
// ─────────────────────────────────────────────────────────────

/**
 * Z-index base values per overlay type.
 * Canonical stacking order (highest number = frontmost):
 *
 * Command Palette: 30000 (always on top, keyboard-driven)
 * Modal:          20000 (blocking, requires attention)
 * Toast:          15000 (notifications, non-blocking)
 * Drawer:         10000 (side panels, can stack)
 * Top Bar:         5000 (persistent UI chrome)
 * Sidebar:         4000 (navigation, below top bar)
 */
export const Z_INDEX_TIERS = {
  "command-palette": 30000,
  "modal": 20000,
  "toast": 15000,
  "drawer": 10000,
  "top-bar": 5000,
  "sidebar": 4000,
} as const satisfies Record<VisualOverlayType, number>

/** Gap between stacked overlays of the same type */
export const Z_INDEX_STACK_GAP = 10

/**
 * Get z-index for an overlay based on type and stack position.
 *
 * @param type - Overlay type
 * @param stackPosition - Position in stack (0 = bottom)
 * @param offset - Additional offset from config
 * @returns Computed z-index
 */
export function calculateZIndex(
  type: VisualOverlayType,
  stackPosition: number,
  offset: number = 0,
): number {
  const tierBase = Z_INDEX_TIERS[type]
  return tierBase + (stackPosition * Z_INDEX_STACK_GAP) + offset
}

// ─────────────────────────────────────────────────────────────
// Slot Constants
// ─────────────────────────────────────────────────────────────

/** Global slot identifier (viewport-level) */
export const GLOBAL_SLOT_ID = "global" as SlotId

/** Reserved slot IDs (cannot be used for panel slots) */
export const RESERVED_SLOT_IDS = [GLOBAL_SLOT_ID] as const

/**
 * Check if a slot ID is reserved.
 */
export function isReservedSlotId(id: SlotId): boolean {
  return RESERVED_SLOT_IDS.includes(id as typeof RESERVED_SLOT_IDS[number])
}

// ─────────────────────────────────────────────────────────────
// Overlay Type Classifications
// ─────────────────────────────────────────────────────────────

/** Overlay types that only render in global slot (viewport-relative) */
export const GLOBAL_ONLY_TYPES = ["modal", "command-palette", "top-bar", "toast"] as const
export type GlobalOnlyType = typeof GLOBAL_ONLY_TYPES[number]

/** Overlay types that support slot scoping (can be panel-relative) */
export const SLOTTED_TYPES = ["drawer", "sidebar"] as const
export type SlottedType = typeof SLOTTED_TYPES[number]

/**
 * Check if an overlay type supports slot scoping.
 */
export function supportsSlotScoping(type: VisualOverlayType): type is SlottedType {
  return (SLOTTED_TYPES as readonly string[]).includes(type)
}

/**
 * Check if an overlay type is global-only.
 */
export function isGlobalOnlyType(type: VisualOverlayType): type is GlobalOnlyType {
  return (GLOBAL_ONLY_TYPES as readonly string[]).includes(type)
}

// ─────────────────────────────────────────────────────────────
// Animation Defaults
// ─────────────────────────────────────────────────────────────

/**
 * Default animation durations in milliseconds.
 */
export const ANIMATION_DURATIONS = {
  /** Drawer enter/exit duration */
  drawer: 300,
  /** Modal enter/exit duration */
  modal: 200,
  /** Toast enter/exit duration */
  toast: 300,
  /** Command palette enter/exit duration */
  "command-palette": 150,
  /** Top bar auto-hide transition */
  "top-bar": 200,
  /** Sidebar expand/collapse duration */
  sidebar: 200,
} as const satisfies Record<VisualOverlayType, number>

/**
 * Default easing functions per overlay type.
 * Uses CSS easing keywords for anime.js/GSAP compatibility.
 */
export const ANIMATION_EASINGS = {
  drawer: "easeOutCubic",
  modal: "easeOutQuart",
  toast: "easeOutBack",
  "command-palette": "easeOutQuad",
  "top-bar": "easeInOutQuad",
  sidebar: "easeOutCubic",
} as const satisfies Record<VisualOverlayType, string>

/**
 * Get animation duration for an overlay type.
 */
export function getAnimationDuration(type: VisualOverlayType): number {
  return ANIMATION_DURATIONS[type]
}

/**
 * Get animation easing for an overlay type.
 */
export function getAnimationEasing(type: VisualOverlayType): string {
  return ANIMATION_EASINGS[type]
}

// ─────────────────────────────────────────────────────────────
// Backdrop Constants
// ─────────────────────────────────────────────────────────────

/** Backdrop opacity when fully visible */
export const BACKDROP_OPACITY = 0.5

/** Backdrop blur amount */
export const BACKDROP_BLUR = "4px"

/** Backdrop color (pure black with opacity) */
export const BACKDROP_COLOR = `rgba(0, 0, 0, ${BACKDROP_OPACITY})`
