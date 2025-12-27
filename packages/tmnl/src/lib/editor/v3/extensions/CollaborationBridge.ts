/**
 * CollaborationBridge Extension
 *
 * Tiptap extension that bridges y-sweet collaboration with Effect atoms.
 * Integrates @tiptap/extension-collaboration and collaboration-cursor.
 *
 * @module editor/v3/extensions/CollaborationBridge
 */

import { Extension } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import { generateUserColor, type CollaborationUser } from '../services';

// Re-export for convenience
export { generateUserColor, type CollaborationUser };

// How can we actually turn this into a Context.GenericTag?
export interface CollaborationBridgeOptions {
  /**
   * Yjs document for collaboration.
   * Provided by useYDoc() from @y-sweet/react inside YDocProvider.
   */
  document: Y.Doc;

  /**
   * Awareness instance for cursor presence.
   * Provided by the y-sweet provider.
   */
  awareness: Awareness;

  /**
   * Optional provider instance (recommended).
   *
   * Some collaboration cursor implementations expect the full provider shape
   * (e.g. `provider.awareness`, and sometimes `provider.doc`).
   *
   * If omitted, we fall back to a minimal provider-like object constructed from
   * `document` + `awareness`.
   */
  provider?: unknown;

  /**
   * Current user info for cursor display.
   */
  user: CollaborationUser;

  /**
   * Field name in Yjs document for editor content.
   * @default 'default'
   */
  field?: string;

  /**
   * Callback when awareness changes (other users move cursors).
   */
  // TODO: Needs to be effectual
  onAwarenessChange?: (states: Map<number, unknown>) => void;
}

// TODO: Is there a way to make this Effect + React native? I don't like much the whole "document.createElement" thing.
// =============================================================================
// Cursor Rendering
// =============================================================================

/**
 * Render a collaboration cursor with user name label.
 * Called by CollaborationCursor extension.
 */
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

/**
 * Render selection highlight for other users.
 */
function renderSelection(user: CollaborationUser): HTMLElement {
  const selection = document.createElement('span');
  selection.classList.add('tmnl-collab-selection');
  selection.style.backgroundColor = `${user.color}40`; // 25% opacity

  return selection;
}

// =============================================================================
// Extension
// =============================================================================

/**
 * CollaborationBridge Extension
 *
 * Combines Collaboration and CollaborationCursor extensions with
 * TMNL-specific configuration and styling.
 *
 * @example
 * ```tsx
 * import { CollaborationBridge } from '@/lib/editor/v3/extensions'
 * import { useYDoc, useAwareness } from '@y-sweet/react'
 *
 * // Inside YDocProvider context
 * const doc = useYDoc()
 * const awareness = useAwareness()
 *
 * const editor = useEditor({
 *   extensions: [
 *     StarterKit.configure({ history: false }), // Disable history, Yjs handles it
 *     CollaborationBridge.configure({
 *       document: doc,
 *       awareness,
 *       user: { name: 'Alice', color: '#4ecdc4' },
 *     }),
 *   ],
 * })
 * ```
 */
export const CollaborationBridge = Extension.create<CollaborationBridgeOptions>(
  {
    name: 'collaborationBridge',

    addOptions() {
      return {
        document: undefined as unknown as Y.Doc,
        awareness: undefined as unknown as Awareness,
        provider: undefined,
        user: { name: 'Anonymous', color: '#888888' },
        field: 'default',
        onAwarenessChange: undefined,
      };
    },

    addExtensions() {
      const extensions: Extension[] = [];

      console.log('[CollaborationBridge] addExtensions called', {
        hasDocument: !!this.options.document,
        hasAwareness: !!this.options.awareness,
        hasProvider: !!this.options.provider,
        providerType: this.options.provider?.constructor?.name,
        user: this.options.user,
        field: this.options.field,
      });

      // Add Collaboration extension
      if (this.options.document) {
        console.log('[CollaborationBridge] Adding Collaboration extension');
        extensions.push(
          Collaboration.configure({
            document: this.options.document,
            field: this.options.field,
          })
        );
      } else {
        console.warn(
          '[CollaborationBridge] No document provided, skipping Collaboration extension'
        );
      }

      // Add CollaborationCursor extension
      // IMPORTANT: CollaborationCursor requires a REAL provider instance (e.g., from useYjsProvider())
      // A plain object { awareness, doc } does NOT work — the extension expects the provider to
      // internally manage the Y.Doc reference via its awareness protocol.
      if (this.options.provider && this.options.awareness) {
        console.log(
          '[CollaborationBridge] Adding CollaborationCursor extension',
          {
            providerHasAwareness: !!(this.options.provider as any)?.awareness,
            providerHasDoc: !!(this.options.provider as any)?.doc,
          }
        );
        extensions.push(
          CollaborationCursor.configure({
            provider: this.options.provider,
            user: this.options.user,
            render: renderCursor as any, // Type mismatch between y-prosemirror versions
            selectionRender: renderSelection as any,
          })
        );

        // Set up awareness change listener
        if (this.options.onAwarenessChange) {
          this.options.awareness.on('change', () => {
            this.options.onAwarenessChange?.(
              this.options.awareness.getStates()
            );
          });
        }
      } else {
        console.warn(
          '[CollaborationBridge] Missing provider or awareness, skipping CollaborationCursor',
          {
            hasProvider: !!this.options.provider,
            hasAwareness: !!this.options.awareness,
          }
        );
      }

      console.log(
        '[CollaborationBridge] Returning extensions:',
        extensions.map((e) => e.name)
      );
      return extensions;
    },
  }
);

// =============================================================================
// Styles (CSS-in-JS for portability)
// =============================================================================

/**
 * Collaboration cursor styles.
 * Inject these into your app or use the CollaborativeTiptapEditor component.
 */
export const collaborationStyles = `
  /* Cursor caret */
  .tmnl-collab-cursor {
    position: relative;
    border-left: 2px solid var(--cursor-color, #888);
    margin-left: -1px;
    margin-right: -1px;
    pointer-events: none;
    word-break: normal;
  }

  /* User name label */
  .tmnl-collab-cursor-label {
    position: absolute;
    top: -1.4em;
    left: -1px;
    font-size: 12px;
    font-weight: 500;
    font-family: var(--tmnl-font-sans, system-ui, sans-serif);
    color: #fff;
    padding: 2px 6px;
    border-radius: 4px 4px 4px 0;
    white-space: nowrap;
    user-select: none;
    pointer-events: none;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  /* Show label on hover or when cursor moves */
  .tmnl-collab-cursor:hover .tmnl-collab-cursor-label,
  .tmnl-collab-cursor.is-active .tmnl-collab-cursor-label {
    opacity: 1;
    transform: translateY(0);
  }

  /* Always show labels briefly when cursor moves */
  .tmnl-collab-cursor-label.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* Selection highlight */
  .tmnl-collab-selection {
    display: inline;
    pointer-events: none;
  }

  /* Keyframes for cursor blink */
  @keyframes tmnl-cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .tmnl-collab-cursor::after {
    content: '';
    position: absolute;
    top: 0;
    left: -1px;
    width: 2px;
    height: 100%;
    background: var(--cursor-color, #888);
    animation: tmnl-cursor-blink 1s ease-in-out infinite;
  }
`;

export default CollaborationBridge;
