/**
 * EventLog-Aware Editor Atoms
 *
 * Editor atoms that use EventLog for state mutations.
 * Operations write events instead of calling services directly.
 *
 * Import these instead of the base atoms when EventLog is enabled.
 *
 * @module editor/atoms/eventlog
 */

import { Atom } from "@effect-atom/atom"
import { EventLog, EventJournal, Reactivity } from "@effect/experimental"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import * as Option from "effect/Option"

import { EditorService, EditorServiceLive } from "../services/EditorService"
import type { Block, BlockId, Document, DocumentId } from "../schemas/block"
import { createParagraph, createHeading, createCodeBlock } from "../schemas/block"
import type { Selection } from "../schemas/selection"
import type { EditorMode } from "../services/EditorService"

import {
  BlockHandlersLive,
  DocumentHandlersLive,
  HistoryHandlersLive,
  BlockReactivityLive,
  DocumentReactivityLive,
  HistoryReactivityLive,
  Keys,
} from "../events"

// ─────────────────────────────────────────────────────────────
// Layer Composition
// ─────────────────────────────────────────────────────────────

/**
 * Full EventLog layer combining:
 * - EditorService (base state management)
 * - EventLog + EventJournal (memory for now)
 * - All handlers
 * - All reactivity bindings
 */
export const EditorEventLogLive = Layer.mergeAll(
  // Base editor service
  EditorServiceLive,
  // EventLog infrastructure with memory journal
  EventJournal.layerMemory,
  Reactivity.layer,
).pipe(
  // Add handlers that update services on event processing
  Layer.provideMerge(BlockHandlersLive),
  Layer.provideMerge(DocumentHandlersLive),
  Layer.provideMerge(HistoryHandlersLive),
  // Add reactivity bindings for auto-invalidation
  Layer.provideMerge(BlockReactivityLive),
  Layer.provideMerge(DocumentReactivityLive),
  Layer.provideMerge(HistoryReactivityLive),
)

// ─────────────────────────────────────────────────────────────
// Runtime Atom
// ─────────────────────────────────────────────────────────────

/**
 * Runtime atom with EventLog support.
 * Use this instead of editorRuntimeAtom when EventLog is enabled.
 */
export const editorEventLogRuntimeAtom = Atom.runtime(EditorEventLogLive)

// ─────────────────────────────────────────────────────────────
// Reactive Query Atoms
// ─────────────────────────────────────────────────────────────

/**
 * Document atom using Reactivity.stream().
 * Auto-updates when document events fire.
 */
export const documentAtom = editorEventLogRuntimeAtom.atom(
  Reactivity.stream(
    [Keys.document],
    Effect.gen(function* () {
      const editor = yield* EditorService
      return Atom.get(editor.atoms.document)
    })
  ).pipe(
    Stream.runLast,
    Effect.map((opt) => Option.getOrElse(opt, () => null as Document | null))
  )
)

/**
 * Blocks atom using Reactivity.stream().
 * Auto-updates when block events fire.
 */
export const blocksAtom = editorEventLogRuntimeAtom.atom(
  Reactivity.stream(
    [Keys.blocks],
    Effect.gen(function* () {
      const editor = yield* EditorService
      return Atom.get(editor.atoms.document)?.blocks ?? []
    })
  ).pipe(
    Stream.runLast,
    Effect.map((opt) => Option.getOrElse(opt, () => [] as Block[]))
  )
)

/**
 * Selection atom using Reactivity.stream().
 */
export const selectionAtom = editorEventLogRuntimeAtom.atom(
  Reactivity.stream(
    [Keys.selection],
    Effect.gen(function* () {
      const editor = yield* EditorService
      return Atom.get(editor.atoms.selection)
    })
  ).pipe(
    Stream.runLast,
    Effect.map((opt) => Option.getOrElse(opt, () => null as Selection | null))
  )
)

/**
 * Mode atom using Reactivity.stream().
 */
export const modeAtom = editorEventLogRuntimeAtom.atom(
  Reactivity.stream(
    [Keys.mode],
    Effect.gen(function* () {
      const editor = yield* EditorService
      return Atom.get(editor.atoms.mode)
    })
  ).pipe(
    Stream.runLast,
    Effect.map((opt) => Option.getOrElse(opt, () => "page" as EditorMode))
  )
)

/**
 * Dirty flag atom.
 */
