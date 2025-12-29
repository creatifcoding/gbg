/**
 * Editor v3 Extensions
 *
 * Tiptap extensions for Effect integration.
 *
 * @module editor/v3/extensions
 */

export { EffectBridge } from './EffectBridge';
export type { EffectBridgeOptions } from './EffectBridge';

export {
  CollaborationBridge,
  collaborationStyles,
} from './CollaborationBridge';
export type { CollaborationBridgeOptions } from './CollaborationBridge';

export {
  CodeBlockHighlight,
  lowlight,
  DEFAULT_CODE_LANGUAGE,
  codeBlockHighlightStyles,
} from './CodeBlockHighlight';

export {
  SlashCommand,
  SLASH_ITEMS,
  SLASH_GROUPS,
  groupSlashItems,
} from './SlashCommand';
export type { SlashMenuItem, SlashCommandOptions } from './SlashCommand';

// Annotation Extensions
export { IntentMark, IntentMarkExtension } from './annotations';
export type { IntentMarkOptions } from './annotations';

export { AnnotationNodeExtension, AnnotationNode } from './annotations';
export type { AnnotationNodeOptions } from './annotations';

export { annotationStyles } from './annotations';

// Block Extensions
export * from './blocks';

// Convenience presets
export {
  coreExtensions,
  basicBlockExtensions,
  taskListExtensions,
  mediaExtensions,
  customBlockExtensions,
  allBlockExtensions,
} from './blocks';
