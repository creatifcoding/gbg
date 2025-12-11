/**
 * SQL-Backed Asset State Service
 *
 * Production implementation of AssetState using repository services.
 * Delegates all operations to AssetRepository, SiteRepository, etc.
 *
 * Usage:
 * ```ts
 * const ProductionLayer = AssetStateSQLLayer.pipe(
 *   Layer.provide(AllRepositoriesLive),
 *   Layer.provide(SqliteTestLayer), // or PostgresLayer
 * )
 * ```
 *
 * @module @gbg/tmnl/ams/v2/base/services/asset-state-sql
 */

import { Effect, Layer, Option, DateTime } from 'effect'
import { SqlClient } from '@effect/sql'
import { Asset, AssetStatus, BaseAssetProperties, AssetSummary } from '../schemas/asset'
import { AssetLocation } from '../schemas/location'
import { AssetProperty, AssetProperties, PropertyMutable, PropertyValue } from '../schemas/property'
import { AssetTraits, TraitInstance } from '../schemas/trait'
import { Provenance } from '../../core/schemas/provenance'
import {
  AssetId,
  AssetKind,
  AssetLabel,
  AssetDescription,
  SiteId,
  SectorId,
  ContainerId,
  PropertyKey,
  TraitId,
  Tags,
  IdentityId,
} from '../../core/schemas/identifiers'
import { BfoMaterialEntity } from '../../core/schemas/bfo'
import { CreatedAt, UpdatedAt } from '../../core/schemas/timestamps'
import { AssetNotFoundError, AssetValidationError, AssetConflictError } from '../commands/asset'
import { PaginatedAssets } from '../queries/asset'
import { AssetState } from './asset-state'
import {
  AssetRepository,
  AssetPropertyRepository,
  AssetTraitRepository,
} from './repositories'
import {
  AssetModel,
  AssetPropertyModel,
  AssetTraitModel,
} from '../repositories/asset'
import type { AssetStateShape } from './asset-state-shape'

// ─────────────────────────────────────────────────────────────────────────────
// ID Generation
// ─────────────────────────────────────────────────────────────────────────────

let idCounter = 0
const generateAssetId = (): AssetId => {
  idCounter++
  return `asset-${idCounter.toString().padStart(6, '0')}` as AssetId
}

// ─────────────────────────────────────────────────────────────────────────────
// Model <-> Domain Transformations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert AssetModel (SQL) to Asset (Domain)
 */
const modelToAsset = (model: AssetModel): Asset =>
  new Asset({
    id: model.id,
    bfoClass: model.bfoClass as BfoMaterialEntity,
    kind: model.kind,
    label: model.label,
    description: Option.getOrUndefined(model.description),
    status: model.status,
    location: new AssetLocation({
      siteId: model.siteId,
      sectorId: Option.getOrUndefined(model.sectorId),
      containerId: Option.getOrUndefined(model.containerId),
    }),
    baseProperties: Option.match(model.basePropertiesJson, {
      onNone: () => new BaseAssetProperties({ quantity: 1 }),
      onSome: (v) => v as BaseAssetProperties,
    }),
    properties: [] as unknown as AssetProperties,
    traits: [] as unknown as AssetTraits,
    tags: Option.match(model.tagsJson, {
      onNone: () => [] as unknown as Tags,
      onSome: (v) => v as Tags,
    }),
    createdAt: model.createdAt as unknown as CreatedAt,
    updatedAt: model.updatedAt as unknown as UpdatedAt,
  })

/**
 * Convert AssetModel (SQL) to AssetSummary (Domain)
 *
 * Note: Raw SQL queries return `null` for nullable columns, not Option.
 * Repository methods return proper Option values, but direct sql`` queries don't.
 */
const modelToSummary = (model: AssetModel | Record<string, unknown>): AssetSummary => {
  // Handle both repository results (Option) and raw SQL results (null)
  const sectorId = model.sectorId === null || model.sectorId === undefined
    ? undefined
    : typeof (model.sectorId as { _tag?: string })?._tag === 'string'
      ? Option.getOrUndefined(model.sectorId as Option.Option<SectorId>)
      : model.sectorId as SectorId | undefined

  return new AssetSummary({
    id: model.id as AssetId,
    kind: model.kind as AssetKind,
    label: model.label as AssetLabel,
    status: model.status as AssetStatus,
    siteId: model.siteId as SiteId,
    sectorId,
  })
}

