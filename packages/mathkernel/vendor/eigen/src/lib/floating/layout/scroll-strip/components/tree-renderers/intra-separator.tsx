/**
 * Intra-column drag separator.
 *
 * @module floating/layout/scroll-strip/components/tree-renderers/intra-separator
 */

import { memo, useCallback, useRef, useState } from 'react'
import { PANEL } from '../../../../tokens'

/** Intra-column separator — 0px idle, draggable hit-area */
export const IntraColumnSeparator = memo(function IntraColumnSeparator({
  isRow,
  panelIdBefore,
  onResize,
}: {
  isRow: boolean
  panelIdBefore: string
  onResize: (panelId: string, delta: number, totalSize: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const el = ref.current
    if (!el) return

    el.setPointerCapture(e.pointerId)
    setDragging(true)

    const parentEl = el.parentElement
    if (!parentEl) return

    const parentRect = parentEl.getBoundingClientRect()
    const totalSize = isRow ? parentRect.width : parentRect.height
    const startPos = isRow ? e.clientX : e.clientY

    const move = (ev: PointerEvent) => {
      const currentPos = isRow ? ev.clientX : ev.clientY
      const delta = currentPos - startPos
      onResize(panelIdBefore, delta, totalSize)
    }

    const up = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId)
      setDragging(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [isRow, panelIdBefore, onResize])

  return (
    <div
      ref={ref}
      data-intra-separator
      onPointerDown={handlePointerDown}
      style={{
        position: 'relative',
        [isRow ? 'width' : 'height']: 0,
        [isRow ? 'minWidth' : 'minHeight']: 0,
        cursor: isRow ? 'col-resize' : 'row-resize',
        zIndex: 3,
        [isRow ? 'marginLeft' : 'marginTop']: -3,
        [isRow ? 'marginRight' : 'marginBottom']: -3,
        [isRow ? 'paddingLeft' : 'paddingTop']: 3,
        [isRow ? 'paddingRight' : 'paddingBottom']: 3,
        background: dragging ? PANEL.accentCyan : 'transparent',
        transition: 'background 150ms ease-out',
      }}
    />
  )
})
