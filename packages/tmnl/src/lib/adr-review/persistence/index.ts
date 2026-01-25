/**
 * ADR Review Persistence
 *
 * Browser-compatible SQLite persistence using @effect/sql-sqlite-wasm.
 * Stores database snapshots in IndexedDB for durability.
 *
 * @example
 * ```typescript
 * import { hydrateADR, persistUnitStatus } from './persistence'
 *
 * // Hydrate on mount
 * const state = await hydrateADR('S7')
 *
 * // Persist changes (fire-and-forget)
 * persistUnitStatus('S7', 'context.problem', 'accepted')
 * ```
 */

// Layer
export {
  ADRReviewPersistenceLive,
  ADRReviewPersistenceTest,
  SqliteClientLive,
  SqliteClientTest,
  ADRPersistence,
  ADRPersistenceLive,
  type ADRPersistenceService,
} from './layer'

// Repositories
export {
  UnitReviewRepo,
  ReviewCommentRepo,
  type UnitReviewRepository,
  type ReviewCommentRepository,
  AllRepositoriesLive,
} from './repositories'

// Models
export {
  UnitReviewModel,
  ReviewCommentModel,
  AdrId,
  UnitPath,
  CommentId,
  type UnitReviewInsert,
  type ReviewCommentInsert,
} from './models'

// Migrations
export { runMigrations, getCurrentVersion, SCHEMA_VERSION } from './migrations'

// Service (hydration + persist)
export {
  hydrateADR,
  hydrateAll,
  persistUnitStatus,
  persistComment,
  deleteComment,
  type HydratedState,
} from './service'
