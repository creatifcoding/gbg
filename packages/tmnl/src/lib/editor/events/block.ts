/**
 * Block Operation Events
 *
 * EventGroup for block CRUD operations.
 * All block mutations flow through EventLog for:
 * - Event sourcing / audit trail
 * - Undo/redo via event replay
 * - Real-time collaboration sync
 *
 * @module editor/events/block
 */

import { EventGroup } from "@effect/experimental"
import { Schema } from "effect"
import { BlockId, Block } from "../schemas/block"

// ─────────────────────────────────────────────────────────────
// Block Events
// ─────────────────────────────────────────────────────────────

export const BlockEvents = EventGroup.empty
  .add({
    tag: "BlockAdded",
    primaryKey: (p) => p.block.id,
    payload: Schema.Struct({
      block: Block,
      afterId: Schema.NullOr(BlockId),
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: "BlockUpdated",
    primaryKey: (p) => p.id,
    payload: Schema.Struct({
      id: BlockId,
      previous: Block,
      updated: Block,
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: "BlockDeleted",
    primaryKey: (p) => p.id,
    payload: Schema.Struct({
      id: BlockId,
      block: Block, // Store for undo
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: "BlockMoved",
    primaryKey: (p) => p.id,
    payload: Schema.Struct({
      id: BlockId,
      fromIndex: Schema.Number,
      toAfterId: Schema.NullOr(BlockId),
      timestamp: Schema.Number,
    }),
  })

// ─────────────────────────────────────────────────────────────
// Payload Types (for external consumers)
// ─────────────────────────────────────────────────────────────

export type BlockAddedPayload = {
  readonly block: Block
  readonly afterId: BlockId | null
  readonly timestamp: number
}

export type BlockUpdatedPayload = {
  readonly id: BlockId
  readonly previous: Block
  readonly updated: Block
  readonly timestamp: number
}

export type BlockDeletedPayload = {
  readonly id: BlockId
  readonly block: Block
  readonly timestamp: number
}

export type BlockMovedPayload = {
  readonly id: BlockId
  readonly fromIndex: number
  readonly toAfterId: BlockId | null
  readonly timestamp: number
}
