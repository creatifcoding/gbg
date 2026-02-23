/**
 * PanelWorkspaceOverlay — persistent panel system overlay.
 *
 * Mount point: **Sibling to AppShell.Workspace** — same grid cell (row-2/col-2),
 * stacked above workspace content via z-index. Always mounted, never unmounts.
 *
 * Follows the Cursor pattern:
 *   - Always present in the DOM (panel state survives hide/show)
 *   - `pointer-events-none` when hidden → clicks pass through to workspace
 *   - `pointer-events-auto` when open → panels capture interaction
 *   - Toggled by atom + hotkey (Alt+P)
 *
 * Uses a dedicated Registry (panelOverlayRegistry) so imperative toggle
 * from sidebar/hotkey and React reads share the same atom state.
 *
 * Architecture in main.tsx:
 *   <AppShell>
 *     <AppShell.Header />                   ← z-50
 *     <AppShell.Sidebar />                  ← z-40
 *     <AppShell.Workspace> ... </AppShell.Workspace>
 *     <PanelWorkspaceOverlay>               ← z-30 (same grid cell as workspace)
 *       <PanelWorkspace />
 *     </PanelWorkspaceOverlay>
 *   </AppShell>
 *
 * Toggle from anywhere:
 *   import { togglePanelOverlay } from '@/lib/floating/overlay'
 *   togglePanelOverlay()
 *
 * @module floating/overlay
 */

import { memo, useCallback, useEffect, type ReactNode } from 'react'
import { RegistryContext, useAtomValue } from '@effect-atom/atom-react'
import { panelOverlayOpenAtom, panelOverlayRegistry } from './atom'
import { PANEL } from '../tokens'
import { getFloatingStx } from '../stx/instance'

// =============================================================================
// Public API — toggle/open/close from anywhere (uses registry)
// =============================================================================

export { panelOverlayOpenAtom, panelOverlayRegistry } from './atom'

export function togglePanelOverlay(): void {
  const current = panelOverlayRegistry.get(panelOverlayOpenAtom)
  panelOverlayRegistry.set(panelOverlayOpenAtom, !current)
}

export function openPanelOverlay(): void {
  panelOverlayRegistry.set(panelOverlayOpenAtom, true)
}

export function closePanelOverlay(): void {
  panelOverlayRegistry.set(panelOverlayOpenAtom, false)
}

// =============================================================================
// Global hotkey: Alt+P
// =============================================================================

function useOverlayHotkey() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'p' || e.key === 'P' || e.key === 'π')) {
        e.preventDefault()
        e.stopPropagation()
        togglePanelOverlay()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}

// =============================================================================
// Z-Index Constants
// =============================================================================

/** Panel overlay z-index: below header (z-50) and sidebar (z-40), above workspace */
const OVERLAY_Z_OPEN = 30
const OVERLAY_Z_CLOSED = -1

// =============================================================================
// Overlay Component
// =============================================================================

export interface PanelWorkspaceOverlayProps {
  /** Panel content (tiled layout + floating panels). */
  children?: ReactNode
}

/**
 * Panel workspace overlay — always mounted inside AppShell grid.
 *
 * Occupies the same grid cell as Workspace (row-2/col-2).
 * When closed: invisible, pointer-events-none (zero interaction cost).
 * When open: fills the cell, captures pointer events, renders panels.
 *
 * Wraps children in panelOverlayRegistry so useAtomValue reads
 * from the same registry that togglePanelOverlay() writes to.
 */
export const PanelWorkspaceOverlay = memo(function PanelWorkspaceOverlay({
  children,
}: PanelWorkspaceOverlayProps) {
  return (
    <RegistryContext.Provider value={panelOverlayRegistry}>
      <PanelWorkspaceOverlayInner>
        {children}
      </PanelWorkspaceOverlayInner>
    </RegistryContext.Provider>
  )
})

const PanelWorkspaceOverlayInner = memo(function PanelWorkspaceOverlayInner({
  children,
}: PanelWorkspaceOverlayProps) {
  const isOpen = useAtomValue(panelOverlayOpenAtom)

  // Register global hotkey
  useOverlayHotkey()

  return (
    <div
      data-panel-workspace-overlay
      data-panel-overlay-open={isOpen || undefined}
      style={{
        // Same grid cell as Workspace — stacked above via z-index
        gridRow: 2,
        gridColumn: 2,
        position: 'relative',
        zIndex: isOpen ? OVERLAY_Z_OPEN : OVERLAY_Z_CLOSED,

        // contain: paint creates a containing block for floating panels
        // (position: absolute children clip to this rect)
        contain: 'paint',

        // Always in DOM, but invisible + non-interactive when closed
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none',
        visibility: isOpen ? 'visible' : 'hidden',

        // Fill the grid cell
        width: '100%',
        height: '100%',
        overflow: 'hidden',

        // Layout
        display: 'flex',
        flexDirection: 'column',

        // Subtle backdrop
        background: isOpen
          ? 'oklch(0.13 0.005 250 / 0.92)'
          : 'transparent',

        // Entrance transition (200ms ease-out per Emil Kowalski)
        transition: 'opacity 200ms ease-out, visibility 200ms ease-out',
      }}
    >
      {children}
    </div>
  )
})

