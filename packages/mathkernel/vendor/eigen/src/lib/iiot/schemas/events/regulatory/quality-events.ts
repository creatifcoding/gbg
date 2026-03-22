/**
 * Quality Events - ISO 9001 Quality Management Events
 *
 * Defines 5 regulatory events for quality management:
 * - InspectionCompleted: Quality inspection completed
 * - NCROpened: Non-Conformance Report opened
 * - NCRClosed: NCR resolved and closed
 * - CAPACreated: Corrective/Preventive Action created
 * - CAPAResolved: CAPA completed and verified
 *
 * These events support the ISO 9001 quality loop:
 * Inspection -> NCR (if failed) -> CAPA -> Resolution
 *
 * NCR-CAPA Linking:
 * - NCRClosed can reference a CAPA via linkedCAPAId
 * - CAPACreated can reference multiple NCRs via linkedNCRIds
 *
 * These events are stored in EventLog (not TimescaleDB) for full audit trail.
 *
 * @module @gbg/tmnl/iiot/schemas/events/regulatory/quality-events
 * @see EL-5.6-9 for quality event requirements
 * @see ISO 9001:2015 for quality management systems
 */

import { Schema } from 'effect'
import { BaseOperationalEvent } from '../base'

// =============================================================================
// Branded Identifiers
// =============================================================================

/** Inspection identifier (e.g., 'INS-2026-00001') */
export const InspectionId = Schema.String.pipe(Schema.brand('InspectionId'))
export type InspectionId = Schema.Schema.Type<typeof InspectionId>

/** Non-Conformance Report identifier (e.g., 'NCR-2026-00001') */
export const NCRId = Schema.String.pipe(Schema.brand('NCRId'))
export type NCRId = Schema.Schema.Type<typeof NCRId>

/** Corrective/Preventive Action identifier (e.g., 'CAPA-2026-00001') */
export const CAPAId = Schema.String.pipe(Schema.brand('CAPAId'))
export type CAPAId = Schema.Schema.Type<typeof CAPAId>

// =============================================================================
// Enums / Literals
// =============================================================================

/**
 * Inspection result - outcome of a quality inspection.
 */
export const InspectionResult = Schema.Literal('pass', 'fail', 'conditional')
export type InspectionResult = Schema.Schema.Type<typeof InspectionResult>

/**
 * NCR severity levels per ISO 9001.
 * - minor: Does not affect product function/safety
 * - major: Affects product function but not safety
 * - critical: Affects product safety or regulatory compliance
 */
export const NCRSeverity = Schema.Literal('minor', 'major', 'critical')
export type NCRSeverity = Schema.Schema.Type<typeof NCRSeverity>

/**
 * CAPA type - corrective (reactive) vs preventive (proactive).
 */
export const CAPAType = Schema.Literal('corrective', 'preventive')
export type CAPAType = Schema.Schema.Type<typeof CAPAType>

/**
 * CAPA effectiveness rating after verification.
 */
export const EffectivenessRating = Schema.Literal(
  'effective',
  'partially_effective',
  'ineffective'
)
export type EffectivenessRating = Schema.Schema.Type<typeof EffectivenessRating>

// =============================================================================
// InspectionCompleted - Quality Inspection Completed
// =============================================================================

/**
 * InspectionCompleted event.
 *
 * Emitted when a quality inspection is completed. Records the inspection
 * result, criteria checked, and any measurements taken.
 *
 * @example
 * ```typescript
 * const event = new InspectionCompleted({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'inspector-123',
 *   entityId: assetId,
 *   entityType: 'machine',
 *   inspectionId,
 *   inspectorId: 'inspector-123',
 *   itemId: 'ITEM-001',
 *   result: 'pass',
 *   criteria: ['visual_check', 'dimension_check'],
 *   measurements: Option.some({ length: { value: 100.5, unit: 'mm' } }),
 * })
 * ```
 */
export class InspectionCompleted extends BaseOperationalEvent.extend<InspectionCompleted>(
  'InspectionCompleted'
)({
  /** Unique inspection identifier */
  inspectionId: InspectionId,

  /** Inspector who performed the inspection */
  inspectorId: Schema.NonEmptyString,

  /** Item/part/product being inspected */
  itemId: Schema.NonEmptyString,

  /** Inspection result: pass, fail, or conditional */
  result: InspectionResult,

  /** Criteria/checks performed during inspection */
  criteria: Schema.Array(Schema.String),

  /** Measurement data captured (optional) */
  measurements: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { as: 'Option' }
  ),
}) {}

export type InspectionCompletedType = typeof InspectionCompleted.Type

// =============================================================================
// NCROpened - Non-Conformance Report Opened
// =============================================================================

/**
 * NCROpened event.
 *
 * Emitted when a Non-Conformance Report is opened to document a quality
 * issue. NCRs are the starting point of the ISO 9001 quality loop.
 *
 * @example
 * ```typescript
 * const event = new NCROpened({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'quality-engineer-123',
 *   entityId: assetId,
 *   entityType: 'machine',
 *   ncrId,
 *   title: 'Out of tolerance dimension',
 *   description: 'Part dimension exceeds tolerance by 0.2mm',
 *   severity: 'major',
 *   affectedItems: ['ITEM-001', 'ITEM-002'],
 *   detectedBy: 'inspector-123',
 *   detectedAt: DateTime.unsafeNow(),
 * })
 * ```
 */
