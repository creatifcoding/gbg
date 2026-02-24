/**
 * Strip column slot wrapper with lightweight pop-back animation.
 *
 * @module floating/layout/scroll-strip/components/column-slot
 */

import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { useSelector } from '@/lib/stx'
import { getFloatingStx } from '../../../stx/instance'
import type { Column } from '../../../types/strip'
import { getColumnPanelId } from '../../../types/strip'
import { StripColumnCell } from './column-cell'

interface StripColumnSlotProps {
  column: Column
  index: number
  width: number
  isFocused: boolean
  focusedPanelId: string | null
  renderPanel: (panelId: string) => ReactNode
  onToggleCollapse: (index: number) => void
}

export const StripColumnSlot = memo(function StripColumnSlot({
  column,
  index,
  width,
  isFocused,
  focusedPanelId,
  renderPanel,
  onToggleCollapse,
}: StripColumnSlotProps) {
  const panelId = getColumnPanelId(column)
  const reattachAt = useSelector(
    () => getFloatingStx().data.panels.get(panelId)?.stripLastReattachAt.get(),
  )

  const [pendingPopAt, setPendingPopAt] = useState<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!reattachAt) return
    if (Date.now() - reattachAt > 260) return

    setPendingPopAt(reattachAt)

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      setPendingPopAt((current) => (current === reattachAt ? null : current))
      rafRef.current = null
    })
  }, [reattachAt])

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  const shouldPop = pendingPopAt !== null && pendingPopAt === reattachAt

  return (
    <div
      style={{
        width,
        height: '100%',
        flexShrink: 0,
        willChange: 'transform, opacity, width',
        transition:
          'width 180ms ease-out, transform 180ms cubic-bezier(0.18,0.9,0.32,1.08), opacity 180ms ease-out',
        transform: shouldPop ? 'translateY(8px) scale(0.985)' : 'translateY(0) scale(1)',
        opacity: shouldPop ? 0.86 : 1,
      }}
    >
      <StripColumnCell
        column={column}
        index={index}
        isFocused={isFocused}
        focusedPanelId={focusedPanelId}
        renderPanel={renderPanel}
        onToggleCollapse={onToggleCollapse}
      />
    </div>
  )
})
