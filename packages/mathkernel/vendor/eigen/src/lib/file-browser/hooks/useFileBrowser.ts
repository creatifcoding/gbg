/**
 * useFileBrowser Hook
 *
 * Primary hook for FileBrowser state and operations.
 * Use this outside the compound component hierarchy.
 *
 * @module file-browser/hooks
 */

import { useAtomValue, useSetAtom } from '@effect-atom/atom-react'
import { useCallback } from 'react'
import * as Result from '@effect-atom/atom/Result'

import {
  // State atoms
  currentPathAtom,
  selectedFilesAtom,
  viewModeAtom,
  sortOrderAtom,
  filterPatternAtom,
  showHiddenAtom,
  isLoadingAtom,
  focusedFileAtom,
  directoryContentsAtom,
  historyAtom,
  clipboardAtom,
  inspectorTabAtom,
  inspectorExpandedAtom,
  // Derived atoms
  filteredEntriesAtom,
  selectionInfoAtom,
  selectedFileAtom,
  entryStatsAtom,
  breadcrumbsAtom,
  canGoBackAtom,
  canGoForwardAtom,
  canGoUpAtom,
  isInitialLoadAtom,
  hasErrorAtom,
  errorMessageAtom,
  // Operations
  navigationOps,
  selectionOps,
  clipboardOps,
  fileOps,
  type ViewMode,
} from '../atoms'
import type { SortOrder } from '../schemas'

/**
 * Hook return type
 */
export interface UseFileBrowserReturn {
  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────

  /** Current directory path */
  currentPath: string
  /** Selected file IDs */
  selectedFiles: ReadonlySet<string>
  /** View mode (list or icons) */
  viewMode: ViewMode
  /** Sort order */
  sortOrder: SortOrder
  /** Filter pattern */
  filterPattern: string
  /** Show hidden files */
  showHidden: boolean
  /** Is loading */
  isLoading: boolean
  /** Currently focused file ID */
  focusedFile: string | null
  /** Navigation history */
  history: { past: readonly string[]; future: readonly string[] }
  /** Clipboard state */
  clipboard: { paths: readonly string[]; operation: 'copy' | 'cut' } | null
  /** Inspector active tab */
  inspectorTab: 'BRIEFING' | 'META' | 'SPEC'
  /** Inspector expanded sections */
  inspectorExpanded: ReadonlySet<string>

  // ─────────────────────────────────────────────────────────────────────────
  // Derived State
  // ─────────────────────────────────────────────────────────────────────────

  /** Filtered and sorted entries */
  entries: readonly ReturnType<typeof filteredEntriesAtom['init']>
  /** Selection info */
  selectionInfo: {
    count: number
    hasSelection: boolean
    isSingle: boolean
    isMultiple: boolean
  }
  /** First selected file (for inspector) */
  selectedFile: ReturnType<typeof selectedFileAtom['init']>
  /** Entry stats */
  entryStats: {
    total: number
    files: number
    directories: number
    totalSize: number
  }
  /** Breadcrumb segments */
  breadcrumbs: readonly { name: string; path: string }[]
  /** Can navigate back */
  canGoBack: boolean
  /** Can navigate forward */
  canGoForward: boolean
  /** Can navigate up */
  canGoUp: boolean
  /** Is initial load (no data yet) */
  isInitialLoad: boolean
  /** Has error */
  hasError: boolean
  /** Error message */
  errorMessage: string | null

  // ─────────────────────────────────────────────────────────────────────────
  // Navigation Operations
  // ─────────────────────────────────────────────────────────────────────────

  /** Navigate to path */
  navigate: (path: string) => Promise<void>
  /** Go back in history */
  goBack: () => Promise<void>
  /** Go forward in history */
  goForward: () => Promise<void>
  /** Go up to parent */
  goUp: () => Promise<void>
  /** Refresh current directory */
  refresh: () => Promise<void>

  // ─────────────────────────────────────────────────────────────────────────
  // Selection Operations
  // ─────────────────────────────────────────────────────────────────────────

  /** Select single file */
  select: (id: string) => Promise<void>
  /** Toggle file selection */
  toggleSelect: (id: string) => Promise<void>
  /** Select all files */
  selectAll: () => Promise<void>
  /** Clear selection */
  clearSelection: () => Promise<void>
  /** Range select (shift+click) */
  rangeSelect: (id: string) => Promise<void>

  // ─────────────────────────────────────────────────────────────────────────
  // Clipboard Operations
  // ─────────────────────────────────────────────────────────────────────────

  /** Copy selected to clipboard */
  copy: () => Promise<void>
  /** Cut selected to clipboard */
  cut: () => Promise<void>
  /** Paste from clipboard */
  paste: () => Promise<void>

  // ─────────────────────────────────────────────────────────────────────────
  // File Operations
  // ─────────────────────────────────────────────────────────────────────────

  /** Delete selected files */
  deleteSelected: () => Promise<void>
  /** Create new directory */
  createDirectory: (name: string) => Promise<void>
  /** Rename file */
  rename: (path: string, newName: string) => Promise<void>

  // ─────────────────────────────────────────────────────────────────────────
  // View Operations
  // ─────────────────────────────────────────────────────────────────────────

  /** Set view mode */
  setViewMode: (mode: ViewMode) => void
  /** Set sort order */
  setSortOrder: (order: SortOrder) => void
  /** Set filter pattern */
  setFilterPattern: (pattern: string) => void
  /** Set show hidden */
  setShowHidden: (show: boolean) => void
  /** Set inspector tab */
  setInspectorTab: (tab: 'BRIEFING' | 'META' | 'SPEC') => void
  /** Toggle inspector section */
  toggleInspectorSection: (section: string) => void
}

