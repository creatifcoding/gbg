/**
 * Workflow Definition Schemas
 *
 * Defines workflow templates that work orders are instantiated from.
 * Supports versioning, activation states, and change control per ISO 9001.
 *
 * @module
 * @see ADR-0012 for ES boundaries
 * @see ISA-95 Work Definition for template structure
 * @see ISO 9001 for document control requirements
 */

import { Schema } from 'effect'
import { WorkflowDefinitionId } from './identifiers'

// =============================================================================
// Workflow Definition Types
// =============================================================================

/**
 * Lifecycle state of a workflow definition.
 */
export const WorkflowDefinitionStatus = Schema.Literal(
  'draft',       // In development
  'active',      // Ready for use
  'deprecated',  // No new work orders, existing continue
  'archived'     // Removed from active list
)
export type WorkflowDefinitionStatus = Schema.Schema.Type<typeof WorkflowDefinitionStatus>

/**
 * Type of workflow definition.
 */
export const WorkflowType = Schema.Literal(
  'preventive_maintenance',
  'corrective_maintenance',
  'emergency_repair',
  'calibration',
  'inspection',
  'installation',
  'modification',
  'decommissioning',
  'production',
  'changeover',
  'cleaning',
  'quality_control',
  'other'
)
export type WorkflowType = Schema.Schema.Type<typeof WorkflowType>

/**
 * Semantic version for workflow definitions.
 */
export const SemanticVersion = Schema.String.pipe(
  Schema.pattern(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/)
)
export type SemanticVersion = Schema.Schema.Type<typeof SemanticVersion>

/**
 * Type of change in a version update.
 */
export const DefinitionChangeType = Schema.Literal(
  'task_added',
  'task_removed',
  'task_modified',
  'sequence_changed',
  'approval_changed',
  'metadata_updated',
  'documentation_updated'
)
export type DefinitionChangeType = Schema.Schema.Type<typeof DefinitionChangeType>

/**
 * Record of a change in a workflow definition version.
 */
export const DefinitionChange = Schema.Struct({
  changeType: DefinitionChangeType,
  description: Schema.String,
  affectedTaskIds: Schema.optionalWith(Schema.Array(Schema.String), { as: 'Option' }),
})
export type DefinitionChange = Schema.Schema.Type<typeof DefinitionChange>

// =============================================================================
// Task Definition (Template)
// =============================================================================

/**
 * Task definition within a workflow - the template for TaskInstances.
 */
export const TaskDefinition = Schema.Struct({
  /** Unique ID within workflow */
  id: Schema.String,

  /** Human-readable name */
  name: Schema.NonEmptyString,

  /** Task description/instructions */
  description: Schema.String,

  /** Type of task */
  type: Schema.Literal(
    'manual',
    'automated',
    'inspection',
    'approval',
    'documentation',
    'verification',
    'setup',
    'cleanup',
    'transport',
    'other'
  ),

  /** Sequence order (allows parallel tasks with same number) */
  sequenceNumber: Schema.Number,

  /** IDs of predecessor tasks (within this workflow) */
  predecessorIds: Schema.Array(Schema.String),

  /** Estimated duration in minutes */
  estimatedDuration: Schema.optionalWith(Schema.Number, { as: 'Option' }),

  /** Required role for execution */
  requiredRole: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Whether task can be skipped */
  skippable: Schema.optionalWith(Schema.Boolean, { default: () => false }),

  /** Approval type required for this task */
  approvalRequired: Schema.optionalWith(
    Schema.Literal('none', 'single', 'dual', 'supervisor', 'quality', 'manager'),
    { default: () => 'none' }
  ),

  /** Custom instructions/checklist items */
  instructions: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),

  /** Extensible configuration */
  config: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
})
export type TaskDefinition = Schema.Schema.Type<typeof TaskDefinition>

// =============================================================================
// Workflow Definition Entity
// =============================================================================

/**
 * Workflow Definition - template for work orders.
 *
 * Defines the tasks, sequence, and requirements for a type of work.
 * Supports versioning for change control per ISO 9001.
 */
