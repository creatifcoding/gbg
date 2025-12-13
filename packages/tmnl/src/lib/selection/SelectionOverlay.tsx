/**
 * SelectionOverlay
 *
 * Marquee selection overlay with hotkey support.
 * Renders selection rectangle during drag and handles collision detection.
 *
 * Usage:
 * ```tsx
 * <SelectionOverlay
 *   containerRef={containerRef}
 *   selectableSelector="[data-selectable]"
 *   onSelectionChange={(ids) => console.log('Selected:', ids)}
 * />
 * ```
 *
 * @module
 */

import { useEffect, useCallback, useRef, useState, type RefObject } from 'react'
import { useSelector } from '@legendapp/state/react'
import { COLORS } from '@/lib/capabilities/tokens'
import {
  selectionState$,
  startMarquee,
  updateMarquee,
  endMarquee,
  cancelMarquee,
  deselectAll,
  selectAll,
  selectItem,
  groupSelected,
  ungroupSelected,
  updateModifiers,
  getSelectedIds,
  subscribeToSelection,
} from './selection-stx'
import type { Position, Rect, SelectionConfig } from './types'

// =============================================================================
// Props
// =============================================================================

export interface SelectionOverlayProps {
  /** Container element ref - marquee is relative to this */
  containerRef: RefObject<HTMLElement>
  /** CSS selector for selectable items (must have data-selectable-id attribute) */
  selectableSelector?: string
  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: Set<string>) => void
  /** Callback when group is created */
  onGroup?: (groupId: string, memberIds: string[]) => void
  /** Callback when items are ungrouped */
  onUngroup?: (itemIds: string[]) => void
  /** Callback when delete is triggered */
  onDelete?: (selectedIds: string[]) => void
  /** Configuration */
  config?: SelectionConfig
  /** Disable selection */
  disabled?: boolean
}

// =============================================================================
// Defaults
// =============================================================================

const DEFAULT_CONFIG: Required<SelectionConfig> = {
  activationDistance: 5,
  selectionColor: 'cyan',
  enableGrouping: true,
  hotkeys: {
    selectAll: 'ctrl+a',
    deselectAll: 'Escape',
    group: 'shift+g',
    ungroup: 'shift+u',
    delete: 'Delete',
  },
}

// =============================================================================
// Collision Detection
// =============================================================================

function rectsIntersect(a: Rect, b: DOMRect): boolean {
  return !(
    a.x + a.width < b.left ||
    a.x > b.right ||
    a.y + a.height < b.top ||
    a.y > b.bottom
  )
}

function getItemsInRect(
  container: HTMLElement,
  rect: Rect,
  selector: string
): string[] {
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
    const id = item.getAttribute('data-selectable-id')
    if (!id) return

    const itemRect = item.getBoundingClientRect()
    if (rectsIntersect(viewportRect, itemRect)) {
      result.push(id)
    }
  })

  return result
}

function getAllSelectableIds(container: HTMLElement, selector: string): string[] {
  const items = container.querySelectorAll(selector)
  const result: string[] = []
  items.forEach((item) => {
    const id = item.getAttribute('data-selectable-id')
    if (id) result.push(id)
  })
  return result
}

// =============================================================================
// Component
// =============================================================================

