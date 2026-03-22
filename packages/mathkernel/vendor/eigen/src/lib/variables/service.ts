/**
 * TMNL Variables — Variable Service
 *
 * Effect.Service for variable operations.
 * Provides get, set, describe, and list operations with proper error handling.
 */

import { Effect, Context, Layer, Schema, Option } from 'effect'
import { Atom } from '@effect-atom/atom'
import type {
  VariableId,
  VariableDefinition,
  VariableMetadata,
  ResolvedValue,
  VariableScope,
  ValueSource,
  WorkspaceId,
  EditorId,
} from './types'
import {
  VariableNotFoundError,
  VariableValidationError,
  VariableSetterError,
} from './types'
import {
  getRegisteredVariables,
  getVariableDefinition,
  getVariableMetadata,
  getAllVariableMetadata,
  getVariableMetadataByGroup,
  getVariableGroups,
} from './define'
import {
  userValuesAtom,
  currentWorkspaceIdAtom,
  currentEditorIdAtom,
  setUserValue,
  removeUserValue,
  setWorkspaceValue,
  removeWorkspaceValue,
  setEditorValue,
  removeEditorValue,
  resolveValue,
  emitVariableChange,
} from './atoms'

// ─────────────────────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Variable service operations.
 */
export interface VariableServiceImpl {
  /**
   * Get a variable's current value with scope resolution.
   */
  readonly get: <A>(
    variableId: string
  ) => Effect.Effect<ResolvedValue<A>, VariableNotFoundError>

  /**
   * Set a variable's value.
   * Validates against schema and calls custom setter if defined.
   */
  readonly set: <A>(
    variableId: string,
    value: A
  ) => Effect.Effect<void, VariableNotFoundError | VariableValidationError | VariableSetterError>

  /**
   * Set the default (global) value only.
   * Does not affect workspace/editor overrides.
   */
  readonly setDefault: <A>(
    variableId: string,
    value: A
  ) => Effect.Effect<void, VariableNotFoundError | VariableValidationError | VariableSetterError>

  /**
   * Create an editor-local binding for a variable.
   * Future sets in this editor will be local.
   */
  readonly makeLocal: (
    variableId: string
  ) => Effect.Effect<void, VariableNotFoundError>

  /**
   * Remove the current scope's override (revert to next level).
   */
  readonly reset: (
    variableId: string
  ) => Effect.Effect<void, VariableNotFoundError>

  /**
   * Get metadata about a variable.
   */
  readonly describe: (
    variableId: string
  ) => Effect.Effect<VariableMetadata, VariableNotFoundError>

  /**
   * List all registered variables.
   */
  readonly list: (group?: string) => Effect.Effect<readonly VariableMetadata[]>

