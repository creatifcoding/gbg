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
import { editorContentStyles } from './styles';

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
        <style>{editorContentStyles}</style>
      </div>
    );
  }
);

export default TiptapEditor;
