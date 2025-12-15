/**
 * Drawer Renderer Types
 *
 * Shared types for the directional drawer renderer system.
 *
 * @module
 */

import type { Transition, Variants } from "framer-motion"
import type { CSSProperties, ReactNode } from "react"
import type { VisualOverlayId, DrawerConfig, OverlaySide } from "../../../schemas/visual"

// ─────────────────────────────────────────────────────────────
// Base Props
// ─────────────────────────────────────────────────────────────

export interface DrawerRendererProps {
  /** Overlay ID */
  id: VisualOverlayId
  /** Callback when close requested (backdrop click, escape) */
  onCloseRequest?: () => void
}

// ─────────────────────────────────────────────────────────────
// Directional Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Directional drawer configuration.
 * Each side (left, right, top, bottom) provides its own:
 * - Animation variants (how it enters/exits)
 * - Container styles (positioning, sizing)
 * - Spring config (optional override)
 */
export interface DirectionalDrawerConfig {
  /** Framer-motion variants for enter/exit */
  variants: Variants
  /** Container positioning styles */
  containerStyles: (config: DrawerConfig) => CSSProperties
  /** Optional spring config override */
  springConfig?: Transition
}

/**
 * Registry of directional configs keyed by side.
 */
export type DirectionalConfigRegistry = Record<OverlaySide, DirectionalDrawerConfig>

// ─────────────────────────────────────────────────────────────
// Hook Return Type
// ─────────────────────────────────────────────────────────────

export interface UseDrawerRendererReturn {
  /** Should render anything? */
  shouldRender: boolean
  /** Drawer config (if available) */
  config: DrawerConfig | null
  /** Content to render */
  content: ReactNode
  /** Is visible (entering or visible state) */
  isVisible: boolean
  /** Handle animation complete */
  handleAnimationComplete: (definition: string) => void
  /** Handle backdrop click */
  handleBackdropClick: () => void
}
