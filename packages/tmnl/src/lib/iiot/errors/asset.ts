/**
 * Asset Error Schemas
 *
 * Domain-specific errors for ISA-95 asset hierarchy operations.
 * Covers Plant, Line, Machine, Sensor, and generic Asset entities.
 *
 * @module
 */

import { Data } from 'effect'

// =============================================================================
// Asset Not Found
// =============================================================================

/**
 * Asset not found in the hierarchy.
 *
 * @example
 * ```ts
 * new AssetNotFoundError({
 *   assetId: 'MCH-001',
 *   assetType: 'machine'
 * })
 * ```
 */
export class AssetNotFoundError extends Data.TaggedError('AssetNotFoundError')<{
  /** Identifier of the missing asset */
  readonly assetId: string
  /** Optional asset type for context (machine, sensor, plant, etc.) */
  readonly assetType?: string
}> {}

// =============================================================================
// Asset Validation
// =============================================================================

/**
 * Asset-specific validation error.
 *
 * Use when an asset's field fails domain validation rules.
 *
 * @example
 * ```ts
 * new AssetValidationError({
 *   assetId: 'SNS-001',
 *   field: 'threshold',
 *   message: 'Threshold cannot exceed sensor range'
 * })
 * ```
 */
export class AssetValidationError extends Data.TaggedError('AssetValidationError')<{
  /** Identifier of the asset with validation error */
  readonly assetId: string
  /** The field that failed validation */
  readonly field: string
  /** Human-readable validation error message */
  readonly message: string
}> {}

// =============================================================================
// Asset Conflict
// =============================================================================

/**
 * Asset version conflict for optimistic locking.
 *
 * Thrown when concurrent modifications cause version mismatch.
 *
 * @example
 * ```ts
 * new AssetConflictError({
 *   assetId: 'MCH-002',
 *   expectedVersion: 10,
 *   actualVersion: 15
 * })
 * ```
 */
export class AssetConflictError extends Data.TaggedError('AssetConflictError')<{
  /** Identifier of the conflicting asset */
  readonly assetId: string
  /** Version the client expected */
  readonly expectedVersion: number
  /** Actual current version in storage */
  readonly actualVersion: number
}> {}

// =============================================================================
// Union Types
// =============================================================================

/**
 * All asset command errors as a discriminated union.
 *
 * Use with Effect.catchTags for exhaustive error handling:
 * @example
 * ```ts
 * pipe(
 *   updateAsset(command),
 *   Effect.catchTags({
 *     AssetNotFoundError: (e) => Effect.fail(new HttpNotFound(e.assetId)),
 *     AssetValidationError: (e) => Effect.fail(new HttpBadRequest(e.message)),
 *     AssetConflictError: (e) => Effect.fail(new HttpConflict(e.expectedVersion, e.actualVersion)),
 *   })
 * )
 * ```
 */
export type AssetCommandError =
  | AssetNotFoundError
  | AssetValidationError
  | AssetConflictError
