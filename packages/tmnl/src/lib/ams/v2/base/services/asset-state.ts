/**
 * Asset State Service
 *
 * In-memory state for Entity handlers.
 * Follows the canonical TestEntityState pattern from @effect/cluster.
 *
 * @module @gbg/tmnl/ams/v2/base/services/asset-state
 */

import { Effect, Ref, HashMap, Option, DateTime } from 'effect'
import { Asset, AssetStatus, BaseAssetProperties, AssetSummary } from '../schemas/asset'
import { AssetLocation } from '../schemas/location'
import { AssetProperty, AssetProperties, PropertyValue, PropertyMutable } from '../schemas/property'
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

// ─────────────────────────────────────────────────────────────────────────────
// Internal State Types
// ─────────────────────────────────────────────────────────────────────────────

interface AssetRecord {
  asset: Asset
  version: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Asset State Service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In-memory asset state for Entity handlers.
 *
 * Production: Replace with SQL-backed implementation.
 * Testing: Use this directly for fast unit tests.
 */
export class AssetState extends Effect.Service<AssetState>()('@gbg/tmnl/ams/v2/AssetState', {
  effect: Effect.gen(function* () {
    // In-memory stores
    const assets = yield* Ref.make(HashMap.empty<AssetId, AssetRecord>())
    const properties = yield* Ref.make(HashMap.empty<string, AssetProperty>()) // key = `${assetId}:${propertyKey}`
    const traits = yield* Ref.make(HashMap.empty<string, TraitInstance>()) // key = `${assetId}:${traitId}`

    let idCounter = 0
    const generateId = (): AssetId => {
      idCounter++
      return `asset-${idCounter.toString().padStart(6, '0')}` as AssetId
    }

    const now = (): DateTime.Utc => DateTime.unsafeNow()

    // ─────────────────────────────────────────────────────────────────────────
    // Commands
    // ─────────────────────────────────────────────────────────────────────────

    const create = (params: {
      siteId: SiteId
      kind: AssetKind
      label: AssetLabel
      description?: AssetDescription
      status?: AssetStatus
      sectorId?: SectorId
      containerId?: ContainerId
      baseProperties?: BaseAssetProperties
      tags?: Tags
      createdBy: IdentityId
    }): Effect.Effect<Asset, AssetValidationError> =>
      Effect.gen(function* () {
        const id = generateId()
        const timestamp = now()

        const asset = new Asset({
          id,
          bfoClass: 'material_entity' as BfoMaterialEntity,
          kind: params.kind,
          label: params.label,
          description: params.description,
          status: params.status ?? ('available' as AssetStatus),
          location: new AssetLocation({
            siteId: params.siteId,
            sectorId: params.sectorId,
            containerId: params.containerId,
          }),
          baseProperties:
            params.baseProperties ?? new BaseAssetProperties({ quantity: 1 }),
          properties: [] as unknown as AssetProperties,
          traits: [] as unknown as AssetTraits,
          tags: params.tags ?? ([] as unknown as Tags),
          createdAt: timestamp as CreatedAt,
          updatedAt: timestamp as UpdatedAt,
        })

        yield* Ref.update(assets, HashMap.set(id, { asset, version: 1 }))

        return asset
      })

    const update = (params: {
      assetId: AssetId
      label?: AssetLabel
      description?: AssetDescription
      status?: AssetStatus
      tags?: Tags
      expectedVersion?: number
      updatedBy: IdentityId
    }): Effect.Effect<Asset, AssetNotFoundError | AssetConflictError> =>
      Effect.gen(function* () {
        const current = yield* Ref.get(assets)
        const record = HashMap.get(current, params.assetId)

        if (Option.isNone(record)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId: params.assetId,
              message: `Asset ${params.assetId} not found`,
            })
          )
        }

        const { asset, version } = record.value

        if (params.expectedVersion !== undefined && version !== params.expectedVersion) {
          return yield* Effect.fail(
            new AssetConflictError({
              assetId: params.assetId,
              reason: `Version mismatch: expected ${params.expectedVersion}, got ${version}`,
              expectedVersion: params.expectedVersion,
              actualVersion: version,
            })
          )
        }

        const updated = new Asset({
          ...asset,
          label: params.label ?? asset.label,
          description: params.description ?? asset.description,
          status: params.status ?? asset.status,
          tags: params.tags ?? asset.tags,
          updatedAt: now() as UpdatedAt,
        })

        yield* Ref.update(assets, HashMap.set(params.assetId, { asset: updated, version: version + 1 }))

        return updated
      })

    const move = (params: {
      assetId: AssetId
      toSiteId: SiteId
      toSectorId?: SectorId
      toContainerId?: ContainerId
      reason?: string
      movedBy: IdentityId
    }): Effect.Effect<Asset, AssetNotFoundError> =>
      Effect.gen(function* () {
        const current = yield* Ref.get(assets)
        const record = HashMap.get(current, params.assetId)

        if (Option.isNone(record)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId: params.assetId,
              message: `Asset ${params.assetId} not found`,
            })
          )
        }