  /**
   * Get all variable groups.
   */
  readonly groups: () => Effect.Effect<readonly string[]>
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * VariableService — Effect.Service for variable operations.
 */
export class VariableService extends Context.Tag('tmnl/variables/VariableService')<
  VariableService,
  VariableServiceImpl
>() {
  /**
   * Default implementation.
   */
  static Default = Layer.succeed(
    this,
    VariableService.of({
      // ───────────────────────────────────────────────────────────────────────
      // get
      // ───────────────────────────────────────────────────────────────────────
      get: <A>(variableId: string) =>
        Effect.gen(function* () {
          const definition = getVariableDefinition(variableId)
          if (!definition) {
            return yield* Effect.fail(new VariableNotFoundError({ variableId }))
          }

          const resolved = resolveValue(variableId, definition.default, definition.scope)

          return {
            value: resolved.value as A,
            source: resolved.source,
            isModified: resolved.source !== 'default',
          } as ResolvedValue<A>
        }),

      // ───────────────────────────────────────────────────────────────────────
      // set
      // ───────────────────────────────────────────────────────────────────────
      set: <A>(variableId: string, value: A) =>
        Effect.gen(function* () {
          const definition = getVariableDefinition(variableId)
          if (!definition) {
            return yield* Effect.fail(new VariableNotFoundError({ variableId }))
          }

          // Validate against schema
          const decodeResult = Schema.decodeUnknownEither(definition.schema)(value)
          if (decodeResult._tag === 'Left') {
            return yield* Effect.fail(
              new VariableValidationError({
                variableId,
                value,
                cause: decodeResult.left,
              })
            )
          }

          // Get old value for change event
          const oldResolved = resolveValue(variableId, definition.default, definition.scope)
          const oldValue = oldResolved.value

          // Call custom setter if defined
          if (definition.setter) {
            yield* (definition.setter as (v: unknown) => Effect.Effect<void, VariableSetterError>)(
              value
            )
          }

          // Determine where to store based on scope and current context
          const scope = definition.scope
          const editorId = Atom.get(currentEditorIdAtom)
          const workspaceId = Atom.get(currentWorkspaceIdAtom)

          let source: ValueSource = 'user'

          if (scope === 'editor' && editorId) {
            // Store in editor-local
            setEditorValue(editorId, variableId, value)
            source = 'editor'
          } else if (scope === 'workspace' && workspaceId) {
            // Store in workspace
            setWorkspaceValue(workspaceId, variableId, value)
            source = 'workspace'
          } else {
            // Store as user customization
            setUserValue(variableId, value)
            source = 'user'
          }

          // Emit change event
          emitVariableChange({
            variableId,
            oldValue,
            newValue: value,
            source,
            timestamp: new Date(),
          })
        }),

      // ───────────────────────────────────────────────────────────────────────
      // setDefault
      // ───────────────────────────────────────────────────────────────────────
      setDefault: <A>(variableId: string, value: A) =>
        Effect.gen(function* () {
          const definition = getVariableDefinition(variableId)
          if (!definition) {
            return yield* Effect.fail(new VariableNotFoundError({ variableId }))
          }

          // Validate against schema
          const decodeResult = Schema.decodeUnknownEither(definition.schema)(value)
          if (decodeResult._tag === 'Left') {
            return yield* Effect.fail(
              new VariableValidationError({
                variableId,
                value,
                cause: decodeResult.left,
              })
            )
          }

          // Get old value for change event
          const userValues = Atom.get(userValuesAtom)
          const oldStored = userValues.get(variableId)
          const oldValue = oldStored?.value ?? definition.default

          // Call custom setter if defined
          if (definition.setter) {
            yield* (definition.setter as (v: unknown) => Effect.Effect<void, VariableSetterError>)(
              value
            )
          }

          // Store as user customization (global level)
          setUserValue(variableId, value)

          // Emit change event
          emitVariableChange({
            variableId,
            oldValue,
            newValue: value,
            source: 'user',
            timestamp: new Date(),
          })
        }),

      // ───────────────────────────────────────────────────────────────────────
      // makeLocal
      // ───────────────────────────────────────────────────────────────────────
      makeLocal: (variableId: string) =>
        Effect.gen(function* () {
          const definition = getVariableDefinition(variableId)
          if (!definition) {
            return yield* Effect.fail(new VariableNotFoundError({ variableId }))
          }

          const editorId = Atom.get(currentEditorIdAtom)
          if (!editorId) {
            // No editor context — nothing to do
            return
          }

          // Copy current value to editor-local
          const resolved = resolveValue(variableId, definition.default, definition.scope)
          setEditorValue(editorId, variableId, resolved.value)
        }),

      // ───────────────────────────────────────────────────────────────────────
      // reset
      // ───────────────────────────────────────────────────────────────────────
      reset: (variableId: string) =>
        Effect.gen(function* () {
          const definition = getVariableDefinition(variableId)
          if (!definition) {
            return yield* Effect.fail(new VariableNotFoundError({ variableId }))
          }

          const editorId = Atom.get(currentEditorIdAtom)
          const workspaceId = Atom.get(currentWorkspaceIdAtom)

          // Get old value for change event
          const oldResolved = resolveValue(variableId, definition.default, definition.scope)
          const oldValue = oldResolved.value
          const oldSource = oldResolved.source

          // Remove from most specific scope first
          if (oldSource === 'editor' && editorId) {
            removeEditorValue(editorId, variableId)
          } else if (oldSource === 'workspace' && workspaceId) {
            removeWorkspaceValue(workspaceId, variableId)
          } else if (oldSource === 'user') {
            removeUserValue(variableId)
          }

          // Get new value after reset
          const newResolved = resolveValue(variableId, definition.default, definition.scope)

          // Call setter with new value if defined
          if (definition.setter) {
            yield* (definition.setter as (v: unknown) => Effect.Effect<void, VariableSetterError>)(
              newResolved.value
            ).pipe(Effect.catchAll(() => Effect.void))
          }

          // Emit change event
          emitVariableChange({
            variableId,
            oldValue,
            newValue: newResolved.value,
            source: newResolved.source,
            timestamp: new Date(),
          })
        }),

      // ───────────────────────────────────────────────────────────────────────
      // describe
      // ───────────────────────────────────────────────────────────────────────
      describe: (variableId: string) =>
        Effect.gen(function* () {
          const definition = getVariableDefinition(variableId)
          if (!definition) {
            return yield* Effect.fail(new VariableNotFoundError({ variableId }))
          }
          return getVariableMetadata(definition)
        }),

      // ───────────────────────────────────────────────────────────────────────
      // list
      // ───────────────────────────────────────────────────────────────────────
      list: (group?: string) =>
        Effect.sync(() => {
          if (group) {
            return getVariableMetadataByGroup(group)
          }
          return getAllVariableMetadata()
        }),

      // ───────────────────────────────────────────────────────────────────────
      // groups
      // ───────────────────────────────────────────────────────────────────────
      groups: () => Effect.sync(() => getVariableGroups()),
    })
  )
}
