/**
 * Code Editor Atoms
 *
 * Atom-as-State for the Monaco code editor.
 * Following AGENTS.md: Atom.make() as primary state, React subscribes directly.
 * Service methods mutate atoms directly via Atom.set/Atom.update.
 *
 * @module code-editor/atoms
 */

import { Atom } from '@effect-atom/atom'
import { nanoid } from 'nanoid'
import type {
  EditorState,
  EditorConfig,
  StatusLineState,
  LspStatus,
  EditorTab,
  TabId,
  EditorLayout,
} from './schemas'
import { DEFAULT_EDITOR_CONFIG } from './schemas'

// =============================================================================
// Core State Atoms
// =============================================================================

/** Root editor state — tabs, active tab, layout */
export const editorStateAtom = Atom.make<EditorState>({
  tabs: [],
  activeTabId: null,
  layout: 'single' as const,
})

/** Editor configuration — user preferences */
export const editorConfigAtom = Atom.make<EditorConfig>(DEFAULT_EDITOR_CONFIG)

/** LSP connection status per language */
export const lspStatusAtom = Atom.make<Record<string, LspStatus>>({})

/** Status line state — drives the bottom bar */
export const statusLineAtom = Atom.make<StatusLineState>({
  cursor: { line: 1, column: 1 },
  language: 'plaintext',
  encoding: 'UTF-8',
  indentStyle: 'spaces' as const,
  tabSize: 2,
  lspStatus: 'disconnected' as const,
  vimMode: 'normal',
  selectionCount: 0,
})

// =============================================================================
// Derived Atoms (read-only)
// =============================================================================

/** The currently active tab (or null) */
export const activeTabAtom = Atom.make((get) => {
  const state = get(editorStateAtom)
  if (!state.activeTabId) return null
  return state.tabs.find((t) => t.id === state.activeTabId) ?? null
})

/** Just the tabs array */
export const tabsAtom = Atom.make((get) => {
  return get(editorStateAtom).tabs
})

/** Whether there are any dirty (unsaved) tabs */
export const hasDirtyTabsAtom = Atom.make((get) => {
  return get(editorStateAtom).tabs.some((t) => t.dirty)
})

/** Count of open tabs */
export const tabCountAtom = Atom.make((get) => {
  return get(editorStateAtom).tabs.length
})

// =============================================================================
// Tab Operations (atom mutations)
// =============================================================================

/**
 * Open a new tab (or activate existing if URI already open)
 */
export const openTab = (uri: string, language: string, label: string) => {
  Atom.update(editorStateAtom, (state) => {
    // If tab already open for this URI, just activate it
    const existing = state.tabs.find((t) => t.uri === uri)
    if (existing) {
      return { ...state, activeTabId: existing.id }
    }

    // Create new tab
    const newTab: EditorTab = {
      _tag: 'EditorTab',
      id: nanoid() as TabId,
      uri,
      language,
      label,
      dirty: false,
      pinned: false,
    }

    return {
      ...state,
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id,
    }
  })
}

/**
 * Close a tab by ID
 */
export const closeTab = (id: TabId) => {
  Atom.update(editorStateAtom, (state) => {
    const idx = state.tabs.findIndex((t) => t.id === id)
    if (idx === -1) return state

    const newTabs = state.tabs.filter((t) => t.id !== id)

    // If we closed the active tab, activate the nearest neighbor
    let newActiveId = state.activeTabId
    if (state.activeTabId === id) {
      if (newTabs.length === 0) {
        newActiveId = null
      } else {
        const newIdx = Math.min(idx, newTabs.length - 1)
        newActiveId = newTabs[newIdx].id
      }
    }

    return { ...state, tabs: newTabs, activeTabId: newActiveId }
  })
}

/**
 * Set the active tab
 */
export const setActiveTab = (id: TabId) => {
  Atom.update(editorStateAtom, (state) => ({
    ...state,
    activeTabId: id,
  }))
}

/**
 * Mark a tab as dirty (unsaved changes)
 */
export const markDirty = (id: TabId, dirty: boolean) => {
  Atom.update(editorStateAtom, (state) => ({
    ...state,
    tabs: state.tabs.map((t) => (t.id === id ? { ...t, dirty } : t)),
  }))
}

/**
 * Pin/unpin a tab
 */
export const togglePin = (id: TabId) => {
  Atom.update(editorStateAtom, (state) => ({
    ...state,
    tabs: state.tabs.map((t) =>
      t.id === id ? { ...t, pinned: !t.pinned } : t,
    ),
  }))
}

/**
 * Close all tabs except pinned ones
 */
export const closeAllTabs = () => {
  Atom.update(editorStateAtom, (state) => {
    const remaining = state.tabs.filter((t) => t.pinned)
    return {
      ...state,
      tabs: remaining,
      activeTabId: remaining.length > 0 ? remaining[0].id : null,
    }
  })
}

/**
 * Set editor layout mode
 */
export const setLayout = (layout: EditorLayout) => {
  Atom.update(editorStateAtom, (state) => ({
    ...state,
    layout,
  }))
}

// =============================================================================
// Status Line Operations
// =============================================================================

/** Update cursor position */
export const setCursor = (line: number, column: number) => {
  Atom.update(statusLineAtom, (s) => ({
    ...s,
    cursor: { line, column },
  }))
}

/** Update selection count */
export const setSelectionCount = (count: number) => {
  Atom.update(statusLineAtom, (s) => ({
    ...s,
    selectionCount: count,
  }))
}

/** Update language */
export const setLanguage = (language: string) => {
  Atom.update(statusLineAtom, (s) => ({
    ...s,
    language,
  }))
}

/** Update vim mode */
export const setVimMode = (mode: StatusLineState['vimMode']) => {
  Atom.update(statusLineAtom, (s) => ({
    ...s,
    vimMode: mode,
  }))
}

// =============================================================================
// Config Operations
// =============================================================================

/** Toggle vim mode */
export const toggleVimMode = () => {
  Atom.update(editorConfigAtom, (c) => ({
    ...c,
    vimMode: !c.vimMode,
  }))
}

/** Update font size */
export const setFontSize = (size: number) => {
  Atom.update(editorConfigAtom, (c) => ({
    ...c,
    fontSize: Math.max(8, Math.min(72, size)),
  }))
}

/** Toggle minimap */
export const toggleMinimap = () => {
  Atom.update(editorConfigAtom, (c) => ({
    ...c,
    minimap: !c.minimap,
  }))
}

/** Toggle word wrap */
export const toggleWordWrap = () => {
  Atom.update(editorConfigAtom, (c) => ({
    ...c,
    wordWrap: !c.wordWrap,
  }))
}
