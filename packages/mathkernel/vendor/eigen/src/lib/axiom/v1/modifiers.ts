/**
 * Axiom Modifiers
 *
 * Composable modifiers for schema fields using the pipe pattern.
 * These extend the base types with metadata needed for OSDK, GraphQL, etc.
 */

// =============================================================================
// Modifier Brands
// =============================================================================

export interface Nullable<T> {
  readonly _nullable: true
}

export interface PrimaryKey<T> {
  readonly _primaryKey: true
}

export interface Title<T> {
  readonly _title: true
}

export interface DisplayName<T> {
  readonly _displayName: string
}

export interface Description<T> {
  readonly _description: string
}

export interface Indexed<T> {
  readonly _indexed: true
}

export interface Unique<T> {
  readonly _unique: true
}

// =============================================================================
// Modifier Functions (pipe-compatible)
// =============================================================================

/**
 * Mark a field as nullable (can be null/undefined)
 */
export const nullable = <T extends object>(schema: T): T & Nullable<T> => ({
  ...schema,
  _nullable: true as const,
})

/**
 * Mark a field as the primary key (required for OSDK objects)
 */
export const primaryKey = <T extends object>(schema: T): T & PrimaryKey<T> => ({
  ...schema,
  _primaryKey: true as const,
})

/**
 * Mark a field as the title property (used for display in OSDK)
 */
export const title = <T extends object>(schema: T): T & Title<T> => ({
  ...schema,
  _title: true as const,
})

/**
 * Add a display name to a field
 */
export const displayName =
  (name: string) =>
  <T extends object>(schema: T): T & DisplayName<T> => ({
    ...schema,
    _displayName: name,
  })

/**
 * Add a description to a field
 */
export const description =
  (desc: string) =>
  <T extends object>(schema: T): T & Description<T> => ({
    ...schema,
    _description: desc,
  })

/**
 * Mark a field as indexed (for query optimization)
 */
export const indexed = <T extends object>(schema: T): T & Indexed<T> => ({
  ...schema,
  _indexed: true as const,
})

/**
 * Mark a field as unique (constraint)
 */
export const unique = <T extends object>(schema: T): T & Unique<T> => ({
  ...schema,
  _unique: true as const,
})

// =============================================================================
// Pipe Utility
// =============================================================================

/**
 * Pipe a value through a series of functions.
 * Enables Effect-style composition: A.String.pipe(A.primaryKey, A.title)
 */
export interface Pipeable {
  pipe<A, B>(this: A, ab: (a: A) => B): B
  pipe<A, B, C>(this: A, ab: (a: A) => B, bc: (b: B) => C): C
  pipe<A, B, C, D>(
    this: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D
  ): D
  pipe<A, B, C, D, E>(
    this: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E
  ): E
}

/**
 * Add pipe method to any object
 */
export const makePipeable = <T extends object>(obj: T): T & Pipeable => {
  const pipeable = obj as T & Pipeable
  pipeable.pipe = function (this: unknown, ...fns: Array<(x: unknown) => unknown>) {
    return fns.reduce((acc, fn) => fn(acc), this)
  }
  return pipeable
}

// =============================================================================
// Type Guards
// =============================================================================

export const isNullable = <T>(field: T): field is T & Nullable<T> =>
  typeof field === "object" &&
  field !== null &&
  "_nullable" in field &&
  (field as Nullable<T>)._nullable === true

export const isPrimaryKey = <T>(field: T): field is T & PrimaryKey<T> =>
  typeof field === "object" &&
  field !== null &&
  "_primaryKey" in field &&
  (field as PrimaryKey<T>)._primaryKey === true

export const isTitle = <T>(field: T): field is T & Title<T> =>
  typeof field === "object" &&
  field !== null &&
  "_title" in field &&
  (field as Title<T>)._title === true

export const hasDisplayName = <T>(field: T): field is T & DisplayName<T> =>
  typeof field === "object" &&
  field !== null &&
  "_displayName" in field &&
  typeof (field as DisplayName<T>)._displayName === "string"

export const hasDescription = <T>(field: T): field is T & Description<T> =>
  typeof field === "object" &&
  field !== null &&
  "_description" in field &&
  typeof (field as Description<T>)._description === "string"
