/**
 * Annotation System - Schema Exports
 *
 * Effect Schema definitions for the annotation system.
 *
 * @module editor/v3/extensions/annotations/schemas
 */

// =============================================================================
// Primitives
// =============================================================================

export {
  // Branded IDs
  AnnotationId,
  DocumentId,

  // ID generation
  generateAnnotationId,

  // Visual types
  VisualStyleType,
  VisualEffect,
  VisualStyle,

  // Interaction
  InteractionMode,

  // Metadata
  CreationSource,

  // Presets
  VisualStylePresets,
} from './primitives';

export type {
  AnnotationId as AnnotationIdType,
  DocumentId as DocumentIdType,
  VisualStyleType as VisualStyleTypeValue,
  VisualEffect as VisualEffectValue,
  VisualStyle as VisualStyleValue,
  InteractionMode as InteractionModeValue,
  CreationSource as CreationSourceValue,
} from './primitives';

// =============================================================================
// Intent Types
// =============================================================================

export {
  // Individual intents
  HyperlinkIntent,
  UltralinkIntent,
  PopoverIntent,
  ActionIntent,
  CitationIntent,
  NoteIntent,

  // Union
  IntentPayload,

  // Type guards
  isHyperlink,
  isUltralink,
  isPopover,
  isAction,
  isCitation,
  isNote,

  // Constructors
  Intent,
} from './intent';

export type {
  HyperlinkIntent as HyperlinkIntentType,
  UltralinkIntent as UltralinkIntentType,
  PopoverIntent as PopoverIntentType,
  ActionIntent as ActionIntentType,
  CitationIntent as CitationIntentType,
  NoteIntent as NoteIntentType,
  IntentPayload as IntentPayloadType,
} from './intent';

// =============================================================================
// Mark Schema
// =============================================================================

export {
  // Entity
  IntentMark,

  // Factory
  IntentMarkFactory,

  // Serialization
  IntentMarkAttrs,
  encodeMarkAttrs,
  decodeMarkAttrs,
} from './mark';

export type { IntentMarkAttrs as IntentMarkAttrsType } from './mark';

// =============================================================================
// Node Schema
// =============================================================================

export {
  // Entity
  AnnotationNode,

  // Factory
  AnnotationNodeFactory,

  // Serialization
  AnnotationNodeAttrs,
  encodeNodeAttrs,
  decodeNodeAttrs,

  // SQLite
  AnnotationNodeRow,
  annotationNodeFromRow,
  annotationNodeToRow,
} from './node';

export type { AnnotationNodeAttrs as AnnotationNodeAttrsType } from './node';

// =============================================================================
// Errors
// =============================================================================

export {
  AnnotationNotFound,
  AnnotationNodeNotFound,
  DocumentNotFound,
  IntentNotRegistered,
  AnnotationPersistenceError,
  IntentExecutionError,
  InvalidMarkConfig,
} from './errors';

export type { AnnotationError } from './errors';
