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
  type EmbeddedBlockAtoms,
  type EmbeddedBlockActions,
} from './atoms';
