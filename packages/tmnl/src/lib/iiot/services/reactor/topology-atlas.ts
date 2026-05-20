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

export class ReactorEventCoverageEntry extends Schema.TaggedClass<ReactorEventCoverageEntry>()('ReactorEventCoverageEntry', {
  group: ReactorEventGroupName,
  tag: Schema.String,
  status: ReactorEventCoverageStatus,
  rationale: Schema.String,
  signals: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  productionObservationIds: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  productionPolicyIds: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  candidateRelationshipEdges: Schema.optionalWith(Schema.Array(RelationshipEdgeType), { default: () => [] }),
  targetCapabilities: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
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
  targetCapabilities: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
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

type EventCoverageSeed = {
  readonly status: ReactorEventCoverageStatus
  readonly rationale: string
  readonly signals?: readonly string[]
  readonly productionPolicyIds?: readonly string[]
  readonly candidateRelationshipEdges?: readonly RelationshipEdgeTypeValue[]
  readonly targetCapabilities?: readonly string[]
}

type RelationshipCoverageSeed = {
  readonly status: ReactorRelationshipCoverageStatus
  readonly rationale: string
  readonly candidateSignals?: readonly string[]
  readonly targetCapabilities?: readonly string[]
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

const eventOverrides: Record<string, EventCoverageSeed> = {
  EnterpriseDecommissioned: {
    status: 'candidate',
    rationale: 'Enterprise shutdown can cascade through contains hierarchy, but terminal inheritance policy is not production yet.',
    signals: ['structural.lifecycle = decommissioned'],
    candidateRelationshipEdges: ['contains', 'targets', 'requires'],
    targetCapabilities: ['lifecycle.inherited', 'dependency.blocked'],
  },
  SiteDecommissioned: {
    status: 'candidate',
    rationale: 'Site shutdown can cascade through contains hierarchy and impact active WorkOrders once inheritance policy exists.',
    signals: ['structural.lifecycle = decommissioned'],
    candidateRelationshipEdges: ['contains', 'targets', 'requires'],
    targetCapabilities: ['lifecycle.inherited', 'dependency.blocked'],
  },
  AreaDecommissioned: {
    status: 'candidate',
    rationale: 'Area shutdown can cascade through contains hierarchy and impact active WorkOrders once inheritance policy exists.',
    signals: ['structural.lifecycle = decommissioned'],
    candidateRelationshipEdges: ['contains', 'targets', 'requires'],
    targetCapabilities: ['lifecycle.inherited', 'dependency.blocked'],
  },
  PlantDecommissioned: {
    status: 'candidate',
    rationale: 'Plant decommissioning is a natural contains-cascade source, but child lifecycle and WorkOrder impact policy are not production yet.',
    signals: ['structural.lifecycle = decommissioned', 'equipment.availability = unavailable'],
    candidateRelationshipEdges: ['contains', 'targets', 'requires'],
    targetCapabilities: ['lifecycle.inherited', 'dependency.blocked'],
  },
  LineDecommissioned: {
    status: 'candidate',
    rationale: 'Line decommissioning can affect contained machines and targeted WorkOrders once cascade policy is declared.',
    signals: ['structural.lifecycle = decommissioned', 'equipment.availability = unavailable'],
    candidateRelationshipEdges: ['contains', 'targets', 'requires'],
    targetCapabilities: ['lifecycle.inherited', 'dependency.blocked'],
  },
  WorkCellDecommissioned: {
    status: 'candidate',
    rationale: 'WorkCell decommissioning can affect contained machines and targeted WorkOrders once cascade policy is declared.',
    signals: ['structural.lifecycle = decommissioned', 'equipment.availability = unavailable'],
    candidateRelationshipEdges: ['contains', 'targets', 'requires'],
    targetCapabilities: ['lifecycle.inherited', 'dependency.blocked'],
  },
  MachineDecommissioned: {
    status: 'candidate',
    rationale: 'Machine deletion/unavailability can block targets/requires WorkOrders, but terminal-review semantics are not declared yet.',
    signals: ['equipment.lifecycle = decommissioned', 'equipment.availability = unavailable'],
    candidateRelationshipEdges: ['targets', 'requires'],
    targetCapabilities: ['dependency.blocked', 'terminal.review_hold'],
  },
  SensorDecommissioned: {
    status: 'candidate',
    rationale: 'Sensor removal can affect monitored equipment or alarm validity, but no production policy exists yet.',
    signals: ['sensor.lifecycle = decommissioned'],
    candidateRelationshipEdges: ['monitors', 'triggered_by'],
  },
  DeviceDecommissioned: {
    status: 'candidate',
    rationale: 'Device removal can invalidate required/targeted dependencies, but device availability observation is not declared yet.',
    signals: ['device.lifecycle = decommissioned', 'device.availability = unavailable'],
    candidateRelationshipEdges: ['targets', 'requires', 'triggered_by'],
    targetCapabilities: ['dependency.blocked'],
  },
  AlarmTriggered: {
    status: 'candidate',
    rationale: 'Critical/emergency alarms can become WorkOrder safety holds once alarm-to-asset traversal and target contract are declared.',
    signals: ['alarm.state = triggered', 'alarm.severity = critical|emergency'],
    candidateRelationshipEdges: ['triggered_by', 'monitors', 'targets', 'requires'],
    targetCapabilities: ['safety.hold'],
  },
  AlarmCleared: {
    status: 'candidate',
    rationale: 'Alarm clearing can retract safety pressure, but unblock/resume semantics must be target-owned first.',
    signals: ['alarm.state = cleared'],
    candidateRelationshipEdges: ['triggered_by', 'monitors', 'targets', 'requires'],
    targetCapabilities: ['safety.release'],
  },
  AlarmEscalated: {
    status: 'candidate',
    rationale: 'Escalation can strengthen safety-hold pressure for related WorkOrders once severity policy exists.',
    signals: ['alarm.severity = escalated'],
    candidateRelationshipEdges: ['triggered_by', 'monitors', 'targets', 'requires'],
    targetCapabilities: ['safety.hold'],
  },
  EquipmentStateChanged: {
    status: 'reactive',
    rationale: 'Production observation emits equipment.availability; unavailable routes over targets/requires to WorkOrder dependency.blocked.',
    signals: ['equipment.availability = unavailable|available'],
    productionPolicyIds: productionEquipmentPolicies,
    candidateRelationshipEdges: ['targets', 'requires'],
    targetCapabilities: ['dependency.blocked'],
  },
  MaintenanceModeEntered: {
    status: 'reactive',
    rationale: 'Production observation asserts equipment.availability = unavailable and reuses WorkOrder dependency blocking.',
    signals: ['equipment.availability = unavailable'],
    productionPolicyIds: productionEquipmentPolicies,
    candidateRelationshipEdges: ['targets', 'requires'],
    targetCapabilities: ['dependency.blocked'],
  },
  MaintenanceModeExited: {
    status: 'candidate',
    rationale: 'Available/unblock pressure needs explicit target-owned resume or release semantics before dispatch.',
    signals: ['equipment.availability = available'],
    candidateRelationshipEdges: ['targets', 'requires'],
    targetCapabilities: ['dependency.released'],
  },
  PerformanceDegraded: {
    status: 'candidate',
    rationale: 'Performance degradation may require degraded-capacity planning rather than suspension; policy is not declared.',
    signals: ['equipment.performance = degraded'],
    candidateRelationshipEdges: ['targets', 'requires'],
    targetCapabilities: ['capacity.degraded'],
  },
  FaultDetected: {
    status: 'reactive',
    rationale: 'Production observation asserts equipment.availability = unavailable and reuses WorkOrder dependency blocking.',
    signals: ['equipment.availability = unavailable', 'equipment.fault = detected'],
    productionPolicyIds: productionEquipmentPolicies,
    candidateRelationshipEdges: ['targets', 'requires'],
    targetCapabilities: ['dependency.blocked'],
  },
  FaultCleared: {
    status: 'candidate',
    rationale: 'Fault clearing can retract availability pressure, but unblock/resume policy is not declared.',
    signals: ['equipment.availability = available', 'equipment.fault = cleared'],
    candidateRelationshipEdges: ['targets', 'requires'],
    targetCapabilities: ['dependency.released'],
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
    targetCapabilities: ['dependency.blocked'],
  },
  WorkOrderResumed: {
    status: 'candidate',
    rationale: 'A resumed upstream WorkOrder can release downstream pressure only after target-owned resume semantics exist.',
    signals: ['work_order.execution = resumed'],
    candidateRelationshipEdges: ['depends_on'],
    targetCapabilities: ['dependency.released'],
  },
  WorkOrderCompleted: {
    status: 'candidate',
    rationale: 'Completion can satisfy downstream depends_on prerequisites once dependency fulfillment semantics are declared.',
    signals: ['work_order.execution = completed'],
    candidateRelationshipEdges: ['depends_on'],
    targetCapabilities: ['dependency.satisfied'],
  },
  WorkOrderFailed: {
    status: 'candidate',
    rationale: 'Failure can block or fail downstream WorkOrders over depends_on once target reaction semantics exist.',
    signals: ['work_order.execution = failed'],
    candidateRelationshipEdges: ['depends_on'],
    targetCapabilities: ['dependency.blocked'],
  },
  WorkOrderCancelled: {
    status: 'candidate',
    rationale: 'Cancellation can block or replan downstream WorkOrders over depends_on once target reaction semantics exist.',
    signals: ['work_order.execution = cancelled'],
    candidateRelationshipEdges: ['depends_on'],
    targetCapabilities: ['dependency.blocked', 'dependency.replan_required'],
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
    targetCapabilities: ['dependency.blocked'],
  },
  TaskUnblocked: {
    status: 'candidate',
    rationale: 'Could release parent WorkOrder task pressure, but aggregate ownership must be defined.',
    signals: ['task.execution = unblocked'],
    targetCapabilities: ['dependency.released'],
  },
  TaskFailed: {
    status: 'candidate',
    rationale: 'Could fail/block parent WorkOrder if task-to-WorkOrder graph edges are promoted.',
    signals: ['task.execution = failed'],
    targetCapabilities: ['dependency.blocked'],
  },
  ApprovalRejected: {
    status: 'candidate',
    rationale: 'Can produce approval-hold/rejection pressure for a WorkOrder once approval target links are modeled.',
    signals: ['approval.state = rejected'],
    candidateRelationshipEdges: ['supervises', 'related_to'],
    targetCapabilities: ['approval.hold'],
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
    targetCapabilities: ['approval.hold'],
  },
  BatchDeviation: {
    status: 'candidate',
    rationale: 'Deviation can produce quality/safety hold pressure over produced/related assets once policy exists.',
    signals: ['batch.deviation = detected'],
    candidateRelationshipEdges: ['produces', 'related_to'],
    targetCapabilities: ['quality.hold'],
  },
  InspectionCompleted: {
    status: 'candidate',
    rationale: 'Failed inspection can trigger quality hold, but result-to-target relationship policy is not declared.',
    signals: ['quality.inspection = completed'],
    candidateRelationshipEdges: ['related_to', 'produces'],
    targetCapabilities: ['quality.hold'],
  },
  NCROpened: {
    status: 'candidate',
    rationale: 'Open non-conformance can hold related WorkOrders/batches once quality graph edges exist.',
    signals: ['quality.ncr = opened'],
    candidateRelationshipEdges: ['related_to', 'produces'],
    targetCapabilities: ['quality.hold'],
  },
  NCRClosed: {
    status: 'candidate',
    rationale: 'Closed NCR can release quality pressure only after target-owned release semantics exist.',
    signals: ['quality.ncr = closed'],
    candidateRelationshipEdges: ['related_to', 'produces'],
    targetCapabilities: ['quality.release'],
  },
  CAPACreated: {
    status: 'candidate',
    rationale: 'CAPA creation can relate quality remediation to affected WorkOrders/assets; mutation semantics are not declared.',
    signals: ['quality.capa = created'],
    candidateRelationshipEdges: ['related_to'],
    targetCapabilities: ['quality.hold'],
  },
  CAPAResolved: {
    status: 'candidate',
    rationale: 'CAPA resolution can release quality pressure once target-owned release semantics exist.',
    signals: ['quality.capa = resolved'],
    candidateRelationshipEdges: ['related_to'],
    targetCapabilities: ['quality.release'],
  },
}

const productionObservationByTag = new Map(
  ReactiveEquipmentStateObservationSpecs.map((spec) => [spec.eventTag, spec.id] as const),
)

export const getReactorEventCoverageEntries = (): readonly ReactorEventCoverageEntry[] => {
  const entries: ReactorEventCoverageEntry[] = []
  const eventGroupTags = getIiotEventGroupTags()

  for (const group of Object.keys(EVENT_GROUPS) as ReactorEventGroupName[]) {
    for (const tag of eventGroupTags[group]) {
      const seed = eventOverrides[tag] ?? groupDefaults[group]
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

const relationshipCoverageSeeds: Record<RelationshipEdgeTypeValue, RelationshipCoverageSeed> = {
  targets: {
    status: 'production',
    rationale: 'Production lane: machine availability observed on target routes dependency.blocked to source WorkOrder.',
    candidateSignals: ['equipment.availability', 'alarm.safety', 'quality.hold'],
    targetCapabilities: ['dependency.blocked', 'safety.hold'],
  },
  requires: {
    status: 'production',
    rationale: 'Production lane for required machine availability; external/device availability remain candidate expansions.',
    candidateSignals: ['equipment.availability', 'device.availability', 'external.availability'],
    targetCapabilities: ['dependency.blocked'],
  },
  caused_by: {
    status: 'candidate',
    rationale: 'Causal provenance is modeled, but automatic mutation from cause chains needs explicit target contracts.',
    candidateSignals: ['alarm.state', 'work_order.execution'],
    targetCapabilities: ['safety.hold', 'dependency.blocked'],
  },
  depends_on: {
    status: 'candidate',
    rationale: 'WorkOrder-to-WorkOrder dependency propagation is a high-value next lane, guarded by causality/idempotency.',
    candidateSignals: ['work_order.execution = suspended|failed|cancelled|completed|resumed'],
    targetCapabilities: ['dependency.blocked', 'dependency.satisfied', 'dependency.released'],
  },
  related_to: {
    status: 'reference',
    rationale: 'Broad association edge; intentionally non-reactive without a narrower policy.',
  },
  supervises: {
    status: 'candidate',
    rationale: 'Can route supervisor/approval escalation and external outage semantics once external actor availability exists.',
    candidateSignals: ['approval.state', 'external.availability'],
    targetCapabilities: ['approval.hold'],
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
    targetCapabilities: ['dependency.blocked', 'lifecycle.inherited'],
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
    targetCapabilities: ['safety.hold', 'safety.release'],
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
    relationshipCoverage: Array.from(relationshipCoverage),
    stats,
  })
}