export class NCROpened extends BaseOperationalEvent.extend<NCROpened>(
  'NCROpened'
)({
  /** Unique NCR identifier */
  ncrId: NCRId,

  /** Human-readable NCR title */
  title: Schema.NonEmptyString,

  /** Detailed description of the non-conformance */
  description: Schema.NonEmptyString,

  /** Severity level: minor, major, critical */
  severity: NCRSeverity,

  /** List of affected items/parts/products */
  affectedItems: Schema.Array(Schema.String),

  /** Person who detected the issue */
  detectedBy: Schema.NonEmptyString,

  /** When the non-conformance was detected */
  detectedAt: Schema.DateTimeUtc,
}) {}

export type NCROpenedType = typeof NCROpened.Type

// =============================================================================
// NCRClosed - NCR Resolved and Closed
// =============================================================================

/**
 * NCRClosed event.
 *
 * Emitted when an NCR is resolved and closed. May link to a CAPA if
 * corrective/preventive action was required.
 *
 * @example
 * ```typescript
 * const event = new NCRClosed({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'quality-manager-123',
 *   entityId: assetId,
 *   entityType: 'machine',
 *   ncrId,
 *   closedBy: 'quality-manager-123',
 *   resolution: 'Parts reworked and re-inspected successfully',
 *   rootCause: 'Tool wear caused dimension drift',
 *   closedAt: DateTime.unsafeNow(),
 *   linkedCAPAId: Option.some(capaId),
 * })
 * ```
 */
export class NCRClosed extends BaseOperationalEvent.extend<NCRClosed>(
  'NCRClosed'
)({
  /** NCR being closed */
  ncrId: NCRId,

  /** User who closed the NCR */
  closedBy: Schema.NonEmptyString,

  /** Resolution description */
  resolution: Schema.NonEmptyString,

  /** Root cause analysis result */
  rootCause: Schema.NonEmptyString,

  /** When the NCR was closed */
  closedAt: Schema.DateTimeUtc,

  /** Linked CAPA if corrective/preventive action was taken (optional) */
  linkedCAPAId: Schema.optionalWith(CAPAId, { as: 'Option' }),
}) {}

export type NCRClosedType = typeof NCRClosed.Type

// =============================================================================
// CAPACreated - Corrective/Preventive Action Created
// =============================================================================

/**
 * CAPACreated event.
 *
 * Emitted when a Corrective or Preventive Action is created. CAPAs
 * address the root causes of quality issues identified in NCRs.
 *
 * @example
 * ```typescript
 * const event = new CAPACreated({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'quality-manager-123',
 *   entityId: assetId,
 *   entityType: 'machine',
 *   capaId,
 *   type: 'corrective',
 *   title: 'Implement tool wear monitoring',
 *   description: 'Add automated tool wear detection',
 *   linkedNCRIds: [ncrId1, ncrId2],
 *   assignedTo: 'maintenance-team',
 *   dueDate: DateTime.unsafeNow(),
 * })
 * ```
 */
export class CAPACreated extends BaseOperationalEvent.extend<CAPACreated>(
  'CAPACreated'
)({
  /** Unique CAPA identifier */
  capaId: CAPAId,

  /** CAPA type: corrective (reactive) or preventive (proactive) */
  type: CAPAType,

  /** Human-readable CAPA title */
  title: Schema.NonEmptyString,

  /** Detailed description of the action plan */
  description: Schema.NonEmptyString,

  /** NCRs that triggered this CAPA (one or more) */
  linkedNCRIds: Schema.Array(NCRId),

  /** Team/person responsible for implementing the CAPA */
  assignedTo: Schema.NonEmptyString,

  /** Target completion date */
  dueDate: Schema.DateTimeUtc,
}) {}

export type CAPACreatedType = typeof CAPACreated.Type

// =============================================================================
// CAPAResolved - CAPA Completed and Verified
// =============================================================================

/**
 * CAPAResolved event.
 *
 * Emitted when a CAPA is completed and its effectiveness verified.
 * Includes the verification method and effectiveness rating.
 *
 * @example
 * ```typescript
 * const event = new CAPAResolved({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'quality-manager-123',
 *   entityId: assetId,
 *   entityType: 'machine',
 *   capaId,
 *   resolvedBy: 'maintenance-lead-123',
 *   resolution: 'Tool wear monitoring system installed',
 *   verificationMethod: 'Monitored 100 parts with zero exceedances',
 *   effectivenessRating: 'effective',
 *   resolvedAt: DateTime.unsafeNow(),
 * })
 * ```
 */
export class CAPAResolved extends BaseOperationalEvent.extend<CAPAResolved>(
  'CAPAResolved'
)({
  /** CAPA being resolved */
  capaId: CAPAId,

  /** Person who completed/resolved the CAPA */
  resolvedBy: Schema.NonEmptyString,

  /** Description of actions taken */
  resolution: Schema.NonEmptyString,

  /** How effectiveness was verified */
  verificationMethod: Schema.NonEmptyString,

  /** Effectiveness rating after verification */
  effectivenessRating: EffectivenessRating,

  /** When the CAPA was resolved */
  resolvedAt: Schema.DateTimeUtc,
}) {}

export type CAPAResolvedType = typeof CAPAResolved.Type

// =============================================================================
// Union Type for All Quality Events
// =============================================================================

/**
 * Union of all quality events for type guards and handlers.
 */
export type QualityEvent =
  | InspectionCompleted
  | NCROpened
  | NCRClosed
  | CAPACreated
  | CAPAResolved

/**
 * Quality event tags for type narrowing.
 */
export const QUALITY_EVENT_TAGS = [
  'InspectionCompleted',
  'NCROpened',
  'NCRClosed',
  'CAPACreated',
  'CAPAResolved',
] as const

export type QualityEventTag = (typeof QUALITY_EVENT_TAGS)[number]
