/**
 * BlockStateService
 *
 * Effect.Service for block state persistence.
 * Enables save/restore of block state during focus mode transitions.
 *
 * @module editor/v3/extensions/blocks/EmbeddedBlockWrapper/persistence
 */

import { Model, SqlClient } from '@effect/sql';
import { SqlError } from '@effect/sql/SqlError';
import { Context, Effect, Layer, Option, Schedule, Stream } from 'effect';

import { BlockStateModel } from '../../../../persistence/models';
import {
  BlockId,
  BlockState,
  FocusState,
  BlockStateNotFound,
  BlockStatePersistenceError,
} from './schemas';
import type { FoldState } from '../types';

// =============================================================================
// Repository Interface
// =============================================================================

export interface BlockStateRepository {
  readonly insert: (
    insert: typeof BlockStateModel.insert.Type
  ) => Effect.Effect<BlockStateModel, SqlError>;
  readonly findById: (
    blockId: BlockId
  ) => Effect.Effect<Option.Option<BlockStateModel>, SqlError>;
  readonly delete: (blockId: BlockId) => Effect.Effect<void, SqlError>;

  // Custom queries
  readonly upsert: (
    blockId: BlockId,
    foldState: FoldState,
    settingsOpen: boolean,
    activeTab: string,
    nodeAttrs: unknown
  ) => Effect.Effect<BlockStateModel, SqlError>;
  readonly listAll: () => Effect.Effect<readonly BlockStateModel[], SqlError>;
  readonly pruneOlderThan: (
    maxAgeMs: number
  ) => Effect.Effect<number, SqlError>;
}

// =============================================================================
// Repository Context Tag
// =============================================================================

export class BlockStateRepo extends Context.Tag('tmnl/editor/BlockStateRepo')<
  BlockStateRepo,
  BlockStateRepository
>() {}

// =============================================================================
// Repository Implementation
// =============================================================================

export const BlockStateRepoLive = Layer.effect(
  BlockStateRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    // Base repository from Model
    const baseRepo = yield* Model.makeRepository(BlockStateModel, {
      tableName: 'block_states',
      idColumn: 'blockId',
      spanPrefix: 'BlockStateRepo',
    });

    const upsert = (
      blockId: BlockId,
      foldState: FoldState,
      settingsOpen: boolean,
      activeTab: string,
      nodeAttrs: unknown
    ): Effect.Effect<BlockStateModel, SqlError> =>
      Effect.gen(function* () {
        const existing = yield* baseRepo.findById(blockId);
        const now = new Date().toISOString();
        const attrsJson = JSON.stringify(nodeAttrs);

        if (Option.isSome(existing)) {
          yield* sql`
            UPDATE block_states
            SET fold_state = ${foldState},
                settings_open = ${settingsOpen ? 1 : 0},
                active_tab = ${activeTab},
                node_attrs = ${attrsJson},
                saved_at = ${now}
            WHERE block_id = ${blockId}
          `;
          const updated = yield* baseRepo.findById(blockId);
          return Option.getOrThrow(updated);
        } else {
          return yield* baseRepo.insert(
            BlockStateModel.insert.make({
              blockId,
              foldState,
              settingsOpen,
              activeTab,
              nodeAttrs: attrsJson,
            })
          );
        }
      });

    const listAll = (): Effect.Effect<readonly BlockStateModel[], SqlError> =>
      sql<BlockStateModel>`SELECT * FROM block_states ORDER BY saved_at DESC`;

    const pruneOlderThan = (
      maxAgeMs: number
    ): Effect.Effect<number, SqlError> =>
      Effect.gen(function* () {
        const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
        const result = yield* sql`
          DELETE FROM block_states WHERE saved_at < ${cutoff}
        `;
        return (result as unknown as { changes: number }).changes ?? 0;
      });

    return {
      ...baseRepo,
      upsert,
      listAll,
      pruneOlderThan,
    } satisfies BlockStateRepository;
  })
);

// =============================================================================
// Service Interface
// =============================================================================

export interface BlockStateServiceShape {
  /**
   * Save block state to SQLite.
   */
  readonly save: (
    blockId: string,
    state: {
      foldState: FoldState;
      settingsOpen: boolean;
      activeTab: string;
      nodeAttrs: unknown;
    }
  ) => Effect.Effect<BlockState, BlockStatePersistenceError>;

  /**
   * Restore block state from SQLite.
   */
  readonly restore: (
    blockId: string
  ) => Effect.Effect<
    BlockState,
    BlockStateNotFound | BlockStatePersistenceError
  >;

