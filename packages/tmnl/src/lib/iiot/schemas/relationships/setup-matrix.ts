/**
 * Relationship setup matrix.
 *
 * This matrix is the control-plane handoff between durable event facts and graph
 * topology projection. It does not dispatch Reactor target mutations. It answers:
 *
 * - Which durable event can create/update/close relationship graph nodes?
 * - Which edge type should be materialized or closed?
 * - Which relationships are currently blocked by registry gaps or lookup needs?
 *
 * Events remain primitive. The graph is a projection. Reactor only consumes this
 * topology after the projection lane has made relationships explicit.
 *
 * @module
 */

import { Schema } from 'effect'
import {
  CONTEXT_EVENT_TAGS,
  type ContextEventTag,
} from '../events/operational/context-events'
import {
  STRUCTURAL_EVENT_TAGS,
  type StructuralEventTag,
} from '../events/structural'
import {
  isRelationshipAllowed,
  RelationshipEdgeType,
  RelationshipNodeType,
  type RelationshipEdgeType as RelationshipEdgeTypeType,
  type RelationshipNodeType as RelationshipNodeTypeType,
} from './edge-types'

export const RelationshipSetupEventGroup = Schema.Literal('StructuralEvents', 'ContextEvents')
export type RelationshipSetupEventGroup = typeof RelationshipSetupEventGroup.Type

export const RelationshipSetupStatus = Schema.Literal(
  'materializes_graph',
  'updates_node',
  'closes_graph',
  'audit_only',
  'candidate_projection',
  'blocked_by_registry',
)
export type RelationshipSetupStatus = typeof RelationshipSetupStatus.Type

export const RelationshipSetupJurisdiction = Schema.Literal(
  'structural_graph_projection',
  'context_graph_projection',
  'audit_projection',
)
export type RelationshipSetupJurisdiction = typeof RelationshipSetupJurisdiction.Type

export const RelationshipSetupMode = Schema.Literal('upsert_node', 'upsert_edge', 'soft_delete_edge')
export type RelationshipSetupMode = typeof RelationshipSetupMode.Type

export const RelationshipSetupResolver = Schema.Literal(
  'literal_payload_path',
  'optional_parent_payload_path',
  'asset_lookup',
  'external_ref_mapping',
  'resource_mapping',
)
export type RelationshipSetupResolver = typeof RelationshipSetupResolver.Type

export const RelationshipSetupReactorScope = Schema.Literal(
  'projection_only',
  'reactor_candidate_after_projection',
  'none',
)
export type RelationshipSetupReactorScope = typeof RelationshipSetupReactorScope.Type

export class RelationshipNodeSetup extends Schema.TaggedClass<RelationshipNodeSetup>()('RelationshipNodeSetup', {
  mode: Schema.Literal('upsert_node'),
  nodeType: RelationshipNodeType,
  idPath: Schema.String,
  resolver: Schema.optionalWith(RelationshipSetupResolver, { default: () => 'literal_payload_path' as const }),
  notes: Schema.optional(Schema.String),
}) {}
export type RelationshipNodeSetup = typeof RelationshipNodeSetup.Type

export class RelationshipEdgeSetup extends Schema.TaggedClass<RelationshipEdgeSetup>()('RelationshipEdgeSetup', {
  mode: Schema.Literal('upsert_edge', 'soft_delete_edge'),
  edgeType: RelationshipEdgeType,
  sourceTypes: Schema.Array(RelationshipNodeType),
  targetTypes: Schema.Array(RelationshipNodeType),
  sourceIdPath: Schema.String,
  targetIdPath: Schema.String,
  resolver: Schema.optionalWith(RelationshipSetupResolver, { default: () => 'literal_payload_path' as const }),
  notes: Schema.optional(Schema.String),
}) {}
export type RelationshipEdgeSetup = typeof RelationshipEdgeSetup.Type

export class RelationshipSetupMatrixEntry extends Schema.TaggedClass<RelationshipSetupMatrixEntry>()('RelationshipSetupMatrixEntry', {
  eventTag: Schema.String,
  eventGroup: RelationshipSetupEventGroup,
  status: RelationshipSetupStatus,
  jurisdiction: RelationshipSetupJurisdiction,
  reactorScope: RelationshipSetupReactorScope,
  nodes: Schema.Array(RelationshipNodeSetup),
  edges: Schema.Array(RelationshipEdgeSetup),
  notes: Schema.String,
}) {}
export type RelationshipSetupMatrixEntry = typeof RelationshipSetupMatrixEntry.Type

