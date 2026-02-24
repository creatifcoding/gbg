/**
 * FloatingDragOverlay v3
 *
 * Renders context-aware drag ghosts:
 *   - Panel drags: no ghost (panel stays visible with motion blur)
 *   - Tab drags: TabDragGhost with tear-off morph
 *
 * Reads active drag type from the DndContext via useDndContext.
 *
 * @pattern @dnd-kit DragOverlay + stx
 * @module
 */

import { memo, useState, useEffect } from 'react'
import { DragOverlay, useDndContext } from '@dnd-kit/core'
import { TabDragGhost } from './layout/TabDragGhost'

// =============================================================================
// Props
// =============================================================================

export interface FloatingDragOverlayProps {
  /** Overlay style (legacy - not used) */
  style?: 'ghost' | 'outline'
  /** Custom className */
  className?: string
}

// =============================================================================
// Tear-off threshold (px of vertical distance from tab bar)
// =============================================================================

const TEAR_OFF_THRESHOLD_Y = 40

// =============================================================================
// Component
// =============================================================================

export const FloatingDragOverlay = memo(function FloatingDragOverlay({
  style: _style = 'ghost',
  className: _className = '',
}: FloatingDragOverlayProps) {
  const { active } = useDndContext()
  const [isTearOff, setIsTearOff] = useState(false)

  // Reset tear-off state when drag ends
  useEffect(() => {
    if (!active) {
      setIsTearOff(false)
    }
  }, [active])

  const activeData = active?.data?.current as
    | { type: 'tab'; label: string; hostPanelId: string; tabId: string }
    | undefined

  const isTabDrag = activeData?.type === 'tab'

  return (
    <DragOverlay dropAnimation={null}>
      {isTabDrag && (
        <TabDragGhost
          label={activeData.label}
          isTearOff={isTearOff}
        />
      )}
    </DragOverlay>
  )
})

/**
 * Hook for the provider to detect tear-off threshold during drag move.
 * Call from onDragMove in FloatingPanelProvider.
 */
export function checkTabTearOff(deltaY: number): boolean {
  return Math.abs(deltaY) > TEAR_OFF_THRESHOLD_Y
}

export { TEAR_OFF_THRESHOLD_Y }
export default FloatingDragOverlay
