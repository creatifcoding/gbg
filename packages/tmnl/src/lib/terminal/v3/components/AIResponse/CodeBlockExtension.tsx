/**
 * CodeBlockExtension - TipTap Extension with Copy Button NodeView
 *
 * Extends CodeBlockLowlight with a custom React NodeView that includes:
 * - Per-block copy button
 * - Language label
 * - Proper styling
 *
 * @module terminal/v3/components/AIResponse/CodeBlockExtension
 */

import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { common, createLowlight } from 'lowlight'
import { CodeBlockView } from './CodeBlockView'

// =============================================================================
// Lowlight Instance
// =============================================================================

/**
 * Create a lowlight instance with common languages.
 */
export const lowlight = createLowlight(common)

// =============================================================================
// Extension
// =============================================================================

export const DEFAULT_CODE_LANGUAGE = 'plaintext'

/**
 * CodeBlockWithCopy Extension
 *
 * Code blocks with syntax highlighting and per-block copy functionality.
 * Uses ReactNodeViewRenderer for the custom NodeView.
 *
 * @example
 * ```tsx
 * import { useEditor } from '@tiptap/react'
 * import StarterKit from '@tiptap/starter-kit'
 * import { CodeBlockWithCopy } from './CodeBlockExtension'
 *
 * const editor = useEditor({
 *   extensions: [
 *     StarterKit.configure({ codeBlock: false }),
 *     CodeBlockWithCopy,
 *   ],
 * })
 * ```
 */
export const CodeBlockWithCopy = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
}).configure({
  lowlight,
  defaultLanguage: DEFAULT_CODE_LANGUAGE,
})

/**
 * CodeBlockWithCopy for read-only contexts.
 * Same as above but optimized for non-editable use.
 */
export const CodeBlockWithCopyReadOnly = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
}).configure({
  lowlight,
  defaultLanguage: DEFAULT_CODE_LANGUAGE,
})

// =============================================================================
// Factory for Custom Configuration
// =============================================================================

export interface CodeBlockWithCopyOptions {
  defaultLanguage?: string
  showLineNumbers?: boolean
}

/**
 * Create a CodeBlockWithCopy extension with custom options.
 */
export function createCodeBlockWithCopy(options: CodeBlockWithCopyOptions = {}) {
  const { defaultLanguage = DEFAULT_CODE_LANGUAGE } = options

  return CodeBlockLowlight.extend({
    addNodeView() {
      return ReactNodeViewRenderer(CodeBlockView)
    },
  }).configure({
    lowlight,
    defaultLanguage,
  })
}
