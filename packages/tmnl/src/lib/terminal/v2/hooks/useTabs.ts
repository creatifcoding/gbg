/**
 * useTabs Hook
 *
 * React hook for tab/pane management with Effect operations.
 * Ported from infinitty's TabsContext with Atom-as-State doctrine.
 */

import { useCallback, useEffect } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { Effect } from 'effect'
import type {
  Tab,
  PaneNode,
  SplitDirection,
  TerminalViewMode,
  PinnedTabIcon,
  TabColor,
} from '../schemas/tabs'
import {
  // State atoms
  tabsAtom,
  activeTabIdAtom,
  activePaneIdAtom,
  // Derived atoms
  activeTabAtom,
  activePaneAtom,
  pinnedTabsAtom,
  unpinnedTabsAtom,
  tabCountAtom,
  // Operations
  initializeTabsOp,
  saveSessionOp,
  createNewTabOp,
  createWebViewTabOp,
  createWidgetTabOp,
  createEditorTabOp,
  closeTabOp,
  setActiveTabOp,
  reorderTabsOp,
  updateTabTitleOp,
  pinTabOp,
  unpinTabOp,
  togglePinTabOp,
  updatePinnedTabStyleOp,
  updateTabStyleOp,
  splitPaneOp,
  closePaneOp,
  setActivePaneOp,
  resizeSplitOp,
  updateTerminalViewModeOp,
} from '../atoms/tabs'

// =============================================================================
// Hook Return Type
// =============================================================================

export interface UseTabsResult {
  // State
  tabs: readonly Tab[]
  activeTabId: string | null
  activePaneId: string | null
  activeTab: Tab | null
  activePane: PaneNode | null
  pinnedTabs: readonly Tab[]
  unpinnedTabs: readonly Tab[]
  tabCount: number

  // Tab Operations
  createNewTab: (title?: string, cwd?: string) => Promise<Tab>
  createWebViewTab: (url: string, title?: string) => Promise<Tab>
  createWidgetTab: (widgetType: string, title?: string, config?: Record<string, unknown>) => Promise<Tab>
  createEditorTab: (filePath: string, title?: string, isReadOnly?: boolean) => Promise<Tab>
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  updateTabTitle: (tabId: string, title: string) => void

  // Pin Operations
  pinTab: (tabId: string) => void
  unpinTab: (tabId: string) => void
  togglePinTab: (tabId: string) => void
  updatePinnedTabStyle: (
    tabId: string,
    icon?: PinnedTabIcon,
    color?: TabColor,
    backgroundColor?: TabColor
  ) => void
  updateTabStyle: (tabId: string, color?: TabColor, backgroundColor?: TabColor) => void

  // Pane Operations
  splitPane: (paneId: string, direction: SplitDirection) => void
  closePane: (paneId: string) => void
  setActivePane: (paneId: string) => void
  resizeSplit: (splitId: string, ratio: number) => void
  updateTerminalViewMode: (paneId: string, viewMode: TerminalViewMode) => void

