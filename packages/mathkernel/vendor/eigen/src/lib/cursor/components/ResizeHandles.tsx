/**
 * ResizeHandles Component
 *
 * Corner and edge resize handles for DynamicIsland.
 * Uses pointer events for smooth dragging.
 *
 * @module cursor/components/ResizeHandles
 */

import { useCallback, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { cursorRegistry, cursorOps, RESIZE_CONSTRAINTS, customSizeAtom } from '../atoms'
import type { IslandSize } from '../schemas/position'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ResizeDirection =
  | 'n'  // north (top)
  | 's'  // south (bottom)
  | 'e'  // east (right)
  | 'w'  // west (left)
  | 'ne' // northeast (top-right)
  | 'nw' // northwest (top-left)
  | 'se' // southeast (bottom-right)
  | 'sw' // southwest (bottom-left)

interface ResizeHandlesProps {
  /** Current island size */
  currentSize: IslandSize
  /** Current position (for repositioning during resize) */
  currentPosition: { x: number; y: number }
  /** Callback when position changes during resize */
  onPositionChange?: (delta: { dx: number; dy: number }) => void
  /** Whether handles are visible (usually on hover or expanded state) */
  visible?: boolean
  /** Handle size in pixels */
  handleSize?: number
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const HANDLE_SIZE = 12
const HANDLE_HITAREA = 16 // Larger hitarea for easier grabbing
const EDGE_THICKNESS = 6

// -----------------------------------------------------------------------------
// Direction Cursors
// -----------------------------------------------------------------------------

const DIRECTION_CURSORS: Record<ResizeDirection, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  sw: 'nesw-resize',
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ResizeHandles({
  currentSize,
  currentPosition,
  onPositionChange,
  visible = true,
  handleSize = HANDLE_SIZE,
}: ResizeHandlesProps) {
  const startPosRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const directionRef = useRef<ResizeDirection | null>(null)

  // Handle pointer down
  const handlePointerDown = useCallback(
    (direction: ResizeDirection) => (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Capture pointer for smooth tracking
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      directionRef.current = direction
      const customSize = cursorRegistry.get(customSizeAtom)
      startPosRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: customSize?.width ?? currentSize.width,
        height: customSize?.height ?? currentSize.height,
      }

      cursorOps.startResize()
    },
    [currentSize]
  )

  // Handle pointer move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startPosRef.current || !directionRef.current) return

      const { x: startX, y: startY, width: startWidth, height: startHeight } = startPosRef.current
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      const direction = directionRef.current

      let newWidth = startWidth
      let newHeight = startHeight
      let positionDeltaX = 0
      let positionDeltaY = 0

      // Calculate new size based on direction
      // For west/north resizes, we also need to move the position
      switch (direction) {
        case 'e':
          newWidth = startWidth + dx
          break
        case 'w':
          newWidth = startWidth - dx
          positionDeltaX = dx
          break
        case 's':
          newHeight = startHeight + dy
          break
        case 'n':
          newHeight = startHeight - dy
          positionDeltaY = dy
          break
        case 'se':
          newWidth = startWidth + dx
          newHeight = startHeight + dy
          break
        case 'sw':
          newWidth = startWidth - dx
          newHeight = startHeight + dy
          positionDeltaX = dx
          break
        case 'ne':
          newWidth = startWidth + dx
          newHeight = startHeight - dy
          positionDeltaY = dy
          break
        case 'nw':
          newWidth = startWidth - dx
          newHeight = startHeight - dy
          positionDeltaX = dx
          positionDeltaY = dy
          break
      }

      // Clamp to constraints
      const clampedWidth = Math.max(RESIZE_CONSTRAINTS.minWidth, Math.min(RESIZE_CONSTRAINTS.maxWidth, newWidth))
      const clampedHeight = Math.max(RESIZE_CONSTRAINTS.minHeight, Math.min(RESIZE_CONSTRAINTS.maxHeight, newHeight))

      // Adjust position delta if we hit constraints
      if (direction.includes('w')) {
        const actualWidthChange = startWidth - clampedWidth
        positionDeltaX = actualWidthChange
      }
      if (direction.includes('n')) {
        const actualHeightChange = startHeight - clampedHeight
        positionDeltaY = actualHeightChange
      }

      // Update size
      cursorOps.updateSize({ width: clampedWidth, height: clampedHeight })

      // Update position if needed
      if (positionDeltaX !== 0 || positionDeltaY !== 0) {
        onPositionChange?.({ dx: positionDeltaX, dy: positionDeltaY })
      }
    },
    [onPositionChange]
  )

  // Handle pointer up
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    startPosRef.current = null
    directionRef.current = null
    cursorOps.endResize()
  }, [])

  // Common event handlers for all handles
  const commonHandlers = useMemo(
    () => ({
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    }),
    [handlePointerMove, handlePointerUp]
  )

  // Corner handle style
  const cornerStyle = (position: ResizeDirection): React.CSSProperties => ({
    position: 'absolute' as const,
    width: HANDLE_HITAREA,
    height: HANDLE_HITAREA,
    cursor: DIRECTION_CURSORS[position],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto' as const,
    ...(position === 'nw' && { top: -HANDLE_HITAREA / 2, left: -HANDLE_HITAREA / 2 }),
    ...(position === 'ne' && { top: -HANDLE_HITAREA / 2, right: -HANDLE_HITAREA / 2 }),
    ...(position === 'sw' && { bottom: -HANDLE_HITAREA / 2, left: -HANDLE_HITAREA / 2 }),
    ...(position === 'se' && { bottom: -HANDLE_HITAREA / 2, right: -HANDLE_HITAREA / 2 }),
  })

  // Edge handle style
  const edgeStyle = (position: ResizeDirection): React.CSSProperties => ({
    position: 'absolute' as const,
    cursor: DIRECTION_CURSORS[position],
    pointerEvents: 'auto' as const,
    ...(position === 'n' && { top: -EDGE_THICKNESS / 2, left: HANDLE_HITAREA, right: HANDLE_HITAREA, height: EDGE_THICKNESS }),
    ...(position === 's' && { bottom: -EDGE_THICKNESS / 2, left: HANDLE_HITAREA, right: HANDLE_HITAREA, height: EDGE_THICKNESS }),
    ...(position === 'e' && { right: -EDGE_THICKNESS / 2, top: HANDLE_HITAREA, bottom: HANDLE_HITAREA, width: EDGE_THICKNESS }),
    ...(position === 'w' && { left: -EDGE_THICKNESS / 2, top: HANDLE_HITAREA, bottom: HANDLE_HITAREA, width: EDGE_THICKNESS }),
  })

  if (!visible) return null

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Corner handles (invisible hitboxes, cursor indicates resize) */}
      {(['nw', 'ne', 'sw', 'se'] as ResizeDirection[]).map((dir) => (
        <div
          key={dir}
          style={cornerStyle(dir)}
          onPointerDown={handlePointerDown(dir)}
          {...commonHandlers}
        />
      ))}

      {/* Edge handles (invisible but draggable) */}
      {(['n', 's', 'e', 'w'] as ResizeDirection[]).map((dir) => (
        <div
          key={dir}
          style={edgeStyle(dir)}
          onPointerDown={handlePointerDown(dir)}
          {...commonHandlers}
        />
      ))}
    </motion.div>
  )
}

export default ResizeHandles
