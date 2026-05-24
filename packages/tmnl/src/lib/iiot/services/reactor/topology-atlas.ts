/**
 * Reactor topology atlas.
 *
 * Machine-readable audit source for durable IIoT EventGroups, relationship
 * edge descriptors, and Reactor production/candidate semantic lanes.
 *
 * Events remain the primitive source of truth. This atlas does not create a
 * second fact stream; it classifies durable event tags and relationship edges so
 * humans and agents can reason about propagation multiplicity explicitly.
 */

import { Schema } from 'effect'
import {
  AlarmEvents,
  ApprovalEvents,
  BatchEvents,
  ContextEvents,
  EquipmentStateEvents,
  OperationalEvents,
  OperatorEvents,
  QualityEvents,
  StructuralEvents,
  TaskEvents,
  WorkOrderEvents,
} from '../../schemas/events/groups'
import {
  EntityCapabilityId,
  EntityCapabilityIds,
  RELATIONSHIP_EDGE_REGISTRY,
  RelationshipEdgeType,
  RelationshipNodeType,
} from '../../schemas/relationships/edge-types'
import { ReactiveEquipmentStateObservationSpecs } from './observations'

export const ReactorEventGroupName = Schema.Literal(
  'StructuralEvents',
  'OperationalEvents',
  'AlarmEvents',
  'EquipmentStateEvents',
  'WorkOrderEvents',
  'ContextEvents',
  'TaskEvents',
  'ApprovalEvents',
  'BatchEvents',
  'QualityEvents',
  'OperatorEvents',
)
export type ReactorEventGroupName = typeof ReactorEventGroupName.Type

export const ReactorEventCoverageStatus = Schema.Literal(
  'reactive',
  'candidate',
  'non_reactive',
)
export type ReactorEventCoverageStatus = typeof ReactorEventCoverageStatus.Type

export const ReactorRelationshipCoverageStatus = Schema.Literal(
  'production',
  'candidate',
  'topology',
  'reference',
)
export type ReactorRelationshipCoverageStatus = typeof ReactorRelationshipCoverageStatus.Type

export const EventRoutingKind = Schema.Literal(
  'reactor_dispatch',
  'candidate_dispatch',
  'relationship_projection',
  'candidate_projection',
  'aggregate_internal',
  'audit_only',
)
export type EventRoutingKind = typeof EventRoutingKind.Type

export const EventRoutingProofRequirement = Schema.Literal(
  'observation_decode_test',
  'registry_policy_test',
  'graph_expansion_test',
  'source_claim_e2e',
  'target_contract_test',
  'projection_handler_test',
  'aggregate_test',
  'documentation_only',
)
export type EventRoutingProofRequirement = typeof EventRoutingProofRequirement.Type

export class EventRoutingSubject extends Schema.TaggedClass<EventRoutingSubject>()('EventRoutingSubject', {
  entityType: Schema.optional(RelationshipNodeType),
  source: Schema.String,
  notes: Schema.optional(Schema.String),
}) {}
export type EventRoutingSubject = typeof EventRoutingSubject.Type

export class EventRoutingRelationshipPath extends Schema.TaggedClass<EventRoutingRelationshipPath>()('EventRoutingRelationshipPath', {
  edgeTypes: Schema.Array(RelationshipEdgeType),
  notes: Schema.String,
}) {}
export type EventRoutingRelationshipPath = typeof EventRoutingRelationshipPath.Type

export class EventRoutingContract extends Schema.TaggedClass<EventRoutingContract>()('EventRoutingContract', {
  id: Schema.String,
  group: ReactorEventGroupName,
  eventTag: Schema.String,
  status: ReactorEventCoverageStatus,
  routingKind: EventRoutingKind,
  subject: EventRoutingSubject,
  signals: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  relationshipPaths: Schema.optionalWith(Schema.Array(EventRoutingRelationshipPath), { default: () => [] }),
  targetOwner: Schema.optional(Schema.String),
  targetCapabilities: Schema.optionalWith(Schema.Array(EntityCapabilityId), { default: () => [] }),
  productionObservationIds: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  productionPolicyIds: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  proofRequirements: Schema.Array(EventRoutingProofRequirement),
  rationale: Schema.String,
  parkingRationale: Schema.optional(Schema.String),
}) {}
export type EventRoutingContract = typeof EventRoutingContract.Type

export class ReactorEventCoverageEntry extends Schema.TaggedClass<ReactorEventCoverageEntry>()('ReactorEventCoverageEntry', {
  group: ReactorEventGroupName,
  tag: Schema.String,
  status: ReactorEventCoverageStatus,
  rationale: Schema.String,
  signals: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  productionObservationIds: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  productionPolicyIds: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  candidateRelationshipEdges: Schema.optionalWith(Schema.Array(RelationshipEdgeType), { default: () => [] }),
  targetCapabilities: Schema.optionalWith(Schema.Array(EntityCapabilityId), { default: () => [] }),
}) {}
export type ReactorEventCoverageEntry = typeof ReactorEventCoverageEntry.Type

export class ReactorRelationshipCoverageEntry extends Schema.TaggedClass<ReactorRelationshipCoverageEntry>()('ReactorRelationshipCoverageEntry', {
  edgeType: RelationshipEdgeType,
  directionality: Schema.Literal('directed', 'bidirectional'),
  status: ReactorRelationshipCoverageStatus,
  allowedSourceTypes: Schema.Array(RelationshipNodeType),
  allowedTargetTypes: Schema.Array(RelationshipNodeType),
  allowedPairCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  productionPolicyIds: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  propagationDescriptorIds: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  candidateSignals: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  targetCapabilities: Schema.optionalWith(Schema.Array(EntityCapabilityId), { default: () => [] }),
  rationale: Schema.String,
}) {}
export type ReactorRelationshipCoverageEntry = typeof ReactorRelationshipCoverageEntry.Type

export class ReactorTopologyStats extends Schema.TaggedClass<ReactorTopologyStats>()('ReactorTopologyStats', {
  eventGroupCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  eventTagCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  reactiveEventCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  candidateEventCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  nonReactiveEventCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  relationshipEdgeCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  relationshipAllowedPairCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  productionPolicyCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
}) {}
export type ReactorTopologyStats = typeof ReactorTopologyStats.Type

export class ReactorTopologyAtlas extends Schema.TaggedClass<ReactorTopologyAtlas>()('ReactorTopologyAtlas', {
  generatedAtIso: Schema.String,
  eventCoverage: Schema.Array(ReactorEventCoverageEntry),
  eventRoutingContracts: Schema.Array(EventRoutingContract),
  relationshipCoverage: Schema.Array(ReactorRelationshipCoverageEntry),
  stats: ReactorTopologyStats,
}) {}
export type ReactorTopologyAtlas = typeof ReactorTopologyAtlas.Type

const EVENT_GROUPS = {
  StructuralEvents,
  OperationalEvents,
  AlarmEvents,
  EquipmentStateEvents,
  WorkOrderEvents,
  ContextEvents,
  TaskEvents,
  ApprovalEvents,
  BatchEvents,
  QualityEvents,
  OperatorEvents,
} as const

type EventGroupLike = {
  readonly events: Readonly<Record<string, unknown>>
}

type RelationshipEdgeTypeValue = typeof RelationshipEdgeType.Type
type RelationshipNodeTypeValue = typeof RelationshipNodeType.Type
type EntityCapabilityIdValue = typeof EntityCapabilityId.Type

const Capability = EntityCapabilityIds

