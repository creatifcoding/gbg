/**
 * BlockRegistryPersistence Service
 *
 * SQLite persistence layer for the BlockRegistry.
 * Implements the fat JSON blob pattern for block-isolated restore data.
 *
 * Architecture:
 * - BlockRegistry (in-memory) ↔ BlockRegistryPersistence (SQLite)
 * - On startup: load all blocks from SQLite → hydrate BlockRegistry
 * - On changes: BlockRegistry events → persist to SQLite
 *
 * @module editor/v3/extensions/blocks/EmbeddedBlockWrapper/registry/persistence
 */

import { SqlClient } from '@effect/sql';
import { SqlError } from '@effect/sql/SqlError';
import { Context, Effect, Layer, Option, Stream } from 'effect';

import {
  BlockId,
  BlockName,
  BlockType,
  DocumentId,
  BlockRef,
} from '../../shared';

import {
  PersistedBlock,
  PersistedBlockRow,
  BlockRestoreData,
  BlockRegistryPersistenceError,
  persistedBlockFromRow,
  persistedBlockToRow,
  emptyRestoreData,
} from './schemas';

// =============================================================================
// Repository Interface
// =============================================================================

export interface BlockRegistryRepository {
  /**
   * Insert a new block into the registry
   */
  readonly insert: (
    block: PersistedBlock
  ) => Effect.Effect<PersistedBlock, SqlError>;

  /**
   * Find a block by ID
   */
  readonly findById: (
    blockId: BlockId
  ) => Effect.Effect<Option.Option<PersistedBlock>, SqlError>;

  /**
   * Find a block by name within a document
   */
  readonly findByName: (
    documentId: DocumentId,
    name: BlockName
  ) => Effect.Effect<Option.Option<PersistedBlock>, SqlError>;

  /**
   * Update an existing block
   */
  readonly update: (
    block: PersistedBlock
  ) => Effect.Effect<PersistedBlock, SqlError>;

  /**
   * Delete a block by ID
   */
  readonly delete: (blockId: BlockId) => Effect.Effect<void, SqlError>;

  /**
   * List all blocks for a document
   */
  readonly listByDocument: (
    documentId: DocumentId
  ) => Effect.Effect<readonly PersistedBlock[], SqlError>;

  /**
   * Upsert (insert or update) a block
   */
  readonly upsert: (
    block: PersistedBlock
  ) => Effect.Effect<PersistedBlock, SqlError>;

  /**
   * Update only the restore data for a block
   */
  readonly updateRestoreData: (
    blockId: BlockId,
    restoreData: BlockRestoreData
  ) => Effect.Effect<PersistedBlock, SqlError>;

  /**
   * Update only the name for a block
   */
  readonly updateName: (
    blockId: BlockId,
    name: BlockName | null
  ) => Effect.Effect<PersistedBlock, SqlError>;
}

// =============================================================================
// Repository Context Tag
// =============================================================================

export class BlockRegistryRepo extends Context.Tag(
  'tmnl/editor/BlockRegistryRepo'
)<BlockRegistryRepo, BlockRegistryRepository>() {}

// =============================================================================
// Repository Implementation
// =============================================================================

