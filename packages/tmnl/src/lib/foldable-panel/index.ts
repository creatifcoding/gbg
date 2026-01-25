/**
 * FoldablePanel Module
 *
 * Framework-agnostic foldable panels with header, content, settings, and resize.
 * Can be used standalone or wrapped by TipTap (EmbeddedBlockWrapper).
 *
 * @module foldable-panel
 */

// Main component
export { FoldablePanel, getBadgeColors, useFoldablePanel } from './FoldablePanel';
export { default as FoldablePanelDefault } from './FoldablePanel';

// Context
export {
  FoldablePanelContext,
  FoldablePanelProvider,
  useFoldablePanelOptional,
} from './context';

// Atoms
export {
  createFoldablePanelAtoms,
  getFoldablePanelAtoms,
  disposeFoldablePanelAtoms,
  createFoldablePanelActions,
  useFoldablePanelActions,
  DEFAULT_FOLDABLE_PANEL_STATE,
  type FoldablePanelAtoms,
} from './atoms';

// Types
export type {
  PanelTag,
  PanelBadge,
  FoldState,
  StreamStatus,
  FoldablePanelState,
  SettingsTab,
  FoldablePanelProps,
  FoldablePanelActions,
  FoldablePanelContextValue,
} from './types';
