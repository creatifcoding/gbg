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
  useState,
  useRef,
} from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import type { AnyExtension } from '@tiptap/core';
import {
  YDocProvider,
  useAwareness,
  useYDoc,
  useYjsProvider,
} from '@y-sweet/react';
import type { Editor, JSONContent } from '@tiptap/core';
import type { ClientToken } from '@y-sweet/sdk';
import type { AuthEndpoint } from '@y-sweet/react';
import { EffectBridge, collaborationStyles } from '../extensions';
import { generateUserColor, type CollaborationUser } from '../services';
import {
  collaborationRegistry,
  connectedUsersAtom,
} from '../atoms/collaboration';
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
   * Optional auth endpoint for y-sweet provider token refresh.
   *
   * If omitted, we default to returning the provided `clientToken` (no refresh).
   * If your tokens expire, pass an async function that returns a fresh token for
   * `clientToken.docId`.
   */
  authEndpoint?: AuthEndpoint;

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
// Cursor Rendering
// =============================================================================

function renderCursor(user: CollaborationUser): HTMLElement {
  const cursor = document.createElement('span');
  cursor.classList.add('tmnl-collab-cursor');
  cursor.style.setProperty('--cursor-color', user.color);

  const label = document.createElement('span');
  label.classList.add('tmnl-collab-cursor-label');
  label.textContent = user.name;
  label.style.backgroundColor = user.color;

  cursor.appendChild(label);

  return cursor;
}

function renderSelection(user: CollaborationUser): HTMLElement {
  const selection = document.createElement('span');
  selection.classList.add('tmnl-collab-selection');
  selection.style.backgroundColor = `${user.color}40`;

  return selection;
}

// =============================================================================
// Inner Editor (uses y-sweet hooks)
// =============================================================================

interface InnerEditorProps
  extends Omit<CollaborativeTiptapEditorProps, 'clientToken'> {
  editorRef: React.Ref<CollaborativeTiptapEditorHandle>;
  onProviderReady?: () => void;
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
  onProviderReady,
}) => {
  const doc = useYDoc();
  const awareness = useAwareness();
  const provider = useYjsProvider();
  const editorInstanceRef = useRef<Editor | null>(null);

  useEffect(() => {
    onProviderReady?.();
  }, [onProviderReady]);

  // Memoize user with color
  const userWithColor = useMemo<CollaborationUser>(
    () => ({
      name: user.name,
      color: user.color || generateUserColor(user.name),
    }),
    [user.name, user.color]
  );

  // Build extensions array - Collaboration ONLY (no cursor yet)
  // CRITICAL: CollaborationCursor is added imperatively AFTER mount to avoid ySyncPlugin timing issue
  const extensions = useMemo((): AnyExtension[] => {
    return [
      StarterKit.configure({
        // Disable native history - Yjs handles undo/redo via collaboration extension
      }),
      EffectBridge.configure({
        onTransaction: (meta) => {
          if (meta.docChanged && onChange) {
            onChange(
              editorInstanceRef.current?.getJSON() ?? {
                type: 'doc',
                content: [],
              }
            );
          }
        },
      }),
      // Collaboration extension only - cursor added imperatively after mount
      Collaboration.configure({
        document: doc,
        field: 'prosemirror',
      }),
    ];
  }, [doc, onChange]);

  // Initialize editor
  const editor = useEditor(
    {
      extensions,
      editable,
      autofocus: autoFocus,
      editorProps: {
        attributes: {
          class: 'tmnl-editor-content tmnl-collab-editor',
          'data-placeholder': placeholder ?? '',
        },
      },
      onCreate: ({ editor: createdEditor }) => {
        editorInstanceRef.current = createdEditor;
        onReady?.(createdEditor);
      },
    },
    // Only recreate when doc changes - cursor added imperatively
    [doc]
  );

  // Add CollaborationCursor IMPERATIVELY after editor is mounted
  // This avoids the reconfigure timing bug where yCursorPlugin.init runs before ySyncPlugin state exists
  useEffect(() => {
    if (!editor || !provider) return;

    // Small delay to ensure ySyncPlugin is fully initialized
    const timer = setTimeout(() => {
      try {
        // Dynamically register the cursor extension
        const cursorExtension = CollaborationCursor.configure({
          provider,
          user: userWithColor,
          render: renderCursor as any,
          selectionRender: renderSelection as any,
        });

        // Get the ProseMirror plugins from the extension using internal API
        const extensionWithPlugins = cursorExtension as any;
        const plugins =
          extensionWithPlugins.addProseMirrorPlugins?.call({
            name: cursorExtension.name,
            options: extensionWithPlugins.options,
            storage: {},
            editor,
            type: null,
            parent: null,
          }) ?? [];

        // Register each plugin with the editor
        plugins.forEach((plugin: any) => {
          editor.registerPlugin(plugin);
        });

        console.log(
          '[CollaborativeTiptapEditor] Cursor extension added imperatively'
        );
      } catch (e) {
        console.error(
          '[CollaborativeTiptapEditor] Failed to add cursor extension:',
          e
        );
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [editor, provider, userWithColor]);

  // Update editor instance ref
  useEffect(() => {
    editorInstanceRef.current = editor;
  }, [editor]);

  // Update awareness with user info
  useEffect(() => {
    if (awareness) {
      awareness.setLocalStateField('user', userWithColor);
    }
  }, [awareness, userWithColor]);

  // Set up awareness change listener - always update atom, optionally call callback
  useEffect(() => {
    if (!awareness) return;

    const handleUpdate = () => {
      const users: CollaborationUser[] = [];
      awareness.getStates().forEach((state: unknown) => {
        const s = state as { user?: CollaborationUser };
        if (s.user) {
          users.push(s.user);
        }
      });

      // Update the atom via registry (direct mutation, no Effect needed)
      collaborationRegistry.set(connectedUsersAtom, users);

      // Also call the callback if provided
      onAwarenessChange?.(users);
    };

    // Initial call to populate users
    handleUpdate();

    awareness.on('update', handleUpdate);
    return () => awareness.off('update', handleUpdate);
  }, [awareness, onAwarenessChange]);

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
  const { clientToken, authEndpoint, ...innerProps } = props;
  const [providerReady, setProviderReady] = useState(false);

  const effectiveAuthEndpoint = useMemo<AuthEndpoint>(() => {
    return authEndpoint ?? (async () => clientToken);
  }, [authEndpoint, clientToken]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* @y-sweet/react YDocProvider requires docId + authEndpoint */}
      <YDocProvider
        docId={clientToken.docId}
        authEndpoint={effectiveAuthEndpoint}
        initialClientToken={clientToken}
      >
        <InnerEditor
          {...innerProps}
          editorRef={ref}
          onProviderReady={() => setProviderReady(true)}
        />
      </YDocProvider>

      {!providerReady && (
        <div
          className={innerProps.className}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            minHeight: '200px',
            background: 'var(--tmnl-surface-1, #1e1e1e)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--tmnl-text-muted, #666)',
            fontFamily: 'var(--tmnl-font-mono)',
            fontSize: 'var(--tmnl-text-sm, 14px)',
            ...(innerProps.style ?? {}),
          }}
          data-tmnl-editor="collaborative-tiptap"
          data-loading="true"
        >
          Initializing collaboration...
        </div>
      )}
    </div>
  );
});

export default CollaborativeTiptapEditor;
