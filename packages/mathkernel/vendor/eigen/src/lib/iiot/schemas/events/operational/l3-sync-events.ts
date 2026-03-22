/**
 * L3 Sync Operation Events — ISA-95 Level 3 System Integration
 *
 * Defines 5 operational events for L3 system synchronization:
 * - L3SyncStarted: Sync operation initiated with external system
 * - L3SyncProgress: Progress update during sync
 * - L3SyncCompleted: Sync completed successfully
 * - L3SyncFailed: Sync failed with error
 * - ExternalChangeDetected: External system change detected
 *
 * These events are stored in EventLog (not TimescaleDB) for full audit trail.
 *
 * @module @gbg/tmnl/iiot/schemas/events/operational/l3-sync-events
 * @see EL-3.9-10 for L3 sync event requirements
 * @see ISA-95/IEC 62264 for operations management
 */

import { Schema } from 'effect'
import { SyncId } from '../../identifiers'
import { BaseOperationalEvent } from '../base'

// =============================================================================
// Branded Identifiers
// =============================================================================

/** External change identifier (e.g., 'CHG-2026-00001') */
export const ChangeId = Schema.String.pipe(Schema.brand('ChangeId'))
export type ChangeId = Schema.Schema.Type<typeof ChangeId>

// =============================================================================
// Supporting Types
// =============================================================================

/**
 * Sync operation type.
 * - full: Complete sync of all records
 * - delta: Incremental sync of changes only
 */
export const SyncType = Schema.Literal('full', 'delta')
export type SyncType = Schema.Schema.Type<typeof SyncType>

/**
 * Sync progress status.
 * - running: Sync is actively processing
 * - paused: Sync is temporarily paused
 */
export const SyncProgressStatus = Schema.Literal('running', 'paused')
export type SyncProgressStatus = Schema.Schema.Type<typeof SyncProgressStatus>

/**
 * External change type.
 * - create: New entity created in external system
 * - update: Existing entity modified
 * - delete: Entity removed from external system
 */
export const ExternalChangeType = Schema.Literal('create', 'update', 'delete')
export type ExternalChangeType = Schema.Schema.Type<typeof ExternalChangeType>

// =============================================================================
// L3SyncStarted — Sync Operation Initiated
// =============================================================================

/**
 * L3SyncStarted event.
 *
 * Emitted when a sync operation with an external L3 system is initiated.
 *
 * @example
 * ```typescript
 * const event = new L3SyncStarted({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'system-scheduler',
 *   entityId: siteId as AssetId,
 *   entityType: 'site',
 *   syncId,
 *   targetSystem: 'SAP-ERP',
 *   syncType: 'full',
 *   initiatedBy: 'system-scheduler',
 * })
 * ```
 */
export class L3SyncStarted extends BaseOperationalEvent.extend<L3SyncStarted>(
  'L3SyncStarted'
)({
  /** Unique sync operation identifier */
  syncId: SyncId,

  /** Name of the external system being synced with */
  targetSystem: Schema.NonEmptyString,

  /** Type of sync operation (full or delta) */
  syncType: SyncType,

  /** User or system that initiated the sync */
  initiatedBy: Schema.NonEmptyString,
}) {}

export type L3SyncStartedType = typeof L3SyncStarted.Type

// =============================================================================
// L3SyncProgress — Progress Update During Sync
// =============================================================================

/**
 * L3SyncProgress event.
 *
 * Emitted periodically during sync to report progress.
 *
 * @example
 * ```typescript
 * const event = new L3SyncProgress({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'sync-worker',
 *   entityId: siteId as AssetId,
 *   entityType: 'site',
 *   syncId,
 *   recordsProcessed: 500,
 *   totalRecords: 1000,
 *   status: 'running',
 * })
 * ```
 */
export class L3SyncProgress extends BaseOperationalEvent.extend<L3SyncProgress>(
  'L3SyncProgress'
)({
  /** Sync operation identifier */
  syncId: SyncId,

  /** Number of records processed so far */
  recordsProcessed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),

  /** Total number of records to process */
  totalRecords: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),

  /** Current sync status */
  status: SyncProgressStatus,
}) {}

export type L3SyncProgressType = typeof L3SyncProgress.Type

