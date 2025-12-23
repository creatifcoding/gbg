/**
 * Editor EventLog Integration
 *
 * Event definitions, handlers, and reactivity for the block editor.
 * Enables event sourcing, undo/redo, and real-time sync.
 *
 * @module editor/events
 */

import { EventLog } from "@effect/experimental"

// Events
export * from "./block"
export * from "./document"

// Handlers
export * from "./handlers"

// Reactivity
export * from "./reactivity"

// ─────────────────────────────────────────────────────────────
// EventLog Schema
// ─────────────────────────────────────────────────────────────

import { BlockEvents } from "./block"
import { DocumentEvents, HistoryEvents } from "./document"

/**
 * Combined EventLog schema for all editor events.
 * Used to create the EventLog layer.
 */
export const EditorEventLogSchema = EventLog.schema(
  BlockEvents,
  DocumentEvents,
  HistoryEvents
)
