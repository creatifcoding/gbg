/**
 * EmbeddedBlockWrapper Exports
 *
 * @module editor/v3/extensions/blocks/EmbeddedBlockWrapper
 */

export { EmbeddedBlockWrapper, useEmbeddedBlock } from './EmbeddedBlockWrapper';
export type {
  EmbeddedBlockWrapperProps,
  EmbeddedBlockContextValue,
  BlockBadge,
  BlockTag,
  SettingsTab,
  FoldState,
  EmbeddedBlockState,
} from './types';
export {
  getEmbeddedBlockAtoms,
  disposeEmbeddedBlockAtoms,
  createEmbeddedBlockActions,
  // Focus mode atoms
  focusedBlockIdAtom,
  isFocusModeAtom,
  focusEnteredAtAtom,
  focusActions,
  type EmbeddedBlockAtoms,
  type EmbeddedBlockActions,
} from './atoms';

// Persistence
export {
  BlockState,
  FocusState,
  BlockStateService,
  BlockStatePersistenceLive,
} from './persistence';
