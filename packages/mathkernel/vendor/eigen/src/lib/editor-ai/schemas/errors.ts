/**
 * Error Schemas
 *
 * Tagged error types for EditorAI operations.
 * Uses Schema.TaggedError for Effect error channel.
 *
 * @module editor-ai/schemas/errors
 */

import { Schema } from 'effect'
import type { EditorId } from './editor'

// -----------------------------------------------------------------------------
// Editor Errors
// -----------------------------------------------------------------------------

/**
 * Editor with given ID was not found in registry.
 */
export class EditorNotFoundError extends Schema.TaggedError<EditorNotFoundError>()(
  'EditorNotFoundError',
  {
    editorId: Schema.String,
    message: Schema.String,
  }
) {}

/**
 * Factory for EditorNotFoundError.
 */
export const makeEditorNotFoundError = (editorId: EditorId): EditorNotFoundError =>
  new EditorNotFoundError({
    editorId: editorId as string,
    message: `Editor not found: ${editorId}`,
  })

/**
 * No editor is currently focused.
 */
export class NoEditorFocusedError extends Schema.TaggedError<NoEditorFocusedError>()(
  'NoEditorFocusedError',
  {
    message: Schema.String,
  }
) {}

/**
 * Factory for NoEditorFocusedError.
 */
export const makeNoEditorFocusedError = (): NoEditorFocusedError =>
  new NoEditorFocusedError({
    message: 'No editor is currently focused',
  })

/**
 * Editor operation failed.
 */
export class EditorOperationError extends Schema.TaggedError<EditorOperationError>()(
  'EditorOperationError',
  {
    operation: Schema.String,
    editorId: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

/**
 * Factory for EditorOperationError.
 */
export const makeEditorOperationError = (
  operation: string,
  editorId: EditorId,
  message: string,
  cause?: unknown
): EditorOperationError =>
  new EditorOperationError({
    operation,
    editorId: editorId as string,
    message,
    cause,
  })

/**
 * Streaming insertion was aborted.
 */
export class StreamAbortedError extends Schema.TaggedError<StreamAbortedError>()(
  'StreamAbortedError',
  {
    editorId: Schema.String,
    chunksProcessed: Schema.Number,
    message: Schema.String,
  }
) {}

/**
 * Factory for StreamAbortedError.
 */
export const makeStreamAbortedError = (
  editorId: EditorId,
  chunksProcessed: number
): StreamAbortedError =>
  new StreamAbortedError({
    editorId: editorId as string,
    chunksProcessed,
    message: `Stream aborted after ${chunksProcessed} chunks`,
  })

/**
 * AI stream processing error.
 */
export class AIStreamError extends Schema.TaggedError<AIStreamError>()(
  'AIStreamError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

/**
 * Factory for AIStreamError.
 */
export const makeAIStreamError = (error: unknown): AIStreamError =>
  new AIStreamError({
    message: error instanceof Error ? error.message : 'AI stream error',
    cause: error,
  })

// -----------------------------------------------------------------------------
// Union Types
// -----------------------------------------------------------------------------

/**
 * All editor-related errors.
 */
export type EditorError =
  | EditorNotFoundError
  | NoEditorFocusedError
  | EditorOperationError
  | StreamAbortedError
  | AIStreamError