const node = (
  nodeType: RelationshipNodeTypeType,
  idPath: string,
  notes?: string,
  resolver: RelationshipSetupResolver = 'literal_payload_path',
): RelationshipNodeSetup => new RelationshipNodeSetup({
  mode: 'upsert_node',
  nodeType,
  idPath,
  resolver,
  ...(notes ? { notes } : {}),
})

const edge = (input: {
  readonly mode?: 'upsert_edge' | 'soft_delete_edge'
  readonly edgeType: RelationshipEdgeTypeType
  readonly sourceTypes: readonly RelationshipNodeTypeType[]
  readonly targetTypes: readonly RelationshipNodeTypeType[]
  readonly sourceIdPath: string
  readonly targetIdPath: string
  readonly resolver?: RelationshipSetupResolver
  readonly notes?: string
}): RelationshipEdgeSetup => new RelationshipEdgeSetup({
  mode: input.mode ?? 'upsert_edge',
  edgeType: input.edgeType,
  sourceTypes: Array.from(input.sourceTypes),
  targetTypes: Array.from(input.targetTypes),
  sourceIdPath: input.sourceIdPath,
  targetIdPath: input.targetIdPath,
  resolver: input.resolver ?? 'literal_payload_path',
  ...(input.notes ? { notes: input.notes } : {}),
})

const structural = (
  eventTag: StructuralEventTag,
  status: RelationshipSetupStatus,
  nodes: readonly RelationshipNodeSetup[],
  edges: readonly RelationshipEdgeSetup[],
  notes: string,
): RelationshipSetupMatrixEntry => new RelationshipSetupMatrixEntry({
  eventTag,
  eventGroup: 'StructuralEvents',
  status,
  jurisdiction: status === 'audit_only' ? 'audit_projection' : 'structural_graph_projection',
  reactorScope: 'projection_only',
  nodes: Array.from(nodes),
  edges: Array.from(edges),
  notes,
})

const context = (
  eventTag: ContextEventTag,
  status: RelationshipSetupStatus,
  nodes: readonly RelationshipNodeSetup[],
  edges: readonly RelationshipEdgeSetup[],
  notes: string,
  reactorScope: RelationshipSetupReactorScope = 'projection_only',
): RelationshipSetupMatrixEntry => new RelationshipSetupMatrixEntry({
  eventTag,
  eventGroup: 'ContextEvents',
  status,
  jurisdiction: status === 'audit_only' ? 'audit_projection' : 'context_graph_projection',
  reactorScope,
  nodes: Array.from(nodes),
  edges: Array.from(edges),
  notes,
})

const contains = (
  sourceTypes: readonly RelationshipNodeTypeType[],
  targetTypes: readonly RelationshipNodeTypeType[],
  sourceIdPath: string,
  targetIdPath: string,
  mode: 'upsert_edge' | 'soft_delete_edge' = 'upsert_edge',
  resolver: RelationshipSetupResolver = 'literal_payload_path',
  notes?: string,
) => edge({
  mode,
  edgeType: 'contains',
  sourceTypes,
  targetTypes,
  sourceIdPath,
  targetIdPath,
  resolver,
  notes,
})

