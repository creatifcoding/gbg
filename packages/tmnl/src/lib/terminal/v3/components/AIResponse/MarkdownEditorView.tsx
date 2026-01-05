/**
 * MarkdownEditorView - TipTap Markdown Renderer with Per-Block Copy
 *
 * Renders TipTap JSONContent with:
 * - Syntax highlighted code blocks
 * - Per-block copy buttons
 * - Read-only and editable modes
 *
 * @module terminal/v3/components/AIResponse/MarkdownEditorView
 */

import { memo, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { JSONContent, Editor } from '@tiptap/core'
import { cn } from '@/lib/utils'
import { CodeBlockWithCopy } from './CodeBlockExtension'
import { codeBlockViewStyles } from './CodeBlockView'

// =============================================================================
// Styles
// =============================================================================

/**
 * Prose styles for markdown content.
 * Designed for terminal/AI response context with dark theme.
 */
export const markdownEditorStyles = `
  ${codeBlockViewStyles}

  /* Base prose container */
  .tmnl-markdown-view {
    font-family: var(--tmnl-font-sans, system-ui, -apple-system, sans-serif);
    font-size: 13px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.9);
  }

  /* Editable mode */
  .tmnl-markdown-view.editable {
    min-height: 100px;
  }

  .tmnl-markdown-view.editable:focus-within {
    outline: none;
  }

  /* Paragraph spacing */
  .tmnl-markdown-view p {
    margin: 0.5em 0;
  }

  .tmnl-markdown-view p:first-child {
    margin-top: 0;
  }

  .tmnl-markdown-view p:last-child {
    margin-bottom: 0;
  }

  /* Headings */
  .tmnl-markdown-view h1,
  .tmnl-markdown-view h2,
  .tmnl-markdown-view h3,
  .tmnl-markdown-view h4,
  .tmnl-markdown-view h5,
  .tmnl-markdown-view h6 {
    font-weight: 600;
    line-height: 1.3;
    margin: 1em 0 0.5em;
    color: rgba(255, 255, 255, 0.95);
  }

  .tmnl-markdown-view h1:first-child,
  .tmnl-markdown-view h2:first-child,
  .tmnl-markdown-view h3:first-child {
    margin-top: 0;
  }

  .tmnl-markdown-view h1 { font-size: 1.5em; }
  .tmnl-markdown-view h2 { font-size: 1.3em; }
  .tmnl-markdown-view h3 { font-size: 1.15em; }
  .tmnl-markdown-view h4 { font-size: 1.05em; }
  .tmnl-markdown-view h5 { font-size: 1em; }
  .tmnl-markdown-view h6 { font-size: 0.95em; color: rgba(255, 255, 255, 0.7); }

  /* Lists */
  .tmnl-markdown-view ul,
  .tmnl-markdown-view ol {
    margin: 0.5em 0;
    padding-left: 1.5em;
  }

  .tmnl-markdown-view li {
    margin: 0.25em 0;
  }

  .tmnl-markdown-view li > p {
    margin: 0;
  }

  .tmnl-markdown-view ul {
    list-style-type: disc;
  }

  .tmnl-markdown-view ul ul {
    list-style-type: circle;
  }

  .tmnl-markdown-view ul ul ul {
    list-style-type: square;
  }

  .tmnl-markdown-view ol {
    list-style-type: decimal;
  }

  /* Inline code */
  .tmnl-markdown-view code:not(.tmnl-code-block code):not([class*="language-"]) {
    font-family: "JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace;
    font-size: 0.875em;
    padding: 0.15em 0.4em;
    border-radius: 0.25em;
    background: rgba(255, 255, 255, 0.1);
    color: #e5c07b;
  }

  /* Blockquotes */
  .tmnl-markdown-view blockquote {
    margin: 0.75em 0;
    padding: 0.5em 1em;
    border-left: 3px solid rgba(45, 212, 191, 0.5);
    background: rgba(45, 212, 191, 0.05);
    color: rgba(255, 255, 255, 0.8);
    font-style: italic;
  }

  .tmnl-markdown-view blockquote p {
    margin: 0;
  }

  /* Horizontal rule */
  .tmnl-markdown-view hr {
    margin: 1em 0;
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  /* Links */
  .tmnl-markdown-view a {
    color: #61afef;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .tmnl-markdown-view a:hover {
    color: #8dc8f8;
  }

  /* Strong and emphasis */
  .tmnl-markdown-view strong {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .tmnl-markdown-view em {
    font-style: italic;
  }

  /* Strikethrough */
  .tmnl-markdown-view s,
  .tmnl-markdown-view del {
    text-decoration: line-through;
    color: rgba(255, 255, 255, 0.5);
  }

  /* Tables */
  .tmnl-markdown-view table {
    width: 100%;
    margin: 0.75em 0;
    border-collapse: collapse;
    font-size: 0.9em;
  }

  .tmnl-markdown-view th,
  .tmnl-markdown-view td {
    padding: 0.5em 0.75em;
    border: 1px solid rgba(255, 255, 255, 0.1);
    text-align: left;
  }

  .tmnl-markdown-view th {
    background: rgba(255, 255, 255, 0.05);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .tmnl-markdown-view tr:nth-child(even) td {
    background: rgba(255, 255, 255, 0.02);
  }

  /* Task lists */
  .tmnl-markdown-view ul[data-type="taskList"] {
    list-style: none;
    padding-left: 0;
  }

  .tmnl-markdown-view li[data-type="taskItem"] {
    display: flex;
    align-items: flex-start;
    gap: 0.5em;
  }

  .tmnl-markdown-view li[data-type="taskItem"] input[type="checkbox"] {
    margin-top: 0.25em;
    cursor: pointer;
  }

  .tmnl-markdown-view.readonly li[data-type="taskItem"] input[type="checkbox"] {
    cursor: default;
  }

  /* Images */
  .tmnl-markdown-view img {
    max-width: 100%;
    height: auto;
    border-radius: 0.5em;
    margin: 0.5em 0;
  }

  /* Selection */
  .tmnl-markdown-view ::selection {
    background: rgba(45, 212, 191, 0.3);
  }

  /* Placeholder for empty editor */
  .tmnl-markdown-view.editable .is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: rgba(255, 255, 255, 0.3);
    pointer-events: none;
    height: 0;
  }
`

// =============================================================================
// Style Injection
// =============================================================================

let stylesInjected = false

function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return

  const styleEl = document.createElement('style')
  styleEl.id = 'tmnl-markdown-view-styles'
  styleEl.textContent = markdownEditorStyles
  document.head.appendChild(styleEl)
  stylesInjected = true
}

