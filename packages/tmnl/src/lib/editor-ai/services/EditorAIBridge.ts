/**
 * EditorAIBridge Service
 *
 * Primary interface for AI agents to interact with editors.
 * Routes operations to focused/targeted editors via EditorRegistry.
 *
 * Features:
 * - Target management (focus specific editors)
 * - Unified operations (delegate to focused editor)
 * - Streaming insertion (Effect.Stream → editor)
 * - Context gathering for AI prompts
 *
 * @module editor-ai/services/EditorAIBridge
 */

import { Context, Effect, Layer, Stream, Option } from 'effect'
import type { EditorId, Selection, InsertionResult } from '../schemas/editor'
import type { AIContext } from '../schemas/operations'
import {
  EditorNotFoundError,
  NoEditorFocusedError,
  makeNoEditorFocusedError,
  type AIStreamError,
  type EditorOperationError,
} from '../schemas/errors'
import { EditorRegistry } from './EditorRegistry'
import type { EditorOperationsShape, InsertionHandle } from './EditorOperations'
import { AIService } from '../decorators'

// -----------------------------------------------------------------------------
// EditorAIBridge Shape
// -----------------------------------------------------------------------------

/**
 * AI agent interface for editor operations.
 */
export interface EditorAIBridgeShape {
  // ---------------------------------------------------------------------------
  // Target Management
  // ---------------------------------------------------------------------------

  /**
   * Focus a specific editor by ID.
   * Sets it as the target for subsequent operations.
   */
  readonly focusEditor: (
    id: EditorId
  ) => Effect.Effect<void, EditorNotFoundError | EditorOperationError>

  /**
   * Get the currently focused editor's operations.
   */
  readonly getTargetEditor: Effect.Effect<
    EditorOperationsShape,
    NoEditorFocusedError | EditorNotFoundError
  >

  /**
   * Get focused editor ID.
   */
  readonly getFocusedEditorId: Effect.Effect<Option.Option<EditorId>>

  /**
   * List all available editors.
   */
  readonly listEditors: Effect.Effect<readonly EditorId[]>

  // ---------------------------------------------------------------------------
  // Unified Operations (delegate to focused editor)
  // ---------------------------------------------------------------------------

  /**
   * Insert text at cursor in focused editor.
   */
  readonly insertText: (
    content: string
  ) => Effect.Effect<
    number,
    NoEditorFocusedError | EditorNotFoundError | EditorOperationError
  >

  /**
   * Replace selection in focused editor.
   */
  readonly replaceSelection: (
    content: string
  ) => Effect.Effect<
    void,
    NoEditorFocusedError | EditorNotFoundError | EditorOperationError
  >

  /**
   * Get selection from focused editor.
   */
  readonly getSelection: Effect.Effect<
    Selection | null,
    NoEditorFocusedError | EditorNotFoundError
  >

  /**
   * Get selected text from focused editor.
   */
  readonly getSelectedText: Effect.Effect<
    string | null,
    NoEditorFocusedError | EditorNotFoundError
  >

  // ---------------------------------------------------------------------------
  // Streaming Operations
  // ---------------------------------------------------------------------------

  /**
   * Stream text insertion into focused editor.
   * Consumes Effect.Stream and inserts each chunk.
   */
  readonly streamInsert: (
    stream: Stream.Stream<string, AIStreamError>
  ) => Effect.Effect<
    InsertionResult,
    NoEditorFocusedError | EditorNotFoundError | EditorOperationError | AIStreamError
  >

  /**
   * Create insertion handle for controlled streaming.
   */
  readonly createInsertionHandle: Effect.Effect<
    InsertionHandle,
    NoEditorFocusedError | EditorNotFoundError | EditorOperationError
  >

  // ---------------------------------------------------------------------------
  // Context Gathering
  // ---------------------------------------------------------------------------

  /**
   * Gather AI context from focused editor.
   * Returns structured data for AI prompts.
   */
  readonly getContext: Effect.Effect<
    AIContext,
    NoEditorFocusedError | EditorNotFoundError
  >
}

// -----------------------------------------------------------------------------
// EditorAIBridge Service Tag
// -----------------------------------------------------------------------------

@AIService({
  description: 'Primary interface for AI agents to interact with editors',
  capabilities: [
    'focus/target specific editors',
    'insert/replace text',
    'stream text insertion from Effect.Stream',
    'gather editor context for AI prompts',
    'list available editors',
  ],
})
export class EditorAIBridge extends Context.Tag('tmnl/EditorAIBridge')<
  EditorAIBridge,
  EditorAIBridgeShape
>() {}

// -----------------------------------------------------------------------------
// Live Implementation
// -----------------------------------------------------------------------------

