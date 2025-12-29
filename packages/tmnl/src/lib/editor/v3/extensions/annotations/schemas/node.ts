/**
 * Annotation System - AnnotationNode Schema
 *
 * Hidden ProseMirror node that stores rich annotation content.
 * Referenced by IntentMarks via annotationId.
 *
 * @module editor/v3/extensions/annotations/schemas/node
 */

import { Option, Schema } from 'effect';
import { AnnotationId, DocumentId, generateAnnotationId } from './primitives';

// =============================================================================
// AnnotationNode Entity
// =============================================================================

/**
 * Annotation Node - Hidden content container
 *
 * A non-rendered ProseMirror node that holds the rich content
 * for popovers, notes, citations, etc. Lives in the document
 * but is not visually rendered.
 *
 * @example
 * ```typescript
 * const node = new AnnotationNode({
 *   id: generateAnnotationId(),
 *   title: Option.some('Important Note'),
 *   content: { type: 'doc', content: [...] }, // ProseMirror JSON
 *   documentId: 'doc-123' as DocumentId,
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 *   referencedBy: Option.none(),
 * });
 * ```
 */
export class AnnotationNode extends Schema.TaggedClass<AnnotationNode>()(
  'AnnotationNode',
  {
    /** Unique identifier (matches reference in IntentMark) */
    id: AnnotationId,

    /** Optional title for display in popovers */
    title: Schema.OptionFromNullOr(Schema.String),

    /** Rich content as ProseMirror JSON */
    content: Schema.Unknown,

    /** Owning document */
    documentId: DocumentId,

    /** Creation timestamp */
    createdAt: Schema.DateFromSelf,

    /** Last update timestamp */
    updatedAt: Schema.DateFromSelf,

    /**
     * Backlinks - marks that reference this node
     * Computed at query time, not stored
     */
    referencedBy: Schema.OptionFromNullOr(Schema.Array(AnnotationId)),
  }
) {
  // ===========================================================================
  // Convenience Getters
  // ===========================================================================

  /** Check if node has a title */
  get hasTitle(): boolean {
    return Option.isSome(this.title);
  }

  /** Get display title or fallback */
  get displayTitle(): string {
    return Option.getOrElse(this.title, () => 'Untitled');
  }

  /** Check if node has backlinks */
  get hasBacklinks(): boolean {
    return (
      Option.isSome(this.referencedBy) &&
      Option.getOrElse(this.referencedBy, () => []).length > 0
    );
  }

  /** Get backlink count */
  get backlinkCount(): number {
    return Option.getOrElse(this.referencedBy, () => []).length;
  }

  // ===========================================================================
  // Immutable Updates
  // ===========================================================================

  /** Update title */
  withTitle(title: string | null): AnnotationNode {
    return new AnnotationNode({
      ...this,
      title: title ? Option.some(title) : Option.none(),
      updatedAt: new Date(),
    });
  }

  /** Update content */
  withContent(content: unknown): AnnotationNode {
    return new AnnotationNode({
      ...this,
      content,
      updatedAt: new Date(),
    });
  }

  /** Add backlink reference */
  withBacklink(annotationId: AnnotationId): AnnotationNode {
    const existing = Option.getOrElse(
      this.referencedBy,
      () => [] as AnnotationId[]
    );
    if (existing.includes(annotationId)) return this;
    return new AnnotationNode({
      ...this,
      referencedBy: Option.some([...existing, annotationId]),
    });
  }

  /** Remove backlink reference */
  withoutBacklink(annotationId: AnnotationId): AnnotationNode {
    const existing = Option.getOrElse(
      this.referencedBy,
      () => [] as AnnotationId[]
    );
    const filtered = existing.filter((id) => id !== annotationId);
    return new AnnotationNode({
      ...this,
      referencedBy:
        filtered.length > 0 ? Option.some(filtered) : Option.none(),
    });
  }
}

// =============================================================================
// Node Factory
// =============================================================================

/**
 * Factory functions for creating AnnotationNodes
 */
