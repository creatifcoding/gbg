/**
 * Structural Event Handlers — graph projections for durable structural facts.
 *
 * StructuralEvents remain the primitive facts. These handlers materialize the
 * ISA-95 graph projection only: structural nodes plus contains/monitors edges
 * and their audit trail via GraphClient. Reactor consumes the topology later;
 * this layer does not dispatch target mutations.
 */

import { Cause, Effect, Option } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { StructuralEvents } from '../schemas/events/groups'
import {
  RelationshipEdgeMetadata,
  type RelationshipEdgeType,
  type RelationshipNodeType,
} from '../schemas/relationships'
import { GraphClient } from '../services/l1/GraphClient'

interface RelationshipEndpointInput {
  readonly type: RelationshipNodeType
  readonly id: string
}

export interface StructuralGraphProjectionPort {
  readonly upsertRelationshipNode: (
    endpoint: RelationshipEndpointInput,
    properties?: Record<string, string | number | boolean | null | undefined>,
  ) => Effect.Effect<void, unknown>
  readonly upsertRelationshipEdge: (input: {
    readonly source: RelationshipEndpointInput
    readonly target: RelationshipEndpointInput
    readonly edgeType: RelationshipEdgeType
    readonly metadata: RelationshipEdgeMetadata
  }) => Effect.Effect<void, unknown>
  readonly softDeleteRelationshipEdge: (input: {
    readonly source: RelationshipEndpointInput
    readonly target: RelationshipEndpointInput
    readonly edgeType: RelationshipEdgeType
    readonly reason?: string
  }) => Effect.Effect<void, unknown>
}

interface StructuralPayloadBase {
  readonly eventId: string
  readonly causedBy: string
}

interface EnterprisePayload extends StructuralPayloadBase { readonly enterpriseId: string; readonly name?: string }
interface SitePayload extends StructuralPayloadBase { readonly siteId: string; readonly enterpriseId: string; readonly name?: string }
interface AreaPayload extends StructuralPayloadBase { readonly areaId: string; readonly siteId: string; readonly name?: string }
interface PlantCreatedPayload extends StructuralPayloadBase { readonly plantId: string; readonly name?: string; readonly siteId: Option.Option<string>; readonly areaId: Option.Option<string> }
interface PlantUpdatedPayload extends StructuralPayloadBase { readonly plantId: string; readonly name: Option.Option<string> }
interface PlantRelocatedPayload extends StructuralPayloadBase { readonly plantId: string; readonly previousSiteId: Option.Option<string>; readonly previousAreaId: Option.Option<string>; readonly newSiteId: Option.Option<string>; readonly newAreaId: Option.Option<string>; readonly reason: string }
interface PlantDecommissionedPayload extends StructuralPayloadBase { readonly plantId: string; readonly reason: string }
interface LinePayload extends StructuralPayloadBase { readonly lineId: string; readonly plantId: string; readonly name?: string }
interface LineRelocatedPayload extends StructuralPayloadBase { readonly lineId: string; readonly previousPlantId: string; readonly newPlantId: string; readonly reason: string }
interface WorkCellPayload extends StructuralPayloadBase { readonly workCellId: string; readonly lineId: string; readonly name?: string }
interface MachineCreatedPayload extends StructuralPayloadBase { readonly machineId: string; readonly lineId: string; readonly workCellId: Option.Option<string>; readonly name?: string }
interface MachineUpdatedPayload extends StructuralPayloadBase { readonly machineId: string; readonly lineId: string; readonly name: Option.Option<string> }
interface MachineRelocatedPayload extends StructuralPayloadBase { readonly machineId: string; readonly previousLineId: string; readonly previousWorkCellId: Option.Option<string>; readonly newLineId: string; readonly newWorkCellId: Option.Option<string>; readonly reason: string }
interface MachineDecommissionedPayload extends StructuralPayloadBase { readonly machineId: string; readonly lineId: string; readonly reason: string }
interface SensorPayload extends StructuralPayloadBase { readonly sensorId: string; readonly machineId: string; readonly name?: string }
interface DevicePayload extends StructuralPayloadBase { readonly deviceId: string; readonly machineId: string; readonly name?: string }