export class WorkflowDefinition extends Schema.TaggedClass<WorkflowDefinition>()(
  'WorkflowDefinition',
  {
    /** Unique workflow definition identifier */
    id: WorkflowDefinitionId,

    /** Human-readable name */
    name: Schema.NonEmptyString,

    /** Detailed description */
    description: Schema.String,

    /** Type of workflow */
    type: WorkflowType,

    /** Current semantic version */
    version: SemanticVersion,

    /** Lifecycle status */
    status: WorkflowDefinitionStatus,

    /** Tasks in this workflow */
    tasks: Schema.Array(TaskDefinition),

    /** Default priority for work orders */
    defaultPriority: Schema.Literal('low', 'normal', 'high', 'urgent', 'emergency'),

    /** Estimated total duration in minutes */
    estimatedTotalDuration: Schema.optionalWith(Schema.Number, { as: 'Option' }),

    /** Required roles for execution */
    requiredRoles: Schema.Array(Schema.String),

    /** Applicable asset types */
    applicableAssetTypes: Schema.optionalWith(Schema.Array(Schema.String), {
      default: () => [],
    }),

    /** User who created the definition */
    createdBy: Schema.String,

    /** Creation timestamp */
    createdAt: Schema.DateTimeUtc,

    /** User who last modified */
    lastModifiedBy: Schema.String,

    /** Last modification timestamp */
    lastModifiedAt: Schema.DateTimeUtc,

    /** User who activated current version */
    activatedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),

    /** Activation timestamp */
    activatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

    /** Deprecation details */
    deprecatedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
    deprecatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
    deprecationReason: Schema.optionalWith(Schema.String, { as: 'Option' }),
    migrationPath: Schema.optionalWith(WorkflowDefinitionId, { as: 'Option' }),

    /** Version history */
    versionHistory: Schema.Array(
      Schema.Struct({
        version: SemanticVersion,
        changes: Schema.Array(DefinitionChange),
        versionedBy: Schema.String,
        versionedAt: Schema.DateTimeUtc,
      })
    ),

    /** Compliance tags (e.g., ['FDA', 'ISO-9001']) */
    complianceTags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),

    /** Extensible metadata */
    metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
      default: () => ({}),
    }),
  }
) {
  /**
   * Check if the definition is usable for new work orders.
   */
  isUsable(): boolean {
    return this.status === 'active'
  }

  /**
   * Check if the definition is in a terminal state.
   */
  isTerminal(): boolean {
    return this.status === 'archived'
  }

  /**
   * Get the task sequence (sorted by sequence number).
   */
  getTaskSequence(): readonly TaskDefinition[] {
    return [...this.tasks].sort((a, b) => a.sequenceNumber - b.sequenceNumber)
  }

  /**
   * Get tasks at a specific sequence number (parallel tasks).
   */
  getTasksAtSequence(sequenceNumber: number): readonly TaskDefinition[] {
    return this.tasks.filter((t) => t.sequenceNumber === sequenceNumber)
  }

  /**
   * Get predecessor tasks for a given task.
   */
  getPredecessors(taskId: string): readonly TaskDefinition[] {
    const task = this.tasks.find((t) => t.id === taskId)
    if (!task) return []
    return this.tasks.filter((t) => task.predecessorIds.includes(t.id))
  }
}

// =============================================================================
// Command Parameter Schemas
// =============================================================================

/** Parameters for creating a workflow definition */
export const CreateWorkflowDefinitionParams = Schema.Struct({
  name: Schema.NonEmptyString,
  description: Schema.String,
  type: WorkflowType,
  tasks: Schema.Array(TaskDefinition),
  defaultPriority: Schema.Literal('low', 'normal', 'high', 'urgent', 'emergency'),
  requiredRoles: Schema.Array(Schema.String),
  applicableAssetTypes: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  complianceTags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
})
export type CreateWorkflowDefinitionParams = Schema.Schema.Type<
  typeof CreateWorkflowDefinitionParams
>

/** Parameters for versioning a workflow definition */
export const VersionWorkflowDefinitionParams = Schema.Struct({
  definitionId: WorkflowDefinitionId,
  newVersion: SemanticVersion,
  changes: Schema.Array(DefinitionChange),
  tasks: Schema.Array(TaskDefinition), // Full new task list
})
export type VersionWorkflowDefinitionParams = Schema.Schema.Type<
  typeof VersionWorkflowDefinitionParams
>

/** Parameters for deprecating a workflow definition */
export const DeprecateWorkflowDefinitionParams = Schema.Struct({
  definitionId: WorkflowDefinitionId,
  reason: Schema.NonEmptyString,
  migrationPath: Schema.optionalWith(WorkflowDefinitionId, { as: 'Option' }),
})
export type DeprecateWorkflowDefinitionParams = Schema.Schema.Type<
  typeof DeprecateWorkflowDefinitionParams
>
