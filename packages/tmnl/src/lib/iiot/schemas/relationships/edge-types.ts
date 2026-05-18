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

export const RelationshipNodeType = Schema.Literal(
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
)
export type RelationshipNodeType = typeof RelationshipNodeType.Type

export const RelationshipEdgeType = Schema.Literal(
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
)
export type RelationshipEdgeType = typeof RelationshipEdgeType.Type

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
}) {}
export type RelationshipPropagationPolicy = typeof RelationshipPropagationPolicy.Type

export class RelationshipEndpoint extends Schema.TaggedClass<RelationshipEndpoint>()('RelationshipEndpoint', {
  type: RelationshipNodeType,
  id: Schema.String,
}) {}
export type RelationshipEndpoint = typeof RelationshipEndpoint.Type

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
    capability: 'dependency.blocked' as never,
    reason: 'target_unavailable',
    payloadDefaults: { dependencyKind: 'equipment' },
  }),
  effect: 'blocking',
  idempotencyStrategy: 'source_propagation_id',
  version: '1',
})

export const RELATIONSHIP_EDGE_REGISTRY = {
  targets: descriptor(
    'targets',
    'directed',
    ['work_order'],
    ['machine', 'line', 'workcell', 'plant', 'sensor', 'device'],
    [MachineUnavailableSuspendsWorkOrder],
    [TargetsMachineUnavailableBlocksSource],
  ),
  requires: descriptor('requires', 'directed', ['work_order'], ['external', 'machine', 'device']),
  caused_by: descriptor('caused_by', 'directed', ['work_order', 'alarm'], ['alarm', 'machine', 'sensor', 'device', 'work_order']),
  depends_on: descriptor('depends_on', 'directed', ['work_order'], ['work_order']),
  related_to: descriptor('related_to', 'bidirectional', ['work_order', 'alarm', 'machine', 'sensor', 'device'], ['work_order', 'alarm', 'machine', 'sensor', 'device']),
  supervises: descriptor('supervises', 'directed', ['external'], ['work_order', 'alarm']),
  produces: descriptor('produces', 'directed', ['work_order'], ['external']),
  contains: descriptor('contains', 'directed', ['enterprise', 'site', 'area', 'plant', 'line', 'workcell'], ['site', 'area', 'plant', 'line', 'workcell', 'machine']),
  monitors: descriptor('monitors', 'directed', ['sensor'], ['machine']),
  triggered_by: descriptor('triggered_by', 'directed', ['alarm'], ['sensor', 'device']),
} as const satisfies Record<RelationshipEdgeType, RelationshipEdgeDescriptor>

export const getRelationshipEdgeDescriptor = (
  edgeType: RelationshipEdgeType,
): RelationshipEdgeDescriptor => RELATIONSHIP_EDGE_REGISTRY[edgeType]

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
