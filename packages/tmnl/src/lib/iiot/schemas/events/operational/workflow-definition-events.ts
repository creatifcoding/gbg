/**
 * Workflow Definition Events — ISA-95 Level 3 Workflow Template Management
 *
 * Defines 5 operational events for workflow definition lifecycle management:
 * - DefinitionCreated: New workflow definition created
 * - DefinitionVersioned: New version of existing definition
 * - DefinitionActivated: Definition activated for use
 * - DefinitionDeprecated: Definition marked deprecated
 * - DefinitionArchived: Definition archived (no longer usable)
 *
 * These events are stored in EventLog (not TimescaleDB) for full audit trail.
 * Workflow definitions are templates that work orders instantiate.
 *
 * @module @gbg/tmnl/iiot/schemas/events/operational/workflow-definition-events
 * @see EL-3.11-12 for workflow definition event requirements
 * @see ISA-95/IEC 62264 for operations management
 */

import { Schema } from 'effect'
import { WorkflowDefinitionId, TaskDefinitionId } from '../../identifiers'
import { BaseOperationalEvent } from '../base'

// =============================================================================
// Supporting Types
// =============================================================================

/**
 * Task template within a workflow definition.
 *
 * Defines a task step that will be instantiated when a work order
 * is created from this workflow definition.
 */
export const TaskTemplate = Schema.Struct({
  /** Reference to task definition */
  taskDefinitionId: TaskDefinitionId,

  /** Human-readable name */
  name: Schema.NonEmptyString,

  /** Detailed description (optional) */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Estimated duration in minutes (optional) */
  estimatedDurationMinutes: Schema.optionalWith(
    Schema.Number.pipe(Schema.positive()),
    { as: 'Option' }
  ),

  /** Number of approvals required (0 = no approval needed) */
  requiredApprovals: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),

  /** Task definition IDs that must complete before this task */
  dependencies: Schema.Array(TaskDefinitionId),

  /** Execution order (for display and scheduling) */
  order: Schema.Number.pipe(Schema.int(), Schema.positive()),
})

export type TaskTemplate = Schema.Schema.Type<typeof TaskTemplate>

/**
 * Version change record for tracking modifications.
 */
