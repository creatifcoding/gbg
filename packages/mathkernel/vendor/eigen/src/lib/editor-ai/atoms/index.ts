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
import { ReconcilerServiceLive } from '../services/ReconcilerService'
import { KnowledgeService, KnowledgeServiceLive } from '../services/KnowledgeService'
import type { EditorId, InsertionResult } from '../schemas/editor'
import type { AIContext } from '../schemas/operations'
import type { AIStreamError } from '../schemas/errors'
import type { EditorOperationsShape } from '../services/EditorOperations'

// -----------------------------------------------------------------------------
// State Atoms (Module-Level Singletons)
// -----------------------------------------------------------------------------
// CRITICAL: Use Atom.keepAlive to prevent reset when subscribers unmount.
// Without keepAlive, React Strict Mode's unmount/remount cycle causes atoms
// to reset to their initial values, losing registered editor state.

/**
 * Registered editor IDs.
 */
export const registeredEditorsAtom = Atom.make<readonly EditorId[]>([]).pipe(
  Atom.keepAlive
)

/**
 * Currently focused editor ID.
 */
export const focusedEditorAtom = Atom.make<Option.Option<EditorId>>(
  Option.none()
).pipe(Atom.keepAlive)

/**
 * Number of registered editors.
 */
export const editorCountAtom = Atom.make<number>(0).pipe(Atom.keepAlive)

/**
 * Last AI context gathered from focused editor.
 */
export const lastContextAtom = Atom.make<AIContext | null>(null).pipe(
  Atom.keepAlive
)

/**
 * Streaming insertion state.
 */
export const isStreamingAtom = Atom.make<boolean>(false).pipe(Atom.keepAlive)

/**
 * Last insertion result.
 */
export const lastInsertionResultAtom = Atom.make<InsertionResult | null>(
  null
).pipe(Atom.keepAlive)

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
 *
 * CRITICAL: Layer composition must avoid duplicate service instantiation.
 * EditorAIBridgeLive depends on EditorRegistry + ReconcilerService.
 * We use Layer.provideMerge to wire dependencies from a SINGLE base layer.
 */
const editorAIBaseLayer = Layer.mergeAll(EditorRegistryLive, ReconcilerServiceLive)

export const editorAIRuntimeAtom = Atom.runtime(
  Layer.provideMerge(
    Layer.mergeAll(EditorAIBridgeLive, KnowledgeServiceLive),
    editorAIBaseLayer
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
// Registration Operations
// These bridge React components to the Effect service layer
// -----------------------------------------------------------------------------

/**
 * Register an editor with the EditorRegistry service.
 * Called when an editor component mounts and has an instance ready.
 *
 * Updates atoms to reflect new registration state.
 */
export const registerEditorOp = editorAIRuntimeAtom.fn<{
  id: EditorId
  operations: EditorOperationsShape
}>()(({ id, operations }, ctx) =>
  EditorRegistry.pipe(
    Effect.flatMap((registry) => registry.register(id, operations)),
    Effect.flatMap(() => EditorRegistry),
    Effect.flatMap((registry) =>
      Effect.all({
        editors: registry.getAllEditors,
        focused: registry.getFocusedEditor,
      })
    ),
    Effect.tap(({ editors, focused }) =>
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
 * Unregister an editor from the EditorRegistry service.
 * Called when an editor component unmounts.
 *
 * Updates atoms to reflect removal. Clears focus if this was the focused editor.
 */
export const unregisterEditorOp = editorAIRuntimeAtom.fn<{ id: EditorId }>()(
  ({ id }, ctx) =>
    EditorRegistry.pipe(
      Effect.flatMap((registry) => registry.unregister(id)),
      Effect.flatMap(() => EditorRegistry),
      Effect.flatMap((registry) =>
        Effect.all({
          editors: registry.getAllEditors,
          focused: registry.getFocusedEditor,
        })
      ),
      Effect.tap(({ editors, focused }) =>
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
 * Set the focused editor by ID.
 * Pass null to clear focus.
 *
 * Updates focusedEditorAtom to reflect new focus state.
 */
export const setFocusedEditorOp = editorAIRuntimeAtom.fn<{
  id: EditorId | null
}>()(({ id }, ctx) =>
  EditorRegistry.pipe(
    Effect.flatMap((registry) =>
      registry.setFocusedEditor(id ? Option.some(id) : Option.none())
    ),
    Effect.tap(() =>
      Effect.sync(() => {
        ctx.set(focusedEditorAtom, id ? Option.some(id) : Option.none())
      })
    ),
    Effect.asVoid
  )
)

/**
 * Get the EditorOperationsShape for a specific editor.
 * Returns the operations interface for direct manipulation.
 */
export const getEditorOperationsOp = editorAIRuntimeAtom.fn<{ id: EditorId }>()(
  ({ id }, _ctx) =>
    EditorRegistry.pipe(Effect.flatMap((registry) => registry.getEditor(id)))
)

/**
 * Get the focused editor's operations.
 * Fails if no editor is focused.
 */
export const getFocusedEditorOperationsOp = editorAIRuntimeAtom.fn<void>()(
  (_args, _ctx) =>
    EditorRegistry.pipe(
      Effect.flatMap((registry) => registry.getFocusedOperations)
    )
)

// -----------------------------------------------------------------------------
// Convenience Export
// -----------------------------------------------------------------------------

export const editorAIOps = {
  // Registration (React → Effect bridge)
  registerEditor: registerEditorOp,
  unregisterEditor: unregisterEditorOp,
  setFocusedEditor: setFocusedEditorOp,
  getEditorOperations: getEditorOperationsOp,
  getFocusedEditorOperations: getFocusedEditorOperationsOp,

  // Focus (legacy, uses Bridge)
  focusEditor: focusEditorOp,
  refreshEditors: refreshEditorsOp,

  // Content operations
  insertText: insertTextOp,
  replaceSelection: replaceSelectionOp,
  getSelection: getSelectionOp,
  getSelectedText: getSelectedTextOp,
  getContext: getContextOp,
  streamInsert: streamInsertOp,
  createInsertionHandle: createInsertionHandleOp,
}