  /**
   * Delete block state from SQLite.
   */
  readonly remove: (
    blockId: string
  ) => Effect.Effect<void, BlockStatePersistenceError>;

  /**
   * Watch for changes to a block's state.
   * (Polls SQLite since it doesn't support LISTEN/NOTIFY)
   */
  readonly watch: (
    blockId: string,
    intervalMs?: number
  ) => Stream.Stream<
    BlockState,
    BlockStateNotFound | BlockStatePersistenceError
  >;

  /**
   * Prune old block states (older than maxAgeMs).
   */
  readonly prune: (
    maxAgeMs?: number
  ) => Effect.Effect<number, BlockStatePersistenceError>;
}

// =============================================================================
// Service Context Tag
// =============================================================================

export class BlockStateService extends Context.Tag(
  'tmnl/editor/BlockStateService'
)<BlockStateService, BlockStateServiceShape>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const DEFAULT_PRUNE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_WATCH_INTERVAL_MS = 1000; // 1 second

export const BlockStateServiceLive = Layer.effect(
  BlockStateService,
  Effect.gen(function* () {
    const repo = yield* BlockStateRepo;

    const save: BlockStateServiceShape['save'] = (blockId, state) =>
      Effect.gen(function* () {
        const model = yield* repo
          .upsert(
            blockId as BlockId,
            state.foldState,
            state.settingsOpen,
            state.activeTab,
            state.nodeAttrs
          )
          .pipe(
            Effect.mapError(
              (cause) =>
                new BlockStatePersistenceError({
                  blockId: blockId as BlockId,
                  operation: 'save',
                  cause,
                })
            )
          );

        return new BlockState({
          blockId: model.blockId,
          foldState: model.foldState,
          settingsOpen: model.settingsOpen,
          activeTab: model.activeTab,
          nodeAttrs: JSON.parse(model.nodeAttrs),
          savedAt: new Date(model.savedAt),
        });
      }).pipe(
        Effect.withSpan('BlockStateService.save', { attributes: { blockId } })
      );

    const restore: BlockStateServiceShape['restore'] = (blockId) =>
      Effect.gen(function* () {
        const result = yield* repo.findById(blockId as BlockId).pipe(
          Effect.mapError(
            (cause) =>
              new BlockStatePersistenceError({
                blockId: blockId as BlockId,
                operation: 'restore',
                cause,
              })
          )
        );

        if (Option.isNone(result)) {
          return yield* Effect.fail(
            new BlockStateNotFound({
              blockId: blockId as BlockId,
              message: `Block state not found: ${blockId}`,
            })
          );
        }

        const model = result.value;
        return new BlockState({
          blockId: model.blockId,
          foldState: model.foldState,
          settingsOpen: model.settingsOpen,
          activeTab: model.activeTab,
          nodeAttrs: JSON.parse(model.nodeAttrs),
          savedAt: new Date(model.savedAt),
        });
      }).pipe(
        Effect.withSpan('BlockStateService.restore', {
          attributes: { blockId },
        })
      );

    const remove: BlockStateServiceShape['remove'] = (blockId) =>
      repo.delete(blockId as BlockId).pipe(
        Effect.mapError(
          (cause) =>
            new BlockStatePersistenceError({
              blockId: blockId as BlockId,
              operation: 'delete',
              cause,
            })
        ),
        Effect.withSpan('BlockStateService.remove', { attributes: { blockId } })
      );

    const watch: BlockStateServiceShape['watch'] = (
      blockId,
      intervalMs = DEFAULT_WATCH_INTERVAL_MS
    ) =>
      Stream.fromSchedule(Schedule.spaced(intervalMs)).pipe(
        Stream.mapEffect(() => restore(blockId))
      );

    const prune: BlockStateServiceShape['prune'] = (
      maxAgeMs = DEFAULT_PRUNE_AGE_MS
    ) =>
      repo.pruneOlderThan(maxAgeMs).pipe(
        Effect.mapError(
          (cause) =>
            new BlockStatePersistenceError({
              blockId: '' as BlockId,
              operation: 'delete',
              cause,
            })
        ),
        Effect.withSpan('BlockStateService.prune', { attributes: { maxAgeMs } })
      );

    return {
      save,
      restore,
      remove,
      watch,
      prune,
    } satisfies BlockStateServiceShape;
  })
);

// =============================================================================
// Combined Layer
// =============================================================================

/**
 * All block state persistence layers combined.
 * Requires SqlClient to be provided.
 */
export const BlockStatePersistenceLive = BlockStateServiceLive.pipe(
  Layer.provide(BlockStateRepoLive)
);
