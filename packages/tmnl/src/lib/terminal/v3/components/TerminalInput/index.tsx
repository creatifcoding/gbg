/**
 * TerminalInput - Multiline TipTap-based Input
 *
 * A proper multiline terminal input using TipTap that:
 * - Auto-resizes based on content (no fixed row counts)
 * - Supports Enter to submit, Shift+Enter for newline
 * - Provides placeholder support
 * - Exposes text content as plain string
 *
 * @module terminal/v3/components/TerminalInput
 */

import {
  memo,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Placeholder from '@tiptap/extension-placeholder'
import History from '@tiptap/extension-history'
import { Extension } from '@tiptap/core'
import { cn } from '@/lib/utils'

// =============================================================================
// Types
// =============================================================================

export interface TerminalInputRef {
  /** Focus the input */
  focus: () => void
  /** Blur the input */
  blur: () => void
  /** Clear the input */
  clear: () => void
  /** Set the input value */
  setValue: (text: string) => void
  /** Get the current value */
  getValue: () => string
  /** Get the underlying TipTap editor */
  getEditor: () => Editor | null
}

export interface TerminalInputProps {
  /** Current value */
  value: string

  /** Called when value changes */
  onChange: (value: string) => void

  /** Called on submit (Enter without Shift) */
  onSubmit?: () => void

  /** Called when input receives focus */
  onFocus?: () => void

  /** Called when input loses focus */
  onBlur?: () => void

  /** Called on keydown (for additional key handling) */
  onKeyDown?: (event: KeyboardEvent) => void

  /** Placeholder text */
  placeholder?: string

  /** Whether input is disabled */
  disabled?: boolean

  /** Whether input is submitting (shows loading state) */
  isSubmitting?: boolean

  /** Minimum height in pixels */
  minHeight?: number

  /** Maximum height in pixels (scrolls after) */
  maxHeight?: number

  /** Additional class name */
  className?: string

  /** Auto-focus on mount */
  autoFocus?: boolean
}

// =============================================================================
// Styles
// =============================================================================

const terminalInputStyles = `
  .tmnl-terminal-input {
    width: 100%;
    outline: none;
  }

  .tmnl-terminal-input .ProseMirror {
    outline: none;
    min-height: inherit;
    max-height: inherit;
    overflow-y: auto;
  }

  .tmnl-terminal-input .ProseMirror p {
    margin: 0;
    line-height: 1.6;
  }

  .tmnl-terminal-input .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: rgba(255, 255, 255, 0.3);
    pointer-events: none;
    height: 0;
    font-style: normal;
  }

  .tmnl-terminal-input .ProseMirror:focus {
    outline: none;
  }

  /* Hide scrollbar but keep functionality */
  .tmnl-terminal-input .ProseMirror::-webkit-scrollbar {
    width: 6px;
  }

  .tmnl-terminal-input .ProseMirror::-webkit-scrollbar-track {
    background: transparent;
  }

  .tmnl-terminal-input .ProseMirror::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .tmnl-terminal-input .ProseMirror::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`

// =============================================================================
// Style Injection
// =============================================================================

let stylesInjected = false

function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return

  const styleEl = document.createElement('style')
  styleEl.id = 'tmnl-terminal-input-styles'
  styleEl.textContent = terminalInputStyles
  document.head.appendChild(styleEl)
  stylesInjected = true
}

// =============================================================================
// Custom Extension for Submit Handling
// =============================================================================

interface SubmitExtensionOptions {
  onSubmit?: () => void
  onKeyDown?: (event: KeyboardEvent) => void
}

const SubmitOnEnter = Extension.create<SubmitExtensionOptions>({
  name: 'submitOnEnter',

  addOptions() {
    return {
      onSubmit: undefined,
      onKeyDown: undefined,
    }
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        // Shift+Enter = new line (let default behavior happen)
        // We can't detect shift here, so we use the DOM event handler
        return false
      },
    }
  },

  addProseMirrorPlugins() {
    const { onSubmit, onKeyDown } = this.options

    return [
      {
        props: {
          handleKeyDown: (view, event) => {
            // Call custom onKeyDown if provided
            onKeyDown?.(event)

            // Enter without Shift = submit
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              onSubmit?.()
              return true
            }

            return false
          },
        },
      },
    ]
  },
})

