/**
 * CollapsedStrip — minimized panel rendered as a thin horizontal strip
 *
 * 28px tall, auto-width to fit title. Sits in a horizontal stack
 * at the bottom of the workspace. Click restores, drag pulls out.
 *
 * @module
 */

import { memo, useCallback, type MouseEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { PANEL } from '../tokens'

export interface CollapsedStripProps {
  readonly id: string
  readonly title: string
  readonly onRestore: (id: string) => void
}

export const STRIP_HEIGHT = 28
export const STRIP_GAP = 2
export const STRIP_BOTTOM_OFFSET = 36 // above status bar (28px) + gap

export const CollapsedStrip = memo(function CollapsedStrip({
  id,
  title,
  onRestore,
}: CollapsedStripProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `strip-${id}`,
    data: { type: 'collapsed-strip', panelId: id },
  })

  const handleClick = useCallback((e: MouseEvent) => {
    e.stopPropagation()
    // Only restore on click, not drag-end
    if (!isDragging) {
      onRestore(id)
    }
  }, [id, onRestore, isDragging])

  const dndTransform = transform ? CSS.Translate.toString(transform) : undefined

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      data-collapsed-strip={id}
      style={{
        height: STRIP_HEIGHT,
        padding: '0 12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: PANEL.headerBg,
        border: `1px solid ${PANEL.border}`,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        transform: dndTransform,
        transition: 'none',
        opacity: isDragging ? 0.6 : 1,
      }}
      title={`Restore ${title}`}
    >
      {/* Active dot */}
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: '#22c55e',
          flexShrink: 0,
        }}
      />
      {/* Title */}
      <span
        style={{
          fontFamily: 'var(--tmnl-font-mono, ui-monospace, "SF Mono", monospace)',
          fontSize: 'var(--tmnl-text-xs, 12px)',
          color: PANEL.text,
          letterSpacing: '0.01em',
        }}
      >
        {title}
      </span>
    </div>
  )
})
