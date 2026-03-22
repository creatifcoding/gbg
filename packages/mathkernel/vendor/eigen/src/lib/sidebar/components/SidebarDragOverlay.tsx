/**
 * SidebarDragOverlay
 *
 * Visual feedback during Ctrl+drag reordering of plugin items.
 * Shows drop indicator line at target position.
 *
 * @module sidebar/components
 */

import { memo } from "react"
import { createPortal } from "react-dom"

import type { DragState } from "../hooks/useSidebarDrag"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SidebarDragOverlayProps {
  /** Current drag state */
  dragState: DragState
  /** Container ref for positioning */
  containerRef?: React.RefObject<HTMLElement>
  /** Item height for calculating indicator position */
  itemHeight?: number
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const DEFAULT_ITEM_HEIGHT = 40 // px

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * Overlay that shows drop indicator during drag operations.
 *
 * Renders:
 * - Horizontal line at drop position
 * - Subtle background tint for drag zone
 */
export const SidebarDragOverlay = memo(function SidebarDragOverlay({
  dragState,
  containerRef,
  itemHeight = DEFAULT_ITEM_HEIGHT,
}: SidebarDragOverlayProps) {
  if (!dragState.isDragging || dragState.dropIndex === null) {
    return null
  }

  // Calculate indicator position
  const indicatorY = dragState.dropIndex * itemHeight

  const overlay = (
    <div
      className="pointer-events-none fixed inset-0 z-50"
      aria-hidden="true"
    >
      {/* Drop indicator line */}
      <div
        className="
          absolute left-2 right-2
          h-0.5 bg-tmnl-accent
          rounded-full
          shadow-[0_0_8px_rgba(var(--tmnl-accent-rgb),0.5)]
          transition-transform duration-75 ease-out
        "
        style={{
          top: containerRef?.current
            ? containerRef.current.getBoundingClientRect().top + indicatorY
            : indicatorY,
          transform: "translateY(-50%)",
        }}
      />

      {/* Drag zone tint (optional, subtle) */}
      <div
        className="
          absolute left-0 w-12
          bg-tmnl-accent/5
          transition-opacity duration-150
        "
        style={{
          top: containerRef?.current?.getBoundingClientRect().top ?? 0,
          height: containerRef?.current?.getBoundingClientRect().height ?? "100%",
        }}
      />
    </div>
  )

  return createPortal(overlay, document.body)
})

// ─────────────────────────────────────────────────────────────
// Drop Indicator (inline version)
// ─────────────────────────────────────────────────────────────

export interface DropIndicatorProps {
  /** Whether to show the indicator */
  isVisible: boolean
  /** Position: "before" or "after" the current item */
  position: "before" | "after"
}

/**
 * Inline drop indicator for use within item list.
 * Simpler alternative to portal-based overlay.
 */
export const DropIndicator = memo(function DropIndicator({
  isVisible,
  position,
}: DropIndicatorProps) {
  if (!isVisible) return null

  return (
    <div
      className={`
        absolute left-2 right-2 h-0.5
        bg-tmnl-accent rounded-full
        shadow-[0_0_6px_rgba(var(--tmnl-accent-rgb),0.4)]
        pointer-events-none
        ${position === "before" ? "-top-0.5" : "-bottom-0.5"}
      `}
      aria-hidden="true"
    />
  )
})
