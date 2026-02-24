/**
 * ScrollStrip — Niri-inspired infinite horizontal panel strip.
 *
 * Main orchestrator for strip mode. Rendering primitives and tree composition
 * are extracted to `./components`.
 *
 * @module floating/layout/scroll-strip/ScrollStrip
 */

import { memo, useCallback, useRef, type ReactNode } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { PANEL } from '../../tokens'
import { getFloatingStx } from '../../stx/instance'
import { toggleColumnCollapsed } from '../../stx/actions'
import { useSelector } from '@/lib/stx'
import { WIDTH_PRESETS, COLLAPSED_COLUMN_WIDTH } from '../../types/strip'
import {
  StripScroller,
  StripList,
  StripColumnSlot,
  StripStatus,
} from './components'
import {
  useStripContainerWidth,
  useStripFocusScroll,
  useStripOverscan,
  useStripPanDrag,
} from './hooks'

export interface ScrollStripProps {
  renderPanel: (panelId: string) => ReactNode
}

export const ScrollStrip = memo(function ScrollStrip({ renderPanel }: ScrollStripProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const containerWidth = useStripContainerWidth(containerRef)

  const columns = useSelector(() => getFloatingStx().data.strip.columns.get())
  const focusedIndex = useSelector(() => getFloatingStx().data.strip.focusedIndex.get())
  const activePanel = useSelector(() => getFloatingStx().data.activePanel.get())

  // ── Column pixel width from preset (or COLLAPSED_COLUMN_WIDTH) ──────
  const getColumnWidth = useCallback(
    (index: number) => {
      const col = columns[index]
      if (!col) return containerWidth * 0.5
      if (col.isCollapsed) return COLLAPSED_COLUMN_WIDTH
      if (col.widthPct > 0) return Math.round(containerWidth * col.widthPct)
      return Math.round(containerWidth * WIDTH_PRESETS[col.width])
    },
    [columns, containerWidth],
  )

  const { springRef } = useStripFocusScroll({
    containerRef,
    virtuosoRef,
    focusedIndex,
    getColumnWidth,
  })

  useStripPanDrag(containerRef, springRef)

  // ── Collapse toggle handler ─────────────────────────────────────────
  const handleToggleCollapse = useCallback((index: number) => {
    toggleColumnCollapsed(index)
  }, [])

  const overscan = useStripOverscan(columns)
  const focusedWidth = columns[focusedIndex]?.width ?? null

  if (columns.length === 0) return null

  return (
    <div
      ref={containerRef}
      data-scroll-strip
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: PANEL.bg,
      }}
    >
      <div style={{ flex: 1, position: 'relative' }}>
        <Virtuoso
          ref={virtuosoRef}
          horizontalDirection
          totalCount={columns.length}
          overscan={overscan}
          components={{ Scroller: StripScroller, List: StripList }}
          itemContent={(index) => (
            <StripColumnSlot
              column={columns[index]}
              index={index}
              width={getColumnWidth(index)}
              isFocused={index === focusedIndex}
              focusedPanelId={activePanel}
              renderPanel={renderPanel}
              onToggleCollapse={handleToggleCollapse}
            />
          )}
          style={{ height: '100%', width: '100%' }}
        />
      </div>

      <StripStatus
        columnCount={columns.length}
        focusedIndex={focusedIndex}
        focusedWidth={focusedWidth}
      />
    </div>
  )
})

export default ScrollStrip
