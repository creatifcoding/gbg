/**
 * PanelTitle — title text atom
 *
 * Zero-prop compound component. Reads title from PanelContext.
 * @module
 */

import { memo } from 'react'
import { usePanelContext } from '../../context/PanelContext'
import { PANEL } from '../../tokens'

export const PanelTitle = memo(function PanelTitle() {
  const { meta } = usePanelContext()
  return (
    <span
      data-slot="panel-title"
      style={{
        fontFamily: 'var(--tmnl-font-mono, monospace)',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        fontWeight: 500,
        color: PANEL.textStrong,
        letterSpacing: '0.01em',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
        minWidth: 0,
      }}
    >
      {meta.title}
    </span>
  )
})
