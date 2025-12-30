/**
 * Base Editor Tools
 *
 * AI SDK tool definitions for editor operations.
 * Uses Effect.Schema directly - AI SDK 6+ native support.
 *
 * @module editor-ai/tools/base-tools
 */

import { tool } from 'ai'
import { Effect, Schema } from 'effect'
import type { EditorAIContextValue } from '../components/EditorAIProvider'
import type { AIContext } from '../schemas/operations'
import type { EditorId, Selection } from '../schemas/editor'
import {
  InsertTextParams,
  ReplaceSelectionParams,
  FocusEditorParams,
  GetContentRangeParams,
  SetSelectionParams,
  EmptyParams,
} from '../schemas/tools'

// -----------------------------------------------------------------------------
// Tool Factory
// -----------------------------------------------------------------------------

/**
 * Creates base editor tools for AI SDK integration.
 *
 * @param ctx - EditorAI context from provider
 * @returns Tool definitions compatible with AI SDK streamText/generateText
 *
 * @example
 * ```ts
 * const ctx = useEditorAIContext()
 * const tools = createBaseEditorTools(ctx)
 *
 * streamText({
 *   model: myModel,
 *   tools,
 *   // ...
 * })
 * ```
 */
export function createBaseEditorTools(ctx: EditorAIContextValue) {
  return {
    // -------------------------------------------------------------------------
    // Read Operations
    // -------------------------------------------------------------------------

    read_selection: tool({
      description:
        'Read the currently selected text in the focused editor. Returns selection range and text content.',
      parameters: EmptyParams,
      execute: async () => {
        const editor = ctx.getFocusedEditor()
        if (!editor) {
          return { selection: null, text: null, error: 'No editor focused' }
        }

        const [selection, text] = await Promise.all([
          Effect.runPromise(editor.getSelection),
          Effect.runPromise(editor.getSelectedText),
        ])

        return { selection, text }
      },
    }),

    get_context: tool({
      description:
        'Get comprehensive context from the focused editor including selection, surrounding text, metadata, and cursor position. Use this before performing AI operations.',
      parameters: EmptyParams,
      execute: async () => {
        const editor = ctx.getFocusedEditor()
        if (!editor) {
          return { error: 'No editor focused' }
        }

        const [selection, selectedText, metadata] = await Promise.all([
          Effect.runPromise(editor.getSelection),
          Effect.runPromise(editor.getSelectedText),
          Effect.runPromise(editor.getMetadata),
        ])

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

        const result: AIContext = {
          editorId: editor.id,
          title: metadata.title,
          selection,
          selectedText,
          surroundingContext,
          wordCount: metadata.wordCount,
          cursorPosition: selection?.from ?? 0,
        }

        return result
      },
    }),

    get_content_range: tool({
      description:
        'Get text content from a specific range in the focused editor.',
      parameters: GetContentRangeParams,
      execute: async ({ from, to }) => {
        const editor = ctx.getFocusedEditor()
        if (!editor) {
          return { error: 'No editor focused' }
        }

        const content = await Effect.runPromise(editor.getContentRange(from, to))
        return { content, from, to }
      },
    }),

    // -------------------------------------------------------------------------
    // Write Operations
    // -------------------------------------------------------------------------

    insert_text: tool({
      description:
        'Insert text at the current cursor position in the focused editor. Returns number of characters inserted.',
      parameters: InsertTextParams,
      execute: async ({ content }) => {
        const editor = ctx.getFocusedEditor()
        if (!editor) {
          return { success: false, error: 'No editor focused' }
        }

        const charsInserted = await Effect.runPromise(
          editor.insertAtCursor(content)
        )

        return {
          success: true,
          charsInserted,
          newPosition: charsInserted, // Approximate - actual comes from editor
        }
      },
    }),

    replace_selection: tool({
      description:
        'Replace the currently selected text with new content in the focused editor.',
      parameters: ReplaceSelectionParams,
      execute: async ({ content }) => {
        const editor = ctx.getFocusedEditor()
        if (!editor) {
          return { success: false, error: 'No editor focused' }
        }

        await Effect.runPromise(editor.replaceSelection(content))
        return { success: true, replaced: content.length }
      },
    }),

    delete_selection: tool({
      description: 'Delete the currently selected text in the focused editor.',
      parameters: EmptyParams,
      execute: async () => {
        const editor = ctx.getFocusedEditor()
        if (!editor) {
          return { success: false, error: 'No editor focused' }
        }

        await Effect.runPromise(editor.deleteSelection)
        return { success: true }
      },
    }),

    // -------------------------------------------------------------------------
    // Selection Operations
    // -------------------------------------------------------------------------

    set_selection: tool({
      description: 'Set the text selection range in the focused editor.',
      parameters: SetSelectionParams,
      execute: async ({ from, to }) => {
        const editor = ctx.getFocusedEditor()
        if (!editor) {
          return { success: false, error: 'No editor focused' }
        }

        await Effect.runPromise(editor.setSelection(from, to))
        return { success: true, from, to }
      },
    }),

    clear_selection: tool({
      description:
        'Clear the current selection in the focused editor (collapse to cursor).',
      parameters: EmptyParams,
      execute: async () => {
        const editor = ctx.getFocusedEditor()
        if (!editor) {
          return { success: false, error: 'No editor focused' }
        }

        await Effect.runPromise(editor.clearSelection)
        return { success: true }
      },
    }),

    // -------------------------------------------------------------------------
    // Editor Management
    // -------------------------------------------------------------------------

    list_editors: tool({
      description:
        'List all registered editors that can be controlled. Returns editor IDs and which one is currently focused.',
      parameters: EmptyParams,
      execute: async () => {
        const editors = ctx.getAllEditorIds()
        const focused = ctx.getFocusedEditorId()

        return {
          editors,
          focused,
          count: editors.length,
        }
      },
    }),

    focus_editor: tool({
      description:
        'Focus a specific editor by ID. Use list_editors first to see available editors.',
      parameters: FocusEditorParams,
      execute: async ({ editorId }) => {
        const editor = ctx.getEditor(editorId as EditorId)
        if (!editor) {
          return {
            success: false,
            error: `Editor not found: ${editorId}`,
          }
        }

        await Effect.runPromise(editor.focus)
        ctx.setFocusedEditor(editorId as EditorId)

        return { success: true, focused: editorId }
      },
    }),
  }
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type BaseEditorTools = ReturnType<typeof createBaseEditorTools>
export type BaseEditorToolName = keyof BaseEditorTools
