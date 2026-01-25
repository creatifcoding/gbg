/**
 * FileDocumentMappingService
 *
 * Effect.Service for mapping file paths to document IDs.
 * Uses NATS KV for persistent storage of path ↔ docId mappings.
 *
 * Key Design Decisions:
 * 1. File paths are NOT used as document IDs (paths can change, contain special chars)
 * 2. Each file gets a stable document ID on first load
 * 3. Mappings persist across sessions via NATS KV
 * 4. Supports watching for external file changes (mtime tracking)
 *
 * @module editor/v3/services/FileDocumentMappingService
 */

import { Effect, Schema, Stream } from 'effect';
import type { KV } from 'nats';

import { NatsKVService, type KvWatchEvent } from '@/lib/nats';
import { DocumentId, generateDocumentId } from '../schemas/document';

// =============================================================================
// Constants
// =============================================================================

const BUCKET_NAME = 'tmnl-file-mappings';
const BUCKET_HISTORY = 5;

// =============================================================================
// Schemas
// =============================================================================

/**
 * Branded file path for type safety.
 */
export const FilePath = Schema.String.pipe(Schema.brand('FilePath'));
export type FilePath = typeof FilePath.Type;

/**
 * File sync status.
 */
export const FileSyncStatus = Schema.Literal(
  'synced', // File content matches Y.Doc
  'dirty', // Y.Doc has unsaved changes
  'external_change', // File changed on disk
  'conflict', // Both file and Y.Doc changed
  'error' // Sync error occurred
);
export type FileSyncStatus = typeof FileSyncStatus.Type;

/**
 * File-to-document mapping entry stored in NATS KV.
 */
export const FileMapping = Schema.Struct({
  /** Absolute file path */
  path: FilePath,

  /** Associated document ID */
  documentId: DocumentId,

  /** File modification time when last synced (ms since epoch) */
  lastSyncedMtime: Schema.Number,

  /** Content hash when last synced (for conflict detection) */
  lastSyncedHash: Schema.String,

  /** Current sync status */
  syncStatus: FileSyncStatus,

  /** When mapping was created */
  createdAt: Schema.DateFromString,

  /** When mapping was last updated */
  updatedAt: Schema.DateFromString,
});
export type FileMapping = typeof FileMapping.Type;

/**
 * Payload for creating/updating a file mapping.
 */
export const FileMappingPayload = Schema.Struct({
  path: FilePath,
  mtime: Schema.Number,
  contentHash: Schema.String,
});
export type FileMappingPayload = typeof FileMappingPayload.Type;

// =============================================================================
// Errors
// =============================================================================

export class FileMappingError extends Error {
  readonly _tag = 'FileMappingError';
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'FileMappingError';
  }
}

export class FileMappingNotFoundError extends Error {
  readonly _tag = 'FileMappingNotFoundError';
  constructor(readonly path: FilePath) {
    super(`No mapping found for file: ${path}`);
    this.name = 'FileMappingNotFoundError';
  }
}

// =============================================================================
// Service Interface
// =============================================================================

export interface FileDocumentMappingServiceShape {
  /**
   * Get the document ID for a file path.
   * Returns null if no mapping exists.
   */
  readonly getByPath: (
    path: FilePath
  ) => Effect.Effect<FileMapping | null, FileMappingError>;

  /**
   * Get the file path for a document ID.
   * Returns null if no mapping exists.
   */
  readonly getByDocumentId: (
    documentId: DocumentId
  ) => Effect.Effect<FileMapping | null, FileMappingError>;

  /**
   * Get or create a mapping for a file.
   * If mapping exists, returns existing. Otherwise creates new with fresh docId.
   */
  readonly getOrCreate: (
    payload: FileMappingPayload
  ) => Effect.Effect<FileMapping, FileMappingError>;

  /**
   * Update sync status and mtime for an existing mapping.
   */
  readonly updateSync: (
    path: FilePath,
    mtime: number,
    contentHash: string,
    status: FileSyncStatus
  ) => Effect.Effect<FileMapping, FileMappingNotFoundError | FileMappingError>;

  /**
   * Mark a file as having external changes.
   */
  readonly markExternalChange: (
    path: FilePath,
    newMtime: number
  ) => Effect.Effect<FileMapping, FileMappingNotFoundError | FileMappingError>;

  /**
   * Mark a file as having local (editor) changes.
   */
  readonly markDirty: (
    path: FilePath
  ) => Effect.Effect<FileMapping, FileMappingNotFoundError | FileMappingError>;

  /**
   * Mark a file as synced after save.
   */
  readonly markSynced: (
    path: FilePath,
    mtime: number,
    contentHash: string
  ) => Effect.Effect<FileMapping, FileMappingNotFoundError | FileMappingError>;

  /**
   * Mark a conflict (both external and local changes).
   */
  readonly markConflict: (
    path: FilePath
  ) => Effect.Effect<FileMapping, FileMappingNotFoundError | FileMappingError>;

  /**
   * Remove a file mapping.
   */
  readonly remove: (path: FilePath) => Effect.Effect<void, FileMappingError>;

