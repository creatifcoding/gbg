/**
 * SessionActor
 *
 * Per-user tab/window state persistence.
 * Each user gets their own session actor keyed by userId.
 *
 * Uses Effect Schema-validated wrapper to prevent Zod errors from leaking.
 *
 * @module lib/actors/actors/session
 */

import { validatedActor } from '../wrappers/actor'

// =============================================================================
// Types
// =============================================================================

/** Tab state in session */
export interface SessionTab {
  id: string
  name: string
  layout: unknown // PaneNode tree
  activeWindowId: string | null
  isPinned: boolean
  order: number
}

/** Window state in session */
export interface SessionWindow {
  id: string
  bufferId: string
  scroll: { x: number; y: number }
  mode: {
    major: string
    minor: string[]
  }
  isFocused: boolean
  cursor?: {
    offset: number
    line?: number
    column?: number
  }
}

/** Session actor state */
interface SessionState {
  tabs: Record<string, SessionTab>
  windows: Record<string, SessionWindow>
  activeTabId: string | null
  focusedWindowId: string | null
  tabOrder: string[]
}

// =============================================================================
// Actor Definition
// =============================================================================

export const session = validatedActor({
  state: {
    tabs: {},
    windows: {},
    activeTabId: null,
    focusedWindowId: null,
    tabOrder: [],
  } as SessionState,

  actions: {
    // =========================================================================
    // Tab Operations
    // =========================================================================

    /**
     * Create a new tab.
     */
    createTab: (c, name: string, options?: { layout?: unknown; isPinned?: boolean }) => {
      const id = `tab-${crypto.randomUUID().slice(0, 8)}`

      const tab: SessionTab = {
        id,
        name,
        layout: options?.layout ?? null,
        activeWindowId: null,
        isPinned: options?.isPinned ?? false,
        order: c.state.tabOrder.length,
      }

      c.state.tabs[id] = tab
      c.state.tabOrder.push(id)

      // Auto-activate if first tab
      if (!c.state.activeTabId) {
        c.state.activeTabId = id
      }

      c.broadcast('tabCreated', { tabId: id, tab })
      return tab
    },

    /**
     * Set the active tab.
     */
    setActiveTab: (c, tabId: string) => {
      if (!c.state.tabs[tabId]) {
        throw new Error(`Tab not found: ${tabId}`)
      }
      c.state.activeTabId = tabId
      c.broadcast('activeTabChanged', { tabId })
    },

    /**
     * Close a tab.
     */
    closeTab: (c, tabId: string) => {
      // Get windows in this tab (future: from layout)
      // For now, just remove the tab
      delete c.state.tabs[tabId]
      c.state.tabOrder = c.state.tabOrder.filter((id) => id !== tabId)

      // Update active tab if needed
      if (c.state.activeTabId === tabId) {
        c.state.activeTabId = c.state.tabOrder[0] ?? null
      }

      // Reorder remaining tabs
      c.state.tabOrder.forEach((id, index) => {
        if (c.state.tabs[id]) {
          c.state.tabs[id].order = index
        }
      })

      c.broadcast('tabClosed', { tabId })
    },

    /**
     * Update tab properties.
     */
    updateTab: (c, tabId: string, updates: Partial<Pick<SessionTab, 'name' | 'layout' | 'isPinned'>>) => {
      const tab = c.state.tabs[tabId]
      if (!tab) {
        throw new Error(`Tab not found: ${tabId}`)
      }

      if (updates.name !== undefined) tab.name = updates.name
      if (updates.layout !== undefined) tab.layout = updates.layout
      if (updates.isPinned !== undefined) tab.isPinned = updates.isPinned

      c.broadcast('tabUpdated', { tabId, updates })
      return tab
    },

    /**
     * Reorder tabs.
     */
    reorderTabs: (c, newOrder: string[]) => {
      c.state.tabOrder = newOrder
      newOrder.forEach((id, index) => {
        if (c.state.tabs[id]) {
          c.state.tabs[id].order = index
        }
      })
      c.broadcast('tabsReordered', { newOrder })
    },

    // =========================================================================
    // Window Operations
    // =========================================================================

    /**
     * Create a window for a buffer.
     */
    createWindow: (c, bufferId: string, majorMode = 'fundamental') => {
      const id = `win-${crypto.randomUUID().slice(0, 8)}`

      const window: SessionWindow = {
        id,
        bufferId,
        scroll: { x: 0, y: 0 },
        mode: { major: majorMode, minor: [] },
        isFocused: false,
      }

      c.state.windows[id] = window
      c.broadcast('windowCreated', { windowId: id, window })

      return window
    },

    /**
     * Focus a window.
     */
    focusWindow: (c, windowId: string) => {
      // Unfocus previous
      if (c.state.focusedWindowId && c.state.windows[c.state.focusedWindowId]) {
        c.state.windows[c.state.focusedWindowId].isFocused = false
      }

      // Focus new
      if (c.state.windows[windowId]) {
        c.state.windows[windowId].isFocused = true
        c.state.focusedWindowId = windowId
      }

      c.broadcast('windowFocused', { windowId })
    },

    /**
     * Update window state.
     */
    updateWindow: (
      c,
      windowId: string,
      updates: Partial<Pick<SessionWindow, 'scroll' | 'cursor' | 'mode'>>
    ) => {
      const window = c.state.windows[windowId]
      if (!window) {
        throw new Error(`Window not found: ${windowId}`)
      }

      if (updates.scroll) window.scroll = updates.scroll
      if (updates.cursor) window.cursor = updates.cursor
      if (updates.mode) window.mode = updates.mode

      c.broadcast('windowUpdated', { windowId, updates })
      return window
    },

    /**
     * Close a window.
     */
    closeWindow: (c, windowId: string) => {
      delete c.state.windows[windowId]

      if (c.state.focusedWindowId === windowId) {
        const remaining = Object.keys(c.state.windows)
        c.state.focusedWindowId = remaining[0] ?? null
      }

      c.broadcast('windowClosed', { windowId })
    },

    // =========================================================================
    // Persistence
    // =========================================================================

    /**
     * Get full session snapshot for persistence.
     */
    getSnapshot: (c) => ({
      tabs: c.state.tabs,
      windows: c.state.windows,
      activeTabId: c.state.activeTabId,
      focusedWindowId: c.state.focusedWindowId,
      tabOrder: c.state.tabOrder,
    }),

    /**
     * Restore session from snapshot.
     */
    restoreSnapshot: (c, snapshot: Partial<SessionState>) => {
      if (snapshot.tabs) c.state.tabs = snapshot.tabs
      if (snapshot.windows) c.state.windows = snapshot.windows
      if (snapshot.activeTabId !== undefined) c.state.activeTabId = snapshot.activeTabId
      if (snapshot.focusedWindowId !== undefined) c.state.focusedWindowId = snapshot.focusedWindowId
      if (snapshot.tabOrder) c.state.tabOrder = snapshot.tabOrder

      c.broadcast('sessionRestored', {})
    },

    /**
     * Clear session state.
     */
    clear: (c) => {
      c.state.tabs = {}
      c.state.windows = {}
      c.state.activeTabId = null
      c.state.focusedWindowId = null
      c.state.tabOrder = []

      c.broadcast('sessionCleared', {})
    },
  },
})
