/**
 * MachineRepo - Repository for Machine Entity
 *
 * Separated from MachineModel for clean architecture.
 * Model defines schema, Repo handles persistence.
 *
 * Uses decode utilities to ensure FieldOption transforms are applied
 * (null → Option.none()) on raw SQL results.
 *
 * @module
 */

import { Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { MachineId, LineId } from '../schemas/identifiers'
import { MachineModel } from '../models/assets/MachineModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type MachineRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

export interface MachineRepository {
  readonly findById: (id: MachineId) => Effect.Effect<Option.Option<MachineModel>, MachineRepoError>
  readonly findByLine: (lineId: LineId) => Effect.Effect<readonly MachineModel[], MachineRepoError>
  readonly findAll: () => Effect.Effect<readonly MachineModel[], MachineRepoError>
  readonly insert: (machine: typeof MachineModel.insert.Type) => Effect.Effect<MachineModel, MachineRepoError>
  readonly update: (machine: typeof MachineModel.update.Type) => Effect.Effect<MachineModel, MachineRepoError>
  readonly delete: (id: MachineId) => Effect.Effect<void, SqlError.SqlError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class MachineRepo extends Context.Tag('iiot/MachineRepo')<
  MachineRepo,
  MachineRepository
>() {}

// =============================================================================
// Repository Implementation
// =============================================================================

export const MachineRepoLive = Layer.effect(
  MachineRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    // Column alias helper for SELECT statements
    const selectColumns = sql`
      id,
      name,
      status,
      machine_type AS "machineType",
      hierarchy_path AS "hierarchyPath",
      enterprise_id AS "enterpriseId",
      site_id AS "siteId",
      area_id AS "areaId",
      plant_id AS "plantId",
      line_id AS "lineId",
      workcell_id AS "workcellId",
      description,
      manufacturer,
      model_number AS "modelNumber",
      serial_number AS "serialNumber",
      installation_date AS "installationDate",
      last_maintenance_date AS "lastMaintenanceDate",
      next_maintenance_date AS "nextMaintenanceDate",
      location,
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findById = (id: MachineId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.machines
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(MachineModel)(rows)
      })

    const findByLine = (lineId: LineId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.machines
          WHERE line_id = ${lineId}
          ORDER BY name ASC
        `
        return yield* decodeRows(MachineModel)(rows)
      })

    const findAll = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.machines
          ORDER BY name ASC
        `
        return yield* decodeRows(MachineModel)(rows)
      })

    const insert = (machine: typeof MachineModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO iiot.machines (
            id, name, status, machine_type, hierarchy_path,
            enterprise_id, site_id, area_id, plant_id, line_id, workcell_id,
            description, manufacturer, model_number, serial_number,
            installation_date, last_maintenance_date, next_maintenance_date,
            location, metadata
          )
          VALUES (
            ${machine.id},
            ${machine.name},
            ${machine.status},
            ${machine.machineType},
            ${machine.hierarchyPath},
            ${machine.enterpriseId},
            ${machine.siteId},
            ${Option.getOrNull(machine.areaId)},
            ${machine.plantId},
            ${machine.lineId},
            ${Option.getOrNull(machine.workcellId)},
            ${Option.getOrNull(machine.description)},
            ${Option.getOrNull(machine.manufacturer)},
            ${Option.getOrNull(machine.modelNumber)},
            ${Option.getOrNull(machine.serialNumber)},
            ${Option.getOrNull(machine.installationDate)},
            ${Option.getOrNull(machine.lastMaintenanceDate)},
            ${Option.getOrNull(machine.nextMaintenanceDate)},
            ${Option.match(machine.location, { onNone: () => null, onSome: (v) => JSON.stringify(v) })},
            ${Option.match(machine.metadata, { onNone: () => '{}', onSome: (v) => JSON.stringify(v) })}
          )
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(MachineModel)(rows)
      })

    const update = (machine: typeof MachineModel.update.Type) =>
      Effect.gen(function* () {
        // sql.update() handles partial updates:
        // - undefined fields → skipped (not in SET)
        // - Option.none() → NULL, Option.some(v) → v
        const changes = prepareUpdate(machine)

        const rows = yield* sql`
          UPDATE iiot.machines
          SET ${sql.update(changes, ['id'])}, updated_at = NOW()
          WHERE id = ${machine.id}
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(MachineModel)(rows)
      })

    const del = (id: MachineId) =>
      sql`DELETE FROM iiot.machines WHERE id = ${id}`.pipe(Effect.asVoid)

    return {
      findById,
      findByLine,
      findAll,
      insert,
      update,
      delete: del,
    } satisfies MachineRepository
  })
)
