/**
 * DraggableAffordance
 *
 * Visual drag handle indicator — six-dot grip pattern.
 * Shows axis constraints via icon orientation.
 *
 * @pattern Capability affordance (ECS system)
 * @module
 */

import type { DraggableData } from '@/lib/capabilities/types'
import { COLORS } from '@/lib/capabilities/tokens'

export interface DraggableAffordanceProps extends DraggableData {
  className?: string
}

/**
 * Six-dot grip icon SVG
 * Rotates 90deg for horizontal-only axis constraint
 */
function GripIcon({ axis = 'both' }: { axis?: 'x' | 'y' | 'both' }) {
  // Rotate 90deg for horizontal-only movement
  const rotation = axis === 'x' ? 90 : 0

  return (
    <svg
      width="8"
      height="14"
      viewBox="0 0 8 14"
      fill="currentColor"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {/* Two columns of three dots */}
      <circle cx="2" cy="2" r="1.2" />
      <circle cx="6" cy="2" r="1.2" />
      <circle cx="2" cy="7" r="1.2" />
      <circle cx="6" cy="7" r="1.2" />
      <circle cx="2" cy="12" r="1.2" />
      <circle cx="6" cy="12" r="1.2" />
    </svg>
  )
}

/**
 * Renders draggable affordance — positioned at top-left corner.
 *
 * Uses @dnd-kit setActivatorNodeRef pattern:
 * - Wrapper is just visual indicator
 * - Actual drag activation happens via parent's drag handle ref
 */
export function DraggableAffordance({
  showHandle = true,
  axis = 'both',
  dragEffect = 'ghost',
  className = '',
}: DraggableAffordanceProps) {
  // Hide if showHandle is false
  if (!showHandle) {
    return null
  }

  return (
    <div
      className={`
        absolute top-1 left-1 z-10
        flex items-center justify-center
        w-4 h-6 rounded
        cursor-grab active:cursor-grabbing
        transition-colors duration-150
        hover:bg-white/10
        ${className}
      `}
      style={{
        color: COLORS.neutral[500],
      }}
      data-drag-handle
      data-drag-axis={axis}
      data-drag-effect={dragEffect}
    >
      <GripIcon axis={axis} />
    </div>
  )
}

/**
 * Props interface for components integrating with @dnd-kit
 * Use with useDraggable hook:
 *
 * ```tsx
 * const { listeners, setActivatorNodeRef } = useDraggable({ id })
 *
 * <DraggableAffordanceHandle
 *   ref={setActivatorNodeRef}
 *   {...listeners}
 *   {...draggableData}
 * />
 * ```
 */
export interface DraggableAffordanceHandleProps extends DraggableAffordanceProps {
  /** Forward ref for @dnd-kit setActivatorNodeRef */
  onPointerDown?: React.PointerEventHandler
  onKeyDown?: React.KeyboardEventHandler
}

/**
 * Interactive drag handle that integrates with @dnd-kit.
 * Use this when you need the handle to be the drag activator.
 */
import { forwardRef } from 'react'

export const DraggableAffordanceHandle = forwardRef<
  HTMLDivElement,
  DraggableAffordanceHandleProps
>(function DraggableAffordanceHandle(
  {
    showHandle = true,
    axis = 'both',
    dragEffect = 'ghost',
    className = '',
    onPointerDown,
    onKeyDown,
    ...props
  },
  ref
) {
  if (!showHandle) {
    return null
  }

  return (
    <div
      ref={ref}
      className={`
        absolute top-1 left-1 z-10
        flex items-center justify-center
        w-4 h-6 rounded
        cursor-grab active:cursor-grabbing
        transition-colors duration-150
        hover:bg-white/10
        focus:outline-none focus:ring-1 focus:ring-cyan-500/50
        ${className}
      `}
      style={{
        color: COLORS.neutral[500],
      }}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="button"
      aria-label="Drag handle"
      data-drag-handle
      data-drag-axis={axis}
      data-drag-effect={dragEffect}
      {...props}
    >
      <GripIcon axis={axis} />
    </div>
  )
})

export default DraggableAffordance
