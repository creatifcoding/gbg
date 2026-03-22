/**
 * SQLite Repositories for Editor Persistence
 *
 * Uses @effect/sql Model.makeRepository for typed CRUD.
 * See .edin/EFFECT_SQL_SQLITE_PATTERNS.md for patterns.
 *
 * @module editor/v3/persistence/repositories
 */

import { Model, SqlClient } from '@effect/sql';
import { SqlError } from '@effect/sql/SqlError';
import { Context, Effect, Layer, Option } from 'effect';

import { DocumentId } from '../schemas/document';
import {
  FilePath,
  FileSyncStatus,
} from '../services/FileDocumentMappingService';
import {
  DocumentMetadataCacheModel,
  FileMappingModel,
  RecentDocumentModel,
} from './models';

// =============================================================================
// Repository Types
// =============================================================================

export interface FileMappingRepository {
  readonly insert: (
    insert: typeof FileMappingModel.insert.Type
  ) => Effect.Effect<FileMappingModel, SqlError>;
  readonly insertVoid: (
    insert: typeof FileMappingModel.insert.Type
  ) => Effect.Effect<void, SqlError>;
  readonly update: (
    update: typeof FileMappingModel.update.Type
  ) => Effect.Effect<FileMappingModel, SqlError>;
  readonly updateVoid: (
    update: typeof FileMappingModel.update.Type
  ) => Effect.Effect<void, SqlError>;
  readonly findById: (
    path: FilePath
  ) => Effect.Effect<Option.Option<FileMappingModel>, SqlError>;
  readonly delete: (path: FilePath) => Effect.Effect<void, SqlError>;

  // Custom queries
  readonly findByDocumentId: (
    documentId: DocumentId
  ) => Effect.Effect<Option.Option<FileMappingModel>, SqlError>;
  readonly listAll: () => Effect.Effect<readonly FileMappingModel[], SqlError>;
  readonly updateSyncStatus: (
    path: FilePath,
    status: FileSyncStatus,
    mtime?: number,
    hash?: string
  ) => Effect.Effect<void, SqlError>;
}

export interface RecentDocumentRepository {
  readonly insert: (
    insert: typeof RecentDocumentModel.insert.Type
  ) => Effect.Effect<RecentDocumentModel, SqlError>;
  readonly update: (
    update: typeof RecentDocumentModel.update.Type
  ) => Effect.Effect<RecentDocumentModel, SqlError>;
  readonly findById: (
    id: number
  ) => Effect.Effect<Option.Option<RecentDocumentModel>, SqlError>;
  readonly delete: (id: number) => Effect.Effect<void, SqlError>;

  // Custom queries
  readonly findByDocumentId: (
    documentId: DocumentId
  ) => Effect.Effect<Option.Option<RecentDocumentModel>, SqlError>;
  readonly listRecent: (
    limit: number
  ) => Effect.Effect<readonly RecentDocumentModel[], SqlError>;
  readonly touch: (documentId: DocumentId) => Effect.Effect<void, SqlError>;
  readonly upsert: (
    documentId: DocumentId,
    title: string,
    filePath?: string
  ) => Effect.Effect<RecentDocumentModel, SqlError>;
  readonly prune: (keepCount: number) => Effect.Effect<number, SqlError>;
}

export interface DocumentMetadataCacheRepository {
  readonly insert: (
    insert: typeof DocumentMetadataCacheModel.insert.Type
  ) => Effect.Effect<DocumentMetadataCacheModel, SqlError>;
  readonly update: (
    update: typeof DocumentMetadataCacheModel.update.Type
  ) => Effect.Effect<DocumentMetadataCacheModel, SqlError>;
  readonly findById: (
    documentId: DocumentId
  ) => Effect.Effect<Option.Option<DocumentMetadataCacheModel>, SqlError>;
  readonly delete: (documentId: DocumentId) => Effect.Effect<void, SqlError>;

