/**
 * FileOperation Schema
 *
 * File operation tracking and progress.
 *
 * @module file-browser/schemas
 */

import { Schema } from 'effect'

// =============================================================================
// Operation Type
// =============================================================================

export const OperationType = Schema.Literal(
  'copy',
  'move',
  'delete',
  'rename',
  'create',
  'compress',
  'extract',
  'hash',
  'analyze'
)
export type OperationType = typeof OperationType.Type

// =============================================================================
// Operation Phase
// =============================================================================

export const OperationPhase = Schema.Literal(
  'pending',
  'preparing',
  'executing',
  'finalizing',
  'complete',
  'failed',
  'cancelled'
)
export type OperationPhase = typeof OperationPhase.Type

// =============================================================================
// Operation Progress
// =============================================================================

export const OperationProgress = Schema.Struct({
  /** Bytes processed so far */
  bytesProcessed: Schema.Number,
  /** Total bytes to process */
  bytesTotal: Schema.Number,
  /** Files processed so far */
  filesProcessed: Schema.Number,
  /** Total files to process */
  filesTotal: Schema.Number,
  /** Current file being processed */
  currentFile: Schema.NullOr(Schema.String),
  /** Progress 0-1 */
  percentage: Schema.Number,
  /** Estimated time remaining in ms */
  estimatedMs: Schema.NullOr(Schema.Number),
  /** Transfer speed in bytes/sec */
  bytesPerSecond: Schema.NullOr(Schema.Number),
})
export type OperationProgress = typeof OperationProgress.Type

// =============================================================================
// Operation Error
// =============================================================================

export const OperationError = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
  path: Schema.NullOr(Schema.String),
  recoverable: Schema.Boolean,
})
export type OperationError = typeof OperationError.Type

// =============================================================================
// File Operation
// =============================================================================

export class FileOperation extends Schema.TaggedClass<FileOperation>()('FileOperation', {
  /** Operation ID */
  id: Schema.String,
  /** Operation type */
  type: OperationType,
  /** Source path(s) */
  sources: Schema.Array(Schema.String),
  /** Destination path (null for delete) */
  destination: Schema.NullOr(Schema.String),
  /** Current phase */
  phase: OperationPhase,
  /** Progress info */
  progress: OperationProgress,
  /** Error if failed */
  error: Schema.NullOr(OperationError),
  /** Started timestamp */
  startedAt: Schema.Number,
  /** Completed timestamp (null if in progress) */
  completedAt: Schema.NullOr(Schema.Number),
  /** Is operation cancellable */
  cancellable: Schema.Boolean,
}) {
  /** Check if operation is in progress */
  get isInProgress(): boolean {
    return ['pending', 'preparing', 'executing', 'finalizing'].includes(this.phase)
  }

  /** Check if operation is complete (success or failure) */
  get isComplete(): boolean {
    return ['complete', 'failed', 'cancelled'].includes(this.phase)
  }

  /** Check if operation succeeded */
  get isSuccess(): boolean {
    return this.phase === 'complete'
  }

  /** Duration in ms (null if not started or in progress) */
  get durationMs(): number | null {
    if (!this.completedAt) return null
    return this.completedAt - this.startedAt
  }

  /** Human-readable status */
  get statusLabel(): string {
    switch (this.phase) {
      case 'pending':
        return 'Pending'
      case 'preparing':
        return 'Preparing...'
      case 'executing':
        return `${Math.round(this.progress.percentage * 100)}%`
      case 'finalizing':
        return 'Finalizing...'
      case 'complete':
        return 'Complete'
      case 'failed':
        return 'Failed'
      case 'cancelled':
        return 'Cancelled'
    }
  }
}

// =============================================================================
// Operation Result
// =============================================================================

export const OperationResult = Schema.Struct({
  operationId: Schema.String,
  success: Schema.Boolean,
  error: Schema.NullOr(OperationError),
  affectedPaths: Schema.Array(Schema.String),
  durationMs: Schema.Number,
})
export type OperationResult = typeof OperationResult.Type
