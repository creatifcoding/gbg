/**
 * Reactivity Keys
 *
 * Keys for Reactivity.stream() auto-invalidation.
 * When events are processed, associated keys are invalidated,
 * causing subscribed atoms to refresh.
 *
 * @module editor/events/reactivity
 */

import { EventLog, Reactivity } from "@effect/experimental"
import { BlockEvents } from "./block"
import { DocumentEvents, HistoryEvents } from "./document"

// ─────────────────────────────────────────────────────────────
// Reactivity Keys
// ─────────────────────────────────────────────────────────────

export const Keys = {
  /** Invalidate when blocks change (add, update, delete, move) */
  blocks: "editor:blocks",

  /** Invalidate when document changes (create, load) */
  document: "editor:document",

  /** Invalidate when selection changes */
  selection: "editor:selection",

  /** Invalidate when mode changes */
  mode: "editor:mode",

  /** Invalidate when history changes (undo/redo) */
  history: "editor:history",
} as const

// ─────────────────────────────────────────────────────────────
// Reactivity Bindings
// ─────────────────────────────────────────────────────────────

/**
 * Block event reactivity.
 * All block events invalidate the blocks key.
 */
export const BlockReactivityLive = EventLog.groupReactivity(BlockEvents, (register) =>
  register
    .keys("BlockAdded", () => [Keys.blocks, Keys.document])
    .keys("BlockUpdated", () => [Keys.blocks])
    .keys("BlockDeleted", () => [Keys.blocks, Keys.document])
    .keys("BlockMoved", () => [Keys.blocks])
)

/**
 * Document event reactivity.
 */
export const DocumentReactivityLive = EventLog.groupReactivity(DocumentEvents, (register) =>
  register
    .keys("DocumentCreated", () => [Keys.document, Keys.blocks])
    .keys("DocumentLoaded", () => [Keys.document, Keys.blocks, Keys.selection, Keys.mode])
    .keys("ModeChanged", () => [Keys.mode])
    .keys("SelectionChanged", () => [Keys.selection])
)

/**
 * History event reactivity.
 */
export const HistoryReactivityLive = EventLog.groupReactivity(HistoryEvents, (register) =>
  register
    .keys("UndoPerformed", () => [Keys.history, Keys.blocks, Keys.document])
    .keys("RedoPerformed", () => [Keys.history, Keys.blocks, Keys.document])
)
