/**
 * EditorService
 *
 * Effect.Service wrapping Tiptap editor operations.
 * Provides typed, Effect-based API for editor manipulation.
 *
 * @module editor/v3/services/EditorService
 */

import { Effect, Context, Layer } from 'effect';
import { Atom } from '@effect-atom/atom';
import type { Editor, JSONContent } from '@tiptap/core';
import {
  editorInstanceAtom,
  editorStatusAtom,
  isDirtyAtom,
  selectionAtom,
  activeMarksAtom,
  documentContentAtom,
} from '../atoms';
import type { MarkType, SelectionState } from '../types';

// =============================================================================
// Service Interface
// =============================================================================

export interface EditorServiceShape {
  // ===== Editor Access =====
  /**
   * Get the Tiptap editor instance.
   * Fails if editor is not initialized.
   */
  readonly getEditor: Effect.Effect<Editor, EditorNotReady>;

  // ===== Content Operations =====
  /**
   * Get document content as JSON.
   */
  readonly getContent: Effect.Effect<JSONContent>;

  /**
   * Set document content from JSON.
   */
  readonly setContent: (content: JSONContent) => Effect.Effect<void>;

  /**
   * Get document as plain text.
   */
  readonly getText: Effect.Effect<string>;

  /**
   * Get document as HTML.
   */
  readonly getHTML: Effect.Effect<string>;

  // ===== Formatting Operations =====
  /**
   * Toggle a formatting mark.
   */
  readonly toggleMark: (mark: MarkType) => Effect.Effect<void, EditorNotReady>;

  /**
   * Check if a mark is active.
   */
  readonly isMarkActive: (mark: MarkType) => Effect.Effect<boolean>;

  // ===== Selection Operations =====
  /**
   * Get current selection state.
   */
  readonly getSelection: Effect.Effect<SelectionState | null>;

  /**
   * Set selection by position.
   */
  readonly setSelection: (from: number, to?: number) => Effect.Effect<void, EditorNotReady>;

  /**
   * Select all content.
   */
  readonly selectAll: Effect.Effect<void, EditorNotReady>;

  // ===== History Operations =====
  /**
   * Undo last change.
   */
  readonly undo: Effect.Effect<boolean, EditorNotReady>;

  /**
   * Redo last undone change.
   */
  readonly redo: Effect.Effect<boolean, EditorNotReady>;

  // ===== Focus Operations =====
  /**
   * Focus the editor.
   */
  readonly focus: (position?: 'start' | 'end' | 'all' | number) => Effect.Effect<void, EditorNotReady>;

  /**
   * Blur the editor.
   */
  readonly blur: Effect.Effect<void, EditorNotReady>;

  // ===== Dirty State =====
  /**
   * Mark document as saved (clear dirty flag).
   */
  readonly markSaved: Effect.Effect<void>;

  /**
   * Check if document has unsaved changes.
   */
  readonly isDirty: Effect.Effect<boolean>;
}

// =============================================================================
// Errors
// =============================================================================

export class EditorNotReady extends Error {
  readonly _tag = 'EditorNotReady';

  constructor() {
    super('Editor is not initialized or has been destroyed');
  }
}

// =============================================================================
// Service Tag
// =============================================================================

export class EditorService extends Context.Tag('tmnl/editor/EditorService')<
  EditorService,
  EditorServiceShape
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const make: EditorServiceShape = {
  // ===== Editor Access =====
  getEditor: Effect.gen(function* () {
    const editor = yield* Effect.sync(() => Atom.get(editorInstanceAtom));
    const status = yield* Effect.sync(() => Atom.get(editorStatusAtom));

    if (!editor || status !== 'ready') {
      return yield* Effect.fail(new EditorNotReady());
    }

    return editor;
  }),

  // ===== Content Operations =====
  getContent: Effect.sync(() => {
    const content = Atom.get(documentContentAtom);
    return content ?? { type: 'doc', content: [] };
  }),

  setContent: (content) =>
    Effect.gen(function* () {
      const editor = yield* make.getEditor;
      yield* Effect.sync(() => {
        editor.commands.setContent(content);
      });
    }),

  getText: Effect.gen(function* () {
    const editor = yield* make.getEditor;
    return editor.getText();
  }),

  getHTML: Effect.gen(function* () {
    const editor = yield* make.getEditor;
    return editor.getHTML();
  }),

  // ===== Formatting Operations =====
  toggleMark: (mark) =>
    Effect.gen(function* () {
      const editor = yield* make.getEditor;
      yield* Effect.sync(() => {
        editor.chain().focus().toggleMark(mark).run();
      });
    }),

  isMarkActive: (mark) =>
    Effect.sync(() => {
      const marks = Atom.get(activeMarksAtom);
      return marks.has(mark);
    }),

  // ===== Selection Operations =====
  getSelection: Effect.sync(() => Atom.get(selectionAtom)),

  setSelection: (from, to) =>
    Effect.gen(function* () {
      const editor = yield* make.getEditor;
      yield* Effect.sync(() => {
        editor.commands.setTextSelection({ from, to: to ?? from });
      });
    }),

  selectAll: Effect.gen(function* () {
    const editor = yield* make.getEditor;
    yield* Effect.sync(() => {
      editor.commands.selectAll();
    });
  }),

  // ===== History Operations =====
  undo: Effect.gen(function* () {
    const editor = yield* make.getEditor;
    return editor.commands.undo();
  }),

  redo: Effect.gen(function* () {
    const editor = yield* make.getEditor;
    return editor.commands.redo();
  }),

  // ===== Focus Operations =====
  focus: (position) =>
    Effect.gen(function* () {
      const editor = yield* make.getEditor;
      yield* Effect.sync(() => {
        editor.commands.focus(position);
      });
    }),

  blur: Effect.gen(function* () {
    const editor = yield* make.getEditor;
    yield* Effect.sync(() => {
      editor.commands.blur();
    });
  }),

  // ===== Dirty State =====
  markSaved: Effect.sync(() => {
    Atom.set(isDirtyAtom, false);
  }),

  isDirty: Effect.sync(() => Atom.get(isDirtyAtom)),
};

// =============================================================================
// Layer
// =============================================================================

export const EditorServiceLive = Layer.succeed(EditorService, make);

export default EditorService;
