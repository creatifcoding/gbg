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
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import History from '@tiptap/extension-history';
import Dropcursor from '@tiptap/extension-dropcursor';
import Gapcursor from '@tiptap/extension-gapcursor';
import Placeholder from '@tiptap/extension-placeholder';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Strike from '@tiptap/extension-strike';
import Code from '@tiptap/extension-code';
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
import type { Doc as YDoc, XmlFragment as YXmlFragment } from 'yjs';
import { Registry } from '@effect-atom/atom';

// Custom block extensions
import {
  EffectBridge,
  collaborationStyles,
  CodeBlockHighlight,
  codeBlockHighlightStyles,
  SlashCommand,
  allBlockExtensions,
} from '../extensions';
import { createSlashMenuRender } from './SlashMenu';
import { generateUserColor, type CollaborationUser } from '../services';
import {
  collaborationRegistry,
  connectedUsersAtom,
} from '../atoms/collaboration';
import { editorContentStyles, collaborativeEditorStyles } from './styles';

// =============================================================================
// Y.Doc Content Seeding Info
// =============================================================================

export interface YDocReadyInfo {
  /** The Y.Doc instance */
  doc: YDoc;
  /** The XmlFragment used for ProseMirror content (field: 'prosemirror') */
  fragment: YXmlFragment;
  /** Whether the fragment is empty (no content yet) */
  isEmpty: boolean;
}

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
   * Callback when Y.Doc is ready for content seeding.
   * Use this to seed initial content into an empty Y.Doc.
   *
   * IMPORTANT: Only seed content when `info.isEmpty` is true.
   * Seeding into a non-empty doc will cause content duplication.
   *
   * @example
   * ```tsx
   * onYDocReady={(info) => {
   *   if (info.isEmpty && pendingContent) {
   *     // Seed content directly into the fragment
   *     const schema = editor.schema;
   *     prosemirrorJSONToYXmlFragment(schema, pendingContent, info.fragment);
   *   }
   * }}
   * ```
   */
  onYDocReady?: (info: YDocReadyInfo) => void;

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

  /**
   * Atom registry to use for syncing editor state atoms.
   * REQUIRED for TableOfContents and other consumers to read editor state.
   */
  registry?: Registry.Registry;
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
  extends Omit<CollaborativeTiptapEditorProps, 'clientToken' | 'authEndpoint'> {
  editorRef: React.Ref<CollaborativeTiptapEditorHandle>;
  onProviderReady?: () => void;
  registry?: Registry.Registry;
}

const InnerEditor: React.FC<InnerEditorProps> = ({
  user,
  placeholder,
  editable = true,
  autoFocus = false,
  onReady,
  onYDocReady,
  onAwarenessChange,
  onChange,
  className,
  style,
  editorRef,
  onProviderReady,
  registry,
}) => {
  const doc = useYDoc();
  const awareness = useAwareness();
  const provider = useYjsProvider();
  const editorInstanceRef = useRef<Editor | null>(null);
  const yDocReadyFiredRef = useRef(false);

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

  // Build extensions array - Custom blocks + Collaboration
  // CRITICAL: CollaborationCursor is added imperatively AFTER mount to avoid ySyncPlugin timing issue
  const extensions = useMemo((): AnyExtension[] => {
    return [
      // Custom block extensions (replaces StarterKit)
      ...allBlockExtensions,

      // Code block with syntax highlighting
      CodeBlockHighlight,

      // Inline marks
      Bold,
      Italic,
      Strike,
      Code,

      // UI helpers
      Dropcursor.configure({
        color: 'rgba(45, 212, 191, 0.4)',
        width: 2,
      }),
      Gapcursor,
      Placeholder.configure({
        placeholder: placeholder || 'Type / for commands...',
      }),

      // Slash command menu
      SlashCommand.configure({
        suggestion: {
          char: '/',
          startOfLine: false,
          items: ({ query }) => {
            const { SLASH_ITEMS } = require('../extensions/SlashCommand');
            const q = query.toLowerCase();
            return SLASH_ITEMS.filter(
              (item: { title: string; description: string; aliases: readonly string[] }) =>
                item.title.toLowerCase().includes(q) ||
                item.description.toLowerCase().includes(q) ||
                item.aliases.some((alias) => alias.includes(q))
            ).slice(0, 10);
          },
          render: createSlashMenuRender,
        },
      }),

      // Effect-Atom bridge
      EffectBridge.configure({
        registry,
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

      // Collaboration extension - cursor added imperatively after mount
      Collaboration.configure({
        document: doc,
        field: 'prosemirror',
      }),

      // Note: History is disabled in collab mode - Yjs handles undo/redo
    ];
  }, [doc, onChange, registry, placeholder]);

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

  // Fire onYDocReady callback once when BOTH doc AND editor are available
  useEffect(() => {
    if (!doc || !editor || yDocReadyFiredRef.current) return;

    const fragment = doc.getXmlFragment('prosemirror');
    const isEmpty = fragment.length === 0;

    console.log(
      `[CollaborativeTiptapEditor] Y.Doc ready, fragment length: ${fragment.length}, isEmpty: ${isEmpty}`
    );

    yDocReadyFiredRef.current = true;
    onYDocReady?.({ doc, fragment, isEmpty });
  }, [doc, editor, onYDocReady]);

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
        background: 'var(--tmnl-editor-bg, #0a0a0a)',
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
          // NOTE: Zoom is handled via transform: scale() on parent container
          // (see useEditorViewport), not via CSS variable font-size manipulation.
        }}
      />
      <style>{`
        ${editorContentStyles}
        ${collaborativeEditorStyles}
        ${collaborationStyles}
        ${codeBlockHighlightStyles}
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
            background: 'var(--tmnl-editor-bg, #0a0a0a)',
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