type EventRoutingSubjectSeed = {
  readonly entityType?: RelationshipNodeTypeValue
  readonly source: string
  readonly notes?: string
}

type EventRoutingRelationshipPathSeed = {
  readonly edgeTypes: readonly RelationshipEdgeTypeValue[]
  readonly notes: string
}

type EventCoverageSeed = {
  readonly status: ReactorEventCoverageStatus
  readonly rationale: string
  readonly signals?: readonly string[]
  readonly productionPolicyIds?: readonly string[]
  readonly candidateRelationshipEdges?: readonly RelationshipEdgeTypeValue[]
  readonly targetCapabilities?: readonly EntityCapabilityIdValue[]
  readonly routingKind?: EventRoutingKind
  readonly subject?: EventRoutingSubjectSeed
  readonly relationshipPaths?: readonly EventRoutingRelationshipPathSeed[]
  readonly targetOwner?: string
  readonly proofRequirements?: readonly EventRoutingProofRequirement[]
  readonly parkingRationale?: string
}

type RelationshipCoverageSeed = {
  readonly status: ReactorRelationshipCoverageStatus
  readonly rationale: string
  readonly candidateSignals?: readonly string[]
  readonly targetCapabilities?: readonly EntityCapabilityIdValue[]
}

const tagsOf = (group: EventGroupLike): readonly string[] =>
  Object.keys(group.events).sort((a, b) => a.localeCompare(b))

export const getIiotEventGroupTags = (): Readonly<Record<ReactorEventGroupName, readonly string[]>> => ({
  StructuralEvents: tagsOf(StructuralEvents as EventGroupLike),
  OperationalEvents: tagsOf(OperationalEvents as EventGroupLike),
  AlarmEvents: tagsOf(AlarmEvents as EventGroupLike),
  EquipmentStateEvents: tagsOf(EquipmentStateEvents as EventGroupLike),
  WorkOrderEvents: tagsOf(WorkOrderEvents as EventGroupLike),
  ContextEvents: tagsOf(ContextEvents as EventGroupLike),
  TaskEvents: tagsOf(TaskEvents as EventGroupLike),
  ApprovalEvents: tagsOf(ApprovalEvents as EventGroupLike),
  BatchEvents: tagsOf(BatchEvents as EventGroupLike),
  QualityEvents: tagsOf(QualityEvents as EventGroupLike),
  OperatorEvents: tagsOf(OperatorEvents as EventGroupLike),
})

const groupDefaults: Record<ReactorEventGroupName, EventCoverageSeed> = {
  StructuralEvents: {
    status: 'non_reactive',
    rationale: 'Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists.',
  },
  OperationalEvents: {
    status: 'non_reactive',
    rationale: 'BaseOperationalEvent is a placeholder envelope, not a semantic source event.',
  },
  AlarmEvents: {
    status: 'non_reactive',
    rationale: 'Alarm lifecycle is durable audit until severity/device safety-hold semantics are explicitly declared.',
  },
  EquipmentStateEvents: {
    status: 'candidate',
    rationale: 'Equipment events can assert availability/performance signals, but only declared observation specs are production reactive.',
    candidateRelationshipEdges: ['targets', 'requires'],
  },
  WorkOrderEvents: {
    status: 'non_reactive',
    rationale: 'WorkOrder lifecycle events are target-owned audit unless cross-WorkOrder dependency propagation is declared.',
  },
  ContextEvents: {
    status: 'non_reactive',
    rationale: 'Context events mostly maintain relationship/projection state rather than dispatching structural consistency pressure.',
  },
  TaskEvents: {
    status: 'non_reactive',
    rationale: 'Task lifecycle belongs inside the WorkOrder/Task aggregate until task nodes become graph entities.',
  },
  ApprovalEvents: {
    status: 'non_reactive',
    rationale: 'Approval events are compliance workflow audit unless a target-owned approval hold contract is declared.',
  },
  BatchEvents: {
    status: 'non_reactive',
    rationale: 'Batch events are regulatory production records unless quality-hold relationships are declared.',
  },
  QualityEvents: {
    status: 'non_reactive',
    rationale: 'Quality events are audit/quality-loop records until quality hold/release contracts are declared.',
  },
  OperatorEvents: {
    status: 'non_reactive',
    rationale: 'Operator events are compliance/audit records; they do not imply graph-scoped mutation by default.',
  },
}

const productionEquipmentPolicies = [
  'targets.machine-unavailable.blocks-source',
  'requires.equipment-unavailable.blocks-source',
] as const

const reactiveDispatchProofs = [
  'observation_decode_test',
  'registry_policy_test',
  'graph_expansion_test',
  'source_claim_e2e',
  'target_contract_test',
] as const satisfies readonly EventRoutingProofRequirement[]

const candidateDispatchProofs = [
  'observation_decode_test',
  'registry_policy_test',
  'graph_expansion_test',
  'target_contract_test',
  'source_claim_e2e',
] as const satisfies readonly EventRoutingProofRequirement[]

const projectionProofs = [
  'projection_handler_test',
  'graph_expansion_test',
] as const satisfies readonly EventRoutingProofRequirement[]

const documentationProofs = [
  'documentation_only',
] as const satisfies readonly EventRoutingProofRequirement[]

const structuralPayloadIdField = (entityType: RelationshipNodeTypeValue): string => {
  switch (entityType) {
    case 'workcell': return 'workCellId'
    default: return `${entityType}Id`
  }
}

const structuralProjection = (input: {
  readonly entityType: RelationshipNodeTypeValue
  readonly action: string
  readonly rationale: string
  readonly relationshipEdges?: readonly RelationshipEdgeTypeValue[]
}): EventCoverageSeed => ({
  status: 'non_reactive',
  routingKind: 'relationship_projection',
  rationale: input.rationale,
  signals: [`structural.${input.entityType}.${input.action}`],
  candidateRelationshipEdges: input.relationshipEdges,
  subject: {
    entityType: input.entityType,
    source: `payload.${structuralPayloadIdField(input.entityType)} / graph node: ${input.entityType}`,
    notes: 'Projection contract only: update graph/SQL read models; do not dispatch Reactor target reactions.',
  },
  proofRequirements: projectionProofs,
  parkingRationale: 'Projection-only structural event; no target-owned consistency mutation is declared.',
})

const structuralDecommission = (input: {
  readonly entityType: RelationshipNodeTypeValue
  readonly relationshipEdges: readonly RelationshipEdgeTypeValue[]
  readonly signals: readonly string[]
  readonly rationale: string
}): EventCoverageSeed => ({
  status: 'candidate',
  routingKind: 'candidate_dispatch',
  rationale: input.rationale,
  signals: input.signals,
  candidateRelationshipEdges: input.relationshipEdges,
  targetCapabilities: [Capability.LifecycleInherited, Capability.DependencyBlocked],
  subject: {
    entityType: input.entityType,
    source: `payload.${structuralPayloadIdField(input.entityType)} / graph node: ${input.entityType}`,
    notes: 'Candidate ERC: decommission projection is required, but Reactor dispatch/cascade semantics are not production yet.',
  },
  relationshipPaths: [{
    edgeTypes: input.relationshipEdges,
    notes: 'Candidate decommission traversal. Promotion must separate structural lifecycle inheritance from WorkOrder blocking.',
  }],
  targetOwner: 'structural_entity/work_order',
  proofRequirements: candidateDispatchProofs,
})

const equipmentSubject = (notes?: string): EventRoutingSubjectSeed => ({
  entityType: 'machine',
  source: 'payload.machineId / graph node: machine',
  notes,
})

