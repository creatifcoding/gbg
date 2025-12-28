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
