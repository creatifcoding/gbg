/**
 * Genifer Repositories — Barrel exports + composed layer
 *
 * @module
 */

import { Layer } from 'effect'

import { GeniferTreeRepoLive } from './GeniferTreeRepo'
import { GeniferElementRepoLive } from './GeniferElementRepo'
import { GeniferCompositeRepoLive } from './GeniferCompositeRepo'
import { GeniferSignalRepoLive } from './GeniferSignalRepo'

// =============================================================================
// Composed Layer
// =============================================================================

/**
 * All genifer repositories combined.
 *
 * Requires: SqlClient.SqlClient
 */
export const GeniferRepositoriesLive = Layer.mergeAll(
  GeniferTreeRepoLive,
  GeniferElementRepoLive,
  GeniferCompositeRepoLive,
  GeniferSignalRepoLive,
)

// =============================================================================
// Re-exports
// =============================================================================

export { GeniferTreeRepo, GeniferTreeRepoLive, type GeniferTreeRepository, type GeniferTreeRepoError } from './GeniferTreeRepo'
export { GeniferElementRepo, GeniferElementRepoLive, type GeniferElementRepository, type GeniferElementRepoError, type ElementInsert } from './GeniferElementRepo'
export { GeniferCompositeRepo, GeniferCompositeRepoLive, type GeniferCompositeRepository, type GeniferCompositeRepoError } from './GeniferCompositeRepo'
export { GeniferSignalRepo, GeniferSignalRepoLive, type GeniferSignalRepository, type GeniferSignalRepoError } from './GeniferSignalRepo'

// Persistence pipeline (save/load bridge)
export { GeniferPersistence, GeniferPersistenceLive, type GeniferPersistenceService, type SaveTreeInput, type SaveTreeResult, type LoadTreeResult, type PersistenceError } from './persistence'
