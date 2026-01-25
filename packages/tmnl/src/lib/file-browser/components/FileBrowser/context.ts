/**
 * FileBrowser Context
 *
 * Provides shared state and operations to compound children.
 *
 * @module file-browser/components
 */

import { createContext, useContext } from 'react'
import type { ViewMode } from '../../atoms/state'
import type { FileEntry, SortOrder } from '../../schemas'

// =============================================================================
// Context Types
// =============================================================================

export interface FileBrowserContextValue {
  // State
  currentPath: string
  selectedFiles: ReadonlySet<string>
  viewMode: ViewMode
  sortOrder: SortOrder
  filterPattern: string
  showHidden: boolean
  isLoading: boolean
  focusedFile: string | null

  // Derived
  entries: readonly FileEntry[]
  selectionInfo: {
    count: number
    hasSelection: boolean
    isSingle: boolean
    isMultiple: boolean
  }
  breadcrumbs: readonly { name: string; path: string }[]
  canGoBack: boolean
  canGoForward: boolean
  canGoUp: boolean

  // Navigation Operations
  navigate: (path: string) => Promise<void>
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  goUp: () => Promise<void>
  refresh: () => Promise<void>

  // Selection Operations
  select: (id: string) => Promise<void>
  toggleSelect: (id: string) => Promise<void>
  selectAll: () => Promise<void>
  clearSelection: () => Promise<void>
  rangeSelect: (id: string) => Promise<void>

  // Clipboard Operations
  copy: () => Promise<void>
  cut: () => Promise<void>
  paste: () => Promise<void>

  // File Operations
  deleteSelected: () => Promise<void>
  createDirectory: (name: string) => Promise<void>
  rename: (path: string, newName: string) => Promise<void>

  // View Operations
  setViewMode: (mode: ViewMode) => void
  setSortOrder: (order: SortOrder) => void
  setFilterPattern: (pattern: string) => void
  setShowHidden: (show: boolean) => void
}

// =============================================================================
// Context
// =============================================================================

const FileBrowserContext = createContext<FileBrowserContextValue | null>(null)

/**
 * Hook to access FileBrowser context
 *
 * @throws Error if used outside FileBrowser compound
 */
export function useFileBrowserContext(): FileBrowserContextValue {
  const context = useContext(FileBrowserContext)

  if (!context) {
    throw new Error(
      'useFileBrowserContext must be used within a FileBrowser compound component'
    )
  }

  return context
}

/**
 * FileBrowser context provider component
 */
export const FileBrowserProvider = FileBrowserContext.Provider

export { FileBrowserContext }