// =============================================================================
// Toggle Button — persistent affordance for header/sidebar
// =============================================================================

export const PanelOverlayToggle = memo(function PanelOverlayToggle() {
  // This component may render outside the registry provider,
  // so we subscribe directly to the registry
  const isOpen = panelOverlayRegistry.get(panelOverlayOpenAtom)

  const handleClick = useCallback(() => togglePanelOverlay(), [])

  return (
    <button
      type="button"
      title={`${isOpen ? 'Hide' : 'Show'} panel workspace (Alt+P)`}
      onClick={handleClick}
      data-panel-overlay-toggle
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        border: 'none',
        borderRadius: 6,
        background: isOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: isOpen ? PANEL.textStrong : PANEL.btnIdle,
        cursor: 'pointer',
        transition: 'background 150ms ease-out, color 150ms ease-out',
      }}
    >
      {/* Panels icon — 2×2 grid */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    </button>
  )
})

// =============================================================================
// Dev-mode test API — exposed on window for agent-browser E2E harness
// =============================================================================

if (import.meta.env.DEV) {
  ;(window as any).__PANEL_TEST__ = {
    toggle: togglePanelOverlay,
    open: openPanelOverlay,
    close: closePanelOverlay,
    isOpen: () => panelOverlayRegistry.get(panelOverlayOpenAtom),

    /** Reset all panel state to initial via stx.reset() — batch Legend State .set() */
    reset: () => {
      closePanelOverlay()
      const s = getFloatingStx()
      if (s) s.reset()
    },

    /** Snapshot current state for assertions. Returns plain JSON object (sync). */
    snapshot: () => {
      const s = getFloatingStx()
      if (!s) return null

      const d = s.data
      const peek = (field: string) => {
        const f = (d as any)[field]
        return (typeof f?.peek === 'function') ? f.peek() : f
      }

      const panelsMap = peek('panels') as Map<string, any> | null
      const strip = peek('strip') as any
      const activeId = peek('activePanel') as string | null
      const zOrder = peek('zOrder') as string[]

      // Materialize panels
      type PInfo = { id: string; mode: string; isCollapsed: boolean }
      const panels: PInfo[] = []
      if (panelsMap && typeof panelsMap.forEach === 'function') {
        panelsMap.forEach((p: any) => {
          const get = (obj: any, key: string) => {
            const v = obj[key]
            return (v && typeof v.peek === 'function') ? v.peek() : v
          }
          panels.push({ id: get(p, 'id'), mode: get(p, 'mode'), isCollapsed: get(p, 'isCollapsed') })
        })
      }

      // Counts
      let tiled = 0, floating = 0, collapsed = 0, expanded = 0
      for (const p of panels) {
        if (p.mode === 'tiled') { tiled++; p.isCollapsed ? collapsed++ : expanded++ }
        else if (p.mode === 'floating') floating++
      }

      // Column analysis
      const collectIds = (node: any): string[] => {
        if (!node) return []
        const n = (typeof node.peek === 'function') ? node.peek() : node
        if (n.type === 'leaf') return [n.panelId]
        if (n.children) return (n.children as any[]).flatMap(collectIds)
        return []
      }

      const columns = strip?.columns ?? []
      let collapsedColumnCount = 0
      for (const col of columns) {
        const c = (typeof col.peek === 'function') ? col.peek() : col
        const ids = collectIds(c.tree)
        if (ids.length > 0 && ids.every(id => panels.find(p => p.id === id)?.isCollapsed))
          collapsedColumnCount++
      }

      // Focus position
      let focusPosition = 'none'
      if (activeId) {
        for (let ci = 0; ci < columns.length; ci++) {
          const c = (typeof columns[ci].peek === 'function') ? columns[ci].peek() : columns[ci]
          const ids = collectIds(c.tree)
          const idx = ids.indexOf(activeId)
          if (idx >= 0) {
            focusPosition = ids.length === 1 ? `col:${ci}` : `col:${ci}/row:${idx}`
            break
          }
        }
      }

      // Width of focused column
      let focusedColumnWidth = 'unknown'
      if (activeId) {
        for (const col of columns) {
          const c = (typeof col.peek === 'function') ? col.peek() : col
          if (collectIds(c.tree).includes(activeId)) { focusedColumnWidth = c.width ?? 'unknown'; break }
        }
      }

      return {
        totalPanels: panels.length,
        tiledCount: tiled,
        floatCount: floating,
        collapsedCount: collapsed,
        expandedCount: expanded,
        columnCount: columns.length,
        collapsedColumnCount,
        focusPosition,
        stripMode: 'unknown',
        overlayOpen: !!document.querySelector('[data-panel-workspace-overlay]'),
        focusedColumnWidth,
        raw: { activePanel: activeId, zOrderLen: Array.isArray(zOrder) ? zOrder.length : 0, panelIds: panels.map(p => p.id) },
      }
    },
  }
}
