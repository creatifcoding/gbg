/**
 * Common IIoT Error Schemas
 *
 * Generic error types used across multiple IIoT domains.
 * These follow the Data.TaggedError pattern for Effect integration.
 *
 * @module
 */

import { Data } from 'effect'

// =============================================================================
// Validation Errors
// =============================================================================

/**
 * Generic validation error for field-level validation failures.
 *
 * @example
 * ```ts
 * new ValidationError({
 *   field: 'threshold',
 *   message: 'Must be between 0 and 100',
 *   value: 150
 * })
 * ```
 */
export class ValidationError extends Data.TaggedError('ValidationError')<{
  /** The field that failed validation */
  readonly field: string
  /** Human-readable validation error message */
  readonly message: string
  /** The invalid value (optional, for debugging) */
  readonly value?: unknown
}> {}

// =============================================================================
// Not Found Errors
// =============================================================================

/**
 * Generic entity not found error.
 *
 * Use domain-specific variants (AssetNotFoundError, AlarmNotFoundError)
 * when the entity type is known at compile time.
 *
 * @example
 * ```ts
 * new NotFoundError({
 *   entityType: 'WorkflowDefinition',
 *   entityId: 'WF-maintenance-v1'
 * })
 * ```
 */
export class NotFoundError extends Data.TaggedError('NotFoundError')<{
  /** Type of entity that was not found */
  readonly entityType: string
  /** Identifier of the missing entity */
  readonly entityId: string
}> {}

// =============================================================================
// Conflict Errors
// =============================================================================

/**
 * Optimistic locking conflict error.
 *
 * Thrown when an update operation fails due to version mismatch,
 * indicating another process modified the entity since it was read.
 *
 * @example
 * ```ts
 * new ConflictError({
 *   entityType: 'WorkOrder',
 *   entityId: 'WO-2026-00001',
 *   expectedVersion: 5,
 *   actualVersion: 7
 * })
 * ```
 */
export class ConflictError extends Data.TaggedError('ConflictError')<{
  /** Type of entity with version conflict */
  readonly entityType: string
  /** Identifier of the conflicting entity */
  readonly entityId: string
  /** Version the client expected */
  readonly expectedVersion: number
  /** Actual current version in storage */
  readonly actualVersion: number
}> {}

// =============================================================================
// Authorization Errors
// =============================================================================

/**
 * Unauthorized operation error.
 *
 * Thrown when a user lacks permission to perform an operation.
 *
 * @example
 * ```ts
 * new UnauthorizedError({
 *   operation: 'acknowledgeAlarm',
 *   reason: 'User lacks ALARM_ACK permission'
 * })
 * ```
 */
export class UnauthorizedError extends Data.TaggedError('UnauthorizedError')<{
  /** The operation that was denied */
  readonly operation: string
  /** Optional reason for denial */
  readonly reason?: string
}> {}

// =============================================================================
// Union Types
// =============================================================================

/**
 * All common errors as a discriminated union.
 */
export type CommonError =
  | ValidationError
  | NotFoundError
  | ConflictError
  | UnauthorizedError
