/**
 * FloatingBoundsContext — React provider for floating panel bounds.
 *
 * Pure logic (Bounds schema, getBounds, clamp*) lives in ./bounds.ts
 * to avoid @vitejs/plugin-react preamble detection failures when
 * `effect` Schema is imported in .tsx files.
 *
 * @module
 */

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
  memo,
  type ReactNode,
  type RefObject,
} from 'react'
import { useSelector } from '@/lib/stx'

// Re-export pure logic for consumers
export {
  Bounds,
  type Bounds as BoundsType,
  boundsState,
  getBounds,
  setBounds,
  clampPosition,
  clampDimensions,
  clampResize,
} from './bounds'

import { boundsState, setBounds, type Bounds } from './bounds'

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
export const FloatingBoundsProvider = memo(function FloatingBoundsProvider({
  children,
  className = '',
  style,
  padding = 0,
}: FloatingBoundsProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Subscribe to bounds for reactivity
  const bounds = useSelector(() => boundsState.get())

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
})

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
