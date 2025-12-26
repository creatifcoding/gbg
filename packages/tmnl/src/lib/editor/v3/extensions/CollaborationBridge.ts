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

// =============================================================================
// Types
// =============================================================================

export interface CollaborationUser {
  name: string;
  color: string;
}

export interface CollaborationBridgeOptions {
  /**
   * Yjs document for collaboration.
   * Get this from yDocAtom or CollaborationService.
   */
  document: Y.Doc;

  /**
   * Awareness instance for cursor presence.
   * Provided by the y-sweet provider.
   */
  awareness: Awareness;

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
  onAwarenessChange?: (states: Map<number, unknown>) => void;
}

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
 * import { useAtomValue } from '@effect-atom/atom-react'
 * import { yDocAtom, awarenessAtom } from '@/lib/editor/v3'
 *
 * // In component where provider gives awareness
 * const doc = useAtomValue(yDocAtom)
 * const awareness = useYSweetAwareness() // from @y-sweet/react
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
export const CollaborationBridge = Extension.create<CollaborationBridgeOptions>({
  name: 'collaborationBridge',

  addOptions() {
    return {
      document: null as unknown as Y.Doc,
      awareness: null as unknown as Awareness,
      user: { name: 'Anonymous', color: '#888888' },
      field: 'default',
      onAwarenessChange: undefined,
    };
  },

  addExtensions() {
    const extensions: Extension[] = [];

    // Add Collaboration extension
    if (this.options.document) {
      extensions.push(
        Collaboration.configure({
          document: this.options.document,
          field: this.options.field,
        })
      );
    }

    // Add CollaborationCursor extension
    if (this.options.awareness) {
      extensions.push(
        CollaborationCursor.configure({
          provider: {
            awareness: this.options.awareness,
          } as unknown as { awareness: Awareness },
          user: this.options.user,
          render: renderCursor,
          selectionRender: renderSelection,
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
    }

    return extensions;
  },
});

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

// =============================================================================
// Utility: Generate user color
// =============================================================================

/**
 * Generate a consistent color for a user based on their name.
 * Uses a simple hash to ensure same name = same color.
 */
export function generateUserColor(name: string): string {
  // TMNL accent palette
  const colors = [
    '#4ecdc4', // cyan
    '#ff6b6b', // coral
    '#95e1d3', // mint
    '#f38181', // salmon
    '#aa96da', // lavender
    '#fcbad3', // pink
    '#a8d8ea', // sky
    '#ffcc5c', // gold
  ];

  // Simple string hash
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  return colors[Math.abs(hash) % colors.length];
}

export default CollaborationBridge;
