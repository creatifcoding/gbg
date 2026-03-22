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
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        fontWeight: 500,
        color: PANEL.text,
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
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