/**
 * Convert AssetPropertyModel (SQL) to AssetProperty (Domain)
 *
 * Note: Raw SQL queries return JSON columns as strings, need parsing.
 * Provenance is a TaggedClass, so we need to construct it properly.
 */
const propertyModelToProperty = (model: AssetPropertyModel | Record<string, unknown>): AssetProperty => {
  // Handle provenanceJson being a string (raw SQL) or object (repository)
  const rawProvenance = model.provenanceJson ?? (model as Record<string, unknown>).provenance_json
  const parsed = typeof rawProvenance === 'string'
    ? JSON.parse(rawProvenance) as Record<string, unknown>
    : rawProvenance as Record<string, unknown>

  // Construct Provenance TaggedClass from raw data
  // If it already has _tag: 'Provenance', use as-is; otherwise construct new instance
  // Timestamp needs conversion from ISO string to DateTime
  const timestamp = typeof parsed.timestamp === 'string'
    ? DateTime.unsafeMake(new Date(parsed.timestamp))
    : parsed.timestamp as DateTime.DateTime.Utc

  const provenance = parsed._tag === 'Provenance'
    ? parsed as unknown as Provenance
    : new Provenance({
        sourceType: parsed.sourceType as typeof Provenance.Type['sourceType'],
        sourceId: parsed.sourceId as typeof Provenance.Type['sourceId'],
        timestamp: timestamp as CreatedAt,
        confidence: parsed.confidence as typeof Provenance.Type['confidence'],
        attestationRef: parsed.attestationRef as typeof Provenance.Type['attestationRef'],
      })

  return new AssetProperty({
    key: model.key as PropertyKey,
    value: model.value as PropertyValue,
    provenance,
    mutable: true as PropertyMutable,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL-Backed AssetState Layer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SQL-backed AssetState implementation
 *
 * Provides AssetState service by delegating to repository services.
 * Requires: AssetRepository, AssetPropertyRepository, AssetTraitRepository
 */
export const AssetStateSQLLayer = Layer.effect(
  AssetState,
  Effect.gen(function* () {
    const assetRepo = yield* AssetRepository
    const propertyRepo = yield* AssetPropertyRepository
    const traitRepo = yield* AssetTraitRepository
    const sql = yield* SqlClient.SqlClient

    // ─────────────────────────────────────────────────────────────────────────
    // Commands
    // ─────────────────────────────────────────────────────────────────────────

    const create: AssetStateShape['create'] = (params) =>
      Effect.gen(function* () {
        const id = generateAssetId()

        const model = yield* assetRepo.insert(
          AssetModel.insert.make({
            id,
            bfoClass: 'material_entity',
            kind: params.kind as never,
            label: params.label as never,
            description: params.description ? Option.some(params.description as never) : Option.none(),
            status: params.status ?? ('available' as AssetStatus),
            siteId: params.siteId,
            sectorId: params.sectorId ? Option.some(params.sectorId) : Option.none(),
            containerId: params.containerId ? Option.some(params.containerId) : Option.none(),
            basePropertiesJson: params.baseProperties
              ? Option.some(params.baseProperties as unknown)
              : Option.none(),
            tagsJson: params.tags ? Option.some(params.tags as unknown) : Option.none(),
            version: 1,
          })
        )

        return modelToAsset(model)
      })

    const update: AssetStateShape['update'] = (params) =>
      Effect.gen(function* () {
        const existing = yield* assetRepo.findById(params.assetId)

        if (Option.isNone(existing)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId: params.assetId,
              message: `Asset ${params.assetId} not found`,
            })
          )
        }

        const current = existing.value

        if (params.expectedVersion !== undefined && current.version !== params.expectedVersion) {
          return yield* Effect.fail(
            new AssetConflictError({
              assetId: params.assetId,
              reason: `Version mismatch: expected ${params.expectedVersion}, got ${current.version}`,
              expectedVersion: params.expectedVersion,
              actualVersion: current.version,
            })
          )
        }

        const updated = yield* assetRepo.update(
          AssetModel.update.make({
            ...current,
            label: params.label ?? current.label,
            description: params.description
              ? Option.some(params.description as never)
              : current.description,
            status: params.status ?? current.status,
            tagsJson: params.tags ? Option.some(params.tags as unknown) : current.tagsJson,
            version: current.version + 1,
          })
        )

        return modelToAsset(updated)
      })

    const move: AssetStateShape['move'] = (params) =>
      Effect.gen(function* () {
        const existing = yield* assetRepo.findById(params.assetId)

        if (Option.isNone(existing)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId: params.assetId,
              message: `Asset ${params.assetId} not found`,
            })
          )
        }

        const current = existing.value

        const updated = yield* assetRepo.update(
          AssetModel.update.make({
            ...current,
            siteId: params.toSiteId,
            sectorId: params.toSectorId ? Option.some(params.toSectorId) : Option.none(),
            containerId: params.toContainerId ? Option.some(params.toContainerId) : Option.none(),
            version: current.version + 1,
          })
        )

        return modelToAsset(updated)
      })

    const setProperty: AssetStateShape['setProperty'] = (params) =>
      Effect.gen(function* () {
        // Verify asset exists
        const existing = yield* assetRepo.findById(params.assetId)
        if (Option.isNone(existing)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId: params.assetId,
              message: `Asset ${params.assetId} not found`,
            })
          )
        }

        // Check if property exists (upsert)
        const existingProps = yield* sql<{ id: number }>`
          SELECT id FROM asset_properties
          WHERE asset_id = ${params.assetId} AND key = ${params.key}
        `

        if (existingProps.length > 0) {
          // Update existing property
          yield* sql`
            UPDATE asset_properties
            SET value = ${String(params.value)},
                provenance_json = ${JSON.stringify(params.provenance)},
                updated_at = CURRENT_TIMESTAMP
            WHERE asset_id = ${params.assetId} AND key = ${params.key}
          `
        } else {
          // Insert new property
          yield* propertyRepo.insert(
            AssetPropertyModel.insert.make({
              assetId: params.assetId,
              key: params.key,
              value: String(params.value),
              provenanceJson: params.provenance,
            })
          )
        }
      })

    const removeProperty: AssetStateShape['removeProperty'] = (params) =>
      Effect.gen(function* () {
        // Verify asset exists
        const existing = yield* assetRepo.findById(params.assetId)
        if (Option.isNone(existing)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId: params.assetId,
              message: `Asset ${params.assetId} not found`,
            })
          )
        }

        yield* sql`
          DELETE FROM asset_properties
          WHERE asset_id = ${params.assetId} AND key = ${params.key}
        `
      })

    const addTrait: AssetStateShape['addTrait'] = (params) =>
      Effect.gen(function* () {
        // Verify asset exists
        const existing = yield* assetRepo.findById(params.assetId)
        if (Option.isNone(existing)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId: params.assetId,
              message: `Asset ${params.assetId} not found`,
            })
          )
        }

        // Check if trait exists (upsert)
        const existingTraits = yield* sql<{ id: number }>`
          SELECT id FROM asset_traits
          WHERE asset_id = ${params.assetId} AND trait_id = ${params.traitId}
        `

        if (existingTraits.length > 0) {
          // Update existing trait
          yield* sql`
            UPDATE asset_traits
            SET config_json = ${params.config ? JSON.stringify(params.config) : null},
                updated_at = CURRENT_TIMESTAMP
            WHERE asset_id = ${params.assetId} AND trait_id = ${params.traitId}
          `
        } else {
          // Insert new trait
          yield* traitRepo.insert(
            AssetTraitModel.insert.make({
              assetId: params.assetId,
              traitId: params.traitId,
              configJson: params.config ? Option.some(params.config) : Option.none(),
            })
          )
        }
      })

    const removeTrait: AssetStateShape['removeTrait'] = (params) =>
      Effect.gen(function* () {
        // Verify asset exists
        const existing = yield* assetRepo.findById(params.assetId)
        if (Option.isNone(existing)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId: params.assetId,
              message: `Asset ${params.assetId} not found`,
            })
          )
        }

        yield* sql`
          DELETE FROM asset_traits
          WHERE asset_id = ${params.assetId} AND trait_id = ${params.traitId}
        `
      })

    const deleteAsset: AssetStateShape['delete'] = (params) =>
      Effect.gen(function* () {
        const existing = yield* assetRepo.findById(params.assetId)
        if (Option.isNone(existing)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId: params.assetId,
              message: `Asset ${params.assetId} not found`,
            })
          )
        }

        if (params.hardDelete) {
          // Hard delete: remove asset (cascade deletes properties/traits)
          yield* assetRepo.delete(params.assetId)
        } else {
          // Soft delete: update status to retired
          const current = existing.value
          yield* assetRepo.update(
            AssetModel.update.make({
              ...current,
              status: 'retired' as AssetStatus,
              version: current.version + 1,
            })
          )
        }
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────────────────────────────────

    const findById: AssetStateShape['findById'] = (assetId) =>
      Effect.gen(function* () {
        const result = yield* assetRepo.findById(assetId)

        if (Option.isNone(result)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId,
              message: `Asset ${assetId} not found`,
            })
          )
        }

        return modelToAsset(result.value)
      })

    const findSummaryById: AssetStateShape['findSummaryById'] = (assetId) =>
      Effect.gen(function* () {
        const result = yield* assetRepo.findById(assetId)

        if (Option.isNone(result)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId,
              message: `Asset ${assetId} not found`,
            })
          )
        }

        return modelToSummary(result.value)
      })

    const exists: AssetStateShape['exists'] = (assetId) =>
      Effect.gen(function* () {
        const result = yield* assetRepo.findById(assetId)
        return Option.isSome(result)
      })

    const listBySite: AssetStateShape['listBySite'] = (params) =>
      Effect.gen(function* () {
        const limit = params.limit ?? 50
        const offset = params.cursor ? parseInt(params.cursor, 10) : 0

        const rows = yield* sql<AssetModel>`
          SELECT * FROM assets
          WHERE site_id = ${params.siteId}
          ORDER BY created_at DESC
          LIMIT ${limit + 1} OFFSET ${offset}
        `

        const hasNextPage = rows.length > limit
        const items = hasNextPage ? rows.slice(0, limit) : rows

        // Get total count
        const countResult = yield* sql<{ count: number }>`
          SELECT COUNT(*) as count FROM assets WHERE site_id = ${params.siteId}
        `
        const totalCount = countResult[0]?.count ?? 0

        return {
          _tag: 'PaginatedAssets' as const,
          items: items.map(modelToSummary),
          pageInfo: {
            _tag: 'PageInfo' as const,
            nextCursor: hasNextPage ? String(offset + limit) : null,
            hasNextPage,
            totalCount,
          },
        }
      })

    const listBySector: AssetStateShape['listBySector'] = (params) =>
      Effect.gen(function* () {
        const limit = params.limit ?? 50
        const offset = params.cursor ? parseInt(params.cursor, 10) : 0

        const rows = yield* sql<AssetModel>`
          SELECT * FROM assets
          WHERE sector_id = ${params.sectorId}
          ORDER BY created_at DESC
          LIMIT ${limit + 1} OFFSET ${offset}
        `

        const hasNextPage = rows.length > limit
        const items = hasNextPage ? rows.slice(0, limit) : rows

        const countResult = yield* sql<{ count: number }>`
          SELECT COUNT(*) as count FROM assets WHERE sector_id = ${params.sectorId}
        `
        const totalCount = countResult[0]?.count ?? 0

        return {
          _tag: 'PaginatedAssets' as const,
          items: items.map(modelToSummary),
          pageInfo: {
            _tag: 'PageInfo' as const,
            nextCursor: hasNextPage ? String(offset + limit) : null,
            hasNextPage,
            totalCount,
          },
        }
      })

    const listByContainer: AssetStateShape['listByContainer'] = (params) =>
      Effect.gen(function* () {
        const limit = params.limit ?? 50
        const offset = params.cursor ? parseInt(params.cursor, 10) : 0

        const rows = yield* sql<AssetModel>`
          SELECT * FROM assets
          WHERE container_id = ${params.containerId}
          ORDER BY created_at DESC
          LIMIT ${limit + 1} OFFSET ${offset}
        `

        const hasNextPage = rows.length > limit
        const items = hasNextPage ? rows.slice(0, limit) : rows

        const countResult = yield* sql<{ count: number }>`
          SELECT COUNT(*) as count FROM assets WHERE container_id = ${params.containerId}
        `
        const totalCount = countResult[0]?.count ?? 0

        return {
          _tag: 'PaginatedAssets' as const,
          items: items.map(modelToSummary),
          pageInfo: {
            _tag: 'PageInfo' as const,
            nextCursor: hasNextPage ? String(offset + limit) : null,
            hasNextPage,
            totalCount,
          },
        }
      })

    const search: AssetStateShape['search'] = (params) =>
      Effect.gen(function* () {
        const limit = params.limit ?? 50
        const offset = params.cursor ? parseInt(params.cursor, 10) : 0

        // Build dynamic WHERE clause
        const conditions: string[] = ['1=1']
        if (params.siteId) conditions.push(`site_id = '${params.siteId}'`)
        if (params.sectorId) conditions.push(`sector_id = '${params.sectorId}'`)
        if (params.containerId) conditions.push(`container_id = '${params.containerId}'`)
        if (params.kind) conditions.push(`kind = '${params.kind}'`)
        if (params.status) conditions.push(`status = '${params.status}'`)
        if (params.query) {
          const q = params.query.toLowerCase()
          conditions.push(`(LOWER(label) LIKE '%${q}%' OR LOWER(description) LIKE '%${q}%')`)
        }

        const whereClause = conditions.join(' AND ')

        // Use raw SQL for dynamic query (parameterized queries don't support dynamic WHERE)
        const rows = yield* sql.unsafe<AssetModel>(
          `SELECT * FROM assets WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${limit + 1} OFFSET ${offset}`
        )

        const hasNextPage = rows.length > limit
        const items = hasNextPage ? rows.slice(0, limit) : rows

        const countResult = yield* sql.unsafe<{ count: number }>(
          `SELECT COUNT(*) as count FROM assets WHERE ${whereClause}`
        )
        const totalCount = countResult[0]?.count ?? 0

        return {
          _tag: 'PaginatedAssets' as const,
          items: items.map(modelToSummary),
          pageInfo: {
            _tag: 'PageInfo' as const,
            nextCursor: hasNextPage ? String(offset + limit) : null,
            hasNextPage,
            totalCount,
          },
        }
      })

    const getProperty: AssetStateShape['getProperty'] = (params) =>
      Effect.gen(function* () {
        const rows = yield* sql<AssetPropertyModel>`
          SELECT * FROM asset_properties
          WHERE asset_id = ${params.assetId} AND key = ${params.key}
        `

        if (rows.length === 0) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId: params.assetId,
              message: `Property ${params.key} not found on asset ${params.assetId}`,
            })
          )
        }

        return propertyModelToProperty(rows[0])
      })

    const getProperties: AssetStateShape['getProperties'] = (params) =>
      Effect.gen(function* () {
        // Verify asset exists
        const existing = yield* assetRepo.findById(params.assetId)
        if (Option.isNone(existing)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId: params.assetId,
              message: `Asset ${params.assetId} not found`,
            })
          )
        }

        const rows = yield* sql<AssetPropertyModel>`
          SELECT * FROM asset_properties WHERE asset_id = ${params.assetId}
        `

        return rows.map(propertyModelToProperty)
      })

    const countBySite: AssetStateShape['countBySite'] = (siteId) =>
      Effect.gen(function* () {
        const result = yield* sql<{ count: number }>`
          SELECT COUNT(*) as count FROM assets WHERE site_id = ${siteId}
        `
        return result[0]?.count ?? 0
      })

    const countByStatus: AssetStateShape['countByStatus'] = (status) =>
      Effect.gen(function* () {
        const result = yield* sql<{ count: number }>`
          SELECT COUNT(*) as count FROM assets WHERE status = ${status}
        `
        return result[0]?.count ?? 0
      })

    const countByKind: AssetStateShape['countByKind'] = (kind) =>
      Effect.gen(function* () {
        const result = yield* sql<{ count: number }>`
          SELECT COUNT(*) as count FROM assets WHERE kind = ${kind}
        `
        return result[0]?.count ?? 0
      })

    return {
      // Commands
      create,
      update,
      move,
      setProperty,
      removeProperty,
      addTrait,
      removeTrait,
      delete: deleteAsset,

      // Queries
      findById,
      findSummaryById,
      exists,
      listBySite,
      listBySector,
      listByContainer,
      search,
      getProperty,
      getProperties,
      countBySite,
      countByStatus,
      countByKind,
    } satisfies AssetStateShape
  })
)
