/**
 * useStaggeredEntrance
 *
 * Hook for triggering staggered row entrance animation in DataGrid.
 * Works with AG-Grid's virtualization by animating only visible rows.
 */

import { useState, useCallback, useRef } from 'react'
import type { RowClassParams } from 'ag-grid-community'

// Import stagger CSS (side effect)
import './stagger.css'

// =============================================================================
// TYPES
// =============================================================================

export interface UseStaggeredEntranceOptions {
  /** Max rows to animate (prevents performance issues) */
  maxRows?: number
  /** Duration before auto-clearing stagger class (ms) */
  clearAfter?: number
}

export interface UseStaggeredEntranceResult {
  /** Add to grid container className */
  containerClassName: string
  /** Pass to AG-Grid getRowClass */
  getRowClass: (params: RowClassParams) => string
  /** Trigger the stagger animation */
  triggerStagger: () => void
  /** Whether stagger is currently active */
  isStaggering: boolean
}

// =============================================================================
// HOOK
// =============================================================================

export function useStaggeredEntrance(
  options: UseStaggeredEntranceOptions = {}
): UseStaggeredEntranceResult {
  const { maxRows = 20, clearAfter = 1500 } = options

  const [isStaggering, setIsStaggering] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * AG-Grid row class callback
   * Assigns index-based class for CSS stagger delay
   */
  const getRowClass = useCallback(
    (params: RowClassParams): string => {
      if (!isStaggering) return ''

      // Use rowIndex modulo maxRows to keep within our CSS class range
      const visibleIndex = params.rowIndex % maxRows
      return `dg-row-${visibleIndex}`
    },
    [isStaggering, maxRows]
  )

  /**
   * Trigger the stagger animation
   */
  const triggerStagger = useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    setIsStaggering(true)

    // Auto-clear after animation completes
    timeoutRef.current = setTimeout(() => {
      setIsStaggering(false)
    }, clearAfter)
  }, [clearAfter])

  const containerClassName = `dg-stagger-container ${isStaggering ? 'dg-stagger-active' : ''}`

  return {
    containerClassName,
    getRowClass,
    triggerStagger,
    isStaggering,
  }
}