// =============================================================================
// L3SyncCompleted — Sync Completed Successfully
// =============================================================================

/**
 * L3SyncCompleted event.
 *
 * Emitted when a sync operation completes successfully.
 *
 * @example
 * ```typescript
 * const event = new L3SyncCompleted({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'sync-worker',
 *   entityId: siteId as AssetId,
 *   entityType: 'site',
 *   syncId,
 *   recordsCreated: 100,
 *   recordsUpdated: 250,
 *   recordsDeleted: 10,
 *   duration: 45000,
 * })
 * ```
 */
export class L3SyncCompleted extends BaseOperationalEvent.extend<L3SyncCompleted>(
  'L3SyncCompleted'
)({
  /** Sync operation identifier */
  syncId: SyncId,

  /** Number of records created during sync */
  recordsCreated: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),

  /** Number of records updated during sync */
  recordsUpdated: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),

  /** Number of records deleted during sync */
  recordsDeleted: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),

  /** Duration of sync operation in milliseconds */
  duration: Schema.Number.pipe(Schema.nonNegative()),
}) {}

export type L3SyncCompletedType = typeof L3SyncCompleted.Type

// =============================================================================
// L3SyncFailed — Sync Failed with Error
// =============================================================================

/**
 * L3SyncFailed event.
 *
 * Emitted when a sync operation fails with an error.
 *
 * @example
 * ```typescript
 * const event = new L3SyncFailed({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'sync-worker',
 *   entityId: siteId as AssetId,
 *   entityType: 'site',
 *   syncId,
 *   errorCode: 'CONN_TIMEOUT',
 *   errorMessage: 'Connection timed out',
 *   failedAt: DateTime.unsafeNow(),
 *   retryable: true,
 * })
 * ```
 */
export class L3SyncFailed extends BaseOperationalEvent.extend<L3SyncFailed>(
  'L3SyncFailed'
)({
  /** Sync operation identifier */
  syncId: SyncId,

  /** Error code for programmatic handling */
  errorCode: Schema.NonEmptyString,

  /** Human-readable error message */
  errorMessage: Schema.NonEmptyString,

  /** When the failure occurred */
  failedAt: Schema.DateTimeUtc,

  /** Whether the sync can be retried */
  retryable: Schema.Boolean,
}) {}

export type L3SyncFailedType = typeof L3SyncFailed.Type

// =============================================================================
// ExternalChangeDetected — External System Change Detected
// =============================================================================

/**
 * ExternalChangeDetected event.
 *
 * Emitted when a change is detected in an external L3 system
 * that may require local synchronization.
 *
 * @example
 * ```typescript
 * const event = new ExternalChangeDetected({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'change-listener',
 *   entityId: siteId as AssetId,
 *   entityType: 'site',
 *   changeId,
 *   sourceSystem: 'SAP-ERP',
 *   changeType: 'update',
 *   affectedEntities: ['WO-001', 'WO-002'],
 * })
 * ```
 */
export class ExternalChangeDetected extends BaseOperationalEvent.extend<ExternalChangeDetected>(
  'ExternalChangeDetected'
)({
  /** Unique change detection identifier */
  changeId: ChangeId,

  /** Name of the external system where change occurred */
  sourceSystem: Schema.NonEmptyString,

  /** Type of change detected */
  changeType: ExternalChangeType,

  /** List of entity identifiers affected by this change */
  affectedEntities: Schema.Array(Schema.String),
}) {}

export type ExternalChangeDetectedType = typeof ExternalChangeDetected.Type

// =============================================================================
// Union Type for All L3 Sync Events
// =============================================================================

/**
 * Union of all L3 sync events for type guards and handlers.
 */
export type L3SyncEvent =
  | L3SyncStarted
  | L3SyncProgress
  | L3SyncCompleted
  | L3SyncFailed
  | ExternalChangeDetected

/**
 * L3 sync event tags for type narrowing.
 */
export const L3_SYNC_EVENT_TAGS = [
  'L3SyncStarted',
  'L3SyncProgress',
  'L3SyncCompleted',
  'L3SyncFailed',
  'ExternalChangeDetected',
] as const

export type L3SyncEventTag = (typeof L3_SYNC_EVENT_TAGS)[number]
