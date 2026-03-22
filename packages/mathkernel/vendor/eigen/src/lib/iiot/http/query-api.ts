/**
 * IIoT Query HttpApiGroups
 *
 * Manual HttpApiGroup definitions for the 16 stateless query RPCs
 * that are NOT entity-derived (EntityProxyServer can't auto-generate these).
 *
 * Four groups:
 * - asset-queries: 8 asset hierarchy graph queries
 * - sensor-queries: 4 sensor time-series queries
 * - alarm-queries: 3 alarm query operations
 * - workorder-queries: 1 work order listing operation
 *
 * @module @gbg/tmnl/iiot/http/query-api
 */

import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform'
import { Schema } from 'effect'

import { DeviceId, PlantId, LineId, MachineId, AlarmId } from '../schemas/identifiers'
import { Plant, PlantHierarchy, Line, Machine, Sensor, SensorHierarchy, MachineWithSensors } from '../schemas/assets'
import { SensorReading, AggregatedReading } from '../schemas/readings'
import { Alarm, AlarmContext } from '../schemas/alarms'
import { WorkOrder, WorkOrderPriority, WorkOrderStatus } from '../schemas/work-orders'
import { AlarmStats } from '../rpc/AlarmRpcs'

// =============================================================================
// Asset Hierarchy Query Endpoints
// =============================================================================

const ListPlantsEndpoint = HttpApiEndpoint.get('listPlants', '/queries/plants')
  .addSuccess(Schema.Array(Plant))

const GetPlantEndpoint = HttpApiEndpoint.get('getPlant', '/queries/plants/:plantId')
  .setPath(Schema.Struct({ plantId: PlantId }))
  .addSuccess(Plant)

const GetPlantHierarchyEndpoint = HttpApiEndpoint.get('getPlantHierarchy', '/queries/plants/:plantId/hierarchy')
  .setPath(Schema.Struct({ plantId: PlantId }))
  .addSuccess(PlantHierarchy)

const ListLinesForPlantEndpoint = HttpApiEndpoint.get('listLinesForPlant', '/queries/plants/:plantId/lines')
  .setPath(Schema.Struct({ plantId: PlantId }))
  .addSuccess(Schema.Array(Line))

const ListMachinesForLineEndpoint = HttpApiEndpoint.get('listMachinesForLine', '/queries/lines/:lineId/machines')
  .setPath(Schema.Struct({ lineId: LineId }))
  .addSuccess(Schema.Array(Machine))

const ListSensorsForMachineEndpoint = HttpApiEndpoint.get('listSensorsForMachine', '/queries/machines/:machineId/sensors')
  .setPath(Schema.Struct({ machineId: MachineId }))
  .addSuccess(Schema.Array(Sensor))

const GetMachineWithSensorsEndpoint = HttpApiEndpoint.get('getMachineWithSensors', '/queries/machines/:machineId/with-sensors')
  .setPath(Schema.Struct({ machineId: MachineId }))
  .addSuccess(MachineWithSensors)

const GetSensorHierarchyEndpoint = HttpApiEndpoint.get('getSensorHierarchy', '/queries/sensors/:deviceId/hierarchy')
  .setPath(Schema.Struct({ deviceId: DeviceId }))
  .addSuccess(SensorHierarchy)

/**
 * Asset hierarchy query group
 *
 * 8 stateless graph queries for plant/line/machine/sensor hierarchy.
 * Prefixed with /api when added to IIoTApi.
 */
export const AssetQueryGroup = HttpApiGroup.make('asset-queries')
  .add(ListPlantsEndpoint)
  .add(GetPlantEndpoint)
  .add(GetPlantHierarchyEndpoint)
  .add(ListLinesForPlantEndpoint)
  .add(ListMachinesForLineEndpoint)
  .add(ListSensorsForMachineEndpoint)
  .add(GetMachineWithSensorsEndpoint)
  .add(GetSensorHierarchyEndpoint)

// =============================================================================
// Sensor Time-Series Query Endpoints
// =============================================================================

const GetLatestReadingEndpoint = HttpApiEndpoint.get('getLatestReading', '/queries/readings/:deviceId/latest')
  .setPath(Schema.Struct({ deviceId: DeviceId }))
  .addSuccess(Schema.NullOr(SensorReading))

