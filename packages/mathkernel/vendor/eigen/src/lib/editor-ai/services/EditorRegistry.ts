/**
 * EditorRegistry Service
 *
 * Tracks all registered editors and manages focus state.
 * Enables AI agents to discover and target specific editors.
 *
 * @module editor-ai/services/EditorRegistry
 */

import { Context, Effect, Layer, Ref, Option, HashMap } from 'effect'
import type { EditorId } from '../schemas/editor'
import { EditorNotFoundError, makeEditorNotFoundError } from '../schemas/errors'
import type { EditorOperationsShape } from './EditorOperations'
import { AIService } from '../decorators'

// -----------------------------------------------------------------------------
// EditorRegistry Shape
// -----------------------------------------------------------------------------

/**
 * Registry for tracking editor instances and focus state.
 */
export interface EditorRegistryShape {
  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /**
   * Register an editor with the registry.
   * Called by withEditorAI HOC on mount.
   */
  readonly register: (
    id: EditorId,
    operations: EditorOperationsShape
  ) => Effect.Effect<void>

  /**
   * Unregister an editor from the registry.
   * Called by withEditorAI HOC on unmount.
   */
  readonly unregister: (id: EditorId) => Effect.Effect<void>

  // ---------------------------------------------------------------------------
  // Discovery
  // ---------------------------------------------------------------------------

  /**
   * Get editor operations by ID.
   * Fails with EditorNotFoundError if not registered.
   */
  readonly getEditor: (
    id: EditorId
  ) => Effect.Effect<EditorOperationsShape, EditorNotFoundError>

  /**
   * Get all registered editor IDs.
   */
  readonly getAllEditors: Effect.Effect<readonly EditorId[]>

  /**
   * Get editor count.
   */
  readonly getEditorCount: Effect.Effect<number>

  /**
   * Check if an editor is registered.
   */
  readonly hasEditor: (id: EditorId) => Effect.Effect<boolean>

  // ---------------------------------------------------------------------------
  // Focus Management
  // ---------------------------------------------------------------------------

  /**
   * Get currently focused editor ID.
   * Returns None if no editor is focused.
   */
  readonly getFocusedEditor: Effect.Effect<Option.Option<EditorId>>

  /**
   * Set the focused editor.
   * Pass None to clear focus.
   */
  readonly setFocusedEditor: (
    id: Option.Option<EditorId>
  ) => Effect.Effect<void>

  /**
   * Get focused editor operations.
   * Fails if no editor is focused or focused editor not found.
   */
  readonly getFocusedOperations: Effect.Effect<
    EditorOperationsShape,
    EditorNotFoundError
  >
}

// -----------------------------------------------------------------------------
// EditorRegistry Service Tag
// -----------------------------------------------------------------------------

@AIService({
  description: 'Registry for tracking editor instances and focus state',
  capabilities: [
    'editor registration/unregistration',
    'editor discovery by ID',
    'focus state management',
    'list all editors',
  ],
})
export class EditorRegistry extends Context.Tag('tmnl/EditorRegistry')<
  EditorRegistry,
  EditorRegistryShape
>() {}

// -----------------------------------------------------------------------------
// Live Implementation
// -----------------------------------------------------------------------------

/**
 * Create EditorRegistry.Live layer.
 * Uses Effect.Do for better type inference.
 */
export const EditorRegistryLive: Layer.Layer<EditorRegistry> = Layer.effect(
  EditorRegistry,
  Effect.Do.pipe(
    Effect.bind('editorsRef', () =>
      Ref.make<HashMap.HashMap<EditorId, EditorOperationsShape>>(HashMap.empty())
    ),
    Effect.bind('focusedRef', () =>
      Ref.make<Option.Option<EditorId>>(Option.none())
    ),
    Effect.map(({ editorsRef, focusedRef }) =>
      EditorRegistry.of({
        // -----------------------------------------------------------------------
        // Registration
        // -----------------------------------------------------------------------

        register: (id, operations) =>
          Ref.update(editorsRef, HashMap.set(id, operations)).pipe(
            Effect.tap(() =>
              Effect.logDebug(`EditorRegistry: registered ${id}`)
            )
          ),

        unregister: (id) =>
          Ref.update(editorsRef, HashMap.remove(id)).pipe(
            Effect.flatMap(() => Ref.get(focusedRef)),
            Effect.flatMap((focused) =>
              Option.isSome(focused) && focused.value === id
                ? Ref.set(focusedRef, Option.none())
                : Effect.void
            ),
            Effect.tap(() =>
              Effect.logDebug(`EditorRegistry: unregistered ${id}`)
            )
          ),

        // -----------------------------------------------------------------------
        // Discovery
        // -----------------------------------------------------------------------

        getEditor: (id) =>
          Ref.get(editorsRef).pipe(
            Effect.flatMap((editors) => {
              const maybeEditor = HashMap.get(editors, id)
              return Option.isSome(maybeEditor)
                ? Effect.succeed(maybeEditor.value)
                : Effect.fail(makeEditorNotFoundError(id))
            })
          ),

        getAllEditors: Ref.get(editorsRef).pipe(
          Effect.map((editors) => Array.from(HashMap.keys(editors)))
        ),

        getEditorCount: Ref.get(editorsRef).pipe(Effect.map(HashMap.size)),

        hasEditor: (id) =>
          Ref.get(editorsRef).pipe(Effect.map((e) => HashMap.has(e, id))),

        // -----------------------------------------------------------------------
        // Focus Management
        // -----------------------------------------------------------------------

        getFocusedEditor: Ref.get(focusedRef),

        setFocusedEditor: (id) =>
          Ref.set(focusedRef, id).pipe(
            Effect.tap(() =>
              Effect.logDebug(
                `EditorRegistry: focus set to ${Option.isSome(id) ? id.value : 'none'}`
              )
            )
          ),

        getFocusedOperations: Ref.get(focusedRef).pipe(
          Effect.flatMap((focusedId) =>
            Option.isNone(focusedId)
              ? Effect.fail(makeEditorNotFoundError('(no editor focused)' as EditorId))
              : Ref.get(editorsRef).pipe(
                  Effect.flatMap((editors) => {
                    const maybeEditor = HashMap.get(editors, focusedId.value)
                    return Option.isSome(maybeEditor)
                      ? Effect.succeed(maybeEditor.value)
                      : Effect.fail(makeEditorNotFoundError(focusedId.value))
                  })
                )
          )
        ),
      })
    )
  )
)