const equipmentDependencyPaths = (notes: string): readonly EventRoutingRelationshipPathSeed[] => [
  { edgeTypes: ['targets', 'requires'], notes },
]

const auditOnly = (input: {
  readonly rationale: string
  readonly subject?: EventRoutingSubjectSeed
}): EventCoverageSeed => ({
  status: 'non_reactive',
  routingKind: 'audit_only',
  rationale: input.rationale,
  subject: input.subject,
  proofRequirements: documentationProofs,
  parkingRationale: input.rationale,
})

const aggregateInternal = (input: {
  readonly rationale: string
  readonly subject?: EventRoutingSubjectSeed
  readonly signals?: readonly string[]
}): EventCoverageSeed => ({
  status: 'non_reactive',
  routingKind: 'aggregate_internal',
  rationale: input.rationale,
  signals: input.signals,
  subject: input.subject,
  proofRequirements: ['aggregate_test', 'documentation_only'],
  parkingRationale: input.rationale,
})

const candidateProjection = (input: {
  readonly rationale: string
  readonly signals: readonly string[]
  readonly relationshipEdges: readonly RelationshipEdgeTypeValue[]
  readonly subject?: EventRoutingSubjectSeed
}): EventCoverageSeed => ({
  status: 'candidate',
  routingKind: 'candidate_projection',
  rationale: input.rationale,
  signals: input.signals,
  candidateRelationshipEdges: input.relationshipEdges,
  subject: input.subject,
  relationshipPaths: [{
    edgeTypes: input.relationshipEdges,
    notes: 'Candidate projection path. Promotion materializes/updates graph relationships but does not dispatch target mutations by itself.',
  }],
  proofRequirements: projectionProofs,
})

