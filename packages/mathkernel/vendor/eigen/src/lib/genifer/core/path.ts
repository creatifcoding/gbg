/**
 * @fileoverview JSON Pointer path utilities as Effects
 *
 * Pure functional path operations for navigating and mutating
 * nested data structures using JSON Pointer (RFC 6901) syntax.
 *
 * ALL functions return Effects - errors are handled via Effect.catchAll
 */

import { Effect, Option, Data } from "effect"
import type { DataModel } from "./schemas"
import { PathRef, isPathRef } from "./schemas"

// =============================================================================
// Errors (using Data.TaggedError)
// =============================================================================

export class PathNotFoundError extends Data.TaggedError("PathNotFoundError")<{
  readonly path: string
  readonly reason: string
}> {}

export class InvalidPathError extends Data.TaggedError("InvalidPathError")<{
  readonly path: string
  readonly reason: string
}> {}

// =============================================================================
// Path Parsing
// =============================================================================

/**
 * Parse a JSON Pointer path into segments - returns Effect
 */
export const parsePathSegments = (path: string): Effect.Effect<readonly string[], never> =>
  Effect.succeed(
    !path || path === "/"
      ? []
      : path.startsWith("/")
        ? path.slice(1).split("/")
        : path.split("/")
  )

// =============================================================================
// Path Resolution
// =============================================================================

/**
 * Get a value from an object by JSON Pointer path - returns Effect
 * Errors are typed in the Effect signature
 */
export const getByPath = (
  obj: unknown,
  path: string
): Effect.Effect<unknown, PathNotFoundError> =>
  Effect.gen(function* () {
    if (!path || path === "/") {
      return obj
    }

    const segments = yield* parsePathSegments(path)
    let current: unknown = obj

    for (const segment of segments) {
      if (current === null || current === undefined) {
        return yield* Effect.fail(
          new PathNotFoundError({
            path,
            reason: `Path segment "${segment}" not found - parent is ${current}`
          })
        )
      }

      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[segment]
      } else {
        return yield* Effect.fail(
          new PathNotFoundError({
            path,
            reason: `Cannot traverse into non-object at segment "${segment}"`
          })
        )
      }
    }

    return current
  })

/**
 * Get a value from an object by path, returning Option (no errors)
 */
export const getByPathOption = (obj: unknown, path: string): Effect.Effect<Option.Option<unknown>, never> =>
  Effect.gen(function* () {
    const result = yield* Effect.either(getByPath(obj, path))
    return result._tag === "Right" ? Option.some(result.right) : Option.none()
  })

/**
 * Get a value by path, returning undefined on error - returns Effect
 */
export const getByPathOrUndefined = (obj: unknown, path: string): Effect.Effect<unknown, never> =>
  Effect.catchAll(getByPath(obj, path), () => Effect.succeed(undefined))

// =============================================================================
// Path Mutation (Immutable)
// =============================================================================

/**
 * Set a value at a JSON Pointer path (returns new object) - returns Effect
 */
export const setByPath = <T extends Record<string, unknown>>(
  obj: T,
  path: string,
  value: unknown
): Effect.Effect<T, never> =>
  Effect.gen(function* () {
    const segments = yield* parsePathSegments(path)

    if (segments.length === 0) {
      return value as T
    }

    // Deep clone and set
    const result = structuredClone(obj) as T
    let current: Record<string, unknown> = result

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]!
      if (!(segment in current) || typeof current[segment] !== "object" || current[segment] === null) {
        current[segment] = {}
      }
      current = current[segment] as Record<string, unknown>
    }

    const lastSegment = segments[segments.length - 1]!
    current[lastSegment] = value

    return result
  })

/**
 * Set value by path (sync version for performance-critical paths)
 */
export const setByPathSync = <T extends Record<string, unknown>>(
  obj: T,
  path: string,
  value: unknown
): T => Effect.runSync(setByPath(obj, path, value))

// =============================================================================
// Dynamic Value Resolution
// =============================================================================

/**
 * Resolve a dynamic value (literal or path reference) - returns Effect
 * Returns undefined if path not found (no error propagation)
 */
export const resolveDynamicValue = <T>(
  value: T | PathRef,
  dataModel: DataModel
): Effect.Effect<T | undefined, never> =>
  Effect.gen(function* () {
    if (value === null || value === undefined) {
      return undefined
    }

    if (isPathRef(value)) {
      const resolved = yield* getByPathOrUndefined(dataModel, value.path)
      return resolved as T | undefined
    }

    return value as T
  })

// =============================================================================
// String Interpolation
// =============================================================================

/**
 * Interpolate ${path} expressions in a string - returns Effect
 */
export const interpolateString = (
  template: string,
  dataModel: DataModel
): Effect.Effect<string, never> =>
  Effect.gen(function* () {
    const regex = /\$\{([^}]+)\}/g
    let result = template
    let match: RegExpExecArray | null

    // Collect all matches first (regex exec has side effects)
    const matches: Array<{ full: string; path: string }> = []
    while ((match = regex.exec(template)) !== null) {
      matches.push({ full: match[0], path: match[1]! })
    }

    // Resolve each path
    for (const { full, path } of matches) {
      const value = yield* getByPathOrUndefined(dataModel, path)
      result = result.replace(full, String(value ?? ""))
    }

    return result
  })

/**
 * Interpolate string (sync version)
 */
export const interpolateStringSync = (template: string, dataModel: DataModel): string =>
  Effect.runSync(interpolateString(template, dataModel))
