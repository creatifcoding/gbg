/**
 * EditorService
 *
 * Effect.Service for editor state management using Atom-as-State pattern.
 * Manages document state, selection, and history.
 *
 * @module editor/services/EditorService
 */

import { Effect, Layer, Context } from "effect";
import { Atom } from "@effect-atom/atom";
import type {
  Block,
  BlockId,
  Document,
  RichText,
} from "../schemas/block";
import {
  createDocument,
  createParagraph,
  generateBlockId,
} from "../schemas/block";
import type { Selection } from "../schemas/selection";

// =============================================================================
// Types
// =============================================================================

/**
 * Editor mode - page (linear) or canvas (freeform)
 */
export type EditorMode = "page" | "canvas";

/**
 * History entry for undo/redo
 */
interface HistoryEntry {
  blocks: Block[];
  selection: Selection | null;
  timestamp: number;
}

/**
 * History stack
 */
interface HistoryStack {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

/**
 * Complete editor state
 */
export interface EditorState {
  document: Document;
  selection: Selection | null;
  mode: EditorMode;
  history: HistoryStack;
  isDirty: boolean;
}

/**
 * EditorService shape
 */
export interface EditorServiceShape {
  // State atoms (Atom-as-State pattern)
  readonly atoms: {
    readonly state: Atom.Atom<EditorState>;
    readonly document: Atom.Atom<Document>;
    readonly selection: Atom.Atom<Selection | null>;
    readonly mode: Atom.Atom<EditorMode>;
    readonly isDirty: Atom.Atom<boolean>;
  };

  // Document operations
  readonly loadDocument: (doc: Document) => Effect.Effect<void>;
  readonly createNew: (title?: string) => Effect.Effect<Document>;
  readonly getBlocks: () => Effect.Effect<Block[]>;

  // Block operations
  readonly addBlock: (
    block: Block,
    afterId?: BlockId
  ) => Effect.Effect<void>;
  readonly updateBlock: (
    id: BlockId,
    updater: (block: Block) => Block
  ) => Effect.Effect<void>;
  readonly deleteBlock: (id: BlockId) => Effect.Effect<void>;
  readonly moveBlock: (
    id: BlockId,
    afterId: BlockId | null
  ) => Effect.Effect<void>;

  // Selection
  readonly setSelection: (selection: Selection | null) => Effect.Effect<void>;
  readonly clearSelection: () => Effect.Effect<void>;

  // Mode
  readonly setMode: (mode: EditorMode) => Effect.Effect<void>;
  readonly toggleMode: () => Effect.Effect<void>;

