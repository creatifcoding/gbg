/**
 * Tool Parameter Schemas
 *
 * Effect.Schema definitions for AI SDK tool parameters.
 * AI SDK 6+ supports Effect.Schema directly - no Zod bridge needed.
 *
 * @module editor-ai/schemas/tools
 */

import { Schema } from 'effect'
import { EditorId, Selection } from './editor'

// -----------------------------------------------------------------------------
// Base Tool Schemas
// -----------------------------------------------------------------------------

/**
 * Parameters for insert_text tool.
 */
export const InsertTextParams = Schema.Struct({
  content: Schema.String.pipe(
    Schema.annotations({ description: 'The text content to insert at cursor' })
  ),
  moveCursor: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Move cursor to end of insertion (default: true)',
      })
    )
  ),
})
export type InsertTextParams = typeof InsertTextParams.Type

/**
 * Parameters for replace_selection tool.
 */
export const ReplaceSelectionParams = Schema.Struct({
  content: Schema.String.pipe(
    Schema.annotations({ description: 'The replacement text content' })
  ),
})
export type ReplaceSelectionParams = typeof ReplaceSelectionParams.Type

/**
 * Parameters for focus_editor tool.
 */
export const FocusEditorParams = Schema.Struct({
  editorId: Schema.String.pipe(
    Schema.brand('EditorId'),
    Schema.annotations({ description: 'The editor ID to focus' })
  ),
})
export type FocusEditorParams = typeof FocusEditorParams.Type

/**
 * Parameters for get_content_range tool.
 */
export const GetContentRangeParams = Schema.Struct({
  from: Schema.Number.pipe(
    Schema.int(),
    Schema.nonNegative(),
    Schema.annotations({ description: 'Start position (0-indexed)' })
  ),
  to: Schema.Number.pipe(
    Schema.int(),
    Schema.nonNegative(),
    Schema.annotations({ description: 'End position (0-indexed)' })
  ),
})
export type GetContentRangeParams = typeof GetContentRangeParams.Type

/**
 * Parameters for set_selection tool.
 */
export const SetSelectionParams = Schema.Struct({
  from: Schema.Number.pipe(
    Schema.int(),
    Schema.nonNegative(),
    Schema.annotations({ description: 'Selection start position' })
  ),
  to: Schema.Number.pipe(
    Schema.int(),
    Schema.nonNegative(),
    Schema.annotations({ description: 'Selection end position' })
  ),
})
export type SetSelectionParams = typeof SetSelectionParams.Type

// -----------------------------------------------------------------------------
// Tool Result Schemas
// -----------------------------------------------------------------------------

/**
 * Generic success result.
 */
export const ToolSuccess = Schema.Struct({
  success: Schema.Literal(true),
})
export type ToolSuccess = typeof ToolSuccess.Type

/**
 * Result from insert_text tool.
 */
export const InsertTextToolResult = Schema.Struct({
  success: Schema.Literal(true),
  charsInserted: Schema.Number.pipe(
    Schema.int(),
    Schema.nonNegative(),
    Schema.annotations({ description: 'Number of characters inserted' })
  ),
  newPosition: Schema.Number.pipe(
    Schema.int(),
    Schema.nonNegative(),
    Schema.annotations({ description: 'Cursor position after insertion' })
  ),
})
export type InsertTextToolResult = typeof InsertTextToolResult.Type

/**
 * Result from read_selection tool.
 */
export const ReadSelectionResult = Schema.Struct({
  selection: Schema.NullOr(Selection),
  text: Schema.NullOr(Schema.String),
})
export type ReadSelectionResult = typeof ReadSelectionResult.Type

/**
 * Result from get_context tool.
 */
export const GetContextResult = Schema.Struct({
  editorId: EditorId,
  title: Schema.NullOr(Schema.String),
  selection: Schema.NullOr(Selection),
  selectedText: Schema.NullOr(Schema.String),
  surroundingContext: Schema.NullOr(Schema.String),
  wordCount: Schema.Number,
  cursorPosition: Schema.Number,
})
export type GetContextResult = typeof GetContextResult.Type

/**
 * Result from list_editors tool.
 */
export const ListEditorsToolResult = Schema.Struct({
  editors: Schema.Array(EditorId),
  focused: Schema.NullOr(EditorId),
  count: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
export type ListEditorsToolResult = typeof ListEditorsToolResult.Type

/**
 * Result from get_content_range tool.
 */
export const ContentRangeResult = Schema.Struct({
  content: Schema.String,
  from: Schema.Number,
  to: Schema.Number,
})
export type ContentRangeResult = typeof ContentRangeResult.Type

// -----------------------------------------------------------------------------
// Empty Params (for tools with no input)
// -----------------------------------------------------------------------------

/**
 * Empty parameters for tools that take no input.
 */
export const EmptyParams = Schema.Struct({})
export type EmptyParams = typeof EmptyParams.Type
