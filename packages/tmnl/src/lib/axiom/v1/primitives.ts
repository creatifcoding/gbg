/**
 * Axiom Primitives
 *
 * Effect Schema aligned primitive types with OSDK-compatible metadata.
 * These form the algebraic signature Σ from which free algebras are constructed.
 */

// =============================================================================
// Primitive Type Brands
// =============================================================================

export interface StringType {
  readonly _tag: "String"
}

export interface IntType {
  readonly _tag: "Int"
}

export interface NumberType {
  readonly _tag: "Number"
}

export interface BooleanType {
  readonly _tag: "Boolean"
}

export interface DateType {
  readonly _tag: "Date"
}

export interface DateTimeUtcType {
  readonly _tag: "DateTimeUtc"
}

export interface TimestampType {
  readonly _tag: "Timestamp"
}

export interface DecimalType {
  readonly _tag: "Decimal"
}

// =============================================================================
// Primitive Constructors
// =============================================================================

export const String: StringType = { _tag: "String" }
export const Int: IntType = { _tag: "Int" }
export const Number: NumberType = { _tag: "Number" }
export const Boolean: BooleanType = { _tag: "Boolean" }
export const Date: DateType = { _tag: "Date" }
export const DateTimeUtc: DateTimeUtcType = { _tag: "DateTimeUtc" }
export const Timestamp: TimestampType = { _tag: "Timestamp" }
export const Decimal: DecimalType = { _tag: "Decimal" }

// =============================================================================
// Composite Types
// =============================================================================

export interface ArrayType<T> {
  readonly _tag: "Array"
  readonly _item: T
}

export const Array = <T>(item: T): ArrayType<T> => ({
  _tag: "Array",
  _item: item,
})

export interface StructType<T extends Record<string, unknown>> {
  readonly _tag: "Struct"
  readonly _fields: T
}

export const Struct = <T extends Record<string, unknown>>(
  fields: T
): StructType<T> => ({
  _tag: "Struct",
  _fields: fields,
})

// =============================================================================
// Geo Types (OSDK specific)
// =============================================================================

export interface GeoPointType {
  readonly _tag: "GeoPoint"
}

export interface GeoShapeType {
  readonly _tag: "GeoShape"
}

export const GeoPoint: GeoPointType = { _tag: "GeoPoint" }
export const GeoShape: GeoShapeType = { _tag: "GeoShape" }

// =============================================================================
// Media Types (OSDK specific)
// =============================================================================

export interface MediaReferenceType {
  readonly _tag: "MediaReference"
}

export const MediaReference: MediaReferenceType = { _tag: "MediaReference" }

// =============================================================================
// Union of All Primitives
// =============================================================================

export type PrimitiveType =
  | StringType
  | IntType
  | NumberType
  | BooleanType
  | DateType
  | DateTimeUtcType
  | TimestampType
  | DecimalType
  | GeoPointType
  | GeoShapeType
  | MediaReferenceType

export type FieldType =
  | PrimitiveType
  | ArrayType<unknown>
  | StructType<Record<string, unknown>>
