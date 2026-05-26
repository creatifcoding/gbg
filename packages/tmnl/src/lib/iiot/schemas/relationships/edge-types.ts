/**
 * Schema-backed relationship edge registry.
 *
 * The graph is traversable topology; this registry is the allowlist that keeps
 * dynamic Cypher construction honest. Labels and edge types must come from
 * these literals before GraphClient may interpolate them into Cypher.
 *
 * @module
 */

import { Schema } from 'effect'
import { EdgeId } from '../identifiers'
import type {
  AlarmId,
  AreaId,
  DeviceId,
  EnterpriseId,
  ExternalRefId,
  LineId,
  MachineId,
  PlantId,
  SensorId,
  SiteId,
  WorkCellId,
  WorkOrderId,
} from '../identifiers'

export const RELATIONSHIP_NODE_TYPE_VALUES = [
  'enterprise',
  'site',
  'area',
  'plant',
  'line',
  'workcell',
  'machine',
  'sensor',
  'device',
  'alarm',
  'work_order',
  'external',
] as const

export const RelationshipNodeType = Schema.Literal(...RELATIONSHIP_NODE_TYPE_VALUES)
export type RelationshipNodeType = typeof RelationshipNodeType.Type

export const RelationshipNodeTypes = {
  Enterprise: 'enterprise',
  Site: 'site',
  Area: 'area',
  Plant: 'plant',
  Line: 'line',
  WorkCell: 'workcell',
  Machine: 'machine',
  Sensor: 'sensor',
  Device: 'device',
  Alarm: 'alarm',
  WorkOrder: 'work_order',
  External: 'external',
} as const satisfies Record<string, RelationshipNodeType>

export const RELATIONSHIP_EDGE_TYPE_VALUES = [
  'targets',
  'requires',
  'caused_by',
  'depends_on',
  'related_to',
  'supervises',
  'produces',
  'contains',
  'monitors',
  'triggered_by',
] as const

export const RelationshipEdgeType = Schema.Literal(...RELATIONSHIP_EDGE_TYPE_VALUES)
export type RelationshipEdgeType = typeof RelationshipEdgeType.Type

export const RelationshipEdgeTypes = {
  Targets: 'targets',
  Requires: 'requires',
  CausedBy: 'caused_by',
  DependsOn: 'depends_on',
  RelatedTo: 'related_to',
  Supervises: 'supervises',
  Produces: 'produces',
  Contains: 'contains',
  Monitors: 'monitors',
  TriggeredBy: 'triggered_by',
} as const satisfies Record<string, RelationshipEdgeType>

export const RelationshipDirectionality = Schema.Literal('directed', 'bidirectional')
export type RelationshipDirectionality = typeof RelationshipDirectionality.Type

export const RelationshipTraversalDirection = Schema.Literal('source_to_target', 'target_to_source')
export type RelationshipTraversalDirection = typeof RelationshipTraversalDirection.Type

export const PropagationEffect = Schema.Literal('informational', 'consistency', 'blocking')
export type PropagationEffect = typeof PropagationEffect.Type

export const PropagationIdempotencyStrategy = Schema.Literal('source_propagation_id', 'event_journal_entry_id', 'none')
export type PropagationIdempotencyStrategy = typeof PropagationIdempotencyStrategy.Type

export const RelationshipEdgeEndpoint = Schema.Literal('source', 'target')
export type RelationshipEdgeEndpoint = typeof RelationshipEdgeEndpoint.Type

export const PropagationPolicyId = Schema.String.pipe(Schema.brand('PropagationPolicyId'))
export type PropagationPolicyId = typeof PropagationPolicyId.Type

export const EntityCapabilityId = Schema.String.pipe(Schema.brand('EntityCapabilityId'))
export type EntityCapabilityId = typeof EntityCapabilityId.Type

export const EntityCapabilityIds = {
  DependencyBlocked: 'dependency.blocked' as EntityCapabilityId,
  DependencyReleased: 'dependency.released' as EntityCapabilityId,
  DependencySatisfied: 'dependency.satisfied' as EntityCapabilityId,
  DependencyReplanRequired: 'dependency.replan_required' as EntityCapabilityId,
  SafetyHold: 'safety.hold' as EntityCapabilityId,
  SafetyRelease: 'safety.release' as EntityCapabilityId,
  QualityHold: 'quality.hold' as EntityCapabilityId,
  QualityRelease: 'quality.release' as EntityCapabilityId,
  ApprovalHold: 'approval.hold' as EntityCapabilityId,
  LifecycleInherited: 'lifecycle.inherited' as EntityCapabilityId,
  CapacityDegraded: 'capacity.degraded' as EntityCapabilityId,
} as const

