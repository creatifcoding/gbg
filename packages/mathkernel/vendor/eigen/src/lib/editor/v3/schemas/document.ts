/**
 * Document Metadata Schema
 *
 * Effect Schema definitions for document persistence layer.
 * Used by DocumentRegistryService and NATS KV storage.
 *
 * @module editor/v3/schemas/document
 */

import { Schema } from 'effect';

// =============================================================================
// Branded Types
// =============================================================================

/**
 * Branded document ID for type safety.
 * Format: "doc-{nanoid}" or "doc-{timestamp}-{nanoid}"
 */
export const DocumentId = Schema.String.pipe(
  Schema.brand('DocumentId'),
  Schema.filter((s) => s.startsWith('doc-'), {
    message: () => 'DocumentId must start with "doc-"',
  })
);
export type DocumentId = typeof DocumentId.Type;

/**
 * Branded identity ID for document ownership.
 */
export const IdentityId = Schema.String.pipe(Schema.brand('IdentityId'));
export type IdentityId = typeof IdentityId.Type;

// =============================================================================
// Enums
// =============================================================================

/**
 * Document status in the registry.
 */
export const DocumentStatus = Schema.Literal(
  'draft',
  'published',
  'archived',
  'deleted'
);
export type DocumentStatus = typeof DocumentStatus.Type;

/**
 * Document visibility level.
 */
export const DocumentVisibility = Schema.Literal(
  'private',
  'team',
  'organization',
  'public'
);
export type DocumentVisibility = typeof DocumentVisibility.Type;

// =============================================================================
// Core Schemas
// =============================================================================

/**
 * Document metadata stored in NATS KV.
 * The actual content is stored in y-sweet (Yjs CRDT).
 */
export const DocumentMetadata = Schema.Struct({
  /** Unique document identifier */
  id: DocumentId,

  /** Human-readable title */
  title: Schema.String,

  /** Document status */
  status: DocumentStatus,

  /** Visibility level */
  visibility: DocumentVisibility,

  /** Creator identity */
  createdBy: IdentityId,

  /** Creation timestamp (ISO 8601) */
  createdAt: Schema.DateFromString,

  /** Last modifier identity */
  updatedBy: IdentityId,

  /** Last update timestamp (ISO 8601) */
  updatedAt: Schema.DateFromString,

  /** Y-sweet document ID for content sync */
  ysweetDocId: Schema.String,

  /** Optional tags for categorization */
  tags: Schema.optional(Schema.Array(Schema.String)),

  /** Optional custom metadata */
  metadata: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown })
  ),

  /** Version for optimistic concurrency */
  version: Schema.Number,
});
export type DocumentMetadata = typeof DocumentMetadata.Type;

/**
 * Payload for creating a new document.
 */
export const CreateDocumentPayload = Schema.Struct({
  title: Schema.String,
  visibility: Schema.optionalWith(DocumentVisibility, {
    default: () => 'private' as const,
  }),
  tags: Schema.optional(Schema.Array(Schema.String)),
  metadata: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown })
  ),
});
export type CreateDocumentPayload = typeof CreateDocumentPayload.Type;

/**
 * Payload for updating document metadata.
 */
export const UpdateDocumentPayload = Schema.Struct({
  title: Schema.optional(Schema.String),
  status: Schema.optional(DocumentStatus),
  visibility: Schema.optional(DocumentVisibility),
  tags: Schema.optional(Schema.Array(Schema.String)),
  metadata: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown })
  ),
});
export type UpdateDocumentPayload = typeof UpdateDocumentPayload.Type;

// =============================================================================
// Event Schemas (for NATS KV watch)
// =============================================================================

/**
 * Document created event.
 */
export const DocumentCreatedEvent = Schema.TaggedStruct('DocumentCreated', {
  documentId: DocumentId,
  title: Schema.String,
  createdBy: IdentityId,
  createdAt: Schema.DateFromString,
});
export type DocumentCreatedEvent = typeof DocumentCreatedEvent.Type;

/**
 * Document updated event.
 */
export const DocumentUpdatedEvent = Schema.TaggedStruct('DocumentUpdated', {
  documentId: DocumentId,
  changes: UpdateDocumentPayload,
  updatedBy: IdentityId,
  updatedAt: Schema.DateFromString,
  previousVersion: Schema.Number,
  newVersion: Schema.Number,
});
export type DocumentUpdatedEvent = typeof DocumentUpdatedEvent.Type;

/**
 * Document deleted event.
 */
export const DocumentDeletedEvent = Schema.TaggedStruct('DocumentDeleted', {
  documentId: DocumentId,
  deletedBy: IdentityId,
  deletedAt: Schema.DateFromString,
});
export type DocumentDeletedEvent = typeof DocumentDeletedEvent.Type;

/**
 * Union of all document events.
 */
export const DocumentEvent = Schema.Union(
  DocumentCreatedEvent,
  DocumentUpdatedEvent,
  DocumentDeletedEvent
);
export type DocumentEvent = typeof DocumentEvent.Type;

// =============================================================================
// List/Query Schemas
// =============================================================================

/**
 * Document list item (subset of metadata for listings).
 */
export const DocumentListItem = Schema.Struct({
  id: DocumentId,
  title: Schema.String,
  status: DocumentStatus,
  visibility: DocumentVisibility,
  createdBy: IdentityId,
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
  tags: Schema.optional(Schema.Array(Schema.String)),
});
export type DocumentListItem = typeof DocumentListItem.Type;

/**
 * Query parameters for listing documents.
 */
export const DocumentListQuery = Schema.Struct({
  status: Schema.optional(DocumentStatus),
  visibility: Schema.optional(DocumentVisibility),
  createdBy: Schema.optional(IdentityId),
  tags: Schema.optional(Schema.Array(Schema.String)),
  limit: Schema.optionalWith(Schema.Number, { default: () => 50 }),
  offset: Schema.optionalWith(Schema.Number, { default: () => 0 }),
});
export type DocumentListQuery = typeof DocumentListQuery.Type;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a new document ID with timestamp prefix.
 */
export const generateDocumentId = (): DocumentId => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `doc-${timestamp}-${random}` as DocumentId;
};

/**
 * Create initial metadata for a new document.
 *
 * @param payload - Creation payload with title, visibility, etc.
 * @param createdBy - Identity of the creator
 * @param documentId - Pre-generated document ID (used as both id AND ysweetDocId)
 */
export const createInitialMetadata = (
  payload: CreateDocumentPayload,
  createdBy: IdentityId,
  documentId: DocumentId
): DocumentMetadata => {
  const now = new Date();

  return {
    id: documentId,
    title: payload.title,
    status: 'draft',
    visibility: payload.visibility ?? 'private',
    createdBy,
    createdAt: now,
    updatedBy: createdBy,
    updatedAt: now,
    ysweetDocId: documentId, // Use same ID for y-sweet
    tags: payload.tags,
    metadata: payload.metadata,
    version: 1,
  };
};
