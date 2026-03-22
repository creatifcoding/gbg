/**
 * Repository Effect.Service Definitions
 *
 * DI-first repository services using Effect.Service pattern.
 * Each service wraps Model.makeRepository via the `effect` field.
 *
 * Pattern:
 * - Effect.Service<>() defines service with factory in `effect` field
 * - `.Default` layer automatically requires SqlClient.SqlClient
 * - Consumer uses `yield* AssetRepository` to access
 *
 * @module @gbg/tmnl/ams/v2/base/services/repositories
 */

import { Effect, Layer } from 'effect'
import {
  makeAssetRepository,
  makeSiteRepository,
  makeSectorRepository,
  makeContainerRepository,
  makeAssetPropertyRepository,
  makeAssetTraitRepository,
  makeEventJournalRepository,
} from '../repositories/asset'

// ─────────────────────────────────────────────────────────────────────────────
// Repository Services (Effect.Service pattern)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asset Repository Service
 *
 * Provides CRUD operations for AssetModel.
 * Requires SqlClient.SqlClient in environment.
 *
 * @example
 * ```ts
 * const repo = yield* AssetRepository
 * const asset = yield* repo.findById(assetId)
 * ```
 */
export class AssetRepository extends Effect.Service<AssetRepository>()(
  '@gbg/tmnl/ams/v2/AssetRepository',
  {
    effect: makeAssetRepository,
  }
) {}

/**
 * Site Repository Service
 *
 * Provides CRUD operations for SiteModel.
 * Requires SqlClient.SqlClient in environment.
 */
export class SiteRepository extends Effect.Service<SiteRepository>()(
  '@gbg/tmnl/ams/v2/SiteRepository',
  {
    effect: makeSiteRepository,
  }
) {}

/**
 * Sector Repository Service
 *
 * Provides CRUD operations for SectorModel.
 * Requires SqlClient.SqlClient in environment.
 */
export class SectorRepository extends Effect.Service<SectorRepository>()(
  '@gbg/tmnl/ams/v2/SectorRepository',
  {
    effect: makeSectorRepository,
  }
) {}

/**
 * Container Repository Service
 *
 * Provides CRUD operations for ContainerModel.
 * Requires SqlClient.SqlClient in environment.
 */
export class ContainerRepository extends Effect.Service<ContainerRepository>()(
  '@gbg/tmnl/ams/v2/ContainerRepository',
  {
    effect: makeContainerRepository,
  }
) {}

/**
 * Asset Property Repository Service
 *
 * Provides CRUD operations for AssetPropertyModel (EAV pattern).
 * Requires SqlClient.SqlClient in environment.
 */
export class AssetPropertyRepository extends Effect.Service<AssetPropertyRepository>()(
  '@gbg/tmnl/ams/v2/AssetPropertyRepository',
  {
    effect: makeAssetPropertyRepository,
  }
) {}

/**
 * Asset Trait Repository Service
 *
 * Provides CRUD operations for AssetTraitModel.
 * Requires SqlClient.SqlClient in environment.
 */
export class AssetTraitRepository extends Effect.Service<AssetTraitRepository>()(
  '@gbg/tmnl/ams/v2/AssetTraitRepository',
  {
    effect: makeAssetTraitRepository,
  }
) {}

/**
 * Event Journal Repository Service
 *
 * Provides CRUD operations for EventJournalModel.
 * Used by SqlEventJournal for event persistence.
 * Requires SqlClient.SqlClient in environment.
 */
export class EventJournalRepository extends Effect.Service<EventJournalRepository>()(
  '@gbg/tmnl/ams/v2/EventJournalRepository',
  {
    effect: makeEventJournalRepository,
  }
) {}

// ─────────────────────────────────────────────────────────────────────────────
// Combined Repository Layer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All Repositories Layer
 *
 * Merges all repository .Default layers into one.
 * Requires: SqlClient.SqlClient
 *
 * @example
 * ```ts
 * const TestLayer = AssetStateSQLLayer.pipe(
 *   Layer.provide(AllRepositoriesLive),
 *   Layer.provide(SqliteTestLayer),
 * )
 * ```
 */
export const AllRepositoriesLive = Layer.mergeAll(
  AssetRepository.Default,
  SiteRepository.Default,
  SectorRepository.Default,
  ContainerRepository.Default,
  AssetPropertyRepository.Default,
  AssetTraitRepository.Default,
  EventJournalRepository.Default
)