export const VersionChange = Schema.Struct({
  /** Field that was changed */
  field: Schema.NonEmptyString,

  /** Previous value (stringified for audit) */
  oldValue: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** New value (stringified for audit) */
  newValue: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Reason for change (optional) */
  changeReason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

export type VersionChange = Schema.Schema.Type<typeof VersionChange>

// =============================================================================
// DefinitionCreated — New Workflow Definition Created
// =============================================================================

/**
 * DefinitionCreated event.
 *
 * Emitted when a new workflow definition is created. The definition starts
 * in 'draft' state and must be activated before use.
 *
 * @example
 * ```typescript
 * const event = new DefinitionCreated({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'engineer-001',
 *   entityId: definitionId as AssetId,
 *   entityType: 'workcell',
 *   definitionId,
 *   name: 'Preventive Maintenance',
 *   version: '1.0.0',
 *   createdBy: 'engineer-001',
 *   description: Option.some('Standard PM workflow'),
 *   taskTemplates: [...],
 * })
 * ```
 */
export class DefinitionCreated extends BaseOperationalEvent.extend<DefinitionCreated>(
  'DefinitionCreated'
)({
  /** Unique workflow definition identifier */
  definitionId: WorkflowDefinitionId,

  /** Human-readable workflow name */
  name: Schema.NonEmptyString,

  /** Semantic version (e.g., '1.0.0') */
  version: Schema.NonEmptyString,

  /** User who created the definition */
  createdBy: Schema.NonEmptyString,

  /** Detailed description (optional) */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Task templates that define the workflow structure */
  taskTemplates: Schema.Array(TaskTemplate),
}) {}

export type DefinitionCreatedType = typeof DefinitionCreated.Type

// =============================================================================
// DefinitionVersioned — New Version of Existing Definition
// =============================================================================

/**
 * DefinitionVersioned event.
 *
 * Emitted when a new version of an existing workflow definition is created.
 * Versions are immutable once created; changes create new versions.
 */
export class DefinitionVersioned extends BaseOperationalEvent.extend<DefinitionVersioned>(
  'DefinitionVersioned'
)({
  /** Workflow definition being versioned */
  definitionId: WorkflowDefinitionId,

  /** Previous version number */
  previousVersion: Schema.NonEmptyString,

  /** New version number */
  newVersion: Schema.NonEmptyString,

  /** List of changes made in this version */
  changes: Schema.Array(VersionChange),

  /** User who created the new version */
  versionedBy: Schema.NonEmptyString,

  /** Optional notes about the version changes */
  changeNotes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type DefinitionVersionedType = typeof DefinitionVersioned.Type

// =============================================================================
// DefinitionActivated — Definition Activated for Use
// =============================================================================

/**
 * DefinitionActivated event.
 *
 * Emitted when a workflow definition is activated and made available
 * for creating new work orders.
 */
export class DefinitionActivated extends BaseOperationalEvent.extend<DefinitionActivated>(
  'DefinitionActivated'
)({
  /** Workflow definition being activated */
  definitionId: WorkflowDefinitionId,

  /** Version being activated */
  version: Schema.NonEmptyString,

  /** User who activated the definition */
  activatedBy: Schema.NonEmptyString,

  /** When the definition becomes effective */
  effectiveFrom: Schema.DateTimeUtc,

  /** Previous active version (if any) */
  previousActiveVersion: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Activation notes (optional) */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type DefinitionActivatedType = typeof DefinitionActivated.Type

// =============================================================================
// DefinitionDeprecated — Definition Marked Deprecated
// =============================================================================

/**
 * DefinitionDeprecated event.
 *
 * Emitted when a workflow definition is marked as deprecated.
 * Deprecated definitions can still be used but new work orders
 * should use the replacement if provided.
 */
export class DefinitionDeprecated extends BaseOperationalEvent.extend<DefinitionDeprecated>(
  'DefinitionDeprecated'
)({
  /** Workflow definition being deprecated */
  definitionId: WorkflowDefinitionId,

  /** Version being deprecated */
  version: Schema.NonEmptyString,

  /** User who deprecated the definition */
  deprecatedBy: Schema.NonEmptyString,

  /** Reason for deprecation (required for audit) */
  reason: Schema.NonEmptyString,

  /** Replacement workflow definition (optional) */
  replacementId: Schema.optionalWith(WorkflowDefinitionId, { as: 'Option' }),

  /** When the definition was deprecated */
  deprecationDate: Schema.DateTimeUtc,

  /** When the definition will no longer be available (optional) */
  sunsetDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
}) {}

export type DefinitionDeprecatedType = typeof DefinitionDeprecated.Type

// =============================================================================
// DefinitionArchived — Definition Archived (No Longer Usable)
// =============================================================================

/**
 * DefinitionArchived event.
 *
 * Emitted when a workflow definition is archived and no longer available
 * for creating new work orders. Archived definitions are retained for
 * historical reference and audit compliance.
 */
export class DefinitionArchived extends BaseOperationalEvent.extend<DefinitionArchived>(
  'DefinitionArchived'
)({
  /** Workflow definition being archived */
  definitionId: WorkflowDefinitionId,

  /** Version being archived */
  version: Schema.NonEmptyString,

  /** User who archived the definition */
  archivedBy: Schema.NonEmptyString,

  /** Reason for archival (required for audit) */
  reason: Schema.NonEmptyString,

  /** Archive reference for retrieval (optional) */
  archiveReference: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Retention period in days for compliance (optional) */
  retentionPeriodDays: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
    { as: 'Option' }
  ),
}) {}

export type DefinitionArchivedType = typeof DefinitionArchived.Type

// =============================================================================
// Union Type for All Workflow Definition Events
// =============================================================================

/**
 * Union of all workflow definition events for type guards and handlers.
 */
export type WorkflowDefinitionEvent =
  | DefinitionCreated
  | DefinitionVersioned
  | DefinitionActivated
  | DefinitionDeprecated
  | DefinitionArchived

/**
 * Workflow definition event tags for type narrowing.
 */
export const WORKFLOW_DEFINITION_EVENT_TAGS = [
  'DefinitionCreated',
  'DefinitionVersioned',
  'DefinitionActivated',
  'DefinitionDeprecated',
  'DefinitionArchived',
] as const

export type WorkflowDefinitionEventTag = (typeof WORKFLOW_DEFINITION_EVENT_TAGS)[number]
