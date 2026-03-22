/**
 * useSidebarDrag
 *
 * Hook for Ctrl+drag reordering of plugin sidebar items.
 *
 * @module sidebar/hooks
 */

import { useState, useCallback, useRef, useEffect } from "react"
import { useAtomValue } from "@effect-atom/atom-react"

import type { SidebarItemId, SidebarItemConfig } from "../schemas"
import {
  pluginItemsAtom,
  movePlugin,
} from "../atoms"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DragState {
  /** Whether drag is active */
  isDragging: boolean
  /** ID of item being dragged */
  draggedId: SidebarItemId | null
  /** Current drop target index */
  dropIndex: number | null
  /** Drag start position */
  startY: number
  /** Current drag position */
  currentY: number
}

export interface UseSidebarDragReturn {
  /** Current drag state */
  dragState: DragState
  /** Whether Ctrl key is held */
  isCtrlHeld: boolean
  /** Start dragging an item */
  startDrag: (id: SidebarItemId, startY: number) => void
  /** Update drag position */
  updateDrag: (currentY: number) => void
  /** End drag and commit reorder */
  endDrag: () => void
  /** Cancel drag without committing */
  cancelDrag: () => void
  /** Get props for a draggable item */
  getDragProps: (item: SidebarItemConfig) => DragItemProps
}

export interface DragItemProps {
  onPointerDown: (e: React.PointerEvent) => void
  "data-dragging": boolean
  "data-drop-target": boolean
  style: React.CSSProperties
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 40 // px - matches SidebarItem height
const DRAG_THRESHOLD = 5 // px - minimum movement to start drag

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

/**
 * Hook for managing Ctrl+drag reordering of plugin items.
 *
 * @example
 * ```tsx
 * function PluginSection() {
 *   const { dragState, isCtrlHeld, getDragProps } = useSidebarDrag()
 *   const plugins = useAtomValue(pluginItemsAtom)
 *
 *   return (
 *     <div>
 *       {plugins.map((item, index) => (
 *         <SidebarItem
 *           key={item.id}
 *           item={item}
 *           {...getDragProps(item)}
 *         />
 *       ))}
 *       {dragState.isDragging && <SidebarDragOverlay {...dragState} />}
 *     </div>
 *   )
 * }
 * ```
 */
export function useSidebarDrag(): UseSidebarDragReturn {
  // Plugin items for calculating drop index (registry via OverlayRegistryProvider)
  const plugins = useAtomValue(pluginItemsAtom)

  // Ctrl key state
  const [isCtrlHeld, setIsCtrlHeld] = useState(false)

  // Drag state
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedId: null,
    dropIndex: null,
    startY: 0,
    currentY: 0,
  })

  // Refs for drag tracking
  const pendingDragRef = useRef<{
    id: SidebarItemId
    startY: number
    triggered: boolean
  } | null>(null)

  // Ctrl key tracking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control") setIsCtrlHeld(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") {
        setIsCtrlHeld(false)
        // Cancel any active drag when Ctrl is released
        if (dragState.isDragging) {
          cancelDrag()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [dragState.isDragging])

  // Start drag
  const startDrag = useCallback((id: SidebarItemId, startY: number) => {
    pendingDragRef.current = { id, startY, triggered: false }
  }, [])

  // Update drag position
  const updateDrag = useCallback(
    (currentY: number) => {
      // Check for pending drag that hasn't triggered yet
      if (pendingDragRef.current && !pendingDragRef.current.triggered) {
        const delta = Math.abs(currentY - pendingDragRef.current.startY)
        if (delta >= DRAG_THRESHOLD) {
          // Trigger drag
          pendingDragRef.current.triggered = true
          setDragState({
            isDragging: true,
            draggedId: pendingDragRef.current.id,
            dropIndex: null,
            startY: pendingDragRef.current.startY,
            currentY,
          })
        }
        return
      }

      // Update active drag
      if (dragState.isDragging && dragState.draggedId) {
        // Calculate drop index based on Y position
        const draggedIndex = plugins.findIndex((p) => p.id === dragState.draggedId)
        if (draggedIndex === -1) return

        const deltaY = currentY - dragState.startY
        const indexDelta = Math.round(deltaY / ITEM_HEIGHT)
        const newIndex = Math.max(
          0,
          Math.min(plugins.length - 1, draggedIndex + indexDelta)
        )

        setDragState((prev) => ({
          ...prev,
          currentY,
          dropIndex: newIndex !== draggedIndex ? newIndex : null,
        }))
      }
    },
    [dragState.isDragging, dragState.draggedId, dragState.startY, plugins]
  )

  // End drag and commit
  const endDrag = useCallback(() => {
    if (dragState.isDragging && dragState.draggedId && dragState.dropIndex !== null) {
      movePlugin(dragState.draggedId, dragState.dropIndex)
    }

    pendingDragRef.current = null
    setDragState({
      isDragging: false,
      draggedId: null,
      dropIndex: null,
      startY: 0,
      currentY: 0,
    })
  }, [dragState])

  // Cancel drag
  const cancelDrag = useCallback(() => {
    pendingDragRef.current = null
    setDragState({
      isDragging: false,
      draggedId: null,
      dropIndex: null,
      startY: 0,
      currentY: 0,
    })
  }, [])

  // Get drag props for an item
  const getDragProps = useCallback(
    (item: SidebarItemConfig): DragItemProps => {
      const isPluginItem = item.group === "plugin"
      const isDragging = dragState.draggedId === item.id
      const itemIndex = plugins.findIndex((p) => p.id === item.id)
      const isDropTarget = dragState.dropIndex === itemIndex && !isDragging

      return {
        onPointerDown: (e: React.PointerEvent) => {
          if (!isCtrlHeld || !isPluginItem) return
          e.preventDefault()
          startDrag(item.id, e.clientY)

          // Set up pointer capture for drag tracking
          const target = e.currentTarget as HTMLElement
          target.setPointerCapture(e.pointerId)

          const handleMove = (moveEvent: PointerEvent) => {
            updateDrag(moveEvent.clientY)
          }

          const handleUp = () => {
            target.releasePointerCapture(e.pointerId)
            target.removeEventListener("pointermove", handleMove)
            target.removeEventListener("pointerup", handleUp)
            target.removeEventListener("pointercancel", handleUp)
            endDrag()
          }

          target.addEventListener("pointermove", handleMove)
          target.addEventListener("pointerup", handleUp)
          target.addEventListener("pointercancel", handleUp)
        },
        "data-dragging": isDragging,
        "data-drop-target": isDropTarget,
        style: {
          cursor: isCtrlHeld && isPluginItem ? "grab" : undefined,
          opacity: isDragging ? 0.5 : 1,
          transform: isDragging
            ? `translateY(${dragState.currentY - dragState.startY}px)`
            : undefined,
          transition: isDragging ? "none" : "transform 150ms ease-out",
        },
      }
    },
    [isCtrlHeld, dragState, plugins, startDrag, updateDrag, endDrag]
  )

  return {
    dragState,
    isCtrlHeld,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    getDragProps,
  }
}
