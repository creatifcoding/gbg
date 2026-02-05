/**
 * SiteRepo - Repository for Site Entity
 *
 * ISA-95 Level 3 (Geographic) - Parent: Enterprise (required).
 * Model defines schema, Repo handles persistence.
 *
 * Uses decode utilities to ensure FieldOption transforms are applied
 * (null → Option.none()) on raw SQL results.
 *
 * @module
 */

import { Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { SiteId, EnterpriseId } from '../schemas/identifiers'
import { SiteModel } from '../models/assets/SiteModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type SiteRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

export interface SiteRepository {
  readonly findById: (id: SiteId) => Effect.Effect<Option.Option<SiteModel>, SiteRepoError>
  readonly findByEnterprise: (enterpriseId: EnterpriseId) => Effect.Effect<readonly SiteModel[], SiteRepoError>
  readonly findAll: () => Effect.Effect<readonly SiteModel[], SiteRepoError>
  readonly insert: (site: typeof SiteModel.insert.Type) => Effect.Effect<SiteModel, SiteRepoError>
  readonly update: (site: typeof SiteModel.update.Type) => Effect.Effect<SiteModel, SiteRepoError>
  readonly delete: (id: SiteId) => Effect.Effect<void, SqlError.SqlError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class SiteRepo extends Context.Tag('iiot/SiteRepo')<
  SiteRepo,
  SiteRepository
>() {}

// =============================================================================
// Repository Implementation
// =============================================================================

export const SiteRepoLive = Layer.effect(
  SiteRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    // Column alias helper for SELECT statements
    const selectColumns = sql`
      id,
      name,
      status,
      hierarchy_path AS "hierarchyPath",
      enterprise_id AS "enterpriseId",
      timezone,
      description,
      address,
      city,
      country,
      location,
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `

    const findById = (id: SiteId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.sites
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(SiteModel)(rows)
      })

    const findByEnterprise = (enterpriseId: EnterpriseId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.sites
          WHERE enterprise_id = ${enterpriseId}
          ORDER BY name ASC
        `
        return yield* decodeRows(SiteModel)(rows)
      })

    const findAll = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT ${selectColumns}
          FROM iiot.sites
          ORDER BY name ASC
        `
        return yield* decodeRows(SiteModel)(rows)
      })

    const insert = (site: typeof SiteModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          INSERT INTO iiot.sites (
            id, name, status, hierarchy_path, enterprise_id,
            timezone, description, address, city, country,
            location, metadata
          )
          VALUES (
            ${site.id},
            ${site.name},
            ${site.status},
            ${site.hierarchyPath},
            ${site.enterpriseId},
            ${site.timezone},
            ${Option.getOrNull(site.description)},
            ${Option.getOrNull(site.address)},
            ${Option.getOrNull(site.city)},
            ${Option.getOrNull(site.country)},
            ${Option.match(site.location, { onNone: () => null, onSome: (v) => JSON.stringify(v) })},
            ${Option.match(site.metadata, { onNone: () => '{}', onSome: (v) => JSON.stringify(v) })}
          )
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(SiteModel)(rows)
      })

    const update = (site: typeof SiteModel.update.Type) =>
      Effect.gen(function* () {
        const changes = prepareUpdate(site)

        const rows = yield* sql`
          UPDATE iiot.sites
          SET ${sql.update(changes, ['id'])}, updated_at = NOW()
          WHERE id = ${site.id}
          RETURNING ${selectColumns}
        `
        return yield* decodeFirst(SiteModel)(rows)
      })

    const del = (id: SiteId) =>
      sql`DELETE FROM iiot.sites WHERE id = ${id}`.pipe(Effect.asVoid)

    return {
      findById,
      findByEnterprise,
      findAll,
      insert,
      update,
      delete: del,
    } satisfies SiteRepository
  })
)
