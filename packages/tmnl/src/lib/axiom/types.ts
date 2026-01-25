/**
 * Axiom Type-Level Utilities
 *
 * Type-level projections implementing the Yoneda embedding:
 * Nat(Hom(−,A),F) ≅ F(A)
 *
 * Enables polymorphic type extraction from schema definitions.
 */

import type { ArrayType, StructType } from "./primitives"
import type { Nullable } from "./modifiers"
import type { LinkType, ObjectSchema } from "./object"

// =============================================================================
// Infer<S> - Extract TypeScript type from Schema
// =============================================================================

/**
 * Infer the TypeScript type from an Axiom schema.
 * This is the Yoneda embedding that enables polymorphic codegen.
 */
export type Infer<S> = S extends ObjectSchema<infer _Name, infer Fields>
  ? { [K in keyof Fields]: InferField<Fields[K]> }
  : never

/**
 * Infer a single field's TypeScript type
 */
export type InferField<F> =
  // Handle nullable wrapper first
  F extends { _nullable: true }
    ? InferBaseField<Omit<F, "_nullable">> | null
    : InferBaseField<F>

/**
 * Infer base field type without nullable handling
 */
type InferBaseField<F> =
  // Primitives
  F extends { _tag: "String" }
    ? string
    : F extends { _tag: "Int" }
      ? number
      : F extends { _tag: "Number" }
        ? number
        : F extends { _tag: "Decimal" }
          ? number
          : F extends { _tag: "Boolean" }
            ? boolean
            : F extends { _tag: "Date" }
              ? string // ISO date string
              : F extends { _tag: "DateTimeUtc" }
                ? string // ISO datetime string
                : F extends { _tag: "Timestamp" }
                  ? string // ISO timestamp string
                  : // Geo types
                    F extends { _tag: "GeoPoint" }
                    ? { latitude: number; longitude: number }
                    : F extends { _tag: "GeoShape" }
                      ? GeoJSON.Geometry
                      : // Media
                        F extends { _tag: "MediaReference" }
                        ? { rid: string; mediaType: string }
                        : // Composites
                          F extends ArrayType<infer I>
                          ? InferField<I>[]
                          : F extends StructType<infer SF>
                            ? { [K in keyof SF]: InferField<SF[K]> }
                            : // Links
                              F extends LinkType<infer T, infer _C>
                              ? InferLink<T, F>
                              : never

/**
 * Infer link type based on cardinality
 */
type InferLink<T, F> = F extends { _cardinality: "one-to-one" | "many-to-one" }
  ? Infer<ReturnType<T extends () => infer R ? () => R : never>>
  : F extends { _cardinality: "one-to-many" | "many-to-many" }
    ? Array<Infer<ReturnType<T extends () => infer R ? () => R : never>>>
    : never

// =============================================================================
// Field Record Type
// =============================================================================

/**
 * Valid field types for an object schema
 */
export type FieldRecord = Record<string, unknown>

// =============================================================================
// Type Extraction Utilities
// =============================================================================

/**
 * Extract the name from an ObjectSchema
 */
export type SchemaName<S> = S extends ObjectSchema<infer Name, infer _Fields>
  ? Name
  : never

/**
 * Extract field names from an ObjectSchema
 */
export type SchemaFields<S> = S extends ObjectSchema<infer _Name, infer Fields>
  ? Fields
  : never

/**
 * Extract primary key field name
 */
export type PrimaryKeyField<S> = S extends ObjectSchema<infer _Name, infer Fields>
  ? {
      [K in keyof Fields]: Fields[K] extends { _primaryKey: true } ? K : never
    }[keyof Fields]
  : never

/**
 * Extract title field name
 */
export type TitleField<S> = S extends ObjectSchema<infer _Name, infer Fields>
  ? {
      [K in keyof Fields]: Fields[K] extends { _title: true } ? K : never
    }[keyof Fields]
  : never

/**
 * Extract nullable field names
 */
export type NullableFields<S> = S extends ObjectSchema<infer _Name, infer Fields>
  ? {
      [K in keyof Fields]: Fields[K] extends { _nullable: true } ? K : never
    }[keyof Fields]
  : never

/**
 * Extract required field names (non-nullable)
 */
export type RequiredFields<S> = S extends ObjectSchema<infer _Name, infer Fields>
  ? Exclude<keyof Fields, NullableFields<S>>
  : never

// =============================================================================
// Link Type Extraction
// =============================================================================

/**
 * Extract link field names
 */
export type LinkFields<S> = S extends ObjectSchema<infer _Name, infer Fields>
  ? {
      [K in keyof Fields]: Fields[K] extends { _tag: "Link" } ? K : never
    }[keyof Fields]
  : never

/**
 * Extract non-link field names (properties)
 */
export type PropertyFields<S> = S extends ObjectSchema<infer _Name, infer Fields>
  ? Exclude<keyof Fields, LinkFields<S>>
  : never

// =============================================================================
// GeoJSON namespace stub (for type inference)
// =============================================================================

declare namespace GeoJSON {
  interface Geometry {
    type: string
    coordinates: unknown
  }
}
