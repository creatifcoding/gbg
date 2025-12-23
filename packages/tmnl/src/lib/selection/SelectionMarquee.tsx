/**
 * SelectionMarquee
 *
 * Unified marquee selection supporting both 2D DOM and 3D (R3F) contexts.
 * Extends SelectionOverlay with pluggable collision detection.
 *
 * 2D Mode: Uses DOM bounding box intersection (default)
 * 3D Mode: Uses custom collision detector (e.g., camera frustum projection)
 *
 * @example 2D Usage (DOM elements):
 * ```tsx
 * <SelectionMarquee
 *   containerRef={containerRef}
 *   onSelectionComplete={(ids) => console.log('Selected:', ids)}
 * />
 * ```
 *
 * @example 3D Usage (R3F scene):
 * ```tsx
 * <SelectionMarquee
 *   containerRef={canvasRef}
 *   mode="3d"
 *   collisionDetector={(rect) => getEntitiesInFrustum(camera, rect, entities)}
 *   onSelectionComplete={(ids) => selectEntities(ids)}
 * />
 * ```
 *
 * @module
 */

import { useEffect, useCallback, useRef, type RefObject } from "react"
import { useSelector } from "@legendapp/state/react"
import { COLORS } from "@/lib/capabilities/tokens"
import {
  selectionState$,
  startMarquee,
  updateMarquee,
  endMarquee,
  cancelMarquee,
  deselectAll,
  selectAll,
  selectItem,
  updateModifiers,
  getSelectedIds,
  subscribeToSelection,
} from "./selection-stx"
import type { Position, Rect } from "./types"

// =============================================================================
// Types
// =============================================================================

export type SelectionMode = "2d" | "3d"

/**
 * Collision detector function signature.
 * Receives marquee rect (container-relative) and returns IDs of items inside.
 */
export type CollisionDetector = (
  rect: Rect,
  container: HTMLElement
) => string[]

/**
 * Modifier key that must be held to activate marquee selection.
 * - 'shift': Shift key (common for selection)
 * - 'alt': Alt/Option key
 * - 'ctrl': Ctrl/Cmd key
 * - 'none': No modifier required (marquee always active)
 */
export type ActivationModifier = "shift" | "alt" | "ctrl" | "none"

export interface SelectionMarqueeProps {
  /** Container element ref - marquee is relative to this */
  containerRef: RefObject<HTMLElement>

  /** Selection mode: '2d' for DOM elements, '3d' for custom collision */
  mode?: SelectionMode

  /**
   * Modifier key required to activate marquee selection.
   * Default: 'none' for 2D mode, 'alt' for 3D mode.
   * Alt is used for 3D because Shift=pan and Ctrl=zoom in OrbitControls.
   */
  activationModifier?: ActivationModifier

  /**
   * Custom collision detector for 3D mode.
   * Required when mode='3d'.
   * Receives marquee rect and returns entity IDs inside the selection.
   */
  collisionDetector?: CollisionDetector

  /** CSS selector for selectable items in 2D mode */
  selectableSelector?: string

  /** Callback when marquee selection completes */
  onSelectionComplete?: (ids: string[]) => void

  /** Callback when selection changes (any change, including clicks) */
  onSelectionChange?: (selectedIds: Set<string>) => void

  /** Callback when delete is triggered */
  onDelete?: (selectedIds: string[]) => void

  /** Minimum drag distance before marquee activates */
  activationDistance?: number

  /** Selection color theme */
  selectionColor?: "cyan" | "purple" | "green" | "amber"

  /** Disable selection */
  disabled?: boolean
}

// =============================================================================
// Default 2D Collision Detection
// =============================================================================

function rectsIntersect(a: Rect, b: DOMRect): boolean {
  return !(
    a.x + a.width < b.left ||
    a.x > b.right ||
    a.y + a.height < b.top ||
    a.y > b.bottom
  )
}

function create2DCollisionDetector(selector: string): CollisionDetector {
  return (rect: Rect, container: HTMLElement): string[] => {
    const items = container.querySelectorAll(selector)
    const containerRect = container.getBoundingClientRect()
    const result: string[] = []

    // Convert marquee rect to viewport coordinates
    const viewportRect: Rect = {
      x: rect.x + containerRect.left,
      y: rect.y + containerRect.top,
      width: rect.width,
      height: rect.height,
    }

    items.forEach((item) => {
      const id = item.getAttribute("data-selectable-id")
      if (!id) return

      const itemRect = item.getBoundingClientRect()
      if (rectsIntersect(viewportRect, itemRect)) {
        result.push(id)
      }
    })

    return result
  }
}

