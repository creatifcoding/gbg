/**
 * FileBrowser Operation Atoms
 *
 * Mutation operations using Effect + runtimeAtom.fn pattern.
 *
 * @module file-browser/atoms
 */

import * as Effect from 'effect/Effect'
import * as Result from '@effect-atom/atom/Result'
import { Atom } from '@effect-atom/atom'
import * as Layer from 'effect/Layer'

import { FileAccessService, FileAccessServiceLive } from '../services'
import {
  currentPathAtom,
  selectedFilesAtom,
  directoryContentsAtom,
  isLoadingAtom,
  historyAtom,
  focusedFileAtom,
  clipboardAtom,
} from './state'

// =============================================================================
// Runtime Atom
// =============================================================================

/**
 * FileBrowser runtime atom
 *
 * Provides Effect runtime for service operations.
 */
export const fileBrowserRuntimeAtom = Atom.runtime(
  Layer.mergeAll(FileAccessServiceLive)
)

// =============================================================================
// Navigation Operations
// =============================================================================

export const navigationOps = {
  /**
   * Navigate to a directory
   */
  navigate: fileBrowserRuntimeAtom.fn<string>()((path, ctx) =>
    Effect.gen(function* () {
      const currentPath = ctx.get(currentPathAtom)

      // Update history
      if (currentPath !== path) {
        const history = ctx.get(historyAtom)
        ctx.set(historyAtom, {
          past: [...history.past, currentPath],
          future: [],
        })
      }

      // Set loading state
      ctx.set(isLoadingAtom, true)
      ctx.set(currentPathAtom, path)
      ctx.set(selectedFilesAtom, new Set())
      ctx.set(focusedFileAtom, null)

      // Fetch directory contents
      const access = yield* FileAccessService
      const entries = yield* access.listDirectory(path)

      // Update state
      ctx.set(directoryContentsAtom, Result.success(entries))
      ctx.set(isLoadingAtom, false)

      return entries
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          ctx.set(directoryContentsAtom, Result.failure(error as Error))
          ctx.set(isLoadingAtom, false)
        })
      ),
      Effect.withSpan('FileBrowser.navigate')
    )
  ),

  /**
   * Navigate back in history
   */
  goBack: fileBrowserRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.gen(function* () {
      const history = ctx.get(historyAtom)
      if (history.past.length === 0) return

      const currentPath = ctx.get(currentPathAtom)
      const [previousPath, ...remainingPast] = [...history.past].reverse()

      ctx.set(historyAtom, {
        past: [...history.past].slice(0, -1),
        future: [currentPath, ...history.future],
      })

      // Navigate without adding to history
      ctx.set(isLoadingAtom, true)
      ctx.set(currentPathAtom, previousPath)
      ctx.set(selectedFilesAtom, new Set())

      const access = yield* FileAccessService
      const entries = yield* access.listDirectory(previousPath)

      ctx.set(directoryContentsAtom, Result.success(entries))
      ctx.set(isLoadingAtom, false)
    }).pipe(Effect.withSpan('FileBrowser.goBack'))
  ),

  /**
   * Navigate forward in history
   */
  goForward: fileBrowserRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.gen(function* () {
      const history = ctx.get(historyAtom)
      if (history.future.length === 0) return

      const currentPath = ctx.get(currentPathAtom)
      const [nextPath, ...remainingFuture] = history.future

      ctx.set(historyAtom, {
        past: [...history.past, currentPath],
        future: remainingFuture,
      })

      ctx.set(isLoadingAtom, true)
      ctx.set(currentPathAtom, nextPath)
      ctx.set(selectedFilesAtom, new Set())

      const access = yield* FileAccessService
      const entries = yield* access.listDirectory(nextPath)

      ctx.set(directoryContentsAtom, Result.success(entries))
      ctx.set(isLoadingAtom, false)
    }).pipe(Effect.withSpan('FileBrowser.goForward'))
  ),

  /**
   * Navigate up to parent directory
   */
  goUp: fileBrowserRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.gen(function* () {
      const currentPath = ctx.get(currentPathAtom)
      if (currentPath === '/') return

      const parts = currentPath.split('/').filter(Boolean)
      parts.pop()
      const parentPath = '/' + parts.join('/')

      // Use navigate to handle history
      yield* navigationOps.navigate(parentPath || '/')
    }).pipe(Effect.withSpan('FileBrowser.goUp'))
  ),

  /**
   * Refresh current directory
   */
  refresh: fileBrowserRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.gen(function* () {
      const path = ctx.get(currentPathAtom)

      ctx.set(isLoadingAtom, true)

      const access = yield* FileAccessService
      const entries = yield* access.listDirectory(path)

      ctx.set(directoryContentsAtom, Result.success(entries))
      ctx.set(isLoadingAtom, false)
    }).pipe(Effect.withSpan('FileBrowser.refresh'))
  ),
}

// =============================================================================
// Selection Operations
// =============================================================================

