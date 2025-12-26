/**
 * Editor Runtime Atoms
 *
 * Atom.runtime() for Effect service integration.
 * Operation atoms for editor mutations via runtimeAtom.fn<T>()().
 *
 * @module editor/v3/atoms/runtime
 */

import { Atom } from '@effect-atom/atom';
import { Effect, Layer } from 'effect';
import { EditorService, EditorServiceLive } from '../services';
import type { MarkType } from '../types';
import {
  isDirtyAtom,
  selectionAtom,
  activeMarksAtom,
  aiStatusAtom,
  aiSuggestionAtom,
} from './state';

// =============================================================================
// Runtime Atom
// =============================================================================

/**
 * Editor runtime atom providing Effect services to operation atoms.
 *
 * Usage:
 * ```tsx
 * import { editorRuntimeAtom, editorOps } from '@/lib/editor/v3'
 *
 * // In component
 * const result = useAtomValue(editorRuntimeAtom)
 *
 * // Trigger operations
 * await editorOps.toggleBold()
 * await editorOps.undo()
 * ```
 */
export const editorRuntimeAtom = Atom.runtime(
  Layer.mergeAll(EditorServiceLive)
);

// =============================================================================
// Operation Atoms
// =============================================================================

/**
 * Editor operations exposed as callable functions.
 * Each returns a Promise that resolves when the operation completes.
 */
export const editorOps = {
  // ===== Formatting =====

  /**
   * Toggle bold formatting.
   */
  toggleBold: editorRuntimeAtom.fn<void>()((_, _ctx) =>
    Effect.gen(function* () {
      const service = yield* EditorService;
      yield* service.toggleMark('bold');
    })
  ),

  /**
   * Toggle italic formatting.
   */
  toggleItalic: editorRuntimeAtom.fn<void>()((_, _ctx) =>
    Effect.gen(function* () {
      const service = yield* EditorService;
      yield* service.toggleMark('italic');
    })
  ),

  /**
   * Toggle underline formatting.
   */
  toggleUnderline: editorRuntimeAtom.fn<void>()((_, _ctx) =>
    Effect.gen(function* () {
      const service = yield* EditorService;
      yield* service.toggleMark('underline');
    })
  ),

  /**
   * Toggle strikethrough formatting.
   */
  toggleStrike: editorRuntimeAtom.fn<void>()((_, _ctx) =>
    Effect.gen(function* () {
      const service = yield* EditorService;
      yield* service.toggleMark('strike');
    })
  ),

  /**
   * Toggle code formatting.
   */
  toggleCode: editorRuntimeAtom.fn<void>()((_, _ctx) =>
    Effect.gen(function* () {
      const service = yield* EditorService;
      yield* service.toggleMark('code');
    })
  ),

  /**
   * Toggle any mark by type.
   */
  toggleMark: editorRuntimeAtom.fn<{ mark: MarkType }>()((args, _ctx) =>
    Effect.gen(function* () {
      const service = yield* EditorService;
      yield* service.toggleMark(args.mark);
    })
  ),

  // ===== History =====

  /**
   * Undo last change.
   */
  undo: editorRuntimeAtom.fn<void>()((_, _ctx) =>
    Effect.gen(function* () {
      const service = yield* EditorService;
      yield* service.undo;
    })
  ),

  /**
   * Redo last undone change.
   */
  redo: editorRuntimeAtom.fn<void>()((_, _ctx) =>
    Effect.gen(function* () {
      const service = yield* EditorService;
      yield* service.redo;
    })
  ),

  // ===== Focus =====

  /**
   * Focus the editor at a position.
   */
  focus: editorRuntimeAtom.fn<{ position?: 'start' | 'end' | 'all' | number }>()(
    (args, _ctx) =>
      Effect.gen(function* () {
        const service = yield* EditorService;
        yield* service.focus(args.position);
      })
  ),

  /**
   * Blur the editor.
   */
  blur: editorRuntimeAtom.fn<void>()((_, _ctx) =>
    Effect.gen(function* () {
      const service = yield* EditorService;
      yield* service.blur;
    })
  ),

  // ===== Selection =====

  /**
   * Select all content.
   */
  selectAll: editorRuntimeAtom.fn<void>()((_, _ctx) =>
    Effect.gen(function* () {
      const service = yield* EditorService;
      yield* service.selectAll;
    })
  ),

  /**
   * Set selection by position.
   */
  setSelection: editorRuntimeAtom.fn<{ from: number; to?: number }>()(
    (args, _ctx) =>
      Effect.gen(function* () {
        const service = yield* EditorService;
        yield* service.setSelection(args.from, args.to);
      })
  ),

  // ===== Document State =====

  /**
   * Mark document as saved (clear dirty flag).
   */
  markSaved: editorRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.gen(function* () {
      const service = yield* EditorService;
      yield* service.markSaved;
      ctx.set(isDirtyAtom, false);
    })
  ),

  // ===== Content =====

  /**
   * Get document content as JSON.
   */
  getContent: editorRuntimeAtom.fn<void>()((_, _ctx) =>
    Effect.gen(function* () {
      const service = yield* EditorService;
      return yield* service.getContent;
    })
  ),

  /**
   * Get document as plain text.
   */
  getText: editorRuntimeAtom.fn<void>()((_, _ctx) =>
    Effect.gen(function* () {
      const service = yield* EditorService;
      return yield* service.getText;
    })
  ),

  /**
   * Get document as HTML.
   */
  getHTML: editorRuntimeAtom.fn<void>()((_, _ctx) =>
    Effect.gen(function* () {
      const service = yield* EditorService;
      return yield* service.getHTML;
    })
  ),
};

// =============================================================================
// State Query Atoms
// =============================================================================

/**
 * Query atoms that derive values from the runtime.
 * These are for use with useAtomValue() when you need service-derived state.
 */
export const editorQueries = {
  /**
   * Is the current mark active?
   */
  isMarkActive: (mark: MarkType) =>
    Atom.make((get) => {
      const marks = get(activeMarksAtom);
      return marks.has(mark);
    }),

  /**
   * Current selection info.
   */
  selection: selectionAtom,

  /**
   * AI status.
   */
  aiStatus: aiStatusAtom,

  /**
   * AI suggestion text.
   */
  aiSuggestion: aiSuggestionAtom,
};
