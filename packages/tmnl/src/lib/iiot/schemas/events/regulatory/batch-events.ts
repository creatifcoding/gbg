/**
 * Batch Record Events — FDA 21 CFR Part 11 Compliant Batch Records
 *
 * Defines 4 regulatory events for batch record management:
 * - BatchStarted: Batch production initiated
 * - ParameterRecorded: Critical process parameter recorded
 * - BatchCompleted: Batch production completed
 * - BatchDeviation: Deviation from batch record detected
 *
 * All events include FDA 21 CFR Part 11 compliance fields:
 * - electronicSignature: Digital signature with signedBy, signedAt, signatureMeaning
 * - auditTrailId: Correlation ID for audit trail
 * - DateTimeUtc timestamps for all temporal fields
 *
 * These events are stored in EventLog (not TimescaleDB) for full audit trail.
 *
 * @module @gbg/tmnl/iiot/schemas/events/regulatory/batch-events
 * @see EL-5.1-5 for batch record event requirements
 * @see FDA 21 CFR Part 11 for electronic records compliance
 * @see ISA-88 for batch control standards
 */

import { Schema } from 'effect'
import { AssetId } from '../../identifiers'
import { BaseOperationalEvent } from '../base'

// =============================================================================
// Branded Identifiers
// =============================================================================

/** Batch identifier (e.g., 'BATCH-2026-00001') */
export const BatchId = Schema.String.pipe(Schema.brand('BatchId'))
export type BatchId = Schema.Schema.Type<typeof BatchId>

/** Process parameter identifier (e.g., 'PARAM-temp-001') */
export const ParameterId = Schema.String.pipe(Schema.brand('ParameterId'))
export type ParameterId = Schema.Schema.Type<typeof ParameterId>

/** Deviation identifier (e.g., 'DEV-2026-00001') */
export const DeviationId = Schema.String.pipe(Schema.brand('DeviationId'))
export type DeviationId = Schema.Schema.Type<typeof DeviationId>

// =============================================================================
// Supporting Schemas - FDA 21 CFR Part 11
// =============================================================================

/**
 * Electronic Signature per FDA 21 CFR Part 11.
 *
 * Requirements:
 * - Unique to one individual (signedBy)
 * - Legally binding (signatureMeaning)
 * - Timestamped (signedAt)
 *
 * @see 21 CFR 11.50 - Signature manifestations
 * @see 21 CFR 11.70 - Signature/record linking
 */
export const ElectronicSignature = Schema.Struct({
  /** User ID of the signer (must be unique to one individual) */
  signedBy: Schema.NonEmptyString,

  /** UTC timestamp of when the signature was applied */
  signedAt: Schema.DateTimeUtc,

  /** Meaning of the signature (e.g., "approval", "review", "authorship") */
  signatureMeaning: Schema.NonEmptyString,
}).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/events/regulatory/ElectronicSignature',
    description: 'FDA 21 CFR Part 11 compliant electronic signature',
  })
)
export type ElectronicSignature = Schema.Schema.Type<typeof ElectronicSignature>

/**
 * Deviation type categories per FDA guidance.
 */
export const DeviationType = Schema.Literal(
  'process',       // Deviation from defined process parameters
  'equipment',     // Equipment malfunction or out-of-spec
  'material',      // Raw material or component issue
  'documentation', // Documentation error or omission
  'environmental'  // Environmental condition deviation
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/events/regulatory/DeviationType',
    description: 'Type of batch deviation per FDA guidance',
  })
)
export type DeviationType = Schema.Schema.Type<typeof DeviationType>

/**
 * Deviation severity levels for impact assessment.
 */
export const DeviationSeverity = Schema.Literal(
  'minor',    // No impact on product quality
  'major',    // Potential impact requiring investigation
  'critical'  // Definite impact, may require batch rejection
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/events/regulatory/DeviationSeverity',
    description: 'Severity level of batch deviation',
  })
)
export type DeviationSeverity = Schema.Schema.Type<typeof DeviationSeverity>

// =============================================================================
// BatchStarted — Batch Production Initiated
// =============================================================================