export const RelationshipSetupMatrix = [
  structural('EnterpriseCreated', 'materializes_graph', [node('enterprise', 'enterpriseId')], [],
    'Root structural node only; no parent relationship.'),
  structural('EnterpriseUpdated', 'updates_node', [node('enterprise', 'enterpriseId')], [],
    'Updates the enterprise node projection; no relationship edge changes.'),
  structural('EnterpriseDecommissioned', 'updates_node', [node('enterprise', 'enterpriseId')], [],
    'Marks the root node decommissioned in projection. Child cascade is a separate policy lane.'),

  structural('SiteCreated', 'materializes_graph', [node('site', 'siteId')], [
    contains(['enterprise'], ['site'], 'enterpriseId', 'siteId'),
  ], 'Creates Site node and Enterprise -> Site containment.'),
  structural('SiteUpdated', 'updates_node', [node('site', 'siteId')], [],
    'Updates Site node projection; containment is unchanged.'),
  structural('SiteDecommissioned', 'closes_graph', [node('site', 'siteId')], [
    contains(['enterprise'], ['site'], 'enterpriseId', 'siteId', 'soft_delete_edge'),
  ], 'Closes Enterprise -> Site containment while retaining edge audit history.'),

  structural('AreaCreated', 'materializes_graph', [node('area', 'areaId')], [
    contains(['site'], ['area'], 'siteId', 'areaId'),
  ], 'Creates Area node and Site -> Area containment.'),
  structural('AreaUpdated', 'updates_node', [node('area', 'areaId')], [],
    'Updates Area node projection; containment is unchanged.'),
  structural('AreaDecommissioned', 'closes_graph', [node('area', 'areaId')], [
    contains(['site'], ['area'], 'siteId', 'areaId', 'soft_delete_edge'),
  ], 'Closes Site -> Area containment.'),

  structural('PlantCreated', 'materializes_graph', [node('plant', 'plantId')], [
    contains(['site', 'area'], ['plant'], 'siteId|areaId', 'plantId', 'upsert_edge', 'optional_parent_payload_path'),
  ], 'Creates Plant node and whichever optional parent is present: Site -> Plant or Area -> Plant.'),
  structural('PlantUpdated', 'updates_node', [node('plant', 'plantId')], [],
    'Updates Plant node projection; containment is unchanged.'),
  structural('PlantRelocated', 'materializes_graph', [node('plant', 'plantId')], [
    contains(['site', 'area'], ['plant'], 'previousSiteId|previousAreaId', 'plantId', 'soft_delete_edge', 'optional_parent_payload_path'),
    contains(['site', 'area'], ['plant'], 'newSiteId|newAreaId', 'plantId', 'upsert_edge', 'optional_parent_payload_path'),
  ], 'Closes the old optional parent edge and creates the new optional parent edge.'),
  structural('PlantDecommissioned', 'closes_graph', [node('plant', 'plantId')], [
    contains(['site', 'area'], ['plant'], 'siteId|areaId', 'plantId', 'soft_delete_edge', 'optional_parent_payload_path'),
  ], 'Closes the active parent -> Plant containment if parent data is available.'),

  structural('LineCreated', 'materializes_graph', [node('line', 'lineId')], [
    contains(['plant'], ['line'], 'plantId', 'lineId'),
  ], 'Creates Line node and Plant -> Line containment.'),
  structural('LineUpdated', 'updates_node', [node('line', 'lineId')], [],
    'Updates Line node projection; containment is unchanged.'),
  structural('LineConfigChanged', 'updates_node', [node('line', 'lineId')], [],
    'Updates Line configuration properties on the node projection.'),
  structural('LineRelocated', 'materializes_graph', [node('line', 'lineId')], [
    contains(['plant'], ['line'], 'previousPlantId', 'lineId', 'soft_delete_edge'),
    contains(['plant'], ['line'], 'newPlantId', 'lineId'),
  ], 'Closes previous Plant -> Line containment and creates new Plant -> Line containment.'),
  structural('LineDecommissioned', 'closes_graph', [node('line', 'lineId')], [
    contains(['plant'], ['line'], 'plantId', 'lineId', 'soft_delete_edge'),
  ], 'Closes Plant -> Line containment.'),

  structural('WorkCellCreated', 'materializes_graph', [node('workcell', 'workCellId')], [
    contains(['line'], ['workcell'], 'lineId', 'workCellId'),
  ], 'Creates WorkCell node and Line -> WorkCell containment.'),
  structural('WorkCellUpdated', 'updates_node', [node('workcell', 'workCellId')], [],
    'Updates WorkCell node projection; containment is unchanged.'),
  structural('WorkCellDecommissioned', 'closes_graph', [node('workcell', 'workCellId')], [
    contains(['line'], ['workcell'], 'lineId', 'workCellId', 'soft_delete_edge'),
  ], 'Closes Line -> WorkCell containment.'),

  structural('MachineCreated', 'materializes_graph', [node('machine', 'machineId')], [
    contains(['line', 'workcell'], ['machine'], 'lineId|workCellId', 'machineId', 'upsert_edge', 'optional_parent_payload_path'),
  ], 'Creates Machine node and canonical parent containment. WorkCell wins when present; otherwise Line.'),
  structural('MachineUpdated', 'updates_node', [node('machine', 'machineId')], [],
    'Updates Machine node projection; containment is unchanged.'),
  structural('MachineConfigChanged', 'updates_node', [node('machine', 'machineId')], [],
    'Updates Machine configuration properties on the node projection.'),
  structural('MachineRelocated', 'materializes_graph', [node('machine', 'machineId')], [
    contains(['line', 'workcell'], ['machine'], 'previousLineId|previousWorkCellId', 'machineId', 'soft_delete_edge', 'optional_parent_payload_path'),
    contains(['line', 'workcell'], ['machine'], 'newLineId|newWorkCellId', 'machineId', 'upsert_edge', 'optional_parent_payload_path'),
  ], 'Closes previous canonical parent containment and creates the new canonical parent containment.'),
  structural('MachineDecommissioned', 'closes_graph', [node('machine', 'machineId')], [
    contains(['line', 'workcell'], ['machine'], 'lineId|workCellId', 'machineId', 'soft_delete_edge', 'optional_parent_payload_path'),
  ], 'Closes parent -> Machine containment when parent data is available.'),

  structural('SensorCreated', 'materializes_graph', [node('sensor', 'sensorId')], [
    edge({ edgeType: 'monitors', sourceTypes: ['sensor'], targetTypes: ['machine'], sourceIdPath: 'sensorId', targetIdPath: 'machineId' }),
  ], 'Creates Sensor node and Sensor -> Machine monitoring edge.'),
  structural('SensorUpdated', 'updates_node', [node('sensor', 'sensorId')], [],
    'Updates Sensor node projection; monitoring edge is unchanged.'),
  structural('SensorCalibrated', 'updates_node', [node('sensor', 'sensorId')], [],
    'Updates calibration metadata on Sensor node projection.'),
  structural('SensorThresholdChanged', 'updates_node', [node('sensor', 'sensorId')], [],
    'Updates threshold metadata on Sensor node projection.'),
  structural('SensorDecommissioned', 'closes_graph', [node('sensor', 'sensorId')], [
    edge({ mode: 'soft_delete_edge', edgeType: 'monitors', sourceTypes: ['sensor'], targetTypes: ['machine'], sourceIdPath: 'sensorId', targetIdPath: 'machineId' }),
  ], 'Closes Sensor -> Machine monitoring edge.'),

  structural('DeviceCreated', 'blocked_by_registry', [node('device', 'deviceId')], [],
    'Creates Device node, but Machine -> Device containment is not yet registered as an allowed relationship edge.'),
  structural('DeviceUpdated', 'updates_node', [node('device', 'deviceId')], [],
    'Updates Device node projection; parent relationship remains blocked by registry gap.'),
  structural('DeviceDecommissioned', 'blocked_by_registry', [node('device', 'deviceId')], [],
    'Marks Device node decommissioned; parent edge closure waits for Machine -> Device relationship registration.'),

  context('ContextCreated', 'candidate_projection', [node('work_order', 'workOrderId')], [
    edge({
      edgeType: 'targets',
      sourceTypes: ['work_order'],
      targetTypes: ['plant', 'line', 'workcell', 'machine', 'sensor', 'device'],
      sourceIdPath: 'workOrderId',
      targetIdPath: 'initialAssets[]',
      resolver: 'asset_lookup',
      notes: 'One target edge per initial asset after resolving AssetId to graph node type.',
    }),
  ], 'Creates WorkOrder context node and may materialize initial target edges.', 'reactor_candidate_after_projection'),
  context('ContextUpdated', 'audit_only', [], [],
    'Generic context mutation is audit/projection state; typed attach/link/spawn events own relationship edges.', 'none'),
  context('ContextSnapshotted', 'audit_only', [], [],
    'Snapshot is immutable audit evidence; no topology mutation.', 'none'),
  context('AssetAttached', 'candidate_projection', [node('work_order', 'workOrderId')], [
    edge({
      edgeType: 'targets',
      sourceTypes: ['work_order'],
      targetTypes: ['plant', 'line', 'workcell', 'machine', 'sensor', 'device'],
      sourceIdPath: 'workOrderId',
      targetIdPath: 'attachedAssetId',
      resolver: 'asset_lookup',
      notes: 'Primary/secondary targets become targets edges; support/reference roles may need related_to registry widening.',
    }),
  ], 'Materializes WorkOrder -> asset target relationship after asset lookup.', 'reactor_candidate_after_projection'),
  context('AssetDetached', 'candidate_projection', [node('work_order', 'workOrderId')], [
    edge({
      mode: 'soft_delete_edge',
      edgeType: 'targets',
      sourceTypes: ['work_order'],
      targetTypes: ['plant', 'line', 'workcell', 'machine', 'sensor', 'device'],
      sourceIdPath: 'workOrderId',
      targetIdPath: 'detachedAssetId',
      resolver: 'asset_lookup',
    }),
  ], 'Closes WorkOrder -> asset target relationship after asset lookup.', 'reactor_candidate_after_projection'),
  context('ResourceAllocated', 'candidate_projection', [node('work_order', 'workOrderId'), node('external', 'resourceId', undefined, 'resource_mapping')], [
    edge({ edgeType: 'requires', sourceTypes: ['work_order'], targetTypes: ['external'], sourceIdPath: 'workOrderId', targetIdPath: 'resourceId', resolver: 'resource_mapping' }),
  ], 'Materializes WorkOrder -> external resource requirement. Personnel supervision can be added once role semantics are explicit.'),
  context('ResourceReleased', 'candidate_projection', [node('work_order', 'workOrderId'), node('external', 'resourceId', undefined, 'resource_mapping')], [
    edge({ mode: 'soft_delete_edge', edgeType: 'requires', sourceTypes: ['work_order'], targetTypes: ['external'], sourceIdPath: 'workOrderId', targetIdPath: 'resourceId', resolver: 'resource_mapping' }),
  ], 'Closes WorkOrder -> external resource requirement.'),
  context('ExternalRefLinked', 'candidate_projection', [node('work_order', 'workOrderId'), node('external', 'externalRefId', undefined, 'external_ref_mapping')], [
    edge({ edgeType: 'requires', sourceTypes: ['work_order'], targetTypes: ['external'], sourceIdPath: 'workOrderId', targetIdPath: 'externalRefId', resolver: 'external_ref_mapping', notes: 'Use for upstream external dependency references.' }),
    edge({ edgeType: 'produces', sourceTypes: ['work_order'], targetTypes: ['external'], sourceIdPath: 'workOrderId', targetIdPath: 'externalRefId', resolver: 'external_ref_mapping', notes: 'Use for external artifact/report references.' }),
  ], 'External reference mapping chooses requires vs produces based on externalType/externalSystem.'),
  context('ExternalRefUnlinked', 'candidate_projection', [node('work_order', 'workOrderId'), node('external', 'externalRefId', undefined, 'external_ref_mapping')], [
    edge({ mode: 'soft_delete_edge', edgeType: 'requires', sourceTypes: ['work_order'], targetTypes: ['external'], sourceIdPath: 'workOrderId', targetIdPath: 'externalRefId', resolver: 'external_ref_mapping' }),
    edge({ mode: 'soft_delete_edge', edgeType: 'produces', sourceTypes: ['work_order'], targetTypes: ['external'], sourceIdPath: 'workOrderId', targetIdPath: 'externalRefId', resolver: 'external_ref_mapping' }),
  ], 'Closes whichever external relationship was previously materialized.'),
  context('ChildWorkOrderSpawned', 'materializes_graph', [node('work_order', 'workOrderId'), node('work_order', 'childWorkOrderId')], [
    edge({ edgeType: 'depends_on', sourceTypes: ['work_order'], targetTypes: ['work_order'], sourceIdPath: 'workOrderId', targetIdPath: 'childWorkOrderId', notes: 'Parent completion may depend on child completion.' }),
    edge({ edgeType: 'caused_by', sourceTypes: ['work_order'], targetTypes: ['work_order'], sourceIdPath: 'childWorkOrderId', targetIdPath: 'workOrderId', notes: 'Child was caused by the parent WorkOrder context.' }),
  ], 'Materializes parent/child WorkOrder topology for future dependency routing.', 'reactor_candidate_after_projection'),
] as const satisfies readonly RelationshipSetupMatrixEntry[]

