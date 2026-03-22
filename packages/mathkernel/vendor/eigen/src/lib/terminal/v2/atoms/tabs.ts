/**
 * Tabs Atoms
 *
 * Atom-as-State pattern for tab/pane management.
 * Effect operations for mutations.
 *
 * CRITICAL: Uses overlayRegistry for synchronous operations to match
 * the React context provided by OverlayRegistryProvider in main.tsx.
 */

import { Atom } from '@effect-atom/atom-react'
import { Effect } from 'effect'
import { overlayRegistry } from '@/lib/overlays'
import type {
  Tab,
  PaneNode,
  SplitDirection,
  TerminalViewMode,
  PinnedTabIcon,
  TabColor,
  TerminalPane,
} from '../schemas/tabs'
import {
  createTab,
  createTerminalPane,
  createWebViewPane,
  createWidgetPane,
  createEditorPane,
  createSplitPane,
  generateTabId,
  generatePaneId,
  getAllTerminalPanes,
  getAllContentPanes,
  replacePane,
  removePane,
  isTerminalPane,
  isSplitPane,
  findPane,
  isContentPane,
} from '../schemas/tabs'
import { disposeTerminal } from '../hooks/useXterm'

// =============================================================================
// Storage Key
// =============================================================================

const STORAGE_KEY = 'tmnl-terminal-tabs'

// =============================================================================
// Core State Atoms
// =============================================================================

/** All tabs */
export const tabsAtom = Atom.make<readonly Tab[]>([])

/** Active tab ID */
export const activeTabIdAtom = Atom.make<string | null>(null)

/** Active pane ID */
export const activePaneIdAtom = Atom.make<string | null>(null)

// =============================================================================
// Registry Initialization
// =============================================================================
// CRITICAL: Initialize all atoms in overlayRegistry with their default values.
// Without this, atoms read from overlayRegistry return undefined.

overlayRegistry.set(tabsAtom, [])
overlayRegistry.set(activeTabIdAtom, null)
overlayRegistry.set(activePaneIdAtom, null)

// =============================================================================
// Derived Atoms
// =============================================================================

/** Number of tabs */
export const tabCountAtom = Atom.make((get) => {
  const tabs = get(tabsAtom) ?? []
  return Array.isArray(tabs) ? tabs.length : 0
})

/** Active tab */
export const activeTabAtom = Atom.make((get) => {
  const tabs = get(tabsAtom) ?? []
  if (!Array.isArray(tabs)) return null
  const activeId = get(activeTabIdAtom)
  return tabs.find((t) => t.id === activeId) ?? null
})

/** Active pane */
export const activePaneAtom = Atom.make((get) => {
  const tab = get(activeTabAtom)
  const paneId = get(activePaneIdAtom)
  if (!tab || !paneId) return null
  return findPane(tab.root, paneId)
})

/** Pinned tabs */
export const pinnedTabsAtom = Atom.make((get) => {
  const tabs = get(tabsAtom) ?? []
  return Array.isArray(tabs) ? tabs.filter((t) => t.isPinned) : []
})

/** Unpinned tabs */
export const unpinnedTabsAtom = Atom.make((get) => {
  const tabs = get(tabsAtom) ?? []
  return Array.isArray(tabs) ? tabs.filter((t) => !t.isPinned) : []
})

// =============================================================================
// Session Persistence
// =============================================================================

interface SerializedPane {
  _tag: string
  id?: string
  title?: string
  cwd?: string
  url?: string
  widgetType?: string
  config?: Record<string, unknown>
  filePath?: string
  language?: string
  isReadOnly?: boolean
  direction?: SplitDirection
  ratio?: number
  first?: SerializedPane
  second?: SerializedPane
  viewMode?: TerminalViewMode
}

interface SerializedTab {
  title: string
  root: SerializedPane
  isPinned: boolean
  pinIcon?: PinnedTabIcon
  pinColor?: TabColor
  pinBackgroundColor?: TabColor
  tabColor?: TabColor
  tabBackgroundColor?: TabColor
  resourcePath?: string
}

