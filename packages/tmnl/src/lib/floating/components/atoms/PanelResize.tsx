/**
 * PanelResize — resize handle wrapper
 *
 * Zero-prop compound component. Reads panelId, dimensions, position from PanelContext.
 * Only renders when panel is resizable and not minimized.
 * @module
 */

import { memo } from 'react'
import { usePanelContext } from '../../context/PanelContext'
import { ResizeHandles } from '../../ResizeHandles'

export const PanelResize = memo(function PanelResize() {
  const { state, meta } = usePanelContext()

  if (!state.resizable) return null
  if (state.visibility === 'minimized') return null

  return (
    <div data-slot="panel-resize" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <ResizeHandles
        panelId={meta.id}
        dimensions={state.dimensions}
        position={state.position}
      />
    </div>
  )
})
