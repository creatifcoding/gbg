/**
 * DeviceRepo - Repository for Device Entity
 *
 * ISA-95 Level 0 (Control Module / Write) - Parent: Machine (required).
 * Model defines schema, Repo handles persistence.
 *
 * Uses decode utilities to ensure FieldOption transforms are applied
 * (null → Option.none()) on raw SQL results.
 *
 * @module
 */

import { Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { DeviceId, MachineId } from '../schemas/identifiers'
import { DeviceModel } from '../models/assets/DeviceModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type DeviceRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

export interface DeviceRepository {
  readonly findById: (id: DeviceId) => Effect.Effect<Option.Option<DeviceModel>, DeviceRepoError>
  readonly findByMachine: (machineId: MachineId) => Effect.Effect<readonly DeviceModel[], DeviceRepoError>
  readonly findByType: (deviceType: string) => Effect.Effect<readonly DeviceModel[], DeviceRepoError>
  readonly findAll: () => Effect.Effect<readonly DeviceModel[], DeviceRepoError>
  readonly insert: (device: typeof DeviceModel.insert.Type) => Effect.Effect<DeviceModel, DeviceRepoError>
  readonly update: (device: typeof DeviceModel.update.Type) => Effect.Effect<DeviceModel, DeviceRepoError>
  readonly delete: (id: DeviceId) => Effect.Effect<void, SqlError.SqlError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class DeviceRepo extends Context.Tag('iiot/DeviceRepo')<
  DeviceRepo,
  DeviceRepository
>() {}

// =============================================================================
// Repository Implementation
// =============================================================================

export const DeviceRepoLive = Layer.effect(
  DeviceRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    // Column alias helper for SELECT statements
    const selectColumns = sql`
      id,
      name,
      status,
      hierarchy_path AS "hierarchyPath",
      enterprise_id AS "enterpriseId",
      site_id AS "siteId",
      area_id AS "areaId",
      plant_id AS "plantId",
      line_id AS "lineId",
      workcell_id AS "workcellId",
      machine_id AS "machineId",
      device_type AS "deviceType",
      description,
      control_mode AS "controlMode",
      rated_power AS "ratedPower",
      power_unit AS "powerUnit",
      opc_ua_node_id AS "opcUaNodeId",
      location,
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findById = (id: DeviceId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.devices
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(DeviceModel)(rows)
      })

    const findByMachine = (machineId: MachineId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.devices
          WHERE machine_id = ${machineId}
          ORDER BY name ASC
        `
        return yield* decodeRows(DeviceModel)(rows)
      })

    const findByType = (deviceType: string) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.devices
          WHERE device_type = ${deviceType}
          ORDER BY name ASC
        `
        return yield* decodeRows(DeviceModel)(rows)
      })

    const findAll = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.devices
          ORDER BY name ASC
        `
        return yield* decodeRows(DeviceModel)(rows)
      })

    const insert = (device: typeof DeviceModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO iiot.devices (
            id, name, status, hierarchy_path, enterprise_id,
            site_id, area_id, plant_id, line_id, workcell_id,
            machine_id, device_type, description, control_mode,
            rated_power, power_unit, opc_ua_node_id, location, metadata
          )
          VALUES (
            ${device.id},
            ${device.name},
            ${device.status},
            ${device.hierarchyPath},
            ${device.enterpriseId},
            ${device.siteId},
            ${Option.getOrNull(device.areaId)},
            ${device.plantId},
            ${device.lineId},
            ${Option.getOrNull(device.workcellId)},
            ${device.machineId},
            ${device.deviceType},
            ${Option.getOrNull(device.description)},
            ${Option.getOrNull(device.controlMode)},
            ${Option.getOrNull(device.ratedPower)},
            ${Option.getOrNull(device.powerUnit)},
            ${Option.getOrNull(device.opcUaNodeId)},
            ${Option.match(device.location, { onNone: () => null, onSome: (v) => JSON.stringify(v) })},
            ${Option.match(device.metadata, { onNone: () => '{}', onSome: (v) => JSON.stringify(v) })}
          )
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(DeviceModel)(rows)
      })

    const update = (device: typeof DeviceModel.update.Type) =>
      Effect.gen(function* () {
        const changes = prepareUpdate(device)

        const rows = yield* sql`
          UPDATE iiot.devices
          SET ${sql.update(changes, ['id'])}, updated_at = NOW()
          WHERE id = ${device.id}
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(DeviceModel)(rows)
      })

    const del = (id: DeviceId) =>
      sql`DELETE FROM iiot.devices WHERE id = ${id}`.pipe(Effect.asVoid)

    return {
      findById,
      findByMachine,
      findByType,
      findAll,
      insert,
      update,
      delete: del,
    } satisfies DeviceRepository
  })
)
