/**
 * RVN Layout Animation Presets
 *
 * FLIP-based layout transition configurations using anime.js.
 * These presets define enter/leave animations for layout changes.
 *
 * Usage:
 * ```ts
 * import { createLayout } from 'animejs'
 * import { RVN_ACCORDION_LAYOUT } from './layout'
 *
 * const layout = createLayout({
 *   root: containerRef.current,
 *   ...RVN_ACCORDION_LAYOUT,
 * })
 *
 * layout.refresh() // After DOM changes
 * ```
 */

import { spring } from 'animejs'

// =============================================================================
// SPRING CONFIGURATIONS
// =============================================================================

/**
 * Snappy spring: Quick, controlled bounce.
 * For UI elements that need responsive feel.
 */
export const SPRING_SNAPPY = spring({
  bounce: 0.3,
  duration: 400,
})

/**
 * Bouncy spring: More pronounced bounce.
 * For playful micro-interactions.
 */
export const SPRING_BOUNCY = spring({
  bounce: 0.5,
  duration: 500,
})

/**
 * Stiff spring: Minimal overshoot.
 * For precise UI elements.
 */
export const SPRING_STIFF = spring({
  bounce: 0.15,
  duration: 300,
})

/**
 * Smooth spring: Gentle, no bounce.
 * For subtle layout changes.
 */
export const SPRING_SMOOTH = spring({
  bounce: 0,
  duration: 400,
})

/**
 * Dramatic spring: Slow, pronounced.
 * For emphasized transitions.
 */
export const SPRING_DRAMATIC = spring({
  bounce: 0.4,
  duration: 600,
})

// =============================================================================
// LAYOUT PRESETS
// =============================================================================

/**
 * Layout preset configuration type.
 */
export interface LayoutPreset {
  /** Initial state for entering elements */
  enterFrom: Record<string, string | number>
  /** Final state for leaving elements */
  leaveTo: Record<string, string | number>
  /** Spring/easing configuration */
  ease: ReturnType<typeof spring> | string
  /** Duration in ms (when not using spring) */
  duration?: number
}

/**
 * Accordion layout: Vertical expand/collapse.
 * Items slide down on enter, slide up on leave.
 */
export const RVN_ACCORDION_LAYOUT: LayoutPreset = {
  enterFrom: {
    opacity: 0,
    scaleY: 0,
    transformOrigin: 'top',
  },
  leaveTo: {
    opacity: 0,
    scaleY: 0,
    transformOrigin: 'top',
  },
  ease: SPRING_SNAPPY,
}

/**
 * Navigation layout: Horizontal slide transitions.
 * Items slide in from right, slide out to left.
 */
export const RVN_NAV_LAYOUT: LayoutPreset = {
  enterFrom: {
    opacity: 0,
    translateX: 30,
  },
  leaveTo: {
    opacity: 0,
    translateX: -30,
  },
  ease: SPRING_STIFF,
}

/**
 * Grid layout: Scale + fade transitions.
 * Items scale up on enter, scale down on leave.
 */
export const RVN_GRID_LAYOUT: LayoutPreset = {
  enterFrom: {
    opacity: 0,
    scale: 0.8,
  },
  leaveTo: {
    opacity: 0,
    scale: 0.8,
  },
  ease: SPRING_SNAPPY,
}

/**
 * List layout: Vertical slide transitions.
 * Items slide down on enter, fade on leave.
 */
export const RVN_LIST_LAYOUT: LayoutPreset = {
  enterFrom: {
    opacity: 0,
    translateY: -20,
  },
  leaveTo: {
    opacity: 0,
    translateY: 10,
  },
  ease: SPRING_SNAPPY,
}

/**
 * Tab layout: Horizontal crossfade.
 * Content slides with direction awareness.
 */
export const RVN_TAB_LAYOUT: LayoutPreset = {
  enterFrom: {
    opacity: 0,
    translateX: 50,
  },
  leaveTo: {
    opacity: 0,
    translateX: -50,
  },
  ease: SPRING_SMOOTH,
}

/**
 * Modal layout: Scale + fade from center.
 * Modal-like appearance.
 */
export const RVN_MODAL_LAYOUT: LayoutPreset = {
  enterFrom: {
    opacity: 0,
    scale: 0.9,
    translateY: 20,
  },
  leaveTo: {
    opacity: 0,
    scale: 0.95,
    translateY: -10,
  },
  ease: SPRING_BOUNCY,
}

/**
 * Drawer layout: Slide from edge.
 * For side panels and drawers.
 */
export const RVN_DRAWER_LAYOUT: LayoutPreset = {
  enterFrom: {
    opacity: 0,
    translateX: '-100%',
  },
  leaveTo: {
    opacity: 0,
    translateX: '-100%',
  },
  ease: SPRING_SNAPPY,
}

/**
 * Dropdown layout: Vertical reveal.
 * Quick, utility-focused.
 */
export const RVN_DROPDOWN_LAYOUT: LayoutPreset = {
  enterFrom: {
    opacity: 0,
    translateY: -10,
    scaleY: 0.95,
  },
  leaveTo: {
    opacity: 0,
    translateY: -5,
    scaleY: 0.98,
  },
  ease: SPRING_STIFF,
}

/**
 * Card layout: Subtle lift effect.
 * For card grids and masonry layouts.
 */
export const RVN_CARD_LAYOUT: LayoutPreset = {
  enterFrom: {
    opacity: 0,
    scale: 0.95,
    translateY: 10,
  },
  leaveTo: {
    opacity: 0,
    scale: 0.98,
  },
  ease: SPRING_SNAPPY,
}

/**
 * Tooltip layout: Quick fade + translate.
 * For tooltips and popovers.
 */
export const RVN_TOOLTIP_LAYOUT: LayoutPreset = {
  enterFrom: {
    opacity: 0,
    scale: 0.95,
    translateY: 5,
  },
  leaveTo: {
    opacity: 0,
    scale: 0.95,
    translateY: 5,
  },
  ease: 'easeOutQuad',
  duration: 150,
}

// =============================================================================
// AGGREGATED EXPORT
// =============================================================================

/**
 * All RVN layout presets.
 */
export const RVN_LAYOUTS = {
  accordion: RVN_ACCORDION_LAYOUT,
  nav: RVN_NAV_LAYOUT,
  grid: RVN_GRID_LAYOUT,
  list: RVN_LIST_LAYOUT,
  tab: RVN_TAB_LAYOUT,
  modal: RVN_MODAL_LAYOUT,
  drawer: RVN_DRAWER_LAYOUT,
  dropdown: RVN_DROPDOWN_LAYOUT,
  card: RVN_CARD_LAYOUT,
  tooltip: RVN_TOOLTIP_LAYOUT,
} as const

export type RvnLayout = keyof typeof RVN_LAYOUTS

/**
 * All RVN spring configurations.
 */
export const RVN_SPRINGS = {
  snappy: SPRING_SNAPPY,
  bouncy: SPRING_BOUNCY,
  stiff: SPRING_STIFF,
  smooth: SPRING_SMOOTH,
  dramatic: SPRING_DRAMATIC,
} as const

export type RvnSpring = keyof typeof RVN_SPRINGS
