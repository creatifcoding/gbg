/**
 * PanelContent — scrollable content area
 *
 * Reads panelId, dimensions, isResizing from PanelContext.
 * Wraps children in FloatingDimensionProvider for container query support.
 *
 * @module
 */

import { memo, type ReactNode } from 'react'
import { usePanelContext } from '../context/PanelContext'
import { FloatingDimensionProvider } from '../context/FloatingDimensionContext'
import { PanelSlot } from '@/lib/drawer'

export interface PanelContentProps {
  children?: ReactNode
}

export const PanelContent = memo(function PanelContent({ children }: PanelContentProps) {
  const { state, meta } = usePanelContext()

  if (state.visibility === 'minimized') return null

  return (
    <FloatingDimensionProvider
      panelId={meta.id}
      dimensions={state.dimensions}
      isResizing={state.isResizing}
    >
      <div
        data-slot="panel-content"
        style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'auto', position: 'relative' }}
      >
        {children}
        <PanelSlot panelId={meta.id} />
      </div>
    </FloatingDimensionProvider>
  )
})
