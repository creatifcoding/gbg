/**
 * Canvas Schema Definitions
 *
 * Effect Schema definitions for YJS-backed collaborative canvas persistence.
 * Used by CanvasStateService and NATS KV storage (bucket: tmnl-canvases).
 *
 * Architecture:
 * - Canvas: Parent Y.Doc containing shapes, bindings, and subdoc references
 * - Subdoc: Nested Y.Doc for each EditorPanelShape's content
 * - Triple-layer persistence: SQLite (local), Y-Sweet (sync), NATS (durable)
 *
 * @module canvas/schemas/canvas
 */

import { Schema } from 'effect';

// =============================================================================
// Branded Types
// =============================================================================

/**
 * Branded canvas ID for type safety.
 * Format: "canvas-{timestamp}-{random}"
 */
export const CanvasId = Schema.String.pipe(
  Schema.brand('CanvasId'),
  Schema.filter((s) => s.startsWith('canvas-'), {
    message: () => 'CanvasId must start with "canvas-"',
  })
);
export type CanvasId = typeof CanvasId.Type;

/**
 * Branded subdoc ID for type safety.
 * Format: "subdoc-{timestamp}-{random}"
 * References nested Y.Doc instances within a canvas.
 */
export const SubdocId = Schema.String.pipe(
  Schema.brand('SubdocId'),
  Schema.filter((s) => s.startsWith('subdoc-'), {
    message: () => 'SubdocId must start with "subdoc-"',
  })
);
export type SubdocId = typeof SubdocId.Type;

/**
 * Branded identity ID for canvas ownership.
 * Shared with document schemas for consistency.
 */
export const IdentityId = Schema.String.pipe(Schema.brand('IdentityId'));
export type IdentityId = typeof IdentityId.Type;

// =============================================================================
// Enums
// =============================================================================

/**
 * Canvas status in the registry.
 */
export const CanvasStatus = Schema.Literal(
  'draft',
  'active',
  'archived',
  'deleted'
);
export type CanvasStatus = typeof CanvasStatus.Type;

/**
 * Canvas visibility level.
 */
export const CanvasVisibility = Schema.Literal(
  'private',
  'team',
  'organization',
  'public'
);
export type CanvasVisibility = typeof CanvasVisibility.Type;

/**
 * Subdoc type - what kind of content the nested Y.Doc holds.
 */
export const SubdocType = Schema.Literal(
  'editor', // AutonomousEditorPanel content
  'code', // Code editor content (future)
  'data' // Data/table content (future)
);
export type SubdocType = typeof SubdocType.Type;

// =============================================================================
// Core Schemas
// =============================================================================

/**
 * Subdoc metadata stored alongside canvas.
 * Tracks nested Y.Doc instances embedded in EditorPanelShapes.
 */
export const SubdocMetadata = Schema.Struct({
  /** Unique subdoc identifier (also used as Y.Doc guid) */
  id: SubdocId,

  /** Parent canvas containing this subdoc */
  canvasId: CanvasId,

  /** Shape ID in tldraw that owns this subdoc */
  shapeId: Schema.String,

  /** Type of content this subdoc holds */
  type: SubdocType,

  /** Human-readable title (optional) */
  title: Schema.optional(Schema.String),

  /** Creation timestamp */
  createdAt: Schema.DateFromString,

  /** Last update timestamp */
  updatedAt: Schema.DateFromString,

  /** Version for optimistic concurrency */
  version: Schema.Number,
});
export type SubdocMetadata = typeof SubdocMetadata.Type;

/**
 * Canvas metadata stored in NATS KV.
 * The actual canvas content (shapes, bindings) is in Y-Sweet.
 */
export const CanvasMetadata = Schema.Struct({
  /** Unique canvas identifier */
  id: CanvasId,

  /** Human-readable title */
  title: Schema.String,

  /** Canvas status */
  status: CanvasStatus,

  /** Visibility level */
  visibility: CanvasVisibility,

  /** Creator identity */
  createdBy: IdentityId,

  /** Creation timestamp (ISO 8601) */
  createdAt: Schema.DateFromString,

  /** Last modifier identity */
  updatedBy: IdentityId,

  /** Last update timestamp (ISO 8601) */
  updatedAt: Schema.DateFromString,

  /** Y-sweet document ID for canvas content sync */
  ysweetDocId: Schema.String,

  /** IDs of nested subdocs (EditorPanelShape content) */
  subdocIds: Schema.Array(SubdocId),

  /** Optional tags for categorization */
  tags: Schema.optional(Schema.Array(Schema.String)),

  /** Optional custom metadata */
  metadata: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown })
  ),

  /** Version for optimistic concurrency */
  version: Schema.Number,
});
export type CanvasMetadata = typeof CanvasMetadata.Type;

/**
 * Payload for creating a new canvas.
 */
