/**
 * @file Key extraction and composite key handling for Fermion
 * @module @tmnl/fermion/internal/keys
 *
 * Follows effect-atom's QueryKey pattern using Data for structural equality.
 */

import { Data, Equal, Hash } from "effect"
import { CompositeKeyTypeId } from "./symbols"

/**
 * Base interface for composite keys with structural equality
 */
export interface CompositeKeyBase {
  readonly [CompositeKeyTypeId]: CompositeKeyTypeId
  readonly _fields: readonly string[]
}

/**
 * Create a composite key with structural equality using Data.struct
 *
 * @example
 * ```ts
 * const key1 = makeCompositeKey(["userId", "orderId"], { userId: "u1", orderId: "o1" })
 * const key2 = makeCompositeKey(["userId", "orderId"], { userId: "u1", orderId: "o1" })
 * Equal.equals(key1, key2) // true
 * ```
 */
export const makeCompositeKey = <const Fields extends readonly string[]>(
  fields: Fields,
  values: { readonly [K in Fields[number]]: unknown }
): CompositeKeyBase & { readonly [K in Fields[number]]: unknown } => {
  const base = Data.struct({
    [CompositeKeyTypeId]: CompositeKeyTypeId,
    _fields: fields,
    ...values,
  })
  return base as CompositeKeyBase & { readonly [K in Fields[number]]: unknown }
}

/**
 * Type guard for CompositeKey instances
 */
export const isCompositeKey = (value: unknown): value is CompositeKeyBase =>
  typeof value === "object" &&
  value !== null &&
  CompositeKeyTypeId in value

/**
 * Extract key value(s) from an entity
 *
 * @param entity - The entity to extract key from
 * @param keyField - Single key field or array of key fields
 * @returns The key value (single) or composite key object
 *
 * @example
 * ```ts
 * // Single key
 * extractKey({ id: "123", name: "Test" }, "id") // "123"
 *
 * // Composite key
 * extractKey({ userId: "u1", orderId: "o1" }, ["userId", "orderId"])
 * // { userId: "u1", orderId: "o1" }
 * ```
 */
export const extractKey = <A, K extends keyof A>(
  entity: A,
  keyField: K | readonly K[]
): A[K] | { readonly [P in K]: A[P] } => {
  if (Array.isArray(keyField)) {
    const result: Record<string, unknown> = {}
    for (const k of keyField) {
      result[k as string] = entity[k]
    }
    return result as { readonly [P in K]: A[P] }
  }
  return entity[keyField as K]
}

/**
 * Serialize a key to a stable string for Map/Set usage
 */
export const serializeKey = (key: unknown): string => {
  if (isCompositeKey(key)) {
    const parts: string[] = []
    const keyRecord = key as unknown as Record<string, unknown>
    for (const field of key._fields) {
      parts.push(`${field}:${JSON.stringify(keyRecord[field])}`)
    }
    return parts.join("|")
  }
  return JSON.stringify(key)
}

/**
 * Create a key hash for Atom.family memoization
 */
export const hashKey = (key: unknown): number => {
  return Hash.hash(key)
}