/**
 * BatchStarted event.
 *
 * Emitted when a new batch production run is initiated. Marks the beginning
 * of the batch record audit trail.
 *
 * FDA 21 CFR Part 11 Requirements:
 * - Electronic signature of person initiating batch
 * - Audit trail ID for event correlation
 * - UTC timestamp for all temporal fields
 *
 * @example
 * ```typescript
 * const event = new BatchStarted({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'operator-001',
 *   entityId: equipmentAssetId,
 *   entityType: 'machine',
 *   batchId,
 *   productCode: 'PROD-ABC-001',
 *   lotNumber: 'LOT-2026-001',
 *   startedBy: 'operator-001',
 *   plannedQuantity: 1000,
 *   equipmentIds: [mixerAssetId, reactorAssetId],
 *   electronicSignature: {
 *     signedBy: 'operator-001',
 *     signedAt: DateTime.unsafeNow(),
 *     signatureMeaning: 'I confirm batch initiation',
 *   },
 *   auditTrailId: 'AUD-2026-00001',
 * })
 * ```
 */
export class BatchStarted extends BaseOperationalEvent.extend<BatchStarted>(
  'BatchStarted'
)({
  /** Unique batch identifier */
  batchId: BatchId,

  /** Product code being manufactured */
  productCode: Schema.NonEmptyString,

  /** Lot number for traceability */
  lotNumber: Schema.NonEmptyString,

  /** User who started the batch */
  startedBy: Schema.NonEmptyString,

  /** Planned production quantity */
  plannedQuantity: Schema.Number.pipe(Schema.positive()),

  /** Equipment assets used in this batch */
  equipmentIds: Schema.Array(AssetId),

  /** FDA 21 CFR Part 11 electronic signature */
  electronicSignature: ElectronicSignature,

  /** Audit trail correlation ID */
  auditTrailId: Schema.NonEmptyString,
}) {}

export type BatchStartedType = typeof BatchStarted.Type

// =============================================================================
// ParameterRecorded — Critical Process Parameter Recorded
// =============================================================================

/**
 * ParameterRecorded event.
 *
 * Emitted when a critical process parameter is recorded during batch production.
 * Captures the actual measured value, specification compliance, and operator signature.
 *
 * FDA 21 CFR Part 11 Requirements:
 * - Electronic signature of person recording parameter
 * - Timestamped recording time (separate from event time)
 * - Audit trail ID for event correlation
 *
 * @example
 * ```typescript
 * const event = new ParameterRecorded({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'operator-001',
 *   entityId: sensorAssetId,
 *   entityType: 'sensor',
 *   batchId,
 *   parameterId,
 *   parameterName: 'Temperature',
 *   value: 72.5,
 *   unit: 'Celsius',
 *   recordedBy: 'operator-001',
 *   recordedAt: DateTime.unsafeNow(),
 *   withinSpec: true,
 *   electronicSignature: { ... },
 *   auditTrailId: 'AUD-2026-00002',
 * })
 * ```
 */
export class ParameterRecorded extends BaseOperationalEvent.extend<ParameterRecorded>(
  'ParameterRecorded'
)({
  /** Batch this parameter belongs to */
  batchId: BatchId,

  /** Unique parameter identifier */
  parameterId: ParameterId,

  /** Human-readable parameter name */
  parameterName: Schema.NonEmptyString,

  /** Recorded value (numeric for process parameters) */
  value: Schema.Number,

  /** Unit of measurement */
  unit: Schema.NonEmptyString,

  /** User who recorded the parameter */
  recordedBy: Schema.NonEmptyString,

  /** When the parameter was recorded (may differ from event time) */
  recordedAt: Schema.DateTimeUtc,

  /** Whether the value is within specification limits */
  withinSpec: Schema.Boolean,

  /** FDA 21 CFR Part 11 electronic signature */
  electronicSignature: ElectronicSignature,

  /** Audit trail correlation ID */
  auditTrailId: Schema.NonEmptyString,
}) {}

export type ParameterRecordedType = typeof ParameterRecorded.Type

// =============================================================================
// BatchCompleted — Batch Production Completed
// =============================================================================