export const AnnotationNodeFactory = {
  /**
   * Create an empty annotation node
   */
  empty: (documentId: DocumentId): AnnotationNode =>
    new AnnotationNode({
      id: generateAnnotationId(),
      title: Option.none(),
      content: { type: 'doc', content: [] },
      documentId,
      createdAt: new Date(),
      updatedAt: new Date(),
      referencedBy: Option.none(),
    }),

  /**
   * Create with initial text content
   */
  withText: (documentId: DocumentId, text: string, title?: string): AnnotationNode =>
    new AnnotationNode({
      id: generateAnnotationId(),
      title: title ? Option.some(title) : Option.none(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text }],
          },
        ],
      },
      documentId,
      createdAt: new Date(),
      updatedAt: new Date(),
      referencedBy: Option.none(),
    }),

  /**
   * Create with ProseMirror JSON content
   */
  withContent: (
    documentId: DocumentId,
    content: unknown,
    title?: string
  ): AnnotationNode =>
    new AnnotationNode({
      id: generateAnnotationId(),
      title: title ? Option.some(title) : Option.none(),
      content,
      documentId,
      createdAt: new Date(),
      updatedAt: new Date(),
      referencedBy: Option.none(),
    }),

  /**
   * Create with specific ID (for restoration)
   */
  withId: (
    id: AnnotationId,
    documentId: DocumentId,
    content: unknown,
    title?: string
  ): AnnotationNode =>
    new AnnotationNode({
      id,
      title: title ? Option.some(title) : Option.none(),
      content,
      documentId,
      createdAt: new Date(),
      updatedAt: new Date(),
      referencedBy: Option.none(),
    }),
} as const;

// =============================================================================
// Serialization (for ProseMirror node attributes)
// =============================================================================

/**
 * Serialized node attributes for ProseMirror storage
 */
export const AnnotationNodeAttrs = Schema.Struct({
  id: Schema.String,
  title: Schema.NullOr(Schema.String),
  content: Schema.String, // JSON
  documentId: Schema.String,
  createdAt: Schema.String, // ISO string
  updatedAt: Schema.String, // ISO string
});
export type AnnotationNodeAttrs = typeof AnnotationNodeAttrs.Type;

/**
 * Encode AnnotationNode to ProseMirror attributes
 */
export const encodeNodeAttrs = (node: AnnotationNode): AnnotationNodeAttrs => ({
  id: node.id,
  title: Option.getOrNull(node.title),
  content: JSON.stringify(node.content),
  documentId: node.documentId,
  createdAt: node.createdAt.toISOString(),
  updatedAt: node.updatedAt.toISOString(),
});

/**
 * Decode ProseMirror attributes to AnnotationNode
 */
export const decodeNodeAttrs = (attrs: AnnotationNodeAttrs): AnnotationNode =>
  new AnnotationNode({
    id: attrs.id as AnnotationId,
    title: attrs.title ? Option.some(attrs.title) : Option.none(),
    content: JSON.parse(attrs.content),
    documentId: attrs.documentId as DocumentId,
    createdAt: new Date(attrs.createdAt),
    updatedAt: new Date(attrs.updatedAt),
    referencedBy: Option.none(), // Computed at query time
  });

// =============================================================================
// SQLite Row Schema (for external persistence)
// =============================================================================

/**
 * SQLite row shape for annotation_nodes table
 */
export const AnnotationNodeRow = Schema.Struct({
  id: Schema.String,
  title: Schema.NullOr(Schema.String),
  content: Schema.String, // JSON
  document_id: Schema.String,
  created_at: Schema.String, // ISO string
  updated_at: Schema.String, // ISO string
});
export type AnnotationNodeRow = typeof AnnotationNodeRow.Type;

/**
 * Convert row to AnnotationNode
 */
export const annotationNodeFromRow = (row: AnnotationNodeRow): AnnotationNode =>
  new AnnotationNode({
    id: row.id as AnnotationId,
    title: row.title ? Option.some(row.title) : Option.none(),
    content: JSON.parse(row.content),
    documentId: row.document_id as DocumentId,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    referencedBy: Option.none(),
  });

/**
 * Convert AnnotationNode to row
 */
export const annotationNodeToRow = (node: AnnotationNode): AnnotationNodeRow => ({
  id: node.id,
  title: Option.getOrNull(node.title),
  content: JSON.stringify(node.content),
  document_id: node.documentId,
  created_at: node.createdAt.toISOString(),
  updated_at: node.updatedAt.toISOString(),
});