  /**
   * List all file mappings.
   */
  readonly list: () => Effect.Effect<readonly FileMapping[], FileMappingError>;

  /**
   * Watch for mapping changes.
   */
  readonly watch: () => Stream.Stream<
    KvWatchEvent<FileMapping>,
    FileMappingError
  >;

  /**
   * Check if a file has external changes by comparing mtime.
   */
  readonly hasExternalChanges: (
    path: FilePath,
    currentMtime: number
  ) => Effect.Effect<boolean, FileMappingNotFoundError | FileMappingError>;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert file path to KV key.
 * Uses base64url encoding to handle special characters (including unicode) in paths.
 * Browser-compatible implementation using btoa/atob.
 */
export const pathToKey = (path: FilePath): string => {
  // Encode to UTF-8 bytes
  const bytes = new TextEncoder().encode(path);
  // Convert bytes to binary string
  const binaryString = String.fromCharCode(...bytes);
  // Encode to base64 using browser API
  const base64 = btoa(binaryString);
  // Convert to base64url (safe for KV keys)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * Decode a KV key back to file path.
 * Exported for potential future use (e.g., debugging, reverse lookups).
 * Browser-compatible implementation using btoa/atob.
 */
export const keyToPath = (key: string): FilePath => {
  // Convert from base64url back to base64
  const base64 = key.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  // Decode from base64 to binary string using browser API
  const binaryString = atob(padded);
  // Convert binary string to bytes
  const bytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes) as FilePath;
};

// =============================================================================
// Service Implementation
// =============================================================================

export class FileDocumentMappingService extends Effect.Service<FileDocumentMappingService>()(
  'tmnl/editor/FileDocumentMappingService',
  {
    effect: Effect.gen(function* () {
      const natsKv = yield* NatsKVService;

      // Initialize bucket (lazy)
      let bucket: KV | null = null;

      const ensureBucket = Effect.gen(function* () {
        if (bucket === null) {
          bucket = yield* natsKv
            .getOrCreateBucket(BUCKET_NAME, {
              history: BUCKET_HISTORY,
            })
            .pipe(
              Effect.mapError(
                (e) =>
                  new FileMappingError(`Failed to init bucket: ${e.message}`, e)
              )
            );
        }
        return bucket;
      });

      // --- GET BY PATH ---
      const getByPath = (
        path: FilePath
      ): Effect.Effect<FileMapping | null, FileMappingError> =>
        Effect.gen(function* () {
          const b = yield* ensureBucket;
          const key = pathToKey(path);

          return yield* natsKv
            .get(b, key, FileMapping)
            .pipe(
              Effect.mapError(
                (e) => new FileMappingError(`Failed to get mapping: ${e}`, e)
              )
            );
        });

      // --- GET BY DOCUMENT ID ---
      const getByDocumentId = (
        documentId: DocumentId
      ): Effect.Effect<FileMapping | null, FileMappingError> =>
        Effect.gen(function* () {
          const all = yield* list();
          return all.find((m) => m.documentId === documentId) ?? null;
        });

      // --- GET OR CREATE ---
      const getOrCreate = (
        payload: FileMappingPayload
      ): Effect.Effect<FileMapping, FileMappingError> =>
        Effect.gen(function* () {
          const existing = yield* getByPath(payload.path);

          if (existing) {
            return existing;
          }

          // Create new mapping
          const b = yield* ensureBucket;
          const key = pathToKey(payload.path);
          const now = new Date();

          const mapping: FileMapping = {
            path: payload.path,
            documentId: generateDocumentId(),
            lastSyncedMtime: payload.mtime,
            lastSyncedHash: payload.contentHash,
            syncStatus: 'synced',
            createdAt: now,
            updatedAt: now,
          };

          yield* natsKv
            .put(b, key, mapping, FileMapping)
            .pipe(
              Effect.mapError(
                (e) => new FileMappingError(`Failed to create mapping: ${e}`, e)
              )
            );

          return mapping;
        });

      // --- UPDATE SYNC ---
      const updateSync = (
        path: FilePath,
        mtime: number,
        contentHash: string,
        status: FileSyncStatus
      ): Effect.Effect<
        FileMapping,
        FileMappingNotFoundError | FileMappingError
      > =>
        Effect.gen(function* () {
          const existing = yield* getByPath(path);

          if (!existing) {
            return yield* Effect.fail(new FileMappingNotFoundError(path));
          }

          const b = yield* ensureBucket;
          const key = pathToKey(path);

          const updated: FileMapping = {
            ...existing,
            lastSyncedMtime: mtime,
            lastSyncedHash: contentHash,
            syncStatus: status,
            updatedAt: new Date(),
          };

          yield* natsKv
            .put(b, key, updated, FileMapping)
            .pipe(
              Effect.mapError(
                (e) => new FileMappingError(`Failed to update mapping: ${e}`, e)
              )
            );

          return updated;
        });

      // --- MARK EXTERNAL CHANGE ---
      const markExternalChange = (
        path: FilePath,
        _newMtime: number
      ): Effect.Effect<
        FileMapping,
        FileMappingNotFoundError | FileMappingError
      > =>
        Effect.gen(function* () {
          const existing = yield* getByPath(path);

          if (!existing) {
            return yield* Effect.fail(new FileMappingNotFoundError(path));
          }

          const b = yield* ensureBucket;
          const key = pathToKey(path);

          // If already dirty, this becomes a conflict
          const newStatus: FileSyncStatus =
            existing.syncStatus === 'dirty' ? 'conflict' : 'external_change';

          const updated: FileMapping = {
            ...existing,
            syncStatus: newStatus,
            updatedAt: new Date(),
          };

          yield* natsKv
            .put(b, key, updated, FileMapping)
            .pipe(
              Effect.mapError(
                (e) => new FileMappingError(`Failed to update mapping: ${e}`, e)
              )
            );

          return updated;
        });

      // --- MARK DIRTY ---
      const markDirty = (
        path: FilePath
      ): Effect.Effect<
        FileMapping,
        FileMappingNotFoundError | FileMappingError
      > =>
        Effect.gen(function* () {
          const existing = yield* getByPath(path);

          if (!existing) {
            return yield* Effect.fail(new FileMappingNotFoundError(path));
          }

          // If already has external changes, this becomes a conflict
          if (existing.syncStatus === 'external_change') {
            return yield* markConflict(path);
          }

          const b = yield* ensureBucket;
          const key = pathToKey(path);

          const updated: FileMapping = {
            ...existing,
            syncStatus: 'dirty',
            updatedAt: new Date(),
          };

          yield* natsKv
            .put(b, key, updated, FileMapping)
            .pipe(
              Effect.mapError(
                (e) => new FileMappingError(`Failed to update mapping: ${e}`, e)
              )
            );

          return updated;
        });

      // --- MARK SYNCED ---
      const markSynced = (
        path: FilePath,
        mtime: number,
        contentHash: string
      ): Effect.Effect<
        FileMapping,
        FileMappingNotFoundError | FileMappingError
      > => updateSync(path, mtime, contentHash, 'synced');

      // --- MARK CONFLICT ---
      const markConflict = (
        path: FilePath
      ): Effect.Effect<
        FileMapping,
        FileMappingNotFoundError | FileMappingError
      > =>
        Effect.gen(function* () {
          const existing = yield* getByPath(path);

          if (!existing) {
            return yield* Effect.fail(new FileMappingNotFoundError(path));
          }

          const b = yield* ensureBucket;
          const key = pathToKey(path);

          const updated: FileMapping = {
            ...existing,
            syncStatus: 'conflict',
            updatedAt: new Date(),
          };

          yield* natsKv
            .put(b, key, updated, FileMapping)
            .pipe(
              Effect.mapError(
                (e) => new FileMappingError(`Failed to update mapping: ${e}`, e)
              )
            );

          return updated;
        });

      // --- REMOVE ---
      const remove = (path: FilePath): Effect.Effect<void, FileMappingError> =>
        Effect.gen(function* () {
          const b = yield* ensureBucket;
          const key = pathToKey(path);

          yield* natsKv
            .delete(b, key)
            .pipe(
              Effect.mapError(
                (e) => new FileMappingError(`Failed to remove mapping: ${e}`, e)
              )
            );
        });

      // --- LIST ---
      const list = (): Effect.Effect<
        readonly FileMapping[],
        FileMappingError
      > =>
        Effect.gen(function* () {
          const b = yield* ensureBucket;

          const entries = yield* natsKv
            .list(b, FileMapping)
            .pipe(
              Effect.mapError(
                (e) => new FileMappingError(`Failed to list mappings: ${e}`, e)
              )
            );

          return entries.map((e) => e.value);
        });

      // --- WATCH ---
      const watch = (): Stream.Stream<
        KvWatchEvent<FileMapping>,
        FileMappingError
      > =>
        Stream.unwrap(
          Effect.gen(function* () {
            const b = yield* ensureBucket;

            return natsKv
              .watch(b, '>', FileMapping)
              .pipe(
                Stream.mapError(
                  (e) => new FileMappingError(`Watch failed: ${e}`, e)
                )
              );
          })
        );

      // --- HAS EXTERNAL CHANGES ---
      const hasExternalChanges = (
        path: FilePath,
        currentMtime: number
      ): Effect.Effect<boolean, FileMappingNotFoundError | FileMappingError> =>
        Effect.gen(function* () {
          const mapping = yield* getByPath(path);

          if (!mapping) {
            return yield* Effect.fail(new FileMappingNotFoundError(path));
          }

          return currentMtime !== mapping.lastSyncedMtime;
        });

      return {
        getByPath,
        getByDocumentId,
        getOrCreate,
        updateSync,
        markExternalChange,
        markDirty,
        markSynced,
        markConflict,
        remove,
        list,
        watch,
        hasExternalChanges,
      } satisfies FileDocumentMappingServiceShape;
    }),
    dependencies: [NatsKVService.Default],
  }
) {}

// =============================================================================
// Layer Exports
// =============================================================================

export const FileDocumentMappingServiceLive =
  FileDocumentMappingService.Default;