export const isDirtyAtom = editorEventLogRuntimeAtom.atom(
  Reactivity.stream(
    [Keys.blocks, Keys.document],
    Effect.gen(function* () {
      const editor = yield* EditorService
      return Atom.get(editor.atoms.isDirty)
    })
  ).pipe(
    Stream.runLast,
    Effect.map((opt) => Option.getOrElse(opt, () => false))
  )
)

/**
 * Can undo atom.
 */
export const canUndoAtom = editorEventLogRuntimeAtom.atom(
  Reactivity.stream(
    [Keys.history, Keys.blocks],
    Effect.gen(function* () {
      const editor = yield* EditorService
      return yield* editor.canUndo()
    })
  ).pipe(
    Stream.runLast,
    Effect.map((opt) => Option.getOrElse(opt, () => false))
  )
)

/**
 * Can redo atom.
 */
export const canRedoAtom = editorEventLogRuntimeAtom.atom(
  Reactivity.stream(
    [Keys.history, Keys.blocks],
    Effect.gen(function* () {
      const editor = yield* EditorService
      return yield* editor.canRedo()
    })
  ).pipe(
    Stream.runLast,
    Effect.map((opt) => Option.getOrElse(opt, () => false))
  )
)

// ─────────────────────────────────────────────────────────────
// EventLog Operations (Write Events)
// ─────────────────────────────────────────────────────────────

/**
 * Block operations that write events to EventLog.
 */
export const blockOps = {
  /**
   * Add a paragraph block by writing BlockAdded event.
   */
  addParagraph: editorEventLogRuntimeAtom.fn<{ text?: string; afterId?: BlockId }>()(
    ({ text = "", afterId }) =>
      Effect.gen(function* () {
        const log = yield* EventLog
        const block = createParagraph(text)
        yield* log.write("BlockAdded", {
          block,
          afterId: afterId ?? null,
          timestamp: Date.now(),
        })
        return block
      })
  ),

  /**
   * Add a heading block.
   */
  addHeading: editorEventLogRuntimeAtom.fn<{
    text: string
    level?: 1 | 2 | 3 | 4 | 5 | 6
    afterId?: BlockId
  }>()(({ text, level = 2, afterId }) =>
    Effect.gen(function* () {
      const log = yield* EventLog
      const block = createHeading(text, level)
      yield* log.write("BlockAdded", {
        block,
        afterId: afterId ?? null,
        timestamp: Date.now(),
      })
      return block
    })
  ),

  /**
   * Add a code block.
   */
  addCodeBlock: editorEventLogRuntimeAtom.fn<{
    code?: string
    language?: string
    afterId?: BlockId
  }>()(({ code = "", language = "typescript", afterId }) =>
    Effect.gen(function* () {
      const log = yield* EventLog
      const block = createCodeBlock(code, language)
      yield* log.write("BlockAdded", {
        block,
        afterId: afterId ?? null,
        timestamp: Date.now(),
      })
      return block
    })
  ),

  /**
   * Update a block.
   */
  update: editorEventLogRuntimeAtom.fn<{
    id: BlockId
    updater: (block: Block) => Block
  }>()(({ id, updater }) =>
    Effect.gen(function* () {
      const editor = yield* EditorService
      const log = yield* EventLog

      // Get current block
      const blocks = Atom.get(editor.atoms.document)?.blocks ?? []
      const block = blocks.find((b) => b.id === id)
      if (!block) return

      const updated = updater(block)
      yield* log.write("BlockUpdated", {
        id,
        previous: block,
        updated,
        timestamp: Date.now(),
      })
    })
  ),

  /**
   * Delete a block.
   */
  delete: editorEventLogRuntimeAtom.fn<BlockId>()((id) =>
    Effect.gen(function* () {
      const editor = yield* EditorService
      const log = yield* EventLog

      // Get current block for undo storage
      const blocks = Atom.get(editor.atoms.document)?.blocks ?? []
      const block = blocks.find((b) => b.id === id)
      if (!block) return

      yield* log.write("BlockDeleted", {
        id,
        block,
        timestamp: Date.now(),
      })
    })
  ),

  /**
   * Move a block.
   */
  move: editorEventLogRuntimeAtom.fn<{ id: BlockId; afterId: BlockId | null }>()(
    ({ id, afterId }) =>
      Effect.gen(function* () {
        const editor = yield* EditorService
        const log = yield* EventLog

        const blocks = Atom.get(editor.atoms.document)?.blocks ?? []
        const fromIndex = blocks.findIndex((b) => b.id === id)
        if (fromIndex === -1) return

        yield* log.write("BlockMoved", {
          id,
          fromIndex,
          toAfterId: afterId,
          timestamp: Date.now(),
        })
      })
  ),
}

