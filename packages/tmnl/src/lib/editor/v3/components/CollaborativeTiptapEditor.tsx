/**
 * CollaborativeTiptapEditor
 *
 * Tiptap editor with real-time collaboration via y-sweet.
 * Wraps TiptapEditor with YDocProvider and collaboration extensions.
 *
 * @module editor/v3/components/CollaborativeTiptapEditor
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { YDocProvider, useAwareness, useYDoc } from '@y-sweet/react';
import type { Editor, JSONContent } from '@tiptap/core';
import type { ClientToken } from '@y-sweet/sdk';
import { EffectBridge, CollaborationBridge, collaborationStyles } from '../extensions';
import { generateUserColor, type CollaborationUser } from '../services';
import { editorContentStyles, collaborativeEditorStyles } from './styles';

// =============================================================================
// Types
// =============================================================================

export interface CollaborativeTiptapEditorHandle {
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
}

export interface CollaborativeTiptapEditorProps {
  /**
   * Client token from y-sweet server.
   * Get this from collaborationOps.connect() or clientTokenAtom.
   */
  clientToken: ClientToken;

  /**
   * Current user info for cursor presence.
   */
  user: CollaborationUser;

  /**
   * Placeholder text when empty.
   */
  placeholder?: string;

  /**
   * Read-only mode (still syncs but can't edit).
   */
  editable?: boolean;

  /**
   * Auto-focus on mount.
   */
  autoFocus?: boolean | 'start' | 'end' | 'all' | number;

  /**
   * Callback when editor is ready.
   */
  onReady?: (editor: Editor) => void;

  /**
   * Callback when awareness changes (users join/leave/move).
   */
  onAwarenessChange?: (users: CollaborationUser[]) => void;

  /**
   * Callback on content change.
   * Note: In collaborative mode, changes sync automatically.
   */
  onChange?: (content: JSONContent) => void;

  /**
   * Custom class name.
   */
  className?: string;

  /**
   * Custom styles.
   */
  style?: React.CSSProperties;
}

// =============================================================================
// Inner Editor (uses y-sweet hooks)
// =============================================================================

interface InnerEditorProps extends Omit<CollaborativeTiptapEditorProps, 'clientToken'> {
  editorRef: React.Ref<CollaborativeTiptapEditorHandle>;
}

const InnerEditor: React.FC<InnerEditorProps> = ({
  user,
  placeholder,
  editable = true,
  autoFocus = false,
  onReady,
  onAwarenessChange,
  onChange,
  className,
  style,
  editorRef,
}) => {
  const doc = useYDoc();
  const awareness = useAwareness();

  // Memoize user with color
  const userWithColor = useMemo<CollaborationUser>(() => ({
    name: user.name,
    color: user.color || generateUserColor(user.name),
  }), [user.name, user.color]);

  // Initialize editor with collaboration extensions
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable history - Yjs handles undo/redo
        history: false,
      }),
      EffectBridge.configure({
        onTransaction: (meta) => {
          if (meta.docChanged && onChange) {
            onChange(editor?.getJSON() ?? { type: 'doc', content: [] });
          }
        },
      }),
      CollaborationBridge.configure({
        document: doc,
        awareness,
        user: userWithColor,
        field: 'prosemirror',
        onAwarenessChange: (states) => {
          if (onAwarenessChange) {
            const users: CollaborationUser[] = [];
            states.forEach((state: unknown) => {
              const s = state as { user?: CollaborationUser };
              if (s.user) {
                users.push(s.user);
              }
            });
            onAwarenessChange(users);
          }
        },
      }),
    ],
    editable,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class: 'tmnl-editor-content tmnl-collab-editor',
        'data-placeholder': placeholder ?? '',
      },
    },
    onCreate: ({ editor }) => {
      onReady?.(editor);
    },
  }, [doc, awareness, userWithColor]);

  // Update awareness with user info
  useEffect(() => {
    if (awareness) {
      awareness.setLocalStateField('user', userWithColor);
    }
  }, [awareness, userWithColor]);

  // Expose imperative handle
  const getEditor = useCallback(() => editor, [editor]);

  useImperativeHandle(
    editorRef,
    () => ({
      getEditor,
      focus: (position) => editor?.commands.focus(position),
      blur: () => editor?.commands.blur(),
      getJSON: () => editor?.getJSON() ?? { type: 'doc', content: [] },
      getHTML: () => editor?.getHTML() ?? '',
      getText: () => editor?.getText() ?? '',
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
      data-tmnl-editor="collaborative-tiptap"
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
        ${editorContentStyles}
        ${collaborativeEditorStyles}
        ${collaborationStyles}
      `}</style>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

/**
 * CollaborativeTiptapEditor
 *
 * Real-time collaborative Tiptap editor powered by y-sweet.
 *
 * @example
 * ```tsx
 * import { CollaborativeTiptapEditor } from '@/lib/editor/v3'
 * import { useAtomValue } from '@effect-atom/atom-react'
 * import { clientTokenAtom, collaborationOps } from '@/lib/editor/v3'
 *
 * function MyEditor() {
 *   const clientToken = useAtomValue(clientTokenAtom)
 *
 *   useEffect(() => {
 *     collaborationOps.connect({ docId: 'my-document' })
 *     return () => { collaborationOps.disconnect() }
 *   }, [])
 *
 *   if (!clientToken) return <div>Connecting...</div>
 *
 *   return (
 *     <CollaborativeTiptapEditor
 *       clientToken={clientToken}
 *       user={{ name: 'Alice', color: '#4ecdc4' }}
 *       placeholder="Start typing..."
 *       onAwarenessChange={(users) => console.log('Users:', users)}
 *     />
 *   )
 * }
 * ```
 */
export const CollaborativeTiptapEditor = forwardRef<
  CollaborativeTiptapEditorHandle,
  CollaborativeTiptapEditorProps
>(function CollaborativeTiptapEditor(props, ref) {
  const { clientToken, ...innerProps } = props;

  return (
    <YDocProvider clientToken={clientToken}>
      <InnerEditor {...innerProps} editorRef={ref} />
    </YDocProvider>
  );
});

export default CollaborativeTiptapEditor;
