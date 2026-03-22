/**
 * TMNL Variables v2 — Internal Core
 *
 * Internal implementation following Effect's module structure pattern.
 * Symbol keys, TypeIds, and core primitives.
 */

import { Effect, Option, Schema, Data, Either, pipe } from 'effect'
import { defuFn, createDefu } from 'defu'

// ─────────────────────────────────────────────────────────────────────────────
// Symbol Keys & Type IDs
// ─────────────────────────────────────────────────────────────────────────────

const VariableSymbolKey = 'tmnl/Variable'
const VariableProviderSymbolKey = 'tmnl/VariableProvider'
const VariableRegistrySymbolKey = 'tmnl/VariableRegistry'

/** @internal */
export const VariableTypeId: unique symbol = Symbol.for(VariableSymbolKey)
/** @internal */
export type VariableTypeId = typeof VariableTypeId

/** @internal */
export const VariableProviderTypeId: unique symbol = Symbol.for(VariableProviderSymbolKey)
/** @internal */
export type VariableProviderTypeId = typeof VariableProviderTypeId

/** @internal */
export const VariableRegistryTypeId: unique symbol = Symbol.for(VariableRegistrySymbolKey)
/** @internal */
export type VariableRegistryTypeId = typeof VariableRegistryTypeId

// ─────────────────────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────────────────────

/** Variable not found in any provider */
export class VariableMissingError extends Data.TaggedError('VariableMissingError')<{
  readonly variableId: string
  readonly path: ReadonlyArray<string>
}> {}

/** Variable validation failed */
export class VariableValidationError extends Data.TaggedError('VariableValidationError')<{
  readonly variableId: string
  readonly value: unknown
  readonly cause: unknown
}> {}

/** Combined error from multiple providers */
export class VariableOrError extends Data.TaggedError('VariableOrError')<{
  readonly left: VariableError
  readonly right: VariableError
}> {}

/** Union of all variable errors */
export type VariableError = VariableMissingError | VariableValidationError | VariableOrError

