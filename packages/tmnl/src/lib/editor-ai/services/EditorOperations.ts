/**
 * EditorOperations Service
 *
 * Base interface for AI-controllable editors.
 * Every editor adapter (TipTap, BlockSuite, etc.) implements this shape.
 *
 * Features:
 * - Focus/blur management
 * - Selection read/write
 * - Content read/write
 * - Streaming insertion for AI text generation
 *
 * @module editor-ai/services/EditorOperations
 */

import { Context, Effect, Stream } from 'effect'
import type { EditorView } from '@tiptap/pm/view'
import type {
  EditorId,
  Selection,
  EditorMetadata,
  InsertionResult,
  StreamingState,
} from '../schemas/editor'
import type { EditorOperationError, AIStreamError } from '../schemas/errors'
import { AIService } from '../decorators'

// -----------------------------------------------------------------------------
// Insertion Handle (for controlled streaming)
// -----------------------------------------------------------------------------

/**
 * Handle for managing a streaming insertion session.
 * Provides fine-grained control over chunk-by-chunk insertion.
 */
export interface InsertionHandle {
  /** Append a text chunk at current position */
  readonly append: (chunk: string) => Effect.Effect<void, EditorOperationError>

  /** Get current insertion position */
  readonly position: Effect.Effect<number>

  /** Get streaming state */
  readonly state: Effect.Effect<StreamingState>

  /** Complete the insertion and finalize cursor */
  readonly complete: Effect.Effect<InsertionResult>

  /** Abort the insertion (e.g., user cancelled) */
  readonly abort: Effect.Effect<void>
}

// -----------------------------------------------------------------------------
// EditorOperations Shape
// -----------------------------------------------------------------------------

/**
 * Core interface for AI-controllable editors.
 * Adapters implement this to expose editor capabilities to AI agents.
 */
export interface EditorOperationsShape {
  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------

  /** Unique identifier for this editor instance */
  readonly id: EditorId

  // ---------------------------------------------------------------------------
  // Focus Management
  // ---------------------------------------------------------------------------

  /** Focus the editor (brings to foreground, enables input) */
  readonly focus: Effect.Effect<void, EditorOperationError>

  /** Blur the editor (removes focus) */
  readonly blur: Effect.Effect<void, EditorOperationError>

  /** Check if this editor is currently focused */
  readonly isFocused: Effect.Effect<boolean>

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  /** Get current selection range */
  readonly getSelection: Effect.Effect<Selection | null>

  /** Set selection to specified range */
  readonly setSelection: (
    from: number,
    to: number
  ) => Effect.Effect<void, EditorOperationError>

  /** Clear selection (collapse to cursor) */
  readonly clearSelection: Effect.Effect<void, EditorOperationError>

  // ---------------------------------------------------------------------------
  // Content Read
  // ---------------------------------------------------------------------------

  /** Get full document content as JSON */
  readonly getContent: Effect.Effect<unknown>

  /** Get plain text between positions */
  readonly getContentRange: (from: number, to: number) => Effect.Effect<string>

  /** Get currently selected text */
  readonly getSelectedText: Effect.Effect<string | null>

  /** Get editor metadata for AI context */
  readonly getMetadata: Effect.Effect<EditorMetadata>

  // ---------------------------------------------------------------------------
  // Content Write (Immediate)
  // ---------------------------------------------------------------------------

  /** Insert text at current cursor position */
  readonly insertAtCursor: (
    content: string
  ) => Effect.Effect<number, EditorOperationError>

  /** Replace current selection with new content */
  readonly replaceSelection: (
    content: string
  ) => Effect.Effect<void, EditorOperationError>

  /** Delete current selection */
  readonly deleteSelection: Effect.Effect<void, EditorOperationError>

  // ---------------------------------------------------------------------------
  // Content Write (Streaming)
  // ---------------------------------------------------------------------------

  /**
   * Stream text insertion from an Effect.Stream.
   * Consumes the stream and inserts each chunk at cursor position.
   * Returns total characters and chunks when complete.
   */
  readonly streamInsert: (
    stream: Stream.Stream<string, AIStreamError>
  ) => Effect.Effect<InsertionResult, EditorOperationError | AIStreamError>

  /**
   * Create a controlled insertion session.
   * Use when you need fine-grained control over streaming (pause, resume, abort).
   */
  readonly createInsertionHandle: Effect.Effect<
    InsertionHandle,
    EditorOperationError
  >

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /** Get word count of entire document */
  readonly getWordCount: Effect.Effect<number>

  /** Get character count of entire document */
  readonly getCharCount: Effect.Effect<number>

  /** Check if document has unsaved changes */
  readonly isDirty: Effect.Effect<boolean>

  // ---------------------------------------------------------------------------
  // Low-Level Access (for Reconciler)
  // ---------------------------------------------------------------------------

  /**
   * Get the underlying ProseMirror EditorView.
   * Required for document reconciliation operations.
   * Note: This breaks abstraction but is necessary for AI document generation.
   */
  readonly getView: Effect.Effect<EditorView | null>
}

// -----------------------------------------------------------------------------
// EditorOperations Service Tag
// -----------------------------------------------------------------------------

/**
 * Effect.Service tag for EditorOperations.
 * Adapters provide Layer implementations for specific editors.
 */
@AIService({
  description: 'Base interface for AI-controllable editors with streaming support',
  capabilities: [
    'focus/blur management',
    'selection read/write',
    'content read/write',
    'streaming text insertion',
    'insertion handle for controlled streaming',
  ],
})
export class EditorOperations extends Context.Tag('tmnl/EditorOperations')<
  EditorOperations,
  EditorOperationsShape
>() {}