const eventOverrides: Record<string, EventCoverageSeed> = {
  EnterpriseCreated: structuralProjection({
    entityType: 'enterprise',
    action: 'created',
    relationshipEdges: ['contains'],
    rationale: 'Enterprise creation anchors the top of the structural graph; it materializes topology but does not dispatch Reactor pressure.',
  }),
  EnterpriseUpdated: structuralProjection({
    entityType: 'enterprise',
    action: 'updated',
    rationale: 'Enterprise metadata changes update projections only; no downstream consistency mutation is implied.',
  }),
  EnterpriseDecommissioned: structuralDecommission({
    entityType: 'enterprise',
    relationshipEdges: ['contains', 'targets', 'requires'],
    signals: ['structural.lifecycle = decommissioned'],
    rationale: 'Enterprise shutdown can cascade through contains hierarchy, but terminal inheritance policy is not production yet.',
  }),
  SiteCreated: structuralProjection({
    entityType: 'site',
    action: 'created',
    relationshipEdges: ['contains'],
    rationale: 'Site creation materializes the site node and parent contains topology; it does not dispatch Reactor pressure.',
  }),
  SiteUpdated: structuralProjection({
    entityType: 'site',
    action: 'updated',
    rationale: 'Site metadata changes update projections only; no downstream consistency mutation is implied.',
  }),
  SiteDecommissioned: structuralDecommission({
    entityType: 'site',
    relationshipEdges: ['contains', 'targets', 'requires'],
    signals: ['structural.lifecycle = decommissioned'],
    rationale: 'Site shutdown can cascade through contains hierarchy and impact active WorkOrders once inheritance policy exists.',
  }),
  AreaCreated: structuralProjection({
    entityType: 'area',
    action: 'created',
    relationshipEdges: ['contains'],
    rationale: 'Area creation materializes the area node and parent contains topology; it does not dispatch Reactor pressure.',
  }),
  AreaUpdated: structuralProjection({
    entityType: 'area',
    action: 'updated',
    rationale: 'Area metadata changes update projections only; no downstream consistency mutation is implied.',
  }),
  AreaDecommissioned: structuralDecommission({
    entityType: 'area',
    relationshipEdges: ['contains', 'targets', 'requires'],
    signals: ['structural.lifecycle = decommissioned'],
    rationale: 'Area shutdown can cascade through contains hierarchy and impact active WorkOrders once inheritance policy exists.',
  }),
  PlantCreated: structuralProjection({
    entityType: 'plant',
    action: 'created',
    relationshipEdges: ['contains'],
    rationale: 'Plant creation materializes plant topology under area/site and creates no target-owned reaction by itself.',
  }),
  PlantUpdated: structuralProjection({
    entityType: 'plant',
    action: 'updated',
    rationale: 'Plant metadata changes are projection-only unless a specific availability/lifecycle event is emitted.',
  }),
  PlantRelocated: structuralProjection({
    entityType: 'plant',
    action: 'relocated',
    relationshipEdges: ['contains'],
    rationale: 'Plant relocation updates containment topology; operational blocking requires a separate availability/lifecycle signal.',
  }),
  PlantDecommissioned: structuralDecommission({
    entityType: 'plant',
    relationshipEdges: ['contains', 'targets', 'requires'],
    signals: ['structural.lifecycle = decommissioned', 'equipment.availability = unavailable'],
    rationale: 'Plant decommissioning is a natural contains-cascade source, but child lifecycle and WorkOrder impact policy are not production yet.',
  }),
  LineCreated: structuralProjection({
    entityType: 'line',
    action: 'created',
    relationshipEdges: ['contains'],
    rationale: 'Line creation materializes line topology; it does not imply machine or WorkOrder state changes.',
  }),
  LineUpdated: structuralProjection({
    entityType: 'line',
    action: 'updated',
    rationale: 'Line metadata changes are projection-only unless a concrete availability/lifecycle event is emitted.',
  }),
  LineConfigChanged: structuralProjection({
    entityType: 'line',
    action: 'config_changed',
    rationale: 'Line configuration changes update topology/read models; Reactor dispatch requires explicit operational impact semantics.',
  }),
  LineRelocated: structuralProjection({
    entityType: 'line',
    action: 'relocated',
    relationshipEdges: ['contains'],
    rationale: 'Line relocation updates containment topology; operational blocking requires a separate availability/lifecycle signal.',
  }),
  LineDecommissioned: structuralDecommission({
    entityType: 'line',
    relationshipEdges: ['contains', 'targets', 'requires'],
    signals: ['structural.lifecycle = decommissioned', 'equipment.availability = unavailable'],
    rationale: 'Line decommissioning can affect contained machines and targeted WorkOrders once cascade policy is declared.',
  }),
  WorkCellCreated: structuralProjection({
    entityType: 'workcell',
    action: 'created',
    relationshipEdges: ['contains'],
    rationale: 'WorkCell creation materializes workcell topology; it does not imply WorkOrder mutation by itself.',
  }),
  WorkCellUpdated: structuralProjection({
    entityType: 'workcell',
    action: 'updated',
    rationale: 'WorkCell metadata changes are projection-only unless a concrete availability/lifecycle event is emitted.',
  }),
  WorkCellDecommissioned: structuralDecommission({
    entityType: 'workcell',
    relationshipEdges: ['contains', 'targets', 'requires'],
    signals: ['structural.lifecycle = decommissioned', 'equipment.availability = unavailable'],
    rationale: 'WorkCell decommissioning can affect contained machines and targeted WorkOrders once cascade policy is declared.',
  }),
  MachineCreated: structuralProjection({
    entityType: 'machine',
    action: 'created',
    relationshipEdges: ['contains'],
    rationale: 'Machine creation materializes the machine node and containment edge; availability pressure comes from equipment-state events.',
  }),
  MachineUpdated: structuralProjection({
    entityType: 'machine',
    action: 'updated',
    rationale: 'Machine metadata changes are projection-only; no WorkOrder dependency mutation is implied.',
  }),
  MachineConfigChanged: structuralProjection({
    entityType: 'machine',
    action: 'config_changed',
    rationale: 'Machine configuration changes update projections; dependency blocking requires an explicit availability/fault event.',
  }),
  MachineRelocated: structuralProjection({
    entityType: 'machine',
    action: 'relocated',
    relationshipEdges: ['contains'],
    rationale: 'Machine relocation updates containment topology; WorkOrder impact requires a separate availability/lifecycle signal.',
  }),
  MachineDecommissioned: structuralDecommission({
    entityType: 'machine',
    relationshipEdges: ['targets', 'requires'],
    signals: ['equipment.lifecycle = decommissioned', 'equipment.availability = unavailable'],
    rationale: 'Machine deletion/unavailability can block targets/requires WorkOrders, but terminal-review semantics are not declared yet.',
  }),
  SensorCreated: structuralProjection({
    entityType: 'sensor',
    action: 'created',
    relationshipEdges: ['monitors'],
    rationale: 'Sensor creation materializes measurement topology; it does not assert equipment condition by itself.',
  }),
  SensorUpdated: structuralProjection({
    entityType: 'sensor',
    action: 'updated',
    rationale: 'Sensor metadata changes are projection-only unless a sensor fault/reading event asserts a condition.',
  }),
  SensorCalibrated: structuralProjection({
    entityType: 'sensor',
    action: 'calibrated',
    rationale: 'Sensor calibration is audit/projection state; it does not automatically mutate monitored equipment or WorkOrders.',
  }),
  SensorThresholdChanged: structuralProjection({
    entityType: 'sensor',
    action: 'threshold_changed',
    rationale: 'Threshold changes affect future alarm/readings interpretation, not current Reactor consistency pressure.',
  }),
  SensorDecommissioned: structuralDecommission({
    entityType: 'sensor',
    relationshipEdges: ['monitors', 'triggered_by'],
    signals: ['sensor.lifecycle = decommissioned'],
    rationale: 'Sensor removal can affect monitored equipment or alarm validity, but no production policy exists yet.',
  }),
  DeviceCreated: structuralProjection({
    entityType: 'device',
    action: 'created',
    rationale: 'Device creation materializes the device node once device graph projection is enabled; no dependency pressure is asserted by creation alone.',
  }),
  DeviceUpdated: structuralProjection({
    entityType: 'device',
    action: 'updated',
    rationale: 'Device metadata/configuration changes are projection-only unless an availability event is emitted.',
  }),
  DeviceDecommissioned: structuralDecommission({
    entityType: 'device',
    relationshipEdges: ['targets', 'requires', 'triggered_by'],
    signals: ['device.lifecycle = decommissioned', 'device.availability = unavailable'],
    rationale: 'Device removal can invalidate required/targeted dependencies, but device availability observation is not declared yet.',
  }),
  AlarmTriggered: {
    status: 'candidate',
    rationale: 'Critical/emergency alarms can become WorkOrder safety holds once alarm-to-asset traversal and target contract are declared.',
    signals: ['alarm.state = triggered', 'alarm.severity = critical|emergency'],
    candidateRelationshipEdges: ['triggered_by', 'monitors', 'targets', 'requires'],
    targetCapabilities: [Capability.SafetyHold],
  },
  AlarmCleared: {
    status: 'candidate',
    rationale: 'Alarm clearing can retract safety pressure, but unblock/resume semantics must be target-owned first.',
    signals: ['alarm.state = cleared'],
    candidateRelationshipEdges: ['triggered_by', 'monitors', 'targets', 'requires'],
    targetCapabilities: [Capability.SafetyRelease],
  },
  AlarmEscalated: {
    status: 'candidate',
    rationale: 'Escalation can strengthen safety-hold pressure for related WorkOrders once severity policy exists.',
    signals: ['alarm.severity = escalated'],
    candidateRelationshipEdges: ['triggered_by', 'monitors', 'targets', 'requires'],
    targetCapabilities: [Capability.SafetyHold],
  },
  EquipmentStateChanged: {
    status: 'reactive',
    routingKind: 'reactor_dispatch',
    rationale: 'Production observation emits equipment.availability; unavailable routes over targets/requires to WorkOrder dependency.blocked.',
    signals: ['equipment.availability = unavailable|available'],
    productionPolicyIds: productionEquipmentPolicies,
    candidateRelationshipEdges: ['targets', 'requires'],
    targetCapabilities: [Capability.DependencyBlocked],
    subject: equipmentSubject('Availability is decoded from newState; unavailable states dispatch, available is observed but not yet release-capable.'),
    relationshipPaths: equipmentDependencyPaths('Production traversal over WorkOrders that target or require the observed machine.'),
    targetOwner: 'work_order',
    proofRequirements: reactiveDispatchProofs,
  },
  MaintenanceModeEntered: {
    status: 'reactive',
    routingKind: 'reactor_dispatch',
    rationale: 'Production observation asserts equipment.availability = unavailable and reuses WorkOrder dependency blocking.',
    signals: ['equipment.availability = unavailable'],
    productionPolicyIds: productionEquipmentPolicies,
    candidateRelationshipEdges: ['targets', 'requires'],
    targetCapabilities: [Capability.DependencyBlocked],
    subject: equipmentSubject('Maintenance entry is availability pressure on the machine regardless of scheduled/unscheduled maintenance type.'),
    relationshipPaths: equipmentDependencyPaths('Production traversal over WorkOrders that target or require the maintained machine.'),
    targetOwner: 'work_order',
    proofRequirements: reactiveDispatchProofs,
  },
  MaintenanceModeExited: {
    status: 'candidate',
    routingKind: 'candidate_dispatch',
    rationale: 'Available/unblock pressure needs explicit target-owned resume or release semantics before dispatch.',
    signals: ['equipment.availability = available'],
    candidateRelationshipEdges: ['targets', 'requires'],
    targetCapabilities: [Capability.DependencyReleased],
    subject: equipmentSubject('Maintenance exit can retract previous availability pressure, but WorkOrder release must be target-owned.'),
    relationshipPaths: equipmentDependencyPaths('Candidate release traversal over WorkOrders that target or require the machine.'),
    targetOwner: 'work_order',
    proofRequirements: candidateDispatchProofs,
  },
  PerformanceDegraded: {
    status: 'candidate',
    routingKind: 'candidate_dispatch',
    rationale: 'Performance degradation may require degraded-capacity planning rather than suspension; policy is not declared.',
    signals: ['equipment.performance = degraded'],
    candidateRelationshipEdges: ['targets', 'requires'],
    targetCapabilities: [Capability.CapacityDegraded],
    subject: equipmentSubject('Performance degradation is a capacity signal, not necessarily availability loss.'),
    relationshipPaths: equipmentDependencyPaths('Candidate degraded-capacity traversal for WorkOrders that target or require the machine.'),
    targetOwner: 'work_order',
    proofRequirements: candidateDispatchProofs,
  },
  FaultDetected: {
    status: 'reactive',
    routingKind: 'reactor_dispatch',
    rationale: 'Production observation asserts equipment.availability = unavailable and reuses WorkOrder dependency blocking.',
    signals: ['equipment.availability = unavailable', 'equipment.fault = detected'],
    productionPolicyIds: productionEquipmentPolicies,
    candidateRelationshipEdges: ['targets', 'requires'],
    targetCapabilities: [Capability.DependencyBlocked],
    subject: equipmentSubject('Fault detection is treated as machine unavailability for the current production Reactor lane.'),
    relationshipPaths: equipmentDependencyPaths('Production traversal over WorkOrders that target or require the faulted machine.'),
    targetOwner: 'work_order',
    proofRequirements: reactiveDispatchProofs,
  },
  FaultCleared: {
    status: 'candidate',
    routingKind: 'candidate_dispatch',
    rationale: 'Fault clearing can retract availability pressure, but unblock/resume policy is not declared.',
    signals: ['equipment.availability = available', 'equipment.fault = cleared'],
    candidateRelationshipEdges: ['targets', 'requires'],
    targetCapabilities: [Capability.DependencyReleased],
    subject: equipmentSubject('Fault clearing can retract machine unavailability, but WorkOrder release must be target-owned.'),
    relationshipPaths: equipmentDependencyPaths('Candidate release traversal over WorkOrders that target or require the machine.'),
    targetOwner: 'work_order',
    proofRequirements: candidateDispatchProofs,
  },
  WorkOrderStarted: {
    status: 'candidate',
    rationale: 'WorkOrder execution can affect dependent WorkOrders over depends_on, but echo-loop and ownership rules must be declared.',
    signals: ['work_order.execution = started'],
    candidateRelationshipEdges: ['depends_on'],
  },
  WorkOrderSuspended: {
    status: 'candidate',
    rationale: 'A suspended upstream WorkOrder can block downstream WorkOrders over depends_on once causality/idempotency policy exists.',
    signals: ['work_order.execution = suspended'],
    candidateRelationshipEdges: ['depends_on'],
    targetCapabilities: [Capability.DependencyBlocked],
  },
  WorkOrderResumed: {
    status: 'candidate',
    rationale: 'A resumed upstream WorkOrder can release downstream pressure only after target-owned resume semantics exist.',
    signals: ['work_order.execution = resumed'],
    candidateRelationshipEdges: ['depends_on'],
    targetCapabilities: [Capability.DependencyReleased],
  },
  WorkOrderCompleted: {
    status: 'candidate',
    rationale: 'Completion can satisfy downstream depends_on prerequisites once dependency fulfillment semantics are declared.',
    signals: ['work_order.execution = completed'],
    candidateRelationshipEdges: ['depends_on'],
    targetCapabilities: [Capability.DependencySatisfied],
  },
  WorkOrderFailed: {
    status: 'candidate',
    rationale: 'Failure can block or fail downstream WorkOrders over depends_on once target reaction semantics exist.',
    signals: ['work_order.execution = failed'],
    candidateRelationshipEdges: ['depends_on'],
    targetCapabilities: [Capability.DependencyBlocked],
  },
  WorkOrderCancelled: {
    status: 'candidate',
    rationale: 'Cancellation can block or replan downstream WorkOrders over depends_on once target reaction semantics exist.',
    signals: ['work_order.execution = cancelled'],
    candidateRelationshipEdges: ['depends_on'],
    targetCapabilities: [Capability.DependencyBlocked, Capability.DependencyReplanRequired],
  },
  AssetAttached: {
    status: 'candidate',
    rationale: 'Can materialize targets/related_to graph edges from context, but should be projection-first rather than Reactor dispatch.',
    signals: ['context.asset = attached'],
    candidateRelationshipEdges: ['targets', 'related_to'],
  },
  AssetDetached: {
    status: 'candidate',
    rationale: 'Can close graph edges temporally; dispatch only if detachment implies active dependency loss.',
    signals: ['context.asset = detached'],
    candidateRelationshipEdges: ['targets', 'related_to'],
  },
  ExternalRefLinked: {
    status: 'candidate',
    rationale: 'Can materialize external requires/produces relationships; no target mutation policy yet.',
    signals: ['context.external_ref = linked'],
    candidateRelationshipEdges: ['requires', 'produces', 'related_to'],
  },
  ExternalRefUnlinked: {
    status: 'candidate',
    rationale: 'Can close external relationships; dispatch only if dependency availability changes.',
    signals: ['context.external_ref = unlinked'],
    candidateRelationshipEdges: ['requires', 'produces', 'related_to'],
  },
  ChildWorkOrderSpawned: {
    status: 'candidate',
    rationale: 'Can materialize depends_on/caused_by edges between parent and child WorkOrders.',
    signals: ['context.child_work_order = spawned'],
    candidateRelationshipEdges: ['depends_on', 'caused_by'],
  },
  TaskBlocked: {
    status: 'candidate',
    rationale: 'Could block parent WorkOrder if task nodes become graph entities; currently likely aggregate-internal.',
    signals: ['task.execution = blocked'],
    targetCapabilities: [Capability.DependencyBlocked],
  },
  TaskUnblocked: {
    status: 'candidate',
    rationale: 'Could release parent WorkOrder task pressure, but aggregate ownership must be defined.',
    signals: ['task.execution = unblocked'],
    targetCapabilities: [Capability.DependencyReleased],
  },
  TaskFailed: {
    status: 'candidate',
    rationale: 'Could fail/block parent WorkOrder if task-to-WorkOrder graph edges are promoted.',
    signals: ['task.execution = failed'],
    targetCapabilities: [Capability.DependencyBlocked],
  },
  ApprovalRejected: {
    status: 'candidate',
    rationale: 'Can produce approval-hold/rejection pressure for a WorkOrder once approval target links are modeled.',
    signals: ['approval.state = rejected'],
    candidateRelationshipEdges: ['supervises', 'related_to'],
    targetCapabilities: [Capability.ApprovalHold],
  },
  ApprovalEscalated: {
    status: 'candidate',
    rationale: 'Escalation can notify/supervise related WorkOrders or alarms; no mutation policy yet.',
    signals: ['approval.state = escalated'],
    candidateRelationshipEdges: ['supervises', 'related_to'],
  },
  ApprovalExpired: {
    status: 'candidate',
    rationale: 'Expired approvals can hold dependent execution once approval dependencies are graph-modeled.',
    signals: ['approval.state = expired'],
    candidateRelationshipEdges: ['requires', 'supervises'],
    targetCapabilities: [Capability.ApprovalHold],
  },
  BatchDeviation: {
    status: 'candidate',
    rationale: 'Deviation can produce quality/safety hold pressure over produced/related assets once policy exists.',
    signals: ['batch.deviation = detected'],
    candidateRelationshipEdges: ['produces', 'related_to'],
    targetCapabilities: [Capability.QualityHold],
  },
  InspectionCompleted: {
    status: 'candidate',
    rationale: 'Failed inspection can trigger quality hold, but result-to-target relationship policy is not declared.',
    signals: ['quality.inspection = completed'],
    candidateRelationshipEdges: ['related_to', 'produces'],
    targetCapabilities: [Capability.QualityHold],
  },
  NCROpened: {
    status: 'candidate',
    rationale: 'Open non-conformance can hold related WorkOrders/batches once quality graph edges exist.',
    signals: ['quality.ncr = opened'],
    candidateRelationshipEdges: ['related_to', 'produces'],
    targetCapabilities: [Capability.QualityHold],
  },
  NCRClosed: {
    status: 'candidate',
    rationale: 'Closed NCR can release quality pressure only after target-owned release semantics exist.',
    signals: ['quality.ncr = closed'],
    candidateRelationshipEdges: ['related_to', 'produces'],
    targetCapabilities: [Capability.QualityRelease],
  },
  CAPACreated: {
    status: 'candidate',
    rationale: 'CAPA creation can relate quality remediation to affected WorkOrders/assets; mutation semantics are not declared.',
    signals: ['quality.capa = created'],
    candidateRelationshipEdges: ['related_to'],
    targetCapabilities: [Capability.QualityHold],
  },
  CAPAResolved: {
    status: 'candidate',
    rationale: 'CAPA resolution can release quality pressure once target-owned release semantics exist.',
    signals: ['quality.capa = resolved'],
    candidateRelationshipEdges: ['related_to'],
    targetCapabilities: [Capability.QualityRelease],
  },
  BaseOperationalEvent: auditOnly({
    rationale: 'BaseOperationalEvent is an envelope placeholder; concrete operational events own routing semantics.',
  }),
  AlarmAcknowledged: aggregateInternal({
    rationale: 'Alarm acknowledgment changes alarm lifecycle/audit state only; it does not assert safety pressure by itself.',
    subject: { entityType: 'alarm', source: 'payload.alarmId / graph node: alarm' },
    signals: ['alarm.lifecycle = acknowledged'],
  }),
  AlarmShelved: aggregateInternal({
    rationale: 'Shelving is alarm lifecycle state; it should not mutate related WorkOrders without a separate safety policy.',
    subject: { entityType: 'alarm', source: 'payload.alarmId / graph node: alarm' },
    signals: ['alarm.lifecycle = shelved'],
  }),
  AlarmUnshelved: aggregateInternal({
    rationale: 'Unshelving changes alarm lifecycle state; active safety pressure must come from trigger/escalation/clear events.',
    subject: { entityType: 'alarm', source: 'payload.alarmId / graph node: alarm' },
    signals: ['alarm.lifecycle = unshelved'],
  }),
  AlarmSuppressed: aggregateInternal({
    rationale: 'Suppression changes alarm lifecycle state and audit posture, not WorkOrder consistency pressure.',
    subject: { entityType: 'alarm', source: 'payload.alarmId / graph node: alarm' },
    signals: ['alarm.lifecycle = suppressed'],
  }),
  AlarmOutOfService: aggregateInternal({
    rationale: 'Out-of-service alarm state affects alarm handling/audit; it is not a production Reactor dispatch source.',
    subject: { entityType: 'alarm', source: 'payload.alarmId / graph node: alarm' },
    signals: ['alarm.lifecycle = out_of_service'],
  }),
  AlarmReturnedToService: aggregateInternal({
    rationale: 'Return-to-service restores alarm lifecycle state; safety pressure remains owned by trigger/escalation/clear semantics.',
    subject: { entityType: 'alarm', source: 'payload.alarmId / graph node: alarm' },
    signals: ['alarm.lifecycle = returned_to_service'],
  }),
  AlarmConfigChanged: aggregateInternal({
    rationale: 'Alarm configuration changes update alarm projection/audit only; they do not imply current safety pressure.',
    subject: { entityType: 'alarm', source: 'payload.alarmId / graph node: alarm' },
    signals: ['alarm.config = changed'],
  }),
  WorkOrderCreated: candidateProjection({
    rationale: 'WorkOrder creation should materialize the work_order graph node and initial target/related edges, but not dispatch target mutations.',
    signals: ['work_order.lifecycle = created'],
    relationshipEdges: ['targets', 'related_to'],
    subject: { entityType: 'work_order', source: 'payload.workOrderId / graph node: work_order' },
  }),
  WorkOrderSubmitted: aggregateInternal({
    rationale: 'Submission is WorkOrder lifecycle state; cross-entity effects require explicit dependency or approval policies.',
    subject: { entityType: 'work_order', source: 'payload.workOrderId / graph node: work_order' },
    signals: ['work_order.lifecycle = submitted'],
  }),
  WorkOrderApproved: aggregateInternal({
    rationale: 'Approval changes WorkOrder lifecycle state; execution/dependency propagation is not implied by approval alone.',
    subject: { entityType: 'work_order', source: 'payload.workOrderId / graph node: work_order' },
    signals: ['work_order.lifecycle = approved'],
  }),
  WorkOrderRejected: aggregateInternal({
    rationale: 'Rejection is owned by the WorkOrder lifecycle/approval aggregate; dependency propagation requires a declared policy.',
    subject: { entityType: 'work_order', source: 'payload.workOrderId / graph node: work_order' },
    signals: ['work_order.lifecycle = rejected'],
  }),
  WorkOrderClosed: aggregateInternal({
    rationale: 'Closure is terminal WorkOrder audit/lifecycle state; no downstream dependency semantics are currently declared.',
    subject: { entityType: 'work_order', source: 'payload.workOrderId / graph node: work_order' },
    signals: ['work_order.lifecycle = closed'],
  }),
  ContextCreated: aggregateInternal({
    rationale: 'Context creation establishes a WorkOrder context aggregate; relationship edges are created by specific attach/link/spawn events.',
    signals: ['context.lifecycle = created'],
  }),
  ContextUpdated: aggregateInternal({
    rationale: 'Generic context updates are audit/projection state; only typed context events materialize graph relationships.',
    signals: ['context.lifecycle = updated'],
  }),
  ContextSnapshotted: auditOnly({
    rationale: 'Context snapshots are immutable audit points and do not mutate graph topology or target entities.',
  }),
  ResourceAllocated: candidateProjection({
    rationale: 'Resource allocation can become a requires/supervises relationship once resource nodes are modeled explicitly.',
    signals: ['context.resource = allocated'],
    relationshipEdges: ['requires', 'supervises'],
  }),
  ResourceReleased: candidateProjection({
    rationale: 'Resource release can close requires/supervises relationships once resource nodes are modeled explicitly.',
    signals: ['context.resource = released'],
    relationshipEdges: ['requires', 'supervises'],
  }),
  TaskBecameReady: aggregateInternal({
    rationale: 'Task readiness is internal to task/work-order execution planning until task nodes become graph entities.',
    signals: ['task.execution = ready'],
  }),
  TaskStarted: aggregateInternal({
    rationale: 'Task start is aggregate-internal execution state; it does not dispatch Reactor pressure by itself.',
    signals: ['task.execution = started'],
  }),
  TaskProgressUpdated: aggregateInternal({
    rationale: 'Task progress updates are execution telemetry/audit, not graph-scoped consistency pressure.',
    signals: ['task.progress = updated'],
  }),
  TaskCompleted: aggregateInternal({
    rationale: 'Task completion may satisfy aggregate-local prerequisites; graph propagation waits until task nodes/contracts are promoted.',
    signals: ['task.execution = completed'],
  }),
  TaskSkipped: aggregateInternal({
    rationale: 'Task skip is aggregate-local execution state unless a future policy links skipped tasks to WorkOrder dependency pressure.',
    signals: ['task.execution = skipped'],
  }),
  TaskCompensated: aggregateInternal({
    rationale: 'Task compensation is saga/audit state inside the task/work-order aggregate, not a production Reactor source.',
    signals: ['task.execution = compensated'],
  }),
  ApprovalRequested: aggregateInternal({
    rationale: 'Approval request creation is approval workflow state; target holds require explicit approval relationship modeling.',
    signals: ['approval.state = requested'],
  }),
  ApprovalGranted: aggregateInternal({
    rationale: 'Approval grant releases approval workflow pressure inside the approval aggregate; target release policy is not declared.',
    signals: ['approval.state = granted'],
  }),
  ApprovalCompleted: aggregateInternal({
    rationale: 'Approval completion is workflow audit state and does not dispatch Reactor pressure by itself.',
    signals: ['approval.state = completed'],
  }),
  BatchStarted: auditOnly({
    rationale: 'Batch start is a regulatory production record; no graph-scoped consistency reaction is declared.',
  }),
  ParameterRecorded: auditOnly({
    rationale: 'Parameter records are regulatory telemetry/audit; deviations or quality events own any future hold semantics.',
  }),
  BatchCompleted: auditOnly({
    rationale: 'Batch completion is production/audit state; quality release/hold policies must be declared separately.',
  }),
  OperatorLogin: auditOnly({
    rationale: 'Operator login is compliance audit state and never a Reactor dispatch source.',
  }),
  OperatorLogout: auditOnly({
    rationale: 'Operator logout is compliance audit state and never a Reactor dispatch source.',
  }),
  ParameterOverride: auditOnly({
    rationale: 'Parameter override is compliance/audit state; any operational effect must be represented by a separate domain event.',
  }),
  ManualAcknowledgment: auditOnly({
    rationale: 'Manual acknowledgment is operator audit state; target mutation remains owned by the acknowledged domain event.',
  }),
  ShiftHandoff: auditOnly({
    rationale: 'Shift handoff is operator continuity/audit state and does not imply graph-scoped mutation.',
  }),
}

