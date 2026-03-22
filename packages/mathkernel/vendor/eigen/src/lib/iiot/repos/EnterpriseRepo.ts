/**
 * EnterpriseRepo - Repository for Enterprise Entity
 *
 * ISA-95 Level 4 (Business Planning) - Root entity, no parent.
 * Model defines schema, Repo handles persistence.
 *
 * Uses decode utilities to ensure FieldOption transforms are applied
 * (null → Option.none()) on raw SQL results.
 *
 * @module
 */

import { Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { EnterpriseId } from '../schemas/identifiers'
import { EnterpriseModel } from '../models/assets/EnterpriseModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type EnterpriseRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

export interface EnterpriseRepository {
  readonly findById: (id: EnterpriseId) => Effect.Effect<Option.Option<EnterpriseModel>, EnterpriseRepoError>
  readonly findByName: (name: string) => Effect.Effect<Option.Option<EnterpriseModel>, EnterpriseRepoError>
  readonly findAll: () => Effect.Effect<readonly EnterpriseModel[], EnterpriseRepoError>
  readonly insert: (enterprise: typeof EnterpriseModel.insert.Type) => Effect.Effect<EnterpriseModel, EnterpriseRepoError>
  readonly update: (enterprise: typeof EnterpriseModel.update.Type) => Effect.Effect<EnterpriseModel, EnterpriseRepoError>
  readonly delete: (id: EnterpriseId) => Effect.Effect<void, SqlError.SqlError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class EnterpriseRepo extends Context.Tag('iiot/EnterpriseRepo')<
  EnterpriseRepo,
  EnterpriseRepository
>() {}

// =============================================================================
// Repository Implementation
// =============================================================================

export const EnterpriseRepoLive = Layer.effect(
  EnterpriseRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    // Column alias helper for SELECT statements
    const selectColumns = sql`
      id,
      name,
      status,
      hierarchy_path AS "hierarchyPath",
      description,
      industry,
      legal_name AS "legalName",
      tax_id AS "taxId",
      headquarters,
      location,
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findById = (id: EnterpriseId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.enterprises
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(EnterpriseModel)(rows)
      })

    const findByName = (name: string) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.enterprises
          WHERE name = ${name}
          LIMIT 1
        `
        return yield* decodeOptional(EnterpriseModel)(rows)
      })

    const findAll = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.enterprises
          ORDER BY name ASC
        `
        return yield* decodeRows(EnterpriseModel)(rows)
      })

    const insert = (enterprise: typeof EnterpriseModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO iiot.enterprises (
            id, name, status, hierarchy_path, description,
            industry, legal_name, tax_id, headquarters,
            location, metadata
          )
          VALUES (
            ${enterprise.id},
            ${enterprise.name},
            ${enterprise.status},
            ${enterprise.hierarchyPath},
            ${Option.getOrNull(enterprise.description)},
            ${Option.getOrNull(enterprise.industry)},
            ${Option.getOrNull(enterprise.legalName)},
            ${Option.getOrNull(enterprise.taxId)},
            ${Option.getOrNull(enterprise.headquarters)},
            ${Option.match(enterprise.location, { onNone: () => null, onSome: (v) => JSON.stringify(v) })},
            ${Option.match(enterprise.metadata, { onNone: () => '{}', onSome: (v) => JSON.stringify(v) })}
          )
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(EnterpriseModel)(rows)
      })

    const update = (enterprise: typeof EnterpriseModel.update.Type) =>
      Effect.gen(function* () {
        const changes = prepareUpdate(enterprise)

        const rows = yield* sql`
          UPDATE iiot.enterprises
          SET ${sql.update(changes, ['id'])}, updated_at = NOW()
          WHERE id = ${enterprise.id}
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(EnterpriseModel)(rows)
      })

    const del = (id: EnterpriseId) =>
      sql`DELETE FROM iiot.enterprises WHERE id = ${id}`.pipe(Effect.asVoid)

    return {
      findById,
      findByName,
      findAll,
      insert,
      update,
      delete: del,
    } satisfies EnterpriseRepository
  })
)
