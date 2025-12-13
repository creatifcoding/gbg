/**
 * Drawer System Types
 *
 * Type definitions for the stacking drawer system with rolodex animation.
 *
 * @module
 */

import type { ReactNode } from 'react'

// =============================================================================
// DRAWER CONFIGURATION
// =============================================================================

/**
 * Drawer positioning side.
 */
export type DrawerSide = 'left' | 'right' | 'bottom' | 'top'

/**
 * Animation state for a drawer instance.
 */
export type DrawerAnimationState = 'entering' | 'visible' | 'exiting' | 'exited'

/**
 * Slot type for drawer targeting.
 * - 'global': Full viewport overlay
 * - string: Panel ID for panel-scoped drawer
 */
export type DrawerSlotType = 'global' | string

/**
 * Configuration for opening a drawer.
 */
export interface DrawerConfig {
  /** Unique drawer identifier */
  id: string
  /** Target slot ('global' or panelId) */
  slot: DrawerSlotType
  /** Drawer content */
  content: ReactNode
  /** Positioning side (default: 'right') */
  side?: DrawerSide
  /** Width for left/right drawers (default: 400) */
  width?: number | string
  /** Height for top/bottom drawers (default: '50%') */
  height?: number | string
  /** Show backdrop overlay (default: true) */
  showBackdrop?: boolean
  /** Close on backdrop click (default: true) */
  closeOnOverlayClick?: boolean
  /** Close on Escape key (default: true) */
  closeOnEscape?: boolean
  /** Custom z-index offset */
  zIndexOffset?: number
  /** Callback when drawer opens */
  onOpen?: () => void
  /** Callback when drawer closes */
  onClose?: () => void
  /** Callback when drawer finishes enter animation */
  onEntered?: () => void
  /** Callback when drawer finishes exit animation */
  onExited?: () => void
}

// =============================================================================
// DRAWER INSTANCE
// =============================================================================

/**
 * Runtime drawer instance with state.
 */
export interface DrawerInstance extends DrawerConfig {
  /** Computed z-index */
  zIndex: number
  /** Current animation state */
  animationState: DrawerAnimationState
  /** Timestamp when drawer was opened */
  openedAt: number
}

// =============================================================================
// DRAWER STACK STATE
// =============================================================================

/**
 * Complete drawer stack state.
 */
export interface DrawerStackState {
  /** All active drawer instances */
  drawers: DrawerInstance[]
  /** Z-order (last = top) */
  zOrder: string[]
  /** Currently transitioning drawer ID (prevents rapid push/pop) */
  transitioning: string | null
}

// =============================================================================
// SLOT REGISTRATION
// =============================================================================

/**
 * Registered drawer slot for portal targeting.
 */
export interface DrawerSlot {
  /** Slot identifier ('global' or panelId) */
  id: DrawerSlotType
  /** Portal container ref */
  containerRef: React.RefObject<HTMLDivElement>
  /** Slot bounds for panel-scoped drawers */
  bounds?: DOMRect
}

// =============================================================================
// ANIMATION CONFIG
// =============================================================================

/**
 * Rolodex animation configuration.
 */
export interface RolodexConfig {
  /** Total transition duration (ms) */
  duration: number
  /** Isometric lift distance (px) */
  liftDistance: number
  /** Card tilt angle (degrees) */
  rotateX: number
  /** Peak blur amount (px) */
  blurMax: number
  /** Hairline strobe duration (ms) */
  strobeDuration: number
  /** Border strobe color */
  strobeColor: string
}

/**
 * Parallax stack configuration.
 */
export interface ParallaxConfig {
  /** Lift per layer (px) */
  liftPerLayer: number
  /** Rotation per layer (degrees) */
  rotatePerLayer: number
  /** Blur per layer (px) */
  blurPerLayer: number
  /** Opacity decay per layer */
  opacityDecay: number
  /** Animation duration (ms) */
  duration: number
}

// =============================================================================
// DEFAULTS
// =============================================================================

export const DEFAULT_ROLODEX_CONFIG: RolodexConfig = {
  duration: 400,
  liftDistance: 80,
  rotateX: -15,
  blurMax: 4,
  strobeDuration: 100,
  strobeColor: 'var(--tmnl-cyan, #00d4aa)',
}

export const DEFAULT_PARALLAX_CONFIG: ParallaxConfig = {
  liftPerLayer: 40,
  rotatePerLayer: 5,
  blurPerLayer: 0.5,
  opacityDecay: 0.1,
  duration: 300,
}

export const DEFAULT_DRAWER_CONFIG: Partial<DrawerConfig> = {
  side: 'right',
  width: 400,
  height: '50%',
  showBackdrop: true,
  closeOnOverlayClick: true,
  closeOnEscape: true,
}

// =============================================================================
// INITIAL STATE
// =============================================================================

export const initialDrawerStackState: DrawerStackState = {
  drawers: [],
  zOrder: [],
  transitioning: null,
}
