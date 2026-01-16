/**
 * @module layout/components/ResizeHandle
 * @description Generic bidirectional resize handle component
 */

import * as React from "react"
import { useCallback, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import type { ResizeDirection } from "../schemas"

/**
 * Props for ResizeHandle component
 */
export interface ResizeHandleProps {
  /** Resize direction */
  direction: ResizeDirection
  /** Handle index (0 = between cell 0 and 1) */
  index: number
  /** Current cell ratios */
  ratios: readonly number[]
  /** Callback when ratios change during drag */
  onRatiosChange: (ratios: number[]) => void
  /** Callback when drag ends (for persistence) */
  onDragEnd?: (ratios: number[]) => void
  /** Container size in pixels (width for horizontal, height for vertical) */
  containerSize: number
  /** Minimum ratio for any cell */
  minRatio?: number
  /** Gap size for positioning calculation */
  gap?: number
  /** Optional CSS class */
  className?: string
  /** Whether handle is disabled */
  disabled?: boolean
}

/**
 * Calculate new ratios based on handle movement
 */
function calculateNewRatios(
  startRatios: readonly number[],
  handleIndex: number,
  ratioDelta: number,
  minRatio: number
): number[] {
  const newRatios = [...startRatios]
  const leftIndex = handleIndex
  const rightIndex = handleIndex + 1

  if (leftIndex < 0 || rightIndex >= newRatios.length) {
    return newRatios
  }

  const combined = startRatios[leftIndex] + startRatios[rightIndex]
  const maxRatio = combined - minRatio

  let newLeft = Math.max(minRatio, Math.min(maxRatio, startRatios[leftIndex] + ratioDelta))
  let newRight = Math.max(minRatio, Math.min(maxRatio, startRatios[rightIndex] - ratioDelta))

  // Normalize to maintain sum
  const sum = newLeft + newRight
  if (Math.abs(sum - combined) > 0.0001) {
    const scale = combined / sum
    newLeft *= scale
    newRight *= scale
  }

  newRatios[leftIndex] = newLeft
  newRatios[rightIndex] = newRight

  // Normalize all ratios to sum to 1
  const total = newRatios.reduce((a, b) => a + b, 0)
  return newRatios.map((r) => r / total)
}

/**
 * ResizeHandle component
 *
 * A draggable handle for resizing adjacent cells in a grid layout.
 * Supports both horizontal (column) and vertical (row) directions.
 *
 * @example
 * ```tsx
 * <ResizeHandle
 *   direction="horizontal"
 *   index={0}
 *   ratios={[0.5, 0.5]}
 *   onRatiosChange={setRatios}
 *   onDragEnd={persist}
 *   containerSize={800}
 * />
 * ```
 */
export const ResizeHandle = React.forwardRef<HTMLDivElement, ResizeHandleProps>(
  function ResizeHandle(
    {
      direction,
      index,
      ratios,
      onRatiosChange,
      onDragEnd,
      containerSize,
      minRatio = 0.1,
      gap = 0,
      className,
      disabled = false,
    },
    forwardedRef
  ) {
    const isDragging = useRef(false)
    const startPos = useRef(0)
    const startRatios = useRef<readonly number[]>(ratios)
    const localRef = useRef<HTMLDivElement>(null)
    const ref = (forwardedRef as React.RefObject<HTMLDivElement>) || localRef

    const isHorizontal = direction === "horizontal"

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (disabled) return

        e.preventDefault()
        e.stopPropagation()

        isDragging.current = true
        startPos.current = isHorizontal ? e.clientX : e.clientY
        startRatios.current = ratios

        document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize"
        document.body.style.userSelect = "none"
      },
      [disabled, isHorizontal, ratios]
    )

    const handleTouchStart = useCallback(
      (e: React.TouchEvent) => {
        if (disabled) return

        e.stopPropagation()

        const touch = e.touches[0]
        isDragging.current = true
        startPos.current = isHorizontal ? touch.clientX : touch.clientY
        startRatios.current = ratios
      },
      [disabled, isHorizontal, ratios]
    )

    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return

        const currentPos = isHorizontal ? e.clientX : e.clientY
        const delta = currentPos - startPos.current
        const ratioDelta = delta / containerSize

        const newRatios = calculateNewRatios(
          startRatios.current,
          index,
          ratioDelta,
          minRatio
        )

        onRatiosChange(newRatios)
      }

      const handleTouchMove = (e: TouchEvent) => {
        if (!isDragging.current) return

        const touch = e.touches[0]
        const currentPos = isHorizontal ? touch.clientX : touch.clientY
        const delta = currentPos - startPos.current
        const ratioDelta = delta / containerSize

        const newRatios = calculateNewRatios(
          startRatios.current,
          index,
          ratioDelta,
          minRatio
        )

        onRatiosChange(newRatios)
      }

      const handleMouseUp = () => {
        if (!isDragging.current) return

        isDragging.current = false
        document.body.style.cursor = ""
        document.body.style.userSelect = ""

        // Get final ratios for persistence
        const finalRatios = calculateNewRatios(
          startRatios.current,
          index,
          0, // No additional delta
          minRatio
        )
        onDragEnd?.(finalRatios)
      }

      const handleTouchEnd = () => {
        if (!isDragging.current) return

        isDragging.current = false

        const finalRatios = calculateNewRatios(
          startRatios.current,
          index,
          0,
          minRatio
        )
        onDragEnd?.(finalRatios)
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.addEventListener("touchmove", handleTouchMove, { passive: false })
      document.addEventListener("touchend", handleTouchEnd)

      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.removeEventListener("touchmove", handleTouchMove)
        document.removeEventListener("touchend", handleTouchEnd)
      }
    }, [isHorizontal, containerSize, index, minRatio, onRatiosChange, onDragEnd])

    // Calculate position based on ratios
    const position = React.useMemo(() => {
      let cumulative = 0
      const totalGaps = (ratios.length - 1) * gap
      const availableSize = containerSize - totalGaps

      for (let i = 0; i <= index; i++) {
        cumulative += ratios[i] * availableSize
        if (i < index) cumulative += gap
      }

      return cumulative + gap / 2
    }, [ratios, index, containerSize, gap])

    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={isHorizontal ? "vertical" : "horizontal"}
        aria-valuenow={Math.round(ratios[index] * 100)}
        aria-valuemin={Math.round(minRatio * 100)}
        aria-valuemax={Math.round((1 - minRatio) * 100)}
        tabIndex={disabled ? -1 : 0}
        className={cn(
          // Base styles
          "absolute z-10 flex items-center justify-center",
          "transition-colors duration-150",
          // Focus styles
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          // Direction-specific
          isHorizontal
            ? "w-2 -ml-1 cursor-col-resize top-0 bottom-0"
            : "h-2 -mt-1 cursor-row-resize left-0 right-0",
          // Hover/active states
          !disabled && "hover:bg-primary/20 active:bg-primary/30",
          // Disabled state
          disabled && "cursor-default opacity-50",
          className
        )}
        style={{
          [isHorizontal ? "left" : "top"]: `${position}px`,
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onKeyDown={(e) => {
          if (disabled) return

          const step = 0.02 // 2% step
          let delta = 0

          if (isHorizontal) {
            if (e.key === "ArrowLeft") delta = -step
            if (e.key === "ArrowRight") delta = step
          } else {
            if (e.key === "ArrowUp") delta = -step
            if (e.key === "ArrowDown") delta = step
          }

          if (delta !== 0) {
            e.preventDefault()
            const newRatios = calculateNewRatios(ratios, index, delta, minRatio)
            onRatiosChange(newRatios)
            onDragEnd?.(newRatios)
          }
        }}
      >
        {/* Visual indicator */}
        <div
          className={cn(
            "rounded-full bg-border transition-all",
            isHorizontal ? "w-0.5 h-8" : "h-0.5 w-8",
            !disabled && "group-hover:bg-primary group-active:scale-110"
          )}
        />
      </div>
    )
  }
)

ResizeHandle.displayName = "ResizeHandle"
