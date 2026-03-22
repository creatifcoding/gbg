/**
 * Editor Atoms
 *
 * Runtime atoms for React integration using Atom.runtime() pattern.
 *
 * @module editor/atoms
 */

import { Effect } from "effect";
import { Atom } from "@effect-atom/atom";
import { EditorService, EditorServiceLive } from "../services/EditorService";
import type { Block, BlockId, Document } from "../schemas/block";
import { createParagraph, createHeading, createCodeBlock } from "../schemas/block";
import type { Selection } from "../schemas/selection";
import type { EditorMode } from "../services/EditorService";

// =============================================================================
// Runtime Atom
// =============================================================================

/**
 * Editor runtime atom - provides Effect runtime for React
 */
export const editorRuntimeAtom = Atom.runtime(EditorServiceLive);

// =============================================================================
// State Atoms (Read)
// =============================================================================

/**
 * Document atom - current document state
 * Note: Atom.get returns Effect<A, never, AtomRegistry>, must yield*
 */
export const documentAtom = editorRuntimeAtom.atom(
  Effect.gen(function* () {
    const editor = yield* EditorService;
    return yield* Atom.get(editor.atoms.document);
  })
);

/**
 * Blocks atom - current block list
 */
export const blocksAtom = editorRuntimeAtom.atom(
  Effect.gen(function* () {
    const editor = yield* EditorService;
    const doc = yield* Atom.get(editor.atoms.document);
    return doc.blocks;
  })
);

/**
 * Selection atom - current selection
 */
export const selectionAtom = editorRuntimeAtom.atom(
  Effect.gen(function* () {
    const editor = yield* EditorService;
    return yield* Atom.get(editor.atoms.selection);
  })
);

/**
 * Mode atom - page or canvas
 */
export const modeAtom = editorRuntimeAtom.atom(
  Effect.gen(function* () {
    const editor = yield* EditorService;
    return yield* Atom.get(editor.atoms.mode);
  })
);

/**
 * Dirty flag atom
 */
export const isDirtyAtom = editorRuntimeAtom.atom(
  Effect.gen(function* () {
    const editor = yield* EditorService;
    return yield* Atom.get(editor.atoms.isDirty);
  })
);

/**
 * Can undo atom
 */
export const canUndoAtom = editorRuntimeAtom.atom(
  Effect.gen(function* () {
    const editor = yield* EditorService;
    return yield* editor.canUndo();
  })
);

/**
 * Can redo atom
 */
export const canRedoAtom = editorRuntimeAtom.atom(
  Effect.gen(function* () {
    const editor = yield* EditorService;
    return yield* editor.canRedo();
  })
);

// =============================================================================
// Operation Atoms (Write)
// =============================================================================

/**
 * Load document operation
 */
export const loadDocument = editorRuntimeAtom.fn(
  (doc: Document) =>
    Effect.gen(function* () {
      const editor = yield* EditorService;
      yield* editor.loadDocument(doc);
    })
);

/**
 * Create new document operation
 */
export const createNewDocument = editorRuntimeAtom.fn(
  (title?: string) =>
    Effect.gen(function* () {
      const editor = yield* EditorService;
      return yield* editor.createNew(title);
    })
);

/**
 * Add paragraph block
 */
export const addParagraph = editorRuntimeAtom.fn(
  (text: string = "", afterId?: BlockId) =>
    Effect.gen(function* () {
      const editor = yield* EditorService;
      const block = createParagraph(text);
      yield* editor.addBlock(block, afterId);
      return block;
    })
);

/**
 * Add heading block
 */
export const addHeading = editorRuntimeAtom.fn(
  (text: string, level: 1 | 2 | 3 | 4 | 5 | 6 = 2, afterId?: BlockId) =>
    Effect.gen(function* () {
      const editor = yield* EditorService;
      const block = createHeading(text, level);
      yield* editor.addBlock(block, afterId);
      return block;
    })
);

/**
 * Add code block
 */
export const addCodeBlock = editorRuntimeAtom.fn(
  (code: string = "", language: string = "typescript", afterId?: BlockId) =>
    Effect.gen(function* () {
      const editor = yield* EditorService;
      const block = createCodeBlock(code, language);
      yield* editor.addBlock(block, afterId);
      return block;
    })
);

/**
 * Delete block
 */
export const deleteBlock = editorRuntimeAtom.fn(
  (id: BlockId) =>
    Effect.gen(function* () {
      const editor = yield* EditorService;
      yield* editor.deleteBlock(id);
    })
);

/**
 * Update block
 */
export const updateBlock = editorRuntimeAtom.fn(
  (id: BlockId, updater: (block: Block) => Block) =>
    Effect.gen(function* () {
      const editor = yield* EditorService;
      yield* editor.updateBlock(id, updater);
    })
);

/**
 * Move block
 */
export const moveBlock = editorRuntimeAtom.fn(
  (id: BlockId, afterId: BlockId | null) =>
    Effect.gen(function* () {
      const editor = yield* EditorService;
      yield* editor.moveBlock(id, afterId);
    })
);

/**
 * Set selection
 */
export const setSelection = editorRuntimeAtom.fn(
  (selection: Selection | null) =>
    Effect.gen(function* () {
      const editor = yield* EditorService;
      yield* editor.setSelection(selection);
    })
);

/**
 * Clear selection
 */
export const clearSelection = editorRuntimeAtom.fn(
  () =>
    Effect.gen(function* () {
      const editor = yield* EditorService;
      yield* editor.clearSelection();
    })
);

/**
 * Set editor mode
 */
export const setMode = editorRuntimeAtom.fn(
  (mode: EditorMode) =>
    Effect.gen(function* () {
      const editor = yield* EditorService;
      yield* editor.setMode(mode);
    })
);

/**
 * Toggle editor mode
 */
export const toggleMode = editorRuntimeAtom.fn(
  () =>
    Effect.gen(function* () {
      const editor = yield* EditorService;
      yield* editor.toggleMode();
    })
);

/**
 * Undo
 */
export const undo = editorRuntimeAtom.fn(
  () =>
    Effect.gen(function* () {
      const editor = yield* EditorService;
      return yield* editor.undo();
    })
);

/**
 * Redo
 */
export const redo = editorRuntimeAtom.fn(
  () =>
    Effect.gen(function* () {
      const editor = yield* EditorService;
      return yield* editor.redo();
    })
);
