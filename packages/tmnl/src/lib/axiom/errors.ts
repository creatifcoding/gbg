/**
 * Axiom Errors
 *
 * Effect-native error types for schema compilation.
 */

import { Data } from "effect"

// =============================================================================
// Error Types
// =============================================================================

/**
 * Base error for Axiom compilation failures
 */
export class AxiomCompileError extends Data.TaggedError("AxiomCompileError")<{
  readonly message: string
  readonly field?: string
  readonly schemaName?: string
}> {}

/**
 * Missing required primary key
 */
export class MissingPrimaryKeyError extends Data.TaggedError(
  "MissingPrimaryKeyError"
)<{
  readonly schemaName: string
}> {
  get message(): string {
    return `Schema "${this.schemaName}" is missing a primary key. Use A.primaryKey modifier.`
  }
}

/**
 * Invalid field type for target
 */
export class InvalidFieldTypeError extends Data.TaggedError(
  "InvalidFieldTypeError"
)<{
  readonly field: string
  readonly fieldType: string
  readonly target: string
  readonly reason?: string
}> {
  get message(): string {
    return `Field "${this.field}" has type "${this.fieldType}" which is not supported by ${this.target}${this.reason ? `: ${this.reason}` : ""}`
  }
}

/**
 * Circular reference detected
 */
export class CircularReferenceError extends Data.TaggedError(
  "CircularReferenceError"
)<{
  readonly path: readonly string[]
}> {
  get message(): string {
    return `Circular reference detected: ${this.path.join(" -> ")}`
  }
}

/**
 * Link target not found
 */
export class LinkTargetNotFoundError extends Data.TaggedError(
  "LinkTargetNotFoundError"
)<{
  readonly field: string
  readonly schemaName: string
}> {
  get message(): string {
    return `Link field "${this.field}" in "${this.schemaName}" references a target that could not be resolved`
  }
}

/**
 * Invalid cardinality for target
 */
export class InvalidCardinalityError extends Data.TaggedError(
  "InvalidCardinalityError"
)<{
  readonly field: string
  readonly cardinality: string
  readonly target: string
}> {
  get message(): string {
    return `Link field "${this.field}" has cardinality "${this.cardinality}" which is not supported by ${this.target}`
  }
}

/**
 * Schema validation error
 */
export class SchemaValidationError extends Data.TaggedError(
  "SchemaValidationError"
)<{
  readonly schemaName: string
  readonly errors: readonly string[]
}> {
  get message(): string {
    return `Schema "${this.schemaName}" validation failed:\n${this.errors.map((e) => `  - ${e}`).join("\n")}`
  }
}

// =============================================================================
// Error Union
// =============================================================================

export type CompileError =
  | AxiomCompileError
  | MissingPrimaryKeyError
  | InvalidFieldTypeError
  | CircularReferenceError
  | LinkTargetNotFoundError
  | InvalidCardinalityError
  | SchemaValidationError
