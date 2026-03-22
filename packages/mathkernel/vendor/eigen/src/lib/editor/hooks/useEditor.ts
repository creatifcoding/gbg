/**
 * useEditor Hook
 *
 * React hook for accessing editor state and operations.
 *
 * @module editor/hooks/useEditor
 */

import { useAtomValue, Result } from "@effect-atom/atom-react";
import {
  blocksAtom,
  documentAtom,
  selectionAtom,
  modeAtom,
  isDirtyAtom,
  canUndoAtom,
  canRedoAtom,
  addParagraph,
  addHeading,
  addCodeBlock,
  deleteBlock,
  updateBlock,
  moveBlock,
  setSelection,
  clearSelection,
  setMode,
  toggleMode,
  undo,
  redo,
  loadDocument,
  createNewDocument,
} from "../atoms";
import type { Block, BlockId, Document } from "../schemas/block";
import type { Selection } from "../schemas/selection";
import type { EditorMode } from "../services/EditorService";

/**
 * Hook return type
 */
export interface UseEditorResult {
  // State
  document: Document | null;
  blocks: Block[];
  selection: Selection | null;
  mode: EditorMode;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isLoading: boolean;
  error: unknown | null;

  // Block operations
  addParagraph: (text?: string, afterId?: BlockId) => Promise<Block>;
  addHeading: (
    text: string,
    level?: 1 | 2 | 3 | 4 | 5 | 6,
    afterId?: BlockId
  ) => Promise<Block>;
  addCodeBlock: (
    code?: string,
    language?: string,
    afterId?: BlockId
  ) => Promise<Block>;
  deleteBlock: (id: BlockId) => Promise<void>;
  updateBlock: (id: BlockId, updater: (block: Block) => Block) => Promise<void>;
  moveBlock: (id: BlockId, afterId: BlockId | null) => Promise<void>;

  // Selection
  setSelection: (selection: Selection | null) => Promise<void>;
  clearSelection: () => Promise<void>;

  // Mode
  setMode: (mode: EditorMode) => Promise<void>;
  toggleMode: () => Promise<void>;

  // History
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;

  // Document
  loadDocument: (doc: Document) => Promise<void>;
  createNew: (title?: string) => Promise<Document>;
}

/**
 * useEditor - access editor state and operations
 */