function getAllSelectableIds(container: HTMLElement, selector: string): string[] {
  const items = container.querySelectorAll(selector)
  const result: string[] = []
  items.forEach((item) => {
    const id = item.getAttribute("data-selectable-id")
    if (id) result.push(id)
  })
  return result
}

// =============================================================================
// Component
// =============================================================================

/**
 * Check if the required activation modifier is pressed.
 */
function isModifierActive(e: PointerEvent | MouseEvent, modifier: ActivationModifier): boolean {
  switch (modifier) {
    case "shift":
      return e.shiftKey
    case "alt":
      return e.altKey
    case "ctrl":
      return e.ctrlKey || e.metaKey
    case "none":
      return true
  }
}

export function SelectionMarquee({
  containerRef,
  mode = "2d",
  activationModifier,
  collisionDetector: customCollisionDetector,
  selectableSelector = "[data-selectable]",
  onSelectionComplete,
  onSelectionChange,
  onDelete,
  activationDistance = 5,
  selectionColor = "cyan",
  disabled = false,
}: SelectionMarqueeProps) {
  // Default activation modifier: none for 2D, alt for 3D
  // Alt doesn't conflict with OrbitControls (Shift=pan, Ctrl=zoom)
  const effectiveModifier = activationModifier ?? (mode === "3d" ? "alt" : "none")

  // Determine collision detector based on mode
  const collisionDetector =
    mode === "3d" && customCollisionDetector
      ? customCollisionDetector
      : create2DCollisionDetector(selectableSelector)

  // State subscriptions
  const marqueeRect = useSelector(selectionState$.marqueeRect)
  const isSelecting = useSelector(selectionState$.isSelecting)

  // Refs for drag tracking
  const isDragging = useRef(false)
  const dragStart = useRef<Position | null>(null)
  const hasActivated = useRef(false)

  // Subscribe to selection changes
  useEffect(() => {
    if (!onSelectionChange) return
    return subscribeToSelection(onSelectionChange)
  }, [onSelectionChange])

  // =============================================================================
  // Pointer Handlers
  // =============================================================================

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (disabled) return
      const container = containerRef.current
      if (!container) return

      // Only start marquee on left click
      if (e.button !== 0) return

      // Only start marquee if activation modifier is held (or 'none' mode)
      if (!isModifierActive(e, effectiveModifier)) return

      const target = e.target as HTMLElement

      // In 2D mode, don't start marquee if clicking on a selectable item
      if (mode === "2d") {
        const selectableItem = target.closest(selectableSelector)
        if (selectableItem) {
          if (e.shiftKey) e.preventDefault()
          const id = selectableItem.getAttribute("data-selectable-id")
          if (id) {
            const selMode = e.shiftKey ? "add" : e.ctrlKey || e.metaKey ? "toggle" : "replace"
            selectItem(id, selMode)
          }
          return
        }
      }

      // Don't start if clicking interactive elements
      if (target.closest("button, input, textarea, select, a, [role=\"button\"]")) {
        return
      }

      const containerRect = container.getBoundingClientRect()
      const position: Position = {
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top,
      }

      isDragging.current = true
      dragStart.current = position
      hasActivated.current = false

      container.setPointerCapture(e.pointerId)
    },
    [containerRef, disabled, effectiveModifier, mode, selectableSelector]
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging.current || !dragStart.current) return
      const container = containerRef.current
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const position: Position = {
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top,
      }

      // Check activation distance
      if (!hasActivated.current) {
        const distance = Math.sqrt(
          (position.x - dragStart.current.x) ** 2 +
            (position.y - dragStart.current.y) ** 2
        )
        if (distance < activationDistance) return

        hasActivated.current = true
        startMarquee(dragStart.current, e.shiftKey ? "add" : "replace")
      }

      updateMarquee(position)
    },
    [containerRef, activationDistance]
  )

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      const container = containerRef.current
      if (!container) return

      container.releasePointerCapture(e.pointerId)

      if (!isDragging.current) return
      isDragging.current = false

      if (!hasActivated.current) {
        // Click without drag - deselect all if not clicking an item
        const target = e.target as HTMLElement
        if (mode === "2d" && !target.closest(selectableSelector)) {
          deselectAll()
        } else if (mode === "3d") {
          // In 3D mode, clicking empty space deselects
          deselectAll()
        }
        dragStart.current = null
        return
      }

      // Get items in marquee rect using appropriate collision detector
      const rect = selectionState$.marqueeRect.get()
      if (rect && rect.width > 0 && rect.height > 0) {
        const itemsInRect = collisionDetector(rect, container)
        endMarquee(itemsInRect)

        // Notify completion callback
        if (onSelectionComplete) {
          onSelectionComplete(itemsInRect)
        }
      } else {
        cancelMarquee()
      }

      dragStart.current = null
      hasActivated.current = false
    },
    [containerRef, mode, selectableSelector, collisionDetector, onSelectionComplete]
  )

  // =============================================================================
  // Keyboard Handlers
  // =============================================================================

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return

      const target = e.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return
      }

      updateModifiers({
        shift: e.shiftKey,
        ctrl: e.ctrlKey || e.metaKey,
        alt: e.altKey,
      })

      const container = containerRef.current
      const key = e.key.toLowerCase()

      // Escape - deselect/cancel
      if (key === "escape") {
        e.preventDefault()
        if (isSelecting) {
          cancelMarquee()
        } else {
          deselectAll()
        }
        return
      }

      // Ctrl+A - select all (2D mode only, 3D needs custom handling)
      if ((e.ctrlKey || e.metaKey) && key === "a" && container && mode === "2d") {
        e.preventDefault()
        const allIds = getAllSelectableIds(container, selectableSelector)
        selectAll(allIds)
        return
      }

      // Delete/Backspace
      if ((key === "delete" || key === "backspace") && onDelete) {
        e.preventDefault()
        const selectedIds = getSelectedIds()
        if (selectedIds.size > 0) {
          onDelete(Array.from(selectedIds))
          deselectAll()
        }
        return
      }
    },
    [disabled, containerRef, selectableSelector, isSelecting, mode, onDelete]
  )

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    updateModifiers({
      shift: e.shiftKey,
      ctrl: e.ctrlKey || e.metaKey,
      alt: e.altKey,
    })
  }, [])

  // =============================================================================
  // Event Binding
  // =============================================================================

  useEffect(() => {
    const container = containerRef.current
    if (!container || disabled) return

    container.addEventListener("pointerdown", handlePointerDown)
    container.addEventListener("pointermove", handlePointerMove)
    container.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      container.removeEventListener("pointerdown", handlePointerDown)
      container.removeEventListener("pointermove", handlePointerMove)
      container.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [
    containerRef,
    disabled,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown,
    handleKeyUp,
  ])

  // =============================================================================
  // Render
  // =============================================================================

  if (!isSelecting || !marqueeRect) return null

  const color = COLORS.accent[selectionColor as keyof typeof COLORS.accent]
  const containerRect = containerRef.current?.getBoundingClientRect()
  const offsetX = containerRect?.left ?? 0
  const offsetY = containerRect?.top ?? 0

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9999]"
      style={{ isolation: "isolate" }}
    >
      {/* Marquee rectangle */}
      <div
        className="absolute"
        style={{
          left: marqueeRect.x + offsetX,
          top: marqueeRect.y + offsetY,
          width: marqueeRect.width,
          height: marqueeRect.height,
          backgroundColor: color.muted,
          border: `1px solid ${color.border}`,
          boxShadow: `0 0 8px ${color.glow}`,
        }}
      />
      {/* Corner markers */}
      <MarqueeCorner
        x={marqueeRect.x + offsetX}
        y={marqueeRect.y + offsetY}
        color={color.solid}
        corner="tl"
      />
      <MarqueeCorner
        x={marqueeRect.x + marqueeRect.width + offsetX}
        y={marqueeRect.y + offsetY}
        color={color.solid}
        corner="tr"
      />
      <MarqueeCorner
        x={marqueeRect.x + offsetX}
        y={marqueeRect.y + marqueeRect.height + offsetY}
        color={color.solid}
        corner="bl"
      />
      <MarqueeCorner
        x={marqueeRect.x + marqueeRect.width + offsetX}
        y={marqueeRect.y + marqueeRect.height + offsetY}
        color={color.solid}
        corner="br"
      />
    </div>
  )
}

// =============================================================================
// Marquee Corner (TMNL aesthetic)
// =============================================================================

function MarqueeCorner({
  x,
  y,
  color,
  corner,
}: {
  x: number
  y: number
  color: string
  corner: "tl" | "tr" | "bl" | "br"
}) {
  const size = 6
  const offset = corner.includes("l") ? -1 : -size + 1
  const offsetY = corner.includes("t") ? -1 : -size + 1

  return (
    <div
      className="absolute"
      style={{
        left: x + offset,
        top: y + offsetY,
        width: size,
        height: size,
        borderTop: corner.includes("t") ? `2px solid ${color}` : "none",
        borderBottom: corner.includes("b") ? `2px solid ${color}` : "none",
        borderLeft: corner.includes("l") ? `2px solid ${color}` : "none",
        borderRight: corner.includes("r") ? `2px solid ${color}` : "none",
      }}
    />
  )
}

export default SelectionMarquee
