/**
 * PanelContent
 *
 * Content area for floating panels — scrollable, dimension-aware.
 *
 * @module
 */

import { memo, type ReactNode } from 'react'
import type { Dimensions } from '../types'
import { FloatingDimensionProvider } from '../context/FloatingDimensionContext'
import { PanelSlot } from '@/lib/drawer'

export interface PanelContentProps {
  panelId: string
  dimensions: Dimensions
  isResizing: boolean
  children: ReactNode
}

export const PanelContent = memo(function PanelContent({
  panelId,
  dimensions,
  isResizing,
  children,
}: PanelContentProps) {
  return (
    <FloatingDimensionProvider
      panelId={panelId}
      dimensions={dimensions}
      isResizing={isResizing}
    >
      <div
        data-slot="panel-content"
        style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'auto', position: 'relative' }}
      >
        {children}
        <PanelSlot panelId={panelId} />
      </div>
    </FloatingDimensionProvider>
  )
})