const productionObservationByTag = new Map(
  ReactiveEquipmentStateObservationSpecs.map((spec) => [spec.eventTag, spec.id] as const),
)

export const EXPLICIT_EVENT_ROUTING_CONTRACT_TAGS = Object.freeze(
  Object.keys(eventOverrides).sort((a, b) => a.localeCompare(b)),
)

const seedForEvent = (group: ReactorEventGroupName, tag: string): EventCoverageSeed =>
  eventOverrides[tag] ?? groupDefaults[group]

export const getReactorEventCoverageEntries = (): readonly ReactorEventCoverageEntry[] => {
  const entries: ReactorEventCoverageEntry[] = []
  const eventGroupTags = getIiotEventGroupTags()

  for (const group of Object.keys(EVENT_GROUPS) as ReactorEventGroupName[]) {
    for (const tag of eventGroupTags[group]) {
      const seed = seedForEvent(group, tag)
      const productionObservationId = productionObservationByTag.get(tag)
      entries.push(new ReactorEventCoverageEntry({
        group,
        tag,
        status: seed.status,
        rationale: seed.rationale,
        signals: Array.from(seed.signals ?? []),
        productionObservationIds: productionObservationId ? [productionObservationId] : [],
        productionPolicyIds: Array.from(seed.productionPolicyIds ?? []),
        candidateRelationshipEdges: Array.from(seed.candidateRelationshipEdges ?? []),
        targetCapabilities: Array.from(seed.targetCapabilities ?? []),
      }))
    }
  }

  return entries.sort((a, b) => a.group.localeCompare(b.group) || a.tag.localeCompare(b.tag))
}

