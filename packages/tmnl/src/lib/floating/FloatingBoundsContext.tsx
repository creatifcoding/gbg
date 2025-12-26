/**
 * FloatingBoundsContext
 *
 * Provides an invisible bounding box that constrains all floating panels.
 * The container is opaque to the user - panels cannot be dragged or resized
 * outside these bounds.
 *
 * Uses ResizeObserver to track container size changes and update bounds
 * reactively. Bounds are stored in stx for global access.
 *
 * @pattern Context + ResizeObserver + stx
 * @module
 */

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type RefObject,
} from 'react'
import { Schema } from 'effect'
import { observable } from '@legendapp/state'
import { useSelector } from '@/lib/stx'

// =============================================================================
// Schema
// =============================================================================

export const Bounds = Schema.Struct({
  left: Schema.Number,
  top: Schema.Number,
  right: Schema.Number,
  bottom: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
})
export type Bounds = typeof Bounds.Type

// =============================================================================
// Global Bounds State (stx-adjacent)
// =============================================================================

const boundsState = observable<Bounds | null>(null)

/** Get current bounds (for use in drag/resize handlers) */
export function getBounds(): Bounds | null {
  return boundsState.get()
}

/** Set bounds (called by provider on resize) */
function setBounds(bounds: Bounds | null): void {
  boundsState.set(bounds)
}

// =============================================================================
// Clamping Utilities
// =============================================================================

/**
 * Clamp a position within bounds, accounting for panel dimensions.
 * Ensures the panel stays fully within the container.
 */
export function clampPosition(
  position: { x: number; y: number },
  dimensions: { width: number; height: number },
  bounds: Bounds | null
): { x: number; y: number } {
  if (!bounds) return position

  // Calculate max positions (panel must stay fully inside)
  const minX = bounds.left
  const minY = bounds.top
  const maxX = bounds.right - dimensions.width
  const maxY = bounds.bottom - dimensions.height

  return {
    x: Math.max(minX, Math.min(position.x, maxX)),
    y: Math.max(minY, Math.min(position.y, maxY)),
  }
}

/**
 * Clamp dimensions within bounds, accounting for position.
 * Prevents panel from extending beyond container edges.
 */
export function clampDimensions(
  position: { x: number; y: number },
  dimensions: { width: number; height: number },
  minDimensions: { width: number; height: number },
  bounds: Bounds | null
): { width: number; height: number } {
  if (!bounds) return dimensions

  // Max dimensions based on position
  const maxWidth = bounds.right - position.x
  const maxHeight = bounds.bottom - position.y

  return {
    width: Math.max(minDimensions.width, Math.min(dimensions.width, maxWidth)),
    height: Math.max(minDimensions.height, Math.min(dimensions.height, maxHeight)),
  }
}

/**
 * Clamp both position and dimensions for resize operations.
 * Handles edge cases where resizing from top/left edges affects position.
 */
export function clampResize(
  position: { x: number; y: number },
  dimensions: { width: number; height: number },
  minDimensions: { width: number; height: number },
  bounds: Bounds | null
): { position: { x: number; y: number }; dimensions: { width: number; height: number } } {
  if (!bounds) return { position, dimensions }

  let { x, y } = position
  let { width, height } = dimensions

  // Clamp left edge
  if (x < bounds.left) {
    const overflow = bounds.left - x
    x = bounds.left
    width = Math.max(minDimensions.width, width - overflow)
  }

  // Clamp top edge
  if (y < bounds.top) {
    const overflow = bounds.top - y
    y = bounds.top
    height = Math.max(minDimensions.height, height - overflow)
  }

  // Clamp right edge
  if (x + width > bounds.right) {
    width = Math.max(minDimensions.width, bounds.right - x)
  }

  // Clamp bottom edge
  if (y + height > bounds.bottom) {
    height = Math.max(minDimensions.height, bounds.bottom - y)
  }

  return {
    position: { x, y },
    dimensions: { width, height },
  }
}

// =============================================================================
// Context
// =============================================================================

interface FloatingBoundsContextValue {
  /** Ref to the bounding container element */
  containerRef: RefObject<HTMLDivElement | null>
  /** Current bounds (reactive) */
  bounds: Bounds | null
  /** Force recalculation of bounds */
  recalculate: () => void
}

const FloatingBoundsContext = createContext<FloatingBoundsContextValue | null>(null)

// =============================================================================
// Provider
// =============================================================================

export interface FloatingBoundsProviderProps {
  children: ReactNode
  /** Optional className for the container */
  className?: string
  /** Optional style for the container */
  style?: React.CSSProperties
  /** Padding inside the bounds (panels can't get closer than this to edges) */
  padding?: number
}

/**
 * Provides an invisible bounding container for floating panels.
 *
 * @example
 * ```tsx
 * <FloatingBoundsProvider className="absolute inset-4">
 *   <FloatingPanelProvider>
 *     {children}
 *   </FloatingPanelProvider>
 * </FloatingBoundsProvider>
 * ```
 */
export function FloatingBoundsProvider({
  children,
  className = '',
  style,
  padding = 0,
}: FloatingBoundsProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Subscribe to bounds for reactivity
  const bounds = useSelector(boundsState, (b) => b)

  // Calculate bounds from container rect
  const recalculate = useCallback(() => {
    const container = containerRef.current
    if (!container) {
      setBounds(null)
      return
    }

    const rect = container.getBoundingClientRect()
    setBounds({
      left: rect.left + padding,
      top: rect.top + padding,
      right: rect.right - padding,
      bottom: rect.bottom - padding,
      width: rect.width - padding * 2,
      height: rect.height - padding * 2,
    })
  }, [padding])

  // Initial calculation + ResizeObserver
  useEffect(() => {
    recalculate()

    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      recalculate()
    })

    observer.observe(container)

    // Also track window resize (for absolute positioned containers)
    const handleWindowResize = () => recalculate()
    window.addEventListener('resize', handleWindowResize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', handleWindowResize)
      setBounds(null)
    }
  }, [recalculate])

  return (
    <FloatingBoundsContext.Provider value={{ containerRef, bounds, recalculate }}>
      <div
        ref={containerRef}
        className={className}
        style={{
          position: 'relative',
          ...style,
        }}
      >
        {children}
      </div>
    </FloatingBoundsContext.Provider>
  )
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Access floating bounds context.
 * Returns null if not within a FloatingBoundsProvider.
 */
export function useFloatingBounds(): FloatingBoundsContextValue | null {
  return useContext(FloatingBoundsContext)
}

export default FloatingBoundsProvider
