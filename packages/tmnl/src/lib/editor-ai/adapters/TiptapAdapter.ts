/**
 * TiptapAdapter
 *
 * Implements EditorOperationsShape for TipTap/ProseMirror editors.
 * Bridges TipTap's imperative API to Effect.Effect.
 *
 * Features:
 * - Wraps editor.commands.* in Effect
 * - Maps TipTap selection to Selection schema
 * - Streaming insertion with chunk batching
 * - Insertion handle for controlled streaming
 *
 * @module editor-ai/adapters/TiptapAdapter
 */

import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Stream from 'effect/Stream'
import * as Ref from 'effect/Ref'
import * as Clock from 'effect/Clock'
import type { Editor } from '@tiptap/core'
import type { RefObject } from 'react'
import type {
  EditorId,
  Selection,
  EditorMetadata,
  InsertionResult,
  StreamingState,
} from '../schemas/editor'
import { EditorOperationError, makeEditorOperationError, type AIStreamError } from '../schemas/errors'
import {
  EditorOperations,
  type EditorOperationsShape,
  type InsertionHandle,
} from '../services/EditorOperations'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface TiptapAdapterConfig {
  id: EditorId
  editorRef: RefObject<Editor | null>
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Get editor from ref or fail.
 * Uses Effect.try for sync-compatible lazy ref reading.
 * (Effect.suspend requires runtime; Effect.try works with Effect.runSync)
 */
const getEditor = (
  config: TiptapAdapterConfig
): Effect.Effect<Editor, EditorOperationError> =>
  Effect.try({
    try: () => {
      const editor = config.editorRef.current
      if (!editor) {
        throw new Error('Editor ref is null')
      }
      return editor
    },
    catch: () =>
      makeEditorOperationError('getEditor', config.id, 'Editor ref is null'),
  })

/**
 * Count words in text.
 */
const countWords = (text: string): number =>
  text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length

/**
 * Extract title from document (first heading).
 */
const extractTitle = (editor: Editor): string | null => {
  let title: string | null = null

  editor.state.doc.descendants((node) => {
    if (title) return false
    if (node.type.name === 'heading' && node.attrs.level === 1) {
      title = node.textContent
      return false
    }
    return true
  })

  return title
}

// -----------------------------------------------------------------------------
// Adapter Implementation
// -----------------------------------------------------------------------------

/**
 * Create EditorOperationsShape implementation for TipTap editor.
 */
const createTiptapOperations = (
  config: TiptapAdapterConfig
): EditorOperationsShape => ({
  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------

  id: config.id,

  // ---------------------------------------------------------------------------
  // Focus Management
  // ---------------------------------------------------------------------------

  focus: getEditor(config).pipe(
    Effect.flatMap((editor) =>
      Effect.sync(() => {
        editor.commands.focus()
      })
    )
  ),

  blur: getEditor(config).pipe(
    Effect.flatMap((editor) =>
      Effect.sync(() => {
        editor.commands.blur()
      })
    )
  ),

  isFocused: getEditor(config).pipe(
    Effect.map((editor) => editor.isFocused),
    Effect.orElseSucceed(() => false)
  ),

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  getSelection: getEditor(config).pipe(
    Effect.map((editor) => {
      const { from, to, empty } = editor.state.selection
      const selection: Selection = { from, to, empty }
      return selection
    }),
    Effect.orElseSucceed(() => null)
  ),

  setSelection: (from, to) =>
    getEditor(config).pipe(
      Effect.flatMap((editor) =>
        Effect.sync(() => {
          editor.commands.setTextSelection({ from, to })
        })
      )
    ),

  clearSelection: getEditor(config).pipe(
    Effect.flatMap((editor) =>
      Effect.sync(() => {
        const { from } = editor.state.selection
        editor.commands.setTextSelection(from)
      })
    )
  ),

  // ---------------------------------------------------------------------------
  // Content Read
  // ---------------------------------------------------------------------------

  getContent: getEditor(config).pipe(
    Effect.map((editor) => editor.getJSON()),
    Effect.orElseSucceed(() => ({}))
  ),

  getContentRange: (from, to) =>
    getEditor(config).pipe(
      Effect.map((editor) => {
        const docSize = editor.state.doc.content.size
        const safeFrom = Math.max(0, Math.min(from, docSize))
        const safeTo = Math.max(safeFrom, Math.min(to, docSize))
        return editor.state.doc.textBetween(safeFrom, safeTo, ' ')
      }),
      Effect.orElseSucceed(() => '')
    ),

  getSelectedText: getEditor(config).pipe(
    Effect.map((editor) => {
      const { from, to, empty } = editor.state.selection
      if (empty) return null
      return editor.state.doc.textBetween(from, to, ' ')
    }),
    Effect.orElseSucceed(() => null)
  ),

  getMetadata: getEditor(config).pipe(
    Effect.map((editor) => {
      const text = editor.state.doc.textContent
      const metadata: EditorMetadata = {
        id: config.id,
        title: extractTitle(editor),
        documentId: null,
        wordCount: countWords(text),
        charCount: text.length,
        lastModified: new Date(),
        isDirty: false,
      }
      return metadata
    }),
    Effect.orElseSucceed(
      (): EditorMetadata => ({
        id: config.id,
        title: null,
        documentId: null,
        wordCount: 0,
        charCount: 0,
        lastModified: new Date(),
        isDirty: false,
      })
    )
  ),

  // ---------------------------------------------------------------------------
  // Content Write (Immediate)
  // ---------------------------------------------------------------------------

  insertAtCursor: (content) =>
    getEditor(config).pipe(
      Effect.flatMap((editor) =>
        Effect.sync(() => {
          editor.commands.insertContent(content)
          return content.length
        })
      )
    ),

  replaceSelection: (content) =>
    getEditor(config).pipe(
      Effect.flatMap((editor) =>
        Effect.sync(() => {
          editor.commands.insertContent(content)
        })
      )
    ),

  deleteSelection: getEditor(config).pipe(
    Effect.flatMap((editor) =>
      Effect.sync(() => {
        editor.commands.deleteSelection()
      })
    )
  ),

  // ---------------------------------------------------------------------------
  // Content Write (Streaming)
  // ---------------------------------------------------------------------------

  streamInsert: (stream) =>
    Effect.Do.pipe(
      Effect.bind('startTime', () => Clock.currentTimeMillis),
      Effect.bind('editor', () => getEditor(config)),
      Effect.bind('state', () =>
        Ref.make({
          pos: 0,
          totalChars: 0,
          chunks: 0,
        })
      ),
      Effect.tap(({ editor, state }) =>
        Ref.update(state, (s) => ({
          ...s,
          pos: editor.state.selection.from,
        }))
      ),
      Effect.tap(({ editor, state }) =>
        Stream.runForEach(stream, (chunk) =>
          Ref.get(state).pipe(
            Effect.flatMap((s) =>
              Effect.sync(() => {
                editor
                  .chain()
                  .focus()
                  .insertContentAt(s.pos, chunk, { updateSelection: false })
                  .run()
              })
            ),
            Effect.tap(() =>
              Ref.update(state, (s) => ({
                pos: s.pos + chunk.length,
                totalChars: s.totalChars + chunk.length,
                chunks: s.chunks + 1,
              }))
            )
          )
        )
      ),
      Effect.flatMap(({ editor, state, startTime }) =>
        Effect.all([Ref.get(state), Clock.currentTimeMillis]).pipe(
          Effect.map(([s, endTime]) => {
            // Move cursor to end
            editor.commands.setTextSelection(s.pos)

            const result: InsertionResult = {
              totalChars: s.totalChars,
              chunks: s.chunks,
              durationMs: Number(endTime - startTime),
              finalPosition: s.pos,
            }
            return result
          })
        )
      ),
      Effect.withSpan('TiptapAdapter.streamInsert', {
        attributes: { editorId: config.id },
      })
    ),

  createInsertionHandle: Effect.Do.pipe(
    Effect.bind('editor', () => getEditor(config)),
    Effect.bind('startTime', () => Clock.currentTimeMillis),
    Effect.bind('stateRef', ({ editor }) =>
      Ref.make<StreamingState>({
        isStreaming: true,
        charsInserted: 0,
        chunksReceived: 0,
        startPosition: editor.state.selection.from,
        currentPosition: editor.state.selection.from,
      })
    ),
    Effect.map(({ editor, startTime, stateRef }): InsertionHandle => ({
      append: (chunk) =>
        Ref.get(stateRef).pipe(
          Effect.flatMap((state) => {
            if (!state.isStreaming) {
              return Effect.fail(
                makeEditorOperationError(
                  'append',
                  config.id,
                  'Insertion session is not active'
                )
              )
            }

            return Effect.sync(() => {
              editor
                .chain()
                .focus()
                .insertContentAt(state.currentPosition, chunk, {
                  updateSelection: false,
                })
                .run()
            }).pipe(
              Effect.tap(() =>
                Ref.update(stateRef, (s) => ({
                  ...s,
                  charsInserted: s.charsInserted + chunk.length,
                  chunksReceived: s.chunksReceived + 1,
                  currentPosition: s.currentPosition + chunk.length,
                }))
              )
            )
          })
        ),

      position: Ref.get(stateRef).pipe(Effect.map((s) => s.currentPosition)),

      state: Ref.get(stateRef),

      complete: Effect.all([Ref.get(stateRef), Clock.currentTimeMillis]).pipe(
        Effect.tap(([state]) =>
          Effect.sync(() => {
            editor.commands.setTextSelection(state.currentPosition)
          })
        ),
        Effect.tap(() =>
          Ref.update(stateRef, (s) => ({ ...s, isStreaming: false }))
        ),
        Effect.map(([state, endTime]): InsertionResult => ({
          totalChars: state.charsInserted,
          chunks: state.chunksReceived,
          durationMs: Number(endTime - startTime),
          finalPosition: state.currentPosition,
        }))
      ),

      abort: Ref.update(stateRef, (s) => ({ ...s, isStreaming: false })).pipe(
        Effect.tap(() =>
          Effect.logDebug(`TiptapAdapter: insertion aborted at ${config.id}`)
        )
      ),
    }))
  ),

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  getWordCount: getEditor(config).pipe(
    Effect.map((editor) => countWords(editor.state.doc.textContent)),
    Effect.orElseSucceed(() => 0)
  ),

  getCharCount: getEditor(config).pipe(
    Effect.map((editor) => editor.state.doc.textContent.length),
    Effect.orElseSucceed(() => 0)
  ),

  isDirty: Effect.succeed(false),

  // ---------------------------------------------------------------------------
  // Low-Level Access (for Reconciler)
  // ---------------------------------------------------------------------------

  getView: getEditor(config).pipe(
    Effect.map((editor) => editor.view),
    Effect.orElseSucceed(() => null)
  ),

  // ---------------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------------

  subscribeToUpdates: (callback) =>
    getEditor(config).pipe(
      Effect.map((editor) => {
        // TipTap's onUpdate fires on every content change
        const handler = () => {
          callback(editor.getJSON())
        }

        // Subscribe
        editor.on('update', handler)

        // Return unsubscribe function
        return () => {
          editor.off('update', handler)
        }
      })
    ),
})

// -----------------------------------------------------------------------------
// Layer Factory
// -----------------------------------------------------------------------------

/**
 * Create EditorOperations Layer from React ref.
 * Use with withEditorAI HOC.
 */
export const TiptapAdapter = {
  /**
   * Create a Layer that provides EditorOperations for a TipTap editor.
   */
  fromRef: (
    editorRef: RefObject<Editor | null>,
    id: EditorId
  ): Layer.Layer<EditorOperations> =>
    Layer.succeed(EditorOperations, createTiptapOperations({ id, editorRef })),

  /**
   * Create EditorOperationsShape directly (for manual wiring).
   */
  createOperations: (
    editorRef: RefObject<Editor | null>,
    id: EditorId
  ): EditorOperationsShape => createTiptapOperations({ id, editorRef }),
}
