/**
 * ObjectType - Schema wrapper with OSDK metadata
 *
 * Wraps Effect Schema.TaggedClass definitions with ontology metadata
 * (primaryKey, title, links, displayName) for OSDK compilation.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect"
 * import { ObjectType } from "@/lib/axiom"
 *
 * class Department extends Schema.TaggedClass<Department>()("Department", {
 *   id: Schema.String.pipe(Schema.brand("DepartmentId")),
 *   name: Schema.NonEmptyString,
 * }) {}
 *
 * const DepartmentType = ObjectType.from(Department, {
 *   primaryKey: "id",
 *   title: "name",
 *   displayName: "Department",
 * })
 * ```
 */

import type { Schema } from "effect"

// =============================================================================
// Link Configuration
// =============================================================================

/**
 * Link cardinality options
 */
export type LinkCardinality =
  | "one-to-one"
  | "one-to-many"
  | "many-to-one"
  | "many-to-many"

/**
 * Configuration for a link to another object type
 */
export interface LinkConfig<
  Target extends Schema.Schema.AnyNoContext = Schema.Schema.AnyNoContext,
> {
  /** Factory function returning the target schema (supports circular refs) */
  readonly target: () => Target
  /** Relationship cardinality */
  readonly cardinality: LinkCardinality
  /** Foreign key property name (for many-to-one relationships) */
  readonly foreignKey?: string
  /** Display name for this link */
  readonly displayName?: string
}

// =============================================================================
// ObjectType Configuration
// =============================================================================

/**
 * Configuration for an ObjectType definition
 *
 * @typeParam S - The Effect Schema type being wrapped
 */
export interface ObjectTypeConfig<S extends Schema.Schema.AnyNoContext> {
  /** Primary key property name (must be a key of S) */
  readonly primaryKey: KeysOf<S>
  /** Title property name for display (must be a key of S) */
  readonly title?: KeysOf<S>
  /** Human-readable singular name */
  readonly displayName?: string
  /** Human-readable plural name */
  readonly pluralDisplayName?: string
  /** Description of this object type */
  readonly description?: string
  /** Links to other object types */
  readonly links?: Record<string, LinkConfig>
}

/**
 * Extract string keys from a Schema's Type
 */
type KeysOf<S extends Schema.Schema.AnyNoContext> = keyof Schema.Schema.Type<S> &
  string

// =============================================================================
// ObjectTypeDef
// =============================================================================

/**
 * An ObjectType definition: Schema + OSDK metadata
 *
 * @typeParam S - The Effect Schema type
 * @typeParam Name - The object type name (literal string)
 */
export interface ObjectTypeDef<
  S extends Schema.Schema.AnyNoContext = Schema.Schema.AnyNoContext,
  Name extends string = string,
> {
  readonly _tag: "ObjectType"
  /** The object type name (derived from Schema tag) */
  readonly name: Name
  /** The underlying Effect Schema */
  readonly schema: S
  /** OSDK metadata configuration */
  readonly config: ObjectTypeConfig<S>
}

// =============================================================================
// ObjectType Factory
// =============================================================================

/**
 * Extract the tag name from a TaggedClass schema
 */
type ExtractTagName<S> = S extends { readonly _tag: infer Tag extends string }
  ? Tag
  : S extends new (...args: any[]) => { readonly _tag: infer Tag extends string }
    ? Tag
    : string

/**
 * ObjectType factory namespace
 */
export const ObjectType = {
  /**
   * Create an ObjectTypeDef from an Effect Schema with OSDK metadata
   *
   * @param schema - Effect Schema (typically Schema.TaggedClass)
   * @param config - OSDK metadata configuration
   * @returns ObjectTypeDef wrapping the schema
   *
   * @example
   * ```typescript
   * class Employee extends Schema.TaggedClass<Employee>()("Employee", {
   *   employeeId: Schema.String.pipe(Schema.brand("EmployeeId")),
   *   fullName: Schema.NonEmptyString,
   *   departmentId: Schema.String,
   * }) {}
   *
   * const EmployeeType = ObjectType.from(Employee, {
   *   primaryKey: "employeeId",
   *   title: "fullName",
   *   links: {
   *     department: {
   *       target: () => Department,
   *       cardinality: "many-to-one",
   *       foreignKey: "departmentId",
   *     },
   *   },
   * })
   * ```
   */
  from: <S extends Schema.Schema.AnyNoContext>(
    schema: S,
    config: ObjectTypeConfig<S>
  ): ObjectTypeDef<S, ExtractTagName<Schema.Schema.Type<S>>> => {
    // Extract tag name from schema
    // For TaggedClass, the _tag is on the Type
    const schemaAny = schema as any
    const name: string =
      schemaAny.fields?._tag?.literals?.[0] ?? // TaggedClass pattern
      schemaAny._tag ?? // Direct tag
      schemaAny.identifier ?? // Schema identifier
      "Unknown"

    return {
      _tag: "ObjectType",
      name: name as ExtractTagName<Schema.Schema.Type<S>>,
      schema,
      config,
    }
  },

  /**
   * Type guard for ObjectTypeDef
   */
  is: (value: unknown): value is ObjectTypeDef => {
    return (
      typeof value === "object" &&
      value !== null &&
      "_tag" in value &&
      value._tag === "ObjectType"
    )
  },

  /**
   * Get the schema from an ObjectTypeDef
   */
  schema: <S extends Schema.Schema.AnyNoContext>(
    def: ObjectTypeDef<S>
  ): S => def.schema,

  /**
   * Get the config from an ObjectTypeDef
   */
  config: <S extends Schema.Schema.AnyNoContext>(
    def: ObjectTypeDef<S>
  ): ObjectTypeConfig<S> => def.config,

  /**
   * Get the name from an ObjectTypeDef
   */
  name: (def: ObjectTypeDef): string => def.name,

  /**
   * Get links from an ObjectTypeDef
   */
  links: (def: ObjectTypeDef): Record<string, LinkConfig> =>
    def.config.links ?? {},

  /**
   * Check if ObjectTypeDef has links
   */
  hasLinks: (def: ObjectTypeDef): boolean =>
    def.config.links !== undefined &&
    globalThis.Object.keys(def.config.links).length > 0,
}

// =============================================================================
// Type Utilities
// =============================================================================

/**
 * Extract the TypeScript type from an ObjectTypeDef
 */
export type InferObjectType<T extends ObjectTypeDef> =
  T extends ObjectTypeDef<infer S> ? Schema.Schema.Type<S> : never

/**
 * Extract the schema type from an ObjectTypeDef
 */
export type InferSchema<T extends ObjectTypeDef> =
  T extends ObjectTypeDef<infer S> ? S : never
