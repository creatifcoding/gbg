/**
 * SortableTabItem — individual draggable tab with close button.
 *
 * @module floating/layout/SortableTabItem
 */

import { memo, useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PANEL } from '../tokens'
import type { Tab } from './TabBar'

export const SortableTabItem = memo(function SortableTabItem({
  tab,
  isActive,
  onClick,
  onClose,
}: {
  tab: Tab
  isActive: boolean
  onClick?: (id: string) => void
  onClose?: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id })

  const handleClick = useCallback(() => onClick?.(tab.id), [tab.id, onClick])
  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onClose?.(tab.id)
  }, [tab.id, onClose])

  const sortStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-drag-item={tab.id}
      onClick={handleClick}
      style={{
        ...sortStyle,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 10px',
        height: '100%',
        cursor: 'pointer',
        background: isActive ? PANEL.tabBg : 'transparent',
        borderRight: `1px solid ${PANEL.border}`,
        color: isActive ? PANEL.textStrong : PANEL.text,
        fontSize: 'var(--tmnl-text-xs, 12px)',
        fontWeight: isActive ? 500 : 400,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: 160,
        minWidth: 0,
        userSelect: 'none',
        transition: 'background 100ms ease-out, color 100ms ease-out',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {tab.label}
      </span>
      {(tab.closable !== false) && onClose && (
        <button
          type="button"
          onClick={handleClose}
          style={{
            width: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            color: PANEL.btnIdle,
            cursor: 'pointer',
            padding: 0,
            borderRadius: 2,
            flexShrink: 0,
            fontSize: 'var(--tmnl-text-xs, 12px)',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.color = '#f43f5e'
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.1)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.color = PANEL.btnIdle
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          }}
        >
          ×
        </button>
      )}
    </div>
  )
})
