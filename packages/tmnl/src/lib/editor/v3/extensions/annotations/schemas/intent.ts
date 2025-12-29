/**
 * Annotation System - Intent Schemas
 *
 * Discriminated union of intent types. Each intent defines
 * what happens when the annotation is activated.
 *
 * @module editor/v3/extensions/annotations/schemas/intent
 */

import { Option, Schema } from 'effect';
import { AnnotationId, DocumentId, InteractionMode } from './primitives';

// =============================================================================
// Intent Types (TaggedStruct for discriminated union)
// =============================================================================

/**
 * Hyperlink Intent - External URL
 *
 * Opens an external URL in browser.
 */
export const HyperlinkIntent = Schema.TaggedStruct('Hyperlink', {
  /** Target URL */
  href: Schema.String,

  /** Browser target */
  target: Schema.optionalWith(Schema.Literal('_blank', '_self'), {
    default: () => '_blank' as const,
  }),
});
export type HyperlinkIntent = typeof HyperlinkIntent.Type;

/**
 * Ultralink Intent - Internal document/annotation reference
 *
 * Links to another document or annotation within the system.
 * Enables the annotation graph.
 */
export const UltralinkIntent = Schema.TaggedStruct('Ultralink', {
  /** Target document ID (optional if linking within same doc) */
  documentId: Schema.optionalWith(DocumentId, { as: 'Option' }),

  /** Target annotation ID (optional if linking to doc root) */
  annotationId: Schema.optionalWith(AnnotationId, { as: 'Option' }),

  /** Section/heading anchor within target */
  anchor: Schema.optionalWith(Schema.String, { as: 'Option' }),
});
export type UltralinkIntent = typeof UltralinkIntent.Type;

/**
 * Popover Intent - Rich content popover
 *
 * Shows annotation content in a popover on interaction.
 * References a hidden AnnotationNode for content.
 */
export const PopoverIntent = Schema.TaggedStruct('Popover', {
  /** References the hidden AnnotationNode containing content */
  annotationId: AnnotationId,

  /** How to trigger the popover */
  interaction: Schema.optionalWith(InteractionMode, {
    default: () => 'hover' as const,
  }),
});
export type PopoverIntent = typeof PopoverIntent.Type;

/**
 * Action Intent - Execute Effect program
 *
 * Triggers a registered Effect program when activated.
 * The most powerful intent type.
 */
export const ActionIntent = Schema.TaggedStruct('Action', {
  /** Key in the IntentRegistry */
  registryKey: Schema.String,

  /** Parameters passed to the program */
  params: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
});
export type ActionIntent = typeof ActionIntent.Type;

/**
 * Citation Intent - Academic/reference citation
 *
 * Specialized popover for citations with optional BibTeX key.
 */
export const CitationIntent = Schema.TaggedStruct('Citation', {
  /** References the hidden AnnotationNode containing citation details */
  annotationId: AnnotationId,

  /** BibTeX citation key for integration with reference managers */
  citationKey: Schema.optionalWith(Schema.String, { as: 'Option' }),
});
export type CitationIntent = typeof CitationIntent.Type;

/**
 * Note Intent - Simple note/comment
 *
 * Lightweight annotation for notes without full popover.
 */
export const NoteIntent = Schema.TaggedStruct('Note', {
  /** References the hidden AnnotationNode containing note content */
  annotationId: AnnotationId,

  /** Note category for filtering */
  category: Schema.optionalWith(
    Schema.Literal('comment', 'question', 'todo', 'idea'),
    { default: () => 'comment' as const }
  ),
});
export type NoteIntent = typeof NoteIntent.Type;

// =============================================================================
// Intent Union
// =============================================================================

/**
 * Union of all intent types
 *
 * Discriminated by `_tag` field for pattern matching.
 *
 * @example
 * ```typescript
 * function handleIntent(intent: IntentPayload) {
 *   switch (intent._tag) {
 *     case 'Hyperlink':
 *       window.open(intent.href, intent.target);
 *       break;
 *     case 'Ultralink':
 *       navigateToDocument(intent.documentId, intent.annotationId);
 *       break;
 *     case 'Popover':
 *       showPopover(intent.annotationId);
 *       break;
 *     case 'Action':
 *       executeAction(intent.registryKey, intent.params);
 *       break;
 *     case 'Citation':
 *       showCitation(intent.annotationId, intent.citationKey);
 *       break;
 *     case 'Note':
 *       showNote(intent.annotationId);
 *       break;
 *   }
 * }
 * ```
 */
export const IntentPayload = Schema.Union(
  HyperlinkIntent,
  UltralinkIntent,
  PopoverIntent,
  ActionIntent,
  CitationIntent,
  NoteIntent
);
export type IntentPayload = typeof IntentPayload.Type;

// =============================================================================
// Intent Type Guards
// =============================================================================

export const isHyperlink = (intent: IntentPayload): intent is HyperlinkIntent =>
  intent._tag === 'Hyperlink';

export const isUltralink = (intent: IntentPayload): intent is UltralinkIntent =>
  intent._tag === 'Ultralink';

export const isPopover = (intent: IntentPayload): intent is PopoverIntent =>
  intent._tag === 'Popover';

export const isAction = (intent: IntentPayload): intent is ActionIntent =>
  intent._tag === 'Action';

export const isCitation = (intent: IntentPayload): intent is CitationIntent =>
  intent._tag === 'Citation';

export const isNote = (intent: IntentPayload): intent is NoteIntent =>
  intent._tag === 'Note';

// =============================================================================
// Intent Constructors
// =============================================================================

/**
 * Convenience constructors for creating intents
 */
export const Intent = {
  /** Create hyperlink intent */
  hyperlink: (href: string, target?: '_blank' | '_self'): HyperlinkIntent => ({
    _tag: 'Hyperlink',
    href,
    target: target ?? '_blank',
  }),

  /** Create ultralink to document */
  toDocument: (documentId: DocumentId, anchor?: string): UltralinkIntent => ({
    _tag: 'Ultralink',
    documentId: Option.some(documentId),
    annotationId: Option.none(),
    anchor: anchor ? Option.some(anchor) : Option.none(),
  }),

  /** Create ultralink to annotation */
  toAnnotation: (
    annotationId: AnnotationId,
    documentId?: DocumentId
  ): UltralinkIntent => ({
    _tag: 'Ultralink',
    documentId: documentId ? Option.some(documentId) : Option.none(),
    annotationId: Option.some(annotationId),
    anchor: Option.none(),
  }),

  /** Create popover intent */
  popover: (
    annotationId: AnnotationId,
    interaction?: InteractionMode
  ): PopoverIntent => ({
    _tag: 'Popover',
    annotationId,
    interaction: interaction ?? 'hover',
  }),

  /** Create action intent */
  action: (registryKey: string, params?: unknown): ActionIntent => ({
    _tag: 'Action',
    registryKey,
    params: params !== undefined ? Option.some(params) : Option.none(),
  }),

  /** Create citation intent */
  citation: (
    annotationId: AnnotationId,
    citationKey?: string
  ): CitationIntent => ({
    _tag: 'Citation',
    annotationId,
    citationKey: citationKey ? Option.some(citationKey) : Option.none(),
  }),

  /** Create note intent */
  note: (
    annotationId: AnnotationId,
    category?: 'comment' | 'question' | 'todo' | 'idea'
  ): NoteIntent => ({
    _tag: 'Note',
    annotationId,
    category: category ?? 'comment',
  }),
} as const;
