/**
 * FloatingDragOverlay v2
 *
 * Minimal drag overlay for floating panels.
 * Panel itself stays visible with motion blur during drag.
 * This component just provides drop animation cleanup.
 *
 * @pattern @dnd-kit DragOverlay + stx
 * @module
 */

import { memo } from 'react'
import { DragOverlay } from '@dnd-kit/core'

// =============================================================================
// Props
// =============================================================================

export interface FloatingDragOverlayProps {
  /** Overlay style (legacy - not used, panel stays visible) */
  style?: 'ghost' | 'outline'
  /** Custom className */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

/**
 * Minimal drag overlay - panel stays visible during drag.
 * Only provides drop animation cleanup to @dnd-kit.
 *
 * @example
 * ```tsx
 * <FloatingPanelProvider>
 *   <FloatingDragOverlay />
 *   {panels}
 * </FloatingPanelProvider>
 * ```
 */
export const FloatingDragOverlay = memo(function FloatingDragOverlay({
  style: _style = 'ghost',
  className: _className = '',
}: FloatingDragOverlayProps) {
  // Panel is visible with motion blur during drag.
  // No ghost/overlay needed - dropAnimation disabled to prevent interference.
  return (
    <DragOverlay dropAnimation={null} />
  )
})

export default FloatingDragOverlay
