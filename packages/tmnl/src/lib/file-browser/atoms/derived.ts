/**
 * FileBrowser Derived Atoms
 *
 * Computed atoms derived from state atoms.
 *
 * @module file-browser/atoms
 */

import { Atom } from '@effect-atom/atom'
import * as Result from '@effect-atom/atom/Result'

import {
  currentPathAtom,
  selectedFilesAtom,
  viewModeAtom,
  sortOrderAtom,
  filterPatternAtom,
  showHiddenAtom,
  directoryContentsAtom,
  historyAtom,
} from './state'
import type { FileEntry } from '../schemas'

// =============================================================================
// Selection Info
// =============================================================================

/**
 * Selection info derived from selected files
 */
export const selectionInfoAtom = Atom.make((get) => {
  const selected = get(selectedFilesAtom)
  return {
    count: selected.size,
    hasSelection: selected.size > 0,
    isSingle: selected.size === 1,
    isMultiple: selected.size > 1,
  }
})

/**
 * First selected file (for inspector)
 */
export const selectedFileAtom = Atom.make((get) => {
  const selected = get(selectedFilesAtom)
  const contentsResult = get(directoryContentsAtom)

  if (selected.size !== 1) return null
  if (!Result.isSuccess(contentsResult)) return null

  const [selectedId] = selected
  return contentsResult.value.find((f) => f.id === selectedId) ?? null
})

// =============================================================================
// Filtered & Sorted Entries
// =============================================================================

/**
 * Directory entries filtered and sorted
 */
export const filteredEntriesAtom = Atom.make((get) => {
  const contentsResult = get(directoryContentsAtom)
  const filter = get(filterPatternAtom).toLowerCase()
  const showHidden = get(showHiddenAtom)
  const sortOrder = get(sortOrderAtom)

  if (!Result.isSuccess(contentsResult)) {
    return []
  }

  let entries = [...contentsResult.value]

  // Filter hidden files
  if (!showHidden) {
    entries = entries.filter((e) => !e.hidden)
  }

  // Filter by pattern
  if (filter) {
    entries = entries.filter((e) => e.name.toLowerCase().includes(filter))
  }

  // Sort
  entries.sort((a, b) => {
    // Directories first
    if (a.type === 'directory' && b.type !== 'directory') return -1
    if (a.type !== 'directory' && b.type === 'directory') return 1

    let cmp = 0
    switch (sortOrder.field) {
      case 'name':
        cmp = a.name.localeCompare(b.name)
        break
      case 'size':
        cmp = a.size - b.size
        break
      case 'type':
        cmp = (a.extension ?? '').localeCompare(b.extension ?? '')
        break
      case 'modifiedAt':
        cmp = a.modifiedAt - b.modifiedAt
        break
      case 'createdAt':
        cmp = a.createdAt - b.createdAt
        break
    }

    return sortOrder.direction === 'asc' ? cmp : -cmp
  })

  return entries as readonly FileEntry[]
})

/**
 * Entry count stats
 */
export const entryStatsAtom = Atom.make((get) => {
  const entries = get(filteredEntriesAtom)
  const files = entries.filter((e) => e.type === 'file')
  const directories = entries.filter((e) => e.type === 'directory')
  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  return {
    total: entries.length,
    files: files.length,
    directories: directories.length,
    totalSize,
  }
})

// =============================================================================
// Navigation
// =============================================================================

/**
 * Breadcrumb segments from current path
 */
export const breadcrumbsAtom = Atom.make((get) => {
  const path = get(currentPathAtom)
  const parts = path.split('/').filter(Boolean)

  return parts.map((name, index) => ({
    name,
    path: '/' + parts.slice(0, index + 1).join('/'),
  }))
})

/**
 * Can navigate back
 */
export const canGoBackAtom = Atom.make((get) => {
  const history = get(historyAtom)
  return history.past.length > 0
})

/**
 * Can navigate forward
 */
export const canGoForwardAtom = Atom.make((get) => {
  const history = get(historyAtom)
  return history.future.length > 0
})

/**
 * Can navigate up (not at root)
 */
export const canGoUpAtom = Atom.make((get) => {
  const path = get(currentPathAtom)
  return path !== '/'
})

// =============================================================================
// Loading States
// =============================================================================

/**
 * Is initial load (no data yet)
 */
export const isInitialLoadAtom = Atom.make((get) => {
  const contentsResult = get(directoryContentsAtom)
  return Result.isInitial(contentsResult)
})

/**
 * Has error
 */
export const hasErrorAtom = Atom.make((get) => {
  const contentsResult = get(directoryContentsAtom)
  return Result.isFailure(contentsResult)
})

/**
 * Error message
 */
export const errorMessageAtom = Atom.make((get) => {
  const contentsResult = get(directoryContentsAtom)
  if (Result.isFailure(contentsResult)) {
    return contentsResult.error.message
  }
  return null
})