const subjectTypeFromStructuralTag = (tag: string): RelationshipNodeTypeValue | undefined => {
  if (tag.startsWith('Enterprise')) return 'enterprise'
  if (tag.startsWith('Site')) return 'site'
  if (tag.startsWith('Area')) return 'area'
  if (tag.startsWith('Plant')) return 'plant'
  if (tag.startsWith('Line')) return 'line'
  if (tag.startsWith('WorkCell')) return 'workcell'
  if (tag.startsWith('Machine')) return 'machine'
  if (tag.startsWith('Sensor')) return 'sensor'
  if (tag.startsWith('Device')) return 'device'
  return undefined
}

const subjectForEvent = (entry: ReactorEventCoverageEntry, seed: EventCoverageSeed): EventRoutingSubject => {
  if (seed.subject) {
    return new EventRoutingSubject({
      entityType: seed.subject.entityType,
      source: seed.subject.source,
      notes: seed.subject.notes,
    })
  }

  const entityType = entry.group === 'EquipmentStateEvents'
    ? 'machine'
    : entry.group === 'AlarmEvents'
      ? 'alarm'
      : entry.group === 'WorkOrderEvents'
        ? 'work_order'
        : entry.group === 'StructuralEvents'
          ? subjectTypeFromStructuralTag(entry.tag)
          : undefined

  return new EventRoutingSubject({
    entityType,
    source: entityType
      ? `payload primary key / graph node: ${entityType}`
      : `payload primary key for ${entry.group}; graph subject requires event-specific projection`,
    notes: entry.group === 'ContextEvents'
      ? 'Context events often materialize or close relationship edges rather than dispatching directly.'
      : undefined,
  })
}

