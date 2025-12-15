/**
 * TMNL Variables v2 — Variable Module
 *
 * Public API for defining and working with variables.
 * Analogous to Effect's Config module.
 *
 * @example
 * ```typescript
 * import { Variable } from '@/lib/variables/v2'
 *
 * // Define a variable (registered at load time)
 * const tabWidth = Variable.define({
 *   id: 'editor.tabWidth',
 *   schema: Schema.Number.pipe(Schema.int(), Schema.between(1, 16)),
 *   default: 4,
 *   description: 'Number of spaces per tab',
 * })
 *
 * // Access by string ID at runtime (no import needed)
 * const value = yield* Variable.get('editor.tabWidth')
 * // → Option.some(4)
 *
 * // With type assertion
 * const typed = yield* Variable.getAs('editor.tabWidth', Schema.Number)
 * // → Option.some(4) with type number
 * ```
 */

import { Effect, Option, Schema, pipe } from 'effect'
import { Atom } from '@effect-atom/atom'
import * as internal from './internal/core'
import * as scope from './internal/scope'

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports
// ─────────────────────────────────────────────────────────────────────────────

export {
  /** Variable TypeId symbol */
  VariableTypeId,
  /** Variable definition type */
  type VariableDef,
  /** Check if value is a VariableDef */
  isVariableDef,
  /** Variable errors */
  VariableMissingError,
  VariableValidationError,
  VariableOrError,
  type VariableError,
} from './internal/core'

export {
  /** Value source type */
  type ValueSource,
  /** Resolved value with provenance */
  type ResolvedValue,
  /** Workspace ID type */
  type WorkspaceId,
  /** Editor ID type */
  type EditorId,
} from './internal/scope'

// ─────────────────────────────────────────────────────────────────────────────
// Define API
// ─────────────────────────────────────────────────────────────────────────────

export interface DefineOptions<A> {
  /** Unique variable identifier (e.g., "editor.tabWidth") */
  readonly id: string
  /**
   * Explicit group for categorization.
   * If omitted, inferred from ID (first segment before dot, or entire ID if no dots).
   */
  readonly group?: string
  /** Effect Schema for value validation (supports Literal, String, Number, etc.) */
  readonly schema: Schema.Schema<any, any, never>
  /**
   * Default value, OR a function that computes from lower scope.
   *
   * @example
   * ```typescript
   * // Static default
   * default: 4
   *
   * // Computed default (defuFn style)
   * default: (lower) => lower * 2
   * ```
   */
  readonly default: A | ((lower: A) => A)
  /** Human-readable description */
  readonly description: string
}

/**
 * Define a variable with schema validation.
 * Automatically registered in the global registry.
 *
 * @example
 * ```typescript
 * const fontSize = Variable.define({
 *   id: 'editor.fontSize',
 *   schema: Schema.Number.pipe(Schema.between(8, 72)),
 *   default: 14,
 *   description: 'Font size in pixels',
 * })
 *
 * // With computed default
 * const lineHeight = Variable.define({
 *   id: 'editor.lineHeight',
 *   schema: Schema.Number,
 *   default: (fontSize) => fontSize * 1.5, // Based on lower scope
 *   description: 'Line height in pixels',
 * })
 * ```
 */
export const define = <A>(options: DefineOptions<A>): internal.VariableDef<A> => {
  const def = internal.makeVariableDef(options)
  return internal.registerVariable(def)
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Access API — The Key Feature
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a variable by string ID.
 * Returns Option.none() if not found.
 *
 * THIS IS THE RUNTIME ACCESS PATTERN — no import of the variable definition needed.
 *
 * @example
 * ```typescript
 * // In config.ts (loaded at startup)
 * Variable.define({ id: 'editor.tabWidth', ... })
 *
 * // Anywhere else (no import needed)
 * const tabWidth = yield* Variable.get('editor.tabWidth')
 * // → Option.some(4)
 * ```
 */
export const get = (id: string): Effect.Effect<Option.Option<unknown>> => {
  const provider = scope.createScopeChain()
  return internal.loadById(provider, id)
}

/**
 * Get a variable by string ID with type assertion.
 * Returns Option.none() if not found or wrong type.
 *
 * @example
 * ```typescript
 * const tabWidth = yield* Variable.getAs('editor.tabWidth', Schema.Number)
 * // → Option.some(4) with type number
 * ```
 */
export const getAs = <A>(
  id: string,
  schema: Schema.Schema<A, unknown>
): Effect.Effect<Option.Option<A>> => {
  const provider = scope.createScopeChain()
  return internal.loadByIdAs(provider, id, schema)
}

/**
 * Get a variable by string ID, throwing if not found.
 * Use Option-based `get()` for graceful handling.
 *
 * @example
 * ```typescript
 * const tabWidth = yield* Variable.getOrDie('editor.tabWidth')
 * ```
 */
export const getOrDie = (id: string): Effect.Effect<unknown, internal.VariableError> =>
  pipe(
    Effect.sync(() => internal.getVariableDefinition(id)),
    Effect.flatMap(
      Option.match({
        onNone: () =>
          Effect.fail(
            new internal.VariableMissingError({
              variableId: id,
              path: ['registry'],
            })
          ),
        onSome: (def) => {
          const provider = scope.createScopeChain()
          return provider.load(def)
        },
      })
    )
  )

/**
 * Get a variable with full resolution info (value + source + isModified).
 *
 * @example
 * ```typescript
 * const resolved = yield* Variable.resolve('editor.tabWidth')
 * // → { value: 4, source: 'user', isModified: true }
 * ```
 */
export const resolve = (
  id: string
): Effect.Effect<Option.Option<scope.ResolvedValue<unknown>>> =>
  pipe(
    Effect.sync(() => internal.getVariableDefinition(id)),
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.succeed(Option.none()),
        onSome: (def) =>
          pipe(
            scope.loadWithSource(def),
            Effect.map(Option.some),
            Effect.catchAll(() => Effect.succeed(Option.none()))
          ),
      })
    )
  )

