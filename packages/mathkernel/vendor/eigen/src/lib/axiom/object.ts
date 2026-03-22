/**
 * Axiom Object & Link Definitions
 *
 * The core units of the Axiom schema algebra.
 * Objects represent entities; Links represent relationships.
 */

import type { FieldRecord } from "./types"
import { makePipeable, type Pipeable } from "./modifiers"

// =============================================================================
// Link Cardinality
// =============================================================================

export type LinkCardinality =
  | "one-to-one"
  | "one-to-many"
  | "many-to-one"
  | "many-to-many"

// =============================================================================
// Link Types
// =============================================================================

export interface LinkType<Target, Cardinality extends LinkCardinality> {
  readonly _tag: "Link"
  readonly _target: () => Target
  readonly _cardinality: Cardinality
}

export interface LinkMetadata {
  readonly displayName?: string
  readonly pluralDisplayName?: string
  readonly description?: string
  readonly visibility?: "NORMAL" | "HIDDEN" | "PROMINENT"
}

export interface LinkDefinition<From, To> {
  readonly _tag: "LinkDefinition"
  readonly from: From
  readonly to: To
  readonly cardinality: LinkCardinality
  readonly foreignKey?: string
  readonly metadata?: {
    readonly from?: LinkMetadata
    readonly to?: LinkMetadata
  }
}

// =============================================================================
// Object Schema
// =============================================================================

export interface ObjectSchema<Name extends string, Fields extends FieldRecord> {
  readonly _tag: "Object"
  readonly _name: Name
  readonly _fields: Fields
  readonly _metadata?: ObjectMetadata
}

export interface ObjectMetadata {
  readonly displayName?: string
  readonly pluralDisplayName?: string
  readonly description?: string
  readonly icon?: string
}

// =============================================================================
// Constructors
// =============================================================================

/**
 * Define an Axiom object schema.
 *
 * This is the primary constructor for creating schema objects.
 *
 * @example
 * ```ts
 * const Person = A.Object("Person", {
 *   id: A.String.pipe(A.primaryKey),
 *   name: A.String.pipe(A.title),
 *   email: A.String.pipe(A.nullable),
 * })
 * ```
 */
export const Object = <Name extends string, Fields extends FieldRecord>(
  name: Name,
  fields: Fields,
  metadata?: ObjectMetadata
): ObjectSchema<Name, Fields> => ({
  _tag: "Object",
  _name: name,
  _fields: fields,
  _metadata: metadata,
})

/**
 * Define an inline link to another object.
 *
 * Use this for simple relationships where you don't need separate link metadata.
 *
 * @example
 * ```ts
 * const Person = A.Object("Person", {
 *   department: A.link(() => Department, "many-to-one"),
 * })
 * ```
 */
export const link = <Target, Cardinality extends LinkCardinality>(
  target: () => Target,
  cardinality: Cardinality
): LinkType<Target, Cardinality> => ({
  _tag: "Link",
  _target: target,
  _cardinality: cardinality,
})

/**
 * Define a separate link between two objects.
 *
 * Use this for complex relationships where you need detailed metadata
 * for both sides of the relationship.
 *
 * @example
 * ```ts
 * const DepartmentToEmployees = A.defineLink({
 *   from: Department,
 *   to: Employee,
 *   cardinality: "one-to-many",
 *   foreignKey: "departmentId",
 *   metadata: {
 *     from: { displayName: "Employees", pluralDisplayName: "Employees" },
 *     to: { displayName: "Department" },
 *   },
 * })
 * ```
 */
export const defineLink = <From, To>(config: {
  from: From
  to: To
  cardinality: LinkCardinality
  foreignKey?: string
  metadata?: {
    from?: LinkMetadata
    to?: LinkMetadata
  }
}): LinkDefinition<From, To> => ({
  _tag: "LinkDefinition",
  ...config,
})

// =============================================================================
// Pipeable Primitives
// =============================================================================

import * as Primitives from "./primitives"

/**
 * Pipeable String primitive
 */
export const String: Primitives.StringType & Pipeable = makePipeable(
  Primitives.String
)

/**
 * Pipeable Int primitive
 */
export const Int: Primitives.IntType & Pipeable = makePipeable(Primitives.Int)

/**
 * Pipeable Number primitive
 */
export const Number: Primitives.NumberType & Pipeable = makePipeable(
  Primitives.Number
)

/**
 * Pipeable Boolean primitive
 */
export const Boolean: Primitives.BooleanType & Pipeable = makePipeable(
  Primitives.Boolean
)

/**
 * Pipeable Date primitive
 */
export const Date: Primitives.DateType & Pipeable = makePipeable(
  Primitives.Date
)

/**
 * Pipeable DateTimeUtc primitive
 */
export const DateTimeUtc: Primitives.DateTimeUtcType & Pipeable = makePipeable(
  Primitives.DateTimeUtc
)

/**
 * Pipeable Timestamp primitive
 */
export const Timestamp: Primitives.TimestampType & Pipeable = makePipeable(
  Primitives.Timestamp
)

/**
 * Pipeable Decimal primitive
 */
export const Decimal: Primitives.DecimalType & Pipeable = makePipeable(
  Primitives.Decimal
)

/**
 * Pipeable GeoPoint primitive
 */
export const GeoPoint: Primitives.GeoPointType & Pipeable = makePipeable(
  Primitives.GeoPoint
)

/**
 * Pipeable GeoShape primitive
 */
export const GeoShape: Primitives.GeoShapeType & Pipeable = makePipeable(
  Primitives.GeoShape
)

/**
 * Pipeable MediaReference primitive
 */
export const MediaReference: Primitives.MediaReferenceType & Pipeable =
  makePipeable(Primitives.MediaReference)

/**
 * Pipeable Array constructor
 */
export const Array = <T>(item: T): Primitives.ArrayType<T> & Pipeable =>
  makePipeable(Primitives.Array(item))

/**
 * Pipeable Struct constructor
 */
export const Struct = <T extends Record<string, unknown>>(
  fields: T
): Primitives.StructType<T> & Pipeable => makePipeable(Primitives.Struct(fields))

// =============================================================================
// Type Guards
// =============================================================================

export const isObjectSchema = <N extends string, F extends FieldRecord>(
  schema: unknown
): schema is ObjectSchema<N, F> =>
  typeof schema === "object" &&
  schema !== null &&
  "_tag" in schema &&
  (schema as ObjectSchema<N, F>)._tag === "Object"

export const isLink = <T, C extends LinkCardinality>(
  field: unknown
): field is LinkType<T, C> =>
  typeof field === "object" &&
  field !== null &&
  "_tag" in field &&
  (field as LinkType<T, C>)._tag === "Link"

export const isLinkDefinition = <F, T>(
  def: unknown
): def is LinkDefinition<F, T> =>
  typeof def === "object" &&
  def !== null &&
  "_tag" in def &&
  (def as LinkDefinition<F, T>)._tag === "LinkDefinition"
