/**
 * TabContextMenu — per-tab right-click context menu
 *
 * Actions:
 *   - Rename (all tabs)
 *   - Float as panel (ghost tabs only)
 *   - Close tab (ghost tabs only)
 *
 * @module floating/components/TabContextMenu
 */

import { memo, useEffect, useRef } from 'react'
import { PANEL } from '../tokens'
import { liftTabOut, floatPanel, renamePanel } from '../stx/actions'
import type { MenuEntry, MenuItem } from './context-menu-items'

export interface TabContextMenuProps {
  tabId: string
  hostPanelId: string
  isHome: boolean
  position: { x: number; y: number }
  onClose: () => void
  onRename: () => void
}

export const TabContextMenu = memo(function TabContextMenu({
  tabId,
  hostPanelId,
  isHome,
  position,
  onClose,
  onRename,
}: TabContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay listener to avoid catching the triggering right-click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const items: MenuEntry[] = [
    {
      label: 'Rename',
      action: () => {
        onRename()
        onClose()
      },
    },
    ...(!isHome ? [
      { separator: true as const },
      {
        label: 'Float as panel',
        action: () => {
          liftTabOut(hostPanelId, tabId)
          floatPanel(tabId)
          onClose()
        },
      },
      { separator: true as const },
      {
        label: 'Close tab',
        action: () => {
          liftTabOut(hostPanelId, tabId)
          floatPanel(tabId)
          onClose()
        },
        danger: true,
      },
    ] : []),
  ]

  return (
    <div
      ref={menuRef}
      data-kb-modal
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 99999,
        minWidth: 160,
        background: PANEL.bg,
        border: `1px solid ${PANEL.border}`,
        borderRadius: 8,
        padding: '4px 0',
        boxShadow: PANEL.floatGlow,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {items.map((item, i) =>
        'separator' in item && item.separator ? (
          <div key={i} style={{ height: 1, background: PANEL.border, margin: '4px 8px' }} />
        ) : (
          <button
            key={i}
            type="button"
            onClick={(item as MenuItem).action}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '6px 12px',
              border: 'none',
              background: 'transparent',
              color: (item as MenuItem).danger ? '#f43f5e' : PANEL.text,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 'inherit',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {(item as MenuItem).label}
          </button>
        ),
      )}
    </div>
  )
})
