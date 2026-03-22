/**
 * BlockRegistry Persistence Schemas
 *
 * Effect Schema definitions for persisted block registry with fat JSON blob.
 * Enables SQLite persistence with runtime validation.
 *
 * Fat JSON Blob Pattern:
 * - Fixed columns for indexing (id, name, type, document_id)
 * - `restore_data` JSONB column for block-specific state
 * - Each block carries everything needed to restore itself
 *
 * @module editor/v3/extensions/blocks/EmbeddedBlockWrapper/registry/persistence
 */

import { Option, Schema } from 'effect';
import {
  BlockId,
  BlockName,
  BlockType,
  DocumentId,
  BlockRef,
} from '../../shared';

// =============================================================================
// Fat JSON Blob Schema
// =============================================================================

/**
 * Block restore data — the fat JSON blob.
 *
 * Contains everything a block needs to restore itself after reload:
 * - UI state (fold, settings, tabs)
 * - Block-specific attributes (viewState, entities, markers)
 * - Collaboration metadata
 *
 * This is block-type agnostic — each block type stores what it needs.
 */
export const BlockRestoreData = Schema.Struct({
  /** UI fold state */
  foldState: Schema.optional(
    Schema.Literal('expanded', 'collapsed', 'minimized')
  ),

  /** Whether settings panel is open */
  settingsOpen: Schema.optional(Schema.Boolean),

  /** Active settings tab ID */
  activeTab: Schema.optional(Schema.String),

  /** Block-specific node attributes (viewState, entities, etc.) */
  nodeAttrs: Schema.optional(Schema.Unknown),

  /** Custom metadata (extension point) */
  metadata: Schema.optional(Schema.Unknown),

  /** Version for future migrations */
  version: Schema.optional(Schema.Number),
});
export type BlockRestoreData = typeof BlockRestoreData.Type;

/**
 * Default empty restore data
 */
export const emptyRestoreData: BlockRestoreData = {
  foldState: 'expanded',
  settingsOpen: false,
  activeTab: '',
  nodeAttrs: {},
  metadata: {},
  version: 1,
};

// =============================================================================
// Persisted Block Entity
// =============================================================================

/**
 * Persisted block reference with restore data.
 *
 * Extends BlockRef with persistence-specific fields:
 * - restoreData: Fat JSON blob for block-isolated restore
 * - schemaVersion: For future migrations
 * - updatedAt: For cache invalidation
 */
export class PersistedBlock extends Schema.TaggedClass<PersistedBlock>()(
  'PersistedBlock',
  {
    /** Unique block ID (from node.attrs.id) */
    id: BlockId,

    /** User-assigned name (optional until named) */
    name: Schema.OptionFromNullOr(BlockName),

    /** Block type for filtering */
    type: BlockType,

    /** Owning document */
    documentId: DocumentId,

    /** When the block was registered */
    registeredAt: Schema.DateFromSelf,

    /** When the name was last changed */
    namedAt: Schema.OptionFromNullOr(Schema.DateFromSelf),

    /** Fat JSON blob for restore */
    restoreData: BlockRestoreData,

    /** Schema version for migrations */
    schemaVersion: Schema.Number,

    /** Last update timestamp */
    updatedAt: Schema.DateFromSelf,
  }
) {
  /**
   * Create from BlockRef with empty restore data
   */
  static fromBlockRef(ref: BlockRef): PersistedBlock {
    const now = new Date();
    return new PersistedBlock({
      id: ref.id,
      name: ref.name,
      type: ref.type,
      documentId: ref.documentId,
      registeredAt: ref.registeredAt,
      namedAt: ref.namedAt,
      restoreData: emptyRestoreData,
      schemaVersion: 1,
      updatedAt: now,
    });
  }

  /**
   * Convert back to BlockRef (for in-memory use)
   */
  toBlockRef(): BlockRef {
    return new BlockRef({
      id: this.id,
      name: this.name,
      type: this.type,
      documentId: this.documentId,
      registeredAt: this.registeredAt,
      namedAt: this.namedAt,
    });
  }

  /**
   * Update restore data
   */
  withRestoreData(data: Partial<BlockRestoreData>): PersistedBlock {
    return new PersistedBlock({
      ...this,
      restoreData: { ...this.restoreData, ...data },
      updatedAt: new Date(),
    });
  }

  /**
   * Update name
   */
  withName(name: BlockName): PersistedBlock {
    return new PersistedBlock({
      ...this,
      name: Option.some(name),
      namedAt: Option.some(new Date()),
      updatedAt: new Date(),
    });
  }

  /**
   * Clear name
   */
  clearName(): PersistedBlock {
    return new PersistedBlock({
      ...this,
      name: Option.none(),
      namedAt: Option.none(),
      updatedAt: new Date(),
    });
  }
}

// =============================================================================
// SQLite Row Schema
// =============================================================================

/**
 * SQLite row shape for block_registry table
 */
export const PersistedBlockRow = Schema.Struct({
  id: Schema.String,
  name: Schema.NullOr(Schema.String),
  type: Schema.String,
  document_id: Schema.String,
  registered_at: Schema.String,
  named_at: Schema.NullOr(Schema.String),
  restore_data: Schema.String, // JSON stringified
  schema_version: Schema.Number,
  updated_at: Schema.String,
});
export type PersistedBlockRow = typeof PersistedBlockRow.Type;

// =============================================================================
// Conversion Utilities
// =============================================================================

/**
 * Convert SQLite row to PersistedBlock
 */
export const persistedBlockFromRow = (row: PersistedBlockRow): PersistedBlock =>
  new PersistedBlock({
    id: row.id as BlockId,
    name: row.name ? Option.some(row.name as BlockName) : Option.none(),
    type: row.type as BlockType,
    documentId: row.document_id as DocumentId,
    registeredAt: new Date(row.registered_at),
    namedAt: row.named_at ? Option.some(new Date(row.named_at)) : Option.none(),
    restoreData: JSON.parse(row.restore_data) as BlockRestoreData,
    schemaVersion: row.schema_version,
    updatedAt: new Date(row.updated_at),
  });

/**
 * Convert PersistedBlock to SQLite row
 */
export const persistedBlockToRow = (
  block: PersistedBlock
): PersistedBlockRow => ({
  id: block.id,
  name: Option.getOrNull(block.name),
  type: block.type,
  document_id: block.documentId,
  registered_at: block.registeredAt.toISOString(),
  named_at: Option.isSome(block.namedAt)
    ? Option.getOrThrow(block.namedAt).toISOString()
    : null,
  restore_data: JSON.stringify(block.restoreData),
  schema_version: block.schemaVersion,
  updated_at: block.updatedAt.toISOString(),
});

// =============================================================================
// Errors
// =============================================================================

/**
 * Block registry persistence error
 */
export class BlockRegistryPersistenceError extends Schema.TaggedError<BlockRegistryPersistenceError>()(
  'BlockRegistryPersistenceError',
  {
    blockId: Schema.NullOr(BlockId),
    operation: Schema.Literal('save', 'load', 'delete', 'loadAll'),
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}
