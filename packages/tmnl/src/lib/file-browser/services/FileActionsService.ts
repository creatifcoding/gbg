/**
 * FileActionsService
 *
 * Layer 3: High-level file operations with progress tracking.
 * Orchestrates copy, move, delete with Effect streams.
 *
 * @module file-browser/services
 */

import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Context from 'effect/Context'
import * as Stream from 'effect/Stream'
import * as Chunk from 'effect/Chunk'

import { FileAccessService } from './FileAccessService'
import { FileAnalysisService } from './FileAnalysisService'
import type { FileEntry } from '../schemas'

// =============================================================================
// Progress Types
// =============================================================================

export interface OperationProgress {
  /** Operation ID */
  id: string
  /** Current phase */
  phase: 'preparing' | 'copying' | 'verifying' | 'cleaning' | 'complete' | 'error'
  /** Current item path */
  currentItem: string
  /** Total items */
  totalItems: number
  /** Completed items */
  completedItems: number
  /** Bytes processed (for copy) */
  bytesProcessed: number
  /** Total bytes (for copy) */
  totalBytes: number
  /** Error message if phase is 'error' */
  error?: string
}

// =============================================================================
// Service Interface
// =============================================================================

export interface FileActionsImpl {
  /** Copy files with progress stream */
  readonly copyFiles: (
    sources: readonly string[],
    destDir: string
  ) => Stream.Stream<OperationProgress, Error, FileAccessService>

  /** Move files with progress stream */
  readonly moveFiles: (
    sources: readonly string[],
    destDir: string
  ) => Stream.Stream<OperationProgress, Error, FileAccessService>

  /** Delete files with progress stream */
  readonly deleteFiles: (
    paths: readonly string[],
    recursive?: boolean
  ) => Stream.Stream<OperationProgress, Error, FileAccessService>

  /** Rename a single file */
  readonly renameFile: (
    path: string,
    newName: string
  ) => Effect.Effect<void, Error, FileAccessService>

  /** Create a new directory */
  readonly createDirectory: (
    parentPath: string,
    name: string
  ) => Effect.Effect<string, Error, FileAccessService>

  /** Duplicate a file (copy with _copy suffix) */
  readonly duplicateFile: (
    path: string
  ) => Effect.Effect<string, Error, FileAccessService>
}

// =============================================================================
// Service Tag
// =============================================================================

export class FileActionsService extends Context.Tag('tmnl/file-browser/FileActionsService')<
  FileActionsService,
  FileActionsImpl
>() {}

// =============================================================================
// Helper Functions
// =============================================================================

/** Generate unique operation ID */
function generateOpId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Extract filename from path */
function basename(path: string): string {
  return path.split('/').pop() || ''
}

/** Get directory from path */
function dirname(path: string): string {
  const parts = path.split('/')
  parts.pop()
  return parts.join('/') || '/'
}

