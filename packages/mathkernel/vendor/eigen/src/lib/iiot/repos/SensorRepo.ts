/**
 * SensorRepo - Repository for Sensor Entity
 *
 * Separated from SensorModel for clean architecture.
 * Model defines schema, Repo handles persistence.
 *
 * Uses decode utilities to ensure Schema transforms are applied
 * on raw SQL results.
 *
 * @module
 */

import { Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { DeviceId, MachineId } from '../schemas/identifiers'
import { SensorModel } from '../models/assets/SensorModel'
import { decodeOptional, decodeRows, decodeFirst } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type SensorRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

export interface SensorRepository {
  readonly findByDeviceId: (deviceId: DeviceId) => Effect.Effect<Option.Option<SensorModel>, SensorRepoError>
  readonly findByMachine: (machineId: MachineId) => Effect.Effect<readonly SensorModel[], SensorRepoError>
  readonly findAll: () => Effect.Effect<readonly SensorModel[], SensorRepoError>
  readonly insert: (sensor: typeof SensorModel.insert.Type) => Effect.Effect<SensorModel, SensorRepoError>
  readonly update: (sensor: typeof SensorModel.update.Type) => Effect.Effect<SensorModel, SensorRepoError>
  readonly delete: (deviceId: DeviceId) => Effect.Effect<void, SqlError.SqlError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class SensorRepo extends Context.Tag('iiot/SensorRepo')<
  SensorRepo,
  SensorRepository
>() {}

// =============================================================================
// Repository Implementation
// =============================================================================

export const SensorRepoLive = Layer.effect(
  SensorRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    // Column alias helper for SELECT statements
    const selectColumns = sql`
      device_id AS "deviceId",
      name,
      status,
      type,
      unit,
      hierarchy_path AS "hierarchyPath",
      enterprise_id AS "enterpriseId",
      site_id AS "siteId",
      area_id AS "areaId",
      plant_id AS "plantId",
      line_id AS "lineId",
      workcell_id AS "workcellId",
      machine_id AS "machineId",
      description,
      sample_rate_ms AS "sampleRateMs",
      threshold_high AS "thresholdHigh",
      threshold_critical AS "thresholdCritical",
      threshold_low AS "thresholdLow",
      opc_ua_node_id AS "opcUaNodeId",
      location,
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findByDeviceId = (deviceId: DeviceId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.sensors
          WHERE device_id = ${deviceId}
          LIMIT 1
        `
        return yield* decodeOptional(SensorModel)(rows)
      })

    const findByMachine = (machineId: MachineId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.sensors
          WHERE machine_id = ${machineId}
          ORDER BY device_id ASC
        `
        return yield* decodeRows(SensorModel)(rows)
      })

    const findAll = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.sensors
          ORDER BY device_id ASC
        `
        return yield* decodeRows(SensorModel)(rows)
      })

    const insert = (sensor: typeof SensorModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO iiot.sensors (
            device_id, name, status, type, unit, hierarchy_path,
            enterprise_id, site_id, area_id, plant_id, line_id, workcell_id, machine_id,
            description, sample_rate_ms, threshold_high, threshold_critical, threshold_low,
            opc_ua_node_id, location, metadata
          )
          VALUES (
            ${sensor.deviceId},
            ${sensor.name},
            ${sensor.status},
            ${sensor.type},
            ${sensor.unit},
            ${sensor.hierarchyPath},
            ${sensor.enterpriseId},
            ${sensor.siteId},
            ${Option.getOrNull(sensor.areaId)},
            ${sensor.plantId},
            ${sensor.lineId},
            ${Option.getOrNull(sensor.workcellId)},
            ${sensor.machineId},
            ${Option.getOrNull(sensor.description)},
            ${Option.getOrNull(sensor.sampleRateMs)},
            ${Option.getOrNull(sensor.thresholdHigh)},
            ${Option.getOrNull(sensor.thresholdCritical)},
            ${Option.getOrNull(sensor.thresholdLow)},
            ${Option.getOrNull(sensor.opcUaNodeId)},
            ${Option.match(sensor.location, { onNone: () => null, onSome: (v) => JSON.stringify(v) })},
            ${Option.match(sensor.metadata, { onNone: () => '{}', onSome: (v) => JSON.stringify(v) })}
          )
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(SensorModel)(rows)
      })

    const update = (sensor: typeof SensorModel.update.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          UPDATE iiot.sensors
          SET
            type = COALESCE(${sensor.type ?? null}, type),
            unit = COALESCE(${sensor.unit ?? null}, unit),
            updated_at = NOW()
          WHERE device_id = ${sensor.deviceId}
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(SensorModel)(rows)
      })

    const del = (deviceId: DeviceId) =>
      sql`DELETE FROM iiot.sensors WHERE device_id = ${deviceId}`.pipe(Effect.asVoid)

    return {
      findByDeviceId,
      findByMachine,
      findAll,
      insert,
      update,
      delete: del,
    } satisfies SensorRepository
  })
)