        const { asset, version } = record.value

        const updated = new Asset({
          ...asset,
          location: new AssetLocation({
            siteId: params.toSiteId,
            sectorId: params.toSectorId,
            containerId: params.toContainerId,
          }),
          updatedAt: now() as UpdatedAt,
        })

        yield* Ref.update(assets, HashMap.set(params.assetId, { asset: updated, version: version + 1 }))

        return updated
      })

    const setProperty = (params: {
      assetId: AssetId
      key: PropertyKey
      value: PropertyValue
      provenance: Provenance
      changedBy: IdentityId
    }): Effect.Effect<void, AssetNotFoundError> =>
      Effect.gen(function* () {
        const current = yield* Ref.get(assets)
        const record = HashMap.get(current, params.assetId)

        if (Option.isNone(record)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId: params.assetId,
              message: `Asset ${params.assetId} not found`,
            })
          )
        }

        const prop = new AssetProperty({
          key: params.key,
          value: params.value,
          provenance: params.provenance,
          mutable: true as PropertyMutable,
        })

        const propKey = `${params.assetId}:${params.key}`
        yield* Ref.update(properties, HashMap.set(propKey, prop))
      })

    const removeProperty = (params: {
      assetId: AssetId
      key: PropertyKey
      reason?: string
      removedBy: IdentityId
    }): Effect.Effect<void, AssetNotFoundError> =>
      Effect.gen(function* () {
        const current = yield* Ref.get(assets)
        const record = HashMap.get(current, params.assetId)

        if (Option.isNone(record)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId: params.assetId,
              message: `Asset ${params.assetId} not found`,
            })
          )
        }

        const propKey = `${params.assetId}:${params.key}`
        yield* Ref.update(properties, HashMap.remove(propKey))
      })

    const addTrait = (params: {
      assetId: AssetId
      traitId: TraitId
      config?: unknown
      addedBy: IdentityId
    }): Effect.Effect<void, AssetNotFoundError> =>
      Effect.gen(function* () {
        const current = yield* Ref.get(assets)
        const record = HashMap.get(current, params.assetId)

        if (Option.isNone(record)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId: params.assetId,
              message: `Asset ${params.assetId} not found`,
            })
          )
        }

        const trait = new TraitInstance({
          traitId: params.traitId,
          params: params.config as any,
        })

        const traitKey = `${params.assetId}:${params.traitId}`
        yield* Ref.update(traits, HashMap.set(traitKey, trait))
      })

    const removeTrait = (params: {
      assetId: AssetId
      traitId: TraitId
      reason?: string
      removedBy: IdentityId
    }): Effect.Effect<void, AssetNotFoundError> =>
      Effect.gen(function* () {
        const current = yield* Ref.get(assets)
        const record = HashMap.get(current, params.assetId)

        if (Option.isNone(record)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId: params.assetId,
              message: `Asset ${params.assetId} not found`,
            })
          )
        }

        const traitKey = `${params.assetId}:${params.traitId}`
        yield* Ref.update(traits, HashMap.remove(traitKey))
      })

    const deleteAsset = (params: {
      assetId: AssetId
      hardDelete?: boolean
      reason?: string
      deletedBy: IdentityId
    }): Effect.Effect<void, AssetNotFoundError> =>
      Effect.gen(function* () {
        const current = yield* Ref.get(assets)
        const record = HashMap.get(current, params.assetId)

        if (Option.isNone(record)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId: params.assetId,
              message: `Asset ${params.assetId} not found`,
            })
          )
        }

        if (params.hardDelete) {
          // Hard delete: remove entirely
          yield* Ref.update(assets, HashMap.remove(params.assetId))
          // Remove related properties and traits
          yield* Ref.update(properties, (m) =>
            HashMap.filter(m, (_, k) => !k.startsWith(`${params.assetId}:`))
          )
          yield* Ref.update(traits, (m) =>
            HashMap.filter(m, (_, k) => !k.startsWith(`${params.assetId}:`))
          )
        } else {
          // Soft delete: mark as retired
          const { asset, version } = record.value
          const updated = new Asset({
            ...asset,
            status: 'retired' as AssetStatus,
            updatedAt: now() as UpdatedAt,
          })
          yield* Ref.update(assets, HashMap.set(params.assetId, { asset: updated, version: version + 1 }))
        }
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────────────────────────────────

    const findById = (assetId: AssetId): Effect.Effect<Asset, AssetNotFoundError> =>
      Effect.gen(function* () {
        const current = yield* Ref.get(assets)
        const record = HashMap.get(current, assetId)

        if (Option.isNone(record)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId,
              message: `Asset ${assetId} not found`,
            })
          )
        }

        return record.value.asset
      })

    const findSummaryById = (assetId: AssetId): Effect.Effect<AssetSummary, AssetNotFoundError> =>
      Effect.gen(function* () {
        const asset = yield* findById(assetId)

        return new AssetSummary({
          id: asset.id,
          kind: asset.kind,
          label: asset.label,
          status: asset.status,
          siteId: asset.siteId,
          sectorId: asset.sectorId,
        })
      })

    const exists = (assetId: AssetId): Effect.Effect<boolean> =>
      Effect.gen(function* () {
        const current = yield* Ref.get(assets)
        return HashMap.has(current, assetId)
      })

    const listBySite = (params: {
      siteId: SiteId
      limit?: number
      cursor?: string
    }): Effect.Effect<typeof PaginatedAssets.Type> =>
      Effect.gen(function* () {
        const current = yield* Ref.get(assets)
        const all = HashMap.values(current)
        const filtered = Array.from(all)
          .filter((r) => r.asset.siteId === params.siteId)
          .map((r) => r.asset)

        const limit = params.limit ?? 50
        const offset = params.cursor ? parseInt(params.cursor, 10) : 0
        const sliced = filtered.slice(offset, offset + limit + 1)
        const hasNextPage = sliced.length > limit
        const items = hasNextPage ? sliced.slice(0, limit) : sliced

        const summaries = items.map(
          (a) =>
            new AssetSummary({
              id: a.id,
              kind: a.kind,
              label: a.label,
              status: a.status,
              siteId: a.siteId,
              sectorId: a.sectorId,
            })
        )

        return {
          _tag: 'PaginatedAssets' as const,
          items: summaries,
          pageInfo: {
            _tag: 'PageInfo' as const,
            nextCursor: hasNextPage ? String(offset + limit) : null,
            hasNextPage,
            totalCount: filtered.length,
          },
        }
      })

    const listBySector = (params: {
      sectorId: SectorId
      limit?: number
      cursor?: string
    }): Effect.Effect<typeof PaginatedAssets.Type> =>
      Effect.gen(function* () {
        const current = yield* Ref.get(assets)
        const all = HashMap.values(current)
        const filtered = Array.from(all)
          .filter((r) => r.asset.sectorId === params.sectorId)
          .map((r) => r.asset)

        const limit = params.limit ?? 50
        const offset = params.cursor ? parseInt(params.cursor, 10) : 0
        const sliced = filtered.slice(offset, offset + limit + 1)
        const hasNextPage = sliced.length > limit
        const items = hasNextPage ? sliced.slice(0, limit) : sliced

        const summaries = items.map(
          (a) =>
            new AssetSummary({
              id: a.id,
              kind: a.kind,
              label: a.label,
              status: a.status,
              siteId: a.siteId,
              sectorId: a.sectorId,
            })
        )

        return {
          _tag: 'PaginatedAssets' as const,
          items: summaries,
          pageInfo: {
            _tag: 'PageInfo' as const,
            nextCursor: hasNextPage ? String(offset + limit) : null,
            hasNextPage,
            totalCount: filtered.length,
          },
        }
      })

    const listByContainer = (params: {
      containerId: ContainerId
      limit?: number
      cursor?: string
    }): Effect.Effect<typeof PaginatedAssets.Type> =>
      Effect.gen(function* () {
        const current = yield* Ref.get(assets)
        const all = HashMap.values(current)
        const filtered = Array.from(all)
          .filter((r) => r.asset.containerId === params.containerId)
          .map((r) => r.asset)

        const limit = params.limit ?? 50
        const offset = params.cursor ? parseInt(params.cursor, 10) : 0
        const sliced = filtered.slice(offset, offset + limit + 1)
        const hasNextPage = sliced.length > limit
        const items = hasNextPage ? sliced.slice(0, limit) : sliced

        const summaries = items.map(
          (a) =>
            new AssetSummary({
              id: a.id,
              kind: a.kind,
              label: a.label,
              status: a.status,
              siteId: a.siteId,
              sectorId: a.sectorId,
            })
        )

        return {
          _tag: 'PaginatedAssets' as const,
          items: summaries,
          pageInfo: {
            _tag: 'PageInfo' as const,
            nextCursor: hasNextPage ? String(offset + limit) : null,
            hasNextPage,
            totalCount: filtered.length,
          },
        }
      })

    const search = (params: {
      query?: string
      siteId?: SiteId
      sectorId?: SectorId
      containerId?: ContainerId
      kind?: AssetKind
      status?: AssetStatus
      tags?: Tags
      limit?: number
      cursor?: string
    }): Effect.Effect<typeof PaginatedAssets.Type> =>
      Effect.gen(function* () {
        const current = yield* Ref.get(assets)
        const all = HashMap.values(current)
        let filtered = Array.from(all).map((r) => r.asset)

        if (params.siteId) filtered = filtered.filter((a) => a.siteId === params.siteId)
        if (params.sectorId) filtered = filtered.filter((a) => a.sectorId === params.sectorId)
        if (params.containerId) filtered = filtered.filter((a) => a.containerId === params.containerId)
        if (params.kind) filtered = filtered.filter((a) => a.kind === params.kind)
        if (params.status) filtered = filtered.filter((a) => a.status === params.status)
        if (params.query) {
          const q = params.query.toLowerCase()
          filtered = filtered.filter(
            (a) =>
              a.label.toLowerCase().includes(q) ||
              (a.description?.toLowerCase().includes(q) ?? false)
          )
        }

        const limit = params.limit ?? 50
        const offset = params.cursor ? parseInt(params.cursor, 10) : 0
        const sliced = filtered.slice(offset, offset + limit + 1)
        const hasNextPage = sliced.length > limit
        const items = hasNextPage ? sliced.slice(0, limit) : sliced

        const summaries = items.map(
          (a) =>
            new AssetSummary({
              id: a.id,
              kind: a.kind,
              label: a.label,
              status: a.status,
              siteId: a.siteId,
              sectorId: a.sectorId,
            })
        )

        return {
          _tag: 'PaginatedAssets' as const,
          items: summaries,
          pageInfo: {
            _tag: 'PageInfo' as const,
            nextCursor: hasNextPage ? String(offset + limit) : null,
            hasNextPage,
            totalCount: filtered.length,
          },
        }
      })

    const getProperty = (params: {
      assetId: AssetId
      key: PropertyKey
    }): Effect.Effect<AssetProperty, AssetNotFoundError> =>
      Effect.gen(function* () {
        const propKey = `${params.assetId}:${params.key}`
        const current = yield* Ref.get(properties)
        const prop = HashMap.get(current, propKey)

        if (Option.isNone(prop)) {
          return yield* Effect.fail(
            new AssetNotFoundError({
              assetId: params.assetId,
              message: `Property ${params.key} not found on asset ${params.assetId}`,
            })
          )
        }

        return prop.value
      })

    const getProperties = (params: {
      assetId: AssetId
    }): Effect.Effect<readonly AssetProperty[], AssetNotFoundError> =>
      Effect.gen(function* () {
        // Verify asset exists
        yield* findById(params.assetId)

        const current = yield* Ref.get(properties)
        const prefix = `${params.assetId}:`
        const props = Array.from(HashMap.entries(current))
          .filter(([k]) => k.startsWith(prefix))
          .map(([, v]) => v)

        return props
      })

    const countBySite = (siteId: SiteId): Effect.Effect<number> =>
      Effect.gen(function* () {
        const current = yield* Ref.get(assets)
        const all = HashMap.values(current)
        return Array.from(all).filter((r) => r.asset.siteId === siteId).length
      })

    const countByStatus = (status: AssetStatus): Effect.Effect<number> =>
      Effect.gen(function* () {
        const current = yield* Ref.get(assets)
        const all = HashMap.values(current)
        return Array.from(all).filter((r) => r.asset.status === status).length
      })

    const countByKind = (kind: AssetKind): Effect.Effect<number> =>
      Effect.gen(function* () {
        const current = yield* Ref.get(assets)
        const all = HashMap.values(current)
        return Array.from(all).filter((r) => r.asset.kind === kind).length
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
    } as const
  }),
}) {}
