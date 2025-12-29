/**
 * Block Extensions
 *
 * Individual TipTap block extensions for the TMNL editor.
 * Each block is a separate module for modularity and tree-shaking.
 *
 * @module editor/v3/extensions/blocks
 */

// Core nodes (required)
export { Document } from './Document';
export type { DocumentOptions } from './Document';

export { Text } from './Text';
export type { TextOptions } from './Text';

// Basic blocks
export { Paragraph } from './Paragraph';
export type { ParagraphOptions } from './Paragraph';

export { Heading } from './Heading';
export type { HeadingOptions, Level } from './Heading';

// List blocks
export { BulletList } from './BulletList';
export type { BulletListOptions } from './BulletList';

export { OrderedList } from './OrderedList';
export type { OrderedListOptions } from './OrderedList';

export { ListItem } from './ListItem';
export type { ListItemOptions } from './ListItem';

export { TaskList } from './TaskList';
export type { TaskListOptions } from './TaskList';

export { TaskItem, TaskCheckbox, TaskItemView, taskCheckboxMachine } from './TaskItem';
export type {
  TaskItemOptions,
  TaskCheckboxContext,
  TaskCheckboxEvent,
} from './TaskItem';

// Content blocks
export { Blockquote } from './Blockquote';
export type { BlockquoteOptions } from './Blockquote';

export { HorizontalRule } from './HorizontalRule';
export type { HorizontalRuleOptions } from './HorizontalRule';

export { Image } from './Image';
export type { ImageOptions } from './Image';

export { HardBreak } from './HardBreak';
export type { HardBreakOptions } from './HardBreak';

// Custom blocks
export { DataGridTable, parseMarkdownTable, tableDataToMarkdown } from './DataGridTable';
export type { DataGridTableOptions, TableData } from './DataGridTable';

export { Callout } from './Callout';
export type { CalloutOptions, CalloutVariant } from './Callout';

// Embedded blocks (Mapbox, 3D)
export { MapBlock, MapBlockView, getMapBlockAtoms, disposeMapBlockAtoms } from './MapBlock';
export type { MapBlockAttrs, MapBlockOptions, MapBlockMarker } from './MapBlock';

export { Scene3DBlock, Scene3DBlockView, getScene3DBlockAtoms, disposeScene3DBlockAtoms } from './Scene3DBlock';
export type { Scene3DBlockAttrs, Scene3DBlockOptions, EntityData, CameraState, SceneConfig } from './Scene3DBlock';

// Layout blocks
export {
  ColumnLayout,
  Column,
  ColumnLayoutView,
  ColumnView,
  getColumnLayoutAtoms,
  disposeColumnLayoutAtoms,
} from './ColumnLayout';
export type {
  ColumnLayoutAttrs,
  ColumnAttrs,
  ColumnLayoutOptions,
  ColumnOptions,
  ColumnLayoutState,
  InsertColumnLayoutOptions,
  ResponsiveBehavior,
} from './ColumnLayout';

// Shared wrapper for embedded blocks
export { EmbeddedBlockWrapper, useEmbeddedBlock } from './EmbeddedBlockWrapper';
export type {
  EmbeddedBlockWrapperProps,
  BlockBadge,
  BlockTag,
  SettingsTab,
  FoldState,
} from './EmbeddedBlockWrapper';

// =============================================================================
// Presets
// =============================================================================

import { Document } from './Document';
import { Text } from './Text';
import { Paragraph } from './Paragraph';
import { Heading } from './Heading';
import { BulletList } from './BulletList';
import { OrderedList } from './OrderedList';
import { ListItem } from './ListItem';
import { TaskList } from './TaskList';
import { TaskItem } from './TaskItem';
import { Blockquote } from './Blockquote';
import { HorizontalRule } from './HorizontalRule';
import { Image } from './Image';
import { HardBreak } from './HardBreak';
import { DataGridTable } from './DataGridTable';
import { Callout } from './Callout';
import { MapBlock } from './MapBlock';
import { Scene3DBlock } from './Scene3DBlock';
import { ColumnLayout, Column } from './ColumnLayout';
import { ProtectedNodes } from './EmbeddedBlockWrapper/shared/protectedNode';
import type { AnyExtension } from '@tiptap/core';

/**
 * Core extensions required for any editor.
 * Document + Text + Paragraph
 */
export const coreExtensions: AnyExtension[] = [
  Document,
  Text,
  Paragraph,
];

/**
 * Basic block extensions.
 * Headings, lists, blockquote, horizontal rule.
 */
export const basicBlockExtensions: AnyExtension[] = [
  Heading.configure({ levels: [1, 2, 3] }),
  BulletList,
  OrderedList,
  ListItem,
  Blockquote,
  HorizontalRule,
  HardBreak,
];

/**
 * Task list extensions.
 */
export const taskListExtensions: AnyExtension[] = [
  TaskList,
  TaskItem.configure({ nested: true }),
];

/**
 * Media extensions.
 */
export const mediaExtensions: AnyExtension[] = [
  Image.configure({ allowBase64: true }),
];

/**
 * Custom TMNL extensions.
 * DataGridTable (AG-Grid), Callout, MapBlock, Scene3DBlock, ColumnLayout.
 */
export const customBlockExtensions: AnyExtension[] = [
  DataGridTable,
  Callout,
  MapBlock,
  Scene3DBlock,
  ColumnLayout,
  Column,
];

/**
 * Protected node types — cannot be deleted via keyboard.
 * Only deletable via explicit UI (trash button in block header).
 */
export const protectedNodeTypes = ['mapBlock', 'scene3DBlock'];

/**
 * All block extensions combined.
 * Use this as a replacement for StarterKit blocks.
 */
export const allBlockExtensions: AnyExtension[] = [
  ...coreExtensions,
  ...basicBlockExtensions,
  ...taskListExtensions,
  ...mediaExtensions,
  ...customBlockExtensions,
  // Transaction filter to protect embedded blocks from deletion
  ProtectedNodes.configure({
    types: protectedNodeTypes,
  }),
];