const endpoint = (type: RelationshipNodeType, id: string): RelationshipEndpointInput => ({ type, id })
const reasonOption = (reason: Option.Option<string>): string | undefined => Option.getOrUndefined(reason)

const parentFromOption = (
  primary: { readonly type: RelationshipNodeType; readonly id: Option.Option<string> },
  fallback: { readonly type: RelationshipNodeType; readonly id: Option.Option<string> },
): RelationshipEndpointInput | undefined => {
  if (Option.isSome(primary.id)) return endpoint(primary.type, primary.id.value)
  if (Option.isSome(fallback.id)) return endpoint(fallback.type, fallback.id.value)
  return undefined
}

const machineParent = (input: {
  readonly lineId: string
  readonly workCellId: Option.Option<string>
}): RelationshipEndpointInput => Option.isSome(input.workCellId)
  ? endpoint('workcell', input.workCellId.value)
  : endpoint('line', input.lineId)

const metadata = (
  eventTag: string,
  payload: StructuralPayloadBase,
  reason: string,
  extra: Record<string, unknown> = {},
): RelationshipEdgeMetadata => new RelationshipEdgeMetadata({
  createdBy: payload.causedBy,
  reason,
  context: {
    eventTag,
    eventId: payload.eventId,
    ...extra,
  },
})

const nodeProps = (
  eventTag: string,
  payload: StructuralPayloadBase,
  properties: Record<string, string | number | boolean | null | undefined> = {},
): Record<string, string | number | boolean | null | undefined> => ({
  projected_from: 'StructuralEvents',
  projected_event_tag: eventTag,
  ...properties,
})

const upsertNode = (
  graph: StructuralGraphProjectionPort,
  eventTag: string,
  payload: StructuralPayloadBase,
  target: RelationshipEndpointInput,
  properties: Record<string, string | number | boolean | null | undefined> = {},
) => graph.upsertRelationshipNode(target, nodeProps(eventTag, payload, properties))

const upsertContains = (
  graph: StructuralGraphProjectionPort,
  payload: StructuralPayloadBase,
  source: RelationshipEndpointInput | undefined,
  target: RelationshipEndpointInput,
  eventTag: string,
  reason: string,
): Effect.Effect<void, unknown> => source
  ? graph.upsertRelationshipEdge({
    source,
    target,
    edgeType: 'contains',
    metadata: metadata(eventTag, payload, reason),
  })
  : Effect.void

const softDeleteContains = (
  graph: StructuralGraphProjectionPort,
  source: RelationshipEndpointInput | undefined,
  target: RelationshipEndpointInput,
  reason: string,
): Effect.Effect<void, unknown> => source
  ? graph.softDeleteRelationshipEdge({ source, target, edgeType: 'contains', reason })
  : Effect.void

