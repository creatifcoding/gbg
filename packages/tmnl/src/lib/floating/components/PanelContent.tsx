/**
 * PanelContent — scrollable content area
 *
 * Reads panelId, dimensions, isResizing from PanelContext.
 * Wraps children in FloatingDimensionProvider for container query support.
 *
 * When `state.autoSize` is true, a ResizeObserver measures the content
 * and syncs the panel dimensions to fit — the panel becomes content-locked.
 *
 * @module
 */

import { memo, useRef, useEffect, type ReactNode } from 'react'
import { usePanelContext } from '../context/PanelContext'
import { FloatingDimensionProvider } from '../context/FloatingDimensionContext'
import { updatePanelDimensions } from '../stx/actions'
import { PANEL } from '../tokens'
import { PanelSlot } from '@/lib/drawer'

export interface PanelContentProps {
  children?: ReactNode
}

export const PanelContent = memo(function PanelContent({ children }: PanelContentProps) {
  const { state, meta } = usePanelContext()
  const contentRef = useRef<HTMLDivElement>(null)

  // ── Auto-size: observe content intrinsic size → sync panel ─────
  useEffect(() => {
    if (!state.autoSize) return
    const el = contentRef.current
    if (!el) return

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect
        if (cr.width > 0 && cr.height > 0) {
          updatePanelDimensions(meta.id, {
            width: Math.ceil(cr.width),
            height: Math.ceil(cr.height) + PANEL.headerHeight,
          })
        }
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [state.autoSize, meta.id])

  if (state.visibility === 'minimized') return null

  return (
    <FloatingDimensionProvider
      panelId={meta.id}
      dimensions={state.dimensions}
      isResizing={state.isResizing}
    >
      <div
        ref={contentRef}
        data-slot="panel-content"
        style={state.autoSize
          ? { position: 'relative', width: 'max-content' }
          : { flex: 1, minHeight: 0, minWidth: 0, overflow: 'auto', position: 'relative' }
        }
      >
        {children}
        <PanelSlot panelId={meta.id} />
      </div>
    </FloatingDimensionProvider>
  )
})
