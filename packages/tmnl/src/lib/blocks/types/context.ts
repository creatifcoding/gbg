/**
 * BlockNodeViewContext - Universal Adapter for Block Rendering
 *
 * This interface decouples block components from editor-specific implementations.
 * Adapters convert editor-specific props (Tiptap NodeViewProps, BlockSuite, etc.)
 * into this universal context.
 *
 * Following Schema Discipline — all types backed by Effect Schema.
 */

import { Schema } from 'effect';

// ============================================================================
// Block Identity
// ============================================================================

/**
 * Branded type for block IDs
 */
export const BlockId = Schema.String.pipe(
  Schema.brand('BlockId'),
  Schema.minLength(1)
);
export type BlockId = typeof BlockId.Type;

/**
 * Block type identifier (e.g., 'map', 'chart', 'scene3d')
 */
export const BlockTypeName = Schema.String.pipe(Schema.brand('BlockTypeName'));
export type BlockTypeName = typeof BlockTypeName.Type;

// ============================================================================
// Block State
// ============================================================================

/**
 * Selection state for a block
 */
export const BlockSelectionState = Schema.Struct({
  /** Whether this block is currently selected */
  selected: Schema.Boolean,
  /** Whether this block has focus (keyboard navigation) */
  focused: Schema.optional(Schema.Boolean),
  /** Multi-select: part of a selection range */
  inRange: Schema.optional(Schema.Boolean),
});
export type BlockSelectionState = typeof BlockSelectionState.Type;

/**
 * Editability state for a block
 */
export const BlockEditState = Schema.Struct({
  /** Whether the block content can be edited */
  isEditable: Schema.Boolean,
  /** Whether the block can be deleted */
  isDeletable: Schema.optional(Schema.Boolean),
  /** Whether the block can be moved/reordered */
  isMovable: Schema.optional(Schema.Boolean),
  /** Whether the block is currently being edited inline */
  isEditing: Schema.optional(Schema.Boolean),
});
export type BlockEditState = typeof BlockEditState.Type;

// ============================================================================
// Block Attributes
// ============================================================================

/**
 * Generic block attributes (editor-agnostic)
 */
export const BlockAttributes = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
});
export type BlockAttributes = typeof BlockAttributes.Type;

// ============================================================================
// BlockNodeViewContext - The Universal Interface
// ============================================================================

/**
 * Universal context for rendering blocks outside of any specific editor.
 *
 * This is the contract that EmbeddedBlockWrapper (and future block components)
 * will consume. Adapters (Tiptap, BlockSuite, etc.) convert their native
 * props into this interface.
 *
 * @example
 * ```tsx
 * // In a Tiptap NodeView
 * const context = tiptapToBlockContext(nodeViewProps);
 * return <EmbeddedBlockWrapper context={context} />;
 *
 * // In a standalone context (Telegram WebApp)
 * const context = createStandaloneContext({ blockId: 'abc', ... });
 * return <EmbeddedBlockWrapper context={context} />;
 * ```
 */
export interface BlockNodeViewContext {
  // ─────────────────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────────────────

  /** Unique identifier for this block instance */
  readonly blockId: BlockId;

  /** Type name of the block (e.g., 'map', 'chart') */
  readonly blockTypeName: BlockTypeName;

  /** User-visible display name (can be renamed) */
  readonly displayName?: string;

  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────

  /** Selection state */
  readonly selection: BlockSelectionState;

  /** Editability state */
  readonly editState: BlockEditState;

  /** Block-specific attributes (passed through from editor) */
  readonly attributes: BlockAttributes;

  // ─────────────────────────────────────────────────────────────────────────
  // Callbacks
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Delete this block from the document.
   * Editor adapters wire this to their native deletion mechanism.
   */
  readonly onDelete: () => void;

  /**
   * Update selection state.
   * Called when block selection changes (e.g., click, keyboard navigation).
   */
  readonly onSelect?: (selected: boolean) => void;

  /**
   * Update block attributes.
   * Called when block-specific settings change (e.g., rename, config).
   */
  readonly onAttributeChange?: (key: string, value: unknown) => void;

  /**
   * Request focus on this block.
   * Used for keyboard navigation and accessibility.
   */
  readonly onFocus?: () => void;

  // ─────────────────────────────────────────────────────────────────────────
  // Editor Integration (Optional)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Raw editor-specific objects for escape hatches.
   * Use sparingly — prefer the abstracted callbacks above.
   */
  readonly raw?: {
    /** Tiptap: NodeViewProps.editor */
    readonly editor?: unknown;
    /** Tiptap: NodeViewProps.node (ProseMirror node) */
    readonly node?: unknown;
    /** BlockSuite: Block model */
    readonly blockModel?: unknown;
  };
}

// ============================================================================
// Context Factory Helpers
// ============================================================================

/**
 * Create a minimal standalone context (for testing or non-editor use).
 */
export const createStandaloneContext = (options: {
  blockId: string;
  blockTypeName: string;
  displayName?: string;
  attributes?: Record<string, unknown>;
  isEditable?: boolean;
  onDelete?: () => void;
  onAttributeChange?: (key: string, value: unknown) => void;
}): BlockNodeViewContext => ({
  blockId: options.blockId as BlockId,
  blockTypeName: options.blockTypeName as BlockTypeName,
  displayName: options.displayName,
  selection: {
    selected: false,
    focused: false,
    inRange: false,
  },
  editState: {
    isEditable: options.isEditable ?? false,
    isDeletable: options.isEditable ?? false,
    isMovable: options.isEditable ?? false,
    isEditing: false,
  },
  attributes: options.attributes ?? {},
  onDelete: options.onDelete ?? (() => {}),
  onAttributeChange: options.onAttributeChange,
});