export const selectionOps = {
  /**
   * Select a single file (replaces selection)
   */
  select: fileBrowserRuntimeAtom.fn<string>()((id, ctx) =>
    Effect.sync(() => {
      ctx.set(selectedFilesAtom, new Set([id]))
      ctx.set(focusedFileAtom, id)
    })
  ),

  /**
   * Toggle file selection (for multi-select)
   */
  toggleSelect: fileBrowserRuntimeAtom.fn<string>()((id, ctx) =>
    Effect.sync(() => {
      const selected = ctx.get(selectedFilesAtom)
      const newSelected = new Set(selected)

      if (newSelected.has(id)) {
        newSelected.delete(id)
      } else {
        newSelected.add(id)
      }

      ctx.set(selectedFilesAtom, newSelected)
      ctx.set(focusedFileAtom, id)
    })
  ),

  /**
   * Select all files
   */
  selectAll: fileBrowserRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.sync(() => {
      const contentsResult = ctx.get(directoryContentsAtom)
      if (!Result.isSuccess(contentsResult)) return

      const allIds = new Set(contentsResult.value.map((f) => f.id))
      ctx.set(selectedFilesAtom, allIds)
    })
  ),

  /**
   * Clear selection
   */
  clearSelection: fileBrowserRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.sync(() => {
      ctx.set(selectedFilesAtom, new Set())
      ctx.set(focusedFileAtom, null)
    })
  ),

  /**
   * Range select (shift+click)
   */
  rangeSelect: fileBrowserRuntimeAtom.fn<string>()((id, ctx) =>
    Effect.sync(() => {
      const contentsResult = ctx.get(directoryContentsAtom)
      if (!Result.isSuccess(contentsResult)) return

      const focused = ctx.get(focusedFileAtom)
      if (!focused) {
        ctx.set(selectedFilesAtom, new Set([id]))
        ctx.set(focusedFileAtom, id)
        return
      }

      const entries = contentsResult.value
      const focusedIndex = entries.findIndex((f) => f.id === focused)
      const targetIndex = entries.findIndex((f) => f.id === id)

      if (focusedIndex === -1 || targetIndex === -1) return

      const start = Math.min(focusedIndex, targetIndex)
      const end = Math.max(focusedIndex, targetIndex)

      const rangeIds = entries.slice(start, end + 1).map((f) => f.id)
      ctx.set(selectedFilesAtom, new Set(rangeIds))
    })
  ),
}

// =============================================================================
// Clipboard Operations
// =============================================================================

export const clipboardOps = {
  /**
   * Copy selected files to clipboard
   */
  copy: fileBrowserRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.sync(() => {
      const selected = ctx.get(selectedFilesAtom)
      if (selected.size === 0) return

      ctx.set(clipboardAtom, {
        paths: Array.from(selected),
        operation: 'copy',
      })
    })
  ),

  /**
   * Cut selected files to clipboard
   */
  cut: fileBrowserRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.sync(() => {
      const selected = ctx.get(selectedFilesAtom)
      if (selected.size === 0) return

      ctx.set(clipboardAtom, {
        paths: Array.from(selected),
        operation: 'cut',
      })
    })
  ),

  /**
   * Paste from clipboard
   */
  paste: fileBrowserRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.gen(function* () {
      const clipboard = ctx.get(clipboardAtom)
      if (!clipboard) return

      const currentPath = ctx.get(currentPathAtom)
      const access = yield* FileAccessService

      for (const sourcePath of clipboard.paths) {
        const fileName = sourcePath.split('/').pop() ?? 'file'
        const destPath = `${currentPath}/${fileName}`

        if (clipboard.operation === 'copy') {
          yield* access.copy(sourcePath, destPath)
        } else {
          yield* access.rename(sourcePath, destPath)
        }
      }

      // Clear clipboard after cut
      if (clipboard.operation === 'cut') {
        ctx.set(clipboardAtom, null)
      }

      // Refresh directory
      yield* navigationOps.refresh(undefined)
    }).pipe(Effect.withSpan('FileBrowser.paste'))
  ),
}

// =============================================================================
// File Operations
// =============================================================================

export const fileOps = {
  /**
   * Delete selected files
   */
  deleteSelected: fileBrowserRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.gen(function* () {
      const selected = ctx.get(selectedFilesAtom)
      if (selected.size === 0) return

      const access = yield* FileAccessService

      for (const path of selected) {
        yield* access.deleteFile(path, true)
      }

      ctx.set(selectedFilesAtom, new Set())
      yield* navigationOps.refresh(undefined)
    }).pipe(Effect.withSpan('FileBrowser.deleteSelected'))
  ),

  /**
   * Create new directory
   */
  createDirectory: fileBrowserRuntimeAtom.fn<string>()((name, ctx) =>
    Effect.gen(function* () {
      const currentPath = ctx.get(currentPathAtom)
      const newPath = `${currentPath}/${name}`

      const access = yield* FileAccessService
      yield* access.createDirectory(newPath)

      yield* navigationOps.refresh(undefined)
    }).pipe(Effect.withSpan('FileBrowser.createDirectory'))
  ),

  /**
   * Rename file
   */
  rename: fileBrowserRuntimeAtom.fn<{ path: string; newName: string }>()(
    ({ path, newName }, ctx) =>
      Effect.gen(function* () {
        const parentPath = path.split('/').slice(0, -1).join('/')
        const newPath = `${parentPath}/${newName}`

        const access = yield* FileAccessService
        yield* access.rename(path, newPath)

        yield* navigationOps.refresh(undefined)
      }).pipe(Effect.withSpan('FileBrowser.rename'))
  ),
}