const routingKindForEvent = (entry: ReactorEventCoverageEntry, seed: EventCoverageSeed): EventRoutingKind => {
  if (seed.routingKind) return seed.routingKind
  if (entry.status === 'reactive') return 'reactor_dispatch'
  if (entry.status === 'non_reactive') return 'audit_only'
  if (entry.group === 'ContextEvents') return 'candidate_projection'
  if (entry.group === 'TaskEvents') return 'aggregate_internal'
  if (entry.candidateRelationshipEdges.length > 0 || entry.targetCapabilities.length > 0) return 'candidate_dispatch'
  return 'candidate_projection'
}

const proofRequirementsForEvent = (entry: ReactorEventCoverageEntry, seed: EventCoverageSeed): EventRoutingProofRequirement[] => {
  if (seed.proofRequirements) return Array.from(seed.proofRequirements)
  if (entry.status === 'reactive') return Array.from(reactiveDispatchProofs)
  if (entry.status === 'non_reactive') return Array.from(documentationProofs)
  if (entry.group === 'ContextEvents') return Array.from(projectionProofs)
  if (entry.group === 'TaskEvents') return ['aggregate_test', 'documentation_only']
  return Array.from(candidateDispatchProofs)
}

const workOrderOwnedCapabilities = new Set<EntityCapabilityIdValue>([
  Capability.DependencyBlocked,
  Capability.DependencyReleased,
  Capability.DependencySatisfied,
  Capability.DependencyReplanRequired,
  Capability.SafetyHold,
  Capability.SafetyRelease,
])

const qualityOwnedCapabilities = new Set<EntityCapabilityIdValue>([
  Capability.QualityHold,
  Capability.QualityRelease,
])

const approvalOwnedCapabilities = new Set<EntityCapabilityIdValue>([
  Capability.ApprovalHold,
])

const structuralOwnedCapabilities = new Set<EntityCapabilityIdValue>([
  Capability.LifecycleInherited,
])

const hasAnyCapability = (
  capabilities: readonly EntityCapabilityIdValue[],
  candidates: ReadonlySet<EntityCapabilityIdValue>,
): boolean => capabilities.some((capability) => candidates.has(capability))

const targetOwnerForEvent = (entry: ReactorEventCoverageEntry, seed: EventCoverageSeed): string | undefined => {
  if (seed.targetOwner !== undefined) return seed.targetOwner
  if (entry.status === 'non_reactive') return undefined
  if (hasAnyCapability(entry.targetCapabilities, workOrderOwnedCapabilities)) return 'work_order'
  if (hasAnyCapability(entry.targetCapabilities, qualityOwnedCapabilities)) return 'quality/work_order'
  if (hasAnyCapability(entry.targetCapabilities, approvalOwnedCapabilities)) return 'approval/work_order'
  if (hasAnyCapability(entry.targetCapabilities, structuralOwnedCapabilities)) return 'structural_entity'
  return 'tbd'
}