interface SerializedSession {
  version: 1
  tabs: SerializedTab[]
  activeTabIndex: number
}

function serializePane(pane: PaneNode): SerializedPane {
  switch (pane._tag) {
    case 'TerminalPane':
      return { _tag: 'TerminalPane', title: pane.title, cwd: pane.cwd, viewMode: pane.viewMode }
    case 'WebViewPane':
      return { _tag: 'WebViewPane', title: pane.title, url: pane.url }
    case 'WidgetPane':
      return { _tag: 'WidgetPane', title: pane.title, widgetType: pane.widgetType, config: pane.config }
    case 'EditorPane':
      return { _tag: 'EditorPane', title: pane.title, filePath: pane.filePath, language: pane.language, isReadOnly: pane.isReadOnly }
    case 'SplitPane':
      return {
        _tag: 'SplitPane',
        direction: pane.direction,
        ratio: pane.ratio,
        first: serializePane(pane.first),
        second: serializePane(pane.second),
      }
  }
}

function deserializePane(serialized: SerializedPane): PaneNode {
  switch (serialized._tag) {
    case 'TerminalPane':
      return createTerminalPane(
        generatePaneId(),
        serialized.title || 'Terminal',
        serialized.cwd,
        serialized.viewMode
      )
    case 'WebViewPane':
      return createWebViewPane(
        generatePaneId(),
        serialized.title || 'Web',
        serialized.url || 'about:blank'
      )
    case 'WidgetPane':
      return createWidgetPane(
        generatePaneId(),
        serialized.title || 'Widget',
        serialized.widgetType || 'unknown',
        serialized.config
      )
    case 'EditorPane':
      return createEditorPane(
        generatePaneId(),
        serialized.title || 'Editor',
        serialized.filePath || '',
        serialized.language,
        serialized.isReadOnly
      )
    case 'SplitPane':
      return createSplitPane(
        generatePaneId(),
        serialized.direction || 'horizontal',
        deserializePane(serialized.first!),
        deserializePane(serialized.second!),
        serialized.ratio ?? 0.5
      )
    default:
      // Fallback to terminal
      return createTerminalPane(generatePaneId(), 'Terminal')
  }
}

// =============================================================================
// Effect Operations
// =============================================================================

/** Save session to localStorage */
export const saveSessionOp: Effect.Effect<void> = Effect.sync(() => {
  try {
    const tabs = overlayRegistry.get(tabsAtom)
    const activeTabId = overlayRegistry.get(activeTabIdAtom)
    const activeTabIndex = tabs.findIndex((t) => t.id === activeTabId)

    const session: SerializedSession = {
      version: 1,
      tabs: tabs.map((tab) => ({
        title: tab.title,
        root: serializePane(tab.root),
        isPinned: tab.isPinned,
        pinIcon: tab.pinIcon,
        pinColor: tab.pinColor,
        pinBackgroundColor: tab.pinBackgroundColor,
        tabColor: tab.tabColor,
        tabBackgroundColor: tab.tabBackgroundColor,
        resourcePath: tab.resourcePath,
      })),
      activeTabIndex: activeTabIndex >= 0 ? activeTabIndex : 0,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch (error) {
    console.warn('[Tabs] Failed to save session:', error)
  }
})

/** Load session from localStorage */
export const loadSessionOp: Effect.Effect<boolean> = Effect.sync(() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return false

    const session: SerializedSession = JSON.parse(stored)

    if (
      session.version !== 1 ||
      !Array.isArray(session.tabs) ||
      session.tabs.length === 0
    ) {
      return false
    }

    const tabs: Tab[] = session.tabs.map((serializedTab, index) => {
      const tabId = generateTabId()
      const root = deserializePane(serializedTab.root)
      return {
        id: tabId,
        title: serializedTab.title,
        root,
        isActive: index === session.activeTabIndex,
        order: index,
        isPinned: serializedTab.isPinned ?? false,
        pinIcon: serializedTab.pinIcon,
        pinColor: serializedTab.pinColor,
        pinBackgroundColor: serializedTab.pinBackgroundColor,
        tabColor: serializedTab.tabColor,
        tabBackgroundColor: serializedTab.tabBackgroundColor,
        resourcePath: serializedTab.resourcePath,
      }
    })

    const activeTabIndex = Math.max(0, Math.min(session.activeTabIndex, tabs.length - 1))
    const activeTab = tabs[activeTabIndex]
    const firstPane = getAllTerminalPanes(activeTab.root)[0]

    overlayRegistry.set(tabsAtom, tabs)
    overlayRegistry.set(activeTabIdAtom, activeTab.id)
    overlayRegistry.set(activePaneIdAtom, firstPane?.id ?? activeTab.root.id)

    return true
  } catch (error) {
    console.warn('[Tabs] Failed to load session:', error)
    return false
  }
})