// =============================================================================
// Component
// =============================================================================

function TerminalInputComponent(
  {
    value,
    onChange,
    onSubmit,
    onFocus,
    onBlur,
    onKeyDown,
    placeholder = 'Type a command or ask a question...',
    disabled = false,
    isSubmitting = false,
    minHeight = 24,
    maxHeight = 200,
    className,
    autoFocus = false,
  }: TerminalInputProps,
  ref: React.ForwardedRef<TerminalInputRef>
) {
  const editorContainerRef = useRef<HTMLDivElement>(null)

  // Inject styles on mount
  useEffect(() => {
    injectStyles()
  }, [])

  // Create editor
  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      History,
      Placeholder.configure({
        placeholder,
        showOnlyWhenEditable: true,
      }),
      SubmitOnEnter.configure({
        onSubmit,
        onKeyDown,
      }),
    ],
    content: value ? `<p>${escapeHtml(value).replace(/\n/g, '</p><p>')}</p>` : '',
    editable: !disabled && !isSubmitting,
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor }) => {
      // Extract plain text (join paragraphs with newlines)
      const text = editor.getText()
      onChange(text)
    },
    onFocus: () => {
      onFocus?.()
    },
    onBlur: () => {
      onBlur?.()
    },
    editorProps: {
      attributes: {
        class: 'tmnl-terminal-input-editor',
        style: `min-height: ${minHeight}px; max-height: ${maxHeight}px;`,
      },
    },
  })

  // Sync external value changes to editor
  useEffect(() => {
    if (!editor) return

    const currentText = editor.getText()
    if (currentText !== value) {
      // Only update if different to avoid cursor jumping
      const { from, to } = editor.state.selection
      editor.commands.setContent(
        value ? `<p>${escapeHtml(value).replace(/\n/g, '</p><p>')}</p>` : ''
      )
      // Try to restore cursor position
      try {
        const maxPos = editor.state.doc.content.size - 1
        const newFrom = Math.min(from, maxPos)
        const newTo = Math.min(to, maxPos)
        if (newFrom >= 0 && newTo >= 0) {
          editor.commands.setTextSelection({ from: newFrom, to: newTo })
        }
      } catch {
        // Ignore selection errors
      }
    }
  }, [editor, value])

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled && !isSubmitting)
    }
  }, [editor, disabled, isSubmitting])

  // Expose imperative handle
  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        editor?.commands.focus('end')
      },
      blur: () => {
        editor?.commands.blur()
      },
      clear: () => {
        editor?.commands.clearContent()
        onChange('')
      },
      setValue: (text: string) => {
        editor?.commands.setContent(
          text ? `<p>${escapeHtml(text).replace(/\n/g, '</p><p>')}</p>` : ''
        )
        onChange(text)
      },
      getValue: () => {
        return editor?.getText() ?? ''
      },
      getEditor: () => editor,
    }),
    [editor, onChange]
  )

  return (
    <div
      ref={editorContainerRef}
      className={cn(
        'tmnl-terminal-input',
        disabled && 'opacity-50 cursor-not-allowed',
        isSubmitting && 'opacity-70',
        className
      )}
      style={{
        minHeight: `${minHeight}px`,
        maxHeight: `${maxHeight}px`,
      }}
    >
      <EditorContent
        editor={editor}
        className="w-full text-white/90"
        style={{
          fontSize: 'var(--tmnl-text-sm, 14px)',
          lineHeight: '1.6',
        }}
      />
    </div>
  )
}

// Helper to escape HTML entities
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export const TerminalInput = memo(forwardRef(TerminalInputComponent))

// =============================================================================
// Re-export for convenience
// =============================================================================

export type { Editor as TipTapEditor }
