/**
 * FileBrowser State Atoms
 *
 * Core state atoms (writable, module-level singletons).
 *
 * @module file-browser/atoms
 */

import { Atom } from '@effect-atom/atom'
import * as Result from '@effect-atom/atom/Result'

import type { FileEntry, SortOrder } from '../schemas'

// =============================================================================
// View Mode
// =============================================================================

export type ViewMode = 'list' | 'icons'

// =============================================================================
// Core State Atoms
// =============================================================================

/**
 * Current directory path
 */
export const currentPathAtom = Atom.make<string>('/')

/**
 * Selected file IDs (paths)
 */
export const selectedFilesAtom = Atom.make<ReadonlySet<string>>(new Set())

/**
 * View mode (list or icons)
 */
export const viewModeAtom = Atom.make<ViewMode>('list')

/**
 * Sort order
 */
export const sortOrderAtom = Atom.make<SortOrder>({
  field: 'name',
  direction: 'asc',
})

/**
 * Filter pattern (search within directory)
 */
export const filterPatternAtom = Atom.make<string>('')

/**
 * Show hidden files toggle
 */
export const showHiddenAtom = Atom.make<boolean>(false)

/**
 * Directory contents (Result for loading/error states)
 */
export const directoryContentsAtom = Atom.make<Result.Result<readonly FileEntry[], Error>>(
  Result.initial()
)

/**
 * Currently focused file (for keyboard navigation)
 */
export const focusedFileAtom = Atom.make<string | null>(null)

/**
 * Is loading directory
 */
export const isLoadingAtom = Atom.make<boolean>(false)

/**
 * Navigation history (for back/forward)
 */
export const historyAtom = Atom.make<{
  past: readonly string[]
  future: readonly string[]
}>({
  past: [],
  future: [],
})

/**
 * Active operation (for progress overlay)
 */
export const activeOperationAtom = Atom.make<string | null>(null)

/**
 * Clipboard (for copy/cut operations)
 */
export const clipboardAtom = Atom.make<{
  paths: readonly string[]
  operation: 'copy' | 'cut'
} | null>(null)

/**
 * Inspector panel: active tab
 */
export const inspectorTabAtom = Atom.make<'BRIEFING' | 'META' | 'SPEC'>('BRIEFING')

/**
 * Inspector panel: expanded sections
 */
export const inspectorExpandedAtom = Atom.make<ReadonlySet<string>>(
  new Set(['description', 'tags', 'core', 'location', 'structure'])
)
