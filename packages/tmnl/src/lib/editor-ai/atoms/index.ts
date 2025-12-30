/**
 * EditorAI Atoms
 *
 * effect-atom bindings for EditorAI services.
 * Provides reactive state for React components.
 *
 * Pattern: Atom-as-State
 * - Simple Atom.make() for state
 * - runtimeAtom.fn() for operations that update state via ctx.set()
 *
 * @module editor-ai/atoms
 */

import { Atom } from '@effect-atom/atom-react'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Stream from 'effect/Stream'
import * as Option from 'effect/Option'
import { EditorRegistry, EditorRegistryLive } from '../services/EditorRegistry'
import {
  EditorAIBridge,
  EditorAIBridgeLive,
} from '../services/EditorAIBridge'
import { KnowledgeService, KnowledgeServiceLive } from '../services/KnowledgeService'
import type { EditorId, InsertionResult } from '../schemas/editor'
import type { AIContext } from '../schemas/operations'
import type { AIStreamError } from '../schemas/errors'

// -----------------------------------------------------------------------------
// State Atoms (Module-Level Singletons)
// -----------------------------------------------------------------------------

/**
 * Registered editor IDs.
 */
export const registeredEditorsAtom = Atom.make<readonly EditorId[]>([])

/**
 * Currently focused editor ID.
 */
export const focusedEditorAtom = Atom.make<Option.Option<EditorId>>(Option.none())

/**
 * Number of registered editors.
 */
export const editorCountAtom = Atom.make<number>(0)

/**
 * Last AI context gathered from focused editor.
 */
export const lastContextAtom = Atom.make<AIContext | null>(null)

/**
 * Streaming insertion state.
 */
export const isStreamingAtom = Atom.make<boolean>(false)

/**
 * Last insertion result.
 */
export const lastInsertionResultAtom = Atom.make<InsertionResult | null>(null)

// -----------------------------------------------------------------------------
// Derived Atoms
// -----------------------------------------------------------------------------

/**
 * Whether any editor is focused.
 */
export const hasEditorFocusedAtom = Atom.make((get) => {
  const focused = get(focusedEditorAtom)
  return Option.isSome(focused)
})

/**
 * Whether any editors are registered.
 */
export const hasEditorsAtom = Atom.make((get) => {
  const count = get(editorCountAtom)
  return count > 0
})

// -----------------------------------------------------------------------------
// Atom Family: Per-Editor State
// -----------------------------------------------------------------------------

/**
 * Check if a specific editor is registered.
 */
export const isEditorRegisteredAtom = Atom.family((editorId: EditorId) =>
  Atom.make((get) => {
    const editors = get(registeredEditorsAtom)
    return editors.includes(editorId)
  })
)

/**
 * Check if a specific editor is focused.
 */
export const isEditorFocusedAtom = Atom.family((editorId: EditorId) =>
  Atom.make((get) => {
    const focused = get(focusedEditorAtom)
    return Option.isSome(focused) && focused.value === editorId
  })
)

// -----------------------------------------------------------------------------
// Runtime Atom
// -----------------------------------------------------------------------------

/**
 * EditorAI runtime combining all service layers.
 */
export const editorAIRuntimeAtom = Atom.runtime(
  Layer.mergeAll(
    EditorRegistryLive,
    Layer.provideMerge(EditorAIBridgeLive, EditorRegistryLive),
    KnowledgeServiceLive
  )
)

// -----------------------------------------------------------------------------
// Operation Atoms
// Using Effect.flatMap chains for better type inference
// -----------------------------------------------------------------------------

/**
 * Focus a specific editor.
 */
export const focusEditorOp = editorAIRuntimeAtom.fn<{ editorId: EditorId }>()(
  ({ editorId }, ctx) =>
    EditorAIBridge.pipe(
      Effect.flatMap((bridge) => bridge.focusEditor(editorId)),
      Effect.flatMap(() => EditorRegistry),
      Effect.flatMap((registry) =>
        Effect.all([registry.getAllEditors, registry.getFocusedEditor])
      ),
      Effect.tap(([editors, focused]) =>
        Effect.sync(() => {
          ctx.set(registeredEditorsAtom, editors)
          ctx.set(focusedEditorAtom, focused)
          ctx.set(editorCountAtom, editors.length)
        })
      ),
      Effect.asVoid
    )
)