  // Custom queries
  readonly upsertStats: (
    documentId: DocumentId,
    title: string,
    wordCount: number,
    charCount: number
  ) => Effect.Effect<void, SqlError>;
}

// =============================================================================
// Context Tags
// =============================================================================

export class FileMappingRepo extends Context.Tag('tmnl/editor/FileMappingRepo')<
  FileMappingRepo,
  FileMappingRepository
>() {}

export class RecentDocumentRepo extends Context.Tag(
  'tmnl/editor/RecentDocumentRepo'
)<RecentDocumentRepo, RecentDocumentRepository>() {}

export class DocumentMetadataCacheRepo extends Context.Tag(
  'tmnl/editor/DocumentMetadataCacheRepo'
)<DocumentMetadataCacheRepo, DocumentMetadataCacheRepository>() {}

// =============================================================================
// Repository Implementations
// =============================================================================

/**
 * Live implementation of FileMappingRepository.
 */
export const FileMappingRepoLive = Layer.effect(
  FileMappingRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    // Base repository from Model
    const baseRepo = yield* Model.makeRepository(FileMappingModel, {
      tableName: 'file_mappings',
      idColumn: 'path',
      spanPrefix: 'FileMappingRepo',
    });

    // Custom queries
    const findByDocumentId = (
      documentId: DocumentId
    ): Effect.Effect<Option.Option<FileMappingModel>, SqlError> =>
      Effect.gen(function* () {
        const rows = yield* sql<FileMappingModel>`
          SELECT * FROM file_mappings WHERE documentId = ${documentId} LIMIT 1
        `;
        return rows.length > 0 ? Option.some(rows[0]) : Option.none();
      });

    const listAll = (): Effect.Effect<readonly FileMappingModel[], SqlError> =>
      sql<FileMappingModel>`SELECT * FROM file_mappings ORDER BY updatedAt DESC`;

    const updateSyncStatus = (
      path: FilePath,
      status: FileSyncStatus,
      mtime?: number,
      hash?: string
    ): Effect.Effect<void, SqlError> =>
      Effect.gen(function* () {
        if (mtime !== undefined && hash !== undefined) {
          yield* sql`
            UPDATE file_mappings
            SET syncStatus = ${status},
                lastSyncedMtime = ${mtime},
                lastSyncedHash = ${hash},
                updatedAt = ${new Date().toISOString()}
            WHERE path = ${path}
          `;
        } else {
          yield* sql`
            UPDATE file_mappings
            SET syncStatus = ${status},
                updatedAt = ${new Date().toISOString()}
            WHERE path = ${path}
          `;
        }
      });

    return {
      ...baseRepo,
      findByDocumentId,
      listAll,
      updateSyncStatus,
    } satisfies FileMappingRepository;
  })
);

/**
 * Live implementation of RecentDocumentRepository.
 */
