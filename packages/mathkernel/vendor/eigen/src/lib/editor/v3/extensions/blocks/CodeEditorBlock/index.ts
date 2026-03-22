/**
 * CodeEditorBlock Extension
 *
 * Custom Tiptap block that embeds a full Monaco editor with VANTA theme.
 * Wrapped in EmbeddedBlockWrapper — supports fold, badges, and focus mode
 * which lifts the editor to a full-viewport overlay via FocusOverlay portal.
 *
 * Pattern follows DataGridBlock:
 *   Node.create → ReactNodeViewRenderer → EmbeddedBlockWrapper → CodeEditorLayout
 *
 * @module editor/v3/extensions/blocks/CodeEditorBlock
 */

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { nanoid } from 'nanoid'

import {
  createProtectedNodeKeyboardShortcuts,
  protectedNodeViewOptions,
} from '../EmbeddedBlockWrapper/shared/protectedNode'

import { CodeEditorBlockView } from './CodeEditorBlockView'
import { DEFAULT_CODE, DEFAULT_LANGUAGE } from './atoms'

// =============================================================================
// Types
// =============================================================================

export interface CodeEditorBlockAttrs {
  /** Unique block ID */
  id: string
  /** Source code content */
  code: string
  /** Language mode */
  language: string
}

export interface CodeEditorBlockOptions {
  /** HTML attributes for the container */
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    codeEditorBlock: {
      /** Insert a code editor block */
      insertCodeEditor: (options?: {
        code?: string
        language?: string
      }) => ReturnType
      /** Delete the current code editor block */
      deleteCodeEditor: () => ReturnType
    }
  }
}

// =============================================================================
// Extension
// =============================================================================

export const CodeEditorBlock = Node.create<CodeEditorBlockOptions>({
  name: 'codeEditorBlock',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  group: 'block',

  atom: true,

  selectable: true,

  draggable: true,

  addAttributes() {
    return {
      id: {
        default: () => nanoid(12),
        parseHTML: (element) => element.getAttribute('data-id') || nanoid(12),
        renderHTML: (attributes) => ({ 'data-id': attributes.id }),
      },
      code: {
        default: DEFAULT_CODE,
        parseHTML: (element) => element.getAttribute('data-code') || DEFAULT_CODE,
        renderHTML: (attributes) => ({ 'data-code': attributes.code }),
      },
      language: {
        default: DEFAULT_LANGUAGE,
        parseHTML: (element) => element.getAttribute('data-language') || DEFAULT_LANGUAGE,
        renderHTML: (attributes) => ({ 'data-language': attributes.language }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="codeEditorBlock"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'codeEditorBlock',
        'data-id': node.attrs.id,
        'data-language': node.attrs.language,
      }),
      ['pre', {}, ['code', {}, node.attrs.code]],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeEditorBlockView, protectedNodeViewOptions)
  },

  addKeyboardShortcuts() {
    return createProtectedNodeKeyboardShortcuts.call(this)
  },

  addCommands() {
    return {
      insertCodeEditor:
        (options = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              id: nanoid(12),
              code: options.code ?? DEFAULT_CODE,
              language: options.language ?? DEFAULT_LANGUAGE,
            },
          })
        },
      deleteCodeEditor:
        () =>
        ({ commands }) => {
          return commands.deleteNode(this.name)
        },
    }
  },
})

// =============================================================================
// Re-exports
// =============================================================================

export { CodeEditorBlockView } from './CodeEditorBlockView'
export {
  createCodeEditorBlockAtoms,
  getCodeEditorBlockAtoms,
  disposeCodeEditorBlockAtoms,
  DEFAULT_CODE,
  DEFAULT_LANGUAGE,
  type CodeEditorBlockAtoms,
  type CodeEditorState,
} from './atoms'
