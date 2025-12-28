/**
 * SQLite Models for Editor Persistence
 *
 * Uses @effect/sql Model.Class pattern with SQLite-specific transforms.
 * See .edin/EFFECT_SQL_SQLITE_PATTERNS.md for patterns.
 *
 * @module editor/v3/persistence/models
 */

import { Model } from '@effect/sql';
import { Schema } from 'effect';

import { DocumentId } from '../schemas/document';
import {
  FilePath,
  FileSyncStatus,
} from '../services/FileDocumentMappingService';
import { NullableJsonFromString } from './sqlite-helpers';
import { BlockId, FoldStateSchema } from '../extensions/blocks/EmbeddedBlockWrapper/persistence/schemas';

// =============================================================================
// FileMapping Model
// =============================================================================

/**
 * SQLite model for file-to-document mappings.
 *
 * Table: file_mappings
 * Primary Key: path (TEXT) — client-provided
 */
export class FileMappingModel extends Model.Class<FileMappingModel>(
  'FileMappingModel'
)({
  /** Absolute file path (primary key, client-provided) */
  path: Model.GeneratedByApp(FilePath),

  /** Associated y-sweet document ID */
  documentId: Schema.String.pipe(Schema.brand('DocumentId')),

  /** File modification time when last synced (ms since epoch) */
  lastSyncedMtime: Schema.Number,

  /** Content hash when last synced (for conflict detection) */
  lastSyncedHash: Schema.String,

  /** Current sync status */
  syncStatus: FileSyncStatus,

  /** When mapping was created (ISO string for SQLite) */
  createdAt: Model.DateTimeInsert,

  /** When mapping was last updated (ISO string for SQLite) */
  updatedAt: Model.DateTimeUpdate,
}) {}

// =============================================================================
// RecentDocument Model
// =============================================================================

/**
 * SQLite model for recently accessed documents.
 *
 * Table: recent_documents
 * Primary Key: id (INTEGER, auto-increment)
 */
export class RecentDocumentModel extends Model.Class<RecentDocumentModel>(
  'RecentDocumentModel'
)({
  /** Auto-increment ID */
  id: Model.Generated(Schema.Int),

  /** Document ID (references y-sweet doc) */
  documentId: Schema.String.pipe(Schema.brand('DocumentId')),

  /** Document title for display */
  title: Schema.String,

  /** Optional file path if backed by local file */
  filePath: Schema.NullOr(Schema.String),

  /** Last access timestamp (ISO string for SQLite) */
  lastAccessedAt: Model.DateTimeUpdate,

  /** Access count for sorting */
  accessCount: Schema.Number,

  /** Optional metadata (JSON string → Option<unknown>) */
  metadata: NullableJsonFromString,
}) {}

// =============================================================================
// DocumentMetadataCache Model
// =============================================================================

/**
 * SQLite model for cached document metadata.
 * This is a local cache of metadata — source of truth is y-sweet/NATS.
 *
 * Table: document_metadata_cache
 * Primary Key: documentId (TEXT, client-provided)
 */
export class DocumentMetadataCacheModel extends Model.Class<DocumentMetadataCacheModel>(
  'DocumentMetadataCacheModel'
)({
  /** Document ID (primary key, client-provided) */
  documentId: Model.GeneratedByApp(DocumentId),

  /** Document title */
  title: Schema.String,

  /** Word count (cached) */
  wordCount: Schema.Number,

  /** Character count (cached) */
  charCount: Schema.Number,

  /** Last modified timestamp (ISO string) */
  lastModifiedAt: Model.DateTimeUpdate,

  /** Optional file path if backed by local file */
  filePath: Schema.NullOr(Schema.String),

  /** Optional tags (JSON string) */
  tagsJson: Schema.NullOr(Schema.String),

  /** When cache entry was created */
  cachedAt: Model.DateTimeInsert,

  /** When cache entry was last updated */
  updatedAt: Model.DateTimeUpdate,
}) {}

// =============================================================================
// BlockState Model
// =============================================================================

/**
 * SQLite model for embedded block state persistence.
 * Enables state restore after focus mode exit.
 *
 * Table: block_states
 * Primary Key: blockId (TEXT, client-provided)
 */
export class BlockStateModel extends Model.Class<BlockStateModel>(
  'BlockStateModel'
)({
  /** Block ID (primary key, client-provided) */
  blockId: Model.GeneratedByApp(BlockId),

  /** Fold state (expanded/collapsed/minimized) */
  foldState: FoldStateSchema,

  /** Whether settings panel is open */
  settingsOpen: Schema.Boolean,

  /** Active settings tab ID */
  activeTab: Schema.String,

  /** Serialized node attributes (JSON string) */
  nodeAttrs: Schema.String,

  /** When state was saved */
  savedAt: Model.DateTimeUpdate,

  /** When state was created */
  createdAt: Model.DateTimeInsert,
}) {}