/** Initialize tabs - load from storage or create default */
export const initializeTabsOp: Effect.Effect<void> = Effect.gen(function* () {
  const loaded = yield* loadSessionOp
  if (!loaded) {
    // Create default tab
    const initialTab = createTab(generateTabId(), 'Terminal 1')
    const firstPane = getAllTerminalPanes(initialTab.root)[0]
    overlayRegistry.set(tabsAtom, [initialTab])
    overlayRegistry.set(activeTabIdAtom, initialTab.id)
    overlayRegistry.set(activePaneIdAtom, firstPane?.id ?? null)
  }
})

/** Create a new terminal tab */
export const createNewTabOp = (title?: string, cwd?: string): Effect.Effect<Tab> =>
  Effect.sync(() => {
    const tabs = overlayRegistry.get(tabsAtom)
    const newTab = createTab(
      generateTabId(),
      title ?? `Terminal ${tabs.length + 1}`,
      cwd
    )
    newTab.order = tabs.length

    const updatedTabs = [
      ...tabs.map((t) => ({ ...t, isActive: false })),
      { ...newTab, isActive: true },
    ]

    overlayRegistry.set(tabsAtom, updatedTabs)
    overlayRegistry.set(activeTabIdAtom, newTab.id)

    const firstPane = getAllTerminalPanes(newTab.root)[0]
    if (firstPane) overlayRegistry.set(activePaneIdAtom, firstPane.id)

    return newTab
  })

/** Create a webview tab */
export const createWebViewTabOp = (url: string, title?: string): Effect.Effect<Tab> =>
  Effect.sync(() => {
    const tabs = overlayRegistry.get(tabsAtom)
    const paneId = generatePaneId()
    const webViewPane = createWebViewPane(paneId, title ?? 'Web', url)

    const newTab: Tab = {
      id: generateTabId(),
      title: title ?? new URL(url).hostname,
      root: webViewPane,
      isActive: true,
      order: tabs.length,
      isPinned: false,
    }

    const updatedTabs = [
      ...tabs.map((t) => ({ ...t, isActive: false })),
      newTab,
    ]

    overlayRegistry.set(tabsAtom, updatedTabs)
    overlayRegistry.set(activeTabIdAtom, newTab.id)
    overlayRegistry.set(activePaneIdAtom, paneId)

    return newTab
  })

/** Create a widget tab */
export const createWidgetTabOp = (
  widgetType: string,
  title?: string,
  config?: Record<string, unknown>
): Effect.Effect<Tab> =>
  Effect.sync(() => {
    const tabs = overlayRegistry.get(tabsAtom)
    const paneId = generatePaneId()
    const widgetPane = createWidgetPane(paneId, title ?? widgetType, widgetType, config)

    const newTab: Tab = {
      id: generateTabId(),
      title: title ?? widgetType.charAt(0).toUpperCase() + widgetType.slice(1),
      root: widgetPane,
      isActive: true,
      order: tabs.length,
      isPinned: false,
    }

    const updatedTabs = [
      ...tabs.map((t) => ({ ...t, isActive: false })),
      newTab,
    ]

    overlayRegistry.set(tabsAtom, updatedTabs)
    overlayRegistry.set(activeTabIdAtom, newTab.id)
    overlayRegistry.set(activePaneIdAtom, paneId)

    return newTab
  })