/** Join path segments */
function joinPath(...segments: string[]): string {
  return segments
    .map((s, i) => (i === 0 ? s : s.replace(/^\//, '')))
    .join('/')
    .replace(/\/+/g, '/')
}

// =============================================================================
// Implementation
// =============================================================================

const impl: FileActionsImpl = {
  copyFiles: (sources: readonly string[], destDir: string) =>
    Stream.async<OperationProgress, Error, FileAccessService>((emit) => {
      const opId = generateOpId()

      Effect.gen(function* () {
        const access = yield* FileAccessService

        // Emit preparing phase
        emit.single({
          id: opId,
          phase: 'preparing',
          currentItem: '',
          totalItems: sources.length,
          completedItems: 0,
          bytesProcessed: 0,
          totalBytes: 0,
        })

        // Process each source
        let completedItems = 0
        for (const source of sources) {
          const name = basename(source)
          const dest = joinPath(destDir, name)

          emit.single({
            id: opId,
            phase: 'copying',
            currentItem: name,
            totalItems: sources.length,
            completedItems,
            bytesProcessed: 0,
            totalBytes: 0,
          })

          yield* access.copy(source, dest)
          completedItems++
        }

        // Emit complete
        emit.single({
          id: opId,
          phase: 'complete',
          currentItem: '',
          totalItems: sources.length,
          completedItems,
          bytesProcessed: 0,
          totalBytes: 0,
        })

        emit.end()
      }).pipe(
        Effect.catchAll((error) => {
          emit.single({
            id: opId,
            phase: 'error',
            currentItem: '',
            totalItems: sources.length,
            completedItems: 0,
            bytesProcessed: 0,
            totalBytes: 0,
            error: String(error),
          })
          emit.end()
          return Effect.void
        }),
        Effect.runPromise
      )
    }).pipe(Stream.withSpan('FileActionsService.copyFiles')),

  moveFiles: (sources: readonly string[], destDir: string) =>
    Stream.async<OperationProgress, Error, FileAccessService>((emit) => {
      const opId = generateOpId()

      Effect.gen(function* () {
        const access = yield* FileAccessService

        emit.single({
          id: opId,
          phase: 'preparing',
          currentItem: '',
          totalItems: sources.length,
          completedItems: 0,
          bytesProcessed: 0,
          totalBytes: 0,
        })

        let completedItems = 0
        for (const source of sources) {
          const name = basename(source)
          const dest = joinPath(destDir, name)

          emit.single({
            id: opId,
            phase: 'copying',
            currentItem: name,
            totalItems: sources.length,
            completedItems,
            bytesProcessed: 0,
            totalBytes: 0,
          })

          // Move is rename in most file systems
          yield* access.rename(source, dest)
          completedItems++
        }

        emit.single({
          id: opId,
          phase: 'complete',
          currentItem: '',
          totalItems: sources.length,
          completedItems,
          bytesProcessed: 0,
          totalBytes: 0,
        })

        emit.end()
      }).pipe(
        Effect.catchAll((error) => {
          emit.single({
            id: opId,
            phase: 'error',
            currentItem: '',
            totalItems: sources.length,
            completedItems: 0,
            bytesProcessed: 0,
            totalBytes: 0,
            error: String(error),
          })
          emit.end()
          return Effect.void
        }),
        Effect.runPromise
      )
    }).pipe(Stream.withSpan('FileActionsService.moveFiles')),

  deleteFiles: (paths: readonly string[], recursive = false) =>
    Stream.async<OperationProgress, Error, FileAccessService>((emit) => {
      const opId = generateOpId()

      Effect.gen(function* () {
        const access = yield* FileAccessService

        emit.single({
          id: opId,
          phase: 'preparing',
          currentItem: '',
          totalItems: paths.length,
          completedItems: 0,
          bytesProcessed: 0,
          totalBytes: 0,
        })

        let completedItems = 0
        for (const path of paths) {
          const name = basename(path)

          emit.single({
            id: opId,
            phase: 'cleaning',
            currentItem: name,
            totalItems: paths.length,
            completedItems,
            bytesProcessed: 0,
            totalBytes: 0,
          })

          yield* access.deleteFile(path, recursive)
          completedItems++
        }

        emit.single({
          id: opId,
          phase: 'complete',
          currentItem: '',
          totalItems: paths.length,
          completedItems,
          bytesProcessed: 0,
          totalBytes: 0,
        })

        emit.end()
      }).pipe(
        Effect.catchAll((error) => {
          emit.single({
            id: opId,
            phase: 'error',
            currentItem: '',
            totalItems: paths.length,
            completedItems: 0,
            bytesProcessed: 0,
            totalBytes: 0,
            error: String(error),
          })
          emit.end()
          return Effect.void
        }),
        Effect.runPromise
      )
    }).pipe(Stream.withSpan('FileActionsService.deleteFiles')),

  renameFile: (path: string, newName: string) =>
    Effect.gen(function* () {
      const access = yield* FileAccessService
      const dir = dirname(path)
      const newPath = joinPath(dir, newName)
      yield* access.rename(path, newPath)
    }).pipe(Effect.withSpan('FileActionsService.renameFile')),

  createDirectory: (parentPath: string, name: string) =>
    Effect.gen(function* () {
      const access = yield* FileAccessService
      const newPath = joinPath(parentPath, name)
      yield* access.createDirectory(newPath)
      return newPath
    }).pipe(Effect.withSpan('FileActionsService.createDirectory')),

  duplicateFile: (path: string) =>
    Effect.gen(function* () {
      const access = yield* FileAccessService
      const dir = dirname(path)
      const name = basename(path)

      // Generate copy name
      const ext = name.includes('.') ? '.' + name.split('.').pop() : ''
      const baseName = ext ? name.slice(0, -ext.length) : name
      const copyName = `${baseName}_copy${ext}`
      const copyPath = joinPath(dir, copyName)

      yield* access.copy(path, copyPath)
      return copyPath
    }).pipe(Effect.withSpan('FileActionsService.duplicateFile')),
}

// =============================================================================
// Layer Export
// =============================================================================

/**
 * FileActionsService layer
 *
 * Requires FileAccessService for underlying operations.
 */
export const FileActionsServiceLive = Layer.succeed(FileActionsService, impl)
