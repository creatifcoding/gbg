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

    const findByDeviceId = (deviceId: DeviceId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            device_id AS "deviceId",
            type,
            unit,
            machine_id AS "machineId",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM iiot.sensors
          WHERE device_id = ${deviceId}
          LIMIT 1
        `
        return yield* decodeOptional(SensorModel)(rows)
      })

    const findByMachine = (machineId: MachineId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            device_id AS "deviceId",
            type,
            unit,
            machine_id AS "machineId",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM iiot.sensors
          WHERE machine_id = ${machineId}
          ORDER BY device_id ASC
        `
        return yield* decodeRows(SensorModel)(rows)
      })

    const findAll = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            device_id AS "deviceId",
            type,
            unit,
            machine_id AS "machineId",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM iiot.sensors
          ORDER BY device_id ASC
        `
        return yield* decodeRows(SensorModel)(rows)
      })

    const insert = (sensor: typeof SensorModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO iiot.sensors (device_id, type, unit, machine_id)
          VALUES (${sensor.deviceId}, ${sensor.type}, ${sensor.unit}, ${sensor.machineId})
          RETURNING
            device_id AS "deviceId",
            type,
            unit,
            machine_id AS "machineId",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
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
          RETURNING
            device_id AS "deviceId",
            type,
            unit,
            machine_id AS "machineId",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
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
