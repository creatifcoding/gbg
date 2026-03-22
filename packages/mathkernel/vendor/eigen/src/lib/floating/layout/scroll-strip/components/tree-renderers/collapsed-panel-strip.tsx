/**
 * Collapsed panel strip leaf cell.
 *
 * @module floating/layout/scroll-strip/components/tree-renderers/collapsed-panel-strip
 */

import { memo, useCallback } from 'react'
import { PANEL } from '../../../../tokens'
import { getFloatingStx } from '../../../../stx/instance'
import { useSelector } from '@/lib/stx'

/** Collapsed panel strip cell. */
export const CollapsedPanelStrip = memo(function CollapsedPanelStrip({
  panelId,
  isFocused,
  isRow,
  allSiblingsCollapsed = false,
  forceVerticalText,
}: {
  panelId: string
  isFocused: boolean
  isRow: boolean
  allSiblingsCollapsed?: boolean
  forceVerticalText?: boolean
}) {
  const title = useSelector(
    () => getFloatingStx().data.panels.get(panelId)?.title.get() ?? panelId,
  )
  const accent = useSelector(
    () => getFloatingStx().data.panels.get(panelId)?.accent.get(),
  )

  const handleExpand = useCallback(() => {
    const stx = getFloatingStx()
    stx.data.panels.get(panelId)?.isCollapsed.set(false)
    stx.data.activePanel.set(panelId)
  }, [panelId])

  const isVerticalSplit = !isRow
  const useVerticalText = forceVerticalText ?? (isVerticalSplit === allSiblingsCollapsed)

  return (
    <div
      data-panel-id={panelId}
      data-panel-collapsed
      onClick={handleExpand}
      className="group/strip"
      title={`Expand ${title}`}
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
          : {
              borderTop: accent ? `2px solid ${accent}` : `1px solid ${PANEL.border}`,
              paddingLeft: 12,
            }),
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: isFocused ? PANEL.reticleGlow : PANEL.reticleNone,
        transition: 'background 150ms ease-out, box-shadow 150ms ease-out',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = PANEL.surfaceHover
        el.style.boxShadow = isFocused
          ? PANEL.reticleGlow
          : `inset 0 0 0 1px rgba(255,255,255,0.04)`
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = PANEL.bg
        el.style.boxShadow = isFocused ? PANEL.reticleGlow : PANEL.reticleNone
      }}
    >
      <span
        style={{
          ...(useVerticalText
            ? { writingMode: 'vertical-rl', transform: 'rotate(180deg)' }
            : {}),
          fontFamily: PANEL.fontMono,
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