/** Create an editor tab */
export const createEditorTabOp = (
  filePath: string,
  title?: string,
  isReadOnly?: boolean
): Effect.Effect<Tab> =>
  Effect.sync(() => {
    const tabs = overlayRegistry.get(tabsAtom)
    const paneId = generatePaneId()
    const fileName = filePath.split('/').pop() || filePath
    const editorPane = createEditorPane(paneId, title ?? fileName, filePath, undefined, isReadOnly)

    const newTab: Tab = {
      id: generateTabId(),
      title: title ?? fileName,
      root: editorPane,
      isActive: true,
      order: tabs.length,
      isPinned: false,
    }

    const updatedTabs = [
      ...tabs.map((t) => ({ ...t, isActive: false })),
      newTab,
    ]

    overlayRegistry.set(tabsAtom, updatedTabs)
    overlayRegistry.set(activeTabIdAtom, newTab.id)
    overlayRegistry.set(activePaneIdAtom, paneId)

    return newTab
  })

/** Close a tab */
export const closeTabOp = (tabId: string): Effect.Effect<void> =>
  Effect.sync(() => {
    const tabs = overlayRegistry.get(tabsAtom)
    const activeTabId = overlayRegistry.get(activeTabIdAtom)

    // Dispose all terminal panes in the tab being closed
    const tabToClose = tabs.find((t) => t.id === tabId)
    if (tabToClose) {
      const terminalPanes = getAllTerminalPanes(tabToClose.root)
      for (const pane of terminalPanes) {
        disposeTerminal(pane.id)
      }
    }

    const filtered = tabs.filter((t) => t.id !== tabId)

    if (filtered.length === 0) {
      // Don't close the last tab, create a new one
      const newTab = createTab(generateTabId(), 'Terminal 1')
      overlayRegistry.set(tabsAtom, [newTab])
      overlayRegistry.set(activeTabIdAtom, newTab.id)
      const firstPane = getAllTerminalPanes(newTab.root)[0]
      if (firstPane) overlayRegistry.set(activePaneIdAtom, firstPane.id)
      return
    }

    // If we closed the active tab, activate another
    if (tabId === activeTabId) {
      const closedIndex = tabs.findIndex((t) => t.id === tabId)
      const newActiveIndex = Math.min(closedIndex, filtered.length - 1)
      const newActive = filtered[newActiveIndex]
      overlayRegistry.set(activeTabIdAtom, newActive.id)
      const firstPane = getAllTerminalPanes(newActive.root)[0]
      if (firstPane) overlayRegistry.set(activePaneIdAtom, firstPane.id)
    }

    const currentActiveId = overlayRegistry.get(activeTabIdAtom)
    overlayRegistry.set(
      tabsAtom,
      filtered.map((t, i) => ({
        ...t,
        isActive: t.id === currentActiveId,
        order: i,
      }))
    )
  })

/** Set active tab */
export const setActiveTabOp = (tabId: string): Effect.Effect<void> =>
  Effect.sync(() => {
    const tabs = overlayRegistry.get(tabsAtom)
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return

    overlayRegistry.set(activeTabIdAtom, tabId)
    overlayRegistry.set(
      tabsAtom,
      tabs.map((t) => ({ ...t, isActive: t.id === tabId }))
    )

    // Set active pane to first pane in the tab
    const allPanes = getAllContentPanes(tab.root)
    const firstPane = allPanes[0]
    if (firstPane) {
      overlayRegistry.set(activePaneIdAtom, firstPane.id)
    }
  })

