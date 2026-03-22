/**
 * FileBrowser Root Component
 *
 * Compound component with 3-level hierarchy:
 * - Level 1: FileBrowser (root)
 * - Level 2: Header, Content, Inspector, Actions
 * - Level 3: Breadcrumb, ListView, IconView, etc.
 *
 * @module file-browser/components
 */

import {
  forwardRef,
  useEffect,
  useCallback,
  type ReactNode,
  type CSSProperties,
} from 'react'
import { useAtomValue, useSetAtom } from '@effect-atom/atom-react'
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
  // Derived atoms
  filteredEntriesAtom,
  selectionInfoAtom,
  breadcrumbsAtom,
  canGoBackAtom,
  canGoForwardAtom,
  canGoUpAtom,
  // Operations
  navigationOps,
  selectionOps,
  clipboardOps,
  fileOps,
  type ViewMode,
} from '../../atoms'
import type { SortOrder } from '../../schemas'
import { FileBrowserProvider, type FileBrowserContextValue } from './context'
import { Header } from '../Header'
import { Content } from '../Content'
import { Inspector } from '../Inspector'
import { Actions } from '../Actions'

// =============================================================================
// Types
// =============================================================================

export interface FileBrowserProps {
  /** Initial directory path */
  initialPath?: string
  /** Child compound components */
  children: ReactNode
  /** Additional CSS class */
  className?: string
  /** Inline styles */
  style?: CSSProperties
}

// =============================================================================
// Root Component
// =============================================================================

const FileBrowserRoot = forwardRef<HTMLDivElement, FileBrowserProps>(
  ({ initialPath = '/', children, className = '', style }, ref) => {
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

    // Derived
    const entries = useAtomValue(filteredEntriesAtom)
    const selectionInfo = useAtomValue(selectionInfoAtom)
    const breadcrumbs = useAtomValue(breadcrumbsAtom)
    const canGoBack = useAtomValue(canGoBackAtom)
    const canGoForward = useAtomValue(canGoForwardAtom)
    const canGoUp = useAtomValue(canGoUpAtom)

    // Setters for view state
    const setViewMode = useSetAtom(viewModeAtom)
    const setSortOrder = useSetAtom(sortOrderAtom)
    const setFilterPattern = useSetAtom(filterPatternAtom)
    const setShowHidden = useSetAtom(showHiddenAtom)

    // ─────────────────────────────────────────────────────────────────────────
    // Effect Operations (wrapped in callbacks)
    // ─────────────────────────────────────────────────────────────────────────

    // Navigation
    const navigate = useCallback((path: string) => navigationOps.navigate(path), [])
    const goBack = useCallback(() => navigationOps.goBack(undefined), [])
    const goForward = useCallback(() => navigationOps.goForward(undefined), [])
    const goUp = useCallback(() => navigationOps.goUp(undefined), [])
    const refresh = useCallback(() => navigationOps.refresh(undefined), [])

    // Selection
    const select = useCallback((id: string) => selectionOps.select(id), [])
    const toggleSelect = useCallback((id: string) => selectionOps.toggleSelect(id), [])
    const selectAll = useCallback(() => selectionOps.selectAll(undefined), [])
    const clearSelection = useCallback(() => selectionOps.clearSelection(undefined), [])
    const rangeSelect = useCallback((id: string) => selectionOps.rangeSelect(id), [])

    // Clipboard
    const copy = useCallback(() => clipboardOps.copy(undefined), [])
    const cut = useCallback(() => clipboardOps.cut(undefined), [])
    const paste = useCallback(() => clipboardOps.paste(undefined), [])

    // File operations
    const deleteSelected = useCallback(() => fileOps.deleteSelected(undefined), [])
    const createDirectory = useCallback((name: string) => fileOps.createDirectory(name), [])
    const rename = useCallback(
      (path: string, newName: string) => fileOps.rename({ path, newName }),
      []
    )

    // ─────────────────────────────────────────────────────────────────────────
    // Initial Navigation
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
      navigate(initialPath)
    }, [initialPath, navigate])

    // ─────────────────────────────────────────────────────────────────────────
    // Context Value
    // ─────────────────────────────────────────────────────────────────────────

    const contextValue: FileBrowserContextValue = {
      // State
      currentPath,
      selectedFiles,
      viewMode,
      sortOrder,
      filterPattern,
      showHidden,
      isLoading,
      focusedFile,

      // Derived
      entries,
      selectionInfo,
      breadcrumbs,
      canGoBack,
      canGoForward,
      canGoUp,

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
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    return (
      <FileBrowserProvider value={contextValue}>
        <div
          ref={ref}
          className={`file-browser ${className}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            ...style,
          }}
          data-file-browser
          data-loading={isLoading}
          data-view-mode={viewMode}
        >
          {children}
        </div>
      </FileBrowserProvider>
    )
  }
)

FileBrowserRoot.displayName = 'FileBrowser'

// =============================================================================
// Compound Export
// =============================================================================

export const FileBrowser = Object.assign(FileBrowserRoot, {
  Header,
  Content,
  Inspector,
  Actions,
})

export type { FileBrowserContextValue }