/**
 * BatchCompleted event.
 *
 * Emitted when a batch production run is completed. Records final quantity,
 * yield percentage, and completion signature.
 *
 * FDA 21 CFR Part 11 Requirements:
 * - Electronic signature of person completing batch
 * - Completion timestamp in UTC
 * - Audit trail ID for event correlation
 *
 * @example
 * ```typescript
 * const event = new BatchCompleted({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'operator-001',
 *   entityId: equipmentAssetId,
 *   entityType: 'machine',
 *   batchId,
 *   completedBy: 'operator-001',
 *   actualQuantity: 980,
 *   yieldPercentage: 98.0,
 *   completedAt: DateTime.unsafeNow(),
 *   electronicSignature: { ... },
 *   auditTrailId: 'AUD-2026-00003',
 * })
 * ```
 */
export class BatchCompleted extends BaseOperationalEvent.extend<BatchCompleted>(
  'BatchCompleted'
)({
  /** Batch being completed */
  batchId: BatchId,

  /** User who completed the batch */
  completedBy: Schema.NonEmptyString,

  /** Actual quantity produced */
  actualQuantity: Schema.Number.pipe(Schema.positive()),

  /** Yield percentage (actual/planned * 100) */
  yieldPercentage: Schema.Number,

  /** When the batch was completed */
  completedAt: Schema.DateTimeUtc,

  /** FDA 21 CFR Part 11 electronic signature */
  electronicSignature: ElectronicSignature,

  /** Audit trail correlation ID */
  auditTrailId: Schema.NonEmptyString,
}) {}

export type BatchCompletedType = typeof BatchCompleted.Type

// =============================================================================
// BatchDeviation — Deviation from Batch Record Detected
// =============================================================================

/**
 * BatchDeviation event.
 *
 * Emitted when a deviation from the batch record is detected. Captures
 * deviation type, severity, description, and any corrective action taken.
 *
 * FDA 21 CFR Part 11 Requirements:
 * - Electronic signature of person detecting deviation
 * - Full description for regulatory review
 * - Corrective action documentation (optional)
 * - Audit trail ID for event correlation
 *
 * @example
 * ```typescript
 * const event = new BatchDeviation({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'operator-001',
 *   entityId: equipmentAssetId,
 *   entityType: 'machine',
 *   batchId,
 *   deviationId,
 *   deviationType: 'process',
 *   description: 'Temperature exceeded upper limit by 2 degrees',
 *   severity: 'major',
 *   detectedBy: 'operator-001',
 *   correctiveAction: Option.some('Adjusted cooling system'),
 *   electronicSignature: { ... },
 *   auditTrailId: 'AUD-2026-00004',
 * })
 * ```
 */
export class BatchDeviation extends BaseOperationalEvent.extend<BatchDeviation>(
  'BatchDeviation'
)({
  /** Batch where deviation occurred */
  batchId: BatchId,

  /** Unique deviation identifier */
  deviationId: DeviationId,

  /** Category of deviation */
  deviationType: DeviationType,

  /** Detailed description of the deviation */
  description: Schema.NonEmptyString,

  /** Impact severity */
  severity: DeviationSeverity,

  /** User who detected the deviation */
  detectedBy: Schema.NonEmptyString,

  /** Corrective action taken (optional) */
  correctiveAction: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** FDA 21 CFR Part 11 electronic signature */
  electronicSignature: ElectronicSignature,

  /** Audit trail correlation ID */
  auditTrailId: Schema.NonEmptyString,
}) {}

export type BatchDeviationType = typeof BatchDeviation.Type

// =============================================================================
// Union Type for All Batch Events
// =============================================================================

/**
 * Union of all batch record events for type guards and handlers.
 */
export type BatchEvent =
  | BatchStarted
  | ParameterRecorded
  | BatchCompleted
  | BatchDeviation

/**
 * Batch event tags for type narrowing.
 */
export const BATCH_EVENT_TAGS = [
  'BatchStarted',
  'ParameterRecorded',
  'BatchCompleted',
  'BatchDeviation',
] as const

export type BatchEventTag = (typeof BATCH_EVENT_TAGS)[number]