/** Reorder tabs */
export const reorderTabsOp = (fromIndex: number, toIndex: number): Effect.Effect<void> =>
  Effect.sync(() => {
    const tabs = [...overlayRegistry.get(tabsAtom)]
    const [moved] = tabs.splice(fromIndex, 1)
    tabs.splice(toIndex, 0, moved)
    overlayRegistry.set(
      tabsAtom,
      tabs.map((t, i) => ({ ...t, order: i }))
    )
  })

/** Update tab title */
export const updateTabTitleOp = (tabId: string, title: string): Effect.Effect<void> =>
  Effect.sync(() => {
    const tabs = overlayRegistry.get(tabsAtom)
    overlayRegistry.set(
      tabsAtom,
      tabs.map((t) => (t.id === tabId ? { ...t, title } : t))
    )
  })

/** Pin a tab */
export const pinTabOp = (tabId: string): Effect.Effect<void> =>
  Effect.sync(() => {
    const tabs = overlayRegistry.get(tabsAtom)
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab || tab.isPinned) return

    const pinnedTabs = tabs.filter((t) => t.isPinned)
    const unpinnedTabs = tabs.filter((t) => !t.isPinned && t.id !== tabId)

    overlayRegistry.set(
      tabsAtom,
      [...pinnedTabs, { ...tab, isPinned: true }, ...unpinnedTabs].map((t, i) => ({
        ...t,
        order: i,
      }))
    )
  })

/** Unpin a tab */
export const unpinTabOp = (tabId: string): Effect.Effect<void> =>
  Effect.sync(() => {
    const tabs = overlayRegistry.get(tabsAtom)
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab || !tab.isPinned) return

    const pinnedTabs = tabs.filter((t) => t.isPinned && t.id !== tabId)
    const unpinnedTabs = tabs.filter((t) => !t.isPinned)

    overlayRegistry.set(
      tabsAtom,
      [...pinnedTabs, { ...tab, isPinned: false }, ...unpinnedTabs].map((t, i) => ({
        ...t,
        order: i,
      }))
    )
  })

/** Toggle pin state */
export const togglePinTabOp = (tabId: string): Effect.Effect<void> =>
  Effect.gen(function* () {
    const tabs = overlayRegistry.get(tabsAtom)
    const tab = tabs.find((t) => t.id === tabId)
    if (tab?.isPinned) {
      yield* unpinTabOp(tabId)
    } else {
      yield* pinTabOp(tabId)
    }
  })

/** Update pinned tab style */
export const updatePinnedTabStyleOp = (
  tabId: string,
  icon?: PinnedTabIcon,
  color?: TabColor,
  backgroundColor?: TabColor
): Effect.Effect<void> =>
  Effect.sync(() => {
    const tabs = overlayRegistry.get(tabsAtom)
    overlayRegistry.set(
      tabsAtom,
      tabs.map((t) => {
        if (t.id !== tabId || !t.isPinned) return t
        return {
          ...t,
          pinIcon: icon,
          pinColor: color,
          pinBackgroundColor: backgroundColor,
        }
      })
    )
  })

/** Update tab style */
export const updateTabStyleOp = (
  tabId: string,
  color?: TabColor,
  backgroundColor?: TabColor
): Effect.Effect<void> =>
  Effect.sync(() => {
    const tabs = overlayRegistry.get(tabsAtom)
    overlayRegistry.set(
      tabsAtom,
      tabs.map((t) => {
        if (t.id !== tabId) return t
        return {
          ...t,
          tabColor: color,
          tabBackgroundColor: backgroundColor,
        }
      })
    )
  })

