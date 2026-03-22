/**
 * Shared Schemas for Block System
 *
 * Branded primitives and core entities used by both
 * BlockRegistry and BlockStateService.
 *
 * @module editor/v3/extensions/blocks/EmbeddedBlockWrapper/shared
 */

import { Option, Schema } from 'effect';

// =============================================================================
// Branded Primitives
// =============================================================================

/**
 * Unique block identifier (from node.attrs.id)
 *
 * @example
 * ```typescript
 * const id = 'map-block-abc123' as BlockId;
 * ```
 */
export const BlockId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('BlockId')
);
export type BlockId = typeof BlockId.Type;

/**
 * User-defined block name (slug-like: lowercase, alphanumeric, dashes)
 *
 * Validation rules:
 * - Must start with lowercase letter
 * - Can contain lowercase letters, numbers, dashes
 * - 1-64 characters
 *
 * @example
 * ```typescript
 * const name = 'main-map' as BlockName;
 * const invalid = 'Main Map'; // FAILS: uppercase, space
 * ```
 */
export const BlockName = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]*$/),
  Schema.minLength(1),
  Schema.maxLength(64),
  Schema.brand('BlockName')
);
export type BlockName = typeof BlockName.Type;

/**
 * Document identifier (for scoping registries)
 *
 * Each document has its own isolated block namespace.
 */
export const DocumentId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('DocumentId')
);
export type DocumentId = typeof DocumentId.Type;

// =============================================================================
// Block Type Enum
// =============================================================================

/**
 * Block type for filtering and categorization
 */
export const BlockType = Schema.Literal(
  'map',
  'chart',
  'table',
  'code',
  'embed',
  'custom'
);
export type BlockType = typeof BlockType.Type;

// =============================================================================
// BlockRef Entity
// =============================================================================

/**
 * Reference to a named block.
 * The queryable unit in the registry.
 *
 * @example
 * ```typescript
 * const block = new BlockRef({
 *   id: 'map-001' as BlockId,
 *   name: Option.some('main-map' as BlockName),
 *   type: 'map',
 *   documentId: 'doc-123' as DocumentId,
 *   registeredAt: new Date(),
 *   namedAt: Option.some(new Date()),
 * });
 *
 * if (block.isNamed) {
 *   console.log(`Block name: ${Option.getOrThrow(block.name)}`);
 * }
 * ```
 */
export class BlockRef extends Schema.TaggedClass<BlockRef>()('BlockRef', {
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
}) {
  /** Check if block has a user-assigned name */
  get isNamed(): boolean {
    return Option.isSome(this.name);
  }

  /** Get display name (name or fallback to truncated ID) */
  get displayName(): string {
    return Option.getOrElse(this.name, () => this.id.slice(0, 8));
  }

  /** Assign or update name */
  withName(name: BlockName): BlockRef {
    return new BlockRef({
      ...this,
      name: Option.some(name),
      namedAt: Option.some(new Date()),
    });
  }

  /** Remove name */
  clearName(): BlockRef {
    return new BlockRef({
      ...this,
      name: Option.none(),
      namedAt: Option.none(),
    });
  }
}

// =============================================================================
// SQLite Row Schema (for persistence)
// =============================================================================

export const BlockRefRow = Schema.Struct({
  id: Schema.String,
  name: Schema.NullOr(Schema.String),
  type: Schema.String,
  document_id: Schema.String,
  registered_at: Schema.String,
  named_at: Schema.NullOr(Schema.String),
});
export type BlockRefRow = typeof BlockRefRow.Type;

// =============================================================================
// Conversion Utilities
// =============================================================================

export const blockRefFromRow = (row: BlockRefRow): BlockRef =>
  new BlockRef({
    id: row.id as BlockId,
    name: row.name ? Option.some(row.name as BlockName) : Option.none(),
    type: row.type as BlockType,
    documentId: row.document_id as DocumentId,
    registeredAt: new Date(row.registered_at),
    namedAt: row.named_at ? Option.some(new Date(row.named_at)) : Option.none(),
  });

export const blockRefToRow = (ref: BlockRef): BlockRefRow => ({
  id: ref.id,
  name: Option.getOrNull(ref.name),
  type: ref.type,
  document_id: ref.documentId,
  registered_at: ref.registeredAt.toISOString(),
  named_at: Option.isSome(ref.namedAt)
    ? Option.getOrThrow(ref.namedAt).toISOString()
    : null,
});