export const KnownEntityCapabilityId = Schema.Literal(
  EntityCapabilityIds.DependencyBlocked,
  EntityCapabilityIds.DependencyReleased,
  EntityCapabilityIds.DependencySatisfied,
  EntityCapabilityIds.DependencyReplanRequired,
  EntityCapabilityIds.SafetyHold,
  EntityCapabilityIds.SafetyRelease,
  EntityCapabilityIds.QualityHold,
  EntityCapabilityIds.QualityRelease,
  EntityCapabilityIds.ApprovalHold,
  EntityCapabilityIds.LifecycleInherited,
  EntityCapabilityIds.CapacityDegraded,
)
export type KnownEntityCapabilityId = typeof KnownEntityCapabilityId.Type

export const KNOWN_ENTITY_CAPABILITY_IDS = Object.freeze(Object.values(EntityCapabilityIds))

export const ObservationSignalKind = Schema.Literal(
  'condition_asserted',
  'condition_retracted',
  'state_changed',
  'entity_created',
  'entity_deleted',
)
export type ObservationSignalKind = typeof ObservationSignalKind.Type

export class SignalMatcher extends Schema.TaggedClass<SignalMatcher>()('SignalMatcher', {
  axis: Schema.String,
  kind: Schema.optional(ObservationSignalKind),
  value: Schema.optional(Schema.String),
}) {}
export type SignalMatcher = typeof SignalMatcher.Type