const relationshipPathsForEvent = (entry: ReactorEventCoverageEntry, seed: EventCoverageSeed): EventRoutingRelationshipPath[] => {
  if (seed.relationshipPaths) {
    return seed.relationshipPaths.map((path) => new EventRoutingRelationshipPath({
      edgeTypes: Array.from(path.edgeTypes),
      notes: path.notes,
    }))
  }

  if (entry.candidateRelationshipEdges.length === 0) return []
  return [new EventRoutingRelationshipPath({
    edgeTypes: Array.from(entry.candidateRelationshipEdges),
    notes: entry.status === 'reactive'
      ? 'Production traversal set; runtime policy matching chooses concrete edge policies.'
      : 'Candidate traversal set; promotion requires explicit policy and proof requirements.',
  })]
}

export const getEventRoutingContracts = (): readonly EventRoutingContract[] =>
  getReactorEventCoverageEntries().map((entry) => {
    const seed = seedForEvent(entry.group, entry.tag)
    return new EventRoutingContract({
      id: `${entry.group}.${entry.tag}`,
      group: entry.group,
      eventTag: entry.tag,
      status: entry.status,
      routingKind: routingKindForEvent(entry, seed),
      subject: subjectForEvent(entry, seed),
      signals: Array.from(entry.signals),
      relationshipPaths: relationshipPathsForEvent(entry, seed),
      targetOwner: targetOwnerForEvent(entry, seed),
      targetCapabilities: Array.from(entry.targetCapabilities),
      productionObservationIds: Array.from(entry.productionObservationIds),
      productionPolicyIds: Array.from(entry.productionPolicyIds),
      proofRequirements: proofRequirementsForEvent(entry, seed),
      rationale: entry.rationale,
      parkingRationale: seed.parkingRationale ?? (entry.status === 'non_reactive' ? entry.rationale : undefined),
    })
  })

const relationshipCoverageSeeds: Record<RelationshipEdgeTypeValue, RelationshipCoverageSeed> = {
  targets: {
    status: 'production',
    rationale: 'Production lane: machine availability observed on target routes dependency.blocked to source WorkOrder.',
    candidateSignals: ['equipment.availability', 'alarm.safety', 'quality.hold'],
    targetCapabilities: [Capability.DependencyBlocked, Capability.SafetyHold],
  },
  requires: {
    status: 'production',
    rationale: 'Production lane for required machine availability; external/device availability remain candidate expansions.',
    candidateSignals: ['equipment.availability', 'device.availability', 'external.availability'],
    targetCapabilities: [Capability.DependencyBlocked],
  },
  caused_by: {
    status: 'candidate',
    rationale: 'Causal provenance is modeled, but automatic mutation from cause chains needs explicit target contracts.',
    candidateSignals: ['alarm.state', 'work_order.execution'],
    targetCapabilities: [Capability.SafetyHold, Capability.DependencyBlocked],
  },
  depends_on: {
    status: 'candidate',
    rationale: 'WorkOrder-to-WorkOrder dependency propagation is a high-value next lane, guarded by causality/idempotency.',
    candidateSignals: ['work_order.execution = suspended|failed|cancelled|completed|resumed'],
    targetCapabilities: [Capability.DependencyBlocked, Capability.DependencySatisfied, Capability.DependencyReleased],
  },
  related_to: {
    status: 'reference',
    rationale: 'Broad association edge; intentionally non-reactive without a narrower policy.',
  },
  supervises: {
    status: 'candidate',
    rationale: 'Can route supervisor/approval escalation and external outage semantics once external actor availability exists.',
    candidateSignals: ['approval.state', 'external.availability'],
    targetCapabilities: [Capability.ApprovalHold],
  },
  produces: {
    status: 'reference',
    rationale: 'Output/provenance edge; normally queryable lineage rather than consistency pressure.',
    candidateSignals: ['quality.hold'],
  },
  contains: {
    status: 'topology',
    rationale: 'Core structural traversal edge. Reactive inheritance/cascade policy is intentionally separate and not yet production.',
    candidateSignals: ['equipment.lifecycle = decommissioned', 'site/plant/line availability'],
    targetCapabilities: [Capability.DependencyBlocked, Capability.LifecycleInherited],
  },
  monitors: {
    status: 'candidate',
    rationale: 'Sensor/device conditions can project to monitored equipment availability, but derivation policy is not declared.',
    candidateSignals: ['sensor.fault', 'alarm.state'],
    targetCapabilities: ['equipment.availability.asserted'],
  },
  triggered_by: {
    status: 'candidate',
    rationale: 'Alarm trigger provenance can connect alarm severity to sensor/device and then to impacted WorkOrders.',
    candidateSignals: ['alarm.state = triggered|cleared', 'alarm.severity'],
    targetCapabilities: [Capability.SafetyHold, Capability.SafetyRelease],
  },
}

export const getReactorRelationshipCoverageEntries = (): readonly ReactorRelationshipCoverageEntry[] =>
  Object.entries(RELATIONSHIP_EDGE_REGISTRY)
    .map(([edgeType, descriptor]) => {
      const seed = relationshipCoverageSeeds[edgeType as RelationshipEdgeTypeValue]
      return new ReactorRelationshipCoverageEntry({
        edgeType: edgeType as RelationshipEdgeTypeValue,
        directionality: descriptor.directionality,
        status: seed.status,
        allowedSourceTypes: Array.from(descriptor.allowedSourceTypes),
        allowedTargetTypes: Array.from(descriptor.allowedTargetTypes),
        allowedPairCount: descriptor.allowedSourceTypes.length * descriptor.allowedTargetTypes.length,
        productionPolicyIds: descriptor.propagationPolicies.map((policy) => policy.id),
        propagationDescriptorIds: descriptor.propagationDescriptors.map((policy) => policy.id),
        candidateSignals: Array.from(seed.candidateSignals ?? []),
        targetCapabilities: Array.from(seed.targetCapabilities ?? []),
        rationale: seed.rationale,
      })
    })
    .sort((a, b) => a.edgeType.localeCompare(b.edgeType))

export const getReactorTopologyAtlas = (generatedAtIso = new Date().toISOString()): ReactorTopologyAtlas => {
  const eventCoverage = getReactorEventCoverageEntries()
  const eventRoutingContracts = getEventRoutingContracts()
  const relationshipCoverage = getReactorRelationshipCoverageEntries()
  const stats = new ReactorTopologyStats({
    eventGroupCount: Object.keys(EVENT_GROUPS).length,
    eventTagCount: eventCoverage.length,
    reactiveEventCount: eventCoverage.filter((entry) => entry.status === 'reactive').length,
    candidateEventCount: eventCoverage.filter((entry) => entry.status === 'candidate').length,
    nonReactiveEventCount: eventCoverage.filter((entry) => entry.status === 'non_reactive').length,
    relationshipEdgeCount: relationshipCoverage.length,
    relationshipAllowedPairCount: relationshipCoverage.reduce((total, entry) => total + entry.allowedPairCount, 0),
    productionPolicyCount: relationshipCoverage.reduce((total, entry) => total + entry.productionPolicyIds.length, 0),
  })

  return new ReactorTopologyAtlas({
    generatedAtIso,
    eventCoverage: Array.from(eventCoverage),
    eventRoutingContracts: Array.from(eventRoutingContracts),
    relationshipCoverage: Array.from(relationshipCoverage),
    stats,
  })
}
