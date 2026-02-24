/**
 * SortableTabItem v2 — individual draggable tab with:
 *   - Data payload for type-based drag discrimination
 *   - Double-click inline rename
 *   - Expanded close hitbox (20×20) with hover-only visibility
 *   - Right-click context menu delegation
 *   - Active underline with motion.dev layoutId animation
 *
 * @module floating/layout/SortableTabItem
 */

import { memo, useCallback, useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'motion/react'
import { PANEL } from '../tokens'
import type { Tab } from './TabBar'

// =============================================================================
// Types
// =============================================================================

export interface SortableTabItemProps {
  tab: Tab
  hostPanelId: string
  isActive: boolean
  onClick?: (id: string) => void
  onClose?: (id: string) => void
  onRename?: (id: string, newTitle: string) => void
  onContextMenu?: (id: string, event: React.MouseEvent) => void
}

// =============================================================================
// Component
// =============================================================================

export const SortableTabItem = memo(function SortableTabItem({
  tab,
  hostPanelId,
  isActive,
  onClick,
  onClose,
  onRename,
  onContextMenu,
}: SortableTabItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [hovered, setHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ─── Sortable with data payload ────────────────────────────────
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `tab:${hostPanelId}:${tab.id}`,
    data: {
      type: 'tab' as const,
      hostPanelId,
      tabId: tab.id,
      label: tab.label,
    },
    disabled: isEditing, // Disable drag while renaming
  })

  // ─── Handlers ──────────────────────────────────────────────────
  const handleClick = useCallback(() => {
    if (!isEditing) onClick?.(tab.id)
  }, [tab.id, onClick, isEditing])

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onClose?.(tab.id)
  }, [tab.id, onClose])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsEditing(true)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu?.(tab.id, e)
  }, [tab.id, onContextMenu])

  // ─── Rename commit / cancel ────────────────────────────────────
  const commitRename = useCallback(() => {
    const value = inputRef.current?.value.trim()
    if (value && value !== tab.label) {
      onRename?.(tab.id, value)
    }
    setIsEditing(false)
  }, [tab.id, tab.label, onRename])

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation() // Don't trigger keyboard nav
    if (e.key === 'Enter') {
      commitRename()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }, [commitRename])

  // Auto-focus + select all on edit start
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // ─── Styles ────────────────────────────────────────────────────
  const sortStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const showClose = (hovered || isActive) && tab.closable !== false && onClose

  return (
    <div
      ref={setNodeRef}
      {...(isEditing ? {} : attributes)}
      {...(isEditing ? {} : listeners)}
      data-drag-item={tab.id}
      data-tab-id={tab.id}
      data-tab-active={isActive || undefined}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...sortStyle,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 8px 0 10px',
        height: '100%',
        cursor: isEditing ? 'text' : 'pointer',
        background: isActive ? PANEL.tabBg : 'transparent',
        borderRight: `1px solid ${PANEL.border}`,
        color: isActive ? PANEL.textStrong : PANEL.text,
        fontSize: 'var(--tmnl-text-xs, 12px)',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        fontWeight: isActive ? 500 : 400,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: 200,
        minWidth: 60,
        userSelect: isEditing ? 'text' : 'none',
        position: 'relative',
        transition: 'background 100ms ease-out, color 100ms ease-out',
      }}
    >
      {/* ── Label or rename input ──────────────────────────────── */}
      {isEditing ? (
        <input
          ref={inputRef}
          defaultValue={tab.label}
          onBlur={commitRename}
          onKeyDown={handleInputKeyDown}
          onPointerDown={e => e.stopPropagation()}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${PANEL.accentCyan}`,
            borderRadius: 2,
            color: PANEL.textStrong,
            fontSize: 'var(--tmnl-text-xs, 12px)',
            fontFamily: 'inherit',
            padding: '1px 4px',
            outline: 'none',
            width: '100%',
            minWidth: 0,
            letterSpacing: '0.04em',
          }}
        />
      ) : (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
          {tab.label}
        </span>
      )}

      {/* ── Close button (hover-only, expanded 20×20 hitbox) ─── */}
      {tab.closable !== false && onClose && (
        <button
          type="button"
          onClick={handleClose}
          aria-label={`Close ${tab.label}`}
          style={{
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            color: PANEL.btnIdle,
            cursor: 'pointer',
            padding: 2,
            borderRadius: 3,
            flexShrink: 0,
            fontSize: 'var(--tmnl-text-xs, 12px)',
            opacity: showClose ? 1 : 0,
            pointerEvents: showClose ? 'auto' : 'none',
            transition: 'opacity 120ms ease-out, color 120ms ease-out, background 120ms ease-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#f43f5e'
            e.currentTarget.style.background = 'rgba(244,63,94,0.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = PANEL.btnIdle
            e.currentTarget.style.background = 'transparent'
          }}
        >
          ×
        </button>
      )}

      {/* ── Active underline — layoutId slides between tabs ──── */}
      {isActive && (
        <motion.div
          layoutId={`tab-underline-${hostPanelId}`}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            background: PANEL.accentCyan,
            borderRadius: '1px 1px 0 0',
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 35,
          }}
        />
      )}
    </div>
  )
})