export class EntityReactionRequestTemplate extends Schema.TaggedClass<EntityReactionRequestTemplate>()('EntityReactionRequestTemplate', {
  capability: EntityCapabilityId,
  reason: Schema.optional(Schema.String),
  payloadDefaults: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}
export type EntityReactionRequestTemplate = typeof EntityReactionRequestTemplate.Type

export const ConstraintAddressPropagationIdSource = Schema.Literal('current', 'caused_by', 'payload')
export type ConstraintAddressPropagationIdSource = typeof ConstraintAddressPropagationIdSource.Type

export class RelationshipConstraintAddressHint extends Schema.TaggedClass<RelationshipConstraintAddressHint>()('RelationshipConstraintAddressHint', {
  assertedCapability: EntityCapabilityId,
  assertionPolicyId: PropagationPolicyId,
  propagationIdSource: ConstraintAddressPropagationIdSource,
  notes: Schema.optional(Schema.String),
}) {}
export type RelationshipConstraintAddressHint = typeof RelationshipConstraintAddressHint.Type

export class RelationshipPropagationPolicy extends Schema.TaggedClass<RelationshipPropagationPolicy>()('RelationshipPropagationPolicy', {
  id: PropagationPolicyId,
  edgeType: RelationshipEdgeType,
  observedEndpoint: RelationshipEdgeEndpoint,
  accepts: SignalMatcher,
  requestEndpoint: RelationshipEdgeEndpoint,
  request: EntityReactionRequestTemplate,
  effect: PropagationEffect,
  idempotencyStrategy: PropagationIdempotencyStrategy,
  version: Schema.String,
  constraintAddressHint: Schema.optional(RelationshipConstraintAddressHint),
}) {}
export type RelationshipPropagationPolicy = typeof RelationshipPropagationPolicy.Type

export class RelationshipEndpoint extends Schema.TaggedClass<RelationshipEndpoint>()('RelationshipEndpoint', {
  type: RelationshipNodeType,
  id: Schema.String,
}) {}
export type RelationshipEndpoint = typeof RelationshipEndpoint.Type

/**
 * Input shape accepted at GraphClient boundaries.
 *
 * `RelationshipEndpoint` is a tagged runtime value; this untagged schema lets
 * callers pass descriptor/factory results or plain data while GraphClient still
 * validates labels before Cypher interpolation.
 */
export const RelationshipEndpointInput = Schema.Struct({
  type: RelationshipNodeType,
  id: Schema.String,
})
export type RelationshipEndpointInput = typeof RelationshipEndpointInput.Type

export const RelationshipEndpoints = {
  enterprise: (id: EnterpriseId | string) => new RelationshipEndpoint({ type: RelationshipNodeTypes.Enterprise, id: String(id) }),
  site: (id: SiteId | string) => new RelationshipEndpoint({ type: RelationshipNodeTypes.Site, id: String(id) }),
  area: (id: AreaId | string) => new RelationshipEndpoint({ type: RelationshipNodeTypes.Area, id: String(id) }),
  plant: (id: PlantId | string) => new RelationshipEndpoint({ type: RelationshipNodeTypes.Plant, id: String(id) }),
  line: (id: LineId | string) => new RelationshipEndpoint({ type: RelationshipNodeTypes.Line, id: String(id) }),
  workcell: (id: WorkCellId | string) => new RelationshipEndpoint({ type: RelationshipNodeTypes.WorkCell, id: String(id) }),
  machine: (id: MachineId | string) => new RelationshipEndpoint({ type: RelationshipNodeTypes.Machine, id: String(id) }),
  sensor: (id: SensorId | DeviceId | string) => new RelationshipEndpoint({ type: RelationshipNodeTypes.Sensor, id: String(id) }),
  device: (id: DeviceId | string) => new RelationshipEndpoint({ type: RelationshipNodeTypes.Device, id: String(id) }),
  alarm: (id: AlarmId | string) => new RelationshipEndpoint({ type: RelationshipNodeTypes.Alarm, id: String(id) }),
  workOrder: (id: WorkOrderId | string) => new RelationshipEndpoint({ type: RelationshipNodeTypes.WorkOrder, id: String(id) }),
  external: (id: ExternalRefId | string) => new RelationshipEndpoint({ type: RelationshipNodeTypes.External, id: String(id) }),
  of: (type: RelationshipNodeType, id: string) => new RelationshipEndpoint({ type, id }),
} as const

export class RelationshipEdgeMetadata extends Schema.TaggedClass<RelationshipEdgeMetadata>()('RelationshipEdgeMetadata', {
  edgeId: Schema.optional(EdgeId),
  createdBy: Schema.String,
  reason: Schema.optional(Schema.String),
  validFrom: Schema.optional(Schema.String),
  context: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}
export type RelationshipEdgeMetadata = typeof RelationshipEdgeMetadata.Type

export const RelationshipEdgeMetadataInput = Schema.Struct({
  edgeId: Schema.optional(EdgeId),
  createdBy: Schema.String,
  reason: Schema.optional(Schema.String),
  validFrom: Schema.optional(Schema.String),
  context: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
})
export type RelationshipEdgeMetadataInput = typeof RelationshipEdgeMetadataInput.Type

export class RelationshipEdgeRef extends Schema.TaggedClass<RelationshipEdgeRef>()('RelationshipEdgeRef', {
  source: RelationshipEndpoint,
  target: RelationshipEndpoint,
  edgeType: RelationshipEdgeType,
}) {}
export type RelationshipEdgeRef = typeof RelationshipEdgeRef.Type

export class RelationshipEdgeUpsert extends Schema.TaggedClass<RelationshipEdgeUpsert>()('RelationshipEdgeUpsert', {
  source: RelationshipEndpoint,
  target: RelationshipEndpoint,
  edgeType: RelationshipEdgeType,
  metadata: RelationshipEdgeMetadata,
}) {}
export type RelationshipEdgeUpsert = typeof RelationshipEdgeUpsert.Type

export const RelationshipEdgeRefInput = Schema.Struct({
  source: RelationshipEndpointInput,
  target: RelationshipEndpointInput,
  edgeType: RelationshipEdgeType,
})
export type RelationshipEdgeRefInput = typeof RelationshipEdgeRefInput.Type

export const RelationshipEdgeUpsertInput = Schema.Struct({
  source: RelationshipEndpointInput,
  target: RelationshipEndpointInput,
  edgeType: RelationshipEdgeType,
  metadata: RelationshipEdgeMetadataInput,
})
export type RelationshipEdgeUpsertInput = typeof RelationshipEdgeUpsertInput.Type

export class PropagationSourcePredicate extends Schema.TaggedClass<PropagationSourcePredicate>()('PropagationSourcePredicate', {
  eventTag: Schema.String,
  stateField: Schema.optional(Schema.String),
  states: Schema.Array(Schema.String),
}) {}
export type PropagationSourcePredicate = typeof PropagationSourcePredicate.Type

export class PropagationTargetCommand extends Schema.TaggedClass<PropagationTargetCommand>()('PropagationTargetCommand', {
  targetEntityType: RelationshipNodeType,
  commandTag: Schema.String,
  reason: Schema.optional(Schema.String),
  payloadDefaults: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {}
export type PropagationTargetCommand = typeof PropagationTargetCommand.Type

export class PropagationDescriptor extends Schema.TaggedClass<PropagationDescriptor>()('PropagationDescriptor', {
  id: Schema.String,
  label: Schema.String,
  effect: PropagationEffect,
  sourceEntityType: RelationshipNodeType,
  targetEntityType: RelationshipNodeType,
  relationshipTraversal: RelationshipTraversalDirection,
  sourcePredicate: PropagationSourcePredicate,
  targetCommand: PropagationTargetCommand,
  idempotencyStrategy: PropagationIdempotencyStrategy,
  eligibilityPolicy: Schema.optional(Schema.String),
}) {}
export type PropagationDescriptor = typeof PropagationDescriptor.Type

export class RelationshipEdgeDescriptor extends Schema.TaggedClass<RelationshipEdgeDescriptor>()('RelationshipEdgeDescriptor', {
  edgeType: RelationshipEdgeType,
  directionality: RelationshipDirectionality,
  allowedSourceTypes: Schema.Array(RelationshipNodeType),
  allowedTargetTypes: Schema.Array(RelationshipNodeType),
  propagationDescriptors: Schema.Array(PropagationDescriptor),
  propagationPolicies: Schema.Array(RelationshipPropagationPolicy),
}) {}
export type RelationshipEdgeDescriptor = typeof RelationshipEdgeDescriptor.Type

const descriptor = (
  edgeType: RelationshipEdgeType,
  directionality: RelationshipDirectionality,
  allowedSourceTypes: readonly RelationshipNodeType[],
  allowedTargetTypes: readonly RelationshipNodeType[],
  propagationDescriptors: readonly PropagationDescriptor[] = [],
  propagationPolicies: readonly RelationshipPropagationPolicy[] = [],
) => new RelationshipEdgeDescriptor({
  edgeType,
  directionality,
  allowedSourceTypes: Array.from(allowedSourceTypes),
  allowedTargetTypes: Array.from(allowedTargetTypes),
  propagationDescriptors: Array.from(propagationDescriptors),
  propagationPolicies: Array.from(propagationPolicies),
})

export const MachineUnavailableSuspendsWorkOrder = new PropagationDescriptor({
  id: 'machine-unavailable-suspends-work-order',
  label: 'Machine unavailable suspends active targeted WorkOrders',
  effect: 'consistency',
  sourceEntityType: 'machine',
  targetEntityType: 'work_order',
  relationshipTraversal: 'target_to_source',
  sourcePredicate: new PropagationSourcePredicate({
    eventTag: 'EquipmentStateChanged',
    stateField: 'newState',
    states: ['maintenance', 'planned_downtime', 'unplanned_downtime', 'faulted', 'offline'],
  }),
  targetCommand: new PropagationTargetCommand({
    targetEntityType: 'work_order',
    commandTag: 'WorkOrder.Suspend',
    reason: 'equipment_unavailable',
    payloadDefaults: { reason: 'equipment_unavailable' },
  }),
  idempotencyStrategy: 'source_propagation_id',
  eligibilityPolicy: 'work_order.active_started_or_resumed',
})

/**
 * Relationship-scoped replacement for the legacy scenario descriptor above.
 *
 * The relationship says a signal observed on the machine endpoint should be
 * routed to the work order endpoint as a dependency request. The WorkOrder
 * entity decides whether that request becomes a suspend transition.
 */
export const TargetsMachineUnavailableBlocksSource = new RelationshipPropagationPolicy({
  id: 'targets.machine-unavailable.blocks-source' as never,
  edgeType: 'targets',
  observedEndpoint: 'target',
  accepts: new SignalMatcher({
    axis: 'equipment.availability',
    kind: 'condition_asserted',
    value: 'unavailable',
  }),
  requestEndpoint: 'source',
  request: new EntityReactionRequestTemplate({
    capability: EntityCapabilityIds.DependencyBlocked,
    reason: 'target_unavailable',
    payloadDefaults: { dependencyKind: 'equipment', suspensionReason: 'equipment_unavailable' },
  }),
  effect: 'blocking',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
})

/**
 * A required machine becoming unavailable blocks WorkOrders that require it.
 *
 * This is distinct from `targets`: `targets` means the WorkOrder is performed
 * against an asset, while `requires` means the WorkOrder depends on an asset or
 * system being available to proceed.
 */
export const RequiresEquipmentUnavailableBlocksSource = new RelationshipPropagationPolicy({
  id: 'requires.equipment-unavailable.blocks-source' as never,
  edgeType: 'requires',
  observedEndpoint: 'target',
  accepts: new SignalMatcher({
    axis: 'equipment.availability',
    kind: 'condition_asserted',
    value: 'unavailable',
  }),
  requestEndpoint: 'source',
  request: new EntityReactionRequestTemplate({
    capability: EntityCapabilityIds.DependencyBlocked,
    reason: 'required_equipment_unavailable',
    payloadDefaults: { dependencyKind: 'equipment', suspensionReason: 'equipment_unavailable' },
  }),
  effect: 'blocking',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
})

/**
 * A WorkOrder suspended/failed/cancelled state observed on the target endpoint
 * blocks upstream WorkOrders that depend_on it. This is a routing contract only;
 * the dependent WorkOrder still owns eligibility and local transition.
 */
export const DependsOnWorkOrderBlockedBlocksSource = new RelationshipPropagationPolicy({
  id: 'depends_on.work-order-blocked.blocks-source' as never,
  edgeType: 'depends_on',
  observedEndpoint: 'target',
  accepts: new SignalMatcher({
    axis: 'work_order.execution',
    kind: 'condition_asserted',
    value: 'blocked',
  }),
  requestEndpoint: 'source',
  request: new EntityReactionRequestTemplate({
    capability: EntityCapabilityIds.DependencyBlocked,
    reason: 'dependent_work_order_blocked',
    payloadDefaults: { dependencyKind: 'work_order', suspensionReason: 'external_dependency' },
  }),
  effect: 'blocking',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
})

/**
 * A dependent WorkOrder completing means the source WorkOrder's dependency has
 * been satisfied. Dispatch requires a target contract to decide whether this is
 * informational, progression, or no-op for the source state machine.
 */
export const DependsOnWorkOrderSatisfiedSatisfiesSource = new RelationshipPropagationPolicy({
  id: 'depends_on.work-order-satisfied.satisfies-source' as never,
  edgeType: 'depends_on',
  observedEndpoint: 'target',
  accepts: new SignalMatcher({
    axis: 'work_order.execution',
    kind: 'condition_asserted',
    value: 'satisfied',
  }),
  requestEndpoint: 'source',
  request: new EntityReactionRequestTemplate({
    capability: EntityCapabilityIds.DependencySatisfied,
    reason: 'dependent_work_order_satisfied',
    payloadDefaults: { dependencyKind: 'work_order' },
  }),
  effect: 'consistency',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
})

/**
 * A dependent WorkOrder resuming retracts an upstream blocked condition. The
 * release adapter still requires explicit constraint identity at dispatch time;
 * this policy documents the routing contract and is not enabled in generic live
 * registry until constraint-address enrichment exists for depends_on releases.
 */
export const DependsOnWorkOrderBlockRetractedReleasesSource = new RelationshipPropagationPolicy({
  id: 'depends_on.work-order-block-retracted.releases-source' as never,
  edgeType: 'depends_on',
  observedEndpoint: 'target',
  accepts: new SignalMatcher({
    axis: 'work_order.execution',
    kind: 'condition_retracted',
    value: 'blocked',
  }),
  requestEndpoint: 'source',
  request: new EntityReactionRequestTemplate({
    capability: EntityCapabilityIds.DependencyReleased,
    reason: 'dependent_work_order_unblocked',
    payloadDefaults: { dependencyKind: 'work_order' },
  }),
  effect: 'consistency',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
  constraintAddressHint: new RelationshipConstraintAddressHint({
    assertedCapability: EntityCapabilityIds.DependencyBlocked,
    assertionPolicyId: DependsOnWorkOrderBlockedBlocksSource.id,
    propagationIdSource: 'caused_by',
    notes: 'WorkOrderResumed observations keep their own source-entry propagation id for target audit and carry the original blocked propagation id as causedByPropagationId for exact constraint addressing.',
  }),
})

export const WorkOrderDependsOnPropagationPolicies = [
  DependsOnWorkOrderBlockedBlocksSource,
  DependsOnWorkOrderSatisfiedSatisfiesSource,
  DependsOnWorkOrderBlockRetractedReleasesSource,
] as const

/**
 * A critical/emergency alarm observed on an asset targeted by a WorkOrder applies
 * target-owned safety pressure. The observed endpoint is the target asset, not
 * the alarm node, because the current generic Reactor graph expansion is a
 * single-edge traversal.
 */
export const TargetsAlarmSafetyHoldHoldsSource = new RelationshipPropagationPolicy({
  id: 'targets.alarm-safety-hold.holds-source' as never,
  edgeType: 'targets',
  observedEndpoint: 'target',
  accepts: new SignalMatcher({
    axis: 'alarm.safety',
    kind: 'condition_asserted',
    value: 'hold',
  }),
  requestEndpoint: 'source',
  request: new EntityReactionRequestTemplate({
    capability: EntityCapabilityIds.SafetyHold,
    reason: 'target_alarm_safety_hold',
    payloadDefaults: { holdKind: 'alarm', suspensionReason: 'safety_hold' },
  }),
  effect: 'blocking',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
})

/**
 * A critical/emergency alarm observed on a required asset applies safety pressure
 * to WorkOrders that require that asset.
 */
export const RequiresAlarmSafetyHoldHoldsSource = new RelationshipPropagationPolicy({
  id: 'requires.alarm-safety-hold.holds-source' as never,
  edgeType: 'requires',
  observedEndpoint: 'target',
  accepts: new SignalMatcher({
    axis: 'alarm.safety',
    kind: 'condition_asserted',
    value: 'hold',
  }),
  requestEndpoint: 'source',
  request: new EntityReactionRequestTemplate({
    capability: EntityCapabilityIds.SafetyHold,
    reason: 'required_asset_alarm_safety_hold',
    payloadDefaults: { holdKind: 'alarm', suspensionReason: 'safety_hold' },
  }),
  effect: 'blocking',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
})

/**
 * Alarm clearing retracts safety pressure for WorkOrders targeting the affected
 * asset. Actual resume/unhold remains target-owned and SQL-constraint aware.
 */
export const TargetsAlarmSafetyHoldRetractedReleasesSource = new RelationshipPropagationPolicy({
  id: 'targets.alarm-safety-hold-retracted.releases-source' as never,
  edgeType: 'targets',
  observedEndpoint: 'target',
  accepts: new SignalMatcher({
    axis: 'alarm.safety',
    kind: 'condition_retracted',
    value: 'hold',
  }),
  requestEndpoint: 'source',
  request: new EntityReactionRequestTemplate({
    capability: EntityCapabilityIds.SafetyRelease,
    reason: 'target_alarm_safety_hold_retracted',
    payloadDefaults: { holdKind: 'alarm' },
  }),
  effect: 'consistency',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
  constraintAddressHint: new RelationshipConstraintAddressHint({
    assertedCapability: EntityCapabilityIds.SafetyHold,
    assertionPolicyId: TargetsAlarmSafetyHoldHoldsSource.id,
    propagationIdSource: 'current',
    notes: 'Alarm safety observations use alarmId as the stable propagation id so AlarmCleared can retract the exact AlarmTriggered/Escalated safety hold.',
  }),
})

/**
 * Alarm clearing retracts safety pressure for WorkOrders requiring the affected
 * asset. The release capability is deliberately separate from dependency release.
 */
export const RequiresAlarmSafetyHoldRetractedReleasesSource = new RelationshipPropagationPolicy({
  id: 'requires.alarm-safety-hold-retracted.releases-source' as never,
  edgeType: 'requires',
  observedEndpoint: 'target',
  accepts: new SignalMatcher({
    axis: 'alarm.safety',
    kind: 'condition_retracted',
    value: 'hold',
  }),
  requestEndpoint: 'source',
  request: new EntityReactionRequestTemplate({
    capability: EntityCapabilityIds.SafetyRelease,
    reason: 'required_asset_alarm_safety_hold_retracted',
    payloadDefaults: { holdKind: 'alarm' },
  }),
  effect: 'consistency',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
  constraintAddressHint: new RelationshipConstraintAddressHint({
    assertedCapability: EntityCapabilityIds.SafetyHold,
    assertionPolicyId: RequiresAlarmSafetyHoldHoldsSource.id,
    propagationIdSource: 'current',
    notes: 'Alarm safety observations use alarmId as the stable propagation id so AlarmCleared can retract the exact required-asset safety hold.',
  }),
})

export const AlarmSafetyHoldPropagationPolicies = [
  TargetsAlarmSafetyHoldHoldsSource,
  RequiresAlarmSafetyHoldHoldsSource,
  TargetsAlarmSafetyHoldRetractedReleasesSource,
  RequiresAlarmSafetyHoldRetractedReleasesSource,
] as const

/**
 * Parent structural decommission cascades to contained child nodes. This is a
 * declaration only; structural targets must own whether inherited lifecycle
 * pressure closes child edges, emits child decommission events, or defers.
 */
export const ContainsStructuralDecommissionInheritsTarget = new RelationshipPropagationPolicy({
  id: 'contains.structural-decommission.inherits-target' as never,
  edgeType: 'contains',
  observedEndpoint: 'source',
  accepts: new SignalMatcher({
    axis: 'structural.lifecycle',
    kind: 'condition_asserted',
    value: 'decommissioned',
  }),
  requestEndpoint: 'target',
  request: new EntityReactionRequestTemplate({
    capability: EntityCapabilityIds.LifecycleInherited,
    reason: 'parent_structural_decommissioned',
    payloadDefaults: { lifecycleKind: 'decommission', inheritance: 'contains' },
  }),
  effect: 'consistency',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
})

/**
 * A targeted structural asset being decommissioned blocks WorkOrders that target
 * it. WorkOrder remains the target owner for eligibility, constraints, audit,
 * and emitted state-transition events.
 */
export const TargetsStructuralDecommissionBlocksSource = new RelationshipPropagationPolicy({
  id: 'targets.structural-decommission.blocks-source' as never,
  edgeType: 'targets',
  observedEndpoint: 'target',
  accepts: new SignalMatcher({
    axis: 'structural.lifecycle',
    kind: 'condition_asserted',
    value: 'decommissioned',
  }),
  requestEndpoint: 'source',
  request: new EntityReactionRequestTemplate({
    capability: EntityCapabilityIds.DependencyBlocked,
    reason: 'target_structural_decommissioned',
    payloadDefaults: { dependencyKind: 'structural', suspensionReason: 'equipment_unavailable' },
  }),
  effect: 'blocking',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
})

/**
 * A required structural asset being decommissioned blocks WorkOrders that require
 * it. This is separate from machine availability so decommission constraints can
 * retain their own SQL source identity.
 */
export const RequiresStructuralDecommissionBlocksSource = new RelationshipPropagationPolicy({
  id: 'requires.structural-decommission.blocks-source' as never,
  edgeType: 'requires',
  observedEndpoint: 'target',
  accepts: new SignalMatcher({
    axis: 'structural.lifecycle',
    kind: 'condition_asserted',
    value: 'decommissioned',
  }),
  requestEndpoint: 'source',
  request: new EntityReactionRequestTemplate({
    capability: EntityCapabilityIds.DependencyBlocked,
    reason: 'required_structural_decommissioned',
    payloadDefaults: { dependencyKind: 'structural', suspensionReason: 'equipment_unavailable' },
  }),
  effect: 'blocking',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
})

export const StructuralDecommissionPropagationPolicies = [
  ContainsStructuralDecommissionInheritsTarget,
  TargetsStructuralDecommissionBlocksSource,
  RequiresStructuralDecommissionBlocksSource,
] as const

/** Required external dependency became unavailable. */
export const RequiresExternalUnavailableBlocksSource = new RelationshipPropagationPolicy({
  id: 'requires.external-unavailable.blocks-source' as never,
  edgeType: 'requires',
  observedEndpoint: 'target',
  accepts: new SignalMatcher({
    axis: 'external.availability',
    kind: 'condition_asserted',
    value: 'unavailable',
  }),
  requestEndpoint: 'source',
  request: new EntityReactionRequestTemplate({
    capability: EntityCapabilityIds.DependencyBlocked,
    reason: 'required_external_unavailable',
    payloadDefaults: { dependencyKind: 'external', suspensionReason: 'external_dependency' },
  }),
  effect: 'blocking',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
})

/** Required external dependency became available again. */
export const RequiresExternalAvailableReleasesSource = new RelationshipPropagationPolicy({
  id: 'requires.external-available.releases-source' as never,
  edgeType: 'requires',
  observedEndpoint: 'target',
  accepts: new SignalMatcher({
    axis: 'external.availability',
    kind: 'condition_asserted',
    value: 'available',
  }),
  requestEndpoint: 'source',
  request: new EntityReactionRequestTemplate({
    capability: EntityCapabilityIds.DependencyReleased,
    reason: 'required_external_available',
    payloadDefaults: { dependencyKind: 'external' },
  }),
  effect: 'consistency',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
})

/** Required device became unavailable. */
export const RequiresDeviceUnavailableBlocksSource = new RelationshipPropagationPolicy({
  id: 'requires.device-unavailable.blocks-source' as never,
  edgeType: 'requires',
  observedEndpoint: 'target',
  accepts: new SignalMatcher({
    axis: 'device.availability',
    kind: 'condition_asserted',
    value: 'unavailable',
  }),
  requestEndpoint: 'source',
  request: new EntityReactionRequestTemplate({
    capability: EntityCapabilityIds.DependencyBlocked,
    reason: 'required_device_unavailable',
    payloadDefaults: { dependencyKind: 'device', suspensionReason: 'equipment_unavailable' },
  }),
  effect: 'blocking',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
})

/** Required device became available again. */
export const RequiresDeviceAvailableReleasesSource = new RelationshipPropagationPolicy({
  id: 'requires.device-available.releases-source' as never,
  edgeType: 'requires',
  observedEndpoint: 'target',
  accepts: new SignalMatcher({
    axis: 'device.availability',
    kind: 'condition_asserted',
    value: 'available',
  }),
  requestEndpoint: 'source',
  request: new EntityReactionRequestTemplate({
    capability: EntityCapabilityIds.DependencyReleased,
    reason: 'required_device_available',
    payloadDefaults: { dependencyKind: 'device' },
  }),
  effect: 'consistency',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
})

export const ExternalDeviceRequiresAvailabilityPropagationPolicies = [
  RequiresExternalUnavailableBlocksSource,
  RequiresExternalAvailableReleasesSource,
  RequiresDeviceUnavailableBlocksSource,
  RequiresDeviceAvailableReleasesSource,
] as const

export const RELATIONSHIP_EDGE_REGISTRY = {
  targets: descriptor(
    'targets',
    'directed',
    ['work_order'],
    ['machine', 'line', 'workcell', 'plant', 'sensor', 'device'],
    [MachineUnavailableSuspendsWorkOrder],
    [
      TargetsMachineUnavailableBlocksSource,
      TargetsAlarmSafetyHoldHoldsSource,
      TargetsAlarmSafetyHoldRetractedReleasesSource,
      TargetsStructuralDecommissionBlocksSource,
    ],
  ),
  requires: descriptor(
    'requires',
    'directed',
    ['work_order'],
    ['external', 'machine', 'device'],
    [],
    [
      RequiresEquipmentUnavailableBlocksSource,
      RequiresAlarmSafetyHoldHoldsSource,
      RequiresAlarmSafetyHoldRetractedReleasesSource,
      RequiresStructuralDecommissionBlocksSource,
      RequiresExternalUnavailableBlocksSource,
      RequiresExternalAvailableReleasesSource,
      RequiresDeviceUnavailableBlocksSource,
      RequiresDeviceAvailableReleasesSource,
    ],
  ),
  caused_by: descriptor('caused_by', 'directed', ['work_order', 'alarm'], ['alarm', 'machine', 'sensor', 'device', 'work_order']),
  depends_on: descriptor(
    'depends_on',
    'directed',
    ['work_order'],
    ['work_order'],
    [],
    WorkOrderDependsOnPropagationPolicies,
  ),
  related_to: descriptor('related_to', 'bidirectional', ['work_order', 'alarm', 'machine', 'sensor', 'device'], ['work_order', 'alarm', 'machine', 'sensor', 'device']),
  supervises: descriptor('supervises', 'directed', ['external'], ['work_order', 'alarm']),
  produces: descriptor('produces', 'directed', ['work_order'], ['external']),
  contains: descriptor(
    'contains',
    'directed',
    ['enterprise', 'site', 'area', 'plant', 'line', 'workcell'],
    ['site', 'area', 'plant', 'line', 'workcell', 'machine'],
    [],
    [ContainsStructuralDecommissionInheritsTarget],
  ),
  monitors: descriptor('monitors', 'directed', ['sensor'], ['machine']),
  triggered_by: descriptor('triggered_by', 'directed', ['alarm'], ['sensor', 'device']),
} as const satisfies Record<RelationshipEdgeType, RelationshipEdgeDescriptor>

export const getRelationshipEdgeDescriptor = (
  edgeType: RelationshipEdgeType,
): RelationshipEdgeDescriptor => RELATIONSHIP_EDGE_REGISTRY[edgeType]

export const RelationshipEdges = {
  fromDescriptor: (
    descriptor: RelationshipEdgeDescriptor,
    source: RelationshipEndpoint,
    target: RelationshipEndpoint,
    metadata: RelationshipEdgeMetadata,
  ) => new RelationshipEdgeUpsert({
    source,
    target,
    edgeType: descriptor.edgeType,
    metadata,
  }),
  fromPolicy: (
    policy: RelationshipPropagationPolicy,
    source: RelationshipEndpoint,
    target: RelationshipEndpoint,
    metadata: RelationshipEdgeMetadata,
  ) => new RelationshipEdgeUpsert({
    source,
    target,
    edgeType: policy.edgeType,
    metadata,
  }),
} as const

export const getPropagationDescriptorsForEdge = (
  edgeType: RelationshipEdgeType,
): readonly PropagationDescriptor[] => getRelationshipEdgeDescriptor(edgeType).propagationDescriptors

export const getPropagationPoliciesForEdge = (
  edgeType: RelationshipEdgeType,
): readonly RelationshipPropagationPolicy[] => getRelationshipEdgeDescriptor(edgeType).propagationPolicies

export const isRelationshipAllowed = (input: {
  readonly edgeType: RelationshipEdgeType
  readonly sourceType: RelationshipNodeType
  readonly targetType: RelationshipNodeType
}): boolean => {
  const edge = getRelationshipEdgeDescriptor(input.edgeType)
  return edge.allowedSourceTypes.includes(input.sourceType) &&
    edge.allowedTargetTypes.includes(input.targetType)
}