/**
 * Create EditorAIBridge.Live layer.
 * Requires EditorRegistry.
 */
export const EditorAIBridgeLive: Layer.Layer<
  EditorAIBridge,
  never,
  EditorRegistry
> = Layer.effect(
  EditorAIBridge,
  EditorRegistry.pipe(
    Effect.map((registry) => {
      /**
       * Helper to get focused editor or fail.
       * Uses explicit Effect.flatMap chain for proper type inference.
       */
      const getFocusedEditorOperations = (): Effect.Effect<
        EditorOperationsShape,
        NoEditorFocusedError | EditorNotFoundError
      > =>
        registry.getFocusedEditor.pipe(
          Effect.flatMap((focusedId): Effect.Effect<
            EditorOperationsShape,
            NoEditorFocusedError | EditorNotFoundError
          > => {
            if (Option.isNone(focusedId)) {
              return Effect.fail(makeNoEditorFocusedError())
            }
            return registry.getEditor(focusedId.value)
          })
        )

      const withFocusedEditor = <A, E>(
        fn: (editor: EditorOperationsShape) => Effect.Effect<A, E>
      ): Effect.Effect<A, NoEditorFocusedError | EditorNotFoundError | E> =>
        getFocusedEditorOperations().pipe(Effect.flatMap(fn))

      return EditorAIBridge.of({
        // -----------------------------------------------------------------------
        // Target Management
        // -----------------------------------------------------------------------

        focusEditor: (id) =>
          registry.getEditor(id).pipe(
            Effect.flatMap((editor) => editor.focus),
            Effect.flatMap(() => registry.setFocusedEditor(Option.some(id))),
            Effect.tap(() =>
              Effect.logDebug(`EditorAIBridge: focused editor ${id}`)
            )
          ),

        getTargetEditor: withFocusedEditor(Effect.succeed),

        getFocusedEditorId: registry.getFocusedEditor,

        listEditors: registry.getAllEditors,

        // -----------------------------------------------------------------------
        // Unified Operations
        // -----------------------------------------------------------------------

        insertText: (content) =>
          withFocusedEditor((editor) => editor.insertAtCursor(content)).pipe(
            Effect.withSpan('EditorAIBridge.insertText', {
              attributes: { contentLength: content.length },
            })
          ),

        replaceSelection: (content) =>
          withFocusedEditor((editor) => editor.replaceSelection(content)).pipe(
            Effect.withSpan('EditorAIBridge.replaceSelection', {
              attributes: { contentLength: content.length },
            })
          ),

        getSelection: withFocusedEditor((editor) => editor.getSelection),

        getSelectedText: withFocusedEditor((editor) => editor.getSelectedText),

        // -----------------------------------------------------------------------
        // Streaming Operations
        // -----------------------------------------------------------------------

        streamInsert: (stream) =>
          withFocusedEditor((editor) => editor.streamInsert(stream)).pipe(
            Effect.withSpan('EditorAIBridge.streamInsert')
          ),

        createInsertionHandle: withFocusedEditor((editor) =>
          editor.createInsertionHandle
        ).pipe(Effect.withSpan('EditorAIBridge.createInsertionHandle')),

        // -----------------------------------------------------------------------
        // Context Gathering
        // -----------------------------------------------------------------------

        getContext: withFocusedEditor((editor) =>
          Effect.all({
            selection: editor.getSelection,
            selectedText: editor.getSelectedText,
            metadata: editor.getMetadata,
          }).pipe(
            Effect.flatMap(({ selection, selectedText, metadata }) => {
              // Get surrounding context (paragraph around cursor)
              const getSurrounding =
                selection !== null
                  ? editor.getContentRange(
                      Math.max(0, selection.from - 200),
                      selection.to + 200
                    )
                  : Effect.succeed(null as string | null)

              return getSurrounding.pipe(
                Effect.map((surroundingContext): AIContext => ({
                  editorId: editor.id,
                  title: metadata.title,
                  selection,
                  selectedText,
                  surroundingContext,
                  wordCount: metadata.wordCount,
                  cursorPosition: selection?.from ?? 0,
                }))
              )
            })
          )
        ).pipe(Effect.withSpan('EditorAIBridge.getContext')),
      })
    })
  )
)

// -----------------------------------------------------------------------------
// Combined Layer
// -----------------------------------------------------------------------------

import { EditorRegistryLive } from './EditorRegistry'

/**
 * Full EditorAIBridge layer including registry.
 */
export const EditorAIBridgeFullLive: Layer.Layer<
  EditorAIBridge | EditorRegistry
> = Layer.provideMerge(EditorAIBridgeLive, EditorRegistryLive)

// Re-export for convenience
export { EditorRegistry, EditorRegistryLive } from './EditorRegistry'
