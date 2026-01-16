/**
 * Effect Schema → json-render Adapter
 *
 * This module attempts to adapt Effect Schema to work with json-render's
 * Zod-based catalog system. json-render expects `z.ZodType<Record<string, unknown>>`.
 *
 * ## Approach
 *
 * We create a "ZodLike" wrapper that:
 * 1. Implements `.parse()` and `.safeParse()` using Effect's `Schema.decodeUnknownSync`
 * 2. Exposes `_def` and `_type` properties that Zod uses internally
 * 3. Attempts to satisfy TypeScript's structural typing for `z.ZodType`
 *
 * ## Known Limitations
 *
 * - Zod's `z.object()` may use `instanceof` checks internally
 * - Type inference via `z.infer<>` may not work correctly
 * - Schema composition (discriminatedUnion) may fail
 *
 * If this approach fails, alternatives:
 * - Fork json-render to accept a generic schema interface
 * - Use Effect Schema → JSON Schema → Zod pipeline
 * - Define parallel Zod + Effect schemas (not DRY)
 *
 * @module
 */

import { Schema } from 'effect'
import type { ZodError, ZodType } from 'zod'

/**
 * Minimal ZodTypeDef interface - Zod uses this internally
 */
interface ZodTypeDef {
  typeName?: string
  description?: string
}

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Zod-like result from safeParse
 */
export interface ZodLikeSafeParseResult<T> {
  success: boolean
  data?: T
  error?: ZodError
}

/**
 * Minimal interface that json-render needs from a schema
 */
export interface ZodLikeSchema<T> {
  parse(input: unknown): T
  safeParse(input: unknown): ZodLikeSafeParseResult<T>
  /** Zod uses this internally for type discrimination */
  _type: T
  /** Zod uses this for schema metadata */
  _def: ZodTypeDef
  /** Zod uses this for output type */
  _output: T
  /** Zod uses this for input type */
  _input: unknown
}

// ─── Adapter Implementation ─────────────────────────────────────────────────

/**
 * Convert an Effect Schema to a Zod-like interface.
 *
 * This creates an object that mimics Zod's API surface for validation,
 * delegating actual parsing to Effect Schema.
 *
 * @example
 * ```typescript
 * import { Schema } from 'effect'
 * import { effectToZodLike } from './effect-adapter'
 *
 * const MyProps = Schema.Struct({
 *   title: Schema.String,
 *   count: Schema.Number,
 * })
 *
 * const zodLike = effectToZodLike(MyProps)
 *
 * // Now usable in json-render catalog:
 * createCatalog({
 *   components: {
 *     MyComponent: {
 *       props: zodLike,
 *       description: 'My component',
 *     },
 *   },
 * })
 * ```
 */
export function effectToZodLike<A extends Record<string, unknown>, I = unknown>(
  schema: Schema.Schema<A, I>
): ZodType<A> {
  // Create a fake ZodError from an error
  const toZodError = (error: unknown): ZodError => {
    const message = error instanceof Error ? error.message : String(error)
    // Minimal ZodError-like structure
    const issues = [
      {
        code: 'custom' as const,
        path: [] as (string | number)[],
        message,
      },
    ]

    return {
      issues,
      errors: issues,
      name: 'ZodError',
      message,
      isEmpty: false,
      addIssue: () => {},
      addIssues: () => {},
      flatten: () => ({ formErrors: [], fieldErrors: {} }),
      format: () => ({ _errors: [message] }),
      toString: () => message,
    } as unknown as ZodError
  }

  const adapter: ZodLikeSchema<A> = {
    parse(input: unknown): A {
      return Schema.decodeUnknownSync(schema)(input)
    },

    safeParse(input: unknown): ZodLikeSafeParseResult<A> {
      try {
        const data = Schema.decodeUnknownSync(schema)(input)
        return { success: true, data }
      } catch (e) {
        return { success: false, error: toZodError(e) }
      }
    },

    // Zod internal properties - these help with type discrimination
    // but may not be sufficient for all Zod operations
    _type: undefined as unknown as A,
    _output: undefined as unknown as A,
    _input: undefined as unknown,
    _def: {
      typeName: 'ZodObject', // Pretend to be a ZodObject
      description: undefined,
    } as ZodTypeDef,
  }

  // Add Symbol.toStringTag to help with instanceof-like checks
  Object.defineProperty(adapter, Symbol.toStringTag, {
    value: 'ZodObject',
  })

  return adapter as unknown as ZodType<A>
}

// ─── Effect Schema Helpers ──────────────────────────────────────────────────

/**
 * Create an Effect Schema struct and convert to ZodLike in one step
 *
 * @example
 * ```typescript
 * const zodLike = zodLikeStruct({
 *   name: Schema.String,
 *   age: Schema.Number,
 * })
 * ```
 */
export function zodLikeStruct<Fields extends Schema.Struct.Fields>(
  fields: Fields
): ZodType<Schema.Struct.Type<Fields>> {
  // Cast aggressively - this is a spike, types are validated at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return effectToZodLike(Schema.Struct(fields) as any) as ZodType<Schema.Struct.Type<Fields>>
}

/**
 * Create an optional field wrapper that's compatible with ZodLike
 */
export const optional = Schema.optional

/**
 * Re-export commonly used Schema constructors for convenience
 */
export {
  Schema,
}
