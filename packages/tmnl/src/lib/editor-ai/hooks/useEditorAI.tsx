/**
 * useEditorAI Hook
 *
 * Primary hook for AI consumers to interact with editors.
 * Provides operations for inserting text, streaming, and gathering context.
 *
 * @module editor-ai/hooks/useEditorAI
 */

import { useCallback, useMemo } from 'react'
import { Effect, Stream } from 'effect'

import { useEditorAIContext } from '../components/EditorAIProvider'
import type { EditorId, Selection, InsertionResult } from '../schemas/editor'
import type { AIContext } from '../schemas/operations'
import type { AIStreamError } from '../schemas/errors'
import type { EditorOperationsShape } from '../services/EditorOperations'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface UseEditorAIResult {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /**
   * Currently focused editor ID, or null if none.
   */
  focusedEditorId: EditorId | null

  /**
   * All registered editor IDs.
   */
  registeredEditors: readonly EditorId[]

  /**
   * Number of registered editors.
   */
  editorCount: number

  /**
   * Whether the specified editor is registered.
   */
  isRegistered: (id: EditorId) => boolean

  // ---------------------------------------------------------------------------
  // Operations
  // ---------------------------------------------------------------------------

  /**
   * Focus a specific editor by ID.
   */
  focusEditor: (id: EditorId) => Promise<void>

  /**
   * Insert text at cursor position in focused editor.
   * Returns number of characters inserted.
   */
  insertText: (content: string) => Promise<number>

  /**
   * Replace selection in focused editor.
   */
  replaceSelection: (content: string) => Promise<void>

  /**
   * Get current selection from focused editor.
   */
  getSelection: () => Promise<Selection | null>

  /**
   * Get selected text from focused editor.
   */
  getSelectedText: () => Promise<string | null>

  /**
   * Get AI context from focused editor.
   * Includes selection, surrounding text, metadata.
   */
  getContext: () => Promise<AIContext>

  /**
   * Stream text insertion into focused editor.
   * Consumes Effect.Stream and inserts each chunk.
   */
  streamInsert: (
    stream: Stream.Stream<string, AIStreamError>
  ) => Promise<InsertionResult>

  // ---------------------------------------------------------------------------
  // Direct Access
  // ---------------------------------------------------------------------------

  /**
   * Get editor operations by ID.
   */
  getEditor: (id: EditorId) => EditorOperationsShape | undefined

  /**
   * Get focused editor operations.
   */
  getFocusedEditor: () => EditorOperationsShape | undefined
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

/**
 * Hook for AI consumers to interact with registered editors.
 *
 * Usage:
 * ```tsx
 * function AIChatPanel() {
 *   const {
 *     focusedEditorId,
 *     insertText,
 *     streamInsert,
 *     getContext,
 *   } = useEditorAI()
 *
 *   const handleInsert = async (text: string) => {
 *     await insertText(text)
 *   }
 *
 *   return <ChatUI onInsert={handleInsert} />
 * }
 * ```
 */
export function useEditorAI(): UseEditorAIResult {
  const ctx = useEditorAIContext()

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const focusedEditorId = ctx.getFocusedEditorId()
  const registeredEditors = ctx.getAllEditorIds()
  const editorCount = registeredEditors.length

  const isRegistered = useCallback(
    (id: EditorId): boolean => {
      return ctx.getEditor(id) !== undefined
    },
    [ctx]
  )

  // ---------------------------------------------------------------------------
  // Operations
  // ---------------------------------------------------------------------------

  const focusEditor = useCallback(
    async (id: EditorId): Promise<void> => {
      const editor = ctx.getEditor(id)
      if (!editor) {
        throw new Error(`Editor not found: ${id}`)
      }
      await Effect.runPromise(editor.focus)
      ctx.setFocusedEditor(id)
    },
    [ctx]
  )

  const insertText = useCallback(
    async (content: string): Promise<number> => {
      const editor = ctx.getFocusedEditor()
      if (!editor) {
        throw new Error('No editor focused')
      }
      return Effect.runPromise(editor.insertAtCursor(content))
    },
    [ctx]
  )

  const replaceSelection = useCallback(
    async (content: string): Promise<void> => {
      const editor = ctx.getFocusedEditor()
      if (!editor) {
        throw new Error('No editor focused')
      }
      await Effect.runPromise(editor.replaceSelection(content))
    },
    [ctx]
  )

  const getSelection = useCallback(async (): Promise<Selection | null> => {
    const editor = ctx.getFocusedEditor()
    if (!editor) {
      throw new Error('No editor focused')
    }
    return Effect.runPromise(editor.getSelection)
  }, [ctx])

  const getSelectedText = useCallback(async (): Promise<string | null> => {
    const editor = ctx.getFocusedEditor()
    if (!editor) {
      throw new Error('No editor focused')
    }
    return Effect.runPromise(editor.getSelectedText)
  }, [ctx])

  const getContext = useCallback(async (): Promise<AIContext> => {
    const editor = ctx.getFocusedEditor()
    if (!editor) {
      throw new Error('No editor focused')
    }

    // Gather context from editor
    const [selection, selectedText, metadata] = await Promise.all([
      Effect.runPromise(editor.getSelection),
      Effect.runPromise(editor.getSelectedText),
      Effect.runPromise(editor.getMetadata),
    ])

    // Get surrounding context if we have a selection
    let surroundingContext: string | null = null
    if (selection !== null) {
      try {
        surroundingContext = await Effect.runPromise(
          editor.getContentRange(
            Math.max(0, selection.from - 200),
            selection.to + 200
          )
        )
      } catch {
        // Ignore errors getting surrounding context
      }
    }

    return {
      editorId: editor.id,
      title: metadata.title,
      selection,
      selectedText,
      surroundingContext,
      wordCount: metadata.wordCount,
      cursorPosition: selection?.from ?? 0,
    }
  }, [ctx])

  const streamInsert = useCallback(
    async (
      stream: Stream.Stream<string, AIStreamError>
    ): Promise<InsertionResult> => {
      const editor = ctx.getFocusedEditor()
      if (!editor) {
        throw new Error('No editor focused')
      }
      return Effect.runPromise(editor.streamInsert(stream))
    },
    [ctx]
  )

  // ---------------------------------------------------------------------------
  // Direct Access
  // ---------------------------------------------------------------------------

  const getEditor = useCallback(
    (id: EditorId): EditorOperationsShape | undefined => {
      return ctx.getEditor(id)
    },
    [ctx]
  )

  const getFocusedEditor = useCallback((): EditorOperationsShape | undefined => {
    return ctx.getFocusedEditor()
  }, [ctx])

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return useMemo(
    () => ({
      // State
      focusedEditorId,
      registeredEditors,
      editorCount,
      isRegistered,

      // Operations
      focusEditor,
      insertText,
      replaceSelection,
      getSelection,
      getSelectedText,
      getContext,
      streamInsert,

      // Direct access
      getEditor,
      getFocusedEditor,
    }),
    [
      focusedEditorId,
      registeredEditors,
      editorCount,
      isRegistered,
      focusEditor,
      insertText,
      replaceSelection,
      getSelection,
      getSelectedText,
      getContext,
      streamInsert,
      getEditor,
      getFocusedEditor,
    ]
  )
}

export default useEditorAI
