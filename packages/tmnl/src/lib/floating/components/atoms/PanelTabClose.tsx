/**
 * PanelTabClose — × button on the title tab
 *
 * Zero-prop compound component. Reads closable + close action from PanelContext.
 * @module
 */

import { memo } from 'react'
import { usePanelContext } from '../../context/PanelContext'
import { PANEL } from '../../tokens'

export const PanelTabClose = memo(function PanelTabClose() {
  const { state, actions } = usePanelContext()
  if (!state.closable) return null

  return (
    <button
      onClick={(e) => { e.stopPropagation(); actions.close() }}
      aria-label="Close"
      title="Close"
      className="fp-panel-tab-close"
      data-slot="panel-tab-close"
      style={{
        border: 'none',
        background: 'transparent',
        color: PANEL.btnIdle,
        width: 16,
        height: 16,
        lineHeight: '16px',
        fontSize: '12px',
        padding: 0,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      ×
    </button>
  )
})
