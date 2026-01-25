/**
 * FileDocumentService
 *
 * Effect.Service bridging local files to the collaborative editor (y-sweet).
 *
 * Flow:
 * 1. Load file: readFileText → MarkdownService.parse → apply to Y.Doc
 * 2. Save file: editor.getMarkdown() → writeFile
 * 3. Conflict: detect mtime changes, prompt user for resolution
 *
 * @module editor/v3/services/FileDocumentService
 */

import { Effect, Stream, Ref } from 'effect';
import type { JSONContent } from '@tiptap/core';

import { FileAccessService } from '@/lib/file-browser/services/FileAccessService';
import { MarkdownService } from './MarkdownService';
import {
  FileDocumentMappingService,
  type FilePath,
  type FileMapping,
  type FileSyncStatus,
} from './FileDocumentMappingService';
import { DocumentRegistryService } from './DocumentRegistryService';
import { type DocumentId, type IdentityId } from '../schemas/document';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of loading a file into the editor.
 */
export interface FileLoadResult {
  readonly mapping: FileMapping;
  readonly json: JSONContent;
  readonly markdown: string;
}

/**
 * Result of saving a file from the editor.
 */
export interface FileSaveResult {
  readonly mapping: FileMapping;
  readonly bytesWritten: number;
}

/**
 * Progress callback for batch operations.
 */
export interface FileProgressInfo {
  readonly completed: number;
  readonly total: number;
  readonly file: FilePath;
  readonly success: boolean;
  readonly error?: string;
}

/**
 * Conflict resolution strategy.
 */
export type ConflictResolution =
  | 'keep_local' // Discard external changes, save local
  | 'keep_external' // Discard local changes, reload from disk
  | 'merge' // Attempt 3-way merge (future)
  | 'save_as'; // Save local to new file

/**
 * Conflict info for UI prompting.
 */
export interface FileConflict {
  readonly path: FilePath;
  readonly documentId: DocumentId;
  readonly localContent: string;
  readonly externalContent: string;
  readonly lastSyncedAt: Date;
}

// =============================================================================
// Errors
// =============================================================================

export class FileDocumentError extends Error {
  readonly _tag = 'FileDocumentError';
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'FileDocumentError';
  }
}

export class FileNotFoundError extends Error {
  readonly _tag = 'FileNotFoundError';
  constructor(readonly path: FilePath) {
    super(`File not found: ${path}`);
    this.name = 'FileNotFoundError';
  }
}

