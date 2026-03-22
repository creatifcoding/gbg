/**
 * Editor V3 Schemas
 *
 * Effect Schema definitions for the editor subsystem.
 *
 * @module editor/v3/schemas
 */

export {
  // Branded Types
  DocumentId,
  IdentityId,
  // Enums
  DocumentStatus,
  DocumentVisibility,
  // Core Schemas
  DocumentMetadata,
  CreateDocumentPayload,
  UpdateDocumentPayload,
  // Event Schemas
  DocumentCreatedEvent,
  DocumentUpdatedEvent,
  DocumentDeletedEvent,
  DocumentEvent,
  // List/Query Schemas
  DocumentListItem,
  DocumentListQuery,
  // Helpers
  generateDocumentId,
  createInitialMetadata,
} from './document';

// Types
export type {
  DocumentId as DocumentIdType,
  IdentityId as IdentityIdType,
  DocumentStatus as DocumentStatusType,
  DocumentVisibility as DocumentVisibilityType,
  DocumentMetadata as DocumentMetadataType,
  CreateDocumentPayload as CreateDocumentPayloadType,
  UpdateDocumentPayload as UpdateDocumentPayloadType,
  DocumentCreatedEvent as DocumentCreatedEventType,
  DocumentUpdatedEvent as DocumentUpdatedEventType,
  DocumentDeletedEvent as DocumentDeletedEventType,
  DocumentEvent as DocumentEventType,
  DocumentListItem as DocumentListItemType,
  DocumentListQuery as DocumentListQueryType,
} from './document';
