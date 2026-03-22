/**
 * Interaction state — drag/resize flags, modifier keys, snap/grid, tabs.
 *
 * @module floating/stx/interaction
 */

import { batch } from '@/lib/stx'
import type { ModifierKeys } from '../types'
import { getFloatingStx } from './instance'

/** Update modifier keys (Shift/Ctrl/Alt) */
export function updateModifierKeys(keys: Partial<ModifierKeys>): void {
  const stx = getFloatingStx()
  const current = stx.data.modifierKeys.peek()
  stx.data.modifierKeys.set({ ...current, ...keys })
}

/** Set dragging state for a panel */
export function setDragging(id: string, isDragging: boolean): void {
  const stx = getFloatingStx()
  batch(() => {
    stx.data.panels.get(id)?.isDragging.set(isDragging)
    stx.data.draggingPanel.set(isDragging ? id : null)
  })
}

/** Set resizing state for a panel */
export function setResizing(id: string, isResizing: boolean): void {
  const stx = getFloatingStx()
  batch(() => {
    stx.data.panels.get(id)?.isResizing.set(isResizing)
    stx.data.resizingPanel.set(isResizing ? id : null)
  })
}

/** Set snap-to-grid size (0 = disabled) */
export function setGridSize(size: number): void {
  getFloatingStx().data.gridSize.set(Math.max(0, size))
}

/** Toggle snap-to-grid on/off */
export function toggleSnap(): void {
  const stx = getFloatingStx()
  stx.data.snapEnabled.set(!stx.data.snapEnabled.peek())
}

/** Set snap enabled state */
export function setSnapEnabled(enabled: boolean): void {
  getFloatingStx().data.snapEnabled.set(enabled)
}

/**
 * Nest a panel as a tab inside a host panel.
 * The tabbed panel becomes a "ghost" — mode: 'tabbed', removed from
 * tiled tree and zOrder. Host renders its content.
 */
export function nestPanelAsTab(hostId: string, guestId: string): void {
  const stx = getFloatingStx()
  const hostObs = stx.data.panels.get(hostId)
  const guestObs = stx.data.panels.get(guestId)
  if (!hostObs?.peek() || !guestObs?.peek()) return

  const host = hostObs.peek()!
  const currentTabs = host.tabs ?? []
  if (currentTabs.includes(guestId)) return // already tabbed

  batch(() => {
    // Add guest to host's tabs and activate it
    hostObs.tabs.set([...currentTabs, guestId])
    hostObs.activeTabId.set(guestId)

    // Ghost the guest panel
    guestObs.mode.set('tabbed' as any)
    guestObs.hostPanelId.set(hostId)

    // Remove guest from zOrder (floating panels)
    const zOrder = stx.data.zOrder.peek() ?? []
    if (zOrder.includes(guestId)) {
      stx.data.zOrder.set(zOrder.filter((id: string) => id !== guestId))
    }
  })
}

/**
 * Lift a tabbed panel out of its host. The ghost becomes a real panel again.
 * Returns the lifted panel ID for the caller to float/tile as needed.
 */
export function liftTabOut(hostId: string, guestId: string): void {
  const stx = getFloatingStx()
  const hostObs = stx.data.panels.get(hostId)
  const guestObs = stx.data.panels.get(guestId)
  if (!hostObs?.peek() || !guestObs?.peek()) return

  const host = hostObs.peek()!
  const tabs = (host.tabs ?? []).filter((t: string) => t !== guestId)

  batch(() => {
    // Remove from host tabs
    hostObs.tabs.set(tabs)
    if (host.activeTabId === guestId) {
      hostObs.activeTabId.set(tabs[tabs.length - 1] ?? hostId)
    }

    // Un-ghost the guest
    guestObs.hostPanelId.set(undefined)
    // Mode will be set by the caller (floatPanel/tilePanel)
  })
}

/**
 * Transfer a tab from one host to another.
 */
export function transferTab(fromHostId: string, toHostId: string, guestId: string): void {
  const stx = getFloatingStx()
  const fromObs = stx.data.panels.get(fromHostId)
  const toObs = stx.data.panels.get(toHostId)
  if (!fromObs?.peek() || !toObs?.peek()) return

  const from = fromObs.peek()!
  const to = toObs.peek()!

  const fromTabs = (from.tabs ?? []).filter((t: string) => t !== guestId)
  const toTabs = [...(to.tabs ?? []), guestId]

  batch(() => {
    // Remove from source
    fromObs.tabs.set(fromTabs)
    if (from.activeTabId === guestId) {
      fromObs.activeTabId.set(fromTabs[fromTabs.length - 1] ?? fromHostId)
    }

    // Add to destination
    toObs.tabs.set(toTabs)
    toObs.activeTabId.set(guestId)

    // Update guest's host ref
    stx.data.panels.get(guestId)?.hostPanelId.set(toHostId)
  })
}

/** Add a tab to a panel (legacy compat — wraps nestPanelAsTab) */
export function addTab(panelId: string, tabId: string): void {
  nestPanelAsTab(panelId, tabId)
}

/** Remove a tab from a panel (legacy compat — wraps liftTabOut) */
export function removeTab(panelId: string, tabId: string): void {
  liftTabOut(panelId, tabId)
}

/** Set the active tab in a panel */
export function setActiveTab(panelId: string, tabId: string): void {
  getFloatingStx().data.panels.get(panelId)?.activeTabId.set(tabId)
}

/** Reorder tabs within a panel */
export function reorderTabs(panelId: string, tabIds: string[]): void {
  getFloatingStx().data.panels.get(panelId)?.tabs.set(tabIds)
}

/** Rename a panel (tab title) */
export function renamePanel(panelId: string, newTitle: string): void {
  const trimmed = newTitle.trim()
  if (!trimmed) return
  getFloatingStx().data.panels.get(panelId)?.title.set(trimmed)
}
