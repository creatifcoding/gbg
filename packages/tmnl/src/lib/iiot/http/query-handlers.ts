/**
 * IIoT Query Endpoint Handlers (Stubs)
 *
 * Stub handler implementations for the 16 stateless query RPCs.
 * These will be wired to actual SQL queries later.
 *
 * Uses HttpApiBuilder.group() to implement each query group.
 * All stubs return empty/null results that type-check against
 * the endpoint success schemas.
 *
 * @module @gbg/tmnl/iiot/http/query-handlers
 */

import { HttpApiBuilder } from '@effect/platform'
import { Effect, Layer } from 'effect'
import { IIoTApi } from './api'
import { WorkOrderState } from '../state'

import type { Plant, PlantHierarchy, Line, Machine, Sensor, SensorHierarchy, MachineWithSensors } from '../schemas/assets'
import type { SensorReading, AggregatedReading } from '../schemas/readings'
import type { Alarm, AlarmContext } from '../schemas/alarms'
import type { WorkOrder } from '../schemas/work-orders'
import type { AlarmStats } from '../rpc/AlarmRpcs'

// =============================================================================
// Asset Query Handlers (Stubs)
// =============================================================================

const AssetQueryHandlersLive = HttpApiBuilder.group(
  IIoTApi,
  'asset-queries',
  (handlers) =>
    handlers
      .handle('listPlants', () =>
        Effect.succeed([] as readonly Plant[]))
      .handle('getPlant', () =>
        Effect.die('Not implemented: getPlant'))
      .handle('getPlantHierarchy', () =>
        Effect.die('Not implemented: getPlantHierarchy'))
      .handle('listLinesForPlant', () =>
        Effect.succeed([] as readonly Line[]))
      .handle('listMachinesForLine', () =>
        Effect.succeed([] as readonly Machine[]))
      .handle('listSensorsForMachine', () =>
        Effect.succeed([] as readonly Sensor[]))
      .handle('getMachineWithSensors', () =>
        Effect.die('Not implemented: getMachineWithSensors'))
      .handle('getSensorHierarchy', () =>
        Effect.die('Not implemented: getSensorHierarchy'))
)

// =============================================================================
// Sensor Query Handlers (Stubs)
// =============================================================================

const SensorQueryHandlersLive = HttpApiBuilder.group(
  IIoTApi,
  'sensor-queries',
  (handlers) =>
    handlers
      .handle('getLatestReading', () =>
        Effect.succeed(null))
      .handle('queryReadings', () =>
        Effect.succeed([] as readonly SensorReading[]))
      .handle('queryAggregatedReadings', () =>
        Effect.succeed([] as readonly AggregatedReading[]))
      .handle('subscribeReadings', () =>
        Effect.succeed([] as readonly SensorReading[]))
)

// =============================================================================
// Alarm Query Handlers (Stubs)
// =============================================================================

const AlarmQueryHandlersLive = HttpApiBuilder.group(
  IIoTApi,
  'alarm-queries',
  (handlers) =>
    handlers
      .handle('queryAlarms', () =>
        Effect.succeed([] as readonly Alarm[]))
      .handle('getAlarmContext', () =>
        Effect.succeed([] as readonly AlarmContext[]))
      .handle('getAlarmStats', () =>
        Effect.die('Not implemented: getAlarmStats'))
)

// =============================================================================
// WorkOrder Query Handlers (Stub)
// =============================================================================

const WorkOrderQueryHandlersLive = HttpApiBuilder.group(
  IIoTApi,
  'workorder-queries',
  (handlers) =>
    handlers
      .handle('listWorkOrders', ({ urlParams }) =>
        Effect.gen(function* () {
          const workOrders = yield* WorkOrderState

          const includeOverdue = urlParams.includeOverdue === undefined
            ? undefined
            : /^(1|true|yes)$/i.test(urlParams.includeOverdue)

          return yield* workOrders.list({
            status: urlParams.status ? [urlParams.status] : undefined,
            priority: urlParams.priority ? [urlParams.priority] : undefined,
            assignedTo: urlParams.assignedTo,
            primaryAssetId: urlParams.primaryAssetId,
            includeOverdue,
            limit: urlParams.limit,
            offset: urlParams.offset,
          })
        }).pipe(
          Effect.catchAll(() => Effect.succeed([] as readonly WorkOrder[]))
        )
      )
)

// =============================================================================
// Combined Query Handlers
// =============================================================================

/**
 * Combined query handler layer for all stateless query endpoints.
 *
 * Provides handler implementations for:
 * - asset-queries (8 endpoints)
 * - sensor-queries (4 endpoints)
 * - alarm-queries (3 endpoints)
 * - workorder-queries (1 endpoint)
 */
export const QueryHandlers = Layer.mergeAll(
  AssetQueryHandlersLive,
  SensorQueryHandlersLive,
  AlarmQueryHandlersLive,
  WorkOrderQueryHandlersLive,
)