  // History
  readonly undo: () => Effect.Effect<boolean>;
  readonly redo: () => Effect.Effect<boolean>;
  readonly canUndo: () => Effect.Effect<boolean>;
  readonly canRedo: () => Effect.Effect<boolean>;
}

// =============================================================================
// Block Tree Operations
// =============================================================================

/**
 * Find block index by ID
 */
const findBlockIndex = (blocks: Block[], id: BlockId): number =>
  blocks.findIndex((b) => b.id === id);

/**
 * Insert block after another block
 */
const insertBlockAfter = (
  blocks: Block[],
  block: Block,
  afterId?: BlockId
): Block[] => {
  if (!afterId) {
    return [...blocks, block];
  }
  const index = findBlockIndex(blocks, afterId);
  if (index === -1) {
    return [...blocks, block];
  }
  return [...blocks.slice(0, index + 1), block, ...blocks.slice(index + 1)];
};

/**
 * Update a block in the tree
 */
const updateBlockInTree = (
  blocks: Block[],
  id: BlockId,
  updater: (block: Block) => Block
): Block[] =>
  blocks.map((block) => {
    if (block.id === id) {
      return updater(block);
    }
    // Recurse into children if they exist
    if ("children" in block && Array.isArray(block.children)) {
      return {
        ...block,
        children: updateBlockInTree(block.children as Block[], id, updater),
      } as Block;
    }
    return block;
  });

/**
 * Delete a block from the tree
 */
const deleteBlockFromTree = (blocks: Block[], id: BlockId): Block[] =>
  blocks
    .filter((block) => block.id !== id)
    .map((block) => {
      if ("children" in block && Array.isArray(block.children)) {
        return {
          ...block,
          children: deleteBlockFromTree(block.children as Block[], id),
        } as Block;
      }
      return block;
    });

/**
 * Move block to new position
 */
const moveBlockInTree = (
  blocks: Block[],
  id: BlockId,
  afterId: BlockId | null
): Block[] => {
  const blockIndex = findBlockIndex(blocks, id);
  if (blockIndex === -1) return blocks;

  const block = blocks[blockIndex];
  const withoutBlock = blocks.filter((_, i) => i !== blockIndex);

  if (afterId === null) {
    return [block, ...withoutBlock];
  }

  const afterIndex = findBlockIndex(withoutBlock, afterId);
  if (afterIndex === -1) {
    return [...withoutBlock, block];
  }

  return [
    ...withoutBlock.slice(0, afterIndex + 1),
    block,
    ...withoutBlock.slice(afterIndex + 1),
  ];
};

// =============================================================================
// Service Implementation
// =============================================================================

const MAX_HISTORY = 100;

/**
 * EditorService - Effect.Service with Atom-as-State
 *
 * CRITICAL: All Atom.get/set/update calls return Effect<_, _, AtomRegistry>
 * and MUST be yielded with yield* inside Effect.gen blocks.
 */
export class EditorService extends Effect.Service<EditorService>()(
  "tmnl/EditorService",
  {
    effect: Effect.gen(function* () {
      // Initialize state atom
      const initialDoc = createDocument();
      const stateAtom = Atom.make<EditorState>({
        document: initialDoc,
        selection: null,
        mode: "page",
        history: { past: [], future: [] },
        isDirty: false,
      });

      // Derived atoms
      const documentAtom = Atom.make(initialDoc);
      const selectionAtom = Atom.make<Selection | null>(null);
      const modeAtom = Atom.make<EditorMode>("page");
      const isDirtyAtom = Atom.make(false);

      // Sync state to derived atoms - returns Effect, must be yielded
      const syncDerived = Effect.gen(function* () {
        const state = yield* Atom.get(stateAtom);
        yield* Atom.set(documentAtom, state.document);
        yield* Atom.set(selectionAtom, state.selection);
        yield* Atom.set(modeAtom, state.mode);
        yield* Atom.set(isDirtyAtom, state.isDirty);
      });

      // Push to history - returns Effect, must be yielded
      const pushHistory = Effect.gen(function* () {
        const state = yield* Atom.get(stateAtom);
        const entry: HistoryEntry = {
          blocks: [...state.document.blocks],
          selection: state.selection,
          timestamp: Date.now(),
        };

        yield* Atom.update(stateAtom, (s) => ({
          ...s,
          history: {
            past: [...s.history.past.slice(-MAX_HISTORY), entry],
            future: [], // Clear future on new edit
          },
        }));
      });

      return {
        atoms: {
          state: stateAtom,
          document: documentAtom,
          selection: selectionAtom,
          mode: modeAtom,
          isDirty: isDirtyAtom,
        },

        loadDocument: (doc: Document) =>
          Effect.gen(function* () {
            yield* Atom.set(stateAtom, {
              document: doc,
              selection: null,
              mode: "page",
              history: { past: [], future: [] },
              isDirty: false,
            });
            yield* syncDerived;
          }),

        createNew: (title?: string) =>
          Effect.gen(function* () {
            const doc = createDocument(title);
            yield* Atom.set(stateAtom, {
              document: doc,
              selection: null,
              mode: "page",
              history: { past: [], future: [] },
              isDirty: false,
            });
            yield* syncDerived;
            return doc;
          }),

        getBlocks: () =>
          Effect.gen(function* () {
            const state = yield* Atom.get(stateAtom);
            return state.document.blocks;
          }),

        addBlock: (block: Block, afterId?: BlockId) =>
          Effect.gen(function* () {
            yield* pushHistory;
            yield* Atom.update(stateAtom, (s) => ({
              ...s,
              document: {
                ...s.document,
                blocks: insertBlockAfter(s.document.blocks, block, afterId),
                meta: { ...s.document.meta, updatedAt: new Date() },
              },
              isDirty: true,
            }));
            yield* syncDerived;
          }),

        updateBlock: (id: BlockId, updater: (block: Block) => Block) =>
          Effect.gen(function* () {
            yield* pushHistory;
            yield* Atom.update(stateAtom, (s) => ({
              ...s,
              document: {
                ...s.document,
                blocks: updateBlockInTree(s.document.blocks, id, updater),
                meta: { ...s.document.meta, updatedAt: new Date() },
              },
              isDirty: true,
            }));
            yield* syncDerived;
          }),

        deleteBlock: (id: BlockId) =>
          Effect.gen(function* () {
            yield* pushHistory;
            yield* Atom.update(stateAtom, (s) => ({
              ...s,
              document: {
                ...s.document,
                blocks: deleteBlockFromTree(s.document.blocks, id),
                meta: { ...s.document.meta, updatedAt: new Date() },
              },
              isDirty: true,
            }));
            yield* syncDerived;
          }),

        moveBlock: (id: BlockId, afterId: BlockId | null) =>
          Effect.gen(function* () {
            yield* pushHistory;
            yield* Atom.update(stateAtom, (s) => ({
              ...s,
              document: {
                ...s.document,
                blocks: moveBlockInTree(s.document.blocks, id, afterId),
                meta: { ...s.document.meta, updatedAt: new Date() },
              },
              isDirty: true,
            }));
            yield* syncDerived;
          }),

        setSelection: (selection: Selection | null) =>
          Effect.gen(function* () {
            yield* Atom.update(stateAtom, (s) => ({ ...s, selection }));
            yield* syncDerived;
          }),

        clearSelection: () =>
          Effect.gen(function* () {
            yield* Atom.update(stateAtom, (s) => ({ ...s, selection: null }));
            yield* syncDerived;
          }),

        setMode: (mode: EditorMode) =>
          Effect.gen(function* () {
            yield* Atom.update(stateAtom, (s) => ({ ...s, mode }));
            yield* syncDerived;
          }),

        toggleMode: () =>
          Effect.gen(function* () {
            yield* Atom.update(stateAtom, (s) => ({
              ...s,
              mode: s.mode === "page" ? "canvas" : "page",
            }));
            yield* syncDerived;
          }),

        undo: () =>
          Effect.gen(function* () {
            const state = yield* Atom.get(stateAtom);
            if (state.history.past.length === 0) return false;

            const prev = state.history.past[state.history.past.length - 1];
            const current: HistoryEntry = {
              blocks: [...state.document.blocks],
              selection: state.selection,
              timestamp: Date.now(),
            };

            yield* Atom.update(stateAtom, (s) => ({
              ...s,
              document: {
                ...s.document,
                blocks: prev.blocks,
              },
              selection: prev.selection,
              history: {
                past: s.history.past.slice(0, -1),
                future: [current, ...s.history.future],
              },
            }));
            yield* syncDerived;
            return true;
          }),

        redo: () =>
          Effect.gen(function* () {
            const state = yield* Atom.get(stateAtom);
            if (state.history.future.length === 0) return false;

            const next = state.history.future[0];
            const current: HistoryEntry = {
              blocks: [...state.document.blocks],
              selection: state.selection,
              timestamp: Date.now(),
            };

            yield* Atom.update(stateAtom, (s) => ({
              ...s,
              document: {
                ...s.document,
                blocks: next.blocks,
              },
              selection: next.selection,
              history: {
                past: [...s.history.past, current],
                future: s.history.future.slice(1),
              },
            }));
            yield* syncDerived;
            return true;
          }),

        canUndo: () =>
          Effect.gen(function* () {
            const state = yield* Atom.get(stateAtom);
            return state.history.past.length > 0;
          }),

        canRedo: () =>
          Effect.gen(function* () {
            const state = yield* Atom.get(stateAtom);
            return state.history.future.length > 0;
          }),
      };
    }),
  }
) {}

// =============================================================================
// Layer
// =============================================================================

/**
 * Default layer for EditorService
 */
export const EditorServiceLive = EditorService.Default;