// =============================================================================
// Read-Only Props
// =============================================================================

export interface MarkdownEditorViewProps {
  /** TipTap JSONContent to render */
  content: JSONContent | null

  /** Additional CSS class */
  className?: string

  /** Show a streaming cursor at the end */
  showCursor?: boolean

  /** Callback when editor is ready */
  onEditorReady?: (editor: Editor) => void
}

// =============================================================================
// Read-Only Component
// =============================================================================

function MarkdownEditorViewComponent({
  content,
  className,
  showCursor = false,
  onEditorReady,
}: MarkdownEditorViewProps) {
  // Inject styles on first render
  useEffect(() => {
    injectStyles()
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // Use CodeBlockWithCopy instead
      }),
      CodeBlockWithCopy,
    ],
    content: content ?? { type: 'doc', content: [] },
    editable: false,
    editorProps: {
      attributes: {
        class: 'tmnl-markdown-view readonly',
      },
    },
  })

  // Update content when it changes
  useEffect(() => {
    if (editor && content) {
      const currentJSON = editor.getJSON()
      if (JSON.stringify(currentJSON) !== JSON.stringify(content)) {
        editor.commands.setContent(content)
      }
    }
  }, [editor, content])

  // Notify when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor)
    }
  }, [editor, onEditorReady])

  if (!content) {
    return null
  }

  return (
    <div className={cn('tmnl-markdown-editor-view', className)}>
      <EditorContent editor={editor} />
      {showCursor && (
        <span className="inline-block w-2 h-4 ml-0.5 bg-cyan-400 animate-pulse align-middle" />
      )}
    </div>
  )
}