export class FileConflictError extends Error {
  readonly _tag = 'FileConflictError';
  constructor(readonly conflict: FileConflict) {
    super(`File conflict detected: ${conflict.path}`);
    this.name = 'FileConflictError';
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Simple content hash using Web Crypto API.
 */
const hashContent = async (content: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

// =============================================================================
// Service Interface
// =============================================================================

export interface FileDocumentServiceShape {
  /**
   * Load a markdown file into the editor.
   * Creates mapping if needed, parses markdown to JSON.
   */
  readonly loadFile: (
    path: FilePath,
    identity: IdentityId
  ) => Effect.Effect<FileLoadResult, FileNotFoundError | FileDocumentError>;

  /**
   * Save editor content back to file.
   * Updates mapping sync status.
   */
  readonly saveFile: (
    path: FilePath,
    markdown: string
  ) => Effect.Effect<FileSaveResult, FileDocumentError>;

  /**
   * Check if file has external changes since last sync.
   */
  readonly checkExternalChanges: (
    path: FilePath
  ) => Effect.Effect<boolean, FileDocumentError>;

  /**
   * Get conflict info for a file (if in conflict state).
   */
  readonly getConflict: (
    path: FilePath,
    localContent: string
  ) => Effect.Effect<FileConflict | null, FileDocumentError>;

  /**
   * Resolve a conflict with chosen strategy.
   */
  readonly resolveConflict: (
    path: FilePath,
    resolution: ConflictResolution,
    localContent: string,
    newPath?: FilePath // For 'save_as'
  ) => Effect.Effect<
    FileLoadResult | FileSaveResult,
    FileNotFoundError | FileDocumentError
  >;

  /**
   * Load multiple files concurrently with progress.
   */
  readonly loadFiles: (
    paths: readonly FilePath[],
    identity: IdentityId,
    options?: {
      concurrency?: number;
      onProgress?: (info: FileProgressInfo) => void;
    }
  ) => Stream.Stream<FileLoadResult, FileNotFoundError | FileDocumentError>;

  /**
   * Mark a file as dirty (has unsaved local changes).
   */
  readonly markDirty: (
    path: FilePath
  ) => Effect.Effect<FileMapping, FileDocumentError>;

  /**
   * Get current sync status for a file.
   */
  readonly getSyncStatus: (
    path: FilePath
  ) => Effect.Effect<FileSyncStatus | null, FileDocumentError>;

  /**
   * Reload file from disk, discarding local changes.
   */
  readonly reloadFile: (
    path: FilePath
  ) => Effect.Effect<FileLoadResult, FileNotFoundError | FileDocumentError>;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class FileDocumentService extends Effect.Service<FileDocumentService>()(
  'tmnl/editor/FileDocumentService',
  {
    effect: Effect.gen(function* () {
      const fileAccess = yield* FileAccessService;
      const markdownService = yield* MarkdownService;
      const mappingService = yield* FileDocumentMappingService;
      // DocumentRegistryService is available but not used yet
      // Will be used for y-sweet document creation in future

      // --- LOAD FILE ---
      const loadFile = (
        path: FilePath,
        _identity: IdentityId
      ): Effect.Effect<FileLoadResult, FileNotFoundError | FileDocumentError> =>
        Effect.gen(function* () {
          // 1. Check file exists
          const exists = yield* fileAccess
            .exists(path)
            .pipe(
              Effect.mapError(
                (e) => new FileDocumentError(`Failed to check file: ${e}`, e)
              )
            );

          if (!exists) {
            return yield* Effect.fail(new FileNotFoundError(path));
          }

          // 2. Read file content
          const markdown = yield* fileAccess
            .readFileText(path)
            .pipe(
              Effect.mapError(
                (e) => new FileDocumentError(`Failed to read file: ${e}`, e)
              )
            );

          // 3. Get file metadata for mtime
          const metadata = yield* fileAccess
            .getMetadata(path)
            .pipe(
              Effect.mapError(
                (e) => new FileDocumentError(`Failed to get metadata: ${e}`, e)
              )
            );

          // 4. Hash content for conflict detection
          const contentHash = yield* Effect.promise(() =>
            hashContent(markdown)
          );

          // 5. Get or create mapping
          const mapping = yield* mappingService
            .getOrCreate({
              path,
              mtime: metadata.modifiedAt,
              contentHash,
            })
            .pipe(
              Effect.mapError(
                (e) =>
                  new FileDocumentError(`Failed to create mapping: ${e}`, e)
              )
            );

          // 6. Parse markdown to Tiptap JSON
          const json = yield* markdownService
            .parse(markdown)
            .pipe(
              Effect.mapError(
                (e) =>
                  new FileDocumentError(`Failed to parse markdown: ${e}`, e)
              )
            );

          return { mapping, json, markdown };
        });

      // --- SAVE FILE ---
      const saveFile = (
        path: FilePath,
        markdown: string
      ): Effect.Effect<FileSaveResult, FileDocumentError> =>
        Effect.gen(function* () {
          // 1. Write content to file
          const bytes = new TextEncoder().encode(markdown);
          yield* fileAccess
            .writeFile(path, bytes)
            .pipe(
              Effect.mapError(
                (e) => new FileDocumentError(`Failed to write file: ${e}`, e)
              )
            );

          // 2. Get new mtime
          const metadata = yield* fileAccess
            .getMetadata(path)
            .pipe(
              Effect.mapError(
                (e) => new FileDocumentError(`Failed to get metadata: ${e}`, e)
              )
            );

          // 3. Hash new content
          const contentHash = yield* Effect.promise(() =>
            hashContent(markdown)
          );

          // 4. Update mapping as synced
          const mapping = yield* mappingService
            .markSynced(path, metadata.modifiedAt, contentHash)
            .pipe(
              Effect.mapError(
                (e) =>
                  new FileDocumentError(`Failed to update mapping: ${e}`, e)
              )
            );

          return { mapping, bytesWritten: bytes.length };
        });

      // --- CHECK EXTERNAL CHANGES ---
      const checkExternalChanges = (
        path: FilePath
      ): Effect.Effect<boolean, FileDocumentError> =>
        Effect.gen(function* () {
          const mapping = yield* mappingService
            .getByPath(path)
            .pipe(
              Effect.mapError(
                (e) => new FileDocumentError(`Failed to get mapping: ${e}`, e)
              )
            );

          if (!mapping) {
            return false;
          }

          const metadata = yield* fileAccess
            .getMetadata(path)
            .pipe(
              Effect.mapError(
                (e) => new FileDocumentError(`Failed to get metadata: ${e}`, e)
              )
            );

          return metadata.modifiedAt !== mapping.lastSyncedMtime;
        });

      // --- GET CONFLICT ---
      const getConflict = (
        path: FilePath,
        localContent: string
      ): Effect.Effect<FileConflict | null, FileDocumentError> =>
        Effect.gen(function* () {
          const mapping = yield* mappingService
            .getByPath(path)
            .pipe(
              Effect.mapError(
                (e) => new FileDocumentError(`Failed to get mapping: ${e}`, e)
              )
            );

          if (!mapping || mapping.syncStatus !== 'conflict') {
            return null;
          }

          // Read current file content
          const externalContent = yield* fileAccess
            .readFileText(path)
            .pipe(
              Effect.mapError(
                (e) => new FileDocumentError(`Failed to read file: ${e}`, e)
              )
            );

          return {
            path,
            documentId: mapping.documentId,
            localContent,
            externalContent,
            lastSyncedAt: mapping.updatedAt,
          };
        });

      // --- RESOLVE CONFLICT ---
      const resolveConflict = (
        path: FilePath,
        resolution: ConflictResolution,
        localContent: string,
        newPath?: FilePath
      ): Effect.Effect<
        FileLoadResult | FileSaveResult,
        FileNotFoundError | FileDocumentError
      > =>
        Effect.gen(function* () {
          switch (resolution) {
            case 'keep_local':
              // Save local content, overwriting external
              return yield* saveFile(path, localContent);

            case 'keep_external':
              // Reload from disk
              return yield* reloadFile(path);

            case 'save_as':
              if (!newPath) {
                return yield* Effect.fail(
                  new FileDocumentError('save_as requires newPath')
                );
              }
              return yield* saveFile(newPath, localContent);

            case 'merge':
              // TODO: Implement 3-way merge
              return yield* Effect.fail(
                new FileDocumentError('Merge not yet implemented')
              );
          }
        });

      // --- LOAD FILES (BATCH) ---
      const loadFiles = (
        paths: readonly FilePath[],
        identity: IdentityId,
        options?: {
          concurrency?: number;
          onProgress?: (info: FileProgressInfo) => void;
        }
      ): Stream.Stream<
        FileLoadResult,
        FileNotFoundError | FileDocumentError
      > => {
        const concurrency = options?.concurrency ?? 4;
        const total = paths.length;

        return Stream.unwrap(
          Effect.gen(function* () {
            const completedRef = yield* Ref.make(0);

            return Stream.fromIterable(paths).pipe(
              Stream.mapEffect(
                (filepath) =>
                  loadFile(filepath, identity).pipe(
                    Effect.tap((result) =>
                      Ref.updateAndGet(completedRef, (n) => n + 1).pipe(
                        Effect.andThen((completed) =>
                          Effect.sync(() =>
                            options?.onProgress?.({
                              completed,
                              total,
                              file: filepath,
                              success: true,
                            })
                          )
                        )
                      )
                    ),
                    Effect.catchAll((error) =>
                      Ref.updateAndGet(completedRef, (n) => n + 1).pipe(
                        Effect.andThen((completed) =>
                          Effect.sync(() => {
                            options?.onProgress?.({
                              completed,
                              total,
                              file: filepath,
                              success: false,
                              error: error.message,
                            });
                          })
                        ),
                        Effect.andThen(() => Effect.fail(error))
                      )
                    )
                  ),
                { concurrency }
              )
            );
          })
        );
      };

      // --- MARK DIRTY ---
      const markDirty = (
        path: FilePath
      ): Effect.Effect<FileMapping, FileDocumentError> =>
        mappingService
          .markDirty(path)
          .pipe(
            Effect.mapError(
              (e) => new FileDocumentError(`Failed to mark dirty: ${e}`, e)
            )
          );

      // --- GET SYNC STATUS ---
      const getSyncStatus = (
        path: FilePath
      ): Effect.Effect<FileSyncStatus | null, FileDocumentError> =>
        Effect.gen(function* () {
          const mapping = yield* mappingService
            .getByPath(path)
            .pipe(
              Effect.mapError(
                (e) => new FileDocumentError(`Failed to get mapping: ${e}`, e)
              )
            );

          return mapping?.syncStatus ?? null;
        });

      // --- RELOAD FILE ---
      const reloadFile = (
        path: FilePath
      ): Effect.Effect<FileLoadResult, FileNotFoundError | FileDocumentError> =>
        Effect.gen(function* () {
          // 1. Read file content
          const exists = yield* fileAccess
            .exists(path)
            .pipe(
              Effect.mapError(
                (e) => new FileDocumentError(`Failed to check file: ${e}`, e)
              )
            );

          if (!exists) {
            return yield* Effect.fail(new FileNotFoundError(path));
          }

          const markdown = yield* fileAccess
            .readFileText(path)
            .pipe(
              Effect.mapError(
                (e) => new FileDocumentError(`Failed to read file: ${e}`, e)
              )
            );

          // 2. Get metadata
          const metadata = yield* fileAccess
            .getMetadata(path)
            .pipe(
              Effect.mapError(
                (e) => new FileDocumentError(`Failed to get metadata: ${e}`, e)
              )
            );

          // 3. Hash content
          const contentHash = yield* Effect.promise(() =>
            hashContent(markdown)
          );

          // 4. Update mapping as synced (discarding any dirty/conflict state)
          const mapping = yield* mappingService
            .updateSync(path, metadata.modifiedAt, contentHash, 'synced')
            .pipe(
              Effect.mapError(
                (e) =>
                  new FileDocumentError(`Failed to update mapping: ${e}`, e)
              )
            );

          // 5. Parse markdown
          const json = yield* markdownService
            .parse(markdown)
            .pipe(
              Effect.mapError(
                (e) =>
                  new FileDocumentError(`Failed to parse markdown: ${e}`, e)
              )
            );

          return { mapping, json, markdown };
        });

      return {
        loadFile,
        saveFile,
        checkExternalChanges,
        getConflict,
        resolveConflict,
        loadFiles,
        markDirty,
        getSyncStatus,
        reloadFile,
      } satisfies FileDocumentServiceShape;
    }),
    // Note: FileAccessService is a Context.Tag, not a Layer
    // It must be provided separately when using this service
    dependencies: [
      MarkdownService.Default,
      FileDocumentMappingService.Default,
      DocumentRegistryService.Default,
    ],
  }
) {}

// =============================================================================
// Layer Exports
// =============================================================================

export const FileDocumentServiceLive = FileDocumentService.Default;
