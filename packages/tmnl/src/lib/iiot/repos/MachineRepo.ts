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

    const findById = (id: MachineId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            name,
            model,
            line_id AS "lineId",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM iiot.machines
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(MachineModel)(rows)
      })

    const findByLine = (lineId: LineId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            name,
            model,
            line_id AS "lineId",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM iiot.machines
          WHERE line_id = ${lineId}
          ORDER BY name ASC
        `
        return yield* decodeRows(MachineModel)(rows)
      })

    const findAll = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            name,
            model,
            line_id AS "lineId",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM iiot.machines
          ORDER BY name ASC
        `
        return yield* decodeRows(MachineModel)(rows)
      })

    const insert = (machine: typeof MachineModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO iiot.machines (id, name, model, line_id)
          VALUES (${machine.id}, ${machine.name}, ${Option.getOrNull(machine.model)}, ${machine.lineId})
          RETURNING
            id,
            name,
            model,
            line_id AS "lineId",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
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
          RETURNING
            id,
            name,
            model,
            line_id AS "lineId",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
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