  // Getters (for compatibility with infinitty API)
  getActiveTab: () => Tab | null
  getActivePane: () => PaneNode | null
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useTabs(): UseTabsResult {
  // Subscribe to state atoms
  const tabs = useAtomValue(tabsAtom)
  const activeTabId = useAtomValue(activeTabIdAtom)
  const activePaneId = useAtomValue(activePaneIdAtom)
  const activeTab = useAtomValue(activeTabAtom)
  const activePane = useAtomValue(activePaneAtom)
  const pinnedTabs = useAtomValue(pinnedTabsAtom)
  const unpinnedTabs = useAtomValue(unpinnedTabsAtom)
  const tabCount = useAtomValue(tabCountAtom)

  // Initialize on mount
  useEffect(() => {
    Effect.runPromise(initializeTabsOp)
  }, [])

  // Auto-save on changes
  useEffect(() => {
    if (tabs.length > 0) {
      Effect.runSync(saveSessionOp)
    }
  }, [tabs, activeTabId])

  // Tab Operations
  const createNewTab = useCallback(
    async (title?: string, cwd?: string): Promise<Tab> => {
      return Effect.runPromise(createNewTabOp(title, cwd))
    },
    []
  )

  const createWebViewTab = useCallback(
    async (url: string, title?: string): Promise<Tab> => {
      return Effect.runPromise(createWebViewTabOp(url, title))
    },
    []
  )

  const createWidgetTab = useCallback(
    async (
      widgetType: string,
      title?: string,
      config?: Record<string, unknown>
    ): Promise<Tab> => {
      return Effect.runPromise(createWidgetTabOp(widgetType, title, config))
    },
    []
  )

  const createEditorTab = useCallback(
    async (filePath: string, title?: string, isReadOnly?: boolean): Promise<Tab> => {
      return Effect.runPromise(createEditorTabOp(filePath, title, isReadOnly))
    },
    []
  )

  const closeTab = useCallback((tabId: string) => {
    Effect.runSync(closeTabOp(tabId))
  }, [])

  const setActiveTab = useCallback((tabId: string) => {
    Effect.runSync(setActiveTabOp(tabId))
  }, [])

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    Effect.runSync(reorderTabsOp(fromIndex, toIndex))
  }, [])

  const updateTabTitle = useCallback((tabId: string, title: string) => {
    Effect.runSync(updateTabTitleOp(tabId, title))
  }, [])

  // Pin Operations
  const pinTab = useCallback((tabId: string) => {
    Effect.runSync(pinTabOp(tabId))
  }, [])

  const unpinTab = useCallback((tabId: string) => {
    Effect.runSync(unpinTabOp(tabId))
  }, [])

  const togglePinTab = useCallback((tabId: string) => {
    Effect.runPromise(togglePinTabOp(tabId))
  }, [])

  const updatePinnedTabStyle = useCallback(
    (
      tabId: string,
      icon?: PinnedTabIcon,
      color?: TabColor,
      backgroundColor?: TabColor
    ) => {
      Effect.runSync(updatePinnedTabStyleOp(tabId, icon, color, backgroundColor))
    },
    []
  )

  const updateTabStyle = useCallback(
    (tabId: string, color?: TabColor, backgroundColor?: TabColor) => {
      Effect.runSync(updateTabStyleOp(tabId, color, backgroundColor))
    },
    []
  )

  // Pane Operations
  const splitPane = useCallback((paneId: string, direction: SplitDirection) => {
    Effect.runSync(splitPaneOp(paneId, direction))
  }, [])

  const closePane = useCallback((paneId: string) => {
    Effect.runSync(closePaneOp(paneId))
  }, [])

  const setActivePane = useCallback((paneId: string) => {
    Effect.runSync(setActivePaneOp(paneId))
  }, [])

  const resizeSplit = useCallback((splitId: string, ratio: number) => {
    Effect.runSync(resizeSplitOp(splitId, ratio))
  }, [])

  const updateTerminalViewMode = useCallback(
    (paneId: string, viewMode: TerminalViewMode) => {
      Effect.runSync(updateTerminalViewModeOp(paneId, viewMode))
    },
    []
  )

  // Getter functions (for infinitty API compatibility)
  const getActiveTab = useCallback((): Tab | null => activeTab, [activeTab])
  const getActivePane = useCallback((): PaneNode | null => activePane, [activePane])

  return {
    // State
    tabs,
    activeTabId,
    activePaneId,
    activeTab,
    activePane,
    pinnedTabs,
    unpinnedTabs,
    tabCount,

    // Tab Operations
    createNewTab,
    createWebViewTab,
    createWidgetTab,
    createEditorTab,
    closeTab,
    setActiveTab,
    reorderTabs,
    updateTabTitle,

    // Pin Operations
    pinTab,
    unpinTab,
    togglePinTab,
    updatePinnedTabStyle,
    updateTabStyle,

    // Pane Operations
    splitPane,
    closePane,
    setActivePane,
    resizeSplit,
    updateTerminalViewMode,

    // Getters
    getActiveTab,
    getActivePane,
  }
}