export const CreateCanvasPayload = Schema.Struct({
  title: Schema.String,
  visibility: Schema.optionalWith(CanvasVisibility, {
    default: () => 'private' as const,
  }),
  tags: Schema.optional(Schema.Array(Schema.String)),
  metadata: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown })
  ),
});
export type CreateCanvasPayload = typeof CreateCanvasPayload.Type;

/**
 * Payload for updating canvas metadata.
 */
export const UpdateCanvasPayload = Schema.Struct({
  title: Schema.optional(Schema.String),
  status: Schema.optional(CanvasStatus),
  visibility: Schema.optional(CanvasVisibility),
  tags: Schema.optional(Schema.Array(Schema.String)),
  metadata: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown })
  ),
});
export type UpdateCanvasPayload = typeof UpdateCanvasPayload.Type;

// =============================================================================
// Event Schemas (for NATS KV watch)
// =============================================================================

/**
 * Canvas created event.
 */
export const CanvasCreatedEvent = Schema.TaggedStruct('CanvasCreated', {
  canvasId: CanvasId,
  title: Schema.String,
  createdBy: IdentityId,
  createdAt: Schema.DateFromString,
});
export type CanvasCreatedEvent = typeof CanvasCreatedEvent.Type;

/**
 * Canvas updated event.
 */
export const CanvasUpdatedEvent = Schema.TaggedStruct('CanvasUpdated', {
  canvasId: CanvasId,
  updatedBy: IdentityId,
  updatedAt: Schema.DateFromString,
  changes: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
});
export type CanvasUpdatedEvent = typeof CanvasUpdatedEvent.Type;

/**
 * Canvas deleted event.
 */
export const CanvasDeletedEvent = Schema.TaggedStruct('CanvasDeleted', {
  canvasId: CanvasId,
  deletedBy: IdentityId,
  deletedAt: Schema.DateFromString,
});
export type CanvasDeletedEvent = typeof CanvasDeletedEvent.Type;

/**
 * Subdoc created event.
 */
export const SubdocCreatedEvent = Schema.TaggedStruct('SubdocCreated', {
  subdocId: SubdocId,
  canvasId: CanvasId,
  shapeId: Schema.String,
  type: SubdocType,
  createdAt: Schema.DateFromString,
});
export type SubdocCreatedEvent = typeof SubdocCreatedEvent.Type;

/**
 * Subdoc deleted event.
 */
export const SubdocDeletedEvent = Schema.TaggedStruct('SubdocDeleted', {
  subdocId: SubdocId,
  canvasId: CanvasId,
  deletedAt: Schema.DateFromString,
});
export type SubdocDeletedEvent = typeof SubdocDeletedEvent.Type;

/**
 * Union of all canvas events for pattern matching.
 */
export const CanvasEvent = Schema.Union(
  CanvasCreatedEvent,
  CanvasUpdatedEvent,
  CanvasDeletedEvent,
  SubdocCreatedEvent,
  SubdocDeletedEvent
);
export type CanvasEvent = typeof CanvasEvent.Type;

// =============================================================================
// Utilities
// =============================================================================

/**
 * Generate a new canvas ID with timestamp prefix.
 */
export const generateCanvasId = (): CanvasId => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `canvas-${timestamp}-${random}` as CanvasId;
};

/**
 * Generate a new subdoc ID with timestamp prefix.
 */
export const generateSubdocId = (): SubdocId => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `subdoc-${timestamp}-${random}` as SubdocId;
};

/**
 * Create initial canvas metadata for a new canvas.
 *
 * @param payload - Creation payload with title, visibility, etc.
 * @param createdBy - Identity of the creator
 * @param canvasId - Pre-generated canvas ID (used as both id AND ysweetDocId)
 */
export const createInitialCanvasMetadata = (
  payload: CreateCanvasPayload,
  createdBy: IdentityId,
  canvasId: CanvasId
): CanvasMetadata => {
  const now = new Date();

  return {
    id: canvasId,
    title: payload.title,
    status: 'draft',
    visibility: payload.visibility ?? 'private',
    createdBy,
    createdAt: now,
    updatedBy: createdBy,
    updatedAt: now,
    ysweetDocId: canvasId, // Same as ID for simplicity
    subdocIds: [],
    tags: payload.tags,
    metadata: payload.metadata,
    version: 1,
  };
};

/**
 * Create initial subdoc metadata for a new subdoc.
 *
 * @param canvasId - Parent canvas ID
 * @param shapeId - tldraw shape ID that owns this subdoc
 * @param type - Type of content
 * @param subdocId - Pre-generated subdoc ID
 * @param title - Optional title
 */
export const createInitialSubdocMetadata = (
  canvasId: CanvasId,
  shapeId: string,
  type: SubdocType,
  subdocId: SubdocId,
  title?: string
): SubdocMetadata => {
  const now = new Date();

  return {
    id: subdocId,
    canvasId,
    shapeId,
    type,
    title,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
};