/** Split a pane */
export const splitPaneOp = (paneId: string, direction: SplitDirection): Effect.Effect<void> =>
  Effect.sync(() => {
    const activeTabId = overlayRegistry.get(activeTabIdAtom)
    const tabs = overlayRegistry.get(tabsAtom)

    let newPaneId: string | null = null
    const updatedTabs = tabs.map((tab) => {
      if (tab.id !== activeTabId) return tab

      const allPanes = getAllTerminalPanes(tab.root)
      const paneToSplit = allPanes.find((p) => p.id === paneId)
      if (!paneToSplit) return tab

      const newPane = createTerminalPane(
        generatePaneId(),
        `Terminal ${allPanes.length + 1}`,
        paneToSplit.cwd
      )
      newPaneId = newPane.id

      const newSplit = createSplitPane(
        generatePaneId(),
        direction,
        { ...paneToSplit, isActive: false },
        newPane,
        0.5
      )

      const newRoot = replacePane(tab.root, paneId, newSplit)
      return { ...tab, root: newRoot }
    })

    overlayRegistry.set(tabsAtom, updatedTabs)
    if (newPaneId) {
      overlayRegistry.set(activePaneIdAtom, newPaneId)
    }
  })

/** Close a pane */
export const closePaneOp = (paneId: string): Effect.Effect<void> =>
  Effect.sync(() => {
    const activeTabId = overlayRegistry.get(activeTabIdAtom)
    const activePaneId = overlayRegistry.get(activePaneIdAtom)
    const tabs = overlayRegistry.get(tabsAtom)

    const updatedTabs = tabs.map((tab) => {
      if (tab.id !== activeTabId) return tab

      const allPanes = getAllTerminalPanes(tab.root)
      if (allPanes.length <= 1) {
        // Can't close the last pane
        return tab
      }

      // Dispose terminal resources before removing pane
      const paneToClose = findPane(tab.root, paneId)
      if (paneToClose && isTerminalPane(paneToClose)) {
        disposeTerminal(paneId)
      }

      const newRoot = removePane(tab.root, paneId)
      if (!newRoot) return tab

      // If we closed the active pane, activate another
      if (paneId === activePaneId) {
        const remainingPanes = getAllTerminalPanes(newRoot)
        if (remainingPanes.length > 0) {
          overlayRegistry.set(activePaneIdAtom, remainingPanes[0].id)
        }
      }

      return { ...tab, root: newRoot }
    })

    overlayRegistry.set(tabsAtom, updatedTabs)
  })

/** Set active pane */
export const setActivePaneOp = (paneId: string): Effect.Effect<void> =>
  Effect.sync(() => {
    overlayRegistry.set(activePaneIdAtom, paneId)
  })

/** Resize a split */
export const resizeSplitOp = (splitId: string, ratio: number): Effect.Effect<void> =>
  Effect.sync(() => {
    const activeTabId = overlayRegistry.get(activeTabIdAtom)
    const tabs = overlayRegistry.get(tabsAtom)

    overlayRegistry.set(
      tabsAtom,
      tabs.map((tab) => {
        if (tab.id !== activeTabId) return tab

        const updateSplitRatio = (node: PaneNode): PaneNode => {
          if (isSplitPane(node)) {
            if (node.id === splitId) {
              return { ...node, ratio: Math.max(0.1, Math.min(0.9, ratio)) }
            }
            return {
              ...node,
              first: updateSplitRatio(node.first),
              second: updateSplitRatio(node.second),
            }
          }
          return node
        }

        return { ...tab, root: updateSplitRatio(tab.root) }
      })
    )
  })

/** Update terminal view mode */
export const updateTerminalViewModeOp = (
  paneId: string,
  viewMode: TerminalViewMode
): Effect.Effect<void> =>
  Effect.sync(() => {
    const tabs = overlayRegistry.get(tabsAtom)
    overlayRegistry.set(
      tabsAtom,
      tabs.map((tab) => {
        const updateViewMode = (node: PaneNode): PaneNode => {
          if (isTerminalPane(node) && node.id === paneId) {
            return { ...node, viewMode }
          }
          if (isSplitPane(node)) {
            return {
              ...node,
              first: updateViewMode(node.first),
              second: updateViewMode(node.second),
            }
          }
          return node
        }

        return { ...tab, root: updateViewMode(tab.root) }
      })
    )
  })