/** Check if error is missing data only (for Option wrapping) */
export const isMissingDataOnly = (error: VariableError): boolean => {
  switch (error._tag) {
    case 'VariableMissingError':
      return true
    case 'VariableOrError':
      return isMissingDataOnly(error.left) && isMissingDataOnly(error.right)
    case 'VariableValidationError':
      return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Variable Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Variable definition — describes what a variable looks like.
 * Analogous to Effect's Config type.
 */
export interface VariableDef<A = unknown> {
  readonly [VariableTypeId]: VariableTypeId
  readonly _tag: string
  readonly id: string
  /** Explicit group for categorization (no inference from ID) */
  readonly group: string
  /** Schema for validation - permissive type to allow Literal, String, etc. */
  readonly schema: Schema.Schema<any, any, never>
  readonly description: string
  /** Default value OR function that computes default from lower scope */
  readonly default: A | ((lower: A) => A)
}

/** @internal */
export interface VariableDefProto {
  readonly [VariableTypeId]: VariableTypeId
}

const variableDefProto: VariableDefProto = {
  [VariableTypeId]: VariableTypeId,
}

/** @internal */
export const makeVariableDef = <A>(options: {
  readonly id: string
  readonly group?: string
  readonly schema: Schema.Schema<any, any, never>
  readonly description: string
  readonly default: A | ((lower: A) => A)
}): VariableDef<A> => {
  const def = Object.create(variableDefProto)
  def._tag = 'VariableDef'
  def.id = options.id
  // Explicit group, or robust fallback: first dot-segment, or entire ID if no dots
  def.group = options.group ?? (options.id.includes('.') ? options.id.split('.')[0] : options.id)
  def.schema = options.schema
  def.description = options.description
  def.default = options.default
  return def
}

/** Check if value is a VariableDef */
export const isVariableDef = (u: unknown): u is VariableDef<unknown> =>
  typeof u === 'object' && u !== null && VariableTypeId in u

// ─────────────────────────────────────────────────────────────────────────────
// Variable Provider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * VariableProvider — loads variable values from a source.
 * Analogous to Effect's ConfigProvider.
 */
export interface VariableProvider {
  readonly [VariableProviderTypeId]: VariableProviderTypeId
  /**
   * Load a variable's value, or fail with VariableError.
   */
  readonly load: <A>(def: VariableDef<A>) => Effect.Effect<A, VariableError>
  /**
   * List all variable IDs available in this provider.
   */
  readonly enumerate: () => Effect.Effect<ReadonlyArray<string>>
}

/** @internal */
export const makeProvider = (options: {
  readonly load: <A>(def: VariableDef<A>) => Effect.Effect<A, VariableError>
  readonly enumerate: () => Effect.Effect<ReadonlyArray<string>>
}): VariableProvider => {
  const provider: VariableProvider = {
    [VariableProviderTypeId]: VariableProviderTypeId,
    load: options.load,
    enumerate: options.enumerate,
  }
  return provider
}

/**
 * Create a VariableProvider from a Map.
 * Values in the map are raw (will be validated against schema).
 */
export const fromMap = (
  map: ReadonlyMap<string, unknown>,
  options?: { readonly name?: string }
): VariableProvider => {
  const name = options?.name ?? 'map'

  return makeProvider({
    load: <A>(def: VariableDef<A>): Effect.Effect<A, VariableError> => {
      const raw = map.get(def.id)
      if (raw === undefined) {
        return Effect.fail(
          new VariableMissingError({
            variableId: def.id,
            path: [name],
          })
        )
      }

      // Validate against schema
      const decoded = Schema.decodeUnknownEither(def.schema)(raw)
      if (Either.isLeft(decoded)) {
        return Effect.fail(
          new VariableValidationError({
            variableId: def.id,
            value: raw,
            cause: decoded.left,
          })
        )
      }

      return Effect.succeed(decoded.right as A)
    },
    enumerate: () => Effect.succeed([...map.keys()]),
  })
}

/**
 * Create a VariableProvider from a plain object.
 * Supports nested keys via dot notation.
 */
export const fromObject = (
  obj: Record<string, unknown>,
  options?: { readonly name?: string }
): VariableProvider => {
  const name = options?.name ?? 'object'

  // Flatten nested object to dot-notation keys
  const flatten = (o: Record<string, unknown>, prefix = ''): Map<string, unknown> => {
    const result = new Map<string, unknown>()
    for (const [key, value] of Object.entries(o)) {
      const fullKey = prefix ? `${prefix}.${key}` : key
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const nested = flatten(value as Record<string, unknown>, fullKey)
        for (const [k, v] of nested) {
          result.set(k, v)
        }
      } else {
        result.set(fullKey, value)
      }
    }
    return result
  }

  const flatMap = flatten(obj)
  return fromMap(flatMap, { name })
}

/**
 * Create a VariableProvider that always returns the default value.
 * This is the "bottom" of the scope chain.
 */
export const fromDefaults = (): VariableProvider =>
  makeProvider({
    load: <A>(def: VariableDef<A>): Effect.Effect<A, VariableError> => {
      const defaultVal = def.default
      // If default is a function, it needs a lower value — but we're the bottom
      // So we need to handle this case
      if (typeof defaultVal === 'function') {
        // At the bottom of the chain, we can't call the function
        // This is a design constraint — bottom defaults must be values
        return Effect.fail(
          new VariableMissingError({
            variableId: def.id,
            path: ['defaults'],
          })
        )
      }
      return Effect.succeed(defaultVal)
    },
    enumerate: () => Effect.succeed([]),
  })

/**
 * Combine two providers with fallback.
 * If `self` fails with missing data, try `that`.
 *
 * This is the KEY combinator for scope resolution:
 * editor.orElse(workspace).orElse(user).orElse(defaults)
 */
export const orElse = (
  self: VariableProvider,
  that: () => VariableProvider
): VariableProvider =>
  makeProvider({
    load: <A>(def: VariableDef<A>) =>
      pipe(
        self.load(def),
        Effect.catchAll((error1) =>
          pipe(
            Effect.sync(that),
            Effect.flatMap((thatProvider) =>
              pipe(
                thatProvider.load(def),
                // If default is a function, apply it to the lower value
                Effect.flatMap((lowerValue) => {
                  if (typeof def.default === 'function') {
                    // This provider has a computed default — apply it
                    const computed = (def.default as (lower: A) => A)(lowerValue)
                    return Effect.succeed(computed)
                  }
                  return Effect.succeed(lowerValue)
                }),
                Effect.catchAll((error2) =>
                  Effect.fail(new VariableOrError({ left: error1, right: error2 }))
                )
              )
            )
          )
        )
      ),
    enumerate: () =>
      pipe(
        Effect.all([
          self.enumerate(),
          pipe(Effect.sync(that), Effect.flatMap((p) => p.enumerate())),
        ]),
        Effect.map(([selfKeys, thatKeys]) => Array.from(new Set([...selfKeys, ...thatKeys])))
      ),
  })

// ─────────────────────────────────────────────────────────────────────────────
// defuFn Integration — Computed Defaults
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a provider that uses defuFn for merging.
 * Functions in the object are called with the value from the lower scope.
 *
 * This enables Emacs-style computed defaults:
 * ```typescript
 * const userConfig = {
 *   'editor.fontSize': 14,
 *   'editor.lineHeight': (lower) => lower * 1.5, // Computed from default
 * }
 * ```
 */
export const fromObjectWithDefuFn = (
  obj: Record<string, unknown>,
  fallback: VariableProvider,
  options?: { readonly name?: string }
): VariableProvider => {
  const _name = options?.name ?? 'defu'

  return makeProvider({
    load: <A>(def: VariableDef<A>): Effect.Effect<A, VariableError> => {
      const raw = getNestedValue(obj, def.id)

      // If not in this scope, fall through to lower
      if (raw === undefined) {
        return fallback.load(def)
      }

      // If it's a function, get lower value and compute
      if (typeof raw === 'function') {
        return pipe(
          fallback.load(def),
          Effect.flatMap((lower) => {
            const computed = raw(lower)
            // Validate computed result
            const decoded = Schema.decodeUnknownEither(def.schema)(computed)
            if (Either.isLeft(decoded)) {
              return Effect.fail(
                new VariableValidationError({
                  variableId: def.id,
                  value: computed,
                  cause: decoded.left,
                })
              )
            }
            return Effect.succeed(decoded.right as A)
          })
        )
      }

      // Regular value — validate
      const decoded = Schema.decodeUnknownEither(def.schema)(raw)
      if (Either.isLeft(decoded)) {
        return Effect.fail(
          new VariableValidationError({
            variableId: def.id,
            value: raw,
            cause: decoded.left,
          })
        )
      }
      return Effect.succeed(decoded.right as A)
    },
    enumerate: () =>
      pipe(
        fallback.enumerate(),
        Effect.map((fallbackKeys) => {
          const selfKeys = collectKeys(obj)
          return Array.from(new Set([...selfKeys, ...fallbackKeys]))
        })
      ),
  })
}

/** Get nested value from object using dot notation */
const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/** Collect all keys from nested object as dot-notation strings */
const collectKeys = (obj: Record<string, unknown>, prefix = ''): string[] => {
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && typeof value !== 'function') {
      keys.push(...collectKeys(value as Record<string, unknown>, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

// ─────────────────────────────────────────────────────────────────────────────
// Variable Registry — Runtime Storage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global registry of variable definitions.
 * Variables are registered at load time, accessed by string ID at runtime.
 */
const variableDefinitions = new Map<string, VariableDef<unknown>>()

/** Register a variable definition */
export const registerVariable = <A>(def: VariableDef<A>): VariableDef<A> => {
  variableDefinitions.set(def.id, def as VariableDef<unknown>)
  return def
}

/** Get a variable definition by ID */
export const getVariableDefinition = (id: string): Option.Option<VariableDef<unknown>> =>
  Option.fromNullable(variableDefinitions.get(id))

/** Get all registered variable definitions */
export const getAllVariableDefinitions = (): ReadonlyMap<string, VariableDef<unknown>> =>
  variableDefinitions

/** Clear registry (for testing) */
export const clearRegistry = (): void => {
  variableDefinitions.clear()
}

// ─────────────────────────────────────────────────────────────────────────────
// Option-based Access
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load a variable, returning Option.none() if not found.
 * This is the key API for graceful handling of unknown variables.
 */
export const loadOption = <A>(
  provider: VariableProvider,
  def: VariableDef<A>
): Effect.Effect<Option.Option<A>> =>
  pipe(
    provider.load(def),
    Effect.map(Option.some),
    Effect.catchAll((error) =>
      isMissingDataOnly(error)
        ? Effect.succeed(Option.none())
        : Effect.fail(error)
    ),
    Effect.catchAll(() => Effect.succeed(Option.none()))
  )

/**
 * Load a variable by string ID, returning Option.none() if not found.
 * This is the RUNTIME access pattern — no imports needed.
 */
export const loadById = (
  provider: VariableProvider,
  id: string
): Effect.Effect<Option.Option<unknown>> =>
  pipe(
    Effect.sync(() => getVariableDefinition(id)),
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.succeed(Option.none()),
        onSome: (def) => loadOption(provider, def),
      })
    )
  )

/**
 * Load a variable by string ID with type assertion.
 * Returns Option.none() if not found or wrong type.
 */
export const loadByIdAs = <A>(
  provider: VariableProvider,
  id: string,
  schema: Schema.Schema<A, unknown>
): Effect.Effect<Option.Option<A>> =>
  pipe(
    loadById(provider, id),
    Effect.map(
      Option.flatMap((value) => {
        const decoded = Schema.decodeUnknownEither(schema)(value)
        return Either.isRight(decoded) ? Option.some(decoded.right) : Option.none()
      })
    )
  )
