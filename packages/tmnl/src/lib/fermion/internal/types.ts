/**
 * @file Internal type utilities for Fermion
 * @module @tmnl/fermion/internal/types
 */

import type { Schema } from "effect"

/**
 * Extract field names from a Schema as a union type
 */
export type SchemaFields<S extends Schema.Schema.All> = keyof Schema.Schema.Type<S>

/**
 * Extract the type of a specific field from a Schema
 */
export type SchemaFieldType<
  S extends Schema.Schema.All,
  K extends SchemaFields<S>
> = Schema.Schema.Type<S>[K]

/**
 * Create an object type from selected fields of a Schema
 */
export type SchemaFieldsObject<
  S extends Schema.Schema.All,
  K extends readonly SchemaFields<S>[]
> = {
  readonly [P in K[number]]: Schema.Schema.Type<S>[P]
}

/**
 * Utility to check if a type is never
 */
export type IsNever<T> = [T] extends [never] ? true : false

/**
 * Utility to simplify complex intersection types for better IDE display
 */
export type Simplify<T> = { [K in keyof T]: T[K] } & {}

/**
 * Make specific properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Ensure a type is readonly
 */
export type DeepReadonly<T> = T extends (infer R)[]
  ? ReadonlyArray<DeepReadonly<R>>
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T