export const RecentDocumentRepoLive = Layer.effect(
  RecentDocumentRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    // Base repository from Model
    const baseRepo = yield* Model.makeRepository(RecentDocumentModel, {
      tableName: 'recent_documents',
      idColumn: 'id',
      spanPrefix: 'RecentDocumentRepo',
    });

    const findByDocumentId = (
      documentId: DocumentId
    ): Effect.Effect<Option.Option<RecentDocumentModel>, SqlError> =>
      Effect.gen(function* () {
        const rows = yield* sql<RecentDocumentModel>`
          SELECT * FROM recent_documents WHERE documentId = ${documentId} LIMIT 1
        `;
        return rows.length > 0 ? Option.some(rows[0]) : Option.none();
      });

    const listRecent = (
      limit: number
    ): Effect.Effect<readonly RecentDocumentModel[], SqlError> =>
      sql<RecentDocumentModel>`
        SELECT * FROM recent_documents
        ORDER BY lastAccessedAt DESC
        LIMIT ${limit}
      `;

    const touch = (documentId: DocumentId): Effect.Effect<void, SqlError> =>
      sql`
        UPDATE recent_documents
        SET lastAccessedAt = ${new Date().toISOString()},
            accessCount = accessCount + 1
        WHERE documentId = ${documentId}
      `.pipe(Effect.asVoid);

    const upsert = (
      documentId: DocumentId,
      title: string,
      filePath?: string
    ): Effect.Effect<RecentDocumentModel, SqlError> =>
      Effect.gen(function* () {
        const existing = yield* findByDocumentId(documentId);

        if (Option.isSome(existing)) {
          // Update existing
          yield* sql`
            UPDATE recent_documents
            SET title = ${title},
                filePath = ${filePath ?? null},
                lastAccessedAt = ${new Date().toISOString()},
                accessCount = accessCount + 1
            WHERE documentId = ${documentId}
          `;
          // Return updated
          const updated = yield* findByDocumentId(documentId);
          return Option.getOrThrow(updated);
        } else {
          // Insert new
          return yield* baseRepo.insert(
            RecentDocumentModel.insert.make({
              documentId:
                documentId as typeof RecentDocumentModel.fields.documentId.Type,
              title,
              filePath: filePath ?? null,
              accessCount: 1,
              metadata: Option.none(),
            })
          );
        }
      });

    const prune = (keepCount: number): Effect.Effect<number, SqlError> =>
      Effect.gen(function* () {
        // Count before deletion
        const beforeRows = yield* sql<{ count: number }>`
          SELECT COUNT(*) as count FROM recent_documents
        `;
        const beforeCount = beforeRows[0]?.count ?? 0;

        // Delete oldest entries beyond keepCount
        yield* sql`
          DELETE FROM recent_documents
          WHERE id NOT IN (
            SELECT id FROM recent_documents
            ORDER BY lastAccessedAt DESC
            LIMIT ${keepCount}
          )
        `;

        // Count after deletion
        const afterRows = yield* sql<{ count: number }>`
          SELECT COUNT(*) as count FROM recent_documents
        `;
        const afterCount = afterRows[0]?.count ?? 0;

        return beforeCount - afterCount;
      });

    return {
      ...baseRepo,
      findByDocumentId,
      listRecent,
      touch,
      upsert,
      prune,
    } satisfies RecentDocumentRepository;
  })
);

/**
 * Live implementation of DocumentMetadataCacheRepository.
 */
export const DocumentMetadataCacheRepoLive = Layer.effect(
  DocumentMetadataCacheRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    // Base repository from Model
    const baseRepo = yield* Model.makeRepository(DocumentMetadataCacheModel, {
      tableName: 'document_metadata_cache',
      idColumn: 'documentId',
      spanPrefix: 'DocumentMetadataCacheRepo',
    });

    const upsertStats = (
      documentId: DocumentId,
      title: string,
      wordCount: number,
      charCount: number
    ): Effect.Effect<void, SqlError> =>
      Effect.gen(function* () {
        const existing = yield* baseRepo.findById(documentId);

        if (Option.isSome(existing)) {
          yield* sql`
            UPDATE document_metadata_cache
            SET title = ${title},
                wordCount = ${wordCount},
                charCount = ${charCount},
                updatedAt = ${new Date().toISOString()}
            WHERE documentId = ${documentId}
          `;
        } else {
          yield* baseRepo.insert(
            DocumentMetadataCacheModel.insert.make({
              documentId,
              title,
              wordCount,
              charCount,
              filePath: null,
              tagsJson: null,
            })
          );
        }
      });

    return {
      ...baseRepo,
      upsertStats,
    } satisfies DocumentMetadataCacheRepository;
  })
);

// =============================================================================
// Combined Layer
// =============================================================================

/**
 * All repository layers combined.
 * Requires SqlClient to be provided.
 */
export const AllRepositoriesLive = Layer.mergeAll(
  FileMappingRepoLive,
  RecentDocumentRepoLive,
  DocumentMetadataCacheRepoLive
);
