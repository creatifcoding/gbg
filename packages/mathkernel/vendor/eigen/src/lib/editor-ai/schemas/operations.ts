/**
 * Operation Schemas
 *
 * Effect.Schema definitions for editor operation payloads and results.
 * Used by AI tools and EditorOperations service.
 *
 * @module editor-ai/schemas/operations
 */

import { Schema } from 'effect'
import { EditorId, Selection } from './editor'

// -----------------------------------------------------------------------------
// Operation Payloads
// -----------------------------------------------------------------------------

/**
 * Payload for inserting text at cursor position.
 */
export const InsertTextPayload = Schema.Struct({
  /** Text content to insert */
  content: Schema.String,
  /** Optional: move cursor to end of insertion (default: true) */
  moveCursor: Schema.optional(Schema.Boolean),
})

export type InsertTextPayload = typeof InsertTextPayload.Type

/**
 * Payload for replacing selected text.
 */
export const ReplaceSelectionPayload = Schema.Struct({
  /** Replacement text content */
  content: Schema.String,
})

export type ReplaceSelectionPayload = typeof ReplaceSelectionPayload.Type

/**
 * Payload for setting text selection.
 */
export const SetSelectionPayload = Schema.Struct({
  /** Start position */
  from: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  /** End position */
  to: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})

export type SetSelectionPayload = typeof SetSelectionPayload.Type

/**
 * Payload for getting content range.
 */
export const GetContentRangePayload = Schema.Struct({
  /** Start position */
  from: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  /** End position */
  to: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})

export type GetContentRangePayload = typeof GetContentRangePayload.Type

/**
 * Payload for focusing a specific editor.
 */
export const FocusEditorPayload = Schema.Struct({
  /** Editor ID to focus */
  editorId: EditorId,
})

export type FocusEditorPayload = typeof FocusEditorPayload.Type

// -----------------------------------------------------------------------------
// Operation Results
// -----------------------------------------------------------------------------

/**
 * Generic success result.
 */
export const OperationSuccess = Schema.Struct({
  success: Schema.Literal(true),
})

export type OperationSuccess = typeof OperationSuccess.Type

/**
 * Result of text insertion operation.
 */
export const InsertTextResult = Schema.Struct({
  success: Schema.Literal(true),
  /** Number of characters inserted */
  charsInserted: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  /** New cursor position after insertion */
  newPosition: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})

export type InsertTextResult = typeof InsertTextResult.Type

/**
 * Result of selection read operation.
 */
export const SelectionResult = Schema.Struct({
  /** Current selection or null if none */
  selection: Schema.NullOr(Selection),
  /** Selected text content or null */
  text: Schema.NullOr(Schema.String),
})

export type SelectionResult = typeof SelectionResult.Type

/**
 * Result of content read operation.
 */
export const ContentResult = Schema.Struct({
  /** Document content as JSON */
  content: Schema.Unknown,
  /** Plain text representation */
  text: Schema.String,
  /** Word count */
  wordCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})

export type ContentResult = typeof ContentResult.Type

/**
 * Result of list editors operation.
 */
export const ListEditorsResult = Schema.Struct({
  /** All registered editor IDs */
  editors: Schema.Array(EditorId),
  /** Currently focused editor ID or null */
  focused: Schema.NullOr(EditorId),
})

export type ListEditorsResult = typeof ListEditorsResult.Type

// -----------------------------------------------------------------------------
// AI Context
// -----------------------------------------------------------------------------

/**
 * Context gathered from editor for AI consumption.
 */
export const AIContext = Schema.Struct({
  /** Editor identity */
  editorId: EditorId,
  /** Document title */
  title: Schema.NullOr(Schema.String),
  /** Current selection */
  selection: Schema.NullOr(Selection),
  /** Selected text (if any) */
  selectedText: Schema.NullOr(Schema.String),
  /** Surrounding context (paragraph or section) */
  surroundingContext: Schema.NullOr(Schema.String),
  /** Document word count */
  wordCount: Schema.Number,
  /** Cursor position */
  cursorPosition: Schema.Number,
})

export type AIContext = typeof AIContext.Type
