/**
 * WorkOrderContext Events — EL-3.5-8
 *
 * Defines 10 operational events for work order context management:
 * - ContextCreated: Initial context for work order
 * - ContextUpdated: Context field updated
 * - ContextSnapshotted: Immutable point-in-time snapshot
 * - AssetAttached: Asset linked to work order
 * - AssetDetached: Asset unlinked
 * - ResourceAllocated: Resource assigned (tools, materials)
 * - ResourceReleased: Resource freed
 * - ExternalRefLinked: External system reference added
 * - ExternalRefUnlinked: External reference removed
 * - ChildWorkOrderSpawned: Child work order created
 *
 * These events are stored in EventLog (not TimescaleDB) for full audit trail.
 * WorkOrderContext tracks assets involved, resources allocated, external
 * references (ERP, MES), and child work orders.
 *
 * @module @gbg/tmnl/iiot/schemas/events/operational/context-events
 * @see ISA-95 for operations management standard
 * @see ADR-0012 for ES boundaries
 */

import { Schema } from 'effect'
import {
  AssetId,
  WorkOrderId,
  WorkOrderContextId,
  ResourceId,
  ExternalRefId,
} from '../../identifiers'
import { BaseOperationalEvent } from '../base'
import { WorkOrderType } from '../../work-orders'

// Re-export branded types for convenience
export { WorkOrderContextId, ResourceId, ExternalRefId }

// =============================================================================
// Supporting Enums
// =============================================================================

/**
 * Type of resource allocated to a work order.
 */
export const ResourceType = Schema.Literal(
  'tool',
  'material',
  'consumable',
  'equipment',
  'personnel',
  'documentation',
  'other'
)
export type ResourceType = Schema.Schema.Type<typeof ResourceType>

/**
 * Reason for creating a snapshot.
 */
export const SnapshotReason = Schema.Literal(
  'phase_complete',
  'audit_request',
  'approval_checkpoint',
  'external_sync',
  'manual_request',
  'system_backup'
)
export type SnapshotReason = Schema.Schema.Type<typeof SnapshotReason>

// =============================================================================
// ContextCreated — Initial Context for Work Order
// =============================================================================

/**
 * ContextCreated event.
 *
 * Emitted when a work order context is first created. The context tracks
 * assets, resources, external references, and child work orders.
 *
 * @example
 * ```typescript
 * const event = new ContextCreated({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'wo-service',
 *   entityId: assetId as AssetId,
 *   entityType: 'machine',
 *   workOrderId,
 *   contextId,
 *   initialAssets: [primaryAssetId],
 *   metadata: Option.none(),
 * })
 * ```
 */
export class ContextCreated extends BaseOperationalEvent.extend<ContextCreated>(
  'ContextCreated'
)({
  /** Work order this context belongs to */
  workOrderId: WorkOrderId,

  /** Unique context identifier */
  contextId: WorkOrderContextId,

  /** Assets initially attached (may be empty) */
  initialAssets: Schema.Array(AssetId),

  /** Optional initial metadata */
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { as: 'Option' }
  ),
}) {}

export type ContextCreatedType = typeof ContextCreated.Type

// =============================================================================
// ContextUpdated — Context Field Updated
// =============================================================================

/**
 * ContextUpdated event.
 *
 * Emitted when a field in the work order context is updated.
 * Captures field name, previous value, and new value for audit.
 */
