/**
 * CollapsedTiledStrip — direction-aware collapsed panel strip.
 *
 * @module floating/layout/CollapsedTiledStrip
 */

import { memo, useCallback } from 'react'
import { setFocusedPanel, setPanelCollapsed } from '../stx/actions'
import { PANEL } from '../tokens'
import { useSplitDirection, useAllSiblingsCollapsed, useConstrainedAxis } from './split-contexts'

export const CollapsedTiledStrip = memo(function CollapsedTiledStrip({
  id,
  title,
  accent,
}: {
  id: string
  title: string
  accent?: string
}) {
  const parentDirection = useSplitDirection()
  const allSiblingsCollapsed = useAllSiblingsCollapsed()
  const constrainedAxis = useConstrainedAxis()
  const isVerticalSplit = parentDirection === 'vertical'

  const handleExpand = useCallback(() => {
    setPanelCollapsed(id, false)
    setFocusedPanel(id)
  }, [id])

  // Text orientation: constrained axis from ancestor overrides local logic.
  //   'height' constrained → wide × short → horizontal text
  //   'width' constrained → narrow × tall → vertical text
  // Otherwise, local logic based on cell SHAPE:
  //   vertical split + all collapsed → tall cells → vertical text
  //   vertical split + mixed → short 36px rows → horizontal text
  //   horizontal split + all collapsed → wide cells → horizontal text
  //   horizontal split + mixed → narrow 36px columns → vertical text
  const useVerticalText = constrainedAxis != null
    ? constrainedAxis === 'width'
    : isVerticalSplit === allSiblingsCollapsed

  return (
    <div
      data-panel-id={id}
      data-panel-collapsed
      data-collapsed-orientation={isVerticalSplit ? 'horizontal' : 'vertical'}
      onClick={handleExpand}
      className="group/strip"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: useVerticalText ? 'center' : 'flex-start',
        background: PANEL.bg,
        border: `1px solid ${PANEL.border}`,
        ...(useVerticalText
          ? { borderLeft: accent ? `2px solid ${accent}` : `1px solid ${PANEL.border}` }
          : { borderTop: accent ? `2px solid ${accent}` : `1px solid ${PANEL.border}`, paddingLeft: 12 }
        ),
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'background 150ms ease-out, box-shadow 150ms ease-out',
      }}
      title={`Expand ${title}`}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = PANEL.surfaceHover
        el.style.boxShadow = `inset 0 0 0 1px rgba(255,255,255,0.04)`
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = PANEL.bg
        el.style.boxShadow = 'none'
      }}
    >
      <span
        style={{
          ...(useVerticalText
            ? { writingMode: 'vertical-rl', transform: 'rotate(180deg)' }
            : {}
          ),
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          fontSize: 'var(--tmnl-text-xs, 12px)',
          fontWeight: 500,
          color: PANEL.text,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        {title}
      </span>
    </div>
  )
})
