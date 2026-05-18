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
}) {}
export type RelationshipEdgeDescriptor = typeof RelationshipEdgeDescriptor.Type

const descriptor = (
  edgeType: RelationshipEdgeType,
  directionality: RelationshipDirectionality,
  allowedSourceTypes: readonly RelationshipNodeType[],
  allowedTargetTypes: readonly RelationshipNodeType[],
  propagationDescriptors: readonly PropagationDescriptor[] = [],
) => new RelationshipEdgeDescriptor({
  edgeType,
  directionality,
  allowedSourceTypes: Array.from(allowedSourceTypes),
  allowedTargetTypes: Array.from(allowedTargetTypes),
  propagationDescriptors: Array.from(propagationDescriptors),
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

export const RELATIONSHIP_EDGE_REGISTRY = {
  targets: descriptor('targets', 'directed', ['work_order'], ['machine', 'line', 'workcell', 'plant', 'sensor', 'device'], [MachineUnavailableSuspendsWorkOrder]),
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

export const isRelationshipAllowed = (input: {
  readonly edgeType: RelationshipEdgeType
  readonly sourceType: RelationshipNodeType
  readonly targetType: RelationshipNodeType
}): boolean => {
  const edge = getRelationshipEdgeDescriptor(input.edgeType)
  return edge.allowedSourceTypes.includes(input.sourceType) &&
    edge.allowedTargetTypes.includes(input.targetType)
}
