/**
 * Editor Schemas
 *
 * Effect.Schema definitions for editor identity, selection, and metadata.
 * These are the core types consumed by EditorOperations service.
 *
 * @module editor-ai/schemas/editor
 */

import { Schema } from 'effect'
import { AIKnowledge } from '../decorators'

// -----------------------------------------------------------------------------
// EditorId - Branded String
// -----------------------------------------------------------------------------

/**
 * Unique identifier for editor instances.
 * Format: "editor-{panelId}" or custom string.
 */
export const EditorId = AIKnowledge({
  category: 'editor',
  description: 'Branded ID for editor instances. Used to target specific editors.',
  examples: ['editor-panel-123', 'main-editor', 'drawer-editor'],
})(Schema.String.pipe(Schema.brand('EditorId')))

export type EditorId = typeof EditorId.Type

// -----------------------------------------------------------------------------
// Selection - Text Selection Range
// -----------------------------------------------------------------------------

/**
 * Represents a text selection range in the document.
 * Maps to TipTap/ProseMirror selection model.
 */
export const Selection = AIKnowledge({
  category: 'editor',
  description: 'Text selection range with from/to positions and empty flag.',
})(
  Schema.Struct({
    /** Start position (0-indexed character offset) */
    from: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    /** End position (0-indexed character offset) */
    to: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    /** True if selection is collapsed (cursor, no range) */
    empty: Schema.Boolean,
  })
)

export type Selection = typeof Selection.Type

// -----------------------------------------------------------------------------
// EditorMetadata - Document Context
// -----------------------------------------------------------------------------

/**
 * Metadata about an editor instance and its document.
 * Useful for AI context gathering.
 */
export const EditorMetadata = AIKnowledge({
  category: 'editor',
  description: 'Editor instance metadata including document info for AI context.',
})(
  Schema.Struct({
    /** Editor instance ID */
    id: EditorId,
    /** Document title (from first heading or filename) */
    title: Schema.NullOr(Schema.String),
    /** Y-Sweet or collaboration document ID */
    documentId: Schema.NullOr(Schema.String),
    /** Total word count */
    wordCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    /** Character count */
    charCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    /** Last modification timestamp */
    lastModified: Schema.DateFromSelf,
    /** Whether editor has unsaved changes */
    isDirty: Schema.Boolean,
  })
)

export type EditorMetadata = typeof EditorMetadata.Type

// -----------------------------------------------------------------------------
// StreamingState - Insertion Stream Status
// -----------------------------------------------------------------------------

/**
 * Status of an active streaming insertion session.
 */
export const StreamingState = Schema.Struct({
  /** Whether streaming is active */
  isStreaming: Schema.Boolean,
  /** Total characters inserted so far */
  charsInserted: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  /** Number of chunks received */
  chunksReceived: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  /** Start position of insertion */
  startPosition: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  /** Current end position */
  currentPosition: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})

export type StreamingState = typeof StreamingState.Type

// -----------------------------------------------------------------------------
// InsertionResult - Stream Completion
// -----------------------------------------------------------------------------

/**
 * Result returned when a streaming insertion completes.
 */
export const InsertionResult = Schema.Struct({
  /** Total characters inserted */
  totalChars: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  /** Total chunks processed */
  chunks: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  /** Duration in milliseconds */
  durationMs: Schema.Number.pipe(Schema.nonNegative()),
  /** Final cursor position */
  finalPosition: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})

export type InsertionResult = typeof InsertionResult.Type
