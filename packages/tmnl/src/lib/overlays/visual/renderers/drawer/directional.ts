/**
 * Directional Drawer Configurations
 *
 * Animation variants and positioning styles for each drawer direction.
 * Each direction is an extension of the base drawer behavior.
 *
 * Directions:
 * - left: Slides in from left edge (beside sidebar)
 * - right: Slides in from right viewport edge
 * - top: Slides down from header
 * - bottom: Slides up from bottom (minibuffer!)
 *
 * @module
 */

import type { CSSProperties } from "react"
import type { Variants, Transition } from "framer-motion"
import type { DrawerConfig, OverlaySide } from "../../../schemas/visual"
import type { DirectionalDrawerConfig, DirectionalConfigRegistry } from "./types"

// ─────────────────────────────────────────────────────────────
// Shared Constants
// ─────────────────────────────────────────────────────────────

export const SPRING_CONFIG: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 40,
}

const BASE_STYLES: CSSProperties = {
  position: "absolute",
  backgroundColor: "#000",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  pointerEvents: "auto",
}

// ─────────────────────────────────────────────────────────────
// LEFT Drawer (slides from left, beside sidebar)
// ─────────────────────────────────────────────────────────────

const leftVariants: Variants = {
  hidden: { x: "-100%" },
  visible: { x: 0 },
}

const leftContainerStyles = (config: DrawerConfig): CSSProperties => ({
  ...BASE_STYLES,
  top: "var(--tmnl-size-header, 48px)",
  bottom: 0,
  left: "var(--tmnl-size-sidebar, 48px)",
  width: typeof config.width === "number" ? `${config.width}px` : config.width,
  borderRight: "var(--tmnl-border-chrome)",
})

export const leftConfig: DirectionalDrawerConfig = {
  variants: leftVariants,
  containerStyles: leftContainerStyles,
}

// ─────────────────────────────────────────────────────────────
// RIGHT Drawer (slides from right viewport edge)
// ─────────────────────────────────────────────────────────────

const rightVariants: Variants = {
  hidden: { x: "100%" },
  visible: { x: 0 },
}

const rightContainerStyles = (config: DrawerConfig): CSSProperties => ({
  ...BASE_STYLES,
  top: "var(--tmnl-size-header, 48px)",
  bottom: 0,
  right: 0,
  width: typeof config.width === "number" ? `${config.width}px` : config.width,
  borderLeft: "var(--tmnl-border-chrome)",
})

export const rightConfig: DirectionalDrawerConfig = {
  variants: rightVariants,
  containerStyles: rightContainerStyles,
}

// ─────────────────────────────────────────────────────────────
// TOP Drawer (slides down from header)
// ─────────────────────────────────────────────────────────────

const topVariants: Variants = {
  hidden: { y: "-100%" },
  visible: { y: 0 },
}

const topContainerStyles = (config: DrawerConfig): CSSProperties => ({
  ...BASE_STYLES,
  top: "var(--tmnl-size-header, 48px)",
  left: "var(--tmnl-size-sidebar, 48px)",
  right: 0,
  height: typeof config.height === "number" ? `${config.height}px` : config.height,
  borderBottom: "var(--tmnl-border-chrome)",
})

export const topConfig: DirectionalDrawerConfig = {
  variants: topVariants,
  containerStyles: topContainerStyles,
}

// ─────────────────────────────────────────────────────────────
// BOTTOM Drawer (slides up from bottom - MINIBUFFER)
// ─────────────────────────────────────────────────────────────

const bottomVariants: Variants = {
  hidden: { y: "100%" },
  visible: { y: 0 },
}

const bottomContainerStyles = (config: DrawerConfig): CSSProperties => ({
  ...BASE_STYLES,
  bottom: 0,
  left: "var(--tmnl-size-sidebar, 48px)",
  right: 0,
  height: typeof config.height === "number" ? `${config.height}px` : config.height,
  borderTop: "var(--tmnl-border-chrome)",
})

export const bottomConfig: DirectionalDrawerConfig = {
  variants: bottomVariants,
  containerStyles: bottomContainerStyles,
}

// ─────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────

export const directionalConfigs: DirectionalConfigRegistry = {
  left: leftConfig,
  right: rightConfig,
  top: topConfig,
  bottom: bottomConfig,
}

/**
 * Get directional config for a given side.
 * Defaults to "right" if side is undefined.
 */
export function getDirectionalConfig(side?: OverlaySide): DirectionalDrawerConfig {
  return directionalConfigs[side ?? "right"]
}