export const makeStructuralGraphProjector = (graph: StructuralGraphProjectionPort) => ({
  projectEnterpriseCreated: (payload: EnterprisePayload) =>
    upsertNode(graph, 'EnterpriseCreated', payload, endpoint('enterprise', payload.enterpriseId), { name: payload.name }),
  projectEnterpriseUpdated: (payload: EnterprisePayload & { readonly name: Option.Option<string> }) =>
    upsertNode(graph, 'EnterpriseUpdated', payload, endpoint('enterprise', payload.enterpriseId), { name: reasonOption(payload.name) }),
  projectEnterpriseDecommissioned: (payload: EnterprisePayload & { readonly reason: string }) =>
    upsertNode(graph, 'EnterpriseDecommissioned', payload, endpoint('enterprise', payload.enterpriseId), {
      lifecycle_status: 'decommissioned',
      decommission_reason: payload.reason,
    }),

  projectSiteCreated: (payload: SitePayload) => Effect.gen(function* () {
    const site = endpoint('site', payload.siteId)
    yield* upsertNode(graph, 'SiteCreated', payload, site, { name: payload.name })
    yield* upsertContains(graph, payload, endpoint('enterprise', payload.enterpriseId), site, 'SiteCreated', 'site_created')
  }),
  projectSiteUpdated: (payload: SitePayload & { readonly name: Option.Option<string> }) =>
    upsertNode(graph, 'SiteUpdated', payload, endpoint('site', payload.siteId), { name: reasonOption(payload.name) }),
  projectSiteDecommissioned: (payload: SitePayload & { readonly reason: string }) => Effect.gen(function* () {
    const site = endpoint('site', payload.siteId)
    yield* upsertNode(graph, 'SiteDecommissioned', payload, site, {
      lifecycle_status: 'decommissioned',
      decommission_reason: payload.reason,
    })
    yield* softDeleteContains(graph, endpoint('enterprise', payload.enterpriseId), site, payload.reason)
  }),

  projectAreaCreated: (payload: AreaPayload) => Effect.gen(function* () {
    const area = endpoint('area', payload.areaId)
    yield* upsertNode(graph, 'AreaCreated', payload, area, { name: payload.name })
    yield* upsertContains(graph, payload, endpoint('site', payload.siteId), area, 'AreaCreated', 'area_created')
  }),
  projectAreaUpdated: (payload: AreaPayload & { readonly name: Option.Option<string> }) =>
    upsertNode(graph, 'AreaUpdated', payload, endpoint('area', payload.areaId), { name: reasonOption(payload.name) }),
  projectAreaDecommissioned: (payload: AreaPayload & { readonly reason: string }) => Effect.gen(function* () {
    const area = endpoint('area', payload.areaId)
    yield* upsertNode(graph, 'AreaDecommissioned', payload, area, {
      lifecycle_status: 'decommissioned',
      decommission_reason: payload.reason,
    })
    yield* softDeleteContains(graph, endpoint('site', payload.siteId), area, payload.reason)
  }),

  projectPlantCreated: (payload: PlantCreatedPayload) => Effect.gen(function* () {
    const plant = endpoint('plant', payload.plantId)
    yield* upsertNode(graph, 'PlantCreated', payload, plant, { name: payload.name })
    yield* upsertContains(
      graph,
      payload,
      parentFromOption({ type: 'area', id: payload.areaId }, { type: 'site', id: payload.siteId }),
      plant,
      'PlantCreated',
      'plant_created',
    )
  }),
  projectPlantUpdated: (payload: PlantUpdatedPayload) =>
    upsertNode(graph, 'PlantUpdated', payload, endpoint('plant', payload.plantId), { name: reasonOption(payload.name) }),
  projectPlantRelocated: (payload: PlantRelocatedPayload) => Effect.gen(function* () {
    const plant = endpoint('plant', payload.plantId)
    yield* softDeleteContains(
      graph,
      parentFromOption({ type: 'area', id: payload.previousAreaId }, { type: 'site', id: payload.previousSiteId }),
      plant,
      payload.reason,
    )
    yield* upsertContains(
      graph,
      payload,
      parentFromOption({ type: 'area', id: payload.newAreaId }, { type: 'site', id: payload.newSiteId }),
      plant,
      'PlantRelocated',
      payload.reason,
    )
  }),
  projectPlantDecommissioned: (payload: PlantDecommissionedPayload) =>
    upsertNode(graph, 'PlantDecommissioned', payload, endpoint('plant', payload.plantId), {
      lifecycle_status: 'decommissioned',
      decommission_reason: payload.reason,
    }),

  projectLineCreated: (payload: LinePayload) => Effect.gen(function* () {
    const line = endpoint('line', payload.lineId)
    yield* upsertNode(graph, 'LineCreated', payload, line, { name: payload.name })
    yield* upsertContains(graph, payload, endpoint('plant', payload.plantId), line, 'LineCreated', 'line_created')
  }),
  projectLineUpdated: (payload: LinePayload & { readonly name: Option.Option<string> }) =>
    upsertNode(graph, 'LineUpdated', payload, endpoint('line', payload.lineId), { name: reasonOption(payload.name) }),
  projectLineConfigChanged: (payload: LinePayload & { readonly configKey: string; readonly reason: string }) =>
    upsertNode(graph, 'LineConfigChanged', payload, endpoint('line', payload.lineId), {
      last_config_key: payload.configKey,
      last_config_reason: payload.reason,
    }),
  projectLineRelocated: (payload: LineRelocatedPayload) => Effect.gen(function* () {
    const line = endpoint('line', payload.lineId)
    yield* softDeleteContains(graph, endpoint('plant', payload.previousPlantId), line, payload.reason)
    yield* upsertContains(graph, payload, endpoint('plant', payload.newPlantId), line, 'LineRelocated', payload.reason)
  }),
  projectLineDecommissioned: (payload: LinePayload & { readonly reason: string }) => Effect.gen(function* () {
    const line = endpoint('line', payload.lineId)
    yield* upsertNode(graph, 'LineDecommissioned', payload, line, {
      lifecycle_status: 'decommissioned',
      decommission_reason: payload.reason,
    })
    yield* softDeleteContains(graph, endpoint('plant', payload.plantId), line, payload.reason)
  }),

  projectWorkCellCreated: (payload: WorkCellPayload) => Effect.gen(function* () {
    const workcell = endpoint('workcell', payload.workCellId)
    yield* upsertNode(graph, 'WorkCellCreated', payload, workcell, { name: payload.name })
    yield* upsertContains(graph, payload, endpoint('line', payload.lineId), workcell, 'WorkCellCreated', 'workcell_created')
  }),
  projectWorkCellUpdated: (payload: WorkCellPayload & { readonly name: Option.Option<string> }) =>
    upsertNode(graph, 'WorkCellUpdated', payload, endpoint('workcell', payload.workCellId), { name: reasonOption(payload.name) }),
  projectWorkCellDecommissioned: (payload: WorkCellPayload & { readonly reason: string }) => Effect.gen(function* () {
    const workcell = endpoint('workcell', payload.workCellId)
    yield* upsertNode(graph, 'WorkCellDecommissioned', payload, workcell, {
      lifecycle_status: 'decommissioned',
      decommission_reason: payload.reason,
    })
    yield* softDeleteContains(graph, endpoint('line', payload.lineId), workcell, payload.reason)
  }),

  projectMachineCreated: (payload: MachineCreatedPayload) => Effect.gen(function* () {
    const machine = endpoint('machine', payload.machineId)
    yield* upsertNode(graph, 'MachineCreated', payload, machine, { name: payload.name })
    yield* upsertContains(graph, payload, machineParent(payload), machine, 'MachineCreated', 'machine_created')
  }),
  projectMachineUpdated: (payload: MachineUpdatedPayload) =>
    upsertNode(graph, 'MachineUpdated', payload, endpoint('machine', payload.machineId), { name: reasonOption(payload.name) }),
  projectMachineConfigChanged: (payload: MachineUpdatedPayload & { readonly configKey: string; readonly reason: string }) =>
    upsertNode(graph, 'MachineConfigChanged', payload, endpoint('machine', payload.machineId), {
      last_config_key: payload.configKey,
      last_config_reason: payload.reason,
    }),
  projectMachineRelocated: (payload: MachineRelocatedPayload) => Effect.gen(function* () {
    const machine = endpoint('machine', payload.machineId)
    yield* softDeleteContains(graph, machineParent({ lineId: payload.previousLineId, workCellId: payload.previousWorkCellId }), machine, payload.reason)
    yield* upsertContains(graph, payload, machineParent({ lineId: payload.newLineId, workCellId: payload.newWorkCellId }), machine, 'MachineRelocated', payload.reason)
  }),
  projectMachineDecommissioned: (payload: MachineDecommissionedPayload) => Effect.gen(function* () {
    const machine = endpoint('machine', payload.machineId)
    yield* upsertNode(graph, 'MachineDecommissioned', payload, machine, {
      lifecycle_status: 'decommissioned',
      decommission_reason: payload.reason,
    })
    yield* softDeleteContains(graph, endpoint('line', payload.lineId), machine, payload.reason)
  }),

  projectSensorCreated: (payload: SensorPayload) => Effect.gen(function* () {
    const sensor = endpoint('sensor', payload.sensorId)
    yield* upsertNode(graph, 'SensorCreated', payload, sensor, { name: payload.name })
    yield* graph.upsertRelationshipEdge({
      source: sensor,
      target: endpoint('machine', payload.machineId),
      edgeType: 'monitors',
      metadata: metadata('SensorCreated', payload, 'sensor_created'),
    })
  }),
  projectSensorUpdated: (payload: SensorPayload & { readonly name: Option.Option<string> }) =>
    upsertNode(graph, 'SensorUpdated', payload, endpoint('sensor', payload.sensorId), { name: reasonOption(payload.name) }),
  projectSensorCalibrated: (payload: SensorPayload & { readonly calibratedBy: string }) =>
    upsertNode(graph, 'SensorCalibrated', payload, endpoint('sensor', payload.sensorId), { last_calibrated_by: payload.calibratedBy }),
  projectSensorThresholdChanged: (payload: SensorPayload & { readonly reason: string }) =>
    upsertNode(graph, 'SensorThresholdChanged', payload, endpoint('sensor', payload.sensorId), { threshold_change_reason: payload.reason }),
  projectSensorDecommissioned: (payload: SensorPayload & { readonly reason: string }) => Effect.gen(function* () {
    const sensor = endpoint('sensor', payload.sensorId)
    yield* upsertNode(graph, 'SensorDecommissioned', payload, sensor, {
      lifecycle_status: 'decommissioned',
      decommission_reason: payload.reason,
    })
    yield* graph.softDeleteRelationshipEdge({
      source: sensor,
      target: endpoint('machine', payload.machineId),
      edgeType: 'monitors',
      reason: payload.reason,
    })
  }),

  projectDeviceCreated: (payload: DevicePayload) =>
    upsertNode(graph, 'DeviceCreated', payload, endpoint('device', payload.deviceId), { name: payload.name, parent_machine_id: payload.machineId }),
  projectDeviceUpdated: (payload: DevicePayload & { readonly name: Option.Option<string> }) =>
    upsertNode(graph, 'DeviceUpdated', payload, endpoint('device', payload.deviceId), { name: reasonOption(payload.name), parent_machine_id: payload.machineId }),
  projectDeviceDecommissioned: (payload: DevicePayload & { readonly reason: string }) =>
    upsertNode(graph, 'DeviceDecommissioned', payload, endpoint('device', payload.deviceId), {
      lifecycle_status: 'decommissioned',
      decommission_reason: payload.reason,
      parent_machine_id: payload.machineId,
    }),
})

