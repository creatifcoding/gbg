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

import { memo, useCallback, type ReactNode } from 'react'
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

/**
 * @deprecated Alt+P overlay toggle is now handled by centralized keyboard dispatch.
 * This hook is kept as a no-op for backward compatibility.
 */
function useOverlayHotkey() {
  // No-op — migrated to useKeyboardDispatch
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

    /** Reset all panel state to initial via stx.reset() + explicit Map clear */
    reset: () => {
      closePanelOverlay()
      const s = getFloatingStx()
      if (s) {
        // Legend State Map observable needs .clear() — .set(new Map()) doesn't propagate
        const panelsObs = (s.data as any).panels
        if (typeof panelsObs?.clear === 'function') panelsObs.clear()
        else if (typeof panelsObs?.set === 'function') panelsObs.set(new Map())
        s.reset()
      }
    },

    /** Snapshot: stx.snapshot() deep-resolves all Legend State observables. */
    snapshot: () => {
      const s = getFloatingStx()
      if (!s) return null

      // stx.snapshot() → { data, machine, computed } — all three layers
      const snap = s.snapshot() as any
      const data = snap.data
      const panelsMap = data.panels as Map<string, any> | undefined
      const strip = data.strip as any
      const activeId = data.activePanel as string | null

      // Materialize panels from Map
      type PInfo = { id: string; mode: string; isCollapsed: boolean }
      const pList: PInfo[] = []
      if (panelsMap && typeof panelsMap.forEach === 'function') {
        panelsMap.forEach((p: any) => pList.push({
          id: p?.id ?? '', mode: p?.mode ?? 'tiled', isCollapsed: !!p?.isCollapsed,
        }))
      }

      // Counts
      let tiled = 0, floating = 0, collapsed = 0, expanded = 0
      for (const p of pList) {
        if (p.mode === 'tiled') { tiled++; p.isCollapsed ? collapsed++ : expanded++ }
        else if (p.mode === 'floating') floating++
      }

      // Tree walker — Effect TaggedStruct uses _tag
      const collectIds = (node: any): string[] => {
        if (!node) return []
        if (node._tag === 'leaf') return [node.panelId]
        if (node._tag === 'split' && node.children) return (node.children as any[]).flatMap(collectIds)
        return []
      }

      // Column analysis
      const columns: any[] = strip?.columns ?? []
      let collapsedColumnCount = 0, colLevelCollapsed = 0
      for (const col of columns) {
        if (col?.isCollapsed) {
          collapsedColumnCount++
          colLevelCollapsed += collectIds(col.tree).length
        }
      }
      if (colLevelCollapsed > collapsed) { collapsed = colLevelCollapsed; expanded = tiled - collapsed }

      // Focus position
      let focusPosition = 'none'
      if (activeId) {
        for (let ci = 0; ci < columns.length; ci++) {
          const ids = collectIds(columns[ci]?.tree)
          const idx = ids.indexOf(activeId)
          if (idx >= 0) { focusPosition = ids.length === 1 ? `col:${ci}` : `col:${ci}/row:${idx}`; break }
        }
      }

      // Width of focused column
      let focusedColumnWidth = 'unknown'
      if (activeId) {
        for (const col of columns) {
          if (collectIds(col?.tree).includes(activeId)) { focusedColumnWidth = col.width ?? 'unknown'; break }
        }
      }

      return {
        totalPanels: pList.length, tiledCount: tiled, floatCount: floating,
        collapsedCount: collapsed, expandedCount: expanded,
        columnCount: columns.length, collapsedColumnCount,
        focusPosition, stripMode: 'unknown',
        overlayOpen: !!document.querySelector('[data-panel-workspace-overlay]'),
        focusedColumnWidth,
        raw: { activePanel: activeId, panelIds: pList.map(p => p.id) },
      }
    },
  }
}
