/**
 * PanelTabBar — tab strip where tabs ARE panels.
 *
 * Architecture (ghost model):
 *   - Host panel's `tabs[]` contains panel IDs of nested "ghost" panels
 *   - Ghost panels: mode='tabbed', hostPanelId set, not in tree/zOrder
 *   - Home tab: the host panel's own content (always first, not closable)
 *   - Switching tabs changes which panel's content the host renders
 *   - Drag a tab out → liftTabOut + floatPanel (context-aware)
 *   - Drag a panel onto tab bar → nestPanelAsTab (cross-panel transfer)
 *   - "+" button → opens VisitorPalette (cmdk picker)
 *
 * @module floating/components/PanelTabBar
 */

import { memo, useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'framer-motion'
import { useSelector } from '@/lib/stx'
import { getFloatingStx } from '../floating-stx'
import {
  setActiveTab,
  liftTabOut,
  reorderTabs,
  floatPanel,
} from '../stx/actions'
import { TabBar, type Tab } from '../layout/TabBar'
import { VisitorPalette } from './VisitorPalette'

// =============================================================================
// Types
// =============================================================================

export interface PanelTabBarProps {
  /** Host panel ID */
  panelId: string
  /** Right-side slot (chrome buttons, etc.) */
  rightSlot?: React.ReactNode
}

// =============================================================================
// Component
// =============================================================================

export const PanelTabBar = memo(function PanelTabBar({ panelId, rightSlot }: PanelTabBarProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const addBtnRef = useRef<HTMLButtonElement>(null)

  // ─── Read host panel state ────────────────────────────────────
  const hostState = useSelector(() => {
    const p = getFloatingStx().data.panels.get(panelId)?.get()
    if (!p) return null
    return {
      title: p.title,
      tabs: p.tabs ?? [],
      activeTabId: p.activeTabId,
    }
  })

  // ─── Read each ghost panel's title from stx ───────────────────
  const tabPanelTitles = useSelector(() => {
    const stx = getFloatingStx()
    const host = stx.data.panels.get(panelId)?.peek()
    if (!host) return {} as Record<string, string>
    const result: Record<string, string> = {}
    for (const tabId of (host.tabs ?? [])) {
      const tp = stx.data.panels.get(tabId)?.peek()
      result[tabId] = tp?.title ?? tabId
    }
    return result
  })

  // ─── Handlers (stable — no state in deps) ────────────────────
  const handleTabClick = useCallback((tabId: string) => {
    setActiveTab(panelId, tabId)
  }, [panelId])

  const handleTabClose = useCallback((tabId: string) => {
    if (tabId === panelId) return
    liftTabOut(panelId, tabId)
    floatPanel(tabId)
  }, [panelId])

  const handleTabReorder = useCallback((tabIds: string[]) => {
    const ghostIds = tabIds.filter(id => id !== panelId)
    reorderTabs(panelId, ghostIds)
  }, [panelId])

  // Stable close — no inline closure recreation
  const closePalette = useCallback(() => setPaletteOpen(false), [])

  const handleNewTab = useCallback(() => {
    setPaletteOpen(prev => !prev)
  }, [])

  // ─── Compute anchor rect on demand (defer reads to usage point) ──
  // Coordinates relative to [data-panel-workspace-overlay] — the palette
  // portals there to escape the panel's overflow:hidden
  function getAnchorRect(): { left: number; bottom: number } {
    const btn = addBtnRef.current
    if (!btn) return { left: 0, bottom: 36 }

    const overlay = btn.closest('[data-panel-workspace-overlay]') as HTMLElement | null
    if (!overlay) return { left: 0, bottom: 36 }

    const btnRect = btn.getBoundingClientRect()
    const overlayRect = overlay.getBoundingClientRect()

    return {
      left: btnRect.left - overlayRect.left,
      bottom: btnRect.bottom - overlayRect.top,
    }
  }

  // ─── Bail if no panel state ───────────────────────────────────
  if (!hostState) return null

  // ─── Build tab list: home + ghosts ────────────────────────────
  const homeTab: Tab = {
    id: panelId,
    label: hostState.title,
    active: (hostState.activeTabId ?? panelId) === panelId,
    closable: false,
  }

  const ghostTabs: Tab[] = hostState.tabs.map(tabId => ({
    id: tabId,
    label: tabPanelTitles[tabId] ?? tabId,
    active: hostState.activeTabId === tabId,
    closable: true,
  }))

  const allTabs = [homeTab, ...ghostTabs]
  const activeId = hostState.activeTabId ?? panelId

  // Portal into the overlay container — escapes panel's overflow:hidden
  const portalTarget = typeof document !== 'undefined'
    ? document.querySelector('[data-panel-workspace-overlay]')
    : null

  return (
    <>
      <TabBar
        tabs={allTabs}
        activeTabId={activeId}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        onTabReorder={handleTabReorder}
        onNewTab={handleNewTab}
        addButtonRef={addBtnRef}
        rightSlot={rightSlot}
      />
      {portalTarget && createPortal(
        <AnimatePresence>
          {paletteOpen && (
            <VisitorPalette
              key="visitor-palette"
              hostPanelId={panelId}
              anchorRect={getAnchorRect()}
              onClose={closePalette}
            />
          )}
        </AnimatePresence>,
        portalTarget,
      )}
    </>
  )
})
