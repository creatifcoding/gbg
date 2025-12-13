/**
 * Floating Dimension Context
 *
 * Provides panel dimensions to content for adaptive layouts.
 * Works with CSS container queries for automatic adaptation.
 *
 * @pattern Context + CSS container queries
 * @module
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Dimensions, UseFloatingDimensionsReturn } from './types'

// =============================================================================
// Context
// =============================================================================

interface FloatingDimensionContextValue {
  width: number
  height: number
  isResizing: boolean
  panelId: string
}

const FloatingDimensionContext = createContext<FloatingDimensionContextValue | null>(null)

// =============================================================================
// Provider
// =============================================================================

interface FloatingDimensionProviderProps {
  children: ReactNode
  panelId: string
  dimensions: Dimensions
  isResizing: boolean
}

export function FloatingDimensionProvider({
  children,
  panelId,
  dimensions,
  isResizing,
}: FloatingDimensionProviderProps) {
  const value = useMemo(
    () => ({
      width: dimensions.width,
      height: dimensions.height,
      isResizing,
      panelId,
    }),
    [dimensions.width, dimensions.height, isResizing, panelId]
  )

  return (
    <FloatingDimensionContext.Provider value={value}>
      <div
        className="floating-panel-content"
        style={{
          containerType: 'size',
          containerName: 'panel',
          // Fill available space in parent flex container
          flex: 1,
          minHeight: 0, // Allow shrinking below content size
          minWidth: 0,
          // Make this a flex container so children with flex:1 work
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </FloatingDimensionContext.Provider>
  )
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Access panel dimensions for adaptive content.
 *
 * @throws Error if used outside FloatingPanel
 *
 * @example
 * ```tsx
 * function PanelContent() {
 *   const { width, layout } = useFloatingDimensions()
 *
 *   return (
 *     <div className={layout === 'compact' ? 'flex-col' : 'flex-row'}>
 *       ...
 *     </div>
 *   )
 * }
 * ```
 */
export function useFloatingDimensions(): UseFloatingDimensionsReturn {
  const context = useContext(FloatingDimensionContext)

  if (!context) {
    throw new Error('useFloatingDimensions must be used within a FloatingPanel')
  }

  const layout = useMemo(() => {
    if (context.width < 300) return 'compact'
    if (context.width > 600) return 'wide'
    return 'normal'
  }, [context.width])

  return {
    width: context.width,
    height: context.height,
    isResizing: context.isResizing,
    layout,
  }
}

// =============================================================================
// CSS Container Query Classes (for reference)
// =============================================================================

/**
 * CSS container queries work automatically with the provider.
 * Add these to your global CSS:
 *
 * ```css
 * .floating-panel-content {
 *   container-type: size;
 *   container-name: panel;
 * }
 *
 * @container panel (max-width: 300px) {
 *   .panel-adaptive {
 *     flex-direction: column;
 *   }
 * }
 *
 * @container panel (min-width: 600px) {
 *   .panel-adaptive {
 *     grid-template-columns: 1fr 1fr;
 *   }
 * }
 * ```
 */

export { FloatingDimensionContext }
