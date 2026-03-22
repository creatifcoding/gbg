/**
 * Block Persistence Exports
 *
 * @module editor/v3/extensions/blocks/EmbeddedBlockWrapper/persistence
 */

// Schemas
export {
  BlockId,
  FoldStateSchema,
  BlockState,
  FocusState,
  BlockStateNotFound,
  BlockStatePersistenceError,
  BlockStateRow,
  BlockStateFromRow,
} from './schemas';

export type {
  BlockId as BlockIdType,
} from './schemas';

// Service
export {
  BlockStateService,
  BlockStateServiceLive,
  BlockStateRepo,
  BlockStateRepoLive,
  BlockStatePersistenceLive,
} from './BlockStateService';

export type {
  BlockStateServiceShape,
  BlockStateRepository,
} from './BlockStateService';