// ─────────────────────────────────────────────────────────────────────────────
// Mutation API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set a variable value in the user scope.
 * Validates against the variable's schema.
 *
 * @example
 * ```typescript
 * yield* Variable.set('editor.tabWidth', 2)
 * ```
 */
export const set = (id: string, value: unknown): Effect.Effect<void, internal.VariableError> => {
  const maybeDef = internal.getVariableDefinition(id)
  if (Option.isNone(maybeDef)) {
    return Effect.fail(
      new internal.VariableMissingError({
        variableId: id,
        path: ['registry'],
      })
    )
  }
  const def = maybeDef.value

  // Validate against schema
  const decoded = Schema.decodeUnknownEither(def.schema)(value)
  if (decoded._tag === 'Left') {
    return Effect.fail(
      new internal.VariableValidationError({
        variableId: id,
        value,
        cause: decoded.left,
      })
    )
  }
  // Store in user scope
  scope.setUserValue(id, decoded.right)
  return Effect.void
}

/**
 * Reset a variable to its default value (remove user customization).
 *
 * @example
 * ```typescript
 * yield* Variable.reset('editor.tabWidth')
 * ```
 */
export const reset = (id: string): Effect.Effect<void> =>
  Effect.sync(() => scope.removeUserValue(id))

/**
 * Make a variable buffer-local (editor-scoped).
 * Copies current value to editor scope.
 *
 * @example
 * ```typescript
 * yield* Variable.makeLocal('editor.tabWidth')
 * ```
 */
export const makeLocal = (id: string): Effect.Effect<void, internal.VariableError> =>
  pipe(
    get(id),
    Effect.flatMap((maybeValue) => {
      if (Option.isNone(maybeValue)) {
        return Effect.fail(
          new internal.VariableMissingError({
            variableId: id,
            path: ['registry'],
          })
        )
      }
      const value = maybeValue.value
      const editorId = Atom.get(scope.currentEditorAtom)
      if (editorId) {
        scope.setEditorValue(editorId, id, value)
      }
      return Effect.void
    })
  )

// ─────────────────────────────────────────────────────────────────────────────
// Introspection API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get metadata for a variable definition.
 *
 * @example
 * ```typescript
 * const meta = Variable.describe('editor.tabWidth')
 * // → Option.some({ id: 'editor.tabWidth', description: '...', ... })
 * ```
 */
export const describe = (id: string): Option.Option<{
  readonly id: string
  readonly description: string
  readonly hasComputedDefault: boolean
}> =>
  pipe(
    internal.getVariableDefinition(id),
    Option.map((def) => ({
      id: def.id,
      description: def.description,
      hasComputedDefault: typeof def.default === 'function',
    }))
  )

/**
 * List all registered variable IDs.
 *
 * @example
 * ```typescript
 * const ids = Variable.list()
 * // → ['editor.tabWidth', 'editor.fontSize', ...]
 * ```
 */
export const list = (): ReadonlyArray<string> =>
  Array.from(internal.getAllVariableDefinitions().keys())

/**
 * List variables by group.
 * Uses explicit group field from definitions, not ID parsing.
 *
 * @example
 * ```typescript
 * const editorVars = Variable.listByGroup('editor')
 * // → ['editor.tabWidth', 'editor.fontSize', ...]
 * ```
 */
export const listByGroup = (group: string): ReadonlyArray<string> => {
  const allDefs = internal.getAllVariableDefinitions()
  const result: string[] = []
  for (const [id, def] of allDefs) {
    if (def.group === group) {
      result.push(id)
    }
  }
  return result
}

/**
 * Get unique groups from all registered variables.
 * Uses explicit group field from definitions, not ID parsing.
 *
 * @example
 * ```typescript
 * const groups = Variable.groups()
 * // → ['editor', 'appearance', 'keybindings']
 * ```
 */
export const groups = (): ReadonlyArray<string> => {
  const allDefs = internal.getAllVariableDefinitions()
  const allGroups = new Set<string>()
  for (const def of allDefs.values()) {
    allGroups.add(def.group)
  }
  return Array.from(allGroups).sort()
}

// ─────────────────────────────────────────────────────────────────────────────
// Testing Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clear the variable registry.
 * For testing only.
 */
export const clearRegistry = internal.clearRegistry