const QueryReadingsEndpoint = HttpApiEndpoint.get('queryReadings', '/queries/readings/:deviceId')
  .setPath(Schema.Struct({ deviceId: DeviceId }))
  .setUrlParams(Schema.Struct({
    since: Schema.optional(Schema.String),
    until: Schema.optional(Schema.String),
    limit: Schema.optional(Schema.String),
  }))
  .addSuccess(Schema.Array(SensorReading))

const QueryAggregatedReadingsEndpoint = HttpApiEndpoint.get('queryAggregatedReadings', '/queries/readings/:deviceId/aggregated')
  .setPath(Schema.Struct({ deviceId: DeviceId }))
  .setUrlParams(Schema.Struct({
    bucket: Schema.String,
    since: Schema.optional(Schema.String),
    until: Schema.optional(Schema.String),
  }))
  .addSuccess(Schema.Array(AggregatedReading))

const SubscribeReadingsEndpoint = HttpApiEndpoint.get('subscribeReadings', '/queries/readings/:deviceId/subscribe')
  .setPath(Schema.Struct({ deviceId: DeviceId }))
  .setUrlParams(Schema.Struct({
    pollIntervalMs: Schema.optional(Schema.String),
  }))
  .addSuccess(Schema.Array(SensorReading))

/**
 * Sensor time-series query group
 *
 * 4 stateless queries for sensor readings and subscriptions.
 * Prefixed with /api when added to IIoTApi.
 */
export const SensorQueryGroup = HttpApiGroup.make('sensor-queries')
  .add(GetLatestReadingEndpoint)
  .add(QueryReadingsEndpoint)
  .add(QueryAggregatedReadingsEndpoint)
  .add(SubscribeReadingsEndpoint)

// =============================================================================
// Alarm Query Endpoints
// =============================================================================

const QueryAlarmsEndpoint = HttpApiEndpoint.get('queryAlarms', '/queries/alarms')
  .setUrlParams(Schema.Struct({
    deviceId: Schema.optional(Schema.String),
    severity: Schema.optional(Schema.String),
    state: Schema.optional(Schema.String),
    onlyActive: Schema.optional(Schema.String),
    since: Schema.optional(Schema.String),
    until: Schema.optional(Schema.String),
    limit: Schema.optional(Schema.String),
    offset: Schema.optional(Schema.String),
  }))
  .addSuccess(Schema.Array(Alarm))

const GetAlarmContextEndpoint = HttpApiEndpoint.get('getAlarmContext', '/queries/alarms/:alarmId/context')
  .setPath(Schema.Struct({ alarmId: AlarmId }))
  .setUrlParams(Schema.Struct({
    windowMs: Schema.optional(Schema.String),
  }))
  .addSuccess(Schema.Array(AlarmContext))

const GetAlarmStatsEndpoint = HttpApiEndpoint.get('getAlarmStats', '/queries/alarms/stats')
  .setUrlParams(Schema.Struct({
    deviceId: Schema.optional(Schema.String),
    since: Schema.optional(Schema.String),
  }))
  .addSuccess(AlarmStats)

/**
 * Alarm query group
 *
 * 3 stateless alarm query operations.
 * Prefixed with /api when added to IIoTApi.
 */
export const AlarmQueryGroup = HttpApiGroup.make('alarm-queries')
  .add(QueryAlarmsEndpoint)
  .add(GetAlarmContextEndpoint)
  .add(GetAlarmStatsEndpoint)

// =============================================================================
// WorkOrder Query Endpoints
// =============================================================================

const ListWorkOrdersEndpoint = HttpApiEndpoint.get('listWorkOrders', '/queries/workorders')
  .setUrlParams(Schema.Struct({
    status: Schema.optional(WorkOrderStatus),
    priority: Schema.optional(WorkOrderPriority),
    assignedTo: Schema.optional(Schema.String),
    primaryAssetId: Schema.optional(Schema.String),
    includeOverdue: Schema.optional(Schema.String),
    limit: Schema.optional(Schema.NumberFromString),
    offset: Schema.optional(Schema.NumberFromString),
  }))
  .addSuccess(Schema.Array(WorkOrder))

/**
 * Work order query group
 *
 * 1 stateless work-order list endpoint.
 * Prefixed with /api when added to IIoTApi.
 */
export const WorkOrderQueryGroup = HttpApiGroup.make('workorder-queries')
  .add(ListWorkOrdersEndpoint)