/**
 * Refresh editor list from registry.
 */
export const refreshEditorsOp = editorAIRuntimeAtom.fn<void>()((_args, ctx) =>
  EditorRegistry.pipe(
    Effect.flatMap((registry) =>
      Effect.all([registry.getAllEditors, registry.getFocusedEditor])
    ),
    Effect.tap(([editors, focused]) =>
      Effect.sync(() => {
        ctx.set(registeredEditorsAtom, editors)
        ctx.set(focusedEditorAtom, focused)
        ctx.set(editorCountAtom, editors.length)
      })
    ),
    Effect.asVoid
  )
)

/**
 * Insert text at cursor in focused editor.
 */
export const insertTextOp = editorAIRuntimeAtom.fn<{ content: string }>()(
  ({ content }, _ctx) =>
    EditorAIBridge.pipe(
      Effect.flatMap((bridge) => bridge.insertText(content)),
      Effect.map((charsInserted) => ({ charsInserted }))
    )
)

/**
 * Replace selection in focused editor.
 */
export const replaceSelectionOp = editorAIRuntimeAtom.fn<{ content: string }>()(
  ({ content }, _ctx) =>
    EditorAIBridge.pipe(
      Effect.flatMap((bridge) => bridge.replaceSelection(content))
    )
)

/**
 * Get selection from focused editor.
 */
export const getSelectionOp = editorAIRuntimeAtom.fn<void>()((_args, _ctx) =>
  EditorAIBridge.pipe(Effect.flatMap((bridge) => bridge.getSelection))
)

/**
 * Get selected text from focused editor.
 */
export const getSelectedTextOp = editorAIRuntimeAtom.fn<void>()((_args, _ctx) =>
  EditorAIBridge.pipe(Effect.flatMap((bridge) => bridge.getSelectedText))
)

/**
 * Get AI context from focused editor.
 * Note: Does not update lastContextAtom - use the returned value directly.
 */
export const getContextOp = editorAIRuntimeAtom.fn<void>()((_args, _ctx) =>
  EditorAIBridge.pipe(Effect.flatMap((bridge) => bridge.getContext))
)

/**
 * Stream text insertion into focused editor.
 * Note: Returns InsertionResult directly - use the returned value.
 */
export const streamInsertOp = editorAIRuntimeAtom.fn<{
  stream: Stream.Stream<string, AIStreamError>
}>()(({ stream }, ctx) =>
  Effect.sync(() => ctx.set(isStreamingAtom, true)).pipe(
    Effect.flatMap(() => EditorAIBridge),
    Effect.flatMap((bridge) => bridge.streamInsert(stream)),
    Effect.tap(() =>
      Effect.sync(() => {
        ctx.set(isStreamingAtom, false)
      })
    ),
    Effect.tapError(() =>
      Effect.sync(() => {
        ctx.set(isStreamingAtom, false)
      })
    )
  )
)

/**
 * Create insertion handle for controlled streaming.
 */
export const createInsertionHandleOp = editorAIRuntimeAtom.fn<void>()(
  (_args, ctx) =>
    Effect.sync(() => ctx.set(isStreamingAtom, true)).pipe(
      Effect.flatMap(() => EditorAIBridge),
      Effect.flatMap((bridge) => bridge.createInsertionHandle)
    )
)

// -----------------------------------------------------------------------------
// Convenience Export
// -----------------------------------------------------------------------------

export const editorAIOps = {
  focusEditor: focusEditorOp,
  refreshEditors: refreshEditorsOp,
  insertText: insertTextOp,
  replaceSelection: replaceSelectionOp,
  getSelection: getSelectionOp,
  getSelectedText: getSelectedTextOp,
  getContext: getContextOp,
  streamInsert: streamInsertOp,
  createInsertionHandle: createInsertionHandleOp,
}
