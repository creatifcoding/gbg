/**
 * PanelContextMenu — right-click context menus for panels
 *
 * SM §3.5.1:
 *   Tiled: New File, Close Panel, Float, Split New, Set Accent
 *   Floating: Close Panel, Dock
 *
 * Renders as an absolutely-positioned overlay. Closes on click outside
 * or Escape key.
 *
 * @module
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { PANEL } from '../tokens'
import {
  floatPanel,
  tilePanel,
  closePanel,
  setPanelAccent,
  setPanelCollapsed,
  setPanelVisibility,
  maximizePanel,
  restorePanel,
  minimizePanel,
} from '../stx/actions'
import { getFloatingStx } from '../floating-stx'
import { type MenuItem, type MenuEntry, ACCENT_COLORS } from './context-menu-items'

// =============================================================================
// Context Menu Overlay
// =============================================================================

export interface PanelContextMenuProps {
  /** Panel ID */
  panelId: string
  /** Current panel mode */
  mode: string
  /** Position to render the menu */
  position: { x: number; y: number }
  /** Close callback */
  onClose: () => void
}

export const PanelContextMenu = memo(function PanelContextMenu({
  panelId,
  mode,
  position,
  onClose,
}: PanelContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [showAccentSubmenu, setShowAccentSubmenu] = useState(false)

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const items: MenuEntry[] = mode === 'tiled'
    ? [
        { label: 'Float as window', action: () => { floatPanel(panelId); onClose() } },
        { label: 'Collapse', action: () => { setPanelCollapsed(panelId, true); onClose() } },
        { separator: true },
        { label: 'Set accent...', action: () => setShowAccentSubmenu(!showAccentSubmenu) },
        { separator: true },
        { label: 'Close panel', action: () => { setPanelVisibility(panelId, 'hidden'); onClose() }, danger: true },
      ]
    : (() => {
        const panelState = getFloatingStx().data.panels.get(panelId)?.peek()
        const isMaximized = panelState?.isMaximized ?? false
        return [
          { label: isMaximized ? 'Restore' : 'Maximize', action: () => { isMaximized ? restorePanel(panelId) : maximizePanel(panelId); onClose() } },
          { label: 'Minimize', action: () => { minimizePanel(panelId); onClose() } },
          { label: 'Dock to side', action: () => { tilePanel(panelId); onClose() } },
          { separator: true as const },
          { label: 'Set accent...', action: () => setShowAccentSubmenu(!showAccentSubmenu) },
          { separator: true as const },
          { label: 'Close panel', action: () => { closePanel(panelId); onClose() }, danger: true },
        ] as MenuEntry[]
      })()

  return (
    <div
      ref={menuRef}
      data-kb-modal
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 99999,
        minWidth: 180,
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
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            {(item as MenuItem).label}
          </button>
        ),
      )}

      {/* Accent submenu */}
      {showAccentSubmenu && (
        <div
          style={{
            padding: '4px 0',
            borderTop: `1px solid ${PANEL.border}`,
          }}
        >
          {ACCENT_COLORS.map(({ label, color }) => (
            <button
              key={label}
              type="button"
              onClick={() => { setPanelAccent(panelId, color); onClose() }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 16px',
                border: 'none',
                background: 'transparent',
                color: PANEL.text,
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 'inherit',
                fontFamily: 'inherit',
                letterSpacing: '0.04em',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              {color && (
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: color, flexShrink: 0,
                }} />
              )}
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

// =============================================================================
// Hook: usePanelContextMenu
// =============================================================================

export function usePanelContextMenu() {
  const [menuState, setMenuState] = useState<{
    panelId: string
    mode: string
    position: { x: number; y: number }
  } | null>(null)

  const openMenu = useCallback((panelId: string, mode: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuState({ panelId, mode, position: { x: e.clientX, y: e.clientY } })
  }, [])

  const closeMenu = useCallback(() => setMenuState(null), [])

  return { menuState, openMenu, closeMenu }
}
