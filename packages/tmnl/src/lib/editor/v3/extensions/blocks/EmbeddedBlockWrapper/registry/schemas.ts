import { Schema } from 'effect';
import type { BlockId, BlockName } from '../shared';

export const BlockNotFoundError = Schema.TaggedStruct('BlockNotFoundError', {
  blockId: Schema.String,
});
export type BlockNotFoundError = typeof BlockNotFoundError.Type;

export const BlockNameConflictError = Schema.TaggedStruct(
  'BlockNameConflictError',
  {
    name: Schema.String,
    existingBlockId: Schema.String,
  }
);
export type BlockNameConflictError = typeof BlockNameConflictError.Type;

export const InvalidBlockNameError = Schema.TaggedStruct(
  'InvalidBlockNameError',
  {
    name: Schema.String,
    reason: Schema.String,
  }
);
export type InvalidBlockNameError = typeof InvalidBlockNameError.Type;

export const BlockRegistryError = Schema.Union(
  BlockNotFoundError,
  BlockNameConflictError,
  InvalidBlockNameError
);
export type BlockRegistryError = typeof BlockRegistryError.Type;

export const RenameRequest = Schema.Struct({
  blockId: Schema.String,
  newName: Schema.String,
});
export type RenameRequest = typeof RenameRequest.Type;

export const BlockRegisteredEvent = Schema.TaggedStruct('BlockRegistered', {
  blockId: Schema.String,
  blockType: Schema.String,
  documentId: Schema.String,
  timestamp: Schema.DateFromSelf,
});
export type BlockRegisteredEvent = typeof BlockRegisteredEvent.Type;

export const BlockRenamedEvent = Schema.TaggedStruct('BlockRenamed', {
  blockId: Schema.String,
  oldName: Schema.NullOr(Schema.String),
  newName: Schema.String,
  timestamp: Schema.DateFromSelf,
});
export type BlockRenamedEvent = typeof BlockRenamedEvent.Type;

export const BlockUnregisteredEvent = Schema.TaggedStruct('BlockUnregistered', {
  blockId: Schema.String,
  timestamp: Schema.DateFromSelf,
});
export type BlockUnregisteredEvent = typeof BlockUnregisteredEvent.Type;

export const BlockRegistryEvent = Schema.Union(
  BlockRegisteredEvent,
  BlockRenamedEvent,
  BlockUnregisteredEvent
);
export type BlockRegistryEvent = typeof BlockRegistryEvent.Type;

export const createBlockNotFoundError = (
  blockId: BlockId
): BlockNotFoundError =>
  ({ _tag: 'BlockNotFoundError', blockId } as BlockNotFoundError);

export const createBlockNameConflictError = (
  name: BlockName,
  existingBlockId: BlockId
): BlockNameConflictError =>
  ({
    _tag: 'BlockNameConflictError',
    name,
    existingBlockId,
  } as BlockNameConflictError);

export const createInvalidBlockNameError = (
  name: string,
  reason: string
): InvalidBlockNameError =>
  ({ _tag: 'InvalidBlockNameError', name, reason } as InvalidBlockNameError);
