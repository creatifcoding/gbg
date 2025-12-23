/**
 * Document Lifecycle Events
 *
 * EventGroup for document-level operations.
 *
 * @module editor/events/document
 */

import { EventGroup } from "@effect/experimental"
import { Schema } from "effect"
import { DocumentId, Document } from "../schemas/block"
import type { EditorMode } from "../services/EditorService"

// ─────────────────────────────────────────────────────────────
// Mode Schema
// ─────────────────────────────────────────────────────────────

const EditorModeSchema = Schema.Literal("page", "canvas")

// ─────────────────────────────────────────────────────────────
// Document Events
// ─────────────────────────────────────────────────────────────

export const DocumentEvents = EventGroup.empty
  .add({
    tag: "DocumentCreated",
    primaryKey: (p) => p.id,
    payload: Schema.Struct({
      id: DocumentId,
      title: Schema.String,
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: "DocumentLoaded",
    primaryKey: (p) => p.document.id,
    payload: Schema.Struct({
      document: Document,
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: "ModeChanged",
    primaryKey: (p) => p.documentId,
    payload: Schema.Struct({
      documentId: DocumentId,
      previous: EditorModeSchema,
      current: EditorModeSchema,
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: "SelectionChanged",
    primaryKey: (p) => p.documentId,
    payload: Schema.Struct({
      documentId: DocumentId,
      // Selection is complex, store as JSON for now
      selection: Schema.NullOr(Schema.Unknown),
      timestamp: Schema.Number,
    }),
  })

// ─────────────────────────────────────────────────────────────
// History Events (for undo/redo audit)
// ─────────────────────────────────────────────────────────────

export const HistoryEvents = EventGroup.empty
  .add({
    tag: "UndoPerformed",
    primaryKey: (p) => `${p.documentId}:${p.timestamp}`,
    payload: Schema.Struct({
      documentId: DocumentId,
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: "RedoPerformed",
    primaryKey: (p) => `${p.documentId}:${p.timestamp}`,
    payload: Schema.Struct({
      documentId: DocumentId,
      timestamp: Schema.Number,
    }),
  })

// ─────────────────────────────────────────────────────────────
// Payload Types
// ─────────────────────────────────────────────────────────────

export type DocumentCreatedPayload = {
  readonly id: DocumentId
  readonly title: string
  readonly timestamp: number
}

export type DocumentLoadedPayload = {
  readonly document: Document
  readonly timestamp: number
}

export type ModeChangedPayload = {
  readonly documentId: DocumentId
  readonly previous: EditorMode
  readonly current: EditorMode
  readonly timestamp: number
}

export type SelectionChangedPayload = {
  readonly documentId: DocumentId
  readonly selection: unknown | null
  readonly timestamp: number
}