export const BlockRegistryRepoLive = Layer.effect(
  BlockRegistryRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const insert = (
      block: PersistedBlock
    ): Effect.Effect<PersistedBlock, SqlError> =>
      Effect.gen(function* () {
        const row = persistedBlockToRow(block);
        yield* sql`
          INSERT INTO block_registry (
            id, name, type, document_id, registered_at, named_at,
            restore_data, schema_version, updated_at
          ) VALUES (
            ${row.id}, ${row.name}, ${row.type}, ${row.document_id},
            ${row.registered_at}, ${row.named_at}, ${row.restore_data},
            ${row.schema_version}, ${row.updated_at}
          )
        `;
        return block;
      });

    const findById = (
      blockId: BlockId
    ): Effect.Effect<Option.Option<PersistedBlock>, SqlError> =>
      Effect.gen(function* () {
        const rows = yield* sql<PersistedBlockRow>`
          SELECT * FROM block_registry WHERE id = ${blockId}
        `;
        if (rows.length === 0) {
          return Option.none();
        }
        return Option.some(persistedBlockFromRow(rows[0]));
      });

    const findByName = (
      documentId: DocumentId,
      name: BlockName
    ): Effect.Effect<Option.Option<PersistedBlock>, SqlError> =>
      Effect.gen(function* () {
        const rows = yield* sql<PersistedBlockRow>`
          SELECT * FROM block_registry 
          WHERE document_id = ${documentId} AND name = ${name}
        `;
        if (rows.length === 0) {
          return Option.none();
        }
        return Option.some(persistedBlockFromRow(rows[0]));
      });

    const update = (
      block: PersistedBlock
    ): Effect.Effect<PersistedBlock, SqlError> =>
      Effect.gen(function* () {
        const row = persistedBlockToRow(block);
        yield* sql`
          UPDATE block_registry SET
            name = ${row.name},
            type = ${row.type},
            document_id = ${row.document_id},
            registered_at = ${row.registered_at},
            named_at = ${row.named_at},
            restore_data = ${row.restore_data},
            schema_version = ${row.schema_version},
            updated_at = ${row.updated_at}
          WHERE id = ${row.id}
        `;
        return block;
      });

    const deleteBlock = (blockId: BlockId): Effect.Effect<void, SqlError> =>
      Effect.gen(function* () {
        yield* sql`DELETE FROM block_registry WHERE id = ${blockId}`;
      });

    const listByDocument = (
      documentId: DocumentId
    ): Effect.Effect<readonly PersistedBlock[], SqlError> =>
      Effect.gen(function* () {
        const rows = yield* sql<PersistedBlockRow>`
          SELECT * FROM block_registry 
          WHERE document_id = ${documentId}
          ORDER BY registered_at ASC
        `;
        return rows.map(persistedBlockFromRow);
      });

    const upsert = (
      block: PersistedBlock
    ): Effect.Effect<PersistedBlock, SqlError> =>
      Effect.gen(function* () {
        const existing = yield* findById(block.id);
        if (Option.isSome(existing)) {
          return yield* update(block);
        } else {
          return yield* insert(block);
        }
      });

    const updateRestoreData = (
      blockId: BlockId,
      restoreData: BlockRestoreData
    ): Effect.Effect<PersistedBlock, SqlError> =>
      Effect.gen(function* () {
        const now = new Date().toISOString();
        const restoreDataJson = JSON.stringify(restoreData);

        yield* sql`
          UPDATE block_registry SET
            restore_data = ${restoreDataJson},
            updated_at = ${now}
          WHERE id = ${blockId}
        `;

        const updated = yield* findById(blockId);
        return Option.getOrThrow(updated);
      });

    const updateName = (
      blockId: BlockId,
      name: BlockName | null
    ): Effect.Effect<PersistedBlock, SqlError> =>
      Effect.gen(function* () {
        const now = new Date().toISOString();
        const namedAt = name ? now : null;

        yield* sql`
          UPDATE block_registry SET
            name = ${name},
            named_at = ${namedAt},
            updated_at = ${now}
          WHERE id = ${blockId}
        `;

        const updated = yield* findById(blockId);
        return Option.getOrThrow(updated);
      });

    return {
      insert,
      findById,
      findByName,
      update,
      delete: deleteBlock,
      listByDocument,
      upsert,
      updateRestoreData,
      updateName,
    } satisfies BlockRegistryRepository;
  })
);

// =============================================================================
// Service Interface
// =============================================================================

export interface BlockRegistryPersistenceShape {
  /**
   * Persist a BlockRef to SQLite (creates PersistedBlock with empty restore data)
   */
  readonly persistBlock: (
    ref: BlockRef
  ) => Effect.Effect<PersistedBlock, BlockRegistryPersistenceError>;

  /**
   * Load a block from SQLite by ID
   */
  readonly loadBlock: (
    blockId: string
  ) => Effect.Effect<PersistedBlock | null, BlockRegistryPersistenceError>;

  /**
   * Load all blocks for a document
   */
  readonly loadAllBlocks: (
    documentId: string
  ) => Effect.Effect<readonly PersistedBlock[], BlockRegistryPersistenceError>;

  /**
   * Update block name in SQLite
   */
  readonly updateBlockName: (
    blockId: string,
    name: string | null
  ) => Effect.Effect<PersistedBlock, BlockRegistryPersistenceError>;

  /**
   * Update restore data for a block
   */
  readonly updateRestoreData: (
    blockId: string,
    data: Partial<BlockRestoreData>
  ) => Effect.Effect<PersistedBlock, BlockRegistryPersistenceError>;

  /**
   * Delete a block from SQLite
   */
  readonly deleteBlock: (
    blockId: string
  ) => Effect.Effect<void, BlockRegistryPersistenceError>;

  /**
   * Hydrate BlockRegistry from SQLite (returns BlockRefs for in-memory use)
   */
  readonly hydrateRegistry: (
    documentId: string
  ) => Effect.Effect<readonly BlockRef[], BlockRegistryPersistenceError>;

  /**
   * Stream of blocks for a document (for lazy loading)
   */
  readonly streamBlocks: (
    documentId: string
  ) => Stream.Stream<PersistedBlock, BlockRegistryPersistenceError>;
}

// =============================================================================
// Service Context Tag
// =============================================================================

export class BlockRegistryPersistence extends Context.Tag(
  'tmnl/editor/BlockRegistryPersistence'
)<BlockRegistryPersistence, BlockRegistryPersistenceShape>() {}

// =============================================================================
// Service Implementation
// =============================================================================