export function useEditor(): UseEditorResult {
  // Read state atoms
  const documentResult = useAtomValue(documentAtom);
  const blocksResult = useAtomValue(blocksAtom);
  const selectionResult = useAtomValue(selectionAtom);
  const modeResult = useAtomValue(modeAtom);
  const isDirtyResult = useAtomValue(isDirtyAtom);
  const canUndoResult = useAtomValue(canUndoAtom);
  const canRedoResult = useAtomValue(canRedoAtom);

  // Read operation atoms
  const addParagraphFn = useAtomValue(addParagraph);
  const addHeadingFn = useAtomValue(addHeading);
  const addCodeBlockFn = useAtomValue(addCodeBlock);
  const deleteBlockFn = useAtomValue(deleteBlock);
  const updateBlockFn = useAtomValue(updateBlock);
  const moveBlockFn = useAtomValue(moveBlock);
  const setSelectionFn = useAtomValue(setSelection);
  const clearSelectionFn = useAtomValue(clearSelection);
  const setModeFn = useAtomValue(setMode);
  const toggleModeFn = useAtomValue(toggleMode);
  const undoFn = useAtomValue(undo);
  const redoFn = useAtomValue(redo);
  const loadDocumentFn = useAtomValue(loadDocument);
  const createNewFn = useAtomValue(createNewDocument);

  // Extract values from results using Result.match for proper pattern matching
  const document = Result.match(documentResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: (s) => s.value,
  });

  const blocks = Result.match(blocksResult, {
    onInitial: () => [] as Block[],
    onFailure: () => [] as Block[],
    onSuccess: (s) => s.value,
  });

  const selection = Result.match(selectionResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: (s) => s.value,
  });

  const mode = Result.match(modeResult, {
    onInitial: () => "page" as EditorMode,
    onFailure: () => "page" as EditorMode,
    onSuccess: (s) => s.value,
  });

  const isDirty = Result.match(isDirtyResult, {
    onInitial: () => false,
    onFailure: () => false,
    onSuccess: (s) => s.value,
  });

  const canUndo = Result.match(canUndoResult, {
    onInitial: () => false,
    onFailure: () => false,
    onSuccess: (s) => s.value,
  });

  const canRedo = Result.match(canRedoResult, {
    onInitial: () => false,
    onFailure: () => false,
    onSuccess: (s) => s.value,
  });

  // Determine loading and error states using Result.match
  const isLoading = Result.match(documentResult, {
    onInitial: () => true,
    onFailure: () => false,
    onSuccess: () => false,
  });

  const error = Result.match(documentResult, {
    onInitial: () => null as unknown | null,
    onFailure: (f) => f.cause,
    onSuccess: () => null as unknown | null,
  });

  return {
    // State
    document,
    blocks,
    selection,
    mode,
    isDirty,
    canUndo,
    canRedo,
    isLoading,
    error,

    // Operations (wrapped in promises for ergonomics)
    addParagraph: async (text = "", afterId) => {
      if (Result.isSuccess(addParagraphFn)) {
        return addParagraphFn.value(text, afterId);
      }
      throw new Error("Editor not ready");
    },
    addHeading: async (text, level = 2, afterId) => {
      if (Result.isSuccess(addHeadingFn)) {
        return addHeadingFn.value(text, level, afterId);
      }
      throw new Error("Editor not ready");
    },
    addCodeBlock: async (code = "", language = "typescript", afterId) => {
      if (Result.isSuccess(addCodeBlockFn)) {
        return addCodeBlockFn.value(code, language, afterId);
      }
      throw new Error("Editor not ready");
    },
    deleteBlock: async (id) => {
      if (Result.isSuccess(deleteBlockFn)) {
        return deleteBlockFn.value(id);
      }
      throw new Error("Editor not ready");
    },
    updateBlock: async (id, updater) => {
      if (Result.isSuccess(updateBlockFn)) {
        return updateBlockFn.value(id, updater);
      }
      throw new Error("Editor not ready");
    },
    moveBlock: async (id, afterId) => {
      if (Result.isSuccess(moveBlockFn)) {
        return moveBlockFn.value(id, afterId);
      }
      throw new Error("Editor not ready");
    },
    setSelection: async (sel) => {
      if (Result.isSuccess(setSelectionFn)) {
        return setSelectionFn.value(sel);
      }
      throw new Error("Editor not ready");
    },
    clearSelection: async () => {
      if (Result.isSuccess(clearSelectionFn)) {
        return clearSelectionFn.value();
      }
      throw new Error("Editor not ready");
    },
    setMode: async (m) => {
      if (Result.isSuccess(setModeFn)) {
        return setModeFn.value(m);
      }
      throw new Error("Editor not ready");
    },
    toggleMode: async () => {
      if (Result.isSuccess(toggleModeFn)) {
        return toggleModeFn.value();
      }
      throw new Error("Editor not ready");
    },
    undo: async () => {
      if (Result.isSuccess(undoFn)) {
        return undoFn.value();
      }
      throw new Error("Editor not ready");
    },
    redo: async () => {
      if (Result.isSuccess(redoFn)) {
        return redoFn.value();
      }
      throw new Error("Editor not ready");
    },
    loadDocument: async (doc) => {
      console.log("[useEditor] loadDocument called", { isSuccess: Result.isSuccess(loadDocumentFn), loadDocumentFn });
      if (Result.isSuccess(loadDocumentFn)) {
        console.log("[useEditor] calling loadDocumentFn.value(doc)");
        const result = await loadDocumentFn.value(doc);
        console.log("[useEditor] loadDocument completed", result);
        return result;
      }
      console.error("[useEditor] Editor not ready - loadDocumentFn:", loadDocumentFn);
      throw new Error("Editor not ready");
    },
    createNew: async (title) => {
      if (Result.isSuccess(createNewFn)) {
        return createNewFn.value(title);
      }
      throw new Error("Editor not ready");
    },
  };
}

export default useEditor;
