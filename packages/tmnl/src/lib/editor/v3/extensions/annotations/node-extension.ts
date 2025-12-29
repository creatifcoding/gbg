/**
 * AnnotationNode TipTap Extension
 *
 * Hidden ProseMirror node that stores rich content for annotations.
 * Not visually rendered - content is retrieved for popovers/panels.
 *
 * Storage pattern:
 * - Node lives in document but doesn't render
 * - IntentMark references node via annotationId
 * - Content retrieved via AnnotationService for display
 *
 * @module editor/v3/extensions/annotations/node-extension
 */

import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  type AnnotationId,
  type DocumentId,
  generateAnnotationId,
  AnnotationNode as AnnotationNodeSchema,
  AnnotationNodeFactory,
  encodeNodeAttrs,
  decodeNodeAttrs,
} from './schemas';

// =============================================================================
// Types
// =============================================================================

export interface AnnotationNodeOptions {
  /**
   * HTML attributes to add to all annotation nodes
   * @default {}
   */
  HTMLAttributes: Record<string, unknown>;

  /**
   * Document ID for new nodes (required for proper tracking)
   */
  documentId?: DocumentId;

  /**
   * Callback when node is created
   */
  onCreate?: (node: AnnotationNodeSchema) => void;

  /**
   * Callback when node content is updated
   */
  onUpdate?: (node: AnnotationNodeSchema) => void;

  /**
   * Callback when node is deleted
   */
  onDelete?: (id: AnnotationId) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    annotationNode: {
      /**
       * Insert a new annotation node with content
       */
      insertAnnotationNode: (options: {
        content: unknown;
        title?: string;
      }) => ReturnType;

      /**
       * Update annotation node content by ID
       */
      updateAnnotationNode: (
        id: AnnotationId,
        updates: {
          content?: unknown;
          title?: string;
        }
      ) => ReturnType;

      /**
       * Delete annotation node by ID
       */
      deleteAnnotationNode: (id: AnnotationId) => ReturnType;

      /**
       * Get annotation node by ID (returns null if not found)
       */
      getAnnotationNode: (id: AnnotationId) => ReturnType;
    };
  }
}

// =============================================================================
// Extension Definition
// =============================================================================

/**
 * AnnotationNode Extension
 *
 * Creates hidden nodes for storing annotation content.
 * These nodes are not rendered but can be queried for popover display.
 */
export const AnnotationNodeExtension = Node.create<AnnotationNodeOptions>({
  name: 'annotationNode',

  // Not rendered in content flow
  group: 'block',

  // Can contain inline content (for rich text notes)
  content: 'inline*',

  // Marks allowed in content
  marks: '_',

  // Selectable for editing
  selectable: false,

  // Cannot be dragged
  draggable: false,

  // Atom: content is opaque to editor
  atom: true,

  // Priority
  priority: 100,

  addOptions() {
    return {
      HTMLAttributes: {},
      documentId: undefined,
      onCreate: undefined,
      onUpdate: undefined,
      onDelete: undefined,
    };
  },

  addAttributes() {
    return {
      // Unique identifier
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-annotation-node-id'),
        renderHTML: (attributes) => {
          if (!attributes.id) return {};
          return { 'data-annotation-node-id': attributes.id };
        },
      },

      // Optional title
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-title'),
        renderHTML: (attributes) => {
          if (!attributes.title) return {};
          return { 'data-title': attributes.title };
        },
      },

      // Document ID
      documentId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-document-id'),
        renderHTML: (attributes) => {
          if (!attributes.documentId) return {};
          return { 'data-document-id': attributes.documentId };
        },
      },

      // Creation timestamp
      createdAt: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-created-at'),
        renderHTML: (attributes) => {
          if (!attributes.createdAt) return {};
          return { 'data-created-at': attributes.createdAt };
        },
      },

      // Update timestamp
      updatedAt: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-updated-at'),
        renderHTML: (attributes) => {
          if (!attributes.updatedAt) return {};
          return { 'data-updated-at': attributes.updatedAt };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-annotation-node-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // Hidden node - renders as empty div with data attributes
    // Actual content is retrieved via service for popover display
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'annotation-node',
        style: 'display: none;', // Hidden from visual display
        'aria-hidden': 'true',
      }),
      0, // Content placeholder
    ];
  },

  addCommands() {
    return {
      insertAnnotationNode:
        (options) =>
        ({ commands, state }) => {
          const id = generateAnnotationId();
          const documentId =
            this.options.documentId || ('doc-default' as DocumentId);
          const now = new Date().toISOString();

          // Create the annotation node schema object
          const annotationNode = AnnotationNodeFactory.withContent(
            documentId,
            options.content,
            options.title
          );

          // Notify callback
          if (this.options.onCreate) {
            this.options.onCreate(annotationNode);
          }

          // Insert as hidden block at end of document
          return commands.insertContentAt(state.doc.content.size, {
            type: this.name,
            attrs: {
              id: annotationNode.id,
              title: options.title || null,
              documentId,
              createdAt: now,
              updatedAt: now,
            },
            content: [
              {
                type: 'text',
                text:
                  typeof options.content === 'string'
                    ? options.content
                    : JSON.stringify(options.content),
              },
            ],
          });
        },

      updateAnnotationNode:
        (id, updates) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false;

          let updated = false;

          // Find node with matching ID
          state.doc.descendants((node, pos) => {
            if (
              node.type.name === this.name &&
              node.attrs.id === id
            ) {
              const newAttrs = {
                ...node.attrs,
                updatedAt: new Date().toISOString(),
              };

              if (updates.title !== undefined) {
                newAttrs.title = updates.title;
              }

              tr.setNodeMarkup(pos, undefined, newAttrs);
              updated = true;

              // Notify callback
              if (this.options.onUpdate) {
                // Reconstruct schema object from node
                const schemaNode = decodeNodeAttrs({
                  id: node.attrs.id,
                  title: newAttrs.title,
                  content: JSON.stringify(updates.content ?? node.textContent),
                  documentId: node.attrs.documentId,
                  createdAt: node.attrs.createdAt,
                  updatedAt: newAttrs.updatedAt,
                });
                this.options.onUpdate(schemaNode);
              }

              return false; // Stop traversal
            }
          });

          return updated;
        },

      deleteAnnotationNode:
        (id) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false;

          let deleted = false;

          // Find and delete node with matching ID
          state.doc.descendants((node, pos) => {
            if (
              node.type.name === this.name &&
              node.attrs.id === id
            ) {
              tr.delete(pos, pos + node.nodeSize);
              deleted = true;

              // Notify callback
              if (this.options.onDelete) {
                this.options.onDelete(id);
              }

              return false; // Stop traversal
            }
          });

          return deleted;
        },

      getAnnotationNode:
        (id) =>
        ({ state }) => {
          let found: ProseMirrorNode | null = null;

          state.doc.descendants((node) => {
            if (
              node.type.name === this.name &&
              node.attrs.id === id
            ) {
              found = node;
              return false;
            }
          });

          return found as unknown as ReturnType;
        },
    };
  },

  // Add CSS for hidden nodes
  addGlobalAttributes() {
    return [];
  },
});

export default AnnotationNodeExtension;
