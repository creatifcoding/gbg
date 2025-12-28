/**
 * Editor v3 Components
 *
 * React components for the Tiptap editor.
 *
 * @module editor/v3/components
 */

export { TiptapEditor } from './TiptapEditor';
export type { TiptapEditorHandle, TiptapEditorProps } from './TiptapEditor';

export { CollaborativeTiptapEditor } from './CollaborativeTiptapEditor';
export type {
  CollaborativeTiptapEditorHandle,
  CollaborativeTiptapEditorProps,
  YDocReadyInfo,
} from './CollaborativeTiptapEditor';

export { FileConflictDialog } from './FileConflictDialog';
export type { FileConflictDialogProps } from './FileConflictDialog';

export { FileDrawer } from './FileDrawer';
export type {
  FileDrawerProps,
  LocalFileEntry,
  UnifiedFileEntry,
} from './FileDrawer';

export {
  MorphingSaveButton,
  CompactSaveButton,
  SaveButtonWithHint,
} from './MorphingSaveButton';
export type {
  MorphingSaveButtonFullProps,
  CompactSaveButtonProps,
  SaveButtonWithHintProps,
} from './MorphingSaveButton';

export { TableOfContents, useTableOfContents } from './TableOfContents';
export type {
  TableOfContentsProps,
  HeadingItem,
  UseTableOfContentsOptions,
  UseTableOfContentsResult,
} from './TableOfContents';

export { ZoomControls } from './ZoomControls';
export type { ZoomControlsProps } from './ZoomControls';

// Block Editor Components (Compound Patterns)
export {
  SlashMenu,
  DefaultSlashMenu,
  createSlashMenuRender,
  SLASH_ICONS,
} from './SlashMenu';
export type {
  SlashMenuRootProps,
  SlashMenuContentProps,
  DefaultSlashMenuHandle,
} from './SlashMenu';

export {
  BlockHandle,
  DefaultBlockHandle,
  blockHandleStyles,
} from './BlockDragHandle';
export type {
  BlockHandleRootProps,
  BlockHandleMenuItemProps,
  DefaultBlockHandleProps,
} from './BlockDragHandle';

export {
  FormattingToolbar,
  DefaultFormattingToolbar,
} from './FormattingToolbar';

// Styles
export {
  editorContentStyles,
  collaborativeEditorStyles,
  tableOfContentsStyles,
  editorHeaderStyles,
  allEditorStyles,
  editorCSSVariables,
} from './styles';
