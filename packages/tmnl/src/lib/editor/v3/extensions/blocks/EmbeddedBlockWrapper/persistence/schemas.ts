/**
 * BlockState Schemas
 *
 * Effect Schema definitions for persisted block state.
 * Enables SQLite persistence with runtime validation.
 *
 * @module editor/v3/extensions/blocks/EmbeddedBlockWrapper/persistence
 */

import { Schema } from 'effect';
import type { FoldState } from '../types';
import { BlockId } from '../shared';

export { BlockId } from '../shared';
export type { BlockId as BlockIdType } from '../shared';

// =============================================================================
// Enums as Literals
// =============================================================================

/**
 * Fold state enum as Schema.Literal
 */
export const FoldStateSchema = Schema.Literal(
  'expanded',
  'collapsed',
  'minimized'
);
export type FoldStateSchema = typeof FoldStateSchema.Type;

// =============================================================================
// BlockState Entity
// =============================================================================

/**
 * Persisted block state
 *
 * Stored in SQLite for restore-on-remount after focus mode exit.
 *
 * @example
 * ```typescript
 * const state = new BlockState({
 *   blockId: 'map-block-1' as BlockId,
 *   foldState: 'expanded',
 *   settingsOpen: false,
 *   activeTab: 'style',
 *   nodeAttrs: { viewState: { ... } },
 *   savedAt: new Date(),
 * })
 * ```
 */
export class BlockState extends Schema.TaggedClass<BlockState>()('BlockState', {
  /**
   * Unique block identifier (from node.attrs.id)
   */
  blockId: BlockId,

  /**
   * Current fold state (expanded/collapsed/minimized)
   */
  foldState: FoldStateSchema,

  /**
   * Whether settings panel is open
   */
  settingsOpen: Schema.Boolean,

  /**
   * Active settings tab ID
   */
  activeTab: Schema.String,

  /**
   * Serialized node attributes (viewState, markers, entities, etc.)
   */
  nodeAttrs: Schema.Unknown,

  /**
   * Timestamp for cache invalidation
   */
  savedAt: Schema.DateFromSelf,
}) {
  /**
   * Create a minimal state for new blocks
   */
  static empty(blockId: string): BlockState {
    return new BlockState({
      blockId: blockId as BlockId,
      foldState: 'expanded',
      settingsOpen: false,
      activeTab: '',
      nodeAttrs: {},
      savedAt: new Date(),
    });
  }

  /**
   * Update with new fold state
   */
  withFoldState(foldState: FoldState): BlockState {
    return new BlockState({
      ...this,
      foldState,
      savedAt: new Date(),
    });
  }

  /**
   * Update with new settings state
   */
  withSettings(settingsOpen: boolean, activeTab?: string): BlockState {
    return new BlockState({
      ...this,
      settingsOpen,
      activeTab: activeTab ?? this.activeTab,
      savedAt: new Date(),
    });
  }

  /**
   * Update with new node attributes
   */
  withNodeAttrs(nodeAttrs: unknown): BlockState {
    return new BlockState({
      ...this,
      nodeAttrs,
      savedAt: new Date(),
    });
  }
}

// =============================================================================
// Focus State
// =============================================================================

/**
 * Focus mode state for the editor
 *
 * Tracks which block (if any) is in focus mode, enabling
 * sibling unmount and full-viewport overlay.
 */
export class FocusState extends Schema.TaggedClass<FocusState>()('FocusState', {
  /**
   * Currently focused block ID (null if no focus)
   */
  focusedBlockId: Schema.NullOr(BlockId),

  /**
   * Timestamp when focus mode was entered
   */
  enteredAt: Schema.NullOr(Schema.DateFromSelf),
}) {
  /**
   * No focus state (default)
   */
  static none(): FocusState {
    return new FocusState({
      focusedBlockId: null,
      enteredAt: null,
    });
  }

  /**
   * Enter focus mode for a block
   */
  static focus(blockId: string): FocusState {
    return new FocusState({
      focusedBlockId: blockId as BlockId,
      enteredAt: new Date(),
    });
  }

  /**
   * Check if a specific block is focused
   */
  isFocused(blockId: string): boolean {
    return this.focusedBlockId === blockId;
  }

  /**
   * Check if any block is focused
   */
  get isActive(): boolean {
    return this.focusedBlockId !== null;
  }

  /**
   * Exit focus mode
   */
  exit(): FocusState {
    return FocusState.none();
  }
}

// =============================================================================
// Errors
// =============================================================================

/**
 * Block state not found error
 */
export class BlockStateNotFound extends Schema.TaggedError<BlockStateNotFound>()(
  'BlockStateNotFound',
  {
    blockId: BlockId,
    message: Schema.String,
  }
) {}

/**
 * Block state persistence error
 */
export class BlockStatePersistenceError extends Schema.TaggedError<BlockStatePersistenceError>()(
  'BlockStatePersistenceError',
  {
    blockId: BlockId,
    operation: Schema.Literal('save', 'restore', 'delete'),
    cause: Schema.Unknown,
  }
) {}

// =============================================================================
// SQLite Row Schema
// =============================================================================

/**
 * SQLite row shape for block_states table
 *
 * Used for encode/decode between BlockState and database rows.
 */
export const BlockStateRow = Schema.Struct({
  block_id: Schema.String,
  fold_state: Schema.String,
  settings_open: Schema.Number, // SQLite boolean as 0/1
  active_tab: Schema.String,
  node_attrs: Schema.String, // JSON stringified
  saved_at: Schema.String, // ISO string
});
export type BlockStateRow = typeof BlockStateRow.Type;

/**
 * Transform between BlockState and BlockStateRow
 */
export const BlockStateFromRow = Schema.transform(BlockStateRow, BlockState, {
  decode: (row) =>
    new BlockState({
      blockId: row.block_id as BlockId,
      foldState: row.fold_state as FoldState,
      settingsOpen: row.settings_open === 1,
      activeTab: row.active_tab,
      nodeAttrs: JSON.parse(row.node_attrs),
      savedAt: new Date(row.saved_at),
    }),
  encode: (state) => ({
    block_id: state.blockId,
    fold_state: state.foldState,
    settings_open: state.settingsOpen ? 1 : 0,
    active_tab: state.activeTab,
    node_attrs: JSON.stringify(state.nodeAttrs),
    saved_at: state.savedAt.toISOString(),
  }),
});
