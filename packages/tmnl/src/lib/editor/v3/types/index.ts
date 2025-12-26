/**
 * Editor v3 Type Definitions
 *
 * Schema-backed types for the Tiptap + Effect editor system.
 *
 * @module editor/v3/types
 */

import { Schema } from 'effect';

// =============================================================================
// Connection State
// =============================================================================

export const ConnectionStatus = Schema.Literal(
  'disconnected',
  'connecting',
  'connected',
  'error'
);
export type ConnectionStatus = typeof ConnectionStatus.Type;

// =============================================================================
// Editor State
// =============================================================================

export const EditorStatus = Schema.Literal(
  'initializing',
  'ready',
  'destroyed',
  'error'
);
export type EditorStatus = typeof EditorStatus.Type;

// =============================================================================
// Selection State
// =============================================================================

export class SelectionState extends Schema.Class<SelectionState>('SelectionState')({
  from: Schema.Number,
  to: Schema.Number,
  empty: Schema.Boolean,
  anchor: Schema.Number,
  head: Schema.Number,
}) {
  get isCollapsed(): boolean {
    return this.from === this.to;
  }

  get length(): number {
    return Math.abs(this.to - this.from);
  }
}

// =============================================================================
// Active Marks
// =============================================================================

export const MarkType = Schema.Literal(
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'link',
  'highlight',
  'subscript',
  'superscript'
);
export type MarkType = typeof MarkType.Type;

// =============================================================================
// Document Metadata
// =============================================================================

export const DocumentId = Schema.String.pipe(Schema.brand('DocumentId'));
export type DocumentId = typeof DocumentId.Type;

export class DocumentMeta extends Schema.Class<DocumentMeta>('DocumentMeta')({
  id: DocumentId,
  title: Schema.String,
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
  wordCount: Schema.Number,
  characterCount: Schema.Number,
}) {}

// =============================================================================
// Editor Configuration
// =============================================================================

export class EditorConfig extends Schema.Class<EditorConfig>('EditorConfig')({
  /** Enable collaboration features */
  collaborative: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** y-Sweet document ID for collaboration */
  ySweetDocId: Schema.optional(Schema.String),
  /** Auto-save interval in milliseconds (0 = disabled) */
  autoSaveInterval: Schema.optionalWith(Schema.Number, { default: () => 30000 }),
  /** Enable spell checking */
  spellCheck: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Placeholder text when empty */
  placeholder: Schema.optional(Schema.String),
}) {}

// =============================================================================
// Transaction Metadata (for Effect.withSpan)
// =============================================================================

export class TransactionMeta extends Schema.Class<TransactionMeta>('TransactionMeta')({
  stepCount: Schema.Number,
  docChanged: Schema.Boolean,
  selectionChanged: Schema.Boolean,
  storedMarksChanged: Schema.Boolean,
  time: Schema.Number,
}) {}

// =============================================================================
// AI Status
// =============================================================================

export const AIStatus = Schema.Literal(
  'idle',
  'streaming',
  'complete',
  'error'
);
export type AIStatus = typeof AIStatus.Type;

// =============================================================================
// Export Formats
// =============================================================================

export const ExportFormat = Schema.Literal('markdown', 'json', 'html', 'pdf');
export type ExportFormat = typeof ExportFormat.Type;