export const MarkdownEditorView = memo(MarkdownEditorViewComponent)

// =============================================================================
// Editable Props
// =============================================================================

export interface EditableMarkdownEditorProps {
  /** Initial TipTap JSONContent */
  content: JSONContent | null

  /** Callback when content changes */
  onChange?: (content: JSONContent) => void

  /** Callback when editor loses focus */
  onBlur?: (content: JSONContent) => void

  /** Additional CSS class */
  className?: string

  /** Placeholder text when empty */
  placeholder?: string

  /** Callback when editor is ready */
  onEditorReady?: (editor: Editor) => void

  /** Auto-focus the editor on mount */
  autoFocus?: boolean
}

// =============================================================================
// Editable Component
// =============================================================================

function EditableMarkdownEditorComponent({
  content,
  onChange,
  onBlur,
  className,
  placeholder = 'Start typing...',
  onEditorReady,
  autoFocus = false,
}: EditableMarkdownEditorProps) {
  // Inject styles on first render
  useEffect(() => {
    injectStyles()
  }, [])

  const handleUpdate = useCallback(
    ({ editor }: { editor: Editor }) => {
      if (onChange) {
        onChange(editor.getJSON())
      }
    },
    [onChange]
  )

  const handleBlur = useCallback(
    ({ editor }: { editor: Editor }) => {
      if (onBlur) {
        onBlur(editor.getJSON())
      }
    },
    [onBlur]
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockWithCopy,
    ],
    content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    editable: true,
    autofocus: autoFocus ? 'end' : false,
    onUpdate: handleUpdate,
    onBlur: handleBlur,
    editorProps: {
      attributes: {
        class: 'tmnl-markdown-view editable',
        'data-placeholder': placeholder,
      },
    },
  })

  // Notify when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor)
    }
  }, [editor, onEditorReady])

  return (
    <div className={cn('tmnl-markdown-editor-editable', className)}>
      <EditorContent editor={editor} />
    </div>
  )
}

export const EditableMarkdownEditor = memo(EditableMarkdownEditorComponent)

// =============================================================================
// Markdown Text Editor (simpler interface)
// =============================================================================

export interface MarkdownTextEditorProps {
  /** Markdown text content */
  value: string

  /** Callback when text changes */
  onChange?: (markdown: string) => void

  /** Additional CSS class */
  className?: string

  /** Placeholder text */
  placeholder?: string

  /** Read-only mode */
  readOnly?: boolean
}

/**
 * Higher-level component that handles markdown ↔ JSONContent conversion.
 * Use this when you want to work with raw markdown strings.
 */
export function MarkdownTextEditor({
  value,
  onChange,
  className,
  placeholder,
  readOnly = false,
}: MarkdownTextEditorProps) {
  // Note: This would need MarkdownService integration for proper conversion.
  // For now, this is a placeholder for the full implementation.

  if (readOnly) {
    // For read-only, we'd need to parse the markdown first
    return (
      <div className={cn('tmnl-markdown-text-editor readonly', className)}>
        <pre className="text-white/90 whitespace-pre-wrap" style={{ fontSize: '13px' }}>
          {value}
        </pre>
      </div>
    )
  }

  return (
    <div className={cn('tmnl-markdown-text-editor', className)}>
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full min-h-[100px] bg-transparent text-white/90 resize-y outline-none"
        style={{ fontSize: '13px' }}
      />
    </div>
  )
}
