/**
 * EventLog Handlers
 *
 * Event handlers that update EditorService state when events are processed.
 * Each handler receives { payload, entry, conflicts } and calls existing service methods.
 *
 * @module editor/events/handlers
 */

import { EventLog } from "@effect/experimental"
import * as Effect from "effect/Effect"
import { EditorService } from "../services/EditorService"
import { BlockEvents } from "./block"
import { DocumentEvents, HistoryEvents } from "./document"

// ─────────────────────────────────────────────────────────────
// Block Handlers
// ─────────────────────────────────────────────────────────────

/**
 * Handlers for BlockEvents.
 * Block CRUD operations that update document state.
 */
export const BlockHandlersLive = EventLog.group(BlockEvents, (handlers) =>
  handlers
    .handle("BlockAdded", ({ payload }) =>
      Effect.gen(function* () {
        const editor = yield* EditorService
        yield* editor.addBlock(payload.block, payload.afterId ?? undefined)
      })
    )
    .handle("BlockUpdated", ({ payload }) =>
      Effect.gen(function* () {
        const editor = yield* EditorService
        yield* editor.updateBlock(payload.id, () => payload.updated)
      })
    )
    .handle("BlockDeleted", ({ payload }) =>
      Effect.gen(function* () {
        const editor = yield* EditorService
        yield* editor.deleteBlock(payload.id)
      })
    )
    .handle("BlockMoved", ({ payload }) =>
      Effect.gen(function* () {
        const editor = yield* EditorService
        yield* editor.moveBlock(payload.id, payload.toAfterId)
      })
    )
)

// ─────────────────────────────────────────────────────────────
// Document Handlers
// ─────────────────────────────────────────────────────────────

/**
 * Handlers for DocumentEvents.
 * Document lifecycle operations.
 */
export const DocumentHandlersLive = EventLog.group(DocumentEvents, (handlers) =>
  handlers
    .handle("DocumentCreated", ({ payload }) =>
      Effect.gen(function* () {
        const editor = yield* EditorService
        yield* editor.createNew(payload.title)
      })
    )
    .handle("DocumentLoaded", ({ payload }) =>
      Effect.gen(function* () {
        const editor = yield* EditorService
        yield* editor.loadDocument(payload.document)
      })
    )
    .handle("ModeChanged", ({ payload }) =>
      Effect.gen(function* () {
        const editor = yield* EditorService
        yield* editor.setMode(payload.current)
      })
    )
    .handle("SelectionChanged", ({ payload }) =>
      Effect.gen(function* () {
        const editor = yield* EditorService
        yield* editor.setSelection(payload.selection as any)
      })
    )
)

// ─────────────────────────────────────────────────────────────
// History Handlers
// ─────────────────────────────────────────────────────────────

/**
 * Handlers for HistoryEvents.
 * These are audit events - the actual undo/redo is handled differently.
 */
export const HistoryHandlersLive = EventLog.group(HistoryEvents, (handlers) =>
  handlers
    .handle("UndoPerformed", () =>
      // Audit event only - undo logic handled by service
      Effect.void
    )
    .handle("RedoPerformed", () =>
      // Audit event only - redo logic handled by service
      Effect.void
    )
)
