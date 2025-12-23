/**
 * Selection Schema Definitions
 *
 * Data-driven, serializable selection model for the block editor.
 *
 * @module editor/schemas/selection
 */

import { Schema } from "effect";
import { BlockId } from "./block";

// =============================================================================
// Selection Types
// =============================================================================

/**
 * Text selection within a single block
 */
export const TextSelection = Schema.TaggedStruct("TextSelection", {
  blockId: BlockId,
  anchor: Schema.Number,  // Start offset
  focus: Schema.Number,   // End offset
});
export type TextSelection = typeof TextSelection.Type;

/**
 * Block-level selection (multiple blocks)
 */
export const BlockSelection = Schema.TaggedStruct("BlockSelection", {
  blockIds: Schema.Array(BlockId),
});
export type BlockSelection = typeof BlockSelection.Type;

/**
 * Native browser selection snapshot (for DOM reconciliation)
 */
export const NativeSelection = Schema.TaggedStruct("NativeSelection", {
  anchorNode: Schema.optional(Schema.String),
  anchorOffset: Schema.Number,
  focusNode: Schema.optional(Schema.String),
  focusOffset: Schema.Number,
});
export type NativeSelection = typeof NativeSelection.Type;

/**
 * Union of all selection types
 */
export const Selection = Schema.Union(TextSelection, BlockSelection);
export type Selection = typeof Selection.Type;

// =============================================================================
// Selection Utilities
// =============================================================================

/**
 * Create a collapsed text selection (cursor)
 */
export const createCursor = (blockId: BlockId, offset: number): TextSelection => ({
  _tag: "TextSelection",
  blockId,
  anchor: offset,
  focus: offset,
});

/**
 * Create a text range selection
 */
export const createTextRange = (
  blockId: BlockId,
  anchor: number,
  focus: number
): TextSelection => ({
  _tag: "TextSelection",
  blockId,
  anchor,
  focus,
});

/**
 * Create a block selection
 */
export const createBlockSelection = (blockIds: BlockId[]): BlockSelection => ({
  _tag: "BlockSelection",
  blockIds,
});

/**
 * Check if selection is collapsed (cursor)
 */
export const isCollapsed = (selection: Selection): boolean => {
  if (selection._tag === "TextSelection") {
    return selection.anchor === selection.focus;
  }
  return selection.blockIds.length <= 1;
};

/**
 * Check if selection spans multiple blocks
 */
export const isMultiBlock = (selection: Selection): boolean => {
  return selection._tag === "BlockSelection" && selection.blockIds.length > 1;
};

/**
 * Get the primary block ID from a selection
 */
export const getPrimaryBlockId = (selection: Selection): BlockId => {
  if (selection._tag === "TextSelection") {
    return selection.blockId;
  }
  return selection.blockIds[0];
};

/**
 * Get all block IDs in a selection
 */
export const getSelectedBlockIds = (selection: Selection): BlockId[] => {
  if (selection._tag === "TextSelection") {
    return [selection.blockId];
  }
  return selection.blockIds;
};
