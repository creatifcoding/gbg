/**
 * TiledPanel — panel shell for tiled mode.
 *
 * Decomposed: ChromeButton, CollapsedTiledStrip, TiledPanelHeader extracted.
 *
 * @module floating/layout/TiledPanel
 */

import { memo, useCallback, useState, type ReactNode } from 'react'
import { useSelector } from '@/lib/stx'
import { getFloatingStx } from '../floating-stx'
import { setFocusedPanel } from '../stx/actions'
import { PANEL } from '../tokens'
import { PanelContextMenu } from '../components/PanelContextMenu'
import { PanelSlot } from '@/lib/drawer'
import { PanelContentRenderer } from '../components/PanelContentRenderer'
import { CollapsedTiledStrip } from './CollapsedTiledStrip'
import { TiledPanelHeader } from './TiledPanelHeader'
import { PanelTabBar } from '../components/PanelTabBar'

// =============================================================================
// Props
// =============================================================================

export interface TiledPanelProps {
  id: string
  children?: ReactNode
  onFloat?: (id: string) => void
}

// =============================================================================
// Main Component
// =============================================================================

export const TiledPanel = memo(function TiledPanel({
  id,
  children,
  onFloat,
}: TiledPanelProps) {
  const panel = useSelector(() => getFloatingStx().data.panels.get(id)?.get())
  const isActive = useSelector(() => getFloatingStx().data.activePanel.get() === id)

  const handleFocus = useCallback(() => setFocusedPanel(id), [id])

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }, [])

  if (!panel) return null

  if (panel.isCollapsed) {
    return <CollapsedTiledStrip id={id} title={panel.title} accent={panel.accent} />
  }

  return (
    <div
      data-panel-id={id}
      data-panel-mode="tiled"
      data-panel-focused={isActive || undefined}
      onClick={handleFocus}
      onContextMenu={handleContextMenu}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: PANEL.bg,
        border: `1px solid ${PANEL.border}`,
        borderLeft: panel.accent ? `2px solid ${panel.accent}` : `1px solid ${PANEL.border}`,
        boxShadow: isActive
          ? `inset 0 0 0 1px ${PANEL.focusRing}, 0 0 0 1px ${PANEL.focusRing}`
          : `inset 0 0 0 1px rgba(255,255,255,0.02)`,
        overflow: 'hidden',
        transition: 'box-shadow 150ms ease-out',
      }}
    >
      <TiledPanelHeader
        id={id}
        title={panel.title}
        accent={panel.accent}
        headerHidden={panel.headerHidden ?? false}
        onFloat={onFloat}
      />
      <PanelTabBar panelId={id} />
      <div
        data-slot="tiled-panel-content"
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: 'auto',
          position: 'relative',
        }}
      >
        <PanelContentRenderer panelId={id}>
          {children}
        </PanelContentRenderer>
        <PanelSlot panelId={id} />
      </div>
      {ctxMenu && (
        <PanelContextMenu
          panelId={id}
          mode="tiled"
          position={ctxMenu}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
})
