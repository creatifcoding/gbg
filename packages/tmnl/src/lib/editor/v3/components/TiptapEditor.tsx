/**
 * TiptapEditor
 *
 * Core Tiptap editor component with Effect integration.
 * Uses EffectBridge to sync state to atoms.
 *
 * @module editor/v3/components/TiptapEditor
 */

import React, { forwardRef, useImperativeHandle, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { Editor, JSONContent } from '@tiptap/core';
import { EffectBridge } from '../extensions';

// =============================================================================
// Types
// =============================================================================

export interface TiptapEditorHandle {
  /** Get the Tiptap Editor instance */
  getEditor: () => Editor | null;
  /** Focus the editor */
  focus: (position?: 'start' | 'end' | 'all' | number) => void;
  /** Blur the editor */
  blur: () => void;
  /** Get content as JSON */
  getJSON: () => JSONContent;
  /** Get content as HTML */
  getHTML: () => string;
  /** Get content as plain text */
  getText: () => string;
  /** Set content from JSON */
  setContent: (content: JSONContent) => void;
  /** Clear the editor */
  clear: () => void;
  /** Undo */
  undo: () => boolean;
  /** Redo */
  redo: () => boolean;
}

export interface TiptapEditorProps {
  /** Initial content (JSON or HTML string) */
  initialContent?: JSONContent | string;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Read-only mode */
  editable?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean | 'start' | 'end' | 'all' | number;
  /** Callback when editor is ready */
  onReady?: (editor: Editor) => void;
  /** Callback on content change */
  onChange?: (content: JSONContent) => void;
  /** Callback on selection change */
  onSelectionChange?: (selection: { from: number; to: number; empty: boolean }) => void;
  /** Transaction callback for auto-save triggers */
  onTransaction?: (meta: { docChanged: boolean; selectionChanged: boolean }) => void;
  /** Content update debounce (ms) */
  contentDebounce?: number;
  /** Custom class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
}

// =============================================================================
// Component
// =============================================================================

export const TiptapEditor = forwardRef<TiptapEditorHandle, TiptapEditorProps>(
  function TiptapEditor(
    {
      initialContent,
      placeholder,
      editable = true,
      autoFocus = false,
      onReady,
      onChange,
      onSelectionChange,
      onTransaction,
      contentDebounce = 0,
      className,
      style,
    },
    ref
  ) {
    // Parse initial content
    const content = typeof initialContent === 'string'
      ? initialContent
      : initialContent ?? { type: 'doc', content: [{ type: 'paragraph' }] };

    // Initialize editor
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          history: {
            depth: 100,
          },
        }),
        EffectBridge.configure({
          onTransaction: (meta) => {
            onTransaction?.(meta);

            if (meta.docChanged && onChange) {
              onChange(editor?.getJSON() ?? { type: 'doc', content: [] });
            }
          },
          contentDebounce,
        }),
      ],
      content,
      editable,
      autofocus: autoFocus,
      editorProps: {
        attributes: {
          class: 'tmnl-editor-content',
          'data-placeholder': placeholder ?? '',
        },
      },
      onCreate: ({ editor }) => {
        onReady?.(editor);
      },
      onSelectionUpdate: ({ editor }) => {
        const { from, to, empty } = editor.state.selection;
        onSelectionChange?.({ from, to, empty });
      },
    });

    // Expose imperative handle
    const getEditor = useCallback(() => editor, [editor]);

    useImperativeHandle(
      ref,
      () => ({
        getEditor,
        focus: (position) => editor?.commands.focus(position),
        blur: () => editor?.commands.blur(),
        getJSON: () => editor?.getJSON() ?? { type: 'doc', content: [] },
        getHTML: () => editor?.getHTML() ?? '',
        getText: () => editor?.getText() ?? '',
        setContent: (content) => editor?.commands.setContent(content),
        clear: () => editor?.commands.clearContent(),
        undo: () => editor?.commands.undo() ?? false,
        redo: () => editor?.commands.redo() ?? false,
      }),
      [editor, getEditor]
    );

    return (
      <div
        className={className}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: '200px',
          background: 'var(--tmnl-surface-1, #1e1e1e)',
          borderRadius: '8px',
          overflow: 'hidden',
          ...style,
        }}
        data-tmnl-editor="tiptap"
        data-editable={editable}
      >
        <EditorContent
          editor={editor}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
        <style>{`
          .tmnl-editor-content {
            padding: 1.5rem;
            min-height: 200px;
            color: var(--tmnl-text-primary, #e0e0e0);
            font-family: var(--tmnl-font-sans, system-ui, -apple-system, sans-serif);
            font-size: var(--tmnl-text-base, 16px);
            line-height: 1.6;
            outline: none;
          }

          .tmnl-editor-content:focus {
            outline: none;
          }

          .tmnl-editor-content p {
            margin: 0 0 1em 0;
          }

          .tmnl-editor-content p:last-child {
            margin-bottom: 0;
          }

          .tmnl-editor-content h1,
          .tmnl-editor-content h2,
          .tmnl-editor-content h3,
          .tmnl-editor-content h4,
          .tmnl-editor-content h5,
          .tmnl-editor-content h6 {
            color: var(--tmnl-text-primary, #e0e0e0);
            margin: 1.5em 0 0.5em 0;
            line-height: 1.3;
          }

          .tmnl-editor-content h1 { font-size: 2em; }
          .tmnl-editor-content h2 { font-size: 1.5em; }
          .tmnl-editor-content h3 { font-size: 1.25em; }

          .tmnl-editor-content strong {
            font-weight: 600;
          }

          .tmnl-editor-content em {
            font-style: italic;
          }

          .tmnl-editor-content code {
            font-family: var(--tmnl-font-mono, 'JetBrains Mono', monospace);
            font-size: 0.9em;
            background: var(--tmnl-surface-2, #2a2a2a);
            padding: 0.2em 0.4em;
            border-radius: 4px;
          }

          .tmnl-editor-content pre {
            background: var(--tmnl-surface-2, #2a2a2a);
            padding: 1rem;
            border-radius: 8px;
            overflow-x: auto;
            margin: 1em 0;
          }

          .tmnl-editor-content pre code {
            background: none;
            padding: 0;
          }

          .tmnl-editor-content blockquote {
            border-left: 3px solid var(--tmnl-accent-cyan, #4ecdc4);
            margin: 1em 0;
            padding-left: 1rem;
            color: var(--tmnl-text-secondary, #a0a0a0);
          }

          .tmnl-editor-content ul,
          .tmnl-editor-content ol {
            padding-left: 1.5rem;
            margin: 0.5em 0;
          }

          .tmnl-editor-content li {
            margin: 0.25em 0;
          }

          .tmnl-editor-content hr {
            border: none;
            border-top: 1px solid var(--tmnl-surface-3, #3a3a3a);
            margin: 2em 0;
          }

          .tmnl-editor-content a {
            color: var(--tmnl-accent-cyan, #4ecdc4);
            text-decoration: none;
          }

          .tmnl-editor-content a:hover {
            text-decoration: underline;
          }

          /* Placeholder */
          .tmnl-editor-content p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            color: var(--tmnl-text-muted, #666);
            float: left;
            height: 0;
            pointer-events: none;
          }

          /* Selection */
          .tmnl-editor-content ::selection {
            background: var(--tmnl-accent-cyan, #4ecdc4);
            color: var(--tmnl-surface-0, #1a1a1a);
          }
        `}</style>
      </div>
    );
  }
);

export default TiptapEditor;