export function SelectionOverlay({
  containerRef,
  selectableSelector = '[data-selectable]',
  onSelectionChange,
  onGroup,
  onUngroup,
  onDelete,
  config: userConfig,
  disabled = false,
}: SelectionOverlayProps) {
  const config = { ...DEFAULT_CONFIG, ...userConfig }

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

      // Only start marquee on left click on the container itself (not on selectables)
      if (e.button !== 0) return

      const target = e.target as HTMLElement

      // Don't start marquee if clicking on a selectable item
      const selectableItem = target.closest(selectableSelector)
      if (selectableItem) {
        // Handle item click
        const id = selectableItem.getAttribute('data-selectable-id')
        if (id) {
          const mode = e.shiftKey ? 'add' : e.ctrlKey || e.metaKey ? 'toggle' : 'replace'
          selectItem(id, mode)
        }
        return
      }

      // Don't start if clicking interactive elements
      if (target.closest('button, input, textarea, select, a, [role="button"]')) {
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

      // Capture pointer
      container.setPointerCapture(e.pointerId)
    },
    [containerRef, disabled, selectableSelector]
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
        if (distance < config.activationDistance) return

        hasActivated.current = true
        startMarquee(dragStart.current, e.shiftKey ? 'add' : 'replace')
      }

      updateMarquee(position)
    },
    [containerRef, config.activationDistance]
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
        if (!target.closest(selectableSelector)) {
          deselectAll()
        }
        dragStart.current = null
        return
      }

      // Get items in marquee rect
      const rect = selectionState$.marqueeRect.get()
      if (rect && rect.width > 0 && rect.height > 0) {
        const itemsInRect = getItemsInRect(container, rect, selectableSelector)
        endMarquee(itemsInRect)
      } else {
        cancelMarquee()
      }

      dragStart.current = null
      hasActivated.current = false
    },
    [containerRef, selectableSelector]
  )

  // =============================================================================
  // Keyboard Handlers
  // =============================================================================

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return

      // Ignore when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Update modifier state
      updateModifiers({
        shift: e.shiftKey,
        ctrl: e.ctrlKey || e.metaKey,
        alt: e.altKey,
      })

      const container = containerRef.current

      // Hotkey matching
      const key = e.key.toLowerCase()
      const { hotkeys } = config

      // Escape - deselect all
      if (key === 'escape') {
        e.preventDefault()
        if (isSelecting) {
          cancelMarquee()
        } else {
          deselectAll()
        }
        return
      }

      // Ctrl+A - select all
      if ((e.ctrlKey || e.metaKey) && key === 'a' && container) {
        e.preventDefault()
        const allIds = getAllSelectableIds(container, selectableSelector)
        selectAll(allIds)
        return
      }

      // Shift+G - group selected
      if (e.shiftKey && key === 'g' && config.enableGrouping) {
        e.preventDefault()
        const groupId = groupSelected()
        if (groupId && onGroup) {
          const selectedIds = getSelectedIds()
          onGroup(groupId, Array.from(selectedIds))
        }
        return
      }

      // Shift+U - ungroup selected
      if (e.shiftKey && key === 'u' && config.enableGrouping) {
        e.preventDefault()
        const selectedIds = getSelectedIds()
        ungroupSelected()
        if (onUngroup) {
          onUngroup(Array.from(selectedIds))
        }
        return
      }

      // Delete/Backspace - delete selected
      if ((key === 'delete' || key === 'backspace') && onDelete) {
        e.preventDefault()
        const selectedIds = getSelectedIds()
        if (selectedIds.size > 0) {
          onDelete(Array.from(selectedIds))
          deselectAll()
        }
        return
      }
    },
    [
      disabled,
      containerRef,
      selectableSelector,
      config,
      isSelecting,
      onGroup,
      onUngroup,
      onDelete,
    ]
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

    container.addEventListener('pointerdown', handlePointerDown)
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
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

  const color = COLORS[config.selectionColor]

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9999]"
      style={{ isolation: 'isolate' }}
    >
      {/* Marquee rectangle */}
      <div
        className="absolute"
        style={{
          left: marqueeRect.x + (containerRef.current?.getBoundingClientRect().left ?? 0),
          top: marqueeRect.y + (containerRef.current?.getBoundingClientRect().top ?? 0),
          width: marqueeRect.width,
          height: marqueeRect.height,
          backgroundColor: color.muted,
          border: `1px solid ${color.border}`,
          boxShadow: `0 0 8px ${color.glow}`,
        }}
      />
      {/* Corner markers */}
      <MarqueeCorner
        x={marqueeRect.x + (containerRef.current?.getBoundingClientRect().left ?? 0)}
        y={marqueeRect.y + (containerRef.current?.getBoundingClientRect().top ?? 0)}
        color={color.solid}
        corner="tl"
      />
      <MarqueeCorner
        x={marqueeRect.x + marqueeRect.width + (containerRef.current?.getBoundingClientRect().left ?? 0)}
        y={marqueeRect.y + (containerRef.current?.getBoundingClientRect().top ?? 0)}
        color={color.solid}
        corner="tr"
      />
      <MarqueeCorner
        x={marqueeRect.x + (containerRef.current?.getBoundingClientRect().left ?? 0)}
        y={marqueeRect.y + marqueeRect.height + (containerRef.current?.getBoundingClientRect().top ?? 0)}
        color={color.solid}
        corner="bl"
      />
      <MarqueeCorner
        x={marqueeRect.x + marqueeRect.width + (containerRef.current?.getBoundingClientRect().left ?? 0)}
        y={marqueeRect.y + marqueeRect.height + (containerRef.current?.getBoundingClientRect().top ?? 0)}
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
  corner: 'tl' | 'tr' | 'bl' | 'br'
}) {
  const size = 6
  const offset = corner.includes('l') ? -1 : -size + 1
  const offsetY = corner.includes('t') ? -1 : -size + 1

  return (
    <div
      className="absolute"
      style={{
        left: x + offset,
        top: y + offsetY,
        width: size,
        height: size,
        borderTop: corner.includes('t') ? `2px solid ${color}` : 'none',
        borderBottom: corner.includes('b') ? `2px solid ${color}` : 'none',
        borderLeft: corner.includes('l') ? `2px solid ${color}` : 'none',
        borderRight: corner.includes('r') ? `2px solid ${color}` : 'none',
      }}
    />
  )
}

export default SelectionOverlay
