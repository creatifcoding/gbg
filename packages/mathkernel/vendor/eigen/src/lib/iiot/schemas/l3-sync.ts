/**
 * L3 Sync Operation Schemas
 *
 * Defines synchronization operations with external systems (ERP, CMMS)
 * per ISA-95 Level 3 integration patterns.
 *
 * @module
 * @see ADR-0012 for ES boundaries
 * @see ISA-95 Part 5 for B2MML messaging
 */

import { Schema } from 'effect'
import { SyncId, WorkOrderId } from './identifiers'

// =============================================================================
// Sync Types
// =============================================================================

/**
 * Direction of sync operation.
 */
export const SyncDirection = Schema.Literal(
  'push',          // Send to external system
  'pull',          // Receive from external system
  'bidirectional'  // Both directions
)
export type SyncDirection = Schema.Schema.Type<typeof SyncDirection>

/**
 * External system type.
 */
export const ExternalSystem = Schema.Literal(
  'sap',
  'oracle_ebs',
  'dynamics365',
  'infor',
  'cmms',      // Generic CMMS
  'mes',       // Generic MES
  'scada',     // SCADA system
  'historian', // Process historian
  'custom'
)
export type ExternalSystem = Schema.Schema.Type<typeof ExternalSystem>

/**
 * Sync operation status.
 */
export const SyncStatus = Schema.Literal(
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'paused'
)
export type SyncStatus = Schema.Schema.Type<typeof SyncStatus>

/**
 * Phase of sync operation.
 */
export const SyncPhase = Schema.Literal(
  'initializing',
  'validating',
  'transforming',
  'sending',
  'receiving',
  'confirming',
  'completing',
  'rolling_back'
)
export type SyncPhase = Schema.Schema.Type<typeof SyncPhase>

/**
 * Type of change detected from external system.
 */
export const ExternalChangeType = Schema.Literal(
  'created',
  'updated',
  'deleted',
  'status_changed',
  'completed',
  'cancelled'
)
export type ExternalChangeType = Schema.Schema.Type<typeof ExternalChangeType>

// =============================================================================
// L3 Sync Operation Entity
// =============================================================================

/**
 * L3 Sync Operation - integration with external systems.
 *
 * Tracks synchronization of work orders with ERP/CMMS systems
 * per ISA-95 Level 3 messaging standards.
 */
export class L3SyncOperation extends Schema.TaggedClass<L3SyncOperation>()('L3SyncOperation', {
  /** Unique sync operation identifier */
  id: SyncId,

  /** Associated work order */
  workOrderId: WorkOrderId,

  /** External system being synced */
  system: ExternalSystem,

  /** Sync direction */
  direction: SyncDirection,

  /** Current status */
  status: SyncStatus,

  /** Current phase */
  currentPhase: SyncPhase,

  /** Number of items to sync */
  itemCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),

  /** Items processed so far */
  itemsProcessed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),

  /** Progress percentage (0-100) */
  progress: Schema.Number.pipe(Schema.between(0, 100)),

  /** Start timestamp */
  startedAt: Schema.DateTimeUtc,

  /** Completion timestamp */
  completedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Duration in milliseconds */
  duration: Schema.optionalWith(Schema.Number, { as: 'Option' }),

  /** External system reference ID */
  externalId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Error details (if failed) */
  error: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Whether operation is retryable on failure */
  retryable: Schema.optionalWith(Schema.Boolean, { default: () => true }),

  /** Retry count */
  retryCount: Schema.optionalWith(Schema.Number, { default: () => 0 }),

  /** Max retries allowed */
  maxRetries: Schema.optionalWith(Schema.Number, { default: () => 3 }),

  /** Sync configuration */
  config: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),

  /** Request payload (for debugging) */
  requestPayload: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Response payload (for debugging) */
  responsePayload: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Extensible metadata */
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {
  /**
   * Check if sync is in progress.
   */
  isInProgress(): boolean {
    return ['pending', 'running', 'paused'].includes(this.status)
  }

  /**
   * Check if sync is complete.
   */
  isComplete(): boolean {
    return ['completed', 'failed', 'cancelled'].includes(this.status)
  }

  /**
   * Check if sync can be retried.
   */
  canRetry(): boolean {
    return this.status === 'failed' && this.retryable && this.retryCount < this.maxRetries
  }

  /**
   * Get progress percentage.
   */
  getProgressPercentage(): number {
    if (this.itemCount === 0) return 100
    return Math.round((this.itemsProcessed / this.itemCount) * 100)
  }
}

/**
 * External change notification - changes detected from external system.
 */
export const ExternalChange = Schema.Struct({
  /** Associated work order (if known) */
  workOrderId: Schema.optionalWith(WorkOrderId, { as: 'Option' }),

  /** External system source */
  system: ExternalSystem,

  /** Type of change */
  changeType: ExternalChangeType,

  /** External system's ID for the entity */
  externalId: Schema.String,

  /** Timestamp when change was detected */
  detectedAt: Schema.DateTimeUtc,

  /** Change payload from external system */
  payload: Schema.Record({ key: Schema.String, value: Schema.Unknown }),

  /** Whether this change has been processed */
  processed: Schema.Boolean,

  /** Processing result */
  processingResult: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type ExternalChange = Schema.Schema.Type<typeof ExternalChange>

// =============================================================================
// Command Parameter Schemas
// =============================================================================

/** Parameters for starting a sync operation */
export const StartSyncParams = Schema.Struct({
  workOrderId: WorkOrderId,
  system: ExternalSystem,
  direction: SyncDirection,
  config: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
})
export type StartSyncParams = Schema.Schema.Type<typeof StartSyncParams>

/** Parameters for updating sync progress */
export const UpdateSyncProgressParams = Schema.Struct({
  syncId: SyncId,
  phase: SyncPhase,
  itemsProcessed: Schema.Number,
  progress: Schema.Number,
})
export type UpdateSyncProgressParams = Schema.Schema.Type<typeof UpdateSyncProgressParams>

/** Parameters for completing a sync operation */
export const CompleteSyncParams = Schema.Struct({
  syncId: SyncId,
  externalId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  responsePayload: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type CompleteSyncParams = Schema.Schema.Type<typeof CompleteSyncParams>

/** Parameters for failing a sync operation */
export const FailSyncParams = Schema.Struct({
  syncId: SyncId,
  error: Schema.NonEmptyString,
  retryable: Schema.optionalWith(Schema.Boolean, { default: () => true }),
})
export type FailSyncParams = Schema.Schema.Type<typeof FailSyncParams>