const byEventTag = new Map(RelationshipSetupMatrix.map((entry) => [entry.eventTag, entry] as const))

export const getRelationshipSetupMatrixEntry = (
  eventTag: StructuralEventTag | ContextEventTag | string,
): RelationshipSetupMatrixEntry | undefined => byEventTag.get(eventTag)

export const getRelationshipSetupMatrixEntriesForGroup = (
  group: RelationshipSetupEventGroup,
): readonly RelationshipSetupMatrixEntry[] => RelationshipSetupMatrix.filter((entry) => entry.eventGroup === group)

export const getRelationshipSetupCoveredEventTags = (): readonly string[] =>
  RelationshipSetupMatrix.map((entry) => entry.eventTag)

export const getMissingRelationshipSetupEventTags = (): readonly string[] => {
  const covered = new Set(getRelationshipSetupCoveredEventTags())
  return [...STRUCTURAL_EVENT_TAGS, ...CONTEXT_EVENT_TAGS].filter((tag) => !covered.has(tag))
}

export interface RelationshipSetupInvalidEdge {
  readonly eventTag: string
  readonly edgeType: RelationshipEdgeTypeType
  readonly sourceType: RelationshipNodeTypeType
  readonly targetType: RelationshipNodeTypeType
}

export const getInvalidRelationshipSetupEdges = (): readonly RelationshipSetupInvalidEdge[] =>
  RelationshipSetupMatrix.flatMap((entry) =>
    entry.edges.flatMap((setup) =>
      setup.sourceTypes.flatMap((sourceType) =>
        setup.targetTypes.flatMap((targetType) =>
          isRelationshipAllowed({ edgeType: setup.edgeType, sourceType, targetType })
            ? []
            : [{ eventTag: entry.eventTag, edgeType: setup.edgeType, sourceType, targetType }],
        ),
      ),
    ),
  )