/**
 * Primary hook for FileBrowser
 *
 * Provides full access to state, derived state, and operations.
 *
 * @example
 * ```tsx
 * function MyFileBrowser() {
 *   const fb = useFileBrowser()
 *
 *   useEffect(() => {
 *     fb.navigate('/home')
 *   }, [])
 *
 *   return (
 *     <div>
 *       <p>Path: {fb.currentPath}</p>
 *       <p>Files: {fb.entries.length}</p>
 *     </div>
 *   )
 * }
 * ```
 */
export function useFileBrowser(): UseFileBrowserReturn {
  // ─────────────────────────────────────────────────────────────────────────
  // State Subscriptions
  // ─────────────────────────────────────────────────────────────────────────

  const currentPath = useAtomValue(currentPathAtom)
  const selectedFiles = useAtomValue(selectedFilesAtom)
  const viewMode = useAtomValue(viewModeAtom)
  const sortOrder = useAtomValue(sortOrderAtom)
  const filterPattern = useAtomValue(filterPatternAtom)
  const showHidden = useAtomValue(showHiddenAtom)
  const isLoading = useAtomValue(isLoadingAtom)
  const focusedFile = useAtomValue(focusedFileAtom)
  const history = useAtomValue(historyAtom)
  const clipboard = useAtomValue(clipboardAtom)
  const inspectorTab = useAtomValue(inspectorTabAtom)
  const inspectorExpanded = useAtomValue(inspectorExpandedAtom)

  // Derived
  const entries = useAtomValue(filteredEntriesAtom)
  const selectionInfo = useAtomValue(selectionInfoAtom)
  const selectedFile = useAtomValue(selectedFileAtom)
  const entryStats = useAtomValue(entryStatsAtom)
  const breadcrumbs = useAtomValue(breadcrumbsAtom)
  const canGoBack = useAtomValue(canGoBackAtom)
  const canGoForward = useAtomValue(canGoForwardAtom)
  const canGoUp = useAtomValue(canGoUpAtom)
  const isInitialLoad = useAtomValue(isInitialLoadAtom)
  const hasError = useAtomValue(hasErrorAtom)
  const errorMessage = useAtomValue(errorMessageAtom)

  // Setters
  const setViewMode = useSetAtom(viewModeAtom)
  const setSortOrder = useSetAtom(sortOrderAtom)
  const setFilterPattern = useSetAtom(filterPatternAtom)
  const setShowHidden = useSetAtom(showHiddenAtom)
  const setInspectorTab = useSetAtom(inspectorTabAtom)
  const setInspectorExpanded = useSetAtom(inspectorExpandedAtom)

  // ─────────────────────────────────────────────────────────────────────────
  // Effect Operations
  // ─────────────────────────────────────────────────────────────────────────

  const navigate = useCallback((path: string) => navigationOps.navigate(path), [])
  const goBack = useCallback(() => navigationOps.goBack(undefined), [])
  const goForward = useCallback(() => navigationOps.goForward(undefined), [])
  const goUp = useCallback(() => navigationOps.goUp(undefined), [])
  const refresh = useCallback(() => navigationOps.refresh(undefined), [])

  const select = useCallback((id: string) => selectionOps.select(id), [])
  const toggleSelect = useCallback((id: string) => selectionOps.toggleSelect(id), [])
  const selectAll = useCallback(() => selectionOps.selectAll(undefined), [])
  const clearSelection = useCallback(() => selectionOps.clearSelection(undefined), [])
  const rangeSelect = useCallback((id: string) => selectionOps.rangeSelect(id), [])

  const copy = useCallback(() => clipboardOps.copy(undefined), [])
  const cut = useCallback(() => clipboardOps.cut(undefined), [])
  const paste = useCallback(() => clipboardOps.paste(undefined), [])

  const deleteSelected = useCallback(() => fileOps.deleteSelected(undefined), [])
  const createDirectory = useCallback((name: string) => fileOps.createDirectory(name), [])
  const rename = useCallback(
    (path: string, newName: string) => fileOps.rename({ path, newName }),
    []
  )

  // Inspector section toggle
  const toggleInspectorSection = useCallback(
    (section: string) => {
      setInspectorExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(section)) {
          next.delete(section)
        } else {
          next.add(section)
        }
        return next
      })
    },
    [setInspectorExpanded]
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Return
  // ─────────────────────────────────────────────────────────────────────────

  return {
    // State
    currentPath,
    selectedFiles,
    viewMode,
    sortOrder,
    filterPattern,
    showHidden,
    isLoading,
    focusedFile,
    history,
    clipboard,
    inspectorTab,
    inspectorExpanded,

    // Derived
    entries,
    selectionInfo,
    selectedFile,
    entryStats,
    breadcrumbs,
    canGoBack,
    canGoForward,
    canGoUp,
    isInitialLoad,
    hasError,
    errorMessage,

    // Navigation
    navigate,
    goBack,
    goForward,
    goUp,
    refresh,

    // Selection
    select,
    toggleSelect,
    selectAll,
    clearSelection,
    rangeSelect,

    // Clipboard
    copy,
    cut,
    paste,

    // File Operations
    deleteSelected,
    createDirectory,
    rename,

    // View Operations
    setViewMode,
    setSortOrder,
    setFilterPattern,
    setShowHidden,
    setInspectorTab,
    toggleInspectorSection,
  }
}