export const BlockRegistryPersistenceLive = Layer.effect(
  BlockRegistryPersistence,
  Effect.gen(function* () {
    const repo = yield* BlockRegistryRepo;

    const persistBlock: BlockRegistryPersistenceShape['persistBlock'] = (ref) =>
      Effect.gen(function* () {
        const persisted = PersistedBlock.fromBlockRef(ref);
        return yield* repo.upsert(persisted);
      }).pipe(
        Effect.mapError(
          (cause) =>
            new BlockRegistryPersistenceError({
              blockId: ref.id,
              operation: 'save',
              cause,
              message: `Failed to persist block: ${ref.id}`,
            })
        ),
        Effect.withSpan('BlockRegistryPersistence.persistBlock', {
          attributes: { blockId: ref.id },
        })
      );

    const loadBlock: BlockRegistryPersistenceShape['loadBlock'] = (blockId) =>
      Effect.gen(function* () {
        const result = yield* repo.findById(blockId as BlockId);
        return Option.getOrNull(result);
      }).pipe(
        Effect.mapError(
          (cause) =>
            new BlockRegistryPersistenceError({
              blockId: blockId as BlockId,
              operation: 'load',
              cause,
              message: `Failed to load block: ${blockId}`,
            })
        ),
        Effect.withSpan('BlockRegistryPersistence.loadBlock', {
          attributes: { blockId },
        })
      );

    const loadAllBlocks: BlockRegistryPersistenceShape['loadAllBlocks'] = (
      documentId
    ) =>
      repo.listByDocument(documentId as DocumentId).pipe(
        Effect.mapError(
          (cause) =>
            new BlockRegistryPersistenceError({
              blockId: null,
              operation: 'loadAll',
              cause,
              message: `Failed to load blocks for document: ${documentId}`,
            })
        ),
        Effect.withSpan('BlockRegistryPersistence.loadAllBlocks', {
          attributes: { documentId },
        })
      );

    const updateBlockName: BlockRegistryPersistenceShape['updateBlockName'] = (
      blockId,
      name
    ) =>
      repo.updateName(blockId as BlockId, name as BlockName | null).pipe(
        Effect.mapError(
          (cause) =>
            new BlockRegistryPersistenceError({
              blockId: blockId as BlockId,
              operation: 'save',
              cause,
              message: `Failed to update block name: ${blockId}`,
            })
        ),
        Effect.withSpan('BlockRegistryPersistence.updateBlockName', {
          attributes: { blockId, name },
        })
      );

    const updateRestoreData: BlockRegistryPersistenceShape['updateRestoreData'] =
      (blockId, data) =>
        Effect.gen(function* () {
          // Load existing to merge
          const existing = yield* repo.findById(blockId as BlockId);
          const current = Option.isSome(existing)
            ? existing.value.restoreData
            : emptyRestoreData;

          const merged: BlockRestoreData = { ...current, ...data };
          return yield* repo.updateRestoreData(blockId as BlockId, merged);
        }).pipe(
          Effect.mapError(
            (cause) =>
              new BlockRegistryPersistenceError({
                blockId: blockId as BlockId,
                operation: 'save',
                cause,
                message: `Failed to update restore data: ${blockId}`,
              })
          ),
          Effect.withSpan('BlockRegistryPersistence.updateRestoreData', {
            attributes: { blockId },
          })
        );

    const deleteBlock: BlockRegistryPersistenceShape['deleteBlock'] = (
      blockId
    ) =>
      repo.delete(blockId as BlockId).pipe(
        Effect.mapError(
          (cause) =>
            new BlockRegistryPersistenceError({
              blockId: blockId as BlockId,
              operation: 'delete',
              cause,
              message: `Failed to delete block: ${blockId}`,
            })
        ),
        Effect.withSpan('BlockRegistryPersistence.deleteBlock', {
          attributes: { blockId },
        })
      );

    const hydrateRegistry: BlockRegistryPersistenceShape['hydrateRegistry'] = (
      documentId
    ) =>
      Effect.gen(function* () {
        const blocks = yield* loadAllBlocks(documentId);
        return blocks.map((b) => b.toBlockRef());
      }).pipe(
        Effect.withSpan('BlockRegistryPersistence.hydrateRegistry', {
          attributes: { documentId },
        })
      );

    const streamBlocks: BlockRegistryPersistenceShape['streamBlocks'] = (
      documentId
    ) =>
      Stream.fromEffect(loadAllBlocks(documentId)).pipe(
        Stream.flatMap((blocks) => Stream.fromIterable(blocks))
      );

    return {
      persistBlock,
      loadBlock,
      loadAllBlocks,
      updateBlockName,
      updateRestoreData,
      deleteBlock,
      hydrateRegistry,
      streamBlocks,
    } satisfies BlockRegistryPersistenceShape;
  })
);

// =============================================================================
// Combined Layer
// =============================================================================

/**
 * All block registry persistence layers combined.
 * Requires SqlClient to be provided.
 */
export const BlockRegistryPersistenceLayer = BlockRegistryPersistenceLive.pipe(
  Layer.provide(BlockRegistryRepoLive)
);