/**
 * Document operations that write events.
 */
export const documentOps = {
  /**
   * Create a new document.
   */
  create: editorEventLogRuntimeAtom.fn<string | undefined>()((title) =>
    Effect.gen(function* () {
      const log = yield* EventLog
      const id = crypto.randomUUID() as DocumentId
      yield* log.write("DocumentCreated", {
        id,
        title: title ?? "Untitled",
        timestamp: Date.now(),
      })
      return id
    })
  ),

  /**
   * Load a document.
   */
  load: editorEventLogRuntimeAtom.fn<Document>()((document) =>
    Effect.gen(function* () {
      const log = yield* EventLog
      yield* log.write("DocumentLoaded", {
        document,
        timestamp: Date.now(),
      })
    })
  ),

  /**
   * Change editor mode.
   */
  setMode: editorEventLogRuntimeAtom.fn<EditorMode>()((mode) =>
    Effect.gen(function* () {
      const editor = yield* EditorService
      const log = yield* EventLog

      const doc = Atom.get(editor.atoms.document)
      if (!doc) return

      const previous = Atom.get(editor.atoms.mode)
      if (previous === mode) return

      yield* log.write("ModeChanged", {
        documentId: doc.id,
        previous,
        current: mode,
        timestamp: Date.now(),
      })
    })
  ),

  /**
   * Toggle mode between page and canvas.
   */
  toggleMode: editorEventLogRuntimeAtom.fn<void>()(() =>
    Effect.gen(function* () {
      const editor = yield* EditorService
      const log = yield* EventLog

      const doc = Atom.get(editor.atoms.document)
      if (!doc) return

      const current = Atom.get(editor.atoms.mode)
      const next = current === "page" ? "canvas" : "page"

      yield* log.write("ModeChanged", {
        documentId: doc.id,
        previous: current,
        current: next,
        timestamp: Date.now(),
      })
    })
  ),

  /**
   * Set selection.
   */
  setSelection: editorEventLogRuntimeAtom.fn<Selection | null>()((selection) =>
    Effect.gen(function* () {
      const editor = yield* EditorService
      const log = yield* EventLog

      const doc = Atom.get(editor.atoms.document)
      if (!doc) return

      yield* log.write("SelectionChanged", {
        documentId: doc.id,
        selection,
        timestamp: Date.now(),
      })
    })
  ),

  /**
   * Clear selection.
   */
  clearSelection: editorEventLogRuntimeAtom.fn<void>()(() =>
    Effect.gen(function* () {
      const editor = yield* EditorService
      const log = yield* EventLog

      const doc = Atom.get(editor.atoms.document)
      if (!doc) return

      yield* log.write("SelectionChanged", {
        documentId: doc.id,
        selection: null,
        timestamp: Date.now(),
      })
    })
  ),
}

/**
 * History operations.
 * Note: These write audit events but also call service directly for undo/redo.
 */
export const historyOps = {
  /**
   * Undo last operation.
   */
  undo: editorEventLogRuntimeAtom.fn<void>()(() =>
    Effect.gen(function* () {
      const editor = yield* EditorService
      const log = yield* EventLog

      const doc = Atom.get(editor.atoms.document)
      if (!doc) return

      const success = yield* editor.undo()
      if (success) {
        yield* log.write("UndoPerformed", {
          documentId: doc.id,
          timestamp: Date.now(),
        })
      }
      return success
    })
  ),

  /**
   * Redo last undone operation.
   */
  redo: editorEventLogRuntimeAtom.fn<void>()(() =>
    Effect.gen(function* () {
      const editor = yield* EditorService
      const log = yield* EventLog

      const doc = Atom.get(editor.atoms.document)
      if (!doc) return

      const success = yield* editor.redo()
      if (success) {
        yield* log.write("RedoPerformed", {
          documentId: doc.id,
          timestamp: Date.now(),
        })
      }
      return success
    })
  ),
}
