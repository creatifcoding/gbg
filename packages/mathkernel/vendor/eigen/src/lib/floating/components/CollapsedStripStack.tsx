/**
 * CollapsedStripStack — horizontal row of minimized panel strips
 *
 * Renders all panels with visibility='minimized' as collapsed strips
 * stacked left-to-right at the bottom of the workspace (above status bar).
 * No dock, no wrapper chrome — just the strips themselves.
 *
 * @module
 */

import { memo, useCallback } from 'react'
import { useSelector } from '@/lib/stx'
import { getFloatingStx, setPanelVisibility, bringPanelToFront } from '../floating-stx'
import { CollapsedStrip, STRIP_HEIGHT, STRIP_GAP, STRIP_BOTTOM_OFFSET } from './CollapsedStrip'
import { batch } from '@/lib/stx'

export const CollapsedStripStack = memo(function CollapsedStripStack() {
  const stx = getFloatingStx()

  // Subscribe to minimized panels: we read zOrder + per-panel visibility
  const minimizedPanels = useSelector(() => {
    const zOrder = stx.data.zOrder.get()
    const result: Array<{ id: string; title: string }> = []
    for (const id of zOrder) {
      const panel = stx.data.panels.get(id)?.get()
      if (panel && panel.visibility === 'minimized') {
        result.push({ id: panel.id, title: panel.title })
      }
    }
    return result
  })

  const handleRestore = useCallback((id: string) => {
    batch(() => {
      setPanelVisibility(id, 'visible')
      bringPanelToFront(id)
    })
  }, [])

  if (minimizedPanels.length === 0) return null

  return (
    <div
      data-collapsed-strip-stack
      style={{
        position: 'fixed',
        bottom: STRIP_BOTTOM_OFFSET,
        left: 12,
        display: 'flex',
        flexDirection: 'row',
        gap: STRIP_GAP,
        alignItems: 'center',
        // No background, no border — just the strips floating
        zIndex: 900, // below panels (1000+) but visible
        pointerEvents: 'auto',
      }}
    >
      {minimizedPanels.map(p => (
        <CollapsedStrip
          key={p.id}
          id={p.id}
          title={p.title}
          onRestore={handleRestore}
        />
      ))}
    </div>
  )
})