export class ContextUpdated extends BaseOperationalEvent.extend<ContextUpdated>(
  'ContextUpdated'
)({
  /** Work order this context belongs to */
  workOrderId: WorkOrderId,

  /** Context being updated */
  contextId: WorkOrderContextId,

  /** Name of the field being updated */
  fieldName: Schema.NonEmptyString,

  /** Previous value (if any) */
  previousValue: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),

  /** New value */
  newValue: Schema.Unknown,

  /** Reason for update */
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type ContextUpdatedType = typeof ContextUpdated.Type

// =============================================================================
// ContextSnapshotted — Immutable Point-in-Time Snapshot
// =============================================================================

/**
 * ContextSnapshotted event.
 *
 * Emitted when an immutable snapshot of the context is created.
 * Snapshots are used for audit trails, approval checkpoints, and
 * external system synchronization.
 */
export class ContextSnapshotted extends BaseOperationalEvent.extend<ContextSnapshotted>(
  'ContextSnapshotted'
)({
  /** Work order this context belongs to */
  workOrderId: WorkOrderId,

  /** Context being snapshotted */
  contextId: WorkOrderContextId,

  /** Unique identifier for this snapshot */
  snapshotId: Schema.NonEmptyString,

  /** Complete serialized context state at snapshot time */
  snapshotData: Schema.Record({ key: Schema.String, value: Schema.Unknown }),

  /** Reason for creating the snapshot */
  snapshotReason: SnapshotReason,

  /** Optional notes about the snapshot */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type ContextSnapshottedType = typeof ContextSnapshotted.Type

// =============================================================================
// AssetAttached — Asset Linked to Work Order
// =============================================================================

/**
 * AssetAttached event.
 *
 * Emitted when an asset is linked to the work order context.
 * Assets can have different roles (primary target, secondary, support).
 */
export class AssetAttached extends BaseOperationalEvent.extend<AssetAttached>(
  'AssetAttached'
)({
  /** Work order this context belongs to */
  workOrderId: WorkOrderId,

  /** Context the asset is attached to */
  contextId: WorkOrderContextId,

  /** Asset being attached */
  attachedAssetId: AssetId,

  /** Role of the asset in this work order */
  assetRole: Schema.Literal('primary_target', 'secondary_target', 'support', 'reference'),

  /** Optional notes about the attachment */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type AssetAttachedType = typeof AssetAttached.Type

// =============================================================================
// AssetDetached — Asset Unlinked
// =============================================================================

/**
 * AssetDetached event.
 *
 * Emitted when an asset is unlinked from the work order context.
 */
export class AssetDetached extends BaseOperationalEvent.extend<AssetDetached>(
  'AssetDetached'
)({
  /** Work order this context belongs to */
  workOrderId: WorkOrderId,

  /** Context the asset is detached from */
  contextId: WorkOrderContextId,

  /** Asset being detached */
  detachedAssetId: AssetId,

  /** Reason for detachment */
  reason: Schema.Literal('scope_change', 'error_correction', 'work_complete', 'asset_unavailable', 'other'),

  /** Optional notes about the detachment */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type AssetDetachedType = typeof AssetDetached.Type

// =============================================================================
// ResourceAllocated — Resource Assigned (Tools, Materials)
// =============================================================================

/**
 * ResourceAllocated event.
 *
 * Emitted when a resource (tool, material, equipment) is allocated to
 * the work order. Resources can be tracked with quantity and unit.
 */
export class ResourceAllocated extends BaseOperationalEvent.extend<ResourceAllocated>(
  'ResourceAllocated'
)({
  /** Work order this context belongs to */
  workOrderId: WorkOrderId,

  /** Context the resource is allocated to */
  contextId: WorkOrderContextId,

  /** Unique resource identifier */
  resourceId: ResourceId,

  /** Type of resource */
  resourceType: ResourceType,

  /** Human-readable resource name */
  resourceName: Schema.NonEmptyString,

  /** Quantity allocated (optional for tools) */
  quantity: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),

  /** Unit of measure for quantity */
  unit: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** User who allocated the resource */
  allocatedBy: Schema.NonEmptyString,

  /** Optional notes */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type ResourceAllocatedType = typeof ResourceAllocated.Type

// =============================================================================
// ResourceReleased — Resource Freed
// =============================================================================

/**
 * ResourceReleased event.
 *
 * Emitted when a resource is released from the work order context.
 */
export class ResourceReleased extends BaseOperationalEvent.extend<ResourceReleased>(
  'ResourceReleased'
)({
  /** Work order this context belongs to */
  workOrderId: WorkOrderId,

  /** Context the resource is released from */
  contextId: WorkOrderContextId,

  /** Resource being released */
  resourceId: ResourceId,

  /** Reason for release */
  releaseReason: Schema.Literal('work_complete', 'not_needed', 'replaced', 'returned_defective', 'other'),

  /** User who released the resource */
  releasedBy: Schema.NonEmptyString,

  /** Quantity returned (for consumables/materials) */
  quantityReturned: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),

  /** Condition notes (for tools/equipment) */
  conditionNotes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type ResourceReleasedType = typeof ResourceReleased.Type

// =============================================================================
// ExternalRefLinked — External System Reference Added
// =============================================================================

/**
 * ExternalRefLinked event.
 *
 * Emitted when an external system reference is linked to the work order.
 * External systems include ERP (SAP, Oracle), MES, CMMS, etc.
 */
export class ExternalRefLinked extends BaseOperationalEvent.extend<ExternalRefLinked>(
  'ExternalRefLinked'
)({
  /** Work order this context belongs to */
  workOrderId: WorkOrderId,

  /** Context the reference is linked to */
  contextId: WorkOrderContextId,

  /** Unique identifier for this reference link */
  externalRefId: ExternalRefId,

  /** Name of the external system (e.g., 'SAP', 'Oracle', 'Maximo') */
  externalSystem: Schema.NonEmptyString,

  /** Type of external entity (e.g., 'work_order', 'purchase_order', 'asset') */
  externalType: Schema.NonEmptyString,

  /** Identifier in the external system */
  externalIdentifier: Schema.NonEmptyString,

  /** URL to view the external entity (optional) */
  linkUrl: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Additional metadata from external system */
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { as: 'Option' }
  ),
}) {}

export type ExternalRefLinkedType = typeof ExternalRefLinked.Type

// =============================================================================
// ExternalRefUnlinked — External Reference Removed
// =============================================================================

/**
 * ExternalRefUnlinked event.
 *
 * Emitted when an external system reference is removed from the work order.
 */
export class ExternalRefUnlinked extends BaseOperationalEvent.extend<ExternalRefUnlinked>(
  'ExternalRefUnlinked'
)({
  /** Work order this context belongs to */
  workOrderId: WorkOrderId,

  /** Context the reference is unlinked from */
  contextId: WorkOrderContextId,

  /** Reference being unlinked */
  externalRefId: ExternalRefId,

  /** Reason for unlinking */
  reason: Schema.Literal('duplicate_link', 'error_correction', 'external_deleted', 'sync_failure', 'other'),

  /** Optional notes */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type ExternalRefUnlinkedType = typeof ExternalRefUnlinked.Type

// =============================================================================
// ChildWorkOrderSpawned — Child Work Order Created
// =============================================================================

/**
 * ChildWorkOrderSpawned event.
 *
 * Emitted when a child work order is created from the parent work order.
 * Child work orders can optionally inherit assets and resources.
 */
export class ChildWorkOrderSpawned extends BaseOperationalEvent.extend<ChildWorkOrderSpawned>(
  'ChildWorkOrderSpawned'
)({
  /** Parent work order */
  workOrderId: WorkOrderId,

  /** Parent context */
  contextId: WorkOrderContextId,

  /** Newly created child work order ID */
  childWorkOrderId: WorkOrderId,

  /** Type of the child work order */
  childType: WorkOrderType,

  /** Reason for spawning the child work order */
  reason: Schema.NonEmptyString,

  /** Whether child inherits parent's assets */
  inheritAssets: Schema.optionalWith(Schema.Boolean, { default: () => false }),

  /** Whether child inherits parent's resources */
  inheritResources: Schema.optionalWith(Schema.Boolean, { default: () => false }),
}) {}

export type ChildWorkOrderSpawnedType = typeof ChildWorkOrderSpawned.Type

// =============================================================================
// Union Type for All Context Events
// =============================================================================

/**
 * Union of all context events for type guards and handlers.
 */
export type ContextEvent =
  | ContextCreated
  | ContextUpdated
  | ContextSnapshotted
  | AssetAttached
  | AssetDetached
  | ResourceAllocated
  | ResourceReleased
  | ExternalRefLinked
  | ExternalRefUnlinked
  | ChildWorkOrderSpawned

/**
 * Context event tags for type narrowing.
 */
export const CONTEXT_EVENT_TAGS = [
  'ContextCreated',
  'ContextUpdated',
  'ContextSnapshotted',
  'AssetAttached',
  'AssetDetached',
  'ResourceAllocated',
  'ResourceReleased',
  'ExternalRefLinked',
  'ExternalRefUnlinked',
  'ChildWorkOrderSpawned',
] as const

export type ContextEventTag = (typeof CONTEXT_EVENT_TAGS)[number]