export type StructuralGraphProjector = ReturnType<typeof makeStructuralGraphProjector>

const catchHandlerError = <A, E, R>(handlerName: string, effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.catchAllCause((cause) =>
      Effect.log(`[StructuralEventHandler] ${handlerName} failed: ${Cause.pretty(cause)}`)
    ),
    Effect.asVoid,
  )

const projectWithGraph = (
  label: string,
  f: (projector: StructuralGraphProjector) => Effect.Effect<void, unknown>,
) => catchHandlerError(
  `${label}.projectGraph`,
  Effect.gen(function* () {
    const graph = yield* Effect.serviceOption(GraphClient)
    if (Option.isNone(graph)) return
    yield* f(makeStructuralGraphProjector(graph.value))
  }),
)

export const StructuralEventHandlers = EventLog.group(StructuralEvents, (handlers) =>
  handlers
    .handle('EnterpriseCreated', ({ payload }) => projectWithGraph('EnterpriseCreated', (p) => p.projectEnterpriseCreated(payload)))
    .handle('EnterpriseUpdated', ({ payload }) => projectWithGraph('EnterpriseUpdated', (p) => p.projectEnterpriseUpdated(payload)))
    .handle('EnterpriseDecommissioned', ({ payload }) => projectWithGraph('EnterpriseDecommissioned', (p) => p.projectEnterpriseDecommissioned(payload)))
    .handle('SiteCreated', ({ payload }) => projectWithGraph('SiteCreated', (p) => p.projectSiteCreated(payload)))
    .handle('SiteUpdated', ({ payload }) => projectWithGraph('SiteUpdated', (p) => p.projectSiteUpdated(payload)))
    .handle('SiteDecommissioned', ({ payload }) => projectWithGraph('SiteDecommissioned', (p) => p.projectSiteDecommissioned(payload)))
    .handle('AreaCreated', ({ payload }) => projectWithGraph('AreaCreated', (p) => p.projectAreaCreated(payload)))
    .handle('AreaUpdated', ({ payload }) => projectWithGraph('AreaUpdated', (p) => p.projectAreaUpdated(payload)))
    .handle('AreaDecommissioned', ({ payload }) => projectWithGraph('AreaDecommissioned', (p) => p.projectAreaDecommissioned(payload)))
    .handle('PlantCreated', ({ payload }) => projectWithGraph('PlantCreated', (p) => p.projectPlantCreated(payload)))
    .handle('PlantUpdated', ({ payload }) => projectWithGraph('PlantUpdated', (p) => p.projectPlantUpdated(payload)))
    .handle('PlantRelocated', ({ payload }) => projectWithGraph('PlantRelocated', (p) => p.projectPlantRelocated(payload)))
    .handle('PlantDecommissioned', ({ payload }) => projectWithGraph('PlantDecommissioned', (p) => p.projectPlantDecommissioned(payload)))
    .handle('LineCreated', ({ payload }) => projectWithGraph('LineCreated', (p) => p.projectLineCreated(payload)))
    .handle('LineUpdated', ({ payload }) => projectWithGraph('LineUpdated', (p) => p.projectLineUpdated(payload)))
    .handle('LineConfigChanged', ({ payload }) => projectWithGraph('LineConfigChanged', (p) => p.projectLineConfigChanged(payload)))
    .handle('LineRelocated', ({ payload }) => projectWithGraph('LineRelocated', (p) => p.projectLineRelocated(payload)))
    .handle('LineDecommissioned', ({ payload }) => projectWithGraph('LineDecommissioned', (p) => p.projectLineDecommissioned(payload)))
    .handle('WorkCellCreated', ({ payload }) => projectWithGraph('WorkCellCreated', (p) => p.projectWorkCellCreated(payload)))
    .handle('WorkCellUpdated', ({ payload }) => projectWithGraph('WorkCellUpdated', (p) => p.projectWorkCellUpdated(payload)))
    .handle('WorkCellDecommissioned', ({ payload }) => projectWithGraph('WorkCellDecommissioned', (p) => p.projectWorkCellDecommissioned(payload)))
    .handle('MachineCreated', ({ payload }) => projectWithGraph('MachineCreated', (p) => p.projectMachineCreated(payload)))
    .handle('MachineUpdated', ({ payload }) => projectWithGraph('MachineUpdated', (p) => p.projectMachineUpdated(payload)))
    .handle('MachineConfigChanged', ({ payload }) => projectWithGraph('MachineConfigChanged', (p) => p.projectMachineConfigChanged(payload)))
    .handle('MachineRelocated', ({ payload }) => projectWithGraph('MachineRelocated', (p) => p.projectMachineRelocated(payload)))
    .handle('MachineDecommissioned', ({ payload }) => projectWithGraph('MachineDecommissioned', (p) => p.projectMachineDecommissioned(payload)))
    .handle('SensorCreated', ({ payload }) => projectWithGraph('SensorCreated', (p) => p.projectSensorCreated(payload)))
    .handle('SensorUpdated', ({ payload }) => projectWithGraph('SensorUpdated', (p) => p.projectSensorUpdated(payload)))
    .handle('SensorCalibrated', ({ payload }) => projectWithGraph('SensorCalibrated', (p) => p.projectSensorCalibrated(payload)))
    .handle('SensorThresholdChanged', ({ payload }) => projectWithGraph('SensorThresholdChanged', (p) => p.projectSensorThresholdChanged(payload)))
    .handle('SensorDecommissioned', ({ payload }) => projectWithGraph('SensorDecommissioned', (p) => p.projectSensorDecommissioned(payload)))
    .handle('DeviceCreated', ({ payload }) => projectWithGraph('DeviceCreated', (p) => p.projectDeviceCreated(payload)))
    .handle('DeviceUpdated', ({ payload }) => projectWithGraph('DeviceUpdated', (p) => p.projectDeviceUpdated(payload)))
    .handle('DeviceDecommissioned', ({ payload }) => projectWithGraph('DeviceDecommissioned', (p) => p.projectDeviceDecommissioned(payload)))
)
