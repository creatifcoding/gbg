/**
 * EmbeddedBlockWrapper Exports
 *
 * @module editor/v3/extensions/blocks/EmbeddedBlockWrapper
 */

export { EmbeddedBlockWrapper, EmbeddedBlockContext, useEmbeddedBlock } from './EmbeddedBlockWrapper';
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
  // State persistence (in-memory cache)
  savedBlockStatesAtom,
  saveBlockState,
  restoreBlockState,
  hasSavedBlockState,
  type EmbeddedBlockAtoms,
  type EmbeddedBlockActions,
} from './atoms';

// Focus overlay
export { FocusOverlay, useFocusOverlay } from './FocusOverlay';
export type { FocusOverlayProps, UseFocusOverlayReturn } from './FocusOverlay';

// Persistence
export {
  BlockState,
  FocusState,
  BlockStateService,
  BlockStatePersistenceLive,
} from './persistence';

// Block Registry (naming system)
export {
  BlockRegistryProvider,
  useBlockRegistry,
  useBlockRegistryOptional,
  BlockRegistry,
  blocksAtom,
  namedBlocksAtom,
  blockByIdAtom,
  blockByNameAtom,
  renameErrorAtom,
  isRenamingAtom,
} from './registry';
export type { BlockId, BlockName, BlockType, BlockRef } from './shared';
